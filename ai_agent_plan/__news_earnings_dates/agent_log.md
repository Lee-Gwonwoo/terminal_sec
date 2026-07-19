# News Window Earnings Dates Agent Log

## 2026-04-18
**작성 시각:** 19:02 (local)

### Step 1 시작
- 상태: 진행 중
- 범위: `news_earnings_context` 스키마 추가, backend/frontend 타입 계약 추가
- 예정 파일:
  - `terminal/backend/src/db.ts`
  - `terminal/backend/src/types.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`
- 결정 반영:
  - freshness gate는 ET 날짜 기준
  - 버튼은 `Custom Earning Date Update` + `Check Unconfirmed Earning Date`
  - multi-ticker row는 `ohlc_ticker -> 첫 ticker` 규칙 사용
  - Step 1 완료 후 사용자 확인 전까지 `확인 대기`로 유지

**작성 시각:** 19:05 (local)

### Step 1 결과
- 상태: 확인 대기
- 변경 파일:
  - `terminal/backend/src/db.ts`
  - `terminal/backend/src/types.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`
  - `terminal/backend/tmp/test_validate_news_earnings_context_step1.mjs`
- 구현 내용:
  - `news_earnings_context` 테이블과 인덱스 추가
  - backend `NewsItem`에 earnings context 응답 필드 추가
  - frontend 공용 `NewsItem` 타입에 대응 필드 추가
- 검증 결과:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 0 errors |
| 빌드 | ✅ | backend `npm run build -w backend`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 94/94 pass |
| 런타임 통합 | ✅ | `node tmp/test_validate_news_earnings_context_step1.mjs`로 `app.db`에 `news_earnings_context` 생성 확인 |

- 관찰 사항:
  - runtime 검증 시 기존 `initDb()` 부수 로그로 `legacy FINNHUB sec_filing rows purge` 메시지가 출력됐음
  - 이번 Step 1 변경의 실패는 아니고, 기존 DB 초기화 루틴이 같이 실행되며 남긴 로그임

**작성 시각:** 19:46 (local)

### Step 2~8 결과
- 상태: 확인 대기
- 변경 파일:
  - `terminal/backend/src/services/newsRepository.ts`
  - `terminal/backend/src/services/newsEarningsContextService.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `ai_agent_plan/news_earnings_dates/plan.md`
- 구현 내용:
  - `newsEarningsContextService.ts`에 calendar-first lookup, 대표 ticker 선택(`ohlc_ticker -> 첫 ticker`), deterministic tie-break, `news_earnings_context` upsert를 구현
  - unresolved ticker만 추려 `-180일 ~ +180일` window를 병합한 global range로 FMP earnings fallback을 수행하고, 결과를 `calendar_events`에 upsert한 뒤 재조회하도록 구현
  - `POST /api/news/earnings/update-custom`, `POST /api/news/earnings/check-unconfirmed`를 추가하고 `fmp_calendar_earnings` ET 당일 freshness gate를 backend에서 강제
  - `/api/news`, `/api/news/:id`, `/api/model1/news`, `/api/model1/news/:id`에 `news_earnings_context` join과 `earnings_context_display` 응답 필드를 추가
  - News Window에 `Earnings Dates` 컬럼, `Custom Earning Date Update`, `Check Unconfirmed Earning Date` 메뉴를 추가하고 기존 calendar shortcut 3개를 제거
- 검증 결과:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 수정 대상 4개 코드 파일 `get_errors` 기준 0 errors |
| 빌드 | ✅ | backend `npm run build -w backend`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 94/94 pass |
| 런타임 게이트 | ✅ | stale 상태의 `POST /api/news/earnings/update-custom`가 `412`와 선행 액션 메시지 반환 |
| 런타임 성공 경로 | ✅ | same-day `POST /api/fmp/calendar/earnings/update` 후 custom/unconfirmed endpoint 모두 `jobId` 반환 |
| 런타임 결과 샘플 | ✅ | custom job `processed=707`, `resolved=373`, `partial=171`, `missing=163`, `fallbackTickers=135`, `fallbackMatchedRows=9` |
| API 응답 샘플 | ✅ | `/api/news?from=2026-04-17&to=2026-04-17&pageSize=10`에서 `earnings_context_display`와 raw earnings 필드 확인 |

- 관찰 사항:
  - same-day FMP earnings refresh 검증에서는 요청일 `2026-04-18`에 실제 fetched row가 0이어도 freshness gate 해제와 subsequent custom job 시작은 정상 동작했음
  - `Check Unconfirmed Earning Date` 샘플 호출은 현재 필터 결과에서 unconfirmed 재확인 대상이 없어 `candidateCount=0`으로 종료됐음. endpoint 성공 경로는 확인됐지만, non-zero unconfirmed 샘플은 별도 사용자 확인이 필요함
  - 브라우저에서 Columns 토글과 Update 메뉴를 직접 클릭하는 수동 UI 확인은 아직 남아 있으므로, 사용자 확인 전까지 이 단계도 `확인 대기`로 유지함

**작성 시각:** 21:52 (local)

### Full-Scan Earning Date Update 리비전
- 상태: 확인 대기
- 변경 파일:
  - `terminal/backend/src/server.ts`
  - `terminal/backend/src/services/newsEarningsContextService.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `terminal/backend_prompt.md`
  - `ai_agent_plan/news_earnings_dates/plan.md`
- 구현 내용:
  - `POST /api/news/earnings/update-full-scan` route를 추가해 News Window 현재 filter와 무관하게 전체 `news_items`를 대상으로 earnings context job을 시작하도록 구현
  - 초기 구현에서 전체 candidate query를 route 응답 전에 수행해 응답이 과도하게 늦어지는 문제를 확인했고, full-scan route를 `즉시 job 생성 -> background에서 candidate 로드` 방식으로 수정
  - full-scan duplicate guard를 상수 fingerprint 기반으로 유지하고, 두 번째 동일 요청이 첫 job 실행 중이면 `409 + existingJobId`를 반환하도록 보장
  - News Window Update 메뉴에 `Full-Scan Earning Date Update` 항목과 설명 문구를 추가하고 How To Use 설명을 동기화
  - backend prompt 문서에 full-scan route contract와 `candidateCountPending` semantics를 반영
- 검증 결과:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 `server.ts`, `newsEarningsContextService.ts`, `FinnhubNewsWindow.tsx`, `backend_prompt.md`, `plan.md` 모두 0 errors |
| 빌드 | ✅ | backend `npm run build -w backend`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 94/94 pass |
| 런타임 통합 | ✅ | Python snippet으로 full-scan route 호출 시 첫 요청 `200`, 둘째 요청 `409`, 첫 job 상태 `running`, cancel `200` 확인. 브라우저 Update 메뉴에서 `Full-Scan Earning Date Update` 항목 렌더링 확인 |

- 관찰 사항:
  - 전체 candidate query는 매우 크기 때문에 초기 route 응답 전에 계산하면 timeout 가능성이 높았음. 이번 리비전에서 이를 background 단계로 이동해 해소함
  - integrated browser에서는 현재 dev origin/CORS 설정 불일치(`localhost:5173` vs backend 허용 origin) 때문에 backend를 직접 fetch하는 API 검증은 불가했음. 대신 UI 렌더링은 브라우저에서 확인했고, route 동작은 Python snippet으로 검증함

**작성 시각:** 21:33 (local)

### Earnings Date 병렬 컨트롤 결과
- 상태: 확인 대기
- 변경 파일:
  - `terminal/backend/src/services/newsEarningsContextService.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `ai_agent_plan/news_earnings_dates/plan.md`
- 구현 내용:
  - earnings update service에 worker concurrency clamp(`1~32`, default `8`)를 추가하고, worker pool로 candidate를 병렬 처리하도록 변경
  - SQLite write 충돌을 피하려고 `news_earnings_context` upsert는 async mutex로 serialize
  - route-level duplicate guard를 mode 단위 고정 key에서 **요청 fingerprint 기준 key**로 바꿔, exact duplicate request만 `409`로 재사용하고 범위/필터가 다른 request는 동시 실행 허용
  - News Window Control 창에 `Earnings Date Update -> Worker Concurrency` 입력과 localStorage 저장(`news-earnings-worker-concurrency`)을 추가하고, custom/unconfirmed 요청 body에 `workerConcurrency`, `requestIntervalMs`를 함께 전달
- 검증 결과:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 `newsEarningsContextService.ts`, `server.ts`, `FinnhubNewsWindow.tsx` 모두 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build -w backend`, frontend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | `terminal` 루트 `npm.cmd run test` → backend `vitest` 94/94 pass |
| 런타임 통합 | ✅ | same payload `POST /api/news/earnings/update-custom`는 `200` 후 duplicate `409`, 다른 payload는 추가 `200`; 직후 `/api/jobs/:jobId` 두 건 모두 `running` 확인. 브라우저에서 News Window Control 창에 `Earnings Date Update / Worker Concurrency` 입력 렌더링 확인 |

- 관찰 사항:
  - Windows PowerShell 5.1에서는 `Invoke-WebRequest`가 보안 경고 프롬프트를 띄우므로, 런타임 검증은 `-UseBasicParsing`을 붙여 수행했음
  - 중간 검증 중 실수로 시작된 장기 custom earnings job(`ea948690-60ac-418f-8ca0-18d3efaf0195`)은 확인 후 `POST /api/jobs/:jobId/cancel`로 정리해 워크스페이스를 깨끗한 상태로 복구했음

## 2026-05-29
**작성 시각:** 19:14 (local)

### FMP Earnings Calendar cap-safe sync 리비전
- 상태: 확인 대기
- 변경 파일:
  - `terminal/backend/src/server.ts`
  - `ai_agent_plan/news_earnings_dates/plan.md`
  - `ai_agent_plan/news_earnings_dates/agent_log.md`
- 배경:
  - RDW earnings date가 Calendar/Past History에 누락된 원인을 확인한 결과, FMP `stable/earnings-calendar`가 monthly/broad window에서 `4000` rows cap처럼 동작하며 일부 ticker를 누락할 수 있었음
  - `Sync Financial + Past Estimates` 버튼은 기존에 financial series/analyst estimates만 동기화해 `calendar_events`의 earnings date 누락을 복구하지 못했음
- 구현 내용:
  - earnings calendar 전용 기본 chunk를 `14일`로 분리하고, 기존 `30일` 공용 calendar chunk는 IPO 등 다른 calendar flow에 유지
  - `4000` rows 이상 반환된 earnings chunk를 cap 의심으로 보고 해당 chunk만 자동으로 절반 재분할해 큐에 추가
  - cap 의심 chunk는 incomplete snapshot 가능성이 있으므로 delete-before-replace를 건너뛰고 upsert만 수행
  - standalone `/api/fmp/calendar/earnings/update`와 `/api/fmp/calendar/financials/update`가 같은 cap-safe helper를 사용하도록 정리
  - `/api/fmp/calendar/financials/update`는 선행 단계로 earnings date backfill(`오늘 - 730일 ~ 오늘 + 180일`)을 수행한 뒤 financial/past estimates sync를 이어서 실행
  - financial sync 내부 earnings backfill 성공 시 `fmp_calendar_earnings` status도 함께 갱신
- 검증 결과:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `terminal/backend/src/server.ts` `get_errors` 0 errors |
| 빌드 | ✅ | `terminal/backend`에서 `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | backend `vitest` 17 files / 104 tests pass |
| 런타임 job | ✅ | `POST /api/fmp/calendar/earnings/update` with `2026-05-01~2026-05-14`가 14일 chunk 1개로 시작 후 cap 감지, `05-01~05-07`, `05-08~05-14`로 자동 분할 |
| DB 확인 | ✅ | `calendar_events`에 `FMP:earnings:RDW:2026-05-06` 저장 확인 |

- 런타임 관찰:
  - 첫 14일 chunk는 `fetched=4000`으로 cap 의심 상태였고 delete-before-replace를 건너뜀
  - 자동 분할된 `2026-05-01~2026-05-07` chunk는 `fetched=3388`, `2026-05-08~2026-05-14` chunk는 `fetched=3385`로 cap 미만이었음
  - RDW row는 `event_at=2026-05-06T12:00:00.000Z`, `source=FMP`, `eps_est=-0.16`, `eps_actual=-0.18`, `revenue_est=105941000`, `revenue_actual=96972000`로 저장됨
- 사용자가 직접 확인할 수 있는 방법:
  - Calendar Window에서 RDW를 `2026-05-01~2026-05-14` 범위로 필터링해 `2026-05-06` earnings row가 보이는지 확인
  - 또는 backend에서 `POST /api/fmp/calendar/earnings/update`를 같은 범위로 실행한 뒤 `/api/jobs/:jobId` log에 `looks capped; queued 2 narrower chunks`가 남는지 확인
- 리스크 / 완화 방안:
  - 리스크: 1일 단위까지 쪼갰는데도 FMP가 `4000` rows를 반환하면 여전히 완전성을 보장할 수 없음. 완화: job log에 single-day cap 의심을 남기고 기존 row 삭제를 막아 데이터 손실을 방지
  - 리스크: combined financial sync는 earnings backfill을 먼저 수행하므로 job 시간이 늘어날 수 있음. 완화: 기본 요청 단위는 14일로 유지하고 cap 구간만 추가 호출
  - 리스크: 과거 2년보다 더 오래된 history는 기본 financial sync만으로는 복구되지 않을 수 있음. 완화: 필요 시 request body의 `from/to`로 더 긴 backfill 범위를 지정
