## 2026-03-29

**작성 시각:** 2026-03-29 12:18 (local)

### custom_update_gap 구현 시작 및 plan 보정

- 생성/수정 파일:
  - `ai_agent_plan/custom_update_gap/plan.md`
  - `ai_agent_plan/custom_update_gap/agent_log.md`
  - `terminal/backend/src/services/newsRepository.ts`
- 수행 내용:
  - `custom_update_gap` plan 컨텍스트에서 실제 구현을 시작했다.
  - ticker + source + source_type + 날짜 범위 기준으로 기존 적재 coverage를 읽는 공통 helper를 `newsRepository.ts`에 추가했다.
  - route 감사 중 RTPR provider가 `from/to` range fetch를 직접 지원하지 않는 점을 확인했고, plan을 `true gap-only` 대상에서 `preflight + fully-covered skip` 우선으로 보정했다.
- 검증 예정:
  - helper 타입 에러 확인
  - backend build
  - helper를 직접 호출해 샘플 ticker coverage 결과 확인
- 상태:
  - Step 0-1 / 0-3 / 1-1 구현 진행 중, 사용자 확인 대기.

**작성 시각:** 2026-03-29 12:21 (local)

### Step 1-1 검증 결과

- 검증 대상:
  - `terminal/backend/src/services/newsRepository.ts`
- runtime 샘플 확인:
  - `AAPL`: `2026-03-03 ~ 2026-03-10`
  - `MSFT`: `2026-03-04 ~ 2026-03-10`
  - `NVDA`: `2026-03-08 ~ 2026-03-10`
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `newsRepository.ts` 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | backend `84/84` pass |
| 런타임 통합 | ✅ | build 산출물에서 `initDb()` 후 `getTickerNewsCoverage()` 직접 호출, 샘플 ticker coverage/range 확인 |

- 상태:
  - coverage helper는 동작 확인 완료, 다음 단계는 `missing sub-range` 계산과 route preflight 연결이다.

**작성 시각:** 2026-03-29 12:51 (local)

### Backend custom preflight/gap 실행 + DataControlWindow UI 연결 반영

- 생성/수정 파일:
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - `ai_agent_plan/custom_update_gap/plan.md`
  - `ai_agent_plan/custom_update_gap/agent_log.md`
- 수행 내용:
  - custom 버튼 계열 preflight endpoint를 backend에 추가하고, Finnhub/FMP ticker-news custom 실행을 missing gap 기준으로 돌도록 연결했다.
  - RTPR custom은 provider 제약 때문에 `true gap-only` 대신 `preflight + fully-covered skip` 전략으로 연결했다.
  - `FinnhubNewsWindow.tsx`에 이어 `DataControlWindow.tsx`에도 custom preflight 모달을 붙여서 `calendarCustom`, `custom change`가 실행 전에 요약 JSON을 먼저 보여준 뒤 Continue에서 실제 job을 시작하도록 마무리했다.
  - `DataControlWindow.tsx`에서는 Continue 시 해당 섹션의 `updating` 상태를 다시 켜서 버튼/로그 상태가 어긋나지 않게 맞췄다.
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `DataControlWindow.tsx` 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build`, frontend `npm.cmd run build` 모두 성공 |
| 자동 테스트 | ✅ | backend `84/84` pass |
| 런타임 통합 | ✅ | `POST /api/ibkr/calendar/update-custom/preflight`, `POST /api/news/change/update-custom/preflight` 실응답 확인 + `DataControlWindow.tsx` 렌더 분기/모달 JSX 코드 리뷰, 브라우저 시각 확인은 사용자 위임 |

- 상태:
  - Step 2-1 ~ 2-3, Step 3-1 ~ 3-3, Step 4-1 ~ 4-2는 구현 완료 후 사용자 확인 대기 상태다.
  - Step 4-3(non-ticker 본실행 result summary 정리)는 아직 미완이다.

**작성 시각:** 2026-03-29 13:03 (local)

### coverage 로직 핵심 수정: 개별 날짜 → min/max envelope

- 생성/수정 파일:
  - `terminal/backend/src/services/newsRepository.ts`
  - `terminal/backend/src/server.ts`
  - `ai_agent_plan/custom_update_gap/plan.md`
- 문제:
  - 기존 구현은 ticker별 데이터가 존재하는 **개별 날짜**(coveredDates)를 기준으로 gap을 계산했다. 데이터가 있는 날짜 사이사이에 뉴스가 없는 날이 있으면 그것을 "missing gap"으로 잡아 불필요한 API 재호출을 일으켰다.
  - 예: TSLA에 4/1, 4/17, 5/2, 8/2 데이터가 있으면, 기존 로직은 4/2~4/16, 4/18~5/1, 5/3~8/1 전부를 gap으로 분류했다.
- 수정 내용:
  - `getTickerNewsCoverage`: SQL을 `GROUP BY tickers_csv` + `MIN/MAX`로 바꿔서 ticker별 envelope(min~max) 하나만 반환하도록 변경. `coveredDates` 필드 제거.
  - `buildMissingRanges` → `buildMissingRangesFromEnvelope`로 교체. ticker당 gap은 최대 2개(envelope 앞, envelope 뒤).
  - server.ts의 `collapseIsoDateRanges`는 더 이상 호출처가 없어 제거.
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `newsRepository.ts`, `server.ts` 모두 0 errors |
| 빌드 | ✅ | backend + frontend 모두 성공 |
| 자동 테스트 | ✅ | backend `84/84` pass |
| 런타임 통합 | ✅ | `POST /api/news/pull-finhub/preflight-custom` 호출 결과: TXN `coveredRanges=[03-01~03-10], fullyCovered=true`, KLAC `coveredRanges=[03-03~03-10], missingRanges=[03-01~03-02]` — 각 ticker가 정확히 1개의 envelope + 최대 2개의 gap만 가짐 확인 |

- 상태:
  - plan에 PLAN CHANGE 기록 추가 완료.
  - coverage 핵심 로직 수정 완료, 사용자 확인 대기.