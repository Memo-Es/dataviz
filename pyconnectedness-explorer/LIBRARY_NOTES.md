# PyConnectedness: what's in the library

A full read of https://github.com/zstoi/PyConnectedness at commit `4cc953f` (30 Sep 2026), which
is still the latest commit on `main` as of 25 Oct 2026. Everything here was read from the source,
notebooks and tests, not from the README alone. The test suite was run too: 21 passed.

## At a glance

- **Version 0.1.0**, released 26 Sep 2026 on PyPI. Authors Zoran Stoiljkovic and Miljana
  Cvetković. GPL-3.0-or-later. Funded by the Prototype Fund (BMFTR / OKF Deutschland).
- **About 1,140 lines of library code**, Python 3.10+, built on numpy, pandas, statsmodels,
  networkx and matplotlib.
- **Implemented:** Diebold-Yilmaz connectedness (2009 orthogonalized, 2012/2014 generalized),
  static and rolling, the Baruník-Křehlík frequency split, a heatmap and a network plot.
- **Not implemented yet:** the max-linear / extreme-risk module (`causality/` is an empty file)
  and animations (CHANGELOG "Unreleased", no code).

## The public API

Everything is importable from the top level, e.g. `from pyconnectedness import static_connectedness`.

### `fit_var(data, lags=None, ic="aic", max_lags=10, trend="c")` → `VARFit`
A thin wrapper around `statsmodels.tsa.api.VAR`.
- Rejects anything that isn't a DataFrame, and any missing values.
- Infers a regular date frequency (e.g. `W-FRI`) so statsmodels doesn't warn. An irregular
  index is left untouched.
- `lags=None` selects the order by information criterion.
- `VARFit.ma_coefficients(H)` returns Φ₀…Φ_{H−1} (H matrices, Φ₀ = I). `VARFit.sigma` is the
  residual covariance.

### Variance decompositions (`connectedness/decomposition.py`)
- **`generalized_fevd(ma, sigma)`**: Pesaran-Shin (1998). It doesn't depend on column order.
  Rows don't sum to 1, so the library always row-normalises them afterwards.
- **`orthogonalized_fevd(ma, sigma)`**: Cholesky, the DY-2009 method. The result depends on
  column order.
- **`normalize_fevd(theta)`**: divides each row by its sum.
- In both, `theta[i, j]` is the share of *i*'s forecast-error variance caused by shocks in *j*.

### `static_connectedness(data, horizon=10, *, method="generalized", var_fit=None, **fit_kwargs)` → `ConnectednessResult`
Fits the VAR (or takes `var_fit`), decomposes, normalises, then derives every measure below.
All values are in percent.

| Field | What it is |
|---|---|
| `fevd` | k×k normalised decomposition. Row = affected variable, column = shock source. |
| `total` | Total connectedness index (TCI): the off-diagonal sum divided by k. |
| `directional_to` | What each variable gives to the others (column sums without the diagonal). |
| `directional_from` | What each variable takes from the others (row sums without the diagonal). |
| `net` | `to − from`. Sums to zero across variables. |
| `pairwise_net` | `C[i, j] = θ[j, i] − θ[i, j]`. Antisymmetric. **Positive means i sends to j.** Row sums equal `net`. |
| `table` | The DY-layout table: the FEVD plus a `FROM` column, then `TO`, `TO_incl_own` and `NET` rows. The `TCI` sits in the `TO_incl_own` / `FROM` corner. The `TO` corner is the sum of all TO values (= k × TCI). The `NET` corner is 0. |

### `dynamic_connectedness(data, window, horizon=10, *, method="generalized", lags=None, **fit_kwargs)` → `DynamicConnectednessResult`
- Calls `static_connectedness` on every window of `window` rows. Each window is dated by its
  **last** observation ("right-aligned", as in the papers).
- **The lag order is fixed across all windows.** With `lags=None` it's picked once on the full
  sample, then frozen.
- Returns:
  - `total`: a Series;
  - `directional_to`, `directional_from` and `net`: DataFrames;
  - `fevd` and `pairwise_net`: **unlabelled** numpy arrays of shape `(T, k, k)`;
  - plus `names`, `window`, `horizon`, `lag_order`, `method`, `n_windows`.
- Cost: one VAR fit per window. The Demo runs 2 × 1323 fits, which takes about a minute.

### `frequency_connectedness(data, horizon=100, *, periods=(5, 20), method="generalized", var_fit=None, **fit_kwargs)` → `FrequencyConnectednessResult`
Baruník-Křehlík (2018): splits connectedness by cycle length.
- **How:** an FFT of the MA coefficients over a grid of `horizon` frequencies.
- **`periods`:** cut-offs in *observations*. With weekly data, `(5, 20)` gives three bands:
  ≤5 weeks, 5–20 weeks, and >20 weeks. They're converted to radians the same way as R's
  `frequencyConnectedness`.
- **Returns:**
  - `bands`: a `ConnectednessResult` per band. These add up exactly to the static result, and
    a test checks that.
  - `within`: each band rescaled as if it were the whole system.
  - `share`: each band's share of the variance, summing to 100.
  - `total`: TCI per band.
- **Static only.** There's no rolling version, and **no notebook uses it**. The client's
  questionnaire lists "split into short and long term" as a feature, and this function is it.

### Visualisation (`viz/`)
- **`spillover_heatmap(result_or_matrix, *, ax, cmap="viridis", annotate=True, fmt, colorbar, xlabel, ylabel, **imshow_kwargs)`**
  - Plots `result.fevd` when given a result, or any square DataFrame.
  - Default axis labels: rows "affected variable", columns "shock source".
  - Text colour in annotations follows cell brightness.
- **`connectedness_graph(result_or_matrix, *, threshold=0.0)`**
  - Builds a networkx DiGraph with an edge i→j whenever `pairwise_net[i, j] > threshold`.
  - Attaches `to`, `from` and `net` to the nodes when given a result.
  - A negative threshold raises an error.
- **`plot_connectedness_graph(graph, *, ax, pos, node_scale=1600, edge_scale=4, labels=True)`**
  - Circular layout by default.
  - Node area ∝ |net| and colour by sign: `tab:red` for senders, `tab:blue` for receivers,
    alpha 0.85.
  - Edge width ∝ weight.
  - **Both are scaled to the largest value in that one plot**, so two plots can't be compared.
    The docstring says so.

## Tests (`tests/`, 21 tests, all passing)
- **Published values:** DY-2009 returns TCI 35.53, DY-2009 volatility 39.45, and generalized
  log volatility 55.67, all orthogonalized/VAR(2)/H=10 except the last.
- **Identities:** FEVD rows sum to 100; net sums to 0; pairwise is antisymmetric; pairwise row
  sums equal net, for both static and rolling.
- **Rolling:** the window count is right, and the last rolling window equals a static fit on the
  same rows.
- **Frequency:** bands add up to static for both methods and for horizons 100 and 101; it
  rejects bad `periods` and empty bands.
- **`fit_var`:** frequency inference, and an irregular index left untouched.
- **Not tested:** the plotting functions, the DY-2012 headline number (12.6%, checked only in its
  notebook), and generalized rolling results.

## Example notebooks and data

| File | What it does | Headline result |
|---|---|---|
| `examples/Demo.ipynb` | 20 Yahoo Finance indices, weekly 1997–2026, generalized VAR(2), H=10, 200-week window. The source of this explorer's numbers. | TCI 78.34% (returns), 73.74% (volatility) |
| `examples/replicate_dy2009.ipynb` | 19 markets, 829 weeks 1992–2007, orthogonalized. Tables 1–4, an ordering check, rolling index, pairwise. | 35.53% / 39.5% (paper: 35.5% / ≈39.5%) |
| `examples/replicate_dy2012.ipynb` | 4 US asset classes (stocks, bonds, commodities, FX), 2771 days 1999–2010, generalized VAR(4) on **log** volatility. Figures 1, 3–6. | 12.59% (paper: 12.6%); raw volatility gives 16.48% |
| `examples/Descriptives.py` | DY-2009 Tables 1–2 as a script, plus a `fit_var` smoke test. | n/a |
| `examples/data/*.xlsx` | DY-2009 returns and volatility (829×19), DY-2012 volatility (2771×4). Sources in the README. | n/a |

The ordering check in `replicate_dy2009` shows why the generalized method matters:

| Method and column order | TCI |
|---|---|
| Orthogonalized, original order | 35.53% |
| Orthogonalized, reversed | 35.44% |
| Orthogonalized, random | 35.27% |
| Generalized, any order | 65.83% |

## Demo.ipynb results worth knowing (saved outputs)

- **Full-sample net (cell 16):**
  - Top senders: France +34.8, UK +32.4, Germany +31.2, US +24.7.
  - Top receivers: Turkey −34.3, China −30.4, Malaysia −30.2, Argentina −30.2.
  - China has by far the lowest FROM (39.7%), the most isolated market.
- **Strongest links (cell 20):** Hong Kong→China 4.47, Singapore→Malaysia 3.99, then
  UK/Germany/France→Turkey and →Argentina.
- **Last 200 weeks vs full sample (cell 22):** Canada rises from +21.3 to +34.0. Singapore
  (+6.1→−13.1) and Hong Kong (+2.3→−14.9) flip from senders to receivers.
- **Periods (cells 26–27):**

  | Period | Returns TCI | Volatility TCI |
  |---|---|---|
  | 1997–2006 | 71.8% | 69.2% |
  | 2007–2012 (GFC and euro crisis) | 87.4% | 84.1% |
  | 2013–2019 | 78.7% | 70.2% |
  | 2020–2026 | 79.6% | 70.8% |

## Issues found in this read (for the team; new beyond CONTEXT.md's review)

1. **The heatmap labels read backwards on `pairwise_net`.** The defaults ("affected variable"
   rows, "shock source" columns) are right for `fevd`. On `pairwise_net`, a positive cell means
   the *row* sends to the *column*, so the row is the source. Demo cells 18, 21 and 28 all use
   the defaults. The explorer's own matrix labels it "row → column", which is correct.
2. **`replicate_dy2012` cell 27 shows the wrong result.** It prints `conn_raw.pairwise_net`, the
   raw-volatility result the notebook itself calls a trap, instead of `conn`.
3. **`replicate_dy2012` figures use mixed scales.** Figure 3 (TO) isn't divided by N, but Figures
   4 (FROM), 5 (NET) and 6 (pairwise) are.
4. **Two conventions for skewness and kurtosis under the same names.** Demo cell 8 uses pandas
   (sample estimator, *excess* kurtosis). The replications use the population estimator and
   *raw* kurtosis.
5. **Docstring gaps:**
   - `ConnectednessResult` doesn't document `pairwise_net`.
   - `dynamic_connectedness` says "see Notes", but there's no Notes section.
   - `spillover_heatmap` still has a commented-out `kind` parameter.
6. **The README overstates two things.** `causality/` is listed as max-linear networks "in
   development", but it's an empty file. `viz/` is described as "network plotting", but it also
   holds the heatmap.
7. **Leftover text:**
   - `replicate_dy2009` cell 25: "This supposed to be the next update - m3. - come back later".
   - Its summary writes "39,5%" and links "exeercises/replicate_dy2012.ipynb", a wrong path.
   - `replicate_dy2012` cell 1: "PyConnecteedness".
   - `Descriptives.py`: "# put into sandbox", "# why not directly?", "# Zusatz".
8. **The replication notebooks download their data from `raw.githubusercontent.com/.../main/`**
   instead of the local `examples/data/`. A future change on `main` would silently change what
   an old checkout reproduces.
9. **Frequency connectedness can't be discovered.** It's in the README but in no notebook, and
   there's no rolling version.

## What this means for the explorer

- **Already exported but not shown:** the full FEVD (`fevd`), i.e. who explains whom before
  netting. It could back a "gross vs net" view.
- **Short vs long term (frequency split) is the biggest missing feature** the library already
  supports. The Demo never calls `frequency_connectedness`, though, and this build's rule is
  "only the notebook's code". Adding it needs a decision: either the team adds a cell to
  `Demo.ipynb`, or the export cell calls the library function directly (library code, but not
  a notebook cell).
- **Animations** (the client's top-ranked feature) don't exist in the library yet. The explorer's
  play button is the only version so far, and it already uses fixed scales across frames, which
  the library's plots don't.
