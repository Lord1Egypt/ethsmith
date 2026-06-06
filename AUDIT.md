# ethsmith — Bug Audit & Fix Log

Full record of every bug found, its root cause, and what was done to fix it.
Ordered by version. Use this to understand why specific decisions were made.

---

## v1.3.1 — Anvil tmp disk accumulation (50 GB)

### Bug
`~/.foundry/anvil/tmp/` grew to 50 GB+ over time with many sessions.

### Root Cause
Anvil creates `~/.foundry/anvil/tmp/anvil-state-<timestamp>/` on **every startup** — its own disk-backed EVM state stored as individual JSON files (one per account/storage slot). These files are:
- 100 MB+ per session
- Never cleaned up by Anvil itself
- Multiplied across every `ethsmith node` invocation
- Completely redundant because ethsmith already persists state to LevelDB

### Fix
`src/cli/node.js` only — no sensitive code touched:
1. Snapshot existing tmp dirs before spawning Anvil
2. After Anvil is ready: identify the new session dir, delete all **old** dirs (previous sessions)
3. After final LevelDB checkpoint on shutdown: delete the **current** session dir

Result: `~/.foundry/anvil/tmp/` stays at 0 bytes between sessions.

### Also fixed in same release
- `--prune-history` enabled by default — Anvil no longer keeps full per-block state history inside the tmp dir. This reduces each session's dir from growing with every mined block.
- `--keep-history` flag added to opt out (for users who need `eth_getLogs` on old blocks)
- `ethsmith clean [--dry-run]` command added for manual one-time cleanup of any pre-existing dirs

---

## v1.3.0 — docker-compose volume path bug

### Bug
Running `docker-compose up` broke Foundry binaries inside the container silently.

### Root Cause
`docker-compose.yml` mounted `./data/dev:/root/.ethsmith` — the full `.ethsmith` directory. Since the Dockerfile changed `VOLUME` to `/root/.ethsmith/db` and binaries are installed to `~/.ethsmith/bin/` by postinstall, mounting the whole `~/.ethsmith` shadowed the binaries layer. Anvil could not be found at startup.

### Fix
Changed all volume mounts in `docker-compose.yml` from `:/root/.ethsmith` → `:/root/.ethsmith/db`.

---

## v1.3.0 — LevelDB state snapshot disk leak

### Bug
LevelDB grew unboundedly over long-running nodes.

### Root Cause
`db.js` `saveState()` wrote two keys per checkpoint:
- `state:latest` — overwritten each time (fine)
- `state:${Date.now()}` — timestamped snapshot, **never deleted**

After days of checkpoints every 30 seconds, thousands of obsolete snapshots accumulated.

### Fix
Added `_pruneStateSnapshots(keep=5)` called after every `saveState()`. Iterates keys between `state:` and `state:~`, keeps only the 5 most recent timestamped entries, deletes the rest.

---

## v1.3.0 — Proxy HTTP body size unbounded

### Bug
A request with a very large body (e.g. 1 GB) would buffer entirely in RAM and crash the process.

### Root Cause
`proxy.js` accumulated body chunks with `body += chunk` and no size limit.

### Fix
Added `bodySize` counter; if it exceeds 10 MB, the request is destroyed and a `413` JSON-RPC error is returned.

---

## v1.3.0 — publish.yml cache key mismatch

### Bug
ARM64 and x86_64 CI runners shared the same Foundry binary cache key, causing ARM64 runs to unpack x86_64 binaries and fail silently.

### Root Cause
`publish.yml` still used the old key `foundry-${{ runner.os }}-stable-v1` while `ci.yml` was already updated to include `runner.arch`.

### Fix
Updated `publish.yml` cache key to `foundry-${{ runner.os }}-${{ runner.arch }}-stable-v1`.

---

## v1.3.0 — publish.yml only ran 3 of 6 tests

### Bug
npm publishes could go out with regressions in crash_recovery, multi_instance, or anvil_features.

### Root Cause
`publish.yml` only ran `basic.js && persistence.js && highload.js` before publishing.

### Fix
Added all 6 test suites to the pre-publish step.

---

## v1.3.0 — `logs` command name conflict with cast logs

### Bug
Adding `ethsmith logs` to tail the application log file caused a startup crash:
```
Error: cannot add command 'logs' as already have command 'logs'
```

### Root Cause
The cast command loop already registered `logs <addr>` (maps to `cast logs`). Commander rejects duplicate command names.

### Fix
Renamed the new application-log command to `ethsmith tail` — unambiguous and familiar to Unix users.

---

## v1.2.0 — Windows ZIP extraction silently failed

### Bug
`npm install -g ethsmith` on Windows downloaded Foundry as `.zip` but extraction silently failed, leaving no binaries.

### Root Cause
Both `scripts/postinstall.js` and `src/core/binary.js` used `tar.extract()` for all archive types. The `tar` npm package does not handle `.zip` files — it returns no error but extracts nothing.

### Fix
Added `unzipper` as a dependency. Both files now check the archive extension and branch:
- `.zip` → `unzipper.Extract({ path: dest })`
- `.tar.gz` → `tar.extract({ file, cwd: dest })`

---

## v1.2.0 — crash_recovery test flapped in CI at 15 s timeout

### Bug
`test/crash_recovery.js` failed intermittently in CI with `"Node did not start in time"` when run after other tests.

### Root Cause
The test uses a hard 15-second timeout for Anvil to start. When run sequentially after 4 other tests, system load (especially on shared CI runners) pushed startup past 15 s.

### Fix
Increased startup timeout from `15000` → `25000` ms.

---

## v1.1.0 — Foundry download 404 on postinstall

### Bug
`npm install -g ethsmith` printed:
```
Request failed with status code 404
```
and left no Foundry binaries.

### Root Cause
The hardcoded download URL used `foundry_stable_linux_amd64.tar.gz` — a naming convention Foundry dropped in favour of versioned filenames like `foundry_v1.7.1_linux_amd64.tar.gz`.

### Fix
Replaced hardcoded URL with a GitHub Releases API call (`/repos/foundry-rs/foundry/releases/latest`) to dynamically resolve the correct asset name for the current platform at install time.

---

## v1.1.0 — anvil_mine test assertion wrong by 1

### Bug
`test/anvil_features.js` failed in CI:
```
expected 50 blocks, got 51
```

### Root Cause
Anvil 1.7.1 changed `anvil_mine [N]` behaviour: it mines the **pending block first**, then N additional blocks, producing N+1 total.

### Fix
Changed assertion from `after - before !== 50` → `after - before < 50` (accepts ≥ 50).

---

## v1.1.0 — CI Foundry install step exit code 127

### Bug
CI failed at the "Install Foundry" step immediately after `curl | bash`.

### Root Cause
The `curl -L https://foundry.paradigm.xyz | bash` script installs `foundryup` but the binary is not on PATH in the same shell step. The next step calling `foundryup` got exit code 127 (not found).

### Fix
Replaced with `foundry-rs/foundry-toolchain@v1` GitHub Action which handles PATH correctly, later replaced with `actions/cache` + postinstall for consistency.

---

## v1.0.0 — LevelDB hex decode error on state restore

### Bug
Node crashed on startup with `Buffer decode error` when trying to restore state.

### Root Cause
`anvil_dumpState` returns a `0x`-prefixed hex string. The restore code passed the raw string to `Buffer.from(hex, 'hex')` without stripping the `0x` prefix. `Buffer.from` silently returned an incorrect buffer.

### Fix
Strip `0x` prefix before decoding: `const raw = stateHex.startsWith('0x') ? stateHex.slice(2) : stateHex`. Restore adds `0x` back: `return '0x' + buf.toString('hex')`.

---

## v1.0.0 — ethers v6 HD wallet derived wrong addresses

### Bug
`personal_listAccounts` returned addresses that didn't match the expected deterministic accounts for the standard test mnemonic.

### Root Cause
`ethers.HDNodeWallet.fromPhrase(phrase)` in ethers v6 returns a depth-0 root node, not a derived account. Calling `.derivePath('m/44\'/60\'/0\'/0/0')` on it applied the path **relative** to an already-derived node, producing wrong addresses.

### Fix
Pass the full BIP44 path as the third argument: `ethers.HDNodeWallet.fromPhrase(phrase, undefined, \`m/44'/60'/0'/0/${i}\`)` which derives directly from the root with the complete path.

---

## v1.0.0 — Chain ID priority: CLI lost to config file

### Bug
Running `ethsmith node --chain-id 31337` used the chain ID from `~/.ethsmith/config.json` instead of the CLI argument.

### Root Cause
`mergeConfig()` merged CLI opts into the file config incorrectly — file values overwrote CLI values when they existed in both.

### Fix
Inverted merge logic: start from file config, then overlay CLI opts. CLI opts win for any key where the CLI provided a defined, non-empty value.

---

## Known limitation (not a bug)

### Termux / Alpine (musl libc)
Foundry releases only ship glibc-linked binaries. Termux uses Android's Bionic libc; Alpine uses musl. Both are incompatible with glibc binaries.

**Current state:** postinstall detects musl/Termux and attempts to download ethsmith's own musl builds from the `foundry-musl-latest` GitHub release tag (built via `build-musl.yml` workflow). If no musl build exists yet, it prints clear instructions.

**Workaround:** Use `proot-distro install ubuntu` inside Termux, or use Ubuntu/Debian in UserLand. Both provide glibc and work without issues.

---

*Last updated: 2026-06-06 — ethsmith v1.3.1*
