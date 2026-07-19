### 목표
- 최종 목적은 기존 `company_news` evidence 분류 결과를 저가형 GPT API 기반 LLM classifier로 재분류하여 taxonomy `v8`을 만드는 것이다.
- 이번 tranche의 핵심은 `rule-based v7`을 폐기하는 것이 아니라, `v7 결과 + company news의 ticker + 제목(title) + summary`를 입력으로 받아 **LLM이 최종 case_type을 다시 판정**하게 하는 보강 파이프라인을 설계하고 구현하는 것이다.
- LLM 분류기는 반드시 비용 우선 원칙을 따른다. 즉, 구현 시점에 사용 가능한 OpenAI/GPT 계열 모델 중 **가장 저렴하면서도 구조화 JSON 출력과 대량 batch 분류에 안정적으로 쓸 수 있는 모델**을 우선 사용한다.
- API key는 로컬 파일 `ai_agent_plan/api_key_gpt/api_key_gpt`에 있는 값을 읽어 사용하는 방향을 기본안으로 둔다. 단, key 값 자체를 로그/출력/커밋에 노출하지 않는다.
- 이번 tranche의 산출물은 아래 6가지다.
  - `company_news taxonomy v8` LLM classifier 설계/구현
  - 저가형 GPT API 호출용 backend 또는 batch 스크립트
  - LLM 입력 schema / 출력 schema / validation layer
  - `v7 vs v8` 비교 리포트 (`unknown`, `잡것들_*`, 주요 case 이동량)
  - 최신 analysis run + Evidence Table 반영
  - 비용/재시도/캐시 전략 문서화

### 현재 레포 상태(중요, 확인됨)
- 현재 최신 rule-based 재분석 결과는 `analysis_id = 76c6beec-f7b7-459f-9a7a-d4bed32df9ce`다.
- 최신 집계 기준:
  - `total_rows = 542,816`
  - `case_type_count = 207`
  - `unknown = 166,383`
  - `잡것들_* = 39,763`
- 현재 활성 classifier의 중심 파일은 `ai_research_tool/test_model2_company_news_analysis.py`다.
- 현재 Evidence Table / analysis API / description UI는 이미 동작 중이며, v7 taxonomy를 읽고 표시하는 기반은 준비되어 있다.
- 즉 v8 작업은 UI를 처음 만드는 작업이 아니라, **새 분석 run을 생성하고 기존 UI가 그 run을 읽게 만드는 작업**에 가깝다.
- 현재 워크스페이스에는 GPT API key 저장용 로컬 파일 `ai_agent_plan/api_key_gpt/api_key_gpt`가 존재하는 것이 확인되었다.
- 다만 이 key 파일을 직접 앱 runtime에서 읽을지, one-off batch 스크립트에서 읽을지는 아직 결정하지 않았다.
- 현재 기존 taxonomy는 `207개`이므로, v8에서 신규 생성 가능한 유형 여유는 최대 `93개`다.

### 제약 / 비범위
- 이번 plan은 `v8 LLM classifier` 작업을 위한 새 계획 문서다. 아직 실제 API 호출 코드를 작성하지 않는다.
- 이번 tranche에서 fine-tuning은 하지 않는다.
- 외부 vector DB, embedding search service, 별도 orchestration 서버는 기본안에 넣지 않는다.
- mock 데이터는 사용하지 않는다.
- key 값을 `.env`로 재배포하거나 git tracked 파일에 옮기는 것은 기본안이 아니다.
- 목표는 완전 무제한 재분류가 아니라, **비용 통제 가능한 batch/queue 기반 분류기**를 만드는 것이다.
- 새 유형 생성을 허용하더라도, 한 번의 실행에서 taxonomy가 무한히 늘어나게 두지 않는다.

### 읽는 방법(비개발자/일반인 기준)
- `결정/선행조건`을 먼저 보면 왜 저가형 GPT 모델을 쓰는지와 어떤 운영 방식이 필요한지 알 수 있다.
- `아키텍처(상위)`를 보면 v7 결과를 어떤 입력으로 LLM에 다시 넣을지 이해할 수 있다.
- `단계별 계획`을 보면 실제 구현 순서가 `샘플 설계 -> 호출기 구현 -> 배치 실행 -> 품질 비교 -> UI 반영`으로 진행된다는 점을 볼 수 있다.
- `실행 의존성 그래프`는 어떤 Step이 먼저 끝나야 다음 Step을 할 수 있는지 보여준다.
- `미확정 사항`은 모델명, 입력 길이, 전체 재분류 범위처럼 초기에 결정해야 하는 항목을 정리한다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- 구현이 끝나도 사용자 확인 전에는 `⏳` 상태를 유지한다.
- 새 정보가 생겨 plan이 바뀌면 기존 내용을 지우지 않고 `PLAN CHANGE` 형태로 누적한다.
- 각 Step 종료 시 검증 명령/체크 방법을 제시하고, 사용자 확인 후에만 `✅`로 올린다.

### 아키텍처(상위)
- 입력 소스:
  - `model2_evidence_rows`
  - 필요 시 `news_items`, `news_fulltext`, `research_pages.body`
- 입력 레코드 1건의 기본 재분류 단위:
  - `ticker`
  - 현재 `case_type`
  - `title`
  - `summary` 또는 현재 DB에 저장된 이에 준하는 summary 필드
  - 필요 시 가격 반응 메타데이터 (`change_pct`, `market_cap_bucket`)는 참고용으로만 사용
- 입력 원칙:
  - 본문(full text), 추가 body chunk, 원문 전문은 v8 분류 입력에 넣지 않는다.
  - 분류 대상 텍스트는 **ticker + 제목 + summary**로 제한한다.
  - 따라서 비용 추정과 prompt 설계도 `ticker + title + summary` 길이를 기준으로 계산한다.
- 출력 원칙:
  - GPT는 기존 taxonomy를 우선 선택한다.
  - 기존 taxonomy와 정말 맞지 않으면 새 유형명을 생성할 수 있다.
  - 단, 새 유형 생성은 총 taxonomy 수 `300개` 상한을 넘지 않는 범위에서만 허용한다.
- LLM 분류 파이프라인 상위 구조:
  1. 기존 v7 run 또는 대상 run에서 evidence row 추출
  2. LLM prompt용 입력 JSON 정규화
  3. 저가형 GPT API 호출
  4. JSON schema 검증
  5. 실패 row 재시도 / 영구 실패 row 별도 저장
  6. 최종 `case_type_v8` 저장
  7. 새 analysis run 생성 또는 기존 evidence 확장 저장
  8. `v7 vs v8` 비교 리포트 산출
- 출력 방향 기본안:
  - 기존 `model2_analysis_runs`와 유사한 새 run 생성
  - `model2_evidence_rows`를 재사용할지, `v8` 전용 테이블을 둘지는 미결정
  - UI는 새 run을 읽도록 유지하고, 가능하면 기존 analysis selector만으로 비교 가능하게 한다.

### 결정/선행조건(초기에 확정 필요)
- 결정 1: `v8`은 rule-based replacement가 아니라 `LLM reclassification layer`로 정의한다.
- 결정 2: 모델 선택 기준은 "정확도 최대"가 아니라 "구조화 출력 가능 + 최저 비용 + 충분한 안정성"이다.
- 결정 3: 전체 54만건을 한 번에 바로 재분류하지 않고, 먼저 표본 검증 후 전체 batch로 확장한다.
- 결정 4: LLM 출력은 자유서술이 아니라 고정 schema JSON이어야 한다.
- 결정 4-1: LLM은 가능한 한 기존 `case_type`을 재사용하되, 정말 맞지 않으면 새 유형 생성도 허용한다.
- 결정 4-2: 전체 taxonomy는 `300개`를 넘지 않는다.
- 결정 5: API 실패/timeout/rate limit은 기본적으로 최대 10회 재시도 정책을 따른다.
- 결정 6: 동일 입력 재호출을 피하기 위해 response cache를 둔다.

### 계획 중간 필수 확인
- 가장 저렴한 GPT 모델이 실제로 `case_type` 강제 선택과 JSON schema 출력을 안정적으로 수행하는지 먼저 확인해야 한다.
- prompt가 길어질수록 비용이 급증하므로 입력 text 길이와 taxonomy 설명량을 통제해야 한다. 이번 작업에서는 `title + summary`만 사용하므로 입력 토큰 상한을 더 공격적으로 낮출 수 있다.
- 전체 207개 case를 한 번에 항상 노출할지, 상위 후보군을 먼저 좁히는 2단계 분류로 갈지 검토해야 한다.
- LLM 결과가 `unknown`을 줄이더라도, `잡것들_*`를 과도하게 의미 있는 case로 끌어올리는 false positive가 생기면 안 된다.
- 동일 기사에 대해 LLM 재호출 시 결과 drift가 심하면 운영성이 낮아진다. 따라서 deterministic 설정과 cache key 설계가 중요하다.
- key 파일 사용 시, 값이 로그/예외 문자열에 섞여 나오지 않도록 masking 규칙이 필요하다.
- 새 유형 생성을 허용하면 의미가 비슷한 라벨이 계속 생길 위험이 있으므로, naming rule과 `300개` 상한 enforcement가 필요하다.
- `OTHER_NEW`는 완전히 폐기하지 않고, 새 유형 생성이 cap에 걸리거나 생성 품질이 불안정할 때의 임시 버퍼로만 사용한다.

### 비용 추정 기준(현재 가정)
- 비용 계산의 기준 입력은 `ticker + title + summary + 최소 메타데이터(current_case_type)`다.
- 이전에 잡아둔 `lean / base / heavy`는 본문 사용 가정이 아니라, **제목+summary 길이와 taxonomy 설명량 차이**를 나타내는 추정 구간으로 다시 해석한다.
  - `lean`: 짧은 `ticker + title + summary`, 매우 짧은 JSON 출력
  - `base`: 일반적인 `ticker + title + summary` + 최소 메타데이터 + 짧은 JSON 출력
  - `heavy`: 긴 summary + 후보 taxonomy 설명을 더 많이 포함한 경우
- 현재 요구사항 기준으로는 `body`나 `full_text`를 넣지 않으므로, 실전 비용은 기존 heavy 가정보다 낮아질 가능성이 높다.
- 운영 기본안은 `GPT-5.4 nano + Batch API`를 우선 검토한다.
- taxonomy가 `207 -> 최대 300`으로 늘 수 있으므로, 새 유형명 규칙과 후보군 압축 전략을 함께 설계해야 token cost를 통제할 수 있다.

### 제안하는 구현 순서(이유)
1. 대상 데이터 범위와 저장 전략 확정
2. 저가형 GPT 모델 선택 및 단건 schema 검증
3. 소표본 batch 분류기 구현
4. 품질 비교 후 전체 batch 확장
5. DB 반영 및 UI 비교 가능 상태 구성
6. 비용/재시도/실패 row 운영 정리

### 단계별 계획(각 단계: 구현 → 검증)

#### ⬜ Step 0 — v8 범위와 저장 모델 확정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 0-1 | v8 입력 소스를 `latest v7 analysis` 기준으로 고정할지 결정 | `ai_agent_plan/evidence_llm_classifier/plan.md` | 대상 analysis id / 범위 명시 확인 | ⬜ |
| 0-2 | 결과 저장 방식을 `새 run 생성` 또는 `별도 v8 테이블` 중 하나로 정리 | `ai_agent_plan/evidence_llm_classifier/plan.md` | 저장 전략 문구 확인 | ⬜ |
| 0-3 | key 파일 사용 방식과 masking 원칙 정리 | `ai_agent_plan/evidence_llm_classifier/plan.md` | 시크릿 노출 금지 규칙 확인 | ⬜ |

- `0-1` 목적: 어떤 데이터를 LLM으로 다시 분류할지 범위를 고정하기 위함.
  설명: 우선 기본안은 최신 v7 run 전체를 입력 집합으로 사용한다.
  완료 조건(눈으로 확인): plan에 대상 analysis 기준이 적혀 있다.
  사람 검증(비개발자): 어떤 데이터가 재분류되는지 문장으로 이해할 수 있다.
  흔한 문제/주의: 최신 run이 바뀌면 비교 기준이 흔들릴 수 있다.
- `0-2` 목적: DB 구조 변경 범위를 초기에 고정하기 위함.
  설명: 새 analysis run 생성 방식이 기본안인지, 별도 보조 테이블인지 결정한다.
  완료 조건(눈으로 확인): 저장 방식이 하나로 명시된다.
  사람 검증(비개발자): v7과 v8 비교를 어디서 보는지 이해할 수 있다.
  흔한 문제/주의: 저장 모델을 늦게 정하면 구현이 중복된다.
- `0-3` 목적: API key 처리 중 보안 사고를 막기 위함.
  설명: key 파일 경로는 참조하되 값은 어떤 로그에도 남기지 않는다.
  완료 조건(눈으로 확인): masking 원칙이 문서에 있다.
  사람 검증(비개발자): 비밀값을 출력하지 않는다는 점을 확인할 수 있다.
  흔한 문제/주의: 예외 traceback에 request header/body가 그대로 찍히면 위험하다.

검증 훅:
```text
- 대상 analysis id 또는 대상 범위가 문서에 고정되어 있는지 확인
- 저장 전략이 하나로 정리되어 있는지 확인
- key masking / 로그 금지 원칙이 적혀 있는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 1 — 저가형 GPT 모델과 출력 schema 확정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | 구현 시점 기준 최저가 GPT 모델 후보 조사 및 선택 기준 고정 | `ai_agent_plan/evidence_llm_classifier/plan.md` | 모델 선택 원칙 확인 | ⬜ |
| 1-2 | LLM 출력 schema 정의 (`existing case` 또는 `new case`) | `ai_agent_plan/evidence_llm_classifier/plan.md` | JSON field 목록 확인 | ⬜ |
| 1-3 | taxonomy `300개 cap`과 새 유형 naming rule 결정 | `ai_agent_plan/evidence_llm_classifier/plan.md` | cap / naming 규칙 확인 | ⬜ |
| 1-4 | taxonomy 207개를 prompt에 직접 전부 넣을지, 후보군 압축 전략을 둘지 결정 | `ai_agent_plan/evidence_llm_classifier/plan.md` | prompt 구조 결정 확인 | ⬜ |

- `1-1` 목적: 비용을 통제하면서도 분류 가능 모델을 정하기 위함.
  설명: 가장 저렴한 분류 가능 모델을 기본으로 두고, 실패 시 차선 모델을 fallback 후보로 둔다.
  완료 조건(눈으로 확인): 모델 선택 기준이 문서에 있다.
  사람 검증(비개발자): 왜 "싼 모델"을 써도 되는지 근거를 읽을 수 있다.
  흔한 문제/주의: 너무 싼 모델이 schema를 자주 깨면 운영 비용이 오히려 커질 수 있다.
- `1-2` 목적: 자유서술 응답을 막고 기계적으로 저장하기 위함.
  설명: 출력은 고정 JSON schema만 허용하고, `existing taxonomy 매칭`과 `new case 생성`을 명시적으로 구분한다.
  완료 조건(눈으로 확인): 응답 필드와 허용 값이 적혀 있다.
  사람 검증(비개발자): LLM이 어떤 형식으로 답해야 하는지 이해할 수 있다.
  흔한 문제/주의: confidence만 믿고 case_type 품질을 과대평가하면 안 된다.
- `1-3` 목적: 새 유형이 생겨도 taxonomy가 통제 불가능하게 늘어나지 않게 하기 위함.
  설명: 전체 taxonomy 상한을 `300개`로 고정하고, 새 유형명 생성 규칙을 정한다.
  완료 조건(눈으로 확인): cap과 naming rule이 문서에 있다.
  사람 검증(비개발자): 새 유형이 생겨도 무한정 늘어나지 않는다는 점을 이해할 수 있다.
  흔한 문제/주의: 너무 느슨한 naming rule은 비슷한 라벨을 양산한다.
- `1-4` 목적: prompt 비용과 정확도의 균형을 맞추기 위함.
  설명: 207개 전체 taxonomy를 매 호출마다 넣는 방식과 2단계 후보 압축 방식을 비교한다.
  완료 조건(눈으로 확인): prompt 전략이 하나로 정리된다.
  사람 검증(비개발자): 왜 1단계/2단계 분류가 필요한지 이해할 수 있다.
  흔한 문제/주의: 후보군 압축 규칙이 나쁘면 정답 case가 애초에 후보에서 탈락한다.

검증 훅:
```text
- 사용할 모델 선택 기준이 문서에 있는지 확인
- 출력 JSON schema 필드가 고정되어 있는지 확인
- taxonomy 300개 cap과 naming rule이 있는지 확인
- prompt 전략(전체 taxonomy vs 후보 압축)이 정리되어 있는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 2 — 소표본 LLM classifier 구현
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | LLM 호출용 스크립트 또는 backend service 골격 구현 | 구현 예정 | 단건 호출 성공 | ⬜ |
| 2-2 | request retry/backoff/cache/failure logging 구현 | 구현 예정 | 실패 시 재시도 로그 확인 | ⬜ |
| 2-3 | 100~500건 소표본 분류 실행 및 raw 결과 저장 | 구현 예정 | 샘플 결과 파일/DB 확인 | ⬜ |

- `2-1` 목적: 실제 API로 구조화 분류가 가능한지 확인하기 위함.
  설명: 단건 분류와 schema validation을 우선 구현한다.
  완료 조건(눈으로 확인): 단건 입력에 JSON 응답이 반환된다.
  사람 검증(비개발자): 샘플 기사 1건이 특정 case로 분류되는 것을 볼 수 있다.
  흔한 문제/주의: 모델이 설명문을 섞어 보내면 parser가 깨진다.
- `2-2` 목적: 대량 batch에서 중도 실패를 막기 위함.
  설명: timeout, 429, 연결 종료 등에 대해 최대 10회 재시도와 cache를 둔다.
  완료 조건(눈으로 확인): 실패/재시도/영구실패 로그 구조가 보인다.
  사람 검증(비개발자): 일시 오류가 나도 다시 시도한다는 점을 이해할 수 있다.
  흔한 문제/주의: 같은 row를 중복 호출하면 비용이 불필요하게 증가한다.
- `2-3` 목적: 전체 실행 전에 비용과 품질을 작은 표본으로 점검하기 위함.
  설명: `unknown`, `잡것들_*`, 대표 정상 case를 섞은 샘플셋을 먼저 돌린다.
  완료 조건(눈으로 확인): 샘플 분류 결과가 저장된다.
  사람 검증(비개발자): 잘못 분류되던 기사 몇 개가 더 자연스럽게 분류되는지 확인할 수 있다.
  흔한 문제/주의: 샘플셋이 한 publisher에 치우치면 전체 품질을 잘못 추정한다.

검증 훅:
```text
- 단건 호출에서 schema-valid JSON이 나오는지 확인
- timeout/429/connection reset 시 재시도 로그가 남는지 확인
- 소표본 분류 결과에서 대표 기사 샘플을 수작업 검토
```
사용자 확인 필요: **예**

#### ⬜ Step 3 — v7 대비 품질 비교와 prompt 보정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | `v7 vs LLM sample` 비교표 작성 | 구현 예정 | 비교표 생성 확인 | ⬜ |
| 3-2 | false positive / false negative 패턴 정리 | `ai_agent_plan/evidence_llm_classifier/plan.md` | 오분류 패턴 문서화 확인 | ⬜ |
| 3-3 | prompt / 후보군 규칙 / schema를 1회 이상 보정 | 구현 예정 | 재실행 후 품질 변화 확인 | ⬜ |

- `3-1` 목적: rule-based 대비 실제 개선이 있는지 수치로 보기 위함.
  설명: 같은 샘플셋에 대해 기존 case_type과 LLM case_type을 비교한다.
  완료 조건(눈으로 확인): 비교표가 있다.
  사람 검증(비개발자): 어떤 기사들이 더 자연스럽게 이동했는지 볼 수 있다.
  흔한 문제/주의: 단순 unknown 감소만 보고 잘못된 과분류를 놓치면 안 된다.
- `3-2` 목적: LLM 오분류를 추상적으로 느끼지 않고 패턴으로 정리하기 위함.
  설명: earnings/FDA/M&A/price explanation 등 주요 카테고리별 오분류를 기록한다.
  완료 조건(눈으로 확인): 대표 실패 패턴이 문서에 있다.
  사람 검증(비개발자): LLM도 틀릴 수 있다는 구체 사례를 이해할 수 있다.
  흔한 문제/주의: 실패 원인이 prompt인지 model 한계인지 구분해야 한다.
- `3-3` 목적: 전체 batch 전에 최소 1회 이상 품질 보정을 하기 위함.
  설명: prompt 또는 후보군 압축 규칙을 수정하고 샘플을 다시 돌린다.
  완료 조건(눈으로 확인): 1차 대비 2차 품질 비교가 있다.
  사람 검증(비개발자): 수정 후 결과가 더 낫다는 점을 확인할 수 있다.
  흔한 문제/주의: 보정 과정에서 특정 edge case만 맞추고 전체 일반화가 망가질 수 있다.

검증 훅:
```text
- 샘플 비교표에서 v7 대비 개선/악화 사례를 각각 확인
- false positive / false negative 패턴이 문서화되었는지 확인
- 보정 후 재실행 결과가 남아 있는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 4 — 전체 batch 실행과 DB 반영
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | 전체 대상 evidence row batch 실행 | 구현 예정 | 전체 처리 건수 / 실패 건수 확인 | ⬜ |
| 4-2 | 새 analysis run 또는 v8 저장 구조에 적재 | 구현 예정 | DB row / run 생성 확인 | ⬜ |
| 4-3 | `unknown`, `잡것들_*`, 주요 case 이동량 집계 | 구현 예정 | 전/후 집계표 확인 | ⬜ |

- `4-1` 목적: 샘플이 아니라 실제 corpus에 적용하기 위함.
  설명: 전체 대상 row를 순차 batch로 호출한다.
  완료 조건(눈으로 확인): 총 처리 수와 실패 수가 나온다.
  사람 검증(비개발자): 실제 전체 기사에 대해 돌렸다는 점을 이해할 수 있다.
  흔한 문제/주의: 중간 실패 후 resume 기능이 없으면 다시 처음부터 돌리게 된다.
- `4-2` 목적: 결과를 UI와 비교 가능하게 저장하기 위함.
  설명: 새 run 또는 별도 저장 구조로 결과를 적재한다.
  완료 조건(눈으로 확인): DB에 새 결과가 존재한다.
  사람 검증(비개발자): analysis 목록에 새 버전이 보인다.
  흔한 문제/주의: 기존 v7 데이터를 덮어쓰면 비교가 어려워진다.
- `4-3` 목적: v8의 실제 성과를 숫자로 확인하기 위함.
  설명: `unknown`, `잡것들_*`, 대표 case 증가/감소를 표로 만든다.
  완료 조건(눈으로 확인): 전후 비교표가 있다.
  사람 검증(비개발자): 어느 정도 좋아졌는지 숫자로 이해할 수 있다.
  흔한 문제/주의: 전체 수치만 보고 개별 오분류 품질을 놓치면 안 된다.

검증 훅:
```text
- 전체 batch 총건수, 성공건수, 실패건수 확인
- DB에 새 run 또는 새 저장 구조가 생겼는지 확인
- v7 vs v8 집계표에서 unknown / 잡것들 변화 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 5 — UI 반영과 운영 정리
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | analysis selector에서 v8 run 비교 가능 상태 확인 | 구현 예정 | `/api/model2/analyses` 응답 확인 | ⬜ |
| 5-2 | Evidence Table에서 v8 결과 샘플 검토 | 구현 예정 | case/evidence 조회 확인 | ⬜ |
| 5-3 | 비용, retry, cache, failure recovery 운영 메모 정리 | `ai_agent_plan/evidence_llm_classifier/plan.md` | 운영 섹션 확인 | ⬜ |

- `5-1` 목적: 새 결과가 실제 화면에서 읽히는지 확인하기 위함.
  설명: analysis 목록에 v8 run이 노출되는지 확인한다.
  완료 조건(눈으로 확인): analysis API에서 새 run이 보인다.
  사람 검증(비개발자): 드롭다운에서 새 버전을 선택할 수 있다.
  흔한 문제/주의: DB 적재는 됐지만 API 정렬/필터 때문에 안 보일 수 있다.
- `5-2` 목적: 최종 결과를 실제 evidence 화면에서 확인하기 위함.
  설명: 대표 case와 residual 샘플을 UI에서 직접 검토한다.
  완료 조건(눈으로 확인): evidence 목록이 열린다.
  사람 검증(비개발자): 새 분류 결과를 눈으로 볼 수 있다.
  흔한 문제/주의: 저장 컬럼이 바뀌면 기존 UI가 예상과 다르게 동작할 수 있다.
- `5-3` 목적: 재실행 가능한 운영 절차를 남기기 위함.
  설명: 비용 추정, retry 기준, resume 기준, 실패 row 재처리 원칙을 정리한다.
  완료 조건(눈으로 확인): 운영 메모가 plan에 있다.
  사람 검증(비개발자): 나중에 다시 돌릴 때 무엇을 보면 되는지 알 수 있다.
  흔한 문제/주의: 비용 계산 없이 전체 batch를 반복 실행하면 API 비용이 빠르게 커진다.

검증 훅:
```text
- `/api/model2/analyses` 에서 새 run 노출 확인
- `/api/model2/analyses/:id/cases`, `/evidence` 응답 확인
- 운영 메모에 비용/재시도/resume 정책이 적혀 있는지 확인
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. 결정 ID `D1` — 정확히 어떤 GPT 모델을 기본 모델로 쓸 것인가?
   - 선택지 A: 구현 시점 최저가 structured-output 가능 모델
   - 선택지 B: 한 단계 비싸지만 더 안정적인 mini 급 모델
   - 차단 대상 Step: `Step 1`, `Step 2`
2. 결정 ID `D2` — taxonomy 207개 전체를 매 prompt에 넣을 것인가?
   - 선택지 A: 전체 taxonomy 직접 제공
   - 선택지 B: 1차 후보군 압축 후 2차 최종 선택
   - 차단 대상 Step: `Step 1`, `Step 3`
3. 결정 ID `D3` — 저장 구조를 새 analysis run으로 할 것인가?
   - 선택지 A: 기존 analysis 구조 재사용
   - 선택지 B: v8 전용 결과 테이블 추가
   - 차단 대상 Step: `Step 4`, `Step 5`
4. 결정 ID `D4` — 전체 54만건 전체 재분류를 1차 tranche에서 바로 할 것인가?
   - 선택지 A: 전체 즉시 실행
   - 선택지 B: `unknown + 잡것들_* + 일부 핵심 case` 우선 실행 후 확대
   - 차단 대상 Step: `Step 4`
5. 결정 ID `D5` — 새 유형 생성 허용 범위를 어디까지 둘 것인가?
  - 선택지 A: 모든 row에서 허용
  - 선택지 B: 기존 유형 매칭 confidence가 낮은 row에만 허용
  - 차단 대상 Step: `Step 1`, `Step 3`

### 실행 의존성 그래프
Legend: `✅ 사용자 확인 후 완료` / `⏳ 구현 완료, 사용자 확인 대기` / `⬜ 미착수` / `🚫 선행조건 미충족`

```text
[Track A: 설계/결정]
⬜ Step 0 — v8 범위와 저장 모델 확정
  ⬜ 0-1 대상 analysis 범위 고정
  ⬜ 0-2 저장 전략 정리
  ⬜ 0-3 key/masking 원칙 정리

⬜ Step 1 — 저가형 GPT 모델과 출력 schema 확정
  ⬜ 1-1 최저가 모델 선택 기준
  ⬜ 1-2 출력 schema 정의
  ⬜ 1-3 taxonomy 300개 cap / naming rule
  ⬜ 1-4 prompt 전략 결정

==================== BLOCKED UNTIL STEP 1 ====================
이유: 모델/출력 schema/prompt 전략이 없으면 실제 호출기 구현 불가
==============================================================

[Track B: 구현/실행]
⬜ Step 2 — 소표본 LLM classifier 구현
  ⬜ 2-1 호출기 골격 구현
  ⬜ 2-2 retry/cache/failure logging
  ⬜ 2-3 소표본 분류 실행

⬜ Step 3 — v7 대비 품질 비교와 prompt 보정
  ⬜ 3-1 샘플 비교표 작성
  ⬜ 3-2 오분류 패턴 정리
  ⬜ 3-3 prompt 보정 후 재실행

==================== BLOCKED UNTIL STEP 3 ====================
이유: 샘플 품질 검증 없이 전체 batch를 돌리면 비용 낭비 위험이 큼
==============================================================

⬜ Step 4 — 전체 batch 실행과 DB 반영
  ⬜ 4-1 전체 batch 실행
  ⬜ 4-2 DB 적재
  ⬜ 4-3 전후 집계표 작성

⬜ Step 5 — UI 반영과 운영 정리
  ⬜ 5-1 analysis selector 노출 확인
  ⬜ 5-2 Evidence Table 검토
  ⬜ 5-3 운영 메모 정리
```

병렬 트랙 요약
- Track A는 설계와 결정을 정리하는 구간이다.
- Track B는 실제 구현과 실행 구간이다.
- `Step 2`는 `Step 1`이 끝나야 시작 가능하다.
- `Step 4`는 `Step 3`에서 샘플 품질 확인이 끝나야 시작 가능하다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D1 | Step 1, Step 2 | 최저가 모델 vs 한 단계 안정 모델 |
| D2 | Step 1, Step 3 | 전체 taxonomy prompt vs 후보군 압축 |
| D3 | Step 4, Step 5 | 새 run 재사용 vs v8 전용 테이블 |
| D4 | Step 4 | 전체 재분류 vs residual 우선 재분류 |
| D5 | Step 1, Step 3 | 모든 row 새 유형 허용 vs 저확신 row만 허용 |

### 결정 #1 — 저가형 GPT 모델 선택 원칙(상세)
- 우선 원칙은 `가장 싼 모델`이 아니라, `가장 싼데도 schema를 안정적으로 지키는 모델`이다.
- 따라서 구현 시점에는 아래 4개를 함께 확인해야 한다.
  - 입력 토큰 단가
  - 출력 토큰 단가
  - structured JSON output 안정성
  - rate limit / batch throughput
- 만약 최저가 모델이 JSON schema를 자주 깨면, 한 단계 비싼 mini 급 모델이 총비용 기준으로 더 나을 수 있다.

### 결정 #2 — LLM 분류 입력 설계(상세)
- 기본 입력 필드는 `ticker`, `title`, `summary`, `current_case_type`이다.
- 입력 텍스트는 `ticker + title + summary`로 제한하고, `full_text`나 추가 본문 chunk는 사용하지 않는다.
- 비용 통제를 위해 summary도 필요 이상 길게 보내지 않고, 전처리 단계에서 길이 상한을 둔다.
- 출력은 최소한 아래를 포함한다.
  - `case_type`
  - `confidence`
  - `reason_short`
  - `needs_review`
- `case_type`은 우선 기존 taxonomy enum 중 하나를 선택하는 것을 기본으로 둔다.
- 다만 기존 taxonomy와 충분히 맞지 않으면 새 유형명을 생성할 수 있다.
- 새 유형명은 아래 제약을 따른다.
  - `snake_case`
  - 기존 유형과 의미가 거의 같으면 생성 금지
  - 전체 taxonomy 상한 `300개` 이내
- `reason_short`는 사람이 사후 검토할 수 있을 정도로만 짧게 받고, 긴 chain-of-thought를 요구하지 않는다.

### 결정 #3 — LLM 분류 결과 형식(상세)
- 기본 출력 형식은 아래 두 가지 모드를 권장한다.

```json
{
  "match_mode": "existing",
  "case_type": "earnings_miss_cut_negative",
  "confidence": 0.82,
  "needs_review": false,
  "reason_short": "summary mentions miss and lowered guidance"
}
```

```json
{
  "match_mode": "new_case",
  "case_type": "supplier_customer_concentration_risk",
  "top_level": "residual",
  "confidence": 0.67,
  "needs_review": true,
  "reason_short": "summary describes a concentration risk pattern not cleanly covered by current taxonomy"
}
```

- 여기서 중요한 점은 아래와 같다.
  - `match_mode = existing`: 기존 taxonomy 중 하나를 선택
  - `match_mode = new_case`: 기존 taxonomy와 충분히 다를 때만 새 유형명 생성
  - `case_type`: 최종 유형 문자열
  - `confidence`: 0~1 또는 0~100 중 하나로 고정
  - `needs_review`: 애매한 기사면 true
  - `reason_short`: 짧은 근거 메모만 저장
- 필요하면 2단계 결과도 가능하다.
  - `top_level`: `long | short | residual`
  - `case_type`: 그 하위 세부 taxonomy
- 하지만 1차 구현은 단순하게 `case_type` 직접 선택형이 더 낫다.

### 결정 #4 — OTHER_NEW 승격 규칙(상세)
- `OTHER_NEW`는 완전히 없애지 않는다.
- 역할은 아래 둘 중 하나다.
  - taxonomy cap `300`에 도달해서 더 이상 새 유형을 만들 수 없을 때의 임시 버퍼
  - LLM이 새 유형명 생성조차 불안정하다고 판단한 row의 임시 버퍼
- `OTHER_NEW`가 너무 많아졌을 때만 새 유형 승격 규칙을 적용한다.
- 기본 승격 규칙 초안:
  1. 최근 실행에서 `OTHER_NEW` 비중이 전체의 `3%`를 넘거나, 절대건수 `5,000건`을 넘으면 검토 시작
  2. `OTHER_NEW` 내부 reason_short / title / summary를 묶어 반복 패턴 탐색
  3. 같은 패턴이 `200건` 이상 반복되면 새 유형 후보로 승격 검토
  4. 기존 유형과 의미 중복이 낮을 때만 taxonomy에 신규 등록
  5. 신규 등록 후에도 총 유형 수는 `300`을 넘지 않게 유지
- 즉 `OTHER_NEW`는 영구 저장소가 아니라, taxonomy 확장이 정말 필요할 때만 여는 압력 밸브다.