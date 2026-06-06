#!/usr/bin/env node
'use strict'

// Node.js 20+ required
const [major] = process.versions.node.split('.').map(Number)
if (major < 20) {
  console.error(`ethsmith requires Node.js >= 20 (you have v${process.versions.node})`)
  console.error('Upgrade: https://nodejs.org')
  process.exit(1)
}

const { buildCLI } = require('../src/cli/index')
const { showUpdateNotice, refreshUpdateCache } = require('../src/core/updater')

// Show cached update notice (sync, zero latency), refresh cache in background
showUpdateNotice()
refreshUpdateCache()

const program = buildCLI()
program.parseAsync(process.argv).catch(err => {
  console.error(err.message)
  process.exit(1)
})
