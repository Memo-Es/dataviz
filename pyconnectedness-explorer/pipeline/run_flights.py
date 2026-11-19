"""
Extreme flight delays at the 20 busiest US airports (Klüppelberg and Krali, 2021, 2025 -- the
general-DAG "scaling" method, not Danube's directed tree).

Needs no network access: the three CSVs in datasets/flights/ are from Miljana's own Demo Day
package (us_flight_delays_2010_2013.csv: US Bureau of Transportation Statistics, public domain;
us_airports.csv: OpenFlights, ODbL 1.0; both via the R package graphicalExtremes) -- see
datasets/flights/README.md for exactly where each came from.

Fits `MaxLinear(delays).fit(method="scaling", k=100, k_order=250)`, as in Miljana's own
demo_flight_delays.ipynb, then sweeps k_order 100..500 (step 20, k fixed at 100) with
pipeline/scaling.py's stability_sweep to show how stable that order is to the choice.

    python run_flights.py
"""
from __future__ import annotations

import pinned  # noqa: F401  (the library from the pinned GitHub submodule)
import json
from pathlib import Path

import numpy as np
import pandas as pd

from pyconnectedness.causality import MaxLinear
from scaling import position_in_order, position_summary, stability_sweep

ROOT = Path(__file__).resolve().parents[1]
REF = Path(__file__).resolve().parent / "datasets" / "flights"
OUT = ROOT / "app" / "public" / "data" / "flights"

K = 100
K_ORDER = 250
DELTA = 0.3  # edges(delta=0.3), as in the notebook -- drops the weakest estimated links


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    airports = pd.read_csv(REF / "us_airports.csv", index_col="airport")
    delays = pd.read_csv(REF / "us_flight_delays_2010_2013.csv", index_col="date", parse_dates=True).dropna()
    routes = pd.read_csv(REF / "us_flight_routes.csv")
    assert set(delays.columns) == set(airports.index), "delays and airports.csv must name the same 20 airports"

    model = MaxLinear(delays)
    fit = model.fit(k=K, k_order=K_ORDER)
    edges = fit.edges(delta=DELTA)

    pos = position_in_order(fit.generations)
    airports["step"] = [fit.generations.index(next(g for g in fit.generations if a in g)) for a in airports.index]
    airports["position"] = airports.index.map(pos)

    sweep = stability_sweep(delays, k_orders=list(range(100, 501, 20)), k=K)
    summary = position_summary(sweep)

    # the 90 busiest routes, for a faint "this is how much the country actually flies between
    # these two" backdrop behind the causal links -- same pairing the notebook draws
    pairs = routes.assign(a=routes[["origin", "dest"]].min(axis=1), b=routes[["origin", "dest"]].max(axis=1))
    pairs = pairs.groupby(["a", "b"])["flights"].sum().nlargest(90).reset_index()

    out = {
        "source": {
            "library": "PyConnectedness",
            "commit": "1e47ed87bbb0b6491743d789718707fcf3821462",
            "data": [
                "Miljana's Demo Day package: us_flight_delays_2010_2013.csv (model input, US BTS)",
                "Miljana's Demo Day package: us_airports.csv (OpenFlights), us_flight_routes.csv (US BTS)",
            ],
        },
        "method": {
            "call": f'MaxLinear(delays).fit(k={K}, k_order={K_ORDER})',
            "delta": DELTA,
        },
        "names": list(airports.index),
        "airports": [
            {
                "id": a,
                "name": row["name"],
                "city": row["city"],
                "lat": round(float(row["lat"]), 4),
                "lon": round(float(row["lon"]), 4),
                "step": int(row["step"]),
                "position": round(float(row["position"]), 4),
            }
            for a, row in airports.iterrows()
        ],
        "generations": fit.generations,
        "edges": [
            {"cause": c, "effect": e, "coef": round(float(v), 4)}
            for c, e, v in zip(edges["cause"], edges["effect"], edges["coef"])
        ],
        "routes": [
            {"a": a, "b": b, "flights": int(f)} for a, b, f in zip(pairs["a"], pairs["b"], pairs["flights"])
        ],
        "stability": {
            "k_orders": sweep.index.tolist(),
            "sweep": {name: [round(float(v), 4) for v in sweep[name]] for name in sweep.columns},
            "summary": {
                name: {
                    "first_share": round(float(row["first_share"]), 4),
                    "last_share": round(float(row["last_share"]), 4),
                    "mean_position": round(float(row["mean_position"]), 4),
                }
                for name, row in summary.iterrows()
            },
        },
    }

    (OUT / "flights.json").write_text(json.dumps(out, indent=None, separators=(",", ":")))
    print(f"sources (step 0): {fit.generations[0]}")
    print(f"{len(out['edges'])} edges at delta={DELTA}, {len(fit.generations)} generations")
    print(f"SFO first step in {int((sweep['SFO'] == 0).sum())} of {len(sweep)} k_order settings")
    print(f"wrote {OUT / 'flights.json'}")


if __name__ == "__main__":
    main()
