from dataclasses import dataclass

from generator.prompts import NPFL_PROMPT, PUNCH_PROMPT, BBC_PROMPT


@dataclass
class DataSource:
    id: str
    seed_url: str
    category: str
    prompt: str
    use_javascript: bool = False
    wait_selector: str | None = None
    wait_timeout_ms: int = 5000
    max_links_to_scrape: int = 3


SOURCES: dict[str, DataSource] = {
    "npfl": DataSource(
        id="npfl",
        seed_url="https://npfl.ng/fixtures",
        category="sports",
        prompt=NPFL_PROMPT,
    ),
    "punch": DataSource(
        id="punch",
        seed_url="https://punchng.com/topics/news/",
        category="news",
        prompt=PUNCH_PROMPT,
        use_javascript=True,
        wait_selector="article",
        wait_timeout_ms=10000,
    ),
    "bbc": DataSource(
        id="bbc",
        seed_url="https://www.bbc.com/news/topics/c50znx8v848t",
        category="news",
        prompt=BBC_PROMPT,
        use_javascript=True,
        wait_selector="article",
        wait_timeout_ms=10000,
    ),
}
