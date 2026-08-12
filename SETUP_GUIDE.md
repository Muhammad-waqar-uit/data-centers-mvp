# DataPulse — Setup, Testing & Deployment Guide

No Docker needed. Uses Supabase for the database (or local PostgreSQL) and Anvil for the local blockchain.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Set Up Database (Supabase or Local)](#2-set-up-database-supabase-or-local)
3. [Set Up Environment Files](#3-set-up-environment-files)
4. [Smart Contracts — Test & Deploy](#4-smart-contracts--test--deploy)
5. [Backend — Run & Test](#5-backend--run--test)
6. [Frontend — Run & Preview UI](#6-frontend--run--preview-ui)
7. [End-to-End Testing Flow](#7-end-to-end-testing-flow)
8. [Deploy to Testnet (Ethereum Sepolia)](#8-deploy-to-testnet-ethereum-sepolia)
9. [Environment Variable Reference](#9-environment-variable-reference)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | 20+ | https://nodejs.org/ |
| **npm** | 10+ | Comes with Node.js |
| **Supabase** | Free tier | https://supabase.com/ (or see local PG below) |
| **Foundry** (forge, anvil, cast) | Latest | `curl -L https://foundry.paradigm.xyz \| bash` then `foundryup` |
| **Git** | Latest | https://git-scm.com/ |

Verify:

```bash
node --version        # v20.x+
npm --version         # 10.x+
forge --version       # latest
anvil --version       # latest
```

---

## 2. Set Up Database (Supabase or Local)

### Option A — Supabase (Recommended for MVP)

1. Go to https://supabase.com/ and create a free project
2. Wait for the project to initialize (~2 minutes)
3. Get your connection string:
   - Dashboard → **Settings** → **Database** → **Connection string**
   - Select **Transaction** pooler mode (port 6543)
   - Copy the connection string — it looks like:
     ```
     postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
     ```
4. Paste it into `DATABASE_URL` in your `backend/.env`

That's it — Supabase auto-creates tables via TypeORM `synchronize: true` in development mode.

### Option B — Local PostgreSQL

If you prefer running PostgreSQL locally:

**Windows:**
1. Download from https://www.postgresql.org/download/windows/
2. During setup: port **5432**, password **postgres**
3. Create the database:
   ```bash
   psql -U postgres -c "CREATE DATABASE data_centers;"
   ```

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb data_centers
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE DATABASE data_centers;"
```

Then set the individual `DATABASE_HOST/PORT/USER/PASSWORD/NAME` vars in `backend/.env` (leave `DATABASE_URL` empty).

---

## 3. Set Up Environment Files

### Backend `.env`

The `backend/.env` file is already created. Just paste your Supabase connection string:

Open `backend/.env` and set `DATABASE_URL`:

```env
PORT=3001
NODE_ENV=development

# Paste your Supabase connection string here
# (from Supabase Dashboard → Settings → Database → Connection string → Transaction pooler)
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres

# Redis is optional — leave empty to skip
# REDIS_HOST=localhost
# REDIS_PORT=6379

JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRATION=7d
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
CLAIM_VERIFICATION_CONTRACT_ADDRESS=
DATA_CENTER_REGISTRY_CONTRACT_ADDRESS=
STAKE_MANAGER_CONTRACT_ADDRESS=
JUROR_COURT_CONTRACT_ADDRESS=
OOV3_ADDRESS=0xFd9e2642a170aDD10F53Ee14a93FcF2F31924944
USDC_CONTRACT_ADDRESS=
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CORS_ORIGINS=http://localhost:3000
```

> **Using local PostgreSQL instead?** Leave `DATABASE_URL` empty and uncomment the `DATABASE_HOST/PORT/USER/PASSWORD/NAME` lines below it.

> **Redis is optional.** If you leave `REDIS_HOST` empty, the backend runs fine — only claim auto-finalization (BullMQ) is disabled.

### Frontend `.env.local`

```bash
cd frontend
cp .env.example .env.local
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_MAPLIBRE_STYLE=https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CLAIM_VERIFICATION_CONTRACT=
NEXT_PUBLIC_DATA_CENTER_REGISTRY_CONTRACT=
NEXT_PUBLIC_STAKE_MANAGER_CONTRACT=
NEXT_PUBLIC_JUROR_COURT_CONTRACT=
NEXT_PUBLIC_USDC_CONTRACT=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

> `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is optional — injected wallets (MetaMask etc.) work without it; get a free id at cloud.walletconnect.com for WalletConnect QR support.

### Contracts `.env`

```bash
cd data_centers
```

Create `data_centers/.env`:

```env
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC_URL=http://127.0.0.1:8545
ETHERSCAN_API_KEY=
USDC_ADDRESS=0x0000000000000000000000000000000000000001
OOV3_ADDRESS=0xFd9e2642a170aDD10F53Ee14a93FcF2F31924944
```

> The private key above is Anvil's first pre-funded test account (must include the `0x` prefix). Never use it on mainnet.
> `OOV3_ADDRESS` is UMA's OptimisticOracleV3 on Ethereum Sepolia. For local Anvil runs, point it at a deployed `MockOOV3` (see `test/mocks/Mocks.sol`) instead.

---

## 4. Smart Contracts — Test & Deploy

### Terminal 1 — Start Anvil (local blockchain)

```bash
anvil
```

Keep this running. It starts a local Ethereum node on `http://127.0.0.1:8545` with 10 pre-funded accounts (each 10,000 ETH).

Anvil's first account:
- **Private key**: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- **Address**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

### Terminal 2 — Test contracts

```bash
cd data_centers

# Compile
forge build

# Run all tests
forge test

# Run with verbose output
forge test -vvv

# Run specific test
forge test --match-path test/ClaimVerification.t.sol -vvv
```

**Expected**: All 26 tests pass (ClaimVerification: submit → attest → settle happy path, challenge → jury rulings, UMA dispute routing; JurorCourt: register/draw/vote/resolve/slash).

### Deploy to local Anvil

```bash
cd data_centers

forge script script/Deploy.s.sol \
  --broadcast \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

This deploys all 4 contracts (DataCenterRegistry, StakeManager, JurorCourt, ClaimVerification), wires authorizations between them, and writes addresses to `data_centers/deployed-addresses.json`:

```json
{
  "DataCenterRegistry": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "StakeManager": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "JurorCourt": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  "ClaimVerification": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  "USDC": "0x0000000000000000000000000000000000000001"
}
```

### Copy addresses to .env files

Open `data_centers/deployed-addresses.json` and paste the addresses:

**`backend/.env`**:
```env
CLAIM_VERIFICATION_CONTRACT_ADDRESS=<ClaimVerification address>
DATA_CENTER_REGISTRY_CONTRACT_ADDRESS=<DataCenterRegistry address>
STAKE_MANAGER_CONTRACT_ADDRESS=<StakeManager address>
JUROR_COURT_CONTRACT_ADDRESS=<JurorCourt address>
USDC_CONTRACT_ADDRESS=<USDC address>
```

**`frontend/.env.local`**:
```env
NEXT_PUBLIC_CLAIM_VERIFICATION_CONTRACT=<ClaimVerification address>
NEXT_PUBLIC_DATA_CENTER_REGISTRY_CONTRACT=<DataCenterRegistry address>
NEXT_PUBLIC_STAKE_MANAGER_CONTRACT=<StakeManager address>
NEXT_PUBLIC_JUROR_COURT_CONTRACT=<JurorCourt address>
NEXT_PUBLIC_USDC_CONTRACT=<USDC address>
```

> **Your addresses will differ** — always copy from the actual output file.

---

## 5. Backend — Run & Test

### Terminal 3 — Start the backend

```bash
cd backend

# Install dependencies (first time only)
npm install

# Start with hot-reload
npm run start:dev
```

Backend starts on **http://localhost:3001**.

### Verify it's running

Open Swagger docs in your browser: **http://localhost:3001/api/docs**

Or test with curl:

```bash
# Register
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@datapulse.io\",\"password\":\"password123\",\"displayName\":\"Test User\"}"

# Login (save the token)
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@datapulse.io\",\"password\":\"password123\"}"

# Use the token for authenticated requests
TOKEN="<paste your token>"

curl http://localhost:3001/api/v1/data-centers \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:3001/api/v1/map/geojson
```

### Run backend tests

```bash
cd backend
npm run test           # unit tests
npm run test:watch     # watch mode
npm run test:cov       # coverage
```

---

## 6. Frontend — Run & Preview UI

### Terminal 4 — Start the frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Frontend runs on **http://localhost:3000**.

### Quick UI preview (no backend needed)

All pages have built-in sample data that renders when the backend isn't connected. You can preview the entire UI by just running the frontend:

```bash
cd frontend && npm install && npm run dev
# Open http://localhost:3000
```

### Pages to check

| URL | What to look for |
|-----|-----------------|
| `http://localhost:3000` | Landing page — dark hero, animated stats, feature cards |
| `http://localhost:3000/login` | Login — email/password + "Connect Wallet" |
| `http://localhost:3000/register` | Register — name, email, password, wallet option |
| `http://localhost:3000/map` | MapLibre map — 6 sample pins (green/yellow/blue/red) |
| `http://localhost:3000/data-centers` | Card grid — search + status/country filters |
| `http://localhost:3000/data-centers/1` | Detail — info cards, claims history |
| `http://localhost:3000/claims` | My Claims — live on-chain status badges, timeline, Settle button |
| `http://localhost:3000/claims/submit` | Submit form — upload proof → wallet tx → backend mirror |
| `http://localhost:3000/verify` | Verifier dashboard — attest/challenge via wallet |
| `http://localhost:3000/disputes` | Jury & Disputes — drawn panels, vote, resolve, results |
| `http://localhost:3000/stake` | Stake — deposit/withdraw USDC, juror registration |
| `http://localhost:3000/profile` | Profile — avatar, reputation, staking overview |

### Map pin colors

- **Green** = Operating
- **Yellow** = Under Construction
- **Blue** = Planned
- **Red** = Stalled

Click any pin to see the data center popup with details and action buttons.

### Build for production

```bash
cd frontend
npm run build
npm start
```

---

## 7. End-to-End Testing Flow

Test the full wallet-driven claim lifecycle: **deposit → submit → attest → settle** (happy path) and **challenge → jury vote → resolve** (dispute path). Use two browser wallets (e.g. MetaMask account A and B) on Sepolia.

### Happy path

1. **Wallet A** — open `/stake`, approve + deposit ~50 USDC into StakeManager
2. **Wallet A** — open `/claims/submit`, pick a data center + fact, attach a proof file, sign the `submitClaim` transaction (locks 20 USDC)
3. **Wallet B** — open `/stake`, deposit ~700 USDC (verifier stake + UMA bond)
4. **Wallet B** — open `/verify`, click **Attest** on the pending claim (locks 200 USDC + pulls the OOV3 bond, creates the UMA assertion)
5. Wait for the challenge window to close (owner can call `updateParameters` on ClaimVerification to shorten it for demos)
6. **Wallet A** — open `/claims`, click **Settle & Claim Rewards** → stakes released + rewards paid

### Dispute path

1. After step 4 above, **Wallet B** (or a third wallet with ~300 USDC deposited) clicks **Challenge** on `/verify` and enters a reason
2. Register 3 juror wallets on `/stake` (each deposits ≥100 USDC and clicks **Register as Juror**)
3. Open `/disputes` — the drawn panel sees vote buttons; each juror votes **Claim is correct** / **Claim is incorrect**
4. After the voting window, anyone clicks **Resolve & Execute Ruling** → majority side wins, payouts execute, minority jurors slashed
5. Check `/claims` — status flips to Finalized (claim upheld) or Rejected (claim incorrect)

---

## 8. Deploy to Testnet (Ethereum Sepolia)

### Get testnet funds

- Sepolia ETH: https://sepoliafaucet.com/ or https://www.alchemy.com/faucets/sepolia
- Sepolia USDC (Circle testnet): https://faucet.circle.com/ — the verifier needs ≥ 600 USDC (200 stake + ~400 OOV3 bond); jurors need ≥ 100 each

### Key Sepolia addresses

| Contract | Address |
|----------|---------|
| UMA OptimisticOracleV3 | `0xFd9e2642a170aDD10F53Ee14a93FcF2F31924944` |
| USDC (Circle testnet) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

### Update contracts `.env`

```env
PRIVATE_KEY=0xYourPrivateKeyHere
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key
USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
OOV3_ADDRESS=0xFd9e2642a170aDD10F53Ee14a93FcF2F31924944
```

### Deploy

```bash
cd data_centers

forge script script/Deploy.s.sol \
  --broadcast \
  --rpc-url $RPC_URL \
  --verify
```

### Update backend + frontend

Copy addresses from `deployed-addresses.json` into:
- `backend/.env` → `CLAIM_VERIFICATION_CONTRACT_ADDRESS`, `DATA_CENTER_REGISTRY_CONTRACT_ADDRESS`, `STAKE_MANAGER_CONTRACT_ADDRESS`, `JUROR_COURT_CONTRACT_ADDRESS`, `USDC_CONTRACT_ADDRESS`
- `frontend/.env.local` → `NEXT_PUBLIC_CLAIM_VERIFICATION_CONTRACT`, `NEXT_PUBLIC_DATA_CENTER_REGISTRY_CONTRACT`, `NEXT_PUBLIC_STAKE_MANAGER_CONTRACT`, `NEXT_PUBLIC_JUROR_COURT_CONTRACT`, `NEXT_PUBLIC_USDC_CONTRACT`
- `frontend/.env.local` → `NEXT_PUBLIC_CHAIN_ID=11155111`

---

## 9. Environment Variable Reference

### Smart Contracts (`data_centers/.env`)

| Variable | Required | Local Value |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` (Anvil #1, keep the `0x` prefix) |
| `RPC_URL` | Yes | `http://127.0.0.1:8545` |
| `ETHERSCAN_API_KEY` | No | Get from etherscan.org |
| `USDC_ADDRESS` | Yes | `0x0000000000000000000000000000000000000001` (mock for Anvil) |
| `OOV3_ADDRESS` | Yes | UMA OOV3 on Sepolia, or a MockOOV3 address on Anvil |

### Backend (`backend/.env`)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PORT` | No | `3001` | API port |
| `DATABASE_URL` | **Yes**\* | — | **Supabase connection string (Transaction pooler, port 6543)** |
| `DATABASE_HOST` | \* | `localhost` | Only if `DATABASE_URL` is empty (local PG) |
| `DATABASE_PORT` | \* | `5432` | Only for local PG |
| `DATABASE_USER` | \* | `postgres` | Only for local PG |
| `DATABASE_PASSWORD` | \* | `postgres` | Only for local PG |
| `DATABASE_NAME` | \* | `data_centers` | Only for local PG |
| `REDIS_HOST` | **No** | *(empty)* | **Leave empty to skip Redis entirely** |
| `REDIS_PORT` | No | `6379` | Only if Redis is running |
| `JWT_SECRET` | Yes | — | Any random string, e.g. `dev-secret-key-12345` |
| `JWT_EXPIRATION` | No | `7d` | |
| `BLOCKCHAIN_RPC_URL` | No | — | `http://127.0.0.1:8545` when Anvil runs |
| `CLAIM_VERIFICATION_CONTRACT_ADDRESS` | No | — | From `deployed-addresses.json` |
| `DATA_CENTER_REGISTRY_CONTRACT_ADDRESS` | No | — | From `deployed-addresses.json` |
| `STAKE_MANAGER_CONTRACT_ADDRESS` | No | — | From `deployed-addresses.json` |
| `JUROR_COURT_CONTRACT_ADDRESS` | No | — | From `deployed-addresses.json` |
| `OOV3_ADDRESS` | No | — | UMA OOV3 address (Sepolia: `0xFd9e2642a170aDD10F53Ee14a93FcF2F31924944`) |
| `USDC_CONTRACT_ADDRESS` | No | — | USDC address |
| `DEPLOYER_PRIVATE_KEY` | No | — | For backend contract calls |
| `CORS_ORIGINS` | No | `http://localhost:3000` | |

> \* Set either `DATABASE_URL` (Supabase) OR the individual `DATABASE_*` fields (local PG), not both.

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:3001/api/v1` | |
| `NEXT_PUBLIC_MAPLIBRE_STYLE` | No | Carto dark URL | Free, no key needed |
| `NEXT_PUBLIC_CHAIN_ID` | Yes | `11155111` | Sepolia chain id |
| `NEXT_PUBLIC_CLAIM_VERIFICATION_CONTRACT` | No | — | Contract address |
| `NEXT_PUBLIC_DATA_CENTER_REGISTRY_CONTRACT` | No | — | Contract address |
| `NEXT_PUBLIC_STAKE_MANAGER_CONTRACT` | No | — | Contract address |
| `NEXT_PUBLIC_JUROR_COURT_CONTRACT` | No | — | Contract address |
| `NEXT_PUBLIC_USDC_CONTRACT` | No | — | USDC address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | — | From cloud.walletconnect.com (optional) |

---

## 10. Troubleshooting

### "Cannot find module" errors

Run `npm install` first:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### PostgreSQL connection refused

```bash
# Windows — check if service is running
Get-Service postgresql*

# macOS
brew services list
brew services start postgresql@16

# Linux
sudo systemctl status postgresql
sudo systemctl start postgresql
```

### "database data_centers does not exist" (local PostgreSQL only)

```bash
psql -U postgres -c "CREATE DATABASE data_centers;"
# or
createdb data_centers
```

### Supabase connection refused / SSL error

- Make sure you're using the **Transaction pooler** connection string (port 6543), not the Direct connection (port 5432)
- The connection string format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
- If you get SSL errors, the backend already has `ssl: { rejectUnauthorized: false }` configured for DATABASE_URL connections
- Check that your Supabase project is not paused (free tier pauses after 7 days of inactivity — go to Dashboard to restore)

### Anvil not running / "connection refused" on 8545

```bash
anvil
# Keep this terminal open
```

### Forge build fails

```bash
cd data_centers
forge clean
forge build
```

### Frontend map not loading

- Check browser console (F12)
- MapLibre uses a free Carto style — no API key needed
- Pages render sample data even without backend running

### Backend "Blockchain RPC URL not configured"

That's fine — blockchain features are disabled when `BLOCKCHAIN_RPC_URL` is empty. Set it to `http://127.0.0.1:8545` when running Anvil.

### "BullMQ connection refused" or Redis errors

Leave `REDIS_HOST` empty/commented in `backend/.env`. The backend auto-detects this and skips BullMQ entirely. Only claim auto-finalization is disabled — everything else works.

### Port already in use

```bash
# Windows
netstat -ano | findstr :3001
netstat -ano | findstr :3000

# macOS/Linux
lsof -i :3001
lsof -i :3000
```

### Reset everything

**With Supabase:**
```bash
# Drop all tables via Supabase SQL Editor (Dashboard → SQL Editor):
# DROP SCHEMA public CASCADE; CREATE SCHEMA public;
# Tables will be re-created on next backend start (synchronize: true)

# Clean builds
cd data_centers && forge clean
cd ../backend && rm -rf dist node_modules && npm install
cd ../frontend && rm -rf .next node_modules && npm install

# Restart Anvil, re-deploy contracts, copy addresses, restart backend/frontend
```

**With local PostgreSQL:**
```bash
psql -U postgres -c "DROP DATABASE IF EXISTS data_centers;"
psql -U postgres -c "CREATE DATABASE data_centers;"

cd data_centers && forge clean
cd ../backend && rm -rf dist node_modules && npm install
cd ../frontend && rm -rf .next node_modules && npm install
```
