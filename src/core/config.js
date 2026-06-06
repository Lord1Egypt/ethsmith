const fs = require('fs')
const path = require('path')
const os = require('os')

const CONFIG_DIR = path.join(os.homedir(), '.ethsmith')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {}
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function mergeConfig(cliOpts) {
  const file = loadConfig()
  // CLI opts win over file config — only merge file values not set by CLI
  const merged = { ...file }
  for (const [k, v] of Object.entries(cliOpts)) {
    if (v !== undefined && v !== false && v !== null && v !== '') {
      merged[k] = v
    } else if (!(k in merged)) {
      merged[k] = v
    }
  }
  return merged
}

function ensureConfigDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
}

function writeDefaultConfig() {
  ensureConfigDir()
  if (fs.existsSync(CONFIG_PATH)) return
  const defaults = {
    port: 8545,
    accounts: 10,
    chainId: 1337,
    gasLimit: 30000000,
    balance: 1000,
    stateInterval: 30,
    logLevel: 'info'
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2))
}

module.exports = { loadConfig, mergeConfig, writeDefaultConfig, CONFIG_PATH, CONFIG_DIR }
