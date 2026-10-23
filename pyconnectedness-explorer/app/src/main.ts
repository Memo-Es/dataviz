import "./style.css";
import { type Measure, loadExplorerData, staticBlock } from "./data";
import { Model, type State, Store, type WindowKey, windowOptions } from "./model";
import { REGION_OF, fmtDate, fmtSigned, parseDate, readPalette } from "./encoding";
import { NetworkChart } from "./charts/network";
import { TimelineChart, type PeriodBand } from "./charts/timeline";
import { RankingChart } from "./charts/ranking";
import { HeatmapChart } from "./charts/heatmap";
import { sparkline } from "./charts/sparkline";

const FIGURES = [
  { file: "01_rolling_spillover_index.png", cell: 14, title: "Rolling spillover index" },
  { file: "02_net_small_multiples.png", cell: 17, title: "Net spillover by market" },
  { file: "03_net_pairwise_heatmaps.png", cell: 18, title: "Pairwise heatmaps" },
  { file: "04_connectedness_network.png", cell: 19, title: "Network, strongest 10%" },
  { file: "05_last_200_weeks.png", cell: 21, title: "Last 200 weeks" },
  { file: "periods_heatmaps.png", cell: 28, title: "Four periods" },
];

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
    <h1 id="headline"></h1>
    <p class="lede">Spillover is the share of a market's weekly moves that is explained by shocks
      that started in <em>other</em> markets. The higher it is, the faster trouble in one place
      becomes trouble everywhere.</p>
    <div class="kpis" id="kpis"></div>
  </section>

  <section class="card span-12">
    <div class="card-head">
      <div>
        <h2>When markets became fragile</h2>
        <p class="sub" id="timeline-sub"></p>
      </div>
      <div class="player">
        <button class="icon-btn" id="prev" aria-label="Previous week">‹</button>
        <button class="play" id="play" aria-label="Play"></button>
        <button class="icon-btn" id="next" aria-label="Next week">›</button>
      </div>
    </div>
    <div id="timeline" class="chart-host"></div>
    <div class="windows" id="windows" role="group" aria-label="Window shown on every chart"></div>
  </section>

  <div class="grid">
    <section class="card span-7">
      <div class="card-head">
        <div>
          <h2>Who sends risk to whom</h2>
          <p class="sub" id="network-sub"></p>
        </div>
      </div>
      <div id="network" class="chart-host network-host"></div>
      <div class="legend">
        <span><i class="dot send"></i>Net sender</span>
        <span><i class="dot recv"></i>Net receiver</span>
        <span><i class="taper"></i>Arrow narrows toward the receiver; width = size of the flow</span>
        <span><i class="sizes"><b></b><b></b><b></b></i>Circle size = net spillover</span>
      </div>
    </section>

    <section class="card span-5">
      <div class="card-head">
        <div>
          <h2>Net senders and receivers</h2>
          <p class="sub">Shocks given minus shocks received, in percentage points</p>
        </div>
      </div>
      <div id="ranking" class="chart-host"></div>
    </section>

    <section class="card span-7">
      <div class="card-head">
        <div>
          <h2>Every pair, both ways</h2>
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

  <section class="card span-12">
    <div class="card-head">
      <div>
        <h2>The notebook's own figures</h2>
        <p class="sub">Exactly as <code>examples/Demo.ipynb</code> drew them with matplotlib on this run, for comparison.</p>
      </div>
    </div>
    <div class="tabs" id="fig-tabs" role="tablist"></div>
    <figure class="nb-figure"><img id="fig-img" alt="" /><figcaption id="fig-cap"></figcaption></figure>
  </section>
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
    hovered: null,
    playing: false,
    theme,
  });

  const hover = (n: string | null) => store.set({ hovered: n });
  const select = (n: string | null) => store.set({ selected: n === store.get().selected ? null : n });

  const network = new NetworkChart($("network"), names, { onHover: hover, onSelect: select });
  const ranking = new RankingChart($("ranking"), names, hover, (n) => select(n));
  const heatmap = new HeatmapChart($("heatmap"), names, hover, (n) => select(n));
  const timeline = new TimelineChart(
    $("timeline"),
    (t) => store.set({ t, window: "t" }),
    (key) => store.set({ window: store.get().window === key ? "t" : (key as WindowKey) })
  );

  // notebook figures
  const figTabs = $("fig-tabs");
  let fig = 3;
  const showFig = () => {
    figTabs.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-selected", String(i === fig)));
    const f = FIGURES[fig];
    const img = $<HTMLImageElement>("fig-img");
    img.src = `${import.meta.env.BASE_URL}data/figures/${f.file}`;
    img.alt = `Notebook cell ${f.cell}: ${f.title}`;
    $("fig-cap").textContent = `Cell ${f.cell} of Demo.ipynb, unmodified plotting code.`;
  };
  FIGURES.forEach((f, i) => {
    const b = document.createElement("button");
    b.role = "tab";
    b.textContent = f.title;
    b.onclick = () => {
      fig = i;
      showFig();
    };
    figTabs.appendChild(b);
  });
  showFig();

  $("footer").innerHTML = `
    <p><b>Where the numbers come from.</b> Every value on this page was produced by running
    PyConnectedness's own <a href="https://github.com/zstoi/PyConnectedness/blob/main/examples/Demo.ipynb">examples/Demo.ipynb</a>
    unchanged (commit <code>4cc953f</code>) on Yahoo Finance data, with one extra cell at the end that only
    exports objects the notebook already made. The run is checked against every number the notebook prints.</p>
    <p>${meta.weeks} weeks, ${fmtDate(parseDate(meta.sample[0])!)} to ${fmtDate(parseDate(meta.sample[1])!)}.
    Generalized variance decomposition, VAR(${meta.dynamic.returns.lags}), ${meta.dynamic.returns.horizon}-week horizon,
    ${meta.dynamic.returns.window}-week rolling window. Each week's value describes the ${meta.dynamic.returns.window} weeks ending that week.</p>
    <p class="muted">A design prototype for the coaching, not the stage 2 browser interface.</p>`;

  const render = (s: State) => {
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

    // headline + KPIs
    const order = names.map((n, i) => ({ n, v: frame.net[i] })).sort((a, b) => b.v - a.v);
    const top = order[0];
    const bottom = order[order.length - 1];
    let link = { s: 0, r: 0, v: -Infinity };
    frame.matrix.forEach((row, i) => row.forEach((v, j) => v > link.v && (link = { s: i, r: j, v })));
    const diff = frame.total - full.total;
    const when = s.window === "t" ? `In the 200 weeks to ${fmtDate(parseDate(dyn.dates[s.t])!)}` : `Over ${frame.short.toLowerCase() === "full sample" ? "the full sample" : frame.short}`;
    $("headline").innerHTML = `${when}, <span class="hl">${frame.total.toFixed(1)}%</span> of ${word} moves came from shocks in other markets. <span class="hl-send">${top.n}</span> sent the most.`;
    $("kpis").innerHTML = `
      <div class="kpi"><span class="k">Total ${word} spillover</span><span class="v">${frame.total.toFixed(1)}<small>%</small></span>
        <span class="d ${diff >= 0 ? "up" : "down"}">${s.window === "full" ? "the long-run level" : `${fmtSigned(diff)} pp vs full sample`}</span></div>
      <div class="kpi"><span class="k">Biggest sender</span><span class="v send">${top.n}</span><span class="d">net ${fmtSigned(top.v)} pp</span></div>
      <div class="kpi"><span class="k">Biggest receiver</span><span class="v recv">${bottom.n}</span><span class="d">net ${fmtSigned(bottom.v)} pp</span></div>
      <div class="kpi"><span class="k">Strongest single link</span><span class="v small">${names[link.s]} → ${names[link.r]}</span><span class="d">${link.v.toFixed(2)} pp</span></div>`;

    // charts
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
    $("timeline-sub").textContent = `Total ${word} spillover, each week measured over the 200 weeks before it. Dashed lines mark the notebook's six crisis dates. Click or drag to pick a week; click a period below to compare.`;
    timeline.render(dyn, full, meta.episodes, periods, s.window === "t" ? s.t : null, s.window.startsWith("p") ? s.window : null, p);

    $("network-sub").textContent = `${frame.label} · ${frame.edgeCount} strongest links (top 10%, above ${frame.threshold.toFixed(2)} pp)`;
    network.render(frame, p, model.maxNet[m], model.maxPair[m], focus, s.selected);
    ranking.render(frame, p, model.maxNet[m], focus, s.selected);
    $("heatmap-sub").textContent = `${frame.label} · row → column, in percentage points. Hover a cell for the value.`;
    heatmap.render(frame, p, model.maxPair[m], focus);
    renderDetail(s, frame, p);
  };

  function renderDetail(s: State, frame: ReturnType<Model["frame"]>, p: ReturnType<typeof readPalette>) {
    const el = $("detail");
    const name = s.selected ?? s.hovered;
    if (!name) {
      el.innerHTML = `<div class="card-head"><div><h2>Pick a market</h2><p class="sub">Click any circle, bar or matrix label to see where its risk goes and comes from.</p></div></div>
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
        ? rows.map((r) => `<li><span>${r.n}</span><b class="${cls}">${r.v.toFixed(2)}</b></li>`).join("")
        : `<li class="muted">none</li>`;
    const net = frame.net[i];
    el.innerHTML = `
      <div class="card-head">
        <div><p class="eyebrow">${REGION_OF[name]}</p><h2>${name}</h2><p class="sub">${frame.label}</p></div>
        ${s.selected ? `<button class="icon-btn" id="clear" aria-label="Clear selection">✕</button>` : ""}
      </div>
      <div class="trio">
        <div><span class="k">Gives to others</span><span class="v">${frame.to[i].toFixed(1)}</span></div>
        <div><span class="k">Takes from others</span><span class="v">${frame.from[i].toFixed(1)}</span></div>
        <div><span class="k">Net</span><span class="v ${net >= 0 ? "send" : "recv"}">${fmtSigned(net)}</span></div>
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
  store.subscribe((s) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => render(s));
  });
  render(store.get());

  // controls
  $("measure").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    if (!b) return;
    const measure = b.dataset.measure as Measure;
    const w = store.get().window;
    store.set({ measure, window: measure === "volatility" && w === "last200" ? "full" : w });
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
    }, 45);
  });

  window.addEventListener("keydown", (ev) => {
    if ((ev.target as HTMLElement).closest("input,select,textarea")) return;
    if (ev.key === "ArrowRight") step(ev.shiftKey ? 52 : 1);
    else if (ev.key === "ArrowLeft") step(ev.shiftKey ? -52 : -1);
    else if (ev.key === "Escape") store.set({ selected: null });
  });
}

main().catch((err) => {
  console.error(err);
  app.innerHTML = `<div class="card"><h2>Couldn't load the data</h2><p>${String(err)}</p></div>`;
});
