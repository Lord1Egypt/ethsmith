'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')
const logger = require('./logger')

const BIN_DIR = path.join(os.homedir(), '.ethsmith', 'bin')
const TOOLS = ['forge', 'cast', 'anvil', 'chisel']

function getBinPath(tool) {
  const ext = os.platform() === 'win32' ? '.exe' : ''
  return path.join(BIN_DIR, tool + ext)
}

function getSystemPath(tool) {
  const cmd = os.platform() === 'win32' ? 'where' : 'which'
  try {
    const r = spawnSync(cmd, [tool], { stdio: 'pipe' })
    if (r.status === 0) return r.stdout.toString().trim().split('\n')[0].trim()
  } catch {}
  return null
}

function resolveBin(tool) {
  // 1. managed dir (~/.ethsmith/bin/) — installed by postinstall or ethsmith install
  const managed = getBinPath(tool)
  if (fs.existsSync(managed)) return managed
  // 2. system PATH — user has Foundry installed globally
  const sys = getSystemPath(tool)
  if (sys) return sys
  return null
}

function bin(tool) {
  const p = resolveBin(tool)
  if (!p) {
    throw new Error(
      `Foundry tool '${tool}' not found.\n` +
      `  Run: ethsmith install\n` +
      `  Or install Foundry: https://getfoundry.sh`
    )
  }
  return p
}

async function ensureFoundry() {
  const missing = TOOLS.filter(t => !resolveBin(t))
  if (missing.length === 0) {
    logger.debug('All Foundry tools found')
    return
  }

  // Attempt download as a fallback (e.g. manual git clone, not npm install)
  logger.info(`Missing Foundry tools: ${missing.join(', ')} — downloading...`)
  await downloadFoundry()

  const stillMissing = TOOLS.filter(t => !resolveBin(t))
  if (stillMissing.length > 0) {
    throw new Error(
      `Failed to install: ${stillMissing.join(', ')}\n` +
      `  Run: ethsmith install\n` +
      `  Or install Foundry: https://getfoundry.sh`
    )
  }
}

async function downloadFoundry() {
  const axios = require('axios')
  const tar = require('tar')

  const FOUNDRY_VERSION = 'stable'
  const FOUNDRY_RELEASES = 'https://github.com/foundry-rs/foundry/releases'

  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64'
  const sys = os.platform()
  let platform
  if (sys === 'darwin') platform = `darwin_${arch}`
  else if (sys === 'linux') platform = `linux_${arch}`
  else if (sys === 'win32') platform = `windows_amd64`
  else throw new Error(`Unsupported platform: ${sys}`)

  const ext = platform.startsWith('windows') ? '.zip' : '.tar.gz'
  const url = `${FOUNDRY_RELEASES}/latest/download/foundry_${FOUNDRY_VERSION}_${platform}${ext}`

  logger.info('Downloading Foundry binaries...', { url, platform })

  fs.mkdirSync(BIN_DIR, { recursive: true })
  const tmpFile = path.join(os.tmpdir(), `foundry${ext}`)
  const writer = fs.createWriteStream(tmpFile)

  const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 180000 })
  await new Promise((resolve, reject) => {
    response.data.pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
  })

  logger.info('Extracting Foundry binaries...')
  await tar.extract({ file: tmpFile, cwd: BIN_DIR, strip: 0 })
  fs.unlinkSync(tmpFile)

  for (const tool of TOOLS) {
    const p = getBinPath(tool)
    if (fs.existsSync(p)) fs.chmodSync(p, 0o755)
  }

  logger.info('Foundry binaries ready', { dir: BIN_DIR })
}

module.exports = { ensureFoundry, downloadFoundry, bin, resolveBin, TOOLS, BIN_DIR }
