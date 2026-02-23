"""Flag ambiguous tickers and generate safer news search queries.

Why:
- Some tickers (e.g., COIN, APP, T) are also common words/abbreviations.
- If you search in a general search engine, queries can accidentally match the word meaning
  (coin/crypto, app/application, letter T) rather than the stock.

This script reads a TradingView-export style CSV (must contain Symbol, Description columns)
and outputs a CSV report with ambiguity flags + suggested query templates.

Usage (PowerShell):
  python tradigview_screener\test_flag_ambiguous_tickers_and_queries.py \
    --input tradigview_screener\original_data\watch\ lists2_2026-02-22.csv \
    --out tradigview_screener\original_data\watch_lists2_2026-02-22_search_queries.csv

Notes:
- This does NOT call any search engine.
- It produces query strings you can paste into Google/News/etc.
"""

from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


COMMON_WORD_TICKERS = {
    # High-risk examples (common English words / generic terms)
    "APP",
    "NOW",
    "SHOP",
    "TEAM",
    "NET",
    "OPEN",
    "CASH",
    "COIN",
    "MOVE",
    "GAIN",
    "FAST",
    "RISK",
    "SAFE",
    "PATH",
    "REAL",
    "LOVE",
    "LIFE",
    # Single-letter / two-letter are inherently ambiguous
    "A",
    "I",
    "T",
    "F",
    "C",
    "GM",
    "AI",
}

COMPANY_SUFFIX_RE = re.compile(
    r"\b(inc\.|incorporated|corp\.|corporation|plc\.?|ltd\.?|limited|holdings?|group|company|co\.|s\.a\.|sa|ag|nv)\b",
    flags=re.IGNORECASE,
)

PARENS_RE = re.compile(r"\s*\([^)]*\)\s*")
WHITESPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class Row:
    symbol: str
    description: str


def _clean_company_name(description: str) -> str:
    s = (description or "").strip()
    if not s:
        return ""

    # Drop parenthetical suffixes like "(The)".
    s = PARENS_RE.sub(" ", s)

    # If the description is "Foo, Inc." keep full, but also provide a short form later.
    s = s.replace("\"", "").strip()
    s = WHITESPACE_RE.sub(" ", s)
    return s


def _short_company_name(full: str) -> str:
    s = (full or "").strip()
    if not s:
        return ""

    # Remove common suffix tokens.
    s2 = COMPANY_SUFFIX_RE.sub(" ", s)
    s2 = WHITESPACE_RE.sub(" ", s2).strip(" ,")

    # Avoid returning an empty string.
    return s2 if s2 else s


def _is_ambiguous_symbol(symbol: str) -> tuple[bool, str]:
    sym = symbol.strip().upper()
    if not sym:
        return True, "empty"

    if len(sym) <= 2:
        return True, f"length<=2 ({len(sym)})"

    if not re.fullmatch(r"[A-Z]{1,6}", sym):
        return True, "non-alpha / non-standard"

    if sym in COMMON_WORD_TICKERS:
        return True, "common-word-ticker"

    # Heuristic: very short 3-letter words are often ambiguous.
    if len(sym) == 3 and sym.isalpha():
        return True, "short-3-letter"

    return False, ""


def _build_queries(symbol: str, company_full: str, company_short: str) -> tuple[str, str, str]:
    """Return (strict, balanced, broad) query strings."""

    sym = symbol.strip().upper()
    full = company_full.strip()
    short = company_short.strip()

    # Strict: tries to force stock context and disambiguate common words.
    # - Prefer quoted ticker, and require either exchange-tag or company name.
    # - Adds stock context words to reduce crypto/word-meaning matches.
    strict_parts = []
    strict_parts.append(f'("{sym}" OR "{sym} stock" OR "NASDAQ:{sym}" OR "NYSE:{sym}")')
    if short and short.upper() != sym:
        strict_parts.append(f'( "{short}" OR "{full}" )')
    strict_parts.append("(stock OR shares OR earnings OR guidance OR SEC)")
    strict = " ".join(strict_parts)

    # Balanced: company name + ticker co-occurrence, lighter constraints.
    balanced_parts = []
    if short:
        balanced_parts.append(f'( "{short}" OR "{full}" )')
    balanced_parts.append(f'( "{sym}" OR "{sym} stock" )')
    balanced_parts.append("(news OR earnings OR results OR filing)")
    balanced = " ".join(balanced_parts)

    # Broad: company only (fallback if ticker is too noisy / missing).
    broad = f'"{short or full}" (stock OR shares OR earnings OR guidance OR SEC)'

    return strict, balanced, broad


def _iter_rows(csv_path: Path) -> Iterable[Row]:
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError("CSV has no header row")

        # TradingView exports usually use 'Symbol' and 'Description'.
        # Be permissive for minor variations.
        fields = {name.strip().lower(): name for name in reader.fieldnames}
        sym_key = fields.get("symbol")
        desc_key = fields.get("description")
        if not sym_key or not desc_key:
            raise ValueError(
                "CSV must include columns 'Symbol' and 'Description'. "
                f"Found: {reader.fieldnames}"
            )

        for row in reader:
            symbol = (row.get(sym_key) or "").strip()
            desc = (row.get(desc_key) or "").strip()
            if symbol:
                yield Row(symbol=symbol, description=desc)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="Input TradingView watchlist CSV")
    ap.add_argument("--out", required=True, help="Output CSV report path")
    args = ap.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.out)

    rows = list(_iter_rows(in_path))

    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "Symbol",
                "Description",
                "CompanyFull",
                "CompanyShort",
                "Ambiguous",
                "AmbiguityReason",
                "QueryStrict",
                "QueryBalanced",
                "QueryBroad",
            ],
        )
        writer.writeheader()

        for r in rows:
            symbol = r.symbol.strip().upper()
            company_full = _clean_company_name(r.description)
            company_short = _short_company_name(company_full)

            ambiguous, reason = _is_ambiguous_symbol(symbol)
            q_strict, q_balanced, q_broad = _build_queries(symbol, company_full, company_short)

            writer.writerow(
                {
                    "Symbol": symbol,
                    "Description": r.description,
                    "CompanyFull": company_full,
                    "CompanyShort": company_short,
                    "Ambiguous": "YES" if ambiguous else "",
                    "AmbiguityReason": reason,
                    "QueryStrict": q_strict,
                    "QueryBalanced": q_balanced,
                    "QueryBroad": q_broad,
                }
            )

    ambiguous_count = sum(1 for r in rows if _is_ambiguous_symbol(r.symbol)[0])
    print(f"Read {len(rows)} tickers; flagged {ambiguous_count} as ambiguous")
    print(f"Wrote: {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
