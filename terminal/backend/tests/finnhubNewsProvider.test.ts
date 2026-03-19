import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock config to prevent real API key loading
vi.mock("../src/config.js", () => ({
  config: {
    port: 8080,
    sqlitePath: ":memory:",
    frontendOrigin: "http://localhost:5174",
    finnhubApiKey: "TEST_KEY_DO_NOT_USE",
  },
}));

// Mock db to prevent real DB access
vi.mock("../src/db.js", () => ({
  getDb: () => ({
    get: async () => null,
    all: async () => [],
    run: async () => ({ changes: 0 }),
  }),
  initDb: async () => {},
}));

let fetchCompanyNewsRaw: typeof import("../src/services/finnhubNewsProvider.js").fetchCompanyNewsRaw;
let fetchPressReleasesRaw: typeof import("../src/services/finnhubNewsProvider.js").fetchPressReleasesRaw;
let fetchMarketNewsPageRaw: typeof import("../src/services/finnhubNewsProvider.js").fetchMarketNewsPageRaw;

beforeAll(async () => {
  const mod = await import("../src/services/finnhubNewsProvider.js");
  fetchCompanyNewsRaw = mod.fetchCompanyNewsRaw;
  fetchPressReleasesRaw = mod.fetchPressReleasesRaw;
  fetchMarketNewsPageRaw = mod.fetchMarketNewsPageRaw;
});

// Helper to mock global fetch
function mockFetchOnce(data: any, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
      text: async () => JSON.stringify(data),
      headers: new Map(),
    }),
  );
}

describe("finnhubNewsProvider mapping", () => {
  describe("fetchCompanyNewsRaw", () => {
    it("should map all required fields correctly", async () => {
      mockFetchOnce([
        {
          datetime: 1709683200, // 2024-03-06T00:00:00Z
          headline: "Apple Q1 Results",
          summary: "Strong quarter for AAPL",
          url: "https://example.com/aapl",
          related: "AAPL,MSFT",
          category: "technology",
        },
      ]);

      const items = await fetchCompanyNewsRaw("AAPL", "2024-03-01", "2024-03-07");
      expect(items).toHaveLength(1);

      const item = items[0];
      expect(item.source).toBe("FINNHUB");
      expect(item.sourceType).toBe("company_news");
      expect(item.title).toBe("Apple Q1 Results");
      expect(item.body).toBe("Strong quarter for AAPL");
      expect(item.url).toBe("https://example.com/aapl");
      expect(item.providerTickers).toEqual(["AAPL", "MSFT"]);
      expect(item.tags).toEqual(["technology"]);
      expect(item.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should handle missing fields with defaults", async () => {
      mockFetchOnce([
        {
          datetime: 1709683200,
          // missing headline, summary, url, related, category
        },
      ]);

      const items = await fetchCompanyNewsRaw("AAPL", "2024-03-01", "2024-03-07");
      const item = items[0];
      expect(item.title).toBe("(untitled)");
      expect(item.body).toBe("");
      expect(item.url).toBe("");
      expect(item.providerTickers).toEqual(["AAPL"]);
      expect(item.tags).toEqual([]);
    });

    it("should never expose API key in mapped output", async () => {
      mockFetchOnce([
        {
          datetime: 1709683200,
          headline: "Test",
          url: "https://example.com/test",
        },
      ]);

      const items = await fetchCompanyNewsRaw("AAPL", "2024-03-01", "2024-03-07");
      const json = JSON.stringify(items);
      expect(json).not.toContain("TEST_KEY_DO_NOT_USE");
    });

    it("should handle non-array response gracefully", async () => {
      mockFetchOnce({ error: "invalid" });

      const items = await fetchCompanyNewsRaw("AAPL", "2024-03-01", "2024-03-07");
      expect(items).toEqual([]);
    });
  });

  describe("fetchPressReleasesRaw", () => {
    it("should map press release fields correctly", async () => {
      mockFetchOnce({
        majorDevelopment: [
          {
            datetime: "2024-03-05T15:00:00Z",
            headline: "AAPL Major Update",
            description: "New product launch",
            url: "https://example.com/pr",
            category: "new_product",
          },
        ],
      });

      const items = await fetchPressReleasesRaw("AAPL", "2024-03-01", "2024-03-07");
      expect(items).toHaveLength(1);

      const item = items[0];
      expect(item.source).toBe("FINNHUB");
      expect(item.sourceType).toBe("press_release");
      expect(item.title).toBe("AAPL Major Update");
      expect(item.body).toBe("New product launch");
      expect(item.providerTickers).toEqual(["AAPL"]);
      expect(item.tags).toEqual(["new_product"]);
    });

    it("should fall back to pressReleases array when majorDevelopment is missing", async () => {
      mockFetchOnce({
        pressReleases: [
          {
            datetime: "2024-03-05T15:00:00Z",
            description: "Quarterly report",
          },
        ],
      });

      const items = await fetchPressReleasesRaw("AAPL", "2024-03-01", "2024-03-07");
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("Quarterly report"); // falls back to description
    });

    it("should default tags to ['press_release'] when category is missing", async () => {
      mockFetchOnce({
        majorDevelopment: [
          {
            datetime: "2024-03-05T15:00:00Z",
            headline: "No Category",
          },
        ],
      });

      const items = await fetchPressReleasesRaw("AAPL", "2024-03-01", "2024-03-07");
      expect(items[0].tags).toEqual(["press_release"]);
    });
  });

  describe("fetchMarketNewsPageRaw", () => {
    it("should map market news fields correctly", async () => {
      mockFetchOnce([
        {
          id: 12345,
          datetime: 1709683200,
          headline: "Market Rally",
          summary: "Stocks rise broadly",
          url: "https://example.com/market",
          related: "SPY,QQQ",
          category: "general",
        },
      ]);

      const result = await fetchMarketNewsPageRaw("general");
      expect(result.items).toHaveLength(1);

      const item = result.items[0];
      expect(item.source).toBe("FINNHUB");
      expect(item.sourceType).toBe("market_news");
      expect(item.providerTickers).toEqual(["SPY", "QQQ"]);
      expect(item.tags).toEqual(["general"]);
    });

    it("should default providerTickers to [] when related is missing", async () => {
      mockFetchOnce([
        {
          id: 12346,
          datetime: 1709683200,
          headline: "General News",
          url: "https://example.com/gen",
        },
      ]);

      const result = await fetchMarketNewsPageRaw();
      expect(result.items[0].providerTickers).toEqual([]);
    });

    it("should provide nextMinId from the raw response", async () => {
      mockFetchOnce([
        { id: 100, datetime: 1709683200, headline: "A", url: "https://a.com" },
        { id: 50, datetime: 1709683100, headline: "B", url: "https://b.com" },
      ]);

      const result = await fetchMarketNewsPageRaw();
      expect(result.nextMinId).toBe("50");
    });
  });

  describe("epoch timestamp conversion", () => {
    it("should convert company news epoch seconds to ET naive ISO string", async () => {
      const epoch = 1709683200; // 2024-03-06T00:00:00.000Z
      mockFetchOnce([{ datetime: epoch, headline: "Test", url: "https://example.com" }]);

      const items = await fetchCompanyNewsRaw("TEST", "2024-03-01", "2024-03-07");
      expect(items[0].publishedAt).toBe("2024-03-05T19:00:00");
    });
  });
});
