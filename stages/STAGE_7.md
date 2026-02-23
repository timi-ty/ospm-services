# Stage 7: User Dashboard, Notifications & Polish

> **Status:** ✅ COMPLETE  
> **Repos:** ospm-frontend, ospm-services (oracle/)  
> **Prerequisites:** Stage 5 (trading works), Stage 6 (lifecycle works)  
> **Depends on:** Stage 5, Stage 6

---

## Objective

Build the user dashboard (bet history, portfolio), admin notifications, leaderboard, and polish the overall UX with proper loading states, error handling, and mobile responsiveness.

---

## What to Build

### 7.1 User Dashboard Page (`app/dashboard/page.tsx`)

Protected route (requires auth). Shows:

```
┌─────────────────────────────────────┐
│  Dashboard                          │
│                                     │
│  ┌─────────┐ ┌─────────┐ ┌───────┐ │
│  │ Balance  │ │ Active  │ │ Won/  │ │
│  │ 2,450   │ │ Bets: 3 │ │ Lost  │ │
│  │ $PLAY   │ │         │ │ 5/2   │ │
│  └─────────┘ └─────────┘ └───────┘ │
│                                     │
│  Active Bets                        │
│  ┌───────────────────────────────┐  │
│  │ "Will Enyimba beat...?"      │  │
│  │ You: YES (52 shares)         │  │
│  │ Current odds: 65% YES        │  │
│  │ Cost: 45.2 PLAY              │  │
│  │ Status: OPEN                 │  │
│  └───────────────────────────────┘  │
│                                     │
│  Resolved Bets                      │
│  ┌───────────────────────────────┐  │
│  │ "Will NPFL match...?"        │  │
│  │ You: NO ✅ WON               │  │
│  │ Payout: 100 PLAY             │  │
│  │ [Claim Winnings]             │  │
│  └───────────────────────────────┘  │
│                                     │
│  Bet History (table)                │
│  Date | Market | Side | Cost | P&L  │
└─────────────────────────────────────┘
```

### 7.2 Oracle: User Bets API

**Endpoint:** `GET /api/users/:address/bets`

Returns user's bet history with market details:
```json
[
  {
    "id": "bet_123",
    "outcome": true,
    "shares": "52.0",
    "costBasis": "45.2",
    "claimed": false,
    "market": {
      "id": "mkt_456",
      "question": "Will Enyimba beat Kano Pillars?",
      "contractAddress": "0x...",
      "status": "OPEN",
      "resolvedOutcome": null,
      "qYes": 52.0,
      "qNo": 0.0
    }
  }
]
```

Requires auth middleware — user can only see their own bets.

### 7.3 Leaderboard Page (`app/leaderboard/page.tsx`)

**Endpoint:** `GET /api/leaderboard`

Returns top users by win count or profit:
```json
[
  { "address": "0x1234...", "wins": 15, "totalProfit": "2500.0", "totalBets": 20 },
  { "address": "0x5678...", "wins": 12, "totalProfit": "1800.0", "totalBets": 18 }
]
```

**Frontend:** Simple ranked list with:
- Rank number
- Truncated address
- Wins / Total bets
- Profit in $PLAY

### 7.4 How It Works Page (`app/how-it-works/page.tsx`)

Static page explaining:
1. What is a prediction market
2. How OSPM works (sign up → claim PLAY → make predictions)
3. How odds work (LMSR simplified)
4. How resolution works
5. FAQ

### 7.5 Admin Notifications (`oracle/src/shared/notifications/service.ts`)

Notify admin (Telegram or Discord) on key events:
- Market deployment: "Deployed market: {question} at {address}"
- Resolution proposed: "Proposed {YES/NO} for: {question}"
- Dispute filed: "DISPUTE on: {question} — Reason: {reason}"
- Verification uncertain: "Manual review needed: {question}"
- Service errors: "Oracle error: {message}"

```typescript
async function notifyAdmin(message: string): Promise<void> {
  // Telegram: POST to bot API
  // Discord: POST to webhook URL
  // Always: console.log('[ADMIN]', message)
}
```

### 7.6 UX Polish

**Loading States:**
- Skeleton loaders for market cards (pulsing rectangles)
- Spinner/skeleton for market detail page
- Transaction pending overlay with progress

**Error Handling:**
- Toast notifications for transaction success/failure
- Error boundaries for component crashes
- Network error states ("Failed to load markets" with retry)
- RPC error handling (chain unavailable)

**Mobile Responsiveness:**
- Market cards: single column on mobile, grid on desktop
- Trade panel: bottom sheet on mobile, sidebar on desktop
- Touch-friendly buttons (minimum 44px tap targets)
- Navigation: hamburger menu on mobile

**Animations:**
- Market card hover effects
- Smooth transitions between states
- Probability bar animations when odds change

### 7.7 Toast System (`components/ui/Toast.tsx`)

Global toast notification system:
- Success (green): "Bet placed successfully!"
- Error (red): "Transaction failed: insufficient funds"
- Info (blue): "Faucet tokens claimed"
- Configurable duration (default 5s)
- Stackable

---

## Completion Criteria

### User Dashboard

```
BROWSER TEST:
1. Sign in
2. Navigate to /dashboard
3. Dashboard shows:
   - $PLAY balance (correct amount)
   - Active bets count
   - Win/loss record (0/0 for new user)
4. Place a bet on a market
5. Return to /dashboard
6. Active bet appears with:
   - Market question
   - Your side (YES/NO)
   - Number of shares
   - Cost basis
   - Current market status
7. After market resolves:
   - Bet moves to "Resolved" section
   - Win/loss indicator shown
   - "Claim Winnings" button if won
```

### User Bets API

```bash
# Authenticated request
curl http://localhost:3001/api/users/0x.../bets \
  -H "Authorization: Bearer <token>"
# → Array of bet objects with market details

# Unauthenticated → 401
curl http://localhost:3001/api/users/0x.../bets
# → {"error":"Unauthorized"}
```

### Leaderboard

```
BROWSER TEST:
1. Navigate to /leaderboard
2. Page renders (may be empty if no resolved bets yet)
3. Shows ranked list of addresses
4. No errors in console
```

```bash
curl http://localhost:3001/api/leaderboard
# → Array of leaderboard entries (may be empty)
```

### How It Works

```
BROWSER TEST:
1. Navigate to /how-it-works
2. Page renders with educational content
3. Explains prediction markets, OSPM, odds, resolution
4. No broken links or images
```

### Notifications

```bash
# Check Oracle logs for notification attempts:
# → "[ADMIN] Deployed market: ..."
# → "[ADMIN] Proposed YES for: ..."

# If Telegram configured:
# Messages appear in admin Telegram chat

# If Discord configured:
# Messages appear in Discord channel
```

### Mobile Responsiveness

```
BROWSER TEST (mobile viewport: 375x812):
1. Navigate to http://localhost:3000
2. Market cards display in single column
3. Navigation is hamburger menu
4. All text is readable, no horizontal scrolling
5. Navigate to market detail
6. Trade panel is accessible (bottom sheet or stacked)
7. Buttons are minimum 44px tap target
```

### Error Handling

```
BROWSER TEST:
1. Place a bet → success toast appears
2. Try to bet with 0 balance → error message shown
3. Try to bet on closed market → "Betting closed" state
4. Disconnect network → error state with retry button
5. All errors handled gracefully (no blank screens)
```

---

## Key Design Notes

- Dashboard data comes from DB (via Oracle API), not directly from chain — this is faster and supports history
- Leaderboard is computed from the Bet table — aggregate wins and profit per user
- Notifications are best-effort (don't fail the parent operation if Telegram is unreachable)
- Toast system should be global (mounted in layout), triggered via context or event bus
- Mobile responsiveness is critical for Nigerian market (most users on mobile)
- The "How It Works" page is important for user education — prediction markets are unfamiliar to many users
