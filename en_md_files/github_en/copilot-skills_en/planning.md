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
- Write/update `agent_log.md` **whenever the plan context is active and code changes occur** (i.e., when plan.md is being discussed/edited as the source of execution and you modify any code/docs as part of that plan).
- **`agent_log.md` language rule (must):** `agent_log.md` is written in **Korean only** (한국어 단독). Do NOT write bilingual EN/KO sections in the log — Korean is sufficient.
- **`agent_log.md` timestamp rule (must):** record not only the date but also the **time-of-day** for each new log entry.
  - Preferred: keep the date heading (e.g., `## 2026-03-05`) and include a line like `**Time:** 23:23 (local)` immediately under each entry/section you add.
  - Format: `YYYY-MM-DD HH:mm` (24-hour clock). Use the machine’s **local time** unless the user specifies a timezone.
  - Do not rewrite old history just to add times; apply this rule to new entries going forward.
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
When a plan has multiple major Steps (e.g., Step 0, Step 1, …, Step N), **each Step must be further decomposed into numbered sub-steps**.
