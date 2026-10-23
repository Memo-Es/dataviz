# PyConnectedness Explorer: build spec

A web prototype that shows how shocks travel between the 20 stock markets in the PyConnectedness Demo notebook. You pick a week on a timeline, and the network, the pair matrix and the ranking update to that week.

This is a design prototype for the coaching, not the stage 2 browser interface. Its job is to test, with real library output, what Miljana listed as success: non-experts can read the main graphs, there is one consistent visual style, and change over time is visible.

A visual reference already exists, built from values read off the notebook's published charts: https://claude.ai/artifact/Q3tLKhRnu7ctFwYFC8SsDJ (file `pyconnectedness-explorer.html`, attached alongside this spec). This build replaces those traced values with the library's own output.

See `CONTEXT.md` for the client questionnaire and the decision it settles: this build targets the faithful current style (the Figma baseline), not the redesign tokens in section 6 below. Those tokens are still used for the app shell — panels, sidebar, footnote — just not the charts themselves. CONTEXT.md explains why.

---

## 1. Non negotiable rule: the numbers come from the Demo notebook, unchanged

Every number in the explorer must come from running `examples/Demo.ipynb` exactly as it is in the PyConnectedness repo. Do not port it, refactor it or "clean it up". Run the notebook itself and only add one export cell at the end that reads objects the notebook already created.

- Source: https://github.com/zstoi/PyConnectedness/blob/main/examples/Demo.ipynb
- Pinned commit: `4cc953f8de24c2af4de2b62cf87bf1e4fc51ba02` (30 Sep 2026, "install pyconnectedness"). It's the latest commit on `main` as of 21 Oct 2026.
- SHA256 of `examples/Demo.ipynb` at that commit: `b0508dbd2092ac13e60884956983f6fb1b3b729484078720b186e04811ba9789`
- The pipeline must stop if the hash doesn't match. When the team updates the notebook, bump the commit and the hash on purpose and rerun the validation (section 5).

### Parameters the notebook uses (for reference only, never set them yourself)

| What | Value | Cell |
|---|---|---|
| Markets | 20 Yahoo tickers, from `^AORD` (Australia) to `^TWII` (Taiwan) | 4 |
| Download | `yf.download(..., start="1997-07-01", end="2026-09-01", interval="1d", auto_adjust=True)` | 4 |
| Weekly data | `resample("W-FRI")`: last close, max high, min low, then `ffill()` | 6 |
| Returns | `np.log(weekly_close).diff().mul(100)` | 6 |
| Volatility | `100 * np.sqrt(52 * 0.361 * (ln H − ln L)**2)` (Parkinson range), modelled as `np.log(volatility)` | 6, 10 |
| Panel | balanced: only weeks where every market quotes (1522 weeks, 1997‑07‑11 to 2026‑09‑04) | 6 |
| Static model | `static_connectedness(..., horizon=10, method="generalized", lags=2)` | 10 |
| Rolling model | `dynamic_connectedness(..., window=200, horizon=10, method="generalized", lags=2)`, 1323 windows, first 2001‑05‑04 | 13 |
| Episodes | `2001-09-30` dot‑com, `2008-10-31` Lehman, `2011-09-30` euro‑area crisis, `2015-08-31` China devaluation, `2020-03-31` COVID crash, `2022-09-30` inflation shock | 15 |
| Strongest links | `np.percentile(np.abs(pairwise_net), 90)`, edges where `pairwise_net > threshold` | 19, 21 |
| Recent window | `returns.iloc[-200:]` (2022‑11‑11 to 2026‑09‑04) | 21 |
| Periods | 1997‑2006, 2007‑2012, 2013‑2019, 2020‑2026 (returns `p1..p4`, volatility `v1..v4`) | 26, 27 |

---

## 2. Its own repo

This lives alongside other data-viz prototypes in `memo-es/dataviz`, under `pyconnectedness-explorer/`:

- PyConnectedness is a tested research library published on PyPI. A web app adds a JS toolchain, data snapshots and deploy config that don't belong in the library's releases or tests.
- The explorer needs network access to Yahoo and a few minutes of compute to rebuild data. The library's CI shouldn't depend on either.
- It keeps the stage 2 browser interface conversation open without committing the library to it. If the team later wants it under their GitHub org, it moves as is.
- License: the library is GPL‑3.0‑or‑later. The pipeline imports it, so the simplest choice is to use GPL‑3.0 for the explorer too. Confirm with Miljana and Zoran.

### Structure

```
pyconnectedness-explorer/
  README.md
  SPEC.md                      ← this file
  CONTEXT.md                   ← client questionnaire + decisions
  vendor/PyConnectedness/      ← git submodule, pinned to 4cc953f
  pipeline/
    requirements.txt           ← pyconnectedness==0.1.0, yfinance, scipy, nbclient, nbformat, ipykernel
    run_demo.py                ← executes Demo.ipynb unchanged + appends the export cell
    export_cell.py             ← the only code we add (section 3)
    validate.py                ← checks against the notebook's own printed outputs (section 5)
    out/Demo.executed.ipynb    ← executed copy, committed for audit (produced by a real run)
  app/                         ← Vite + TypeScript + D3 (section 6)
    public/data/               ← pipeline output, committed (connectedness.json, *.f32)
  .github/workflows/pages.yml  ← build app, deploy to GitHub Pages (data is committed, CI doesn't call Yahoo)
```

Install the library from the pinned submodule (`pip install -e vendor/PyConnectedness`) or as `pyconnectedness==0.1.0` from PyPI. They must match: `__init__.py` reads `importlib.metadata.version("pyconnectedness")`, so importing from a bare `src/` path fails unless the package is installed.

---

## 3. Pipeline

### `pipeline/run_demo.py`

```python
import hashlib, os
from pathlib import Path
import nbformat
from nbclient import NotebookClient

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT / "vendor" / "PyConnectedness"
NB = REPO / "examples" / "Demo.ipynb"
EXPECTED_SHA = "b0508dbd2092ac13e60884956983f6fb1b3b729484078720b186e04811ba9789"

sha = hashlib.sha256(NB.read_bytes()).hexdigest()
if sha != EXPECTED_SHA:
    raise SystemExit(f"Demo.ipynb changed upstream ({sha}). Review the diff, then update EXPECTED_SHA.")

os.environ["MPLBACKEND"] = "Agg"                      # plt.show() becomes a no-op, plotting code still runs
os.environ["EXPLORER_DATA_DIR"] = str(ROOT / "app" / "public" / "data")

nb = nbformat.read(NB, as_version=4)
nb.cells.append(nbformat.v4.new_code_cell((ROOT / "pipeline" / "export_cell.py").read_text()))

# cwd = repo root, so cell 3's `while not os.path.isdir("examples")` loop stops immediately
NotebookClient(nb, timeout=None, kernel_name="python3",
               resources={"metadata": {"path": str(REPO)}}).execute()
nbformat.write(nb, ROOT / "pipeline" / "out" / "Demo.executed.ipynb")
```

### `pipeline/export_cell.py`

I smoke tested this against the library code at the pinned commit (synthetic data, small windows). It runs, and two checks pass: each rolling `pairwise_net[t]` equals `static_connectedness` on the same 200 weeks, and `net` equals the row sum of `pairwise_net`.

```python
# ---- export (not in the notebook; only reads objects the notebook already created) ----
import json, os
from pathlib import Path

OUT = Path(os.environ["EXPLORER_DATA_DIR"])
OUT.mkdir(parents=True, exist_ok=True)
names = list(returns.columns)

def r2(a):
    return np.round(np.asarray(a, dtype=float), 3).tolist()

def static_block(res, label, start, end):
    return {
        "label": label, "start": str(start), "end": str(end),
        "total": float(res.total),
        "to": r2(res.directional_to.reindex(names)),
        "from": r2(res.directional_from.reindex(names)),
        "net": r2(res.net.reindex(names)),
        "pairwise_net": r2(res.pairwise_net.loc[names, names].to_numpy()),
        "fevd": r2(res.fevd.loc[names, names].to_numpy()),
        "threshold_p90": float(np.percentile(np.abs(res.pairwise_net.to_numpy()), 90)),
    }

def dyn_block(dyn):
    assert list(dyn.names) == names
    return {
        "dates": [d.strftime("%Y-%m-%d") for d in dyn.total.index],
        "total": r2(dyn.total),
        "to": r2(dyn.directional_to[names].to_numpy()),
        "from": r2(dyn.directional_from[names].to_numpy()),
        "net": r2(dyn.net[names].to_numpy()),
        "window": dyn.window, "horizon": dyn.horizon, "lags": dyn.lag_order, "method": dyn.method,
    }

meta = {
    "names": names,
    "tickers": {v: k for k, v in markets.items()},
    "sample": [str(returns.index.min().date()), str(returns.index.max().date())],
    "weeks": len(returns),
    "episodes": [d.strftime("%Y-%m-%d") for d in episodes],
    "static": {
        "returns": {
            "full": static_block(ret_conn, "Full sample", returns.index.min().date(), returns.index.max().date()),
            "last200": static_block(recent, "Last 200 weeks", returns.index[-200].date(), returns.index[-1].date()),
            "p1": static_block(p1, "1997-2006, pre-GFC", "1997", "2006"),
            "p2": static_block(p2, "2007-2012, GFC and euro-area crisis", "2007", "2012"),
            "p3": static_block(p3, "2013-2019, post-crisis", "2013", "2019"),
            "p4": static_block(p4, "2020-2026, COVID and after", "2020", "2026"),
        },
        "volatility": {
            "full": static_block(vol_conn, "Full sample", returns.index.min().date(), returns.index.max().date()),
            "p1": static_block(v1, "1997-2006", "1997", "2006"),
            "p2": static_block(v2, "2007-2012", "2007", "2012"),
            "p3": static_block(v3, "2013-2019", "2013", "2019"),
            "p4": static_block(v4, "2020-2026", "2020", "2026"),
        },
    },
    "dynamic": {"returns": dyn_block(ret_dyn), "volatility": dyn_block(vol_dyn)},
}
(OUT / "connectedness.json").write_text(json.dumps(meta, separators=(",", ":")))

# rolling pairwise matrices: T x k x k float32, little endian, row major; [t][i][j] > 0 means i sends to j
for key, dyn in {"returns": ret_dyn, "volatility": vol_dyn}.items():
    np.asarray(dyn.pairwise_net, dtype="<f4").tofile(OUT / f"pairwise_{key}.f32")

# snapshot of what Yahoo returned today, so the run can be audited later
raw.to_csv(OUT / "raw_snapshot.csv.gz", compression="gzip")
print("wrote", OUT, "| windows:", ret_dyn.n_windows, "| k:", len(names))
```

Expected sizes: `pairwise_*.f32` are about 2.1 MB each (1323 × 20 × 20 × 4 bytes), and `connectedness.json` is about 1 MB.

---

## 4. Data contract (what the app can rely on)

- **Units.** Everything is a percentage of forecast error variance, as in the library.
- **Direction.** `pairwise_net[i][j] = θ_ji − θ_ij` (from `static.py`, `C_ij = theta_ji - theta_ij`). A positive value means market i sends to market j. The matrix is antisymmetric with a zero diagonal. This is the same rule `connectedness_graph` uses for edges i → j.
- **Net.** `net[i]` is TO minus FROM, which equals the row sum of `pairwise_net`. Across markets it sums to zero in every window.
- **Dates.** A rolling date is the last week of its 200 week window (right aligned, as in the papers). The value at date t describes the 200 weeks ending at t.
- **Matrix and heatmap axes.** Rows are the "affected variable" and columns the "shock source", as in `spillover_heatmap`. Note that in `pairwise_net` the row is the sender. Label the explorer's matrix in plain words ("row sends to column when red"), not with the library's axis names.

---

## 5. Validation (must pass before the app uses the data)

`validate.py` compares the export with the outputs saved in the committed notebook. Yahoo revises history, so the tolerances are small but not zero. If something fails, stop and report it; don't adjust the tolerances to pass.

| Check | Notebook value | Tolerance |
|---|---|---|
| Trading days / weeks | 7589 / 1522, sample 1997‑07‑11 → 2026‑09‑04 | exact weeks and dates |
| Total return spillover (full) | 78.34 % | ±0.10 |
| Total volatility spillover (full) | 73.74 % | ±0.10 |
| Rolling windows | 1323, first 2001‑05‑04 | exact |
| Episode table, returns | 73.1, 86.1, 87.9, 78.6, 86.6, 86.0 | ±0.2 |
| Episode table, volatility | 65.4, 84.7, 86.1, 70.2, 82.0, 78.2 | ±0.2 |
| NET full sample (cell 16) | France 34.8, UK 32.4, Germany 31.2 … Turkey −34.3 | ±0.3 each |
| Threshold / edges (cell 19) | 2.54 % / 20 edges | ±0.02 / exact |
| Top link (cell 20) | Hong Kong → China 4.47 | ±0.05 |
| Last 200 weeks (cell 21) | 71.68 %, window 2022‑11‑11 → 2026‑09‑04 | ±0.10 / exact |
| NET last 200 weeks (cell 22) | Germany 35.0, Canada 34.0 … Argentina −31.8 | ±0.3 |
| Periods TCI returns (cell 26) | 71.8, 87.4, 78.7, 79.6 | ±0.1 |
| Periods TCI volatility (cell 27) | 69.2, 84.1, 70.2, 70.8 | ±0.1 |
| Largest jumps (cell 24) | 2023‑12‑29 4.22, 2020‑03‑13 4.11, 2020‑02‑28 3.69 | same dates, ±0.05 |

---

## 6. The app

### Stack

Vite + TypeScript + D3 (scales, shapes, transitions), with no UI framework needed. It's a static site that loads `connectedness.json` and the two `.f32` files with `fetch` (`new Float32Array(await res.arrayBuffer())`). Deploy it to GitHub Pages.

### Views (all driven by one selected week `t` and one measure: returns or volatility)

1. **Timeline.** `dynamic[measure].total` as a line, with a dashed line for the full sample total (the notebook's `axhline(ret_conn.total)`). Mark the six notebook episodes from cell 15 with their labels from the notebook comments. Shade the four periods from cell 26 as light bands. Drag or click to set `t`; arrow keys step 1 week, shift+arrow 52. Include a play button.
2. **Network ("Who sends to whom").** Edges come from `pairwise_{measure}.f32[t]`. This is the real rolling network, so arrows change week to week. The default rule is the notebook's: 90th percentile of `|pairwise_net[t]|`, and draw `pairwise_net > threshold`. A slider can show more or fewer links, but say on screen which rule is active.
   - Nodes sit in a fixed circle in notebook order (Australia → Taiwan), matching the library's own default circular layout — see CONTEXT.md for why this build keeps that instead of grouping by region.
   - Node colour follows `net[t]` (tab:red sends, tab:blue receives, both at 0.85 alpha, matching the library default), and node area follows |net|.
   - Selecting a market highlights its links. Selecting an arrow selects the pair.
3. **Pair matrix ("Every pair").** The window selector offers: selected week (rolling), Full sample, Last 200 weeks, and the four periods. Sort by region, by net sending or in notebook order. Clicking a cell selects the pair.
4. **Ranking.** Markets by `net[t]`, as diverging bars from zero.
5. **Detail.** For a market: region, sender or receiver pill, net at t, a sparkline of its rolling net with t marked, and its top 3 out and in links at t. For a pair: the net value at t, the same pair in the full sample and last 200 weeks, and a flag when the direction flips.

### Encoding rules

- Chart bodies (timeline/network/heatmap) are faithful to the library's own matplotlib defaults — see CONTEXT.md's style analysis. Don't restyle them with the colourful tokens below; those are for the app shell only.
- **Fixed scales across time.** The library scales node size and edge width relative to the largest value in the graph, per plot. That's wrong for an animation — a node would grow just because the others shrank. Compute the colour, area and width domains once, from the max over all windows for the measure, and keep them for every frame. CONTEXT.md's review finding 5 calls this out as an actual requirement here, not just a note for the team.
- Show units (%) on every number in the app shell (sidebar, tooltips, detail panel); the chart bodies themselves stay unannotated, matching the baseline.

### Design tokens — app shell only (sidebar, panels, footnote; NOT the chart bodies)

```css
--bg:#f4f5f3; --panel:#ffffff; --fg:#1b2226; --muted:#5f6b70; --line:#d9dedd; --grid:#e8ecea;
--send:#c2462e; --recv:#25668f; --mid:#eef0ee; --band:#e3e7e4; --edge:#3d474c;
/* dark */
--bg:#111517; --panel:#181d20; --fg:#e6eae9; --muted:#97a3a6; --line:#2c3438; --grid:#232a2d;
--send:#e26a4f; --recv:#5aa2cf; --mid:#262d30; --band:#20272a; --edge:#b9c3c6;
--f-display:"Source Serif 4"; --f-body:"IBM Plex Sans"; --f-data:"IBM Plex Mono";
```

Chart-body colours instead use the library's own defaults: `tab:red` `#d62728` / `tab:blue` `#1f77b4` at 0.85 alpha for network nodes, `RdBu_r` for heatmaps, black `#000000` spines/text/lines, grey `#808080` at 0.45 alpha for edges, grid lines at `#b0b0b0` alpha 0.3.

### Footnote copy (fixed)

> Data: weekly closes, highs and lows of 20 stock indices from Yahoo Finance, downloaded on {date}. Computed with PyConnectedness 0.1.0 by running the Demo notebook unchanged (commit 4cc953f). Generalized variance decomposition, VAR(2), 10 week horizon, 200 week rolling window.

---

## 7. Things found during the review (tell the team, don't fix them in the explorer)

See CONTEXT.md, "Review findings from the repo" — same list, now the team's own words rather than this build's.

---

## 8. Done when

- `python pipeline/run_demo.py && python pipeline/validate.py` passes from a clean clone with network access to Yahoo Finance.
- The app builds and deploys from committed data, with no network calls to Yahoo in CI.
- Scrubbing the timeline changes the arrows, colours and ranking. Playing it from 2001 to 2026 runs at a steady frame rate on a laptop.
- Every view works at phone width and in light and dark mode.
- The footnote shows the download date and the commit.
