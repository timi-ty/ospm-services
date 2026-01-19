# OSPM (Open Source Prediction Market) - Project Roadmap

> **Version:** 1.0.0  
> **Network:** Base Sepolia (Testnet) → Base Mainnet (Production)  
> **Last Updated:** January 2026

---

## Table of Contents

1. [Project Overview & Architecture](#section-1-project-overview--architecture)
2. [Authentication & Identity Layer](#section-2-authentication--identity-layer)
3. [Smart Account & Wallet Infrastructure](#section-3-smart-account--wallet-infrastructure)
4. [Smart Contracts - Token & Core](#section-4-smart-contracts---token--core)
5. [Smart Contracts - Market System](#section-5-smart-contracts---market-system)
   - [Contract Upgradeability Strategy](#57-contract-upgradeability-strategy)
   - [Data Flow & Responsibilities](#section-58-data-flow--responsibilities)
6. [Frontend Application](#section-6-frontend-application)
7. [Backend Services & Database](#section-7-backend-services--database)
8. [Data Service](#section-8-data-service)
9. [Oracle Service](#section-9-oracle-service)
   - [The Two Drivers](#92-the-two-drivers)
   - [The Tick Mechanism](#93-the-tick-mechanism)
   - [Data Service Client](#94-data-service-client)
   - [Orchestrator Layer](#95-orchestrator-layer)
   - [Server Layer](#96-server-layer)
   - [Shared Layer](#97-shared-layer)
10. [Gas Sponsorship & Paymaster](#section-10-gas-sponsorship--paymaster)

---

## Section 1: Project Overview & Architecture

### 1.1 Vision

OSPM is an open-source prediction market platform that provides a seamless "Web2" experience while leveraging "Web3" rails. Users can sign up and place predictions in under 30 seconds without ever purchasing ETH or managing seed phrases.

### 1.2 High-Level Architecture

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

### 1.2.1 Terminology

| Term | Definition |
|------|------------|
| **Market** | A single binary YES/NO prediction question |
| **Platform** | The entire OSPM system (all markets + services) |
| **Pool** | The YES or NO betting pool within a single market |

### 1.3 Technology Stack

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
| **Contracts** | Solidity + Foundry | On-chain Logic |
| **Network** | Base Sepolia | Testnet Deployment |
| **Hosting (FE)** | Vercel | Frontend (via GitHub) |
| **Hosting (BE)** | AWS Lightsail | VPS (Oracle, Data Service, DB) |
| **Process Mgmt** | PM2 | Service management on VPS |
| **Reverse Proxy** | nginx | SSL termination, routing |

### 1.4 Repository Structure

The project is split into two repositories:

**ospm-services** (Backend Monorepo) → AWS Lightsail VPS

```
ospm-services/
├── contracts/                    # Solidity smart contracts
│   ├── src/
│   │   ├── PlayToken.sol
│   │   ├── MarketFactory.sol
│   │   └── BinaryMarket.sol
│   ├── script/
│   ├── test/
│   └── foundry.toml
├── oracle/                       # Node.js orchestrator service
│   ├── src/
│   │   ├── index.ts              # Entry point (starts both drivers)
│   │   │
│   │   ├── server/               # REQUEST-DRIVEN (User Input)
│   │   │   ├── index.ts          # Express app, middleware, CORS
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts       # Privy JWT verification
│   │   │   │   └── rateLimit.ts
│   │   │   ├── auth/             # Auth domain
│   │   │   │   ├── routes.ts
│   │   │   │   ├── controller.ts
│   │   │   │   └── types.ts
│   │   │   └── markets/          # Markets domain (READ for frontend)
│   │   │       ├── routes.ts
│   │   │       ├── controller.ts
│   │   │       └── service.ts    # DB queries only
│   │   │
│   │   ├── orchestrator/         # TIME-DRIVEN (Passage of Time)
│   │   │   ├── index.ts          # Registers tick handlers
│   │   │   ├── heart.ts          # Global tick mechanism (setInterval)
│   │   │   ├── types.ts          # TickContext, TickHandler
│   │   │   ├── dataServiceClient.ts  # HTTP client for Python service
│   │   │   └── markets/          # Market lifecycle domain
│   │   │       ├── creator.ts    # tick() → Data Service → deploy → store
│   │   │       ├── monitor.ts    # tick() → check expirations
│   │   │       └── executor.ts   # tick() → verify → settle
│   │   │
│   │   └── shared/               # USED BY BOTH DRIVERS
│   │       ├── database/
│   │       │   └── prisma.ts     # PrismaClient singleton
│   │       ├── blockchain/
│   │       │   ├── client.ts     # ethers.js provider, wallet
│   │       │   └── contracts.ts  # Contract instances
│   │       ├── notifications/
│   │       │   └── service.ts    # Telegram/Discord
│   │       └── config/
│   │           └── env.ts        # Typed environment variables
│   │
│   ├── prisma/                   # Database schema + migrations
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── package.json
│   └── tsconfig.json
├── data-service/                 # Python HTTP utility service
│   ├── main.py                   # FastAPI entry point
│   ├── scraper/                  # Data source scrapers
│   ├── generator/                # AI market generation
│   ├── verifier/                 # Outcome verification
│   └── requirements.txt
├── scripts/
│   ├── dev-setup.sh              # Local development setup
│   └── deploy-staging.sh         # Staging deployment (via GitHub Action)
├── .github/
│   └── workflows/
│       └── deploy-staging.yml    # GitHub Action for VPS deployment
└── env.example
```

**ospm-frontend** (Separate Repo) → Vercel via GitHub

```
ospm-frontend/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx
│   ├── page.tsx
│   ├── markets/
│   ├── dashboard/
│   └── api/
├── components/                   # React components
│   ├── auth/
│   ├── market/
│   ├── trading/
│   └── wallet/
├── hooks/                        # Custom React hooks
├── lib/                          # Shared utilities
└── package.json
```

### 1.5 Environment Configuration

```env
# Authentication
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=

# Blockchain
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
ORACLE_PRIVATE_KEY=

# Contracts
NEXT_PUBLIC_PLAY_TOKEN_ADDRESS=
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=

# Paymaster
CDP_API_KEY=
CDP_API_SECRET=
PAYMASTER_URL=

# Backend
DATABASE_URL=postgresql://...
VPS_API_SECRET=
NEXT_PUBLIC_VPS_API_URL=

# AI
OPENAI_API_KEY=
```

### 1.6 Deliverables Checklist

- [ ] Architecture diagram finalized
- [ ] Repository structure created
- [ ] Environment variables documented
- [ ] Development environment setup guide
- [ ] CI/CD pipeline configured

---

## Section 2: Authentication & Identity Layer

### 2.1 Overview

The identity layer removes the "seed phrase" barrier entirely. Users authenticate using familiar Web2 methods (Google, Email, Phone) while Privy handles wallet creation in the background.

### 2.2 Privy Integration

#### 2.2.1 Installation

```bash
npm install @privy-io/react-auth @privy-io/wagmi
```

#### 2.2.2 Provider Configuration

```typescript
// app/providers.tsx
'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { baseSepolia } from 'viem/chains';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['google', 'email', 'sms'],
        appearance: {
          theme: 'dark',
          accentColor: '#22c55e',
          logo: '/logo.png',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
```

#### 2.2.3 Authentication Hook

```typescript
// hooks/useAuth.ts
import { usePrivy, useWallets } from '@privy-io/react-auth';

export function useAuth() {
  const { 
    login, 
    logout, 
    authenticated, 
    user, 
    ready 
  } = usePrivy();
  
  const { wallets } = useWallets();
  
  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy'
  );

  return {
    login,
    logout,
    isAuthenticated: authenticated,
    isReady: ready,
    user,
    address: embeddedWallet?.address,
    wallet: embeddedWallet,
  };
}
```

### 2.3 Login Flow

```
1. User clicks "Sign In"
2. Privy modal opens with options (Google/Email/Phone)
3. User completes authentication
4. Privy creates embedded EOA wallet
5. EOA address stored in user session
6. User redirected to dashboard with wallet ready
```

### 2.4 Phone Number Authentication (Nigeria Focus)

```typescript
// For Nigerian phone numbers (+234)
config: {
  loginMethods: ['sms'],
  appearance: {
    defaultCountryCode: 'NG',
  },
}
```

### 2.5 Session Management

```typescript
// components/AuthGuard.tsx
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/');
    }
  }, [ready, authenticated, router]);

  if (!ready) return <LoadingSkeleton />;
  if (!authenticated) return null;

  return <>{children}</>;
}
```

### 2.6 Deliverables Checklist

- [ ] Privy app created in dashboard
- [ ] PrivyProvider configured with correct app ID
- [ ] Login methods enabled (Google, Email, SMS)
- [ ] Embedded wallet creation on signup
- [ ] Auth hook implemented
- [ ] Protected routes configured
- [ ] User can log in and see their Base Sepolia address
- [ ] Session persistence working

---

## Section 3: Smart Account & Wallet Infrastructure

### 3.1 Overview

The Coinbase Smart Wallet provides Account Abstraction (AA), enabling passkey authentication (FaceID/TouchID) and gasless transactions through the Paymaster.

### 3.2 Smart Wallet Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Authentication                       │
│  ┌─────────────┐                      ┌─────────────┐       │
│  │   Passkey   │                      │  Privy EOA  │       │
│  │  (Signer 1) │                      │  (Signer 2) │       │
│  └──────┬──────┘                      └──────┬──────┘       │
│         │                                    │               │
│         └────────────┬───────────────────────┘               │
│                      │                                       │
│              ┌───────▼───────┐                              │
│              │    Coinbase   │                              │
│              │  Smart Wallet │                              │
│              │   (ERC-4337)  │                              │
│              └───────┬───────┘                              │
│                      │                                       │
│              ┌───────▼───────┐                              │
│              │   UserOp to   │                              │
│              │   Bundler     │                              │
│              └───────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Coinbase Smart Wallet Integration

#### 3.3.1 Installation

```bash
npm install @coinbase/onchainkit
```

#### 3.3.2 Smart Wallet Provider

```typescript
// lib/smartWallet.ts
import { createConfig } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import { coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: 'OSPM',
      preference: 'smartWalletOnly',
    }),
  ],
});
```

### 3.4 Passkey Configuration

```typescript
// hooks/usePasskey.ts
import { usePrivy } from '@privy-io/react-auth';

export function usePasskey() {
  const { user, linkPasskey, unlinkPasskey } = usePrivy();

  const hasPasskey = user?.linkedAccounts?.some(
    (account) => account.type === 'passkey'
  );

  const setupPasskey = async () => {
    try {
      await linkPasskey();
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  };

  return {
    hasPasskey,
    setupPasskey,
    removePasskey: unlinkPasskey,
  };
}
```

### 3.5 Transaction Signing Flow

```typescript
// hooks/useSmartWalletTransaction.ts
import { useSendTransaction } from 'wagmi';
import { encodeFunctionData } from 'viem';

export function useSmartWalletTransaction() {
  const { sendTransaction, isPending, isSuccess, error } = useSendTransaction();

  const executeTrade = async (
    marketAddress: `0x${string}`,
    outcome: boolean,
    amount: bigint
  ) => {
    const data = encodeFunctionData({
      abi: BinaryMarketABI,
      functionName: 'placeBet',
      args: [outcome, amount],
    });

    return sendTransaction({
      to: marketAddress,
      data,
      value: 0n,
    });
  };

  return {
    executeTrade,
    isPending,
    isSuccess,
    error,
  };
}
```

### 3.6 Wallet Recovery Strategy

```typescript
// Recovery options for users
const recoveryConfig = {
  // Primary: Passkey (FaceID/TouchID)
  passkey: {
    enabled: true,
    platform: 'cross-platform',
  },
  // Secondary: Email recovery
  email: {
    enabled: true,
    verificationRequired: true,
  },
  // Tertiary: Phone recovery
  phone: {
    enabled: true,
    otpLength: 6,
  },
};
```

### 3.7 Deliverables Checklist

- [ ] Coinbase Smart Wallet SDK integrated
- [ ] Smart wallet created for new users
- [ ] Passkey enrollment flow implemented
- [ ] FaceID/TouchID transaction signing working
- [ ] Wallet recovery mechanism configured
- [ ] Multi-signer setup (Passkey + EOA)
- [ ] Transaction simulation before execution

---

## Section 4: Smart Contracts - Token & Core

### 4.1 Overview

The $PLAY token is the play-money currency of the platform. It includes a faucet function allowing new users to claim tokens for free.

### 4.2 $PLAY Token Contract

```solidity
// contracts/src/PlayToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PlayToken is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 1000 * 10**18; // 1,000 PLAY
    uint256 public constant FAUCET_COOLDOWN = 24 hours;
    
    mapping(address => uint256) public lastFaucetClaim;
    
    event FaucetClaimed(address indexed user, uint256 amount);
    
    constructor() ERC20("OSPM Play Token", "PLAY") Ownable(msg.sender) {
        // Mint initial supply to deployer for liquidity
        _mint(msg.sender, 1_000_000 * 10**18);
    }
    
    /**
     * @notice Claim free PLAY tokens (once per 24 hours)
     */
    function faucet() external {
        require(
            block.timestamp >= lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN,
            "Faucet: cooldown not elapsed"
        );
        
        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }
    
    /**
     * @notice Check if user can claim faucet
     */
    function canClaimFaucet(address user) external view returns (bool) {
        return block.timestamp >= lastFaucetClaim[user] + FAUCET_COOLDOWN;
    }
    
    /**
     * @notice Time remaining until next faucet claim
     */
    function timeUntilNextClaim(address user) external view returns (uint256) {
        uint256 nextClaimTime = lastFaucetClaim[user] + FAUCET_COOLDOWN;
        if (block.timestamp >= nextClaimTime) return 0;
        return nextClaimTime - block.timestamp;
    }
    
    /**
     * @notice Admin mint for special events/promotions
     */
    function adminMint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
```

### 4.3 Contract Configuration

```typescript
// lib/contracts/playToken.ts
export const PLAY_TOKEN_ABI = [
  // Read functions
  'function balanceOf(address account) view returns (uint256)',
  'function canClaimFaucet(address user) view returns (bool)',
  'function timeUntilNextClaim(address user) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  
  // Write functions
  'function faucet() external',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  
  // Events
  'event FaucetClaimed(address indexed user, uint256 amount)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
] as const;
```

### 4.4 Frontend Integration

```typescript
// hooks/usePlayToken.ts
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';

export function usePlayToken() {
  const { address } = useAccount();
  
  // Read balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: PLAY_TOKEN_ADDRESS,
    abi: PLAY_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  // Check faucet availability
  const { data: canClaim } = useReadContract({
    address: PLAY_TOKEN_ADDRESS,
    abi: PLAY_TOKEN_ABI,
    functionName: 'canClaimFaucet',
    args: [address!],
    query: { enabled: !!address },
  });

  // Claim faucet
  const { writeContract, data: hash, isPending } = useWriteContract();
  
  const claimFaucet = () => {
    writeContract({
      address: PLAY_TOKEN_ADDRESS,
      abi: PLAY_TOKEN_ABI,
      functionName: 'faucet',
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    balance: balance ? formatEther(balance) : '0',
    canClaim,
    claimFaucet,
    isPending: isPending || isConfirming,
    isSuccess,
    refetchBalance,
  };
}
```

### 4.5 Faucet UI Component

```typescript
// components/FaucetButton.tsx
'use client';

import { usePlayToken } from '@/hooks/usePlayToken';

export function FaucetButton() {
  const { canClaim, claimFaucet, isPending, isSuccess } = usePlayToken();

  return (
    <button
      onClick={claimFaucet}
      disabled={!canClaim || isPending}
      className="btn-primary"
    >
      {isPending ? 'Claiming...' : 'Claim 1,000 $PLAY'}
    </button>
  );
}
```

### 4.6 Deployment Script

```typescript
// contracts/script/DeployPlayToken.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PlayToken.sol";

contract DeployPlayToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        PlayToken token = new PlayToken();
        
        console.log("PlayToken deployed at:", address(token));
        
        vm.stopBroadcast();
    }
}
```

### 4.7 Deliverables Checklist

- [ ] PlayToken.sol contract written and tested
- [ ] Faucet function with 24-hour cooldown
- [ ] Contract deployed to Base Sepolia
- [ ] Contract verified on BaseScan
- [ ] Frontend hook for token interactions
- [ ] "Claim 1,000 $PLAY" button working
- [ ] Balance display component
- [ ] Token approval flow for markets

---

## Section 5: Smart Contracts - Market System

### 5.1 Overview

The market system consists of two contracts: `MarketFactory` (deploys new markets) and `BinaryMarket` (handles individual market logic, betting, and settlement).

### 5.2 BinaryMarket Contract (LMSR)

The market uses **Logarithmic Market Scoring Rule (LMSR)** for automated market making:

- **Cost function:** `C(q) = b × ln(exp(qYes/b) + exp(qNo/b))`
- **Price of YES:** `exp(qYes/b) / (exp(qYes/b) + exp(qNo/b))`
- **Liquidity parameter `b`:** Controls price sensitivity (higher = more stable prices)
- **Max market maker loss:** `b × ln(2)` (bounded subsidy)

```solidity
// contracts/src/BinaryMarket.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LMSR.sol";

contract BinaryMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum MarketStatus { OPEN, CLOSED, PROPOSED, RESOLVED, DISPUTED }
    
    struct Bet {
        uint256 shares;      // Shares purchased
        bool outcome;        // YES = true, NO = false
        uint256 costBasis;   // Tokens spent
        bool claimed;
    }

    // Immutables
    IERC20 public immutable playToken;
    address public immutable oracle;
    address public immutable factory;
    
    // Market details
    string public question;
    string public sourceUrl;
    uint256 public bettingCloseTimestamp;
    uint256 public resolutionTimestamp;
    
    // Market state
    MarketStatus public status;
    bool public resolvedOutcome;
    uint256 public proposedTimestamp;
    uint256 public constant DISPUTE_WINDOW = 2 hours;
    
    // LMSR state
    uint256 public immutable b;  // Liquidity parameter (scaled 1e18)
    int256 public qYes;          // Outstanding YES shares (scaled 1e18)
    int256 public qNo;           // Outstanding NO shares (scaled 1e18)
    
    mapping(address => Bet) public bets;
    
    // Events
    event BetPlaced(address indexed user, bool outcome, uint256 shares, uint256 cost);
    event MarketResolutionProposed(bool outcome, uint256 timestamp);
    event MarketResolved(bool outcome);
    event MarketDisputed(address indexed disputer, string reason);
    event WinningsClaimed(address indexed user, uint256 amount);
    
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle");
        _;
    }
    
    modifier marketOpen() {
        require(status == MarketStatus.OPEN, "Market not open");
        require(block.timestamp < bettingCloseTimestamp, "Betting closed");
        _;
    }

    constructor(
        address _playToken,
        address _oracle,
        string memory _question,
        string memory _sourceUrl,
        uint256 _bettingCloseTimestamp,
        uint256 _resolutionTimestamp,
        uint256 _liquidityParameter
    ) {
        playToken = IERC20(_playToken);
        oracle = _oracle;
        factory = msg.sender;
        question = _question;
        sourceUrl = _sourceUrl;
        bettingCloseTimestamp = _bettingCloseTimestamp;
        resolutionTimestamp = _resolutionTimestamp;
        b = _liquidityParameter;
        status = MarketStatus.OPEN;
    }

    /**
     * @notice Calculate cost to buy shares using LMSR
     * @param _outcome true = YES, false = NO
     * @param _shares Number of shares to buy (scaled 1e18)
     * @return cost Token cost for the shares
     */
    function costToBuy(bool _outcome, int256 _shares) public view returns (uint256 cost) {
        int256 newQYes = _outcome ? qYes + _shares : qYes;
        int256 newQNo = _outcome ? qNo : qNo + _shares;
        
        uint256 currentCost = LMSR.cost(qYes, qNo, b);
        uint256 newCost = LMSR.cost(newQYes, newQNo, b);
        
        return newCost > currentCost ? newCost - currentCost : 0;
    }

    /**
     * @notice Place a bet using LMSR pricing
     * @param _outcome true = YES, false = NO
     * @param _maxCost Maximum tokens willing to spend
     * @return shares Number of shares received
     */
    function placeBet(bool _outcome, uint256 _maxCost) external nonReentrant marketOpen returns (uint256 shares) {
        require(_maxCost > 0, "Amount must be > 0");
        require(bets[msg.sender].shares == 0, "Already placed bet");
        
        // Binary search for shares that match maxCost
        shares = LMSR.sharesForCost(_outcome, qYes, qNo, b, _maxCost);
        uint256 actualCost = costToBuy(_outcome, int256(shares));
        
        require(actualCost <= _maxCost, "Cost exceeds max");
        playToken.safeTransferFrom(msg.sender, address(this), actualCost);
        
        // Update LMSR state
        if (_outcome) {
            qYes += int256(shares);
        } else {
            qNo += int256(shares);
        }
        
        bets[msg.sender] = Bet({
            shares: shares,
            outcome: _outcome,
            costBasis: actualCost,
            claimed: false
        });
        
        emit BetPlaced(msg.sender, _outcome, shares, actualCost);
        return shares;
    }

    /**
     * @notice Get current LMSR prices (probabilities)
     * @return pYes Probability of YES (0-1e18)
     * @return pNo Probability of NO (0-1e18)
     */
    function getOdds() external view returns (uint256 pYes, uint256 pNo) {
        return LMSR.prices(qYes, qNo, b);
    }

    /**
     * @notice Oracle proposes the market resolution
     */
    function proposeResolution(bool _outcome) external onlyOracle {
        require(status == MarketStatus.OPEN || status == MarketStatus.CLOSED, "Invalid status");
        require(block.timestamp >= resolutionTimestamp, "Too early to resolve");
        
        status = MarketStatus.PROPOSED;
        resolvedOutcome = _outcome;
        proposedTimestamp = block.timestamp;
        
        emit MarketResolutionProposed(_outcome, block.timestamp);
    }

    /**
     * @notice Finalize resolution after dispute window
     */
    function finalizeResolution() external {
        require(status == MarketStatus.PROPOSED, "Not in proposed state");
        require(block.timestamp >= proposedTimestamp + DISPUTE_WINDOW, "Dispute window active");
        
        status = MarketStatus.RESOLVED;
        emit MarketResolved(resolvedOutcome);
    }

    /**
     * @notice Dispute the proposed resolution
     */
    function disputeResolution(string calldata _reason) external {
        require(status == MarketStatus.PROPOSED, "Not in proposed state");
        require(block.timestamp < proposedTimestamp + DISPUTE_WINDOW, "Dispute window closed");
        require(bets[msg.sender].shares > 0, "Must have bet to dispute");
        
        status = MarketStatus.DISPUTED;
        emit MarketDisputed(msg.sender, _reason);
    }

    /**
     * @notice Claim winnings after market resolution
     * Winners receive 1 token per winning share
     */
    function claimWinnings() external nonReentrant {
        require(status == MarketStatus.RESOLVED, "Market not resolved");
        
        Bet storage bet = bets[msg.sender];
        require(bet.shares > 0, "No bet placed");
        require(!bet.claimed, "Already claimed");
        require(bet.outcome == resolvedOutcome, "Did not win");
        
        bet.claimed = true;
        
        // In LMSR, winning shares pay out 1:1
        uint256 payout = bet.shares;
        playToken.safeTransfer(msg.sender, payout);
        
        emit WinningsClaimed(msg.sender, payout);
    }
}
```

### 5.2.1 LMSR Library

```solidity
// contracts/src/LMSR.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LMSR - Logarithmic Market Scoring Rule
 * @notice Pure math library for LMSR calculations
 * @dev All values scaled by 1e18 for precision
 */
library LMSR {
    uint256 constant SCALE = 1e18;
    
    /**
     * @notice Calculate LMSR cost function value
     * @dev C(q) = b * ln(exp(qYes/b) + exp(qNo/b))
     * Uses log-sum-exp trick for numerical stability
     */
    function cost(int256 qYes, int256 qNo, uint256 b) internal pure returns (uint256) {
        // Implementation uses PRBMath or similar for exp/ln
        // Simplified here for documentation
        int256 a = (qYes * int256(SCALE)) / int256(b);
        int256 d = (qNo * int256(SCALE)) / int256(b);
        
        int256 maxVal = a > d ? a : d;
        uint256 expA = exp(a - maxVal);
        uint256 expD = exp(d - maxVal);
        
        return (b * (uint256(maxVal) + ln(expA + expD))) / SCALE;
    }
    
    /**
     * @notice Calculate current prices (probabilities)
     * @return pYes Probability of YES outcome (0-1e18)
     * @return pNo Probability of NO outcome (0-1e18)
     */
    function prices(int256 qYes, int256 qNo, uint256 b) internal pure returns (uint256 pYes, uint256 pNo) {
        int256 a = (qYes * int256(SCALE)) / int256(b);
        int256 d = (qNo * int256(SCALE)) / int256(b);
        
        int256 maxVal = a > d ? a : d;
        uint256 expA = exp(a - maxVal);
        uint256 expD = exp(d - maxVal);
        uint256 sum = expA + expD;
        
        pYes = (expA * SCALE) / sum;
        pNo = (expD * SCALE) / sum;
    }
    
    /**
     * @notice Binary search for shares given a cost budget
     */
    function sharesForCost(
        bool outcome,
        int256 qYes,
        int256 qNo,
        uint256 b,
        uint256 maxCost
    ) internal pure returns (uint256 shares) {
        // Binary search implementation
        uint256 low = 0;
        uint256 high = maxCost * 10; // Upper bound heuristic
        
        for (uint256 i = 0; i < 50; i++) {
            uint256 mid = (low + high) / 2;
            uint256 c = costForShares(outcome, qYes, qNo, b, mid);
            
            if (c > maxCost) {
                high = mid;
            } else {
                low = mid;
            }
        }
        
        return low;
    }
    
    // Note: exp() and ln() implementations would use a math library like PRBMath
    function exp(int256 x) internal pure returns (uint256) { /* ... */ }
    function ln(uint256 x) internal pure returns (uint256) { /* ... */ }
}
```

### 5.3 MarketFactory Contract

```solidity
// contracts/src/MarketFactory.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BinaryMarket.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MarketFactory is Ownable {
    address public playToken;
    address public oracle;
    uint256 public defaultLiquidity = 100 * 1e18; // Default b parameter
    
    address[] public markets;
    mapping(address => bool) public isMarket;
    
    event MarketCreated(
        address indexed market,
        string question,
        uint256 bettingCloseTimestamp,
        uint256 resolutionTimestamp,
        uint256 liquidityParameter
    );
    
    constructor(address _playToken, address _oracle) Ownable(msg.sender) {
        playToken = _playToken;
        oracle = _oracle;
    }

    /**
     * @notice Create a new prediction market with LMSR pricing
     * @param _question The market question
     * @param _sourceUrl URL for result verification
     * @param _bettingCloseTimestamp When betting closes (15 min before event)
     * @param _resolutionTimestamp When market can be resolved
     * @param _liquidityParameter LMSR b parameter (0 = use default)
     */
    function createMarket(
        string calldata _question,
        string calldata _sourceUrl,
        uint256 _bettingCloseTimestamp,
        uint256 _resolutionTimestamp,
        uint256 _liquidityParameter
    ) external onlyOwner returns (address) {
        require(_bettingCloseTimestamp < _resolutionTimestamp, "Invalid timestamps");
        require(_bettingCloseTimestamp > block.timestamp, "Close time in past");
        
        uint256 liquidity = _liquidityParameter > 0 ? _liquidityParameter : defaultLiquidity;
        
        BinaryMarket market = new BinaryMarket(
            playToken,
            oracle,
            _question,
            _sourceUrl,
            _bettingCloseTimestamp,
            _resolutionTimestamp,
            liquidity
        );
        
        address marketAddress = address(market);
        markets.push(marketAddress);
        isMarket[marketAddress] = true;
        
        emit MarketCreated(
            marketAddress,
            _question,
            _bettingCloseTimestamp,
            _resolutionTimestamp,
            liquidity
        );
        
        return marketAddress;
    }

    /**
     * @notice Get all market addresses
     */
    function getMarkets() external view returns (address[] memory) {
        return markets;
    }

    /**
     * @notice Get market count
     */
    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    /**
     * @notice Update oracle address
     */
    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }
    
    /**
     * @notice Update default liquidity parameter
     */
    function setDefaultLiquidity(uint256 _liquidity) external onlyOwner {
        defaultLiquidity = _liquidity;
    }
}
```

### 5.4 Anti-Frontrunning Mechanism

```
Event Time: 3:00 PM
Betting Close: 2:45 PM (15 minutes before)
Resolution Time: 5:00 PM (after event concludes)

Timeline:
├─────────────────┼──────────────┼─────────────────┤
Open             2:45 PM      3:00 PM         5:00 PM
(Betting)        (Close)      (Event)         (Resolve)
```

### 5.5 Dispute Window Flow

```
Resolution Proposed ──► 2-Hour Window ──► Finalized
                           │
                           ▼
                    User Dispute ──► Admin Review ──► Manual Resolution
```

### 5.6 Deliverables Checklist

- [ ] BinaryMarket.sol contract written and tested
- [ ] MarketFactory.sol contract written and tested
- [ ] Anti-frontrunning timestamp logic (15 min buffer)
- [ ] 2-hour dispute window implemented
- [ ] Contracts deployed to Base Sepolia
- [ ] Contracts verified on BaseScan
- [ ] Frontend hooks for market interactions
- [ ] One manual market deployed and resolved

### 5.7 Contract Upgradeability Strategy

**MVP (Testnet):** No upgradeability. Simple redeploy when changes needed.

```
Deploy V1 → Bug found → Deploy V2 → Update addresses in env
```

- Old markets remain functional at their addresses
- New markets deploy from new factory
- Database stores each market's individual contract address

**Production (Mainnet):** Consider proxy patterns:

| Contract | Pattern | Reason |
|----------|---------|--------|
| PlayToken | No upgrade | Simple ERC20, rarely changes |
| MarketFactory | UUPS Proxy | May add features |
| BinaryMarket | Beacon Proxy | All markets share implementation |

**Why old markets stay functional:**
- Factory address only used for creating NEW markets
- Each market's `contractAddress` stored in DB
- Oracle reads from DB, not factory
- Funds/bets are in individual market contracts, not factory

---

## Section 5.8: Data Flow & Responsibilities

### On-Chain vs Off-Chain Data

| Data | On-Chain | Database | Why |
|------|----------|----------|-----|
| `question` | Yes | Yes | Chain for transparency, DB for queries |
| `sourceUrl` | Yes | Yes | Chain for verification, DB for indexing |
| `timestamps` | Yes | Yes | Both need scheduling info |
| `b` (LMSR liquidity) | Yes | Yes | Chain authoritative, DB for fast reads |
| `qYes`, `qNo` (LMSR shares) | Yes | Yes (cached) | Chain authoritative, DB for fast reads |
| `bets` | Yes | Yes (indexed) | Chain authoritative, DB for history |
| `category` | No | Yes | UX only, not needed on-chain |
| `description` | No | Yes | UX only, not needed on-chain |
| `imageUrl` | No | Yes | UX only |
| `verificationKeywords` | No | Yes | Oracle needs for resolution |
| `aiContext` | No | Yes | Debugging, audit trail |
| LMSR prices | Computed | Computed | Derived from `qYes`, `qNo`, `b` |

### Data Consistency

```
┌─────────────────────────────────────────────────────────────┐
│                    SOURCE OF TRUTH                          │
├─────────────────────────────────────────────────────────────┤
│  CHAIN: Funds, bets, LMSR state (b, qYes, qNo), resolution  │
│         → Trustless, anyone can verify                      │
│                                                             │
│  DATABASE: Market metadata, user profiles, AI context       │
│           → Fast queries, rich data, can be rebuilt         │
│             from chain events if needed                     │
└─────────────────────────────────────────────────────────────┘
```

**If chain and DB diverge:** Chain is authoritative for funds/bets/LMSR state. DB can be rebuilt by replaying chain events (indexer pattern).

---

## Section 6: Frontend Application

### 6.1 Overview

The frontend is a Next.js 15 application with App Router, deployed on Vercel. It provides market discovery, trading interface, and user dashboard.

### 6.2 Page Structure

```
app/
├── layout.tsx              # Root layout with providers
├── page.tsx                # Homepage / Market discovery
├── globals.css             # Global styles
├── markets/
│   ├── page.tsx            # All markets list
│   └── [address]/
│       └── page.tsx        # Individual market page
├── dashboard/
│   └── page.tsx            # User dashboard (bets, history)
├── leaderboard/
│   └── page.tsx            # Top traders
├── how-it-works/
│   └── page.tsx            # Explainer page
└── api/
    ├── markets/
    │   └── route.ts        # Proxy to VPS API
    └── user/
        └── route.ts        # User data endpoints
```

### 6.3 Key Components

```
components/
├── auth/
│   ├── LoginButton.tsx     # Privy login trigger
│   ├── UserMenu.tsx        # Logged-in user dropdown
│   └── AuthGuard.tsx       # Protected route wrapper
├── market/
│   ├── MarketCard.tsx      # Market preview card
│   ├── MarketList.tsx      # Grid of market cards
│   ├── MarketDetail.tsx    # Full market view
│   └── MarketFilters.tsx   # Category/status filters
├── trading/
│   ├── TradePanel.tsx      # Buy YES/NO interface
│   ├── PriceChart.tsx      # Odds visualization
│   ├── TradeHistory.tsx    # User's bet history
│   └── AlreadyTraded.tsx   # Post-bet view
├── wallet/
│   ├── WalletBalance.tsx   # $PLAY balance display
│   ├── FaucetButton.tsx    # Claim tokens
│   └── PasskeySetup.tsx    # Enable FaceID/TouchID
└── ui/
    ├── Button.tsx
    ├── Card.tsx
    ├── Modal.tsx
    └── Toast.tsx
```

### 6.4 State Management

```typescript
// lib/wagmi.ts
import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'viem/chains';

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
});
```

### 6.5 Market Discovery Page

```typescript
// app/page.tsx
import { MarketList } from '@/components/market/MarketList';
import { MarketFilters } from '@/components/market/MarketFilters';

export default async function HomePage() {
  const markets = await fetchMarkets();
  
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Active Markets</h1>
      <MarketFilters />
      <MarketList markets={markets} />
    </main>
  );
}

async function fetchMarkets() {
  const res = await fetch(`${process.env.VPS_API_URL}/markets`, {
    headers: { 'X-OSPM-Secret': process.env.VPS_API_SECRET! },
    next: { revalidate: 60 },
  });
  return res.json();
}
```

### 6.6 Trade Panel Component

```typescript
// components/trading/TradePanel.tsx
'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

interface TradePanelProps {
  marketAddress: `0x${string}`;
  yesOdds: number;
  noOdds: number;
}

export function TradePanel({ marketAddress, yesOdds, noOdds }: TradePanelProps) {
  const [outcome, setOutcome] = useState<boolean | null>(null);
  const [amount, setAmount] = useState('');
  
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const handleTrade = async () => {
    if (outcome === null || !amount) return;
    
    // First approve tokens
    await writeContract({
      address: PLAY_TOKEN_ADDRESS,
      abi: PLAY_TOKEN_ABI,
      functionName: 'approve',
      args: [marketAddress, parseEther(amount)],
    });
    
    // Then place bet
    writeContract({
      address: marketAddress,
      abi: BINARY_MARKET_ABI,
      functionName: 'placeBet',
      args: [outcome, parseEther(amount)],
    });
  };

  return (
    <div className="trade-panel">
      <div className="outcome-buttons">
        <button 
          className={`yes-btn ${outcome === true ? 'selected' : ''}`}
          onClick={() => setOutcome(true)}
        >
          YES ({yesOdds}%)
        </button>
        <button 
          className={`no-btn ${outcome === false ? 'selected' : ''}`}
          onClick={() => setOutcome(false)}
        >
          NO ({noOdds}%)
        </button>
      </div>
      
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount in $PLAY"
      />
      
      <button 
        onClick={handleTrade}
        disabled={isPending || isConfirming || outcome === null}
      >
        {isPending || isConfirming ? 'Processing...' : 'Place Bet'}
      </button>
    </div>
  );
}
```

### 6.7 Responsive Design Requirements

- Mobile-first approach
- Touch-friendly bet buttons (minimum 44px tap targets)
- Swipe gestures for market navigation
- Bottom sheet for trade panel on mobile
- Progressive Web App (PWA) support

### 6.8 Deliverables Checklist

- [ ] Next.js 15 App Router structure
- [ ] Privy + wagmi providers configured
- [ ] Homepage with market discovery
- [ ] Individual market page with trading
- [ ] User dashboard with bet history
- [ ] Wallet balance and faucet integration
- [ ] Responsive design for mobile
- [ ] Loading states and error handling
- [ ] Toast notifications for transactions
- [ ] Deployed to Vercel

---

## Section 7: Backend Services & Database

### 7.1 Overview

The backend runs on AWS Lightsail VPS, hosting the PostgreSQL database, API layer, and background services (Oracle, AI Agent).

### 7.2 VPS Setup

```bash
# AWS Lightsail: Ubuntu 22.04, 2GB RAM minimum

# 1. Initial setup
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm postgresql postgresql-contrib nginx

# 2. Setup 2GB Swap (prevent build crashes)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 3. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Install PM2 for process management
sudo npm install -g pm2
```

### 7.3 Database Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(cuid())
  privyUserId   String   @unique
  address       String   @unique
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  bets          Bet[]
}

model Market {
  id                    String       @id @default(cuid())
  contractAddress       String?      @unique  // Null until deployed on-chain
  question              String
  description           String?
  category              String
  sourceUrl             String
  imageUrl              String?
  
  bettingCloseTimestamp DateTime
  resolutionTimestamp   DateTime
  
  status                MarketStatus @default(PENDING)
  resolvedOutcome       Boolean?
  
  // LMSR state (cached from chain for fast reads)
  b                     Float        @default(100)  // Liquidity parameter
  qYes                  Float        @default(0)    // Outstanding YES shares
  qNo                   Float        @default(0)    // Outstanding NO shares
  
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  deployedAt            DateTime?
  resolvedAt            DateTime?
  
  bets                  Bet[]
  aiLogs                AILog[]
}

model Bet {
  id            String   @id @default(cuid())
  userId        String?           // Null for anonymous/pre-auth bets
  marketId      String
  txHash        String?  @unique  // Null for off-chain bets
  
  outcome       Boolean           // true = YES, false = NO
  shares        Decimal  @db.Decimal(36, 18)  // LMSR shares purchased
  costBasis     Decimal  @db.Decimal(36, 18)  // Tokens spent
  
  claimed       Boolean  @default(false)
  claimTxHash   String?
  
  createdAt     DateTime @default(now())
  
  user          User?    @relation(fields: [userId], references: [id])
  market        Market   @relation(fields: [marketId], references: [id])
  
  @@index([userId])
  @@index([marketId])
}

model AILog {
  id          String   @id @default(cuid())
  marketId    String?
  prompt      String
  response    String
  model       String
  tokensUsed  Int
  createdAt   DateTime @default(now())
  
  market      Market?  @relation(fields: [marketId], references: [id])
}

enum MarketStatus {
  PENDING
  DEPLOYED
  OPEN
  CLOSED
  PROPOSED
  DISPUTED
  RESOLVED
  CANCELLED
}
```

### 7.4 API Layer

```typescript
// server/api/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
});
app.use(limiter);

// API authentication
app.use((req, res, next) => {
  const secret = req.headers['x-ospm-secret'];
  if (secret !== process.env.VPS_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Routes
app.use('/api/markets', marketsRouter);
app.use('/api/users', usersRouter);
app.use('/api/oracle', oracleRouter);
app.use('/api/admin', adminRouter);

app.listen(3001, () => {
  console.log('API server running on port 3001');
});
```

### 7.5 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/markets` | List all markets (with filters) |
| GET | `/api/markets/:address` | Get market details |
| POST | `/api/markets` | Create new market (admin) |
| GET | `/api/users/:address/bets` | Get user's bet history |
| POST | `/api/oracle/propose` | Propose market resolution |
| POST | `/api/oracle/finalize` | Finalize resolution |
| GET | `/api/admin/pending` | Markets pending resolution |

### 7.6 Database Backup Script

```bash
#!/bin/bash
# scripts/backup_db.sh

BACKUP_DIR="/var/backups/postgres"
S3_BUCKET="ospm-backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="ospm_backup_${DATE}.sql.gz"

# Create backup
pg_dump $DATABASE_URL | gzip > "${BACKUP_DIR}/${FILENAME}"

# Upload to S3
aws s3 cp "${BACKUP_DIR}/${FILENAME}" "s3://${S3_BUCKET}/${FILENAME}"

# Keep only last 7 days locally
find ${BACKUP_DIR} -type f -mtime +7 -delete

echo "Backup completed: ${FILENAME}"
```

### 7.7 Cron Jobs

```bash
# /etc/cron.d/ospm

# Daily database backup at 3 AM
0 3 * * * ospm /home/ospm/scripts/backup_db.sh >> /var/log/ospm/backup.log 2>&1

# Check for expired markets every 5 minutes
*/5 * * * * ospm /home/ospm/server/oracle/check_expired.sh >> /var/log/ospm/oracle.log 2>&1

# AI market generation daily at 8 AM
0 8 * * * ospm /home/ospm/ai/generate_markets.sh >> /var/log/ospm/ai.log 2>&1
```

### 7.8 Deliverables Checklist

- [ ] AWS Lightsail VPS provisioned
- [ ] 2GB swap configured
- [ ] PostgreSQL installed and configured
- [ ] Prisma schema migrated
- [ ] Express API server running with PM2
- [ ] Nginx reverse proxy configured
- [ ] SSL certificate (Let's Encrypt)
- [ ] Rate limiting enabled
- [ ] API authentication via X-OSPM-Secret header
- [ ] Daily database backup to S3
- [ ] Monitoring and logging setup

---

## Section 8: Data Service

### 8.1 Overview

The Data Service is a Python HTTP microservice that provides scraping, AI market generation, and outcome verification capabilities. It is called by the Oracle Service (Node.js) and does NOT directly write to the database or deploy contracts—the Oracle handles all persistence and blockchain interactions.

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SERVICE (Python)                     │
│                                                             │
│  HTTP Endpoints:                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ POST /generate-markets                               │   │
│  │   → Scrapes sources, generates market proposals      │   │
│  │   → Returns: [{question, sourceUrl, keywords, ...}]  │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ POST /verify-outcome                                 │   │
│  │   → Checks source URL for resolution                 │   │
│  │   → Returns: {outcome: YES|NO|UNKNOWN, confidence}   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Called by: Oracle Service (Node.js)                        │
│  Does NOT: Write to DB, deploy contracts, hold keys         │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Data Sources (Nigeria Focus)

| Source | Type | URL Pattern |
|--------|------|-------------|
| NBS | Economic Stats | https://nigerianstat.gov.ng |
| NPFL | Football | https://npfl.ng |
| News | Current Events | RSS feeds from major outlets |
| CBN | Finance | https://cbn.gov.ng |

### 8.3 FastAPI Application

```python
# data-service/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import asyncio

app = FastAPI(title="OSPM Data Service")

class MarketProposal(BaseModel):
    question: str
    description: str
    category: str
    source_url: str
    betting_close_offset_hours: int
    resolution_offset_hours: int
    verification_keywords: List[str]

class GenerateMarketsRequest(BaseModel):
    target_count: int = 5
    categories: Optional[List[str]] = None

class GenerateMarketsResponse(BaseModel):
    proposals: List[MarketProposal]
    scraped_count: int
    generated_count: int

class VerifyOutcomeRequest(BaseModel):
    source_url: str
    verification_keywords: List[str]
    question: str

class VerifyOutcomeResponse(BaseModel):
    outcome: Optional[bool]  # True=YES, False=NO, None=UNKNOWN
    confidence: float
    evidence: str

@app.post("/generate-markets", response_model=GenerateMarketsResponse)
async def generate_markets(request: GenerateMarketsRequest):
    """
    Scrape data sources and generate market proposals.
    Called by Oracle Service on schedule (e.g., daily at 8 AM).
    """
    # 1. Run scrapers
    events = await run_all_scrapers()
    
    # 2. Generate proposals via AI
    proposals = []
    for event in events[:request.target_count * 2]:
        proposal = await generate_market_proposal(event)
        if proposal:
            # 3. Validate each proposal
            is_valid, _ = await validate_proposal(proposal)
            if is_valid:
                proposals.append(proposal)
    
    return GenerateMarketsResponse(
        proposals=proposals[:request.target_count],
        scraped_count=len(events),
        generated_count=len(proposals)
    )

@app.post("/verify-outcome", response_model=VerifyOutcomeResponse)
async def verify_outcome(request: VerifyOutcomeRequest):
    """
    Verify market outcome by checking source URL.
    Called by Oracle Service when market reaches resolution time.
    """
    result = await fetch_and_analyze_outcome(
        request.source_url,
        request.verification_keywords,
        request.question
    )
    return result

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

### 8.4 Scraper Architecture

```python
# data-service/scraper/base.py
from dataclasses import dataclass
from typing import List
from abc import ABC, abstractmethod

@dataclass
class ScrapedEvent:
    title: str
    description: str
    source_url: str
    event_date: str
    category: str
    raw_data: dict

class BaseScraper(ABC):
    @abstractmethod
    async def scrape(self) -> List[ScrapedEvent]:
        pass

# data-service/scraper/npfl.py
class NPFLScraper(BaseScraper):
    BASE_URL = "https://npfl.ng/fixtures"
    
    async def scrape(self) -> List[ScrapedEvent]:
        async with aiohttp.ClientSession() as session:
            async with session.get(self.BASE_URL) as response:
                html = await response.text()
                return self.parse_fixtures(html)

# data-service/scraper/__init__.py
async def run_all_scrapers() -> List[ScrapedEvent]:
    scrapers = [NPFLScraper(), NBSScraper(), NewsScraper()]
    all_events = []
    for scraper in scrapers:
        try:
            events = await scraper.scrape()
            all_events.extend(events)
        except Exception as e:
            logger.error(f"Scraper {scraper.__class__.__name__} failed: {e}")
    return all_events
```

### 8.5 AI Market Generator

```python
# data-service/generator/market_generator.py
import openai
import json
from typing import Optional
from ..scraper import ScrapedEvent
from ..main import MarketProposal

SYSTEM_PROMPT = """You are a prediction market creator for OSPM.
Generate binary YES/NO market questions from news events.

Rules:
1. Questions must be objectively verifiable
2. Questions should be interesting and engaging
3. Include the exact verification keywords
4. Set appropriate timeframes
5. Keep questions concise (< 100 chars)

Output JSON format:
{
  "question": "Will [event] happen by [date]?",
  "description": "Context about the event...",
  "category": "sports|politics|economics|entertainment",
  "source_url": "verification URL",
  "betting_close_offset_hours": 1-24,
  "resolution_offset_hours": 2-48,
  "verification_keywords": ["keyword1", "keyword2"]
}
"""

async def generate_market_proposal(event: ScrapedEvent) -> Optional[MarketProposal]:
    client = openai.AsyncOpenAI()
    
    response = await client.chat.completions.create(
        model="gpt-4-turbo-preview",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"""
                Event: {event.title}
                Description: {event.description}
                Date: {event.event_date}
                Source: {event.source_url}
                Category: {event.category}
                
                Generate a prediction market for this event.
            """}
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )
    
    try:
        data = json.loads(response.choices[0].message.content)
        return MarketProposal(**data)
    except Exception as e:
        logger.error(f"Failed to parse market proposal: {e}")
        return None
```

### 8.6 Proposal Validation

```python
# data-service/generator/validator.py
import aiohttp
from typing import Tuple
from ..main import MarketProposal

async def validate_proposal(proposal: MarketProposal) -> Tuple[bool, str]:
    """
    Validate market proposal before returning to Oracle:
    1. Source URL returns 200 OK
    2. Page contains verification keywords
    3. Timeframes are reasonable
    """
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(proposal.source_url, timeout=10) as response:
                if response.status != 200:
                    return False, f"Source URL returned {response.status}"
                
                html = await response.text()
                found_keywords = sum(
                    1 for kw in proposal.verification_keywords 
                    if kw.lower() in html.lower()
                )
                
                if found_keywords < len(proposal.verification_keywords) // 2:
                    return False, "Insufficient keyword matches in source"
                    
        except Exception as e:
            return False, f"Failed to fetch source: {e}"
    
    if proposal.betting_close_offset_hours < 1:
        return False, "Betting close too soon"
    
    if proposal.resolution_offset_hours < proposal.betting_close_offset_hours:
        return False, "Resolution before betting close"
    
    return True, "Validation passed"
```

### 8.7 Outcome Verification

```python
# data-service/verifier/outcome_verifier.py
import aiohttp
from typing import Optional
from ..main import VerifyOutcomeResponse

async def fetch_and_analyze_outcome(
    source_url: str,
    verification_keywords: list[str],
    question: str
) -> VerifyOutcomeResponse:
    """
    Fetch source URL and analyze for market outcome.
    Uses keyword matching and sentiment analysis.
    """
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(source_url, timeout=10) as response:
                if response.status != 200:
                    return VerifyOutcomeResponse(
                        outcome=None,
                        confidence=0,
                        evidence=f"Source returned {response.status}"
                    )
                
                html = await response.text()
                text = html.lower()
                
                # Check keyword presence
                keyword_matches = sum(
                    1 for kw in verification_keywords 
                    if kw.lower() in text
                )
                keyword_confidence = keyword_matches / len(verification_keywords)
                
                if keyword_confidence < 0.5:
                    return VerifyOutcomeResponse(
                        outcome=None,
                        confidence=0,
                        evidence="Insufficient keyword matches"
                    )
                
                # Analyze for outcome indicators
                positive = ['won', 'passed', 'approved', 'yes', 'confirmed', 'victory']
                negative = ['lost', 'failed', 'rejected', 'no', 'denied', 'defeat']
                
                pos_count = sum(1 for p in positive if p in text)
                neg_count = sum(1 for n in negative if n in text)
                
                if pos_count > neg_count:
                    outcome = True
                elif neg_count > pos_count:
                    outcome = False
                else:
                    outcome = None
                
                confidence = abs(pos_count - neg_count) / (pos_count + neg_count + 1)
                
                return VerifyOutcomeResponse(
                    outcome=outcome,
                    confidence=confidence,
                    evidence=f"Found {pos_count} positive, {neg_count} negative indicators"
                )
                
    except Exception as e:
        return VerifyOutcomeResponse(
            outcome=None,
            confidence=0,
            evidence=f"Error: {str(e)}"
        )
```

> **Note:** Market deployment and daily scheduling are handled by the Oracle Service (Section 9), not the Data Service. The Data Service is a stateless HTTP utility.

### 8.8 Deliverables Checklist

- [ ] FastAPI application with `/generate-markets` endpoint
- [ ] FastAPI application with `/verify-outcome` endpoint
- [ ] Scraper implementations for 3+ sources (NPFL, NBS, News RSS)
- [ ] OpenAI integration for market generation
- [ ] Proposal validation (URL + keywords)
- [ ] Outcome verification logic
- [ ] Health check endpoint
- [ ] Error handling and logging
- [ ] Unit tests for scrapers and generators
- [ ] Service running on VPS via PM2

---

## Section 9: Oracle Service

### 9.1 Overview

The Oracle Service is the central orchestrator for the entire market lifecycle. It is a Node.js/TypeScript service organized around **two fundamental drivers**:

| Driver | Trigger | Folder | Purpose |
|--------|---------|--------|---------|
| **User Input** | HTTP requests | `server/` | Respond to frontend API calls |
| **Passage of Time** | setInterval tick | `orchestrator/` | Background market lifecycle |

**Key Responsibilities:**

1. **Server (User Input)**: REST API for frontend—fetch markets, authenticate users, read bet history
2. **Orchestrator (Passage of Time)**: Market creation, expiration monitoring, outcome verification, settlement

**Architectural Rules:**

- `server/` never depends on `orchestrator/` (stateless, could be serverless)
- `orchestrator/` never exposes HTTP endpoints (background processing only)
- `shared/` contains only code used by BOTH drivers
- Only the orchestrator calls the Data Service (Python)

The Oracle holds the admin/oracle private key and is the only entity authorized to deploy and resolve markets.

### 9.2 The Two Drivers

The Oracle's internal architecture separates concerns by **what triggers execution**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORACLE SERVICE (Node.js)                             │
│                                                                             │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │         SERVER (User Input)     │  │    ORCHESTRATOR (Passage of Time)│  │
│  │                                 │  │                                 │  │
│  │  Trigger: HTTP Request          │  │  Trigger: setInterval tick      │  │
│  │  State: Stateless               │  │  State: Stateful (lastTickedAt) │  │
│  │  Could be: Serverless           │  │  Must be: Persistent process    │  │
│  │                                 │  │                                 │  │
│  │  ┌───────────────────────────┐  │  │  ┌───────────────────────────┐  │  │
│  │  │ GET /api/markets          │  │  │  │ heart.ts (global tick)    │  │  │
│  │  │ GET /api/markets/:id      │  │  │  │     │                     │  │  │
│  │  │ POST /api/auth/verify     │  │  │  │     ├─► creator.tick()    │  │  │
│  │  │ GET /api/users/:id/bets   │  │  │  │     ├─► monitor.tick()    │  │  │
│  │  └───────────────────────────┘  │  │  │     └─► executor.tick()   │  │  │
│  │              │                  │  │  └───────────────────────────┘  │  │
│  │              │                  │  │              │                  │  │
│  │              │                  │  │              │ HTTP             │  │
│  │              │                  │  │              ▼                  │  │
│  │              │                  │  │  ┌───────────────────────────┐  │  │
│  │              │                  │  │  │   dataServiceClient.ts    │  │  │
│  │              │                  │  │  │   (Bridge to Python)      │  │  │
│  │              │                  │  │  └───────────────────────────┘  │  │
│  │              │                  │  │              │                  │  │
│  └──────────────┼──────────────────┘  └──────────────┼──────────────────┘  │
│                 │                                    │                     │
│                 └────────────────┬───────────────────┘                     │
│                                  ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                           SHARED                                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│  │  │  database/  │  │ blockchain/ │  │notifications│  │   config/   │ │  │
│  │  │  prisma.ts  │  │  client.ts  │  │  service.ts │  │    env.ts   │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
             ┌───────────┐ ┌───────────┐ ┌───────────┐
             │ PostgreSQL│ │   Data    │ │   Base    │
             │    DB     │ │  Service  │ │  Sepolia  │
             └───────────┘ │ (Python)  │ └───────────┘
                           └───────────┘
```

### 9.3 The Tick Mechanism

The orchestrator uses a centralized "heartbeat" pattern where a single `setInterval` drives all background operations:

```typescript
// oracle/src/orchestrator/heart.ts

import type { TickContext, TickHandler } from './types';

class Heart {
  private intervalId: NodeJS.Timeout | null = null;
  private handlers: Map<string, TickHandler> = new Map();
  private tickCount = 0;

  register(name: string, handler: TickHandler) {
    this.handlers.set(name, handler);
  }

  start(intervalMs: number = 60_000) {
    console.log(`Heart starting with ${intervalMs}ms interval`);
    
    this.intervalId = setInterval(async () => {
      this.tickCount++;
      const context: TickContext = {
        tickCount: this.tickCount,
        tickTime: new Date(),
        intervalMs,
      };

      for (const [name, handler] of this.handlers) {
        try {
          await handler.tick(context);
        } catch (error) {
          console.error(`Tick handler "${name}" failed:`, error);
          // Error isolated - other handlers continue
        }
      }
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const heart = new Heart();
```

```typescript
// oracle/src/orchestrator/types.ts

export interface TickContext {
  tickCount: number;
  tickTime: Date;
  intervalMs: number;
}

export interface TickHandler {
  tick(context: TickContext): Promise<void>;
}

// Utility for components to control their own cadence
export function shouldTick(
  lastTickedAt: Date | null,
  tickEveryMs: number,
  currentTime: Date
): boolean {
  if (!lastTickedAt) return true;  // Never ticked, should tick now
  const elapsed = currentTime.getTime() - lastTickedAt.getTime();
  return elapsed >= tickEveryMs;
}
```

**Key Design Decisions:**

| Decision | Rationale |
|----------|-----------|
| Single global interval | Simpler than multiple setIntervals, easier to debug |
| Per-handler try/catch | One failure doesn't stop the heart |
| `shouldTick()` utility | Components control their own cadence (e.g., creator: 24h, monitor: 5m) |
| Handlers registered at startup | Clear dependency injection |

```typescript
// oracle/src/orchestrator/index.ts

import { heart } from './heart';
import { marketCreator } from './markets/creator';
import { marketMonitor } from './markets/monitor';

export function startOrchestrator(intervalMs: number = 60_000) {
  // Register all tick handlers
  heart.register('marketCreator', marketCreator);
  heart.register('marketMonitor', marketMonitor);
  
  // Start the heartbeat
  heart.start(intervalMs);
}

export { heart };
```

### 9.4 Data Service Client

The Data Service Client is the **bridge** between the Oracle (Node.js) and the Data Service (Python). It lives in `orchestrator/` because only time-driven processes call the Python service.

```typescript
// oracle/src/orchestrator/dataServiceClient.ts

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:8000';

interface MarketProposal {
  question: string;
  description: string;
  category: string;
  source_url: string;
  betting_close_offset_hours: number;
  resolution_offset_hours: number;
  verification_keywords: string[];
}

interface GenerateMarketsResponse {
  proposals: MarketProposal[];
  scraped_count: number;
  generated_count: number;
}

interface VerifyOutcomeRequest {
  source_url: string;
  verification_keywords: string[];
  question: string;
}

interface VerifyOutcomeResponse {
  outcome: boolean | null;  // true=YES, false=NO, null=UNKNOWN
  confidence: number;
  evidence: string;
}

export const dataServiceClient = {
  async generateMarkets(targetCount: number = 5): Promise<GenerateMarketsResponse> {
    const response = await fetch(`${DATA_SERVICE_URL}/generate-markets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_count: targetCount }),
    });
    if (!response.ok) throw new Error(`Data Service error: ${response.status}`);
    return response.json();
  },

  async verifyOutcome(request: VerifyOutcomeRequest): Promise<VerifyOutcomeResponse> {
    const response = await fetch(`${DATA_SERVICE_URL}/verify-outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`Data Service error: ${response.status}`);
    return response.json();
  },

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${DATA_SERVICE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  },
};
```

**HTTP Contract with Python Data Service:**

| Endpoint | Called By | Purpose |
|----------|-----------|---------|
| `POST /generate-markets` | `orchestrator/markets/creator.ts` | Scrape + AI → market proposals |
| `POST /verify-outcome` | `orchestrator/markets/monitor.ts` | Check source for resolution |
| `GET /health` | Deployment scripts, heart.ts | Health check |

### 9.5 Orchestrator Layer

The orchestrator layer handles all time-driven operations. Each component implements `TickHandler` and controls its own cadence via `shouldTick()`.

#### 9.5.1 Market Creator

```typescript
// oracle/src/orchestrator/markets/creator.ts

import { shouldTick, type TickContext, type TickHandler } from '../types';
import { dataServiceClient } from '../dataServiceClient';
import { prisma } from '../../shared/database/prisma';
import { deployMarket } from '../../shared/blockchain/contracts';

const TICK_EVERY_MS = 24 * 60 * 60 * 1000; // 24 hours

class MarketCreator implements TickHandler {
  private lastTickedAt: Date | null = null;

  async tick(context: TickContext): Promise<void> {
    if (!shouldTick(this.lastTickedAt, TICK_EVERY_MS, context.tickTime)) return;
    
    console.log(`[MarketCreator] Running at tick ${context.tickCount}`);
    this.lastTickedAt = context.tickTime;

    // 1. Call Data Service for proposals
    const { proposals } = await dataServiceClient.generateMarkets(5);
    console.log(`Received ${proposals.length} market proposals`);

    // 2. Deploy each to chain and store in DB
    for (const proposal of proposals) {
      try {
        const now = Math.floor(Date.now() / 1000);
        const bettingClose = now + (proposal.betting_close_offset_hours * 3600);
        const resolution = now + (proposal.resolution_offset_hours * 3600);

        const address = await deployMarket(
          proposal.question,
          proposal.source_url,
          bettingClose,
          resolution
        );

        await prisma.market.create({
          data: {
            contractAddress: address,
            question: proposal.question,
            description: proposal.description,
            category: proposal.category,
            sourceUrl: proposal.source_url,
            bettingCloseTimestamp: new Date(bettingClose * 1000),
            resolutionTimestamp: new Date(resolution * 1000),
            verificationKeywords: proposal.verification_keywords,
            status: 'OPEN',
            deployedAt: new Date(),
          },
        });

        console.log(`Deployed market: ${address}`);
      } catch (error) {
        console.error(`Failed to deploy: ${proposal.question}`, error);
      }
    }
  }
}

export const marketCreator = new MarketCreator();
```

#### 9.5.2 Market Monitor

```typescript
// oracle/src/orchestrator/markets/monitor.ts

import { shouldTick, type TickContext, type TickHandler } from '../types';
import { dataServiceClient } from '../dataServiceClient';
import { prisma } from '../../shared/database/prisma';
import { notifyAdmin } from '../../shared/notifications/service';
import { marketExecutor } from './executor';

const TICK_EVERY_MS = 5 * 60 * 1000; // 5 minutes

class MarketMonitor implements TickHandler {
  private lastTickedAt: Date | null = null;

  async tick(context: TickContext): Promise<void> {
    if (!shouldTick(this.lastTickedAt, TICK_EVERY_MS, context.tickTime)) return;
    
    console.log(`[MarketMonitor] Running at tick ${context.tickCount}`);
    this.lastTickedAt = context.tickTime;

    await this.checkExpiredMarkets();
    await this.checkProposedMarkets();
  }

  private async checkExpiredMarkets() {
    const expiredMarkets = await prisma.market.findMany({
      where: {
        status: { in: ['OPEN', 'CLOSED'] },
        resolutionTimestamp: { lte: new Date() },
      },
    });

    for (const market of expiredMarkets) {
      console.log(`Market ready for resolution: ${market.id}`);
      await this.resolveMarket(market);
    }
  }

  private async resolveMarket(market: any) {
    try {
      // Call Data Service to verify outcome
      const { outcome, confidence, evidence } = await dataServiceClient.verifyOutcome({
        source_url: market.sourceUrl,
        verification_keywords: market.verificationKeywords,
        question: market.question,
      });

      if (outcome !== null && confidence >= 0.5) {
        await marketExecutor.proposeResolution(market.contractAddress, outcome);
        console.log(`Proposed resolution for ${market.id}: ${outcome ? 'YES' : 'NO'}`);
      } else {
        await prisma.market.update({
          where: { id: market.id },
          data: { status: 'PENDING_RESOLUTION' },
        });
        await notifyAdmin(
          `Market needs manual resolution: ${market.question}\nEvidence: ${evidence}`
        );
      }
    } catch (error) {
      console.error(`Failed to resolve market ${market.id}:`, error);
      await notifyAdmin(`Resolution failed for market: ${market.question}`);
    }
  }

  private async checkProposedMarkets() {
    const proposedMarkets = await prisma.market.findMany({
      where: { status: 'PROPOSED' },
    });

    for (const market of proposedMarkets) {
      const canFinalize = await marketExecutor.canFinalize(market.contractAddress);
      
      if (canFinalize) {
        await marketExecutor.finalizeResolution(market.contractAddress);
        console.log(`Finalized resolution for ${market.id}`);
      }
    }
  }
}

export const marketMonitor = new MarketMonitor();
```

> **Note:** The monitor calls `dataServiceClient.verifyOutcome()` to leverage the Python service's AI capabilities for outcome verification.

#### 9.5.3 Market Executor

```typescript
// oracle/src/orchestrator/markets/executor.ts

import { ethers } from 'ethers';
import { prisma } from '../../shared/database/prisma';
import { getMarketContract } from '../../shared/blockchain/contracts';
import { notifyAdmin } from '../../shared/notifications/service';

class MarketExecutor {
  async proposeResolution(marketAddress: string, outcome: boolean) {
    const contract = getMarketContract(marketAddress);

    const tx = await contract.proposeResolution(outcome);
    const receipt = await tx.wait();

    await prisma.market.update({
      where: { contractAddress: marketAddress },
      data: {
        status: 'PROPOSED',
        resolvedOutcome: outcome,
      },
    });

    await notifyAdmin(
      `Resolution proposed for ${marketAddress}: ${outcome ? 'YES' : 'NO'}`
    );

    return receipt;
  }

  async canFinalize(marketAddress: string): Promise<boolean> {
    const contract = getMarketContract(marketAddress);
    const proposedTimestamp = await contract.proposedTimestamp();
    const disputeWindow = await contract.DISPUTE_WINDOW();
    return Date.now() / 1000 >= Number(proposedTimestamp) + Number(disputeWindow);
  }

  async finalizeResolution(marketAddress: string) {
    const contract = getMarketContract(marketAddress);

    const tx = await contract.finalizeResolution();
    const receipt = await tx.wait();

    await prisma.market.update({
      where: { contractAddress: marketAddress },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    return receipt;
  }
}

export const marketExecutor = new MarketExecutor();
```

#### 9.5.4 Dispute Handler

```typescript
// oracle/src/orchestrator/markets/disputes.ts

import { prisma } from '../../shared/database/prisma';
import { notifyAdmin } from '../../shared/notifications/service';

export async function handleDispute(
  marketAddress: string,
  disputer: string,
  reason: string
) {
  await prisma.market.update({
    where: { contractAddress: marketAddress },
    data: { status: 'DISPUTED' },
  });

  await notifyAdmin(`
    🚨 MARKET DISPUTED 🚨
    
    Market: ${marketAddress}
    Disputer: ${disputer}
    Reason: ${reason}
    
    Action required: Manual review
  `);

  await prisma.dispute.create({
    data: {
      marketAddress,
      disputer,
      reason,
      status: 'PENDING_REVIEW',
    },
  });
}
```

### 9.6 Server Layer

The server layer handles all request-driven operations. It is stateless and could theoretically be deployed as serverless functions.

#### 9.6.1 Express App Setup

```typescript
// oracle/src/server/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';
import { authRouter } from './auth/routes';
import { marketsRouter } from './markets/routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Public routes
app.use('/api/auth', authRouter);
app.use('/api/markets', marketsRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

export { app };
```

#### 9.6.2 Auth Domain

```typescript
// oracle/src/server/auth/routes.ts

import { Router } from 'express';
import { verifyPrivyToken } from './controller';

const router = Router();

router.post('/verify', async (req, res) => {
  const { token } = req.body;
  
  try {
    const user = await verifyPrivyToken(token);
    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export { router as authRouter };
```

#### 9.6.3 Markets Domain

```typescript
// oracle/src/server/markets/routes.ts

import { Router } from 'express';
import { getMarkets, getMarketById, getUserBets } from './service';

const router = Router();

// List all markets with filters
router.get('/', async (req, res) => {
  const { status, category, limit = 20, offset = 0 } = req.query;
  
  const markets = await getMarkets({
    status: status as string,
    category: category as string,
    limit: Number(limit),
    offset: Number(offset),
  });
  
  res.json(markets);
});

// Get single market by address
router.get('/:address', async (req, res) => {
  const market = await getMarketById(req.params.address);
  
  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }
  
  res.json(market);
});

// Get user's bet history
router.get('/users/:address/bets', async (req, res) => {
  const bets = await getUserBets(req.params.address);
  res.json(bets);
});

export { router as marketsRouter };
```

```typescript
// oracle/src/server/markets/service.ts

import { prisma } from '../../shared/database/prisma';

interface GetMarketsParams {
  status?: string;
  category?: string;
  limit: number;
  offset: number;
}

export async function getMarkets(params: GetMarketsParams) {
  const { status, category, limit, offset } = params;
  
  return prisma.market.findMany({
    where: {
      ...(status && { status }),
      ...(category && { category }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getMarketById(address: string) {
  return prisma.market.findUnique({
    where: { contractAddress: address },
  });
}

export async function getUserBets(userAddress: string) {
  return prisma.bet.findMany({
    where: { user: { address: userAddress } },
    include: { market: true },
    orderBy: { createdAt: 'desc' },
  });
}
```

### 9.7 Shared Layer

The shared layer contains code used by both the server and orchestrator.

#### 9.7.1 Database (Prisma)

```typescript
// oracle/src/shared/database/prisma.ts

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

#### 9.7.2 Blockchain Client

```typescript
// oracle/src/shared/blockchain/client.ts

import { ethers } from 'ethers';

export const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
export const oracleWallet = new ethers.Wallet(
  process.env.ORACLE_PRIVATE_KEY!,
  provider
);
```

```typescript
// oracle/src/shared/blockchain/contracts.ts

import { ethers } from 'ethers';
import { oracleWallet } from './client';
import MarketFactoryABI from './abis/MarketFactory.json';
import BinaryMarketABI from './abis/BinaryMarket.json';

export const marketFactory = new ethers.Contract(
  process.env.MARKET_FACTORY_ADDRESS!,
  MarketFactoryABI,
  oracleWallet
);

export function getMarketContract(address: string) {
  return new ethers.Contract(address, BinaryMarketABI, oracleWallet);
}

export async function deployMarket(
  question: string,
  sourceUrl: string,
  bettingClose: number,
  resolution: number
): Promise<string> {
  const tx = await marketFactory.createMarket(
    question,
    sourceUrl,
    bettingClose,
    resolution
  );
  const receipt = await tx.wait();
  return receipt.logs[0].args.market;
}
```

#### 9.7.3 Notifications

```typescript
// oracle/src/shared/notifications/service.ts

import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

export async function notifyAdmin(message: string) {
  // Telegram notification
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }
    );
  }

  // Discord webhook (alternative)
  if (process.env.DISCORD_WEBHOOK_URL) {
    await axios.post(process.env.DISCORD_WEBHOOK_URL, {
      content: message,
    });
  }

  console.log('[ADMIN NOTIFICATION]', message);
}
```

#### 9.7.4 Configuration

```typescript
// oracle/src/shared/config/env.ts

export const config = {
  // Server
  port: Number(process.env.PORT) || 3001,
  frontendUrl: process.env.FRONTEND_URL!,
  
  // Blockchain
  rpcUrl: process.env.RPC_URL!,
  chainId: Number(process.env.CHAIN_ID) || 84532,
  oraclePrivateKey: process.env.ORACLE_PRIVATE_KEY!,
  
  // Contracts
  playTokenAddress: process.env.PLAY_TOKEN_ADDRESS!,
  marketFactoryAddress: process.env.MARKET_FACTORY_ADDRESS!,
  
  // Services
  dataServiceUrl: process.env.DATA_SERVICE_URL || 'http://localhost:8000',
  
  // Notifications
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
} as const;
```

### 9.8 Oracle Entry Point

```typescript
// oracle/src/index.ts

import { app } from './server';
import { heart } from './orchestrator/heart';
import { marketCreator } from './orchestrator/markets/creator';
import { marketMonitor } from './orchestrator/markets/monitor';
import { config } from './shared/config/env';
import { dataServiceClient } from './orchestrator/dataServiceClient';

async function main() {
  // 1. Health checks before starting
  const dataServiceHealthy = await dataServiceClient.healthCheck();
  if (!dataServiceHealthy) {
    console.warn('⚠️  Data Service not reachable. Orchestrator may fail.');
  }

  // 2. Start SERVER (User Input driver)
  app.listen(config.port, () => {
    console.log(`✓ Server listening on port ${config.port}`);
  });

  // 3. Register tick handlers and start ORCHESTRATOR (Passage of Time driver)
  heart.register('marketCreator', marketCreator);
  heart.register('marketMonitor', marketMonitor);
  
  heart.start(60_000); // Tick every 60 seconds
  console.log('✓ Orchestrator heart started');

  console.log('Oracle Service running');
}

main().catch((error) => {
  console.error('Failed to start Oracle Service:', error);
  process.exit(1);
});
```

**Startup Flow:**

```
1. Check Data Service health (warn if unreachable)
2. Start Express server (User Input driver)
3. Register orchestrator handlers (creator, monitor)
4. Start heart (Passage of Time driver)

Both drivers now running:
- Server responds to HTTP requests
- Orchestrator ticks every 60 seconds
  - creator.tick() runs every 24 hours
  - monitor.tick() runs every 5 minutes
```

### 9.9 Deliverables Checklist

**Server Layer (User Input)**
- [ ] Express app with security middleware (helmet, CORS, rate limiting)
- [ ] Auth domain (Privy token verification)
- [ ] Markets domain (list, detail, user bets)
- [ ] Health check endpoint

**Orchestrator Layer (Passage of Time)**
- [ ] Heart (global tick mechanism)
- [ ] Data Service Client (bridge to Python)
- [ ] Market Creator (tick → Data Service → deploy → store)
- [ ] Market Monitor (tick → check expirations → verify → propose)
- [ ] Market Executor (propose resolution, finalize)
- [ ] Dispute handler

**Shared Layer**
- [ ] Prisma client singleton
- [ ] Blockchain client (ethers.js provider, wallet)
- [ ] Contract helpers (deploy, getMarketContract)
- [ ] Notification service (Telegram/Discord)
- [ ] Typed environment config

**Integration**
- [ ] Entry point starts both drivers
- [ ] One market created and resolved end-to-end
- [ ] Service running on VPS via PM2

---

## Section 10: Gas Sponsorship & Paymaster

### 10.1 Overview

The Paymaster sponsors gas fees for users, making all $PLAY token transactions appear "free". This is powered by the Coinbase Developer Platform (CDP).

### 10.2 How Paymasters Work

```
User Transaction Flow (Without Paymaster):
User ──► Signs Tx ──► Pays Gas (ETH) ──► Tx Executed

User Transaction Flow (With Paymaster):
User ──► Signs UserOp ──► Paymaster Sponsors Gas ──► Tx Executed
                              │
                              └──► Your VPS pays (sponsored)
```

### 10.3 CDP Paymaster Setup

```bash
# 1. Create CDP account at https://portal.cdp.coinbase.com
# 2. Create a new project
# 3. Enable Paymaster for Base Sepolia
# 4. Get API credentials
```

### 10.4 Paymaster Configuration

```typescript
// lib/paymaster.ts
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { paymasterClient } from '@coinbase/onchainkit';

export const paymasterConfig = {
  paymasterUrl: process.env.NEXT_PUBLIC_PAYMASTER_URL!,
  sponsorshipPolicyId: process.env.CDP_SPONSORSHIP_POLICY_ID!,
};

export async function getPaymasterData(userOp: UserOperation) {
  const response = await fetch(paymasterConfig.paymasterUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CDP_API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'pm_sponsorUserOperation',
      params: [userOp, paymasterConfig.sponsorshipPolicyId],
      id: 1,
    }),
  });

  const data = await response.json();
  return data.result;
}
```

### 10.5 Wagmi Integration with Paymaster

```typescript
// hooks/useSponsoredTransaction.ts
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { useCapabilities, useWriteContracts } from 'wagmi/experimental';

export function useSponsoredTransaction() {
  const { data: capabilities } = useCapabilities();
  
  const { writeContracts, data: hash, isPending } = useWriteContracts();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const executeSponsoredTx = async (
    contracts: WriteContractsParameters['contracts']
  ) => {
    const paymasterCapability = capabilities?.[baseSepolia.id]?.paymasterService;
    
    writeContracts({
      contracts,
      capabilities: paymasterCapability ? {
        paymasterService: {
          url: process.env.NEXT_PUBLIC_PAYMASTER_URL!,
        },
      } : undefined,
    });
  };

  return {
    executeSponsoredTx,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
  };
}
```

### 10.6 Sponsored Trade Example

```typescript
// components/trading/SponsoredTradePanel.tsx
'use client';

import { useSponsoredTransaction } from '@/hooks/useSponsoredTransaction';
import { parseEther } from 'viem';

export function SponsoredTradePanel({ marketAddress }: { marketAddress: `0x${string}` }) {
  const { executeSponsoredTx, isPending } = useSponsoredTransaction();
  
  const handleTrade = async (outcome: boolean, amount: string) => {
    await executeSponsoredTx([
      // First: Approve tokens
      {
        address: PLAY_TOKEN_ADDRESS,
        abi: PLAY_TOKEN_ABI,
        functionName: 'approve',
        args: [marketAddress, parseEther(amount)],
      },
      // Second: Place bet
      {
        address: marketAddress,
        abi: BINARY_MARKET_ABI,
        functionName: 'placeBet',
        args: [outcome, parseEther(amount)],
      },
    ]);
  };

  return (
    <div>
      {/* Trade UI */}
      <p className="text-green-500 text-sm">✓ Gas fees sponsored</p>
    </div>
  );
}
```

### 10.7 Sponsorship Policy (CDP Dashboard)

```json
{
  "name": "OSPM Play Token Transactions",
  "chainId": 84532,
  "rules": {
    "maxSpendPerUser": "0.01",
    "maxSpendPerUserPeriod": "daily",
    "allowedContracts": [
      "${PLAY_TOKEN_ADDRESS}",
      "${MARKET_FACTORY_ADDRESS}"
    ],
    "allowedMethods": [
      "faucet()",
      "approve(address,uint256)",
      "placeBet(bool,uint256)",
      "claimWinnings()"
    ]
  }
}
```

### 10.8 Fallback: Manual Gas Funding

```typescript
// If paymaster fails, prompt user to get testnet ETH
export function GasWarning() {
  const { data: balance } = useBalance({ address });
  
  if (balance && balance.value < parseEther('0.001')) {
    return (
      <div className="warning-banner">
        <p>Low gas balance. Get testnet ETH from:</p>
        <a href="https://www.coinbase.com/faucets/base-sepolia-faucet">
          Base Sepolia Faucet
        </a>
      </div>
    );
  }
  
  return null;
}
```

### 10.9 Cost Monitoring

```typescript
// server/api/sponsorship.ts
// Track sponsorship costs

export async function logSponsoredTx(
  userAddress: string,
  txHash: string,
  gasCostWei: bigint
) {
  await prisma.sponsoredTransaction.create({
    data: {
      userAddress,
      txHash,
      gasCostWei: gasCostWei.toString(),
      gasCostUsd: await convertToUsd(gasCostWei),
      timestamp: new Date(),
    },
  });
}

// Daily cost report
export async function getDailySponsorshipCost() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await prisma.sponsoredTransaction.aggregate({
    where: { timestamp: { gte: today } },
    _sum: { gasCostUsd: true },
    _count: true,
  });
  
  return {
    totalUsd: result._sum.gasCostUsd || 0,
    txCount: result._count,
  };
}
```

### 10.10 Deliverables Checklist

- [ ] CDP account created and configured
- [ ] Paymaster enabled for Base Sepolia
- [ ] Sponsorship policy defined (allowed contracts/methods)
- [ ] wagmi hooks integrated with paymaster
- [ ] Users can transact without holding ETH
- [ ] Faucet claims sponsored
- [ ] Trade transactions sponsored
- [ ] Fallback for paymaster failures
- [ ] Cost monitoring and logging
- [ ] Daily sponsorship budget alerts

---

## Appendix A: Development & Deployment Setup

### Local Development (`scripts/dev-setup.sh`)

```bash
#!/bin/bash
# scripts/dev-setup.sh - Local development setup

set -e

echo "=== OSPM Local Development Setup ==="

# 1. Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js required"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 required"; exit 1; }
command -v forge >/dev/null 2>&1 || { echo "Foundry required. Install: curl -L https://foundry.paradigm.xyz | bash"; exit 1; }

# 2. Setup environment
if [ ! -f .env ]; then
  cp env.example .env
  echo "Created .env from env.example - please fill in values"
fi

# 3. Install Oracle dependencies
echo "Installing Oracle dependencies..."
cd oracle
npm install
npx prisma generate
cd ..

# 4. Install Data Service dependencies
echo "Installing Data Service dependencies..."
cd data-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..

# 5. Install contract dependencies
echo "Installing contract dependencies..."
cd contracts
forge install
cd ..

# 6. Start PostgreSQL (assumes local installation)
echo "Ensure PostgreSQL is running..."
# On macOS: brew services start postgresql
# On Ubuntu: sudo systemctl start postgresql

# 7. Run database migrations
echo "Running database migrations..."
cd oracle
npx prisma migrate dev
cd ..

# 8. Deploy contracts to local/testnet (optional)
echo "To deploy contracts: cd contracts && forge script script/Deploy.s.sol --broadcast"

echo "=== Setup Complete ==="
echo "Start services:"
echo "  Data Service: cd data-service && source venv/bin/activate && uvicorn main:app --reload"
echo "  Oracle:       cd oracle && npm run dev"
```

### Staging Deployment (`scripts/deploy-staging.sh`)

```bash
#!/bin/bash
# scripts/deploy-staging.sh - Staging deployment (run via GitHub Action)

set -e

echo "=== OSPM Staging Deployment ==="

# 1. Pull latest code
cd /home/ospm/ospm-services
git pull origin main

# 2. Install/update Oracle dependencies
echo "Updating Oracle..."
cd oracle
npm ci --production
npx prisma migrate deploy
npx prisma generate
cd ..

# 3. Install/update Data Service dependencies
echo "Updating Data Service..."
cd data-service
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate
cd ..

# 4. Build contracts (if changed)
echo "Building contracts..."
cd contracts
forge build
cd ..

# 5. Restart services with PM2
echo "Restarting services..."
pm2 restart ecosystem.config.js --update-env

# 6. Verify services are running
sleep 5
pm2 status

echo "=== Deployment Complete ==="
```

### PM2 Ecosystem Config

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'oracle',
      cwd: './oracle',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
    {
      name: 'data-service',
      cwd: './data-service',
      script: './venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8000',
      interpreter: 'none',
    },
  ],
};
```

### GitHub Action (`.github/workflows/deploy-staging.yml`)

```yaml
name: Deploy to Staging

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /home/ospm/ospm-services
            ./scripts/deploy-staging.sh
```

### nginx Configuration

```nginx
# /etc/nginx/sites-available/ospm
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Oracle API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Data Service (internal only, not exposed)
    # Data Service runs on port 8000, accessed only by Oracle
}
```

### Environment Variables Template

```env
# env.example

# Blockchain
CHAIN_ID=84532
RPC_URL=https://sepolia.base.org
ORACLE_PRIVATE_KEY=

# Contracts (fill after deployment)
PLAY_TOKEN_ADDRESS=
MARKET_FACTORY_ADDRESS=

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ospm

# Data Service
DATA_SERVICE_URL=http://localhost:8000
OPENAI_API_KEY=

# API
PORT=3001
FRONTEND_URL=https://yourdomain.com
VPS_API_SECRET=your-secret-key-here

# Paymaster (CDP)
PAYMASTER_URL=
CDP_API_KEY=
CDP_API_SECRET=
CDP_SPONSORSHIP_POLICY_ID=

# Notifications
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
DISCORD_WEBHOOK_URL=
```

---

## Appendix B: Deployment Checklist

### Pre-Launch

- [ ] All smart contracts deployed and verified
- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to AWS Lightsail
- [ ] Database migrations complete
- [ ] SSL certificates configured
- [ ] Environment variables set in production
- [ ] Paymaster funded with ETH
- [ ] Admin wallet funded for oracle operations

### Post-Launch Monitoring

- [ ] Uptime monitoring (UptimeRobot/Better Stack)
- [ ] Error tracking (Sentry)
- [ ] Analytics (Posthog/Mixpanel)
- [ ] Sponsorship cost alerts
- [ ] Database backup verification
- [ ] Security audit completed

---

## Appendix C: Security Considerations

1. **Private Key Management**: Oracle and deployer keys stored in secure environment variables, never committed to git
2. **API Authentication**: All VPS endpoints protected with `X-OSPM-Secret` header
3. **Rate Limiting**: 100 requests per 15 minutes per IP
4. **Input Validation**: All user inputs sanitized before database storage
5. **Smart Contract Audits**: Recommend professional audit before mainnet
6. **Admin Access**: Multi-factor authentication for admin dashboard

---

## Appendix D: Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:
- Code style and conventions
- Pull request process
- Issue reporting
- Testing requirements

---

## License

MIT License - See [LICENSE](./LICENSE) for details.

---

**OSPM - Open Source Prediction Market**  
*Democratizing prediction markets with Web3 rails and Web2 UX*

