# -*- coding: utf-8 -*-
"""
Market Leader History - 2주(10거래일) 지속 주도적 상승 스캔.
창 시작월별로, 티커당 그 달 최고 z_win 을 남긴다.

정의:
  r_i   = ln(Close_i / Close_{i-1})                 # 일간 로그수익률 (부패일 null)
  R_W   = sum(r_{s..s+9}) = ln(C[s+9]/C[s-1])        # 2주 누적 (창=[s..s+9])
  sigma = std(r_{s-60..s-1})                         # 진입 직전 60일 일간변동성
  z_win = R_W / (sigma * sqrt(10))                   # 평균 미차감 (레포 관례)

조건: 창 내 모든 일봉 turnover(=C*V) >= 30M, 이벤트시점 시총 >= 300M, z_win >= Z_MIN
정제: trading_statistics R0~R4 (수정주가 오염 -> 해당일 r null)
"""
import os, sys, sqlite3, numpy as np, pandas as pd
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

OHLC = r"C:\github_coding\terminal_sec\OHLC_data\ohlc_1d_watchlist.sqlite"
APP  = r"C:\github_coding\terminal_sec\terminal\backend\backend\data\app.db"
MCAP_CSV = r"C:\github_coding\terminal_sec\watch lists2_2026-05-11_914fc.csv"
OUT  = r"C:\github_coding\terminal_sec\ai_agent_plan\market_leader_history\raw_data"

W          = 10        # 윈도우 거래일 (2주)
LOOKBACK   = 60        # sigma 기준선
SD_MIN     = 0.005     # 일간 로그수익률 sigma 하한 (분모 폭발 방지)
TURN_MIN   = 30e6      # 창 내 모든 일봉 최소 거래대금
MCAP_MIN   = 300e6
Z_MIN      = 4.0
RET_MIN    = 25.0      # 절대하한: 2주 누적 등락률 (조용한 대형주 배제)
DATE_MIN   = "2015-01-01"   # 창 시작일 하한

# ---------------------------------------------------------------- OHLC + cleaning (R0~R4)
print("[1/5] OHLC load + cleaning")
df = pd.read_sql("SELECT Symbol,Datetime,Open,High,Low,Close,Volume FROM ohlc_1d",
                 sqlite3.connect(f"file:{OHLC}?mode=ro", uri=True))
n0 = len(df)
df = df.drop_duplicates(subset=["Symbol", "Datetime"])                       # R0
df = df.sort_values(["Symbol", "Datetime"]).reset_index(drop=True)

oc = ["Open", "High", "Low", "Close"]
r1_bad = (df[oc].isna().any(axis=1) | (df[oc] <= 0).any(axis=1)
          | (df.High < df[["Open", "Close"]].max(axis=1) - 1e-9)
          | (df.Low > df[["Open", "Close"]].min(axis=1) + 1e-9))
df = df[~r1_bad].reset_index(drop=True)                                       # R1

g = df.groupby("Symbol", sort=False)
df["prev_close"] = g["Close"].shift(1)
df["gap"]      = (df.Open - df.prev_close) / df.prev_close * 100
df["turnover"] = df.Close * df.Volume

ratio = (df.prev_close / df.Open).values
R = np.array([2,3,4,5,6,7,8,10,12,15,20,25,30,50,100], float)
R = np.concatenate([R, 1/R, [1.5, 2.5, 1/1.5, 1/2.5]])
near = np.zeros(len(df), bool)
for k in R:
    near |= np.abs(ratio / k - 1) < 0.02
mv = df.groupby("Symbol", sort=False)["Volume"].shift(1)
med_vol20 = (mv.groupby(df.Symbol, sort=False).rolling(20, min_periods=20).median()
               .reset_index(level=0, drop=True))
vol_spike = (df.Volume >= 2 * med_vol20) & med_vol20.notna()
big50 = (df.gap.abs() > 50) & df.gap.notna()
cnt = df.loc[big50, "Datetime"].value_counts()
bad_dates = set(cnt[cnt >= 5].index)
r3 = (big50 | ((df.gap.abs() > 20) & near)) & df.Datetime.isin(bad_dates)     # R3'
r2 = (df.gap.abs() > 20) & near & df.gap.notna() & ~vol_spike & ~r3           # R2
r4 = (df.gap.abs() > 300) & ~r2 & df.gap.notna() & ~vol_spike & ~r3           # R4 v3
corrupt = (r2 | r3 | r4).values
print(f"  rows {n0:,} -> {len(df):,} | corrupt(r2/r3/r4) {int(corrupt.sum()):,}, r1 dropped {int(r1_bad.sum()):,}")

# ---------------------------------------------------------------- daily log return (null corrupt)
r = np.log(df.Close.values / df.prev_close.values)
r[corrupt] = np.nan
df["r"] = r

# ---------------------------------------------------------------- rolling window features (at end-row e; window_start s=e-9)
print("[2/5] rolling window z / turnover / shape")
gb = df.groupby("Symbol", sort=False)["r"]
df["sd60"]  = gb.rolling(LOOKBACK, min_periods=LOOKBACK).std().reset_index(level=0, drop=True)
df["rw10"]  = gb.rolling(W, min_periods=W).sum().reset_index(level=0, drop=True)
df["up10"]  = (df.r > 0).groupby(df.Symbol, sort=False).rolling(W, min_periods=W).sum().reset_index(level=0, drop=True)
df["rmax10"] = gb.rolling(W, min_periods=W).max().reset_index(level=0, drop=True)

gt = df.groupby("Symbol", sort=False)["turnover"]
df["turn_min10"] = gt.rolling(W, min_periods=W).min().reset_index(level=0, drop=True)
df["turn_med10"] = gt.rolling(W, min_periods=W).median().reset_index(level=0, drop=True)
df["high_max10"] = df.groupby("Symbol", sort=False)["High"].rolling(W, min_periods=W).max().reset_index(level=0, drop=True)

gS = df.groupby("Symbol", sort=False)
df["sd_prewin"]   = gS["sd60"].shift(W)          # sigma of 60 returns ending at s-1
df["c_start"]     = gS["Close"].shift(W - 1)     # C[s] = C[e-9]
df["c_prevstart"] = gS["Close"].shift(W)         # C[s-1] = C[e-10]
df["date_start"]  = gS["Datetime"].shift(W - 1)  # date[s]

# z_win (aligned at end-row e; belongs to window_start s=e-9)
sd = df.sd_prewin.values.copy()
sd[sd < SD_MIN] = np.nan
z = df.rw10.values / (sd * np.sqrt(W))
df["z_win"] = z

# ---------------------------------------------------------------- market cap (TradingView CSV, event-time reconstruct)
print("[3/5] market cap (TradingView default-ticker CSV)")
mc = pd.read_csv(MCAP_CSV)
mc = mc[["Symbol", "Price", "Market capitalization"]].dropna()
mc = mc[(mc.Price > 0) & (mc["Market capitalization"] > 0)]
shares = dict(zip(mc.Symbol, mc["Market capitalization"] / mc.Price))   # 내재 발행주식수
mc_now = dict(zip(mc.Symbol, mc["Market capitalization"]))
df["impl_shares"] = df.Symbol.map(shares)
df["mcap_at_start"] = df.impl_shares * df.c_start                        # 이벤트시점 시총
df["mcap_now"] = df.Symbol.map(mc_now)
print(f"  CSV tickers w/ mcap: {len(shares):,}")

# ---------------------------------------------------------------- qualify + monthly grouping
print("[4/5] qualify (z>=%.1f, ret_2w>=%.0f%%, turn_min>=%.0fM, mcap>=%.0fM, start>=%s) + monthly leaderboard"
      % (Z_MIN, RET_MIN, TURN_MIN/1e6, MCAP_MIN/1e6, DATE_MIN))
ret2w = (np.exp(df.rw10.values) - 1) * 100
q = ((df.z_win >= Z_MIN) & df.rw10.notna() & df.sd_prewin.notna()
     & (ret2w >= RET_MIN)
     & (df.date_start >= DATE_MIN)
     & (df.turn_min10 >= TURN_MIN) & (df.mcap_at_start >= MCAP_MIN))
d = df[q].copy()
print(f"  day-level hits (창 시작일 단위): {len(d):,}")

# run_days: 같은 종목에서 z>=Z_MIN 인 window_start 가 연속된 길이
df["_qual"] = q.values
df["_runid"] = (~df._qual).groupby(df.Symbol, sort=False).cumsum()
df["run_days"] = df._qual.groupby([df.Symbol, df._runid]).transform("sum").where(df._qual, 0)

d["month"] = d.date_start.str[:7]
d["run_days"] = df.loc[d.index, "run_days"].values
# 티커 x 월 당 최고 z_win 행
idx = d.groupby(["Symbol", "month"])["z_win"].idxmax()
lead = d.loc[idx].copy()

lead["window_start"] = lead.date_start.str[:10]
lead["window_end"]   = lead.Datetime.str[:10]
lead["ret_2w_pct"]   = (np.exp(lead.rw10) - 1) * 100
lead["end_vs_high"]  = lead.Close / lead.high_max10
lead["up_day_ratio"] = lead.up10 / W
lead["max_day_contrib"] = np.where(lead.rw10 > 0, lead.rmax10 / lead.rw10, np.nan)
lead["sigma_d_pct"]  = lead.sd_prewin * 100
si = pd.read_sql("SELECT ticker, sector, industry FROM securities WHERE ticker IS NOT NULL",
                 sqlite3.connect(f"file:{APP}?mode=ro", uri=True)).drop_duplicates("ticker")
sec = dict(zip(si.ticker, si.sector)); ind = dict(zip(si.ticker, si.industry))
lead["sector"] = lead.Symbol.map(sec); lead["industry"] = lead.Symbol.map(ind)

def bucket(v):
    if v is None or np.isnan(v): return None
    for hi, name in [(1e9,"300M-1B"),(10e9,"1B-10B"),(100e9,"10B-100B")]:
        if v < hi: return name
    return "100B+"
lead["mcap_bucket"] = lead.mcap_at_start.map(bucket)

cols = ["month","Symbol","window_start","window_end","z_win","ret_2w_pct",
        "mcap_at_start","turn_min10","turn_med10","sigma_d_pct","end_vs_high",
        "up_day_ratio","max_day_contrib","run_days","sector","industry","mcap_bucket","mcap_now"]
out = (lead[cols].rename(columns={"Symbol":"ticker","turn_min10":"turnover_min",
        "turn_med10":"turnover_median","mcap_now":"market_cap_now"})
       .sort_values(["month","z_win"], ascending=[False, False]).reset_index(drop=True))
for c in ["z_win","ret_2w_pct","sigma_d_pct","end_vs_high","up_day_ratio","max_day_contrib"]:
    out[c] = out[c].round(3)
for c in ["mcap_at_start","turnover_min","turnover_median","market_cap_now"]:
    out[c] = out[c].round(0)

os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, "market_leader_monthly.csv")
out.to_csv(path, index=False, encoding="utf-8-sig")
print(f"  wrote {path}  ({len(out):,} rows = 티커x월)")

# ---------------------------------------------------------------- report
print("\n[5/5] REPORT ---------------------------------------------------------")
print(f"총 리더 행(티커x월): {len(out):,} | 유니크 티커: {out.ticker.nunique():,} | 기간: {out.month.min()} ~ {out.month.max()}")
permonth = out.groupby("month").size()
print(f"월별 건수: 평균 {permonth.mean():.1f} · 중앙 {permonth.median():.0f} · 최대 {permonth.max()} ({permonth.idxmax()}) · 최소 {permonth.min()}")

print("\n--- 연도별 리더 수 ---")
yr = out.assign(year=out.month.str[:4]).groupby("year").size()
for y, n in yr.items(): print(f"  {y}: {n}")

print("\n--- 최근 12개월 월별 상위 티커 (z_win) ---")
for m in sorted(out.month.unique())[-12:]:
    sub = out[out.month == m].nlargest(12, "z_win")
    lst = ", ".join(f"{t}({z:.1f})" for t, z in zip(sub.ticker, sub.z_win))
    print(f"  {m} [{(out.month==m).sum():>3}]: {lst}")

print("\n--- MXL 확인 ---")
mxl = out[out.ticker == "MXL"]
if len(mxl):
    print(mxl[["month","window_start","window_end","z_win","ret_2w_pct","turnover_min","mcap_at_start","up_day_ratio","end_vs_high"]].to_string(index=False))
else:
    print("  MXL 해당 없음 (z>=%.1f 미달 또는 필터 탈락)" % Z_MIN)
    raw = df[(df.Symbol=="MXL") & (df.date_start.str[:7]=="2026-04")]
    if len(raw):
        b = raw.loc[raw.z_win.idxmax()] if raw.z_win.notna().any() else raw.iloc[-1]
        print(f"  MXL 2026-04 최고 z_win={b.z_win:.2f} (start {str(b.date_start)[:10]}, turn_min={b.turn_min10/1e6 if pd.notna(b.turn_min10) else float('nan'):.0f}M, mcap={b.mcap_at_start/1e9 if pd.notna(b.mcap_at_start) else float('nan'):.2f}B)")
