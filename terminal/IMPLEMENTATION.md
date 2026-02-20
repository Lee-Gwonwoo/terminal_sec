## EN

## Overview
This project implements a Benzinga Pro-like workflow (behavior-only) with 4 core screens:
- `/news`: real-time feed + search/filters + saved views + detail panel
- `/watchlists`: multiple watchlists, optional alerts, cross-tool ticker pinning
- `/calendar`: multi-event calendar filters/sort and watchlist ticker filtering
- `/settings/alerts`: per-tool alert rule setup (browser/sound/email methods)

Stack:
- Frontend: React + TypeScript (Vite)
- Backend: Node + Express + TypeScript
- DB: SQLite (local file)
- Background jobs: in-process scheduler (optional standalone worker)
- Realtime: SSE (`/api/news/stream`)

## Quickstart (Windows)
From the `terminal/` folder:
1. Install dependencies:
   - `npm install`
   - If PowerShell execution policy blocks `npm` scripts, use `npm.cmd install`.
2. Run backend + frontend:
   - `npm run dev`
   - If needed: `npm.cmd run dev`
3. Open UI:
   - `http://localhost:5173`
4. Backend base URL:
   - `http://localhost:8080`

Environment variables (optional):
- `PORT` (default `8080`)
- `SQLITE_PATH` (default `./backend/data/app.db`)
- `FRONTEND_ORIGIN` (default `http://localhost:5173`)

Notes on `.env`:
- Backend loads env via `dotenv` and attempts `../.env` (relative to backend working directory) plus default env loading.
- The typical place for shared settings is `terminal/.env`.

## Libraries / Dependencies

### Backend runtime dependencies (terminal/backend/package.json)
- `express`: HTTP server and routing.
- `cors`: CORS headers so the frontend can call the API.
- `zod`: runtime validation for JSON request bodies (saved views, watchlists, alert rules).
- `dotenv`: reads `.env` into `process.env`.
- `sqlite` + `sqlite3`: SQLite driver + convenience wrapper used by repositories.

### Backend dev/test dependencies
- `tsx`: TypeScript runner/watch mode for local development (`tsx watch`).
- `typescript`: compilation (`tsc`).
- `vitest`: unit/integration tests.
- `supertest`: HTTP testing against Express app.
- `@types/*`: TypeScript type packages.

### Frontend runtime dependencies (terminal/frontend/package.json)
- `react` / `react-dom`: UI runtime.
- `react-router-dom`: routing between `/news`, `/watchlists`, `/calendar`, `/settings/alerts`.

### Frontend dev/test dependencies
- `vite` + `@vitejs/plugin-react`: dev server + build.
- `typescript`: type-check/build step.
- `vitest`: tests.
- `@types/*`: TypeScript type packages.

## Project Structure
- `backend/src/server.ts`: API routes + SSE stream endpoint + in-process ingestion scheduler
- `backend/src/services/*`: repository logic for news, saved views, watchlists, calendar, alerts
- `backend/src/worker/localIngestWorker.ts`: optional standalone ingestion job (without Redis)
- `backend/src/db.ts`: SQLite schema bootstrap and DB initialization
- `frontend/src/pages/NewsPage.tsx`: news feed UI + pause + polling fallback + saved views + watchlist pinning
- `frontend/src/pages/WatchlistsPage.tsx`: watchlist CRUD and cross-tool ticker pinning
- `frontend/src/pages/CalendarPage.tsx`: calendar type dropdown + date/ticker/watchlist filters + sortable sticky table + detail drawer + CSV export
- `frontend/src/pages/AlertsSettingsPage.tsx`: alert rule CRUD hook UI

## Code Map (What lives where)

### Backend
- `backend/src/server.ts`
   - Express app setup (CORS + JSON parsing)
   - API routes for News, Saved Views, Watchlists, Calendar, Alerts
   - SSE endpoint (`GET /api/news/stream`)
   - Startup flow: `initDb()` → `ensureSeedData()` → start in-process ingestion/workers → `app.listen()`
- `backend/src/config.ts`
   - Loads env vars and exports `config` (`port`, `sqlitePath`, `frontendOrigin`).
- `backend/src/db.ts`
   - Creates SQLite file + bootstraps schema (CREATE TABLE / INDEX)
   - Minimal “migration” helper `ensureColumn()` for adding columns safely.
- `backend/src/seed.ts`
   - Ensures the demo user exists
   - Seeds initial Calendar events using `upsertCalendarEvent()`.
- `backend/src/services/newsRepository.ts`
   - `getNews()` cursor pagination + filters
   - `getNewsById()` detail
   - `insertNewsItem()` with `INSERT OR IGNORE` dedupe.
- `backend/src/services/newsIngestion.ts`
   - In-process scheduler: pulls mock provider items every 5s
   - Enrichment: ticker extraction + tag classification
   - Inserts into DB and publishes to SSE stream hub.
- `backend/src/realtime/streamHub.ts`
   - Tracks connected SSE clients + their filters
   - Publishes `news_item` frames only to matching clients
   - Sends periodic heartbeat events.
- `backend/src/services/newsFilterMatcher.ts`
   - Filter predicate used by SSE publish (same semantics as query filters).
- `backend/src/services/watchlistRepository.ts`
   - Watchlist CRUD and tickers list.
- `backend/src/services/savedViewRepository.ts`
   - Saved view CRUD (stores query JSON for restore).
- `backend/src/services/alertsRepository.ts`
   - Alert rules list/upsert (persistence hook).
- `backend/src/services/calendarRepository.ts`
   - Calendar type registry (`CALENDAR_TYPE_CONFIG`)
   - Calendar list/detail/export endpoints (filter/sort/cursor pagination)
   - Upsert by `(event_type, unique_key)` for dedupe.
- `backend/src/services/calendarIngestion.ts`
   - Per-type in-process mock workers writing/upserting events periodically.
- `backend/src/utils/retry.ts`
   - `withRetry()` helper (default retries: 10) used for transient operations.

### Frontend
- `frontend/src/App.tsx`
   - Router and shared `pinnedTickers` state passed to pages.
- `frontend/src/api.ts`
   - Typed API client
   - Hard-coded `API_BASE = http://localhost:8080` (change here if backend port changes).
- `frontend/src/types.ts`
   - Shared TS types for News, Watchlists, Calendar, Alerts.
- `frontend/src/pages/NewsPage.tsx`
   - News filters + list + realtime toggle + pause/queue
   - Saved view create/restore
   - Watchlist pinning into shared `pinnedTickers`
   - Reads URL query params (`tickers`, `from`, `to`, `keyword`) for deep-link prefill.
- `frontend/src/pages/WatchlistsPage.tsx`
   - Watchlist CRUD
   - “Use in News/Calendar” sets `pinnedTickers`.
- `frontend/src/pages/CalendarPage.tsx`
   - Calendar type dropdown + filters
   - Sort-by-click on any column (client sends `sort=col:dir`)
   - Cursor pagination (“Next Page”)
   - Detail drawer fetch on row click
   - CSV export link
   - “Open News” cross-link to `/news?...`.
- `frontend/src/pages/AlertsSettingsPage.tsx`
   - Alert rule CRUD UI (persistence hook).

## End-to-end Flow (How it works)

### Backend boot sequence
1. `start()` in `backend/src/server.ts` runs.
2. `initDb()` creates/opens the SQLite file and ensures tables/indexes exist.
3. `ensureSeedData()` ensures the demo user and initial Calendar rows exist.
4. `startInProcessNewsIngestion(streamHub)` starts the news ingestion loop.
5. `startCalendarIngestionWorkers()` starts per-type calendar ingestion loops.
6. Express starts listening on `config.port`.
7. A 20s interval triggers `streamHub.heartbeat()`.

### News ingestion + realtime delivery (SSE)
- Every 5 seconds `startInProcessNewsIngestion()`:
   1. Calls `pullMockNews()` (mock provider items).
   2. Enriches items:
       - ticker extraction: provider tickers + `$TICKER` regex in text
       - tag classification: rule-based keywords (earnings/guidance/merger/etc.)
   3. Inserts into SQLite via `insertNewsItem()` with DB-level dedupe: `UNIQUE(source, url)` and `INSERT OR IGNORE`.
   4. If inserted, publishes to clients via `streamHub.publishNews(item)`.

- `GET /api/news/stream`:
   - Keeps a long-lived connection (`text/event-stream`).
   - Stores client + filters in `StreamHub`.
   - On publish, `matchesNewsFilters()` gates delivery so each client only gets matching items.

### News UI behavior
- `NewsPage` fetches the initial list from `GET /api/news`.
- If realtime is ON, it opens an `EventSource` to `/api/news/stream`.
- The frontend de-dupes by `id` and supports:
   - pause → queue incoming items
   - `New items (N)` button → merge queue and scroll top
- If realtime is OFF, the UI polls `GET /api/news` every 10 seconds.

### Watchlist pinning across tools
- `WatchlistsPage` can set the global `pinnedTickers` via the “Use in News/Calendar” action.
- `NewsPage` uses `pinnedTickers` as its ticker filter.
- `CalendarPage` uses `pinnedTickers` as the default ticker filter when `watchlist_id` is not selected.

### Calendar ingestion + query
- Calendar workers (`backend/src/services/calendarIngestion.ts`) run per type on intervals and call `upsertCalendarEvent()`.
- `upsertCalendarEvent()` writes to the single `calendar_events` table and dedupes by `(event_type, unique_key)`.

### Calendar UI behavior
- `CalendarPage` loads calendar types from `GET /api/calendar/types`.
- It builds “effective tickers” as:
   - if `watchlist_id` is chosen: watchlist tickers
   - else: global `pinnedTickers`
   - plus any explicit tickers typed into the filter input
- It requests list data from `GET /api/calendar/events` and renders:
   - dynamic columns from `CALENDAR_TYPE_CONFIG.columns`
   - click-to-sort for any column
   - detail drawer from `GET /api/calendar/events/:id`
   - export via `GET /api/calendar/events/export.csv`
- “Open News” navigates to `/news` with query params:
   - `tickers=<ticker>`
   - `from=<event_time-1h>`
   - `to=<event_time+1h>`
   - Then `NewsPage` reads these and pre-fills its filters.

## Implemented Behavior Mapping

### News
- Fast searchable feed via combined filters: keyword + tickers + sources + tags + time range.
- Cursor pagination support in backend (`GET /api/news`).
- Real-time SSE stream (`GET /api/news/stream`) with filter-aware delivery.
- Pause toggle: while paused, incoming items queue in memory and can be merged on demand.
- New-items button: `New items (N)` appears and scrolls to top when clicked.
- Detail panel: row click fetches and renders full news details (`GET /api/news/:id`).
- Saved Views:
  - Create (`POST /api/news/saved-views`)
  - List (`GET /api/news/saved-views`)
  - Delete (`DELETE /api/news/saved-views/:id`)
  - Includes `enableAlerts` hook field.

### Watchlists
- Multiple watchlists with many tickers per watchlist.
- Optional watchlist alert toggle persisted.
- Watchlist can pin tickers for News and Calendar filtering.

### Calendar
- Calendar types implemented:
   - earnings
   - dividends
   - splits
   - analyst_ratings
   - sec_filings
   - economics
- API contract:
   - `GET /api/calendar/types`
   - `GET /api/calendar/events?type=&tickers=&watchlist_id=&from=&to=&time_of_day=&region=&sort=&cursor=&limit=`
   - `GET /api/calendar/events/:id`
   - `GET /api/calendar/events/export.csv?...`
- Cursor pagination implemented for large table mode.
- Sort by any column:
   - native columns (`event_time`, `ticker`, `title`, ...)
   - type-specific fields through JSON extraction.
- Filters:
   - date range
   - ticker list
   - watchlist_id (same watchlists as watchlist tool)
   - earnings `time_of_day` (BMO/AMC/Unknown)
   - economics `region`/`country`
- Row detail drawer renders all `fields_json` values and optional links.
- CSV export reflects current filters and sort.
- Cross-link:
   - `Open News` button on each row opens `/news` with prefilled ticker + around-time window.

### Alerts Hook
- `/settings/alerts` persists per-tool rule with methods: browser/sound/email.
- This is intentionally a hook layer ready for full alert engine expansion.

### Ingestion + Enrichment
- Scheduler periodically pulls mock provider items.
- Enrichment pipeline:
  1. ticker extraction (provider tickers + `$TICKER` regex)
  2. rule-based tag classification
  3. DB insert with dedupe (`UNIQUE(source, url)`)
   4. publish directly to SSE stream hub

### Calendar Ingestion
- Calendar ingestion is split by type worker functions (one function per type) inside `backend/src/services/calendarIngestion.ts`.
- Each worker upserts by `(event_type, unique_key)` to prevent duplicates.
- New types are added by:
   1. appending config in `CALENDAR_TYPE_CONFIG`
   2. adding one ingestion function
   3. registering schedule in `startCalendarIngestionWorkers()`

## DB Schema Summary (SQLite)
The DB is created automatically on backend startup by `backend/src/db.ts`.

### `users`
- `id` (TEXT, PK)
- `email` (TEXT, UNIQUE)
- `created_at` (TEXT, default now)

### `news_items`
- `id` (TEXT, PK)
- `published_at` (TEXT, ISO timestamp)
- `source` (TEXT)
- `source_type` (TEXT)
- `title` (TEXT)
- `body` (TEXT)
- `url` (TEXT)
- `tickers_csv` (TEXT)
- `tags_csv` (TEXT)
- `created_at` (TEXT, default now)

Notes:
- Dedupe is enforced by `UNIQUE(source, url)`.
- `tickers_csv` / `tags_csv` use a “CSV envelope” string format like `,NVDA,TSLA,` to make `LIKE` filtering simple.

### `news_saved_views`
- `id` (TEXT, PK)
- `user_id` (TEXT, FK users)
- `name` (TEXT)
- `query_json` (TEXT; JSON string)
- `enable_alerts` (INTEGER 0/1)
- `created_at` (TEXT, default now)

### `watchlists`
- `id` (TEXT, PK)
- `user_id` (TEXT, FK users)
- `name` (TEXT)
- `enable_alerts` (INTEGER 0/1)
- `created_at` (TEXT, default now)

### `watchlist_items`
- `watchlist_id` (TEXT, FK watchlists)
- `ticker` (TEXT)
- `created_at` (TEXT, default now)
- PK: `(watchlist_id, ticker)`

### `calendar_events`
- `id` (TEXT, PK)
- `event_type` (TEXT)
- `ticker` (TEXT, nullable; used for ticker-bearing events)
- `title` (TEXT)
- `event_at` (TEXT, ISO timestamp)
- `meta_json` (TEXT; JSON string containing type-specific fields)
- `source` (TEXT)
- `unique_key` (TEXT)
- `created_at` (TEXT, default now)

Notes:
- Dedupe is enforced by a unique index on `(event_type, unique_key)`.
- Sorting of type-specific fields uses `json_extract(meta_json, '$.<field>')`.

### `alert_rules`
- `id` (TEXT, PK)
- `user_id` (TEXT, FK users)
- `tool` (TEXT; `news|watchlists|calendar`)
- `name` (TEXT)
- `enabled` (INTEGER 0/1)
- `methods_json` (TEXT; JSON array)
- `rule_json` (TEXT; JSON object)
- `created_at` (TEXT, default now)

## Run Instructions
1. Install dependencies:
   - `npm install`
2. Run backend + frontend:
   - `npm run dev`
3. Optional: run standalone ingestion worker in another terminal:
   - `npm run worker -w backend`
   - Note: the backend server already runs in-process ingestion by default.
     Running the worker at the same time will generate additional mock items; DB dedupe prevents exact duplicates by `(source, url)`.
4. Open UI:
   - `http://localhost:5173`

## Notes
- UI behavior copies workflow patterns, not Benzinga branding/pixel UI.
- Realtime fallback exists: when realtime is disabled, polling runs every 10s.
- Realtime de-dupe uses `id` set in the frontend.
- Current mode is a single demo user (no login/auth). The demo user id is a constant in the backend.
- Calendar cursor pagination is implemented as a keyset on `(event_time, id)`.

---

## KO

## 개요
이 프로젝트는 Benzinga Pro의 **브랜딩이 아닌 워크플로우 동작**을 기준으로 4개 핵심 화면을 구현했습니다.
- `/news`: 실시간 피드 + 검색/필터 + Saved View + 상세 패널
- `/watchlists`: 다중 워치리스트, 알림 옵션, 타 도구 필터 연동
- `/calendar`: 다중 이벤트 캘린더 필터/정렬 + 워치리스트 티커 연동
- `/settings/alerts`: 도구별 알림 규칙 설정(브라우저/사운드/이메일)

스택:
- Frontend: React + TypeScript (Vite)
- Backend: Node + Express + TypeScript
- DB: SQLite (로컬 파일)
- Background jobs: 프로세스 내 스케줄러(필요 시 standalone worker)
- Realtime: SSE (`/api/news/stream`)

## 빠른 실행 (Windows)
`terminal/` 폴더에서 실행:
1. 의존성 설치:
   - `npm install`
   - PowerShell 실행 정책 때문에 `npm`이 막히면 `npm.cmd install` 사용
2. 백엔드 + 프런트 동시 실행:
   - `npm run dev`
   - 필요 시 `npm.cmd run dev`
3. UI 접속:
   - `http://localhost:5173`
4. 백엔드 기본 주소:
   - `http://localhost:8080`

환경변수(선택):
- `PORT` (기본값 `8080`)
- `SQLITE_PATH` (기본값 `./backend/data/app.db`)
- `FRONTEND_ORIGIN` (기본값 `http://localhost:5173`)

`.env` 참고:
- 백엔드는 `dotenv`로 env를 로드하며, backend 작업 디렉토리 기준 `../.env`를 먼저 시도한 뒤 기본 로드를 수행합니다.
- 보통 공용 설정 파일 위치는 `terminal/.env`입니다.

## 라이브러리 / 의존성

### 백엔드 런타임 의존성 (terminal/backend/package.json)
- `express`: HTTP 서버/라우팅.
- `cors`: 프런트에서 API 호출 가능하도록 CORS 헤더 설정.
- `zod`: JSON 요청 바디 런타임 검증(saved view, watchlist, alert rule).
- `dotenv`: `.env` 값을 `process.env`로 로드.
- `sqlite` + `sqlite3`: SQLite 드라이버 + 래퍼(저장소 레이어에서 사용).

### 백엔드 개발/테스트 의존성
- `tsx`: TypeScript 실행기 + watch 모드(`tsx watch`).
- `typescript`: 컴파일(`tsc`).
- `vitest`: 테스트 러너.
- `supertest`: Express API 테스트.
- `@types/*`: TypeScript 타입 패키지.

### 프런트 런타임 의존성 (terminal/frontend/package.json)
- `react` / `react-dom`: UI 런타임.
- `react-router-dom`: `/news`, `/watchlists`, `/calendar`, `/settings/alerts` 라우팅.

### 프런트 개발/테스트 의존성
- `vite` + `@vitejs/plugin-react`: 개발 서버 + 빌드.
- `typescript`: 타입체크/빌드.
- `vitest`: 테스트.
- `@types/*`: TypeScript 타입 패키지.

## 프로젝트 구조
- `backend/src/server.ts`: API 라우트 + SSE 스트림 + 프로세스 내 인제스트 스케줄러
- `backend/src/services/*`: 뉴스/Saved View/워치리스트/캘린더/알림 저장소 로직
- `backend/src/worker/localIngestWorker.ts`: Redis 없이 동작하는 선택형 standalone 인제스트
- `backend/src/db.ts`: SQLite 스키마 부트스트랩/초기화
- `frontend/src/pages/NewsPage.tsx`: 뉴스 UI + Pause + 폴링 폴백 + Saved View + 워치리스트 핀
- `frontend/src/pages/WatchlistsPage.tsx`: 워치리스트 CRUD + 도구 간 티커 연동
- `frontend/src/pages/CalendarPage.tsx`: 캘린더 타입 드롭다운 + 날짜/티커/워치리스트 필터 + 정렬 가능한 sticky 테이블 + 상세 드로어 + CSV 내보내기
- `frontend/src/pages/AlertsSettingsPage.tsx`: 알림 규칙 저장 UI 훅

## 코드 위치 맵 (어떤 기능이 어떤 파일에 있는지)

### 백엔드
- `backend/src/server.ts`
   - Express 앱 구성(CORS + JSON 파서)
   - News/Saved Views/Watchlists/Calendar/Alerts API 라우트
   - SSE 엔드포인트(`GET /api/news/stream`)
   - 부팅 흐름: `initDb()` → `ensureSeedData()` → 프로세스 내 인제스트/워커 시작 → `app.listen()`
- `backend/src/config.ts`
   - env 로드 및 `config` export (`port`, `sqlitePath`, `frontendOrigin`).
- `backend/src/db.ts`
   - SQLite 파일 생성/오픈 + 스키마 부트스트랩(CREATE TABLE / INDEX)
   - 간단한 컬럼 추가 마이그레이션 헬퍼 `ensureColumn()`.
- `backend/src/seed.ts`
   - 데모 사용자 보장
   - `upsertCalendarEvent()`로 초기 캘린더 이벤트 seed.
- `backend/src/services/newsRepository.ts`
   - `getNews()` 커서 페이지네이션 + 필터
   - `getNewsById()` 상세
   - `insertNewsItem()`의 `INSERT OR IGNORE` 중복 방지.
- `backend/src/services/newsIngestion.ts`
   - 프로세스 내 스케줄러: 5초마다 mock provider를 pull
   - 보강: 티커 추출 + 태그 분류
   - DB 저장 후 SSE 허브로 publish.
- `backend/src/realtime/streamHub.ts`
   - SSE 클라이언트와 필터를 저장/관리
   - publish 시 필터 매칭되는 클라이언트에게만 프레임 전송
   - heartbeat 전송.
- `backend/src/services/newsFilterMatcher.ts`
   - SSE publish에서 사용하는 필터 매칭(쿼리 필터와 동일 의미).
- `backend/src/services/watchlistRepository.ts`
   - 워치리스트 CRUD + 티커 목록.
- `backend/src/services/savedViewRepository.ts`
   - Saved View CRUD(쿼리 JSON 저장/복원).
- `backend/src/services/alertsRepository.ts`
   - Alert rule list/upsert(영속성 훅).
- `backend/src/services/calendarRepository.ts`
   - 캘린더 타입 레지스트리(`CALENDAR_TYPE_CONFIG`)
   - 캘린더 list/detail/export(필터/정렬/커서 페이지네이션)
   - `(event_type, unique_key)` 업서트 기반 중복 방지.
- `backend/src/services/calendarIngestion.ts`
   - 타입별 프로세스 내 mock 워커(주기적으로 upsert).
- `backend/src/utils/retry.ts`
   - `withRetry()` 헬퍼(기본 10회 재시도) - 일시적 실패에 사용.

### 프런트
- `frontend/src/App.tsx`
   - 라우터 구성 + 공유 상태 `pinnedTickers`를 페이지로 전달.
- `frontend/src/api.ts`
   - 타입 기반 API 클라이언트
   - `API_BASE = http://localhost:8080` 하드코딩(포트 변경 시 여기 수정).
- `frontend/src/types.ts`
   - News/Watchlists/Calendar/Alerts 공용 타입.
- `frontend/src/pages/NewsPage.tsx`
   - 뉴스 필터 + 리스트 + 실시간 토글 + pause/queue
   - Saved View 생성/복원
   - 워치리스트를 통한 `pinnedTickers` 핀
   - URL 쿼리(`tickers`, `from`, `to`, `keyword`)를 읽어서 딥링크 프리필.
- `frontend/src/pages/WatchlistsPage.tsx`
   - 워치리스트 CRUD
   - “Use in News/Calendar”로 `pinnedTickers` 설정.
- `frontend/src/pages/CalendarPage.tsx`
   - 캘린더 타입 드롭다운 + 필터
   - 어떤 컬럼이든 클릭 정렬(클라이언트가 `sort=col:dir`로 전송)
   - 커서 페이지네이션(“Next Page”)
   - 행 클릭 시 상세 드로어
   - CSV export 링크
   - “Open News” 크로스링크(`/news?...`).
- `frontend/src/pages/AlertsSettingsPage.tsx`
   - 알림 규칙 CRUD UI(영속성 훅).

## 전체 동작 원리 (End-to-end)

### 백엔드 부팅 순서
1. `backend/src/server.ts`의 `start()` 실행
2. `initDb()`로 SQLite 파일 오픈 + 테이블/인덱스 보장
3. `ensureSeedData()`로 데모 유저 및 초기 캘린더 seed
4. `startInProcessNewsIngestion(streamHub)`로 뉴스 인제스트 루프 시작
5. `startCalendarIngestionWorkers()`로 캘린더 타입별 워커 시작
6. Express가 `config.port`에서 리슨
7. 20초마다 `streamHub.heartbeat()` 실행

### 뉴스 인제스트 + 실시간(SSE)
- 5초마다 `startInProcessNewsIngestion()`이:
   1. `pullMockNews()` 호출(목 provider)
   2. 보강 수행:
       - 티커 추출: provider tickers + 본문 `$TICKER` 정규식
       - 태그 분류: 키워드 룰(earnings/guidance/merger 등)
   3. SQLite에 `insertNewsItem()`으로 저장(중복 방지: `UNIQUE(source, url)` + `INSERT OR IGNORE`)
   4. 새로 삽입된 경우 `streamHub.publishNews(item)`으로 SSE 전파

- `GET /api/news/stream`:
   - 연결을 유지하는 `text/event-stream`
   - 클라이언트의 필터를 `StreamHub`에 저장
   - publish 시 `matchesNewsFilters()`로 매칭되는 클라이언트에게만 전송

### 뉴스 UI 동작
- `NewsPage`가 `GET /api/news`로 초기 목록 로드
- realtime ON이면 `/api/news/stream`에 `EventSource` 연결
- 프런트는 `id`로 중복 제거하고 아래 기능을 제공:
   - pause → 새 아이템을 큐에 쌓기
   - `New items (N)` 버튼 → 큐 병합 + 상단 스크롤
- realtime OFF이면 10초마다 `GET /api/news` 폴링

### 워치리스트 핀(도구 간 연동)
- `WatchlistsPage`의 “Use in News/Calendar”로 전역 `pinnedTickers` 설정
- `NewsPage`는 `pinnedTickers`를 ticker 필터로 사용
- `CalendarPage`는 `watchlist_id`가 없을 때 기본 ticker 필터로 `pinnedTickers` 사용

### 캘린더 인제스트 + 조회
- `backend/src/services/calendarIngestion.ts`의 타입별 워커가 주기적으로 실행되며 `upsertCalendarEvent()` 호출
- `upsertCalendarEvent()`는 단일 테이블 `calendar_events`에 쓰고, `(event_type, unique_key)`로 중복을 제거

### 캘린더 UI 동작
- `CalendarPage`는 `GET /api/calendar/types`로 타입 목록 로드
- “실제 적용 티커(effective tickers)”를 다음 규칙으로 만듭니다:
   - `watchlist_id` 선택 시: 선택한 워치리스트 티커
   - 미선택 시: 전역 `pinnedTickers`
   - + 입력창에 직접 입력한 티커
- `GET /api/calendar/events`로 리스트를 받아서 렌더:
   - `CALENDAR_TYPE_CONFIG.columns` 기반 동적 컬럼
   - 컬럼 클릭으로 정렬
   - 행 클릭 시 `GET /api/calendar/events/:id` 상세 드로어
   - CSV export: `GET /api/calendar/events/export.csv`
- “Open News”는 `/news`로 이동하며 쿼리를 주입:
   - `tickers=<ticker>`
   - `from=<event_time-1h>`
   - `to=<event_time+1h>`
   - `NewsPage`가 이 값을 읽어 필터를 프리필합니다.

## 구현 동작 매핑

### 뉴스
- 키워드 + 티커 + 소스 + 태그 + 시간 범위를 조합해 필터링 가능한 피드.
- 백엔드 커서 페이지네이션 지원 (`GET /api/news`).
- 필터 반영 실시간 SSE 스트림 (`GET /api/news/stream`).
- Pause 토글: pause 중 유입 뉴스는 큐에 쌓고 필요 시 합치기.
- `New items (N)` 버튼으로 상단 이동/최신 반영.
- 행 클릭 시 상세 패널 렌더링 (`GET /api/news/:id`).
- Saved View:
  - 생성 (`POST /api/news/saved-views`)
  - 조회 (`GET /api/news/saved-views`)
  - 삭제 (`DELETE /api/news/saved-views/:id`)
  - `enableAlerts` 훅 필드 포함.

### 워치리스트
- 사용자별 다중 워치리스트 + 다중 티커.
- 워치리스트별 알림 옵션 저장.
- 워치리스트 선택으로 뉴스/캘린더 티커 필터 핀 적용.

### 캘린더
- 구현된 캘린더 타입:
   - earnings
   - dividends
   - splits
   - analyst_ratings
   - sec_filings
   - economics
- API 계약:
   - `GET /api/calendar/types`
   - `GET /api/calendar/events?type=&tickers=&watchlist_id=&from=&to=&time_of_day=&region=&sort=&cursor=&limit=`
   - `GET /api/calendar/events/:id`
   - `GET /api/calendar/events/export.csv?...`
- 대규모 표 조회를 위한 커서 페이지네이션 구현.
- 모든 컬럼 정렬 지원:
   - 기본 컬럼(`event_time`, `ticker`, `title` 등)
   - JSON 필드 추출 기반 타입별 컬럼 정렬.
- 필터:
   - 날짜 범위
   - 티커 다중 선택
   - watchlist_id (워치리스트 도구와 동일 데이터)
   - earnings `time_of_day` (BMO/AMC/Unknown)
   - economics `region`/`country`
- 행 상세 드로어에서 `fields_json` 전체 필드 및 링크 표시.
- CSV 내보내기는 현재 필터/정렬 상태를 그대로 반영.
- 크로스링크:
   - 각 행 `Open News` 버튼으로 `/news`에 티커 + 이벤트 전후 시간 필터를 자동 주입.

### 알림 훅
- `/settings/alerts`에서 도구별 규칙 및 방법(브라우저/사운드/이메일) 저장.
- 현재는 “알림 엔진 연동을 위한 훅 계층”까지 구현.

### 인제스트 + 보강
- 스케줄러가 주기적으로 목 provider에서 뉴스를 가져옴.
- 보강 파이프라인:
  1. 티커 추출 (provider tickers + `$TICKER` 정규식)
  2. 규칙 기반 태그 분류
  3. 중복 방지 삽입 (`UNIQUE(source, url)`)
   4. SSE 스트림 허브로 직접 전파

### 캘린더 인제스트
- `backend/src/services/calendarIngestion.ts`에서 타입별 워커 함수(타입당 1개)로 동작합니다.
- `(event_type, unique_key)` 기준 업서트로 중복 이벤트를 방지합니다.
- 새 타입 확장 방법:
   1. `CALENDAR_TYPE_CONFIG`에 타입 추가
   2. 해당 타입 인제스트 함수 추가
   3. `startCalendarIngestionWorkers()` 스케줄에 등록

## DB 스키마 요약
SQLite DB는 백엔드 시작 시 `backend/src/db.ts`에서 자동 생성됩니다.

### `users`
- `id` (TEXT, PK)
- `email` (TEXT, UNIQUE)
- `created_at` (TEXT, default now)

### `news_items`
- `id` (TEXT, PK)
- `published_at` (TEXT, ISO 타임스탬프)
- `source` (TEXT)
- `source_type` (TEXT)
- `title` (TEXT)
- `body` (TEXT)
- `url` (TEXT)
- `tickers_csv` (TEXT)
- `tags_csv` (TEXT)
- `created_at` (TEXT, default now)

참고:
- 중복 방지는 `UNIQUE(source, url)`로 강제합니다.
- `tickers_csv` / `tags_csv`는 `,NVDA,TSLA,` 같은 “CSV envelope” 포맷으로 저장하여 `LIKE` 필터링을 단순화합니다.

### `news_saved_views`
- `id` (TEXT, PK)
- `user_id` (TEXT, FK users)
- `name` (TEXT)
- `query_json` (TEXT; JSON 문자열)
- `enable_alerts` (INTEGER 0/1)
- `created_at` (TEXT, default now)

### `watchlists`
- `id` (TEXT, PK)
- `user_id` (TEXT, FK users)
- `name` (TEXT)
- `enable_alerts` (INTEGER 0/1)
- `created_at` (TEXT, default now)

### `watchlist_items`
- `watchlist_id` (TEXT, FK watchlists)
- `ticker` (TEXT)
- `created_at` (TEXT, default now)
- PK: `(watchlist_id, ticker)`

### `calendar_events`
- `id` (TEXT, PK)
- `event_type` (TEXT)
- `ticker` (TEXT, nullable; 티커가 있는 이벤트에 사용)
- `title` (TEXT)
- `event_at` (TEXT, ISO 타임스탬프)
- `meta_json` (TEXT; 타입별 필드를 담은 JSON 문자열)
- `source` (TEXT)
- `unique_key` (TEXT)
- `created_at` (TEXT, default now)

참고:
- `(event_type, unique_key)`에 유니크 인덱스를 두어 중복을 방지합니다.
- 타입별 필드 정렬은 `json_extract(meta_json, '$.<field>')`로 구현합니다.

### `alert_rules`
- `id` (TEXT, PK)
- `user_id` (TEXT, FK users)
- `tool` (TEXT; `news|watchlists|calendar`)
- `name` (TEXT)
- `enabled` (INTEGER 0/1)
- `methods_json` (TEXT; JSON 배열)
- `rule_json` (TEXT; JSON 오브젝트)
- `created_at` (TEXT, default now)

## 실행 방법
1. 의존성 설치:
   - `npm install`
2. 백엔드 + 프런트 동시 실행:
   - `npm run dev`
3. (선택) 별도 터미널에서 standalone 워커 실행:
   - `npm run worker -w backend`
   - 참고: 현재 백엔드 서버는 기본적으로 프로세스 내 인제스트를 이미 실행합니다.
     워커를 동시에 실행하면 mock 아이템이 추가로 생성될 수 있으며, DB는 `(source, url)` 기준으로 동일 항목을 중복 방지합니다.
4. UI 접속:
   - `http://localhost:5173`

## 참고
- UI는 벤징가의 화면 디자인 복제가 아니라 **동작 복제**에 집중했습니다.
- 실시간 끄면 10초 폴링 폴백으로 계속 동작합니다.
- 프런트 실시간 중복 제거는 `id` 기반으로 처리합니다.
- 현재는 단일 데모 사용자 모드이며(로그인/인증 없음), 데모 사용자 id는 백엔드 상수입니다.
- 캘린더 커서 페이지네이션은 `(event_time, id)` 키셋 방식으로 구현되어 있습니다.
