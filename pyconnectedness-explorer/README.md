# PyConnectedness Explorer

A prototype that shows how shocks travel between the 20 stock markets in the
[PyConnectedness](https://github.com/zstoi/PyConnectedness) Demo notebook. Pick a week on the
timeline and the network, pair matrix and ranking all update to that week.

It's a design prototype for the coaching, not the stage 2 browser interface (see `CONTEXT.md`).

Start with `CONTEXT.md`, then `SPEC.md`. `CONTEXT.md` is the client's own brief and wins if it
and `SPEC.md` disagree on anything. There's one place that happened (chart styling), logged at
the bottom of `CONTEXT.md`.

## The data is synthetic right now

SPEC.md is clear that every number should come from running `examples/Demo.ipynb` against real
Yahoo Finance data. I couldn't do that here: this sandbox has no route to Yahoo Finance
(`query1.finance.yahoo.com` gets blocked by the egress proxy, though `pypi.org` and `github.com`
are fine). `pipeline/run_demo.py` and `export_cell.py` are written and ready to go the moment
that access exists.

For now, `app/public/data/` comes from `pipeline/run_on_synthetic.py`, which:

1. Makes up a plausible 20-market weekly price panel (`pipeline/synthetic_input.py`), calibrated
   so the full-sample totals land near the real notebook's printed 78.34% / 73.74% and nothing
   more than that.
2. Feeds it through the actual pyconnectedness 0.1.0 library — installed from the pinned
   submodule commit `4cc953f`, not reimplemented — using the real `static_connectedness`,
   `dynamic_connectedness`, `connectedness_graph`, `plot_connectedness_graph` and
   `spillover_heatmap` functions, with every notebook cell copied over as-is.
3. Runs `export_cell.py` unmodified at the end, same as `run_demo.py` would.

So the numbers in `connectedness.json` are genuinely computed by the library, just on fake input
prices. The JSON says so (`"synthetic": true`, plus a note), and the app shows a banner. Don't
loosen `pipeline/validate.py` to make it pass against this output — it's only meaningful against
a real `run_demo.py` run, and it already refuses to run on synthetic data.

`pipeline/out/reference/*.png` are the notebook's own matplotlib figures, rendered with the
real plotting functions on this same synthetic data. Useful for checking the D3 charts in
`app/src/charts/` against the real thing by eye.

### Running it for real

```bash
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -e ../vendor/PyConnectedness   # or: pip install pyconnectedness==0.1.0
python run_demo.py        # needs Yahoo Finance access, takes a few minutes
python validate.py        # should pass before the app uses the data
```

This overwrites `app/public/data/` with the real thing, and the app's banner and footnote pick
that up automatically.

## Running the app

```bash
cd app
npm install
npm run dev     # local dev server
npm run build   # static build, deployed by .github/workflows/pages.yml
```

`public/data/` is committed, so neither the app nor CI ever calls Yahoo.

## Two looks, one toggle

The app opens in the redesign; the top-right toggle switches to the faithful baseline (a pixel
match of the library's own matplotlib defaults) and back. See `CONTEXT.md`'s decision log for
why both exist. `styleguide/` has the matplotlib-portable version of the redesign's colour and
type system -- `styleguide/STYLE_GUIDE.md` is the actual deliverable for the library itself, not
just the web prototype.

## Layout

See `SPEC.md` section 2. Short version: `pipeline/` is what turns the notebook's output into
the app's data (`run_demo.py` for the real run, `run_on_synthetic.py` + `synthetic_input.py` for
what this sandbox actually did instead). `app/` is the Vite + TypeScript + D3 explorer.
`vendor/PyConnectedness` is the pinned submodule the pipeline installs and imports.
