import logging
from dataclasses import dataclass

import httpx
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

VERIFY_PROMPT = """You are an outcome verifier for a prediction market.

MARKET QUESTION: {question}
RESOLUTION CONTEXT: {resolution_context}

PAGE CONTENT (from source URL):
{page_content}

Based on the page content, determine if the answer to the market question is YES or NO.

Respond with EXACTLY this JSON format:
{{
  "outcome": true or false or null,
  "confidence": 0.0 to 1.0,
  "evidence": "brief explanation"
}}

Rules:
- outcome: true means YES, false means NO, null means CANNOT DETERMINE
- confidence: how confident you are (0.0 = no idea, 1.0 = certain)
- If the page content doesn't contain enough info to determine the outcome, set outcome to null and confidence to 0
- Be conservative — only return a non-null outcome if you're reasonably confident
"""

MAX_CONTENT_LENGTH = 10_000


@dataclass
class VerificationResult:
    outcome: bool | None
    confidence: float
    evidence: str


async def fetch_page_content(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=15
        ) as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; OSPM-Verifier/1.0)"
                },
            )
            if response.status_code != 200:
                return None
            return response.text[:MAX_CONTENT_LENGTH]
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None


async def verify_outcome(
    client: AsyncOpenAI,
    source_url: str,
    question: str,
    resolution_context: str,
    model: str = "gpt-4o-mini",
) -> VerificationResult:
    page_content = await fetch_page_content(source_url)
    if not page_content:
        return VerificationResult(
            outcome=None, confidence=0.0, evidence=f"Could not fetch {source_url}"
        )

    prompt = VERIFY_PROMPT.format(
        question=question,
        resolution_context=resolution_context,
        page_content=page_content,
    )

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        import json

        data = json.loads(response.choices[0].message.content or "{}")
        return VerificationResult(
            outcome=data.get("outcome"),
            confidence=float(data.get("confidence", 0)),
            evidence=data.get("evidence", "No evidence provided"),
        )
    except Exception as e:
        logger.error(f"AI verification failed: {e}")
        return VerificationResult(
            outcome=None, confidence=0.0, evidence=f"AI error: {str(e)}"
        )
