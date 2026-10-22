"""
Fakes what yf.download(...) would return in Demo.ipynb cell 4, so the rest of the notebook's
code (cells 6, 10, 13, 14, 15, 18, 19, 21, 26, 27, 28) can run unmodified on top of it. This
sandbox has no route to Yahoo Finance, so the prices below aren't real -- but everything
computed from them (VAR fit, FEVD, connectedness, TCI, net flows) runs through the real
pyconnectedness 0.1.0 code at the pinned commit. See ../CONTEXT.md and ../README.md.

The generator is a VAR(1)-plus-common-factor price process: a shared risk factor whose
volatility is shaped to roughly trace the real rolling spillover chart (rise into 2008-2012,
dip in 2015, jump in 2020, drop as COVID weeks roll out of the window after 2023), plus a
lead-lag coupling matrix where markets with higher "sender strength" push more of their return
onto everyone else a week later. Diebold-Yilmaz connectedness reads that lagged asymmetry as
net transmission, which is what splits markets into senders and receivers once
static/dynamic_connectedness actually run on it.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

NAMES = [
    "Australia", "Japan", "Hong Kong", "Germany", "France", "UK", "Canada", "US",
    "Switzerland", "Singapore", "Indonesia", "Mexico", "Brazil", "Spain",
    "Malaysia", "Argentina", "South Korea", "Turkey", "China", "Taiwan",
]

TICKERS = {
    "Australia": "^AORD", "Japan": "^N225", "Hong Kong": "^HSI", "Germany": "^GDAXI",
    "France": "^FCHI", "UK": "^FTSE", "Canada": "^GSPTSE", "US": "^GSPC",
    "Switzerland": "^SSMI", "Singapore": "^STI", "Indonesia": "^JKSE", "Mexico": "^MXX",
    "Brazil": "^BVSP", "Spain": "^IBEX", "Malaysia": "^KLSE", "Argentina": "^MERV",
    "South Korea": "^KS11", "Turkey": "XU100.IS", "China": "000001.SS", "Taiwan": "^TWII",
}

REGION = {
    "US": "Americas", "Canada": "Americas", "Mexico": "Americas", "Brazil": "Americas",
    "Argentina": "Americas",
    "UK": "Europe", "Germany": "Europe", "France": "Europe", "Switzerland": "Europe",
    "Spain": "Europe", "Turkey": "Europe",
    "Japan": "Asia Pacific", "South Korea": "Asia Pacific", "China": "Asia Pacific",
    "Hong Kong": "Asia Pacific", "Taiwan": "Asia Pacific", "Singapore": "Asia Pacific",
    "Malaysia": "Asia Pacific", "Indonesia": "Asia Pacific", "Australia": "Asia Pacific",
}

# Rough sender/receiver tendency, eyeballed from the Figma heatmap/network screenshots
# (warm rows: France, UK, Germany, Canada, US, Spain; cold rows: Turkey, Argentina,
# Malaysia, South Korea, China, Indonesia; the rest closer to neutral).
SENDER_STRENGTH = {
    "France": 1.5, "UK": 1.4, "Germany": 1.35, "Canada": 1.1, "US": 1.0, "Spain": 0.5,
    "Switzerland": 0.3, "Brazil": 0.1, "Mexico": 0.0, "Taiwan": -0.1, "Australia": -0.15,
    "Singapore": -0.2, "Japan": -0.4, "Hong Kong": -0.5, "Indonesia": -0.6, "China": -0.7,
    "South Korea": -0.8, "Malaysia": -0.9, "Argentina": -1.0, "Turkey": -1.5,
}

EPISODES = pd.DatetimeIndex([
    "2001-09-30", "2008-10-31", "2011-09-30", "2015-08-31", "2020-03-31", "2022-09-30",
])

# (year-fraction, relative connectedness level) keyframes tracing the shape of the real
# rolling TCI chart read off the Figma reference. 1.0 = the calibrated baseline level.
_SHAPE_KEYFRAMES = [
    (1997.5, 0.93), (1999.0, 0.96), (2001.0, 0.94), (2003.3, 0.89), (2005.0, 0.96),
    (2006.5, 0.98), (2008.0, 1.07), (2008.83, 1.10), (2009.5, 1.13), (2011.0, 1.12),
    (2011.75, 1.11), (2012.5, 1.09), (2013.5, 1.05), (2014.5, 1.01), (2015.3, 1.03),
    (2015.67, 0.96), (2016.3, 1.00), (2017.0, 1.03), (2018.0, 1.02), (2019.0, 1.04),
    (2019.8, 0.98), (2020.1, 0.99), (2020.25, 1.10), (2020.6, 1.09), (2021.3, 1.07),
    (2022.0, 1.06), (2022.75, 1.05), (2023.3, 1.05), (2023.9, 0.87), (2024.3, 0.88),
    (2025.0, 0.90), (2026.0, 0.90), (2026.7, 0.91),
]


def _shape(year_fracs: np.ndarray) -> np.ndarray:
    xs = np.array([k for k, _ in _SHAPE_KEYFRAMES])
    ys = np.array([v for _, v in _SHAPE_KEYFRAMES])
    return np.interp(year_fracs, xs, ys)


def _weekly_dates(n_weeks: int, end: str = "2026-09-04") -> pd.DatetimeIndex:
    idx = pd.date_range(end=end, periods=n_weeks, freq="W-FRI")
    assert idx[-1].strftime("%Y-%m-%d") == end
    return idx


def _coupling_matrix(names: list[str], base: float = 0.08) -> np.ndarray:
    """A[j, i]: effect of market i's lagged return on market j. Only markets with a
    positive sender strength push their move onto the others at a one-week lag (receivers
    push nothing of their own); region-mates couple a bit more tightly on top of that."""
    k = len(names)
    strength = np.array([SENDER_STRENGTH[n] for n in names])
    regions = [REGION[n] for n in names]
    A = np.zeros((k, k))
    for j in range(k):
        for i in range(k):
            if i == j:
                continue
            push = base * max(strength[i], 0.0) / 1.5
            region_bonus = 0.25 * base if regions[i] == regions[j] else 0.0
            A[j, i] = push + region_bonus
    # keep the implied spectral radius comfortably inside the unit circle
    radius = np.max(np.abs(np.linalg.eigvals(A)))
    if radius > 0.75:
        A *= 0.75 / radius
    return A


def simulate(
    n_weeks: int = 1522,
    seed: int = 20260921,
    overall_scale: float = 1.0,
) -> tuple[pd.DatetimeIndex, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Returns (dates, close, high, low) weekly panels, index-aligned, one column per market
    in NAMES order, close/high/low as price LEVELS (not returns)."""
    rng = np.random.default_rng(seed)
    dates = _weekly_dates(n_weeks + 1)  # +1: the first week is lost to returns.diff()
    k = len(NAMES)
    A = _coupling_matrix(NAMES)
    n_weeks = len(dates)

    year_frac = dates.year + (dates.dayofyear - 1) / 365.25
    level = _shape(year_frac.to_numpy()) * overall_scale

    # common global risk factor, AR(1) with time-varying volatility following `level`
    factor = np.empty(n_weeks)
    factor[0] = 0.0
    phi = 0.08
    factor_vol = 1.3 * level
    for t in range(1, n_weeks):
        factor[t] = phi * factor[t - 1] + factor_vol[t] * rng.standard_normal()

    loadings = (0.8 + 0.25 * rng.standard_normal(k)).clip(0.3, 1.6)
    idio_vol = (1.3 + 0.15 * rng.standard_normal(k)).clip(0.8, 1.8)

    returns = np.zeros((n_weeks, k))
    for t in range(1, n_weeks):
        lagged = A @ returns[t - 1]
        shock = loadings * factor[t] + idio_vol * rng.standard_normal(k)
        returns[t] = lagged + shock
    returns[0] = loadings * factor[0] + idio_vol * rng.standard_normal(k)

    close = 100.0 * np.exp(np.cumsum(returns / 100.0, axis=0))

    # weekly range, used for the Parkinson volatility estimator the notebook computes in
    # cell 6: a blend of shared "turbulence" (so volatility connectedness is nontrivial like
    # the real market, calibrated so static_connectedness(log_vola) lands near the real
    # notebook's 73.74%) and per-market, per-week idiosyncratic turbulence.
    shared_turbulence = 0.45 + 0.55 * np.abs(factor) / max(np.abs(factor).max(), 1e-9)
    idio_turbulence = rng.random((n_weeks, k))
    turbulence = 0.73 * shared_turbulence[:, None] + 0.27 * idio_turbulence
    market_vol_level = (0.8 + 0.3 * rng.standard_normal(k)).clip(0.5, 1.6)
    range_pct = 0.010 * market_vol_level[None, :] * (0.3 + turbulence)
    low_share = 0.45 + 0.1 * rng.random((n_weeks, k))
    high = close * (1.0 + range_pct * (1.0 - low_share))
    low = close * (1.0 - range_pct * low_share)
    low = np.minimum(low, close * 0.999)
    high = np.maximum(high, close * 1.001)

    close_df = pd.DataFrame(close, index=dates, columns=NAMES)
    high_df = pd.DataFrame(high, index=dates, columns=NAMES)
    low_df = pd.DataFrame(low, index=dates, columns=NAMES)
    return dates, close_df, high_df, low_df


def build_raw_frame(seed: int = 20260921, overall_scale: float = 1.0) -> pd.DataFrame:
    """Shaped like yf.download(...) for multiple tickers: columns are a (field, ticker)
    MultiIndex. Only Close/High/Low are populated since that's all Demo.ipynb cell 6 reads."""
    dates, close, high, low = simulate(seed=seed, overall_scale=overall_scale)
    cols = {}
    for field, frame in (("Close", close), ("High", high), ("Low", low)):
        for name in NAMES:
            cols[(field, TICKERS[name])] = frame[name]
    raw = pd.DataFrame(cols)
    raw.columns = pd.MultiIndex.from_tuples(raw.columns, names=["Price", "Ticker"])
    raw = raw.sort_index(axis=1)
    return raw
