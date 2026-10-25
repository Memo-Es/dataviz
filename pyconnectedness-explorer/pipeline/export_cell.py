# ---- export (not in the notebook; only reads objects the notebook already created) ----
# Appended to Demo.ipynb by run_demo.py; validate.py then checks the result against the numbers
# the notebook itself printed.
import json
import os
from pathlib import Path

# The notebook never calls the library's frequency split, so this cell does, using the library's
# own function on the notebook's own series and VAR settings (generalized, VAR(2)). horizon and
# periods are the library defaults: on weekly data, cycles of up to 5 weeks, 5 to 20 weeks, and
# longer than 20 weeks. The split needs a long horizon to resolve cycle lengths, so its bands add
# up to a static run at horizon=100 (exported as static_total), not to the notebook's H=10 totals.
from pyconnectedness import frequency_connectedness

FREQ = {"horizon": 100, "periods": (5, 20), "method": "generalized", "lags": 2}

OUT = Path(os.environ["EXPLORER_DATA_DIR"])
OUT.mkdir(parents=True, exist_ok=True)
names = list(returns.columns)


def r2(a):
    return np.round(np.asarray(a, dtype=float), 3).tolist()


def static_block(res, label, start, end):
    return {
        "label": label,
        "start": str(start),
        "end": str(end),
        "total": float(res.total),
        "to": r2(res.directional_to.reindex(names)),
        "from": r2(res.directional_from.reindex(names)),
        "net": r2(res.net.reindex(names)),
        "pairwise_net": r2(res.pairwise_net.loc[names, names].to_numpy()),
        "fevd": r2(res.fevd.loc[names, names].to_numpy()),
        "threshold_p90": float(np.percentile(np.abs(res.pairwise_net.to_numpy()), 90)),
    }


def freq_block(series):
    res = frequency_connectedness(series, **FREQ)
    ref = static_connectedness(series, FREQ["horizon"], method=FREQ["method"], lags=FREQ["lags"])
    return {
        "horizon": res.horizon,
        "static_total": float(ref.total),
        "static_net": r2(ref.net.reindex(names)),
        "periods": list(FREQ["periods"]),
        "bands": [
            {
                "label": label,
                "share": float(res.share[label]),
                "total": float(res.total[label]),
                "within_total": float(res.within[label].total),
                "to": r2(band.directional_to.reindex(names)),
                "from": r2(band.directional_from.reindex(names)),
                "net": r2(band.net.reindex(names)),
                "pairwise_net": r2(band.pairwise_net.loc[names, names].to_numpy()),
            }
            for label, band in res.bands.items()
        ],
    }


def dyn_block(dyn):
    assert list(dyn.names) == names
    return {
        "dates": [d.strftime("%Y-%m-%d") for d in dyn.total.index],
        "total": r2(dyn.total),
        "to": r2(dyn.directional_to[names].to_numpy()),
        "from": r2(dyn.directional_from[names].to_numpy()),
        "net": r2(dyn.net[names].to_numpy()),
        "window": dyn.window,
        "horizon": dyn.horizon,
        "lags": dyn.lag_order,
        "method": dyn.method,
    }


meta = {
    "names": names,
    "tickers": {v: k for k, v in markets.items()},
    "sample": [str(returns.index.min().date()), str(returns.index.max().date())],
    "weeks": len(returns),
    "episodes": [d.strftime("%Y-%m-%d") for d in episodes],
    "synthetic": False,
    "static": {
        "returns": {
            "full": static_block(
                ret_conn, "Full sample", returns.index.min().date(), returns.index.max().date()
            ),
            "last200": static_block(
                recent, "Last 200 weeks", returns.index[-200].date(), returns.index[-1].date()
            ),
            "p1": static_block(p1, "1997-2006, pre-GFC", "1997", "2006"),
            "p2": static_block(p2, "2007-2012, GFC and euro-area crisis", "2007", "2012"),
            "p3": static_block(p3, "2013-2019, post-crisis", "2013", "2019"),
            "p4": static_block(p4, "2020-2026, COVID and after", "2020", "2026"),
        },
        "volatility": {
            "full": static_block(
                vol_conn, "Full sample", returns.index.min().date(), returns.index.max().date()
            ),
            "p1": static_block(v1, "1997-2006", "1997", "2006"),
            "p2": static_block(v2, "2007-2012", "2007", "2012"),
            "p3": static_block(v3, "2013-2019", "2013", "2019"),
            "p4": static_block(v4, "2020-2026", "2020", "2026"),
        },
    },
    "dynamic": {"returns": dyn_block(ret_dyn), "volatility": dyn_block(vol_dyn)},
    # same windows as the static blocks above, split by cycle length
    "frequency": {
        "returns": {
            "full": freq_block(returns),
            "last200": freq_block(returns.iloc[-200:]),
            "p1": freq_block(returns.loc["1997":"2006"]),
            "p2": freq_block(returns.loc["2007":"2012"]),
            "p3": freq_block(returns.loc["2013":"2019"]),
            "p4": freq_block(returns.loc["2020":"2026"]),
        },
        "volatility": {
            "full": freq_block(log_vola),
            "p1": freq_block(log_vola.loc["1997":"2006"]),
            "p2": freq_block(log_vola.loc["2007":"2012"]),
            "p3": freq_block(log_vola.loc["2013":"2019"]),
            "p4": freq_block(log_vola.loc["2020":"2026"]),
        },
    },
}
(OUT / "connectedness.json").write_text(json.dumps(meta, separators=(",", ":")))

# rolling pairwise matrices: T x k x k float32, little endian, row major; [t][i][j] > 0 means i sends to j
for key, dyn in {"returns": ret_dyn, "volatility": vol_dyn}.items():
    np.asarray(dyn.pairwise_net, dtype="<f4").tofile(OUT / f"pairwise_{key}.f32")

# snapshot of what Yahoo returned today, so the run can be audited later
raw.to_csv(OUT / "raw_snapshot.csv.gz", compression="gzip")
print("wrote", OUT, "| windows:", ret_dyn.n_windows, "| k:", len(names))
