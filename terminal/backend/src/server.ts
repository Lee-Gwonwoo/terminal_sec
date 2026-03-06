import express from "express";
import cors from "cors";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { initDb } from "./db.js";
import { getNews, getNewsById } from "./services/newsRepository.js";
import { createSavedView, deleteSavedView, listSavedViews } from "./services/savedViewRepository.js";
import { createWatchlist, deleteWatchlist, listWatchlists } from "./services/watchlistRepository.js";
import {
  exportCalendarEventsCsv,
  getCalendarEventById,
  getCalendarTypes,
  listCalendarEvents
} from "./services/calendarRepository.js";
import { listAlertRules, upsertAlertRule } from "./services/alertsRepository.js";
import { StreamHub } from "./realtime/streamHub.js";
import { ensureSeedData } from "./seed.js";
import { startCalendarIngestionWorkers } from "./services/calendarIngestion.js";
import { pullEodhdNews, pullEodhdNewsAll } from "./services/eodhdNewsProvider.js";
import { insertNewsItem } from "./services/newsRepository.js";
import { listUpdateStatuses, setLastSuccess } from "./services/updateStatusRepository.js";
import { readTickersFromCsv, appendTickerToCsv, CsvServiceError } from "./services/tickerCsvService.js";
import {
  fetchCompanyNewsRaw,
  fetchPressReleasesRaw,
  pullMarketNews,
  pullMarketNewsBackfill,
  pullCompanyNewsBackfill,
  pullPressReleasesBackfill,
  getTickersWithNews,
  getTickerAnchorMap,
} from "./services/finnhubNewsProvider.js";
import type { FinnhubMappedItem } from "./services/finnhubNewsProvider.js";
import { mergeChangeForNewItems } from "./services/newsChangeMerger.js";
import { createJob, getJob, updateProgress, appendLog, completeJob, failJob } from "./services/jobManager.js";
import { getFulltext, getUnextractedNewsIds } from "./services/fulltextRepository.js";
import { runFulltextUpdate } from "./services/fulltextUpdateService.js";
import { backfillPublisher } from "./services/finnhubNewsProvider.js";
import type { NewsQuery } from "./types.js";

const app = express();
const streamHub = new StreamHub();

app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json({ limit: "1mb" }));

const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";

function parseList(input: unknown): string[] | undefined {
  if (typeof input !== "string" || input.trim() === "") {
    return undefined;
  }
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseNewsQuery(query: Record<string, unknown>): NewsQuery {
  const parsedLimit = typeof query.limit === "string" ? Number(query.limit) : undefined;
  const limit = Number.isFinite(parsedLimit as number) ? (parsedLimit as number) : undefined;

  // Support both `sources` (original) and `source_type` (Step 4-5 alias)
  const sourcesRaw = parseList(query.sources) ?? parseList(query.source_type);

  return {
    keyword: typeof query.keyword === "string" ? query.keyword : undefined,
    tickers: parseList(query.tickers),
    sources: sourcesRaw,
    sourceNames: parseList(query.source_names),
    tags: parseList(query.tags),
    from: typeof query.from === "string" ? query.from : undefined,
    to: typeof query.to === "string" ? query.to : undefined,
    limit,
    cursor: typeof query.cursor === "string" ? query.cursor : undefined
  };
}

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", (_req, res) => {
  res.json({
    realtime: "sse",
    pollingFallbackSeconds: 10,
    demoUserId: DEMO_USER_ID
  });
});

app.get("/api/updates/status", async (_req, res, next) => {
  try {
    const sources = await listUpdateStatuses();
    res.json({ sources });
  } catch (error) {
    next(error);
  }
});

// ── Ticker CSV endpoints ───────────────────────────────────
app.get("/api/tickers", (req, res, next) => {
  try {
    const csvPath = typeof req.query.csvPath === "string" ? req.query.csvPath : "";
    if (!csvPath) {
      res.status(400).json({ error: "csvPath query parameter is required" });
      return;
    }
    const result = readTickersFromCsv(csvPath);
    res.json({ csvPath, tickers: result.tickers });
  } catch (error) {
    if (error instanceof CsvServiceError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.post("/api/tickers/add", async (req, res, next) => {
  try {
    const { csvPath, ticker } = req.body ?? {};
    if (typeof csvPath !== "string" || !csvPath) {
      res.status(400).json({ error: "csvPath is required" });
      return;
    }
    if (typeof ticker !== "string" || !ticker.trim()) {
      res.status(400).json({ error: "ticker is required" });
      return;
    }
    const result = await appendTickerToCsv(csvPath, ticker);
    await setLastSuccess("tickers_csv", new Date().toISOString(), {
      csvPath,
      tickerAdded: result.tickerAdded,
      count: result.tickers.length
    });
    res.json({ csvPath, tickerAdded: result.tickerAdded, tickers: result.tickers });
  } catch (error) {
    if (error instanceof CsvServiceError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

// ── Finnhub News Pull ───────────────────────────────────
const DEFAULT_TICKERS_CSV = "tradigview_screener/original_data/watch lists2_2026-02-22.csv";

const pullFinnhubSchema = z.object({
  csvPath: z.string().optional().default(DEFAULT_TICKERS_CSV),
  /** 0 or omitted = all tickers in CSV (no cap) */
  maxTickers: z.number().int().min(0).optional().default(0),
  mode: z.enum(["7d", "recent", "custom"]).optional().default("7d"),
  /** Which data types to pull. "market_news" = Finnhub /news general market headlines */
  sourceType: z.enum(["all", "company_news", "press_release", "market_news"]).optional().default("all"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Helper: insert fetched items into DB, track counts, push SSE */
async function insertFetchedItems(
  items: FinnhubMappedItem[],
  detailBucket: { fetched: number; inserted: number },
  newItems: Array<{ id: string; tickers: string[]; publishedAt: string }>,
  counters: { totalInserted: number; totalSkipped: number },
) {
  detailBucket.fetched += items.length;
  for (const rawItem of items) {
    const inserted = await insertNewsItem({
      publishedAt: rawItem.publishedAt,
      source: rawItem.source,
      sourceType: rawItem.sourceType,
      title: rawItem.title,
      body: rawItem.body,
      url: rawItem.url,
      tickers: rawItem.providerTickers,
      tags: rawItem.tags,
    });
    if (inserted) {
      counters.totalInserted++;
      detailBucket.inserted++;
      newItems.push({
        id: inserted.id,
        tickers: inserted.tickers,
        publishedAt: inserted.published_at,
      });
      streamHub.publishNews(inserted);
    } else {
      counters.totalSkipped++;
    }
  }
}

// ── Preflight check for Recent Update ──
app.get("/api/news/pull-finhub/preflight", async (req, res, next) => {
  try {
    const sourceType = (req.query.sourceType as string) || "all";
    if (sourceType === "market_news") {
      res.json({ totalTickers: 0, fallbackCount: 0, fallbackTickers: [] });
      return;
    }
    const csvPath = (req.query.csvPath as string) || DEFAULT_TICKERS_CSV;

    let tickerList: string[];
    try {
      const csvResult = readTickersFromCsv(csvPath);
      tickerList = csvResult.tickers;
    } catch {
      tickerList = ["AAPL", "MSFT", "TSLA", "NVDA", "AMD"];
    }

    const tickersWithNews = await getTickersWithNews(
      sourceType === "all" ? undefined : sourceType,
    );

    const fallbackTickers = tickerList.filter(
      (t) => !tickersWithNews.has(t.toUpperCase()),
    );

    res.json({
      totalTickers: tickerList.length,
      fallbackCount: fallbackTickers.length,
      fallbackTickers: fallbackTickers.slice(0, 50),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/pull-finhub", async (req, res, next) => {
  try {
    const input = pullFinnhubSchema.parse(req.body ?? {});
    const isCustom = input.mode === "custom";
    const is7d = input.mode === "7d";
    const isRecent = input.mode === "recent";
    const pullCompany = input.sourceType === "all" || input.sourceType === "company_news";
    const pullPress = input.sourceType === "all" || input.sourceType === "press_release";
    const pullMarket = input.sourceType === "all" || input.sourceType === "market_news";

    // Compute effective date range
    let effectiveFrom = input.from;
    let effectiveTo = input.to ?? new Date().toISOString().slice(0, 10);

    if (is7d) {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      effectiveFrom = d.toISOString().slice(0, 10);
      effectiveTo = new Date().toISOString().slice(0, 10);
    }

    if (isCustom && !input.from) {
      res.status(400).json({ error: "Custom mode requires 'from' date" });
      return;
    }

    // Load tickers from CSV
    let tickerList: string[];
    try {
      const csvResult = readTickersFromCsv(input.csvPath);
      tickerList = input.maxTickers > 0
        ? csvResult.tickers.slice(0, input.maxTickers)
        : csvResult.tickers;
    } catch {
      tickerList = ["AAPL", "MSFT", "TSLA", "NVDA", "AMD"];
    }
    if (!pullCompany && !pullPress) {
      tickerList = [];
    }
    console.log(`[pull-finhub] mode=${input.mode} sourceType=${input.sourceType} maxTickers=${input.maxTickers} → tickerList.length=${tickerList.length}`);

    // For recent mode, load per-ticker anchor maps
    let companyAnchorMap: Map<string, string> | undefined;
    let pressAnchorMap: Map<string, string> | undefined;
    if (isRecent) {
      if (pullCompany) companyAnchorMap = await getTickerAnchorMap("company_news");
      if (pullPress) pressAnchorMap = await getTickerAnchorMap("press_release");
    }

    // ── Create background job and return immediately ──
    const jobId = createJob(Math.max(tickerList.length + (pullMarket ? 1 : 0), 1));
    appendLog(jobId, `Starting ${input.mode}/${input.sourceType} pull for ${tickerList.length} tickers`);

    if (isRecent) {
      const fallbackCount = tickerList.filter((t) => {
        const upper = t.toUpperCase();
        return !(companyAnchorMap?.has(upper) || pressAnchorMap?.has(upper));
      }).length;
      if (fallbackCount > 0) {
        appendLog(jobId, `${fallbackCount} tickers have no prior data → 7d fallback`);
      }
    }

    res.json({ jobId });

    // ── Background job execution (fire-and-forget) ──
    const fallback7d = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

    (async () => {
      const counters = { totalInserted: 0, totalSkipped: 0 };
      const newItems: Array<{ id: string; tickers: string[]; publishedAt: string }> = [];
      const detailsPerType: Record<string, { fetched: number; inserted: number }> = {
        company_news: { fetched: 0, inserted: 0 },
        press_release: { fetched: 0, inserted: 0 },
        market_news: { fetched: 0, inserted: 0 },
      };

      try {
        for (let i = 0; i < tickerList.length; i++) {
          const ticker = tickerList[i];
          appendLog(jobId, `[${i + 1}/${tickerList.length}] Processing ${ticker}...`);

          // Company news
          if (pullCompany) {
            try {
              let items: FinnhubMappedItem[];
              if (isCustom) {
                items = await pullCompanyNewsBackfill(ticker, effectiveFrom!, effectiveTo);
              } else {
                let tickerFrom = effectiveFrom!;
                if (isRecent) {
                  const anchor = companyAnchorMap?.get(ticker.toUpperCase());
                  tickerFrom = anchor ? anchor.slice(0, 10) : fallback7d;
                }
                items = await fetchCompanyNewsRaw(ticker, tickerFrom, effectiveTo);
              }
              await insertFetchedItems(items, detailsPerType.company_news, newItems, counters);
              if (items.length > 0) {
                appendLog(jobId, `  company_news: ${items.length} fetched, ${detailsPerType.company_news.inserted} inserted so far`);
              }
            } catch (err: any) {
              console.error(`[pull-finhub] company_news ${ticker}: ${err.message}`);
              appendLog(jobId, `  ⚠ company_news ${ticker}: ${err.message}`);
            }
          }

          // Press releases
          if (pullPress) {
            try {
              let items: FinnhubMappedItem[];
              if (isCustom) {
                items = await pullPressReleasesBackfill(ticker, effectiveFrom!, effectiveTo);
              } else {
                let tickerFrom = effectiveFrom!;
                if (isRecent) {
                  const anchor = pressAnchorMap?.get(ticker.toUpperCase());
                  tickerFrom = anchor ? anchor.slice(0, 10) : fallback7d;
                }
                items = await fetchPressReleasesRaw(ticker, tickerFrom, effectiveTo);
              }
              await insertFetchedItems(items, detailsPerType.press_release, newItems, counters);
              if (items.length > 0) {
                appendLog(jobId, `  press_release: ${items.length} fetched, ${detailsPerType.press_release.inserted} inserted so far`);
              }
            } catch (err: any) {
              console.error(`[pull-finhub] press_release ${ticker}: ${err.message}`);
              appendLog(jobId, `  ⚠ press_release ${ticker}: ${err.message}`);
            }
          }

          // Update progress
          updateProgress(jobId, i + 1);

          // Small delay between tickers to respect rate limits
          await new Promise((r) => setTimeout(r, 250));
        }

        if (pullMarket) {
          appendLog(jobId, `[market] Processing market news...`);
          try {
            const marketItems = isRecent
              ? await pullMarketNews()
              : await pullMarketNewsBackfill(effectiveFrom!, effectiveTo);
            await insertFetchedItems(marketItems, detailsPerType.market_news, newItems, counters);
            appendLog(jobId, `  market_news: ${marketItems.length} fetched, ${detailsPerType.market_news.inserted} inserted so far`);
          } catch (err: any) {
            console.error(`[pull-finhub] market_news: ${err.message}`);
            appendLog(jobId, `  ⚠ market_news: ${err.message}`);
          }
          updateProgress(jobId, tickerList.length + 1);
        }

        // Merge change% for newly inserted items
        let changeMergeResult = { merged: 0, skipped: 0 };
        if (newItems.length > 0) {
          appendLog(jobId, `Merging change% for ${newItems.length} new items...`);
          try {
            changeMergeResult = await mergeChangeForNewItems(newItems);
            appendLog(jobId, `Change merge: ${changeMergeResult.merged} merged, ${changeMergeResult.skipped} skipped`);
          } catch (err: any) {
            console.error(`[pull-finhub] change merger error: ${err.message}`);
            appendLog(jobId, `⚠ Change merge error: ${err.message}`);
          }
        }

        // Update status
        await setLastSuccess("finhub_news", new Date().toISOString(), {
          mode: input.mode,
          sourceType: input.sourceType,
          tickerCount: tickerList.length,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          changeMerged: changeMergeResult.merged,
        });

        completeJob(jobId, {
          source: "FINNHUB",
          mode: input.mode,
          sourceType: input.sourceType,
          tickerCount: tickerList.length,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          changeMerged: changeMergeResult.merged,
          details: detailsPerType,
        });
      } catch (err: any) {
        console.error(`[pull-finhub] job ${jobId} fatal error: ${err.message}`);
        failJob(jobId, err.message || "Unknown error");
      }
    })();
  } catch (error) {
    next(error);
  }
});

// ── Job status polling endpoint ──
app.get("/api/jobs/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    logs: job.logs,
    error: job.error,
    result: job.result,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

// ── Full Text Extraction endpoints (Step 10) ──

app.post("/api/news/fulltext/update", async (req, res, next) => {
  try {
    const sourceType: string | undefined = req.body?.sourceType; // 'all' | 'company_news' | 'press_release'

    // backfill publisher for any rows missing it
    await backfillPublisher();

    const unextracted = await getUnextractedNewsIds(sourceType);
    const total = unextracted.length;
    const jobId = createJob(total);

    // Fire-and-forget background job
    runFulltextUpdate(jobId, sourceType).catch((err) => {
      console.error("[fulltext-update] unhandled:", err);
    });

    res.json({ jobId, total });
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/fulltext/:newsId", async (req, res, next) => {
  try {
    const row = await getFulltext(req.params.newsId);
    if (!row) {
      res.status(404).json({ error: "Full text not found" });
      return;
    }
    res.json({
      newsId: row.news_id,
      fullText: row.full_text,
      extractionStatus: row.extraction_status,
      extractionNote: row.extraction_note,
      wordCount: row.word_count,
      extractedAt: row.extracted_at,
      keywords: JSON.parse(row.keywords_json || "[]"),
      keywordsStatus: row.keywords_status,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/news", async (req, res, next) => {
  try {
    const parsedQuery = parseNewsQuery(req.query as Record<string, unknown>);
    const result = await getNews(parsedQuery);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/:id", async (req, res, next) => {
  try {
    const item = await getNewsById(req.params.id);
    if (!item) {
      res.status(404).json({ error: "News item not found" });
      return;
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const pullEodhdSchema = z
  .object({
    date: isoDateSchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    symbol: z.string().optional().default("QQQ.US"),
    limit: z.number().int().min(1).max(200).optional().default(200),
    offset: z.number().int().min(0).optional().default(0),
    fetch_all: z.boolean().optional().default(false)
  })
  .refine(
    (value) => {
      const hasDate = typeof value.date === "string";
      const hasRange = typeof value.from === "string" && typeof value.to === "string";
      return hasDate !== hasRange; // exactly one mode
    },
    { message: "Provide either {date} or {from,to} (but not both)." }
  );

// One-shot import endpoint used for demos/backfills.
// Reads token from repo-root EODHD/API TOKEN and inserts items into SQLite with DB-level dedupe.
app.post("/api/news/pull-eodhd", async (req, res, next) => {
  try {
    const input = pullEodhdSchema.parse(req.body);

    const from = input.date ?? input.from!;
    const to = input.date ?? input.to!;

    const offset = input.offset;
    const providerResult = input.fetch_all
      ? await pullEodhdNewsAll({ symbol: input.symbol, from, to, pageSize: input.limit })
      : {
          items: await pullEodhdNews({ symbol: input.symbol, from, to, limit: input.limit, offset }),
          truncated: false
        };

    const providerItems = providerResult.items;

    let insertedCount = 0;
    for (const rawItem of providerItems) {
      const inserted = await insertNewsItem({
        publishedAt: rawItem.publishedAt,
        source: rawItem.source,
        sourceType: rawItem.sourceType,
        title: rawItem.title,
        body: rawItem.body,
        url: rawItem.url,
        tickers: rawItem.providerTickers,
        tags: rawItem.tags
      });
      if (inserted) {
        insertedCount += 1;
        streamHub.publishNews(inserted);
      }
    }

    const done = !input.fetch_all && providerItems.length < input.limit;
    const nextOffset = input.fetch_all ? undefined : done ? undefined : offset + providerItems.length;

    res.json({
      symbol: input.symbol,
      from,
      to,
      offset: input.fetch_all ? undefined : offset,
      nextOffset,
      done: input.fetch_all ? undefined : done,
      fetched: providerItems.length,
      inserted: insertedCount,
      truncated: providerResult.truncated
    });
  } catch (error) {
    next(error);
  }
});

const savedViewSchema = z.object({
  name: z.string().min(1),
  queryJson: z.record(z.any()),
  enableAlerts: z.boolean().default(false)
});

app.post("/api/news/saved-views", async (req, res, next) => {
  try {
    const input = savedViewSchema.parse(req.body);
    const row = await createSavedView(DEMO_USER_ID, input.name, input.queryJson, input.enableAlerts);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/saved-views", async (_req, res, next) => {
  try {
    const rows = await listSavedViews(DEMO_USER_ID);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/news/saved-views/:id", async (req, res, next) => {
  try {
    const deleted = await deleteSavedView(DEMO_USER_ID, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Saved view not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const watchlistSchema = z.object({
  name: z.string().min(1),
  tickers: z.array(z.string()).default([]),
  enableAlerts: z.boolean().default(false)
});

app.get("/api/watchlists", async (_req, res, next) => {
  try {
    const rows = await listWatchlists(DEMO_USER_ID);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/watchlists", async (req, res, next) => {
  try {
    const input = watchlistSchema.parse(req.body);
    const row = await createWatchlist(DEMO_USER_ID, input.name, input.tickers, input.enableAlerts);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/watchlists/:id", async (req, res, next) => {
  try {
    const deleted = await deleteWatchlist(DEMO_USER_ID, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Watchlist not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/types", (_req, res) => {
  res.json(getCalendarTypes());
});

app.get("/api/calendar/events", async (req, res, next) => {
  try {
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "event_time:desc";
    const [sortByRaw, sortDirRaw] = sortRaw.split(":");
    const result = await listCalendarEvents({
      type: typeof req.query.type === "string" ? req.query.type : "earnings",
      tickers: parseList(req.query.tickers),
      watchlistId: typeof req.query.watchlist_id === "string" ? req.query.watchlist_id : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      timeOfDay:
        req.query.time_of_day === "BMO" || req.query.time_of_day === "AMC" || req.query.time_of_day === "Unknown"
          ? req.query.time_of_day
          : undefined,
      region: typeof req.query.region === "string" ? req.query.region : undefined,
      sortBy: sortByRaw,
      sortDir: sortDirRaw === "asc" || sortDirRaw === "desc" ? sortDirRaw : "desc",
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      userId: DEMO_USER_ID
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/events/export.csv", async (req, res, next) => {
  try {
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "event_time:desc";
    const [sortByRaw, sortDirRaw] = sortRaw.split(":");
    const csv = await exportCalendarEventsCsv({
      type: typeof req.query.type === "string" ? req.query.type : "earnings",
      tickers: parseList(req.query.tickers),
      watchlistId: typeof req.query.watchlist_id === "string" ? req.query.watchlist_id : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      timeOfDay:
        req.query.time_of_day === "BMO" || req.query.time_of_day === "AMC" || req.query.time_of_day === "Unknown"
          ? req.query.time_of_day
          : undefined,
      region: typeof req.query.region === "string" ? req.query.region : undefined,
      sortBy: sortByRaw,
      sortDir: sortDirRaw === "asc" || sortDirRaw === "desc" ? sortDirRaw : "desc",
      userId: DEMO_USER_ID
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="calendar_${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/events/:id", async (req, res, next) => {
  try {
    const event = await getCalendarEventById(req.params.id);
    if (!event) {
      res.status(404).json({ error: "Calendar event not found" });
      return;
    }
    res.json(event);
  } catch (error) {
    next(error);
  }
});

const alertRuleSchema = z.object({
  id: z.string().uuid().optional(),
  tool: z.enum(["news", "watchlists", "calendar"]),
  name: z.string().min(1),
  enabled: z.boolean(),
  methods: z.array(z.enum(["browser", "sound", "email"])),
  ruleJson: z.record(z.any())
});

app.get("/api/settings/alerts", async (_req, res, next) => {
  try {
    const rows = await listAlertRules(DEMO_USER_ID);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings/alerts", async (req, res, next) => {
  try {
    const input = alertRuleSchema.parse(req.body);
    const row = await upsertAlertRule({
      id: input.id,
      userId: DEMO_USER_ID,
      tool: input.tool,
      name: input.name,
      enabled: input.enabled,
      methods: input.methods,
      ruleJson: input.ruleJson
    });
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/stream", (req, res) => {
  const filters = parseNewsQuery(req.query as Record<string, unknown>);
  const clientId = randomUUID();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write("event: connected\ndata: {}\n\n");

  streamHub.addClient({
    id: clientId,
    response: res,
    filters
  });

  req.on("close", () => {
    streamHub.removeClient(clientId);
  });
});

setInterval(() => {
  streamHub.heartbeat();
}, 20000);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  res.status(400).json({ error: message });
});

async function start(): Promise<void> {
  await initDb();
  await ensureSeedData();
  startCalendarIngestionWorkers();

  app.listen(config.port, () => {
    console.log(`Backend listening on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
