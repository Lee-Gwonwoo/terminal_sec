# Repository context (optional)

### 이 문서의 목적
이 문서는 레포에 종속적인 컨텍스트(개요, 폴더 구조, 데이터 흐름, 실행 방법)를 담습니다.

### 왜 분리했나
`copilot-instructions.md`는 다른 레포로 복사되어 재사용될 수 있습니다. 이때 레포 종속 가정(구조/실행/데이터 흐름)은 쉽게 틀어져 오히려 방해가 되므로, 레포 컨텍스트는 여기처럼 **옵션 + 교체 가능** 문서로 분리합니다.

### 언제 쓰나
- 변경 작업 전에 레포 구조를 빠르게 파악해야 할 때(어디에 코드가 있고, 무엇을 어떻게 실행하는지).
- 작업이 레포 토폴로지(프론트/백 분리, 데이터 디렉토리, 빌드 툴링)에 직접 의존할 때.

### 유지보수 규칙
- 레포가 의미 있게 바뀌면(엔트리포인트/데이터 흐름/실행 커맨드 변경) 이 파일을 업데이트합니다.
- `copilot-instructions.md`를 다른 레포로 복사할 때는 이 파일을 삭제하거나, 새 레포에 맞게 내용을 다시 작성하세요.

### 현재 레포(terminal_sec) 메모
이 workspace는 다음이 함께 있는 혼합 레포로 보입니다:
- `terminal/` 아래 Node/TypeScript 기반의 “terminal” 앱(dev/build/test 스크립트 포함)
  - 백엔드: `terminal/backend/src/` (Express + SQLite, tsx watch)
  - 프론트엔드: `termina_web/figma_code/terminal_ui_ver2_finhub/` (React + Vite)
  - Python 보조 스크립트: `terminal/backend/scripts/` (IBKR 연동 등 — TypeScript에서 child_process로 호출)
- Python 중심의 스크립트 파이프라인 영역(예: `EODHD/`, `OHLC_data/`, `hts_watch_lists/`, `tmp/`) — 데이터 수집/변환용

작업 대상/디렉토리(Node 앱 vs Python 스크립트)에 따라 적용할 관례를 선택하세요.

#### 백엔드 서비스 구조 (`terminal/backend/src/services/`)
- **뉴스 수집**: `finnhubNewsProvider.ts`, `eodhdNewsProvider.ts`
- **뉴스 조회/저장**: `newsRepository.ts` (GET /api/news — 여러 테이블 LEFT JOIN)
- **Change % 계산**: `newsChangeMerger.ts` (OHLC DB → `news_change_metrics` UPSERT)
- **OHLC 데이터 소스**: `ohlcWatchlistRepository.ts` (로컬 OHLC SQLite), `ibkrOhlcBatchProvider.ts` (IBKR TWS fallback), `ibkrOhlc1dProvider.ts` (단건 IBKR), `finnhubOhlcProvider.ts` (Finnhub candle)
- **full text 추출**: `fulltextExtractors.ts` + `fulltextUpdateService.ts` + `fulltextRepository.ts`
- **AI 분석**: `aiAnalysisRepository.ts` (`news_ai_analysis` 테이블)
- **기업 프로필**: `companyProfileRepository.ts`, `finnhubProfile2Provider.ts`, `fmpCompanyProfileProvider.ts`
- **기타**: `industryLookup.ts`, `tickerCsvService.ts`, `tickerUniverseRepository.ts`, `calendarIngestion.ts`, `researchRepository.ts`, `jobManager.ts`

#### Python 보조 스크립트 (`terminal/backend/scripts/`)
- `ibkr_fetch_ohlc_batch.py`: IBKR TWS에서 다수 종목 OHLC 배치 조회 (stdin JSON → stdout NDJSON). TypeScript `ibkrOhlcBatchProvider.ts`가 child_process로 호출.
- `ibkr_fetch_ohlc.py`: 단건 IBKR OHLC 조회
- `ibkr_wsh_calendar.py`: IBKR Wall Street Horizon 캘린더 이벤트 조회

### 데이터 타입별 저장 경로 지침
작업 전에 “어떤 데이터 타입을 다루는지” 먼저 정하고, 아래 저장 위치를 기준으로 읽기/쓰기 경로를 판단합니다.

- **앱 런타임 SQLite (terminal 백엔드 기본 DB)**
	- 경로: `terminal/backend/backend/data/app.db`
	- 용도: terminal 앱의 기본 영속 데이터
	- **전체 테이블 목록 (2026-03 기준)**:
		| 테이블 | 용도 | 비고 |
		|--------|------|------|
		| `news_items` | 뉴스 메타데이터 (134K rows) | PK: `id` (UUID). legacy inline change 컬럼 잔존 (사용 안 함) |
		| `news_change_metrics` | 뉴스별 change% 파생값 (900K rows) | PK: `(news_id, metric_key)`. **영구 보존** (`CREATE TABLE IF NOT EXISTS`). metric_key: `change_pct`, `change_1d_pct`, `change_from_open_pct`, `change_open_to_high_pct`, `change_3d_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct` |
		| `news_fulltext` | full text 추출/키워드 (101K rows) | PK: `news_id`. keywords_json/keywords_status 포함 |
		| `news_ai_analysis` | AI 스코어/증거 (0 rows) | PK: `news_id`. score, score_evidence, analysis_status |
		| `news_sentiment_snapshots` | 종목별 sentiment (683 rows) | UNIQUE: `(ticker, asof_date)`. Finnhub sentiment API 기반 |
		| `news_saved_views` | 저장된 뉴스 필터 뷰 (0 rows) | |
		| `bookmark_folders` | 북마크 폴더 트리 (3 rows) | parent_id 자기참조로 트리 구조 |
		| `bookmark_items` | 북마크된 뉴스 (3 rows) | PK: `(folder_id, news_id)` |
		| `confirmed_empty_ranges` | 빈 뉴스 구간 확정 (334 rows) | PK: `(ticker, source_type)` |
		| `securities` | ticker 마스터 (1,698 rows) | UNIQUE: `(ticker, exchange)`. 서버 시작 시 CSV에서 upsert |
		| `company_profiles` | 기업 프로필 (1,734 rows) | UNIQUE: `(security_id, source)`. market_cap, peers_json 포함 |
		| `ticker_universes` | ticker 유니버스 정의 (1 row) | |
		| `ticker_universe_items` | 유니버스 소속 ticker (1,698 rows) | |
		| `calendar_events` | 캘린더 이벤트 (0 rows) | |
		| `update_status` | 업데이트 상태 추적 (8 rows) | PK: `source_key` |
		| `research_tabs` | Case Research 탭 (2 rows) | |
		| `research_pages` | Case Research 페이지 (3 rows) | |
		| `users` | 사용자 (1 row) | |
		| `watchlists` / `watchlist_items` | 관심종목 (0 rows) | |
		| `alert_rules` | 알림 규칙 (0 rows) | |
	- 현재 코드 기준 주의:
		- `news_change_metrics`는 **영구 테이블**이다 (`CREATE TABLE IF NOT EXISTS`). 서버 재시작 시 삭제/재생성되지 않는다.
		- `news_items`에는 legacy inline change 컬럼(`change_1d_pct`, `change_from_open_pct` 등)이 남아 있지만, `newsChangeMerger`는 이 컬럼에 쓰지 않고 `news_change_metrics` 테이블에만 UPSERT한다.
		- 실제 조회(`GET /api/news`)는 `news_items`에 `news_change_metrics` 8개 metric_key를 각각 LEFT JOIN + `news_fulltext` + `news_ai_analysis` + `news_sentiment_snapshots` + `company_profiles` + `securities`를 join해서 응답한다.
		- `/api/news` change 날짜 필드는 분리되어 있다.
		  - `[][][]ohlc_date[][][]` / `[][][]change_pct_ohlc_date[][][]` = `change_pct.target_date`
		  - `[][][]change_1d_target_date[][][]` = `change_1d_pct.target_date`
		  - 대응 metric 값이 `null`이면 대응 날짜 필드도 `null`로 내려간다.

- **OHLC 일봉 SQLite (watchlist canonical price DB)**
	- 경로: `OHLC_data/ohlc_1d_watchlist.sqlite`
	- 용도: 일봉 OHLCV canonical 저장소 (EODHD 기반 + IBKR fallback upsert)
	- 테이블:
		- `ohlc_1d` (4M rows): `Symbol, Datetime, Open, High, Low, Close, Volume, Change_1d_Pct, Change_From_Open_Pct, Change_7d_Pct, Change_14d_Pct, Change_30d_Pct, Derived_Updated_At`
		- `symbols` (1,188 rows): `Symbol, Industry`
	- Change% 파생 컬럼은 `ohlcDerivedMetrics.ts`가 계산해서 같은 테이블에 업데이트
	- **IBKR fallback**: `newsChangeMerger`가 change 계산 시 로컬 OHLC DB에 해당 종목이 없으면 IBKR TWS에서 배치 조회 후 이 DB에 upsert (Phase 1.5)
	- 현재 운영 규칙: ET `16:00:00` 이전에는 current ET date 일봉을 canonical OHLC DB에 저장하지 않는다. 이미 장중 row가 들어간 경우 purge 후 재계산으로 정리한다.

- **뉴스 원문/뉴스 후처리 데이터**
	- 기본 원칙: terminal 앱에서 쓰는 뉴스 관련 영속 데이터는 우선 `terminal/backend/backend/data/app.db` 안에서 관리
	- 포함 예시:
		- 뉴스 메타데이터 → `news_items`
		- full text 추출 결과 → `news_fulltext`
		- change metric 파생값 → `news_change_metrics` (8개 metric_key, `newsChangeMerger.ts`가 UPSERT)
		- keyword 분석 결과 → `news_fulltext.keywords_json`, `news_fulltext.keywords_status`, `news_fulltext.keywords_updated_at`
		- AI 분석 결과 → `news_ai_analysis` (score, score_evidence, analysis_status)
		- publisher 보강값 → `news_items.publisher`
		- sentiment → `news_sentiment_snapshots` (종목별, Finnhub sentiment API → ticker+asof_date 기준)
		- 북마크 → `bookmark_folders` + `bookmark_items` (트리 구조 폴더)
	- 현재 코드 기준 운영 규칙:
		- `GET /api/news`(`newsRepository.ts`)는 `news_items`에 8개 `news_change_metrics` LEFT JOIN + `news_fulltext` + `news_ai_analysis` + `news_sentiment_snapshots` + `company_profiles`/`securities`를 join 해서 응답한다.
		- change 계산 흐름: UI에서 `update-recent` 또는 `update-custom` API → `newsChangeMerger` → OHLC DB 조회 (없으면 IBKR 배치 fallback) → `news_change_metrics` UPSERT
		- 당일 same-day change는 ET 시장일 기준으로 판단하며, ET `16:00:00` 이전이면 `change_pct`, `change_from_open_pct`, `change_open_to_high_pct`를 저장하지 않는다.
		- 장중에는 current ET date 일봉을 OHLC DB에 저장/참조하지 않으므로, 전일 기사 `change_1d_pct`도 오늘 partial bar를 보지 못한다.
		- full text 추출 대상 판단은 현재 `news_fulltext` row 존재 여부 기준이다. 한 번 `failed`/`skipped` row가 생기면 자동 재시도 대상에서 빠질 수 있다.
		- keyword는 이미 runtime DB 내부 컬럼으로 관리되고 있으므로, 별도 JSONL/CSV를 canonical source로 취급하지 않는다.
		- AI 분석(`news_ai_analysis`)은 테이블 존재하지만 아직 0건. 향후 구현 예정.
	- 주의: 테스트/실험 산출물(JSONL/CSV)은 canonical 저장소로 간주하지 않음

- **프론트엔드 런타임 상태 저장**
	- 현재 상태: `termina_web/figma_code/terminal_ui_ver2_finhub` 프론트는 앱 전체 workspace/tabs/theme를 영속 저장하지 않는다.
	- localStorage 사용 항목:
		- `finnhub-last-update-config`: FinnhubNews 마지막 업데이트 설정
		- `ibkr-concurrency`: IBKR Fetch Concurrency 설정 (기본값 30, 범위 1~100)
	- 의미: “앱을 껐다 켜도 마지막 상태 유지”, “탭 상태 유지”, “전역 글자 크기 유지” 같은 기능은 아직 canonical 저장 구조가 구현되지 않은 상태다.
	- 향후 원칙: 프론트 전용 UI state는 1차로 `localStorage`를 사용하고, runtime 데이터 source of truth(`app.db`)와 혼동하지 않는다.

- **뉴스 실험 산출물 / 외부 export / 임시 정리본**
	- 대표 경로: `storage/`, `storage/storage_eodhd/news_data/`, `tmp/probes/`
	- 용도: 실험 결과, 점검용 export, probe 응답, 중간 정리 파일
	- 주의: production source of truth로 가정하지 말고, 검증/디버깅용 산출물로 취급

- **watchlist / ticker 입력 원본**
	- 대표 경로: `hts_watch_lists/`, `tradigview_screener/original_data/`
	- 용도: CSV 기반 ticker 목록, 변환 전/후 watchlist 데이터
	- UI/백엔드에서 참조 CSV를 쓸 때는 사용자가 선택한 파일과 기본 파일을 구분해서 다룸

- **API 키 / 시크릿 파일**
	- 대표 경로: `EODHD/API TOKEN`, `finhub/finhub_api_key/finhub_api_key`, `ai_agent_plan/google_api_key/`, `ai_agent_plan/brave_api/`, `ai_agent_plan/ptpr_api_key/ptpr_api_key`
	- 용도: 외부 provider 인증 정보
	- 주의: 로그/출력/문서 예시에 실제 값을 노출하지 않음

- **PTPR API 조사 상태 (2026-03-10)**
	- 시크릿 파일은 `ai_agent_plan/ptpr_api_key/ptpr_api_key`에 존재함을 확인했다. 값 자체는 문서/로그에 노출하지 않는다.
	- 현재 레포에는 `PTPR` 또는 `ptpr` 명시 연동 코드가 없다. 즉, provider별 base URL, auth 방식, endpoint 매핑은 아직 구현 source of truth가 없다.
	- 공식 문서는 `https://www.rtpr.io/docs`로 확인됐다. 실제 API base URL은 `https://api.rtpr.io`, WebSocket URL은 `wss://ws.rtpr.io`다.
	- 인증 방식은 REST는 `Authorization: Bearer <API_KEY>`, WebSocket은 `wss://ws.rtpr.io?apiKey=<API_KEY>` query parameter다.
	- REST rate limit은 분당 60 requests, WebSocket은 API key당 동시 1 connection이다.
	- 2026-03-10 실제 probe 결과:
		- `GET /articles?limit=100` 성공, 최근 100건 모두 `2026-03-10` UTC 기사였다.
		- `GET /articles/AAPL?limit=5`는 당시 시점 기준 `count=0`이었다.
		- WebSocket 연결 후 `connected`와 `subscribed` 메시지를 실제 수신했다.
	- 현재 확인된 데이터 타입:
		- REST envelope: `[][][]count[][][]`, `[][][]articles[][][]`
		- REST article item: `[][][]ticker[][][]`, `[][][]exchange[][][]`, `[][][]title[][][]`, `[][][]author[][][]`, `[][][]created[][][]`, `[][][]article_body[][][]`, `[][][]article_body_html[][][]`
		- WebSocket inbound message types: `[][][]connected[][][]`, `[][][]subscribed[][][]`, `[][][]article[][][]`, `[][][]ping[][][]`, `[][][]error[][][]`
		- WebSocket outbound client actions: `[][][]subscribe[][][]`, `[][][]unsubscribe[][][]`, `[][][]pong[][][]`
	- 구현 시에는 `.github/copilot-skills/ptpr_api.md`를 우선 참고한다.

- **플랜 / 감사 / 작업 로그 문서**
	- 대표 경로: `ai_agent_plan/<project_name>/plan.md`, `ai_agent_plan/<project_name>/agent_log.md`, `ai_agent_plan/<project_name>/test/`
	- 용도: 구현 계획, 작업 이력, 감사 결과, acceptance/검증 문서
	- 주의: 코드의 source of truth는 아니지만, 현재 작업의 의도/결정사항을 추적하는 공식 문서로 취급

- **프론트엔드/백엔드 스펙 문서**
	- 대표 경로: `terminal/backend_prompt.md`, `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
	- 용도: 현재 구현 기준 동작 설명
	- 주의: 코드와 불일치하면 같은 변경 세트에서 함께 갱신

#### 빠른 판단 규칙
- terminal 앱이 실시간/운영 시 읽는 데이터면 먼저 `terminal/backend/backend/data/app.db` 또는 `OHLC_data/ohlc_1d_watchlist.sqlite`를 canonical 후보로 본다.
- `storage/`, `tmp/`, `tmp/probes/` 아래 파일은 우선 실험/검증 산출물로 보고, source of truth로 가정하지 않는다.
- 새 뉴스 후처리 타입(full text, keyword, sentiment, score, change metric 등)을 추가할 때는 가능하면 app DB 안의 별도 테이블/컬럼으로 붙이고, 개별 flat file을 새 canonical 저장소로 만들지 않는다.
- keyword처럼 이미 `news_fulltext` 안에 저장되는 값은 같은 계열의 후처리 데이터와 함께 `app.db` 내부에서 관리하는 쪽을 우선한다.
- 프론트 UI state(`localStorage`)와 운영 데이터(`app.db`)를 섞지 않는다. 복원용 탭/창 상태는 프론트 저장소, 뉴스/캘린더/가격 데이터는 backend DB가 source of truth다.

### 프롬프트/스펙 문서(최신 기준)
현재 구현과 맞는 “prompt/spec” 문서(코드가 어떻게 동작하는지 설명)는 아래를 우선 참고합니다:
- 백엔드 프롬프트/스펙: `terminal/backend_prompt.md`
- 프론트엔드 프롬프트/스펙(Figma 기반 UI): `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`

만약 문서와 코드가 불일치하면, 같은 변경 작업에서 문서를 함께 업데이트하세요.
