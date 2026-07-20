# -*- coding: utf-8 -*-
"""Shared strip-chart helpers for the trading-statistics study (light mode)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
BASELINE = "#c3c2b7"
BLUE = "#2a78d6"    # categorical slot 1
GREEN = "#008300"   # categorical slot 2
# ordinal 4-step blue ramp (palette steps 250/350/450/600 — light-mode ordinal band)
ORDINAL4 = ["#86b6ef", "#5598e7", "#2a78d6", "#184f95"]

plt.rcParams.update({
    "font.family": ["Malgun Gothic", "sans-serif"],
    "axes.unicode_minus": False,
    "text.parse_math": False,
    "figure.facecolor": SURFACE,
    "axes.facecolor": SURFACE,
    "savefig.facecolor": SURFACE,
    "text.color": INK,
    "axes.edgecolor": BASELINE,
    "xtick.color": MUTED,
    "ytick.color": INK2,
})

_rng = np.random.default_rng(42)


def strip_rows(path, title, subtitle, rows, footnote, dense=False):
    """Jittered dot rows on one shared %-axis.

    rows: list of (label, values, color). Median tick always drawn.
    dense=True  -> compact rows for many categories; median value goes into the
                   row label (caller-visible) instead of an above-row annotation.
    """
    row_h = 0.55 if dense else 1.15
    fig_h = (1.6 if dense else 1.5) + row_h * len(rows)
    fig, ax = plt.subplots(figsize=(11, fig_h), dpi=160)

    allv = np.concatenate([v[~np.isnan(v)] for _, v, _ in rows])
    lo, hi = np.percentile(allv, [0.5, 99.5])
    pad = (hi - lo) * 0.06
    lo, hi = min(lo - pad, -1), max(hi + pad, 1)

    ax.axvline(0, color=BASELINE, lw=1.2, zorder=1)

    jit = 0.20 if dense else 0.27
    dot = 8 if dense else 11
    ylabels = []
    for i, (label, v, color) in enumerate(rows):
        y0 = len(rows) - 1 - i
        v = v[~np.isnan(v)]
        n_out = int(((v < lo) | (v > hi)).sum())
        vin = np.clip(v, lo, hi)
        ax.scatter(vin, y0 + _rng.uniform(-jit, jit, len(vin)), s=dot,
                   color=color, alpha=0.35, linewidths=0, zorder=2)
        med = float(np.median(v))
        tick = 0.30 if dense else 0.34
        ax.plot([med, med], [y0 - tick, y0 + tick], color=INK, lw=2.0, zorder=3)
        share_pos = (v > 0).mean() * 100
        if dense:
            ylabels.append(f"{label}\nn={len(v):,} · 중앙 {med:+.2f}% · 양수 {share_pos:.0f}%")
        else:
            ax.annotate(f"중앙 {med:+.2f}%", (med, y0 + 0.40), ha="center",
                        va="bottom", fontsize=9.5, color=INK,
                        fontweight="bold", zorder=4)
            info = f"{label}\nn={len(v):,} · 양수 {share_pos:.0f}%"
            if n_out:
                info += f" · 범위 밖 {n_out}건"
            ylabels.append(info)

    ax.set_xlim(lo, hi)
    ax.set_ylim(-0.6, len(rows) - 0.4 + (0.1 if dense else 0.35))
    ax.set_yticks([len(rows) - 1 - i for i in range(len(rows))])
    ax.set_yticklabels(ylabels, fontsize=8.5 if dense else 10,
                       color=INK2, linespacing=1.35 if dense else 1.5)
    ax.tick_params(axis="y", length=0, pad=10)
    ax.grid(axis="x", color=GRID, lw=0.7, zorder=0)
    ax.tick_params(axis="x", labelsize=9.5)
    ax.set_xlabel("등락률 (%)", fontsize=10, color=INK2)
    for s in ["top", "right", "left"]:
        ax.spines[s].set_visible(False)

    # title/subtitle offsets in POINTS so tall figures don't collapse the gap
    ax.set_title(title, fontsize=13.5, fontweight="bold", color=INK,
                 loc="left", pad=30)
    ax.annotate(subtitle, xy=(0, 1), xycoords="axes fraction",
                xytext=(0, 8), textcoords="offset points", fontsize=10,
                color=INK2, ha="left", va="bottom", annotation_clip=False)
    fig.text(0.995, 0.012, footnote, ha="right", va="bottom",
             fontsize=8, color=MUTED)
    fig.tight_layout(rect=[0, 0.02, 1, 1])
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    print("  wrote", path.replace("\\", "/").split("/")[-1])
