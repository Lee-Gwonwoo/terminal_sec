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
- Python 중심의 스크립트 파이프라인 영역(예: `EODHD/`, `original_data/`, `deep_learning_data/`) — script-first 워크플로우에 사용

작업 대상/디렉토리(Node 앱 vs Python 스크립트)에 따라 적용할 관례를 선택하세요.

### 데이터 타입별 저장 경로 지침
작업 전에 “어떤 데이터 타입을 다루는지” 먼저 정하고, 아래 저장 위치를 기준으로 읽기/쓰기 경로를 판단합니다.

- **앱 런타임 SQLite (terminal 백엔드 기본 DB)**
	- 경로: `terminal/backend/backend/data/app.db`
	- 용도: terminal 앱의 기본 영속 데이터
	- 포함 예시: `news_items`, `news_fulltext`, `news_change_metrics`, `calendar_events`, `update_status`, watchlist/alerts 관련 테이블

- **OHLC 일봉 SQLite (watchlist canonical price DB)**
	- 경로: `OHLC_data/ohlc_1d_watchlist.sqlite`
	- 용도: 일봉 OHLCV canonical 저장소
	- 포함 예시: `ohlc_1d`, `symbols`, 파생 컬럼(`Change_1d_Pct` 등)

- **뉴스 원문/뉴스 후처리 데이터**
	- 기본 원칙: terminal 앱에서 쓰는 뉴스 관련 영속 데이터는 우선 `terminal/backend/backend/data/app.db` 안에서 관리
	- 포함 예시:
		- 뉴스 메타데이터 → `news_items`
		- full text 추출 결과 → `news_fulltext`
		- change metric 파생값 → `news_change_metrics`
		- keyword 분석 결과 → `news_fulltext` 옆 keyword 컬럼 또는 같은 DB의 인접 테이블
	- 주의: 테스트/실험 산출물(JSONL/CSV)은 canonical 저장소로 간주하지 않음

- **뉴스 실험 산출물 / 외부 export / 임시 정리본**
	- 대표 경로: `storage/`, `storage/storage_eodhd/news_data/`, `tmp/probes/`
	- 용도: 실험 결과, 점검용 export, probe 응답, 중간 정리 파일
	- 주의: production source of truth로 가정하지 말고, 검증/디버깅용 산출물로 취급

- **watchlist / ticker 입력 원본**
	- 대표 경로: `hts_watch_lists/`, `tradigview_screener/original_data/`
	- 용도: CSV 기반 ticker 목록, 변환 전/후 watchlist 데이터
	- UI/백엔드에서 참조 CSV를 쓸 때는 사용자가 선택한 파일과 기본 파일을 구분해서 다룸

- **API 키 / 시크릿 파일**
	- 대표 경로: `EODHD/API TOKEN`, `finhub/finhub_api_key/finhub_api_key`, `ai_agent_plan/google_api_key/`, `ai_agent_plan/brave_api/`
	- 용도: 외부 provider 인증 정보
	- 주의: 로그/출력/문서 예시에 실제 값을 노출하지 않음

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
- 새 뉴스 후처리 타입(full text, keyword, sentiment, change metric 등)을 추가할 때는 가능하면 app DB 안의 별도 테이블/컬럼으로 붙이고, 개별 flat file을 새 canonical 저장소로 만들지 않는다.

### 프롬프트/스펙 문서(최신 기준)
현재 구현과 맞는 “prompt/spec” 문서(코드가 어떻게 동작하는지 설명)는 아래를 우선 참고합니다:
- 백엔드 프롬프트/스펙: `terminal/backend_prompt.md`
- 프론트엔드 프롬프트/스펙(Figma 기반 UI): `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`

만약 문서와 코드가 불일치하면, 같은 변경 작업에서 문서를 함께 업데이트하세요.
