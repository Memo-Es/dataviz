"""
Checks app/public/data/danube/danube.json against the library's own output and this pipeline's
reference files. Run after run_danube.py; .github/workflows adds it next to validate.py.

    python validate_danube.py
"""
from __future__ import annotations

import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "app" / "public" / "data" / "danube" / "danube.json"
CHECKS = []


def check(name):
    def register(fn):
        CHECKS.append((name, fn))
        return fn
    return register


@check("31 stations, ids 1..31")
def _(d):
    ids = sorted(s["id"] for s in d["stations"])
    assert ids == list(range(1, 32)), ids


@check("every station has a river, a lat and a lon")
def _(d):
    for s in d["stations"]:
        assert s["river"], s
        assert -90 <= s["lat"] <= 90 and -180 <= s["lon"] <= 180, s


@check("30 edges, a tree (d-1 edges on 31 nodes), one root")
def _(d):
    assert len(d["edges"]) == 30, len(d["edges"])
    causes = {e["cause"] for e in d["edges"]}
    effects = {e["effect"] for e in d["edges"]}
    ids = {s["id"] for s in d["stations"]}
    assert causes | effects <= ids
    # root-directed: every non-root node has exactly one OUTGOING edge (one path toward the
    # root); it can have any number of incoming ones (a confluence of several tributaries)
    from collections import Counter
    c = Counter(e["cause"] for e in d["edges"])
    assert all(v == 1 for v in c.values()), c
    assert set(c) == ids - {d["root"]}, (set(c), d["root"])
    assert d["root"] not in causes, d["root"]


@check("every edge has a non-negative score")
def _(d):
    for e in d["edges"]:
        assert e["score"] is not None and e["score"] >= 0, e


@check("reachability: an entry for every station, root reaches nothing, everyone reaches root")
def _(d):
    reach = d["reachability"]
    ids = {s["id"] for s in d["stations"]}
    assert set(int(k) for k in reach) == ids
    assert reach[str(d["root"])] == [], reach[str(d["root"])]
    for s in ids - {d["root"]}:
        assert d["root"] in reach[str(s)], (s, reach[str(s)])


@check("the selected threshold/lower are in the grid searched, at its minimum variability")
def _(d):
    sel = d["method"]["selection"]
    grid = sel["grid"]
    best = min(grid, key=lambda r: r["variability"])
    assert abs(best["threshold"] - sel["threshold"]) < 1e-9
    assert abs(best["lower"] - sel["lower"]) < 1e-9
    assert abs(best["variability"] - sel["variability"]) < 5e-4  # sel's is rounded to 4 places


@check("comparison to ground truth is internally consistent")
def _(d):
    c = d["comparison_to_ground_truth"]
    assert c["edges_total"] == 30
    assert 0 <= c["directed_matches"] <= c["undirected_matches"] <= 30
    # this is what caught round 1's reversed-tuple bug (it silently said "5 of 30"): the
    # library's own TPR, from fit.compare(), must agree with the matches counted here
    tpr = c["metrics"]["tree"]["tpr"]
    assert abs(c["directed_matches"] / c["edges_total"] - tpr) < 5e-4, (c["directed_matches"], tpr)


@check("ground-truth tree: a real root, and a real next-hop for every other station")
def _(d):
    gt = d["comparison_to_ground_truth"]["ground_truth_tree"]
    ids = {s["id"] for s in d["stations"]}
    assert gt["root"] in ids
    nxt = {int(k): v for k, v in gt["next"].items()}
    assert set(nxt) == ids - {gt["root"]}, (set(nxt), gt["root"])
    assert set(nxt.values()) <= ids
    # following "next" from anywhere reaches the real root, with no cycle, in at most d-1 steps
    for start in ids:
        cur, seen = start, set()
        for _ in range(len(ids)):
            if cur == gt["root"]:
                break
            assert cur not in seen, f"cycle reaching real root from {start}"
            seen.add(cur)
            cur = nxt[cur]
        assert cur == gt["root"], f"station {start} never reaches the real root via 'next'"


@check("river lines: one per edge, each a LineString of at least 2 points")
def _(d):
    assert len(d["rivers"]["features"]) == len(d["edges"])
    for f in d["rivers"]["features"]:
        assert f["geometry"]["type"] == "LineString"
        assert len(f["geometry"]["coordinates"]) >= 2
        assert f["properties"]["drawn"] in ("traced", "straight")


def main():
    d = json.loads(DATA.read_text())
    failed = 0
    for name, fn in CHECKS:
        try:
            fn(d)
            print(f"  ok  {name}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL  {name}: {e}")
    if failed:
        raise SystemExit(f"{failed} check(s) failed")
    print(f"all {len(CHECKS)} checks passed")


if __name__ == "__main__":
    main()
