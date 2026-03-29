### 목표

Data Control 창의 각 update 버튼을 우클릭했을 때 `how to use` 메뉴가 뜨고, 이를 누르면 해당 버튼의 사용 방법과 주의사항을 설명하는 전용 창이 열리도록 만드는 계획을 정리한다.

이번 tranche의 직접 목표는 아래 3가지다.

1. Data Control의 update 버튼마다 우클릭 context menu를 붙인다.
2. `how to use`를 누르면 설명 전용 창이 열리도록 window/event 패턴을 연결한다.
3. 각 버튼별 설명 문구를 일관된 registry 또는 spec 데이터로 관리한다.

### 현재 레포 상태(중요, 확인됨)

- 현재 `DataControlWindow.tsx`는 update 버튼을 일반 클릭으로만 실행하며, 버튼별 `description` 텍스트는 인라인 문자열로만 존재한다.
- `calendarCustom`, `custom change`, `companyDesc`, `ipoDate` 같은 섹션은 사용법이 복잡하지만 별도 설명 창은 없다.
- 프론트에는 이미 유사 패턴이 존재한다.
  - `EvidenceTableWindow.tsx`는 case item 우클릭 후 `description` 버튼을 띄운다.
  - `App.tsx`는 `open-case-description` custom event를 받아 새 창을 연다.
  - `CaseDescriptionWindow.tsx`는 설명 전용 창 컴포넌트로 동작한다.
- 즉 context menu + custom event + draggable window 라는 재사용 가능한 선행 패턴이 이미 있다.

### 제약 / 비범위

- 이번 plan은 Data Control 창의 update 버튼 설명 UX에 집중한다.
- 실제 update 동작 로직 자체는 이 plan의 기본 범위가 아니다.
- 번역/다국어 지원은 우선 범위 밖이다.
- 버튼별 설명 문구는 한국어 중심으로 작성한다.

### 읽는 방법(비개발자/일반인 기준)

- Step 0은 기존 재사용 패턴과 Data Control 버튼 구조를 확인하는 단계다.
- Step 1은 우클릭 메뉴를 붙이는 단계다.
- Step 2는 설명 창을 띄우는 창 타입과 데이터 구조를 만드는 단계다.
- Step 3은 버튼별 사용 설명 내용을 채우는 단계다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- 구현 전 plan을 먼저 고정한다.
- Step별로 정적 분석, build, runtime UI 확인을 수행한다.
- 사용자 확인 전까지 각 Step 상태는 `⏳`로 유지한다.
- 추가 요청이 생기면 기존 plan을 지우지 않고 `PLAN CHANGE` 형태로 누적한다.

### 아키텍처(상위)

- source UI:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
- reusable window/event pattern:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DraggableWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CaseDescriptionWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`
- new candidate files:
  - `dataControlHowToUse.ts` 또는 유사 registry 파일
  - `DataControlHowToUseWindow.tsx` 또는 기존 설명 창 재사용 여부 결정

### 결정/선행조건(초기에 확정 필요)

| 결정 ID | 내용 | 기본값 | 이유 |
|---------|------|--------|------|
| D1 | 설명 창을 기존 `CaseDescriptionWindow` 형태로 재사용할지, 별도 창을 만들지 | 별도 창 | Data Control용 필드 구성이 다르기 때문 |
| D2 | `how to use`를 모든 update 버튼에 붙일지 | 예 | 사용자가 모든 버튼에서 일관된 UX를 기대할 가능성이 높음 |
| D3 | 설명 데이터 저장 방식을 인라인이 아닌 registry 파일로 분리할지 | 예 | 버튼 수가 많아질수록 유지보수가 쉬움 |

### 계획 중간 필수 확인

- 모든 update 버튼에서 우클릭이 동일하게 동작하는지 확인해야 한다.
- 기존 좌클릭 실행 동작을 깨뜨리지 않아야 한다.
- 설명 창이 버튼별로 올바른 내용을 보여줘야 한다.
- outside click / escape / window opening 이벤트가 기존 창 시스템과 충돌하지 않아야 한다.

### 제안하는 구현 순서(이유)

1. Data Control 버튼 inventory와 공통 context menu 패턴을 먼저 정리한다.
2. 설명 데이터 구조와 창 타입을 만든다.
3. Data Control 버튼 우클릭 메뉴를 붙인다.
4. 버튼별 how-to content를 채우고 검증한다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 0 — 기존 패턴 감사

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | `EvidenceTableWindow`의 우클릭 + description 패턴 확인 | ⏳ |
| 0-2 | `App.tsx` / `DraggableWindow.tsx`의 설명 창 오픈 구조 확인 | ⏳ |
| 0-3 | `DataControlWindow`의 update 버튼 inventory 정리 | ⏳ |

0-1 목적: 재사용 가능한 구현 패턴을 찾기 위함.
설명: 이미 있는 context menu + description 흐름을 Data Control에도 적용 가능한지 확인한다.
완료 조건(눈으로 확인): 어떤 파일/이벤트/컴포넌트를 재사용할지 정리돼 있다.
사람 검증(비개발자): 기존에도 비슷한 설명 창 기능이 있었다는 점을 이해할 수 있어야 한다.
흔한 문제/주의: 기존 case description용 데이터 구조를 그대로 가져오면 필드가 맞지 않을 수 있다.

0-2 목적: 새 설명 창이 기존 window 시스템에 안전하게 올라가게 하기 위함.
설명: custom event, window type, draggable rendering 분기를 확인한다.
완료 조건(눈으로 확인): 새 창을 어디에 연결해야 하는지 설명 가능해야 한다.
사람 검증(비개발자): 새 창이 기존 창처럼 열릴 것이라는 점이 이해돼야 한다.
흔한 문제/주의: window type 추가와 event listener 추가를 한쪽만 하면 창이 안 열린다.

0-3 목적: 빠뜨리는 버튼 없이 범위를 고정하기 위함.
설명: Data Control의 update 버튼 목록을 정리하고, 각 버튼의 설명 필요 수준을 나눈다.
완료 조건(눈으로 확인): 버튼 inventory가 있다.
사람 검증(비개발자): 어떤 버튼에 how to use가 붙는지 한눈에 보여야 한다.
흔한 문제/주의: 탭/섹션별 조건부 렌더링 버튼을 빠뜨릴 수 있다.

검증 훅:
```text
- EvidenceTableWindow.tsx 우클릭 description 흐름 확인
- App.tsx / DraggableWindow.tsx 설명 창 연결 확인
- DataControlWindow.tsx update button inventory 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 1 — Data Control 버튼 우클릭 메뉴 추가

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | update 버튼별 context menu state와 anchor 좌표 추가 | `DataControlWindow.tsx` | 정적 분석 0건 | ⏳ |
| 1-2 | 버튼 우클릭 시 `how to use` menu 표시 | `DataControlWindow.tsx` | UI 확인 | ⏳ |
| 1-3 | outside click / escape 시 메뉴 닫힘 처리 | `DataControlWindow.tsx` | UI 확인 | ⏳ |

1-1 목적: 버튼 단위 메뉴 상태를 관리하기 위함.
설명: 어떤 버튼을 우클릭했는지와 메뉴 좌표를 저장하는 state를 추가한다.
완료 조건(눈으로 확인): 버튼별 context menu state가 코드에 있다.
사람 검증(비개발자): 우클릭한 버튼에 맞는 메뉴가 뜰 준비가 된 상태다.
흔한 문제/주의: 버튼 key와 section key를 잘못 연결하면 엉뚱한 설명이 열릴 수 있다.

1-2 목적: 사용자가 설명 진입점을 쉽게 찾게 하기 위함.
설명: update 버튼 우클릭 시 작은 메뉴로 `how to use`를 노출한다.
완료 조건(눈으로 확인): 우클릭 메뉴가 뜬다.
사람 검증(비개발자): 버튼을 오른쪽 클릭하면 설명 메뉴가 보여야 한다.
흔한 문제/주의: 좌클릭 실행과 우클릭 메뉴가 충돌하지 않아야 한다.

1-3 목적: 메뉴가 화면에 남아 UI를 방해하지 않게 하기 위함.
설명: 바깥 클릭과 ESC에 메뉴가 닫히도록 한다.
완료 조건(눈으로 확인): 메뉴가 자연스럽게 닫힌다.
사람 검증(비개발자): 메뉴가 떠도 쉽게 닫을 수 있어야 한다.
흔한 문제/주의: log panel이나 modal과 이벤트 충돌 가능성이 있다.

검증 훅:
```text
frontend build
Data Control 창에서 update 버튼 우클릭
outside click / ESC로 메뉴 닫힘 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 2 — How To Use 설명 창 타입 추가

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | Data Control용 how-to data type 정의 | `src/app/types.ts` | 타입 에러 0건 | ⏳ |
| 2-2 | 설명 창 컴포넌트 추가 또는 기존 창 재사용 분기 연결 | `src/app/components/DataControlHowToUseWindow.tsx`, `DraggableWindow.tsx` 등 | build 확인 | ⏳ |
| 2-3 | custom event로 창 열기 흐름 연결 | `App.tsx`, `DataControlWindow.tsx` | runtime 확인 | ⏳ |

2-1 목적: 버튼별 설명 내용을 구조화하기 위함.
설명: title, 목적, 언제 실행하는지, 입력값, 주의사항, 결과 확인법 같은 필드를 정의한다.
완료 조건(눈으로 확인): how-to window data 타입이 생긴다.
사람 검증(비개발자): 설명 창에 어떤 정보가 들어갈지 틀이 정해져야 한다.
흔한 문제/주의: 케이스 설명 창 타입을 억지로 재사용하면 필드가 부족하거나 혼란스러울 수 있다.

2-2 목적: 설명을 실제 창으로 보여주기 위함.
설명: Data Control 전용 설명 창을 추가하고 draggable window rendering에 연결한다.
완료 조건(눈으로 확인): 새 window type이 렌더링 분기에 있다.
사람 검증(비개발자): 기존 창과 같은 방식으로 설명 창이 떠야 한다.
흔한 문제/주의: lazy import / window type 등록을 하나라도 빠뜨리면 창이 안 열린다.

2-3 목적: 우클릭 메뉴와 설명 창을 실제로 연결하기 위함.
설명: `how to use` 클릭 시 custom event를 dispatch하고 App에서 받아 창을 연다.
완료 조건(눈으로 확인): 메뉴 클릭으로 새 설명 창이 열린다.
사람 검증(비개발자): `how to use` 클릭 후 바로 설명이 보여야 한다.
흔한 문제/주의: event 이름 충돌이나 detail payload mismatch가 생길 수 있다.

검증 훅:
```text
frontend build
우클릭 -> how to use 클릭 -> 설명 창 오픈 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 3 — 버튼별 How To Use 설명 데이터 작성

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | update 버튼 설명 registry 파일 추가 | `src/app/dataControlHowToUse.ts` 등 | 정적 분석 0건 | ⏳ |
| 3-2 | 각 update 버튼에 대응하는 설명 문구 작성 | 같은 파일 | 내용 검토 | ⏳ |
| 3-3 | 버튼 key와 how-to registry 매핑 연결 | `DataControlWindow.tsx` | runtime 확인 | ⏳ |

3-1 목적: 설명 문구를 인라인 JSX에서 분리해 유지보수성을 높이기 위함.
설명: 버튼 key 기준으로 설명 데이터를 관리하는 registry를 만든다.
완료 조건(눈으로 확인): 별도 registry 파일이 생긴다.
사람 검증(비개발자): 설명이 한 군데에서 관리되면 추후 수정이 쉬워진다.
흔한 문제/주의: 버튼 key와 registry key가 어긋나면 빈 창이 열릴 수 있다.

3-2 목적: 사용자가 실제로 도움되는 설명을 읽게 하기 위함.
설명: 각 버튼에 대해 목적, 추천 사용 시점, 입력값 의미, 주의사항, 결과 확인 방법을 적는다.
완료 조건(눈으로 확인): 모든 update 버튼이 의미 있는 설명을 가진다.
사람 검증(비개발자): 버튼을 누르기 전에 뭘 하는 기능인지 이해할 수 있어야 한다.
흔한 문제/주의: 설명이 너무 짧으면 도움되지 않고, 너무 길면 창이 읽기 어려워진다.

3-3 목적: 설명 데이터와 실제 버튼을 1:1로 연결하기 위함.
설명: section key를 기준으로 올바른 how-to payload를 창에 넘긴다.
완료 조건(눈으로 확인): 버튼마다 다른 설명이 열린다.
사람 검증(비개발자): `Custom Change% Update`를 눌렀을 때 그 버튼 전용 설명이 떠야 한다.
흔한 문제/주의: 복수 버튼이 같은 statusKey를 써도 설명은 버튼 key 기준으로 구분해야 한다.

검증 훅:
```text
Data Control update 버튼 여러 개 우클릭
각 how to use 창 내용이 버튼별로 다른지 확인
```
사용자 확인 필요: **예**

#### 🚫 Step 4 — 선택적 확장

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | `how to use`를 우클릭 외에 작은 help 아이콘으로도 노출할지 결정 | `DataControlWindow.tsx` | UX 승인 필요 | 🚫 |
| 4-2 | 설명 창 안에 예시 command / API route / plan 링크를 더 넣을지 결정 | registry/window 파일 | UX 승인 필요 | 🚫 |

4-1 목적: discoverability를 더 높일지 판단하기 위함.
설명: 우클릭만으로 충분한지, help 아이콘도 필요한지 별도 UX 결정이 필요하다.
완료 조건(눈으로 확인): 이번 tranche 포함 여부가 정해진다.
사람 검증(비개발자): 설명 기능을 찾기 쉬워야 한다.
흔한 문제/주의: 버튼 UI가 과도하게 복잡해질 수 있다.

4-2 목적: 설명 깊이를 어디까지 둘지 정하기 위함.
설명: 기본안은 실사용 설명 중심으로 두고, 개발자용 세부 route 정보는 선택 사항으로 둔다.
완료 조건(눈으로 확인): 설명 창의 밀도가 과하지 않아야 한다.
사람 검증(비개발자): 너무 기술적인 정보로 가득 차면 읽기 어렵다.
흔한 문제/주의: 내용이 과도하게 길어지면 오히려 `how to use` 창 효용이 떨어진다.

검증 훅:
```text
사용자 UX 승인 전에는 실행하지 않음
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)

| ID | 항목 | 선택지 | 차단 대상 Step |
|----|------|--------|----------------|
| D1 | 설명 창 구현 방식 | 별도 창 / 기존 창 재사용 | Step 2 |
| D2 | 모든 update 버튼 적용 범위 | 전부 적용 / 일부만 적용 | Step 3 |
| D3 | 추가 노출 방식 | 우클릭만 / help 아이콘 병행 | Step 4 |

### 실행 의존성 그래프

Legend: `✅ 사용자 확인 완료` / `⏳ 구현완료, 사용자확인 대기` / `⬜ 미착수` / `🚫 차단`

Track A — 패턴/타입 정리
- ⏳ 0-1 EvidenceTable 우클릭 description 패턴 확인
- ⏳ 0-2 App/DraggableWindow 오픈 구조 확인
- ⏳ 0-3 DataControl 버튼 inventory 정리
- ⏳ 2-1 how-to data type 정의
- ⏳ 2-2 설명 창 컴포넌트/분기 추가
- ⏳ 2-3 custom event 오픈 연결

Track B — 버튼 UX 연결
- ⏳ 1-1 context menu state 추가
- ⏳ 1-2 우클릭 how to use menu 표시
- ⏳ 1-3 outside click / ESC 닫힘 처리
- ⏳ 3-1 how-to registry 파일 추가
- ⏳ 3-2 버튼별 설명 문구 작성
- ⏳ 3-3 버튼 key와 registry 연결

┌──────────────────────────────────────────────┐
│ 사용자 결정 필요                              │
│ 기본안은 모든 update 버튼에 우클릭           │
│ how to use를 붙이는 것이다.                  │
│ help 아이콘 추가 여부는 Step 4에서 별도다.   │
└──────────────────────────────────────────────┘

병렬 트랙 요약
- Track A의 타입/창 구조가 먼저 정리돼야 Track B가 안전하게 붙는다.
- 우클릭 메뉴와 설명 데이터는 분리 관리하는 것이 유지보수에 유리하다.
- 기존 case description 패턴은 참고하되, Data Control 설명 내용은 별도 registry가 적합하다.

차단 요약 테이블
| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D1 | Step 2 | 별도 창 / 기존 창 재사용 |
| D3 | Step 4 | 우클릭만 / help 아이콘 병행 |

### PLAN CHANGE — 2026-03-29 (실구현 반영)

- D1은 실제 구현에서 **별도 창**으로 확정했다. `CaseDescriptionWindow`를 억지로 재사용하지 않고 `DataControlHowToUseWindow.tsx`를 추가했다.
- `types.ts`에 Data Control how-to payload 타입과 새 window type을 추가했다.
- `dataControlHowToUse.ts` registry 파일에서 update 버튼별 설명 데이터를 분리 관리하도록 구현했다.
- `DataControlWindow.tsx`에는 update 버튼 우클릭 context menu + `How To Use` 항목 + outside click / ESC 닫힘 처리를 붙였다.
- `App.tsx` / `DraggableWindow.tsx`에는 `open-data-control-how-to-use` custom event와 draggable window 렌더 분기를 연결했다.
- 현재 남은 것은 사용자 시각 확인 후 상태를 `✅`로 올리는 일과, Step 4의 선택 UX 여부 결정이다.

### PLAN CHANGE — 2026-03-29 (runtime bug fix)

- 사용자 보고 기준으로 `DataControlWindow.tsx`의 우클릭 메뉴가 실제 화면에 보이지 않는 문제가 확인됐다.
- 원인은 두 가지였다.
  - 메뉴를 연 직후 전역 `contextmenu` 리스너가 다시 실행되어 메뉴를 즉시 닫을 수 있었다.
  - 메뉴 좌표는 `clientX/clientY` viewport 기준인데, 메뉴는 `absolute`로 렌더링되어 부모 컨테이너 기준 좌표로 해석되고 있었다.
- 수정 방향은 다음으로 확정했다.
  - 전역 `contextmenu` close 리스너 제거
  - 메뉴를 `fixed` 기준으로 렌더링해 viewport 좌표와 일치시킴
  - 메뉴 자체 우클릭은 `preventDefault()`로 브라우저 기본 메뉴와 충돌하지 않게 처리
- 이번 수정 후 확인 포인트는 다시 단순해졌다.
  - update 버튼 우클릭 시 `How To Use` 메뉴가 즉시 보여야 함
  - outside click / ESC로 메뉴가 닫혀야 함
  - `How To Use` 클릭 시 설명 창이 열려야 함

### PLAN CHANGE — 2026-03-29 (visible fallback added)

- 우클릭 UX만으로는 실제 사용자 검증이 충분하지 않다는 문제가 드러났다.
- 따라서 모든 update 버튼 옆에 보이는 `How To Use` 버튼을 추가해, 우클릭 없이도 동일한 설명 창을 열 수 있게 했다.
- 우클릭 메뉴는 그대로 유지하되, 주요 사용 경로는 이제 visible button + 우클릭 둘 다 지원한다.
- 이번 변경의 확인 포인트는 아래와 같다.
  - Update 옆 `How To Use` 버튼 클릭 시 설명 창이 열려야 함
  - 우클릭 메뉴가 보여도 동일한 설명 창으로 연결돼야 함
  - hidden gesture를 몰라도 기능 접근이 가능해야 함