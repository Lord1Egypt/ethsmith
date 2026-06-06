'use strict'

if (process.env.SKIP_ETHSMITH_POSTINSTALL === '1') {
  console.log('ethsmith: skipping Foundry install (SKIP_ETHSMITH_POSTINSTALL=1)')
  process.exit(0)
}

const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')

const BIN_DIR = path.join(os.homedir(), '.ethsmith', 'bin')
const TOOLS = ['forge', 'cast', 'anvil', 'chisel']
const GITHUB_API = 'https://api.github.com/repos/foundry-rs/foundry/releases/latest'
const MUSL_RELEASE_BASE = 'https://github.com/Lord1Egypt/ethsmith/releases/download/foundry-musl-latest'

function getPlatform() {
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64'
  const sys = os.platform()
  if (sys === 'darwin') return `darwin_${arch}`
  if (sys === 'linux')  return `linux_${arch}`
  if (sys === 'win32')  return `win32_amd64`
  return null
}

function detectMusl() {
  if (process.env.TERMUX_VERSION || (process.env.PREFIX || '').includes('com.termux')) return 'termux'
  if (process.env.ANDROID_ROOT) return 'android'
  if (fs.existsSync('/lib/ld-musl-x86_64.so.1') || fs.existsSync('/lib/ld-musl-aarch64.so.1')) return 'musl'
  try {
    const r = spawnSync('ldd', ['--version'], { stdio: 'pipe' })
    const out = (r.stdout || r.stderr || Buffer.alloc(0)).toString()
    if (out.toLowerCase().includes('musl')) return 'musl'
  } catch {}
  return null
}

function whichCmd(tool) {
  const cmd = os.platform() === 'win32' ? 'where' : 'which'
  const r = spawnSync(cmd, [tool], { stdio: 'pipe' })
  return r.status === 0 ? r.stdout.toString().trim().split('\n')[0].trim() : null
}

function anvilInPath()     { return whichCmd('anvil') !== null }
function managedBinExists() {
  const ext = os.platform() === 'win32' ? '.exe' : ''
  return fs.existsSync(path.join(BIN_DIR, 'anvil' + ext))
}

async function extractArchive(file, dest) {
  if (file.endsWith('.zip')) {
    let unzipper
    try { unzipper = require('unzipper') } catch {
      throw new Error('unzipper package not available — run: npm install -g unzipper')
    }
    await fs.createReadStream(file).pipe(unzipper.Extract({ path: dest })).promise()
  } else {
    const tar = require('tar')
    await tar.extract({ file, cwd: dest, strip: 0 })
  }
}

async function download() {
  let axios
  try { axios = require('axios') }
  catch {
    console.warn('ethsmith: axios unavailable — skipping Foundry download.')
    console.warn('  Run "ethsmith install" to install manually.')
    return false
  }

  const platform = getPlatform()
  if (!platform) {
    console.warn(`ethsmith: unsupported platform ${os.platform()} ${os.arch()}`)
    console.warn('  Install Foundry manually: https://getfoundry.sh')
    return false
  }

  const muslEnv = detectMusl()

  // musl/Termux/Android: try our pre-built musl binaries first
  if (muslEnv) {
    const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64'
    const muslArtifact = `foundry-musl-linux-${arch}.tar.gz`
    const muslUrl = `${MUSL_RELEASE_BASE}/${muslArtifact}`
    console.log(`ethsmith: detected ${muslEnv} environment — trying musl binaries...`)
    const ok = await tryDownload(axios, muslUrl, platform, 'musl')
    if (ok) return true
    console.warn('ethsmith: musl binaries not yet built for this release.')
    console.warn('  For Termux/Alpine: use proot-distro with Ubuntu, then install ethsmith.')
    console.warn('  Or build musl binaries: github.com/Lord1Egypt/ethsmith/actions/workflows/build-musl.yml')
    return false
  }

  // Standard: resolve latest release from GitHub API
  let downloadUrl
  try {
    const res = await axios.get(GITHUB_API, {
      headers: { 'User-Agent': 'ethsmith-postinstall' },
      timeout: 30000
    })
    const fileExt = platform.startsWith('win32') ? '.zip' : '.tar.gz'
    const asset = res.data.assets.find(a => a.name.includes(platform) && a.name.endsWith(fileExt))
    if (!asset) throw new Error(`No asset for platform: ${platform}`)
    downloadUrl = asset.browser_download_url
  } catch (e) {
    console.warn(`ethsmith: could not resolve Foundry release: ${e.message}`)
    console.warn('  Run "ethsmith install" to retry, or: https://getfoundry.sh')
    return false
  }

  return tryDownload(axios, downloadUrl, platform, 'standard')
}

async function tryDownload(axios, url, platform, label) {
  const ext = url.endsWith('.zip') ? '.zip' : '.tar.gz'
  const tmpFile = path.join(os.tmpdir(), `foundry_ethsmith${ext}`)

  process.stdout.write(`ethsmith: downloading Foundry [${label}] for ${platform}... `)

  try {
    const res = await axios({ url, method: 'GET', responseType: 'stream', timeout: 180000 })
    const writer = fs.createWriteStream(tmpFile)
    await new Promise((resolve, reject) => {
      res.data.pipe(writer)
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
    process.stdout.write('done\n')
  } catch (e) {
    process.stdout.write('failed\n')
    console.warn(`ethsmith: download failed: ${e.message}`)
    return false
  }

  try {
    fs.mkdirSync(BIN_DIR, { recursive: true })
    await extractArchive(tmpFile, BIN_DIR)
    fs.unlinkSync(tmpFile)
    for (const tool of TOOLS) {
      const p = path.join(BIN_DIR, tool + (os.platform() === 'win32' ? '.exe' : ''))
      if (fs.existsSync(p)) fs.chmodSync(p, 0o755)
    }
    console.log(`ethsmith: Foundry tools installed → ${BIN_DIR}`)
    return true
  } catch (e) {
    console.warn(`ethsmith: extraction failed: ${e.message}`)
    try { fs.unlinkSync(tmpFile) } catch {}
    return false
  }
}

async function main() {
  if (anvilInPath()) {
    console.log('ethsmith: anvil found in system PATH — skipping download')
    return
  }
  if (managedBinExists()) {
    console.log('ethsmith: Foundry already installed — skipping download')
    return
  }
  await download()
}

main().catch(e => {
  console.warn(`ethsmith postinstall warning: ${e.message}`)
  process.exit(0)
})
