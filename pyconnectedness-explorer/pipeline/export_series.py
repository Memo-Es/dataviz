"""
Writes the series each dataset models (series.csv, and series_volatility.csv for the stock
markets) next to its connectedness.json, so the code a graph's "Code" menu hands out can load the
exact numbers the explorer ran the library on.

Rebuilt from each dataset's raw snapshot with the same preparation as the build: the demo's cell 6
for the stock markets (Demo.ipynb, pinned 4cc953f), prepare_* in datasets/sources.py for the rest.
Each file is checked before it is written: the library's full-sample total on it must equal the
one in connectedness.json, and the rolling index must match at every window.

    python export_series.py
"""
from __future__ import annotations

import pinned  # noqa: F401  (the library from the pinned GitHub submodule)
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from datasets.sources import FETCH  # noqa: E402
from pyconnectedness import dynamic_connectedness, static_connectedness  # noqa: E402

DATA = Path(__file__).resolve().parents[1] / "app" / "public" / "data"
MODEL = {"horizon": 10, "method": "generalized", "lags": 2}


def demo_series(folder: Path) -> dict[str, pd.DataFrame]:
    """Demo.ipynb cell 6 (and cell 10's log), on the snapshot of what Yahoo returned."""
    meta = json.loads((folder / "connectedness.json").read_text())
    markets = {t: n for n, t in meta["tickers"].items()}
    raw = pd.read_csv(folder / "raw_snapshot.csv.gz", header=[0, 1], index_col=0, parse_dates=True)
    close = raw["Close"].rename(columns=markets)[list(markets.values())]
    high = raw["High"].rename(columns=markets)[list(markets.values())]
    low = raw["Low"].rename(columns=markets)[list(markets.values())]
    weekly_close = close.resample("W-FRI").last().ffill()
    weekly_high = high.resample("W-FRI").max().ffill()
    weekly_low = low.resample("W-FRI").min().ffill()
    returns = np.log(weekly_close).diff().mul(100)
    volatility = 100 * np.sqrt(52 * 0.361 * (np.log(weekly_high) - np.log(weekly_low)) ** 2)
    sample = returns.dropna().index.intersection(volatility.dropna().index)
    return {"returns": returns.loc[sample][meta["names"]], "volatility": np.log(volatility.loc[sample])[meta["names"]]}


def api_series(key: str, folder: Path) -> dict[str, pd.DataFrame]:
    """run_datasets.build()'s preparation, on the snapshot of what the API returned."""
    meta = json.loads((folder / "connectedness.json").read_text())
    raw = pd.read_csv(folder / "raw_snapshot.csv.gz", index_col=0, parse_dates=True)
    X = FETCH[key][1](raw).dropna()
    X = X.loc[:, X.std() > 0]
    return {"returns": X[meta["names"]]}


def check(X: pd.DataFrame, meta: dict, measure: str):
    full = meta["static"][measure]["full"]["total"]
    got = static_connectedness(X, MODEL["horizon"], method=MODEL["method"], lags=MODEL["lags"]).total
    assert abs(got - full) < 1e-3, f"full-sample total {got:.4f}, explorer {full:.4f}"
    dyn = meta["dynamic"][measure]
    d = dynamic_connectedness(X, window=dyn["window"], **MODEL)
    assert [t.strftime("%Y-%m-%d") for t in d.total.index] == dyn["dates"], "rolling dates differ"
    assert np.allclose(d.total.to_numpy(), dyn["total"], atol=1e-3), "rolling index differs"


def main():
    for ds in json.loads((DATA / "datasets.json").read_text()):
        folder = DATA / ds["dir"]
        meta = json.loads((folder / "connectedness.json").read_text())
        series = demo_series(folder) if ds["id"] == "stocks" else api_series(ds["id"], folder)
        for measure, X in series.items():
            name = "series.csv" if measure == "returns" else f"series_{measure}.csv"
            X.to_csv(folder / name, index_label="date", float_format="%.6f")
            check(pd.read_csv(folder / name, index_col=0, parse_dates=True), meta, measure)  # as a reader loads it
            print(f"{ds['id']:<11} {measure:<11} {X.shape[0]} x {X.shape[1]}  ok -> {ds['dir']}{name}")


if __name__ == "__main__":
    main()
