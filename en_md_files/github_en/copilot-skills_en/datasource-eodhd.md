# EODHD rules (skill)

## EN

### When to use
- When writing or editing scripts that download, normalize, or store market data via EODHD.
- When saving EODHD-derived datasets under `original_data/` or under `EODHD/<symbol>/` and you need to follow the repo’s strict timestamp/column/token rules.

- **EODHD rules are strict**
  - Follow `EODHD/INSTRUCTION.txt`:
    - All saved timestamps must be `America/New_York` local time.
    - Do **not** include `Timestamp` in saved outputs (drop it before saving).
    - Read the API token from `EODHD/API TOKEN`.
    - Put symbol-specific code + outputs under `EODHD/<symbol>/`.
