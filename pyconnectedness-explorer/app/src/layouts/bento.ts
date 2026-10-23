/**
 * Bento dashboard layout -- an asymmetric grid of differently-sized tiles (insight/metric/hero
 * chart/table), not a uniform stack of full-width cards. Structure and the click-to-expand
 * drill-down pattern are modelled on the Figma reference the client linked (node 17141:14591,
 * expand interaction at 17278:12182): small text-insight and metric tiles beside a tall hero
 * chart, with a focused drill-down view on selection instead of a cramped sidebar.
 */
import { pairSeriesAt, totalAt, type ExplorerData, type Measure } from "../data";
import { NetworkChart } from "../charts/network";
import { TimelineChart } from "../charts/timeline";
import { HeatmapChart } from "../charts/heatmap";
import { RankingList } from "../charts/ranking";
import { REGION_OF } from "../encoding";
import type { World } from "../world";
import type { LayoutController } from "./types";

const MEASURE_WORD: Record<Measure, string> = { returns: "return", volatility: "volatility" };

export class BentoLayout implements LayoutController {
  private world!: World;
  private data!: ExplorerData;
  private el!: Record<string, HTMLElement>;
  private network!: NetworkChart;
  private timeline!: TimelineChart;
  private heatmap!: HeatmapChart;
  private ranking!: RankingList;
  private drillChart!: TimelineChart;

  mount(root: HTMLElement, world: World) {
    this.world = world;
    this.data = world.data;

    root.innerHTML = `
      <div class="bento-grid">
        <div class="tile t-insight">
          <div class="tile-eyebrow">This week's story</div>
          <div class="tile-headline" id="bn-headline"></div>
          <p class="tile-body" id="bn-body"></p>
        </div>
        <div class="tile t-metric">
          <div class="tile-eyebrow" id="bn-metric-eyebrow"></div>
          <div class="stat-value" id="bn-metric-value"></div>
          <p class="tile-body" id="bn-metric-label"></p>
          <span class="tag" id="bn-metric-tag"></span>
        </div>
        <div class="tile t-network">
          <div class="tile-header"><h2>Who sends to whom</h2></div>
          <div class="chart-card" id="bn-network"></div>
        </div>
        <div class="tile t-timeline">
          <div class="tile-header">
            <h2 id="bn-timeline-title">Trend</h2>
            <div class="controls">
              <button class="icon-btn" id="bn-back" title="Back 1 week">&#8592;</button>
              <button class="icon-btn" id="bn-play" title="Play">&#9654;</button>
              <button class="icon-btn" id="bn-fwd" title="Forward 1 week">&#8594;</button>
            </div>
          </div>
          <div class="chart-card" id="bn-timeline"></div>
        </div>
        <div class="tile t-insight2">
          <div class="tile-eyebrow">Also moving</div>
          <div class="stat-value stat-value-sm" id="bn-metric2-value"></div>
          <p class="tile-body" id="bn-metric2-caption"></p>
        </div>
        <div class="tile t-heatmap">
          <div class="tile-header">
            <h2>Pair matrix</h2>
            <div class="controls">
              <select id="bn-matrix-window"></select>
              <select id="bn-matrix-sort">
                <option value="notebook">Notebook order</option>
                <option value="region">By region</option>
                <option value="net">By net sending</option>
              </select>
            </div>
          </div>
          <div class="chart-card" id="bn-heatmap"></div>
        </div>
        <div class="tile t-ranking">
          <h2>Ranking, net spillover</h2>
          <div id="bn-ranking"></div>
        </div>
      </div>

      <div class="drilldown" id="bn-drill" hidden>
        <div class="drilldown-backdrop" id="bn-drill-backdrop"></div>
        <div class="drilldown-card">
          <button class="icon-btn drilldown-close" id="bn-drill-close" title="Close">&times;</button>
          <div class="tile-eyebrow" id="bn-drill-eyebrow"></div>
          <h2 id="bn-drill-title"></h2>
          <div class="drilldown-stats" id="bn-drill-stats"></div>
          <div class="chart-card" id="bn-drill-chart"></div>
          <div class="drilldown-links" id="bn-drill-links"></div>
        </div>
      </div>
    `;

    this.el = {
      headline: root.querySelector("#bn-headline")!,
      body: root.querySelector("#bn-body")!,
      metricEyebrow: root.querySelector("#bn-metric-eyebrow")!,
      metricValue: root.querySelector("#bn-metric-value")!,
      metricLabel: root.querySelector("#bn-metric-label")!,
      metricTag: root.querySelector("#bn-metric-tag")!,
      timelineTitle: root.querySelector("#bn-timeline-title")!,
      metric2Value: root.querySelector("#bn-metric2-value")!,
      metric2Caption: root.querySelector("#bn-metric2-caption")!,
      matrixWindow: root.querySelector("#bn-matrix-window")!,
      matrixSort: root.querySelector("#bn-matrix-sort")!,
      ranking: root.querySelector("#bn-ranking")!,
      drill: root.querySelector("#bn-drill")!,
      drillEyebrow: root.querySelector("#bn-drill-eyebrow")!,
      drillTitle: root.querySelector("#bn-drill-title")!,
      drillStats: root.querySelector("#bn-drill-stats")!,
      drillLinks: root.querySelector("#bn-drill-links")!,
    };

    this.network = new NetworkChart(root.querySelector("#bn-network")!);
    this.timeline = new TimelineChart(root.querySelector("#bn-timeline")!);
    this.heatmap = new HeatmapChart(root.querySelector("#bn-heatmap")!);
    this.ranking = new RankingList(root.querySelector("#bn-ranking")!);
    this.drillChart = new TimelineChart(root.querySelector("#bn-drill-chart")!);

    (this.el.matrixWindow as HTMLSelectElement).innerHTML = [
      `<option value="t">Selected week (rolling)</option>`,
      `<option value="full">Full sample</option>`,
      `<option value="last200">Last 200 weeks</option>`,
    ].join("");

    root.querySelector("#bn-back")!.addEventListener("click", () => world.step(-1));
    root.querySelector("#bn-fwd")!.addEventListener("click", () => world.step(1));
    root.querySelector("#bn-play")!.addEventListener("click", () => world.togglePlay());
    (this.el.matrixWindow as HTMLSelectElement).addEventListener("change", (ev) =>
      world.store.set({ matrixWindow: (ev.target as HTMLSelectElement).value as any })
    );
    (this.el.matrixSort as HTMLSelectElement).addEventListener("change", (ev) =>
      world.store.set({ matrixSort: (ev.target as HTMLSelectElement).value as any })
    );
    root.querySelector("#bn-drill-close")!.addEventListener("click", () => world.onSelectMarket(null));
    root.querySelector("#bn-drill-backdrop")!.addEventListener("click", () => world.onSelectMarket(null));
  }

  render() {
    const world = this.world;
    const f = world.computeFrame();
    const { data } = this;
    const names = data.meta.names;
    const play = document.getElementById("bn-play");
    if (play) {
      play.innerHTML = f.s.playing ? "&#10074;&#10074;" : "&#9654;";
      play.title = f.s.playing ? "Pause" : "Play";
    }

    // --- insight tile: who's sending/receiving the most, in plain language ---
    let hi = 0, lo = 0;
    f.net.forEach((v, i) => {
      if (v > f.net[hi]) hi = i;
      if (v < f.net[lo]) lo = i;
    });
    this.el.headline.textContent = `${names[hi]} is sending the most risk`;
    this.el.body.textContent = `Net +${f.net[hi].toFixed(1)}% this week, while ${names[lo]} is absorbing the most at ${f.net[lo].toFixed(1)}%.`;

    // --- metric tile: headline stat for the active measure, the reference's "Target Metric" card ---
    const total = totalAt(data, f.measure, f.t);
    const mean = f.full.total;
    const diff = total - mean;
    this.el.metricEyebrow.textContent = `${f.measure} spillover, this week`;
    this.el.metricValue.innerHTML = `${total.toFixed(1)}<span class="stat-unit">%</span>`;
    this.el.metricLabel.textContent = `week of ${f.date}`;
    const tag = this.el.metricTag;
    tag.textContent = `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)}pp vs ${mean.toFixed(1)}% average`;
    tag.className = "tag";

    // --- network ---
    this.network.render({
      names,
      pairwiseNet: f.pairwise,
      net: f.net,
      threshold: f.full.threshold_p90,
      globalMaxAbsNet: f.globalMaxAbsNet,
      globalMaxAbsPairwise: f.globalMaxAbsPairwise,
      title: "Who sends risk to whom",
      weekLabel: `Week of ${f.date} · strongest 10% of links`,
      style: f.s.chartStyle,
      tokens: f.tok,
      onSelectMarket: world.onSelectMarket,
      onSelectPair: world.onSelectPair,
      selectedMarket: f.s.selection.market,
      selectedPair: f.s.selection.pair,
    });

    // --- timeline (active measure only -- the insight2 tile covers the other measure) ---
    const dyn = data.meta.dynamic[f.measure];
    this.el.timelineTitle.textContent = f.measure === "returns" ? "When markets became fragile" : "Volatility spillover over time";
    this.timeline.render({
      dates: dyn.dates,
      total: dyn.total,
      fullSampleTotal: data.meta.static[f.measure].full.total,
      title: "",
      ylabel: "",
      episodes: data.meta.episodes,
      periods: f.periods,
      selectedIndex: f.t,
      showXAxis: true,
      style: f.s.chartStyle,
      tokens: f.tok,
      measureLabel: MEASURE_WORD[f.measure],
      onScrub: (idx) => world.store.set({ t: idx }),
    });

    // --- insight2 tile: the other measure's headline, for cross-reference ---
    const otherMeasure: Measure = f.measure === "returns" ? "volatility" : "returns";
    const otherT = world.dateIndexFor(otherMeasure, f.date);
    const otherTotal = totalAt(data, otherMeasure, otherT);
    const otherMean = data.meta.static[otherMeasure].full.total;
    this.el.metric2Value.innerHTML = `${otherTotal.toFixed(1)}<span class="stat-unit">%</span>`;
    this.el.metric2Caption.textContent =
      otherTotal >= otherMean
        ? `${otherMeasure[0].toUpperCase()}${otherMeasure.slice(1)} spillover -- above its own ${otherMean.toFixed(1)}% average, same as ${MEASURE_WORD[f.measure]}.`
        : `${otherMeasure[0].toUpperCase()}${otherMeasure.slice(1)} spillover -- below its own ${otherMean.toFixed(1)}% average, even while ${MEASURE_WORD[f.measure]} is elevated.`;

    // --- ranking ---
    this.ranking.render({
      names,
      net: f.net,
      style: f.s.chartStyle,
      tokens: f.tok,
      selectedMarket: f.s.selection.market,
      onSelect: world.onSelectMarket,
    });

    // --- heatmap ---
    this.heatmap.render({
      names: f.heatmapOrder,
      matrix: f.heatmapMatrix,
      title: f.heatmapTitle,
      style: f.s.chartStyle,
      tokens: f.tok,
      selectedPair: f.s.selection.pair,
      onSelectCell: world.onSelectCell,
    });

    this.renderDrilldown(f);
  }

  private renderDrilldown(f: ReturnType<World["computeFrame"]>) {
    const { tok, measure, t } = f;
    const { data } = this;
    const names = data.meta.names;
    const s = f.s;
    const show = !!(s.selection.market || s.selection.pair);
    this.el.drill.hidden = !show;
    if (!show) return;

    if (s.selection.market) {
      const name = s.selection.market;
      const i = names.indexOf(name);
      const region = REGION_OF[name] ?? "";
      const series = data.meta.dynamic[measure].net.map((row) => row[i]);
      const nowNet = series[t];
      this.el.drillEyebrow.textContent = region;
      this.el.drillTitle.textContent = name;
      this.el.drillStats.innerHTML = `
        <div class="drill-stat"><div class="drill-stat-value" style="color:${nowNet >= 0 ? tok.send : tok.recv}">${nowNet.toFixed(1)}%</div><div class="drill-stat-label">net, this week</div></div>
        <div class="drill-stat"><div class="drill-stat-value">${nowNet >= 0 ? "Sender" : "Receiver"}</div><div class="drill-stat-label">role this week</div></div>
      `;
      this.drillChart.render({
        dates: data.meta.dynamic[measure].dates,
        total: series,
        fullSampleTotal: 0,
        title: `${name}'s net spillover over time`,
        ylabel: "",
        episodes: [],
        periods: [],
        selectedIndex: t,
        showXAxis: true,
        style: "redesign",
        tokens: tok,
        measureLabel: `${name} net`,
        onScrub: (idx) => this.world.store.set({ t: idx }),
      });
      const mat = f.pairwise;
      const out = names.map((n, j) => ({ n, v: mat[i][j] })).filter((x) => x.n !== name).sort((a, b) => b.v - a.v).slice(0, 3);
      const inn = names.map((n, j) => ({ n, v: mat[j][i] })).filter((x) => x.n !== name).sort((a, b) => b.v - a.v).slice(0, 3);
      this.el.drillLinks.innerHTML = `
        <div><div class="tile-eyebrow">Top outgoing</div>${out.map((o) => `<div class="detail-row"><span class="k">${o.n}</span><span class="v">${o.v.toFixed(2)}%</span></div>`).join("")}</div>
        <div><div class="tile-eyebrow">Top incoming</div>${inn.map((o) => `<div class="detail-row"><span class="k">${o.n}</span><span class="v">${o.v.toFixed(2)}%</span></div>`).join("")}</div>
      `;
    } else if (s.selection.pair) {
      const [sender, receiver] = s.selection.pair;
      const i = names.indexOf(sender);
      const j = names.indexOf(receiver);
      const series = pairSeriesAt(data, measure, i, j);
      const now = series[t];
      const full = data.meta.static[measure].full.pairwise_net[i][j];
      this.el.drillEyebrow.textContent = "Pair";
      this.el.drillTitle.textContent = `${sender} → ${receiver}`;
      this.el.drillStats.innerHTML = `
        <div class="drill-stat"><div class="drill-stat-value" style="color:${now >= 0 ? tok.send : tok.recv}">${now.toFixed(2)}%</div><div class="drill-stat-label">this week</div></div>
        <div class="drill-stat"><div class="drill-stat-value">${full.toFixed(2)}%</div><div class="drill-stat-label">full sample</div></div>
      `;
      this.drillChart.render({
        dates: data.meta.dynamic[measure].dates,
        total: series,
        fullSampleTotal: full,
        title: `${sender} → ${receiver} over time`,
        ylabel: "",
        episodes: [],
        periods: [],
        selectedIndex: t,
        showXAxis: true,
        style: "redesign",
        tokens: tok,
        measureLabel: "pair net",
        onScrub: (idx) => this.world.store.set({ t: idx }),
      });
      this.el.drillLinks.innerHTML = "";
    }
  }
}
