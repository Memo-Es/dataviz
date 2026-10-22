"""Run examples/Demo.ipynb from the pinned PyConnectedness commit unchanged, then append
the export cell. See ../SPEC.md section 3 and ../CONTEXT.md for why this exists and why it
must not touch the notebook's own cells.

Requires network access to Yahoo Finance (yfinance) and the vendor/PyConnectedness submodule
checked out at the pinned commit. Neither is available in the sandbox this build ran in, so
this script has not been executed here — see README.md for how to run it once that access
exists, and pipeline/generate_placeholder.py for the stand-in data this build shipped instead.
"""
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

os.environ["MPLBACKEND"] = "Agg"  # plt.show() becomes a no-op, plotting code still runs
os.environ["EXPLORER_DATA_DIR"] = str(ROOT / "app" / "public" / "data")

nb = nbformat.read(NB, as_version=4)
nb.cells.append(nbformat.v4.new_code_cell((ROOT / "pipeline" / "export_cell.py").read_text()))

# cwd = repo root, so cell 3's `while not os.path.isdir("examples")` loop stops immediately
NotebookClient(
    nb, timeout=None, kernel_name="python3", resources={"metadata": {"path": str(REPO)}}
).execute()
nbformat.write(nb, ROOT / "pipeline" / "out" / "Demo.executed.ipynb")
