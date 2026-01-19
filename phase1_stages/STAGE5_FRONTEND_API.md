# Stage 5: Frontend API

> **Input:** HTTP requests from frontend  
> **Output:** Market data from PostgreSQL  
> **Language:** TypeScript (Express)

---

## Purpose

REST API for frontend to fetch and display markets. Read-only in Phase 1.

---

## Endpoints

### `GET /api/markets`

List markets with optional filters.

```typescript
// Query params
{
  status?: "pending" | "active" | "resolved";
  category?: string;
  limit?: number;   // default 20
  offset?: number;  // default 0
}

// Response
{
  markets: Market[];
  total: number;
  hasMore: boolean;
}
```

### `GET /api/markets/:id`

Single market by ID.

```typescript
// Response
{
  market: Market | null;
}
```

### `GET /health`

```typescript
// Response
{ status: "ok" }
```

---

## Market Response Shape

```typescript
interface Market {
  id: string;
  question: string;
  description: string | null;
  category: string;
  sourceUrl: string;
  bettingClosesAt: string;  // ISO timestamp
  resolvesAt: string;       // ISO timestamp
  status: string;
  createdAt: string;
}
```

**Excluded from response:**
- `resolutionContext` (internal, for oracle use)

---

## Query Logic

Default sort: `createdAt DESC` (newest first)

Filter by status:
```sql
WHERE status = ? (if provided)
```

Filter by category:
```sql
WHERE category = ? (if provided)
```

---

## File Structure

```
oracle/
└── src/
    └── server/
        ├── index.ts        # Express app setup
        └── markets/
            ├── routes.ts   # Route handlers
            └── service.ts  # Prisma queries
```

---

## CORS Configuration

Allow frontend origin (configured via env):

```typescript
cors({ origin: process.env.FRONTEND_URL || '*' })
```

---

## Success Criteria

```
✓ GET /api/markets returns list of markets
✓ GET /api/markets/:id returns single market
✓ Filters work (status, category)
✓ Pagination works (limit, offset)
✓ CORS allows frontend requests
```

---

## End-to-End Test

```bash
# After all stages complete:

# 1. Start Data Service
cd data-service && uvicorn main:app --port 8000

# 2. Start Oracle
cd oracle && npm run dev

# 3. Trigger market generation (manual)
# Markets should appear in DB

# 4. Test API
curl http://localhost:3001/api/markets
# Should return generated markets
```
