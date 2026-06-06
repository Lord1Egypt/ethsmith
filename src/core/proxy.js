// HTTP + WebSocket proxy
// Sits on the user-facing port, handles Ganache-compat methods,
// forwards everything else to internal Anvil port.

const http = require('http')
const net = require('net')
const axios = require('axios')
const logger = require('./logger')

class EthsmithProxy {
  constructor(userPort, internalPort, keystore) {
    this.userPort = userPort
    this.internalPort = internalPort
    this.internalUrl = `http://127.0.0.1:${internalPort}`
    this.keystore = keystore
    this.server = null
  }

  // ── Forward to Anvil ─────────────────────────────────────────────────────

  async forward(method, params = []) {
    const res = await axios.post(this.internalUrl, {
      jsonrpc: '2.0', id: Date.now(), method, params
    }, { timeout: 30000 })
    return res.data
  }

  // ── Handle one JSON-RPC request ───────────────────────────────────────────

  async handleRequest(req) {
    const { jsonrpc = '2.0', id, method, params = [] } = req
    try {
      const result = await this._dispatch(method, params)
      return { jsonrpc, id, result }
    } catch (e) {
      const err = typeof e.code === 'number'
        ? { code: e.code, message: e.message }
        : { code: -32603, message: e.message || 'Internal error' }
      return { jsonrpc, id, error: err }
    }
  }

  async _dispatch(method, params) {
    // ── net_* — fill gaps Anvil doesn't implement ───────────────────────────
    if (method === 'net_peerCount') return '0x0'  // local dev node, no peers

    // ── miner_* → Anvil equivalents ─────────────────────────────────────────
    if (method === 'miner_start') {
      const r = await this.forward('evm_setAutomine', [true])
      return r.result
    }
    if (method === 'miner_stop') {
      const r = await this.forward('evm_setAutomine', [false])
      return r.result
    }
    if (method === 'miner_setGasPrice') {
      const r = await this.forward('anvil_setMinGasPrice', params)
      return r.result
    }

    // ── personal_* ──────────────────────────────────────────────────────────
    if (method === 'personal_listAccounts') {
      return this.keystore.list()
    }
    if (method === 'personal_importRawKey') {
      const rawKey = params[0]
      const { ethers } = require('ethers')
      const wallet = new ethers.Wallet(rawKey)
      return this.keystore.addAccount(wallet.address, rawKey)
    }
    if (method === 'personal_unlockAccount') {
      return this.keystore.unlock(params[0])
    }
    if (method === 'personal_lockAccount') {
      this.keystore.lock(params[0])
      return true
    }
    if (method === 'personal_sendTransaction') {
      return this.keystore.sendTransaction(params[0], this.internalUrl)
    }
    if (method === 'personal_sign') {
      return this.keystore.signMessage(params[1], params[0])
    }
    if (method === 'eth_sign') {
      return this.keystore.signMessage(params[0], params[1])
    }
    if (method === 'eth_signTypedData_v4') {
      const [address, rawData] = params
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
      const pk = this.keystore.getPrivateKey(address)
      if (pk) {
        return this.keystore.signTypedData(address, data.domain, data.types, data.message)
      }
      // fall through to Anvil if we don't have the key
    }

    // ── Forward everything else ──────────────────────────────────────────────
    const r = await this.forward(method, params)
    if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code })
    return r.result
  }

  // ── HTTP server ──────────────────────────────────────────────────────────

  start() {
    this.server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
      if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return }

      let body = ''
      let bodySize = 0
      const MAX_BODY = 10 * 1024 * 1024  // 10 MB
      req.on('data', c => {
        bodySize += c.length
        if (bodySize > MAX_BODY) {
          req.destroy()
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Request too large' } }))
          return
        }
        body += c
      })
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body)
          let response
          if (Array.isArray(parsed)) {
            response = await Promise.all(parsed.map(r => this.handleRequest(r)))
          } else {
            response = await this.handleRequest(parsed)
          }
          const json = JSON.stringify(response)
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) })
          res.end(json)
        } catch (e) {
          const err = JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(err)
        }
      })
    })

    // WebSocket proxy: forward upgrade requests directly to Anvil via raw TCP
    this.server.on('upgrade', (req, socket, head) => {
      const target = net.connect(this.internalPort, '127.0.0.1', () => {
        let headers = `${req.method} ${req.url || '/'} HTTP/${req.httpVersion}\r\n`
        headers += `host: 127.0.0.1:${this.internalPort}\r\n`
        for (const [k, v] of Object.entries(req.headers)) {
          if (k.toLowerCase() !== 'host') headers += `${k}: ${v}\r\n`
        }
        headers += '\r\n'
        target.write(headers)
        if (head && head.length) target.write(head)
        socket.pipe(target)
        target.pipe(socket)
      })
      const cleanup = () => { try { socket.destroy() } catch {} try { target.destroy() } catch {} }
      socket.on('error', cleanup)
      target.on('error', cleanup)
      socket.on('close', cleanup)
      target.on('close', cleanup)
    })

    return new Promise((resolve, reject) => {
      this.server.listen(this.userPort, '0.0.0.0', () => {
        logger.info('RPC proxy ready', { port: this.userPort, internal: this.internalPort })
        resolve()
      })
      this.server.on('error', reject)
    })
  }

  stop() {
    return new Promise(resolve => {
      if (this.server) this.server.close(resolve)
      else resolve()
    })
  }
}

module.exports = { EthsmithProxy }
