# -*- coding: utf-8 -*-
"""Market-cap-bucket and industry breakdowns of the event CSVs.

- `mcap_bucket` = **EVENT-TIME** bucket: outstanding_shares(현재) × close_1d.
  (스냅샷 시총 버킷팅은 AAOI처럼 이후 재평가된 종목의 과거 이벤트를 엉뚱한
  버킷에 넣는다 — 2026-02 이벤트가 $15B 스냅샷 때문에 10B-100B로 가는 식.)
  스냅샷 기준은 `mcap_bucket_snapshot` 으로 병기.
- Writes raw_data/summary_by_mcap.csv and raw_data/summary_by_industry.csv.
- Writes 6 charts: 1day o2c & +2M by mcap bucket (both cases), +2M by industry
  (both cases, industries with n>=30 only).
"""
import os
import sqlite3

import numpy as np
import pandas as pd

from chartlib import strip_rows, BLUE, ORDINAL4

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "raw_data")
CHARTS = os.path.join(HERE, "..", "charts")
APP = r"C:\github_coding\terminal_sec\terminal\backend\backend\data\app.db"

BUCKETS = [300e6, 1e9, 10e9, 100e9, np.inf]
BLABELS = ["300M-1B", "1B-10B", "10B-100B", "100B+"]
IND_MIN_N = 30

FOOT = ("필터: 시총≥$300M, 당일 turnover≥$100M, σ60≥0.3% · OHLC 정제 적용 · "
        "버킷 = 이벤트 당일 종가 × 현재 발행주식수 (주식수 변동 미반영 주의) · 생성 2026-07-19")

os_map = pd.read_sql(
    "SELECT s.ticker, MAX(p.outstanding_shares) os FROM company_profiles p "
    "JOIN securities s ON s.id=p.security_id "
    "WHERE p.outstanding_shares IS NOT NULL GROUP BY s.ticker",
    sqlite3.connect(f"file:{APP}?mode=ro", uri=True)).set_index("ticker")["os"]

cases = {}
for key, fn in [("case1", "case1_earnings_events.csv"),
                ("case2", "case2_news_gap_events.csv")]:
    c = pd.read_csv(os.path.join(RAW, fn))
    c["market_cap_at_event"] = c.ticker.map(os_map) * c.close_1d
    c["mcap_bucket"] = pd.cut(c.market_cap_at_event, BUCKETS, labels=BLABELS, right=False)
    c["mcap_bucket"] = c.mcap_bucket.cat.add_categories("sub300M_at_event")
    c.loc[c.market_cap_at_event < 300e6, "mcap_bucket"] = "sub300M_at_event"
    c["mcap_bucket_snapshot"] = pd.cut(c.market_cap, BUCKETS, labels=BLABELS, right=False)
    c.to_csv(os.path.join(RAW, fn), index=False, encoding="utf-8-sig")
    cases[key] = c
    moved = (c.mcap_bucket.astype(str) != c.mcap_bucket_snapshot.astype(str)).sum()
    sub = (c.mcap_bucket == "sub300M_at_event").sum()
    print(f"{key}: 이벤트시점 버킷 적용 — 스냅샷 대비 재배치 {moved}건, "
          f"이벤트시점 300M 미만 {sub}건 (버킷 외로 분리)")


def stats_block(g):
    up = g[g.o2c_1d_pct > 0]
    dn = g[g.o2c_1d_pct < 0]
    f1, f2 = g.fwd_1m_pct.dropna(), g.fwd_2m_pct.dropna()
    return pd.Series({
        "n_events": len(g),
        "o2c1d_median": g.o2c_1d_pct.median(),
        "o2c1d_pos_pct": (g.o2c_1d_pct > 0).mean() * 100,
        "o2c2d_after_up_median": up.o2c_2d_pct.median(),
        "o2c2d_after_dn_median": dn.o2c_2d_pct.median(),
        "fwd1m_n": len(f1), "fwd1m_median": f1.median(),
        "fwd1m_mean": f1.mean(), "fwd1m_pos_pct": (f1 > 0).mean() * 100 if len(f1) else np.nan,
        "fwd2m_n": len(f2), "fwd2m_median": f2.median(),
        "fwd2m_mean": f2.mean(), "fwd2m_pos_pct": (f2 > 0).mean() * 100 if len(f2) else np.nan,
    })


# ---------------- summaries ----------------
rows_mc, rows_ind = [], []
for key, c in cases.items():
    for b, g in c.groupby("mcap_bucket", observed=True):
        rows_mc.append(stats_block(g).rename(None).to_frame().T.assign(case=key, mcap_bucket=b))
    for ind, g in c.groupby("industry"):
        if len(g) >= 10:                       # keep raw info liberally in the CSV
            rows_ind.append(stats_block(g).to_frame().T.assign(case=key, industry=ind))

mc = pd.concat(rows_mc, ignore_index=True)
mc = mc[["case", "mcap_bucket"] + [c for c in mc.columns if c not in ("case", "mcap_bucket")]]
mc.round(3).to_csv(os.path.join(RAW, "summary_by_mcap.csv"), index=False, encoding="utf-8-sig")

ind = pd.concat(rows_ind, ignore_index=True)
ind = ind[["case", "industry"] + [c for c in ind.columns if c not in ("case", "industry")]]
ind = ind.sort_values(["case", "fwd2m_median"], ascending=[True, False])
ind.round(3).to_csv(os.path.join(RAW, "summary_by_industry.csv"), index=False, encoding="utf-8-sig")
print("wrote summary_by_mcap.csv / summary_by_industry.csv")

# ---------------- charts: mcap buckets ----------------
TITLES = {"case1": "Case 1 · 어닝", "case2": "Case 2 · 뉴스 갭"}
DEFS = {"case1": "조건: z_cc≥3 & cc≥+4% & z_gap≥3 & gap≥+4%",
        "case2": "조건: z_gap≥3 & gap≥+4% + 당일/직전거래일 뉴스 (어닝 1·2day 제외)"}

for key, c in cases.items():
    rws = []
    for i, b in enumerate(BLABELS):
        g = c[c.mcap_bucket == b]
        rws.append((f"{b}", g.o2c_1d_pct.values, ORDINAL4[i]))
    strip_rows(os.path.join(CHARTS, f"{key}_by_mcap_1day_o2c.png"),
               f"{TITLES[key]} · 1day o2c — 시총 버킷별",
               DEFS[key] + " · 시총 스냅샷 기준", rws, FOOT)

    rws = []
    for i, b in enumerate(BLABELS):
        g = c[c.mcap_bucket == b]
        rws.append((f"{b} · +2개월", g.fwd_2m_pct.values, ORDINAL4[i]))
    anchor = "2day 종가" if key == "case1" else "1day 종가"
    strip_rows(os.path.join(CHARTS, f"{key}_by_mcap_fwd2m.png"),
               f"{TITLES[key]} · {anchor} → +2개월 수익률 — 시총 버킷별",
               DEFS[key] + " · 42거래일 · 미완결 제외", rws, FOOT)

# ---------------- charts: industry (+2M, n>=30) ----------------
for key, c in cases.items():
    stats = (c.groupby("industry")
               .agg(n=("o2c_1d_pct", "size"), f2n=("fwd_2m_pct", "count"),
                    med=("fwd_2m_pct", "median"))
               .query("n >= @IND_MIN_N")
               .sort_values("med", ascending=False))
    rws = [(ind_, c.loc[c.industry == ind_, "fwd_2m_pct"].values, BLUE)
           for ind_ in stats.index]
    anchor = "2day 종가" if key == "case1" else "1day 종가"
    strip_rows(os.path.join(CHARTS, f"{key}_by_industry_fwd2m.png"),
               f"{TITLES[key]} · {anchor} → +2개월 수익률 — industry별 (n≥{IND_MIN_N})",
               DEFS[key] + " · 중앙값 내림차순 · industry 다중비교 주의(우연히 좋아 보이는 업종 존재 가능)",
               rws, FOOT, dense=True)

print("done.")
