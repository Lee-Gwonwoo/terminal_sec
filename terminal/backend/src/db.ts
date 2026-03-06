import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function initDb(): Promise<void> {
  const fullPath = path.resolve(config.sqlitePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  db = await open({
    filename: fullPath,
    driver: sqlite3.Database
  });

  await db.exec("PRAGMA foreign_keys = ON;");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS news_items (
      id TEXT PRIMARY KEY,
      published_at TEXT NOT NULL,
      source TEXT NOT NULL,
      source_type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      url TEXT NOT NULL,
      tickers_csv TEXT NOT NULL,
      tags_csv TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (source, url)
    );

    CREATE INDEX IF NOT EXISTS idx_news_items_published ON news_items (published_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS news_saved_views (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      query_json TEXT NOT NULL,
      enable_alerts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS watchlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      enable_alerts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS watchlist_items (
      watchlist_id TEXT NOT NULL,
      ticker TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (watchlist_id, ticker),
      FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      ticker TEXT,
      title TEXT NOT NULL,
      event_at TEXT NOT NULL,
      meta_json TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'mock_provider',
      unique_key TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_events_event_at ON calendar_events (event_at DESC);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_type_time ON calendar_events (event_type, event_at DESC);

    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      methods_json TEXT NOT NULL,
      rule_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_alert_rules_user_tool ON alert_rules (user_id, tool);

    CREATE TABLE IF NOT EXISTS update_status (
      source_key TEXT PRIMARY KEY,
      last_success_at TEXT,
      details_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await ensureColumn("calendar_events", "source", "TEXT NOT NULL DEFAULT 'mock_provider'");
  await ensureColumn("calendar_events", "unique_key", "TEXT NOT NULL DEFAULT ''");
  await db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_events_type_unique_key ON calendar_events (event_type, unique_key);"
  );

  // news_items change% columns (Step 4-2)
  await ensureColumn("news_items", "ohlc_ticker", "TEXT");
  await ensureColumn("news_items", "ohlc_date", "TEXT");
  await ensureColumn("news_items", "change_1d_pct", "REAL");
  await ensureColumn("news_items", "change_from_open_pct", "REAL");
  await ensureColumn("news_items", "change_7d_pct", "REAL");
  await ensureColumn("news_items", "change_14d_pct", "REAL");
  await ensureColumn("news_items", "change_30d_pct", "REAL");
  await ensureColumn("news_items", "change_computed_at", "TEXT");
}

async function ensureColumn(tableName: string, columnName: string, definition: string): Promise<void> {
  const rows = await db.all<{ name: string }[]>(`PRAGMA table_info(${tableName})`);
  const hasColumn = rows.some((row) => row.name === columnName);
  if (hasColumn) {
    return;
  }
  await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

export function getDb(): Database<sqlite3.Database, sqlite3.Statement> {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}
