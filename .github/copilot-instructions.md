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
- Before starting implementation, decide which `.github/copilot-skills/*.md` documents apply to this task and state your choice in chat (e.g., “Using: planning.md + web-ui.md”). Then start work.
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
| **T1** | [Capability limits / honesty](#project-conventions-to-follow) | no fake features, fail fast |
| **T1** | [Mock data policy](#project-conventions-to-follow) | no mock unless requested |
| **T1** | [Safety / repo hygiene](#safety--repo-hygiene) | path ≤250, secrets, naming |
| **T1** | [Agent-specific language override](#agent-specific-language-override) | Claude → Korean only |
| **T1** | [Bilingual EN/KO sync](#project-conventions-to-follow) | *.md + copilot-instructions parity, Korean-first reading |
| **T2** | [Repository context (optional)](copilot-skills/repo-context.md) | overview, structure, how to run |
| **T3-A** | [Retries / robustness](#project-conventions-to-follow) | 10 retries, backoff, permanent failures |
| **T3-C** | [Docs / prompt Markdown files](#project-conventions-to-follow) | bilingual EN+KO, parity, output cols |
| **T3** | [Skill instructions (situation-specific)](#skill-instructions-situation-specific) | links to `.github/copilot-skills/` |

> **T1** = Always apply every task &nbsp;·&nbsp; **T2** = Repo context (read when unfamiliar) &nbsp;·&nbsp; **T3-A** = Code patterns &nbsp;·&nbsp; **T3-B** = UI dev &nbsp;·&nbsp; **T3-C** = Config/Docs &nbsp;·&nbsp; **T3-D** = Data sources

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

<!-- T1: Agent-specific language override -->
<a id="agent-specific-language-override"></a>
## Agent-specific language override (must)
- **When the executing AI agent is Claude (any version/model):** all `*.md` documentation — companion docs, `plan.md`, config `EXPLANATIONS`, `copilot-instructions.md` edits — must be written in **Korean only** (한국어 단독). The bilingual EN/KO requirement is waived for Claude agents.
- **For all other agents (e.g., GPT, Gemini):** follow the standard bilingual EN/KO rules described in each section below.
- This override applies to every place in these instructions that says "bilingual EN+KO" or "English first, then Korean."
- `agent_log.md` is already Korean-only regardless of agent — this rule does not change that.
- **Claude editing existing EN+KO docs (parity exemption):**
  - When Claude edits an existing bilingual (EN+KO) `*.md` file, update **only the KO section**. Do **not** update the EN section to maintain parity.
  - Instead, if the EN section does not already have a staleness warning, insert the following banner at the very top of the EN region (immediately after the `## EN` heading or at the start of the EN content):
    ```
    > ⚠️ EN section may be outdated — KO section is the authoritative source.
    ```
  - Also, if the KO section does not already have a sync-guide banner, insert the following banner at the very top of the KO region (immediately after the `## KO` heading or at the start of the KO content):
    ```
    > ℹ️ KO 섹션이 최신 기준(authoritative source)입니다. EN 섹션 정합이 필요하면 KO를 기준으로 EN을 업데이트하세요.
    ```
  - Both banners only need to be inserted **once per document**. If they already exist, do not duplicate them.
  - Rationale: the "Korean-first reading priority" rule (all agents) already ensures AI readers use KO as the primary source, so EN parity is not required when Claude is the writer. The KO banner guides future non-Claude agents to sync EN from KO.
  - **When Claude creates a new `*.md` file:** write KO only. Do not create an EN section at all.

<!-- ====================================================
  TIER 2 — Repo context
===================================================== -->

## Repository context (optional)
- Repo-specific overview / folder structure / how-to-run guidance is kept in a separate document so this file can be copied across repositories without carrying stale assumptions.
- See: `copilot-skills/repo-context.md`

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

- **Docs and “prompt” Markdown files (important)**
  - This repo uses `*.md` files as *prompt/spec/explanation companions* for some scripts (example: `deep_learning_data/indicator_calculator/stock2_indicator_calculator.md`).  - **Scope of the bilingual rule (must):** this EN/KO writing convention applies to **both** of the following:
    1. Any `*.md` companion/spec/explanation doc in this repo.
    2. `copilot-instructions.md` itself — whenever a section is added or edited, the corresponding section in the other language must be updated identically in the same change.
  - **Agent-specific override:** Claude agents are exempt from the bilingual requirement — see [Agent-specific language override](#agent-specific-language-override). Claude writes Korean only.
  - **Korean-first reading priority (must — all agents):** when an AI agent reads a bilingual `*.md` file (EN section + KO section), it must **read the Korean section first** and treat it as the primary source of truth. Only fall back to the English section if the Korean section is missing, incomplete, or ambiguous. This applies to **all** AI agents (Claude, GPT, Gemini, etc.), not just Claude.
  - **Bilingual rule (English + Korean):** when creating or updating any `*.md` companion/spec/explanation doc in this repo, include **both** English and Korean *(unless overridden by the Agent-specific language override)*.
    - Write **English first**, then a clear separator (e.g., `---`), then **Korean**.
    - Keep the two sections strictly separated (do not mix languages within the same bullet/paragraph).
    - **Parity rule (must match):** the English and Korean sections must contain the **same information** and be kept in sync.
      - Same headings in the same order.
      - Same numbered steps, option lists, default values, file paths, and example commands.
      - Same tables/columns (only the language changes).
      - **Claude exemption:** Claude agents are exempt from this parity rule — see [Agent-specific language override](#agent-specific-language-override). Claude updates KO only and inserts a staleness warning in EN.
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

  See also:
  - EODHD rules: `copilot-skills/datasource-eodhd.md`
  - ThetaData / ThetaTerminal: `copilot-skills/datasource-thetadata.md`

## Skill instructions (situation-specific)
These rule sets apply only in specific situations; see `.github/copilot-skills/`:
- [Planning & Agent Log](copilot-skills/planning.md)
- [Momentum wrapper/base](copilot-skills/momentum-wrapper-base.md)
- [Indicator calculators](copilot-skills/indicator-calculators.md)
- [Deep learning trainers](copilot-skills/deep-learning-trainers.md)
- [GUI scripts (PyQt)](copilot-skills/gui-pyqt.md)
- [Web UI scripts](copilot-skills/web-ui.md)
- [Config templates](copilot-skills/config-templates.md)
- [EODHD rules](copilot-skills/datasource-eodhd.md)
- [ThetaData / ThetaTerminal](copilot-skills/datasource-thetadata.md)

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
- 구현/수정 작업을 시작하기 전에, 이번 작업에 적용할 `.github/copilot-skills/*.md` 문서가 무엇인지 판단한 뒤 채팅에 먼저 명시한다(예: “참고: planning.md + web-ui.md”). 그 다음 작업을 시작한다.
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
| **T1** | [역량 한계 / 정직성](#프로젝트-컨벤션) | API 키 없을 때, 땜질 금지 |
| **T1** | [Mock 데이터 정책](#프로젝트-컨벤션) | mock 데이터 요청 없으면 사용 금지 |
| **T1** | [보안 / 레포 위생](#보안--레포-위생) | 경로 250자 이하, 시크릿, 네이밍 |
| **T1** | [에이전트별 언어 오버라이드](#에이전트별-언어-오버라이드) | Claude → 한국어 단독 |
| **T1** | [한/영 동기화](#프로젝트-컨벤션) | *.md + copilot-instructions 정합, 한국어 우선 읽기 |
| **T2** | [레포 컨텍스트(옵션)](copilot-skills/repo-context.md) | 개요, 구조, 실행 방법 |
| **T3-A** | [재시도 / 견고성](#프로젝트-컨벤션) | 10회 재시도, 백오프, 영구 실패 처리 |
| **T3-C** | [Docs / prompt Markdown 규칙](#프로젝트-컨벤션) | 한/영 병기, 정합, 출력 컬럼 |
| **T3** | [스킬 지침(상황별)](#스킬-지침상황별) | `.github/copilot-skills/` 링크 모음 |

> **T1** = 모든 작업에 항상 적용 &nbsp;·&nbsp; **T2** = 레포 컨텍스트 (처음이면 읽기) &nbsp;·&nbsp; **T3-A** = 코드 패턴 &nbsp;·&nbsp; **T3-B** = UI 개발 &nbsp;·&nbsp; **T3-C** = 설정/문서 &nbsp;·&nbsp; **T3-D** = 데이터 소스
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

<!-- T1: 에이전트별 언어 오버라이드 -->
<a id="에이전트별-언어-오버라이드"></a>
## 에이전트별 언어 오버라이드 (필수)
- **실행하는 AI 에이전트가 Claude(모든 버전/모델)인 경우:** 모든 `*.md` 문서 — 동반 문서, `plan.md`, 설정 `EXPLANATIONS`, `copilot-instructions.md` 수정 — 를 **한국어 단독**으로 작성합니다. Claude 에이전트에 대해서는 한/영 병기 요구사항이 면제됩니다.
- **그 외 에이전트(예: GPT, Gemini):** 아래 각 섹션에 명시된 기존 한/영 병기 규칙을 따릅니다.
- 이 오버라이드는 이 지침서에서 "한/영 병기" 또는 "영어 먼저, 한국어 뒤에"라고 표기된 모든 곳에 적용됩니다.
- `agent_log.md`는 에이전트와 무관하게 이미 한국어 단독 — 이 규칙으로 달라지는 것 없음.
- **Claude가 기존 EN+KO 병기 문서를 수정할 때 (정합성 면제):**
  - 기존에 EN+KO로 작성된 `*.md`를 수정할 때는 **KO 섹션만 업데이트**합니다. EN 섹션을 함께 수정하여 정합성을 맞출 필요 없습니다.
  - 대신, EN 섹션에 아직 outdated 경고가 없으면 EN 영역 최상단(`## EN` 헤딩 바로 아래, 또는 EN 내용 시작 부분)에 다음 배너를 삽입합니다:
    ```
    > ⚠️ EN section may be outdated — KO section is the authoritative source.
    ```
  - 또한, KO 섹션에 아직 정합 안내 배너가 없으면 KO 영역 최상단(`## KO` 헤딩 바로 아래, 또는 KO 내용 시작 부분)에 다음 배너를 삽입합니다:
    ```
    > ℹ️ KO 섹션이 최신 기준(authoritative source)입니다. EN 섹션 정합이 필요하면 KO를 기준으로 EN을 업데이트하세요.
    ```
  - 두 배너 모두 문서당 **1회만** 삽입합니다. 이미 있으면 중복 삽입하지 않습니다.
  - 근거: "한국어 우선 읽기" 규칙이 모든 에이전트에 적용되므로, AI 독자는 항상 KO를 먼저 읽습니다. KO 배너는 향후 다른 에이전트가 EN을 KO 기준으로 정합할 때 방향을 명확히 해줍니다.
  - **Claude가 새 `*.md` 파일을 만들 때:** KO만 작성합니다. EN 섹션은 만들지 않습니다.

<!-- ====================================================
  TIER 2 — 레포 컨텍스트
===================================================== -->

## 레포 컨텍스트(옵션)
- 레포 개요/폴더 구조/실행 방법처럼 “레포 종속” 정보는, 이 파일이 다른 레포로 복사될 때 가정이 틀어지는 문제를 피하기 위해 별도 문서로 분리합니다.
- 참고: `copilot-skills/repo-context.md`
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

- **Docs / “prompt” Markdown 규칙(중요)**
  - 일부 스크립트는 같은 이름의 `*.md`를 “프롬프트/스펙/설명” 동반 문서로 사용합니다.  - **한/영 병기 규칙 적용 범위(필수):** 이 한/영 작성 방식은 아래 **두 가지 모두**에 적용됩니다:
    1. 이 레포의 모든 `*.md` 동반/스펙/설명 문서.
    2. `copilot-instructions.md` 자체 — 섹션을 추가하거나 수정할 때, 반드시 같은 변경 작업 안에서 다른 언어의 대응 섹션도 동일하게 업데이트해야 합니다.
  - **에이전트별 오버라이드:** Claude 에이전트는 한/영 병기 요구사항이 면제됩니다 — [에이전트별 언어 오버라이드](#에이전트별-언어-오버라이드) 참고. Claude는 한국어 단독으로 작성합니다.
  - **한국어 우선 읽기 규칙(필수 — 모든 에이전트):** AI 에이전트가 한/영 병기 `*.md` 파일을 읽을 때는 **한국어 섹션을 먼저 읽고**, 한국어를 기준(primary source of truth)으로 사용합니다. 한국어 섹션이 누락·불완전·모호한 경우에만 영어 섹션을 참조합니다. 이 규칙은 Claude만이 아니라 **모든 AI 에이전트**(Claude, GPT, Gemini 등)에 적용됩니다.
  - **한/영 병기 규칙:** 이 레포에서 `*.md` 동반 문서를 새로 만들거나 수정할 때는 **영어와 한국어를 모두** 포함합니다 *(에이전트별 언어 오버라이드에 의해 면제 가능)*.
    - **영어를 위**, 구분선(예: `---`)을 넣은 뒤 **한국어를 아래**에 작성합니다.
    - 두 영역은 섞지 않습니다(같은 문단/불릿에 언어 혼합 금지).
    - **동일 내용(정합) 규칙:** English/Korean 두 섹션은 **같은 정보**를 포함해야 하며 항상 동기화되어야 합니다.
      - 같은 제목(heading)을 같은 순서로.
      - 같은 단계 번호/옵션 목록/기본값/파일 경로/실행 예시.
      - 같은 표/컬럼 구성(언어만 번역).
      - **Claude 면제:** Claude 에이전트는 이 정합 규칙이 면제됩니다 — [에이전트별 언어 오버라이드](#에이전트별-언어-오버라이드) 참고. Claude는 KO만 수정하고 EN에는 outdated 경고를 삽입합니다.
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


추가 참고:
- EODHD 규칙: `copilot-skills/datasource-eodhd.md`
- ThetaData / ThetaTerminal: `copilot-skills/datasource-thetadata.md`

## 스킬 지침(상황별)
아래 규칙들은 특정 상황에서만 적용됩니다. 자세한 내용은 `.github/copilot-skills/`를 참고하세요:
- [플랜 & 에이전트 로그](copilot-skills/planning.md)
- [Wrapper + base 패턴 (momentum)](copilot-skills/momentum-wrapper-base.md)
- [Indicator calculators](copilot-skills/indicator-calculators.md)
- [딥러닝 트레이너](copilot-skills/deep-learning-trainers.md)
- [GUI 스크립트(PyQt)](copilot-skills/gui-pyqt.md)
- [Web UI 스크립트](copilot-skills/web-ui.md)
- [설정 템플릿 파일](copilot-skills/config-templates.md)
- [EODHD 규칙](copilot-skills/datasource-eodhd.md)
- [ThetaData / ThetaTerminal](copilot-skills/datasource-thetadata.md)

