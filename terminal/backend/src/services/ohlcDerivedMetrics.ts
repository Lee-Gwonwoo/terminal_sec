// ohlcDerivedMetrics.ts — 파생 지표 계산/저장 (Step 7-4)

import { ensureDerivedColumns, getOhlcDb } from "./ohlcWatchlistRepository.js";

function pctChange(current: number, reference: number): number | null {
  if (reference === 0) return null;
  return Number((((current - reference) / reference) * 100).toFixed(4));
}

function calcTurnover(open: number, close: number, volume: number): number | null {
  if (!Number.isFinite(open) || !Number.isFinite(close) || !Number.isFinite(volume)) {
    return null;
  }
  return Number((volume * ((open + close) / 2)).toFixed(4));
}

interface OhlcFullRow {
  Symbol: string;
  Datetime: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

/**
 * Recalculate derived % columns for a symbol over a date range.
 * Loads enough lookback data (40 trading days before startDate) to cover 30d metric.
 *
 * @param symbol - e.g. "AAPL"
 * @param startDate - "YYYY-MM-DD" first date to compute
 * @param endDate - "YYYY-MM-DD" last date to compute
 * @returns number of rows updated
 */
export async function computeDerivedMetrics(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  await ensureDerivedColumns();
  const db = await getOhlcDb();

  // Get all bars from (startDate - 40 lookback margin) to endDate
  const allBars = await db.all<OhlcFullRow[]>(
    `SELECT Symbol, Datetime, Open, High, Low, Close, Volume
     FROM ohlc_1d
     WHERE Symbol = ? AND Datetime <= ?
     ORDER BY Datetime ASC`,
    [symbol, endDate],
  );

  if (allBars.length === 0) return 0;

  // Find the index of startDate (or the first date >= startDate)
  let startIdx = allBars.findIndex((r) => r.Datetime >= startDate);
  if (startIdx < 0) return 0;

  const now = new Date().toISOString();
  let updated = 0;

  await db.run("BEGIN");
  try {
    const stmt = await db.prepare(
      `UPDATE ohlc_1d SET
         Change_1d_Pct = ?,
         Change_From_Open_Pct = ?,
         Change_7d_Pct = ?,
         Change_14d_Pct = ?,
         Change_30d_Pct = ?,
         Turnover = ?,
         Derived_Updated_At = ?
       WHERE Symbol = ? AND Datetime = ?`,
    );

    for (let i = startIdx; i < allBars.length; i++) {
      const row = allBars[i];
      const close = row.Close;
      const open = row.Open;

      // 1d: previous trading day close
      const prev1 = i >= 1 ? allBars[i - 1] : null;
      const change1d = prev1 ? pctChange(close, prev1.Close) : null;

      // from open
      const changeFromOpen = pctChange(close, open);

      // 7d: ~5 trading days back
      const prev5 = i >= 5 ? allBars[i - 5] : null;
      const change7d = prev5 ? pctChange(close, prev5.Close) : null;

      // 14d: ~10 trading days back
      const prev10 = i >= 10 ? allBars[i - 10] : null;
      const change14d = prev10 ? pctChange(close, prev10.Close) : null;

      // 30d: ~22 trading days back
      const prev22 = i >= 22 ? allBars[i - 22] : null;
      const change30d = prev22 ? pctChange(close, prev22.Close) : null;
      const turnover = calcTurnover(open, close, row.Volume);

      await stmt.run(
        change1d, changeFromOpen, change7d, change14d, change30d, turnover, now,
        symbol, row.Datetime,
      );
      updated++;
    }

    await stmt.finalize();
    await db.run("COMMIT");
  } catch (e) {
    await db.run("ROLLBACK");
    throw e;
  }

  return updated;
}

/**
 * Compute derived metrics for multiple symbols with safe lookback.
 * For each symbol, recomputes from (minNewDate - 40 bars) to maxNewDate.
 */
export async function computeDerivedForAffectedSymbols(
  affectedSymbols: Map<string, { minDate: string; maxDate: string }>,
): Promise<{ totalUpdated: number; symbolCount: number }> {
  await ensureDerivedColumns();
  const db = await getOhlcDb();
  let totalUpdated = 0;
  let symbolCount = 0;

  for (const [symbol, range] of affectedSymbols) {
    // Find safe start: 40 trading days before minDate
    const lookbackRows = await db.all<{ Datetime: string }[]>(
      `SELECT Datetime FROM ohlc_1d
       WHERE Symbol = ? AND Datetime < ?
       ORDER BY Datetime DESC LIMIT 40`,
      [symbol, range.minDate],
    );
    const safeStart = lookbackRows.length > 0
      ? lookbackRows[lookbackRows.length - 1].Datetime
      : range.minDate;

    const updated = await computeDerivedMetrics(symbol, safeStart, range.maxDate);
    totalUpdated += updated;
    if (updated > 0) symbolCount++;
  }

  return { totalUpdated, symbolCount };
}

export async function computeMissingTurnoverForSymbol(
  symbol: string,
): Promise<{ updated: number; existing: number; uncomputable: number }> {
  await ensureDerivedColumns();
  const db = await getOhlcDb();
  const stats = await db.get<{
    existing_count: number | null;
    uncomputable_missing_count: number | null;
  }>(
    `SELECT
       SUM(CASE WHEN Turnover IS NOT NULL THEN 1 ELSE 0 END) AS existing_count,
       SUM(CASE
             WHEN Turnover IS NULL
              AND (Volume IS NULL OR Open IS NULL OR Close IS NULL)
             THEN 1 ELSE 0
           END) AS uncomputable_missing_count
     FROM ohlc_1d
     WHERE Symbol = ?`,
    [symbol],
  );

  const result = await db.run(
    `UPDATE ohlc_1d
     SET Turnover = ROUND(Volume * ((Open + Close) / 2.0), 4),
         Derived_Updated_At = ?
     WHERE Symbol = ?
       AND Turnover IS NULL
       AND Volume IS NOT NULL
       AND Open IS NOT NULL
       AND Close IS NOT NULL`,
    [new Date().toISOString(), symbol],
  );

  return {
    updated: result.changes ?? 0,
    existing: Number(stats?.existing_count ?? 0),
    uncomputable: Number(stats?.uncomputable_missing_count ?? 0),
  };
}
