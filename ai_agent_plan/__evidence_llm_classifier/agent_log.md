## 2026-03-29
**작성 시각:** 19:05 (local)

- 새 plan 작업 시작:
  - 사용자 요청에 따라 `ai_agent_plan/evidence_llm_classifier/` 폴더를 생성하고, 기존 임시 폴더명을 `evidence_llm_classifier`로 확정함.
  - 이번 plan의 목적을 `저가형 GPT API 기반 company_news evidence v8 재분류`로 정의함.
- 확인된 현재 상태:
  - 최신 rule-based analysis는 `76c6beec-f7b7-459f-9a7a-d4bed32df9ce`
  - 최신 분포 검증에서 `unknown = 166,383`, `잡것들_* = 39,763` 확인
  - 로컬 GPT API key 파일 경로 존재 확인 (`ai_agent_plan/api_key_gpt/api_key_gpt`)
- 이번 로그 시점의 작업 범위:
  - 구현은 아직 시작하지 않음
  - `plan.md` 작성과 v8 설계 구조 정의만 수행
- 상태:
  - `plan.md` 작성 완료, 사용자 검토 대기

## 2026-03-29
**작성 시각:** 19:29 (local)

- plan 전제 수정:
  - 사용자 уточ정에 따라 v8 LLM classifier의 분류 입력을 `company news title + summary`로 제한함.
  - 본문(full text)이나 추가 body chunk를 입력으로 쓰는 가정은 plan에서 제거함.
- 문서 반영 내용:
  - `plan.md`의 목표, 아키텍처, 입력 설계, 비용 추정 기준을 `title + summary only` 기준으로 수정함.
  - 비용 추정의 `lean / base / heavy`도 본문 길이 차이가 아니라 `summary 길이 + taxonomy 설명량` 차이로 재해석하도록 명시함.
- 상태:
  - v8 plan이 현재 요구사항(`title + summary only`)에 맞게 갱신됨

## 2026-03-29
**작성 시각:** 19:31 (local)

- 입력/출력 계약 수정:
  - 사용자 요구에 따라 v8 LLM classifier 입력 필드에 `ticker`를 추가함.
  - LLM이 임의의 분류명을 생성하지 않도록, 결과 형식을 `고정 taxonomy enum 중 하나를 선택하는 closed-set classification`으로 명시함.
- plan 반영 내용:
  - `ticker + title + summary`를 기본 입력 단위로 수정
  - `case_type`은 자유 문자열이 아니라 사전 제공 taxonomy 중 하나만 선택하도록 문서화
  - 예시 JSON output schema 추가
- 상태:
  - v8 plan의 입력 스펙과 출력 스키마가 더 명확해짐

## 2026-03-29
**작성 시각:** 19:33 (local)

- 입력 필드 축소:
  - 사용자 요청에 따라 v8 LLM classifier 입력에서 `publisher`를 제거함.
  - 현재 기본 입력은 `ticker + title + summary + current_case_type`로 정리함.
- 문서 반영 내용:
  - `plan.md`의 입력 레코드 정의, 비용 추정 기준, 입력 설계를 갱신함.
- 상태:
  - v8 plan 입력 스펙이 `publisher 제외` 기준으로 정리됨

## 2026-03-29
**작성 시각:** 19:40 (local)

- taxonomy 운영 규칙 수정:
  - 사용자 요청에 따라 v8에서 새 유형 생성을 허용하되, 전체 유형 수를 `300개`로 제한하는 방향으로 plan을 수정함.
  - 기존 유형과 맞지 않으면 새 유형을 생성할 수 있게 하고, `OTHER_NEW`는 cap 도달 또는 불안정 케이스용 임시 버퍼로 유지함.
- 승격 규칙 추가:
  - `OTHER_NEW` 비중/절대건수가 일정 수준을 넘을 때만 새 유형 승격 검토를 시작하는 규칙 초안을 문서화함.
  - 반복 패턴이 충분히 누적될 때만 신규 유형으로 승격하고, 총 유형 수는 `300`을 넘지 않도록 제한함.
- plan 반영 내용:
  - 목표, 아키텍처, 결정/선행조건, Step 1, 출력 schema, 미확정 사항, OTHER_NEW 승격 규칙 섹션을 업데이트함.
- 상태:
  - v8 plan이 `최대 300개 taxonomy + 제한적 새 유형 생성 + OTHER_NEW 승격 규칙` 기준으로 갱신됨