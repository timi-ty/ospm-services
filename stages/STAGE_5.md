# Stage 5: Frontend Market Detail & Trading Interface

> **Status:** 🔲 TODO  
> **Repo:** ospm-frontend  
> **Prerequisites:** Stage 2 (contracts deployed), Stage 4 (auth working)  
> **Depends on:** Stage 2, Stage 4

---

## Objective

Build the market detail page where users can view individual markets with real-time LMSR odds and place bets using $PLAY tokens. This is the core trading experience.

---

## What to Build

### 5.1 Install Additional Dependencies

```bash
npm install @coinbase/onchainkit
```

### 5.2 Contract Configuration (`lib/contracts/`)

```
lib/contracts/
├── addresses.ts       # Contract addresses from env
├── playToken.ts       # ABI + address for PlayToken
├── binaryMarket.ts    # ABI for BinaryMarket
└── marketFactory.ts   # ABI + address for MarketFactory
```

ABIs can be imported from JSON files or defined as const arrays. Addresses come from `NEXT_PUBLIC_PLAY_TOKEN_ADDRESS` and `NEXT_PUBLIC_MARKET_FACTORY_ADDRESS` env vars.

### 5.3 Token Hooks (`hooks/usePlayToken.ts`)

```typescript
usePlayToken() → {
  balance: string,          // Formatted balance (e.g., "1000.0")
  canClaim: boolean,        // Faucet available
  timeUntilClaim: number,   // Seconds until next faucet
  claimFaucet: () => void,  // Trigger faucet tx
  isPending: boolean,
  isSuccess: boolean,
  refetchBalance: () => void,
}
```

Uses wagmi's `useReadContract` for reads and `useWriteContract` for faucet claim.

### 5.4 Market Detail Page (`app/markets/[address]/page.tsx`)

Route: `/markets/{contractAddress}`

**Layout:**
```
┌─────────────────────────────────────┐
│  ← Back to Markets                  │
│                                     │
│  Category Badge    Status Badge     │
│                                     │
│  "Will Enyimba beat Kano Pillars?"  │
│                                     │
│  Description text...                │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   YES 52%    │    NO 48%     │  │
│  │   ████████   │   ████████    │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │        TRADE PANEL            │  │
│  │  [YES] [NO]                   │  │
│  │  Amount: [________] $PLAY     │  │
│  │  Cost: 52.3 $PLAY             │  │
│  │  Potential payout: 100 $PLAY  │  │
│  │  [Place Bet]                  │  │
│  └───────────────────────────────┘  │
│                                     │
│  Betting closes: Jan 20, 2:45 PM   │
│  Resolves: Jan 20, 5:00 PM         │
│  Source: npfl.ng ↗                  │
└─────────────────────────────────────┘
```

**Data Sources:**
- Market metadata: Oracle API (`GET /api/markets/:id`)
- On-chain state (odds, status): Direct contract reads via wagmi
- Merge both for full market view

### 5.5 Trade Panel Component (`components/trading/TradePanel.tsx`)

**Props:** `marketAddress`, `yesOdds`, `noOdds`

**Flow:**
1. User selects YES or NO
2. User enters amount in $PLAY
3. Component computes: cost (from `costToBuy` contract call), potential payout (shares)
4. User clicks "Place Bet"
5. Two transactions: approve PlayToken → placeBet on BinaryMarket
6. Show pending/confirming/success states
7. After success: refresh odds, show "Bet Placed" confirmation

**States:**
- Not logged in → "Sign in to trade" button
- No $PLAY balance → "Claim $PLAY from faucet" prompt
- Already placed bet → Show existing position (shares, outcome, cost basis)
- Market closed → "Betting closed" message
- Market resolved → Show result + "Claim Winnings" button (if won)

### 5.6 Faucet Button Component (`components/wallet/FaucetButton.tsx`)

- Shows current $PLAY balance
- "Claim 1,000 $PLAY" button (disabled if cooldown active)
- Countdown timer when cooldown active
- Transaction pending state

### 5.7 Wallet Balance Component (`components/wallet/WalletBalance.tsx`)

- Displays $PLAY balance in header/nav
- Auto-refreshes after transactions
- Formatted with commas (e.g., "1,000.00")

### 5.8 Market Card Enhancement (`components/MarketCard.tsx`)

Update existing MarketCard to:
- Link to `/markets/{contractAddress}`
- Show live odds from on-chain data (YES% / NO%)
- Show market status badge
- Visual probability bar

### 5.9 Claim Winnings Component (`components/trading/ClaimWinnings.tsx`)

For resolved markets where user won:
- Shows "You won!" message
- Payout amount
- "Claim Winnings" button
- Transaction states

### 5.10 Environment Variables

```
NEXT_PUBLIC_PLAY_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
```

---

## Completion Criteria

### Market Detail Page

```
BROWSER TEST:
1. Navigate to http://localhost:3000
2. Click on any market card
3. Navigates to /markets/{address}
4. Page shows:
   - Market question (large heading)
   - Description
   - Category and status badges
   - YES/NO probability percentages (from chain, ~50/50 for new markets)
   - Probability bar visualization
   - Betting close and resolution timestamps
   - Source URL link
5. No console errors
```

### Trading Flow (Authenticated)

```
BROWSER TEST:
1. Sign in (via Stage 4 auth)
2. Navigate to an OPEN market
3. Trade panel visible with YES/NO buttons
4. Select "YES"
5. Enter amount (e.g., "100")
6. Cost preview updates dynamically (reads costToBuy from contract)
7. Click "Place Bet"
8. Wallet prompts for token approval
9. After approval, wallet prompts for bet placement
10. Transaction confirms
11. Odds update on page (YES% increases)
12. Trade panel shows existing position
```

### Faucet Flow

```
BROWSER TEST:
1. Sign in
2. Check $PLAY balance (should be 0 for new user)
3. Click "Claim 1,000 $PLAY" button
4. Transaction confirms
5. Balance updates to "1,000"
6. Button becomes disabled with cooldown timer
```

### Market States

```
BROWSER TEST:
1. OPEN market → Trade panel with YES/NO buttons
2. CLOSED market → "Betting closed" message, no trade inputs
3. RESOLVED market → Shows outcome, "Claim Winnings" for winners
4. Unauthenticated → "Sign in to trade" prompt instead of trade panel
5. No balance → "Claim $PLAY" prompt instead of trade inputs
```

### On-Chain Data Verification

```bash
# After placing a bet, verify on-chain state changed
cast call <MARKET_ADDRESS> "getOdds()(uint256,uint256)" --rpc-url $RPC_URL
# → YES probability should have shifted from initial 50/50

cast call <MARKET_ADDRESS> "bets(address)(uint256,bool,uint256,bool)" <USER_ADDRESS> --rpc-url $RPC_URL
# → Shows shares, outcome, costBasis, claimed
```

### API Integration

```bash
# Market detail returns full data
curl http://localhost:3001/api/markets/<id>
# → Market object with all fields

# Markets list still works
curl http://localhost:3001/api/markets
# → Array of markets with contractAddress
```

---

## Key Design Notes

- Odds are read directly from the chain via `getOdds()` — the frontend is the source of truth for live prices
- The Oracle DB caches odds for fast API responses, but the detail page reads fresh from chain
- Token approval + bet placement are two separate transactions — consider batching in Stage 6 with paymaster
- Mobile: trade panel should be a bottom sheet or collapsible panel (minimum 44px tap targets)
- New markets start at 50/50 odds — the first bet moves the price significantly
- `costToBuy` is a view function — call it on every amount change for real-time cost preview (debounce to avoid excessive RPC calls)
