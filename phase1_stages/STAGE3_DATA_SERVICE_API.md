# Stage 3: Data Service API

> **Input:** HTTP request with source ID  
> **Output:** Generated market proposals  
> **Language:** Python (FastAPI)

---

## Purpose

HTTP API that orchestrates crawling + AI generation. Called by Oracle service.

---

## Endpoints

### `POST /generate-markets`

```typescript
// Request
{
  source_id: string;       // "npfl"
  target_count?: number;   // default 5
}

// Response
{
  markets: MarketProposal[];
  metadata: {
    source_id: string;
    pages_crawled: number;
    corpus_size_bytes: number;
    generation_time_ms: number;
  }
}
```

### `GET /health`

```typescript
// Response
{
  status: "healthy" | "degraded";
  openai_configured: boolean;
}
```

---

## Source Registry

```python
SOURCES = {
    "npfl": DataSource(
        seed_url="https://npfl.ng/fixtures",
        max_depth=2,
        max_pages=30,
        prompt=NPFL_PROMPT,
        category="sports",
    ),
    # Future sources added here
}
```

---

## Request Flow

```
POST /generate-markets { source_id: "npfl" }
    │
    ├── 1. Lookup source config from registry
    │
    ├── 2. crawl(source.seed_url, source.max_depth, source.max_pages)
    │       └── Returns text corpus
    │
    ├── 3. generate_markets(corpus, source.prompt, target_count)
    │       └── Returns market proposals
    │
    └── 4. Return response with markets + metadata
```

---

## Configuration

```env
OPENAI_API_KEY=sk-...
PORT=8000
LOG_LEVEL=INFO
```

---

## Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Unknown source_id |
| 503 | OpenAI API unavailable |
| 500 | Unexpected error |

All errors return: `{ error: string, detail?: string }`

---

## File Structure

```
data-service/
├── main.py              # FastAPI app + endpoints
├── sources.py           # SOURCES registry
├── crawler/             # Stage 1
└── generator/           # Stage 2
```

---

## Success Criteria

```
✓ POST /generate-markets?source_id=npfl returns markets
✓ GET /health returns 200
✓ Invalid source_id returns 400
✓ Response includes timing metadata
```
