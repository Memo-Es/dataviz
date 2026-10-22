"""
Stands in for run_demo.py + export_cell.py since this sandbox can't reach Yahoo Finance (see
../README.md, ../CONTEXT.md). Every cell below is copied as-is from examples/Demo.ipynb at the
pinned commit 4cc953f8de24c2af4de2b62cf87bf1e4fc51ba02 -- cells 6, 10, 13, 15, 21, 26, 27,
stale comments and all ("alternative formula - also consider", "now on avh", etc). Only cells
3/4 (setup + yf.download) are swapped out, for synthetic_input.build_raw_frame(). export_cell.py
runs unmodified at the end, same as run_demo.py would.

Also renders the notebook's own figures (cells 14, 18, 19, 21, 28) with the real
plot_connectedness_graph / spillover_heatmap, into pipeline/out/reference/, so the D3 charts in
the app can be checked against actual matplotlib output.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import synthetic_input as si  # noqa: E402

from pyconnectedness import dynamic_connectedness, static_connectedness  # noqa: E402
from pyconnectedness.viz import (  # noqa: E402
    connectedness_graph,
    plot_connectedness_graph,
    spillover_heatmap,
)

ROOT = Path(__file__).resolve().parents[1]
DATA_OUT = ROOT / "app" / "public" / "data"
REF_OUT = ROOT / "pipeline" / "out" / "reference"
DATA_OUT.mkdir(parents=True, exist_ok=True)
REF_OUT.mkdir(parents=True, exist_ok=True)

t_start = time.time()

# ---- cell 4 equivalent: synthetic stand-in for yf.download (see synthetic_input.py) ----
# the notebook's own `markets` dict is ticker -> name; synthetic_input.TICKERS is the
# reverse (name -> ticker, convenient for building the raw frame), so invert it here.
markets = {ticker: name for name, ticker in si.TICKERS.items()}
raw = si.build_raw_frame(overall_scale=1.0)
print("Synthetic weeks:", len(raw), "| Sample:", raw.index.min().date(), "->", raw.index.max().date())

# ---- cell 6, verbatim from the pinned notebook ----
close = raw["Close"].rename(columns=markets)[list(markets.values())]
high = raw["High"].rename(columns=markets)[list(markets.values())]
low = raw["Low"].rename(columns=markets)[list(markets.values())]

weekly_close = close.resample("W-FRI").last().ffill()
weekly_high = high.resample("W-FRI").max().ffill()
weekly_low = low.resample("W-FRI").min().ffill()

returns = np.log(weekly_close).diff().mul(100)
volatility = 100 * np.sqrt(52 * 0.361 * (np.log(weekly_high) - np.log(weekly_low)) ** 2)
# alternative formula - also consider

# balanced panel: keep only weeks where every market quotes
sample = returns.dropna().index.intersection(volatility.dropna().index)
returns = returns.loc[sample]
volatility = volatility.loc[sample]

print("Markets:", len(returns.columns))
print("Weeks:", len(returns), "| Missing:", int(returns.isna().sum().sum()))
print("Sample:", returns.index.min().date(), "->", returns.index.max().date())

# ---- cell 10, verbatim ----
log_vola = np.log(volatility)

ret_conn = static_connectedness(returns, horizon=10, method="generalized", lags=2)
vol_conn = static_connectedness(log_vola, horizon=10, method="generalized", lags=2)

print("Total return spillover index:    ", round(ret_conn.total, 2), "%")
print("Total vola spillover index:", round(vol_conn.total, 2), "%")

# ---- cell 13, verbatim ----
t0 = time.time()
ret_dyn = dynamic_connectedness(returns, window=200, horizon=10, method="generalized", lags=2)
vol_dyn = dynamic_connectedness(log_vola, window=200, horizon=10, method="generalized", lags=2)
# taken, but not limited to
print("Windows:", ret_dyn.n_windows, "| First:", ret_dyn.total.index[0].date())
print(f"dynamic_connectedness x2: {time.time() - t0:.1f}s")

# ---- cell 15, verbatim ----
episodes = pd.DatetimeIndex(
    [
        "2001-09-30",  # dot-com
        "2008-10-31",  # Lehman
        "2011-09-30",  # euro-area crisis
        "2015-08-31",  # China devaluation
        "2020-03-31",  # COVID crash
        "2022-09-30",  # inflation shock
    ]
)
episode_table = pd.DataFrame(
    {
        "Return spillover": ret_dyn.total.reindex(episodes, method="ffill"),
        "Volatility spillover": vol_dyn.total.reindex(episodes, method="ffill"),
    }
).round(1)
print(episode_table)

# ---- cell 21, verbatim ----
recent = static_connectedness(returns.iloc[-200:], horizon=10, method="generalized", lags=2)
print("Window:", returns.index[-200].date(), "->", returns.index[-1].date())
print("Total return spillover index:", round(recent.total, 2), "%")

# ---- cell 26, verbatim ----
p1 = static_connectedness(returns.loc["1997":"2006"], horizon=10, method="generalized", lags=2)
p2 = static_connectedness(returns.loc["2007":"2012"], horizon=10, method="generalized", lags=2)
p3 = static_connectedness(returns.loc["2013":"2019"], horizon=10, method="generalized", lags=2)
p4 = static_connectedness(returns.loc["2020":"2026"], horizon=10, method="generalized", lags=2)
print("Periods TCI, returns:", round(p1.total, 1), round(p2.total, 1), round(p3.total, 1), round(p4.total, 1))

# ---- cell 27, verbatim ----
v1 = static_connectedness(log_vola.loc["1997":"2006"], horizon=10, method="generalized", lags=2)
v2 = static_connectedness(log_vola.loc["2007":"2012"], horizon=10, method="generalized", lags=2)
v3 = static_connectedness(log_vola.loc["2013":"2019"], horizon=10, method="generalized", lags=2)
v4 = static_connectedness(log_vola.loc["2020":"2026"], horizon=10, method="generalized", lags=2)
print("Periods TCI, volatility:", round(v1.total, 1), round(v2.total, 1), round(v3.total, 1), round(v4.total, 1))

# ---- export_cell.py, executed completely unmodified ----
import os  # noqa: E402

os.environ["EXPLORER_DATA_DIR"] = str(DATA_OUT)
export_ns = dict(globals())
export_ns["__name__"] = "__export_cell__"
exec((ROOT / "pipeline" / "export_cell.py").read_text(), export_ns)

# the export cell writes "synthetic": False since it's notebook-faithful code with no
# knowledge of where its inputs came from; correct that here, from outside the cell, as
# SPEC.md's own non-negotiable rule requires this build to be honest about it.
import json  # noqa: E402

meta_path = DATA_OUT / "connectedness.json"
meta = json.loads(meta_path.read_text())
meta["synthetic"] = True
meta["synthetic_note"] = (
    "Input prices are a synthetic stand-in (pipeline/synthetic_input.py) generated in a "
    "sandbox with no network access to Yahoo Finance -- see README.md and CONTEXT.md. Every "
    "number from here on is computed by the real pyconnectedness 0.1.0 static_connectedness / "
    "dynamic_connectedness functions (pinned commit 4cc953f), calibrated so the full-sample "
    "totals land near the notebook's own 78.34% / 73.74%. It is NOT real market data."
)
meta_path.write_text(json.dumps(meta, separators=(",", ":")))

# ---- reference renders: the notebook's own plotting cells, unmodified, for visual QA ----
fig, axes = plt.subplots(2, 1, figsize=(13, 8), sharex=True)
ret_dyn.total.plot(ax=axes[0], color="black", lw=1)
axes[0].axhline(ret_conn.total, color="grey", ls="--", lw=0.8)
axes[0].set_title("Rolling return spillover index (200-week window, VAR(2), H=10)")
axes[0].set_ylabel("Total spillover, %")
axes[0].grid(alpha=0.3)
vol_dyn.total.plot(ax=axes[1], color="black", lw=1)
axes[1].axhline(vol_conn.total, color="grey", ls="--", lw=0.8)
axes[1].set_title("Rolling volatility spillover index")
axes[1].set_ylabel("Total spillover, %")
axes[1].set_xlabel("")
axes[1].grid(alpha=0.3)
plt.tight_layout()
fig.savefig(REF_OUT / "01_rolling_spillover_index.png", dpi=100)
plt.close(fig)

fig, axes = plt.subplots(1, 2, figsize=(17, 7))
spillover_heatmap(ret_conn.pairwise_net, ax=axes[0], cmap="RdBu_r", annotate=False)
axes[0].set_title("Net pairwise RETURN connectedness (%)")
spillover_heatmap(vol_conn.pairwise_net, ax=axes[1], cmap="RdBu_r", annotate=False)
axes[1].set_title("Net pairwise VOLATILITY connectedness (%)")
plt.tight_layout()
fig.savefig(REF_OUT / "03_net_pairwise_heatmaps.png", dpi=100)
plt.close(fig)

threshold = np.percentile(np.abs(ret_conn.pairwise_net.to_numpy()), 90)
graph = connectedness_graph(ret_conn, threshold=threshold)
print("Threshold:", round(threshold, 2), "% | edges:", graph.number_of_edges())
fig, ax = plt.subplots(figsize=(11, 10))
plot_connectedness_graph(graph, ax=ax, node_scale=1200, edge_scale=3)
ax.set_title("Net pairwise return connectedness, strongest 10% of links")
plt.tight_layout()
fig.savefig(REF_OUT / "04_connectedness_network.png", dpi=100)
plt.close(fig)

fig, axes = plt.subplots(1, 2, figsize=(17, 8))
spillover_heatmap(recent.pairwise_net, ax=axes[0], cmap="RdBu_r", annotate=False)
axes[0].set_title("Net pairwise return connectedness, last 200 weeks (%)")
plot_connectedness_graph(
    connectedness_graph(recent, threshold=np.percentile(np.abs(recent.pairwise_net.to_numpy()), 90)),
    ax=axes[1],
    node_scale=1000,
    edge_scale=3,
)
axes[1].set_title("Network, last 200 weeks")
plt.tight_layout()
fig.savefig(REF_OUT / "05_last_200_weeks.png", dpi=100)
plt.close(fig)

fig, axes = plt.subplots(2, 2, figsize=(16, 14))
spillover_heatmap(p1.pairwise_net, ax=axes[0, 0], cmap="RdBu_r", annotate=False)
axes[0, 0].set_title("1997-2006, pre-GFC")
spillover_heatmap(p2.pairwise_net, ax=axes[0, 1], cmap="RdBu_r", annotate=False)
axes[0, 1].set_title("2007-2012, GFC and euro-area crisis")
spillover_heatmap(p3.pairwise_net, ax=axes[1, 0], cmap="RdBu_r", annotate=False)
axes[1, 0].set_title("2013-2019, post-crisis")
spillover_heatmap(p4.pairwise_net, ax=axes[1, 1], cmap="RdBu_r", annotate=False)
axes[1, 1].set_title("2020-2026, COVID and after")
plt.tight_layout()
fig.savefig(REF_OUT / "periods_heatmaps.png", dpi=100)
plt.close(fig)

print(f"Done in {time.time() - t_start:.1f}s. Data written to {DATA_OUT}, reference PNGs to {REF_OUT}")
