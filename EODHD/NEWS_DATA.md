## EN

### Purpose
This document explains how **EODHD News** data is fetched and displayed in this repo, what gets stored locally, what request cadence is used, and what fields/types of news data are supported.

### Where the data comes from
- Upstream provider: EODHD News API endpoint `GET https://eodhd.com/api/news`
- Auth: API token is read from the local file:
  - `C:\github_coding\terminal_sec\EODHD\API TOKEN`
  - The token value is treated as a secret and must not be logged.

### Local storage vs “call every time”
There are **two steps** in the current architecture:
1) **Import step (pull from EODHD → insert into SQLite)**
   - Triggered by the backend endpoint `POST /api/news/pull-eodhd`.
   - The backend fetches from EODHD and then inserts into SQLite.
   - Inserts are deduplicated at the DB level using a uniqueness constraint: `UNIQUE(source, url)`.
2) **Read step (UI reads from SQLite via backend)**
   - UI calls `GET /api/news?...` and receives items already stored in SQLite.

In other words:
- EODHD is **not queried directly** by the UI for every row you see.
- EODHD is queried during **Import**, then the UI displays data from **local SQLite**.

### Where is “local” (SQLite) stored?
The backend stores news in a local SQLite file.

- Config key: `SQLITE_PATH`
- Default: `./backend/data/app.db`
- When running the backend from `C:\github_coding\terminal_sec\terminal\backend` (the typical dev workflow), that resolves to:
  - `C:\github_coding\terminal_sec\terminal\backend\backend\data\app.db`

Notes:
- The file is created automatically on first run.
- You can change the location by setting the environment variable `SQLITE_PATH`.

**Current UI behavior:**
- The Figma-based News window currently triggers a demo backfill when the window/component mounts (i.e., when the News window opens/reloads). It calls `POST /api/news/pull-eodhd` for the configured date range, then queries `GET /api/news`.
- The demo is currently configured to pull the **global feed** (symbol omitted/blank), so it’s not limited to a single ticker.
- Because the DB dedupe is `INSERT OR IGNORE` on `(source, url)`, repeated pulls typically insert `0` new rows if the items already exist.

Practical consequence:
- “Open the News window” may still trigger **one EODHD import request**, but the displayed list is primarily a **DB query**.
- In a production setup, you usually remove the “import-on-open” behavior and instead run imports on a schedule.

### Request cadence (“every few minutes?”)
EODHD news ingestion is **not automatic**. It only happens when you call:
- `POST /api/news/pull-eodhd`
- In the current UI, this is called once on News window load (demo/backfill).

Note:
- The backend previously had a mock-news demo ingestion loop. That mock news feature has been removed, so the news feed is no longer populated with synthetic items.

If you want “poll EODHD every N minutes”, it should be implemented as a scheduled worker job (server-side) rather than tying it to the UI opening.

### Limits and pagination (important)
There are multiple “limits” to be aware of:

1) **Backend query API limit (SQLite → UI)**
- `GET /api/news` enforces `limit` in the range **1..200** per request.
- To read more than 200 rows, the client must paginate using `nextCursor` → `cursor`.

2) **Backend import paging limit (EODHD → SQLite)**
- `POST /api/news/pull-eodhd` uses `limit` as the upstream page size (max 200).
- With `fetch_all=true`, the backend pages using an upstream `offset` parameter.
- There is also a safety cap `maxPages` (default currently 100) to avoid runaway imports.
  - If the backend stops due to the cap or detects repeated pages, it returns `truncated: true`.

3) **Upstream EODHD limits**
- The EODHD service itself may have plan/rate limits and may not guarantee “infinite” results for large windows.
- When you see `truncated: true`, it means “the backend likely did not fetch everything available”.

### Typical production pattern (latest vs historical)
What you described (“latest from provider, past from local”) is a common approach:

- **Latest/news updates**
  - Run a scheduled job (server-side) every N minutes.
  - Pull only a small window (e.g., last 1–24 hours) and insert into SQLite with dedupe.
  - UI only queries `GET /api/news` (no provider calls from the browser).

- **Historical backfill**
  - Run an explicit backfill (manual button/CLI/API call) for older date ranges.
  - After backfill, all queries (including historical) still come from the same SQLite DB.

- **When data gets large**
  - Options include: database rotation, archiving old items to Parquet/CSV, or moving to a heavier DB.
  - This repo currently keeps everything in SQLite unless you delete the DB file.

### Can the URL be shown in the Source column?
Yes.
- The backend stores the original `url` for each news item.
- The UI can display the URL in the “Source” column (and make it clickable).

### Can clicking show the article body?
Yes.
- The backend stores `body` (the text content received from the provider).
- The UI can show the stored body by expanding the row (e.g., clicking the title).

### Backend endpoints (internal API)
#### 1) Import (pull from EODHD)
`POST /api/news/pull-eodhd`

**Body (exactly one mode):**
- Mode A (single day)
  - Global feed: `{ "date": "YYYY-MM-DD", "symbol": "", "limit": 200, "fetch_all": true }`
  - Single symbol: `{ "date": "YYYY-MM-DD", "symbol": "QQQ.US", "limit": 200, "fetch_all": true }`
- Mode B (range)
  - Global feed: `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "symbol": "", "limit": 200, "fetch_all": true }`
  - Single symbol: `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "symbol": "QQQ.US", "limit": 200, "fetch_all": true }`

**Fields**
- `symbol` (optional): defaults to `QQQ.US`
  - Set to an empty string (`""`) to omit the upstream `s=...` parameter and pull the **global feed** (if supported upstream).
- `limit` (optional): 1..200, default 200
  - Used as page size when `fetch_all=true`.
- `fetch_all` (optional): default false
  - If true, the backend paginates EODHD calls in batches of `limit` up to an internal `maxPages` safeguard (default is currently 100 pages).

**Response**
- `{ symbol, from, to, fetched, inserted, truncated }`
  - `fetched`: number of items returned by the provider mapping
  - `inserted`: number of new rows inserted (dedupe may reduce this)
  - `truncated`: true if paging detected a likely truncation (safety bail-out)

#### 2) Query stored news
`GET /api/news`

**Query params (selected):**
- `from`: ISO datetime string (e.g. `2026-02-15T00:00:00.000Z`)
- `to`: ISO datetime string
- `limit`: 1..200 (default 50)
- `cursor`: pagination cursor from a prior response
- `keyword`: substring match against `title + body`
- `tickers`: comma-separated tickers, e.g. `tickers=QQQ,SPY`
- `sources`: filters by `source_type` (provider type)
- `source_names`: filters by `source` (provider/source name), e.g. `source_names=EODHD`
- `tags`: comma-separated tags

**Response**
- `{ items: NewsItem[], nextCursor?: string }`

#### 3) Real-time stream (SSE)
`GET /api/news/stream`
- SSE is available in the backend, but the current Figma UI does not consume it.

### What fields are stored locally (SQLite schema)
Table: `news_items`
- `[][][]id[][][]`: UUID
- `[][][]published_at[][][]`: ISO datetime string
- `[][][]source[][][]`: provider/source name (e.g., `EODHD`)
- `[][][]source_type[][][]`: provider category/type (e.g., `news`)
- `[][][]title[][][]`: title string
- `[][][]body[][][]`: full text body/content
- `[][][]url[][][]`: original URL (used for dedupe)
- `[][][]tickers_csv[][][]`: tickers stored as an envelope CSV like `,QQQ,SPY,`
- `[][][]tags_csv[][][]`: tags stored as an envelope CSV like `,earnings,macro,`
- `[][][]created_at[][][]`: insertion timestamp (SQLite `datetime('now')`)

Uniqueness:
- `UNIQUE(source, url)` ensures re-imports don’t create duplicates.

### What fields we fetch from EODHD (observed + mapping)
EODHD’s `/api/news` returns an array of news objects. In practice, the mapping logic attempts these fields:
- Datetime:
  - uses first parseable value among: `date`, `published_at`, `publishedAt`, `datetime`
  - stored as ISO string (`toISOString()`)
- Text:
  - `title`
  - `content` or `text` or `body` → stored as `body`
- Link:
  - `link` or `url` → stored as `url`
- Source/type:
  - `source` → stored as `source` (defaults to `EODHD` if missing)
  - `source_type` or `type` → stored as `source_type` (defaults to `news` if missing)
- Tickers:
  - `symbols` or `tickers` (array of strings) → normalized to upper-case tickers, stripping suffixes like `.US`
- Tags:
  - `tags` (array of strings) → stored lower-cased

### “News data types” supported
Within this repo’s normalized model, every item is a `NewsItem` with:
- `source`: who it came from (string)
- `source_type`: the category/type (string, commonly `news`)

So “types” are represented by `[][][]source_type[][][]` and “providers” by `[][][]source[][][]`.
The EODHD API may return different `source_type` values depending on the upstream source; we store whatever string is provided (or default to `news`).

### Known limitations / notes
- **Paging:** The import supports paging via an `offset` query parameter when talking to EODHD. If upstream paging behaves unexpectedly (e.g., returns the same page repeatedly), the importer bails out and marks the run as `truncated`. Also, `fetch_all` has a `maxPages` safety cap to prevent runaway imports.
- **Timezone:** `published_at` is stored as an ISO string from `Date(...).toISOString()`. This is UTC. If you need a specific local timezone display policy, handle it in the UI.
- **Cadence:** EODHD pulls are currently manual/on-load. For production-style behavior, implement a scheduled pull worker.

---

## KO

### 목적
이 문서는 이 레포에서 **EODHD News** 데이터를 어떤 방식으로 받아서(수집) 화면에 표시하는지, 로컬에 무엇을 저장하는지, 요청 주기(몇 분마다 요청인지), 그리고 어떤 필드/유형의 뉴스 데이터를 지원하는지를 정리합니다.

### 데이터 출처
- 업스트림 제공자: EODHD News API `GET https://eodhd.com/api/news`
- 인증: API 토큰은 아래 로컬 파일에서 읽습니다.
  - `C:\github_coding\terminal_sec\EODHD\API TOKEN`
  - 토큰 값은 시크릿이므로 로그에 찍거나 공유하면 안 됩니다.

### “창 열 때마다 호출” vs “로컬 저장 후 불러오기”
현재 구조는 **2단계**입니다.
1) **Import 단계(EODHD에서 pull → SQLite에 insert)**
   - 백엔드 엔드포인트 `POST /api/news/pull-eodhd`로 트리거됩니다.
   - 백엔드가 EODHD에서 데이터를 받아온 후 SQLite DB에 저장합니다.
   - DB에서 `UNIQUE(source, url)` 제약으로 중복을 막고, `INSERT OR IGNORE`로 dedupe 합니다.
2) **Read 단계(UI가 SQLite에 저장된 데이터를 백엔드 통해 조회)**
   - UI는 `GET /api/news?...`로 조회하며, 이미 SQLite에 저장된 아이템을 받습니다.

즉,
- UI가 화면에 보여주는 뉴스 “각 row”를 매번 EODHD에서 직접 가져오는 구조가 아니라,
- 먼저 **Import 단계에서 EODHD → SQLite로 적재**하고,
- 화면은 **로컬 SQLite를 조회해서 표시**하는 구조입니다.

### “로컬 저장”은 로컬 어디에 저장되나?
백엔드는 뉴스 데이터를 로컬 SQLite 파일에 저장합니다.

- 설정 키: `SQLITE_PATH`
- 기본값: `./backend/data/app.db`
- 백엔드를 `C:\github_coding\terminal_sec\terminal\backend`에서 실행하는 일반적인 개발 흐름에서는, 실제 경로가 아래처럼 해석됩니다.
  - `C:\github_coding\terminal_sec\terminal\backend\backend\data\app.db`

참고:
- 파일은 백엔드 첫 실행 시 자동으로 생성됩니다.
- 저장 위치를 바꾸려면 환경변수 `SQLITE_PATH`를 지정하면 됩니다.

**현재 UI 동작:**
- Figma 기반 News 창은 지금 “데모/백필(backfill)” 형태로, News 창(컴포넌트)이 열릴 때(마운트 시) `POST /api/news/pull-eodhd`를 한 번 호출한 다음 `GET /api/news`로 조회합니다.
- 현재 데모 설정은 **심볼 제한 없이(global feed)** 가져오도록( `symbol: ""` ) 되어 있어 단일 티커 뉴스에만 묶이지 않습니다.
- 다만 `(source, url)` 기준 dedupe 때문에, 같은 기간을 다시 pull 해도 이미 DB에 있으면 보통 `inserted=0`이 됩니다.

현실적인 의미:
- News 창을 열 때 **EODHD import 요청 1회**가 발생할 수는 있지만,
- 화면에 보이는 뉴스 리스트는 대부분 **SQLite 조회 결과**입니다.
- 운영(프로덕션) 형태라면 “창 열 때 import”는 보통 제거하고, 서버 스케줄로 주기 수집을 돌립니다.

### 뉴스 데이터 요청 주기(“몇 분마다?”)
EODHD 뉴스 ingestion은 **자동이 아닙니다.** 아래를 호출할 때만 실행됩니다.
- `POST /api/news/pull-eodhd`
- 현재 UI에서는 News 창 로드시 1회 호출(데모/백필)

참고:
- 이전에는 데모용 mock 뉴스 자동 수집 루프가 있었지만, 현재는 mock 뉴스 기능을 제거하여 더 이상 가짜 데이터가 주입되지 않습니다.

“EODHD를 N분마다 자동 갱신” 같은 동작이 필요하면, UI 오픈에 묶기보다는 서버 측 스케줄 워커로 구현하는 것이 맞습니다.

### 한 번 조회/가져오기 한계(중요)
여기에는 여러 종류의 “한계(limit)”가 있습니다.

1) **조회 API 한계(SQLite → UI)**
- `GET /api/news`는 요청 1회당 `limit`이 **1..200**으로 제한됩니다.
- 200건을 넘게 보려면 응답의 `nextCursor`를 다음 요청의 `cursor`로 넘겨서 페이징해야 합니다.

2) **Import(적재) 페이징 한계(EODHD → SQLite)**
- `POST /api/news/pull-eodhd`에서 `limit`은 업스트림 요청의 페이지 사이즈 역할을 합니다(최대 200).
- `fetch_all=true`면 백엔드가 업스트림 `offset` 파라미터로 여러 페이지를 연속으로 가져옵니다.
- runaway 방지용 안전장치로 `maxPages` 상한(현재 기본 100)이 있고,
  - 상한에 걸리거나, 같은 페이지가 반복되는 등 페이징 이상 징후가 있으면 `truncated: true`를 반환할 수 있습니다.

3) **EODHD 업스트림 한계**
- EODHD 자체에도 요금제/레이트리밋/결과 제한 등이 있을 수 있고, 큰 범위에서 “무조건 무한정” 내려준다고 보장하기 어렵습니다.
- `truncated: true`는 “가능한 전체를 다 못 가져왔을 수도 있다”는 신호입니다.

### 보통의 운영 패턴(최신 vs 과거)
질문하신 “최신은 provider에서 조회, 과거는 로컬에서 불러오기”는 흔한 방식입니다.

- **최신 데이터(업데이트)**
  - 서버 측 스케줄 잡을 N분마다 실행
  - 최근 짧은 구간(예: 최근 1~24시간)만 pull 해서 SQLite에 dedupe insert
  - 브라우저(UI)는 provider를 직접 치지 않고 `GET /api/news`만 호출

- **과거 데이터(백필)**
  - 수동(버튼/CLI/API)로 특정 과거 기간을 backfill
  - backfill 이후에는 최신/과거 모두 같은 SQLite DB에서 조회

- **데이터가 너무 커질 때**
  - DB 로테이션, 오래된 데이터를 Parquet/CSV로 아카이브, 더 큰 DB로 이전 같은 선택지가 있습니다.
  - 이 레포는 현재 DB 파일을 지우지 않는 한 SQLite에 계속 누적되는 형태입니다.

### 링크 URL을 Source 컬럼에 표시할 수 있나?
가능합니다.
- 백엔드는 각 뉴스의 원본 `url`을 DB에 저장합니다.
- UI에서 Source 컬럼에 URL을 그대로 표시하고(필요하면 줄바꿈/축약), 클릭 시 원문 링크를 열 수 있습니다.

### 클릭하면 본문을 볼 수 있나?
가능합니다.
- 백엔드는 provider에서 받은 `body`(content)를 저장합니다.
- UI에서 row 확장(예: 제목 클릭)으로 저장된 본문을 펼쳐 보여줄 수 있습니다.

### 백엔드 엔드포인트(내부 API)
#### 1) Import(EODHD에서 pull)
`POST /api/news/pull-eodhd`

**Body(두 모드 중 하나만 선택):**
- 모드 A(단일 날짜)
  - 전체(global): `{ "date": "YYYY-MM-DD", "symbol": "", "limit": 200, "fetch_all": true }`
  - 단일 심볼: `{ "date": "YYYY-MM-DD", "symbol": "QQQ.US", "limit": 200, "fetch_all": true }`
- 모드 B(기간)
  - 전체(global): `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "symbol": "", "limit": 200, "fetch_all": true }`
  - 단일 심볼: `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "symbol": "QQQ.US", "limit": 200, "fetch_all": true }`

**필드**
- `symbol`(옵션): 기본값 `QQQ.US`
  - `""`(빈 문자열)로 주면 업스트림 `s=...` 파라미터를 생략하여 **global feed**를 시도합니다.
- `limit`(옵션): 1..200, 기본 200
  - `fetch_all=true`일 때 페이지 사이즈로 사용됩니다.
- `fetch_all`(옵션): 기본 false
  - true면 백엔드가 `limit` 단위로 여러 번 호출(페이징)해서 가능한 범위 내에서 “전체”를 가져옵니다. 이때 안전장치로 `maxPages` 상한(현재 기본 100)이 있습니다.

**응답**
- `{ symbol, from, to, fetched, inserted, truncated }`
  - `fetched`: provider 매핑까지 완료된 아이템 수
  - `inserted`: DB에 새로 들어간 row 수(중복이면 0)
  - `truncated`: 페이징 이상/안전장치로 “전부 못 가져왔을 가능성”이 있으면 true

#### 2) 저장된 뉴스 조회
`GET /api/news`

**Query params(주요):**
- `from`: ISO datetime 문자열(예: `2026-02-15T00:00:00.000Z`)
- `to`: ISO datetime 문자열
- `limit`: 1..200 (기본 50)
- `cursor`: 이전 응답의 `nextCursor`로 페이징
- `keyword`: `title + body`에서 부분 문자열 검색
- `tickers`: 쉼표 구분(예: `tickers=QQQ,SPY`)
- `sources`: `source_type` 필터
- `source_names`: `source`(provider/source name) 필터(예: `source_names=EODHD`)
- `tags`: 쉼표 구분 태그 필터

**응답**
- `{ items: NewsItem[], nextCursor?: string }`

#### 3) 실시간 스트림(SSE)
`GET /api/news/stream`
- 백엔드는 SSE를 제공하지만, 현재 Figma UI는 SSE를 쓰지 않습니다.

### 로컬에 저장되는 필드(SQLite 스키마)
테이블: `news_items`
- `[][][]id[][][]`: UUID
- `[][][]published_at[][][]`: ISO datetime 문자열
- `[][][]source[][][]`: provider/source name(예: `EODHD`)
- `[][][]source_type[][][]`: provider category/type(예: `news`)
- `[][][]title[][][]`: 제목
- `[][][]body[][][]`: 본문/콘텐츠 텍스트
- `[][][]url[][][]`: 원문 URL(중복 제거 키로 사용)
- `[][][]tickers_csv[][][]`: `,QQQ,SPY,` 형태 CSV envelope
- `[][][]tags_csv[][][]`: `,earnings,macro,` 형태 CSV envelope
- `[][][]created_at[][][]`: DB 삽입 시각(SQLite `datetime('now')`)

중복 제거:
- `UNIQUE(source, url)`

### EODHD에서 실제로 받아오는 필드(관찰 + 매핑)
EODHD `/api/news`는 뉴스 오브젝트 배열을 반환합니다. 현재 매핑 로직은 대략 다음을 시도합니다.
- 날짜/시각:
  - `date`, `published_at`, `publishedAt`, `datetime` 중 파싱 가능한 값을 먼저 사용
  - ISO 문자열(`toISOString()`)로 저장
- 텍스트:
  - `title`
  - `content` 또는 `text` 또는 `body` → `body`로 저장
- 링크:
  - `link` 또는 `url` → `url`로 저장
- 출처/유형:
  - `source` → `source`로 저장(없으면 `EODHD`)
  - `source_type` 또는 `type` → `source_type`로 저장(없으면 `news`)
- 티커:
  - `symbols` 또는 `tickers`(문자열 배열) → 대문자 티커로 정규화, `.US` 같은 suffix 제거
- 태그:
  - `tags`(문자열 배열) → 소문자로 저장

### 지원하는 “뉴스 데이터 유형”
이 레포의 정규화 모델에서는 모든 아이템이 `NewsItem`이며,
- `source`는 “어디서 왔는지(제공자/소스 이름)”
- `source_type`은 “어떤 카테고리/유형인지”
를 나타냅니다.

즉 “유형”은 `[][][]source_type[][][]`, “제공자/소스”는 `[][][]source[][][]`로 표현됩니다.
EODHD가 다양한 `source_type` 값을 줄 수 있고, 우리는 그 문자열을 그대로 저장(없으면 `news`)합니다.

### 제한/주의사항
- **페이징:** EODHD 호출 시 `offset` 기반 페이징을 시도합니다. 업스트림 페이징이 예상과 다르게 동작(같은 페이지 반복 등)하면 안전하게 중단하고 `truncated=true`를 반환할 수 있습니다. 또한 `fetch_all`은 runaway 방지를 위해 `maxPages` 상한이 있습니다.
- **타임존:** `published_at`은 `Date(...).toISOString()` 결과(UTC)로 저장합니다. 표시 정책(로컬 타임존 등)은 UI에서 결정하는 게 좋습니다.
- **요청 주기:** EODHD는 현재 “수동/로딩 시 1회”입니다. 운영형 주기 수집은 서버 스케줄 워커로 구현해야 합니다.
