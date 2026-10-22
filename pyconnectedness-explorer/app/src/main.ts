import "./style.css";
import {
  loadExplorerData,
  matrixAt,
  netAt,
  staticBlock,
  globalMaxAbsNet,
  globalMaxAbsPairwise,
  type ExplorerData,
  type Measure,
  type StaticWindow,
} from "./data";
import { Store, prefersDark, type ExplorerState } from "./state";
import { REGION_OF, REGION_ORDER, REDESIGN_LIGHT, REDESIGN_DARK, type RedesignTokens } from "./encoding";
import { NetworkChart } from "./charts/network";
import { TimelineChart } from "./charts/timeline";
import { HeatmapChart } from "./charts/heatmap";
import { RankingList } from "./charts/ranking";
import { renderDetail } from "./charts/detail";

const PERIODS_RETURNS: { key: StaticWindow; start: string; end: string; label: string }[] = [
  { key: "p1", start: "1997-01-01", end: "2006-12-31", label: "1997–2006" },
  { key: "p2", start: "2007-01-01", end: "2012-12-31", label: "2007–2012" },
  { key: "p3", start: "2013-01-01", end: "2019-12-31", label: "2013–2019" },
  { key: "p4", start: "2020-01-01", end: "2026-12-31", label: "2020–2026" },
];

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div class="topbar">
    <div>
      <h1>PyConnectedness Explorer</h1>
      <p class="subtitle">How shocks travel between 20 stock markets &mdash; from PyConnectedness's own Demo notebook output.</p>
    </div>
    <div class="controls">
      <div class="pill-group" id="style-group">
        <button data-style="redesign" aria-pressed="true">Redesign</button>
        <button data-style="baseline" aria-pressed="false">Faithful baseline</button>
      </div>
      <div class="pill-group" id="measure-group">
        <button data-measure="returns" aria-pressed="true">Returns</button>
        <button data-measure="volatility" aria-pressed="false">Volatility</button>
      </div>
      <button class="theme-toggle" id="theme-toggle" type="button">Theme</button>
    </div>
  </div>

  <div class="banner prototype">
    <strong>Design prototype for the coaching</strong> &mdash; not the stage 2 browser interface. See CONTEXT.md.
  </div>
  <div class="banner" id="synthetic-banner" style="display:none"></div>
  <p class="legend-note" id="style-note"></p>

  <div class="panel">
    <h2>Total connectedness over time</h2>
    <div class="controls" style="margin-bottom:10px">
      <button class="icon-btn" id="step-back" title="Back 1 week">&#8592;</button>
      <button class="icon-btn" id="play" title="Play">&#9654;</button>
      <button class="icon-btn" id="step-fwd" title="Forward 1 week">&#8594;</button>
      <span class="legend-note" id="week-label"></span>
    </div>
    <div class="chart-card" id="timeline-returns"></div>
    <div class="chart-card" id="timeline-volatility" style="margin-top:8px"></div>
  </div>

  <div class="row">
    <div class="panel" style="flex:2 1 480px">
      <h2>Network &mdash; who sends to whom</h2>
      <div class="chart-card" id="network"></div>
      <p class="legend-note" id="network-note"></p>
    </div>
    <div class="panel" style="flex:1 1 280px">
      <h2>Ranking, net spillover</h2>
      <div id="ranking"></div>
    </div>
  </div>

  <div class="panel">
    <h2>Pair matrix &mdash; every pair</h2>
    <div class="controls" style="margin-bottom:10px">
      <select id="matrix-window"></select>
      <select id="matrix-sort">
        <option value="notebook">Notebook order</option>
        <option value="region">By region</option>
        <option value="net">By net sending</option>
      </select>
    </div>
    <div class="chart-card" id="heatmap"></div>
  </div>

  <div class="panel">
    <h2>Detail</h2>
    <div id="detail"></div>
  </div>

  <div class="footnote" id="footnote"></div>
`;

const el = {
  styleGroup: app.querySelector<HTMLDivElement>("#style-group")!,
  styleNote: app.querySelector<HTMLParagraphElement>("#style-note")!,
  measureGroup: app.querySelector<HTMLDivElement>("#measure-group")!,
  themeToggle: app.querySelector<HTMLButtonElement>("#theme-toggle")!,
  syntheticBanner: app.querySelector<HTMLDivElement>("#synthetic-banner")!,
  stepBack: app.querySelector<HTMLButtonElement>("#step-back")!,
  play: app.querySelector<HTMLButtonElement>("#play")!,
  stepFwd: app.querySelector<HTMLButtonElement>("#step-fwd")!,
  weekLabel: app.querySelector<HTMLSpanElement>("#week-label")!,
  timelineReturnsHost: app.querySelector<HTMLDivElement>("#timeline-returns")!,
  timelineVolHost: app.querySelector<HTMLDivElement>("#timeline-volatility")!,
  networkHost: app.querySelector<HTMLDivElement>("#network")!,
  networkNote: app.querySelector<HTMLParagraphElement>("#network-note")!,
  rankingHost: app.querySelector<HTMLDivElement>("#ranking")!,
  matrixWindow: app.querySelector<HTMLSelectElement>("#matrix-window")!,
  matrixSort: app.querySelector<HTMLSelectElement>("#matrix-sort")!,
  heatmapHost: app.querySelector<HTMLDivElement>("#heatmap")!,
  detailHost: app.querySelector<HTMLDivElement>("#detail")!,
  footnote: app.querySelector<HTMLDivElement>("#footnote")!,
};

async function main() {
  const data = await loadExplorerData();

  if (data.meta.synthetic) {
    el.syntheticBanner.style.display = "";
    el.syntheticBanner.innerHTML = `<strong>Data is synthetic, not real.</strong> ${data.meta.synthetic_note ?? "This sandbox had no network access to Yahoo Finance; every statistic is computed by the real pyconnectedness library, but on synthetic input prices. See README.md."}`;
  }

  const dynReturns = data.meta.dynamic.returns;
  const lastIndex = dynReturns.dates.length - 1;

  const store = new Store({
    t: lastIndex,
    measure: "returns",
    matrixWindow: "t",
    matrixSort: "notebook",
    edgePercentile: 90,
    selection: { market: null, pair: null },
    playing: false,
    theme: prefersDark() ? "dark" : "light",
    chartStyle: "redesign",
  });

  function tokens(): RedesignTokens {
    return store.get().theme === "dark" ? REDESIGN_DARK : REDESIGN_LIGHT;
  }

  applyTheme(store.get().theme);

  el.matrixWindow.innerHTML = [
    `<option value="t">Selected week (rolling)</option>`,
    `<option value="full">Full sample</option>`,
    `<option value="last200">Last 200 weeks</option>`,
    ...PERIODS_RETURNS.map((p) => `<option value="${p.key}">${p.label}</option>`),
  ].join("");

  const timelineReturns = new TimelineChart(el.timelineReturnsHost);
  const timelineVol = new TimelineChart(el.timelineVolHost);
  const network = new NetworkChart(el.networkHost);
  const heatmap = new HeatmapChart(el.heatmapHost);
  const ranking = new RankingList(el.rankingHost);

  const globalMaxNetReturns = globalMaxAbsNet(data, "returns");
  const globalMaxNetVol = globalMaxAbsNet(data, "volatility");
  const globalMaxPairReturns = globalMaxAbsPairwise(data, "returns");
  const globalMaxPairVol = globalMaxAbsPairwise(data, "volatility");

  function sortedNames(measure: Measure, t: number, sort: ExplorerState["matrixSort"]): string[] {
    const names = data.meta.names.slice();
    if (sort === "notebook") return names;
    if (sort === "region") {
      return names.slice().sort((a, b) => {
        const ra = REGION_ORDER.indexOf(REGION_OF[a]);
        const rb = REGION_ORDER.indexOf(REGION_OF[b]);
        if (ra !== rb) return ra - rb;
        return a.localeCompare(b);
      });
    }
    // by net sending, descending
    const net = netAt(data, measure, t);
    return names
      .map((n, i) => ({ n, v: net[i] }))
      .sort((a, b) => b.v - a.v)
      .map((x) => x.n);
  }

  function render() {
    const s = store.get();
    const { t, measure } = s;
    const dyn = data.meta.dynamic[measure];
    const date = dyn.dates[t];
    const isRedesign = s.chartStyle === "redesign";
    const tok = tokens();

    el.weekLabel.textContent = `Week of ${date} (${t + 1} / ${dyn.dates.length})`;
    el.play.textContent = s.playing ? "⏸" : "▶";
    el.play.title = s.playing ? "Pause" : "Play";

    // style pills
    el.styleGroup.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-style") === s.chartStyle));
    });
    el.styleNote.textContent = isRedesign
      ? "Redesign: a validated colour system (CVD-checked), region-grouped network, crisis markers and hover detail -- see CONTEXT.md's decision log and the matplotlib style guide in pipeline/styleguide/."
      : "Faithful baseline: a pixel match of the library's own matplotlib defaults, deliberately unstyled (see CONTEXT.md's style analysis).";

    // measure pills
    el.measureGroup.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-measure") === measure));
    });

    const net = netAt(data, measure, t);
    const pairwise = matrixAt(data, measure, t);
    const full = staticBlock(data, measure, "full");

    // timeline: both measures always shown (matches the notebook's own cell 14), selected
    // measure's axes gets a slightly stronger card outline to show which one drives the rest
    const periods = PERIODS_RETURNS.map((p) => ({ start: p.start, end: p.end, label: p.label }));
    timelineReturns.render({
      dates: dynReturns.dates,
      total: dynReturns.total,
      fullSampleTotal: data.meta.static.returns.full.total,
      title: isRedesign ? "When markets became fragile" : "Rolling return spillover index (200-week window, VAR(2), H=10)",
      ylabel: isRedesign ? "Total return spillover, 200-week window, VAR(2), H=10" : "Total spillover, %",
      episodes: data.meta.episodes,
      periods,
      selectedIndex: measure === "returns" ? t : dateIndexFor("returns", date),
      showXAxis: false,
      style: s.chartStyle,
      tokens: tok,
      measureLabel: "return",
      onScrub: (idx) => store.set({ t: reindexFor("returns", idx, measure) }),
    });
    const dynVol = data.meta.dynamic.volatility;
    timelineVol.render({
      dates: dynVol.dates,
      total: dynVol.total,
      fullSampleTotal: data.meta.static.volatility.full.total,
      title: isRedesign ? "Same story, volatility spillover" : "Rolling volatility spillover index",
      ylabel: isRedesign ? "Total volatility spillover" : "Total spillover, %",
      episodes: data.meta.episodes,
      periods,
      selectedIndex: measure === "volatility" ? t : dateIndexFor("volatility", date),
      showXAxis: true,
      style: s.chartStyle,
      tokens: tok,
      measureLabel: "volatility",
      onScrub: (idx) => store.set({ t: reindexFor("volatility", idx, measure) }),
    });
    // which measure is "driving" the rest of the view -- a thin accent rule under the card
    // instead of a full-perimeter coloured box, which reads as an alert/error state at this size
    el.timelineReturnsHost.style.boxShadow = measure === "returns" ? "inset 0 -3px 0 var(--send)" : "none";
    el.timelineVolHost.style.boxShadow = measure === "volatility" ? "inset 0 -3px 0 var(--send)" : "none";

    network.render({
      names: data.meta.names,
      pairwiseNet: pairwise,
      net,
      threshold: full.threshold_p90,
      globalMaxAbsNet: measure === "returns" ? globalMaxNetReturns : globalMaxNetVol,
      globalMaxAbsPairwise: measure === "returns" ? globalMaxPairReturns : globalMaxPairVol,
      title: isRedesign ? "Who sends risk to whom" : `Net pairwise ${measure} connectedness, strongest 10% of links`,
      weekLabel: isRedesign ? `Week of ${date} · strongest 10% of links` : undefined,
      style: s.chartStyle,
      tokens: tok,
      onSelectMarket: (name) => store.set({ selection: { market: name, pair: null } }),
      onSelectPair: (pair) => store.set({ selection: { market: null, pair } }),
      selectedMarket: s.selection.market,
      selectedPair: s.selection.pair,
    });
    el.networkNote.textContent = isRedesign
      ? "Grouped by region so position means something; size and colour use a fixed scale across every week, so the animation is comparable frame to frame."
      : `Threshold: ${full.threshold_p90.toFixed(2)}% (90th percentile of |net pairwise|, this week's static full-sample rule). Node colour follows net at the selected week; size and edge width use a fixed scale across every week so the animation is comparable frame to frame.`;

    ranking.render({
      names: data.meta.names,
      net,
      style: s.chartStyle,
      tokens: tok,
      selectedMarket: s.selection.market,
      onSelect: (name) => store.set({ selection: { market: name, pair: null } }),
    });

    // heatmap
    let hmMatrix: number[][];
    let hmTitle: string;
    if (s.matrixWindow === "t") {
      hmMatrix = pairwise;
      hmTitle = `Net pairwise ${measure} connectedness, week of ${date} (%)`;
    } else {
      const block = staticBlock(data, measure, s.matrixWindow);
      hmMatrix = block.pairwise_net;
      hmTitle = `Net pairwise ${measure} connectedness, ${block.label} (%)`;
    }
    const order = sortedNames(measure, t, s.matrixSort);
    const orderIdx = order.map((n) => data.meta.names.indexOf(n));
    const reordered = orderIdx.map((i) => orderIdx.map((j) => hmMatrix[i][j]));
    heatmap.render({
      names: order,
      matrix: reordered,
      title: hmTitle,
      style: s.chartStyle,
      tokens: tok,
      selectedPair: s.selection.pair,
      onSelectCell: (row, col) => store.set({ selection: { market: null, pair: [row, col] } }),
    });

    renderDetail(el.detailHost, {
      data,
      measure,
      t,
      market: s.selection.market,
      pair: s.selection.pair,
      style: s.chartStyle,
      tokens: tok,
    });

    el.footnote.innerHTML = footnoteHtml(data);
  }

  function dateIndexFor(m: Measure, isoDate: string): number {
    const dates = data.meta.dynamic[m].dates;
    let idx = dates.findIndex((d) => d >= isoDate);
    if (idx === -1) idx = dates.length - 1;
    return idx;
  }
  function reindexFor(scrubbedMeasure: Measure, idx: number, activeMeasure: Measure): number {
    if (scrubbedMeasure === activeMeasure) return idx;
    const date = data.meta.dynamic[scrubbedMeasure].dates[idx];
    return dateIndexFor(activeMeasure, date);
  }

  store.subscribe(render);
  render();

  // --- interactions ---
  el.styleGroup.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    store.set({ chartStyle: btn.getAttribute("data-style") as ExplorerState["chartStyle"] });
  });

  el.measureGroup.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const measure = btn.getAttribute("data-measure") as Measure;
    const date = data.meta.dynamic[store.get().measure].dates[store.get().t];
    store.set({ measure, t: dateIndexFor(measure, date) });
  });

  el.themeToggle.addEventListener("click", () => {
    const next = store.get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    store.set({ theme: next });
  });

  el.stepBack.addEventListener("click", () => step(-1));
  el.stepFwd.addEventListener("click", () => step(1));
  function step(n: number) {
    const s = store.get();
    const dates = data.meta.dynamic[s.measure].dates;
    const t = Math.max(0, Math.min(dates.length - 1, s.t + n));
    store.set({ t });
  }

  let playTimer: number | null = null;
  el.play.addEventListener("click", () => {
    const s = store.get();
    const playing = !s.playing;
    store.set({ playing });
    if (playing) {
      playTimer = window.setInterval(() => {
        const cur = store.get();
        const dates = data.meta.dynamic[cur.measure].dates;
        if (cur.t >= dates.length - 1) {
          store.set({ playing: false, t: 0 });
          if (playTimer) clearInterval(playTimer);
          return;
        }
        store.set({ t: cur.t + 1 });
      }, 60);
    } else if (playTimer) {
      clearInterval(playTimer);
    }
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.target instanceof HTMLSelectElement) return;
    if (ev.key === "ArrowRight") step(ev.shiftKey ? 52 : 1);
    if (ev.key === "ArrowLeft") step(ev.shiftKey ? -52 : -1);
  });

  el.matrixWindow.addEventListener("change", () => {
    store.set({ matrixWindow: el.matrixWindow.value as StaticWindow });
  });
  el.matrixSort.addEventListener("change", () => {
    store.set({ matrixSort: el.matrixSort.value as ExplorerState["matrixSort"] });
  });
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
}

function footnoteHtml(data: ExplorerData): string {
  const commit = "4cc953f";
  const base = `Data: weekly closes, highs and lows of 20 stock indices from Yahoo Finance. Computed with PyConnectedness 0.1.0 by running the Demo notebook unchanged (commit ${commit}). Generalized variance decomposition, VAR(2), 10 week horizon, 200 week rolling window.`;
  if (data.meta.synthetic) {
    return `${base}<br/>This run used synthetic input prices, not Yahoo Finance &mdash; see the banner above and README.md.`;
  }
  return base;
}

main().catch((err) => {
  console.error(err);
  app.innerHTML = `<div class="panel"><h2>Failed to load</h2><p>${String(err)}</p></div>`;
});
