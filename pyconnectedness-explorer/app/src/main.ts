import "./style.css";
import { type Dataset, type Measure, loadDatasets, loadExplorerData, pairSeriesAt, staticBlock } from "./data";
import { Model, type State, Store, type WindowKey, windowOptions } from "./model";
import { REGION_OF, REGION_ORDER, STEP, fmtDate, fmtSigned, fmtStep, parseDate, readPalette, setDatasetEncoding, tightenDecimals } from "./encoding";
import { NetworkChart } from "./charts/network";
import { TimelineChart, type PeriodBand } from "./charts/timeline";
import { BeadsChart, readBeadColors } from "./charts/beads";
import { RankingChart } from "./charts/ranking";
import { HeatmapChart } from "./charts/heatmap";
import { sparkline } from "./charts/sparkline";
import { bandCopy } from "./charts/frequency";
import { loadUpload, runUpload, saveUpload } from "./upload/upload";


const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="topbar">
  <div class="brand">
    <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 7 7 24h18z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="7" r="4.5" fill="var(--send)"/><circle cx="7" cy="24" r="4.5" fill="var(--recv)"/><circle cx="25" cy="24" r="4.5" fill="var(--recv)"/></svg>
    <span>PyConnectedness <b>Explorer</b></span>
  </div>
  <div class="topbar-right">
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
      <div class="player">
        <div class="segmented small" id="g1-style" role="group" aria-label="How the first graph is drawn">
          <button type="button" data-style="beads">Beads</button>
          <button type="button" data-style="line">Line</button>
        </div>
        <button class="icon-btn" id="prev" aria-label="Previous step">‹</button>
        <button class="play" id="play" aria-label="Play"></button>
        <button class="icon-btn" id="next" aria-label="Next step">›</button>
      </div>
    </div>
    <!-- the chart's own readout: what the picked (or hovered) week says -->
    <div class="readout" id="readout" aria-live="polite"></div>
    <div id="timeline" class="chart-host"></div>
    <div class="beads-regions" id="beads-regions" role="group" aria-label="Region shown"></div>
    <div id="beads" class="chart-host"></div>
    <p class="beads-legend" id="beads-legend"></p>
    <div class="windows" id="windows" role="group" aria-label="Window shown on every chart"></div>
  </section>

  <!-- graph 2: the network, with its own readout and its node values (net) beside it -->
  <section class="card span-12 graph2" id="g2">
    <div class="card-head">
      <div>
        <p class="q">2 · Who passes shocks to whom?</p>
        <h2>Connectedness network <code class="tag">connectedness_graph</code></h2>
        <p class="sub" id="network-sub"></p>
      </div>
    </div>
    <div class="readout" id="net-readout" aria-live="polite"></div>
    <div class="graph2-body">
      <div class="graph2-net">
        <div id="network" class="chart-host network-host"></div>
        <div class="legend">
          <span><i class="dot send"></i>Net transmitter</span>
          <span><i class="dot recv"></i>Net receiver</span>
          <span><i class="taper"></i>Arrow narrows toward the receiver; width = size of the flow</span>
          <span><i class="sizes"><b></b><b></b><b></b></i>Circle size = |net|</span>
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
        </div>
      </div>
      <div id="heatmap" class="chart-host"></div>
      <div class="legend">
        <span class="ramp"><i></i>Row receives ← 0 → row sends</span>
        <span><i class="outlined"></i>Outlined = drawn in the network</span>
      </div>
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

  const network = new NetworkChart($("network"), names, { onHover: hover, onSelect: select, onPair: pickPair });
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
  $("side-sub").textContent = `What each ${ds.item} gives minus what it takes, in pp: the network's circle sizes, as bars.`;

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
      b.textContent = o.key === "t" ? fmtStep(dyn.dates[s.t]) : o.label;
      b.setAttribute("aria-pressed", String(o.key === s.window));
      b.onclick = () => store.set({ window: o.key, playing: false });
      wins.appendChild(b);
    }

    // charts
    renderTimeline(s, p);

    $("network-sub").innerHTML = `${mName(m)}, ${frame.label.replace(/^Full/, "full")}: an arrow from each net
      transmitter to each net receiver, for the strongest 10% of pairs ("net pairwise connectedness").
      ${REGION_ORDER.length > 1 ? `${ds.items.charAt(0).toUpperCase() + ds.items.slice(1)} are grouped (${REGION_ORDER.join(" · ")}); ` : ""}Sizes use one scale across all ${ds.steps}.`;
    renderNetReadout(s, frame);
    network.render(frame, p, model.maxNet[m], model.maxPair[m], focus, s.selected, motion, s.pair);
    ranking.render(frame, p, model.maxNet[m], focus, s.selected, motion);
    $("heatmap-sub").innerHTML = `Net pairwise connectedness (<code>pairwise_net</code>) for every pair, ${frame.label.toLowerCase().startsWith("full") ? "over the " : "in the "}${frame.label.replace(/^Full/, "full")}: red, the row passes risk to the column; blue, the reverse. Click a cell to follow that pair over time.`;
    heatmap.render(frame, p, model.maxPair[m], focus, s.pair);
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
    $("g1-style").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.style === g1Style)));
    $("timeline").hidden = asBeads;
    $("beads").hidden = !asBeads;
    $("beads-legend").hidden = !asBeads;
    const regions = REGION_ORDER.filter((g) => names.some((n) => REGION_OF[n] === g));
    $("beads-regions").hidden = !asBeads || regions.length < 2;
    if (asBeads) {
      $("timeline-sub").textContent = `How much of each ${ds.item}'s moves came from shocks elsewhere, over rolling ${dyn.window}-${ds.step} windows.`;
      $("beads-legend").innerHTML = `<span title="PyConnectedness: total"><i class="bk-index"></i>Spillover index</span>
        <span title="PyConnectedness: directional_from"><i class="bk-height"></i>Height: share of moves from shocks elsewhere</span>
        <span title="PyConnectedness: directional_to"><i class="bk-to"></i>Width: how much it passes on</span>${
          events ? `<span class="muted">▲ events</span>` : ""
        }`;
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
        `${m}|${s.theme}`
      );
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
    const name = s.hovered ?? s.selected;
    const stat = (label: string, field: string, value: string, sub: string, cls = "") =>
      `<div class="ro-stat"><span class="ro-label">${label}${field ? ` <code>${field}</code>` : ""}</span>
        <span class="ro-value ${cls}">${value}</span><span class="ro-sub">${sub}</span></div>`;
    if (name) {
      const i = names.indexOf(name);
      const links = f.matrix[i].filter((v) => Math.abs(v) > f.threshold);
      const out = f.matrix[i].filter((v) => v > f.threshold).length;
      el.innerHTML = `
        <p class="ro-when">${s.hovered && s.hovered !== s.selected ? `<span class="ro-tag">Hover</span>` : ""}${name} <span class="ro-hint">· ${REGION_OF[name]} · ${f.label}</span></p>
        <div class="ro-stats">
          ${stat("Gives to others", "directional_to", `<span class="num">${f.to[i].toFixed(1)}</span>`, "pp of others' variance")}
          ${stat("Takes from others", "directional_from", `<span class="num">${f.from[i].toFixed(1)}</span>`, "pp of its own variance")}
          ${stat("Net position", "net", `<span class="num">${fmtSigned(f.net[i])}</span>`, f.net[i] >= 0 ? "a net transmitter" : "a net receiver", f.net[i] >= 0 ? "send" : "recv")}
          ${stat("Links drawn", "", `<span class="num">${links.length}</span>`, `${out} out, ${links.length - out} in`)}
        </div>`;
    } else {
      const connected = names.filter((_, i) => f.matrix[i].some((v) => Math.abs(v) > f.threshold)).length;
      el.innerHTML = `
        <p class="ro-when">${f.label} <span class="ro-hint">· hover a ${ds.item} for its TO, FROM and NET</span></p>
        <div class="ro-stats">
          ${stat("Links drawn", "", `<span class="num">${f.edgeCount}</span>`, `of ${(names.length * (names.length - 1)) / 2} pairs`)}
          ${stat("Cut-off", "pairwise_net", `<span class="num">${f.threshold.toFixed(2)}</span> pp`, "90th percentile of all cells")}
          ${stat("Markets with a link", "", `<span class="num">${connected}</span> of ${names.length}`, `${names.length - connected} have none this window`)}
        </div>`;
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

  /** "Short vs long term": the library's frequency_connectedness (export_cell.py), which exists per
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
        return `<span class="seg ${c.cls}" style="flex:${b.total}" title="${c.name}, ${c.phrase}: ${b.total.toFixed(1)} pp"><b class="num">${b.total.toFixed(1)}</b></span>`;
      })
      .join("");
    const words = fb.bands
      .map((b) => {
        const c = bandCopy(b.label);
        return `<span><i class="key ${c.cls}"></i>${c.name} <b class="num">${((b.total / sum) * 100).toFixed(0)}%</b> <em>${c.phrase}</em></span>`;
      })
      .join("");
    return `<div class="ro-speed">
      <p class="ro-speed-head" title="PyConnectedness: frequency_connectedness (Baruník–Křehlík). How long shocks take to play out, on a ${fb.horizon}-${ds.step} horizon, so the three add up to ${fb.static_total.toFixed(1)}% rather than exactly the index."><b>Short vs long term</b> <span class="ro-hint">· ${context}</span></p>
      <div class="speed-bar">${segs}</div>
      <div class="speed-words">${words}</div></div>`;
  }

  /** The graph's readout: the library's own measures for the picked week or period, or for the
   * hovered week as a preview. Field names in the labels are the library's. */
  function renderReadout(s: State) {
    const m = s.measure;
    const dyn = meta.dynamic[m];
    const preview = s.hoverT !== null && !(s.window === "t" && s.hoverT === s.t);
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
    const stat = (label: string, field: string, value: string, sub: string, cls = "") =>
      `<div class="ro-stat"><span class="ro-label" title="PyConnectedness: ${field}">${label}</span>
        <span class="ro-value ${cls}">${value}</span><span class="ro-sub">${sub}</span></div>`;
    const el = $("readout");
    el.classList.toggle("preview", preview);
    el.innerHTML = `
      <p class="ro-when">${when}</p>
      <div class="ro-stats">
        ${stat(
          "Spillover index",
          "total",
          `<span class="num">${f.total.toFixed(1)}%</span>`,
          f.key === "full" ? "the long-run level" : `<span class="num">${fmtSigned(diff)}</span> pp vs full sample`,
          f.key === "full" ? "" : diff >= 0 ? "up" : "down" // nothing to compare the full sample with
        )}
        ${stat("Top net transmitter", "net", top.n, `<span class="num">${fmtSigned(top.v)}</span> pp`, "send")}
        ${stat("Top net receiver", "net", bottom.n, `<span class="num">${fmtSigned(bottom.v)}</span> pp`, "recv")}
        ${stat("Strongest link", "pairwise_net", `${names[link.s]} → ${names[link.r]}`, `<span class="num">${link.v.toFixed(2)}</span> pp`)}
      </div>
      ${speedLine(s, preview)}`;
    tightenDecimals(el, ".num");
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
  $("theme").addEventListener("click", () => {
    const theme = store.get().theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("pc-theme", theme);
    } catch {
      /* ignore */
    }
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
