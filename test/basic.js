// Basic smoke test — runs without starting a node
'use strict'

const assert = require('assert')
const { mapGanacheToAnvil } = require('../src/core/flags')

console.log('Running basic tests...\n')

// Test 1: --deterministic maps to mnemonic
{
  const args = mapGanacheToAnvil({ deterministic: true, port: 8545 })
  assert(args.includes('--mnemonic'), 'deterministic flag should set mnemonic')
  assert(args.includes('--port'), 'port should be present')
  console.log('PASS: --deterministic → --mnemonic')
}

// Test 2: --networkId maps to --chain-id
{
  const args = mapGanacheToAnvil({ networkId: '1337' })
  assert(args.includes('--chain-id'), '--networkId should map to --chain-id')
  assert(args.includes('1337'), 'chain ID value should be present')
  console.log('PASS: --networkId → --chain-id')
}

// Test 3: --gasLimit maps to --gas-limit
{
  const args = mapGanacheToAnvil({ gasLimit: '12000000' })
  assert(args.includes('--gas-limit'), '--gasLimit should map to --gas-limit')
  console.log('PASS: --gasLimit → --gas-limit')
}

// Test 4: --fork with @block syntax
{
  const args = mapGanacheToAnvil({ fork: 'https://eth.llamarpc.com@19000000' })
  assert(args.includes('--fork-url'), 'fork URL should be present')
  assert(args.includes('--fork-block-number'), 'fork block number should be present')
  assert(args.includes('19000000'), 'block number value should match')
  console.log('PASS: --fork url@block → --fork-url + --fork-block-number')
}

// Test 5: --fork.network mainnet resolves URL
{
  const args = mapGanacheToAnvil({ 'fork.network': 'mainnet' })
  assert(args.includes('--fork-url'), 'fork.network should resolve to --fork-url')
  console.log('PASS: --fork.network mainnet → --fork-url')
}

// Test 6: --unlock maps to --impersonate
{
  const args = mapGanacheToAnvil({ unlock: '0xABC123' })
  assert(args.includes('--impersonate'), '--unlock should map to --impersonate')
  console.log('PASS: --unlock → --impersonate')
}

// Test 7: default host is 0.0.0.0
{
  const args = mapGanacheToAnvil({})
  assert(args.includes('0.0.0.0'), 'default host should be 0.0.0.0')
  console.log('PASS: default host → 0.0.0.0')
}

console.log('\nAll basic tests passed.')
