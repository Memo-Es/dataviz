# PyConnectedness Explorer

A prototype that shows how shocks travel between the 20 stock markets in the
[PyConnectedness](https://github.com/zstoi/PyConnectedness) Demo notebook. Pick a week on the
timeline and the network, pair matrix and ranking all update to that week.

It's a design prototype for the coaching, not the stage 2 browser interface (see `CONTEXT.md`).

Start with `CONTEXT.md`, then `SPEC.md`. `CONTEXT.md` is the client's own brief and wins if it
and `SPEC.md` disagree on anything. There's one place that happened (chart styling), logged at
the bottom of `CONTEXT.md`.

## Where the numbers come from

Only from PyConnectedness's own code. `.github/workflows/notebook-data.yml` runs on a GitHub
runner (which can reach Yahoo Finance):

1. checks out the library at the pinned submodule commit `4cc953f` and installs it from there;
2. runs `pipeline/run_demo.py`, which executes `examples/Demo.ipynb` **unchanged** (it stops if
   the notebook's SHA256 differs) and appends one export cell, `pipeline/export_cell.py`, that
   only reads objects the notebook already created;
3. runs `pipeline/validate.py` against the numbers the notebook itself prints (78.34% / 73.74%,
   1323 windows, the episode table, the 2.54% threshold and 20 edges, the period TCIs, ...);
4. commits `app/public/data/` (including the notebook's own matplotlib figures, shown in the
   app's last section) only if every check passes.

One addition the notebook doesn't make: the short vs long term split. The export cell calls the
library's own `frequency_connectedness` (Baruník-Křehlík) on the notebook's own `returns` and
`log_vola`, with the notebook's VAR settings and the library's default bands (≤5, 5–20, >20
weeks, 100-week horizon). `validate.py` checks that the bands add up, the same identity the
library's tests check.

It runs on every push that touches the pipeline, or by hand from the Actions tab. The app
never computes a statistic itself: the one derived value is the strongest-10% cut-off, which
applies the notebook's own rule (cells 19/21) to whichever matrix is on screen.

The earlier synthetic stand-in (`run_on_synthetic.py`, `synthetic_input.py`) is gone.

### Running it locally

```bash
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install ../vendor/PyConnectedness   # the pinned library, not a reimplementation
python run_demo.py        # needs Yahoo Finance access
python validate.py
```

## Running the app

```bash
cd app
npm install
npm run dev     # local dev server
npm run build   # static build, deployed by .github/workflows/pages.yml
```

`public/data/` is committed, so neither the app nor CI ever calls Yahoo.

## The app

One page, top to bottom: a headline finding for the selected window, the rolling spillover
timeline (click/drag or press play to move through the weeks, click a period to compare), the
network grouped by region, net senders and receivers, how fast shocks travel (the frequency
split), the full pair matrix, a detail panel for
the selected market, and the notebook's own figures for comparison. Returns/volatility and
light/dark sit in the top bar. `styleguide/` has the matplotlib-portable version of the same
colour system.

## Layout

See `SPEC.md` section 2. Short version: `pipeline/` is what turns the notebook's output into
the app's data (`run_demo.py`, `export_cell.py`, `validate.py`). `app/` is the Vite + TypeScript + D3 explorer.
`vendor/PyConnectedness` is the pinned submodule the pipeline installs and imports.
