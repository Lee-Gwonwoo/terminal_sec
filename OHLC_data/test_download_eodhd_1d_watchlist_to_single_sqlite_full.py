from __future__ import annotations

import argparse
import csv
import json
import queue
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
from datetime import date, datetime
from pathlib import Path

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
            industry = (r.get("Industry") or "").strip() or "UNKNOWN"
            if not symbol:
                continue
            rows.append(WatchlistRow(symbol=symbol, industry=industry))

    # stable de-dup by symbol (keep first industry)
    seen: set[str] = set()
    out: list[WatchlistRow] = []
    for r in rows:
        if r.symbol in seen:
            continue
        seen.add(r.symbol)
        out.append(r)
    return out


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


def _http_get_json(url: str, *, retries: int = 10, base_sleep_s: float = 0.25) -> object:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=60) as resp:
                body = resp.read().decode("utf-8")
            return json.loads(body)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last_err = e
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
    base = symbol.strip().upper()
    codes: list[str] = []

    # If already has exchange suffix, try as-is first
    if "." in base and base.endswith(".US"):
        codes.append(base)

    if "." in base:
        codes.append(base.replace(".", "-") + ".US")
    codes.append(base + ".US")

    seen: set[str] = set()
    out: list[str] = []
    for c in codes:
        if c in seen:
            continue
        seen.add(c)
        out.append(c)
    return out


def _num(v: object) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            return float(s)
        except ValueError:
            return None
    return None


def _fetch_1d_ohlc_range(
    *,
    token: str,
    symbol: str,
    from_date: date,
    to_date: date,
    rate_limiter: _GlobalRateLimiter,
) -> list[tuple[str, str, float | None, float | None, float | None, float | None, float | None]] | None:
    from_s = from_date.isoformat()
    to_s = to_date.isoformat()

    for code in _candidate_eod_codes(symbol):
        qp = urllib.parse.urlencode({"api_token": token, "fmt": "json", "from": from_s, "to": to_s})
        url = f"https://eodhd.com/api/eod/{urllib.parse.quote(code)}?{qp}"
        rate_limiter.wait()
        try:
            payload = _http_get_json(url)
        except urllib.error.HTTPError as e:
            if e.code in {400, 404, 422}:
                continue
            raise

        if isinstance(payload, dict) and payload.get("code") == "NotFound":
            continue
        if not isinstance(payload, list):
            continue
        if not payload:
            continue

        rows: list[tuple[str, str, float | None, float | None, float | None, float | None, float | None]] = []
        for r in payload:
            if not isinstance(r, dict):
                continue
            d = r.get("date")
            if not isinstance(d, str) or not d:
                continue
            # Keep as YYYY-MM-DD (daily candle)
            rows.append(
                (
                    symbol.strip().upper(),
                    d,
                    _num(r.get("open")),
                    _num(r.get("high")),
                    _num(r.get("low")),
                    _num(r.get("close")),
                    _num(r.get("volume")),
                )
            )

        if rows:
            rows.sort(key=lambda x: x[1])
            return rows

    return None


def _date_from_ymd(s: str) -> date:
    return datetime.strptime(s.strip(), "%Y-%m-%d").date()


def _iter_year_slices(year_start: int, year_end: int) -> list[tuple[date, date]]:
    if year_end < year_start:
        year_start, year_end = year_end, year_start
    slices: list[tuple[date, date]] = []
    for y in range(year_start, year_end + 1):
        slices.append((date(y, 1, 1), date(y, 12, 31)))
    return slices


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ohlc_1d (
            Symbol TEXT NOT NULL,
            Datetime TEXT NOT NULL,
            Open REAL,
            High REAL,
            Low REAL,
            Close REAL,
            Volume REAL,
            PRIMARY KEY (Symbol, Datetime)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS symbols (
            Symbol TEXT PRIMARY KEY,
            Industry TEXT
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ohlc_1d_dt ON ohlc_1d(Datetime)")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Download 1-day OHLCV history from EODHD (from a start date) for symbols in a TradingView watchlist CSV, "
            "and save into a single SQLite DB."
        )
    )
    ap.add_argument(
        "--watchlist",
        type=Path,
        default=Path(r"C:\github_coding\terminal_sec\tradigview_screener\watch lists2_2026-02-22.csv"),
    )
    ap.add_argument(
        "--token-path",
        type=Path,
        default=Path(r"C:\github_coding\terminal_sec\EODHD\API TOKEN"),
    )
    ap.add_argument(
        "--out-db",
        type=Path,
        default=Path(r"C:\github_coding\terminal_sec\OHLC_data\ohlc_1d_watchlist.sqlite"),
        help="Single SQLite file to write.",
    )
    ap.add_argument("--from", dest="from_date", type=str, default="2018-01-01")
    ap.add_argument("--to", dest="to_date", type=str, default="")
    ap.add_argument(
        "--yearly",
        action="store_true",
        help="If set, download year-by-year and skip years that error or return no data.",
    )
    ap.add_argument("--year-start", type=int, default=2010, help="Start year for --yearly mode.")
    ap.add_argument("--year-end", type=int, default=2017, help="End year for --yearly mode.")
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument(
        "--sleep-ms",
        type=int,
        default=120,
        help="Global minimum spacing between API calls across all workers (ms).",
    )
    ap.add_argument(
        "--max-symbols",
        type=int,
        default=0,
        help="If >0, limit processing to first N symbols (testing).",
    )
    ap.add_argument(
        "--progress-every",
        type=int,
        default=10,
        help="Print progress every N symbols (errors/NO_DATA always print).",
    )
    ap.add_argument(
        "--upsert-batch",
        type=int,
        default=5000,
        help="Executemany batch size for DB inserts.",
    )

    args = ap.parse_args(argv)

    from_date = _date_from_ymd(args.from_date)
    if args.to_date.strip():
        to_date = _date_from_ymd(args.to_date)
    else:
        to_date = _now_ny_date()

    rows = _read_watchlist_rows(Path(args.watchlist))
    if args.max_symbols and args.max_symbols > 0:
        rows = rows[: int(args.max_symbols)]

    token = _read_token(Path(args.token_path))

    out_db = Path(args.out_db)
    out_db.parent.mkdir(parents=True, exist_ok=True)

    max_workers = int(args.workers)
    if max_workers < 1:
        max_workers = 1

    rate_limiter = _GlobalRateLimiter(min_interval_s=max(0.0, float(args.sleep_ms) / 1000.0))

    # Writer queue: each item is (symbol, industry, rows) or sentinel None
    q: queue.Queue[tuple[str, str, list[tuple[str, str, float | None, float | None, float | None, float | None, float | None]]] | None] = queue.Queue(
        maxsize=max_workers * 2
    )

    progress_lock = threading.Lock()

    def _log(msg: str) -> None:
        with progress_lock:
            print(msg)

    total = len(rows)
    t0 = time.perf_counter()

    ok_symbols = 0
    no_data_symbols = 0
    error_symbols = 0

    ok_rows = 0

    def _writer() -> None:
        nonlocal ok_rows
        with sqlite3.connect(out_db) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA temp_store=MEMORY")
            _ensure_schema(conn)

            batch_size = int(args.upsert_batch)
            if batch_size < 100:
                batch_size = 100

            while True:
                item = q.get()
                if item is None:
                    break
                symbol, industry, data_rows = item

                conn.execute("INSERT OR REPLACE INTO symbols(Symbol, Industry) VALUES (?, ?)", (symbol, industry))

                if not data_rows:
                    conn.commit()
                    continue

                # Upsert in batches
                sql = (
                    "INSERT OR REPLACE INTO ohlc_1d(Symbol, Datetime, Open, High, Low, Close, Volume) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)"
                )
                for i in range(0, len(data_rows), batch_size):
                    chunk = data_rows[i : i + batch_size]
                    conn.executemany(sql, chunk)
                    ok_rows += len(chunk)
                conn.commit()

    writer_thread = threading.Thread(target=_writer, name="sqlite-writer", daemon=True)
    writer_thread.start()

    def _download_one(
        wr: WatchlistRow,
    ) -> tuple[
        str,
        str,
        list[tuple[str, str, float | None, float | None, float | None, float | None, float | None]] | None,
        str | None,
    ]:
        symbol = wr.symbol.strip().upper()
        industry = wr.industry

        if not bool(args.yearly):
            try:
                data = _fetch_1d_ohlc_range(
                    token=token,
                    symbol=symbol,
                    from_date=from_date,
                    to_date=to_date,
                    rate_limiter=rate_limiter,
                )
                return (symbol, industry, data, None)
            except Exception as e:
                return (symbol, industry, None, f"{type(e).__name__}: {e}")

        # yearly mode: skip individual years that fail or have no data
        all_rows: list[
            tuple[str, str, float | None, float | None, float | None, float | None, float | None]
        ] = []
        had_any = False
        for y_from, y_to in _iter_year_slices(int(args.year_start), int(args.year_end)):
            try:
                year_rows = _fetch_1d_ohlc_range(
                    token=token,
                    symbol=symbol,
                    from_date=y_from,
                    to_date=y_to,
                    rate_limiter=rate_limiter,
                )
                if not year_rows:
                    continue
                had_any = True
                all_rows.extend(year_rows)
            except Exception as e:
                if isinstance(e, urllib.error.HTTPError) and int(getattr(e, "code", 0)) in (401, 403):
                    # Token/auth issues are not "skippable years"; fail fast.
                    raise
                # Skip this year only
                continue

        if not had_any:
            return (symbol, industry, [], None)

        # De-dup by Datetime just in case (Symbol, Datetime) is the DB key anyway.
        best_by_dt: dict[str, tuple[str, str, float | None, float | None, float | None, float | None, float | None]] = {}
        for r in all_rows:
            best_by_dt[r[1]] = r
        merged = list(best_by_dt.values())
        merged.sort(key=lambda x: x[1])
        return (symbol, industry, merged, None)

    done = 0
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = [ex.submit(_download_one, wr) for wr in rows]
        for fut in as_completed(futures):
            symbol, industry, data, err = fut.result()
            done += 1

            if err is not None:
                error_symbols += 1
                _log(f"[{done}/{total}] {symbol}: ERROR {err}")
                # Still record symbol meta
                q.put((symbol, industry, []))
                continue

            if not data:
                no_data_symbols += 1
                _log(f"[{done}/{total}] {symbol}: NO_DATA")
                q.put((symbol, industry, []))
                continue

            ok_symbols += 1
            if args.progress_every <= 1 or (done % int(args.progress_every) == 0) or done == total:
                _log(f"[{done}/{total}] {symbol}: OK rows={len(data)}")
            q.put((symbol, industry, data))

    q.put(None)
    writer_thread.join()

    elapsed_s = max(1e-9, time.perf_counter() - t0)
    sym_per_s = total / elapsed_s
    rows_per_s = ok_rows / elapsed_s

    print(
        "DONE. "
        f"symbols_total={total} ok_symbols={ok_symbols} no_data_symbols={no_data_symbols} error_symbols={error_symbols} "
        f"rows_written={ok_rows} out_db={out_db} workers={max_workers} sleep_ms={int(args.sleep_ms)} "
        f"elapsed_s={elapsed_s:.2f} sym_per_s={sym_per_s:.3f} rows_per_s={rows_per_s:.1f}"
    )

    return 0 if error_symbols == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
