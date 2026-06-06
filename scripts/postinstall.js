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

function getPlatform() {
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64'
  const sys = os.platform()
  if (sys === 'darwin') return `darwin_${arch}`
  if (sys === 'linux')  return `linux_${arch}`
  if (sys === 'win32')  return `win32_amd64`
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

async function download() {
  let axios, tar
  try { axios = require('axios'); tar = require('tar') }
  catch {
    console.warn('ethsmith: axios/tar unavailable — skipping Foundry download.')
    console.warn('  Run "ethsmith install" to install manually.')
    return false
  }

  const platform = getPlatform()
  if (!platform) {
    console.warn(`ethsmith: unsupported platform ${os.platform()} ${os.arch()}`)
    console.warn('  Install Foundry manually: https://getfoundry.sh')
    return false
  }

  // Resolve latest Foundry release from GitHub API
  let downloadUrl
  try {
    const res = await axios.get(GITHUB_API, {
      headers: { 'User-Agent': 'ethsmith-postinstall' },
      timeout: 30000
    })
    const ext = platform.startsWith('win32') ? '.zip' : '.tar.gz'
    const asset = res.data.assets.find(a => a.name.includes(platform) && a.name.endsWith(ext))
    if (!asset) throw new Error(`No asset for platform: ${platform}`)
    downloadUrl = asset.browser_download_url
  } catch (e) {
    console.warn(`ethsmith: could not resolve Foundry release: ${e.message}`)
    console.warn('  Run "ethsmith install" to retry, or: https://getfoundry.sh')
    return false
  }

  fs.mkdirSync(BIN_DIR, { recursive: true })
  const ext = downloadUrl.endsWith('.zip') ? '.zip' : '.tar.gz'
  const tmpFile = path.join(os.tmpdir(), `foundry_ethsmith${ext}`)

  process.stdout.write(`ethsmith: downloading Foundry for ${platform}... `)

  try {
    const res = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream', timeout: 180000 })
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
    console.warn('  Run "ethsmith install" to retry, or: https://getfoundry.sh')
    return false
  }

  try {
    await tar.extract({ file: tmpFile, cwd: BIN_DIR, strip: 0 })
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
