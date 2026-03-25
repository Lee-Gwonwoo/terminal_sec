### 목표
- FMP PR fulltext 기능의 실제 처리 속도를 concurrency 값별로 측정한다.
- 측정 결과를 바탕으로 기본 `ft-concurrency` 값을 더 효율적인 값으로 재설정한다.
- 사용자가 Control Window에서 fulltext concurrency를 계속 조정할 수 있도록 현재 UI 흐름을 유지하거나 필요한 경우만 보강한다.

### 현재 레포 상태(중요, 확인됨)
- FMP PR fulltext 추출 로직은 이미 `terminal/backend/src/services/fulltextUpdateService.ts`에서 worker pool 방식으로 병렬 처리한다.
- 기본 fulltext 동시성은 backend에서 `10`이며, `POST /api/news/fulltext/update`는 요청 body의 `concurrency`를 받아 `1..200`으로 clamp한다.
- `terminal/backend/src/services/fulltextExtractors.ts`는 publisher별로 다른 비용 구조를 가진다.
  - `GlobeNewswire`, `PRNewswire`, `Newsfile Corp`, `Accesswire`, `MCAP MediaWire`: HTTP scrape 기반
  - `Business Wire`: Playwright 브라우저 fallback 기반
- 현재 프론트는 이미 Control Window에서 `ft-concurrency`를 localStorage 키 `ft-concurrency`로 저장하고 있다.
  - 설정 UI: `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - 실행부: `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- 즉 이번 작업의 핵심은 “조정 가능하게 만들기” 자체가 아니라, “더 나은 기본값을 정하고 실험 근거를 남기는 것”이다.

### 제약 / 비범위
- 이번 작업은 FMP PR fulltext 성능 튜닝과 기본값 조정에 한정한다.
- extractor 품질 로직 자체, publisher selector, reset semantics는 이번 작업의 주범위가 아니다.
- 다른 provider(`RTPR`, `SEC filing`, 일반 company news)의 기본값은 이번 작업에서 동시에 바꾸지 않는다.
- 대규모 실DB를 무제한으로 반복 소모하지 않고, 대표 샘플 또는 missing-only 대상 범위를 이용해 비교 가능한 실험으로 제한한다.

### 읽는 방법(비개발자/일반인 기준)
- `Step 1`: 지금 왜 느린지와 어떤 값을 비교할지 확정
- `Step 2`: 실제 concurrency 값별 속도 테스트 수행
- `Step 3`: 가장 효율적인 기본값으로 코드와 UI 기본 표시값 수정
- `Step 4`: 문서와 안내 문구를 실제 동작에 맞게 정리
- `Step 5`: 빌드/테스트/API로 변경 결과 검증

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- 실험값이나 기본값 후보가 중간에 바뀌면 `PLAN CHANGE` 메모를 추가한다.
- 각 Step 완료 후 측정 결과와 변경 파일을 `agent_log.md`에 append한다.
- 사용자 확인 전에는 완료된 Step도 `⏳` 또는 `⬜` 기준을 유지한다.

### PLAN CHANGE — 2026-03-24 21:20
- 변경 내용: `POST /api/news/fulltext/update`에서 `fmp_press_release` special-case 재추출을 제거하고, stale FMP PR fallback success row는 별도 reset endpoint로 삭제 후 regular missing-only update를 다시 실행하는 구조로 바꾼다.
- 변경 이유: `update` semantics를 미래 재사용 기준에서도 일관되게 `missing-only`로 유지해야 한다.
- 영향: FMP PR 회복 절차가 `reset-fmp-pr-fallback -> fulltext/update(fmp_press_release)` 2단계로 바뀐다.

### PLAN CHANGE — 2026-03-24 21:41
- 변경 내용: `RTPR` 기사 body를 이용해 FMP PR fulltext를 보강하는 접근은 폐기하고, `FMP 신규 뉴스`를 대상으로 직접 원문 추출하는 방식만 유지한다.
- 변경 이유: 다른 소스 기사 body 재사용은 데이터 소스 경계를 흐린다.
- 영향:
  - `Business Wire`는 브라우저 기반 fallback을 사용한다.
  - `Newsfile Corp`, `Accesswire`, `MCAP MediaWire`는 직접 extractor를 사용한다.
  - reset 대상은 직접 추출 가능한 wire publisher 전체로 확장된다.

### PLAN CHANGE — 2026-03-25 08:59
- 변경 내용: 이번 phase의 주목표를 “추출 품질 수정”에서 “성능 벤치마크 + 기본값 튜닝 + Control Window 연동 검증”으로 확장한다.
- 변경 이유: 사용자가 FMP PR fulltext 기능의 실제 속도 차이를 concurrency 값별로 시험하고, 가장 효율적인 기본값을 제품 기본값으로 반영하라고 요청했다.
- 영향:
  - 대표 concurrency 후보군을 정해 동일 조건에서 실험한다.
  - 기본 `ft-concurrency` fallback 값과 Control Window preset 설명을 재조정한다.
  - 문서에 “현재 기본값을 왜 이 값으로 정했는지” 근거를 남긴다.

### PLAN CHANGE — 2026-03-25 09:26
- 변경 내용: 벤치마크 전에 `FMP PR Full Text Concurrency` 전용 Control Window 설정을 먼저 추가하고, `FMP PR Only` / `Reset FMP PR Fallback` 재실행이 이 값을 사용하도록 연결한다.
- 변경 이유: 사용자가 FMP PR fulltext 속도 조정을 먼저 UI에서 가능하게 해 달라고 요청했다.
- 영향:
  - 일반 full text와 FMP PR fulltext가 서로 다른 localStorage 키를 사용할 수 있다.
  - 이후 벤치마크는 이 전용 설정을 기준으로 수행한다.

### PLAN CHANGE — 2026-03-25 11:02
- 변경 내용: 뉴스 창 UI 락 규칙을 `news-update` / `news-fulltext` 두 category 기준으로 재정의하고, 두 작업을 동시에 실행 가능하게 구현한다.
- 변경 이유: 사용자가 현재 락 규칙을 문서/코드 기준표로 정리하고, FMP PR fulltext 실행 중 다른 작업도 가능하게 해 달라고 요청했다.
- 영향:
  - backend job status 응답에 category/label이 포함된다.
  - frontend는 pull/update와 fulltext를 별도 job id 및 polling으로 추적한다.
  - `Update` 계열과 `Full Text` 계열은 서로를 막지 않고, 같은 category 내 중복만 막는다.

### PLAN CHANGE — 2026-03-25 11:16
- 변경 내용: 프론트 앱 시작 시 workspace 복원 전에 기본 탭 상태가 localStorage를 덮어쓰는 회귀를 막기 위해 hydration guard를 추가한다.
- 변경 이유: 사용자가 기존에 저장된 탭들이 갑자기 사라졌다고 보고했고, `App.tsx`의 restore effect와 persist effect 순서상 저장값이 초기 기본 상태로 덮어써질 수 있었다.
- 영향:
  - `terminal-workspace-v1`는 초기 복원이 끝난 뒤에만 다시 저장된다.
  - 이후 새로고침/재접속 시 기존 탭 구성이 초기 기본 탭으로 덮어써질 가능성을 차단한다.

### PLAN CHANGE — 2026-03-25 11:24
- 변경 내용: `Default Ticker Window` 렉 완화를 위해 기능 변경 없이 가상 리스트 + deferred filter 기반 렌더링 최적화를 추가한다.
- 변경 이유: 사용자가 `Default Ticker Window`가 자주 버벅인다고 보고했고, 전체 row를 매번 다시 필터링/렌더링하는 구조가 주요 병목으로 확인됐다.
- 영향:
  - ticker 데이터/API/job polling 동작은 유지된다.
  - body row DOM 개수만 줄어 drag, filter, reload 시 프론트 렌더링 부담이 감소한다.
  - 화면상 filter 결과와 컬럼 구성은 유지하되, 필터 적용 반응은 `useDeferredValue` 기준으로 처리된다.

### 아키텍처(상위)
- 입력:
  - 사용자가 Full Text 메뉴에서 `FMP PR Only` 실행
  - 프론트가 localStorage의 `ft-concurrency` 값을 읽어 `/api/news/fulltext/update`로 전송
- 실행:
  - `server.ts`가 `concurrency`를 `1..200` 범위로 clamp
  - `runFulltextUpdate()`가 worker pool을 생성
  - 각 worker는 `extractAndPersistFulltext()` -> `extractByDomain()`으로 publisher별 추출 실행
- 출력:
  - job status (`createdAt`, `updatedAt`, `progress`, `logs`)
  - `news_fulltext` row 저장
  - 프론트 Full Text job status popup 반영

### 결정/선행조건(초기에 확정 필요)
- 결정 1: 실험 대상 concurrency 후보
  - 선택: `3`, `5`, `10`, `15`, `20`을 1차 후보군으로 사용
  - 이유: 현재 UI/기존 FMP concurrency UX가 `1..20` 중심이며, Business Wire browser fallback이 섞인 FMP PR에서는 이 범위가 현실적이다.
- 결정 2: 측정 기준
  - 선택: 총 처리 시간, 처리량(items/sec), 성공/실패/skip 수, 로그상 stalled 구간 여부를 함께 기록
  - 이유: 단순 총시간만 보면 높은 concurrency에서 실패가 늘어나는 문제를 놓치기 쉽다.
- 결정 3: 기본값 적용 방식
  - 선택: backend fallback 기본값과 frontend local default를 같은 숫자로 맞춘다.
  - 이유: localStorage가 비어 있는 새 사용자와 API 직접 호출 기본 동작이 달라지지 않게 한다.

### 계획 중간 필수 확인
- 벤치마크는 가능한 한 같은 sourceType, 같은 missing row 조건에서 비교한다.
- 이전 job 영향이 남지 않도록 각 실험 전/후 대상 건수와 job 완료 시간을 함께 기록한다.
- `Business Wire` 비중이 높은 구간과 낮은 구간의 체감 차이를 로그 note 분포로 함께 본다.

### 제안하는 구현 순서(이유)
1. 먼저 실험 설계를 고정해야 결과가 비교 가능하다.
2. 그 다음 실제 concurrency별 벤치마크를 해야 기본값 결정을 수치로 정할 수 있다.
3. 그 뒤에 기본값과 Control Window 안내를 바꾸면 문서/코드/UI가 같은 이유 체계를 공유하게 된다.
4. 마지막에 검증을 돌려 런타임과 문서가 일치하는지 닫는다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 1 — 벤치마크 기준 고정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | 성능 실험 목표와 비교 지표를 plan에 기록 | `ai_agent_plan/fmp_pr_fulltext_fix/plan.md` | plan 내용 확인 | ⏳ |
| 1-2 | 실험 후보 concurrency와 측정 절차를 확정 | `ai_agent_plan/fmp_pr_fulltext_fix/plan.md` | 후보군/절차 명시 확인 | ⏳ |
| 1-3 | agent_log에 이번 phase 시작 기록 추가 | `ai_agent_plan/fmp_pr_fulltext_fix/agent_log.md` | log append 확인 | ⏳ |

- `1-1` 목적: “빠르다”를 감이 아니라 측정 가능한 기준으로 고정한다.
  설명: 총시간, 처리량, 실패율, note 분포를 이번 실험의 공통 지표로 둔다.
  완료 조건(눈으로 확인): plan에 지표와 대상 값이 문장으로 적혀 있다.
  사람 검증(비개발자): 문서를 열어 `3/5/10/15/20` 같은 비교값이 보이면 된다.
  흔한 문제/주의: 실험할 때마다 대상 건수가 달라지면 값 비교가 틀어진다.
- `1-2` 목적: 반복 가능한 실험 프로토콜을 만든다.
  설명: 같은 API, 같은 sourceType, 같은 결과 수집 방식으로 실행하게 한다.
  완료 조건(눈으로 확인): 명령 또는 절차가 문서에 정리된다.
  사람 검증(비개발자): 어떤 버튼/API를 순서대로 실행하는지 읽고 따라갈 수 있다.
  흔한 문제/주의: 실험 간 reset/대상 row 정리가 섞이면 결과가 왜곡된다.
- `1-3` 목적: 이번 튜닝 작업의 시작점을 로그에 남긴다.
  설명: 기존 품질 수정 로그와 구분되게 성능 phase를 append한다.
  완료 조건(눈으로 확인): 최신 log 항목에 성능 벤치마크 작업이 추가된다.
  사람 검증(비개발자): 맨 아래 항목에 오늘 시각과 작업 목적이 보인다.
  흔한 문제/주의: 기존 로그 재정렬 없이 append만 사용해야 한다.

검증 훅:
```text
- plan.md에 성능 실험 목표 / 후보군 / 측정 지표가 적혀 있는지 확인
- agent_log.md 최신 append 항목 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 2 — FMP PR fulltext concurrency별 속도 테스트
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | 대표 대상 집합에서 `concurrency=3` 실행 후 시간/결과 기록 | `terminal/backend/src/server.ts` | job `createdAt/updatedAt/result/logs` 수집 | ⬜ |
| 2-2 | `concurrency=5`, `10`, `15`, `20` 동일 조건 반복 측정 | `terminal/backend/src/server.ts` | 각 job 비교표 작성 | ⬜ |
| 2-3 | success/fail/skip와 처리량(items/sec) 계산 | `ai_agent_plan/fmp_pr_fulltext_fix/agent_log.md` | 결과 표 확인 | ⬜ |
| 2-4 | 가장 효율적인 기본값 후보 선정 | `ai_agent_plan/fmp_pr_fulltext_fix/plan.md` | 후보 선정 이유 기록 | ⬜ |

- `2-1` 목적: 낮은 concurrency 기준선(baseline)을 확보한다.
  설명: 동일 대상 row 집합에 대해 job 시작/종료 시각과 result를 기록한다.
  완료 조건(눈으로 확인): baseline run의 총시간과 결과 수가 남는다.
  사람 검증(비개발자): job log 첫 시각과 마지막 성공 시각 차이를 보면 된다.
  흔한 문제/주의: 같은 대상을 다시 쓰려면 reset 또는 동일 조건 복제 DB가 필요할 수 있다.
- `2-2` 목적: 값이 커질수록 얼마나 빨라지는지 실제 곡선을 만든다.
  설명: 같은 sourceType, 같은 범위에서 concurrency만 바꿔 반복한다.
  완료 조건(눈으로 확인): 최소 5개 값의 실행 결과가 표로 비교된다.
  사람 검증(비개발자): 어느 값부터 시간이 거의 줄지 않거나 실패가 느는지 표에서 보인다.
  흔한 문제/주의: 외부 사이트 상태에 따라 1회 결과만으로 단정하면 안 된다.
- `2-3` 목적: 단순 총시간이 아닌 효율을 수치화한다.
  설명: `processed / seconds`와 실패율을 함께 본다.
  완료 조건(눈으로 확인): items/sec 열이 표에 있다.
  사람 검증(비개발자): 가장 높은 숫자와 실패율을 같이 보면 된다.
  흔한 문제/주의: concurrency가 높아도 실패가 급증하면 기본값 후보에서 제외해야 한다.
- `2-4` 목적: 제품 기본값을 감이 아니라 실험 근거로 정한다.
  설명: fastest가 아니라 안정성 포함 “가장 효율적”인 지점을 고른다.
  완료 조건(눈으로 확인): 선택 이유가 plan/log에 문장으로 정리된다.
  사람 검증(비개발자): 왜 10 대신 다른 값이 선택됐는지 한 문단으로 이해 가능하다.
  흔한 문제/주의: 1회 우연한 burst 결과를 기본값으로 고정하지 않는다.

검증 훅:
```text
- POST /api/news/fulltext/update { sourceType: 'fmp_press_release', sourceName: 'FMP', concurrency: N }
- GET /api/jobs/:jobId 로 createdAt / updatedAt / result / logs 수집
- concurrency별 비교표 작성
```
사용자 확인 필요: **예**

#### ⬜ Step 3 — 기본값과 Control Window 연동값 정리
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | backend fulltext 기본 concurrency 값을 선정값으로 변경 | `terminal/backend/src/services/fulltextUpdateService.ts`, `terminal/backend/src/server.ts` | fallback 기본값 일치 확인 | ⬜ |
| 3-2 | frontend에 `fmp-pr-fulltext-concurrency` 전용 설정 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`, `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 초기 표시값/실행 payload 확인 | ⬜ |
| 3-3 | Control Window preset 및 설명 문구를 실험 결과에 맞게 보정 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx` | preset/설명 확인 | ⬜ |

- `3-1` 목적: API 직접 호출과 UI 경로가 같은 기본 동작을 쓰게 한다.
  설명: backend의 fallback 값과 endpoint clamp default를 동일 숫자로 맞춘다.
  완료 조건(눈으로 확인): 코드에 같은 기본값이 보인다.
  사람 검증(비개발자): 설정값을 비워도 기본 실행이 같은 숫자로 동작한다.
  흔한 문제/주의: backend와 frontend 기본값이 다르면 새 사용자와 기존 사용자 체감이 달라진다.
- `3-2` 목적: FMP PR fulltext만 별도로 조정할 수 있게 한다.
  설명: 일반 full text와 별개 키를 두고, FMP PR Only / reset 후 재실행만 이 전용 값을 읽게 한다.
  완료 조건(눈으로 확인): Data Control에 전용 섹션이 보이고 FMP PR 실행 시 해당 값이 사용된다.
  사람 검증(비개발자): Full Text 전체 설정과 FMP PR 전용 설정이 따로 보인다.
  흔한 문제/주의: 전용 설정이 있어도 실제 실행이 여전히 `ft-concurrency`만 읽지 않게 연결을 함께 바꿔야 한다.
- `3-3` 목적: 사용자가 왜 이 값을 쓰는지 UI만 보고도 이해하게 한다.
  설명: preset 목록이나 설명 문구에 “권장 기본값” 의미를 반영한다.
  완료 조건(눈으로 확인): Data Control 설명 문구가 현재 실험 결과를 반영한다.
  사람 검증(비개발자): 어떤 값이 기본인지 화면에서 바로 보인다.
  흔한 문제/주의: 지나치게 공격적인 preset을 맨 앞 기본처럼 보이게 하면 오해를 부른다.

검증 훅:
```text
- localStorage `ft-concurrency` 제거 후 Data Control 열기
- Full Text slider/숫자 기본 표시값 확인
- FMP PR Only 실행 시 payload concurrency 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 4 — 문서 동기화 + UI 락 규칙 명문화
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | backend prompt에 job category와 UI 락 기준표 반영 | `terminal/backend_prompt.md` | 문서 diff 확인 | ⏳ |
| 4-2 | frontend prompt에 `Update`/`Full Text` 분리 락 규칙 반영 | `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서 diff 확인 | ⏳ |
| 4-3 | plan/agent_log에 락 규칙 변경 이유와 영향 반영 | `ai_agent_plan/fmp_pr_fulltext_fix/plan.md`, `ai_agent_plan/fmp_pr_fulltext_fix/agent_log.md` | 기록 확인 | ⏳ |

- `4-1` 목적: backend 기본값과 실제 성능 가정을 문서화한다.
  설명: 현재 기본 concurrency와 조정 이유를 backend spec에 적는다.
  완료 조건(눈으로 확인): fulltext 섹션에 기본값과 조정 가능 범위가 보인다.
  사람 검증(비개발자): 문서만 봐도 기본값이 몇인지 알 수 있다.
  흔한 문제/주의: 코드 변경 후 문서가 예전 기본값을 유지하면 혼란이 생긴다.
- `4-2` 목적: Control Window 설명이 실제 UX와 맞게 유지되게 한다.
  설명: slider 범위, 권장값, 위험 구간을 프론트 문서에 반영한다.
  완료 조건(눈으로 확인): `Full Text Extraction` 설정 설명이 최신화된다.
  사람 검증(비개발자): 어떤 값을 권장하는지 문서에서 바로 읽힌다.
  흔한 문제/주의: 200까지 허용한다고 해서 200이 권장값처럼 보이지 않게 한다.
- `4-3` 목적: 왜 이 값이 선택됐는지 이력으로 남긴다.
  설명: 측정치와 선택 이유를 plan/log에 append한다.
  완료 조건(눈으로 확인): 결과 표 또는 요약이 기록된다.
  사람 검증(비개발자): 오늘 실험에서 어떤 값이 선택됐는지 추적 가능하다.
  흔한 문제/주의: 측정 근거 없이 결과 숫자만 적으면 재검토가 어렵다.

검증 훅:
```text
- 변경된 .md 문서에서 fulltext 기본값 / 조정 범위 / 권장 이유 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 5 — 전체 검증
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | 정적 분석 확인 | 관련 변경 파일 전부 | `get_errors` | ⏳ |
| 5-2 | backend build | `terminal/backend` | `npm.cmd run build` | ⏳ |
| 5-3 | 자동 테스트 | `terminal` 또는 `terminal/backend` | `npm.cmd run test` | ⏳ |
| 5-4 | 런타임 통합 검증 | backend API + 프론트 설정 UI | fulltext API, job polling, Data Control 확인 | ⏳ |

### 현재 UI 락 규칙 기준표

| 구분 | 현재 코드 기준 state | backend job category | 같은 category 중복 허용 | 다른 category와 동시작업 |
|-----------|------|------|------|------|
| Update 계열 | `updating` | `news-update` | 아니오 | 예 |
| Full Text 계열 | `ftUpdating` | `news-fulltext` | 아니오 | 예 |
| View Log | `selectedJobId` | 둘 다 조회 | 해당 없음 | 예 |

운영적 정의:

- `Pulling...`은 `news-update` job이 running일 때만 표시된다.
- `Extracting...`은 `news-fulltext` job이 running일 때만 표시된다.
- 둘은 job id와 polling effect가 분리되므로, 예를 들어 `FMP PR Full Text` 실행 중에도 `Recent Update`를 시작할 수 있다.
- 다만 같은 category 안의 실제 sourceType 중복은 backend route-level `409 existingJobId` guard가 막는다.

- `5-1` 목적: 성능 튜닝 과정에서 타입/구문 오류가 새로 생기지 않았는지 확인한다.
  설명: 수정한 backend/frontend 파일 diagnostics 0개를 목표로 한다.
  완료 조건(눈으로 확인): 변경 파일 error 0개.
  사람 검증(비개발자): 에러 패널에 새 오류가 없으면 된다.
  흔한 문제/주의: 상수명 변경 후 한쪽에서 누락되기 쉽다.
- `5-2` 목적: 기본값 상수와 UI 수정이 배포 빌드를 깨지 않는지 본다.
  설명: frontend/backend build 둘 다 확인한다.
  완료 조건(눈으로 확인): build exit code 0 또는 기존 unrelated 오류만 남음이 구분된다.
  사람 검증(비개발자): 빌드 성공 또는 기존 오류 유지 여부를 읽으면 된다.
  흔한 문제/주의: 기존 unrelated 오류를 이번 변경 실패와 혼동하지 않게 분리 보고한다.
- `5-3` 목적: 회귀 여부를 잡는다.
  설명: 기존 테스트를 돌려 fulltext UI/서버 변경이 다른 동작을 깨지 않았는지 본다.
  완료 조건(눈으로 확인): test pass.
  사람 검증(비개발자): pass 개수 또는 성공 여부 확인.
  흔한 문제/주의: 네트워크 벤치마크 자체는 테스트가 아니라 runtime 검증으로 분리해야 한다.
- `5-4` 목적: 기본값 변경 후 실제 사용 흐름을 확인한다.
  설명: localStorage 초기화 -> Control Window 기본값 확인 -> FMP PR Only 실행 -> job status 확인 순서로 본다.
  완료 조건(눈으로 확인): 화면 기본값과 API payload 기본값이 일치한다.
  사람 검증(비개발자): Data Control 숫자와 실행 결과가 같은 값으로 보이면 된다.
  흔한 문제/주의: 기존 localStorage 값이 남아 있으면 새 기본값 검증이 왜곡된다.

검증 훅:
```text
- get_errors
- terminal/backend: npm.cmd run build
- terminal: npm.cmd run test
- localStorage `ft-concurrency` 제거 후 UI 확인
- POST /api/news/fulltext/update (fmp_press_release)
- GET /api/jobs/:jobId 결과 확인
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. 벤치마크 대상을 실DB missing row로 할지, 복제 DB의 고정 샘플로 할지
   - 선택지 A: 실DB missing row
   - 선택지 B: 복제 DB 고정 샘플
   - 차단 대상 Step: Step 2 정확도
2. preset 버튼 목록을 실험값과 완전히 맞출지, 기존 큰 값(`50/100/200`)도 유지할지
   - 선택지 A: 권장값 중심으로 `5/10/15/20`
   - 선택지 B: 기존 큰 값 유지 + 설명만 보강
   - 차단 대상 Step: Step 3-3

### 실행 의존성 그래프
Legend: `✅ 구현+사용자확인 완료` / `⏳ 구현완료, 사용자확인 대기` / `⬜ 미착수` / `🚫 차단`

```text
Track A — 계획/측정 기준
⏳ Step 1 벤치마크 기준 고정
  ⏳ 1-1 성능 목표/지표 기록
  ⏳ 1-2 후보 concurrency/절차 확정
  ⏳ 1-3 agent_log append

Track B — 실험/분석
⬜ Step 2 속도 테스트
  ⬜ 2-1 concurrency=3 baseline
  ⬜ 2-2 5/10/15/20 반복 측정
  ⬜ 2-3 처리량/실패율 계산
  ⬜ 2-4 기본값 후보 선정

Track C — 제품 반영
⬜ Step 3 기본값/Control Window 반영
  ⬜ 3-1 backend 기본값 변경
  ⬜ 3-2 FMP PR 전용 설정 추가
  ⬜ 3-3 Control Window 설명/preset 조정

Track D — 문서/검증
⬜ Step 4 문서 동기화
  ⬜ 4-1 backend prompt 갱신
  ⬜ 4-2 frontend prompt 갱신
  ⬜ 4-3 plan/log 측정 결과 반영

⬜ Step 5 전체 검증
  ⬜ 5-1 정적 분석
  ⬜ 5-2 build
  ⬜ 5-3 자동 테스트
  ⬜ 5-4 런타임 통합 검증

의존 관계
Step 1 -> Step 2 -> Step 3 -> Step 4 -> Step 5

[차단 배너]
고정된 비교 대상(row 집합)를 확보하지 못하면 Step 2 수치 비교 신뢰도가 떨어진다.
가능하면 복제 DB 또는 동일 reset 대상 집합을 사용해 실험한다.
```

병렬 트랙 요약
- Track A는 즉시 수행 가능
- Track B는 Step 1 기준 확정 후 수행
- Track C는 Step 2에서 기본값 후보가 정해진 뒤 진행
- Track D는 코드 변경 후 진행

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| 고정 비교 대상 확보 방식 | Step 2 | 실DB missing row vs 복제 DB 고정 샘플 |
| Control Window preset 구성 | Step 3-3 | 권장값 중심 축소 vs 기존 큰 값 유지 |

### 결정 #1 — 성능 기본값 선정 원칙(상세)
- 이번 작업의 목표는 “가장 빠른 값”이 아니라 “실패율과 처리량을 같이 봤을 때 가장 효율적인 값”을 고르는 것이다.
- FMP PR fulltext는 `Business Wire` 브라우저 fallback이 포함되므로, 일반 HTTP scrape 전용 작업보다 높은 concurrency에서 효율 저하가 더 빨리 올 수 있다.
- 따라서 기본값은 벤치마크 결과상 처리량 증가가 둔화되기 직전의 값으로 선택한다.