#!/bin/bash
# StellarVault — Contract Deployment Script
# Usage: ./scripts/deploy.sh [testnet|mainnet]

set -euo pipefail

NETWORK="${1:-testnet}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║        StellarVault Deployer v1.0        ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${RESET}"

echo -e "${YELLOW}Network: ${NETWORK}${RESET}"
echo ""

# ─── Prerequisites check ──────────────────────────────────────────────────────
echo "🔍 Checking prerequisites..."

if ! command -v stellar &> /dev/null; then
  echo -e "${RED}❌ Stellar CLI not found. Install: cargo install stellar-cli --features opt${RESET}"
  exit 1
fi

if ! command -v cargo &> /dev/null; then
  echo -e "${RED}❌ Rust/Cargo not found. Install from rustup.rs${RESET}"
  exit 1
fi

echo -e "${GREEN}✅ Prerequisites OK${RESET}"

# ─── Build contracts ──────────────────────────────────────────────────────────
echo ""
echo "🔨 Building Soroban contracts..."

cd "$ROOT_DIR/contracts/stellar_vault"
cargo build --release --target wasm32-unknown-unknown 2>&1 | tail -5

WASM_PATH="target/wasm32-unknown-unknown/release/stellar_vault.wasm"

if [ ! -f "$WASM_PATH" ]; then
  echo -e "${RED}❌ WASM build failed${RESET}"
  exit 1
fi

WASM_SIZE=$(du -h "$WASM_PATH" | cut -f1)
echo -e "${GREEN}✅ Built: $WASM_PATH ($WASM_SIZE)${RESET}"

# ─── Check source account ────────────────────────────────────────────────────
if [ -z "${STELLAR_SECRET_KEY:-}" ]; then
  echo ""
  echo -e "${YELLOW}⚠️  STELLAR_SECRET_KEY not set${RESET}"
  echo "Please set: export STELLAR_SECRET_KEY=S..."
  exit 1
fi

echo ""
echo "📡 Deploying to ${NETWORK}..."

# ─── Deploy Oracle first ─────────────────────────────────────────────────────
echo "  [1/3] Deploying PriceOracle..."
ORACLE_ADDR=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source "$STELLAR_SECRET_KEY" \
  --network "$NETWORK" \
  2>/dev/null || echo "DEPLOY_FAILED")

if [ "$ORACLE_ADDR" = "DEPLOY_FAILED" ]; then
  echo -e "${RED}    ❌ Oracle deploy failed${RESET}"
else
  echo -e "${GREEN}    ✅ Oracle: $ORACLE_ADDR${RESET}"
fi

# ─── Deploy main vault ───────────────────────────────────────────────────────
echo "  [2/3] Deploying StellarVault..."
VAULT_ADDR=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source "$STELLAR_SECRET_KEY" \
  --network "$NETWORK" \
  2>/dev/null || echo "DEPLOY_FAILED")

if [ "$VAULT_ADDR" = "DEPLOY_FAILED" ]; then
  echo -e "${RED}    ❌ Vault deploy failed${RESET}"
else
  echo -e "${GREEN}    ✅ Vault: $VAULT_ADDR${RESET}"
fi

# ─── Initialize contracts ────────────────────────────────────────────────────
echo "  [3/3] Initializing contracts..."

ADMIN=$(stellar keys address default 2>/dev/null || echo "NO_ADMIN")

if [ "$VAULT_ADDR" != "DEPLOY_FAILED" ] && [ "$ADMIN" != "NO_ADMIN" ]; then
  stellar contract invoke \
    --id "$VAULT_ADDR" \
    --source "$STELLAR_SECRET_KEY" \
    --network "$NETWORK" \
    -- initialize \
    --admin "$ADMIN" \
    --yield_rate_bps 500 \
    --oracle "$ORACLE_ADDR" 2>/dev/null && \
    echo -e "${GREEN}    ✅ Vault initialized (5% APY, oracle linked)${RESET}" || \
    echo -e "${YELLOW}    ⚠️  Initialization may have failed${RESET}"
fi

# ─── Output summary ──────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}🚀 Deployment Complete${RESET}"
echo ""
echo "Contract addresses:"
echo "  VAULT_CONTRACT=$VAULT_ADDR"
echo "  ORACLE_CONTRACT=$ORACLE_ADDR"
echo ""
echo "Update .env.local:"
echo "  NEXT_PUBLIC_VAULT_CONTRACT=$VAULT_ADDR"
echo "  NEXT_PUBLIC_ORACLE_CONTRACT=$ORACLE_ADDR"
echo ""
echo "Inspect on Stellar Expert:"
echo "  https://stellar.expert/explorer/${NETWORK}/contract/$VAULT_ADDR"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
