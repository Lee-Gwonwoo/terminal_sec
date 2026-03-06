# Figma Frontend Prompt (terminal_ui_ver2_finhub)

## EN

### Purpose
This document is the working prompt/spec for the Figma-derived frontend under:
- `termina_web/figma_code/terminal_ui_ver2_finhub/`

Primary goals (current repo iteration):
- Provide a draggable, resizable, multi-tab “terminal” UI.
- Render news from the backend SQLite feed (`GET /api/news`).
- Provide a Finnhub-backed news feed window that can pull and persist news via the backend (`POST /api/news/pull-finhub`).
- Provide a “Default Ticker” window that reads/appends tickers in a CSV via the backend (`GET /api/tickers`, `POST /api/tickers/add`).

Constraints:
- Do not add mock/synthetic data generation unless explicitly requested.
- Do not introduce new pages or flows beyond what is requested.
- Keep Tailwind usage consistent (no new theme primitives).

### Tech stack
- React 18 + TypeScript (Vite)
- Tailwind CSS
- `re-resizable` (window resizing)
- `react-window` (virtualized lists)
- `lucide-react` (icons)

### How to run (dev)
Prereqs:
- Backend running at `http://localhost:8080`.

From `termina_web/figma_code/terminal_ui_ver2_finhub/`:

1) Install deps
```bash
npm install
```

2) Start dev server
```bash
npm run dev
```

### Important runtime note (API base URL)
Some windows currently call the backend with a hard-coded base URL:
- `http://localhost:8080`

Files:
- `src/app/components/FinnhubNewsWindow.tsx`
- `src/app/components/DefaultTickerWindow.tsx`

If you add a Vite proxy later, prefer switching these to `fetch('/api/...')` to avoid hard-coded ports.

## App structure

### Tabs + windows
File: `src/app/App.tsx`

- Maintains `tabs: TabData[]` and `activeTabId`.
- New tabs are created via `AddTabModal` (checkbox selection of window types).
- Windows are placed with a simple initial layout rule:
  - 1 window: 800×600
  - 2 windows: side-by-side
  - 3+ windows: staggered

Window titles:
- `finhub-news` -> `News Feed: Finnhub API`
- `default-ticker` -> `Default Ticker`

### DraggableWindow wrapper
File: `src/app/components/DraggableWindow.tsx`

- Wraps content in a draggable + resizable container.
- Renders the appropriate window content by `window.type`:
  - `news` -> `NewsWindow`
  - `finhub-news` -> `FinnhubNewsWindow`
  - `default-ticker` -> `DefaultTickerWindow`
  - `watchlist` -> `WatchlistWindow`
  - `calendar` -> `CalendarWindow`

### Window type definitions
File: `src/app/types.ts`

- `WindowType` includes: `news | watchlist | calendar | finhub-news | default-ticker`.

## Windows

### News (EODHD-backed feed via SQLite)
File: `src/app/components/NewsWindow.tsx`

- Reads from SQLite via backend `GET /api/news`.
- Can trigger historical ingestion via backend `POST /api/news/pull-eodhd`.

This window is expected to render **only persisted data** (not direct provider responses).

### News Feed: Finnhub API
File: `src/app/components/FinnhubNewsWindow.tsx`

Responsibilities:
- Fetch persisted Finnhub items from SQLite:
  - `GET /api/news?source_names=FINNHUB&limit=200`
- Filter by source type (company news vs press release):
  - Uses `source_type=company_news|press_release`.
- Trigger backend ingestion:
  - `POST /api/news/pull-finhub` then refresh.

Change% display:
- Reads optional fields returned by `GET /api/news`:
  - `change_1d_pct`, `change_from_open_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`
- If the backend has no OHLC coverage for the news date, these fields are null and the UI shows `-`.

UX/features intentionally kept from the previous virtualized feed:
- Date grouping headers
- `react-window` virtualization
- Column drag-reorder, column resize, column sort
- Display mode: Title Only vs Title + Body excerpt
- Save/Load search settings (local UI state)

Search behavior:
- Search is **server-side**: typing in the search box sends `keyword=...` to `GET /api/news`, which runs `WHERE LOWER(title || ' ' || body) LIKE '%keyword%'` against the **entire DB**.
- A 300ms debounce prevents excessive API calls while typing.
- The backend returns up to 200 matching results; `react-window` virtualizes the render.

### Default Ticker
File: `src/app/components/DefaultTickerWindow.tsx`

Responsibilities:
- Read tickers from a CSV (repo-relative path) via backend:
  - `GET /api/tickers?csvPath=...`
- Append a ticker via backend:
  - `POST /api/tickers/add` with `{ csvPath, ticker }`

Backend security constraints (important):
- The backend only allows CSV paths under `tradigview_screener/original_data/`.
- Path traversal (`..`) is rejected.

## Backend API contracts used by this frontend

### Read news
- `GET /api/news?source_names=FINNHUB&source_type=press_release&limit=200`

### Ingest Finnhub news
- `POST /api/news/pull-finhub`
  - Body: `{ csvPath?, maxTickers?, from?, to? }`

### Read tickers from CSV
- `GET /api/tickers?csvPath=tradigview_screener/original_data/...csv`

### Append a ticker to CSV
- `POST /api/tickers/add`
  - Body: `{ csvPath, ticker }`

## Change requests (how to ask for edits)
When requesting frontend changes, specify:
- The exact window type(s) affected.
- Any backend endpoint changes required (avoid implicit contracts).
- Whether filters/sorting should be backend-driven or UI-only.
- Whether change% columns must be displayed even when null.

---

## KO

### 목적
이 문서는 아래 경로의 Figma 기반 프론트엔드에 대한 작업용 프롬프트/스펙입니다.
- `termina_web/figma_code/terminal_ui_ver2_finhub/`

현재 단계 핵심 목표:
- 드래그/리사이즈 가능한 멀티 탭 “터미널” UI 제공
- 백엔드 SQLite 피드(`GET /api/news`)를 렌더링
- Finnhub 뉴스 피드 윈도우에서 백엔드 호출로 적재 + 저장 (`POST /api/news/pull-finhub`)
- Default Ticker 윈도우에서 CSV 티커를 읽고/추가 (`GET /api/tickers`, `POST /api/tickers/add`)

제약:
- 사용자가 요청하지 않는 한 mock/가짜 데이터 생성을 추가하지 않기
- 요청되지 않은 새 페이지/플로우를 만들지 않기
- Tailwind 스타일 토큰/패턴을 기존과 일관되게 유지하기

### 기술 스택
- React 18 + TypeScript (Vite)
- Tailwind CSS
- `re-resizable` (윈도우 리사이즈)
- `react-window` (가상화 리스트)
- `lucide-react` (아이콘)

### 실행 방법 (dev)
전제:
- 백엔드가 `http://localhost:8080`에서 실행 중

`termina_web/figma_code/terminal_ui_ver2_finhub/`에서:

1) 의존성 설치
```bash
npm install
```

2) dev 서버 실행
```bash
npm run dev
```

### 런타임 중요 노트(API Base URL)
일부 윈도우는 백엔드를 하드코딩 URL로 호출합니다:
- `http://localhost:8080`

해당 파일:
- `src/app/components/FinnhubNewsWindow.tsx`
- `src/app/components/DefaultTickerWindow.tsx`

향후 Vite proxy를 추가할 경우 `fetch('/api/...')` 형태로 전환하는 것을 권장합니다.

## 앱 구조

### Tabs + windows
파일: `src/app/App.tsx`

- `tabs: TabData[]`와 `activeTabId`를 관리합니다.
- `AddTabModal`에서 체크박스로 window type을 선택해 탭을 생성합니다.
- 초기 배치는 단순 규칙으로 결정합니다:
  - 윈도우 1개: 800×600
  - 윈도우 2개: 좌우 분할
  - 3개 이상: 계단식(staggered)

윈도우 타이틀:
- `finhub-news` -> `News Feed: Finnhub API`
- `default-ticker` -> `Default Ticker`

### DraggableWindow 래퍼
파일: `src/app/components/DraggableWindow.tsx`

- 각 윈도우를 드래그/리사이즈 가능한 컨테이너로 감쌉니다.
- `window.type`에 따라 실제 컨텐츠를 렌더링합니다:
  - `news` -> `NewsWindow`
  - `finhub-news` -> `FinnhubNewsWindow`
  - `default-ticker` -> `DefaultTickerWindow`
  - `watchlist` -> `WatchlistWindow`
  - `calendar` -> `CalendarWindow`

### WindowType 정의
파일: `src/app/types.ts`

- `WindowType`: `news | watchlist | calendar | finhub-news | default-ticker`

## 윈도우

### News (EODHD 적재 + SQLite 조회)
파일: `src/app/components/NewsWindow.tsx`

- 백엔드 `GET /api/news`로 SQLite에서 조회합니다.
- 백엔드 `POST /api/news/pull-eodhd`로 히스토리 적재를 트리거할 수 있습니다.

이 윈도우는 **provider 응답을 직접 렌더링하지 않고**, 반드시 DB(SQLite)에 저장된 데이터를 렌더링하는 것을 원칙으로 합니다.

### News Feed: Finnhub API
파일: `src/app/components/FinnhubNewsWindow.tsx`

책임:
- SQLite에 저장된 Finnhub 아이템을 백엔드에서 조회:
  - `GET /api/news?source_names=FINNHUB&limit=200`
- source_type별 필터(company news / press release):
  - `source_type=company_news|press_release`
- 백엔드 적재 트리거:
  - `POST /api/news/pull-finhub` 호출 후 refresh

Change% 표시:
- `GET /api/news`가 내려주는 optional 필드 사용:
  - `change_1d_pct`, `change_from_open_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`
- 뉴스 날짜에 해당하는 OHLC 데이터가 없으면 null이고 UI는 `-`로 표시합니다.

기존 가상화 피드에서 유지한 UX/기능:
- 날짜 헤더 그룹핑
- `react-window` 가상화
- 컬럼 드래그 재정렬/리사이즈/정렬
- 표시 모드: Title Only vs Title + Body 일부 표시
- Save/Load 검색 설정(로컬 UI state)
검색 동작:
- 검색은 **서버사이드**: 검색창에 입력하면 `keyword=...`를 `GET /api/news`에 전달하고, 백엔드가 `WHERE LOWER(title || ' ' || body) LIKE '%keyword%'`로 **전체 DB**를 검색합니다.
- 300ms 디바운스를 적용하여 타이핑 중 과도한 API 호출을 방지합니다.
- 백엔드는 매칭된 결과 중 최대 200건을 반환하고, `react-window`가 렌더를 가상화합니다.
### Default Ticker
파일: `src/app/components/DefaultTickerWindow.tsx`

책임:
- CSV(repo-relative path)에서 티커 읽기:
  - `GET /api/tickers?csvPath=...`
- CSV에 티커 추가:
  - `POST /api/tickers/add` 바디 `{ csvPath, ticker }`

백엔드 보안 제약(중요):
- 백엔드는 `tradigview_screener/original_data/` 아래의 CSV만 허용합니다.
- path traversal(`..`)은 거부됩니다.

## 프론트엔드가 사용하는 백엔드 API 계약

### 뉴스 조회
- `GET /api/news?source_names=FINNHUB&source_type=press_release&limit=200`

### Finnhub 뉴스 적재
- `POST /api/news/pull-finhub`
  - 바디: `{ csvPath?, maxTickers?, from?, to? }`

### CSV 티커 조회
- `GET /api/tickers?csvPath=tradigview_screener/original_data/...csv`

### CSV 티커 추가
- `POST /api/tickers/add`
  - 바디: `{ csvPath, ticker }`

## 변경 요청 가이드(어떻게 요청하면 좋은지)
프론트엔드 변경 요청 시 아래를 함께 적어주세요.
- 어떤 window type(윈도우)이 대상인지
- 백엔드 엔드포인트 변경이 필요한지(암묵적 계약 금지)
- 필터/정렬이 백엔드 기반인지(UI-only인지)
- change% 컬럼이 null일 때도 표시해야 하는지
