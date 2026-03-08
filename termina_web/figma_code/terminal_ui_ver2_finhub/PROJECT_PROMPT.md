# Frontend Project Prompt

## 목적
이 문서는 `termina_web/figma_code/terminal_ui_ver2_finhub/` 현재 구현을 기준으로 한 프런트엔드 스펙이다. 어떤 창이 실제로 열리는지, 어떤 창이 백엔드 실데이터를 쓰는지, 어떤 UI 상태가 `localStorage`에 저장되는지 이 문서만 읽고 바로 파악할 수 있어야 한다.

이 프런트는 React + TypeScript + Tailwind 기반의 다중 탭, 다중 창 terminal 스타일 UI다. 핵심은 아래와 같다.

1. 탭마다 여러 창을 동시에 열고 드래그/리사이즈/최대화할 수 있다.
2. 일부 창은 백엔드 API와 직접 연결되고, 일부 창은 아직 mock/local state 기반이다.
3. 같은 `linkId`를 공유하는 창끼리는 ticker 클릭을 통해 검색 대상을 연결할 수 있다.
4. workspace 레이아웃, 다크 모드, 폰트 설정 등 일부 UI 상태를 `localStorage`에 저장하고 복원한다.

## 현재 구현 상태 요약

- 실제 Add Tab에서 선택 가능한 창은 총 6개다.
  - `news`
  - `calendar`
  - `watchlist`
  - `finhub-news`
  - `default-ticker`
  - `data-control`
- `BraveNewsWindow.tsx` 파일은 남아 있지만 현재 `AddTabModal`과 `DraggableWindow`에서는 사용하지 않는다.
- 앱 전체 workspace는 `terminal-workspace-v1` 키로 `localStorage`에 저장된다.
- `isDarkMode`, `fontScale`, `newsTitleFontSize`, `newsSummaryFontSize`, `linkedTicker`, 탭/창 레이아웃이 함께 저장된다.
- `NewsWindow`는 EODHD 기반 경량 뉴스 피드다.
- `FinnhubNewsWindow`는 현재 실질적인 메인 뉴스 창이며, 북마크/컬럼 설정/fulltext/변화율/sentiment/company data까지 보여준다.
- `CalendarWindow`, `WatchlistWindow`는 아직 mock/local state 기반이다.
- `DefaultTickerWindow`, `DataControlWindow`는 백엔드 API를 직접 사용한다.

## 기술 스택

- React 18
- TypeScript
- Vite
- Tailwind CSS v4
- `re-resizable`
- `react-window`
- `react-datepicker`
- `lucide-react`

## 실행 방법

프런트 폴더에서 실행한다.

```bash
npm install
npm run dev
```

빌드:

```bash
npm run build
```

사전조건:

- 백엔드가 `http://localhost:8080`에서 실행 중이어야 한다.
- Vite proxy를 통해 `/api/*`, `/healthz`가 백엔드로 전달된다.

## 앱 구조

### 탭과 workspace 복원

파일: `src/app/App.tsx`

동작:

- `tabs: TabData[]`를 루트 상태로 관리한다.
- 기본 탭은 `Tab 1` 하나이며 초기에는 창이 비어 있다.
- Add Tab으로 새 탭을 만들면 선택한 window type 조합으로 새 탭이 생성된다.
- 탭은 우클릭으로 이름 수정, 드래그로 순서 변경, 닫기가 가능하다.
- 마지막 탭 하나는 닫지 못한다.

`localStorage` 복원 키:

- `terminal-workspace-v1`

저장되는 값:

- `[][][]version[][][]`
- `[][][]activeTabId[][][]`
- `[][][]isDarkMode[][][]`
- `[][][]fontScale[][][]`
- `[][][]newsTitleFontSize[][][]`
- `[][][]newsSummaryFontSize[][][]`
- `[][][]linkedTicker[][][]`
- `[][][]tabs[][][]`

### 창 공통 래퍼

파일: `src/app/components/DraggableWindow.tsx`

기능:

- 드래그 이동
- 8방향 리사이즈
- 최대화/복원
- 닫기
- viewport 바깥으로 복원되는 창 위치 clamp

렌더 매핑:

- `news` -> `NewsWindow`
- `watchlist` -> `WatchlistWindow`
- `calendar` -> `CalendarWindow`
- `finhub-news` -> `FinnhubNewsWindow`
- `default-ticker` -> `DefaultTickerWindow`
- `data-control` -> `DataControlWindow`

### ticker link 동작

파일: `src/app/App.tsx`

개념:

- 모든 창 인스턴스는 기본적으로 `linkId: 1`을 가진다.
- 어떤 창에서 ticker를 클릭하면 상위 `App`이 `linkedTicker[linkId] = ticker`를 저장한다.
- 연결된 창은 `initialTicker` prop으로 이 값을 받아 검색창 초기값 등으로 사용한다.

### 다크 모드와 폰트 스케일

파일: `src/app/App.tsx`, `src/app/components/DataControlWindow.tsx`

- 다크 모드는 `document.documentElement.classList`에 `dark` 클래스를 토글한다.
- 전체 폰트 스케일은 `document.documentElement.style.fontSize`로 반영한다.
- 뉴스 제목/요약 폰트 크기는 `FinnhubNewsWindow`에 prop으로 전달된다.

## 창별 현재 상태

### 1. `NewsWindow`

파일: `src/app/components/NewsWindow.tsx`

역할:

- EODHD 중심의 경량 뉴스 피드
- 날짜 범위 선택 시 EODHD -> SQLite 적재를 점진적으로 트리거
- 렌더링은 항상 backend SQLite 결과만 사용

사용 API:

- `POST /api/news/pull-eodhd`
- `GET /api/news`

핵심 동작:

1. mount 시 오늘 날짜 기준 `POST /api/news/pull-eodhd`를 가볍게 한 번 시도한다.
2. 실제 리스트는 `GET /api/news?source_names=EODHD` 결과만 사용한다.
3. 날짜 범위를 선택하면 `offset` 기반 chunk pull을 background로 진행한다.
4. 결과 렌더링은 `react-window` 가상화 + 커서 기반 무한 스크롤을 사용한다.

UI 상태:

- `[][][]searchQuery[][][]`
- `[][][]filters.dateFrom[][][]`
- `[][][]filters.dateTo[][][]`
- `[][][]filters.marketCap[][][]`
- `[][][]filters.source[][][]`
- `[][][]filters.sector[][][]`
- `[][][]newsPages[][][]`
- `[][][]nextCursor[][][]`
- `[][][]pullOffset[][][]`
- `[][][]pullDone[][][]`
- `[][][]savedSearches[][][]`
- `[][][]expandedNewsId[][][]`

컬럼:

- `[][][]time[][][]`
- `[][][]ticker[][][]`
- `[][][]title[][][]`
- `[][][]source[][][]`

주의:

- `marketCap`, `sector` 필터는 UI만 있고 실제 데이터 필터에 반영되지 않는다.
- 저장된 검색은 component state 전용이라 새로고침 후 유지되지 않는다.
- 표시 대상 source는 고정적으로 EODHD다.

### 2. `FinnhubNewsWindow`

파일: `src/app/components/FinnhubNewsWindow.tsx`

역할:

- 현재 앱의 메인 뉴스 terminal 창
- Finnhub/EODHD가 적재된 뉴스 DB를 넓은 컬럼 집합으로 조회
- 북마크, fulltext, 회사 설명, peers, sentiment, score/evidence, 변화율, source type filter를 제공

사용 API:

- `GET /api/news`
- `POST /api/news/pull-finhub`
- `GET /api/news/pull-finhub/preflight`
- `GET /api/jobs/:jobId`
- `POST /api/news/fulltext/update`
- `GET /api/news/fulltext/:newsId`
- `POST /api/news/change/update-recent`
- `POST /api/news/change/update-custom`
- `GET /api/bookmarks/folders`
- `POST /api/bookmarks/folders`
- `PUT /api/bookmarks/folders/:id`
- `DELETE /api/bookmarks/folders/:id`
- `POST /api/bookmarks/items`
- `DELETE /api/bookmarks/items`
- `PATCH /api/bookmarks/items/move`
- `GET /api/bookmarks/folders/:folderId/items`

`localStorage` 키:

- `finhub-news-ui-state`
- `finnhub-last-update-config`

저장되는 대표 값:

- `[][][]searchQuery[][][]`
- `[][][]tickerQuery[][][]`
- `[][][]fromDate[][][]`
- `[][][]toDate[][][]`
- `[][][]selectedBookmarkFolderId[][][]`
- `[][][]displayMode[][][]`
- `[][][]visibleCols[][][]`
- `[][][]sourceTypeFilter[][][]`
- 최근 업데이트 설정 `[][][]mode[][][]`, `[][][]sourceType[][][]`

주요 UI 기능:

- full text 팝업
- bookmark folder 트리/이동
- source cell 우클릭 메뉴
- row context menu
- column reorder / resize / visibility toggle
- title-only / title-abstract 표시 모드
- source type filter (`all`, `company_news`, `press_release`, `market_news`)
- background job log panel

기본 컬럼:

- `[][][]date[][][]`
- `[][][]ticker[][][]`
- `[][][]time[][][]`
- `[][][]title[][][]`
- `[][][]publisher[][][]`
- `[][][]industry[][][]`
- `[][][]source[][][]`
- `[][][]fulltext[][][]`
- `[][][]changes[][][]`
- `[][][]keywords[][][]`
- `[][][]score[][][]`
- `[][][]scoreEvidence[][][]`
- `[][][]sentiment[][][]`
- `[][][]peers[][][]`
- `[][][]companyDesc[][][]`

기본 숨김 컬럼:

- `[][][]source[][][]`
- `[][][]keywords[][][]`
- `[][][]score[][][]`
- `[][][]scoreEvidence[][][]`
- `[][][]sentiment[][][]`
- `[][][]peers[][][]`
- `[][][]companyDesc[][][]`

주의:

- 이름은 `FinnhubNewsWindow`지만 렌더링 데이터는 `/api/news` 통합 결과다.
- `NewsWindow`와는 완전히 별도 상태를 가진다.
- bookmark는 backend persistent, save/load/filter 일부는 localStorage persistent다.

### 3. `DefaultTickerWindow`

파일: `src/app/components/DefaultTickerWindow.tsx`

역할:

- 기본 CSV ticker 목록 조회/추가
- 다른 창에 ticker를 빠르게 전달하는 picker 역할

사용 API:

- `GET /api/tickers`
- `POST /api/tickers/add`

기본 CSV 경로:

- `tradigview_screener/original_data/watch lists2_2026-02-22.csv`

UI 상태:

- `[][][]csvPath[][][]`
- `[][][]tickers[][][]`
- `[][][]newTicker[][][]`
- `[][][]filterText[][][]`
- `[][][]loading[][][]`
- `[][][]adding[][][]`
- `[][][]error[][][]`

### 4. `DataControlWindow`

파일: `src/app/components/DataControlWindow.tsx`

역할:

- 백엔드 데이터 작업의 운영 콘솔
- update status, background job polling, App DB inspect, 폰트 설정 조절

사용 API:

- `GET /api/updates/status`
- `GET /api/ibkr/ohlc1d/status`
- `POST /api/ibkr/ohlc1d/update`
- `POST /api/ibkr/calendar/update`
- `POST /api/company-profiles/pull-fmp`
- `POST /api/company-profiles/pull-peers`
- `POST /api/news/change/update-recent`
- `POST /api/news/change/update-custom`
- `GET /api/jobs/:jobId`
- `GET /api/db/inspect`

탭:

- `updates`
- `settings`
- `appdb`

`localStorage` 키:

- `data-control-active-tab`

Updates 탭 섹션:

- `price`
- `calendarBackfill`
- `calendarRefresh`
- `companyDesc`
- `peersPull`
- `recent`
- `custom`

Settings 탭 값:

- `[][][]fontScale[][][]`
- `[][][]newsTitleFontSize[][][]`
- `[][][]newsSummaryFontSize[][][]`

### 5. `WatchlistWindow`

파일: `src/app/components/WatchlistWindow.tsx`

역할:

- 로컬 mock 기반 watchlist 편집기
- ticker add/delete, select mode, watchlist preset 관리

데이터 소스:

- `src/app/mockData.ts`의 `mockWatchlistData`
- 파일 내부 `TICKER_DB` fallback lookup

특징:

- backend watchlist API를 사용하지 않는다.
- watchlist create/rename/switch는 component state 안에서만 동작한다.
- row 클릭 시 `onTickerClick`으로 linked ticker 전달 가능

컬럼:

- `[][][]ticker[][][]`
- `[][][]name[][][]`
- `[][][]mktcap[][][]`
- `[][][]industry[][][]`
- `[][][]price[][][]`
- `[][][]change[][][]`
- `[][][]percent[][][]`

### 6. `CalendarWindow`

파일: `src/app/components/CalendarWindow.tsx`

역할:

- mock calendar 이벤트 탐색 창
- type별 탭과 컬럼 구성이 분리된 테이블 UI

데이터 소스:

- `src/app/mockData.ts`의 `mockCalendarData`

주의:

- backend calendar API를 직접 사용하지 않는다.
- DataControlWindow에서 IBKR calendar를 적재할 수 있지만, 현재 이 창은 그 DB 결과를 읽지 않는다.

탭:

- `earnings`
- `conference`
- `dividend`
- `analyst_rating`

## 파일 맵

- `src/app/App.tsx`: 탭, workspace 복원, dark mode, linked ticker, 탭 reorder
- `src/app/types.ts`: `WindowType`, `TabData`, `WindowInstance`, `NewsItem`, `CalendarEvent`, `WatchlistItem`
- `src/app/components/AddTabModal.tsx`: 새 탭에서 창 선택
- `src/app/components/DraggableWindow.tsx`: 창 공통 shell
- `src/app/components/NewsWindow.tsx`: EODHD 전용 경량 뉴스 피드
- `src/app/components/FinnhubNewsWindow.tsx`: 메인 뉴스 terminal
- `src/app/components/DefaultTickerWindow.tsx`: CSV ticker 관리자
- `src/app/components/DataControlWindow.tsx`: 운영 콘솔
- `src/app/components/WatchlistWindow.tsx`: mock watchlist
- `src/app/components/CalendarWindow.tsx`: mock calendar
- `src/app/components/BookmarkManager.tsx`: bookmark folder/item 관리 보조 UI
- `src/app/mockData.ts`: watchlist/calendar용 mock data 및 helper 함수
- `vite.config.ts`: `/api`, `/healthz` 프록시 설정

## 타입 요약

파일: `src/app/types.ts`

현재 `WindowType`:

- `[][][]news[][][]`
- `[][][]watchlist[][][]`
- `[][][]calendar[][][]`
- `[][][]finhub-news[][][]`
- `[][][]default-ticker[][][]`
- `[][][]data-control[][][]`

주의:

- 예전 `brave-news`는 현재 공식 window type이 아니다.

## 현재 프런트-백 연결 요약

백엔드 사용 창:

- `NewsWindow`
- `FinnhubNewsWindow`
- `DefaultTickerWindow`
- `DataControlWindow`

mock/local 창:

- `WatchlistWindow`
- `CalendarWindow`

미사용 legacy 파일:

- `BraveNewsWindow.tsx`

## 작업 시 주의사항

- `NewsWindow`와 `FinnhubNewsWindow`는 목적과 상태 저장 방식이 다르므로 혼동하면 안 된다.
- backend calendar/watchlist API가 존재해도 현재 `CalendarWindow`, `WatchlistWindow`는 그 API를 쓰지 않는다.
- workspace 복원 로직이 있으므로 창 타입 이름, `WindowInstance` 구조, position shape를 바꿀 때는 이전 `localStorage`와의 호환을 고려해야 한다.
- DataControlWindow는 운영성 기능이 많아 UI 변경 시 어떤 endpoint를 치는지 함께 점검해야 한다.# Frontend Project Prompt

## 목적
이 문서는 `termina_web/figma_code/terminal_ui_ver2_finhub/` 현재 구현을 기준으로 한 프런트엔드 작업용 스펙이다. 현재 앱이 어떤 창(window)으로 구성되어 있고, 어떤 창이 백엔드 실데이터를 쓰며, 어떤 상태를 `localStorage`에 저장하는지 바로 파악할 수 있어야 한다.

이 프런트는 React + TypeScript + Tailwind 기반의 다중 탭, 다중 창 terminal 스타일 UI다. 핵심은 아래 4가지다.

1. 탭마다 여러 창을 동시에 열고 드래그/리사이즈/최대화할 수 있다.
2. 일부 창은 백엔드 API와 직접 연결되고, 일부 창은 아직 mock/local state 기반이다.
3. 같은 `linkId`를 공유하는 창끼리는 ticker 클릭을 통해 검색 대상을 연결할 수 있다.
4. workspace 레이아웃, 다크 모드, 폰트 설정 등 일부 UI 상태를 `localStorage`에 복원/저장한다.

## 현재 구현 상태 요약

- 실제 Add Tab에서 선택 가능한 창은 총 6개다.
  - `news`
  - `calendar`
  - `watchlist`
  - `finhub-news`
  - `default-ticker`
  - `data-control`
- `BraveNewsWindow.tsx` 파일은 코드베이스에 남아 있지만 현재 `AddTabModal`과 `DraggableWindow`에서는 사용하지 않는다.
- 앱 전체 workspace는 `terminal-workspace-v1` 키로 `localStorage`에 저장된다.
- `isDarkMode`, `fontScale`, `newsTitleFontSize`, `newsSummaryFontSize`, `linkedTicker`, 탭/창 레이아웃이 함께 저장된다.
- `NewsWindow`는 EODHD 기반 뉴스만 보여주는 가벼운 피드다.
- `FinnhubNewsWindow`는 현재 실질적인 메인 뉴스 창이며, 북마크/컬럼 설정/fulltext/변화율/sentiment/company data까지 보여준다.
- `CalendarWindow`, `WatchlistWindow`는 아직 mock/local state 기반이다.
- `DefaultTickerWindow`, `DataControlWindow`는 백엔드 API를 직접 사용한다.

## 기술 스택

- React 18
- TypeScript
- Vite
- Tailwind CSS v4
- `re-resizable`
- `react-window`
- `react-datepicker`
- `lucide-react`

## 실행 방법

프런트 폴더에서 실행한다.

```bash
npm install
npm run dev
```

빌드:

```bash
npm run build
```

사전조건:

- 백엔드가 `http://localhost:8080`에서 실행 중이어야 한다.
- Vite proxy를 통해 `/api/*`, `/healthz`가 백엔드로 전달된다.
# Figma Frontend Prompt (Stock News Platform)

## EN

### Purpose

This document is the prompt/spec for the Figma-derived frontend located at this project.

This UI is a Benzinga-style stock news platform built as a draggable, multi-tab "terminal-like" workspace using React + TypeScript + Tailwind CSS. It provides multiple window types (News, Brave News, Watchlist, Calendar) that can be opened, moved, resized, and linked together by ticker symbol.

Current real-data integration status:

- **News** window reads from the backend SQLite feed via `GET /api/news` and can trigger historical imports via `POST /api/news/pull-eodhd`.
- **Brave News**, **Watchlist**, and **Calendar** windows use local mock data (they do not call the backend).

Constraints:

- Do not add new pages/modals/filters beyond what is explicitly requested.
- Do not introduce new colors/theme tokens; keep Tailwind usage consistent with the existing UI.
- Do not reintroduce mock news generation or "fallback demo news" in the News window.

### Tech Stack

- **React 18** + **TypeScript** (Vite bundler)
- **Tailwind CSS v4** for styling
- **re-resizable** for window resize
- **react-window** for virtualized lists (News, Brave News)
- **react-datepicker** for date range pickers
- **lucide-react** for icons
- **date-fns** for date utilities
- Dark mode support via `dark` class on `<html>`

### How to run (dev)

Prereqs:

- Backend running at `http://localhost:8080`.
- EODHD token file exists at repo root `EODHD/API TOKEN` for pulling news.

From the project root:

1. Install deps

```bash
npm install
```

2. Start Vite dev server

```bash
npm run dev
```

Vite proxy (see `vite.config.ts`):

- `/api/*` proxies to `http://localhost:8080`
- `/healthz` proxies to `http://localhost:8080`

So frontend code can simply `fetch('/api/...')` without hard-coding ports.

---

### High-level UI structure

#### Tabs + windows

File: `src/app/App.tsx`

Behavior:

- The app maintains `tabs: TabData[]`, each tab has `windows: WindowInstance[]`.
- Tabs can be added via the `AddTabModal` flow (checkbox selection of window types: Calendar, News, News Feed: Brave API, Watch List).
- Tabs can be renamed by right-clicking the tab (context menu behavior implemented as "start editing").
- Tabs can be closed (but not the last remaining tab).

Window instances:

- Created by `handleStartTab(selectedWindows: WindowType[])`.
- Each window has `id`, `type`, `title`, `linkId`, and `position`.
- Window positioning: 1 window = full size, 2 windows = side by side, 3+ windows = staggered layout.

#### DraggableWindow wrapper

File: `src/app/components/DraggableWindow.tsx`

- Wraps each window content component in a resizable + draggable container.
- Uses `re-resizable` (`Resizable`) for 8-directional resize.
- Title bar is the drag handle (mousedown on title bar initiates drag).
- Maximize/minimize toggle, close button.
- Renders the appropriate content component based on `window.type`:
  - `'news'` -> `NewsWindow`
  - `'brave-news'` -> `BraveNewsWindow`
  - `'watchlist'` -> `WatchlistWindow`
  - `'calendar'` -> `CalendarWindow`

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
- Sun/Moon icon in the top bar.

---

### News window (real backend data)

File: `src/app/components/NewsWindow.tsx`

#### Data flow overview

The News window does **not** render mock news.

Instead it:

1. (On mount) triggers a **lightweight pull** of "today" from EODHD into SQLite:
   - `POST /api/news/pull-eodhd` with `{ date: <today>, symbol: "", limit: 200, offset: 0, fetch_all: false }`
   - Failures are logged as warnings only (UI remains functional).
2. Loads its visible list from SQLite:
   - `GET /api/news?source_names=EODHD&limit=200&from=...&to=...&cursor=...`
3. When a date range is selected, it progressively pulls the upstream range from EODHD **in chunks** (offset-based) while the user scrolls.

Important: **The UI always renders from SQLite via `GET /api/news`.** Pulling from EODHD is an ingestion action, not the rendering source.

#### Toolbar layout

- Row 1: Search input (with boolean AND/OR support) | Filters button | Save button
- Saved searches dropdown (visible when saved searches exist)
- Filters panel (expandable): Date Range (react-datepicker) | Market Cap toggle buttons | Source toggle buttons

#### Column definitions (resizable)

| Column ID | Label      | Default Width | Min Width |
| --------- | ---------- | ------------- | --------- |
| time      | Time       | 80px          | 50px      |
| ticker    | Ticker     | 100px         | 60px      |
| title     | News Title | 300px         | 100px     |
| source    | Source     | 140px         | 60px      |

All columns support drag-resize via mousedown on the column border handle.

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

This is designed to avoid a "blank screen until everything downloads" experience.

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

- A separate overlay "sticky date" header is rendered above the list.
- The list's inner height is increased by `STICKY_DATE_HEADER_HEIGHT`.
- Each row's `top` is shifted down by the sticky header height.
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

---

### Brave News window (mock data)

File: `src/app/components/BraveNewsWindow.tsx`

This is a secondary news feed window designed for Brave Search API integration (currently mock data only).

#### Data source

- Generates 50 mock news items on mount via `generateMockData()`.
- Mock data includes: title, abstract, ticker, source, change percentages (Chg%, fr.Open%, +7D%, +14D%, +30D%), and optional next earning date.

#### Toolbar layout (2 rows)

**Row 1:** Search bar | Refresh icon button (`RotateCw`) | Update text button | Save button | Load dropdown | Filter dropdown

- **Search bar**: Full-text search filtering by title and ticker.
- **Refresh button**: Icon-only button with `RotateCw` icon. Currently placeholder (console.log only).
- **Update button**: Text button labeled "Update". Currently placeholder (console.log only).
- **Save button**: Opens a modal to save current search query + filters with a user-defined name.
- **Load dropdown**: Lists saved searches with delete (x) capability per item.
- **Filter dropdown**: Contains Market Cap filter (custom Min/Max inputs + preset buttons: Mega 200B+, Large 10-200B, Mid 2-10B, Small 300M-2B, Micro <300M) and Industry filter (checkboxes: Technology, Finance, Healthcare, Energy, Consumer, Industrial). Has "Clear Filters" button.

**Row 2:** Date range inputs (native `<input type="date">`) | Display Mode dropdown (`Title Only` / `Title + Abstract`) | Watch Lists dropdown

- **Display Mode**: Two options:
  - `Title Only`: Shows only title; clicking a title toggles abstract expansion for that single item.
  - `Title + Abstract`: Always shows abstract below the title for all items.
- **Watch Lists**: Static dropdown with options: All, Tech Stocks, My Portfolio, High Volume.

#### Column definitions (draggable, sortable, resizable)

| Column ID | Label     | Default Width | Min Width | Notes                                                |
| --------- | --------- | ------------- | --------- | ---------------------------------------------------- |
| date      | Date      | 72px          | 50px      |                                                      |
| time      | Time      | 52px          | 40px      |                                                      |
| title     | Title     | 300px         | 100px     | flex                                                 |
| source    | Sources   | 90px          | 50px      |                                                      |
| changes   | Changes % | 280px         | 160px     | Multi-line: Chg/fr.Open/+7D, +14D/+30D, Earning date |

All columns support:

- **Drag reorder**: Drag column headers to rearrange column order (HTML5 drag and drop).
- **Click sort**: Click header to cycle asc -> desc -> none.
- **Drag resize**: Mousedown on column border handle to resize width.

#### Sorting

- Three-state cycle: ascending -> descending -> none.
- Sort icons: `ArrowUp` (asc), `ArrowDown` (desc).
- Sort values: date uses `publishedAt`, changes uses `openChange`.

#### Virtualized rendering

- Uses `react-window` `VariableSizeList`.
- Row heights:
  - Date header: 32px (`STICKY_DATE_HEADER_HEIGHT`)
  - Title-only mode (collapsed): 88px
  - Title+Abstract mode or expanded item: 140px
- Groups news items by date with date header rows.
- List height is dynamically measured via `ResizeObserver`.

#### Changes % column detail

Displays stock performance metrics in a compact multi-line layout:

- Line 1: `Chg: +X.XX% | fr.Open: +X.XX% | +7D: +X.XX%`
- Line 2: `+14D: +X.XX% | +30D: +X.XX%`
- Line 3 (optional): `Earning: YYYY-MM-DD` (blue text, only if `nextEarningDate` exists)

Color coding: green for positive values, red for negative, gray for zero/undefined.

#### Save/Load search settings

- Save: Modal with text input for name. Stores `{id, name, searchQuery, filters}` in component state.
- Load: Dropdown listing saved searches. Each item shows name with a delete (x) button (visible on hover).
- Two default saved searches are pre-populated: "Tech Large Cap" and "Healthcare".

#### Menus (outside-click close)

All dropdown menus (Filter, Load, Watch Lists, Display Mode) close when clicking outside, implemented via `mousedown` event listener with ref-based containment checks.

---

### Watchlist window (mock data)

File: `src/app/components/WatchlistWindow.tsx`

#### Data source

- Uses `mockWatchlistData` from `src/app/mockData.ts` (7 items: TSLA, AAPL, GOOGL, MSFT, NVDA, AMZN, META).
- Additional tickers can be added from `TICKER_DB` lookup (IONQ, AMD, PLTR, SOFI, RIVN, COIN, NFLX, BABA).

#### Toolbar layout

Single row: `"Watchlist"` label | Ticker input field | [+] Add button | [Select] toggle | [Delete] button (with count) | [Watch Lists] dropdown

- **Ticker input**: Supports multiple tickers separated by spaces or commas. Enter key or [+] button to add. Paste support.
- **Select mode**: Toggle button that enables checkbox selection mode for bulk operations.
- **Delete**: Bulk delete selected tickers. Disabled (grayed out) when no tickers selected. Shows count `Delete (N)`.
- **Watch Lists dropdown**: Lists available watchlists (Default, Tech Stocks, My Portfolio). Supports:
  - Switching between watchlists (loads corresponding tickers)
  - Inline rename (pencil icon -> text input with confirm/cancel)
  - New watchlist creation (+ New Watch List -> text input with confirm/cancel)
  - Active watchlist highlighted in blue

#### Column definitions (resizable)

| Column ID | Label    | Default Width | Min Width | Align |
| --------- | -------- | ------------- | --------- | ----- |
| ticker    | Ticker   | 64px          | 40px      | left  |
| name      | Name     | 160px         | 60px      | left  |
| mktcap    | Mkt Cap  | 72px          | 48px      | left  |
| industry  | Industry | 80px          | 50px      | left  |
| price     | Price    | 72px          | 48px      | right |
| change    | Change   | 80px          | 50px      | right |
| percent   | %        | 60px          | 40px      | right |

All columns support drag-resize via mousedown on column border handle.

#### Select mode behavior

- When select mode is on, a checkbox column appears on the left (width: 32px).
- Header checkbox toggles select all/deselect all.
- Individual row checkboxes toggle per-ticker selection.
- Clicking a row in select mode toggles its checkbox (instead of triggering `onTickerClick`).
- Clicking a row in normal mode triggers `onTickerClick` for ticker linking.

#### Visual details

- Ticker column: blue text (`text-blue-600`)
- Change column: green with `TrendingUp` icon or red with `TrendingDown` icon
- Percent column: green for positive, red for negative
- Selected rows: light blue background

---

### Calendar window (mock data)

File: `src/app/components/CalendarWindow.tsx`

#### Data source

- Uses `mockCalendarData` from `src/app/mockData.ts` (12 events across 4 types).

#### Tab-based layout

Four tabs, each with its own column configuration:

- **Earnings**: Date Announcement, Time, Symbol, Name*, Event*, Session, Period, Confirmed, EPS, Est. EPS, Surprise %, Revenue, Est. Revenue
- **Conference**: Date Announcement, Time, Symbol, Name*, Event*, Session, Confirmed
- **Dividend**: Date Announcement, Time, Symbol, Name*, Event*, Session, Confirmed
- **Analyst Rating**: Date Announcement, Time, Symbol, Name*, Event*, Analyst Firm, Analyst Name, Action, Prior Rating, Rating, Prior PT, Price Target, Confirmed

(\*Name and Event columns are hidden by default but can be toggled via Columns menu)

#### Toolbar layout

- Tab buttons (Earnings / Conference / Dividend / Analyst Rating)
- Search input | Date range (react-datepicker From/To) | Columns selector (Settings2 icon) | Reset button (orange, visible when filters active)
- Quick filter chips: Session, Period (earnings only), Action (analyst_rating only), Confirmed

#### Column features

All visible columns support:

- **Drag reorder**: HTML5 drag and drop on column headers (GripVertical icon handle).
- **Click sort**: Three-state cycle (asc -> desc -> none). ChevronUp/ChevronDown icons.
- **Drag resize**: Mousedown on right edge of column header. Min width: 60px.
- **Visibility toggle**: Via Columns dropdown menu (checkbox per column).

#### Filtering

- Search: filters by ticker, name, event, analystFirm, analystName.
- Date range: `dateFrom` / `dateTo` filtering.
- Session filter: multi-select (pre-market, market-hours, after-market).
- Period filter: multi-select (Q1, Q2, Q3, Q4) - earnings tab only.
- Action filter: multi-select (Buy, Sell, Hold, etc.) - analyst_rating tab only.
- Confirmed filter: radio (All / Confirmed / Unconfirmed).

#### Special cell rendering

- **Ticker**: Blue chip button, triggers `onTickerClick`.
- **Action**: Color-coded badge (green: Buy/Outperform/Overweight, red: Sell/Underperform, gray: Hold/Neutral).
- **Confirmed**: Green checkmark (confirmed) or gray circle (unconfirmed).
- **Surprise %**: Green for positive, red for negative.
- **Revenue/Est. Revenue**: Formatted as `$X.XM`.
- **Price Target/Prior PT**: Formatted as `$X,XXX`.

#### Footer

Shows `"Showing X of Y events"` count.

---

### Types

File: `src/app/types.ts`

| Type              | Description                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `WindowType`      | `'news' \| 'watchlist' \| 'calendar' \| 'brave-news'`                                         |
| `NewsItem`        | News article with id, publishedAt, time, ticker[], title, source, url, date, content          |
| `WatchlistItem`   | Stock with ticker, name, price, change, changePercent, marketCap?, industry?                  |
| `CalendarEvent`   | Event with full earnings/dividend/conference/analyst_rating fields                            |
| `NewsFilter`      | Date range + marketCap[] + source[] + sector[]                                                |
| `BraveNewsItem`   | News with single ticker, abstract, change metrics (chg%, open%, 7/14/30 day), nextEarningDate |
| `BraveNewsFilter` | Date range + marketCapMin/Max + industry[]                                                    |
| `SavedSearch`     | Saved search with name, query, and NewsFilter                                                 |
| `WindowInstance`  | Window with id, type, title, linkId, position                                                 |
| `TabData`         | Tab with id, name, windows[]                                                                  |

### Mock Data

File: `src/app/mockData.ts`

- `mockNewsData`: 12 news items (used by NewsWindow only as fallback reference; actual data comes from backend).
- `mockWatchlistData`: 7 stock items (TSLA, AAPL, GOOGL, MSFT, NVDA, AMZN, META).
- `mockCalendarData`: 12 calendar events (earnings, conferences, dividends, analyst ratings).
- `filterNewsByQuery()`: Boolean search helper (AND/OR logic).
- `groupNewsByDate()`: Groups news items by date into a Map.

### File map

- `src/app/App.tsx` -- tabs, dark mode, window linking, window layout, top bar
- `src/app/types.ts` -- all TypeScript type/interface definitions
- `src/app/mockData.ts` -- watchlist/calendar/news mock datasets + helper functions
- `src/app/components/DraggableWindow.tsx` -- window chrome (title bar, drag, resize, maximize/minimize/close)
- `src/app/components/AddTabModal.tsx` -- modal to choose windows and start a new tab
- `src/app/components/NewsWindow.tsx` -- backend-backed news feed + EODHD ingestion triggers + virtualization + boolean search + save/load
- `src/app/components/BraveNewsWindow.tsx` -- mock Brave API news feed + virtualization + column drag/resize/sort + display mode + save/load + filter (market cap + industry)
- `src/app/components/WatchlistWindow.tsx` -- mock watchlist + ticker add/delete + select mode + watchlist management + column resize
- `src/app/components/CalendarWindow.tsx` -- mock calendar + 4-tab type view + column drag/resize/sort/visibility + multi-filter
- `vite.config.ts` -- dev proxy to backend

### Current implementation status

| Feature           | NewsWindow              | BraveNewsWindow           | WatchlistWindow   | CalendarWindow         |
| ----------------- | ----------------------- | ------------------------- | ----------------- | ---------------------- |
| Backend API       | Yes (localhost:8080)    | No (mock)                 | No (mock)         | No (mock)              |
| Virtualization    | react-window            | react-window              | Native scroll     | Native table           |
| Column resize     | Yes (drag handle)       | Yes (drag handle)         | Yes (drag handle) | Yes (drag handle)      |
| Column reorder    | No                      | Yes (drag & drop)         | No                | Yes (drag & drop)      |
| Column sort       | No                      | Yes (3-state)             | No                | Yes (3-state)          |
| Column visibility | No                      | No                        | No                | Yes (checkbox menu)    |
| Search            | Boolean AND/OR          | Simple text               | N/A               | Simple text            |
| Date filter       | Yes (react-datepicker)  | Yes (native input)        | N/A               | Yes (react-datepicker) |
| Save/Load         | Yes                     | Yes                       | N/A               | N/A                    |
| Infinite scroll   | Yes (cursor pagination) | No                        | N/A               | N/A                    |
| Refresh/Update    | N/A                     | Placeholder (console.log) | N/A               | N/A                    |

### Change requests (how to ask for edits)

When requesting changes to the News window, specify:

- Whether it's only a UI change, or requires backend/API changes.
- Whether it affects virtualization row heights (and what the new expected heights are).
- Whether it should change the progressive pulling strategy (`offset` chunking) and why.
- Any constraints on max network calls, responsiveness, and how quickly the first page must render.

---

## KO

### 목적

이 문서는 현재 프로젝트의 Figma 기반 프런트엔드에 대한 프롬프트/스펙입니다.

이 UI는 벤징가(Benzinga) 스타일의 주식 뉴스 플랫폼으로, React + TypeScript + Tailwind CSS 기반의 "탭 + 드래그 가능한 윈도우"로 구성된 터미널 스타일 작업 공간입니다. News, Brave News, Watchlist, Calendar 4종의 윈도우를 열고, 이동/리사이즈하고, 티커 심볼로 연결할 수 있습니다.

현재 실제 데이터 연동 상태:

- **News** 윈도우는 백엔드 SQLite 피드를 `GET /api/news`로 읽고, `POST /api/news/pull-eodhd`로 EODHD 히스토리 적재를 트리거할 수 있습니다.
- **Brave News** / **Watchlist** / **Calendar** 윈도우는 아직 로컬 mock 데이터를 사용합니다(백엔드 호출 없음).

제약:

- 요청되지 않은 페이지/모달/필터를 추가하지 않기
- 새로운 컬러/테마 토큰을 하드코딩하지 않기(현재 Tailwind 사용 방식 유지)
- News 윈도우에 mock 뉴스 생성/데모 폴백을 다시 넣지 않기

### 기술 스택

- **React 18** + **TypeScript** (Vite 번들러)
- **Tailwind CSS v4** 스타일링
- **re-resizable** 윈도우 리사이즈
- **react-window** 가상화 리스트 (News, Brave News)
- **react-datepicker** 날짜 범위 선택
- **lucide-react** 아이콘
- **date-fns** 날짜 유틸리티
- 다크 모드: `<html>`에 `dark` 클래스 토글

### 실행 방법 (dev)

사전조건:

- 백엔드가 `http://localhost:8080`에서 실행 중
- EODHD 뉴스 pull을 위해 레포 루트에 `EODHD/API TOKEN` 파일 존재

프로젝트 루트에서:

1. 의존성 설치

```bash
npm install
```

2. Vite dev 서버 실행

```bash
npm run dev
```

Vite 프록시(`vite.config.ts`):

- `/api/*` -> `http://localhost:8080`
- `/healthz` -> `http://localhost:8080`

따라서 프런트에서는 `fetch('/api/...')` 형태로 포트 하드코딩 없이 호출합니다.

---

### UI 구조(요약)

#### 탭 + 윈도우

파일: `src/app/App.tsx`

동작:

- `tabs: TabData[]` 상태를 유지하며, 각 탭은 `windows: WindowInstance[]`를 가집니다.
- `AddTabModal`로 탭을 추가합니다 (Calendar, News, News Feed: Brave API, Watch List 체크박스 선택).
- 탭은 우클릭 시 이름 편집 상태로 들어가 rename 가능합니다.
- 탭 닫기는 가능하지만 "마지막 탭"은 닫지 않습니다.

윈도우 인스턴스:

- `handleStartTab(selectedWindows: WindowType[])`에서 생성
- `id`, `type`, `title`, `linkId`, `position`을 포함
- 배치: 1개=전체 크기, 2개=좌우 나란히, 3개+=계단식 배치

#### DraggableWindow 래퍼

파일: `src/app/components/DraggableWindow.tsx`

- 각 윈도우 콘텐츠를 리사이즈+드래그 가능한 컨테이너로 감쌈
- `re-resizable`(`Resizable`)로 8방향 리사이즈
- 타이틀 바가 드래그 핸들 (mousedown으로 드래그 시작)
- 최대화/최소화 토글, 닫기 버튼
- `window.type`에 따라 적절한 콘텐츠 컴포넌트 렌더링

#### 티커로 윈도우 연결

파일: `src/app/App.tsx`

개념:

- 각 윈도우에는 `linkId`가 있으며(현재 기본값 1), 같은 `linkId`를 공유하는 윈도우는 티커를 공유할 수 있습니다.
- 어떤 윈도우에서 티커를 클릭하면 `onTickerClick(ticker, linkId)`를 통해 상위로 전달합니다.
- `App`은 `linkedTicker[linkId] = ticker`로 저장하고, 연결된 윈도우에 `initialTicker`로 내려줍니다.

즉 Watchlist에서 티커 클릭 -> News 검색창 초기값 반영 같은 흐름이 가능합니다.

#### 다크 모드

파일: `src/app/App.tsx`

- `isDarkMode`가 `document.documentElement`에 `dark` 클래스를 붙였다 떼는 방식입니다.
- 상단 바에 Sun/Moon 아이콘.

---

### News 윈도우(백엔드 실데이터)

파일: `src/app/components/NewsWindow.tsx`

#### 데이터 흐름 개요

News 윈도우는 mock 뉴스를 렌더링하지 않습니다.

대신 아래 흐름으로 동작합니다.

1. (마운트 시) "오늘" 범위에 대해 EODHD -> SQLite 적재를 가볍게 한 번 시도
   - `POST /api/news/pull-eodhd`에 `{ date: <today>, symbol: "", limit: 200, offset: 0, fetch_all: false }`
   - 실패해도 UI는 계속 동작(콘솔 warning)
2. 화면 렌더링은 항상 SQLite에서 읽음
   - `GET /api/news?source_names=EODHD&limit=200&from=...&to=...&cursor=...`
3. 날짜 범위가 선택되면, 스크롤 진행에 따라 EODHD에서 해당 범위를 **offset 기반으로 chunk 단위**로 점진적으로 pull

중요: **UI는 항상 `GET /api/news`(SQLite)로 렌더링합니다.** EODHD pull은 "적재(ingestion)" 액션입니다.

#### 툴바 레이아웃

- 1행: 검색 입력 (불리언 AND/OR 지원) | Filters 버튼 | Save 버튼
- 저장된 검색 드롭다운 (저장된 검색이 있을 때만 표시)
- 필터 패널 (접이식): Date Range (react-datepicker) | Market Cap 토글 | Source 토글

#### 컬럼 정의 (리사이즈 가능)

| 컬럼 ID | 라벨       | 기본 폭 | 최소 폭 |
| ------- | ---------- | ------- | ------- |
| time    | Time       | 80px    | 50px    |
| ticker  | Ticker     | 100px   | 60px    |
| title   | News Title | 300px   | 100px   |
| source  | Source     | 140px   | 60px    |

모든 컬럼은 컬럼 경계 핸들을 mousedown하여 드래그 리사이즈 가능.

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

목표는 "전부 다 다운될 때까지 빈 화면"을 방지하는 것입니다.

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

가상화는 "행 높이"를 신뢰하므로, 콘텐츠가 wrap되어 예기치 않게 높이가 늘면 겹침 문제가 생길 수 있습니다.

따라서 아래처럼 구성되어 있습니다.

- 티커 칩은 가로 1줄 + `overflow-x-auto` + `whitespace-nowrap`
- 타이틀은 접힘 상태에서 ellipsis 처리
- URL은 truncate 처리

---

### Brave News 윈도우(mock 데이터)

파일: `src/app/components/BraveNewsWindow.tsx`

Brave Search API 연동을 위한 보조 뉴스 피드 윈도우입니다 (현재 mock 데이터만 사용).

#### 데이터 소스

- 마운트 시 `generateMockData()`로 50개 mock 뉴스 아이템 생성
- Mock 데이터 포함: title, abstract, ticker, source, 변동률(Chg%, fr.Open%, +7D%, +14D%, +30D%), 선택적 nextEarningDate

#### 툴바 레이아웃 (2행)

**1행:** 검색바 | Refresh 아이콘 버튼(`RotateCw`) | Update 텍스트 버튼 | Save 버튼 | Load 드롭다운 | Filter 드롭다운

- **검색바**: 제목과 티커로 텍스트 필터링
- **Refresh 버튼**: `RotateCw` 아이콘만 있는 버튼. 현재 placeholder (console.log만 출력)
- **Update 버튼**: "Update" 텍스트 버튼. 현재 placeholder (console.log만 출력)
- **Save 버튼**: 현재 검색 쿼리 + 필터를 사용자 정의 이름으로 저장하는 모달 열기
- **Load 드롭다운**: 저장된 검색 목록. 각 항목에 삭제(x) 버튼 (hover 시 표시)
- **Filter 드롭다운**: Market Cap 필터 (커스텀 Min/Max 입력 + 프리셋 버튼: Mega 200B+, Large 10-200B, Mid 2-10B, Small 300M-2B, Micro <300M) 및 Industry 필터 (체크박스: Technology, Finance, Healthcare, Energy, Consumer, Industrial). "Clear Filters" 버튼 포함.

**2행:** Date 범위 입력 (네이티브 `<input type="date">`) | Display Mode 드롭다운 (`Title Only` / `Title + Abstract`) | Watch Lists 드롭다운

- **Display Mode**: 두 가지 옵션:
  - `Title Only`: 제목만 표시; 제목 클릭으로 개별 아이템의 abstract 펼침/접힘 토글
  - `Title + Abstract`: 모든 아이템에 대해 항상 abstract 표시
- **Watch Lists**: 정적 드롭다운 (All, Tech Stocks, My Portfolio, High Volume)

#### 컬럼 정의 (드래그 이동, 정렬, 리사이즈 가능)

| 컬럼 ID | 라벨      | 기본 폭 | 최소 폭 | 비고                                               |
| ------- | --------- | ------- | ------- | -------------------------------------------------- |
| date    | Date      | 72px    | 50px    |                                                    |
| time    | Time      | 52px    | 40px    |                                                    |
| title   | Title     | 300px   | 100px   | flex                                               |
| source  | Sources   | 90px    | 50px    |                                                    |
| changes | Changes % | 280px   | 160px   | 멀티라인: Chg/fr.Open/+7D, +14D/+30D, Earning date |

모든 컬럼 지원:

- **드래그 순서 변경**: 헤더 드래그로 컬럼 위치 재배치 (HTML5 drag and drop)
- **클릭 정렬**: 헤더 클릭으로 asc -> desc -> none 순환
- **드래그 리사이즈**: 컬럼 경계 핸들 mousedown으로 폭 조절

#### 정렬

- 3단계 순환: 오름차순 -> 내림차순 -> 해제
- 정렬 아이콘: `ArrowUp` (asc), `ArrowDown` (desc)
- 정렬 값: date는 `publishedAt`, changes는 `openChange` 사용

#### 가상화 렌더링

- `react-window` `VariableSizeList` 사용
- 행 높이:
  - 날짜 헤더: 32px (`STICKY_DATE_HEADER_HEIGHT`)
  - Title-only 모드 (접힘): 88px
  - Title+Abstract 모드 또는 펼침: 140px
- 뉴스를 날짜별로 그룹핑하여 날짜 헤더 행 삽입
- 리스트 높이는 `ResizeObserver`로 동적 측정

#### Changes % 컬럼 상세

주가 변동 지표를 컴팩트 멀티라인 레이아웃으로 표시:

- 1줄: `Chg: +X.XX% | fr.Open: +X.XX% | +7D: +X.XX%`
- 2줄: `+14D: +X.XX% | +30D: +X.XX%`
- 3줄 (선택): `Earning: YYYY-MM-DD` (파란 텍스트, `nextEarningDate` 있을 때만)

색상: 양수=초록, 음수=빨강, 0/미정의=회색

#### 검색 설정 저장/불러오기

- Save: 이름 입력 모달. `{id, name, searchQuery, filters}`를 컴포넌트 상태에 저장.
- Load: 저장된 검색 드롭다운. 각 항목에 삭제(x) 버튼 (hover 시 표시).
- 기본 저장 검색 2개 미리 포함: "Tech Large Cap", "Healthcare"

#### 메뉴 (외부 클릭 닫기)

모든 드롭다운 메뉴(Filter, Load, Watch Lists, Display Mode)는 외부 클릭 시 닫힘. `mousedown` 이벤트 리스너와 ref 기반 containment 체크로 구현.

---

### Watchlist 윈도우(mock 데이터)

파일: `src/app/components/WatchlistWindow.tsx`

#### 데이터 소스

- `src/app/mockData.ts`의 `mockWatchlistData` 사용 (7개: TSLA, AAPL, GOOGL, MSFT, NVDA, AMZN, META)
- 추가 티커는 `TICKER_DB` 조회로 추가 가능 (IONQ, AMD, PLTR, SOFI, RIVN, COIN, NFLX, BABA)

#### 툴바 레이아웃

단일 행: `"Watchlist"` 라벨 | 티커 입력 필드 | [+] 추가 버튼 | [Select] 토글 | [Delete] 버튼 (개수 표시) | [Watch Lists] 드롭다운

- **티커 입력**: 공백이나 콤마로 구분된 여러 티커 지원. Enter키 또는 [+] 버튼으로 추가. 붙여넣기 지원.
- **Select 모드**: 체크박스 선택 모드를 활성화하는 토글 버튼.
- **Delete**: 선택된 티커 일괄 삭제. 선택 없으면 비활성(회색). 개수 표시 `Delete (N)`.
- **Watch Lists 드롭다운**: 사용 가능한 워치리스트 목록 (Default, Tech Stocks, My Portfolio). 지원:
  - 워치리스트 전환 (해당 티커 로드)
  - 인라인 이름 변경 (연필 아이콘 -> 텍스트 입력 + 확인/취소)
  - 새 워치리스트 생성 (+ New Watch List -> 텍스트 입력 + 확인/취소)
  - 활성 워치리스트 파란색 하이라이트

#### 컬럼 정의 (리사이즈 가능)

| 컬럼 ID  | 라벨     | 기본 폭 | 최소 폭 | 정렬  |
| -------- | -------- | ------- | ------- | ----- |
| ticker   | Ticker   | 64px    | 40px    | left  |
| name     | Name     | 160px   | 60px    | left  |
| mktcap   | Mkt Cap  | 72px    | 48px    | left  |
| industry | Industry | 80px    | 50px    | left  |
| price    | Price    | 72px    | 48px    | right |
| change   | Change   | 80px    | 50px    | right |
| percent  | %        | 60px    | 40px    | right |

모든 컬럼은 컬럼 경계 핸들을 mousedown하여 드래그 리사이즈 가능.

#### Select 모드 동작

- Select 모드 활성화 시 왼쪽에 체크박스 컬럼 표시 (폭: 32px)
- 헤더 체크박스로 전체 선택/해제
- 개별 행 체크박스로 티커별 선택 토글
- Select 모드에서 행 클릭 시 체크박스 토글 (onTickerClick 대신)
- 일반 모드에서 행 클릭 시 `onTickerClick` 트리거 (티커 링크)

#### 시각적 세부사항

- 티커 컬럼: 파란 텍스트 (`text-blue-600`)
- Change 컬럼: 초록+`TrendingUp` 아이콘 또는 빨강+`TrendingDown` 아이콘
- Percent 컬럼: 양수=초록, 음수=빨강
- 선택된 행: 연한 파랑 배경

---

### Calendar 윈도우(mock 데이터)

파일: `src/app/components/CalendarWindow.tsx`

#### 데이터 소스

- `src/app/mockData.ts`의 `mockCalendarData` 사용 (12개 이벤트, 4개 타입)

#### 탭 기반 레이아웃

4개 탭, 각각 고유 컬럼 구성:

- **Earnings**: Date Announcement, Time, Symbol, Name*, Event*, Session, Period, Confirmed, EPS, Est. EPS, Surprise %, Revenue, Est. Revenue
- **Conference**: Date Announcement, Time, Symbol, Name*, Event*, Session, Confirmed
- **Dividend**: Date Announcement, Time, Symbol, Name*, Event*, Session, Confirmed
- **Analyst Rating**: Date Announcement, Time, Symbol, Name*, Event*, Analyst Firm, Analyst Name, Action, Prior Rating, Rating, Prior PT, Price Target, Confirmed

(\*Name과 Event 컬럼은 기본 숨김이지만 Columns 메뉴에서 토글 가능)

#### 툴바 레이아웃

- 탭 버튼 (Earnings / Conference / Dividend / Analyst Rating)
- 검색 입력 | Date 범위 (react-datepicker From/To) | Columns 선택기 (Settings2 아이콘) | Reset 버튼 (오렌지, 필터 활성 시 표시)
- 퀵 필터 칩: Session, Period (earnings만), Action (analyst_rating만), Confirmed

#### 컬럼 기능

모든 표시 컬럼 지원:

- **드래그 순서 변경**: 헤더에서 HTML5 drag and drop (GripVertical 아이콘 핸들)
- **클릭 정렬**: 3단계 순환 (asc -> desc -> none). ChevronUp/ChevronDown 아이콘.
- **드래그 리사이즈**: 헤더 오른쪽 가장자리 mousedown. 최소 폭: 60px.
- **표시/숨김 토글**: Columns 드롭다운 메뉴 (컬럼별 체크박스)

#### 필터링

- 검색: ticker, name, event, analystFirm, analystName으로 필터
- 날짜 범위: `dateFrom` / `dateTo` 필터
- Session 필터: 다중 선택 (pre-market, market-hours, after-market)
- Period 필터: 다중 선택 (Q1, Q2, Q3, Q4) - earnings 탭만
- Action 필터: 다중 선택 (Buy, Sell, Hold 등) - analyst_rating 탭만
- Confirmed 필터: 라디오 (All / Confirmed / Unconfirmed)

#### 특수 셀 렌더링

- **Ticker**: 파란 칩 버튼, `onTickerClick` 트리거
- **Action**: 색상 코딩 배지 (초록: Buy/Outperform/Overweight, 빨강: Sell/Underperform, 회색: Hold/Neutral)
- **Confirmed**: 초록 체크마크(confirmed) 또는 회색 원(unconfirmed)
- **Surprise %**: 양수=초록, 음수=빨강
- **Revenue/Est. Revenue**: `$X.XM` 형식
- **Price Target/Prior PT**: `$X,XXX` 형식

#### 하단

`"Showing X of Y events"` 카운트 표시.

---

### 타입 정의

파일: `src/app/types.ts`

| 타입              | 설명                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| `WindowType`      | `'news' \| 'watchlist' \| 'calendar' \| 'brave-news'`                            |
| `NewsItem`        | 뉴스 기사: id, publishedAt, time, ticker[], title, source, url, date, content    |
| `WatchlistItem`   | 주식: ticker, name, price, change, changePercent, marketCap?, industry?          |
| `CalendarEvent`   | 이벤트: earnings/dividend/conference/analyst_rating 전체 필드                    |
| `NewsFilter`      | 날짜 범위 + marketCap[] + source[] + sector[]                                    |
| `BraveNewsItem`   | 뉴스: 단일 ticker, abstract, 변동 지표 (chg%, open%, 7/14/30일), nextEarningDate |
| `BraveNewsFilter` | 날짜 범위 + marketCapMin/Max + industry[]                                        |
| `SavedSearch`     | 저장된 검색: name, query, NewsFilter                                             |
| `WindowInstance`  | 윈도우: id, type, title, linkId, position                                        |
| `TabData`         | 탭: id, name, windows[]                                                          |

### Mock 데이터

파일: `src/app/mockData.ts`

- `mockNewsData`: 12개 뉴스 아이템 (NewsWindow에서는 백엔드 데이터 사용; 참조용)
- `mockWatchlistData`: 7개 주식 아이템 (TSLA, AAPL, GOOGL, MSFT, NVDA, AMZN, META)
- `mockCalendarData`: 12개 캘린더 이벤트 (earnings, conferences, dividends, analyst ratings)
- `filterNewsByQuery()`: 불리언 검색 헬퍼 (AND/OR 로직)
- `groupNewsByDate()`: 뉴스를 날짜별로 Map에 그룹핑

### 파일 맵

- `src/app/App.tsx` -- 탭, 다크모드, 윈도우 링크, 레이아웃, 상단 바
- `src/app/types.ts` -- 모든 TypeScript 타입/인터페이스 정의
- `src/app/mockData.ts` -- watchlist/calendar/news mock 데이터 + 헬퍼 함수
- `src/app/components/DraggableWindow.tsx` -- 윈도우 크롬 (타이틀 바, 드래그, 리사이즈, 최대화/최소화/닫기)
- `src/app/components/AddTabModal.tsx` -- 윈도우 선택 후 새 탭 시작 모달
- `src/app/components/NewsWindow.tsx` -- 백엔드 뉴스 + EODHD 적재 트리거 + 가상화 + 불리언 검색 + 저장/불러오기
- `src/app/components/BraveNewsWindow.tsx` -- mock Brave API 뉴스 + 가상화 + 컬럼 드래그/리사이즈/정렬 + 디스플레이 모드 + 저장/불러오기 + 필터 (market cap + industry)
- `src/app/components/WatchlistWindow.tsx` -- mock 워치리스트 + 티커 추가/삭제 + 선택 모드 + 워치리스트 관리 + 컬럼 리사이즈
- `src/app/components/CalendarWindow.tsx` -- mock 캘린더 + 4탭 타입 뷰 + 컬럼 드래그/리사이즈/정렬/표시 + 다중 필터
- `vite.config.ts` -- 백엔드 프록시

### 현재 구현 상태

| 기능           | NewsWindow             | BraveNewsWindow           | WatchlistWindow  | CalendarWindow        |
| -------------- | ---------------------- | ------------------------- | ---------------- | --------------------- |
| 백엔드 API     | 예 (localhost:8080)    | 아니오 (mock)             | 아니오 (mock)    | 아니오 (mock)         |
| 가상화         | react-window           | react-window              | 네이티브 스크롤  | 네이티브 table        |
| 컬럼 리사이즈  | 예 (드래그 핸들)       | 예 (드래그 핸들)          | 예 (드래그 핸들) | 예 (드래그 핸들)      |
| 컬럼 순서 변경 | 아니오                 | 예 (drag & drop)          | 아니오           | 예 (drag & drop)      |
| 컬럼 정렬      | 아니오                 | 예 (3단계)                | 아니오           | 예 (3단계)            |
| 컬럼 표시/숨김 | 아니오                 | 아니오                    | 아니오           | 예 (체크박스 메뉴)    |
| 검색           | 불리언 AND/OR          | 단순 텍스트               | N/A              | 단순 텍스트           |
| 날짜 필터      | 예 (react-datepicker)  | 예 (네이티브 input)       | N/A              | 예 (react-datepicker) |
| 저장/불러오기  | 예                     | 예                        | N/A              | N/A                   |
| 무한 스크롤    | 예 (커서 페이지네이션) | 아니오                    | N/A              | N/A                   |
| Refresh/Update | N/A                    | Placeholder (console.log) | N/A              | N/A                   |

### 변경 요청 가이드

News 윈도우 변경을 요청할 때는 아래를 명시해 주세요.

- UI만 변경인지, 백엔드/API 변경이 필요한지
- 가상화 행 높이/레이아웃에 영향을 주는지(새 높이 값 포함)
- offset 기반 progressive pull 전략을 바꿔야 하는지/왜 필요한지
- 네트워크 호출 수/초기 렌더 속도/반응성에 대한 요구사항