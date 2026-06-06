# ethsmith — RPC Command Examples

All commands target `http://localhost:8545`. Start the node first:

```bash
# npm
ethsmith node --deterministic

# Docker
docker run -p 8545:8545 lord1egypt/ethsmith:latest
```

---

## Basic Info

```bash
# Current block number
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'

# All accounts
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"eth_accounts","params":[]}'

# Chain ID
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"eth_chainId","params":[]}'

# Client version
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"web3_clientVersion","params":[]}'

# Network version
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":5,"method":"net_version","params":[]}'

# Peer count (always 0 for local dev node)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":6,"method":"net_peerCount","params":[]}'

# Gas price
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":7,"method":"eth_gasPrice","params":[]}'
```

---

## Accounts & Balances

```bash
# Get balance of account[0] (1000 ETH default)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":10,"method":"eth_getBalance","params":["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","latest"]}'

# Get balance of account[1]
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":11,"method":"eth_getBalance","params":["0x70997970C51812dc3A010C7d01b50e0d17dc79C8","latest"]}'

# personal_listAccounts (Ganache-compatible)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":12,"method":"personal_listAccounts","params":[]}'

# Get nonce of account[0]
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":13,"method":"eth_getTransactionCount","params":["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","latest"]}'
```

---

## Anvil Dev Tools

```bash
# Set balance of account[1] to 10,000 ETH (0x21E19E0C9BAB2400000 wei)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":20,"method":"anvil_setBalance","params":["0x70997970C51812dc3A010C7d01b50e0d17dc79C8","0x21E19E0C9BAB2400000"]}'

# Impersonate account[3] (send txs without its private key)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":21,"method":"anvil_impersonateAccount","params":["0x90F79bf6EB2c4f870365E785982E1f101E93b906"]}'

# Stop impersonating account[3]
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":22,"method":"anvil_stopImpersonatingAccount","params":["0x90F79bf6EB2c4f870365E785982E1f101E93b906"]}'

# Set block timestamp (Unix seconds)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":23,"method":"anvil_setNextBlockTimestamp","params":[1800000000]}'

# Set chain ID
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":24,"method":"anvil_setChainId","params":["0x539"]}'

# Set code at address (deploy bytecode directly)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":25,"method":"anvil_setCode","params":["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","0x6080604052"]}'

# Reset to fresh state (optional fork URL)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":26,"method":"anvil_reset","params":[{}]}'

# Enable/disable auto-mining
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":27,"method":"evm_setAutomine","params":[true]}'

# Set mining interval (milliseconds) — interval mining mode
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":28,"method":"evm_setIntervalMining","params":[3000]}'
```

---

## Mining

```bash
# Start auto-mining (Ganache-compatible)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":30,"method":"miner_start","params":[]}'

# Stop auto-mining
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":31,"method":"miner_stop","params":[]}'

# Mine 5 blocks immediately
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":32,"method":"anvil_mine","params":["0x5"]}'

# Mine 1 block (evm_mine — Hardhat-compatible)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":33,"method":"evm_mine","params":[]}'
```

---

## Transactions

```bash
# Send 5 ETH from account[0] to account[2]
# 0x4563918244F40000 = 5 ETH in wei
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0","id":40,"method":"eth_sendTransaction",
    "params":[{
      "from": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "to":   "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "value":"0x4563918244F40000"
    }]
  }'

# Send 1 ETH from impersonated account[3] (no private key needed)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0","id":41,"method":"eth_sendTransaction",
    "params":[{
      "from": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      "to":   "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "value":"0xDE0B6B3A7640000"
    }]
  }'

# Get transaction receipt (replace TX_HASH)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":42,"method":"eth_getTransactionReceipt","params":["TX_HASH"]}'

# Get transaction by hash (replace TX_HASH)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":43,"method":"eth_getTransactionByHash","params":["TX_HASH"]}'

# Estimate gas
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0","id":44,"method":"eth_estimateGas",
    "params":[{
      "from": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "to":   "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "value":"0xDE0B6B3A7640000"
    }]
  }'
```

---

## Snapshots & Time Travel

```bash
# Take a snapshot — returns snapshot ID (e.g. "0x1")
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":50,"method":"evm_snapshot","params":[]}'

# Revert to snapshot (replace SNAPSHOT_ID with value returned above)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":51,"method":"evm_revert","params":["SNAPSHOT_ID"]}'

# Increase time by 3600 seconds (1 hour)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":52,"method":"evm_increaseTime","params":[3600]}'
```

---

## Blocks

```bash
# Get latest block (full tx objects)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":60,"method":"eth_getBlockByNumber","params":["latest",true]}'

# Get block 1 (tx hashes only)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":61,"method":"eth_getBlockByNumber","params":["0x1",false]}'

# Get block by hash (replace BLOCK_HASH)
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":62,"method":"eth_getBlockByHash","params":["BLOCK_HASH",false]}'
```

---

## Signing

```bash
# personal_sign — sign a message with account[0]
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0","id":70,"method":"personal_sign",
    "params":["0x48656c6c6f20657468736d697468","0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]
  }'

# eth_sign — legacy sign
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0","id":71,"method":"eth_sign",
    "params":["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","0x48656c6c6f20657468736d697468"]
  }'
```

---

## Tips

**Decode hex balance to ETH (Python):**
```bash
python3 -c "print(int('0x3635c9adc5dea00000', 16) / 1e18, 'ETH')"
```

**Pretty-print any response:**
```bash
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | python3 -m json.tool
```

**Deterministic account addresses (--deterministic flag):**
```
[0] 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
[1] 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
[2] 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
[3] 0x90F79bf6EB2c4f870365E785982E1f101E93b906
[4] 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
[5] 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc
[6] 0x976EA74026E726554dB657fA54763abd0C3a0aa9
[7] 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955
[8] 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f
[9] 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720
```

**Common ETH values in wei (hex):**
```
1 ETH   = 0xDE0B6B3A7640000
5 ETH   = 0x4563918244F40000
10 ETH  = 0x8AC7230489E80000
100 ETH = 0x56BC75E2D63100000
1000 ETH= 0x3635C9ADC5DEA00000
```
