"""
IBKR Batch 1D OHLC fetcher — called by Node child_process

Usage:
  echo '{"symbols":["AAPL","MSFT"],"start":"2026-02-21","end":"2026-03-05","port":4001,"clientId":85,"concurrency":30}' | python ibkr_fetch_ohlc_batch.py

stdin:  JSON object with symbols list + date range + optional config
stdout: one JSON line per result:
        {"symbol":"AAPL","bars":[{"Datetime":..,"Open":..,"High":..,"Low":..,"Close":..,"Volume":..},...],"error":null}
        {"symbol":"MSFT","bars":[...],"error":null}
        {"symbol":"XYZ","bars":[],"error":"No security definition..."}
stderr: human-readable progress (no secrets)
Exit codes: 0=all done (some may have individual errors), 1=fatal startup error
"""

import asyncio
import json
import sys
import datetime


async def main():
    # Read config from stdin
    raw = sys.stdin.read().strip()
    if not raw:
        print("No input on stdin", file=sys.stderr)
        sys.exit(1)

    try:
        cfg = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON on stdin: {e}", file=sys.stderr)
        sys.exit(1)

    symbols = cfg.get("symbols", [])
    start_str = cfg.get("start", "")
    end_str = cfg.get("end", "")
    port = cfg.get("port", 4001)
    client_id = cfg.get("clientId", 85)
    concurrency = cfg.get("concurrency", 30)

    if not symbols:
        print("No symbols provided", file=sys.stderr)
        sys.exit(0)

    # Validate dates
    try:
        start_dt = datetime.date.fromisoformat(start_str)
        end_dt = datetime.date.fromisoformat(end_str)
    except ValueError as e:
        print(f"Invalid date: {e}", file=sys.stderr)
        sys.exit(1)

    if start_dt > end_dt:
        print(f"start ({start_str}) > end ({end_str})", file=sys.stderr)
        sys.exit(0)

    try:
        from ib_insync import IB, Stock
    except ImportError:
        print("ib_insync not installed", file=sys.stderr)
        sys.exit(1)

    ib = IB()
    try:
        await ib.connectAsync("127.0.0.1", port, clientId=client_id, timeout=15)
    except Exception as e:
        print(f"Failed to connect to IBKR on port {port}: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"[batch] connected, {len(symbols)} symbols, concurrency={concurrency}", file=sys.stderr)

    # Calculate duration + end datetime string
    delta_days = (end_dt - start_dt).days + 1
    duration_str = f"{min(delta_days + 10, 365)} D"
    end_ibkr = end_dt.strftime("%Y%m%d") + " 23:59:59 US/Eastern"

    # Qualify contracts in batch
    contracts = [Stock(s, "SMART", "USD") for s in symbols]
    try:
        await ib.qualifyContractsAsync(*contracts)
    except Exception as e:
        print(f"[batch] qualifyContracts error: {e}", file=sys.stderr)

    sym_contract = {}
    qualify_failed = []
    for sym, c in zip(symbols, contracts):
        if c.conId and c.conId > 0:
            sym_contract[sym] = c
        else:
            qualify_failed.append(sym)
            result = {"symbol": sym, "bars": [], "error": f"qualify failed: no conId"}
            print(json.dumps(result), flush=True)

    if qualify_failed:
        print(f"[batch] qualify failed: {len(qualify_failed)} symbols", file=sys.stderr)

    # Semaphore-controlled concurrent fetch
    sem = asyncio.Semaphore(concurrency)
    done_count = 0
    total = len(sym_contract)

    async def fetch_one(sym, contract):
        nonlocal done_count
        async with sem:
            try:
                bars = await ib.reqHistoricalDataAsync(
                    contract,
                    endDateTime=end_ibkr,
                    durationStr=duration_str,
                    barSizeSetting="1 day",
                    whatToShow="TRADES",
                    useRTH=True,
                    formatDate=1,
                    timeout=60,
                )
                bar_list = []
                for b in bars:
                    bar_date = str(b.date)
                    if bar_date < start_str or bar_date > end_str:
                        continue
                    bar_list.append({
                        "Datetime": bar_date,
                        "Open": float(b.open),
                        "High": float(b.high),
                        "Low": float(b.low),
                        "Close": float(b.close),
                        "Volume": int(b.volume),
                    })
                result = {"symbol": sym, "bars": bar_list, "error": None}
            except Exception as e:
                result = {"symbol": sym, "bars": [], "error": str(e)}

            print(json.dumps(result), flush=True)
            done_count += 1
            if done_count % 10 == 0 or done_count == total:
                print(f"[batch] progress: {done_count}/{total}", file=sys.stderr)

    tasks = [fetch_one(sym, c) for sym, c in sym_contract.items()]
    await asyncio.gather(*tasks)

    ib.disconnect()
    print(f"[batch] done: {total} symbols processed", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
