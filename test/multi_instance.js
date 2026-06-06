'use strict'
// Multi-instance test: 3 simultaneous nodes, isolated state, independent operation

const { EthsmithNode } = require('../src/cli/node')
const axios = require('axios')
const { execSync } = require('child_process')

const INSTANCES = [
  { port: 18610, chainId: '19610', db: '/tmp/ethsmith-test-19610' },
  { port: 18611, chainId: '19611', db: '/tmp/ethsmith-test-19611' },
  { port: 18612, chainId: '19612', db: '/tmp/ethsmith-test-19612' }
]

async function rpc(port, method, params = []) {
  const r = await axios.post(`http://127.0.0.1:${port}`, { jsonrpc: '2.0', id: 1, method, params }, { timeout: 10000 })
  if (r.data.error) throw new Error(`[port ${port}] ${method}: ${r.data.error.message}`)
  return r.data.result
}

function cleanup() {
  for (const i of INSTANCES) try { execSync(`rm -rf ${i.db}`) } catch {}
}

async function run() {
  console.log('Multi-Instance Test\n')
  cleanup()

  // ── Start 3 nodes in parallel ──────────────────────────────────────────────
  console.log('1. Starting 3 nodes simultaneously...')
  const nodes = INSTANCES.map(i => new EthsmithNode({
    port: i.port, 'chain-id': i.chainId, deterministic: true, db: i.db, 'state-interval': '999'
  }))
  await Promise.all(nodes.map(n => n.start()))
  console.log('   All 3 nodes ready PASS')

  // ── Each node has independent state ───────────────────────────────────────
  console.log('\n2. Verifying isolated state...')
  await rpc(INSTANCES[0].port, 'anvil_mine', [10])  // node A: 10 blocks
  await rpc(INSTANCES[1].port, 'anvil_mine', [20])  // node B: 20 blocks
  await rpc(INSTANCES[2].port, 'anvil_mine', [30])  // node C: 30 blocks

  const [blockA, blockB, blockC] = await Promise.all(
    INSTANCES.map(i => rpc(i.port, 'eth_blockNumber', []).then(h => parseInt(h, 16)))
  )
  console.log(`   Node A block: ${blockA}, B: ${blockB}, C: ${blockC}`)
  if (blockA !== 10) throw new Error(`Node A: expected 10, got ${blockA}`)
  if (blockB !== 20) throw new Error(`Node B: expected 20, got ${blockB}`)
  if (blockC !== 30) throw new Error(`Node C: expected 30, got ${blockC}`)
  console.log('   PASS — blocks are isolated')

  // ── Chain IDs are independent ─────────────────────────────────────────────
  const [cidA, cidB, cidC] = await Promise.all(
    INSTANCES.map(i => rpc(i.port, 'eth_chainId', []).then(h => parseInt(h, 16)))
  )
  console.log(`\n3. Chain IDs: A=${cidA}, B=${cidB}, C=${cidC}`)
  if (cidA === cidB || cidB === cidC) throw new Error('Chain IDs are not isolated')
  console.log('   PASS — chain IDs are isolated')

  // ── Transactions do NOT cross nodes ───────────────────────────────────────
  console.log('\n4. Sending tx to Node A only...')
  const accounts = await rpc(INSTANCES[0].port, 'eth_accounts', [])
  await rpc(INSTANCES[0].port, 'eth_sendTransaction', [{
    from: accounts[0], to: accounts[1], value: '0xDE0B6B3A7640000', gas: '0x5208'
  }])
  await rpc(INSTANCES[0].port, 'anvil_mine', [1])

  const balA = BigInt(await rpc(INSTANCES[0].port, 'eth_getBalance', [accounts[1], 'latest']))
  const balB = BigInt(await rpc(INSTANCES[1].port, 'eth_getBalance', [accounts[1], 'latest']))
  if (balA <= balB) throw new Error('TX leaked between nodes')
  console.log(`   Node A balance[1]: ${balA}, Node B: ${balB}`)
  console.log('   PASS — tx only affected Node A')

  // ── Kill node B, A and C keep running ─────────────────────────────────────
  console.log('\n5. Stopping Node B, A and C keep running...')
  await nodes[1].stop()
  const [stillA, stillC] = await Promise.all([
    rpc(INSTANCES[0].port, 'eth_blockNumber', []),
    rpc(INSTANCES[2].port, 'eth_blockNumber', [])
  ])
  console.log(`   Node A: ${parseInt(stillA, 16)}, Node C: ${parseInt(stillC, 16)}`)
  console.log('   PASS — A and C unaffected by B stopping')

  // ── Stop all ───────────────────────────────────────────────────────────────
  console.log('\n6. Stopping remaining nodes...')
  await Promise.all([nodes[0].stop(), nodes[2].stop()])
  cleanup()

  console.log('\nMulti-instance test PASSED.')
}

run().catch(e => { console.error('\nFAIL:', e.message); process.exit(1) })
