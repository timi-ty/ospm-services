import json
import logging
from datetime import datetime, timezone

from openai import AsyncOpenAI

from crawler.config import LinkInfo

logger = logging.getLogger(__name__)

LINK_SELECTOR_PROMPT = """You are selecting news links for prediction market generation.

AVAILABLE LINKS FROM {source_url}:
{links_json}

TODAY: {current_date}

TASK: Select exactly 3 links most likely to contain upcoming events suitable for YES/NO prediction markets.

PRIORITIZE:
- Sports fixtures, match schedules
- Elections, voting dates
- Policy announcements with deadlines
- Scheduled events with specific dates
- Breaking news about future developments

AVOID:
- Opinion pieces, editorials
- Historical/past event coverage
- Generic category/archive pages
- About/contact pages

Return JSON: {{"selected_urls": ["url1", "url2", "url3"]}}

If fewer than 3 good links exist, return what you have. Never return an empty array unless there are truly no relevant links."""


async def select_links(
    client: AsyncOpenAI,
    links: list[LinkInfo],
    source_url: str,
    model: str = "gpt-4o-mini"
) -> list[str]:
    """AI selects the most relevant links for market generation."""
    if not links:
        logger.warning("No links provided for selection")
        return []
    
    # Format links for AI
    links_data = [
        {"url": link.url, "text": link.text, "context": link.context}
        for link in links[:100]  # Limit to 100 links to control token usage
    ]
    
    current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    prompt = LINK_SELECTOR_PROMPT.format(
        source_url=source_url,
        links_json=json.dumps(links_data, indent=2),
        current_date=current_date
    )
    
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,  # Lower temperature for more consistent selection
            max_tokens=500
        )
        
        content = response.choices[0].message.content
        if not content:
            logger.error("AI returned empty content for link selection")
            return []
        
        data = json.loads(content)
        selected = data.get("selected_urls", [])
        
        # Validate URLs exist in original links
        valid_urls = {link.url for link in links}
        validated = [url for url in selected if url in valid_urls]
        
        logger.info(f"AI selected {len(validated)} links from {len(links)} available")
        return validated[:3]  # Hard cap at 3
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI link selection: {e}")
        return []
    except Exception as e:
        logger.error(f"Link selection failed: {type(e).__name__}: {e}")
        raise


__all__ = ['select_links', 'LinkInfo']
