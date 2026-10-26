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
4. commits `app/public/data/` and the notebook's own matplotlib figures
   (`pipeline/out/reference/`, for checking the app's charts against) only if every check passes.

One addition the notebook doesn't make: the short vs long term split. The export cell calls the
library's own `frequency_connectedness` (Baruník-Křehlík) on the notebook's own `returns` and
`log_vola`, with the notebook's VAR settings and the library's default bands (≤5, 5–20, >20
weeks, 100-week horizon). `validate.py` checks that the bands add up, the same identity the
library's tests check.

### The other datasets (public APIs)

The selector at the top of the app offers more datasets, each fetched from a public API and run
through the library's own `static_connectedness`, `dynamic_connectedness` and
`frequency_connectedness` with the demo's settings (generalized, VAR(2), 10-step horizon), by
`pipeline/run_datasets.py`. Fetching and preparing each one is in `pipeline/datasets/sources.py`:

| Dataset | API | Series modelled |
|---|---|---|
| Currencies | FRED (St. Louis Fed) | weekly % change in each currency's US-dollar value, 2006– |
| Euro-area government bonds | ECB Data Portal (IRS) | monthly change in 10-year yields, basis points |
| Crypto | Coinbase Exchange | daily % change in US-dollar prices |
| US industries | Kenneth French Data Library | weekly returns of 30 industry portfolios, 1990– |
| Rivers | USGS Water Services | weekly log-flow anomaly at Mississippi-system gauges |
| European temperatures | Open-Meteo (ERA5) | weekly temperature anomaly in 15 capitals |

The preparation (which series, which transform, the window length) is ours, not the authors';
the numbers are the library's. Each build is checked against the library's own identities.
Datasets are independent: one API failing keeps that dataset's last good build.

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
network grouped by region with its net bars, the full pair matrix, and a detail panel for
the selected market or pair. Returns/volatility and
light/dark sit in the top bar. `styleguide/` has the matplotlib-portable version of the same
colour system.

## Layout

See `SPEC.md` section 2. Short version: `pipeline/` is what turns the notebook's output into
the app's data (`run_demo.py`, `export_cell.py`, `validate.py`). `app/` is the Vite + TypeScript + D3 explorer.
`vendor/PyConnectedness` is the pinned submodule the pipeline installs and imports.
