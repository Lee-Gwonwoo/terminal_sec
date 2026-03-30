import { afterEach, describe, expect, it, vi } from "vitest";

import {
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
});