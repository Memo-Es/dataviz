/**
 * The original single-column stacked layout. Used for the "Faithful baseline" chart style
 * regardless of which bold layout is selected -- baseline's whole point is an unstyled,
 * deliberately plain replica (see CONTEXT.md), so it never gets the bento/shell/story treatment.
 * Also the layout-less fallback if something ever renders before a layout choice is made.
 */
import { NetworkChart } from "../charts/network";
import { TimelineChart } from "../charts/timeline";
import { HeatmapChart } from "../charts/heatmap";
import { RankingList } from "../charts/ranking";
import { renderDetail } from "../charts/detail";
import type { World } from "../world";
import type { LayoutController } from "./types";

export class PlainLayout implements LayoutController {
  private world!: World;
  private el!: Record<string, HTMLElement>;
  private network!: NetworkChart;
  private timelineReturns!: TimelineChart;
  private timelineVol!: TimelineChart;
  private heatmap!: HeatmapChart;
  private ranking!: RankingList;

  mount(root: HTMLElement, world: World) {
    this.world = world;
    root.innerHTML = `
      <p class="legend-note" id="pl-style-note"></p>

      <div class="panel">
        <h2>Total connectedness over time</h2>
        <div class="controls" style="margin-bottom:10px">
          <button class="icon-btn" id="pl-step-back" title="Back 1 week">&#8592;</button>
          <button class="icon-btn" id="pl-play" title="Play">&#9654;</button>
          <button class="icon-btn" id="pl-step-fwd" title="Forward 1 week">&#8594;</button>
          <span class="legend-note" id="pl-week-label"></span>
        </div>
        <div class="chart-card" id="pl-timeline-returns"></div>
        <div class="chart-card" id="pl-timeline-volatility" style="margin-top:8px"></div>
      </div>

      <div class="row">
        <div class="panel" style="flex:2 1 480px">
          <h2>Network &mdash; who sends to whom</h2>
          <div class="chart-card" id="pl-network"></div>
          <p class="legend-note" id="pl-network-note"></p>
        </div>
        <div class="panel" style="flex:1 1 280px">
          <h2>Ranking, net spillover</h2>
          <div id="pl-ranking"></div>
        </div>
      </div>

      <div class="panel">
        <h2>Pair matrix &mdash; every pair</h2>
        <div class="controls" style="margin-bottom:10px">
          <select id="pl-matrix-window"></select>
          <select id="pl-matrix-sort">
            <option value="notebook">Notebook order</option>
            <option value="region">By region</option>
            <option value="net">By net sending</option>
          </select>
        </div>
        <div class="chart-card" id="pl-heatmap"></div>
      </div>

      <div class="panel">
        <h2>Detail</h2>
        <div id="pl-detail"></div>
      </div>
    `;

    this.el = {
      styleNote: root.querySelector("#pl-style-note")!,
      weekLabel: root.querySelector("#pl-week-label")!,
      networkNote: root.querySelector("#pl-network-note")!,
      ranking: root.querySelector("#pl-ranking")!,
      detail: root.querySelector("#pl-detail")!,
      matrixWindow: root.querySelector("#pl-matrix-window")!,
      matrixSort: root.querySelector("#pl-matrix-sort")!,
      timelineReturnsHost: root.querySelector("#pl-timeline-returns")!,
      timelineVolHost: root.querySelector("#pl-timeline-volatility")!,
    };

    this.timelineReturns = new TimelineChart(this.el.timelineReturnsHost);
    this.timelineVol = new TimelineChart(this.el.timelineVolHost);
    this.network = new NetworkChart(root.querySelector("#pl-network")!);
    this.heatmap = new HeatmapChart(root.querySelector("#pl-heatmap")!);
    this.ranking = new RankingList(root.querySelector("#pl-ranking")!);

    (this.el.matrixWindow as HTMLSelectElement).innerHTML = [
      `<option value="t">Selected week (rolling)</option>`,
      `<option value="full">Full sample</option>`,
      `<option value="last200">Last 200 weeks</option>`,
    ].join("");

    root.querySelector("#pl-step-back")!.addEventListener("click", () => world.step(-1));
    root.querySelector("#pl-step-fwd")!.addEventListener("click", () => world.step(1));
    root.querySelector("#pl-play")!.addEventListener("click", () => world.togglePlay());
    (this.el.matrixWindow as HTMLSelectElement).addEventListener("change", (ev) =>
      world.store.set({ matrixWindow: (ev.target as HTMLSelectElement).value as any })
    );
    (this.el.matrixSort as HTMLSelectElement).addEventListener("change", (ev) =>
      world.store.set({ matrixSort: (ev.target as HTMLSelectElement).value as any })
    );
  }

  render() {
    const world = this.world;
    const f = world.computeFrame();
    const data = world.data;
    const names = data.meta.names;
    const isRedesign = f.isRedesign;

    this.el.weekLabel.textContent = `Week of ${f.date} (${f.t + 1} / ${data.meta.dynamic[f.measure].dates.length})`;
    const play = document.getElementById("pl-play");
    if (play) {
      play.textContent = f.s.playing ? "⏸" : "▶";
      play.title = f.s.playing ? "Pause" : "Play";
    }
    this.el.styleNote.textContent = isRedesign
      ? "Redesign: a validated colour system (CVD-checked), region-grouped network, crisis markers and hover detail -- see CONTEXT.md's decision log and the matplotlib style guide in pipeline/styleguide/."
      : "Faithful baseline: a pixel match of the library's own matplotlib defaults, deliberately unstyled (see CONTEXT.md's style analysis).";

    const dynReturns = data.meta.dynamic.returns;
    this.timelineReturns.render({
      dates: dynReturns.dates,
      total: dynReturns.total,
      fullSampleTotal: data.meta.static.returns.full.total,
      title: isRedesign ? "When markets became fragile" : "Rolling return spillover index (200-week window, VAR(2), H=10)",
      ylabel: isRedesign ? "Total return spillover, 200-week window, VAR(2), H=10" : "Total spillover, %",
      episodes: data.meta.episodes,
      periods: f.periods,
      selectedIndex: f.measure === "returns" ? f.t : world.dateIndexFor("returns", f.date),
      showXAxis: false,
      style: f.s.chartStyle,
      tokens: f.tok,
      measureLabel: "return",
      onScrub: world.onScrubReturns,
    });
    const dynVol = data.meta.dynamic.volatility;
    this.timelineVol.render({
      dates: dynVol.dates,
      total: dynVol.total,
      fullSampleTotal: data.meta.static.volatility.full.total,
      title: isRedesign ? "Same story, volatility spillover" : "Rolling volatility spillover index",
      ylabel: isRedesign ? "Total volatility spillover" : "Total spillover, %",
      episodes: data.meta.episodes,
      periods: f.periods,
      selectedIndex: f.measure === "volatility" ? f.t : world.dateIndexFor("volatility", f.date),
      showXAxis: true,
      style: f.s.chartStyle,
      tokens: f.tok,
      measureLabel: "volatility",
      onScrub: world.onScrubVol,
    });
    this.el.timelineReturnsHost.style.boxShadow = f.measure === "returns" ? "inset 0 -3px 0 var(--send)" : "none";
    this.el.timelineVolHost.style.boxShadow = f.measure === "volatility" ? "inset 0 -3px 0 var(--send)" : "none";

    this.network.render({
      names,
      pairwiseNet: f.pairwise,
      net: f.net,
      threshold: f.full.threshold_p90,
      globalMaxAbsNet: f.globalMaxAbsNet,
      globalMaxAbsPairwise: f.globalMaxAbsPairwise,
      title: isRedesign ? "Who sends risk to whom" : `Net pairwise ${f.measure} connectedness, strongest 10% of links`,
      weekLabel: isRedesign ? `Week of ${f.date} · strongest 10% of links` : undefined,
      style: f.s.chartStyle,
      tokens: f.tok,
      onSelectMarket: world.onSelectMarket,
      onSelectPair: world.onSelectPair,
      selectedMarket: f.s.selection.market,
      selectedPair: f.s.selection.pair,
    });
    this.el.networkNote.textContent = isRedesign
      ? "Grouped by region so position means something; size and colour use a fixed scale across every week, so the animation is comparable frame to frame."
      : `Threshold: ${f.full.threshold_p90.toFixed(2)}% (90th percentile of |net pairwise|, this week's static full-sample rule). Node colour follows net at the selected week; size and edge width use a fixed scale across every week so the animation is comparable frame to frame.`;

    this.ranking.render({
      names,
      net: f.net,
      style: f.s.chartStyle,
      tokens: f.tok,
      selectedMarket: f.s.selection.market,
      onSelect: world.onSelectMarket,
    });

    this.heatmap.render({
      names: f.heatmapOrder,
      matrix: f.heatmapMatrix,
      title: f.heatmapTitle,
      style: f.s.chartStyle,
      tokens: f.tok,
      selectedPair: f.s.selection.pair,
      onSelectCell: world.onSelectCell,
    });

    renderDetail(this.el.detail, {
      data,
      measure: f.measure,
      t: f.t,
      market: f.s.selection.market,
      pair: f.s.selection.pair,
      style: f.s.chartStyle,
      tokens: f.tok,
    });
  }
}
