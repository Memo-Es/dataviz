"""
Checks app/public/data/connectedness.json against the values the pinned notebook itself
printed (SPEC.md section 5). Stop and report on any failure rather than loosening the
tolerance -- see SPEC.md's non-negotiable rule.

This only makes sense to run against a REAL run of run_demo.py (real Yahoo Finance data).
It will not, and should not, pass against pipeline/run_on_synthetic.py's output: that output
is clearly marked `"synthetic": true` in the JSON, and this script refuses to run on it so a
synthetic run can never be mistaken for a validated one.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "app" / "public" / "data" / "connectedness.json"

CHECKS = []


def check(name):
    def register(fn):
        CHECKS.append((name, fn))
        return fn

    return register


def close(a, b, tol):
    return abs(a - b) <= tol


@check("weeks and sample")
def _(m):
    assert m["weeks"] == 1522, m["weeks"]
    assert m["sample"] == ["1997-07-11", "2026-09-04"], m["sample"]


@check("total return spillover (full)")
def _(m):
    v = m["static"]["returns"]["full"]["total"]
    assert close(v, 78.34, 0.10), v


@check("total volatility spillover (full)")
def _(m):
    v = m["static"]["volatility"]["full"]["total"]
    assert close(v, 73.74, 0.10), v


@check("rolling windows")
def _(m):
    dates = m["dynamic"]["returns"]["dates"]
    assert len(dates) == 1323, len(dates)
    assert dates[0] == "2001-05-04", dates[0]


@check("episode table, returns")
def _(m):
    want = [73.1, 86.1, 87.9, 78.6, 86.6, 86.0]
    episodes = m["episodes"]
    dates = m["dynamic"]["returns"]["dates"]
    total = m["dynamic"]["returns"]["total"]
    for ep, w in zip(episodes, want, strict=True):
        idx = max(i for i, d in enumerate(dates) if d <= ep)
        assert close(total[idx], w, 0.2), (ep, total[idx], w)


@check("episode table, volatility")
def _(m):
    want = [65.4, 84.7, 86.1, 70.2, 82.0, 78.2]
    episodes = m["episodes"]
    dates = m["dynamic"]["volatility"]["dates"]
    total = m["dynamic"]["volatility"]["total"]
    for ep, w in zip(episodes, want, strict=True):
        idx = max(i for i, d in enumerate(dates) if d <= ep)
        assert close(total[idx], w, 0.2), (ep, total[idx], w)


@check("threshold / edges")
def _(m):
    full = m["static"]["returns"]["full"]
    thr = full["threshold_p90"]
    assert close(thr, 2.54, 0.02), thr
    pw = full["pairwise_net"]
    edges = sum(1 for row in pw for v in row if v > thr)
    assert edges == 20, edges


@check("top link: Hong Kong -> China")
def _(m):
    names = m["names"]
    i = names.index("Hong Kong")
    j = names.index("China")
    v = m["static"]["returns"]["full"]["pairwise_net"][i][j]
    assert close(v, 4.47, 0.05), v


@check("last 200 weeks")
def _(m):
    last200 = m["static"]["returns"]["last200"]
    assert close(last200["total"], 71.68, 0.10), last200["total"]
    assert last200["start"] == "2022-11-11", last200["start"]
    assert last200["end"] == "2026-09-04", last200["end"]


@check("periods TCI, returns")
def _(m):
    want = [71.8, 87.4, 78.7, 79.6]
    for key, w in zip(["p1", "p2", "p3", "p4"], want, strict=True):
        v = m["static"]["returns"][key]["total"]
        assert close(v, w, 0.1), (key, v, w)


@check("periods TCI, volatility")
def _(m):
    want = [69.2, 84.1, 70.2, 70.8]
    for key, w in zip(["p1", "p2", "p3", "p4"], want, strict=True):
        v = m["static"]["volatility"][key]["total"]
        assert close(v, w, 0.1), (key, v, w)


def main():
    if not DATA.exists():
        raise SystemExit(f"{DATA} not found; run pipeline/run_demo.py first")
    m = json.loads(DATA.read_text())
    if m.get("synthetic"):
        raise SystemExit(
            "connectedness.json is marked synthetic (no network access to Yahoo Finance "
            "when it was generated, see CONTEXT.md). Validation only means something against "
            "a real run of run_demo.py; refusing to run against synthetic data."
        )

    failures = []
    for name, fn in CHECKS:
        try:
            fn(m)
            print(f"OK   {name}")
        except AssertionError as e:
            failures.append((name, e))
            print(f"FAIL {name}: {e}")

    if failures:
        raise SystemExit(f"\n{len(failures)} check(s) failed")
    print(f"\nAll {len(CHECKS)} checks passed.")


if __name__ == "__main__":
    sys.exit(main())
