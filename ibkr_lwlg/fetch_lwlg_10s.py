from __future__ import annotations

import argparse
import asyncio
import csv
import datetime as dt
import json
import math
import sys
from pathlib import Path
from typing import Any

from ib_insync import IB, Option, Stock


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = SCRIPT_DIR / "data"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch LWLG 10-second stock and option bars from IBKR Gateway/TWS.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4001)
    parser.add_argument("--client-id", type=int, default=191)
    parser.add_argument("--symbol", default="LWLG")
    parser.add_argument("--expiry", default="20260618")
    parser.add_argument("--right", default="C", choices=["C", "P"])
    parser.add_argument("--strikes", default="15,20", help="Comma-separated strikes, e.g. 15,20")
    parser.add_argument("--days", type=int, default=31)
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD. Defaults to today.")
    parser.add_argument("--bar-size", default="10 secs")
    parser.add_argument("--duration", default="14400 S", help="IBKR duration per chunk. 14400 S is valid for 10 secs bars.")
    parser.add_argument("--sleep-sec", type=float, default=1.0)
    parser.add_argument("--max-retries", type=int, default=10)
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    parser.add_argument("--include-non-rth", action="store_true", help="Use all available hours instead of RTH chunks.")
    parser.add_argument("--skip-stock", action="store_true")
    parser.add_argument("--skip-options", action="store_true")
    parser.add_argument("--probe-only", action="store_true", help="Only connect, qualify contracts, and write a probe summary.")
    return parser.parse_args()


def parse_strikes(raw: str) -> list[float]:
    strikes: list[float] = []
    for part in raw.split(","):
        value = part.strip()
        if value:
            strikes.append(float(value))
    return strikes


def date_window(end_date_raw: str | None, days: int) -> tuple[dt.date, dt.date]:
    if end_date_raw:
        end_date = dt.date.fromisoformat(end_date_raw)
    else:
        end_date = dt.date.today()
    start_date = end_date - dt.timedelta(days=max(days - 1, 0))
    return start_date, end_date


def iter_dates(start_date: dt.date, end_date: dt.date) -> list[dt.date]:
    dates: list[dt.date] = []
    current = start_date
    while current <= end_date:
        dates.append(current)
        current += dt.timedelta(days=1)
    return dates


def chunk_end_times(day: dt.date, include_non_rth: bool) -> list[str]:
    if not include_non_rth:
        return [
            day.strftime("%Y%m%d") + " 13:30:00 US/Eastern",
            day.strftime("%Y%m%d") + " 16:00:00 US/Eastern",
        ]
    return [day.strftime("%Y%m%d") + f" {hour:02d}:00:00 US/Eastern" for hour in (4, 8, 12, 16, 20, 23)]


def normalize_timestamp(value: Any) -> str:
    if isinstance(value, dt.datetime):
        return value.isoformat()
    return str(value)


def finite_or_blank(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, float) and not math.isfinite(value):
        return ""
    return value


def bar_to_row(bar: Any, contract: Any, what_to_show: str, symbol: str) -> dict[str, Any]:
    return {
        "timestamp": normalize_timestamp(bar.date),
        "symbol": symbol,
        "sec_type": getattr(contract, "secType", ""),
        "expiry": getattr(contract, "lastTradeDateOrContractMonth", "") or "",
        "right": getattr(contract, "right", "") or "",
        "strike": finite_or_blank(getattr(contract, "strike", "")),
        "what_to_show": what_to_show,
        "open": finite_or_blank(float(bar.open)),
        "high": finite_or_blank(float(bar.high)),
        "low": finite_or_blank(float(bar.low)),
        "close": finite_or_blank(float(bar.close)),
        "volume": finite_or_blank(getattr(bar, "volume", "")),
        "bar_count": finite_or_blank(getattr(bar, "barCount", "")),
        "wap": finite_or_blank(getattr(bar, "average", "")),
        "contract_con_id": getattr(contract, "conId", "") or "",
        "local_symbol": getattr(contract, "localSymbol", "") or "",
    }


def dedupe_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key: dict[tuple[Any, ...], dict[str, Any]] = {}
    for row in rows:
        key = (
            row.get("timestamp"),
            row.get("symbol"),
            row.get("sec_type"),
            row.get("expiry"),
            row.get("right"),
            str(row.get("strike")),
            row.get("what_to_show"),
        )
        by_key[key] = row
    return [by_key[key] for key in sorted(by_key)]


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "timestamp",
        "symbol",
        "sec_type",
        "expiry",
        "right",
        "strike",
        "what_to_show",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "bar_count",
        "wap",
        "contract_con_id",
        "local_symbol",
    ]
    with path.open("w", newline="", encoding="utf-8") as file_obj:
        writer = csv.DictWriter(file_obj, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


async def request_bars_with_retry(
    ib: IB,
    contract: Any,
    end_datetime: str,
    duration: str,
    bar_size: str,
    what_to_show: str,
    use_rth: bool,
    max_retries: int,
) -> list[Any]:
    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            bars = await ib.reqHistoricalDataAsync(
                contract,
                endDateTime=end_datetime,
                durationStr=duration,
                barSizeSetting=bar_size,
                whatToShow=what_to_show,
                useRTH=use_rth,
                formatDate=2,
                keepUpToDate=False,
                timeout=90,
            )
            return list(bars)
        except Exception as exc:
            last_error = exc
            lowered = str(exc).lower()
            if "no security definition" in lowered or "invalid" in lowered:
                raise
            await asyncio.sleep(min(0.5 * attempt, 5.0))
    if last_error is not None:
        raise last_error
    return []


async def fetch_contract_rows(
    ib: IB,
    contract: Any,
    symbol: str,
    what_to_show: str,
    start_date: dt.date,
    end_date: dt.date,
    args: argparse.Namespace,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rows: list[dict[str, Any]] = []
    request_log: list[dict[str, Any]] = []
    use_rth = not args.include_non_rth
    for day in iter_dates(start_date, end_date):
        for end_datetime in chunk_end_times(day, args.include_non_rth):
            status = "ok"
            error = ""
            count = 0
            try:
                bars = await request_bars_with_retry(
                    ib,
                    contract,
                    end_datetime=end_datetime,
                    duration=args.duration,
                    bar_size=args.bar_size,
                    what_to_show=what_to_show,
                    use_rth=use_rth,
                    max_retries=args.max_retries,
                )
                for bar in bars:
                    rows.append(bar_to_row(bar, contract, what_to_show, symbol))
                count = len(bars)
            except Exception as exc:
                status = "error"
                error = str(exc)
            request_log.append({
                "contract": getattr(contract, "localSymbol", "") or getattr(contract, "symbol", symbol),
                "what_to_show": what_to_show,
                "end_datetime": end_datetime,
                "status": status,
                "count": count,
                "error": error,
            })
            await asyncio.sleep(args.sleep_sec)
    return dedupe_rows(rows), request_log


async def resolve_expiry(ib: IB, stock_contract: Any, requested_expiry: str, strikes: list[float]) -> tuple[str, dict[str, Any]]:
    chains = await ib.reqSecDefOptParamsAsync(stock_contract.symbol, "", stock_contract.secType, stock_contract.conId)
    expiries: set[str] = set()
    available_strikes: set[float] = set()
    for chain in chains:
        expiries.update(chain.expirations)
        available_strikes.update(float(strike) for strike in chain.strikes)
    selected_expiry = requested_expiry
    if requested_expiry not in expiries:
        requested_date = dt.datetime.strptime(requested_expiry, "%Y%m%d").date()
        same_month = []
        for expiry in expiries:
            expiry_date = dt.datetime.strptime(expiry, "%Y%m%d").date()
            if expiry_date.year == requested_date.year and expiry_date.month == requested_date.month:
                same_month.append(expiry)
        if same_month:
            selected_expiry = min(same_month, key=lambda expiry: abs((dt.datetime.strptime(expiry, "%Y%m%d").date() - requested_date).days))
    missing_strikes = [strike for strike in strikes if strike not in available_strikes]
    return selected_expiry, {
        "requested_expiry": requested_expiry,
        "selected_expiry": selected_expiry,
        "requested_expiry_exists": requested_expiry in expiries,
        "available_expiries_near_month": sorted(expiry for expiry in expiries if expiry[:6] == requested_expiry[:6]),
        "missing_strikes": missing_strikes,
    }


async def main() -> int:
    args = parse_args()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    start_date, end_date = date_window(args.end_date, args.days)
    strikes = parse_strikes(args.strikes)
    errors: list[dict[str, Any]] = []

    ib = IB()

    def on_error(req_id: int, error_code: int, error_string: str, contract: Any) -> None:
        errors.append({
            "req_id": req_id,
            "code": error_code,
            "message": error_string,
            "contract": getattr(contract, "localSymbol", "") if contract else "",
        })

    ib.errorEvent += on_error
    await ib.connectAsync(args.host, args.port, clientId=args.client_id, timeout=15, readonly=True)

    try:
        stock = Stock(args.symbol, "SMART", "USD")
        qualified_stocks = await ib.qualifyContractsAsync(stock)
        if not qualified_stocks:
            raise RuntimeError(f"Failed to qualify stock contract: {args.symbol}")
        stock_contract = qualified_stocks[0]
        selected_expiry, chain_info = await resolve_expiry(ib, stock_contract, args.expiry, strikes)

        option_contracts: list[Any] = []
        if not args.skip_options:
            for strike in strikes:
                option = Option(args.symbol, selected_expiry, strike, args.right, "SMART", currency="USD", multiplier="100")
                qualified_options = await ib.qualifyContractsAsync(option)
                if qualified_options:
                    option_contracts.append(qualified_options[0])
                else:
                    errors.append({"req_id": -1, "code": "qualify", "message": f"Option qualify failed strike={strike}", "contract": ""})

        summary: dict[str, Any] = {
            "host": args.host,
            "port": args.port,
            "symbol": args.symbol,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "bar_size": args.bar_size,
            "duration": args.duration,
            "use_rth": not args.include_non_rth,
            "chain_info": chain_info,
            "stock_contract": {
                "con_id": stock_contract.conId,
                "local_symbol": getattr(stock_contract, "localSymbol", ""),
                "exchange": getattr(stock_contract, "exchange", ""),
            },
            "option_contracts": [
                {
                    "con_id": contract.conId,
                    "local_symbol": contract.localSymbol,
                    "expiry": contract.lastTradeDateOrContractMonth,
                    "strike": contract.strike,
                    "right": contract.right,
                    "exchange": contract.exchange,
                    "trading_class": contract.tradingClass,
                }
                for contract in option_contracts
            ],
            "files": [],
            "requests": [],
        }

        if args.probe_only:
            probe_path = out_dir / f"run_summary_probe_{args.symbol.lower()}_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            summary["ib_errors"] = errors
            probe_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
            print(json.dumps(summary, indent=2, ensure_ascii=False, default=str))
            return 0

        date_suffix = f"{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}"

        if not args.skip_stock:
            stock_rows, request_log = await fetch_contract_rows(ib, stock_contract, args.symbol, "TRADES", start_date, end_date, args)
            stock_path = out_dir / f"{args.symbol.lower()}_stock_10s_trades_{date_suffix}.csv"
            write_csv(stock_path, stock_rows)
            summary["files"].append({"path": str(stock_path), "rows": len(stock_rows)})
            summary["requests"].extend(request_log)
            print(f"wrote {stock_path} rows={len(stock_rows)}")

        for contract in option_contracts:
            strike_label = str(contract.strike).replace(".0", "").replace(".", "p")
            for what_to_show in ("BID", "ASK", "TRADES"):
                option_rows, request_log = await fetch_contract_rows(ib, contract, args.symbol, what_to_show, start_date, end_date, args)
                option_path = out_dir / (
                    f"{args.symbol.lower()}_option_{selected_expiry}_{contract.right.lower()}{strike_label}_10s_"
                    f"{what_to_show.lower()}_{date_suffix}.csv"
                )
                write_csv(option_path, option_rows)
                summary["files"].append({"path": str(option_path), "rows": len(option_rows)})
                summary["requests"].extend(request_log)
                print(f"wrote {option_path} rows={len(option_rows)}")

        summary["ib_errors"] = errors
        summary_path = out_dir / f"run_summary_{args.symbol.lower()}_{date_suffix}.json"
        summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"wrote {summary_path}")
        return 0
    finally:
        ib.disconnect()


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        raise SystemExit(130)
