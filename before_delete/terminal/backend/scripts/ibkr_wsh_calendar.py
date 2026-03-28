"""
IBKR WSH Calendar fetcher — called by Node child_process (Step 6-3)

Bulk mode: resolves all ticker conIds upfront, then issues a single WSH
filter-based request with a watchlist of conIds.  Falls back to per-ticker
sequential requests if the bulk filter is rejected by TWS.

Usage:
  python ibkr_wsh_calendar.py --tickers AAPL,MSFT --start-date 2024-03-09 --end-date 2026-09-05 [--port 4001]

stdout: one JSON line per calendar event (NDJSON)
stderr: human-readable messages (no secrets)
Exit codes: 0=success, 1=transient error, 2=permanent error
"""

import argparse
import json
import sys
import datetime
import time

# WSH event_type → calendar type mapping
WSH_TYPE_MAP = {
    "wshe_eps": "earnings",
    "wshe_ed": "earnings",
    "wshe_cc": "earnings",
    "wshe_fq": "earnings",
    "wshe_div": "dividends",
    "wshe_split": "splits",
    "wshe_spinoff": "splits",
    "wshe_merg_acq": "sec_filings",
    "wshe_ic": "sec_filings",
    "wshe_ipo": "sec_filings",
    "wshe_brd_of_dir": "sec_filings",
    "wshe_agms_sms": "sec_filings",
    "wshe_option": None,  # skip option expiry
}


def map_event_type(wsh_type: str) -> str | None:
    """Map WSH event_type to our calendar type. Returns None to skip."""
    return WSH_TYPE_MAP.get(wsh_type, "sec_filings")


def extract_event_time(event: dict) -> str:
    """Extract and normalise event time to ISO 8601."""
    data = event.get("data", {})
    for key in ("event_date", "date", "announce_date", "ex_date",
                "record_date", "pay_date", "report_date"):
        raw = data.get(key)
        if raw and isinstance(raw, str) and len(raw) >= 8:
            cleaned = raw.replace("-", "")[:8]
            try:
                dt = datetime.datetime.strptime(cleaned, "%Y%m%d")
                return dt.strftime("%Y-%m-%dT%H:%M:%S")
            except ValueError:
                continue
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")


def build_title(ticker: str, wsh_type: str, event: dict) -> str:
    """Build a human-readable title."""
    data = event.get("data", {})
    short_type = wsh_type.replace("wshe_", "").upper()
    detail = data.get("event_name") or data.get("description") or ""
    if detail:
        return f"{ticker} {short_type}: {detail}"
    return f"{ticker} {short_type}"


def build_unique_key(ticker: str, wsh_type: str, event: dict) -> str:
    """Build a deterministic unique key for dedup."""
    event_time = extract_event_time(event)
    date_part = event_time[:10].replace("-", "")
    return f"{ticker}_{wsh_type}_{date_part}"


def extract_ticker_from_data(data: dict, reverse_map: dict[str, str] | None = None) -> str:
    """Best-effort ticker extraction from WSH event payload."""
    reverse_map = reverse_map or {}

    event_conid = str(data.get("conid", data.get("conId", "")))
    if event_conid:
        mapped = reverse_map.get(event_conid)
        if mapped:
            return mapped

    company = data.get("company") or {}
    if isinstance(company, dict):
        contract = company.get("contract")
        if isinstance(contract, str) and contract.strip():
            return contract.strip().upper()

    for key in ("symbol", "ticker", "contract"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().upper()

    return "UNKNOWN"


def resolve_conids(ib, tickers: list[str]) -> dict[int, str]:
    """Resolve ticker symbols to conIds. Returns {conId: ticker} map."""
    from ib_insync import Stock
    conid_map: dict[int, str] = {}
    total = len(tickers)
    for index, ticker in enumerate(tickers, start=1):
        try:
            contract = Stock(ticker, "SMART", "USD")
            details = ib.reqContractDetails(contract)
            if details:
                con_id = details[0].contract.conId
                conid_map[con_id] = ticker
            else:
                print(f"[wsh] {ticker}: contract not found, skipping", file=sys.stderr)
        except Exception as e:
            print(f"[wsh] {ticker}: contract lookup failed: {e}", file=sys.stderr)
        if index == 1 or index % 100 == 0 or index == total:
            print(f"[wsh] conId progress: {index}/{total} resolved={len(conid_map)}", file=sys.stderr)
    return conid_map


def emit_events(events: list[dict], ticker: str) -> int:
    """Parse WSH events and print NDJSON to stdout. Returns count."""
    count = 0
    for event in events:
        wsh_type = event.get("event_type", "unknown")
        cal_type = map_event_type(wsh_type)
        if cal_type is None:
            continue
        event_time = extract_event_time(event)
        line = json.dumps({
            "type": cal_type,
            "eventTime": event_time,
            "ticker": ticker,
            "title": build_title(ticker, wsh_type, event),
            "fieldsJson": event.get("data", {}),
            "uniqueKey": build_unique_key(ticker, wsh_type, event),
        })
        print(line, flush=True)
        count += 1
    return count


def bulk_fetch(ib, conid_map: dict[int, str], start_wsh: str, end_wsh: str) -> int:
    """
    Attempt bulk WSH fetch using filter JSON with watchlist conId array.
    Returns total event count, or -1 if bulk mode is not supported/fails.
    """
    from ib_insync import WshEventData
    conid_strs = [str(c) for c in conid_map.keys()]
    filter_json = json.dumps({
        "country": "All",
        "watchlist": conid_strs,
    })
    try:
        # Must call getWshMetaData first per IBKR docs
        try:
            ib.getWshMetaData()
            ib.sleep(0.5)
        except Exception:
            pass  # non-fatal if meta already cached

        wsh = WshEventData(
            filter=filter_json,
            startDate=start_wsh,
            endDate=end_wsh,
        )
        resp_raw = ib.getWshEventData(wsh)
    except Exception as e:
        print(f"[wsh-bulk] filter request failed: {e}", file=sys.stderr)
        return -1

    if not resp_raw:
        print("[wsh-bulk] empty response from bulk filter request", file=sys.stderr)
        return -1

    try:
        events = json.loads(resp_raw)
    except json.JSONDecodeError as e:
        print(f"[wsh-bulk] JSON parse error: {e}", file=sys.stderr)
        return -1

    if not isinstance(events, list):
        print(f"[wsh-bulk] unexpected response type: {type(events).__name__}", file=sys.stderr)
        return -1

    # Reverse lookup: event → ticker via conId, nested company.contract, or flat symbol fields
    reverse_map = {str(c): t for c, t in conid_map.items()}

    total = 0
    for event in events:
        data = event.get("data", {})
        ticker = extract_ticker_from_data(data, reverse_map)

        wsh_type = event.get("event_type", "unknown")
        cal_type = map_event_type(wsh_type)
        if cal_type is None:
            continue
        event_time = extract_event_time(event)
        line = json.dumps({
            "type": cal_type,
            "eventTime": event_time,
            "ticker": ticker,
            "title": build_title(ticker, wsh_type, event),
            "fieldsJson": data,
            "uniqueKey": build_unique_key(ticker, wsh_type, event),
        })
        print(line, flush=True)
        total += 1

    print(f"[wsh-bulk] {total} events from bulk filter request ({len(conid_map)} tickers)", file=sys.stderr)
    return total


def sequential_fetch(ib, conid_map: dict[int, str], start_wsh: str, end_wsh: str) -> int:
    """Fallback: fetch WSH events per ticker sequentially."""
    from ib_insync import WshEventData
    total = 0
    for i, (con_id, ticker) in enumerate(conid_map.items()):
        if i > 0:
            time.sleep(0.3)
        try:
            wsh = WshEventData(
                conId=con_id,
                startDate=start_wsh,
                endDate=end_wsh,
            )
            resp_raw = ib.getWshEventData(wsh)
        except Exception as e:
            print(f"[wsh] {ticker}: getWshEventData failed: {e}", file=sys.stderr)
            continue

        if not resp_raw:
            print(f"[wsh] {ticker}: empty response", file=sys.stderr)
            continue

        try:
            events = json.loads(resp_raw)
        except json.JSONDecodeError as e:
            print(f"[wsh] {ticker}: JSON parse error: {e}", file=sys.stderr)
            continue

        if not isinstance(events, list):
            continue

        count = emit_events(events, ticker)
        total += count
        print(f"[wsh] {ticker} (conId={con_id}): {count} events", file=sys.stderr)

    return total


def main():
    parser = argparse.ArgumentParser(description="Fetch IBKR WSH calendar events")
    parser.add_argument("--tickers", required=True, help="Comma-separated ticker symbols")
    parser.add_argument("--start-date", required=True, help="Start date YYYY-MM-DD")
    parser.add_argument("--end-date", required=True, help="End date YYYY-MM-DD")
    parser.add_argument("--port", type=int, default=4001, help="TWS/Gateway port")
    parser.add_argument("--client-id", type=int, default=85, help="IBKR client ID")
    args = parser.parse_args()

    tickers = [t.strip() for t in args.tickers.split(",") if t.strip()]
    if not tickers:
        print("No tickers provided", file=sys.stderr)
        sys.exit(2)

    try:
        start_dt = datetime.date.fromisoformat(args.start_date)
        end_dt = datetime.date.fromisoformat(args.end_date)
    except ValueError as e:
        print(f"Invalid date format: {e}", file=sys.stderr)
        sys.exit(2)

    start_wsh = start_dt.strftime("%Y%m%d")
    end_wsh = end_dt.strftime("%Y%m%d")

    try:
        from ib_insync import IB
    except ImportError:
        print("ib_insync not installed. Run: pip install ib_insync", file=sys.stderr)
        sys.exit(2)

    ib = IB()
    try:
        ib.connect("127.0.0.1", args.port, clientId=args.client_id, timeout=15)
    except Exception as e:
        print(f"Failed to connect to IBKR TWS on port {args.port}: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        # Phase 1: resolve all conIds
        print(f"[wsh] Resolving conIds for {len(tickers)} tickers...", file=sys.stderr)
        conid_map = resolve_conids(ib, tickers)
        print(f"[wsh] Resolved {len(conid_map)}/{len(tickers)} conIds", file=sys.stderr)

        if not conid_map:
            print("[wsh] No valid conIds resolved, nothing to fetch", file=sys.stderr)
            sys.exit(0)

        # Phase 2: try bulk filter request first
        total = bulk_fetch(ib, conid_map, start_wsh, end_wsh)
        if total < 0:
            # Bulk failed — fall back to sequential
            print("[wsh] Bulk filter not supported, falling back to sequential fetch...", file=sys.stderr)
            total = sequential_fetch(ib, conid_map, start_wsh, end_wsh)

        print(f"[wsh] Total: {total} events for {len(conid_map)} tickers", file=sys.stderr)

    except Exception as e:
        err_msg = str(e)
        if "pacing" in err_msg.lower() or "timeout" in err_msg.lower():
            print(f"Transient error: {err_msg}", file=sys.stderr)
            sys.exit(1)
        print(f"Error: {err_msg}", file=sys.stderr)
        sys.exit(1)
    finally:
        ib.disconnect()


if __name__ == "__main__":
    main()
