# Plan — terminal_ui_ver2_finhub (Frontend)

## EN

> ℹ️ KO section is the authoritative source. If EN/KO diverge, sync EN to match KO.

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

### Current repo reality (important, verified)
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
- Do not add extra pages, modals, filters, animations, or “nice-to-have” UX.
- Do not introduce mock/synthetic news data.
- Do not log secrets (API keys/tokens).
- Browser cannot directly write local files; CSV read/append must be done via backend API.

### Process templates (plan changes + step confirmation)

#### Plan change protocol (when the plan must be revised mid-stream)
- Do **not** rewrite or delete prior log entries.
- Record a short revision note and continue with the revised plan.

Template — PLAN CHANGE note (add to chat, and to `agent_log.md` only if `agent_log.md` is being maintained for this plan)
```text
PLAN CHANGE (YYYY-MM-DD)
- Why: <reason>
- What changed: <steps added/removed/reordered>
- Impact: <scope/risks/ETA change>
```

#### Per-step verification + user confirmation (gates “user-confirmed” in logs)
- Each step includes a sub-step table plus a “verification hook”.
- After completing a step, the agent must:
  1) Run the listed verification command(s) / checklist.
  2) Share results with the user.
  3) Explicitly ask the user to confirm completion.
  4) Only after the user confirms → mark `completed (user-confirmed)` in `agent_log.md`.
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
  - Separate but related decision (blocked item #6 in this plan): **Node↔IBKR integration method** (how the Node/TS backend will actually call IBKR reliably on this machine).
    - Option A: direct Node library (e.g. `@stoqey/ib`) talking to TWS/Gateway
    - Option B: Node orchestrator + local Python via `child_process` (Python talks to IBKR; Node parses JSON output)
    - Option C: Node orchestrator + local Python microservice (HTTP on localhost; Python keeps the IBKR connection alive)
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
    - `Date Announcement`, `Time`, `Symbol`, `Session`, `Analyst Firm`, `Analyst Name`, `Action`, `Prior Rating`, `Rating`, `Prior PT`, `Price Target`, `Confirmed`
- Watchlist window (currently mock):
  - Table columns: `Ticker`, `Name`, `Mkt Cap`, `Industry`, `Price`, `Change`, `%`

Working definitions for “Changes %” (to avoid ambiguity)
- Use the latest available trading bar in `ohlc_1d` for the symbol (per-symbol latest `Datetime`).
- `Chg` := $(\frac{Close_t}{Close_{t-1}} - 1) \times 100$
- `fr.Open` := $(\frac{Close_t}{Open_t} - 1) \times 100$
- `+7D/+14D/+30D` := $(\frac{Close_t}{Close_{t-N}} - 1) \times 100$ where $N$ is trading bars (not calendar days).

### Proposed implementation order (rationale)
IBKR integration is the highest-uncertainty dependency; CSV + Finnhub are lower risk and unblock visible progress. So the order below:
0) Data availability audit (IBKR + Finnhub vs UI columns)
1) Foundations (DB table + status API)
2) Default Ticker CSV APIs + window
3) Finnhub ingestion + migrate “news feed” window (and remove mock)
4) IBKR calendar + price update endpoints + Data Control window
5) Cleanup + tests

### Step-by-step plan (implement → verify each step)

> **Verification protocol**
> - Each step includes a sub-step table and a verification hook.
> - At step closeout: run the hook commands/checklist, share results with the user, and only after user confirmation mark `completed (user-confirmed)` in `agent_log.md`.

#### Step 0 — Data availability audit (IBKR + Finnhub vs UI columns)
Purpose (why this step exists)
- This project’s UI tables imply specific fields (market cap, industry, earnings fields, analyst ratings, etc.). Before we implement UI or DB schemas, we must confirm which fields are actually obtainable from IBKR/Finnhub, and which can be computed from the existing 1D OHLC DB.
- This is a **fail-fast guardrail**: if a required field is not available, we stop and decide rather than shipping “fake” placeholders.

Companion doc / probes
- Audit checklist + matrix template: `ai_agent_plan/terminal_ui_ver2_finhub/test/test_data_availability_audit.md`
- Finnhub raw-response probe script: `terminal/backend/test_finnhub_probe.mjs` (writes to `tmp/probes/`)

Probe output handling (repo hygiene)
- Do **not** log or print API keys/tokens.
- Store raw samples under a short path (e.g., `tmp/`) to avoid Windows path length issues.

Deliverables
- Fill the capability matrix with definitive “Yes/No/Computed” outcomes.
- Produce probe outputs (raw JSON samples) for a small set of symbols (e.g., AAPL, MSFT, TSLA) to confirm:
  - Finnhub company news fields, company profile fields (market cap, industry), and next earnings date availability.
  - IBKR daily OHLCV retrieval works end-to-end (connection + pacing + permissions).
  - IBKR calendar capability for the UI-required fields (earnings EPS/revenue and analyst rating in particular).

**Sub-steps (Step 0)**

| Sub-step | Task | Status |
|----------|------|--------|
| 0-1 | Finnhub probes (profile, news, earnings, etc.) | ✅ Done |
| 0-2 | IBKR TWS probe v1 (OHLCV ✅, Reuters ❌, WSH v1 empty) | ✅ Done |
| 0-2b | IBKR WSH probe v2 (conId-based: metadata ✅, events ✅) | ✅ Done |
| 0-2c | IBKR WSH field probe v3 (survey 24 event types; EPS confirmed) | ✅ Done |
| 0-3 | Fill capability matrix in `test_data_availability_audit.md` | ✅ Done (updated with WSH v3 results) |
| 0-4 | Pending decisions: /calendar source + Node↔IBKR method | ⏳ Awaiting user |

**Sub-step purpose & description (Step 0)**
- `0-1` Purpose: Confirm which Finnhub fields exist for the UI. Description:
  - Run Finnhub probes for the specific UI needs (company news + company profile + next earnings date), using a small fixed symbol set (AAPL/MSFT/TSLA).
  - Save raw JSON responses under `tmp/probes/` with clear filenames (symbol + endpoint + date) so results are reproducible.
  - Record “missing field” outcomes explicitly in the matrix; do not infer/approximate values.
- `0-2` Purpose: Confirm baseline IBKR TWS connectivity and OHLC retrieval. Description:
  - Run the v1 probe to validate host/port, permissions, and that historical daily bars can be fetched end-to-end.
  - Record failures as “capability gaps” (e.g., Reuters unavailable, WSH empty in v1) rather than patching around them.
  - Save raw samples (or concise summaries) for later comparison when changing settings.
- `0-2b` Purpose: Confirm WSH metadata/events are accessible via `conId`. Description:
  - Use the *blocking* metadata call and verify results are non-empty (metadata + events).
  - Persist one representative metadata sample + one event sample per symbol so we can re-check after code changes.
  - Note any per-symbol differences (some tickers may have metadata while others do not).
- `0-2c` Purpose: Identify which WSH event types contain required financial fields. Description:
  - Survey event types against the UI-required fields (EPS actual/estimate, revenue, etc.).
  - For each event type, record which numeric fields exist and whether the semantics match the UI column meanings.
  - Capture “not available” results explicitly (e.g., revenue not present) so Step 6/7 scope is honest.
- `0-3` Purpose: Turn probe results into a concrete implementation map. Description:
  - Fill the capability matrix in `test_data_availability_audit.md` for *every* UI column using one of: IBKR / Finnhub / Computed-from-OHLC / Not available.
  - If “Not available”, also write the required follow-up decision (remove column vs accept blank vs alternate provider).
  - Keep the matrix stable and referenceable so later steps do not re-open the same questions.
- `0-4` Purpose: Unblock IBKR-dependent steps (Steps 6–8). Description: make two explicit decisions and capture the operational details needed to implement and verify them:
  - Decision #5: `/calendar` source strategy (what provider supplies the calendar data, and how it will be pulled).
  - Decision #6: Node↔IBKR integration method (how the Node/TS backend will call IBKR for Step 7 and other IBKR endpoints).
  - Confirmation checklist (so we don’t block later on “it works on your machine” issues):
    - Where IBKR runs (same PC as backend vs another host), and which component is used (TWS vs IB Gateway)
    - Host/port for the API (typical examples: `127.0.0.1:7496` live, `127.0.0.1:7497` paper — user confirms actual)
    - Whether Python is allowed on the backend machine (only needed for options B/C), and whether a long-running local service is acceptable (option C)
  - Output of this decision: record the chosen option + a minimal “hello IBKR historical bars” probe that can be run repeatedly to validate connectivity.

**WSH v3 key finding (corrects earlier assessment):**
- v1 used `reqWshMetaData()` (non-blocking) → empty. v2 used `getWshMetaData()` (blocking) + `conId` → rich data available.
- **`wshe_eps` includes EPS actual + estimate** (`amount_oc`, `estimated_eps`, `change_amount`, `change_percent`).
- **Revenue is NOT present in WSH** → needs Finnhub `/stock/earnings` supplement.

**Verification hook (Step 0 closeout):**
- Check: `test_data_availability_audit.md` covers every UI column with a definitive ✅/❌/Computed.
- Check: probe JSON files exist in `tmp/probes/` for Finnhub and IBKR (v1 + v2).
- Gate: User must confirm the 2 pending decisions before Steps 6-7 can proceed.

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

**Sub-steps (Step 1)**

| Sub-step | Task | Files | Verification |
|----------|------|-------|--------------|
| 1-1 | `update_status` table CREATE in `initDb()` | `terminal/backend/src/db.ts` | Start backend → table exists in `app.db` (query: `SELECT name FROM sqlite_master WHERE name='update_status'`) |
| 1-2 | `updateStatusRepository.ts` service | `terminal/backend/src/services/updateStatusRepository.ts` | Import check: no TS compile errors (`npx tsc --noEmit`) |
| 1-3 | Wire `GET /api/updates/status` endpoint | `terminal/backend/src/server.ts` | `curl http://localhost:8080/api/updates/status` returns `{ "sources": { ... } }` with all 4 keys |
| 1-4 | Persistence test: set a value → restart → same value | (runtime) | 1\. Call `setLastSuccess('tickers_csv', '2026-03-01T00:00:00Z')` via a test endpoint or inline. 2. Restart backend. 3. `curl /api/updates/status` → `tickers_csv.lastSuccessAt` equals the set value. |

**Sub-step purpose & description (Step 1)**
- `1-1` Purpose: Persist update timestamps in the backend DB. Description:
  - Implement `update_status` table creation in `initDb()` in an idempotent way (safe across restarts).
  - Ensure schema matches the plan (primary key `source_key`, ISO string timestamps, JSON details field).
  - Verification expectation: the table exists in the actual SQLite DB file the backend uses at runtime.
- `1-2` Purpose: Centralize status read/write logic. Description:
  - Implement a small repository (`listUpdateStatuses`, `setLastSuccess`, optional `getUpdateStatus`) that is the *only* place that issues SQL for update-status.
  - Define a stable “source key” allowlist (tickers_csv, finhub_news, ibkr_calendar, ibkr_ohlc_1d) to avoid accidental key drift.
  - Keep `details_json` minimal (counts + maxDate) and avoid storing raw provider payloads.
- `1-3` Purpose: Make status visible to the frontend and operators. Description:
  - Add `GET /api/updates/status` and return a stable JSON shape that always includes all expected keys.
  - If a key has never succeeded, return `lastSuccessAt: null` (never fabricate).
  - Keep the route read-only and safe (no secrets; no provider calls).
- `1-4` Purpose: Prove it survives restarts (not in-memory). Description:
  - Write a known timestamp via repository code (from a test or a controlled code path).
  - Restart the backend process and confirm the timestamp still appears in `GET /api/updates/status`.
  - Treat “resets to null after restart” as a correctness failure (indicates in-memory state or wrong DB file).

**Verification hook (Step 1 closeout):**
```
1. cd terminal/backend && npx tsc --noEmit   → 0 errors
2. npm run dev (start backend)
3. curl http://localhost:8080/api/updates/status
  → returns JSON with sources: tickers_csv, finhub_news, ibkr_calendar, ibkr_ohlc_1d (all null)
4. npm run test   → all existing + new tests pass
```
- User confirmation needed: **Yes**
- agent_log update: record sub-step completion status

> **NOTE**: Sub-steps 1-1, 1-2 were pre-written during a process violation (before Step 0 confirmation). Code is in-place but needs formal verification as documented above. Sub-step 1-3 endpoint wiring is NOT yet done (only import was added).

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

**Sub-steps (Step 2)**

| Sub-step | Task | Files | Verification |
|----------|------|-------|--------------|
| 2-1 | Create `tickerCsvService.ts` — `readTickersFromCsv()` | `terminal/backend/src/services/tickerCsvService.ts` | Unit test: reads the sample CSV `tradigview_screener/original_data/watch lists2_2026-02-22.csv` and returns ticker array |
| 2-2 | Add `appendTickerToCsv()` with security checks | same file | Unit test: (a) append to temp copy → ticker at end. (b) reject `../` path → error. (c) reject non-`.csv` → error. (d) reject duplicate → error. |
| 2-3 | Atomic write + Windows retry (`EBUSY`/`EPERM`) | same file | Code review: uses `fs.writeFile` to temp → `fs.rename` with retry loop (up to 10 retries, backoff 100ms) |
| 2-4 | Wire `GET /api/tickers` endpoint | `terminal/backend/src/server.ts` | `curl "http://localhost:8080/api/tickers?csvPath=tradigview_screener/original_data/watch%20lists2_2026-02-22.csv"` → returns ticker list |
| 2-5 | Wire `POST /api/tickers/add` endpoint | `terminal/backend/src/server.ts` | `curl -X POST http://localhost:8080/api/tickers/add -H "Content-Type: application/json" -d '{"csvPath":"...","ticker":"ZZZZ"}'` → success, then GET verifies ZZZZ appears. Then manually remove ZZZZ from CSV. |
| 2-6 | Update `tickers_csv` status on success | `terminal/backend/src/server.ts` | After POST success, `GET /api/updates/status` shows `tickers_csv.lastSuccessAt` updated |

**Sub-step purpose & description (Step 2)**
- `2-1` Purpose: Read the CSV and extract tickers reliably. Description:
  - Parse the allowlisted CSV and extract tickers from the decided header (`Ticker` or `Symbol`).
  - Normalize output tickers (`trim`, uppercase) and drop empty/invalid rows.
  - Unit test against `tradigview_screener/original_data/watch lists2_2026-02-22.csv` to ensure we don’t break on spaces in filenames.
- `2-2` Purpose: Append a ticker safely. Description:
  - Validate `csvPath`: allowlist root, `.csv` extension, no traversal (`..`), and resolve path deterministically.
  - Validate ticker: allowed charset, normalize, and enforce duplicate policy (default: reject duplicates).
  - Error messages must be actionable (e.g., “path not allowlisted” vs generic 500).
- `2-3` Purpose: Make writes robust on Windows. Description:
  - Implement atomic write by writing a temp file in the same directory and replacing the original.
  - Add bounded retry with backoff for transient replace failures (`EBUSY`/`EPERM`), up to 10 attempts.
  - Ensure the retry is *not* applied to permanent failures (invalid path, permission denied, non-existent file).
- `2-4` Purpose: Provide a read API for the UI. Description:
  - Wire `GET /api/tickers` to call `readTickersFromCsv()`.
  - Ensure query params are validated and rejected safely; do not read arbitrary filesystem locations.
  - Response shape should be stable: `{ csvPath, tickers: string[] }`.
- `2-5` Purpose: Provide an append API for the UI. Description:
  - Wire `POST /api/tickers/add` to call `appendTickerToCsv()`.
  - On success, return either the updated full list or enough data for the UI to refresh.
  - Ensure the endpoint updates `update_status(tickers_csv)` only on successful write.
- `2-6` Purpose: Track successful updates for operators/UI. Description:
  - Update `update_status` using `setLastSuccess('tickers_csv', nowIso, details)`.
  - Store only minimal details (e.g., `{ csvPath, tickerAdded }`) and avoid persisting raw CSV content.
  - Verify via `GET /api/updates/status` that `tickers_csv.lastSuccessAt` changes after a successful append.

**Verification hook (Step 2 closeout):**
```
1. npx tsc --noEmit   → 0 errors
2. npm run test       → new tickerCsvService tests pass
3. Start backend → test GET and POST via curl (commands above)
4. Verify path traversal is blocked: csvPath=../../etc/passwd → rejected
5. Verify duplicate rejection: add same ticker twice → second call fails
```
- User confirmation needed: **Yes**

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

**Sub-steps (Step 3)**

| Sub-step | Task | Files | Verification |
|----------|------|-------|--------------|
| 3-1 | Add `default-ticker` window type | `src/app/types.ts` | Grep: `default-ticker` appears in `WindowType` |
| 3-2 | Create `DefaultTickerWindow.tsx` | `src/app/components/DefaultTickerWindow.tsx` | File exists, no TS errors |
| 3-3 | Wire into `DraggableWindow.tsx` switch | `src/app/components/DraggableWindow.tsx` | `default-ticker` case renders `DefaultTickerWindow` |
| 3-4 | Add to `AddTabModal.tsx` | `src/app/components/AddTabModal.tsx` | Checkbox "Default Ticker" visible |
| 3-5 | Add title mapping in `App.tsx` | `src/app/App.tsx` | `default-ticker` → "Default Ticker" |
| 3-6 | Manual UI smoke test | (browser) | Open "Default Ticker" window → shows tickers from CSV → Add a ticker → list refreshes |

**Sub-step purpose & description (Step 3)**
- `3-1` Purpose: Make the window type selectable in the window system. Description:
  - Add `default-ticker` to the `WindowType` union (and any related type maps) so it can be instantiated.
  - Ensure there is no stale reference to a removed/renamed type that would break rendering.
  - Keep naming consistent across types, window title mapping, and AddTab labels.
- `3-2` Purpose: Implement the UI surface. Description:
  - Build `DefaultTickerWindow.tsx` as a thin client: CSV path input + reload button + list + add form.
  - Call only backend APIs (`GET /api/tickers`, `POST /api/tickers/add`); do not attempt browser-side file operations.
  - Display backend validation errors inline (no modal) and keep text minimal.
- `3-3` Purpose: Ensure the window renders in the desktop layout. Description:
  - Add a `default-ticker` rendering branch in `DraggableWindow.tsx` to render `DefaultTickerWindow`.
  - Confirm the component receives the same window props pattern as other windows (position/size/state).
  - Ensure the window does not crash when the CSV path is invalid (show error instead).
- `3-4` Purpose: Allow users to open the window. Description:
  - Add a checkbox entry to `AddTabModal.tsx` that creates the `default-ticker` window.
  - Label must be exactly “Default Ticker” to match the plan.
  - Ensure toggling it on/off behaves consistently with other windows.
- `3-5` Purpose: Provide a stable, human-readable title. Description:
  - Map `default-ticker` to “Default Ticker” in `App.tsx` title mapping.
  - Ensure there are no duplicate/conflicting title mappings.
  - Keep the title string stable because it becomes an acceptance-test anchor.
- `3-6` Purpose: Validate end-to-end behavior. Description:
  - Open the window, confirm it calls `GET /api/tickers` and renders the list.
  - Add a ticker and confirm it calls `POST /api/tickers/add`, then refreshes the list.
  - Clean up the appended ticker afterwards (manual revert) so the repo data is not polluted.

**Verification hook (Step 3 closeout):**
```
1. npx tsc --noEmit (frontend)   → 0 errors
2. npm run dev (frontend + backend both running)
3. Open browser → Add Tab → check "Default Ticker" → window opens
4. Window shows ticker list loaded from CSV
5. Type "TEST" → click Add → appears in list (remove manually afterward)
```
- User confirmation needed: **Yes**

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

**Sub-steps (Step 4)**

| Sub-step | Task | Files | Verification |
|----------|------|-------|--------------|
| 4-1 | Add `finnhubApiKey` to config | `terminal/backend/src/config.ts` | Config loads from `FINNHUB_API_KEY` env or file fallback |
| 4-2 | Create `finnhubNewsProvider.ts` | `terminal/backend/src/services/finnhubNewsProvider.ts` | Fetches from Finnhub, maps to `insertNewsItem()` contract, sets `source='FINNHUB'` |
| 4-3 | Wire `POST /api/news/pull-finhub` endpoint | `terminal/backend/src/server.ts` | `curl -X POST http://localhost:8080/api/news/pull-finhub` → `{ inserted: N, skipped: N, source: "FINNHUB" }` |
| 4-4 | Update `finhub_news` status on success | `terminal/backend/src/server.ts` | After POST, `GET /api/updates/status` shows `finhub_news.lastSuccessAt` updated |
| 4-5 | Verify stored data queryable | (runtime) | `curl "http://localhost:8080/api/news?source_names=FINNHUB"` → returns news items with correct fields |

**Sub-step purpose & description (Step 4)**
- `4-1` Purpose: Load the Finnhub key safely. Description:
  - Prefer `FINNHUB_API_KEY` from environment; only use the file fallback if the env var is absent.
  - If key is missing, fail fast with a clear message but never log/print the key.
  - Keep config loading centralized (single source of truth) so provider code never reads secrets directly.
- `4-2` Purpose: Convert Finnhub responses into the DB’s news schema. Description:
  - Fetch from Finnhub endpoints required for “company news”.
  - Map into the existing `insertNewsItem()` contract and set `source='FINNHUB'` consistently.
  - Dedup policy: avoid re-inserting the same item when ranges overlap (prefer DB uniqueness; otherwise best-effort in code).
- `4-3` Purpose: Trigger ingestion on demand. Description:
  - Add `POST /api/news/pull-finhub` that runs the provider pull and persists rows.
  - Return a small summary (`inserted`, `skipped`, `source`) suitable for UI display.
  - Ensure the endpoint does not run automatically on startup (explicit trigger only).
- `4-4` Purpose: Track the last successful pull. Description:
  - On success, write `update_status(finhub_news).lastSuccessAt = now()`.
  - Store minimal details like counts and the covered date range; do not store raw response bodies.
  - Verify status changes via `GET /api/updates/status`.
- `4-5` Purpose: Confirm data is actually queryable by the UI. Description:
  - Query `GET /api/news?source_names=FINNHUB` and verify:
    - items exist
    - required fields (title, published time, url/source) are present
    - `source` matches exactly `FINNHUB`
  - If no items appear, treat it as an ingestion or query bug (not a UI issue).

**Verification hook (Step 4 closeout):**
```
1. Set FINNHUB_API_KEY env (or verify file exists)
2. npx tsc --noEmit → 0 errors
3. npm run test → finnhubNewsProvider mapping tests pass
4. Start backend → POST /api/news/pull-finhub → check response
5. GET /api/news?source_names=FINNHUB → items returned
6. Verify no API key in any log output
```
- User confirmation needed: **Yes**

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

**Sub-steps (Step 5)**

| Sub-step | Task | Files | Verification |
|----------|------|-------|--------------|
| 5-1 | Remove `brave-news` from `WindowType`, add `finhub-news` | `src/app/types.ts` | Grep: no `brave-news`, `finhub-news` present |
| 5-2 | Rename `BraveNewsWindow.tsx` → `FinnhubNewsWindow.tsx` | file rename | Old file gone, new file exists |
| 5-3 | Remove `generateMockData()` entirely | `FinnhubNewsWindow.tsx` | `grep -r "generateMockData" src/` → 0 results |
| 5-4 | Implement real fetch from `GET /api/news?source_names=FINNHUB` | `FinnhubNewsWindow.tsx` | Component fetches from backend on mount |
| 5-5 | Add optional "Update" button calling `POST /api/news/pull-finhub` | `FinnhubNewsWindow.tsx` | Button visible, triggers ingestion |
| 5-6 | Update `AddTabModal.tsx` label → `News Feed: finhub api` | `src/app/components/AddTabModal.tsx` | Label text exact match |
| 5-7 | Update `App.tsx` title mapping | `src/app/App.tsx` | `finhub-news` → `News Feed: finhub api` |
| 5-8 | Update `DraggableWindow.tsx` switch | `src/app/components/DraggableWindow.tsx` | `finhub-news` → `FinnhubNewsWindow` |

**Sub-step purpose & description (Step 5)**
- `5-1` Purpose: Switch the window identity away from Brave. Description:
  - Remove the `brave-news` window type and introduce `finhub-news` as the canonical type.
  - Update any type-level models (`BraveNews*` types) to Finnhub equivalents or reuse the backend `NewsItem` shape if already defined.
  - Success criterion: no user-facing UI path can still open a “Brave” news window.
- `5-2` Purpose: Keep code structure readable. Description:
  - Rename the window component to `FinnhubNewsWindow` (file rename preferred) so naming matches behavior.
  - Update all imports/exports accordingly.
  - Avoid leaving duplicate/unused components (e.g., both BraveNewsWindow and FinnhubNewsWindow) unless intentionally kept.
- `5-3` Purpose: Enforce “no mock data” policy. Description:
  - Remove `generateMockData()` and any synthetic seed arrays.
  - Remove any fallback code path that “creates demo items” when backend returns empty.
  - Verification expectation: searching the frontend source tree for `generateMockData` and related mock helpers returns zero matches.
- `5-4` Purpose: Render real stored news. Description:
  - Fetch news from backend using `GET /api/news?source_names=FINNHUB`.
  - Render exactly what the backend returns; if fields are missing, display empty/`-` (never invent values).
  - Keep fetch behavior predictable (load-on-mount + optional manual refresh only).
- `5-5` Purpose: Allow manual refresh when needed (optional). Description:
  - Add an in-window “Update” button that calls `POST /api/news/pull-finhub`.
  - After POST success, refresh the list by re-calling `GET /api/news?source_names=FINNHUB`.
  - Ensure the UI shows a minimal running/error state without adding new modals.
- `5-6` Purpose: Match the exact requested label. Description:
  - In `AddTabModal.tsx`, update the label text to exactly `News Feed: finhub api` (case + spacing exact).
  - Ensure no other place still shows “Brave API” for this window.
  - Treat label mismatch as acceptance failure (it’s user-visible and specified).
- `5-7` Purpose: Ensure the window title is correct. Description:
  - Update `App.tsx` title mapping so `finhub-news` renders the exact title `News Feed: finhub api`.
  - Ensure switching between windows does not show stale titles.
  - Keep the string stable as an acceptance-test anchor.
- `5-8` Purpose: Ensure the window actually renders. Description:
  - Add a `finhub-news` case in `DraggableWindow.tsx` that renders `FinnhubNewsWindow`.
  - Verify the window opens, fetches, and renders without crashing even when the backend returns an empty array.
  - Ensure there is no leftover `brave-news` rendering path.

**Verification hook (Step 5 closeout):**
```
1. grep -r "generateMockData\|mock\|brave-news\|BraveNews" src/ → 0 results (no mock/brave references)
2. npx tsc --noEmit → 0 errors
3. npm run dev → Open "News Feed: finhub api" window
4. Window shows real Finnhub news (requires Step 4 data to be ingested first)
5. "Update" button triggers backend pull
```
- User confirmation needed: **Yes**

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

**Sub-steps (Step 6)**
> **⚠️ BLOCKED** on pending decision: /calendar data source (IBKR TWS cannot provide calendar data). Must be resolved before starting.

| Sub-step | Task | Files | Verification |
|----------|------|-------|--------------|
| 6-1 | Remove mock worker functions from `calendarIngestion.ts` | `terminal/backend/src/services/calendarIngestion.ts` | `grep "mock_provider\|setInterval\|generateMock" calendarIngestion.ts` → 0 matches |
| 6-2 | Remove `startCalendarIngestionWorkers()` call from server startup | `terminal/backend/src/server.ts` | `grep "startCalendarIngestion" server.ts` → only import/no startup call |
| 6-3 | Implement calendar data pull (source TBD by decision) | `terminal/backend/src/services/calendarIngestion.ts` | new `pullCalendarData()` function returns events |
| 6-4 | Wire `POST /api/ibkr/calendar/update` endpoint | `terminal/backend/src/server.ts` | `curl -X POST http://localhost:8080/api/ibkr/calendar/update` → `{ upserted: N, deletedMockRows: N }` |
| 6-5 | Delete existing `mock_provider` rows on first success | `calendarIngestion.ts` or server route | `SELECT COUNT(*) FROM calendar_events WHERE source='mock_provider'` → 0 |
| 6-6 | Update `ibkr_calendar` status | `terminal/backend/src/server.ts` | `GET /api/updates/status` → `ibkr_calendar.lastSuccessAt` populated |

**Sub-step purpose & description (Step 6)**
- `6-1` Purpose: Stop any future mock calendar inserts. Description:
  - Remove *all* timer/worker code paths that insert `calendar_events(source='mock_provider')`.
  - Ensure the file no longer contains mock helpers (e.g. `generateMock*`, `setInterval`, hard-coded sample events).
  - Success criterion: starting the backend does not create any new rows unless an explicit endpoint is called.
- `6-2` Purpose: Remove startup side effects so `/calendar` is pull-on-demand only. Description:
  - Delete the `startCalendarIngestionWorkers()` call from the server startup path.
  - If the function remains for backward compatibility, it must not run automatically.
  - Verification focus: reboot backend → DB remains unchanged until `POST /api/ibkr/calendar/update`.
- `6-3` Purpose: Implement the real calendar pull in a testable, provider-agnostic shape (decision-dependent). Description:
  - Add a `pullCalendarData()` function that returns a normalized list of events.
  - Normalization rules (minimum): stable IDs (or deterministic hash), ISO timestamps, symbol, event type, and a `source` field.
  - Explicitly document which fields are *not* available from the chosen source (never fabricate).
- `6-4` Purpose: Provide an explicit operator/UI trigger for calendar refresh. Description:
  - Add `POST /api/ibkr/calendar/update` which does: pull → upsert → update status.
  - The route must return a small summary (`upserted`, `deletedMockRows`, `source`) and a non-200 on failure.
  - Do not log secrets; only log counts + high-level errors.
- `6-5` Purpose: Remove already-stored mock data so the app becomes “IBKR-only” without manual DB resets. Description:
  - On the *first successful* real update, delete `calendar_events` rows with `source='mock_provider'`.
  - This deletion must be idempotent and safe to re-run.
  - Prefer performing delete+upsert+status update in a single transaction where practical.
- `6-6` Purpose: Persist “last success” timestamps for the Data Control Window and ops. Description:
  - On success, write `update_status(ibkr_calendar).lastSuccessAt = now()`.
  - Store minimal `details` (e.g. `{ upserted, deletedMockRows }`) for debugging; do not store secrets or raw provider payloads.

**Verification hook (Step 6 closeout):**
```
1. npx tsc --noEmit → 0 errors
2. npm run test → calendar cleanup test passes
3. Start backend → no automatic mock insertion (check DB: no new mock_provider rows)
4. POST /api/ibkr/calendar/update → mock rows deleted + new rows inserted
5. GET /api/calendar/events → only source='IBKR' (or decided source)
```
- User confirmation needed: **Yes**

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

**Sub-steps (Step 7)**
> **⚠️ BLOCKED** on pending decision: Node.js ↔ IBKR integration method.

Decision #6 note (what changes in Step 7)
- Only `7-3` (the IBKR provider) is decision-dependent. The rest of Step 7 (SQLite upsert + derived metrics + endpoints) stays the same.
- Mapping:
  - Option A (direct Node lib): `ibkrOhlc1dProvider.ts` connects to TWS/Gateway directly from Node.
  - Option B (Python child process): `ibkrOhlc1dProvider.ts` spawns a local Python script and parses newline-delimited JSON results.
  - Option C (Python microservice): `ibkrOhlc1dProvider.ts` calls `http://127.0.0.1:<port>`; the Python service maintains the IBKR session.

| Sub-step | Task | Files | Verification |
|----------|------|-------|--------------|
| 7-1 | Create `ohlcWatchlistRepository.ts` — open DB, query helpers | `terminal/backend/src/services/ohlcWatchlistRepository.ts` | `getOverallMaxDate()` returns `2026-02-20` (current DB state) |
| 7-2 | Add `ensureDerivedColumns()` migration | same file | After running, `PRAGMA table_info(ohlc_1d)` shows derived columns |
| 7-3 | Create `ibkrOhlc1dProvider.ts` — fetch bars from IBKR | `terminal/backend/src/services/ibkrOhlc1dProvider.ts` | For AAPL: returns 1D bars from (maxDate+1) to today |
| 7-4 | Create `ohlcDerivedMetrics.ts` — compute % change columns | `terminal/backend/src/services/ohlcDerivedMetrics.ts` | Unit test: given known OHLC rows, computes expected Change_1d_Pct etc. |
| 7-5 | Wire `GET /api/ibkr/ohlc1d/status` | `terminal/backend/src/server.ts` | `curl http://localhost:8080/api/ibkr/ohlc1d/status` → `{ dbPath, overallMaxDate: "2026-02-20", lastSuccessAt }` |
| 7-6 | Wire `POST /api/ibkr/ohlc1d/update` | `terminal/backend/src/server.ts` | After POST: `overallMaxDate` advances (if new trading days exist) |
| 7-7 | Spot-check derived columns | (runtime) | `SELECT ... Change_1d_Pct ... WHERE Symbol='AAPL' ... LIMIT 5` → non-NULL values |

**Sub-step purpose & description (Step 7)**
- `7-1` Purpose: Encapsulate all access to the canonical OHLC SQLite DB in one place. Description:
  - Open `OHLC_data/ohlc_1d_watchlist.sqlite` read/write with consistent options (busy timeout, foreign keys as needed).
  - Provide query helpers: `getOverallMaxDate()`, and (optionally) `getSymbolMaxDate(symbol)`.
  - Provide `upsertBars(symbol, bars)` using a deterministic mapping (Symbol, Datetime, Open, High, Low, Close, Volume).
  - Error handling: translate low-level SQLite errors into actionable messages; do not swallow failures silently.
- `7-2` Purpose: Make derived-metric storage possible without manual DB rebuilds. Description:
  - Implement `ensureDerivedColumns()` that is idempotent:
    - inspect existing schema via `PRAGMA table_info(ohlc_1d)`
    - `ALTER TABLE ... ADD COLUMN` only for missing columns
  - Migration must be safe on repeated runs and safe on a DB that already contains data.
- `7-3` Purpose: Provide a single “fetch 1D bars” abstraction regardless of how we integrate with IBKR (Decision #6). Description:
  - Input: `{ symbol, startDate, endDate }` where dates are trading dates in `YYYY-MM-DD`.
  - Output: ordered bars with `Datetime` in `YYYY-MM-DD` and numeric OHLCV.
  - Reliability rules:
    - Bounded retries with backoff for transient disconnect/pacing
    - Fail fast on permanent config errors (host/port, permissions)
    - Never log credentials; log only symbol + date range + counts.
- `7-4` Purpose: Compute and persist the News Feed “Changes %” fields from real OHLC (no mock/UI-only). Description:
  - For each affected symbol, load enough history to compute lookbacks (>= 30 prior trading bars).
  - Compute: `Change_1d_Pct`, `Change_From_Open_Pct`, `Change_7d_Pct`, `Change_14d_Pct`, `Change_30d_Pct`.
  - Missing history rule: if a lookback bar does not exist, store `NULL` (do not fabricate).
  - Write derived values back for a bounded safety window (e.g. `min_new_date - 40 bars` → `max_new_date`).
- `7-5` Purpose: Expose a read-only status endpoint so UI/ops can confirm DB freshness. Description:
  - Implement `GET /api/ibkr/ohlc1d/status` which returns:
    - `dbPath` (string), `overallMaxDate` (string or null), `lastSuccessAt` (ISO or null).
  - `overallMaxDate` is sourced from DB `MAX(Datetime)`; `lastSuccessAt` from `update_status(ibkr_ohlc_1d)`.
- `7-6` Purpose: Implement the orchestrator endpoint that performs pull → upsert → derive → status update. Description:
  - Implement `POST /api/ibkr/ohlc1d/update`:
    - Read tickers from the Default Ticker CSV (normalized + de-duplicated)
    - For each ticker, decide the date range to fetch based on DB max date
    - Fetch bars via `ibkrOhlc1dProvider`, upsert, then recompute derived metrics for the affected window
    - On full success, update `update_status(ibkr_ohlc_1d)` with minimal details
  - Partial failure policy must be explicit (choose one and document it in code):
    - (a) fail the whole request, or (b) continue and report per-symbol failures.
- `7-7` Purpose: Provide a concrete “human check” that proves the pipeline produced real derived values. Description:
  - After at least one successful update, run a small SQL query for a known symbol (AAPL) and confirm:
    - rows exist for recent dates
    - derived columns are not all `NULL` for recent rows
  - This is not a substitute for unit tests; it is an operational sanity check.

Option-specific small steps for `7-3` (Decision #6)
- Option A (Node direct):
  - Connect to TWS/IB Gateway from Node, request historical daily bars, map response into `{ Datetime, Open, High, Low, Close, Volume }`.
  - Implement graceful connect/disconnect per request (or a shared singleton if safe).
  - Add a minimal probe path used by tests/dev to verify connectivity.
- Option B (Python child_process):
  - Implement a Python script that prints newline-delimited JSON bars and exits with non-zero code on error.
  - In Node, spawn the script with args (`symbol`, `start`, `end`) and parse stdout robustly (size limits, JSON parse errors).
  - Ensure stderr is captured and surfaced as a clear API error.
- Option C (Python microservice):
  - Implement a small localhost HTTP service with endpoints like `GET /health` and `POST /bars`.
  - Service maintains IBKR connection; Node calls it and receives JSON bars.
  - Add health-check + timeout handling so Node fails fast if the service is down.

**Verification hook (Step 7 closeout):**
```
1. npx tsc --noEmit → 0 errors
2. npm run test → ohlcWatchlistRepository + derived metrics tests pass
3. GET /api/ibkr/ohlc1d/status → shows current DB max date
4. POST /api/ibkr/ohlc1d/update → rows upserted, max date advances
5. Spot-check: SELECT top 5 rows for AAPL → derived columns have real values
```
- User confirmation needed: **Yes**

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

**Sub-steps (Step 8)**
| Sub-step | Task | Files | Verification |
|----------|------|-------|--------------|
| 8-1 | Add window type `data-control` | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts` | Window type compiles; appears in AddTabModal |
| 8-2 | Implement `DataControlWindow.tsx` UI + API calls | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx` | On load, `GET /api/updates/status` is called and rendered |
| 8-3 | Wire into window system | `AddTabModal.tsx`, `App.tsx`, `DraggableWindow.tsx` | Selecting “Data Control” opens the window |
| 8-4 | Implement “running” + error states | same | Button disables + “Running…” appears; errors render inline |
| 8-5 | Hook status refresh after updates | same | After POST, statuses refresh and latest DB date updates |

**Sub-step purpose & description (Step 8)**
- `8-1` Purpose: Make the window type available to the UI. Description:
  - Add `data-control` to the frontend window type union.
  - Ensure the AddTab entry and the DraggableWindow rendering use the exact same type string.
  - Keep naming consistent because it becomes a stable integration point.
- `8-2` Purpose: Implement the operations UI. Description:
  - Implement `DataControlWindow.tsx` with two sections (Price, Calendar) and minimal controls.
  - On mount, call `GET /api/updates/status` and render `lastSuccessAt` values (or `-` if null).
  - Fetch `GET /api/ibkr/ohlc1d/status` for the OHLC “latest date” display.
- `8-3` Purpose: Ensure it’s reachable in the app. Description:
  - Add checkbox entry in `AddTabModal.tsx`, title mapping in `App.tsx`, and rendering switch in `DraggableWindow.tsx`.
  - Ensure the window opens without requiring any IBKR calls until the user clicks an update button.
  - Keep wiring changes minimal and aligned with existing window patterns.
- `8-4` Purpose: Prevent double-click issues and make failures visible. Description:
  - When a POST is in-flight, disable only the relevant button and show “Running…” near it.
  - On failure, render a short error string inside the window; do not introduce new modal UX.
  - Ensure state resets correctly after success/failure so the user can retry.
- `8-5` Purpose: Keep displayed status fresh. Description:
  - After each successful update POST, re-fetch `GET /api/updates/status`.
  - After price updates, also re-fetch `GET /api/ibkr/ohlc1d/status` so “latest DB date” updates.
  - Ensure refresh order is deterministic (POST → refresh GETs) to avoid stale UI.

**Verification hook (Step 8 closeout):**
```
1. Open the Data Control Window
2. Click IBKR Price Data → POST /api/ibkr/ohlc1d/update
3. On success, lastSuccessAt for ibkr_ohlc_1d updates
4. Latest OHLC DB date updates from GET /api/ibkr/ohlc1d/status
5. Click IBKR Calendar Data → POST /api/ibkr/calendar/update; lastSuccessAt updates
```
- User confirmation needed: **Yes**

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

**Sub-steps (Step 9)**
| Sub-step | Task | Files | Verification |
|----------|------|-------|--------------|
| 9-1 | Add/update backend tests for status persistence | `terminal/backend/tests/*` | Status survives restart-simulated reload |
| 9-2 | Add/update backend tests for CSV allowlist + append | `terminal/backend/tests/*` | Rejects disallowed paths; append writes to last row |
| 9-3 | Add/update backend tests for Finnhub mapping | `terminal/backend/tests/*` | Shape validation passes; no secrets in logs |
| 9-4 | Add/update backend tests for calendar mock cleanup | `terminal/backend/tests/*` | Mock rows deleted; only real-source rows remain |
| 9-5 | Manual FE smoke check for new windows | (manual) | Data Control + Default Ticker + News windows render + call APIs |

**Sub-step purpose & description (Step 9)**
- `9-1` Purpose: Prevent regressions in status persistence. Description:
  - Add repository-level tests that write a status row and read it back from the same DB handle.
  - Ensure `lastSuccessAt` stays stable across “new repository instance” creation (restart-like behavior).
  - Confirm all expected keys are present in the API response even when null.
- `9-2` Purpose: Prevent CSV security/behavior regressions. Description:
  - Test allowlist enforcement: reject paths outside `tradigview_screener/original_data/` and traversal attempts.
  - Test append semantics: appended ticker appears as a new last row and is returned by subsequent reads.
  - Test duplicate policy: second insert of same ticker fails (default).
- `9-3` Purpose: Validate Finnhub mapping without leaking secrets. Description:
  - Test that mapping produces required fields (title/time/url/source) and persists with `source='FINNHUB'`.
  - Ensure tests do not print API keys/tokens; use local stubs/mocks for HTTP if needed.
  - Verify `update_status(finhub_news)` updates only on success.
- `9-4` Purpose: Prevent mock calendar data from remaining. Description:
  - Add a test that inserts a small number of `mock_provider` rows, then simulates a successful real update.
  - Verify deletion is idempotent (running cleanup twice still results in zero mock rows).
  - Ensure the cleanup triggers only after a successful update (avoid deleting everything on failures).
- `9-5` Purpose: Validate the end-to-end UI surfaces. Description:
  - Manual smoke test checklist for the three new/changed windows:
    - Default Ticker: loads + add works
    - News Feed: finhub api: renders from backend and no mock
    - Data Control: buttons call endpoints and status refreshes
  - Focus on correctness and “no extra UX” constraints rather than pixel perfection.

**Verification hook (Step 9 closeout):**
```
1. terminal/backend: npm run test → all new/changed tests pass
2. Run backend dev server → exercise key endpoints manually
3. Open web UI → verify windows render and API calls succeed
```
- User confirmation needed: **Yes**

### Open questions (need explicit decisions if behavior must differ)
1) CSV format: which column contains the ticker? → **DECIDED**: header `Ticker` or `Symbol`
2) Duplicates: append duplicates or reject? → **DECIDED**: reject duplicates
3) Path restrictions: only `tradigview_screener/original_data/*.csv` or broader? → **DECIDED**: broader
4) Keep `News` window as EODHD, or migrate it to Finnhub too? → **DECIDED**: keep EODHD + add Finnhub separately

### Execution dependency graph

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        EXECUTION DEPENDENCY GRAPH                          ║
║  Legend: ✅ Done  ⏳ Awaiting user  🚫 BLOCKED  ⬜ Not started             ║
╚══════════════════════════════════════════════════════════════════════════════╝

✅ Step 0 (Data availability audit)
│   ├─ 0-1 Finnhub probes ........................... ✅ Done
│   ├─ 0-2 IBKR TWS probe .......................... ✅ Done
│   ├─ 0-3 Capability matrix ........................ ✅ Done
│   └─ 0-4 Pending IBKR decisions (#5, #6) ......... ⏳ Awaiting user
│         (does NOT block Steps 1-5)
│
▼
⬜ Step 1 (Foundations: update_status + API)
│   ├─ 1-1 update_status table ...................... pre-written (needs verify)
│   ├─ 1-2 updateStatusRepository.ts ................ pre-written (needs verify)
│   ├─ 1-3 Wire GET /api/updates/status ............. ⬜ Not started
│   └─ 1-4 Persistence test ......................... ⬜ Not started
│
├──────────────────────┬──────────────────────────────┐
│    TRACK A           │         TRACK B              │
│    (CSV / Ticker)    │         (Finnhub News)       │
│    No IBKR needed    │         No IBKR needed       │
│                      │                              │
▼                      ▼                              │
⬜ Step 2               ⬜ Step 4                      │
(CSV read+append API)  (Finnhub ingestion backend)    │
│ 2-1 tickerCsvSvc     │ 4-1 finnhubApiKey config     │
│ 2-2 appendTicker     │ 4-2 finnhubNewsProvider      │
│ 2-3 atomic write     │ 4-3 POST /news/pull-finhub   │
│ 2-4 GET /tickers     │ 4-4 update finhub_news       │
│ 2-5 POST /tickers    │ 4-5 verify queryable         │
│ 2-6 update status    │                              │
│                      │                              │
▼                      ▼                              │
⬜ Step 3               ⬜ Step 5                      │
(Default Ticker UI)    (News Feed: finhub api UI)     │
│ 3-1 window type      │ 5-1 remove brave-news        │
│ 3-2 component        │ 5-2 rename → FinnhubNews     │
│ 3-3 DraggableWindow  │ 5-3 remove mock data         │
│ 3-4 AddTabModal      │ 5-4 real fetch               │
│ 3-5 App.tsx title    │ 5-5 "Update" button          │
│ 3-6 smoke test       │ 5-6 AddTabModal label        │
│                      │ 5-7 App.tsx title            │
│                      │ 5-8 DraggableWindow switch   │
│                      │                              │
└──────────┬───────────┘                              │
           │                                          │
           ▼                                          │
   ╔═══════════════════════════════════════╗           │
   ║  🚫 IBKR-DEPENDENT STEPS             ║           │
   ║  Blocked until decisions #5, #6      ║           │
   ╚═══════════════════════════════════════╝           │
           │                                          │
           ├─► 🚫 Step 6 (Calendar ingestion + mock cleanup)
           │      ◄── BLOCKED on decision #5: /calendar data source
           │      6-1 remove mock workers
           │      6-2 remove startCalendarIngestionWorkers
           │      6-3 implement calendar pull (source TBD)
           │      6-4 wire POST /ibkr/calendar/update
           │      6-5 delete mock_provider rows
           │      6-6 update ibkr_calendar status
           │
           ├─► 🚫 Step 7 (IBKR 1D OHLC ingestion)
           │      ◄── BLOCKED on decision #6: Node↔IBKR method
           │      7-1 ohlcWatchlistRepository
           │      7-2 ensureDerivedColumns migration
           │      7-3 ibkrOhlc1dProvider
           │      7-4 ohlcDerivedMetrics
           │      7-5 GET /ibkr/ohlc1d/status
           │      7-6 POST /ibkr/ohlc1d/update
           │      7-7 spot-check derived columns
           │
           ▼
   ⬜ Step 8 (Data Control Window UI)
   │  ◄── requires Steps 6 + 7 completed
   │  8-1 window type + component
   │  8-2 status fetch from /api/updates/status
   │  8-3 update buttons per source
   │  8-4 progress/error display
   │  8-5 smoke test
   │
   ▼
   ⬜ Step 9 (Tests + acceptance checks)
      9-1 backend unit tests (services)
      9-2 API integration smoke test
      9-3 mock cleanup verification
      9-4 ACCEPTANCE_TESTS.md update
      9-5 final agent_log review
```

**Parallel tracks (no IBKR dependency):**
- Track A: Steps 1 → 2 → 3 (CSV/Ticker) — can start immediately
- Track B: Steps 1 → 4 → 5 (Finnhub News) — can start immediately, in parallel with Track A
- Both tracks converge before the IBKR-dependent block (Steps 6-7-8)

**Blocker summary:**
| Decision | Blocks | Options |
|----------|--------|---------|
| #5: /calendar data source | Step 6 | A: Finnhub, B: Client Portal, C: Fundamental sub, D: scope cut |
| #6: Node↔IBKR method | Step 7 | A: @stoqey/ib, B: Python child_process, C: Python microservice |

### Decision #6 — Node↔IBKR integration method (detailed)
Purpose (why we need this)
- Step 7 requires reliable access to IBKR historical data (1D OHLCV). The UI only depends on the resulting SQLite data, but the backend needs a stable way to talk to IBKR.
- This decision selects the **process and communication model** between the Node/TS backend and IBKR (direct vs Python bridge), which affects reliability on Windows, debugging, and deploy/ops.

Minimum requirements (v1)
- Connect to TWS/IB Gateway and request daily historical bars for a symbol.
- Return bars to the Node backend in a stable shape (dates, OHLCV) without leaking any secrets to logs.
- Handle transient failures (disconnects, pacing limits) with bounded retries/backoff; fail fast on permanent misconfig (wrong host/port, missing permissions).

Options (what each one means)
- Option A — **Direct Node library** (e.g. `@stoqey/ib`)
  - What runs: only Node; it opens the IBKR socket connection.
  - Pros: single runtime; no cross-language protocol; simplest deployment.
  - Cons: library stability/type safety varies; reconnect/pacing quirks can be harder to reason about.
- Option B — **Node + Python via `child_process`**
  - What runs: Node spawns a short-lived Python process per request (or per batch) that talks to IBKR and prints JSON; Node parses results.
  - Pros: Python IBKR tooling is often robust; isolates IBKR quirks away from Node.
  - Cons: extra runtime dependency; need a clean JSON protocol and good error propagation.
- Option C — **Node + Python microservice (localhost)**
  - What runs: a long-running Python service keeps the IBKR connection alive; Node calls it over HTTP.
  - Pros: best for connection reuse and pacing control; clean boundary; can queue requests.
  - Cons: adds an additional process to manage (start/stop/health), plus local port configuration.

Decision checklist (what the user should answer)
- Which option (A/B/C) do you prefer?
- Where is TWS/IB Gateway running (same machine as backend?), and what host/port should we use?
- Is installing/running Python on the backend machine acceptable? If yes, do you prefer “spawn on demand” (B) or “always-on service” (C)?

Verification after choosing (what “done” looks like)
- We can run a repeatable probe that fetches AAPL 1D bars for a small date range and returns non-empty results.
- Then Step 7 can safely implement `POST /api/ibkr/ohlc1d/update` for the full ticker list.

---

## KO

> ℹ️ KO 섹션이 최신 기준(authoritative source)입니다. EN 섹션 정합이 필요하면 KO를 기준으로 EN을 업데이트하세요.

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
   - 별도이지만 연관된 결정(이 플랜의 차단 항목 #6): **Node↔IBKR 연동 구현 방식**(Node/TS 백엔드가 이 PC에서 IBKR를 “어떻게” 호출할지).
     - 옵션 A: Node 라이브러리 직결(예: `@stoqey/ib`)로 TWS/Gateway에 연결
     - 옵션 B: Node 오케스트레이터 + 로컬 Python `child_process` (Python이 IBKR와 통신, Node는 JSON 출력 파싱)
     - 옵션 C: Node 오케스트레이터 + 로컬 Python 마이크로서비스(localhost HTTP, Python이 IBKR 세션 유지)
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
| Calendar | 실적 발표일/시간 | IBKR WSH (`wshe_ed`) | ✅ v3 확인: 발표일, 시간대(BMO/AMC), 상태(CONFIRMED/UNCONFIRMED) |
| Calendar | EPS actual + estimate | IBKR WSH (`wshe_eps`) | ✅ v3 확인: `amount_oc`(실제), `estimated_eps`(예상), `change_amount`, `change_percent` |
| Calendar | Revenue(매출) | Finnhub `/stock/earnings` (무료) | ❌ WSH에 매출 필드 없음; Finnhub으로 보충 |
| Calendar | 컨퍼런스콜 | IBKR WSH (`wshe_cc`) | ✅ v2 확인: fiscal_year, quarter, transcript_url |
| Calendar | 컨퍼런스/투자자 이벤트 | IBKR WSH (`wshe_ic`) | ✅ v2 확인: venue, time, status |
| Calendar | M&A | IBKR WSH (`wshe_merg_acq`) | ✅ v2 확인: acquirer/target, status |
| Calendar | 옵션 만기 | IBKR WSH (`wshe_option`) | ✅ v2 확인: 주간/월간 만기일 |
| Calendar | 배당 | IBKR WSH (`wshe_div`) | ✅ v3 확인: `dividend_oc`(금액), `dividend_currency`, `ex_div_date`, `pay_date` |
| Calendar | Analyst rating 필드 | 이용 불가 | ❌ Finnhub `/stock/upgrade-downgrade` 403; WSH에도 없음 |
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

> **검증 프로토콜**
> - 각 단계에는 세부 단계 테이블과 검증 훅을 포함한다.
> - 단계 완료 시: 훅의 명령/체크리스트를 실행해 결과를 사용자에게 공유하고, 사용자 확인 후에만 `agent_log.md`에 `completed (user-confirmed)`로 기록한다.

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

**세부 단계 (0단계)**

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | Finnhub 프로브(profile/news/earnings 등)로 필드 가용성 확인 | ✅ 완료 |
| 0-2 | IBKR TWS 프로브 v1 (OHLCV ✅, Reuters ❌, WSH v1 빈 응답) | ✅ 완료 |
| 0-2b | IBKR WSH 프로브 v2 (conId 기반: 메타데이터 ✅, 이벤트 ✅) | ✅ 완료 |
| 0-2c | IBKR WSH 필드 프로브 v3 (24개 이벤트 타입 전수조사, EPS 발견) | ✅ 완료 |
| 0-3 | `test_data_availability_audit.md`에 capability matrix를 최종 기입 | ✅ 완료 (WSH v3 반영) |
| 0-4 | 미결 결정: `/calendar` 소스 + Node↔IBKR 연동 방식 | ⏳ 사용자 대기 |

**세부 단계 목적/설명 (0단계)**
- `0-1` 목적: UI에 필요한 Finnhub 데이터 필드 유무를 확정. 설명:
  - UI에 필요한 범위(회사 뉴스 + 회사 프로필 + 다음 실적일)를 대상으로 Finnhub 프로브를 실행한다.
  - 심볼은 고정된 소수 세트(AAPL/MSFT/TSLA)로 통일해 결과를 비교 가능하게 만든다.
  - 원본 JSON 응답을 `tmp/probes/`에 “심볼+엔드포인트+날짜”가 드러나는 파일명으로 저장해 재현 가능하게 한다.
  - 필드가 없으면 “없음”을 매트릭스에 명시하고, 추정/대체/가짜 값을 만들지 않는다.
- `0-2` 목적: IBKR TWS 연결 및 OHLC 수집 가능 여부를 1차 확인. 설명:
  - v1 프로브로 host/port/권한이 맞는지와 “일봉 historical bars”가 end-to-end로 동작하는지 확인한다.
  - 실패는 땜질하지 말고 capability gap으로 기록한다(예: Reuters 불가, WSH 빈 응답 등).
  - 설정 변경 전/후 비교를 위해 원시 샘플 또는 요약을 남긴다.
- `0-2b` 목적: `conId` 기반 WSH 메타데이터/이벤트 접근 가능성 확인. 설명:
  - *블로킹* 메타데이터 호출로 결과가 비어있지 않은지(메타데이터 + 이벤트) 확인한다.
  - 심볼별로 대표 샘플(메타데이터 1개 + 이벤트 1개)을 저장해 이후 회귀 점검이 가능하게 한다.
  - 심볼별 편차(일부는 되고 일부는 안 됨)가 있으면 그 사실을 그대로 기록한다.
- `0-2c` 목적: 필요한 재무 필드를 담는 WSH 이벤트 타입을 식별. 설명:
  - UI가 요구하는 필드(EPS actual/estimate, revenue 등)를 기준으로 이벤트 타입을 전수조사한다.
  - 각 이벤트 타입에 어떤 numeric 필드가 존재하는지, 그리고 UI 컬럼 의미와 일치하는지 기록한다.
  - “불가”(예: revenue 없음)는 명확히 적어 Step 6/7 범위를 정직하게 만든다.
- `0-3` 목적: 프로브 결과를 실행 가능한 구현 맵으로 정리. 설명:
  - `test_data_availability_audit.md`의 capability matrix를 *모든 UI 컬럼*에 대해 아래 중 하나로 확정해 채운다:
    - IBKR 제공 / Finnhub 제공 / OHLC에서 계산 / 불가
  - “불가”인 경우에는 후속 의사결정(컬럼 제거 vs 빈 값 허용 vs 대체 공급자)을 함께 적어 둔다.
  - 이후 단계에서 같은 질문을 다시 꺼내지 않도록, 매트릭스를 “참조 가능한 단일 근거”로 유지한다.
- `0-4` 목적: IBKR 의존 단계(Steps 6–8)를 진행하기 위한 전제 확정. 설명: 2가지 결정을 “구현/검증 가능한 수준”으로 확정하고, 운영 디테일까지 함께 확정한다.
  - 결정 #5: `/calendar` 소스 전략(어떤 provider가 캘린더 데이터를 제공하고, 어떤 방식으로 pull할지).
  - 결정 #6: Node↔IBKR 연동 구현 방식(Step 7 및 기타 IBKR 엔드포인트에서 Node/TS 백엔드가 IBKR를 어떤 프로세스/프로토콜로 호출할지).
  - 확인 체크리스트(나중에 “내 PC에서는 되는데”로 막히는 것을 방지):
    - IBKR(TWS/IB Gateway)가 어디서 실행되는지(백엔드와 같은 PC인지), 그리고 무엇을 쓰는지(TWS vs IB Gateway)
    - API host/port(예: `127.0.0.1:7496` live, `127.0.0.1:7497` paper — 실제 값은 사용자 확인)
    - Python 설치/실행이 가능한지(옵션 B/C에 필요), 그리고 “항상 실행되는 로컬 서비스”를 허용하는지(옵션 C)
  - 이 결정의 산출물: 선택한 옵션 + 반복 실행 가능한 “hello IBKR historical bars” 프로브(연결 검증용)를 확정한다.

**WSH v3 핵심 발견(기존 판정 재수정):**
- v1은 `reqWshMetaData()`(비동기) → 빈 응답. v2는 `getWshMetaData()`(블로킹) + `conId` → 풍부한 데이터 확인.
- **`wshe_eps`에 EPS actual + estimate 존재** (`amount_oc`, `estimated_eps`, `change_amount`, `change_percent`).
- **Revenue(매출)는 WSH에 없음** → Finnhub `/stock/earnings`로 보충 필요.

**검증 훅 (0단계 마감):**
- 확인: `test_data_availability_audit.md`가 모든 UI 컬럼에 대해 ✅/❌/Computed를 포함하는지.
- 확인: `tmp/probes/`에 Finnhub/IBKR 프로브 산출물(JSON)이 존재하는지.
- 게이트: 사용자가 2개 미결 결정을 확정해야 6-7단계 진행 가능.

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

**세부 단계 (1단계)**
| 세부 단계 | 작업 | 파일 | 검증 |
|-----------|------|------|------|
| 1-1 | `initDb()`에 `update_status` 테이블 생성 | `terminal/backend/src/db.ts` | 백엔드 시작 후 테이블 존재 확인 (`sqlite_master` 조회) |
| 1-2 | `updateStatusRepository.ts` 구현 | `terminal/backend/src/services/updateStatusRepository.ts` | `npx tsc --noEmit` → 0 errors |
| 1-3 | `GET /api/updates/status` 엔드포인트 연결 | `terminal/backend/src/server.ts` | `curl http://localhost:8080/api/updates/status` → 4개 키 포함 |
| 1-4 | 영구성 검증(값 설정 → 재시작 → 동일 값) | (런타임) | 재시작 후에도 `lastSuccessAt` 동일 |

**세부 단계 목적/설명 (1단계)**
- `1-1` 목적: 업데이트 시각을 DB에 영속화. 설명:
  - `initDb()`에서 `update_status` 테이블을 “재시작해도 안전(idempotent)”하게 생성한다.
  - 스키마는 계획의 핵심 요구( `source_key` PK, ISO timestamp 문자열, JSON details 필드 )를 만족해야 한다.
  - 검증 기준: 런타임에서 백엔드가 사용하는 SQLite 파일에 실제로 테이블이 존재해야 한다.
- `1-2` 목적: 상태 read/write 로직을 한 곳에 모음. 설명:
  - `listUpdateStatuses`, `setLastSuccess`, (선택) `getUpdateStatus`를 제공하는 repository를 만든다.
  - source key는 고정 allowlist( tickers_csv, finhub_news, ibkr_calendar, ibkr_ohlc_1d )로 관리해 키가 흔들리지 않게 한다.
  - `details_json`에는 카운트/최신 날짜 같은 최소 정보만 저장하고, 원문 payload는 저장하지 않는다.
- `1-3` 목적: 프론트/운영에서 상태를 확인 가능하게 함. 설명:
  - `GET /api/updates/status`를 추가하고, 항상 4개 키를 포함하는 안정적인 JSON 형태를 반환한다.
  - 한 번도 성공한 적 없는 키는 `lastSuccessAt: null`로 반환한다(가짜 금지).
  - 이 엔드포인트는 provider 호출 없이 read-only로 유지하고, 시크릿이 포함된 로그를 남기지 않는다.
- `1-4` 목적: 인메모리가 아니라 “재시작 후에도 유지”를 증명. 설명:
  - 테스트 또는 통제된 코드 경로에서 repository로 알려진 timestamp를 저장한다.
  - 백엔드 프로세스를 재시작한 뒤 `GET /api/updates/status`에서 동일 timestamp가 유지되는지 확인한다.
  - 재시작 후 null로 돌아가면 “잘못된 DB 파일 사용/인메모리 저장” 가능성이므로 오류로 간주한다.

**검증 훅 (1단계 마감):**
```
1. npx tsc --noEmit → 0 errors
2. 터미널에서: curl http://localhost:8080/api/updates/status
3. status 값을 1회 기록(set) 후 백엔드 재시작
4. 다시 curl → 동일 lastSuccessAt 확인
```
- 사용자 확인 필요: **Yes**

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

**세부 단계 (2단계)**
| 세부 단계 | 작업 | 파일 | 검증 |
|-----------|------|------|------|
| 2-1 | `readTickersFromCsv()` 구현 + unit tests | `terminal/backend/src/services/tickerCsvService.ts` | `npm run test` → tickerCsvService 관련 테스트 통과 |
| 2-2 | `appendTickerToCsv()` 구현 + 보안/정책 체크 | `terminal/backend/src/services/tickerCsvService.ts` | 비허용 `csvPath`/ticker 거절, 허용 케이스 성공 |
| 2-3 | 원자적 쓰기(temp→replace) + Windows 잠금 재시도 | `tickerCsvService.ts` 내부 헬퍼 | 반복 POST에서도 `EBUSY/EPERM`로 간헐 실패하지 않음 |
| 2-4 | `GET /api/tickers` 구현 | `terminal/backend/src/server.ts` | `curl "http://localhost:8080/api/tickers?csvPath=tradigview_screener/original_data/watch%20lists2_2026-02-22.csv"` → ticker list 반환 |
| 2-5 | `POST /api/tickers/add` 구현 | `terminal/backend/src/server.ts` | POST 성공 후 GET에서 새 ticker가 보임(검증 후 수동으로 CSV 원복) |
| 2-6 | 성공 시 `update_status(tickers_csv)` 갱신 | `updateStatusRepository` | `GET /api/updates/status`에서 `tickers_csv.lastSuccessAt` 업데이트 |

**세부 단계 목적/설명 (2단계)**
- `2-1` 목적: CSV에서 ticker 목록을 안정적으로 추출. 설명:
  - allowlist된 CSV를 파싱하고, 결정된 헤더(`Ticker` 또는 `Symbol`)에서 티커를 추출한다.
  - 결과 티커는 `trim` + 대문자화로 정규화하고, 빈/잘못된 행은 제외한다.
  - 공백이 포함된 파일명(예: `watch lists2_...`)에서도 깨지지 않도록 샘플 CSV로 유닛 테스트를 만든다.
- `2-2` 목적: ticker 추가를 안전하게 수행. 설명:
  - `csvPath` 검증: allowlist root + `.csv` 확장자 + `..` 차단 + 결정적 경로 해석.
  - ticker 검증: 허용 문자셋 + 정규화 + 중복 정책(기본 reject).
  - 오류는 “원인별로 조치 가능한” 메시지가 되도록 한다(예: allowlist 위반, 중복, invalid ticker).
- `2-3` 목적: Windows 파일 잠금 이슈로 인한 간헐적 실패를 방지. 설명:
  - 임시 파일을 같은 디렉토리에 작성한 뒤 원본을 교체하는 원자적 write를 사용한다.
  - `EBUSY/EPERM` 등 일시 오류에 대해 최대 10회, 짧은 백오프로 재시도한다.
  - 영구 실패(경로 불가/권한/파일 없음 등)에는 무작정 재시도하지 않고 빠르게 실패시킨다.
- `2-4` 목적: UI가 읽을 수 있는 조회 API 제공. 설명:
  - `GET /api/tickers`가 `readTickersFromCsv()`를 호출하도록 연결한다.
  - 쿼리 파라미터는 검증 후 거절/허용을 명확히 하고, 임의 파일 읽기를 절대 허용하지 않는다.
  - 응답 형태는 `{ csvPath, tickers: string[] }`로 안정적으로 유지한다.
- `2-5` 목적: UI가 추가할 수 있는 쓰기 API 제공. 설명:
  - `POST /api/tickers/add`가 `appendTickerToCsv()`를 호출하도록 연결한다.
  - 성공 시 UI가 갱신할 수 있도록 “업데이트된 리스트” 또는 충분한 정보를 반환한다.
  - 성공적인 write 이후에만 `update_status(tickers_csv)`를 갱신한다.
- `2-6` 목적: 운영/프론트에서 “성공 시각”을 확인. 설명:
  - 성공 시 `setLastSuccess('tickers_csv', nowIso, details)`로 갱신한다.
  - `details`에는 `{ csvPath, tickerAdded }` 같은 최소 정보만 저장하고 CSV 원문은 저장하지 않는다.
  - `GET /api/updates/status`에서 `tickers_csv.lastSuccessAt`가 변하는지로 검증한다.

**검증 훅 (2단계 마감):**
```
1. 허용 csvPath로 GET /api/tickers → 티커 리스트 확인
2. POST /api/tickers/add로 신규 티커 추가
3. 파일 마지막 row에 추가됐는지 확인
4. 다시 GET /api/tickers → 즉시 반영 확인
5. GET /api/updates/status → tickers_csv lastSuccessAt 업데이트 확인
```
- 사용자 확인 필요: **Yes**

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

**세부 단계 (3단계)**
| 세부 단계 | 작업 | 파일 | 검증 |
|-----------|------|------|------|
| 3-1 | 윈도우 타입 `default-ticker` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts` | 타입 추가 후 빌드/런 정상 |
| 3-2 | `DefaultTickerWindow.tsx` 구현 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DefaultTickerWindow.tsx` | 페이지 로드시 티커 목록 로드/렌더 |
| 3-3 | `DraggableWindow.tsx`에 렌더 스위치 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DraggableWindow.tsx` | AddTab에서 선택 시 창이 뜸 |
| 3-4 | `AddTabModal.tsx`에 체크박스 추가(라벨: “Default Ticker”) | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/AddTabModal.tsx` | UI에서 선택 가능 |
| 3-5 | `App.tsx` 타이틀 매핑 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx` | `default-ticker` → “Default Ticker” |
| 3-6 | 수동 UI 스모크 테스트 | (브라우저) | 창 열기 → 로드 → 추가 → 리스트 갱신 확인 |

**세부 단계 목적/설명 (3단계)**
- `3-1` 목적: 윈도우 시스템에서 선택 가능한 타입을 추가. 설명:
  - `WindowType` 유니온(및 관련 맵)에 `default-ticker`를 추가해 창이 인스턴스화될 수 있게 한다.
  - 제거/변경된 타입과의 불일치(렌더 스위치 누락 등)가 없도록 정리한다.
  - 타입/타이틀/라벨 문자열을 일관되게 유지한다.
- `3-2` 목적: 기본 티커 관리 UI를 제공. 설명:
  - `DefaultTickerWindow.tsx`는 “얇은 클라이언트”로 구현한다: CSV 경로 입력 + Reload + 목록 + Add 폼.
  - 브라우저에서 파일 I/O를 시도하지 않고, Step 2의 백엔드 API(`GET /api/tickers`, `POST /api/tickers/add`)만 호출한다.
  - 백엔드 검증 오류는 창 내부에 인라인으로 간단히 표시한다(모달 금지).
- `3-3` 목적: 데스크톱 레이아웃에서 실제 렌더되게 연결. 설명:
  - `DraggableWindow.tsx`의 switch에 `default-ticker` 케이스를 추가해 `DefaultTickerWindow`를 렌더한다.
  - 다른 창과 동일한 props 패턴(위치/크기/상태)을 유지한다.
  - CSV 경로가 잘못된 경우에도 크래시하지 않고 에러 표시로 처리한다.
- `3-4` 목적: 사용자가 창을 열 수 있게 함. 설명:
  - `AddTabModal.tsx`에 체크박스를 추가해 `default-ticker` 창을 생성할 수 있게 한다.
  - 라벨은 계획대로 “Default Ticker”를 정확히 사용한다.
  - on/off 토글 동작이 기존 창들과 동일하게 동작하는지 확인한다.
- `3-5` 목적: 창 제목을 사람이 읽기 좋게 표시. 설명:
  - `App.tsx`에서 `default-ticker` → “Default Ticker” 타이틀 매핑을 추가한다.
  - 중복/충돌하는 매핑이 없도록 하고, 문자열을 안정적으로 유지한다(수락 테스트 앵커).
  - 창 전환 시 제목이 stale하게 남지 않게 한다.
- `3-6` 목적: end-to-end로 동작 확인. 설명:
  - 창을 열고 `GET /api/tickers` 호출 및 리스트 렌더를 확인한다.
  - 티커를 추가하고 `POST /api/tickers/add` 호출 후 리스트가 갱신되는지 확인한다.
  - 테스트용으로 추가된 티커는 이후 수동으로 원복해 레포 데이터가 오염되지 않게 한다.

**검증 훅 (3단계 마감):**
```
1. Default Ticker Window 열기
2. Reload → GET /api/tickers 호출 확인
3. Add ticker → POST /api/tickers/add 호출 확인
4. 성공 후 목록이 갱신되는지 확인
```
- 사용자 확인 필요: **Yes**

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

**세부 단계 (4단계)**
| 세부 단계 | 작업 | 파일 | 검증 |
|-----------|------|------|------|
| 4-1 | `FINNHUB_API_KEY` 설정 로딩 추가 | `terminal/backend/src/config.ts` | 키가 없으면 명확한 오류(키 값 로그 금지) |
| 4-2 | Finnhub provider 구현 + DB 매핑 | `terminal/backend/src/services/finnhubNewsProvider.ts` | 매핑 결과가 `news_items` insert 스키마에 맞음 |
| 4-3 | `POST /api/news/pull-finhub` 구현 | `terminal/backend/src/server.ts` | 호출 시 `{inserted, skipped, source}` 반환 |
| 4-4 | 성공 시 `update_status(finhub_news)` 갱신 | `updateStatusRepository` | `GET /api/updates/status`에서 lastSuccessAt 업데이트 |
| 4-5 | 적재 데이터 조회 검증 | (런타임) | `GET /api/news?source_names=FINNHUB`로 rows 확인 |

**세부 단계 목적/설명 (4단계)**
- `4-1` 목적: Finnhub 키를 안전하게 로드. 설명:
  - `FINNHUB_API_KEY` 환경변수를 우선 사용하고, 없을 때만 파일 fallback을 사용한다.
  - 키가 없으면 명확히 실패시키되, 키 자체를 절대 로그/출력하지 않는다.
  - config 로딩을 단일화해 provider 코드가 시크릿을 직접 읽지 않도록 한다.
- `4-2` 목적: Finnhub 응답을 DB 뉴스 스키마로 변환. 설명:
  - “company news” 용 Finnhub 호출을 수행한다.
  - 기존 `insertNewsItem()` 계약에 맞게 매핑하고, `source='FINNHUB'`를 일관되게 설정한다.
  - 중복 방지: 기간이 겹쳐도 같은 항목이 재삽입되지 않도록(가능한 범위에서) DB 제약 또는 코드 de-dup를 적용한다.
- `4-3` 목적: 수동으로 적재를 트리거할 수 있게 함. 설명:
  - `POST /api/news/pull-finhub`에서 pull + insert를 수행한다.
  - UI가 표시하기 좋은 작은 요약(`inserted`, `skipped`, `source`)만 반환한다.
  - startup 자동 실행은 하지 않는다(명시적 트리거만).
- `4-4` 목적: “마지막 성공 시각”을 기록. 설명:
  - 성공 시 `update_status(finhub_news).lastSuccessAt = now()`를 저장한다.
  - `details`에는 카운트/기간 같은 최소 정보만 저장하고 원문 응답은 저장하지 않는다.
  - `GET /api/updates/status`로 실제 갱신을 확인한다.
- `4-5` 목적: 적재된 데이터가 실제 조회 가능한지 확인. 설명:
  - `GET /api/news?source_names=FINNHUB` 조회로 아래를 확인한다:
    - row 존재
    - 필수 필드(title/time/url/source 등) 존재
    - `source`가 정확히 `FINNHUB`
  - 데이터가 없다면 UI 문제가 아니라 수집/저장/조회 경로를 먼저 의심한다.

**검증 훅 (4단계 마감):**
```
1. POST /api/news/pull-finhub 실행
2. GET /api/news?source_names=FINNHUB → rows 확인
3. GET /api/updates/status → finhub_news lastSuccessAt 확인
```
- 사용자 확인 필요: **Yes**

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

**세부 단계 (5단계)**
| 세부 단계 | 작업 | 파일 | 검증 |
|-----------|------|------|------|
| 5-1 | 윈도우 타입을 `finhub-news`로 전환(기존 `brave-news` 제거/대체) | `src/app/types.ts` | 타입이 맞게 렌더 스위치됨 |
| 5-2 | 컴포넌트 이름/파일을 `FinnhubNewsWindow`로 정리(권장) | `src/app/components/BraveNewsWindow.tsx` → `FinnhubNewsWindow.tsx` | import 경로 반영 |
| 5-3 | `generateMockData()` 및 synthetic rows 제거 | `FinnhubNewsWindow.tsx` | 코드/런타임에서 mock 생성 경로 없음 |
| 5-4 | 백엔드 기반 fetch로 교체 | `FinnhubNewsWindow.tsx` | `GET /api/news?source_names=FINNHUB`로 렌더 |
| 5-5 | (선택) “Update” 버튼 추가(수동 수집 트리거) | `FinnhubNewsWindow.tsx` | 클릭 시 `POST /api/news/pull-finhub` 호출 후 리스트 갱신 |
| 5-6 | AddTab 라벨을 정확히 `News Feed: finhub api`로 변경 | `src/app/components/AddTabModal.tsx` | UI에 Brave 표기 없음 |
| 5-7 | `App.tsx` title 매핑 추가/수정 | `src/app/App.tsx` | `finhub-news` → `News Feed: finhub api` |
| 5-8 | `DraggableWindow.tsx` 렌더 스위치 연결 | `src/app/components/DraggableWindow.tsx` | `finhub-news`가 `FinnhubNewsWindow`를 렌더 |

**세부 단계 목적/설명 (5단계)**
- `5-1` 목적: Brave 기반 창을 Finnhub 기반으로 전환. 설명:
  - `brave-news` 윈도우 타입을 제거하고 `finhub-news`를 canonical 타입으로 만든다.
  - 타입 레벨 모델(`BraveNews*`)은 Finnhub 기준으로 교체하거나 이미 정의된 `NewsItem`을 재사용한다.
  - 성공 기준: 사용자 UI에서 “Brave” 뉴스 창을 여는 경로가 더 이상 존재하지 않는다.
- `5-2` 목적: 코드 구조/의미를 일치. 설명:
  - 창 컴포넌트를 `FinnhubNewsWindow`로 정리한다(파일 rename 권장).
  - 모든 import/export 경로를 함께 수정해 런타임/빌드 에러가 없게 한다.
  - 의도치 않게 중복 창(Brave/Finnhub 둘 다)이 남지 않게 정리한다.
- `5-3` 목적: mock 데이터 유입을 원천 차단. 설명:
  - `generateMockData()` 및 synthetic seed 배열을 완전히 제거한다.
  - 백엔드가 빈 배열을 주는 경우 “데모 데이터를 만들기” 같은 fallback을 넣지 않는다.
  - 검증 기준: 프론트 소스에서 `generateMockData` 및 관련 mock 헬퍼 검색 결과가 0건.
- `5-4` 목적: 실제 저장된 뉴스만 렌더. 설명:
  - 백엔드 `GET /api/news?source_names=FINNHUB`로부터 데이터를 가져와 그대로 렌더한다.
  - 필드가 없으면 빈 값/`-`로 표시하고, 절대 값을 지어내지 않는다.
  - fetch는 mount 시 1회 + (옵션) 수동 refresh로만 수행해 동작을 예측 가능하게 만든다.
- `5-5` 목적: 필요 시 수동 갱신 제공(옵션). 설명:
  - 창 내부에 “Update” 버튼을 추가하고 `POST /api/news/pull-finhub`로 수집을 트리거한다.
  - POST 성공 후 `GET /api/news?source_names=FINNHUB`로 리스트를 다시 로드한다.
  - 추가 모달 없이 최소 running/error 상태만 표시한다.
- `5-6` 목적: 요청된 라벨 텍스트를 정확히 반영. 설명:
  - `AddTabModal.tsx`에서 라벨을 정확히 `News Feed: finhub api`로 맞춘다(대소문자/공백 포함).
  - 다른 영역에서 “Brave API”가 남아있지 않게 함께 점검한다.
  - 라벨 불일치는 사용자 요구사항 위반이므로 수락 실패로 취급한다.
- `5-7` 목적: 창 제목을 올바르게 표시. 설명:
  - `App.tsx` title 매핑에서 `finhub-news` → `News Feed: finhub api`를 정확히 설정한다.
  - 창 전환 시 제목이 stale하게 남지 않도록 한다.
  - 문자열을 안정적으로 유지해 수락 테스트 앵커로 사용한다.
- `5-8` 목적: 실제 렌더 스위치 연결 보장. 설명:
  - `DraggableWindow.tsx`에 `finhub-news` 케이스를 추가해 `FinnhubNewsWindow`를 렌더한다.
  - 백엔드가 빈 배열을 반환해도 크래시 없이 렌더되어야 한다.
  - `brave-news` 렌더 경로가 남지 않게 한다.

**검증 훅 (5단계 마감):**
```
1. News Feed: finhub api 창 열기
2. 네트워크 탭에서 GET /api/news?source_names=FINNHUB 확인
3. UI에 mock 항목이 나타나지 않는지 확인
```
- 사용자 확인 필요: **Yes**

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

**세부 단계 (6단계)**
> **⚠️ BLOCKED**: `/calendar` 데이터 소스 전략(미결 결정)에 따라 구현 범위/필드가 달라짐.

| 세부 단계 | 작업 | 파일 | 검증 |
|-----------|------|------|------|
| 6-1 | mock 캘린더 worker 로직 제거 | `terminal/backend/src/services/calendarIngestion.ts` | 재시작 후 mock rows가 자동 생성되지 않음 |
| 6-2 | startup의 `startCalendarIngestionWorkers()` 호출 제거 | `terminal/backend/src/server.ts` | 서버 시작 직후 mock insert가 발생하지 않음 |
| 6-3 | `pullCalendarData()` 구현(결정된 소스 기준) | `terminal/backend/src/services/calendarIngestion.ts` | dry-run 또는 단위 테스트 성공 |
| 6-4 | `POST /api/ibkr/calendar/update` 구현 | `terminal/backend/src/server.ts` | `{ upserted, deletedMockRows, source: "IBKR" }` 반환 |
| 6-5 | 첫 성공 후 `mock_provider` rows 삭제 | (DB) | `calendar_events`에서 `source='mock_provider'` count=0 |
| 6-6 | 성공 시 `update_status(ibkr_calendar)` 갱신 | `updateStatusRepository` | `GET /api/updates/status`에서 lastSuccessAt 업데이트 |

**세부 단계 목적/설명 (6단계)**
- `6-1` 목적: 앞으로 mock 캘린더 row가 더 이상 생성되지 않게 한다. 설명:
  - `calendar_events(source='mock_provider')`를 insert하는 모든 timer/worker 코드 경로를 제거한다.
  - 파일 내에 남아있는 mock 헬퍼(예: `generateMock*`, `setInterval`, 하드코딩 샘플 이벤트)가 없도록 정리한다.
  - 성공 기준: 백엔드 재시작만으로는 어떤 row도 추가되지 않고, 오직 명시적 엔드포인트 호출 때만 변경된다.
- `6-2` 목적: 서버 기동 부작용을 제거하여 `/calendar`를 “요청 시 갱신(pull-on-demand)”로 만든다. 설명:
  - 서버 startup 경로에서 `startCalendarIngestionWorkers()` 호출을 삭제한다.
  - 함수가 하위 호환을 위해 남아있더라도 자동 실행되면 안 된다.
  - 검증 포인트: 재시작 후 DB 변화 없음 → `POST /api/ibkr/calendar/update` 호출 시에만 변화.
- `6-3` 목적: 실제 캘린더 pull을 “테스트 가능 + 소스 독립” 형태로 구현한다(결정 의존). 설명:
  - `pullCalendarData()`가 정규화된 이벤트 리스트를 반환하도록 구현한다.
  - 정규화 최소 규칙: 안정적인 ID(또는 결정적 해시), ISO timestamp, symbol, event type, `source` 필드.
  - 선택한 소스에서 제공 불가능한 필드는 명시하고, 절대 가짜 값을 만들지 않는다.
- `6-4` 목적: 운영/UI에서 명시적으로 갱신을 실행할 수 있는 트리거를 제공한다. 설명:
  - `POST /api/ibkr/calendar/update`를 추가하고, pull → upsert → status update를 수행한다.
  - 라우트는 작은 요약(`upserted`, `deletedMockRows`, `source`)을 반환하고 실패 시 non-200을 준다.
  - 시크릿을 로그에 남기지 않고, 카운트/요약 오류만 기록한다.
- `6-5` 목적: 이미 저장된 mock 데이터를 정리해 “IBKR-only” 요구사항을 DB 리셋 없이 만족한다. 설명:
  - *첫 번째* 실제 업데이트 성공 시 `source='mock_provider'` row를 삭제한다.
  - 삭제는 idempotent(여러 번 실행해도 안전)해야 한다.
  - 가능하면 delete+upsert+status update를 하나의 트랜잭션으로 묶는다.
- `6-6` 목적: Data Control Window/운영에서 쓸 “마지막 성공 시각”을 영속 저장한다. 설명:
  - 성공 시 `update_status(ibkr_calendar).lastSuccessAt = now()`를 저장한다.
  - `details`에는 최소 정보(예: `{ upserted, deletedMockRows }`)만 저장하고 시크릿/원문 payload는 저장하지 않는다.

**검증 훅 (6단계 마감):**
```
1. 서버 재시작 → 더 이상 mock 캘린더가 자동 생성되지 않는지 확인
2. POST /api/ibkr/calendar/update 실행
3. GET /api/calendar/events → source=IBKR만 존재하는지 확인
4. GET /api/updates/status → ibkr_calendar lastSuccessAt 확인
```
- 사용자 확인 필요: **Yes**

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

**세부 단계 (7단계)**
> **⚠️ BLOCKED**: Node.js ↔ IBKR 연동 방식(미결 결정) 확정 필요.

결정 #6 메모(7단계에서 무엇이 달라지는가)
- 결정에 따라 달라지는 것은 `7-3`(IBKR provider) 구현 방식뿐이다. 나머지( SQLite upsert + 파생 지표 + API 엔드포인트)는 동일하다.
- 매핑:
  - 옵션 A(Node 직결): `ibkrOhlc1dProvider.ts`가 Node에서 TWS/Gateway에 직접 연결.
  - 옵션 B(Python child_process): `ibkrOhlc1dProvider.ts`가 로컬 Python 스크립트를 실행하고, newline-delimited JSON을 파싱.
  - 옵션 C(Python 마이크로서비스): `ibkrOhlc1dProvider.ts`가 `http://127.0.0.1:<port>`로 호출하고, Python 서비스가 IBKR 세션을 유지.

| 세부 단계 | 작업 | 파일 | 검증 |
|-----------|------|------|------|
| 7-1 | `ohlcWatchlistRepository.ts` 생성(DB 열기/쿼리 헬퍼) | `terminal/backend/src/services/ohlcWatchlistRepository.ts` | `getOverallMaxDate()`가 `2026-02-20`을 반환(현재 DB 상태) |
| 7-2 | `ensureDerivedColumns()` 마이그레이션 추가 | same | `PRAGMA table_info(ohlc_1d)`에 파생 컬럼 존재 |
| 7-3 | `ibkrOhlc1dProvider.ts` 구현(IBKR에서 1D 바 수집) | `terminal/backend/src/services/ibkrOhlc1dProvider.ts` | AAPL 기준 (maxDate+1)~오늘 구간 바 반환 |
| 7-4 | `ohlcDerivedMetrics.ts` 구현(% 변화 계산) | `terminal/backend/src/services/ohlcDerivedMetrics.ts` | 단위 테스트로 Change_1d_Pct 등 기대값 확인 |
| 7-5 | `GET /api/ibkr/ohlc1d/status` 연결 | `terminal/backend/src/server.ts` | `{ dbPath, overallMaxDate: "2026-02-20", lastSuccessAt }` 반환 |
| 7-6 | `POST /api/ibkr/ohlc1d/update` 연결 | `terminal/backend/src/server.ts` | POST 후 `overallMaxDate`가 증가(새 거래일 존재 시) |
| 7-7 | 파생 컬럼 샘플 점검 | (런타임) | `SELECT ... Change_1d_Pct ... WHERE Symbol='AAPL' ... LIMIT 5` → NULL 아님 |

**세부 단계 목적/설명 (7단계)**
- `7-1` 목적: canonical OHLC SQLite DB 접근을 한 곳으로 모아 안전하게 캡슐화한다. 설명:
  - `OHLC_data/ohlc_1d_watchlist.sqlite`를 일관된 옵션으로 read/write 오픈한다(busy timeout 등).
  - 핵심 조회 헬퍼 제공: `getOverallMaxDate()`, (선택) `getSymbolMaxDate(symbol)`.
  - `upsertBars(symbol, bars)`를 결정적 매핑(Symbol, Datetime, Open, High, Low, Close, Volume)으로 구현한다.
  - SQLite 저수준 에러를 “조치 가능한 메시지”로 변환하고, 실패를 조용히 무시하지 않는다.
- `7-2` 목적: DB를 새로 만들지 않고도 파생 지표 컬럼을 저장할 수 있게 한다. 설명:
  - `ensureDerivedColumns()`를 idempotent하게 구현한다:
    - `PRAGMA table_info(ohlc_1d)`로 현재 스키마를 확인
    - 누락 컬럼에 대해서만 `ALTER TABLE ... ADD COLUMN` 수행
  - 반복 실행에 안전하고, 기존 데이터가 있는 DB에도 안전해야 한다.
- `7-3` 목적: Decision #6(연동 방식)과 무관하게 동일한 “1D 바 수집” 추상화를 제공한다. 설명:
  - 입력: `{ symbol, startDate, endDate }` (날짜는 `YYYY-MM-DD`, 트레이딩 날짜 기준)
  - 출력: `Datetime=YYYY-MM-DD` + numeric OHLCV가 포함된 정렬된 bars
  - 신뢰성 규칙:
    - 끊김/페이싱 같은 일시 실패는 제한된 재시도+백오프로 처리
    - host/port/권한 같은 영구 실패는 빠르게 실패시키고 원인을 명확히
    - 시크릿 로그 금지(심볼/기간/카운트만 로그)
- `7-4` 목적: News Feed의 “Changes %”를 실제 OHLC 기반으로 계산/저장한다(mock/UI-only 금지). 설명:
  - 심볼별로 lookback 계산에 필요한 과거 구간(최소 30거래일 이전)을 로드한다.
  - 계산 컬럼: `Change_1d_Pct`, `Change_From_Open_Pct`, `Change_7d_Pct`, `Change_14d_Pct`, `Change_30d_Pct`.
  - 히스토리 부족 규칙: lookback bar가 없으면 `NULL`로 저장(가짜 금지).
  - 안전 구간을 제한해 재계산한다(예: `min_new_date - 40 bars` → `max_new_date`).
- `7-5` 목적: UI/운영이 DB 최신 상태를 확인할 수 있는 read-only status API를 제공한다. 설명:
  - `GET /api/ibkr/ohlc1d/status`는 아래를 반환:
    - `dbPath`(string), `overallMaxDate`(string 또는 null), `lastSuccessAt`(ISO 또는 null)
  - `overallMaxDate`는 DB `MAX(Datetime)` 기반, `lastSuccessAt`는 `update_status(ibkr_ohlc_1d)` 기반.
- `7-6` 목적: pull → upsert → derive → status update를 한 번에 수행하는 오케스트레이터 엔드포인트를 구현한다. 설명:
  - `POST /api/ibkr/ohlc1d/update` 구현:
    - Default Ticker CSV에서 티커를 읽고 정규화+중복 제거
    - DB max date를 기준으로 심볼별 수집 기간을 결정
    - `ibkrOhlc1dProvider`로 bars fetch → upsert → 영향 구간 파생 지표 재계산
    - 전체 성공 시 `update_status(ibkr_ohlc_1d)`를 최소 details로 갱신
  - 부분 실패 정책을 명시해야 한다(코드에 문서화):
    - (a) 전체 실패로 처리, 또는 (b) 가능한 심볼은 계속 진행하고 per-symbol 실패를 리포트
- `7-7` 목적: 파이프라인이 “실제 파생 값”을 만들었음을 사람이 확인할 수 있는 구체 체크를 제공한다. 설명:
  - 최소 1회 성공 업데이트 후, 알려진 심볼(AAPL)로 작은 SQL을 실행해 아래를 확인:
    - 최근 날짜 row 존재
    - 파생 컬럼이 최근 row에서 전부 `NULL`이 아님
  - 유닛 테스트의 대체가 아니라 운영 sanity-check다.

`7-3` 옵션별 small steps(결정 #6)
- 옵션 A(Node 직결):
  - Node에서 TWS/IB Gateway에 연결 후 historical daily bars 요청.
  - 응답을 `{ Datetime, Open, High, Low, Close, Volume }`로 매핑.
  - 요청 단위 connect/disconnect(또는 안전한 singleton) 전략을 선택하고 최소 프로브로 연결 검증.
- 옵션 B(Python child_process):
  - Python 스크립트가 newline-delimited JSON bars를 출력하고, 오류 시 non-zero exit code로 종료.
  - Node는 스크립트를 args(`symbol`, `start`, `end`)로 실행하고 stdout 파싱을 견고하게 처리(size limit, JSON parse error).
  - stderr를 캡처하여 API 에러 메시지로 명확히 노출.
- 옵션 C(Python 마이크로서비스):
  - localhost HTTP 서비스로 `GET /health`, `POST /bars` 같은 엔드포인트 제공.
  - 서비스가 IBKR 세션을 유지하고 Node는 HTTP로 호출해 JSON bars를 받는다.
  - Node는 헬스체크/타임아웃을 넣어 서비스 다운 시 빠르게 실패하도록 한다.

**검증 훅 (7단계 마감):**
```
1. npx tsc --noEmit → 0 errors
2. npm run test → ohlcWatchlistRepository/파생 계산 테스트 통과
3. GET /api/ibkr/ohlc1d/status → DB max date 확인
4. POST /api/ibkr/ohlc1d/update → 업서트 및 max date 증가 확인
5. AAPL 최근 5행 SELECT → 파생 컬럼이 실제 값인지 확인
```
- 사용자 확인 필요: **Yes**

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

**세부 단계 (8단계)**
| 세부 단계 | 작업 | 파일 | 검증 |
|-----------|------|------|------|
| 8-1 | 윈도우 타입 `data-control` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts` | AddTab에서 선택 가능 |
| 8-2 | `DataControlWindow.tsx` 구현(UI + API 호출) | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx` | 로드시 `GET /api/updates/status` 호출/렌더 |
| 8-3 | 윈도우 시스템 연결 | `AddTabModal.tsx`, `App.tsx`, `DraggableWindow.tsx` | 창이 정상 렌더 |
| 8-4 | 실행 중/에러 상태 표시 | same | 버튼 비활성화 + “Running…” + 에러 인라인 표시 |
| 8-5 | 업데이트 후 status/DB date 재조회 | same | POST 성공 후 timestamp와 overallMaxDate 갱신 |

**세부 단계 목적/설명 (8단계)**
- `8-1` 목적: 윈도우 타입을 UI에서 선택 가능하게 추가. 설명:
  - 프론트 window type 유니온에 `data-control`을 추가한다.
  - AddTab의 타입 문자열과 DraggableWindow의 렌더 케이스 문자열이 완전히 일치해야 한다.
  - 네이밍이 안정적이어야 이후 통합 포인트로 안전하게 쓸 수 있다.
- `8-2` 목적: 운영용 컨트롤 UI 제공. 설명:
  - `DataControlWindow.tsx`에 Price/Calendar 2개 섹션과 최소 컨트롤을 구현한다.
  - mount 시 `GET /api/updates/status`를 호출해 `lastSuccessAt`를 렌더한다(null이면 `-`).
  - OHLC 최신 날짜 표시를 위해 `GET /api/ibkr/ohlc1d/status`도 로드한다.
- `8-3` 목적: 앱에서 접근/렌더가 되도록 연결. 설명:
  - `AddTabModal.tsx` 체크박스, `App.tsx` 타이틀 매핑, `DraggableWindow.tsx` 렌더 스위치를 연결한다.
  - 사용자가 버튼을 누르기 전에는 IBKR 호출이 발생하지 않도록 한다(열기만으로 POST 금지).
  - 기존 윈도우 패턴을 유지하며 변경을 최소화한다.
- `8-4` 목적: 중복 실행 방지 및 실패 가시화. 설명:
  - POST 실행 중에는 해당 버튼만 disable하고 버튼 근처에 “Running…”을 표시한다.
  - 실패 시 창 내부에 짧은 에러 메시지를 인라인으로 표시하고, 모달을 추가하지 않는다.
  - 성공/실패 후 상태가 정상적으로 복구돼 재시도 가능해야 한다.
- `8-5` 목적: 표시되는 상태를 최신으로 유지. 설명:
  - POST 성공 후 `GET /api/updates/status`를 재조회한다.
  - 가격 업데이트 성공 후에는 `GET /api/ibkr/ohlc1d/status`도 재조회해 DB 최신 날짜를 갱신한다.
  - refresh 순서를 고정(POST → GET 재조회)해 stale UI를 피한다.

**검증 훅 (8단계 마감):**
```
1. Data Control Window 열기
2. IBKR Price Data 클릭 → POST /api/ibkr/ohlc1d/update
3. 성공 후 ibkr_ohlc_1d lastSuccessAt 갱신 확인
4. GET /api/ibkr/ohlc1d/status로 최신 DB date 갱신 확인
5. IBKR Calendar Data 클릭 → POST /api/ibkr/calendar/update; lastSuccessAt 갱신 확인
```
- 사용자 확인 필요: **Yes**

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

**세부 단계 (9단계)**
| 세부 단계 | 작업 | 파일 | 검증 |
|-----------|------|------|------|
| 9-1 | status 영구성 관련 테스트 추가/수정 | `terminal/backend/tests/*` | 재조회 시 동일 값 반환 |
| 9-2 | CSV allowlist + append 테스트 추가/수정 | `terminal/backend/tests/*` | 비허용 경로 거절, 마지막 행 append 확인 |
| 9-3 | Finnhub 매핑 테스트 추가/수정 | `terminal/backend/tests/*` | 응답 shape 검증 + 시크릿 누출 없음 |
| 9-4 | 캘린더 mock 정리 테스트 추가/수정 | `terminal/backend/tests/*` | `mock_provider` rows 삭제 확인 |
| 9-5 | 프론트 수동 스모크(윈도우 렌더 + API 호출) | (수동) | Data Control/Default Ticker/News 창이 정상 동작 |

**세부 단계 목적/설명 (9단계)**
- `9-1` 목적: update_status 영속성 회귀 방지. 설명:
  - repository 레벨 테스트로 status row를 쓰고 같은 DB 핸들에서 다시 읽어오는 것을 보장한다.
  - “새 repository 인스턴스 생성”을 통해 재시작에 준하는 동작에서도 값이 유지되는지 확인한다.
  - API 응답은 null이어도 모든 키가 존재해야 한다(키 누락 방지).
- `9-2` 목적: CSV 보안/동작 회귀 방지. 설명:
  - allowlist 강제: `tradigview_screener/original_data/` 밖 경로 및 traversal 시도를 거절하는 테스트.
  - append 의미: 마지막 행에 새 row로 추가되고, 이후 read에서 반환되는 테스트.
  - 중복 정책: 같은 티커 2회 추가 시 2번째는 실패하는 테스트(기본).
- `9-3` 목적: Finnhub mapping의 형상 검증 + 시크릿 누출 방지. 설명:
  - 매핑 결과가 필수 필드(title/time/url/source 등)를 포함하고 `source='FINNHUB'`로 저장되는지 검증한다.
  - 테스트에서 API 키/토큰이 출력되지 않도록 하고, 필요 시 HTTP는 스텁/목으로 대체한다.
  - `update_status(finhub_news)`가 성공 시에만 갱신되는지도 확인한다.
- `9-4` 목적: 캘린더 mock 데이터 잔존 방지. 설명:
  - `mock_provider` row를 소수 삽입한 뒤 “성공 업데이트” 시나리오에서 삭제가 수행되는지 테스트한다.
  - 삭제는 idempotent해야 한다(2번 실행해도 결과는 0 유지).
  - 실패 시에는 무분별 삭제가 일어나지 않게 “성공 후에만 cleanup” 조건을 검증한다.
- `9-5` 목적: UI 통합 동작 확인. 설명:
  - 수동 스모크 체크리스트(3개 창):
    - Default Ticker: load + add 동작
    - News Feed: finhub api: 백엔드 기반 렌더 + mock 없음
    - Data Control: 버튼 호출 + 상태 refresh
  - 픽셀/스타일보다 “정확성 + 추가 UX 금지” 조건을 중심으로 확인한다.

**검증 훅 (9단계 마감):**
```
1. terminal/backend: npm run test → 통과
2. 백엔드 dev 서버로 주요 엔드포인트 수동 호출
3. 웹 UI 열어 신규/변경 윈도우가 API 호출하는지 확인
```
- 사용자 확인 필요: **Yes**

### 미확정 사항(명시 결정 필요)
1) CSV에서 티커가 들어있는 컬럼 규칙 → **결정됨**: 헤더 `Ticker` 또는 `Symbol`
2) 중복 티커 처리(append vs reject) → **결정됨**: 중복 reject
3) 허용 csvPath 범위(기본 제한 vs 확대) → **결정됨**: 확대
4) 기존 `News` 윈도우(EODHD)를 유지할지, Finnhub로 같이 전환할지? → **결정됨**: EODHD 유지 + Finnhub 별도 추가
### 실행 의존성 그래프

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                          실행 의존성 그래프                                  ║
║  범례: ✅ 완료  ⏳ 사용자 확인 대기  🚫 차단됨  ⬜ 미시작                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

✅ Step 0 (데이터 가용성 감사)
│   ├─ 0-1 Finnhub 프로브 .......................... ✅ 완료
│   ├─ 0-2 IBKR TWS 프로브 ......................... ✅ 완료
│   ├─ 0-3 능력 매트릭스 ............................ ✅ 완료
│   └─ 0-4 IBKR 미결정 사항 (#5, #6) ............... ⏳ 사용자 확인 대기
│         (Steps 1-5는 차단하지 않음)
│
▼
⬜ Step 1 (기반: update_status + API)
│   ├─ 1-1 update_status 테이블 ..................... 사전 작성됨 (검증 필요)
│   ├─ 1-2 updateStatusRepository.ts ................ 사전 작성됨 (검증 필요)
│   ├─ 1-3 GET /api/updates/status 연결 ............. ⬜ 미시작
│   └─ 1-4 영속성 테스트 ............................ ⬜ 미시작
│
├──────────────────────┬──────────────────────────────┐
│    트랙 A            │         트랙 B               │
│    (CSV / Ticker)    │         (Finnhub News)       │
│    IBKR 불필요       │         IBKR 불필요          │
│                      │                              │
▼                      ▼                              │
⬜ Step 2               ⬜ Step 4                      │
(CSV 읽기+추가 API)    (Finnhub 수집 백엔드)          │
│ 2-1 tickerCsvSvc     │ 4-1 finnhubApiKey 설정       │
│ 2-2 appendTicker     │ 4-2 finnhubNewsProvider      │
│ 2-3 atomic write     │ 4-3 POST /news/pull-finhub   │
│ 2-4 GET /tickers     │ 4-4 finhub_news 상태 갱신    │
│ 2-5 POST /tickers    │ 4-5 조회 검증                │
│ 2-6 상태 갱신        │                              │
│                      │                              │
▼                      ▼                              │
⬜ Step 3               ⬜ Step 5                      │
(Default Ticker UI)    (News Feed: finhub api UI)     │
│ 3-1 window type      │ 5-1 brave-news 제거          │
│ 3-2 컴포넌트         │ 5-2 FinnhubNews로 이름변경   │
│ 3-3 DraggableWindow  │ 5-3 mock 데이터 제거         │
│ 3-4 AddTabModal      │ 5-4 실제 fetch               │
│ 3-5 App.tsx 제목     │ 5-5 "Update" 버튼            │
│ 3-6 스모크 테스트    │ 5-6 AddTabModal 라벨         │
│                      │ 5-7 App.tsx 제목             │
│                      │ 5-8 DraggableWindow switch   │
│                      │                              │
└──────────┬───────────┘                              │
           │                                          │
           ▼                                          │
   ╔═══════════════════════════════════════╗           │
   ║  🚫 IBKR 의존 단계                    ║           │
   ║  결정 #5, #6 해결 전까지 차단됨       ║           │
   ╚═══════════════════════════════════════╝           │
           │                                          │
           ├─► 🚫 Step 6 (캘린더 수집 + mock 정리)
           │      ◄── 결정 #5 대기: /calendar 데이터 소스
           │      6-1 mock worker 제거
           │      6-2 startCalendarIngestionWorkers 제거
           │      6-3 캘린더 데이터 pull 구현 (소스 미정)
           │      6-4 POST /ibkr/calendar/update 연결
           │      6-5 mock_provider 행 삭제
           │      6-6 ibkr_calendar 상태 갱신
           │
           ├─► 🚫 Step 7 (IBKR 1D OHLC 수집)
           │      ◄── 결정 #6 대기: Node↔IBKR 연동 방식
           │      7-1 ohlcWatchlistRepository
           │      7-2 ensureDerivedColumns 마이그레이션
           │      7-3 ibkrOhlc1dProvider
           │      7-4 ohlcDerivedMetrics
           │      7-5 GET /ibkr/ohlc1d/status
           │      7-6 POST /ibkr/ohlc1d/update
           │      7-7 파생 컬럼 검증
           │
           ▼
   ⬜ Step 8 (Data Control Window UI)
   │  ◄── Steps 6 + 7 완료 필요
   │  8-1 window type + 컴포넌트
   │  8-2 /api/updates/status에서 상태 fetch
   │  8-3 소스별 update 버튼
   │  8-4 진행률/에러 표시
   │  8-5 스모크 테스트
   │
   ▼
   ⬜ Step 9 (테스트 + 수락 검사)
      9-1 백엔드 유닛 테스트 (서비스)
      9-2 API 통합 스모크 테스트
      9-3 mock 정리 검증
      9-4 ACCEPTANCE_TESTS.md 갱신
      9-5 최종 agent_log 검토
```

**병렬 트랙 (IBKR 의존 없음):**
- 트랙 A: Steps 1 → 2 → 3 (CSV/Ticker) — 즉시 시작 가능
- 트랙 B: Steps 1 → 4 → 5 (Finnhub News) — 트랙 A와 병렬로 즉시 시작 가능
- 두 트랙은 IBKR 의존 블록(Steps 6-7-8) 전에 합류

**차단 요약:**
| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| #5: /calendar 데이터 소스 | Step 6 | A: Finnhub, B: Client Portal, C: Fundamental 구독, D: 범위 축소 |
| #6: Node↔IBKR 연동 방식 | Step 7 | A: @stoqey/ib, B: Python child_process, C: Python 마이크로서비스 |

### 결정 #6 — Node↔IBKR 연동 구현 방식(상세)
목적(왜 필요한가)
- 7단계는 IBKR에서 일봉(1D) OHLCV를 안정적으로 받아야 한다. 프론트는 최종 SQLite만 보지만, 백엔드는 IBKR와 통신하는 “안정적인 실행 모델”이 필요하다.
- 이 결정은 Node/TS 백엔드와 IBKR 사이의 **프로세스/통신 모델**(직결 vs Python 브리지)을 정한다. Windows 환경에서의 안정성, 디버깅, 운영(프로세스 관리)에 직접 영향을 준다.

v1 최소 요구사항
- TWS/IB Gateway에 연결하여 특정 심볼의 1D historical bars를 요청할 수 있어야 한다.
- 결과를 Node 백엔드로 안정적으로 전달(날짜/시가/고가/저가/종가/거래량)하고, 시크릿/민감정보를 로그에 남기지 않는다.
- 일시 장애(끊김, 페이싱 제한)는 제한된 재시도/백오프로 처리하고, 영구 실패(호스트/포트 오입력, 권한 부족)는 빠르게 실패시키며 원인을 명확히 한다.

선택지(각 옵션이 의미하는 것)
- 옵션 A — **Node 라이브러리 직결**(예: `@stoqey/ib`)
  - 실행 구조: Node만 실행되며 Node가 IBKR 소켓 연결을 직접 연다.
  - 장점: 단일 런타임, 언어 간 프로토콜 불필요, 배포 단순.
  - 단점: 라이브러리 안정성/타입/재연결/페이싱 이슈를 직접 다뤄야 할 수 있음.
- 옵션 B — **Node + Python `child_process`**
  - 실행 구조: Node가 요청 시 로컬 Python 프로세스를 실행 → Python이 IBKR 통신 후 JSON 출력 → Node가 파싱.
  - 장점: Python 쪽 IBKR 툴링이 비교적 탄탄한 경우가 많음; IBKR 특이사항을 Python 쪽으로 격리.
  - 단점: Python 런타임 의존; JSON 프로토콜/에러 전달을 깔끔히 설계해야 함.
- 옵션 C — **Node + Python 마이크로서비스(localhost)**
  - 실행 구조: Python 서비스가 상시 실행되며 IBKR 세션을 유지; Node는 HTTP로 호출.
  - 장점: 연결 재사용/페이싱 제어에 유리; 경계가 명확; 요청 큐잉/재시도 설계가 쉬움.
  - 단점: 추가 프로세스 관리(시작/중지/헬스체크) + 로컬 포트 설정이 필요.

결정 체크리스트(사용자가 답해야 할 것)
- 옵션 A/B/C 중 무엇을 선택할지?
- TWS/IB Gateway가 어디서 실행 중인지(백엔드와 같은 PC인지), 그리고 host/port는 무엇인지?
- Python 설치/실행이 가능한지? 가능하다면 (B) 온디맨드 실행 vs (C) 상시 서비스 중 어느 쪽을 선호하는지?

선택 후 검증(“결정 완료”의 정의)
- AAPL 같은 단일 심볼로 짧은 구간의 1D bar를 반복 호출할 수 있는 프로브가 있고, 결과가 비어있지 않음을 확인.
- 그 다음 7단계의 `POST /api/ibkr/ohlc1d/update`를 전체 티커 대상으로 안전하게 확장한다.
