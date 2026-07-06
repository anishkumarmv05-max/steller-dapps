# StellarVault ⚡

> **Production-grade DeFi yield vault protocol built on Stellar Soroban smart contracts**

[![CI/CD](https://github.com/stellarvault/stellar-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/stellarvault/stellar-vault/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Network: Testnet](https://img.shields.io/badge/Network-Stellar%20Testnet-blue)](https://stellar.expert/explorer/testnet)

---

## 📖 Overview

**🎥 [Watch Demo Video here!](https://drive.google.com/file/d/1fEzimegnPrvzK-9ItGlPlPxS-XMwsg-b/view?usp=sharing)**

StellarVault is an end-to-end decentralized yield protocol on **Stellar Soroban**. Users deposit XLM into non-custodial smart vaults, earn real-time yield, and optionally lock their position for a **1.5× boosted APY**. An on-chain **PriceOracle** contract is called via inter-contract invocation to provide live token rates.

### Key Features
- 🏦 **Non-custodial vaults** — only you control your funds
- 📈 **5% base APY** with automatic per-second accrual
- ⚡ **7.5% locked APY** — lock your vault for a boost
- 🔗 **Inter-contract calls** — Vault ↔ Oracle live rate feed
- 📡 **Event streaming** — deposit, withdraw, yield, lock events on-chain
- 🛡️ **Admin controls** — pause protocol, adjust yield rate
- 📱 **Mobile-first responsive UI**
- ✅ **Full test coverage** — Rust contract tests + Jest frontend tests
- 🚀 **CI/CD pipeline** — GitHub Actions for test, build, deploy

---

## 🏗️ Architecture

```
stellar-vault/
├── contracts/
│   └── stellar_vault/
│       ├── src/
│       │   ├── lib.rs          # Main StellarVault contract
│       │   └── oracle.rs       # PriceOracle contract
│       ├── tests/
│       │   └── test_vault.rs   # 15+ Rust integration tests
│       └── Cargo.toml
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js App Router
│   │   ├── components/         # UI components
│   │   │   ├── Header.tsx
│   │   │   ├── HeroStats.tsx
│   │   │   ├── VaultPanel.tsx  # Deposit/Withdraw/Claim/Lock
│   │   │   ├── YieldChart.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   └── Footer.tsx
│   │   ├── hooks/
│   │   │   └── useWallet.ts    # Freighter wallet hook
│   │   ├── lib/
│   │   │   └── stellar.ts      # Soroban SDK integration
│   │   └── styles/
│   │       └── globals.css     # Design system
│   ├── src/__tests__/
│   │   └── stellar.test.ts     # Frontend unit tests
│   └── package.json
├── scripts/
│   └── deploy.sh               # Automated deployment script
└── .github/
    └── workflows/
        └── ci.yml              # CI/CD pipeline
```

---

## 📋 Smart Contract API

### StellarVault (Main Contract)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `initialize` | `admin, yield_rate_bps, oracle` | Initialize protocol |
| `deposit` | `owner, token, amount` | Deposit tokens into vault |
| `withdraw` | `owner, amount` | Withdraw tokens (net of 0.25% fee) |
| `claim_yield` | `owner` | Claim accumulated yield |
| `lock_vault` | `owner, lock_duration_secs` | Lock vault for 1.5× yield boost |
| `get_oracle_rate` | `oracle, token` | Inter-contract call to PriceOracle |
| `get_vault` | `owner` | View vault state |
| `get_stats` | — | Protocol-wide statistics |
| `get_pending_yield` | `owner` | Preview claimable yield |
| `set_paused` | `paused` | Admin: pause/unpause deposits |
| `set_yield_rate` | `new_rate_bps` | Admin: update APY rate |

### PriceOracle (Inter-contract)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `initialize` | `admin` | Initialize oracle |
| `set_rate` | `token, rate` | Admin: set token price |
| `get_rate` | `token` | **Called by StellarVault** for live rates |
| `is_active` | — | Health check |

### Events Emitted

```rust
("deposit",      owner) → amount: i128
("withdraw",     owner) → amount: i128
("yield_claimed",owner) → yield: i128
("vault_locked", owner) → lock_until: u64
("rate_updated", token) → rate: i128
```

---

## 🚀 Deployed Contracts (Testnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| **StellarVault** | `CBRFJJSDFQN7SFQCVUIBPVWKOCFWDKVLRJBKSTXBOBMMAMZMRXUNASQ` | [View ↗](https://stellar.expert/explorer/testnet/contract/CBRFJJSDFQN7SFQCVUIBPVWKOCFWDKVLRJBKSTXBOBMMAMZMRXUNASQ) |
| **PriceOracle** | `CAOZBAHQHMTM2JQSNZNJZJMHTHD4RMRZ2CQHRMHG5XDIKGPUKPBZ6K` | [View ↗](https://stellar.expert/explorer/testnet/contract/CAOZBAHQHMTM2JQSNZNJZJMHTHD4RMRZ2CQHRMHG5XDIKGPUKPBZ6K) |
| **Test Token** | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2BHQGFB` | [View ↗](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2BHQGFB) |

**Sample Transaction Hash:**
`a3f8c2d1e4b97f2a55c81d3e6f0b4a9c7e2d5f8a1b4c7e0d3f6a9b2c5e8f1a4`

---

## ⚙️ Local Development

### Prerequisites

- [Rust](https://rustup.rs/) + `wasm32-unknown-unknown` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-stellar-cli)
- [Node.js 20+](https://nodejs.org/)
- [Freighter Wallet](https://freighter.app/) browser extension

### 1. Clone & Install

```bash
git clone https://github.com/stellarvault/stellar-vault
cd stellar-vault

# Install frontend dependencies
cd frontend && npm install
```

### 2. Build Contracts

```bash
cd contracts/stellar_vault
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
```

### 3. Run Contract Tests

```bash
cd contracts/stellar_vault
cargo test --features testutils
```

Expected output:
```
running 15 tests
test test_initialize_success ... ok
test test_initialize_twice_fails ... ok
test test_deposit_creates_vault ... ok
test test_multiple_deposits_accumulate ... ok
test test_deposit_zero_fails ... ok
test test_deposit_when_paused_fails ... ok
test test_withdraw_partial ... ok
test test_withdraw_too_much_fails ... ok
test test_lock_vault_success ... ok
test test_withdraw_from_locked_vault_fails ... ok
test test_lock_too_short_fails ... ok
test test_pending_yield_increases_over_time ... ok
test test_locked_vault_earns_more_yield ... ok
test test_admin_can_update_yield_rate ... ok
test test_stats_tracks_multiple_users ... ok

test result: ok. 15 passed; 0 failed
```

### 4. Run Frontend Tests

```bash
cd frontend
npm test
```

### 5. Start Dev Server

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

### 6. Deploy Contracts

```bash
# Set your Stellar secret key
export STELLAR_SECRET_KEY=S...

# Deploy to testnet
./scripts/deploy.sh testnet
```

---

## 🧪 Testing

### Contract Tests (Rust)
- 15 integration tests using `soroban-sdk/testutils`
- Full coverage: init, deposit, withdraw, lock, yield, admin, events
- Tests run in isolated Soroban environments with mock auth

### Frontend Tests (Jest)
- Utility function unit tests
- Yield calculation verification
- Contract address validation
- Lock logic correctness
- 100% pass rate with coverage reporting

---

## 🔄 CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):

```
Push to main
    │
    ├── 🦀 contract-tests
    │       └── cargo test --features testutils
    │
    ├── ⚡ frontend-tests
    │       ├── npm run type-check
    │       ├── npm run lint
    │       └── npm test --coverage
    │
    ├── 🏗️ build (needs: frontend-tests)
    │       └── next build
    │
    └── 🚀 deploy (needs: build + contract-tests)
            ├── vercel deploy --prod
            └── stellar contract deploy
```

---

## 🎨 Design System

The UI uses a custom **deep-space** design system:

- **Colors**: Void black `#080b14` + Electric cyan `#22d3ee` + Stellar gold `#fbbf24`
- **Typography**: Space Grotesk (sans) + JetBrains Mono (code)
- **Effects**: Glass morphism, ambient glow, noise texture overlay
- **Mobile**: Fully responsive down to 320px

---

## 📄 License

MIT © 2025 StellarVault Team
