import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import { getIpoSecEnrichmentMap, type IpoSecEnrichmentRow } from "./ipoSecEnrichmentRepository.js";

export const CALENDAR_TYPE_CONFIG = [
  {
    key: "earnings",
    label: "Earnings",
    supports: ["time_of_day"],
    columns: [
      "ticker",
      "name",
      "company_name",
      "industry",
      "report_date",
      "time_of_day",
      "session",
      "confirmed",
      "eps_est",
      "eps_actual",
      "revenue_est",
      "revenue_actual",
      "surprise_pct",
      "market_cap",
      "float_pct",
      "institutional_pct",
      "insider_pct"
    ]
  },
  {
    key: "ipos",
    label: "IPOs",
    supports: [],
    columns: [
      "ipo_date",
      "ticker",
      "company_name",
      "exchange",
      "industry",
      "status",
      "price_range",
      "shares",
      "offer_amount",
      "company_description",
      "sec_form",
      "sec_filing_date",
      "sec_accepted_date",
      "sec_owner_count",
      "sec_max_owner_pct",
      "sec_total_owner_pct",
      "sec_sic_code",
      "sec_sic_description",
      "sec_industry",
      "prospectus_url",
      "disclosure_url"
    ]
  },
  {
    key: "dividends",
    label: "Dividends",
    supports: [],
    columns: ["ticker", "name", "industry", "ex_date", "pay_date", "amount", "yield", "market_cap"]
  },
  {
    key: "splits",
    label: "Splits",
    supports: [],
    columns: ["ticker", "name", "industry", "split_date", "ratio", "market_cap"]
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

type CalendarTickerMetadataRow = {
  ticker: string;
  exchange: string | null;
  name: string | null;
  description: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  float_pct: number | null;
  institutional_pct: number | null;
  insider_pct: number | null;
  market_cap_source: string | null;
  float_source: string | null;
  institutional_source: string | null;
  insider_source: string | null;
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

/** Step 6-5: mock_provider rows를 삭제하고 삭제된 row 수를 반환. */
export async function deleteMockCalendarRows(): Promise<number> {
  const result = await getDb().run(
    `DELETE FROM calendar_events WHERE source = 'mock_provider'`
  );
  return result.changes ?? 0;
}

export async function deleteCalendarEventsForSourceRange(params: {
  type: string;
  source: string;
  fromEventTime: string;
  toEventTime: string;
  tickers?: string[];
}): Promise<number> {
  const db = getDb();
  const normalizedTickers = Array.from(new Set(
    (params.tickers ?? [])
      .map((ticker) => ticker.trim().toUpperCase())
      .filter(Boolean),
  ));

  if (normalizedTickers.length === 0) {
    const result = await db.run(
      `DELETE FROM calendar_events
       WHERE event_type = ?
         AND source = ?
         AND event_at >= ?
         AND event_at <= ?`,
      [params.type, params.source, params.fromEventTime, params.toEventTime],
    );
    return result.changes ?? 0;
  }

  let deletedRows = 0;
  const batchSize = 400;
  for (let index = 0; index < normalizedTickers.length; index += batchSize) {
    const batch = normalizedTickers.slice(index, index + batchSize);
    const placeholders = batch.map(() => "?").join(",");
    const result = await db.run(
      `DELETE FROM calendar_events
       WHERE event_type = ?
         AND source = ?
         AND event_at >= ?
         AND event_at <= ?
         AND ticker IN (${placeholders})`,
      [params.type, params.source, params.fromEventTime, params.toEventTime, ...batch],
    );
    deletedRows += result.changes ?? 0;
  }

  return deletedRows;
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
  const mapped = await mapCalendarRows(rows);
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
  if (!row) {
    return null;
  }
  const mapped = await mapCalendarRows([row]);
  return mapped[0] ?? null;
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

async function mapCalendarRows(rows: CalendarDbRow[]): Promise<Array<Record<string, unknown>>> {
  const tickers = Array.from(new Set(
    rows
      .map((row) => row.ticker?.toUpperCase() ?? "")
      .filter((ticker): ticker is string => Boolean(ticker))
  ));
  const metadataMap = await getCalendarTickerMetadataMap(tickers);
  const ipoUniqueKeys = rows
    .filter((row) => row.event_type === "ipos" && row.unique_key)
    .map((row) => row.unique_key);
  const ipoSecMap = await getIpoSecEnrichmentMap(ipoUniqueKeys);
  return rows.map((row) => mapCalendarRow(
    row,
    metadataMap.get(row.ticker?.toUpperCase() ?? ""),
    ipoSecMap.get(row.unique_key),
  ));
}

function mapCalendarRow(
  row: CalendarDbRow,
  metadata?: CalendarTickerMetadataRow,
  ipoSec?: IpoSecEnrichmentRow,
): Record<string, unknown> {
  const fieldsJson = parseFieldsJson(row.meta_json);
  const eventDate = getEventDate(row.event_at);
  const companyName = getStringField(fieldsJson.company_name) ?? metadata?.name ?? null;
  const companyDescription = getStringField(fieldsJson.company_description) ?? ipoSec?.company_description ?? metadata?.description ?? null;
  const epsEstimated = getNumberField(fieldsJson.eps_est);
  const epsActual = getNumberField(fieldsJson.eps_actual);
  const revenueEstimated = getNumberField(fieldsJson.revenue_est);
  const revenueActual = getNumberField(fieldsJson.revenue_actual);
  const timeOfDay = getStringField(fieldsJson.time_of_day);
  const surprisePct = getNumberField(fieldsJson.surprise_pct) ?? computeSurprisePct(epsActual, epsEstimated);
  const confirmed = getBooleanField(fieldsJson.confirmed) ?? (epsActual != null || revenueActual != null);
  const session = getStringField(fieldsJson.session) ?? deriveSession(timeOfDay);
  const ipoDate = getStringField(fieldsJson.ipo_date) ?? eventDate;
  const secFilingDate = ipoSec?.filing_date ? ipoSec.filing_date.slice(0, 10) : null;
  const secAcceptedDate = ipoSec?.accepted_date ? ipoSec.accepted_date.slice(0, 10) : null;

  return {
    id: row.id,
    type: row.event_type,
    event_time: row.event_at,
    event_date: eventDate,
    ticker: row.ticker || null,
    title: row.title,
    source: row.source,
    unique_key: row.unique_key,
    fields_json: fieldsJson,
    created_at: row.created_at,
    ...fieldsJson,
    report_date: getStringField(fieldsJson.report_date) ?? eventDate,
    ipo_date: ipoDate,
    company_name: companyName,
    company_description: companyDescription,
    name: metadata?.name ?? companyName ?? (row.ticker || null),
    exchange: metadata?.exchange ?? getStringField(fieldsJson.exchange) ?? null,
    sector: metadata?.sector ?? getStringField(fieldsJson.sector) ?? null,
    industry: metadata?.industry ?? ipoSec?.sec_industry ?? getStringField(fieldsJson.industry) ?? null,
    market_cap: metadata?.market_cap ?? null,
    float_pct: metadata?.float_pct ?? null,
    institutional_pct: metadata?.institutional_pct ?? null,
    insider_pct: metadata?.insider_pct ?? null,
    market_cap_source: metadata?.market_cap_source ?? null,
    float_source: metadata?.float_source ?? null,
    institutional_source: metadata?.institutional_source ?? null,
    insider_source: metadata?.insider_source ?? null,
    time_of_day: timeOfDay,
    session,
    confirmed,
    eps_est: epsEstimated,
    eps_actual: epsActual,
    revenue_est: revenueEstimated,
    revenue_actual: revenueActual,
    surprise_pct: surprisePct,
    status: getStringField(fieldsJson.status) ?? getStringField(fieldsJson.action) ?? null,
    shares: getNumberField(fieldsJson.shares),
    price_range: getStringField(fieldsJson.price_range),
    offer_amount: getNumberField(fieldsJson.offer_amount),
    daa: getStringField(fieldsJson.daa),
    sec_form: ipoSec?.form_type ?? null,
    sec_filing_date: secFilingDate,
    sec_accepted_date: secAcceptedDate,
    sec_owner_count: ipoSec?.ownership_holder_count ?? null,
    sec_max_owner_pct: ipoSec?.ownership_max_pct ?? null,
    sec_total_owner_pct: ipoSec?.ownership_total_pct ?? null,
    sec_sic_code: ipoSec?.sic_code ?? null,
    sec_sic_description: ipoSec?.sic_description ?? null,
    sec_industry: ipoSec?.sec_industry ?? null,
    sec_document_url: ipoSec?.document_url ?? null,
    prospectus_url: ipoSec?.prospectus_url ?? null,
    disclosure_url: ipoSec?.disclosure_url ?? null,
    sec_source_note: ipoSec?.source_note ?? null,
    sec_last_synced_at: ipoSec?.fetched_at ?? null,
  };
}

async function getCalendarTickerMetadataMap(
  tickers: string[],
): Promise<Map<string, CalendarTickerMetadataRow>> {
  if (tickers.length === 0) {
    return new Map();
  }
  const placeholders = tickers.map(() => "?").join(",");
  const rows = await getDb().all<CalendarTickerMetadataRow[]>(
    `SELECT s.ticker,
            s.exchange,
            s.name,
            (
              SELECT cp.description
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.description IS NOT NULL AND cp.description != ''
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS description,
            s.sector,
            s.industry,
            (
              SELECT cp.market_cap
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.market_cap IS NOT NULL
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS market_cap,
            (
              SELECT cp.float_pct
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.float_pct IS NOT NULL
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS float_pct,
            (
              SELECT cp.institutional_pct
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.institutional_pct IS NOT NULL AND cp.institutional_source = 'yahoo'
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS institutional_pct,
            (
              SELECT cp.insider_pct
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.insider_pct IS NOT NULL
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS insider_pct,
            (
              SELECT cp.market_cap_source
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.market_cap IS NOT NULL
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS market_cap_source,
            (
              SELECT cp.float_source
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.float_pct IS NOT NULL
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS float_source,
            (
              SELECT cp.institutional_source
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.institutional_pct IS NOT NULL AND cp.institutional_source = 'yahoo'
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS institutional_source,
            (
              SELECT cp.insider_source
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.insider_pct IS NOT NULL
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS insider_source
       FROM securities s
       WHERE s.ticker IN (${placeholders})`,
    tickers,
  );

  return new Map(rows.map((row) => [row.ticker.toUpperCase(), row]));
}

function parseFieldsJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function getEventDate(eventAt: string): string | null {
  return /^\d{4}-\d{2}-\d{2}/.test(eventAt) ? eventAt.slice(0, 10) : null;
}

function getStringField(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getNumberField(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getBooleanField(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    if (value === "true" || value === "1") {
      return true;
    }
    if (value === "false" || value === "0") {
      return false;
    }
  }
  return null;
}

function computeSurprisePct(actual: number | null, estimated: number | null): number | null {
  if (actual == null || estimated == null || estimated === 0) {
    return null;
  }
  return ((actual - estimated) / Math.abs(estimated)) * 100;
}

function deriveSession(timeOfDay: string | null): string | null {
  if (timeOfDay === "BMO") {
    return "pre-market";
  }
  if (timeOfDay === "AMC") {
    return "after-market";
  }
  if (timeOfDay === "Unknown") {
    return "unknown";
  }
  return null;
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
