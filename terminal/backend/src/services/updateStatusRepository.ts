import { getDb } from "../db.js";

export type UpdateStatusRow = {
  source_key: string;
  last_success_at: string | null;
  details_json: string;
  updated_at: string;
};

export type UpdateStatusParsed = {
  sourceKey: string;
  lastSuccessAt: string | null;
  details: Record<string, unknown>;
  updatedAt: string;
};

function mapRow(row: UpdateStatusRow): UpdateStatusParsed {
  let details: Record<string, unknown> = {};
  try {
    details = JSON.parse(row.details_json);
  } catch {
    details = {};
  }
  return {
    sourceKey: row.source_key,
    lastSuccessAt: row.last_success_at,
    details,
    updatedAt: row.updated_at,
  };
}

/**
 * Known source keys — used to ensure the response always contains all expected keys
 * even if no row exists in the DB yet.
 */
const SOURCE_KEYS = [
  "tickers_csv",
  "finhub_news",
  "ibkr_calendar",
  "ibkr_ohlc_1d",
  "ibkr_ohlc_turnover",
  "fmp_ohlc_recent_missing",
  "news_change_recent_fmp_missing",
] as const;

export async function getUpdateStatus(
  sourceKey: string,
): Promise<UpdateStatusParsed | null> {
  const row = await getDb().get<UpdateStatusRow>(
    `SELECT source_key, last_success_at, details_json, updated_at
     FROM update_status
     WHERE source_key = ?`,
    [sourceKey],
  );
  return row ? mapRow(row) : null;
}

export async function listUpdateStatuses(): Promise<
  Record<string, UpdateStatusParsed | null>
> {
  const existingRows = await getDb().all<UpdateStatusRow[]>(
    `SELECT source_key, last_success_at, details_json, updated_at
     FROM update_status`,
  );

  const mapped = new Map<string, UpdateStatusParsed>();
  for (const row of existingRows) {
    mapped.set(row.source_key, mapRow(row));
  }

  const result: Record<string, UpdateStatusParsed | null> = {};
  for (const key of SOURCE_KEYS) {
    result[key] = mapped.get(key) ?? null;
  }
  // Also include any extra keys already in DB that are not in SOURCE_KEYS
  for (const [key, value] of mapped) {
    if (!(key in result)) {
      result[key] = value;
    }
  }
  return result;
}

export async function setLastSuccess(
  sourceKey: string,
  isoTimestamp: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const detailsJson = JSON.stringify(details ?? {});
  await getDb().run(
    `INSERT INTO update_status (source_key, last_success_at, details_json, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(source_key) DO UPDATE
       SET last_success_at = excluded.last_success_at,
           details_json = excluded.details_json,
           updated_at = datetime('now')`,
    [sourceKey, isoTimestamp, detailsJson],
  );
}
