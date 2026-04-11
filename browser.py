import asyncio
import logging

logger = logging.getLogger("jarvis.browser")

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("Playwright not installed. Run: playwright install chromium")

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


async def browse_url(url: str) -> str:
    """Visit a URL and extract its readable text content."""
    if not PLAYWRIGHT_AVAILABLE:
        return "Web browsing is unavailable. Install Playwright: pip install playwright && playwright install chromium"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.set_extra_http_headers({"User-Agent": _USER_AGENT})
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)

            content = await page.evaluate("""() => {
                const remove = document.querySelectorAll(
                    'script, style, nav, footer, header, aside, .ad, [class*="banner"], [class*="cookie"]'
                );
                remove.forEach(el => el.remove());
                const main = document.querySelector('main, article, [role="main"]');
                const el = main || document.body;
                return el ? el.innerText.substring(0, 4000) : '';
            }""")
            title = await page.title()
            await browser.close()
            result = f"[{title}]\n\n{content.strip()}"
            return result or "No readable content found."
    except Exception as e:
        logger.error(f"Browse error for {url}: {e}")
        return f"Unable to browse {url}: {str(e)[:200]}"


async def web_search(query: str) -> str:
    """Search Google and return a summary of results."""
    if not PLAYWRIGHT_AVAILABLE:
        return f"Web search unavailable. Query was: {query}"

    search_url = f"https://www.google.com/search?q={query.replace(' ', '+')}&hl=en"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.set_extra_http_headers({"User-Agent": _USER_AGENT})
            await page.goto(search_url, wait_until="domcontentloaded", timeout=15000)

            results = await page.evaluate("""() => {
                const items = [];
                document.querySelectorAll('.g').forEach((el, i) => {
                    if (i >= 5) return;
                    const h3 = el.querySelector('h3');
                    const snippet = el.querySelector('.VwiC3b, [data-sncf], .IsZvec');
                    if (h3) {
                        items.push({
                            title: h3.innerText.trim(),
                            snippet: snippet ? snippet.innerText.trim().substring(0, 250) : ''
                        });
                    }
                });
                return items;
            }""")
            await browser.close()

            if not results:
                return f"Search completed for '{query}' — no structured results extracted."

            lines = [f"Search results for '{query}':"]
            for i, r in enumerate(results, 1):
                lines.append(f"\n{i}. {r['title']}")
                if r["snippet"]:
                    lines.append(f"   {r['snippet']}")
            return "\n".join(lines)

    except Exception as e:
        logger.error(f"Search error for '{query}': {e}")
        return f"Unable to search for '{query}': {str(e)[:200]}"
