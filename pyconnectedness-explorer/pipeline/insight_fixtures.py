"""
Test data for graph 1's insights (app/src/charts/insights.ts), checked by
app/scripts/check-insights.mjs. Each case is a synthetic upload of a known shape, run through
run_upload, the same code the app runs on a file you upload, so the insights are tested on what
the library really returns for that shape. Only what the insights read is kept.

    python pipeline/insight_fixtures.py     # rewrites app/scripts/fixtures/insights/*.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compute import run_upload  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "app" / "scripts" / "fixtures" / "insights"
rng = np.random.default_rng(7)


def csv(T: int, k: int, freq: str, load: np.ndarray) -> str:
    """k series driven by one common factor with weight load[t] (0: unrelated, 1: one shock)."""
    f = rng.standard_normal(T)
    e = rng.standard_normal((T, k))
    X = load[:, None] * f[:, None] * rng.uniform(0.8, 1.2, k) + np.sqrt(1 - load[:, None] ** 2 * 0.9) * e
    df = pd.DataFrame(X, index=pd.date_range("2000-01-07", periods=T, freq=freq), columns=[f"S{i + 1}" for i in range(k)])
    df.index.name = "date"
    return df.to_csv()


def bursts(T: int, base: float, at: list[int], width: int, height: float) -> np.ndarray:
    load = np.full(T, base)
    for s in at:
        load[s:s + width] = height
    return load


CASES = {
    # what each shape is for is asserted in check-insights.mjs
    "calm": (800, 4, "W-FRI", np.full(800, 0.05)),
    "one-shock": (900, 5, "W-FRI", bursts(900, 0.3, [450], 25, 0.95)),
    "daily-2shock": (2000, 3, "B", bursts(2000, 0.3, [600, 1400], 30, 0.95)),
    "monthly-min": (140, 6, "MS", bursts(140, 0.3, [80], 6, 0.9)),
    "many-15": (600, 15, "W-FRI", np.linspace(0.2, 0.8, 600)),
    "regime-up": (900, 5, "W-FRI", np.r_[np.full(450, 0.2), np.full(450, 0.85)]),
    "regime-down": (900, 5, "W-FRI", np.r_[np.full(450, 0.85), np.full(450, 0.2)]),
    "always-high": (800, 4, "W-FRI", np.full(800, 0.97)),
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (T, k, freq, load) in CASES.items():
        meta, _cube, step, window = run_upload(csv(T, k, freq, load), "changes", name)
        m = json.loads(meta)
        measure = next(iter(m["dynamic"]))
        d = m["dynamic"][measure]
        keep = {key: d[key] for key in ("dates", "total", "from", "window", "lags")}
        out = {"name": name, "steps": step + "s", "longRun": m["static"][measure]["full"]["total"], "dynamic": keep}
        (OUT / f"{name}.json").write_text(json.dumps(out, separators=(",", ":")))
        print(name, step, window)
