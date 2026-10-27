"""
Renders styleguide/examples/layered_network_sketch.png, the recipe in STYLE_GUIDE.md "The
layered network (extreme risk)".

PyConnectedness has no code for this graph yet (src/pyconnectedness/causality/ is empty at the
pinned commit), so this is a style sketch on a toy: the 4-node DAG of Klüppelberg & Krali
(2025), Example 6 / Figure 2. The stability counts are illustrative, not estimated. Swap in the
library's output once the module exists; the drawing code shouldn't need to change.
"""
from __future__ import annotations

import pinned  # noqa: F401  (the library from the pinned GitHub submodule)
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
from matplotlib.lines import Line2D
from matplotlib.patches import FancyArrowPatch

ROOT = Path(__file__).resolve().parents[1]
STYLEGUIDE = ROOT / "styleguide"
sys.path.insert(0, str(STYLEGUIDE))
from pcstyle import register_fonts  # noqa: E402

if not register_fonts():
    print("fonts missing: run `python styleguide/get_fonts.py` first (falling back to DejaVu Sans)")
plt.style.use(str(STYLEGUIDE / "pyconnectedness.mplstyle"))

INK = "#0b0b0b"
SECONDARY = "#52514e"
MUTED = "#898781"
SURFACE = "#fcfcfb"
GRID = "#e1e0d9"
TRACE = "#e9580b"  # the explorer's selection accent: a traced path is a selection, not a sign

# Example 6: X = A ×max Z with a12, a13, a14, a23, a24 > 0, i.e. edges j -> i where a_ij > 0.
# "stability" = in how many of 5 estimated DAGs the edge appears (paper's eq. 33); illustrative.
EDGES = [("3", "1", 5), ("4", "2", 5), ("2", "1", 4), ("4", "1", 2), ("3", "2", 1)]
TRACED = "4"  # draw one node's downstream paths in the trace colour


def layered_positions(g: nx.DiGraph) -> tuple[dict, list[list[str]]]:
    """Rows = causal generations (sources on top), nodes centred within each row."""
    gens = [sorted(gen) for gen in nx.topological_generations(g)]
    pos = {}
    for row, nodes in enumerate(gens):
        for i, n in enumerate(nodes):
            pos[n] = (i - (len(nodes) - 1) / 2, -row)
    return pos, gens


def width(s: int) -> float:  # ordinal: line weight carries stability, no colour hue
    return 0.6 + 0.45 * (s - 1)


def alpha(s: int) -> float:
    return 0.18 + 0.18 * (s - 1)


g = nx.DiGraph()
for src, dst, s in EDGES:
    g.add_edge(src, dst, stability=s)
pos, gens = layered_positions(g)
downstream = nx.descendants(g, TRACED)

fig, ax = plt.subplots(figsize=(7.2, 5.4))
fig.patch.set_facecolor(SURFACE)
ax.set_facecolor(SURFACE)

# generation rows: labelled, so position reads as "cause above effect" without a caption
row_names = ["Where it starts"] + [f"Generation {i}" for i in range(1, len(gens))]
for row, name in enumerate(row_names):
    ax.axhline(-row, color=GRID, lw=0.8, zorder=0)
    ax.text(-2.15, -row, name, ha="left", va="center", fontsize=9.5, color=MUTED)

for src, dst, data in g.edges(data=True):
    traced = src == TRACED or (src in downstream and dst in downstream)
    ax.add_patch(
        FancyArrowPatch(
            pos[src], pos[dst],
            arrowstyle="-|>", mutation_scale=9,
            shrinkA=13, shrinkB=13,
            connectionstyle="arc3,rad=0.0",
            lw=width(data["stability"]) + (0.4 if traced else 0),
            color=TRACE if traced else SECONDARY,
            alpha=0.95 if traced else alpha(data["stability"]),
            zorder=1,
        )
    )

for n, (x, y) in pos.items():
    source = y == 0
    on_trace = n == TRACED or n in downstream
    ax.scatter(
        x, y, s=360, zorder=2,
        color=INK if source else SURFACE,
        edgecolor=TRACE if on_trace else INK, linewidth=2 if on_trace else 1.2,
    )
    ax.text(x + 0.16, y + 0.16, f"Node {n}", fontsize=10, color=INK, ha="left", va="bottom")

ax.set_xlim(-2.2, 1.6)
ax.set_ylim(-len(gens) + 0.5, 0.6)
ax.set_axis_off()
ax.set_title("Where extreme losses start, and where they end up", loc="left", fontsize=13,
             color=INK, pad=14)
ax.text(0, 1.0, "Each arrow is a path extreme losses can travel. Risk flows downward.",
        transform=ax.transAxes, fontsize=9.5, color=SECONDARY, va="bottom")

legend = [
    Line2D([0], [0], color=SECONDARY, lw=width(s), alpha=alpha(s), label=f"in {s} of 5 estimates")
    for s in (1, 3, 5)
] + [Line2D([0], [0], color=TRACE, lw=2.2, label=f"Paths from node {TRACED} (traced)")]
ax.legend(handles=legend, loc="lower left", bbox_to_anchor=(0, -0.08), frameon=False,
          fontsize=8.5, ncol=2, handlelength=2.4)

fig.text(0.01, 0.01, "Sketch: toy DAG from Klüppelberg & Krali (2025), Example 6. Stability counts "
         "are illustrative.", fontsize=7.5, color=MUTED)
out = STYLEGUIDE / "examples" / "layered_network_sketch.png"
fig.savefig(out, dpi=150, bbox_inches="tight", facecolor=SURFACE)
print("wrote", out)
