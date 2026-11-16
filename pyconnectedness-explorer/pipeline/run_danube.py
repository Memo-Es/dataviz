"""
Graph 4: the directed tree for extremes on the Upper Danube (Tran, Buck and Klueppelberg, 2024).

Needs no network access: every number comes from files already in the repo --
PyConnectedness's own `examples/data/danube_log_discharges.csv` (the model's input) and
`danube_network.csv` (the paper's ground-truth tree, used here only to report how close the
estimate comes), read through the pinned submodule so the exact library code runs. Station
names, coordinates and the river lines for the map are not something the library carries (its
two CSVs are unlabelled matrices); `pipeline/datasets/danube/` supplies only that -- see its
README.md for exactly where each file comes from and how to re-derive it.

Fits `MaxLinear(...).fit(method="qtree")`. The data file is already in natural log scale, so
`log=False`. The threshold and lower quantile are not fixed by any docstring or example for this
dataset (no Danube notebook has landed in the library yet), so both are chosen by the library's
own `MaxLinear.select_threshold` (Algorithm 2 of the paper) rather than its generic defaults
(threshold=0.8, lower=0.05) -- see README.md at the repo root for why, and what was selected.

    python run_danube.py
"""
from __future__ import annotations

import pinned  # noqa: F401  (the library from the pinned GitHub submodule)
import json
from pathlib import Path

import pandas as pd

from pyconnectedness.causality import MaxLinear

ROOT = Path(__file__).resolve().parents[1]
VENDOR_DATA = ROOT / "vendor" / "PyConnectedness" / "examples" / "data"
REF = Path(__file__).resolve().parent / "datasets" / "danube"
OUT = ROOT / "app" / "public" / "data" / "danube"

# the subsampling in select_threshold is random; fixed so the pipeline is reproducible. Checked
# stable across seeds 0-3 and 42 before picking one: every one selects threshold=0.2, lower=0.05.
SELECT_SEED = 0


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    discharges = pd.read_csv(VENDOR_DATA / "danube_log_discharges.csv")
    names = [int(c) for c in discharges.columns]
    assert sorted(names) == list(range(1, 32)), "expected station ids 1..31"

    stations = pd.read_csv(REF / "stations.csv", index_col="station")
    assert sorted(stations.index) == list(range(1, 32)), "stations.csv must cover 1..31"

    model = MaxLinear(discharges, transform=None)  # transform is unused by qtree (see fit's docstring)

    selection = model.select_threshold(log=False, seed=SELECT_SEED)
    fit = model.fit(method="qtree", threshold=selection.threshold, lower=selection.lower, log=False)

    edges = fit.edges()  # columns: cause (upstream), effect (downstream)
    reach = fit.reachability  # reach.loc[j, i]: True if j is upstream of i (direct or not)

    ground_truth = pd.read_csv(VENDOR_DATA / "danube_network.csv", index_col=0)
    ground_truth.columns = [int(c) for c in ground_truth.columns]
    ground_truth.index = [int(i) for i in ground_truth.index]
    order = [int(n) for n in fit.names]
    true_adj = ground_truth.loc[order, order].to_numpy()
    metrics = fit.compare(true_adj).round(4)

    true_edges = {(order[j], order[i]) for i in range(len(order)) for j in range(len(order)) if true_adj[i, j]}
    est_edges = set(zip(edges["cause"].astype(int), edges["effect"].astype(int)))
    undirected = lambda s: {frozenset(e) for e in s}  # noqa: E731
    directed_matches = len(est_edges & true_edges)
    undirected_matches = len(undirected(est_edges) & undirected(true_edges))

    river_lines = json.loads((REF / "rivers_natural_earth.geojson").read_text())

    out = {
        "source": {
            "library": "PyConnectedness",
            "commit": "1e47ed87bbb0b6491743d789718707fcf3821462",
            "data": [
                "examples/data/danube_log_discharges.csv (model input)",
                "examples/data/danube_network.csv (ground truth tree, for the comparison below only)",
            ],
        },
        "method": {
            "call": 'MaxLinear(danube_log_discharges, transform=None).fit(method="qtree", '
                    f'threshold={selection.threshold}, lower={selection.lower}, log=False)',
            "selection": {
                "how": "MaxLinear.select_threshold (Algorithm 2 of Tran, Buck and Klueppelberg, 2024): "
                       "the threshold/lower whose estimated tree varies least across 100 subsamples",
                "seed": SELECT_SEED,
                "threshold": selection.threshold,
                "lower": selection.lower,
                "variability": round(float(selection.variability), 4),
                "grid": json.loads(selection.grid.to_json(orient="records")),
            },
        },
        "root": int(fit.root),
        "stations": [
            {
                "id": int(idx),
                "river": row["river"],
                "lat": round(float(row["lat"]), 6),
                "lon": round(float(row["lon"]), 6),
                "altitude_m": float(row["altitude_m"]),
            }
            for idx, row in stations.iterrows()
        ],
        "edges": [
            {"cause": int(c), "effect": int(e), "score": None if pd.isna(s) else round(float(s), 6)}
            for c, e, s in zip(
                edges["cause"].astype(int), edges["effect"].astype(int),
                [fit.scores.loc[str(c), str(e)] for c, e in zip(edges["cause"], edges["effect"])],
            )
        ],
        "reachability": {
            str(j): sorted(int(i) for i in reach.columns if bool(reach.loc[j, i]))
            for j in reach.index
        },
        "comparison_to_ground_truth": {
            "edges_total": 30,
            "directed_matches": directed_matches,
            "undirected_matches": undirected_matches,
            "metrics": metrics.to_dict(orient="index"),
        },
        "rivers": river_lines,
    }

    (OUT / "danube.json").write_text(json.dumps(out, indent=None, separators=(",", ":")))
    print(f"root: {fit.root}")
    print(f"threshold={selection.threshold} lower={selection.lower} (selected, seed={SELECT_SEED})")
    print(f"edges: {len(est_edges)}; directed matches vs ground truth: {directed_matches}/30; "
          f"undirected matches: {undirected_matches}/30")
    print(metrics)
    print(f"wrote {OUT / 'danube.json'}")


if __name__ == "__main__":
    main()
