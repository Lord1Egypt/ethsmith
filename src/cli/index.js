const { Command } = require('commander')
const pkg = require('../../package.json')

function buildCLI() {
  const program = new Command()

  program
    .name('ethsmith')
    .description('Unified Ethereum dev toolkit — Ganache API + Foundry power + LevelDB persistence')
    .version(pkg.version)

  // ── NODE (default command) ─────────────────────────────────────────────────
  program
    .command('node', { isDefault: true })
    .description('Start a local Ethereum node (Anvil engine, Ganache-compatible CLI)')
    .option('-p, --port <port>', 'RPC port', '8545')
    .option('-a, --accounts <n>', 'number of accounts to generate', '10')
    .option('-m, --mnemonic <phrase>', 'BIP39 mnemonic for account generation')
    .option('-d, --deterministic', 'use standard test mnemonic (same accounts every time)')
    .option('--chain-id <id>', 'chain ID (alias: --networkId)', '1337')
    .option('--networkId <id>', '(Ganache compat) alias for --chain-id')
    .option('--gas-limit <limit>', 'block gas limit')
    .option('--gasLimit <limit>', '(Ganache compat) alias for --gas-limit')
    .option('--gas-price <price>', 'min gas price in wei')
    .option('--gasPrice <price>', '(Ganache compat) alias for --gas-price')
    .option('--balance <eth>', 'initial ETH balance for generated accounts', '1000')
    .option('--fork <url>', 'fork from URL (supports url@blockNumber syntax)')
    .option('--fork.url <url>', 'fork URL (Ganache compat)')
    .option('--fork.blockNumber <n>', 'fork at specific block')
    .option('--fork.network <name>', 'fork by network name: mainnet, sepolia, arbitrum, optimism, base, polygon')
    .option('--block-time <seconds>', 'auto-mine interval in seconds (0 = instamine)')
    .option('--no-mining', 'disable auto mining')
    .option('--unlock <addr>', 'unlock/impersonate address (repeatable)')
    .option('--db <path>', 'custom LevelDB path (default: ~/.ethsmith/db/<chainId>)')
    .option('--state-interval <seconds>', 'LevelDB checkpoint interval in seconds', '30')
    .option('--hardfork <name>', 'hardfork: london, paris, shanghai, cancun, prague')
    .option('--ipc [path]', 'enable IPC (optional path)')
    .option('--optimism', 'enable Optimism/L2 mode')
    .option('--init <genesis>', 'genesis JSON file path')
    .option('--fund-accounts <addr:eth>', 'fund specific address on startup (repeatable)')
    .option('--prune-history', 'prune old block history to save memory')
    .option('--order <type>', 'transaction ordering: fees or fifo')
    .option('--log-level <level>', 'log level: debug, info, warn, error', 'info')
    .option('--log-file <path>', 'custom log file path')
    .action(async (opts) => {
      process.env.ETHSMITH_LOG_LEVEL = opts.logLevel || 'info'
      const { ensureFoundry } = require('../core/binary')
      await ensureFoundry()
      const { runNode } = require('./node')
      await runNode(opts)
    })

  // ── INSTALL ────────────────────────────────────────────────────────────────
  program
    .command('install')
    .description('Download and install Foundry binaries (forge, cast, anvil, chisel)')
    .action(async () => {
      const { runInstall } = require('./install')
      await runInstall()
    })

  // ── FORGE COMMANDS ─────────────────────────────────────────────────────────
  program
    .command('compile [args...]')
    .description('Compile Solidity contracts (forge build)')
    .allowUnknownOption()
    .action(async (args, opts) => {
      const { commands } = require('./forge')
      await commands.compile(args)
    })

  program
    .command('test [args...]')
    .description('Run Solidity tests (forge test)')
    .allowUnknownOption()
    .action(async (args) => {
      const { commands } = require('./forge')
      await commands.test(args)
    })

  program
    .command('fuzz [args...]')
    .description('Run property-based fuzz tests (forge test --fuzz-runs 10000)')
    .allowUnknownOption()
    .action(async (args) => {
      const { commands } = require('./forge')
      await commands.fuzz(args)
    })

  program
    .command('coverage [args...]')
    .description('Generate test coverage report (forge coverage)')
    .allowUnknownOption()
    .action(async (args) => {
      const { commands } = require('./forge')
      await commands.coverage(args)
    })

  program
    .command('deploy [args...]')
    .description('Deploy a contract (forge create)')
    .allowUnknownOption()
    .action(async (args) => {
      const { commands } = require('./forge')
      await commands.deploy(args)
    })

  program
    .command('flatten [args...]')
    .description('Flatten a Solidity file (forge flatten)')
    .allowUnknownOption()
    .action(async (args) => {
      const { commands } = require('./forge')
      await commands.flatten(args)
    })

  program
    .command('inspect [args...]')
    .description('Inspect contract ABI/bytecode (forge inspect)')
    .allowUnknownOption()
    .action(async (args) => {
      const { commands } = require('./forge')
      await commands.inspect(args)
    })

  program
    .command('snapshot [args...]')
    .description('Run gas snapshot (forge snapshot)')
    .allowUnknownOption()
    .action(async (args) => {
      const { commands } = require('./forge')
      await commands.snapshot(args)
    })

  program
    .command('fmt [args...]')
    .description('Format Solidity files (forge fmt)')
    .allowUnknownOption()
    .action(async (args) => {
      const { commands } = require('./forge')
      await commands.fmt(args)
    })

  // ── CAST COMMANDS ──────────────────────────────────────────────────────────
  for (const cmd of [
    ['call <addr> <fn> [args...]', 'Call a contract function (cast call)'],
    ['send <addr> <fn> [args...]', 'Send a transaction (cast send)'],
    ['balance <addr>', 'Get ETH balance (cast balance)'],
    ['block [number]', 'Get block info (cast block)'],
    ['tx <hash>', 'Get transaction (cast tx)'],
    ['receipt <hash>', 'Get receipt (cast receipt)'],
    ['logs <addr>', 'Get event logs (cast logs)'],
    ['decode [args...]', 'Decode calldata (cast decode-calldata)'],
    ['abi-encode <sig> [args...]', 'ABI encode (cast abi-encode)'],
    ['abi-decode <sig> <data>', 'ABI decode (cast abi-decode)'],
    ['estimate <addr> <fn> [args...]', 'Estimate gas (cast estimate)'],
    ['sig <fn>', 'Get function selector (cast sig)'],
    ['nonce <addr>', 'Get nonce (cast nonce)'],
    ['chain-id', 'Get chain ID (cast chain-id)'],
    ['gas-price', 'Get gas price (cast gas-price)'],
    ['storage <addr> <slot>', 'Read storage slot (cast storage)'],
    ['code <addr>', 'Get bytecode (cast code)'],
    ['trace <txhash>', 'Replay and trace transaction (cast run)'],
    ['wallet <subcmd> [args...]', 'Wallet operations (cast wallet)'],
    ['erc20 <subcmd> [args...]', 'ERC20 helpers (cast call/send)'],
    ['create2 [args...]', 'Compute CREATE2 address (cast create2)'],
    ['batch-send [args...]', 'Send multiple transactions'],
    ['rpc <method> [args...]', 'Raw JSON-RPC call (cast rpc)'],
    ['keccak <data>', 'Keccak256 hash (cast keccak)']
  ]) {
    const [usage, description] = cmd
    const name = usage.split(' ')[0]
    program
      .command(usage)
      .description(description)
      .allowUnknownOption()
      .action(async (...allArgs) => {
        const args = allArgs.slice(0, -1).flatMap(a => Array.isArray(a) ? a : [a]).filter(Boolean)
        const { commands } = require('./cast')
        const fn = commands[name]
        if (fn) await fn(args)
        else {
          const { runCast } = require('./cast')
          await runCast([name, ...args])
        }
      })
  }

  // ── DOCTOR ────────────────────────────────────────────────────────────────
  program
    .command('doctor')
    .description('Check ethsmith environment: Node version, Foundry tools, DB path')
    .action(async () => {
      const { resolveBin, TOOLS, BIN_DIR } = require('../core/binary')
      const { spawnSync } = require('child_process')
      const os = require('os')
      const path = require('path')

      const ok  = (s) => `  \x1b[32m✔\x1b[0m  ${s}`
      const err = (s) => `  \x1b[31m✖\x1b[0m  ${s}`
      const warn = (s) => `  \x1b[33m⚠\x1b[0m  ${s}`

      console.log(`\nethsmith doctor — v${pkg.version}\n`)

      // Node version
      const [major] = process.versions.node.split('.').map(Number)
      console.log(major >= 20
        ? ok(`Node.js v${process.versions.node}  (>= 20 required)`)
        : err(`Node.js v${process.versions.node}  — NEED >= 20`)
      )

      // Foundry tools
      let allFound = true
      for (const tool of TOOLS) {
        const p = resolveBin(tool)
        if (p) {
          const r = spawnSync(p, ['--version'], { stdio: 'pipe' })
          const ver = r.stdout ? r.stdout.toString().trim().split('\n')[0] : 'unknown'
          console.log(ok(`${tool.padEnd(7)} ${ver}  (${p})`))
        } else {
          console.log(err(`${tool.padEnd(7)} NOT FOUND`))
          allFound = false
        }
      }

      // DB path
      const dbDir = path.join(os.homedir(), '.ethsmith', 'db')
      const binDir = BIN_DIR
      console.log(ok(`DB path  ${dbDir}`))
      console.log(ok(`Bin dir  ${binDir}`))

      if (!allFound) {
        console.log(`\n  Run \x1b[33methsmith install\x1b[0m to download missing tools.`)
      } else {
        console.log('\n  All systems go!')
      }
      console.log()
    })

  // ── CHISEL ─────────────────────────────────────────────────────────────────
  program
    .command('repl [args...]')
    .description('Launch interactive Solidity REPL (chisel)')
    .allowUnknownOption()
    .action(async (args) => {
      const { commands } = require('./chisel')
      await commands.repl(args)
    })

  program
    .command('chisel [args...]')
    .description('Alias for repl (chisel)')
    .allowUnknownOption()
    .action(async (args) => {
      const { commands } = require('./chisel')
      await commands.repl(args)
    })

  return program
}

module.exports = { buildCLI }
