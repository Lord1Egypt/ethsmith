const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync, spawnSync } = require('child_process')
const axios = require('axios')
const tar = require('tar')
const logger = require('./logger')

const BIN_DIR = path.join(os.homedir(), '.ethsmith', 'bin')
const TOOLS = ['forge', 'cast', 'anvil', 'chisel']

const FOUNDRY_RELEASES = 'https://github.com/foundry-rs/foundry/releases'
const FOUNDRY_VERSION = 'stable'

function getPlatform() {
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64'
  const sys = os.platform()
  if (sys === 'darwin') return `darwin_${arch}`
  if (sys === 'linux') return `linux_${arch}`
  if (sys === 'win32') return `windows_amd64`
  throw new Error(`Unsupported platform: ${sys}`)
}

function getBinPath(tool) {
  const ext = os.platform() === 'win32' ? '.exe' : ''
  return path.join(BIN_DIR, tool + ext)
}

function isInstalled(tool) {
  const p = getBinPath(tool)
  if (fs.existsSync(p)) return true
  try {
    const r = spawnSync(tool, ['--version'], { stdio: 'pipe' })
    return r.status === 0
  } catch {
    return false
  }
}

function getSystemPath(tool) {
  try {
    const r = spawnSync('which', [tool], { stdio: 'pipe' })
    if (r.status === 0) return r.stdout.toString().trim()
  } catch {}
  try {
    const r = spawnSync('where', [tool], { stdio: 'pipe' })
    if (r.status === 0) return r.stdout.toString().split('\n')[0].trim()
  } catch {}
  return null
}

function resolveBin(tool) {
  // 1. our managed bin dir
  const managed = getBinPath(tool)
  if (fs.existsSync(managed)) return managed
  // 2. system PATH (user installed foundry themselves)
  const sys = getSystemPath(tool)
  if (sys) return sys
  return null
}

async function downloadFoundry() {
  fs.mkdirSync(BIN_DIR, { recursive: true })
  const platform = getPlatform()
  const ext = platform.startsWith('windows') ? '.zip' : '.tar.gz'
  const url = `${FOUNDRY_RELEASES}/latest/download/foundry_${FOUNDRY_VERSION}_${platform}${ext}`

  logger.info('Downloading Foundry binaries...', { url, platform })

  const tmpFile = path.join(os.tmpdir(), `foundry${ext}`)
  const writer = fs.createWriteStream(tmpFile)

  const response = await axios({ url, method: 'GET', responseType: 'stream' })
  await new Promise((resolve, reject) => {
    response.data.pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
  })

  logger.info('Extracting Foundry binaries...')
  await tar.extract({ file: tmpFile, cwd: BIN_DIR, strip: 0 })
  fs.unlinkSync(tmpFile)

  // make executable
  for (const tool of TOOLS) {
    const p = getBinPath(tool)
    if (fs.existsSync(p)) fs.chmodSync(p, 0o755)
  }

  logger.info('Foundry binaries ready', { dir: BIN_DIR })
}

async function ensureFoundry() {
  const missing = TOOLS.filter(t => !resolveBin(t))
  if (missing.length === 0) {
    logger.debug('All Foundry tools found')
    return
  }
  logger.info(`Missing Foundry tools: ${missing.join(', ')} — downloading...`)
  await downloadFoundry()

  const stillMissing = TOOLS.filter(t => !resolveBin(t))
  if (stillMissing.length > 0) {
    throw new Error(
      `Failed to install Foundry tools: ${stillMissing.join(', ')}.\n` +
      `Install manually: curl -L https://foundry.paradigm.xyz | bash && foundryup`
    )
  }
}

function bin(tool) {
  const p = resolveBin(tool)
  if (!p) throw new Error(`Foundry tool '${tool}' not found. Run: ethsmith install`)
  return p
}

module.exports = { ensureFoundry, bin, TOOLS, BIN_DIR }
