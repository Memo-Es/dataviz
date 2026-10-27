# PyConnectedness: Strategic Point of View

Built from the strategic definition questionnaire answered by the PyConnectedness team in October 2026.

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

To test this, we built a working explorer on the pinned library (commit `4cc953f`, imported straight from the project's GitHub repository, never re-implemented). It runs seven real datasets and lets anyone run the same code on their own file in the browser. It is the evidence behind every point below.

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

- **Palettes after French and Dutch Impressionist painters** (Seurat as the default, plus Monet, Renoir, Van Gogh and Breitner), instead of traffic-light red, amber and green. Each was tuned until it passed colour-blind and contrast checks. They read as independent and cultural, never as a trading screen.
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

**The design work we will deliver, and why each piece is there**

The explorer answers three questions in order, one graph each, named as in the library:

| | Question | Name | From the library |
|---|---|---|---|
| 1 | When did shocks spread most? | Rolling spillover index | `dynamic_connectedness(…).total` |
| inside 1 | How long do shocks last? | Frequency-domain connectedness | `frequency_connectedness` |
| 2 | Who passes shocks to whom? | Connectedness network | `connectedness_graph` |
| 3 | How much does each pair pass on? | Spillover heatmap | `spillover_heatmap` |

A fourth graph, the layered network for extreme risk, is designed but tabled, because the library's `causality` module has nothing to draw from yet.

### Original and proposal, graph by graph

Every proposal starts from what the library and the authors' demo (`examples/Demo.ipynb`, commit `4cc953f`) already draw. The numbers never change. What changes is how they are laid out, coloured and explained. Each table puts the original's attributes beside the proposal's, with the reason for each difference. Where both are worth keeping, the explorer offers a switch, so the original is always one click away.

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

### The rules behind every graph

Each rule exists because breaking it made a real reader stumble during the redesign.

- **A control sits above what it changes.** The reader looks at the cause, then sees the effect right below it. When a selection low on the page changed the sentence at the top, the link between the two was lost.
- **Numbers live inside their graph.** The value of the picked week sits on the picked string, not in a summary box elsewhere. A number away from its picture forces the eye to travel and the reader to match things up.
- **Values change only when you pick, never when you hover.** We tried previewing values on hover and dropped it: numbers that flicker as the pointer crosses the chart are hard to trust and impossible to quote. Hover may highlight; only a click changes what the page says.
- **Nothing jumps.** Hovering or picking never moves the layout by a pixel. The sentence keeps a fixed height, the date control keeps the width of its longest date, and the Beads and Line drawings take the same space. Movement that isn't data reads as data. We checked this with a script on every change.
- **One colour rule.** Colour means region, on every graph. A reader who learns "sage is the Americas" on the first chart can carry it to the network and the heatmap without a legend.

### Graph 1: Rolling spillover index (the time series)

**Beads, not just a line.** We offer two drawings of the same numbers, and recommend the beads as the default.

| | Beads | Line |
|---|---|---|
| Shows | A string per window: the average plus one bead per region | The average only |
| Who moved | Visible. In currencies, Europe stays near 83–85% while the Americas fall into the 60s after 2024; the average hides that split | Hidden |
| The rolling window | Visible. Each string is one 200-week window, so a cliff is visibly the shock leaving it | Easy to misread: a fall looks like markets calming |
| Exact timing | Coarser: strings sampled to fit the width | Sharper: every week drawn |
| Matches | Nothing in the library yet | The authors' notebook figure, useful for checking |

The beads tell the story. The line is kept for checking exact dates and for continuity with the notebook. Both carry the same sentence, the same numbered insights and the same legend, and switching between them moves nothing on the page.

**The auxiliary pieces, and the reading problem each one solves.** None of these is a new number; each one helps the reader with a number the library already returns.

- **The sentence above the chart** gives the answer before the picture, for readers who will not decode a chart.
- **The long-run line** gives every week something to compare against. "71.7%" means little alone; "6.7 points below its usual level" means something.
- **The rank** ("higher than 7% of all weeks") answers "is this high?" in words anyone can follow, without a statistics lesson.
- **The window chip named by its date** ("Week of 13 Mar 2020"). An earlier "Picked week" label was abstract, and play and step buttons only animated what the chart already showed. Naming the chip by its date says exactly what every graph on the page is showing.
- **The legend says how to read, not just what the marks are:** "Each string looks back 200 weeks: a jump is a shock arriving, a cliff 198 weeks later is it leaving." It is written for the misreading readers actually make.
- **The region filter** turns "the average moved" into "this region moved".
- **The frequency bar under the chart** ("Frequency-domain connectedness") shows how long the picked period's shocks last, short, medium or long term, with the library's name. It sits right under the chart it describes, in space that was otherwise empty.

**The insights: cards that read the chart for you.** Beside the chart, numbered cards point at the moments worth knowing, and the same numbers ①–⑤ mark those moments on the chart. Here is why they exist, and why they are built the way they are:

- *Why:* most readers never find the moments that matter on their own. A card that says "Spillover jumped 11.7 points; +9.7 of it in the 4 weeks to Mar 2020; all 20 stock markets took in more from the others" turns a shape into a finding.
- *They only compare numbers the library returned.* Every claim is a comparison between library values: a rise, a fall, how many markets moved, where the latest week ranks. The rules are ours and written down; nothing is re-estimated.
- *They explain the trap in rolling windows.* The most common misreading is a sharp fall about four years after a crisis. The cards test it exactly: a week stops counting 198 weeks after it enters a 200-week window, because the model uses each window's first two weeks only as a starting point. When the weeks leaving the window are the ones that pushed the index up on the way in, the card says so: "That is the 4 weeks to Mar 2020 leaving the 200-week window; coming in, they added +9.7. The window moving on, not the markets calming." Otherwise the fall is reported as real.
- *They refuse to overclaim.* On calm or short data, every rolling window reads higher than the full sample, so the comparison would mislead, and the card says that instead. When spillover never passes 25%, the card warns that small swings may be noise.
- *They are checked like the methods are.* An automated check recomputes every number printed on a card. It runs on all seven datasets and on synthetic uploads built to tell a known story (a single shock, a slow shift, unrelated series), which go through the same code as a real upload. The site does not deploy if a check fails. We broke the code on purpose to confirm the check catches it. This is the team's correctness principle applied to explanations: an explanation that is wrong is worse than none.

The cards sit in a scrolling list as tall as the chart, with a soft blur where they run off the edge, so the chart never gets pushed down. The picked card is marked in the same accent colour as the picked string, so text and picture are visibly the same moment.

### Graph 2: Connectedness network

The library's default layout is a circle with the nodes in data order. On it, position means nothing, and the reader has to find the transmitters by reading every label. We keep the circle, because it is the library's picture and users know it, but give position a meaning:

- **Ordered by net.** Net transmitters run across the top, strongest at the left; net receivers across the bottom, biggest at the left. A line across the middle is labelled "↑ passes on more / ↓ takes in more". "Who is most central" becomes "who is at the top left", answered without reading a number.
- **Arrows show direction and strength in one mark:** a curved arrow, wider for a stronger flow. Of the strongest 10% that `connectedness_graph` keeps, the 10 strongest are drawn until a market is picked, then all of its flows; an "All" switch draws the full set. Fewer, clearer arrows beat a hairball.
- **Each node is labelled with its name and net value**, so the number lives in the graph.

A second view, **Quadrants**, answers the question the circle can't: *who is changing?* Across is net (transmitter or receiver); up and down is how much that has changed recently. The four corners are named in plain words: rising transmitters, fading transmitters, deepening receivers, recovering receivers. It came straight out of review: once the ordered ring started to read like coordinates, a real plane was the honest next step.

### Graph 3: Spillover heatmap

We redrew the full colour grid as a dot matrix. Each pair is drawn once, in the sender's row. The dot's size is how much more it passes on than it gets back, and its colour is the sender's region, the same colours as graph 1. A dark ring marks the strongest links, the same ones the network draws, so the two graphs visibly describe the same flows. A grid of coloured squares makes every cell look equally important. Dots let the big flows stand out and the small ones recede, which is what readers want from this view. An **Original** switch draws the heatmap as the library does, so anyone checking against the demo sees the familiar picture.

### Changes over time and animation

The plan pairs "changes over time" with animation in the next release. The explorer suggests a priority: **picking a moment beats playing a sequence.** A play button animating the weeks added little the chart didn't already show, and readers could not stop on the moment they cared about. We removed it in favour of picking a week on the chart, from an insight's date, or with the arrow keys, with every graph following. If animations ship, they should do the same: fixed scales across every frame so nothing rescales mid-play, and an easy way to stop on a frame and read it.

### One consistent style

Everything above is written down once and shared:

- **A style guide** covering palettes, type, colour rules, naming and layout rules, and graph recipes.
- **A matplotlib style sheet** (`pyconnectedness.mplstyle`) with recipes that restyle the library's own `plot_connectedness_graph` and `spillover_heatmap` output, rather than forking them.
- **The explorer**, built on the same palettes and type.

The library, the documentation and the website then draw from one source instead of three.

## 6. Coaching

- Both team members make the visuals today, directly in Python with matplotlib, with Plotly planned
- The goal is for the team to design and test new visuals on their own with simple tools

**The design tools and processes we will teach**

Teach the reasons, not just the recipes, so the team can make the next decision without us. Concretely:

**Tools, all in the language and libraries the team already uses**

- **The style sheet and recipes:** one line, `plt.style.use(...)`, makes any matplotlib figure match the house style.
- **A palette validator:** checks a palette for colour-blind safety and contrast before it ships. This is how the Impressionist palettes were tuned. It still has to be added to the repository for the team's own use.
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
- Bring the style guide up to date with this round's decisions: no hover previews, no play button, the date-named window, the ordered ring and the quadrants.
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
