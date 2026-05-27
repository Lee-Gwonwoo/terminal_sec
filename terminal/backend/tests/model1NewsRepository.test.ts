import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb } from "./setupTestDb.js";

let getDb: typeof import("../src/db.js").getDb;
let getModel1News: typeof import("../src/services/newsRepository.js").getModel1News;
let getModel1NewsById: typeof import("../src/services/newsRepository.js").getModel1NewsById;

beforeAll(async () => {
  await setupTestDb();
  const dbMod = await import("../src/db.js");
  getDb = dbMod.getDb;
  const repo = await import("../src/services/newsRepository.js");
  getModel1News = repo.getModel1News;
  getModel1NewsById = repo.getModel1NewsById;

  const db = getDb();
  await db.run(
    `INSERT INTO news_items
       (id, published_at, source, source_type, title, body, url, tickers_csv, tags_csv, publisher, origin_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "model1-news-001",
      "2026-03-11T14:30:00.000Z",
      "FINNHUB",
      "company_news",
      "Headline",
      "Body",
      "https://example.com/news/1",
      ",AAPL,",
      ",earnings,",
      "Example Publisher",
      "https://origin.example.com/news/1",
    ],
  );

  await db.run(
    `INSERT INTO news_items
       (id, published_at, source, source_type, title, body, url, tickers_csv, tags_csv, publisher, origin_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "model1-news-003",
      "2026-03-11T15:30:30.000Z",
      "FINNHUB",
      "company_news",
      "Minute boundary row",
      "Boundary body",
      "https://example.com/news/3",
      ",MSFT,",
      ",boundary,",
      "Example Publisher",
      "https://origin.example.com/news/3",
    ],
  );

  await db.run(
    `INSERT INTO news_items
       (id, published_at, source, source_type, title, body, url, tickers_csv, tags_csv, publisher, origin_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "model1-news-002",
      "2026-03-11 15:15:00",
      "INVESTING",
      "investing_stock_market_news",
      "Analyst note",
      "Teaser only",
      "https://example.com/news/2",
      ",,",
      ",analyst,",
      "Investing.com",
      "https://origin.example.com/news/2",
    ],
  );

  await db.run(
    `INSERT INTO news_fulltext
       (news_id, full_text, extraction_status, extracted_at, keywords_json, keywords_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      "model1-news-001",
      "Full text",
      "success",
      "2026-03-11T15:00:00.000Z",
      JSON.stringify(["alpha", "beta"]),
      "completed",
    ],
  );

  await db.run(
    `INSERT INTO news_fulltext
       (news_id, full_text, extraction_status, extracted_at, keywords_json, keywords_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      "model1-news-002",
      "Full text says fixed volume and partially fixed pricing for Micron. In this article: MU",
      "success",
      "2026-03-11T15:20:00.000Z",
      JSON.stringify(["fixed volume"]),
      "completed",
    ],
  );

  await db.run(
    `INSERT INTO news_ai_analysis
       (news_id, score, score_evidence, keywords_json, analysis_status, analyzed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      "model1-news-001",
      0.75,
      "Evidence",
      JSON.stringify(["alpha", "beta"]),
      "completed",
      "2026-03-11T15:05:00.000Z",
    ],
  );

  await db.run(
    `INSERT INTO news_change_metrics
       (news_id, metric_key, value_pct, ohlc_ticker, reference_date, target_date, forward_trading_days, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "model1-news-001",
      "change_pct",
      12.5,
      "AAPL",
      "2026-03-10",
      "2026-03-11",
      0,
      "2026-03-12T00:00:00.000Z",
    ],
  );
});

afterAll(teardownTestDb);

describe("model1 news repository", () => {
  it("returns current-news rows without change fields", async () => {
    const result = await getModel1News({ tickers: ["AAPL"], limit: 10 });
    expect(result.items).toHaveLength(1);

    const item = result.items[0] as Record<string, unknown>;
    expect(item.id).toBe("model1-news-001");
    expect(item.hasFullText).toBe(true);
    expect(item.fullText).toBe("Full text");
    expect(item.keywords).toEqual(["alpha", "beta"]);
    expect("change_pct" in item).toBe(false);
    expect("change_1d_pct" in item).toBe(false);
    expect("ohlc_ticker" in item).toBe(false);
  });

  it("returns detail rows without change fields", async () => {
    const item = await getModel1NewsById("model1-news-001");
    expect(item).not.toBeNull();
    const plain = item as Record<string, unknown>;
    expect(plain.title).toBe("Headline");
    expect(plain.fullText).toBe("Full text");
    expect("change_pct" in plain).toBe(false);
    expect("change_computed_at" in plain).toBe(false);
  });

  it("searches full text for Model_1 keyword filters", async () => {
    const result = await getModel1News({ keyword: "fixed volume", limit: 10 });
    expect(result.items.map((item) => item.id)).toEqual(["model1-news-002"]);
    expect(result.items[0].fullText).toContain("fixed volume");
  });

  it("normalizes T and space published_at values for Model_1 ranges", async () => {
    const result = await getModel1News({ from: "2026-03-11 14:00", to: "2026-03-11 15:30", limit: 10 });
    expect(result.items.map((item) => item.id)).toEqual(["model1-news-003", "model1-news-002", "model1-news-001"]);
  });
});