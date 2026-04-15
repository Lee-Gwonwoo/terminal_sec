### 목표

- `IPO calendar` 관련 별도 plan 폴더를 만들고, 현재 레포 기준으로 구현 가능한 범위를 먼저 고정한다.
- FMP `IPO Calendar`, `IPO Disclosure`, `IPO Prospectus`, SEC 등록서류, Yahoo profile/holders 데이터가 각각 무엇을 주는지 구분해서 정리한다.
- 특히 `[][][]industry[][][]`, 회사 설명, `[][][]institutional_pct[][][]`, `[][][]insider_pct[][][]`가 어디까지 가능한지 pre-IPO 관점에서 명확히 적는다.
- 이후 실제 `CalendarWindow`에 IPO 탭을 붙일 때, 어떤 필드는 기본 제공 가능하고 어떤 필드는 optional enrich 또는 별도 phase로 빼야 하는지 계획으로 남긴다.

### PLAN CHANGE — 2026-04-15 phase 1 구현 상태 업데이트

- 아래 초기 계획 문서는 조사 중심으로 시작했지만, 현재는 phase 1 구현이 실제 코드에 반영된 상태다.
- 구현 완료 범위
  - backend IPO direct source 추가
    - `terminal/backend/src/services/fmpIpoCalendarProvider.ts`
    - `POST /api/fmp/calendar/ipos/update`
  - backend SEC enrich 저장/파싱 추가
    - `terminal/backend/src/services/ipoSecEnrichmentRepository.ts`
    - `terminal/backend/src/services/ipoSecInsights.ts`
    - `ipo_sec_enrichments` table
    - `POST /api/fmp/calendar/ipos/sec-download`
  - calendar API IPO 확장
    - `GET /api/calendar/events`에서 `ipos` type + IPO direct field + SEC-derived field 반환
  - frontend IPO 탭 추가
    - `CalendarWindow.tsx`에서 IPO tab, column selector, `Update FMP IPO`, `Download SEC Data` 버튼, SEC column 렌더링 추가
- 현재 검증 완료 결과
  - backend build 성공
  - frontend build 성공
  - backend test `91/91` 통과
  - live `POST /api/fmp/calendar/ipos/update` 성공
    - `fetchedRows=21`, `upsertedRows=21`
  - live `GET /api/calendar/events?type=ipos`에서 `RIKU`, `ELMT`, `NHP` 등 실제 IPO row 확인
- 현재 남은 runtime 한계
  - `POST /api/fmp/calendar/ipos/sec-download` route와 UI 버튼은 동작한다.
  - 다만 `2026-04-15~2026-04-24` 샘플 검증에서는 `enrichedRows=0`이었다.
  - 결과값:
    - `rows=21`
    - `disclosures=31003`
    - `prospectuses=898`
    - `genericFilings=0`
    - `descriptionRows=0`
    - `ownershipRows=0`
  - 즉 현재 phase 1은 “SEC enrich pipeline/저장소/UI는 구현 완료” 상태이고, “실제 sample future IPO row에 문서가 안정적으로 매칭되는지”는 추가 개선 후보로 남아 있다.

### 현재 레포 상태(중요, 확인됨)

- backend calendar read/query 구조는 이미 일반형 `calendar_events` 테이블과 `GET /api/calendar/events`를 중심으로 존재한다.
- 현재 calendar 실구현은 `earnings/dividends/splits/ipos`를 포함하며, IPO 전용 provider/SEC enrich route까지 추가된 상태다.
- FMP company profile 경로는 이미 있다.
  - `terminal/backend/src/services/fmpCompanyProfileProvider.ts`
  - 확인된 필드: `description`, `sector`, `industry`, `website`, `ipoDate`, `mktCap`
- Yahoo company profile 경로도 이미 있다.
  - `terminal/backend/src/services/yahooCompanyProfileProvider.ts`
  - `quoteSummary(symbol, { modules: ["assetProfile"] })` 기반
  - 확인된 필드: `longBusinessSummary`, `sector`, `industry`, `website`
- Yahoo ownership 경로도 이미 있다.
  - `terminal/backend/src/services/yahooOwnershipProvider.ts`
  - `quoteSummary(symbol, { modules: ["majorHoldersBreakdown"] })` 기반
  - 확인된 필드: `institutionsPercentHeld`, `insidersPercentHeld` 계열을 `institutionalPct`, `insiderPct`로 정규화
- 현재 calendar enrich는 `securities` + `company_profiles`를 기준으로 붙는다.
  - `industry`는 `securities.industry`
  - `institutional_pct`는 `company_profiles` 중 `institutional_source = 'yahoo'`인 값을 우선 사용
  - `insider_pct`는 `company_profiles`의 최신 insider 값 사용
- 현재 IPO 구현은 위 기존 ticker metadata join을 그대로 재사용한다.
  - `name`, `exchange`, `sector`, `industry`, `market_cap`, `float_pct`, `institutional_pct`, `insider_pct`는 기존 calendar metadata 경로에서 붙는다.
  - `company_description`은 현재 별도 IPO profile pull이 아니라 `ipo_sec_enrichments.company_description` 우선으로 채운다.
- 따라서 레포 구조상 `listed ticker`가 존재하고 profile/holders source가 응답하면 Yahoo/FMP enrich는 가능하다.
- 반대로 `true pre-IPO`처럼 아직 Yahoo quote 대상 ticker가 없거나 holders module이 비어 있으면, Yahoo 기반 ownership/profile enrich는 신뢰할 수 없다.
- 현재 IPO 전용 구현 요소는 아래와 같다.
  - `terminal/backend/src/services/fmpIpoCalendarProvider.ts`
  - `terminal/backend/src/services/ipoSecEnrichmentRepository.ts`
  - `terminal/backend/src/services/ipoSecInsights.ts`
  - `terminal/backend/src/db.ts`의 `ipo_sec_enrichments`
  - `terminal/backend/src/server.ts`의 IPO update / SEC download route
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`의 IPO tab/UI

### 제약 / 비범위

- 이 문서는 초기에는 `plan 폴더 생성 + 데이터 가능 범위 정리` 목적이었지만, 현재는 구현 상태까지 함께 추적하는 작업 계획 문서로 사용한다.
- 실제 FMP/Yahoo live entitlement probe는 이번 문서 작업의 필수 범위가 아니다. 문서/현재 repo code/일반 규제 구조를 근거로 정리한다.
- SEC 등록서류에 보이는 principal shareholders / beneficial ownership 표를 현재 app의 `[][][]institutional_pct[][][]`, `[][][]insider_pct[][][]`와 같은 의미로 즉시 합치지 않는다.
- `IPO calendar` phase 1에서는 `industry`, 회사 설명, ownership을 "기본 제공"으로 가정하지 않는다.
- 현재 구현도 위 원칙을 따른다.
  - `institutional_pct`, `insider_pct`는 기존 public-holder/Yahoo 성격의 optional metadata다.
  - SEC download 결과는 `sec_owner_count`, `sec_max_owner_pct`, `sec_total_owner_pct` 같은 별도 컬럼으로만 노출한다.

### 읽는 방법(비개발자/일반인 기준)

- `현재 레포 상태`를 보면 지금 앱이 이미 가지고 있는 Yahoo/FMP 데이터 경로가 무엇인지 알 수 있다.
- `결정/선행조건`은 실제 구현 전 반드시 고정해야 하는 규칙이다.
- `단계별 계획`은 이후 IPO calendar 구현을 어떤 순서로 진행할지 보여준다.
- `결정 상세`는 특히 Yahoo ownership과 SEC ownership을 왜 같은 것으로 다루면 안 되는지 설명한다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- 먼저 데이터 source별 의미를 고정한다.
- 다음으로 `calendar_events`에 어떤 필드만 phase 1에 넣을지 결정한다.
- 구현이 시작되면 같은 폴더의 `agent_log.md`에 append 방식으로 기록한다.
- 각 Step은 `구현 -> 검증 -> 사용자 확인` 순서로 진행한다.
- 사용자 확인 전 상태는 `⏳`, 사용자 확인 후만 `✅`로 올린다.
- 범위가 바뀌면 기존 내용을 삭제하지 말고 `PLAN CHANGE`로 추가한다.

### 아키텍처(상위)

- source 분리 관점의 상위 구조
  1. FMP `IPO Calendar`는 IPO 일정과 거래소, 상태, 가격대, shares 같은 event-level 정보를 준다.
  2. FMP `IPO Disclosure` / `IPO Prospectus`는 SEC filing 메타와 공모 구조 정보를 준다.
  3. SEC 원문은 사업 설명, risk, capital structure, principal shareholders 표를 담을 수 있다.
  4. Yahoo `assetProfile`은 ticker 기반 회사 설명/industry를 줄 수 있다.
  5. Yahoo `majorHoldersBreakdown`은 ticker 기반 institutional / insider held percent를 줄 수 있다.
  6. backend는 이들을 `calendar_events` top-level + `meta_json` + `company_profiles` enrich로 나눠 보관해야 한다.

#### IPO calendar에 기본적으로 기대할 수 있는 것

- `[][][]symbol[][][]`
- `[][][]date[][][]`
- `[][][]company[][][]`
- `[][][]exchange[][][]`
- `[][][]actions[][][]`
- `[][][]shares[][][]`
- `[][][]priceRange[][][]`
- `[][][]marketCap[][][]`

#### IPO calendar에 기본적으로 기대하면 안 되는 것

- `[][][]industry[][][]` direct field
- 회사 설명 direct field
- `[][][]institutional_pct[][][]` direct field
- `[][][]insider_pct[][][]` direct field

### 참고 스크린샷 기준 필드 매핑 (2026-04-15 live FMP 확인)

- 사용자가 첨부한 참고 화면의 주요 컬럼/탭을 live FMP endpoint와 대조한 결과는 아래와 같다.
- 이번 확인에는 실제 FMP key로 `ipos-calendar`, `ipos-disclosure`, `ipos-prospectus`를 호출해 field name과 sample row를 점검했다.

| 스크린샷 항목 | 확인 결과 | FMP source | 메모 |
|------|------|------|------|
| `Company Name` | 직접 가능 | `ipos-calendar.company` | live sample과 직접 일치 |
| `Ticker` | 직접 가능 | `ipos-calendar.symbol` | live sample과 직접 일치 |
| `Exchange` | 직접 가능 | `ipos-calendar.exchange` | live sample과 직접 일치 |
| `IPO Date` | 직접 가능 | `ipos-calendar.date` | live sample과 직접 일치 |
| `Price` | 직접 가능 | `ipos-calendar.priceRange` | 예: `4.00 - 6.00` |
| `Shares` | 직접 가능 | `ipos-calendar.shares` | 정수/수량 값 |
| `Offer Amount` | 사실상 직접 가능 | `ipos-calendar.marketCap` | 첨부 화면의 `RIKU = $34.50M`이 live `marketCap=34500000`와 정확히 일치했다. 이름은 `Offer Amount`로 보이지만 FMP field name은 `marketCap`이다 |
| `Managers` | 직접 확인 불가 | 없음(현재 확인 범위) | live `ipos-calendar`, `ipos-disclosure`, `ipos-prospectus` structured field에는 manager/underwriter 컬럼이 없었다. 필요하면 SEC 원문 파싱 또는 다른 source 검토 필요 |
| `Upcoming` 탭 | 직접 가능 | `ipos-calendar.actions = Expected` | live upcoming range에서 `Expected` 확인 |
| `Priced` 탭 | 직접 가능 | `ipos-calendar.actions = Priced` | live past range에서 `Priced` 확인 |
| `Filings` 탭 | 직접 가능 또는 별도 source | `ipos-calendar.actions = Filed` 또는 `ipos-disclosure` | live past range에서 `Filed` 확인, filing detail은 `ipos-disclosure`가 더 직접적 |
| `Withdrawn` 탭 | 미확인 | 미확인 | sampled live ranges에서는 `Withdrawn` action을 아직 보지 못했다. endpoint가 지원할 수는 있으나 현재는 검증 전 |

#### live 확인에서 실제로 본 action 값

- `Expected`
- `Filed`
- `Priced`
- `Amended`

#### prospectus endpoint에서 직접 확인된 structured field

- `[][][]symbol[][][]`
- `[][][]acceptedDate[][][]`
- `[][][]filingDate[][][]`
- `[][][]ipoDate[][][]`
- `[][][]cik[][][]`
- `[][][]pricePublicPerShare[][][]`
- `[][][]pricePublicTotal[][][]`
- `[][][]discountsAndCommissionsPerShare[][][]`
- `[][][]discountsAndCommissionsTotal[][][]`
- `[][][]proceedsBeforeExpensesPerShare[][][]`
- `[][][]proceedsBeforeExpensesTotal[][][]`
- `[][][]form[][][]`
- `[][][]url[][][]`

- 이 결과로 볼 때, screenshot의 `Managers`는 current FMP structured response만으로는 재현 근거가 없다.
- 반면 `Offer Amount`는 live 값 기준 `ipos-calendar.marketCap`으로 재현 가능성이 높다.

#### Yahoo/FMP enrich가 가능한 조건

- 공통 전제: 시장에서 해석 가능한 `ticker symbol`이 이미 있어야 한다.
- FMP profile enrich 조건
  - 해당 symbol에 대해 `/stable/profile?symbol=`가 응답해야 한다.
- Yahoo profile enrich 조건
  - `quoteSummary(symbol, { modules: ["assetProfile"] })`가 응답해야 한다.
- Yahoo ownership enrich 조건
  - `quoteSummary(symbol, { modules: ["majorHoldersBreakdown"] })`가 응답해야 한다.
- 위 조건이 성립하지 않으면 IPO row는 `company/exchange/date/actions` 중심의 기본 정보만 보여주는 쪽이 안전하다.

### 결정/선행조건(초기에 확정 필요)

| 결정 ID | 내용 | 기본값 | 이유 |
|---------|------|--------|------|
| D1 | IPO phase 1의 canonical source | `FMP IPO Calendar` | 일정/상태/거래소/가격대 등 event 기본축이 가장 명확하기 때문 |
| D2 | 회사 설명/industry enrich 우선순위 | `phase 1 현재값: SEC-derived description + 기존 metadata join` | 현재 구현은 별도 IPO profile sync 없이 SEC description과 기존 `securities/company_profiles` metadata를 재사용하기 때문 |
| D3 | Yahoo ownership 사용 규칙 | `listed ticker + holders module 존재 시에만 optional enrich` | Yahoo ownership은 ticker 기반 public holders 데이터라 pre-IPO에서는 비어 있을 가능성이 높기 때문 |
| D4 | SEC principal shareholders 표 처리 | `current ownership 컬럼과 분리` | beneficial owners/management 표와 post-listing institutional/insider pct는 의미가 다르기 때문 |
| D5 | symbol 없는 IPO row key 전략 | `company + exchange + date` fallback 허용 | pre-IPO row는 symbol이 없거나 변경될 수 있기 때문 |
| D6 | phase 1 UI 기본 컬럼 | `IPO Date, Symbol, Company, Exchange, Status, Shares, Price Range, Market Cap` | source 직접 필드만으로 안정적 표 구성이 가능하기 때문 |

### 계획 중간 필수 확인

- 실제 FMP live key에서 `ipos-calendar`, `ipos-disclosure`, `ipos-prospectus` entitlement가 모두 열려 있는지 확인해야 한다.
- upcoming IPO row 중 실제로 Yahoo/FMP profile lookup이 붙는 symbol 비율을 샘플로 확인해야 한다.
- Yahoo `majorHoldersBreakdown`이 IPO 예정 ticker들에 대해 얼마나 자주 비어 있는지 실측해야 한다.
- SEC principal shareholders 표를 future detail panel에 넣고 싶다면, 현재 `institutional_pct` / `insider_pct`와 분리된 schema가 필요한지 결정해야 한다.

### 제안하는 구현 순서(이유)

- 먼저 조사/규칙을 고정해야 한다.
  - 이유: IPO는 `ticker가 없는 row`, `SEC 원문은 있으나 normalized holder %는 없는 row`, `listed ticker가 생긴 뒤에야 Yahoo/FMP enrich가 되는 row`가 섞여 있기 때문이다.
- 그 다음 backend data model을 설계해야 한다.
  - 이유: top-level event와 optional enrich를 분리하지 않으면 IPO row 품질이 들쭉날쭉해진다.
- 마지막에 frontend tab과 detail panel을 붙이는 것이 안전하다.
  - 이유: UI는 기본 컬럼과 optional enrich를 명확히 구분해서 보여줘야 하기 때문이다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 0 — 조사 결과와 source 경계 고정

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | FMP IPO Calendar / Disclosure / Prospectus가 직접 주는 필드를 정리한다 | ⏳ |
| 0-2 | SEC 등록서류의 principal shareholders / beneficial ownership 공시 성격을 정리한다 | ⏳ |
| 0-3 | Yahoo `assetProfile` / `majorHoldersBreakdown`가 pre-IPO에 왜 불안정한지 repo 기준으로 정리한다 | ⏳ |

- `0-1`
  - 목적: IPO 기본 row에서 안정적으로 쓸 수 있는 direct field를 고정한다.
  - 설명: `symbol/date/company/exchange/actions/shares/priceRange/marketCap` 같은 direct field와 optional field를 분리하면 된다.
  - 완료 조건(눈으로 확인): 이 plan 문서에서 source별 가능/불가능 필드가 구분돼 있다.
  - 사람 검증(비개발자): `IPO calendar에 기본적으로 기대할 수 있는 것`과 `기대하면 안 되는 것` 섹션을 읽어 구분이 보이면 된다.
  - 흔한 문제/주의: calendar sample field와 disclosure/prospectus field를 섞어 쓰면 설계가 꼬인다.
- `0-2`
  - 목적: SEC 표에 나오는 ownership과 현재 앱 ownership 컬럼의 의미 차이를 고정한다.
  - 설명: beneficial owners / management ownership 표는 존재할 수 있지만, 이를 바로 `institutional_pct`로 간주하지 않으면 된다.
  - 완료 조건(눈으로 확인): `D4`와 `결정 상세`에서 분리 규칙이 명시돼 있다.
  - 사람 검증(비개발자): `SEC principal shareholders 표 처리` 기본값이 분리로 적혀 있는지 보면 된다.
  - 흔한 문제/주의: 상장 전 지분표를 post-listing public holders 요약으로 오해하면 안 된다.
- `0-3`
  - 목적: Yahoo enrich를 optional로만 쓰는 이유를 고정한다.
  - 설명: Yahoo는 `symbol` 기반 quote page/module이 있어야 하므로 pre-IPO private issuer에는 적용률이 낮을 수 있다.
  - 완료 조건(눈으로 확인): `Yahoo ownership 사용 규칙`이 listed ticker 전제로 적혀 있다.
  - 사람 검증(비개발자): `D3`의 기본값 설명을 읽으면 된다.
  - 흔한 문제/주의: symbol이 있다고 바로 holders module이 있는 것은 아니다.

검증 훅:

```text
- repo audit: terminal/backend/src/services/fmpCompanyProfileProvider.ts
- repo audit: terminal/backend/src/services/yahooCompanyProfileProvider.ts
- repo audit: terminal/backend/src/services/yahooOwnershipProvider.ts
- external audit: FMP IPO Calendar / IPO Disclosure / IPO Prospectus docs
- external audit: eCFR 17 CFR 229.403
사용자 확인 필요: **예**
```

#### ⏳ Step 1 — backend 데이터 모델 설계

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | `calendar_events` IPO row의 top-level / `meta_json` 경계를 확정한다 | `terminal/backend/src/services/calendarRepository.ts` | 구현 코드 + API payload 비교 | ⏳ |
| 1-2 | symbol 없는 row를 위한 fallback unique key 규칙을 설계한다 | `terminal/backend/src/services/calendarRepository.ts` | live unique key sample 확인 | ⏳ |
| 1-3 | optional enrich field(`industry`, 회사 설명, ownership)의 source precedence를 확정한다 | `terminal/backend/src/services/calendarRepository.ts` | code path 점검 | ⏳ |

- `1-1`
  - 목적: direct event field와 optional enrich를 섞지 않게 한다.
  - 설명: phase 1은 FMP IPO direct field 중심으로 두고 optional enrich는 null 허용으로 설계하면 된다.
  - 완료 조건(눈으로 확인): field map 표가 작성되어 있다.
  - 사람 검증(비개발자): `IPO Date / Company / Exchange / Status`가 기본, `industry / ownership`이 optional로 구분돼 있으면 된다.
  - 흔한 문제/주의: direct source가 아닌 값을 기본 필수 컬럼으로 두면 row 누락이 늘어난다.
- `1-2`
  - 목적: symbol이 없거나 바뀌는 IPO row를 안전하게 저장한다.
  - 설명: `company + exchange + date` fallback이 필요하다.
  - 완료 조건(눈으로 확인): key 예시가 문서에 적혀 있다.
  - 사람 검증(비개발자): symbol 없는 경우에도 row를 식별하는 규칙이 적혀 있으면 된다.
  - 흔한 문제/주의: future ticker assignment로 row 중복이 생기지 않게 주의해야 한다.
- `1-3`
  - 목적: 같은 row에 FMP/Yahoo/SEC 값을 어떤 순서로 붙일지 정한다.
  - 설명: 현재 구현은 `calendar_events direct -> ipo_sec_enrichments(company_description + SEC ownership) -> 기존 securities/company_profiles metadata` 순으로 나뉜다.
  - 완료 조건(눈으로 확인): source precedence가 표로 정리돼 있다.
  - 사람 검증(비개발자): 같은 정보가 여러 source에 있을 때 어느 쪽을 믿는지 보이면 된다.
  - 흔한 문제/주의: SEC 원문 파싱값을 ownership pct canonical에 섞지 않는다.

검증 훅:

```text
- field map 문서 검토
- unique key 예시 검토
- source precedence 표 검토
사용자 확인 필요: **예**
```

#### ⏳ Step 2 — backend provider / enrich 구현

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | FMP IPO calendar provider 및 ingest route를 추가한다 | `terminal/backend/src/services/*`, `terminal/backend/src/server.ts` | live sample range update 후 row count 확인 | ⏳ |
| 2-2 | IPO row에 optional metadata / SEC description enrich를 붙인다 | `terminal/backend/src/services/calendarRepository.ts`, `terminal/backend/src/services/ipoSecInsights.ts` | API response에서 direct/null case 확인 | ⏳ |
| 2-3 | ownership은 기존 Yahoo metadata와 SEC-derived 값을 분리해 노출한다 | `terminal/backend/src/services/calendarRepository.ts`, `terminal/backend/src/services/ipoSecEnrichmentRepository.ts` | null 유지 + 분리 컬럼 확인 | ⏳ |

- `2-1`
  - 목적: IPO 기본 row를 DB에 적재한다.
  - 설명: FMP `ipos-calendar`를 90일 chunk 기준으로 가져와 정규화하면 된다.
  - 완료 조건(눈으로 확인): API에서 IPO row가 조회된다.
  - 사람 검증(비개발자): 화면이나 API에서 IPO 날짜/회사명/거래소가 보이면 된다.
  - 흔한 문제/주의: symbol 없는 row와 null shares/priceRange를 정상 저장해야 한다.
- `2-2`
  - 목적: 가능한 경우에만 설명/industry를 붙인다.
  - 설명: 현재 구현은 별도 IPO profile sync를 추가하지 않고, 기존 `securities/company_profiles` metadata join + SEC description enrich를 사용한다. description은 현재 SEC pipeline 기준으로만 채워진다.
  - 완료 조건(눈으로 확인): 어떤 row는 industry/description이 있고 어떤 row는 비어 있어도 정상으로 취급된다.
  - 사람 검증(비개발자): 같은 IPO 목록에서 일부 row만 추가 정보가 붙어도 오류가 아니면 된다.
  - 흔한 문제/주의: enrich 실패를 row 전체 실패로 처리하면 안 된다.
- `2-3`
  - 목적: ownership을 optional로 붙인다.
  - 설명: Yahoo `majorHoldersBreakdown` 기반 `institutional_pct` / `insider_pct`는 기존 metadata join을 그대로 재사용하고, SEC ownership은 `sec_*` 별도 컬럼으로만 보여준다.
  - 완료 조건(눈으로 확인): listed ticker에는 값이 생길 수 있고 pre-IPO row는 null 유지 가능하다.
  - 사람 검증(비개발자): ownership이 비어 있어도 IPO row가 사라지지 않으면 된다.
  - 흔한 문제/주의: ownership null을 “오류”로 잘못 해석하면 안 된다.

검증 훅:

```text
- backend build
- backend test
- sample IPO update API 호출
- IPO events API 응답 점검 (filled/null enrich case)
사용자 확인 필요: **예**
```

#### ⏳ Step 3 — frontend IPO 탭 / detail UX 구현

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | `CalendarWindow`에 IPO 탭과 기본 컬럼을 추가한다 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx` | build + live API 연결 확인 | ⏳ |
| 3-2 | optional enrich field를 별도 column/detail로 노출한다 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx` | column selector / API payload 비교 | ⏳ |
| 3-3 | ownership이 없는 pre-IPO row 안내 문구를 반영한다 | same | IPO info banner 확인 | ⏳ |

- `3-1`
  - 목적: IPO 기본 정보를 화면에 노출한다.
  - 설명: phase 1은 direct field만으로도 usable table을 만든다.
  - 완료 조건(눈으로 확인): IPO row가 날짜/회사/거래소/상태 중심으로 보인다.
  - 사람 검증(비개발자): 표에서 IPO 일정이 보이면 된다.
  - 흔한 문제/주의: earnings/dividends와 같은 column assumptions를 IPO에 그대로 적용하면 안 된다.
- `3-2`
  - 목적: optional enrich를 "있으면 표시, 없으면 비움"으로 보여준다.
  - 설명: industry/description/ownership은 direct IPO data가 아님을 UI에서도 드러내야 한다.
  - 완료 조건(눈으로 확인): 기본 컬럼과 optional 컬럼이 구분된다.
  - 사람 검증(비개발자): 어떤 행은 설명/industry가 비어 있어도 화면이 정상이다.
  - 흔한 문제/주의: optional null을 placeholder text 남발로 가리지 않는다.
- `3-3`
  - 목적: Yahoo ownership 불가 row를 오해하지 않게 한다.
  - 설명: 현재 구현은 IPO info banner에 “SEC ownership fields are separate from post-listing public holders data”를 명시한다.
  - 완료 조건(눈으로 확인): ownership 비어 있는 이유가 사용자가 이해 가능하다.
  - 사람 검증(비개발자): 왜 값이 비어 있는지 안내가 있으면 된다.
  - 흔한 문제/주의: "데이터 오류"처럼 보이는 UX를 피해야 한다.

검증 훅:

```text
- frontend build
- 브라우저에서 IPO tab 시각 확인
- API response와 table column 매칭 확인
사용자 확인 필요: **예**
```

#### ⏳ Step 4 — 문서 동기화와 acceptance 정리

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | backend/frontend prompt 문서를 IPO 동작에 맞게 동기화한다 | `terminal/backend_prompt.md`, `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서 field list와 code 비교 | ⏳ |
| 4-2 | plan/log에 최종 구현/검증 내역을 남긴다 | `ai_agent_plan/ipo_calendar_scope/plan.md`, `ai_agent_plan/ipo_calendar_scope/agent_log.md` | append 기록 확인 | ⏳ |

- `4-1`
  - 목적: 코드와 문서가 드리프트하지 않게 한다.
  - 설명: direct IPO field와 optional enrich semantics를 문서화하면 된다.
  - 완료 조건(눈으로 확인): prompt 문서에 IPO field와 null 허용 규칙이 적혀 있다.
  - 사람 검증(비개발자): 문서만 읽고도 왜 ownership이 비어 있을 수 있는지 이해 가능하다.
  - 흔한 문제/주의: FMP direct field와 Yahoo enrich field를 같은 source처럼 쓰지 않는다.
- `4-2`
  - 목적: 작업 이력과 검증 결과를 남긴다.
  - 설명: plan/log에 구현과 검증을 남기면 후속 유지보수가 쉬워진다.
  - 완료 조건(눈으로 확인): log가 파일 맨 아래에 append 되어 있다.
  - 사람 검증(비개발자): 마지막 로그에 변경 파일과 검증 결과가 보이면 된다.
  - 흔한 문제/주의: 구현만 하고 문서를 안 바꾸면 다음 작업에서 혼선이 생긴다.

검증 훅:

```text
- backend/frontend prompt 문서 grep 확인
- plan/log append 확인
사용자 확인 필요: **예**
```

### 구현 중 확정된 사항 / 남은 선택지

| ID | 내용 | 선택지 | 차단 대상 Step |
|----|------|--------|----------------|
| U1 | SEC principal shareholders 표를 UI에 어떻게 반영할지 | `현재 결정: 별도 SEC 컬럼으로 유지`, `후보: detail panel 확장` | 후속 고도화 |
| U2 | IPO phase 1에서 회사 설명 source를 무엇으로 우선할지 | `현재 결정: SEC-derived description`, `후보: FMP/Yahoo profile auto sync 추가` | 후속 고도화 |
| U3 | ownership unavailable row 안내 문구 형태 | `현재 결정: IPO info banner`, `후보: tooltip/detail 보강` | 후속 고도화 |

### 실행 의존성 그래프

Legend: `✅ 사용자 확인 완료` / `⏳ 구현 또는 조사 완료, 사용자 확인 대기` / `⬜ 미착수` / `🚫 차단`

트랙 A — 조사/규칙 고정

- ⏳ 0-1 FMP IPO source field 정리
- ⏳ 0-2 SEC ownership 공시 성격 정리
- ⏳ 0-3 Yahoo profile/holders 적용 범위 정리
- ⏳ 1-1 IPO top-level / meta_json 경계 확정
- ⏳ 1-2 symbol 없는 row key 전략 확정
- ⏳ 1-3 source precedence 확정

트랙 B — 구현

- ⏳ 2-1 FMP IPO ingest/provider 구현
- ⏳ 2-2 metadata / SEC description enrich 구현
- ⏳ 2-3 Yahoo metadata + SEC ownership 분리 노출 구현
- ⏳ 3-1 IPO tab 기본 컬럼 구현
- ⏳ 3-2 optional enrich UI 구현
- ⏳ 3-3 ownership unavailable 안내 UX 구현
- ⏳ 4-1 prompt 문서 동기화
- ⏳ 4-2 plan/log 최종 기록

차단 배너

```text
⚠️ BLOCKED ZONE
- 현재 phase 1 구현은 `SEC 별도 컬럼 유지` + `SEC-derived description` 기준으로 고정되어 있다.
- 후속 작업에서만 detail panel 확장 또는 profile auto sync를 검토한다.
```

병렬 트랙 요약

- 트랙 A와 B의 phase 1 구현은 현재 코드 반영 및 검증까지 끝난 상태다.
- 다만 본 문서의 상태 표기는 사용자 확인 전이므로 `⏳`로 유지한다.
- 남은 핵심 후속 과제는 SEC future-IPO 문서 매칭 개선과 사용성 고도화다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| U1 | SEC ownership UI 노출 설계 | 현재: 별도 SEC 컬럼 / 후속: detail panel 확장 |
| U2 | description source precedence | 현재: SEC-derived description / 후속: FMP+Yahoo profile auto sync |
| U3 | ownership null UX | 현재: IPO info banner / 후속: tooltip 또는 detail 보강 |

### 결정 #1 — Yahoo ownership을 IPO row 기본 컬럼으로 둘지(상세)

- 기본 결론
  - **아니오.** Yahoo ownership은 IPO phase 1의 기본 컬럼이 아니라 optional enrich로만 취급한다.
- 이유
  - Yahoo provider는 ticker 기반 `quoteSummary` module 호출에 의존한다.
  - true pre-IPO는 아직 시장에서 안정된 ticker/quote page가 없을 수 있다.
  - ticker가 있더라도 `majorHoldersBreakdown`가 비어 있거나 post-listing 이후에야 의미 있는 값이 생길 수 있다.
  - 따라서 ownership null은 에러라기보다 정상적인 data availability 상태일 수 있다.

### 결정 #2 — SEC principal shareholders 표를 현재 ownership 컬럼으로 합칠지(상세)

- 기본 결론
  - **아니오.** SEC principal shareholders / beneficial owners 표는 current `[][][]institutional_pct[][][]`, `[][][]insider_pct[][][]`와 분리한다.
- 이유
  - SEC 등록서류의 표는 상장 전 cap table / beneficial ownership 공시 성격이다.
  - 현재 app의 ownership 컬럼은 Yahoo holders 기반 public-market summary 성격이다.
  - 두 값을 같은 이름으로 합치면 시점과 의미가 달라져 사용자가 오해하기 쉽다.
