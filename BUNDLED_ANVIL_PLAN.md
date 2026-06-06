# Bundled Anvil Plan

## The Question

Should ethsmith bundle the Anvil binary so users don't need Foundry installed?

---

## Current Approach (v1.0.0)

`src/core/binary.js` does this at **first run**:

```
ethsmith node
  → check PATH for anvil
  → if not found: download all of Foundry (~100MB) from GitHub
  → store in ~/.ethsmith/bin/
  → launch anvil
```

**Problems:**
- Download happens at first run — surprise internet call at runtime
- Downloads ALL of Foundry (forge + cast + anvil + chisel), not just anvil
- CI environments with restricted network access will fail at runtime, not at install
- No progress indicator — looks frozen

---

## Proposed Approach: Postinstall Anvil Download

Download ONLY the `anvil` binary at `npm install` time via a `postinstall` script.

```
npm install -g ethsmith
  → postinstall.js runs
  → detects platform (linux-x64, darwin-arm64, win32-x64)
  → downloads ONLY anvil binary from foundry-rs/foundry GitHub releases (~15-20MB)
  → stores in ~/.ethsmith/bin/anvil (outside node_modules, persists across npm updates)
  → verifies checksum
  → done — ethsmith starts instantly from now on
```

---

## Comparison Table

| Factor | Current (lazy download) | Proposed (postinstall) | Bundle all platforms |
|--------|------------------------|------------------------|---------------------|
| npm package size | ~1 MB | ~1 MB | ~150 MB (rejected) |
| First `npm install` | Fast | +20s download | Slowest |
| First `ethsmith node` | Slow (downloads Foundry) | Instant | Instant |
| Works offline after install | No | Yes | Yes |
| CI reliability | Poor (runtime network) | Good (install-time) | Good |
| Surprise downloads | Yes (at runtime) | No (visible at install) | No |
| Download size | ~100 MB (all Foundry) | ~20 MB (anvil only) | ~150 MB (all platforms) |
| Complexity | Low | Medium | High (sub-packages) |
| Upgrade path | Manual | Auto on `npm update` | Auto on `npm update` |

---

## Verdict

**Proposed approach wins** on almost every metric that matters to developers.

The current approach is worse because the surprise download at `ethsmith node` is invisible, slow, and breaks in offline/restricted CI environments. The postinstall approach is the industry standard (Puppeteer, Playwright, esbuild all use it).

---

## Implementation Plan

### Step 1 — Write `scripts/postinstall.js`

```js
const { platform, arch } = process
const FOUNDRY_VERSION = 'v1.7.1'  // pin version

const PLATFORM_MAP = {
  'linux-x64':   'anvil-x86_64-unknown-linux-gnu.tar.gz',
  'linux-arm64': 'anvil-aarch64-unknown-linux-gnu.tar.gz',
  'darwin-x64':  'anvil-x86_64-apple-darwin.tar.gz',
  'darwin-arm64':'anvil-aarch64-apple-darwin.tar.gz',
  'win32-x64':   'anvil-x86_64-pc-windows-msvc.zip',
}

// Download from: https://github.com/foundry-rs/foundry/releases/download/FOUNDRY_VERSION/...
// Extract just the `anvil` binary
// Store in: ~/.ethsmith/bin/anvil (or .exe on Windows)
// Write ~/.ethsmith/anvil-version.txt = FOUNDRY_VERSION (for cache invalidation)
```

### Step 2 — Update `package.json`

```json
{
  "scripts": {
    "postinstall": "node scripts/postinstall.js"
  }
}
```

### Step 3 — Update `src/core/binary.js`

```js
// Priority order:
// 1. ~/.ethsmith/bin/anvil    (installed by postinstall)
// 2. system PATH anvil        (user has Foundry already)
// 3. fallback: download now   (for manual installs without npm, e.g. clone + node bin/ethsmith.js)
```

### Step 4 — Add `ethsmith doctor` command

```bash
ethsmith doctor
# → Checks Node version ≥ 20
# → Checks anvil binary exists and is correct version
# → Prints ethsmith version, anvil version, DB path
# → Reports OK / WARN / ERROR for each check
```

### Step 5 — Skip download if already found in PATH

If the user already has Foundry installed (Hardhat/Forge developer), skip the postinstall download entirely:

```js
if (whichSync('anvil')) {
  console.log('ethsmith: anvil found in PATH, skipping download.')
  process.exit(0)
}
```

### Step 6 — Update CI workflow

Remove `foundry-rs/foundry-toolchain@v1` from CI since postinstall handles it:

```yaml
- name: Install dependencies
  run: npm ci
# → postinstall.js downloads anvil automatically
# → no separate foundry install step needed
```

### Step 7 — Update Docker

Remove `foundryup` from Dockerfile since postinstall handles it. Smaller Docker image.

---

## Files to Create/Modify

| File | Action | What changes |
|------|--------|-------------|
| `scripts/postinstall.js` | CREATE | Downloads anvil binary for current platform |
| `scripts/check-anvil.js` | CREATE | Version check helper, used by postinstall + doctor |
| `package.json` | MODIFY | Add `"postinstall": "node scripts/postinstall.js"` |
| `src/core/binary.js` | MODIFY | New priority: postinstall path first, then PATH, then fallback |
| `src/cli/index.js` | MODIFY | Add `ethsmith doctor` command |
| `.github/workflows/ci.yml` | MODIFY | Remove separate foundry install step |
| `Dockerfile` | MODIFY | Remove `foundryup` layer — postinstall handles it at image build |
| `README.md` | MODIFY | Update install section, remove "requires Foundry" note |
| `.npmignore` | CREATE | Exclude test files, docs from npm package |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| GitHub release URL changes for Foundry | Pin version in `scripts/postinstall.js`, update on each ethsmith release |
| Corporate proxy blocks GitHub downloads | Respect `HTTPS_PROXY` / `HTTP_PROXY` env vars in download script |
| postinstall fails (no internet) | Graceful degradation: warn but don't fail install; use PATH fallback |
| Windows `.exe` binary | Include `.exe` suffix in platform map for win32 |
| Binary not executable after extract | `chmod +x` after extraction on Unix |
| npm publish skips `scripts/` folder | Add `"files"` to `package.json` to explicitly include `scripts/` |

---

## Estimated Effort

| Task | Effort |
|------|--------|
| `scripts/postinstall.js` | ~80 lines |
| `src/core/binary.js` update | ~20 lines change |
| `ethsmith doctor` command | ~50 lines |
| Update CI / Docker | ~10 lines change |
| README update | ~5 lines change |
| **Total** | **~165 lines** |

---

## Version Target

This feature would be released as **v1.1.0** (minor bump — no breaking changes, new install behavior).
