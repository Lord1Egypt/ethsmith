#!/usr/bin/env bash
# Scripted demo for ethsmith — run via: asciinema rec demo.cast --command "bash docs/record_demo.sh"

export TERM=xterm-256color
export FORCE_COLOR=1
export NODE_PATH=/home/lordegypt/ethsmith

# ── helpers ────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# type a command char-by-char, then run it
run() {
  echo -ne "${BOLD}${GREEN}\$ ${RESET}"
  for ((i=0; i<${#1}; i++)); do
    echo -n "${1:$i:1}"
    sleep 0.04
  done
  echo
  sleep 0.2
  eval "$1"
}

# print a comment line
comment() {
  echo -e "${CYAN}# $1${RESET}"
  sleep 0.6
}

pause() { sleep "$1"; }

# ── demo ───────────────────────────────────────────────────────────────────

clear
pause 0.5

comment "ethsmith — Ganache-compatible Ethereum dev node, powered by Foundry"
pause 1

run "ethsmith --version"
pause 1

echo
comment "Start a local node with 10 deterministic accounts"
pause 0.8

# Start node in background, stream its output to a temp file we tail
LOGFILE=$(mktemp)
DBDIR=$(mktemp -d)

node /home/lordegypt/ethsmith/bin/ethsmith.js node \
  --deterministic \
  --chain-id 1337 \
  --db "$DBDIR" \
  --log-level info \
  > "$LOGFILE" 2>&1 &
NODE_PID=$!

# Stream stdout (Anvil banner) until proxy is ready
timeout 15 bash -c "
  while IFS= read -r line; do
    echo \"\$line\"
    echo \"\$line\" | grep -q 'RPC proxy ready' && break
  done < <(tail -f $LOGFILE)
"

pause 1.5

echo
comment "Node is live on http://localhost:8545"
pause 0.8

run "curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_blockNumber\",\"params\":[]}'"
pause 1

echo
comment "Send 5 ETH from account[0] to account[1]"
pause 0.8

run "curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"eth_sendTransaction\",\"params\":[{\"from\":\"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266\",\"to\":\"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\",\"value\":\"0x4563918244F40000\"}]}'"
pause 1

echo
comment "Mine 10 blocks instantly"
pause 0.6

run "curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"anvil_mine\",\"params\":[\"0xa\"]}'"
pause 0.5

run "curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"eth_blockNumber\",\"params\":[]}'"
pause 1

echo
comment "Take a snapshot — revert in tests with a single call"
pause 0.6

run "curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"evm_snapshot\",\"params\":[]}'"
pause 1

echo
comment "State auto-checkpoints to LevelDB every 30s (and on shutdown)"
pause 0.8

# Force a checkpoint by waiting for the timer or killing cleanly
echo -e "${BOLD}${GREEN}\$ ${RESET}kill -SIGTERM $NODE_PID   ${CYAN}# graceful shutdown${RESET}"
pause 0.5
kill -SIGTERM $NODE_PID 2>/dev/null

# Show the shutdown log lines
timeout 6 bash -c "
  while IFS= read -r line; do
    echo \"\$line\"
    echo \"\$line\" | grep -q 'node stopped' && break
  done < <(tail -f $LOGFILE)
" 2>/dev/null || true

pause 1

echo
comment "State saved. Next run restores from block 11 automatically."
pause 0.5

echo
echo -e "${BOLD}npm install -g ethsmith   |   docker pull lord1egypt/ethsmith:latest${RESET}"
echo -e "${CYAN}github.com/Lord1Egypt/ethsmith${RESET}"
pause 2

# cleanup
rm -rf "$LOGFILE" "$DBDIR"
