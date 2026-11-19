"""
Vitamin A in NHANES: a test with a known answer (Klüppelberg and Krali, 2021, 2025 -- the same
general-DAG "scaling" method as Flights and Heat waves).

Needs no network access: DR1TOT_I.xpt is already vendored at vendor/PyConnectedness/examples/data
(first-day dietary recall, NHANES 2015-2016, US public domain).

8,327 people with a reliable recall. The food database computes vitamin A (RAE) from its sources,

    VA = RET + BC/12 + (AC + CRYP)/24

so a correct method should put VA last and give it no shock of its own -- `coefs2.loc["VA", "VA"]`
should be about zero. `MaxLinear(intake).fit(k=100, k_order=400)`, as in Miljana's own
demo_nhanes_vitamin_a.ipynb and the replication of Klüppelberg and Krali (2021).

    python run_vitamin_a.py
"""
from __future__ import annotations

import pinned  # noqa: F401  (the library from the pinned GitHub submodule)
import json
from pathlib import Path

import pandas as pd

from pyconnectedness.causality import MaxLinear

ROOT = Path(__file__).resolve().parents[1]
VENDOR_DATA = ROOT / "vendor" / "PyConnectedness" / "examples" / "data"
OUT = ROOT / "app" / "public" / "data" / "vitamin_a"

K = 100
K_ORDER = 400

NAMES = {"DR1TVARA": "VA", "DR1TRET": "RET", "DR1TBCAR": "BC", "DR1TACAR": "AC",
         "DR1TCRYP": "CRYP", "DR1TLZ": "LZ", "DR1TLYCO": "LYCO"}
FULL = {"VA": "Vitamin A", "RET": "Retinol", "BC": "Beta-carotene", "AC": "Alpha-carotene",
        "CRYP": "Beta-cryptoxanthin", "LZ": "Lutein + zeaxanthin", "LYCO": "Lycopene"}
# the notebook's own hand-placed layout (a small fixed DAG, not worth auto-laying-out)
POSITIONS = {"VA": (-0.4, -0.7), "RET": (-1.3, 0.6), "BC": (0.3, 0.2), "AC": (1.2, 0.9),
             "CRYP": (1.0, -1.2), "LZ": (-0.6, 1.4), "LYCO": (0.0, 0.0)}


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    nhanes = pd.read_sas(VENDOR_DATA / "DR1TOT_I.xpt")
    nhanes = nhanes[nhanes["DR1DRSTZ"] == 1]
    intake = nhanes[list(NAMES)].rename(columns=NAMES)
    # SAS export writes zeros as 5.4e-79; the ranks do not change
    intake = intake.mask(intake < 1e-10, 0.0)

    fit = MaxLinear(intake).fit(k=K, k_order=K_ORDER)
    edges = fit.edges(delta=0.0)
    edges = edges[edges["coef"] >= 0.3]  # as in the notebook's own 3D figure

    step = {name: s for s, gen in enumerate(fit.generations) for name in gen}
    share = fit.coefs2.loc["VA"].drop("VA").clip(lower=0).sort_values(ascending=False)

    out = {
        "source": {
            "library": "PyConnectedness",
            "commit": "1e47ed87bbb0b6491743d789718707fcf3821462",
            "data": ["vendor/PyConnectedness/examples/data/DR1TOT_I.xpt (NHANES 2015-2016, CDC)"],
        },
        "method": {
            "call": f'MaxLinear(intake).fit(k={K}, k_order={K_ORDER})',
            "formula": "VA = RET + BC/12 + (AC + CRYP)/24",
            "va_own_share": round(float(fit.coefs2.loc["VA", "VA"]), 4),
        },
        "names": list(NAMES.values()),
        "nodes": [
            {
                "id": n,
                "label": FULL[n],
                "step": step[n],
                "x": POSITIONS[n][0],
                "y": POSITIONS[n][1],
            }
            for n in NAMES.values()
        ],
        "generations": fit.generations,
        "edges": [
            {"cause": c, "effect": e, "coef": round(float(v), 4)}
            for c, e, v in zip(edges["cause"], edges["effect"], edges["coef"])
        ],
        "tail_mass_share": {name: round(float(v) * 100, 2) for name, v in share.items()},
    }

    (OUT / "vitamin_a.json").write_text(json.dumps(out, indent=None, separators=(",", ":")))
    print(f"generations: {fit.generations}")
    print(f"VA's own tail-mass share: {out['method']['va_own_share']} (should be close to 0)")
    print(share.round(3))
    print(f"wrote {OUT / 'vitamin_a.json'}")


if __name__ == "__main__":
    main()
