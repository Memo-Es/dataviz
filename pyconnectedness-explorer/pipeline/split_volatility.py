"""
Splits the volatility measure's own static/dynamic/frequency blocks out of connectedness.json
into a sibling volatility.json, for datasets that carry both measures (only "stocks" does, of
the 6 datasets -- see sources.py). Run once, on the already-computed file export_cell.py wrote;
this is a pure, lossless rearrangement of numbers already on disk, not a re-fit, so it does not
re-run the notebook.

Why: the page opens on "Price moves" (returns) -- data.ts's own loadExplorerData comment already
defers the volatility measure's *binary* pairwise matrix for exactly this reason, but the
*metadata* JSON's volatility blocks were still bundled into the one eagerly-fetched
connectedness.json. For "stocks" that's ~590KB of a ~1.36MB file spent on a measure nobody sees
until they explicitly switch to it.

    python split_volatility.py <dir under app/public/data, e.g. "" for stocks>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "app" / "public" / "data"


def main():
    sub = sys.argv[1] if len(sys.argv) > 1 else ""
    base = ROOT / sub
    meta_path = base / "connectedness.json"
    meta = json.loads(meta_path.read_text())

    if "volatility" not in meta.get("dynamic", {}):
        print(f"{meta_path}: no volatility block, nothing to split")
        return

    split = {
        "dynamic": meta["dynamic"].pop("volatility"),
        "static": meta["static"].pop("volatility"),
        "frequency": meta["frequency"].pop("volatility"),
    }
    (base / "volatility.json").write_text(json.dumps(split, separators=(",", ":")))
    meta_path.write_text(json.dumps(meta, separators=(",", ":")))
    print(f"{meta_path}: split out volatility.json "
          f"({len(json.dumps(split))} bytes), main file now {len(json.dumps(meta))} bytes")


if __name__ == "__main__":
    main()
