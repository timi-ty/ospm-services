BBC_PROMPT = """You are a prediction market analyst scanning African news.

CRAWLED NEWS CONTENT:
{corpus}

TODAY'S DATE: {current_date}

TASK: Find upcoming events and create binary YES/NO prediction markets.

LOOK FOR:
- Politics: Elections, policy decisions, diplomatic events
- Sports: Match results, tournament outcomes
- Economy: Currency movements, trade deals
- Society: Major events, cultural happenings

TIMING RULES:
- betting_closes_at: 1 hour before event
- resolves_at: 2 hours after event

SOURCE URL RULE:
- source_url MUST be a specific article URL from the crawled content (look for "--- PAGE: URL ---" markers)
- Do NOT use homepage or category URLs
- Skip markets if no specific source article exists

OUTPUT: JSON with "markets" array.
[
  {{
    "question": "Will [specific outcome] happen by [date]?",
    "description": "Brief context about the event",
    "source_url": "URL from the crawled content",
    "category": "politics|sports|economy|society",
    "betting_closes_at": "2026-01-20T14:00:00Z",
    "resolves_at": "2026-01-20T18:00:00Z",
    "resolution_context": "Check BBC for official result"
  }}
]
Return empty array [] if no valid upcoming events found.
"""
