## EN

## Required Acceptance Tests

### AT-01: Combined Filters
Given the news dataset contains:
- item A: ticker=`NVDA`, body includes `earnings`
- item B: ticker=`NVDA`, body excludes `earnings`
- item C: ticker=`TSLA`, body includes `earnings`

When user searches in `/news` with:
- keyword=`earnings`
- tickers=`NVDA`

Then:
- item A appears
- item B does not appear
- item C does not appear

### AT-02: Saved View Restore
Given user sets filters in `/news` and saves view `My Earnings NVDA`
When user later selects `My Earnings NVDA` in Saved Views
Then all filter controls restore to the saved values and list reflects those filters.

### AT-03: Watchlist Cross-Tool Pin
Given watchlist `My Day Trade` contains tickers `NVDA,TSLA`
When user chooses `My Day Trade` as pinned watchlist
Then:
- `/news` ticker filter auto-fills with `NVDA,TSLA`
- `/calendar` requests include ticker filters `NVDA,TSLA`

### AT-04: Realtime Stream Dedup by ID
Given SSE stream sends duplicate `news_item` events with same `id`
When `/news` receives both events
Then list includes exactly one row for that `id`.

### AT-05: Polling Fallback
Given realtime toggle is OFF
When new news is inserted in backend
Then `/news` updates via polling within 10 seconds without page refresh.

### AT-06: New Items Button + Pause Queue
Given user is on `/news`
When new items arrive:
- if paused, they queue and count increases
- if not paused, count increases and items prepend
Then clicking `New items (N)` merges queued items (if any) and scrolls to top.

### AT-07: News Detail Panel
Given user clicks a feed row
When `/api/news/:id` returns item detail
Then detail panel shows headline, time, tickers, source, full text, and link.

### AT-08: Calendar Filter + Sort
Given calendar has mixed event types and tickers
When user applies type filter + pinned ticker filter + sort selection
Then table rows only match filters and follow selected sort order.

### AT-08A: Calendar Type Switching
Given `/calendar` default type is `earnings`
When user switches type to `dividends`, `splits`, `analyst_ratings`, `sec_filings`, `economics`
Then table columns and available type-specific filters change accordingly.

### AT-08B: Watchlist Filter (Calendar)
Given watchlist `My Day Trade` contains `NVDA,TSLA`
When user applies `watchlist_id=My Day Trade` on calendar events endpoint
Then ticker-bearing events only include `NVDA` or `TSLA` rows.

### AT-08C: Earnings Time-of-Day Filter
Given earnings events include `time_of_day` values BMO/AMC/Unknown
When user selects `time_of_day=AMC`
Then only AMC earnings rows are returned.

### AT-08D: Economics Region Filter
Given economics events exist for multiple countries
When user filters region/country `US`
Then only US economics events are returned.

### AT-08E: Calendar Detail Drawer JSON
Given user clicks a calendar row
When detail endpoint returns fields JSON
Then detail drawer renders all JSON fields and any link field is clickable.

### AT-08F: Calendar Export CSV
Given user applies filters and sort in calendar view
When user clicks Export CSV
Then downloaded CSV rows and column order match the currently filtered and sorted result set.

### AT-08G: Calendar → News Cross-Link
Given user clicks `Open News` on a calendar row with ticker and event time
When News page opens
Then ticker and around-time filters are prefilled on `/news`.

### AT-09: Alerts Hook Persistence
Given user creates alert rule in `/settings/alerts` with methods browser+sound
When page reloads
Then rule remains present with same tool, enabled flag, and methods.

### AT-10: API Contract Checks
Verify these endpoints respond with expected payload shape and status codes:
- `GET /api/news`
- `GET /api/news/:id`
- `POST/GET/DELETE /api/news/saved-views`
- `GET/POST/DELETE /api/watchlists`
- `GET /api/calendar/types`
- `GET /api/calendar/events`
- `GET /api/calendar/events/:id`
- `GET /api/calendar/events/export.csv`
- `GET/POST /api/settings/alerts`
- `GET /api/news/stream` (SSE frames with `{type:"news_item", payload:{...}}`)

---

## KO

## 필수 인수 테스트

### AT-01: 복합 필터
뉴스 데이터가 다음을 포함할 때:
- 항목 A: ticker=`NVDA`, 본문에 `earnings` 포함
- 항목 B: ticker=`NVDA`, 본문에 `earnings` 미포함
- 항목 C: ticker=`TSLA`, 본문에 `earnings` 포함

사용자가 `/news`에서 다음으로 검색하면:
- keyword=`earnings`
- tickers=`NVDA`

결과:
- 항목 A는 보여야 함
- 항목 B는 보이면 안 됨
- 항목 C는 보이면 안 됨

### AT-02: Saved View 복원
사용자가 `/news`에서 필터를 설정하고 `My Earnings NVDA`로 저장했을 때,
이후 Saved Views에서 `My Earnings NVDA`를 선택하면,
모든 필터 컨트롤이 저장값으로 복원되고 목록도 동일 조건으로 반영되어야 함.

### AT-03: 워치리스트 크로스툴 핀
워치리스트 `My Day Trade`에 `NVDA,TSLA`가 있을 때,
사용자가 해당 워치리스트를 핀으로 선택하면,
- `/news` 티커 필터가 `NVDA,TSLA`로 자동 채워지고
- `/calendar` 요청에도 `NVDA,TSLA` 티커 필터가 포함되어야 함.

### AT-04: 실시간 스트림 ID 중복 제거
SSE 스트림이 동일 `id`의 `news_item` 이벤트를 중복 전송할 때,
`/news`가 두 이벤트를 받아도
목록에는 해당 `id`가 정확히 1행만 표시되어야 함.

### AT-05: 폴링 폴백
실시간 토글이 OFF일 때,
백엔드에 새 뉴스가 삽입되면,
페이지 새로고침 없이 10초 이내 폴링으로 `/news`에 반영되어야 함.

### AT-06: New Items 버튼 + Pause 큐
사용자가 `/news`에 있을 때 새 뉴스가 도착하면:
- pause 상태면 큐에 쌓이고 카운트 증가
- pause 해제 상태면 목록 상단 prepend + 카운트 증가
그리고 `New items (N)` 클릭 시 큐를 합치고 상단으로 스크롤되어야 함.

### AT-07: 뉴스 상세 패널
사용자가 피드 행을 클릭했을 때,
`/api/news/:id` 응답으로
상세 패널에 제목, 시간, 티커, 소스, 본문, 링크가 표시되어야 함.

### AT-08: 캘린더 필터 + 정렬
캘린더에 다양한 이벤트 타입/티커가 있을 때,
사용자가 타입 필터 + 핀 티커 + 정렬 조건을 지정하면,
테이블은 필터에 맞는 행만 보여주고 지정한 정렬 순서를 따라야 함.

### AT-08A: 캘린더 타입 전환
`/calendar` 기본 타입이 `earnings`일 때,
사용자가 `dividends`, `splits`, `analyst_ratings`, `sec_filings`, `economics`로 전환하면,
타입별 컬럼과 필터 UI가 해당 타입에 맞게 바뀌어야 함.

### AT-08B: 워치리스트 필터 (캘린더)
워치리스트 `My Day Trade`가 `NVDA,TSLA`를 포함할 때,
사용자가 calendar에 `watchlist_id=My Day Trade`를 적용하면,
티커가 있는 이벤트는 `NVDA` 또는 `TSLA`만 표시되어야 함.

### AT-08C: 실적 시간대 필터
earnings 이벤트에 BMO/AMC/Unknown 값이 있을 때,
사용자가 `time_of_day=AMC`를 선택하면,
AMC 실적 행만 반환되어야 함.

### AT-08D: 경제지표 지역 필터
economics 이벤트가 여러 국가로 존재할 때,
사용자가 region/country `US`를 적용하면,
US 이벤트만 반환되어야 함.

### AT-08E: 캘린더 상세 JSON 표시
사용자가 캘린더 행을 클릭했을 때,
상세 엔드포인트가 JSON 필드를 반환하면,
상세 드로어가 모든 JSON 필드를 표시하고 링크 필드가 있으면 클릭 가능해야 함.

### AT-08F: 캘린더 CSV 내보내기
사용자가 캘린더에서 필터/정렬을 적용한 상태에서,
Export CSV를 클릭하면,
다운로드된 CSV의 행/정렬/컬럼 구성이 현재 화면 조건과 일치해야 함.

### AT-08G: 캘린더 → 뉴스 크로스링크
사용자가 캘린더 행에서 `Open News`를 클릭하면,
뉴스 페이지(`/news`)가 해당 티커 + 이벤트 전후 시간 필터로 미리 채워져 열려야 함.

### AT-09: 알림 훅 영속성
사용자가 `/settings/alerts`에서 browser+sound 방법의 규칙을 생성하면,
새로고침 후에도 동일 도구/활성화 상태/방법이 유지되어야 함.

### AT-10: API 계약 확인
아래 엔드포인트의 상태코드/페이로드 형태가 명세와 일치해야 함:
- `GET /api/news`
- `GET /api/news/:id`
- `POST/GET/DELETE /api/news/saved-views`
- `GET/POST/DELETE /api/watchlists`
- `GET /api/calendar/types`
- `GET /api/calendar/events`
- `GET /api/calendar/events/:id`
- `GET /api/calendar/events/export.csv`
- `GET/POST /api/settings/alerts`
- `GET /api/news/stream` (SSE 프레임 `{type:"news_item", payload:{...}}`)
