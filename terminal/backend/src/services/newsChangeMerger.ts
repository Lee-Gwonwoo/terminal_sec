import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getDb } from "../db.js";

// ---------- OHLC DB location ----------

function resolveOhlcDbPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let current = here;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(current, "OHLC_data", "ohlc_1d_watchlist.sqlite");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error("OHLC database (ohlc_1d_watchlist.sqlite) not found");
}

let ohlcDb: Database<sqlite3.Database, sqlite3.Statement> | null = null;

async function getOhlcDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (ohlcDb) return ohlcDb;
  const dbPath = resolveOhlcDbPath();
  ohlcDb = await open({ filename: dbPath, driver: sqlite3.Database });
  return ohlcDb;
}

// ---------- OHLC query ----------

type OhlcRow = {
  Symbol: string;
  Datetime: string;
  Open: number;
  Close: number;
};

async function getOhlcClose(symbol: string, date: string): Promise<OhlcRow | null> {
  const db = await getOhlcDb();
  const row = await db.get<OhlcRow>(
    `SELECT Symbol, Datetime, Open, Close FROM ohlc_1d WHERE Symbol = ? AND Datetime = ?`,
    [symbol, date],
  );
  return row ?? null;
}

async function getOhlcCloseNDaysBack(
  symbol: string,
  baseDate: string,
  daysBack: number,
): Promise<OhlcRow | null> {
  const db = await getOhlcDb();
  // Get the Nth-most-recent trading day before baseDate
  const row = await db.get<OhlcRow>(
    `SELECT Symbol, Datetime, Open, Close FROM ohlc_1d
     WHERE Symbol = ? AND Datetime < ?
     ORDER BY Datetime DESC
     LIMIT 1 OFFSET ?`,
    [symbol, baseDate, daysBack - 1],
  );
  return row ?? null;
}

function pctChange(current: number, reference: number): number | null {
  if (reference === 0) return null;
  return Number((((current - reference) / reference) * 100).toFixed(4));
}

// ---------- Merge one news item ----------

export async function mergeChangeForNewsItem(
  newsId: string,
  ticker: string,
  publishedAt: string,
): Promise<boolean> {
  // Determine the date (YYYY-MM-DD) of the news
  const newsDate = publishedAt.slice(0, 10);

  // Get OHLC for the news date
  const dayRow = await getOhlcClose(ticker, newsDate);
  if (!dayRow) {
    // No OHLC data for this date — skip (will be backfilled later)
    return false;
  }

  const close = dayRow.Close;
  const open = dayRow.Open;

  // 1d change: compare close to previous day's close
  const prevDay = await getOhlcCloseNDaysBack(ticker, newsDate, 1);
  const change1d = prevDay ? pctChange(close, prevDay.Close) : null;

  // Change from open
  const changeFromOpen = pctChange(close, open);

  // 7d, 14d, 30d: compare close to N-trading-days-back close
  const day7 = await getOhlcCloseNDaysBack(ticker, newsDate, 5); // ~7 calendar days ≈ 5 trading days
  const change7d = day7 ? pctChange(close, day7.Close) : null;

  const day14 = await getOhlcCloseNDaysBack(ticker, newsDate, 10);
  const change14d = day14 ? pctChange(close, day14.Close) : null;

  const day30 = await getOhlcCloseNDaysBack(ticker, newsDate, 22);
  const change30d = day30 ? pctChange(close, day30.Close) : null;

  // Update the news_items row
  await getDb().run(
    `UPDATE news_items
     SET ohlc_ticker = ?,
         ohlc_date = ?,
         change_1d_pct = ?,
         change_from_open_pct = ?,
         change_7d_pct = ?,
         change_14d_pct = ?,
         change_30d_pct = ?,
         change_computed_at = datetime('now')
     WHERE id = ?`,
    [ticker, newsDate, change1d, changeFromOpen, change7d, change14d, change30d, newsId],
  );

  return true;
}

// ---------- Batch merge for newly inserted items ----------

export async function mergeChangeForNewItems(
  newsIds: Array<{ id: string; tickers: string[]; publishedAt: string }>,
): Promise<{ merged: number; skipped: number }> {
  let merged = 0;
  let skipped = 0;

  for (const item of newsIds) {
    // Use the first ticker for OHLC lookup
    const ticker = item.tickers[0];
    if (!ticker) {
      skipped++;
      continue;
    }

    const success = await mergeChangeForNewsItem(item.id, ticker, item.publishedAt);
    if (success) {
      merged++;
    } else {
      skipped++;
    }
  }

  return { merged, skipped };
}
