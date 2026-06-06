'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')

const CACHE_FILE = path.join(os.homedir(), '.ethsmith', 'update-check.json')
const CACHE_TTL = 24 * 60 * 60 * 1000  // 24 hours

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) } catch { return null }
}

function writeCache(data) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ ...data, timestamp: Date.now() }))
  } catch {}
}

// Sync — reads cache only, zero latency
function showUpdateNotice() {
  const cache = readCache()
  if (!cache) return
  const pkg = require('../../package.json')
  if (cache.ethsmith && cache.ethsmith !== pkg.version) {
    console.error(`\n  \x1b[33m⚡ ethsmith v${cache.ethsmith} available\x1b[0m — npm i -g ethsmith\n`)
  }
}

// Async fire-and-forget — refreshes the cache for next run
function refreshUpdateCache() {
  const cache = readCache()
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) return  // still fresh
  // Background fetch — don't await
  ;(async () => {
    try {
      const axios = require('axios')
      const res = await axios.get('https://registry.npmjs.org/ethsmith/latest', {
        timeout: 6000,
        headers: { 'User-Agent': 'ethsmith-update-check' }
      })
      const latest = res.data.version
      writeCache({ ...(readCache() || {}), ethsmith: latest })
    } catch {}
  })()
}

// Returns latest Foundry tag from GitHub API
async function getLatestFoundryTag() {
  const axios = require('axios')
  const res = await axios.get('https://api.github.com/repos/foundry-rs/foundry/releases/latest', {
    headers: { 'User-Agent': 'ethsmith-updater' },
    timeout: 15000
  })
  return res.data.tag_name  // e.g. "v1.7.1"
}

// Returns installed anvil version string, or null
function getInstalledFoundryVersion() {
  const { resolveBin } = require('./binary')
  const p = resolveBin('anvil')
  if (!p) return null
  try {
    const r = spawnSync(p, ['--version'], { stdio: 'pipe', timeout: 5000 })
    const out = r.stdout ? r.stdout.toString().trim() : ''
    // "anvil Version: 1.6.0-v1.7.1" → extract last vX.Y.Z
    const m = out.match(/v(\d+\.\d+\.\d+)/)
    return m ? m[1] : out.split('\n')[0]
  } catch { return null }
}

// Update Foundry binaries to latest
async function updateFoundry(opts = {}) {
  const { downloadFoundry } = require('./binary')

  console.log('\nChecking Foundry version...\n')
  let latest
  try {
    latest = await getLatestFoundryTag()
  } catch (e) {
    console.error(`  Could not reach GitHub API: ${e.message}`)
    process.exit(1)
  }

  const installed = getInstalledFoundryVersion()
  const installedTag = installed ? `v${installed.replace(/^v/, '')}` : null
  const ok  = (s) => `  \x1b[32m✔\x1b[0m  ${s}`
  const info = (s) => `  \x1b[36mℹ\x1b[0m  ${s}`

  console.log(`  Installed : ${installed || '\x1b[31mnot found\x1b[0m'}`)
  console.log(`  Latest    : ${latest}`)

  if (opts.check) {
    if (!installed || installedTag !== latest) {
      console.log(`\n  \x1b[33mUpdate available\x1b[0m — run: ethsmith update`)
    } else {
      console.log(ok('Foundry is up to date'))
    }
    // Also check ethsmith itself
    const pkg = require('../../package.json')
    try {
      const axios = require('axios')
      const res = await axios.get('https://registry.npmjs.org/ethsmith/latest', {
        timeout: 6000, headers: { 'User-Agent': 'ethsmith-update-check' }
      })
      const npmLatest = res.data.version
      writeCache({ ethsmith: npmLatest })
      if (npmLatest !== pkg.version) {
        console.log(`  \x1b[33m⚡ ethsmith v${npmLatest} available\x1b[0m — npm i -g ethsmith`)
      } else {
        console.log(ok(`ethsmith v${pkg.version} is up to date`))
      }
    } catch {}
    console.log()
    return
  }

  if (installed && installedTag === latest) {
    console.log(ok(`Already on ${latest} — nothing to do\n`))
  } else {
    console.log(info(`Downloading Foundry ${latest}...\n`))
    try {
      await downloadFoundry()
      const after = getInstalledFoundryVersion()
      console.log(ok(`Foundry updated → ${after}\n`))
    } catch (e) {
      console.error(`  Update failed: ${e.message}`)
      process.exit(1)
    }
  }

  // ethsmith npm check
  const pkg = require('../../package.json')
  try {
    const axios = require('axios')
    const res = await axios.get('https://registry.npmjs.org/ethsmith/latest', {
      timeout: 6000, headers: { 'User-Agent': 'ethsmith-update-check' }
    })
    const npmLatest = res.data.version
    writeCache({ ethsmith: npmLatest })
    if (npmLatest !== pkg.version) {
      console.log(`  \x1b[33m⚡ ethsmith v${npmLatest} available\x1b[0m — npm i -g ethsmith`)
    } else {
      console.log(ok(`ethsmith v${pkg.version} is up to date`))
    }
  } catch {}
  console.log()
}

module.exports = { showUpdateNotice, refreshUpdateCache, updateFoundry, getLatestFoundryTag, getInstalledFoundryVersion }
