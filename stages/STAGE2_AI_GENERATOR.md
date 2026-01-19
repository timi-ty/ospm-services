# Stage 2: AI Market Generator

> **Input:** Text corpus + domain-specific prompt  
> **Output:** List of market proposals  
> **Language:** Python

---

## Purpose

Use GPT-4 to analyze crawled text and generate valid binary prediction markets.

---

## Interface

```python
async def generate_markets(
    corpus: str,
    prompt_template: str,
    target_count: int = 5
) -> list[MarketProposal]
```

```python
@dataclass
class MarketProposal:
    question: str            # "Will Enyimba beat Kano Pillars?"
    description: str         # Context for users
    source_url: str          # Primary source from corpus
    category: str            # "sports"
    betting_closes_at: str   # ISO timestamp
    resolves_at: str         # ISO timestamp
    resolution_context: str  # What to check when resolving
```

---

## Prompt Architecture

Each data source has a **prompt template** with placeholders:

```
{system_instructions}

CRAWLED CONTENT:
{corpus}

TODAY'S DATE: {current_date}

{output_format}
```

### NPFL Prompt (Sports)

```
You are a sports betting analyst creating prediction markets from Nigerian football data.

CRAWLED CONTENT:
{corpus}

TODAY'S DATE: {current_date}

TASK: Find upcoming NPFL matches and create binary YES/NO markets.

MARKET TYPES (vary your choices):
- Match winner: "Will [Team] beat [Opponent]?"
- Draw prediction: "Will [Team] vs [Opponent] end in a draw?"
- Over/under goals: "Will there be over 2.5 goals in [Match]?"
- Clean sheet: "Will [Team] keep a clean sheet?"
- Both teams to score: "Will both teams score in [Match]?"

TIMING:
- betting_closes_at: 1 hour before kickoff
- resolves_at: 3 hours after kickoff

OUTPUT: JSON array only. No explanation.
[
  {
    "question": "...",
    "description": "...",
    "source_url": "...",
    "category": "sports",
    "betting_closes_at": "2026-01-20T14:00:00Z",
    "resolves_at": "2026-01-20T18:00:00Z",
    "resolution_context": "Check match result on npfl.ng"
  }
]

Return empty array [] if no valid upcoming matches found.
```

---

## AI Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| Model | `gpt-4-turbo` | Best at extracting signal from noise |
| Temperature | `0.7` | Some creativity in question variety |
| Max tokens | `2000` | Enough for ~10 markets |
| Response format | `json_object` | Enforce valid JSON |

---

## Response Parsing

1. Parse JSON from response
2. Validate each proposal:
   - `question` is non-empty, ends with `?`
   - `betting_closes_at` is future timestamp
   - `resolves_at` is after `betting_closes_at`
3. Filter invalid proposals, log warnings
4. Return up to `target_count` valid proposals

---

## Error Handling

| Error | Action |
|-------|--------|
| API timeout | Retry once, then fail |
| Invalid JSON | Log raw response, return empty |
| Rate limit | Exponential backoff |
| Empty corpus | Return empty, don't call API |

---

## File Structure

```
data-service/
└── generator/
    ├── __init__.py       # exports generate_markets()
    ├── prompts/
    │   ├── __init__.py
    │   └── npfl.py       # NPFL_PROMPT constant
    └── models.py         # MarketProposal dataclass
```

---

## Success Criteria

```
✓ Given NPFL corpus, returns at least 1 valid market
✓ All timestamps are valid ISO format
✓ betting_closes_at < resolves_at
✓ Handles AI errors gracefully
```
