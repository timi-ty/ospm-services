PUNCH_PROMPT = """You are a prediction market analyst scanning Nigerian news for upcoming events.

CRAWLED NEWS CONTENT:
{corpus}

TODAY'S DATE: {current_date}

TASK: Find upcoming events with clear binary outcomes and create YES/NO prediction markets.

EVENT TYPES TO LOOK FOR:
- Sports: Match results, tournament winners, player transfers
- Entertainment: BBNaija evictions, award show winners (Headies, AMVCA), album/movie releases
- Politics: Election results, bill votes, government appointments
- Finance: Exchange rate milestones, inflation announcements, policy decisions
- Events: Conference outcomes, product launches, deadline-based announcements

RULES FOR GOOD MARKETS:
1. Question must be answerable with YES or NO
2. Outcome must be objectively verifiable
3. Event must have a specific date/time (or predictable timeframe)
4. Avoid vague or opinion-based questions
5. source_url MUST be a specific article URL from the crawled content (look for "--- PAGE: URL ---" markers), NOT a homepage or category page. Skip markets without a specific source article.

TIMING RULES:
- betting_closes_at: 1-2 hours before the event/announcement
- resolves_at: 2-4 hours after the event concludes

QUESTION FORMATS:
- "Will [Team] beat [Opponent] in [Match]?"
- "Will [Person] be evicted from BBNaija this week?"
- "Will [Artist] win [Category] at [Award Show]?"
- "Will [Bill/Policy] pass the [Senate/House]?"
- "Will NGN/USD exceed [X] by [Date]?"

OUTPUT FORMAT: Return a JSON object with a "markets" array.

Example:
{
  "markets": [
    {
      "question": "Will Wizkid win Artist of the Year at the 2026 Headies?",
      "description": "The Headies 2026 ceremony is scheduled for January 25th. Wizkid is nominated alongside Burna Boy and Davido.",
      "source_url": "https://punchng.com/...",
      "category": "entertainment",
      "betting_closes_at": "2026-01-25T17:00:00Z",
      "resolves_at": "2026-01-25T23:00:00Z",
      "resolution_context": "Check official Headies announcement or Punch Nigeria entertainment section"
    }
  ]
}

Return {"markets": []} if no valid upcoming events with clear binary outcomes are found.
Do NOT create markets for past events or events without specific timing."""
