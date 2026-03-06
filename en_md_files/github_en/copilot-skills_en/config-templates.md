# Config template files (TOML/INI/YAML) (skill)

## EN

### When to use
- When creating or editing config templates used to run scripts from the terminal.
- When you need to enforce the `VALUES` vs `EXPLANATIONS` split and keep the template machine-parseable (especially for TOML).
- When you need bilingual `EXPLANATIONS` blocks (EN then `---` then KO) and a minimal runnable example.

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
  - The `EXPLANATIONS` section must be bilingual *(Override: Claude agents write Korean only — see Agent-specific language override)*:
    - English first, then a separator line `---`, then Korean.
    - Keep the two language blocks strictly separated and content-matched (same headings, same options, same defaults).
  - Terminology: prefer “CLI options/flags (command-line options)” rather than “arguments” unless you specifically mean positional arguments.
