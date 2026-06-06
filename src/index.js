// Programmatic API — drop-in replacement for old ganache package
// Usage:
//   const ethsmith = require('ethsmith')
//   const provider = await ethsmith.provider({ port: 8545, fork: { url: 'https://...' } })
//   const server = ethsmith.server({ port: 8545 })
//   await server.listen(8545)

const { EthsmithNode } = require('./cli/node')
const { ensureFoundry } = require('./core/binary')

let _initialized = false

async function _init() {
  if (_initialized) return
  await ensureFoundry()
  _initialized = true
}

/**
 * Create an in-memory provider (no HTTP port opened).
 * Compatible with ethers.js, web3.js, hardhat, truffle.
 *
 * @param {object} opts - Ganache-compatible options
 * @returns {object} EIP-1193 provider
 */
async function provider(opts = {}) {
  await _init()
  // For in-memory mode: start anvil on a random high port, return a proxy provider
  const port = opts.port || (10000 + Math.floor(Math.random() * 50000))
  const node = new EthsmithNode({ ...opts, port })
  await node.start()
  return new EthsmithProvider(node, port)
}

/**
 * Create a JSON-RPC server.
 * @param {object} opts - Ganache-compatible options
 * @returns {{ listen(port): Promise<void>, close(): Promise<void>, provider: EthsmithProvider }}
 */
function server(opts = {}) {
  let node = null

  return {
    async listen(port) {
      await _init()
      node = new EthsmithNode({ ...opts, port })
      await node.start()
      this.provider = new EthsmithProvider(node, port)
    },
    async close() {
      if (node) await node.stop()
    }
  }
}

class EthsmithProvider {
  constructor(node, port) {
    this._node = node
    this._port = port
    this._url = `http://127.0.0.1:${port}`
    this.isMetaMask = false
  }

  // EIP-1193 request
  async request({ method, params = [] }) {
    const axios = require('axios')
    const res = await axios.post(this._url, {
      jsonrpc: '2.0', id: Date.now(), method, params
    })
    if (res.data.error) {
      const err = new Error(res.data.error.message)
      err.code = res.data.error.code
      throw err
    }
    return res.data.result
  }

  // Legacy send (web3 v1 compat)
  send(payload, callback) {
    const axios = require('axios')
    axios.post(this._url, payload)
      .then(res => callback(null, res.data))
      .catch(err => callback(err))
  }

  // Legacy sendAsync
  sendAsync(payload, callback) {
    this.send(payload, callback)
  }

  async disconnect() {
    await this._node.stop()
  }
}

module.exports = { provider, server, EthsmithProvider, EthsmithNode }
