# PyConnectedness: Strategic Point of View

Built from the strategic definition questionnaire answered by the PyConnectedness team in October 2026.

## About this document

This is a point of view on where PyConnectedness's design stands, and how design can move the project forward. It is told through the explorer we built.

**What the explorer is.** Anyone can use the explorer as an app: open it, pick one of seven public datasets or upload a file, and read the results. That is useful, and it points toward the browser interface planned for stage two. But it is not the explorer's main job. Its main job is to be our instrument for judging design. We build each idea in it, on the real library and real data, then look at it, put it in front of readers, and run checks on it. Then we keep it, change it or drop it. What the explorer shows today is the current design state. Its history is the record of how we got there, including the ideas that failed.

**Why an instrument and not a mock-up.** A mock-up can't show the library's real numbers, so it can't show whether a design reads correctly on them. The explorer imports the pinned library (commit `4cc953f`) from the project's GitHub repository. It runs the same functions with the same settings as the authors' demo notebook. A design that looks right only on invented numbers never gets as far as this document.

**How section 5 is built.** Every design suggestion has its own block, in the same order:

- **Before.** The library's own figure, or the explorer's earlier state that a reader stumbled on.
- **After.** The explorer as it is now.
- **What was added.** The change, in plain words.
- **Why.** The reader's problem it solves.
- **Considered.** The alternatives, and why we didn't choose them.
- **Checked by.** How we know it works.

The images are being added separately. Each placeholder names the state to capture and the commit to capture it from. The capture settings are in the image brief at the end.

**The design state in short**

| Settled: built, checked, recommended | Open: to decide or test next |
|---|---|
| One colour rule (colour means region), WCAG AAA, all text in one stone grey | Which explorer ideas move into the library's own matplotlib plots |
| The library's names and calls on every graph | Animation for the November release, and what it should add to picking |
| A sentence first, the picture second, the method one step away | A reading test with people outside research |
| Values change on pick, never on hover; nothing jumps | A live test of uploads from the public site |
| Beads for the rolling index, with insight cards checked against the data | Moving the contrast, layout and palette checks into the repository |
| The ordered ring, the 10 strongest flows, Quadrants | The tabled fourth graph, which waits on the library's `causality` methods |
| Dots for the heatmap, with the library's original one switch away | |
| An overview page, figure downloads, controls on Web Awesome | |

## 1. Where PyConnectedness stands

- An open source Python library that brings connectedness and extreme risk methods, spread across R packages and code attached to individual papers, into one place
- Today mainly a research tool, aiming to become both a rigorous research library and a product people use on their own data, through a planned browser interface
- The one principle it won't compromise on is scientific correctness and reproducibility

**Our read**

The methods are done. What is missing is a way for the results to explain themselves.

The library's numbers are right and checked. But today the output of a run is a set of tables and a few default plots, and reading them takes someone who already knows the method. That is fine for the authors' own research. It stops being fine the moment the project aims at people outside it, and every goal in this questionnaire does: the browser interface, the industry audience, journalists and NGOs, graphs "readable without explanation".

So the design work is not decoration on top of finished science. It is the missing layer between correct numbers and a reader who can use them.

One principle shapes every recommendation below: **the design must carry the same correctness as the methods.** A chart that misleads with correct numbers breaks the team's one rule just as surely as a wrong estimate. Three things follow:

- every number on screen comes from the library itself, unchanged;
- every sentence that explains a number is checked against that number;
- nothing on the page says more than the data supports.

To test this, we built the explorer described at the top of this document, on the pinned library (commit `4cc953f`, imported straight from the project's GitHub repository, never re-implemented). It runs seven real datasets and lets anyone run the same code on their own file in the browser. It is the evidence behind every point below.

## 2. Who it's for

- Scientists first: academic researchers in finance and economics, researchers in fields with networked data (hydrology, energy, climate), students and teachers in econometrics
- Industry second: central banks and financial supervisors, risk managers and analysts at banks, asset managers and insurers
- Then people outside research who want to investigate causal relationships, like journalists and NGOs

**What this range of audiences means for the visuals**

These audiences read the same graph in different ways:

- A researcher wants to check it against the method.
- An analyst wants the answer for the week in front of them.
- A journalist wants to know what happened and whether it matters.

One graph cannot be three graphs. It can be **layered**, so each reader stops at the depth they need:

1. **A sentence first.** Above every chart sits one plain sentence that reads the picked moment out loud, for example "Week of 4 Sep 2026: spillover is 71.7%, 6.7 points below its long-run 78.3%, higher than 7% of all weeks." Someone outside research can stop there and still leave with the answer. The date comes first because every reader's first question is "when?"
2. **The picture second.** The chart shows the shape: where it rose, where it fell, who moved.
3. **The method last, always one step away.** Each graph is titled with its library name and the function call beside it in small type (`dynamic_connectedness(…).total`). A researcher can trace every pixel back to the code. Everyone else can ignore it without losing anything.

The range also sets two hard requirements:

- **Contrast and colour.** Supervisors, newsrooms and universities increasingly require accessible publications. We hold every graph and every piece of text to WCAG AAA, the strictest level, and every palette is checked for colour-blind safety. All text is one stone grey. Colour is kept for the data and for the few big numbers, so it always means something.
- **Domain-neutral words.** Hydrologists and climate researchers are in the first audience, so the page never assumes markets. Each dataset names its own items ("river gauges", "cities", "currencies"), and the explanations are written to hold for all of them.

## 3. Positioning

- Compared to the R packages (ConnectednessApproach, frequencyConnectedness) and MATLAB code from the original papers, on matching published results
- Not to be compared to commercial black box risk dashboards: a transparent, reproducible research library, not a ready made risk score
- Visualization is where the team wants to stand apart from the R packages
- Look and feel: independent and community driven, with academic credibility, never like a corporate or bank product

**Positioning statement**

> PyConnectedness is the connectedness library whose results explain themselves: the published methods, checked against the papers, drawn so that anyone can see who passes risk to whom and when a system became fragile, and every picture traceable to the code that made it.

**Why this stance, and how the visuals carry it**

The R packages compete on methods, and PyConnectedness matches them there. They leave the reading to the reader: a default plot, a table, a paper to go back to. Standing apart through visualisation means doing the reading work for the user while staying transparent about it.

That is also the line against the black-box dashboards. A dashboard gives you a score and asks for your trust. We give you the number, say how it was made, and show the comparison it rests on.

The look follows from that, with every choice made against the "corporate or bank product" feel:

- **Palettes after French and Dutch Impressionist painters**, instead of traffic-light red, amber and green. The default is Monet's *Nymphéas* (the Water Lilies): sage, misty blue, mauve and lavender, with no orange. Seurat, Monet's *Impression, soleil levant*, Renoir, Van Gogh and Breitner remain as alternatives. Each was tuned until it passed colour-blind and contrast checks. They read as independent and cultural, never as a trading screen.
- **Quiet type and a single text colour.** Plus Jakarta Sans for words, B612 Mono for numbers, all text in one stone grey. Academic credibility comes from restraint, not from logos.
- **The library's own names everywhere.** "Rolling spillover index", "Connectedness network", "Spillover heatmap", "Frequency-domain connectedness". A reader who meets a term on the website meets the same term in the code and the paper. This matters most for reproducibility, and costs nothing.

## 4. Value propositions

- Results you can trust, because they match the published methods and are checked by tests
- The methods in one place, in the language most researchers and analysts already use
- Seeing at a glance who sends risk to whom and who is most central
- Seeing when a system becomes more fragile, for example around crises
- Methods that reach beyond finance, to other connected systems like river networks
- Free, open and transparent, which strengthens trust in research results

**Which of these lead, and in what words**

Lead with the two the visuals can prove in the first ten seconds. Back them with the one that earns the right to be believed.

1. **"See when a system became fragile."** This is the rolling spillover index, the graph a newcomer understands fastest, because time runs left to right and a crisis looks like a crisis.
2. **"See who passes risk to whom."** This is the connectedness network: the library's signature picture, and the one users rank first.
3. **"Every number checked, every picture traceable."** Trust stays the foundation, but said as something you can see, not something you're asked to accept.

Then the reach: **"Not just markets: rivers, temperatures, any connected system."** The explorer already makes this concrete. It runs stock markets, currencies, euro-area bonds, crypto, US industries, river gauges and European temperatures, from public sources, through the same code. Showing a river network next to a stock market says "beyond finance" better than any sentence.

"Free and open" belongs in the footer, not the headline. It is true and important, but readers judge a library by what it shows them first.

## 5. Design priorities

- The connectedness network, the graph that matters most to users
- The time series of total connectedness, right behind it
- Seeing changes over time, together with the animations planned for the next release
- One consistent visual style (colors, layout, labels) across the library, the documentation and the website
- Graphs that people outside research can read without explanation

**Our read**

The explorer answers three questions in order, one graph each, named as in the library:

| | Question | Name | From the library |
|---|---|---|---|
| 1 | When did shocks spread most? | Rolling spillover index | `dynamic_connectedness(…).total` |
| inside 1 | How long do shocks last? | Frequency-domain connectedness | `frequency_connectedness` |
| 2 | Who passes shocks to whom? | Connectedness network | `connectedness_graph` |
| 3 | How much does each pair pass on? | Spillover heatmap | `spillover_heatmap` |

A fourth graph, the layered network for extreme risk, is designed but tabled, because the library's `causality` module has nothing to draw from yet.

Every suggestion below starts from what the library and the authors' demo (`examples/Demo.ipynb`, commit `4cc953f`) already draw. **The numbers never change.** What changes is how they are laid out, coloured and explained. Where both the original and the proposal are worth keeping, the explorer offers a switch, so the original is always one click away.

### How every suggestion was decided

Every suggestion went through the same four steps.

1. **See where a reader stumbles**, in review or in a screenshot.
2. **Weigh the alternatives against the library's own picture.**
3. **Keep the original one click away** wherever both are worth having.
4. **Check the result** with the contrast, layout and number checks before shipping.

The checks we ran on every change:

- **Contrast.** All text at WCAG AAA (7:1) in every palette and both modes.
- **Nothing jumps.** A script hovers and picks across each view and fails on any layout shift.
- **Equal heights.** Views that switch take the same space.
- **The insights check.** Every number a card prints is recomputed from the library. It runs on every deploy.

### The rules behind every graph

Each rule exists because breaking it made a real reader stumble during the redesign.

- **A control sits above what it changes.** The reader looks at the cause, then sees the effect right below it.
- **Numbers live inside their graph.** A number away from its picture forces the eye to travel and the reader to match things up.
- **Values change only when you pick, never when you hover.** Hover may highlight; only a click changes what the page says.
- **Nothing jumps.** Movement that isn't data reads as data.
- **One colour rule.** Colour means region, on every graph.
- **The library's names.** A term on the page is the same term in the code and the paper.

---

### The page

#### 5.1 An overview, and a page for each graph

> **[Image 5.1a · Before]** The explorer as one long scroll, every graph stacked, the reader scrolling past three graphs to reach the fourth. *Capture:* commit `645639ddd`, the full page as a tall screenshot.
>
> **[Image 5.1b · After]** The overview: four cards, each a small live version of its graph with its headline. *Capture:* current, `#home`.

- **What was added.** An overview page of cards, one per graph, each opening its graph on its own page with a way back. Frequency-domain connectedness got its own page, so every card leads somewhere different. The address names the view (`#network`, `#heatmap`), so the back button works and a link can go straight to a graph.
- **Why.** The readers in section 2 arrive with different questions. A supervisor wants who passes risk to whom; a journalist wants when it peaked. One long scroll made each of them read past the others' answers.
- **Considered.** Tabs hide what the other graphs say. A first version had two cards opening the same graph (frequency and graph 1), which made two cards one destination, so we gave frequency its own page. The "Worth knowing" card stays on the overview without a link, because its only destination would be graph 1 again.
- **Checked by.** The small graphs draw the same library values for the same window as the full ones, without labels. A card never shows a number its full graph doesn't.

#### 5.2 A sentence first, with its control right above it

> **[Image 5.2a · Before]** Graph 1 with its week controls apart from the sentence they change. *Capture:* commit `9473a4f1c`, graph 1.
>
> **[Image 5.2b · After]** The week chips above the sentence, the sentence above the chart: "Week of 20 Mar 2020: …". *Capture:* current, `#index`.

- **What was added.** One plain sentence above every graph that reads the picked moment out loud, date first. The controls that change it sit directly above it.
- **Why.** Someone outside research can stop at the sentence and still leave with the answer. When the control sat apart from the sentence, readers changed the week and didn't see what it changed.
- **Considered.** A summary box of four numbers, which we tried earlier. It put numbers away from their picture and gave no reading of them.
- **Checked by.** The sentence keeps a fixed height and the chip keeps the width of its longest date, so the page doesn't move when the week changes. The layout script confirms it.

#### 5.3 Values change on pick, never on hover

> **[Image 5.3a · Before]** Two frames: the pointer over two different weeks, and the sentence and numbers changing with it. *Capture:* commit `4708b55d8`, graph 1, a short screen recording or two frames.
>
> **[Image 5.3b · After]** The same two pointer positions: a hover guide moves, the sentence stays on the picked week. *Capture:* current, `#index`.

- **What was added.** Hover only highlights. Only a click, an insight's date or the arrow keys change what the page says. The detail panel follows the same rule.
- **Why.** Numbers that flicker as the pointer crosses the chart are hard to trust and impossible to quote. A reader who wants to write down a value has to keep the mouse still.
- **Considered.** Keeping the hover previews, which we built first. They were dropped because they changed the numbers without the reader choosing to.
- **Checked by.** The layout script hovers across every view and fails on any change of the sentence or the layout.

#### 5.4 The data bar: "Data" and "What spreads"

> **[Image 5.4a · Before]** The top bar with an unexplained Returns / Volatility toggle. *Capture:* commit `5e8508af5`, the top of the page.
>
> **[Image 5.4b · Steps]** Two layouts that didn't work: the demo's terms crammed into the buttons with a long sentence between the controls (commit `3bfbe32f6`), then the groups stacked in rows (commit `837e1d1e3`).
>
> **[Image 5.4c · After]** One row: **Data** (public dataset or your own file, then the dataset) and **What spreads** (Price moves / Turbulence) side by side, two quiet captions under them. *Capture:* current, any view.

- **What was added.** The toggle moved beside the dataset it belongs to, renamed for the question each series answers. "Price moves" is the weekly returns, "Turbulence" the volatility, the two series the authors' demo builds from the stock data. The captions name the demo's term and credit it.
- **Why.** The toggle is not a library option, so readers didn't know where it came from or what it switched. It sat in the top bar, far from the data it changes.
- **Considered.** Removing it, which would lose the demo's volatility run, often the clearer crisis signal. Keeping the demo's words on the buttons, which read as jargon to anyone outside finance.
- **Checked by.** AAA contrast on the captions. The bar keeps one height whichever dataset is picked. On a phone each group stacks the same way, its label above its controls.

---

### Graph 1 · Rolling spillover index

#### 5.5 Beads on strings, with the line one switch away

> **[Image 5.5a · Before]** The authors' line: total spillover per 200-week window, a dashed full-sample level. *Capture:* `Demo.ipynb` cell 14, stock markets, returns.
>
> **[Image 5.5b · After]** Beads: one string per window, a bead for the average and one per region, the long-run line named on the chart. *Capture:* current, `#index`, Beads.
>
> **[Image 5.5c · After]** The Line view of the same data, the same height and place. *Capture:* current, `#index`, Line.

- **What was added.** Each window is a string with a bead for the average and one per region (`directional_from` averaged by region). Strings are sampled to fit the width, one about every 20 pixels. The long-run line is named ("long-run 78.3%"), and the floor is stated in the legend ("Strings start at 55%, not 0"). A switch keeps the demo's line.
- **Why.** The average hides who moved. In currencies, Europe stays near 83–85% while the Americas fall into the 60s after 2024, and the line shows neither. Each string is one 200-week window, so the window's length is visible, and a cliff reads as the shock leaving it, not as markets calming.
- **Considered.** A line per region tangles. Small multiples put the regions too far apart to compare. The line alone is still the best for exact timing, so it stays as a switch.
- **Checked by.** Beads and Line take exactly the same space, so switching moves nothing below (equal-heights check).

#### 5.6 The week named by its date, the player removed

> **[Image 5.6a · Before]** Play and step buttons beside a "Picked week" chip. *Capture:* commit `e2d012c21`, graph 1's controls.
>
> **[Image 5.6b · After]** The chip reads "Week of 20 Mar 2020"; no player. *Capture:* current, `#index`.

- **What was added.** The chip names the date every graph on the page is showing. You pick a week on the chart, from an insight's date, or with ← and → (shift moves a year).
- **Why.** "Picked week" was abstract. The play button animated what the chart already showed, and readers couldn't stop on the moment they cared about.
- **Considered.** Keeping play next to the date. It adds motion without information (see 5.22).
- **Checked by.** The chip keeps the width of its longest date, so nothing beside it moves.

#### 5.7 Insight cards that read the chart for you

> **[Image 5.7a · Before]** Graph 1 with nothing beside it: the reader finds the moments that matter alone. *Capture:* commit `8becb4c53`, graph 1.
>
> **[Image 5.7b · After]** Numbered cards beside the chart, ①–⑤ marked on the strings, one card picked with the same ink outline as its string, Details open on one card. *Capture:* current, `#index`, the COVID card picked.

- **What was added.** Numbered cards for the moments worth knowing: the biggest rises and falls, the peak, and where the latest week ranks. The same numbers mark the moments on the chart. Each card shows one line, with the rest folded under "Details". They sit in a list as tall as the chart, always starting at the top, with a soft fade where they run off the edge.
- **Why.** Most readers never find the moments that matter on their own. "Spillover jumped 11.7 points; +9.7 of it in the 4 weeks to Mar 2020" turns a shape into a finding. The cards also take on the commonest misreading: a sharp fall about four years after a crisis. A week stops counting 198 weeks after it enters a 200-week window, because VAR(2) spends a window's first two weeks as lags. When the weeks leaving are the ones that pushed the index up on the way in, the card says "the window moving on, not the markets calming".
- **Considered.** Notes on the chart alone crowd it and can't explain the window. Longer cards were tried first and read as a wall of text, so the details were folded.
- **Checked by.** See 5.8.

#### 5.8 Every card checked against the library's numbers

> **[Image 5.8a · Before]** A card from the first version, written against the stock data only. *Capture:* commit `2c7df58c0`, graph 1 on an upload or a non-stock dataset.
>
> **[Image 5.8b · After]** The output of `npm run check:insights`: every dataset and synthetic upload, "all cases pass". *Capture:* a terminal screenshot from `app/`.

- **What was added.** The cards only compare numbers the library returned: a rise, a fall, how many items moved, where the latest week ranks. Nothing is re-estimated. An automated check recomputes every number a card prints, on all seven datasets and on synthetic uploads built to tell a known story (one shock, a slow shift, unrelated series). The synthetic files go through the same code as a real upload. The site does not deploy if a check fails.
- **Why.** The team's one principle is correctness. An explanation that is wrong is worse than none, and a card that held for stocks could mislead on rivers or on a user's file.
- **Considered.** Checking the cards by eye. That covers one dataset at one moment and nothing after the next change.
- **Checked by.** We broke the code on purpose (the window's echo offset at 200 weeks instead of 198) and the check caught it. The cards also refuse to overclaim. When every window reads above the full sample, they compare weeks with each other instead. When spillover never passes 25%, they warn that small swings may be noise.

#### 5.9 Frequency-domain connectedness: under the chart, and a page of its own

> **[Image 5.9a · Before]** The library's result as numbers per band, no figure. *Capture:* the printed result of `frequency_connectedness` in the notebook, or the table in the explorer's JSON.
>
> **[Image 5.9b · After]** Under graph 1: one bar for the picked period, split into short, medium and long term. *Capture:* current, `#index`, under the chart.
>
> **[Image 5.9c · After]** Its own page: one bar per period, the period on show outlined. *Capture:* current, `#frequency`.

- **What was added.** One bar per period, split by band (Baruník–Křehlík, periods 5 and 20), each band's share in the legend, under its library name. Graph 1 shows the bar for the period the picked week falls in. The frequency page shows all of them, and clicking a row picks that period.
- **Why.** "How long do shocks last" answered at a glance. The bar describes the same moment as the chart above it, in space that was otherwise empty.
- **Considered.** A table, which must be read row by row. Region colours for the bands, which would break the one colour rule: the bands are one hue, darker for faster, because they are ordered.
- **Checked by.** AAA on the band labels in every palette.

---

### Graph 2 · Connectedness network

#### 5.10 The ordered ring

> **[Image 5.10a · Before]** The library's circle in data order, red and blue nodes, grey arrows. *Capture:* `Demo.ipynb` cell 19.
>
> **[Image 5.10b · After]** The ring ordered by net: transmitters across the top, strongest at the left; receivers across the bottom; "↑ passes on more / ↓ takes in more" across the middle. *Capture:* current, `#network`, Ring.

- **What was added.** The library's circle, kept, with position given a meaning. Nodes are coloured by region, a deeper wash for transmitters and a paler one for receivers. Area comes from |net| and arrow width from the flow, both on one scale across every week. Each node is labelled with its name and net value.
- **Why.** On the library's circle, position means nothing, and the reader finds the transmitters by reading every label. Ordered, "who is most central" becomes "who is at the top left". One scale means a size can be compared between weeks.
- **Considered.** A spring layout moves the nodes every week, which the library's own docstring warns about. A flat transit-map layout (height for net) was built and read well, but lost the picture users know. We weighed two rows, which lose it too.
- **Checked by.** AAA on every label; labels sit outside the ring so none collide.

#### 5.11 The 10 strongest flows, all on request

> **[Image 5.11a · Before]** Every flow above the cut-off drawn at once: twenty or more crossing arrows. *Capture:* commit `ab3b8791a`, graph 2.
>
> **[Image 5.11b · After]** The 10 strongest by default; a second frame with one market picked, showing all of its flows. *Capture:* current, `#network`, then Germany picked.

- **What was added.** Of the flows `connectedness_graph` keeps (the strongest 10% of |`pairwise_net`|), the ring draws the 10 strongest until a market is picked, then all of that market's flows. An "All" switch draws the library's full set.
- **Why.** Twenty or more crossing arrows were a hairball. Ten can be followed.
- **Considered.** Fainter arrows still tangle. Hiding the small ones for good would lose the library's set.
- **Checked by.** The flows are the library's, unchanged; only how many are drawn at once changes.

#### 5.12 Quadrants: who is changing

> **[Image 5.12a · Before]** The ring alone: it shows who transmits, not who is changing. *Capture:* commit `763960715`, graph 2.
>
> **[Image 5.12b · After]** Quadrants: net across, its change over about a quarter up and down, the four corners named. *Capture:* current, `#network`, Quadrants.

- **What was added.** A second view behind a switch. Across is net; up and down is how much it changed over about a quarter, both centred on zero. The corners are named in plain words: rising transmitters, fading transmitters, deepening receivers, recovering receivers.
- **Why.** In review, once the ordered ring started to read like coordinates, a real plane was the honest next step.
- **Considered.** A table of changes says it in numbers, not at a glance.
- **Checked by.** The same views and heights check as the ring; switching moves nothing.

#### 5.13 A market's trail as a path in time

> **[Image 5.13a · Before]** A picked market's trail as a thick smoothed curve that loops like a connection. *Capture:* commit `e23c7e5e9`, `#network`, Quadrants, a market picked.
>
> **[Image 5.13b · After]** The same trail straight, thin and dotted, a dot per sample fading toward now, the "13 weeks ago" note above the names. *Capture:* current, same pick.

- **What was added.** Straight segments between the fortnightly positions, thin and dotted, with a dot per sample that fades toward the present.
- **Why.** The smoothing curve overshot between samples, inventing loops the data doesn't have. At arrow width it read as a flow.
- **Considered.** Keeping the curve. It invents movement the data doesn't have.
- **Checked by.** Every point on the trail is a sampled week's own value; nothing is drawn between them but a straight line.

#### 5.14 Net by market, and the detail panel

> **[Image 5.14a · Before]** The demo's twenty small line charts, one per market. *Capture:* `Demo.ipynb` cell 17.
>
> **[Image 5.14b · Before]** The detail panel empty until something is hovered, its numbers changing under the pointer. *Capture:* commit `bdd65c552`, graph 2.
>
> **[Image 5.14c · After]** Bars beside the ring, sorted by net for the picked week, and the detail panel open on the top transmitter with its net over time. *Capture:* current, `#network`.

- **What was added.** A bar per market for the picked week, sorted, in the ring's region washes. The detail panel opens on the biggest transmitter and follows only what is picked, with that market's net over time as one line.
- **Why.** Comparing markets needs one shared axis; one market's history needs one line, not twenty. A panel that said "pick something" gave nothing to new readers, and one that followed the pointer broke the pick-not-hover rule.
- **Considered.** Keeping the small multiples, which make the comparison across markets hard.
- **Checked by.** The layout script: picking a market changes the panel, hovering doesn't.

---

### Graph 3 · Spillover heatmap

#### 5.15 Dots instead of coloured squares

> **[Image 5.15a · Before]** The library's heatmap: every pair twice, red to blue, data order. *Capture:* `Demo.ipynb` cells 18 and 21.
>
> **[Image 5.15b · After]** Dots: each pair once in the sender's row, area for the flow, colour for the sender's region, grouped by region, the strongest flows ringed. *Capture:* current, `#heatmap`, Dots.

- **What was added.** Each pair drawn once, as a dot in the sender's row. Area shows the size of the flow and colour the sender's region. Rows and columns are grouped by region, with region marks beside them. The strongest flows are ringed, the same ones the network draws. One scale across every week. Empty cells keep a pinpoint.
- **Why.** In the colour grid, every square looks equally important, and half the grid repeats the other half with the sign flipped (`pairwise_net` is antisymmetric). Dots let the big flows stand out and the small ones recede. Grouping shows flows within and between regions as blocks.
- **Considered.** A pale circle in every cell, which we tried. Across 400 cells it made a texture louder than the flows, so only a pinpoint stays.
- **Checked by.** The ringed flows match the network's drawn flows for the same week.

#### 5.16 The library's original, one switch away

> **[Image 5.16a · Before]** Dots only: no way to check against the demo's figure. *Capture:* commit `83f3b8f93`, `#heatmap`.
>
> **[Image 5.16b · After]** The Original view: red-blue, mirrored, data order, colour bar, axes titled "from ↓" and "to →". *Capture:* current, `#heatmap`, Original, full sample.

- **What was added.** An Original switch that draws `spillover_heatmap(pairwise_net, cmap="RdBu_r")` as the library does: the same colours, the mirrored grid, the data order, the colour bar and the per-window scale.
- **Why.** Anyone checking against the demo sees the familiar picture. One departure, so it reads correctly: the library's default axis titles ("shock source", "affected variable") describe its default matrix and are backwards for `pairwise_net`, so both views say "from" and "to".
- **Considered.** Leaving the library's titles unchanged, which would make the original read backwards.
- **Checked by.** On the full sample it matches the demo's figure cell for cell.

---

### Colour and type

#### 5.17 One colour rule, AAA, one stone grey

> **[Image 5.17a · Before]** The first look: red for transmitters and blue for receivers, as the library draws them, with colour meaning something different on each graph. *Capture:* commit `521c47260`, graphs 1 and 2.
>
> **[Image 5.17b · After]** Colour only for region and the few big numbers; all text in one stone grey. *Capture:* current, `#index` and `#network`.

- **What was added.** Colour means region on every graph. All text is one stone grey at 7:1 or more (WCAG AAA), never set on a colour. Controls are at least 44 pixels. Plus Jakarta Sans for words, B612 Mono for numbers.
- **Why.** A reader who learns "sage is the Americas" on the first chart can carry it to the network and the heatmap without a legend. Supervisors, newsrooms and universities increasingly require accessible publications.
- **Considered.** Red and blue for transmitter and receiver, as the library does. Position and depth already say that, so colour is free for region.
- **Checked by.** The contrast check, in every palette and both modes.

#### 5.18 From bright to calm: Monet's *Nymphéas*

> **[Image 5.18a · Before]** Seurat at full saturation, a vermilion highlight. *Capture:* commit `16a013d8f`, graph 2.
>
> **[Image 5.18b · Before]** Seurat toned down: still a sienna orange in the largest shapes. *Capture:* commit `35326d3f4`, graph 2.
>
> **[Image 5.18c · After]** *Nymphéas*: sage, misty blue, mauve and lavender, pale washes with a thin full-hue edge. *Capture:* current, `#network`; optionally the same in dark mode.

- **What was added.** Palettes after French and Dutch Impressionists, with Monet's *Nymphéas* as the default and no orange. Big shapes are pale washes of their colour with a thin edge in the full hue. Seurat, *Impression, soleil levant*, Renoir, Van Gogh and Breitner stay in a Colours menu.
- **Why.** The first palette read as bright and jarring. Toning it down kept Europe in sienna, and that orange filled the largest shapes: the transmitters, the net bars, the heatmap dots. Impressionist softness comes from harmony, not low saturation: related cool hues, light broken fills, strong colour only in thin strokes. The edge carries the contrast accessibility needs, so the fill can be soft.
- **Considered.** Muting the same hues, which we tried, and which kept the orange.
- **Checked by.** A search tried thousands of variations of each painter's hues and kept only palettes that pass colour-blind separation, separation for normal vision and 3:1 against the page, then chose the calmest.

#### 5.19 A monochrome selected state

> **[Image 5.19a · Before]** A picked chip and string in the palette's highlight colour, orange in several palettes. *Capture:* commit `78a101f07`, `#index`, a region picked.
>
> **[Image 5.19b · After]** The same pick in the palette's ink. *Capture:* current, same pick.

- **What was added.** "Picked" is always the palette's ink, in every palette and both modes: a dark outline on strings, rows and cards, and a dark chip.
- **Why.** A coloured highlight competed with the region colours and changed with every palette. Now colour means one thing only.
- **Considered.** Keeping each palette's own highlight, as before: one more colour beside the regions, and a different one per palette.
- **Checked by.** The contrast check on the picked chip's text.

---

### Controls

#### 5.20 Controls on Web Awesome, themed at the source

> **[Image 5.20a · Before]** Hand-made switches and a native dataset menu. *Capture:* commit `7762bef41`, the top bar.
>
> **[Image 5.20b · Before]** Web Awesome with its own look showing through: a blue focus glow, bright blue options, two stacked focus rings. *Capture:* commit `e8e9db019`, a menu open.
>
> **[Image 5.20c · After]** The same controls themed to the page: stone, one focus ring, one row marked at a time in a pale band. *Capture:* current, the dataset menu and the Download menu open.

- **What was added.** Switches, chips and menus on Web Awesome (web components), with its colour, surface, focus and font settings pointed at ours once, so every component matches in both modes.
- **Why.** A UI library gives tested keyboard and screen-reader behaviour, and the team gets less code to maintain.
- **Considered.**

  | Option | For | Against | Decision |
  |---|---|---|---|
  | Web Awesome (web components) | Works in the current page without a rewrite; themeable; handles keyboard and labelling | Adds about 34 kB | **Chosen** |
  | React with shadcn/ui | The strongest accessibility building blocks | A rewrite weeks before the November release, for no gain in readability | Revisit for the stage-two browser interface |
  | Motion Primitives | Polished animated components | Requires React; its value is motion, and nothing should move that isn't data | Not chosen |

- **Checked by.** AAA on every option. Each control has exactly one focus ring, shown only for the keyboard. ← and → inside a control move within it, not the week.

---

### Figures

#### 5.21 Figures for reports

> **[Image 5.21a · Before]** No way to take a graph out of the page, except a screenshot that loses its source. *Capture:* commit `239097f8e`, graph 2.
>
> **[Image 5.21b · After]** A downloaded PNG of the network with Germany picked: question, title and call, sentence, legend and source line. *Capture:* current, `#network`, Germany picked, Download → PNG.

- **What was added.** A Download menu on each graph, PNG (twice the size, for print) or SVG (editable, the two fonts embedded). The figure is the graph as set up, with the pick still highlighted, framed by the question, the title and its call, the sentence, the legend and a source line: library commit, function, dataset, window and pick.
- **Why.** The readers in section 2 put graphs into reports, slides and papers. A screenshot loses the source; the library's plots lose the pick.
- **Considered.** A screenshot, which loses the source. Exporting the library's own matplotlib plots, which lose the pick.
- **Checked by.** Screen-only hints ("Click a string…") are left out. One limit: the beads arrive in an SVG as a picture under editable labels.

---

### Changes over time

#### 5.22 Picking a moment before playing a sequence

> **[Image 5.22 · Now]** A short recording: stepping weeks with ← and →, the network, ranking and quadrants gliding between weeks. *Capture:* current, `#network`, about five seconds.

- **What is there.** Every graph follows the picked week. Network, ranking and quadrants glide for 180 ms between weeks instead of jumping. Dragging across the line view scrubs the weeks. ← and → step a week, shift a year. Quadrants trails show the last 13 weeks.
- **Why this order.** A play button added little the chart didn't already show, and readers couldn't stop on the moment they cared about. Picking comes first; animation must serve it.
- **Recommended for the November release.** Fixed scales across every frame so nothing rescales mid-play; an easy stop on any frame; a "Replay this move" on an insight card that plays only the weeks of that move; a bracket on the beads showing the window the picked string covers; drag scrubbing on the beads too; and a check that reduced-motion settings turn the glides off.

---

### One consistent style

Everything above is written down once and shared:

- **A style guide** covering palettes, type, colour rules, naming and layout rules, and graph recipes.
- **A matplotlib style sheet** (`pyconnectedness.mplstyle`) with recipes that restyle the library's own `plot_connectedness_graph` and `spillover_heatmap` output, rather than forking them.
- **The explorer**, built on the same palettes and type.

The library, the documentation and the website then draw from one source instead of three.

### Every suggestion at a glance

| # | Suggestion | What went wrong before | Alternatives, and why not | Chosen, and why |
|---|---|---|---|---|
| 5.1 | Overview | One long scroll: a reader with one question scrolled through all of them | Tabs hide what the other graphs say | **Cards with small graphs**: each reader goes straight to their question |
| 5.2 | Sentence first | The week control sat apart from what it changed | A box of four numbers, away from the picture | **A sentence, its control right above it** |
| 5.3 | Pick, not hover | Numbers flickered under the pointer | Hover previews, built first, change numbers unasked | **Pick only**: numbers you can trust and quote |
| 5.4 | What spreads | The Returns / Volatility toggle was unexplained and in the wrong place | Removing it loses the demo's volatility run | **Beside the dataset, named for its question; the demo's term in a caption** |
| 5.5 | Beads | The average hid which region moved, and a fall four years after a crisis read as calm | A line per region tangles; small multiples are too far apart | **Beads**, the line one switch away |
| 5.6 | Week by its date | "Picked week" was abstract; play animated what the chart showed | Keeping play adds motion without information | **The date on the chip, the player removed** |
| 5.7 | Insight cards | Readers did not find the moments that matter | Notes on the chart crowd it | **Numbered cards tied to numbered marks** |
| 5.8 | Checked cards | A card true for stocks could mislead on other data | Checking by eye covers one dataset once | **A check on every printed number, run on deploy** |
| 5.9 | Frequency bar | The bands came back only as numbers | A table reads row by row | **One bar per period**, under graph 1 and on its own page |
| 5.10 | Ordered ring | On the library's circle, position meant nothing | A spring layout moves every week; transit map and two rows lose the familiar picture | **The ordered circle** |
| 5.11 | 10 strongest | Twenty or more arrows tangled | Fainter arrows still tangle | **10 by default, all on request** |
| 5.12 | Quadrants | The ring can't show who is changing | A table says it in numbers, not at a glance | **A plane, as a switch** |
| 5.13 | Trail | It looped like a connection | Keeping the curve invents movement | **Straight, thin and dotted** |
| 5.14 | Net bars, detail panel | Twenty small charts; a panel that followed the pointer | Small multiples can't compare markets | **Sorted bars; a panel on the top transmitter that follows picks** |
| 5.15 | Dots | Every square looked equally important, half the grid repeated | A circle in every cell was louder than the flows | **Dots, once per pair, by region** |
| 5.16 | Original heatmap | No way to check against the demo | The library's axis titles read backwards | **The library's picture, titled "from" and "to"** |
| 5.17 | One colour rule, AAA | Colour meant several things; text in several colours | Red and blue for sign, as the library does | **Colour is region; one stone grey at AAA** |
| 5.18 | *Nymphéas* | Bright and jarring, then still orange | Muting the same hues kept the orange | ***Nymphéas*, washes and edges** |
| 5.19 | Mono selected | The highlight competed with the regions | Each palette's own highlight: one more colour | **The palette's ink** |
| 5.20 | Web Awesome | Hand-made controls; then its blue theme showing | React with shadcn/ui; Motion Primitives | **Web Awesome, themed at the source** |
| 5.21 | Figures | No figure to take into a report | A screenshot loses the source; the library's plots lose the pick | **Figures from the page, with the pick and the source** |
| 5.22 | Motion | Play couldn't stop on a moment | Play first, picking second | **Picking first; animation to serve it** |

## 6. Coaching

- Both team members make the visuals today, directly in Python with matplotlib, with Plotly planned
- The goal is for the team to design and test new visuals on their own with simple tools

**The design tools and processes we will teach**

Teach the reasons, not just the recipes, so the team can make the next decision without us. Concretely:

**Tools, all in the language and libraries the team already uses**

- **The style sheet and recipes:** one line, `plt.style.use(...)`, makes any matplotlib figure match the house style.
- **A palette validator:** checks a palette for colour-blind safety and contrast before it ships. This is how the Impressionist palettes were tuned, and the search behind *Nymphéas* ran it thousands of times. It still has to be added to the repository for the team's own use.
- **One theme for the controls:** the Web Awesome settings in the stylesheet. Changing a colour there changes every switch, menu and list.
- **Checks that turn design rules into tests**, so a rule holds without a designer watching:
  - the insights check: every printed number recomputed from the library. It is in the repository, and the site's deploy runs it;
  - text contrast against AAA, in every palette and both light and dark mode;
  - "nothing jumps": the layout must not shift when hovering or picking.

  The last two ran on every change during the redesign but still live outside the repository. Moving them in is a next step. A researcher already trusts tests, and design rules that run as tests get kept.

**A five-step process for any new graph**

1. **Start from the question**, in the reader's words ("who passes shocks to whom?").
2. **Name it as the library does**, and show the call beside the title.
3. **Write the one sentence** the graph should make obvious, before drawing anything.
4. **Draw, then remove** everything that doesn't serve that sentence.
5. **Test it on someone outside research.** Ask them what the graph says, without explaining it. If their answer isn't the sentence, the graph isn't done.

**A short checklist for every change:** control above what it changes; number inside its graph; values change on pick, not hover; nothing jumps; one colour rule; AAA contrast; library names.

## 7. Timeline

- November 2026: the regular funding phase ends, with animations and improved visuals
- December 2026: presentation at the Research in Options conference
- Second stage, four months if approved: user testing, workshops, browser interface, sustainability
- Next Prototype Fund round (Class 03): application for an extension to new models and fields

## 8. Definition of success

- People outside research can read the main graphs without explanation from the team
- A consistent visual style is used across the library, the documentation and the website
- The team can design and test new visuals on its own with simple tools
- The redesigned graphs are already in a release or in the documentation

## Next steps

Ordered by the timeline, each tied to a success criterion.

**Before the November release** *(success: redesigned graphs in a release or the documentation)*

- Ship the style sheet and the restyled network, heatmap and time-series recipes into the documentation, so the redesign is in the project and not only in the explorer.
- Decide which explorer ideas move into the library's own plots. The ordered ring and the insight cards are the strongest candidates; tapered or hand-drawn shapes are not, because they would make the plotting code hard to maintain without a designer.
- Bring the style guide up to date with the explorer's decisions. It still describes hover previews, the play button and the earlier network edges. It should add the overview, *Nymphéas* with washes and edges, the monochrome selected state, the Web Awesome theme, the figure downloads, the Dots and Original heatmap, the 10-strongest rule and "What spreads".
- Move the palette validator and the contrast and layout-shift checks into the repository next to the insights check, and have the deploy run them too.

**For the December conference** *(success: readable without explanation)*

- Present with the explorer: one dataset from finance and one from outside it (rivers or temperatures), walking the three questions in order.
- Run a first informal reading test with a few people outside research, using step 5 of the process above. Their answers become the baseline for the user testing in stage two.

**Second stage** *(success: the team designs and tests on its own)*

- Turn the reading test into the user-testing protocol: the same questions, asked of each audience in section 2.
- Build the browser interface on the explorer's upload path. It already runs the library itself in the browser, so a user's file never leaves their computer. It still needs a live test from the public site, which our sandbox could not reach.
- Run the coaching as workshops: the team designs one new graph end to end with the process and the checks, and we review it.

**Class 03 application** *(success: a consistent style across new models and fields)*

- Pick up the tabled fourth graph, the layered network for extreme risk, once the library's `causality` methods exist. Its design and rules are already in the style guide.
- Use the datasets beyond finance as evidence that the style and the reading aids hold for any connected system, not just markets.

## Appendix A · Original and proposal, attribute by attribute

Every proposal starts from what the library and the authors' demo (`examples/Demo.ipynb`, commit `4cc953f`) already draw. The numbers never change. What changes is how they are laid out, coloured and explained. For reference behind section 5, each table puts the original's attributes beside the proposal's, with the reason for each difference. Where both are worth keeping, the explorer offers a switch, so the original is always one click away.

**Graph 1 · Rolling spillover index** · `dynamic_connectedness(…).total`. Original: the demo's own line (cell 14). Proposal: **Beads** (default), with **Line** as a switch.

| Attribute | Original | Proposal | Why |
|---|---|---|---|
| What it shows | One line: the average over all items | One string per window, with a bead for the average and one per region (`directional_from` averaged by region) | The average hides who moved. A rise driven by one region and a rise everywhere look the same on a line |
| Time | Every week | Strings sampled to fit the width, one about every 20 pixels (some 35 on a laptop screen); the Line view keeps every week | Fewer marks, so the big moves stand out. The line stays for exact timing |
| Reference | Dashed grey line at the full-sample total | The same dashed line, named on the chart ("long-run 78.3%") | A level means little without "compared with what" |
| Colour | Black line | Region colours on the beads; the average in ink | One colour rule: colour is region on every graph |
| Scale | Matplotlib's automatic y-axis | A floor chosen from the data, stated in the legend ("Strings start at 55%, not 0") | Saves room without hiding the cut |
| Explanation | A title with the settings ("200-week window, VAR(2), H=10") | A sentence above the chart for the picked week; numbered insight cards; a legend that warns about the window ("a cliff 198 weeks later is it leaving") | The reading, not just the settings. The commonest misreading gets its own warning |
| Interaction | None (a static figure) | Pick a week on the chart, from an insight's date or with the arrow keys; pick a region; switch Beads or Line | Every other graph follows the picked week |

**Inside graph 1 · Frequency-domain connectedness** · `frequency_connectedness`. Original: no figure in the demo or the library; the result is numbers per band. Proposal: **one bar** split into short, medium and long term.

| Attribute | Original | Proposal | Why |
|---|---|---|---|
| What it shows | Spillover per frequency band, as numbers | One bar per period, split by band, each band's share in the legend | "How long do shocks last" answered at a glance |
| Colour | n/a | One hue, darker for faster | The bands are ordered (short to long), so the colour is ordered too, and kept apart from the region colours |
| Placement | n/a | Under graph 1, for the period the picked week falls in | It describes the same moment as the chart above it |

**Graph 2 · Connectedness network** · `connectedness_graph` and `plot_connectedness_graph`. Original: demo cell 19. Proposal: an **ordered ring** (default), with **Quadrants** as a switch.

| Attribute | Original | Proposal | Why |
|---|---|---|---|
| Which flows | Every pair above the 90th percentile of \|`pairwise_net`\| | The same cut-off; the ring draws the 10 strongest by default, all of a market's flows when it is picked, and all of them with the "All" switch | Twenty or more crossing arrows tangle; ten can be followed |
| Position | `circular_layout`, in data order: position means nothing | Transmitters across the top, strongest at the left; receivers across the bottom, biggest at the left; the middle line labelled "↑ passes on more / ↓ takes in more" | Position becomes a ranking: "most central" is "top left" |
| Node colour | Red for net transmitters, blue for net receivers (`tab:red`, `tab:blue`) | Region colour, a deeper wash for transmitters and a paler one for receivers, each edged in the full hue | Colour carries region, as on every graph. Transmitter or receiver is already said twice: by position and by depth |
| Node size | Area from \|net\|, relative to the largest in the plot | Area from \|net\|, on one scale across every week | Sizes can be compared between weeks |
| Arrows | Grey, width relative to the strongest in the plot, slightly curved | Ink, width from the cut-off to the strongest flow in any week, curved toward the centre | Wider means stronger, and means the same in every week |
| Labels | The name on each node | The name and its net value beside each node, outside the ring | The number lives in the graph |
| A second view | None | Quadrants: net across, its change over about a quarter up and down, with the corners named (rising transmitters, fading transmitters, deepening receivers, recovering receivers) | Answers what the ring can't: who is changing |

**Beside graph 2 · Net position by market** · `net`. Original: twenty small line charts, one per market (demo cell 17). Proposal: **a bar per market**, beside the ring, sorted by net, plus one market's line in the detail panel.

| Attribute | Original | Proposal | Why |
|---|---|---|---|
| What it shows | Each market's net over time, 20 small panels | Each market's net for the picked window, as bars, sorted; one market's net over time in the detail panel | Comparing markets needs one shared axis; one market's history needs one line, not twenty |
| Colour | Black | Region washes, as on the ring | The same colour rule |

**Graph 3 · Spillover heatmap** · `spillover_heatmap(pairwise_net, cmap="RdBu_r")`. Original: demo cells 18 and 21. Proposal: **Dots** (default), with **Original** as a switch that draws the library's own picture.

| Attribute | Original | Proposal (Dots) | Why |
|---|---|---|---|
| Cells | Every pair twice, mirrored (`pairwise_net` is antisymmetric) | Each pair once, a dot in the sender's row; empty cells keep a pinpoint | Half the grid repeats the other half with the sign flipped |
| Encoding | Colour, red to blue around zero | Dot area for the size of the flow; colour for the sender's region | Area makes the big flows stand out and the small ones recede; every coloured square looks equally important |
| Order | Data order | Grouped by region, with region bars beside the rows and above the columns | Flows within and between regions show as blocks |
| Strongest flows | Not marked | Ringed: the same flows the network draws | The two graphs visibly describe the same links |
| Scale | Each matrix's own range (colours change meaning between periods) | One scale across every week | A dot size means the same in every week |
| Axis titles | "shock source" (columns) and "affected variable" (rows): the defaults for the library's default matrix, but backwards for `pairwise_net`, where a positive cell means the row passes more to the column | "from" and "to", in the Original view too | So the original can be read right |

In the **Original** view everything else is kept as the library draws it: the red-blue colours, the mirrored grid, the data order, the colour bar and the per-window scale. On the full sample it matches the demo's figure cell for cell.

**Across every graph, the proposal adds what the originals leave to the reader:**

- the library's name and call above each graph;
- one sentence for the current selection;
- a legend written against misreadings;
- the same picked week everywhere;
- a figure to download that keeps the pick and names its source.

None of it is a new number.

## Appendix B · Image brief

For whoever adds the images. Every placeholder in section 5 looks like this:

> **[Image 5.n·x · Before / After / Steps / Now]** what the image shows. *Capture:* where to take it from.

**Default settings**, unless a placeholder says otherwise:

- Viewport 1440 × 900, light mode.
- Dataset: Stock markets. What spreads: Price moves.
- Week of 20 Mar 2020 picked: the COVID jump, where every graph has something to show.
- The palette that commit shipped with, since the palette is part of the state.
- Crop to the graph's card, with its title and sentence. Keep a before and its after at the same crop, so they compare side by side.

**Library figures** ("`Demo.ipynb` cell n"): run `vendor/PyConnectedness/examples/Demo.ipynb` at commit `4cc953f` and take the figure that cell draws.

**Earlier explorer states** ("commit `…`"):

```
git checkout <commit>
cd pyconnectedness-explorer/app && npm install && npm run dev
```

Before commit `239097f8e` there is no overview: the whole explorer is one page, so scroll to the graph. From that commit on, each graph has its own address: `#home`, `#index`, `#network`, `#heatmap`, `#frequency`.

**Current state** ("current"): the head of `claude/serene-shannon-v6pfgc`, or the live site.

**Interactions** (5.3, 5.22): two frames side by side, or a short screen recording of up to five seconds.
