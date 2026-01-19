import json
import logging
import os
from datetime import datetime, timezone

from openai import AsyncOpenAI

from .chunker import chunk_corpus
from .models import MarketProposal
from .models_config import get_max_corpus_chars

logger = logging.getLogger(__name__)


def clean_json_response(content: str) -> str:
    """Strip markdown code blocks if present."""
    content = content.strip()
    if content.startswith("```"):
        first_newline = content.find("\n")
        if first_newline != -1:
            content = content[first_newline + 1:]
        if content.endswith("```"):
            content = content[:-3]
    return content.strip()


def dedupe_proposals(proposals: list[MarketProposal]) -> list[MarketProposal]:
    """Remove duplicate markets based on question similarity."""
    seen_questions: set[str] = set()
    unique: list[MarketProposal] = []
    for p in proposals:
        normalized = p.question.lower().strip()
        if normalized not in seen_questions:
            seen_questions.add(normalized)
            unique.append(p)
    return unique


async def process_chunk(
    client: AsyncOpenAI,
    chunk: str,
    prompt_template: str,
    model: str,
    current_date: str
) -> list[MarketProposal]:
    """Process a single chunk and return market proposals."""
    prompt = prompt_template.replace("{corpus}", chunk).replace("{current_date}", current_date)

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=2000
        )

        content = response.choices[0].message.content
        if content is None:
            logger.error("AI returned None content")
            return []

        content = clean_json_response(content)
        logger.debug(f"AI response (first 500 chars): {content[:500]}")

        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            logger.error(f"Raw content: {content[:1000]}")
            return []

        raw_markets = data.get("markets", [])
        if not raw_markets:
            logger.info("AI returned empty markets array for chunk")
            return []

        proposals: list[MarketProposal] = []
        for m in raw_markets:
            try:
                proposal = MarketProposal(
                    question=m.get("question", ""),
                    description=m.get("description", ""),
                    source_url=m.get("source_url", ""),
                    category=m.get("category", "news"),
                    betting_closes_at=m.get("betting_closes_at", ""),
                    resolves_at=m.get("resolves_at", ""),
                    resolution_context=m.get("resolution_context", "")
                )
                if proposal.is_valid():
                    proposals.append(proposal)
                else:
                    logger.warning(f"Invalid proposal skipped: {m.get('question', 'no question')}")
            except Exception as e:
                logger.warning(f"Failed to parse market: {e}")

        return proposals

    except Exception as e:
        logger.error(f"AI generation failed for chunk: {type(e).__name__}: {e}")
        raise


async def generate_markets(
    client: AsyncOpenAI,
    corpus: str,
    prompt_template: str,
    target_count: int = 5
) -> list[MarketProposal]:
    """
    Use AI to generate market proposals from crawled text.
    Automatically chunks corpus to fit within model token limits.
    """
    if not corpus.strip():
        logger.warning("Empty corpus, skipping AI call")
        return []

    # Get model config from environment
    model = os.getenv("AI_MODEL", "gpt-4-turbo-preview")
    max_tokens_override = os.getenv("AI_MAX_TOKENS_OVERRIDE", "")

    # Calculate max chunk size
    prompt_overhead = len(prompt_template) + 500
    if max_tokens_override:
        max_chars = int(int(max_tokens_override) * 4) - prompt_overhead
    else:
        max_chars = get_max_corpus_chars(model, prompt_overhead)

    logger.info(f"Using model: {model}, max_chars per chunk: {max_chars}")

    # Chunk corpus
    chunks = chunk_corpus(corpus, max_chars)
    logger.info(f"Processing {len(chunks)} chunk(s)")

    # Process each chunk
    current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    all_proposals: list[MarketProposal] = []

    for i, chunk in enumerate(chunks):
        try:
            proposals = await process_chunk(client, chunk, prompt_template, model, current_date)
            all_proposals.extend(proposals)
            logger.info(f"Chunk {i+1}/{len(chunks)}: {len(proposals)} markets")
        except Exception as e:
            logger.error(f"Chunk {i+1}/{len(chunks)} failed: {e}")
            # Continue with other chunks

    # Deduplicate
    unique = dedupe_proposals(all_proposals)
    logger.info(f"Generated {len(unique)} unique proposals from {len(all_proposals)} total")

    return unique[:target_count]


__all__ = ['generate_markets', 'MarketProposal']
