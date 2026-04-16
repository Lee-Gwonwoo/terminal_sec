# agent_log

## 2026-04-15
**작성 시각:** 2026-04-15 16:40 (local)

### IPO calendar plan 폴더 생성 + Yahoo ownership 가능 범위 조사

- 작업 목적
  - `IPO calendar` 관련 별도 plan 폴더 생성
  - FMP IPO data / SEC 등록서류 / Yahoo profile/holders 기준으로 무엇이 가능한지 정리
  - 특히 pre-IPO에서 `industry`, 회사 설명, ownership 데이터를 어떻게 봐야 하는지 구분
- 생성 파일
  - `ai_agent_plan/ipo_calendar_scope/plan.md`
  - `ai_agent_plan/ipo_calendar_scope/agent_log.md`
- 확인한 근거
  - repo code
    - `terminal/backend/src/services/fmpCompanyProfileProvider.ts`
    - `terminal/backend/src/services/yahooCompanyProfileProvider.ts`
    - `terminal/backend/src/services/yahooOwnershipProvider.ts`
    - `terminal/backend/src/services/calendarRepository.ts`
  - external docs
    - FMP IPO Calendar / IPO Disclosure / IPO Prospectus docs
    - eCFR `17 CFR 229.403` (security ownership of certain beneficial owners and management)
    - Yahoo Finance holders page 구조 점검
- 핵심 결론
  - FMP IPO calendar direct field는 일정/회사/거래소/상태/가격대/shares/marketCap 중심이다.
  - SEC 등록서류에는 principal shareholders / beneficial ownership 표가 보통 있을 수 있다.
  - 다만 이는 pre-IPO cap table / management ownership 성격이며, 현재 app의 `institutional_pct` / `insider_pct`와 같은 의미로 바로 합치면 안 된다.
  - Yahoo는 `assetProfile`로 회사 설명/industry를, `majorHoldersBreakdown`로 institutional/insider held percent를 줄 수 있다.
  - 그러나 Yahoo는 ticker 기반 quoteSummary 호출 구조이므로, true pre-IPO에서는 symbol/holders module 부재로 인해 적용이 불안정하다.
  - 따라서 IPO phase 1에서 Yahoo ownership은 기본 필드가 아니라 optional enrich로 취급하는 것이 안전하다.
- 검증

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| plan 폴더 생성 | ✅ | `ai_agent_plan/ipo_calendar_scope` 생성 |
| plan 문서 작성 | ✅ | 목표, source 경계, 단계별 계획, Yahoo ownership 규칙 포함 |
| repo source audit | ✅ | FMP/Yahoo provider 및 calendar enrich 경로 확인 |
| external 근거 확인 | ✅ | FMP IPO docs + eCFR Item 403 + Yahoo holders page 구조 점검 |

- 상태
  - plan/log 작성 완료
  - 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 16:51 (local)

### 참고 스크린샷 컬럼/탭을 live FMP response와 대조

- 작업 목적
  - 사용자가 첨부한 IPO calendar 참고 화면의 컬럼/탭이 현재 FMP source로 실제 재현 가능한지 확인
  - 특히 `Offer Amount`, `Managers`, `Upcoming/Priced/Filings/Withdrawn` 매핑을 고정
- 변경 파일
  - `ai_agent_plan/ipo_calendar_scope/plan.md`
- 확인한 근거
  - live FMP endpoint query
    - `ipos-calendar?from=2026-04-15&to=2026-07-14`
    - `ipos-calendar?from=2026-01-15&to=2026-04-15`
    - `ipos-calendar?from=2025-10-15&to=2026-01-13`
    - `ipos-disclosure?from=2026-04-15&to=2026-07-14`
    - `ipos-prospectus` field key 점검
- 핵심 결론
  - `Company Name`, `Ticker`, `Exchange`, `IPO Date`, `Price`, `Shares`는 `ipos-calendar` direct field로 재현 가능하다.
  - 스크린샷의 `Offer Amount`는 live 값 기준 `ipos-calendar.marketCap`과 일치했다.
    - 예: `RIKU` row는 화면상 `$34.50M`, live FMP `marketCap=34500000`
  - status 탭은 `actions` field로 상당 부분 재현 가능하다.
    - 확인된 값: `Expected`, `Filed`, `Priced`, `Amended`
  - 따라서 `Upcoming`/`Priced`는 direct mapping 가능하고, `Filings`는 `actions=Filed` 또는 `ipos-disclosure`로 처리 가능하다.
  - `Withdrawn`은 sampled live ranges에서는 아직 확인하지 못했다.
  - `Managers`는 live `ipos-calendar`, `ipos-disclosure`, `ipos-prospectus` structured field에서는 확인되지 않았다.
    - current FMP structured source만으로는 direct 재현 근거가 부족하다.
- 검증

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| live `ipos-calendar` field 확인 | ✅ | `symbol/date/company/exchange/actions/shares/priceRange/marketCap` 확인 |
| live action 값 확인 | ✅ | `Expected`, `Filed`, `Priced`, `Amended` 확인 |
| live `ipos-disclosure` field 확인 | ✅ | `symbol/filingDate/acceptedDate/effectivenessDate/cik/form/url` 확인 |
| live `ipos-prospectus` field 확인 | ✅ | `pricePublicPerShare`, `pricePublicTotal`, `proceedsBeforeExpensesTotal` 등 확인 |

- 상태
  - 스크린샷 기준 필드 매핑 정리 완료
  - 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 17:28:14 (local)

### IPO Calendar phase 1 구현 + build/test/live 검증

- 작업 목적
  - IPO tab을 `CalendarWindow`에 실제 구현
  - FMP IPO update route 추가
  - SEC description / ownership 계산용 download route 및 저장소 추가
  - 문서와 plan/log를 현재 구현 상태에 맞게 동기화
- 변경 파일
  - backend
    - `terminal/backend/src/services/fmpIpoCalendarProvider.ts`
    - `terminal/backend/src/services/ipoSecEnrichmentRepository.ts`
    - `terminal/backend/src/services/ipoSecInsights.ts`
    - `terminal/backend/src/services/calendarRepository.ts`
    - `terminal/backend/src/server.ts`
    - `terminal/backend/src/db.ts`
    - `terminal/backend_prompt.md`
  - frontend
    - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
    - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - plan/log
    - `ai_agent_plan/ipo_calendar_scope/plan.md`
    - `ai_agent_plan/ipo_calendar_scope/agent_log.md`
- 구현 핵심
  - FMP `ipos-calendar` 기반 direct IPO ingest 추가
  - `ipo_sec_enrichments` 별도 저장 테이블 추가
  - prospectus/disclosure 문서 다운로드 후 회사 설명 + named-owner percentage를 파싱하는 SEC pipeline 추가
  - IPO row API에 아래 필드 노출 추가
    - `ipo_date`, `company_name`, `exchange`, `status`, `shares`, `price_range`, `offer_amount`
    - `company_description`
    - `sec_form`, `sec_filing_date`, `sec_accepted_date`
    - `sec_owner_count`, `sec_max_owner_pct`, `sec_total_owner_pct`
    - `prospectus_url`, `disclosure_url`
  - frontend IPO tab에 아래 동작 추가
    - column selector
    - `Update FMP IPO`
    - `Download SEC Data`
    - IPO info banner
    - SEC field cell rendering / status badge rendering
- 검증

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| backend build | ✅ | TypeScript build 통과 |
| frontend build | ✅ | Vite production build 통과 |
| backend tests | ✅ | `91/91` 통과 |
| live IPO update route | ✅ | `POST /api/fmp/calendar/ipos/update` 성공 |
| live IPO row 조회 | ✅ | `RIKU`, `ELMT`, `NHP` 등 확인 |
| live IPO SEC download route | ✅ | job 완료 / route 동작 확인 |
| live SEC enrich 결과값 존재 | ⚠️ | `2026-04-15~2026-04-24` 샘플에서는 `enrichedRows=0` |

- live 결과 요약
  - IPO update job result
    - `fetchedRows=21`
    - `upsertedRows=21`
    - `deletedRows=0`
  - IPO SEC download job result
    - `rows=21`
    - `disclosures=31003`
    - `prospectuses=898`
    - `genericFilings=0`
    - `enrichedRows=0`
    - `descriptionRows=0`
    - `ownershipRows=0`
- 해석
  - phase 1 구현 자체는 완료되었고 route/UI/job polling도 동작한다.
  - 다만 현재 sampled future IPO 구간에서는 FMP disclosure/prospectus metadata가 row ticker와 안정적으로 매칭되지 않아 SEC-derived description/ownership가 채워지지 않았다.
  - 이 부분은 후속 개선 포인트로 남긴다.
- 상태
  - 구현 + build/test + live API 검증 완료
  - 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 17:49:17 (local)

### IPO 탭 industry / description / ownership 컬럼 보강

- 작업 목적
  - 사용자 피드백 기준으로 IPO 탭에서 빠져 있던 `industry` 및 기존 ownership 컬럼을 다시 노출
  - `company_description`이 SEC enrich만 보던 문제를 profile fallback으로 보강
  - IPO update 시점에 FMP/Yahoo company profile을 best-effort로 동기화해 metadata 누락을 줄임
- 변경 파일
  - `terminal/backend/src/server.ts`
  - `terminal/backend/src/services/calendarRepository.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `ai_agent_plan/ipo_calendar_scope/plan.md`
  - `ai_agent_plan/ipo_calendar_scope/agent_log.md`
- 구현 핵심
  - `ipos` column config에 `industry`, `float_pct`, `institutional_pct`, `insider_pct` 추가
  - IPO 탭 기본 visible 컬럼에 `industry`, `institutional_pct`, `insider_pct` 추가
  - calendar metadata query에 최신 `company_profiles.description` fallback 추가
  - `company_description = fields_json -> ipo_sec_enrichments -> company_profiles.description` 순으로 fallback
  - `POST /api/fmp/calendar/ipos/update` 완료 후 unique ticker 집합에 대해 FMP profile batch, 미응답 ticker에 대해 Yahoo profile batch를 best-effort로 실행
  - profile sync 결과는 `securities`와 `company_profiles`를 갱신해 이후 IPO calendar 조회에 재사용
- 검증

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| backend build | ✅ | 기존 수정 포함 TypeScript build 재통과 |
| frontend build | ✅ | Vite production build 재통과 |
| backend tests | ✅ | `91/91` 통과 |
| live IPO update + profile sync | ✅ | `requested=26`, `fmpFetched=10`, `yahooFetched=1` |
| live IPO API field 확인 | ✅ | 총 `26` row 중 `company_description=6`, `industry=3`, `sector=4` |
| browser UI 확인 | ✅ | IPO 탭 기본 컬럼에 `Industry`, `Inst %`, `Insider %` 표시, `EMI` description 표시 확인 |

- 남은 한계
  - 다수 future IPO ticker는 provider profile/holders coverage 자체가 없어 `industry`, `institutional_pct`, `insider_pct`, `float_pct`가 계속 `null`일 수 있다.
  - 이번 보강은 누락된 컬럼/UI/API fallback 문제는 해결했지만, provider가 값을 안 주는 row까지 임의로 채우지는 않는다.

- 상태
  - 구현 + 검증 완료
  - 사용자 확인 대기 (`awaiting user confirmation`)
