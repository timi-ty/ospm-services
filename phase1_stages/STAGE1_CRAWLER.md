# Stage 1: Recursive Web Crawler

> **Input:** Seed URL  
> **Output:** Text corpus from crawled pages  
> **Language:** Python

---

## Purpose

Crawl a website recursively, extract all visible text, aggregate into a single corpus for AI analysis.

---

## Interface

```python
async def crawl(config: CrawlConfig) -> CrawlResult
```

```python
@dataclass
class CrawlConfig:
    seed_url: str
    max_depth: int = 2
    max_pages: int = 30
    same_domain_only: bool = True
    delay_ms: int = 500

@dataclass
class CrawlResult:
    text_corpus: str          # All text, pages separated by markers
    pages_visited: list[str]  # URLs visited
    errors: list[str]         # Any failed URLs
```

---

## Algorithm

```
1. Initialize queue with seed_url at depth 0
2. Initialize visited set
3. While queue not empty AND pages_visited < max_pages:
   a. Pop (url, depth) from queue
   b. Skip if url in visited
   c. Fetch page, extract text, append to corpus
   d. Mark url as visited
   e. If depth < max_depth:
      - Extract all links from page
      - Filter to same domain (if configured)
      - Add (link, depth+1) to queue
   f. Sleep delay_ms (politeness)
4. Return corpus
```

---

## Text Extraction Rules

- Strip all HTML tags
- Preserve meaningful whitespace (paragraphs, line breaks)
- Remove scripts, styles, nav elements, footers (noise)
- Keep: headings, paragraphs, tables, lists
- Page separator in corpus: `\n\n--- PAGE: {url} ---\n\n`

---

## Dependencies

```
httpx          # Async HTTP client
beautifulsoup4 # HTML parsing (for text extraction only)
lxml           # Fast HTML parser
```

---

## Edge Cases

| Case | Handling |
|------|----------|
| 404/500 errors | Log, skip, continue |
| Timeout | 30s limit, then skip |
| Redirect loops | Track visited by final URL |
| Non-HTML content (PDF, images) | Skip based on Content-Type |
| JavaScript-rendered content | Not handled in Phase 1 |

---

## File Structure

```
data-service/
└── crawler/
    ├── __init__.py      # exports crawl()
    ├── fetcher.py       # HTTP fetch + text extraction
    └── config.py        # CrawlConfig dataclass
```

---

## Success Criteria

```
✓ crawl("https://npfl.ng/fixtures") returns non-empty corpus
✓ Respects max_depth and max_pages limits
✓ Stays on same domain
✓ Handles errors gracefully
```
