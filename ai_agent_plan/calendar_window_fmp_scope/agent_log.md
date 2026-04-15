# agent_log

## 2026-04-15
**작성 시각:** 2026-04-15 14:05 (local)

### 계획 폴더 생성 및 FMP 범위 조사

- 작업 목적
  - `calendar window` 관련 후속 작업을 위한 전용 plan 폴더 생성
  - FMP에서 받을 수 있는 데이터를 현재 레포 기준으로 정리
- 생성 파일
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
  - `ai_agent_plan/calendar_window_fmp_scope/agent_log.md`
- 확인한 근거
  - backend calendar read/write 구조 확인
  - frontend `CalendarWindow`의 mock 데이터 의존 확인
  - 현재 레포의 FMP provider 코드 확인
  - FMP 문서에서 `earnings-calendar`, `dividends-calendar`, `splits-calendar`, `ipos-calendar`, `economic-calendar` endpoint와 샘플 필드 확인
- 핵심 관찰
  - backend는 이미 범용 `calendar_events` + `/api/calendar/events` 구조를 가지고 있다.
  - frontend calendar는 아직 `mockCalendarData`와 legacy 탭 타입에 의존한다.
  - 현재 레포에 이미 연결된 FMP 데이터는 profile, shares-float, OHLC, press release, stock news, SEC filing이다.
  - FMP calendar 후보 데이터는 earnings, dividends, splits, IPOs, economics다.
  - FMP stable earnings 문서 FAQ 기준 `time` 필드는 제거되어 있다.
  - direct endpoint는 `demo` key 기준 401이어서 실제 entitlement는 운영 key로 별도 확인이 필요하다.
- 현재 판단
  - phase 1 권장 범위는 `earnings/dividends/splits`다.
  - `IPO/economics`는 null ticker와 UI 계약 문제로 phase 2가 적절하다.
  - FMP와 IBKR를 함께 둘 경우 `unique_key`는 source-aware해야 한다.
- 검증

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| plan 폴더 생성 | ✅ | `ai_agent_plan/calendar_window_fmp_scope` 생성 |
| plan 문서 작성 | ✅ | 목표, 현재 상태, FMP 데이터 범위, 단계별 계획 포함 |
| 조사 근거 확보 | ✅ | 코드 + FMP docs page 기준 |
| live API 샘플 호출 | ⚠️ 제한 확인 | `demo` key로 401, 실제 key entitlement는 후속 확인 필요 |

- 상태
  - `plan.md` 작성 완료
  - 사용자 확인 대기(`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 14:28 (local)

### PLAN CHANGE — calendar window 실구현 범위 확장

- 사용자 추가 요구 반영
  - `CalendarWindow`에 DB 기반 ownership/industry column selector 추가
  - FMP earnings-date update 버튼 추가
  - 날짜 기간 필터를 실제 API query 기준으로 동작하게 변경
  - update 대상 ticker를 DB `default universe`로 고정
- 구현 결정
  - FMP stable earnings는 `time/session`을 신뢰 가능하게 제공하지 않으므로 값 추정은 하지 않는다.
  - ownership/industry는 새 외부 fetch가 아니라 existing DB metadata enrich로 해결한다.
  - update는 background job + `/api/jobs/:jobId` polling 계약으로 맞춘다.
- 다음 구현 범위
  - backend: FMP earnings route/provider + calendar query enrich
  - frontend: mock 제거 + API fetch + column selector + update button
- 상태
  - 구현 진행 중 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 14:46 (local)

### calendar window 실구현 + 검증

- 변경 파일
  - `terminal/backend/src/services/fmpEarningsCalendarProvider.ts`
  - `terminal/backend/src/services/calendarRepository.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
- 구현 내용
  - FMP stable earnings-calendar provider 추가
  - `POST /api/fmp/calendar/earnings/update` background job 추가
  - update 대상 ticker를 DB `default universe`로 고정
  - `GET /api/calendar/events`의 date-only `from/to`를 inclusive range로 정규화
  - earnings row에 DB 기반 `industry`, `market_cap`, `float_pct`, `institutional_pct`, `insider_pct` enrich 추가
  - `CalendarWindow`를 mock에서 API 기반으로 교체
  - earnings 탭에 FMP update 버튼, job polling, date filter, column selector 추가
  - FMP stable source의 `time/session` 부재를 UI 안내문으로 명시
- 런타임 확인
  - `POST /api/fmp/calendar/earnings/update`를 `2026-04-01 ~ 2026-04-30` 범위로 실행해 `jobId` 반환 확인
  - job 완료 결과: `fetchedRows=4000`, `matchedRows=369`, `upsertedRows=369`
  - `GET /api/calendar/events?type=earnings&from=2026-04-01&to=2026-04-30`에서 DB metadata enrich field 확인
  - 브라우저에서 Calendar 창 렌더링 확인
  - Playwright로 table row count(`368`)와 ownership column label 존재 확인

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 `get_errors` 0 errors, repo-wide로는 `before_delete/terminal/backend/tsconfig.json`의 unrelated type-definition error 잔존 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `15 files / 91 tests` pass |
| 런타임 통합 | ✅ | calendar types/events API, FMP earnings update job, 브라우저 Calendar 창 렌더링 확인 |

- 상태
  - 구현/검증 완료, 사용자 확인 대기 (`awaiting user confirmation`)