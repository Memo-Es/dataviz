"""
Shared helpers for MaxLinear's "scaling" method -- the general-DAG causal order and coefficient
matrix (Klüppelberg and Krali, 2021, 2025), used by the Flights, Heat and Vitamin A graphs. Not
used by run_danube.py, which fits method="qtree" (a root-directed tree, not a general DAG) and
needs none of this.

Each of those three graphs does the same two things on top of a plain `.fit()`: it re-fits
across a range of k_order to see how stable the estimated order is to that choice (the flight-
delay and heat-wave notebooks both do this), and it reads a node's own place in that order as a
single source(0)-to-sink(1) number for a map or a bar chart. This module is only that shared
part; the data each graph's own run_*.py reads, and what k/k_order/order_method it picks, are
its own.

References
----------
Klüppelberg, C. and M. Krali (2021) Estimating an extreme Bayesian network via scalings.
    Journal of Multivariate Analysis 181, 104672.
Klüppelberg, C. and M. Krali (2025) Causal analysis of extreme risk in a network of industry
    portfolios. arXiv:2504.00523.
"""
from __future__ import annotations

from typing import Callable

import pandas as pd

from pyconnectedness.causality import MaxLinear


def position_in_order(generations: list[list[str]]) -> dict[str, float]:
    """Every name's place in a fitted order, as a single number: 0 for the first generation (a
    source, nothing upstream of it), 1 for the last (a sink), evenly spaced in between by step
    -- the "position in causal order" both the flight-delay and heat-wave notebooks put on a
    source/sink colour scale. A one-generation fit (every node its own step) maps everything to
    its own evenly spaced position the same way; a one-node fit maps that node to 0.
    """
    steps = len(generations)
    pos: dict[str, float] = {}
    for s, gen in enumerate(generations):
        t = s / (steps - 1) if steps > 1 else 0.0
        for name in gen:
            pos[name] = t
    return pos


def stability_sweep(
    data: pd.DataFrame,
    k_orders: list[int],
    k: int | Callable[[int], int],
    order_method: str = "generations",
    log: bool = True,
) -> pd.DataFrame:
    """Re-fit `MaxLinear(data).fit(method="scaling", ...)` once per k_order in `k_orders`,
    collecting each fit's own `position_in_order`. One `MaxLinear` model, refit at each k_order
    -- the model's own one-time setup (standardising, etc.) isn't repeated, only `.fit()` is.

    Parameters
    ----------
    k : int or callable
        A fixed k for every k_order (the flight-delay notebook's own k=100 throughout), or a
        function of k_order (the heat-wave notebook's own `min(50, k_order - 1)`, needed
        because its sweep starts at a k_order below its default k).

    Returns
    -------
    DataFrame (len(k_orders) x d)
        Index is k_order, columns are names, values are `position_in_order` (0..1).
    """
    # transform defaults to "frechet" -- the scaling method needs it (see MaxLinear's own
    # docstring: regularly-varying, unit-scale margins, Assumption A1 of Klüppelberg and Krali,
    # 2025). Passing None here, the qtree convention run_danube.py uses, silently wrecked a first
    # version of this function: checked against the NHANES notebook's own worked answer (vitamin
    # A's own tail-mass share should land near zero), transform=None gave 0.998, transform=
    # "frechet" (the default) gives -0.034 -- qtree ignores the transform entirely, scaling does
    # not.
    model = MaxLinear(data)
    k_of = k if callable(k) else (lambda _ko: k)
    rows = {}
    for k_order in k_orders:
        fit = model.fit(k=k_of(k_order), k_order=k_order, order_method=order_method, log=log)
        rows[k_order] = position_in_order(fit.generations)
    return pd.DataFrame(rows).T


def position_summary(sweep: pd.DataFrame, first_max: float = 0.0, last_min: float = 1.0) -> pd.DataFrame:
    """Per-name share of the sweep's fits where it was first (position <= `first_max`) or last
    (position >= `last_min`), plus its mean position -- the "first in 21 of 21 settings" / "first
    in 70% of fits" statistic both notebooks report, and the mean position a map or bar chart
    ranks or colours by.

    Returns
    -------
    DataFrame (d x 3)
        Columns "first_share", "last_share", "mean_position", index the same names as `sweep`'s
        columns.
    """
    return pd.DataFrame({
        "first_share": (sweep <= first_max).mean(axis=0),
        "last_share": (sweep >= last_min).mean(axis=0),
        "mean_position": sweep.mean(axis=0),
    })
