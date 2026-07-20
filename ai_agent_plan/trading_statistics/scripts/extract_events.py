# -*- coding: utf-8 -*-
"""Trading statistics — event extraction pipeline.

Implements the frozen spec in ../plan.md:
  Case 1  earnings 1day:  z_cc>=3 AND cc>=4%  AND  z_gap>=3 AND gap>=4%
  Case 2  non-earnings:   z_gap>=3 AND gap>=4%  AND news (same or prev TRADING day)
Common:   event-day turnover >= $100M, market cap >= $300M, sigma60 (>=0.3%)
Cleaning: R0 dedup / R1 bar sanity / R2 unadjusted-split-like / R4 |gap|>50%
Missing data stays missing (null) — never imputed.

Outputs (../raw_data/):
  case1_earnings_events.csv
  case2_news_gap_events.csv
  ohlc_excluded_rows.csv
"""
import os
import re
import sqlite3

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "raw_data")
OHLC = r"C:\github_coding\terminal_sec\OHLC_data\ohlc_1d_watchlist.sqlite"
APP = r"C:\github_coding\terminal_sec\terminal\backend\backend\data\app.db"

Z_THR, FLOOR, SD_MIN = 3.0, 4.0, 0.3
LOOKBACK, FWD1, FWD2 = 60, 21, 42
TURNOVER_MIN, MCAP_MIN = 100e6, 300e6

# ---------------------------------------------------------------- OHLC + cleaning
print("[1/6] OHLC load + cleaning")
df = pd.read_sql("SELECT Symbol,Datetime,Open,High,Low,Close,Volume FROM ohlc_1d",
                 sqlite3.connect(f"file:{OHLC}?mode=ro", uri=True))
n0 = len(df)
df = df.drop_duplicates(subset=["Symbol", "Datetime"])           # R0
df = df.sort_values(["Symbol", "Datetime"]).reset_index(drop=True)

ohlc_cols = ["Open", "High", "Low", "Close"]
r1_bad = (df[ohlc_cols].isna().any(axis=1) | (df[ohlc_cols] <= 0).any(axis=1)
          | (df.High < df[["Open", "Close"]].max(axis=1) - 1e-9)
          | (df.Low > df[["Open", "Close"]].min(axis=1) + 1e-9))
excluded = [df.loc[r1_bad, ["Symbol", "Datetime", "Open", "Close"]].assign(reason="r1_bad_bar")]
df = df[~r1_bad].reset_index(drop=True)

g = df.groupby("Symbol", sort=False)
df["prev_close"] = g["Close"].shift(1)
df["gap"] = (df.Open - df.prev_close) / df.prev_close * 100
df["cc"] = (df.Close - df.prev_close) / df.prev_close * 100
df["oc"] = (df.Close - df.Open) / df.Open * 100
df["turnover"] = df.Close * df.Volume

ratio = (df.prev_close / df.Open).values
R = np.array([2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 50, 100], float)
R = np.concatenate([R, 1 / R, [1.5, 2.5, 1 / 1.5, 1 / 2.5]])
near = np.zeros(len(df), bool)
for k in R:
    near |= np.abs(ratio / k - 1) < 0.02

# volume corroboration: a REAL extreme move comes with an exploding volume,
# while vintage/split corruption leaves volume at its normal level.
# (MXL 2026-04-24: gap +57.7%, volume 5.8x -> real. ORLY 2021-12-02: -93%, no spike -> corrupt.)
mv = df.groupby("Symbol", sort=False)["Volume"].shift(1)
med_vol20 = (mv.groupby(df.Symbol, sort=False)
               .rolling(20, min_periods=20).median()
               .reset_index(level=0, drop=True))
vol_spike = (df.Volume >= 2 * med_vol20) & med_vol20.notna()

# R3': corrupt-DATE cluster — >=5 symbols gapping |>50%| on the same date is a
# data accident, never a market event (2020-03-16 crash max gap was -49%).
# Volume exemption does NOT apply on these dates.
big50 = (df.gap.abs() > 50) & df.gap.notna()
cnt_by_date = df.loc[big50, "Datetime"].value_counts()
bad_dates = set(cnt_by_date[cnt_by_date >= 5].index)
r3 = (big50 | ((df.gap.abs() > 20) & near)) & df.Datetime.isin(bad_dates)
print(f"  R3' 오염 날짜: {sorted(bad_dates)} (해당 극단 행 {int(r3.sum()):,})")

r2 = (df.gap.abs() > 20) & near & df.gap.notna() & ~vol_spike & ~r3
# R4 v3 (사용자 지시: 폭등 실데이터는 전부 포함): 크기만으로는 무효화하지 않는다.
# 물리적으로 불가능한 |gap|>300% (거래량 스파이크 없음) 만 남긴다 — TOPCF +21억% 류.
r4 = (df.gap.abs() > 300) & ~r2 & df.gap.notna() & ~vol_spike & ~r3
included_extreme = (df.gap.abs() > 50) & df.gap.notna() & ~(r2 | r3 | r4)
print(f"  |gap|>50% 인데 실데이터로 포함된 행: {int(included_extreme.sum()):,}")
for mask, tag in [(r2, "r2_split_like"), (r3, "r3_corrupt_date_cluster"), (r4, "r4_gap_gt50")]:
    excluded.append(df.loc[mask, ["Symbol", "Datetime", "prev_close", "Open", "Close", "gap"]]
                      .rename(columns={"gap": "gap_pct_raw"}).assign(reason=tag))
df.loc[r2 | r3 | r4, ["gap", "cc"]] = np.nan

exc = pd.concat(excluded, ignore_index=True)
os.makedirs(OUT, exist_ok=True)
exc.to_csv(os.path.join(OUT, "ohlc_excluded_rows.csv"), index=False, encoding="utf-8-sig")
print(f"  rows {n0:,} -> {len(df):,} | excluded rows logged: {len(exc):,} "
      f"(r1 {int(r1_bad.sum())}, r2 {int(r2.sum())}, r4 {int(r4.sum())})")

# ---------------------------------------------------------------- rolling stats
print("[2/6] sigma60 / z / pre-turnover")
for c in ["gap", "cc"]:
    s = df.groupby("Symbol", sort=False)[c].shift(1)
    df[f"sd_{c}"] = (s.groupby(df.Symbol, sort=False)
                       .rolling(LOOKBACK, min_periods=LOOKBACK).std()
                       .reset_index(level=0, drop=True))
    df[f"z_{c}"] = df[c] / df[f"sd_{c}"]
    df.loc[df[f"sd_{c}"] < SD_MIN, f"z_{c}"] = np.nan

pt = df.groupby("Symbol", sort=False)["turnover"].shift(1)
df["pre_turnover"] = (pt.groupby(df.Symbol, sort=False)
                        .rolling(20, min_periods=20).median()
                        .reset_index(level=0, drop=True))

df["row"] = np.arange(len(df))
sym = df.Symbol.values
close = df.Close.values
dates = df.Datetime.values

# ---------------------------------------------------------------- reference data
print("[3/6] earnings / profiles / news")
con = sqlite3.connect(f"file:{APP}?mode=ro", uri=True)

ea_raw = pd.read_sql("""SELECT ticker, substr(event_at,1,10) d,
                               json_extract(meta_json,'$.time_of_day') tod
                        FROM calendar_events
                        WHERE event_type='earnings' AND ticker IS NOT NULL""", con)
lab_key = ea_raw[ea_raw.tod.isin(["BMO", "AMC"])].set_index(["ticker", "d"]).index
ea = ea_raw[ea_raw.tod.isin(["BMO", "AMC"])].drop_duplicates(subset=["ticker", "d"])
# unlabeled earnings (no BMO/AMC from any source) — reaction-day inference target
unl = ea_raw[~ea_raw.tod.isin(["BMO", "AMC"])].drop_duplicates(subset=["ticker", "d"])
unl = unl[~unl.set_index(["ticker", "d"]).index.isin(lab_key)]

idx = df.set_index(["Symbol", "Datetime"])["row"]
ea["r0"] = pd.MultiIndex.from_frame(ea[["ticker", "d"]]).map(idx)
ea = ea.dropna(subset=["r0"])
ea["r0"] = ea.r0.astype(int)
ea["r1"] = np.where(ea.tod.values == "BMO", ea.r0.values, ea.r0.values + 1)
ea = ea[ea.r1 < len(df)]
ea = ea[sym[ea.r1.values] == ea.ticker.values]

unl["r0"] = pd.MultiIndex.from_frame(unl[["ticker", "d"]]).map(idx)
unl = unl.dropna(subset=["r0"])
unl["r0"] = unl.r0.astype(int)

is_ew = np.zeros(len(df), bool)               # earnings window = 1day + 2day
is_ew[ea.r1.values] = True
r2d = ea.r1.values + 1
ok = (r2d < len(df)) & (sym[np.clip(r2d, 0, len(df) - 1)] == ea.ticker.values)
is_ew[r2d[ok]] = True
# unlabeled earnings: session unknown -> BOTH possible windows are earnings-tainted.
# Exclude d, d+1, d+2 from Case 2 (BMO -> d,d+1 / AMC -> d+1,d+2 의 합집합).
for off in (0, 1, 2):
    rr = unl.r0.values + off
    ok_u = (rr < len(df)) & (sym[np.clip(rr, 0, len(df) - 1)] == unl.ticker.values)
    is_ew[rr[ok_u]] = True

prof = pd.read_sql("""SELECT s.ticker, MAX(p.market_cap) mcap
                      FROM company_profiles p JOIN securities s ON s.id=p.security_id
                      WHERE p.market_cap IS NOT NULL GROUP BY s.ticker""", con)
mcap_map = dict(zip(prof.ticker, prof.mcap))
si = pd.read_sql("SELECT ticker, sector, industry FROM securities "
                 "WHERE ticker IS NOT NULL", con).drop_duplicates("ticker")
sector_map = dict(zip(si.ticker, si.sector))
industry_map = dict(zip(si.ticker, si.industry))

# news presence: (ticker, date) -> set of source tags / list of titles
nw = pd.read_sql("""SELECT substr(published_at,1,10) d, source_type, tickers_csv, title
                    FROM news_items
                    WHERE source_type IN ('fmp_press_release','press_release')
                      AND tickers_csv IS NOT NULL""", con)
sf = pd.read_sql("""SELECT substr(f.filed_at,1,10) d, '8k' source_type,
                           n.tickers_csv, COALESCE(n.title,'8-K') title
                    FROM sec_filings f JOIN news_items n ON n.id=f.news_id
                    WHERE f.form_type='8-K' AND n.tickers_csv IS NOT NULL""", con)
con.close()
TAG = {"press_release": "pr", "fmp_press_release": "fmp_pr", "8k": "8k"}
news = {}
news_titles = {}
for frame in (nw, sf):
    for d_, st, t_, ti in zip(frame.d.values, frame.source_type.values,
                              frame.tickers_csv.values, frame.title.values):
        tag = TAG[st]
        for t in str(t_).split(","):
            t = t.strip().upper()
            if t:
                news.setdefault((t, d_), set()).add(tag)
                news_titles.setdefault((t, d_), []).append(f"[{tag}] {str(ti).strip()}")


def titles_str(key, cap=8):
    """Join titles for (ticker, date); dedupe, cap length for CSV usability."""
    ts = news_titles.get(key, [])
    seen, out = set(), []
    for x in ts:
        body = x.split("] ", 1)[-1]
        if body not in seen:
            seen.add(body)
            out.append(x)
    extra = f" ...외 {len(out) - cap}건" if len(out) > cap else ""
    return " || ".join(out[:cap]) + extra


def fmt_money(v):
    if pd.isna(v):
        return ""
    if v >= 1e12:
        return f"{v/1e12:.1f}T"
    if v >= 1e9:
        return f"{v/1e9:.1f}B"
    if v >= 1e6:
        return f"{v/1e6:.0f}M"
    return f"{v/1e3:.0f}K"
print(f"  earnings mapped {len(ea):,} | news pairs {len(news):,}")

# ---------------------------------------------------------------- helpers
def fwd_close(anchor_rows, n):
    """Close n trading days after anchor rows (same symbol); missing -> nan."""
    a = np.asarray(anchor_rows, float)
    out_val = np.full(len(a), np.nan)
    valid = ~np.isnan(a)
    t = (a[valid] + n).astype(int)
    src = a[valid].astype(int)
    ok = (t < len(df)) & (sym[np.clip(t, 0, len(df) - 1)] == sym[src])
    v = np.full(ok.shape, np.nan)
    v[ok] = close[t[ok]]
    out_val[valid] = v
    return out_val


def gap_percentile(rows):
    """Percentile rank of the event-day gap among the symbol's PRIOR valid gaps."""
    out = np.full(len(rows), np.nan)
    gaps = df["gap"].values
    starts = df.groupby("Symbol", sort=False)["row"].first()
    start_map = dict(zip(starts.index, starts.values))
    for i, r in enumerate(rows):
        s0 = start_map[sym[r]]
        hist = gaps[s0:r]
        hist = hist[~np.isnan(hist)]
        if len(hist) >= LOOKBACK:
            out[i] = (hist < gaps[r]).mean() * 100
    return out


def next_row_same_symbol(rows):
    nxt = rows + 1
    ok = (nxt < len(df)) & (sym[np.clip(nxt, 0, len(df) - 1)] == sym[rows])
    return np.where(ok, nxt, np.nan)


def build_frame(rows, event_type, extra):
    r = np.asarray(rows, int)
    r2 = next_row_same_symbol(r)
    r2i = np.where(np.isnan(r2), 0, r2).astype(int)
    has2 = ~np.isnan(r2)
    out = pd.DataFrame({
        "ticker": sym[r],
        "event_date": dates[r],
        "event_type": event_type,
        "prev_close": df.prev_close.values[r],
        "open_1d": df.Open.values[r],
        "close_1d": close[r],
        "gap_pct": df.gap.values[r],
        "cc_pct": df.cc.values[r],
        "o2c_1d_pct": df.oc.values[r],
        "sd60_gap": df.sd_gap.values[r],
        "sd60_cc": df.sd_cc.values[r],
        "z_gap": df.z_gap.values[r],
        "z_cc": df.z_cc.values[r],
        "gap_pctile": gap_percentile(r),
        "date_2d": np.where(has2, dates[r2i], None),
        "open_2d": np.where(has2, df.Open.values[r2i], np.nan),
        "close_2d": np.where(has2, close[r2i], np.nan),
        "o2c_2d_pct": np.where(has2, df.oc.values[r2i], np.nan),
        "sector": [sector_map.get(t) for t in sym[r]],
        "industry": [industry_map.get(t) for t in sym[r]],
        "market_cap": [mcap_map.get(t) for t in sym[r]],
        "turnover": df.turnover.values[r],
        "pre_turnover_20d_median": df.pre_turnover.values[r],
    })
    for k, v in extra.items():
        out[k] = v
    # forward returns from the case-specific anchor (set by caller via 'anchor_rows')
    return out, r2


# ---------------------------------------------------------------- CASE 1
print("[4/6] Case 1 extraction")


def case1_hit(rows):
    """All Case-1 conditions on given df rows (NaN -> False)."""
    b = df.iloc[rows]
    mc_ok = np.array([(mcap_map.get(t) or 0) >= MCAP_MIN for t in b.Symbol.values])
    with np.errstate(invalid="ignore"):
        return ((b.turnover.values >= TURNOVER_MIN) & mc_ok
                & (b.z_cc.values >= Z_THR) & (b.cc.values >= FLOOR)
                & (b.z_gap.values >= Z_THR) & (b.gap.values >= FLOOR))


ev1 = ea[case1_hit(ea.r1.values)].copy()

# reaction-day inference for unlabeled earnings (user decision 2026-07-19):
# spec defines 1day as "주가 첫 반응일" — if the same-day bar passes everything
# treat as BMO; else if the next-day bar passes, treat as AMC.
u = unl.copy()
hit_d0 = case1_hit(u.r0.values)
r0n = u.r0.values + 1
valid_n = (r0n < len(df)) & (sym[np.clip(r0n, 0, len(df) - 1)] == u.ticker.values)
hit_d1 = np.zeros(len(u), bool)
hit_d1[valid_n] = case1_hit(r0n[valid_n])
inf_bmo = u[hit_d0].assign(tod="BMO", r1=lambda x: x.r0)
inf_amc = u[~hit_d0 & hit_d1].assign(tod="AMC", r1=lambda x: x.r0 + 1)
inferred = pd.concat([inf_bmo, inf_amc], ignore_index=True)
print(f"  반응일 추론으로 편입된 무라벨 어닝: {len(inferred)} (BMO {len(inf_bmo)} / AMC {len(inf_amc)})")

ev1["inferred"] = False
inferred["inferred"] = True
ev1 = pd.concat([ev1[["ticker", "d", "tod", "r1", "inferred"]],
                 inferred[["ticker", "d", "tod", "r1", "inferred"]]], ignore_index=True)
# a labeled event wins if the same (ticker, 1day-row) somehow appears twice
ev1 = ev1.sort_values("inferred").drop_duplicates(subset=["ticker", "r1"], keep="first")
rows1 = ev1.r1.values.astype(int)

c1, r2_1 = build_frame(rows1, "earnings",
                       {"earnings_date": ev1.d.values, "time_of_day": ev1.tod.values,
                        "tod_inferred": ev1.inferred.values})
# Case 1 forward anchor = 2day close (missing 2day -> nan, left as missing)
c1["close_1m"] = fwd_close(r2_1, FWD1)
c1["close_2m"] = fwd_close(r2_1, FWD2)
c1["fwd_1m_pct"] = (c1.close_1m - c1.close_2d) / c1.close_2d * 100
c1["fwd_2m_pct"] = (c1.close_2m - c1.close_2d) / c1.close_2d * 100
c1["turnover_fmt"] = c1.turnover.map(fmt_money)
col_order = ["ticker", "event_date", "event_type", "earnings_date", "time_of_day", "tod_inferred",
             "prev_close", "open_1d", "close_1d", "gap_pct", "cc_pct", "o2c_1d_pct",
             "sd60_gap", "sd60_cc", "z_gap", "z_cc", "gap_pctile",
             "date_2d", "open_2d", "close_2d", "o2c_2d_pct",
             "close_1m", "close_2m", "fwd_1m_pct", "fwd_2m_pct",
             "sector", "industry", "market_cap", "turnover", "turnover_fmt",
             "pre_turnover_20d_median"]
c1 = c1[col_order].sort_values(["event_date", "ticker"], ascending=[False, True])
c1.round(4).to_csv(os.path.join(OUT, "case1_earnings_events.csv"),
                   index=False, encoding="utf-8-sig")
print(f"  Case 1 events: {len(c1):,}  (o2c>0 {int((c1.o2c_1d_pct>0).sum())} / "
      f"o2c<0 {int((c1.o2c_1d_pct<0).sum())})  range {c1.event_date.min()}~{c1.event_date.max()}")

# ---------------------------------------------------------------- CASE 2
print("[5/6] Case 2 extraction")
m2 = (~is_ew
      & (df.turnover.values >= TURNOVER_MIN)
      & np.array([(mcap_map.get(t) or 0) >= MCAP_MIN for t in sym])
      & ~np.isnan(df.z_gap.values)
      & (df.z_gap.values >= Z_THR) & (df.gap.values >= FLOOR))
cand = np.where(m2)[0]

# news on event day OR previous TRADING day (prev row of same symbol)
prev_rows = cand - 1
prev_ok = (prev_rows >= 0) & (sym[np.clip(prev_rows, 0, len(df) - 1)] == sym[cand])
same_src, prev_src = [], []
for i, r in enumerate(cand):
    s = news.get((sym[r], dates[r]), set())
    p = news.get((sym[r], dates[prev_rows[i]]), set()) if prev_ok[i] else set()
    same_src.append(s)
    prev_src.append(p)
has_news = np.array([bool(s | p) for s, p in zip(same_src, prev_src)])
rows2 = cand[has_news]
ss = [s for s, keep_ in zip(same_src, has_news) if keep_]
ps = [p for p, keep_ in zip(prev_src, has_news) if keep_]

prev_rows2 = rows2 - 1        # 직전 거래일 (gap 이 존재하므로 항상 같은 심볼)
c2, _ = build_frame(rows2, "news_gap", {
    "news_same_day": [bool(s) for s in ss],
    "news_prev_day": [bool(p) for p in ps],
    "news_sources": ["|".join(sorted(s | p)) for s, p in zip(ss, ps)],
    "news_titles_same_day": [titles_str((sym[r], dates[r])) for r in rows2],
    "news_titles_prev_day": [titles_str((sym[r], dates[pr]))
                             for r, pr in zip(rows2, prev_rows2)],
})
# Case 2 forward anchor = event-day (1day) close
c2["close_1m"] = fwd_close(rows2, FWD1)
c2["close_2m"] = fwd_close(rows2, FWD2)
c2["fwd_1m_pct"] = (c2.close_1m - c2.close_1d) / c2.close_1d * 100
c2["fwd_2m_pct"] = (c2.close_2m - c2.close_1d) / c2.close_1d * 100
c2["turnover_fmt"] = c2.turnover.map(fmt_money)
col2 = ["ticker", "event_date", "event_type",
        "prev_close", "open_1d", "close_1d", "gap_pct", "cc_pct", "o2c_1d_pct",
        "sd60_gap", "sd60_cc", "z_gap", "z_cc", "gap_pctile",
        "date_2d", "open_2d", "close_2d", "o2c_2d_pct",
        "close_1m", "close_2m", "fwd_1m_pct", "fwd_2m_pct",
        "news_same_day", "news_prev_day", "news_sources",
        "news_titles_same_day", "news_titles_prev_day",
        "sector", "industry", "market_cap", "turnover", "turnover_fmt",
        "pre_turnover_20d_median"]
c2 = c2[col2].sort_values(["event_date", "ticker"], ascending=[False, True])
c2.round(4).to_csv(os.path.join(OUT, "case2_news_gap_events.csv"),
                   index=False, encoding="utf-8-sig")
print(f"  Case 2 events: {len(c2):,}  (o2c>0 {int((c2.o2c_1d_pct>0).sum())} / "
      f"o2c<0 {int((c2.o2c_1d_pct<0).sum())})  range {c2.event_date.min()}~{c2.event_date.max()}")

# ---------------------------------------------------------------- summary
print("[6/6] summary")
for name, c in [("case1", c1), ("case2", c2)]:
    print(f"  {name}: n={len(c)}  +1M avail {int(c.fwd_1m_pct.notna().sum())}  "
          f"+2M avail {int(c.fwd_2m_pct.notna().sum())}  "
          f"2day avail {int(c.o2c_2d_pct.notna().sum())}  "
          f"sector missing {int(c.sector.isna().sum())}")
print("done.")
