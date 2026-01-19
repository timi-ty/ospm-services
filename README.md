# OSPM Services

Backend services for the Open Source Prediction Market platform.

## Components

| Service | Port | Description |
|---------|------|-------------|
| **Data Service** | 8000 | Crawls news sources, uses AI to generate prediction market questions |
| **Oracle** | 3001 | Orchestrates market generation, stores markets in PostgreSQL, serves API |

## Prerequisites

- Node.js 20+
- Python 3.11
- PostgreSQL

## Quick Start

### 1. Setup (first time only)

```bash
./scripts/dev-setup.sh
```

This creates the database, installs dependencies, and runs migrations.

### 2. Configure

Edit `.env` with your settings:

```
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5432/ospm
OPENAI_API_KEY=sk-...
```

### 3. Run

**Terminal 1 - Data Service:**
```bash
cd data-service
source venv/bin/activate
python main.py
```

**Terminal 2 - Oracle:**
```bash
cd oracle
npm run dev
```

### 4. Verify

```bash
curl http://localhost:8000/health
curl http://localhost:3001/health
```

## How It Works

1. Oracle triggers market generation every 24 hours
2. Data Service crawls configured news sources (BBC, Punch, etc.)
3. AI selects relevant articles and generates YES/NO prediction questions
4. Markets are stored in PostgreSQL and served via REST API

## API Endpoints

**Oracle (port 3001):**
- `GET /health` - Health check
- `GET /api/markets` - List markets
- `GET /api/markets/:id` - Get market details

**Data Service (port 8000):**
- `GET /health` - Health check
- `GET /sources` - List configured news sources
- `POST /generate-markets` - Trigger market generation (async)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key for AI generation |
| `AI_MODEL` | Model to use (default: `gpt-4o-mini`) |
| `PORT` | Oracle port (default: 3001) |
| `MARKET_CREATION_INTERVAL_MS` | Generation interval (default: 24h) |

## License

AGPL-3.0
