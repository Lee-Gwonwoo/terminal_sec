# Momentum — Wrapper + base pattern (skill)

## EN

### When to use
- When creating or modifying scripts under `momentum/` that follow the wrapper/base structure.
- When refactoring a momentum analysis script to separate core logic (base) from configuration/paths (wrapper).
- When standardizing outputs (raw CSV, optional Parquet, safe Excel writes) and progress/status logging.

- **Wrapper + base pattern (momentum)**
  - Base modules expose `Config` + `run_analysis` (see `momentum/tree_10_optionsell_base.py`, `momentum/tree_11_optionsell_reversal_base.py`).
  - Wrappers import the base and only define constants + `main()` (see `momentum/tree_10_1_optionsell_momentum_atm.py`).
  - Outputs:
    - Always write a “raw” CSV and try to write Parquet, but gracefully skip Parquet if `pyarrow/fastparquet` isn’t installed (see `save_raw()` in `momentum/tree_10_optionsell_base.py`).
    - Excel writes use a temp file then `os.replace` to avoid corrupt partial outputs (`save_excel()` pattern).
  - Progress + status:
    - Long-running steps should print progress to console (existing pattern: `print(f"[{config.name}] ...")`).
    - On successful completion, print a clear success line that includes the primary output path(s) (existing pattern: `print(f"[{config.name}] Saved {config.output_excel}")`).
