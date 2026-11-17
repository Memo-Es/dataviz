# PyConnectedness: context for the explorer build

This is the client's strategic questionnaire (Part 1) and the conclusions drawn from it (Part 2), copied verbatim into the repo so the decisions behind this build are traceable. **Where SPEC.md contradicts Part 1, Part 1 wins.** The one contradiction found, and how it was resolved, is logged at the bottom.

---

## Part 1. Strategic Definition Questionnaire (answered by Miljana Cvetković, maintainer and cofounder)

### 1. Project foundation

PyConnectedness exists because the methods researchers rely on to study connected systems, like financial markets, were well established but scattered or missing in Python, so it brings them together in one open source library, which released its first version in September 2026 and already has an extreme risk module and animated visuals on the way.

**In one sentence, what does PyConnectedness do, and for whom?** PyConnectedness gives people the tools to analyze and make sense of complex data sets, especially large ones, by showing how their parts are connected and affect each other.

**What problem existed before PyConnectedness that made you build it?** The methods for studying how parts of a system affect each other (Diebold-Yilmaz connectedness, its frequency version by Baruník and Křehlík, and newer causal models for extreme risk) are well established in research. But they were spread across R packages and code attached to individual papers, and were mostly missing in Python. Results were hard to reproduce, and every researcher had to rebuild the same tools.

**Why does this need to be open source, and why Python?** Open source because research results should be reproducible and checkable by anyone, not hidden in private code. Python because it is the main language of data science and machine learning today, used by students, researchers and industry alike, yet these methods were missing there.

### 2. Strategic objectives

**Primary goal of this consultancy round?** This is a data visualization product advisory. The goal is to bring to light the value the project already has, and to help the team make better decisions about how the product looks and works. It includes some design work, which together with the rest of the deliverables is a starting point for the team to keep improving the product on their own, using basic design tools and processes.

**Strategic objectives?** A product that is more polished and easier to use, and that feels appealing and trustworthy to the people who use it.

### 3. Audience

The main users are scientists, followed by people in industry, and at the end people that are not necessarily scientists but interested in investigating causal relationships (journalists, NGOs, etc.)

**Geographic focus?** No, it is meant for everyone. The methods are used worldwide, and the code and documentation are in English.

**Users, ranked:**

- Academic researchers in finance and economics (PhD students, professors)
- Researchers in other fields with networked data, e.g. hydrology (floods along rivers), energy, climate
- Central banks and financial supervisors (systemic risk monitoring)
- Risk managers and analysts at banks, asset managers and insurers
- Students and teachers in econometrics courses

**What do they use today instead?** Mostly R packages (e.g. ConnectednessApproach, frequencyConnectedness), MATLAB code from the original papers.

### 4. Positioning

**Compared to, and not compared to?** Compared to: the R packages above since users want results that match the published papers. Rather not compared to: commercial "black box" risk dashboards. PyConnectedness is a transparent, reproducible research library, not a ready-made risk score. Rather not compared to the R packages regarding visualization.

**Research tool or product?** Today mainly a research tool. The goal is for it to become both: the core stays a rigorous research library, while the planned browser interface lets people without programming skills upload their own data and get results with a suggested interpretation.

**Never compromise on:** Scientific correctness and reproducibility. Results must match the original published methods and be checked by tests, even if that makes the library slower to grow or less flashy.

**Next:** Animated visuals (next release), the extreme risk module with causal max-linear models (Klüppelberg), a browser interface for non-programmers, user testing and workshops, and extensions to other fields such as river networks. In the longer term, we will use the library in our own research on extreme risk spillovers between industries and countries.

### 5. Product

**Graphs:** Heatmaps; Circular connectedness network; Time series charts, so far made by hand in the Demo; Layered network for extreme risk, as in Klüppelberg and Krali (2025) (in progress).

**Features:** Connectedness tables that show how much each part affects, and is affected by, the others; Connectedness for a whole period, or over time with rolling windows; Connectedness split into short and long term; Showing only the strongest links in the network; Animated versions of the graphs (next release); Seeing changes over time (planned); Selecting a single connection (planned); More detail on each interaction (planned).

**Which graph matters most, and why?** The connectedness network. It shows at a glance who sends risk to whom and who is most central, which a table of numbers can't do. Right behind it is the time series of total connectedness, because it shows when the system became more fragile, e.g. around crises.

**Which planned feature would make the biggest difference?** Seeing changes over time (together with the animations). With it, someone could watch how risk built up and spread between banks or markets before and during a crisis, and spot which players became central. That is exactly what supervisors and risk managers want to understand.

**Who makes the visuals today, and with which tools?** Both of the PyConnectedness team members. Directly in Python, matplotlib, planned also Plotly.

**Institutional or community driven?** Independent and community-driven, but with academic credibility: rooted in research and well-tested, yet open to contributions, without looking like a corporate or bank product.

### 6. Definition of success

**Why it matters:** Financial crises show how fast risk spreads through connected systems. Making these methods free, transparent and easy to use helps researchers, supervisors and the public understand systemic risk better. The same methods also apply to other connected systems, like floods in river networks. Open, reproducible code strengthens trust in research results.

**Timeline:** Regular funding phase ends in November 2026, with animations and improved visuals by then. Second Stage (4 months, if approved): user testing, workshops, browser interface, sustainability. Next Prototype Fund round (Class 03): application for an extension to new models/fields. December 2026: presentation at the Research in Options conference.

**What should be different at the end:** The team has a clearer picture of the value PyConnectedness already offers, a first set of designed visuals to build on, and the basic design tools and processes to keep improving the product on their own.

**How would you know it worked:**

- Non-experts can read our main graphs without explanation from us
- We have a consistent visual style (colours, layout, labels) used across library, docs and website
- We can design and test new visuals on our own with simple tools
- The redesigned graphs are already in a release or in the documentation

---

## Part 2. Conclusions so far

### Requirements that follow from the questionnaire

1. The network is the priority view. It must show who sends to whom, and who is central, at a glance.
2. The total connectedness time series comes next. It must show when the system became fragile, so crises need to be marked.
3. Change over time is the most valuable feature. Animation, together with scrubbing through the weeks.
4. Selecting a single connection, with more detail on each interaction, is planned.
5. The tone is academic credibility, community driven. Not a black box risk dashboard, not a bank product, and visibly better than the R packages' visuals.
6. Correctness is non negotiable. Numbers come from the library, unchanged, and every visual simplification must keep the meaning of the numbers.
7. Readable without explanation by non-experts. Plain titles, labelled units and legends.
8. One visual style. Consistent across library, docs and website.
9. Buildable by the team in matplotlib and Plotly, and maintainable without a designer.
10. Timing. Improved visuals by end of November 2026, before the Research in Options conference in December.
11. Not stage 2. The explorer is a design prototype for the coaching. Miljana sees a web app as stage 2, so it must not be presented as the browser interface.

### Style analysis of the current Demo charts (taken from running the notebook's plotting code)

- All matplotlib defaults. DejaVu Sans; 12pt titles, 10pt ticks; black 0.8pt axis frame on four sides; grid at alpha 0.3; no visual identity.
- Titles describe the model, not the finding. For example "VAR(2), H=10". The axis labels "affected variable" and "shock source" come from the library.
- Colour meaning differs between charts. The heatmap uses RdBu_r with no annotations. The network uses tab:red and tab:blue at alpha 0.85, which are a different red and blue for the same meaning, and there is no legend.
- The network is hard to read. It uses the default circular layout in notebook order, so position carries no meaning. Edges are grey at 0.45 with small arrowheads, so direction is hard to read. Node size follows |net| with no scale, and labels are 9pt sitting on the nodes.
- Time series have no context. Thin black lines (1pt; 0.6pt in the small multiples), a dashed grey mean, no crisis markers and no emphasis.
- Headline numbers are hidden. Values such as the total spillover for a window are printed in the notebook output, not shown on the chart.

### Review findings from the repo (tell the team; don't change them in the explorer)

1. The big drop in the rolling index in late 2023 isn't calm markets. The 200 week window ending 2023‑12‑29 starts 2020‑03‑06, so COVID crash weeks are leaving the window.
2. The last data week is a single day. The download ends Monday 31 Aug 2026, which is labelled 2026‑09‑04 by `resample("W-FRI")`.
3. Rolling pairwise matrices are unlabelled. `dynamic_connectedness` returns them as `(T, k, k)` arrays.
4. The strongest link threshold has an implicit rule. It is the 90th percentile over all 400 cells (both directions and the diagonal), which gives 20 of 190 pairs.
5. Plot scales are relative to each plot. `plot_connectedness_graph` scales node size and width per plot, which misleads in animations. Use fixed domains across frames.
6. Leftover comments.
   - Cell 6: "alternative formula - also consider"
   - Cell 13: "taken, but not limited to"
   - Cell 21: "now on avh"
   - Cell 23: "chrkc the plausability"
   - `static.py`: "#.T"
7. Cell 3's directory loop. It walks up the file tree unless the notebook is run from inside the repo.

### Open decision for Memo

The Figma file recreates the current notebook charts (01 rolling index, 03 heatmaps and 04 network are imported; 02 small multiples and 05 last 200 weeks are not yet). The spec's design tokens describe the redesigned prototype. Decide which look the explorer uses:

- (a) the faithful current style as a baseline,
- (b) the redesign,
- (c) both, with a toggle to compare.

### References gathered

- Field references: V‑Lab SRISK (NYU Stern), the OFR Financial Stress Index, the Diebold and Yilmaz review paper (arXiv 2211.04184).
- Patterns: a reorderable adjacency matrix (Bostock, Les Misérables), chord and arc diagrams, Gapminder for animation over time, FT, Reuters and Bloomberg crisis timelines.
- Readability and consistency: Our World in Data, Datawrapper's guidance.
- Typefaces (free):
  - For numbers and data: B612 / B612 Mono (Airbus with ENAC, French civil aviation), Atkinson Hyperlegible (plus Mono and Next), IBM Plex, Source Sans 3 / Source Serif 4, Fira, Public Sans.
  - For academic tone: STIX Two (scientific publishers' consortium).
  - Inline sparklines: Datatype.
  - All of these are on Google Fonts.

---

## Decision log for this build

Went with (a), the faithful current style, for the chart bodies.

The brief linked the Figma file directly (node `17695:4663`) and asked for the charts to match
it exactly. By the time I started, that file already had a "05 Last 200 weeks" frame — the note
above saying it's "not yet" imported is stale. All four numbered frames (01, 03, 04, 05) are the
faithful recreation, not a redesign: titles describe the model rather than the finding
("Rolling return spillover index (200-week window, VAR(2), H=10)"), heatmaps have no per-cell
numbers, network nodes use `tab:red`/`tab:blue` at 0.85 alpha instead of custom colours, and the
circular layout is plain notebook order with no region grouping. That's the same thing the style
analysis above describes. So matching the Figma pixel-for-pixel and picking (a) turned out to be
the same instruction.

One contradiction: SPEC.md §6 ("Encoding rules" and "Design tokens") describes a different,
colourful redesign — custom `--send`/`--recv` colours, plain-English titles like "Who sends to
whom", a circle grouped by region. That's option (b). Since Part 1 wins on contradictions, I
kept SPEC.md's structure (the five views, the data contract, how things interact) but overrode
§6's chart styling with the faithful baseline above. The §6 tokens are still used, just only for
the app shell around the charts — sidebar, panels, footnote, dark mode — none of which the
questionnaire describes and none of which touches "numbers must come from the library,
unchanged." I annotated SPEC.md in place so it points here instead of just quietly diverging.

Later asked for (c) directly: a toggle between the faithful baseline and an actual redesign
(not the untouched §6 tokens -- a new validated system, built with the `dataviz` skill's
method). That's now in the app (top right) and in `styleguide/` as a matplotlib-portable
version of the same colour/type system, documented in `styleguide/STYLE_GUIDE.md`. The web
redesign's network layout and heatmap cell style go further than the matplotlib guide does, on
purpose -- see that file's "What's not here" section for why.

Oct 23: two changes, at Memo's request.

1. Data now comes only from the notebook. A GitHub Actions workflow runs `Demo.ipynb`
   unchanged on live Yahoo Finance data and commits it only if `validate.py` passes (it did:
   all 11 checks, 78.34% / 73.74%). The synthetic generator is deleted.
2. The front end is rebuilt as one page instead of three layouts plus a D3 replica of
   matplotlib. The faithful baseline is now the notebook's own PNGs from the same run, shown
   in the app's last section, which is more faithful than any replica. The network went back
   to a circle (grouped by region, edges tapering toward the receiver) because the grid
   layout's right-angle edges ran through other nodes and hid direction.

Oct 25: framing from Memo. This is a series of design explorations to make the library's output
clearer, with a possible consumer app to discuss later. The one hard rule: the numbers come from
PyConnectedness's own code, exactly as on GitHub. So the short vs long term split was added
through the export cell (the library's `frequency_connectedness`, on the notebook's own series),
not reimplemented, and not a new notebook cell. `LIBRARY_NOTES.md` is a full read of the library.

Oct 25 (later): Memo shared Klüppelberg & Krali, "Causal analysis of extreme risk in a network of
industry portfolios" (arXiv:2504.00523). It's the method behind the roadmap's extreme-risk module
and the questionnaire's "layered network". It's summarised, with design notes, in the second half
of `LIBRARY_NOTES.md`. The library has no code for it yet (`causality/` is empty), so under the
"exact same code" rule it can't feed the explorer until that module, or the authors' R package,
exists.

## Tabled: the 4th graph (layered extreme-risk network), Oct 26

Memo's call: **parked for now; work continues on the other three graphs** (heatmap, circular
network, time series). Pick it up again later from here:

- **Why it's not on the site:** PyConnectedness has no code for it yet (`causality/` is empty),
  so under the "exact same code" rule the site can't compute it. The paper's real 30-industry
  result (Figure 4) has 150+ overlapping arrows that can't be read off reliably.
- **What exists already:** the design spec and a working matplotlib recipe in
  `styleguide/STYLE_GUIDE.md` ("The layered network"), a sketch in
  `styleguide/examples/layered_network_sketch.png`, and the paper summary in `LIBRARY_NOTES.md`.
- **Options when it comes back:**
  - A: a design preview on the paper's exact 4-node example (Example 6);
  - B: the real 30 industries in their causal rows, without arrows;
  - C: wait for the library module, the authors' R package (github.com/mariokrali), or the
    edge list from Klüppelberg/Krali.
  - The recommendation was A + B, labelled "design preview, not computed by PyConnectedness".
- **Easiest unblock:** the team asks Klüppelberg or Krali for the estimated DAG's edge list and
  stability counts.

Oct 26: dataset selector. Memo asked for 5–8 public datasets available through APIs, so the
explorer shows the method works on any table of time series. Added: currencies (FRED), euro-area
bonds (ECB), crypto (Coinbase), US industries (Kenneth French), rivers (USGS), European
temperatures (Open-Meteo). The stock markets stay the authors' demo, unchanged; the others use the
library's own functions with the demo's settings, on preparation we wrote (README, "The other
datasets"). Note for the client conversation: a dataset selector edges toward the stage 2 browser
interface; it stays a design exploration with pre-built datasets, no upload.

Oct 27: on Memo's ask, the split in graph 1 is called what the library's README calls it,
"Frequency-domain connectedness" (`frequency_connectedness`), not "Short vs long term". Graph 1's
numbers now change only on a pick, never on hover, and its time row sits right above the sentence
it changes.

## Graph 1 insights: how the cards are grounded (Oct 27)

`app/src/charts/insights.ts` writes the cards from the library's own numbers only:
`dynamic_connectedness(...).total` and `.directional_from` per window, and the full-sample
`static_connectedness(...).total`.

- **Moves** are the index's swings, found with a zigzag. A swing must be at least 2 points, or a
  quarter of the dataset's range, so sudden shocks and slow shifts are both found on any data.
  A move is called "jumped" when 40% of it came in the few steps to one date.
- **Breadth** counts the items whose `directional_from` rose (or fell) over the swing.
- **The window explanation** is exact. A step stops counting `window - lags` steps after it came in
  (VAR(2): 198 weeks for a 200-week window, confirmed on the stocks data). A fall is called
  "the window moving on" only when the same steps raised the index by a comparable amount
  coming in.
- **Level** ranks the latest window among all of them. The full-sample figure is compared with the
  windows only when it sits among them; short windows read higher, so on calm or short data it
  sits below all of them.

`npm run check:insights` recomputes every printed number. It runs on all built-in datasets and on
synthetic uploads of known shapes (`pipeline/insight_fixtures.py`, run through `run_upload`).
The Pages deploy runs it before building.

## Graph 4, picked back up: the directed tree for extremes (Danube), Nov 2026

The 4th graph was tabled on Oct 26 because `causality/` was empty. It isn't any more: the
submodule's upstream `main` added `MaxLinear`, `qtree` and the Danube example data (Miljana's
request, 16 Nov 2026), so the submodule pin moved from `4cc953f` to `1e47ed8` ("fix qtree") to
pull it in. `examples/Demo.ipynb` is byte-identical between the two commits, so graphs 1-3 are
unaffected; `app/src/code.ts`'s `LIB_COMMIT` and the hardcoded commit strings in `app/src/main.ts`
were updated to match (they don't read the pin automatically -- see the README's "Update it").

This isn't the Klüppelberg-and-Krali layered network the tabled note above describes; it's a
different method the library landed first (Tran, Buck and Klüppelberg, 2024, root-directed
trees for river networks specifically). Miljana's request named it directly, with the Danube
as the example, so that's what got built; the industries layered network stays tabled.

**What the brief didn't say, flagged rather than guessed at:**

- **No reference pictures or paper file actually arrived with the request**, despite the message
  saying they were attached; only the paper's URL did. The design here follows the existing
  graphs' conventions (colour, type, pick vs hover, Code/Download) instead of any reference.
- **Miljana expected picking station 21 to warn station 8 downstream.** It doesn't, on either
  the paper's ground-truth tree or the library's estimate with the selected threshold: 8 and 21
  (via 20) are siblings that both feed station 7, not one upstream of the other. Checked both
  ways, not assumed. The app shows what the model actually says; it does not special-case 8.
- **Threshold and lower quantile**: no Danube notebook has landed to fix them, so
  `MaxLinear.select_threshold` chose them (Algorithm 2 of the paper) -- `0.2` and `0.05`, stable
  across five seeds tried. Reported on the page and in `pipeline/run_danube.py`'s comments.
- **"Max-linear coefficients" on the edges**: `fit(method="qtree")` doesn't return those (only
  the "scaling" method does, via `MaxLinearResults.coefs`); its `QTreeResults.scores` (the
  quantile-to-mean-gap statistic the tree search itself optimises, eq. 7 of the paper) is the
  only per-edge number it produces, so edges are sized by that instead, on one fixed scale
  across every pick. A second, scaling-method fit constrained to the estimated tree's order
  would give literal coefficients instead, if that turns out to matter more than running the one
  call the brief named.
- **River lines**: OpenStreetMap (Overpass and Geofabrik both) was blocked by the build
  environment's network policy; Natural Earth, reachable, doesn't carry the Iller, Lech, Naab
  (beyond its Waldnaab headwater) or Regen as named lines at 10m. 17 of the 30 edges are real
  Natural Earth geometry; the rest are straight lines between the two real gauge coordinates,
  marked as such in the data (`drawn: "straight"`) and in the page's own sources list.
- **River groupings for colour**: the "colour = region" rule needed a grouping with no more than
  the palette's eight hues; Saalach (2 stations) shares a colour with Salzach, its larger,
  adjacent sibling, rather than taking a ninth.
- **Print export**: the Download menu's PNG renders this graph at 4x instead of the other
  graphs' 2x, since this one was asked for a print flyer, not a slide.

## Graph 4, round 2: traced rivers, uniform edges, departure marker (Nov 2026)

Miljana's round-2 message named three fixes, with reference images in a Drive folder (the
team's own R plot, a real-river-map-plus-play-bar direction, and a mood image; 3D still out of
scope). All three are done:

1. **More traced rivers.** Re-traced edges against Natural Earth with a looser cross-part /
   cross-record match (see `pipeline/datasets/danube/README.md`), recovering 3 more reaches —
   17 of 30 traced became **20 of 30**. Checked carefully whether the Europe supplement really
   carries the Iller, Lech, Naab and Regen, as the request expected: **the Iller, Lech and Regen
   are genuinely not in it** (every vertex within 20km of each station checked; nearest unrelated
   river 11–85km away) — only the Naab is, as "Waldnaab." This contradicts what was asked for, so
   it's flagged here rather than silently matched or faked. The 10 remaining straight reaches are
   listed in the pipeline README and on the page's own sources list.
2. **Uniform edge width.** The qtree score sized edges in round 1 (see the bullet above); that's
   now removed per the request, since the score is a tree-search statistic, not a flood strength.
   Every edge (and every station dot) renders at one fixed size; the legend's width key is gone;
   the score stays visible only in the Code snippet's `fit.edges()` output.
3. **Match count, corrected, and a departure marker.** Re-deriving the directed-match count
   caught a real bug from round 1: the comparison's directed matches were computed with the
   ground-truth tuple order reversed, reporting **5 of 30** when the library's own `.compare()`
   TPR said 22 of 30 all along. Fixed, with a permanent check (`run_danube.py` asserts the two
   agree; `validate_danube.py` checks the ground-truth tree is itself a real tree) so this can't
   silently recur. The correct count is **22 of 30 directed, 27 of 30 undirected**. The map now
   marks, once a pick's full path to the model's root is shown, where that path departs from the
   real river and draws the real river's own continuation from there to the real outlet (dotted,
   labelled) — e.g. the pick from station 21 ends at the model's root via 4 → 26, while the real
   river continues 4 → 3 → 2 → 1 to Passau.

Station 21 stays the default pick with its real, unmodified path; no 21–8 link was added, per
the request (see the "Miljana expected picking station 21..." bullet above, unchanged by this
round). The two bullets above this section (river lines, and "max-linear coefficients" sizing)
describe round 1's choices and are superseded by points 1 and 2 here; left in place as the
original record rather than rewritten.

**Flagged, not stated in the round-2 message:**

- The root label on the map was renamed from "root" to "model's root" (it already said this
  informally in the intro text) so it reads as the model's own estimate, not a claim about the
  Danube's real outlet, now that the page also draws the real river's path alongside it.
- The departure marker is drawn only once the picked station's animation (or the static view)
  has reached the model's root — showing the correction after the model's own answer, not
  instead of it or before it's finished.
- Round 1 also sized the picked/reached station dots by score (a bigger dot for a bigger score),
  not just the edges. The request named only edge width, but the same reasoning applies, so dot
  radius was fixed too (9px picked/reached, 6px dormant) rather than left as a second, unasked-for
  place the score still drove size on the map.

## Causality as its own method, and a quick 3D sketch (Nov 2026)

Miljana's Demo Day brief asked for a real map, press-play spreading, and (if possible) a 3D
river with time passing, then flagged in a follow-up that the Danube page shouldn't sit among
the connectedness datasets at all: "the river case rests on the causality part... while the
financial data are about connectedness... the river page can be fully its own thing." Confirmed
what that meant concretely from a screenshot of the actual overview: the Danube graph sat as
"4" in the same grid, under the same "Data: World stock markets ▾" bar that graphs 1–3 answer
to and Danube ignores entirely — reading as a 4th connectedness graph that happens to be about
rivers, not a different method.

Fixed with a global switch in the topbar, **Connectedness / Causality**, not another mini-card.
First built it as "Rivers" (the example dataset) at route `#rivers`; renamed to the actual
method name once it was pointed out that "Rivers" names the application, not the statistics --
Connectedness is the real term for the Diebold-Yilmaz/Baruník-Křehlík variance-decomposition
side (graphs 1-3/4), Causality is the real term for Tran, Buck and Klüppelberg's directed-tree/
max-linear method (the Danube graph) -- an extremal-graphical-models, causal-discovery-for-
extremes method, nothing to do with rivers specifically. Matches Miljana's own words back in her
Demo Day brief ("the river case rests on the causality part... while the financial data are
about connectedness"). Route is now `#causality`, not `#rivers` or `#danube`, so the URL, the
switch label and the method all say the same thing, and the mode can hold other causal-extremes
datasets later without another rename.

- Connectedness mode is today's experience minus the Danube tile.
- Causality mode is just the directed-tree graph, with none of Connectedness's chrome (the Data
  bar, the time-window chips, the "Where the numbers come from" footer) — all hidden, not just
  visually de-emphasised. The "‹ All graphs" crumb-back relabels to "‹ Connectedness" on this
  page, since there's no multi-graph list to go back to within Causality.
- The Danube card's own kicker dropped its "4 ·" prefix (it isn't graph 4 of anything now); the
  same text appears in the exported figure caption and the Code snippet's comment, both updated.

For the 3D ask, rather than build the heavier Three.js direction untested, a **quick CSS sketch**
first: a toggle ("3D sketch") that tilts the existing flat map into a table-top perspective
(CSS `perspective` + `rotateX` on the svg itself, nothing re-drawn) and rises a bar at each
station on the picked chain as Play reaches it — same "nothing is sized by the qtree score" rule
as the flat map's edges, so a bar is risen or not, never scaled by score. One real bug caught
building it: `getScreenCTM()` on the tilted svg does **not** reflect the ancestor's CSS
`perspective` (confirmed directly — it returned a point tens of pixels off the station's real
on-screen position), so bars are positioned from the actual rendered station circle's
`getBoundingClientRect()` instead, which is always correct since it's where the browser actually
painted the pixel. Picked, with Miljana, over the fuller 3D-camera direction for this week,
since it reuses the real map and ships fast; the heavier version stays an option if Demo Day
needs more than this.
