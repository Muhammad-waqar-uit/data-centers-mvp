# DataPulse — Data Center Intelligence Platform

Contribute data center facts with USDC stakes on-chain. Verifiers attest via UMA's Optimistic Oracle V3, disputes are decided by randomly drawn juror panels — no admins, fully decentralized.

> **Getting started?** See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for step-by-step setup, testing, and deployment instructions.

## Architecture

```
MVP/
├── data_centers/       # Foundry smart contracts
│   ├── src/
│   │   ├── DataCenterRegistry.sol
│   │   ├── ClaimVerification.sol     # UMA OOV3 assertions + jury routing
│   │   ├── JurorCourt.sol            # Kleros-style dispute panels
│   │   ├── StakeManager.sol          # USDC escrow
│   │   └── interfaces/               # OOV3 + IClaimVerification
│   ├── script/Deploy.s.sol
│   ├── test/ClaimVerification.t.sol
│   ├── test/JurorCourt.t.sol
│   └── foundry.toml
├── backend/            # NestJS API (indexing/mirror layer)
│   ├── src/
│   │   ├── auth/           # JWT auth
│   │   ├── users/          # User management + wallet linking
│   │   ├── data-centers/   # DC CRUD + GeoJSON
│   │   ├── claims/         # Mirror of on-chain claim lifecycle
│   │   ├── disputes/       # Dispute records
│   │   ├── staking/        # Stake tracking
│   │   ├── blockchain/     # Ethers.js contract reads
│   │   └── map/            # Map data endpoints
├── frontend/           # Next.js 15 App Router
│   └── src/
│       ├── app/
│       │   ├── (auth)/       # Login, Register
│       │   └── (dashboard)/  # Map, DCs, Claims, Verify, Jury, Stake, Profile
│       ├── hooks/            # useClaims, useStaking (wallet tx hooks)
│       ├── components/ui/    # shadcn/ui primitives
│       ├── lib/              # API client, web3 config, ABIs, contract addresses
│       ├── stores/           # Zustand stores
│       └── types/            # TypeScript types
```

## How Verification Works

1. **Deposit & Submit** — Contributor deposits USDC into StakeManager and submits a claim on-chain (locks 20 USDC). Proof documents upload to the backend for indexing.
2. **Attest** — A verifier stakes 200 USDC and attests. ClaimVerification simultaneously asserts the claim's truth into **UMA OptimisticOracleV3** with a 7-day liveness window (bond pulled from the verifier's deposit).
3. **Happy path** — Nobody disputes → after the window, anyone calls `settleClaim()`: the UMA assertion settles and stakes + rewards pay out. No admin anywhere.
4. **Dispute path** — Anyone can `challengeClaim()` (locks 300 USDC), which creates a **JurorCourt** dispute. 3 jurors are randomly drawn from registered (staked) jurors and vote within 24h. Majority decides; majority voters earn rewards, minority voters are slashed 50%. UMA's permissionless OOV3 dispute route also feeds into the same court.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Smart Contracts** | Solidity, Foundry, USDC (ERC-20), UMA OptimisticOracleV3, custom JurorCourt |
| **Backend** | NestJS 11, TypeORM, PostgreSQL (Supabase), optional BullMQ + Redis, Ethers.js v6 |
| **Frontend** | Next.js 15, React 19, Tailwind CSS v4, wagmi + viem + RainbowKit, MapLibre GL JS, Framer Motion |
| **Network** | Ethereum Sepolia (chain id 11155111) |

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Foundry](https://getfoundry.sh/) (for smart contracts)
- Sepolia ETH + testnet USDC (see [SETUP_GUIDE.md](./SETUP_GUIDE.md))

> See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed step-by-step instructions.

### 1. Configure environment

Fill in `backend/.env` (Supabase `DATABASE_URL`, contract addresses) and `frontend/.env.local` (contract addresses). See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for the full variable reference.

### 2. Deploy contracts (Sepolia)

```bash
cd data_centers
forge build
forge test
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
# Copy addresses from deployed-addresses.json to backend/.env and frontend/.env.local
```

### 3. Start backend

```bash
cd backend
npm install
npm run start:dev
```

Backend runs on `http://localhost:3001` with Swagger docs at `/api/docs`.

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Smart Contracts

### DataCenterRegistry
Stores data center metadata on-chain (name, coordinates, status, owner).

### ClaimVerification
Decentralized optimistic verification (no admin resolution):
1. **Submit** — Contributor locks 20 USDC from their StakeManager deposit
2. **Attest** — Verifier locks 200 USDC; the claim's truth is asserted on UMA OOV3 (bond pulled from verifier deposit) with a 7-day liveness window
3. **Settle** — After the window, anyone calls `settleClaim()`; stakes released + rewards paid (claimer +50%, verifier +25% of stakes)
4. **Challenge** — Challenger locks 300 USDC → creates a JurorCourt dispute; jury majority ruling executes payouts via `executeCourtRuling`

### JurorCourt
Kleros-style mini court: register with ≥100 USDC stake, 3 jurors randomly drawn per dispute (blockhash seed — MVP randomness, documented), 24h voting window, majority rules (ties default to claim), minority slashed 50%, majority shares a treasury reward.

### StakeManager
USDC escrow: deposit, withdraw, lock/release for claims, slash, reward, and `transferFromDeposit` for pulling UMA bonds.

## API Endpoints

The on-chain contracts are canonical; backend claim/dispute endpoints are thin mirrors the frontend calls after each wallet transaction succeeds.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register with email + password |
| POST | `/auth/login` | Login with email + password |
| GET | `/users/me` | Current user profile |
| PATCH | `/users/me/wallet` | Link a wallet address to the account |
| GET | `/data-centers` | List data centers (filter, paginate) |
| GET | `/data-centers/geojson` | GeoJSON for map |
| POST | `/uploads` | Upload a proof document (multipart) |
| POST | `/claims` | Mirror an on-chain claim (`onChainClaimId`, `txHash`) |
| GET | `/claims` | List claims |
| POST | `/claims/:id/attest` | Mirror an attestation |
| POST | `/claims/:id/challenge` | Mirror a challenge |
| GET | `/disputes` | List dispute records |
| GET | `/map/geojson` | Map GeoJSON data |
| GET | `/staking/me/stats` | Staking statistics |

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login`, `/register` | Auth |
| `/map` | Full-screen MapLibre map with data center pins |
| `/data-centers`, `/data-centers/[id]` | Browse / detail with claims history |
| `/claims` | Your claims with live on-chain status + timeline + Settle button |
| `/claims/submit` | Wallet-first flow: upload proof → on-chain tx → mirror |
| `/verify` | Attest / challenge claims via wallet transactions |
| `/disputes` | Jury view: drawn panels, vote (if drawn), resolve, results |
| `/stake` | Deposit/withdraw USDC, juror registration |
| `/profile` | User profile, reputation, staking stats |

## Staking Economics

| Role | Stake Amount | Reward | Risk |
|------|-------------|--------|------|
| Contributor | 20 USDC | +50% of stake on settlement | Stake slashed if jury rejects the claim |
| Verifier | 200 USDC + OOV3 bond | +25% of contributor stake | Stake slashed if jury rejects the claim |
| Challenger | 300 USDC | Winner takes loser-side stake | Stake slashed if challenge fails |
| Juror | 100 USDC (locked) | Share of 30 USDC treasury reward per dispute | 50% of juror stake slashed for minority votes |

## Development

### Run tests (smart contracts)
```bash
cd data_centers
forge test
```

### Run backend tests
```bash
cd backend
npm run test
```

### Build frontend for production
```bash
cd frontend
npm run build
```

## License

MIT
