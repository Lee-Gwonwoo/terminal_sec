import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import type { NewsItem, NewsQuery } from "../types.js";

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

  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  values.push(limit + 1);

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT id, published_at, source, source_type, title, body, url, tickers_csv, tags_csv, created_at
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
    `SELECT id, published_at, source, source_type, title, body, url, tickers_csv, tags_csv, created_at
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
    created_at: row.created_at
  };
}

function splitCsvEnvelope(csv: string): string[] {
  return csv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
