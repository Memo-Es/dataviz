import * as d3 from "d3";
import "./style.css";
import { type Dataset, type Measure, loadDatasets, loadExplorerData, pairSeriesAt, staticBlock } from "./data";
import { Model, type State, Store, type WindowKey, windowOptions } from "./model";
import { REGION_OF, REGION_ORDER, STEP, WASH, setHueOf, fmtDate, fmtSigned, fmtStep, parseDate, readPalette, regionOrder, setDatasetEncoding, tightenDecimals, wash } from "./encoding";
import { NetworkChart } from "./charts/network";
import { TimelineChart, type PeriodBand } from "./charts/timeline";
import { BeadsChart, readBeadColors } from "./charts/beads";
import { findInsights } from "./charts/insights";
import { miniLine, miniMatrix, miniRing } from "./charts/minis";
import { chips, onSegment, segmented, setSegment } from "./ui/segmented";
import "@awesome.me/webawesome/dist/components/dropdown/dropdown.js";
import "@awesome.me/webawesome/dist/components/select/select.js";
import "@awesome.me/webawesome/dist/components/option/option.js";
import "@awesome.me/webawesome/dist/components/dropdown-item/dropdown-item.js";
import "@awesome.me/webawesome/dist/components/dialog/dialog.js";
import { type Figure, downloadPng, downloadSvg } from "./export";
import { type CodeView, pythonFor } from "./code";
import "@awesome.me/webawesome/dist/styles/themes/default.css";
import { QuadrantChart } from "./charts/quadrants";
import { RankingChart } from "./charts/ranking";
import { HeatmapChart } from "./charts/heatmap";
import { HeatmapGridChart } from "./charts/heatmap-grid";
import { sparkline } from "./charts/sparkline";
import { bandCopy } from "./charts/frequency";
import { loadUpload, runUpload, saveUpload } from "./upload/upload";
import { PALETTES, applyPalette, textSafe } from "./palettes";
import { hueOf as hueOfNow } from "./encoding";


/** the demo's two series of the stock data, in words that say what each asks */
const MEASURE_COPY: Partial<Record<string, { label: string; term: string; line: string }>> = {
  returns: { label: "Price moves", term: "returns", line: "each market's weekly % change. When one moves, do the others follow?" },
  volatility: { label: "Turbulence", term: "volatility", line: "how widely each market swung within the week. When one turns turbulent, does it spread?" },
};

/** the ring draws this many of the library's strongest flows until a market is picked */
const TOP_FLOWS = 10;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="topbar">
  <div class="brand">
    <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 7 7 24h18z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="7" r="4.5" fill="var(--bead-1)"/><circle cx="7" cy="24" r="4.5" fill="var(--bead-2)"/><circle cx="25" cy="24" r="4.5" fill="var(--bead-3)"/></svg>
    <span>PyConnectedness <b>Explorer</b></span>
  </div>
  <div class="topbar-right">
    <button class="icon-btn" id="theme" type="button" aria-label="Toggle dark mode"></button>
    <!-- the palette is a design-review choice, not something a reader needs: a small menu, last -->
    <wa-dropdown id="palette" placement="bottom-end">
      <button slot="trigger" class="crumb-btn small" type="button" aria-label="Colour palette">Colours ▾</button>
    </wa-dropdown>
  </div>
</header>

<main>
  <!-- the data choice comes first: a public dataset, or your own file; everything below follows it -->
  <section class="top" id="top" aria-label="Data"></section>

  <!-- an expanded graph: the way back to the overview, and what's on show -->
  <nav class="crumb" id="crumb" aria-label="Where you are" hidden>
    <a href="#" class="crumb-back">‹ All graphs</a><span class="crumb-here" id="crumb-here"></span>
    <span class="crumb-tools">
      <!-- the library calls behind the graph, for what's on screen: to run, check or build on -->
      <button class="crumb-btn" id="code-open" type="button" aria-haspopup="dialog">Code</button>
      <!-- the graph as a figure for a report, with whatever is picked still highlighted -->
      <wa-dropdown id="export" placement="bottom-end">
        <button slot="trigger" class="crumb-btn" type="button">Download ▾</button>
        <wa-dropdown-item value="png">PNG image<span slot="details">documents and slides</span></wa-dropdown-item>
        <wa-dropdown-item value="svg">SVG vector<span slot="details">for editing</span></wa-dropdown-item>
      </wa-dropdown>
    </span>
  </nav>

  <!-- time: the window every graph shows -- the one ending at the week picked on a chart, or a
       fixed period. Above the overview and above each graph, because it changes all of them -->
  <div class="time-row" id="context">
    <div class="windows" id="windows"></div>
  </div>

  <!-- the overview: a small version of each graph; each card opens its graph -->
  <section class="home" id="home" aria-label="Overview">
    <a class="mini-card span-7" href="#index" id="mini-index"></a>
    <a class="mini-card span-5" href="#network" id="mini-network"></a>
    <a class="mini-card span-5" href="#heatmap" id="mini-heatmap"></a>
    <a class="mini-card span-4" href="#frequency" id="mini-freq"></a>
    <!-- not a link: its only place to go would be graph 1 again, which the first card opens -->
    <div class="mini-card mini-static span-3" id="mini-insight"></div>
  </section>

  <section class="card span-12" id="g1">
    <div class="card-head">
      <div>
        <p class="q">1 · When did shocks spread most?</p>
        <h2>Rolling spillover index <code class="tag">dynamic_connectedness(…).total</code></h2>
        <p class="sub" id="timeline-sub"></p>
      </div>
      ${segmented("g1-style", "How the first graph is drawn", [["beads", "Beads"], ["line", "Line"]], "beads", true)}
    </div>
    <div class="readout" id="readout" aria-live="polite"></div>
    <!-- insights on the left, read off the numbers, each pointing at a week; the chart on the right -->
    <div class="g1-body">
      <div class="insights-wrap" id="insights-wrap">
        <ol class="insights" id="insights" tabindex="0" aria-label="What the chart shows"></ol>
        <div class="ins-fade ins-fade-top" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <div class="ins-fade ins-fade-bottom" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
      </div>
      <div class="g1-chart">
        <!-- both drawings sit in one spot, the one not on show kept in place but invisible, so the
             section is the same height either way and switching between them moves nothing -->
        <div class="g1-views">
          <div class="g1-view" id="g1-beads">
            <div class="beads-regions" id="beads-regions"></div>
            <div id="beads" class="chart-host"></div>
            <p class="beads-legend" id="beads-legend"></p>
          </div>
          <div class="g1-view" id="g1-line">
            <div id="timeline" class="chart-host"></div>
            <p class="beads-legend" id="line-legend"></p>
          </div>
        </div>
        <div class="freq" id="freq" aria-live="polite"></div>
      </div>
    </div>
  </section>

  <!-- graph 2: the network, with its own readout and its node values (net) beside it -->
  <section class="card span-12 graph2" id="g2">
    <div class="card-head">
      <div>
        <p class="q">2 · Who passes shocks to whom?</p>
        <h2>Connectedness network <code class="tag">connectedness_graph</code></h2>
        <p class="sub" id="network-sub"></p>
      </div>
      <div class="head-controls">
        <!-- the ring draws the strongest flows until a market is picked; "all" is the library's set -->
        ${segmented("g2-flows", "Flows drawn on the ring", [["top", `Strongest ${TOP_FLOWS}`], ["all", "All"]], "top", true)}
        ${segmented("g2-style", "How the second graph is drawn", [["ring", "Ring"], ["quad", "Quadrants"]], "ring", true)}
      </div>
    </div>
    <div class="readout" id="net-readout" aria-live="polite"></div>
    <div class="graph2-body">
      <div class="graph2-net">
        <div id="network" class="chart-host network-host"></div>
        <div id="quadrants" class="chart-host network-host"></div>
        <div class="legend" id="net-legend">
          <span title="PyConnectedness: net" id="leg-solid"><i class="dot solid"></i>Top half, deeper: passes on more</span>
          <span title="PyConnectedness: net" id="leg-tint"><i class="dot tint"></i>Bottom half, paler: takes in more · bigger = more</span>
          <span title="PyConnectedness: pairwise_net" id="leg-arrow"><i class="arrowkey"></i></span>
          <span id="net-regions"></span>
        </div>
      </div>
      <div class="graph2-side">
        <p class="side-title" id="side-title"></p>
        <p class="side-sub" id="side-sub"></p>
        <div id="ranking" class="chart-host"></div>
      </div>
    </div>
  </section>


  <!-- inside graph 1, on its own: every period's frequency split, the one on show outlined -->
  <section class="card span-12" id="g4" hidden>
    <div class="card-head">
      <div>
        <p class="q">Inside 1 · How long do shocks last?</p>
        <h2>Frequency-domain connectedness <code class="tag">frequency_connectedness</code></h2>
        <p class="sub" id="freq-sub"></p>
        <p class="takeaway" id="freq-takeaway"></p>
      </div>
    </div>
    <div id="freq-chart" class="chart-host"></div>
    <div class="legend" id="freq-legend"></div>
  </section>

  <div class="grid" id="g3-row">

    <section class="card span-7" id="g3">
      <div class="card-head">
        <div>
          <p class="q">3 · How much does each pair pass on?</p>
          <h2>Spillover heatmap <code class="tag">spillover_heatmap</code></h2>
          <p class="sub" id="heatmap-sub"></p>
          <p class="takeaway" id="hm-takeaway"></p>
        </div>
        ${segmented("g3-style", "How the third graph is drawn", [["dots", "Dots"], ["grid", "Original"]], "dots", true)}
      </div>
      <div id="heatmap" class="chart-host"></div>
      <!-- the library's own picture: spillover_heatmap(pairwise_net, cmap="RdBu_r") -->
      <div id="heatmap-grid" class="chart-host"></div>
      <div class="legend" id="heatmap-legend"></div>
    </section>

    <section class="card span-5 detail" id="detail"></section>
  </div>

</main>

<wa-dialog id="code-dialog" class="code-dialog" label="Python for this graph">
  <p class="code-lede" id="code-lede"></p>
  <pre class="code-block" id="code-block" tabindex="0" aria-label="Python code"><code></code></pre>
  <div slot="footer" class="code-actions">
    <button class="crumb-btn" id="code-save" type="button">Download .py</button>
    <button class="crumb-btn code-copy" id="code-copy" type="button">Copy code</button>
  </div>
</wa-dialog>

<footer class="footer" id="footer"></footer>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;


function insightFades() {
  const box = document.getElementById("insights");
  const wrap = document.getElementById("insights-wrap");
  if (!box || !wrap) return;
  wrap.classList.toggle("more-above", box.scrollTop > 2);
  wrap.classList.toggle("more-below", box.scrollTop + box.clientHeight < box.scrollHeight - 2);
}

async function main() {
  const datasets = await loadDatasets();
  const wanted = new URLSearchParams(location.search).get("d");
  const own = wanted === "upload" ? await loadUpload() : null;
  const ds: Dataset = own?.ds ?? datasets.find((d) => d.id === wanted) ?? datasets[0];
  setDatasetEncoding(ds.groups, ds.group_order, ds.episodes, ds.step, ds.steps);
  const measures = Object.keys(ds.measures) as Measure[];
  const mName = (m: Measure) => ds.measures[m] ?? m;
  // the demo's two series of one dataset (returns and volatility): the page offers the choice
  const twoSeries = !own && measures.length > 1;
  const data = own?.data ?? (await loadExplorerData(ds));
  const model = new Model(data);
  const names = model.names;
  const meta = data.meta;
  const last = meta.dynamic.returns.dates.length - 1;

  let theme: State["theme"] = "light";
  try {
    const saved = localStorage.getItem("pc-theme");
    if (saved === "light" || saved === "dark") theme = saved;
    else if (matchMedia("(prefers-color-scheme: dark)").matches) theme = "dark";
  } catch {
    /* storage unavailable: fall back to light */
  }
  document.documentElement.dataset.theme = theme;
  let palette = "nympheas";
  try {
    // a new key since the default changed, so a remembered Seurat doesn't outlive it
    const saved = localStorage.getItem("pc-palette-2");
    if (saved && (saved === "agam" || PALETTES.some((x) => x.id === saved))) palette = saved;
  } catch {
    /* storage unavailable: the default */
  }

  // The one colour rule: an item wears its region's colour on every graph (or its own, when the
  // dataset has a single region; in fixed order, and past the eighth a quiet grey, never cycled)
  const presentRegions = REGION_ORDER.filter((g) => names.some((n) => REGION_OF[n] === g));
  let hues: string[] = [];
  const paint = (id: string, th: State["theme"]) => {
    applyPalette(id, th);
    hues = readBeadColors().hues;
    const p = readPalette();
    setHueOf((n) => {
      const i = presentRegions.length > 1 ? presentRegions.indexOf(REGION_OF[n]) : names.indexOf(n);
      return hues[i] ?? p.muted;
    });
  };
  paint(palette, theme);
  // a region colour as big-number text: deepened (lifted, in dark) to >= 4.6:1, the AAA bar for large text
  const bigHue = (n: string) => {
    const p = readPalette();
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    return textSafe(hueOfNow(n), [p.panel, p.band, bg], store.get().theme === "dark");
  };

  const store = new Store({
    measure: "returns",
    t: last,
    window: "t",
    selected: null,
    pair: null,
    hovered: null,
    hoverT: null,
    theme,
    palette,
  });

  const hover = (n: string | null) => {
    if (n !== store.get().hovered) store.set({ hovered: n });
  };
  // shared by the top bar's toggle and the timeline's end labels
  const setMeasure = (measure: Measure) => {
    const w = store.get().window;
    // volatility has no "last 200 weeks" static block in the notebook
    store.set({ measure, window: measure === "volatility" && w === "last200" ? "full" : w });
  };
  const select = (n: string | null) =>
    store.set({ selected: n === store.get().selected ? null : n, pair: null });
  // a pair and a market are alternative views of the detail panel: picking one clears the other
  const pickPair = (row: string, col: string) => {
    const cur = store.get().pair;
    const same = cur && ((cur[0] === row && cur[1] === col) || (cur[0] === col && cur[1] === row));
    store.set({ pair: same ? null : [row, col], selected: null, hovered: null });
  };

  // the first graph as beads on strings (default) or as the line chart; remembered per browser
  let g1Style: "beads" | "line" = "beads";
  // beads: every region as one row in its colour, or one region opened up into its items
  let beadRegion: string | null = null;
  const pickRegion = (g: string | null) => {
    beadRegion = g === beadRegion ? null : g;
    store.set({ hovered: null });
    renderTimeline(store.get(), readPalette());
  };
  try {
    if (localStorage.getItem("pc-g1") === "line") g1Style = "line";
  } catch {
    /* storage unavailable: beads */
  }
  const beads = new BeadsChart(
    $("beads"),
    names,
    REGION_OF,
    REGION_ORDER,
    (t) => store.set({ t, window: "t", hoverT: null }),
    (hoverT) => {
      if (hoverT !== store.get().hoverT) store.set({ hoverT });
    },
    hover,
    pickRegion
  );
  // the insights scroll: a blur fades out what runs past either end, only when something does
  $("insights").addEventListener("scroll", insightFades, { passive: true });
  new ResizeObserver(insightFades).observe($("insights"));
  // an insight's date picks that week, like a click on its string
  $("insights").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-t]");
    if (b) store.set({ t: +b.dataset.t!, window: "t" });
  });
  onSegment($("g1-style"), (v) => {
    g1Style = v as typeof g1Style;
    try {
      localStorage.setItem("pc-g1", g1Style);
    } catch {
      /* ignore */
    }
    renderTimeline(store.get(), readPalette());
  });

  $("net-regions").innerHTML = presentRegions.length > 1
    ? presentRegions.map((g, i) => `<span class="reg"><i style="background:var(--bead-${i + 1})"></i>${g}</span>`).join("")
    : "";
  const legendDots = `
    <span title="PyConnectedness: pairwise_net"><i class="hm-dot"></i>Dot: the row passes more to the column than it gets back · bigger = more</span>
    <span><i class="hm-ring"></i>Ring: among the strongest 10%, drawn in the network</span>
    ${presentRegions.length > 1 ? `<span>Colour: the sender's region, as in graph 1</span>` : ""}`;
  const legendGrid = `
    <span title="PyConnectedness: pairwise_net"><i class="hm-red"></i>Red: the row passes more to the column than it gets back</span>
    <span><i class="hm-blue"></i>Blue: the column passes more to the row</span>
    <span>Each pair twice, mirrored · the scale runs to this window's largest flow, as the library sets it</span>`;
  // graph 3 as dots (default) or as the library draws it, remembered per browser
  let g3Style: "dots" | "grid" = "dots";
  try {
    if (localStorage.getItem("pc-g3") === "grid") g3Style = "grid";
  } catch {
    /* storage unavailable: the dots */
  }
  onSegment($("g3-style"), (v) => {
    g3Style = v as typeof g3Style;
    try {
      localStorage.setItem("pc-g3", g3Style);
    } catch {
      /* ignore */
    }
    render(store.get());
  });

  const network = new NetworkChart($("network"), names, { onHover: hover, onSelect: select, onPair: pickPair });
  const quadrants = new QuadrantChart($("quadrants"), names, { onHover: hover, onSelect: select, onPair: pickPair });
  // graph 2 as a ring (default) or as coordinates, remembered per browser
  let g2Style: "ring" | "quad" = "ring";
  try {
    if (localStorage.getItem("pc-g2") === "quad") g2Style = "quad";
  } catch {
    /* storage unavailable: the ring */
  }
  let g2Flows: "top" | "all" = "top";
  try {
    if (localStorage.getItem("pc-g2-flows") === "all") g2Flows = "all";
  } catch {
    /* storage unavailable: the strongest few */
  }
  onSegment($("g2-flows"), (v) => {
    g2Flows = v as typeof g2Flows;
    try {
      localStorage.setItem("pc-g2-flows", g2Flows);
    } catch {
      /* ignore */
    }
    render(store.get());
  });
  onSegment($("g2-style"), (v) => {
    g2Style = v as typeof g2Style;
    try {
      localStorage.setItem("pc-g2", g2Style);
    } catch {
      /* ignore */
    }
    render(store.get());
  });
  // the quadrants: net (right passes on more) against its change over about a quarter, on axes
  // fixed across every step; a window that isn't a single step shows the step it ends on
  const quadLag = (m: Measure) => Math.max(4, Math.round((meta.dynamic[m].window * 13) / 200));
  const quadAxes = new Map<Measure, { xMax: number; yMax: number }>();
  const axesFor = (m: Measure) => {
    if (!quadAxes.has(m)) {
      const net = meta.dynamic[m].net;
      const L = quadLag(m);
      // each axis spans its 99th percentile over every step and item, rounded up: sized to the
      // largest extremes, an ordinary quarter's change would sit flat on the line. The rare
      // values beyond sit on the edge; the tooltip has the true number.
      const xs: number[] = [];
      const ys: number[] = [];
      for (let t = 0; t < net.length; t++)
        for (let i = 0; i < names.length; i++) {
          xs.push(Math.abs(net[t][i]));
          if (t >= L) ys.push(Math.abs(net[t][i] - net[t - L][i]));
        }
      const q99 = (v: number[]) => d3.quantile(v.sort((a, b) => a - b), 0.99) ?? 1;
      quadAxes.set(m, { xMax: Math.ceil(q99(xs) / 10) * 10, yMax: Math.ceil(q99(ys) / 5) * 5 });
    }
    return quadAxes.get(m)!;
  };
  const stepOfWindow = (s: State) => {
    const dates = meta.dynamic[s.measure].dates;
    if (s.window === "t") return s.t;
    const end = staticBlock(data, s.measure, s.window as Exclude<WindowKey, "t">).end;
    const iso = /^\d{4}$/.test(end) ? `${end}-12-31` : end;
    let k = 0;
    while (k < dates.length - 1 && dates[k + 1] <= iso) k++;
    return k;
  };
  const ranking = new RankingChart($("ranking"), names, hover, (n) => select(n));
  const heatmap = new HeatmapChart($("heatmap"), names, hover, (n) => select(n), pickPair);
  const heatmapGrid = new HeatmapGridChart($("heatmap-grid"), names, hover, (n) => select(n), pickPair);
  // the line takes whatever room the beads take, so graph 1 is one height in either view
  const fitLine = () => {
    const chrome = $("g1-line").offsetHeight - $("timeline").offsetHeight;
    timeline.setHeight(Math.max(240, $("g1-beads").offsetHeight - chrome));
  };
  new ResizeObserver(() => fitLine()).observe($("g1-beads"));
  const timeline = new TimelineChart(
    $("timeline"),
    (t) => store.set({ t, window: "t", hoverT: null }),
    (key) => store.set({ window: store.get().window === key ? "t" : (key as WindowKey) }),
    (measure) => setMeasure(measure),
    (hoverT) => {
      if (hoverT !== store.get().hoverT) store.set({ hoverT });
    }
  );

  renderTop();
  $("side-title").innerHTML = `Net connectedness by ${ds.item} <code>net</code>`;
  $("side-sub").textContent = `What each ${ds.item} gives minus what it takes, in pp: the circles' sizes, as bars.`;

  const dm = meta.dynamic.returns;
  $("footer").innerHTML = `
    <p><b>Where the numbers come from.</b> ${
      own
        ? `Every value on this page was computed in your browser from <b>${own.rec.name}</b>, which never left this
          computer: PyConnectedness's own functions (commit <code>${own.rec.commit}</code>, run with Pyodide) called by
          <a href="https://github.com/Memo-Es/dataviz/blob/claude/serene-shannon-v6pfgc/pyconnectedness-explorer/pipeline/compute.py">compute.py</a>,
          the same file that builds the public datasets, with the authors' demo settings.`
        : ds.id === "stocks"
        ? `Every value on this page was produced by running PyConnectedness's own
          <a href="https://github.com/zstoi/PyConnectedness/blob/main/examples/Demo.ipynb">examples/Demo.ipynb</a>
          unchanged (commit <code>4cc953f</code>) on Yahoo Finance data, with one extra cell at the end that only
          exports what the demo already made. The run is checked against every number the demo prints.`
        : `The data comes from the ${ds.source} (${ds.api}). Every value on this page is computed by
          PyConnectedness's own functions (<code>static_connectedness</code>, <code>dynamic_connectedness</code>,
          <code>frequency_connectedness</code>, commit <code>4cc953f</code>) with the authors' demo settings, and checked
          against the library's own identities.`
    }</p>
    <p>${meta.weeks} ${ds.steps}, ${fmtDate(parseDate(meta.sample[0])!)} to ${fmtDate(parseDate(meta.sample[1])!)}.
    Generalized variance decomposition, VAR(${dm.lags}), ${dm.horizon}-${ds.step} horizon,
    ${dm.window}-${ds.step} rolling window. Each ${ds.step}'s value describes the ${dm.window} ${ds.steps} ending then.</p>
    <p class="muted">A design prototype for the coaching, not the stage 2 browser interface.</p>`;

  // a change of week/window/measure animates; hover, selection and theme changes don't
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastFrameKey = "";

  // the date chip keeps one width, its widest date's, so picking a week never moves the chips beside it
  let pickedWidth = 0;
  let pickedKey = "";
  const sizePicked = (dates: string[]) => {
    const key = `${dates[0]}|${dates.length}|${document.fonts.status}`;
    if (key === pickedKey) return;
    pickedKey = key;
    // the chips' type (style.css, .chips wa-radio): 700 13px, 13px padding and a 1px edge each side
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `700 13px ${getComputedStyle(document.documentElement).getPropertyValue("--f-sans")}`;
    const widest = Math.max(...dates.map((d) => ctx.measureText(fmtStep(d)).width));
    pickedWidth = Math.ceil(widest + 2 * 13 + 2 + 2);
  };
  document.fonts.ready.then(() => render(store.get()));

  const render = (s: State) => {
    const frameKey = `${s.measure}|${s.window}|${s.t}`;
    const motion = reduceMotion || !lastFrameKey || frameKey === lastFrameKey ? 0 : 180;
    lastFrameKey = frameKey;
    const p = readPalette();
    const m = s.measure;
    const dyn = meta.dynamic[m];
    const full = staticBlock(data, m, "full");
    const frame = model.frame(s);
    const focus = s.hovered ?? s.selected;
    const word = m === "returns" ? "return" : "volatility";

    // controls
    if (twoSeries) {
      setSegment($("measure"), m);
      const c = MEASURE_COPY[m];
      $("measure-line").textContent = c ? `${c.label}: the ${c.term} of the authors' demo (Demo.ipynb), ${c.line}` : mName(m);
    }
    $("theme").textContent = s.theme === "dark" ? "☀" : "☾";
    // the windows: a Web Awesome radio group, built once and updated in place, so arrow keys
    // move through it without losing focus as the page redraws
    const wins = $("windows");
    sizePicked(meta.dynamic[m].dates);
    const opts = windowOptions(data, m);
    const sig = opts.map((o) => `${o.key}:${o.label}`).join("|");
    if (wins.dataset.sig !== sig) {
      wins.dataset.sig = sig;
      wins.innerHTML = chips("win-group", "Window shown on every graph", opts.map((o) => [o.key, o.label]), s.window);
      onSegment($("win-group"), (v) => store.set({ window: v as WindowKey }));
    }
    // the picked window is named by its date: the window ending at the step picked on a chart
    const picked = $("win-group").querySelector<HTMLElement>('wa-radio[value="t"]')!;
    picked.textContent = fmtStep(dyn.dates[s.t]);
    picked.classList.add("win-picked");
    picked.style.minWidth = `${pickedWidth}px`;
    picked.setAttribute("aria-label", `The ${dyn.window} ${ds.steps} up to ${fmtStep(dyn.dates[s.t], false)}`);
    setSegment($("win-group"), s.window);

    // charts
    renderTimeline(s, p);

    // the library keeps the strongest 10% of flows; the ring draws the strongest few of those
    const nFlows = frame.matrix.reduce((a, row) => a + row.filter((v) => v > frame.threshold).length, 0);
    const span = `${frame.label.toLowerCase().startsWith("full") ? "over the " : "in the "}${frame.label.replace(/^Full/, "full")}`;
    // the sentence follows what's picked, never what's under the pointer (hover only lights arrows up)
    const sel = s.selected;
    const selIdx = sel ? names.indexOf(sel) : -1;
    const own = selIdx < 0 ? 0 : frame.matrix[selIdx].filter((v) => v > frame.threshold).length + frame.matrix.filter((row) => row[selIdx] > frame.threshold).length;
    const how = `each arrow runs from the ${ds.item} that passes on more to the one that takes it in`;
    $("network-sub").textContent =
      g2Style !== "ring"
        ? `The strongest 10% of flows ${span}, ${nFlows} in all: ${how}.`
        : s.pair
          ? `One pair of the ${nFlows} flows in the library's strongest 10% ${span}: ${how}.`
          : sel
            ? `${sel}'s ${own} of the ${nFlows} flows in the library's strongest 10% ${span}: ${how}.`
            : g2Flows === "top" && nFlows > TOP_FLOWS
              ? `The ${TOP_FLOWS} strongest of ${nFlows} flows ${span} (the library's strongest 10%): ${how}. Pick a ${ds.item} for all its flows.`
              : `All ${nFlows} flows in the library's strongest 10% ${span}: ${how}.`;
    $("g2-flows").querySelector('[value="all"]')!.textContent = `All ${nFlows}`;
    setSegment($("g2-flows"), g2Flows);
    // only the ring has arrows to thin out; kept in place (invisible) so the header never shifts
    $("g2-flows").style.visibility = g2Style === "ring" && nFlows > TOP_FLOWS ? "" : "hidden";
    renderNetReadout(s, frame);
    const quad = g2Style === "quad";
    setSegment($("g2-style"), g2Style);
    $("network").hidden = quad;
    $("quadrants").hidden = !quad;
    $("leg-solid").innerHTML = quad
      ? `<i class="dot solid"></i>Deeper: right of 0, passes on more`
      : `<i class="dot solid"></i>Top half, deeper: passes on more`;
    $("leg-tint").innerHTML = quad
      ? `<i class="dot tint"></i>Paler: left of 0, takes in more`
      : `<i class="dot tint"></i>Bottom half, paler: takes in more · bigger = more`;
    $("leg-arrow").innerHTML = quad
      ? `<i class="arrowkey"></i>Hover or pick a ${ds.item} for its path over the last ${quadLag(m)} ${ds.steps} and its arrows`
      : `<i class="arrowkey"></i>Arrow: from the ${ds.item} that passes on more to the one that takes in · wider = stronger`;
    if (quad) {
      const t = stepOfWindow(s);
      const net = meta.dynamic[m].net;
      const L = quadLag(m);
      const delta = (j: number, i: number) => (j >= L ? net[j][i] - net[j - L][i] : 0);
      const every = Math.max(1, Math.round(L / 6));
      const trails = names.map((_, i) => {
        const path: [number, number][] = [];
        for (let j = Math.max(L, t - L); j <= t; j += every) path.push([net[j][i], delta(j, i)]);
        if (path.length && t >= L) path.push([net[t][i], delta(t, i)]);
        return path;
      });
      const stepFrame = model.frame({ ...s, window: "t", t });
      quadrants.render(stepFrame, p, model.maxPair[m], focus, s.selected, motion, s.pair, readBeadColors().ink, {
        change: names.map((_, i) => delta(t, i)),
        trails,
        ...axesFor(m),
        lag: L,
        steps: ds.steps,
      });
    }
    else network.render(frame, p, model.maxNet[m], model.maxPair[m], focus, s.selected, motion, s.pair, readBeadColors().ink, g2Flows === "top" ? TOP_FLOWS : null);
    ranking.render(frame, p, model.maxNet[m], focus, s.selected, motion);
    const grid = g3Style === "grid";
    const inWindow = `${frame.label.toLowerCase().startsWith("full") ? "over the " : "in the "}${frame.label.replace(/^Full/, "full")}`;
    $("heatmap-sub").textContent = grid
      ? `As the library draws it (spillover_heatmap, the demo's colours): every pair, ${inWindow}.`
      : `Each pair once, in the row of the ${ds.item} that passes more to the other, ${inWindow}.`;
    setSegment($("g3-style"), g3Style);
    $("heatmap").hidden = grid;
    $("heatmap-grid").hidden = !grid;
    $("heatmap-legend").innerHTML = grid ? legendGrid : legendDots;
    if (grid) heatmapGrid.render(frame, p, model.maxPair[m], focus, s.pair);
    heatmap.render(frame, p, model.maxPair[m], focus, s.pair, (n) => hueOfNow(n), p.band);
    renderHeatTakeaway(frame);
    renderHome(s, frame, p);
    renderFrequency(s);
    $("palette").querySelectorAll<HTMLElement & { checked: boolean; value: string }>("wa-dropdown-item").forEach((it) => (it.checked = it.value === s.palette));
    renderDetail(s, frame, p);
    tightenDecimals(document, ".num");
  };

  function periodBounds(b: { start: string; end: string }): [Date, Date] {
    return /^\d{4}$/.test(b.start)
      ? [new Date(Date.UTC(+b.start, 0, 1)), new Date(Date.UTC(+b.end, 11, 31))]
      : [parseDate(b.start)!, parseDate(b.end)!];
  }

  /** The first graph: the notebook's rolling spillover index (cell 14), named as there, with its
   * readout. Also the only thing a timeline hover re-renders. */
  function renderTimeline(s: State, p: ReturnType<typeof readPalette>) {
    const m = s.measure;
    const other = measures.find((k) => k !== m) ?? null; // drawn grey behind, when there is one
    const periods: PeriodBand[] = (["p1", "p2", "p3", "p4"] as const).map((k) => {
      const b = staticBlock(data, m, k);
      const [a, z] = periodBounds(b);
      return { key: k, start: a, end: z, label: b.label, total: b.total };
    });
    const dyn = meta.dynamic[m];
    const events = Object.keys(ds.episodes).length;
    const asBeads = g1Style === "beads";
    const insights = findInsights(dyn, staticBlock(data, m, "full").total, ds.steps, ds.items);
    const insightSteps = insights.map((x) => x.t);
    const shortDate = (i: number) => {
      const d = parseDate(dyn.dates[i])!;
      const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
      return ds.step === "day" ? fmtDate(d) : `${mon} ${d.getUTCFullYear()}`;
    };
    const icon = { jump: "↗", drop: "↘", peak: "▲", level: "✱\uFE0E" } as const;
    // {date:t} tokens as dates that pick their step, kept on one line with what follows
    const withDates = (str: string) =>
      str.replace(/\{date:(\d+)\}([.,:;]?)/g, (_m, t, p) => `<span class="ins-nowrap"><button type="button" class="ins-date" data-t="${t}">${shortDate(+t)}</button>${p}</span>`);
    $("insights").innerHTML = insights
      .map(
        (x, i) => `<li class="insight${s.window === "t" && s.t === x.t ? " on" : ""}">
          <span class="ins-mark" aria-hidden="true">${i + 1}</span>
          <div><p class="ins-title"><span class="ins-icon" aria-hidden="true">${icon[x.icon]}</span>${x.title}</p>
          <p class="ins-body">${withDates(x.body)}</p>${
            x.more ? `<details class="ins-more"><summary>Details</summary><p class="ins-body">${withDates(x.more)}</p></details>` : ""
          }</div>
        </li>`
      )
      .join("");
    tightenDecimals($("insights"), ".num");
    // the list always starts at its first card: back to the top whenever its cards change (a new
    // dataset or series), never scrolled for the reader
    const box = $("insights");
    const cardsKey = insights.map((x) => `${x.t}:${x.title}`).join("|");
    if (box.dataset.cards !== cardsKey) {
      box.dataset.cards = cardsKey;
      box.scrollTop = 0;
    }
    insightFades();
    setSegment($("g1-style"), g1Style);
    // the view not on show stays laid out but invisible (and out of reach): see .g1-views
    for (const [id, on] of [["g1-beads", asBeads], ["g1-line", !asBeads]] as const) {
      const el = $(id);
      el.classList.toggle("off", !on);
      el.inert = !on;
      el.setAttribute("aria-hidden", String(!on));
    }
    const regions = REGION_ORDER.filter((g) => names.some((n) => REGION_OF[n] === g));
    $("beads-regions").hidden = regions.length < 2;
    // one subtitle for both drawings, so switching changes only the chart
    $("timeline-sub").textContent = `How much of each ${ds.item}'s moves came from shocks elsewhere, over rolling ${dyn.window}-${ds.step} windows.`;
    {
      $("beads-legend").innerHTML = `<span title="PyConnectedness: total"><i class="bk-index"></i>Spillover index: the average of all ${ds.items}</span>
        <span>Each string looks back ${dyn.window} ${ds.steps}: a jump is a shock arriving, a cliff ${dyn.window - dyn.lags} ${ds.steps} later is it leaving. Click a string to pick its ${ds.step}.</span>
        <span title="PyConnectedness: directional_from"><i class="bk-height"></i>Height: share of moves from shocks elsewhere</span>
${
          events ? `<span class="muted">▲ events</span>` : ""
        }<span class="muted" id="beads-floor"></span>`;
      // the regions: a radio group too, built once per dataset and updated in place
      const host = $("beads-regions");
      if (host.dataset.sig !== regions.join("|")) {
        host.dataset.sig = regions.join("|");
        host.innerHTML = chips(
          "region-group",
          "Region shown",
          [["all", "All regions"], ...regions.map((g, i) => [g, `<i style="background:var(--bead-${i + 1})"></i>${g}`] as [string, string])],
          beadRegion ?? "all",
          "regions"
        );
        onSegment($("region-group"), (v) => pickRegion(v === "all" ? null : v));
      }
      setSegment($("region-group"), beadRegion ?? "all");
      beads.render(
        dyn,
        periods,
        s.window === "t" ? s.t : null,
        s.window.startsWith("p") ? s.window : null,
        p,
        readBeadColors(),
        s.hoverT,
        s.hovered,
        beadRegion,
        `${m}|${s.theme}|${s.palette}`,
        insightSteps,
        staticBlock(data, m, "full").total
      );
      $("beads-floor").textContent = `Strings start at ${beads.floor}%, not 0`;
    }
    $("line-legend").innerHTML = `<span title="PyConnectedness: total"><i class="bk-index"></i>Spillover index: the average of all ${ds.items}</span>
      <span>Each point looks back ${dyn.window} ${ds.steps}: a jump is a shock arriving, a cliff ${dyn.window - dyn.lags} ${ds.steps} later is it leaving. Click or drag to pick a ${ds.step}.</span>
      <span class="muted">Dashed line: the full sample${events ? " · dotted: events" : ""}${other ? ` · grey: ${mName(other).toLowerCase()}, to compare` : ""}</span>`;
    timeline.render(
      dyn,
      staticBlock(data, m, "full"),
      meta.episodes,
      periods,
      s.window === "t" ? s.t : null,
      s.window.startsWith("p") ? s.window : null,
      p,
      other ? { measure: other, dyn: meta.dynamic[other] } : null,
      m,
      s.hoverT,
      ds.measures,
      insightSteps
    );
    fitLine();
    renderReadout(s);
  }

  /** Graph 2's readout: what the network on screen is drawn from, or one market's TO / FROM /
   * NET (the library's directional_to, directional_from, net) when one is hovered or picked. */
  function renderNetReadout(s: State, f: ReturnType<Model["frame"]>) {
    const el = $("net-readout");
    // the sentence follows the market you pick, not the one under the pointer (hovering only
    // lights up its arrows)
    const name = s.selected;
    const stat = (label: string, field: string, value: string, sub: string, cls = "", color = "") =>
      `<div class="ro-stat"><span class="ro-label"${field ? ` title="PyConnectedness: ${field}"` : ""}>${label}</span>
        <span class="ro-value ${cls}"${color ? ` style="color:${color}"` : ""}>${value}</span><span class="ro-sub">${sub}</span></div>`;
    const nm = (n: string) => `<b style="color:${bigHue(n)}">${n}</b>`;
    const pp = (v: number, signed = false) => `<span class="num">${signed ? fmtSigned(v) : v.toFixed(1)}</span>`;
    if (name) {
      // a market hovered or picked: what it gives, takes and nets, in one sentence
      const i = names.indexOf(name);
      const out = f.matrix[i].filter((v) => v > f.threshold).length;
      const inn = f.matrix[i].filter((v) => -v > f.threshold).length;
      const tag = s.hovered && s.hovered !== s.selected ? `<span class="ro-tag">Hover</span> ` : "";
      el.innerHTML = `<p class="takeaway">${tag}${nm(name)} gives ${pp(f.to[i])} pp to the others and takes ${pp(f.from[i])} from them:
        net ${pp(f.net[i], true)}, ${f.net[i] >= 0 ? "a net transmitter" : "a net receiver"}${
          out && inn ? `, sending ${out} and receiving ${inn} of the strongest flows`
          : out ? `, sending ${out} of the strongest flows`
          : inn ? `, receiving ${inn} of the strongest flows`
          : ", in none of the strongest flows"
        }.</p>`;
    } else {
      // the answer to "who passes shocks to whom", for the window on show
      const order = names.map((n, i) => ({ n, v: f.net[i] })).sort((a2, b2) => b2.v - a2.v);
      let link = { s: 0, r: 0, v: -Infinity };
      f.matrix.forEach((row, i) => row.forEach((v, j) => v > link.v && (link = { s: i, r: j, v })));
      const top = order[0];
      const bottom = order[order.length - 1];
      el.innerHTML = `<p class="takeaway">${nm(top.n)} passes on the most (net ${pp(top.v, true)} pp), ${nm(bottom.n)} takes in the most
        (${pp(bottom.v, true)}); the strongest flow is ${nm(names[link.s])} → ${nm(names[link.r])}, ${pp(link.v)} pp.</p>`;
    }
    el.classList.toggle("preview", !!s.hovered && s.hovered !== s.selected);
    tightenDecimals(el, ".num");
  }

  /** The top of the page: the dataset selector, and under it the picked dataset's own panel,
   * its title, where it comes from and what's in it. */
  /** The data choice: a public dataset from the list, or your own file run through the library
   * in this browser. One line of facts says what's loaded; the charts below follow it. */
  function renderTop() {
    const [from, to] = meta.sample.map((d) => fmtDate(parseDate(d)!));
    const facts = `<b class="num">${names.length}</b> ${ds.items} · <b class="num">${meta.weeks}</b> ${ds.steps}, ${from} to ${to}`;
    const options = datasets.map((d) => `<wa-option value="${d.id}">${d.title}</wa-option>`).join("");
    const sample = `${import.meta.env.BASE_URL}sample_currencies.csv`;
    const ownHint = `Dates in the first column, one column per series (2 to 25).
      <a href="${sample}" download>Sample file</a>`;
    // a small form: labels on the left, the controls beside them, quiet captions underneath.
    // Parts that belong to one source carry data-src, so the source switch shows them wherever
    // they sit
    const pub = (x: string) => (own ? ` data-src="public" hidden` : ` data-src="public"`) + x;
    const mine = (x: string) => (own ? ` data-src="own"` : ` data-src="own" hidden`) + x;
    $("top").innerHTML = `
      <div class="data-bar">
       <div class="data-line">
        <div class="data-group">
        <span class="data-label">Data</span>
        <div class="data-ctl">
          ${segmented("src", "Data source", [["public", "Public dataset"], ["own", "Your own file"]], own ? "own" : "public")}
          <div class="data-ctl-group" id="src-public"${pub("")}>
            <wa-select id="ds-select" class="ds-select" label="Dataset" placeholder="Choose a dataset" value="${own ? "" : ds.id}">${options}</wa-select>
          </div>
          <div class="data-ctl-group" id="src-own"${mine("")}>
            <label class="file-btn">
              <input type="file" id="file" accept=".csv,text/csv" />
              <span>${own ? "Choose another CSV" : "Choose a CSV"}</span>
            </label>
            ${segmented("kind", "What the numbers are", [["levels", "Levels"], ["changes", "Changes"]], own?.rec.kind === "changes" ? "changes" : "levels", true,
              `title="Levels (prices, index values, counts) are turned into % changes, as the demo does with prices. Changes are used as they are."`)}
          </div>
        </div>
        </div>
        ${
          // two series of the same data (the demo's returns and volatility): which one the page shows
          twoSeries
            ? `<div class="data-group"${pub("")}><span class="data-label">What spreads</span>
        <div class="data-ctl">${segmented("measure", "What spreads", measures.map((k) => [k, MEASURE_COPY[k]?.label ?? mName(k)]), store.get().measure)}</div></div>`
            : ""
        }
       </div>
        <div class="data-captions">
          <p class="data-caption"${pub("")}>${own ? "" : `${facts} · from the <a href="${ds.api_url}" target="_blank" rel="noopener">${ds.api}</a>`}</p>
          ${twoSeries ? `<p class="data-caption" id="measure-line"${pub("")}></p>` : ""}
          <p class="data-caption" id="own-status"${mine("")}>${own ? `<b>${own.rec.name}</b> · ${facts}` : ownHint}</p>
        </div>
      </div>`;
    tightenDecimals($("top"), ".num");

    const show = (src: string) => {
      setSegment($("src"), src);
      $("top").querySelectorAll<HTMLElement>("[data-src]").forEach((el) => (el.hidden = el.dataset.src !== src));
    };
    onSegment($("src"), show);
    $("ds-select").addEventListener("change", (ev) => {
      const id = (ev.target as HTMLElement & { value: string }).value;
      if (id && id !== ds.id) location.search = `?d=${id}`; // the view in the address is kept
    });

    let kind: "levels" | "changes" = own?.rec.kind ?? "levels";
    let file: File | null = null;
    let busy = false;
    const status = $("own-status");
    const run = async () => {
      if (!file || busy) return;
      busy = true;
      $("src-own").classList.add("busy");
      const t0 = performance.now();
      let stage = "";
      const tick = () => {
        status.innerHTML = `<span class="spin" aria-hidden="true"></span>${stage}… <span class="num">${Math.round((performance.now() - t0) / 1000)}</span> s`;
      };
      const timer = window.setInterval(tick, 500);
      try {
        const rec = await runUpload(await file.text(), file.name, kind, (text) => {
          stage = text;
          tick();
        });
        await saveUpload(rec);
        location.search = "?d=upload";
      } catch (err) {
        status.innerHTML = `<span class="err">${(err as Error).message}</span> ${ownHint}`;
      } finally {
        window.clearInterval(timer);
        busy = false;
        $("src-own").classList.remove("busy");
      }
    };
    $<HTMLInputElement>("file").addEventListener("change", (ev) => {
      file = (ev.target as HTMLInputElement).files?.[0] ?? null;
      run();
    });
    onSegment($("kind"), (v) => {
      if (busy) return setSegment($("kind"), kind); // a run is going: keep the one it uses
      kind = v as typeof kind;
      run(); // a file already picked is run again the other way
    });
  }

  /** "Frequency-domain connectedness", as the library's README names it: frequency_connectedness (export_cell.py), which exists per
   * period, not per week. Always drawn with the same structure, so the readout never changes
   * height (it sits above the chart, so a height change moves the chart under the pointer). */
  function speedLine(s: State, preview: boolean) {
    const m = s.measure;
    const blocks = meta.frequency[m] as Record<string, (typeof meta.frequency.returns)["full"]>;
    const week = preview ? s.hoverT! : s.t;
    const when = parseDate(meta.dynamic[m].dates[week])!;
    // the sub-period this step falls in (a rolling window ends after the first period starts)
    const periodOfWeek =
      (["p1", "p2", "p3", "p4"] as const).find((k) => {
        const [a, z] = periodBounds(staticBlock(data, m, k));
        return when >= a && when <= z;
      }) ?? "p4";
    const fromChip = !preview && s.window !== "t" && blocks[s.window];
    const key = fromChip ? s.window : periodOfWeek;
    const fb = blocks[key];
    const option = windowOptions(data, m).find((o) => o.key === key)!;
    const context = fromChip ? option.label : `${option.label}, the period this ${ds.step} falls in`;
    const sum = fb.bands.reduce((a, b) => a + b.total, 0);
    const segs = fb.bands
      .map((b) => {
        const c = bandCopy(b.label);
        // no number inside: the legend under the bar carries it, in ink (AAA)
        return `<span class="seg ${c.cls}" style="flex:${b.total}" title="${c.name}, ${c.phrase}: ${b.total.toFixed(1)} pp"></span>`;
      })
      .join("");
    const words = fb.bands
      .map((b) => {
        const c = bandCopy(b.label);
        return `<span><i class="key ${c.cls}"></i>${c.name} <b class="num">${((b.total / sum) * 100).toFixed(0)}%</b> <em>${c.phrase}</em></span>`;
      })
      .join("");
    return `<div class="ro-speed">
      <p class="ro-speed-head" title="PyConnectedness: frequency_connectedness (Baruník–Křehlík). How long shocks take to play out, on a ${fb.horizon}-${ds.step} horizon, so the three add up to ${fb.static_total.toFixed(1)}% rather than exactly the index."><b>Frequency-domain connectedness</b> <code class="tag">frequency_connectedness</code> <span class="ro-hint">· ${context}</span></p>
      <div class="speed-bar">${segs}</div>
      <div class="speed-words">${words}</div></div>`;
  }

  /** The graph's readout: the library's own measures for the picked week or period, or for the
   * hovered week as a preview. Field names in the labels are the library's. */
  function renderReadout(s: State) {
    const m = s.measure;
    const dyn = meta.dynamic[m];
    // the numbers change only when a week is picked (click or drag), never while the pointer
    // sweeps the chart: hovering just rings the string under it
    const preview = false;
    const f = model.frame(preview ? { ...s, window: "t", t: s.hoverT! } : s);
    const full = staticBlock(data, m, "full");
    const order = names.map((n, i) => ({ n, v: f.net[i] })).sort((a, b) => b.v - a.v);
    const top = order[0];
    const bottom = order[order.length - 1];
    let link = { s: 0, r: 0, v: -Infinity };
    f.matrix.forEach((row, i) => row.forEach((v, j) => v > link.v && (link = { s: i, r: j, v })));
    const diff = f.total - full.total;
    const week = (i: number) => fmtStep(dyn.dates[i]);
    const when = preview
      ? `<span class="ro-tag">Preview</span> ${week(s.hoverT!)} <span class="ro-hint">· click to pick it</span>`
      : s.window === "t"
        ? `${week(s.t)} <span class="ro-hint">· the ${dyn.window} ${ds.steps} up to it</span>`
        : f.label;
    const big = `<b class="big-num" style="color:var(--bead-ink)"><span class="num">${f.total.toFixed(1)}%</span></b>`;
    const vs = (d: number) => `${Math.abs(d) < 0.05 ? "level with" : `<span class="num">${Math.abs(d).toFixed(1)}</span> points ${d > 0 ? "above" : "below"}`} its long-run <span class="num">${full.total.toFixed(1)}%</span>`;
    let sentence: string;
    if (preview || s.window === "t") {
      const t = preview ? s.hoverT! : s.t;
      const share = dyn.total.filter((v) => v < dyn.total[t]).length / dyn.total.length;
      sentence = `${preview ? `<span class="ro-tag">Preview</span> ` : ""}<b>${week(t)}</b>: spillover is ${big}, ${vs(diff)}, higher than
        <span class="num">${Math.round(share * 100)}%</span> of all ${ds.steps}.`;
    } else if (f.key === "full") {
      sentence = `Over the full sample, spillover is ${big}: on average that share of each ${ds.item}'s moves came from shocks elsewhere.`;
    } else {
      sentence = `${f.key === "last200" ? `Over the last ${dyn.window} ${ds.steps}` : `In ${f.short}`}, spillover is ${big}, ${vs(diff)}.`;
    }
    void when;
    const el = $("readout");
    el.classList.toggle("preview", preview);
    el.innerHTML = `
      <p class="takeaway">${sentence}</p>`;
    tightenDecimals(el, ".num");
    // the frequency-domain split sits under the chart, below the strings it describes
    $("freq").innerHTML = speedLine(s, preview);
    tightenDecimals($("freq"), ".num");
  }

  /** Graph 3's answer: where the strongest flows run, region to region */
  function renderHeatTakeaway(f: ReturnType<Model["frame"]>) {
    const flows: [number, number, number][] = [];
    f.matrix.forEach((row, i) => row.forEach((v, j) => v > f.threshold && flows.push([i, j, v])));
    const nm = (n: string, label = n) => `<b style="color:${bigHue(n)}">${label}</b>`;
    let text: string;
    if (presentRegions.length > 1 && flows.length) {
      const count = new Map<string, number>();
      for (const [i, j] of flows) {
        const k = `${REGION_OF[names[i]]}|${REGION_OF[names[j]]}`;
        count.set(k, (count.get(k) ?? 0) + 1);
      }
      const [k, c] = [...count].sort((a, b) => b[1] - a[1])[0];
      const [r1, r2] = k.split("|");
      const first = (r: string) => names.find((n) => REGION_OF[n] === r)!;
      text = `Of the <span class="num">${flows.length}</span> strongest flows, <span class="num">${c}</span> run ${
        r1 === r2 ? `within ${nm(first(r1), r1)}` : `from ${nm(first(r1), r1)} to ${nm(first(r2), r2)}`
      }.`;
    } else if (flows.length) {
      const [i, j, v] = flows.sort((a, b) => b[2] - a[2])[0];
      text = `The strongest flow is ${nm(names[i])} → ${nm(names[j])}, <span class="num">${v.toFixed(2)}</span> pp.`;
    } else text = "No pair passes the cut-off in this window.";
    $("hm-takeaway").innerHTML = text;
    tightenDecimals($("hm-takeaway"), ".num");
  }

  /** Frequency-domain connectedness on its own: every period's split, as the library returns it
   * (frequency_connectedness, per period): bar length is the period's total, split into the three
   * bands; the period the picked week falls in (or the picked period) is outlined; a row picks it. */
  function renderFrequency(s: State) {
    if ($("g4").hidden) return;
    const m = s.measure;
    const blocks = meta.frequency[m] as Record<string, (typeof meta.frequency.returns)["full"]>;
    const opts = windowOptions(data, m).filter((o) => o.key !== "t" && blocks[o.key]);
    // the one on show: the picked period, or the period the picked week falls in (as under graph 1)
    const when = parseDate(meta.dynamic[m].dates[s.t])!;
    const ofWeek = (["p1", "p2", "p3", "p4"] as const).find((k) => {
      const [a, z] = periodBounds(staticBlock(data, m, k));
      return when >= a && when <= z;
    }) ?? "p4";
    const onKey = s.window !== "t" && blocks[s.window] ? s.window : ofWeek;
    const W = 900;
    const LBL = 150;
    const BARW = 600;
    const ROW = 62;
    const top = Math.max(...opts.map((o) => blocks[o.key].bands.reduce((a, b) => a + b.total, 0)));
    const x = (v: number) => (v / top) * BARW;
    const rows = opts
      .map((o, i) => {
        const fb = blocks[o.key];
        const sum = fb.bands.reduce((a, b) => a + b.total, 0);
        const y = 8 + i * ROW;
        let at = LBL;
        const segs = fb.bands
          .map((b) => {
            const c = bandCopy(b.label);
            const w = x(b.total);
            const r = `<rect x="${at.toFixed(1)}" y="${y}" width="${Math.max(0, w - 2).toFixed(1)}" height="24" rx="3" fill="var(--band-${c.cls})"><title>${c.name}, ${c.phrase}: ${b.total.toFixed(1)} pp</title></rect>`;
            at += w;
            return r;
          })
          .join("");
        const shares = fb.bands.map((b) => `${bandCopy(b.label).name.split(" ")[0]} ${((b.total / sum) * 100).toFixed(0)}%`).join(" · ");
        const on = o.key === onKey;
        return `<g class="freq-row" data-key="${o.key}" role="button" tabindex="0" aria-pressed="${on}" aria-label="${o.label}: ${shares}">
          ${on ? `<rect x="2" y="${y - 6}" width="${W - 4}" height="${ROW - 6}" rx="10" fill="var(--accent-wash)" stroke="var(--accent)" stroke-width="2"/>` : ""}
          <rect x="0" y="${y - 6}" width="${W}" height="${ROW - 6}" fill="transparent"/>
          <text x="14" y="${y + 16}" class="freq-label" font-weight="${on ? 700 : 500}">${o.label}</text>
          ${segs}
          <text x="${LBL + x(sum) + 10}" y="${y + 17}" class="freq-total mono">${sum.toFixed(1)}%</text>
          <text x="${LBL}" y="${y + 44}" class="freq-shares">${shares}</text>
        </g>`;
      })
      .join("");
    $("freq-chart").innerHTML = `<svg class="freq-svg" viewBox="0 0 ${W} ${8 + opts.length * ROW}" role="img" aria-label="Frequency-domain connectedness for each period">${rows}</svg>`;
    $("freq-chart").querySelectorAll<SVGGElement>("g.freq-row").forEach((g) => {
      const go = () => store.set({ window: g.dataset.key as WindowKey });
      g.addEventListener("click", go);
      g.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          go();
        }
      });
    });
    // the takeaway: how much of it is short term, across periods and in the one on show
    const shortShare = (k: string) => {
      const b = blocks[k].bands;
      return (b[0].total / b.reduce((a, c) => a + c.total, 0)) * 100;
    };
    const all = opts.map((o) => shortShare(o.key));
    const label = opts.find((o) => o.key === onKey)?.label ?? "";
    $("freq-takeaway").innerHTML = `Short-term shocks carry <span class="num">${Math.min(...all).toFixed(0)}</span>–<span class="num">${Math.max(...all).toFixed(0)}%</span> of spillover across the periods; <span class="num">${shortShare(onKey).toFixed(0)}%</span> in ${label}.`;
    $("freq-sub").textContent = `How long shocks take to play out, for each period: a bar's length is its spillover, split by how fast it passes (${blocks.full.horizon}-${ds.step} horizon). Pick a period to show it on every graph.`;
    $("freq-legend").innerHTML = blocks.full.bands
      .map((b) => {
        const c = bandCopy(b.label);
        return `<span><i class="key ${c.cls}"></i>${c.name}: ${c.phrase}</span>`;
      })
      .join("") + `<span>The bands add up to the period's total from frequency_connectedness, a little under the index</span>`;
    tightenDecimals($("g4"), ".num, .mono");
  }

  /** The overview: a small version of each graph with its headline. The numbers are the same
   * library values the full graphs show, for the same window; each card opens its graph. */
  function renderHome(s: State, frame: ReturnType<Model["frame"]>, p: ReturnType<typeof readPalette>) {
    if ($("home").hidden) return; // drawn when shown (see applyView)
    const m = s.measure;
    const dyn = meta.dynamic[m];
    const v = dyn.total;
    const full = staticBlock(data, m, "full").total;
    const head = (q: string, title: string, tag: string) =>
      `<div class="mini-head"><p class="q">${q}</p><span class="mini-open" aria-hidden="true">↗</span></div><h3>${title} <code class="tag">${tag}</code></h3>`;
    // names at card size stay stone (AAA 7:1); colour is for the marks and the big numbers
    const nm = (n: string) => `<b>${n}</b>`;
    const fill = (n: string, send = true) => wash(hueOfNow(n), send ? WASH.send : WASH.recv);

    // 1: the index, its value for the window on show and, for a single step, its rank
    const t = s.window === "t" ? s.t : null;
    const rank = t === null ? "" : ` · higher than ${Math.round((v.filter((x) => x < v[t]).length / v.length) * 100)}% of ${ds.steps}`;
    $("mini-index").innerHTML =
      head("1 · When did shocks spread most?", "Rolling spillover index", "dynamic_connectedness") +
      `<p class="mini-num"><b class="num mini-big">${frame.total.toFixed(1)}%</b> <span>${frame.label}${rank}</span></p>
      <div class="mini-chart mini-line">${miniLine(v, t, full, { ink: p.fg, accent: p.accent, wash: wash(hueOfNow(names[0]), 0.1), muted: p.muted })}</div>`;

    // 2: the ring, and who passes on and takes in the most
    const order = names.map((_, i) => i).sort((a, b) => frame.net[b] - frame.net[a]);
    const [hi, lo] = [names[order[0]], names[order[order.length - 1]]];
    $("mini-network").innerHTML =
      head("2 · Who passes shocks to whom?", "Connectedness network", "connectedness_graph") +
      `<p class="mini-num">${nm(hi)} passes on the most, ${nm(lo)} takes in the most</p>
      <div class="mini-chart mini-ring">${miniRing(names, frame.net, frame.matrix, frame.threshold, model.maxNet[m], hueOfNow, fill, p.fg)}</div>`;

    // 3: the matrix, with the heatmap's own one-line takeaway
    $("mini-heatmap").innerHTML =
      head("3 · How much does each pair pass on?", "Spillover heatmap", "spillover_heatmap") +
      `<p class="mini-num">${$("hm-takeaway").innerHTML.replace(/ style="[^"]*"/g, "")}</p>
      <div class="mini-chart mini-matrix">${miniMatrix(regionOrder(names), names, frame.matrix, frame.threshold, model.maxPair[m], hueOfNow, (n) => fill(n), p.fg)}</div>`;

    // inside 1: how long shocks last, the same bar as under graph 1
    $("mini-freq").innerHTML = head("Inside 1 · How long do shocks last?", "Frequency-domain connectedness", "frequency_connectedness") + speedLine(s, false);
    // its headline, read off the bar's own legend: the band that carries the most
    const bands = [...$("mini-freq").querySelectorAll(".speed-words > span")].map((el) => ({
      share: +(el.querySelector("b")?.textContent ?? "0").replace("%", ""),
      name: (el.childNodes[1]?.textContent ?? "").trim().toLowerCase(),
      phrase: el.querySelector("em")?.textContent ?? "",
    }));
    const lead = bands.sort((a, b) => b.share - a.share)[0];
    if (lead) $("mini-freq").querySelector(".mini-head + h3")!.insertAdjacentHTML("afterend", `<p class="mini-num"><b class="num mini-big">${lead.share}%</b> <span>of it is ${lead.name}, playing out in ${lead.phrase.replace("≤", "up to ").replace("+", " or more")}</span></p>`);

    // the insight with the biggest move, as on graph 1's cards (dates as plain text: the card is a link)
    const ins = findInsights(dyn, full, ds.steps, ds.items);
    const size = (x: (typeof ins)[number]) => +(x.title.match(/ ([\d.]+) points/)?.[1] ?? 0);
    const top = [...ins].sort((a, b) => size(b) - size(a))[0];
    // dates as on graph 1's cards: month and year, or the day for daily data
    const short = (i: number) => {
      const d = parseDate(dyn.dates[i])!;
      return ds.step === "day" ? fmtDate(d) : d3.utcFormat("%b %Y")(d);
    };
    $("mini-insight").innerHTML =
      `<div class="mini-head"><p class="q">Worth knowing</p></div>
      <h3>${top.title}</h3>
      <p class="mini-body">${top.body.replace(/\{date:(\d+)\}/g, (_x, i) => `<b class="mono">${short(+i)}</b>`)}</p>`;
    tightenDecimals($("home"), ".num");
  }

  function renderPair(s: State, frame: ReturnType<Model["frame"]>, p: ReturnType<typeof readPalette>) {
    const el = $("detail");
    const [a, b] = s.pair!;
    const i = names.indexOf(a);
    const j = names.indexOf(b);
    const v = frame.matrix[i][j]; // > 0: a sends to b, net (the library's pairwise_net)
    const [from, to] = v >= 0 ? [a, b] : [b, a];
    const statement =
      Math.abs(v) < 0.005
        ? `<b>${a}</b> and <b>${b}</b> are balanced: neither sends more to the other.`
        : `<b>${from}</b> sends <b class="num">${Math.abs(v).toFixed(2)}</b> pp more to <b>${to}</b> than it receives back.`;
    const strong = v > frame.threshold || -v > frame.threshold;
    const series = pairSeriesAt(data, s.measure, i, j);
    const scale = Math.max(...series.map(Math.abs), 0.5) * 1.1;
    const windows = windowOptions(data, s.measure)
      .filter((o) => o.key !== "t")
      .map((o) => {
        const pv = staticBlock(data, s.measure, o.key as Exclude<WindowKey, "t">).pairwise_net[i][j];
        const [f, t] = pv >= 0 ? [a, b] : [b, a];
        return `<li class="${o.key === s.window ? "current" : ""}"><span>${o.label}</span><span class="dir">${f} → ${t}</span><b class="num ${pv >= 0 ? "send" : "recv"}">${Math.abs(pv).toFixed(2)}</b></li>`;
      })
      .join("");
    el.innerHTML = `
      <div class="card-head">
        <div><p class="q">Detail · pair</p><h2>${a} ↔ ${b}</h2><p class="sub">${frame.label}</p></div>
        <button class="icon-btn" id="clear" aria-label="Clear pair">✕</button>
      </div>
      <p class="pair-statement">${statement}</p>
      <p class="pair-note">${
        strong
          ? `One of the ${frame.edgeCount} strongest links in this window, so it's drawn in the network.`
          : `Below the strongest-10% cut-off (<span class="num">${frame.threshold.toFixed(2)}</span> pp), so the network doesn't draw it.`
      }</p>
      <p class="k spark-k">Net flow between them, every ${ds.step} (scale fits this pair)</p>
      <div id="spark"></div>
      <p class="k spark-k">By period</p>
      <ul class="pair-windows">${windows}</ul>`;
    sparkline($("spark"), dyn(s).dates, series, s.window === "t" ? s.t : null, scale, p, {
      above: `${a} sends ↑`,
      below: `${b} sends ↓`,
      height: 120,
    });
    el.querySelector<HTMLButtonElement>("#clear")?.addEventListener("click", () => store.set({ pair: null }));
  }

  const dyn = (s: State) => meta.dynamic[s.measure];

  function renderDetail(s: State, frame: ReturnType<Model["frame"]>, p: ReturnType<typeof readPalette>) {
    if (s.pair) return renderPair(s, frame, p); // stays put while the mouse crosses markets
    const el = $("detail");
    // what's picked, never what's under the pointer; with nothing picked, the window's biggest
    // transmitter, so the panel always shows data
    const byNet = names.map((_, j) => j).sort((a, b) => frame.net[b] - frame.net[a]);
    const name = s.selected ?? names[byNet[0]];
    const isDefault = !s.selected;
    if (!name) {
      el.innerHTML = `<div class="card-head"><div><p class="q">Detail · graphs 2 and 3</p><h2>Pick a ${ds.item} or a pair</h2><p class="sub">Click a ${ds.item} (a circle, a bar or a heatmap label) to see where its shocks go and come from, or a pair (an arrow or a heatmap cell) to follow it over time.</p></div></div>
        <div class="empty">${names
          .slice()
          .sort()
          .map((n) => `<button data-n="${n}">${n}</button>`)
          .join("")}</div>`;
      el.querySelectorAll<HTMLButtonElement>("button[data-n]").forEach((b) => (b.onclick = () => select(b.dataset.n!)));
      return;
    }
    const i = names.indexOf(name);
    const sends = names.map((n, j) => ({ n, v: frame.matrix[i][j] })).filter((d) => d.v > 0).sort((a, b) => b.v - a.v).slice(0, 4);
    const gets = names.map((n, j) => ({ n, v: -frame.matrix[i][j] })).filter((d) => d.v > 0).sort((a, b) => b.v - a.v).slice(0, 4);
    const list = (rows: { n: string; v: number }[], cls: string) =>
      rows.length
        ? rows.map((r) => `<li><span>${r.n}</span><b class="num ${cls}">${r.v.toFixed(2)}</b></li>`).join("")
        : `<li class="muted">none</li>`;
    const net = frame.net[i];
    el.innerHTML = `
      <div class="card-head">
        <div><p class="q">Detail · ${isDefault ? `the biggest transmitter · ${REGION_OF[name]}` : `${ds.item} · ${REGION_OF[name]}`}</p><h2>${name}</h2><p class="sub">${frame.label}${isDefault ? ` · pick a ${ds.item} on the graph, or below` : ""}</p></div>
        ${s.selected ? `<button class="icon-btn" id="clear" aria-label="Clear selection">✕</button>` : ""}
      </div>
      <div class="trio">
        <div><span class="k">Gives to others</span><span class="v num">${frame.to[i].toFixed(1)}</span></div>
        <div><span class="k">Takes from others</span><span class="v num">${frame.from[i].toFixed(1)}</span></div>
        <div><span class="k">Net</span><span class="v num ${net >= 0 ? "send" : "recv"}">${fmtSigned(net)}</span></div>
      </div>
      <p class="k spark-k">Net spillover, every ${ds.step}</p>
      <div id="spark"></div>
      <div class="lists">
        <div><p class="k">Sends most to</p><ul>${list(sends, "send")}</ul></div>
        <div><p class="k">Receives most from</p><ul>${list(gets, "recv")}</ul></div>
      </div>
      ${isDefault ? `<p class="k">Another ${ds.item}</p><div class="empty">${names.filter((n) => n !== name).slice().sort().map((n) => `<button data-n="${n}">${n}</button>`).join("")}</div>` : ""}`;
    el.querySelectorAll<HTMLButtonElement>("button[data-n]").forEach((b) => (b.onclick = () => select(b.dataset.n!)));
    const dyn = meta.dynamic[s.measure];
    sparkline($("spark"), dyn.dates, dyn.net.map((row) => row[i]), s.window === "t" ? s.t : null, model.maxNet[s.measure], p);
    el.querySelector<HTMLButtonElement>("#clear")?.addEventListener("click", () => store.set({ selected: null }));
  }

  let raf = 0;
  let pendingFull = false;
  store.subscribe((s, prev) => {
    // a timeline hover only changes the first graph, so skip redrawing everything else
    const keys = Object.keys(s) as (keyof State)[];
    if (keys.some((k) => k !== "hoverT" && s[k] !== prev[k])) pendingFull = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const st = store.get();
      if (pendingFull) render(st);
      else renderTimeline(st, readPalette());
      pendingFull = false;
    });
  });
  // the overview, or one graph on its own: the address says which (#index, #network, #heatmap),
  // so the browser's back button and a shared link both work
  type View = "home" | "index" | "network" | "heatmap" | "frequency";
  const TITLES: Record<Exclude<View, "home">, string> = {
    index: "Rolling spillover index",
    network: "Connectedness network",
    heatmap: "Spillover heatmap",
    frequency: "Frequency-domain connectedness",
  };
  let view: View | null = null;
  let keyboardNav = false;
  addEventListener("keydown", () => (keyboardNav = true), true);
  addEventListener("pointerdown", () => (keyboardNav = false), true);
  const applyView = () => {
    const h = location.hash.replace(/^#\/?/, "");
    const v: View = h in TITLES ? (h as View) : "home";
    const from = view;
    view = v;
    $("home").hidden = v !== "home";
    $("g1").hidden = v !== "index";
    $("g2").hidden = v !== "network";
    $("g3").hidden = v !== "heatmap";
    $("g4").hidden = v !== "frequency";
    $("g3-row").hidden = v !== "network" && v !== "heatmap";
    $("g3-row").classList.toggle("detail-only", v === "network");
    $("crumb").hidden = v === "home";
    $("crumb-here").textContent = v === "home" ? "" : TITLES[v];
    document.title = v === "home" ? "PyConnectedness Explorer" : `${TITLES[v]} · PyConnectedness Explorer`;
    if (from !== null && from !== v) {
      scrollTo(0, 0);
      // keyboard and screen-reader users land where the change happened; a mouse or touch user
      // isn't handed a focus ring they didn't ask for
      if (keyboardNav) {
        if (v === "home") document.getElementById(`mini-${from === "frequency" ? "freq" : from}`)?.focus();
        else $("crumb").querySelector<HTMLElement>(".crumb-back")?.focus();
      }
    }
    render(store.get()); // what was hidden is drawn now, at its real size
  };
  window.addEventListener("hashchange", applyView);
  applyView();

  // the graph on show as a figure: its chart as drawn (picks included), framed for a report
  const figureFor = (v: Exclude<View, "home">): Figure => {
    const s = store.get();
    const m = s.measure;
    const frame = model.frame(s);
    const when = (s.window === "t" ? meta.dynamic[m].dates[s.t] : s.window).toLowerCase();
    const source = (fn: string) =>
      `Source: PyConnectedness (commit 4cc953f), ${fn}, ${mName(m).toLowerCase()}. ${ds.title}, from ${ds.source}. ${frame.label}.${
        // a pick is named only where it is drawn: on the network and the heatmap
        v === "index" ? "" : s.selected ? ` Picked: ${s.selected}.` : s.pair ? ` Picked: ${s.pair[0]} → ${s.pair[1]}.` : ""
      } Made with PyConnectedness Explorer.`;
    const base = { file: `pyconnectedness-${v}-${ds.id}-${m}-${when}`, title: TITLES[v] };
    if (v === "index") {
      const beadsOn = g1Style === "beads";
      const host = $(beadsOn ? "beads" : "timeline");
      return {
        ...base,
        question: "1 · When did shocks spread most?",
        tag: "dynamic_connectedness(…).total",
        sentence: $("readout").innerText,
        host,
        layers: [...host.querySelectorAll<HTMLCanvasElement | SVGSVGElement>(":scope > canvas, :scope > svg")],
        legends: [$(beadsOn ? "beads-legend" : "line-legend")],
        source: source("dynamic_connectedness(…).total"),
      };
    }
    if (v === "network") {
      const host = $(g2Style === "quad" ? "quadrants" : "network");
      return {
        ...base,
        question: "2 · Who passes shocks to whom?",
        tag: "connectedness_graph",
        sentence: $("net-readout").innerText,
        host,
        layers: [...host.querySelectorAll<SVGSVGElement>(":scope > svg")],
        legends: [$("net-legend")],
        source: source("connectedness_graph (strongest 10% of pairwise_net)"),
      };
    }
    if (v === "frequency") {
      return {
        ...base,
        question: "Inside 1 · How long do shocks last?",
        tag: "frequency_connectedness",
        sentence: $("freq-takeaway").innerText,
        host: $("freq-chart"),
        layers: [...$("freq-chart").querySelectorAll<SVGSVGElement>(":scope > svg")],
        legends: [$("freq-legend")],
        source: source("frequency_connectedness (Baruník–Křehlík, periods 5 and 20)"),
      };
    }
    return {
      ...base,
      question: "3 · How much does each pair pass on?",
      tag: "spillover_heatmap",
      sentence: $("hm-takeaway").innerText,
      host: $(g3Style === "grid" ? "heatmap-grid" : "heatmap"),
      layers: [...$(g3Style === "grid" ? "heatmap-grid" : "heatmap").querySelectorAll<SVGSVGElement>(":scope > svg")],
      legends: [$("heatmap-legend")],
      source: source("spillover_heatmap (pairwise_net)"),
    };
  };
  // the graph's Python: the library calls the page made, for the window and pick on show
  const freqKeyFor = (s: State) => {
    const m = s.measure;
    const blocks = meta.frequency[m] as Record<string, unknown>;
    if (s.window !== "t" && blocks[s.window]) return s.window;
    const when = parseDate(meta.dynamic[m].dates[s.t])!;
    return (["p1", "p2", "p3", "p4"] as const).find((k) => {
      const [a, z] = periodBounds(staticBlock(data, m, k));
      return when >= a && when <= z;
    }) ?? "p4";
  };
  const codeFor = (v: CodeView) => {
    const s = store.get();
    const m = s.measure;
    const dyn = meta.dynamic[m];
    const file = m === "volatility" ? "series_volatility.csv" : "series.csv";
    return pythonFor({
      view: v,
      state: s,
      frame: model.frame(s),
      title: ds.title,
      items: ds.items,
      step: ds.step,
      steps: ds.steps,
      measureName: (ds.id === "stocks" && MEASURE_COPY[m]?.label) || mName(m),
      stocks: ds.id === "stocks",
      volatility: m === "volatility",
      seriesUrl: own ? null : new URL(`data/${ds.dir}${file}`, document.baseURI).href,
      upload: own ? { name: own.rec.name, kind: own.rec.kind } : null,
      names,
      window: dyn.window,
      dates: dyn.dates,
      total: dyn.total,
      blocks: meta.static[m] as Record<string, { label: string; start: string; end: string; total: number }>,
      freqKey: freqKeyFor(s),
      regionOf: REGION_OF,
      regions: REGION_ORDER.filter((g) => names.some((n) => REGION_OF[n] === g)),
      quad: v === "network" && g2Style === "quad" ? { date: dyn.dates[stepOfWindow(s)], lag: quadLag(m) } : null,
      grid: g3Style === "grid",
    });
  };
  const codeDialog = $("code-dialog") as HTMLElement & { open: boolean };
  let codeText = "";
  let codeName = "";
  $("code-open").addEventListener("click", () => {
    if (view === "home" || view === null) return;
    const s = store.get();
    codeText = codeFor(view);
    codeName = `pyconnectedness-${view}-${ds.id}-${s.measure}.py`;
    codeDialog.setAttribute("label", `Python for the ${TITLES[view].charAt(0).toLowerCase()}${TITLES[view].slice(1)}`);
    const pick = s.pair ? `, ${s.pair[0]} → ${s.pair[1]} picked` : s.selected && view !== "index" && view !== "frequency" ? `, ${s.selected} picked` : "";
    $("code-lede").textContent = `The library's own calls for what's on screen: ${model.frame(s).label}${pick}. Run it in a notebook and every number it prints matches the page.`;
    $("code-block").querySelector("code")!.textContent = codeText;
    $("code-copy").textContent = "Copy code";
    codeDialog.open = true;
  });
  $("code-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(codeText);
    } catch {
      // no clipboard access (an http page, an old browser): select it for Ctrl+C instead
      const r = document.createRange();
      r.selectNodeContents($("code-block"));
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(r);
      $("code-copy").textContent = "Selected: press Ctrl+C";
      return;
    }
    $("code-copy").textContent = "Copied";
  });
  $("code-save").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([codeText], { type: "text/x-python" }));
    a.download = codeName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });

  $("export").addEventListener("wa-select", (ev) => {
    const kind = (ev as CustomEvent<{ item: HTMLElement & { value: string } }>).detail.item.value;
    if (view === "home" || view === null) return;
    const f = figureFor(view);
    (kind === "svg" ? downloadSvg(f) : downloadPng(f)).catch((e) => console.error("export failed", e));
  });

  // controls
  if (twoSeries) onSegment($("measure"), (v) => setMeasure(v as Measure));
  $("palette").insertAdjacentHTML(
    "beforeend",
    PALETTES.map((x) => `<wa-dropdown-item type="checkbox" value="${x.id}">${x.painter} · ${x.painting.split(" (")[0]}<span slot="details">${x.year}</span></wa-dropdown-item>`).join("") +
      `<wa-dropdown-item type="checkbox" value="agam">Agam (the first look)</wa-dropdown-item>`
  );
  $("palette").querySelectorAll<HTMLElement & { checked: boolean; value: string }>("wa-dropdown-item").forEach((it) => (it.checked = it.value === store.get().palette));
  $("palette").addEventListener("wa-select", (ev) => {
    const id = (ev as CustomEvent<{ item: HTMLElement & { value: string } }>).detail.item.value;
    try {
      localStorage.setItem("pc-palette-2", id);
    } catch {
      /* ignore */
    }
    paint(id, store.get().theme);
    store.set({ palette: id });
  });
  $("theme").addEventListener("click", () => {
    const theme = store.get().theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("pc-theme", theme);
    } catch {
      /* ignore */
    }
    paint(store.get().palette, theme);
    store.set({ theme });
  });
  const step = (d: number) => {
    const s = store.get();
    store.set({ t: Math.max(0, Math.min(last, s.t + d)), window: "t" });
  };

  window.addEventListener("keydown", (ev) => {
    // controls that use the arrow keys themselves (radio groups, menus, the dataset list) keep them
    if ((ev.target as HTMLElement).closest("input,select,textarea,wa-radio-group,wa-dropdown,wa-select")) return;
    if (ev.key === "ArrowRight") step(ev.shiftKey ? 52 : 1);
    else if (ev.key === "ArrowLeft") step(ev.shiftKey ? -52 : -1);
    else if (ev.key === "Escape") store.set({ selected: null, pair: null });
  });
}

main().catch((err) => {
  console.error(err);
  app.innerHTML = `<div class="card"><h2>Couldn't load the data</h2><p>${String(err)}</p></div>`;
});
