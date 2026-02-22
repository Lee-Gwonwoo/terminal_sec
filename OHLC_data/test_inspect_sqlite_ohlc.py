from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser(description="Inspect an OHLC SQLite DB created by test_download_eodhd_1d_watchlist_to_sqlite.py")
    ap.add_argument(
        "--db",
        type=Path,
        default=Path(r"C:\github_coding\terminal_sec\OHLC_data\sqlite_by_industry\Semiconductors\ohlc_1d.sqlite"),
    )
    ap.add_argument("--table", type=str, default="TXN")
    args = ap.parse_args()

    if not args.db.exists():
        raise SystemExit(f"DB not found: {args.db}")

    with sqlite3.connect(args.db) as con:
        tables = [
            r[0]
            for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
        ]
        print(f"db={args.db}")
        print(f"tables_count={len(tables)}")
        print("tables_first10=", tables[:10])

        table = args.table.strip().upper()
        if table not in tables:
            print(f"table_not_found={table}")
            return 2

        count = con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        last = con.execute(
            f'SELECT Datetime, Open, High, Low, Close, Volume FROM "{table}" ORDER BY Datetime DESC LIMIT 1'
        ).fetchone()
        print(f"{table}_rows={count}")
        print(f"{table}_last={last}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
