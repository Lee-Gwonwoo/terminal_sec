<!--
========================================================================
  HOW TO USE THIS FILE (AI AGENT — READ THIS FIRST)
  This file is loaded in full as system context on every conversation.
  Read the TABLE OF CONTENTS below, then read ONLY the relevant sections.
  Do NOT read the whole file.
========================================================================
-->

# ⚠️ AI AGENT OPERATING RULES (MUST READ BEFORE ANY TASK)

**Execution discipline (must):**
- Before starting work, use the TABLE OF CONTENTS to identify the most relevant section(s) for this task and prioritize following those instructions.
- Always state a detailed plan in chat before implementation.
- For each plan step:
  - Implement the step.
  - Verify it is correct (tests/build/run, file inspection, or other appropriate checks).
  - Report in chat:
    - What changed (files/scope).
    - How the user can verify (exact commands and/or what to look for).
    - Any issues/risks discovered + 1–3 concrete mitigation options.
  - If the step has a meaningful “done/not done” checkpoint, explicitly ask the user to confirm completion.
    - Only after the user explicitly confirms, record the step in `agent_log.md` as “completed (user-confirmed)”.
    - If the user has not confirmed yet, record it as “done (awaiting user confirmation)” and update later when confirmation arrives.

---

## TABLE OF CONTENTS
(Read only the section relevant to your current task)

| Tier | Section | Key topics |
|------|---------|------------|
| **T1** | [Plan & Agent Log](#plan--agent-log) | plan.md, agent_log.md, step decomposition |
| **T1** | [Plan sub-step methodology](#plan-sub-step-methodology) | sub-step tables, verification hooks, user-gate |
| **T1** | [Capability limits / honesty](#project-conventions-to-follow) | no fake features, fail fast |
| **T1** | [Mock data policy](#project-conventions-to-follow) | no mock unless requested |
| **T1** | [Safety / repo hygiene](#safety--repo-hygiene) | path ≤250, secrets, naming |
| **T1** | [Bilingual EN/KO sync](#docs-and-prompt-markdown-files) | *.md + copilot-instructions parity |
| **T2** | [Big picture](#big-picture) | repo overview, key domains |
| **T2** | [Folder structure & data flow](#folder-structure--data-flow-high-level) | EODHD→original_data→learning_data |
| **T2** | [How to run (Windows)](#how-to-run-windows) | venv activation, absolute paths |
| **T3-A** | [Retries / robustness](#project-conventions-to-follow) | 10 retries, backoff, permanent failures |
| **T3-A** | [Wrapper + base pattern](#project-conventions-to-follow) | momentum scripts, Config+run_analysis |
| **T3-A** | [Indicator calculators](#project-conventions-to-follow) | pandas append-only, logging pattern |
| **T3-A** | [Deep learning trainers](#project-conventions-to-follow) | dedup shared intermediates, presets |
| **T3-B** | [GUI scripts](#project-conventions-to-follow) | PyQt only, resizable, activity log |
| **T3-B** | [Web UI scripts](#project-conventions-to-follow) | bind policy, no CDN, debug visibility |
| **T3-C** | [Config template files (TOML)](#project-conventions-to-follow) | VALUES/EXPLANATIONS, valid TOML |
| **T3-C** | [Docs / prompt Markdown files](#project-conventions-to-follow) | bilingual EN+KO, parity, output cols |
| **T3-D** | [EODHD rules](#project-conventions-to-follow) | NY timezone, no Timestamp col, token |
| **T3-D** | [ThetaData / ThetaTerminal](#project-conventions-to-follow) | run_theta_terminal.ps1 |

> **T1** = Always apply every task &nbsp;·&nbsp; **T2** = Repo context (read when unfamiliar) &nbsp;·&nbsp; **T3-A** = Code patterns &nbsp;·&nbsp; **T3-B** = UI dev &nbsp;·&nbsp; **T3-C** = Config/Docs &nbsp;·&nbsp; **T3-D** = Data sources

## Plan & Agent Log
- Create `plan.md` **only when the user explicitly requests it**.
- Treat any direct request for a plan as “explicit” (examples: “plan을 세워라”, “계획 세워줘”, “플랜 만들어”, “plan 작성”, “plan.md 만들어”).
- When a user requests a plan, do BOTH:
  - Write the detailed step-by-step plan in chat (required by Execution discipline)
  - Create `C:\github_coding\terminal_sec\ai_agent_plan\<project_name>\plan.md` (unless the user explicitly forbids file changes)
- If the user says “don’t execute/run” (e.g., “실행하지 말고”) and it’s ambiguous whether file writes are allowed, use the hook question flow (`ask_questions`) to confirm before creating/modifying files.
  - Default interpretation (unless the user says otherwise): “don’t execute/run” = no code execution (no tests/dev server/scripts), but creating/updating `plan.md` is allowed.
- Write/update `agent_log.md` **only when the user explicitly tells you to execute a specific plan**.
- File storage: `C:\github_coding\terminal_sec\ai_agent_plan\<project_name>\`
  - `plan.md`: detailed step-by-step plan before starting (goal, approach, files to create/modify, order, risks).
  - `agent_log.md`: chronological record of every action taken (files created/modified, commands run, decisions, errors).
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
  - Steps themselves may be parallelizable — document this with an **Execution dependency graph** (a simple ASCII/Markdown diagram showing which Steps depend on which).
  - Example:
    ```
    Step 0 (audit)
      └─► Step 1 (foundations)
            ├─► Step 2 → Step 3  (track A: can run in parallel with track B)
            └─► Step 4 → Step 5  (track B)
    ```

- **Blocked Steps:** if a Step depends on an unresolved decision or external blocker, mark it with `⚠️ BLOCKED` and state the prerequisite. Do not start blocked Steps.

- **Status tracking in sub-step tables:** use these status markers:
  - `✅ Done` — completed and verified
  - `⏳ Awaiting user` — done but waiting for user confirmation
  - `🚫 BLOCKED` — cannot start due to unresolved dependency
  - (empty) — not started
---

# Copilot instructions (python workspace)

<!-- ====================================================
  TIER 1 — Always apply to every task
  (Capability limits, Mock data, Safety, Bilingual sync)
  These are pulled into the Project conventions section below.
  See TABLE OF CONTENTS above for direct links.
===================================================== -->

<!-- T1: Safety / repo hygiene -->
## Safety / repo hygiene
- **Path length hygiene (Windows / tooling compatibility)**
  - When creating new folders/files (especially generated outputs under deep subfolders), keep the **full absolute path length ≤ 250 characters**.
  - Prefer shorter folder/file names over deeper nesting.
  - Avoid repeating tokens (e.g., `csv/csv`, `parquet/parquet`) unless the surrounding codebase already requires it for backward compatibility.
  - If a requested naming scheme risks exceeding the limit, shorten only the *non-semantic* parts (extra prefixes/suffixes), and keep the key identifiers (symbol, timeframe, expiry, year) intact.
- Treat these as secrets and never print them to logs/output or commit derived values:
  - `EODHD/API TOKEN`, `thetadata/credit.txt`, `thetadata/creds.txt`.
- This repo contains many generated artifacts (`*.xlsx`, `*_raw.csv`, `*_raw.parquet`). When adding new scripts, follow the existing naming convention: `<script_name>.xlsx` + `<script_name>_raw.csv/parquet`, typically under the same folder as the script.

<!-- ====================================================
  TIER 2 — Repo context
===================================================== -->

## Big picture
- This repo is a collection of *script-first* research pipelines (not a packaged library). Most work is done by running individual `*.py` files that read local CSV/Parquet inputs and write Excel/CSV/Parquet outputs.
- Key domains:
  - `momentum/`: option-selling / momentum / reversal analysis scripts. “Base” modules contain the core logic; thin wrappers set file paths + config.
  - `deep_learning_data/indicator_calculator/`: feature/indicator calculators used to generate learning datasets (stock + options).
  - `EODHD/`: data download rules and token handling for the EODHD API.
  - `thetadata/`: ThetaTerminal launcher + credentials files (Java).

## Folder structure & data flow (high level)
- `EODHD/` contains download/normalization scripts (and strict rules in `EODHD/INSTRUCTION.txt`). These scripts typically write their *final* datasets under `original_data/` so downstream pipelines can consume them.
  - Example (QQQ 1min regular session): `EODHD/EODHD_qqq/downloader_and_aggregator_qqq_1min_regular_2013_2025.py` writes to `original_data/original_data_stock/original_data_stock_qqq/`.
- `original_data/` is the “raw canonical dataset” area (CSV/Parquet) that many scripts treat as input (momentum, deep learning feature pipelines, aggregation tests, etc.).
- `deep_learning_data/indicator_calculator/` transforms `original_data/` (or other parquet/csv inputs) into learning datasets under `deep_learning_data/learning_data_*` folders.

## How to run (Windows)
- Use the local venv (repo already has `.venv/`). Typical workflow:
  - Activate: `\.venv\Scripts\Activate.ps1`
  - Run scripts directly: `python momentum\tree_10_1_optionsell_momentum_atm.py`
- Many scripts hard-code absolute paths under `c:\\github_coding\\python\\...` (see `momentum/tree_10_1_optionsell_momentum_atm.py`). Preserve this convention when editing existing scripts unless you’re explicitly asked to make paths portable.

<!-- ====================================================
  TIER 3 — Task-specific conventions
  T3-A: Code patterns (Retries, Wrapper+base, Indicators, DL trainers)
  T3-B: UI dev (GUI, Web UI)
  T3-C: Config & Docs (TOML, Markdown)
  T3-D: Data sources (EODHD, ThetaData)
  T1 items embedded below: Capability limits (must), Mock data (must)
===================================================== -->

## Project conventions to follow

<!-- T1: Capability limits / honesty -->
- **Capability limits / honesty (must)**
  - If a user request cannot be completed with the available information, credentials, or tools (e.g., missing API key/endpoint, unknown provider spec), say so **explicitly and early**.
  - Do **not** “paper over” missing functionality with misleading UI-only changes (e.g., hiding source columns) or placeholder code that implies the feature works.
  - Provide the shortest unblock checklist (exact inputs needed, where to put secrets, and a minimal verification step).
  - If requirements are ambiguous or a user choice is needed (behavior/UX/data), use the hook question flow (e.g., `ask_questions`) to propose 2–6 options, mark a sensible default as recommended, and continue after the user confirms.
  - If you are stuck (e.g., the same approach fails 2–3 times without new information), do **not** force-repeat the same steps. Summarize what you tried and use **Bing web search** (Copilot web search / “Copilot access to Bing”, if available) to find likely causes and a practical workaround, then proceed with the most credible fix.

<!-- T1: Mock data policy -->
- **Mock data policy (must)**
  - Do **not** add or reintroduce mock/synthetic data generators (timers, fake providers, seeded “demo news”, etc.) unless the user explicitly requests mock data.
  - If mock generation exists in the repo/codepaths, remove it end-to-end (source code + docs that describe it + build artifacts such as stale `dist/` that can preserve deleted code).
  - If mock rows already exist in a local DB/output (e.g., SQLite tables), proactively provide a cleanup step (delete rows by source/tag, or delete/recreate the DB) and verify the cleanup by querying counts.
  - Keep terminology explicit: “remove generation” (future data) vs “clean existing stored mock rows” (historical data).

<!-- T3-A: Code patterns -->
- **Retries / robustness (default policy)**
  - When implementing operations that can fail transiently (network calls, file writes/renames on Windows, copy/move, reading remote resources), assume **up to 10 retries by default**.
  - Prefer short waits with backoff (e.g., 0.1–0.5s initial delay, increasing) and log retry attempts clearly.
  - Do **not** blindly retry permanent failures (invalid paths/config, authentication/token errors, deterministic parsing/validation errors, disk full). Fail fast with a clear error message.
  - If a retry loop would significantly delay a long batch job, make retry counts/delays configurable (constants or CLI/GUI knobs).

- **Wrapper + base pattern (momentum)**
  - Base modules expose `Config` + `run_analysis` (see `momentum/tree_10_optionsell_base.py`, `momentum/tree_11_optionsell_reversal_base.py`).
  - Wrappers import the base and only define constants + `main()` (see `momentum/tree_10_1_optionsell_momentum_atm.py`).
  - Outputs:
    - Always write a “raw” CSV and try to write Parquet, but gracefully skip Parquet if `pyarrow/fastparquet` isn’t installed (see `save_raw()` in `momentum/tree_10_optionsell_base.py`).
    - Excel writes use a temp file then `os.replace` to avoid corrupt partial outputs (`save_excel()` pattern).
  - Progress + status:
    - Long-running steps should print progress to console (existing pattern: `print(f"[{config.name}] ...")`).
    - On successful completion, print a clear success line that includes the primary output path(s) (existing pattern: `print(f"[{config.name}] Saved {config.output_excel}")`).

- **Indicator calculators (deep_learning_data)**
  - Functions operate on pandas DataFrames and append columns without dropping rows; early rows become `NaN` when history is insufficient (see `compute_indicators()` in `deep_learning_data/indicator_calculator/stock2_indicator_calculator.py`).
  - Logging pattern: file-based logger and a `logger.handlers` guard to avoid duplicate handlers.
    - If a script creates output files under an output directory, default the log file to that same directory (e.g., `out_dir / f"{Path(__file__).stem}.log"`).
    - If there is no output directory context, fall back to a module-adjacent log (`Path(__file__).with_suffix('.log')`).
    - When `log_errors=True`, any exception must be recorded with `logger.exception(...)` and then re-raised (so failures are visible both in console and in the log).
    - On success, write a final log line like `SUCCESS: wrote <paths>` (include output directory and key filenames).
  - Progress visibility:
    - For large inputs / loops, expose a `progress_every`-style knob (or similar) and emit periodic progress messages (to console and/or logger) rather than running silently.
  - Some scripts provide a CLI and write outputs relative to repo root using `Path(__file__).resolve().parents[2]` (see `_default_output_dir()` in `deep_learning_data/indicator_calculator/option1_1min_time_to_expiration_cumulative_volume_pc_ratio.py`).
  - CLI example (option features by year):
    - `python deep_learning_data\indicator_calculator\option1_1min_time_to_expiration_cumulative_volume_pc_ratio.py --input <file-or-dir> --symbol QQQ --overwrite`

- **Deep learning trainers (dedup + presets + docs parity)**
  - **Deduplicate shared intermediates (must):** for multi-head / multi-case trainers, compute expensive shared intermediates once and reuse them across heads.
    - Examples: stock `close/high/low` arrays + per-horizon `r_end/r_max/r_min`; options `options_groups` snapshot index; (i, horizon, delta, right) contract pick + horizon-end price match + profit%.
    - Keep semantic loops (e.g., `label_targets` hit logic) explicit, but do not repeat expensive grouping/picking/matching inside them.
  - **Definition: “duplicate computation / wasted computation” (important):** only call something duplication/waste when the **inputs + config/options/flags (including random seeds)** are the same, the **results are identical**, and the **work is repeated**. If changing the computation changes results, it is a behavior change (not “waste”) and must be treated separately.
  - **Case preset / multi-case design:** when supporting `active_cases`-style multi-select presets:
    - Merge `enable_*` flags with a clear rule (typically OR).
    - Put conflict-prone shared params (`label_horizons`, `label_deltas`, `label_targets`) in root VALUES, not inside per-case tables.
    - If stock+option labels can be enabled together, explicitly support a mixed mode (e.g., `Model_SO`) or fail fast with a clear error.
    - Document backward compatibility (e.g., if `active_cases` is missing/empty, fall back to legacy `active_case`).
  - **Docs parity (EN/KO):** if a trainer has bilingual `*.md`, keep the same headings in the same order, and clearly separate “deduplicated vs repeated” computations.
  - **Refactor cleanup (legacy isolation):** if refactors make old code paths unused, delete them or isolate under a clear `LEGACY/UNUSED` section with a short rationale.

- **GUI scripts (when the user requests a GUI)**
  - Use **PyQt only** (do not use Tkinter, Streamlit, NiceGUI, etc.). Prefer PyQt6 unless the repo/script already uses PyQt5.
  - Always allow text copy in GUI text areas, tables, and status labels.
  - GUI windows must be resizable, and layouts should auto-adjust child widgets (no fixed sizes that clip content).
  - Do not use fixed-size constraints like `setFixedSize(...)` / `MSWindowsFixedSizeDialogHint` unless the user explicitly requests a fixed-size window.
  - For long folder names / paths displayed in labels, enable wrapping so the window can shrink:
    - Use `QLabel.setWordWrap(True)` and (if needed) a shrink-friendly size policy like `QSizePolicy.Ignored`.
  - Always create a GUI activity log when a GUI is requested.
    - Default location: same folder as the script file.
    - If the script’s output files are written to another folder, create the GUI log in that output folder after running (so logs live next to outputs).
    - Recommended filename: `<script_stem>_gui.log`.
  - The GUI log should record user actions (button clicks, file selections, start/end of processing, progress milestones) and always record exceptions via `logger.exception(...)`.
  - **When asked to create a `*gui_vm*.py` file**
    - The GUI must run locally, but the actual computation/code + data access must run on the VM via SSH.
    - Results must always be written on the VM.
    - **SSH execution robustness (important)**
      - Do not rely on `cd <remote_root> && python <relative_script>`; in some VM/login-shell setups the working directory can behave unexpectedly and relative paths may resolve under `$HOME`.
      - Prefer executing the remote script via an **absolute path** derived from `remote_root`, e.g. `python3 "$remote_root/path/to/script.py" ...`.
      - On Windows/PowerShell, be careful with `$` expansion when constructing SSH commands. Prefer single-quoted remote command strings or escape `$` so expansion happens on the VM, not locally.
      - Prefer the VM repo virtualenv interpreter when available (e.g. `/mnt/python/.venv/bin/python`) to avoid `ModuleNotFoundError` due to missing packages in system `python3`.
      - Treat “remote script file not found” / bad `remote_root` as **non-retryable** configuration errors; fail fast with a clear message.
    - **Stop / Retry correctness (important)**
      - If the GUI supports retries, make `Stop` a **hard cancel**:
        - Set a `stop_requested` flag.
        - Stop any retry timers immediately.
        - Clear any pending work queues (e.g., multi-format runs).
        - On process `finished` callbacks, check `stop_requested` first and **do not** schedule retries or start the next queued run.
      - Avoid race conditions where a killed process triggers `finished` → “failure” → retry scheduling.
    - Syncing artifacts back to the local machine is **optional** and should be user-controllable in the GUI (checkbox/toggle).
      - Default: **do not** sync outputs back to local unless the user opts in.
      - If sync is disabled, the GUI must clearly indicate that outputs exist only on the VM and include the VM output path(s) in the final status/log.
    - **Sync default:** prefer `rsync` for VM → local (incremental, restartable). On Windows, prefer `wsl rsync` (WSL path style like `/mnt/c/...`). If `rsync` is unavailable, fall back to `scp`.
    - Assume local/VM folder structures are identical; if they are not, the GUI must detect the mismatch and stop with an error.

- **Web UI scripts (when the user requests a Web UI)**
  - **Typical topology (important):** the server may run on a VM, while the user opens the UI from a different computer.
    - Do not assume `http://127.0.0.1:8000/` is reachable from another machine.
  - **Bind host/port policy (remote access correctness + safety):**
    - Default bind should be loopback only (`127.0.0.1`) to avoid accidentally exposing the UI to the Internet.
    - Make bind host/port configurable via env vars (example: `WEBUI_HOST`, `WEBUI_PORT`) so users can explicitly opt into remote access (`0.0.0.0`).
    - Document both access modes:
      - **Recommended:** SSH port-forwarding (`ssh -L 8000:127.0.0.1:8000 <vm_host>`) + open `http://127.0.0.1:8000` locally.
      - **Direct exposure:** bind to `0.0.0.0` and require firewall/security-group rules that restrict inbound to the user’s IP.
  - **No external assets by default:** avoid React/CDN/Babel or any network-fetched JS/CSS for the core UI. The UI should render in restricted/offline environments.
  - **Cache behavior:** the root HTML (`GET /`) should be `no-store` to prevent “stuck on old UI” after edits.
  - **Browser/WebView compatibility (don’t assume modern JS):**
    - Avoid JS footguns that can hard-fail parsing in older embedded WebViews:
      - No trailing commas in function call argument lists.
      - Avoid `??` (nullish coalescing) and `?.` (optional chaining).
    - If you use modern JS features (arrow functions, async/await, rest/spread), add a visible startup crash panel and a clear message telling users to open in a modern browser.
  - **Debug visibility (must-have):**
    - Show a startup placeholder + “preflight OK” marker so it’s obvious whether JS is running.
    - Catch `window.onerror` / `unhandledrejection` and render the error message in-page (not only in console).
    - Provide a lightweight `GET /api/config` or `GET /healthz` endpoint to confirm the backend is alive.
  - **Noise reduction:** optionally serve `/favicon.ico` (204 or small icon) to avoid repeated 404 console spam.
  - **Security:** never log secrets; if exposing the server externally, warn users to restrict inbound rules. Prefer SSH tunneling.

- **Config template files (TOML/INI/YAML) (important)**
  - When creating or updating a *config template file* for running a script from the terminal, split it into two clearly labeled sections:
    - `VALUES`: key/value settings only (equivalent to CLI options/flags).
    - `EXPLANATIONS`: all human-readable documentation (no duplicate settings).
  - **Put required items first (must):** at the very top of `EXPLANATIONS` (inside each language block), add a short “REQUIRED checklist” that includes:
    - required CLI options/flags to run (e.g., `--config <path>`),
    - which `VALUES` keys must be filled (and whether they are REQUIRED vs CONDITIONALLY REQUIRED),
    - one minimal runnable CLI example.
  - **Empty-string placeholders policy:** if the template contains empty strings like `foo = ""`, `EXPLANATIONS` must explicitly say:
    - whether the user must fill it,
    - when it is required (e.g., “only when option labels enabled”),
    - at least one concrete example value.
  - **Companion config docs (when behavior is non-trivial):** if a config has merge rules, precedence rules, or complex I/O semantics, keep a companion Markdown next to it:
    - Prefer same-basename: `something_config.toml` ↔ `something_config.md`
    - TOML `EXPLANATIONS`: concise (quick-start + required checklist)
    - MD: more detailed and implementation-accurate, and kept in sync when config behavior changes.
  - **TOML validity guardrail (must):** config templates must remain valid TOML.
    - In `.toml` files, every line in `EXPLANATIONS` must be a comment line starting with `#` (or be removed/moved to a separate `.md`).
    - After writing/editing a `.toml` config template, run a quick parse sanity-check (preferred):
      - `python -c "import tomllib, pathlib; tomllib.loads(pathlib.Path('path/to/config.toml').read_text(encoding='utf-8'))"`
      - If Python < 3.11, use `tomli`.
  - The `EXPLANATIONS` section must be bilingual:
    - English first, then a separator line `---`, then Korean.
    - Keep the two language blocks strictly separated and content-matched (same headings, same options, same defaults).
  - Terminology: prefer “CLI options/flags (command-line options)” rather than “arguments” unless you specifically mean positional arguments.

- **Docs and “prompt” Markdown files (important)**
  - This repo uses `*.md` files as *prompt/spec/explanation companions* for some scripts (example: `deep_learning_data/indicator_calculator/stock2_indicator_calculator.md`).  - **Scope of the bilingual rule (must):** this EN/KO writing convention applies to **both** of the following:
    1. Any `*.md` companion/spec/explanation doc in this repo.
    2. `copilot-instructions.md` itself — whenever a section is added or edited, the corresponding section in the other language must be updated identically in the same change.  - **Bilingual rule (English + Korean):** when creating or updating any `*.md` companion/spec/explanation doc in this repo, include **both** English and Korean.
    - Write **English first**, then a clear separator (e.g., `---`), then **Korean**.
    - Keep the two sections strictly separated (do not mix languages within the same bullet/paragraph).
    - **Parity rule (must match):** the English and Korean sections must contain the **same information** and be kept in sync.
      - Same headings in the same order.
      - Same numbered steps, option lists, default values, file paths, and example commands.
      - Same tables/columns (only the language changes).
    - **Detail rule (do not be brief):** docs should fully explain the behavior.
      - Describe the full computation/aggregation process step-by-step (inputs → normalization → core calculation → outputs).
      - Explain the code’s logic structure clearly (major modules/functions, stage order, and data flow).
      - Explicitly define time bucket semantics (e.g., label/closed, which 1-minute rows belong to which higher-interval candle).
      - Include edge cases/assumptions when they matter (timezone handling, missing minutes, session filtering assumptions).
      - **Execution & I/O locality rule (avoid environment ambiguity):** if the workflow spans multiple environments (e.g., local vs VM over SSH, WSL, Docker, multiple Python envs), the doc must explicitly state:
        - **Where each action runs** (e.g., “preview/load/view” vs “actual run/train”).
        - **Where data is read from** and **where outputs are written** (local disk vs remote disk).
        - **How paths are resolved/mapped** (absolute vs repo-relative, Windows vs POSIX) and what the “root” is (e.g., `remote_root`).
        - **Whether artifacts are synced** between environments, the default behavior, and how to enable/disable sync.
        - At least 1 concrete example when path mapping exists (a real-looking path input and how it resolves in the other environment).
        - Common failure modes specific to mismatched environments (e.g., “works locally but fails remotely”) and the fastest manual check.
      - **Anti-vagueness rule (make definitions executable):** avoid abstract placeholders like “$[t, \text{next})$” without pinning down what `t`/`next` mean.
        - For every core rule/transform, provide an **operational definition**: what the input is, the exact grouping/mapping rule, and what the output represents.
        - If you use symbols/variables (e.g., `t`, `t_next`, “bucket”, “label”), define them in the same section (or in Glossary) with concrete units.
        - For each core rule, include **at least 2 concrete examples** with real dates/times/numbers; each example must include both an **included** boundary-case and an **excluded** boundary-case.
        - For boundary-based logic (time buckets, windows, filters), explicitly state:
          - boundary timestamps (e.g., Friday 00:00 vs session open 09:30),
          - inclusion/exclusion (inclusive/exclusive),
          - timezone handling (tz-aware → tz-naive, and which local timezone is assumed),
          - what happens with missing data (holidays, missing minutes) and empty buckets (row kept vs dropped).
        - Add 1–2 “reader checks” so a user can manually verify the rule (e.g., “this timestamp must map to that bucket label”).
      - If Copilot creates any helper code files to complete a request (even if the user did not explicitly ask to create new files), prefix the filename with `test_`.
    - **Glossary rule:** if the doc uses uncommon or overloaded terms (e.g., bucket/label/closed/origin/offset/turnover), add a dedicated **Glossary** section and define them there.
      - Keep definitions grouped together in one section (don’t scatter term definitions across the doc).
  - **Name matching rule:** if a script has a companion prompt/spec, it must be the exact same base name:
    - `path/to/foo.py` ↔ `path/to/foo.md`
  - **Creation rule:** create these `*.md` companion prompt files **only when the user explicitly requests “create prompt files”** (do not create extra docs by default).
  - **Sync rule when editing code:** if you modify a `*.py` file that already has a same-name `*.md`, update the `*.md` so it explains the current behavior **100%** (no stale sections).
  - **Mandatory workflow guardrail (prevents missing `.md` updates):**
    - After **any** edit to a `*.py` file, immediately check whether a same-basename `*.md` exists in the same folder.
    - If it exists: update it in the same set of changes **before** declaring the task done.
    - If it does not exist: explicitly state that it was checked and not found (and do not create a new `.md` unless the user asked).

  - **Bilingual boundary guardrail (NO interleaving) (must):**
    - Many docs use a hard boundary: `## EN` … `---` … `## KO`.
    - Before editing, **first locate the boundary** (`---`) and confirm which region you are in.
    - Only write English content under the English region and only write Korean content under the Korean region.
    - Never insert Korean headings/paragraphs inside the English region (above `---`), and never insert English headings/paragraphs inside the Korean region (below `---`).
    - When adding a new section, choose the insertion point by matching headings inside the correct language region (do not insert “nearby” just because it looks close in a partial view).
    - After editing, run a quick sanity check to ensure no interleaving:
      - English region contains no Korean headings (e.g., `### ...사용...`, `목적`, etc.)
      - Korean region contains no English headings (e.g., `### Purpose`, `### Inputs`, etc.)
  - **Output columns rule:** when writing/updating these `*.md` files, always include a clearly labeled list of outputs:
    - For file outputs: filename pattern(s), format(s) (CSV/Parquet/Excel), and the exact column names.
    - For DataFrame-returning functions: the exact appended column names and any “keeps rows / NaN for warmup” rules.
    - **Column formatting rule (raw-editor friendly):** in these output lists, format column names as `[][][]column_name[][][]` so they stand out in the raw `.md` editor.
      - Preferred format is a small table: `Column | Meaning | Notes` with the column cell written as `[][][]...[][][]`.

- **EODHD rules are strict**
  - Follow `EODHD/INSTRUCTION.txt`:
    - All saved timestamps must be `America/New_York` local time.
    - Do **not** include `Timestamp` in saved outputs (drop it before saving).
    - Read the API token from `EODHD/API TOKEN`.
    - Put symbol-specific code + outputs under `EODHD/<symbol>/`.

- **ThetaData / ThetaTerminal**
  - Start the Java ThetaTerminal via `thetadata/run_theta_terminal.ps1` and keep `thetadata/credit.txt` next to the script.

---

<!--
========================================================================
  이 파일 사용 방법 (AI 에이전트)
  이 파일은 매 대화마다 시스템 컨텍스트로 전체 로드됩니다.
  아래는 한국어 참고용 섹션입니다 (사람이 읽는 용도).
========================================================================
-->

# ⚠️ AI 에이전트 운영 규칙

**작업 수행 규율(필수):**
- 작업 시작 전에 목차를 보고 이번 작업과 가장 연관된 섹션(들)을 먼저 확인하고, 해당 지침사항을 우선적으로 따른다.
- 구현에 들어가기 전에 항상 “세부화된 계획”을 채팅에 먼저 명시한다.
- 계획의 각 단계마다 다음을 반드시 수행한다:
  - 해당 단계를 구현한다.
  - 제대로 동작하는지 검증한다(테스트/빌드/실행, 파일 확인, 필요한 기타 검사 등).
  - 채팅에 다음을 명확히 보고한다:
    - 무엇이 바뀌었는지(변경 파일/영역).
    - 사용자가 직접 확인할 수 있는 검증 방법(정확한 명령어, 또는 무엇을 봐야 하는지).
    - 발견된 문제점/리스크 + 완화 방안 1–3개(구체적 선택지).
  - 해당 단계에 명확한 “완료/미완료” 체크포인트가 있으면, 사용자에게 완료 확인을 명시적으로 요청한다.
    - 사용자가 명시적으로 확인했다고 말한 뒤에만 `agent_log.md`에 “사용자 확인 후 완료(user-confirmed)”로 기록한다.
    - 사용자 확인이 아직 없으면, 로그에는 “확인 대기(awaiting user confirmation)”로 기록하고 확인이 오면 업데이트한다.

## 목차
(현재 작업과 관련된 섹션만 읽을 것)

| Tier | 섹션 | 주요 내용 |
|------|------|----------|
| **T1** | [플랜 & 에이전트 로그](#플랜--에이전트-로그) | plan.md, agent_log.md, 단계 분해 |
| **T1** | [플랜 세부 단계 작성법](#플랜-세부-단계-작성법) | 세부단계 테이블, 검증 훅, 사용자 게이트 |
| **T1** | [역량 한계 / 정직성](#프로젝트-컨벤션) | API 키 없을 때, 땜질 금지 |
| **T1** | [Mock 데이터 정책](#프로젝트-컨벤션) | mock 데이터 요청 없으면 사용 금지 |
| **T1** | [보안 / 레포 위생](#보안--레포-위생) | 경로 250자 이하, 시크릿, 네이밍 |
| **T1** | [한/영 동기화](#docs--prompt-markdown-규칙) | *.md + copilot-instructions 정합 |
| **T2** | [큰 그림](#큰-그림) | 레포 개요, 주요 영역 |
| **T2** | [폴더 구조 & 데이터 흐름](#폴더-구조--데이터-흐름요약) | EODHD→original_data→learning_data 흐름 |
| **T2** | [실행 방법 (Windows)](#실행-방법-windows) | venv 활성화, 절대경로 |
| **T3-A** | [재시도 / 견고성](#프로젝트-컨벤션) | 10회 재시도, 백오프, 영구 실패 처리 |
| **T3-A** | [Wrapper + base 패턴](#프로젝트-컨벤션) | momentum 스크립트 구조 |
| **T3-A** | [Indicator calculators](#프로젝트-컨벤션) | pandas, 로깅 패턴 |
| **T3-A** | [딥러닝 트레이너](#프로젝트-컨벤션) | dedup, 프리셋, 문서 정합 |
| **T3-B** | [GUI 스크립트](#프로젝트-컨벤션) | PyQt, 크기조정, 로그 |
| **T3-B** | [Web UI 스크립트](#프로젝트-컨벤션) | 바인딩, CDN 금지 |
| **T3-C** | [설정 템플릿 파일 (TOML)](#프로젝트-컨벤션) | VALUES/EXPLANATIONS, 한/영, TOML 유효성 |
| **T3-C** | [Docs / prompt Markdown 규칙](#프로젝트-컨벤션) | 한/영 병기, 정합, 출력 컬럼 |
| **T3-D** | [EODHD 규칙](#프로젝트-컨벤션) | NY 시간대, Timestamp 컬럼 금지 |
| **T3-D** | [ThetaData / ThetaTerminal](#프로젝트-컨벤션) | run_theta_terminal.ps1 |

> **T1** = 모든 작업에 항상 적용 &nbsp;·&nbsp; **T2** = 레포 컨텍스트 (처음이면 읽기) &nbsp;·&nbsp; **T3-A** = 코드 패턴 &nbsp;·&nbsp; **T3-B** = UI 개발 &nbsp;·&nbsp; **T3-C** = 설정/문서 &nbsp;·&nbsp; **T3-D** = 데이터 소스

## 플랜 & 에이전트 로그
- `plan.md`는 **사용자가 명시적으로 요청할 때만** 생성.
- “plan/계획을 세워달라”는 직접 요청은 모두 “명시적 요청”으로 취급한다(예: “plan을 세워라”, “계획 세워줘”, “플랜 만들어”, “plan 작성”, “plan.md 만들어”).
- 사용자가 plan을 요청하면 아래 둘 다 수행한다:
  - 채팅에 상세 단계별 계획을 작성(작업 수행 규율의 요구사항)
  - `C:\github_coding\terminal_sec\ai_agent_plan\<project_name>\plan.md` 파일을 생성(단, 사용자가 ‘파일 변경 금지’를 명시한 경우 제외)
- 사용자가 “실행하지 말고”(예: “실행하지 말고”)라고 말했을 때, 파일 작성까지 금지인지 애매하면 파일을 만들기/수정하기 전에 hook 질문 플로우(`ask_questions`)로 확인한다.
  - 기본 해석(사용자가 별도 명시하지 않는 한): “실행하지 말고” = 코드 실행 금지(테스트/서버/스크립트 실행 금지)이며, `plan.md` 작성/갱신은 허용.
- `agent_log.md`는 **사용자가 특정 plan을 수행하라고 지시할 때만** 작성/업데이트.
- 저장 위치: `C:\github_coding\terminal_sec\ai_agent_plan\<project_name>\`
  - `plan.md`: 작업 시작 전 상세 단계별 계획 (목표, 접근법, 생성/수정 파일, 순서, 위험 요소).
  - `agent_log.md`: 수행한 모든 작업을 시간순으로 기록 (생성/수정 파일, 실행 명령어, 결정, 오류).
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
  - Step 자체는 병렬 실행 가능할 수 있으며, 이를 **실행 의존성 그래프**(간단한 ASCII/Markdown 다이어그램)로 문서화합니다.
  - 예시:
    ```
    Step 0 (감사)
      └─► Step 1 (기반)
            ├─► Step 2 → Step 3  (트랙 A: 트랙 B와 병렬 가능)
            └─► Step 4 → Step 5  (트랙 B)
    ```

- **차단된 Step:** 미결정 사항이나 외부 차단 요소에 의존하는 Step은 `⚠️ BLOCKED`로 표시하고 선행 조건을 명시합니다. 차단된 Step은 시작하지 않습니다.

- **세부 단계 테이블 상태 표기:** 아래 마커를 사용합니다:
  - `✅ Done` — 완료 및 검증됨
  - `⏳ Awaiting user` — 완료했으나 사용자 확인 대기 중
  - `🚫 BLOCKED` — 미해결 의존성으로 시작 불가
  - (비어있음) — 미시작
# Copilot 지침 (python 워크스페이스, 한국어)

<!-- ====================================================
  TIER 1 — 모든 작업에 항상 적용
  (역량 한계, Mock 데이터, 보안/위생, 한/영 동기화)
  아래 프로젝트 컨벤션 섹션에 포함되어 있음.
  목차의 직접 링크 참조.
===================================================== -->

<!-- T1: 보안 / 레포 위생 -->
## 보안 / 레포 위생
- **경로 길이 위생(Windows / 툴 호환성)**
  - 새 폴더/파일을 만들 때(특히 깊은 하위 폴더에 생성 산출물을 쓸 때) **전체 절대 경로 길이를 250자 이하**로 유지하세요.
  - 폴더를 깊게 중첩하기보다 폴더/파일 이름을 짧게 하는 쪽을 우선합니다.
  - 코드베이스의 하위 호환 때문에 필요한 경우가 아니라면 `csv/csv`, `parquet/parquet`처럼 토큰을 반복하는 구조는 피하세요.
  - 사용자가 요구한 네이밍 규칙이 제한을 넘길 위험이 있으면, 의미가 덜 중요한 접두/접미(불필요한 prefix/suffix)만 줄이고 핵심 식별자(symbol, timeframe, expiry, year)는 유지하세요.
- 아래 파일들은 "시크릿"으로 취급하고, 로그/출력/커밋에 절대 노출하지 않습니다:
  - `EODHD/API TOKEN`, `thetadata/credit.txt`, `thetadata/creds.txt`
- 레포에는 생성 산출물(`*.xlsx`, `*_raw.csv`, `*_raw.parquet`)이 많습니다. 새 스크립트 추가 시 기존 네이밍 규칙(`<script_name>.xlsx` + `<script_name>_raw.csv/parquet`)을 따릅니다.

<!-- ====================================================
  TIER 2 — 레포 컨텍스트
===================================================== -->

## 큰 그림
- 이 레포는 “패키지 라이브러리”가 아니라 *스크립트 중심(script-first)* 연구/분석 파이프라인 모음입니다. 보통 개별 `*.py`를 직접 실행해서 로컬 CSV/Parquet 입력을 읽고 Excel/CSV/Parquet 출력물을 씁니다.
- 주요 영역:
  - `momentum/`: 옵션 셀링 / 모멘텀 / 리버설 분석 스크립트. Base 모듈에 핵심 로직이 있고, 얇은 wrapper가 경로/설정을 지정합니다.
  - `deep_learning_data/indicator_calculator/`: 학습 데이터(주식+옵션)용 피처/지표 계산기.
  - `EODHD/`: EODHD API 다운로드 규칙 + 토큰 취급.
  - `thetadata/`: ThetaTerminal(Java) 실행/자격 증명 관련.

## 폴더 구조 & 데이터 흐름(요약)
- `EODHD/`에는 다운로드/정규화 스크립트가 있고(규칙은 `EODHD/INSTRUCTION.txt`), 여기서 만든 데이터를 보통 `original_data/` 아래 “원본 데이터 형태”로 저장해 두고 다른 파이프라인이 입력으로 사용합니다.
  - 예시(QQQ 1분봉 정규장): `EODHD/EODHD_qqq/downloader_and_aggregator_qqq_1min_regular_2013_2025.py` → `original_data/original_data_stock/original_data_stock_qqq/`로 CSV/Parquet 생성.
- `original_data/`는 사실상 “정식 원본(raw canonical) 데이터” 저장소 역할을 하며, momentum/딥러닝/집계 테스트 등에서 입력으로 많이 참조합니다.
- `deep_learning_data/indicator_calculator/`는 `original_data/`(또는 다른 parquet/csv 입력)를 받아 피처를 붙여 `deep_learning_data/learning_data_*` 계열 폴더로 학습 데이터를 생성합니다.

## 실행 방법 (Windows)
- 로컬 venv를 사용합니다(레포에 `.venv/` 존재).
  - 활성화: `\.venv\Scripts\Activate.ps1`
  - 예시 실행: `python momentum\tree_10_1_optionsell_momentum_atm.py`
- 많은 스크립트가 `c:\\github_coding\\python\\...` 절대경로를 하드코딩합니다(예: `momentum/tree_10_1_optionsell_momentum_atm.py`). “경로를 포터블하게 바꿔달라”는 요청이 없는 한, 기존 관례를 유지하세요.
<!-- ====================================================
  TIER 3 — 작업별 컨벤션
  T3-A: 코드 패턴 (재시도, Wrapper+base, 지표 계산기, DL 트레이너)
  T3-B: UI 개발 (GUI, Web UI)
  T3-C: 설정 & 문서 (TOML, Markdown)
  T3-D: 데이터 소스 (EODHD, ThetaData)
  T1 항목 아래에 포함: 역량 한계(필수), Mock 데이터(필수)
===================================================== -->
## 프로젝트 컨벤션

<!-- T1: 역량 한계 / 정직성 -->
- **역량 한계 / 정직성(필수)**
  - 요청을 수행하는 데 필요한 정보/자격 증명/도구가 부족해 완료할 수 없는 경우(예: API 키/엔드포인트 미제공, provider 스펙 불명확)는 **초기에 명확히 "지금은 못 한다"**고 설명합니다.
  - 기능이 되는 것처럼 보이게 만드는 땜질(예: source 컬럼 숨기기)이나, 동작을 암시하는 placeholder 코드를 추가하지 않습니다.
  - 막히는 지점을 풀기 위한 최소 체크리스트(필요 입력값, 시크릿을 둘 위치, 최소 검증 방법)를 함께 제시합니다.
  - 요구사항이 애매하거나 사용자가 선택해야 하는 지점(동작/UX/데이터)이 있으면 hook 질문 플로우(예: `ask_questions`)로 2–6개 선택지를 제안하고, 합리적인 기본값을 recommended로 표시한 뒤 사용자 확인 후 진행합니다.
  - 막혔을 때(예: 같은 접근이 새로운 정보 없이 2~3번 실패) 억지로 같은 단계를 반복하지 말고, 지금까지 시도한 내용을 요약한 뒤 **Bing 웹검색**(Copilot web search / “Copilot access to Bing” 기능이 가능하면)을 통해 원인 후보와 실용적인 해결책을 찾아 가장 가능성 높은 수정안을 적용합니다.

<!-- T1: Mock 데이터 정책 -->
- **Mock 데이터 정책(필수)**
  - 사용자가 mock 데이터를 명시적으로 요청하지 않는 한, mock/가짜 데이터 생성기(타이머, fake provider, seeded "demo news" 등)를 추가하거나 다시 넣지 않습니다.
  - 레포/코드 경로에 mock 생성이 존재한다면 end-to-end로 제거합니다(소스 코드 + 이를 설명하는 문서 + 삭제된 코드가 남아있을 수 있는 `dist/` 같은 빌드 산출물 포함).
  - 로컬 DB/출력물에 mock row가 이미 저장돼 있다면(예: SQLite), 정리 절차(소스/태그 기준 삭제 또는 DB 삭제/재생성)를 선제적으로 제공하고, 정리 후에는 count 쿼리로 검증합니다.
  - 용어를 구분해서 씁니다: "생성 로직 제거"(미래 유입 차단) vs "기존 저장 mock row 정리"(과거 데이터 청소).

<!-- T3-A: 코드 패턴 -->
- **재시도 / 견고성(기본 정책)**
  - 일시적으로 실패할 수 있는 작업(네트워크 호출, Windows에서 파일 쓰기/rename/os.replace, copy/move 등)은 기본적으로 **최대 10회 재시도**를 전제로 구현합니다.
  - 짧은 대기 + 백오프(예: 0.1~0.5초부터 시작해서 점점 증가)를 사용하고, 재시도 횟수/원인을 로그로 남깁니다.
  - 영구적인 실패(잘못된 경로/설정, 인증/토큰 오류, 결정적 파싱/검증 오류, 디스크 용량 부족 등)는 무작정 재시도하지 말고 즉시 실패시키되 오류 메시지를 명확히 합니다.
  - 배치 작업이 길어지는 경우 재시도 횟수/대기 시간은 상수 또는 CLI/GUI 옵션으로 조절 가능하게 합니다.

- **Wrapper + base 패턴 (momentum)**
  - Base 모듈은 `Config` + `run_analysis` 형태로 코어 로직을 제공합니다.
  - Wrapper는 base를 import하고 상수/경로 설정 + `main()` 정도만 둡니다.
  - 출력 규칙:
    - “raw” CSV는 항상 쓰고, Parquet는 가능하면 쓰되(`pyarrow/fastparquet` 없으면 graceful skip).
    - Excel은 임시 파일에 쓴 뒤 `os.replace`로 교체(부분 파일로 깨지는 것 방지).
  - 진행/상태 출력:
    - 오래 걸리는 작업은 콘솔에 진행 상황을 출력합니다.
    - 성공 시 주요 출력 경로를 포함한 성공 메시지를 출력합니다.

- **Indicator calculators (deep_learning_data)**
  - pandas DataFrame에 컬럼을 추가하는 방식이며, row를 drop하지 않습니다(초반 구간은 히스토리 부족으로 `NaN` 가능).
  - 로깅 패턴: 파일 로거 + `logger.handlers` 가드(중복 핸들러 방지).
    - 출력 디렉토리가 있으면 log 파일도 그 디렉토리에 두는 것을 기본으로.
    - 출력 디렉토리 맥락이 없으면 스크립트 옆에 `.log`.
    - `log_errors=True`일 때 예외는 `logger.exception(...)`으로 기록 후 재-raise.
    - 성공 시 `SUCCESS: wrote <paths>` 같은 최종 로그 라인을 남김.
  - 큰 입력/루프는 `progress_every` 같은 노브를 제공해 주기적으로 진행 상황을 출력.
  - 일부 스크립트는 CLI 제공 + repo root 기준 상대 경로로 출력.

- **딥러닝 트레이너(dedup + 프리셋 + 문서 정합)**
  - **공통 중간 결과 dedup(필수):** 멀티 head / 멀티 case trainer에서는 비용 큰 공통 중간 결과를 먼저 1회 계산하고 여러 head가 재사용하도록 구성합니다.
    - 예시: 주식 `close/high/low` 배열 + horizon별 `r_end/r_max/r_min`; 옵션 `options_groups`(스냅샷 인덱스); (i,h,delta,right) 계약 선택 + horizon 종료 가격 매칭 + profit%.
    - `label_targets` hit 판정 같은 의미 루프는 명시적으로 유지하되, 그 안에서 group/pick/match 같은 비싼 작업을 반복하지 않습니다.
  - **“중복계산/계산낭비” 정의(중요):** **입력 + config/옵션/플래그(랜덤 시드 포함)** 조건이 동일할 때 **결과가 동일한데도** 같은 계산을 반복하는 경우만 중복/낭비로 봅니다. 계산을 바꾸면 결과가 달라지는 경우는 중복/낭비가 아니라 “동작 변경”이므로 별도로 취급합니다.
  - **case preset / multi-case 설계:** `active_cases` 같은 multi-select 프리셋을 지원할 때:
    - `enable_*` 플래그 merge 규칙을 명확히 둡니다(보통 OR).
    - 충돌 가능성이 큰 공통 파라미터(`label_horizons`, `label_deltas`, `label_targets`)는 case 내부가 아니라 루트 VALUES에 둡니다.
    - 주식+옵션 라벨을 같이 켤 수 있다면 혼합 모드(예: `Model_SO`)를 명시적으로 지원하거나, 아니면 명확한 에러로 즉시 차단합니다.
    - 하위호환 규칙(`active_cases`가 없거나 비어 있으면 legacy `active_case`)을 코드/문서에 함께 명시합니다.
  - **문서 정합(EN/KO):** bilingual `*.md`는 같은 제목/같은 순서로 유지하고, “중복 제거 vs 반복”을 구분해 설명합니다.
  - **리팩터링 후 정리(레거시 격리):** 리팩터링으로 기존 경로가 더 이상 사용되지 않으면 삭제하거나, `LEGACY/UNUSED` 섹션으로 격리하고 간단한 이유를 적습니다.

- **GUI 스크립트(사용자가 GUI 요청 시)**
  - Tkinter/Streamlit 등 금지, **PyQt만 사용**. 기본은 PyQt6(이미 PyQt5를 쓰면 유지).
  - GUI의 텍스트 영역/테이블/상태 표시에서 복사 가능하도록 설정.
  - 창 크기는 항상 조정 가능해야 하며, 레이아웃은 내부 위젯이 자동으로 맞춰지게 구성(고정 크기 금지).
  - 사용자가 고정 크기를 명시적으로 요청하지 않는 한 `setFixedSize(...)`, `MSWindowsFixedSizeDialogHint` 같은 고정 크기 힌트/제약을 사용하지 마세요.
  - 폴더명/경로처럼 긴 문자열을 라벨로 표시할 때는 창이 가로로 과도하게 커지지 않도록 줄바꿈을 허용하세요:
    - `QLabel.setWordWrap(True)` 사용, 필요하면 `QSizePolicy.Ignored`처럼 축소에 유리한 size policy 적용.
  - GUI 사용 로그(`<script_stem>_gui.log`)를 항상 남기고, 예외는 `logger.exception(...)`으로 기록.
  - **`*gui_vm*.py` 파일 생성 요청 시**
    - GUI는 로컬에서 실행되어야 하며, 실제 코드 실행/데이터 접근은 SSH로 VM에서 수행해야 함.
    - 결과 산출물은 항상 VM에 저장.
    - **SSH 실행 견고성(중요)**
      - `cd <remote_root> && python <상대경로>` 방식에 의존하지 마세요. VM/login-shell 환경에 따라 작업 디렉토리가 예상과 다르게 동작하면서 상대경로가 `$HOME` 기준으로 풀릴 수 있습니다.
      - `remote_root`를 기준으로 **절대경로 스크립트**를 만들어 실행하는 방식을 우선 사용하세요. 예: `python3 "$remote_root/path/to/script.py" ...`
      - Windows/PowerShell에서 SSH 커맨드를 만들 때 `$`가 로컬에서 먼저 확장되지 않도록 주의하세요(원격 문자열은 single-quote 사용 또는 `$` 이스케이프 권장).
      - VM에 레포 venv가 있으면 그 파이썬을 우선 사용하세요(예: `/mnt/python/.venv/bin/python`). system `python3`는 패키지(`pandas` 등)가 없어서 `ModuleNotFoundError`가 날 수 있습니다.
      - “원격 스크립트 파일이 없음” / `remote_root` 불일치 같은 케이스는 **재시도 대상이 아닌 설정 오류**이므로 즉시 실패시키고 안내 메시지를 명확히 하세요.
    - **Stop / Retry 정확성(중요)**
      - GUI에 재시도 기능이 있다면 `Stop`은 **완전 중지**여야 합니다:
        - `stop_requested` 플래그를 세팅
        - 재시도 타이머 즉시 중지
        - 대기 중 작업 큐(예: 여러 포맷 순차 실행) 비우기
        - 프로세스 `finished` 콜백에서 먼저 `stop_requested`를 확인하고, 재시도 예약/다음 작업 실행을 절대 하지 않기
      - `kill()`로 종료된 뒤 `finished` → “실패 처리” → 재시도 예약이 걸리는 레이스를 방지하세요.
    - 로컬로 결과를 동기화하는 것은 **옵션**이며, GUI에서 사용자가 켜고 끌 수 있어야 함(체크박스/토글).
      - 기본값: 사용자가 켜지 않는 한 로컬로 동기화하지 않음.
      - 동기화를 끈 경우, GUI는 “결과는 VM에만 존재한다”를 명확히 표시하고 최종 상태/로그에 VM 출력 경로를 포함해야 함.
    - **동기화 기본:** VM → 로컬은 `rsync`를 우선 사용(증분 전송/재시도 유리). Windows에서는 `wsl rsync`를 우선 고려(WSL 경로 `/mnt/c/...` 사용). `rsync`가 없으면 `scp`로 폴백.
    - 로컬/VM 폴더 구조가 동일하다는 전제를 검증하고, 불일치 시 오류로 중단.

- **Web UI 스크립트(사용자가 Web UI 요청 시)**
  - **전형적인 토폴로지(중요):** 서버는 VM에서 실행되고, 사용자는 다른 컴퓨터(로컬 PC)에서 브라우저로 접속하는 경우가 많습니다.
    - 다른 컴퓨터에서 `http://127.0.0.1:8000/`로 접속된다고 가정하면 안 됩니다.
  - **바인딩(host/port) 정책(원격 접속 정확성 + 안전):**
    - 기본 바인딩은 외부 노출을 막기 위해 `127.0.0.1`(loopback)로 두세요.
    - 환경변수로 바인딩을 바꿀 수 있게 만드세요(예: `WEBUI_HOST`, `WEBUI_PORT`). 원격 접속이 필요할 때만 사용자가 명시적으로 `0.0.0.0`를 선택하도록.
    - 문서에 두 가지 접속 방식을 모두 안내하세요:
      - **권장:** SSH 포트포워딩(`ssh -L 8000:127.0.0.1:8000 <vm_host>`) 후 로컬에서 `http://127.0.0.1:8000` 접속.
      - **직접 공개:** `0.0.0.0`로 바인딩하고 VM 방화벽/클라우드 보안그룹에서 인바운드를 “내 IP만” 허용.
  - **기본은 외부 에셋 금지:** React/CDN/Babel 등 네트워크로 로드되는 JS/CSS에 기본적으로 의존하지 말고, 제한된 네트워크/오프라인에서도 렌더링되게 하세요.
  - **캐시 처리:** 루트 HTML(`GET /`)은 `no-store`로 해서 “수정했는데도 옛 UI가 계속 보이는” 문제를 방지하세요.
  - **브라우저/WebView 호환성(최신 JS 가정 금지):**
    - 구형/내장 WebView에서 파싱 단계에서 바로 죽는 JS 패턴을 피하세요:
      - 함수 호출 인자 목록에서 trailing comma 사용 금지.
      - `??`(nullish coalescing), `?.`(optional chaining) 사용 지양.
    - arrow function, async/await, rest/spread 등 최신 문법을 쓴다면, UI 내에 “시작 실패 패널”을 띄우고 “최신 브라우저로 열라”는 안내를 명확히 표시하세요.
  - **디버그 가시성(필수):**
    - 시작 플레이스홀더 + “preflight OK” 표시로 JS가 도는지 즉시 알 수 있게.
    - `window.onerror` / `unhandledrejection`를 잡아서 콘솔뿐 아니라 UI 화면에도 오류를 보여주세요.
    - 백엔드 생존 확인용 `GET /api/config` 또는 `GET /healthz` 같은 가벼운 엔드포인트를 제공하세요.
  - **잡음 감소:** `/favicon.ico`는 204 또는 작은 아이콘으로 응답해서 404 콘솔 스팸을 줄이세요.
  - **보안:** 시크릿은 절대 로그에 남기지 말고, 외부 공개 시 인바운드 제한을 강하게 권장하세요. 기본은 SSH 터널링을 선호.

- **설정 템플릿 파일(TOML/INI/YAML) 규칙(중요)**
  - 터미널에서 스크립트를 실행하기 위한 *설정 템플릿 파일*을 만들거나 수정할 때는, 반드시 두 구간으로 분리해서 작성합니다:
    - `VALUES`: key/value 설정 값만(= CLI 옵션/플래그에 해당하는 값).
    - `EXPLANATIONS`: 사람이 읽는 설명/문서만(설정값 중복 금지).
  - **필수 항목을 위로(필수):** `EXPLANATIONS`의 맨 위(각 언어 블록의 시작)에 짧은 “필수 체크리스트”를 두고 아래를 포함합니다:
    - 실행에 필요한 필수 CLI 옵션/플래그(예: `--config <path>`)
    - `VALUES`에서 반드시 채워야 하는 key들( REQUIRED / CONDITIONALLY REQUIRED 구분 포함 )
    - 최소 실행 가능한 CLI 예시 1개
  - **빈 문자열 placeholder("") 규칙:** 템플릿에 `foo = ""` 같은 빈 값이 있으면 `EXPLANATIONS`에서 반드시:
    - 사용자가 채워야 하는지 여부,
    - 언제 필수인지(예: “옵션 라벨 활성화일 때만”),
    - 구체 예시 값(최소 1개)
    를 명시합니다.
  - **config 동반 문서(동작이 복잡할 때):** merge/우선순위/입출력 의미가 복잡한 config는 같은 폴더에 동반 Markdown을 둡니다:
    - 가능하면 같은 base name 사용: `something_config.toml` ↔ `something_config.md`
    - TOML `EXPLANATIONS`: 간단(빠른 실행 + 필수 체크리스트)
    - MD: 더 자세하고 코드 구현과 1:1로 맞게 작성하며, config 동작 변경 시 함께 업데이트
  - **TOML 문법 안전장치(필수):** 설정 템플릿은 반드시 “유효한 TOML”이어야 합니다.
    - `.toml` 파일에서 `EXPLANATIONS` 구간의 모든 라인은 반드시 `#`로 시작하는 주석이어야 합니다(아니면 삭제하거나 별도 `.md`로 옮기기).
    - `.toml` 설정 템플릿을 만들/수정한 직후에는 간단히 파싱 확인을 수행합니다(권장):
      - `python -c "import tomllib, pathlib; tomllib.loads(pathlib.Path('path/to/config.toml').read_text(encoding='utf-8'))"`
      - Python 3.11 미만이면 `tomli` 사용.
  - `EXPLANATIONS` 구간은 한/영 2개 블록으로 작성합니다:
    - 영어를 먼저 쓰고, 구분선 `---` 뒤에 한국어를 씁니다.
    - 두 언어 블록은 섞지 말고, 내용은 반드시 동일하게 맞춥니다(제목/옵션/기본값/예시 커맨드 동일).
  - 용어: “인자(arguments)”보다는 “CLI 옵션/플래그(커맨드라인 옵션)” 표현을 우선 사용합니다(특히 `--epochs` 같은 형태).

- **Docs / “prompt” Markdown 규칙(중요)**
  - 일부 스크립트는 같은 이름의 `*.md`를 “프롬프트/스펙/설명” 동반 문서로 사용합니다.  - **한/영 병기 규칙 적용 범위(필수):** 이 한/영 작성 방식은 아래 **두 가지 모두**에 적용됩니다:
    1. 이 레포의 모든 `*.md` 동반/스펙/설명 문서.
    2. `copilot-instructions.md` 자체 — 섹션을 추가하거나 수정할 때, 반드시 같은 변경 작업 안에서 다른 언어의 대응 섹션도 동일하게 업데이트해야 합니다.  - **한/영 병기 규칙:** 이 레포에서 `*.md` 동반 문서를 새로 만들거나 수정할 때는 **영어와 한국어를 모두** 포함합니다.
    - **영어를 위**, 구분선(예: `---`)을 넣은 뒤 **한국어를 아래**에 작성합니다.
    - 두 영역은 섞지 않습니다(같은 문단/불릿에 언어 혼합 금지).
    - **동일 내용(정합) 규칙:** English/Korean 두 섹션은 **같은 정보**를 포함해야 하며 항상 동기화되어야 합니다.
      - 같은 제목(heading)을 같은 순서로.
      - 같은 단계 번호/옵션 목록/기본값/파일 경로/실행 예시.
      - 같은 표/컬럼 구성(언어만 번역).
    - **상세 작성 규칙(간략 금지):** 문서는 동작을 충분히 설명해야 합니다.
      - 계산/집계 과정을 단계별로 상세히(입력 → 정규화 → 핵심 계산 → 출력).
      - 코드의 로직 구조를 충분히 설명합니다(주요 모듈/함수, 스테이지 순서, 데이터 흐름).
      - 시간 버킷 의미를 명확히(예: label/closed, 어떤 1분봉이 어떤 상위 봉에 포함되는지).
      - 중요한 가정/예외 케이스를 명시(timezone 처리, 분 누락, 세션 필터링 전제 등).
      - **실행 위치/입출력(Locality) 규칙(환경 모호성 금지):** 워크플로우가 여러 환경에 걸쳐 동작하는 경우(예: 로컬 vs SSH로 VM, WSL, Docker, 여러 Python env) 문서에 반드시 아래를 명시하세요.
        - **각 액션이 어디서 실행되는지**(예: “미리보기/로드/뷰” vs “실제 run/train”).
        - **데이터를 어디서 읽고**, **출력을 어디에 쓰는지**(로컬 디스크 vs 원격 디스크).
        - **경로가 어떻게 해석/매핑되는지**(절대경로 vs 레포 상대경로, Windows vs POSIX)와 기준 root(예: `remote_root`).
        - **산출물 동기화(sync) 여부**, 기본 동작, on/off 방법.
        - 경로 매핑이 존재하면 **최소 1개의 구체 예시**(그럴듯한 입력 경로와 다른 환경에서의 해석 결과).
        - 환경 불일치로 인한 전형적 실패(예: “로컬에서는 되는데 원격에서 file not found”)와 가장 빠른 수동 점검 방법.
      - **추상 설명 금지(정의는 실행 가능해야 함):** “$[t, \text{next})$” 같은 추상 표기만 하고 `t`/`next`가 무엇인지 확정하지 않는 설명을 피하세요.
        - 핵심 규칙/변환마다 **운영적 정의(operational definition)** 를 반드시 포함하세요: 입력이 무엇이고, 그룹핑/매핑 규칙이 정확히 무엇이며, 출력이 무엇을 의미하는지.
        - 기호/변수(예: `t`, `t_next`, “bucket”, “label”)를 사용하면 같은 섹션(또는 Glossary)에서 단위까지 포함해 정의하세요.
        - 핵심 규칙마다 **최소 2개 이상의 구체 예시**(실제 날짜/시간/숫자)를 포함하고, 각 예시는 **포함되는 경계 사례**와 **제외되는 경계 사례**를 모두 보여야 합니다.
        - 경계 기반 로직(시간 버킷, 윈도우, 필터)은 반드시 다음을 명시하세요:
          - 경계 시각(예: 금요일 00:00 vs 정규장 09:30),
          - 포함/제외(inclusive/exclusive),
          - 타임존 처리(tz-aware → tz-naive 및 어떤 로컬 타임존을 가정하는지),
          - 결측/휴장/분 누락 시 동작과 빈 버킷 처리(행 유지 vs 제거).
        - 사용자가 손으로 검증 가능한 “체크 항목” 1–2개를 추가하세요(예: 특정 timestamp가 특정 라벨 버킷으로 가야 함).
      - 사용자가 “새 파일을 만들라”고 명시하지 않았더라도, 요청을 수행하기 위해 Copilot이 보조용 코드 파일을 생성하는 경우 파일명 앞에 `test_` prefix를 붙입니다.
    - **용어 정리 규칙:** 흔하지 않거나 의미가 겹치기 쉬운 용어(bucket/label/closed/origin/offset/turnover 등)를 쓰면, 문서에 별도의 **용어(Glossary)** 섹션을 만들고 거기에 정의를 모아서 작성합니다.
      - 용어 정의를 문서 곳곳에 흩뿌리지 말고 한 구역에 모읍니다.
  - 이름 매칭: `foo.py` ↔ `foo.md` (같은 폴더, 같은 base name)
  - 새 `*.md`는 사용자가 “prompt 파일 만들어줘”라고 명시한 경우에만 생성.
  - `*.py` 수정 시, 같은 이름의 `*.md`가 있으면 반드시 함께 업데이트(내용 100% 동기화).
  - 출력 컬럼 목록은 반드시 명시하고, 컬럼명은 `[][][]column_name[][][]` 포맷으로 강조.

  - **한/영 영역 경계 가드레일(언어 섞임 금지) (필수):**
    - 많은 문서가 `## EN` … `---` … `## KO` 형태의 **명확한 경계**를 사용합니다.
    - 수정 전에 반드시 `---` 경계를 **먼저 찾고**, 현재 위치가 EN 영역인지 KO 영역인지 확인하세요.
    - EN 영역에는 영어만, KO 영역에는 한국어만 작성하세요.
    - EN 영역(`---` 위)에 한국어 헤딩/문단을 넣거나, KO 영역(`---` 아래)에 영어 헤딩/문단을 넣지 마세요.
    - 새 섹션을 추가할 때는 **해당 언어 영역 내부의 헤딩 구조**를 기준으로 삽입 위치를 결정하세요(부분 화면에서 가까워 보인다고 아무데나 넣지 않기).
    - 수정 후 간단히 점검해서 언어가 섞이지 않았는지 확인하세요:
      - EN 영역에 한국어 헤딩/키워드가 없는지
      - KO 영역에 영어 헤딩/키워드가 없는지

- **EODHD 규칙은 엄격**
  - `EODHD/INSTRUCTION.txt` 준수:
    - 저장되는 시간은 `America/New_York` 로컬.
    - 저장 출력물에는 `Timestamp` 컬럼을 포함하지 않음(중간 계산에만 사용 가능).
    - API 토큰은 `EODHD/API TOKEN`에서 읽음.
    - 심볼별 코드는/출력은 `EODHD/<symbol>/` 아래에 둠.

- **ThetaData / ThetaTerminal**
  - `thetadata/run_theta_terminal.ps1`로 Java ThetaTerminal을 실행하고, `thetadata/credit.txt`는 스크립트 옆에 유지.

