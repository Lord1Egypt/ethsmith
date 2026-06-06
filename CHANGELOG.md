# Changelog

All notable changes to ethsmith are documented here.

## [1.3.3] — 2026-06-06

### Fixed
- **Dockerfile CMD crashed on startup** — `CMD ["node", "--host", "0.0.0.0", "--deterministic"]` used
  an unknown `--host` option. Removed it; the proxy already binds to `0.0.0.0` unconditionally.
- **`net_peerCount` returned "Method not found"** — Anvil doesn't implement this method.
  Since ethsmith is a local dev node with no P2P peers, the proxy now returns `"0x0"` directly.
  This was the only method `geth attach http://127.0.0.1:8545` required that wasn't working —
  all other connection handshake calls (`web3_clientVersion`, `net_version`, `net_listening`,
  `eth_blockNumber`) already worked. With this fix, `geth attach` connects cleanly.

---

## [1.3.2] — 2026-06-06

### Fixed
- **`--log-file <path>` option was silently ignored** — the CLI accepted the flag but `logger.js`
  always wrote to `~/.ethsmith/logs/` regardless. Now honoured: when `--log-file` is set, logs
  are written to the specified file using a plain `winston.transports.File` (no date-rotation suffix
  appended). Parent directories are created automatically if they don't exist.

### How it works
The fix follows the same pattern as `--log-level` (which already worked via `ETHSMITH_LOG_LEVEL`):
the command action sets `process.env.ETHSMITH_LOG_FILE = path.resolve(opts.logFile)` before any
internal `require()` that pulls in `logger.js`. Since `logger.js` is a singleton initialised at
first `require()` time, it reads the env var and configures the correct transport.

---

## [1.3.1] — 2026-06-06

### Fixed
- **50GB disk growth problem** — Anvil creates `~/.foundry/anvil/tmp/anvil-state-<timestamp>/` on every
  startup (its own disk-backed EVM state). Since ethsmith persists state to LevelDB, these directories
  are fully redundant after each session. Now:
  - **On startup**: all previous sessions' Anvil tmp dirs are deleted automatically
  - **On shutdown**: after the final LevelDB checkpoint, the current session's tmp dir is deleted
  - Net result: `~/.foundry/anvil/tmp/` stays empty — zero accumulation between sessions
- **`--prune-history` enabled by default** — Anvil previously kept full per-block state history in its
  tmp dir, causing each session's directory to grow with every mined block. With `--prune-history`
  (now default), Anvil only stores current state, significantly reducing per-session dir size.
  Use `--keep-history` to opt out if you need `eth_getLogs` across old blocks.

### Added
- `ethsmith clean [--dry-run]` — manually remove any leftover Anvil tmp dirs and see disk reclaimed
- `--keep-history` flag on `ethsmith node` — opt out of `--prune-history` when historical queries matter

---

## [1.3.0] — 2026-06-06

### Added
- `ethsmith logs` — tail today's log file, with `-f` follow mode and `-n` line count
- `ethsmith config` — view, set, or reset the `~/.ethsmith/config.json` config file
- `ETHSMITH_FORK_<NETWORK>_URL` env vars — override the default public RPC URL per network
  - `ETHSMITH_FORK_MAINNET_URL`, `ETHSMITH_FORK_SEPOLIA_URL`, `ETHSMITH_FORK_ARBITRUM_URL`, etc.

### Fixed
- `docker-compose.yml` volume paths corrected from `:/root/.ethsmith` to `:/root/.ethsmith/db`
  — the previous path would shadow Foundry binaries installed by postinstall, breaking the container
- LevelDB state snapshots now pruned to keep only the 5 most recent — prevents unbounded disk growth
- Request body size capped at 10 MB in proxy to prevent memory exhaustion on malformed requests
- `publish.yml` now runs all 6 test suites (was only 3) and uses the correct Foundry cache key

### Changed
- Docker publish workflow now builds multi-platform images (linux/amd64 + linux/arm64)

---

## [1.2.0] — 2026-06-06

### Added
- `ethsmith update` — update Foundry binaries to the latest version
- `ethsmith update --check` — check for updates without installing (shows Foundry + ethsmith versions)
- Auto-update notification — background npm check cached for 24h, shown on next startup
- ARM64 CI: `ubuntu-24.04-arm` added to test matrix alongside `ubuntu-latest`
- `build-musl.yml` — GitHub Actions workflow to cross-compile Foundry for musl targets (Alpine/Termux)
- musl/Termux/Android detection in postinstall — tries musl-specific binaries, falls back gracefully

### Fixed
- Windows `.zip` extraction: replaced `tar` with `unzipper` for `.zip` archives on Windows

---

## [1.1.0] — 2026-06-06

### Added
- `scripts/postinstall.js` — auto-downloads Foundry at `npm install` time (like Puppeteer/esbuild)
  - Skips if `anvil` found in system PATH
  - Skips if managed `~/.ethsmith/bin/anvil` already exists
  - `SKIP_ETHSMITH_POSTINSTALL=1` env var to opt out
  - Uses GitHub Releases API to resolve the correct versioned asset URL
- `ethsmith doctor` — checks Node version, all 4 Foundry tools with versions and paths, DB/bin dirs

### Fixed
- Foundry download URL: switched from hardcoded `foundry_stable_*` to dynamic GitHub API resolution
  — Foundry renamed their release assets to versioned names (e.g. `foundry_v1.7.1_linux_amd64.tar.gz`)
- `anvil_mine N blocks` test assertion: Anvil 1.7.1 mines the pending block first, producing N+1 blocks

### Changed
- `binary.js` lookup priority: managed `~/.ethsmith/bin/` → system PATH → runtime download
- Dockerfile: removed `foundryup` install layer; `npm ci` now triggers postinstall download
- `VOLUME` narrowed from `/root/.ethsmith` to `/root/.ethsmith/db` so binaries stay in image layer
- CI: replaced `foundry-rs/foundry-toolchain@v1` with `actions/cache` + postinstall

---

## [1.0.0] — 2026-06-05

### Initial release

- Unified Ethereum dev toolkit wrapping all 4 Foundry tools (Forge + Cast + Anvil + Chisel)
- Full Ganache CLI compatibility: `--accounts`, `--mnemonic`, `--deterministic`, `--chain-id`, `--fork`, `--unlock`, etc.
- Ganache RPC API: `personal_*`, `miner_*`, `eth_sign`, `eth_signTypedData_v4`
- Full Anvil RPC API: `anvil_setBalance`, `anvil_impersonateAccount`, `evm_snapshot`, `evm_revert`, etc.
- LevelDB state persistence: gzip-compressed checkpoints every 30s + on SIGTERM
- Two-port architecture: Anvil on internal OS-assigned port, EthsmithProxy on user-facing port
- WebSocket proxy on the same port as HTTP
- Full Cancun hardfork EIP support: EIP-1153, EIP-5656, EIP-1559, EIP-3855, EIP-2929, EIP-4844
- Docker image: `lord1egypt/ethsmith`
- CI: Node 20 + 22 matrix, 6 test suites
- Programmatic API: `ethsmith.provider()`, `ethsmith.server()` (EIP-1193 compatible)
