"""Run examples/Demo.ipynb from the pinned PyConnectedness commit unchanged, then append
the export cell. See ../SPEC.md section 3 and ../CONTEXT.md for why this exists and why it
must not touch the notebook's own cells.

Requires network access to Yahoo Finance (yfinance) and the vendor/PyConnectedness submodule
checked out at the pinned commit. .github/workflows/notebook-data.yml runs it on a GitHub
runner (which can reach Yahoo) and commits the result; it also runs fine locally.

Also saves the notebook's own figures (its matplotlib outputs, untouched) to
pipeline/out/reference/, for checking the app's charts against by eye.
"""
import base64
import hashlib
import os
from pathlib import Path

import nbformat
from nbclient import NotebookClient

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT / "vendor" / "PyConnectedness"
NB = REPO / "examples" / "Demo.ipynb"
EXPECTED_SHA = "b0508dbd2092ac13e60884956983f6fb1b3b729484078720b186e04811ba9789"

sha = hashlib.sha256(NB.read_bytes()).hexdigest()
if sha != EXPECTED_SHA:
    raise SystemExit(
        f"Demo.ipynb changed upstream ({sha}). Review the diff, then update EXPECTED_SHA."
    )

# MPLBACKEND left unset: ipykernel then uses the inline backend, so each plt.show() keeps
# its figure as a cell output (saved to out/reference/ below)
os.environ.pop("MPLBACKEND", None)
os.environ["EXPLORER_DATA_DIR"] = str(ROOT / "app" / "public" / "data")
# the notebook's kernel imports the library from the pinned submodule, not an installed copy
os.environ["PYTHONPATH"] = os.pathsep.join(filter(None, [str(REPO / "src"), os.environ.get("PYTHONPATH")]))

nb = nbformat.read(NB, as_version=4)
nb.cells.append(nbformat.v4.new_code_cell((ROOT / "pipeline" / "export_cell.py").read_text()))

# cwd = repo root, so cell 3's `while not os.path.isdir("examples")` loop stops immediately
NotebookClient(
    nb, timeout=None, kernel_name="python3", resources={"metadata": {"path": str(REPO)}}
).execute()
nbformat.write(nb, ROOT / "pipeline" / "out" / "Demo.executed.ipynb")

# the notebook's own figures, exactly as its plotting cells drew them
REFERENCE = {
    14: "01_rolling_spillover_index.png",
    17: "02_net_small_multiples.png",
    18: "03_net_pairwise_heatmaps.png",
    19: "04_connectedness_network.png",
    21: "05_last_200_weeks.png",
    28: "periods_heatmaps.png",
}
# kept in out/reference/ for checking the app's charts against by eye (not shown in the app)
targets = [ROOT / "pipeline" / "out" / "reference"]
for d in targets:
    d.mkdir(parents=True, exist_ok=True)
for idx, name in REFERENCE.items():
    pngs = [o["data"]["image/png"] for o in nb.cells[idx].get("outputs", []) if "image/png" in o.get("data", {})]
    if pngs:
        for d in targets:
            (d / name).write_bytes(base64.b64decode(pngs[0]))
