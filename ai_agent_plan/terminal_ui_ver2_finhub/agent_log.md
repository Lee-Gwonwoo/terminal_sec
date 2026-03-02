# Agent Log — terminal_ui_ver2_finhub

## 2026-03-02

### Step 0 — Data availability audit (데이터 수집 가능 범위 점검)

**Status: done (awaiting user confirmation)**

#### Actions taken

1. **Finnhub 프로브 결과 확인** (기존 파일 읽기)
   - `tmp/probes/finnhub_profile2_AAPL.json` — marketCapitalization, finnhubIndustry, name 필드 존재 확인
   - `tmp/probes/finnhub_profile2_MSFT.json` — 동일 필드 확인
   - `tmp/probes/finnhub_company_news_AAPL.json` — datetime(epoch sec), headline, source, related 필드 확인
   - `tmp/probes/finnhub_calendar_earnings_AAPL.json` — `{ "earningsCalendar": [] }` 빈 배열
   - `tmp/probes/finnhub_calendar_earnings_MSFT.json` — 빈 배열
   - `tmp/probes/finnhub_calendar_earnings_TSLA.json` — 빈 배열

2. **OHLC DB 존재 확인** (이전 대화에서 확인됨)
   - `OHLC_data/ohlc_1d_watchlist.sqlite` — 테이블 `ohlc_1d` (PK: Symbol, Datetime), 컬럼 Open/High/Low/Close/Volume
   - 최신 Datetime: 2026-02-20

3. **IBKR 프로브: 수행 완료 (TWS Socket API, port 4001)**
   - 사용자 TWS API Settings 스크린샷 확인 → Socket port 4001, Read-Only API ✅
   - `ib_insync` 0.9.86 설치 후 프로브 실행
   - 프로브 스크립트: `tmp/test_ibkr_tws_probe.py` (clientId=99)
   - 결과 파일:
     - `tmp/probes/ibkr_historical_1d_AAPL.json` — ✅ 5 bars (2026-02-23~27), OHLCV 전체 필드 존재
     - `tmp/probes/ibkr_contract_details_AAPL.json` — ✅ longName, industry, category, subcategory
     - `tmp/probes/ibkr_probe_summary.json` — 전체 결과 요약
   - **Fundamental data 불가:**
     - `reqFundamentalData("CalendarReport")` → `available: false`
     - `reqFundamentalData("ReportsFinSummary")` → `available: false`
     - 원인: Fundamental Data subscription 미보유 또는 TWS Socket API 제한
   - **Calendar endpoint 부재:** TWS Socket API에는 `/calendar` 직접 엔드포인트 없음

4. **`test_data_availability_audit.md` 업데이트**
   - 파일: `ai_agent_plan/terminal_ui_ver2_finhub/test/test_data_availability_audit.md`
   - 변경: 빈 템플릿 → 프로브 결과가 반영된 확정 capability matrix
   - EN/KO 양쪽 업데이트
   - 추가 섹션: Finnhub 원시 필드 레퍼런스, IBKR 미수행 사유, 전체 감사 결론

#### Audit verdict
- Finnhub (News Feed + Watchlist): **PASS** ✅
- IBKR OHLC 1D bars: **PASS** ✅ (TWS Socket API, port 4001)
- IBKR Contract Details (Name/Industry): **PASS** ✅
- IBKR Fundamental/Calendar data: **FAIL** ❌ (CalendarReport, FinSummary 둘 다 unavailable)
- OHLC DB (Changes %): **PASS** ✅

#### Issues found
1. ~~IBKR 프로브 미수행~~ → **해결됨**: TWS Socket API (port 4001) 프로브 완료
2. **IBKR Calendar 데이터 불가** — TWS Socket API에서 earnings/dividend/analyst calendar endpoint 없음, Fundamental Data subscription도 없음
   - `/calendar` UI가 요구하는 EPS/Revenue/Analyst Rating 등을 IBKR에서 직접 가져올 수 없음
   - **의사결정 필요**: Finnhub earnings calendar 대체? 또는 Calendar 윈도우 스펙 축소?
3. Finnhub earnings calendar 빈 배열 → Optional 처리(미표시) 제안
4. ~~Plan 미확정 사항 4가지 미결정~~ → **해결됨**: CSV='Ticker'/'Symbol' header, reject duplicates, broader path, EODHD+Finnhub 병행

#### PLAN CHANGE (2026-03-02)
- **왜**: 사용자 TWS 스크린샷 확인 → Client Portal Gateway가 아닌 TWS Socket API (port 4001) 사용 확정
- **무엇이 바뀌었나**: plan.md "Option A: Client Portal Web API" → "Option B: TWS Socket API (ib_insync, port 4001)"
- **영향**:
  - Step 7 (IBKR OHLC): `ib_insync` + `reqHistoricalData` 사용 → HTTP fetch 대신
  - Step 6 (IBKR Calendar): TWS로는 calendar 데이터 불가 → **대안 필요** (Finnhub calendar? 또는 스펙 축소?)
  - 백엔드에 Python ↔ Node.js 브리지 필요할 수 있음 (`ib_insync`는 Python) 또는 Node.js용 `@stoqey/ib` 사용

#### Errors / process violations
- **Step 0 완료 확인 전에 Step 1 코드를 선행 작성함** (db.ts, updateStatusRepository.ts, server.ts import)
  - 영향받은 파일:
    - `terminal/backend/src/db.ts` — `update_status` 테이블 CREATE 추가
    - `terminal/backend/src/services/updateStatusRepository.ts` — 신규 생성
    - `terminal/backend/src/server.ts` — `listUpdateStatuses` import 추가
  - 이 코드들은 Step 1 사양과 일치하지만, Step 0 사용자 확인 전에 작성됨
- **agent_log.md 미생성** — Plan 규칙 위반 (실행 지시 시점부터 로그 작성 필수)
- **Step closeout 템플릿 미사용** — 리스크/검증방법/사용자 확인 요청을 형식에 맞게 하지 않음

---

### Pending user decisions (Step 0 gates)
1. ~~IBKR 프로브 없이 Steps 1~5 먼저 진행 OK?~~ → IBKR OHLC 프로브 완료됨, 진행 가능
2. Finnhub earnings calendar 빈 배열 → Optional(미표시) OK? (이전 확인됨)
3. ~~선행 작성된 Step 1 코드: 그대로 유지 or 롤백?~~ → 유지 (사용자 확인됨)
4. ~~Plan 미확정 사항~~ → 전부 결정됨
5. **NEW: /calendar 데이터 소스 재결정 필요**
   - IBKR TWS Socket API로는 calendar events(earnings/dividend/analyst) 직접 가져올 수 없음
   - 선택지:
     - (A) Finnhub earnings calendar로 대체 (IBKR-only 요구사항 완화)
     - (B) Calendar 윈도우 스펙 축소 (지원 가능한 필드만)
     - (C) Client Portal Gateway 추가 설치 (HTTP REST calendar endpoint 사용)
6. **NEW: Node.js 백엔드에서 IBKR OHLC 연동 방식**
   - (A) Node.js용 `@stoqey/ib` 라이브러리 사용 (순수 Node.js)
   - (B) Python `ib_insync` 스크립트를 백엔드에서 child_process로 호출
   - (C) 별도 Python 마이크로서비스

### User response (2026-03-02)
- 의사결정 #5 (/calendar 데이터 소스): **보류** ("이따가 다시 물어봐라")
- 의사결정 #6 (Node.js ↔ IBKR 연동 방식): **보류** ("이것도 이따가 다시 물어봐")
- 영향: Steps 6-7 (IBKR calendar + OHLC ingestion) 진행 불가. Steps 1-5 (비-IBKR)는 진행 가능.
- Step 0 상태: **done (awaiting user confirmation on IBKR decisions)** — 나머지 감사(Finnhub/OHLC) 결과는 확정됨

---

### Detailed sub-steps creation (2026-03-02)

**Action**: 사용자 요청에 따라 plan.md에 "Detailed Sub-Steps & Verification Hooks" 섹션 추가
- 각 Step(0~9)을 세부 단계(N-1, N-2, ...)로 분해
- 각 세부 단계마다 작업/대상 파일/검증 방법을 테이블로 정리
- 각 Step 마감 시 실행할 검증 명령어(verification hook) 블록 포함
- 세부 단계 완료 후 `ask_questions` 훅으로 사용자 확인 요청하는 프로세스 규칙 명시
- 실행 의존성 그래프 포함 (병렬 트랙: Steps 1→2→3, Steps 1→4→5 는 IBKR 결정 없이 진행 가능)
- EN/KO 양쪽 섹션에 동일 내용 추가 (정합 유지)
- 기존 "미확정 사항" 4개에 결정 상태를 반영(`→ **DECIDED**`)

**Files modified**:
- `ai_agent_plan/terminal_ui_ver2_finhub/plan.md` — EN 섹션 (line ~557 부근) + KO 섹션 (파일 끝) 양쪽에 추가

**Status**: done (awaiting user confirmation)

---