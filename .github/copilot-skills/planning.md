# Planning & Agent Log (skill)

## EN

> ⚠️ EN section may be outdated — KO section is the authoritative source.

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
  - `plan.md`: detailed step-by-step plan before starting (goal, approach, files to create/modify, order, risks). **See `plan.md writing conventions` below for language rules.**
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

- **Sub-step purpose & description block (inline, recommended):**
  - Immediately under each sub-step table, add a short mapping of each sub-step ID to:
    - **Purpose:** why the sub-step exists (1 short phrase)
    - **Description:** what to do / what “done” means (1 sentence)
  - For non-engineer readability and acceptance testing, extend each sub-step line with the following (keep them short, but observable):
    - **Done when (observable):** what a human can see to confirm completion
    - **Human check (non-engineer):** the simplest check a non-engineer can do (UI click, file exists, a known string appears, etc.)
    - **Common issues to watch:** 1–2 likely pitfalls and how to recognize them
  - Keep IDs exactly aligned with the table (no missing/extra IDs).
  - Keep it **inline under the Step** (do not move these into a separate appendix that can drift).
  - Example:
    ```
    Sub-step purpose & description (Step 1)
    - `1-1` Purpose: Persist status in DB. Description: create/update the `update_status` table during init.
      Done when: a DB query shows the table exists (and columns are correct).
      Human check: run the provided query and confirm the table name appears.
      Common issues to watch: wrong DB path; schema mismatch after a refactor.
    - `1-2` Purpose: Centralize writes. Description: implement repository methods used by routes.
      Done when: routes call the repository and tests/TS build pass.
      Human check: run the verification commands and confirm “0 errors”.
      Common issues to watch: circular imports; returning inconsistent shapes.
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
  - **Language rules (unified with `copilot-instructions.md`):**
    - **All agents:** The KO section is the primary source of truth for AI reading; when interpreting a bilingual doc, read KO first.
    - **Claude (any version):** Write `plan.md` in **KO only** (do not create an EN section).
      - If editing an existing EN+KO `plan.md`: update **KO only**; keep EN unchanged except for adding the staleness banner if it is missing.
    - **Non-Claude agents (GPT, Gemini, etc.):** Write **EN+KO**. Put EN first, then `---`, then KO (same content translated). KO remains authoritative.
    - **Why EN first (for EN+KO docs):** This is a formatting convention for consistent diffs and human scanning; it does not mean EN is authoritative.
    - **Authoring workflow (content order):** Draft/update the **KO content first**, then translate/sync the EN content. Keep the file layout as EN → `---` → KO.
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
- `agent_log.md`는 **채팅에서 plan이 논의·작업되고 있는 상태에서 코드 변경이 발생할 때마다** 작성/업데이트한다. 기존의 "사용자가 특정 plan을 수행하라고 지시할 때만" 조건은 삭제 — plan 컨텍스트가 활성 상태이면 코드 변경 시점에 자동으로 기록한다.
- **`agent_log.md` 언어 규칙(필수):** `agent_log.md`는 **한국어 단독**으로 작성한다. 영/한 병기 불필요 — 한국어만으로 충분.
- 저장 위치: `C:\github_coding\terminal_sec\ai_agent_plan\<project_name>\`
  - `plan.md`: 작업 시작 전 상세 단계별 계획 (목표, 접근법, 생성/수정 파일, 순서, 위험 요소). **언어 규칙은 아래 `plan.md 작성 규칙` 참조.**
  - `agent_log.md`: 수행한 모든 작업을 시간순으로 기록 (생성/수정 파일, 실행 명령어, 결정, 오류). **한국어 단독.**
- **큰 작업은 단계로 쪼개기:** 크고 복잡한 작업은 독립적으로 검증 가능한 작은 단계로 분해한다. 각 단계마다 명확한 산출물을 정의한다.
- **플랜 중간 변경(리비전):** 기록 히스토리를 유지한다.
  - 이미 기록된 로그를 재작성하거나 삭제하지 않는다.
  - plan 수정은 변경 이력으로 처리한다: “PLAN CHANGE” 노트를 짧게 추가(무엇/왜/영향)하고 새 plan 기준으로 진행한다.
- **중간 결과물 검토 루프:** 각 단계 완료 후 결과를 검증(파일 내용 확인, 테스트 실행, 출력 확인)하고, 사용자가 직접 확인할 수 있는 검증 절차를 함께 제공한 뒤 다음 단계로 진행한다.
  - 해당 단계에 사용자 확인이 필요하면, 채팅에서 명확히 확인을 요청한다.
  - `agent_log.md`에서는 사용자 확인 전에는 “확인 대기”로 표시하고, 확인 후에만 “사용자 확인 후 완료”로 업데이트한다.
  - 문제점이 발견되면 로그에 기록하고, 다음 행동/선택지를 구체적으로 제안한다.

## plan/log 자동 동기화 규칙 (필수)

> ℹ️ 아래 규칙은 채팅에서 특정 plan.md가 논의/작업 대상인 상태에서 코드 수정이 발생할 때 적용됩니다.

### 규칙 1 — plan.md 코드 변경 동기화 트리거
- 채팅에서 특정 plan.md가 논의·작업 대상이 되고 있는 상태에서 코드 수정(기능 추가, 버그 수정, 리팩터링, UI 변경 등)이 발생하면:
  - 해당 코드 변경에 대응하는 세부 단계를 **현재 채팅에서 논의 중인 plan.md**에 추가/업데이트한다.
  - "다른 프로젝트의 plan"이 아니라, **현재 대화 컨텍스트에서 작업 중인 plan**을 대상으로 한다.
  - 구현 **전** 또는 구현과 **동시에** plan.md를 갱신한다 — 구현 완료 후 plan 미반영 상태를 만들지 않는다.

### 규칙 2 — agent_log.md 트리거 확대
- 채팅에서 plan이 논의되고 있고 코드 변경이 발생하면, `agent_log.md`에도 해당 변경을 기록한다.
- 기존 제한("사용자가 특정 plan을 수행하라고 지시할 때만")은 삭제됨 → plan 컨텍스트가 활성이면 코드 변경 시점에 자동으로 agent_log에 기록.

### 규칙 3 — 사후 체크리스트 (작업 완료 선언 전 필수)
코드 변경을 완료한 후 "작업 끝" 선언 전에 반드시 아래를 확인:
  1. 현재 채팅에서 논의 중인 **plan.md**에 이번 변경이 반영되었는가?
  2. **agent_log.md**에 이번 변경이 기록되었는가?
- 하나라도 미완이면 완료 처리 전에 갱신한다.

### 규칙 4 — 사소해 보여도 애매하면 질문
- plan/log 기록 범위, 세부 단계 반영 여부, 기록 수준(간략 vs 상세) 등이 **사소해 보이더라도** 에이전트가 "이걸 기록해야 하나?", "plan에 넣어야 하나?" 등의 판단에 애매함을 느끼면 즉시 `ask_questions` 플로우를 사용하여 사용자에게 질문한다.
- 에이전트가 독단으로 "사소하니 생략"이라고 결정하지 않는다.
- 이 규칙은 `copilot-instructions.md`의 기존 "애매할 땐 사용자에게 질문" 규칙(`ask_questions` hook question flow)을 plan/log 영역에 명시적으로 확장 적용한 것임.

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

- **세부 단계 목적/설명 블록(인라인, 권장):**
  - 각 Step의 세부 단계 테이블 바로 아래에, 세부 단계 ID별로 다음을 짧게 정리합니다.
    - **목적:** 왜 이 세부 단계가 필요한지(짧은 구)
    - **설명:** 무엇을 하면 완료인지/어떤 산출물인지(1문장)
  - 비개발자도 “완료”를 확인할 수 있도록, 각 세부 단계 라인에 아래 항목을 추가로 붙이는 것을 기본으로 합니다(짧게 쓰되, 눈으로 확인 가능해야 함):
    - **완료 조건(눈으로 확인):** 사람이 보고 “끝났다”라고 판단할 수 있는 관찰 가능한 기준
    - **사람 검증(비개발자):** 비개발자가 할 수 있는 가장 쉬운 확인(버튼 클릭, 파일 존재, 특정 문자열 표시 등)
    - **흔한 문제/주의:** 자주 깨지는 포인트 1–2개 + 어떻게 알아차리는지
  - 테이블의 ID와 **완전히 동일**하게 맞춥니다(누락/추가 금지).
  - 이 블록은 Step 아래에 **인라인으로 유지**합니다(별도 appendix로 빼서 문서가 드리프트하지 않게).
  - 예시:
    ```
    세부 단계 목적/설명 (1단계)
    - `1-1` 목적: status를 DB에 영속화. 설명: init 시 `update_status` 테이블을 생성/갱신.
      완료 조건: DB 쿼리로 테이블 존재(+컬럼) 확인이 된다.
      사람 검증: 제공된 쿼리를 실행해서 테이블 이름이 보이는지 확인한다.
      흔한 문제/주의: DB 경로가 다른 곳을 가리킴; 리팩터링 후 스키마 불일치.
    - `1-2` 목적: 쓰기 로직을 한 곳에 모음. 설명: 라우트에서 사용하는 repository 메서드를 구현.
      완료 조건: 라우트가 repository를 호출하고, 테스트/TS 빌드가 통과한다.
      사람 검증: 검증 명령을 실행해서 “에러 0개”인지 확인한다.
      흔한 문제/주의: 순환 import; 반환 shape이 호출부마다 달라짐.
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

- **세부 단계 테이블 상태 표기 — 엄격 기준 (필수):**
  아래 4개 이모지만 사용하며, 각 정의를 엄격히 적용합니다:
  - `✅` — **구현 + 사용자확인 완료.** 사용자가 해당 항목(세부 단계/대단계)의 완료를 명시적으로 확인한 경우에만 부여한다. 코드가 구현되었더라도 사용자 확인이 없으면 ✅를 붙이지 않는다.
  - `⏳` — **구현완료, 사용자확인 대기.** 코드는 작성/동작하지만 사용자가 아직 결과를 확인하지 않은 상태.
  - `⬜` — **미착수.** 구현이 시작되지 않은 항목.
  - `🚫` — **선행조건 미충족(차단).** 미결정 사항이나 외부 의존성이 해소되지 않아 시작할 수 없는 항목.

  **상태 이모지 적용 위치 (3곳 일관성 규칙):**
  이모지 상태는 아래 **3곳**에 모두 표시하며, 3곳의 상태가 항상 일치해야 합니다:
  1. **대단계(Step) 제목** — `#### ⏳ Step 1 — 이름` 형태로 제목 앞에 이모지 삽입
  2. **실행 의존성 그래프** — 각 세부 단계 줄 앞에 이모지 표시 (예: `✅ 1-1 테이블 생성`)
  3. **세부 단계 테이블** — 테이블에 `| 상태 |` (EN: `| Status |`) 컬럼을 추가하고 각 행에 이모지 기입

  3곳 중 하나라도 상태가 변경되면 나머지 2곳도 같은 턴 내에 동기화해야 합니다.

  **대단계 제목 이모지 규칙:**
  - 대단계의 이모지는 해당 Step에 속한 **모든** 세부 단계의 상태를 종합한 결과입니다:
    - 세부 단계가 **모두** ✅ **이고** 사용자가 해당 Step 전체를 확인 → `✅`
    - 세부 단계가 모두 구현되었으나 사용자 확인이 아직 → `⏳`
    - 하나 이상 미착수 → `⬜`
    - 선행조건 미충족으로 시작 불가 → `🚫`

- **plan.md 작성 규칙(plan.md 생성/수정 시 반드시 준수):**
  - **구조 순서:** 목표 → 접근법 개요 → Step 목록(각 Step에 세부 단계 테이블 + 검증 훅) → 실행 의존성 그래프 → 미결정 사항/차단 요소.
  - **언어 규칙 (copilot-instructions.md 기준으로 통합 정리):**
    - **모든 에이전트 공통:** KO 섹션이 primary source of truth. 읽을 때 KO를 먼저 참조.
    - **Claude(모든 버전):** `plan.md`를 **KO only**로 작성. EN 섹션은 만들지 않음.
      - 기존에 EN+KO로 작성된 `plan.md`를 수정할 때: **KO만 업데이트**, EN은 건드리지 않고 staleness 배너(`> ⚠️ EN section may be outdated …`)가 없으면 삽입.
    - **비-Claude 에이전트(GPT, Gemini 등):** EN+KO 병기. EN 섹션을 먼저, `---` 구분선, 그 다음 KO 섹션(동일 내용 번역). 다만 KO가 authoritative.
    - **왜 EN을 먼저 두나(EN+KO 문서일 때):** 권위(authority) 문제가 아니라 형식(레이아웃) 규칙입니다. EN-first는 diff/검색/스캔을 일관되게 만들기 위한 관례이고, AI 해석 기준은 여전히 KO가 우선입니다.
    - **작성 워크플로우(내용 순서):** **KO 내용을 먼저** 작성/수정하여 확정한 뒤, EN을 번역/동기화합니다. 파일 레이아웃은 EN → `---` → KO를 유지합니다.
  - **모든 Step 제목**에는 번호와 짧은 설명을 포함: `#### Step N — 짧은 이름`.
  - **세부 단계 테이블**은 모든 Step에 필수(위의 세부 단계 테이블 형식 참조).
  - **검증 훅 블록**은 모든 Step 마감 시 필수.
  - **실행 의존성 그래프**는 상세하게 작성(위의 그래프 요구사항 참조) — 단순 트리가 아닌 상세 그래프.
  - **이모지 상태 마커**를 세부 단계 테이블(상태 컬럼)과 의존성 그래프, 그리고 대단계 제목에 **3곳 모두** 일관되게 사용합니다. 엄격 기준(✅/⏳/⬜/🚫)은 위 "세부 단계 테이블 상태 표기" 참조.
  - **차단 추적:** 차단된 Step은 시각적으로 뚜렷하게 구분(그래프에서 박스 구간, `⚠️ BLOCKED` 라벨, 선행 조건 명시).
  - **사전 작성 코드 표기:** 정식 plan 실행 전에 코드가 작성된 경우, 해당 세부 단계에 명시적으로 기록(예: "사전 작성됨 (검증 필요)").
  - **미결정 사항 섹션:** 번호 ID, 선택지, 차단 대상 Step을 포함한 미결정 사항 목록 유지.
