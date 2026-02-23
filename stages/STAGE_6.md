# Stage 6: Market Lifecycle Automation & Gas Sponsorship

> **Status:** 🔲 TODO  
> **Repos:** ospm-services (oracle/), ospm-frontend  
> **Prerequisites:** Stage 3 (oracle blockchain integration), Stage 5 (trading works)  
> **Depends on:** Stage 3, Stage 5

---

## Objective

Complete the automated market lifecycle (creation → monitoring → resolution → settlement) and add gas sponsorship via CDP Paymaster so users never need ETH.

---

## What to Build

### 6.1 Full Market Lifecycle Automation

Ensure the Oracle orchestrator handles the complete lifecycle automatically:

```
CREATION (every 24h):
  Data Service → AI proposals → Deploy on-chain → Store in DB → Status: OPEN

BETTING CLOSE (automatic):
  When block.timestamp >= bettingCloseTimestamp → Contract rejects bets
  Monitor updates DB status: OPEN → CLOSED

RESOLUTION (every 5min check):
  When resolutionTimestamp reached:
  → Call Data Service /verify-outcome
  → If confident: proposeResolution on-chain → Status: PROPOSED
  → If uncertain: flag for admin review

FINALIZATION (every 5min check):
  When dispute window (2h) passes:
  → Call finalizeResolution on-chain → Status: RESOLVED

SETTLEMENT:
  Users claim winnings via frontend → claimWinnings() on contract
```

### 6.2 Oracle: Betting Close Monitor

Add to `MarketMonitor`:
- Check for markets WHERE status = 'OPEN' AND bettingCloseTimestamp <= now
- Update DB status to 'CLOSED'
- This is a DB-only update (the contract enforces the close timestamp independently)

### 6.3 Oracle: Status Sync

Add a sync mechanism to reconcile DB status with on-chain state:
- Read `market.status()` from contract
- Compare with DB status
- Update DB if diverged (chain is authoritative)
- Run this on the monitor tick, but less frequently (every 30 minutes)

### 6.4 Oracle: LMSR State Cache

After bets are placed on-chain, the DB's cached LMSR values (qYes, qNo) drift from chain state. Add:
- On monitor tick: read `qYes`, `qNo` from deployed contracts
- Update DB cache for fast API reads
- This allows the markets API to return approximate odds without clients needing chain access

### 6.5 Gas Sponsorship: CDP Paymaster

**Setup:**
1. Create CDP account at https://portal.cdp.coinbase.com
2. Create project, enable Paymaster for Base Sepolia
3. Define sponsorship policy:
   - Allowed contracts: PlayToken, MarketFactory, BinaryMarket addresses
   - Allowed methods: `faucet()`, `approve()`, `placeBet()`, `claimWinnings()`
   - Daily limit per user

**Frontend Integration:**

```bash
cd ospm-frontend
npm install @coinbase/onchainkit
```

**`hooks/useSponsoredTransaction.ts`:**
- Uses wagmi experimental `useWriteContracts` for batched transactions
- Injects paymaster capability for sponsored gas
- Falls back to regular transactions if paymaster unavailable

**Update TradePanel to use sponsored transactions:**
- Batch approve + placeBet into single user operation
- User signs once, both transactions execute
- Gas is paid by the paymaster (platform pays)
- Show "Gas fees sponsored" badge

**Update FaucetButton to use sponsored transactions:**
- Faucet claim is sponsored
- User pays nothing

### 6.6 Sponsored Trade Flow

```
User clicks "Place Bet":
1. Frontend batches: [approve(market, amount), placeBet(outcome, amount)]
2. Paymaster sponsors the UserOp
3. Smart wallet signs once
4. Both transactions execute atomically
5. User sees "Bet placed!" — no gas cost visible
```

### 6.7 Gas Fallback UI (`components/wallet/GasWarning.tsx`)

If paymaster fails or is unavailable:
- Show warning banner with link to Base Sepolia faucet
- Allow manual gas funding
- Graceful degradation — trading still works, just costs gas

### 6.8 Environment Variables

**ospm-frontend/.env.local:**
```
NEXT_PUBLIC_PAYMASTER_URL=https://api.developer.coinbase.com/rpc/v1/base-sepolia/...
```

**oracle/.env:**
```
# No changes needed — oracle pays its own gas from ORACLE_PRIVATE_KEY
```

---

## Completion Criteria

### Market Lifecycle End-to-End

```bash
# 1. Market creation happens automatically (wait for tick or trigger)
curl http://localhost:3001/api/markets?status=OPEN
# → Returns markets with contractAddress set

# 2. After betting close time passes:
curl http://localhost:3001/api/markets?status=CLOSED
# → Markets whose bettingCloseTimestamp has passed

# 3. After resolution time + verification:
curl http://localhost:3001/api/markets?status=PROPOSED
# → Markets with proposed resolution

# 4. After dispute window (2h):
curl http://localhost:3001/api/markets?status=RESOLVED
# → Fully resolved markets

# 5. LMSR cache is updated
curl http://localhost:3001/api/markets/<id> | jq '{qYes, qNo}'
# → Non-zero values after bets have been placed
```

### Monitor Logs

```bash
# Oracle logs show lifecycle activity:
# → "[MarketMonitor] Running at tick N"
# → "Updated N markets to CLOSED"
# → "Market <id> ready for resolution"
# → "Proposed resolution for <id>: YES"
# → "Finalized resolution for <id>"
# → "Synced LMSR state for N markets"
```

### Gas Sponsorship (Frontend)

```
BROWSER TEST:
1. Sign in
2. Claim faucet tokens
   - Transaction succeeds
   - No gas deducted from user's ETH balance (check in wallet)
   - "Gas fees sponsored" shown or no gas prompt appears
3. Navigate to open market
4. Place a bet
   - Approve + bet batched into single signature
   - Transaction succeeds without gas cost to user
   - Or if paymaster not configured: regular flow works with user paying gas
```

### Fallback Behavior

```
BROWSER TEST (paymaster disabled):
1. Remove NEXT_PUBLIC_PAYMASTER_URL from env
2. Restart frontend
3. Trading still works (user pays gas)
4. Warning about gas shown if balance is low
```

### Status Sync Verification

```bash
# Deploy a market, place a bet directly on-chain (simulating external interaction)
cast send <MARKET_ADDRESS> "placeBet(bool,uint256)" true 50000000000000000000 --private-key $USER_KEY --rpc-url $RPC_URL

# Wait for monitor tick, then check DB reflects the on-chain state
curl http://localhost:3001/api/markets/<id> | jq '{qYes, qNo}'
# → Values reflect the on-chain LMSR state
```

---

## Key Design Notes

- The paymaster is a "nice to have" for MVP — the stage is complete even if paymaster isn't configured, as long as the fallback works
- CDP Paymaster requires a funded gas tank on their platform (deposit ETH via their dashboard)
- Batching approve + placeBet requires Smart Wallet (ERC-4337) — the Privy embedded wallet may not support this natively. If not, keep as two separate sponsored transactions.
- The Oracle's own transactions (deploying markets, resolving) are NOT sponsored — the oracle wallet pays its own gas
- LMSR cache in DB is approximate — frontend should still read from chain for the detail page, but use DB values for the listing page
- Status sync is defensive — handles cases where on-chain state changes outside the oracle's control (manual admin actions, direct contract calls)
