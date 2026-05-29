# Calendar 회사 Description 강화 계획

### 목표
- Calendar Window와 ticker hover에서 기존 provider 원문 description만 보여주는 수준을 넘어, 사용자가 earnings/IPO/SEC 이벤트를 볼 때 바로 이해할 수 있는 **구체적 사업 설명**을 제공한다.
- 추가 description에는 회사가 실제로 판매하는 상품과 서비스, 사용 고객/사용 사례, 매출이 발생하는 방식, 실적에서 봐야 할 핵심 지표를 포함한다.
- `peers`는 현재 provider가 준 단순 ticker 배열을 그대로 쓰지 않고, `진짜 동종 peer`, `인접/부분 경쟁`, `read-through`, `약한 후보/제외`로 분류한다.
- 원문 데이터(FMP/Yahoo/Finnhub)는 보존하고, 사람이 검토 가능한 강화 layer를 별도로 둔다.

### 현재 레포 상태(중요, 확인됨)
- `company_profiles`는 source별 다중 row 구조다. 같은 ticker에 `fmp`, `yahoo`, `finnhub` row가 따로 저장된다.
- `terminal/backend/src/services/calendarRepository.ts`는 Calendar row를 만들 때 description, market cap, peers 등을 field별로 최신 non-empty 값에서 가져온다.
- `terminal/backend/src/services/companyProfileRepository.ts`의 `/api/company-profiles/:ticker`용 병합은 description을 field-level로 가져오지만, peers는 현재 대표 row에 붙은 값이 아니면 null이 될 수 있다.
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/companyDescription.ts`의 `CompanyProfileData`에는 강화 description, peer category, source evidence 필드가 없다.
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CompanyDescriptionHoverPreview.tsx`는 원문 description만 긴 문장으로 보여준다.
- SNOW 로컬 샘플 확인 결과:
  - Yahoo description은 존재하지만 구체 product/service와 실적 체크 포인트가 부족하다.
  - Finnhub peers는 `NET`, `CRWV`, `MDB`, `VRSN`, `TWLO`, `AKAM`, `OKTA`, `GDDY`, `APLD` 등으로 넓게 잡혀 있으며, SNOW의 진짜 사업 비교/AI read-through 구분이 없다.
- default ticker universe 확인 결과:
  - DB 기준 `ticker_universes.name = default`가 존재하며, 전체 2,278개 ticker가 들어 있다.
  - source path는 `tradigview_screener/original_data/watch lists2_2026-02-22.csv`다.
  - 최신 non-null `company_profiles.market_cap` 기준 market cap coverage는 2,276/2,278개다.
  - 전체 141개 industry를 [default_ticker_industry_priority.md](default_ticker_industry_priority.md)에 AI/tech 관련 industry 우선순위와 industry 내부 시총순으로 정리했다.

### 제약 / 비범위
- provider 원문 description을 덮어쓰지 않는다. 강화 description은 별도 필드/테이블에 저장한다.
- 사용자가 명시적으로 요청하지 않는 한 mock 데이터는 만들지 않는다.
- 이번 plan 작성 단계에서는 실제 backend/frontend 코드를 수정하지 않는다.
- AI가 생성한 설명은 원문 source와 구분되어야 하며, `generated_at`, `version`, `confidence`, `sources_json` 같은 감사 정보를 남기는 방향으로 설계한다.
- peers는 투자 판단 확정 목록이 아니라 Calendar에서 빠르게 맥락을 잡기 위한 research aid로 표시한다.

### 읽는 방법(비개발자/일반인 기준)
- `Step 0`은 현재 데이터가 왜 부족한지 확인하는 단계다.
- `Step 1`은 어떤 형식으로 좋은 description을 저장할지 정하는 단계다.
- `Step 2`는 SNOW 같은 예시를 기준으로 실제 문장 품질을 정하는 단계다.
- `Step 3`은 backend/API에 강화 description과 peer 분류를 붙이는 단계다.
- `Step 4`는 Calendar Window/hover UI에서 짧고 읽기 좋은 형태로 보여주는 단계다.
- 상태 표시는 `⬜` 미착수, `⏳` 구현/작성 완료 후 사용자 확인 대기, `✅` 사용자 확인 완료, `🚫` 차단을 뜻한다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- plan 변경이 필요하면 `PLAN CHANGE` 노트를 `agent_log.md` 맨 아래에 추가하고, `plan.md`의 해당 Step을 수정한다.
- 각 Step은 구현 또는 작성 후 검증 결과를 채팅에 보고한다.
- 사용자가 해당 Step 결과를 명시적으로 확인하기 전까지 상태는 `⏳`로 유지한다.
- 사용자가 확인하면 `agent_log.md`에 `사용자 확인 후 완료`로 기록한다.

### 아키텍처(상위)

```text
Raw provider layer
  - company_profiles.source = fmp/yahoo/finnhub
  - 원문 description, raw_json, peers_json 보존
        |
        v
Enrichment layer
  - company_profile_enrichment 또는 동등 구조
  - business_summary_ko
  - products_services_json
  - revenue_model_ko
  - earnings_watch_points_json
  - peer_groups_json
  - sources_json / generated_at / version / confidence
        |
        v
Backend API
  - /api/company-profiles/:ticker 응답에 raw + enrichment 병합
  - Calendar metadata 조회에 enrichment 요약/peer groups 추가
        |
        v
Frontend UI
  - Calendar peers column: 분류 chip 표시
  - hover popup: 짧은 강화 설명 + raw source 접기/펼치기
```

### 결정/선행조건(초기에 확정 필요)
- 강화 description 저장 위치:
  - 선택 A: 새 테이블 `company_profile_enrichment` 생성.
  - 선택 B: `company_profiles`에 enrichment 컬럼 추가.
  - 권장: 선택 A. provider 원문과 AI/curated 결과를 분리할 수 있다.
- 생성 범위:
  - 선택 A: Calendar에 현재 로드된 ticker만 즉시 생성.
  - 선택 B: default universe 전체 batch 생성.
  - 선택 C: default universe 전체를 대상으로 하되, AI/tech 관련 industry 16개를 먼저 처리하고 나머지는 후순위 batch로 처리.
  - 권장: 선택 C. 사용자가 요청한 전체 default ticker 정리를 유지하면서도, SNOW/DELL/HPE/SMCI 같은 AI/tech 설명 품질을 먼저 끌어올릴 수 있다.
- peers 표시 방식:
  - 선택 A: 기존 단일 배열 유지.
  - 선택 B: category별 JSON으로 분리.
  - 권장: 선택 B. provider peers 오류를 사람이 이해할 수 있게 보여준다.

### 계획 중간 필수 확인
- SNOW, DELL, HPE, SMCI처럼 이미 문제를 확인한 ticker 3~5개로 샘플을 먼저 만든다.
- 각 샘플에서 `구체 상품/서비스`, `매출 발생 방식`, `실적 체크 포인트`, `peer 분류`가 빠짐없이 들어갔는지 확인한다.
- provider peers가 이상한 경우에도 숨기지 말고 `약한 후보/제외`로 남겨 감사 가능하게 한다.
- default universe 전체 ticker는 [default_ticker_industry_priority.md](default_ticker_industry_priority.md)를 기준 작업 큐로 사용한다.
- 먼저 추가 작성할 industry는 AI/tech 우선순위 16개이며, 각 industry 내부는 market cap 내림차순으로 처리한다.

#### Default ticker industry 작성 큐(2026-05-29 추가)

상세 전체 목록: [default_ticker_industry_priority.md](default_ticker_industry_priority.md)

| 우선순위 | Industry | 전체 ticker 수 | 먼저 볼 top tickers by market cap |
|----------|----------|----------------|-----------------------------------|
| 1 | Semiconductors | 80 | NVDA, AVGO, MU, AMD, INTC, LRCX, AMAT, TXN, KLAC, QCOM, ADI, MRVL, MPWR, NXPI, TER |
| 2 | Hardware, Equipment & Parts | 55 | SNDK, GLW, APH, TEL, KEYS, COHR, FLEX, GRMN, CLS, JBL, TDY, FN, MKSI, FTV, TTMI |
| 3 | Computer Hardware | 29 | STX, ANET, WDC, DELL, P, NTAP, PSTG, IONQ, SMCI, HPQ, LOGI, QBTS, RGTI, INFQ, QUBT |
| 4 | Communication Equipment | 43 | CSCO, CIEN, LITE, MSI, UI, HPE, SATS, CRDO, ASTS, VIAV, ZBRA, VSAT, PI, ONDS, BDC |
| 5 | Software - Infrastructure | 91 | MSFT, ORCL, PLTR, PANW, CRWD, SNPS, ADBE, FTNT, NET, CRWV, VRSN, MDB, ZS, AKAM, FFIV |
| 6 | Software - Application | 146 | APP, CRM, UBER, INTU, CDNS, NOW, DDOG, MSTR, SNOW, ADSK, WDAY, ZM, TEAM, PTC, SSNC |
| 7 | Internet Content & Information | 36 | GOOGL, GOOG, META, SPOT, DASH, NBIS, RDDT, TWLO, PINS, ZG, Z, SNAP, MTCH, IAC, NN |
| 8 | Information Technology Services | 48 | IBM, ACN, CTSH, FIS, BR, LDOS, AUR, GIB, CDW, APLD, CACI, JKHY, IT, INGM, DLB |
| 9 | Consumer Electronics | 6 | AAPL, NXT, SONO, VUZI, TBCH, GPRO |
| 10 | Electronic Components | 2 | KULR, ELTK |
| 11 | Electronic Gaming & Multimedia | 11 | EA, TTWO, RBLX, MGRT, PLTK, GDEV, CTW, MRDN, SKLZ, GMHS, DKI |
| 12 | Scientific & Technical Instruments | 4 | ARBE, GNSS, ODYS, SOTK |
| 13 | Financial - Data & Stock Exchanges | 4 | CME, ICE, COIN, NDAQ |
| 14 | Telecommunications Services | 37 | TMUS, VZ, T, CMCSA, BCE, TU, RCI, CHTR, TIGO, GSAT, LUMN, LBTYB, LBRDK, LBRDA, TDS |
| 15 | Telecom Services | 2 | RDCM, FNGR |
| 16 | Electrical Equipment & Parts | 30 | VRT, BE, NVT, HUBB, AEIS, POWL, FPS, AYI, ENS, PLUG, AMPX, ATKR, EOSE, PLPC, ENVX |

위 16개 AI/tech 우선 industry 합계는 624개 ticker다. 다음 실행에서는 이 624개를 먼저 대상으로 삼고, 각 industry 내부에서는 상세 파일에 적힌 market cap 순서를 그대로 따른다.

### 제안하는 구현 순서(이유)
1. 먼저 데이터 품질과 샘플 포맷을 확정한다. 문장 구조가 확정되지 않으면 DB/API/UI를 먼저 만들어도 다시 바뀔 가능성이 높다.
2. 저장 layer를 원문과 분리한다. provider 데이터와 AI 요약을 섞으면 나중에 출처/품질 검증이 어렵다.
3. API 병합을 만든 뒤 UI를 바꾼다. UI가 먼저 바뀌면 실제 데이터가 없어 빈 화면이 늘어난다.
4. batch 생성은 마지막에 하되, 대상 순서는 먼저 정리한다. 현재 기준은 default universe 2,278개 전체를 작업 큐로 두고, AI/tech 관련 16개 industry 624개를 1차 batch로 처리하는 것이다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 0 — 요구사항/샘플 포맷 확정

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 0-1 | 현재 SNOW description/peers 데이터 부족 지점을 확인한다 | 없음 | DB에서 SNOW source별 row 확인 | ⏳ |
| 0-2 | 강화 description에 들어갈 필수 항목을 정의한다 | `ai_agent_plan/calendar_description_enrichment/plan.md` | plan 문서에 필수 항목 목록 존재 | ⏳ |
| 0-3 | SNOW 예시를 구체 상품/서비스와 peer 분류 기준으로 작성한다 | `ai_agent_plan/calendar_description_enrichment/snow_description_sample.md` | 샘플 문서에 상품/서비스 예시와 peer category 존재 | ⏳ |
| 0-4 | default universe 전체를 industry별/AI-tech 우선순위/시총순으로 정리한다 | `ai_agent_plan/calendar_description_enrichment/default_ticker_industry_priority.md` | 전체 2,278개, 141개 industry, market cap coverage 2,276개 확인 | ⏳ |

- 0-1 목적: 현재 provider description과 peers의 한계를 눈으로 확인한다.
  - 설명: SNOW의 Yahoo description, Finnhub peers를 확인해 왜 강화 layer가 필요한지 기록한다.
  - 완료 조건(눈으로 확인): plan에 SNOW 현재 데이터 요약이 적혀 있다.
  - 사람 검증(비개발자): plan의 `현재 레포 상태` 섹션에서 SNOW 문제 요약을 읽는다.
  - 흔한 문제/주의: provider peers가 모두 틀린 것은 아니며, 일부는 read-through나 adjacent로 남길 수 있다.
- 0-2 목적: 앞으로 생성될 description의 품질 기준을 고정한다.
  - 설명: `무엇을 파는지`, `누가 쓰는지`, `돈을 어떻게 버는지`, `실적에서 뭘 봐야 하는지`를 필수 항목으로 둔다.
  - 완료 조건(눈으로 확인): 목표/아키텍처/샘플 문서에 동일한 필드명이 반복해서 나타난다.
  - 사람 검증(비개발자): SNOW 예시를 보고 다른 회사에도 같은 형식으로 쓸 수 있는지 판단한다.
  - 흔한 문제/주의: 문장이 길기만 하고 상품/서비스 예시가 없으면 실패다.
- 0-3 목적: 실제 UI에 들어갈 수준의 예시를 만든다.
  - 설명: SNOW를 기준으로 상세 버전과 짧은 UI 버전을 함께 작성한다.
  - 완료 조건(눈으로 확인): `snow_description_sample.md`에 `상세 description`, `짧은 UI 버전`, `peer 재분류`가 있다.
  - 사람 검증(비개발자): SNOW가 무엇을 팔고 어떤 숫자로 움직이는지 문서만 보고 설명할 수 있다.
  - 흔한 문제/주의: `AI 수혜`라는 말만 있고 Cortex/Snowpark/Streamlit 같은 구체 제품이 빠지면 부족하다.
- 0-4 목적: 다음 실행에서 어떤 industry/ticker부터 description을 추가 작성할지 결정한다.
  - 설명: DB default universe 전체 ticker를 industry별로 묶고, AI/tech 관련 industry를 먼저 배치한 뒤 각 industry 내부를 market cap 내림차순으로 정렬한다.
  - 완료 조건(눈으로 확인): `default_ticker_industry_priority.md`에 141개 industry 요약과 industry별 전체 ticker 목록이 있다.
  - 사람 검증(비개발자): plan의 `Default ticker industry 작성 큐`와 상세 파일을 보고 먼저 처리할 industry와 ticker 순서를 알 수 있다.
  - 흔한 문제/주의: 전체 default universe는 2,278개로 크기 때문에 plan 본문에는 요약을 두고, 전체 ticker는 상세 파일에서 관리한다.

검증 훅:
```powershell
Set-Location "c:\github_coding\terminal_sec"
Test-Path ai_agent_plan/calendar_description_enrichment/plan.md
Test-Path ai_agent_plan/calendar_description_enrichment/snow_description_sample.md
Test-Path ai_agent_plan/calendar_description_enrichment/default_ticker_industry_priority.md
Select-String -Path ai_agent_plan/calendar_description_enrichment/snow_description_sample.md -Pattern "Cortex|Snowpark|Streamlit|peer|product revenue"
Select-String -Path ai_agent_plan/calendar_description_enrichment/default_ticker_industry_priority.md -Pattern "전체 ticker 수: 2,278개|Semiconductors|Software - Application|Industry별 전체 Ticker 목록"
```
사용자 확인 필요: **예**

#### ⬜ Step 1 — Enrichment 저장 구조 설계

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | `company_profile_enrichment` 스키마 초안을 확정한다 | `terminal/backend/src/db.ts` | DB migration 후 PRAGMA table_info 확인 | ⬜ |
| 1-2 | enrichment repository 인터페이스를 설계한다 | `terminal/backend/src/services/companyProfileEnrichmentRepository.ts` | TypeScript 정적 분석 | ⬜ |
| 1-3 | peer category JSON schema를 정의한다 | backend service 또는 shared type | 샘플 JSON parse 테스트 | ⬜ |

- 1-1 목적: 원문 provider 데이터와 AI/curated 결과를 분리한다.
  - 설명: ticker별로 강화 description, peer groups, source evidence, version을 저장한다.
  - 완료 조건(눈으로 확인): DB에 enrichment 전용 테이블이 존재한다.
  - 사람 검증(비개발자): 원문 description을 덮어쓰지 않는 구조라는 설명을 확인한다.
  - 흔한 문제/주의: `company_profiles.description`을 직접 덮어쓰면 출처가 섞인다.
- 1-2 목적: backend에서 enrichment를 안전하게 읽고 쓴다.
  - 설명: upsert/get 함수를 만들고 ticker join 기준을 명확히 한다.
  - 완료 조건(눈으로 확인): repository 파일에 get/upsert 함수가 있다.
  - 사람 검증(비개발자): API 조회 시 같은 ticker의 강화 설명이 반환되는지 확인한다.
  - 흔한 문제/주의: source별 다중 row 구조를 무시하면 잘못된 ticker에 붙을 수 있다.
- 1-3 목적: peers를 단순 배열이 아니라 의미 있는 그룹으로 만든다.
  - 설명: `core_same_business`, `adjacent_competitor`, `platform_partner_competitor`, `read_through`, `weak_or_excluded`를 기본 category로 둔다.
  - 완료 조건(눈으로 확인): SNOW 같은 샘플 peer JSON이 category별로 나뉜다.
  - 사람 검증(비개발자): AAPL 같은 약한 후보가 핵심 peer로 보이지 않는지 확인한다.
  - 흔한 문제/주의: Databricks처럼 비상장 peer를 UI에서 어떻게 표시할지 결정이 필요하다.

검증 훅:
```powershell
Set-Location "c:\github_coding\terminal_sec\terminal\backend"
npm.cmd run build
Set-Location "c:\github_coding\terminal_sec"
python -c "import sqlite3; con=sqlite3.connect('terminal/backend/backend/data/app.db'); print([r for r in con.execute('pragma table_info(company_profile_enrichment)')])"
```
사용자 확인 필요: **예**

#### ⬜ Step 2 — SNOW/DELL/HPE/SMCI 샘플 생성 로직

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | raw profile + local research context를 입력으로 묶는 builder를 만든다 | backend service 또는 script | 샘플 입력 JSON 확인 | ⬜ |
| 2-2 | SNOW 강화 description을 DB에 저장하는 dry-run/수동 입력 경로를 만든다 | backend service 또는 admin route | SNOW row 조회 | ⬜ |
| 2-3 | DELL/HPE/SMCI에도 같은 schema로 샘플을 만든다 | DB data | Calendar API 응답 비교 | ⬜ |

- 2-1 목적: 생성 입력을 일관되게 만든다.
  - 설명: provider description, sector/industry, raw peers, Model_100 context를 한 입력으로 합친다.
  - 완료 조건(눈으로 확인): 한 ticker의 입력 JSON에 source별 근거가 들어 있다.
  - 사람 검증(비개발자): 입력에 원문/peer 후보/산업 정보가 모두 있는지 확인한다.
  - 흔한 문제/주의: 뉴스 기반 read-through와 동종 peer를 섞으면 peer 품질이 떨어진다.
- 2-2 목적: SNOW 예시를 실제 데이터 경로에 태운다.
  - 설명: 수동 curated text라도 enrichment table에 저장하고 API로 읽는다.
  - 완료 조건(눈으로 확인): SNOW API 응답에 강화 description이 들어 있다.
  - 사람 검증(비개발자): SNOW hover에서 짧은 UI 버전이 보이는지 확인한다.
  - 흔한 문제/주의: raw description과 강화 description을 같은 label로 보여주면 혼동된다.
- 2-3 목적: 한 종목 전용 포맷이 아닌지 검증한다.
  - 설명: 하드웨어/서버 계열 DELL/HPE/SMCI에도 같은 schema가 맞는지 확인한다.
  - 완료 조건(눈으로 확인): 세 종목 모두 peer category가 생성된다.
  - 사람 검증(비개발자): DELL과 SMCI의 관계가 `core`인지 `read-through`인지 구분되어 보인다.
  - 흔한 문제/주의: 한 섹터 안에서도 customer/supplier/competitor를 분리해야 한다.

검증 훅:
```powershell
Set-Location "c:\github_coding\terminal_sec"
Invoke-RestMethod -Uri "http://localhost:8080/api/company-profiles/SNOW" | ConvertTo-Json -Depth 8
Invoke-RestMethod -Uri "http://localhost:8080/api/calendar/events?type=earnings&tickers=SNOW&limit=1" | ConvertTo-Json -Depth 8
```
사용자 확인 필요: **예**

#### ⬜ Step 3 — Backend API 병합

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | `/api/company-profiles/:ticker` 응답에 enrichment 필드를 추가한다 | `terminal/backend/src/server.ts`, repository | SNOW API 응답 확인 | ⬜ |
| 3-2 | Calendar metadata 조회에 짧은 강화 설명과 peer groups를 추가한다 | `terminal/backend/src/services/calendarRepository.ts` | Calendar events API 확인 | ⬜ |
| 3-3 | 기존 raw peers 배열은 fallback/source evidence로 보존한다 | repository/API type | raw와 curated 동시 존재 확인 | ⬜ |

- 3-1 목적: hover popup이 강화 description을 받을 수 있게 한다.
  - 설명: raw provider field와 enrichment field를 함께 내려준다.
  - 완료 조건(눈으로 확인): API JSON에 `enhanced_description` 또는 동등 필드가 있다.
  - 사람 검증(비개발자): 브라우저 개발자 도구 없이도 curl 결과에서 새 필드를 볼 수 있다.
  - 흔한 문제/주의: 기존 frontend가 모르는 필드를 받아도 깨지지 않아야 한다.
- 3-2 목적: Calendar row 자체에서도 강화 설명/peer groups를 쓸 수 있게 한다.
  - 설명: 이벤트 목록 조회 시 ticker metadata에 enrichment를 조인한다.
  - 완료 조건(눈으로 확인): Calendar API item에 짧은 description과 peer groups가 있다.
  - 사람 검증(비개발자): Calendar Window에서 SNOW row를 열었을 때 새 내용이 노출된다.
  - 흔한 문제/주의: 목록 API가 느려지면 hover에서만 lazy fetch하는 대안이 필요하다.
- 3-3 목적: provider 원문과 curated 결과의 감사 가능성을 유지한다.
  - 설명: Finnhub/FMP peers는 raw candidate로 남기고, curated group을 별도로 보여준다.
  - 완료 조건(눈으로 확인): API에 raw peers와 curated peers가 구분되어 있다.
  - 사람 검증(비개발자): provider가 준 이상한 peer가 왜 제외됐는지 볼 수 있다.
  - 흔한 문제/주의: raw peers를 숨기면 데이터 품질 문제를 추적하기 어렵다.

검증 훅:
```powershell
Set-Location "c:\github_coding\terminal_sec\terminal\backend"
npm.cmd run build
Set-Location "c:\github_coding\terminal_sec"
Invoke-RestMethod -Uri "http://localhost:8080/api/company-profiles/SNOW" | ConvertTo-Json -Depth 8
```
사용자 확인 필요: **예**

#### ⬜ Step 4 — Frontend 표시 개선

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | `CompanyProfileData` 타입에 enrichment/peer groups를 추가한다 | `companyDescription.ts` | frontend build | ⬜ |
| 4-2 | hover popup에 짧은 강화 설명과 핵심 체크 포인트를 표시한다 | `CompanyDescriptionHoverPreview.tsx` | 브라우저 hover 확인 | ⬜ |
| 4-3 | Calendar peers column을 category chip으로 개선한다 | `CalendarWindow.tsx` | Calendar row 렌더링 확인 | ⬜ |

- 4-1 목적: frontend가 새 API 필드를 안전하게 읽게 한다.
  - 설명: null-safe parsing과 cache 정책을 업데이트한다.
  - 완료 조건(눈으로 확인): 타입에 강화 description/peer groups 필드가 있다.
  - 사람 검증(비개발자): 화면에서 기존 원문 설명도 계속 볼 수 있다.
  - 흔한 문제/주의: cache가 description만 있을 때 반환하면 새 enrichment가 늦게 반영될 수 있다.
- 4-2 목적: hover에서 길지 않지만 정보량 높은 설명을 보여준다.
  - 설명: SNOW 기준 짧은 UI 버전을 상단에 보여주고 raw description은 접거나 하단에 둔다.
  - 완료 조건(눈으로 확인): hover에 `무엇을 파는지`, `실적 체크 포인트`, `주요 리스크`가 보인다.
  - 사람 검증(비개발자): SNOW hover를 보고 어떤 숫자를 봐야 하는지 알 수 있다.
  - 흔한 문제/주의: hover가 너무 커져 Calendar table을 가리면 별도 detail view가 필요하다.
- 4-3 목적: peers를 정확한 맥락으로 읽게 한다.
  - 설명: `Core`, `Adjacent`, `Read-through`, `Weak` 같은 label을 붙인다.
  - 완료 조건(눈으로 확인): SNOW row에서 MDB와 AMZN/MSFT가 같은 그룹으로 보이지 않는다.
  - 사람 검증(비개발자): provider raw peers와 curated peers 차이를 이해할 수 있다.
  - 흔한 문제/주의: 너무 많은 chip을 한 줄에 표시하면 가독성이 떨어진다.

검증 훅:
```powershell
Set-Location "c:\github_coding\terminal_sec\termina_web\figma_code\terminal_ui_ver2_finhub"
npm.cmd run build
# dev 서버에서 http://localhost:5173/ 접속 후 Calendar Window의 SNOW ticker hover 확인
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. 저장 구조 결정
   - 선택지: 새 테이블 / 기존 `company_profiles` 컬럼 추가
   - 차단 대상 Step: 1, 2, 3
   - 권장: 새 테이블
2. 생성 범위 결정
  - 선택지: Calendar 로드 ticker만 / default universe 전체 / watchlist별 / default universe 전체 중 AI-tech 1차 batch 우선
   - 차단 대상 Step: 2 이후 batch 운영
  - 권장: default universe 전체 중 AI-tech 1차 batch 우선
3. UI 표시 밀도 결정
   - 선택지: hover에 짧은 버전만 / hover+detail modal / Calendar row inline 확장
   - 차단 대상 Step: 4
   - 권장: hover 짧은 버전 + raw 접기
4. 비상장 peer 표시 결정
   - 선택지: Databricks 같은 비상장 peer 표시 / 상장 ticker만 표시
   - 차단 대상 Step: peer UI
   - 권장: 비상장도 text chip으로 표시하되 ticker와 구분

### 실행 의존성 그래프

범례: `✅` 사용자 확인 완료 / `⏳` 작성 또는 구현 완료 후 사용자 확인 대기 / `⬜` 미착수 / `🚫` 차단

```text
트랙 A — 요구사항/샘플 품질
  ⏳ Step 0 요구사항/샘플 포맷 확정
    ⏳ 0-1 SNOW 현재 데이터 확인
    ⏳ 0-2 강화 description 필수 항목 정의
    ⏳ 0-3 SNOW 예시 작성
    ⏳ 0-4 default universe industry 큐 작성

트랙 B — 저장/API 기반
  ⬜ Step 1 Enrichment 저장 구조 설계
    ⬜ 1-1 enrichment 스키마 초안 확정
    ⬜ 1-2 repository 인터페이스 설계
    ⬜ 1-3 peer category JSON schema 정의

  ⬜ Step 2 샘플 생성 로직
    ⬜ 2-1 입력 builder 생성
    ⬜ 2-2 SNOW 강화 description 저장 경로 생성
    ⬜ 2-3 DELL/HPE/SMCI 샘플 생성

  ⬜ Step 3 Backend API 병합
    ⬜ 3-1 company profile API 응답 확장
    ⬜ 3-2 Calendar metadata 응답 확장
    ⬜ 3-3 raw peers fallback/source evidence 보존

트랙 C — Frontend 표시
  ⬜ Step 4 Frontend 표시 개선
    ⬜ 4-1 frontend type 확장
    ⬜ 4-2 hover popup 개선
    ⬜ 4-3 Calendar peers column category chip 개선

차단 구간
  ┌──────────────────────────────────────────────┐
  │ Step 1 이후는 저장 구조 결정 전에는 시작하지 않음 │
  │ Step 4는 API 응답 shape 확정 전에는 시작하지 않음 │
  └──────────────────────────────────────────────┘
```

병렬 트랙 요약:
- Step 0은 지금 작성/검토 가능한 샘플 품질 확정 트랙이다.
- Step 1~3은 backend 저장/API 트랙이며, 저장 구조 결정이 선행 조건이다.
- Step 4는 frontend 표시 트랙이며, API 응답 shape 확정 뒤 시작한다.

차단 요약 테이블:

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| 저장 구조 | Step 1~3 | 새 테이블 / 기존 컬럼 추가 |
| 생성 범위 | Step 2 batch 운영 | Calendar 로드 ticker / default universe / watchlist / AI-tech 1차 batch |
| UI 표시 밀도 | Step 4 | hover / detail modal / inline 확장 |
| 비상장 peer 표시 | Step 4 peer UI | 표시 / 숨김 |

### 결정 #1 — Description 강화 필드(상세)
권장 필드:
- `short_summary_ko`: hover 상단 2~4문장.
- `detailed_description_ko`: detail view 또는 확장 영역용 긴 설명.
- `products_services_json`: 실제 상품/서비스와 예시.
- `revenue_model_ko`: 돈을 어떻게 버는지.
- `earnings_watch_points_json`: 실적에서 볼 지표.
- `move_drivers_json`: 주가가 반응하는 요인.
- `risks_json`: 주요 반대 변수.
- `peer_groups_json`: category별 peer 목록과 이유.
- `source_notes_json`: 원문/AI/수동 검토 source 기록.

### 결정 #2 — SNOW 샘플 기준(상세)
SNOW 샘플은 다음 품질 기준을 충족해야 한다.
- `Cloud Data Warehouse` 같은 일반명만 쓰지 않고, Snowflake Data Cloud, virtual warehouse, Snowpark, Cortex AI, Streamlit, Snowpipe, data sharing/marketplace, clean room, Iceberg table 같은 구체 서비스를 언급한다.
- `AI boom 수혜`를 추상적으로 쓰지 않고, 기업 데이터 정리 → AI application/analytics workload 증가 → compute credit 사용량 증가 → product revenue 반영이라는 경로를 설명한다.
- peers는 Databricks, BigQuery/Redshift/Fabric 같은 직접 경쟁/플랫폼 경쟁과 MDB/CFLT/ESTC/PLTR 같은 상장 인접 비교를 분리한다.
