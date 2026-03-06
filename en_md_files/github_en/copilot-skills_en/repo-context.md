# Repository context (optional)

## EN

### What this is
This document contains repository-specific context (overview, folder structure, data flow, and “how to run”).

### Why it is separated
`copilot-instructions.md` may be copied into other repositories. Repo-specific assumptions tend to become incorrect when copied, so repo context lives here as an **optional, replaceable** companion document.

### When to use
- When you need quick orientation before making changes (what the repo is, where code lives, how to run).
- When a task depends on the repo’s actual topology (frontend/backend split, data directories, build tooling).

### Maintenance rule
- If this repo changes meaningfully (new app entrypoint, new data flow, new run commands), update this file.
- If `copilot-instructions.md` is copied to another repository, either delete this file or rewrite it to match the new repo.

### Current repo notes (terminal_sec)
This workspace appears to be a mixed-codebase repo that includes:
- A Node/TypeScript “terminal” application under `terminal/` (with dev/build/test scripts).
- A Python-heavy research/data pipeline area (e.g., `EODHD/`, `original_data/`, `deep_learning_data/`) used by script-first workflows.

Use the task/target directory to decide which conventions apply (Node app vs Python scripts).

### Prompt/spec docs (authoritative)
For implementation-aligned “prompt/spec” documentation that explains how the current code works:
- Backend prompt/spec: `terminal/backend_prompt.md`
- Frontend prompt/spec (Figma-derived UI): `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`

If you find a mismatch between these docs and the code, update the docs in the same change.
