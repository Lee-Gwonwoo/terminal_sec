import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

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
const mockDb = {
  get: vi.fn<(...args: any[]) => Promise<any>>(async () => null),
  all: vi.fn<(...args: any[]) => Promise<any[]>>(async () => []),
  run: vi.fn<(...args: any[]) => Promise<any>>(async () => ({ changes: 0 })),
};

vi.mock("../src/db.js", () => ({
  getDb: () => mockDb,
  initDb: async () => {},
}));

let fetchCompanyNewsRaw: typeof import("../src/services/finnhubNewsProvider.js").fetchCompanyNewsRaw;
let fetchPressReleasesRaw: typeof import("../src/services/finnhubNewsProvider.js").fetchPressReleasesRaw;
let fetchMarketNewsPageRaw: typeof import("../src/services/finnhubNewsProvider.js").fetchMarketNewsPageRaw;
let canonicalizePublisherLabel: typeof import("../src/services/finnhubNewsProvider.js").canonicalizePublisherLabel;
let backfillPublisher: typeof import("../src/services/finnhubNewsProvider.js").backfillPublisher;

beforeAll(async () => {
  const mod = await import("../src/services/finnhubNewsProvider.js");
  fetchCompanyNewsRaw = mod.fetchCompanyNewsRaw;
  fetchPressReleasesRaw = mod.fetchPressReleasesRaw;
  fetchMarketNewsPageRaw = mod.fetchMarketNewsPageRaw;
  canonicalizePublisherLabel = mod.canonicalizePublisherLabel;
  backfillPublisher = mod.backfillPublisher;
});

beforeEach(() => {
  mockDb.get.mockReset();
  mockDb.all.mockReset();
  mockDb.run.mockReset();
  mockDb.get.mockResolvedValue(null);
  mockDb.all.mockResolvedValue([]);
  mockDb.run.mockResolvedValue({ changes: 0 });
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
          url: "https://example.com/missing-fields",
          // missing headline, summary, related, category
        },
      ]);

      const items = await fetchCompanyNewsRaw("AAPL", "2024-03-01", "2024-03-07");
      const item = items[0];
      expect(item.title).toBe("(untitled)");
      expect(item.body).toBe("");
      expect(item.url).toBe("https://example.com/missing-fields");
      expect(item.providerTickers).toEqual(["AAPL"]);
      expect(item.tags).toEqual([]);
    });

    it("should canonicalize publisher labels from Finnhub source field", async () => {
      mockFetchOnce([
        {
          datetime: 1709683200,
          headline: "Yahoo sample",
          summary: "Summary",
          url: "https://finnhub.io/api/news?id=test",
          source: "Yahoo Finance",
        },
      ]);

      const items = await fetchCompanyNewsRaw("AAPL", "2024-03-01", "2024-03-07");
      expect(items[0].publisher).toBe("YAHOO");
    });

    it("should infer Motley Fool publisher from content when Finnhub source stays FINNHUB", async () => {
      mockFetchOnce([
        {
          datetime: 1709683200,
          headline: "Why Motley Fool likes this AI stock",
          summary: "Motley Fool says the AI story is just getting started.",
          url: "https://finnhub.io/api/news?id=test",
          source: "Finnhub",
        },
      ]);

      const items = await fetchCompanyNewsRaw("AAPL", "2024-03-01", "2024-03-07");
      expect(items[0].publisher).toBe("MOTLEY FOOL");
    });

    it("should infer Yahoo publisher only for Yahoo-branded show or transcript patterns", async () => {
      mockFetchOnce([
        {
          datetime: 1709683200,
          headline: "Retail investor buying holds strong: Why these names are winning",
          summary: "Yahoo Finance Senior Business Reporter Ines Ferre and B. Riley Wealth chief market strategist Art Hogan join Opening Bid host Brian Sozzi.",
          url: "https://finnhub.io/api/news?id=test-yahoo",
          source: "Finnhub",
        },
      ]);

      const items = await fetchCompanyNewsRaw("AAPL", "2024-03-01", "2024-03-07");
      expect(items[0].publisher).toBe("YAHOO");
    });

    it("should skip company news items with blank links", async () => {
      mockFetchOnce([
        {
          datetime: 1709683200,
          headline: "No link item",
          summary: "Missing url should be dropped",
          url: "",
          source: "Finnhub",
        },
      ]);

      const items = await fetchCompanyNewsRaw("AAPL", "2024-03-01", "2024-03-07");
      expect(items).toEqual([]);
    });

    it("should skip blocked company news publishers but keep Motley Fool", async () => {
      mockFetchOnce([
        {
          datetime: 1709683200,
          headline: "Why Motley Fool likes this AI stock",
          summary: "Motley Fool says the AI story is just getting started.",
          url: "https://www.fool.com/investing/example",
          source: "Motley Fool",
        },
        {
          datetime: 1709683201,
          headline: "Stock Picks From Seeking Alpha's New Analysts",
          summary: "Seeking Alpha analysts share their latest picks.",
          url: "https://finnhub.io/api/news?id=test",
          source: "Finnhub",
        },
      ]);

      const items = await fetchCompanyNewsRaw("AAPL", "2024-03-01", "2024-03-07");
      expect(items).toHaveLength(1);
      expect(items[0].publisher).toBe("MOTLEY FOOL");
      expect(items[0].url).toBe("https://www.fool.com/investing/example");
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

  describe("publisher helpers", () => {
    it("should canonicalize equivalent publisher labels consistently", () => {
      expect(canonicalizePublisherLabel("Yahoo Finance")).toBe("YAHOO");
      expect(canonicalizePublisherLabel("SEEKING ALPHA")).toBe("SEEKINGALPHA");
      expect(canonicalizePublisherLabel("PR Newswire")).toBe("PRNEWSWIRE");
    });

    it("should use origin_url to backfill FINNHUB publisher rows", async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: "row-1",
          url: "https://finnhub.io/api/news?id=abc",
          origin_url: "https://finance.yahoo.com/news/example-123.html",
          publisher: "FINNHUB",
          title: "Example title",
          body: "Example body",
          source_type: "company_news",
        },
      ] as any);
      mockDb.run.mockResolvedValue({ changes: 1 });

      const updated = await backfillPublisher();
      expect(updated).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        "UPDATE news_items SET publisher = ? WHERE id = ?",
        ["YAHOO", "row-1"],
      );
    });

    it("should infer publisher from title or body for FINNHUB company_news rows without origin_url", async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: "row-2",
          url: "https://finnhub.io/api/news?id=def",
          origin_url: null,
          publisher: "FINNHUB",
          title: "Stock Picks From Seeking Alpha's February 2026 New Analysts",
          body: "Meet Seeking Alpha's 17 new analysts and their stock picks.",
          source_type: "company_news",
        },
      ] as any);
      mockDb.run.mockResolvedValue({ changes: 1 });

      const updated = await backfillPublisher();
      expect(updated).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        "UPDATE news_items SET publisher = ? WHERE id = ?",
        ["SEEKINGALPHA", "row-2"],
      );
    });

    it("should infer Yahoo publisher from Yahoo-branded transcript cues, not generic citation text", async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: "row-3",
          url: "https://finnhub.io/api/news?id=ghi",
          origin_url: null,
          publisher: "FINNHUB",
          title: "Tesla, Target, Ross: Top analyst calls today",
          body: "Yahoo Finance Senior Reporter Brooke DiPalma outlines some of Wall Street's top analyst calls today. To watch more expert insights and analysis on the latest market action, check out more Market Domination.",
          source_type: "company_news",
        },
      ] as any);
      mockDb.run.mockResolvedValue({ changes: 1 });

      const updated = await backfillPublisher();
      expect(updated).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        "UPDATE news_items SET publisher = ? WHERE id = ?",
        ["YAHOO", "row-3"],
      );
    });
  });
});
