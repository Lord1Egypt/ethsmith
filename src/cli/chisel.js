const { spawn } = require('child_process')
const { bin } = require('../core/binary')
const logger = require('../core/logger')

function runChisel(args = []) {
  return new Promise((resolve, reject) => {
    const chiselBin = bin('chisel')
    logger.info('Starting Chisel Solidity REPL')
    const proc = spawn(chiselBin, args, {
      stdio: 'inherit',  // interactive — keep stdin/stdout/stderr
      env: { ...process.env }
    })
    proc.on('exit', (code) => {
      if (code === 0 || code === null) resolve(code)
      else reject(new Error(`chisel exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

const commands = {
  repl: (args) => runChisel(args),
  list: (args) => runChisel(['list', ...args]),
  load: (args) => runChisel(['load', ...args]),
  view: (args) => runChisel(['view', ...args]),
  clear: (args) => runChisel(['clear-cache'])
}

module.exports = { commands, runChisel }
