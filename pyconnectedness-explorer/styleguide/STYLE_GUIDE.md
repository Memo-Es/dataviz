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

## Naming and narrative

The page answers three questions, in order, one graph each. The questions come from the client's
questionnaire, and the names from the library:

| | Question | Name | Library |
|---|---|---|---|
| Graph 1 | When did markets become fragile? | **Rolling spillover index** | `dynamic_connectedness(…).total` |
| inside graph 1 | How long do shocks last? | **Short vs long term** (bands: short, medium, long term) | `frequency_connectedness` |
| Graph 2 | Who passes risk to whom? | **Connectedness network** | `connectedness_graph` |
| Graph 3 | How much does each pair pass on? | **Spillover heatmap** | `spillover_heatmap` |
| Side panel | (detail for graphs 2 and 3) | **Detail · market / pair** | `directional_to`, `directional_from`, `net`, `pairwise_net` |

**Every graph uses the same three-level header:**
1. The question, small, uppercase, in the accent colour, numbered ("1 · When did markets become
   fragile?").
2. The name as the title, with the library call beside it in small muted mono.
3. One plain sentence: what it shows for the current selection, then how to interact.

The intro repeats the three questions as links to their graphs, so the narrative is visible
before scrolling. Other terms keep the library's words: "net transmitter" and "net receiver"
(`viz/network.py`), not "sender"; "net pairwise" for `pairwise_net`.

**Readouts never change height.** Every slot is always drawn with the same structure, so hovering
can't move the chart under the pointer. "Short vs long term" is always shown: for a picked period
it's that period, and for a single week it's the period the week falls in, labelled as such.

## Layout rule: controls above what they control

Anything that changes in response to a control sits **below** that control, so the reader looks
at the cause first and sees the effect right under it. In the explorer:

- The Returns / Volatility toggle sits in the top bar, because it changes everything.
- The timeline (pick a week or period) comes next.
- The numbers a graph produces belong **inside that graph**, as its readout, not in a separate
  summary. The rolling spillover index carries a readout strip directly above its line: the
  index, the top net transmitter and receiver, and the strongest pairwise link for the picked
  week. Hovering previews another week there (dashed, "Previewing …"); clicking picks it for the
  whole page.
- The charts come after.
- The page title above the timeline is fixed text; it never changes with a selection.

When you add a view, put it under whichever control drives it. If a control's effect would
land above it, move the control.

## Palette

### Explorer, October 2026: one colour rule, palettes after the Impressionists

The explorer has moved past the red/blue pair below. **Colour = region, on every graph**: graph
1's beads, graph 2's circles and arrows (an arrow wears its sender's colour), graph 3's dots.
Sending vs receiving is said by form, never by a second hue: a solid circle passes on more than it
takes, a ring takes more than it passes on; bars right or left of zero; the sign on the number.
Text stays ink. An item outside any region (a one-region dataset or an upload) takes the slots in
fixed order, and past the eighth a quiet grey; slots are never cycled.

Five palettes, after French and Dutch paintings, all in `../app/src/palettes.ts`:

| Palette | Painting | Highlight (what's picked) | Regions, in order |
|---|---|---|---|
| Seurat (default) | *Un dimanche après-midi à l'Île de la Grande Jatte*, 1884–86 | parasol vermilion | emerald · orange · ultramarine · sky |
| Monet | *Impression, soleil levant*, 1872 | the orange sun | cobalt · teal · violet · ochre |
| Renoir | *Bal du moulin de la Galette*, 1876 | the dancers' rose | blue-violet · gold · green · coral |
| Van Gogh | *Caféterras bij nacht*, 1888 | the café's chrome yellow | ultramarine · terracotta · green · lilac |
| Breitner | *Meisje in witte kimono*, 1894 | the kimono's vermilion | ochre · slate blue · olive · plum |

The hexes approximate each painting's pigments as reproduced, then were snapped (hue kept,
lightness and chroma moved as little as possible) until they pass `validate_palette.js`, light
and dark: lightness band, chroma floor, >= 3:1 on the surface, CVD Delta E >= 8 and normal-vision
>= 15 for every pair of the first three slots and for neighbours across all eight. The fourth slot
(only the four-region datasets use it) stays above the 6 floor and always ships with direct labels.
The short/medium/long-term ramp of each is an ordinal ramp in the painting's ink hue, validated
with `--ordinal`. The highlight is each painting's focal colour, as the sun is Monet's: the eye
goes there first, so it marks what you picked.

**WCAG AAA, text included.** Every text token clears 7:1 on every surface of every palette, light
and dark (secondary `#3b3834` / `#d9d6d0`, muted `#4a4843` / `#b8b5b0`); hierarchy comes from size
and weight, not paler greys. No text ever sits on a data colour or on the highlight: picked
buttons and the date tag are ink with panel-coloured text, the highlight only rings what's picked
(>= 3:1 against card and page; Monet's sun and Van Gogh's yellow were deepened to clear it). Faded
context fades marks, never labels. Numbers live in ink next to coloured marks, not inside them.
Every control is at least 44 x 44 px, focus shows a 3px ink ring, and paragraphs stop at 75
characters with 1.5 line spacing. Chart marks (rows, circles, dots) are smaller than 44 px; the
same picks are available as 44 px buttons in the detail panel.

The table below is the original pair, still used by the matplotlib recipes in this guide.


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
| Critical alert, not for chart data (see rule below) | `#d03b3b` | `#d03b3b` |
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
  That includes crises: the crisis red above sits too close to the sender red, so crisis dates
  are dashed neutral ink with a label, in the explorer and in the recipe below. The crisis red
  stays in the table only for a future "critical alert" state, not for chart data.
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

The same two families as the web explorer, so library plots, docs and the website match:

- **Words** (titles, labels, legends, annotations): **Plus Jakarta Sans**, 400–700. It's the
  closest free match to Aeonik, the face in the client's Figma file. Titles use 600–700 and
  state the finding.
- **Numbers** (tick values, colour-bar ticks, callouts, tables): **B612 Mono**, 400/700. It's
  the client's own first pick, from Airbus/ENAC. Monospace keeps columns of figures aligned.
- **Page headlines on the web only**: the explorer sets its one headline sentence in Source
  Serif 4. Charts don't use a serif.

**B612 Mono's decimal point takes a full-width cell, so "71.7" renders as "71. 7".** The
explorer tightens it in CSS; for plots, use `pcstyle.mono_number()` for any callout with a
decimal (below). Tick values are usually whole numbers, so they don't need it.

### Registering the fonts

They aren't matplotlib built-ins. Both are SIL Open Font License, from Google Fonts. Fetch them
once per machine into `styleguide/fonts/` (gitignored):

```bash
python styleguide/get_fonts.py
```

Then, in a script or notebook:

```python
import sys; sys.path.insert(0, "styleguide")
from pcstyle import register_fonts, mono_numbers, mono_number

register_fonts()                                   # adds styleguide/fonts/*.ttf
plt.style.use("styleguide/pyconnectedness.mplstyle")  # words in Plus Jakarta Sans
...plot...
mono_numbers(ax, colorbars=[cbar])                 # tick values in B612 Mono
mono_number(ax, (x, y), "71.7%", xytext=(8, 0), fontsize=13, fontweight="bold")  # callout
```

`pyconnectedness.mplstyle` sets `font.sans-serif: Plus Jakarta Sans, DejaVu Sans, ...`, so plots
still render, in DejaVu Sans, if the fonts aren't installed. matplotlib has no rcParam for tick
labels alone, which is why `mono_numbers` exists. It uses `tick_params(labelfontfamily=...)` on
matplotlib 3.8+, so date ticks regenerated at save time keep the font.

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
cbar.set_label("row receives  ←  0  →  row sends (pp)", fontsize=9)
ax.set_xlabel("to this market (column)")
ax.set_ylabel("from this market (row)")
ax.grid(False)                        # the style sheet's grid would draw over the cells
mono_numbers(colorbars=[cbar])
```

Call `spillover_heatmap(..., colorbar=False)` when you add your own colour bar, or you get two.
**Always relabel the axes for `pairwise_net`.** The library's defaults ("affected variable" for
rows, "shock source" for columns) are right for `fevd`. On `pairwise_net`, a positive cell means
the *row* sends to the *column*, so the defaults read backwards.

`RdBu_r` itself is already a reasonable diverging map and doesn't need replacing -- the fix here
is centring it explicitly and adding the label, not swapping the colormap.

### Recipe: crisis context on the rolling index

Cell 14 of the notebook has no crisis markers at all (the style analysis in `CONTEXT.md` names
this directly: "no crisis markers or highlighted peaks"). This is plain matplotlib, no library
call to recolour:

```python
for iso, label in episodes.items():
    ts = dyn.total.index[dyn.total.index.searchsorted(iso)]
    ax.axvline(ts, color="#52514e", alpha=0.5, lw=1, ls=(0, (2, 3)))  # neutral: red = sender
    ax.text(ts + pd.Timedelta(weeks=1), ax.get_ylim()[1] - 0.3, label,
            fontsize=8.5, color="#898781", rotation=90, va="top", ha="left")
```

Pair with a callout of the current value, `mono_number(ax, (last_date, last), f"{last:.1f}%")`
in primary ink, so the headline number isn't only ever in notebook output, which the style
analysis also names directly. Keep the callout ink, not red/blue: above or below the average
isn't "sender" or "receiver".

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
