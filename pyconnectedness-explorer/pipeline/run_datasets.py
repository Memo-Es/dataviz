"""
Builds the explorer's other datasets (pipeline/datasets/sources.py): fetch each from its public
API, then compute everything with PyConnectedness's own functions (compute.py, the same file the
app runs on an uploaded file), and write the same files export_cell.py writes for the stock-market
dataset.

Each dataset is independent: one API failing leaves that dataset's last good build in place and
doesn't stop the others. Writes app/public/data/datasets.json, the selector's list, last.

    python run_datasets.py            # all
    python run_datasets.py fx rivers  # some
"""
from __future__ import annotations

import pinned  # noqa: F401  (the library from the pinned GitHub submodule)
import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compute import compute  # noqa: E402
from datasets.sources import DESCRIPTORS, FETCH  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app" / "public" / "data"


def build(key: str) -> dict:
    d = DESCRIPTORS[key]
    fetch, prepare = FETCH[key]
    raw = fetch()
    X = prepare(raw).dropna()
    X = X.loc[:, X.std() > 0]  # a constant column would make the VAR singular
    W = d["window"]
    if len(X) < W + 200:
        raise RuntimeError(f"only {len(X)} rows for a {W}-row window")
    meta, cube = compute(X, W, d["steps"], key, d["labels"], list(d["episodes"]))
    out = DATA / key
    out.mkdir(parents=True, exist_ok=True)
    (out / "connectedness.json").write_text(json.dumps(meta, separators=(",", ":")))
    cube.tofile(out / "pairwise_returns.f32")
    raw.to_csv(out / "raw_snapshot.csv.gz", compression="gzip")
    full = meta["static"]["returns"]["full"]
    return {"rows": len(X), "k": X.shape[1], "sample": meta["sample"], "total": full["total"]}


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
