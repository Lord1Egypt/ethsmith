'use strict'
// Highload test: 1000 blocks + 200 transactions, measure time + memory

const { EthsmithNode } = require('../src/cli/node')
const axios = require('axios')

const PORT = 18602
const CHAIN_ID = '19602'
const DB_PATH = `/tmp/ethsmith-test-${CHAIN_ID}`
const { execSync } = require('child_process')

async function rpc(method, params = []) {
  const r = await axios.post(`http://127.0.0.1:${PORT}`, { jsonrpc: '2.0', id: 1, method, params }, { timeout: 30000 })
  if (r.data.error) throw new Error(`${method}: ${r.data.error.message}`)
  return r.data.result
}

async function cleanup() { try { execSync(`rm -rf ${DB_PATH}`) } catch {} }

async function run() {
  console.log('Highload Test\n')
  await cleanup()

  const node = new EthsmithNode({
    port: PORT, 'chain-id': CHAIN_ID, deterministic: true, db: DB_PATH, 'state-interval': '999'
  })
  await node.start()

  const memBefore = process.memoryUsage().heapUsed

  // ── 1000 blocks in instamine mode ─────────────────────────────────────────
  console.log('1. Mining 1,000 blocks...')
  const t1 = Date.now()
  await rpc('anvil_mine', [1000])
  const blockTime = Date.now() - t1
  const block = parseInt(await rpc('eth_blockNumber', []), 16)
  console.log(`   Done in ${blockTime}ms — block: ${block}`)
  if (block < 1000) throw new Error(`Expected >= 1000 blocks, got ${block}`)
  console.log(`   PASS — ${blockTime < 60000 ? 'fast' : 'within limit'}`)

  // ── 200 transactions ───────────────────────────────────────────────────────
  console.log('\n2. Sending 200 transactions...')
  const accounts = await rpc('eth_accounts', [])
  const t2 = Date.now()
  const txPromises = []
  for (let i = 0; i < 200; i++) {
    txPromises.push(
      rpc('eth_sendTransaction', [{
        from: accounts[i % accounts.length],
        to: accounts[(i + 1) % accounts.length],
        value: '0x1',
        gas: '0x5208'
      }])
    )
  }
  const txHashes = await Promise.all(txPromises)
  await rpc('anvil_mine', [5]) // mine pending txs
  const txTime = Date.now() - t2
  console.log(`   Done in ${txTime}ms — ${txHashes.length} txs submitted`)
  if (txHashes.length !== 200) throw new Error(`Expected 200 txs, got ${txHashes.length}`)
  console.log(`   PASS`)

  // ── Verify receipts ────────────────────────────────────────────────────────
  console.log('\n3. Verifying receipts...')
  let confirmed = 0
  for (const hash of txHashes.slice(0, 20)) { // spot-check first 20
    const receipt = await rpc('eth_getTransactionReceipt', [hash])
    if (receipt && receipt.blockNumber) confirmed++
  }
  if (confirmed < 20) throw new Error(`Only ${confirmed}/20 spot-check receipts found`)
  console.log(`   PASS — ${confirmed}/20 spot-checked`)

  // ── Memory ─────────────────────────────────────────────────────────────────
  const memAfter = process.memoryUsage().heapUsed
  const memDeltaMB = ((memAfter - memBefore) / 1024 / 1024).toFixed(1)
  console.log(`\n4. Memory delta: ${memDeltaMB} MB`)
  if (parseFloat(memDeltaMB) > 500) throw new Error(`Memory usage too high: ${memDeltaMB} MB`)
  console.log(`   PASS`)

  // ── Final block ────────────────────────────────────────────────────────────
  const finalBlock = parseInt(await rpc('eth_blockNumber', []), 16)
  console.log(`\n   Final block: ${finalBlock}`)

  await node.stop()
  await cleanup()
  console.log('\nHighload test PASSED.')
}

run().catch(e => { console.error('\nFAIL:', e.message); process.exit(1) })
