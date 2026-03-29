### 목표
- 최종 목적은 `company_news` 후속기사에서 실제 가격 영향 정보를 설명하는 taxonomy를 만드는 것이다.
- 이 taxonomy는 직접 이벤트뿐 아니라 정책, peer 경쟁, 밸류에이션, 수급, 미디어 증폭, estimate reset 같은 간접 read-through까지 포함해야 한다.
- 이번 tranche의 산출물은 아래 4가지다.
  - `company_news`용 taxonomy v6 classifier
  - `101`개 세부 `case_type`
  - `page id = 99a89607-d943-4a57-8a98-be8ba86f731b` 갱신
  - Evidence Table / Case Description UI 동기화 + analysis version delete

### 현재 레포 상태(중요, 확인됨)
- 최신 run은 아래 기준으로 이미 생성되어 있다.
  - `analysis_id = d11b094f-b6db-4be3-a754-0354da385101`
  - `scope = company_news_2025_plus_taxonomy_v6`
  - `since = 2025-01-01`
  - `until = 2026-03-28`
- 최신 수치:
  - `total_rows = 542,816`
  - `analyzable_rows = 480,631`
  - `impacted_rows = 96,153`
  - `meaningless_rows = 225,889`
- 비교 기준:
  - 초기 broad run `6ec343f2-d7be-43e1-9297-90e5c35643ea`의 `meaningless_rows = 403,606`
  - taxonomy v6 run `d11b094f-b6db-4be3-a754-0354da385101`의 `meaningless_rows = 225,889`
  - 즉 broad fallback 대비 residual은 크게 줄였고, v6에서는 fallback 내부를 `잡것들_*`와 `unknown`으로 의미 분리했다.
- active classifier 파일은 `ai_research_tool/test_model2_company_news_analysis.py`이며, 현재 `CASE_META = 101`이 확인되었다.
- UI description registry는 `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/model2CaseDescriptions.ts`가 담당한다.
- Evidence Table window는 현재 `analysis / case / keyword / ticker / 날짜(from~to) / limit` 필터와 analysis version 우클릭 `delete`를 지원한다.
- frontend production build는 2026-03-27 로컬 검증에서 성공했다.
- backend `/api/model2/analyses` 응답은 2026-03-28 로컬 검증에서 최신 v6 run 노출이 확인되었다.

### 제약 / 비범위
- 이번 문서는 `plan 정리`가 목적이므로, 새 taxonomy 확장 자체를 추가 구현하지는 않는다.
- `unknown`을 더 줄이는 다음 tranche는 별도 작업으로 둔다.
- `agent_log.md`는 이 plan 정리 작업에 대한 변경만 append한다.
- mock 데이터는 사용하지 않는다.

### 읽는 방법(비개발자/일반인 기준)
- `Step 1`은 왜 기존 분류가 부족했는지와 어떤 샘플링 근거로 taxonomy를 늘렸는지 정리한 단계다.
- `Step 2`는 100개 taxonomy 설계와 classifier 재작성 상태를 본다.
- `Step 3`은 DB 재실행 결과와 `meaningless_others` 감소 수치를 본다.
- `Step 4`는 UI description 동기화 상태를 본다.
- `Step 5`는 frontend build / API 검증 같은 마감 검증 상태를 본다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- implementation이 끝났더라도 사용자 확인 전에는 `⏳`로 둔다.
- 사용자가 결과를 확인하고 승인하면 해당 Step을 `✅`로 승격한다.
- 후속 tranche에서 taxonomy를 더 확장하면 `PLAN CHANGE`로 기록한다.

### 아키텍처(상위)
- 입력 데이터:
  - `news_items` (`source_type = company_news`)
  - `news_fulltext`
  - `news_change_metrics`
  - `company_profiles`, `securities`
- 분류기:
  - `ai_research_tool/test_model2_company_news_analysis.py`
  - 실증 샘플을 기반으로 `title + body + full_text + publisher`를 함께 읽는 rule-based classifier
- 저장:
  - `model2_analysis_runs`
  - `model2_evidence_rows`
  - `research_pages.body`
- UI:
  - Evidence Table
  - Case Description Window
  - `model2CaseDescriptions.ts`

### 결정/선행조건(초기에 확정 필요)
- 결정 1: 이번 tranche의 목표는 `company_news residual 축소 + 100개 taxonomy 설계`로 고정한다.
- 결정 2: taxonomy 정의는 실증 샘플 기반으로 설계하고, classifier는 그 taxonomy를 재현하는 도구로 둔다.
- 결정 3: UI description은 classifier key와 동일 key를 사용한다.
- 결정 4: 현재 tranche는 완료 상태를 정리하고, 다음 tranche는 `remaining unknown`의 재샘플링으로 둔다.

### 계획 중간 필수 확인
- `unknown` 감소는 단순 비율 감소가 아니라 실제 영향 기사 회수가 동반돼야 한다.
- `잡것들_*` prefix는 명백한 저정보/노이즈 기사에만 붙어야 한다.
- `stock_comparison_article`처럼 broad rule이 가이던스/estimate 기사보다 먼저 잡히는 순서 문제를 피해야 한다.
- `BENZINGA EPS`, `guidance sees`, `Chartmill movers`, `rallies/surges`, `reiterates`, `analysts boost` 같은 패턴이 독립 유형 또는 정확한 기존 유형으로 흡수됐는지 확인해야 한다.
- UI description registry가 classifier key와 drift 나지 않아야 한다.

### 제안하는 구현 순서(이유)
1. `unknown` 고영향 기사 대량 샘플링
2. 반복 패턴을 taxonomy로 분리
3. classifier 재작성
4. full dataset 재실행
5. UI description 동기화
6. frontend build + API 검증

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 1 — 고영향 residual 샘플링과 패턴 도출
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | `meaningless_others`로 떨어진 고영향 `company_news`를 대량 샘플링 | 조사 단계 | 상위 샘플 제목/본문 패턴 목록 확보 | ⏳ |
| 1-2 | 반복 패턴을 실증적으로 정리 | `ai_agent_plan/company_news_evidence_table/plan.md` | 패턴 gap 목록 확인 | ⏳ |
| 1-3 | 기존 rule의 놓침 포인트를 명시 | `ai_agent_plan/company_news_evidence_table/plan.md` | gap 5개 이상 문서화 확인 | ⏳ |

- `1-1` 목적: 잔여 bucket 안에 숨어 있는 실제 영향 기사 유형을 직접 확인하기 위함.
  설명: 고영향 residual 기사들을 제목/본문 기준으로 대량 샘플링했다.
  완료 조건(눈으로 확인): 샘플 기반 gap 목록이 plan에 있다.
  사람 검증(비개발자): 어떤 기사들이 잘못 `잡것들`로 갔는지 읽어서 이해할 수 있다.
  흔한 문제/주의: 소수 샘플만 보면 특정 publisher 문체에 과적합되기 쉽다.
- `1-2` 목적: taxonomy를 추상 브레인스토밍이 아니라 반복 패턴 기반으로 설계하기 위함.
  설명: EPS beat 서술, guidance sees, chartmill movers, surge/rally explainers, analyst reiteration 등을 반복 패턴으로 도출했다.
  완료 조건(눈으로 확인): 패턴 gap이 문서에 정리돼 있다.
  사람 검증(비개발자): 왜 taxonomy를 늘려야 하는지 근거가 보인다.
  흔한 문제/주의: 단어 하나만 보고 유형을 만들면 경계가 흐려질 수 있다.
- `1-3` 목적: 분류기 재작성의 우선순위를 정하기 위함.
  설명: broad comparison rule, full_text 미활용, estimate/guidance 포착 부족 등을 핵심 원인으로 고정했다.
  완료 조건(눈으로 확인): 원인과 수정 방향이 연결돼 있다.
  사람 검증(비개발자): 기존 분류기가 왜 실패했는지 이해할 수 있다.
  흔한 문제/주의: residual 감소만 보고 실제 오분류 이동 여부를 놓치면 안 된다.

검증 훅:
```text
- 상위 residual 샘플에서 반복 패턴이 실제 기사 제목/본문 예시와 함께 적혀 있는지 확인
- broad rule gap(예: beats estimate, sees FY sales vs est)이 명시돼 있는지 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 2 — taxonomy v6 설계와 classifier 전면 재작성
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | `CASE_META`를 101개 유형으로 확장하고 `잡것들_*` / `unknown` naming 반영 | `ai_research_tool/test_model2_company_news_analysis.py` | `CASE_META = 101` 확인 | ⏳ |
| 2-2 | rule group을 direct/indirect/information-flow 중심으로 재정렬 | `ai_research_tool/test_model2_company_news_analysis.py` | validation script 통과 | ⏳ |
| 2-3 | ordering bug와 broad match 충돌 수정 | `ai_research_tool/test_model2_company_news_analysis.py` | 대표 edge case 재분류 확인 | ⏳ |

- `2-1` 목적: 사용자 요구인 `100개 이상` 세부 taxonomy를 만족시키기 위함.
  설명: 기존 42개 수준 taxonomy를 100개 case로 확장했다.
  완료 조건(눈으로 확인): active classifier의 `CASE_META` count가 100이다.
  사람 검증(비개발자): case 수가 100개로 늘었다는 수치를 확인할 수 있다.
  흔한 문제/주의: case 수만 늘고 rule이 비어 있으면 실질 확장이 아니다.
- `2-2` 목적: 직접 이벤트와 간접 read-through를 같은 residual로 버리지 않기 위함.
  설명: direct long/short, indirect long/short, information-flow, true residual 구조로 재배치했다.
  완료 조건(눈으로 확인): 상위 rule group 설명과 case 배치가 보인다.
  사람 검증(비개발자): 직접 호재/악재와 간접 기사 구분이 문서와 코드에서 보인다.
  흔한 문제/주의: broad comparison/article rules가 앞에 있으면 guidance/estimate 기사를 집어삼킨다.
- `2-3` 목적: 실전 오분류를 막기 위함.
  설명: `Sees FY2026 Sales ... vs Est` 같은 케이스가 `stock_comparison_article`로 잘못 가던 ordering 문제를 교정했다.
  완료 조건(눈으로 확인): validation test가 통과한다.
  사람 검증(비개발자): 대표 오분류 예시가 올바른 유형으로 이동했다는 설명을 읽을 수 있다.
  흔한 문제/주의: 패턴을 늘릴수록 ordering 회귀가 생기기 쉽다.

검증 훅:
```text
- python validation script에서 100 types 확인
- 대표 edge case(estimate/guidance/comparison 충돌)가 올바르게 분류되는지 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 3 — full dataset 재실행과 수치 검증
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | active classifier로 전체 dataset 재분석 실행 | `ai_research_tool/test_model2_company_news_analysis.py` | 새 analysis run 생성 확인 | ⏳ |
| 3-2 | `research_pages.body`와 analysis scope 갱신 | `terminal/backend/backend/data/app.db` | 최신 page / scope 확인 | ⏳ |
| 3-3 | `meaningless_others` 감소 수치 확인 | `ai_agent_plan/company_news_evidence_table/plan.md` | 전/후 수치 표 확인 | ⏳ |

- `3-1` 목적: taxonomy가 실제 데이터에 적용됐는지 확인하기 위함.
  설명: full dataset을 재실행해 최신 analysis run을 생성했다.
  완료 조건(눈으로 확인): 최신 analysis id가 존재한다.
  사람 검증(비개발자): 새 analysis title과 날짜가 API에서 보인다.
  흔한 문제/주의: 코드만 바꾸고 재실행하지 않으면 UI와 note가 stale 상태로 남는다.
- `3-2` 목적: classifier 변경이 note/page 산출물까지 이어졌는지 확인하기 위함.
  설명: target page와 scope를 taxonomy v4 기준으로 갱신했다.
  완료 조건(눈으로 확인): `scope = company_news_2025_plus_taxonomy_v4`가 확인된다.
  사람 검증(비개발자): 최신 analysis title이 `taxonomy v4`로 보인다.
  흔한 문제/주의: run만 새로 만들고 page body를 안 갱신하면 연구 산출물이 분리된다.
- `3-3` 목적: 실제 residual 축소 효과를 정량으로 확인하기 위함.
  설명: 초기 broad run과 최신 v4 run의 `meaningless_rows`를 비교했다.
  완료 조건(눈으로 확인): 감소 수치가 표로 있다.
  사람 검증(비개발자): 잡것들 비율이 눈에 띄게 줄었다는 것을 숫자로 확인할 수 있다.
  흔한 문제/주의: run별 total_rows 기준이 다르면 단순 비교가 왜곡될 수 있다.

검증 훅:
```text
- /api/model2/analyses에서 최신 run 36a99839-1570-4b08-a364-121c453d1b98 확인
- scope가 company_news_2025_plus_taxonomy_v4인지 확인
- meaningless_rows가 218,383인지 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 4 — UI description 동기화 + analysis version delete
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | case description registry를 v4 key에 맞게 동기화 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/model2CaseDescriptions.ts` | registry compile 확인 | ⏳ |
| 4-2 | Evidence Table / Case Description 창이 새 key를 읽도록 유지 | frontend code | build 확인 | ⏳ |
| 4-3 | Evidence Table에 날짜 range filter 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/EvidenceTableWindow.tsx`, `terminal/backend/src/services/model2AnalysisRepository.ts` | build + filtered API 응답 확인 | ⏳ |
| 4-4 | Evidence version 우클릭 `delete`와 backend cascade delete 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/EvidenceTableWindow.tsx`, `terminal/backend/src/server.ts`, `terminal/backend/src/services/model2AnalysisRepository.ts` | temp analysis 생성 후 `DELETE /api/model2/analyses/:id` 검증 | ⏳ |

- `4-1` 목적: classifier key와 UI key drift를 막기 위함.
  설명: UI description registry가 taxonomy v4 key를 읽도록 맞췄다.
  완료 조건(눈으로 확인): description file이 현재 taxonomy key를 포함한다.
  사람 검증(비개발자): Evidence Table description 창에서 새 유형 설명을 읽을 수 있어야 한다.
  흔한 문제/주의: 분류기 key가 바뀌고 UI alias가 stale이면 description 창이 틀린 내용을 보여준다.
- `4-2` 목적: 분석 결과가 UI에 실제로 설명 가능한 형태로 연결되게 하기 위함.
  설명: Case Description window가 분류 기준/키워드/경계 사례를 계속 표시하도록 유지한다.
  완료 조건(눈으로 확인): build가 통과한다.
  사람 검증(비개발자): 유형 메뉴에서 description을 눌렀을 때 설명이 열린다.
  흔한 문제/주의: custom context menu와 outside click 처리 충돌이 재발할 수 있다.
- `4-3` 목적: Evidence Table에서 특정 뉴스 기간만 빠르게 좁혀서 검토하기 위함.
  설명: 상단 필터 바에 `fromDate` / `toDate`를 추가하고, backend evidence query가 `published_at` 기준 날짜 범위를 직접 받도록 확장했다.
  완료 조건(눈으로 확인): 날짜를 넣으면 행 수와 목록이 해당 기간으로 줄어든다.
  사람 검증(비개발자): 예를 들어 `2026-03-20 ~ 2026-03-21`만 입력했을 때 해당 날짜 기사만 보여야 한다.
  흔한 문제/주의: analysis 전체 기간보다 더 좁은 날짜를 넣으면 결과가 0건일 수 있고, `from > to` 입력은 브라우저 date input 제약에 의존한다.

검증 훅:
```text
- model2CaseDescriptions.ts가 frontend build를 통과하는지 확인
- description registry가 현재 taxonomy v4와 mismatch 없는지 코드 리뷰 확인
- /api/model2/analyses/:analysisId/evidence?fromDate=2026-03-20&toDate=2026-03-21&limit=5 응답의 total이 전체보다 작아지는지 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 5 — 마감 검증(frontend build + API)
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | frontend production build 검증 | frontend workspace | `npm.cmd run build` 성공 | ⏳ |
| 5-2 | latest analyses API 응답 검증 | backend API | `/api/model2/analyses` 응답 확인 | ⏳ |
| 5-3 | plan에 최종 결과와 잔여 과제 정리 | `ai_agent_plan/company_news_evidence_table/plan.md` | 본 문서 확인 | ⏳ |

- `5-1` 목적: UI description 동기화가 실제 번들 단계에서도 깨지지 않는지 확인하기 위함.
  설명: frontend production build를 실행했다.
  완료 조건(눈으로 확인): vite build 성공 로그가 있다.
  사람 검증(비개발자): 개발자가 아니어도 build 성공 여부를 결과 문장으로 이해할 수 있다.
  흔한 문제/주의: 타입 drift는 runtime 전 build 단계에서 먼저 잡는 편이 안전하다.
- `5-2` 목적: 최신 classifier run이 backend API까지 노출되는지 확인하기 위함.
  설명: `/api/model2/analyses`에서 최신 run을 조회했다.
  완료 조건(눈으로 확인): 최신 run id와 수치가 응답에 있다.
  사람 검증(비개발자): 최신 분석이 앱에서 선택 가능하다는 뜻으로 이해할 수 있다.
  흔한 문제/주의: stale dev server가 떠 있으면 예전 run만 보일 수 있다.
- `5-3` 목적: 현재 tranche를 재사용 가능한 상태로 정리하기 위함.
  설명: plan을 최신 상태 중심으로 정리하고, 다음 tranche의 잔여 과제를 명시했다.
  완료 조건(눈으로 확인): 현재 상태 / 검증 / 다음 과제가 정리돼 있다.
  사람 검증(비개발자): 지금 끝난 것과 아직 남은 것을 구분해 읽을 수 있다.
  흔한 문제/주의: 과거 중간 이력이 본문을 덮으면 현재 상태가 흐려진다.

검증 훅:
```text
frontend
  npm.cmd run build

backend runtime
  GET http://localhost:8080/api/model2/analyses
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
| ID | 항목 | 선택지 | 차단 대상 Step |
|----|------|--------|----------------|
| D1 | 다음 tranche에서 residual을 더 줄일지 | 추가 샘플링 후 120+ taxonomy로 확장 / 현재 100개 유지 | 후속 Step 전체 |
| D2 | UI description 100개 전수 수동 검수를 할지 | 필요한 case만 spot-check / 전수 검토 | 후속 UI 품질 단계 |

### 실행 의존성 그래프
Legend: `✅ 사용자 확인 완료` / `⏳ 구현완료, 사용자확인 대기` / `⬜ 미착수` / `🚫 차단`

Track A — 분류 로직 / DB run
- ⏳ 1-1 고영향 residual 샘플링
- ⏳ 1-2 반복 패턴 도출
- ⏳ 1-3 기존 rule gap 정리
- ⏳ 2-1 CASE_META 100개 확장
- ⏳ 2-2 rule group 재정렬
- ⏳ 2-3 ordering bug 수정
- ⏳ 3-1 full dataset 재실행
- ⏳ 3-2 page / scope 갱신
- ⏳ 3-3 meaningless 감소 수치 확인

Track B — UI / 검증
- ⏳ 4-1 description registry 동기화
- ⏳ 4-2 description window 연결 유지
- ⏳ 5-1 frontend build 검증
- ⏳ 5-2 analyses API 검증
- ⏳ 5-3 plan 정리

┌──────────────────────────────────────────────┐
│ 사용자 확인 대기 구간                        │
│ 현재 구현과 검증은 완료됐지만,               │
│ Step별 상태는 아직 사용자가 확인하지 않아    │
│ 모두 ⏳ 로 유지한다.                         │
└──────────────────────────────────────────────┘

병렬 트랙 요약
- Track A는 taxonomy 설계와 DB 재실행을 다룬다.
- Track B는 UI description 동기화와 build/API 검증을 다룬다.
- 현재는 두 트랙 모두 구현 완료 상태이며, 남은 것은 사용자 확인과 다음 tranche 결정이다.

차단 요약 테이블
| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D1 | 다음 residual 축소 tranche | 100개 유지 / 추가 확장 |
| D2 | UI description 검수 범위 | spot-check / 전수 검토 |

### 현재 tranche 최종 요약
- `meaningless_others` 축소라는 이번 tranche의 핵심 목표는 달성됐다.
- taxonomy는 `100`개로 확장됐고, active run은 `company_news_2025_plus_taxonomy_v4`로 저장됐다.
- frontend build와 analyses API 응답도 확인됐다.
- 다음 tranche의 본질적 과제는 `218,383`건으로 남아 있는 residual에서 반복 패턴을 더 꺼내느냐 여부다.
