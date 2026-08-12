# DataPulse — Data Center Intelligence Platform

Map, verify, and invest in global data center infrastructure. Crowdsourced data from local experts, verified on-chain, accessible to everyone.

> **Getting started?** See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for step-by-step setup, testing, and deployment instructions.

## Architecture

```
MVP/
├── data_centers/       # Foundry smart contracts
│   ├── src/
│   │   ├── DataCenterRegistry.sol
│   │   ├── ClaimVerification.sol
│   │   └── StakeManager.sol
│   ├── script/Deploy.s.sol
│   ├── test/ClaimVerification.t.sol
│   └── foundry.toml
├── backend/            # NestJS API
│   ├── src/
│   │   ├── auth/           # JWT + wallet auth
│   │   ├── users/          # User management
│   │   ├── data-centers/   # DC CRUD + GeoJSON
│   │   ├── claims/         # Claim lifecycle + BullMQ
│   │   ├── disputes/       # Dispute resolution
│   │   ├── staking/        # Stake tracking
│   │   ├── blockchain/     # Ethers.js integration
│   │   └── map/            # Map data endpoints
│   └── docker-compose.yml
├── frontend/           # Next.js 15 App Router
│   └── src/
│       ├── app/
│       │   ├── (auth)/       # Login, Register
│       │   └── (dashboard)/  # Map, DCs, Claims, Verify, Disputes, Profile
│       ├── components/ui/    # shadcn/ui primitives
│       ├── lib/              # API client, utils
│       ├── stores/           # Zustand stores
│       └── types/            # TypeScript types
└── .env.example
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Smart Contracts** | Solidity, Foundry, USDC (ERC-20) |
| **Backend** | NestJS 11, TypeORM, PostgreSQL 16, BullMQ + Redis 7, Ethers.js v6 |
| **Frontend** | Next.js 15, React 19, Tailwind CSS v4, MapLibre GL JS, Zustand, TanStack Query, Framer Motion |
| **Auth** | JWT + EIP-712 wallet signature |

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [PostgreSQL](https://www.postgresql.org/download/) 14+ (installed locally)
- [Foundry](https://getfoundry.sh/) (for smart contracts)

> See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed step-by-step instructions.

### 1. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env — fill in DATABASE_PASSWORD, JWT_SECRET, etc.

cd ../frontend
cp .env.example .env.local
```

### 2. Set up PostgreSQL

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE data_centers;"
```

### 3. Deploy smart contracts (local)

```bash
# Terminal 1: Start local blockchain
anvil

# Terminal 2: Deploy
cd data_centers
forge build
forge script script/Deploy.s.sol --broadcast --rpc-url http://127.0.0.1:8545

# Copy addresses from deployed-addresses.json to backend/.env and frontend/.env.local
```

### 4. Start backend

```bash
cd backend
npm install
npm run start:dev
```

Backend runs on `http://localhost:3001` with Swagger docs at `/api/docs`.

### 5. Start frontend

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
Optimistic oracle pattern:
1. **Submit** — Contributor submits a claim with USDC stake
2. **Attest** — Verifier reviews and attests with a larger stake
3. **Challenge** — Challenger disputes within 7-day window
4. **Finalize** — Auto-finalizes after challenge window if no dispute
5. **Resolve** — Arbitrator resolves disputes, slashes loser's stake

### StakeManager
USDC escrow: deposit, withdraw, lock for claims, release, slash, reward.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register with email + password |
| POST | `/auth/login` | Login with email + password |
| POST | `/auth/wallet-login` | Login with wallet signature |
| GET | `/data-centers` | List data centers (filter, paginate) |
| GET | `/data-centers/:id` | Data center detail |
| GET | `/data-centers/geojson` | GeoJSON for map |
| POST | `/claims` | Submit a claim |
| GET | `/claims` | List claims |
| POST | `/claims/:id/attest` | Attest a claim |
| POST | `/claims/:id/challenge` | Challenge a claim |
| GET | `/disputes` | List disputes |
| GET | `/map/geojson` | Map GeoJSON data |
| GET | `/users/me` | Current user profile |
| GET | `/staking/me/stats` | Staking statistics |

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with hero and features |
| `/login` | Sign in (email or wallet) |
| `/register` | Create account |
| `/map` | Full-screen MapLibre map with data center pins |
| `/data-centers` | Browse data centers with filters |
| `/data-centers/[id]` | Data center detail with claims history |
| `/claims` | Your submitted claims |
| `/claims/submit` | Submit a new claim |
| `/verify` | Review and attest/challenge pending claims |
| `/disputes` | Active and resolved disputes |
| `/profile` | User profile, reputation, staking stats |

## Staking Economics

| Role | Stake Amount | Reward | Risk |
|------|-------------|--------|------|
| Contributor | $20–50 USDC | 50% of stake on finalization | Stake slashed if claim is incorrect |
| Verifier | $200–500 USDC | 25% of contributor stake | Stake slashed if attested claim is incorrect |
| Challenger | $300–1000 USDC | Winner takes loser's stake | Stake slashed if challenge fails |

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
