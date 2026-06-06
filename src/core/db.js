const { Level } = require('level')
const zlib = require('zlib')
const path = require('path')
const os = require('os')
const fs = require('fs')
const logger = require('./logger')

const DB_ROOT = path.join(os.homedir(), '.ethsmith', 'db')

class EthsmithDB {
  constructor(chainId, dbPath) {
    this.chainId = chainId
    this.dbPath = dbPath || path.join(DB_ROOT, String(chainId))
    fs.mkdirSync(this.dbPath, { recursive: true })
    this.db = new Level(this.dbPath, { valueEncoding: 'buffer' })
    this._ready = false
  }

  async open() {
    if (this._ready) return
    await this.db.open()
    this._ready = true
    logger.debug('LevelDB opened', { path: this.dbPath, chainId: this.chainId })
  }

  async close() {
    if (!this._ready) return
    await this.db.close()
    this._ready = false
    logger.debug('LevelDB closed', { chainId: this.chainId })
  }

  // ── State persistence (Anvil state hex → gzip → LevelDB) ──────────────────

  async saveState(stateHex) {
    // anvil_dumpState returns 0x-prefixed hex — strip prefix before encoding
    const raw = stateHex.startsWith('0x') ? stateHex.slice(2) : stateHex
    const buf = Buffer.from(raw, 'hex')
    const compressed = zlib.gzipSync(buf)
    const ts = Date.now()
    await this.db.put(`state:latest`, compressed)
    await this.db.put(`state:${ts}`, compressed)
    logger.info('State saved to LevelDB', {
      chainId: this.chainId,
      rawBytes: buf.length,
      compressedBytes: compressed.length,
      ratio: (compressed.length / buf.length).toFixed(2)
    })
  }

  async loadState() {
    try {
      const compressed = await this.db.get('state:latest')
      const buf = zlib.gunzipSync(compressed)
      logger.info('State loaded from LevelDB', {
        chainId: this.chainId,
        bytes: buf.length
      })
      // return with 0x prefix — anvil_loadState expects it
      return '0x' + buf.toString('hex')
    } catch (e) {
      if (e.code === 'LEVEL_NOT_FOUND') return null
      throw e
    }
  }

  async hasState() {
    try {
      await this.db.get('state:latest')
      return true
    } catch {
      return false
    }
  }

  // ── Block storage ──────────────────────────────────────────────────────────

  async saveBlock(blockNumber, blockData) {
    const val = Buffer.from(JSON.stringify(blockData))
    await this.db.put(`block:${blockNumber}`, val)
    await this.db.put('block:latest', Buffer.from(String(blockNumber)))
  }

  async getBlock(blockNumber) {
    try {
      const val = await this.db.get(`block:${blockNumber}`)
      return JSON.parse(val.toString())
    } catch (e) {
      if (e.code === 'LEVEL_NOT_FOUND') return null
      throw e
    }
  }

  async getLatestBlockNumber() {
    try {
      const val = await this.db.get('block:latest')
      return parseInt(val.toString(), 10)
    } catch {
      return 0
    }
  }

  // ── Transaction storage ────────────────────────────────────────────────────

  async saveTx(txHash, txData) {
    await this.db.put(`tx:${txHash}`, Buffer.from(JSON.stringify(txData)))
  }

  async getTx(txHash) {
    try {
      const val = await this.db.get(`tx:${txHash}`)
      return JSON.parse(val.toString())
    } catch (e) {
      if (e.code === 'LEVEL_NOT_FOUND') return null
      throw e
    }
  }

  async saveReceipt(txHash, receipt) {
    await this.db.put(`receipt:${txHash}`, Buffer.from(JSON.stringify(receipt)))
  }

  async getReceipt(txHash) {
    try {
      const val = await this.db.get(`receipt:${txHash}`)
      return JSON.parse(val.toString())
    } catch (e) {
      if (e.code === 'LEVEL_NOT_FOUND') return null
      throw e
    }
  }

  // ── Config / metadata ──────────────────────────────────────────────────────

  async saveMeta(key, value) {
    await this.db.put(`meta:${key}`, Buffer.from(JSON.stringify(value)))
  }

  async getMeta(key) {
    try {
      const val = await this.db.get(`meta:${key}`)
      return JSON.parse(val.toString())
    } catch {
      return null
    }
  }

  // ── DB integrity check ─────────────────────────────────────────────────────

  async integrityCheck() {
    const issues = []
    const latest = await this.getLatestBlockNumber()
    if (latest === 0) return { ok: true, blockCount: 0, issues }

    // spot-check: verify block chain linkage for last 100 blocks
    const checkFrom = Math.max(1, latest - 100)
    let prev = null
    for (let n = checkFrom; n <= latest; n++) {
      const block = await this.getBlock(n)
      if (!block) { issues.push(`missing block ${n}`); continue }
      if (prev && block.parentHash !== prev.hash) {
        issues.push(`parentHash mismatch at block ${n}`)
      }
      prev = block
    }

    logger.info('DB integrity check', { chainId: this.chainId, latestBlock: latest, issues: issues.length })
    return { ok: issues.length === 0, blockCount: latest, issues }
  }
}

module.exports = { EthsmithDB, DB_ROOT }
