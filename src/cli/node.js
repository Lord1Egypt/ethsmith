const { spawn } = require('child_process')
const { EventEmitter } = require('events')
const net = require('net')
const path = require('path')
const os = require('os')
const fs = require('fs')
const axios = require('axios')
const { bin } = require('../core/binary')
const { mapGanacheToAnvil } = require('../core/flags')
const { EthsmithDB } = require('../core/db')
const { EthsmithProxy } = require('../core/proxy')
const { Keystore } = require('../core/keystore')
const { mergeConfig, writeDefaultConfig } = require('../core/config')
const logger = require('../core/logger')

const DEFAULT_CHECKPOINT_INTERVAL = 30000
// Anvil writes per-session EVM state to this dir — redundant once ethsmith saves to LevelDB
const ANVIL_TMP_DIR = path.join(os.homedir(), '.foundry', 'anvil', 'tmp')

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

class EthsmithNode extends EventEmitter {
  constructor(rawOpts = {}) {
    super()
    this.opts = mergeConfig(rawOpts)
    this.proc = null
    this.db = null
    this.proxy = null
    this.keystore = null
    this.checkpointTimer = null
    this.internalPort = null
    this.userPort = parseInt(this.opts.port || this.opts.p || 8545, 10)
    // kebab-case CLI opts take priority over camelCase config file defaults
    this.chainId = String(this.opts['chain-id'] || this.opts.chainId || this.opts.networkId || 1337)
    this.internalUrl = null
    this._anvilSessionTmpDir = null  // the specific dir Anvil creates for this session
  }

  async start() {
    writeDefaultConfig()

    // pick a free internal port for Anvil
    this.internalPort = await findFreePort()
    this.internalUrl = `http://127.0.0.1:${this.internalPort}`

    // override port in opts to use internal port for Anvil
    const anvilOpts = { ...this.opts, port: this.internalPort }
    const anvilArgs = mapGanacheToAnvil(anvilOpts)

    // open LevelDB
    const dbPath = this.opts.db || undefined
    this.db = new EthsmithDB(this.chainId, dbPath)
    await this.db.open()

    logger.info('Starting ethsmith node', {
      userPort: this.userPort,
      internalPort: this.internalPort,
      chainId: this.chainId
    })

    // Snapshot existing Anvil tmp dirs so we can identify the new one after spawn
    const tmpDirsBefore = this._listAnvilTmpDirs()

    // spawn Anvil on internal port
    this.proc = spawn(bin('anvil'), anvilArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    })

    this.proc.stdout.on('data', d => {
      process.stdout.write(d)
      logger.debug('[anvil] ' + d.toString().trimEnd())
    })
    this.proc.stderr.on('data', d => {
      process.stderr.write(d)
      logger.warn('[anvil stderr] ' + d.toString().trimEnd())
    })
    this.proc.on('exit', (code, signal) => {
      logger.info('Anvil process exited', { code, signal })
      this._stopCheckpoint()
      this.emit('exit', code, signal)
    })

    // wait for internal Anvil RPC
    await this._waitReady(this.internalPort)

    // Identify the new Anvil tmp dir for this session, then delete all old ones.
    // Anvil creates ~/.foundry/anvil/tmp/anvil-state-<timestamp>/ on every start.
    // These dirs are Anvil's internal disk-backed EVM state — redundant once ethsmith
    // checkpoints to LevelDB. We clean old dirs now and this session's dir on shutdown.
    this._anvilSessionTmpDir = this._findNewAnvilTmpDir(tmpDirsBefore)
    this._cleanOldAnvilTmpDirs(tmpDirsBefore)

    // restore state from LevelDB if any
    const hasPrev = await this.db.hasState()
    if (hasPrev) {
      logger.info('Restoring blockchain state from LevelDB...')
      const stateHex = await this.db.loadState()
      await this._rpc('anvil_loadState', [stateHex])
      const blockNum = await this._rpc('eth_blockNumber', [])
      logger.info('State restored', { blockNumber: parseInt(blockNum, 16) })
    } else {
      logger.info('No previous state — starting fresh chain')
    }

    // build keystore from mnemonic so personal_* methods work
    this.keystore = new Keystore()
    const mnemonic = this.opts.deterministic
      ? undefined // uses DETERMINISTIC_MNEMONIC
      : this.opts.mnemonic
    const accounts = parseInt(this.opts.accounts || this.opts.a || 10, 10)
    await this.keystore.fromMnemonic(mnemonic, accounts)

    // add custom accounts with secretKey (programmatic API)
    if (Array.isArray(this.opts.wallet?.accounts)) {
      for (const acc of this.opts.wallet.accounts) {
        if (acc.secretKey) this.keystore.addAccount(
          new (require('ethers').Wallet)(acc.secretKey).address,
          acc.secretKey
        )
      }
    }

    // start the RPC proxy on user-facing port
    this.proxy = new EthsmithProxy(this.userPort, this.internalPort, this.keystore)
    await this.proxy.start()

    // checkpoint timer
    this._startCheckpoint()

    // graceful shutdown
    for (const sig of ['SIGTERM', 'SIGINT']) {
      process.once(sig, () => this.stop())
    }

    this.emit('ready', {
      port: this.userPort,
      chainId: this.chainId,
      rpcUrl: `http://127.0.0.1:${this.userPort}`
    })
    return this
  }

  async stop() {
    if (this._stopping) return
    this._stopping = true
    logger.info('Shutting down ethsmith node...')
    this._stopCheckpoint()
    await this._checkpoint()
    await this.proxy?.stop()
    if (this.proc && !this.proc.killed) this.proc.kill('SIGTERM')
    await this.db?.close()
    // State is safely in LevelDB — Anvil's session tmp dir is now redundant
    this._cleanCurrentAnvilTmpDir()
    logger.info('ethsmith node stopped')
  }

  // ── RPC (calls internal Anvil directly, bypassing proxy) ──────────────────

  async _rpc(method, params = []) {
    const res = await axios.post(this.internalUrl, {
      jsonrpc: '2.0', id: 1, method, params
    }, { timeout: 10000 })
    if (res.data.error) throw new Error(`RPC ${method}: ${res.data.error.message}`)
    return res.data.result
  }

  async _waitReady(port, maxMs = 15000) {
    const start = Date.now()
    while (Date.now() - start < maxMs) {
      try {
        await axios.post(`http://127.0.0.1:${port}`, {
          jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: []
        }, { timeout: 1000 })
        logger.info('Anvil internal RPC ready', { internalPort: port })
        return
      } catch {
        await new Promise(r => setTimeout(r, 200))
      }
    }
    throw new Error(`Anvil did not start on port ${port} within ${maxMs}ms`)
  }

  // ── Checkpoint ────────────────────────────────────────────────────────────

  _startCheckpoint() {
    const ms = this.opts.stateInterval
      ? Number(this.opts.stateInterval) * 1000
      : DEFAULT_CHECKPOINT_INTERVAL
    this.checkpointTimer = setInterval(() => this._checkpoint(), ms)
    logger.debug('Checkpoint timer started', { intervalMs: ms })
  }

  _stopCheckpoint() {
    if (this.checkpointTimer) { clearInterval(this.checkpointTimer); this.checkpointTimer = null }
  }

  async _checkpoint() {
    if (!this.proc || this.proc.killed || this._stopping && !this.proc) return
    try {
      const stateHex = await this._rpc('anvil_dumpState', [])
      await this.db.saveState(stateHex)
      const blockNum = await this._rpc('eth_blockNumber', [])
      logger.info('Checkpoint saved', { block: parseInt(blockNum, 16) })
    } catch (e) {
      logger.error('Checkpoint failed', { error: e.message })
    }
  }

  // ── Anvil tmp dir management ──────────────────────────────────────────────
  // Anvil creates ~/.foundry/anvil/tmp/anvil-state-<timestamp>/ on every start.
  // These mirror the EVM state on disk — ethsmith's LevelDB makes them redundant.

  _listAnvilTmpDirs() {
    try {
      if (!fs.existsSync(ANVIL_TMP_DIR)) return []
      return fs.readdirSync(ANVIL_TMP_DIR)
        .map(name => path.join(ANVIL_TMP_DIR, name))
        .filter(p => { try { return fs.statSync(p).isDirectory() } catch { return false } })
    } catch { return [] }
  }

  _findNewAnvilTmpDir(before) {
    const after = this._listAnvilTmpDirs()
    const newDirs = after.filter(d => !before.includes(d))
    return newDirs[0] || null
  }

  _cleanOldAnvilTmpDirs(before) {
    // 'before' dirs are from previous sessions — LevelDB already has their state
    for (const dir of before) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
        logger.info('Cleaned old Anvil tmp dir', { dir: path.basename(dir) })
      } catch {}
    }
  }

  _cleanCurrentAnvilTmpDir() {
    if (!this._anvilSessionTmpDir) return
    try {
      fs.rmSync(this._anvilSessionTmpDir, { recursive: true, force: true })
      logger.info('Cleaned Anvil session tmp dir', { dir: path.basename(this._anvilSessionTmpDir) })
    } catch {}
  }
}

async function runNode(opts) {
  const node = new EthsmithNode(opts)
  node.on('exit', code => process.exit(code || 0))
  try {
    await node.start()
  } catch (e) {
    logger.error('Failed to start node', { error: e.message })
    process.exit(1)
  }
}

module.exports = { EthsmithNode, runNode }
