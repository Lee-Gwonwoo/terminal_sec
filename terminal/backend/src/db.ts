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

  // Step 4-2: news_change_metrics table (separate change data — forward-looking)
  // PLAN CHANGE #10: renamed anchor_date→target_date, lookback→forward
  await db.exec(`
    CREATE TABLE IF NOT EXISTS news_change_metrics (
      news_id TEXT NOT NULL REFERENCES news_items(id),
      metric_key TEXT NOT NULL,
      value_pct REAL,
      ohlc_ticker TEXT NOT NULL,
      reference_date TEXT NOT NULL,
      target_date TEXT NOT NULL,
      forward_trading_days INTEGER,
      calc_version TEXT NOT NULL DEFAULT 'v2',
      computed_at TEXT NOT NULL,
      PRIMARY KEY (news_id, metric_key)
    );
  `);
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_ncm_news_id ON news_change_metrics (news_id);"
  );

  await db.exec("DROP VIEW IF EXISTS model1_current_news_view;");
  await db.exec(`
    CREATE VIEW model1_current_news_view AS
    SELECT ni.id,
           ni.published_at,
           ni.source,
           ni.publisher,
           ni.origin_url,
           ni.source_type,
           ni.title,
           ni.body,
           ni.url,
           ni.tickers_csv,
           ni.tags_csv,
           ni.created_at,
           CASE WHEN nf.extraction_status = 'success' THEN 1 ELSE 0 END AS has_full_text,
           nf.keywords_json,
           nf.keywords_status,
           naa.score AS ai_score,
           naa.score_evidence AS ai_score_evidence,
           naa.analysis_status AS ai_analysis_status,
           naa.keywords_json AS ai_keywords_json
    FROM news_items ni
    LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
    LEFT JOIN news_ai_analysis naa ON naa.news_id = ni.id;
  `);

  // Step 10: publisher column on news_items
  await ensureColumn("news_items", "publisher", "TEXT");

  // Step 11: origin_url column on news_items (original press release URL extracted from HTML footer)
  await ensureColumn("news_items", "origin_url", "TEXT");

  // Step 10: news_fulltext table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS news_fulltext (
      news_id TEXT PRIMARY KEY REFERENCES news_items(id),
      full_text TEXT NOT NULL,
      extraction_status TEXT NOT NULL,
      extraction_note TEXT,
      word_count INTEGER,
      extracted_at TEXT NOT NULL,
      keywords_json TEXT NOT NULL DEFAULT '[]',
      keywords_status TEXT NOT NULL DEFAULT 'pending',
      keywords_updated_at TEXT
    );
  `);

  // ver3: news_sentiment_snapshots — symbol-level sentiment (not per-article)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS news_sentiment_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      asof_date TEXT NOT NULL,
      buzz_articles_in_last_week INTEGER,
      buzz_weekly_average REAL,
      buzz REAL,
      company_news_score REAL,
      sector_avg_bullish_pct REAL,
      sector_avg_news_score REAL,
      sentiment_bullish_pct REAL,
      sentiment_bearish_pct REAL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (ticker, asof_date)
    );
  `);

  // ver3: news_ai_analysis — per-article AI analysis results
  await db.exec(`
    CREATE TABLE IF NOT EXISTS news_ai_analysis (
      news_id TEXT PRIMARY KEY REFERENCES news_items(id),
      score REAL,
      score_evidence TEXT,
      keywords_json TEXT NOT NULL DEFAULT '[]',
      analysis_status TEXT NOT NULL DEFAULT 'not_started',
      analyzed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ver3: bookmark_folders — tree structure with parent_id
  await db.exec(`
    CREATE TABLE IF NOT EXISTS bookmark_folders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES bookmark_folders(id) ON DELETE CASCADE
    );
  `);

  // ver3: bookmark_items — news_id in a folder (upsert-safe)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS bookmark_items (
      folder_id TEXT NOT NULL REFERENCES bookmark_folders(id) ON DELETE CASCADE,
      news_id TEXT NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (folder_id, news_id)
    );
  `);

  // ver3: confirmed_empty_ranges — per ticker+source_type empty confirmation
  await db.exec(`
    CREATE TABLE IF NOT EXISTS confirmed_empty_ranges (
      ticker TEXT NOT NULL,
      source_type TEXT NOT NULL,
      range_from TEXT NOT NULL,
      range_to TEXT NOT NULL,
      confirmed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (ticker, source_type)
    );
  `);

  // Step 5-1: canonical ticker master model
  await db.exec(`
    CREATE TABLE IF NOT EXISTS securities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      exchange TEXT,
      name TEXT,
      sector TEXT,
      industry TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (ticker, exchange)
    );
  `);
  await db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_securities_ticker_exchange ON securities (ticker, COALESCE(exchange, ''));"
  );

  await db.exec(`
    CREATE TABLE IF NOT EXISTS company_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      security_id INTEGER NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      description TEXT,
      ceo TEXT,
      employees INTEGER,
      website TEXT,
      ipo_date TEXT,
      market_cap REAL,
      raw_json TEXT,
      peers_json TEXT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (security_id, source)
    );
  `);

  // Migration: add peers_json column to existing company_profiles tables
  try {
    await db.exec("ALTER TABLE company_profiles ADD COLUMN peers_json TEXT");
  } catch {
    // Column already exists — ignore
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ticker_universes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      source_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ticker_universe_items (
      universe_id INTEGER NOT NULL REFERENCES ticker_universes(id) ON DELETE CASCADE,
      security_id INTEGER NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (universe_id, security_id)
    );
  `);

  // Step 5-4: add security_id column to watchlist_items
  await ensureColumn("watchlist_items", "security_id", "INTEGER REFERENCES securities(id)");

  // Step 10: Case Research — OneNote-style note-taking
  await db.exec(`
    CREATE TABLE IF NOT EXISTS research_tabs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'New Section',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS research_pages (
      id TEXT PRIMARY KEY,
      tab_id TEXT NOT NULL REFERENCES research_tabs(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
  `);
  await ensureColumn("research_tabs", "deleted_at", "TEXT");
  await ensureColumn("research_pages", "deleted_at", "TEXT");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_research_tabs_active ON research_tabs(user_id, deleted_at, sort_order, created_at);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_research_pages_tab ON research_pages(tab_id);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_research_pages_active ON research_pages(tab_id, deleted_at, sort_order, created_at);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_research_pages_deleted_at ON research_pages(deleted_at);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_research_pages_fts ON research_pages(title, body);");
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
