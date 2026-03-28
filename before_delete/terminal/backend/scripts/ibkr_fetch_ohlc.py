"""
IBKR 1D OHLC fetcher — called by Node child_process (Step 7-3)

Usage:
  python ibkr_fetch_ohlc.py --symbol AAPL --start 2026-02-21 --end 2026-03-05 [--port 4001]

stdout: one JSON line per bar {"Datetime":"YYYY-MM-DD","Open":..,"High":..,"Low":..,"Close":..,"Volume":..}
stderr: human-readable messages (no secrets)
Exit codes: 0=success, 1=transient error, 2=permanent error
"""

import argparse
import json
import sys
import datetime


def main():
    parser = argparse.ArgumentParser(description="Fetch IBKR 1D OHLC bars")
    parser.add_argument("--symbol", required=True, help="Ticker symbol (e.g. AAPL)")
    parser.add_argument("--start", required=True, help="Start date YYYY-MM-DD (inclusive)")
    parser.add_argument("--end", required=True, help="End date YYYY-MM-DD (inclusive)")
    parser.add_argument("--port", type=int, default=4001, help="TWS/Gateway port")
    parser.add_argument("--client-id", type=int, default=80, help="IBKR client ID")
    args = parser.parse_args()

    # Validate dates
    try:
        start_dt = datetime.date.fromisoformat(args.start)
        end_dt = datetime.date.fromisoformat(args.end)
    except ValueError as e:
        print(f"Invalid date format: {e}", file=sys.stderr)
        sys.exit(2)

    if start_dt > end_dt:
        print(f"start ({args.start}) > end ({args.end}), nothing to fetch", file=sys.stderr)
        sys.exit(0)

    try:
        from ib_insync import IB, Stock
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
        contract = Stock(args.symbol, "SMART", "USD")
        ib.qualifyContracts(contract)

        # Calculate duration
        delta_days = (end_dt - start_dt).days + 1
        if delta_days <= 0:
            sys.exit(0)
        # IBKR duration string: use calendar days + margin for non-trading days
        duration_str = f"{min(delta_days + 10, 365)} D"

        # endDateTime in IBKR format: YYYYMMDD HH:MM:SS {timezone}
        end_str = end_dt.strftime("%Y%m%d") + " 23:59:59 US/Eastern"

        bars = ib.reqHistoricalData(
            contract,
            endDateTime=end_str,
            durationStr=duration_str,
            barSizeSetting="1 day",
            whatToShow="TRADES",
            useRTH=True,
            formatDate=1,
            timeout=60,
        )

        count = 0
        for b in bars:
            bar_date = str(b.date)  # "YYYY-MM-DD"
            if bar_date < args.start or bar_date > args.end:
                continue
            line = json.dumps({
                "Datetime": bar_date,
                "Open": float(b.open),
                "High": float(b.high),
                "Low": float(b.low),
                "Close": float(b.close),
                "Volume": int(b.volume),
            })
            print(line, flush=True)
            count += 1

        print(f"[ibkr_fetch_ohlc] {args.symbol}: {count} bars written", file=sys.stderr)

    except Exception as e:
        err_msg = str(e)
        if "pacing" in err_msg.lower() or "timeout" in err_msg.lower():
            print(f"Transient error for {args.symbol}: {err_msg}", file=sys.stderr)
            sys.exit(1)
        print(f"Error fetching {args.symbol}: {err_msg}", file=sys.stderr)
        sys.exit(1)
    finally:
        ib.disconnect()


if __name__ == "__main__":
    main()
