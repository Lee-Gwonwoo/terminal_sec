from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser(description="Query OHLC rows from the single watchlist SQLite DB")
    ap.add_argument(
        "--db",
        type=Path,
        default=Path(r"C:\github_coding\terminal_sec\OHLC_data\ohlc_1d_watchlist.sqlite"),
    )
    ap.add_argument("--symbol", type=str, required=True)
    ap.add_argument(
        "--last",
        type=int,
        default=7,
        help="Print last N daily bars (ordered by Datetime desc).",
    )
    args = ap.parse_args()

    db_path: Path = args.db
    if not db_path.exists():
        raise SystemExit(f"DB not found: {db_path}")

    symbol = args.symbol.strip().upper()
    last_n = int(args.last)
    if last_n < 1:
        last_n = 1

    with sqlite3.connect(db_path) as con:
        con.row_factory = sqlite3.Row
        rows = con.execute(
            """
            SELECT Datetime, Open, High, Low, Close, Volume
            FROM ohlc_1d
            WHERE Symbol = ?
            ORDER BY Datetime DESC
            LIMIT ?
            """,
            (symbol, last_n),
        ).fetchall()

        if not rows:
            print(f"NO_ROWS symbol={symbol}")
            return 2

        # print oldest->newest for readability
        rows = list(reversed(rows))
        print("Datetime,Open,High,Low,Close,Volume")
        for r in rows:
            print(
                f"{r['Datetime']},{r['Open']},{r['High']},{r['Low']},{r['Close']},{r['Volume']}"
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
