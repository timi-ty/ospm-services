# Phase 1: AI-Powered Market Pipeline

> **Goal:** Crawl NPFL → AI generates markets → Store in DB → Serve to frontend  
> **Scope:** No Web3, no contracts  
> **Estimate:** 1 day

---

## Stages

| Stage | Description | Output |
|-------|-------------|--------|
| [Stage 1](stages/STAGE1_CRAWLER.md) | Recursive web crawler | Text corpus |
| [Stage 2](stages/STAGE2_AI_GENERATOR.md) | AI market generator | Market proposals |
| [Stage 3](stages/STAGE3_DATA_SERVICE_API.md) | Data Service API | HTTP endpoint |
| [Stage 4](stages/STAGE4_ORACLE_INTEGRATION.md) | Oracle integration | Markets in DB |
| [Stage 5](stages/STAGE5_FRONTEND_API.md) | Frontend API | REST endpoints |
| [Stage 6](stages/STAGE6_DEPLOYMENT.md) | Deployment workflow | VPS + CI/CD |

---

## Data Flow

```
NPFL Website
    │
    ▼
┌─────────────────┐
│  Stage 1        │
│  Crawler        │──► Text Corpus
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Stage 2        │
│  AI Generator   │──► Market Proposals
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Stage 3        │
│  Data Service   │──► HTTP API
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Stage 4        │
│  Oracle         │──► PostgreSQL
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Stage 5        │
│  Frontend API   │──► REST Endpoints
└─────────────────┘
    │
    ▼
Frontend (Next.js)

───────────────────

┌─────────────────┐
│  Stage 6        │
│  Deployment     │──► GitHub Actions → VPS (PM2)
└─────────────────┘
```

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Crawl depth | 2 levels, 30 pages | Balance coverage vs. cost |
| AI model | GPT-4 Turbo | Best signal extraction |
| Crawl frequency | Daily | Sports fixtures don't change hourly |
| Error handling | Log and skip | MVP simplicity |

---

## Success Criteria

```
✓ Crawler fetches NPFL text corpus
✓ AI generates valid markets from corpus
✓ Markets stored in PostgreSQL
✓ GET /api/markets returns data
✓ Frontend can display markets
```
