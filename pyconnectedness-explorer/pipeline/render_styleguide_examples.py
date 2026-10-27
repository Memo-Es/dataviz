"""
Renders the three example figures in styleguide/STYLE_GUIDE.md: the same real library
functions as the notebook (plot_connectedness_graph, spillover_heatmap, a plain line plot for
the rolling index), restyled by recolouring their matplotlib output after the fact -- not by
changing the library. Run after pipeline/run_demo.py: it reads the Yahoo Finance download that
run saved (app/public/data/raw_snapshot.csv.gz), so the numbers match what's in app/public/data/.
"""
from __future__ import annotations

import pinned  # noqa: F401  (the library from the pinned GitHub submodule)
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.colors as mcolors
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

import json  # noqa: E402

from pyconnectedness import dynamic_connectedness, static_connectedness  # noqa: E402
from pyconnectedness.viz import connectedness_graph, plot_connectedness_graph, spillover_heatmap  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
STYLEGUIDE = ROOT / "styleguide"
OUT = STYLEGUIDE / "examples"
OUT.mkdir(parents=True, exist_ok=True)

# ---- palette (styleguide/STYLE_GUIDE.md) ----
SEND = "#e34948"
RECV = "#2a78d6"
EDGE = "#52514e"
SECONDARY = "#52514e"  # crises are marked in neutral ink: red means "net sender" only
PRIMARY = "#0b0b0b"
MUTED = "#898781"
GRID = "#e1e0d9"
SURFACE = "#fcfcfb"

sys.path.insert(0, str(STYLEGUIDE))
from pcstyle import mono_number, mono_numbers, register_fonts  # noqa: E402

if not register_fonts():
    print("fonts missing: run `python styleguide/get_fonts.py` first (falling back to DejaVu Sans)")
plt.style.use(str(STYLEGUIDE / "pyconnectedness.mplstyle"))

# ---- the notebook's own cell 6, on the raw download run_demo.py saved ----
DATA = ROOT / "app" / "public" / "data"
markets = {t: n for n, t in json.loads((DATA / "connectedness.json").read_text())["tickers"].items()}
raw = pd.read_csv(DATA / "raw_snapshot.csv.gz", header=[0, 1], index_col=0, parse_dates=True)
close = raw["Close"].rename(columns=markets)[list(markets.values())]
high = raw["High"].rename(columns=markets)[list(markets.values())]
low = raw["Low"].rename(columns=markets)[list(markets.values())]
weekly_close = close.resample("W-FRI").last().ffill()
weekly_high = high.resample("W-FRI").max().ffill()
weekly_low = low.resample("W-FRI").min().ffill()
returns = np.log(weekly_close).diff().mul(100)
volatility = 100 * np.sqrt(52 * 0.361 * (np.log(weekly_high) - np.log(weekly_low)) ** 2)
sample = returns.dropna().index.intersection(volatility.dropna().index)
returns = returns.loc[sample]

ret_conn = static_connectedness(returns, horizon=10, method="generalized", lags=2)
ret_dyn = dynamic_connectedness(returns, window=200, horizon=10, method="generalized", lags=2)

episodes = {
    "2001-09-30": "dot-com", "2008-10-31": "Lehman", "2011-09-30": "euro-area crisis",
    "2015-08-31": "China devaluation", "2020-03-31": "COVID crash", "2022-09-30": "inflation shock",
}


def recolor_network(ax):
    """Recolours plot_connectedness_graph's own output artists in place -- no library change."""
    tab_red = mcolors.to_rgba("tab:red")
    tab_blue = mcolors.to_rgba("tab:blue")
    for coll in ax.collections:
        fc = coll.get_facecolors()
        if len(fc) == 0:
            continue
        new = []
        for rgba in fc:
            if np.allclose(rgba[:3], tab_red[:3], atol=0.05):
                new.append(mcolors.to_rgba(SEND, alpha=0.9))
            elif np.allclose(rgba[:3], tab_blue[:3], atol=0.05):
                new.append(mcolors.to_rgba(RECV, alpha=0.9))
            else:
                new.append(rgba)
        coll.set_facecolor(new)
    for patch in ax.patches:
        patch.set_color(EDGE)
        patch.set_alpha(0.6)
    for txt in ax.texts:
        txt.set_fontsize(9.5)
        txt.set_color(PRIMARY)


# ---- 1. network: cell 19, recoloured ----
threshold = np.percentile(np.abs(ret_conn.pairwise_net.to_numpy()), 90)
graph = connectedness_graph(ret_conn, threshold=threshold)
fig, ax = plt.subplots(figsize=(8, 7.5))
plot_connectedness_graph(graph, ax=ax, node_scale=1400, edge_scale=3.5)
recolor_network(ax)
fig.suptitle("Who sends risk to whom", x=0.02, y=0.98, ha="left", fontsize=16, fontweight="bold")
ax.set_title(f"Strongest 10% of links, full sample  ·  threshold {threshold:.2f}%",
             loc="left", fontsize=9.5, color=MUTED, pad=8)
fig.subplots_adjust(top=0.90)
legend_elems = [
    plt.Line2D([0], [0], marker="o", color="none", markerfacecolor=SEND, markersize=10, label="net sender"),
    plt.Line2D([0], [0], marker="o", color="none", markerfacecolor=RECV, markersize=10, label="net receiver"),
]
ax.legend(handles=legend_elems, loc="lower center", bbox_to_anchor=(0.5, -0.06), ncol=2, frameon=False, fontsize=10)
fig.savefig(OUT / "network_restyled.png", dpi=150, bbox_inches="tight", facecolor=SURFACE)
plt.close(fig)

# ---- 2. heatmap: cell 18 (returns panel only), recoloured + legend ----
fig, ax = plt.subplots(figsize=(7.5, 7))
spillover_heatmap(ret_conn.pairwise_net, ax=ax, cmap="RdBu_r", annotate=False, colorbar=False)
ax.grid(False)  # the style sheet's grid would draw over the cells
im = ax.images[0]
maxabs = float(np.abs(ret_conn.pairwise_net.to_numpy()).max())
im.set_clim(-maxabs, maxabs)
cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
# pairwise_net[i, j] > 0 means row i sends to column j, so the library's default labels
# ("affected variable" rows, "shock source" columns -- right for fevd) read backwards here
cbar.set_label("row receives  ←  0  →  row sends (pp)", fontsize=9, color=MUTED)
ax.set_title("Every pair, net return connectedness", loc="left", fontsize=15, fontweight="bold")
ax.set_xlabel("to this market (column)", fontsize=9.5, color=MUTED)
ax.set_ylabel("from this market (row)", fontsize=9.5, color=MUTED)
mono_numbers(colorbars=[cbar])
fig.savefig(OUT / "heatmap_restyled.png", dpi=150, bbox_inches="tight", facecolor=SURFACE)
plt.close(fig)

# ---- 3. timeline: cell 14 (returns panel only), with crisis context the notebook doesn't have ----
fig, ax = plt.subplots(figsize=(10, 5))
ret_dyn.total.plot(ax=ax, color=PRIMARY, lw=2)
ax.axhline(ret_conn.total, color=MUTED, ls="--", lw=1)
ax.margins(y=0.12)
_, ytop = ax.get_ylim()
for iso, label in episodes.items():
    ts = ret_dyn.total.index[ret_dyn.total.index.searchsorted(iso)]
    ax.axvline(ts, color=SECONDARY, alpha=0.5, lw=1, ls=(0, (2, 3)))
    ax.text(ts + pd.Timedelta(weeks=1), ytop - 0.3, label, fontsize=8.5, color=MUTED,
            rotation=90, va="top", ha="left", zorder=5)
fig.suptitle("When markets became fragile", x=0.02, y=0.98, ha="left", fontsize=16, fontweight="bold")
ax.set_title("Rolling total return spillover, 200-week window, VAR(2), H=10",
             loc="left", fontsize=9.5, color=MUTED, pad=8)
fig.subplots_adjust(top=0.86)
ax.set_ylabel("Total spillover, %")
last = ret_dyn.total.iloc[-1]
mono_number(ax, (ret_dyn.total.index[-1], last), f"{last:.1f}%", xytext=(8, 0), fontsize=13,
            fontweight="bold", color=PRIMARY, va="center")
ax.text(ret_dyn.total.index[0], ret_conn.total, f" full sample {ret_conn.total:.1f}%", fontsize=8.5,
        color=MUTED, va="bottom")
mono_numbers(ax)
fig.savefig(OUT / "timeline_restyled.png", dpi=150, facecolor=SURFACE)
plt.close(fig)

print("wrote", OUT)
