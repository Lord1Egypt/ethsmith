// Integration test: start node, mine blocks, stop, restart, verify state persisted
'use strict'

const { EthsmithNode } = require('../src/cli/node')
const axios = require('axios')

const PORT = 18630
const CHAIN_ID = 19630
const DB_PATH = `/tmp/ethsmith-test-db-${CHAIN_ID}`

async function rpc(method, params = []) {
  const res = await axios.post(`http://127.0.0.1:${PORT}`, {
    jsonrpc: '2.0', id: 1, method, params
  }, { timeout: 5000 })
  if (res.data.error) throw new Error(`${method}: ${res.data.error.message}`)
  return res.data.result
}

async function cleanup() {
  const { execSync } = require('child_process')
  try { execSync(`rm -rf ${DB_PATH}`) } catch {}
}

async function run() {
  console.log('Persistence Test\n')

  await cleanup()

  // ── Session 1: start node, mine 10 blocks, stop ────────────────────────────
  console.log('1. Starting fresh node...')
  const node1 = new EthsmithNode({
    port: PORT,
    'chain-id': String(CHAIN_ID),
    deterministic: true,
    db: DB_PATH,
    'state-interval': 5 // checkpoint every 5s
  })

  await node1.start()
  console.log('   Node ready')

  // mine 10 blocks
  console.log('2. Mining 10 blocks...')
  await rpc('anvil_mine', [10])
  const blockAfterMine = parseInt(await rpc('eth_blockNumber', []), 16)
  console.log(`   Block number after mining: ${blockAfterMine}`)
  if (blockAfterMine < 10) throw new Error(`Expected >= 10 blocks, got ${blockAfterMine}`)

  // send a tx to change state
  console.log('3. Sending test transaction...')
  const accounts = await rpc('eth_accounts', [])
  const balanceBefore = BigInt(await rpc('eth_getBalance', [accounts[1], 'latest']))
  await rpc('eth_sendTransaction', [{
    from: accounts[0],
    to: accounts[1],
    value: '0xDE0B6B3A7640000', // 1 ETH in hex
    gas: '0x5208'
  }])
  await rpc('anvil_mine', [1]) // mine the tx
  const balanceAfterSend = BigInt(await rpc('eth_getBalance', [accounts[1], 'latest']))
  console.log(`   Balance of accounts[1] before: ${balanceBefore.toString()} wei`)
  console.log(`   Balance of accounts[1] after:  ${balanceAfterSend.toString()} wei`)
  if (balanceAfterSend <= balanceBefore) throw new Error('Balance should have increased after tx')
  console.log('   Transaction confirmed')

  // force a checkpoint
  console.log('4. Saving state to LevelDB...')
  await node1._checkpoint()

  // graceful stop
  console.log('5. Stopping node (graceful)...')
  await node1.stop()
  console.log('   Node stopped')

  await new Promise(r => setTimeout(r, 500))

  // ── Session 2: restart, verify state ──────────────────────────────────────
  console.log('\n6. Restarting node from LevelDB state...')
  const node2 = new EthsmithNode({
    port: PORT,
    'chain-id': String(CHAIN_ID),
    deterministic: true,
    db: DB_PATH
  })

  await node2.start()
  console.log('   Node ready')

  const restoredBlock = parseInt(await rpc('eth_blockNumber', []), 16)
  console.log(`   Restored block number: ${restoredBlock}`)
  if (restoredBlock < 10) throw new Error(`State not restored — block is ${restoredBlock}, expected >= 10`)

  const restoredBalance = BigInt(await rpc('eth_getBalance', [accounts[1], 'latest']))
  console.log(`   Restored balance of accounts[1]: ${restoredBalance.toString()} wei`)
  if (restoredBalance <= balanceBefore) throw new Error('Account balance not restored correctly')

  console.log('\n7. Stopping node...')
  await node2.stop()

  await cleanup()

  console.log('\nPersistence test PASSED — state survives restart.')
}

run().catch(e => {
  console.error('\nTEST FAILED:', e.message)
  process.exit(1)
})
