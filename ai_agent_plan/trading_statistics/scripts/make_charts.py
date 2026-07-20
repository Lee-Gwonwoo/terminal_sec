# -*- coding: utf-8 -*-
"""Dot-plot (strip) charts for the trading-statistics study.

Reads ../raw_data/*.csv, writes 6 PNGs to ../charts/.
Design: light surface, thin marks, one shared value axis per figure,
median direct-labeled, off-scale points annotated (never silently dropped).
"""
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "raw_data")
CHARTS = os.path.join(HERE, "..", "charts")
os.makedirs(CHARTS, exist_ok=True)

# palette (dataviz reference instance, light mode)
SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
BASELINE = "#c3c2b7"
BLUE = "#2a78d6"   # categorical slot 1
GREEN = "#008300"  # categorical slot 2

plt.rcParams.update({
    "font.family": ["Malgun Gothic", "sans-serif"],
    "axes.unicode_minus": False,
    "text.parse_math": False,   # '$100M' 같은 텍스트가 mathtext로 오인되는 것 방지
    "figure.facecolor": SURFACE,
    "axes.facecolor": SURFACE,
    "savefig.facecolor": SURFACE,
    "text.color": INK,
    "axes.edgecolor": BASELINE,
    "xtick.color": MUTED,
    "ytick.color": INK2,
})

rng = np.random.default_rng(42)


def strip_rows(path, title, subtitle, rows, footnote):
    """rows: list of (label, values, color). One shared x axis (%), jittered dots."""
    fig_h = 1.5 + 1.15 * len(rows)
    fig, ax = plt.subplots(figsize=(11, fig_h), dpi=160)

    # shared display range: P0.5..P99.5 of all values, padded, zero always visible
    allv = np.concatenate([v[~np.isnan(v)] for _, v, _ in rows])
    lo, hi = np.percentile(allv, [0.5, 99.5])
    pad = (hi - lo) * 0.06
    lo, hi = min(lo - pad, -1), max(hi + pad, 1)

    ax.axvline(0, color=BASELINE, lw=1.2, zorder=1)

    ylabels = []
    for i, (label, v, color) in enumerate(rows):
        y0 = len(rows) - 1 - i
        v = v[~np.isnan(v)]
        n_out = int(((v < lo) | (v > hi)).sum())
        vin = np.clip(v, lo, hi)
        jitter = rng.uniform(-0.27, 0.27, len(vin))
        ax.scatter(vin, y0 + jitter, s=11, color=color, alpha=0.35,
                   linewidths=0, zorder=2)
        med = float(np.median(v))
        ax.plot([med, med], [y0 - 0.34, y0 + 0.34], color=INK, lw=2.0, zorder=3)
        ax.annotate(f"중앙 {med:+.2f}%", (med, y0 + 0.40), ha="center", va="bottom",
                    fontsize=9.5, color=INK, fontweight="bold", zorder=4)
        share_pos = (v > 0).mean() * 100
        info = f"{label}\nn={len(v):,} · 양수 {share_pos:.0f}%"
        if n_out:
            info += f" · 범위 밖 {n_out}건"
        ylabels.append(info)

    ax.set_xlim(lo, hi)
    ax.set_ylim(-0.6, len(rows) - 0.4 + 0.35)
    ax.set_yticks([len(rows) - 1 - i for i in range(len(rows))])
    ax.set_yticklabels(ylabels, fontsize=10, color=INK2, linespacing=1.5)
    ax.tick_params(axis="y", length=0, pad=10)
    ax.grid(axis="x", color=GRID, lw=0.7, zorder=0)
    ax.tick_params(axis="x", labelsize=9.5)
    ax.set_xlabel("등락률 (%)", fontsize=10, color=INK2)
    for s in ["top", "right", "left"]:
        ax.spines[s].set_visible(False)

    ax.set_title(title, fontsize=13.5, fontweight="bold", color=INK,
                 loc="left", pad=26)
    ax.annotate(subtitle, (0, 1.02), xycoords="axes fraction", fontsize=10,
                color=INK2, ha="left", va="bottom")
    fig.text(0.995, 0.012, footnote, ha="right", va="bottom",
             fontsize=8, color=MUTED)
    fig.tight_layout(rect=[0, 0.02, 1, 1])
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    print("  wrote", os.path.basename(path))


c1 = pd.read_csv(os.path.join(RAW, "case1_earnings_events.csv"))
c2 = pd.read_csv(os.path.join(RAW, "case2_news_gap_events.csv"))
FOOT = ("필터: 시총≥$300M, 당일 turnover≥$100M, σ60≥0.3% · OHLC 정제 적용 · "
        "데이터: 2015-01~2026-05 (Case 2는 뉴스 커버리지상 2021-01~) · 생성 2026-07-19")

C1_DEF = "조건: 어닝 1day에서 z_cc≥3 & cc≥+4% & z_gap≥3 & gap≥+4%"
C2_DEF = "조건: 비어닝일 z_gap≥3 & gap≥+4% + 당일/직전거래일 뉴스(PR·8-K) 존재 (어닝 1·2day 제외)"

# ---- Case 1 ----
strip_rows(os.path.join(CHARTS, "case1_1day_o2c.png"),
           "Case 1 · 어닝 1day 시가→종가(o2c) 분포",
           C1_DEF, [("어닝 1day o2c", c1.o2c_1d_pct.values, BLUE)], FOOT)

up = c1[c1.o2c_1d_pct > 0]
dn = c1[c1.o2c_1d_pct < 0]
strip_rows(os.path.join(CHARTS, "case1_2day_o2c_by_sign.png"),
           "Case 1 · 어닝 2day o2c — 1day o2c 부호별",
           C1_DEF + " · 1day o2c 부호로 분기",
           [("1day o2c > 0 → 2day o2c", up.o2c_2d_pct.values, BLUE),
            ("1day o2c < 0 → 2day o2c", dn.o2c_2d_pct.values, GREEN)], FOOT)

strip_rows(os.path.join(CHARTS, "case1_forward_1m_2m.png"),
           "Case 1 · 어닝 2day 종가 → +1개월 / +2개월 수익률",
           C1_DEF + " · 거래일 21일/42일 · 미완결 구간은 제외",
           [("+1개월 (21거래일)", c1.fwd_1m_pct.values, BLUE),
            ("+2개월 (42거래일)", c1.fwd_2m_pct.values, BLUE)], FOOT)

# ---- Case 2 ----
strip_rows(os.path.join(CHARTS, "case2_1day_o2c.png"),
           "Case 2 · 뉴스 갭상승일 시가→종가(o2c) 분포",
           C2_DEF, [("이슈 1day o2c", c2.o2c_1d_pct.values, BLUE)], FOOT)

up2 = c2[c2.o2c_1d_pct > 0]
dn2 = c2[c2.o2c_1d_pct < 0]
strip_rows(os.path.join(CHARTS, "case2_2day_o2c_by_sign.png"),
           "Case 2 · 이슈 2day o2c — 1day o2c 부호별",
           C2_DEF + " · 1day o2c 부호로 분기",
           [("1day o2c > 0 → 2day o2c", up2.o2c_2d_pct.values, BLUE),
            ("1day o2c < 0 → 2day o2c", dn2.o2c_2d_pct.values, GREEN)], FOOT)

strip_rows(os.path.join(CHARTS, "case2_forward_1m_2m.png"),
           "Case 2 · 이슈 1day 종가 → +1개월 / +2개월 수익률",
           C2_DEF + " · 거래일 21일/42일 · 미완결 구간은 제외",
           [("+1개월 (21거래일)", c2.fwd_1m_pct.values, BLUE),
            ("+2개월 (42거래일)", c2.fwd_2m_pct.values, BLUE)], FOOT)

print("done.")
