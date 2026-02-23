# OSPM (Open Source Prediction Market) - Project Roadmap

> **Version:** 2.0  
> **Last Updated:** February 2026  
> **Network:** Base Sepolia (Testnet) → Base Mainnet (Production)  

---

## Vision

OSPM is an open-source prediction market platform that provides a seamless "Web2" experience while leveraging "Web3" rails. Users can sign up and place predictions in under 30 seconds without ever purchasing ETH or managing seed phrases.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER LAYER                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Google    │  │    Email    │  │    Phone    │  │   Passkey   │        │
│  │   OAuth     │  │    Auth     │  │    Auth     │  │  (FaceID)   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         └────────────────┴────────────────┴────────────────┘                │
│                                    │                                         │
│                            ┌───────▼───────┐                                │
│                            │    PRIVY      │                                │
│                            │  (Auth Layer) │                                │
│                            └───────┬───────┘                                │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│            ospm-frontend repo (Vercel via GitHub)                           │
│                            ┌───────▼───────┐                                │
│                            │  Next.js 15   │                                │
│                            │  (Frontend)   │                                │
│                            └───────┬───────┘                                │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│            ospm-services repo (AWS Lightsail VPS)                           │
│                            ┌───────▼───────┐                                │
│                            │    Oracle     │                                │
│                            │   Service     │◄──── Market Lifecycle          │
│                            │  (Node.js)    │      Orchestrator              │
│                            └───────┬───────┘                                │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         │                          │                          │             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐       │
│  │    Data     │           │ PostgreSQL  │           │   Deploy    │       │
│  │   Service   │           │     DB      │           │  to Chain   │       │
│  │  (Python)   │           │             │           │             │       │
│  └─────────────┘           └─────────────┘           └──────┬──────┘       │
│   HTTP Utility                                               │              │
│   - Scraping                                                 │              │
│   - AI Generation                                            │              │
│   - Outcome Verification                                     │              │
└──────────────────────────────────────────────────────────────┼──────────────┘
                                                               │
┌──────────────────────────────────────────────────────────────┼──────────────┐
│                         BLOCKCHAIN LAYER                      │              │
│    ┌───────────────┐       ┌──────▼──────┐       ┌───────────────┐         │
│    │  CDP Paymaster│◄──────│  Contracts  │──────►│  Base Sepolia │         │
│    │(Gas Sponsor)  │       │ PlayToken   │       │   (Testnet)   │         │
│    └───────────────┘       │ Factory     │       └───────────────┘         │
│                            │ BinaryMarket│                                  │
│                            └─────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15 (App Router) | UI/UX, Market Discovery |
| **Styling** | Tailwind CSS | Responsive Design |
| **Auth** | Privy | Social Login, Embedded Wallets |
| **Wallet** | Coinbase Smart Wallet | Account Abstraction |
| **Web3** | wagmi + viem | Contract Interaction |
| **Oracle Service** | Node.js + TypeScript | Market lifecycle orchestrator |
| **Data Service** | Python + FastAPI | Scraping, AI generation, outcome verification |
| **Database** | PostgreSQL + Prisma | Persistent Storage |
| **Contracts** | Solidity + Foundry | On-chain Logic (LMSR pricing) |
| **Network** | Base Sepolia | Testnet Deployment |
| **Hosting (FE)** | Vercel | Frontend (via GitHub) |
| **Hosting (BE)** | AWS Lightsail | VPS (Oracle, Data Service, DB) |
| **Process Mgmt** | PM2 | Service management on VPS |
| **Reverse Proxy** | nginx | SSL termination, routing |

---

## Repository Structure

**ospm-services** (Backend Monorepo) → AWS Lightsail VPS

```
ospm-services/
├── contracts/                    # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── PlayToken.sol
│   │   ├── MarketFactory.sol
│   │   ├── BinaryMarket.sol
│   │   └── LMSR.sol
│   ├── script/
│   ├── test/
│   └── foundry.toml
├── oracle/                       # Node.js orchestrator service
│   ├── src/
│   │   ├── index.ts
│   │   ├── server/               # REQUEST-DRIVEN (User Input)
│   │   ├── orchestrator/         # TIME-DRIVEN (Passage of Time)
│   │   └── shared/               # Used by both drivers
│   ├── prisma/
│   └── package.json
├── data-service/                 # Python HTTP utility service
│   ├── main.py
│   ├── crawler/
│   ├── generator/
│   ├── verifier/
│   └── requirements.txt
├── scripts/
│   ├── dev-setup.sh
│   └── deploy.sh
├── .github/workflows/
│   └── deploy-staging.yml
└── env.example
```

**ospm-frontend** (Separate Repo) → Vercel via GitHub

```
ospm-frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   ├── markets/[address]/
│   ├── dashboard/
│   └── api/
├── components/
│   ├── auth/
│   ├── market/
│   ├── trading/
│   └── wallet/
├── hooks/
├── lib/
└── package.json
```

---

## Stages Overview

The project is split into 8 stages. Stage 1 is complete. Each subsequent stage is independently implementable and testable.

| Stage | Name | Status | Description |
|-------|------|--------|-------------|
| [1](stages/STAGE_1.md) | Data Pipeline & Core Services | ✅ COMPLETE | Data Service, Oracle API, basic frontend |
| [2](stages/STAGE_2.md) | Smart Contracts | 🔲 TODO | PlayToken, LMSR, BinaryMarket, MarketFactory |
| [3](stages/STAGE_3.md) | Oracle Blockchain Integration | 🔲 TODO | Connect oracle to chain, deploy markets on-chain |
| [4](stages/STAGE_4.md) | Frontend Auth & Wallet | 🔲 TODO | Privy, Smart Wallet, protected routes |
| [5](stages/STAGE_5.md) | Frontend Trading Experience | 🔲 TODO | Market detail, trading panel, real-time odds |
| [6](stages/STAGE_6.md) | Market Lifecycle Automation | 🔲 TODO | Verification, auto-resolution, paymaster |
| [7](stages/STAGE_7.md) | Dashboard & Polish | 🔲 TODO | User dashboard, notifications, UX refinement |
| [8](stages/STAGE_8.md) | Production Deployment | 🔲 TODO | VPS, nginx, SSL, monitoring |

---

## Data Flow (End-to-End)

```
1. SCRAPING (Data Service)
   Crawl sources (NPFL, Punch, BBC) → Extract events

2. AI GENERATION (Data Service)
   Events → GPT-4 → Market proposals

3. MARKET CREATION (Oracle)
   Proposals → Deploy on-chain → Store in DB

4. MARKET DISPLAY (Frontend)
   DB → API → Next.js → User sees markets

5. TRADING (Frontend + Blockchain)
   User → Approve tokens → Place bet → LMSR prices update

6. RESOLUTION (Oracle + Data Service)
   Time passes → Verify outcome → Propose resolution → Finalize

7. SETTLEMENT (Blockchain)
   Winners → Claim winnings → Tokens transferred
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pricing model | LMSR | Guaranteed liquidity, bounded risk, industry standard |
| Auth | Privy | Social login + embedded wallets, no seed phrases |
| Gas | CDP Paymaster | Users never need ETH |
| Currency | $PLAY token | Play money, free via faucet |
| Oracle architecture | Two drivers (Server + Orchestrator) | Clean separation of concerns |
| Data Service | Separate Python service | Best libraries for scraping/AI |
| Contract upgradeability | None (testnet) | Simple redeploy, MVP approach |

---

## Agent Development Protocol

Each stage is designed to be built by an AI agent iteratively. The agent should:

1. **Read the stage document** to understand scope and requirements
2. **Implement the code** following the specifications
3. **Run tests** using the verification methods specified in each stage
4. **Use browser automation** to verify frontend changes visually
5. **Make API requests** to verify backend endpoints
6. **Iterate** until all completion criteria pass

### Verification Tools Available to Agent

| Tool | Usage |
|------|-------|
| **Shell commands** | Run tests, curl endpoints, check health |
| **Browser automation** | Navigate frontend, verify UI rendering, test interactions |
| **API requests** | Test REST endpoints, verify response shapes |
| **Forge tests** | Run smart contract test suites |
| **Database queries** | Verify data persistence via Prisma |
| **Chain interaction** | Read contract state via cast/viem |

---

## Environment Variables

```env
# Blockchain
CHAIN_ID=84532
RPC_URL=https://sepolia.base.org
ORACLE_PRIVATE_KEY=

# Contracts (fill after Stage 2 deployment)
PLAY_TOKEN_ADDRESS=
MARKET_FACTORY_ADDRESS=

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ospm

# Data Service
DATA_SERVICE_URL=http://localhost:8000
OPENAI_API_KEY=

# Oracle API
PORT=3001
FRONTEND_URL=https://yourdomain.com

# Auth (Privy)
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=

# Paymaster (CDP)
PAYMASTER_URL=
CDP_API_KEY=

# Notifications
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
```
