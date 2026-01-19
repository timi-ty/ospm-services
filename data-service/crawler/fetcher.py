import asyncio
import logging
import random
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from playwright_stealth import stealth_async

from .browser import get_browser_headers, USER_AGENTS
from .browser_engine import BrowserEngine
from .config import LinkInfo

logger = logging.getLogger(__name__)

# Elements to remove (noise)
NOISE_TAGS = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'form', 'noscript']


async def fetch_page(
    client: httpx.AsyncClient,
    url: str,
    referer: str | None = None,
    timeout: int = 30
) -> tuple[str | None, str | None]:
    """Fetch page and return (html, final_url). Returns (None, None) on failure."""
    try:
        headers = get_browser_headers(referer)
        response = await client.get(url, headers=headers, timeout=timeout, follow_redirects=True)
        
        content_type = response.headers.get('content-type', '')
        if 'text/html' not in content_type:
            logger.debug(f"Skipping non-HTML: {url} ({content_type})")
            return None, None
        
        response.raise_for_status()
        return response.text, str(response.url)
        
    except httpx.TimeoutException:
        logger.warning(f"Timeout fetching {url}")
    except httpx.HTTPStatusError as e:
        logger.warning(f"HTTP {e.response.status_code} for {url}")
    except Exception as e:
        logger.warning(f"Error fetching {url}: {e}")
    
    return None, None


async def fetch_page_js(
    url: str,
    referer: str | None = None,
    timeout: int = 30,
    wait_selector: str | None = None,
    wait_timeout_ms: int = 5000
) -> tuple[str | None, str | None]:
    """Fetch page with JavaScript rendering via Playwright."""
    logger.debug(f"[JS] Starting fetch for {url}")
    
    try:
        browser = await BrowserEngine.get_browser()
        logger.debug(f"[JS] Got browser instance")
    except Exception as e:
        logger.error(f"[JS] Failed to get browser: {type(e).__name__}: {e}")
        return None, None

    context = None
    page = None
    
    try:
        ua = random.choice(USER_AGENTS)
        logger.debug(f"[JS] Creating context with UA: {ua[:50]}...")
        context = await browser.new_context(
            user_agent=ua,
            viewport={'width': 1920, 'height': 1080},
            # Realistic browser settings
            locale='en-US',
            timezone_id='Africa/Lagos',
            geolocation={'latitude': 6.5244, 'longitude': 3.3792},
            permissions=['geolocation'],
        )
        logger.debug(f"[JS] Context created")

        page = await context.new_page()
        logger.debug(f"[JS] Page created")

        # Apply stealth patches BEFORE navigation
        logger.debug(f"[JS] Applying stealth patches")
        await stealth_async(page)
        logger.debug(f"[JS] Stealth patches applied")

        # Listen for page errors and crashes
        page.on("crash", lambda: logger.error(f"[JS] PAGE CRASHED for {url}"))
        page.on("pageerror", lambda err: logger.warning(f"[JS] Page error: {err}"))
        page.on("console", lambda msg: logger.debug(f"[JS] Console [{msg.type}]: {msg.text}") if msg.type == "error" else None)

        if referer:
            await page.set_extra_http_headers({'Referer': referer})
            logger.debug(f"[JS] Set referer header")

        # Navigate - use 'load' instead of 'networkidle' for reliability
        logger.info(f"[JS] Navigating to {url} (timeout={timeout}s)")
        response = await page.goto(url, wait_until='load', timeout=timeout * 1000)
        
        if response:
            logger.info(f"[JS] Navigation complete: status={response.status}, url={response.url}")
        else:
            logger.warning(f"[JS] Navigation returned no response")

        # Optionally wait for specific selector
        if wait_selector:
            logger.debug(f"[JS] Waiting for selector '{wait_selector}' (timeout={wait_timeout_ms}ms)")
            try:
                await page.wait_for_selector(wait_selector, timeout=wait_timeout_ms)
                logger.debug(f"[JS] Selector found")
            except Exception as e:
                logger.debug(f"[JS] Selector '{wait_selector}' not found: {e}")

        # Simulate human-like behavior (brief scroll)
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight / 4)')
        await asyncio.sleep(0.3)

        logger.debug(f"[JS] Getting page content")
        html = await page.content()
        final_url = page.url
        logger.info(f"[JS] Success: got {len(html)} chars from {final_url}")
        return html, final_url

    except Exception as e:
        logger.error(f"[JS] Fetch failed for {url}: {type(e).__name__}: {e}")
        import traceback
        logger.debug(f"[JS] Traceback: {traceback.format_exc()}")
        return None, None

    finally:
        if context:
            logger.debug(f"[JS] Closing context")
            try:
                await context.close()
                logger.debug(f"[JS] Context closed")
            except Exception as e:
                logger.warning(f"[JS] Error closing context: {e}")


def extract_text(html: str) -> str:
    """Extract visible text from HTML, removing noise elements."""
    soup = BeautifulSoup(html, 'lxml')
    
    # Remove noise elements
    for tag in soup.find_all(NOISE_TAGS):
        tag.decompose()
    
    # Get text with whitespace preservation
    text = soup.get_text(separator='\n', strip=True)
    
    # Clean up excessive whitespace
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return '\n'.join(lines)


def extract_article_content(html: str) -> str:
    """Extract text from <article> or <main> tags only, with fallback."""
    soup = BeautifulSoup(html, 'lxml')
    
    # Try <article> first, then <main>
    container = soup.find('article') or soup.find('main')
    
    if container:
        # Remove noise within the container
        for tag in container.find_all(['script', 'style', 'nav', 'aside', 'footer', 'form']):
            tag.decompose()
        text = container.get_text(separator='\n', strip=True)
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return '\n'.join(lines)
    
    # Fallback to full page extraction
    return extract_text(html)


def extract_links_with_context(html: str, base_url: str) -> list[LinkInfo]:
    """Extract links with anchor text and surrounding context."""
    soup = BeautifulSoup(html, 'lxml')
    base_domain = urlparse(base_url).netloc
    seen_urls: set[str] = set()
    links: list[LinkInfo] = []
    
    for anchor in soup.find_all('a', href=True):
        href = anchor['href']
        
        # Skip anchors, javascript, mailto
        if href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
            continue
        
        # Resolve relative URLs
        full_url = urljoin(base_url, href)
        
        # Parse and clean
        parsed = urlparse(full_url)
        if parsed.scheme not in ('http', 'https'):
            continue
        
        # Same domain only
        if parsed.netloc != base_domain:
            continue
        
        # Remove fragments
        clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if parsed.query:
            clean_url += f"?{parsed.query}"
        
        # Skip duplicates
        if clean_url in seen_urls:
            continue
        seen_urls.add(clean_url)
        
        # Get anchor text
        anchor_text = anchor.get_text(strip=True)
        if not anchor_text:
            continue  # Skip links without text
        
        # Get context from parent or nearby heading
        context = ""
        parent = anchor.find_parent(['p', 'li', 'div', 'h1', 'h2', 'h3', 'h4', 'article'])
        if parent:
            context = parent.get_text(strip=True)[:200]  # Limit context length
        
        links.append(LinkInfo(url=clean_url, text=anchor_text, context=context))
    
    return links


def extract_links(html: str, base_url: str, same_domain_only: bool) -> list[str]:
    """Extract all links from HTML, optionally filtering to same domain."""
    soup = BeautifulSoup(html, 'lxml')
    base_domain = urlparse(base_url).netloc
    links = []
    
    for anchor in soup.find_all('a', href=True):
        href = anchor['href']
        
        # Skip anchors, javascript, mailto
        if href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
            continue
        
        # Resolve relative URLs
        full_url = urljoin(base_url, href)
        
        # Parse and clean
        parsed = urlparse(full_url)
        if parsed.scheme not in ('http', 'https'):
            continue
        
        # Remove fragments
        clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if parsed.query:
            clean_url += f"?{parsed.query}"
        
        # Filter to same domain if configured
        if same_domain_only and parsed.netloc != base_domain:
            continue
        
        links.append(clean_url)
    
    return list(set(links))  # Dedupe
