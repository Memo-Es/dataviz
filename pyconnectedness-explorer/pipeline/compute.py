"""
The one place the explorer calls PyConnectedness for any dataset that isn't the authors' demo:
the public-API datasets (run_datasets.py, on GitHub) and a file you upload (the app runs this
same file, with the same pinned library, in your browser through Pyodide).

Every number comes from the library's own functions with the demo's settings: generalized
variance decomposition, VAR(2), 10-step horizon; the frequency split with the library's defaults.
Nothing here estimates anything itself; it only cuts the sample into windows and writes down
what the library returns, in the shape export_cell.py writes for the demo.
"""
from __future__ import annotations

import io

import numpy as np
import pandas as pd

from pyconnectedness import dynamic_connectedness, frequency_connectedness, static_connectedness

DEMO_MODEL = {"horizon": 10, "method": "generalized", "lags": 2}
FREQ = {"horizon": 100, "periods": (5, 20)}  # the library's defaults, as in export_cell.py


def r3(a):
    return np.round(np.asarray(a, dtype=float), 3).tolist()


def compute(X: pd.DataFrame, window: int, steps: str, key: str, labels: dict | None = None,
            episodes: list | None = None) -> tuple[dict, np.ndarray]:
    """connectedness.json's content and the rolling pairwise_net cube (T x k x k) for X."""
    names = list(X.columns)
    W = window
    m = DEMO_MODEL

    def static(frame, label, start, end):
        res = static_connectedness(frame, m["horizon"], method=m["method"], lags=m["lags"])
        return {
            "label": label, "start": start, "end": end, "total": float(res.total),
            "to": r3(res.directional_to.reindex(names)), "from": r3(res.directional_from.reindex(names)),
            "net": r3(res.net.reindex(names)),
            "pairwise_net": r3(res.pairwise_net.loc[names, names].to_numpy()),
            "fevd": r3(res.fevd.loc[names, names].to_numpy()),
            "threshold_p90": float(np.percentile(np.abs(res.pairwise_net.to_numpy()), 90)),
        }

    def freq(frame):
        res = frequency_connectedness(frame, FREQ["horizon"], periods=FREQ["periods"], method=m["method"], lags=m["lags"])
        ref = static_connectedness(frame, FREQ["horizon"], method=m["method"], lags=m["lags"])
        return {
            "horizon": res.horizon, "static_total": float(ref.total), "static_net": r3(ref.net.reindex(names)),
            "periods": list(FREQ["periods"]),
            "bands": [
                {"label": lab, "share": float(res.share[lab]), "total": float(res.total[lab]),
                 "within_total": float(res.within[lab].total), "to": r3(b.directional_to.reindex(names)),
                 "from": r3(b.directional_from.reindex(names)), "net": r3(b.net.reindex(names)),
                 "pairwise_net": r3(b.pairwise_net.loc[names, names].to_numpy())}
                for lab, b in res.bands.items()
            ],
        }

    iso = lambda t: t.strftime("%Y-%m-%d")  # noqa: E731
    # four equal sub-periods, like the demo's four (which follow its own historical breaks)
    cuts = np.array_split(np.arange(len(X)), 4)
    periods = {}
    for i, idx in enumerate(cuts, 1):
        part = X.iloc[idx]
        a, b = part.index[0], part.index[-1]
        span = f"{a.year}–{b.year}" if b.year - a.year >= 3 else f"{a:%b %Y}–{b:%b %Y}"
        periods[f"p{i}"] = (part, span, iso(a), iso(b))

    dyn = dynamic_connectedness(X, window=W, horizon=m["horizon"], method=m["method"], lags=m["lags"])
    static_blocks = {
        "full": static(X, "Full sample", iso(X.index[0]), iso(X.index[-1])),
        "last200": static(X.iloc[-W:], f"Last {W} {steps}", iso(X.index[-W]), iso(X.index[-1])),
        **{k: static(part, span, a, b) for k, (part, span, a, b) in periods.items()},
    }
    freq_blocks = {
        "full": freq(X), "last200": freq(X.iloc[-W:]),
        **{k: freq(part) for k, (part, *_rest) in periods.items()},
    }

    # the library's own identities (its tests check the same), on this build
    for blk in static_blocks.values():
        pw = np.array(blk["pairwise_net"])
        assert np.allclose(pw, -pw.T, atol=1e-2), "pairwise_net not antisymmetric"
        assert abs(sum(blk["net"])) < 0.05, "net doesn't sum to zero"
    for fb in freq_blocks.values():
        assert abs(sum(b["total"] for b in fb["bands"]) - fb["static_total"]) < 0.01, "bands don't add up"
    assert np.allclose(dyn.pairwise_net.sum(axis=2), dyn.net.to_numpy(), atol=1e-6)

    labels = labels or {}
    meta = {
        "dataset": key,
        "names": names,
        "tickers": {n: labels.get(n, n) for n in names},
        "sample": [iso(X.index[0]), iso(X.index[-1])],
        "weeks": len(X),
        "episodes": [e for e in (episodes or []) if X.index[0] <= pd.Timestamp(e) <= X.index[-1]],
        "synthetic": False,
        "static": {"returns": static_blocks},
        "dynamic": {"returns": {
            "dates": [iso(t) for t in dyn.total.index], "total": r3(dyn.total),
            "to": r3(dyn.directional_to[names].to_numpy()), "from": r3(dyn.directional_from[names].to_numpy()),
            "net": r3(dyn.net[names].to_numpy()), "window": dyn.window, "horizon": dyn.horizon,
            "lags": dyn.lag_order, "method": dyn.method,
        }},
        "frequency": {"returns": freq_blocks},
    }
    return meta, np.asarray(dyn.pairwise_net, dtype="<f4")


# ---------------------------------------------------------------------------------------------
# your own file
# ---------------------------------------------------------------------------------------------
MAX_SERIES = 25


def read_upload(text: str, kind: str) -> tuple[pd.DataFrame, str, int]:
    """A CSV with dates in the first column and one numeric column per series.

    kind "levels" (prices, index values, counts...): modelled as % changes, as the demo models
    prices. kind "changes": used as they are. Returns the modelled frame, the step word
    (day / week / month, from the dates' spacing) and the rolling window."""
    df = pd.read_csv(io.StringIO(text))
    if df.shape[1] < 3:
        raise ValueError("Need a date column and at least two series.")
    dates = pd.to_datetime(df.iloc[:, 0], errors="coerce")
    if dates.isna().mean() > 0.1:
        raise ValueError(f"The first column ('{df.columns[0]}') should hold dates.")
    keep = dates.notna().to_numpy()
    df = df.iloc[keep, 1:].apply(pd.to_numeric, errors="coerce").set_axis(pd.DatetimeIndex(dates[keep]))
    df = df.loc[:, df.notna().mean() > 0.5].sort_index()
    df = df[~df.index.duplicated(keep="last")]
    if df.shape[1] < 2:
        raise ValueError("Fewer than two columns hold numbers.")
    if df.shape[1] > MAX_SERIES:
        raise ValueError(f"{df.shape[1]} series: keep it to {MAX_SERIES} or fewer.")
    if kind == "levels":
        if (df <= 0).any().any():
            raise ValueError("Some values are zero or negative, so they can't be levels: pick 'Changes'.")
        df = np.log(df).diff().mul(100)
    X = df.dropna()
    X = X.loc[:, X.std() > 0]  # a constant column would make the VAR singular
    days = float(np.median(np.diff(X.index.values).astype("timedelta64[D]").astype(float))) if len(X) > 1 else 0
    step = "day" if days <= 3 else "week" if days <= 10 else "month"
    k = X.shape[1]
    need = 2 * k + 20  # VAR(2) fits 2k+1 numbers per equation: leave room for the estimate
    if len(X) < 4 * need:
        raise ValueError(f"Only {len(X)} complete rows; {k} series need at least {4 * need}.")
    window = int(min(200, max(need, len(X) // 3)))
    return X, step, window


def run_upload(text: str, kind: str, name: str) -> tuple[str, bytes, str, int]:
    """For the app: connectedness.json as text, the pairwise cube's bytes, the step, the window."""
    import json

    X, step, window = read_upload(text, kind)
    meta, cube = compute(X, window, step + "s", "upload")
    meta["upload"] = {"name": name, "kind": kind}
    return json.dumps(meta, separators=(",", ":")), cube.tobytes(), step, window
