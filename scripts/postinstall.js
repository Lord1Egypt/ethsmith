'use strict'

// Escape hatches
if (process.env.SKIP_ETHSMITH_POSTINSTALL === '1') {
  console.log('ethsmith: skipping Foundry install (SKIP_ETHSMITH_POSTINSTALL=1)')
  process.exit(0)
}

const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')

const BIN_DIR = path.join(os.homedir(), '.ethsmith', 'bin')
const VERSION_FILE = path.join(os.homedir(), '.ethsmith', '.foundry-version')
const FOUNDRY_VERSION = 'stable'
const FOUNDRY_RELEASES = 'https://github.com/foundry-rs/foundry/releases'
const TOOLS = ['forge', 'cast', 'anvil', 'chisel']

function getPlatform() {
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64'
  const sys = os.platform()
  if (sys === 'darwin') return `darwin_${arch}`
  if (sys === 'linux') return `linux_${arch}`
  if (sys === 'win32') return `windows_amd64`
  return null
}

function whichCmd(tool) {
  const cmd = os.platform() === 'win32' ? 'where' : 'which'
  const r = spawnSync(cmd, [tool], { stdio: 'pipe' })
  return r.status === 0 ? r.stdout.toString().trim().split('\n')[0].trim() : null
}

function anvilInPath() {
  return whichCmd('anvil') !== null
}

function managedBinExists() {
  const ext = os.platform() === 'win32' ? '.exe' : ''
  return fs.existsSync(path.join(BIN_DIR, 'anvil' + ext))
}

async function download() {
  let axios, tar
  try {
    axios = require('axios')
    tar = require('tar')
  } catch {
    console.warn('ethsmith: cannot load axios/tar — skipping download.')
    console.warn('  Run "ethsmith install" to install Foundry manually.')
    return false
  }

  const platform = getPlatform()
  if (!platform) {
    console.warn(`ethsmith: unsupported platform ${os.platform()} ${os.arch()} — skipping download.`)
    console.warn('  Install Foundry manually: https://getfoundry.sh')
    return false
  }

  const ext = platform.startsWith('windows') ? '.zip' : '.tar.gz'
  const url = `${FOUNDRY_RELEASES}/latest/download/foundry_${FOUNDRY_VERSION}_${platform}${ext}`
  const tmpFile = path.join(os.tmpdir(), `foundry_ethsmith${ext}`)

  fs.mkdirSync(BIN_DIR, { recursive: true })

  process.stdout.write(`ethsmith: downloading Foundry (forge/cast/anvil/chisel) for ${platform}... `)

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
    console.warn('  Run "ethsmith install" to retry, or: https://getfoundry.sh')
    return false
  }

  try {
    await tar.extract({ file: tmpFile, cwd: BIN_DIR, strip: 0 })
    fs.unlinkSync(tmpFile)

    // make all extracted binaries executable
    for (const tool of TOOLS) {
      const ext2 = os.platform() === 'win32' ? '.exe' : ''
      const p = path.join(BIN_DIR, tool + ext2)
      if (fs.existsSync(p)) fs.chmodSync(p, 0o755)
    }

    fs.writeFileSync(VERSION_FILE, FOUNDRY_VERSION)
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
  // never block the npm install
  console.warn(`ethsmith postinstall warning: ${e.message}`)
  process.exit(0)
})
