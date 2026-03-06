# Backend Prompt (terminal/backend)

## EN

### Purpose
This document is a working prompt/spec for the Node/Express/TypeScript backend located under `terminal/backend/`.

Primary focus in this repo iteration:
- Persist news items in SQLite.
- Provide a filterable, cursor-paginated `GET /api/news` feed.
- Support importing historical news from EODHD into SQLite via `POST /api/news/pull-eodhd`.
- Stream newly inserted items via SSE (`GET /api/news/stream`).

Constraints and expectations:
- Do not add mock news generation.
- Do not log secrets (especially the EODHD token).
- Keep API responses stable unless explicitly requested.
- Prefer correctness and debuggability over cleverness.

### How to run (dev)
From `terminal/backend/`:

1) Install deps
```bash
npm install
```

2) Start in watch mode
```bash
npm run dev
```

Backend defaults:
- Port: `8080` (env `PORT`)
- SQLite: `./backend/data/app.db` (env `SQLITE_PATH`)
- CORS origin: `http://localhost:5173` (env `FRONTEND_ORIGIN`)

Environment loading:
- `src/config.ts` calls `dotenv.config({ path: "../.env" })` then `dotenv.config()`.
  - That means a `terminal/.env` (one folder above `terminal/backend`) is loaded first if present.

### Where the EODHD token lives
The EODHD token is read from the repo root file:

- `EODHD/API TOKEN`

The backend resolves repo root by walking up from `src/services/eodhdNewsProvider.ts` until it finds `EODHD/API TOKEN`.

Failure modes:
- Missing token file → request fails with a 400 `{error: "EODHD token file not found at ..."}`.
- Empty token file → request fails with a 400 `{error: "EODHD token file is empty"}`.

### Where the Finnhub API key lives
The Finnhub API key is required for the backend to start.

Lookup order (see `terminal/backend/src/config.ts`):
1. Environment variable `FINNHUB_API_KEY`
2. File fallback at repo root: `finhub/finhub_api_key/finhub_api_key`

Failure modes:
- Missing key → backend throws on startup with an error like:
  - `FINNHUB_API_KEY not found. Set env var FINNHUB_API_KEY or place key in finhub/finhub_api_key/finhub_api_key`

Security note:
- Do not log or commit the API key.

### Data model (SQLite)
DB init and schema live in `src/db.ts`.

Key tables for news:
- `news_items`
  - Base columns: `id`, `published_at`, `source`, `source_type`, `title`, `body`, `url`, `tickers_csv`, `tags_csv`, `created_at`
  - Change% columns (optional, computed post-ingest):
    - `ohlc_ticker`, `ohlc_date`, `change_1d_pct`, `change_from_open_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`, `change_computed_at`
  - Uniqueness: `UNIQUE (source, url)`
  - Index: `idx_news_items_published` on `(published_at DESC, id DESC)`

Key table for update tracking:
- `update_status`
  - Tracks: last successful time and details for ingestion/update actions.
  - Known keys (always returned by `GET /api/updates/status`): `tickers_csv`, `finhub_news`, `ibkr_calendar`, `ibkr_ohlc_1d`.

Deduplication strategy:
- Inserts use `INSERT OR IGNORE`.
- A duplicate is defined as same `(source, url)`.

### News API (read)

#### GET /api/news
Cursor pagination and filtering are implemented in `src/services/newsRepository.ts`.

Supported query params (see `NewsQuery` in `src/types.ts`):
- `keyword`: case-insensitive substring match over `LOWER(title || ' ' || body)`
- `tickers`: CSV string, ex `tickers=TSLA,NVDA`
  - Stored in DB as an envelope like `,TSLA,NVDA,` and filtered via `tickers_csv LIKE '%,TSLA,%'`.
- `sources`: filters `source_type IN (...)`
  - Alias: `source_type` is also accepted as a query param (same meaning).
- `source_names`: filters `source IN (...)`
- `tags`: similar envelope strategy (`tags_csv LIKE '%,earnings,%'`)
- `from`: published_at >= from
- `to`: published_at <= to
- `limit`: requested page size
- `cursor`: base64 of `published_at|id` from the last item of the previous page

Cursor semantics:
- Sort order is `published_at DESC, id DESC`.
- When a cursor is provided, the query adds:
  - `(published_at < cursor.publishedAt OR (published_at = cursor.publishedAt AND id < cursor.id))`

Server-side limit policy (important):
- If `limit` is missing/invalid → default requested limit is 200.
- The backend caps the effective limit based on date-range width:
  - range <= 7 days → max 200
  - range <= 31 days → max 100
  - range > 31 days → max 50
- Absolute hard clamp is always 1..200.

Response shape:
```json
{ "items": [/* NewsItem[] */], "nextCursor": "..." }
```

`nextCursor` is only present when there are more rows.

#### GET /api/news/:id
Loads a single row by ID.

### News API (import from EODHD)

#### POST /api/news/pull-eodhd
Route lives in `src/server.ts` and validates input with Zod.

Two mutually exclusive modes (exactly one):
- `{ "date": "YYYY-MM-DD" }`
- `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }`

Other fields:
- `symbol` (string, default `"QQQ.US"`)
  - If empty string, upstream query omits `s=` and pulls a “global feed” for the date range.
- `limit` (int 1..200, default 200)
- `offset` (int >= 0, default 0) — only meaningful when `fetch_all=false`
- `fetch_all` (boolean, default false)

Behavior:
- Calls EODHD upstream via `src/services/eodhdNewsProvider.ts`.
- Maps upstream records into a normalized shape (`publishedAt`, `source`, `sourceType`, `title`, `body`, `url`, `providerTickers`, `tags`).
- Inserts into SQLite with DB-level dedupe (`UNIQUE(source,url)` + `INSERT OR IGNORE`).
- For each newly inserted item:
  - publishes to SSE stream via `StreamHub.publishNews(inserted)`.

Response:
```json
{
  "symbol": "",
  "from": "2026-02-15",
  "to": "2026-02-19",
  "offset": 0,
  "nextOffset": 200,
  "done": false,
  "fetched": 200,
  "inserted": 180,
  "truncated": false
}
```

Notes:
- When `fetch_all=true`, the backend loops pages internally (`pullEodhdNewsAll`) and does not return `offset/nextOffset/done`.
- When `fetch_all=false`, `done` is inferred as `providerItems.length < limit`.

### Realtime (SSE)

#### GET /api/news/stream
Server-sent events endpoint.
- Each connected client registers filters (same query params as `GET /api/news`).
- When a new item is inserted (e.g., by EODHD pull or other ingestion paths), `StreamHub` checks `matchesNewsFilters(item, client.filters)` and only emits matching items.
- Heartbeat is emitted every 20 seconds.

Event payload format:
```json
{ "type": "news_item", "payload": { /* NewsItem */ } }
```

### Error handling
The server has a single error handler that returns:
```json
{ "error": "<message>" }
```
with HTTP 400.

### File map (news-related)
- `src/server.ts` — routes, query parsing, SSE wiring, EODHD pull endpoint
- `src/services/newsRepository.ts` — SQLite query builder, cursor encoding, limit policy, inserts
- `src/services/eodhdNewsProvider.ts` — EODHD HTTP fetch + mapping + token resolution
- `src/realtime/streamHub.ts` — SSE client registry, filter-aware publish, heartbeats
- `src/types.ts` — `NewsItem`, `NewsQuery`
- `src/db.ts` — schema and migrations

### Change requests (how to ask for edits)
When requesting changes to backend news ingestion/query behavior, specify:
- Endpoint(s) and exact request/response changes.
- Whether this is a breaking change for existing frontends.
- Expected dedupe semantics (`(source,url)` today).
- Range performance expectations (limits/caps) and the reason.
- Whether SSE should emit new items for the change.

If the request is about EODHD import, specify:
- symbol mode: symbol-specific vs global feed (`symbol: ""`)
- desired chunk size and expected total volume
- whether to rely on `offset` (progressive pulling) or `fetch_all` (server loops)

---

### News API (import from Finnhub)

#### POST /api/news/pull-finhub
Purpose:
- Pull **company news** and **press releases** from Finnhub per ticker, dedupe into SQLite, and (optionally) merge Change% from the OHLC DB.

Request body (Zod in `src/server.ts`):
```json
{
  "csvPath": "tradigview_screener/original_data/watch lists2_2026-02-22.csv",
  "maxTickers": 0,
  "mode": "recent",
  "sourceType": "all",
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD"
}
```

Notes:
- `csvPath` is optional (defaults to the watchlist CSV above).
- `maxTickers` is optional. `0` or omission means **use all tickers in the CSV**. A positive value limits the ticker count.
- `mode` is optional: `recent | entire`.
  - `recent` = incremental pull. If data exists, resume from the last stored date for that `sourceType`; otherwise use the last 7 days.
  - `entire` = adaptive backfill from 5 years ago by default (unless explicit `from` is provided).
- `sourceType` is optional: `all | company_news | press_release | market_news`.
- `market_news` uses Finnhub `/news?category=general` and is not ticker-scoped.
- If reading the CSV fails, the server uses a small hard-coded ticker list fallback (AAPL/MSFT/TSLA/NVDA/AMD).
- Entire mode uses adaptive date-range splitting to bypass Finnhub's per-request cap (~200 items).
- Dedupe is DB-level: `UNIQUE(source,url)` + `INSERT OR IGNORE`.
- The server logs the resolved scope at startup of a pull: `maxTickers=... → tickerList.length=...`.
- Inserted items are published to SSE (`GET /api/news/stream`).
- `market_news` pages older headlines through Finnhub `minId`, so reachable history is limited by the upstream `/news` endpoint rather than ticker date parameters.

Response:
```json
{
  "source": "FINNHUB",
  "mode": "recent",
  "sourceType": "all",
  "tickerCount": 3,
  "inserted": 42,
  "skipped": 0,
  "changeMerged": 0,
  "details": {
    "company_news": { "fetched": 41, "inserted": 41 },
    "press_release": { "fetched": 1, "inserted": 1 },
    "market_news": { "fetched": 100, "inserted": 100 }
  }
}
```

Filtering after ingest:
- Use `GET /api/news?source_names=FINNHUB`.
- Use `GET /api/news?source_names=FINNHUB&source_type=press_release` (or `sources=press_release`).

---

### Ticker CSV API

#### GET /api/tickers
Reads tickers from a CSV file under the allowlisted root:
- Allowed root: `tradigview_screener/original_data/`

Query params:
- `csvPath` (required) — repo-relative path under the allowlist.

Response:
```json
{ "csvPath": "...", "tickers": ["AAPL", "MSFT"] }
```

#### POST /api/tickers/add
Appends a new ticker into the CSV (atomic write + Windows lock retries).

Request:
```json
{ "csvPath": "...", "ticker": "TSLA" }
```

Response:
```json
{ "csvPath": "...", "tickerAdded": "TSLA", "tickers": ["..."] }
```

This endpoint also updates `update_status` under key `tickers_csv`.

---

### Update status API

#### GET /api/updates/status
Returns the last successful timestamp + details per source.

Response shape:
```json
{
  "sources": {
    "tickers_csv": null,
    "finhub_news": null,
    "ibkr_calendar": null,
    "ibkr_ohlc_1d": null
  }
}
```

The backend updates:
- `tickers_csv` on `POST /api/tickers/add`
- `finhub_news` on `POST /api/news/pull-finhub`

---

## KO

### 목적
이 문서는 `terminal/backend/` 아래의 Node/Express/TypeScript 백엔드에 대한 “작업용 프롬프트/스펙”입니다.

이 레포의 현재 단계에서 뉴스 관련 핵심 목표는 아래와 같습니다.
- 뉴스 아이템을 SQLite에 저장
- `GET /api/news`에서 필터 + 커서 페이지네이션으로 조회
- `POST /api/news/pull-eodhd`로 EODHD 히스토리 뉴스를 SQLite로 적재
- 새로 insert된 아이템을 SSE(`GET /api/news/stream`)로 스트리밍

제약/원칙:
- mock 뉴스 생성 기능을 추가하지 않기
- 시크릿(특히 EODHD 토큰)을 로그로 남기지 않기
- 명시 요청 없이는 API 응답을 깨는 변경을 하지 않기
- “똑똑함”보다 정확성과 디버깅 용이성을 우선

### 실행 방법 (dev)
`terminal/backend/`에서:

1) 의존성 설치
```bash
npm install
```

2) watch 모드 실행
```bash
npm run dev
```

기본 설정값:
- Port: `8080` (환경변수 `PORT`)
- SQLite 경로: `./backend/data/app.db` (환경변수 `SQLITE_PATH`)
- CORS origin: `http://localhost:5173` (환경변수 `FRONTEND_ORIGIN`)

환경변수 로딩:
- `src/config.ts`는 `dotenv.config({ path: "../.env" })` 후 `dotenv.config()`를 수행합니다.
  - 즉, `terminal/.env`(백엔드 폴더의 상위 폴더) 파일이 먼저 로딩됩니다.

### EODHD 토큰 파일 위치
EODHD 토큰은 레포 루트의 아래 파일에서 읽습니다.

- `EODHD/API TOKEN`

`src/services/eodhdNewsProvider.ts`가 자신의 위치에서 상위로 올라가며 `EODHD/API TOKEN`이 있는 폴더를 repo root로 판단합니다.

자주 나는 오류:
- 파일 없음 → 400 `{error: "EODHD token file not found at ..."}`
- 파일은 있으나 빈 값 → 400 `{error: "EODHD token file is empty"}`

### Finnhub API 키 위치
Finnhub API 키는 **백엔드 기동에 필수**입니다.

조회 순서(`terminal/backend/src/config.ts` 참고):
1. 환경변수 `FINNHUB_API_KEY`
2. 레포 루트 파일 fallback: `finhub/finhub_api_key/finhub_api_key`

자주 나는 오류:
- 키가 없으면 백엔드가 시작 시점에 에러를 던지며 종료합니다:
  - `FINNHUB_API_KEY not found. Set env var FINNHUB_API_KEY or place key in finhub/finhub_api_key/finhub_api_key`

보안 노트:
- API 키는 로그로 남기지 말고 커밋하지 마세요.

### 데이터 모델 (SQLite)
스키마는 `src/db.ts`에 있습니다.

뉴스 핵심 테이블:
- `news_items`
  - 기본 컬럼: `id`, `published_at`, `source`, `source_type`, `title`, `body`, `url`, `tickers_csv`, `tags_csv`, `created_at`
  - Change% 컬럼(옵션, 적재 후 계산/병합):
    - `ohlc_ticker`, `ohlc_date`, `change_1d_pct`, `change_from_open_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`, `change_computed_at`
  - 유니크: `UNIQUE (source, url)`
  - 인덱스: `idx_news_items_published` on `(published_at DESC, id DESC)`

업데이트 추적 테이블:
- `update_status`
  - 적재/업데이트 액션의 마지막 성공 시각과 details를 기록합니다.
  - 알려진 키(`GET /api/updates/status`에서 항상 반환): `tickers_csv`, `finhub_news`, `ibkr_calendar`, `ibkr_ohlc_1d`

중복 제거(dedupe) 방식:
- insert는 `INSERT OR IGNORE`로 수행
- 중복의 정의는 `(source, url)` 동일

### 뉴스 API (조회)

#### GET /api/news
커서 페이지네이션과 필터는 `src/services/newsRepository.ts`에서 구현됩니다.

지원 쿼리 파라미터(`src/types.ts`의 `NewsQuery` 참고):
- `keyword`: `LOWER(title || ' ' || body)`에 대한 substring 검색
- `tickers`: CSV 문자열, 예: `tickers=TSLA,NVDA`
  - DB에는 `,TSLA,NVDA,` 같은 envelope 형태로 저장되고, `tickers_csv LIKE '%,TSLA,%'`로 필터링
- `sources`: `source_type IN (...)`
  - 별칭(alias): `source_type`도 동일한 의미로 지원합니다.
- `source_names`: `source IN (...)`
- `tags`: `tags_csv LIKE '%,earnings,%'` 방식
- `from`: published_at >= from
- `to`: published_at <= to
- `limit`: 요청 페이지 크기
- `cursor`: 이전 페이지 마지막 아이템의 `published_at|id`를 base64 인코딩한 값

커서 동작:
- 정렬은 `published_at DESC, id DESC`
- cursor가 있을 때 아래 조건을 추가합니다.
  - `(published_at < cursor.publishedAt OR (published_at = cursor.publishedAt AND id < cursor.id))`

서버 측 limit 정책(중요):
- `limit`이 없거나 비정상 → 기본 요청값 200
- 날짜 범위 폭에 따라 최대치를 추가로 캡합니다.
  - range <= 7일 → 최대 200
  - range <= 31일 → 최대 100
  - range > 31일 → 최대 50
- 최종 하드 클램프는 항상 1..200

응답 형태:
```json
{ "items": [/* NewsItem[] */], "nextCursor": "..." }
```

`nextCursor`는 다음 페이지가 있을 때만 내려갑니다.

#### GET /api/news/:id
ID로 단건 조회합니다.

### 뉴스 API (EODHD 적재)

#### POST /api/news/pull-eodhd
라우트는 `src/server.ts`에 있고, Zod로 입력을 검증합니다.

두 모드 중 하나만 허용(정확히 하나):
- `{ "date": "YYYY-MM-DD" }`
- `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }`

추가 필드:
- `symbol` (기본값 `"QQQ.US"`)
  - 빈 문자열이면 upstream 요청에서 `s=`를 생략해서 날짜 범위에 대한 “global feed”를 받습니다.
- `limit` (1..200, 기본 200)
- `offset` (0 이상, 기본 0) — `fetch_all=false`에서만 의미 있음
- `fetch_all` (기본 false)

동작:
- `src/services/eodhdNewsProvider.ts`로 EODHD HTTP 요청
- upstream 레코드를 내부 표준 형태로 매핑(`publishedAt`, `source`, `sourceType`, `title`, `body`, `url`, `providerTickers`, `tags`)
- SQLite에 insert(`UNIQUE(source,url)` + `INSERT OR IGNORE`)로 DB 레벨 dedupe
- 새로 insert된 아이템은 SSE로 publish

응답 예시:
```json
{
  "symbol": "",
  "from": "2026-02-15",
  "to": "2026-02-19",
  "offset": 0,
  "nextOffset": 200,
  "done": false,
  "fetched": 200,
  "inserted": 180,
  "truncated": false
}
```

참고:
- `fetch_all=true`이면 서버가 내부에서 페이지를 돌며 전부 가져오고(`pullEodhdNewsAll`), `offset/nextOffset/done`은 반환하지 않습니다.
- `fetch_all=false`이면 `done = (providerItems.length < limit)`로 판단합니다.

### 실시간(SSE)

#### GET /api/news/stream
서버 센트 이벤트 엔드포인트입니다.
- 연결 시 클라이언트별 필터를 등록(쿼리 파라미터는 `GET /api/news`와 동일)
- 새 뉴스가 insert될 때 `matchesNewsFilters(item, client.filters)`를 통과한 클라이언트에게만 푸시
- 20초마다 heartbeat 전송

이벤트 payload 형식:
```json
{ "type": "news_item", "payload": { /* NewsItem */ } }
```

### 에러 처리
단일 에러 핸들러가 400으로 아래 형태를 반환합니다.
```json
{ "error": "<message>" }
```

### 파일 맵(뉴스 관련)
- `src/server.ts` — 라우팅, 쿼리 파싱, SSE, EODHD pull 엔드포인트
- `src/services/newsRepository.ts` — SQLite 조회/커서/limit 정책/insert
- `src/services/eodhdNewsProvider.ts` — EODHD fetch + 매핑 + 토큰 찾기
- `src/realtime/streamHub.ts` — SSE 클라이언트 관리, 필터 적용 publish, heartbeat
- `src/types.ts` — `NewsItem`, `NewsQuery`
- `src/db.ts` — 스키마/마이그레이션

### 변경 요청 가이드(어떻게 요청하면 좋은지)
백엔드 뉴스/적재 로직 변경을 요청할 때는 아래를 함께 적어주세요.
- 어떤 엔드포인트를 어떻게 바꿀지(요청/응답까지)
- 기존 프런트와의 호환성이 깨지는 변경인지
- dedupe 기준(현재 `(source,url)`)을 바꿀지
- 범위가 넓은 조회에서의 성능 기대치(limit/cap)와 그 이유
- SSE가 새 아이템을 내보내야 하는지

EODHD 적재 요청이면 아래도 명시해 주세요.
- symbol 모드: 특정 심볼 vs global feed(`symbol: ""`)
- chunk size/총량 기대
- `offset` 기반 progressive pull을 쓸지, `fetch_all`로 서버가 내부 루프를 돌지

---

### 뉴스 API (Finnhub 적재)

#### POST /api/news/pull-finhub
목적:
- 티커별로 Finnhub에서 **company news**와 **press releases**를 수집하고, SQLite에 dedupe insert한 뒤, (가능하면) OHLC DB를 이용해 Change%를 병합합니다.

요청 바디(`src/server.ts`의 Zod):
```json
{
  "csvPath": "tradigview_screener/original_data/watch lists2_2026-02-22.csv",
  "maxTickers": 0,
  "mode": "recent",
  "sourceType": "all",
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD"
}
```

참고:
- `csvPath`는 옵션이며 위 CSV가 기본값입니다.
- `maxTickers`는 옵션입니다. `0` 또는 미전송이면 **CSV 전체 티커**를 사용합니다. 양수를 보내면 그 개수만큼 제한합니다.
- `mode`는 옵션: `recent | entire`.
  - `recent` = 증분 수집. 해당 `sourceType` 데이터가 이미 있으면 마지막 저장 날짜부터 재개하고, 없으면 최근 7일을 사용합니다.
  - `entire` = 기본적으로 5년 전부터 adaptive backfill을 수행합니다(`from` 명시 시 그 값을 우선).
- `sourceType`는 옵션: `all | company_news | press_release | market_news`.
- `market_news`는 Finnhub `/news?category=general`을 사용하며 ticker 범위와 무관한 일반 시장 헤드라인입니다.
- CSV 읽기에 실패하면 서버는 작은 하드코딩 티커 목록(AAPL/MSFT/TSLA/NVDA/AMD)을 fallback으로 사용합니다.
- entire 모드는 Finnhub의 요청당 cap(~200건)를 우회하기 위해 adaptive date-range splitting을 사용합니다.
- dedupe는 DB 레벨: `UNIQUE(source,url)` + `INSERT OR IGNORE`.
- pull 시작 시 서버 로그에 실제 범위가 출력됩니다: `maxTickers=... → tickerList.length=...`.
- 새로 insert된 아이템은 SSE(`GET /api/news/stream`)로 publish됩니다.
- `market_news`는 Finnhub `minId` 페이지네이션으로 더 오래된 헤드라인을 따라가므로, 실제 도달 가능한 히스토리는 upstream `/news` 엔드포인트 보유 범위에 제한됩니다.

응답:
```json
{
  "source": "FINNHUB",
  "mode": "recent",
  "sourceType": "all",
  "tickerCount": 3,
  "inserted": 42,
  "skipped": 0,
  "changeMerged": 0,
  "details": {
    "company_news": { "fetched": 41, "inserted": 41 },
    "press_release": { "fetched": 1, "inserted": 1 },
    "market_news": { "fetched": 100, "inserted": 100 }
  }
}
```

적재 후 조회/필터:
- `GET /api/news?source_names=FINNHUB`
- `GET /api/news?source_names=FINNHUB&source_type=press_release` (또는 `sources=press_release`)

---

### Ticker CSV API

#### GET /api/tickers
allowlist 루트 아래의 CSV에서 티커를 읽습니다:
- 허용 루트: `tradigview_screener/original_data/`

쿼리:
- `csvPath` (필수) — allowlist 아래의 repo-relative 경로

응답:
```json
{ "csvPath": "...", "tickers": ["AAPL", "MSFT"] }
```

#### POST /api/tickers/add
CSV에 티커 1개를 추가합니다(원자적 write + Windows 락 재시도).

요청:
```json
{ "csvPath": "...", "ticker": "TSLA" }
```

응답:
```json
{ "csvPath": "...", "tickerAdded": "TSLA", "tickers": ["..."] }
```

이 엔드포인트는 `update_status`의 `tickers_csv` 키를 업데이트합니다.

---

### 업데이트 상태 API

#### GET /api/updates/status
소스별 마지막 성공 시각과 details를 반환합니다.

응답 형태:
```json
{
  "sources": {
    "tickers_csv": null,
    "finhub_news": null,
    "ibkr_calendar": null,
    "ibkr_ohlc_1d": null
  }
}
```

백엔드에서 업데이트하는 키:
- `tickers_csv` — `POST /api/tickers/add`
- `finhub_news` — `POST /api/news/pull-finhub`
