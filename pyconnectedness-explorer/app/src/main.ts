import * as d3 from "d3";
import "./style.css";
import { type Dataset, type Measure, loadDatasets, loadExplorerData, pairSeriesAt, staticBlock } from "./data";
import { Model, type State, Store, type WindowKey, windowOptions } from "./model";
import { REGION_OF, REGION_ORDER, STEP, setHueOf, fmtDate, fmtSigned, fmtStep, parseDate, readPalette, setDatasetEncoding, tightenDecimals } from "./encoding";
import { NetworkChart } from "./charts/network";
import { TimelineChart, type PeriodBand } from "./charts/timeline";
import { BeadsChart, readBeadColors } from "./charts/beads";
import { findInsights } from "./charts/insights";
import { QuadrantChart } from "./charts/quadrants";
import { RankingChart } from "./charts/ranking";
import { HeatmapChart } from "./charts/heatmap";
import { sparkline } from "./charts/sparkline";
import { bandCopy } from "./charts/frequency";
import { loadUpload, runUpload, saveUpload } from "./upload/upload";
import { PALETTES, applyPalette, textSafe } from "./palettes";
import { hueOf as hueOfNow } from "./encoding";


const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="topbar">
  <div class="brand">
    <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 7 7 24h18z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="7" r="4.5" fill="var(--bead-1)"/><circle cx="7" cy="24" r="4.5" fill="var(--bead-2)"/><circle cx="25" cy="24" r="4.5" fill="var(--bead-3)"/></svg>
    <span>PyConnectedness <b>Explorer</b></span>
  </div>
  <div class="topbar-right">
    <label class="select small" title="Colour palette">
      <span class="sr">Colour palette</span>
      <select id="palette"></select>
    </label>
    <div class="segmented" id="measure" role="group" aria-label="Measure"></div>
    <button class="icon-btn" id="theme" type="button" aria-label="Toggle dark mode"></button>
  </div>
</header>

<main>
  <!-- the data choice comes first: a public dataset, or your own file; everything below follows it -->
  <section class="top" id="top" aria-label="Data"></section>

  <section class="card span-12" id="g1">
    <div class="card-head">
      <div>
        <p class="q">1 · When did shocks spread most?</p>
        <h2>Rolling spillover index <code class="tag">dynamic_connectedness(…).total</code></h2>
        <p class="sub" id="timeline-sub"></p>
      </div>
      <div class="segmented small" id="g1-style" role="group" aria-label="How the first graph is drawn">
        <button type="button" data-style="beads">Beads</button>
        <button type="button" data-style="line">Line</button>
      </div>
    </div>
    <!-- time: step through the weeks or pick a window; the sentence right under it says what's
         picked, date first, and every graph follows -->
    <div class="time-row">
      <div class="player">
        <button class="icon-btn" id="prev" aria-label="Previous step">‹</button>
        <button class="play" id="play" aria-label="Play"></button>
        <button class="icon-btn" id="next" aria-label="Next step">›</button>
      </div>
      <div class="windows" id="windows" role="group" aria-label="Window shown on every chart"></div>
    </div>
    <div class="readout" id="readout" aria-live="polite"></div>
    <!-- insights on the left, read off the numbers, each pointing at a week; the chart on the right -->
    <div class="g1-body">
      <ol class="insights" id="insights" tabindex="0" aria-label="What the chart shows"></ol>
      <div class="g1-chart">
        <div id="timeline" class="chart-host"></div>
        <div class="beads-regions" id="beads-regions" role="group" aria-label="Region shown"></div>
        <div id="beads" class="chart-host"></div>
        <p class="beads-legend" id="beads-legend"></p>
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
      <div class="segmented small" id="g2-style" role="group" aria-label="How the second graph is drawn">
        <button type="button" data-style="ring">Ring</button>
        <button type="button" data-style="quad">Quadrants</button>
      </div>
    </div>
    <div class="readout" id="net-readout" aria-live="polite"></div>
    <div class="graph2-body">
      <div class="graph2-net">
        <div id="network" class="chart-host network-host"></div>
        <div id="quadrants" class="chart-host network-host"></div>
        <div class="legend">
          <span title="PyConnectedness: net" id="leg-solid"><i class="dot solid"></i>Top half, solid: passes on more</span>
          <span title="PyConnectedness: net" id="leg-tint"><i class="dot tint"></i>Bottom half, tinted: takes in more · bigger = more</span>
          <span title="PyConnectedness: pairwise_net" id="leg-arrow"><i class="arrowkey"></i>Arrow: sender to receiver · thicker and darker = stronger</span>
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


  <div class="grid">

    <section class="card span-7" id="g3">
      <div class="card-head">
        <div>
          <p class="q">3 · How much does each pair pass on?</p>
          <h2>Spillover heatmap <code class="tag">spillover_heatmap</code></h2>
          <p class="sub" id="heatmap-sub"></p>
          <p class="takeaway" id="hm-takeaway"></p>
        </div>
      </div>
      <div id="heatmap" class="chart-host"></div>
      <div class="legend" id="heatmap-legend"></div>
    </section>

    <section class="card span-5 detail" id="detail"></section>
  </div>

</main>

<footer class="footer" id="footer"></footer>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function main() {
  const datasets = await loadDatasets();
  const wanted = new URLSearchParams(location.search).get("d");
  const own = wanted === "upload" ? await loadUpload() : null;
  const ds: Dataset = own?.ds ?? datasets.find((d) => d.id === wanted) ?? datasets[0];
  setDatasetEncoding(ds.groups, ds.group_order, ds.episodes, ds.step, ds.steps);
  const measures = Object.keys(ds.measures) as Measure[];
  const mName = (m: Measure) => ds.measures[m] ?? m;
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
  let palette = "seurat";
  try {
    const saved = localStorage.getItem("pc-palette");
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
    playing: false,
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
  $("beads-regions").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-region]");
    if (b) pickRegion(b.dataset.region || null);
  });
  // an insight's date picks that week, like a click on its string
  $("insights").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-t]");
    if (b) store.set({ t: +b.dataset.t!, window: "t", playing: false });
  });
  $("g1-style").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-style]");
    if (!b) return;
    g1Style = b.dataset.style as typeof g1Style;
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
  $("heatmap-legend").innerHTML = `
    <span title="PyConnectedness: pairwise_net"><i class="hm-dot"></i>Dot: the row passes more to the column than it gets back · bigger = more</span>
    <span><i class="hm-ring"></i>Ring: among the strongest 10%, drawn in the network</span>
    ${presentRegions.length > 1 ? `<span>Colour: the sender's region, as in graph 1</span>` : ""}`;

  const network = new NetworkChart($("network"), names, { onHover: hover, onSelect: select, onPair: pickPair });
  const quadrants = new QuadrantChart($("quadrants"), names, { onHover: hover, onSelect: select, onPair: pickPair });
  // graph 2 as a ring (default) or as coordinates, remembered per browser
  let g2Style: "ring" | "quad" = "ring";
  try {
    if (localStorage.getItem("pc-g2") === "quad") g2Style = "quad";
  } catch {
    /* storage unavailable: the ring */
  }
  $("g2-style").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-style]");
    if (!b) return;
    g2Style = b.dataset.style as typeof g2Style;
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
  $("measure").innerHTML = measures.map((k) => `<button data-measure="${k}">${mName(k)}</button>`).join("");
  $("measure").hidden = measures.length < 2;
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
  const PLAY_MS = 90;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastFrameKey = "";

  const render = (s: State) => {
    const frameKey = `${s.measure}|${s.window}|${s.t}`;
    const motion = reduceMotion || !lastFrameKey || frameKey === lastFrameKey ? 0 : s.playing ? PLAY_MS : 180;
    lastFrameKey = frameKey;
    const p = readPalette();
    const m = s.measure;
    const dyn = meta.dynamic[m];
    const full = staticBlock(data, m, "full");
    const frame = model.frame(s);
    const focus = s.hovered ?? s.selected;
    const word = m === "returns" ? "return" : "volatility";

    // controls
    $("measure").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.measure === m)));
    $("theme").textContent = s.theme === "dark" ? "☀" : "☾";
    $("play").textContent = s.playing ? "❚❚" : "▶";
    $("play").setAttribute("aria-label", s.playing ? "Pause" : `Play through the ${ds.steps}`);
    const wins = $("windows");
    wins.innerHTML = "";
    for (const o of windowOptions(data, m)) {
      const b = document.createElement("button");
      b.textContent = o.key === "t" ? `Picked ${ds.step}` : o.label;
      b.setAttribute("aria-pressed", String(o.key === s.window));
      b.onclick = () => store.set({ window: o.key, playing: false });
      wins.appendChild(b);
    }

    // charts
    renderTimeline(s, p);

    $("network-sub").textContent = `The strongest 10% of flows, ${frame.label.toLowerCase().startsWith("full") ? "over the " : "in the "}${frame.label.replace(/^Full/, "full")}: each arrow runs from the ${ds.item} that passes on more to the one that takes it in.`;
    renderNetReadout(s, frame);
    const quad = g2Style === "quad";
    $("g2-style").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.style === g2Style)));
    $("network").hidden = quad;
    $("quadrants").hidden = !quad;
    $("leg-solid").innerHTML = quad
      ? `<i class="dot solid"></i>Solid: right of 0, passes on more`
      : `<i class="dot solid"></i>Top half, solid: passes on more`;
    $("leg-tint").innerHTML = quad
      ? `<i class="dot tint"></i>Tinted: left of 0, takes in more`
      : `<i class="dot tint"></i>Bottom half, tinted: takes in more · bigger = more`;
    $("leg-arrow").innerHTML = quad
      ? `<i class="arrowkey"></i>Hover or pick a ${ds.item} for its path over the last ${quadLag(m)} ${ds.steps} and its arrows`
      : `<i class="arrowkey"></i>Arrow: sender to receiver · thicker and darker = stronger`;
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
    else network.render(frame, p, model.maxNet[m], model.maxPair[m], focus, s.selected, motion, s.pair, readBeadColors().ink);
    ranking.render(frame, p, model.maxNet[m], focus, s.selected, motion);
    $("heatmap-sub").textContent = `Each pair once, in the row of the ${ds.item} that passes more to the other, ${frame.label.toLowerCase().startsWith("full") ? "over the " : "in the "}${frame.label.replace(/^Full/, "full")}.`;
    heatmap.render(frame, p, model.maxPair[m], focus, s.pair, (n) => hueOfNow(n), p.band);
    renderHeatTakeaway(frame);
    $<HTMLSelectElement>("palette").value = s.palette;
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
    $("insights").innerHTML = insights
      .map(
        (x, i) => `<li class="insight${s.window === "t" && s.t === x.t ? " on" : ""}">
          <span class="ins-mark" aria-hidden="true">${i + 1}</span>
          <div><p class="ins-title"><span class="ins-icon" aria-hidden="true">${icon[x.icon]}</span>${x.title}</p>
          <p class="ins-body">${x.body.replace(/\{date:(\d+)\}([.,:;]?)/g, (_m, t, p) => `<span class="ins-nowrap"><button type="button" class="ins-date" data-t="${t}">${shortDate(+t)}</button>${p}</span>`)}</p></div>
        </li>`
      )
      .join("");
    tightenDecimals($("insights"), ".num");
    // keep the picked card in view inside the scroll, without moving the page
    const box = $("insights");
    const on = box.querySelector<HTMLElement>(".insight.on");
    if (on) {
      const top = on.offsetTop - box.offsetTop - 10;
      if (top < box.scrollTop || top + on.offsetHeight + 20 > box.scrollTop + box.clientHeight) box.scrollTop = top;
    }
    $("g1-style").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.style === g1Style)));
    $("timeline").hidden = asBeads;
    $("beads").hidden = !asBeads;
    $("beads-legend").hidden = !asBeads;
    const regions = REGION_ORDER.filter((g) => names.some((n) => REGION_OF[n] === g));
    $("beads-regions").hidden = !asBeads || regions.length < 2;
    if (asBeads) {
      $("timeline-sub").textContent = `How much of each ${ds.item}'s moves came from shocks elsewhere, over rolling ${dyn.window}-${ds.step} windows.`;
      $("beads-legend").innerHTML = `<span title="PyConnectedness: total"><i class="bk-index"></i>Spillover index: the average of all ${ds.items}</span>
        <span>Each string looks back ${dyn.window} ${ds.steps}: a jump is a shock arriving, a cliff ${dyn.window} ${ds.steps} later is it leaving</span>
        <span title="PyConnectedness: directional_from"><i class="bk-height"></i>Height: share of moves from shocks elsewhere</span>
${
          events ? `<span class="muted">▲ events</span>` : ""
        }<span class="muted" id="beads-floor"></span>`;
      $("beads-regions").innerHTML = [null, ...regions]
        .map((g, i) => `<button type="button" data-region="${g ?? ""}" aria-pressed="${g === beadRegion}">${
          g ? `<i style="background:var(--bead-${i})"></i>${g}` : "All regions"
        }</button>`)
        .join("");
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
      renderReadout(s);
      return;
    }
    $("timeline-sub").innerHTML = `${mName(m)}: the share of each ${ds.item}'s ups and downs caused by shocks at other
      ${ds.items}, each ${ds.step} measured over the ${dyn.window} ${ds.steps} before it.${
        other ? ` Grey: ${mName(other).toLowerCase()}, to compare.` : ""
      }${events ? " Dashed: notable events." : ""} <b>Hover to preview a ${ds.step}; click or drag to pick it.</b>`;
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
      ds.measures
    );
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
    const options = datasets
      .map((d) => `<option value="${d.id}"${d.id === ds.id ? " selected" : ""}>${d.title}</option>`)
      .join("");
    const sample = `${import.meta.env.BASE_URL}sample_currencies.csv`;
    const ownHint = `Dates in the first column, one column per series (2 to 25).
      <a href="${sample}" download>Sample file</a>`;
    $("top").innerHTML = `
      <div class="data-bar">
        <div class="segmented" id="src" role="group" aria-label="Data source">
          <button type="button" data-src="public" aria-pressed="${!own}">Public dataset</button>
          <button type="button" data-src="own" aria-pressed="${!!own}">Your own file</button>
        </div>
        <div class="data-row" id="src-public"${own ? " hidden" : ""}>
          <label class="select">
            <span class="sr">Dataset</span>
            <select id="ds-select">${own ? `<option value="" selected disabled>Choose a dataset</option>` : ""}${options}</select>
          </label>
          <p class="data-meta">${own ? "" : `${facts} · from the <a href="${ds.api_url}" target="_blank" rel="noopener">${ds.api}</a>`}</p>
        </div>
        <div class="data-row" id="src-own"${own ? "" : " hidden"}>
          <label class="file-btn">
            <input type="file" id="file" accept=".csv,text/csv" />
            <span>${own ? "Choose another CSV" : "Choose a CSV"}</span>
          </label>
          <div class="segmented small" id="kind" role="group" aria-label="What the numbers are"
            title="Levels (prices, index values, counts) are turned into % changes, as the demo does with prices. Changes are used as they are.">
            <button type="button" data-kind="levels" aria-pressed="${own?.rec.kind !== "changes"}">Levels</button>
            <button type="button" data-kind="changes" aria-pressed="${own?.rec.kind === "changes"}">Changes</button>
          </div>
          <p class="data-meta" id="own-status">${own ? `<b>${own.rec.name}</b> · ${facts}` : ownHint}</p>
        </div>
      </div>`;
    tightenDecimals($("top"), ".num");

    const show = (src: string) => {
      $("src").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.src === src)));
      $("src-public").hidden = src !== "public";
      $("src-own").hidden = src !== "own";
    };
    $("src").addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-src]");
      if (b) show(b.dataset.src!);
    });
    $<HTMLSelectElement>("ds-select").addEventListener("change", (ev) => {
      location.search = `?d=${(ev.target as HTMLSelectElement).value}`;
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
    $("kind").addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-kind]");
      if (!b || busy) return;
      kind = b.dataset.kind as typeof kind;
      $("kind").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
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
    const name = s.selected ?? s.hovered;
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
        <div><p class="q">Detail · ${ds.item} · ${REGION_OF[name]}</p><h2>${name}</h2><p class="sub">${frame.label}</p></div>
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
      </div>`;
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
  render(store.get());

  // controls
  $("measure").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    if (!b) return;
    setMeasure(b.dataset.measure as Measure);
  });
  $("palette").innerHTML =
    PALETTES.map((x) => `<option value="${x.id}">${x.painter} · ${x.painting.split(" (")[0]}, ${x.year}</option>`).join("") +
    `<option value="agam">Agam (the first look)</option>`;
  $<HTMLSelectElement>("palette").value = store.get().palette;
  $("palette").addEventListener("change", (ev) => {
    const id = (ev.target as HTMLSelectElement).value;
    try {
      localStorage.setItem("pc-palette", id);
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
  $("prev").addEventListener("click", () => step(-1));
  $("next").addEventListener("click", () => step(1));

  let timer = 0;
  $("play").addEventListener("click", () => {
    const s = store.get();
    if (s.playing) {
      clearInterval(timer);
      store.set({ playing: false });
      return;
    }
    store.set({ playing: true, window: "t", t: s.t >= last ? 0 : s.t });
    timer = window.setInterval(() => {
      const cur = store.get();
      if (!cur.playing) return clearInterval(timer);
      if (cur.t >= last) {
        clearInterval(timer);
        store.set({ playing: false });
        return;
      }
      store.set({ t: Math.min(last, cur.t + 2) });
    }, PLAY_MS);
  });

  window.addEventListener("keydown", (ev) => {
    if ((ev.target as HTMLElement).closest("input,select,textarea")) return;
    if (ev.key === "ArrowRight") step(ev.shiftKey ? 52 : 1);
    else if (ev.key === "ArrowLeft") step(ev.shiftKey ? -52 : -1);
    else if (ev.key === "Escape") store.set({ selected: null, pair: null });
  });
}

main().catch((err) => {
  console.error(err);
  app.innerHTML = `<div class="card"><h2>Couldn't load the data</h2><p>${String(err)}</p></div>`;
});
