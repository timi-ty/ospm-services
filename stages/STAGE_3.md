# Stage 3: Oracle Blockchain Integration & Outcome Verification

> **Status:** 🔲 TODO  
> **Repos:** ospm-services (oracle/, data-service/)  
> **Prerequisites:** Stage 2 complete (contracts deployed, addresses in .env)  
> **Depends on:** Stage 2

---

## Objective

Connect the Oracle service to the deployed smart contracts so it can deploy markets on-chain, read on-chain state, and verify market outcomes. Build the outcome verification endpoint in the Data Service.

---

## What to Build

### 3.1 Oracle: Blockchain Client (`oracle/src/shared/blockchain/`)

Create the blockchain integration layer:

```
oracle/src/shared/blockchain/
├── client.ts       # ethers.js provider + oracle wallet
├── contracts.ts    # Contract instances + deploy helper
└── abis/
    ├── PlayToken.json
    ├── BinaryMarket.json
    └── MarketFactory.json
```

**`client.ts`:**
- `provider` — ethers.js JsonRpcProvider connected to Base Sepolia
- `oracleWallet` — ethers.Wallet from `ORACLE_PRIVATE_KEY`, connected to provider

**`contracts.ts`:**
- `marketFactory` — Contract instance for MarketFactory
- `getMarketContract(address)` — Returns BinaryMarket contract instance
- `deployMarket(question, sourceUrl, bettingClose, resolution)` — Calls factory.createMarket(), returns deployed address

**ABIs:** Copy from `contracts/out/` after `forge build` (the JSON artifacts).

### 3.2 Oracle: Enhanced Market Creator (`oracle/src/orchestrator/markets/creator.ts`)

Update the existing market creator tick handler to deploy markets on-chain:

Current flow: Data Service → Store in DB  
New flow: Data Service → Deploy on-chain → Store in DB with contract address

```
1. Call dataServiceClient.generateMarkets()
2. For each proposal:
   a. Calculate bettingCloseTimestamp and resolutionTimestamp
   b. Call deployMarket() on MarketFactory
   c. Store in DB with contractAddress + status "OPEN" + deployedAt
   d. Log deployment
3. Skip proposals that would duplicate existing markets (dedup by question + bettingCloseTimestamp)
```

### 3.3 Oracle: Market Monitor (`oracle/src/orchestrator/markets/monitor.ts`)

Create the market monitor tick handler:

```
Runs every 5 minutes:
1. Find markets WHERE status IN ('OPEN', 'CLOSED') AND resolutionTimestamp <= now
2. For each expired market:
   a. Call dataServiceClient.verifyOutcome(sourceUrl, verificationKeywords, question)
   b. If outcome determined (confidence >= 0.5):
      - Call contract.proposeResolution(outcome)
      - Update DB: status = 'PROPOSED', resolvedOutcome = outcome
   c. If outcome unknown:
      - Update DB: status = 'PENDING_RESOLUTION'
      - Send admin notification
3. Find markets WHERE status = 'PROPOSED'
4. For each proposed market:
   a. Check if dispute window has passed (2 hours after proposedTimestamp)
   b. If window passed: call contract.finalizeResolution()
   c. Update DB: status = 'RESOLVED', resolvedAt = now
```

### 3.4 Oracle: Market Executor (`oracle/src/orchestrator/markets/executor.ts`)

```
MarketExecutor:
- proposeResolution(marketAddress, outcome) — calls contract + updates DB
- canFinalize(marketAddress) — checks dispute window
- finalizeResolution(marketAddress) — calls contract + updates DB
```

### 3.5 Data Service: Outcome Verification (`data-service/verifier/`)

Create the verification module:

```
data-service/
└── verifier/
    ├── __init__.py       # exports verify_outcome()
    └── analyzer.py       # AI-powered outcome analysis
```

**New endpoint:** `POST /verify-outcome`

```python
# Request
{
    "source_url": "https://npfl.ng/results/...",
    "verification_keywords": ["Enyimba", "Kano Pillars", "result"],
    "question": "Will Enyimba beat Kano Pillars?"
}

# Response
{
    "outcome": true,        # true=YES, false=NO, null=UNKNOWN
    "confidence": 0.85,     # 0.0-1.0
    "evidence": "Found match result: Enyimba 2-1 Kano Pillars"
}
```

**Logic:**
1. Fetch source_url content (use existing crawler infrastructure)
2. Check keyword presence — if less than 50% found, return UNKNOWN
3. Use GPT-4 to analyze the page content against the market question
4. Return structured outcome with confidence score

### 3.6 Oracle: Prisma Schema Updates

Add to `oracle/prisma/schema.prisma`:

```prisma
model Market {
  // ... existing fields ...
  contractAddress      String?  @unique
  verificationKeywords String[]
  deployedAt           DateTime?
  resolvedAt           DateTime?
}
```

Run `npx prisma migrate dev` after schema changes.

### 3.7 Oracle: Register All Handlers

Update `oracle/src/orchestrator/index.ts` to register:
- `marketCreator` (runs every 24 hours)
- `marketMonitor` (runs every 5 minutes)

Update `oracle/src/index.ts` entry point to:
1. Check Data Service health on startup
2. Start Express server
3. Register and start orchestrator handlers

---

## Completion Criteria

### Oracle Blockchain Integration

```bash
# Oracle starts without errors
cd oracle && npm run dev
# → "Server listening on port 3001"
# → "Orchestrator heart started"

# Health check
curl http://localhost:3001/health
# → {"status":"ok"}

# Verify blockchain client can connect
# The oracle logs should show successful provider connection on startup
```

### Market Deployment (manual trigger or wait for tick)

```bash
# After a market creation tick runs, check DB for contractAddress
curl http://localhost:3001/api/markets | jq '.[0].contractAddress'
# → "0x..." (non-null address)

# Verify on-chain
cast call <MARKET_ADDRESS> "question()(string)" --rpc-url $RPC_URL
# → Returns the market question

cast call <MARKET_ADDRESS> "getOdds()(uint256,uint256)" --rpc-url $RPC_URL
# → Returns YES and NO probabilities (should start at ~50/50)
```

### Outcome Verification Endpoint

```bash
# Data Service verify-outcome endpoint
curl -X POST http://localhost:8000/verify-outcome \
  -H "Content-Type: application/json" \
  -d '{"source_url":"https://npfl.ng","verification_keywords":["NPFL"],"question":"Test question?"}'
# → {"outcome":null|true|false,"confidence":0.X,"evidence":"..."}
# → HTTP 200 with valid JSON response shape
```

### Market Monitor

```bash
# Monitor should log activity on each tick
# Check oracle logs for:
# → "[MarketMonitor] Running at tick N"
# → "Market ready for resolution: <id>"
# → "Proposed resolution for <id>: YES/NO"

# After resolution and dispute window:
curl http://localhost:3001/api/markets?status=RESOLVED
# → Returns resolved markets with resolvedOutcome set
```

### API Contract Validation

```bash
# Markets API includes blockchain fields
curl http://localhost:3001/api/markets | jq '.[0] | keys'
# → Must include: contractAddress, deployedAt, status, verificationKeywords

# Single market with full detail
curl http://localhost:3001/api/markets/<id> | jq '.contractAddress'
# → "0x..." (non-null for deployed markets)
```

---

## Key Design Notes

- Oracle wallet needs Base Sepolia ETH for gas (use faucet: https://www.coinbase.com/faucets/base-sepolia-faucet)
- Market deployment costs gas — each createMarket call deploys a new contract
- The monitor is conservative: if confidence < 0.5, it flags for manual review rather than resolving incorrectly
- ABI files must be kept in sync with deployed contracts — copy from `contracts/out/` after build
- The `verificationKeywords` field bridges the Data Service and Oracle: the AI generator produces them, and the verifier uses them
