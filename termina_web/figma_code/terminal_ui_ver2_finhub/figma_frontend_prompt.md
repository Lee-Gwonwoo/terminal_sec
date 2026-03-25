# Figma Frontend Prompt

## 목적
이 문서는 `termina_web/figma_code/terminal_ui_ver2_finhub/`의 현재 구현을 기준으로 한 프론트엔드 작업용 프롬프트/스펙이다. 별도 plan 문서 없이도 이 문서만 읽으면, 어떤 창이 실제 동작하고 어떤 창이 아직 목업/스텁인지, 어떤 백엔드 API를 어떤 방식으로 호출하는지 바로 알 수 있어야 한다.

## 현재 구현 상태 요약

- 앱은 React + TypeScript + Vite 기반이다.
- 창(window) 기반 데스크톱 스타일 UI이며, 각 창은 드래그/리사이즈/최대화/닫기를 지원한다.
- 실제 API 연동이 살아 있는 주요 창은 `Finnhub News`, `Default Ticker`, `Data Control`, `AI Research Window` 이다.
- `News` 창도 `GET /api/news`, `POST /api/news/pull-eodhd`를 실제로 호출하지만, 현재 운영 기준의 주력 뉴스 창은 아니다.
- `Watchlist`, `Calendar` 창은 현재 mock data 기반이다.
- `BraveNewsWindow.tsx` 파일은 남아 있지만 현재 `WindowType`에 연결되어 있지 않아 UI에서 열 수 없다.
- 탭/창 레이아웃, 다크 모드, 전역 글자 크기, 뉴스 제목/요약 글자 크기, linked ticker는 `terminal-workspace-v1`로 localStorage에 저장된다.
- 추가 UI 상태로 `finhub-news-ui-state`, `finnhub-last-update-config`, `data-control-active-tab`, `ft-concurrency`, `fmp-pr-fulltext-concurrency`, `ibkr-concurrency`, `finnhub-ticker-concurrency`, `finnhub-request-interval-sec`, `rtpr-ticker-concurrency`, `fmp-concurrency`, `fmp-request-interval-ms`, `fmp-skip-existing`, `peers-skip-existing`, `ipo-skip-existing`, `yahoo-concurrency`, `yahoo-request-interval-ms`, `yahoo-skip-existing`를 사용한다.
- `FinnhubNewsWindow`의 `Control` modal과 `DataControlWindow` Settings 탭은 `fmp-concurrency`, `fmp-request-interval-ms`를 공유한다. 즉 FMP press release / FMP stock news / FMP SEC filing pull 속도 설정은 두 화면에서 같은 값을 편집한다.
- 일반 full text 추출은 `ft-concurrency`를 사용한다.
- `FMP PR Only`와 `Reset FMP PR Fallback` 뒤 재실행은 전용 키 `fmp-pr-fulltext-concurrency`를 우선 사용하고, 값이 없으면 `ft-concurrency`를 fallback으로 사용한다.
- `FinnhubNewsWindow`는 pull/update 계열 job과 fulltext 계열 job을 서로 다른 state/job id로 추적한다. 즉 `Update`는 `updating`만, `Full Text`는 `ftUpdating`만 차단한다.
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
- 같은 저장소에 탭 순서, 창 위치/크기, `fontScale`, `newsTitleFontSize`, `newsSummaryFontSize`, `linkedTicker`도 함께 저장된다.

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
- `case-research`

`brave-news`는 타입 정의에 없다. 즉 파일은 있지만 앱에서 선택/렌더링되지 않는다.

## Add Tab Modal

`AddTabModal.tsx`에서 선택 가능한 창:

- Calendar
- News
- News Feed: Finnhub API
- Watch List
- Default Ticker
- Data Control
- AI Research Window

초기 창 배치 규칙:

- 1개 창: `800x600`
- 2개 창: 좌우 분할 `600x600`
- 3개 이상: 계단식 배치

기본 창 제목:

- `finhub-news` → `News Feed: Finnhub API`
- `default-ticker` → `Default Ticker`
- `data-control` → `Data Control`
- `case-research` → `AI Research Window`
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
GET /api/news?source_names=FINNHUB,RTPR,FMP&limit=500
```

추가 query:

- `keyword`
- `source_type` (`company_news | press_release | fmp_press_release | fmp_stock_news | fmp_sec_filing | market_news`)
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

상단 툴바는 `좌측 검색 블록 + 우측 제어 블록 + 하단 유틸리티 줄` 3영역으로 재배치돼 있다.

- 좌측 검색 블록
  - 일반 keyword 검색창 (돋보기 아이콘)
  - ticker 전용 검색창 (TrendingUp 아이콘)
  - 넓은 From / To 날짜 입력 (Calendar 아이콘)
- 우측 제어 블록
  - source type filter 버튼 묶음
  - `Full View` / `Model_1 Safe`, `Bookmark view`, `Display mode`
  - `Update`, `View Log`, `Full Text`, `Refresh`, `Control`, `Save`, `Load`

### 뉴스 창 UI 락 규칙 기준표

| UI 버튼 그룹 | 차단 state | backend job category | 비고 |
|-----------|------|------|------|
| `Update` 계열 | `updating` | `news-update` | pull/update/change 계열 진행 중에만 차단 |
| `Full Text` 계열 | `ftUpdating` | `news-fulltext` | fulltext/reset/retry 계열 진행 중에만 차단 |
| `View Log` | 선택된 job 유무 | `news-update` + `news-fulltext` | 두 category의 running job을 같은 패널에서 선택 조회 |

운영적 정의:

- `Pulling...`은 `updating=true`일 때만 표시된다.
- `Extracting...`은 `ftUpdating=true`일 때만 표시된다.
- 따라서 `FMP PR Full Text` 실행 중에는 Full Text 메뉴만 잠기고, 일반 `Update` 버튼은 계속 눌릴 수 있다.
- 반대로 일반 `Update`가 running 중이어도 Full Text 메뉴는 별도 category라서 계속 사용할 수 있다.
- 로그 패널은 선택된 job id를 기준으로 표시하고, active job이 여러 개면 dropdown으로 전환할 수 있다.
- 하단 유틸리티 줄
  - item count / loading 상태
  - 에러 메시지 / `Model_1 safe payload active`
  - `Columns`, `Watch Lists`

검색 필드 자체는 여전히 아래 3개다:

1. 일반 keyword 검색창
2. Ticker 전용 검색창
3. From / To 날짜 입력

동작 트리거는 Enter 또는 discrete filter 변경 시 재조회다. 현재 구현은 프론트 내부 300ms debounce가 아니라, Enter 기반 검색 + source/bookmark/date 변경 시 즉시 재조회 조합에 가깝다.

### 테이블 컬럼

정의된 컬럼:

- `[][][]date[][][]`
- `[][][]ticker[][][]`
- `[][][]time[][][]`
- `[][][]title[][][]`
- `[][][]publisher[][][]`
- `[][][]industry[][][]`
- `[][][]ipoDate[][][]`
- `[][][]marketCap[][][]`
- `[][][]source[][][]`
- `[][][]fulltext[][][]`
- `[][][]changes[][][]`
- `[][][]keywords[][][]`
- `[][][]score[][][]`
- `[][][]scoreEvidence[][][]`
- `[][][]sentiment[][][]`
- `[][][]peers[][][]`
- `[][][]companyDesc[][][]`

기본 visible 상태:

- 기본 숨김: `source`, `keywords`, `score`, `scoreEvidence`, `sentiment`, `peers`, `companyDesc`
- 나머지는 기본 표시

market cap 컬럼 규칙:

- `marketCap`은 backend의 최신 `company_profiles.market_cap` 값을 사용한다.
- 표시는 `$12.34B`, `$950.0M`, `$1.25T` 형식으로 축약한다.
- 값이 없으면 `-`를 표시한다.

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
- `FMP PR`
- `FMP Stock`
- `FMP SEC`
- `Market News`

상태값:

- `all`
- `company_news`
- `press_release`
- `market_news`

### Market Cap 필터

- toolbar에 `Market Cap Filter` 버튼이 있다.
- popup에서 `Min ($B)`, `Max ($B)`를 입력한다.
- 필터는 현재 로드된 `newsData`에 대해 client-side로 적용된다.
- 필터가 하나라도 활성화되면 `marketCap`이 없는 row는 제외된다.
- `finhub-news-ui-state`에 `marketCapMin`, `marketCapMax`로 저장된다.

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
- `GET /api/jobs/active`
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

현재 코드 상태(중요):

- Finnhub News 창은 내부적으로 `currentJobId`, `jobStatus`, `activeJobs`를 유지하므로 여러 running job을 표시할 준비는 되어 있다.
- 하지만 update 버튼 대부분은 전역 `[][][]updating[][][]` 상태로 `disabled`된다.
- 따라서 실제 UI 기준으로는 한 update가 running이면 다른 종류의 update 버튼도 대부분 같이 잠긴다.
- 즉 "서로 다른 플랫폼/종류 update를 동시에 시작"하는 UX는 현재 완전히 열려 있지 않다.
- 예외적으로 backend에 이미 여러 running job이 있으면(다른 탭, 새로고침 복구, 직접 API 호출 등) `View Log`에서 이들 중 하나를 선택해 볼 수 있다.

중복 실행 현재 상태:

- Finnhub pull과 RTPR pull은 backend가 `409 + existingJobId`로 중복 실행을 막는다.
- 프론트는 이 `409`를 받으면 새 job을 만들지 않고 기존 `existingJobId`로 포커스를 옮기며, `View Log`를 연다.
- Change Update, Full Text Update는 현재 같은 방식의 backend duplicate guard가 없다.
- 다만 현재 프론트 전역 lock 때문에 일반적인 UI 사용 경로에서는 중복 시작이 잘 드러나지 않는다.

### Change Update 버튼

Finnhub News 창 안에도 change 계산 버튼이 있다.

- `7D Change Update` → `POST /api/news/change/update-recent`
- `Custom Change% Update` → 날짜 modal 후 `POST /api/news/change/update-custom`

이 버튼들은 Data Control 창의 change update와 같은 backend job을 재사용한다.

Change update 후 News Feed가 다시 `GET /api/news`를 읽으면, 날짜 관련 필드는 아래 의미로 사용해야 한다.

- `[][][]ohlc_date[][][]`: 기본 표시 날짜. `change_pct`가 계산된 기준일이다.
- `[][][]change_pct_ohlc_date[][][]`: `change_pct` 기준일을 명시적으로 다시 준 필드다.
- `[][][]change_1d_target_date[][][]`: `change_1d_pct`의 forward target date다.
- `change_1d_pct`가 `null`이면 `change_1d_target_date`도 `null`로 내려온다.
- 장중(ET `16:00:00` 이전)에는 same-day change와 current ET day forward target이 비어 있을 수 있으며, 이는 정상이다.

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
- FMP PR Only
- Reset FMP PR Fallback
- FMP SEC Filing Only
- Market News

API:

- `POST /api/news/fulltext/update`

현재 코드 상태:

- 일반 Update 메뉴(Finnhub/FMP/FMP SEC/Market/Calendar/PTPR/Change)는 현재 `disabled={updating}`만 사용한다.
- 즉 `updating=true`인 일반 update 계열 job이 running이면 같은 메뉴의 다른 update 버튼들이 잠긴다.
- Full Text 메뉴 버튼은 `disabled={updating || ftUpdating}` 조건으로 비활성화된다.
- 따라서 일반 update가 running이면 Full Text Update도 잠기지만, 반대로 Full Text job만 running인 상태가 일반 Update 버튼을 직접 비활성화하지는 않는다.
- `handleFulltextUpdate()`와 reset 계열 fulltext action은 내부에서도 `if (updating || ftUpdating) return;` 가드가 있다.
- 반면 `handleUpdate()` 자체에는 `ftUpdating` 가드가 없다. 현재 코드만 보면 fulltext job running 중에도 일반 update 시작 시도는 가능하다.
- backend 자체는 fulltext endpoint에 Finnhub/RTPR pull과 같은 `409 + existingJobId` duplicate guard가 없다.
- 즉 현재 UX는 "모든 작업 전역 단일 lock"이 아니라, `updating` 상태를 공유하는 일반 update 묶음 + `updating || ftUpdating`를 보는 fulltext 묶음으로 나뉘어 있다.
- `View Log`는 backend의 여러 running job을 동시에 보여줄 수 있으므로, 다른 경로(다른 탭/직접 API 호출)에서 병렬 job이 있으면 UI에서 함께 관찰할 수 있다.
- `FMP PR Only`는 missing-only 동작이다. 이미 `news_fulltext` row가 있는 FMP PR id는 건드리지 않는다.
- 기존에 잘못 저장된 FMP PR fallback success row를 다시 처리하려면 `Reset FMP PR Fallback`을 먼저 실행해 해당 row를 삭제한 뒤, 이어서 `FMP PR Only`를 실행한다.
- FMP PR fulltext는 `RTPR` 같은 다른 source body를 재사용하지 않고, FMP로 새로 적재된 기사 URL에서 직접 원문 추출한다.
- 현재 extractor는 `GlobeNewswire`, `PRNewswire`, `Newsfile Corp`, `Accesswire`, `MCAP MediaWire` 기사 페이지 본문 scrape를 시도하고, `Business Wire`는 브라우저 fallback으로 직접 추출한다.

### Log 패널

- `View Log` 버튼은 항상 보이지만 job이 없으면 disabled
- update 시작 시 로그 패널이 자동 오픈되지는 않는다
- 사용자가 직접 `View Log`를 눌러야 하단 패널이 열린다
- `Esc`로 닫기 가능
- 진행률 bar, 상태 badge, 로그 줄, 완료 result 표시

현재 코드 상태(구체):

- `GET /api/jobs/active`를 5초마다 polling해서 running job 목록을 `activeJobs`로 유지한다.
- `currentJobId`가 비어 있고 running job이 있으면 가장 최근 job을 자동 선택하고 로그 패널을 연다.
- running job이 2개 이상이면 패널 헤더에 select dropdown이 나타나고, 사용자가 볼 job을 수동으로 바꿀 수 있다.
- dropdown 항목 라벨은 현재 `Job 1`, `Job 2` 형태에 가깝고 platform/mode/source를 직접 보여 주지 않는다.
- `Stop` 버튼은 현재 선택된 `currentJobId`에만 적용된다.
- `activeJobs`는 running job만 포함하므로, 완료된 job을 dropdown에서 다시 고르는 용도는 아니다.
- 결과적으로 "동시에 진행 중인 job 선택해서 보기"는 현재도 가능하지만, label 가독성과 전역 버튼 lock 때문에 사용성이 제한적이다.

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

- `finhub-news-ui-state`: `visibleCols`, `displayMode`, `sourceTypeFilter`, `fromDate`, `toDate`, `selectedBookmarkFolderId`, `marketCapMin`, `marketCapMax`
- `terminal-workspace-v1`: 탭 순서, 탭/창 레이아웃, `isDarkMode`, `fontScale`, `newsTitleFontSize`, `newsSummaryFontSize`, `linkedTicker`
- `data-control-active-tab`: DataControl의 현재 탭(`updates | settings | appdb`)
- `ft-concurrency`: Full Text Update 동시성 설정
- `ibkr-concurrency`: Change Update용 IBKR 동시성 설정
- `finnhub-ticker-concurrency`: Finnhub pull 대상 ticker 동시성 설정
- `finnhub-request-interval-sec`: Finnhub pull 요청 간격(초)
- `rtpr-ticker-concurrency`: RTPR press release pull ticker 동시성 설정
- `fmp-concurrency`, `fmp-request-interval-ms`, `fmp-skip-existing`: FMP description pull 설정
- `peers-skip-existing`, `ipo-skip-existing`: Finnhub peers / IPO date pull의 skip-existing 설정
- `yahoo-concurrency`, `yahoo-request-interval-ms`, `yahoo-skip-existing`: Yahoo description pull 설정

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
- `[][][]change_pct_ohlc_date[][][]`
- `[][][]change_1d_target_date[][][]`
- `[][][]change_from_open_pct[][][]`
- `[][][]change_7d_pct[][][]`
- `[][][]change_14d_pct[][][]`
- `[][][]change_30d_pct[][][]`
- `[][][]hasFullText[][][]`
- `[][][]keywords[][][]`
- `[][][]keywordsStatus[][][]`
- `[][][]industry[][][]`
- `[][][]marketCap[][][]`
- `[][][]ipoDate[][][]`
- `[][][]score[][][]`
- `[][][]scoreEvidence[][][]`
- `[][][]analysisStatus[][][]`
- `[][][]sentimentBullishPct[][][]`
- `[][][]sentimentBearishPct[][][]`
- `[][][]companyNewsScore[][][]`
- `[][][]peers[][][]`
- `[][][]companyDescription[][][]`

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
- `App DB`

### 로드 시 호출

- `GET /api/updates/status`
- `GET /api/ibkr/ohlc1d/status`

### 섹션

- `IBKR Price Data`
- `Initial Calendar Backfill`
- `Refresh Upcoming Calendar`
- `Custom Calendar Update`
- `Company Description Update`
- `Yahoo Description Update`
- `Peers Data Update`
- `IPO Date Update`
- `Recent Change% Update`
- `Custom Change% Update`

각 섹션은 아래를 가진다.

- Update 버튼
- Log 버튼
- Last Success 시각 표시
- 에러 표시

추가 정보:

- Price 섹션은 `DB Max Date` 표시
- Calendar custom 섹션은 `from/to` date input 포함
- Custom Change 섹션은 `from/to` date input 포함

### 호출 API

- `POST /api/ibkr/ohlc1d/update`
- `POST /api/ibkr/calendar/update`
- `POST /api/ibkr/calendar/update-custom`
- `POST /api/company-profiles/pull-fmp`
- `POST /api/company-profiles/pull-yahoo`
- `POST /api/company-profiles/pull-peers`
- `POST /api/company-profiles/pull-ipo-date`
- `POST /api/news/change/update-recent`
- `POST /api/news/change/update-custom`
- `GET /api/jobs/:jobId`
- `GET /api/db/inspect`

change update contract:

- `POST /api/news/change/update-recent` → `{ jobId }`
  - body에 `fmpConcurrency`(기본=5), `fmpRequestIntervalMs`(기본=250ms)를 선택적으로 보낼 수 있다.
  - backend는 먼저 OHLC DB를 읽고, 비어 있는 ticker만 FMP 일봉 OHLC로 보강한 뒤 `news_change_metrics`를 다시 쓴다.
- `POST /api/news/change/update-custom` → `{ jobId }`
  - body는 `{ from, to, fmpConcurrency?, fmpRequestIntervalMs? }`.
  - 동작은 recent와 같고 날짜 범위만 사용자가 지정한다.

company data job contract:

- `POST /api/company-profiles/pull-fmp` → `{ jobId }`
  - body에 `concurrency`(기본=5), `requestIntervalMs`(기본=250ms), `skipExisting`(기본=true) 전달.
  - `skipExisting=true`이면 이미 FMP description이 저장된 ticker를 건너뛴다. `false`이면 전체 덮어쓰기.
  - backend는 프로세스 전역 FMP throttle을 사용해 병렬 worker 간 요청 간격을 직렬화한다.
- `POST /api/company-profiles/pull-yahoo` → `{ jobId }`
  - body에 `concurrency`(기본=5), `requestIntervalMs`(기본=200ms), `skipExisting`(기본=true) 전달.
- `POST /api/company-profiles/pull-peers` → `{ jobId }`
- `POST /api/company-profiles/pull-ipo-date` → `{ jobId }`
- `pull-peers` / `pull-ipo-date`는 Control Window의 `Finnhub Pull Ticker Concurrency`와 각자의 `skipExisting` 값을 body로 보낸다.
- `pull-fmp`는 `FMP Concurrency`, `FMP Request Interval`, `FMP Skip Existing` 설정값을 body로 함께 보낸다.
- `pull-yahoo`는 `Yahoo Concurrency`, `Yahoo Request Interval`, `Yahoo Skip Existing` 설정값을 body로 함께 보낸다.
- backend는 Finnhub company-data job과 FMP job에 각각 별도의 전역 throttle을 사용한다.
- 완료 summary는 `requested`, `tickersUpdated`, `tickersFailed`, `totalRowsUpserted`, `skippedExisting` 기준으로 표시된다

### 로그 패널

- 한 번에 한 섹션 로그만 표시
- `View Log`를 눌렀을 때만 열림
- 자동 스크롤
- `Esc`로 닫기 가능
- 완료 result는 ticker/row 수 또는 merged/skipped 수를 summary로 표시
- `Company Description Update`, `Yahoo Description Update`, `Peers Data Update`, `IPO Date Update`도 실제 background job을 사용하므로 progress/log/result summary가 채워진다

주의:

- 현재 불일치는 calendar update 섹션에만 남아 있다. `Company Description Update`, `Yahoo Description Update`, `Peers Data Update`, `IPO Date Update`는 `{jobId}` 반환 + `GET /api/jobs/:jobId` polling 계약으로 맞춰졌다.
- 같은 이유로 News Feed 창에서도 calendar update만 background job/View Log 표준 계약 바깥의 예외다.

### Settings 탭

- 전역 `Font Size` preset + slider를 제공한다.
- News Feed 전용 typography control을 제공한다.
  - `Title Text`
  - `Summary Text`
- 운영용 동시성/간격 설정을 제공한다.
  - `Full Text Concurrency`
  - `IBKR Fetch Concurrency`
  - `Finnhub Pull Ticker Concurrency`
  - `RTPR Pull Ticker Concurrency`
  - `FMP Concurrency` (기본=5, 범위 1~20)
  - `FMP Request Interval` (기본=250ms, 범위 0~5000ms)
  - `FMP Skip Existing` (기본=Skip Existing, 토글로 Overwrite All 전환 가능)
  - `Peers Skip Existing` (기본=Skip Existing)
  - `IPO Skip Existing` (기본=Skip Existing)
  - `Yahoo Concurrency` (기본=5, 범위 1~20)
  - `Yahoo Request Interval` (기본=200ms, 범위 0~5000ms)
  - `Yahoo Skip Existing` (기본=Skip Existing, 토글로 Overwrite All 전환 가능)
- Finnhub concurrency 설정은 `Peers Data Update`, `IPO Date Update`에도 적용된다.
- 위 두 값은 Control Window에서만 조정한다. News Feed 창 toolbar에는 별도 font size control이 없다.
- 설정은 `terminal-workspace-v1` 하나에 합쳐 저장되지 않고, 각 설정별 localStorage key에 분산 저장된다.

### App DB 탭

- `GET /api/db/inspect` 결과를 읽어 테이블 목록, row 수, 컬럼, foreign key, sample row를 보여준다.
- `ticker_universes`는 resource view를 추가로 펼쳐 default universe 식별자와 sample ticker를 보여준다.
- 읽기 전용 점검 탭이며, 여기서 직접 DB를 수정하지는 않는다.

## Default Ticker Window

파일: `src/app/components/DefaultTickerWindow.tsx`

현재 이 창은 실제 CSV read/append가 연결되어 있다.

기본 CSV path:

- `tradigview_screener/original_data/watch lists2_2026-02-22.csv`

기능:

- CSV path 직접 수정
- Reload
- custom CSV를 default universe에 merge import (`Merge into Default`)
- default universe 기준 수급/시총 갱신 버튼 3개
  - `Mkt Cap`: FMP 시가총액 갱신
  - `Float`: FMP float % 갱신
  - `Inst`: Finnhub institutional % 갱신
  - 세 버튼 모두 진행 상황 표시(completed/total, percent) + job polling을 사용한다.
  - 각 버튼은 **View Log 버튼**을 통해 최대 100줄의 job 로그 패널을 토글한다.
  - job 404 감지: 서버 재시작 등으로 job이 사라지면 자동으로 에러 표시 + 상태 리셋
  - 이미 24시간 내 값이 있는 ticker는 서버에서 자동 skip된다.
- ticker 추가
- filter 입력
- table 표시: `Ticker | Name | Exchange | Industry | IPO Date | Market Cap | Float % | Inst % | Del`
- `Market Cap`, `Float %`, `Inst %` 셀에는 값 옆에 source badge가 붙는다.
  - 현재 구현 기준 `Market Cap = FMP`, `Float % = Fmp`, `Inst % = Finnhub`
- ticker 클릭 시 상위 `onTickerClick` 전달
- 삭제 버튼으로 default universe에서 ticker 제거

API:

- `GET /api/tickers?csvPath=...`
- `POST /api/tickers/import-default`
- `POST /api/tickers/add`
- `DELETE /api/tickers/remove`
- `POST /api/company-profiles/pull-market-cap`
- `POST /api/company-profiles/pull-float`
- `POST /api/company-profiles/pull-institutional`

`GET /api/tickers` 응답에서 프론트가 실제로 쓰는 row 필드:

- `[][][]ticker[][][]`
- `[][][]exchange[][][]`
- `[][][]name[][][]`
- `[][][]sector[][][]`
- `[][][]industry[][][]`
- `[][][]ipoDate[][][]`
- `[][][]marketCap[][][]`
- `[][][]floatPct[][][]`
- `[][][]institutionalPct[][][]`
- `[][][]marketCapSource[][][]`
- `[][][]floatSource[][][]`
- `[][][]institutionalSource[][][]`

현재 제약:

- 허용 경로는 backend allowlist에 의해 제한된다
- UI는 어떤 CSV든 입력 가능해 보이지만, backend가 허용하지 않으면 error banner를 보여준다
- custom CSV를 merge import해도 기존 default universe ticker는 제거되지 않고, 중복만 skip된다
- `Mkt Cap`, `Float`, `Inst` 버튼은 기본 default path일 때만 보인다. custom CSV view에서는 merge/import가 우선이다.
- custom CSV view에서는 수급/시총 컬럼과 source badge가 대부분 `null`이라 `-`로 보일 수 있다.

성능 메모(2026-03-25 반영):

- 기능 변화 없이 렉을 줄이기 위해 row 렌더링은 가상 리스트(`react-window`)를 사용한다.
- filter input 값은 즉시 저장되지만, 실제 row filtering은 `useDeferredValue` 기준으로 한 박자 늦춰 heavy re-render를 줄인다.
- 헤더는 고정하고, body row만 virtualization 대상으로 유지한다.
- 데이터/API/job polling semantics는 그대로고, 화면에 동시에 그리는 row 수만 줄인다.

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

- backend `watchlists` API와 연결되어 있다.
- 초기 로드 시 `GET /api/watchlists`로 목록을 가져온다.
- 새 watch list 생성 시 `POST /api/watchlists`를 호출한다.
- 이름 변경 및 ticker 추가/삭제는 `PUT /api/watchlists/:id`로 현재 리스트 전체 구성을 저장한다.
- watch list 자체 삭제는 dropdown의 trash 버튼으로 `DELETE /api/watchlists/:id`를 호출한다.
- 상단 툴바의 copy 버튼으로 현재 선택된 watch list 이름을 clipboard에 복사할 수 있다.
- Watch Lists dropdown의 각 row에도 copy 아이콘이 있어 해당 리스트 이름을 직접 복사할 수 있다.
- 현재 source of truth는 backend `app.db`의 `watchlists`, `watchlist_items` 테이블이다.
- watchlist table row의 `[][][]name[][][]`, `[][][]industry[][][]`, `[][][]marketCap[][][]`는 `GET /api/watchlists`의 `[][][]items[][][]` payload를 우선 사용한다.
- `[][][]marketCap[][][]`는 backend가 내려주는 숫자 값을 프론트에서 `$1.2B`, `$850.0M` 같은 문자열로 포맷해 표시한다.
- `[][][]industry[][][]`가 DB `securities.industry`에 없을 때는 backend의 CSV fallback 결과가 그대로 내려올 수 있다.

## Calendar Window

파일: `src/app/components/CalendarWindow.tsx`

현재 상태:

- mock data only
- API 연동 없음
- earnings / conference / dividend / analyst_rating 탭 UI는 존재

즉 backend의 `calendar_events` API와 아직 연결된 화면이 아니다.

## Case Research Window

파일: `src/app/components/CaseResearchWindow.tsx`

현재 상태:

- 실제 backend API 연동이 있는 연구 노트 창이다.
- 섹션(tab) + 페이지(page) 구조의 OneNote 스타일 편집 UI다.
- 상단 검색창은 `GET /api/research/search?q=...` 를 300ms debounce로 호출한다.
- 상단 검색창 오른쪽의 `Refresh` 버튼은 현재 backend DB 상태를 기준으로 탭 목록, 페이지 목록, 현재 페이지 본문을 다시 fetch 한다.
- `Refresh` 오른쪽의 `Restore` 버튼은 deleted tab/page 목록 패널을 열고 복구를 수행한다.
- 새 섹션/페이지 생성, 이름 변경, 삭제, 페이지 순서 재정렬, 본문 자동 저장이 구현되어 있다.
- tab/page 항목은 우클릭 컨텍스트 메뉴로 `Rename`, `Delete (24h hold)`를 연다.
- 본문/제목 변경은 500ms debounce 후 `PATCH /api/research/pages/:id`로 자동 저장된다.

현재 사용하는 핵심 API:

- `GET /api/research/tabs`
- `POST /api/research/tabs`
- `PATCH /api/research/tabs/:id`
- `DELETE /api/research/tabs/:id`
- `POST /api/research/tabs/:id/restore`
- `GET /api/research/tabs/:tabId/pages`
- `POST /api/research/tabs/:tabId/pages`
- `POST /api/research/tabs/:tabId/pages/reorder`
- `GET /api/research/pages/:id`
- `PATCH /api/research/pages/:id`
- `DELETE /api/research/pages/:id`
- `POST /api/research/pages/:id/restore`
- `GET /api/research/search`
- `GET /api/research/trash`

저장 성격:

- UI state를 localStorage에 저장하지 않고 backend `app.db`의 `research_tabs`, `research_pages`를 source of truth로 사용한다.
- 프론트 새로고침 후에도 연구 노트 데이터는 DB에서 다시 로드된다.
- 외부 스크립트나 다른 창이 같은 page를 갱신한 경우, 사용자는 `Refresh` 버튼으로 현재 창 내용을 수동 재조회할 수 있다.
- 삭제는 즉시 화면에서 숨기지만 backend DB에는 24시간 soft delete 상태로 남는다.
- 24시간이 지난 soft delete row는 다음 `research` API 접근 시 backend가 정리한다. 별도 polling timer는 사용하지 않는다.
- Restore 패널은 deleted section/page를 분리해서 보여 주고, page의 부모 section도 deleted 상태면 먼저 section을 복구해야 한다.

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
- `POST /api/tickers/import-default`
- `POST /api/tickers/add`
- `DELETE /api/tickers/remove`
- `POST /api/company-profiles/pull-market-cap`
- `POST /api/company-profiles/pull-float`
- `POST /api/company-profiles/pull-institutional`
- `POST /api/company-profiles/pull-yahoo`
- `POST /api/company-profiles/pull-peers`
- `POST /api/company-profiles/pull-ipo-date`
- `GET /api/research/tabs`
- `POST /api/research/tabs`
- `PATCH /api/research/tabs/:id`
- `DELETE /api/research/tabs/:id`
- `GET /api/research/tabs/:tabId/pages`
- `POST /api/research/tabs/:tabId/pages`
- `POST /api/research/tabs/:tabId/pages/reorder`
- `GET /api/research/pages/:id`
- `PATCH /api/research/pages/:id`
- `DELETE /api/research/pages/:id`
- `GET /api/research/search`
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
- default ticker의 시가총액/float/institutional 보강도 각각 job을 시작한 뒤 `GET /api/jobs/:jobId` polling으로 완료를 기다린다.
- default ticker의 market cap / float / institutional 값은 프론트 local state가 아니라 backend `company_profiles` 기반이다.
- source badge는 프론트에서 계산하지 않고 backend가 내려주는 `marketCapSource`, `floatSource`, `institutionalSource` 값을 그대로 사용한다.
- case research의 섹션/페이지 데이터는 localStorage가 아니라 backend DB에 저장된다.
- 단, calendar update는 프론트는 job처럼 다루지만 backend는 아직 동기 응답형이다.
- saved search, watchlist menu 선택값 등 일부 UI 상태는 메모리 state만 사용하고 영속 저장되지 않는다.
- News Feed의 Changes % 영역에서 기본 날짜 개념은 `ohlc_date = change_pct 기준일`이다. forward 날짜가 필요하면 `change_1d_target_date`를 별도로 봐야 한다.

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
- `src/app/components/CaseResearchWindow.tsx`: 연구 노트 창
- `src/app/components/WatchlistWindow.tsx`: mock watchlist 창
- `src/app/components/CalendarWindow.tsx`: mock calendar 창
- `src/app/components/BraveNewsWindow.tsx`: 미연결 잔존 파일
- `vite.config.ts`: `/api`, `/healthz` proxy 설정

## 현재 한계와 주의점

- active window 중 backend와 완전히 맞물려 있는 것은 `Finnhub News`, `Default Ticker`, `Data Control`, `AI Research Window` 중심이다.
- `NewsWindow`는 일부 backend를 사용하지만 현재 운영 기준의 주력 뉴스 창은 아니다.
- `CalendarWindow`와 `WatchlistWindow`는 UI만 있고 운영 데이터와 연결되어 있지 않다.
- `keywords`는 backend 응답으로 내려오고 `DEFAULT_COLUMNS`에 포함되어 있으며 컬럼 매뉴에서 표시/숨김 가능하다. 단 기본 숨김 상태다.
- `DataControlWindow`의 calendar 섹션은 backend가 `jobId`를 돌려준다고 가정하는 UI지만, 실제 backend는 현재 즉시 결과 응답형이다.
- `BraveNewsWindow`는 사실상 보관 파일에 가깝다. 새 작업은 여기에 붙이지 않는 편이 안전하다.
