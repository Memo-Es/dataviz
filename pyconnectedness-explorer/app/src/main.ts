import "./style.css";
import { type Measure, loadExplorerData, pairSeriesAt, staticBlock } from "./data";
import { Model, type State, Store, type WindowKey, windowOptions } from "./model";
import { REGION_OF, fmtDate, fmtSigned, parseDate, readPalette, tightenDecimals } from "./encoding";
import { NetworkChart } from "./charts/network";
import { TimelineChart, type PeriodBand } from "./charts/timeline";
import { RankingChart } from "./charts/ranking";
import { HeatmapChart } from "./charts/heatmap";
import { sparkline } from "./charts/sparkline";
import { BAND_COPY } from "./charts/frequency";


const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="topbar">
  <div class="brand">
    <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 7 7 24h18z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="7" r="4.5" fill="var(--send)"/><circle cx="7" cy="24" r="4.5" fill="var(--recv)"/><circle cx="25" cy="24" r="4.5" fill="var(--recv)"/></svg>
    <span>PyConnectedness <b>Explorer</b></span>
  </div>
  <div class="topbar-right">
    <div class="segmented" id="measure" role="group" aria-label="Measure">
      <button data-measure="returns">Returns</button>
      <button data-measure="volatility">Volatility</button>
    </div>
    <button class="icon-btn" id="theme" type="button" aria-label="Toggle dark mode"></button>
  </div>
</header>

<main>
  <section class="hero">
    <p class="eyebrow">20 stock markets · weekly, 1997–2026 · from the PyConnectedness Demo notebook</p>
    <h1>How shocks travel between the world's stock markets</h1>
    <p class="lede">Spillover is the share of a market's weekly moves that is explained by shocks
      that started in <em>other</em> markets. The higher it is, the faster trouble in one place
      becomes trouble everywhere.</p>
    <ol class="questions" aria-label="Three questions, three graphs">
      <li><a href="#g1"><span class="qn">1</span>When did markets become fragile?<em>Rolling spillover index</em></a></li>
      <li><a href="#g2"><span class="qn">2</span>Who passes risk to whom?<em>Connectedness network</em></a></li>
      <li><a href="#g3"><span class="qn">3</span>How much does each pair pass on?<em>Spillover heatmap</em></a></li>
    </ol>
  </section>

  <section class="card span-12" id="g1">
    <div class="card-head">
      <div>
        <p class="q">1 · When did markets become fragile?</p>
        <h2>Rolling spillover index <code class="tag">dynamic_connectedness(…).total</code></h2>
        <p class="sub" id="timeline-sub"></p>
      </div>
      <div class="player">
        <button class="icon-btn" id="prev" aria-label="Previous week">‹</button>
        <button class="play" id="play" aria-label="Play"></button>
        <button class="icon-btn" id="next" aria-label="Next week">›</button>
      </div>
    </div>
    <!-- the chart's own readout: what the picked (or hovered) week says -->
    <div class="readout" id="readout" aria-live="polite"></div>
    <div id="timeline" class="chart-host"></div>
    <div class="windows" id="windows" role="group" aria-label="Window shown on every chart"></div>
  </section>

  <!-- graph 2: the network, with its own readout and its node values (net) beside it -->
  <section class="card span-12 graph2" id="g2">
    <div class="card-head">
      <div>
        <p class="q">2 · Who passes risk to whom?</p>
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
        <p class="side-title">Net connectedness by market <code>net</code></p>
        <p class="side-sub">What each market gives minus what it takes, in pp: the network's circle sizes, as bars.</p>
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
  const data = await loadExplorerData();
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

  const hover = (n: string | null) => store.set({ hovered: n });
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

  $("footer").innerHTML = `
    <p><b>Where the numbers come from.</b> Every value on this page was produced by running
    PyConnectedness's own <a href="https://github.com/zstoi/PyConnectedness/blob/main/examples/Demo.ipynb">examples/Demo.ipynb</a>
    unchanged (commit <code>4cc953f</code>) on Yahoo Finance data, with one extra cell at the end that only
    exports objects the notebook already made. The run is checked against every number the notebook prints.</p>
    <p>${meta.weeks} weeks, ${fmtDate(parseDate(meta.sample[0])!)} to ${fmtDate(parseDate(meta.sample[1])!)}.
    Generalized variance decomposition, VAR(${meta.dynamic.returns.lags}), ${meta.dynamic.returns.horizon}-week horizon,
    ${meta.dynamic.returns.window}-week rolling window. Each week's value describes the ${meta.dynamic.returns.window} weeks ending that week.</p>
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
    $("play").setAttribute("aria-label", s.playing ? "Pause" : "Play through the weeks");
    const wins = $("windows");
    wins.innerHTML = "";
    for (const o of windowOptions(data, m)) {
      const b = document.createElement("button");
      b.textContent = o.key === "t" ? `Week of ${fmtDate(parseDate(dyn.dates[s.t])!)}` : o.label;
      b.setAttribute("aria-pressed", String(o.key === s.window));
      b.onclick = () => store.set({ window: o.key, playing: false });
      wins.appendChild(b);
    }

    // charts
    renderTimeline(s, p);

    $("network-sub").innerHTML = `${m === "returns" ? "Returns" : "Volatility"}, ${frame.label.replace(/^Full/, "full")}: an arrow from
      each net transmitter to each net receiver, for the strongest 10% of pairs (the notebook's "net pairwise
      ${word} connectedness"). Markets are grouped by region; sizes use one scale across all weeks.`;
    renderNetReadout(s, frame);
    network.render(frame, p, model.maxNet[m], model.maxPair[m], focus, s.selected, motion, s.pair);
    ranking.render(frame, p, model.maxNet[m], focus, s.selected, motion);
    $("heatmap-sub").innerHTML = `Net pairwise connectedness (<code>pairwise_net</code>) for every pair, ${frame.label.toLowerCase().startsWith("full") ? "over the " : "in the "}${frame.label.replace(/^Full/, "full")}: red, the row passes risk to the column; blue, the reverse. Click a cell to follow that pair over time.`;
    heatmap.render(frame, p, model.maxPair[m], focus, s.pair);
    renderDetail(s, frame, p);
    tightenDecimals(document, ".num");
  };

  /** The first graph: the notebook's rolling spillover index (cell 14), named as there, with its
   * readout. Also the only thing a timeline hover re-renders. */
  function renderTimeline(s: State, p: ReturnType<typeof readPalette>) {
    const m = s.measure;
    const word = m === "returns" ? "return" : "volatility";
    const other: Measure = m === "returns" ? "volatility" : "returns";
    const periods: PeriodBand[] = (["p1", "p2", "p3", "p4"] as const).map((k) => {
      const b = staticBlock(data, m, k);
      return {
        key: k,
        start: new Date(Date.UTC(+b.start, 0, 1)),
        end: new Date(Date.UTC(+b.end, 11, 31)),
        label: `${b.start}–${b.end}`,
        total: b.total,
      };
    });
    const dyn = meta.dynamic[m];
    $("timeline-sub").innerHTML = `${m === "returns" ? "Returns" : "Volatility"}: the share of each market's moves
      caused by shocks elsewhere, each week measured over the ${dyn.window} weeks before it. Grey: ${other === "returns" ? "returns" : "volatility"}, to compare. Dashed:
      the notebook's crisis dates. <b>Hover to preview a week; click or drag to pick it.</b>`;
    timeline.render(
      dyn,
      staticBlock(data, m, "full"),
      meta.episodes,
      periods,
      s.window === "t" ? s.t : null,
      s.window.startsWith("p") ? s.window : null,
      p,
      { measure: other, dyn: meta.dynamic[other] },
      m,
      s.hoverT
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
        <p class="ro-when">${f.label} <span class="ro-hint">· hover a market for its TO, FROM and NET</span></p>
        <div class="ro-stats">
          ${stat("Links drawn", "", `<span class="num">${f.edgeCount}</span>`, `of ${(names.length * (names.length - 1)) / 2} pairs`)}
          ${stat("Cut-off", "pairwise_net", `<span class="num">${f.threshold.toFixed(2)}</span> pp`, "90th percentile of all cells")}
          ${stat("Markets with a link", "", `<span class="num">${connected}</span> of ${names.length}`, `${names.length - connected} have none this window`)}
        </div>`;
    }
    el.classList.toggle("preview", !!s.hovered && s.hovered !== s.selected);
    tightenDecimals(el, ".num");
  }

  /** "Short vs long term": the library's frequency_connectedness (export_cell.py), which exists per
   * period, not per week. Always drawn with the same structure, so the readout never changes
   * height (it sits above the chart, so a height change moves the chart under the pointer). */
  function speedLine(s: State, preview: boolean) {
    const m = s.measure;
    const blocks = meta.frequency[m] as Record<string, (typeof meta.frequency.returns)["full"]>;
    const week = preview ? s.hoverT! : s.t;
    const yr = +meta.dynamic[m].dates[week].slice(0, 4);
    const periodOfWeek = yr <= 2006 ? "p1" : yr <= 2012 ? "p2" : yr <= 2019 ? "p3" : "p4";
    const fromChip = !preview && s.window !== "t" && blocks[s.window];
    const key = fromChip ? s.window : periodOfWeek;
    const fb = blocks[key];
    const option = windowOptions(data, m).find((o) => o.key === key)!;
    const context = fromChip ? option.label : `${option.label}, the period this week falls in`;
    const sum = fb.bands.reduce((a, b) => a + b.total, 0);
    const segs = fb.bands
      .map((b) => {
        const c = BAND_COPY[b.label];
        return `<span class="seg ${c.cls}" style="flex:${b.total}" title="${c.name}, ${c.phrase}: ${b.total.toFixed(1)} pp"><b class="num">${b.total.toFixed(1)}</b></span>`;
      })
      .join("");
    const words = fb.bands
      .map((b) => {
        const c = BAND_COPY[b.label];
        return `<span><i class="key ${c.cls}"></i>${c.name} <b class="num">${((b.total / sum) * 100).toFixed(0)}%</b> <em>${c.phrase}</em></span>`;
      })
      .join("");
    return `<div class="ro-speed">
      <p class="ro-speed-head"><b>Short vs long term</b> <code>frequency_connectedness</code> <span class="ro-hint">· ${context}</span></p>
      <div class="speed-bar">${segs}</div>
      <div class="speed-words">${words}</div>
      <span class="ro-note">How long shocks take to play out (Baruník–Křehlík), on a ${fb.horizon}-week horizon, so the
        three add up to <span class="num">${fb.static_total.toFixed(1)}%</span> rather than exactly the index.</span></div>`;
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
    const week = (i: number) => fmtDate(parseDate(dyn.dates[i])!);
    const when = preview
      ? `<span class="ro-tag">Preview</span> Week of ${week(s.hoverT!)} <span class="ro-hint">· click to pick it</span>`
      : s.window === "t"
        ? `Week of ${week(s.t)} <span class="ro-hint">· the ${dyn.window} weeks up to it</span>`
        : f.label;
    const stat = (label: string, field: string, value: string, sub: string, cls = "") =>
      `<div class="ro-stat"><span class="ro-label">${label} <code>${field}</code></span>
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
      <p class="k spark-k">Net flow between them, every week (scale fits this pair)</p>
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
      el.innerHTML = `<div class="card-head"><div><p class="q">Detail · graphs 2 and 3</p><h2>Pick a market or a pair</h2><p class="sub">Click a market (a circle, a bar or a heatmap label) to see where its risk goes and comes from, or a pair (an arrow or a heatmap cell) to follow it over time.</p></div></div>
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
        <div><p class="q">Detail · market · ${REGION_OF[name]}</p><h2>${name}</h2><p class="sub">${frame.label}</p></div>
        ${s.selected ? `<button class="icon-btn" id="clear" aria-label="Clear selection">✕</button>` : ""}
      </div>
      <div class="trio">
        <div><span class="k">Gives to others</span><span class="v num">${frame.to[i].toFixed(1)}</span></div>
        <div><span class="k">Takes from others</span><span class="v num">${frame.from[i].toFixed(1)}</span></div>
        <div><span class="k">Net</span><span class="v num ${net >= 0 ? "send" : "recv"}">${fmtSigned(net)}</span></div>
      </div>
      <p class="k spark-k">Net spillover, every week</p>
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
