# Stage 1: Data Pipeline & Core Backend Services

> **Status:** ✅ COMPLETE  
> **Repos:** ospm-services (data-service/, oracle/), ospm-frontend  

---

## What Was Built

### Data Service (Python/FastAPI) — `data-service/`

A stateless HTTP utility service that handles web scraping and AI-powered market generation.

**Implemented:**
- `main.py` — FastAPI app with endpoints: `GET /health`, `GET /sources`, `POST /generate-markets`, `GET /jobs/{job_id}`
- `crawler/` — Guided web crawling with Playwright browser engine, HTTP fallback via httpx, user agent rotation
- `generator/` — AI market generation using OpenAI GPT-4, with prompt templates for multiple sources (NPFL, Punch, BBC), corpus chunking, link selection
- `sources.py` — Data source registry (npfl, punch, bbc)
- Async job processing with background tasks

### Oracle Service (Node.js/TypeScript) — `oracle/`

The central orchestrator for the market lifecycle, organized around two drivers.

**Implemented:**
- `src/index.ts` — Entry point, starts server + orchestrator
- `src/server/` — Express app with CORS, Helmet, rate limiting
  - `markets/routes.ts` — `GET /api/markets`, `GET /api/markets/:id`, `POST /api/markets/ingest`
  - `markets/service.ts` — Prisma-based market queries and ingestion
- `src/orchestrator/` — Tick-based background processing
  - `heart.ts` — Global tick mechanism (setInterval)
  - `markets/creator.ts` — Market creation tick handler
  - `dataServiceClient.ts` — HTTP bridge to Python service
- `src/shared/` — Database (Prisma singleton), config (typed env)
- `prisma/schema.prisma` — Market and Bet models
- Build system (tsup), compiled output in `dist/`

### Frontend (Next.js) — `ospm-frontend/`

Minimal market browser displaying markets from the Oracle API.

**Implemented:**
- `app/page.tsx` — Homepage with markets grid, loading/error states
- `app/layout.tsx` — Root layout with fonts (DM Sans, JetBrains Mono)
- `components/MarketCard.tsx` — Market card with category, status, dates
- `lib/api/` — Client layer (`client.ts`, `hooks.ts` with SWR, `types.ts`)
- `app/globals.css` — Tailwind CSS theme with custom variables, animations

### DevOps

**Implemented:**
- `scripts/deploy.sh` — Production deployment (PostgreSQL, PM2, nginx)
- `scripts/dev-setup.sh` — Local development setup
- `.github/workflows/deploy-staging.yml` — CI/CD via SSH
- `ecosystem.config.cjs` — PM2 process configuration
- `env.example` — Environment variable template

---

## What This Stage Established

1. Markets can be generated from real-world data sources via AI
2. Markets are stored in PostgreSQL and served via REST API
3. Frontend displays markets in a responsive grid
4. Background orchestrator runs on a tick-based schedule
5. Deployment pipeline pushes to VPS on merge to main

---

## Verification (Already Passing)

```bash
# Data Service health
curl http://localhost:8000/health
# → {"status":"healthy"}

# Oracle health
curl http://localhost:3001/health
# → {"status":"ok"}

# Markets API
curl http://localhost:3001/api/markets
# → {"markets":[...],"total":N,"hasMore":false}

# Frontend renders at http://localhost:3000
# → Markets grid visible with MarketCard components
```
