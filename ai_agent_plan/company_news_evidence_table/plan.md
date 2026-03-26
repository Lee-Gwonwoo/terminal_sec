### 목표
- `page id = 99a89607-d943-4a57-8a98-be8ba86f731b` 대상의 Model 2 분석 결과를 company news 기준으로 정리한다.
- 기존 research page 본문에는 company news 전체를 분류한 유형 체계와 유형 설명을 저장한다.
- 별도 새 window `evidence table`을 추가해, 유형별 근거 뉴스 행들을 표 형태로 조회할 수 있게 한다.
- `evidence table` window 안에서 유형별 메뉴 선택, 제목/발행시각/publish/summary 등 뉴스 필드 표시, 정렬, 키워드 검색, ticker 검색을 지원한다.
- 이번 단계에서는 **plan만 작성**하고, 아직 분석 실행이나 UI 구현은 하지 않는다.

### 현재 진행 상태(2026-03-26 업데이트)
- 완료:
  - backend DB schema에 `model2_analysis_runs`, `model2_evidence_rows` 추가
  - backend API 추가
    - `GET /api/model2/analyses`
    - `GET /api/model2/analyses/:analysisId`
    - `GET /api/model2/analyses/:analysisId/cases`
    - `GET /api/model2/analyses/:analysisId/evidence`
  - frontend에 새 window type `evidence-table` 및 `EvidenceTableWindow.tsx` 추가
  - `2025-01-01+ company_news` 대상 1차 Model 2 분석 run 생성 및 page 저장 완료
- 생성된 첫 analysis run:
  - `analysis_id = 6ec343f2-d7be-43e1-9297-90e5c35643ea`
  - 전체 row: `599,681`
  - analyzable row: `527,876`
  - impacted row: `105,608`
  - `잡것들`: `448,556`
- 남은 작업:
  - taxonomy false positive를 보고 후속 규칙 보정
  - web UI에서 실제 수동 확인 후 사용자 피드백 반영

### 현재 레포 상태(중요, 확인됨)
- 대상 research page는 이미 존재한다.
  - `page id`: `99a89607-d943-4a57-8a98-be8ba86f731b`
  - 현재 title: `company news analysis prompt`
  - 현재 tab: `investing task logic`
- 현재 research note 저장은 `terminal/backend/backend/data/app.db`의 `research_tabs`, `research_pages` 테이블을 사용한다.
- 현재 프론트에는 `AI Research Window`(`case-research`)가 이미 존재하고, `CaseResearchWindow.tsx`가 `/api/research/*`를 사용해 page 본문을 편집/저장한다.
- 현재 window 시스템은 `src/app/types.ts`, `src/app/App.tsx`, `src/app/components/AddTabModal.tsx`, `src/app/components/DraggableWindow.tsx`에서 관리한다.
- 현재 뉴스 테이블의 실질적인 기준 구현은 `FinnhubNewsWindow.tsx`이다.
  - 서버사이드 검색, ticker 검색, source filter, sortable columns, column visibility, display mode, full text modal 등 이미 구현돼 있다.
  - 새 `evidence table` window는 이 창의 표 패턴과 상호작용을 최대한 재사용하는 쪽이 안전하다.
- 현재 `ai_research_tool/model2_case_analysis.py`가 이미 존재한다.
  - 이 스크립트는 현재 `press_release only`로 고정돼 있다.
  - `title/body/full_text`를 regex 기반 `CATEGORY_RULES`와 `CASE_TYPE_GUIDANCE`로 분류한다.
  - 즉, **현재 스크립트는 agent가 기사 하나하나를 직접 읽어 판단하는 방식이 아니라 규칙 기반 자동 분류기**다.
  - 또한 evidence markdown 파일 생성과 `research_pages.body` 업데이트 기능이 이미 있다.
- 따라서 사용자가 말한 `model 2 지침대로 분석`을 그대로 만족하려면, 단순히 기존 스크립트를 company_news에 돌리는 것만으로 충분한지 먼저 결정해야 한다.
  - 이유: 현재 스크립트는 `press_release`용 taxonomy/패턴을 전제로 설계되어 있고, company news는 재서술 기사/언론 기사/요약 기사 성격이 더 강하다.

### 제약 / 비범위
- 이번 1차 구현은 rule-based 분류다. 기사별 수동 판독형 taxonomy 보정은 아직 완료가 아니다.
- 대규모 `company_news`에 대해 1차 전수 분류와 evidence UI 연결까지는 수행했지만, false positive 정제는 후속 단계다.
- mock 데이터는 사용하지 않는다.
- 기존 `FinnhubNewsWindow`의 운영 semantics를 함부로 바꾸지 않는다.
- 기존 `CaseResearchWindow`를 제거하거나 대체하지 않는다. `evidence table`은 별도 window로 추가한다.

### 읽는 방법(비개발자/일반인 기준)
- `Step 1`은 “무엇을 분석이라고 볼 것인가”를 먼저 고정하는 단계다.
- `Step 2`는 company news용 유형 체계와 근거 표 데이터 구조를 정하는 단계다.
- `Step 3`은 research page 본문과 evidence dataset을 실제로 만드는 단계다.
- `Step 4`는 evidence table 전용 backend API를 만드는 단계다.
- `Step 5`는 evidence table window를 UI에 붙이는 단계다.
- `Step 6`은 전체 검증 단계다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- company news 분석 방식이 바뀌면 `PLAN CHANGE`로 기록한다.
- 각 Step 완료 후 다음 3가지를 같이 확인한다.
  - 무엇이 바뀌었는지
  - 사용자가 직접 확인할 수 있는 방법
  - 남은 리스크와 완화 방안
- 사용자 확인 전에는 완료 항목도 `⏳`로 유지한다.
- 사용자 확인 후에만 `✅`로 승격한다.

### 아키텍처(상위)
- 데이터 입력:
  - 기본 source: `news_items.source_type = 'company_news'`
  - 본문 보강: `news_fulltext.full_text`
  - 반응률: `news_change_metrics`
  - 기업 컨텍스트: `company_profiles`, `securities`
- 분석 산출물:
  - research page 본문: 대상 page id의 `research_pages.body`
  - evidence row dataset: 유형별 근거 뉴스 행 목록
- UI 출력:
  - 기존 `AI Research Window`: 유형 설명/분석 note 확인
  - 새 `evidence table` window: 유형 선택 후 근거 뉴스 표 조회
- 권장 구현 방향:
  1. company news용 분석 로직이 research page 본문과 evidence row를 함께 생성
  2. backend가 evidence row를 JSON API로 제공
  3. frontend evidence table window가 그 API를 받아 표 렌더링

### 결정/선행조건(초기에 확정 필요)
- 결정 1: `분석`의 의미
  - 선택지 A: 기존 `model2_case_analysis.py`를 company news에 맞게 확장한 규칙 기반 분류를 사용한다.
  - 선택지 B: agent가 Model 2 지침에 따라 실제 뉴스들을 읽고 유형을 설계/보정한 뒤, 그 결과를 저장하는 반수동 분석을 한다.
  - 현재 권장: **B를 기준으로 taxonomy를 먼저 확정하고, 이후 반복 실행 가능한 부분만 A로 코드화**한다.
  - 이유: 기존 스크립트는 `press_release only` 전제이며, company news는 같은 규칙을 그대로 적용하면 오분류 가능성이 높다.
- 결정 2: evidence row 저장 위치
  - 선택지 A: markdown 파일만 생성하고 UI는 markdown을 파싱한다.
  - 선택지 B: backend가 DB 조회 + 분석 결과를 JSON row로 제공하고 UI는 JSON API를 사용한다.
  - 현재 권장: **B**
  - 이유: 정렬, 검색, 메뉴 필터, 컬럼 제어는 markdown 파싱보다 JSON API가 훨씬 안전하다.
- 결정 3: 새 window의 연결 방식
  - 선택지 A: `CaseResearchWindow` 내부 패널로 추가
  - 선택지 B: 별도 `WindowType`인 `evidence-table`로 추가
  - 현재 권장: **B**
  - 이유: 사용자가 명시적으로 “새로운 윈도우”를 요청했다.
- 결정 4: evidence dataset의 영속 방식
  - 선택지 A: 매번 page id 기준으로 동적 재계산
  - 선택지 B: page id 또는 note title 기준으로 evidence 결과를 별도 저장/캐시
  - 현재 권장: **1차는 B보다 A에 가깝게 단순화**, 즉 backend가 분석 산출 row를 API로 읽게 하되, 장기적으로 캐시 여부를 후속 결정
  - 이유: 먼저 기능을 닫고, 이후 성능 병목이 있으면 캐시/테이블을 추가하는 편이 낫다.

### 계획 중간 필수 확인
- company news 전수 범위를 정확히 고정해야 한다.
  - source 이름: `FINNHUB`인지, `FMP` company news도 함께 넣을지
  - source_type은 `company_news`만인지, `news`/`market_news`를 섞을지
- 기존 `model2_case_analysis.py`의 `press_release only` 가정이 어디까지 박혀 있는지 점검해야 한다.
- evidence table에 필요한 최소 컬럼을 확정해야 한다.
  - 유형
  - 뉴스 제목
  - publish/published_at
  - summary/body preview
  - ticker
  - source/source_type
  - reaction metrics
- research page 본문과 evidence row 사이의 연결 키를 확정해야 한다.
  - `page_id`
  - `case_type`
  - `news_id`

### 제안하는 구현 순서(이유)
1. 먼저 `분석`이 규칙 기반 자동 분류인지, agent 주도 taxonomy 설계인지 확정해야 한다.
2. 그 다음 company news용 case taxonomy와 evidence row schema를 정해야 한다.
3. 그 다음 page 본문과 evidence dataset을 생성해야 한다.
4. 그 뒤에 backend API를 만들어야 UI가 안정적으로 데이터를 받을 수 있다.
5. 마지막에 새 `evidence table` window를 붙여도 늦지 않다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⬜ Step 1 — company news Model 2 분석 방식 확정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | 기존 `model2_case_analysis.py`가 현재 무엇을 자동으로 하는지, 무엇을 못 하는지 정리 | `ai_agent_plan/company_news_evidence_table/plan.md` | plan 문서에 규칙 기반 한계 명시 확인 | ⬜ |
| 1-2 | company news에 대해 agent 직접 분석이 필요한 범위와 자동화 가능한 범위를 분리 | `ai_agent_plan/company_news_evidence_table/plan.md` | plan 문서의 결정 섹션 확인 | ⬜ |
| 1-3 | 이번 작업의 1차 목표를 `company_news taxonomy + evidence row UI`로 고정 | `ai_agent_plan/company_news_evidence_table/plan.md` | 목표/비범위 섹션 확인 | ⬜ |

- `1-1` 목적: 기존 스크립트가 이미 무엇을 하는지 착각하지 않기 위함.
  설명: 현재 스크립트는 regex/rule 기반 자동 분류기이며, agent의 직접 해석과는 다르다는 점을 명시한다.
  완료 조건(눈으로 확인): plan에 “현재 스크립트는 규칙 기반” 문구가 있다.
  사람 검증(비개발자): 문서를 읽고 “지금은 AI가 직접 읽어 나누는 게 아니라 자동 룰이구나”를 알 수 있다.
  흔한 문제/주의: 기존 스크립트가 있으니 그대로 돌리면 된다고 오해하기 쉽다.
- `1-2` 목적: 이후 구현 범위를 과장하지 않기 위함.
  설명: taxonomy 설계는 agent/사용자 검토 중심, 반복 적용은 코드화 대상으로 분리한다.
  완료 조건(눈으로 확인): 결정 항목에 직접 분석 vs 자동 분류 구분이 적혀 있다.
  사람 검증(비개발자): 어떤 부분을 사람이 보고 확정하는지 문서에서 확인 가능하다.
  흔한 문제/주의: 이 구분이 없으면 “Model 2 지침대로 분석”과 “기존 규칙 스크립트 확장”이 뒤섞인다.
- `1-3` 목적: 1차 결과물을 명확히 한정하기 위함.
  설명: 이번 작업은 분석 note와 evidence table 기능을 연결하는 데 초점을 둔다.
  완료 조건(눈으로 확인): 목표와 제약에 1차 범위가 명확히 적혀 있다.
  사람 검증(비개발자): 지금 당장 뭘 만들고 뭘 안 만드는지 읽을 수 있다.
  흔한 문제/주의: score/keywords 같은 Model 3 영역까지 섞으면 범위가 커진다.

검증 훅:
```text
- plan.md의 현재 레포 상태 섹션에서 기존 model2 스크립트의 성격이 정확히 적혀 있는지 확인
- 결정/선행조건 섹션에서 직접 분석 vs 자동 분류 구분이 보이는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 2 — company news용 taxonomy와 evidence row schema 설계
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | company news 전체를 어떤 source/source_type 범위로 볼지 확정 | `ai_agent_plan/company_news_evidence_table/plan.md` | 범위 정의 문구 확인 | ⬜ |
| 2-2 | company news용 case_type, top_level(long/short/residual), evidence row 최소 컬럼 설계 | `ai_agent_plan/company_news_evidence_table/plan.md` | 컬럼 목록 확인 | ⬜ |
| 2-3 | summary 필드 정의를 고정 | `ai_agent_plan/company_news_evidence_table/plan.md` | summary가 body인지 full_text preview인지 명시 확인 | ⬜ |
| 2-4 | 유형 메뉴와 표 필터에 필요한 key 구조 정의 | `ai_agent_plan/company_news_evidence_table/plan.md` | `case_type`, `top_level`, `news_id` 관계 확인 | ⬜ |

- `2-1` 목적: 어떤 뉴스가 evidence table에 들어가는지 애매함을 없애기 위함.
  설명: `company_news` 전체를 쓸지, source 이름까지 제한할지 먼저 정한다.
  완료 조건(눈으로 확인): source/source_type 범위가 문장으로 고정돼 있다.
  사람 검증(비개발자): 어떤 뉴스가 대상이고 아닌지 읽으면 안다.
  흔한 문제/주의: `company_news`와 `news`를 섞으면 유형 의미가 흔들릴 수 있다.
- `2-2` 목적: UI와 backend가 같은 데이터 구조를 보게 하기 위함.
  설명: evidence table의 최소 컬럼과 정렬 가능한 컬럼을 함께 정한다.
  완료 조건(눈으로 확인): 컬럼 목록이 plan에 있다.
  사람 검증(비개발자): 표에 어떤 열이 보일지 알 수 있다.
  흔한 문제/주의: `publish`와 `published_at` 이름 혼용을 피해야 한다.
- `2-3` 목적: 사용자가 말한 summary가 무엇을 뜻하는지 모호함을 없애기 위함.
  설명: body 요약, full_text preview, 또는 별도 summary 계산 중 무엇을 쓸지 정한다.
  완료 조건(눈으로 확인): summary 생성 규칙이 적혀 있다.
  사람 검증(비개발자): 표에서 보게 될 summary가 무엇인지 이해 가능하다.
  흔한 문제/주의: source마다 body 길이/품질이 달라 summary 표시가 들쭉날쭉할 수 있다.
- `2-4` 목적: 유형 메뉴와 표가 같은 key로 연결되게 하기 위함.
  설명: 메뉴 선택값과 row의 `case_type` 필드를 일치시킨다.
  완료 조건(눈으로 확인): 필터 key 구조가 적혀 있다.
  사람 검증(비개발자): 메뉴에서 유형 선택 시 어떤 데이터가 보여야 하는지 이해 가능하다.
  흔한 문제/주의: label과 내부 key를 다르게 두면 API/UI 매핑이 꼬일 수 있다.

검증 훅:
```text
- plan.md에 evidence table 최소 컬럼이 명시되어 있는지 확인
- 유형 메뉴 key와 row key가 동일 구조로 설명돼 있는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 3 — Model 2 결과 생성 및 research page 반영
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | company news 전수 데이터를 읽어 유형별 분류 결과를 만든다 | `ai_research_tool/model2_case_analysis.py` 또는 후속 구현 파일 | 생성 결과 샘플 확인 | ⬜ |
| 3-2 | 대상 page id 본문에 유형 설명과 분류 결과를 저장 | `terminal/backend/backend/data/app.db`의 `research_pages` | page body 조회 확인 | ⬜ |
| 3-3 | evidence table용 row dataset을 함께 생성 | 후속 구현 파일 또는 API용 저장 구조 | row 수/샘플 확인 | ⬜ |

- `3-1` 목적: 실제 company news 기반 Model 2 결과를 만든다.
  설명: 이 단계에서야 비로소 company news 전체를 유형별로 나눈다.
  완료 조건(눈으로 확인): 유형별 summary와 근거 row가 생성된다.
  사람 검증(비개발자): 대표 유형 몇 개와 샘플 뉴스가 정리돼 있음을 볼 수 있다.
  흔한 문제/주의: press_release용 규칙을 그대로 사용하면 company_news에서 오분류가 많아질 수 있다.
- `3-2` 목적: 사용자가 준 page id에 분석 결과를 실제로 저장한다.
  설명: 채팅 설명만이 아니라 page 본문이 업데이트되어야 한다.
  완료 조건(눈으로 확인): page body가 빈 값이 아니게 된다.
  사람 검증(비개발자): AI Research Window에서 해당 page 내용이 보인다.
  흔한 문제/주의: title은 유지하고 body만 갱신할지, title도 바꿀지 먼저 정해야 한다.
- `3-3` 목적: 이후 UI가 바로 읽을 수 있는 근거 데이터 집합을 만든다.
  설명: 유형 선택 시 표에 뿌릴 row 단위를 만든다.
  완료 조건(눈으로 확인): row 예시가 출력/저장된다.
  사람 검증(비개발자): 특정 유형을 선택하면 그 유형 뉴스 목록을 볼 수 있어야 한다.
  흔한 문제/주의: markdown 파일만 있으면 UI 정렬/검색이 불편해진다.

검증 훅:
```text
- research_pages.body가 page id 기준으로 업데이트됐는지 확인
- evidence row 샘플 10건에서 case_type, title, published_at, summary, ticker가 채워지는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 4 — evidence table backend API 설계 및 구현
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | evidence table row 조회 endpoint 추가 | `terminal/backend/src/server.ts` | endpoint 응답 확인 | ⬜ |
| 4-2 | page id / case_type / keyword / ticker / sort 조건 처리 로직 추가 | `terminal/backend/src/services/*` 후속 파일 | 필터 응답 확인 | ⬜ |
| 4-3 | summary/title/published/source/change 필드를 UI 친화적으로 내려주도록 응답 shape 고정 | `terminal/backend/src/types.ts`, 후속 service 파일 | JSON shape 확인 | ⬜ |

- `4-1` 목적: UI가 근거 데이터를 정식 API로 읽게 하기 위함.
  설명: page id 기준 evidence rows를 반환하는 endpoint를 만든다.
  완료 조건(눈으로 확인): `/api/...` endpoint가 생긴다.
  사람 검증(비개발자): API 호출 시 JSON 목록이 나온다.
  흔한 문제/주의: research page 본문과 row dataset을 다른 key로 저장하면 lookup이 안 될 수 있다.
- `4-2` 목적: evidence table window의 검색/정렬/유형 메뉴를 backend에서 처리하기 위함.
  설명: `case_type`, `keyword`, `ticker`, `sortBy`, `sortDir` 등을 받는다.
  완료 조건(눈으로 확인): 필터 query params가 정의된다.
  사람 검증(비개발자): 특정 티커나 키워드를 넣었을 때 결과가 줄어드는지 보면 된다.
  흔한 문제/주의: 프론트 필터와 백엔드 필터 명칭을 다르게 두면 디버깅이 힘들다.
- `4-3` 목적: 프론트에서 추가 변환 없이 바로 표를 그리게 하기 위함.
  설명: published time, summary preview, source label 등을 정돈해서 내려준다.
  완료 조건(눈으로 확인): 응답 필드가 문서화돼 있다.
  사람 검증(비개발자): API 결과를 봤을 때 표 열과 대응됨을 알 수 있다.
  흔한 문제/주의: 긴 full_text를 그대로 내려주면 payload가 과해질 수 있다.

검증 훅:
```text
- page id 기준 evidence row API 응답 200 확인
- case_type, ticker, keyword 조합 필터가 각각 동작하는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 5 — 새 `evidence table` window 구현
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | `WindowType`에 `evidence-table` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts` | 타입 빌드 확인 | ⬜ |
| 5-2 | `AddTabModal`, `App`, `DraggableWindow`에 새 window 연결 | 관련 3개 프론트 파일 | 새 창 메뉴 표시 확인 | ⬜ |
| 5-3 | `EvidenceTableWindow.tsx` 생성 | 새 컴포넌트 파일 | 컴포넌트 렌더링 확인 | ⬜ |
| 5-4 | 유형 메뉴, 표, 정렬, 키워드 검색, ticker 검색, summary/title/publish 컬럼 구현 | `EvidenceTableWindow.tsx` | UI 상호작용 확인 | ⬜ |
| 5-5 | 표 표현을 `FinnhubNewsWindow`와 유사한 스타일로 맞춤 | `EvidenceTableWindow.tsx` | 행/컬럼 스타일 확인 | ⬜ |

- `5-1` 목적: window 시스템에 새 타입을 정식 등록하기 위함.
  설명: 기존 `case-research`와 별도인 새 타입을 만든다.
  완료 조건(눈으로 확인): `evidence-table` 타입이 추가된다.
  사람 검증(비개발자): 새 창 이름이 시스템에 보인다.
  흔한 문제/주의: type만 추가하고 렌더 분기를 빼먹기 쉽다.
- `5-2` 목적: 사용자가 실제로 창을 열 수 있게 하기 위함.
  설명: Add Tab 목록과 기본 창 제목에 반영한다.
  완료 조건(눈으로 확인): `evidence table` 항목이 Add Tab에 보인다.
  사람 검증(비개발자): 체크해서 새 탭을 열 수 있다.
  흔한 문제/주의: title은 보이는데 컴포넌트 렌더가 빠지면 빈 창이 열린다.
- `5-3` 목적: evidence row 전용 표 창을 만든다.
  설명: page id와 filters를 갖는 독립 컴포넌트를 만든다.
  완료 조건(눈으로 확인): 새 컴포넌트 파일이 생긴다.
  사람 검증(비개발자): 창을 열었을 때 빈 박스가 아니라 표 구조가 보인다.
  흔한 문제/주의: page id를 어디서 받을지 명확히 해야 한다.
- `5-4` 목적: 사용자가 요청한 핵심 기능을 구현한다.
  설명: 유형 메뉴 선택, 정렬, 키워드 검색, ticker 검색, summary/title/publish 표시를 넣는다.
  완료 조건(눈으로 확인): 메뉴와 검색창과 표가 모두 있다.
  사람 검증(비개발자): 특정 유형 선택 후 검색하면 결과가 바뀐다.
  흔한 문제/주의: 정렬을 프론트/백 중 어디서 하는지 일관되게 정해야 한다.
- `5-5` 목적: 기존 뉴스 창과 사용감 차이를 줄이기 위함.
  설명: 표 컬럼 스타일, truncation, sortable header 등을 기존 뉴스 창 패턴에 맞춘다.
  완료 조건(눈으로 확인): 기존 news window와 비슷한 밀도와 상호작용을 가진다.
  사람 검증(비개발자): 새 창도 뉴스 창처럼 읽을 수 있다고 느낀다.
  흔한 문제/주의: 기존 창의 모든 기능을 복사하려 하면 범위가 과하게 커진다.

검증 훅:
```text
- Add Tab에서 evidence table 선택 가능 여부 확인
- 새 창에서 유형 선택, 키워드 검색, ticker 검색, 정렬이 각각 동작하는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 6 — 전체 검증
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 6-1 | 정적 분석 확인 | 관련 변경 파일 전체 | `get_errors` | ⬜ |
| 6-2 | build 검증 | `terminal`, 프론트 workspace | `npm run build` | ⬜ |
| 6-3 | 자동 테스트 검증 | `terminal` | `npm run test` | ⬜ |
| 6-4 | 런타임 통합 검증 | backend dev + frontend dev | page/API/UI 실제 동작 확인 | ⬜ |

- `6-1` 목적: 타입/문법 오류를 제거한다.
  설명: 변경 파일 기준 문제 패널 0개를 목표로 한다.
  완료 조건(눈으로 확인): 에러가 없다.
  사람 검증(비개발자): Problems 패널에 새 오류가 없다.
  흔한 문제/주의: 새 window type 추가 후 switch branch 누락이 잦다.
- `6-2` 목적: 배포 가능한 상태인지 확인한다.
  설명: frontend/backend build가 모두 성공해야 한다.
  완료 조건(눈으로 확인): build 성공.
  사람 검증(비개발자): 빌드 성공 보고를 보면 된다.
  흔한 문제/주의: 프론트 타입과 API 응답 shape 불일치가 자주 난다.
- `6-3` 목적: 기존 기능 회귀를 확인한다.
  설명: 기존 테스트가 깨지지 않아야 한다.
  완료 조건(눈으로 확인): 테스트 통과.
  사람 검증(비개발자): 실패 테스트가 없다는 결과를 보면 된다.
  흔한 문제/주의: 기존 flaky test는 별도 구분 필요.
- `6-4` 목적: 사용자가 실제로 요구한 흐름이 닫히는지 확인한다.
  설명: page 저장, evidence API, 새 window, 검색/정렬/메뉴를 실제로 확인한다.
  완료 조건(눈으로 확인): page와 evidence window가 함께 동작한다.
  사람 검증(비개발자): AI Research Window와 evidence table window를 직접 열어보면 된다.
  흔한 문제/주의: page는 갱신됐는데 window가 옛 데이터를 보는 캐시 문제가 생길 수 있다.

검증 훅:
```text
- 대상 page id 본문 갱신 확인
- evidence API 응답 확인
- evidence table window에서 유형별 표 조회/정렬/검색 확인
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. 결정 ID: D1
   - 내용: company news 분석을 기존 rule-based script 확장으로 할지, agent 직접 taxonomy 설계를 우선할지
   - 선택지: `rule-based 우선` / `agent taxonomy 우선`
   - 차단 대상 Step: Step 3
2. 결정 ID: D2
   - 내용: evidence row를 어디에 저장/조회할지
   - 선택지: `동적 API 계산` / `별도 저장 구조 추가`
   - 차단 대상 Step: Step 4
3. 결정 ID: D3
   - 내용: summary 정의
   - 선택지: `body preview` / `full_text preview` / `별도 요약 생성`
   - 차단 대상 Step: Step 2, Step 5
4. 결정 ID: D4
   - 내용: page title을 유지할지 변경할지
   - 선택지: `현재 title 유지` / `company news model 2 evidence analysis 등으로 변경`
   - 차단 대상 Step: Step 3

### 실행 의존성 그래프
Legend: `✅ 사용자 확인 후 완료` / `⏳ 구현 완료, 사용자 확인 대기` / `⬜ 미착수` / `🚫 차단`

```text
Track A — 분석 설계/산출물

⬜ Step 1 company news Model 2 분석 방식 확정
  ⬜ 1-1 기존 model2 script 성격/한계 정리
  ⬜ 1-2 직접 분석 vs 자동 분류 범위 분리
  ⬜ 1-3 1차 목표 고정
        |
        v
⬜ Step 2 taxonomy + evidence row schema 설계
  ⬜ 2-1 source/source_type 범위 확정
  ⬜ 2-2 case_type/top_level/컬럼 설계
  ⬜ 2-3 summary 정의 고정
  ⬜ 2-4 메뉴 key 구조 정의
        |
        v
🚫 Step 3 Model 2 결과 생성 및 page 반영
  ⬜ 3-1 company news 전수 분류 실행
  ⬜ 3-2 대상 page 본문 저장
  ⬜ 3-3 evidence row dataset 생성


Track B — 서비스/API/UI

🚫 Step 4 evidence backend API
  ⬜ 4-1 evidence row endpoint
  ⬜ 4-2 case_type/keyword/ticker/sort 필터
  ⬜ 4-3 UI 친화 응답 shape
        |
        v
🚫 Step 5 evidence table window
  ⬜ 5-1 WindowType 추가
  ⬜ 5-2 AddTab/App/DraggableWindow 연결
  ⬜ 5-3 EvidenceTableWindow 생성
  ⬜ 5-4 유형 메뉴/표/검색/정렬 구현
  ⬜ 5-5 NewsWindow와 유사한 표현 정리
        |
        v
⬜ Step 6 전체 검증
  ⬜ 6-1 정적 분석
  ⬜ 6-2 build
  ⬜ 6-3 test
  ⬜ 6-4 런타임 통합


==================== BLOCKED ====================
Step 3는 D1, D3, D4가 정리되어야 안정적으로 시작 가능
Step 4는 Step 3에서 evidence row shape가 정리되어야 안전하게 시작 가능
Step 5는 Step 4 API shape가 정리되어야 안전하게 시작 가능
=================================================
```

병렬 트랙 요약
- Track A는 분석 기준과 산출물을 정하는 축이다.
- Track B는 API와 UI를 붙이는 축이다.
- 실제 착수는 Track A가 선행되어야 하며, Track B는 Track A의 산출 schema가 확정된 뒤 병행 가능하다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D1 | Step 3 | `rule-based 우선` / `agent taxonomy 우선` |
| D2 | Step 4 | `동적 API 계산` / `별도 저장 구조 추가` |
| D3 | Step 2, Step 5 | `body preview` / `full_text preview` / `별도 요약 생성` |
| D4 | Step 3 | `현재 title 유지` / `title 변경` |