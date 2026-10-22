# PyConnectedness style guide

What's here: a palette and type system validated for colourblind safety and contrast, a
`.mplstyle` sheet, and three recoloured examples built from `plot_connectedness_graph`,
`spillover_heatmap` and a plain `dyn.total.plot()` -- the library's own output, restyled after
the fact, not a fork of it. This is the "designed visuals to build on" and "basic design tools"
the questionnaire in `../CONTEXT.md` asks for: something the team can keep using without a
designer, in the tools they already use (matplotlib, with Plotly next).

## What's not here, on purpose

The web explorer (`../app/`) goes further: a grid-snapped network layout with angular
connectors instead of a circle, and heatmap cells drawn as height-coded capsules instead of
flat squares. Those came from references the client sent mid-project for the prototype's own
look. They're not in this guide, because:

- They need real routing/collision logic (which node goes where, which edges avoid which
  nodes) that's an engineering project, not a style change -- the explorer's version is already
  a simplification, not something to also maintain in matplotlib by hand.
- "Maintainable without a designer" is a named success criterion. Recolouring an existing plot
  call is maintainable. Reimplementing graph layout in matplotlib on every release is not.

Everything below -- colour, type, legends, crisis context -- is the part that's actually
low-risk to keep using.

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

Rendered by `pipeline/render_styleguide_examples.py` against the same synthetic input
`pipeline/run_on_synthetic.py` uses (see `../README.md` for why synthetic input, not Yahoo
Finance, in this environment) -- re-run it against real data once `run_demo.py` can reach Yahoo.

- `examples/network_restyled.png`
- `examples/heatmap_restyled.png`
- `examples/timeline_restyled.png`
