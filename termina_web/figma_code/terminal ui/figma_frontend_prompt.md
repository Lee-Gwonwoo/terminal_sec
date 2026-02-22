# Figma Frontend Prompt (termina_web/figma_code/terminal ui)

## EN

### Purpose
This document is the prompt/spec for the Figma-derived frontend located at:

- `termina_web/figma_code/terminal ui/`

This UI is a draggable, multi-tab “terminal-like” workspace.

Current real-data integration status:
- **News** window reads from the backend SQLite feed via `GET /api/news` and can trigger historical imports via `POST /api/news/pull-eodhd`.
- **Watchlist** and **Calendar** windows still use local mock data (they do not call the backend).

Constraints:
- Do not add new pages/modals/filters beyond what is explicitly requested.
- Do not introduce new colors/theme tokens; keep Tailwind usage consistent with the existing UI.
- Do not reintroduce mock news generation or “fallback demo news” in the News window.

### How to run (dev)

Prereqs:
- Backend running at `http://localhost:8080`.
- EODHD token file exists at repo root `EODHD/API TOKEN` for pulling news.

From `termina_web/figma_code/terminal ui/`:

1) Install deps
```bash
npm install
```

2) Start Vite dev server
```bash
npm run dev
```

Vite proxy (see `vite.config.ts`):
- `/api/*` proxies to `http://localhost:8080`
- `/healthz` proxies to `http://localhost:8080`

So frontend code can simply `fetch('/api/...')` without hard-coding ports.

### High-level UI structure

#### Tabs + windows
File: `src/app/App.tsx`

Behavior:
- The app maintains `tabs: TabData[]`, each tab has `windows: WindowInstance[]`.
- Tabs can be added via the `AddTabModal` flow.
- Tabs can be renamed by right-clicking the tab (context menu behavior implemented as “start editing”).
- Tabs can be closed (but not the last remaining tab).

Window instances:
- Created by `handleStartTab(selectedWindows: WindowType[])`.
- Each window has `id`, `type`, `title`, `linkId`, and `position`.

#### Linking windows by ticker
File: `src/app/App.tsx`

Concept:
- Each window instance has a `linkId` (currently defaulted to `1`).
- Clicking a ticker inside a window can call `onTickerClick(ticker, linkId)`.
- `App` stores `linkedTicker[linkId] = ticker` and passes `initialTicker` to linked windows.

This is how a ticker click in Watchlist can prefill the News search box.

#### Dark mode
File: `src/app/App.tsx`

- `isDarkMode` toggles the `dark` class on `document.documentElement`.

### News window (real backend data)
File: `src/app/components/NewsWindow.tsx`

#### Data flow overview
The News window does **not** render mock news.

Instead it:
1) (On mount) triggers a **lightweight pull** of “today” from EODHD into SQLite:
   - `POST /api/news/pull-eodhd` with `{ date: <today>, symbol: "", limit: 200, offset: 0, fetch_all: false }`
   - Failures are logged as warnings only (UI remains functional).
2) Loads its visible list from SQLite:
   - `GET /api/news?source_names=EODHD&limit=200&from=...&to=...&cursor=...`
3) When a date range is selected, it progressively pulls the upstream range from EODHD **in chunks** (offset-based) while the user scrolls.

Important: **The UI always renders from SQLite via `GET /api/news`.** Pulling from EODHD is an ingestion action, not the rendering source.

#### Query + filtering

In-memory filters (frontend):
- Search query input is debounced by 250ms.
- Search syntax (implemented in `filterNewsByQuery`):
  - supports simple `AND` / `OR` logic by splitting on `" and "` and `" or "`.
- Date range filter additionally filters by the `item.date` (YYYY-MM-DD string derived from `published_at`).
- Source filter filters by `item.source`.

Backend filtering used by the News window:
- Always passes `source_names=EODHD` so only EODHD-ingested items show.
- For date range selection, passes ISO timestamps:
  - from: `YYYY-MM-DDT00:00:00.000Z`
  - to: `YYYY-MM-DDT23:59:59.999Z`

UI-only filters (currently not wired to data):
- `marketCap` and `sector` exist in UI state, but are not applied to backend queries nor to in-memory filtering.

#### Progressive EODHD pulling for a selected date range
When the user selects both `dateFrom` and `dateTo`:
- The component maintains `pullOffset` and `pullDone`.
- It calls `POST /api/news/pull-eodhd` with:
  - `{ from: YYYY-MM-DD, to: YYYY-MM-DD, symbol: "", limit: 200, offset: pullOffset, fetch_all: false }`
- The backend responds with `nextOffset` / `done`.

Pull strategy:
- On range change: `pullOffset` resets to 0 and `pullDone` resets to false.
- On first page load: kicks off `pullNextEodhdChunk()` in the background (non-blocking).
- On infinite-scroll loadMore: if range selected and not done, it prefetches another upstream chunk.
- If the DB page fetch returns 0 items but the upstream range is not fully pulled yet:
  - it pulls one chunk and retries the DB fetch once.

This is designed to avoid a “blank screen until everything downloads” experience.

#### Pagination from the backend
The backend returns cursor pagination (`nextCursor`).

The News window logic:
- Keeps `newsPages: NewsItem[][]` and flattens into `remoteNews`.
- Keeps `nextCursor` from the backend.
- For safety, it can synthesize a cursor if `nextCursor` is missing by encoding `publishedAt|id` with `btoa(...)`.

#### Virtualized rendering + infinite scroll
Rendering uses `react-window` (`VariableSizeList`) to avoid mounting thousands of DOM nodes.

Row model:
- The list is built from `rows: NewsRow[]` where each row is either:
  - a date header row (`{kind:'date', date}`)
  - a news item row (`{kind:'item', item}`)

Row heights:
- Date row: 36px
- Item row collapsed: 64px
- Item row expanded: 420px

Infinite scroll trigger:
- `onItemsRendered` checks when `visibleStopIndex >= rows.length - 8` and calls `loadMore()`.

#### Sticky date header (virtualization-safe)
CSS `position: sticky` does not behave reliably inside a virtualized list because rows are absolutely positioned.

Solution used here:
- A separate overlay “sticky date” header is rendered above the list.
- The list’s inner height is increased by `STICKY_DATE_HEADER_HEIGHT`.
- Each row’s `top` is shifted down by the sticky header height.
- The sticky date value is computed from the currently visible start row.

#### Expanded body UX
- Clicking the title toggles expansion.
- Expanded state uses a larger row height and shows the body in a scrollable container (`max-h-80`).

#### Layout constraints to avoid overlap
Because virtualization assumes fixed row heights, content must not unexpectedly wrap and exceed the intended height.

Notable choices:
- Ticker chips render in a horizontal, non-wrapping row with `overflow-x-auto`.
- Title is ellipsized in collapsed mode.
- URL is truncated.

### Watchlist window (mock)
File: `src/app/components/WatchlistWindow.tsx`
- Uses `mockWatchlistData` from `src/app/mockData.ts`.
- Clicking a ticker calls `onTickerClick?.(ticker)` to link into other windows.

### Calendar window (mock)
File: `src/app/components/CalendarWindow.tsx`
- Uses `mockCalendarData` from `src/app/mockData.ts`.
- Contains rich UI for per-type columns, filtering, sorting, and column drag/resize.

### File map
- `src/app/App.tsx` — tabs, dark mode, window linking, window layout
- `src/app/components/DraggableWindow.tsx` — window chrome, drag/resize behavior
- `src/app/components/AddTabModal.tsx` — choose windows and start a tab
- `src/app/components/NewsWindow.tsx` — backend-backed news feed + ingestion triggers + virtualization
- `src/app/components/WatchlistWindow.tsx` — mock watchlist
- `src/app/components/CalendarWindow.tsx` — mock calendar
- `src/app/mockData.ts` — watchlist/calendar mock datasets + helper functions (`filterNewsByQuery`, `groupNewsByDate`)
- `vite.config.ts` — dev proxy to backend

### Change requests (how to ask for edits)
When requesting changes to the News window, specify:
- Whether it’s only a UI change, or requires backend/API changes.
- Whether it affects virtualization row heights (and what the new expected heights are).
- Whether it should change the progressive pulling strategy (`offset` chunking) and why.
- Any constraints on max network calls, responsiveness, and how quickly the first page must render.

---

## KO

### 목적
이 문서는 아래 경로의 Figma 기반 프런트엔드에 대한 프롬프트/스펙입니다.

- `termina_web/figma_code/terminal ui/`

이 UI는 “탭 + 드래그 가능한 윈도우”로 구성된 터미널 스타일 작업 공간입니다.

현재 실제 데이터 연동 상태:
- **News** 윈도우는 백엔드 SQLite 피드를 `GET /api/news`로 읽고, `POST /api/news/pull-eodhd`로 EODHD 히스토리 적재를 트리거할 수 있습니다.
- **Watchlist** / **Calendar** 윈도우는 아직 로컬 mock 데이터를 사용합니다(백엔드 호출 없음).

제약:
- 요청되지 않은 페이지/모달/필터를 추가하지 않기
- 새로운 컬러/테마 토큰을 하드코딩하지 않기(현재 Tailwind 사용 방식 유지)
- News 윈도우에 mock 뉴스 생성/데모 폴백을 다시 넣지 않기

### 실행 방법 (dev)

사전조건:
- 백엔드가 `http://localhost:8080`에서 실행 중
- EODHD 뉴스 pull을 위해 레포 루트에 `EODHD/API TOKEN` 파일 존재

`termina_web/figma_code/terminal ui/`에서:

1) 의존성 설치
```bash
npm install
```

2) Vite dev 서버 실행
```bash
npm run dev
```

Vite 프록시(`vite.config.ts`):
- `/api/*` → `http://localhost:8080`
- `/healthz` → `http://localhost:8080`

따라서 프런트에서는 `fetch('/api/...')` 형태로 포트 하드코딩 없이 호출합니다.

### UI 구조(요약)

#### 탭 + 윈도우
파일: `src/app/App.tsx`

동작:
- `tabs: TabData[]` 상태를 유지하며, 각 탭은 `windows: WindowInstance[]`를 가집니다.
- `AddTabModal`로 탭을 추가합니다.
- 탭은 우클릭 시 이름 편집 상태로 들어가 rename 가능합니다.
- 탭 닫기는 가능하지만 “마지막 탭”은 닫지 않습니다.

윈도우 인스턴스:
- `handleStartTab(selectedWindows: WindowType[])`에서 생성
- `id`, `type`, `title`, `linkId`, `position`을 포함

#### 티커로 윈도우 연결
파일: `src/app/App.tsx`

개념:
- 각 윈도우에는 `linkId`가 있으며(현재 기본값 1), 같은 `linkId`를 공유하는 윈도우는 티커를 공유할 수 있습니다.
- 어떤 윈도우에서 티커를 클릭하면 `onTickerClick(ticker, linkId)`를 통해 상위로 전달합니다.
- `App`은 `linkedTicker[linkId] = ticker`로 저장하고, 연결된 윈도우에 `initialTicker`로 내려줍니다.

즉 Watchlist에서 티커 클릭 → News 검색창 초기값 반영 같은 흐름이 가능합니다.

#### 다크 모드
파일: `src/app/App.tsx`
- `isDarkMode`가 `document.documentElement`에 `dark` 클래스를 붙였다 떼는 방식입니다.

### News 윈도우(백엔드 실데이터)
파일: `src/app/components/NewsWindow.tsx`

#### 데이터 흐름 개요
News 윈도우는 mock 뉴스를 렌더링하지 않습니다.

대신 아래 흐름으로 동작합니다.
1) (마운트 시) “오늘” 범위에 대해 EODHD → SQLite 적재를 가볍게 한 번 시도
   - `POST /api/news/pull-eodhd`에 `{ date: <today>, symbol: "", limit: 200, offset: 0, fetch_all: false }`
   - 실패해도 UI는 계속 동작(콘솔 warning)
2) 화면 렌더링은 항상 SQLite에서 읽음
   - `GET /api/news?source_names=EODHD&limit=200&from=...&to=...&cursor=...`
3) 날짜 범위가 선택되면, 스크롤 진행에 따라 EODHD에서 해당 범위를 **offset 기반으로 chunk 단위**로 점진적으로 pull

중요: **UI는 항상 `GET /api/news`(SQLite)로 렌더링합니다.** EODHD pull은 “적재(ingestion)” 액션입니다.

#### 검색/필터링

프런트 인메모리 필터:
- 검색어는 250ms 디바운스
- 검색 구문(`filterNewsByQuery`):
  - `" and "`, `" or "`로 split 하는 단순 AND/OR 지원
- 날짜 범위는 `item.date`(published_at에서 만든 YYYY-MM-DD 문자열)로 추가 필터
- Source 필터는 `item.source`로 필터

백엔드 쿼리에서 사용하는 필터:
- 항상 `source_names=EODHD`를 보내 EODHD로 적재된 데이터만 표시
- 날짜 범위를 고르면 ISO 타임스탬프로 전달
  - from: `YYYY-MM-DDT00:00:00.000Z`
  - to: `YYYY-MM-DDT23:59:59.999Z`

UI만 존재하고 실제 데이터에 반영되지 않는 필터(현재 미구현):
- `marketCap`, `sector`는 상태/버튼 UI만 존재하고, 백엔드 쿼리나 인메모리 필터에 반영되지 않습니다.

#### 날짜 범위 선택 시 EODHD 점진 pull
사용자가 `dateFrom`과 `dateTo`를 모두 선택하면:
- `pullOffset`, `pullDone` 상태를 유지합니다.
- 아래 payload로 `POST /api/news/pull-eodhd`를 반복 호출합니다.
  - `{ from: YYYY-MM-DD, to: YYYY-MM-DD, symbol: "", limit: 200, offset: pullOffset, fetch_all: false }`
- 응답의 `nextOffset`, `done`을 반영합니다.

pull 전략:
- range 변경 시: `pullOffset=0`, `pullDone=false`로 리셋
- 첫 페이지 로드 시: `pullNextEodhdChunk()`를 백그라운드로 1회 호출(렌더링 block 없음)
- 무한 스크롤 loadMore 시: range가 선택되어 있고 아직 `done`이 아니면 upstream chunk를 미리 pull
- DB에서 더 이상 아이템이 안 나오지만 upstream pull이 끝나지 않았다면:
  - chunk 1회 pull 후 동일 cursor로 DB fetch를 1회만 재시도

목표는 “전부 다 다운될 때까지 빈 화면”을 방지하는 것입니다.

#### 백엔드 커서 페이지네이션
백엔드가 `nextCursor`를 반환합니다.

NewsWindow의 페이지 관리:
- `newsPages: NewsItem[][]`를 쌓고 `remoteNews`로 flatten
- `nextCursor`를 유지
- 안전장치로 `nextCursor`가 없을 때 `publishedAt|id`를 `btoa(...)`로 인코딩해 cursor를 합성할 수 있습니다.

#### 가상화(virtualization) + 무한 스크롤
리스트 렌더링은 `react-window`의 `VariableSizeList`로 구현되어 DOM 폭증을 방지합니다.

행 모델:
- `rows: NewsRow[]`는
  - 날짜 헤더 행(`{kind:'date', date}`)
  - 뉴스 아이템 행(`{kind:'item', item}`)
  으로 구성됩니다.

행 높이:
- 날짜 행: 36px
- 아이템 접힘: 64px
- 아이템 펼침: 420px

무한 스크롤 트리거:
- `visibleStopIndex >= rows.length - 8`이면 `loadMore()` 호출

#### sticky 날짜 헤더(가상화 호환)
가상화 리스트는 행이 absolute positioning이라 CSS `position: sticky`가 기대대로 동작하지 않는 경우가 많습니다.

여기서는 아래 방식으로 해결합니다.
- 리스트 위에 overlay 형태의 sticky 헤더를 별도로 렌더
- 리스트 inner height에 `STICKY_DATE_HEADER_HEIGHT`를 더함
- 각 행의 `top`을 sticky 헤더 높이만큼 아래로 shift
- sticky 날짜는 현재 visibleStartIndex 기준으로 계산

#### 펼침(본문) UX
- 타이틀 클릭으로 펼침/접힘
- 펼침 상태에서는 행 높이를 크게 잡고(`420px`), 본문은 내부 스크롤(`max-h-80`)로 표시

#### 겹침(overlap) 방지 레이아웃 제약
가상화는 “행 높이”를 신뢰하므로, 콘텐츠가 wrap되어 예기치 않게 높이가 늘면 겹침 문제가 생길 수 있습니다.

따라서 아래처럼 구성되어 있습니다.
- 티커 칩은 가로 1줄 + `overflow-x-auto` + `whitespace-nowrap`
- 타이틀은 접힘 상태에서 ellipsis 처리
- URL은 truncate 처리

### Watchlist 윈도우(mock)
파일: `src/app/components/WatchlistWindow.tsx`
- `src/app/mockData.ts`의 `mockWatchlistData`를 사용
- 티커 클릭 시 `onTickerClick?.(ticker)` 호출(윈도우 링크용)

### Calendar 윈도우(mock)
파일: `src/app/components/CalendarWindow.tsx`
- `src/app/mockData.ts`의 `mockCalendarData`를 사용
- 타입별 컬럼 표시/필터/정렬/드래그/리사이즈 UI를 포함

### 파일 맵
- `src/app/App.tsx` — 탭, 다크모드, 윈도우 링크, 레이아웃
- `src/app/components/DraggableWindow.tsx` — 윈도우 드래그/리사이즈
- `src/app/components/AddTabModal.tsx` — 탭 시작 시 창 선택
- `src/app/components/NewsWindow.tsx` — 백엔드 뉴스 + 적재 트리거 + 가상화
- `src/app/components/WatchlistWindow.tsx` — mock 워치리스트
- `src/app/components/CalendarWindow.tsx` — mock 캘린더
- `src/app/mockData.ts` — watchlist/calendar mock 데이터 + 뉴스 필터/그룹 헬퍼
- `vite.config.ts` — 백엔드 프록시

### 변경 요청 가이드
News 윈도우 변경을 요청할 때는 아래를 명시해 주세요.
- UI만 변경인지, 백엔드/API 변경이 필요한지
- 가상화 행 높이/레이아웃에 영향을 주는지(새 높이 값 포함)
- offset 기반 progressive pull 전략을 바꿔야 하는지/왜 필요한지
- 네트워크 호출 수/초기 렌더 속도/반응성에 대한 요구사항
