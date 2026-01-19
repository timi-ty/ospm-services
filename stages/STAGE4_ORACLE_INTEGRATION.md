# Stage 4: Oracle Integration

> **Input:** Market proposals from Data Service  
> **Output:** Markets stored in PostgreSQL  
> **Language:** TypeScript (Node.js)

---

## Purpose

Oracle calls Data Service on schedule, stores generated markets in database.

---

## Components

### 1. Data Service Client

```typescript
interface DataServiceClient {
  generateMarkets(sourceId: string, targetCount?: number): Promise<GenerateMarketsResponse>;
  healthCheck(): Promise<boolean>;
}
```

Single HTTP client that calls Python service. Lives in `orchestrator/dataServiceClient.ts`.

### 2. Market Creator (Tick Handler)

```typescript
class MarketCreator implements TickHandler {
  private lastTickedAt: Date | null = null;
  private tickEveryMs = 24 * 60 * 60 * 1000; // 24 hours

  async tick(context: TickContext): Promise<void> {
    if (!shouldTick(this.lastTickedAt, this.tickEveryMs, context.tickTime)) return;
    
    // 1. Call Data Service
    // 2. Deduplicate against existing markets
    // 3. Store new markets in DB
  }
}
```

### 3. Heart (Simplified)

```typescript
// Tick every 60 seconds, but MarketCreator only runs every 24 hours
heart.register('marketCreator', marketCreator);
heart.start(60_000);
```

---

## Database Schema

```prisma
model Market {
  id                  String   @id @default(cuid())
  
  question            String
  description         String?
  category            String
  sourceUrl           String
  
  bettingClosesAt     DateTime
  resolvesAt          DateTime
  
  status              String   @default("pending")
  resolutionContext   String?
  
  createdAt           DateTime @default(now())
  
  @@unique([question, bettingClosesAt])  // Prevent duplicates
}
```

---

## Deduplication Logic

Before storing, check if market already exists:

```sql
SELECT id FROM Market 
WHERE question = ? 
AND bettingClosesAt = ?
```

If exists, skip. This prevents the same fixture generating duplicate markets across runs.

---

## Configuration

```env
DATABASE_URL=postgresql://...
DATA_SERVICE_URL=http://localhost:8000
TICK_INTERVAL_MS=60000
MARKET_CREATION_INTERVAL_MS=86400000
```

---

## File Structure

```
oracle/
├── src/
│   ├── orchestrator/
│   │   ├── dataServiceClient.ts
│   │   ├── heart.ts
│   │   ├── types.ts
│   │   └── markets/
│   │       └── creator.ts
│   └── shared/
│       └── database/
│           └── prisma.ts
└── prisma/
    └── schema.prisma
```

---

## Manual Trigger

For development, expose a method to trigger immediately:

```typescript
// In creator.ts
async generateNow(): Promise<void> {
  this.lastTickedAt = null;  // Force next tick to run
}
```

---

## Success Criteria

```
✓ Oracle starts and connects to Data Service
✓ Market creator runs on tick
✓ Markets stored in PostgreSQL
✓ Duplicates are skipped
✓ Manual trigger works for testing
```
