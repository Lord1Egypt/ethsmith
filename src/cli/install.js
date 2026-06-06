const { ensureFoundry, TOOLS, BIN_DIR } = require('../core/binary')
const logger = require('../core/logger')

async function runInstall() {
  console.log('ethsmith — installing Foundry tools (forge, cast, anvil, chisel)...\n')
  try {
    await ensureFoundry()
    console.log(`\nFoundry tools installed to: ${BIN_DIR}`)
    console.log('Tools: ' + TOOLS.join(', '))
    console.log('\nAll done. Run `ethsmith` to start a local node.')
  } catch (e) {
    logger.error('Install failed', { error: e.message })
    console.error('\nInstall failed:', e.message)
    console.error('\nManual install: curl -L https://foundry.paradigm.xyz | bash && foundryup')
    process.exit(1)
  }
}

module.exports = { runInstall }
