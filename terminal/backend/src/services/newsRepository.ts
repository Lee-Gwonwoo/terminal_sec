import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import type { NewsItem, NewsQuery } from "../types.js";
import { getIndustry } from "./industryLookup.js";

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function capLimitByRangeDays(rangeDays?: number): number {
  if (typeof rangeDays !== "number" || !Number.isFinite(rangeDays) || rangeDays <= 0) {
    return 500;
  }
  if (rangeDays <= 7) {
    return 500;
  }
  if (rangeDays <= 31) {
    return 500;
  }
  return 500;
}

function computeRangeDays(from?: string, to?: string): number | undefined {
  if (!from || !to) {
    return undefined;
  }
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return undefined;
  }
  const diffMs = Math.abs(toMs - fromMs);
  return Math.floor(diffMs / 86_400_000) + 1;
}

function decodeCursor(cursor?: string): { publishedAt: string; id: string } | undefined {
  if (!cursor) {
    return undefined;
  }

  const decoded = Buffer.from(cursor, "base64").toString("utf8");
  const [publishedAt, id] = decoded.split("|");
  if (!publishedAt || !id) {
    return undefined;
  }

  return { publishedAt, id };
}

function encodeCursor(item: Pick<NewsItem, "published_at" | "id">): string {
  return Buffer.from(`${item.published_at}|${item.id}`).toString("base64");
}

export async function getNews(query: NewsQuery): Promise<{ items: NewsItem[]; nextCursor?: string }> {
  const where: string[] = [];
  const values: unknown[] = [];
  let extraJoins = "";

  // Bookmark folder filter: join bookmark_items to restrict to bookmarked news
  if (query.bookmarkFolderId) {
    extraJoins += ` INNER JOIN bookmark_items bi ON bi.news_id = ni.id AND bi.folder_id = ?`;
    values.push(query.bookmarkFolderId);
  }

  if (query.keyword) {
    values.push(`%${query.keyword.toLowerCase()}%`);
    where.push(`LOWER(ni.title || ' ' || ni.body) LIKE ?`);
  }

  if (query.tickers?.length) {
    const tickerClauses = query.tickers.map(() => "ni.tickers_csv LIKE ?");
    for (const ticker of query.tickers) {
      values.push(`%,${ticker.toUpperCase()},%`);
    }
    where.push(`(${tickerClauses.join(" OR ")})`);
  }

  if (query.sources?.length) {
    const sourcePlaceholders = query.sources.map(() => "?").join(",");
    values.push(...query.sources);
    where.push(`ni.source_type IN (${sourcePlaceholders})`);
  }

  if (query.sourceNames?.length) {
    const sourcePlaceholders = query.sourceNames.map(() => "?").join(",");
    values.push(...query.sourceNames);
    where.push(`ni.source IN (${sourcePlaceholders})`);
  }

  if (query.tags?.length) {
    const tagClauses = query.tags.map(() => "ni.tags_csv LIKE ?");
    for (const tag of query.tags) {
      values.push(`%,${tag.toLowerCase()},%`);
    }
    where.push(`(${tagClauses.join(" OR ")})`);
  }

  if (query.from) {
    values.push(query.from);
    where.push(`ni.published_at >= ?`);
  }

  if (query.to) {
    values.push(query.to);
    where.push(`ni.published_at <= ?`);
  }

  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    values.push(cursor.publishedAt, cursor.publishedAt, cursor.id);
    where.push(`(ni.published_at < ? OR (ni.published_at = ? AND ni.id < ?))`);
  }

  const requestedLimit = typeof query.limit === "number" && Number.isFinite(query.limit) ? query.limit : 500;
  const rangeDays = computeRangeDays(query.from, query.to);
  const policyMax = capLimitByRangeDays(rangeDays);
  const limit = clampInt(Math.min(requestedLimit, policyMax), 1, 500);
  values.push(limit + 1);

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT ni.id, ni.published_at, ni.source, ni.publisher, ni.source_type, ni.title, ni.body, ni.url, ni.tickers_csv, ni.tags_csv, ni.created_at,
           cm_1d.ohlc_ticker,
           cm_1d.target_date AS ohlc_date,
           cm_1d.value_pct AS change_1d_pct,
           cm_open.value_pct AS change_from_open_pct,
           cm_7d.value_pct AS change_7d_pct,
           cm_14d.value_pct AS change_14d_pct,
           cm_30d.value_pct AS change_30d_pct,
           cm_1d.computed_at AS change_computed_at,
           CASE WHEN nf.extraction_status = 'success' THEN 1 ELSE 0 END AS has_full_text,
           nf.keywords_json, nf.keywords_status,
           naa.score AS ai_score,
           naa.score_evidence AS ai_score_evidence,
           naa.analysis_status AS ai_analysis_status,
           naa.keywords_json AS ai_keywords_json
    FROM news_items ni
    LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
    LEFT JOIN news_change_metrics cm_1d ON cm_1d.news_id = ni.id AND cm_1d.metric_key = 'change_1d_pct'
    LEFT JOIN news_change_metrics cm_open ON cm_open.news_id = ni.id AND cm_open.metric_key = 'change_from_open_pct'
    LEFT JOIN news_change_metrics cm_7d ON cm_7d.news_id = ni.id AND cm_7d.metric_key = 'change_7d_pct'
    LEFT JOIN news_change_metrics cm_14d ON cm_14d.news_id = ni.id AND cm_14d.metric_key = 'change_14d_pct'
    LEFT JOIN news_change_metrics cm_30d ON cm_30d.news_id = ni.id AND cm_30d.metric_key = 'change_30d_pct'
    LEFT JOIN news_ai_analysis naa ON naa.news_id = ni.id
    ${extraJoins}
    ${whereSql}
    ORDER BY ni.published_at DESC, ni.id DESC
    LIMIT ?
  `;

  const rows = await getDb().all<any[]>(sql, values);

  // Collect unique tickers from results for sentiment lookup
  const tickerSet = new Set<string>();
  for (const row of rows) {
    const tickers = splitCsvEnvelope(row.tickers_csv);
    if (tickers.length > 0) tickerSet.add(tickers[0]);
  }

  // Batch fetch sentiment snapshots for all tickers in this page
  const sentimentMap = new Map<string, { bullishPct: number | null; bearishPct: number | null; newsScore: number | null }>();
  if (tickerSet.size > 0) {
    const tickerArr = Array.from(tickerSet);
    const placeholders = tickerArr.map(() => "?").join(",");
    const sentRows = await getDb().all<any[]>(
      `SELECT ticker, sentiment_bullish_pct, sentiment_bearish_pct, company_news_score
       FROM news_sentiment_snapshots
       WHERE ticker IN (${placeholders})
       AND asof_date = (SELECT MAX(asof_date) FROM news_sentiment_snapshots s2 WHERE s2.ticker = news_sentiment_snapshots.ticker)`,
      tickerArr,
    );
    for (const sr of sentRows) {
      sentimentMap.set(sr.ticker, {
        bullishPct: sr.sentiment_bullish_pct,
        bearishPct: sr.sentiment_bearish_pct,
        newsScore: sr.company_news_score,
      });
    }
  }

  const mapped = rows.map((row) => mapNewsRow(row, sentimentMap));
  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : undefined;

  return { items, nextCursor };
}

export async function getNewsById(id: string): Promise<NewsItem | null> {
  const row = await getDb().get<any>(
    `SELECT ni.id, ni.published_at, ni.source, ni.publisher, ni.source_type, ni.title, ni.body, ni.url, ni.tickers_csv, ni.tags_csv, ni.created_at,
            cm_1d.ohlc_ticker,
            cm_1d.target_date AS ohlc_date,
            cm_1d.value_pct AS change_1d_pct,
            cm_open.value_pct AS change_from_open_pct,
            cm_7d.value_pct AS change_7d_pct,
            cm_14d.value_pct AS change_14d_pct,
            cm_30d.value_pct AS change_30d_pct,
            cm_1d.computed_at AS change_computed_at,
            CASE WHEN nf.extraction_status = 'success' THEN 1 ELSE 0 END AS has_full_text,
            nf.keywords_json, nf.keywords_status,
            naa.score AS ai_score,
            naa.score_evidence AS ai_score_evidence,
            naa.analysis_status AS ai_analysis_status,
            naa.keywords_json AS ai_keywords_json
     FROM news_items ni
     LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
     LEFT JOIN news_change_metrics cm_1d ON cm_1d.news_id = ni.id AND cm_1d.metric_key = 'change_1d_pct'
     LEFT JOIN news_change_metrics cm_open ON cm_open.news_id = ni.id AND cm_open.metric_key = 'change_from_open_pct'
     LEFT JOIN news_change_metrics cm_7d ON cm_7d.news_id = ni.id AND cm_7d.metric_key = 'change_7d_pct'
     LEFT JOIN news_change_metrics cm_14d ON cm_14d.news_id = ni.id AND cm_14d.metric_key = 'change_14d_pct'
     LEFT JOIN news_change_metrics cm_30d ON cm_30d.news_id = ni.id AND cm_30d.metric_key = 'change_30d_pct'
     LEFT JOIN news_ai_analysis naa ON naa.news_id = ni.id
     WHERE ni.id = ?`,
    [id]
  );
  if (!row) return null;

  // Fetch sentiment for this item's first ticker
  const tickers = splitCsvEnvelope(row.tickers_csv);
  const sentimentMap = new Map<string, { bullishPct: number | null; bearishPct: number | null; newsScore: number | null }>();
  if (tickers.length > 0) {
    const sentRow = await getDb().get<any>(
      `SELECT sentiment_bullish_pct, sentiment_bearish_pct, company_news_score
       FROM news_sentiment_snapshots
       WHERE ticker = ?
       ORDER BY asof_date DESC LIMIT 1`,
      [tickers[0]],
    );
    if (sentRow) {
      sentimentMap.set(tickers[0], {
        bullishPct: sentRow.sentiment_bullish_pct,
        bearishPct: sentRow.sentiment_bearish_pct,
        newsScore: sentRow.company_news_score,
      });
    }
  }

  return mapNewsRow(row, sentimentMap);
}

export async function insertNewsItem(params: {
  publishedAt: string;
  source: string;
  sourceType: string;
  title: string;
  body: string;
  url: string;
  tickers: string[];
  tags: string[];
}): Promise<NewsItem | null> {
  const id = randomUUID();
  const tickers = Array.from(new Set(params.tickers.map((ticker) => ticker.toUpperCase())));
  const tags = Array.from(new Set(params.tags.map((tag) => tag.toLowerCase())));
  const tickersCsv = `,${tickers.join(",")},`;
  const tagsCsv = `,${tags.join(",")},`;

  const result = await getDb().run(
    `INSERT OR IGNORE INTO news_items
      (id, published_at, source, source_type, title, body, url, tickers_csv, tags_csv)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.publishedAt,
      params.source,
      params.sourceType,
      params.title,
      params.body,
      params.url,
      tickersCsv,
      tagsCsv
    ]
  );

  if (!result.changes) {
    return null;
  }

  return {
    id,
    published_at: params.publishedAt,
    source: params.source,
    source_type: params.sourceType,
    title: params.title,
    body: params.body,
    url: params.url,
    tickers,
    tags,
    created_at: new Date().toISOString()
  };
}

function mapNewsRow(
  row: any,
  sentimentMap?: Map<string, { bullishPct: number | null; bearishPct: number | null; newsScore: number | null }>,
): NewsItem {
  const tickers = splitCsvEnvelope(row.tickers_csv);

  // AI analysis fields: use ai_keywords_json if analysis is completed, otherwise fall back to fulltext keywords
  const aiKeywords: string[] = row.ai_analysis_status === "completed" && row.ai_keywords_json
    ? JSON.parse(row.ai_keywords_json)
    : (row.keywords_json ? JSON.parse(row.keywords_json) : []);

  // Sentiment from pre-fetched map
  const primaryTicker = tickers.length > 0 ? tickers[0] : null;
  const sent = primaryTicker && sentimentMap ? sentimentMap.get(primaryTicker) : undefined;

  return {
    id: row.id,
    published_at: row.published_at,
    source: row.source,
    publisher: row.publisher ?? null,
    source_type: row.source_type,
    title: row.title,
    body: row.body,
    url: row.url,
    tickers,
    tags: splitCsvEnvelope(row.tags_csv),
    created_at: row.created_at,
    ohlc_ticker: row.ohlc_ticker ?? null,
    ohlc_date: row.ohlc_date ?? null,
    change_1d_pct: row.change_1d_pct ?? null,
    change_from_open_pct: row.change_from_open_pct ?? null,
    change_7d_pct: row.change_7d_pct ?? null,
    change_14d_pct: row.change_14d_pct ?? null,
    change_30d_pct: row.change_30d_pct ?? null,
    change_computed_at: row.change_computed_at ?? null,
    hasFullText: row.has_full_text === 1,
    keywords: aiKeywords,
    keywordsStatus: row.keywords_status ?? null,
    industry: (() => {
      for (const t of tickers) { const ind = getIndustry(t); if (ind) return ind; }
      return null;
    })(),
    // AI analysis
    score: row.ai_score ?? null,
    scoreEvidence: row.ai_score_evidence ?? null,
    analysisStatus: row.ai_analysis_status ?? null,
    // Sentiment
    sentimentBullishPct: sent?.bullishPct ?? null,
    sentimentBearishPct: sent?.bearishPct ?? null,
    companyNewsScore: sent?.newsScore ?? null,
  };
}

function splitCsvEnvelope(csv: string): string[] {
  return csv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
