# Indicator calculators (deep_learning_data) (skill)

## EN

### When to use
- When implementing or updating scripts under `deep_learning_data/indicator_calculator/`.
- When adding features/indicators by appending columns to a pandas DataFrame (no row drops; warmup rows may be `NaN`).
- When you need consistent logging, error visibility (`logger.exception`), and periodic progress reporting for large inputs.

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
