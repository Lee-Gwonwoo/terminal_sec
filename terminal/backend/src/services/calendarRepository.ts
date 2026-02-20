import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";

export const CALENDAR_TYPE_CONFIG = [
  {
    key: "earnings",
    label: "Earnings",
    supports: ["time_of_day"],
    columns: [
      "ticker",
      "company_name",
      "report_date",
      "time_of_day",
      "eps_est",
      "eps_actual",
      "revenue_est",
      "revenue_actual",
      "surprise_pct"
    ]
  },
  {
    key: "dividends",
    label: "Dividends",
    supports: [],
    columns: ["ticker", "ex_date", "pay_date", "amount", "yield"]
  },
  {
    key: "splits",
    label: "Splits",
    supports: [],
    columns: ["ticker", "split_date", "ratio"]
  },
  {
    key: "analyst_ratings",
    label: "Analyst Ratings",
    supports: [],
    columns: ["ticker", "firm", "action", "rating", "price_target", "date"]
  },
  {
    key: "sec_filings",
    label: "SEC Filings",
    supports: [],
    columns: ["ticker", "form_type", "filed_at", "link"]
  },
  {
    key: "economics",
    label: "Economics",
    supports: ["region"],
    columns: ["country", "event_name", "scheduled_time", "actual", "forecast", "previous", "importance"]
  }
] as const;

const DEFAULT_SORT_BY = "event_time";
const DEFAULT_SORT_DIR = "desc";

type SortDirection = "asc" | "desc";

export type CalendarEventsQuery = {
  type: string;
  tickers?: string[];
  watchlistId?: string;
  from?: string;
  to?: string;
  timeOfDay?: "BMO" | "AMC" | "Unknown";
  region?: string;
  sortBy?: string;
  sortDir?: SortDirection;
  cursor?: string;
  limit?: number;
  userId: string;
};

type CalendarDbRow = {
  id: string;
  event_type: string;
  ticker: string | null;
  title: string;
  event_at: string;
  meta_json: string;
  source: string;
  unique_key: string;
  created_at: string;
};

export function getCalendarTypes() {
  return CALENDAR_TYPE_CONFIG;
}

export async function upsertCalendarEvent(params: {
  type: string;
  eventTime: string;
  ticker?: string;
  title: string;
  fieldsJson: Record<string, unknown>;
  source: string;
  uniqueKey: string;
}): Promise<void> {
  const tickerValue = params.ticker?.toUpperCase() ?? "";
  await getDb().run(
    `INSERT INTO calendar_events (id, event_type, ticker, title, event_at, meta_json, source, unique_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_type, unique_key) DO UPDATE SET
       ticker = excluded.ticker,
       title = excluded.title,
       event_at = excluded.event_at,
       meta_json = excluded.meta_json,
       source = excluded.source`,
    [
      randomUUID(),
      params.type,
      tickerValue,
      params.title,
      params.eventTime,
      JSON.stringify(params.fieldsJson),
      params.source,
      params.uniqueKey
    ]
  );
}

export async function listCalendarEvents(query: CalendarEventsQuery): Promise<{
  items: Array<Record<string, unknown>>;
  nextCursor?: string;
}> {
  const where: string[] = ["event_type = ?"];
  const values: unknown[] = [query.type];

  if (query.tickers?.length) {
    const placeholders = query.tickers.map(() => "?").join(",");
    where.push(`ticker IN (${placeholders})`);
    values.push(...query.tickers.map((ticker) => ticker.toUpperCase()));
  }

  if (query.watchlistId) {
    where.push(
      `ticker IN (SELECT ticker FROM watchlist_items wi JOIN watchlists w ON w.id = wi.watchlist_id WHERE wi.watchlist_id = ? AND w.user_id = ?)`
    );
    values.push(query.watchlistId, query.userId);
  }

  if (query.from) {
    where.push("event_at >= ?");
    values.push(query.from);
  }

  if (query.to) {
    where.push("event_at <= ?");
    values.push(query.to);
  }

  if (query.timeOfDay) {
    where.push("json_extract(meta_json, '$.time_of_day') = ?");
    values.push(query.timeOfDay);
  }

  if (query.region) {
    where.push("LOWER(json_extract(meta_json, '$.country')) = LOWER(?)");
    values.push(query.region);
  }

  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    where.push("(event_at < ? OR (event_at = ? AND id < ?))");
    values.push(cursor.eventTime, cursor.eventTime, cursor.id);
  }

  const sortBy = buildSortExpression(query.sortBy ?? DEFAULT_SORT_BY);
  const sortDir = query.sortDir === "asc" ? "ASC" : "DESC";
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
  values.push(limit + 1);

  const sql = `
    SELECT id, event_type, ticker, title, event_at, meta_json, source, unique_key, created_at
    FROM calendar_events
    WHERE ${where.join(" AND ")}
    ORDER BY ${sortBy} ${sortDir}, id ${sortDir}
    LIMIT ?
  `;

  const rows = await getDb().all<CalendarDbRow[]>(sql, values);
  const mapped = rows.map((row) => mapCalendarRow(row));
  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1] as any) : undefined;
  return { items, nextCursor };
}

export async function getCalendarEventById(id: string): Promise<Record<string, unknown> | null> {
  const row = await getDb().get<CalendarDbRow>(
    `SELECT id, event_type, ticker, title, event_at, meta_json, source, unique_key, created_at
     FROM calendar_events WHERE id = ?`,
    [id]
  );
  return row ? mapCalendarRow(row) : null;
}

export async function exportCalendarEventsCsv(query: CalendarEventsQuery): Promise<string> {
  const data = await listCalendarEvents({ ...query, limit: 5000 });
  const typeConfig = CALENDAR_TYPE_CONFIG.find((item) => item.key === query.type);
  const headers = ["id", "type", "event_time", "ticker", "title", ...(typeConfig?.columns ?? [])];
  const rows = data.items.map((item) =>
    headers
      .map((header) => {
        const raw = String(item[header] ?? "");
        const escaped = raw.replaceAll('"', '""');
        return `"${escaped}"`;
      })
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function mapCalendarRow(row: CalendarDbRow): Record<string, unknown> {
  const fieldsJson = JSON.parse(row.meta_json) as Record<string, unknown>;
  return {
    id: row.id,
    type: row.event_type,
    event_time: row.event_at,
    ticker: row.ticker,
    title: row.title,
    source: row.source,
    unique_key: row.unique_key,
    fields_json: fieldsJson,
    created_at: row.created_at,
    ...fieldsJson
  };
}

function buildSortExpression(sortBy: string): string {
  const nativeColumns: Record<string, string> = {
    id: "id",
    type: "event_type",
    ticker: "ticker",
    title: "title",
    event_time: "event_at"
  };

  if (nativeColumns[sortBy]) {
    return nativeColumns[sortBy];
  }

  if (!/^[a-zA-Z0-9_]+$/.test(sortBy)) {
    return "event_at";
  }

  return `json_extract(meta_json, '$.${sortBy}')`;
}

function decodeCursor(cursor?: string): { eventTime: string; id: string } | undefined {
  if (!cursor) {
    return undefined;
  }
  const decoded = Buffer.from(cursor, "base64").toString("utf8");
  const [eventTime, id] = decoded.split("|");
  if (!eventTime || !id) {
    return undefined;
  }
  return { eventTime, id };
}

function encodeCursor(item: { event_time: string; id: string }): string {
  return Buffer.from(`${item.event_time}|${item.id}`).toString("base64");
}
