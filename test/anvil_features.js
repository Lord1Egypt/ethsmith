'use strict'
// Test key Anvil special methods via the proxy

const { EthsmithNode } = require('../src/cli/node')
const axios = require('axios')
const { execSync } = require('child_process')

const PORT = 18620
const CHAIN_ID = '19620'
const DB_PATH = `/tmp/ethsmith-test-${CHAIN_ID}`

async function rpc(method, params = []) {
  const r = await axios.post(`http://127.0.0.1:${PORT}`, { jsonrpc: '2.0', id: Date.now(), method, params }, { timeout: 10000 })
  if (r.data.error) throw new Error(`${method}: ${r.data.error.message}`)
  return r.data.result
}

function cleanup() { try { execSync(`rm -rf ${DB_PATH}`) } catch {} }
let node

async function test(name, fn) {
  try { await fn(); console.log(`  PASS: ${name}`) }
  catch (e) { console.error(`  FAIL: ${name} — ${e.message}`); throw e }
}

async function run() {
  console.log('Anvil Features Test\n')
  cleanup()

  node = new EthsmithNode({ port: PORT, 'chain-id': CHAIN_ID, deterministic: true, db: DB_PATH, 'state-interval': '999' })
  await node.start()

  const accounts = await rpc('eth_accounts', [])
  const addr0 = accounts[0], addr1 = accounts[1]
  await rpc('anvil_mine', [1])

  console.log('--- Balance & Balance manipulation ---')
  await test('eth_getBalance', async () => {
    const b = BigInt(await rpc('eth_getBalance', [addr0, 'latest']))
    if (b === 0n) throw new Error('balance is 0')
  })
  await test('anvil_setBalance', async () => {
    await rpc('anvil_setBalance', [addr1, '0x56BC75E2D63100000']) // 100 ETH
    const b = BigInt(await rpc('eth_getBalance', [addr1, 'latest']))
    if (b !== BigInt('0x56BC75E2D63100000')) throw new Error(`got ${b}`)
  })
  await test('anvil_addBalance', async () => {
    const before = BigInt(await rpc('eth_getBalance', [addr0, 'latest']))
    await rpc('anvil_addBalance', [addr0, '0xDE0B6B3A7640000']) // +1 ETH
    const after = BigInt(await rpc('eth_getBalance', [addr0, 'latest']))
    if (after <= before) throw new Error('balance did not increase')
  })

  console.log('\n--- Nonce & Code ---')
  await test('anvil_setNonce', async () => {
    await rpc('anvil_setNonce', [addr0, '0xA'])
    const n = parseInt(await rpc('eth_getTransactionCount', [addr0, 'latest']), 16)
    if (n !== 10) throw new Error(`nonce is ${n}, expected 10`)
  })
  await test('anvil_setCode', async () => {
    const fakeCode = '0x60016000'
    await rpc('anvil_setCode', [addr1, fakeCode])
    const code = await rpc('eth_getCode', [addr1, 'latest'])
    if (!code.startsWith('0x6001')) throw new Error(`code is ${code}`)
  })
  await test('anvil_setStorageAt', async () => {
    await rpc('anvil_setStorageAt', [addr0, '0x0', '0x' + '42'.padStart(64, '0')])
    const val = await rpc('eth_getStorageAt', [addr0, '0x0', 'latest'])
    if (!val.includes('42')) throw new Error(`storage is ${val}`)
  })

  console.log('\n--- Impersonation ---')
  await test('anvil_impersonateAccount', async () => {
    const whale = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' // vitalik.eth
    await rpc('anvil_setBalance', [whale, '0x56BC75E2D63100000'])
    await rpc('anvil_impersonateAccount', [whale])
    const tx = await rpc('eth_sendTransaction', [{ from: whale, to: addr0, value: '0x1', gas: '0x5208' }])
    if (!tx.startsWith('0x')) throw new Error('tx hash invalid')
    await rpc('anvil_stopImpersonatingAccount', [whale])
  })

  console.log('\n--- Mining control ---')
  await test('anvil_mine N blocks', async () => {
    const before = parseInt(await rpc('eth_blockNumber', []), 16)
    await rpc('anvil_mine', [50])
    const after = parseInt(await rpc('eth_blockNumber', []), 16)
    if (after - before !== 50) throw new Error(`expected 50 blocks, got ${after - before}`)
  })
  await test('miner_stop / miner_start', async () => {
    await rpc('miner_stop', [])
    await rpc('miner_start', [])
  })

  console.log('\n--- Snapshot / Revert ---')
  await test('evm_snapshot / evm_revert', async () => {
    const balBefore = BigInt(await rpc('eth_getBalance', [addr0, 'latest']))
    const snapId = await rpc('evm_snapshot', [])
    await rpc('anvil_setBalance', [addr0, '0x1'])
    const balMid = BigInt(await rpc('eth_getBalance', [addr0, 'latest']))
    if (balMid !== 1n) throw new Error(`snapshot set wrong balance: ${balMid}`)
    await rpc('evm_revert', [snapId])
    const balAfter = BigInt(await rpc('eth_getBalance', [addr0, 'latest']))
    if (balAfter !== balBefore) throw new Error(`revert failed: ${balAfter} != ${balBefore}`)
  })

  console.log('\n--- Mempool ---')
  await test('anvil_dropAllTransactions', async () => {
    await rpc('anvil_dropAllTransactions', [])
  })
  await test('txpool_status', async () => {
    const s = await rpc('txpool_status', [])
    if (typeof s !== 'object') throw new Error('txpool_status returned non-object')
  })

  console.log('\n--- Node info ---')
  await test('anvil_nodeInfo', async () => {
    const info = await rpc('anvil_nodeInfo', [])
    if (!info) throw new Error('null nodeInfo')
  })

  console.log('\n--- personal_* ---')
  await test('personal_listAccounts', async () => {
    const list = await rpc('personal_listAccounts', [])
    if (!Array.isArray(list) || list.length === 0) throw new Error('empty account list')
  })
  await test('personal_importRawKey', async () => {
    const newKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const addr = await rpc('personal_importRawKey', [newKey, 'password'])
    if (!addr.startsWith('0x')) throw new Error(`bad address: ${addr}`)
  })

  await node.stop()
  cleanup()
  console.log('\nAnvil features test PASSED.')
}

run().catch(e => {
  if (node) node.stop().catch(() => {})
  console.error('\nFAIL:', e.message)
  process.exit(1)
})
