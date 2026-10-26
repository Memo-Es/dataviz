"""
Builds the explorer's other datasets (pipeline/datasets/sources.py): fetch each from its public
API, then compute everything with PyConnectedness's own functions, the same calls and settings
the authors' demo uses (generalized, VAR(2), 10-step horizon; frequency split with the library's
defaults), and write the same files export_cell.py writes for the stock-market dataset.

Each dataset is independent: one API failing leaves that dataset's last good build in place and
doesn't stop the others. Writes app/public/data/datasets.json, the selector's list, last.

    python run_datasets.py            # all
    python run_datasets.py fx rivers  # some
"""
from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

import numpy as np
import pandas as pd

from pyconnectedness import dynamic_connectedness, frequency_connectedness, static_connectedness

sys.path.insert(0, str(Path(__file__).resolve().parent))
from datasets.sources import DEMO_MODEL, DESCRIPTORS, FETCH  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app" / "public" / "data"
FREQ = {"horizon": 100, "periods": (5, 20)}  # the library's defaults, as in export_cell.py


def r3(a):
    return np.round(np.asarray(a, dtype=float), 3).tolist()


def build(key: str) -> dict:
    d = DESCRIPTORS[key]
    fetch, prepare = FETCH[key]
    raw = fetch()
    X = prepare(raw).dropna()
    X = X.loc[:, X.std() > 0]  # a constant column would make the VAR singular
    names = list(X.columns)
    W = d["window"]
    if len(X) < W + 200:
        raise RuntimeError(f"only {len(X)} rows for a {W}-row window")
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
        "last200": static(X.iloc[-W:], f"Last {W} {d['steps']}", iso(X.index[-W]), iso(X.index[-1])),
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

    meta = {
        "dataset": key,
        "names": names,
        "tickers": {n: d["labels"].get(n, n) for n in names},
        "sample": [iso(X.index[0]), iso(X.index[-1])],
        "weeks": len(X),
        "episodes": [e for e in d["episodes"] if X.index[0] <= pd.Timestamp(e) <= X.index[-1]],
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
    out = DATA / key
    out.mkdir(parents=True, exist_ok=True)
    (out / "connectedness.json").write_text(json.dumps(meta, separators=(",", ":")))
    np.asarray(dyn.pairwise_net, dtype="<f4").tofile(out / "pairwise_returns.f32")
    raw.to_csv(out / "raw_snapshot.csv.gz", compression="gzip")
    return {"rows": len(X), "k": len(names), "sample": meta["sample"], "total": static_blocks["full"]["total"]}


def write_index():
    """The selector's list: the stock markets first, then every dataset that has a build."""
    entries = []
    for key, d in DESCRIPTORS.items():
        folder = "" if key == "stocks" else f"{key}/"
        if not (DATA / folder / "connectedness.json").exists():
            continue
        entry = {k: v for k, v in d.items() if k != "window"}
        entries.append({"id": key, "dir": folder, **entry})
    (DATA / "datasets.json").write_text(json.dumps(entries, ensure_ascii=False, indent=1))
    return [e["id"] for e in entries]


def main(keys):
    failed = []
    for key in keys:
        print(f"== {key}", flush=True)
        try:
            print("   ", build(key), flush=True)
        except Exception:  # keep going: one API down mustn't block the rest
            failed.append(key)
            traceback.print_exc()
    print("index:", write_index())
    if failed:
        print("FAILED (kept their last good build, if any):", failed)


if __name__ == "__main__":
    main(sys.argv[1:] or list(FETCH))
