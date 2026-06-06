# ethsmith

> **The unified Ethereum development toolkit** — Ganache-compatible API, powered by Foundry's Forge + Cast + Anvil + Chisel, with LevelDB persistence.

[![npm version](https://img.shields.io/npm/v/ethsmith)](https://www.npmjs.com/package/ethsmith)
[![CI](https://github.com/Lord1Egypt/ethsmith/actions/workflows/ci.yml/badge.svg)](https://github.com/Lord1Egypt/ethsmith/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/docker/v/lord1egypt/ethsmith?label=docker)](https://hub.docker.com/r/lord1egypt/ethsmith)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Why ethsmith?

| Problem | Solution |
|---------|----------|
| **Ganache is dead** (archived, no updates) | ethsmith speaks Ganache's CLI and API — drop-in replacement |
| **Anvil is fast** but uses a different CLI | All your old `ganache-cli` flags work unchanged |
| **Anvil dumps state as giant JSON** (100MB+ for forked chains) | ethsmith uses **LevelDB** — compact, indexed, < 10 MB |
| **Four separate Foundry tools** (forge, cast, anvil, chisel) | One command: `ethsmith compile`, `ethsmith test`, `ethsmith call`... |
| **Ganache's JS EVM** was slow | Anvil's Rust EVM is 100× faster |
| **No Ganache in CI** after v7 | `npm install -g ethsmith` — works everywhere Node 20+ runs |

---

## Install

```bash
npm install -g ethsmith
```

On first run, ethsmith auto-detects your system Foundry installation.  
If Foundry is not installed, run:

```bash
ethsmith install
```

> Requires **Node.js >= 20**. Foundry 1.6+ recommended.

---

## Quick Start

```bash
# Start a local Ethereum node (port 8545, 10 accounts, 1000 ETH each)
ethsmith

# Same but with Ganache options — they all work
ethsmith --port 8545 --accounts 20 --deterministic --chain-id 1337

# Fork mainnet at latest block
ethsmith --fork https://eth.llamarpc.com

# Fork mainnet by name (built-in RPC endpoints)
ethsmith --fork.network mainnet

# Fork at specific block
ethsmith --fork https://eth.llamarpc.com@20000000

# Use LevelDB at custom path (state persists across restarts)
ethsmith --db ./mychain

# Start with block-time 2s (mine every 2 seconds)
ethsmith --block-time 2
```

---

## All Commands

### Node (Ethereum local node)

```bash
ethsmith [node] [options]
```

This is the default command — just run `ethsmith` with any options.

#### Node Options

| Flag | Ganache Alias | Description | Default |
|------|---------------|-------------|---------|
| `--port <n>` | `-p` | HTTP + WebSocket RPC port | `8545` |
| `--accounts <n>` | `-a` | Number of accounts to generate | `10` |
| `--mnemonic <phrase>` | `-m` | BIP39 mnemonic for accounts | random |
| `--deterministic` | `-d` | Use standard test mnemonic (same accounts always) | false |
| `--chain-id <id>` | `--networkId` | Chain ID (Ganache: --networkId) | `1337` |
| `--gas-limit <n>` | `--gasLimit` | Block gas limit | `30000000` |
| `--gas-price <wei>` | `--gasPrice` | Minimum gas price | `1000000000` |
| `--balance <eth>` | `--defaultBalanceEther` | Initial ETH per account | `1000` |
| `--block-time <s>` | | Auto-mine interval (0 = instamine) | `0` |
| `--no-mining` | | Disable auto-mining | false |
| `--fork <url>` | | Fork from URL (`url@blockNumber` supported) | — |
| `--fork.url <url>` | | Fork URL (Ganache compat) | — |
| `--fork.blockNumber <n>` | | Fork at specific block | latest |
| `--fork.network <name>` | | Fork by name: `mainnet` `sepolia` `arbitrum` `optimism` `base` `polygon` | — |
| `--hardfork <name>` | | EVM hardfork: `london` `paris` `shanghai` `cancun` `prague` | `cancun` |
| `--unlock <addr>` | `--impersonate` | Unlock/impersonate address (repeatable) | — |
| `--db <path>` | | LevelDB directory (state persists) | `~/.ethsmith/db/<chainId>` |
| `--state-interval <s>` | | Checkpoint to LevelDB every N seconds | `30` |
| `--ipc [path]` | | Enable IPC socket | disabled |
| `--optimism` | | Enable Optimism L2 mode | false |
| `--init <file>` | | Genesis JSON file | — |
| `--fund-accounts <addr:eth>` | | Fund address on startup (repeatable) | — |
| `--prune-history` | | Prune old block history | false |
| `--order <type>` | | TX ordering: `fees` or `fifo` | `fees` |
| `--log-level <level>` | | `debug` `info` `warn` `error` | `info` |
| `--log-file <path>` | | Log file path | `~/.ethsmith/logs/` |

---

### Compile (Forge Build)

```bash
ethsmith compile                    # forge build
ethsmith compile --optimize         # enable optimizer
ethsmith compile --via-ir           # use IR pipeline
ethsmith compile --sizes            # show contract sizes
```

### Test (Forge Test)

```bash
ethsmith test                       # forge test
ethsmith test --watch               # watch for file changes
ethsmith test --gas-report          # show gas usage table
ethsmith test --match-test "testFoo" # run specific test
ethsmith test -vvvv                 # max verbosity
```

### Fuzz (Property-Based Testing)

```bash
ethsmith fuzz                       # forge test --fuzz-runs 10000
ethsmith fuzz --fuzz-runs 100000    # more runs
ethsmith fuzz --match-test "testFuzz_"
```

### Coverage

```bash
ethsmith coverage                   # forge coverage
ethsmith coverage --report lcov     # LCOV format for CI
```

### Deploy

```bash
ethsmith deploy src/Token.sol:Token \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974be...

# With verification
ethsmith deploy src/Token.sol:Token \
  --rpc-url https://mainnet.infura.io/v3/KEY \
  --private-key $PRIVATE_KEY \
  --verify
  --etherscan-api-key $ETHERSCAN_KEY
```

### Flatten / Inspect / Format

```bash
ethsmith flatten src/Token.sol      # forge flatten (for Etherscan)
ethsmith inspect src/Token.sol:Token abi
ethsmith inspect src/Token.sol:Token bytecode
ethsmith fmt                        # format all Solidity files
ethsmith snapshot                   # gas snapshot (forge snapshot)
```

---

### Cast Commands (On-chain Interaction)

```bash
# Read calls
ethsmith call 0xTokenAddr "balanceOf(address)" 0xMyAddr
ethsmith balance 0xMyAddr
ethsmith block latest
ethsmith block 19000000 --rpc-url https://eth.llamarpc.com
ethsmith tx 0xTxHash
ethsmith receipt 0xTxHash
ethsmith logs 0xContractAddr
ethsmith storage 0xContractAddr 0x0    # read storage slot
ethsmith code 0xContractAddr           # get bytecode
ethsmith nonce 0xAddr
ethsmith chain-id
ethsmith gas-price

# Write transactions
ethsmith send 0xTokenAddr "transfer(address,uint256)" 0xRecipient 1000000000000000000 \
  --private-key 0xac0974be...

# ABI encoding/decoding
ethsmith abi-encode "transfer(address,uint256)" 0xABC 1000
ethsmith abi-decode "transfer(address,uint256)" 0xa9059cbb...
ethsmith decode "transfer(address,uint256)" 0xa9059cbb...  # decode calldata
ethsmith sig "transfer(address,uint256)"     # → 0xa9059cbb
ethsmith keccak "Transfer(address,address,uint256)"

# Wallet
ethsmith wallet new                  # generate new wallet
ethsmith wallet import               # import from private key

# ERC20 helpers
ethsmith erc20 transfer 0xToken 0xRecipient 1ether

# CREATE2
ethsmith create2 --init-code 0x60... --salt 0x1234...

# Transaction tracing (replay + full EVM trace)
ethsmith trace 0xTxHash --rpc-url https://eth.llamarpc.com

# Utilities
ethsmith to-hex 255                  # → 0xff
ethsmith to-dec 0xff                 # → 255
ethsmith from-utf8 "hello"
ethsmith estimate 0xAddr "foo()"     # gas estimate
ethsmith rpc eth_blockNumber         # raw JSON-RPC
```

---

### Chisel — Solidity REPL

```bash
ethsmith repl               # launch interactive Solidity REPL
# or
ethsmith chisel
```

Inside the REPL:
```solidity
> uint256 x = 42;
> x * 2
Type: uint256
└ Data: 84

> address(0).balance
Type: uint256
└ Data: 0

> !inspect x        // show type + value
> !save mysession   // save session to disk
> !load mysession   // load session
> !quit             // exit
```

---

## State Persistence (LevelDB)

ethsmith automatically saves your blockchain state to LevelDB every 30 seconds and on graceful shutdown. On restart, state is restored exactly where you left off.

```bash
# State is stored at:
~/.ethsmith/db/<chainId>/

# Custom location
ethsmith --db ./my-project-chain

# Adjust checkpoint interval (seconds)
ethsmith --state-interval 10

# Multiple independent chains
ethsmith --chain-id 1337 --db ./chainA &
ethsmith --port 8546 --chain-id 1338 --db ./chainB &
```

**Why LevelDB instead of Anvil's JSON files?**

| Format | Size (forked mainnet) | Format | Indexed |
|--------|-----------------------|--------|---------|
| Anvil JSON | 100 MB+ | Plain text | No |
| ethsmith LevelDB | ~8 MB | Binary + gzip | Yes |

---

## Fork Mode

```bash
# Fork mainnet at latest block
ethsmith --fork https://eth.llamarpc.com

# Fork at specific block (reproducible)
ethsmith --fork https://eth.llamarpc.com@20000000

# Fork by network name (built-in endpoints)
ethsmith --fork.network mainnet
ethsmith --fork.network sepolia
ethsmith --fork.network arbitrum
ethsmith --fork.network optimism
ethsmith --fork.network base
ethsmith --fork.network polygon

# Fork + state persistence (fork cache saved in LevelDB)
ethsmith --fork.network mainnet --db ./mainnet-fork

# Reset fork to original state (RPC)
curl -X POST http://localhost:8545 -d '{"jsonrpc":"2.0","method":"anvil_reset","params":[]}'
```

---

## Anvil Special RPC Methods

All 32 Anvil special methods work out of the box:

```bash
# Storage manipulation
cast rpc anvil_setStorageAt 0xAddr 0x0 0xValue
cast rpc anvil_setCode 0xAddr 0x60...         # replace bytecode
cast rpc anvil_setBalance 0xAddr 0xDE0B...    # set ETH balance
cast rpc anvil_setNonce 0xAddr 0x5             # override nonce
cast rpc anvil_setChainId 31337

# Account impersonation
cast rpc anvil_impersonateAccount 0xWhale
cast rpc anvil_stopImpersonatingAccount 0xWhale
cast rpc anvil_autoImpersonateAccount true    # impersonate any sender

# Block control
cast rpc anvil_mine 100                        # mine 100 blocks instantly
cast rpc anvil_setBlockTimestamp 1700000000
cast rpc anvil_setNextBlockBaseFeePerGas 0

# Snapshot / Revert
cast rpc evm_snapshot                          # → "0x1"
cast rpc evm_revert '["0x1"]'                  # revert to snapshot
cast rpc anvil_reorg '{"depth":2}'             # simulate reorg
cast rpc anvil_rollback '{"blocks":5}'         # roll back 5 blocks

# State dump/load (used internally by LevelDB layer)
cast rpc anvil_dumpState                       # → hex state
cast rpc anvil_loadState '["0x..."]'           # restore state

# Mempool
cast rpc anvil_dropTransaction 0xTxHash
cast rpc anvil_dropAllTransactions

# DeFi helpers
cast rpc anvil_dealErc20 '["0xToken","0xAddr","1000000000000000000"]'
cast rpc anvil_setErc20Allowance '["0xToken","0xOwner","0xSpender","1000"]'
cast rpc anvil_addBalance '["0xAddr","0xDE0B..."]'

# Info
cast rpc anvil_nodeInfo
cast rpc anvil_metadata
```

---

## Ganache Compatibility Methods (personal_*, miner_*)

```bash
# Personal namespace (MetaMask compatibility)
cast rpc personal_listAccounts
cast rpc personal_importRawKey '["0xPrivKey","password"]'
cast rpc personal_unlockAccount '["0xAddr","password",0]'
cast rpc personal_lockAccount '["0xAddr"]'
cast rpc personal_sendTransaction '[{"from":"0x...","to":"0x...","value":"0x1"},"password"]'

# Miner control
cast rpc miner_start              # start auto-mining
cast rpc miner_stop               # stop auto-mining (manual mode)
cast rpc miner_setGasPrice '["0x3B9ACA00"]'

# EIP-712 signing (MetaMask style)
cast rpc eth_signTypedData_v4 '["0xAddr",{"types":{...},"domain":{...},"message":{...}}]'
```

---

## Debug & Trace (Full EVM Tracing)

```bash
# Step-by-step EVM trace
cast rpc debug_traceTransaction '["0xTxHash"]'
cast rpc debug_traceCall '[{"to":"0x...","data":"0x..."},"latest"]'
cast rpc debug_traceBlockByNumber '["latest"]'

# Parity-style trace
cast rpc trace_transaction '["0xTxHash"]'
cast rpc trace_block '["latest"]'
cast rpc trace_filter '[{"fromBlock":"0x1","toBlock":"0x10","toAddress":["0x..."]}]'
cast rpc trace_replayBlockTransactions '["latest",["trace"]]'

# Mempool inspection
cast rpc txpool_content
cast rpc txpool_inspect
cast rpc txpool_status
```

---

## Programmatic API (Node.js)

Drop-in replacement for the old `ganache` npm package:

```js
const ethsmith = require('ethsmith')

// ── In-memory provider (for unit tests — no ports) ──────────────────────────
const provider = await ethsmith.provider({
  chain: { chainId: 1337 },
  mnemonic: 'test test test test test test test test test test test junk',
  wallet: { totalAccounts: 5 }
})

// Use with ethers.js
const { ethers } = require('ethers')
const ethersProvider = new ethers.BrowserProvider(provider)
const signer = await ethersProvider.getSigner()

// ── Server with port ────────────────────────────────────────────────────────
const server = ethsmith.server({
  port: 8545,
  deterministic: true,
  'chain-id': '1337',
  'block-time': '2'
})
await server.listen(8545)
// server.provider is an EIP-1193 provider

// ── Fork mainnet in tests ───────────────────────────────────────────────────
const forkProvider = await ethsmith.provider({
  fork: 'https://eth.llamarpc.com@20000000',
  'chain-id': '1'
})

// ── Stop ────────────────────────────────────────────────────────────────────
await server.close()
await provider.disconnect()
```

---

## Hardhat / Truffle / Foundry Integration

**Hardhat** — use as local node:
```bash
# Terminal 1
ethsmith --port 8545 --deterministic

# Terminal 2
npx hardhat --network localhost test
```

**Hardhat config:**
```js
module.exports = {
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 1337
    }
  }
}
```

**Truffle** — works identically to old Ganache:
```js
module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*'
    }
  }
}
```

**Foundry** — point to ethsmith node:
```bash
ethsmith --port 8545 &
forge test --fork-url http://localhost:8545
cast send 0xAddr "mint(address,uint256)" $ADDR 1000 --rpc-url http://localhost:8545 --private-key 0xac0974be...
```

---

## Logging

All events are logged to `~/.ethsmith/logs/` in JSON format with daily rotation.

```bash
# Set log level
ethsmith --log-level debug

# Custom log file
ethsmith --log-file ./ethsmith.log

# Example log output (JSON):
# {"timestamp":"2026-06-06 03:15:27.000","level":"info","message":"Starting ethsmith node","port":8545,"chainId":1337}
# {"timestamp":"...","level":"info","message":"Checkpoint saved","block":150}
# {"timestamp":"...","level":"info","message":"State restored","blockNumber":150}
```

**Log events:**
- Node startup (port, chainId, accounts, mnemonic)
- Every checkpoint (block number, state size, compression ratio)
- State restore on startup (block restored to)
- Fork info (URL, block number, latency)
- DB operations (open, close, integrity)
- All errors with full stack traces

---

## Configuration File

Create `~/.ethsmith/config.json` for persistent defaults:

```json
{
  "port": 8545,
  "accounts": 10,
  "deterministic": true,
  "chainId": 1337,
  "gasLimit": 30000000,
  "balance": 1000,
  "stateInterval": 30,
  "logLevel": "info"
}
```

---

## Multi-Instance

Run multiple independent chains simultaneously:

```bash
# Chain A — local dev
ethsmith --port 8545 --chain-id 1337 --db ~/.ethsmith/dev &

# Chain B — mainnet fork
ethsmith --port 8546 --chain-id 1 --fork.network mainnet --db ~/.ethsmith/fork-mainnet &

# Chain C — sepolia fork
ethsmith --port 8547 --chain-id 11155111 --fork.network sepolia --db ~/.ethsmith/fork-sepolia &
```

Each instance has its own LevelDB directory and process — completely independent.

---

## Docker

```bash
# Run (ephemeral — fresh chain every restart)
docker run -p 8545:8545 lord1egypt/ethsmith:latest

# With persistent state — state survives container restarts
docker run -p 8545:8545 -v ethsmith-data:/root/.ethsmith/db lord1egypt/ethsmith:latest

# With persistent state — bind-mount to local folder
docker run -p 8545:8545 -v $(pwd)/data:/root/.ethsmith/db lord1egypt/ethsmith:latest

# Fork mainnet
docker run -p 8545:8545 lord1egypt/ethsmith:latest node --fork.network mainnet

# Custom chain ID and deterministic accounts
docker run -p 8545:8545 lord1egypt/ethsmith:latest node --deterministic --chain-id 31337
```

> **Volume path:** always mount to `/root/.ethsmith/db` — Foundry binaries live in `/root/.ethsmith/bin`
> inside the image layer and must not be shadowed by the volume.

```yaml
# docker-compose.yml
version: '3.8'
services:
  node-dev:
    image: lord1egypt/ethsmith:latest
    ports: ['8545:8545']
    volumes: ['./data/dev:/root/.ethsmith/db']
    command: node --deterministic --chain-id 1337

  node-fork:
    image: lord1egypt/ethsmith:latest
    ports: ['8546:8545']
    volumes: ['./data/fork:/root/.ethsmith/db']
    command: node --fork.network mainnet

volumes:
  ethsmith-data:
```

---

## CI/CD Pipeline

ethsmith uses a fully automated CI/CD pipeline:

### Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| **CI** (`ci.yml`) | push / PR to `main` | Runs all 6 test suites on Node 20 & 22 with Foundry installed |
| **Release** (`release.yml`) | `git push --tags` with `v*.*.*` | Creates a GitHub Release automatically |
| **Publish** (`publish.yml`) | GitHub Release created | Runs tests → publishes to npm → builds & pushes Docker image |

### How to release a new version

```bash
# 1. Bump version in package.json
npm version patch   # or minor / major

# 2. Push commit + tag
git push && git push --tags
# → GitHub Actions creates the Release automatically
# → Publish workflow fires: npm publish + docker push
```

### Required GitHub Secrets

Go to `Settings → Secrets → Actions` and add:

| Secret | Value |
|--------|-------|
| `NPM_TOKEN` | npm access token (from npmjs.com → Account → Access Tokens) |
| `DOCKER_USERNAME` | `lord1egypt` |
| `DOCKER_PASSWORD` | Docker Hub password or access token |

---

## Architecture

```
ethsmith/
├── bin/
│   └── ethsmith.js          ← CLI entry point (Node >=20 check)
├── src/
│   ├── index.js             ← Public API: provider(), server()
│   ├── core/
│   │   ├── binary.js        ← Foundry binary detection + auto-download
│   │   ├── flags.js         ← Ganache → Anvil flag translation (20+ flags)
│   │   ├── db.js            ← LevelDB: state save/load/restore, integrity
│   │   └── logger.js        ← Winston + daily log rotation
│   └── cli/
│       ├── index.js         ← Commander.js CLI (30+ subcommands)
│       ├── node.js          ← EthsmithNode class (spawns Anvil, manages state)
│       ├── forge.js         ← Forge wrapper (compile/test/deploy/fuzz/coverage...)
│       ├── cast.js          ← Cast wrapper (call/send/balance/trace/abi-*...)
│       ├── chisel.js        ← Chisel REPL wrapper
│       └── install.js       ← Foundry binary installer
```

**State persistence flow:**
```
startup → LevelDB has state? → anvil_loadState RPC → Anvil restores state
running → every 30s → anvil_dumpState RPC → gzip → LevelDB
shutdown → anvil_dumpState RPC → gzip → LevelDB → kill Anvil
```

---

## Comparison

| Feature | Ganache (archived) | plain Anvil | **ethsmith** |
|---------|-------------------|-------------|--------------|
| Active development | ❌ | ✅ | ✅ |
| EVM speed | JS (slow) | Rust (fast) | Rust (fast) |
| Old Ganache CLI flags | ✅ | ❌ | ✅ |
| `personal_*` RPC | ✅ | ❌ | ✅ |
| `miner_start/stop` | ✅ | ❌ | ✅ |
| LevelDB persistence | ✅ | ❌ | ✅ |
| Compact state storage | ✅ | ❌ (big JSON) | ✅ |
| Anvil special methods | ❌ | ✅ | ✅ |
| Modern hardforks | ❌ | ✅ | ✅ |
| `debug_trace*` | ❌ | ✅ | ✅ |
| `trace_*` (Parity) | ❌ | ✅ | ✅ |
| Forge (compile/test) | ❌ | ❌ | ✅ |
| Cast (call/send/abi) | ❌ | ❌ | ✅ |
| Chisel (Solidity REPL) | ❌ | ❌ | ✅ |
| Fork by network name | ✅ | ❌ | ✅ |
| `fork.provider` (in-memory) | ✅ | ❌ | ✅ |
| Optimism L2 support | ❌ | ✅ | ✅ |
| Node.js >= 20 | ❌ | N/A | ✅ |
| Programmatic API | ✅ | ❌ | ✅ |

---

## Tech Stack

| Package | Purpose |
|---------|---------|
| `commander` v12 | CLI framework |
| `level` v8 | LevelDB bindings (Node.js) |
| `winston` v3 | Structured logging |
| `winston-daily-rotate-file` v5 | Log rotation |
| `axios` v1 | HTTP (RPC calls + binary download) |
| `tar` v7 | Extract Foundry binaries |
| `ethers` v6 | Programmatic provider |
| **Foundry** (system) | forge, cast, anvil, chisel binaries |

---

## License

MIT — [Lord1Egypt](https://github.com/Lord1Egypt)

---

## Related Projects

- [skillforge-agent](https://www.npmjs.com/package/skillforge-agent) — 539 AI agent skills (Claude, Gemini, Scientific)
- [awesome-prompt-forge](https://www.npmjs.com/package/awesome-prompt-forge) — 2,592 AI system prompts
- [awesome-ai-system-prompts](https://github.com/Lord1Egypt/awesome-ai-system-prompts) — Curated AI system prompts collection
