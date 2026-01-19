import asyncio
import logging

import httpx
from openai import AsyncOpenAI

from .config import CrawlConfig, CrawlResult
from .fetcher import (
    fetch_page,
    fetch_page_js,
    extract_links_with_context,
    extract_article_content,
)
from generator.link_selector import select_links

logger = logging.getLogger(__name__)


async def guided_crawl(
    config: CrawlConfig,
    ai_client: AsyncOpenAI,
    model: str = "gpt-4o-mini"
) -> CrawlResult:
    """
    AI-guided crawl: fetch homepage -> AI selects links -> scrape articles.
    
    1. Fetch seed URL
    2. Extract all links with context
    3. AI selects best links (up to max_links_to_scrape)
    4. Fetch and extract article content from each selected link
    """
    corpus_parts: list[str] = []
    pages_visited: list[str] = []
    errors: list[str] = []
    
    # Step 1: Fetch seed page
    logger.info(f"Fetching seed URL: {config.seed_url}")
    
    if config.use_javascript:
        html, final_url = await fetch_page_js(
            config.seed_url,
            timeout=config.timeout_seconds,
            wait_selector=config.wait_selector,
            wait_timeout_ms=config.wait_timeout_ms
        )
    else:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            html, final_url = await fetch_page(
                client,
                config.seed_url,
                timeout=config.timeout_seconds
            )
    
    if html is None:
        logger.error(f"Failed to fetch seed URL: {config.seed_url}")
        errors.append(config.seed_url)
        return CrawlResult(text_corpus="", pages_visited=[], errors=errors)
    
    seed_url = final_url or config.seed_url
    
    # Step 2: Extract all links with context
    logger.info("Extracting links with context...")
    links = extract_links_with_context(html, seed_url)
    logger.info(f"Found {len(links)} links on seed page")
    
    if not links:
        logger.warning("No links found on seed page")
        return CrawlResult(text_corpus="", pages_visited=[], errors=[])
    
    # Step 3: AI selects best links
    logger.info("AI selecting relevant links...")
    selected_urls = await select_links(ai_client, links, seed_url, model=model)
    
    if not selected_urls:
        logger.warning("AI did not select any links")
        return CrawlResult(text_corpus="", pages_visited=[], errors=[])
    
    # Limit to configured max
    selected_urls = selected_urls[:config.max_links_to_scrape]
    logger.info(f"AI selected {len(selected_urls)} links for scraping")
    
    # Step 4: Fetch and extract article content from each
    for url in selected_urls:
        logger.info(f"Scraping article: {url}")
        
        if config.use_javascript:
            page_html, page_final_url = await fetch_page_js(
                url,
                referer=seed_url,
                timeout=config.timeout_seconds,
                wait_selector=config.wait_selector,
                wait_timeout_ms=config.wait_timeout_ms
            )
        else:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                page_html, page_final_url = await fetch_page(
                    client,
                    url,
                    referer=seed_url,
                    timeout=config.timeout_seconds
                )
        
        if page_html is None:
            logger.warning(f"Failed to fetch: {url}")
            errors.append(url)
            continue
        
        content = extract_article_content(page_html)
        if content:
            actual_url = page_final_url or url
            corpus_parts.append(f"--- PAGE: {actual_url} ---\n{content}")
            pages_visited.append(actual_url)
            logger.info(f"Extracted {len(content)} chars from {actual_url}")
        
        # Brief delay between requests
        await asyncio.sleep(0.5)
    
    return CrawlResult(
        text_corpus='\n\n'.join(corpus_parts),
        pages_visited=pages_visited,
        errors=errors
    )


__all__ = ['guided_crawl', 'CrawlConfig', 'CrawlResult']
