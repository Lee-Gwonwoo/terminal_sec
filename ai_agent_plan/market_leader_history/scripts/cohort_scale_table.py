# -*- coding: utf-8 -*-
"""코호트 거래대금 스케일 raw 데이터 산출 → raw_data/cohort_turnover_scale.csv"""
import os, sys, sqlite3, numpy as np, pandas as pd
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
OHLC = r"C:\github_coding\terminal_sec\OHLC_data\ohlc_1d_watchlist.sqlite"
BACKFILL = r"C:\github_coding\terminal_sec\ai_agent_plan\market_leader_history\raw_data\ohlc_backfill.sqlite"
OUT = r"C:\github_coding\terminal_sec\ai_agent_plan\market_leader_history\raw_data\cohort_turnover_scale.csv"
TURN_MIN = 30e6

df = pd.read_sql("SELECT Symbol,Datetime,Close,Volume FROM ohlc_1d",
                 sqlite3.connect(f"file:{OHLC}?mode=ro", uri=True))
if os.path.exists(BACKFILL):
    bf = pd.read_sql("SELECT Symbol,Datetime,Close,Volume FROM ohlc_1d",
                     sqlite3.connect(f"file:{BACKFILL}?mode=ro", uri=True))
    df = pd.concat([df, bf], ignore_index=True)
df = df.drop_duplicates(["Symbol","Datetime"], keep="first")
df = df[(df.Close>0)&(df.Volume>0)]
df["turnover"] = df.Close*df.Volume
df["year"] = df.Datetime.str[:4]

# 코호트 = 2015 & 2025 둘 다 150거래일 이상 (같은 종목 무리)
cnt = df.groupby(["Symbol","year"]).size().unstack(fill_value=0)
cohort = cnt.index[(cnt.get("2015",0)>=150)&(cnt.get("2025",0)>=150)]
sy = df[df.Symbol.isin(cohort)].groupby(["Symbol","year"]).turnover.median().reset_index()

rows=[]
ref = sy[sy.year=="2026"].turnover.median()
for y in [str(x) for x in range(2015,2027)]:
    med = sy[sy.year==y].turnover.median()
    n = sy[sy.year==y].Symbol.nunique()
    scale = med/ref
    rows.append((y, n, round(med/1e6,1), round(scale,3), round(TURN_MIN*scale/1e6,1)))
out = pd.DataFrame(rows, columns=["year","cohort_symbols","cohort_median_turnover_M",
                                  "scale_vs_2026","threshold_scaled_M"])
os.makedirs(os.path.dirname(OUT), exist_ok=True)
out.to_csv(OUT, index=False, encoding="utf-8-sig")
print(f"코호트 종목 수: {len(cohort)}  |  기준연도 2026 중앙 거래대금 = ${ref/1e6:.1f}M")
print(out.to_string(index=False))
print(f"\n저장: {OUT}")
