# Figma Frontend Prompt

## 목적
이 문서는 `termina_web/figma_code/terminal_ui_ver2_finhub/`의 현재 구현을 기준으로 한 프론트엔드 작업용 프롬프트/스펙이다. 별도 plan 문서 없이도 이 문서만 읽으면, 어떤 창이 실제 동작하고 어떤 창이 아직 목업/스텁인지, 어떤 백엔드 API를 어떤 방식으로 호출하는지 바로 알 수 있어야 한다.

## 현재 구현 상태 요약

- 앱은 React + TypeScript + Vite 기반이다.
- 창(window) 기반 데스크톱 스타일 UI이며, 각 창은 드래그/리사이즈/최대화/닫기를 지원한다.
- 실제 API 연동이 살아 있는 주요 창은 `Finnhub News`, `Default Ticker`, `Data Control` 이다.
- `News` 창은 EODHD 적재/조회 로직이 일부 연결되어 있지만 완성형은 아니다.
- `Watchlist`, `Calendar` 창은 현재 mock data 기반이다.
- `BraveNewsWindow.tsx` 파일은 남아 있지만 현재 `WindowType`에 연결되어 있지 않아 UI에서 열 수 없다.
- API 호출 base는 빈 문자열 `""` 이고, dev 환경에서는 Vite proxy가 `/api`, `/healthz`를 `http://localhost:8080`으로 보낸다.

## 실행

프론트 디렉터리에서 실행한다.

```bash
npm install
npm run dev
```

빌드:

```bash
npm run build
```

전제:

- 백엔드 `terminal/backend` 가 `http://localhost:8080`에서 실행 중이어야 한다.

Vite dev proxy:

- `/api/*` → `http://localhost:8080`
- `/healthz` → `http://localhost:8080`

즉 현재 프론트 컴포넌트들은 `fetch('/api/...')` 형태로 동작한다.

## 앱 셸 구조

### 진입점

- `src/main.tsx` → `src/app/App.tsx`

### 상단 바

- 앱 제목: `Stock News Platform`
- 다크 모드 토글 제공
- 다크 모드는 `document.documentElement.classList`을 바꾸고 `terminal-workspace-v1`에 저장된다.

### 탭 구조

- 기본 탭 1개로 시작
- `+` 버튼으로 `AddTabModal` 오픈
- 탭 우클릭 시 inline rename
- 탭을 drag 해서 순서를 바꿀 수 있다.
- 탭이 2개 이상일 때만 닫기 버튼 노출

### 창(window) 공통 동작

각 창은 `DraggableWindow.tsx`에서 공통 처리한다.

- 드래그 이동
- 가장자리/모서리 리사이즈
- 최대화/복원
- 닫기
- `linkId` badge 표시

## WindowType

현재 `src/app/types.ts`의 실제 window type:

- `news`
- `watchlist`
- `calendar`
- `finhub-news`
- `default-ticker`
- `data-control`

`brave-news`는 타입 정의에 없다. 즉 파일은 있지만 앱에서 선택/렌더링되지 않는다.

## Add Tab Modal

`AddTabModal.tsx`에서 선택 가능한 창:

- Calendar
- News
- News Feed: Finnhub API
- Watch List
- Default Ticker
- Data Control

초기 창 배치 규칙:

- 1개 창: `800x600`
- 2개 창: 좌우 분할 `600x600`
- 3개 이상: 계단식 배치

기본 창 제목:

- `finhub-news` → `News Feed: Finnhub API`
- `default-ticker` → `Default Ticker`
- `data-control` → `Data Control`
- 나머지 → `<Type> Window`

## 창 연결(linked ticker)

`App.tsx`는 `linkedTicker` 상태를 유지한다.

- 어떤 창에서 ticker를 클릭하면 같은 `linkId`를 가진 다른 창으로 ticker 문자열을 전달할 수 있다.
- 현재 `FinnhubNewsWindow`, `NewsWindow`, `WatchlistWindow`, `DefaultTickerWindow` 쪽에서 이 패턴을 일부 사용한다.

## Finnhub News Window

파일: `src/app/components/FinnhubNewsWindow.tsx`

이 창이 현재 프론트에서 가장 구현이 많이 진행된 핵심 창이다.

### 데이터 로드

백엔드 호출:

```text
GET /api/news?source_names=FINNHUB&limit=500
```

추가 query:

- `keyword`
- `source_type` (`company_news | press_release | market_news`)
- `tickers` (ticker 전용 검색, 예: `AAPL,TSLA`)
- `from`, `to` (YYYY-MM-DD 날짜 범위 필터)
- `bookmarkFolderId` (북마크 폴더 필터)
- `cursor` (cursor 기반 페이지네이션)

검색은 서버사이드다.

- 입력창 300ms debounce
- `keyword`를 그대로 backend로 보냄
- 최초 결과 500건, cursor 기반으로 하단 스크롤 시 자동 append
- 리스트 하단에 `Load more` 버튼 제공
- `react-window`의 `onItemsRendered`로 sentinel row 감지 시 자동 추가 로드

### 검색 UI

검색 영역은 3줄 구조다:

1. 일반 keyword 검색창 (돋보기 아이콘)
2. Ticker 전용 검색창 (TrendingUp 아이콘)
3. From / To 날짜 입력 (Calendar 아이콘)

각 검색 필드 변경 시 300ms debounce 후 자동 재조회한다.

### 테이블 컬럼

정의된 컬럼:

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

기본 visible 상태:

- 기본 숨김: `source`, `keywords`, `score`, `scoreEvidence`, `sentiment`
- 나머지는 기본 표시

score/scoreEvidence/sentiment 컬럼 규칙:

- `score`: `news_ai_analysis.score` 값. `null`이면 빈 셀.
- `scoreEvidence`: `news_ai_analysis.score_evidence` 값.
- `sentiment`: `sentimentBullishPct` 기반 파생. >0.6 → "Bullish", <0.4 → "Bearish", else "Neutral". sentiment snapshot이 없으면 빈 셀.

### 정렬/가시화/레이아웃

- 컬럼 헤더 클릭 정렬 `asc → desc → null`
- 컬럼 드래그 재정렬
- 컬럼 리사이즈
- 컬럼 표시/숨김 메뉴
- `react-window` 기반 가상 스크롤
- 날짜 그룹 sticky header
- display mode
  - `title-only`
  - `title-abstract`

행 높이:

- title only: 88px
- title + abstract: 140px

### 소스 필터

상단 버튼:

- `All`
- `Company News`
- `Press Release`
- `Market News`

상태값:

- `all`
- `company_news`
- `press_release`
- `market_news`

### Update 메뉴

Finnhub 뉴스 적재는 직접 API response를 표에 그리지 않고, backend DB 적재 job을 시작한 뒤 job 완료 후 다시 `GET /api/news`를 호출하는 구조다.

메뉴 항목:

- 7d Update
  - All
  - Company News
  - Press Release
  - Market News
- Recent Update
  - All
  - Company News
  - Press Release
  - Market News
- Custom Update
  - All
  - Company News
  - Press Release
  - Market News

관련 API:

- `GET /api/news/pull-finhub/preflight?sourceType=...`
- `POST /api/news/pull-finhub`
- `GET /api/jobs/:jobId`

`recent`를 시작하면 preflight modal이 먼저 열리고, 기존 데이터가 없는 fallback ticker 수를 보여준다.

Recent Update 섹션 바로 아래에 automatic recent retry 정책 설명이 작은 보조 문구로 항상 표시된다.

보조 문구 핵심 내용:

- confirmed-empty 과거 구간은 automatic recent retry에서 영구 스킵
- HTTP 200 + 실제 빈 배열일 때만 confirmed-empty로 기록
- `company_news`, `press_release`는 분리 기록
- 당일 범위는 영구 스킵에서 제외
- 강제 재조회가 필요하면 `Custom Update` 사용

custom update는 별도 날짜 선택 modal에서 `from/to`를 입력한 뒤 시작한다.

### Change Update 버튼

Finnhub News 창 안에도 change 계산 버튼이 있다.

- `7D Change Update` → `POST /api/news/change/update-recent`
- `Custom Change% Update` → 날짜 modal 후 `POST /api/news/change/update-custom`

이 버튼들은 Data Control 창의 change update와 같은 backend job을 재사용한다.

### Full Text 기능

표의 Full Text 셀:

- 값 `O`: `hasFullText=true`
- 값 `X`: full text 없음
- `O` 클릭 시 `GET /api/news/fulltext/:newsId`로 본문 modal 오픈

상단에는 별도 Full Text Update 메뉴가 있다.

메뉴 항목:

- All
- Company News
- Press Release
- Market News

API:

- `POST /api/news/fulltext/update`

### Log 패널

- `View Log` 버튼은 항상 보이지만 job이 없으면 disabled
- update 시작 시 로그 패널이 자동 오픈되지는 않는다
- 사용자가 직접 `View Log`를 눌러야 하단 패널이 열린다
- `Esc`로 닫기 가능
- 진행률 bar, 상태 badge, 로그 줄, 완료 result 표시

### 북마크 기능

#### Bookmark view

검색창 근처에 `FolderOpen` 아이콘 버튼으로 bookmark view 선택 메뉴를 연다.

- 메뉴에는 `All news` 옵션과 backend에서 받아온 북마크 폴더 목록이 표시된다.
- 폴더를 선택하면 `bookmarkFolderId` query로 해당 폴더 뉴스만 조회한다.
- `All news` 선택 시 전체 뉴스로 복귀한다.
- 선택된 폴더 ID는 `selectedBookmarkFolderId`로 localStorage에 저장되며, 앱 재실행 후에도 복원된다.
- 복원된 folder ID가 존재하지 않으면 자동으로 초기화(All news)된다.
- 폴더 목록 아래 separator 후:
  - **\+ New folder** 버튼: 클릭하면 inline 텍스트 입력이 나타나고, 이름 입력 후 OK 또는 Enter로 `POST /api/bookmarks/folders` 호출하여 폴더를 생성한다. Escape로 취소.
  - **Bookmark Manager** 버튼: 클릭하면 북마크 관리 모달을 연다.

#### Bookmark Manager 모달

`BookmarkManager.tsx` 컴포넌트로 구현. 모달 형태로 열린다.

- **좌측 Folder sidebar**: 폴더 목록. 각 폴더에 hover 시 rename(Edit2)/delete(Trash2) 버튼 표시. 폴더를 클릭하면 해당 폴더의 아이템이 우측에 표시된다. 폴더 이름 수정은 inline 입력 + Check 아이콘으로 저장.
- **우측 Items panel**: 선택된 폴더의 북마크 아이템 목록. 각 아이템은 ticker + title + bookmarked_at을 줄임 표시. GripVertical 아이콘으로 드래그 시작.
- **드래그 이동**: 아이템을 좌측 다른 폴더로 드래그 → drop하면 `PATCH /api/bookmarks/items/move`로 폴더 간 이동.
- **우클릭 컨텍스트 메뉴**: 아이템 우클릭 시 Copy / Cut / Paste / Delete 메뉴 표시.
  - Copy: 내부 clipboard에 newsId + folderId + mode='copy' 저장
  - Cut: 내부 clipboard에 newsId + folderId + mode='cut' 저장
  - Paste: clipboard 내용을 현재 폴더에 복사(copy) 또는 이동(cut)
  - Delete: `DELETE /api/bookmarks/items`로 해당 아이템 삭제
- Paste 가능 시 Items 헤더 영역에 "Paste here (copy/cut)" 버튼도 표시된다.

#### Row 우클릭 북마크

- 뉴스 row를 우클릭하면 컨텍스트 메뉴가 뜨고 `Copy ID`와 `Add bookmark` 선택지가 보인다.
- `Copy ID`를 누르면 해당 뉴스의 `news_id` 문자열이 clipboard로 복사된다.
- 폴더를 선택하면 `POST /api/bookmarks/items`로 해당 뉴스를 폴더에 저장한다.

관련 API:

- `GET /api/bookmarks/folders`
- `POST /api/bookmarks/folders`
- `PUT /api/bookmarks/folders/:id` (rename)
- `DELETE /api/bookmarks/folders/:id`
- `POST /api/bookmarks/items`
- `DELETE /api/bookmarks/items`
- `GET /api/bookmarks/folders/:folderId/items` (title/ticker enriched)
- `PATCH /api/bookmarks/items/move` (폴더 간 이동)

주의: `news_saved_views`는 검색 조건 저장용 평면 리스트이고, bookmark은 개별 뉴스 row를 폴더에 저장하는 구조다. 둘을 혼동하지 않는다.

### Source / Publisher 클릭 동작

- Publisher 셀은 링크 열기 용도
- Source 셀도 링크 열기와 우클릭 `Copy URL` 컨텍스트 메뉴 지원
- Source 컬럼은 기본 hidden 상태

### Ticker 클릭 동작

- ticker badge 클릭 시 현재 검색어를 그 ticker로 바꾼다
- 동시에 `onTickerClick`이 있으면 상위로 전달한다

### 저장 상태

localStorage 사용:

- key: `finnhub-last-update-config`
- 저장 값: 마지막 update의 `mode`, `sourceType`

저장되는 것:

- `finhub-news-ui-state`: `visibleCols`, `displayMode`, `sourceTypeFilter`, `fromDate`, `toDate`, `selectedBookmarkFolderId`
- `terminal-workspace-v1`: 탭 순서, 탭/창 레이아웃, `isDarkMode`, `fontScale`, `newsTitleFontSize`, `newsSummaryFontSize`, `linkedTicker`
- `data-control-active-tab`: DataControl Settings 탭 상태

저장되지 않는 것:

- Finnhub News의 일반 keyword 검색어와 ticker 검색어는 새로고침 후 복원하지 않는다. 새로고침 시 검색창은 빈 상태에서 시작한다.

- saved searches는 component state만 사용한다
- `nextCursor`, 누적 로드 페이지, in-flight loading 상태는 저장하지 않는다

### Finnhub News 창이 기대하는 뉴스 응답 컬럼

현재 렌더에서 실제 사용하는 필드:

- `[][][]id[][][]`
- `[][][]published_at[][][]`
- `[][][]source[][][]`
- `[][][]publisher[][][]`
- `[][][]source_type[][][]`
- `[][][]title[][][]`
- `[][][]body[][][]`
- `[][][]url[][][]`
- `[][][]tickers[][][]`
- `[][][]change_1d_pct[][][]`
- `[][][]change_from_open_pct[][][]`
- `[][][]change_7d_pct[][][]`
- `[][][]change_14d_pct[][][]`
- `[][][]change_30d_pct[][][]`
- `[][][]hasFullText[][][]`
- `[][][]keywords[][][]`
- `[][][]keywordsStatus[][][]`
- `[][][]industry[][][]`
- `[][][]score[][][]`
- `[][][]scoreEvidence[][][]`
- `[][][]analysisStatus[][][]`
- `[][][]sentimentBullishPct[][][]`
- `[][][]sentimentBearishPct[][][]`
- `[][][]companyNewsScore[][][]`

렌더 규칙:

- ticker는 `tickers[0]`만 사용
- publisher가 없으면 빈 값
- change 값이 `null`이면 `-`
- industry가 없으면 비어 보일 수 있음
- score가 `null`이면 빈 셀
- sentiment 파생: `sentimentBullishPct > 0.6` → Bullish, `< 0.4` → Bearish, else Neutral

## Data Control Window

파일: `src/app/components/DataControlWindow.tsx`

현재 이 창은 운영 버튼과 update status 보기용으로 실제 동작한다.

상단 탭:

- `Updates`
- `Settings`

### 로드 시 호출

- `GET /api/updates/status`
- `GET /api/ibkr/ohlc1d/status`

### 섹션

- `IBKR Price Data`
- `IBKR Calendar Data`
- `Recent Change% Update`
- `Custom Change% Update`

각 섹션은 아래를 가진다.

- Update 버튼
- Log 버튼
- Last Success 시각 표시
- 에러 표시

추가 정보:

- Price 섹션은 `DB Max Date` 표시
- Custom Change 섹션은 `from/to` date input 포함

### 호출 API

- `POST /api/ibkr/ohlc1d/update`
- `POST /api/ibkr/calendar/update`
- `POST /api/news/change/update-recent`
- `POST /api/news/change/update-custom`
- `GET /api/jobs/:jobId`

### 로그 패널

- 한 번에 한 섹션 로그만 표시
- `View Log`를 눌렀을 때만 열림
- 자동 스크롤
- `Esc`로 닫기 가능
- 완료 result는 ticker/row 수 또는 merged/skipped 수를 summary로 표시

주의:

- 프론트는 calendar update도 job처럼 polling UI를 기대하지만, 현재 backend `POST /api/ibkr/calendar/update`는 즉시 완료형 response다. 즉 `jobId`를 반환하지 않으므로 이 섹션의 현재 UI 기대와 backend 계약 사이에 불일치가 있다.

### Settings 탭

- 전역 `Font Size` preset + slider를 제공한다.
- News Feed 전용 typography control을 제공한다.
  - `Title Text`
  - `Summary Text`
- 위 두 값은 Control Window에서만 조정한다. News Feed 창 toolbar에는 별도 font size control이 없다.
- 저장 위치는 `terminal-workspace-v1`이며 앱 재실행 후에도 유지된다.

## Default Ticker Window

파일: `src/app/components/DefaultTickerWindow.tsx`

현재 이 창은 실제 CSV read/append가 연결되어 있다.

기본 CSV path:

- `tradigview_screener/original_data/watch lists2_2026-02-22.csv`

기능:

- CSV path 직접 수정
- Reload
- custom CSV를 default universe에 merge import (`Merge into Default`)
- ticker 추가
- filter 입력
- ticker grid 표시
- ticker 클릭 시 상위 `onTickerClick` 전달

API:

- `GET /api/tickers?csvPath=...`
- `POST /api/tickers/import-default`
- `POST /api/tickers/add`

현재 제약:

- 허용 경로는 backend allowlist에 의해 제한된다
- UI는 어떤 CSV든 입력 가능해 보이지만, backend가 허용하지 않으면 error banner를 보여준다
- custom CSV를 merge import해도 기존 default universe ticker는 제거되지 않고, 중복만 skip된다

## News Window

파일: `src/app/components/NewsWindow.tsx`

현재 상태는 부분 구현이다.

남아 있는 연결:

- `GET /api/news`
- `POST /api/news/pull-eodhd`

특징:

- EODHD pull offset 상태 관리가 있다
- refresh/pull 관련 state가 있으나 전체 UX가 현재 주력 창만큼 정리되어 있지 않다

이 창을 현재 운영 기준의 메인 뉴스 창으로 보지 않는다. 실제 주력은 `FinnhubNewsWindow` 이다.

## Watchlist Window

파일: `src/app/components/WatchlistWindow.tsx`

현재 상태:

- mock data only
- local state 위주
- API 연동 없음

컬럼 UI는 있지만 source of truth가 backend가 아니다.

## Calendar Window

파일: `src/app/components/CalendarWindow.tsx`

현재 상태:

- mock data only
- API 연동 없음
- earnings / conference / dividend / analyst_rating 탭 UI는 존재

즉 backend의 `calendar_events` API와 아직 연결된 화면이 아니다.

## Brave News Window

파일: `src/app/components/BraveNewsWindow.tsx`

현재 상태:

- 파일은 남아 있음
- mock data 생성 코드 존재
- refresh/update는 실 API 호출이 아니라 `console.log` 수준
- `WindowType`에 연결되어 있지 않아 실제 앱에서 열 수 없음

따라서 현재 프론트의 공식 동작 문서에서는 active window로 보지 않는다.

## 백엔드 계약 요약

프론트가 현재 직접 호출하는 핵심 API:

- `GET /api/news`
- `POST /api/news/pull-finhub`
- `GET /api/news/pull-finhub/preflight`
- `POST /api/news/change/update-recent`
- `POST /api/news/change/update-custom`
- `GET /api/news/fulltext/:newsId`
- `POST /api/news/fulltext/update`
- `GET /api/updates/status`
- `GET /api/ibkr/ohlc1d/status`
- `POST /api/ibkr/ohlc1d/update`
- `POST /api/ibkr/calendar/update`
- `GET /api/jobs/:jobId`
- `GET /api/tickers`
- `POST /api/tickers/add`
- `GET /api/bookmarks/folders`
- `POST /api/bookmarks/folders`
- `PUT /api/bookmarks/folders/:id`
- `DELETE /api/bookmarks/folders/:id`
- `POST /api/bookmarks/items`
- `DELETE /api/bookmarks/items`
- `GET /api/bookmarks/folders/:folderId/items`
- `PATCH /api/bookmarks/items/move`

## 현재 구현 기준의 저장/상태 성격

- Finnhub 뉴스 검색 결과는 모두 backend DB 기반이다. provider raw response를 직접 렌더하지 않는다.
- update, fulltext, change 계산은 모두 “job 시작 → polling → 완료 후 재조회” 패턴이다.
- 단, calendar update는 프론트는 job처럼 다루지만 backend는 아직 동기 응답형이다.
- saved search, watchlist menu 선택값 등 일부 UI 상태는 메모리 state만 사용하고 영속 저장되지 않는다.

## 파일 맵

- `src/main.tsx`: 앱 진입
- `src/app/App.tsx`: 탭/창 상태, 다크 모드, linked ticker
- `src/app/types.ts`: WindowType 정의
- `src/app/components/DraggableWindow.tsx`: 공통 창 래퍼
- `src/app/components/AddTabModal.tsx`: 탭 생성 modal
- `src/app/components/FinnhubNewsWindow.tsx`: 핵심 뉴스 창
- `src/app/components/BookmarkManager.tsx`: 북마크 관리 모달 (폴더 rename/delete, 아이템 드래그 이동, 우클릭 복사/잘라내기/붙여넣기/삭제)
- `src/app/components/DataControlWindow.tsx`: 운영/update 창
- `src/app/components/DefaultTickerWindow.tsx`: CSV ticker 창
- `src/app/components/NewsWindow.tsx`: EODHD 기반 부분 구현 창
- `src/app/components/WatchlistWindow.tsx`: mock watchlist 창
- `src/app/components/CalendarWindow.tsx`: mock calendar 창
- `src/app/components/BraveNewsWindow.tsx`: 미연결 잔존 파일
- `vite.config.ts`: `/api`, `/healthz` proxy 설정

## 현재 한계와 주의점

- active window 중 backend와 완전히 맞물려 있는 것은 `Finnhub News`, `Default Ticker`, `Data Control` 중심이다.
- `CalendarWindow`와 `WatchlistWindow`는 UI만 있고 운영 데이터와 연결되어 있지 않다.
- `keywords`는 backend 응답으로 내려오고 `DEFAULT_COLUMNS`에 포함되어 있으며 컬럼 매뉴에서 표시/숨김 가능하다. 단 기본 숨김 상태다.
- `DataControlWindow`의 calendar 섹션은 backend가 `jobId`를 돌려준다고 가정하는 UI지만, 실제 backend는 현재 즉시 결과 응답형이다.
- `BraveNewsWindow`는 사실상 보관 파일에 가깝다. 새 작업은 여기에 붙이지 않는 편이 안전하다.
