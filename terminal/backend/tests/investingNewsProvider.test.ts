import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractInvestingTickers,
  fetchInvestingCategory,
  investingCategoryToSourceType,
  setInvestingHtmlLoaderForTests,
} from "../src/services/investingNewsProvider.js";

afterEach(() => {
  setInvestingHtmlLoaderForTests(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("investingNewsProvider", () => {
  it("should map category slug to source_type", () => {
    expect(investingCategoryToSourceType("stock-market-news")).toBe("investing_stock_market_news");
    expect(investingCategoryToSourceType("cryptocurrency-news")).toBe("investing_cryptocurrency_news");
  });

  it("should fall back to browser HTML when fetch returns a Cloudflare challenge page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <div class="h2"><span id="challenge-error-text">Enable JavaScript and cookies to continue</span></div>
              <script>window._cf_chl_opt = {};</script>
            </body>
          </html>
        `,
      }),
    );

    setInvestingHtmlLoaderForTests(async () => `
      <html>
        <body>
          <article data-test="article-item">
            <a data-test="article-title-link" href="/news/stock-market-news/example-story-123">Example Story Title</a>
            <time datetime="2026-03-30T13:45:00Z"></time>
            <p data-test="article-description">Example Story Summary</p>
          </article>
        </body>
      </html>
    `);

    const items = await fetchInvestingCategory("stock-market-news", {
      maxPages: 1,
      requestIntervalMs: 0,
      fromDate: "2026-03-29",
      toDate: "2026-03-30",
    });

    expect(items).toHaveLength(1);
    expect(items[0].source).toBe("INVESTING");
    expect(items[0].sourceType).toBe("investing_stock_market_news");
    expect(items[0].title).toBe("Example Story Title");
    expect(items[0].body).toBe("Example Story Summary");
    expect(items[0].url).toBe("https://www.investing.com/news/stock-market-news/example-story-123");
    expect(items[0].tags).toEqual(["stock-market-news"]);
  });

  it("should convert Investing listing datetime attributes from UTC into ET-naive timestamps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <article data-test="article-item">
                <a data-test="article-title-link" href="/news/stock-market-news/example-story-utc-123">Example UTC Story</a>
                <time datetime="2026-03-30 12:49:30"></time>
                <p data-test="article-description">UTC timestamp summary</p>
              </article>
            </body>
          </html>
        `,
      }),
    );

    const items = await fetchInvestingCategory("stock-market-news", {
      maxPages: 1,
      requestIntervalMs: 0,
      fromDate: "2026-03-30",
      toDate: "2026-03-30",
    });

    expect(items).toHaveLength(1);
    expect(items[0].publishedAt).toBe("2026-03-30T08:49:30");
  });

  it("should keep paging past pages that only hold articles newer than the requested range", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const page = /\/(\d+)$/.exec(String(url))?.[1] ?? "1";
      const dateByPage: Record<string, string> = {
        "1": "2026-07-19T12:00:00Z",
        "2": "2026-07-18T12:00:00Z",
        "3": "2026-07-10T12:00:00Z",
      };
      const date = dateByPage[page] ?? "2026-07-01T12:00:00Z";
      return {
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <article data-test="article-item">
                <a data-test="article-title-link" href="/news/stock-market-news/story-page-${page}">Story Page ${page}</a>
                <time datetime="${date}"></time>
                <p data-test="article-description">Summary ${page}</p>
              </article>
            </body>
          </html>
        `,
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchInvestingCategory("stock-market-news", {
      maxPages: 5,
      requestIntervalMs: 0,
      fromDate: "2026-07-09",
      toDate: "2026-07-11",
    });

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Story Page 3");
  });

  it("should date-jump to deep historical ranges without missing any article in the range", async () => {
    // Simulate 200 listing pages, one article per page, one day per page:
    // page N holds an article dated (2026-07-20 minus N-1 days).
    const baseUtcMs = Date.UTC(2026, 6, 20, 16, 0, 0); // 12:00 ET
    const dateForPage = (page: number) =>
      new Date(baseUtcMs - (page - 1) * 86_400_000).toISOString();
    const dayForPage = (page: number) => {
      const et = new Date(baseUtcMs - (page - 1) * 86_400_000 - 4 * 3_600_000);
      return et.toISOString().slice(0, 10);
    };

    const fetchedPages: number[] = [];
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const page = Number(/\/(\d+)$/.exec(String(url))?.[1] ?? "1");
      fetchedPages.push(page);
      return {
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <article data-test="article-item">
                <a data-test="article-title-link" href="/news/stock-market-news/story-${page}">Story ${page}</a>
                <time datetime="${dateForPage(page)}"></time>
                <p data-test="article-description">Summary ${page}</p>
              </article>
            </body>
          </html>
        `,
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    // Range ~4 months back spanning pages 120..126 (7 days).
    const fromDate = dayForPage(126);
    const toDate = dayForPage(120);

    const items = await fetchInvestingCategory("stock-market-news", {
      maxPages: 1000,
      requestIntervalMs: 0,
      fromDate,
      toDate,
    });

    // Every day in the range is present — nothing skipped.
    const days = items.map((item) => item.publishedAt.slice(0, 10)).sort();
    expect(days).toEqual(
      [126, 125, 124, 123, 122, 121, 120].map(dayForPage).sort(),
    );

    // The jump actually skipped pages: far fewer requests than walking 1..127.
    const uniquePages = new Set(fetchedPages);
    expect(uniquePages.size).toBeLessThan(35);
    // Walk was sequential across the whole range (no gaps inside it).
    for (let page = 120; page <= 126; page++) {
      expect(uniquePages.has(page)).toBe(true);
    }
  });

  it("should extract US-exchange tickers from Investing article text", () => {
    const text = [
      "Apple Inc (NASDAQ:AAPL) rose while Berkshire (NYSE:BRK.A) held steady.",
      "Overseas names like (LON:VOD) or (TSE:7203) are ignored.",
      "Duplicate mention (NASDAQ:AAPL) is deduped; (NASDAQ: MSFT ) tolerates spaces.",
    ].join("\n");
    expect(extractInvestingTickers(text)).toEqual(["AAPL", "BRK.A", "MSFT"]);
    expect(extractInvestingTickers("")).toEqual([]);
    expect(extractInvestingTickers(null)).toEqual([]);
  });
});