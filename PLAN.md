# ethsmith — Full Project Plan

> Unified Ethereum dev toolkit: Ganache API + all 4 Foundry tools (Forge, Cast, Anvil, Chisel)
> Written: 2026-06-06 | Session 1 completed: 2026-06-06

---

## Concept

A single npm package that wraps ALL of Foundry's tools (Forge + Cast + Anvil + Chisel)
behind familiar Ganache-compatible commands — with LevelDB persistence instead of Anvil's
heavy JSON state files.

```bash
npm install -g ethsmith

ethsmith                    # start local node (Ganache commands, Anvil engine)
ethsmith compile            # forge build
ethsmith test               # forge test
ethsmith deploy             # forge create
ethsmith call <addr> <fn>   # cast call
ethsmith send <addr> <fn>   # cast send
ethsmith balance <addr>     # cast balance
ethsmith repl               # chisel (Solidity REPL)
```

---

## Package Name

**`ethsmith`** — available on npm ✅
- Communicates: familiar Ganache API + reborn with Foundry power
- Alternative if needed: `ganache-forge`, `ethdev-suite`

---

## Key Design Decisions

### 1. Binaries — use foundry-js
`foundry-js` (v1.0.128) already publishes all 4 Foundry binaries to npm:
- `forge`, `cast`, `anvil`, `chisel` for darwin_amd64/arm64, linux_amd64/arm64
- We depend on `foundry-js` OR copy their download approach
- Binary path: auto-detected per platform at runtime

### 2. Database — LevelDB NOT Anvil JSON files
**Problem:** Anvil saves state as giant JSON files (100MB+ for forked chains)
**Ganache's approach:** LevelDB — compact, indexed, fast key-value store

**Our solution:**
- Use `level` npm package (LevelDB bindings for Node.js)
- On startup: load state from LevelDB → feed into Anvil via `anvil_loadState` RPC
- Periodically + on shutdown: call `anvil_dumpState` RPC → compress → store in LevelDB
- Result: same compact storage as Ganache, Anvil engine

```
~/.ethsmith/db/<chainId>/  ← LevelDB database per chain
~/.ethsmith/config.json    ← global config
```

### 3. Ganache CLI Compatibility Layer
Full mapping of Ganache flags → Anvil flags:

| Ganache | Anvil | Notes |
|---------|-------|-------|
| `--port` | `--port` | same |
| `--accounts` | `--accounts` | same |
| `--mnemonic` | `--mnemonic` | same |
| `--fork` | `--fork-url` | different flag |
| `--fork.blockNumber` | `--fork-block-number` | different |
| `--networkId` | `--chain-id` | different name |
| `--gasLimit` | `--gas-limit` | different case |
| `--gasPrice` | `--gas-price` | different case |
| `--deterministic` | `--mnemonic "test test..."` | different |
| `--db` | ← LevelDB (our layer) | ethsmith handles |
| `--block-time` | `--block-time` | same |
| `--unlock` | `--impersonate` | different |
| `--secure` | `--no-mining` | conceptually similar |

### 4. Programmatic API (same as old Ganache)
```js
const ganache = require('ethsmith')

// Start a provider (for use in hardhat/truffle/ethers tests)
const provider = await ganache.provider({
  chain: { chainId: 1337 },
  mnemonic: 'test test test...',
  fork: { url: 'https://mainnet.infura.io/v3/...' }
})

// Start a full server
const server = ganache.server({ port: 8545 })
await server.listen(8545)
```

---

## Architecture

```
ethsmith/
├── bin/
│   └── ethsmith.js       ← CLI entry point
├── src/
│   ├── cli/
│   │   ├── index.js            ← command router
│   │   ├── node.js             ← ganache node command (→ anvil)
│   │   ├── compile.js          ← compile command (→ forge build)
│   │   ├── test.js             ← test command (→ forge test)
│   │   ├── deploy.js           ← deploy command (→ forge create)
│   │   ├── call.js             ← call command (→ cast call)
│   │   ├── send.js             ← send command (→ cast send)
│   │   ├── balance.js          ← balance command (→ cast balance)
│   │   ├── block.js            ← block command (→ cast block)
│   │   ├── logs.js             ← logs command (→ cast logs)
│   │   ├── decode.js           ← decode command (→ cast decode)
│   │   ├── fuzz.js             ← fuzz command (→ forge test --fuzz)
│   │   ├── repl.js             ← repl command (→ chisel)
│   │   └── ...
│   ├── core/
│   │   ├── binary.js           ← finds/downloads foundry binaries
│   │   ├── db.js               ← LevelDB persistence layer
│   │   ├── flags.js            ← Ganache → Anvil flag mapper
│   │   ├── provider.js         ← programmatic provider API
│   │   └── server.js           ← programmatic server API
│   └── index.js                ← public API (ganache.provider, ganache.server)
├── package.json
└── README.md
```

---

## Commands — Full List

### Node (Anvil engine, Ganache API)
```bash
ethsmith                          # start node, port 8545
ethsmith --port 8546
ethsmith --accounts 20
ethsmith --fork https://...       # fork mainnet
ethsmith --fork.blockNumber 20000000
ethsmith --mnemonic "word word..."
ethsmith --networkId 1337
ethsmith --gasLimit 12000000
ethsmith --block-time 2
ethsmith --db ./mydb              # use custom LevelDB path
ethsmith --deterministic          # always same accounts
```

### Forge Commands (via ethsmith)
```bash
ethsmith compile                  # forge build
ethsmith compile --optimize       # forge build --optimize
ethsmith test                     # forge test
ethsmith test --watch             # forge test --watch
ethsmith test --gas-report        # forge test --gas-report
ethsmith fuzz                     # forge test --fuzz-runs 10000
ethsmith coverage                 # forge coverage
ethsmith deploy <contract>        # forge create
ethsmith deploy --verify          # forge create --verify
ethsmith flatten <file>           # forge flatten
ethsmith inspect <contract>       # forge inspect
ethsmith doc                      # forge doc
ethsmith fmt                      # forge fmt
ethsmith snapshot                 # forge snapshot
```

### Cast Commands (via ethsmith)
```bash
ethsmith call <addr> <fn> [args]     # cast call
ethsmith send <addr> <fn> [args]     # cast send
ethsmith balance <addr>              # cast balance
ethsmith block [number]              # cast block
ethsmith logs <addr>                 # cast logs
ethsmith decode <calldata>           # cast decode
ethsmith estimate <addr> <fn>        # cast estimate
ethsmith sig <fn>                    # cast sig
ethsmith abi-encode <fn> [args]      # cast abi-encode
ethsmith abi-decode <fn> <data>      # cast abi-decode
ethsmith tx <hash>                   # cast tx
ethsmith receipt <hash>              # cast receipt
ethsmith chain-id                    # cast chain-id
ethsmith gas-price                   # cast gas-price
ethsmith nonce <addr>                # cast nonce
ethsmith storage <addr> <slot>       # cast storage
ethsmith code <addr>                 # cast code
ethsmith wallet new                  # cast wallet new
ethsmith wallet import               # cast wallet import
ethsmith trace <hash>                # cast run (trace tx)
ethsmith erc20 transfer <token>...   # cast erc20 transfer
```

### Chisel (Solidity REPL)
```bash
ethsmith repl                     # launch chisel REPL
ethsmith chisel                   # alias
```

---

## DB Layer Design (LevelDB)

```js
// db.js — stores Anvil state compactly in LevelDB

const { Level } = require('level')

class GanacheDB {
  constructor(dbPath) {
    this.db = new Level(dbPath, { valueEncoding: 'buffer' })
  }

  // Save Anvil state snapshot (called via anvil_dumpState RPC)
  async saveState(chainId, state) {
    const compressed = zlib.gzipSync(Buffer.from(state, 'hex'))
    await this.db.put(`state:${chainId}:latest`, compressed)
    await this.db.put(`state:${chainId}:${Date.now()}`, compressed)
  }

  // Load state to feed into new Anvil process (anvil_loadState RPC)
  async loadState(chainId) {
    const compressed = await this.db.get(`state:${chainId}:latest`)
    return zlib.gunzipSync(compressed).toString('hex')
  }

  // Store accounts, blocks, txs for fast lookup
  async saveBlock(chainId, blockNumber, blockData) { ... }
  async getBlock(chainId, blockNumber) { ... }
  async saveTx(chainId, txHash, txData) { ... }
  async getTx(chainId, txHash) { ... }
}
```

---

## Build Sessions Plan

### Session 1 — Foundation ✅ DONE 2026-06-06
- [x] Init npm package (Node >=20, ethsmith, all deps)
- [x] Binary manager: auto-detect system Foundry OR download
- [x] Logger (winston + daily rotate, JSON + human-readable console)
- [x] CLI router (Commander.js, 30+ subcommands)
- [x] `ethsmith` bare command → spawn Anvil with mapped Ganache flags
- [x] LevelDB layer (db.js): saveState/loadState with gzip, blocks, txs, integrity check
- [x] EthsmithNode class: start/stop, 30s checkpoint timer, state restore on startup
- [x] Forge wrapper: compile, test, fuzz, coverage, deploy, flatten, inspect, fmt, snapshot
- [x] Cast wrapper: all cast subcommands
- [x] Chisel wrapper: REPL, sessions
- [x] Programmatic API: provider(), server(), EthsmithProvider (EIP-1193)
- [x] test/basic.js: 7 flag-mapping unit tests — all PASS
- [x] test/persistence.js: mine → checkpoint → restart → verify state — PASS
- [x] README.md: full documentation

**Verified working:**
- Node starts in < 500ms, RPC ready in < 300ms
- State saves correctly (gzip, LevelDB)
- State restores on restart (block number + balances verified)
- All Ganache flags map correctly to Anvil flags

### Session 2 — Ganache Node compatibility (NEXT)
- [ ] `personal_*` RPC proxy (importRawKey, listAccounts, unlockAccount, lockAccount, sendTransaction)
- [ ] `miner_start` / `miner_stop` / `miner_setGasPrice` proxy
- [ ] `eth_signTypedData_v4` pass-through
- [ ] Console.log Solidity forwarding (parse Anvil stdout for console.log events)
- [ ] `fork.provider` — fork from in-memory EIP-1193 provider
- [ ] Config file: `~/.ethsmith/config.json` (load defaults on startup)
- [ ] `unlockedAccounts` by index in programmatic API
- [ ] `timestampIncrement` control
- [ ] Custom accounts with `{ balance, secretKey }` in programmatic API
- [ ] Test: old Ganache scripts work as drop-in

### Session 3 — Tests + Highload + Crash Recovery
- [ ] Highload test: 10,000 blocks, measure time + memory
- [ ] Highload tx test: 10,000 transactions, verify all receipts
- [ ] SIGKILL crash recovery test: verify LevelDB not corrupted
- [ ] Multi-instance test: 3 nodes simultaneously
- [ ] Fork test: fork mainnet, read real state, deploy on top
- [ ] All anvil_* RPC methods tested

### Session 4 — Docker
- [ ] Dockerfile (multi-stage, < 200 MB image)
- [ ] docker-compose.yml for multi-instance example
- [ ] Docker volume for LevelDB persistence
- [ ] Environment variable support (ETHSMITH_PORT, ETHSMITH_CHAIN_ID, etc.)
- [ ] Push to Docker Hub: lord1egypt/ethsmith:latest + lord1egypt/ethsmith:1.0.0

### Session 5 — GitHub + npm Publish
- [ ] GitHub repo: Lord1Egypt/ethsmith
- [ ] GitHub Actions: CI on push (run tests)
- [ ] GitHub Actions: publish to npm on release tag
- [ ] npm publish: ethsmith v1.0.0
- [ ] Docker Hub page with description

---

## Tech Stack

```json
{
  "dependencies": {
    "level": "^8.0.0",          ← LevelDB
    "commander": "^12.0.0",     ← CLI framework
    "axios": "^1.6.0",          ← binary downloads
    "tar": "^7.0.0",            ← extract foundry binaries
    "ethers": "^6.0.0"          ← programmatic provider
  }
}
```

---

## Notes

- `foundry-js` npm package already distributes all 4 binaries — check if we can depend on it directly
- Anvil's `anvil_dumpState` / `anvil_loadState` RPC methods are the bridge between Anvil and our LevelDB
- State is compressed with gzip before storing → much smaller than raw JSON
- One LevelDB per `chainId` → separate databases for mainnet fork, local, etc.
- GitHub repo: `Lord1Egypt/ethsmith`
- PyPI: no Python package for this one — npm only

---

## What to MERGE (decided 2026-06-06)

### FROM GANACHE — keep these unique advantages
- LevelDB structured DB (blocks, txs, receipts, storageKeys, trie — separate sub-DBs)
- `fork.provider` — fork from EIP-1193 provider object in memory (not just URL)
- `fork.network` shorthand — just say "mainnet" or "sepolia"
- Custom accounts with private keys `{ balance, secretKey }` in programmatic API
- `timestampIncrement` — control time between blocks
- `personal_*` RPC namespace (MetaMask compatibility)
- `miner_start` / `miner_stop` RPC (explicit mining control)
- In-memory `ganache.provider()` — no ports, pure in-memory for unit tests
- `eth_signTypedData_v4` — MetaMask-style EIP-712 signing
- Console.log forwarding from Solidity
- EIP-1193 compliant JS provider
- `unlockedAccounts` — unlock by address OR index at startup
- Backward-compat CLI flags (all old Ganache v1/v2 flags work)

### FROM ANVIL — keep these unique advantages
- Rust EVM (100x faster than Ganache JS EVM)
- Modern hardforks: Prague, Cancun, Shanghai
- All 32 `anvil_*` special RPC methods (setStorage, setCode, setNonce, setChainId, reorg, rollback, deal_erc20, impersonate_signature, auto_impersonate...)
- `debug_*` namespace (full step-by-step EVM traces)
- `trace_*` namespace (Parity-style tracing)
- `txpool_*` namespace (mempool inspection)
- IPC support (Unix socket)
- Genesis file (`--init genesis.json`)
- `--prune-history` / `--max-persisted-states`
- `--fund-accounts address:amount`
- `--max-transactions` per block
- Optimism/L2 support
- Transaction ordering (fees vs fifo)
- Multi-host binding

### FROM FORGE
- Fast Solidity compilation
- Property-based fuzzing (built-in)
- Gas snapshots
- Coverage reports
- Contract verification (Etherscan)
- Flatten, inspect, ABI, Soldeer, mutation testing

### FROM CAST
- Full on-chain interaction CLI
- ABI encode/decode, CREATE2, ERC20 helpers
- TX replay/tracing, batch send, wallet keystore, raw RPC

### FROM CHISEL
- Interactive Solidity REPL with sessions + variable inspection

### DROP
- Ganache JS EVM (use Anvil Rust EVM instead)
- Ganache JSON state files (use LevelDB)
- `bzz_*` RPC methods (Swarm is dead)
- Anvil raw `--dump-state` JSON (replace with our LevelDB layer)

---

*Ready to build — start with Session 1*
