# Planning & Agent Log (skill)

## EN

### When to use
- When the user explicitly asks for `plan.md`, a plan, or step-by-step execution.
- When you need strict step gating (finish → verify → ask user confirmation) before proceeding.
- When you need to keep a chronological execution record in `agent_log.md`.
- When the task is large/complex and should be decomposed into verifiable sub-steps.

## Plan & Agent Log
- Before starting implementation, decide which `.github/copilot-skills/*.md` documents apply to this task and state your choice in chat (example: “Using: planning.md + datasource-eodhd.md”). Then start work.
- Create `plan.md` **only when the user explicitly requests it**.
- Treat any direct request for a plan as “explicit” (examples: “plan을 세워라”, “계획 세워줘”, “플랜 만들어”, “plan 작성”, “plan.md 만들어”).
- When a user requests a plan, do BOTH:
  - Write the detailed step-by-step plan in chat (required by Execution discipline)
  - Create `C:\github_coding\terminal_sec\ai_agent_plan\<project_name>\plan.md` (unless the user explicitly forbids file changes)
- If the user says “don’t execute/run” (e.g., “실행하지 말고”) and it’s ambiguous whether file writes are allowed, use the hook question flow (`ask_questions`) to confirm before creating/modifying files.
  - Default interpretation (unless the user says otherwise): “don’t execute/run” = no code execution (no tests/dev server/scripts), but creating/updating `plan.md` is allowed.
- Write/update `agent_log.md` **only when the user explicitly tells you to execute a specific plan**.
- **`agent_log.md` language rule (must):** `agent_log.md` is written in **Korean only** (한국어 단독). Do NOT write bilingual EN/KO sections in the log — Korean is sufficient.
- File storage: `C:\github_coding\terminal_sec\ai_agent_plan\<project_name>\`
  - `plan.md`: detailed step-by-step plan before starting (goal, approach, files to create/modify, order, risks). Bilingual EN+KO (but see Agent-specific language override — Claude writes Korean only).
  - `agent_log.md`: chronological record of every action taken (files created/modified, commands run, decisions, errors). **Korean only.**
- **Break large tasks into steps:** if a task is large or complex, decompose it into small, independently verifiable steps. Each step should have a clear deliverable.
- **Plan changes (mid-stream):** keep history intact.
  - Do not rewrite or delete previously recorded log entries.
  - Treat plan updates as revisions: append a short “PLAN CHANGE” note (what/why/impact) and continue from the new plan.
- **Intermediate review loop:** after each step, verify the result (e.g., check file content, run a test, confirm output) and provide a user-checkable verification procedure.
  - If user confirmation is required for that step, ask for it explicitly.
  - In `agent_log.md`, mark step completion as “user-confirmed” only after the user confirms; otherwise mark “awaiting user confirmation”.
  - If issues are discovered, record them and propose concrete next actions/options.

## Plan sub-step methodology
When a plan has multiple major Steps (e.g., Step 0, Step 1, …, Step N), **each Step must be further decomposed into numbered sub-steps** following this structure:

- **Sub-step numbering:** use `<Step>-<seq>` format (e.g., `1-1`, `1-2`, `2-1`).
- **Sub-step table (required for each Step):**

  | Column | Purpose |
  |--------|---------|
  | Sub-step | ID (e.g., `1-1`) |
  | Task | One-sentence description of what to do |
  | Files | Which files are created/modified |
  | Verification | Exact command or check to confirm the sub-step is done correctly |

  Example:
  ```
  | Sub-step | Task | Files | Verification |
  |----------|------|-------|--------------|
  | 1-1 | Add `foo` table CREATE in `initDb()` | `src/db.ts` | Start backend → table exists (`SELECT name FROM sqlite_master WHERE name='foo'`) |
  | 1-2 | Create `fooRepository.ts` service | `src/services/fooRepository.ts` | `npx tsc --noEmit` → 0 errors |
  ```

- **Verification hook block (required for each Step closeout):**
  - After all sub-steps within a Step are completed, include a fenced code block listing the exact verification commands (build, test, curl, DB query, etc.).
  - End with: `User confirmation needed: **Yes**`.
  - Example:
    ```
    Verification hook (Step 1 closeout):
    1. cd project && npx tsc --noEmit   → 0 errors
    2. npm run test                     → all tests pass
    3. curl http://localhost:8080/api/foo → returns expected JSON
    ```

- **User-gate rule (must):**
  - After completing a Step's verification hook, present the results to the user via `ask_questions`.
  - Do **not** proceed to the next Step until the user explicitly confirms the current Step.
  - If the user rejects or finds issues → fix, re-verify, re-ask.
  - Only after user confirms → mark `completed (user-confirmed)` in `agent_log.md`.

- **Sequential within a Step, gated between Steps:**
  - Sub-steps within the same Step are executed sequentially.
  - Steps themselves may be parallelizable — document this with an **Execution dependency graph** (a detailed ASCII/Markdown diagram showing which Steps depend on which).

- **Execution dependency graph requirements (must):**
  - Include a **legend** at the top showing all status emojis.
  - Show **every sub-step** listed under its parent Step (one line each, with its current status emoji).
  - Label **parallel tracks** clearly (e.g., Track A / Track B) and state what each track covers.
  - Show **blocked sections** with a boxed banner explaining the blocker.
  - After the graph, include:
    - A **Parallel tracks summary** listing which Steps run in parallel and any prerequisites.
    - A **Blocker summary table** (`Decision | Blocks | Options`) if there are pending decisions.
  - Example (detailed):
    ```
    ╔═══════════════════════════════════════════════════════╗
    ║            EXECUTION DEPENDENCY GRAPH                 ║
    ║  Legend: ✅ Done  ⏳ Awaiting  🚫 BLOCKED  ⬜ Todo    ║
    ╚═══════════════════════════════════════════════════════╝

    ✅ Step 0 (audit)
    │   ├─ 0-1 probe API .............. ✅ Done
    │   └─ 0-2 capability matrix ...... ✅ Done
    │
    ▼
    ⬜ Step 1 (foundations)
    │   ├─ 1-1 create table ........... ⬜
    │   └─ 1-2 wire endpoint .......... ⬜
    │
    ├───────────────┬──────────────────┐
    │  TRACK A      │  TRACK B         │
    ▼               ▼                  │
    ⬜ Step 2        ⬜ Step 4           │
    │               │                  │
    ▼               ▼                  │
    ⬜ Step 3        ⬜ Step 5           │
    │               │                  │
    └───────┬───────┘                  │
            ▼                          │
    ╔═══════════════════════════╗       │
    ║ 🚫 BLOCKED SECTION       ║       │
    ║ Needs decision X         ║       │
    ╚═══════════════════════════╝       │
            │                          │
            ├─► 🚫 Step 6             │
            ├─► 🚫 Step 7             │
            ▼                          │
    ⬜ Step 8 ◄── needs 6+7            │
            ▼                          │
    ⬜ Step 9 (final)                   │
    ```

- **Blocked Steps:** if a Step depends on an unresolved decision or external blocker, mark it with `⚠️ BLOCKED` and state the prerequisite. Do not start blocked Steps.

- **Status tracking in sub-step tables:** use these status markers:
  - `✅ Done` — completed and verified
  - `⏳ Awaiting user` — done but waiting for user confirmation
  - `🚫 BLOCKED` — cannot start due to unresolved dependency
  - `⬜` — not started

- **plan.md writing conventions (must follow when creating/updating plan.md):**
  - **Structure order:** Goal → Approach overview → Step list (each with sub-step table + verification hook) → Execution dependency graph → Open questions / blockers.
  - **Bilingual:** EN section first, `---` separator, then KO section (same content, translated). *(Override: Claude agents write Korean only — see Agent-specific language override.)*
  - **Every Step heading** must include its number and a short descriptive name: `#### Step N — Short name`.
  - **Sub-step tables** are mandatory for every Step (see sub-step table format above).
  - **Verification hook blocks** are mandatory for every Step closeout.
  - **Execution dependency graph** must be detailed (see graph requirements above) — not a simplified tree.
  - **Emoji status markers** must be used consistently in both the sub-step tables and the dependency graph to provide at-a-glance progress visibility.
  - **Blocker tracking:** blocked Steps must be visually distinct (boxed section in graph, `⚠️ BLOCKED` label, prerequisite stated).
  - **Pre-written code notes:** if code was written before formal plan execution, note it explicitly under the relevant sub-step (e.g., "pre-written (needs verify)").
  - **Open questions section:** list pending decisions with numbered IDs, options, and which Steps they block.

---

## KO

### 언제 쓰나
- 사용자가 `plan.md`/plan/계획/플랜 같은 “명시적 계획”을 요구할 때.
- 단계별로 “완료 → 검증 → 사용자 확인” 게이팅이 필요한 작업일 때.
- 작업 수행 기록을 `agent_log.md`로 시간순으로 남겨야 할 때.
- 큰 작업을 검증 가능한 세부 단계로 쪼개서 진행해야 할 때.

## 플랜 & 에이전트 로그
- 구현/수정 작업을 시작하기 전에, 이번 작업에 적용할 `.github/copilot-skills/*.md` 문서가 무엇인지 판단한 뒤 채팅에 먼저 명시한다(예: “참고: planning.md + datasource-eodhd.md”). 그 다음 작업을 시작한다.
- `plan.md`는 **사용자가 명시적으로 요청할 때만** 생성.
- “plan/계획을 세워달라”는 직접 요청은 모두 “명시적 요청”으로 취급한다(예: “plan을 세워라”, “계획 세워줘”, “플랜 만들어”, “plan 작성”, “plan.md 만들어”).
- 사용자가 plan을 요청하면 아래 둘 다 수행한다:
  - 채팅에 상세 단계별 계획을 작성(작업 수행 규율의 요구사항)
  - `C:\github_coding\terminal_sec\ai_agent_plan\<project_name>\plan.md` 파일을 생성(단, 사용자가 ‘파일 변경 금지’를 명시한 경우 제외)
- 사용자가 “실행하지 말고”(예: “실행하지 말고”)라고 말했을 때, 파일 작성까지 금지인지 애매하면 파일을 만들기/수정하기 전에 hook 질문 플로우(`ask_questions`)로 확인한다.
  - 기본 해석(사용자가 별도 명시하지 않는 한): “실행하지 말고” = 코드 실행 금지(테스트/서버/스크립트 실행 금지)이며, `plan.md` 작성/갱신은 허용.
- `agent_log.md`는 **사용자가 특정 plan을 수행하라고 지시할 때만** 작성/업데이트.
- **`agent_log.md` 언어 규칙(필수):** `agent_log.md`는 **한국어 단독**으로 작성한다. 영/한 병기 불필요 — 한국어만으로 충분.
- 저장 위치: `C:\github_coding\terminal_sec\ai_agent_plan\<project_name>\`
  - `plan.md`: 작업 시작 전 상세 단계별 계획 (목표, 접근법, 생성/수정 파일, 순서, 위험 요소). 영/한 병기 (단, 에이전트별 언어 오버라이드 참고 — Claude는 한국어 단독).
  - `agent_log.md`: 수행한 모든 작업을 시간순으로 기록 (생성/수정 파일, 실행 명령어, 결정, 오류). **한국어 단독.**
- **큰 작업은 단계로 쪼개기:** 크고 복잡한 작업은 독립적으로 검증 가능한 작은 단계로 분해한다. 각 단계마다 명확한 산출물을 정의한다.
- **플랜 중간 변경(리비전):** 기록 히스토리를 유지한다.
  - 이미 기록된 로그를 재작성하거나 삭제하지 않는다.
  - plan 수정은 변경 이력으로 처리한다: “PLAN CHANGE” 노트를 짧게 추가(무엇/왜/영향)하고 새 plan 기준으로 진행한다.
- **중간 결과물 검토 루프:** 각 단계 완료 후 결과를 검증(파일 내용 확인, 테스트 실행, 출력 확인)하고, 사용자가 직접 확인할 수 있는 검증 절차를 함께 제공한 뒤 다음 단계로 진행한다.
  - 해당 단계에 사용자 확인이 필요하면, 채팅에서 명확히 확인을 요청한다.
  - `agent_log.md`에서는 사용자 확인 전에는 “확인 대기”로 표시하고, 확인 후에만 “사용자 확인 후 완료”로 업데이트한다.
  - 문제점이 발견되면 로그에 기록하고, 다음 행동/선택지를 구체적으로 제안한다.

## 플랜 세부 단계 작성법
plan에 여러 대단계(Step 0, Step 1, …, Step N)가 있을 때, **각 Step을 반드시 번호 매긴 세부 단계(sub-step)로 추가 분해**해야 합니다.

- **세부 단계 번호 형식:** `<Step>-<순번>` (예: `1-1`, `1-2`, `2-1`).
- **세부 단계 테이블(각 Step마다 필수):**

  | 컬럼 | 목적 |
  |------|------|
  | Sub-step | ID (예: `1-1`) |
  | Task | 무엇을 하는지 한 문장 |
  | Files | 생성/수정하는 파일 |
  | Verification | 해당 세부 단계가 올바르게 완료됐는지 확인하는 정확한 명령/체크 |

  예시:
  ```
  | Sub-step | Task | Files | Verification |
  |----------|------|-------|--------------|
  | 1-1 | `initDb()`에 `foo` 테이블 CREATE 추가 | `src/db.ts` | 백엔드 시작 → 테이블 존재 확인 (`SELECT name FROM sqlite_master WHERE name='foo'`) |
  | 1-2 | `fooRepository.ts` 서비스 생성 | `src/services/fooRepository.ts` | `npx tsc --noEmit` → 에러 0개 |
  ```

- **검증 훅 블록(각 Step 마감 시 필수):**
  - Step 내 모든 세부 단계가 완료된 후, 검증 명령어(빌드, 테스트, curl, DB 쿼리 등)를 나열하는 코드 블록을 포함합니다.
  - 마지막에: `사용자 확인 필요: **예**`를 명시합니다.
  - 예시:
    ```
    검증 훅 (Step 1 마감):
    1. cd project && npx tsc --noEmit   → 에러 0개
    2. npm run test                     → 모든 테스트 통과
    3. curl http://localhost:8080/api/foo → 예상 JSON 반환
    ```

- **사용자 게이트 규칙(필수):**
  - Step의 검증 훅 결과를 `ask_questions`를 통해 사용자에게 제시합니다.
  - 사용자가 현재 Step을 명시적으로 확인할 때까지 다음 Step으로 **진행하지 않습니다**.
  - 사용자가 거절하거나 문제를 발견하면 → 수정, 재검증, 재질문.
  - 사용자 확인 후에만 → `agent_log.md`에 `completed (user-confirmed)` 기록.

- **Step 내부는 순차, Step 간에는 게이트:**
  - 같은 Step 내의 세부 단계는 순차적으로 실행합니다.
  - Step 자체는 병렬 실행 가능할 수 있으며, 이를 **실행 의존성 그래프**(상세한 ASCII/Markdown 다이어그램)로 문서화합니다.

- **실행 의존성 그래프 요구사항(필수):**
  - 상단에 모든 상태 이모지를 보여주는 **범례(Legend)**를 포함합니다.
  - **모든 세부 단계**를 부모 Step 아래에 한 줄씩 나열하고, 현재 상태 이모지를 표시합니다.
  - **병렬 트랙**을 명확히 라벨링합니다(예: 트랙 A / 트랙 B) + 각 트랙이 다루는 내용을 명시합니다.
  - **차단 구간**은 박스형 배너로 차단 사유를 설명합니다.
  - 그래프 다음에 포함:
    - **병렬 트랙 요약** — 어떤 Steps가 병렬로 가능한지, 선행 조건은 무엇인지.
    - **차단 요약 테이블** (`결정 | 차단 대상 | 선택지`) — 미결정 사항이 있을 때.
  - 예시 (상세):
    ```
    ╔═══════════════════════════════════════════════════════╗
    ║              실행 의존성 그래프                         ║
    ║  범례: ✅ 완료  ⏳ 대기  🚫 차단됨  ⬜ 미시작          ║
    ╚═══════════════════════════════════════════════════════╝

    ✅ Step 0 (감사)
    │   ├─ 0-1 API 프로브 ............. ✅ 완료
    │   └─ 0-2 능력 매트릭스 .......... ✅ 완료
    │
    ▼
    ⬜ Step 1 (기반)
    │   ├─ 1-1 테이블 생성 ............ ⬜
    │   └─ 1-2 엔드포인트 연결 ........ ⬜
    │
    ├───────────────┬──────────────────┐
    │  트랙 A       │  트랙 B          │
    ▼               ▼                  │
    ⬜ Step 2        ⬜ Step 4           │
    │               │                  │
    ▼               ▼                  │
    ⬜ Step 3        ⬜ Step 5           │
    │               │                  │
    └───────┬───────┘                  │
            ▼                          │
    ╔═══════════════════════════╗       │
    ║ 🚫 차단 구간              ║       │
    ║ 결정 X 필요              ║       │
    ╚═══════════════════════════╝       │
            │                          │
            ├─► 🚫 Step 6             │
            ├─► 🚫 Step 7             │
            ▼                          │
    ⬜ Step 8 ◄── 6+7 필요             │
            ▼                          │
    ⬜ Step 9 (최종)                    │
    ```

- **차단된 Step:** 미결정 사항이나 외부 차단 요소에 의존하는 Step은 `⚠️ BLOCKED`로 표시하고 선행 조건을 명시합니다. 차단된 Step은 시작하지 않습니다.

- **세부 단계 테이블 상태 표기:** 아래 마커를 사용합니다:
  - `✅ Done` — 완료 및 검증됨
  - `⏳ Awaiting user` — 완료했으나 사용자 확인 대기 중
  - `🚫 BLOCKED` — 미해결 의존성으로 시작 불가
  - `⬜` — 미시작

- **plan.md 작성 규칙(plan.md 생성/수정 시 반드시 준수):**
  - **구조 순서:** 목표 → 접근법 개요 → Step 목록(각 Step에 세부 단계 테이블 + 검증 훅) → 실행 의존성 그래프 → 미결정 사항/차단 요소.
  - **한/영 병기:** EN 섹션을 먼저, `---` 구분선, 그 다음 KO 섹션(동일 내용 번역). *(오버라이드: Claude는 한국어 단독 — 에이전트별 언어 오버라이드 참고.)*
  - **모든 Step 제목**에는 번호와 짧은 설명을 포함: `#### Step N — 짧은 이름`.
  - **세부 단계 테이블**은 모든 Step에 필수(위의 세부 단계 테이블 형식 참조).
  - **검증 훅 블록**은 모든 Step 마감 시 필수.
  - **실행 의존성 그래프**는 상세하게 작성(위의 그래프 요구사항 참조) — 단순 트리가 아닌 상세 그래프.
  - **이모지 상태 마커**를 세부 단계 테이블과 의존성 그래프 모두에서 일관되게 사용하여 한눈에 진행 상황을 파악할 수 있게 합니다.
  - **차단 추적:** 차단된 Step은 시각적으로 뚜렷하게 구분(그래프에서 박스 구간, `⚠️ BLOCKED` 라벨, 선행 조건 명시).
  - **사전 작성 코드 표기:** 정식 plan 실행 전에 코드가 작성된 경우, 해당 세부 단계에 명시적으로 기록(예: "사전 작성됨 (검증 필요)").
  - **미결정 사항 섹션:** 번호 ID, 선택지, 차단 대상 Step을 포함한 미결정 사항 목록 유지.
