## 2026-03-28

**작성 시각:** 13:13 (local)

### 작업 항목

- `ai_agent_plan/company_news_fulltext_exact/` plan 폴더를 새로 만들었다.
- company_news exact fulltext 복구를 위한 baseline 감사 결과를 정리했다.
- 현재 코드상 company_news 원문 추출 게이트가 Yahoo/Benzinga 중심으로 제한돼 있고, origin_url 보존이 매우 부족하다는 점을 확인했다.
- runtime DB에서 company_news 총량, origin_url 보유 수, success/unavailable 분포, 상위 publisher 분포를 직접 집계해 `plan.md`에 반영했다.

### 확인한 핵심 사실

- `FINNHUB + company_news` 총 row: `1,308,960`
- `origin_url` 보유 row: `3,913`
- `news_fulltext success`: `1,012` (`benzinga-scrape=912`, `yahoo-finance-browser=100`)
- 현재 company_news extractor 허용 publisher: `YAHOO`, `BENZINGA`

### 변경 파일

- `ai_agent_plan/company_news_fulltext_exact/plan.md`
- `ai_agent_plan/company_news_fulltext_exact/agent_log.md`

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서 생성 작업이라 code error 대상 없음 |
| 빌드 | ✅ | 빌드 비대상. 코드 변경 없음 |
| 자동 테스트 | ✅ | 테스트 비대상. 코드 변경 없음 |
| 런타임 통합 | ✅ | runtime DB 직접 집계로 baseline 수치 확인 |

### 사용자 확인 상태

- 상태: 확인 대기 (awaiting user confirmation)
- 요청 내용상 이번 단계는 plan 폴더 생성과 baseline 감사 문서화까지 완료했다.

### 리스크 / 메모

- 현재 company_news 대부분은 `origin_url`이 없어서 publisher scraper를 바로 추가해도 과거 row 재활용 효과가 작다.
- `news_fulltext`가 이미 `unavailable`로 기록된 row는 기본 fulltext job 재실행만으로는 다시 잡히지 않는다.
- CNBC처럼 일부 `origin_url`이 있어도 video URL이 섞여 있어 “원문 기사”와 “비디오 설명”을 분리해서 감사해야 한다.

## 2026-03-28

**작성 시각:** 14:45 (local)

### 작업 항목

- 사용자 요청에 따라 `company_news_fulltext_exact` plan 기준으로 작업을 이어갔다.
- 기존 저장된 FINNHUB company_news 전체의 missing `origin_url` 복구를 위한 전용 backfill 경로를 구현했다.
- Finnhub redirect resolver를 재사용 가능하게 export하고, company_news 전용 batch worker backfill을 추가했다.
- backend route `/api/news/fulltext/backfill-company-origin-url`를 추가해 전체 복구 job을 시작할 수 있게 만들었다.

### 변경 파일

- `terminal/backend/src/services/fulltextExtractors.ts`
- `terminal/backend/src/services/fulltextUpdateService.ts`
- `terminal/backend/src/server.ts`
- `ai_agent_plan/company_news_fulltext_exact/plan.md`
- `ai_agent_plan/company_news_fulltext_exact/agent_log.md`

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 수정 파일 `get_errors` 기준 0 errors |
| 빌드 | ✅ | `npm.cmd run build` (`terminal/`) 성공 |
| 자동 테스트 | 미실시 | 이번 단계는 전체 backfill 실행 우선. 테스트 suite는 아직 돌리지 않음 |
| 런타임 통합 | ⏳ | backend 재기동 후 company_news origin backfill endpoint 실행 진행 중 |

### 사용자 확인 상태

- 상태: 확인 대기 (awaiting user confirmation)
- 다만 사용자 지시에 따라 확인 대기에서 멈추지 않고 backfill 실행까지 계속 진행 중이다.

### 리스크 / 메모

- 전체 대상은 약 130만 row라 장시간 job이 될 수 있다.
- 일부 redirect는 살아 있어도 publisher 라벨과 실제 도착 host가 다를 수 있어 복구 후 publisher 재판정이 필요하다.
- 전체 origin 복구가 끝나도 exact fulltext 자체는 별도 재추출 단계가 필요하다.

### 실행 메모 (추가)

- backend dev 서버를 route 기반으로 바로 실행하려 했으나 startup 중 `backfillPublisher()`와 중복 프로세스가 겹치면서 `SQLITE_BUSY: database is locked`가 발생했다.
- 이 문제를 피하기 위해 서버 route 호출 대신 동일한 backfill 함수를 직접 호출하는 standalone Node 실행으로 전환했다.
- direct backfill 프로세스 terminal id: `e3c2fd17-86a7-4771-a774-9c85b35ea825`
- direct backfill 초기 로그:
	- `total=1,305,048 missing rows`
	- 약 70초 시점 `completed=500`

### 실행 메모 (속도 조정)

- 초기 direct backfill은 `concurrency=20`, `batchSize=500`으로 시작했으나 처리 속도가 초당 약 9건 수준이라 전체 완료 시간이 과도하게 길었다.
- 중간 상태를 유지한 채 프로세스를 중단하고 더 높은 설정으로 재시작했다.
- 현재 실행 중인 fast backfill 프로세스 terminal id: `58218579-a491-4f6c-b95c-1a6ca7759f20`
- fast backfill 시작 시점 DB 상태:
	- `total_rows=1,309,467`
	- `missing_origin=1,302,957`
	- `with_origin=6,510`
- fast backfill 약 100초 시점:
	- process progress: `completed=1,204 / 1,303,048`
	- DB count: `missing_origin=1,301,779`, `with_origin=7,688`
- 관측 메모:
	- 복구는 실제로 진행 중이다.
	- 다만 전체 대상이 매우 커서 장시간 실행이 필요하다.

### 진행 확인 (최신)

- 최신 DB 확인 시점:
	- `total_rows=1,309,467`
	- `missing_origin=1,229,815`
	- `with_origin=79,652`
- fast direct backfill 로그 최신 구간:
	- `completed=78,301 / 1,303,048`
	- 진행률 표시는 아직 `6%`
	- 로그상 실패 중단 없이 계속 증가 중
- 해석:
	- 초기 `with_origin=6,510` 대비 약 `+73,142`건이 추가로 채워졌다.
	- 전체 job은 아직 완료 전이며, 계속 실행 중이다.

## 2026-03-28

**작성 시각:** 16:40 (local)

### 작업 항목

- visible/optimized/direct backfill terminal들이 현재는 모두 종료됐음을 재확인했다.
- 종료 원인이 주로 `SQLITE_BUSY`였고, 긴 batch write transaction과 backend dev 병행 실행이 주 원인이라고 판단했다.
- company_news origin backfill 기본 실행값을 저동시성으로 낮추고, DB update를 작은 write chunk로 쪼개는 수정 계획을 plan에 반영했다.

### 변경 파일

- `ai_agent_plan/company_news_fulltext_exact/plan.md`
- `ai_agent_plan/company_news_fulltext_exact/agent_log.md`

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ⏳ | 코드 수정 전 계획/로그 반영 단계 |
| 빌드 | ⏳ | 코드 수정 후 실행 예정 |
| 자동 테스트 | ⏳ | 코드 수정 후 실행 예정 |
| 런타임 통합 | ✅ | 현재 active backfill 프로세스 없음, DB 수치 정지 상태 확인 |

### 사용자 확인 상태

- 상태: 확인 대기 (awaiting user confirmation)
- 사용자 최신 지시에 따라 확인을 기다리지 않고 origin_url 복구 완료를 목표로 다음 수정/실행 단계로 계속 진행한다.

### 리스크 / 메모

- backend dev server가 같은 DB에 쓰기를 시도하면 long-running backfill과 다시 충돌할 수 있다.
- write chunk를 너무 작게 하면 안정성은 오르지만 전체 완료 시간은 늘어날 수 있다.
- 이번 단계는 `origin_url` 복구만 끝내는 것이며 exact fulltext 재추출은 아직 아니다.

## 2026-03-28

**작성 시각:** 21:11 (local)

### 작업 항목

- `runCompanyNewsOriginUrlBackfill()`의 company_news 기본 실행값을 낮추고, batch write를 작은 chunk로 나누는 코드를 반영했다.
- `terminal` 전체 빌드와 backend test를 다시 실행해 수정이 깨지지 않았는지 확인했다.
- backend dev watcher가 실제로 backfill batch write를 막고 있는 것을 재현 확인한 뒤, watcher tree를 종료하고 single-writer run으로 재시작했다.
- 이후 더 빠른 single-writer-fast run(`concurrency=12`, `batchSize=360`)으로 재시작했고, DB 카운트가 다시 증가하는 것을 확인했다.

### 변경 파일

- `terminal/backend/src/services/fulltextUpdateService.ts`
- `ai_agent_plan/company_news_fulltext_exact/plan.md`
- `ai_agent_plan/company_news_fulltext_exact/agent_log.md`

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `fulltextUpdateService.ts` 기준 0 errors |
| 빌드 | ✅ | `npm.cmd run build` (`terminal/`) 성공 |
| 자동 테스트 | ✅ | `npm.cmd run test` (`terminal/backend`) 84/84 pass |
| 런타임 통합 | ✅ | single-writer-fast 실행 후 `with_origin=82,710`, `missing_origin=1,226,757` 확인 |

### 사용자 확인 상태

- 상태: 확인 대기 (awaiting user confirmation)
- 사용자 최신 지시에 따라 origin_url 전체 복구 job은 계속 진행 중이다.

### 리스크 / 메모

- `company-origin-single-writer` 초기 run은 backend watcher가 살아 있는 상태여서 batch 1 이후 장시간 정지했다.
- watcher 종료 뒤에는 다시 진행이 살아났지만, row 구간별 redirect 생존율 차이로 `updated/unresolved` 비율은 batch마다 달라질 수 있다.
- backfill이 끝날 때까지 backend dev server를 다시 올리지 않는 편이 안전하다.

## 2026-03-28

**작성 시각:** 18:16 (local)

### 작업 항목

- `company_news` live pull/update 경로에서도 Finnhub wrapper redirect를 즉시 resolve하도록 공용 resolver를 분리했다.
- `fetchCompanyNewsRaw()`에 `concurrency=20`, `maxRetries=10` 정책을 반영하고, resolve 실패 row는 `origin_url unresolved after 10 retries` 형식으로 live job log에 남기도록 했다.
- `insertNewsItem()`이 신규 insert뿐 아니라 duplicate row에도 비어 있던 `origin_url`을 채우도록 수정했다.
- historical backfill도 동일하게 `maxRetries=10`으로 올리고, 최종 실패 row를 `final origin_url unresolved after 10 retries` 형식으로 job log에 남기도록 했다.
- `.github/copilot-skills/finhub_other_api.md`와 `plan.md`를 실측 운영 규칙에 맞게 동기화했다.

### 변경 파일

- `terminal/backend/src/services/finnhubRedirectResolver.ts`
- `terminal/backend/src/services/fulltextExtractors.ts`
- `terminal/backend/src/services/fulltextUpdateService.ts`
- `terminal/backend/src/services/finnhubNewsProvider.ts`
- `terminal/backend/src/services/newsRepository.ts`
- `terminal/backend/src/server.ts`
- `.github/copilot-skills/finhub_other_api.md`
- `ai_agent_plan/company_news_fulltext_exact/plan.md`
- `ai_agent_plan/company_news_fulltext_exact/agent_log.md`

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 수정 파일 `get_errors` 기준 0 errors |
| 빌드 | ✅ | `npm.cmd run build` (`terminal/`) 성공 |
| 자동 테스트 | ✅ | `npm.cmd run test` (`terminal/`) 84/84 pass |
| 런타임 통합 | ✅ | backend listener(`http://localhost:8080`) 확인 후, built service direct run으로 `AAPL`, `2026-03-27~2026-03-28`, `total=45`, `withOrigin=45`, sample `finnhub.io/api/news?id=... -> finance.yahoo.com/...`, `publisher=YAHOO` 확인 |

### 사용자 확인 상태

- 상태: 확인 대기 (awaiting user confirmation)
- Step 1의 구현은 반영됐지만, 사용자가 실제 운영 승인 여부를 확인하기 전까지 plan 상태는 `⏳`로 유지한다.

### 리스크 / 메모

- local dev server에 대한 HTTP POST route 자체는 shared terminal 환경에서 응답 캡처가 비정상적으로 지연돼 별도 shell-level 확인이 추가로 필요할 수 있다.
- live pull에서 redirect resolve를 insert 전에 수행하므로, company_news pull latency는 이전보다 늘 수 있다.
- final failure log는 무제한 출력이 아니라 cap을 두었으므로, 대량 실패 run에서는 suppressed count를 같이 확인해야 한다.