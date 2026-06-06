// Maps Ganache CLI flags → Anvil CLI flags
// Ganache users can pass old flags and they just work

const DETERMINISTIC_MNEMONIC = 'test test test test test test test test test test test junk'

function mapGanacheToAnvil(opts) {
  const anvil = []

  // port
  if (opts.port) anvil.push('--port', String(opts.port))

  // accounts
  if (opts.accounts) anvil.push('--accounts', String(opts.accounts))

  // mnemonic
  if (opts.deterministic) {
    anvil.push('--mnemonic', DETERMINISTIC_MNEMONIC)
  } else if (opts.mnemonic) {
    anvil.push('--mnemonic', opts.mnemonic)
  }

  // chain id — kebab-case CLI arg wins over camelCase config file default
  const chainId = opts['chain-id'] || opts.chainId || opts.networkId
  if (chainId) anvil.push('--chain-id', String(chainId))

  // gas limit (Ganache: --gasLimit, Anvil: --gas-limit)
  const gasLimit = opts.gasLimit || opts['gas-limit']
  if (gasLimit) anvil.push('--gas-limit', String(gasLimit))

  // gas price (Ganache: --gasPrice, Anvil: --gas-price)
  const gasPrice = opts.gasPrice || opts['gas-price']
  if (gasPrice) anvil.push('--gas-price', String(gasPrice))

  // fork (Ganache: --fork <url> or --fork.url, Anvil: --fork-url)
  const forkUrl = opts.fork || opts['fork.url'] || opts['fork-url']
  if (forkUrl && typeof forkUrl === 'string') {
    // support Ganache @block syntax: https://...@19000000
    if (forkUrl.includes('@')) {
      const [url, block] = forkUrl.split('@')
      anvil.push('--fork-url', url)
      anvil.push('--fork-block-number', block)
    } else {
      anvil.push('--fork-url', forkUrl)
    }
  }

  // fork block number
  const forkBlock = opts['fork.blockNumber'] || opts['forkBlockNumber'] || opts['fork-block-number']
  if (forkBlock && !anvil.includes('--fork-block-number')) {
    anvil.push('--fork-block-number', String(forkBlock))
  }

  // fork network shorthand (Ganache: --fork.network mainnet)
  // env var ETHSMITH_FORK_<NETWORK>_URL overrides the public default RPC
  const forkNetwork = opts['fork.network'] || opts.forkNetwork
  if (forkNetwork && !anvil.includes('--fork-url')) {
    const defaultUrls = {
      mainnet:  'https://eth.llamarpc.com',
      sepolia:  'https://rpc.sepolia.org',
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      optimism: 'https://mainnet.optimism.io',
      base:     'https://mainnet.base.org',
      polygon:  'https://polygon-rpc.com'
    }
    const name = forkNetwork.toLowerCase()
    if (!defaultUrls[name]) throw new Error(`Unknown network: ${forkNetwork}. Use: mainnet, sepolia, arbitrum, optimism, base, polygon`)
    // ETHSMITH_FORK_MAINNET_URL, ETHSMITH_FORK_SEPOLIA_URL, etc.
    const envKey = `ETHSMITH_FORK_${name.toUpperCase()}_URL`
    const url = process.env[envKey] || defaultUrls[name]
    anvil.push('--fork-url', url)
  }

  // block time (same flag on both)
  const blockTime = opts.blockTime || opts['block-time']
  if (blockTime) anvil.push('--block-time', String(blockTime))

  // unlock / impersonate (Ganache: --unlock 0xABC, Anvil: --impersonate 0xABC)
  const unlock = opts.unlock || opts.impersonate
  if (unlock) {
    const addrs = Array.isArray(unlock) ? unlock : [unlock]
    for (const addr of addrs) anvil.push('--impersonate', addr)
  }

  // balance (Ganache: --defaultBalanceEther, Anvil: --balance)
  const balance = opts.defaultBalanceEther || opts.balance
  if (balance) anvil.push('--balance', String(balance))

  // hardfork
  const hardfork = opts.hardfork || opts['hardfork']
  if (hardfork) anvil.push('--hardfork', hardfork)

  // host
  const host = opts.host || opts.hostname
  if (host) anvil.push('--host', host)
  else anvil.push('--host', '0.0.0.0')

  // block-base-fee-per-gas
  const baseFee = opts.baseFee || opts['block-base-fee-per-gas']
  if (baseFee) anvil.push('--block-base-fee-per-gas', String(baseFee))

  // fund specific accounts: --fund-accounts 0xABC:1000
  const fundAccounts = opts.fundAccounts || opts['fund-accounts']
  if (fundAccounts) {
    const entries = Array.isArray(fundAccounts) ? fundAccounts : [fundAccounts]
    for (const entry of entries) anvil.push('--fund-accounts', entry)
  }

  // IPC path
  if (opts.ipc) anvil.push('--ipc', typeof opts.ipc === 'string' ? opts.ipc : '')

  // no mining
  if (opts.noMining || opts['no-mining']) anvil.push('--no-mining')

  // prune history
  if (opts.pruneHistory || opts['prune-history']) anvil.push('--prune-history')

  // transaction order
  const txOrder = opts.order || opts['transaction-order']
  if (txOrder) anvil.push('--order', txOrder)

  // optimism / L2
  if (opts.optimism) anvil.push('--optimism')

  // genesis file
  const genesis = opts.genesis || opts.init
  if (genesis) anvil.push('--init', genesis)

  // max transactions per block
  const maxTx = opts.maxTransactions || opts['max-transactions']
  if (maxTx) anvil.push('--max-transactions', String(maxTx))

  return anvil
}

module.exports = { mapGanacheToAnvil, DETERMINISTIC_MNEMONIC }
