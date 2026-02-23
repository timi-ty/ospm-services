# Stage 4: Frontend Authentication & Wallet Infrastructure

> **Status:** 🔲 TODO  
> **Repo:** ospm-frontend  
> **Prerequisites:** Privy account created at https://privy.io, app ID obtained  
> **Depends on:** Stage 1 (Oracle API running)

---

## Objective

Add authentication (Privy) and wallet infrastructure (Coinbase Smart Wallet) to the frontend so users can sign up, get an embedded wallet, and have a persistent identity.

---

## What to Build

### 4.1 Install Dependencies

```bash
cd ospm-frontend
npm install @privy-io/react-auth @privy-io/wagmi wagmi viem @tanstack/react-query
```

### 4.2 Providers (`app/providers.tsx`)

Create a client-side providers wrapper:

```typescript
'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { baseSepolia } from 'viem/chains';
```

Configure:
- `loginMethods`: ['google', 'email', 'sms']
- `appearance.theme`: 'dark'
- `embeddedWallets.createOnLogin`: 'users-without-wallets'
- `defaultChain`: baseSepolia
- `supportedChains`: [baseSepolia]

Wrap in `app/layout.tsx`.

### 4.3 Auth Hook (`hooks/useAuth.ts`)

Custom hook exposing:
- `login()`, `logout()`
- `isAuthenticated`, `isReady`
- `user` (Privy user object)
- `address` (embedded wallet address)
- `wallet` (embedded wallet object)

Uses `usePrivy()` and `useWallets()` from Privy.

### 4.4 Auth Components

**`components/auth/LoginButton.tsx`:**
- Shows "Sign In" when not authenticated
- Calls `login()` from Privy (opens modal)
- Shows loading state while Privy initializes

**`components/auth/UserMenu.tsx`:**
- Shows truncated wallet address (0x1234...5678)
- Dropdown with: wallet address (copy), sign out
- Avatar or user icon

**`components/auth/AuthGuard.tsx`:**
- Client component wrapper for protected routes
- Redirects to home if not authenticated
- Shows loading skeleton while checking auth

### 4.5 Navigation Update

Update the layout/header to include:
- LoginButton (when not authenticated)
- UserMenu (when authenticated)
- App logo/name

### 4.6 Oracle: JWT Verification (`oracle/src/server/middleware/auth.ts`)

Add Privy JWT verification middleware to the Oracle service:

```bash
cd oracle
npm install @privy-io/server-auth
```

**Middleware:**
- Extracts Bearer token from Authorization header
- Verifies with Privy server SDK
- Attaches `req.user = { privyUserId, address }` to request
- Used on protected endpoints (future: place bet, user profile)

**Auth route:** `POST /api/auth/verify`
- Receives Privy token
- Verifies and returns user data
- Creates/updates User record in DB

### 4.7 Oracle: User Model

Ensure Prisma schema has User model:

```prisma
model User {
  id            String   @id @default(cuid())
  privyUserId   String   @unique
  address       String   @unique
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  bets          Bet[]
}
```

### 4.8 Environment Variables

**ospm-frontend/.env.local:**
```
NEXT_PUBLIC_PRIVY_APP_ID=<your-privy-app-id>
NEXT_PUBLIC_ORACLE_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=84532
```

**oracle/.env:**
```
PRIVY_APP_ID=<your-privy-app-id>
PRIVY_APP_SECRET=<your-privy-app-secret>
```

---

## Completion Criteria

### Frontend Auth Flow

```
BROWSER TEST:
1. Navigate to http://localhost:3000
2. Verify "Sign In" button is visible in the header/nav
3. Click "Sign In"
4. Privy modal opens with Google/Email/SMS options
5. Complete authentication (email is simplest for testing)
6. After login:
   - "Sign In" button replaced by UserMenu
   - Truncated wallet address visible (0x...)
   - User has an embedded wallet on Base Sepolia
7. Refresh page — user remains logged in (session persistence)
8. Click sign out — returns to unauthenticated state
```

### Auth API Verification

```bash
# Oracle auth endpoint responds
curl -X POST http://localhost:3001/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<privy-jwt-token>"}'
# → {"success":true,"user":{"id":"...","address":"0x..."}}

# Invalid token rejected
curl -X POST http://localhost:3001/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"invalid"}'
# → HTTP 401
```

### Protected Route

```
BROWSER TEST:
1. Navigate to http://localhost:3000/dashboard (or any protected route)
2. If not logged in → redirected to home page
3. If logged in → page renders with user context
```

### Provider Setup Verification

```
BROWSER TEST:
1. Open browser console on http://localhost:3000
2. No errors related to Privy, wagmi, or React Query
3. Network tab shows Privy SDK loaded successfully
```

### User Persistence

```bash
# After a user authenticates, check DB
# User record created in PostgreSQL
curl http://localhost:3001/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<valid-token>"}'
# → Returns user with id, address, privyUserId
```

---

## Key Design Notes

- Privy handles wallet creation automatically — no need for manual wallet setup
- Embedded wallet is an EOA on Base Sepolia, created by Privy on first login
- Smart Wallet (Coinbase) will be layered on top in Stage 6 for gasless transactions
- The auth middleware is opt-in per route — public endpoints (market listing) don't require auth
- Phone auth defaults to Nigeria (+234) country code in the Privy config
- Session tokens are managed by Privy SDK — no custom session management needed
