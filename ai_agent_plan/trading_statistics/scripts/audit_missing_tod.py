# -*- coding: utf-8 -*-
"""Audit: earnings WITHOUT a BMO/AMC label that might be missed Case-1 events.

For every NULL/Unknown time_of_day earnings row whose ticker is in the OHLC
universe, test BOTH candidate 1days (same day if it had been BMO, next trading
day if AMC). If either candidate bar clears every Case-1 condition
(turnover>=100M, mcap>=300M, z_cc>=3 & cc>=4% & z_gap>=3 & gap>=4%),
flag it as a potentially missed event.

Output: raw_data/audit_missing_tod_candidates.csv (newest first)
"""
import os
import sqlite3

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "raw_data")
OHLC = r"C:\github_coding\terminal_sec\OHLC_data\ohlc_1d_watchlist.sqlite"
APP = r"C:\github_coding\terminal_sec\terminal\backend\backend\data\app.db"

# ---- OHLC + same cleaning/z as extract_events (abbreviated) ----
df = pd.read_sql("SELECT Symbol,Datetime,Open,High,Low,Close,Volume FROM ohlc_1d",
                 sqlite3.connect(f"file:{OHLC}?mode=ro", uri=True))
df = df.drop_duplicates(["Symbol", "Datetime"]).sort_values(["Symbol", "Datetime"]).reset_index(drop=True)
bad = (df[["Open", "High", "Low", "Close"]].isna().any(axis=1)
       | (df[["Open", "High", "Low", "Close"]] <= 0).any(axis=1))
df = df[~bad].reset_index(drop=True)
g = df.groupby("Symbol", sort=False)
df["prev_close"] = g["Close"].shift(1)
df["gap"] = (df.Open - df.prev_close) / df.prev_close * 100
df["cc"] = (df.Close - df.prev_close) / df.prev_close * 100
df["oc"] = (df.Close - df.Open) / df.Open * 100
df["turnover"] = df.Close * df.Volume
df.loc[df.gap.abs() > 300, ["gap", "cc"]] = np.nan          # sanity only
for c in ["gap", "cc"]:
    s = df.groupby("Symbol", sort=False)[c].shift(1)
    df[f"sd_{c}"] = (s.groupby(df.Symbol, sort=False)
                       .rolling(60, min_periods=60).std().reset_index(level=0, drop=True))
    df[f"z_{c}"] = df[c] / df[f"sd_{c}"]
    df.loc[df[f"sd_{c}"] < 0.3, f"z_{c}"] = np.nan
df["row"] = np.arange(len(df))
sym = df.Symbol.values

con = sqlite3.connect(f"file:{APP}?mode=ro", uri=True)
ea = pd.read_sql("""SELECT ticker, substr(event_at,1,10) d,
                           COALESCE(json_extract(meta_json,'$.time_of_day'),'(NULL)') tod
                    FROM calendar_events
                    WHERE event_type='earnings' AND ticker IS NOT NULL
                      AND event_at >= '2015-01-01'""", con)
mc = pd.read_sql("""SELECT s.ticker, MAX(p.market_cap) mcap FROM company_profiles p
                    JOIN securities s ON s.id=p.security_id
                    WHERE p.market_cap IS NOT NULL GROUP BY s.ticker""", con)
con.close()
mcset = set(mc[mc.mcap >= 300e6].ticker)

ea = ea.drop_duplicates(["ticker", "d"])
miss = ea[~ea.tod.isin(["BMO", "AMC"])].copy()
print(f"어닝(2015+) 총 {len(ea):,} | BMO/AMC 라벨 있음 {len(ea)-len(miss):,} | 없음 {len(miss):,}")
print("\n라벨 없는 어닝 — 연도별:")
print(miss.groupby(miss.d.str[:4]).size().to_string())

idx = df.set_index(["Symbol", "Datetime"])["row"]
miss["r0"] = pd.MultiIndex.from_frame(miss[["ticker", "d"]]).map(idx)
in_ohlc = miss.dropna(subset=["r0"]).copy()
in_ohlc["r0"] = in_ohlc.r0.astype(int)
print(f"\n그중 OHLC 유니버스에 날짜까지 매칭: {len(in_ohlc):,}")

def passes(r):
    if r >= len(df):
        return None
    b = df.iloc[r]
    if not (b.turnover >= 100e6):
        return None
    if np.isnan(b.z_cc) or np.isnan(b.z_gap):
        return None
    if (b.z_cc >= 3) and (b.cc >= 4) and (b.z_gap >= 3) and (b.gap >= 4):
        return {"one_day": b.Datetime, "gap_pct": b.gap, "cc_pct": b.cc,
                "o2c_pct": b.oc, "z_gap": b.z_gap, "z_cc": b.z_cc,
                "turnover_M": b.turnover / 1e6}
    return None

rows = []
for t, d_, r0 in zip(in_ohlc.ticker.values, in_ohlc.d.values, in_ohlc.r0.values):
    if t not in mcset:
        continue
    hit_bmo = passes(r0)                                    # BMO였다면 당일
    r1 = r0 + 1
    hit_amc = passes(r1) if (r1 < len(df) and sym[r1] == t) else None
    for cand, hit in [("BMO(당일)", hit_bmo), ("AMC(익일)", hit_amc)]:
        if hit:
            rows.append({"ticker": t, "earnings_date": d_, "candidate": cand, **hit})

out = pd.DataFrame(rows).sort_values("earnings_date", ascending=False)
path = os.path.join(RAW, "audit_missing_tod_candidates.csv")
out.round(2).to_csv(path, index=False, encoding="utf-8-sig")
print(f"\n== 잠재 누락 Case-1 이벤트 (조건 전부 통과): {out.earnings_date.nunique() and len(out)}건 ==")
print("연도별:", out.groupby(out.earnings_date.str[:4]).size().to_dict() if len(out) else "{}")
print(out.head(25).round(2).to_string(index=False) if len(out) else "(없음)")
print(f"\nwrote {path}")
