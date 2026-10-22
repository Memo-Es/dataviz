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

Didn't build (c), a toggle between both styles. It was on the table but nobody asked for it.
Worth noting though: `encoding.ts` keeps the baseline and §6 palettes as separate exports, so a
toggle wouldn't need either one re-derived if the team wants it later.
