import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";
import { getEtDateString, toEtNaiveIso } from "./services/timeUtils.js";

let db: Database<sqlite3.Database, sqlite3.Statement>;

const INVESTING_PUBLISHED_AT_MIGRATION_KEY = "investing_published_at_utc_to_et_v1";
const INVESTING_PUBLISHED_AT_MIGRATION_CUTOFF_UTC = "2026-03-30 13:00:00";

export async function initDb(): Promise<void> {
  const fullPath = path.resolve(config.sqlitePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  db = await open({
    filename: fullPath,
    driver: sqlite3.Database
  });

  await db.exec("PRAGMA journal_mode = WAL;");
  await db.exec("PRAGMA busy_timeout = 10000;");
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
      UNIQUE (source, source_type, url)
    );

    CREATE INDEX IF NOT EXISTS idx_news_items_published ON news_items (published_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_news_items_source_published ON news_items (source, published_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_news_items_source_type_source_published ON news_items (source_type, source, published_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_news_items_primary_ticker_published ON news_items (
      (CASE
        WHEN tickers_csv IS NULL OR TRIM(tickers_csv) = '' THEN NULL
        WHEN instr(substr(tickers_csv, 2), ',') <= 0 THEN NULL
        ELSE substr(tickers_csv, 2, instr(substr(tickers_csv, 2), ',') - 1)
      END),
      published_at DESC,
      id DESC
    );

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

    CREATE TABLE IF NOT EXISTS calendar_financial_series (
      ticker TEXT NOT NULL,
      period_type TEXT NOT NULL,
      report_date TEXT NOT NULL,
      fiscal_year TEXT,
      fiscal_period TEXT,
      label TEXT NOT NULL,
      revenue REAL,
      revenue_estimate REAL,
      net_income REAL,
      net_income_estimate REAL,
      eps REAL,
      eps_estimate REAL,
      market_cap REAL,
      pe_ratio REAL,
      ps_ratio REAL,
      num_analysts_revenue INTEGER,
      num_analysts_eps INTEGER,
      source TEXT NOT NULL DEFAULT 'FMP',
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (ticker, period_type, report_date)
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_financial_series_ticker_period
      ON calendar_financial_series (ticker, period_type, report_date ASC);

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
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_news_items_source_published ON news_items (source, published_at DESC, id DESC);"
  );
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_news_items_source_type_source_published ON news_items (source_type, source, published_at DESC, id DESC);"
  );
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_news_items_primary_ticker_published ON news_items (
      (CASE
        WHEN tickers_csv IS NULL OR TRIM(tickers_csv) = '' THEN NULL
        WHEN instr(substr(tickers_csv, 2), ',') <= 0 THEN NULL
        ELSE substr(tickers_csv, 2, instr(substr(tickers_csv, 2), ',') - 1)
      END),
      published_at DESC,
      id DESC
    );
  `);

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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS news_earnings_context (
      news_id TEXT PRIMARY KEY REFERENCES news_items(id) ON DELETE CASCADE,
      context_ticker TEXT,
      anchor_published_at TEXT NOT NULL,
      recent_earnings_date TEXT,
      recent_earnings_confirmed INTEGER,
      upcoming_earnings_date TEXT,
      upcoming_earnings_confirmed INTEGER,
      recent_calendar_event_id TEXT,
      upcoming_calendar_event_id TEXT,
      recent_source TEXT NOT NULL DEFAULT 'none',
      upcoming_source TEXT NOT NULL DEFAULT 'none',
      lookup_status TEXT NOT NULL DEFAULT 'missing',
      fmp_fallback_used INTEGER NOT NULL DEFAULT 0,
      last_checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_nec_context_ticker ON news_earnings_context (context_ticker);"
  );
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_nec_lookup_status ON news_earnings_context (lookup_status);"
  );

  await ensureColumn("news_earnings_context", "context_ticker", "TEXT");
  await ensureColumn("news_earnings_context", "anchor_published_at", "TEXT");
  await ensureColumn("news_earnings_context", "recent_earnings_date", "TEXT");
  await ensureColumn("news_earnings_context", "recent_earnings_confirmed", "INTEGER");
  await ensureColumn("news_earnings_context", "upcoming_earnings_date", "TEXT");
  await ensureColumn("news_earnings_context", "upcoming_earnings_confirmed", "INTEGER");
  await ensureColumn("news_earnings_context", "recent_calendar_event_id", "TEXT");
  await ensureColumn("news_earnings_context", "upcoming_calendar_event_id", "TEXT");
  await ensureColumn("news_earnings_context", "recent_source", "TEXT NOT NULL DEFAULT 'none'");
  await ensureColumn("news_earnings_context", "upcoming_source", "TEXT NOT NULL DEFAULT 'none'");
  await ensureColumn("news_earnings_context", "lookup_status", "TEXT NOT NULL DEFAULT 'missing'");
  await ensureColumn("news_earnings_context", "fmp_fallback_used", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("news_earnings_context", "last_checked_at", "TEXT NOT NULL DEFAULT (datetime('now'))");

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
           nf.full_text,
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
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_news_sentiment_ticker_asof ON news_sentiment_snapshots (ticker, asof_date DESC, id DESC);"
  );

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

  // Migration: promote existing FMP press release rows to dedicated source_type.
  await db.run(
    `UPDATE news_items
     SET source_type = 'fmp_press_release'
     WHERE source = 'FMP' AND source_type = 'press_release'`,
  );

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

  // Migration: add float / institutional ownership columns
  for (const col of [
    ["float_shares", "REAL"],
    ["float_pct", "REAL"],
    ["outstanding_shares", "REAL"],
    ["institutional_pct", "REAL"],
    ["insider_pct", "REAL"],
    ["market_cap_source", "TEXT"],
    ["float_source", "TEXT"],
    ["institutional_source", "TEXT"],
    ["insider_source", "TEXT"],
  ] as const) {
    try {
      await db.exec(`ALTER TABLE company_profiles ADD COLUMN ${col[0]} ${col[1]}`);
    } catch {
      // Column already exists — ignore
    }
  }
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_company_profiles_security_fetched ON company_profiles (security_id, fetched_at DESC, id DESC);"
  );

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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS model2_analysis_runs (
      id TEXT PRIMARY KEY,
      page_id TEXT REFERENCES research_pages(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      note_title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_name TEXT,
      since TEXT NOT NULL,
      until TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'company_news',
      total_rows INTEGER NOT NULL DEFAULT 0,
      analyzable_rows INTEGER NOT NULL DEFAULT 0,
      impacted_rows INTEGER NOT NULL DEFAULT 0,
      meaningless_rows INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS model2_evidence_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id TEXT NOT NULL REFERENCES model2_analysis_runs(id) ON DELETE CASCADE,
      news_id TEXT NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
      case_type TEXT NOT NULL,
      case_label_ko TEXT NOT NULL,
      top_level TEXT NOT NULL,
      reaction_tag TEXT NOT NULL DEFAULT 'pending',
      is_impacted INTEGER NOT NULL DEFAULT 0,
      ticker TEXT,
      market_cap REAL,
      market_cap_bucket TEXT,
      industry TEXT,
      ipo_date TEXT,
      change_pct REAL,
      change_from_open_pct REAL,
      change_open_to_high_pct REAL,
      change_1d_pct REAL,
      change_3d_pct REAL,
      change_7d_pct REAL,
      change_14d_pct REAL,
      change_30d_pct REAL,
      immediate_reaction_score REAL,
      short_followthrough_score REAL,
      medium_persistence_score REAL,
      overall_impact_score REAL,
      summary TEXT,
      published_at TEXT,
      source TEXT,
      publisher TEXT,
      source_type TEXT,
      title TEXT,
      body_preview TEXT,
      url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (analysis_id, news_id)
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS model2_case_summaries (
      analysis_id TEXT NOT NULL REFERENCES model2_analysis_runs(id) ON DELETE CASCADE,
      case_type TEXT NOT NULL,
      case_label_ko TEXT NOT NULL,
      top_level TEXT NOT NULL,
      total_count INTEGER NOT NULL DEFAULT 0,
      impacted_count INTEGER NOT NULL DEFAULT 0,
      latest_published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (analysis_id, case_type)
    );
  `);
  await ensureColumn("model2_evidence_rows", "published_at", "TEXT");
  await ensureColumn("model2_evidence_rows", "source", "TEXT");
  await ensureColumn("model2_evidence_rows", "publisher", "TEXT");
  await ensureColumn("model2_evidence_rows", "source_type", "TEXT");
  await ensureColumn("model2_evidence_rows", "title", "TEXT");
  await ensureColumn("model2_evidence_rows", "body_preview", "TEXT");
  await ensureColumn("model2_evidence_rows", "url", "TEXT");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_model2_runs_page_created ON model2_analysis_runs(page_id, created_at DESC);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_model2_runs_source_created ON model2_analysis_runs(source_type, created_at DESC);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_model2_evidence_analysis_case ON model2_evidence_rows(analysis_id, case_type);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_model2_evidence_analysis_ticker ON model2_evidence_rows(analysis_id, ticker);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_model2_evidence_analysis_impact ON model2_evidence_rows(analysis_id, overall_impact_score DESC);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_model2_evidence_analysis_published ON model2_evidence_rows(analysis_id, published_at DESC, id DESC);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_model2_evidence_analysis_case_published ON model2_evidence_rows(analysis_id, case_type, published_at DESC, id DESC);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_model2_evidence_analysis_ticker_published ON model2_evidence_rows(analysis_id, ticker, published_at DESC, id DESC);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_model2_case_summaries_analysis_total ON model2_case_summaries(analysis_id, total_count DESC, impacted_count DESC, case_type);");

  // SEC Filings companion table — stores Finnhub SEC filing metadata alongside news_items
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sec_filings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      news_id TEXT NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
      accession_number TEXT NOT NULL,
      cik TEXT NOT NULL,
      form_type TEXT NOT NULL,
      filed_at TEXT NOT NULL,
      accepted_at TEXT,
      report_url TEXT,
      filing_url TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (accession_number)
    );
  `);
  await db.exec("CREATE INDEX IF NOT EXISTS idx_sec_filings_news_id ON sec_filings(news_id);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_sec_filings_form_type ON sec_filings(form_type, filed_at DESC);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_sec_filings_filed_at ON sec_filings(filed_at DESC);");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ipo_sec_enrichments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_unique_key TEXT NOT NULL UNIQUE,
      ticker TEXT,
      ipo_date TEXT,
      cik TEXT,
      form_type TEXT,
      filing_date TEXT,
      accepted_date TEXT,
      document_url TEXT,
      prospectus_url TEXT,
      disclosure_url TEXT,
      company_description TEXT,
      ownership_total_pct REAL,
      ownership_max_pct REAL,
      ownership_holder_count INTEGER,
      ownership_values_json TEXT,
      raw_json TEXT,
      source_note TEXT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  await db.exec("CREATE INDEX IF NOT EXISTS idx_ipo_sec_enrichments_ticker_date ON ipo_sec_enrichments(ticker, ipo_date);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_ipo_sec_enrichments_fetched_at ON ipo_sec_enrichments(fetched_at DESC);");

  // Phase 2: SEC SIC industry columns
  await ensureColumn("ipo_sec_enrichments", "sic_code", "TEXT");
  await ensureColumn("ipo_sec_enrichments", "sic_description", "TEXT");
  await ensureColumn("ipo_sec_enrichments", "sec_industry", "TEXT");

  await migrateNewsItemsUniqueConstraint();
  await purgeLegacyFinnhubSecFilings();
  await migrateFinnhubCompanyNewsPublishedAtToEt();
  await migrateInvestingPublishedAtToEt();
  await backfillModel2EvidenceRowsNewsFields();
  await refreshModel2CaseSummariesCache();
}

/**
 * Migrate news_items UNIQUE constraint: (source, url) → (source, source_type, url).
 * This allows the same URL to exist with different source_type values (e.g. fmp_stock_news vs fmp_press_release).
 * Idempotent: checks the autoindex column count to decide whether migration is needed.
 * Also repairs FK references if a previous migration broke them via SQLite's auto-rename behavior.
 */
async function migrateNewsItemsUniqueConstraint(): Promise<void> {
  // --- Phase 1: Repair broken FK references from prior migration attempt ---
  // SQLite's ALTER TABLE RENAME (non-legacy mode) rewrites FK references in child tables.
  // If a prior migration renamed news_items → _news_items_old, child tables now reference
  // the non-existent _news_items_old. Fix by recreating each affected child table.
  await repairBrokenFkReferences();

  const indexInfo = await db.all<{ seqno: number; cid: number; name: string }[]>(
    "PRAGMA index_info(sqlite_autoindex_news_items_2)",
  );
  // autoindex_2 = the UNIQUE constraint index. If it already has 3 columns → already migrated (or fresh DB).
  if (indexInfo.length !== 2) {
    return;
  }

  console.log("[db] migrating news_items UNIQUE constraint: (source, url) → (source, source_type, url) ...");
  const countBefore = (await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM news_items"))?.c ?? 0;

  await db.exec("PRAGMA foreign_keys = OFF;");
  // Prevent SQLite from auto-renaming FK references in child tables when we RENAME.
  await db.exec("PRAGMA legacy_alter_table = ON;");
  await db.exec("BEGIN TRANSACTION;");
  try {
    await db.exec("ALTER TABLE news_items RENAME TO _news_items_old;");
    await db.exec(`
      CREATE TABLE news_items (
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
        ohlc_ticker TEXT,
        ohlc_date TEXT,
        change_1d_pct REAL,
        change_from_open_pct REAL,
        change_7d_pct REAL,
        change_14d_pct REAL,
        change_30d_pct REAL,
        change_computed_at TEXT,
        publisher TEXT,
        origin_url TEXT,
        UNIQUE (source, source_type, url)
      );
    `);
    await db.exec(`
      INSERT INTO news_items
        (id, published_at, source, source_type, title, body, url, tickers_csv, tags_csv, created_at,
         ohlc_ticker, ohlc_date, change_1d_pct, change_from_open_pct, change_7d_pct, change_14d_pct,
         change_30d_pct, change_computed_at, publisher, origin_url)
      SELECT
        id, published_at, source, source_type, title, body, url, tickers_csv, tags_csv, created_at,
        ohlc_ticker, ohlc_date, change_1d_pct, change_from_open_pct, change_7d_pct, change_14d_pct,
        change_30d_pct, change_computed_at, publisher, origin_url
      FROM _news_items_old;
    `);
    await db.exec("DROP TABLE _news_items_old;");

    // Recreate indexes (they moved with the renamed table and got dropped).
    await db.exec("CREATE INDEX IF NOT EXISTS idx_news_items_published ON news_items (published_at DESC, id DESC);");
    await db.exec("CREATE INDEX IF NOT EXISTS idx_news_items_source_published ON news_items (source, published_at DESC, id DESC);");
    await db.exec("CREATE INDEX IF NOT EXISTS idx_news_items_source_type_source_published ON news_items (source_type, source, published_at DESC, id DESC);");

    await db.exec("COMMIT;");
  } catch (err) {
    await db.exec("ROLLBACK;");
    await db.exec("PRAGMA legacy_alter_table = OFF;");
    await db.exec("PRAGMA foreign_keys = ON;");
    throw err;
  }
  await db.exec("PRAGMA legacy_alter_table = OFF;");
  await db.exec("PRAGMA foreign_keys = ON;");

  const countAfter = (await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM news_items"))?.c ?? 0;
  console.log(`[db] migration complete — UNIQUE (source, source_type, url). rows: ${countBefore} → ${countAfter}`);
}

/**
 * Repair child tables whose FK references were rewritten from "news_items" to "_news_items_old"
 * by a prior ALTER TABLE RENAME (SQLite default non-legacy mode rewrites FK refs).
 * For each affected table: rename → recreate with corrected FK → copy data → drop old.
 */
async function repairBrokenFkReferences(): Promise<void> {
  // Check if repair is needed: look at news_fulltext FK target
  const fks = await db.all<{ table: string }[]>("PRAGMA foreign_key_list(news_fulltext)");
  const broken = fks.some(fk => fk.table === "_news_items_old");
  if (!broken) {
    return;
  }

  console.log("[db] repairing broken FK references (_news_items_old → news_items) in child tables ...");

  // Find ALL tables that reference _news_items_old
  const allTables = await db.all<{ name: string; sql: string }[]>(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE '%_news_items_old%'`,
  );

  if (allTables.length === 0) {
    return;
  }

  await db.exec("PRAGMA foreign_keys = OFF;");
  await db.exec("PRAGMA legacy_alter_table = ON;");
  await db.exec("BEGIN TRANSACTION;");
  try {
    for (const { name: tableName, sql: origSql } of allTables) {
      const tmpName = `_repair_${tableName}`;

      // Capture indexes BEFORE rename (they'll move to tmpName)
      const indexes = await db.all<{ name: string; sql: string | null }[]>(
        `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL`,
        [tableName],
      );

      await db.exec(`ALTER TABLE "${tableName}" RENAME TO "${tmpName}";`);

      // Fix FK references: replace "_news_items_old" → news_items
      const fixedSql = origSql
        .replace(/"_news_items_old"/g, "news_items")
        .replace(/_news_items_old/g, "news_items");
      await db.exec(fixedSql + ";");
      await db.exec(`INSERT INTO "${tableName}" SELECT * FROM "${tmpName}";`);
      await db.exec(`DROP TABLE "${tmpName}";`);

      // Recreate indexes on the new table (they were dropped with tmpName)
      for (const idx of indexes) {
        if (idx.sql) {
          try { await db.exec(idx.sql + ";"); } catch { /* already exists */ }
        }
      }
    }
    await db.exec("COMMIT;");
    console.log(`[db] FK references repaired for ${allTables.length} table(s): ${allTables.map(t => t.name).join(", ")}`);
  } catch (err) {
    await db.exec("ROLLBACK;");
    await db.exec("PRAGMA legacy_alter_table = OFF;");
    await db.exec("PRAGMA foreign_keys = ON;");
    throw err;
  }
  await db.exec("PRAGMA legacy_alter_table = OFF;");
  await db.exec("PRAGMA foreign_keys = ON;");
}

async function backfillModel2EvidenceRowsNewsFields(): Promise<void> {
  const missing = await db.get<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM model2_evidence_rows
     WHERE published_at IS NULL
        OR source IS NULL
        OR source_type IS NULL
        OR title IS NULL
        OR url IS NULL`,
  );

  if (!missing || missing.count === 0) {
    return;
  }

  await db.exec("BEGIN TRANSACTION");
  try {
    await db.run(
      `UPDATE model2_evidence_rows
       SET published_at = COALESCE(
             published_at,
             (SELECT ni.published_at FROM news_items ni WHERE ni.id = model2_evidence_rows.news_id)
           ),
           source = COALESCE(
             source,
             (SELECT ni.source FROM news_items ni WHERE ni.id = model2_evidence_rows.news_id)
           ),
           publisher = COALESCE(
             publisher,
             (SELECT ni.publisher FROM news_items ni WHERE ni.id = model2_evidence_rows.news_id)
           ),
           source_type = COALESCE(
             source_type,
             (SELECT ni.source_type FROM news_items ni WHERE ni.id = model2_evidence_rows.news_id)
           ),
           title = COALESCE(
             title,
             (SELECT ni.title FROM news_items ni WHERE ni.id = model2_evidence_rows.news_id)
           ),
           body_preview = COALESCE(
             body_preview,
             SUBSTR((SELECT ni.body FROM news_items ni WHERE ni.id = model2_evidence_rows.news_id), 1, 600)
           ),
           url = COALESCE(
             url,
             (SELECT ni.url FROM news_items ni WHERE ni.id = model2_evidence_rows.news_id)
           )
       WHERE published_at IS NULL
          OR source IS NULL
          OR source_type IS NULL
          OR title IS NULL
          OR url IS NULL`,
    );
    await db.exec("COMMIT");
    console.log(`[db] backfilled ${missing.count} model2 evidence rows with denormalized news fields`);
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

async function refreshModel2CaseSummariesCache(): Promise<void> {
  const analysisRows = await db.all<{ id: string }[]>(
    `SELECT id
     FROM model2_analysis_runs
     WHERE id NOT IN (SELECT DISTINCT analysis_id FROM model2_case_summaries)`,
  );

  if (analysisRows.length === 0) {
    return;
  }

  await db.exec("BEGIN TRANSACTION");
  try {
    for (const row of analysisRows) {
      await db.run("DELETE FROM model2_case_summaries WHERE analysis_id = ?", row.id);
      await db.run(
        `INSERT INTO model2_case_summaries (
           analysis_id,
           case_type,
           case_label_ko,
           top_level,
           total_count,
           impacted_count,
           latest_published_at,
           updated_at
         )
         SELECT
           analysis_id,
           case_type,
           MAX(case_label_ko) AS case_label_ko,
           MAX(top_level) AS top_level,
           COUNT(*) AS total_count,
           SUM(CASE WHEN is_impacted = 1 THEN 1 ELSE 0 END) AS impacted_count,
           MAX(published_at) AS latest_published_at,
           datetime('now') AS updated_at
         FROM model2_evidence_rows
         WHERE analysis_id = ?
         GROUP BY analysis_id, case_type`,
        row.id,
      );
    }
    await db.exec("COMMIT");
    console.log(`[db] refreshed model2 case summary cache for ${analysisRows.length} analyses`);
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

async function migrateFinnhubCompanyNewsPublishedAtToEt(): Promise<void> {
  const rows = await db.all<{ id: string; published_at: string }[]>(
    `SELECT id, published_at
     FROM news_items
     WHERE source = 'FINNHUB'
       AND source_type = 'company_news'
       AND published_at GLOB '*Z'`,
  );

  if (rows.length === 0) {
    return;
  }

  await db.exec("BEGIN TRANSACTION");
  try {
    for (const row of rows) {
      await db.run(
        `UPDATE news_items SET published_at = ? WHERE id = ?`,
        [toEtNaiveIso(row.published_at), row.id],
      );
    }
    await db.exec("COMMIT");
    console.log(`[db] migrated ${rows.length} FINNHUB company_news published_at rows from UTC to ET`);
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

async function migrateInvestingPublishedAtToEt(): Promise<void> {
  const marker = await db.get<{ last_success_at: string | null }>(
    `SELECT last_success_at
     FROM update_status
     WHERE source_key = ?`,
    [INVESTING_PUBLISHED_AT_MIGRATION_KEY],
  );

  if (marker?.last_success_at) {
    return;
  }

  const rows = await db.all<{ id: string; published_at: string }[]>(
    `SELECT id, published_at
     FROM news_items
     WHERE source = 'INVESTING'
       AND source_type IN ('investing_stock_market_news', 'investing_cryptocurrency_news')
       AND created_at <= ?`,
    [INVESTING_PUBLISHED_AT_MIGRATION_CUTOFF_UTC],
  );

  let migrated = 0;

  await db.exec("BEGIN TRANSACTION");
  try {
    for (const row of rows) {
      const trimmed = row.published_at.trim();
      if (!trimmed) {
        continue;
      }

      const normalized = /(Z|[+-]\d{2}:\d{2})$/.test(trimmed)
        ? toEtNaiveIso(trimmed)
        : toEtNaiveIso(`${trimmed}Z`);

      if (normalized === trimmed) {
        continue;
      }

      await db.run(
        `UPDATE news_items SET published_at = ? WHERE id = ?`,
        [normalized, row.id],
      );
      migrated += 1;
    }

    await db.run(
      `INSERT INTO update_status (source_key, last_success_at, details_json, updated_at)
       VALUES (?, datetime('now'), ?, datetime('now'))
       ON CONFLICT(source_key) DO UPDATE SET
         last_success_at = excluded.last_success_at,
         details_json = excluded.details_json,
         updated_at = excluded.updated_at`,
      [
        INVESTING_PUBLISHED_AT_MIGRATION_KEY,
        JSON.stringify({
          migratedRows: migrated,
          cutoffUtc: INVESTING_PUBLISHED_AT_MIGRATION_CUTOFF_UTC,
        }),
      ],
    );

    await db.exec("COMMIT");
    if (migrated > 0) {
      console.log(`[db] migrated ${migrated} INVESTING published_at rows from UTC to ET (cutoff<=${INVESTING_PUBLISHED_AT_MIGRATION_CUTOFF_UTC})`);
    }
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

function normalizeSecPublishedAt(value: string): string {
  return `${getEtDateString(value)}T00:00:00`;
}

function normalizeSecFiledAt(value: string): string {
  return getEtDateString(value);
}

function normalizeSecAcceptedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return toEtNaiveIso(value);
  }
  if (value.includes(" ")) {
    return value.replace(" ", "T");
  }
  return value;
}

async function purgeLegacyFinnhubSecFilings(): Promise<void> {
  const counts = await db.get<{ newsCount: number; companionCount: number }>(
    `SELECT
       (SELECT COUNT(*) FROM news_items WHERE source = 'FINNHUB' AND source_type = 'sec_filing') AS newsCount,
       (SELECT COUNT(*) FROM sec_filings) AS companionCount`,
  );

  const newsCount = counts?.newsCount ?? 0;
  const companionCount = counts?.companionCount ?? 0;
  if (newsCount === 0 && companionCount === 0) {
    return;
  }

  await db.exec("BEGIN TRANSACTION");
  try {
    await db.run(
      `DELETE FROM news_items
       WHERE source = 'FINNHUB' AND source_type = 'sec_filing'`,
    );
    await db.run(
      `DELETE FROM sec_filings
       WHERE news_id NOT IN (SELECT id FROM news_items)`,
    );
    await db.run(`DELETE FROM update_status WHERE source_key = 'finhub_sec_filing'`);
    await db.exec("COMMIT");
    console.log(`[db] purged legacy FINNHUB sec_filing rows: news_items=${newsCount}, sec_filings=${companionCount}`);
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
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
