const { spawn } = require('child_process')
const { bin } = require('../core/binary')
const logger = require('../core/logger')

function runForge(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const forgeBin = bin('forge')
    logger.debug('Running forge', { args })
    const proc = spawn(forgeBin, args, {
      stdio: 'inherit',
      cwd: opts.cwd || process.cwd(),
      env: { ...process.env }
    })
    proc.on('exit', (code) => {
      if (code === 0) resolve(code)
      else reject(new Error(`forge exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

const commands = {
  async compile(args) {
    const forgeArgs = ['build', ...args]
    return runForge(forgeArgs)
  },

  async test(args) {
    return runForge(['test', ...args])
  },

  async fuzz(args) {
    // sensible default: 10000 fuzz runs
    const hasFuzz = args.some(a => a.includes('fuzz-runs'))
    return runForge(['test', '--fuzz-runs', hasFuzz ? '' : '10000', ...args].filter(Boolean))
  },

  async coverage(args) {
    return runForge(['coverage', ...args])
  },

  async deploy(contractArgs, opts = {}) {
    // ethsmith deploy <contract> [--rpc-url url] [--private-key key] [--verify]
    return runForge(['create', ...contractArgs])
  },

  async flatten(args) {
    return runForge(['flatten', ...args])
  },

  async inspect(args) {
    return runForge(['inspect', ...args])
  },

  async snapshot(args) {
    return runForge(['snapshot', ...args])
  },

  async fmt(args) {
    return runForge(['fmt', ...args])
  },

  async doc(args) {
    return runForge(['doc', ...args])
  },

  async soldeer(args) {
    return runForge(['soldeer', ...args])
  }
}

module.exports = { commands, runForge }
