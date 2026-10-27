"""
Import this first: it makes `import pyconnectedness` load the library from the PyConnectedness
GitHub repository pinned as the submodule (vendor/PyConnectedness), not whatever copy is
installed, so the pipeline runs the same code the app copies into the browser.
"""
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "vendor" / "PyConnectedness" / "src"
if not (SRC / "pyconnectedness" / "__init__.py").is_file():
    raise SystemExit("vendor/PyConnectedness is empty: run `git submodule update --init` first")
sys.path.insert(0, str(SRC))

import pyconnectedness  # noqa: E402

assert Path(pyconnectedness.__file__).resolve().is_relative_to(SRC), pyconnectedness.__file__
