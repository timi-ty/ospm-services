# OSPM Technical Summary

## Architecture Decision: LMSR over Simple Pools

The ROADMAP was updated to use **LMSR (Logarithmic Market Scoring Rule)** instead of simple pool ratios for prediction market pricing.

**Why LMSR:**
- Guaranteed liquidity at all price levels
- Manipulation resistant (bounded price movement per bet)
- Bounded platform risk: `max_loss = b × ln(2)`
- Used by Polymarket, Augur, Gnosis

**LMSR State:**
- `b` - liquidity parameter (default: 100)
- `qYes` - outstanding YES shares
- `qNo` - outstanding NO shares
- Prices computed: `pYes = exp(qYes/b) / (exp(qYes/b) + exp(qNo/b))`

## Schema Changes

### Oracle Prisma Schema (`oracle/prisma/schema.prisma`)
```prisma
model Market {
  // ... core fields ...
  b                 Float    @default(100)
  qYes              Float    @default(0)
  qNo               Float    @default(0)
  resolvedOutcome   Boolean?
  bets              Bet[]
}

model Bet {
  id          String   @id @default(cuid())
  marketId    String
  visitorId   String?  // Cookie-based for anonymous users
  outcome     Boolean  // true=YES, false=NO
  shares      Float    // LMSR shares
  costBasis   Float    // Tokens spent
  market      Market   @relation(...)
}
```

## Seed Script

`oracle/prisma/seed.ts` creates the permanent OSPM market:
- **Question:** "Will OSPM hit 1M trades?"
- **sourceUrl:** https://ospm.waterleaf.ai/
- **bettingClosesAt:** 8 months from seed
- **resolvesAt:** 14 months from seed
- **category:** "meta"
- **b:** 100 (LMSR liquidity)

Run via: `npm run db:seed`

## Scripts

### `scripts/dev-setup.sh` (macOS local dev)
- Requires: Node.js, Python 3.11, PostgreSQL
- Creates `ospm` database
- Sets up Python venv with Playwright Firefox
- Runs Prisma migrations + seed
- Creates `.env` from `env.example`

### `scripts/deploy.sh` (idempotent, works fresh or existing)
- Installs prerequisites if missing (Node 20, Python 3.11, PostgreSQL, PM2, nginx)
- Creates DB user/database
- Deploys Data Service + Oracle
- Starts with PM2

## Environment

`env.example`:
```env
DATABASE_URL=postgresql://localhost:5432/ospm
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4-turbo-preview
AI_MAX_TOKENS_OVERRIDE=25000
PORT=3001
DATA_SERVICE_URL=http://localhost:8000
```

## Python Version

Pinned to **Python 3.11** (required for `str | None` union syntax).

macOS: `brew install python@3.11`
Linux: Installed from deadsnakes PPA

## ROADMAP Sections Updated

- **5.2** - BinaryMarket.sol with LMSR + LMSR.sol library
- **5.3** - MarketFactory with `_liquidityParameter`
- **5.8** - Data flow table (b, qYes, qNo instead of pools)
- **7.3** - Database schema with LMSR fields + Bet model

## Next Steps

1. Run `./scripts/dev-setup.sh`
2. Start Data Service: `cd data-service && source venv/bin/activate && python main.py`
3. Start Oracle: `cd oracle && npm run dev`
4. Test: `curl http://localhost:8000/health` and `curl http://localhost:3001/health`
