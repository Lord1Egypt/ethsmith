const { spawn } = require('child_process')
const { bin } = require('../core/binary')
const logger = require('../core/logger')

function runCast(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const castBin = bin('cast')
    logger.debug('Running cast', { args })
    const proc = spawn(castBin, args, {
      stdio: 'inherit',
      cwd: opts.cwd || process.cwd(),
      env: { ...process.env }
    })
    proc.on('exit', (code) => {
      if (code === 0) resolve(code)
      else reject(new Error(`cast exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

const commands = {
  call: (args) => runCast(['call', ...args]),
  send: (args) => runCast(['send', ...args]),
  balance: (args) => runCast(['balance', ...args]),
  block: (args) => runCast(['block', ...args]),
  tx: (args) => runCast(['tx', ...args]),
  receipt: (args) => runCast(['receipt', ...args]),
  logs: (args) => runCast(['logs', ...args]),
  decode: (args) => runCast(['decode-calldata', ...args]),
  'abi-encode': (args) => runCast(['abi-encode', ...args]),
  'abi-decode': (args) => runCast(['abi-decode', ...args]),
  estimate: (args) => runCast(['estimate', ...args]),
  sig: (args) => runCast(['sig', ...args]),
  nonce: (args) => runCast(['nonce', ...args]),
  'chain-id': (args) => runCast(['chain-id', ...args]),
  'gas-price': (args) => runCast(['gas-price', ...args]),
  storage: (args) => runCast(['storage', ...args]),
  code: (args) => runCast(['code', ...args]),
  trace: (args) => runCast(['run', ...args]),       // cast run replays tx
  wallet: (args) => runCast(['wallet', ...args]),
  erc20: (args) => runCast(['call', ...args]),       // sugar: erc20 transfer etc
  create2: (args) => runCast(['create2', ...args]),
  'batch-send': (args) => runCast(['send', '--async', ...args]),
  rpc: (args) => runCast(['rpc', ...args]),
  keccak: (args) => runCast(['keccak', ...args]),
  'to-hex': (args) => runCast(['to-hex', ...args]),
  'to-dec': (args) => runCast(['to-dec', ...args]),
  'from-utf8': (args) => runCast(['from-utf8', ...args]),
  'to-utf8': (args) => runCast(['to-utf8', ...args]),
  interface: (args) => runCast(['interface', ...args]),
  'upload-signature': (args) => runCast(['upload-signature', ...args]),
  'find-block': (args) => runCast(['find-block', ...args])
}

module.exports = { commands, runCast }
