import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import type { NewsItem, NewsQuery } from "../types.js";

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function capLimitByRangeDays(rangeDays?: number): number {
  if (typeof rangeDays !== "number" || !Number.isFinite(rangeDays) || rangeDays <= 0) {
    return 200;
  }
  if (rangeDays <= 7) {
    return 200;
  }
  if (rangeDays <= 31) {
    return 100;
  }
  return 50;
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

  if (query.keyword) {
    values.push(`%${query.keyword.toLowerCase()}%`);
    where.push(`LOWER(title || ' ' || body) LIKE ?`);
  }

  if (query.tickers?.length) {
    const tickerClauses = query.tickers.map(() => "tickers_csv LIKE ?");
    for (const ticker of query.tickers) {
      values.push(`%,${ticker.toUpperCase()},%`);
    }
    where.push(`(${tickerClauses.join(" OR ")})`);
  }

  if (query.sources?.length) {
    const sourcePlaceholders = query.sources.map(() => "?").join(",");
    values.push(...query.sources);
    where.push(`source_type IN (${sourcePlaceholders})`);
  }

  if (query.sourceNames?.length) {
    const sourcePlaceholders = query.sourceNames.map(() => "?").join(",");
    values.push(...query.sourceNames);
    where.push(`source IN (${sourcePlaceholders})`);
  }

  if (query.tags?.length) {
    const tagClauses = query.tags.map(() => "tags_csv LIKE ?");
    for (const tag of query.tags) {
      values.push(`%,${tag.toLowerCase()},%`);
    }
    where.push(`(${tagClauses.join(" OR ")})`);
  }

  if (query.from) {
    values.push(query.from);
    where.push(`published_at >= ?`);
  }

  if (query.to) {
    values.push(query.to);
    where.push(`published_at <= ?`);
  }

  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    values.push(cursor.publishedAt, cursor.publishedAt, cursor.id);
    where.push(`(published_at < ? OR (published_at = ? AND id < ?))`);
  }

  const requestedLimit = typeof query.limit === "number" && Number.isFinite(query.limit) ? query.limit : 200;
  const rangeDays = computeRangeDays(query.from, query.to);
  const policyMax = capLimitByRangeDays(rangeDays);
  const limit = clampInt(Math.min(requestedLimit, policyMax), 1, 200);
  values.push(limit + 1);

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT id, published_at, source, source_type, title, body, url, tickers_csv, tags_csv, created_at,
           ohlc_ticker, ohlc_date, change_1d_pct, change_from_open_pct,
           change_7d_pct, change_14d_pct, change_30d_pct, change_computed_at
    FROM news_items
    ${whereSql}
    ORDER BY published_at DESC, id DESC
    LIMIT ?
  `;

  const rows = await getDb().all<any[]>(sql, values);
  const mapped = rows.map((row) => mapNewsRow(row));
  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : undefined;

  return { items, nextCursor };
}

export async function getNewsById(id: string): Promise<NewsItem | null> {
  const row = await getDb().get<any>(
    `SELECT id, published_at, source, source_type, title, body, url, tickers_csv, tags_csv, created_at,
            ohlc_ticker, ohlc_date, change_1d_pct, change_from_open_pct,
            change_7d_pct, change_14d_pct, change_30d_pct, change_computed_at
     FROM news_items
     WHERE id = ?`,
    [id]
  );
  return row ? mapNewsRow(row) : null;
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

function mapNewsRow(row: any): NewsItem {
  return {
    id: row.id,
    published_at: row.published_at,
    source: row.source,
    source_type: row.source_type,
    title: row.title,
    body: row.body,
    url: row.url,
    tickers: splitCsvEnvelope(row.tickers_csv),
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
  };
}

function splitCsvEnvelope(csv: string): string[] {
  return csv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
