# Plan — terminal_ui_ver2_finhub (Frontend)

## EN

### Goal
Implement the following changes using `termina_web/figma_code/terminal_ui_ver2_finhub` as the frontend:
1) Add a **Data Control Window** with:
   - `IBKR Price Data` update button
   - `IBKR Calendar Data` update button
   - Display **last successful update date/time** for each
2) Add a **Default Ticker Window** with:
   - A configurable reference CSV path (default points to `tradigview_screener/original_data/watch lists2_2026-02-22.csv`)
   - Load and show tickers from that CSV
   - Allow adding a ticker via input
   - When a ticker is added, append it to the **last row** of that CSV
3) `/calendar` must use **IBKR calendar data only**
4) Rename UI label from `news feed_brave api` to **`news feed:finhub api`**, and ingest news via **Finnhub API** (not Brave)

### Current repo reality (important, discovered)
- Frontend already has a dedicated window type `brave-news` implemented in:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/BraveNewsWindow.tsx`
  - It currently uses `generateMockData()` (synthetic news) → must be removed (repo policy + requirement).
- Canonical 1D OHLC price store already exists as a single SQLite DB:
  - `OHLC_data/ohlc_1d_watchlist.sqlite`
  - Tables: `ohlc_1d` (PK `(Symbol, Datetime)`), `symbols`
  - Current newest `Datetime` in `ohlc_1d` is `2026-02-20` (verified locally)
- Backend currently serves news from SQLite and has an ingestion endpoint for **EODHD**:
  - `terminal/backend/src/server.ts` exposes `POST /api/news/pull-eodhd` and `GET /api/news`
- Backend calendar ingestion is currently **pure mock generation**:
  - `terminal/backend/src/services/calendarIngestion.ts` inserts rows with `source = "mock_provider"` on an interval.
  - `terminal/backend/src/server.ts` calls `startCalendarIngestionWorkers()` on startup.
  - To satisfy “/calendar = IBKR only”, we must stop this mock generator and clean existing mock rows.

### Constraints / Non-goals
- Do not add extra pages, modals, filters, or “nice-to-have” UX.
- Do not introduce mock/synthetic news data.
- Do not log secrets (API keys/tokens).
- Browser cannot directly write local files; CSV read/append must be done via backend API.

### Process templates (plan changes + step confirmation)

#### Plan change protocol (when the plan must be revised mid-stream)
- Do **not** rewrite or delete prior log entries.
- Record a short revision note and continue with the revised plan.

Template — PLAN CHANGE note (add to chat, and to agent_log.md only if agent_log is being maintained for this plan)
```text
PLAN CHANGE (YYYY-MM-DD)
- Why: <reason>
- What changed: <steps added/removed/reordered>
- Impact: <scope/risks/ETA change>
```

#### Per-step verification + user confirmation (gates “user-confirmed” in logs)
- After each step, include a user-checkable verification procedure (exact command(s) and/or what to inspect).
- If the step has a meaningful checkpoint, explicitly ask the user to confirm completion.
- Logging convention:
  - If user has not confirmed yet: mark as `done (awaiting user confirmation)`.
  - Only after the user explicitly confirms: update to `completed (user-confirmed)`.

Template — step closeout block (chat)
```text
Step N — <title>
- What changed: <files/scope>
- How to verify: <commands / checklist>
- Issues/risks: <issue> → Mitigation options: (1) ... (2) ... (3) ...
- User confirmation needed?: Yes/No (if Yes: please confirm)
```

### High-level architecture
- Frontend (Vite/React) calls backend (Node/TS under `terminal/backend`) APIs.
- Backend owns:
  - IBKR update orchestration (price + calendar)
  - Finnhub news ingestion
  - Ticker CSV read/append with path restrictions
  - “last updated” timestamps persistence

### Decisions / prerequisites (must confirm early)
1) **IBKR integration method**
  - Decide which IBKR interface we will use and how the backend can access it:
    - Option A: IBKR Client Portal Web API (local gateway) over HTTP
    - Option B: TWS/Gateway API (socket-based)
  - Plan assumes the backend can reach an IBKR service from the same machine/VM that runs `terminal/backend`.
2) **IBKR “price data” scope** (minimal definition for v1)
  - Required: update **daily 1D OHLCV** and persist by appending into the existing SQLite DB:
    - `OHLC_data/ohlc_1d_watchlist.sqlite` → table `ohlc_1d`
    - Columns: `Symbol`, `Datetime` (YYYY-MM-DD), `Open`, `High`, `Low`, `Close`, `Volume`
  - “Latest available date” is determined from this DB via `MAX(Datetime)`.
3) **Finnhub API key source**
  - Recommended: environment variable `FINNHUB_API_KEY` loaded via `.env`.
  - Alternative: read from existing file `finhub/finhub_api_key/finhub_api_key` (but still keep it secret and never log it).
4) **News window behavior**
  - Recommended: convert the existing `brave-news` window to Finnhub-backed (and rename UI label).
  - Optional decision: whether to also migrate the existing `news` window (currently pulls EODHD on startup) to Finnhub to avoid multiple sources.

### Mandatory mid-plan verification: “Data availability audit” (IBKR + Finnhub)
This project has UI columns that imply specific data fields (market cap, turnover, earnings calendar fields, etc.). Before committing to implementation, we must confirm what each provider can actually deliver, and what must be computed from OHLC.

Audit deliverables
- A written “capability matrix” mapping each UI column → source (IBKR / Finnhub / computed from `ohlc_1d` / not available).
- A small set of probe scripts/endpoints that return raw samples (for developer verification only; do not expose externally; do not log secrets).

Columns to audit (minimum, based on current UI)
- “News Feed: finhub api” window (currently implemented as `BraveNewsWindow` mock):
  - Table columns: `Date`, `Time`, `Title`, `Sources`, `Changes %`
  - `Changes %` sub-fields rendered inside the cell:
    - `Chg` (1D % change)
    - `fr.Open` (% change from open)
    - `+7D`, `+14D`, `+30D` (% change vs N trading bars ago)
    - Optional line: `Earning: <date>` (next earnings date)
  - Filter UI implies additional per-ticker fields:
    - Market cap (for market-cap presets)
    - Industry (multi-select)
- Calendar window (`/calendar` must be IBKR-only):
  - Earnings tab visible columns:
    - `Date Announcement`, `Time`, `Symbol`, `Session`, `Period`, `Confirmed`, `EPS`, `Est. EPS`, `Surprise %`, `Revenue`, `Est. Revenue`
  - Conference tab visible columns:
    - `Date Announcement`, `Time`, `Symbol`, `Session`, `Confirmed`
  - Dividend tab visible columns:
    - `Date Announcement`, `Time`, `Symbol`, `Session`, `Confirmed`
  - Analyst Rating tab visible columns:
    - `Date Announcement`, `Time`, `Symbol`, `Analyst Firm`, `Analyst Name`, `Action`, `Prior Rating`, `Rating`, `Prior PT`, `Price Target`, `Confirmed`
- Watchlist window (currently mock):
  - Table columns: `Ticker`, `Name`, `Mkt Cap`, `Industry`, `Price`, `Change`, `%`

Working definitions for “Changes %” (to avoid ambiguity)
- Use the latest available trading bar in `ohlc_1d` for the symbol (per-symbol latest `Datetime`).
- `Chg` := $(\frac{Close_t}{Close_{t-1}} - 1) \times 100$
- `fr.Open` := $(\frac{Close_t}{Open_t} - 1) \times 100$
- `+7D/+14D/+30D` := $(\frac{Close_t}{Close_{t-N}} - 1) \times 100$ where $N$ is trading bars (not calendar days).

Draft capability matrix template (fill during audit)

| UI Surface | UI field | Proposed source | Notes / probe |
|---|---|---|---|
| News Feed | Date/Time | Finnhub company news publish time | Confirm timezone and field availability. |
| News Feed | Title | Finnhub |  |
| News Feed | Sources | Finnhub | Confirm field name (`source` or equivalent). |
| News Feed | Ticker | Finnhub (symbol parameter) | News API is usually requested per symbol; confirm. |
| News Feed | Changes: `Chg` / `fr.Open` / `+7D` / `+14D` / `+30D` | Computed from `OHLC_data/ohlc_1d_watchlist.sqlite` (`ohlc_1d`) | Requires Volume+OHLC completeness; define behavior when insufficient history (render `-`). |
| News Feed | Earning date line | Finnhub earnings/calendar (preferred) | If unavailable, do **not** fake; render nothing. |
| News Feed | Market cap | Finnhub company profile (preferred) | Confirm units; store numeric USD and format. |
| News Feed | Industry | Finnhub company profile (preferred) | Confirm field (`finnhubIndustry` or similar). |
| Calendar | Earnings fields (EPS/Revenue/etc.) | IBKR (TBD) | Highest risk: verify IBKR actually provides these fields; if not, stop for decision. |
| Calendar | Conference/Dividend | IBKR (TBD) | Verify event types/fields exist in IBKR APIs. |
| Calendar | Analyst rating fields | IBKR (TBD) | Very likely not available via IBKR; must be confirmed. |
| Watchlist | Price/Change/% | Computed from `ohlc_1d` latest close vs prior close | Also needs backfill of derived metrics for latest rows. |
| Watchlist | Name/Mkt Cap/Industry | Finnhub company profile (preferred) | If unavailable, show `-` (real “unknown”), not fake. |

Probe approach (implementation guidance)
- Finnhub probes (backend-only):
  - Confirm which endpoints/fields are available for: company profile (market cap), candles (OHLCV), earnings calendar/earnings dates, and company news.
  - Validate rate limits and date ranges (how far back you can pull, and whether intraday is needed).
- IBKR probes (TWS/IB Gateway):
  - Confirm that daily OHLCV can be fetched reliably for your symbol universe.
  - Confirm whether “calendar” data exists in IBKR APIs in a way that matches UI requirements; if not, explicitly document the gap.

Fail-fast rules
- Do not implement UI columns with fake placeholders.
- If a required column cannot be sourced or computed with available data, record it in the capability matrix and stop for a user decision.

### Proposed implementation order (rationale)
IBKR integration is the highest-uncertainty dependency; CSV + Finnhub are lower risk and unblock visible progress. So the order below:
0) Data availability audit (IBKR + Finnhub vs UI columns)
1) Foundations (DB table + status API)
2) Default Ticker CSV APIs + window
3) Finnhub ingestion + migrate “news feed” window (and remove mock)
4) IBKR calendar + price update endpoints + Data Control window
5) Cleanup + tests

### Step-by-step plan (implement → verify each step)

#### Step 0 — Data availability audit (IBKR + Finnhub vs UI columns)
Purpose (why this step exists)
- This project’s UI tables imply specific fields (market cap, industry, earnings fields, analyst ratings, etc.). Before we implement UI or DB schemas, we must confirm which fields are actually obtainable from IBKR/Finnhub, and which can be computed from the existing 1D OHLC DB.
- This is a **fail-fast guardrail**: if a required field is not available, we stop and decide rather than shipping “fake” placeholders.

Companion doc / probes
- Audit checklist + matrix template: ai_agent_plan/terminal_ui_ver2_finhub/test/test_data_availability_audit.md
- Finnhub raw-response probe script: terminal/backend/test_finnhub_probe.mjs (writes to `tmp/probes/`)

What we do (concrete)
- Create a capability matrix: each UI column → one of:
  - **Finnhub** (directly provided)
  - **IBKR** (directly provided)
  - **Computed from OHLC** (derived from `OHLC_data/ohlc_1d_watchlist.sqlite`)
  - **Not available** (must remove the UI field OR switch provider OR accept blank/`-`)
- Run small “probes” for a few symbols (e.g., AAPL/MSFT/TSLA) and save raw samples (JSON) so results are reproducible.

Probe output handling (repo hygiene)
- Do **not** log or print API keys/tokens.
- Probe scripts/endpoints must be developer-only (not exposed publicly) and should store raw samples under a short path (e.g., `tmp/`) to avoid Windows path length issues.

Stop conditions (explicit)
- If IBKR cannot provide the calendar fields required by the `/calendar` UI (especially EPS/Revenue and analyst rating), document the gap in the matrix and stop for a decision.
- If Finnhub rate limits or available date ranges make the news ingestion impractical, stop for a decision.

Deliverables
- Fill the capability matrix above with definitive “Yes/No/Computed” outcomes.
- Produce probe outputs (raw JSON samples) for a small set of symbols (e.g., AAPL, MSFT, TSLA) to confirm:
  - Finnhub company news fields, company profile fields (market cap, industry), and next earnings date availability.
  - IBKR daily OHLCV retrieval works end-to-end (connection + pacing + permissions).
  - IBKR calendar capability for the UI-required fields (earnings EPS/revenue and analyst rating in particular).

Verification
- Written matrix is complete for every UI column listed above.
- Probes are reproducible without leaking secrets (no API keys in logs).

#### Step 1 — Foundations: update status storage + API
Purpose
- Provide a persistent “last successful update” timestamp per data source (CSV tickers, Finnhub news, IBKR calendar, IBKR OHLC).
- Enable the Data Control Window (Step 8) to display stable, restart-safe status.

What “status persists after restart” means
- The status must be stored in SQLite (or the backend’s existing persistent DB), not in process memory.
- After stopping and restarting the backend process, `GET /api/updates/status` must return the same `last_success_at` values as before the restart.

Source keys (stable identifiers)
- Use a small fixed set of keys so the frontend can rely on them:
  - `tickers_csv`
  - `finhub_news`
  - `ibkr_calendar`
  - `ibkr_ohlc_1d`

API contract (draft)
- `GET /api/updates/status` → returns a stable JSON object such as:
  - `{ "sources": { "tickers_csv": { "lastSuccessAt": "...", "details": {..} }, ... } }`
- If a key has never succeeded yet, return `null` for `lastSuccessAt` (do not fabricate values).

Backend files:
- `terminal/backend/src/db.ts`
  - Add table `update_status` (or similar) to persist per-source timestamps.
    - Suggested schema:
      - `source_key TEXT PRIMARY KEY` (e.g., `ibkr_ohlc_1d`, `ibkr_calendar`, `finhub_news`, `tickers_csv`)
      - `last_success_at TEXT` (ISO string)
      - `details_json TEXT NOT NULL DEFAULT '{}'`
      - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
- Add service `terminal/backend/src/services/updateStatusRepository.ts` with:
  - `getUpdateStatus(sourceKey)` / `listUpdateStatuses()`
  - `setLastSuccess(sourceKey, isoTimestamp, details?)`
- `terminal/backend/src/server.ts`
  - Add `GET /api/updates/status` returning a stable JSON structure.

Verification
- Restart backend → `GET /api/updates/status` returns defaults and persists after update.

#### Step 2 — Default ticker CSV: read + append APIs (backend)
Purpose
- The browser cannot directly read/write local files. Therefore the backend must own:
  - reading tickers from a CSV path
  - appending a new ticker to the **last row** of that CSV
- This enables the Default Ticker Window (Step 3).

Security constraints (must-have)
- Restrict `csvPath` to a safe allowlisted root (initially `tradigview_screener/original_data/`).
- Reject non-`.csv` paths.
- Normalize the ticker (`trim` + `uppercase`) and validate allowed characters (e.g., `[A-Z0-9.\-]`).
- Do not allow `..` path traversal.

“Append to last row” definition
- When adding a ticker, write it as a new line at the end of the file (i.e., add a row).
- If the file has headers, preserve them.
- If the file is empty/unreadable, fail with a clear error (do not create mock content).

Concurrency / robustness
- Use atomic write: write to temp file → replace original.
- Retry file replace on Windows transient errors (`EBUSY`/`EPERM`) with short backoff.

API contract (draft)
- `GET /api/tickers?csvPath=...` → `{ csvPath, tickers: ["AAPL", "MSFT", ...] }`
- `POST /api/tickers/add` body `{ csvPath, ticker }` → `{ csvPath, tickerAdded, tickers }` (or similar)

Backend files:
- Add service `terminal/backend/src/services/tickerCsvService.ts`
  - `readTickersFromCsv(csvPath)`
  - `appendTickerToCsv(csvPath, ticker)`
  - Enforce restrictions:
    - Allowed root: `tradigview_screener/original_data/`
    - Must be `.csv`
    - Normalize ticker (trim + uppercase)
    - Duplicate policy: default reject duplicates
    - Atomic write (temp file then `rename/replace`) + retry on `EBUSY/EPERM`
- `terminal/backend/src/server.ts`
  - `GET /api/tickers?csvPath=...`
  - `POST /api/tickers/add` body `{ csvPath, ticker }`
  - On success, update `update_status` for `tickers_csv`.

Verification
- Calling add endpoint appends a new last row and `GET /api/tickers` reflects it.

#### Step 3 — Default Ticker Window (frontend)
Purpose
- Provide a small UI to view and edit the “default ticker list” stored in a CSV file.
- The window is just a thin client: it calls the backend APIs from Step 2.

UI behavior (minimal and explicit)
- CSV Path input:
  - default value: `tradigview_screener/original_data/watch lists2_2026-02-22.csv`
  - user can edit it, but backend enforces allowlist restrictions
- Reload button:
  - calls `GET /api/tickers` and refreshes the list
- Add ticker:
  - user enters a ticker and clicks Add
  - frontend calls `POST /api/tickers/add`
  - on success, refresh list (either from response or by reloading)

Error handling
- If the backend rejects the path or ticker, show a simple error message in the window (no extra modals).

Frontend files:
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`
  - Add window type `default-ticker`.
- Add component `src/app/components/DefaultTickerWindow.tsx`
  - UI: editable CSV path + Reload button + list + Add ticker input/button.
  - Calls backend endpoints from Step 2.
- Wire window:
  - `src/app/components/DraggableWindow.tsx` → render for `default-ticker`.
  - `src/app/components/AddTabModal.tsx` → add checkbox label “Default Ticker”.
  - `src/app/App.tsx` → set window title “Default Ticker”.

Verification
- Add a ticker from UI → backend call succeeds → list updates.

#### Step 4 — Finnhub ingestion (backend)
Purpose
- Replace any Brave/mock news ingestion with a real provider: Finnhub.
- Backend fetches news and stores it into the existing `news_items` table so the frontend can query it consistently.

Secrets handling
- Load Finnhub API key from `FINNHUB_API_KEY` (preferred) or the existing file fallback.
- Never log the API key or full request URL if it contains secrets.

Idempotency / duplication
- The provider should avoid inserting duplicates when pulling overlapping date ranges.
- If the DB schema supports a unique key (e.g., `(source, url)`), use it. Otherwise implement a best-effort de-dup at insert time.

API contract (draft)
- `POST /api/news/pull-finhub` triggers ingestion and returns a small summary:
  - `{ inserted: <n>, skipped: <n>, source: "FINNHUB" }`
- `GET /api/news?source_names=FINNHUB` returns stored items.

Backend files:
- `terminal/backend/src/config.ts`
  - Add `finnhubApiKey` (from `process.env.FINNHUB_API_KEY` or file fallback).
- Add provider `terminal/backend/src/services/finnhubNewsProvider.ts`
  - Fetch news from Finnhub and map into the existing `insertNewsItem()` contract.
  - Set `source = 'FINNHUB'` and `source_type = 'finhub_api'` (or a consistent key used by frontend filtering).
- `terminal/backend/src/server.ts`
  - Add `POST /api/news/pull-finhub` (mirrors existing `/api/news/pull-eodhd` shape but uses Finnhub).
  - Update `update_status` for `finhub_news` on success.

Verification
- Ingestion endpoint inserts rows into `news_items` and `GET /api/news?source_names=FINNHUB` returns them.

#### Step 5 — Migrate “News Feed: Brave API” → “News Feed: finhub api” (frontend)
Purpose
- Remove synthetic/mock “Brave News” UI and rewire it to the backend’s Finnhub-backed news.
- Ensure the label is exactly `News Feed: finhub api` and the UI no longer implies Brave is used.

Non-negotiables (policy + requirement)
- Remove `generateMockData()` and any seeded/synthetic rows.
- If a field is missing (e.g., earnings date), render nothing or `-` (do not fake values).

Data flow
- Frontend reads news from backend: `GET /api/news?source_names=FINNHUB`.
- Optional in-window button to trigger ingestion: `POST /api/news/pull-finhub`.

Frontend files:
- Replace `brave-news` window type with `finhub-news` (or rename but keep consistent):
  - `src/app/types.ts`:
    - `WindowType` remove `brave-news`, add `finhub-news`
    - Replace `BraveNews*` types with `FinnhubNews*` (or re-use `NewsItem` if possible)
- `src/app/components/AddTabModal.tsx`
  - Label: change to exactly `News Feed: finhub api`
  - Toggle window type `finhub-news`
- `src/app/App.tsx`
  - Title mapping: `finhub-news` → `News Feed: finhub api`
- `src/app/components/DraggableWindow.tsx`
  - Render `FinnhubNewsWindow` for `finhub-news`
- `src/app/components/BraveNewsWindow.tsx`
  - Rename to `FinnhubNewsWindow.tsx` (recommended) OR keep filename but change component name.
  - **Remove `generateMockData()`** and any seeded synthetic items.
  - Implement real fetch from backend:
    - Option A: call `POST /api/news/pull-finhub` on demand
    - Option B (recommended): only render from `GET /api/news` and provide a manual “Update” button inside the window
  - Ensure the UI no longer implies Brave is used.

Verification
- No synthetic generation remains.
- “News Feed: finhub api” window shows Finnhub-backed items only.

#### Step 6 — IBKR calendar ingestion (backend) + stop mock calendar generator
Purpose
- Enforce the product rule: `/calendar` must use **IBKR calendar data only**.
- Stop the current mock generator so the DB does not keep filling with `mock_provider` rows.

Behavior change summary
- Before: calendar events are generated automatically on backend startup (mock).
- After: calendar events are updated only when an explicit endpoint is called, and only IBKR-sourced rows remain.

Cleanup rule (important)
- On first successful IBKR calendar update, delete existing `calendar_events` rows where `source = 'mock_provider'`.
- This ensures `/api/calendar/events` returns IBKR-only without requiring a manual DB reset.

API contract (draft)
- `POST /api/ibkr/calendar/update` triggers a pull+upsert and returns a summary:
  - `{ upserted: <n>, deletedMockRows: <n>, source: "IBKR" }`

Backend files:
- `terminal/backend/src/services/calendarIngestion.ts`
  - Remove mock workers entirely.
  - Replace with `pullIbkrCalendar()` service called only by an explicit endpoint.
- `terminal/backend/src/server.ts`
  - Remove `startCalendarIngestionWorkers()` startup call.
  - Add `POST /api/ibkr/calendar/update`:
    - Fetch IBKR calendar events
    - Upsert into `calendar_events` via `upsertCalendarEvent()` with `source = 'IBKR'`
    - Update `update_status` for `ibkr_calendar` on success.
- Cleanup existing mock calendar rows:
  - On successful first IBKR calendar update, delete `calendar_events` where `source = 'mock_provider'`.
    - This is required so `/api/calendar/events` returns IBKR-only data.

Verification
- After update, `/api/calendar/events` shows only `source = IBKR`.

#### Step 7 — IBKR 1D OHLC ingestion into `ohlc_1d_watchlist.sqlite` (backend)
Purpose
- Implement “IBKR Price Data update” as a backend operation that:
  1) reads tickers (from the Default Ticker CSV)
  2) fetches missing **daily (1D) OHLCV** bars from IBKR
  3) upserts into the existing canonical SQLite DB `OHLC_data/ohlc_1d_watchlist.sqlite`
  4) computes derived % change fields needed by the News Feed UI

Date range rule (minimal, incremental)
- Determine current DB max date: `MAX(Datetime)`.
- Pull from `(maxDate + 1 trading day)` to “today (NY)” (or IBKR’s latest available).
- If there is no new data, return a summary that indicates “no-op” (do not treat as an error).

Derived metrics correctness (why we store them)
- News Feed displays multiple change fields (`Chg`, `fr.Open`, `+7D`, `+14D`, `+30D`).
- These must be computed from OHLC (not mocked). Store them per `(Symbol, Datetime)` so the frontend can render consistently.

API contract (draft)
- `GET /api/ibkr/ohlc1d/status` returns:
  - `{ dbPath, overallMaxDate, lastSuccessAt }`
- `POST /api/ibkr/ohlc1d/update` returns a summary:
  - `{ tickersRequested, tickersUpdated, rowsUpserted, overallMaxDateBefore, overallMaxDateAfter }`

Backend goal
- “IBKR Price Data” means: fetch **1D OHLCV** for each ticker and append into:
  - `OHLC_data/ohlc_1d_watchlist.sqlite` table `ohlc_1d` (PK `(Symbol, Datetime)`)

Also required (derived columns used by News Feed)
- During the same “price update” process, compute and persist derived metrics from OHLC into **additional columns** on `ohlc_1d`.
- These are displayed in the News Feed window (e.g., day change, change-from-open%, +7d, etc.), so the backend must compute them (no fake/UI-only).

Proposed new columns (stored per Symbol+Datetime)
- `Change_1d_Pct` : close-to-previous-close percent change
- `Change_From_Open_Pct` : (Close / Open - 1) * 100
- `Change_7d_Pct` : (Close / Close[t-7 trading bars] - 1) * 100
- `Change_14d_Pct` : (Close / Close[t-14 trading bars] - 1) * 100
- `Change_30d_Pct` : (Close / Close[t-30 trading bars] - 1) * 100
- `Derived_Updated_At` : ISO timestamp when derived columns were last computed for this row (optional but recommended for debugging)

Backend files
- Add service `terminal/backend/src/services/ohlcWatchlistRepository.ts`
  - Opens `OHLC_data/ohlc_1d_watchlist.sqlite` (path fixed or env-configured but default to this exact file)
  - `getOverallMaxDate()` → returns `MAX(Datetime)`
  - `getSymbolMaxDate(symbol)` (optional)
  - `upsertBars(symbol, bars)` using `INSERT ... ON CONFLICT(Symbol, Datetime) DO UPDATE` (or ignore)
  - Add migration helper `ensureDerivedColumns()` that runs `ALTER TABLE ohlc_1d ADD COLUMN ...` for each missing derived column.
- Add service `terminal/backend/src/services/ibkrOhlc1dProvider.ts`
  - Pulls daily bars from IBKR for a symbol in a date range.
  - Range rule (minimal): start from `MAX(Datetime) + 1 day` and go to “today (NY)”.
- Add derived calculator `terminal/backend/src/services/ohlcDerivedMetrics.ts`
  - For a given symbol/date range, loads the necessary historical window (>= 30 prior trading bars) from `ohlc_1d` and writes derived columns back.
  - Incremental correctness rule: when new bars arrive for a symbol, recompute derived metrics for a safety window:
    - from `(min_new_date - 40 trading bars)` to `max_new_date` (to cover 7/14/30 trading-day lookbacks).
- `terminal/backend/src/server.ts`
  - Add `GET /api/ibkr/ohlc1d/status` returning:
    - `dbPath`, `overallMaxDate`, and `lastSuccessAt` (from `update_status`)
  - Add `POST /api/ibkr/ohlc1d/update`:
    - Read tickers from the configured CSV (reuse tickerCsvService)
    - Fetch missing 1D bars per ticker and upsert into `ohlc_1d`
    - Recompute and persist derived columns for affected symbols/dates
    - Update `update_status` key `ibkr_ohlc_1d` with details `{ overallMaxDate, tickersUpdated, rowsUpserted }`

Verification
- `GET /api/ibkr/ohlc1d/status` reflects the DB’s `MAX(Datetime)`.
- After update, `MAX(Datetime)` advances (when new market days exist).
- Spot-check a few rows in `ohlc_1d` to confirm derived columns are filled (not all NULL) for recent dates.

#### Step 8 — Data Control Window (frontend)
Purpose
- Provide a minimal “operations” window to manually run backend updates and confirm freshness.
- Show per-source last success timestamps from Step 1.

UI behavior (minimal)
- Two buttons:
  - `IBKR Price Data` → calls `POST /api/ibkr/ohlc1d/update`
  - `IBKR Calendar Data` → calls `POST /api/ibkr/calendar/update`
- Read-only status fields:
  - last success timestamp for each source
  - latest OHLC DB date (from `GET /api/ibkr/ohlc1d/status`)

Loading/error states
- While an update is running, disable the clicked button and show a simple “Running…” text.
- On error, show a short error message in-window (no extra modal).

Frontend files:
- `src/app/types.ts` add window type `data-control`.
- Add `src/app/components/DataControlWindow.tsx`:
  - Two sections:
    - IBKR Price Data (OHLC 1D): Update button + last updated text + latest DB date
    - IBKR Calendar Data: Update button + last updated text
  - On load: `GET /api/updates/status`
  - On click:
    - Price: `POST /api/ibkr/ohlc1d/update`
    - Calendar: `POST /api/ibkr/calendar/update`
    - Refresh both `GET /api/updates/status` and `GET /api/ibkr/ohlc1d/status`.
- Wire in:
  - `AddTabModal.tsx` add checkbox
  - `App.tsx` title mapping
  - `DraggableWindow.tsx` render switch

Verification
- Buttons call endpoints; timestamps update on success.

#### Step 9 — Tests / acceptance checks (minimal but real)
Purpose
- Ensure the foundational APIs are correct, and we don’t regress on safety constraints (path restrictions, persistence, no mock data).

Backend test focus
- `update_status` persistence: set → restart-simulated reload → same value returned.
- CSV path allowlist: rejects paths outside `tradigview_screener/original_data/`.
- CSV append: new ticker appears at end, duplicates rejected (default).
- Finnhub mapping: required fields are present; no API key leakage.
- Calendar cleanup: mock rows removed after successful IBKR update.

Backend tests to add under `terminal/backend/tests/`:
- tickerCsvService: read/append/path restriction
- updateStatusRepository: set/get
- finnhubNewsProvider mapping (shape validation)
- calendar mock cleanup (deletes mock_provider rows)

Frontend smoke checks:
- Windows render and call APIs (manual QA is acceptable if no FE test runner exists).

Verification
- `npm run test` for backend passes for touched areas.

### Open questions (need explicit decisions if behavior must differ)
1) CSV format: which column contains the ticker?
2) Duplicates: append duplicates or reject?
3) Path restrictions: only `tradigview_screener/original_data/*.csv` or broader?
4) Keep `News` window as EODHD, or migrate it to Finnhub too?

---

## KO

### 목표
프론트는 `termina_web/figma_code/terminal_ui_ver2_finhub`를 기준으로 아래를 구현한다.
1) **Data Control Window** 추가
   - `IBKR Price Data` 업데이트 버튼
   - `IBKR Calendar Data` 업데이트 버튼
   - 각 항목의 **마지막 성공 업데이트 날짜/시각 표시**
2) **Default Ticker Window** 추가
   - 참조 CSV 경로를 UI에서 수정 가능하게 제공
   - 기본 참조 CSV는 `tradigview_screener/original_data/watch lists2_2026-02-22.csv`
   - CSV에서 티커 목록 로드/표시
   - 티커 입력 후 추가 가능
   - 추가 시 CSV **마지막 행에 append**
3) `/calendar`는 **IBKR 캘린더 데이터만** 사용
4) `news feed_brave api` 표기를 **`news feed:finhub api`**로 변경하고, 뉴스는 **Finnhub API**로 수집/표시(Brave 기반은 사용하지 않음)

### 현재 레포 상태(중요, 확인됨)
- 프론트에는 이미 `brave-news` 윈도우 타입이 존재하며 구현 파일은 아래와 같다.
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/BraveNewsWindow.tsx`
  - 현재 `generateMockData()`로 synthetic 뉴스 데이터를 생성함 → 정책/요구사항상 제거가 필요.
- 1D OHLC 가격 데이터의 단일 저장소(SQLite)가 이미 존재한다.
  - `OHLC_data/ohlc_1d_watchlist.sqlite`
  - 테이블: `ohlc_1d`(PK `(Symbol, Datetime)`), `symbols`
  - `ohlc_1d`의 최신 `Datetime`은 현재 `2026-02-20`까지 들어있음(로컬에서 확인됨)
- 백엔드는 SQLite에서 뉴스를 제공하며, EODHD 인제션 엔드포인트가 존재한다.
  - `terminal/backend/src/server.ts`: `POST /api/news/pull-eodhd`, `GET /api/news`
- 백엔드 캘린더 인제션은 현재 **완전 mock 생성**이다.
  - `terminal/backend/src/services/calendarIngestion.ts`가 `source = "mock_provider"` 이벤트를 주기적으로 insert.
  - `terminal/backend/src/server.ts`에서 `startCalendarIngestionWorkers()`를 startup에 호출.
  - “/calendar = IBKR only”를 만족하려면 mock 생성기를 중지하고, 기존 mock row도 정리해야 한다.

### 제약 / 비범위
- 요구된 UX 외에 추가 페이지/모달/필터/애니메이션 등은 만들지 않는다.
- mock/가짜 뉴스 데이터는 추가하지 않는다.
- 시크릿(API 키/토큰)은 로그에 남기지 않는다.
- 브라우저에서 로컬 파일 직접 쓰기 불가 → CSV 읽기/append는 백엔드 API가 담당한다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

#### plan 중간 변경 프로토콜(리비전)
- 이미 기록된 로그를 재작성하거나 삭제하지 않는다.
- 변경 사유와 영향을 짧게 기록하고, 새 plan 기준으로 진행한다.

템플릿 — PLAN CHANGE 노트(채팅에 추가, agent_log를 작성 중일 때만 agent_log.md에도 같이 추가)
```text
PLAN CHANGE (YYYY-MM-DD)
- 왜: <사유>
- 무엇이 바뀌었나: <추가/삭제/순서 변경된 step>
- 영향: <범위/리스크/예상 일정 변경>
```

#### 단계별 검증 + 사용자 확인(로그 user-confirmed의 조건)
- 각 단계 완료 후에는 사용자가 직접 확인할 수 있는 검증 절차를 반드시 포함한다(정확한 명령어, 또는 무엇을 봐야 하는지).
- 해당 단계에 명확한 체크포인트가 있으면, 사용자에게 완료 확인을 명시적으로 요청한다.
- 로그 표기 규칙:
  - 사용자 확인 전: `done (awaiting user confirmation)`
  - 사용자가 명시적으로 확인한 후: `completed (user-confirmed)`로 업데이트

템플릿 — 단계 마감 부분(채팅)
```text
Step N — <제목>
- 변경 내용: <변경 파일/영역>
- 검증 방법: <명령어 / 체크리스트>
- 문제점/리스크: <문제> → 완화 방안: (1) ... (2) ... (3) ...
- 사용자 확인 필요?: Yes/No (Yes이면: 완료 확인 부탁)
```

### 아키텍처(상위)
- 프론트(Vite/React)가 백엔드(Node/TS, `terminal/backend`) API 호출.
- 백엔드는 다음을 책임진다.
  - IBKR 업데이트(가격 + 캘린더)
  - Finnhub 뉴스 수집
  - 티커 CSV read/append + 경로 제한(보안)
  - last updated 시각 저장/조회

### 결정/선행조건(초기에 확정 필요)
1) **IBKR 연동 방식**
   - 백엔드가 어떤 방식으로 IBKR에 접근할지 확정 필요:
     - 옵션 A: IBKR Client Portal Web API(로컬 게이트웨이) HTTP
     - 옵션 B: TWS/Gateway API(소켓)
2) **IBKR “price data” 범위(v1 최소 정의)**
  - 필수: **일봉(1D) OHLCV**를 받아 기존 SQLite DB에 “이어서 append 저장”한다.
    - 저장 파일: `OHLC_data/ohlc_1d_watchlist.sqlite`
    - 테이블/컬럼: `ohlc_1d(Symbol, Datetime, Open, High, Low, Close, Volume)`
    - 최신 데이터 date 확인은 이 DB의 `MAX(Datetime)`로 한다.
3) **Finnhub API 키 제공 방식**
   - 권장: `.env`의 `FINNHUB_API_KEY`.
   - 대안: `finhub/finhub_api_key/finhub_api_key` 파일에서 읽기(시크릿 로그 금지).
4) **뉴스 윈도우 정책**
   - 권장: 기존 `brave-news`를 Finnhub 기반으로 교체 + 라벨 변경.
   - 선택: 기존 `news` 윈도우(EODHD 자동 pull 포함)도 Finnhub로 같이 옮길지 여부.

### 계획 중간 필수 확인: “데이터 수집 가능 범위 점검(감사)” (IBKR + Finnhub)
UI 컬럼이 요구하는 데이터(예: market cap, turnover, earnings calendar 필드 등)가 실제로 IBKR/Finnhub에서 제공되는지, 또는 OHLC로 계산 가능한지 구현 전에 확인해야 한다.

점검 산출물
- “capability matrix(가능 범위 매트릭스)” 문서: 각 UI 컬럼 → 데이터 소스(IBKR / Finnhub / `ohlc_1d`로 계산 / 불가)를 명확히 매핑
- 원시 샘플을 확인할 수 있는 최소 probe 스크립트/엔드포인트(개발자 확인용)
  - 외부 노출 금지, 시크릿 로그 금지

점검 대상 컬럼(최소, 현재 UI 기준)
- “News Feed: finhub api” 윈도우(현재 `BraveNewsWindow`가 mock으로 구현된 부분):
  - 표 컬럼: `Date`, `Time`, `Title`, `Sources`, `Changes %`
  - `Changes %` 셀 내부에 렌더되는 하위 항목:
    - `Chg` (1D % change)
    - `fr.Open` (오픈 대비 % change)
    - `+7D`, `+14D`, `+30D` (N 거래일(트레이딩 바) 전 대비 % change)
    - 선택 라인: `Earning: <date>` (다음 실적 발표일)
  - 필터 UI가 암시하는 추가 필드:
    - Market cap(시가총액, market-cap preset용)
    - Industry(산업, multi-select)
- Calendar window (`/calendar`는 IBKR-only 요구사항):
  - Earnings 탭(표에 기본으로 보이는 컬럼):
    - `Date Announcement`, `Time`, `Symbol`, `Session`, `Period`, `Confirmed`, `EPS`, `Est. EPS`, `Surprise %`, `Revenue`, `Est. Revenue`
  - Conference 탭(표에 기본으로 보이는 컬럼):
    - `Date Announcement`, `Time`, `Symbol`, `Session`, `Confirmed`
  - Dividend 탭(표에 기본으로 보이는 컬럼):
    - `Date Announcement`, `Time`, `Symbol`, `Session`, `Confirmed`
  - Analyst Rating 탭(표에 기본으로 보이는 컬럼):
    - `Date Announcement`, `Time`, `Symbol`, `Analyst Firm`, `Analyst Name`, `Action`, `Prior Rating`, `Rating`, `Prior PT`, `Price Target`, `Confirmed`
- Watchlist 윈도우(현재 mock):
  - 표 컬럼: `Ticker`, `Name`, `Mkt Cap`, `Industry`, `Price`, `Change`, `%`

“Changes %” 동작 정의(모호성 제거)
- 심볼별로 `ohlc_1d`에서 최신 `Datetime`(심볼별 latest bar)을 기준으로 계산한다.
- `Chg` := $(\frac{Close_t}{Close_{t-1}} - 1) \times 100$
- `fr.Open` := $(\frac{Close_t}{Open_t} - 1) \times 100$
- `+7D/+14D/+30D` := $(\frac{Close_t}{Close_{t-N}} - 1) \times 100$ (여기서 $N$은 캘린더일이 아니라 트레이딩 바 기준)

capability matrix 초안 템플릿(감사 단계에서 채움)

| UI 영역 | UI 필드 | 제안 소스 | 비고/프로브 |
|---|---|---|---|
| News Feed | Date/Time | Finnhub company news publish time | timezone/필드 가용성 확인 필요 |
| News Feed | Title | Finnhub |  |
| News Feed | Sources | Finnhub | 필드명(`source` 등) 확인 |
| News Feed | Ticker | Finnhub(심볼 파라미터) | 보통 심볼별로 요청; 실제 동작 확인 |
| News Feed | Changes: `Chg` / `fr.Open` / `+7D` / `+14D` / `+30D` | `OHLC_data/ohlc_1d_watchlist.sqlite`의 `ohlc_1d` 기반 계산 | 히스토리 부족 시 `-`로 렌더(가짜 금지) |
| News Feed | Earning date 라인 | Finnhub earnings/calendar(우선) | 불가하면 렌더하지 않음(가짜 금지) |
| News Feed | Market cap | Finnhub company profile(우선) | 단위 확인, numeric USD 저장 + 포맷 |
| News Feed | Industry | Finnhub company profile(우선) | 필드(`finnhubIndustry` 등) 확인 |
| Calendar | Earnings(EPS/Revenue 등) | IBKR (미확정) | 가장 리스크 큼: 제공 안 되면 즉시 의사결정 필요 |
| Calendar | Conference/Dividend | IBKR (미확정) | 이벤트 타입/필드 존재 여부 확인 |
| Calendar | Analyst rating 필드 | IBKR (미확정) | IBKR에 없을 가능성 큼(반드시 확인) |
| Watchlist | Price/Change/% | `ohlc_1d` 최신 close vs 이전 close로 계산 | 최신 rows에 derived metrics backfill 필요 |
| Watchlist | Name/Mkt Cap/Industry | Finnhub company profile(우선) | 불가하면 `-` 표시(진짜 unknown), 가짜 금지 |

프로빙 접근(구현 가이드)
- Finnhub 프로브(백엔드에서만):
  - company profile(시장가치), candles(OHLCV), earnings calendar/earnings date, company news의 필드/기간/레이트리밋을 확인
- IBKR 프로브(TWS/IB Gateway):
  - 일봉 OHLCV 수집 신뢰성 확인(심볼 범위/기간)
  - IBKR “캘린더” 데이터가 UI 요구사항에 맞게 존재하는지 확인하고, 없으면 gap을 명시

Fail-fast 규칙
- UI 컬럼에 fake placeholder를 넣지 않는다.
- 필수 컬럼이 소싱/계산 불가능하면 capability matrix에 기록하고 사용자 결정 없이는 진행하지 않는다.

### 제안하는 구현 순서(이유)
IBKR 연동이 가장 불확실(환경/자격증명/게이트웨이 의존)이므로, 먼저 DB/CSV/Finnhub 같은 저위험 요소로 기반을 만들고, IBKR는 별도 단계로 분리한다.
0) 데이터 수집 가능 범위 점검(IBKR + Finnhub vs UI 컬럼)
1) 기반(DB + status API)
2) Default Ticker CSV API + 윈도우
3) Finnhub 인제션 + “News Feed” 윈도우를 Finnhub로 교체(그리고 mock 제거)
4) IBKR 캘린더 + 가격 업데이트 엔드포인트 + Data Control 윈도우
5) mock 정리 + 테스트

### 단계별 계획(각 단계: 구현 → 검증)

#### 0단계 — 데이터 수집 가능 범위 점검(감사) (IBKR + Finnhub vs UI 컬럼)
목적(왜 먼저 하는가)
- 이 프로젝트 UI 테이블은 market cap, industry, earnings 필드, analyst rating 등 특정 데이터를 “당연히 존재하는 것처럼” 전제한다. 구현에 들어가기 전에 IBKR/Finnhub가 실제로 제공하는지, 혹은 기존 1D OHLC DB로 계산 가능한지 확정해야 한다.
- 이 단계는 **fail-fast 가드레일**이다. 필수 필드가 불가능하면 즉시 멈추고 의사결정을 해야 하며, UI에 가짜 placeholder를 넣지 않는다.

참조 문서 / 프로브
- 감사 체크리스트 + 매트릭스 템플릿: ai_agent_plan/terminal_ui_ver2_finhub/test/test_data_availability_audit.md
- Finnhub 원시 응답 프로브 스크립트: terminal/backend/test_finnhub_probe.mjs (`tmp/probes/`에 저장)

무엇을 하는가(구체)
- capability matrix(가능 범위 매트릭스)를 작성한다: 각 UI 컬럼 → 아래 중 하나로 확정
  - **Finnhub 제공**
  - **IBKR 제공**
  - **OHLC에서 계산** (`OHLC_data/ohlc_1d_watchlist.sqlite` 기반)
  - **불가**(UI 필드 제거/대체 공급자/빈 값 `-` 허용 중 택1)
- 소수 심볼(AAPL/MSFT/TSLA 등)로 “프로브”를 실행하고 원시 샘플(JSON)을 저장해 재현 가능하게 만든다.

프로브 산출물 처리(레포 위생)
- API 키/토큰은 로그/출력에 절대 찍지 않는다.
- 원시 샘플은 Windows 경로 길이 이슈를 피하기 위해 짧은 경로(예: `tmp/`)에 저장한다.

중단 조건(명시)
- IBKR이 `/calendar` UI가 요구하는 핵심 필드(특히 EPS/Revenue, analyst rating)를 제공하지 못하면 매트릭스에 갭을 기록하고 사용자 결정을 받기 전까지 진행하지 않는다.
- Finnhub의 레이트리밋/기간 제약으로 뉴스 수집이 현실적으로 어렵다면 진행을 멈추고 대안을 결정한다.

산출물
- 위 capability matrix를 “각 UI 컬럼마다” Yes/No/Computed로 확정해 채운다.
- 소수 심볼(AAPL/MSFT/TSLA 등)로 프로브를 실행해 원시 JSON 샘플을 확보한다.
  - Finnhub: company news 필드, company profile(시총/산업), next earnings date 가용성
  - IBKR: 일봉 OHLCV end-to-end(연결/권한/페이싱)
  - IBKR: UI가 요구하는 캘린더 필드(특히 EPS/Revenue/Analyst Rating) 제공 여부

검증
- capability matrix가 위에 나열된 “모든 UI 컬럼”을 빠짐없이 커버한다.
- 시크릿이 로그에 찍히지 않고(키/토큰), 동일 조건에서 재현 가능하다.

#### 1단계 — 기반: update status 저장 + API
목적
- 데이터 소스별(CSV tickers, Finnhub news, IBKR calendar, IBKR OHLC) “마지막 성공 업데이트 시각”을 **영구 저장**한다.
- Data Control Window(8단계)에서 재시작과 무관하게 동일한 상태를 표시할 수 있게 한다.

“백엔드 재시작 후에도 status가 유지된다”의 의미
- status는 서버 메모리(변수)가 아니라 SQLite(또는 백엔드의 영구 DB)에 저장되어야 한다.
- 백엔드 프로세스를 중지/재시작한 뒤에도 `GET /api/updates/status`가 동일한 `last_success_at` 값을 반환해야 한다.

source key(프론트가 의존할 안정 키)
- 프론트가 안정적으로 매핑할 수 있도록 소수의 고정 키를 사용한다:
  - `tickers_csv`
  - `finhub_news`
  - `ibkr_calendar`
  - `ibkr_ohlc_1d`

API 계약(초안)
- `GET /api/updates/status`는 안정적인 JSON 구조를 반환한다. 예:
  - `{ "sources": { "tickers_csv": { "lastSuccessAt": "...", "details": {..} }, ... } }`
- 아직 한 번도 성공한 적 없는 key는 `lastSuccessAt: null`로 반환한다(가짜 값 금지).

백엔드 파일:
- `terminal/backend/src/db.ts`
  - 소스별 업데이트 시각 저장 테이블 `update_status` 추가(또는 동등 테이블).
    - 권장 스키마:
      - `source_key TEXT PRIMARY KEY` (예: `ibkr_ohlc_1d`, `ibkr_calendar`, `finhub_news`, `tickers_csv`)
      - `last_success_at TEXT`
      - `details_json TEXT NOT NULL DEFAULT '{}'`
      - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
- 서비스 `terminal/backend/src/services/updateStatusRepository.ts` 추가
  - `getUpdateStatus(sourceKey)` / `listUpdateStatuses()`
  - `setLastSuccess(sourceKey, isoTimestamp, details?)`
- `terminal/backend/src/server.ts`
  - `GET /api/updates/status` 추가

검증
- 백엔드 재시작 후에도 status가 유지된다.

#### 2단계 — Default ticker CSV: read + append API(백엔드)
목적
- 브라우저는 로컬 파일을 직접 읽기/쓰기가 어렵다. 따라서 백엔드가 아래를 책임진다:
  - CSV 경로에서 티커 목록 읽기
  - 새 티커를 CSV의 **마지막 행(파일 끝)**에 append
- 이는 Default Ticker Window(3단계)를 가능하게 한다.

보안 제약(필수)
- `csvPath`는 allowlist root(초기값: `tradigview_screener/original_data/`) 아래만 허용한다.
- 확장자는 `.csv`만 허용한다.
- 티커는 `trim` + `uppercase` 정규화 후, 허용 문자(예: `[A-Z0-9.\-]`)만 통과시킨다.
- `..` 경로 탐색(path traversal)을 차단한다.

“마지막 행에 append” 정의
- 새 티커는 파일의 마지막에 **새 줄(row)**로 추가한다.
- 헤더가 있으면 보존한다.
- 파일이 비었거나 파싱 불가하면 명확한 오류로 실패한다(가짜/임의 생성 금지).

견고성(Windows 파일 교체)
- 원자적 쓰기: 임시 파일 작성 → 원본 파일 교체.
- `EBUSY/EPERM` 같은 일시 오류는 짧은 백오프로 재시도한다.

API 계약(초안)
- `GET /api/tickers?csvPath=...` → `{ csvPath, tickers: ["AAPL", "MSFT", ...] }`
- `POST /api/tickers/add` body `{ csvPath, ticker }` → `{ csvPath, tickerAdded, tickers }` (또는 유사)

백엔드 파일:
- 서비스 `terminal/backend/src/services/tickerCsvService.ts` 추가
  - `readTickersFromCsv(csvPath)`
  - `appendTickerToCsv(csvPath, ticker)`
  - 보안/정책:
    - 허용 루트: `tradigview_screener/original_data/`
    - `.csv` 강제
    - ticker 정규화(Trim + Uppercase)
    - 중복 기본 정책: reject
    - 원자적 write(temp→replace) + `EBUSY/EPERM` 재시도
- `terminal/backend/src/server.ts`
  - `GET /api/tickers?csvPath=...`
  - `POST /api/tickers/add` body `{ csvPath, ticker }`
  - 성공 시 `update_status`의 `tickers_csv` 갱신

검증
- add 호출 후 CSV 마지막 행에 append 되고, `GET /api/tickers`가 즉시 반영한다.

#### 3단계 — Default Ticker Window(프론트)
목적
- CSV에 저장된 “기본 티커 리스트”를 UI에서 확인/갱신/추가할 수 있게 한다.
- 프론트는 파일을 직접 만지지 않고(브라우저 제한), 2단계 백엔드 API만 호출한다.

UI 동작(최소/명확)
- CSV Path 입력:
  - 기본값: `tradigview_screener/original_data/watch lists2_2026-02-22.csv`
  - 사용자가 편집 가능하지만, 최종 허용/거절은 백엔드가 수행
- Reload 버튼:
  - `GET /api/tickers` 호출 → 리스트 갱신
- Add ticker:
  - 티커 입력 후 Add 클릭
  - `POST /api/tickers/add` 호출
  - 성공 시 리스트 재로딩(응답 사용 또는 Reload 재호출)

에러 처리
- 경로/티커가 거절되면 창 내부에 간단한 에러 메시지만 표시한다(추가 모달 금지).

프론트 파일:
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`
  - 윈도우 타입 `default-ticker` 추가
- `src/app/components/DefaultTickerWindow.tsx` 신규
  - UI: CSV 경로(수정 가능) + Reload 버튼 + 목록 + Add 입력/버튼
  - Step 2 API 호출
- 윈도우 등록:
  - `src/app/components/DraggableWindow.tsx` switch에 `default-ticker` 추가
  - `src/app/components/AddTabModal.tsx` 체크박스 추가(라벨: “Default Ticker”)
  - `src/app/App.tsx` title 매핑 추가(“Default Ticker”)

검증
- UI에서 티커 추가 → 백엔드 성공 → 목록 갱신

#### 4단계 — Finnhub 인제션(백엔드)
목적
- Brave/mock 기반 뉴스 대신, Finnhub에서 실제 뉴스를 수집해 기존 `news_items` 저장소에 적재한다.
- 프론트는 일관된 방식으로 `GET /api/news`만 호출하면 된다.

시크릿 처리
- `FINNHUB_API_KEY`(권장) 또는 기존 파일 fallback에서 키를 읽는다.
- API 키나 시크릿이 포함된 URL 전체를 로그로 찍지 않는다.

중복/재수집 정책
- 겹치는 기간을 재수집해도 DB가 중복으로 늘어나지 않도록(가능한 범위에서) de-dup를 수행한다.
- DB에 유니크 키가 있으면 그 제약을 활용하고, 없으면 insert 시 best-effort로 막는다.

API 계약(초안)
- `POST /api/news/pull-finhub`는 수집을 수행하고 요약을 반환한다:
  - `{ inserted: <n>, skipped: <n>, source: "FINNHUB" }`
- `GET /api/news?source_names=FINNHUB`로 적재된 데이터를 조회한다.

백엔드 파일:
- `terminal/backend/src/config.ts`
  - `FINNHUB_API_KEY`를 읽는 설정 추가(또는 파일 fallback)
- Provider `terminal/backend/src/services/finnhubNewsProvider.ts` 추가
  - Finnhub 호출 → `insertNewsItem()`에 넣을 형태로 매핑
  - `source = 'FINNHUB'`, `source_type = 'finhub_api'` 같이 일관된 키 사용
- `terminal/backend/src/server.ts`
  - `POST /api/news/pull-finhub` 추가(EODHD와 유사한 형태)
  - 성공 시 `update_status`의 `finhub_news` 갱신

검증
- 인제션 후 `GET /api/news?source_names=FINNHUB`로 조회 가능

#### 5단계 — “News Feed: Brave API” → “News Feed: finhub api” 전환(프론트)
목적
- 기존 `brave-news`(mock 포함) UI를 제거하고 Finnhub 기반으로 교체한다.
- 라벨을 정확히 `News Feed: finhub api`로 바꾸고, UI가 Brave를 암시하지 않게 한다.

필수 준수사항(정책/요구)
- `generateMockData()` 및 synthetic rows를 완전히 제거한다.
- 데이터가 없거나 필드가 불가하면 빈 값/`-`로 렌더하고, 절대 가짜 값을 만들지 않는다.

데이터 흐름
- 프론트는 `GET /api/news?source_names=FINNHUB`로 렌더한다.
- (선택) 창 내부에 “Update” 버튼을 두고 `POST /api/news/pull-finhub`로 수집 트리거.

프론트 파일:
- `brave-news` 윈도우 타입을 `finhub-news`로 교체(권장):
  - `src/app/types.ts`
    - `WindowType`에서 `brave-news` 제거, `finhub-news` 추가
    - `BraveNews*` 타입은 `FinnhubNews*`로 대체하거나, 가능하면 `NewsItem`을 재사용
- `src/app/components/AddTabModal.tsx`
  - 라벨을 정확히 `News Feed: finhub api`로 변경
  - 토글 타입도 `finhub-news`로 변경
- `src/app/App.tsx`
  - title 매핑: `finhub-news` → `News Feed: finhub api`
- `src/app/components/DraggableWindow.tsx`
  - `finhub-news`에 대해 `FinnhubNewsWindow` 렌더
- `src/app/components/BraveNewsWindow.tsx`
  - `FinnhubNewsWindow.tsx`로 rename(권장) 또는 컴포넌트명만 변경
  - **`generateMockData()` 제거 + synthetic rows 제거**
  - 백엔드 기반 fetch로 교체
    - 최소: `GET /api/news?source_names=FINNHUB`로 렌더
    - 필요 시 버튼으로 `POST /api/news/pull-finhub` 트리거

검증
- mock 생성이 완전히 사라지고, Finnhub 데이터만 표시된다.

#### 6단계 — IBKR 캘린더 인제션(백엔드) + mock 캘린더 생성기 중지
목적
- 요구사항: `/calendar`는 **IBKR 데이터만** 사용해야 한다.
- 현재 백엔드는 startup 시 mock 캘린더를 자동 생성하므로, 이를 제거하고 명시적 업데이트로 전환한다.

동작 변경 요약
- 기존: 백엔드 기동 시점에 mock worker가 주기적으로 `mock_provider` rows를 insert
- 변경: 명시적 엔드포인트 호출 시에만 캘린더를 pull+upsert 하고, IBKR만 남긴다.

정리 규칙(중요)
- 첫 IBKR 업데이트 성공 시 `calendar_events`의 `source = 'mock_provider'` rows를 삭제한다.
- 그래야 `/api/calendar/events`가 IBKR-only를 자동으로 만족한다(수동 DB 리셋 불필요).

API 계약(초안)
- `POST /api/ibkr/calendar/update` → `{ upserted: <n>, deletedMockRows: <n>, source: "IBKR" }`

백엔드 파일:
- `terminal/backend/src/services/calendarIngestion.ts`
  - mock worker 로직 제거
  - IBKR 캘린더 pull 서비스(예: `pullIbkrCalendar()`)로 대체
- `terminal/backend/src/server.ts`
  - startup의 `startCalendarIngestionWorkers()` 호출 제거
  - `POST /api/ibkr/calendar/update` 추가
    - IBKR 캘린더 이벤트 fetch
    - `upsertCalendarEvent()`로 upsert (`source = 'IBKR'`)
    - 성공 시 `update_status`의 `ibkr_calendar` 갱신
- 기존 mock row 정리
  - 첫 IBKR 업데이트 성공 이후, `calendar_events`에서 `source = 'mock_provider'` row 삭제
  - 그래야 `/api/calendar/events`가 IBKR-only를 만족

검증
- 업데이트 이후 캘린더 조회 결과가 `source = IBKR`만 포함

#### 7단계 — IBKR 1D OHLC를 `ohlc_1d_watchlist.sqlite`에 저장(백엔드)
목적
- “IBKR Price Data 업데이트”는 백엔드 작업으로 아래를 수행한다:
  1) Default Ticker CSV에서 티커를 읽는다
  2) IBKR에서 누락된 **일봉(1D) OHLCV**를 가져온다
  3) 기존 canonical DB `OHLC_data/ohlc_1d_watchlist.sqlite`에 upsert 한다
  4) News Feed UI에 필요한 파생 % 변화 컬럼을 계산/저장한다

기간 규칙(최소/증분)
- DB 최신 날짜 `MAX(Datetime)`를 기준으로, 이후 구간만 가져온다.
- 새 데이터가 없으면 “no-op” 요약을 반환하고 오류로 취급하지 않는다.

파생 지표 저장 이유(정확성)
- News Feed의 `Chg`, `fr.Open`, `+7D/+14D/+30D`는 OHLC로부터 계산되어야 하며 mock이 금지된다.
- 이를 `(Symbol, Datetime)` 단위로 저장하면 프론트가 항상 동일 로직으로 렌더 가능하다.

API 계약(초안)
- `GET /api/ibkr/ohlc1d/status` → `{ dbPath, overallMaxDate, lastSuccessAt }`
- `POST /api/ibkr/ohlc1d/update` → `{ tickersRequested, tickersUpdated, rowsUpserted, overallMaxDateBefore, overallMaxDateAfter }`

백엔드 목표
- “IBKR Price Data”는 각 티커의 **1D OHLCV**를 받아 아래 DB에 이어서 저장하는 것을 의미한다.
  - `OHLC_data/ohlc_1d_watchlist.sqlite` 테이블 `ohlc_1d` (PK `(Symbol, Datetime)`)

추가 필수(News Feed에 표시되는 파생 컬럼)
- 동일한 “가격 업데이트” 과정에서, OHLC로부터 파생 지표(당일 change, open 대비 %, +7d 등)를 계산해 `ohlc_1d` 테이블의 **추가 컬럼**으로 저장해야 한다.
- 프론트에서 표시되는 컬럼이므로, UI-only 계산/가짜 데이터는 금지.

추가 컬럼 제안(Symbol+Datetime 단위로 저장)
- `Change_1d_Pct` : 전일 종가 대비 당일 종가 % 변화
- `Change_From_Open_Pct` : 시가 대비 종가 % 변화 = (Close / Open - 1) * 100
- `Change_7d_Pct` : 7거래일 전 종가 대비 % 변화
- `Change_14d_Pct` : 14거래일 전 종가 대비 % 변화
- `Change_30d_Pct` : 30거래일 전 종가 대비 % 변화
- `Derived_Updated_At` : 파생 컬럼 계산/갱신 시각(디버깅용, 권장)

백엔드 파일
- 서비스 `terminal/backend/src/services/ohlcWatchlistRepository.ts` 추가
  - `OHLC_data/ohlc_1d_watchlist.sqlite`를 열고 쿼리/업서트 수행(기본값은 이 파일로 고정)
  - `getOverallMaxDate()` → `MAX(Datetime)` 조회
  - `upsertBars(symbol, bars)` → `INSERT ... ON CONFLICT(Symbol, Datetime) DO UPDATE`(또는 ignore)
  - 마이그레이션 헬퍼 `ensureDerivedColumns()` 추가: 누락된 컬럼에 대해 `ALTER TABLE ohlc_1d ADD COLUMN ...` 실행
- 서비스 `terminal/backend/src/services/ibkrOhlc1dProvider.ts` 추가
  - IBKR에서 지정 기간의 일봉 OHLCV를 가져오는 로직
  - 최소 룰: 시작일은 `MAX(Datetime) + 1일`, 종료일은 “오늘(NY)”
- 파생 계산기 `terminal/backend/src/services/ohlcDerivedMetrics.ts` 추가
  - 특정 심볼/기간에 대해 필요한 과거 구간(최소 30거래일 이전까지)을 로드한 뒤 파생 컬럼을 계산/업데이트
  - 증분 정확성 룰: 새 바가 들어온 심볼에 대해서는 안전 구간을 재계산
    - `(min_new_date - 40거래일)` ~ `max_new_date` (7/14/30 lookback 커버 목적)
- `terminal/backend/src/server.ts`
  - `GET /api/ibkr/ohlc1d/status` 추가
    - `dbPath`, `overallMaxDate`, `lastSuccessAt(update_status)` 반환
  - `POST /api/ibkr/ohlc1d/update` 추가
    - Default Ticker CSV에서 티커 로드(tickerCsvService 재사용)
    - 누락된 일봉을 받아 `ohlc_1d`에 업서트
    - 영향받은 심볼/기간에 대해 파생 컬럼 계산 후 `ohlc_1d`에 업데이트
    - 성공 시 `update_status`의 `ibkr_ohlc_1d` 갱신(details에 `overallMaxDate` 등 포함)

검증
- status API가 DB 최신 날짜(`MAX(Datetime)`)를 정확히 반영한다.
- 업데이트 후(새 거래일이 존재하면) DB의 `MAX(Datetime)`가 증가한다.
- `ohlc_1d`에서 최근 날짜의 파생 컬럼이 실제 값으로 채워졌는지(전부 NULL이 아닌지) 샘플 확인

#### 8단계 — Data Control Window(프론트)
목적
- 백엔드 업데이트를 수동으로 실행하고, 최신 상태를 확인할 수 있는 최소 운영 창을 제공한다.
- 1단계의 update status를 읽어 각 항목의 “마지막 성공 시각”을 보여준다.

UI 동작(최소)
- 버튼 2개:
  - `IBKR Price Data` → `POST /api/ibkr/ohlc1d/update`
  - `IBKR Calendar Data` → `POST /api/ibkr/calendar/update`
- 상태 표시(읽기 전용):
  - 각 소스의 last success timestamp
  - OHLC DB 최신 날짜(`GET /api/ibkr/ohlc1d/status`)

로딩/에러
- 실행 중에는 해당 버튼 비활성화 + “Running…” 텍스트 표시.
- 실패 시 창 내부에 짧은 에러 메시지를 표시(추가 모달 금지).

프론트 파일:
- `src/app/types.ts`에 `data-control` 윈도우 타입 추가
- `src/app/components/DataControlWindow.tsx` 신규
  - 섹션 2개
    - IBKR Price Data(OHLC 1D): Update 버튼 + last updated + DB 최신 날짜
    - IBKR Calendar Data: Update 버튼 + last updated
  - 초기 로드: `GET /api/updates/status`
  - 버튼 클릭:
    - 가격: `POST /api/ibkr/ohlc1d/update`
    - 캘린더: `POST /api/ibkr/calendar/update`
    - 이후 `GET /api/updates/status` + `GET /api/ibkr/ohlc1d/status` 재조회
- 등록:
  - `AddTabModal.tsx` 체크박스 추가
  - `App.tsx` title 매핑
  - `DraggableWindow.tsx` switch 추가

검증
- 버튼 호출과 timestamp 표시가 정상

#### 9단계 — 테스트/검증(최소지만 실제)
목적
- 기반 API들이 정확히 동작하고(특히 보안 제약/영구 저장), mock 데이터가 다시 들어오지 않도록 최소한의 테스트로 안전망을 만든다.

백엔드 테스트 포커스
- `update_status` 영구성: set → (재시작에 준하는) 재조회 → 동일 값 반환
- CSV 경로 allowlist: `tradigview_screener/original_data/` 밖 경로 거절
- CSV append: 파일 끝에 추가, 중복 reject(기본)
- Finnhub 매핑: 필수 필드 존재 + API 키 누출 없음
- 캘린더 정리: IBKR 업데이트 성공 후 `mock_provider` rows 삭제

백엔드 테스트(`terminal/backend/tests/`):
- tickerCsvService read/append/path restriction
- updateStatusRepository set/get
- finnhub provider mapping(응답 shape 검증)
- 캘린더 mock cleanup(기존 mock_provider row 삭제)

프론트 스모크:
- 윈도우 렌더 및 API 호출(프론트 자동 테스트가 없으면 수동 QA)

검증
- 백엔드 `npm run test`가 통과한다.

### 미확정 사항(명시 결정 필요)
1) CSV에서 티커가 들어있는 컬럼 규칙
2) 중복 티커 처리(append vs reject)
3) 허용 csvPath 범위(기본 제한 vs 확대)
4) 기존 `News` 윈도우(EODHD)를 유지할지, Finnhub로 같이 전환할지?
