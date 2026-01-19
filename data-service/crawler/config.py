from dataclasses import dataclass


@dataclass
class LinkInfo:
    """Link with context for AI selection."""
    url: str
    text: str       # Anchor text
    context: str    # Surrounding paragraph/heading text


@dataclass
class CrawlConfig:
    seed_url: str
    max_links_to_scrape: int = 3
    use_javascript: bool = False
    wait_selector: str | None = None
    wait_timeout_ms: int = 5000
    timeout_seconds: int = 30


@dataclass
class CrawlResult:
    text_corpus: str
    pages_visited: list[str]
    errors: list[str]
