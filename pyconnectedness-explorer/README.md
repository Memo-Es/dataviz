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

1. checks out the library at the pinned submodule commit `1e47ed8` and installs it from there;
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

### Graph 4: the directed tree for extremes (Danube)

`pipeline/run_danube.py` builds `app/public/data/danube/danube.json` from the library's own
`MaxLinear(...).fit(method="qtree")`, on `vendor/PyConnectedness/examples/data/danube_log_discharges.csv`
(the data behind Tran, Buck and Klüppelberg, 2024). No network access needed: everything it
reads is already in the repo. It needs the submodule pinned at or after commit `1e47ed8`
("fix qtree", 16 Nov 2026), the first commit with the `causality` module.

- The threshold and lower quantile are chosen by the library's own `MaxLinear.select_threshold`
  (no Danube notebook has landed in the library to fix them instead); currently `0.2` and `0.05`,
  stable across five random seeds tried before picking one to run the pipeline with.
- The estimated tree is checked against the paper's own ground truth,
  `examples/data/danube_network.csv`, with the library's own `.compare()`: 27 of 30 edges match
  either way, 5 of 30 with direction too. Both numbers are in `danube.json` and on the page.
- Station names, coordinates and altitudes are **not** in PyConnectedness; they come from the R
  package [graphicalExtremes](https://github.com/sebastian-engelke/graphicalextremes) (Asadi,
  Davison and Engelke, 2015), whose station numbering was confirmed to match the library's 1–31
  by comparing its 30 physical river edges against `danube_network.csv` directly — they are
  identical, pair for pair. River lines for the map are traced from Natural Earth where a named
  river reaches both gauges, a straight line between the two real gauges otherwise (OpenStreetMap,
  the other source considered, was not reachable from the build environment that put this
  together). See `pipeline/datasets/danube/README.md` for exactly where each file comes from.

```bash
cd pipeline
python run_danube.py
python validate_danube.py
```

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

## For the PyConnectedness team: running, hosting and updating this on your own

**Run it locally.** Two independent pieces, either on its own:

```bash
# the data (only needed again after a library/pipeline change -- the built data is committed)
cd pyconnectedness-explorer/pipeline
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python run_demo.py && python validate.py        # graphs 1-3, needs Yahoo Finance
python run_danube.py && python validate_danube.py   # graph 4, no network needed

# the app
cd ../app
npm install
npm run dev     # http://localhost:5173, live-reloads on any src/ change
```

**Host it.** `.github/workflows/pages.yml` builds `app/` and deploys `app/dist` to GitHub
Pages on every push to this branch; no server to run or maintain. To host it somewhere else
instead, `npm run build` inside `app/` and serve the resulting `app/dist/` folder as static
files (it is relative-pathed, so any path or subdomain works).

**Update it.**

- *A new week of stock data, or a change to the public-API datasets:* nothing to do by hand --
  `.github/workflows/notebook-data.yml` reruns on every push that touches `pipeline/`, and on a
  schedule if one is added; `workflow_dispatch` runs it on demand from the Actions tab.
- *A new PyConnectedness release:* bump the pin --
  `cd pyconnectedness-explorer/vendor/PyConnectedness && git fetch && git checkout <new commit>`,
  commit the submodule pointer change, then push: the workflow above rebuilds every graph's data
  against the new code, including graph 4, and `validate.py`/`validate_danube.py` catch a
  numbers mismatch before anything bad is committed. Update the commit hash hardcoded in
  `app/src/code.ts` (`LIB_COMMIT`) and the `"commit ..."` strings in `app/src/main.ts` to match
  -- these are cited in the UI's "Code" and "Download" output and are not read from the pin
  automatically.
- *A real Danube notebook lands in the library's `examples/`:* if it fixes a threshold and
  lower quantile for this dataset, use those instead of `MaxLinear.select_threshold`'s choice in
  `pipeline/run_danube.py`, and say so in this README and in the page's own sources list.
- *New station or river reference data:* everything non-library-generated for graph 4 lives in
  `pipeline/datasets/danube/`, with its own README on exactly how each file was derived and how
  to redo that.
- *A design or layout change:* `app/src/style.css` for colour/type/spacing (the rules in
  `styleguide/STYLE_GUIDE.md` apply to every graph, including graph 4's map), `app/src/charts/`
  for a chart's own drawing code, `app/src/main.ts` for layout and wiring. `npm run build` catches
  a TypeScript error before it reaches users; there is no automated visual test, so look at the
  page (`npm run dev`) after a change.
