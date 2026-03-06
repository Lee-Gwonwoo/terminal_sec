# Deep learning trainers (skill)

## EN

### When to use
- When building or refactoring deep-learning training/labeling pipelines (especially multi-head or multi-case trainers).
- When you need to avoid repeated expensive computation by deduplicating shared intermediates.
- When you are introducing/maintaining preset selection (e.g., `active_cases`) and need clear compatibility/documentation rules.

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
