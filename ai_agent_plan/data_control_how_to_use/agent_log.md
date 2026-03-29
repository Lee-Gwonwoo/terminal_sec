## 2026-03-29

**작성 시각:** 2026-03-29 12:13 (local)

### data_control_how_to_use plan 초안 작성

- 생성 파일:
  - `ai_agent_plan/data_control_how_to_use/plan.md`
  - `ai_agent_plan/data_control_how_to_use/agent_log.md`
- 수행 내용:
  - Data Control update 버튼 우클릭 `how to use` 기능에 대한 전용 plan을 신규 작성했다.
  - 기존 `EvidenceTableWindow` / `App.tsx` / `CaseDescriptionWindow` 패턴을 재사용 가능한 선행 구조로 반영했다.
  - 단계별로 context menu, 전용 help window, 설명 registry 분리 방향을 정리했다.
- 검증:
  - plan 스킬 문서를 다시 읽어 plan 구조와 agent log 작성 의무를 확인했다.
  - 이번 변경은 문서 생성 단계이며, 코드/빌드/런타임 변경은 아직 없다.
- 상태:
  - plan 초안 작성 완료, 사용자 검토 대기.