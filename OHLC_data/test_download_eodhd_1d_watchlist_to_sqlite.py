from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable

try:
    from zoneinfo import ZoneInfo  # py3.9+
except Exception:  # pragma: no cover
    ZoneInfo = None  # type: ignore


NY_TZ_NAME = "America/New_York"


def _now_ny_date() -> date:
    if ZoneInfo is None:
        return datetime.utcnow().date()
    return datetime.now(tz=ZoneInfo(NY_TZ_NAME)).date()


def _read_token(token_path: Path) -> str:
    token = token_path.read_text(encoding="utf-8").strip()
    if not token:
        raise RuntimeError(f"Empty EODHD token file: {token_path}")
    return token


_INVALID_WIN_CHARS_RE = re.compile(r'[<>:"/\\|?*]+')


class _GlobalRateLimiter:
    def __init__(self, min_interval_s: float) -> None:
        self._min_interval_s = float(min_interval_s)
        self._lock = threading.Lock()
        self._next_ok = time.monotonic()

    def wait(self) -> None:
        if self._min_interval_s <= 0:
            return
        with self._lock:
            now = time.monotonic()
            if now < self._next_ok:
                time.sleep(self._next_ok - now)
                now = time.monotonic()
            self._next_ok = now + self._min_interval_s


def _sanitize_folder_name(name: str, max_len: int = 80) -> str:
    name = name.strip()
    name = _INVALID_WIN_CHARS_RE.sub("_", name)
    name = re.sub(r"\s+", "_", name)
    name = re.sub(r"_+", "_", name)
    name = name.strip("._ ")
    if not name:
        name = "UNKNOWN"
    if len(name) > max_len:
        name = name[:max_len].rstrip("._ ")
    return name


@dataclass(frozen=True)
class WatchlistRow:
    symbol: str
    industry: str


def _read_watchlist_rows(csv_path: Path) -> list[WatchlistRow]:
    rows: list[WatchlistRow] = []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            raise RuntimeError(f"No header found in {csv_path}")
        if "Symbol" not in reader.fieldnames:
            raise RuntimeError(f"Missing 'Symbol' column in {csv_path}")
        if "Industry" not in reader.fieldnames:
            raise RuntimeError(f"Missing 'Industry' column in {csv_path}")

        for r in reader:
            symbol = (r.get("Symbol") or "").strip()
            industry = (r.get("Industry") or "").strip()
            if not symbol:
                continue
            if not industry:
                industry = "UNKNOWN"
            rows.append(WatchlistRow(symbol=symbol, industry=industry))

    # stable + de-dup by (symbol, industry)
    seen: set[tuple[str, str]] = set()
    out: list[WatchlistRow] = []
    for r in rows:
        key = (r.symbol, r.industry)
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def _http_get_json(url: str, *, retries: int = 10, base_sleep_s: float = 0.25) -> object:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                body = resp.read().decode("utf-8")
            return json.loads(body)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last_err = e
            # Fail fast on auth-like HTTP status
            if isinstance(e, urllib.error.HTTPError) and e.code in {401, 403}:
                raise
            if attempt >= retries:
                break
            sleep_s = base_sleep_s * (1.7 ** (attempt - 1))
            sleep_s = min(5.0, sleep_s) + random.random() * 0.1
            time.sleep(sleep_s)

    assert last_err is not None
    raise last_err


def _candidate_eod_codes(symbol: str) -> list[str]:
    # EODHD typically uses e.g. AAPL.US for US stocks.
    # Some class-share tickers use '-' instead of '.' (e.g., BRK-B).
    base = symbol.strip().upper()
    codes: list[str] = []

    if "." in base:
        codes.append(base.replace(".", "-") + ".US")
    codes.append(base + ".US")

    # If user already provided an exchange suffix (e.g., 0700.HK), keep it as-is.
    if "." in base and base.endswith(".US"):
        codes.insert(0, base)

    # de-dup preserving order
    seen: set[str] = set()
    out: list[str] = []
    for c in codes:
        if c in seen:
            continue
        seen.add(c)
        out.append(c)
    return out


def _fetch_latest_1d_ohlc(
    *,
    token: str,
    symbol: str,
    from_date: date,
    to_date: date,
    rate_limiter: _GlobalRateLimiter | None = None,
) -> dict[str, object] | None:
    # Try multiple symbol code variants (e.g. BRK.B -> BRK-B.US)
    from_s = from_date.isoformat()
    to_s = to_date.isoformat()

    for code in _candidate_eod_codes(symbol):
        qp = urllib.parse.urlencode(
            {
                "api_token": token,
                "fmt": "json",
                "from": from_s,
                "to": to_s,
            }
        )
        url = f"https://eodhd.com/api/eod/{urllib.parse.quote(code)}?{qp}"

        if rate_limiter is not None:
            rate_limiter.wait()
        try:
            payload = _http_get_json(url)
        except urllib.error.HTTPError as e:
            # Try next code for 404/400; fail fast for auth.
            if e.code in {400, 404, 422}:
                continue
            raise

        if isinstance(payload, dict) and payload.get("code") == "NotFound":
            continue

        if not isinstance(payload, list):
            # Sometimes EODHD returns an error object; treat as no data.
            continue

        if not payload:
            continue

        # Pick last bar by date
        latest = None
        latest_date = None
        for row in payload:
            if not isinstance(row, dict):
                continue
            d = row.get("date")
            if not isinstance(d, str) or not d:
                continue
            try:
                dd = datetime.strptime(d, "%Y-%m-%d").date()
            except ValueError:
                continue
            if (latest_date is None) or (dd > latest_date):
                latest_date = dd
                latest = row

        if latest is None or latest_date is None:
            continue

        def _num(v: object) -> float | None:
            if v is None:
                return None
            if isinstance(v, (int, float)):
                return float(v)
            if isinstance(v, str):
                v = v.strip()
                if not v:
                    return None
                try:
                    return float(v)
                except ValueError:
                    return None
            return None

        out = {
            "Datetime": latest_date.isoformat(),
            "Open": _num(latest.get("open")),
            "High": _num(latest.get("high")),
            "Low": _num(latest.get("low")),
            "Close": _num(latest.get("close")),
            "Volume": _num(latest.get("volume")),
        }
        return out

    return None


def _ensure_symbol_table(conn: sqlite3.Connection, table: str) -> None:
    # Table per symbol, with required columns only.
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS "{table}" (
            Datetime TEXT PRIMARY KEY,
            Open REAL,
            High REAL,
            Low REAL,
            Close REAL,
            Volume REAL
        )
        """
    )


def _upsert_row(conn: sqlite3.Connection, table: str, row: dict[str, object]) -> None:
    conn.execute(
        f"""
        INSERT OR REPLACE INTO "{table}" (Datetime, Open, High, Low, Close, Volume)
        VALUES (?, ?, ?, ?, ?, ?)
        """ ,
        (
            row.get("Datetime"),
            row.get("Open"),
            row.get("High"),
            row.get("Low"),
            row.get("Close"),
            row.get("Volume"),
        ),
    )


def _safe_table_name(symbol: str) -> str:
    # SQLite table names: keep simple, uppercase, replace non-alnum with '_'
    s = symbol.strip().upper()
    s = re.sub(r"[^A-Z0-9]+", "_", s)
    s = s.strip("_")
    if not s:
        s = "UNKNOWN"
    return s


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Download latest 1-day OHLC from EODHD for symbols in a TradingView watchlist CSV, "
            "and save into SQLite DBs grouped by Industry folders."
        )
    )
    ap.add_argument(
        "--watchlist",
        type=Path,
        default=Path(r"C:\github_coding\terminal_sec\tradigview_screener\watch lists2_2026-02-22.csv"),
    )
    ap.add_argument(
        "--out-root",
        type=Path,
        default=Path(r"C:\github_coding\terminal_sec\OHLC_data"),
    )
    ap.add_argument(
        "--base-dir-name",
        type=str,
        default="sqlite_by_industry",
        help="Subfolder under out-root to store per-industry SQLite DBs.",
    )
    ap.add_argument(
        "--token-path",
        type=Path,
        default=Path(r"C:\github_coding\terminal_sec\EODHD\API TOKEN"),
    )
    ap.add_argument(
        "--days-lookback",
        type=int,
        default=14,
        help="Calendar days to look back when fetching latest bar (handles weekends/holidays).",
    )
    ap.add_argument(
        "--max-symbols",
        type=int,
        default=0,
        help="If >0, limit processing to first N watchlist rows (smoke tests).",
    )
    ap.add_argument(
        "--sleep-ms",
        type=int,
        default=150,
        help="Global minimum spacing between API calls across all workers (ms).",
    )
    ap.add_argument(
        "--workers",
        type=int,
        default=6,
        help="Number of parallel industry workers. Increase carefully to avoid EODHD rate limits.",
    )
    ap.add_argument(
        "--commit-every",
        type=int,
        default=25,
        help="Commit every N successful upserts per DB (reduces SQLite overhead).",
    )
    ap.add_argument(
        "--progress-every",
        type=int,
        default=1,
        help="Print progress every N symbols (1=print all). Errors/NO_DATA always print.",
    )

    args = ap.parse_args(argv)

    watchlist_path: Path = args.watchlist
    out_root: Path = args.out_root
    token_path: Path = args.token_path

    rows = _read_watchlist_rows(watchlist_path)
    if args.max_symbols and args.max_symbols > 0:
        rows = rows[: args.max_symbols]

    token = _read_token(token_path)

    ny_today = _now_ny_date()
    from_date = ny_today - timedelta(days=int(args.days_lookback))
    to_date = ny_today

    t0 = time.perf_counter()

    base_dir = out_root / str(args.base_dir_name)
    base_dir.mkdir(parents=True, exist_ok=True)

    # group by industry (preserve stable order)
    by_industry: dict[str, list[str]] = {}
    for r in rows:
        by_industry.setdefault(r.industry, []).append(r.symbol)

    total = sum(len(v) for v in by_industry.values())

    # Parallelism model:
    # - One worker per industry group (up to --workers).
    # - Each worker writes to its own SQLite DB file (no cross-thread writes to same DB).
    # - A global rate limiter controls total request rate across all workers.
    max_workers = int(args.workers)
    if max_workers < 1:
        max_workers = 1

    rate_limiter = _GlobalRateLimiter(min_interval_s=max(0.0, float(args.sleep_ms) / 1000.0))

    progress_lock = threading.Lock()
    counter_lock = threading.Lock()
    done = 0
    ok = 0
    no_data = 0
    errors = 0

    def _log(msg: str) -> None:
        with progress_lock:
            print(msg)

    def _process_industry(industry: str, symbols: list[str]) -> tuple[str, int, int, int]:
        nonlocal done, ok, no_data, errors
        local_ok = 0
        local_no_data = 0
        local_errors = 0

        industry_dir = base_dir / _sanitize_folder_name(industry)
        industry_dir.mkdir(parents=True, exist_ok=True)
        db_path = industry_dir / "ohlc_1d.sqlite"

        commit_every = int(args.commit_every)
        if commit_every < 1:
            commit_every = 1
        pending = 0

        with sqlite3.connect(db_path) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")

            for sym in symbols:
                table = _safe_table_name(sym)

                status_msg = ""
                try:
                    bar = _fetch_latest_1d_ohlc(
                        token=token,
                        symbol=sym,
                        from_date=from_date,
                        to_date=to_date,
                        rate_limiter=rate_limiter,
                    )

                    if bar is None:
                        local_no_data += 1
                        with counter_lock:
                            no_data += 1
                        status_msg = "NO_DATA"
                    else:
                        _ensure_symbol_table(conn, table)
                        _upsert_row(conn, table, bar)
                        pending += 1
                        local_ok += 1
                        with counter_lock:
                            ok += 1
                        if pending >= commit_every:
                            conn.commit()
                            pending = 0
                        status_msg = f"OK {bar['Datetime']}"
                except Exception as e:
                    local_errors += 1
                    with counter_lock:
                        errors += 1
                    status_msg = f"ERROR {type(e).__name__}: {e}"
                finally:
                    with counter_lock:
                        done += 1
                        cur_done = done

                    progress_every = int(args.progress_every)
                    must_print = False
                    if progress_every <= 1:
                        must_print = True
                    elif status_msg.startswith("ERROR") or status_msg == "NO_DATA":
                        must_print = True
                    elif (cur_done % progress_every) == 0 or cur_done == total:
                        must_print = True

                    if must_print:
                        _log(f"[{cur_done}/{total}] {sym} ({industry}): {status_msg}")

            if pending:
                conn.commit()

        return (industry, local_ok, local_no_data, local_errors)

    futures = []
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        for industry, symbols in by_industry.items():
            futures.append(ex.submit(_process_industry, industry, symbols))

        # Drain futures to surface any unexpected worker crashes.
        for fut in as_completed(futures):
            _ = fut.result()

    failures = no_data + errors
    elapsed_s = max(1e-9, time.perf_counter() - t0)
    sym_per_s = total / elapsed_s
    print(
        f"DONE. total={total} ok={ok} no_data={no_data} errors={errors} failures={failures} out={base_dir} "
        f"workers={max_workers} sleep_ms={int(args.sleep_ms)} elapsed_s={elapsed_s:.2f} sym_per_s={sym_per_s:.3f}"
    )
    return 0 if failures == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
