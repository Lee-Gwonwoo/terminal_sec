from __future__ import annotations

import argparse
import math
from pathlib import Path
from typing import Iterable

import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = SCRIPT_DIR / "data"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a 10-second LWLG option model-price grid from IBKR historical bars.")
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    parser.add_argument("--expiry", default="20260618")
    parser.add_argument("--right", default="C")
    parser.add_argument("--strikes", default="15,20")
    parser.add_argument("--risk-free-rate", type=float, default=0.045)
    parser.add_argument("--dividend-yield", type=float, default=0.0)
    parser.add_argument("--output", default=None)
    parser.add_argument("--asof-tolerance-sec", type=int, default=10)
    return parser.parse_args()


def parse_strikes(raw: str) -> list[float]:
    return [float(part.strip()) for part in raw.split(",") if part.strip()]


def find_latest(data_dir: Path, pattern: str) -> Path:
    matches = sorted(data_dir.glob(pattern))
    if not matches:
        raise FileNotFoundError(f"No file matched {pattern} in {data_dir}")
    return matches[-1]


def read_bar_file(path: Path, value_prefix: str) -> pd.DataFrame:
    frame = pd.read_csv(path)
    if frame.empty:
        return pd.DataFrame(columns=["timestamp"])
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="coerce", utc=True)
    frame = frame.dropna(subset=["timestamp"]).sort_values("timestamp")
    keep_columns = ["timestamp", "open", "high", "low", "close", "volume", "bar_count", "wap"]
    frame = frame[[column for column in keep_columns if column in frame.columns]].copy()
    rename = {column: f"{value_prefix}_{column}" for column in frame.columns if column != "timestamp"}
    return frame.rename(columns=rename).drop_duplicates(subset=["timestamp"], keep="last")


def merge_asof_grid(left: pd.DataFrame, right: pd.DataFrame, tolerance_sec: int) -> pd.DataFrame:
    if right.empty:
        return left
    return pd.merge_asof(
        left.sort_values("timestamp"),
        right.sort_values("timestamp"),
        on="timestamp",
        direction="backward",
        tolerance=pd.Timedelta(seconds=tolerance_sec),
    )


def norm_cdf(value: float) -> float:
    return 0.5 * (1.0 + math.erf(value / math.sqrt(2.0)))


def black_scholes_call(spot: float, strike: float, years: float, rate: float, dividend_yield: float, volatility: float) -> float:
    if spot <= 0 or strike <= 0 or years <= 0 or volatility <= 0:
        return float("nan")
    sqrt_time = math.sqrt(years)
    d1 = (math.log(spot / strike) + (rate - dividend_yield + 0.5 * volatility * volatility) * years) / (volatility * sqrt_time)
    d2 = d1 - volatility * sqrt_time
    return spot * math.exp(-dividend_yield * years) * norm_cdf(d1) - strike * math.exp(-rate * years) * norm_cdf(d2)


def implied_vol_call(price: float, spot: float, strike: float, years: float, rate: float, dividend_yield: float) -> float:
    if price <= 0 or spot <= 0 or strike <= 0 or years <= 0:
        return float("nan")
    intrinsic = max(0.0, spot * math.exp(-dividend_yield * years) - strike * math.exp(-rate * years))
    if price < intrinsic - 1e-8:
        return float("nan")
    low = 0.0001
    high = 5.0
    high_price = black_scholes_call(spot, strike, years, rate, dividend_yield, high)
    while math.isfinite(high_price) and high_price < price and high < 10.0:
        high *= 1.5
        high_price = black_scholes_call(spot, strike, years, rate, dividend_yield, high)
    for _iteration in range(80):
        mid = (low + high) / 2.0
        mid_price = black_scholes_call(spot, strike, years, rate, dividend_yield, mid)
        if not math.isfinite(mid_price):
            return float("nan")
        if mid_price > price:
            high = mid
        else:
            low = mid
    return (low + high) / 2.0


def safe_float(value: object) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return float("nan")
    return parsed if math.isfinite(parsed) else float("nan")


def compute_rows(frame: pd.DataFrame, strike: float, expiry: str, right: str, rate: float, dividend_yield: float) -> pd.DataFrame:
    expiry_date = pd.Timestamp(f"{expiry[:4]}-{expiry[4:6]}-{expiry[6:8]} 16:00:00", tz="America/New_York").tz_convert("UTC")
    seconds_to_expiry = (expiry_date - frame["timestamp"]).dt.total_seconds()
    years_to_expiry = seconds_to_expiry / (365.0 * 24.0 * 60.0 * 60.0)
    option_mid = (frame.get("bid_close", pd.Series(index=frame.index, dtype="float64")) + frame.get("ask_close", pd.Series(index=frame.index, dtype="float64"))) / 2.0
    option_last = frame.get("trade_close", pd.Series(index=frame.index, dtype="float64"))

    iv_values: list[float] = []
    model_from_mid: list[float] = []
    for index, row in frame.iterrows():
        spot = safe_float(row.get("underlying_close"))
        mid_price = safe_float(option_mid.loc[index])
        years = safe_float(years_to_expiry.loc[index])
        implied_vol = implied_vol_call(mid_price, spot, strike, years, rate, dividend_yield)
        iv_values.append(implied_vol)
        model_from_mid.append(black_scholes_call(spot, strike, years, rate, dividend_yield, implied_vol))

    result = pd.DataFrame({
        "timestamp": frame["timestamp"],
        "underlying_close": frame["underlying_close"],
        "expiry": expiry,
        "right": right,
        "strike": strike,
        "option_bid": frame.get("bid_close"),
        "option_ask": frame.get("ask_close"),
        "option_mid": option_mid,
        "option_last": option_last,
        "option_volume": frame.get("trade_volume"),
        "seconds_to_expiry": seconds_to_expiry,
        "iv_from_mid": iv_values,
        "model_price_from_mid_iv": model_from_mid,
        "risk_free_rate": rate,
        "dividend_yield": dividend_yield,
    })
    result["prev_iv"] = result["iv_from_mid"].where(pd.notna(result["iv_from_mid"])).ffill().shift(1)
    result["model_price_from_prev_iv"] = [
        black_scholes_call(
            safe_float(row.underlying_close),
            strike,
            safe_float(row.seconds_to_expiry) / (365.0 * 24.0 * 60.0 * 60.0),
            rate,
            dividend_yield,
            safe_float(row.prev_iv),
        )
        for row in result.itertuples(index=False)
    ]
    result["source_flags"] = result.apply(source_flags, axis=1)
    return result.drop(columns=["prev_iv"])


def source_flags(row: pd.Series) -> str:
    flags: list[str] = []
    if pd.notna(row.get("option_bid")) and pd.notna(row.get("option_ask")):
        flags.append("quote_mid")
    if pd.notna(row.get("option_last")):
        flags.append("trade_last")
    if pd.notna(row.get("iv_from_mid")):
        flags.append("iv_solved")
    if pd.notna(row.get("model_price_from_prev_iv")):
        flags.append("prev_iv_model")
    return ";".join(flags)


def build_for_strikes(data_dir: Path, expiry: str, right: str, strikes: Iterable[float], rate: float, dividend_yield: float, tolerance_sec: int) -> pd.DataFrame:
    stock_path = find_latest(data_dir, "lwlg_stock_10s_trades_*.csv")
    stock = read_bar_file(stock_path, "underlying")
    stock = stock.rename(columns={"underlying_close": "underlying_close"})
    if "underlying_close" not in stock.columns:
        raise ValueError(f"Stock file lacks close column: {stock_path}")
    outputs: list[pd.DataFrame] = []
    for strike in strikes:
        strike_label = str(strike).replace(".0", "").replace(".", "p")
        bid = read_bar_file(find_latest(data_dir, f"lwlg_option_{expiry}_{right.lower()}{strike_label}_10s_bid_*.csv"), "bid")
        ask = read_bar_file(find_latest(data_dir, f"lwlg_option_{expiry}_{right.lower()}{strike_label}_10s_ask_*.csv"), "ask")
        trade = read_bar_file(find_latest(data_dir, f"lwlg_option_{expiry}_{right.lower()}{strike_label}_10s_trades_*.csv"), "trade")
        grid = stock[["timestamp", "underlying_close"]].copy()
        grid = merge_asof_grid(grid, bid, tolerance_sec)
        grid = merge_asof_grid(grid, ask, tolerance_sec)
        grid = merge_asof_grid(grid, trade, tolerance_sec)
        outputs.append(compute_rows(grid, strike, expiry, right, rate, dividend_yield))
    return pd.concat(outputs, ignore_index=True).sort_values(["timestamp", "strike"])


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir).resolve()
    output = Path(args.output).resolve() if args.output else data_dir / "lwlg_option_model_grid_10s.csv"
    strikes = parse_strikes(args.strikes)
    result = build_for_strikes(
        data_dir=data_dir,
        expiry=args.expiry,
        right=args.right,
        strikes=strikes,
        rate=args.risk_free_rate,
        dividend_yield=args.dividend_yield,
        tolerance_sec=args.asof_tolerance_sec,
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(output, index=False)
    print(f"wrote {output} rows={len(result)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
