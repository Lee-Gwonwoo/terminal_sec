# Plan — terminal_ui_ver2_finhub (Frontend)

## EN

> ⚠️ EN section may be outdated — KO section is the authoritative source.

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

### Reader guide (non-engineer friendly)
This plan is written for implementation, but you can review/verify progress even if you don’t write code.

How to read each Step
- Each Step is a deliverable (a piece of functionality you can see in the UI or confirm via an API).
- Each Step contains:
  - A sub-step table (what to do)
  - A purpose/description block (why it matters, what “done” means)
  - A verification hook (how to confirm it worked)

Two kinds of verification
- “Developer verification” uses commands like `curl`, DB queries, and TypeScript checks.
- “Human verification” is what a non-developer can do: open the UI, click the required buttons, and confirm the label/timestamp changes.

Acceptance snapshot (what the finished UI looks like)
- Default Ticker Window
  - Shows tickers loaded from the selected CSV path.
  - Adding a ticker updates the list and appends to the CSV (via backend).
- News window
  - The label shows exactly: `news feed:finhub api`.
  - The table shows real stored news pulled from Finnhub (no mock rows).
- Data Control Window
  - Contains exactly two buttons: `IBKR Price Data` and `IBKR Calendar Data`.
  - Each button updates data through the backend and updates a “last successful update” date/time.

Quick verification checklist (without reading code)
1) Start the app (backend + web UI) and open the UI URL shown in the terminal.
2) Confirm the News window label is `news feed:finhub api`.
3) Confirm the Default Ticker window lists tickers, and adding a ticker makes it appear immediately.
4) If IBKR is configured: click `IBKR Price Data` and/or `IBKR Calendar Data` and confirm “last successful update” changes.

Glossary (plain language)
- Backend: the Node/TypeScript server (`terminal/backend`) that talks to databases, reads/writes CSVs, and calls external APIs.
- Frontend: the UI app (`termina_web/figma_code/terminal_ui_ver2_finhub`) that users interact with.
- API endpoint: a URL the frontend calls on the backend (example: `GET /api/updates/status`).
- SQLite DB: a single-file local database (example: `OHLC_data/ohlc_1d_watchlist.sqlite`).
- Ingestion / pull: downloading data from a provider (Finnhub/IBKR) and storing it locally.
- Upsert: “insert if missing, otherwise update” so repeated runs don’t create duplicates.
- OHLCV (1D): daily Open/High/Low/Close/Volume bars.
- Derived metrics: fields computed from stored OHLC (e.g., percent changes) — not mocked.
- “No mock” policy: if real data is missing, we store `null` / show blank; we do not fabricate values.

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
- “news feed:finhub api” window (currently implemented as `BraveNewsWindow` mock):
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

Non-engineer milestones (what you can visually confirm, and when)
- Some early steps are “backend-only” (you mainly confirm via an API). UI-visible milestones appear after the window steps.
- Use this as a quick “are we on track?” checklist:

| Milestone | Becomes visible after | What to do (human check) | Expected result |
|----------|------------------------|--------------------------|----------------|
| Default Ticker Window works | Step 2 + Step 3 | Open Default Ticker Window → add a ticker | Ticker appears immediately; persists via backend CSV append |
| News window uses Finnhub (no mock) | Step 4 + Step 5 | Open News window | Label is `news feed:finhub api`; rows are real stored news (not generated) |
| “Changes %” has real computed numbers | Step 7 | Open News window and inspect “Changes %” cell | Values match OHLC-derived calculations; missing history shows blank/`null` |
| Data Control Window buttons update timestamps | Step 8 (+ Step 6/7/IBKR configured) | Click `IBKR Price Data` / `IBKR Calendar Data` | “last successful update” updates on success; failures are shown clearly |

> Legend: ✅ 구현+사용자확인 완료 · ⏳ 구현완료, 사용자확인 대기 · ⬜ 미착수 · 🚫 선행조건 미충족(차단)

#### ⏳ Step 0 — Data availability audit (IBKR + Finnhub vs UI columns)
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
| 0-4 | Decisions: /calendar source + Node↔IBKR method | ✅ Done (결정 #5/#6 확정) |

**Sub-step purpose & description (Step 0)**
- `0-1` Purpose: Confirm which Finnhub fields exist for the UI. Description:
  - Run Finnhub probes for the specific UI needs (company news + company profile + next earnings date), using a small fixed symbol set (AAPL/MSFT/TSLA).
  - Save raw JSON responses under `tmp/probes/` with clear filenames (symbol + endpoint + date) so results are reproducible.
  - Record “missing field” outcomes explicitly in the matrix; do not infer/approximate values.
  - Done when (observable): `tmp/probes/` contains the expected Finnhub JSON samples and the matrix has explicit Yes/No entries for Finnhub fields.
  - Human check: open a couple of JSON files and verify they contain real API responses (not placeholders) and that the matrix references them.
  - Common issues to watch: forgetting to store raw samples; accidentally printing tokens/keys in console logs.
- `0-2` Purpose: Confirm baseline IBKR TWS connectivity and OHLC retrieval. Description:
  - Run the v1 probe to validate host/port, permissions, and that historical daily bars can be fetched end-to-end.
  - Record failures as “capability gaps” (e.g., Reuters unavailable, WSH empty in v1) rather than patching around them.
  - Save raw samples (or concise summaries) for later comparison when changing settings.
  - Done when (observable): the probe produces a non-empty daily-bar sample for at least one symbol and records any missing capabilities explicitly.
  - Human check: confirm the probe output includes a date range and OHLCV values (not empty arrays).
  - Common issues to watch: connecting to the wrong TWS/Gateway port (paper vs live); permissions not enabled in TWS.
- `0-2b` Purpose: Confirm WSH metadata/events are accessible via `conId`. Description:
  - Use the *blocking* metadata call and verify results are non-empty (metadata + events).
  - Persist one representative metadata sample + one event sample per symbol so we can re-check after code changes.
  - Note any per-symbol differences (some tickers may have metadata while others do not).
  - Done when (observable): for at least one symbol, you have saved a metadata JSON and an events JSON that are clearly non-empty.
  - Human check: open the saved JSON and verify it contains fields like event types / identifiers (not `{}` or `[]`).
  - Common issues to watch: using the non-blocking call and misreading “empty now” as “not available”; mixing symbols without clear filenames.
- `0-2c` Purpose: Identify which WSH event types contain required financial fields. Description:
  - Survey event types against the UI-required fields (EPS actual/estimate, revenue, etc.).
  - For each event type, record which numeric fields exist and whether the semantics match the UI column meanings.
  - Capture “not available” results explicitly (e.g., revenue not present) so Step 6/7 scope is honest.
  - Done when (observable): the matrix (or a companion note) lists each required UI field and whether WSH provides it, with an example payload reference.
  - Human check: confirm at least one example shows EPS actual/estimate, and that revenue is explicitly marked as not present (if confirmed).
  - Common issues to watch: confusing similarly named fields; assuming a field exists because it appears for one symbol only.
- `0-3` Purpose: Turn probe results into a concrete implementation map. Description:
  - Fill the capability matrix in `test_data_availability_audit.md` for *every* UI column using one of: IBKR / Finnhub / Computed-from-OHLC / Not available.
  - If “Not available”, also write the required follow-up decision (remove column vs accept blank vs alternate provider).
  - Keep the matrix stable and referenceable so later steps do not re-open the same questions.
  - Done when (observable): every UI column has exactly one final classification and there are no “TBD” cells left.
  - Human check: scroll the matrix top-to-bottom and confirm there are no empty rows/cells for any UI column.
  - Common issues to watch: leaving ambiguous “maybe” entries; not linking “not available” items to a concrete decision.
- `0-4` Purpose: Unblock IBKR-dependent steps (Steps 6–8). Description: make two explicit decisions and capture the operational details needed to implement and verify them:
  - Decision #5: `/calendar` source strategy (what provider supplies the calendar data, and how it will be pulled).
  - Decision #6: Node↔IBKR integration method (how the Node/TS backend will call IBKR for Step 7 and other IBKR endpoints).
  - Confirmation checklist (so we don’t block later on “it works on your machine” issues):
    - Where IBKR runs (same PC as backend vs another host), and which component is used (TWS vs IB Gateway)
    - Host/port for the API (typical examples: `127.0.0.1:7496` live, `127.0.0.1:7497` paper — user confirms actual)
    - Whether Python is allowed on the backend machine (only needed for options B/C), and whether a long-running local service is acceptable (option C)
  - Output of this decision: record the chosen option + a minimal “hello IBKR historical bars” probe that can be run repeatedly to validate connectivity.
  - Done when (observable): the plan records the chosen options and includes exact host/port + a repeatable probe command/script.
  - Human check: a non-engineer can read the recorded host/port and verify it matches what is configured in TWS/Gateway settings.
  - Common issues to watch: deciding “Option B/C” without confirming Python availability; leaving host/port unspecified and blocking later work.

**WSH v3 key finding (corrects earlier assessment):**
- v1 used `reqWshMetaData()` (non-blocking) → empty. v2 used `getWshMetaData()` (blocking) + `conId` → rich data available.
- **`wshe_eps` includes EPS actual + estimate** (`amount_oc`, `estimated_eps`, `change_amount`, `change_percent`).
- **Revenue is NOT present in WSH** → needs Finnhub `/stock/earnings` supplement.

**Verification hook (Step 0 closeout):**
- Check: `test_data_availability_audit.md` covers every UI column with a definitive ✅/❌/Computed.
- Check: probe JSON files exist in `tmp/probes/` for Finnhub and IBKR (v1 + v2).
- Gate: User must confirm the 2 pending decisions before Steps 6-7 can proceed.

#### ⏳ Step 1 — Foundations: update status storage + API
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

| Sub-step | Task | Files | Verification | Status |
|----------|------|-------|--------------|--------|
| 1-1 | `update_status` table CREATE in `initDb()` | `terminal/backend/src/db.ts` | Start backend → table exists in `app.db` (query: `SELECT name FROM sqlite_master WHERE name='update_status'`) | ✅ |
| 1-2 | `updateStatusRepository.ts` service | `terminal/backend/src/services/updateStatusRepository.ts` | Import check: no TS compile errors (`npx tsc --noEmit`) | ✅ |
| 1-3 | Wire `GET /api/updates/status` endpoint | `terminal/backend/src/server.ts` | `curl http://localhost:8080/api/updates/status` returns `{ "sources": { ... } }` with all 4 keys | ✅ |
| 1-4 | Persistence test: set a value → restart → same value | (runtime) | 1\. Call `setLastSuccess('tickers_csv', '2026-03-01T00:00:00Z')` via a test endpoint or inline. 2. Restart backend. 3. `curl /api/updates/status` → `tickers_csv.lastSuccessAt` equals the set value. | ✅ |

**Sub-step purpose & description (Step 1)**
- `1-1` Purpose: Persist update timestamps in the backend DB. Description:
  - Implement `update_status` table creation in `initDb()` in an idempotent way (safe across restarts).
  - Ensure schema matches the plan (primary key `source_key`, ISO string timestamps, JSON details field).
  - Verification expectation: the table exists in the actual SQLite DB file the backend uses at runtime.
  - Done when (observable): a DB query returns the table name and columns, and the backend still starts cleanly after a restart.
  - Human check: (no UI yet) ask the developer to show the `SELECT name FROM sqlite_master ...` output.
  - Common issues to watch: creating the table in a *different* DB file than the server uses; non-idempotent CREATE that fails on restart.
- `1-2` Purpose: Centralize status read/write logic. Description:
  - Implement a small repository (`listUpdateStatuses`, `setLastSuccess`, optional `getUpdateStatus`) that is the *only* place that issues SQL for update-status.
  - Define a stable “source key” allowlist (tickers_csv, finhub_news, ibkr_calendar, ibkr_ohlc_1d) to avoid accidental key drift.
  - Keep `details_json` minimal (counts + maxDate) and avoid storing raw provider payloads.
  - Done when (observable): server code uses the repository (not ad-hoc SQL) and `npx tsc --noEmit` succeeds.
  - Human check: ask for a quick demo where a status key is set once and then appears in `GET /api/updates/status`.
  - Common issues to watch: drifting keys (typos like `finnhub_news` vs `finhub_news`); storing large raw payloads in `details_json`.
- `1-3` Purpose: Make status visible to the frontend and operators. Description:
  - Add `GET /api/updates/status` and return a stable JSON shape that always includes all expected keys.
  - If a key has never succeeded, return `lastSuccessAt: null` (never fabricate).
  - Keep the route read-only and safe (no secrets; no provider calls).
  - Done when (observable): `curl` returns JSON with all 4 keys every time, even right after a fresh DB.
  - Human check: copy-paste the URL into a browser; it should show JSON (no login, no crash).
  - Common issues to watch: returning missing keys (breaks UI); returning fake timestamps (violates policy).
- `1-4` Purpose: Prove it survives restarts (not in-memory). Description:
  - Write a known timestamp via repository code (from a test or a controlled code path).
  - Restart the backend process and confirm the timestamp still appears in `GET /api/updates/status`.
  - Treat “resets to null after restart” as a correctness failure (indicates in-memory state or wrong DB file).
  - Done when (observable): after restart, the exact same timestamp is still present.
  - Human check: run the same `curl` command before/after restart and visually compare.
  - Common issues to watch: writing to a temporary in-memory DB during tests but reading from a file DB at runtime.

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

#### ⏳ Step 2 — Default ticker CSV: read + append APIs (backend)
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

| Sub-step | Task | Files | Verification | Status |
|----------|------|-------|--------------|--------|
| 2-1 | Create `tickerCsvService.ts` — `readTickersFromCsv()` | `terminal/backend/src/services/tickerCsvService.ts` | Unit test: reads the sample CSV `tradigview_screener/original_data/watch lists2_2026-02-22.csv` and returns ticker array | ✅ |
| 2-2 | Add `appendTickerToCsv()` with security checks | same file | Unit test: (a) append to temp copy → ticker at end. (b) reject `../` path → error. (c) reject non-`.csv` → error. (d) reject duplicate → error. | ✅ |
| 2-3 | Atomic write + Windows retry (`EBUSY`/`EPERM`) | same file | Code review: uses `fs.writeFile` to temp → `fs.rename` with retry loop (up to 10 retries, backoff 100ms) | ✅ |
| 2-4 | Wire `GET /api/tickers` endpoint | `terminal/backend/src/server.ts` | `curl "http://localhost:8080/api/tickers?csvPath=tradigview_screener/original_data/watch%20lists2_2026-02-22.csv"` → returns ticker list | ✅ |
| 2-5 | Wire `POST /api/tickers/add` endpoint | `terminal/backend/src/server.ts` | `curl -X POST http://localhost:8080/api/tickers/add -H "Content-Type: application/json" -d '{"csvPath":"...","ticker":"ZZZZ"}'` → success, then GET verifies ZZZZ appears. Then manually remove ZZZZ from CSV. | ✅ |
| 2-6 | Update `tickers_csv` status on success | `terminal/backend/src/server.ts` | After POST success, `GET /api/updates/status` shows `tickers_csv.lastSuccessAt` updated | ✅ |

**Sub-step purpose & description (Step 2)**
- `2-1` Purpose: Read the CSV and extract tickers reliably. Description:
  - Parse the allowlisted CSV and extract tickers from the decided header (`Ticker` or `Symbol`).
  - Normalize output tickers (`trim`, uppercase) and drop empty/invalid rows.
  - Unit test against `tradigview_screener/original_data/watch lists2_2026-02-22.csv` to ensure we don’t break on spaces in filenames.
  - Done when (observable): `GET /api/tickers` returns a non-empty list for the default CSV path.
  - Human check: in the Default Ticker Window later, tickers appear without manual typing.
  - Common issues to watch: wrong header name/case; failing to handle filenames with spaces; returning duplicates/empty strings.
- `2-2` Purpose: Append a ticker safely. Description:
  - Validate `csvPath`: allowlist root, `.csv` extension, no traversal (`..`), and resolve path deterministically.
  - Validate ticker: allowed charset, normalize, and enforce duplicate policy (default: reject duplicates).
  - Error messages must be actionable (e.g., “path not allowlisted” vs generic 500).
  - Done when (observable): a valid ticker appends as a new last line, and invalid inputs return a clear 4xx error.
  - Human check: you can add `ZZZZ` once; adding it again fails with a readable message.
  - Common issues to watch: accidentally allowing `..` traversal; silently accepting duplicates; returning 500 for user mistakes.
- `2-3` Purpose: Make writes robust on Windows. Description:
  - Implement atomic write by writing a temp file in the same directory and replacing the original.
  - Add bounded retry with backoff for transient replace failures (`EBUSY`/`EPERM`), up to 10 attempts.
  - Ensure the retry is *not* applied to permanent failures (invalid path, permission denied, non-existent file).
  - Done when (observable): repeated POST requests do not randomly fail due to file locking.
  - Human check: add 3–5 different test tickers in a row; it should not intermittently error.
  - Common issues to watch: temp file created in a different drive/folder (replace fails); retrying permanent failures (hides real errors).
- `2-4` Purpose: Provide a read API for the UI. Description:
  - Wire `GET /api/tickers` to call `readTickersFromCsv()`.
  - Ensure query params are validated and rejected safely; do not read arbitrary filesystem locations.
  - Response shape should be stable: `{ csvPath, tickers: string[] }`.
  - Done when (observable): the curl example works even with URL-encoded spaces.
  - Human check: later, changing CSV path in UI triggers a reload without breaking the app.
  - Common issues to watch: forgetting URL encoding; returning different JSON shapes between success/error.
- `2-5` Purpose: Provide an append API for the UI. Description:
  - Wire `POST /api/tickers/add` to call `appendTickerToCsv()`.
  - On success, return either the updated full list or enough data for the UI to refresh.
  - Ensure the endpoint updates `update_status(tickers_csv)` only on successful write.
  - Done when (observable): POST returns success and the next GET includes the new ticker.
  - Human check: add a ticker and immediately see it in the UI list (no full-page refresh).
  - Common issues to watch: updating status on failure; appending but not reloading list.
- `2-6` Purpose: Track successful updates for operators/UI. Description:
  - Update `update_status` using `setLastSuccess('tickers_csv', nowIso, details)`.
  - Store only minimal details (e.g., `{ csvPath, tickerAdded }`) and avoid persisting raw CSV content.
  - Verify via `GET /api/updates/status` that `tickers_csv.lastSuccessAt` changes after a successful append.
  - Done when (observable): `GET /api/updates/status` shows a non-null timestamp after a successful add.
  - Human check: in the Data Control window later, a “last success” field is not stuck at blank.
  - Common issues to watch: timezones/format drift (non-ISO), and storing sensitive/local paths in details.

**Verification hook (Step 2 closeout):**
```
1. npx tsc --noEmit   → 0 errors
2. npm run test       → new tickerCsvService tests pass
3. Start backend → test GET and POST via curl (commands above)
4. Verify path traversal is blocked: csvPath=../../etc/passwd → rejected
5. Verify duplicate rejection: add same ticker twice → second call fails
```
- User confirmation needed: **Yes**

#### ⏳ Step 3 — Default Ticker Window (frontend)
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

| Sub-step | Task | Files | Verification | Status |
|----------|------|-------|--------------|--------|
| 3-1 | Add `default-ticker` window type | `src/app/types.ts` | Grep: `default-ticker` appears in `WindowType` | ✅ |
| 3-2 | Create `DefaultTickerWindow.tsx` | `src/app/components/DefaultTickerWindow.tsx` | File exists, no TS errors | ✅ |
| 3-3 | Wire into `DraggableWindow.tsx` switch | `src/app/components/DraggableWindow.tsx` | `default-ticker` case renders `DefaultTickerWindow` | ✅ |
| 3-4 | Add to `AddTabModal.tsx` | `src/app/components/AddTabModal.tsx` | Checkbox "Default Ticker" visible | ✅ |
| 3-5 | Add title mapping in `App.tsx` | `src/app/App.tsx` | `default-ticker` → "Default Ticker" | ✅ |
| 3-6 | Manual UI smoke test | (browser) | Open "Default Ticker" window → shows tickers from CSV → Add a ticker → list refreshes | ✅ |

**Sub-step purpose & description (Step 3)**
- `3-1` Purpose: Make the window type selectable in the window system. Description:
  - Add `default-ticker` to the `WindowType` union (and any related type maps) so it can be instantiated.
  - Ensure there is no stale reference to a removed/renamed type that would break rendering.
  - Keep naming consistent across types, window title mapping, and AddTab labels.
  - Done when (observable): the “Default Ticker” entry can be created from Add Tab without runtime errors.
  - Human check: open Add Tab and confirm “Default Ticker” exists (Step 3-4 also required).
  - Common issues to watch: adding the type but forgetting to wire rendering/title, resulting in a blank window.
- `3-2` Purpose: Implement the UI surface. Description:
  - Build `DefaultTickerWindow.tsx` as a thin client: CSV path input + reload button + list + add form.
  - Call only backend APIs (`GET /api/tickers`, `POST /api/tickers/add`); do not attempt browser-side file operations.
  - Display backend validation errors inline (no modal) and keep text minimal.
  - Done when (observable): the window shows a list when backend is reachable, and shows an inline error when backend rejects the path/ticker.
  - Human check: type a clearly invalid path (e.g., `C:\\`) and confirm the UI shows a readable rejection (not a crash).
  - Common issues to watch: frontend calling the wrong backend base URL/port; errors shown only in console instead of inside the window.
- `3-3` Purpose: Ensure the window renders in the desktop layout. Description:
  - Add a `default-ticker` rendering branch in `DraggableWindow.tsx` to render `DefaultTickerWindow`.
  - Confirm the component receives the same window props pattern as other windows (position/size/state).
  - Ensure the window does not crash when the CSV path is invalid (show error instead).
  - Done when (observable): selecting the tab opens a draggable window that actually contains the Default Ticker UI controls.
  - Human check: open/close the window multiple times; it should not duplicate unexpectedly or render blank.
  - Common issues to watch: missing switch-case wiring (window opens but content is empty).
- `3-4` Purpose: Allow users to open the window. Description:
  - Add a checkbox entry to `AddTabModal.tsx` that creates the `default-ticker` window.
  - Label must be exactly “Default Ticker” to match the plan.
  - Ensure toggling it on/off behaves consistently with other windows.
  - Done when (observable): the checkbox exists and creates exactly one window when checked.
  - Human check: check it once → one window opens; uncheck → it closes (or follows existing behavior).
  - Common issues to watch: label mismatch (acceptance failure), double-create on repeated toggles.
- `3-5` Purpose: Provide a stable, human-readable title. Description:
  - Map `default-ticker` to “Default Ticker” in `App.tsx` title mapping.
  - Ensure there are no duplicate/conflicting title mappings.
  - Keep the title string stable because it becomes an acceptance-test anchor.
  - Done when (observable): the window header/title shows “Default Ticker” exactly.
  - Human check: visually confirm the title; no extra spaces/case differences.
  - Common issues to watch: title mapping updated but not applied to existing window instances until refresh (stale title).
- `3-6` Purpose: Validate end-to-end behavior. Description:
  - Open the window, confirm it calls `GET /api/tickers` and renders the list.
  - Add a ticker and confirm it calls `POST /api/tickers/add`, then refreshes the list.
  - Clean up the appended ticker afterwards (manual revert) so the repo data is not polluted.
  - Done when (observable): add flow works end-to-end and the list refreshes immediately.
  - Human check: add a test ticker, close/reopen the window (or reload) and confirm it still appears (proves backend wrote the CSV).
  - Common issues to watch: backend not running (network error); forgetting to revert the test ticker in the CSV after demo.

**Verification hook (Step 3 closeout):**
```
1. npx tsc --noEmit (frontend)   → 0 errors
2. npm run dev (frontend + backend both running)
3. Open browser → Add Tab → check "Default Ticker" → window opens
4. Window shows ticker list loaded from CSV
5. Type "TEST" → click Add → appears in list (remove manually afterward)
```
- User confirmation needed: **Yes**

#### ⏳ Step 4 — Finnhub ingestion (backend)
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

| Sub-step | Task | Files | Verification | Status |
|----------|------|-------|--------------|--------|
| 4-1 | Add `finnhubApiKey` to config | `terminal/backend/src/config.ts` | Config loads from `FINNHUB_API_KEY` env or file fallback | ✅ |
| 4-2 | Create `finnhubNewsProvider.ts` | `terminal/backend/src/services/finnhubNewsProvider.ts` | Fetches from Finnhub, maps to `insertNewsItem()` contract, sets `source='FINNHUB'` | ✅ |
| 4-3 | Wire `POST /api/news/pull-finhub` endpoint | `terminal/backend/src/server.ts` | `curl -X POST http://localhost:8080/api/news/pull-finhub` → `{ inserted: N, skipped: N, source: "FINNHUB" }` | ✅ |
| 4-4 | Update `finhub_news` status on success | `terminal/backend/src/server.ts` | After POST, `GET /api/updates/status` shows `finhub_news.lastSuccessAt` updated | ✅ |
| 4-5 | Verify stored data queryable | (runtime) | `curl "http://localhost:8080/api/news?source_names=FINNHUB"` → returns news items with correct fields | ✅ |

**Sub-step purpose & description (Step 4)**
- `4-1` Purpose: Load the Finnhub key safely. Description:
  - Prefer `FINNHUB_API_KEY` from environment; only use the file fallback if the env var is absent.
  - If key is missing, fail fast with a clear message but never log/print the key.
  - Keep config loading centralized (single source of truth) so provider code never reads secrets directly.
  - Done when (observable): starting the backend with/without the env var produces predictable behavior (works if present, clear error if missing).
  - Human check: run the ingestion endpoint once; it should fail with a readable “missing key” error (without revealing the key) if not configured.
  - Common issues to watch: accidentally logging the key or the full request URL with the key; reading the key in multiple places.
- `4-2` Purpose: Convert Finnhub responses into the DB’s news schema. Description:
  - Fetch from Finnhub endpoints required for “company news”.
  - Map into the existing `insertNewsItem()` contract and set `source='FINNHUB'` consistently.
  - Dedup policy: avoid re-inserting the same item when ranges overlap (prefer DB uniqueness; otherwise best-effort in code).
  - Done when (observable): `GET /api/news?source_names=FINNHUB` returns items with non-empty title + timestamp + URL.
  - Human check: open the News window later and confirm you see real headlines (not placeholders).
  - Common issues to watch: timestamp units/timezone mismatch; inconsistent `source` string (breaks filtering); duplicates on repeated pulls.
- `4-3` Purpose: Trigger ingestion on demand. Description:
  - Add `POST /api/news/pull-finhub` that runs the provider pull and persists rows.
  - Return a small summary (`inserted`, `skipped`, `source`) suitable for UI display.
  - Ensure the endpoint does not run automatically on startup (explicit trigger only).
  - Done when (observable): POST returns the summary JSON quickly and does not block indefinitely.
  - Human check: click “Update” (if Step 5-5 is enabled) and see the list refresh.
  - Common issues to watch: doing automatic pulls on startup (surprise side effects); returning huge payloads instead of a small summary.
- `4-4` Purpose: Track the last successful pull. Description:
  - On success, write `update_status(finhub_news).lastSuccessAt = now()`.
  - Store minimal details like counts and the covered date range; do not store raw response bodies.
  - Verify status changes via `GET /api/updates/status`.
  - Done when (observable): after a successful POST, `finhub_news.lastSuccessAt` becomes a non-null ISO timestamp.
  - Human check: in the Data Control window later, a “last success” timestamp is visible and updates.
  - Common issues to watch: updating lastSuccessAt even when insertion failed; storing non-ISO timestamps that are hard to display.
- `4-5` Purpose: Confirm data is actually queryable by the UI. Description:
  - Query `GET /api/news?source_names=FINNHUB` and verify:
    - items exist
    - required fields (title, published time, url/source) are present
    - `source` matches exactly `FINNHUB`
  - If no items appear, treat it as an ingestion or query bug (not a UI issue).
  - Done when (observable): GET returns a stable JSON array and the newest items appear after ingestion.
  - Human check: refresh the News window; items should change over time when you pull again.
  - Common issues to watch: endpoint returns items but with missing fields; query filters use a different `source` spelling.

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

#### ✅ Step 5 — Migrate “News Feed: Brave API” → “news feed:finhub api” (frontend)
Purpose
- Remove synthetic/mock “Brave News” UI and rewire it to the backend’s Finnhub-backed news.
- Ensure the label is exactly `news feed:finhub api` and the UI no longer implies Brave is used.

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
  - Label: change to exactly `news feed:finhub api`
  - Toggle window type `finhub-news`
- `src/app/App.tsx`
  - Title mapping: `finhub-news` → `news feed:finhub api`
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
- “news feed:finhub api” window shows Finnhub-backed items only.

**Sub-steps (Step 5)**

| Sub-step | Task | Files | Verification | Status |
|----------|------|-------|--------------|--------|
| 5-1 | Remove `brave-news` from `WindowType`, add `finhub-news` | `src/app/types.ts` | Grep: no `brave-news`, `finhub-news` present | ✅ |
| 5-2 | Rename `BraveNewsWindow.tsx` → `FinnhubNewsWindow.tsx` | file rename | Old file gone, new file exists | ✅ |
| 5-3 | Remove `generateMockData()` entirely | `FinnhubNewsWindow.tsx` | `grep -r "generateMockData" src/` → 0 results | ✅ |
| 5-4 | Implement real fetch from `GET /api/news?source_names=FINNHUB` | `FinnhubNewsWindow.tsx` | Component fetches from backend on mount | ✅ |
| 5-5 | Add optional "Update" button calling `POST /api/news/pull-finhub` | `FinnhubNewsWindow.tsx` | Button visible, triggers ingestion | ✅ |
| 5-6 | Update `AddTabModal.tsx` label → `news feed:finhub api` | `src/app/components/AddTabModal.tsx` | Label text exact match | ✅ |
| 5-7 | Update `App.tsx` title mapping | `src/app/App.tsx` | `finhub-news` → `news feed:finhub api` | ✅ |
| 5-8 | Update `DraggableWindow.tsx` switch | `src/app/components/DraggableWindow.tsx` | `finhub-news` → `FinnhubNewsWindow` | ✅ |
| 5-9 | Changes% live calc (OHLC-based change% on news items) | `FinnhubNewsWindow.tsx` | News items display change% values when OHLC data is available | ✅ |
| 5-10 | Server-side keyword search (full DB search) | `FinnhubNewsWindow.tsx` | Search input sends `keyword` param to `GET /api/news`, backend filters across entire DB | ✅ |
| 5-11 | Update button tooltip (5-second hover delay) | `FinnhubNewsWindow.tsx` | Hovering Update button for 5s shows tooltip explaining scope | ✅ |
| 5-12 | Add dedicated Ticker column | `FinnhubNewsWindow.tsx` | Ticker column appears between Date and Time; clicking ticker filters | ⏳ |
| 5-13 | Column visibility toggle (show/hide columns) | `FinnhubNewsWindow.tsx` | Columns button opens checkbox dropdown to show/hide columns | ⏳ |
| 5-14 | Backend “entire” mode — adaptive date-splitting backfill | `server.ts`, `finnhubNewsProvider.ts` | `POST /api/news/pull-finhub { mode: “entire” }` → 5-year adaptive split, cap bypass | ✅ |
| 5-15 | Update button → split-dropdown (6 options: sourceType × mode) | `FinnhubNewsWindow.tsx` | Dropdown: All/Company/Press × Recent/Entire = 6 menu items | ✅ |
| 5-16 | Source cell: right-click Copy URL + click opens link | `FinnhubNewsWindow.tsx` | Right click Source → Copy URL; left click Source opens URL in browser | ⏳ |

**Sub-step purpose & description (Step 5)**
- `5-1` Purpose: Switch the window identity away from Brave. Description:
  - Remove the `brave-news` window type and introduce `finhub-news` as the canonical type.
  - Update any type-level models (`BraveNews*` types) to Finnhub equivalents or reuse the backend `NewsItem` shape if already defined.
  - Success criterion: no user-facing UI path can still open a “Brave” news window.
  - Done when (observable): Add Tab no longer offers a Brave news entry; creating the news window results in a `finhub-news` window type without runtime errors.
  - Human check: in the UI, search for “Brave” and confirm no news-related label/option contains it.
  - Common issues to watch: adding `finhub-news` but leaving `brave-news` referenced in a render switch (blank window or crash).
- `5-2` Purpose: Keep code structure readable. Description:
  - Rename the window component to `FinnhubNewsWindow` (file rename preferred) so naming matches behavior.
  - Update all imports/exports accordingly.
  - Avoid leaving duplicate/unused components (e.g., both BraveNewsWindow and FinnhubNewsWindow) unless intentionally kept.
  - Done when (observable): the app builds/runs with no runtime “module not found” errors after the rename.
  - Human check: open the News window; it renders content (even if empty) instead of showing a blank/crashed window.
  - Common issues to watch: stale import paths, incorrect default/named export after rename, case-sensitive path issues in git.
- `5-3` Purpose: Enforce “no mock data” policy. Description:
  - Remove `generateMockData()` and any synthetic seed arrays.
  - Remove any fallback code path that “creates demo items” when backend returns empty.
  - Verification expectation: searching the frontend source tree for `generateMockData` and related mock helpers returns zero matches.
  - Done when (observable): with an empty backend DB, the window shows “no items” (or empty state) rather than demo headlines.
  - Human check: open the window immediately after a fresh backend start (before any pull) and confirm you do not see seeded/demo items.
  - Common issues to watch: leftover hard-coded arrays in component state; “if empty then seed sample data” logic.
- `5-4` Purpose: Render real stored news. Description:
  - Fetch news from backend using `GET /api/news?source_names=FINNHUB`.
  - Render exactly what the backend returns; if fields are missing, display empty/`-` (never invent values).
  - Keep fetch behavior predictable (load-on-mount + optional manual refresh only).
  - Done when (observable): browser Network tab shows `GET /api/news?source_names=FINNHUB` and the UI list reflects the response.
  - Human check: in DevTools → Network, click the request and confirm it returns JSON (array) and the UI updates accordingly.
  - Common issues to watch: calling the wrong backend port; missing `source_names=FINNHUB` filter; not handling empty arrays gracefully.
- `5-5` Purpose: Allow manual refresh when needed (optional). Description:
  - Add an in-window “Update” button that calls `POST /api/news/pull-finhub`.
  - After POST success, refresh the list by re-calling `GET /api/news?source_names=FINNHUB`.
  - Ensure the UI shows a minimal running/error state without adding new modals.
  - Done when (observable): clicking Update shows a short “Running…” state, then the list refreshes (or a clear error appears).
  - Human check: click Update twice quickly; the second click should be blocked/disabled while the first is running.
  - Common issues to watch: calling the POST automatically on mount (surprise side effects); no disabled state leading to double-ingestion.
- `5-6` Purpose: Match the exact requested label. Description:
  - In `AddTabModal.tsx`, update the label text to exactly `news feed:finhub api` (case + spacing exact).
  - Ensure no other place still shows “Brave API” for this window.
  - Treat label mismatch as acceptance failure (it’s user-visible and specified).
  - Done when (observable): Add Tab shows the label exactly as `news feed:finhub api`.
  - Human check: visually compare the label character-by-character (including spaces and colon placement).
  - Common issues to watch: extra whitespace, different capitalization, or a different string used in another mapping.
- `5-7` Purpose: Ensure the window title is correct. Description:
  - Update `App.tsx` title mapping so `finhub-news` renders the exact title `news feed:finhub api`.
  - Ensure switching between windows does not show stale titles.
  - Keep the string stable as an acceptance-test anchor.
  - Done when (observable): the window header/title shows `news feed:finhub api` every time the window is opened.
  - Human check: open a different window, then switch back; confirm the title does not “stick” to the old one.
  - Common issues to watch: title mapping exists but is applied only on first render; old instances keep the previous title.
- `5-8` Purpose: Ensure the window actually renders. Description:
  - Add a `finhub-news` case in `DraggableWindow.tsx` that renders `FinnhubNewsWindow`.
  - Verify the window opens, fetches, and renders without crashing even when the backend returns an empty array.
  - Ensure there is no leftover `brave-news` rendering path.
  - Done when (observable): selecting the tab opens a non-empty window frame with the expected controls/content region.
  - Human check: open the window on a clean DB (empty list) and confirm you see an empty state, not a blank frame.
  - Common issues to watch: forgetting to wire the render switch (window opens but content area is empty).

- `5-9` Purpose: Display OHLC-derived change% fields per row. Description:
  - Render backend-provided `change_*_pct` values in the Changes% column; show `-` when missing.
  - Done when (observable): some rows show numeric change% values when OHLC data exists.
  - Human check: find a ticker/date with OHLC data and confirm non-`-` numbers appear.
  - Common issues to watch: mismatch between backend keys and frontend field mapping.
- `5-10` Purpose: Make search cover the entire DB (server-side keyword search). Description:
  - Send `keyword` query param to `GET /api/news` instead of filtering only within the last 200 client-side rows.
  - Done when (observable): Network tab shows `GET /api/news?...&keyword=...` and results include older DB matches.
  - Human check: search a ticker/keyword known to exist outside the most recent 200.
  - Common issues to watch: forgetting to omit `keyword` when empty (should return full list).
- `5-11` Purpose: Explain update scope with a delayed tooltip. Description:
  - Hover Update for 5 seconds to show tooltip describing what Recent/Entire do.
  - Done when (observable): tooltip appears after ~5s hover and disappears on mouse leave.
  - Human check: hover for 5 seconds and confirm tooltip text appears.
  - Common issues to watch: timeout not cleared; tooltip hidden behind other elements (z-index).
- `5-12` Purpose: Improve readability by separating ticker into its own column. Description:
  - Add a dedicated `Ticker` column between Date and Time; enable sorting and click-to-filter.
  - Done when (observable): Ticker column visible and sortable.
  - Human check: click ticker badge to filter.
  - Common issues to watch: column widths array not staying aligned after filtering/reordering.
- `5-13` Purpose: Let users hide unnecessary columns. Description:
  - Add a Columns dropdown with checkboxes; unchecked columns are removed from the table.
  - Done when (observable): toggling a checkbox hides/shows that column without layout breakage.
  - Human check: hide multiple columns then re-enable them.
  - Common issues to watch: width mapping using wrong indices after filtering.
- `5-14` Purpose: Adaptive date-splitting backfill to bypass Finnhub API cap (~200 items). Description:
  - Extend `POST /api/news/pull-finhub` to accept `mode: recent|entire` and `sourceType: all|company_news|press_release`.
  - `adaptiveBackfill()` recursively splits date ranges when response count >= `CAP_THRESHOLD` (190). Minimum window = 1 day.
  - In `entire` mode, `effectiveFrom` = 5 years ago (not 1 year) since adaptive splitting defeats the API cap.
  - **Ticker scope**: `maxTickers` defaults to 0 = **all tickers in the CSV** (no artificial cap). A non-zero value can be passed to limit.
  - `MAX_RETRIES` raised from 3 → 10; 300ms sleep between split requests for rate-limit safety.
  - Deduplication via existing `UNIQUE (source, url)` + `INSERT OR IGNORE`.
  - Done when (observable): console shows `[backfill] ... splitting…` logs; DB grows with older history without duplicates.
  - Human check: run Entire Update once and confirm older items appear across the full ticker list.
  - Common issues to watch: rate limits (60 calls/min free tier); adaptive splitting multiplies API calls.
- `5-15` Purpose: Provide split-dropdown Update UX with 6 menu options (sourceType × mode). Description:
  - Main button triggers Recent (7-day incremental); arrow opens menu with 6 options (All/Company/Press × Recent/Entire).
  - Done when (observable): both actions callable; buttons disable during update.
  - Human check: choose Entire from the dropdown.
  - Common issues to watch: menu not closing on outside click; split borders misaligned.
- `5-16` Purpose: Make Source usable as a link and support copying the URL. Description:
  - Left click Source opens the item URL in a new browser tab.
  - Right click Source shows a small context menu with “Copy URL” which copies the URL to clipboard.
  - Done when (observable): click opens; right-click copies.
  - Human check: copy then paste URL into Notepad; click opens the same URL.
  - Common issues to watch: clipboard API blocked; context menu positioning off-screen.

**Verification hook (Step 5 closeout):**
```
1. grep -r "generateMockData\|mock\|brave-news\|BraveNews" src/ → 0 results (no mock/brave references)
2. npx tsc --noEmit → 0 errors
3. npm run dev → Open `news feed:finhub api` window
4. Network tab: GET /api/news?source_names=FINNHUB returns items
5. Source type filter toggles: All / Company News / Press Release
6. Search: typing triggers GET /api/news?...&keyword=... (server-side)
7. Update hover tooltip appears after 5s
8. Ticker column visible; clicking ticker filters
9. Columns menu hides/shows columns via checkboxes
10. Update dropdown: 6 options in 3 sections (All×2, Company×2, Press×2); each sends correct mode+sourceType in POST body
11. Console shows `[backfill] ... splitting…` during Entire mode (adaptive splitting active)
12. Source cell: left click opens URL; right click → Copy URL; paste confirms
```
- User confirmation needed: **Yes**

#### ⬜ Step 6 — IBKR calendar ingestion (backend) + stop mock calendar generator
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

| Sub-step | Task | Files | Verification | Status |
|----------|------|-------|--------------|--------|
| 6-1 | Remove mock worker functions from `calendarIngestion.ts` | `terminal/backend/src/services/calendarIngestion.ts` | `grep "mock_provider\|setInterval\|generateMock" calendarIngestion.ts` → 0 matches | ⬜ |
| 6-2 | Remove `startCalendarIngestionWorkers()` call from server startup | `terminal/backend/src/server.ts` | `grep "startCalendarIngestion" server.ts` → only import/no startup call | ⬜ |
| 6-3 | Implement calendar data pull (source TBD by decision) | `terminal/backend/src/services/calendarIngestion.ts` | new `pullCalendarData()` function returns events | ⬜ |
| 6-4 | Wire `POST /api/ibkr/calendar/update` endpoint | `terminal/backend/src/server.ts` | `curl -X POST http://localhost:8080/api/ibkr/calendar/update` → `{ upserted: N, deletedMockRows: N }` | ⬜ |
| 6-5 | Delete existing `mock_provider` rows on first success | `calendarIngestion.ts` or server route | `SELECT COUNT(*) FROM calendar_events WHERE source='mock_provider'` → 0 | ⬜ |
| 6-6 | Update `ibkr_calendar` status | `terminal/backend/src/server.ts` | `GET /api/updates/status` → `ibkr_calendar.lastSuccessAt` populated | ⬜ |

**Sub-step purpose & description (Step 6)**
- `6-1` Purpose: Stop any future mock calendar inserts. Description:
  - Remove *all* timer/worker code paths that insert `calendar_events(source='mock_provider')`.
  - Ensure the file no longer contains mock helpers (e.g. `generateMock*`, `setInterval`, hard-coded sample events).
  - Success criterion: starting the backend does not create any new rows unless an explicit endpoint is called.
  - Done when (observable): restarting the backend does not change `/api/calendar/events` output unless `POST /api/ibkr/calendar/update` is called.
  - Human check: start backend, wait 1–2 minutes, then call `GET /api/calendar/events`; results should not grow automatically.
  - Common issues to watch: leftover `setInterval` or startup hooks that still insert mock rows in the background.
- `6-2` Purpose: Remove startup side effects so `/calendar` is pull-on-demand only. Description:
  - Delete the `startCalendarIngestionWorkers()` call from the server startup path.
  - If the function remains for backward compatibility, it must not run automatically.
  - Verification focus: reboot backend → DB remains unchanged until `POST /api/ibkr/calendar/update`.
  - Done when (observable): a clean backend restart produces zero calendar write activity until the update endpoint is called.
  - Human check: restart backend and immediately call `GET /api/calendar/events`; it should return the same set as before restart (no new mock rows).
  - Common issues to watch: the call is removed from one code path but still runs via another imported startup helper.
- `6-3` Purpose: Implement the real calendar pull in a testable, provider-agnostic shape (decision-dependent). Description:
  - Add a `pullCalendarData()` function that returns a normalized list of events.
  - Normalization rules (minimum): stable IDs (or deterministic hash), ISO timestamps, symbol, event type, and a `source` field.
  - Explicitly document which fields are *not* available from the chosen source (never fabricate).
  - Done when (observable): `pullCalendarData()` returns an array of normalized events and unit tests (or a dev probe) can validate the shape without UI.
  - Human check: call the update endpoint once and confirm the response shows `source: "IBKR"` (or the decided source) and non-negative counts.
  - Common issues to watch: using non-ISO timestamps; generating IDs that change every run (causes duplicates).
- `6-4` Purpose: Provide an explicit operator/UI trigger for calendar refresh. Description:
  - Add `POST /api/ibkr/calendar/update` which does: pull → upsert → update status.
  - The route must return a small summary (`upserted`, `deletedMockRows`, `source`) and a non-200 on failure.
  - Do not log secrets; only log counts + high-level errors.
  - Done when (observable): `curl -X POST http://localhost:8080/api/ibkr/calendar/update` returns a small JSON summary within a reasonable time.
  - Human check: run the POST twice; the second run should not explode row counts (upsert should prevent duplicates).
  - Common issues to watch: returning huge payloads; treating partial failures as success and still updating status.
- `6-5` Purpose: Remove already-stored mock data so the app becomes “IBKR-only” without manual DB resets. Description:
  - On the *first successful* real update, delete `calendar_events` rows with `source='mock_provider'`.
  - This deletion must be idempotent and safe to re-run.
  - Prefer performing delete+upsert+status update in a single transaction where practical.
  - Done when (observable): after the first successful update, `GET /api/calendar/events` never returns items with `source='mock_provider'`.
  - Human check: call `GET /api/calendar/events` and scan the JSON for any `mock_provider` string; it should be absent.
  - Common issues to watch: deleting mock rows even when the real pull failed; cleanup running on every startup.
- `6-6` Purpose: Persist “last success” timestamps for the Data Control Window and ops. Description:
  - On success, write `update_status(ibkr_calendar).lastSuccessAt = now()`.
  - Store minimal `details` (e.g. `{ upserted, deletedMockRows }`) for debugging; do not store secrets or raw provider payloads.
  - Done when (observable): after a successful update POST, `GET /api/updates/status` shows a non-null `ibkr_calendar.lastSuccessAt`.
  - Human check: intentionally cause a failure (e.g., service down) and confirm `lastSuccessAt` does not change.
  - Common issues to watch: updating timestamps on failed pulls; storing raw provider payloads in `details`.

**Verification hook (Step 6 closeout):**
```
1. npx tsc --noEmit → 0 errors
2. npm run test → calendar cleanup test passes
3. Start backend → no automatic mock insertion (check DB: no new mock_provider rows)
4. POST /api/ibkr/calendar/update → mock rows deleted + new rows inserted
5. GET /api/calendar/events → only source='IBKR' (or decided source)
```
- User confirmation needed: **Yes**

#### ⬜ Step 7 — IBKR 1D OHLC ingestion into `ohlc_1d_watchlist.sqlite` (backend)
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

| Sub-step | Task | Files | Verification | Status |
|----------|------|-------|--------------|--------|
| 7-1 | Create `ohlcWatchlistRepository.ts` — open DB, query helpers | `terminal/backend/src/services/ohlcWatchlistRepository.ts` | `getOverallMaxDate()` returns `2026-02-20` (current DB state) | ⬜ |
| 7-2 | Add `ensureDerivedColumns()` migration | same file | After running, `PRAGMA table_info(ohlc_1d)` shows derived columns | ⬜ |
| 7-3 | Create `ibkrOhlc1dProvider.ts` — fetch bars from IBKR | `terminal/backend/src/services/ibkrOhlc1dProvider.ts` | For AAPL: returns 1D bars from (maxDate+1) to today | ⬜ |
| 7-4 | Create `ohlcDerivedMetrics.ts` — compute % change columns | `terminal/backend/src/services/ohlcDerivedMetrics.ts` | Unit test: given known OHLC rows, computes expected Change_1d_Pct etc. | ⬜ |
| 7-5 | Wire `GET /api/ibkr/ohlc1d/status` | `terminal/backend/src/server.ts` | `curl http://localhost:8080/api/ibkr/ohlc1d/status` → `{ dbPath, overallMaxDate: "2026-02-20", lastSuccessAt }` | ⬜ |
| 7-6 | Wire `POST /api/ibkr/ohlc1d/update` | `terminal/backend/src/server.ts` | After POST: `overallMaxDate` advances (if new trading days exist) | ⬜ |
| 7-7 | Spot-check derived columns | (runtime) | `SELECT ... Change_1d_Pct ... WHERE Symbol='AAPL' ... LIMIT 5` → non-NULL values | ⬜ |

**Sub-step purpose & description (Step 7)**
- `7-1` Purpose: Encapsulate all access to the canonical OHLC SQLite DB in one place. Description:
  - Open `OHLC_data/ohlc_1d_watchlist.sqlite` read/write with consistent options (busy timeout, foreign keys as needed).
  - Provide query helpers: `getOverallMaxDate()`, and (optionally) `getSymbolMaxDate(symbol)`.
  - Provide `upsertBars(symbol, bars)` using a deterministic mapping (Symbol, Datetime, Open, High, Low, Close, Volume).
  - Error handling: translate low-level SQLite errors into actionable messages; do not swallow failures silently.
  - Done when (observable): a small dev probe or unit test can open the DB and `getOverallMaxDate()` returns a plausible date string (or null if empty).
  - Human check: after Step 7-5 is wired, call `GET /api/ibkr/ohlc1d/status` and confirm `dbPath` points at `OHLC_data/ohlc_1d_watchlist.sqlite` and `overallMaxDate` is not garbage.
  - Common issues to watch: wrong relative path resolution (runs in a different CWD); SQLite “database is locked” from missing busy-timeout handling.
- `7-2` Purpose: Make derived-metric storage possible without manual DB rebuilds. Description:
  - Implement `ensureDerivedColumns()` that is idempotent:
    - inspect existing schema via `PRAGMA table_info(ohlc_1d)`
    - `ALTER TABLE ... ADD COLUMN` only for missing columns
  - Migration must be safe on repeated runs and safe on a DB that already contains data.
  - Done when (observable): running the migration twice produces no errors and the derived columns exist exactly once.
  - Human check: open the SQLite DB in a viewer (e.g., DB Browser for SQLite) and confirm the derived columns exist on `ohlc_1d`.
  - Common issues to watch: forgetting to run migration before writes (columns stay NULL forever); typos in column names causing multiple similar columns.
- `7-3` Purpose: Provide a single “fetch 1D bars” abstraction regardless of how we integrate with IBKR (Decision #6). Description:
  - Input: `{ symbol, startDate, endDate }` where dates are trading dates in `YYYY-MM-DD`.
  - Output: ordered bars with `Datetime` in `YYYY-MM-DD` and numeric OHLCV.
  - Reliability rules:
    - Bounded retries with backoff for transient disconnect/pacing
    - Fail fast on permanent config errors (host/port, permissions)
    - Never log credentials; log only symbol + date range + counts.
  - Done when (observable): for a known symbol (AAPL), the provider returns a non-empty bar list for a recent date range.
  - Human check: run `POST /api/ibkr/ohlc1d/update` for a single-symbol ticker CSV and confirm the summary shows `rowsUpserted > 0` (on a market day).
  - Common issues to watch: IBKR pacing/timeouts; returning bars in descending order; mixing timezone/local date boundaries.
- `7-4` Purpose: Compute and persist the News Feed “Changes %” fields from real OHLC (no mock/UI-only). Description:
  - For each affected symbol, load enough history to compute lookbacks (>= 30 prior trading bars).
  - Compute: `Change_1d_Pct`, `Change_From_Open_Pct`, `Change_7d_Pct`, `Change_14d_Pct`, `Change_30d_Pct`.
  - Missing history rule: if a lookback bar does not exist, store `NULL` (do not fabricate).
  - Write derived values back for a bounded safety window (e.g. `min_new_date - 40 bars` → `max_new_date`).
  - Done when (observable): after at least one successful update, recent `ohlc_1d` rows have non-NULL derived columns where history exists.
  - Human check: run the provided spot-check SQL for AAPL and confirm at least one of the derived columns is not NULL for recent rows.
  - Common issues to watch: using calendar days instead of trading bars for 7/14/30 lookbacks; dividing by zero / missing previous close.
- `7-5` Purpose: Expose a read-only status endpoint so UI/ops can confirm DB freshness. Description:
  - Implement `GET /api/ibkr/ohlc1d/status` which returns:
    - `dbPath` (string), `overallMaxDate` (string or null), `lastSuccessAt` (ISO or null).
  - `overallMaxDate` is sourced from DB `MAX(Datetime)`; `lastSuccessAt` from `update_status(ibkr_ohlc_1d)`.
  - Done when (observable): the endpoint returns JSON with all fields present even when values are null.
  - Human check: `curl http://localhost:8080/api/ibkr/ohlc1d/status` and confirm it returns quickly and consistently.
  - Common issues to watch: returning dates in inconsistent formats; reading `lastSuccessAt` from the wrong update_status key.
- `7-6` Purpose: Implement the orchestrator endpoint that performs pull → upsert → derive → status update. Description:
  - Implement `POST /api/ibkr/ohlc1d/update`:
    - Read tickers from the Default Ticker CSV (normalized + de-duplicated)
    - For each ticker, decide the date range to fetch based on DB max date
    - Fetch bars via `ibkrOhlc1dProvider`, upsert, then recompute derived metrics for the affected window
    - On full success, update `update_status(ibkr_ohlc_1d)` with minimal details
  - Partial failure policy must be explicit (choose one and document it in code):
    - (a) fail the whole request, or (b) continue and report per-symbol failures.
  - Done when (observable): a single POST call advances `overallMaxDate` when new trading days exist, and updates `update_status(ibkr_ohlc_1d).lastSuccessAt`.
  - Human check: call the POST once, then call `GET /api/updates/status` and confirm `ibkr_ohlc_1d.lastSuccessAt` changed only on success.
  - Common issues to watch: updating status even when some symbols failed (without reporting it); recomputing derived metrics for too small a window (lookbacks stay NULL).
- `7-7` Purpose: Provide a concrete “human check” that proves the pipeline produced real derived values. Description:
  - After at least one successful update, run a small SQL query for a known symbol (AAPL) and confirm:
    - rows exist for recent dates
    - derived columns are not all `NULL` for recent rows
  - This is not a substitute for unit tests; it is an operational sanity check.
  - Done when (observable): the query returns rows and at least one derived column has numeric values.
  - Human check: copy/paste the exact SQL into a SQLite viewer and confirm results look reasonable (no huge NaNs/inf).
  - Common issues to watch: querying the wrong DB file; bar dates not matching `YYYY-MM-DD` so MAX(Datetime) is wrong.

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

#### 🚫 Step 8 — Data Control Window (frontend)
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
| Sub-step | Task | Files | Verification | Status |
|----------|------|-------|--------------|--------|
| 8-1 | Add window type `data-control` | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts` | Window type compiles; appears in AddTabModal | 🚫 |
| 8-2 | Implement `DataControlWindow.tsx` UI + API calls | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx` | On load, `GET /api/updates/status` is called and rendered | 🚫 |
| 8-3 | Wire into window system | `AddTabModal.tsx`, `App.tsx`, `DraggableWindow.tsx` | Selecting “Data Control” opens the window | 🚫 |
| 8-4 | Implement “running” + error states | same | Button disables + “Running…” appears; errors render inline | 🚫 |
| 8-5 | Hook status refresh after updates | same | After POST, statuses refresh and latest DB date updates | 🚫 |

**Sub-step purpose & description (Step 8)**
- `8-1` Purpose: Make the window type available to the UI. Description:
  - Add `data-control` to the frontend window type union.
  - Ensure the AddTab entry and the DraggableWindow rendering use the exact same type string.
  - Keep naming consistent because it becomes a stable integration point.
  - Done when (observable): the “Data Control” option exists in Add Tab and selecting it opens a window without errors.
  - Human check: open Add Tab and confirm you can create exactly one Data Control window (no duplicates on repeated toggles).
  - Common issues to watch: type string mismatch between AddTab and DraggableWindow (blank window).
- `8-2` Purpose: Implement the operations UI. Description:
  - Implement `DataControlWindow.tsx` with two sections (Price, Calendar) and minimal controls.
  - On mount, call `GET /api/updates/status` and render `lastSuccessAt` values (or `-` if null).
  - Fetch `GET /api/ibkr/ohlc1d/status` for the OHLC “latest date” display.
  - Done when (observable): on open, the window shows two sections and displays `-` or timestamps/dates (not empty placeholders).
  - Human check: with backend running, refresh the page and confirm the status fields populate without clicking any buttons.
  - Common issues to watch: calling the wrong backend base URL/port; crashing when `lastSuccessAt` is null.
- `8-3` Purpose: Ensure it’s reachable in the app. Description:
  - Add checkbox entry in `AddTabModal.tsx`, title mapping in `App.tsx`, and rendering switch in `DraggableWindow.tsx`.
  - Ensure the window opens without requiring any IBKR calls until the user clicks an update button.
  - Keep wiring changes minimal and aligned with existing window patterns.
  - Done when (observable): opening the window does not trigger any POST requests; only GET status calls happen on mount.
  - Human check: open DevTools → Network and confirm no `POST /api/ibkr/*` fires until you click.
  - Common issues to watch: accidentally calling update endpoints on mount; title mapping missing so header shows the wrong title.
- `8-4` Purpose: Prevent double-click issues and make failures visible. Description:
  - When a POST is in-flight, disable only the relevant button and show “Running…” near it.
  - On failure, render a short error string inside the window; do not introduce new modal UX.
  - Ensure state resets correctly after success/failure so the user can retry.
  - Done when (observable): clicking a button disables it and shows “Running…” until completion, then re-enables.
  - Human check: intentionally stop the backend and click an update button; you should see a readable error inside the window.
  - Common issues to watch: button stays disabled forever; errors only appear in console (not in the window).
- `8-5` Purpose: Keep displayed status fresh. Description:
  - After each successful update POST, re-fetch `GET /api/updates/status`.
  - After price updates, also re-fetch `GET /api/ibkr/ohlc1d/status` so “latest DB date” updates.
  - Ensure refresh order is deterministic (POST → refresh GETs) to avoid stale UI.
  - Done when (observable): after a successful update, the timestamp fields change without requiring a full page refresh.
  - Human check: click “IBKR Price Data” once; after it finishes, confirm the displayed “latest DB date” updates.
  - Common issues to watch: refreshing only one endpoint (timestamps update but DB date doesn’t, or vice versa).

**Verification hook (Step 8 closeout):**
```
1. Open the Data Control Window
2. Click IBKR Price Data → POST /api/ibkr/ohlc1d/update
3. On success, lastSuccessAt for ibkr_ohlc_1d updates
4. Latest OHLC DB date updates from GET /api/ibkr/ohlc1d/status
5. Click IBKR Calendar Data → POST /api/ibkr/calendar/update; lastSuccessAt updates
```
- User confirmation needed: **Yes**

#### ⬜ Step 9 — Tests / acceptance checks (minimal but real)
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
| Sub-step | Task | Files | Verification | Status |
|----------|------|-------|--------------|--------|
| 9-1 | Add/update backend tests for status persistence | `terminal/backend/tests/*` | Status survives restart-simulated reload | ⬜ |
| 9-2 | Add/update backend tests for CSV allowlist + append | `terminal/backend/tests/*` | Rejects disallowed paths; append writes to last row | ⬜ |
| 9-3 | Add/update backend tests for Finnhub mapping | `terminal/backend/tests/*` | Shape validation passes; no secrets in logs | ⬜ |
| 9-4 | Add/update backend tests for calendar mock cleanup | `terminal/backend/tests/*` | Mock rows deleted; only real-source rows remain | ⬜ |
| 9-5 | Manual FE smoke check for new windows | (manual) | Data Control + Default Ticker + News windows render + call APIs | ⬜ |

**Sub-step purpose & description (Step 9)**
- `9-1` Purpose: Prevent regressions in status persistence. Description:
  - Add repository-level tests that write a status row and read it back from the same DB handle.
  - Ensure `lastSuccessAt` stays stable across “new repository instance” creation (restart-like behavior).
  - Confirm all expected keys are present in the API response even when null.
  - Done when (observable): `npm run test` includes at least one test that simulates “restart-like” behavior and still reads the same status.
  - Human check: run backend tests; confirm failures are actionable (test names mention status persistence clearly).
  - Common issues to watch: tests rely on real local DB state (flaky); timestamps compared without allowing time tolerance.
- `9-2` Purpose: Prevent CSV security/behavior regressions. Description:
  - Test allowlist enforcement: reject paths outside `tradigview_screener/original_data/` and traversal attempts.
  - Test append semantics: appended ticker appears as a new last row and is returned by subsequent reads.
  - Test duplicate policy: second insert of same ticker fails (default).
  - Done when (observable): tests cover “allowed path ok” + “disallowed path rejected” + “duplicate rejected”.
  - Human check: run tests and confirm the error messages mention why a path is rejected (not a generic crash).
  - Common issues to watch: OS-specific path separators causing tests to pass on one OS and fail on another.
- `9-3` Purpose: Validate Finnhub mapping without leaking secrets. Description:
  - Test that mapping produces required fields (title/time/url/source) and persists with `source='FINNHUB'`.
  - Ensure tests do not print API keys/tokens; use local stubs/mocks for HTTP if needed.
  - Verify `update_status(finhub_news)` updates only on success.
  - Done when (observable): tests assert required fields exist and do not require a real Finnhub API key.
  - Human check: scan test output/logs; confirm no tokens/keys appear.
  - Common issues to watch: accidentally hitting the real network in tests; storing raw payloads in snapshots/logs.
- `9-4` Purpose: Prevent mock calendar data from remaining. Description:
  - Add a test that inserts a small number of `mock_provider` rows, then simulates a successful real update.
  - Verify deletion is idempotent (running cleanup twice still results in zero mock rows).
  - Ensure the cleanup triggers only after a successful update (avoid deleting everything on failures).
  - Done when (observable): there is a test that proves mock rows are removed only after a successful update path.
  - Human check: run tests and confirm the calendar cleanup test fails if cleanup is triggered on failure.
  - Common issues to watch: test DB not isolated, causing interference with developer data.
- `9-5` Purpose: Validate the end-to-end UI surfaces. Description:
  - Manual smoke test checklist for the three new/changed windows:
    - Default Ticker: loads + add works
    - news feed:finhub api: renders from backend and no mock
    - Data Control: buttons call endpoints and status refreshes
  - Focus on correctness and “no extra UX” constraints rather than pixel perfection.
  - Done when (observable): a person can complete the checklist in one sitting and capture any failures as screenshots/notes.
  - Human check: run through the checklist with the backend running; verify Network tab shows the expected GET/POST calls.
  - Common issues to watch: backend not running (false failures); cached UI state hiding that an endpoint call failed.

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
║  Legend: ✅ Done+confirmed  ⏳ Done, awaiting user  ⬜ Not started         ║
║          🚫 Blocked (prerequisite not met)                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

⏳ Step 0 (Data availability audit)
│   ├─ 0-1 Finnhub probes ........................... ✅ Done
│   ├─ 0-2 IBKR TWS probe .......................... ✅ Done
│   ├─ 0-3 Capability matrix ........................ ✅ Done
│   └─ 0-4 Decisions (#5, #6) ....................... ✅ Done (confirmed)
│
▼
⏳ Step 1 (Foundations: update_status + API)
│   ├─ 1-1 update_status table ...................... ✅ Done
│   ├─ 1-2 updateStatusRepository.ts ................ ✅ Done
│   ├─ 1-3 Wire GET /api/updates/status ............. ✅ Done
│   └─ 1-4 Persistence test ......................... ✅ Done
│
├──────────────────────┬──────────────────────────────┐
│    TRACK A           │         TRACK B              │
│    (CSV / Ticker)    │         (Finnhub News)       │
│                      │                              │
▼                      ▼                              │
⏳ Step 2               ⏳ Step 4                      │
(CSV read+append API)  (Finnhub ingestion backend)    │
│ ✅ 2-1 tickerCsvSvc  │ ✅ 4-1 finnhubApiKey config  │
│ ✅ 2-2 appendTicker  │ ✅ 4-2 finnhubNewsProvider   │
│ ✅ 2-3 atomic write  │ ✅ 4-3 POST /news/pull-finhub│
│ ✅ 2-4 GET /tickers  │ ✅ 4-4 update finhub_news    │
│ ✅ 2-5 POST /tickers │ ✅ 4-5 verify queryable      │
│ ✅ 2-6 update status │                              │
│                      │                              │
▼                      ▼                              │
⏳ Step 3               ⏳ Step 5                      │
(Default Ticker UI)    (news feed:finhub api UI)     │
│ ✅ 3-1 window type   │ ✅ 5-1 remove brave-news     │
│ ✅ 3-2 component     │ ✅ 5-2 rename → FinnhubNews  │
│ ✅ 3-3 DraggableWin  │ ✅ 5-3 remove mock data      │
│ ✅ 3-4 AddTabModal   │ ✅ 5-4 real fetch            │
│ ✅ 3-5 App.tsx title │ ✅ 5-5 "Update" button       │
│ ✅ 3-6 smoke test    │ ✅ 5-6 AddTabModal label     │
│                      │ ✅ 5-7 App.tsx title         │
│                      │ ✅ 5-8 DraggableWindow switch│
│                      │ ✅ 5-9 Changes% live calc    │
│                      │ ✅ 5-10 server-side search   │
│                      │ ✅ 5-11 Update tooltip (5s)  │
│                      │                              │
└──────────┬───────────┘                              │
           │                                          │
           ▼                                          │
   ╔═══════════════════════════════════════╗           │
   ║  IBKR STEPS (decisions confirmed)     ║           │
   ║  ✅ #5 /calendar source decided       ║           │
   ║  ✅ #6 Node↔IBKR method decided       ║           │
   ╚═══════════════════════════════════════╝           │
           │                                          │
           ├─► ⬜ Step 6 (Calendar ingestion + mock cleanup)
           │      6-1 remove mock workers
           │      6-2 remove startCalendarIngestionWorkers
           │      6-3 implement calendar pull
           │      6-4 wire POST /ibkr/calendar/update
           │      6-5 delete mock_provider rows
           │      6-6 update ibkr_calendar status
           │
           ├─► ⬜ Step 7 (IBKR 1D OHLC ingestion)
           │      7-1 ohlcWatchlistRepository
           │      7-2 ensureDerivedColumns migration
           │      7-3 ibkrOhlc1dProvider
           │      7-4 ohlcDerivedMetrics
           │      7-5 GET /ibkr/ohlc1d/status
           │      7-6 POST /ibkr/ohlc1d/update
           │      7-7 spot-check derived columns
           │
           ▼
   🚫 Step 8 (Data Control Window UI)
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

**Decision summary:**
| Decision | Status | Result |
|----------|--------|--------|
| #5: /calendar data source | ✅ Decided | IBKR calendar first (optional Finnhub estimates later) |
| #6: Node↔IBKR method | ✅ Decided | Python child_process (Option B) |

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
