# -*- coding: utf-8 -*-
"""Per case / per market-cap bucket, top-20% (+side) rows for EVERY spec metric.

Metrics (plan.md 4장의 측정 항목 전체):
  o2c_1day              1-1a / 2-1a  이벤트 1day 시가→종가
  o2c_2day_after_plus   1-1c / 2-1b  1day o2c>0 였을 때의 2day o2c
  o2c_2day_after_minus  1-1b / 2-1c  1day o2c<0 였을 때의 2day o2c
  fwd_1m                1-2  / 2-2   앵커 종가 → +21거래일
  fwd_2m                1-2  / 2-2   앵커 종가 → +42거래일

Selection: 버킷 내 해당 지표 상위 20% (값 >= 80퍼센타일). null 지표 행은 제외.
Sort:      event_date 내림차순 (최신이 맨 위).
Output:    raw_data/top20pct_by_mcap/case{1,2}/<metric>_top20_<bucket>.csv
"""
import glob
import os

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "raw_data")
OUT = os.path.join(RAW, "top20pct_by_mcap")

BLABELS = ["300M-1B", "1B-10B", "10B-100B", "100B+"]
SAFE = {"300M-1B": "300M-1B", "1B-10B": "1B-10B", "10B-100B": "10B-100B", "100B+": "100B_plus"}

# metric -> (rank column, pool filter)
METRICS = {
    "o2c_1day": ("o2c_1d_pct", None),
    "o2c_2day_after_plus": ("o2c_2d_pct", lambda g: g.o2c_1d_pct > 0),
    "o2c_2day_after_minus": ("o2c_2d_pct", lambda g: g.o2c_1d_pct < 0),
    "fwd_1m": ("fwd_1m_pct", None),
    "fwd_2m": ("fwd_2m_pct", None),
}

# remove superseded flat files from the previous layout
for f in glob.glob(os.path.join(OUT, "case*_top20_*.csv")):
    os.remove(f)

summary = []
for key, fn in [("case1", "case1_earnings_events.csv"),
                ("case2", "case2_news_gap_events.csv")]:
    c = pd.read_csv(os.path.join(RAW, fn))
    cdir = os.path.join(OUT, key)
    os.makedirs(cdir, exist_ok=True)
    for b in BLABELS:
        gb = c[c.mcap_bucket == b]
        for metric, (col, flt) in METRICS.items():
            g = gb[flt(gb)] if flt is not None else gb
            g = g[g[col].notna()]
            if len(g) < 5:            # 상위 20%가 1행 미만이 되는 극소 pool 은 스킵
                summary.append((key, b, metric, len(g), 0, None, None, None))
                continue
            cut = g[col].quantile(0.8)
            top = g[g[col] >= cut].sort_values("event_date", ascending=False)
            top.to_csv(os.path.join(cdir, f"{metric}_top20_{SAFE[b]}.csv"),
                       index=False, encoding="utf-8-sig")
            summary.append((key, b, metric, len(g), len(top), cut,
                            top[col].median(), top[col].max()))

s = pd.DataFrame(summary, columns=["case", "mcap_bucket", "metric", "pool_n",
                                   "top_n", "cutoff_pct", "top_median_pct",
                                   "top_max_pct"])
s.round(3).to_csv(os.path.join(OUT, "_top20_summary.csv"),
                  index=False, encoding="utf-8-sig")

pd.set_option("display.width", 160)
print(s.to_string(index=False,
                  formatters={"cutoff_pct": lambda v: f"{v:+.2f}" if pd.notna(v) else "-",
                              "top_median_pct": lambda v: f"{v:+.2f}" if pd.notna(v) else "-",
                              "top_max_pct": lambda v: f"{v:+.2f}" if pd.notna(v) else "-"}))
print("\nwrote", os.path.join("top20pct_by_mcap", "_top20_summary.csv"))
