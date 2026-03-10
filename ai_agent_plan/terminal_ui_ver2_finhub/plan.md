# Plan — terminal_ui_ver2_finhub (Frontend)

## KO

> ℹ️ KO 문서가 현재 작업 기준 문서입니다.

### 목표
프론트는 `termina_web/figma_code/terminal_ui_ver2_finhub`를 기준으로 아래를 구현한다.
1) **Data Control Window** 추가
   - `IBKR Price Data` 업데이트 버튼
   - `IBKR Calendar Data` 업데이트 버튼
  - `7D Change Update` 업데이트 버튼
  - `Custom Change Update` 업데이트 버튼
   - 각 항목의 **마지막 성공 업데이트 날짜/시각 표시**
2) **Default Ticker Window** 추가
   - 참조 CSV 경로를 UI에서 수정 가능하게 제공
   - 기본 참조 CSV는 `tradigview_screener/original_data/watch lists2_2026-02-22.csv`
   - CSV에서 티커 목록 로드/표시
   - 티커 입력 후 추가 가능
   - 추가 시 CSV **마지막 행에 append**
3) `/calendar`는 **IBKR 캘린더 데이터만** 사용
4) `news feed_brave api` 표기를 **`news feed:finhub api`**로 변경하고, 뉴스는 **Finnhub API**로 수집/표시(Brave 기반은 사용하지 않음)
  - News Feed Window 표 컬럼에 `Industry`와 `Keywords`를 추가한다.
  - `Industry`는 **기본 참조 CSV(`tradigview_screener/original_data/watch lists2_2026-02-22.csv`)의 해당 ticker row를 우선 참조**하여 표시한다.
  - 기본 참조 CSV에 적절한 `Industry` 계열 컬럼이 없거나 해당 ticker row가 없을 때만 Finnhub company profile 계열 값을 fallback으로 사용한다.
  - `Keywords`는 `news_fulltext` 저장 위치 옆 컬럼에 저장된 후속 AI keyword 분석 결과를 표시한다.
  - News source 메뉴는 `company_news`, `press_release`, `market news`를 각각 선택 가능해야 한다.
5) **장시간 업데이트 UX** — 모든 장시간 수집 작업(Finnhub 뉴스, IBKR 가격, IBKR 캘린더)은 **백그라운드 잡**으로 실행하고, 각 창에 **View Log** 버튼을 배치하여 진행률/로그를 확인할 수 있게 한다. **시작 시 로그 창 자동 오픈 금지** — 사용자가 View Log 버튼을 눌러야만 열린다.
6) **Full Text Extraction(뉴스 원문 추출)** — 뉴스 피드 업데이트와 **별도 버튼/프로세스**로, 저장된 뉴스의 원본 기사를 크롤링하여 full text를 추출/저장한다.
   - 대상: full text가 아직 없는 **모든 news_id** (press_release + company_news 구분 처리)
   - 도메인별 추출기: **Nasdaq**(HTML scraping), **TMX**(GraphQL API), **finnhub.io**(skip — 외부 기사 페이지가 아님)
   - 저장: 별도 `news_fulltext` 테이블 (news_items와 1:1 관계)
   - `news_items`에 `publisher` 컬럼 추가: `source`(=데이터 공급자, 예: FINNHUB) vs `publisher`(=원본 사이트, 예: NASDAQ/TMX/FINNHUB)
   - UI: News 테이블에 **O/X 컬럼**(full text 존재 여부), **O 클릭 시 팝업**으로 full text 표시, **"Full Text Update" 별도 버튼**
7) **Change Metrics(뉴스 기준 변화율 저장)** — change 데이터는 `news_items` 컬럼에 직접 병합하지 않고, `news_id` 기준 별도 저장으로 관리한다.
  - 저장: 별도 `news_change_metrics` 테이블 (`news_items`와 1:N 관계, `metric_key`로 표준/custom 구분)
  - 표준 프리셋: `change_1d_pct`, `change_from_open_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`
  - custom 프리셋: `custom_{N}d_pct` 형태로 저장
  - 조회: `GET /api/news` 응답에서 필요한 표준 change 값만 join/병합하여 내려준다
8) **News Feed Earning Date Snapshot(뉴스 당시 기준 upcoming earning date 고정 저장)**
  - 목적: 각 뉴스 row에서 보이는 `Earning: <date>`는 **현재 시점 기준**이 아니라, **그 뉴스가 발행된 당시 관점**에서의 가장 가까운 upcoming earning date여야 한다.
  - 저장: `news_id` 기준 별도 snapshot 저장(`news_items` 직접 컬럼 확장 대신 별도 테이블 권장)
  - 조회: `GET /api/news` 응답에 snapshot 필드를 join/병합하여 내려주고, 프론트는 live lookup 없이 저장된 snapshot만 표시한다.
9) **Calendar Window 기간 프리셋 조회 버튼 추가**
  - `/calendar` 툴바에 `Last Week`, `This Week`, `Next Week`, `This Month`, `Next Month` 버튼을 추가한다.
  - 각 버튼은 새 pull/update를 발생시키는 것이 아니라, **이미 저장된 calendar data를 해당 기간으로 조회**하는 필터 역할을 한다.
  - 기간 계산 기준은 `America/New_York` 로컬 날짜이며, 버튼별 범위 정의는 plan 본문에 명시한다.

### 현재 레포 상태(중요, 확인됨)
- 프론트에는 이미 `brave-news` 윈도우 타입이 존재하며 구현 파일은 아래와 같다.
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/BraveNewsWindow.tsx`
  - 현재 `generateMockData()`로 synthetic 뉴스 데이터를 생성함 → 정책/요구사항상 제거가 필요.
- 1D OHLC 가격 데이터의 단일 저장소(SQLite)가 이미 존재한다.
  - `OHLC_data/ohlc_1d_watchlist.sqlite`
  - 테이블: `ohlc_1d`(PK `(Symbol, Datetime)`), `symbols`
  - `ohlc_1d`의 최신 `Datetime`은 현재 `2026-02-20`까지 들어있음(로컬에서 확인됨)
- 백엔드는 SQLite에서 뉴스를 제공하며, EODHD 인제션 엔드포인트가 존재한다.
  - `terminal/backend/src/server.ts`: `POST /api/news/pull-eodhd`, `GET /api/news`
- **Finnhub 뉴스 도메인 분포(확인됨, 2026-03-06)**:
  - 현재 `news_items` 테이블에 Finnhub 소스 뉴스 총 707건 저장 중
  - `press_release`: www.nasdaq.com 549건, money.tmx.com 51건
  - `company_news`: finnhub.io 107건
  - 이 3개 도메인만 존재하며, 각각 별도의 full text 추출 전략이 필요
- **TMX GraphQL API 발견(확인됨, 2026-03-06)**:
  - TMX(money.tmx.com)는 Next.js SPA로, 초기 HTML에 기사 본문이 없음(JS 렌더링 후 표시)
  - 숨겨진 GraphQL 엔드포인트: `https://app-money.tmx.com/graphql`
  - 쿼리: `getNewsStoryById($newsid: String!)` → `headline`, `story`(HTML full text), `datetime`, `source`, `qmsummary`, `thumbnailurl`
  - `newsid`는 URL path에서 추출 (예: `/en/quote/news/4568018400043402` → `4568018400043402`)
  - 직접 API 호출로 검증 완료 — NexGen 우라늄 기사의 full text(HTML)를 성공적으로 반환받음
- 백엔드 캘린더 인제션은 현재 **완전 mock 생성**이다.
  - `terminal/backend/src/services/calendarIngestion.ts`가 `source = "mock_provider"` 이벤트를 주기적으로 insert.
  - `terminal/backend/src/server.ts`에서 `startCalendarIngestionWorkers()`를 startup에 호출.
  - “/calendar = IBKR only”를 만족하려면 mock 생성기를 중지하고, 기존 mock row도 정리해야 한다.

### 제약 / 비범위
- 요구된 UX 외에 추가 페이지/모달/필터/애니메이션 등은 만들지 않는다.
- mock/가짜 뉴스 데이터는 추가하지 않는다.
- 시크릿(API 키/토큰)은 로그에 남기지 않는다.
- 브라우저에서 로컬 파일 직접 쓰기 불가 → CSV 읽기/append는 백엔드 API가 담당한다.

### 읽는 방법(비개발자/일반인 기준)
이 문서는 구현(개발)용 계획이지만, 코드를 직접 작성하지 않아도 진행 상황을 리뷰/검증할 수 있도록 작성한다.

각 Step을 읽는 법
- Step 하나는 “사용자가 눈으로 확인 가능한 결과물” 1개 단위다(UI에서 보이거나 API로 확인 가능).
- 각 Step에는 보통 아래가 포함된다.
  - sub-step 테이블(무엇을 하는지)
  - 목적/설명 블록(왜 필요한지, 무엇이 ‘완료’인지)
  - Verification hook(검증 방법)

검증은 2종류가 있다
- “개발자 검증”: `curl`, DB 쿼리, TypeScript 컴파일 체크 같은 명령 기반 확인.
- “사람 검증(비개발자)”: UI를 열고 라벨/버튼/시간표시가 요구대로 바뀌는지 확인.

완료 시 UI 스냅샷(최종 결과가 어떻게 보여야 하는가)
- Default Ticker Window
  - 선택된 CSV 경로에서 로드한 티커 목록이 보인다.
  - 티커 추가 시 목록이 즉시 반영되고, CSV에도 append 된다(백엔드가 수행).
- News window
  - 라벨이 정확히 `news feed:finhub api`로 표시된다.
  - Finnhub에서 실제로 pull하여 DB에 저장된 뉴스만 렌더된다(mock 행 금지).
- Data Control Window
  - 버튼은 정확히 4개: `IBKR Price Data`, `IBKR Calendar Data`, `7D Change Update`, `Custom Change Update`.
  - 버튼 클릭은 백엔드 업데이트를 트리거하고, “마지막 성공 업데이트 날짜/시각”이 갱신된다.
- Calendar Window
  - 툴바에 `Last Week`, `This Week`, `Next Week`, `This Month`, `Next Month` 버튼이 보인다.
  - 버튼 클릭 시 현재 저장된 calendar row를 해당 기간만큼 필터링해서 보여준다(추가 update 자동 실행 금지).
- News window
  - `Earning: <date>`가 보이는 경우, 그 값은 **뉴스 발행 당시 기준**으로 고정된 snapshot 값이다.
  - 시간이 지난 뒤 다시 열어도 과거 뉴스 row의 earning date가 현재 기준 값으로 바뀌지 않는다.

빠른 검증 체크리스트(코드 안 읽고 확인)
1) 앱을 실행(backend + web UI)하고, 터미널에 표시되는 UI URL로 접속.
2) News 창 라벨이 `news feed:finhub api`인지 확인.
3) Default Ticker 창에서 티커 목록이 보이고, 티커 추가 시 즉시 목록에 반영되는지 확인.
4) IBKR 설정이 되어 있다면: `IBKR Price Data`/`IBKR Calendar Data`/`7D Change Update`/`Custom Change Update` 클릭 후 각 항목의 “마지막 성공 업데이트”가 바뀌는지 확인.
5) Calendar Window에서 `Last Week`/`This Week`/`Next Week`/`This Month`/`Next Month` 버튼을 눌렀을 때, 같은 DB 데이터를 서로 다른 기간으로만 필터링하는지 확인.
6) News 창에서 `Earning: <date>`가 보인다면, 같은 종목의 과거 뉴스와 최신 뉴스가 서로 다른 snapshot 날짜를 가질 수 있는 구조인지 확인.

용어집(쉬운 정의)
- 백엔드: 데이터베이스/CSV/외부 API와 통신하는 Node/TypeScript 서버(`terminal/backend`).
- 프론트: 사용자가 보는 UI 앱(`termina_web/figma_code/terminal_ui_ver2_finhub`).
- API 엔드포인트: 프론트가 백엔드를 호출하는 URL(예: `GET /api/updates/status`).
- SQLite DB: 파일 1개로 된 로컬 DB(예: `OHLC_data/ohlc_1d_watchlist.sqlite`).
- 수집(pull/ingestion): Finnhub/IBKR에서 데이터를 내려받아 로컬에 저장하는 과정.
- Upsert: “없으면 insert, 있으면 update”해서 중복을 만들지 않는 저장 방식.
- OHLCV(1D): 일봉 Open/High/Low/Close/Volume.
- 파생 지표: OHLC 기반으로 계산되는 값(예: %변화율) — mock 금지.
- “No mock” 정책: 실제 데이터가 없으면 `null`/빈 값으로 두고, 숫자를 지어내지 않는다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

#### plan 중간 변경 프로토콜(리비전)
- 이미 기록된 로그를 재작성하거나 삭제하지 않는다.
- 변경 사유와 영향을 짧게 기록하고, 새 plan 기준으로 진행한다.

템플릿 — PLAN CHANGE 노트(채팅에 추가, agent_log를 작성 중일 때만 agent_log.md에도 같이 추가)
```text
PLAN CHANGE (YYYY-MM-DD)
- 왜: <사유>
- 무엇이 바뀌었나: <추가/삭제/순서 변경된 step>
- 영향: <범위/리스크/예상 일정 변경>
```

#### 단계별 검증 + 사용자 확인(로그 user-confirmed의 조건)
- 각 단계 완료 후에는 사용자가 직접 확인할 수 있는 검증 절차를 반드시 포함한다(정확한 명령어, 또는 무엇을 봐야 하는지).
- 해당 단계에 명확한 체크포인트가 있으면, 사용자에게 완료 확인을 명시적으로 요청한다.
- 로그 표기 규칙:
  - 사용자 확인 전: `done (awaiting user confirmation)`
  - 사용자가 명시적으로 확인한 후: `completed (user-confirmed)`로 업데이트

템플릿 — 단계 마감 부분(채팅)
```text
Step N — <제목>
- 변경 내용: <변경 파일/영역>
- 검증 방법: <명령어 / 체크리스트>
- 문제점/리스크: <문제> → 완화 방안: (1) ... (2) ... (3) ...
- 사용자 확인 필요?: Yes/No (Yes이면: 완료 확인 부탁)
```

---
```
PLAN CHANGE (2026-03-06)
- 왜: 장시간 업데이트(Finnhub 뉴스 전체 수집, IBKR 가격/캘린더) 시 동기 응답 대기 UX가 부적합.
  사용자 요구: "시작 시 자동 오픈 금지, View Log 버튼으로 진행률/로그 확인".
- 무엇이 바뀌었나:
  - 목표 #5 신설 — 백그라운드 잡 + View Log 버튼 UX
  - 아키텍처 아래 "장시간 update UX 원칙(공통)" 섹션 추가
  - 5단계: Update 동작을 동기→백그라운드 잡 패턴으로 변경, 5-17/5-18 서브스텝 추가
  - 8단계: 각 섹션에 View Log 버튼 추가, 8-6/8-7 서브스텝 추가
  - 의존성 그래프에 신규 서브스텝 반영
- 영향: 5단계·8단계 구현 범위 확대(백엔드 잡 큐 + 프론트 로그 패널). 기존 완료 서브스텝에는 영향 없음.
```

```
PLAN CHANGE (2026-03-06 #2)
- 왜: 뉴스 full text(원문) 추출 기능 추가 요구. TMX 사이트가 SPA(Next.js)여서 HTML 직접 크롤링 불가였으나,
  숨겨진 GraphQL API(`https://app-money.tmx.com/graphql`)를 발견하여 full text 추출이 가능해짐.
  현재 Finnhub 뉴스 707건의 도메인 분포: www.nasdaq.com 549건(press_release), money.tmx.com 51건(press_release), finnhub.io 107건(company_news).
- 무엇이 바뀌었나:
  - 목표 #6 신설 — Full Text Extraction(뉴스 원문 추출)
  - 현재 레포 상태에 TMX GraphQL API 발견 사항 추가
  - 아키텍처에 "Full Text Extraction 아키텍처" 섹션 추가
  - 10단계 신설 — Full Text Extraction (백엔드 + 프론트)
  - news_items 테이블에 `publisher` 컬럼 추가 (source=데이터 공급자 vs publisher=원본 사이트)
  - 별도 `news_fulltext` 테이블 신설 (1:1 관계)
  - 도메인별 추출기: Nasdaq(HTML scraping), TMX(GraphQL API), finnhub.io(skip)
  - UI: O/X 컬럼 + 클릭 시 팝업 + "Full Text Update" 별도 버튼
  - 실행 의존성 그래프에 Step 10 반영
- 영향: 4단계 이후에 진행 가능(Finnhub 뉴스가 news_items에 적재된 상태 필요).
  기존 완료 서브스텝에는 영향 없음. news_items 마이그레이션(publisher 컬럼)은 10단계 초반에 수행.
```

```
PLAN CHANGE (2026-03-06 #3)
- 왜: change 데이터를 뉴스 원본 row와 분리해 `news_id` 기준으로 별도 저장하고, 운영 UI에서 change 재계산을 명시적으로 돌릴 수 있게 하려는 요구가 추가됨.
- 무엇이 바뀌었나:
  - 목표 #1을 4개 버튼 구조로 변경 (`IBKR Price Data`, `IBKR Calendar Data`, `7D Change Update`, `Custom Change Update`)
  - 목표 #7 신설 — `news_change_metrics` 별도 저장 구조 추가
  - 아키텍처에 "Change Metrics 아키텍처" 섹션 추가
  - 4단계/7단계에서 `news_items` 직접 UPDATE 방식 대신 `news_change_metrics` upsert 방식으로 변경
  - 8단계 Data Control Window를 4개 섹션 기준으로 재정의
- 영향: change 데이터는 app DB 내부의 별도 테이블로 관리하고, `GET /api/news`에서만 join하여 내려준다. 프론트 Changes % 렌더 계약은 유지하되 저장 방식과 운영 버튼 구성이 변경된다.
```

```
PLAN CHANGE (2026-03-06 #4)
- 왜: 사용자가 `7D Change Update`와 `Custom Change Update` 버튼을 Data Control Window뿐 아니라 News Feed Window에도 두라고 요청함.
- 무엇이 바뀌었나:
  - Change Metrics 아키텍처에 "두 윈도우에서 같은 job/API를 호출하는 중복 진입점" 원칙 추가
  - 5단계 News Feed Window 계획에 `7D Change Update` / `Custom Change Update` 버튼 추가
  - 5-20, 5-21 서브스텝 신설
- 영향: News Feed Window 툴바 범위가 확대되지만, backend 로직은 새로 분기하지 않고 Data Control과 동일 엔드포인트를 재사용한다.
```

```
PLAN CHANGE (2026-03-06 #5)
- 왜: 사용자가 News Feed Window에 `Industry` 컬럼과 `Keywords` 컬럼도 추가하라고 요청함. `Keywords`는 full text 저장 위치 옆 컬럼에 저장하되, 값 자체는 나중에 별도 AI agent가 full text를 보고 정리한 뒤 표시되어야 함.
- 무엇이 바뀌었나:
  - 목표 #4에 `Industry` / `Keywords` 컬럼 요구 추가
  - capability matrix와 5단계 News Feed Window 컬럼 정의에 `Industry`, `Keywords` 추가
  - 10단계 `news_fulltext` 스키마에 keyword 저장 컬럼 추가
  - 10단계에 "키워드 분석은 후속 AI enrichment 작업"이라는 비범위/후속 규칙 명시
- 영향: UI는 `Keywords` 컬럼을 가지되, 실제 값은 full text 추출 이후의 별도 AI 분석이 완료되어야만 채워진다. 초기 상태는 빈 값/`-` 또는 pending 상태다.
```

```
PLAN CHANGE (2026-03-10 #AI-research-refresh)
- 왜: research page가 외부 스크립트/DB 업데이트로 바뀌어도, 열린 AI Research Window가 자동 재조회하지 않아 사용자가 수동으로 최신 본문을 다시 불러올 수단이 필요함.
- 무엇이 바뀌었나:
  - `CaseResearchWindow`에 수동 `Refresh` 버튼 추가
  - 버튼 클릭 시 `GET /api/research/tabs`, `GET /api/research/tabs/:tabId/pages`, `GET /api/research/pages/:id`를 다시 호출해 현재 선택 상태를 유지한 채 최신 DB 상태 재로드
  - 프론트 스펙 문서에 refresh 동작 설명 추가
- 영향: 외부 분석 스크립트가 특정 research page를 갱신한 뒤에도 사용자는 창을 닫지 않고 최신 내용을 바로 확인할 수 있음.
```

```
PLAN CHANGE (2026-03-06 #6)
- 왜: 사용자가 Finnhub `/news` 일반 시장 헤드라인도 `press_release`, `company_news`와 같은 급의 새 타입으로 메뉴에 추가하고, update도 같은 방식으로 붙이라고 요청함. 표기 이름은 `market news`.
- 무엇이 바뀌었나:
  - Finnhub source type에 `market_news` 추가
  - News Feed Window source filter에 `Market News` 버튼 추가
  - Update split-dropdown에 `7d/recent/custom × market news` 옵션 추가
  - Full Text Update sourceType 메뉴에도 `market_news` 추가
- 영향: `market_news`는 ticker 기반이 아니라 Finnhub `/news?category=general` + `minId` 페이징 기반으로 수집한다. 따라서 custom/recent는 UI는 같지만, 서버 내부 구현은 stored timestamp + page cutoff 방식으로 동작한다.
```

```
PLAN CHANGE (2026-03-06 #7)
- 왜: 사용자가 `source` 컬럼은 유지하되 기본 표시에서는 숨기고(unchecked), 대신 동일한 링크 동작을 가진 `publisher` 컬럼을 기본 컬럼으로 보이게 하라고 요청함.
- 무엇이 바뀌었나:
  - 5단계 News Feed Window 컬럼 동작을 `publisher` 중심으로 조정
  - `GET /api/news` 응답에 `publisher` 필드 포함
  - `source` 컬럼은 Columns 드롭다운에서 기본 unchecked 상태로 변경
- 영향: provider(`source`)와 원문 사이트(`publisher`)를 UI에서 분리해 볼 수 있고, 초기 화면에서는 원문 사이트가 먼저 보인다.
```

```
PLAN CHANGE (2026-03-06 #8)
- 왜: 사용자가 News Feed의 `Earning: <date>`를 “현재 시점 기준”이 아니라 **각 뉴스 발행 당시 기준의 upcoming earning date**로 고정해서 보이게 해야 한다고 명확히 요구했고,
  `/calendar` window에도 `Last Week` / `This Week` / `Next Week` / `This Month` / `Next Month` 기간 버튼을 두어 저장된 캘린더 데이터를 기간별로 조회하고 싶다고 요청함.
- 무엇이 바뀌었나:
  - 목표 #8 신설 — News Feed earning date를 `news_id` 기준 snapshot 저장으로 정의
  - 목표 #9 신설 — `/calendar` 기간 프리셋 버튼 추가
  - 아키텍처에 `News Earning Snapshot` 및 `Calendar 기간 프리셋 조회 원칙` 섹션 추가
  - capability matrix의 News Feed `Earning date` 행을 live lookup이 아닌 snapshot 기반으로 수정
  - 4단계/5단계 데이터 흐름 설명에 earning snapshot 저장/표시 규칙 추가
  - Calendar window 요구사항에 기간 프리셋 버튼과 날짜 범위 정의 추가
- 영향:
  - News Feed의 earning 표시는 시간이 지나도 과거 뉴스 row 기준값이 유지된다.
  - `/calendar` 버튼은 update 버튼이 아니라 조회 preset 버튼이므로, 저장된 이벤트를 빠르게 다른 기간으로 필터링하는 UX가 추가된다.
```

```
PLAN CHANGE (2026-03-06 #9)
- 왜: 사용자가 `Industry`는 Finnhub company profile보다 **기본 참조 CSV(`tradigview_screener/original_data/watch lists2_2026-02-22.csv`)를 우선 참조하는 편이 낫다**고 요청함.
- 무엇이 바뀌었나:
  - 목표 #4의 `Industry` 정의를 CSV 우선, Finnhub fallback으로 변경
  - capability matrix의 `Industry` 소스 정의를 CSV 우선으로 수정
  - 5단계 News Feed Window의 `industry` 렌더 설명을 CSV 우선 / Finnhub fallback으로 수정
- 영향:
  - `Industry` 값은 운영자가 기준으로 삼는 watchlist CSV와 더 일관되게 보인다.
  - CSV에 값이 없을 때만 Finnhub를 보조 소스로 사용하므로, 기존 provider 의존성을 완전히 제거하지는 않는다.
```

```
PLAN CHANGE (2026-03-06 #10)
- 왜: 사용자가 change%가 "뉴스 이전 N일"이 아니라 "뉴스 이후 N일 주가 반응"을 측정해야 한다고 지적함. 기존 plan과 구현이 모두 backward-looking(과거→뉴스일)이었으나, 올바른 의도는 forward-looking(뉴스일→미래).
- 무엇이 바뀌었나:
  - Change Metrics 아키텍처 섹션: 전면 forward-looking 정의로 변경
  - `news_change_metrics` 스키마: `anchor_date`→`reference_date`(뉴스 기준일), `reference_date`→`target_date`(N거래일 후), `lookback_trading_days`→`forward_trading_days`
  - 4-6(newsChangeMerger): forward 방향 계산으로 재정의
  - 7-8(OHLC 백필): forward metric 백필로 재정의
  - 7-9(Custom Change): `lookbackTradingDays`→`forwardTradingDays`
  - `change_from_open_pct`는 기존과 동일(당일 시가→종가, intraday)
  - `change_1d_pct`: 뉴스일 종가 → 1거래일 후 종가
  - `change_7d_pct`: 뉴스일 종가 → 5거래일 후 종가
  - `change_14d_pct`: 뉴스일 종가 → 10거래일 후 종가
  - `change_30d_pct`: 뉴스일 종가 → 22거래일 후 종가
  - 아직 해당 기간이 지나지 않아 forward OHLC가 없으면 `NULL`(UI에서 `-` 표시)
- 영향:
  - 기존 `news_change_metrics` 데이터 전량 무효 → 테이블 DROP/재생성 필요
  - `ohlc_1d` 테이블의 파생 컬럼(Change_7d_Pct 등)은 주가 차트용 backward-looking으로 별개이므로 변경 없음
  - OHLC 데이터가 최신까지 수집되어야 최근 뉴스의 forward change가 채워짐
```
  - Finnhub 뉴스 수집
  - news 기준 change metric 계산/재계산 잡
  - 티커 CSV read/append + 경로 제한(보안)
  - last updated 시각 저장/조회

  ### News Earning Snapshot 아키텍처
  > News Feed의 `Earning: <date>`는 “지금 기준 가장 가까운 실적일”이 아니라, **각 뉴스가 저장되던 당시 시점**의 upcoming earning date snapshot을 보여준다.

  1. **저장 위치: 별도 테이블 `news_earnings_snapshot`**
    - 물리적으로는 같은 SQLite(app DB) 안에 저장하되, `news_items`에 직접 컬럼을 계속 추가하지 않고 **별도 테이블**로 관리한다.
    - 기본 키: `news_id`
    - 권장 스키마:
      - `news_id TEXT PRIMARY KEY REFERENCES news_items(id)`
      - `ticker TEXT NOT NULL`
      - `news_published_at TEXT NOT NULL`
      - `upcoming_earnings_date TEXT` — `YYYY-MM-DD`
      - `upcoming_earnings_session TEXT` — `BMO` / `AMC` / `TBD` / `NULL`
      - `earnings_source TEXT NOT NULL` — 예: `FINNHUB`
      - `resolution_status TEXT NOT NULL` — `resolved` / `not_found`
      - `resolved_at TEXT NOT NULL`

  2. **해결 규칙(as-of snapshot, live lookup 금지)**
    - 뉴스 row가 insert될 때(또는 insert 직후), 해당 news row의 대표 ticker와 `published_at`을 기준으로 earning snapshot을 **한 번 계산하여 저장**한다.
    - 비교 기준은 `America/New_York` 로컬 날짜다.
    - 운영적 정의:
      - `news_local_date` = `published_at`을 `America/New_York`로 변환한 날짜
      - `news_local_timestamp` = `published_at`을 `America/New_York`로 변환한 시각
      - `upcoming_earnings_date` = 같은 ticker의 earning candidate 중 **그 뉴스 시점에서 아직 지나지 않은 candidate** 가운데 가장 이른 날짜
    - 같은 날 발표이지만 세션 정보(BMO/AMC/TBD)가 있으면 날짜만이 아니라 **세션 시각까지** 비교한다.
    - 세션 비교 기준(권장):
      - `BMO` = `08:00 America/New_York`
      - `AMC` = `16:00 America/New_York`
      - `TBD` 또는 세션 미확인 = 시각이 확정되지 않은 상태. 같은 로컬 날짜 안에서는 upcoming으로 허용하되, 다음 날짜로 넘어가면 지난 이벤트로 본다.
    - 즉, 같은 `earnings_date`라도 뉴스가 오전에 나왔는지, 장 마감 후에 나왔는지에 따라 snapshot 결과가 달라질 수 있다.
    - 그 후 News Feed는 **저장된 snapshot만** 렌더하고, 화면 조회 시점에 다시 provider를 조회해 덮어쓰지 않는다.

  3. **예시(뉴스 당시 관점)**
    - 예시 A:
      - 뉴스 시각: `2026-03-04 10:15 America/New_York`
      - candidate: `2026-03-04 AMC`, `2026-05-07 AMC`
      - 결과: 같은 날 AMC는 아직 지나지 않았으므로 snapshot = `2026-03-04`, session=`AMC`
    - 예시 B:
      - 뉴스 시각: `2026-03-04 17:20 America/New_York`
      - candidate: `2026-03-04 AMC`, `2026-05-07 AMC`
      - 결과: 같은 날 AMC는 이미 지난 이벤트이므로 snapshot = `2026-05-07`
    - 예시 C:
      - 뉴스 시각: `2026-03-04 11:00 America/New_York`
      - candidate: `2026-03-04 BMO`, `2026-05-07 AMC`
      - 결과: 같은 날 BMO는 이미 지난 이벤트이므로 snapshot = `2026-05-07`
    - 예시 D:
      - 뉴스 시각: `2026-03-04 11:00 America/New_York`
      - candidate: `2026-03-04 TBD`, `2026-05-07 AMC`
      - 결과: 세션 미확정이므로 같은 날짜 안에서는 `2026-03-04` snapshot을 허용한다.

  4. **조회 방식: API에서 병합**
    - `GET /api/news`는 `news_items`를 기준으로 조회하되, `news_earnings_snapshot`을 left join하여 아래 필드를 응답에 포함한다.
      - `earning_snapshot_date`
      - `earning_snapshot_session`
      - `earning_snapshot_status`
    - 프론트는 `earning_snapshot_status = 'resolved'`일 때만 `Earning: <date>` 라인을 렌더한다.
    - snapshot row가 없거나 `not_found`면 렌더하지 않는다(가짜 값 금지).

  5. **보정/재계산 규칙**
    - 기본 원칙은 “뉴스 insert 시점 snapshot 고정”이다.
    - provider 데이터 보정이 발생하더라도, 과거 뉴스 row를 무조건 현재 기준 값으로 덮어쓰지 않는다.
    - 필요 시에만 명시적 백필/재해결 작업으로 특정 `news_id` 집합을 다시 계산한다.
    - 이 원칙이 없으면 과거 뉴스를 다시 열 때 `Earning: <date>`가 현재 기준 upcoming value로 드리프트하게 된다.

  6. **체크 항목(사람이 검증 가능한 기준)**
    - 같은 ticker의 과거 뉴스와 최신 뉴스가 서로 다른 `earning_snapshot_date`를 가질 수 있어야 한다.
    - 과거 뉴스 row를 오늘 다시 조회해도 snapshot 값이 “오늘 기준 upcoming value”로 바뀌지 않아야 한다.
    - `earning_snapshot_status='not_found'`인 row는 `Earning:` 라인이 보이지 않아야 한다.

  ### Calendar 기간 프리셋 조회 원칙
  > `/calendar`의 기간 버튼은 데이터를 다시 수집하는 버튼이 아니라, **이미 저장된 `calendar_events`를 기간별로 조회하는 프리셋 필터**다.

  1. **버튼 목록**
    - `Last Week`
    - `This Week`
    - `Next Week`
    - `This Month`
    - `Next Month`

  2. **기간 계산 기준(운영적 정의)**
    - 기준 타임존: `America/New_York`
    - 기준 필드: 각 calendar row의 발표일을 나타내는 로컬 날짜(`announcement_date_local` 또는 동등 필드)
    - 포함 규칙: 시작일/종료일 **모두 포함**
    - 주간 프리셋은 ISO week(월요일 시작, 일요일 종료) 기준으로 계산한다.
      - `Last Week`: 현재 주 직전의 월요일~일요일
      - `This Week`: 오늘이 속한 주의 월요일~일요일
      - `Next Week`: 현재 주 다음의 월요일~일요일
    - 월간 프리셋은 calendar month 기준으로 계산한다.
      - `This Month`: 이번 달 1일~말일
      - `Next Month`: 다음 달 1일~말일

  3. **예시(기준 날짜 = 2026-03-06, 금요일, America/New_York)**
    - `Last Week` = `2026-02-23` ~ `2026-03-01`
    - `This Week` = `2026-03-02` ~ `2026-03-08`
    - `Next Week` = `2026-03-09` ~ `2026-03-15`
    - `This Month` = `2026-03-01` ~ `2026-03-31`
    - `Next Month` = `2026-04-01` ~ `2026-04-30`
    - 경계 사례:
      - `2026-03-02` 이벤트는 `This Week`에 포함
      - `2026-03-08` 이벤트도 `This Week`에 포함
      - `2026-03-09` 이벤트는 `This Week`에서 제외되고 `Next Week`에 포함

  4. **탭별 적용 규칙**
    - 활성 preset은 Earnings/Conference/Dividend/Analyst Rating 탭 모두에 공통 적용한다.
    - 탭을 바꾸더라도 현재 preset은 유지한다.
    - preset 변경은 정렬, 컬럼 가시성, 선택된 탭 같은 다른 UI 상태를 초기화하지 않는다.

  5. **조회 계약(권장)**
    - `/calendar` 프론트는 버튼 클릭 시 update API가 아니라 조회 API에 preset 파라미터를 전달한다.
    - 권장 예시:
      - `GET /api/calendar/events?preset=last_week`
      - `GET /api/calendar/events?preset=this_week`
      - `GET /api/calendar/events?preset=next_week`
      - `GET /api/calendar/events?preset=this_month`
      - `GET /api/calendar/events?preset=next_month`
    - 필요 시 서버는 내부적으로 `preset -> from/to` 로 변환해 동일 조회 로직을 재사용한다.
    - 대안으로 프론트가 `from=YYYY-MM-DD&to=YYYY-MM-DD`를 직접 계산해 보낼 수는 있지만, v1 권장은 `preset` 문자열 전달이다.
    - 이유: 주간 경계와 타임존 계산을 서버 한 곳에서 일관되게 유지하는 편이 drift를 줄인다.

  6. **UI 원칙**
    - 버튼은 `/calendar` 툴바의 빠른 조회 프리셋이다.
    - 버튼 클릭은 `IBKR Calendar Data` update를 자동 실행하지 않는다.
    - 현재 활성 preset은 시각적으로 표시하고, 같은 탭(Earnings/Conference/Dividend/Analyst Rating) 안에서 공통으로 적용한다.
    - 기본 preset은 `This Week`를 권장한다.
    - 나중에 Custom date range가 추가되더라도 위 5개 preset은 가장 빠른 조회 shortcut으로 유지한다.

  7. **체크 항목(사람이 검증 가능한 기준)**
    - 같은 DB row 집합을 두고 preset만 바꿨을 때 결과 건수와 날짜 범위만 달라져야 한다.
    - `IBKR Calendar Data` update를 누르지 않아도 preset 버튼만으로 리스트가 바뀌어야 한다.
    - `This Week`에서 보이던 `2026-03-08` 이벤트가 `Next Week`로 가면 사라지고, `2026-03-09` 이벤트가 새로 보여야 한다.

### 장시간 update UX 원칙(공통)

### Change Metrics 아키텍처
> change 데이터는 뉴스 row의 부가 컬럼이 아니라, `news_id`에 종속된 별도 파생 데이터로 저장한다.
> **방향: forward-looking** — 뉴스 발생일 종가를 기준(anchor)으로, N거래일 **이후** 종가와 비교하여 "뉴스 이후 주가 반응"을 측정한다.
> 예외: `change_from_open_pct`만 당일 시가→종가(intraday).

1. **저장 위치: 별도 테이블 `news_change_metrics`**
   - 물리적으로는 같은 SQLite(app DB) 안에 저장하되, **별도 파일을 새로 만드는 방식이 아니라 별도 테이블**로 관리한다.
   - 기본 키: `(news_id, metric_key)`
   - 권장 스키마:
     - `news_id TEXT NOT NULL REFERENCES news_items(id)`
     - `metric_key TEXT NOT NULL` — `change_1d_pct`, `change_from_open_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`, `custom_{N}d_pct`
     - `value_pct REAL`
     - `ohlc_ticker TEXT NOT NULL`
     - `reference_date TEXT NOT NULL` — 뉴스 기준 OHLC 날짜(anchor)
     - `target_date TEXT NOT NULL` — N거래일 후 OHLC 날짜(forward target). `change_from_open_pct`은 anchor_date와 동일.
     - `forward_trading_days INTEGER` — 앞으로 본 거래일 수 (0=당일, 1, 5, 10, 22 등)
     - `calc_version TEXT NOT NULL`
     - `computed_at TEXT NOT NULL`
     - `PRIMARY KEY (news_id, metric_key)`

2. **표준 프리셋 vs custom 프리셋**
   - 표준 프리셋은 현재 News 창의 Changes % UI와 맞춘다:
     - `change_1d_pct`
     - `change_from_open_pct`
     - `change_7d_pct`
     - `change_14d_pct`
     - `change_30d_pct`
   - custom 프리셋은 `custom_{N}d_pct` 형태로 저장한다.
   - 같은 news_id에 대해 표준 row 5개 + custom row 여러 개가 공존할 수 있다.

3. **조회 방식: API에서 병합**
   - `GET /api/news`는 `news_items`를 기준으로 조회하되, 표준 metric_key를 join하여 기존 응답 필드(`change_1d_pct` 등)로 펼쳐서 내려준다.
   - 즉, **저장은 분리 / 응답은 병합** 구조를 따른다.
   - 프론트는 기존 Changes % 렌더 계약을 유지한다.

4. **운영 버튼 정책**
   - `IBKR Price Data`: OHLC 1D 수집/업서트
   - `IBKR Calendar Data`: 캘린더 수집
   - `7D Change Update`: `change_7d_pct` 표준 metric만 일괄 계산/업데이트
   - `Custom Change Update`: 사용자가 지정한 거래일 window에 대해 `custom_{N}d_pct`를 일괄 계산/업데이트
  - `7D Change Update` / `Custom Change Update` 버튼은 **Data Control Window와 News Feed Window 둘 다**에 둔다.
  - 두 위치의 버튼은 서로 다른 로직을 만들지 않고, **같은 백엔드 job/API를 호출하는 중복 진입점**으로 유지한다.
  - 표준 change 전체 재계산은 7단계 OHLC update 이후 자동 백필로 유지하되, 운영자가 자주 쓸 수 있는 수동 버튼은 7D/custom 두 개만 제공한다.

### Full Text Extraction 아키텍처
> 뉴스 원문(full text) 추출은 뉴스 피드 업데이트와 **완전히 분리된 별도 프로세스**로 동작한다.

1. **source vs publisher 구분**
   - `source` (기존): 데이터 공급자. 현재 `FINNHUB` / `EODHD`.
   - `publisher` (신규): 뉴스 원본 사이트. URL 도메인에서 자동 추출.
     - `www.nasdaq.com` → `NASDAQ`
     - `money.tmx.com` → `TMX`
     - `finnhub.io` → `FINNHUB`
   - `news_items` 테이블에 `publisher TEXT` 컬럼을 migration으로 추가한다.
   - Finnhub 인제션 시(4단계) 또는 full text 추출 시(10단계) URL 도메인을 파싱하여 자동 세팅.

2. **별도 저장 테이블 `news_fulltext`**
   - `news_items`와 1:1 관계(FK: `news_id` → `news_items.id`)
   - 스키마:
     - `news_id INTEGER PRIMARY KEY REFERENCES news_items(id)`
     - `full_text TEXT` — 추출된 원문 (HTML 또는 plain text)
     - `extraction_status TEXT NOT NULL` — `success` / `failed` / `skipped` / `unavailable`
     - `extraction_note TEXT` — 실패/skip 사유 (예: `page-has-no-article-body`, `finnhub-no-external-page`)
     - `word_count INTEGER` — 추출된 텍스트의 단어 수
     - `extracted_at TEXT NOT NULL` — 추출 시각 (ISO 8601)
   - full text가 없는 뉴스 = `news_fulltext`에 해당 `news_id` row가 없는 경우.

3. **도메인별 추출기(extractor)**
   - **Nasdaq** (`www.nasdaq.com`): HTTP GET → HTML 파싱 → article body 추출.
     - 기존 `storage/press_release_fulltext_*.jsonl` 실험에서 확인된 패턴 활용.
   - **TMX** (`money.tmx.com`): URL에서 `newsid` 추출 → GraphQL API 호출 → `story` 필드(HTML).
     - 엔드포인트: `https://app-money.tmx.com/graphql`
     - 쿼리: `getNewsStoryById($newsid: String!)` — `story` 필드가 full text HTML.
   - **finnhub.io**: 외부 기사 페이지가 아님 → `extraction_status = 'skipped'`, `extraction_note = 'finnhub-no-external-page'`.
     - 기존 `body` 필드(summary)를 그대로 사용.
   - 새 도메인이 추가될 경우: `extraction_status = 'unavailable'`, `extraction_note = 'unknown-domain'`으로 기록.

4. **Full Text Update 프로세스(별도 버튼)**
   - 뉴스 피드 업데이트(Finnhub pull)와 **독립적으로 실행**.
   - `news_items`에서 `news_fulltext`에 대응 row가 없는(= full text 미추출) 모든 news_id를 대상.
   - press_release / company_news 모두 대상이지만, 실제 추출 동작은 `publisher`(도메인)에 따라 다름.
   - 백그라운드 잡 패턴 사용(기존 `jobManager.ts` 재사용): POST → `{ jobId }` → 폴링.
   - Rate limit / 예의: 도메인별 요청 간격 유지(예: 300~500ms). 동일 도메인에 대한 병렬 요청 금지.
   - 실패 시 `extraction_status = 'failed'`로 기록하고 다음 news_id로 진행(전체 중단 금지).

5. **UI**
   - News 테이블에 **"Full Text" 컬럼** 추가: 각 row에 O/X 표시.
     - `O`: `news_fulltext` row가 존재하고 `extraction_status = 'success'`
     - `X`: 그 외 (미추출, 실패, skip, unavailable)
   - **O 클릭 시 팝업**: full text를 모달/팝업으로 표시 (HTML 렌더 또는 plain text).
   - **"Full Text Update" 버튼**: News 창 툴바에 배치. 클릭 시 백그라운드 잡 시작.
     - View Log 버튼과 연동(진행률: 처리된 news_id / 전체 미추출 개수).

### 장시간 update UX 원칙(공통)
> 아래 원칙은 Finnhub 뉴스, IBKR 가격, IBKR 캘린더 등 **모든 장시간 업데이트 작업**에 동일하게 적용한다.

1. **백그라운드 잡 패턴**
   - Update 버튼 클릭 시 백엔드는 잡을 **비동기로 시작**하고 즉시 `{ jobId }` 를 반환한다.
   - 프론트는 `jobId`로 상태를 폴링(`GET /api/jobs/:jobId`)하여 `{ status, progress, logs[], error? }` 를 받는다.
   - 폴링 주기: 2~3초(조절 가능).

2. **View Log 버튼(자동 오픈 금지)**
   - 각 Update 섹션 옆에 **View Log** 버튼을 배치한다.
   - **시작 시 로그 패널이 자동으로 열리지 않는다.** 사용자가 View Log를 눌러야만 열린다.
   - 로그 패널 내용:
     - 진행률 바 (`completed / total tickers`, 퍼센트)
     - 실시간 로그 라인(타임스탬프 + 메시지), 최신이 아래.
     - 에러 발생 시 빨간 텍스트로 에러 메시지 표시.
   - 잡이 완료되면 상태가 "Done" 또는 "Failed"로 바뀌고, View Log로 최종 결과를 확인할 수 있다.
   - 로그 패널은 닫기 버튼(X)이나 외부 클릭/ESC로 닫을 수 있다.

3. **Finnhub 뉴스 특수 사항(rate limit)**
   - Finnhub 무료: 300 req/min → 안전 운영: **200~240 req/min**.
   - ticker당 2개 endpoint(company_news + press_releases) → 분당 ~100~120 tickers 처리 가능.
   - 토큰 버킷(token-bucket) 또는 간단한 딜레이로 rate limit 준수.
   - 진행률: `처리된 ticker 수 / 전체 ticker 수`.

### 결정/선행조건(초기에 확정 필요)
1) **IBKR 연동 방식**
   - 백엔드가 어떤 방식으로 IBKR에 접근할지 확정 필요:
     - 옵션 A: IBKR Client Portal Web API(로컬 게이트웨이) HTTP
     - 옵션 B: TWS/Gateway API(소켓)
   - 별도이지만 연관된 결정(이 플랜의 차단 항목 #6): **Node↔IBKR 연동 구현 방식**(Node/TS 백엔드가 이 PC에서 IBKR를 “어떻게” 호출할지).
     - 옵션 A: Node 라이브러리 직결(예: `@stoqey/ib`)로 TWS/Gateway에 연결
     - 옵션 B: Node 오케스트레이터 + 로컬 Python `child_process` (Python이 IBKR와 통신, Node는 JSON 출력 파싱)
     - 옵션 C: Node 오케스트레이터 + 로컬 Python 마이크로서비스(localhost HTTP, Python이 IBKR 세션 유지)
2) **IBKR “price data” 범위(v1 최소 정의)**
  - 필수: **일봉(1D) OHLCV**를 받아 기존 SQLite DB에 “이어서 append 저장”한다.
    - 저장 파일: `OHLC_data/ohlc_1d_watchlist.sqlite`
    - 테이블/컬럼: `ohlc_1d(Symbol, Datetime, Open, High, Low, Close, Volume)`
    - 최신 데이터 date 확인은 이 DB의 `MAX(Datetime)`로 한다.
3) **Finnhub API 키 제공 방식**
   - 권장: `.env`의 `FINNHUB_API_KEY`.
   - 대안: `finhub/finhub_api_key/finhub_api_key` 파일에서 읽기(시크릿 로그 금지).
4) **뉴스 윈도우 정책**
   - 권장: 기존 `brave-news`를 Finnhub 기반으로 교체 + 라벨 변경.
   - 선택: 기존 `news` 윈도우(EODHD 자동 pull 포함)도 Finnhub로 같이 옮길지 여부.

### 계획 중간 필수 확인: “데이터 수집 가능 범위 점검(감사)” (IBKR + Finnhub)
UI 컬럼이 요구하는 데이터(예: market cap, turnover, earnings calendar 필드 등)가 실제로 IBKR/Finnhub에서 제공되는지, 또는 OHLC로 계산 가능한지 구현 전에 확인해야 한다.

점검 산출물
- “capability matrix(가능 범위 매트릭스)” 문서: 각 UI 컬럼 → 데이터 소스(IBKR / Finnhub / `ohlc_1d`로 계산 / 불가)를 명확히 매핑
- 원시 샘플을 확인할 수 있는 최소 probe 스크립트/엔드포인트(개발자 확인용)
  - 외부 노출 금지, 시크릿 로그 금지

점검 대상 컬럼(최소, 현재 UI 기준)
- “news feed:finhub api” 윈도우(현재 `BraveNewsWindow`가 mock으로 구현된 부분):
  - 표 컬럼: `Date`, `Time`, `Title`, `Industry`, `Sources`, `Changes %`, `Keywords`
  - `Changes %` 셀 내부에 렌더되는 하위 항목:
    - `Chg` (1D % change)
    - `fr.Open` (오픈 대비 % change)
    - `+7D`, `+14D`, `+30D` (N 거래일(트레이딩 바) 전 대비 % change)
    - 선택 라인: `Earning: <date>` (뉴스 발행 당시 기준 upcoming earning date snapshot)
  - 필터 UI가 암시하는 추가 필드:
    - Market cap(시가총액, market-cap preset용)
    - Industry(산업, multi-select)
    - Keywords(후속 AI keyword 분석 결과)
- Calendar window (`/calendar`는 IBKR-only 요구사항):
  - 툴바 기간 프리셋 버튼:
    - `Last Week`, `This Week`, `Next Week`, `This Month`, `Next Month`
    - 버튼은 update가 아니라 저장된 `calendar_events` 조회 범위를 빠르게 바꾸는 preset 필터
  - Earnings 탭(표에 기본으로 보이는 컬럼):
    - `Date Announcement`, `Time`, `Symbol`, `Session`, `Period`, `Confirmed`, `EPS`, `Est. EPS`, `Surprise %`, `Revenue`, `Est. Revenue`
  - Conference 탭(표에 기본으로 보이는 컬럼):
    - `Date Announcement`, `Time`, `Symbol`, `Session`, `Confirmed`
  - Dividend 탭(표에 기본으로 보이는 컬럼):
    - `Date Announcement`, `Time`, `Symbol`, `Session`, `Confirmed`
  - Analyst Rating 탭(표에 기본으로 보이는 컬럼):
    - `Date Announcement`, `Time`, `Symbol`, `Analyst Firm`, `Analyst Name`, `Action`, `Prior Rating`, `Rating`, `Prior PT`, `Price Target`, `Confirmed`
- Watchlist 윈도우(현재 mock):
  - 표 컬럼: `Ticker`, `Name`, `Mkt Cap`, `Industry`, `Price`, `Change`, `%`

“Changes %” 동작 정의(모호성 제거)
- 심볼별로 `ohlc_1d`에서 최신 `Datetime`(심볼별 latest bar)을 기준으로 계산한다.
- `Chg` := $(\frac{Close_t}{Close_{t-1}} - 1) \times 100$
- `fr.Open` := $(\frac{Close_t}{Open_t} - 1) \times 100$
- `+7D/+14D/+30D` := $(\frac{Close_t}{Close_{t-N}} - 1) \times 100$ (여기서 $N$은 캘린더일이 아니라 트레이딩 바 기준)

capability matrix 초안 템플릿(감사 단계에서 채움)

| UI 영역 | UI 필드 | 제안 소스 | 비고/프로브 |
|---|---|---|---|
| News Feed | Date/Time | Finnhub company news publish time | timezone/필드 가용성 확인 필요 |
| News Feed | Title | Finnhub |  |
| News Feed | Sources | Finnhub | 필드명(`source` 등) 확인 |
| News Feed | Ticker | Finnhub(심볼 파라미터) | 보통 심볼별로 요청; 실제 동작 확인 |
| News Feed | Industry | 기본 참조 CSV 우선, 없으면 Finnhub company profile fallback | CSV 컬럼명 확인 필요 (`Industry` 또는 동등 컬럼) |
| News Feed | Changes: `Chg` / `fr.Open` / `+7D` / `+14D` / `+30D` | `OHLC_data/ohlc_1d_watchlist.sqlite`의 `ohlc_1d` 기반 계산 | 히스토리 부족 시 `-`로 렌더(가짜 금지) |
| News Feed | Keywords | `news_fulltext.keywords_json` | full text 추출 후, 별도 AI keyword 분석 작업이 완료된 row만 표시 |
| News Feed | Earning date 라인 | `news_earnings_snapshot` (원천 계산은 Finnhub earnings/calendar 우선) | 뉴스 발행 당시 기준 snapshot만 표시; live lookup 금지 |
| News Feed | Market cap | Finnhub company profile(우선) | 단위 확인, numeric USD 저장 + 포맷 |
| Calendar | 실적 발표일/시간 | IBKR WSH (`wshe_ed`) | ✅ v3 확인: 발표일, 시간대(BMO/AMC), 상태(CONFIRMED/UNCONFIRMED) |
| Calendar | EPS actual + estimate | IBKR WSH (`wshe_eps`) | ✅ v3 확인: `amount_oc`(실제), `estimated_eps`(예상), `change_amount`, `change_percent` |
| Calendar | Revenue(매출) | Finnhub `/stock/earnings` (무료) | ❌ WSH에 매출 필드 없음; Finnhub으로 보충 |
| Calendar | 컨퍼런스콜 | IBKR WSH (`wshe_cc`) | ✅ v2 확인: fiscal_year, quarter, transcript_url |
| Calendar | 컨퍼런스/투자자 이벤트 | IBKR WSH (`wshe_ic`) | ✅ v2 확인: venue, time, status |
| Calendar | M&A | IBKR WSH (`wshe_merg_acq`) | ✅ v2 확인: acquirer/target, status |
| Calendar | 옵션 만기 | IBKR WSH (`wshe_option`) | ✅ v2 확인: 주간/월간 만기일 |
| Calendar | 배당 | IBKR WSH (`wshe_div`) | ✅ v3 확인: `dividend_oc`(금액), `dividend_currency`, `ex_div_date`, `pay_date` |
| Calendar | Analyst rating 필드 | 이용 불가 | ❌ Finnhub `/stock/upgrade-downgrade` 403; WSH에도 없음 |
| Watchlist | Price/Change/% | `ohlc_1d` 최신 close vs 이전 close로 계산 | 최신 rows에 derived metrics backfill 필요 |
| Watchlist | Name/Mkt Cap/Industry | `Industry`는 기본 참조 CSV 우선, 나머지는 Finnhub company profile(우선) | CSV에 값이 없을 때만 `Industry` fallback 허용 |

프로빙 접근(구현 가이드)
- Finnhub 프로브(백엔드에서만):
  - company profile(시장가치), candles(OHLCV), earnings calendar/earnings date, company news의 필드/기간/레이트리밋을 확인
- IBKR 프로브(TWS/IB Gateway):
  - 일봉 OHLCV 수집 신뢰성 확인(심볼 범위/기간)
  - IBKR “캘린더” 데이터가 UI 요구사항에 맞게 존재하는지 확인하고, 없으면 gap을 명시

Fail-fast 규칙
- UI 컬럼에 fake placeholder를 넣지 않는다.
- 필수 컬럼이 소싱/계산 불가능하면 capability matrix에 기록하고 사용자 결정 없이는 진행하지 않는다.

### 제안하는 구현 순서(이유)
IBKR 연동이 가장 불확실(환경/자격증명/게이트웨이 의존)이므로, 먼저 DB/CSV/Finnhub 같은 저위험 요소로 기반을 만들고, IBKR는 별도 단계로 분리한다.
Full Text Extraction(10단계)은 Finnhub 뉴스가 적재된 후(4단계) 독립적으로 진행 가능하며, IBKR 블록(6-7-8단계)과 병렬 진행 가능.
0) 데이터 수집 가능 범위 점검(IBKR + Finnhub vs UI 컬럼)
1) 기반(DB + status API)
2) Default Ticker CSV API + 윈도우
3) Finnhub 인제션 + “News Feed” 윈도우를 Finnhub로 교체(그리고 mock 제거)
4) IBKR 캘린더 + 가격 업데이트 엔드포인트 + Data Control 윈도우
5) mock 정리 + 테스트
6) Full Text Extraction — 뉴스 원문 추출 + publisher 필드 + O/X 컬럼 + 팝업 (Step 4 이후, IBKR 블록과 독립)

### 단계별 계획(각 단계: 구현 → 검증)

> **검증 프로토콜**
> - 각 단계에는 세부 단계 테이블과 검증 훅을 포함한다.
> - 단계 완료 시: 훅의 명령/체크리스트를 실행해 결과를 사용자에게 공유하고, 사용자 확인 후에만 `agent_log.md`에 `completed (user-confirmed)`로 기록한다.

비개발자 마일스톤(언제 무엇을 눈으로 확인할 수 있나)
- 초반 단계 중 일부는 “백엔드만 변경”되는 단계다(주로 API로 확인). UI에서 눈에 보이는 변화는 윈도우 단계 이후부터 명확해진다.
- 아래 표는 “지금 제대로 진행 중인가?”를 빠르게 확인하는 체크리스트다.

| 마일스톤 | 언제부터 보이나 | 사람이 하는 확인(휴먼 체크) | 기대 결과 |
|----------|------------------|----------------------------|----------|
| Default Ticker Window 동작 | 2단계 + 3단계 이후 | Default Ticker Window 열기 → 티커 추가 | 목록에 즉시 반영되고, 백엔드가 CSV에 append 하여 재시작 후에도 유지 |
| News 창이 Finnhub 기반(=mock 제거) | 4단계 + 5단계 이후 | News 창 열기 | 라벨이 `news feed:finhub api`; 실제 저장된 Finnhub 뉴스만 표시(생성 금지) |
| “Changes %”가 실제 계산값 표시 | 7단계 이후 | News 창에서 “Changes %” 셀 확인 | OHLC 기반 계산값이 보이고, 히스토리 부족은 빈 값/`null`로 표시 |
| Data Control Window 버튼이 타임스탬프를 갱신 | 8단계 이후(+ 6/7단계 + IBKR 설정 완료) | 4개 버튼 클릭 | 성공 시 각 버튼의 “마지막 성공 업데이트”가 갱신되고, 실패는 명확히 표시 |

> Legend: ✅ 구현+사용자확인 완료 · ⏳ 구현완료, 사용자확인 대기 · ⬜ 미착수 · 🚫 선행조건 미충족(차단)

#### ✅ 0단계 — 데이터 수집 가능 범위 점검(감사) (IBKR + Finnhub vs UI 컬럼)
목적(왜 먼저 하는가)
- 이 프로젝트 UI 테이블은 market cap, industry, earnings 필드, analyst rating 등 특정 데이터를 “당연히 존재하는 것처럼” 전제한다. 구현에 들어가기 전에 IBKR/Finnhub가 실제로 제공하는지, 혹은 기존 1D OHLC DB로 계산 가능한지 확정해야 한다.
- 이 단계는 **fail-fast 가드레일**이다. 필수 필드가 불가능하면 즉시 멈추고 의사결정을 해야 하며, UI에 가짜 placeholder를 넣지 않는다.

참조 문서 / 프로브
- 감사 체크리스트 + 매트릭스 템플릿: ai_agent_plan/terminal_ui_ver2_finhub/test/test_data_availability_audit.md
- Finnhub 원시 응답 프로브 스크립트: terminal/backend/test_finnhub_probe.mjs (`tmp/probes/`에 저장)

무엇을 하는가(구체)
- capability matrix(가능 범위 매트릭스)를 작성한다: 각 UI 컬럼 → 아래 중 하나로 확정
  - **Finnhub 제공**
  - **IBKR 제공**
  - **OHLC에서 계산** (`OHLC_data/ohlc_1d_watchlist.sqlite` 기반)
  - **불가**(UI 필드 제거/대체 공급자/빈 값 `-` 허용 중 택1)
- 소수 심볼(AAPL/MSFT/TSLA 등)로 “프로브”를 실행하고 원시 샘플(JSON)을 저장해 재현 가능하게 만든다.

프로브 산출물 처리(레포 위생)
- API 키/토큰은 로그/출력에 절대 찍지 않는다.
- 원시 샘플은 Windows 경로 길이 이슈를 피하기 위해 짧은 경로(예: `tmp/`)에 저장한다.

중단 조건(명시)
- IBKR이 `/calendar` UI가 요구하는 핵심 필드(특히 EPS/Revenue, analyst rating)를 제공하지 못하면 매트릭스에 갭을 기록하고 사용자 결정을 받기 전까지 진행하지 않는다.
- Finnhub의 레이트리밋/기간 제약으로 뉴스 수집이 현실적으로 어렵다면 진행을 멈추고 대안을 결정한다.

산출물
- 위 capability matrix를 “각 UI 컬럼마다” Yes/No/Computed로 확정해 채운다.
- 소수 심볼(AAPL/MSFT/TSLA 등)로 프로브를 실행해 원시 JSON 샘플을 확보한다.
  - Finnhub: company news 필드, company profile(시총/산업), next earnings date 가용성
  - IBKR: 일봉 OHLCV end-to-end(연결/권한/페이싱)
  - IBKR: UI가 요구하는 캘린더 필드(특히 EPS/Revenue/Analyst Rating) 제공 여부

검증
- capability matrix가 위에 나열된 “모든 UI 컬럼”을 빠짐없이 커버한다.
- 시크릿이 로그에 찍히지 않고(키/토큰), 동일 조건에서 재현 가능하다.

**세부 단계 (0단계)**

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | Finnhub 프로브(profile/news/earnings 등)로 필드 가용성 확인 | ✅ 완료 |
| 0-2 | IBKR TWS 프로브 v1 (OHLCV ✅, Reuters ❌, WSH v1 빈 응답) | ✅ 완료 |
| 0-2b | IBKR WSH 프로브 v2 (conId 기반: 메타데이터 ✅, 이벤트 ✅) | ✅ 완료 |
| 0-2c | IBKR WSH 필드 프로브 v3 (24개 이벤트 타입 전수조사, EPS 발견) | ✅ 완료 |
| 0-3 | `test_data_availability_audit.md`에 capability matrix를 최종 기입 | ✅ 완료 (WSH v3 반영) |
| 0-4 | 결정: `/calendar` 소스 + Node↔IBKR 연동 방식 | ✅ 완료 (결정 #5/#6 확정) |

**세부 단계 목적/설명 (0단계)**
- `0-1` 목적: UI에 필요한 Finnhub 데이터 필드 유무를 확정. 설명:
  - UI에 필요한 범위(회사 뉴스 + 회사 프로필 + 다음 실적일)를 대상으로 Finnhub 프로브를 실행한다.
  - 심볼은 고정된 소수 세트(AAPL/MSFT/TSLA)로 통일해 결과를 비교 가능하게 만든다.
  - 원본 JSON 응답을 `tmp/probes/`에 “심볼+엔드포인트+날짜”가 드러나는 파일명으로 저장해 재현 가능하게 한다.
  - 필드가 없으면 “없음”을 매트릭스에 명시하고, 추정/대체/가짜 값을 만들지 않는다.
  - 완료 조건(눈으로 확인): `tmp/probes/`에 Finnhub 원시 JSON 샘플이 있고, 매트릭스에 Finnhub 필드가 Yes/No로 명시되어 있다.
  - 사람 검증(비개발자): JSON 파일 몇 개를 열어 실제 응답(placeholder 아님)인지 확인하고, 매트릭스가 그 결과를 반영하는지 확인.
  - 흔한 문제/주의: 원시 샘플 저장을 빼먹음; 콘솔 로그에 키/토큰이 노출.
- `0-2` 목적: IBKR TWS 연결 및 OHLC 수집 가능 여부를 1차 확인. 설명:
  - v1 프로브로 host/port/권한이 맞는지와 “일봉 historical bars”가 end-to-end로 동작하는지 확인한다.
  - 실패는 땜질하지 말고 capability gap으로 기록한다(예: Reuters 불가, WSH 빈 응답 등).
  - 설정 변경 전/후 비교를 위해 원시 샘플 또는 요약을 남긴다.
  - 완료 조건(눈으로 확인): 최소 1개 심볼에서 일봉 OHLC 샘플이 비어있지 않고, 실패/갭은 명시적으로 기록되어 있다.
  - 사람 검증(비개발자): 프로브 출력에 날짜 구간과 OHLCV 값이 실제로 포함되는지(빈 배열 아님) 확인.
  - 흔한 문제/주의: live/paper 포트 혼동; TWS 권한/설정 미허용.
- `0-2b` 목적: `conId` 기반 WSH 메타데이터/이벤트 접근 가능성 확인. 설명:
  - *블로킹* 메타데이터 호출로 결과가 비어있지 않은지(메타데이터 + 이벤트) 확인한다.
  - 심볼별로 대표 샘플(메타데이터 1개 + 이벤트 1개)을 저장해 이후 회귀 점검이 가능하게 한다.
  - 심볼별 편차(일부는 되고 일부는 안 됨)가 있으면 그 사실을 그대로 기록한다.
  - 완료 조건(눈으로 확인): 최소 1개 심볼에 대해 메타데이터 JSON 1개 + 이벤트 JSON 1개가 저장되어 있고, 내용이 비어있지 않다.
  - 사람 검증(비개발자): 저장된 JSON을 열어 `{}`/`[]`가 아니라 이벤트 타입/식별자 같은 필드가 들어있는지 확인.
  - 흔한 문제/주의: 비블로킹 호출로 인해 “잠깐 비어있는 것”을 “불가”로 오판; 파일명이 뒤섞여 심볼 구분 불가.
- `0-2c` 목적: 필요한 재무 필드를 담는 WSH 이벤트 타입을 식별. 설명:
  - UI가 요구하는 필드(EPS actual/estimate, revenue 등)를 기준으로 이벤트 타입을 전수조사한다.
  - 각 이벤트 타입에 어떤 numeric 필드가 존재하는지, 그리고 UI 컬럼 의미와 일치하는지 기록한다.
  - “불가”(예: revenue 없음)는 명확히 적어 Step 6/7 범위를 정직하게 만든다.
  - 완료 조건(눈으로 확인): 각 UI 필드가 WSH에서 가능한지 여부가 정리되어 있고, 예시 payload가 참조로 남아있다.
  - 사람 검증(비개발자): EPS actual/estimate 예시가 최소 1개 존재하는지, revenue는 “없음”으로 명시되어 있는지 확인(확정된 경우).
  - 흔한 문제/주의: 비슷한 이름의 필드를 혼동; 한 심볼에서만 나온 값을 전체로 일반화.
- `0-3` 목적: 프로브 결과를 실행 가능한 구현 맵으로 정리. 설명:
  - `test_data_availability_audit.md`의 capability matrix를 *모든 UI 컬럼*에 대해 아래 중 하나로 확정해 채운다:
    - IBKR 제공 / Finnhub 제공 / OHLC에서 계산 / 불가
  - “불가”인 경우에는 후속 의사결정(컬럼 제거 vs 빈 값 허용 vs 대체 공급자)을 함께 적어 둔다.
  - 이후 단계에서 같은 질문을 다시 꺼내지 않도록, 매트릭스를 “참조 가능한 단일 근거”로 유지한다.
  - 완료 조건(눈으로 확인): 모든 UI 컬럼이 정확히 1개의 최종 분류를 가지며, “TBD/빈칸”이 남아있지 않다.
  - 사람 검증(비개발자): 매트릭스를 위에서 아래로 훑어 빈 칸/누락 컬럼이 없는지 확인.
  - 흔한 문제/주의: “아마” 같은 애매한 표기; 불가 항목에 대해 후속 결정(제거/빈값/대체)이 연결되지 않음.
- `0-4` 목적: IBKR 의존 단계(Steps 6–8)를 진행하기 위한 전제 확정. 설명: 2가지 결정을 “구현/검증 가능한 수준”으로 확정하고, 운영 디테일까지 함께 확정한다.
  - 결정 #5: `/calendar` 소스 전략(어떤 provider가 캘린더 데이터를 제공하고, 어떤 방식으로 pull할지).
  - 결정 #6: Node↔IBKR 연동 구현 방식(Step 7 및 기타 IBKR 엔드포인트에서 Node/TS 백엔드가 IBKR를 어떤 프로세스/프로토콜로 호출할지).
  - 확인 체크리스트(나중에 “내 PC에서는 되는데”로 막히는 것을 방지):
    - IBKR(TWS/IB Gateway)가 어디서 실행되는지(백엔드와 같은 PC인지), 그리고 무엇을 쓰는지(TWS vs IB Gateway)
    - API host/port(예: `127.0.0.1:7496` live, `127.0.0.1:7497` paper — 실제 값은 사용자 확인)
    - Python 설치/실행이 가능한지(옵션 B/C에 필요), 그리고 “항상 실행되는 로컬 서비스”를 허용하는지(옵션 C)
  - 이 결정의 산출물: 선택한 옵션 + 반복 실행 가능한 “hello IBKR historical bars” 프로브(연결 검증용)를 확정한다.
  - 완료 조건(눈으로 확인): 선택된 옵션이 문서에 기록되어 있고, host/port와 “반복 실행 가능한 프로브”가 구체적으로 적혀 있다.
  - 사람 검증(비개발자): 기록된 host/port가 TWS/Gateway 설정 화면의 값과 동일한지 확인할 수 있다.
  - 흔한 문제/주의: 옵션 B/C를 선택했는데 Python 가능 여부를 확인하지 않음; host/port를 비워둬 이후 단계가 막힘.

**WSH v3 핵심 발견(기존 판정 재수정):**
- v1은 `reqWshMetaData()`(비동기) → 빈 응답. v2는 `getWshMetaData()`(블로킹) + `conId` → 풍부한 데이터 확인.
- **`wshe_eps`에 EPS actual + estimate 존재** (`amount_oc`, `estimated_eps`, `change_amount`, `change_percent`).
- **Revenue(매출)는 WSH에 없음** → Finnhub `/stock/earnings`로 보충 필요.

**검증 훅 (0단계 마감):**
- 확인: `test_data_availability_audit.md`가 모든 UI 컬럼에 대해 ✅/❌/Computed를 포함하는지.
- 확인: `tmp/probes/`에 Finnhub/IBKR 프로브 산출물(JSON)이 존재하는지.
- 게이트: 사용자가 2개 미결 결정을 확정해야 6-7단계 진행 가능.

#### ✅ 1단계 — 기반: update status 저장 + API
목적
- 데이터 소스별(CSV tickers, Finnhub news, IBKR calendar, IBKR OHLC) “마지막 성공 업데이트 시각”을 **영구 저장**한다.
- Data Control Window(8단계)에서 재시작과 무관하게 동일한 상태를 표시할 수 있게 한다.

“백엔드 재시작 후에도 status가 유지된다”의 의미
- status는 서버 메모리(변수)가 아니라 SQLite(또는 백엔드의 영구 DB)에 저장되어야 한다.
- 백엔드 프로세스를 중지/재시작한 뒤에도 `GET /api/updates/status`가 동일한 `last_success_at` 값을 반환해야 한다.

source key(프론트가 의존할 안정 키)
- 프론트가 안정적으로 매핑할 수 있도록 소수의 고정 키를 사용한다:
  - `tickers_csv`
  - `finhub_news`
  - `ibkr_calendar`
  - `ibkr_ohlc_1d`

API 계약(초안)
- `GET /api/updates/status`는 안정적인 JSON 구조를 반환한다. 예:
  - `{ "sources": { "tickers_csv": { "lastSuccessAt": "...", "details": {..} }, ... } }`
- 아직 한 번도 성공한 적 없는 key는 `lastSuccessAt: null`로 반환한다(가짜 값 금지).

백엔드 파일:
- `terminal/backend/src/db.ts`
  - 소스별 업데이트 시각 저장 테이블 `update_status` 추가(또는 동등 테이블).
    - 권장 스키마:
      - `source_key TEXT PRIMARY KEY` (예: `ibkr_ohlc_1d`, `ibkr_calendar`, `finhub_news`, `tickers_csv`)
      - `last_success_at TEXT`
      - `details_json TEXT NOT NULL DEFAULT '{}'`
      - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
- 서비스 `terminal/backend/src/services/updateStatusRepository.ts` 추가
  - `getUpdateStatus(sourceKey)` / `listUpdateStatuses()`
  - `setLastSuccess(sourceKey, isoTimestamp, details?)`
- `terminal/backend/src/server.ts`
  - `GET /api/updates/status` 추가

검증
- 백엔드 재시작 후에도 status가 유지된다.

**세부 단계 (1단계)**
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | `initDb()`에 `update_status` 테이블 생성 | `terminal/backend/src/db.ts` | 백엔드 시작 후 테이블 존재 확인 (`sqlite_master` 조회) | ✅ |
| 1-2 | `updateStatusRepository.ts` 구현 | `terminal/backend/src/services/updateStatusRepository.ts` | `npx tsc --noEmit` → 0 errors | ✅ |
| 1-3 | `GET /api/updates/status` 엔드포인트 연결 | `terminal/backend/src/server.ts` | `curl http://localhost:8080/api/updates/status` → 4개 키 포함 | ✅ |
| 1-4 | 영구성 검증(값 설정 → 재시작 → 동일 값) | (런타임) | 재시작 후에도 `lastSuccessAt` 동일 | ✅ |

**세부 단계 목적/설명 (1단계)**
- `1-1` 목적: 업데이트 시각을 DB에 영속화. 설명:
  - `initDb()`에서 `update_status` 테이블을 “재시작해도 안전(idempotent)”하게 생성한다.
  - 스키마는 계획의 핵심 요구( `source_key` PK, ISO timestamp 문자열, JSON details 필드 )를 만족해야 한다.
  - 검증 기준: 런타임에서 백엔드가 사용하는 SQLite 파일에 실제로 테이블이 존재해야 한다.
  - 완료 조건(눈으로 확인): DB에서 테이블/컬럼이 조회되고, 백엔드 재시작 후에도 에러 없이 정상 기동한다.
  - 사람 검증(비개발자): (UI 없음) 개발자가 `sqlite_master` 조회 결과를 보여주면 된다.
  - 흔한 문제/주의: 서버가 쓰는 DB 파일과 다른 파일에 테이블을 만들어버림; 재시작 때 CREATE가 다시 실행되어 실패.
- `1-2` 목적: 상태 read/write 로직을 한 곳에 모음. 설명:
  - `listUpdateStatuses`, `setLastSuccess`, (선택) `getUpdateStatus`를 제공하는 repository를 만든다.
  - source key는 고정 allowlist( tickers_csv, finhub_news, ibkr_calendar, ibkr_ohlc_1d )로 관리해 키가 흔들리지 않게 한다.
  - `details_json`에는 카운트/최신 날짜 같은 최소 정보만 저장하고, 원문 payload는 저장하지 않는다.
  - 완료 조건(눈으로 확인): 서버 코드가 ad-hoc SQL 대신 repository를 통해 읽고/쓰며, `npx tsc --noEmit`가 통과한다.
  - 사람 검증(비개발자): status 값을 1회 set한 뒤 `GET /api/updates/status`에서 그 값이 보이는 시연.
  - 흔한 문제/주의: 키 오타로 `finhub_news`/`finnhub_news` 혼재; `details_json`에 과도한 원문 저장.
- `1-3` 목적: 프론트/운영에서 상태를 확인 가능하게 함. 설명:
  - `GET /api/updates/status`를 추가하고, 항상 4개 키를 포함하는 안정적인 JSON 형태를 반환한다.
  - 한 번도 성공한 적 없는 키는 `lastSuccessAt: null`로 반환한다(가짜 금지).
  - 이 엔드포인트는 provider 호출 없이 read-only로 유지하고, 시크릿이 포함된 로그를 남기지 않는다.
  - 완료 조건(눈으로 확인): `curl`로 호출 시 매번 4개 키가 항상 존재하고, 초기에는 null로 나온다.
  - 사람 검증(비개발자): 브라우저 주소창에 URL을 붙여 넣으면 JSON이 보인다(크래시/로그인 없음).
  - 흔한 문제/주의: 일부 키가 누락되어 UI가 깨짐; 임의의 가짜 timestamp를 채워 넣음(정책 위반).
- `1-4` 목적: 인메모리가 아니라 “재시작 후에도 유지”를 증명. 설명:
  - 테스트 또는 통제된 코드 경로에서 repository로 알려진 timestamp를 저장한다.
  - 백엔드 프로세스를 재시작한 뒤 `GET /api/updates/status`에서 동일 timestamp가 유지되는지 확인한다.
  - 재시작 후 null로 돌아가면 “잘못된 DB 파일 사용/인메모리 저장” 가능성이므로 오류로 간주한다.
  - 완료 조건(눈으로 확인): 재시작 전/후 `lastSuccessAt` 값이 정확히 동일하다.
  - 사람 검증(비개발자): 재시작 전/후 `curl` 결과를 화면으로 비교한다.
  - 흔한 문제/주의: 테스트는 메모리 DB에 쓰고 런타임은 파일 DB에서 읽는 등, 읽기/쓰기 DB가 다름.

**검증 훅 (1단계 마감):**
```
1. npx tsc --noEmit → 0 errors
2. 터미널에서: curl http://localhost:8080/api/updates/status
3. status 값을 1회 기록(set) 후 백엔드 재시작
4. 다시 curl → 동일 lastSuccessAt 확인
```
- 사용자 확인 필요: **Yes**

#### ✅ 2단계 — Default ticker CSV: read + append API(백엔드)
목적
- 브라우저는 로컬 파일을 직접 읽기/쓰기가 어렵다. 따라서 백엔드가 아래를 책임진다:
  - CSV 경로에서 티커 목록 읽기
  - 새 티커를 CSV의 **마지막 행(파일 끝)**에 append
- 이는 Default Ticker Window(3단계)를 가능하게 한다.

보안 제약(필수)
- `csvPath`는 allowlist root(초기값: `tradigview_screener/original_data/`) 아래만 허용한다.
- 확장자는 `.csv`만 허용한다.
- 티커는 `trim` + `uppercase` 정규화 후, 허용 문자(예: `[A-Z0-9.\-]`)만 통과시킨다.
- `..` 경로 탐색(path traversal)을 차단한다.

“마지막 행에 append” 정의
- 새 티커는 파일의 마지막에 **새 줄(row)**로 추가한다.
- 헤더가 있으면 보존한다.
- 파일이 비었거나 파싱 불가하면 명확한 오류로 실패한다(가짜/임의 생성 금지).

견고성(Windows 파일 교체)
- 원자적 쓰기: 임시 파일 작성 → 원본 파일 교체.
- `EBUSY/EPERM` 같은 일시 오류는 짧은 백오프로 재시도한다.

API 계약(초안)
- `GET /api/tickers?csvPath=...` → `{ csvPath, tickers: ["AAPL", "MSFT", ...] }`
- `POST /api/tickers/add` body `{ csvPath, ticker }` → `{ csvPath, tickerAdded, tickers }` (또는 유사)

백엔드 파일:
- 서비스 `terminal/backend/src/services/tickerCsvService.ts` 추가
  - `readTickersFromCsv(csvPath)`
  - `appendTickerToCsv(csvPath, ticker)`
  - 보안/정책:
    - 허용 루트: `tradigview_screener/original_data/`
    - `.csv` 강제
    - ticker 정규화(Trim + Uppercase)
    - 중복 기본 정책: reject
    - 원자적 write(temp→replace) + `EBUSY/EPERM` 재시도
- `terminal/backend/src/server.ts`
  - `GET /api/tickers?csvPath=...`
  - `POST /api/tickers/add` body `{ csvPath, ticker }`
  - 성공 시 `update_status`의 `tickers_csv` 갱신

검증
- add 호출 후 CSV 마지막 행에 append 되고, `GET /api/tickers`가 즉시 반영한다.

**세부 단계 (2단계)**
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | `readTickersFromCsv()` 구현 + unit tests | `terminal/backend/src/services/tickerCsvService.ts` | `npm run test` → tickerCsvService 관련 테스트 통과 | ✅ |
| 2-2 | `appendTickerToCsv()` 구현 + 보안/정책 체크 | `terminal/backend/src/services/tickerCsvService.ts` | 비허용 `csvPath`/ticker 거절, 허용 케이스 성공 | ✅ |
| 2-3 | 원자적 쓰기(temp→replace) + Windows 잠금 재시도 | `tickerCsvService.ts` 내부 헬퍼 | 반복 POST에서도 `EBUSY/EPERM`로 간헐 실패하지 않음 | ✅ |
| 2-4 | `GET /api/tickers` 구현 | `terminal/backend/src/server.ts` | `curl "http://localhost:8080/api/tickers?csvPath=tradigview_screener/original_data/watch%20lists2_2026-02-22.csv"` → ticker list 반환 | ✅ |
| 2-5 | `POST /api/tickers/add` 구현 | `terminal/backend/src/server.ts` | POST 성공 후 GET에서 새 ticker가 보임(검증 후 수동으로 CSV 원복) | ✅ |
| 2-6 | 성공 시 `update_status(tickers_csv)` 갱신 | `updateStatusRepository` | `GET /api/updates/status`에서 `tickers_csv.lastSuccessAt` 업데이트 | ✅ |

**세부 단계 목적/설명 (2단계)**
- `2-1` 목적: CSV에서 ticker 목록을 안정적으로 추출. 설명:
  - allowlist된 CSV를 파싱하고, 결정된 헤더(`Ticker` 또는 `Symbol`)에서 티커를 추출한다.
  - 결과 티커는 `trim` + 대문자화로 정규화하고, 빈/잘못된 행은 제외한다.
  - 공백이 포함된 파일명(예: `watch lists2_...`)에서도 깨지지 않도록 샘플 CSV로 유닛 테스트를 만든다.
  - 완료 조건(눈으로 확인): 기본 CSV 경로로 `GET /api/tickers` 호출 시 티커 리스트가 실제로 나온다.
  - 사람 검증(비개발자): (3단계 UI 이후) Default Ticker 창에서 티커가 자동으로 표시된다.
  - 흔한 문제/주의: 헤더 이름/대소문자 불일치; 공백 포함 파일명 처리 실패; 빈 문자열/중복이 섞여 나옴.
- `2-2` 목적: ticker 추가를 안전하게 수행. 설명:
  - `csvPath` 검증: allowlist root + `.csv` 확장자 + `..` 차단 + 결정적 경로 해석.
  - ticker 검증: 허용 문자셋 + 정규화 + 중복 정책(기본 reject).
  - 오류는 “원인별로 조치 가능한” 메시지가 되도록 한다(예: allowlist 위반, 중복, invalid ticker).
  - 완료 조건(눈으로 확인): 정상 티커는 파일 마지막 줄에 추가되고, 잘못된 입력은 4xx + 이해 가능한 메시지로 거절된다.
  - 사람 검증(비개발자): `ZZZZ` 1회 추가는 성공, 같은 값 2회 추가는 “중복”으로 실패.
  - 흔한 문제/주의: `..`를 허용해 임의 파일을 수정할 수 있게 됨; 중복을 조용히 허용; 사용자 실수도 500으로 뭉뚱그림.
- `2-3` 목적: Windows 파일 잠금 이슈로 인한 간헐적 실패를 방지. 설명:
  - 임시 파일을 같은 디렉토리에 작성한 뒤 원본을 교체하는 원자적 write를 사용한다.
  - `EBUSY/EPERM` 등 일시 오류에 대해 최대 10회, 짧은 백오프로 재시도한다.
  - 영구 실패(경로 불가/권한/파일 없음 등)에는 무작정 재시도하지 않고 빠르게 실패시킨다.
  - 완료 조건(눈으로 확인): POST를 여러 번 연속 호출해도 Windows 잠금 때문에 랜덤하게 실패하지 않는다.
  - 사람 검증(비개발자): 테스트 티커 3~5개를 연속으로 추가해도 간헐 에러가 없어야 한다.
  - 흔한 문제/주의: temp 파일을 다른 폴더/드라이브에 만들어 replace가 실패; 영구 실패까지 재시도해 원인 파악이 늦어짐.
- `2-4` 목적: UI가 읽을 수 있는 조회 API 제공. 설명:
  - `GET /api/tickers`가 `readTickersFromCsv()`를 호출하도록 연결한다.
  - 쿼리 파라미터는 검증 후 거절/허용을 명확히 하고, 임의 파일 읽기를 절대 허용하지 않는다.
  - 응답 형태는 `{ csvPath, tickers: string[] }`로 안정적으로 유지한다.
  - 완료 조건(눈으로 확인): 공백이 있는 파일 경로도 URL 인코딩된 상태로 정상 동작한다.
  - 사람 검증(비개발자): (3단계 UI 이후) CSV 경로를 바꿔도 앱이 죽지 않고 오류/결과를 표시한다.
  - 흔한 문제/주의: URL 인코딩 누락으로 400/404; 성공/실패 시 JSON 형태가 바뀌어 UI가 깨짐.
- `2-5` 목적: UI가 추가할 수 있는 쓰기 API 제공. 설명:
  - `POST /api/tickers/add`가 `appendTickerToCsv()`를 호출하도록 연결한다.
  - 성공 시 UI가 갱신할 수 있도록 “업데이트된 리스트” 또는 충분한 정보를 반환한다.
  - 성공적인 write 이후에만 `update_status(tickers_csv)`를 갱신한다.
  - 완료 조건(눈으로 확인): POST 성공 후 바로 GET에서 새 티커가 보인다.
  - 사람 검증(비개발자): UI에서 Add를 누르면 즉시 목록에 뜬다(페이지 새로고침 없이).
  - 흔한 문제/주의: 실패인데도 status를 갱신; 파일은 변경됐는데 UI 리스트 갱신을 안 함.
- `2-6` 목적: 운영/프론트에서 “성공 시각”을 확인. 설명:
  - 성공 시 `setLastSuccess('tickers_csv', nowIso, details)`로 갱신한다.
  - `details`에는 `{ csvPath, tickerAdded }` 같은 최소 정보만 저장하고 CSV 원문은 저장하지 않는다.
  - `GET /api/updates/status`에서 `tickers_csv.lastSuccessAt`가 변하는지로 검증한다.
  - 완료 조건(눈으로 확인): 성공적인 add 이후 `tickers_csv.lastSuccessAt`가 null이 아닌 값으로 바뀐다.
  - 사람 검증(비개발자): (8단계 UI 이후) “마지막 성공”이 계속 비어있지 않다.
  - 흔한 문제/주의: ISO 포맷이 아닌 문자열로 저장(표시가 깨짐); details에 민감한 로컬 경로를 과도하게 저장.

**검증 훅 (2단계 마감):**
```
1. 허용 csvPath로 GET /api/tickers → 티커 리스트 확인
2. POST /api/tickers/add로 신규 티커 추가
3. 파일 마지막 row에 추가됐는지 확인
4. 다시 GET /api/tickers → 즉시 반영 확인
5. GET /api/updates/status → tickers_csv lastSuccessAt 업데이트 확인
```
- 사용자 확인 필요: **Yes**

#### ✅ 3단계 — Default Ticker Window(프론트)
목적
- CSV에 저장된 “기본 티커 리스트”를 UI에서 확인/갱신/추가할 수 있게 한다.
- 프론트는 파일을 직접 만지지 않고(브라우저 제한), 2단계 백엔드 API만 호출한다.

UI 동작(최소/명확)
- CSV Path 입력:
  - 기본값: `tradigview_screener/original_data/watch lists2_2026-02-22.csv`
  - 사용자가 편집 가능하지만, 최종 허용/거절은 백엔드가 수행
- Reload 버튼:
  - `GET /api/tickers` 호출 → 리스트 갱신
- Add ticker:
  - 티커 입력 후 Add 클릭
  - `POST /api/tickers/add` 호출
  - 성공 시 리스트 재로딩(응답 사용 또는 Reload 재호출)

에러 처리
- 경로/티커가 거절되면 창 내부에 간단한 에러 메시지만 표시한다(추가 모달 금지).

프론트 파일:
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`
  - 윈도우 타입 `default-ticker` 추가
- `src/app/components/DefaultTickerWindow.tsx` 신규
  - UI: CSV 경로(수정 가능) + Reload 버튼 + 목록 + Add 입력/버튼
  - Step 2 API 호출
- 윈도우 등록:
  - `src/app/components/DraggableWindow.tsx` switch에 `default-ticker` 추가
  - `src/app/components/AddTabModal.tsx` 체크박스 추가(라벨: “Default Ticker”)
  - `src/app/App.tsx` title 매핑 추가(“Default Ticker”)

검증
- UI에서 티커 추가 → 백엔드 성공 → 목록 갱신

**세부 단계 (3단계)**
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | 윈도우 타입 `default-ticker` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts` | 타입 추가 후 빌드/런 정상 | ✅ |
| 3-2 | `DefaultTickerWindow.tsx` 구현 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DefaultTickerWindow.tsx` | 페이지 로드시 티커 목록 로드/렌더 | ✅ |
| 3-3 | `DraggableWindow.tsx`에 렌더 스위치 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DraggableWindow.tsx` | AddTab에서 선택 시 창이 뜸 | ✅ |
| 3-4 | `AddTabModal.tsx`에 체크박스 추가(라벨: “Default Ticker”) | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/AddTabModal.tsx` | UI에서 선택 가능 | ✅ |
| 3-5 | `App.tsx` 타이틀 매핑 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx` | `default-ticker` → “Default Ticker” | ✅ |
| 3-6 | 수동 UI 스모크 테스트 | (브라우저) | 창 열기 → 로드 → 추가 → 리스트 갱신 확인 | ✅ |

**세부 단계 목적/설명 (3단계)**
- `3-1` 목적: 윈도우 시스템에서 선택 가능한 타입을 추가. 설명:
  - `WindowType` 유니온(및 관련 맵)에 `default-ticker`를 추가해 창이 인스턴스화될 수 있게 한다.
  - 제거/변경된 타입과의 불일치(렌더 스위치 누락 등)가 없도록 정리한다.
  - 타입/타이틀/라벨 문자열을 일관되게 유지한다.
  - 완료 조건(눈으로 확인): Add Tab에서 “Default Ticker”를 선택해 창을 만들었을 때 런타임 에러 없이 열린다.
  - 사람 검증(비개발자): Add Tab에 “Default Ticker”가 존재하는지 확인(3-4와 함께 확인).
  - 흔한 문제/주의: 타입만 추가하고 렌더/타이틀 연결을 빼먹어 빈 창이 뜸.
- `3-2` 목적: 기본 티커 관리 UI를 제공. 설명:
  - `DefaultTickerWindow.tsx`는 “얇은 클라이언트”로 구현한다: CSV 경로 입력 + Reload + 목록 + Add 폼.
  - 브라우저에서 파일 I/O를 시도하지 않고, Step 2의 백엔드 API(`GET /api/tickers`, `POST /api/tickers/add`)만 호출한다.
  - 백엔드 검증 오류는 창 내부에 인라인으로 간단히 표시한다(모달 금지).
  - 완료 조건(눈으로 확인): 백엔드가 정상일 때 목록이 보이고, 경로/티커가 거절되면 창 안에 에러 문구가 표시된다(앱 크래시 없음).
  - 사람 검증(비개발자): 일부러 말이 안 되는 경로(예: `C:\\`)를 넣었을 때 “거절 메시지”가 창 안에 보이는지 확인.
  - 흔한 문제/주의: 프론트가 잘못된 백엔드 포트/URL로 호출함; 에러가 콘솔에만 찍히고 UI에는 안 보임.
- `3-3` 목적: 데스크톱 레이아웃에서 실제 렌더되게 연결. 설명:
  - `DraggableWindow.tsx`의 switch에 `default-ticker` 케이스를 추가해 `DefaultTickerWindow`를 렌더한다.
  - 다른 창과 동일한 props 패턴(위치/크기/상태)을 유지한다.
  - CSV 경로가 잘못된 경우에도 크래시하지 않고 에러 표시로 처리한다.
  - 완료 조건(눈으로 확인): 창을 열면 빈 화면이 아니라 입력/버튼/목록 UI가 실제로 렌더된다.
  - 사람 검증(비개발자): 창을 여러 번 열고 닫아도 중복 생성/빈 창 문제가 없는지 확인.
  - 흔한 문제/주의: switch 연결 누락으로 창은 뜨는데 내용이 비어 있음.
- `3-4` 목적: 사용자가 창을 열 수 있게 함. 설명:
  - `AddTabModal.tsx`에 체크박스를 추가해 `default-ticker` 창을 생성할 수 있게 한다.
  - 라벨은 계획대로 “Default Ticker”를 정확히 사용한다.
  - on/off 토글 동작이 기존 창들과 동일하게 동작하는지 확인한다.
  - 완료 조건(눈으로 확인): 체크박스가 보이고, 체크 1회에 창이 정확히 1개 생성된다.
  - 사람 검증(비개발자): 체크 1회→창 1개, 체크 해제→닫힘(또는 기존 창들과 같은 동작)인지 확인.
  - 흔한 문제/주의: 라벨 오타(수락 실패); 토글 반복 시 창이 여러 개 생김.
- `3-5` 목적: 창 제목을 사람이 읽기 좋게 표시. 설명:
  - `App.tsx`에서 `default-ticker` → “Default Ticker” 타이틀 매핑을 추가한다.
  - 중복/충돌하는 매핑이 없도록 하고, 문자열을 안정적으로 유지한다(수락 테스트 앵커).
  - 창 전환 시 제목이 stale하게 남지 않게 한다.
  - 완료 조건(눈으로 확인): 창 헤더/제목에 “Default Ticker”가 정확히 표시된다.
  - 사람 검증(비개발자): 대소문자/공백까지 포함해 화면에 보이는 문자열이 정확한지 확인.
  - 흔한 문제/주의: 기존 인스턴스에 타이틀이 바로 반영되지 않아 새로고침 전까지 구 타이틀이 남음.
- `3-6` 목적: end-to-end로 동작 확인. 설명:
  - 창을 열고 `GET /api/tickers` 호출 및 리스트 렌더를 확인한다.
  - 티커를 추가하고 `POST /api/tickers/add` 호출 후 리스트가 갱신되는지 확인한다.
  - 테스트용으로 추가된 티커는 이후 수동으로 원복해 레포 데이터가 오염되지 않게 한다.
  - 완료 조건(눈으로 확인): add가 end-to-end로 성공하고, 목록이 즉시 갱신된다.
  - 사람 검증(비개발자): 테스트 티커를 추가한 뒤 창을 닫고 다시 열어도(또는 Reload) 동일 티커가 남아 있으면 CSV 저장이 된 것.
  - 흔한 문제/주의: 백엔드 미실행으로 네트워크 에러; 데모 후 CSV에 테스트 티커가 남아 데이터가 오염됨.

**검증 훅 (3단계 마감):**
```
1. Default Ticker Window 열기
2. Reload → GET /api/tickers 호출 확인
3. Add ticker → POST /api/tickers/add 호출 확인
4. 성공 후 목록이 갱신되는지 확인
```
- 사용자 확인 필요: **Yes**

#### ✅ 4단계 — Finnhub 인제션(백엔드)
목적
- Brave/mock 기반 뉴스 대신, Finnhub에서 **company news**(회사 뉴스)와 **press release**(보도자료)를 모두 수집해 기존 `news_items` 저장소에 적재한다.
- 두 종류의 데이터는 `source_type`으로 구분하여 **별도 저장**한다:
  - `source_type = 'company_news'` — Finnhub `/company-news` 엔드포인트
  - `source_type = 'press_release'` — Finnhub `/press-releases` 엔드포인트
-  - `source_type = 'market_news'` — Finnhub `/news?category=general` 엔드포인트
- 프론트는 `GET /api/news?source_names=FINNHUB`(전체) 또는 `&source_type=company_news`/`press_release`/`market_news`(필터)로 조회한다.
- 수집된 각 뉴스 row에 대해, 해당 날짜+티커의 OHLC 데이터가 이미 DB에 있으면 change% 컬럼을 즉시 병합한다.

시크릿 처리
- `FINNHUB_API_KEY`(권장) 또는 기존 파일 fallback에서 키를 읽는다.
- API 키나 시크릿이 포함된 URL 전체를 로그로 찍지 않는다.

증분 수집 정책(중복 방지 + 갭 방지)
- **중복 방지**: `news_items`의 `UNIQUE(source, url)` 제약으로 같은 기사가 두 번 삽입되지 않는다(`INSERT OR IGNORE`).
- **갭 방지(incremental pull)**: 각 `source_type` 별로 `MAX(published_at)`을 조회해, 그 이후 시점부터만 Finnhub에 요청한다.
  - 최초 수집(DB에 해당 source_type이 없음): 기본 lookback 기간(예: 7일)부터 수집.
  - 이후 수집: `MAX(published_at)` 이후 ~ 현재까지 수집.
- **최신 데이터 우선**: 매 수집 시 항상 현재 시각까지를 종료 시점으로 하여 최신 뉴스가 빠지지 않게 한다.
- DB에 이미 있는 기사는 `INSERT OR IGNORE`로 안전하게 건너뛴다.

change 저장 구조(`news_change_metrics`) — **forward-looking**
- `news_items`에 change 컬럼을 계속 늘리지 않고, 아래 별도 테이블을 migration으로 추가한다:
  - `news_id` (TEXT, FK → `news_items.id`)
  - `metric_key` (TEXT) — 표준: `change_1d_pct`, `change_from_open_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`; custom: `custom_{N}d_pct`
  - `value_pct` (REAL)
  - `ohlc_ticker` (TEXT) — change 계산에 사용한 티커
  - `reference_date` (TEXT) — 뉴스 기준(anchor) OHLC 날짜 (`YYYY-MM-DD`)
  - `target_date` (TEXT) — N거래일 후(forward) OHLC 날짜 (`YYYY-MM-DD`)
  - `forward_trading_days` (INTEGER) — 앞으로 본 거래일 수
  - `calc_version` (TEXT)
  - `computed_at` (TEXT) — 파생값 계산 시각(ISO)
  - PK: `(news_id, metric_key)`
- 이 row들은 다음 시점에 채워진다:
  1. **4단계(Finnhub 인제션 시)**: 해당 뉴스의 티커+날짜에 대응하는 OHLC가 이미 DB에 있으면 표준 metric row를 즉시 upsert.
  2. **7단계(IBKR OHLC 업데이트 후)**: OHLC가 새로 들어온 심볼/날짜에 대해 누락된 표준 metric row를 백필.
  3. **8단계(Data Control Window)**: `7D Change Update`와 `Custom Change Update`로 선택적 재계산 실행.

API 계약(초안)
- `POST /api/news/pull-finhub` — `company_news`, `press_release`, `market_news`를 선택적으로 수집하고 요약을 반환:
  - `{ inserted: <n>, skipped: <n>, source: "FINNHUB", details: { company_news: { inserted, skipped }, press_release: { inserted, skipped }, market_news: { inserted, skipped } } }`
- `GET /api/news?source_names=FINNHUB` — 전체 Finnhub 뉴스 조회
- `GET /api/news?source_names=FINNHUB&source_type=company_news` — company news만 조회
- `GET /api/news?source_names=FINNHUB&source_type=press_release` — press release만 조회
- `GET /api/news?source_names=FINNHUB&source_type=market_news` — market news만 조회

백엔드 파일:
- `terminal/backend/src/config.ts`
  - `FINNHUB_API_KEY`를 읽는 설정 추가(또는 파일 fallback)
- Provider `terminal/backend/src/services/finnhubNewsProvider.ts` 추가
  - **company news**: Finnhub `/company-news?symbol=X&from=...&to=...` 호출 → `insertNewsItem()`에 매핑
    - `source = 'FINNHUB'`, `source_type = 'company_news'`
  - **press release**: Finnhub `/press-releases?symbol=X&from=...&to=...` 호출 → `insertNewsItem()`에 매핑
    - `source = 'FINNHUB'`, `source_type = 'press_release'`
  - **market news**: Finnhub `/news?category=general&minId=...` 호출 → `insertNewsItem()`에 매핑
    - `source = 'FINNHUB'`, `source_type = 'market_news'`
    - ticker 범위와 무관하며, `minId` 페이지네이션으로 더 오래된 헤드라인을 추적
  - 각 타입별 `MAX(published_at)` 조회 → 증분 수집 구현
- 서비스 `terminal/backend/src/services/newsChangeMerger.ts` 추가
  - 뉴스 row의 `(ticker, published_at 날짜)` 기준으로 OHLC DB에서 해당 날짜의 change 데이터를 조회/계산
  - 결과를 `news_change_metrics`에 upsert
  - 4단계 인제션 시(새 뉴스 insert 후)와 7단계 OHLC 업데이트 후(backfill) 양쪽에서 호출
- `terminal/backend/src/server.ts`
  - `POST /api/news/pull-finhub` 추가(EODHD와 유사한 형태)
  - company_news + press_release + market_news를 sourceType에 따라 수집 후 표준 change metric upsert 시도
  - 성공 시 `update_status`의 `finhub_news` 갱신

검증
- 인제션 후 `GET /api/news?source_names=FINNHUB`로 조회 가능
- `source_type` 필터로 company_news / press_release / market_news를 각각 조회 가능
- OHLC 데이터가 있는 날짜의 뉴스 row에 대응하는 `news_change_metrics` row가 생기고, `GET /api/news`에서는 change 값이 병합되어 보임

**세부 단계 (4단계)**
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | `FINNHUB_API_KEY` 설정 로딩 추가 | `terminal/backend/src/config.ts` | 키가 없으면 명확한 오류(키 값 로그 금지) | ✅ |
| 4-2 | `news_change_metrics` 테이블 마이그레이션 | `terminal/backend/src/db.ts` | `sqlite_master`에 테이블 존재, PK=`(news_id, metric_key)` 확인 | ✅ |
| 4-3 | Finnhub company news provider 구현 | `terminal/backend/src/services/finnhubNewsProvider.ts` | `/company-news` 매핑 결과가 `news_items` 스키마에 맞고 `source_type='company_news'` | ✅ |
| 4-4 | Finnhub press release provider 구현 | `terminal/backend/src/services/finnhubNewsProvider.ts` | `/press-releases` 매핑 결과가 `news_items` 스키마에 맞고 `source_type='press_release'` | ✅ |
| 4-4a | Finnhub market news provider 구현 | `terminal/backend/src/services/finnhubNewsProvider.ts` | `/news?category=general` 매핑 결과가 `news_items` 스키마에 맞고 `source_type='market_news'` | ✅ |
| 4-5 | `GET /api/news` source_type 필터 파라미터 지원 | `server.ts`, `newsRepository.ts` | `?source_type=company_news`로 해당 type만 반환 | ✅ |
| 4-6 | `newsChangeMerger` 서비스 구현 | `terminal/backend/src/services/newsChangeMerger.ts` | 뉴스 row 기준으로 `news_change_metrics` 표준 row upsert | ✅ |
| 4-7 | `POST /api/news/pull-finhub` 구현(양쪽 수집 + change upsert) | `terminal/backend/src/server.ts` | `{inserted, skipped, source, details}` 반환 + change upsert count 포함 | ✅ |
| 4-8 | 성공 시 `update_status(finhub_news)` 갱신 | `updateStatusRepository` | `GET /api/updates/status`에서 lastSuccessAt 업데이트 | ✅ |
| 4-9 | 적재 데이터 조회 + source_type 필터 + change 검증 | (런타임) | `GET /api/news?source_names=FINNHUB&source_type=company_news|press_release|market_news` rows 확인, change 값 병합 확인 | ✅ |

**세부 단계 목적/설명 (4단계)**
- `4-1` 목적: Finnhub 키를 안전하게 로드. 설명:
  - `FINNHUB_API_KEY` 환경변수를 우선 사용하고, 없을 때만 파일 fallback을 사용한다.
  - 키가 없으면 명확히 실패시키되, 키 자체를 절대 로그/출력하지 않는다.
  - config 로딩을 단일화해 provider 코드가 시크릿을 직접 읽지 않도록 한다.
  - 완료 조건(눈으로 확인): env var가 있으면 백엔드가 정상 동작하고, 없으면 “키 없음”이 명확한 에러로 실패한다(키 값 노출 없음).
  - 사람 검증(비개발자): 설정이 없을 때 인제션 호출이 “missing key”로 실패하는지, 그리고 키가 화면/로그에 노출되지 않는지 확인.
  - 흔한 문제/주의: 키를 로그로 찍거나, 키가 포함된 전체 URL을 로그로 찍어 유출; 여러 곳에서 키를 읽어 설정이 꼬임.
- `4-2` 목적: change 데이터를 `news_items`와 분리하여 별도 테이블에 저장. 설명:
  - `db.ts`의 `initDb()` 안에서 `CREATE TABLE IF NOT EXISTS news_change_metrics (...)`를 추가한다.
  - 표준 metric과 custom metric을 모두 같은 테이블에 저장할 수 있게 `(news_id, metric_key)` PK를 사용한다.
  - 기존 news row에는 원본 데이터만 남기고, change는 별도 row로 관리한다.
  - 완료 조건(눈으로 확인): `news_change_metrics` 테이블이 존재하고 PK가 `(news_id, metric_key)`로 설정된다.
  - 사람 검증(비개발자): SQLite 뷰어에서 `news_change_metrics` 테이블 생성 여부와 컬럼 목록을 확인.
  - 흔한 문제/주의: metric_key 네이밍 불일치로 같은 의미의 row가 중복 생성; FK 누락으로 고아 row 발생.
- `4-3` 목적: Finnhub **company news** 응답을 DB 스키마로 변환. 설명:
  - Finnhub `/company-news?symbol=X&from=YYYY-MM-DD&to=YYYY-MM-DD` 호출을 수행한다.
  - 기존 `insertNewsItem()` 계약에 맞게 매핑하고, `source='FINNHUB'`, `source_type='company_news'`를 일관되게 설정한다.
  - **증분 수집**: 해당 source_type의 `MAX(published_at)`을 조회해 from 날짜를 결정한다.
    - DB에 company_news가 없으면: 기본 lookback(7일 전)부터 수집.
    - DB에 company_news가 있으면: MAX(published_at) 이후 ~ 현재까지 수집.
  - 중복 방지: `INSERT OR IGNORE` + `UNIQUE(source, url)` 제약.
  - 완료 조건(눈으로 확인): `GET /api/news?source_names=FINNHUB&source_type=company_news`에서 title/time/url이 비어있지 않은 rows가 나온다.
  - 사람 검증(비개발자): (5단계 이후) News 창 필터에서 "Company News"를 선택하면 실제 헤드라인이 보여야 한다.
  - 흔한 문제/주의: timestamp 단위/타임존 혼동; `source_type` 문자열 불일치로 필터가 깨짐; 반복 pull 시 중복 급증.
- `4-4` 목적: Finnhub **press release** 응답을 DB 스키마로 변환. 설명:
  - Finnhub `/press-releases?symbol=X&from=YYYY-MM-DD&to=YYYY-MM-DD` 호출을 수행한다.
  - `source='FINNHUB'`, `source_type='press_release'`로 매핑한다.
  - **증분 수집**: company_news와 동일한 전략(source_type별 MAX(published_at) 기반).
  - press release 응답 구조가 company-news와 다를 수 있으므로 매핑 필드를 각각 확인한다.
  - 완료 조건(눈으로 확인): `GET /api/news?source_names=FINNHUB&source_type=press_release`에서 rows가 나온다.
  - 사람 검증(비개발자): (5단계 이후) News 창 필터에서 "Press Release"를 선택하면 별도의 보도자료가 보인다.
  - 흔한 문제/주의: press release URL 구조가 company-news와 달라 dedup key 충돌; 빈 press release가 생기는 경우 처리.
- `4-4a` 목적: Finnhub **market news** 응답을 DB 스키마로 변환. 설명:
  - Finnhub `/news?category=general` 호출을 수행한다.
  - `source='FINNHUB'`, `source_type='market_news'`로 매핑한다.
  - `market_news`는 symbol 파라미터가 없으므로 ticker CSV를 돌지 않고, `minId` 기반으로 더 오래된 헤드라인을 순차 조회한다.
  - `related`가 비어 있는 경우가 많으므로 `tickers=[]` row를 허용한다.
  - 완료 조건(눈으로 확인): `GET /api/news?source_names=FINNHUB&source_type=market_news`에서 rows가 나온다.
  - 사람 검증(비개발자): (5단계 이후) News 창 필터에서 "Market News"를 선택하면 CNBC/MarketWatch/Bloomberg 등의 일반 시장 기사들이 보인다.
  - 흔한 문제/주의: 날짜 파라미터가 없으므로 custom/recent 의미를 company_news와 동일하게 구현하려고 하면 안 됨; `minId` 중복 페이지 처리 필요.
- `4-5` 목적: `GET /api/news` API에 `source_type` 필터 파라미터를 추가. 설명:
  - `newsRepository.ts`의 조회 쿼리에 `source_type` 조건을 추가한다.
  - `GET /api/news?source_names=FINNHUB&source_type=company_news` → company_news만 반환.
  - `GET /api/news?source_names=FINNHUB&source_type=press_release` → press_release만 반환.
  - `GET /api/news?source_names=FINNHUB&source_type=market_news` → market_news만 반환.
  - `source_type` 파라미터가 없으면 기존과 동일(모든 type 반환).
  - 완료 조건(눈으로 확인): 각 source_type 필터가 정확히 해당 type의 row만 반환.
  - 사람 검증(비개발자): curl로 source_type 유/무 2가지를 호출해 결과 개수가 다른지 확인.
  - 흔한 문제/주의: source_type 파라미터를 서버에서 꺼내지 않아 필터가 무시됨; SQL injection 주의(바인드 파라미터 사용).
- `4-6` 목적: 뉴스 row 기준으로 OHLC 기반 change metric row를 upsert하는 서비스. 설명:
  - `newsChangeMerger.ts` 구현 — **forward-looking 방향**:
    - 입력: 병합 대상 뉴스 row 목록 (또는 표준 metric row가 누락된 news_id 자동 조회)
    - 각 row의 `(tickers_csv 첫 번째 ticker, published_at 날짜)` 기준으로 뉴스일(anchor) OHLC를 조회
    - `change_from_open_pct`: 뉴스일 시가 → 뉴스일 종가 (당일)
    - `change_1d_pct`: 뉴스일 종가 → **1거래일 후** 종가
    - `change_7d_pct`: 뉴스일 종가 → **5거래일 후** 종가
    - `change_14d_pct`: 뉴스일 종가 → **10거래일 후** 종가
    - `change_30d_pct`: 뉴스일 종가 → **22거래일 후** 종가
    - 아직 해당 기간이 지나지 않아 forward OHLC가 없으면 `NULL`
    - 결과를 `news_change_metrics`에 upsert (`metric_key`, `value_pct`, `ohlc_ticker`, `reference_date`, `target_date`, `computed_at`)
  - 뉴스일이 휴장일이면 가장 가까운 이전 거래일의 OHLC를 anchor로 사용.
  - 완료 조건(눈으로 확인): OHLC 데이터가 있는 날짜의 news_id에 대해 `news_change_metrics`에 표준 metric row가 생긴다.
  - 사람 검증(비개발자): 특정 news_id를 SQL로 조회해 `metric_key='change_7d_pct'` 같은 row가 생겼는지 확인.
  - 흔한 문제/주의: OHLC DB 경로를 잘못 열음; 주말/휴장일 날짜 매칭 실패; 0으로 나누기(Open=0).
- `4-7` 목적: company news + press release 양쪽 수집을 한 번에 수행 + 표준 change metric upsert 트리거. 설명:
  - `POST /api/news/pull-finhub`:
    1. Default Ticker CSV에서 티커 로드
    2. 각 티커에 대해 `pullCompanyNews()` + `pullPressReleases()` 호출 (증분 수집)
    3. `sourceType`에 `market_news`가 포함되면 별도로 `pullMarketNews()` 호출
    4. insert 결과를 source_type별로 집계
    5. 새로 삽입된 뉴스 row에 대해 `newsChangeMerger`로 표준 metric upsert 시도
    6. 요약 반환: `{ inserted, skipped, source: "FINNHUB", details: { company_news: {..}, press_release: {..}, market_news: {..}, changeUpserted: <n> } }`
  - startup 자동 실행은 하지 않는다(명시적 트리거만).
  - 완료 조건(눈으로 확인): POST 호출이 합리적인 시간 내에 끝나고 요약 JSON을 반환한다.
  - 사람 검증(비개발자): Update 버튼 클릭 후 company_news + press_release + market_news 수치가 기대대로 갱신되는지 확인.
  - 흔한 문제/주의: 한쪽 endpoint 실패 시 전체 실패로 처리할지 부분 성공으로 처리할지 정책 필요; 티커가 많으면 rate limit.
- `4-8` 목적: "마지막 성공 시각"을 기록. 설명:
  - 성공 시 `update_status(finhub_news).lastSuccessAt = now()`를 저장한다.
  - `details`에는 카운트/기간 같은 최소 정보만 저장하고 원문 응답은 저장하지 않는다.
  - `GET /api/updates/status`로 실제 갱신을 확인한다.
  - 완료 조건(눈으로 확인): 성공적인 pull 직후 `finhub_news.lastSuccessAt`가 null이 아닌 ISO timestamp가 된다.
  - 사람 검증(비개발자): (8단계 이후) Data Control Window에서 "마지막 성공" 시각이 실제로 바뀐다.
  - 흔한 문제/주의: insert 실패인데도 lastSuccessAt을 갱신해 오해를 유발; 표시하기 어려운 포맷(비 ISO) 저장.
- `4-9` 목적: 적재 + 필터 + change 전체 검증. 설명:
  - 아래를 확인한다:
    1. `GET /api/news?source_names=FINNHUB` → row 존재, 필수 필드 비어있지 않음
    2. `GET /api/news?source_names=FINNHUB&source_type=company_news` → company_news row만 반환
    3. `GET /api/news?source_names=FINNHUB&source_type=press_release` → press_release row만 반환
    4. OHLC 데이터가 있는 날짜의 news_id에 대해 `news_change_metrics` row가 존재하고, `GET /api/news`에서 값이 병합되어 보임
  - 데이터가 없다면 UI 문제가 아니라 수집/저장/조회 경로를 먼저 의심한다.
  - 완료 조건(눈으로 확인): 위 4가지 체크가 모두 통과.
  - 사람 검증(비개발자): News 창에서 필터 전환(company news ↔ press release)이 되고, Change% 컬럼에 숫자가 있는지 확인.
  - 흔한 문제/주의: source_type 오타로 필터 결과가 빔; change row는 저장됐지만 API join이 빠져 UI가 전부 NULL처럼 보임.

**검증 훅 (4단계 마감):**
```
1. POST /api/news/pull-finhub 실행
2. GET /api/news?source_names=FINNHUB → rows 확인
3. GET /api/news?source_names=FINNHUB&source_type=company_news → company_news rows만 확인
4. GET /api/news?source_names=FINNHUB&source_type=press_release → press_release rows만 확인
5. OHLC 데이터가 있는 날짜의 뉴스 row → change_1d_pct 등 non-NULL 확인
6. GET /api/updates/status → finhub_news lastSuccessAt 확인
```
- 사용자 확인 필요: **Yes**

#### ✅ 5단계 — “News Feed: Brave API” → “news feed:finhub api” 전환(프론트)
목적
- 기존 `brave-news`(mock 포함) UI를 제거하고 Finnhub 기반으로 교체한다.
- 라벨을 정확히 `news feed:finhub api`로 바꾸고, UI가 Brave를 암시하지 않게 한다.

필수 준수사항(정책/요구)
- `generateMockData()` 및 synthetic rows를 완전히 제거한다.
- 데이터가 없거나 필드가 불가하면 빈 값/`-`로 렌더하고, 절대 가짜 값을 만들지 않는다.

데이터 흐름
- 프론트는 `GET /api/news?source_names=FINNHUB`로 렌더한다.
- **source_type 필터**: 창 상단에 “Company News” / “Press Release” 필터를 제공한다.
  - 하나만 선택: `GET /api/news?source_names=FINNHUB&source_type=company_news` (또는 `press_release`)
  - 둘 다 선택(기본): `GET /api/news?source_names=FINNHUB` (source_type 파라미터 없이 전체 반환)
  - 필터 상태는 컴포넌트 state로 관리(URL/전역 상태 불필요).
- **Change% 컬럼**: 각 뉴스 row의 `change_1d_pct`, `change_from_open_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct` 값을 백엔드 응답에서 그대로 렌더한다. 값이 없으면 `-`로 표시.
- **Earning date 라인**: 각 뉴스 row의 earning date는 백엔드 응답의 snapshot 필드(`earning_snapshot_date`, `earning_snapshot_session`)를 사용한다.
  - 이 값은 뉴스 발행 당시 기준으로 이미 저장된 snapshot이며, 프론트에서 현재 provider를 다시 조회해 계산하지 않는다.
  - `earning_snapshot_status='resolved'`일 때만 `Earning: <date>` 라인을 표시한다.
- **Industry 컬럼**: 각 뉴스 row의 `industry` 값을 백엔드 응답에서 렌더한다.
  - 값은 **기본 참조 CSV(`tradigview_screener/original_data/watch lists2_2026-02-22.csv`)의 해당 ticker row를 우선 참조**한 결과여야 한다.
  - CSV에 `Industry` 값이 없거나 ticker 매칭이 실패한 경우에만 Finnhub company profile 계열 값을 fallback으로 사용한다.
  - 둘 다 없으면 `-`로 표시한다.
- **Keywords 컬럼**: 각 뉴스 row의 `keywords` 값을 백엔드 응답에서 렌더한다.
  - 저장 원천은 `news_fulltext.keywords_json`.
  - 후속 AI keyword 분석이 아직 수행되지 않은 row는 빈 배열 또는 `pending` 상태로 남고, UI에서는 `-`로 표시한다.
- 창 내부에 “Update” 버튼(split-dropdown 포함)을 두고 `POST /api/news/pull-finhub`로 **백그라운드 잡**을 시작한다.
  - 백엔드는 즉시 `{ jobId }` 를 반환하고, 수집은 비동기로 실행된다.
  - Update 버튼 옆에 **View Log** 버튼을 배치한다. **시작 시 자동 오픈 금지**  사용자가 눌러야만 로그 패널이 열린다.
  - 로그 패널: 진행률 바(처리된 ticker / 전체 ticker, %) + 실시간 로그 라인 + 에러 표시.
  - 잡 완료/실패 후에도 View Log로 최종 결과 확인 가능.
- 창 툴바에 **`7D Change Update` 버튼**과 **`Custom Change Update` 버튼**도 함께 둔다.
  - 두 버튼은 Data Control Window의 동일 버튼과 **같은 backend job/API**를 호출한다.
  - News Feed Window는 변화율을 보면서 바로 재계산을 돌릴 수 있는 **편의 진입점**이고, Data Control Window는 운영 패널 역할을 유지한다.
  - `Custom Change Update`는 lookback 거래일 수 입력(`N`)을 함께 받는다.

프론트 파일:
- `brave-news` 윈도우 타입을 `finhub-news`로 교체(권장):
  - `src/app/types.ts`
    - `WindowType`에서 `brave-news` 제거, `finhub-news` 추가
    - `BraveNews*` 타입은 `FinnhubNews*`로 대체하거나, 가능하면 `NewsItem`을 재사용
- `src/app/components/AddTabModal.tsx`
  - 라벨을 정확히 `news feed:finhub api`로 변경
  - 토글 타입도 `finhub-news`로 변경
- `src/app/App.tsx`
  - title 매핑: `finhub-news` → `news feed:finhub api`
- `src/app/components/DraggableWindow.tsx`
  - `finhub-news`에 대해 `FinnhubNewsWindow` 렌더
- `src/app/components/BraveNewsWindow.tsx`
  - `FinnhubNewsWindow.tsx`로 rename(권장) 또는 컴포넌트명만 변경
  - **`generateMockData()` 제거 + synthetic rows 제거**
  - 백엔드 기반 fetch로 교체
    - 최소: `GET /api/news?source_names=FINNHUB`로 렌더
    - 필요 시 버튼으로 `POST /api/news/pull-finhub` 트리거

검증
- mock 생성이 완전히 사라지고, Finnhub 데이터만 표시된다.

**세부 단계 (5단계)**
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | 윈도우 타입을 `finhub-news`로 전환(기존 `brave-news` 제거/대체) | `src/app/types.ts` | 타입이 맞게 렌더 스위치됨 | ✅ |
| 5-2 | 컴포넌트 이름/파일을 `FinnhubNewsWindow`로 정리(권장) | `src/app/components/BraveNewsWindow.tsx` → `FinnhubNewsWindow.tsx` | import 경로 반영 | ✅ |
| 5-3 | `generateMockData()` 및 synthetic rows 제거 | `FinnhubNewsWindow.tsx` | 코드/런타임에서 mock 생성 경로 없음 | ✅ |
| 5-4 | 백엔드 기반 fetch로 교체 | `FinnhubNewsWindow.tsx` | `GET /api/news?source_names=FINNHUB`로 렌더 | ✅ |
| 5-5 | (선택) “Update” 버튼 추가(수동 수집 트리거) | `FinnhubNewsWindow.tsx` | 클릭 시 `POST /api/news/pull-finhub` 호출 후 리스트 갱신 | ✅ |
| 5-6 | AddTab 라벨을 정확히 `news feed:finhub api`로 변경 | `src/app/components/AddTabModal.tsx` | UI에 Brave 표기 없음 | ✅ |
| 5-7 | `App.tsx` title 매핑 추가/수정 | `src/app/App.tsx` | `finhub-news` → `news feed:finhub api` | ✅ |
| 5-8 | `DraggableWindow.tsx` 렌더 스위치 연결 | `src/app/components/DraggableWindow.tsx` | `finhub-news`가 `FinnhubNewsWindow`를 렌더 | ✅ |
| 5-9 | source_type 필터 UI 구현 (Company News / Press Release / Market News 선택) | `FinnhubNewsWindow.tsx` | 필터 전환 시 해당 source_type만 표시, `All` 선택 시 전체 표시 | ✅ |
| 5-10 | 서버사이드 키워드 검색(전체 DB 검색) | FinnhubNewsWindow.tsx | 검색어 입력 시 keyword 파라미터로 GET /api/news 호출, 백엔드가 전체 DB 필터링 | ✅ |
| 5-11 | Update 버튼 툴팁(5초 hover 지연) | FinnhubNewsWindow.tsx | Update 버튼을 5초 hover하면 범위 설명 툴팁 노출 | ✅ |
| 5-12 | Ticker 전용 컬럼 추가 | FinnhubNewsWindow.tsx | Date와 Time 사이에 Ticker 컬럼이 표시되고, 클릭 시 검색창 ticker 필터 동작 | ✅ |
| 5-13 | 컬럼 가시성 토글(show/hide columns) | FinnhubNewsWindow.tsx | Columns 버튼 클릭 → 체크박스 드롭다운으로 컬럼 표시/숨김 전환 | ✅ |
| 5-14 | 백엔드 "entire" 모드 — adaptive date-splitting backfill | server.ts, finnhubNewsProvider.ts | `POST /api/news/pull-finhub { mode: "entire" }` → 5년 범위 adaptive 분할 수집, cap 우회, 중복 없음 | ✅ |
| 5-15 | Update 버튼 → split-dropdown (12개 옵션: sourceType별 × mode별) | FinnhubNewsWindow.tsx | 드롭다운에 All/Company/Press/Market × 7d/Recent/Custom 메뉴 | ✅ |
| 5-16 | Source 셀: 우클릭 Copy URL + 클릭 시 링크 열기 | FinnhubNewsWindow.tsx | Source 우클릭 → Copy URL → 클립보드 복사, Source 클릭 → 브라우저 새 탭으로 열림 | ✅ |
| 5-24 | News 테이블에 `Publisher` 컬럼 추가 | `newsRepository.ts`, `FinnhubNewsWindow.tsx` | `publisher` 값 렌더, 클릭/우클릭 동작이 Source와 동일 | ✅ |
| 5-25 | `Source` 컬럼 기본 가시성 해제 | `FinnhubNewsWindow.tsx` | Columns 메뉴에서 Source가 기본 unchecked 상태로 시작 | ✅ |
| 5-17 | 백엔드 잡 큐 + `GET /api/jobs/:jobId` 폴링 엔드포인트 | `server.ts`, `jobManager.ts`(신규) | POST → `{ jobId }` 즉시 반환, GET 폴링 시 `{ status, progress, logs[] }` 응답 | ✅ |
| 5-18 | View Log 버튼 + 로그 패널 UI(자동 오픈 금지) | `FinnhubNewsWindow.tsx` | Update 옆 View Log 클릭 → 진행률 바 + 실시간 로그 표시, 시작 시 자동 열림 없음 | ✅ |
| 5-19 | Update UX 전면 리디자인: 7d/Recent/Custom 3모드 + preflight + date picker | `server.ts`, `finnhubNewsProvider.ts`, `FinnhubNewsWindow.tsx` | Entire 제거 → Custom(date picker + adaptive backfill), 기본 Update → 7d, Recent = per-ticker anchor + preflight 경고 모달, 메인 버튼 = 마지막 사용 모드 기억(localStorage) | ✅ |
| 5-20 | News 툴바에 `7D Change Update` 버튼 추가 | `FinnhubNewsWindow.tsx` | 클릭 시 `POST /api/news/change/update-7d` → `{ jobId }` 반환, 완료 후 목록 재조회 | ✅ |
| 5-21 | News 툴바에 `Custom Change Update` 입력+버튼 추가 | `FinnhubNewsWindow.tsx` | `N` 입력 후 `POST /api/news/change/update-custom` 호출, 완료 후 목록 재조회 | ✅ |
| 5-22 | News 테이블에 `Industry` 컬럼 추가 | `FinnhubNewsWindow.tsx` | `industry` 값 렌더, 없으면 `-` | ✅ |
| 5-23 | News 테이블에 `Keywords` 컬럼 추가 | `FinnhubNewsWindow.tsx` | `keywords` 값 렌더, AI 분석 전에는 `-` | 🚫 |

**세부 단계 목적/설명 (5단계)**
- `5-1` 목적: Brave 기반 창을 Finnhub 기반으로 전환. 설명:
  - `brave-news` 윈도우 타입을 제거하고 `finhub-news`를 canonical 타입으로 만든다.
  - 타입 레벨 모델(`BraveNews*`)은 Finnhub 기준으로 교체하거나 이미 정의된 `NewsItem`을 재사용한다.
  - 성공 기준: 사용자 UI에서 “Brave” 뉴스 창을 여는 경로가 더 이상 존재하지 않는다.
  - 완료 조건(눈으로 확인): Add Tab에 Brave 뉴스 항목이 더 이상 없고, 뉴스 창을 열면 타입이 `finhub-news`로 열린다(크래시 없음).
  - 사람 검증(비개발자): 화면에서 “Brave”라는 단어를 찾아보고(라벨/타이틀 포함) 뉴스 관련 표기가 0인지 확인.
  - 흔한 문제/주의: 타입만 바꾸고 렌더 스위치에서 `brave-news`가 남아 빈 창/크래시 발생.
- `5-2` 목적: 코드 구조/의미를 일치. 설명:
  - 창 컴포넌트를 `FinnhubNewsWindow`로 정리한다(파일 rename 권장).
  - 모든 import/export 경로를 함께 수정해 런타임/빌드 에러가 없게 한다.
  - 의도치 않게 중복 창(Brave/Finnhub 둘 다)이 남지 않게 정리한다.
  - 완료 조건(눈으로 확인): 빌드/실행 시 “module not found” 같은 오류 없이 정상 로드된다.
  - 사람 검증(비개발자): News 창을 열었을 때 빈 화면이 아니라 “목록(비어있어도 됨) / 버튼(옵션)” 등 UI 뼈대가 보인다.
  - 흔한 문제/주의: rename 후 import 경로 누락; export 형태(default/named) 불일치; git에서 케이스만 바꾼 rename이 누락.
- `5-3` 목적: mock 데이터 유입을 원천 차단. 설명:
  - `generateMockData()` 및 synthetic seed 배열을 완전히 제거한다.
  - 백엔드가 빈 배열을 주는 경우 “데모 데이터를 만들기” 같은 fallback을 넣지 않는다.
  - 검증 기준: 프론트 소스에서 `generateMockData` 및 관련 mock 헬퍼 검색 결과가 0건.
  - 완료 조건(눈으로 확인): 백엔드 DB가 비어있을 때도 “데모 헤드라인/샘플 row”가 UI에 나타나지 않는다(빈 상태만 표시).
  - 사람 검증(비개발자): 백엔드를 새로 켠 직후(수집 전) News 창을 열어 sample 항목이 없는지 확인.
  - 흔한 문제/주의: 컴포넌트 state에 남은 하드코딩 배열; `if empty then seed` 로직.
- `5-4` 목적: 실제 저장된 뉴스만 렌더. 설명:
  - 백엔드 `GET /api/news?source_names=FINNHUB`로부터 데이터를 가져와 그대로 렌더한다.
  - 필드가 없으면 빈 값/`-`로 표시하고, 절대 값을 지어내지 않는다.
  - fetch는 mount 시 1회 + (옵션) 수동 refresh로만 수행해 동작을 예측 가능하게 만든다.
  - 완료 조건(눈으로 확인): 브라우저 Network 탭에서 `GET /api/news?source_names=FINNHUB` 요청이 보이고, 응답에 따라 리스트가 바뀐다.
  - 사람 검증(비개발자): DevTools → Network에서 해당 요청을 클릭해 JSON(배열) 응답을 확인.
  - 흔한 문제/주의: 백엔드 포트/주소가 잘못되어 404/네트워크 에러; `source_names=FINNHUB` 파라미터 누락; 빈 배열 처리 미흡.
- `5-5` 목적: 필요 시 수동 갱신 제공(옵션). 설명:
  - 창 내부에 “Update” 버튼을 추가하고 `POST /api/news/pull-finhub`로 수집을 트리거한다.
  - POST 성공 후 `GET /api/news?source_names=FINNHUB`로 리스트를 다시 로드한다.
  - 추가 모달 없이 최소 running/error 상태만 표시한다.
  - 완료 조건(눈으로 확인): Update 클릭 시 “Running…” 같은 간단한 표시가 뜨고, 성공 후 리스트가 갱신된다(또는 실패 시 에러가 인라인 표시).
  - 사람 검증(비개발자): Update를 빠르게 2번 눌러도 2번째는 막히거나 버튼이 비활성화되어 중복 실행이 되지 않는다.
  - 흔한 문제/주의: mount 시 자동으로 POST가 실행되어 예기치 않은 부작용; disable 상태가 없어 중복 수집.
- `5-6` 목적: 요청된 라벨 텍스트를 정확히 반영. 설명:
  - `AddTabModal.tsx`에서 라벨을 정확히 `news feed:finhub api`로 맞춘다(대소문자/공백 포함).
  - 다른 영역에서 “Brave API”가 남아있지 않게 함께 점검한다.
  - 라벨 불일치는 사용자 요구사항 위반이므로 수락 실패로 취급한다.
  - 완료 조건(눈으로 확인): Add Tab에 `news feed:finhub api`가 정확히 표시된다.
  - 사람 검증(비개발자): 글자/공백/콜론 위치까지 화면을 보고 그대로 일치하는지 확인.
  - 흔한 문제/주의: 불필요한 공백/대문자; 다른 매핑에서 다른 문자열을 쓰는 경우.
- `5-7` 목적: 창 제목을 올바르게 표시. 설명:
  - `App.tsx` title 매핑에서 `finhub-news` → `news feed:finhub api`를 정확히 설정한다.
  - 창 전환 시 제목이 stale하게 남지 않도록 한다.
  - 문자열을 안정적으로 유지해 수락 테스트 앵커로 사용한다.
  - 완료 조건(눈으로 확인): 창 헤더/제목에 `news feed:finhub api`가 항상 표시된다.
  - 사람 검증(비개발자): 다른 창으로 이동했다가 다시 돌아와도 제목이 바뀌지 않고 정확히 유지되는지 확인.
  - 흔한 문제/주의: 기존 인스턴스가 이전 제목을 유지; 매핑이 있어도 첫 렌더에만 적용.
- `5-8` 목적: 실제 렌더 스위치 연결 보장. 설명:
  - `DraggableWindow.tsx`에 `finhub-news` 케이스를 추가해 `FinnhubNewsWindow`를 렌더한다.
  - 백엔드가 빈 배열을 반환해도 크래시 없이 렌더되어야 한다.
  - `brave-news` 렌더 경로가 남지 않게 한다.
  - 완료 조건(눈으로 확인): 창을 열면 입력/목록/빈 상태 등 “내용 영역”이 보이고, 완전히 빈 프레임만 뜨지 않는다.
  - 사람 검증(비개발자): 빈 DB 상태에서도 빈 상태 UI가 보이고 에러/크래시가 없는지 확인.
  - 흔한 문제/주의: switch 연결 누락으로 창은 뜨지만 내용이 비어 있음.
- `5-9` 목적: source_type 필터 UI를 구현하여 company news / press release / market news를 선택적으로 표시. 설명:
  - 창 상단(또는 툴바)에 `All` / `Company News` / `Press Release` / `Market News` 버튼 그룹을 배치한다.
  - **All 선택**(기본 상태): `GET /api/news?source_names=FINNHUB` (source_type 파라미터 없이 요청) → 세 종류 모두 표시.
  - **하나만 선택**: `GET /api/news?source_names=FINNHUB&source_type=company_news` 또는 `&source_type=press_release` 또는 `&source_type=market_news` → 선택된 종류만 표시.
  - **Change% 컬럼 렌더**: 각 row의 `change_1d_pct`, `change_from_open_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`를 해당 컬럼에 표시. NULL이면 `-`.
  - **Industry 컬럼 렌더**: 각 row의 `industry`를 표시. NULL이면 `-`.
  - **Keywords 컬럼 렌더**: 각 row의 `keywords`를 표시. 후속 AI keyword 분석 전이면 `-`.
  - 필터 전환 시 기존 데이터를 클리어하고 새 요청을 보낸다(stale 데이터 방지).
  - 완료 조건(눈으로 확인): 필터 UI가 보이고, 전환 시 목록이 해당 type에 맞게 바뀐다. Change% 컬럼에 실제 숫자(또는 `-`)가 표시된다.
  - 사람 검증(비개발자): Market News만 선택 → 일반 시장 기사만 보이는지 확인. All 선택 → 세 종류가 함께 보이는지 확인. Change% 값이 있는 row에서 숫자가 보이는지 확인.
  - 흔한 문제/주의: 필터 state와 API 파라미터 불일치; 필터 전환 시 이전 응답이 잠깐 보이는 깜빡임; Change% 컬럼 필드명과 백엔드 응답 키 불일치.

- `5-10` 목적: 검색을 서버사이드로 전환하여 전체 DB에서 검색되도록 한다. 설명:
  - **문제**: 기존에는 `GET /api/news`에서 200건만 받아온 뒤, 프론트에서 `title`/`ticker`에 대해 `.includes()` 클라이언트 필터링 → DB에 수천 건이 있어도 200건 안에서만 검색됨.
  - **해결**: 백엔드 `GET /api/news`에 이미 구현된 `keyword` 쿼리 파라미터를 활용. 프론트에서 검색어 입력 시 `keyword=검색어`를 붙여 백엔드에 재요청 → SQL `WHERE LOWER(title || ' ' || body) LIKE '%검색어%'`로 전체 DB 검색 후 200건 반환.
  - **디바운스**: 타이핑할 때마다 API 호출하면 과도하므로, 300ms 디바운스를 적용. 타이핑이 멈춘 후 300ms 뒤에만 fetch 실행.
  - **기존 client-side 필터 제거**: `useMemo` 내의 `searchQuery` 기반 `.filter()` 로직을 제거하고, `searchQuery`가 바뀌면 디바운스 후 `fetchNews()`를 재호출하도록 변경.
  - **렉 방지**: SQLite LIKE 검색은 수만 건에서도 밀리초 단위; 전송은 200건 이하; `react-window` 가상화 유지.
  - 완료 조건(눈으로 확인): 검색창에 티커/키워드 입력 → 네트워크 탭에서 `keyword=...` 파라미터가 붙은 GET 요청 확인 → DB 전체에서 매칭된 결과가 표시됨.
  - 사람 검증(비개발자): DB에 200건 넘게 저장된 상태에서 특정 티커로 검색 → 최근 200건에 없던 과거 뉴스도 검색되는지 확인.
  - 흔한 문제/주의: 디바운스 미적용 시 타이핑 중 과도한 API 호출; 빈 검색어일 때 keyword 파라미터를 보내지 않아야 함(전체 리스트 반환); source_type 필터와 keyword가 동시에 적용되어야 함.
- `5-11` 목적: Update 버튼에 지연 툴팁(5초 hover)을 추가하여 동작 범위를 설명한다. 설명:
  - Update 버튼에 마우스를 5초 이상 올려두면, 버튼 아래에 다크 팝업 툴팁이 표시된다.
  - 내용(영어): "This update fetches news from the last 7 days up to today, without duplicates. If data already exists, it resumes from the last stored date. To retrieve news older than 7 days, use a separate manual update with custom date range parameters."
  - 마우스를 떼면 즉시 사라진다.
  - 구현: IIFE 패턴으로 `useState`/`useRef`를 사용해 5초 `setTimeout` 후 표시, `onMouseLeave`에서 타이머 클리어 + 숨김.
  - 완료 조건(눈으로 확인): Update 버튼에 5초 hover → 설명 팝업 표시 → 마우스 떼면 사라짐.
  - 흔한 문제/주의: 타이머가 클리어되지 않아 마우스를 떼도 팝업이 남음; z-index 부족으로 다른 요소에 가려짐.
- `5-12` 목적: Ticker 정보를 별도 컬럼으로 분리하여 가독성과 정렬을 개선한다. 설명:
  - 기존에는 ticker가 Title 셀 안에 배지로만 표시되어, ticker 기준 정렬/필터가 직관적이지 않았다.
  - `ColumnId` 타입에 `'ticker'`를 추가하고 `DEFAULT_COLUMNS`에서 `date`와 `time` 사이에 배치한다.
  - `renderCell`에 `ticker` 케이스를 추가: 클릭 가능한 배지로 렌더하여 `setSearchQuery(ticker)`로 검색창 필터를 적용하고, 필요 시 `onTickerClick`도 함께 호출한다.
  - `getSortValue`에 `ticker` 케이스를 추가해 알파벳순 정렬 지원.
  - 완료 조건(눈으로 확인): 테이블에 Ticker 컬럼이 Date 옆에 표시되고, 헤더 클릭으로 정렬 가능.
  - 사람 검증: Ticker 배지 클릭 → 해당 ticker 뉴스만 필터링되는지 확인.
  - 흔한 문제/주의: colWidths 배열 길이와 columns 배열 길이 불일치; renderCell에서 ticker 케이스 누락 시 빈 셀.
- `5-13` 목적: 사용자가 불필요한 컬럼을 숨겨 화면 공간을 효율적으로 사용할 수 있게 한다. 설명:
  - 툴바에 `Columns3` 아이콘 버튼을 추가하고, 클릭 시 체크박스 드롭다운을 표시한다.
  - 각 컬럼명 옆에 체크박스 → 체크 해제하면 해당 컬럼이 테이블에서 숨겨진다.
  - `visibleCols` state(Set)로 가시성 관리; `activeColumns`/`activeColWidths`를 computed로 필터링.
  - 드롭다운 외부 클릭 시 자동 닫힘(mousedown 이벤트 리스너).
  - 완료 조건(눈으로 확인): Columns 버튼 → 드롭다운 → 체크 해제한 컬럼이 테이블에서 사라짐.
  - 사람 검증: 여러 컬럼을 숨겼다 다시 켜서 테이블 레이아웃이 깨지지 않는지 확인.
  - 흔한 문제/주의: activeColumns 계산에서 width 인덱스가 원래 columns 기준이 아닌 filtered 기준이어야 함; 모든 컬럼을 끄면 빈 테이블.
- `5-14` 목적: API cap(~200건)을 우회하여 가능한 전체 히스토리를 누락 없이 수집하는 adaptive date-splitting backfill을 백엔드에 추가한다. 설명:
  - **기존 문제**: 긴 기간을 한 번에 요청하면 Finnhub API가 최대 ~200건만 반환 → 고빈도 ticker는 중간/과거 구간이 잘림(partial download).
  - **해결**: `adaptiveBackfill()` 함수 추가 (`finnhubNewsProvider.ts`):
    - 요청 결과가 `CAP_THRESHOLD`(190건) 이상이면 기간을 반으로 분할하여 재귀 호출.
    - 각 leaf window가 cap 미만일 때까지 반복 → 누락 방지.
    - 최소 window = 1일 (`MIN_WINDOW_DAYS`). 1일에서도 cap에 닿으면 경고 로그 출력 후 해당 구간은 그대로 반환.
  - `pullCompanyNewsBackfill()` / `pullPressReleasesBackfill()` / `pullMarketNewsBackfill()` — custom 범위 조회에 사용.
  - `POST /api/news/pull-finhub` 스키마에 `sourceType: z.enum(["all", "company_news", "press_release", "market_news"]).optional().default("all")` 추가.
  - `mode === "custom"` 시 사용자가 선택한 `from`/`to`를 기준으로 adaptive backfill 또는 page cutoff를 수행한다.
  - `mode === "recent"`는 마지막 저장 지점 이후 증분 수집, `mode === "7d"`는 최근 7일 기준 수집이다.
  - **티커 범위**: `maxTickers` 기본값 = 0 → **CSV 전체 티커**(인위적 제한 없음). 0이 아닌 값을 전달하면 해당 수만큼만 제한 가능.
  - `MAX_RETRIES` 3 → 10으로 상향 (재시도 정책 준수).
  - 중복 방지는 기존 DB `UNIQUE (source, url)` + `INSERT OR IGNORE`로 처리.
  - 백엔드 응답과 status update에 `mode` + `sourceType`을 포함.
  - 완료 조건(눈으로 확인): `POST /api/news/pull-finhub { mode: "entire", sourceType: "company_news" }` → 콘솔에 `[backfill] company_news AAPL ... splitting…` 로그가 보이며, DB에 과거 데이터가 저장됨.
  - 흔한 문제/주의: adaptive splitting으로 API 호출 횟수가 증가하므로 rate limit(60 calls/min) 주의; 분할 간 300ms sleep 삽입; 빈 구간은 빈 배열 반환.
  - 변경 파일: `terminal/backend/src/services/finnhubNewsProvider.ts`, `terminal/backend/src/server.ts`.
- `5-15` 목적: Update 버튼을 split-dropdown으로 변경하여 **12개 메뉴 옵션**(sourceType별 × mode별)을 제공한다. 설명:
  - 기존 단일 Update 버튼을 두 부분으로 분리:
    - **좌측 버튼**: 마지막 사용 조합을 다시 실행하는 버튼. 기본 초기값은 `handleUpdate('7d', 'all')`.
    - **우측 화살표 버튼**: ChevronDown 아이콘 → 클릭 시 드롭다운 메뉴 표시.
  - `handleUpdate(mode, sourceType)` 시그니처 확장: `mode: '7d' | 'recent' | 'custom'`, `sourceType: 'all' | 'company_news' | 'press_release' | 'market_news'`.
  - `market_news`는 ticker loop가 아니라 Finnhub `/news` 일반 시장 헤드라인(`category=general`)을 `minId`로 뒤로 페이징해 저장한다.
  - 프론트엔드는 더 이상 `maxTickers`를 보내지 않으며, 백엔드 기본값 `0`이 적용되어 CSV 전체 티커를 대상으로 수집한다.
  - 드롭다운 메뉴는 3개 섹션으로 구분:
    - **7d Update 섹션**:
      - 7d Update (All)
      - 7d Company News
      - 7d Press Release
      - 7d Market News
    - **Recent Update 섹션**:
      - Recent Update (All)
      - Recent Company News
      - Recent Press Release
      - Recent Market News
    - **Custom Update 섹션**:
      - Custom Update (All)
      - Custom Company News
      - Custom Press Release
      - Custom Market News
  - `market_news`의 custom/recent는 날짜 파라미터 직접 전달이 아니라 서버 내부 `minId` 페이지네이션 + `published_at` cutoff로 처리된다.
  - 수집 중(`updating === true`)에는 모든 버튼 disabled.
  - 5초 hover 시 지연 툴팁 유지(드롭다운 open 시에는 숨김). 툴팁 내용 업데이트: adaptive backfill 설명 포함.
  - 드롭다운 외부 클릭 시 자동 닫힘. `max-h-[400px] overflow-y-auto`로 스크롤 가능.
  - 완료 조건(눈으로 확인): Update 우측 화살표 클릭 → 12개 메뉴가 3개 섹션으로 grouping되어 표시. Market News 옵션 클릭 → POST body에 `{mode:"recent", sourceType:"market_news"}` 또는 대응 조합이 보인다.
  - 사람 검증: 각 sourceType 옵션 클릭 → 네트워크 탭에서 mode/sourceType 조합이 올바른지 확인.
  - 흔한 문제/주의: 드롭다운 z-index 부족으로 다른 요소에 가려짐; split 버튼 border 연결 부분 시각적 불일치; sourceType 파라미터가 fetch body에 빠지는 실수.
  - 변경 파일: `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`.

- `5-16` 목적: Source를 실제 링크로 사용 가능하게 하고 URL 복사를 제공한다. 설명:
  - Source 텍스트 **좌클릭** 시 해당 뉴스의 `url`을 `window.open(..., '_blank')`로 새 탭에서 연다.
  - Source 텍스트 **우클릭** 시 작은 컨텍스트 메뉴를 띄우고 `Copy URL` 클릭으로 클립보드 복사를 수행한다(Clipboard API 실패 시 textarea fallback).
  - 메뉴 바깥 클릭 또는 `Escape` 입력 시 컨텍스트 메뉴를 닫는다.
  - Source 셀 **우클릭** 시 작은 컨텍스트 메뉴를 띄우고, "Copy URL" 클릭 시 URL을 클립보드에 복사한다.
  - 컨텍스트 메뉴는 외부 클릭 또는 ESC로 닫힌다.
  - 완료 조건(눈으로 확인): Source 클릭 시 새 탭이 열리고, Copy URL 후 메모장에 붙여넣으면 URL이 들어간다.
  - 사람 검증(비개발자): 우클릭→Copy URL→붙여넣기, 좌클릭→브라우저 열림을 각각 확인.
  - 흔한 문제/주의: 브라우저 권한/정책으로 clipboard API가 막혀 fallback 필요; 메뉴가 화면 밖으로 나가는 포지셔닝.

- `5-17` 목적: Update 요청을 동기 응답 대신 백그라운드 잡으로 전환하여, 장시간 수집에도 UI가 멈추지 않게 한다. 설명:
  - `POST /api/news/pull-finhub` 응답을 즉시 `{ jobId }` 반환으로 변경한다. 실제 수집은 백그라운드에서 실행된다.
  - `GET /api/jobs/:jobId` 폴링 엔드포인트를 추가한다: `{ status: "running"|"done"|"failed", progress: { completed, total, pct }, logs: string[], error?: string }`.
  - 잡 상태를 메모리(Map) 또는 SQLite로 관리하는 `jobManager.ts` 모듈을 신규 생성한다.
  - Rate limit 준수: Finnhub 300 req/min 제한 내에서 토큰 버킷 또는 딱레이로 조절.
  - 완료 조건(눈으로 확인): POST 응답이 1초 이내로 `{ jobId }` 반환. GET 폴링 시 `progress.pct`가 0→100으로 증가.
  - 사람 검증(비개발자): Update 클릭 후 페이지가 멈추지 않고 다른 조작이 가능한지 확인.
  - 흔한 문제/주의: 잡 상태가 누락되어 영원히 "running" 상태로 남음; rate limit 초과로 429 응답 발생.

- `5-18` 목적: 사용자가 수집 진행 상황을 **원할 때만** 확인할 수 있는 View Log 버튼과 로그 패널을 제공한다. 설명:
  - Update 버튼(split-dropdown) 우측에 **View Log** 버튼을 배치한다.
  - **시작 시 로그 패널이 자동으로 열리지 않는다.** 사용자가 View Log를 눌러야만 열린다.
  - 로그 패널 내용: 진행률 바(처리된 ticker / 전체 ticker, %), 실시간 로그 라인(타임스탬프 + 메시지), 에러 시 빨간 텍스트.
  - 로그 패널은 닫기 버튼(X) 또는 외부 클릭/ESC로 닫을 수 있다.
  - 잡 완료/실패 후에도 View Log로 최종 결과를 확인할 수 있다.
  - 폴링 주기: 2~3초(status가 done/failed면 중단).
  - 완료 조건(눈으로 확인): Update 클릭 후 View Log 버튼이 활성화됨. 클릭 시 로그 패널에 진행률 + 로그 표시. 완료 후 "Done" 상태.
  - 사람 검증(비개발자): Update 클릭 → View Log 클릭 → 진행률이 올라가는지 확인. Update만 클릭하고 View Log를 누르지 않으면 로그 패널이 안 열리는지 확인.
  - 흔한 문제/주의: 폴링 중단 실패로 로그가 멈쵤; 로그 패널 z-index 부족으로 다른 요소에 가려짐; 잡이 없을 때 View Log 버튼 상태 처리.

- `5-20` 목적: News Feed Window에서도 7일 변화율 재계산을 바로 실행할 수 있게 한다. 설명:
  - 툴바에 `7D Change Update` 버튼을 추가한다.
  - 클릭 시 Data Control Window와 동일한 `POST /api/news/change/update-7d` job을 호출한다.
  - 성공 후 `GET /api/news`를 다시 호출하여 Changes % 셀을 최신 값으로 갱신한다.
  - 완료 조건(눈으로 확인): News 창에서 `7D Change Update` 클릭 → `{ jobId }` 반환 → 완료 후 7D 값이 새로 반영된다.
  - 사람 검증(비개발자): News 창에서 버튼 클릭 후 View Log로 진행률을 보고, 완료 뒤 목록 재조회 시 7D 값이 갱신되는지 확인.
  - 흔한 문제/주의: Data Control과 News Window가 서로 다른 엔드포인트를 호출해 결과가 달라짐; 완료 후 목록 재조회 누락.

- `5-21` 목적: News Feed Window에서도 custom lookback change 재계산을 직접 실행할 수 있게 한다. 설명:
  - 툴바에 숫자 입력(`N` 거래일) + `Custom Change Update` 버튼을 추가한다.
  - 입력값 검증: 양의 정수만 허용하고, 비어있거나 0/음수면 요청을 보내지 않는다.
  - 클릭 시 Data Control Window와 동일한 `POST /api/news/change/update-custom` job을 호출한다.
  - 완료 조건(눈으로 확인): News 창에서 `21` 입력 후 실행 → `{ jobId }` 반환 → 완료 후 custom metric 계산이 반영된다.
  - 사람 검증(비개발자): `21` 입력 후 실행하고, 완료 뒤 대상 뉴스의 custom change 계산 결과가 backend에 저장됐는지 확인.
  - 흔한 문제/주의: 입력값 검증 누락; News Window와 Data Control이 서로 다른 parameter 이름을 보내는 문제.

- `5-22` 목적: News Feed Window에서 산업 정보를 뉴스 row와 함께 볼 수 있게 한다. 설명:
  - 테이블 컬럼에 `Industry`를 추가한다.
  - 값은 backend가 제공하는 `industry` 필드에서 렌더한다.
  - `industry`는 **기본 참조 CSV(`tradigview_screener/original_data/watch lists2_2026-02-22.csv`)의 해당 ticker row를 우선 참조**한 결과를 사용한다.
  - CSV에서 ticker를 찾지 못하거나 `Industry` 계열 컬럼이 비어 있을 때만 Finnhub company profile 계열 값을 fallback으로 허용한다.
  - 완료 조건(눈으로 확인): Industry 컬럼이 보이고, 값이 없는 row는 `-`로 표시된다.
  - 사람 검증(비개발자): 표 몇 행을 기본 참조 CSV와 대조해 industry 문자열이 일치하는지 확인하고, CSV에 없는 종목만 fallback 또는 `-`가 나오는지 확인.
  - 흔한 문제/주의: CSV ticker 매칭 규칙이 news row ticker 형식과 다르면 industry가 과도하게 비게 됨; industry 필드가 백엔드 응답에 없는데 프론트만 먼저 렌더하여 빈 컬럼이 되는 문제.

- `5-23` 목적: News Feed Window에서 후속 AI keyword 분석 결과를 볼 수 있게 한다. 설명:
  - 테이블 컬럼에 `Keywords`를 추가한다.
  - 값은 `news_fulltext.keywords_json`에서 온 `keywords` 배열을 표시한다.
  - **중요:** 키워드 생성 자체는 이번 단계의 범위가 아니며, 나중에 별도 AI agent 작업으로 full text를 읽고 정리한 뒤에만 값이 채워진다.
  - 분석 전 상태는 `-` 또는 pending으로 표시한다.
  - 완료 조건(눈으로 확인): Keywords 컬럼이 보이고, 분석 전 row는 `-`, 분석된 row는 키워드 목록이 표시된다.
  - 사람 검증(비개발자): full text는 있지만 keyword 분석이 아직 없는 row에서 `-`가 표시되는지 확인.
  - 흔한 문제/주의: full text 추출 완료와 keyword 분석 완료를 혼동해 O/X만 보고 keywords가 있다고 가정하는 문제.

- `5-24` 목적: 사용자가 provider가 아니라 원문 사이트 출처를 기본 화면에서 바로 볼 수 있게 한다. 설명:
  - News 테이블에 `Publisher` 컬럼을 추가한다.
  - 값은 backend `GET /api/news` 응답의 `publisher` 필드에서 렌더한다.
  - 클릭/우클릭 동작은 기존 `Source` 셀과 동일하게 유지한다: 좌클릭 새 탭 열기, 우클릭 Copy URL.
  - 값이 없으면 `-`, 알 수 없는 도메인은 `UNKNOWN`으로 표시될 수 있다.
  - 완료 조건(눈으로 확인): Publisher 컬럼이 기본으로 보이고, row 클릭/우클릭 동작이 Source와 동일하게 동작한다.
  - 사람 검증(비개발자): Publisher 텍스트를 클릭하면 기사 링크가 열리고, 우클릭 후 URL 복사로 주소가 붙여넣어지는지 확인.
  - 흔한 문제/주의: 백엔드 응답에 `publisher` 필드가 없으면 컬럼이 전부 `-`로만 보이는 문제.

- `5-25` 목적: provider 정보는 보존하되 초기 화면 복잡도를 낮춘다. 설명:
  - `Source` 컬럼은 제거하지 않고 Columns 드롭다운에서만 다시 켤 수 있게 유지한다.
  - 기본 visible set에서는 `Source`를 제외해 초기 상태를 unchecked로 만든다.
  - 사용자가 `Source`를 다시 켜면 기존 클릭/우클릭 동작과 정렬 동작은 그대로 유지된다.
  - 완료 조건(눈으로 확인): 첫 로드 시 Source 컬럼이 보이지 않고, Columns 메뉴에서만 켤 수 있다.
  - 사람 검증(비개발자): 창을 새로 열었을 때 Source가 안 보이고, Columns 메뉴에서 체크하면 다시 나타나는지 확인.
  - 흔한 문제/주의: 컬럼은 숨겼지만 DEFAULT_VISIBLE에 남아 있어 실제 초기 렌더에는 계속 보이는 문제.

**검증 훅 (5단계 마감):**
```
1. news feed:finhub api 창 열기
2. 네트워크 탭에서 GET /api/news?source_names=FINNHUB 확인
3. UI에 mock 항목이 나타나지 않는지 확인
4. source_type 필터 전환 → Company News만 / Press Release만 / 둘 다 각각 렌더 확인
5. Change% 컬럼에 OHLC 기반 값(또는 `-`) 표시 확인
6. 검색창에 키워드 입력 → 300ms 디바운스 후 GET /api/news?keyword=... 요청 확인 → 전체 DB에서 매칭된 결과 표시
7. Update 버튼에 5초 hover → 설명 툴팁 표시 확인 → 마우스 떼면 사라지는지 확인
8. Ticker 컬럼이 Date 옆에 표시되고, 클릭 시 해당 ticker 필터링
9. Columns 버튼 → 드롭다운에서 컬럼 체크 해제 → 테이블에서 해당 컬럼 숨겨짐
10. Update 우측 화살표 → 드롭다운 메뉴에서 12개 옵션 확인 (All/Company/Press/Market × 7d/Recent/Custom)
11. Custom Company Update 실행 → POST body에 `{mode:"custom", sourceType:"company_news", from:"...", to:"..."}` 확인
12. Recent Market News 실행 → POST body에 `{mode:"recent", sourceType:"market_news"}` 확인
13. Source 컬럼은 기본으로 숨겨져 있고, Columns 메뉴에서 체크해야 다시 보이는지 확인
14. Publisher 컬럼: 좌클릭으로 링크 열기, 우클릭 메뉴에서 Copy URL → 붙여넣기 확인
15. Update 클릭 → 응답이 `{ jobId }` 로 즉시 반환되고, UI가 멈추지 않는지 확인
16. View Log 버튼 클릭 → 로그 패널에 진행률 바 + 로그 표시 확인. Update만 클릭하고 View Log 안 누르면 패널 안 열리는지 확인
17. News 창의 `7D Change Update` 클릭 → `{ jobId }` 반환, 완료 후 목록 재조회 확인
18. News 창의 `Custom Change Update`에 `21` 입력 후 실행 → `{ jobId }` 반환, 완료 후 재조회 확인
19. Industry 컬럼 표시 확인 → 값이 없으면 `-`, 있으면 산업명 표시 확인
20. Keywords 컬럼 표시 확인 → AI keyword 분석 전에는 `-`, 분석 후에는 키워드 목록 표시 확인
21. Publisher 컬럼 값이 있는 row와 `UNKNOWN` row가 정책대로 보이는지 확인
```
- 사용자 확인 필요: **Yes**

#### ⏳ 6단계 — IBKR 캘린더 인제션(백엔드) + mock 캘린더 생성기 중지
목적
- 요구사항: `/calendar`는 **IBKR 데이터만** 사용해야 한다.
- 현재 백엔드는 startup 시 mock 캘린더를 자동 생성하므로, 이를 제거하고 명시적 업데이트로 전환한다.
- **결정 #5 확정**: 일단 IBKR 캘린더(WSH) 데이터를 사용한다. 추후 Finnhub Estimates(유료 구독) 확보 시 `source` 필드를 기준으로 전환할 수 있도록 설계한다.

동작 변경 요약
- 기존: 백엔드 기동 시점에 mock worker가 주기적으로 `mock_provider` rows를 insert
- 변경: 명시적 엔드포인트 호출 시에만 캘린더를 pull+upsert 하고, IBKR만 남긴다.

정리 규칙(중요)
- 첫 IBKR 업데이트 성공 시 `calendar_events`의 `source = 'mock_provider'` rows를 삭제한다.
- 그래야 `/api/calendar/events`가 IBKR-only를 자동으로 만족한다(수동 DB 리셋 불필요).

API 계약(초안)
- `POST /api/ibkr/calendar/update` → `{ upserted: <n>, deletedMockRows: <n>, source: "IBKR" }`

백엔드 파일:
- `terminal/backend/src/services/calendarIngestion.ts`
  - mock worker 로직 제거
  - IBKR 캘린더 pull 서비스(예: `pullIbkrCalendar()`)로 대체
- `terminal/backend/src/server.ts`
  - startup의 `startCalendarIngestionWorkers()` 호출 제거
  - `POST /api/ibkr/calendar/update` 추가
    - IBKR 캘린더 이벤트 fetch
    - `upsertCalendarEvent()`로 upsert (`source = 'IBKR'`)
    - 성공 시 `update_status`의 `ibkr_calendar` 갱신
- 기존 mock row 정리
  - 첫 IBKR 업데이트 성공 이후, `calendar_events`에서 `source = 'mock_provider'` row 삭제
  - 그래야 `/api/calendar/events`가 IBKR-only를 만족

검증
- 업데이트 이후 캘린더 조회 결과가 `source = IBKR`만 포함

**세부 단계 (6단계)**
> ✅ **결정 완료**: IBKR 캘린더 데이터 우선 사용. 추후 Finnhub Estimates 구독 시 전환 가능하도록 `source` 필드로 분리.

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 6-1 | mock 캘린더 worker 로직 제거 | `terminal/backend/src/services/calendarIngestion.ts` | 재시작 후 mock rows가 자동 생성되지 않음 | ✅ |
| 6-2 | startup의 `startCalendarIngestionWorkers()` 호출 제거 | `terminal/backend/src/server.ts` | 서버 시작 직후 mock insert가 발생하지 않음 | ✅ |
| 6-3 | `pullCalendarData()` 구현(결정된 소스 기준) | `terminal/backend/src/services/calendarIngestion.ts` | dry-run 또는 단위 테스트 성공 | ⏳ |
| 6-4 | `POST /api/ibkr/calendar/update` 구현 | `terminal/backend/src/server.ts` | `{ upserted, deletedMockRows, source: "IBKR" }` 반환 | ✅ |
| 6-5 | 첫 성공 후 `mock_provider` rows 삭제 | (DB) | `calendar_events`에서 `source='mock_provider'` count=0 | ✅ |
| 6-6 | 성공 시 `update_status(ibkr_calendar)` 갱신 | `updateStatusRepository` | `GET /api/updates/status`에서 lastSuccessAt 업데이트 | ✅ |

**세부 단계 목적/설명 (6단계)**
- `6-1` 목적: 앞으로 mock 캘린더 row가 더 이상 생성되지 않게 한다. 설명:
  - `calendar_events(source='mock_provider')`를 insert하는 모든 timer/worker 코드 경로를 제거한다.
  - 파일 내에 남아있는 mock 헬퍼(예: `generateMock*`, `setInterval`, 하드코딩 샘플 이벤트)가 없도록 정리한다.
  - 성공 기준: 백엔드 재시작만으로는 어떤 row도 추가되지 않고, 오직 명시적 엔드포인트 호출 때만 변경된다.
  - 완료 조건(눈으로 확인): 백엔드를 재시작해도 `POST /api/ibkr/calendar/update`를 호출하기 전까지 `/api/calendar/events` 결과가 자동으로 늘어나지 않는다.
  - 사람 검증(비개발자): 백엔드 실행 후 1~2분 기다렸다가 `GET /api/calendar/events`를 호출해 “저절로 증가”가 없는지 확인.
  - 흔한 문제/주의: `setInterval`/startup hook이 남아 백그라운드에서 mock insert가 계속 발생.
- `6-2` 목적: 서버 기동 부작용을 제거하여 `/calendar`를 “요청 시 갱신(pull-on-demand)”로 만든다. 설명:
  - 서버 startup 경로에서 `startCalendarIngestionWorkers()` 호출을 삭제한다.
  - 함수가 하위 호환을 위해 남아있더라도 자동 실행되면 안 된다.
  - 검증 포인트: 재시작 후 DB 변화 없음 → `POST /api/ibkr/calendar/update` 호출 시에만 변화.
  - 완료 조건(눈으로 확인): 백엔드 재시작 직후에는 캘린더 DB/응답이 변하지 않고, update 엔드포인트를 호출했을 때만 변한다.
  - 사람 검증(비개발자): 재시작 직후 `GET /api/calendar/events` 결과가 이전과 동일한지 확인(새 mock row 금지).
  - 흔한 문제/주의: 한 군데서만 startup 호출을 지웠지만 다른 초기화 코드에서 여전히 실행.
- `6-3` 목적: 실제 캘린더 pull을 “테스트 가능 + 소스 독립” 형태로 구현한다(결정 의존). 설명:
  - `pullCalendarData()`가 정규화된 이벤트 리스트를 반환하도록 구현한다.
  - 정규화 최소 규칙: 안정적인 ID(또는 결정적 해시), ISO timestamp, symbol, event type, `source` 필드.
  - 선택한 소스에서 제공 불가능한 필드는 명시하고, 절대 가짜 값을 만들지 않는다.
  - 완료 조건(눈으로 확인): `pullCalendarData()`가 정규화된 배열을 반환하고(또는 dev probe/단위 테스트로) 형상을 확인할 수 있다.
  - 사람 검증(비개발자): update 엔드포인트 호출 결과에서 `source`가 "IBKR"(또는 결정된 소스)로 나오고 카운트가 음수가 아닌지 확인.
  - 흔한 문제/주의: timestamp 포맷이 제각각(비 ISO); ID가 실행마다 바뀌어 중복이 생김.
- `6-4` 목적: 운영/UI에서 명시적으로 갱신을 실행할 수 있는 트리거를 제공한다. 설명:
  - `POST /api/ibkr/calendar/update`를 추가하고, pull → upsert → status update를 수행한다.
  - 라우트는 작은 요약(`upserted`, `deletedMockRows`, `source`)을 반환하고 실패 시 non-200을 준다.
  - 시크릿을 로그에 남기지 않고, 카운트/요약 오류만 기록한다.
  - 완료 조건(눈으로 확인): `POST /api/ibkr/calendar/update`가 “작은 요약 JSON”만 반환하고 합리적인 시간 내에 끝난다.
  - 사람 검증(비개발자): 같은 POST를 2번 실행해도 row가 폭증하지 않는지 확인(업서트가 중복을 막아야 함).
  - 흔한 문제/주의: 큰 payload를 그대로 반환; 부분 실패인데도 성공으로 처리하고 status를 갱신.
- `6-5` 목적: 이미 저장된 mock 데이터를 정리해 “IBKR-only” 요구사항을 DB 리셋 없이 만족한다. 설명:
  - *첫 번째* 실제 업데이트 성공 시 `source='mock_provider'` row를 삭제한다.
  - 삭제는 idempotent(여러 번 실행해도 안전)해야 한다.
  - 가능하면 delete+upsert+status update를 하나의 트랜잭션으로 묶는다.
  - 완료 조건(눈으로 확인): 첫 성공 이후 `GET /api/calendar/events` 결과에서 `source='mock_provider'`가 절대 보이지 않는다.
  - 사람 검증(비개발자): `/api/calendar/events` JSON에서 `mock_provider` 문자열이 포함되어 있는지 검색해 0인지 확인.
  - 흔한 문제/주의: pull 실패인데도 cleanup이 실행되어 데이터가 사라짐; cleanup이 startup마다 실행.
- `6-6` 목적: Data Control Window/운영에서 쓸 “마지막 성공 시각”을 영속 저장한다. 설명:
  - 성공 시 `update_status(ibkr_calendar).lastSuccessAt = now()`를 저장한다.
  - `details`에는 최소 정보(예: `{ upserted, deletedMockRows }`)만 저장하고 시크릿/원문 payload는 저장하지 않는다.
  - 완료 조건(눈으로 확인): 성공적인 update 이후 `GET /api/updates/status`에서 `ibkr_calendar.lastSuccessAt`가 null이 아닌 값으로 바뀐다.
  - 사람 검증(비개발자): 실패를 유도했을 때(서비스 다운 등)에는 `lastSuccessAt`가 바뀌지 않는지 확인.
  - 흔한 문제/주의: 실패했는데도 timestamp를 갱신해 오해; `details`에 원문 payload를 저장.

**검증 훅 (6단계 마감):**
```
1. 서버 재시작 → 더 이상 mock 캘린더가 자동 생성되지 않는지 확인
2. POST /api/ibkr/calendar/update 실행
3. GET /api/calendar/events → source=IBKR만 존재하는지 확인
4. GET /api/updates/status → ibkr_calendar lastSuccessAt 확인
```
- 사용자 확인 필요: **Yes**

#### ✅ 7단계 — IBKR 1D OHLC를 `ohlc_1d_watchlist.sqlite`에 저장(백엔드)
목적
- “IBKR Price Data 업데이트”는 백엔드 작업으로 아래를 수행한다:
  1) Default Ticker CSV에서 티커를 읽는다
  2) IBKR에서 누락된 **일봉(1D) OHLCV**를 가져온다
  3) 기존 canonical DB `OHLC_data/ohlc_1d_watchlist.sqlite`에 upsert 한다
  4) News Feed UI에 필요한 파생 % 변화 컬럼을 계산/저장한다
  5) **표준 change metric 백필**: OHLC 업데이트로 새 데이터가 들어온 심볼/날짜에 대해, `news_change_metrics`의 표준 metric row가 없는 news_id를 찾아 OHLC 기반으로 계산/upsert한다.

기간 규칙(최소/증분)
- DB 최신 날짜 `MAX(Datetime)`를 기준으로, 이후 구간만 가져온다.
- 새 데이터가 없으면 “no-op” 요약을 반환하고 오류로 취급하지 않는다.

파생 지표 저장 이유(정확성)
- News Feed의 `Chg`, `fr.Open`, `+7D/+14D/+30D`는 OHLC로부터 계산되어야 하며 mock이 금지된다.
- 이를 `(Symbol, Datetime)` 단위로 저장하면 프론트가 항상 동일 로직으로 렌더 가능하다.

API 계약(초안)
- `GET /api/ibkr/ohlc1d/status` → `{ dbPath, overallMaxDate, lastSuccessAt }`
- `POST /api/ibkr/ohlc1d/update` → `{ tickersRequested, tickersUpdated, rowsUpserted, overallMaxDateBefore, overallMaxDateAfter }`

백엔드 목표
- “IBKR Price Data”는 각 티커의 **1D OHLCV**를 받아 아래 DB에 이어서 저장하는 것을 의미한다.
  - `OHLC_data/ohlc_1d_watchlist.sqlite` 테이블 `ohlc_1d` (PK `(Symbol, Datetime)`)

추가 필수(News Feed에 표시되는 파생 컬럼)
- 동일한 “가격 업데이트” 과정에서, OHLC로부터 파생 지표(당일 change, open 대비 %, +7d 등)를 계산해 `ohlc_1d` 테이블의 **추가 컬럼**으로 저장해야 한다.
- 프론트에서 표시되는 컬럼이므로, UI-only 계산/가짜 데이터는 금지.

추가 컬럼 제안(Symbol+Datetime 단위로 저장)
- `Change_1d_Pct` : 전일 종가 대비 당일 종가 % 변화
- `Change_From_Open_Pct` : 시가 대비 종가 % 변화 = (Close / Open - 1) * 100
- `Change_7d_Pct` : 7거래일 전 종가 대비 % 변화
- `Change_14d_Pct` : 14거래일 전 종가 대비 % 변화
- `Change_30d_Pct` : 30거래일 전 종가 대비 % 변화
- `Derived_Updated_At` : 파생 컬럼 계산/갱신 시각(디버깅용, 권장)

백엔드 파일
- 서비스 `terminal/backend/src/services/ohlcWatchlistRepository.ts` 추가
  - `OHLC_data/ohlc_1d_watchlist.sqlite`를 열고 쿼리/업서트 수행(기본값은 이 파일로 고정)
  - `getOverallMaxDate()` → `MAX(Datetime)` 조회
  - `upsertBars(symbol, bars)` → `INSERT ... ON CONFLICT(Symbol, Datetime) DO UPDATE`(또는 ignore)
  - 마이그레이션 헬퍼 `ensureDerivedColumns()` 추가: 누락된 컬럼에 대해 `ALTER TABLE ohlc_1d ADD COLUMN ...` 실행
- 서비스 `terminal/backend/src/services/ibkrOhlc1dProvider.ts` 추가
  - IBKR에서 지정 기간의 일봉 OHLCV를 가져오는 로직
  - 최소 룰: 시작일은 `MAX(Datetime) + 1일`, 종료일은 “오늘(NY)”
- 파생 계산기 `terminal/backend/src/services/ohlcDerivedMetrics.ts` 추가
  - 특정 심볼/기간에 대해 필요한 과거 구간(최소 30거래일 이전까지)을 로드한 뒤 파생 컬럼을 계산/업데이트
  - 증분 정확성 룰: 새 바가 들어온 심볼에 대해서는 안전 구간을 재계산
    - `(min_new_date - 40거래일)` ~ `max_new_date` (7/14/30 lookback 커버 목적)
- `terminal/backend/src/server.ts`
  - `GET /api/ibkr/ohlc1d/status` 추가
    - `dbPath`, `overallMaxDate`, `lastSuccessAt(update_status)` 반환
  - `POST /api/ibkr/ohlc1d/update` 추가
    - Default Ticker CSV에서 티커 로드(tickerCsvService 재사용)
    - 누락된 일봉을 받아 `ohlc_1d`에 업서트
    - 영향받은 심볼/기간에 대해 파생 컬럼 계산 후 `ohlc_1d`에 업데이트
    - 성공 시 `update_status`의 `ibkr_ohlc_1d` 갱신(details에 `overallMaxDate` 등 포함)

검증
- status API가 DB 최신 날짜(`MAX(Datetime)`)를 정확히 반영한다.
- 업데이트 후(새 거래일이 존재하면) DB의 `MAX(Datetime)`가 증가한다.
- `ohlc_1d`에서 최근 날짜의 파생 컬럼이 실제 값으로 채워졌는지(전부 NULL이 아닌지) 샘플 확인

**세부 단계 (7단계)**
> ✅ **결정 완료**: 옵션 B (Python child_process) 확정.

결정 #6 메모(7단계에서 무엇이 달라지는가)
- **확정: 옵션 B (Python child_process)**
- `7-3`(IBKR provider)은 옵션 B로 구현한다. 나머지(SQLite upsert + 파생 지표 + API 엔드포인트)는 동일하다.
- 구현 방식:
  - `ibkrOhlc1dProvider.ts`가 로컬 Python 스크립트를 `child_process.spawn`으로 실행
  - Python 스크립트가 IBKR TWS/Gateway에 연결하여 1D bars를 가져오고, newline-delimited JSON을 stdout으로 출력
  - Node가 stdout을 파싱하여 bars 배열로 변환
  - 에러 시 Python이 non-zero exit code로 종료, stderr를 Node가 캡처하여 API 에러로 전달

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 7-1 | `ohlcWatchlistRepository.ts` 생성(DB 열기/쿼리 헬퍼) | `terminal/backend/src/services/ohlcWatchlistRepository.ts` | `getOverallMaxDate()`가 `2026-02-20`을 반환(현재 DB 상태) | ✅ |
| 7-2 | `ensureDerivedColumns()` 마이그레이션 추가 | same | `PRAGMA table_info(ohlc_1d)`에 파생 컬럼 존재 | ✅ |
| 7-3 | `ibkrOhlc1dProvider.ts` 구현(IBKR에서 1D 바 수집) | `terminal/backend/src/services/ibkrOhlc1dProvider.ts` | AAPL 기준 (maxDate+1)~오늘 구간 바 반환 | ✅ |
| 7-4 | `ohlcDerivedMetrics.ts` 구현(% 변화 계산) | `terminal/backend/src/services/ohlcDerivedMetrics.ts` | 단위 테스트로 Change_1d_Pct 등 기대값 확인 | ✅ |
| 7-5 | `GET /api/ibkr/ohlc1d/status` 연결 | `terminal/backend/src/server.ts` | `{ dbPath, overallMaxDate: "2026-02-20", lastSuccessAt }` 반환 | ✅ |
| 7-6 | `POST /api/ibkr/ohlc1d/update` 연결 | `terminal/backend/src/server.ts` | POST 후 `overallMaxDate`가 증가(새 거래일 존재 시) | ✅ |
| 7-7 | 파생 컬럼 샘플 점검 | (런타임) | `SELECT ... Change_1d_Pct ... WHERE Symbol='AAPL' ... LIMIT 5` → NULL 아님 | ✅ |
| 7-8 | OHLC 업데이트 후 표준 change metric 백필 | `newsChangeMerger.ts`, `server.ts` | `news_change_metrics`에 표준 metric row upsert 확인 | ✅ |
| 7-9 | Custom change 재계산 서비스/엔드포인트 | `newsChangeMerger.ts`, `server.ts` | custom `{N}d` metric row upsert 확인 | ✅ |

**세부 단계 목적/설명 (7단계)**
- `7-1` 목적: canonical OHLC SQLite DB 접근을 한 곳으로 모아 안전하게 캡슐화한다. 설명:
  - `OHLC_data/ohlc_1d_watchlist.sqlite`를 일관된 옵션으로 read/write 오픈한다(busy timeout 등).
  - 핵심 조회 헬퍼 제공: `getOverallMaxDate()`, (선택) `getSymbolMaxDate(symbol)`.
  - `upsertBars(symbol, bars)`를 결정적 매핑(Symbol, Datetime, Open, High, Low, Close, Volume)으로 구현한다.
  - SQLite 저수준 에러를 “조치 가능한 메시지”로 변환하고, 실패를 조용히 무시하지 않는다.
  - 완료 조건(눈으로 확인): dev probe/단위 테스트에서 DB를 열고 `getOverallMaxDate()`가 그럴듯한 날짜(또는 비어있으면 null)를 반환한다.
  - 사람 검증(비개발자): (7-5 연결 후) `GET /api/ibkr/ohlc1d/status`에서 `dbPath`가 `OHLC_data/ohlc_1d_watchlist.sqlite`를 가리키고 `overallMaxDate`가 이상하지 않은지 확인.
  - 흔한 문제/주의: 상대 경로 해석이 달라 다른 DB를 열어버림; busy timeout 미설정으로 “database is locked”.
- `7-2` 목적: DB를 새로 만들지 않고도 파생 지표 컬럼을 저장할 수 있게 한다. 설명:
  - `ensureDerivedColumns()`를 idempotent하게 구현한다:
    - `PRAGMA table_info(ohlc_1d)`로 현재 스키마를 확인
    - 누락 컬럼에 대해서만 `ALTER TABLE ... ADD COLUMN` 수행
  - 반복 실행에 안전하고, 기존 데이터가 있는 DB에도 안전해야 한다.
  - 완료 조건(눈으로 확인): 마이그레이션을 2번 실행해도 에러가 없고, 파생 컬럼이 정확히 1번씩만 존재한다.
  - 사람 검증(비개발자): SQLite 뷰어로 DB를 열어 `ohlc_1d` 테이블에 파생 컬럼이 있는지 확인.
  - 흔한 문제/주의: 마이그레이션 실행 시점을 놓쳐 컬럼이 영원히 NULL; 컬럼명 오타로 유사 컬럼이 여러 개 생김.
- `7-3` 목적: Decision #6(연동 방식)과 무관하게 동일한 “1D 바 수집” 추상화를 제공한다. 설명:
  - 입력: `{ symbol, startDate, endDate }` (날짜는 `YYYY-MM-DD`, 트레이딩 날짜 기준)
  - 출력: `Datetime=YYYY-MM-DD` + numeric OHLCV가 포함된 정렬된 bars
  - 신뢰성 규칙:
    - 끊김/페이싱 같은 일시 실패는 제한된 재시도+백오프로 처리
    - host/port/권한 같은 영구 실패는 빠르게 실패시키고 원인을 명확히
    - 시크릿 로그 금지(심볼/기간/카운트만 로그)
  - 완료 조건(눈으로 확인): 알려진 심볼(AAPL)로 최근 구간을 요청했을 때 bar 리스트가 비어있지 않다.
  - 사람 검증(비개발자): 단일 심볼 CSV로 `POST /api/ibkr/ohlc1d/update`를 실행해 요약에서 `rowsUpserted > 0`(거래일 기준)인지 확인.
  - 흔한 문제/주의: IBKR 페이싱/타임아웃; bars가 역순으로 와서 저장/계산이 깨짐; 날짜 경계/타임존 혼동.
- `7-4` 목적: News Feed의 “Changes %”를 실제 OHLC 기반으로 계산/저장한다(mock/UI-only 금지). 설명:
  - 심볼별로 lookback 계산에 필요한 과거 구간(최소 30거래일 이전)을 로드한다.
  - 계산 컬럼: `Change_1d_Pct`, `Change_From_Open_Pct`, `Change_7d_Pct`, `Change_14d_Pct`, `Change_30d_Pct`.
  - 히스토리 부족 규칙: lookback bar가 없으면 `NULL`로 저장(가짜 금지).
  - 안전 구간을 제한해 재계산한다(예: `min_new_date - 40 bars` → `max_new_date`).
  - 완료 조건(눈으로 확인): 1회 이상 성공 업데이트 후 최근 row에서 파생 컬럼이(히스토리가 있으면) NULL이 아닌 값으로 채워진다.
  - 사람 검증(비개발자): AAPL 샘플 SQL을 실행해 최근 row에서 파생 컬럼 중 최소 1개가 NULL이 아닌지 확인.
  - 흔한 문제/주의: 7/14/30을 “달력일”로 계산; 전일 종가/히스토리 누락 처리에서 0 나누기.
- `7-5` 목적: UI/운영이 DB 최신 상태를 확인할 수 있는 read-only status API를 제공한다. 설명:
  - `GET /api/ibkr/ohlc1d/status`는 아래를 반환:
    - `dbPath`(string), `overallMaxDate`(string 또는 null), `lastSuccessAt`(ISO 또는 null)
  - `overallMaxDate`는 DB `MAX(Datetime)` 기반, `lastSuccessAt`는 `update_status(ibkr_ohlc_1d)` 기반.
  - 완료 조건(눈으로 확인): 어떤 값이 null이어도 JSON에 필드가 항상 존재한다.
  - 사람 검증(비개발자): `curl http://localhost:8080/api/ibkr/ohlc1d/status`가 빠르게 응답하고 값이 일관되는지 확인.
  - 흔한 문제/주의: 날짜 포맷이 일관되지 않아 UI 표시가 어려움; update_status 키를 잘못 읽음.
- `7-6` 목적: pull → upsert → derive → status update를 한 번에 수행하는 오케스트레이터 엔드포인트를 구현한다. 설명:
  - `POST /api/ibkr/ohlc1d/update` 구현:
    - Default Ticker CSV에서 티커를 읽고 정규화+중복 제거
    - DB max date를 기준으로 심볼별 수집 기간을 결정
    - `ibkrOhlc1dProvider`로 bars fetch → upsert → 영향 구간 파생 지표 재계산
    - **표준 change metric 백필**: 새 OHLC가 들어온 심볼/날짜에 대해 `newsChangeMerger`를 호출하여 `news_change_metrics`의 표준 metric row를 채움
    - 전체 성공 시 `update_status(ibkr_ohlc_1d)`를 최소 details로 갱신
  - 부분 실패 정책을 명시해야 한다(코드에 문서화):
    - (a) 전체 실패로 처리, 또는 (b) 가능한 심볼은 계속 진행하고 per-symbol 실패를 리포트
  - 완료 조건(눈으로 확인): POST 1회로(새 거래일이 있으면) `overallMaxDate`가 증가하고 `update_status(ibkr_ohlc_1d).lastSuccessAt`가 성공 시에만 갱신된다.
  - 사람 검증(비개발자): POST 실행 후 `GET /api/updates/status`에서 `ibkr_ohlc_1d.lastSuccessAt`가 성공 시에만 바뀌는지 확인.
  - 흔한 문제/주의: 일부 심볼 실패인데도 성공으로 찍힘(보고 없음); 파생 재계산 구간이 너무 짧아 lookback 컬럼이 계속 NULL.
- `7-7` 목적: 파이프라인이 “실제 파생 값”을 만들었음을 사람이 확인할 수 있는 구체 체크를 제공한다. 설명:
  - 최소 1회 성공 업데이트 후, 알려진 심볼(AAPL)로 작은 SQL을 실행해 아래를 확인:
    - 최근 날짜 row 존재
    - 파생 컬럼이 최근 row에서 전부 `NULL`이 아님
  - 유닛 테스트의 대체가 아니라 운영 sanity-check다.
  - 완료 조건(눈으로 확인): SQL 결과에 행이 나오고 파생 컬럼 중 최소 1개가 숫자 값으로 채워져 있다.
  - 사람 검증(비개발자): SQLite 뷰어에 SQL을 붙여 넣고 값이 과도하게 크거나 NaN/inf처럼 보이지 않는지 확인.
  - 흔한 문제/주의: 다른 DB 파일을 열어 확인; `Datetime` 포맷이 어긋나 MAX(Datetime)가 잘못 계산.
- `7-8` 목적: OHLC 업데이트 후 표준 change metric row를 백필한다. 설명:
  - OHLC upsert + 파생 지표 계산이 완료된 후, `newsChangeMerger`를 호출한다.
  - 대상: `news_items` 중 이번에 업데이트된 심볼을 포함하고, 표준 metric_key row가 누락이거나 `NULL`인 news_id.
  - **forward-looking**: 각 row의 `published_at` 날짜를 anchor로, N거래일 **후** OHLC를 `ohlc_1d_watchlist.sqlite`에서 조회해 metric row upsert.
  - 새로 들어온 OHLC 날짜가 과거 뉴스의 forward target 날짜에 해당하면 기존 `NULL`→값으로 업데이트.
  - 뉴스일이 휴장일이면: 가장 가까운 이전 거래일 OHLC를 anchor로 사용.
  - `POST /api/ibkr/ohlc1d/update`의 반환 요약에 `newsChangeRowsUpserted: <n>`을 추가한다.
  - 완료 조건(눈으로 확인): OHLC 업데이트 전에 없던 표준 metric row가, 업데이트 후 생성된다.
  - 사람 검증(비개발자): OHLC 업데이트 전후로 `SELECT news_id, metric_key, value_pct FROM news_change_metrics WHERE metric_key='change_7d_pct' LIMIT 5`를 비교.
  - 흔한 문제/주의: newsChangeMerger가 잘못된 DB를 열어 매칭 실패; 심볼 매칭에서 대소문자/접미사 불일치; 대량 upsert 시 트랜잭션 없이 느려짐.

- `7-9` 목적: 운영 UI의 `Custom Change Update` 버튼이 호출할 재계산 엔드포인트를 제공한다. 설명:
  - 입력: `forwardTradingDays`(=뉴스 이후 N거래일), 선택적 `tickers[]`, 선택적 `from/to`.
  - 대상 news_id를 필터링한 뒤 `metric_key = custom_{N}d_pct` row를 upsert한다.
  - 동일한 custom window가 다시 실행되면 기존 row를 overwrite한다.
  - 완료 조건(눈으로 확인): 같은 news_id에 대해 `custom_21d_pct` 같은 row가 생긴다.
  - 사람 검증(비개발자): `Custom Change Update`에 21 입력 후, SQL 조회에서 `custom_21d_pct` row가 생기는지 확인.
  - 흔한 문제/주의: custom window 파라미터 검증 누락; metric_key 포맷 불일치; 너무 넓은 범위로 실행되어 장시간 소요.

`7-3` 구현 상세(옵션 B — Python child_process 확정)
- Python 스크립트가 newline-delimited JSON bars를 출력하고, 오류 시 non-zero exit code로 종료.
- Node는 스크립트를 args(`symbol`, `start`, `end`)로 실행하고 stdout 파싱을 견고하게 처리(size limit, JSON parse error).
- stderr를 캡처하여 API 에러 메시지로 명확히 노출.
- Python 스크립트 위치: `terminal/backend/scripts/ibkr_fetch_ohlc.py` (제안)
- 인터페이스 규약:
  - 입력: `python ibkr_fetch_ohlc.py --symbol AAPL --start 2026-02-21 --end 2026-03-05`
  - 정상 출력(stdout): `{"Datetime":"2026-02-21","Open":...,"High":...,"Low":...,"Close":...,"Volume":...}\n` (1줄 = 1 bar)
  - 에러 출력(stderr): 사람이 읽을 수 있는 메시지 (시크릿 미포함)
  - 종료 코드: 0=성공, 1=일시 오류(재시도 가능), 2=영구 오류(재시도 불필요)

**검증 훅 (7단계 마감):**
```
1. npx tsc --noEmit → 0 errors
2. npm run test → ohlcWatchlistRepository/파생 계산 테스트 통과
3. GET /api/ibkr/ohlc1d/status → DB max date 확인
4. POST /api/ibkr/ohlc1d/update → 업서트 및 max date 증가 확인
5. AAPL 최근 5행 SELECT → 파생 컬럼이 실제 값인지 확인
6. `news_change_metrics`에서 표준 metric row 백필 확인
7. `news_change_metrics`에서 `custom_{N}d_pct` row 생성 확인
```
- 사용자 확인 필요: **Yes**

#### ✅ 8단계 — Data Control Window(프론트)
목적
- 백엔드 업데이트를 수동으로 실행하고, 최신 상태를 확인할 수 있는 최소 운영 창을 제공한다.
- 1단계의 update status를 읽어 각 항목의 “마지막 성공 시각”을 보여준다.
- **각 섹션에 View Log 버튼을 배치**하여 장시간 업데이트의 진행률/로그를 확인할 수 있게 한다(시작 시 자동 오픈 금지).

UI 동작(최소)
- 섹션별 구성:
  - `IBKR Price Data` → Update 버튼 + **View Log** 버튼 + last success + DB 최신 날짜
  - `IBKR Calendar Data` → Update 버튼 + **View Log** 버튼 + last success
  - `7D Change Update` → Update 버튼 + **View Log** 버튼 + last success
  - `Custom Change Update` → Update 버튼 + **View Log** 버튼 + last success + lookback 입력(`N` 거래일)
- Update 클릭 시 **백그라운드 잡**으로 시작(`{ jobId }` 즉시 반환).
- **View Log 버튼은 시작 시 자동 오픈 금지** — 사용자가 눌러야만 로그 패널이 열린다.
- 상태 표시(읽기 전용):
  - 각 소스의 last success timestamp
  - OHLC DB 최신 날짜(`GET /api/ibkr/ohlc1d/status`)

로딩/에러
- 실행 중에는 해당 Update 버튼 비활성화 + “Running…” 텍스트 표시.
- 실패 시 창 내부에 짧은 에러 메시지를 표시(추가 모달 금지).
프론트 파일:
- `src/app/types.ts`에 `data-control` 윈도우 타입 추가
- `src/app/components/DataControlWindow.tsx` 신규
  - 섹션 4개
    - IBKR Price Data(OHLC 1D): Update 버튼 + **View Log** 버튼 + last updated + DB 최신 날짜
    - IBKR Calendar Data: Update 버튼 + **View Log** 버튼 + last updated
    - 7D Change Update: Update 버튼 + **View Log** 버튼 + last updated
    - Custom Change Update: 숫자 입력(`N`) + Update 버튼 + **View Log** 버튼 + last updated
  - 초기 로드: `GET /api/updates/status`
  - Update 클릭:
    - 가격: `POST /api/ibkr/ohlc1d/update` → `{ jobId }` 반환
    - 캘린더: `POST /api/ibkr/calendar/update` → `{ jobId }` 반환
    - 7D change: `POST /api/news/change/update-7d` → `{ jobId }` 반환
    - custom change: `POST /api/news/change/update-custom` with `{ lookbackTradingDays: N }` → `{ jobId }` 반환
    - 이후 `GET /api/updates/status` + `GET /api/ibkr/ohlc1d/status` 재조회
  - View Log 클릭: `GET /api/jobs/:jobId`로 폴링 → 로그 패널에 진행률 + 로그 표시 (자동 오픈 금지)
- 등록:
  - `AddTabModal.tsx` 체크박스 추가
  - `App.tsx` title 매핑
  - `DraggableWindow.tsx` switch 추가

검증
- 버튼 호출과 timestamp 표시가 정상

**세부 단계 (8단계)**
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 8-1 | 윈도우 타입 `data-control` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts` | AddTab에서 선택 가능 | ✅ |
| 8-2 | `DataControlWindow.tsx` 구현(UI + API 호출) | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx` | 로드시 4개 섹션 + `GET /api/updates/status` 호출/렌더 | ✅ |
| 8-3 | 윈도우 시스템 연결 | `AddTabModal.tsx`, `App.tsx`, `DraggableWindow.tsx` | 창이 정상 렌더 | ✅ |
| 8-4 | 실행 중/에러 상태 표시 | same | 버튼 비활성화 + “Running…” + 에러 인라인 표시 | ✅ |
| 8-5 | 업데이트 후 status/DB date 재조회 | same | POST 성공 후 timestamp와 overallMaxDate 갱신 | ✅ |
| 8-6 | 4개 업데이트 잡 엔드포인트 연동 | same | 각 버튼 클릭 시 `{ jobId }` 즉시 반환 | ✅ |
| 8-7 | View Log 버튼 + 로그 패널 연동 | same | 각 섹션에서 View Log 클릭 시 진행률/로그 표시 | ✅ |

**세부 단계 목적/설명 (8단계)**
- `8-1` 목적: 윈도우 타입을 UI에서 선택 가능하게 추가. 설명:
  - 프론트 window type 유니온에 `data-control`을 추가한다.
  - AddTab의 타입 문자열과 DraggableWindow의 렌더 케이스 문자열이 완전히 일치해야 한다.
  - 네이밍이 안정적이어야 이후 통합 포인트로 안전하게 쓸 수 있다.
  - 완료 조건(눈으로 확인): Add Tab에 “Data Control”이 생기고 선택 시 창이 에러 없이 열린다.
  - 사람 검증(비개발자): Add Tab에서 토글을 여러 번 해도 창이 중복으로 여러 개 생기지 않는지 확인.
  - 흔한 문제/주의: AddTab/DraggableWindow의 타입 문자열 불일치로 빈 창이 뜸.
- `8-2` 목적: 운영용 컨트롤 UI 제공. 설명:
  - `DataControlWindow.tsx`에 Price/Calendar/7D Change/Custom Change 4개 섹션과 최소 컨트롤을 구현한다.
  - mount 시 `GET /api/updates/status`를 호출해 `lastSuccessAt`를 렌더한다(null이면 `-`).
  - OHLC 최신 날짜 표시를 위해 `GET /api/ibkr/ohlc1d/status`도 로드한다.
  - 완료 조건(눈으로 확인): 창을 열면 섹션 4개가 보이고, 타임스탬프/날짜가 `-` 또는 값으로 표시된다(비어있는 placeholder 금지).
  - 사람 검증(비개발자): 백엔드 실행 상태에서 새로고침 후, 버튼을 누르지 않아도 상태 값이 표시되는지 확인.
  - 흔한 문제/주의: 백엔드 base URL/포트가 달라 404; `lastSuccessAt`가 null일 때 렌더 크래시.
- `8-3` 목적: 앱에서 접근/렌더가 되도록 연결. 설명:
  - `AddTabModal.tsx` 체크박스, `App.tsx` 타이틀 매핑, `DraggableWindow.tsx` 렌더 스위치를 연결한다.
  - 사용자가 버튼을 누르기 전에는 IBKR 호출이 발생하지 않도록 한다(열기만으로 POST 금지).
  - 기존 윈도우 패턴을 유지하며 변경을 최소화한다.
  - 완료 조건(눈으로 확인): 창을 여는 것만으로는 어떤 POST도 발생하지 않고, mount 시에는 GET status만 호출된다.
  - 사람 검증(비개발자): DevTools → Network에서 `POST /api/ibkr/*`가 클릭 전에는 0건인지 확인.
  - 흔한 문제/주의: mount 시 update 엔드포인트를 자동 호출; 타이틀 매핑 누락으로 창 제목이 틀림.
- `8-4` 목적: 중복 실행 방지 및 실패 가시화. 설명:
  - POST 실행 중에는 해당 버튼만 disable하고 버튼 근처에 “Running…”을 표시한다.
  - 실패 시 창 내부에 짧은 에러 메시지를 인라인으로 표시하고, 모달을 추가하지 않는다.
  - 성공/실패 후 상태가 정상적으로 복구돼 재시도 가능해야 한다.
  - 완료 조건(눈으로 확인): 클릭하면 버튼이 비활성화되고 “Running…”이 뜨며, 종료 후 다시 활성화된다.
  - 사람 검증(비개발자): 백엔드를 꺼둔 상태에서 버튼을 눌러 “읽기 쉬운 에러”가 창 안에 표시되는지 확인.
  - 흔한 문제/주의: 버튼이 영원히 비활성화; 에러가 콘솔에만 찍히고 UI에는 안 보임.
- `8-5` 목적: 표시되는 상태를 최신으로 유지. 설명:
  - POST 성공 후 `GET /api/updates/status`를 재조회한다.
  - 가격 업데이트 성공 후에는 `GET /api/ibkr/ohlc1d/status`도 재조회해 DB 최신 날짜를 갱신한다.
  - refresh 순서를 고정(POST → GET 재조회)해 stale UI를 피한다.
  - 완료 조건(눈으로 확인): 업데이트 성공 후 페이지 새로고침 없이도 화면의 timestamp/DB date가 즉시 바뀐다.
  - 사람 검증(비개발자): “IBKR Price Data” 1회 실행 후, 완료되면 “DB 최신 날짜” 표시가 바뀌는지 확인.
  - 흔한 문제/주의: 한쪽만 refresh해서 timestamp는 바뀌는데 DB date는 안 바뀌는 등 불일치.

- `8-6` 목적: Data Control Window의 4개 업데이트 요청을 동기 응답 대신 백그라운드 잡으로 전환하여 장시간 작업에도 UI가 멘추지 않게 한다. 설명:
  - `POST /api/ibkr/ohlc1d/update`, `POST /api/ibkr/calendar/update`, `POST /api/news/change/update-7d`, `POST /api/news/change/update-custom` 응답을 즉시 `{ jobId }` 반환으로 통일한다.
  - 5단계의 `jobManager.ts` 모듈을 공유해 잡 상태를 관리한다.
  - `GET /api/jobs/:jobId` 폴링으로 `{ status, progress, logs[] }` 응답.
  - 완료 조건(눈으로 확인): POST 응답이 1초 이내로 `{ jobId }` 반환. GET 폴링 시 progress가 증가.
  - 사람 검증(비개발자): Update 클릭 후 창이 멘추지 않고 다른 조작 가능한지 확인.
  - 흔한 문제/주의: 잡 상태가 누락되어 영원히 running 상태로 남음; IBKR 연결 끊김 시 잡 실패 처리.

- `8-7` 목적: 사용자가 4개 업데이트 작업의 진행 상황을 원할 때만 확인할 수 있는 View Log 버튼과 로그 패널을 제공한다. 설명:
  - 각 섹션(Price Data / Calendar Data / 7D Change / Custom Change) 우측에 **View Log** 버튼을 배치한다.
  - **시작 시 로그 패널이 자동으로 열리지 않는다.** 사용자가 View Log를 눌러야만 열린다.
  - 로그 패널: 진행률 바(ticker 기준) + 실시간 로그 라인 + 에러 표시.
  - 닫기: X 버튼 또는 외부 클릭/ESC.
  - 완료 조건(눈으로 확인): Update 클릭 후 View Log 버튼 활성화. 클릭 시 로그 패널 열림. Update만 클릭하면 패널 안 열림.
  - 사람 검증(비개발자): Update → View Log → 진행률 업데이트 확인. Update만 클릭하고 View Log 안 누르면 패널이 안 뜨는지 확인.
  - 흔한 문제/주의: 폴링 중단 실패로 로그 멈쵤; z-index 부족; 잡 없을 때 View Log 버튼 disabled 처리.

**검증 훅 (8단계 마감):**
```
1. Data Control Window 열기
2. IBKR Price Data Update 클릭 → 응답이 `{ jobId }` 로 즉시 반환, UI 멈추지 않는지 확인
3. 성공 후 ibkr_ohlc_1d lastSuccessAt 갱신 확인
4. GET /api/ibkr/ohlc1d/status로 최신 DB date 갱신 확인
5. IBKR Calendar Data Update 클릭 → `{ jobId }` 반환; 완료 후 lastSuccessAt 갱신 확인
6. 7D Change Update 클릭 → `{ jobId }` 반환; 완료 후 해당 lastSuccessAt 갱신 확인
7. Custom Change Update에 `21` 입력 후 실행 → `{ jobId }` 반환; 완료 후 해당 lastSuccessAt 갱신 확인
8. View Log 버튼 클릭 → 로그 패널에 진행률 바 + 로그 표시 확인
9. Update만 클릭하고 View Log 안 누르면 패널 안 열리는지 확인 (자동 오픈 금지)
```
- 사용자 확인 필요: **Yes**

#### ✅ 9단계 — 테스트/검증(최소지만 실제)
목적
- 기반 API들이 정확히 동작하고(특히 보안 제약/영구 저장), mock 데이터가 다시 들어오지 않도록 최소한의 테스트로 안전망을 만든다.

백엔드 테스트 포커스
- `update_status` 영구성: set → (재시작에 준하는) 재조회 → 동일 값 반환
- CSV 경로 allowlist: `tradigview_screener/original_data/` 밖 경로 거절
- CSV append: 파일 끝에 추가, 중복 reject(기본)
- Finnhub 매핑: 필수 필드 존재 + API 키 누출 없음
- 캘린더 정리: IBKR 업데이트 성공 후 `mock_provider` rows 삭제

백엔드 테스트(`terminal/backend/tests/`):
- tickerCsvService read/append/path restriction
- updateStatusRepository set/get
- finnhub provider mapping(응답 shape 검증)
- 캘린더 mock cleanup(기존 mock_provider row 삭제)

프론트 스모크:
- 윈도우 렌더 및 API 호출(프론트 자동 테스트가 없으면 수동 QA)

검증
- 백엔드 `npm run test`가 통과한다.

**세부 단계 (9단계)**
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 9-1 | status 영구성 관련 테스트 추가/수정 | `terminal/backend/tests/*` | 재조회 시 동일 값 반환 | ✅ |
| 9-2 | CSV allowlist + append 테스트 추가/수정 | `terminal/backend/tests/*` | 비허용 경로 거절, 마지막 행 append 확인 | ✅ |
| 9-3 | Finnhub 매핑 테스트 추가/수정 | `terminal/backend/tests/*` | 응답 shape 검증 + 시크릿 누출 없음 | ✅ |
| 9-4 | 캘린더 mock 정리 테스트 추가/수정 | `terminal/backend/tests/*` | `mock_provider` rows 삭제 확인 | ✅ |
| 9-5 | 프론트 수동 스모크(윈도우 렌더 + API 호출) | (수동) | Data Control/Default Ticker/News 창이 정상 동작 | ⏳ |

**세부 단계 목적/설명 (9단계)**
- `9-1` 목적: update_status 영속성 회귀 방지. 설명:
  - repository 레벨 테스트로 status row를 쓰고 같은 DB 핸들에서 다시 읽어오는 것을 보장한다.
  - “새 repository 인스턴스 생성”을 통해 재시작에 준하는 동작에서도 값이 유지되는지 확인한다.
  - API 응답은 null이어도 모든 키가 존재해야 한다(키 누락 방지).
  - 완료 조건(눈으로 확인): `npm run test`에 “재시작에 준하는 재조회” 시나리오를 포함한 테스트가 들어있다.
  - 사람 검증(비개발자): 테스트를 실행했을 때 실패 메시지가 status 영속성과 직접 연결되어 이해 가능해야 한다.
  - 흔한 문제/주의: 로컬 DB 상태에 의존해 flaky; timestamp 비교 시 허용 오차 없이 비교해 실패.
- `9-2` 목적: CSV 보안/동작 회귀 방지. 설명:
  - allowlist 강제: `tradigview_screener/original_data/` 밖 경로 및 traversal 시도를 거절하는 테스트.
  - append 의미: 마지막 행에 새 row로 추가되고, 이후 read에서 반환되는 테스트.
  - 중복 정책: 같은 티커 2회 추가 시 2번째는 실패하는 테스트(기본).
  - 완료 조건(눈으로 확인): “허용 경로 통과/비허용 경로 거절/중복 거절”이 모두 테스트로 커버된다.
  - 사람 검증(비개발자): 실패 시 메시지에 ‘왜 거절인지(allowlist 위반)’가 포함되는지 확인.
  - 흔한 문제/주의: OS별 경로 구분자 차이로 Windows/WSL에서 결과가 달라짐.
- `9-3` 목적: Finnhub mapping의 형상 검증 + 시크릿 누출 방지. 설명:
  - 매핑 결과가 필수 필드(title/time/url/source 등)를 포함하고 `source='FINNHUB'`로 저장되는지 검증한다.
  - 테스트에서 API 키/토큰이 출력되지 않도록 하고, 필요 시 HTTP는 스텁/목으로 대체한다.
  - `update_status(finhub_news)`가 성공 시에만 갱신되는지도 확인한다.
  - 완료 조건(눈으로 확인): 테스트가 실 Finnhub API 키 없이도 동작하며, 필수 필드 존재를 assert 한다.
  - 사람 검증(비개발자): 테스트 출력/로그에 키/토큰이 없는지 눈으로 확인.
  - 흔한 문제/주의: 테스트가 실 네트워크를 때려 flaky; snapshot/log에 원문 payload를 저장.
- `9-4` 목적: 캘린더 mock 데이터 잔존 방지. 설명:
  - `mock_provider` row를 소수 삽입한 뒤 “성공 업데이트” 시나리오에서 삭제가 수행되는지 테스트한다.
  - 삭제는 idempotent해야 한다(2번 실행해도 결과는 0 유지).
  - 실패 시에는 무분별 삭제가 일어나지 않게 “성공 후에만 cleanup” 조건을 검증한다.
  - 완료 조건(눈으로 확인): mock row가 “성공 시에만” 삭제되는 것을 증명하는 테스트가 존재한다.
  - 사람 검증(비개발자): 실패 시나리오에서 cleanup이 실행되면 테스트가 실패하도록 되어 있는지 확인.
  - 흔한 문제/주의: 테스트 DB가 분리되지 않아 개발자 DB를 오염/삭제.
- `9-5` 목적: UI 통합 동작 확인. 설명:
  - 수동 스모크 체크리스트(3개 창):
    - Default Ticker: load + add 동작
    - news feed:finhub api: 백엔드 기반 렌더 + mock 없음
    - Data Control: 버튼 호출 + 상태 refresh
  - 픽셀/스타일보다 “정확성 + 추가 UX 금지” 조건을 중심으로 확인한다.
  - 완료 조건(눈으로 확인): 체크리스트를 1회 끝까지 수행할 수 있고, 실패는 스크린샷/메모로 남길 수 있다.
  - 사람 검증(비개발자): Network 탭에서 예상된 GET/POST 호출이 실제로 발생했는지 확인.
  - 흔한 문제/주의: 백엔드 미실행으로 인한 가짜 실패; 캐시된 UI 상태가 실패를 가림.

**검증 훅 (9단계 마감):**
```
1. terminal/backend: npm run test → 통과
2. 백엔드 dev 서버로 주요 엔드포인트 수동 호출
3. 웹 UI 열어 신규/변경 윈도우가 API 호출하는지 확인
```
- 사용자 확인 필요: **Yes**

#### ⏳ 10단계 — Full Text Extraction(뉴스 원문 추출: 백엔드 + 프론트)
목적
- 저장된 뉴스의 **원본 기사 전문(full text)**을 도메인별 추출기로 크롤링/API 호출하여 별도 테이블에 저장한다.
- 뉴스 피드 업데이트(Finnhub pull)와 **완전 분리된 별도 프로세스**로, 이미 적재된 뉴스에 대해 사후적으로 full text를 추출한다.
- `source`(데이터 공급자 = FINNHUB)와 별도로 `publisher`(원본 사이트 = NASDAQ/TMX/FINNHUB) 필드를 추가하여, 뉴스 원본의 출처를 명확히 구분한다.

핵심 전제(확인됨)
- 현재 Finnhub 뉴스 707건의 도메인 분포:
  - `www.nasdaq.com` (549건, press_release) — HTML scraping으로 추출 가능
  - `money.tmx.com` (51건, press_release) — TMX GraphQL API로 추출 가능 (검증 완료)
  - `finnhub.io` (107건, company_news) — 외부 기사 페이지 아님, 기존 body 사용 (skip)
- TMX GraphQL API: `https://app-money.tmx.com/graphql`, `getNewsStoryById($newsid)` → `story` 필드가 full text HTML

저장 전략
- 별도 테이블 `news_fulltext` (news_items와 1:1 관계)
- `news_fulltext`에 keyword 저장 컬럼을 함께 둔다(예: `keywords_json`, `keywords_status`, `keywords_updated_at`).
- 키워드 값은 full text 추출 단계에서 즉시 생성하지 않고, **후속 AI keyword 분석 작업**이 `full_text`를 읽은 뒤 나중에 채운다.
- `news_items`에 `publisher TEXT` 컬럼 migration 추가
- full text가 없는 뉴스 = `news_fulltext`에 해당 news_id가 없는 경우

추출 대상 결정 로직
- `news_items`에서 `news_fulltext`에 해당 row가 없는 모든 news_id를 대상으로 한다.
- press_release / company_news / market_news **모두** 대상이지만, 실제 추출 동작은 `publisher`(= URL 도메인)에 따라 다름:
  - `NASDAQ` → HTML fetch + article body parsing
  - `TMX` → URL에서 newsid 추출 → GraphQL API 호출
  - `FINNHUB` (finnhub.io) → skip (extraction_status = 'skipped')
  - 미지 도메인 → `extraction_status = 'unavailable'`

API 계약(초안)
- `POST /api/news/fulltext/update` → `{ jobId }` (백그라운드 잡 시작)
  - 잡 내부: 미추출 news_id 순회 → 도메인별 추출 → `news_fulltext` INSERT
- `GET /api/news/fulltext/:newsId` → `{ newsId, fullText, extractionStatus, extractionNote, wordCount, extractedAt }`
- `GET /api/news` 응답에 `hasFullText: boolean`, `keywords: string[]`, `keywordsStatus` 필드 추가 (JOIN으로 계산)

백엔드 파일:
- `terminal/backend/src/db.ts`
  - `news_fulltext` 테이블 CREATE (initDb 내)
    - `keywords_json TEXT NOT NULL DEFAULT '[]'`
    - `keywords_status TEXT NOT NULL DEFAULT 'pending'`
    - `keywords_updated_at TEXT`
  - `news_items`에 `publisher TEXT` 컬럼 ensureColumn 추가
- `terminal/backend/src/services/fulltextRepository.ts` 신규
  - `getFulltext(newsId)` → full text row 조회
  - `insertFulltext(newsId, data)` → extraction 결과 저장
  - `getUnextractedNewsIds()` → news_fulltext에 없는 news_id 목록
  - `getFulltextStatus(newsIds)` → 다건 hasFullText 조회 (news 목록 표시용)
  - `updateKeywords(newsId, keywords)` → 후속 AI keyword 분석 결과 저장
- `terminal/backend/src/services/fulltextExtractors.ts` 신규
  - `extractNasdaq(url)` → HTTP GET + HTML parsing → article body text
  - `extractTmx(url)` → newsid 파싱 → GraphQL 호출 → story HTML
  - `extractByDomain(url, publisher)` → publisher에 따라 위 함수를 dispatch
  - 공통: HTTP 요청 재시도(최대 10회, 백오프), 도메인별 rate limit(300~500ms 간격)
- `terminal/backend/src/services/fulltextUpdateService.ts` 신규
  - `runFulltextUpdate(jobId)` → 미추출 news_id 순회 → extractByDomain → insertFulltext
  - 진행률 로그: `jobManager.addLog(jobId, ...)`
  - 개별 실패 시 `extraction_status = 'failed'`로 기록하고 계속 진행(전체 중단 금지)
- `terminal/backend/src/server.ts`
  - `POST /api/news/fulltext/update` → jobManager로 백그라운드 잡 시작
  - `GET /api/news/fulltext/:newsId` → fulltextRepository.getFulltext()
  - `GET /api/news` 응답에 `hasFullText` 필드 추가
- `terminal/backend/src/services/newsRepository.ts`
  - `getNews()` 쿼리에 `news_fulltext` LEFT JOIN → `hasFullText` 계산
  - `GET /api/news` 응답 각 row에 `hasFullText: boolean`, `keywords`, `keywordsStatus` 포함
- `terminal/backend/src/services/finnhubNewsProvider.ts`
  - 뉴스 insert 시 URL 도메인을 파싱하여 `publisher` 컬럼에 자동 세팅
  - 기존 news_items 중 `publisher IS NULL`인 row에 대한 일괄 backfill 함수 추가

프론트 파일:
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - 테이블에 **"Full Text" 컬럼** 추가
    - `hasFullText === true` → **O** (초록색, 클릭 가능)
    - `hasFullText === false` → **X** (회색)
  - 테이블에 **"Keywords" 컬럼** 추가
    - `keywordsStatus === 'ready'` 이고 `keywords.length > 0` → 키워드 badge/list 표시
    - `keywordsStatus === 'pending'` 또는 빈 배열 → `-`
  - **O 클릭 시**: `GET /api/news/fulltext/:newsId` 호출 → 모달/팝업으로 full text 표시
    - HTML full text인 경우: `dangerouslySetInnerHTML` 또는 iframe sandbox로 안전 렌더
    - 팝업 닫기: X 버튼 / 외부 클릭 / ESC
  - **"Full Text Update" 버튼** (툴바에 배치)
    - 클릭 시 `POST /api/news/fulltext/update` → `{ jobId }` 반환
    - View Log 연동: 진행률 바(처리된 news_id / 전체 미추출 개수)
    - 완료 후 뉴스 목록 재조회(hasFullText 반영)
  - 컬럼 가시성 토글(5-13)에 "Full Text" 컬럼 포함

검증
- 10단계 전체 완료 후:
  - Nasdaq 뉴스의 full text가 `news_fulltext`에 저장됨
  - TMX 뉴스의 full text가 GraphQL API를 통해 저장됨
  - finnhub.io 뉴스는 `skipped`로 처리됨
  - market news 외부 도메인 중 extractor 미지원 사이트는 `unavailable` 또는 `failed`로 기록되며, 지원 도메인만 저장됨
  - 키워드 컬럼은 후속 AI keyword 분석 완료 전까지 `-` 또는 pending으로 보임
  - UI에서 O/X 컬럼이 정확히 표시되고, O 클릭 시 본문이 팝업으로 나옴

**세부 단계 (10단계)**

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 10-1 | `news_fulltext` 테이블 CREATE + keyword 컬럼 + `news_items.publisher` 컬럼 migration | `terminal/backend/src/db.ts` | 백엔드 시작 후 테이블/컬럼 존재 확인 | ✅ |
| 10-2 | `fulltextRepository.ts` 구현 (CRUD + 미추출 목록 조회) | `terminal/backend/src/services/fulltextRepository.ts` | `npx tsc --noEmit` → 0 errors | ✅ |
| 10-3 | 기존 news_items `publisher` 컬럼 backfill (URL 도메인 파싱) | `terminal/backend/src/services/finnhubNewsProvider.ts` | 기존 Finnhub row에 대해 publisher가 NASDAQ/TMX/FINNHUB/UNKNOWN 중 하나로 세팅 | ✅ |
| 10-4 | `extractNasdaq(url)` — Nasdaq HTML scraping 추출기 | `terminal/backend/src/services/fulltextExtractors.ts` | 샘플 Nasdaq URL로 article body 추출 성공 | ✅ |
| 10-5 | `extractTmx(url)` — TMX GraphQL API 추출기 | `terminal/backend/src/services/fulltextExtractors.ts` | 샘플 TMX URL로 story HTML 추출 성공 | ✅ |
| 10-6 | `extractByDomain(url, publisher)` — 도메인 dispatcher | `terminal/backend/src/services/fulltextExtractors.ts` | 각 도메인에 대해 올바른 추출기로 dispatch | ✅ |
| 10-7 | `fulltextUpdateService.ts` — 백그라운드 잡 오케스트레이터 | `terminal/backend/src/services/fulltextUpdateService.ts` | 미추출 news_id 순회 + 도메인별 추출 + 진행률 로그 | ✅ |
| 10-8 | `POST /api/news/fulltext/update` 엔드포인트 (잡 시작) | `terminal/backend/src/server.ts` | POST → `{ jobId }` → 잡 실행 확인 | ✅ |
| 10-9 | `GET /api/news/fulltext/:newsId` 엔드포인트 | `terminal/backend/src/server.ts` | 특정 newsId에 대해 full text 반환 | ✅ |
| 10-10 | `GET /api/news` 응답에 `hasFullText`, `keywords`, `keywordsStatus` 필드 추가 | `newsRepository.ts`, `server.ts` | 응답 각 row에 관련 필드 포함 | ✅ |
| 10-11 | 프론트: Full Text 컬럼 (O/X) + Keywords 컬럼 추가 + 컬럼 토글 연동 | `FinnhubNewsWindow.tsx` | 테이블에 O/X와 Keywords 표시, Columns 드롭다운에 포함 | ✅ |
| 10-12 | 프론트: O 클릭 → full text 팝업 (안전 HTML 렌더) | `FinnhubNewsWindow.tsx` | O 클릭 시 모달에 full text 표시, XSS 방지 | ✅ |
| 10-13 | 프론트: "Full Text Update" 버튼 + View Log 연동 | `FinnhubNewsWindow.tsx` | 버튼 클릭 → 잡 시작 → View Log로 확인 → 완료 후 목록 재조회 | ✅ |
| 10-14 | end-to-end 검증: Nasdaq + TMX + finnhub.io 각각 추출 결과 확인 | (런타임) | 3개 도메인 모두 정상 처리 확인 | ✅ |
| 10-15 | 후속 AI keyword 분석 결과 저장 규약 정의 | `fulltextRepository.ts`, `plan.md` | `keywords_json`/`keywords_status` 사용 규약 문서화 | ⬜ |

**세부 단계 목적/설명 (10단계)**
- `10-1` 목적: full text 저장 인프라를 DB에 준비. 설명:
  - `initDb()`에 `news_fulltext` 테이블을 idempotent하게 CREATE한다.
  - `news_fulltext`에 `keywords_json`, `keywords_status`, `keywords_updated_at` 컬럼을 함께 둔다.
  - 키워드 값은 이 단계에서 생성하지 않고, 후속 AI enrichment 작업이 나중에 채운다.
  - `news_items`에 `publisher TEXT` 컬럼을 `ensureColumn()`으로 추가한다.
  - `news_fulltext`의 FK(`news_id`)는 `news_items.id`를 참조한다.
  - 완료 조건(눈으로 확인): 백엔드 시작 후 `sqlite_master`에 `news_fulltext` 테이블이 존재하고, `PRAGMA table_info(news_fulltext)`에 keyword 컬럼이 있으며, `PRAGMA table_info(news_items)`에 `publisher` 컬럼이 있다.
  - 사람 검증(비개발자): SQLite 뷰어에서 테이블/컬럼 존재 확인.
  - 흔한 문제/주의: FK 컬럼 타입 불일치; ensureColumn 호출이 initDb 밖에 있어 실행 안 됨.
- `10-2` 목적: full text 데이터 접근을 캡슐화. 설명:
  - `getFulltext(newsId)`, `insertFulltext(newsId, data)`, `getUnextractedNewsIds()`, `getFulltextStatus(newsIds)` 구현.
  - `getUnextractedNewsIds()`는 `news_items LEFT JOIN news_fulltext ON ... WHERE news_fulltext.news_id IS NULL`로 미추출 ID를 반환.
  - `insertFulltext`는 이미 존재하면 skip(INSERT OR IGNORE) — 멱등성 보장.
  - 완료 조건(눈으로 확인): `npx tsc --noEmit` 통과, repository 함수들이 DB와 정상 통신.
  - 흔한 문제/주의: LEFT JOIN 방향 실수로 이미 추출된 ID도 반환; INSERT OR IGNORE 없이 중복 시 크래시.
- `10-3` 목적: 기존 news_items에 publisher를 backfill. 설명:
  - `publisher IS NULL`인 모든 row에 대해 URL 도메인을 파싱하여 publisher를 세팅.
  - 매핑: `www.nasdaq.com` → `NASDAQ`, `money.tmx.com` → `TMX`, `finnhub.io` → `FINNHUB`.
  - market news처럼 도메인 규칙에 바로 매핑되지 않는 row는 `UNKNOWN`으로 남을 수 있다.
  - 향후 Finnhub 인제션(4단계) 시 신규 뉴스 insert 시에도 자동으로 publisher를 세팅하도록 provider를 수정.
  - 완료 조건(눈으로 확인): `SELECT publisher, COUNT(*) FROM news_items WHERE source='FINNHUB' GROUP BY publisher` 실행 시 `NASDAQ`/`TMX`/`FINNHUB` 외에 `UNKNOWN`이 나타날 수 있음을 확인하고, 각 값이 URL 도메인 규칙과 모순되지 않는지 점검한다.
  - 사람 검증(비개발자): 위 SQL 실행 결과 확인.
  - 흔한 문제/주의: URL이 NULL/비어있는 row 처리; 도메인 파싱 시 `https://` prefix 누락.
- `10-4` 목적: Nasdaq 기사 full text를 HTML에서 추출. 설명:
  - HTTP GET으로 Nasdaq 페이지를 가져오고, HTML을 파싱하여 article body를 추출한다.
  - 추출 전략: `<div class="body__content">` 또는 유사 selector로 본문 영역을 특정.
  - HTTP 요청 재시도: 최대 10회, 짧은 백오프. 429/5xx 시 재시도, 404/403은 즉시 실패.
  - 추출 실패 시 `extraction_status = 'failed'`로 기록.
  - 완료 조건(눈으로 확인): 샘플 Nasdaq URL 3~5개에 대해 full text가 추출되고 word_count > 0.
  - 흔한 문제/주의: Nasdaq이 selector를 변경하면 추출 실패; User-Agent 없이 차단; HTML 인코딩 이슈.
- `10-5` 목적: TMX 기사 full text를 GraphQL API로 추출. 설명:
  - URL path에서 newsid를 추출 (예: `/en/quote/news/4568018400043402` → `4568018400043402`).
  - `https://app-money.tmx.com/graphql`에 POST 요청: `query: getNewsStoryById($newsid)`.
  - 응답의 `story` 필드가 HTML full text.
  - newsid 추출 실패 시 `extraction_status = 'failed'`, `extraction_note = 'newsid-parse-failed'`.
  - 완료 조건(눈으로 확인): 샘플 TMX URL 3~5개에 대해 story HTML이 추출되고 word_count > 0.
  - 흔한 문제/주의: newsid가 URL에 없는 경우(다른 TMX URL 패턴); GraphQL 스키마 변경; CORS 관련 이슈(백엔드 서버 → TMX이므로 CORS 무관).
- `10-6` 목적: publisher에 따라 올바른 추출기로 라우팅. 설명:
  - `extractByDomain(url, publisher)`는 switch/map으로 `NASDAQ` → `extractNasdaq`, `TMX` → `extractTmx`, `FINNHUB` → skip 결과 반환.
  - 미지 publisher → `{ extractionStatus: 'unavailable', extractionNote: 'unknown-domain' }`.
  - 완료 조건(눈으로 확인): 각 도메인에 대해 올바른 추출기가 호출되는지 단위 테스트 또는 로그로 확인.
  - 흔한 문제/주의: publisher가 NULL인 row 들어왔을 때 크래시.
- `10-7` 목적: 전체 미추출 뉴스를 순회하며 추출 → 저장을 오케스트레이션. 설명:
  - `getUnextractedNewsIds()`로 대상 목록을 가져온다.
  - 각 news_id에 대해: news_items에서 url+publisher 조회 → `extractByDomain` 호출 → `insertFulltext` 저장.
  - 진행률: `jobManager.updateProgress(jobId, { completed, total })` + `addLog()`.
  - 도메인별 rate limit: 요청 간 300~500ms sleep. 동일 도메인에 순차 요청.
  - 개별 실패 시 `extraction_status = 'failed'`로 기록하고 계속 진행(전체 중단 금지).
  - 완료 조건(눈으로 확인): 잡 완료 후 `news_fulltext` 테이블에 row가 생기고, 진행률이 100%가 됨.
  - 흔한 문제/주의: rate limit 미준수로 차단; 대량 실행 시 메모리 누수; 잡 중단 시 cleanup.
- `10-8` 목적: Full Text Update를 트리거하는 API. 설명:
  - `POST /api/news/fulltext/update`는 `jobManager`로 백그라운드 잡을 시작하고 즉시 `{ jobId }`를 반환.
  - 잡 내부에서 `runFulltextUpdate(jobId)`를 실행.
  - 이미 실행 중인 full text 잡이 있으면 중복 시작을 방지(409 또는 기존 jobId 반환).
  - 완료 조건(눈으로 확인): POST → 1초 이내 `{ jobId }` 반환. GET /api/jobs/:jobId로 진행률 확인 가능.
  - 흔한 문제/주의: 중복 잡 방지 로직 누락; 잡이 끝나도 status가 'running'으로 남는 경우.
- `10-9` 목적: 특정 뉴스의 full text를 조회. 설명:
  - `GET /api/news/fulltext/:newsId`는 `fulltextRepository.getFulltext(newsId)` 결과를 반환.
  - 존재하지 않으면 404.
  - HTML full text는 그대로 반환(프론트에서 안전 렌더 책임).
  - 완료 조건(눈으로 확인): 추출 성공한 newsId로 호출 시 `{ fullText, extractionStatus: 'success', wordCount > 0 }` 반환.
  - 흔한 문제/주의: newsId 타입 불일치(string vs number); 대용량 HTML 응답 시 timeout.
- `10-10` 목적: 뉴스 목록 API에 full text 존재 여부를 포함. 설명:
  - `newsRepository.getNews()` 쿼리에 `news_fulltext` LEFT JOIN을 추가.
  - 각 row에 `hasFullText: boolean`, `keywords`, `keywordsStatus` 필드를 포함하여 반환한다.
  - `keywords`는 `keywords_json`을 파싱한 배열이고, 후속 AI keyword 분석이 아직 안 끝났으면 빈 배열 또는 pending 상태다.
  - 기존 pagination/filter 로직에 영향 없도록 주의.
  - 완료 조건(눈으로 확인): `GET /api/news?source_names=FINNHUB` 응답에 각 row마다 `hasFullText`, `keywords`, `keywordsStatus` 필드가 존재.
  - 흔한 문제/주의: JOIN으로 인한 쿼리 성능 저하(인덱스 필요); `hasFullText` 계산 조건 실수.
- `10-11` 목적: News 테이블에 O/X 컬럼과 Keywords 컬럼을 추가하여 full text/keyword 상태를 시각적으로 표시. 설명:
  - `Keywords` 컬럼은 AI 분석이 끝난 row만 키워드 목록을 보여주고, 그 전에는 `-` 또는 pending으로 표시한다.
  - 컬럼 가시성 토글에도 `Keywords`를 포함한다.

- `10-15` 목적: 후속 AI keyword 분석 작업이 어떤 컬럼을 어떻게 채워야 하는지 규약을 고정한다. 설명:
  - 별도 AI agent 작업은 `news_fulltext.full_text`를 읽고, `keywords_json`, `keywords_status='ready'`, `keywords_updated_at`를 업데이트한다.
  - full text는 있으나 아직 분석 안 됐으면 `keywords_status='pending'` 유지.
  - 완료 조건(눈으로 확인): 문서와 repository helper에 같은 컬럼 규약이 반영된다.
  - 흔한 문제/주의: full text 추출 단계와 keyword 분석 단계를 혼동해, 빈 키워드를 success처럼 저장하는 문제.
  - `ColumnId` 타입에 `'fulltext'` 추가.
  - `renderCell`에 `fulltext` 케이스: `hasFullText ? 'O'(초록) : 'X'(회색)`. O는 클릭 가능(커서 포인터).
  - 컬럼 가시성 토글(Columns 드롭다운)에 "Full Text" 포함.
  - 완료 조건(눈으로 확인): 뉴스 테이블에 O/X 컬럼이 표시되고, Columns 드롭다운에서 숨기기 가능.
  - 흔한 문제/주의: hasFullText가 응답에 없으면 모든 행이 X로 표시; colWidths 배열 길이 불일치.
- `10-12` 목적: full text를 안전하게 팝업으로 표시. 설명:
  - O 클릭 시 `GET /api/news/fulltext/:newsId` 호출 → 모달에 full text 렌더.
  - **XSS 방지**: HTML full text는 DOMPurify 등으로 sanitize 후 렌더. 또는 iframe sandbox 사용.
  - 팝업 닫기: X 버튼, ESC, 외부 클릭.
  - 로딩 중 스피너 표시.
  - 완료 조건(눈으로 확인): O 클릭 → 팝업에 기사 본문이 표시됨. X 클릭 시 반응 없음.
  - 사람 검증(비개발자): 팝업 내용이 뉴스 제목과 일치하는 실제 기사인지 확인.
  - 흔한 문제/주의: sanitize 없이 `dangerouslySetInnerHTML` 사용 → XSS 위험; 대용량 HTML로 팝업 렌더 느림.
- `10-13` 목적: Full Text Update 버튼으로 원문 추출을 트리거하고 진행률을 확인. 설명:
  - 툴바에 "Full Text Update" 버튼 배치. 기존 Update 드롭다운과 별도.
  - sourceType 메뉴에 `market_news`도 포함한다. 다만 초기 extractor 지원 도메인이 제한되어 있어 많은 row가 `unavailable`/`skipped`일 수 있다.
  - 클릭 시 `POST /api/news/fulltext/update` → `{ jobId }`.
  - View Log 연동: 기존 View Log 패널을 재사용하여 진행률 바 + 로그 표시.
  - 잡 완료 후 뉴스 목록을 재조회하여 hasFullText 변경을 반영.
  - 완료 조건(눈으로 확인): 버튼 클릭 → 잡 시작 → View Log에서 진행 확인 → 완료 후 일부 X가 O로 변경.
  - 흔한 문제/주의: View Log가 동시에 여러 잡을 표시할 때 혼동; 잡 완료 후 목록 재조회가 안 되어 UI 반영 안 됨.
- `10-14` 목적: 3개 도메인 추출 결과를 end-to-end로 확인. 설명:
  - Full Text Update 실행 후 아래 확인:
    1. Nasdaq 뉴스 중 `extraction_status = 'success'` 건수 > 0, word_count > 50
    2. TMX 뉴스 중 `extraction_status = 'success'` 건수 > 0, full_text에 `<` 포함(HTML)
    3. finnhub.io 뉴스 전체 `extraction_status = 'skipped'`
    4. UI에서 O/X가 정확히 반영되고, O 클릭 시 본문 팝업
  - 완료 조건(눈으로 확인): 위 4가지 확인 통과.
  - 사람 검증(비개발자): News 창에서 O 항목을 클릭하여 실제 기사 내용이 나오는지 확인.
  - 흔한 문제/주의: 대부분의 Nasdaq URL이 추출 실패(selector 변경/차단); TMX newsid 추출 실패율.

**검증 훅 (10단계 마감):**
```
1. npx tsc --noEmit → 0 errors
2. SELECT publisher, COUNT(*) FROM news_items WHERE source='FINNHUB' GROUP BY publisher → `NASDAQ`/`TMX`/`FINNHUB`/`UNKNOWN` 분포 확인
3. POST /api/news/fulltext/update → { jobId } 반환 → GET /api/jobs/:jobId 폴링 → done
4. SELECT extraction_status, COUNT(*) FROM news_fulltext GROUP BY extraction_status → success/skipped/failed 분포 확인
5. GET /api/news/fulltext/<nasdaq_newsId> → fullText 존재, wordCount > 0
6. GET /api/news/fulltext/<tmx_newsId> → fullText 존재(HTML), wordCount > 0
7. GET /api/news?source_names=FINNHUB → 각 row에 hasFullText 필드 존재
8. UI: O/X 컬럼 표시 확인 → O 클릭 → 팝업에 기사 본문 표시
```
- 사용자 확인 필요: **Yes**

### 미확정 사항(명시 결정 필요)
1) CSV에서 티커가 들어있는 컬럼 규칙 → **결정됨**: 헤더 `Ticker` 또는 `Symbol`
2) 중복 티커 처리(append vs reject) → **결정됨**: 중복 reject
3) 허용 csvPath 범위(기본 제한 vs 확대) → **결정됨**: 확대
4) 기존 `News` 윈도우(EODHD)를 유지할지, Finnhub로 같이 전환할지? → **결정됨**: EODHD 유지 + Finnhub 별도 추가
### 실행 의존성 그래프

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                          실행 의존성 그래프                                  ║
║  범례: ✅ 완료+확인  ⏳ 구현완료/확인대기  ⬜ 미착수  🚫 차단            ║
╚══════════════════════════════════════════════════════════════════════════════╝

✅ Step 0 (데이터 가용성 감사)
│   ├─ 0-1  Finnhub 프로브 ......................... ✅ 완료
│   ├─ 0-2  IBKR TWS 프로브 ....................... ✅ 완료
│   ├─ 0-2b IBKR WSH 프로브 v2 .................... ✅ 완료
│   ├─ 0-2c IBKR WSH 필드 프로브 v3 ............... ✅ 완료
│   ├─ 0-3  능력 매트릭스 .......................... ✅ 완료
│   └─ 0-4  결정 (#5, #6) ......................... ✅ 완료 (확정)
│
▼
✅ Step 1 (기반: update_status + API)
│   ├─ 1-1 update_status 테이블 ..................... ✅ 완료
│   ├─ 1-2 updateStatusRepository.ts ................ ✅ 완료
│   ├─ 1-3 GET /api/updates/status 연결 ............. ✅ 완료
│   └─ 1-4 영속성 테스트 ............................ ✅ 완료
│
├──────────────────────┬──────────────────────────────┐
│    트랙 A            │         트랙 B               │
│    (CSV / Ticker)    │         (Finnhub News)       │
│                      │                              │
▼                      ▼                              │
✅ Step 2               ✅ Step 4                      │
(CSV 읽기+추가 API)    (Finnhub 수집 백엔드)          │
│ ✅ 2-1 tickerCsvSvc  │ ✅ 4-1  finnhubApiKey 설정  │
│ ✅ 2-2 appendTicker  │ ✅ 4-2  finnhubNewsProv    │
│ ✅ 2-3 atomic write  │ ✅ 4-3  POST /news/pull    │
│ ✅ 2-4 GET /tickers  │ ✅ 4-4  finhub_news 상태   │
│ ✅ 2-5 POST /tickers │ ✅ 4-4a market news prov  │
│ ✅ 2-6 상태 갱신      │ ✅ 4-5  조회 검증           │
│                      │ ✅ 4-6  newsChangeMerger  │
│                      │ ✅ 4-7  POST pull+change  │
│                      │ ✅ 4-8  성공 시 상태 갱신    │
│                      │ ✅ 4-9  적재데이터 검증     │
│                      │                              │
▼                      ▼                              │
✅ Step 3               ✅ Step 5                      │
(Default Ticker UI)    (news feed:finhub api UI)     │
│ ✅ 3-1 window type   │ ✅ 5-1 brave-news 제거       │
│ ✅ 3-2 컴포넌트       │ ✅ 5-2 FinnhubNews 이름변경  │
│ ✅ 3-3 DraggableWin  │ ✅ 5-3 mock 데이터 제거      │
│ ✅ 3-4 AddTabModal   │ ✅ 5-4 실제 fetch            │
│ ✅ 3-5 App.tsx 제목  │ ✅ 5-5 "Update" 버튼        │
│ ✅ 3-6 스모크 테스트   │ ✅ 5-6 AddTabModal 라벨     │
│                      │ ✅ 5-7 App.tsx 제목          │
│                      │ ✅ 5-8 DraggableWindow switch│
│                      │ ✅ 5-9 source_type 필터 UI    │
│                      │ ✅ 5-10 서버사이드 검색      │
│                      │ ✅ 5-11 Update 툴팁(5초)     │
│                      │ ✅ 5-12 Ticker 전용 컬럼     │
│                      │ ✅ 5-13 컬럼 가시성 토글     │
│                      │ ✅ 5-14 entire 모드          │
│                      │ ✅ 5-15 Update split-dropdown│
│                      │ ✅ 5-16 Source 링크/Copy URL │
│                      │ ✅ 5-17 백엔드 잡 큐 + 폴링  │
│                      │ ✅ 5-18 View Log 버튼/패널 │
│                      │ ✅ 5-19 Update UX 리디자인  │
│                      │ ✅ 5-20 7D Change Update    │
│                      │ ✅ 5-21 Custom Change Upd   │
│                      │ ✅ 5-22 Industry 컬럼       │
│                      │ 🚫 5-23 Keywords 컬럼       │
│                      │ ✅ 5-24 Publisher 컬럼       │
│                      │ ✅ 5-25 Source 기본 숨김     │
│                      │                              │
└──────────┬───────────┘                              │
           │                                          │
           ▼                                          │
   ╔═══════════════════════════════════════╗           │
   ║  IBKR 단계 (결정 확정 완료)                ║           │
   ║  ✅ #5 /calendar 소스 확정              ║           │
   ║  ✅ #6 Node↔IBKR 연동방식 확정           ║           │
   ╚═══════════════════════════════════════╝           │
           │                                          │
           ├─► ⏳ Step 6 (캘린더 수집 + mock 정리)
           │      ✅ 6-1 mock worker 제거
           │      ✅ 6-2 startCalendarIngestionWorkers 제거
           │      ⏳ 6-3 캘린더 데이터 pull 구현 (IBKR stub, BLOCKED)
           │      ✅ 6-4 POST /ibkr/calendar/update 연결
           │      ✅ 6-5 mock_provider 행 삭제
           │      ✅ 6-6 ibkr_calendar 상태 갱신
           │
           ├─► ✅ Step 7 (IBKR 1D OHLC 수집)
           │      ✅ 7-1 ohlcWatchlistRepository
           │      ✅ 7-2 ensureDerivedColumns 마이그레이션
           │      ✅ 7-3 ibkrOhlc1dProvider
           │      ✅ 7-4 ohlcDerivedMetrics
           │      ✅ 7-5 GET /ibkr/ohlc1d/status
           │      ✅ 7-6 POST /ibkr/ohlc1d/update
           │      ✅ 7-7 파생 컨럼 검증
           │      ✅ 7-8 표준 change metric 백필
           │      ✅ 7-9 custom change 엔드포인트
           │
           ▼
   ✅ Step 8 (Data Control Window UI)
   │  ◄── Steps 6 + 7 완료 필요
   │  ✅ 8-1 window type + 컴포넌트
   │  ✅ 8-2 /api/updates/status에서 상태 fetch
   │  ✅ 8-3 4개 update 버튼
   │  ✅ 8-4 진행률/에러 표시
   │  ✅ 8-5 status/DB date 재조회
   │  ✅ 8-6 백엔드 잡 큐 연동(IBKR)
   │  ✅ 8-7 View Log 버튼 + 로그 패널
   │
   ▼
   ✅ Step 9 (테스트 + 수락 검사)
      ✅ 9-1 백엔드 유닛 테스트 (서비스)
      ✅ 9-2 API 통합 스모크 테스트
      ✅ 9-3 mock 정리 검증
      ✅ 9-4 ACCEPTANCE_TESTS.md 갱신
      ⏳ 9-5 최종 agent_log 검토

                              │
   ╔══════════════════════════╧══════════════════════════╗
   ║  트랙 C — Full Text Extraction (IBKR 무관)         ║
   ║  선행조건: Step 4 완료 (news_items에 뉴스 적재됨)  ║
   ╚═════════════════════════════════════════════════════╝
                              │
                              ▼
   ⏳ Step 10 (Full Text Extraction: 백엔드 + 프론트)  ← 10-15 ⬜ 잔존
   │  ◄── Step 4 완료 필요 (news_items에 Finnhub 뉴스 적재)
   │  ✅ 10-1  news_fulltext 테이블 + publisher 컬럼 migration
   │  ✅ 10-2  fulltextRepository.ts 구현
   │  ✅ 10-3  기존 news_items publisher backfill
   │  ✅ 10-4  extractNasdaq (HTML scraping)
   │  ✅ 10-5  extractTmx (GraphQL API)
   │  ✅ 10-6  extractByDomain (도메인 dispatcher)
   │  ✅ 10-7  fulltextUpdateService (잡 오케스트레이터)
   │  ✅ 10-8  POST /api/news/fulltext/update 엔드포인트
   │  ✅ 10-9  GET /api/news/fulltext/:newsId 엔드포인트
   │  ✅ 10-10 GET /api/news 응답에 hasFullText 추가
   │  ✅ 10-11 프론트: O/X 컬럼 + 컬럼 토글
   │  ✅ 10-12 프론트: O 클릭 → full text 팝업
   │  ✅ 10-13 프론트: Full Text Update 버튼 + View Log
   │  ✅ 10-14 end-to-end 검증 (3개 도메인)
   │  ⬜ 10-15 extractPressRelease (GlobeNewsWire 등)
```

**병렬 트랙 (IBKR 의존 없음):**
- 트랙 A: Steps 1 → 2 → 3 (CSV/Ticker) — 즉시 시작 가능
- 트랙 B: Steps 1 → 4 → 5 (Finnhub News) — 트랙 A와 병렬로 즉시 시작 가능
- 트랙 C: Steps 4 → 10 (Full Text Extraction) — 트랙 B의 Step 4 완료 후 시작 가능, IBKR 무관
- 트랙 A/B는 IBKR 의존 블록(Steps 6-7-8) 전에 합류
- 트랙 C는 IBKR 블록과 독립적으로 병렬 진행 가능

**차단 요약:**
| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| #5: /calendar 데이터 소스 | Step 6 | **확정: IBKR 캘린더 우선 사용** → 추후 Finnhub Estimates 구독 시 전환 가능 |
| #6: Node↔IBKR 연동 방식 | Step 7 | **확정: 옵션 B (Python child_process)** — MVP/빠른 통합 목적 |
| Step 4 완료 | Step 10 | news_items에 Finnhub 뉴스가 적재되어 있어야 full text 추출 대상이 존재 |

### 결정 #6 — Node↔IBKR 연동 구현 방식(상세)
> ✅ **확정: 옵션 B (Python child_process)** — MVP/빠른 통합 목적으로 채택 (2026-03-05)
> - 빠르게 "일단 동작"이 목표일 때 적합 (특히 로컬 개발)
> - IBKR 통신 로직을 Python 쪽으로 격리 가능
> - 구현 난이도: 중간 — Node→Python 호출(인자 전달) / Python→Node 결과(JSON) / 에러 코드 규격만 정하면 됨
> - 단점: 요청마다 프로세스 생성 → 느려질 수 있음, 상태 유지(세션/rate limit 누적)가 어려움
> - "가끔 호출"이면 B가 깔끔하고, "자주 호출/실시간성"이면 C가 더 나음 → 현재는 "가끔 호출"(수동 update) 시나리오이므로 B 적합

목적(왜 필요한가)
- 7단계는 IBKR에서 일봉(1D) OHLCV를 안정적으로 받아야 한다. 프론트는 최종 SQLite만 보지만, 백엔드는 IBKR와 통신하는 “안정적인 실행 모델”이 필요하다.
- 이 결정은 Node/TS 백엔드와 IBKR 사이의 **프로세스/통신 모델**(직결 vs Python 브리지)을 정한다. Windows 환경에서의 안정성, 디버깅, 운영(프로세스 관리)에 직접 영향을 준다.

v1 최소 요구사항
- TWS/IB Gateway에 연결하여 특정 심볼의 1D historical bars를 요청할 수 있어야 한다.
- 결과를 Node 백엔드로 안정적으로 전달(날짜/시가/고가/저가/종가/거래량)하고, 시크릿/민감정보를 로그에 남기지 않는다.
- 일시 장애(끊김, 페이싱 제한)는 제한된 재시도/백오프로 처리하고, 영구 실패(호스트/포트 오입력, 권한 부족)는 빠르게 실패시키며 원인을 명확히 한다.

선택지(각 옵션이 의미하는 것)
- 옵션 A — **Node 라이브러리 직결**(예: `@stoqey/ib`)
  - 실행 구조: Node만 실행되며 Node가 IBKR 소켓 연결을 직접 연다.
  - 장점: 단일 런타임, 언어 간 프로토콜 불필요, 배포 단순.
  - 단점: 라이브러리 안정성/타입/재연결/페이싱 이슈를 직접 다뤄야 할 수 있음.
- 옵션 B — **Node + Python `child_process`**
  - 실행 구조: Node가 요청 시 로컬 Python 프로세스를 실행 → Python이 IBKR 통신 후 JSON 출력 → Node가 파싱.
  - 장점: Python 쪽 IBKR 툴링이 비교적 탄탄한 경우가 많음; IBKR 특이사항을 Python 쪽으로 격리.
  - 단점: Python 런타임 의존; JSON 프로토콜/에러 전달을 깔끔히 설계해야 함.
- 옵션 C — **Node + Python 마이크로서비스(localhost)**
  - 실행 구조: Python 서비스가 상시 실행되며 IBKR 세션을 유지; Node는 HTTP로 호출.
  - 장점: 연결 재사용/페이싱 제어에 유리; 경계가 명확; 요청 큐잉/재시도 설계가 쉬움.
  - 단점: 추가 프로세스 관리(시작/중지/헬스체크) + 로컬 포트 설정이 필요.

결정 체크리스트(사용자가 답해야 할 것)
- 옵션 A/B/C 중 무엇을 선택할지?
- TWS/IB Gateway가 어디서 실행 중인지(백엔드와 같은 PC인지), 그리고 host/port는 무엇인지?
- Python 설치/실행이 가능한지? 가능하다면 (B) 온디맨드 실행 vs (C) 상시 서비스 중 어느 쪽을 선호하는지?

선택 후 검증(“결정 완료”의 정의)
- AAPL 같은 단일 심볼로 짧은 구간의 1D bar를 반복 호출할 수 있는 프로브가 있고, 결과가 비어있지 않음을 확인.
- 그 다음 7단계의 `POST /api/ibkr/ohlc1d/update`를 전체 티커 대상으로 안전하게 확장한다.
