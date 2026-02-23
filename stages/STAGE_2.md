# Stage 2: Smart Contracts — Token & Market System

> **Status:** 🔲 TODO  
> **Repo:** ospm-services  
> **Folder:** `contracts/`  
> **Prerequisites:** Foundry installed (`curl -L https://foundry.paradigm.xyz | bash`)  
> **Depends on:** Nothing (independent)

---

## Objective

Write, test, and deploy the on-chain prediction market system: a play-money ERC20 token with faucet, an LMSR math library, individual binary market contracts, and a factory that deploys them.

---

## What to Build

### 2.1 Project Setup

Initialize a Foundry project at `contracts/`:

```
contracts/
├── src/
│   ├── PlayToken.sol
│   ├── LMSR.sol
│   ├── BinaryMarket.sol
│   └── MarketFactory.sol
├── test/
│   ├── PlayToken.t.sol
│   ├── LMSR.t.sol
│   ├── BinaryMarket.t.sol
│   └── MarketFactory.t.sol
├── script/
│   └── Deploy.s.sol
├── foundry.toml
└── .env.example
```

Install OpenZeppelin and a fixed-point math library (PRBMath or similar) for exp/ln calculations.

### 2.2 PlayToken.sol

ERC20 token with:
- Name: "OSPM Play Token", Symbol: "PLAY"
- Initial mint of 1,000,000 PLAY to deployer
- `faucet()` — mints 1,000 PLAY to caller, 24-hour cooldown per address
- `canClaimFaucet(address)` — returns bool
- `timeUntilNextClaim(address)` — returns seconds remaining
- `adminMint(address, uint256)` — owner-only mint for special events

### 2.3 LMSR.sol (Library)

Logarithmic Market Scoring Rule math library:
- `cost(int256 qYes, int256 qNo, uint256 b) → uint256` — Cost function: `b × ln(exp(qYes/b) + exp(qNo/b))`
- `prices(int256 qYes, int256 qNo, uint256 b) → (uint256 pYes, uint256 pNo)` — Current probabilities (sum to 1e18)
- `sharesForCost(bool outcome, int256 qYes, int256 qNo, uint256 b, uint256 maxCost) → uint256` — Binary search for shares given budget

All values scaled by 1e18. Use log-sum-exp trick for numerical stability. Use PRBMath or equivalent for exp/ln.

### 2.4 BinaryMarket.sol

Individual prediction market contract:
- **Constructor:** playToken address, oracle address, question, sourceUrl, bettingCloseTimestamp, resolutionTimestamp, liquidityParameter (b)
- **State:** MarketStatus enum (OPEN, CLOSED, PROPOSED, RESOLVED, DISPUTED), qYes, qNo, b
- **Betting:** `placeBet(bool outcome, uint256 maxCost) → uint256 shares` — LMSR pricing, transfers tokens in, one bet per address
- **Read:** `costToBuy(bool outcome, int256 shares) → uint256`, `getOdds() → (uint256 pYes, uint256 pNo)`
- **Resolution:** `proposeResolution(bool outcome)` (oracle only) → 2-hour dispute window → `finalizeResolution()` (anyone, after window)
- **Disputes:** `disputeResolution(string reason)` — requires existing bet, reverts to DISPUTED status
- **Claims:** `claimWinnings()` — winners get 1 token per winning share
- **Anti-frontrunning:** betting closes 15 min before event (enforced by `bettingCloseTimestamp`)

### 2.5 MarketFactory.sol

Factory contract:
- **Constructor:** playToken address, oracle address
- **State:** defaultLiquidity (100 × 1e18), markets array, isMarket mapping
- `createMarket(question, sourceUrl, bettingClose, resolution, liquidityParam) → address` — owner-only, deploys BinaryMarket
- `getMarkets() → address[]`
- `getMarketCount() → uint256`
- `setOracle(address)`, `setDefaultLiquidity(uint256)` — owner-only admin

### 2.6 Deployment Script

`script/Deploy.s.sol`:
1. Deploy PlayToken
2. Deploy MarketFactory(playToken, oracle)
3. Log all addresses
4. Target: Base Sepolia (chain ID 84532)

---

## Completion Criteria

An agent verifies this stage is complete by running the following:

### Test Suite (must all pass)

```bash
cd contracts

# All unit tests pass
forge test -vvv

# Specific test expectations:
# ✅ PlayToken: faucet mints 1000 PLAY, cooldown prevents double-claim, admin mint works
# ✅ LMSR: cost function returns correct values, prices sum to ~1e18, shares binary search converges
# ✅ BinaryMarket: bet updates LMSR state, only oracle can resolve, dispute window enforced, winners can claim
# ✅ MarketFactory: creates markets, tracks addresses, only owner can create
```

### Build (must succeed)

```bash
forge build
# → All contracts compile without errors or warnings
```

### Deployment Verification

```bash
# Deploy to Base Sepolia (requires ORACLE_PRIVATE_KEY and RPC_URL in .env)
source .env
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast

# Verify deployment
cast call $PLAY_TOKEN_ADDRESS "name()(string)" --rpc-url $RPC_URL
# → "OSPM Play Token"

cast call $PLAY_TOKEN_ADDRESS "symbol()(string)" --rpc-url $RPC_URL
# → "PLAY"

cast call $MARKET_FACTORY_ADDRESS "getMarketCount()(uint256)" --rpc-url $RPC_URL
# → 0
```

### Contract Verification on BaseScan

```bash
forge verify-contract $PLAY_TOKEN_ADDRESS PlayToken --chain base-sepolia
forge verify-contract $MARKET_FACTORY_ADDRESS MarketFactory --chain base-sepolia
```

---

## Key Design Notes

- LMSR `b` parameter default: 100 × 1e18 (controls price sensitivity — higher = more stable)
- Max market maker loss is bounded: `b × ln(2)` ≈ 69.3 tokens per market
- One bet per address per market (MVP simplification)
- No upgradeability on testnet — redeploy when changes needed
- Dispute window is 2 hours — simple admin-review model for MVP
