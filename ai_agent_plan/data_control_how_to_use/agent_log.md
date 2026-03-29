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

**작성 시각:** 2026-03-29 13:20 (local)

### Data Control How To Use 실제 구현 반영

- 생성/수정 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/dataControlHowToUse.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlHowToUseWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DraggableWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - `ai_agent_plan/data_control_how_to_use/plan.md`
  - `ai_agent_plan/data_control_how_to_use/agent_log.md`
- 수행 내용:
  - update 버튼 우클릭 시 section key + 좌표를 잡는 context menu state를 `DataControlWindow.tsx`에 추가했다.
  - context menu에는 `How To Use` 항목을 붙였고, outside click / ESC로 닫히게 했다.
  - `types.ts`에 Data Control how-to payload 타입과 새 window type을 추가했다.
  - `dataControlHowToUse.ts` registry 파일에서 `price`, `calendarCustom`, `custom change` 등 모든 update 버튼 설명 문구를 key 기준으로 분리했다.
  - `DataControlHowToUseWindow.tsx`를 신규 추가해 설명을 전용 draggable window로 렌더링하도록 했다.
  - `App.tsx` / `DraggableWindow.tsx`에는 `open-data-control-how-to-use` custom event와 새 window 렌더 분기를 연결했다.
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 관련 프론트 파일 0 errors |
| 빌드 | ✅ | frontend `npm.cmd run build`, backend `npm.cmd run build` 모두 성공 |
| 자동 테스트 | ✅ | backend `84/84` pass |
| 런타임 통합 | ✅ | `DataControlWindow.tsx` 우클릭/닫힘 분기 코드 리뷰 + local frontend build 산출물 생성 확인, 브라우저 시각 확인은 사용자 위임 |

- 상태:
  - Step 1-1 ~ 1-3, Step 2-1 ~ 2-3, Step 3-1 ~ 3-3 구현 완료 후 사용자 확인 대기.
  - Step 4는 여전히 UX 선택 사항으로 차단 상태 유지.

**작성 시각:** 2026-03-29 13:44 (local)

### Data Control How To Use 우클릭 메뉴 runtime 버그 수정

- 수정 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - `ai_agent_plan/data_control_how_to_use/plan.md`
  - `ai_agent_plan/data_control_how_to_use/agent_log.md`
- 원인 분석:
  - 메뉴를 연 직후 전역 `contextmenu` 리스너가 다시 발화되어 메뉴를 바로 닫아버릴 수 있었다.
  - 메뉴 좌표는 viewport 기준 `clientX/clientY`인데 렌더링은 `absolute`여서 부모 컨테이너 기준으로 어긋날 수 있었다.
- 수행 내용:
  - 전역 `contextmenu` close 리스너를 제거했다.
  - 우클릭 메뉴 컨테이너를 `absolute`에서 `fixed`로 바꿔 viewport 좌표와 일치시켰다.
  - 메뉴 자체 우클릭에는 `preventDefault()`를 붙여 브라우저 기본 메뉴와 겹치지 않게 했다.
- 검증:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `DataControlWindow.tsx` 0 errors |
| 빌드 | ✅ | frontend `npm.cmd run build` 성공 |
| 런타임 코드 리뷰 | ✅ | 즉시 닫힘 경로 제거 + viewport 좌표 일치 확인 |

- 상태:
  - runtime 표시 버그 수정 반영 완료.
  - 최종 사용성 확인은 사용자 브라우저 확인 대기.

**작성 시각:** 2026-03-29 13:52 (local)

### Data Control How To Use visible fallback 추가

- 수정 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - `ai_agent_plan/data_control_how_to_use/plan.md`
  - `ai_agent_plan/data_control_how_to_use/agent_log.md`
- 수행 내용:
  - 모든 Data Control update 버튼 옆에 보이는 `How To Use` 버튼을 추가했다.
  - 이 버튼은 우클릭 메뉴와 동일하게 `openHowToUseWindow(key)`를 호출해 동일한 설명 창을 연다.
  - 따라서 우클릭 gesture가 불안정하거나 사용자가 discover하지 못해도 도움말 진입이 가능해졌다.
- 검증:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `DataControlWindow.tsx` 0 errors |
| 빌드 | ✅ | frontend `npm.cmd run build` 성공 |
| 사용성 보완 | ✅ | hidden gesture 의존 제거 |

- 상태:
  - 우클릭 경로 + visible button 경로 모두 코드상 연결 완료.
  - 최종 브라우저 동작 확인은 사용자 확인 대기.