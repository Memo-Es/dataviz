"""
Heat extremes in the central and eastern US (Klüppelberg and Krali, 2021, 2025 -- the same
general-DAG "scaling" method as Flights and Vitamin A).

Needs no network access: the two CSVs in datasets/heat/ are from Miljana's own Demo Day package
(us_tmax_1990_1993.csv: NOAA daily maximum temperature via the R package STRbook, public domain)
-- see datasets/heat/README.md.

Two things, as in Miljana's own demo_us_heat.ipynb:
  - a day-by-day replay of the May 1991 heat wave, station by station, as an anomaly against each
    station's own 31-day-smoothed climatology (°C vs normal for that day of year)
  - nine regions (three latitude bands x three longitude bands), summer months only (May-Sep),
    fit with MaxLinear(k=50, k_order=100), then swept over k_order 40..300 (step 10, k capped at
    min(50, k_order-1): the sweep starts below the default k=50) to see how stable the order is

    python run_heat.py
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
REF = Path(__file__).resolve().parent / "datasets" / "heat"
OUT = ROOT / "app" / "public" / "data" / "heat"

K = 50
K_ORDER = 100
WAVE_START, WAVE_END = "1991-05-08", "1991-05-31"
REGIONS = {
    "Southern Plains": (False, True), "Mid-South": (False, None), "Southeast": (False, False),
    "Central Plains": (None, True), "Midwest": (None, None), "Ohio Valley": (None, False),
    "Northern Plains": (True, True), "Great Lakes": (True, None), "Northeast": (True, False),
}  # name -> (north?, west?); None means "neither" (the middle band)


def _regions(stations: pd.DataFrame) -> pd.Series:
    south = stations["lat"] < 37
    north = stations["lat"] >= 41
    west = stations["lon"] < -93
    east = stations["lon"] >= -86
    return pd.Series(
        np.select(
            [south & west, south & ~west & ~east, south & east,
             ~south & ~north & west, ~south & ~north & ~west & ~east, ~south & ~north & east,
             north & west, north & ~west & ~east, north & east],
            list(REGIONS.keys()), default="",
        ),
        index=stations.index,
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    stations = pd.read_csv(REF / "us_tmax_stations.csv", index_col="station")
    stations.index = stations.index.astype(str)
    tmax = pd.read_csv(REF / "us_tmax_1990_1993.csv", index_col="date", parse_dates=True)
    tmax = (tmax - 32) * 5 / 9  # Fahrenheit -> Celsius
    assert set(tmax.columns) == set(stations.index), "tmax and stations.csv must name the same stations"

    # anomaly against a 31-day-smoothed day-of-year climatology (wraps across the year boundary)
    doy = tmax.index.day_of_year
    clim = tmax.groupby(doy).mean()
    clim = pd.concat([clim.iloc[-15:], clim, clim.iloc[:15]])
    clim = clim.rolling(31, center=True).mean().iloc[15:-15]
    anom = tmax - clim.loc[doy].to_numpy()

    wave = anom.loc[WAVE_START:WAVE_END]

    stations["region"] = _regions(stations)
    regional = anom.T.groupby(stations["region"]).mean().T
    summer = regional[regional.index.month.isin([5, 6, 7, 8, 9])].dropna()

    model = MaxLinear(summer)
    fit = model.fit(k=K, k_order=K_ORDER)
    edges = fit.edges(delta=0.3)

    sweep = stability_sweep(summer, k_orders=list(range(40, 301, 10)), k=lambda ko: min(K, ko - 1))
    summary = position_summary(sweep)

    region_pos = position_in_order(fit.generations)
    stations["mean_position"] = summary["mean_position"].reindex(stations["region"]).to_numpy()

    out = {
        "source": {
            "library": "PyConnectedness",
            "commit": "1e47ed87bbb0b6491743d789718707fcf3821462",
            "data": ["Miljana's Demo Day package: us_tmax_1990_1993.csv (NOAA via STRbook), us_tmax_stations.csv"],
        },
        "method": {
            "call": f'MaxLinear(summer_regional_anomaly).fit(k={K}, k_order={K_ORDER})',
            "note": "fit on 9 regional means (summer months only); the wave replay below is raw per-station anomaly, not model output",
        },
        "stations": [
            {
                "id": sid,
                "lat": round(float(row["lat"]), 4),
                "lon": round(float(row["lon"]), 4),
                "region": row["region"],
                "mean_position": None if pd.isna(row["mean_position"]) else round(float(row["mean_position"]), 4),
            }
            for sid, row in stations.iterrows()
        ],
        "wave": {
            "dates": [d.strftime("%Y-%m-%d") for d in wave.index],
            "anomaly_c": {
                sid: [None if pd.isna(v) else round(float(v), 1) for v in wave[sid]]
                for sid in wave.columns
            },
        },
        "regions": list(REGIONS.keys()),
        "generations": fit.generations,
        "edges": [
            {"cause": c, "effect": e, "coef": round(float(v), 4)}
            for c, e, v in zip(edges["cause"], edges["effect"], edges["coef"])
        ],
        "region_position": {name: round(float(v), 4) for name, v in region_pos.items()},
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

    (OUT / "heat.json").write_text(json.dumps(out, indent=None, separators=(",", ":")))
    print(f"generations (summer, regional): {fit.generations}")
    print(summary.round(2))
    print(f"wrote {OUT / 'heat.json'}")


if __name__ == "__main__":
    main()
