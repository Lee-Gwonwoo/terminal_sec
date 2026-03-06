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
- Before starting implementation, decide which `.github/copilot-skills/*.md` documents apply to this task and state your choice in chat (e.g., “Using: planning.md + remote-vm-web-ui.md”). Then start work.
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

## TABLE OF CONTENTS
(Read only the section relevant to your current task)

| Tier | Section | Key topics |
|------|---------|------------|
| **T1** | [Capability limits / honesty](#project-conventions-to-follow) | no fake features, fail fast |
| **T1** | [Mock data policy](#project-conventions-to-follow) | no mock unless requested |
| **T1** | [Safety / repo hygiene](#safety--repo-hygiene) | path ≤250, secrets, naming |
| **T1** | [Agent-specific language override](#agent-specific-language-override) | Claude → Korean only |
| **T1** | [Bilingual EN/KO sync](#project-conventions-to-follow) | *.md + copilot-instructions parity, Korean-first reading |
| **T2** | [Repository context (optional)](copilot-skills_en/repo-context.md) | overview, structure, how to run |
| **T3-A** | [Retries / robustness](#project-conventions-to-follow) | 10 retries, backoff, permanent failures |
| **T3-C** | [Docs / prompt Markdown files](#project-conventions-to-follow) | bilingual EN+KO, parity, output cols |
| **T3** | [Skill instructions (situation-specific)](#skill-instructions-situation-specific) | links to `copilot-skills_en/` |

> **T1** = Always apply every task &nbsp;·&nbsp; **T2** = Repo context (read when unfamiliar) &nbsp;·&nbsp; **T3-A** = Code patterns &nbsp;·&nbsp; **T3-B** = UI dev &nbsp;·&nbsp; **T3-C** = Config/Docs &nbsp;·&nbsp; **T3-D** = Data sources

# Copilot instructions (python workspace)

## Safety / repo hygiene
- **Path length hygiene (Windows / tooling compatibility)**
  - When creating new folders/files (especially generated outputs under deep subfolders), keep the **full absolute path length ≤ 250 characters**.
  - Prefer shorter folder/file names over deeper nesting.
  - Avoid repeating tokens (e.g., `csv/csv`, `parquet/parquet`) unless the surrounding codebase already requires it for backward compatibility.
  - If a requested naming scheme risks exceeding the limit, shorten only the *non-semantic* parts (extra prefixes/suffixes), and keep the key identifiers (symbol, timeframe, expiry, year) intact.
- Treat these as secrets and never print them to logs/output or commit derived values:
  - `EODHD/API TOKEN`, `thetadata/credit.txt`, `thetadata/creds.txt`.
- This repo contains many generated artifacts (`*.xlsx`, `*_raw.csv`, `*_raw.parquet`). When adding new scripts, follow the existing naming convention: `<script_name>.xlsx` + `<script_name>_raw.csv/parquet`, typically under the same folder as the script.

<a id="agent-specific-language-override"></a>
## Agent-specific language override (must)
- **When the executing AI agent is Claude (any version/model):** all `*.md` documentation — companion docs, `plan.md`, config `EXPLANATIONS`, `copilot-instructions.md` edits — must be written in **Korean only** (한국어 단독). The bilingual EN/KO requirement is waived for Claude agents.
- **For all other agents (e.g., GPT, Gemini):** follow the standard bilingual EN/KO rules described in each section below.
- This override applies to every place in these instructions that says "bilingual EN+KO" or "English first, then Korean."
- `agent_log.md` is already Korean-only regardless of agent — this rule does not change that.

## Repository context (optional)
- Repo-specific overview / folder structure / how-to-run guidance is kept in a separate document so this file can be copied across repositories without carrying stale assumptions.
- See: `copilot-skills_en/repo-context.md`

## Project conventions to follow
- **Capability limits / honesty (must)**
  - If a user request cannot be completed with the available information, credentials, or tools (e.g., missing API key/endpoint, unknown provider spec), say so **explicitly and early**.
  - Do **not** “paper over” missing functionality with misleading UI-only changes or placeholder code that implies the feature works.
  - Provide the shortest unblock checklist (exact inputs needed, where to put secrets, and a minimal verification step).
- **Mock data policy (must)**
  - Do **not** add or reintroduce mock/synthetic data generators unless the user explicitly requests mock data.
- **Retries / robustness (default policy)**
  - When implementing operations that can fail transiently, assume **up to 10 retries by default**.
- **Docs and “prompt” Markdown files (important)**
  - This repo uses `*.md` files as prompt/spec/explanation companions for some scripts.
  - The original EN sections were moved out of `.github` into `en_md_files/`.

## Skill instructions (situation-specific)
These rule sets apply only in specific situations; see `copilot-skills_en/`:
- [Planning & Agent Log](copilot-skills_en/planning.md)
- [Momentum wrapper/base](copilot-skills_en/momentum-wrapper-base.md)
- [Indicator calculators](copilot-skills_en/indicator-calculators.md)
- [Deep learning trainers](copilot-skills_en/deep-learning-trainers.md)
- [GUI scripts (PyQt)](copilot-skills_en/gui-pyqt.md)
- [Remote VM Web UI operations](copilot-skills_en/remote-vm-web-ui.md)
- [Config templates](copilot-skills_en/config-templates.md)
- [EODHD rules](copilot-skills_en/datasource-eodhd.md)
- [ThetaData / ThetaTerminal](copilot-skills_en/datasource-thetadata.md)
