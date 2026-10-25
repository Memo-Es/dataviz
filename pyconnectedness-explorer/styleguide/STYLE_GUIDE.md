# PyConnectedness style guide

What's here: a palette and type system validated for colourblind safety and contrast, a
`.mplstyle` sheet, and three recoloured examples built from `plot_connectedness_graph`,
`spillover_heatmap` and a plain `dyn.total.plot()` -- the library's own output, restyled after
the fact, not a fork of it. This is the "designed visuals to build on" and "basic design tools"
the questionnaire in `../CONTEXT.md` asks for: something the team can keep using without a
designer, in the tools they already use (matplotlib, with Plotly next).

## What's not here, on purpose

The web explorer (`../app/`) goes further in a few places the matplotlib recipes don't follow:
network nodes grouped by region on the circle, edges drawn as tapered shapes that narrow toward
the receiver instead of arrowheads, and fixed scales shared across every week of an animation.
They're not in this guide, because:

- Tapered edges and shared animation scales mean drawing the shapes by hand rather than
  recolouring what `plot_connectedness_graph` already draws. That's an engineering change,
  not a style change.
- "Maintainable without a designer" is a named success criterion. Recolouring an existing plot
  call is maintainable. Reimplementing graph layout in matplotlib on every release is not.

Everything below -- colour, type, legends, crisis context -- is the part that's actually
low-risk to keep using.

## The four graphic types

PyConnectedness has four kinds of graphic. Each encoding means something specific in each one,
and the same channel must not mean two different things across them.

| | Heatmap | Circular network | Time series | Layered network (extreme risk) |
|---|---|---|---|---|
| Library source | `spillover_heatmap` | `plot_connectedness_graph` | plain `.plot()` (cells 14, 17) | none yet (`causality/` is empty); method from Klüppelberg & Krali (2025) |
| Question | How much does each pair send, net? | Who sends risk to whom, and who's central? | When did the system become fragile? | Where do *extreme* losses start, and where do they end up? |
| Position | Row and column = the two variables | Little: a ring (the explorer groups it by region) | Time on x, value on y | **Everything**: the row is the causal generation, with sources on top |
| Colour | Diverging: sender red, receiver blue | Node: red/blue for net sign | Ink line; crisis bands | **Neutral ink only.** The graph has no signed quantity (see below) |
| Size / width | n/a | Node area ∝ \|net\|; edge width ∝ net flow | Line weight fixed | Edge weight ∝ **stability** (how many estimates contain the edge) |
| Direction | Sign of the cell | One arrow per pair, sender → receiver | n/a | Always downward; no loops |
| Uncertainty | Not shown | Not shown | Not shown | **Central**: stability is part of the result |
| Time | One window per heatmap | One window; animates week to week | Time *is* the axis | One fixed structure per data window; doesn't animate |
| Main interaction | Hover a cell | Hover a node, scrub the weeks | Scrub, pick a crisis | **Trace a path**: "what does a crash in X reach?" |

The explorer adds a fifth view, not from a library plot: **speed bars** for the frequency split
(`frequency_connectedness`). They use an ordinal one-hue ramp, darker = faster, which is also
kept away from red/blue (see Palette).

## Palette


Diverging pair, validated with the `dataviz` skill's checker (`validate_palette.js`): CVD
Delta E 21.6 (protan) / 34.5 (tritan) on light, 19.2 / 31.4 on dark -- both comfortably past the
>=8 accessibility floor, and distinct from the library's current `tab:red`/`tab:blue` (a
different, unvalidated red and blue used in the network only; the heatmap's `RdBu_r` is a third,
unrelated pair). One pair, used identically in both charts, fixes that directly.

| Role | Light | Dark |
|---|---|---|
| Net sender (`send`) | `#e34948` | `#e66767` |
| Net receiver (`recv`) | `#2a78d6` | `#3987e5` |
| Diverging midpoint | `#f0efec` | `#383835` |
| Crisis emphasis (distinct from `send`) | `#d03b3b` | `#d03b3b` |
| Primary ink | `#0b0b0b` | `#f0efec` |
| Secondary ink | `#52514e` | `#c3c2b7` |
| Muted (axis/labels) | `#898781` | `#898781` |
| Gridline | `#e1e0d9` | `#2c2c2a` |
| Axis/baseline | `#c3c2b7` | `#383835` |
| Chart surface | `#fcfcfb` | `#1a1a19` |
| Selection / traced path (`accent`) | `#e9580b` | `#ff7a33` |
| Speed band ≤5 weeks (ordinal, darkest) | `#2f2a78` | `#cbc6ff` |
| Speed band 5–20 weeks | `#6f67c9` | `#8b83e3` |
| Speed band >20 weeks (lightest) | `#bdb8ee` | `#4a4494` |

The accent and speed-band rows come from the explorer (`../app/src/style.css`). They haven't
been through the validator yet; run it before they ship in a library release.

**Colour has one meaning per channel, across all four graphics.**
- **Red/blue means net sender/receiver**, a signed Diebold-Yilmaz position. Use it nowhere else.
  That includes crises: the crisis red above sits too close to the sender red. The explorer marks
  crisis dates with dashed neutral ink and labels instead, and the crisis recipe below should
  move to the same treatment (secondary ink, `alpha≈0.5`) next time the examples are rendered.
- **The accent means "what you selected"**: a hovered node, a traced path. It never means data.
- **Ink, in weight and opacity, carries magnitude or confidence** when there's no sign.

Dark isn't a flip of light -- it's its own validated step (see `../app/src/encoding.ts`'s
`REDESIGN_LIGHT`/`REDESIGN_DARK`, which this table mirrors). Re-run the validator if you ever
change a hex:

```bash
node scripts/validate_palette.js "#2a78d6,#e34948" --mode light
node scripts/validate_palette.js "#3987e5,#e66767" --mode dark
```

## Typography

From the typefaces the client already gathered (`../CONTEXT.md`, "References gathered"), split
by job the same way the client's own list already splits them ("for numbers and data" vs.
"academic tone"):

- **Titles** -- Source Serif 4. Reads academic, not corporate; not used for numbers (a serif
  hero figure looks like decoration, per the `dataviz` skill's mark spec).
- **Labels, ticks, axis text** -- IBM Plex Sans.
- **Numbers, tick values** -- B612 Mono (the client's own first pick, from Airbus/ENAC --
  monospace figures keep a column of numbers aligned).

### Registering the fonts

matplotlib doesn't ship these. Download the `.ttf` files (all on Google Fonts) into
`styleguide/fonts/`, then:

```python
import matplotlib.font_manager as fm
for f in Path("styleguide/fonts").glob("*.ttf"):
    fm.fontManager.addfont(str(f))
```

`pyconnectedness.mplstyle` already sets `font.sans-serif: IBM Plex Sans, ...` with a
`DejaVu Sans` fallback so plots still render reasonably if the fonts aren't installed.

## Using the style sheet

```python
import matplotlib.pyplot as plt
plt.style.use("styleguide/pyconnectedness.mplstyle")
```

Covers figure/axes background, grid, spines, tick colour, line weight, and the default
categorical cycle (recv/send). It does not touch layout, so `plot_connectedness_graph` and
`spillover_heatmap` still need their colours remapped explicitly -- see the two recipes below
(both run for real in `pipeline/render_styleguide_examples.py`, which produced the PNGs in
`styleguide/examples/`).

### Recipe: the network

`plot_connectedness_graph` hardcodes `tab:red`/`tab:blue`. Rather than editing the library,
recolour the artists it already returns via `ax`:

```python
import matplotlib.colors as mcolors
import numpy as np

tab_red, tab_blue = mcolors.to_rgba("tab:red"), mcolors.to_rgba("tab:blue")
for coll in ax.collections:          # the node PathCollection
    new = []
    for rgba in coll.get_facecolors():
        if np.allclose(rgba[:3], tab_red[:3], atol=0.05):
            new.append(mcolors.to_rgba("#e34948", alpha=0.9))
        elif np.allclose(rgba[:3], tab_blue[:3], atol=0.05):
            new.append(mcolors.to_rgba("#2a78d6", alpha=0.9))
        else:
            new.append(rgba)
    coll.set_facecolor(new)
for patch in ax.patches:             # the edges
    patch.set_color("#52514e")
    patch.set_alpha(0.6)
```

Add a legend -- the biggest named gap ("no legend", "node size has no legend") -- with two
`Line2D` proxy handles for colour, and a few sample circles at known `|net|` values for size; see
`render_styleguide_examples.py` for the full version.

### Recipe: the heatmap

`spillover_heatmap` returns `ax` with the image already plotted as `ax.images[0]`:

```python
im = ax.images[0]
maxabs = float(np.abs(result.pairwise_net.to_numpy()).max())
im.set_clim(-maxabs, maxabs)          # centre the colourmap on zero
cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label("sender →          → receiver", fontsize=9)
```

`RdBu_r` itself is already a reasonable diverging map and doesn't need replacing -- the fix here
is centring it explicitly and adding the label, not swapping the colormap.

### Recipe: crisis context on the rolling index

Cell 14 of the notebook has no crisis markers at all (the style analysis in `CONTEXT.md` names
this directly: "no crisis markers or highlighted peaks"). This is plain matplotlib, no library
call to recolour:

```python
for iso, label in episodes.items():
    ts = dyn.total.index[dyn.total.index.searchsorted(iso)]
    ax.axvline(ts, color="#d03b3b", alpha=0.25, lw=6)   # a soft band, not a hard line
    ax.text(ts + pd.Timedelta(weeks=1), ax.get_ylim()[1] - 0.3, label,
            fontsize=8.5, color="#898781", rotation=90, va="top", ha="left")
```

Pair with a callout of the current value (`ax.annotate` at the series' last point) so the
headline number isn't only ever in notebook output, which the style analysis also names
directly.

## The layered network (extreme risk)

This is the graph the questionnaire calls "layered network for extreme risk, as in Klüppelberg
and Krali (2025)". It's the minimum max-linear DAG `D^A` from a recursive max-linear model: an
edge j → i means extreme losses in j reach i along a heaviest path. See `../LIBRARY_NOTES.md`,
second half, for the method. The paper's own Figure 4 shows what goes wrong by default: over 150
crossing edges, unlabelled layers, arrowheads piled on nodes, and five unrelated colours for an
ordered score.

**Layout: position is the encoding.**
- One row per causal generation, from `nx.topological_generations`. Sources go in the top row;
  arrows always point down.
- **Label the rows** in words ("Where it starts", "Generation 1", …). Readers shouldn't need a
  caption to learn that up means cause.
- Within a row, order nodes to reduce crossings: by the mean position of their parents, or by
  sector group. Never order them alphabetically, because that implies nothing and crosses
  everything.
- Labels sit **beside** nodes, not inside tiny circles.

**Colour: neutral, because nothing here is signed.**
- Don't reuse red/blue. A source node isn't a "net sender". It's first in a causal order that
  is fixed for the window, while a Diebold-Yilmaz sender is a net position that changes weekly.
  If both views sit side by side, say so in the caption.
- **Nodes:** source nodes filled in ink; every other node hollow, with an ink outline.
- **Edges:** secondary ink.

**Stability (the uncertainty) is ordinal, so it's line weight and opacity, not hue.**
- 1 of 5 estimates: hairline, faint. 5 of 5: heavy, near-opaque. The recipe uses
  `width = 0.6 + 0.45·(s−1)` pt and `alpha = 0.18 + 0.18·(s−1)`.
- **By default, show only the stable core** (edges in, say, 4–5 of 5 estimates), and reveal
  weaker edges on demand. The paper's Figure 5 draws every edge at once and buries the core.
- The legend states it in words: "in 1 / 3 / 5 of 5 estimates".

**Interaction: trace, don't scrub.**
- Picking a node draws all its downstream paths (`nx.descendants`) in the accent colour and
  dims everything else. That answers "what does a crash in Coal reach?", the question this
  graph exists for.
- It's the same focus-and-dim pattern the explorer's network uses on hover.

**Titles say the finding**, e.g. "Where extreme losses start, and where they end up", with one
plain sub-line ("Each arrow is a path extreme losses can travel. Risk flows downward.").

### Recipe: the layered network

There's no library plot to recolour yet, so this draws it directly with networkx (already a
library dependency). It's a full working version in `pipeline/render_styleguide_layered.py`,
which rendered `examples/layered_network_sketch.png` on the paper's 4-node Example 6.

```python
import networkx as nx

def layered_positions(g):
    """Rows = causal generations (sources on top), nodes centred in each row."""
    gens = [sorted(gen) for gen in nx.topological_generations(g)]
    pos = {n: (i - (len(row) - 1) / 2, -r) for r, row in enumerate(gens) for i, n in enumerate(row)}
    return pos, gens

width = lambda s: 0.6 + 0.45 * (s - 1)      # stability 1..5 -> line weight
alpha = lambda s: 0.18 + 0.18 * (s - 1)     # ... and opacity, never hue

pos, gens = layered_positions(g)            # g: DiGraph, edge attribute "stability"
downstream = nx.descendants(g, picked)      # the traced node's reach
# edges: FancyArrowPatch(pos[u], pos[v], lw=width(s), alpha=alpha(s), color="#52514e"),
#        or accent "#e9580b" at alpha 0.95 if u == picked or both ends are in `downstream`
# nodes: sources (row 0) filled "#0b0b0b", others hollow with an ink outline
# rows:  ax.axhline(-r) in gridline colour, labelled "Where it starts", "Generation 1", ...
```

Once `causality/` ships, replace the toy graph with the library's estimated DAG and stability
counts. The drawing shouldn't need to change.

## Texture fallback (CVD / print / grayscale)

matplotlib's native `hatch=` is a direct fit for the `dataviz` skill's texture channel (45°
lines, tone-on-tone, opt-in -- not decorative, not on by default):

```python
ax.bar(..., hatch="////", edgecolor="#898781", linewidth=0)
```

For the heatmap, apply the same `hatch` only to cells below the CVD-safe contrast floor if the
figure is headed to print or grayscale -- not needed for the normal on-screen case, since the
palette above already clears the accessibility checks on its own.

## Examples

Rendered by `pipeline/render_styleguide_examples.py` from the real Yahoo Finance download that
`pipeline/run_demo.py` saved when it executed the notebook.

- `examples/network_restyled.png`
- `examples/heatmap_restyled.png`
- `examples/timeline_restyled.png`
- `examples/layered_network_sketch.png`: rendered by `pipeline/render_styleguide_layered.py`
  on a toy DAG (the paper's Example 6), with illustrative stability counts, because the library
  can't estimate one yet.
