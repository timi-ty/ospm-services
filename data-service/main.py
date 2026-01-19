import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import asdict
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel

from crawler import guided_crawl, CrawlConfig
from crawler.browser_engine import BrowserEngine
from generator import generate_markets
from sources import SOURCES, DataSource

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global OpenAI client
openai_client: AsyncOpenAI | None = None

# In-memory job storage
jobs: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global openai_client
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        openai_client = AsyncOpenAI(api_key=api_key)
        logger.info("OpenAI client initialized")
    else:
        logger.warning("OPENAI_API_KEY not set")
    yield
    # Shutdown browser if it was used
    await BrowserEngine.shutdown()
    logger.info("Shutting down")


app = FastAPI(
    title="OSPM Data Service",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# --- Request/Response Models ---

class GenerateMarketsRequest(BaseModel):
    source_ids: list[str]
    target_count: int = 5


class MarketResponse(BaseModel):
    question: str
    description: str
    source_url: str
    category: str
    betting_closes_at: str
    resolves_at: str
    resolution_context: str


class SourceError(BaseModel):
    source_id: str
    error: str


class TriggerResponse(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    started_at: float
    completed_at: float | None = None
    markets_generated: int | None = None
    errors: list[SourceError] | None = None


class SourceInfo(BaseModel):
    id: str
    category: str
    seed_url: str


class SourcesResponse(BaseModel):
    sources: list[SourceInfo]


class HealthResponse(BaseModel):
    status: str
    openai_configured: bool


# --- Helper Functions ---

async def process_source(source: DataSource, target_count: int) -> list[MarketResponse]:
    """AI-guided crawl and market generation. Raises on failure."""
    model = os.getenv("AI_MODEL", "gpt-4o-mini")
    
    crawl_config = CrawlConfig(
        seed_url=source.seed_url,
        max_links_to_scrape=source.max_links_to_scrape,
        use_javascript=source.use_javascript,
        wait_selector=source.wait_selector,
        wait_timeout_ms=source.wait_timeout_ms
    )
    
    # AI-guided crawl: fetch homepage -> AI selects links -> scrape articles
    crawl_result = await guided_crawl(crawl_config, openai_client, model=model)
    
    if not crawl_result.text_corpus.strip():
        raise Exception(f"Empty corpus from {source.seed_url}")
    
    logger.info(f"Crawled {len(crawl_result.pages_visited)} pages, corpus: {len(crawl_result.text_corpus)} chars")
    
    # Generate markets from the focused corpus
    proposals = await generate_markets(
        client=openai_client,
        corpus=crawl_result.text_corpus,
        prompt_template=source.prompt,
        target_count=target_count
    )
    
    return [MarketResponse(**asdict(p)) for p in proposals]


async def post_to_oracle(markets: list[MarketResponse], errors: list[SourceError]) -> None:
    """POST generated markets to Oracle's ingest endpoint."""
    callback_url = os.getenv("ORACLE_CALLBACK_URL", "http://localhost:3001/api/markets/ingest")
    
    payload = {
        "markets": [m.model_dump() for m in markets],
        "errors": [e.model_dump() for e in errors],
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(callback_url, json=payload, timeout=30)
            if response.status_code == 200:
                result = response.json()
                logger.info(f"Oracle ingested {result.get('created', 0)} markets")
            else:
                logger.error(f"Oracle callback failed: {response.status_code} {response.text}")
    except Exception as e:
        logger.error(f"Failed to POST to Oracle: {type(e).__name__}: {e}")


async def process_sources_background(job_id: str, source_ids: list[str], target_count: int) -> None:
    """Background task: process sources and POST results to Oracle."""
    all_markets: list[MarketResponse] = []
    errors: list[SourceError] = []
    
    for source_id in source_ids:
        source = SOURCES.get(source_id)
        if not source:
            errors.append(SourceError(source_id=source_id, error="Unknown source"))
            continue
        
        try:
            logger.info(f"[Job {job_id}] Processing source: {source_id}")
            markets = await process_source(source, target_count)
            all_markets.extend(markets)
            logger.info(f"[Job {job_id}] Source {source_id}: generated {len(markets)} markets")
        except Exception as e:
            logger.warning(f"[Job {job_id}] Source {source_id} failed: {e}")
            errors.append(SourceError(source_id=source_id, error=str(e)))
    
    # POST results to Oracle
    if all_markets:
        await post_to_oracle(all_markets, errors)
    
    # Update job status
    jobs[job_id] = {
        **jobs[job_id],
        "status": "completed",
        "completed_at": time.time(),
        "markets_generated": len(all_markets),
        "errors": [e.model_dump() for e in errors]
    }
    
    logger.info(f"[Job {job_id}] Completed: {len(all_markets)} markets, {len(errors)} errors")


# --- Endpoints ---

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy" if openai_client else "degraded",
        openai_configured=openai_client is not None
    )


@app.get("/sources", response_model=SourcesResponse)
async def list_sources():
    """Return all available data sources."""
    return SourcesResponse(
        sources=[
            SourceInfo(id=s.id, category=s.category, seed_url=s.seed_url)
            for s in SOURCES.values()
        ]
    )


@app.post("/generate-markets", response_model=TriggerResponse, status_code=202)
async def generate_markets_endpoint(request: GenerateMarketsRequest):
    """Trigger async market generation. Returns immediately with job_id."""
    if not openai_client:
        raise HTTPException(status_code=503, detail="OpenAI not configured")
    
    if not request.source_ids:
        raise HTTPException(status_code=400, detail="source_ids cannot be empty")
    
    # Create job
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "processing",
        "started_at": time.time(),
        "source_ids": request.source_ids
    }
    
    # Fire background task - don't await
    asyncio.create_task(
        process_sources_background(job_id, request.source_ids, request.target_count)
    )
    
    logger.info(f"[Job {job_id}] Started for sources: {request.source_ids}")
    
    return TriggerResponse(job_id=job_id, status="accepted")


@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get status of a generation job."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        started_at=job["started_at"],
        completed_at=job.get("completed_at"),
        markets_generated=job.get("markets_generated"),
        errors=[SourceError(**e) for e in job.get("errors", [])] if job.get("errors") else None
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
