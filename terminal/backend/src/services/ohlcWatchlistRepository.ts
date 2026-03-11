// ohlcWatchlistRepository.ts — OHLC_data/ohlc_1d_watchlist.sqlite 접근 캡슐화
// Step 7-1, 7-2

import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// ---------- DB path resolution ----------

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
  throw new Error("OHLC database (OHLC_data/ohlc_1d_watchlist.sqlite) not found");
}

let ohlcDb: Database<sqlite3.Database, sqlite3.Statement> | null = null;

const ET_TIME_ZONE = "America/New_York";
const ET_MARKET_CLOSE_TIME = "16:00:00";

type EtParts = {
  date: string;
  time: string;
};

function getEtParts(nowDate = new Date()): EtParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(nowDate);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

export function shouldExcludeCurrentEtDailyBar(date: string, nowDate = new Date()): boolean {
  const etNow = getEtParts(nowDate);
  return date === etNow.date && etNow.time < ET_MARKET_CLOSE_TIME;
}

export function filterStableDailyBars(bars: OhlcBar[], nowDate = new Date()): OhlcBar[] {
  return bars.filter((bar) => !shouldExcludeCurrentEtDailyBar(bar.Datetime, nowDate));
}

export async function getOhlcDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (ohlcDb) return ohlcDb;
  const dbPath = resolveOhlcDbPath();
  ohlcDb = await open({ filename: dbPath, driver: sqlite3.Database });
  await ohlcDb.run("PRAGMA busy_timeout = 5000");
  return ohlcDb;
}

export function getOhlcDbPath(): string {
  return resolveOhlcDbPath();
}

// ---------- Query helpers ----------

/** MAX(Datetime) across all symbols. Returns "YYYY-MM-DD" or null. */
export async function getOverallMaxDate(): Promise<string | null> {
  const db = await getOhlcDb();
  const etNow = getEtParts();
  const row = await db.get<{ maxDate: string | null }>(
    shouldExcludeCurrentEtDailyBar(etNow.date)
      ? `SELECT MAX(Datetime) AS maxDate FROM ohlc_1d WHERE Datetime < ?`
      : `SELECT MAX(Datetime) AS maxDate FROM ohlc_1d`,
    shouldExcludeCurrentEtDailyBar(etNow.date) ? [etNow.date] : [],
  );
  return row?.maxDate ?? null;
}

/** MAX(Datetime) for a single symbol. */
export async function getSymbolMaxDate(symbol: string): Promise<string | null> {
  const db = await getOhlcDb();
  const etNow = getEtParts();
  const row = await db.get<{ maxDate: string | null }>(
    shouldExcludeCurrentEtDailyBar(etNow.date)
      ? `SELECT MAX(Datetime) AS maxDate FROM ohlc_1d WHERE Symbol = ? AND Datetime < ?`
      : `SELECT MAX(Datetime) AS maxDate FROM ohlc_1d WHERE Symbol = ?`,
    shouldExcludeCurrentEtDailyBar(etNow.date) ? [symbol, etNow.date] : [symbol],
  );
  return row?.maxDate ?? null;
}

// ---------- Upsert ----------

export interface OhlcBar {
  Datetime: string; // "YYYY-MM-DD"
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

/** Upsert bars for one symbol. Returns count of rows affected. */
export async function upsertBars(symbol: string, bars: OhlcBar[]): Promise<number> {
  const stableBars = filterStableDailyBars(bars);
  if (stableBars.length === 0) return 0;
  const db = await getOhlcDb();
  let count = 0;
  await db.run("BEGIN");
  try {
    const stmt = await db.prepare(
      `INSERT INTO ohlc_1d (Symbol, Datetime, Open, High, Low, Close, Volume)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(Symbol, Datetime) DO UPDATE SET
         Open = excluded.Open,
         High = excluded.High,
         Low = excluded.Low,
         Close = excluded.Close,
         Volume = excluded.Volume`,
    );
    for (const bar of stableBars) {
      await stmt.run(symbol, bar.Datetime, bar.Open, bar.High, bar.Low, bar.Close, bar.Volume);
      count++;
    }
    await stmt.finalize();
    await db.run("COMMIT");
  } catch (e) {
    await db.run("ROLLBACK");
    throw e;
  }
  return count;
}

export async function deleteBarsForDate(date: string): Promise<number> {
  const db = await getOhlcDb();
  const result = await db.run(`DELETE FROM ohlc_1d WHERE Datetime = ?`, [date]);
  return result.changes ?? 0;
}

// ---------- 7-2: ensureDerivedColumns() ----------

const DERIVED_COLUMNS: Array<{ name: string; definition: string }> = [
  { name: "Change_1d_Pct", definition: "REAL" },
  { name: "Change_From_Open_Pct", definition: "REAL" },
  { name: "Change_7d_Pct", definition: "REAL" },
  { name: "Change_14d_Pct", definition: "REAL" },
  { name: "Change_30d_Pct", definition: "REAL" },
  { name: "Derived_Updated_At", definition: "TEXT" },
];

/** Idempotent: add missing derived columns to ohlc_1d. Safe to call multiple times. */
export async function ensureDerivedColumns(): Promise<string[]> {
  const db = await getOhlcDb();
  const info = await db.all<{ name: string }[]>(`PRAGMA table_info(ohlc_1d)`);
  const existing = new Set(info.map((r) => r.name));
  const added: string[] = [];
  for (const col of DERIVED_COLUMNS) {
    if (!existing.has(col.name)) {
      await db.exec(`ALTER TABLE ohlc_1d ADD COLUMN ${col.name} ${col.definition}`);
      added.push(col.name);
    }
  }
  return added;
}
