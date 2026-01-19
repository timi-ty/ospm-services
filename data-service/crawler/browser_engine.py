import logging
from typing import ClassVar

from playwright.async_api import async_playwright, Browser, Playwright

logger = logging.getLogger(__name__)


class BrowserEngine:
    """Manages a persistent browser instance for JavaScript rendering."""

    _browser: ClassVar[Browser | None] = None
    _playwright: ClassVar[Playwright | None] = None

    @classmethod
    async def get_browser(cls) -> Browser:
        """Get or create the browser instance."""
        if cls._browser is None:
            logger.info("Starting Playwright Firefox browser...")
            cls._playwright = await async_playwright().start()
            cls._browser = await cls._playwright.firefox.launch(
                headless=True,
            )
            logger.info("Playwright Firefox browser started")
        return cls._browser

    @classmethod
    async def shutdown(cls) -> None:
        """Close browser and stop Playwright."""
        if cls._browser:
            logger.info("Shutting down Playwright browser...")
            await cls._browser.close()
            cls._browser = None
        if cls._playwright:
            await cls._playwright.stop()
            cls._playwright = None
            logger.info("Playwright stopped")
