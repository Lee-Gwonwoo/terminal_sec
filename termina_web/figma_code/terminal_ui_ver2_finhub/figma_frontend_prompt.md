# Figma Frontend Prompt

## 목적
이 문서는 `termina_web/figma_code/terminal_ui_ver2_finhub/`의 현재 구현을 기준으로 한 프론트엔드 작업용 프롬프트/스펙이다. 별도 plan 문서 없이도 이 문서만 읽으면, 어떤 창이 실제 동작하고 어떤 창이 아직 목업/스텁인지, 어떤 백엔드 API를 어떤 방식으로 호출하는지 바로 알 수 있어야 한다.

## 현재 구현 상태 요약

- 앱은 React + TypeScript + Vite 기반이다.
- 창(window) 기반 데스크톱 스타일 UI이며, 각 창은 드래그/리사이즈/최대화/닫기를 지원한다.
- 실제 API 연동이 살아 있는 주요 창은 `Finnhub News`, `Investing News`, `Calendar`, `Default Ticker`, `Daily Change History`, `Data Control`, `AI Research Window`, `Evidence Table`, `Watchlist` 이다.
- `News` 창도 `GET /api/news`, `POST /api/news/pull-eodhd`를 실제로 호출하지만, 현재 운영 기준의 주력 뉴스 창은 아니다.
- `Watchlist` 창은 backend `watchlists` API와 연결되어 있고, 종목 이름/가격 일부는 프론트의 fallback lookup을 함께 사용한다.
- `Calendar` 창은 backend `calendar_events` 기반의 실데이터 창이며, 현재 earnings + IPO 탭과 background job polling을 지원한다. IPO 탭에는 `Security Type` 컬럼과 dropdown 필터가 있고, 이 값은 FMP의 `ticker/company_name` 문자열에서 파생된다. ticker 기반 탭에서는 `Peers` 컬럼을 column selector에서 켤 수 있고, 현재 로드된 ticker의 누락 peers는 `Update FMP Peers` 버튼으로 채운다.
- `Finnhub News` 창과 `Calendar` 창은 `GET /api/industries` 목록을 읽어 `All Industries` dropdown을 표시한다. 메뉴 항목은 checkbox multi-select이며, 선택된 industry 목록을 `industries` 반복 query로 backend에 넘겨 server-side 필터링한다. `All Industries` 상태에서는 모든 industry checkbox가 체크된 것처럼 보이고, 개별 항목을 해제하면 전체 중 일부만 선택한 상태로 전환된다. 메뉴 상단에는 industry 명칭 검색 input이 있다. `Calendar` 창은 현재 체크된 industry 목록을 localStorage preset으로 저장/삭제할 수 있고, 저장된 preset의 `Apply`를 누르면 해당 industry 목록이 즉시 선택값으로 적용되어 calendar events를 다시 조회한다. 개별 industry row를 우클릭하면 `Instruction` 버튼이 뜨고, 버튼을 누르면 `GET /api/industries/detail` 결과로 industry 설명과 시총순 관련 ticker 목록을 dialog에 표시한다.
- `App.tsx`는 `open-case-description`, `open-company-description`, `open-data-control-how-to-use` custom event를 받아 `case-description`, `company-description`, `data-control-how-to-use` 보조 창을 현재 탭에 동적으로 추가한다.
- ticker가 있는 주요 창에서는 클릭으로 `Company Description` 창을 열 수 있고, ticker hover 3초 뒤 `CompanyDescriptionHoverPreview` overlay가 뜬다.
- `BraveNewsWindow.tsx` 파일은 남아 있지만 현재 `WindowType`에 연결되어 있지 않아 UI에서 열 수 없다.
- 탭/창 레이아웃, 다크 모드, 전역 글자 크기, 뉴스 제목/요약 글자 크기, linked ticker는 `terminal-workspace-v1`로 localStorage에 저장된다.
- 추가 UI 상태로 `finhub-news-ui-state`, `investing-news-ui-state`, `calendar-window-ui-state`, `calendar-industry-filter-presets-v1`, `finnhub-last-update-config`, `data-control-active-tab`, `ft-concurrency`, `fmp-pr-fulltext-concurrency`, `fmp-stock-fulltext-concurrency`, `change-fmp-concurrency`, `finnhub-ticker-concurrency`, `finnhub-request-interval-sec`, `finnhub-company-news-ticker-concurrency`, `finnhub-company-news-request-interval-sec`, `rtpr-ticker-concurrency`, `fmp-concurrency`, `fmp-request-interval-ms`, `fmp-pr-page-limit`, `fmp-pr-max-pages`, `fmp-sec-max-pages`, `fmp-skip-existing`, `peers-skip-existing`, `ipo-skip-existing`, `yahoo-concurrency`, `yahoo-request-interval-ms`, `yahoo-skip-existing`, `finnhub-news-keyword-filters-v1`를 사용한다.
- `FinnhubNewsWindow`는 `finnhub-news-keyword-filters-v1`에 keyword exclude profile 목록과 `activeProfileIds`를 저장한다. 이 저장소는 검색 저장(`Save` / `Load`)과 별개다.
- `FinnhubNewsWindow`의 `Control` modal과 `DataControlWindow` Settings 탭은 `fmp-concurrency`, `fmp-request-interval-ms`를 공유한다. 즉 FMP press release / FMP stock news / FMP SEC filing pull 속도 설정은 두 화면에서 같은 값을 편집한다.
- 같은 두 화면은 `fmp-pr-page-limit`, `fmp-pr-max-pages`, `fmp-sec-max-pages`도 공유한다. 즉 FMP press release / FMP stock news / FMP SEC filing의 페이지 단위 수집 제한도 같은 저장 키를 본다.
- `FinnhubNewsWindow`의 `Control` modal과 `DataControlWindow` Settings 탭은 `finnhub-company-news-ticker-concurrency`, `finnhub-company-news-request-interval-sec`도 공유한다. 즉 `Company News` pull 전용 속도 설정은 두 화면에서 같은 값을 편집한다.
- 일반 full text 추출은 `ft-concurrency`를 사용하고, 현재 기본값은 `200`이다.
- `FMP PR Only`와 `Reset FMP PR Fallback` 뒤 재실행은 전용 키 `fmp-pr-fulltext-concurrency`를 우선 사용하고, 값이 없으면 `ft-concurrency`를 fallback으로 사용한다.
- `FMP Stock Only`, `Reset FMP Stock Fallback` 뒤 재실행, `Recent/Custom FMP Stock` pull 안에서 새 row에 대해 자동으로 도는 fulltext는 모두 전용 키 `fmp-stock-fulltext-concurrency`를 우선 사용하고, 값이 없으면 `ft-concurrency`를 fallback으로 사용한다.
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
- `investing-news`
- `default-ticker`
- `daily-change-history`
- `data-control`
- `case-research`
- `evidence-table`
- `case-description`
- `company-description`
- `data-control-how-to-use`

주의:

- `evidence-table`은 실제 렌더링되는 정식 창 타입이며 backend `model2` API를 사용한다.
- `case-description`은 Add Tab Modal에서 직접 고르는 타입이 아니라, `EvidenceTableWindow`가 `open-case-description` 이벤트를 보낼 때 같은 탭 안에 동적으로 열리는 보조 설명 창이다.
- `company-description`은 Add Tab Modal에서 직접 고르는 타입이 아니라, ticker 클릭 이벤트를 통해 현재 탭에 동적으로 열리는 회사 설명 창이다. 새로 열릴 때는 Calendar/뉴스 테이블의 좌측 헤더를 덮지 않도록 viewport 우측에 기본 배치하고, 화면 크기에 맞춰 폭/높이와 좌표를 clamp한다.
- `data-control-how-to-use`는 Add Tab Modal에서 직접 고르는 타입이 아니라, `DataControlWindow` 또는 `FinnhubNewsWindow`의 `How To Use` 액션에서 동적으로 열리는 안내 창이다.
- `brave-news`는 타입 정의에 없다. 즉 파일은 있지만 앱에서 선택/렌더링되지 않는다.

## Add Tab Modal

`AddTabModal.tsx`에서 선택 가능한 창:

- Calendar
- News Feed: Finnhub API
- Investing News
- Watch List
- Default Ticker
- Daily Change History
- Data Control
- AI Research Window
- Evidence Table

직접 선택되지 않는 보조 창:

- `case-description`
- `company-description`
- `data-control-how-to-use`

기본 선택값은 비어 있으며, 아무 창도 고르지 않으면 `Start` 버튼은 비활성화된다.

초기 창 배치 규칙:

- 1개 창: `800x600`
- 2개 창: 좌우 분할 `600x600`
- 3개 이상: 계단식 배치

기본 창 제목:

- `finhub-news` → `News Feed: Finnhub API`
- `default-ticker` → `Default Ticker`
- `daily-change-history` → `Daily Change History`
- `data-control` → `Data Control`
- `case-research` → `AI Research Window`
- `evidence-table` → `Evidence Table`
- `case-description` → `Case Description`
- `data-control-how-to-use` → `Data Control How To Use`
- `company-description` → `Company Description: <TICKER>` 형태로 동적으로 생성
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
- `floatPctMin`, `floatPctMax`
- `institutionalPctMin`, `institutionalPctMax`
- `insiderPctMin`, `insiderPctMax`
- `bookmarkFolderId` (북마크 폴더 필터)
- `industries` (industry checkbox dropdown 다중 선택값, 반복 query)
- `cursor` (cursor 기반 페이지네이션)

검색은 서버사이드다.

- 입력창 300ms debounce
- `keyword`를 그대로 backend로 보냄
- 최초 결과 500건, cursor 기반으로 하단 스크롤 시 자동 append
- 리스트 하단에 `Load more` 버튼 제공
- `react-window`의 `onItemsRendered`로 sentinel row 감지 시 자동 추가 로드

### Keyword Exclude Filter

- `Keyword Filter`는 검색창과 별도인 client-side exclude filter다.
- 구현 파일은 `src/app/newsKeywordFilter.ts`, 연결 지점은 `src/app/components/FinnhubNewsWindow.tsx`다.
- backend `GET /api/news`는 exclude query를 모른다. 즉 서버 검색은 `keyword`, 제외 필터는 프론트에서 이미 받아온 `newsData`에 다시 적용하는 2단 구조다.
- 저장 단위는 `name + query + updatedAt`를 가진 profile이며, localStorage key `finnhub-news-keyword-filters-v1`에 `activeProfileIds` 배열과 함께 저장한다. 기존 단일 `activeProfileId` 저장값도 migration으로 읽어온다.
- query grammar는 아래 4가지만 1차 범위로 지원한다.
  - 공백 = implicit `AND`
  - `OR`
  - quoted phrase
  - 괄호 그룹
- 예시:
  - `offering biotech`
  - `offering OR shelf`
  - `("public offering" OR dilution) biotech`
- match text는 `title`, `body`, `publisher`, `source`, `sourceType`, `originUrl`, `url`, `ticker`, `keywords`를 lower-case로 합쳐 평가한다.
- invalid query는 저장/적용을 막고 modal 안에 validation message를 표시한다.
- 여러 active filter가 동시에 가능하며, row는 active profile 중 하나라도 match하면 제외된다.
- active filter가 있으면 summary 줄에 profile 이름 목록을 보여주고, count는 `shown / fetched` 형식으로 바뀐다. 제외된 row가 있으면 `Hidden` count도 함께 표시한다.

### 검색 UI

상단 툴바는 `좌측 검색 블록 + 우측 제어 블록 + 하단 유틸리티 줄` 3영역으로 재배치돼 있다.

- 좌측 검색 블록
  - 일반 keyword 검색창 (돋보기 아이콘)
  - ticker 전용 검색창 (TrendingUp 아이콘)
  - 넓은 From / To 날짜 입력 (Calendar 아이콘)
- 우측 제어 블록
  - source type filter 버튼 묶음
  - `Full View` / `Model_1 Safe`, `Bookmark view`, `All Industries`, `Display mode`
  - `Update`, `View Log`, `Full Text`, `Refresh`, `Control`, `Keyword Filter`, `Save`, `Load`
- 하단 유틸리티 줄
  - item count / loading 상태
  - active keyword filter summary / hidden count
  - 에러 메시지 / `Model_1 safe payload active`
  - `HV`, `Z Score` quick toggle 버튼
  - `Filters`, `Columns`, `Watch Lists`

`Filters` 드롭다운은 `Default Ticker Window`와 같은 DB 기반 ownership 수치를 사용한다.

- `Float %`
- `Inst %`
- `Insider %`

각 항목은 `Min/Max` 범위 입력 2개를 가지며, 값이 바뀌면 backend `/api/news`, `/api/model1/news`를 같은 범위 조건으로 다시 조회한다. Industry dropdown도 같은 서버 조회 경로를 사용하며, 저장 검색 payload와 뉴스 earnings 확인 job payload에도 선택 배열이 포함된다. `All Industries`는 backend query에는 industry filter를 보내지 않는 전체 선택 상태이고, UI에서는 모든 checkbox가 체크된다. 이 상태에서 특정 industry checkbox를 해제하면 전체 목록에서 그 industry만 빠진 명시 선택 배열로 바뀐다. industry menu row 우클릭은 선택 상태를 바꾸지 않고, `Instruction` 버튼을 통해 별도 상세 dialog를 연다.

### Industry Instruction Dialog

`FinnhubNewsWindow`와 `CalendarWindow`의 industry dropdown에서 개별 industry row를 우클릭하면 작은 context menu가 뜨고, 그 안의 `Instruction` 버튼으로 상세 dialog를 연다. dialog는 `GET /api/industries/detail?industry=<name>&limit=250`를 호출한다.

응답 사용 컬럼:

- `[][][]industry[][][]`: dialog title에 표시하는 industry label.
- `[][][]description[][][]`: app DB 기준 industry 설명/요약.
- `[][][]totalTickers[][][]`: 전체 관련 ticker 수.
- `[][][]tickersWithMarketCap[][][]`: market cap 값이 있는 ticker 수.
- `[][][]sectors[][][]`: sector 요약 표시.
- `[][][]tickers[][][]`: 시총순 table rows.
- `[][][]truncated[][][]`: table row가 limit으로 잘렸는지 표시.
- `[][][]dataSource[][][]`: dialog footer source 표시.

`tickers` row 사용 컬럼:

- `[][][]ticker[][][]`
- `[][][]exchange[][][]`
- `[][][]name[][][]`
- `[][][]sector[][][]`
- `[][][]marketCap[][][]`
- `[][][]marketCapSource[][][]`
- `[][][]description[][][]`

### 뉴스 창 UI 락 규칙 기준표

| UI 버튼 그룹 | 차단 state | backend job key | 비고 |
|-----------|------|------|------|
| `Update` 계열 (Finnhub / FMP / RTPR / Change) | `updating` | `news-update + finnhub-news` | 같은 scope의 pull/update/change 계열 진행 중에만 차단 |
| `Update` 계열 (Investing) | `updating` | `news-update + investing-news` | 같은 scope의 Investing update 진행 중에만 차단 |
| `Full Text` 계열 (Finnhub / FMP / RTPR) | `ftUpdating` | `news-fulltext + finnhub-news` | 같은 scope의 fulltext/reset/retry 계열 진행 중에만 차단 |
| `Full Text` 계열 (Investing) | `ftUpdating` | `news-fulltext + investing-news` | 같은 scope의 Investing fulltext 계열 진행 중에만 차단 |
| `View Log` | 선택된 job 유무 | 현재 창 scope의 `news-update` + `news-fulltext` | 같은 창 scope의 running job만 패널에서 선택 조회 |

운영적 정의:

- `Pulling...`은 현재 창 scope의 `news-update` job이 running일 때만 표시된다.
- `Extracting...`은 현재 창 scope의 `news-fulltext` job이 running일 때만 표시된다.
- 따라서 Investing update가 running이어도 Finnhub 창의 `Recent FMP PR` / `FMP Stock Pull` / `RTPR Pull`은 계속 눌릴 수 있다.
- 반대로 Finnhub 계열 update/fulltext가 running이어도 Investing 창은 자기 scope job이 아니면 잠기지 않는다.
- 로그 패널은 선택된 job id를 기준으로 표시하고, active job이 여러 개면 같은 scope 안에서만 dropdown으로 전환할 수 있다.
검색 필드 자체는 여전히 아래 3개다:

1. 일반 keyword 검색창
2. Ticker 전용 검색창
3. From / To 날짜 입력

동작 트리거는 Enter 또는 discrete filter 변경 시 재조회다. 현재 구현은 프론트 내부 300ms debounce가 아니라, Enter 기반 검색 + source/bookmark/date/ownership filter 변경 시 즉시 재조회 조합에 가깝다.

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
- `[][][]floatPct[][][]`
- `[][][]institutionalPct[][][]`
- `[][][]insiderPct[][][]`
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
- 나머지는 기본 표시 (`Market Cap`, `Float %`, `Inst %`, `Insider %` 포함)

market cap 컬럼 규칙:

- `marketCap`는 backend의 최신 `company_profiles.market_cap` 대표값이다.
- 표시는 `$12.34B`, `$850.0M` 같은 축약 형식이고, 값이 없으면 `-`를 표시한다.

ownership 컬럼 규칙:

- `floatPct`, `institutionalPct`, `insiderPct`는 backend의 최신 `company_profiles` 대표 row 값이다.
- `institutionalPct`는 `Default Ticker Window`와 동일하게 Yahoo source 행만 대표값으로 본다.
- 표시는 `12.34%` 형식이고, 값이 없으면 `-`를 표시한다.

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

- title only: 96px
- title + abstract: 148px

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
- `fmp_press_release`
- `fmp_press_release_entire`
- `fmp_stock_news`
- `fmp_sec_filing`
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
  - FMP PR
  - FMP Stock
  - FMP SEC Filing
  - Market News
- Custom Update
  - All
  - Company News
  - Press Release
  - FMP PR
  - FMP Stock
  - FMP SEC Filing
  - Market News
- Custom New Tickers
  - Company News
  - Press Release
  - FMP PR
- PTPR Press Release
  - Recent PTPR Press Release
  - Custom PTPR Press Release

관련 API:

- `GET /api/news/pull-finhub/preflight?sourceType=...`
- `POST /api/news/pull-finhub/preflight-custom`
- `POST /api/news/pull-finhub`
- `POST /api/news/pull-rtpr/preflight-custom`
- `POST /api/news/pull-rtpr`
- `POST /api/news/pull-fmp-press-release/preflight-custom`
- `POST /api/news/pull-fmp-press-release`
- `POST /api/news/pull-fmp-stock-news/preflight-custom`
- `POST /api/news/pull-fmp-stock-news`
- `POST /api/news/pull-fmp-sec-filing/preflight-custom`
- `POST /api/news/pull-fmp-sec-filing`
- `GET /api/jobs/active`
- `GET /api/jobs/:jobId`

Finnhub pull payload 규칙:

- 기본적으로 `tickerConcurrency`, `requestIntervalMs`는 공용 `finnhub-ticker-concurrency`, `finnhub-request-interval-sec`를 사용한다.
- 단 `sourceType='company_news'`일 때는 `finnhub-company-news-ticker-concurrency`, `finnhub-company-news-request-interval-sec` 값을 우선 사용한다.
- 따라서 company news만 더 빠르게 당기고 싶으면 전용 override만 올리고, press release / peers / IPO 설정은 그대로 둘 수 있다.

`recent`를 시작하면 preflight modal이 먼저 열리고, 기존 데이터가 없는 fallback ticker 수를 보여준다.

Recent Update 섹션 바로 아래에 automatic recent retry 정책 설명이 작은 보조 문구로 항상 표시된다.

보조 문구 핵심 내용:

- confirmed-empty 과거 구간은 automatic recent retry에서 영구 스킵
- HTTP 200 + 실제 빈 배열일 때만 confirmed-empty로 기록
- `company_news`, `press_release`는 분리 기록
- 당일 범위는 영구 스킵에서 제외
- 강제 재조회가 필요하면 `Custom Update` 사용

custom update는 별도 날짜 선택 modal에서 `from/to`를 입력한 뒤 시작한다.

`Custom New Tickers` 섹션은 기존 custom update와 같은 gap-only 경로를 사용하되, backend payload에 `[][][]tickerAddedFrom[][][]`을 추가한다. 이 섹션은 Update menu의 custom 계열 안에서 `Custom Market News`보다 앞에 둔다. modal 입력 필드는 다음 3개다.

- `[][][]tickerAddedFrom[][][]`: Default Ticker에 추가된 날짜 기준 시작일. backend는 `date(ticker_universe_items.created_at) >= tickerAddedFrom`인 ticker만 대상으로 삼는다.
- `[][][]from[][][]`: 실제 뉴스 수집 날짜 범위 시작일(`News From`).
- `[][][]to[][][]`: 실제 뉴스 수집 날짜 범위 종료일(`News To`).

대상 source는 `company_news`, `press_release`, `fmp_press_release` 3개다. preflight 응답의 `[][][]selectedTickerCount[][][]`가 0이면 Continue 버튼은 disabled 상태로 유지한다. 새 버튼은 main update button의 반복 실행 대상으로 저장하지 않고, 드롭다운에서 명시적으로 다시 실행한다.

#### Custom Preflight 흐름

Custom Update를 시작하면 소스 타입에 따라 **preflight → modal → Continue → 실제 job** 순서로 진행한다.

dispatch 라우팅 (`handleCustomPreflightStart`):

| sourceType | preflight endpoint | 결과 |
|-----------|-------------------|------|
| `company_news` / `press_release` / `all` | `POST /api/news/pull-finhub/preflight-custom` | gap-only 요약 modal → Continue로 실행 |
| `fmp_press_release` | `POST /api/news/pull-fmp-press-release/preflight-custom` | gap-only 요약 modal → Continue로 실행 |
| `fmp_press_release_entire` | (preflight 없음) | 직접 실행 — gap planning 없이 전체 날짜 범위를 fetch. `mode: 'custom-entire'`로 전송 |
| `fmp_stock_news` | `POST /api/news/pull-fmp-stock-news/preflight-custom` | gap-only 요약 modal → Continue로 실행 |
| `fmp_sec_filing` | `POST /api/news/pull-fmp-sec-filing/preflight-custom` | summary-only modal → Continue로 실행 |
| `market_news` | (preflight 없음) | 직접 실행 |

PTPR Press Release의 Custom은 `POST /api/news/pull-rtpr/preflight-custom`을 사용한다 (fully-covered-skip 모드).

Custom New Tickers 버튼의 dispatch:

| 버튼 | preflight endpoint | 실제 실행 |
|------|-------------------|-----------|
| `Custom New Tickers Company News` | `POST /api/news/pull-finhub/preflight-custom` + `sourceType: 'company_news'` + `tickerAddedFrom` | `POST /api/news/pull-finhub` + `mode: 'custom'` + 같은 날짜 3개 |
| `Custom New Tickers Press Release` | `POST /api/news/pull-finhub/preflight-custom` + `sourceType: 'press_release'` + `tickerAddedFrom` | `POST /api/news/pull-finhub` + `mode: 'custom'` + 같은 날짜 3개 |
| `Custom New Tickers FMP PR` | `POST /api/news/pull-fmp-press-release/preflight-custom` + `tickerAddedFrom` | `POST /api/news/pull-fmp-press-release` + `mode: 'custom'` + 같은 날짜 3개 |

`openCustomPreflight()` 흐름:

1. POST로 preflight endpoint를 호출한다.
2. 성공이면 응답 데이터를 modal에 표시한다 (fullyCoveredTickers, tickersWithMissingGaps, totalMissingDays 등).
3. 사용자가 modal에서 **Continue**를 클릭하면 실제 pull job을 시작한다.
4. preflight 호출 실패 또는 non-OK 응답이면 modal을 건너뛰고 즉시 실행한다 (fallback).

- `Recent Update (Company News)`와 `Custom Update (Company News)`는 backend에서 pull 완료 후, 이번에 새로 insert된 company news row만 대상으로 `news-fulltext` job을 자동으로 이어서 시작한다.
- 따라서 사용자가 같은 시점에 `Full Text > Company News Only`를 다시 눌러야만 방금 받은 row가 추출되는 구조는 아니다. 자동 후속 fulltext job은 `GET /api/jobs/active` / `GET /api/jobs/:jobId`에 별도 `news-fulltext` job으로 나타난다.
- 이 자동 후속 job은 pull 요청 body의 `fulltextConcurrency`를 사용하고, 현재 프론트는 그 값을 `ft-concurrency`에서 읽어 보낸다. 따라서 수동 `Company News Only` fulltext와 자동 후속 company fulltext가 같은 concurrency 설정을 공유한다.

현재 코드 상태(중요):

- Finnhub News 창과 Investing News 창은 각각 `currentJobId`, `jobStatus`, `activeJobs`를 유지한다.
- 하지만 이제 `GET /api/jobs/active`의 모든 running job을 그대로 쓰지 않고, 현재 창 `scope`와 일치하는 job만 local state에 반영한다.
- Finnhub / FMP / RTPR / Change 계열 scope는 `finnhub-news`, Investing 계열 scope는 `investing-news`다.
- 따라서 Investing `news-update`가 running이어도 Finnhub 창의 `updating`은 올라가지 않고, 반대로 Finnhub / FMP / RTPR 작업도 Investing 창을 잠그지 않는다.
- `View Log` 자동 선택과 dropdown 후보도 같은 scope 안의 running job만 대상으로 한다.
- `PTPR Press Release`는 update dropdown 내부의 별도 그룹으로 노출되며, 최근/커스텀 두 모드 모두 `POST /api/news/pull-rtpr`를 호출하고 scope는 `finnhub-news`다.

중복 실행 현재 상태:

- Finnhub pull과 RTPR pull은 backend가 `409 + existingJobId`로 중복 실행을 막는다.
- 프론트는 이 `409`를 받으면 새 job을 만들지 않고 기존 `existingJobId`로 포커스를 옮기며, `View Log`를 연다.
- Change Update, Full Text Update는 현재 같은 방식의 backend duplicate guard가 없다.
- 다만 현재 프론트 전역 lock 때문에 일반적인 UI 사용 경로에서는 중복 시작이 잘 드러나지 않는다.

### Change Update 버튼

Finnhub News 창 안에도 change 계산 버튼이 있다.

- `Recent Change% Update` → `POST /api/news/change/update-recent`
- `Custom Change% Update` → 날짜 modal 후 `POST /api/news/change/update-custom`

이 버튼들은 Data Control 창의 change update와 같은 backend job을 재사용한다.

추가 동작:

- base change metric은 기존처럼 재계산한다.
- `HV`, `Z Score`는 같은 실행 안에서 이어서 채우지만, `metric_key row 없음` 또는 `value_pct IS NULL`인 경우만 대상으로 하는 missing-only fill이다.
- 즉 이미 계산된 non-null HV/Z Score 값은 덮어쓰지 않는다.

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
- FMP Stock Only
- Reset FMP PR Fallback
- Reset FMP Stock Fallback
- FMP SEC Filing Only
- Market News
- RTPR Body Backfill
- Reset Failed & Retry

API:

- `POST /api/news/fulltext/update`
- `POST /api/news/fulltext/backfill-rtpr`
- `POST /api/news/fulltext/reset-failed`
- `POST /api/news/fulltext/reset-fmp-pr-fallback`
- `POST /api/news/fulltext/reset-fmp-stock-fallback`

현재 코드 상태:

- Finnhub News 창의 일반 Update 메뉴(Finnhub/FMP/FMP SEC/Market/Calendar/PTPR/Change)는 `disabled={updating}`를 사용하지만, 이 `updating`은 `news-update + finnhub-news` running job에만 반응한다.
- Investing News 창의 Update 버튼도 같은 방식으로 `news-update + investing-news` running job에만 반응한다.
- Finnhub / FMP / RTPR Full Text 메뉴 버튼은 `disabled={ftUpdating}`를 사용하고, 이 `ftUpdating`은 `news-fulltext + finnhub-news`에만 반응한다.
- Investing Full Text 메뉴도 자기 scope의 `news-fulltext`에만 반응한다.
- `handleFulltextUpdate()`와 reset 계열 fulltext action은 같은 scope의 `ftUpdating`만 가드하고, 요청 payload에도 현재 창 `scope`를 실어 backend job metadata를 같은 scope로 생성한다.
- 반면 `handleUpdate()` 자체에는 반대 category 가드가 없다. 따라서 같은 창에서도 fulltext job running 중 일반 update 시작 시도는 가능하다.
- backend 자체는 fulltext endpoint에 Finnhub/RTPR pull과 같은 `409 + existingJobId` duplicate guard가 없다.
- 즉 현재 UX는 "앱 전역 단일 lock"이 아니라, 창별 scope 안에서 `updating` 묶음과 `ftUpdating` 묶음으로 나뉘어 있다.
- `View Log`는 backend의 여러 running job을 동시에 보여줄 수 있지만, 현재 창 scope에 속한 job만 패널에서 관찰한다.
- `Recent Update (Company News)` 또는 `Custom Update (Company News)` 직후에는 backend가 자동으로 후속 `news-fulltext` job을 생성할 수 있으므로, 같은 scope 로그 패널 dropdown에서 `news-update`와 `news-fulltext` 두 job이 연속으로 보일 수 있다.
- `FMP PR Only`는 missing-only 동작이다. 이미 `news_fulltext` row가 있는 FMP PR id는 건드리지 않는다.
- `FMP Stock Only`도 missing-only 동작이다. 잘못 저장된 fallback success row를 다시 처리하려면 `Reset FMP Stock Fallback`을 먼저 실행해야 한다.
- 기존에 잘못 저장된 FMP PR fallback success row를 다시 처리하려면 `Reset FMP PR Fallback`을 먼저 실행해 해당 row를 삭제한 뒤, 이어서 `FMP PR Only`를 실행한다.
- FMP PR fulltext는 `RTPR` 같은 다른 source body를 재사용하지 않고, FMP로 새로 적재된 기사 URL에서 직접 원문 추출한다.
- `Reset FMP Stock Fallback`은 모든 stock row를 지우는 것이 아니라, `body-fallback (no-scraper:...)`, `body-fallback (accesswire-...)`, `fmp-stock-no-scraper:...` note를 가진 old false-success / blocked row만 지운다.
- 현재 `fmp_stock_news` extractor는 allowlist publisher만 실제 scraper를 시도하고, allowlist 밖 publisher는 `unavailable (fmp-stock-no-scraper: PUBLISHER)`로 남는다.
- `RTPR Body Backfill`은 `POST /api/news/fulltext/backfill-rtpr`를 호출하며, 저장돼 있는 RTPR body를 이용해 누락된 full text를 채운다.
- `Reset Failed & Retry`는 `POST /api/news/fulltext/reset-failed` 뒤 `Full Text (All)`을 연쇄 호출한다.
- 현재 extractor는 `GlobeNewswire`, `PRNewswire`, `Newsfile Corp`, `Accesswire`, `MCAP MediaWire` 기사 페이지 본문 scrape를 시도하고, `Business Wire`는 브라우저 fallback으로 직접 추출한다.
- manual fulltext와 pull 중 auto fulltext의 concurrency source는 다르다.
  - manual `FMP PR Only` = `fmp-pr-fulltext-concurrency`
  - manual `FMP Stock Only` = `ft-concurrency`
  - pull 중 auto fulltext = 해당 pull payload의 `fulltextConcurrency`

### Log 패널

- `View Log` 버튼은 항상 보이지만 job이 없으면 disabled
- update 시작 시 로그 패널이 자동 오픈되지는 않는다
- 사용자가 직접 `View Log`를 눌러야 하단 패널이 열린다
- `Esc`로 닫기 가능
- 진행률 bar, 상태 badge, 로그 줄, 완료 result 표시

현재 코드 상태(구체):

- `GET /api/jobs/active`를 5초마다 polling해서 running job 목록을 읽고, 현재 창 scope와 일치하는 job만 `activeJobs`로 유지한다.
- `currentJobId`가 비어 있고 현재 창 scope running job이 있으면 가장 최근 same-scope job을 자동 선택하고 로그 패널을 연다.
- `activeJobs`에만 있고 상세 `/api/jobs/:jobId` 응답이 아직 안 온 상태라도, 패널은 `activeJobs`의 status/progress를 fallback으로 써서 즉시 열린다. 로그 본문은 상세 polling이 도착하는 대로 채운다.
- 같은 scope running job이 2개 이상이면 패널 헤더에 select dropdown이 나타나고, 사용자가 볼 job을 수동으로 바꿀 수 있다.
- dropdown 항목 라벨은 현재 `Job 1`, `Job 2` 형태에 가깝고 platform/mode/source를 직접 보여 주지 않는다.
- `Stop` 버튼은 현재 선택된 `currentJobId`에만 적용된다.
- `activeJobs`는 running job만 포함하므로, 완료된 job을 dropdown에서 다시 고르는 용도는 아니다.
- foreign scope job은 dropdown 후보로 들어오지 않으므로, Finnhub 창에서 Investing job 로그를 보는 일은 없다.

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

- `finhub-news-ui-state`: `visibleCols`, `displayMode`, `sourceTypeFilter`, `fromDate`, `toDate`, `selectedBookmarkFolderId`, `selectedIndustries`, `marketCapMin`, `marketCapMax`
- `terminal-workspace-v1`: 탭 순서, 탭/창 레이아웃, `isDarkMode`, `fontScale`, `newsTitleFontSize`, `newsSummaryFontSize`, `linkedTicker`
- `data-control-active-tab`: DataControl의 현재 탭(`updates | settings | appdb`)
- `ft-concurrency`: Full Text Update 동시성 설정
- `fmp-pr-fulltext-concurrency`: FMP PR manual fulltext 전용 동시성 설정
- `fmp-stock-fulltext-concurrency`: FMP Stock manual/auto fulltext 공용 동시성 설정
- `change-fmp-concurrency`: Change Update용 FMP fallback 동시성 설정
- `ibkr-concurrency`: 과거 키. 현재는 `change-fmp-concurrency`로 migration fallback만 남아 있고 저장 시 제거된다.
- `finnhub-ticker-concurrency`: Finnhub pull 대상 ticker 동시성 설정
- `finnhub-request-interval-sec`: Finnhub pull 요청 간격(초)
- `finnhub-company-news-ticker-concurrency`: Finnhub `Company News` pull 전용 ticker 동시성 설정. 값이 없으면 공용 Finnhub 동시성을 fallback으로 사용
- `finnhub-company-news-request-interval-sec`: Finnhub `Company News` pull 전용 요청 간격(초). 값이 없으면 공용 Finnhub 간격을 fallback으로 사용
- `rtpr-ticker-concurrency`: RTPR press release pull ticker 동시성 설정
- `fmp-concurrency`, `fmp-request-interval-ms`: FMP press release / stock news / SEC filing pull 설정
- `fmp-pr-page-limit`, `fmp-pr-max-pages`, `fmp-sec-max-pages`: FMP PR / Stock / SEC page 관련 설정
- `fmp-skip-existing`: FMP company description pull 설정
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
- `[][][]change_pct[][][]`
- `[][][]change_from_open_pct[][][]`
- `[][][]change_open_to_high_pct[][][]`
- `[][][]change_3d_pct[][][]`
- `[][][]change_7d_pct[][][]`
- `[][][]change_14d_pct[][][]`
- `[][][]change_30d_pct[][][]`
- `[][][]hv_change_pct[][][]`
- `[][][]hv_change_from_open_pct[][][]`
- `[][][]hv_change_open_to_high_pct[][][]`
- `[][][]hv_change_1d_pct[][][]`
- `[][][]hv_change_3d_pct[][][]`
- `[][][]hv_change_7d_pct[][][]`
- `[][][]hv_change_14d_pct[][][]`
- `[][][]hv_change_30d_pct[][][]`
- `[][][]zscore_change_pct[][][]`
- `[][][]zscore_change_from_open_pct[][][]`
- `[][][]zscore_change_open_to_high_pct[][][]`
- `[][][]zscore_change_1d_pct[][][]`
- `[][][]zscore_change_3d_pct[][][]`
- `[][][]zscore_change_7d_pct[][][]`
- `[][][]zscore_change_14d_pct[][][]`
- `[][][]zscore_change_30d_pct[][][]`
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
- `HV`, `Z Score` 묶음 컬럼도 기존 `Changes %`와 같은 8개 하위 metric 순서를 사용한다.
- `HV`, `Z Score` 묶음 컬럼의 header sort 기준은 각 묶음의 첫 줄 `Chg` 값이다.
- `Model_1 Safe` 모드에서는 `changes`, `hv`, `zscore` 세 derived price reaction 컬럼을 함께 숨긴다.
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
- `FMP Recent OHLC Fill`
- `OHLC Turnover Update`
- `Initial Calendar Backfill`
- `Refresh Upcoming Calendar`
- `Custom Calendar Update`
- `Company Description Update`
- `Yahoo Description Update`
- `Peers Data Update`
- `IPO Date Update`
- `Recent Change% Update`
- `FMP Recent Missing Change Fill`
- `Custom Change% Update`

각 섹션은 아래를 가진다.

- Update 버튼
- Log 버튼
- Last Success 시각 표시
- 에러 표시

추가 정보:

- Price 섹션은 `DB Max Date` 표시
- FMP Recent OHLC Fill 섹션은 최근 7일 누락 일봉만 FMP로 보강하고, 장 마감 전 ET 당일은 제외한다.
- OHLC Turnover 섹션은 기존 값 skip 규칙으로 turnover 백필 job을 시작한다.
- Calendar custom 섹션은 `from/to` date input 포함. **Custom Update를 시작하면 먼저 `POST /api/ibkr/calendar/update-custom/preflight`로 범위 내 기존 event 수/event 날짜 수를 확인한 뒤 modal을 띄운다. Continue를 클릭하면 실제 `POST /api/ibkr/calendar/update-custom`을 호출한다.**
- Custom Change 섹션은 `from/to` date input 포함. **Custom Update를 시작하면 먼저 `POST /api/news/change/update-custom/preflight`로 범위 내 전체 row 수, 기존 change 보유 row 수, 예상 update row 수를 확인한 뒤 modal을 띄운다. Continue를 클릭하면 실제 `POST /api/news/change/update-custom`을 호출한다.**

### 호출 API

- `POST /api/ibkr/ohlc1d/update`
- `POST /api/fmp/ohlc1d/update-recent-missing`
- `POST /api/ibkr/ohlc1d/turnover/update`
- `POST /api/ibkr/calendar/update`
- `POST /api/ibkr/calendar/update-custom/preflight`
- `POST /api/ibkr/calendar/update-custom`
- `POST /api/company-profiles/pull-fmp`
- `POST /api/company-profiles/pull-yahoo`
- `POST /api/company-profiles/pull-peers`
- `POST /api/company-profiles/pull-fmp-peers`
- `POST /api/company-profiles/pull-ipo-date`
- `POST /api/news/change/update-recent`
- `POST /api/news/change/update-recent-fmp-missing`
- `POST /api/news/change/update-custom/preflight`
- `POST /api/news/change/update-custom`
- `GET /api/jobs/:jobId`
- `GET /api/db/inspect`

change update contract:

- `POST /api/news/change/update-recent` → `{ jobId }`
  - body에 `fmpConcurrency`(기본=5), `fmpRequestIntervalMs`(기본=250ms)를 선택적으로 보낼 수 있다.
  - backend는 최근 7일 뉴스 전체를 다시 계산한다. 먼저 OHLC DB를 읽고, 비어 있는 ticker만 FMP 일봉 OHLC로 보강한 뒤 `news_change_metrics`를 다시 쓴다.
- `POST /api/news/change/update-recent-fmp-missing` → `{ jobId }`
  - body에 `fmpConcurrency`(기본=5), `fmpRequestIntervalMs`(기본=250ms)를 선택적으로 보낼 수 있다.
  - 최근 7일 뉴스 중 `change_pct`가 비어 있는 row만 대상으로 하며, 이미 계산된 row는 skip한다.
- `POST /api/fmp/ohlc1d/update-recent-missing` → `{ jobId }`
  - body에 `concurrency`(기본=10), `requestIntervalMs`(기본=25ms)를 선택적으로 보낼 수 있다.
  - default universe ticker별 DB max date 다음 날부터 recent window까지만 요청한다.
  - ET 장 마감 전에는 current ET day를 자동 제외한다.
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
  - `FMP Stock Full Text Concurrency`
  - `IBKR Fetch Concurrency`
  - `Finnhub Pull Ticker Concurrency`
  - `Finnhub Company News Pull` (company news 전용 concurrency + request interval override)
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
- `Finnhub Company News Pull` 설정은 News Feed 창에서 `Company News`만 pull할 때만 적용되고, press release / peers / IPO date 경로는 건드리지 않는다.
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
- ticker 전용 검색 input(`Ticker only`)이 별도로 있다. 이 입력은 ticker 컬럼만 필터링한다.
- custom CSV를 default universe에 merge import (`Merge into Default`)
- default universe 기준 수급/시총/보유율 갱신 버튼 3개
  - `Mkt Cap`: FMP 시가총액 갱신
  - `Float`: FMP float % 갱신
  - `Yahoo Holders`: Yahoo institutional % + insider % 갱신
  - 세 버튼 모두 진행 상황 표시(completed/total, percent) + job polling을 사용한다.
  - 각 job card는 **View Log** 토글을 통해 최대 100줄의 job 로그 패널을 연다. `Yahoo Holders`는 job 시작 시 로그 패널을 자동으로 연다.
  - job 404 감지: 서버 재시작 등으로 job이 사라지면 자동으로 에러 표시 + 상태 리셋
  - 이미 24시간 내 값이 있는 ticker는 서버에서 자동 skip된다. `Yahoo Holders`도 기본적으로 같은 24시간 skip 규칙을 따른다.
- ticker 추가
- filter 입력
- 일반 filter 입력은 ticker/name/exchange/industry/added date/ipo date를 함께 찾는다.
- `Recent Added` / `Default Order` 버튼은 빠른 preset이다. `Recent Added`를 누르면 `Added Date desc`, 다시 누르면 기본 universe 순서로 돌아간다.
- `Columns` 드롭다운에서 table 표시 컬럼을 선택할 수 있다. `Ticker`와 `Del`은 고정이고, `Name`, `Exchange`, `Industry`, `Added Date`, `IPO Date`, `Market Cap`, `Float %`, `Inst %`, `Insider %`는 checkbox로 표시/숨김을 바꾼다.
- 컬럼 선택 상태는 `localStorage`의 `default-ticker-visible-columns-v1`에 저장된다. 기본값은 모든 선택 가능 컬럼 표시이며, `Added Date`가 기본으로 보인다.
- table header 클릭으로 컬럼 정렬이 가능하다. 대상 컬럼: `Ticker`, `Name`, `Exchange`, `Industry`, `Added Date`, `IPO Date`, `Market Cap`, `Float %`, `Inst %`, `Insider %`.
- 각 header는 `asc → desc → 기본 순서 해제` 순서로 순환한다.
- 정렬 기준 문구는 header sort state를 그대로 반영한다. 정렬이 해제되면 `기본 universe 순서`로 표시한다.
- 기본 table 표시: `Ticker | Name | Exchange | Industry | Added Date | IPO Date | Market Cap | Float % | Inst % | Insider % | Del`
- 사용자가 컬럼을 숨기면 table header/body/grid 폭이 선택된 컬럼 목록 기준으로 다시 계산된다. 숨긴 컬럼으로 정렬 중이었다면 정렬은 기본 universe 순서로 해제된다.
- `Market Cap`, `Float %`, `Inst %`, `Insider %` 셀에는 값 옆에 source badge가 붙는다.
  - 현재 구현 기준 `Market Cap = FMP`, `Float % = Fmp`, `Inst % = Yahoo`, `Insider % = Yahoo`
  - `Inst %`는 현재 Finnhub 값을 읽지 않고 Yahoo holders 값만 사용한다.
- ticker 클릭 시 상위 `onTickerClick` 전달
- ticker가 있는 창에서는 ticker 클릭 시 `Company Description` window가 열린다. linked ticker 동작이 있는 창은 기존 연동도 유지한다.
- ticker에 마우스를 3초 이상 올리면 hover preview가 뜨고, 마우스를 다시 빼면 preview는 즉시 사라진다.
- 삭제 버튼으로 default universe에서 ticker 제거
- 이미 default universe에 있는 ticker를 다시 Add하면 backend가 `409`를 반환하고, UI는 error banner로 `already exists in default universe`를 보여준다.

API:

- `GET /api/tickers?csvPath=...`
- `POST /api/tickers/import-default`
- `POST /api/tickers/add`
- `DELETE /api/tickers/remove`
- `POST /api/company-profiles/pull-market-cap`
- `POST /api/company-profiles/pull-float`
- `POST /api/company-profiles/pull-holders-yahoo`
- `GET /api/jobs/:jobId`

`GET /api/tickers` 응답에서 프론트가 실제로 쓰는 row 필드:

- `[][][]ticker[][][]`
- `[][][]exchange[][][]`
- `[][][]name[][][]`
- `[][][]sector[][][]`
- `[][][]addedAt[][][]`
- `[][][]industry[][][]`
- `[][][]ipoDate[][][]`
- `[][][]marketCap[][][]`
- `[][][]floatPct[][][]`
- `[][][]insiderPct[][][]`
- `[][][]institutionalPct[][][]`
- `[][][]marketCapSource[][][]`
- `[][][]floatSource[][][]`
- `[][][]insiderSource[][][]`
- `[][][]institutionalSource[][][]`

현재 제약:

- 허용 경로는 backend allowlist에 의해 제한된다
- UI는 어떤 CSV든 입력 가능해 보이지만, backend가 허용하지 않으면 error banner를 보여준다
- custom CSV를 merge import해도 기존 default universe ticker는 제거되지 않고, 중복만 skip된다
- `Mkt Cap`, `Float`, `Yahoo Holders` 버튼은 기본 default path일 때만 보인다. custom CSV view에서는 merge/import가 우선이다.
- custom CSV view에서는 `Added Date`, 수급/시총/insider 컬럼과 source badge가 대부분 `null`이라 `-`로 보일 수 있다.

성능 메모(2026-03-25 반영):

- 기능 변화 없이 렉을 줄이기 위해 row 렌더링은 가상 리스트(`react-window`)를 사용한다.
- filter input 값은 즉시 저장되지만, 실제 row filtering은 `useDeferredValue` 기준으로 한 박자 늦춰 heavy re-render를 줄인다.
- 헤더는 고정하고, body row만 virtualization 대상으로 유지한다.
- 데이터/API/job polling semantics는 그대로고, 화면에 동시에 그리는 row 수만 줄인다.

## Daily Change History Window

파일: `src/app/components/DailyChangeHistoryWindow.tsx`

현재 상태:

- 실제 backend API 연동이 있는 정식 창이다.
- Add Tab Modal에서 직접 선택 가능하고, `WindowType`에도 `daily-change-history`로 등록돼 있다.
- 기본 조회는 `GET /api/default-tickers/daily-change-history`를 사용한다.
- 날짜 입력이 비어 있으면 backend가 `availableMaxDate`를 기준으로 가장 최근 stable date를 자동 적용한다.
- 상단에는 단일 `date picker`, `Market Cap Min`, `Market Cap Max`, `Turnover Min`, `Turnover Max`, `Apply`, `Reset`, `Refresh`가 있다.
- 같은 헤더 영역에 `Recent Change Update`, `FMP Missing Change Fill`, `Custom Change Update` 버튼도 보인다.
- 세 버튼은 Data Control의 동일 backend job route를 재사용하고, 실행 중에는 간단한 job 상태 문구를 표시한다.
- `Custom Change Update`를 누르면 date-range popup이 열리고, `From`, `To`를 직접 고를 수 있다.
- popup 안의 `Calculate Scope`는 `/api/news/change/update-custom/preflight`를 호출해 범위 내 전체 뉴스 row 수, 기존 change 보유 row 수, 실제 업데이트 예상 row 수를 계산해 보여준다.
- popup 안의 `Start Custom Update`는 선택한 기간 전체를 대상으로 `/api/news/change/update-custom`을 실행한다.
- market cap / turnover input은 raw number뿐 아니라 `500M`, `1B`, `2.5B` 같은 shorthand 입력도 받는다.
- filter는 입력 즉시 반영되지 않고, 사용자가 `Apply`를 눌렀을 때만 backend를 다시 호출한다.
- 마지막으로 적용된 filter는 `daily-change-history-ui-state` localStorage key에 저장된다.
- summary는 filtered dataset 기준으로 두 세트를 보여준다.
  - `Daily Change %` 기준 `Gainers`, `Losers`, `Flat`, `Missing`, `Total`
  - `Close From Open %` 기준 `Gainers`, `Losers`, `Flat`, `Missing`, `Total`
- table은 ticker별 상세 row를 보여주며, `Missing` row도 제거하지 않고 남긴다.
- column visibility chip으로 `Name`, `Date`, `Close`, `Close From Open %`, `Turnover`, `Market Cap`, `Industry`를 켜고 끌 수 있다.
- 각 header 클릭으로 asc/desc 정렬이 가능하다. 현재 sort state도 같은 localStorage key에 함께 저장된다.

표 컬럼:

- `[][][]ticker[][][]`
- `[][][]name[][][]`
- `[][][]date[][][]`
- `[][][]close[][][]`
- `[][][]dailyChangePct[][][]`
- `[][][]closeFromOpenPct[][][]`
- `[][][]turnover[][][]`
- `[][][]marketCap[][][]`
- `[][][]industry[][][]`

응답/표시 규칙:

- `dailyChangePct > 0`이면 gainers, `< 0`이면 losers, `= 0`이면 flat다.
- `dailyChangePct = null`이면 daily-change summary에서 `Missing`으로 집계되고 table row도 그대로 남는다.
- `closeFromOpenPct > 0`이면 close-from-open summary에서 gainers, `< 0`이면 losers, `= 0`이면 flat다.
- `closeFromOpenPct = null`이면 close-from-open summary에서 `Missing`으로 집계된다.
- table의 `Close From Open %` cell도 `+`면 초록색, `-`면 빨간색, `null`이면 amber tone으로 표시한다.
- market cap filter가 하나라도 들어오면 `marketCap = null` row는 제외된다.
- turnover filter가 하나라도 들어오면 `turnover = null` row는 제외된다.
- backend는 저장된 derived value가 있으면 우선 사용하고, 없으면 `Apply` 시점 응답에서 즉시 계산한 값을 내려준다. turnover도 같은 규칙을 따른다.
- ticker cell 클릭 시 상위 `onTickerClick`으로 ticker가 전달된다.
- change update job이 `done`이 되면 현재 창은 같은 filter로 자동 refresh를 다시 호출한다.

현재 제약:

- table row 수가 많을 수 있지만 현재는 일반 scroll table이다. virtualization은 아직 적용하지 않았다.
- draft filter와 applied filter를 별도 badge로 나누지는 않고, 상단 summary 문구로 현재 적용 상태를 보여준다.

## Investing News Window

파일: `src/app/components/InvestingNewsWindow.tsx`

현재 상태:

- 실제 backend API 연동이 있는 정식 창이다.
- Add Tab Modal에서 직접 선택 가능하고, `WindowType`에도 `investing-news`로 등록돼 있다.
- 기본 조회는 `GET /api/news`를 사용하되 `[][][]source_type[][][]`를 `investing_stock_market_news`, `investing_cryptocurrency_news`로 제한한다.
- 업데이트는 `POST /api/news/pull-investing`를 호출하며, `stock-market-news` / `cryptocurrency-news` category와 recent/custom date range를 payload로 넘긴다.
- 별도 full text popup이 있고 `GET /api/news/:id/fulltext` 계열 응답을 사용한다.
- 북마크 폴더 필터와 `BookmarkManager`가 연결되어 있다.
- display mode, category filter, 날짜 범위, 정렬 상태 등은 `investing-news-ui-state`에 저장된다.

표 컬럼:

- `[][][]date[][][]`
- `[][][]time[][][]`
- `[][][]title[][][]`
- `[][][]category[][][]`
- `[][][]fulltext[][][]`

행 높이:

- title only: 96px
- title + abstract: 148px

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
- 다만 `[][][]price[][][]`, `[][][]change[][][]`, `[][][]changePercent[][][]`는 backend 실시간 시세가 아니라 프론트 `TICKER_DB` fallback 값이 채워질 수 있다.
- 즉 리스트 membership/source of truth는 backend DB지만, 일부 표시용 quote/name 데이터는 프론트 보조 lookup과 섞여 있는 hybrid 상태다.

## Calendar Window

파일: `src/app/components/CalendarWindow.tsx`

현재 상태:

- backend API 연동 있음
- `GET /api/calendar/types`로 탭 목록을 읽는다.
- `GET /api/calendar/events`로 현재 탭 + 날짜 범위 데이터를 읽는다.
  - economics를 제외한 탭에서는 선택된 watchlist가 있으면 `watchlist_id` query를 함께 보낸다.
  - economics를 제외한 탭에서는 선택된 industry가 있으면 `industries` 반복 query도 함께 보낸다.
- `GET /api/industries`로 industry dropdown option을 읽는다.
  - 메뉴 상단 검색 input으로 industry 명칭을 부분 검색한다.
  - `All Industries`는 filter 없음 상태이지만 UI에서는 모든 industry checkbox가 체크된다.
  - 전체 선택 상태에서 특정 checkbox를 해제하면 전체 목록에서 해당 industry만 빠진 명시 선택 배열로 바뀌고, 그 배열을 `industries` 반복 query로 보낸다.
- ticker 우클릭 `Financial` dialog를 열 때 `GET /api/calendar/financials/:ticker`로 annual / quarterly 재무 series를 읽는다.
- earnings 탭에서 `POST /api/fmp/calendar/earnings/update`를 실행하고 `GET /api/jobs/:jobId`로 polling 한다.
- earnings 탭에서 `POST /api/fmp/calendar/financials/update`도 실행할 수 있고, 같은 `GET /api/jobs/:jobId` polling 패턴으로 default ticker financial history sync 상태를 보여준다.
- IPO 탭에서 `POST /api/fmp/calendar/ipos/update`, `POST /api/fmp/calendar/ipos/sec-download`를 실행하고 같은 `GET /api/jobs/:jobId` polling 패턴을 사용한다.
- economics를 제외한 탭에서는 `POST /api/company-profiles/pull-yahoo`를 실행하는 `Update Yahoo Desc` 버튼을 표시한다.
  - 현재 active tab에서 로드된 row의 `ticker`를 중복 제거해 `tickers` body로 보낸다.
  - Yahoo 실행 설정은 Data Control 창과 같은 localStorage key(`yahoo-concurrency`, `yahoo-request-interval-ms`, `yahoo-skip-existing`)를 읽어 사용한다.
- economics를 제외한 탭에서는 `POST /api/company-profiles/pull-fmp-peers`를 실행하는 `Update FMP Peers` 버튼도 표시한다.
  - 현재 active tab에서 로드된 row의 `ticker`를 중복 제거해 `tickers` body로 보낸다.
  - body는 `[][][]skipExisting[][][]=true`, `[][][]concurrency[][][]=5`, `[][][]requestIntervalMs[][][]=250`을 사용한다.
  - job 완료 뒤 Calendar events를 다시 읽어 `[][][]peers[][][]` 컬럼 값이 갱신된다.
- earnings 탭의 회사 IPO date(`ipo_date`), peers(`peers`), industry / ownership(`float_pct`, `institutional_pct`, `insider_pct`)는 column selector에서 켜고 끌 수 있다.
  - `peers` cell은 저장된 ticker 배열 전체를 chip으로 렌더링한다. 컬럼 폭/높이가 부족하면 overflow로 가려질 수 있지만 `+N` 축약 badge로 데이터를 생략하지 않는다.
- IPO direct/SEC 컬럼(`ipo_date`, `company_name`, `exchange`, `status`, `price_range`, `shares`, `offer_amount`, `company_description`, `sec_max_owner_pct`, `sec_total_owner_pct`, `prospectus_url`, `disclosure_url`)도 column selector에서 켜고 끌 수 있다.
- earnings에서는 `Inst %`, `Float %`, `Market Cap(B$)` min/max 숫자 필터를 사용할 수 있다.
- dividends / splits에서는 `Market Cap(B$)` min/max 숫자 필터를 사용할 수 있다.

현재 구현 요약:

- date range는 HTML date input이며, 값이 있으면 API query `from/to`로 바로 전달된다.
  - 상단 `Quick Range` 버튼(`This Week`, `Next 5 Days`, `Next 2 Weeks`, `This Month`, `Next Month`)을 누르면 해당 날짜 범위가 즉시 input에 채워진다.
  - date input을 직접 수정하면 active preset highlight는 해제된다.
- `from`과 `to`가 둘 다 지정되기 전에는 `GET /api/calendar/events`를 호출하지 않는다.
  - 이 상태에서는 row table 대신 날짜 범위를 먼저 선택하라는 안내 메시지를 보여준다.
  - Reset 후에도 같은 대기 상태로 돌아간다.
- economics를 제외한 탭에서는 watchlist dropdown을 표시한다.
  - 목록은 `GET /api/watchlists`에서 읽는다.
  - 선택값은 `calendar-window-ui-state` localStorage에 저장되어 Calendar 창을 떠났다가 돌아와도 유지된다.
  - 선택 시 server-side `watchlist_id` filter가 걸린 결과 집합으로 다시 fetch한다.
- economics를 제외한 탭에서는 industry dropdown도 표시한다.
  - 목록은 `GET /api/industries`에서 읽는다.
  - 메뉴 항목은 checkbox이며 여러 industry를 동시에 선택할 수 있다.
  - 선택값은 `calendar-window-ui-state` localStorage에 저장되어 Calendar 창을 떠났다가 돌아와도 유지된다.
  - 체크된 industry 목록은 메뉴 안에서 이름을 붙여 저장할 수 있고, 저장된 filter preset은 `calendar-industry-filter-presets-v1` localStorage에 보관된다.
  - 저장된 filter preset의 `Apply`를 누르면 해당 preset의 industry 목록이 `selectedIndustries`로 들어가며, 기존 `industries` 반복 query를 통해 server-side 필터가 즉시 다시 적용된다.
  - 저장된 filter preset은 메뉴 안의 delete 버튼으로 삭제할 수 있다. 삭제는 preset 목록만 지우며 현재 적용된 industry 선택값은 유지한다.
  - 선택 시 server-side `industries` filter가 걸린 결과 집합으로 다시 fetch한다.
  - 개별 industry row를 우클릭하면 `Instruction` 버튼이 뜬다. 버튼을 누르면 `GET /api/industries/detail?industry=...`를 호출해 industry 설명, ticker 수, market cap 보유 수, sector 요약, 시총순 ticker table을 dialog로 표시한다.
- Calendar UI 상태는 `calendar-window-ui-state` localStorage에 저장된다.
  - 저장 대상: active tab, date range, quick range 선택값, search, sort, column visibility/order/width, watchlist, industry, IPO security type, 숫자 필터, earnings confirmed filter.
  - 저장하지 않는 대상: 실행 중인 job 상태, menu open/close 상태, ticker context menu, financial dialog target.
- 기본 날짜 정렬은 늦은 날짜 우선(`desc`)이다.
  - 초기 진입, 탭 전환, Reset 모두 이 기준을 사용한다.
- search는 client-side로 `ticker`, `company`, `title`, `industry`, `source`, `status`, `company_description`을 대상으로 동작한다.
- ticker chip interaction은 좌/우 클릭이 분리돼 있다.
  - 좌클릭: 기존 linked ticker 동작과 함께 `Company Description` window 열기
  - 우클릭: context menu 열기
  - context menu의 `Financial` action: annual / quarterly toggle dialog 열기
- 숫자 범위 필터는 현재 fetch된 row 집합에 대해 client-side로 즉시 적용된다.
  - `Inst %`, `Float %`는 퍼센트 값 그대로 비교한다.
  - `Market Cap` 입력 단위는 `B$`이며, 프론트에서 내부 비교 시 실제 달러 값으로 환산한다.
  - 숫자 필터가 켜져 있을 때 해당 값이 `null`인 row는 결과에서 제외된다.
- table header는 drag reorder를 지원한다.
  - visible column만 현재 순서 기준으로 drag-and-drop 할 수 있다.
  - 각 header 오른쪽 resize handle을 드래그해 column width를 px 단위로 조정할 수 있다.
  - column visibility, order, width는 `calendar-window-ui-state` localStorage에 저장된다.
  - 새로고침 직후 backend column config를 다시 받기 전에도 저장된 column order/width를 보존하고, backend config 로드 후 새 컬럼만 뒤에 append한다.
  - column resize 최소 폭은 44px이다.
- earnings stable source에는 reliable time/session이 없으므로, 관련 column 값은 비어 있을 수 있다.
- earnings 탭에는 `FMP Sync Settings` 버튼이 있고, 여기서 다음 실행에 쓸 concurrency 값을 수정할 수 있다.
  - `Earnings Update` concurrency
  - `Financial Sync` concurrency
  - 값은 localStorage `calendar-fmp-earnings-concurrency`, `calendar-fmp-financial-concurrency`에 저장된다.
- earnings `Update FMP Earnings Dates` 버튼은 현재 date filter가 있으면 그 범위를 body에 같이 보내고, 현재 설정된 earnings concurrency도 함께 보낸다.
- earnings `Sync Financial + Past Estimates` 버튼은 현재 date filter와 무관하게 default universe 전체를 대상으로 실행되며, 현재 설정된 financial sync concurrency를 body에 같이 보낸다.
  - 목적은 ticker financial history뿐 아니라 past quarterly estimate cache까지 다시 적재하는 것이다.
- `Update FMP Peers` 버튼은 현재 화면에 로드된 ticker만 대상으로 `POST /api/company-profiles/pull-fmp-peers`를 실행한다. 이미 `company_profiles.peers_json`이 non-empty인 ticker는 backend에서 건너뛴다.
- earnings 화면은 현재 필터 결과 기준 `Confirmed / Pending` count를 함께 보여준다.
  - 현재 범위가 confirmed-only면 종료일을 더 미래로 늘리라는 안내를 같이 표시한다.
- IPO 탭의 `Download SEC Data` 버튼은 선택한 날짜 범위가 있어야 활성화된다.
- IPO 탭 기본 visible 컬럼은 `IPO Date`, `Symbol`, `Company`, `Industry`, `Inst %`, `Insider %`, `Exchange`, `Status`, `Price Range`, `Shares`, `Offer Amount`, `Description`, `SEC Max %`다.
- earnings update는 같은 범위에 대해 append가 아니라 snapshot replace다.
  - 즉 같은 범위를 다시 실행하면 기존 FMP earnings row를 해당 범위에서 먼저 정리한 뒤 현재 source snapshot으로 다시 채운다.
  - 따라서 earnings date가 바뀌었을 때 같은 범위를 재동기화하면 예전 날짜 row가 남아 누적되지 않는다.
- IPO update도 같은 범위에서 snapshot replace다. 다만 SEC-derived description/ownership는 별도 저장소에 유지되므로 FMP snapshot refresh만으로 사라지지 않는다.
- IPO update는 snapshot replace 뒤 best-effort FMP/Yahoo profile sync를 추가로 수행하므로, provider coverage가 있는 ticker는 `industry`나 `company_description`이 같은 refresh 직후 바로 보일 수 있다.
- 반대로 future IPO ticker profile/holders source가 비어 있으면 `industry`, `institutional_pct`, `insider_pct`, `float_pct`는 계속 `null`일 수 있다.
- IPO SEC ownership 컬럼은 post-listing public holders summary가 아니라 prospectus/disclosure 본문에서 파싱한 named-owner percentages다.
- financial dialog는 3개 chart group을 표시한다.
  - `Revenue`: actual revenue bar + estimate dashed line
  - `Earnings`: actual net income/EPS + estimate dashed lines
  - `Valuation`: `P/E`, `P/S` history
- financial dialog summary card는 가장 마지막 future estimate-only point가 아니라, 가능하면 가장 최근 reported actual period를 기준으로 보여주고 estimate가 있으면 `Est.` 보조 텍스트를 함께 표시한다.
- dialog subtitle에는 data source가 `income statement + key metrics + ratios + analyst estimates`임을 명시한다.
- financial dialog는 `Historical Actual vs Estimate` 비교표를 추가로 표시한다.
  - annual의 경우 같은 회계연도 actual과 estimate를 한 줄에 붙여 과거 miss/beat를 직접 비교할 수 있어야 한다.
  - quarterly의 경우 future-only estimate row보다 latest actual window의 historical period를 우선 보여줘야 한다.
- valuation ratio는 backend가 FMP `ratios` 값을 우선 사용하고, 비어 있으면 `marketCap / netIncome`, `marketCap / revenue` fallback을 계산해 내려준다.

## Case Description Window

파일: `src/app/components/CaseDescriptionWindow.tsx`

현재 상태:

- Add Tab Modal에서 직접 고르는 창은 아니다.
- `EvidenceTableWindow`가 row 클릭 시 `open-case-description` custom event를 dispatch하면 같은 탭 안에서 동적으로 열린다.
- payload는 `caseType`, `caseLabelKo`, `description`, `classificationBasis`, `keywordSignals`, `boundaryCase`, `quickQuestions` 등을 포함한다.
- source of truth는 localStorage가 아니라 `EvidenceTableWindow`가 들고 있는 case metadata다.

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

## Evidence Table Window

파일: `src/app/components/EvidenceTableWindow.tsx`

이 창은 Model_2 분석 결과를 읽는 전용 evidence browser다. source of truth는 backend의 `model2_analysis_runs`, `model2_case_summaries`, `model2_evidence_rows`이며, localStorage를 사용하지 않는다.

### 초기 로드 구조

1. `GET /api/model2/analyses`
2. 선택된 `analysisId` 기준으로 `GET /api/model2/analyses/:analysisId/cases`
3. 같은 `analysisId` 기준으로 `GET /api/model2/analyses/:analysisId/evidence?...`

초기 동작 규칙:

- analyses 목록이 비어 있지 않으면 첫 번째 run을 자동 선택한다.
- analysis가 바뀌면 `selectedCaseType`은 자동으로 `all`로 리셋된다.
- analyses 로드 실패 시 3초 뒤 재시도 effect가 한 번 더 돈다.

### 툴바 구성

- Analysis dropdown: 저장된 analysis run 선택
- Case dropdown: case summary 목록 선택
- Keyword search: 250ms debounce
- Ticker search: 250ms debounce, 입력 즉시 대문자화
- Row limit: `100 | 300 | 500 | 1000`
- Refresh: analyses + cases + evidence를 다시 fetch

### Evidence API query 구조

`GET /api/model2/analyses/:analysisId/evidence` 호출 시 현재 프론트가 보내는 query는 아래와 같다.

- `caseType`: `all`이 아닐 때만 전송
- `keyword`: 공백 제거 후 값이 있을 때만 전송
- `ticker`: 공백 제거 후 대문자로 만들어 전송
- `sortBy`: `published_at | ticker | title | publisher | case_type | reaction_tag | impact_score`
- `sortDir`: `asc | desc`
- `limit`: `100 | 300 | 500 | 1000`

정렬 규칙:

- 첫 기본값은 `sortBy='published_at'`, `sortDir='desc'`
- 같은 헤더를 다시 누르면 `desc ↔ asc` 토글
- 다른 헤더를 누르면 그 컬럼 기준 `desc`로 다시 시작

### Case 설명 창 열기 구조

- case dropdown의 각 항목은 우클릭 컨텍스트 메뉴를 지원한다.
- 우클릭 후 설명 열기 동작을 선택하면 `openDescriptionWindow()`가 호출된다.
- 이 함수는 backend를 다시 호출하지 않고, `getModel2CaseDescription(caseType)`로 로컬 taxonomy 정의를 읽는다.
- 그 결과를 `window.dispatchEvent(new CustomEvent('open-case-description', { detail: payload }))`로 App에 전달한다.

### 화면 하단 상태 줄

- 선택된 analysis의 `since → until`
- 현재 row 표시 수 `rows.length / total`
- `Analyzable / Impacted / 잡것들` aggregate 수치
- description 창을 여는 방법 안내 문구
- 현재 에러 또는 empty 상태

## Case Description Window

파일: `src/app/components/CaseDescriptionWindow.tsx`

이 창은 Add Tab Modal에서 직접 생성하는 창이 아니라, Evidence Table에서 case 설명을 열 때만 programmatic하게 추가되는 보조 창이다.

생성 구조:

- `App.tsx`가 전역 `open-case-description` 이벤트를 listen 한다.
- 이벤트 payload는 `CaseDescriptionWindowData` 타입이다.
- 현재 active tab 안에서 같은 `caseType`의 `case-description` 창이 이미 있으면 새 창을 만들지 않고 기존 창의 title/data만 갱신한다.
- 없으면 `id = ${Date.now()}-case-description-${caseType}` 형식의 새 창을 추가한다.

데이터 구조:

- backend API를 호출하지 않는다.
- `model2CaseDescriptions.ts`의 taxonomy seed와 Evidence Table이 전달한 `caseType`, `caseLabelKo`, `topLevel`를 합쳐 렌더링한다.

표시 섹션:

- top-level badge + case label
- `Description`
- `분류 기준`
- `분류 키워드`
- `한 줄 정의`
- `핵심 가치 경로`
- `포함 신호`
- `제외 신호`
- `경계 사례`
- `빠른 판별 질문`

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
- `POST /api/news/pull-finhub/preflight-custom`
- `POST /api/news/pull-investing`
- `POST /api/news/pull-investing/preflight-custom`
- `GET /api/news/pull-finhub/preflight`
- `POST /api/news/pull-rtpr`
- `POST /api/news/pull-rtpr/preflight-custom`
- `POST /api/news/pull-fmp-press-release`
- `POST /api/news/pull-fmp-press-release/preflight-custom`
- `POST /api/news/pull-fmp-stock-news`
- `POST /api/news/pull-fmp-stock-news/preflight-custom`
- `POST /api/news/pull-fmp-sec-filing`
- `POST /api/news/pull-fmp-sec-filing/preflight-custom`
- `POST /api/news/change/update-recent`
- `POST /api/news/change/update-custom/preflight`
- `POST /api/news/change/update-custom`
- `GET /api/news/fulltext/:newsId`
- `POST /api/news/fulltext/update`
- `POST /api/news/fulltext/backfill-rtpr`
- `POST /api/news/fulltext/reset-failed`
- `POST /api/news/fulltext/reset-fmp-pr-fallback`
- `POST /api/news/fulltext/reset-fmp-stock-fallback`
- `GET /api/updates/status`
- `GET /api/ibkr/ohlc1d/status`
- `POST /api/ibkr/ohlc1d/update`
- `POST /api/ibkr/calendar/update`
- `POST /api/ibkr/calendar/update-custom/preflight`
- `POST /api/ibkr/calendar/update-custom`
- `GET /api/jobs/:jobId`
- `GET /api/tickers`
- `POST /api/tickers/import-default`
- `POST /api/tickers/add`
- `DELETE /api/tickers/remove`
- `GET /api/watchlists`
- `POST /api/watchlists`
- `PUT /api/watchlists/:id`
- `DELETE /api/watchlists/:id`
- `POST /api/company-profiles/pull-market-cap`
- `POST /api/company-profiles/pull-float`
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
- `GET /api/model2/analyses`
- `GET /api/model2/analyses/:analysisId`
- `GET /api/model2/analyses/:analysisId/cases`
- `GET /api/model2/analyses/:analysisId/evidence`
- `DELETE /api/model2/analyses/:analysisId`
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
- default ticker의 시가총액/float/institutional/Yahoo holders 보강도 각각 job을 시작한 뒤 `GET /api/jobs/:jobId` polling으로 완료를 기다린다.
- default ticker의 market cap / float / institutional / insider 값은 프론트 local state가 아니라 backend `company_profiles` 기반이다.
- source badge는 프론트에서 계산하지 않고 backend가 내려주는 `marketCapSource`, `floatSource`, `institutionalSource`, `insiderSource` 값을 그대로 사용한다.
- case research의 섹션/페이지 데이터는 localStorage가 아니라 backend DB에 저장된다.
- `CalendarWindow`의 FMP earnings update는 backend job + polling 계약으로 동작한다.
- 단, `DataControlWindow`의 IBKR calendar update 섹션은 여전히 backend 동기 응답형 endpoint를 사용한다.
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
- `src/app/components/CalendarWindow.tsx`: API 기반 calendar 창
- `src/app/components/CalendarFinancialDialog.tsx`: Calendar ticker 우클릭 financial chart dialog
- `src/app/components/BraveNewsWindow.tsx`: 미연결 잔존 파일
- `vite.config.ts`: `/api`, `/healthz` proxy 설정

## 현재 한계와 주의점

- active window 중 backend와 완전히 맞물려 있는 것은 `Finnhub News`, `Default Ticker`, `Data Control`, `AI Research Window`, `Evidence Table` 중심이다.
- `NewsWindow`는 일부 backend를 사용하지만 현재 운영 기준의 주력 뉴스 창은 아니다.
- `CalendarWindow`는 backend `calendar_events`, FMP earnings / IPO job, ticker financial history API와 연결되어 있다.
- `WatchlistWindow`는 여전히 UI만 있고 운영 데이터와 연결되어 있지 않다.
- `keywords`는 backend 응답으로 내려오고 `DEFAULT_COLUMNS`에 포함되어 있으며 컬럼 매뉴에서 표시/숨김 가능하다. 단 기본 숨김 상태다.
- `DataControlWindow`의 calendar 섹션은 backend가 `jobId`를 돌려준다고 가정하는 UI지만, 실제 backend는 현재 즉시 결과 응답형이다.
- `BraveNewsWindow`는 사실상 보관 파일에 가깝다. 새 작업은 여기에 붙이지 않는 편이 안전하다.
