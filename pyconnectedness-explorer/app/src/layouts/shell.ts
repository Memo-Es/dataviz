/**
 * App-shell split view -- a persistent left rail (nav + ranking, always visible) and one big
 * content pane on the right showing whichever chart is selected, full-size. The analytics-
 * product pattern (Linear/Vercel-style dashboards) instead of scrolling through stacked cards.
 */
import { NetworkChart } from "../charts/network";
import { TimelineChart } from "../charts/timeline";
import { HeatmapChart } from "../charts/heatmap";
import { RankingList } from "../charts/ranking";
import { renderDetail } from "../charts/detail";
import type { World } from "../world";
import type { LayoutController } from "./types";

type View = "network" | "timeline" | "heatmap";
const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: "network", label: "Network", icon: "&#9679;" },
  { id: "timeline", label: "Trend", icon: "&#9776;" },
  { id: "heatmap", label: "Pair matrix", icon: "&#9638;" },
];

export class ShellLayout implements LayoutController {
  private world!: World;
  private el!: Record<string, HTMLElement>;
  private network!: NetworkChart;
  private timeline!: TimelineChart;
  private heatmap!: HeatmapChart;
  private ranking!: RankingList;
  private activeView: View = "network";

  mount(root: HTMLElement, world: World) {
    this.world = world;
    root.innerHTML = `
      <div class="shell">
        <aside class="shell-rail">
          <div class="shell-brand">PyConnectedness</div>
          <nav class="shell-nav" id="sh-nav">
            ${VIEWS.map((v) => `<button data-view="${v.id}" class="shell-nav-btn"><span class="shell-nav-icon">${v.icon}</span>${v.label}</button>`).join("")}
          </nav>
          <div class="shell-rail-section">Ranking, net spillover</div>
          <div class="shell-ranking" id="sh-ranking"></div>
        </aside>
        <main class="shell-main">
          <div class="shell-toolbar">
            <h2 id="sh-view-title"></h2>
            <div class="controls">
              <div class="pill-group" id="sh-measure-group">
                <button data-measure="returns" aria-pressed="true">Returns</button>
                <button data-measure="volatility" aria-pressed="false">Volatility</button>
              </div>
              <div class="controls" id="sh-timeline-controls">
                <button class="icon-btn" id="sh-back" title="Back 1 week">&#8592;</button>
                <button class="icon-btn" id="sh-play" title="Play">&#9654;</button>
                <button class="icon-btn" id="sh-fwd" title="Forward 1 week">&#8594;</button>
                <span class="legend-note" id="sh-week-label"></span>
              </div>
              <div class="controls" id="sh-matrix-controls">
                <select id="sh-matrix-window"></select>
                <select id="sh-matrix-sort">
                  <option value="notebook">Notebook order</option>
                  <option value="region">By region</option>
                  <option value="net">By net sending</option>
                </select>
              </div>
            </div>
          </div>
          <div class="shell-stage">
            <div class="chart-card shell-chart" id="sh-network" style="display:none"></div>
            <div class="chart-card shell-chart" id="sh-timeline" style="display:none"></div>
            <div class="chart-card shell-chart" id="sh-heatmap" style="display:none"></div>
          </div>
          <div class="shell-detail" id="sh-detail"></div>
        </main>
      </div>
    `;

    this.el = {
      nav: root.querySelector("#sh-nav")!,
      viewTitle: root.querySelector("#sh-view-title")!,
      measureGroup: root.querySelector("#sh-measure-group")!,
      timelineControls: root.querySelector("#sh-timeline-controls")!,
      matrixControls: root.querySelector("#sh-matrix-controls")!,
      weekLabel: root.querySelector("#sh-week-label")!,
      ranking: root.querySelector("#sh-ranking")!,
      detail: root.querySelector("#sh-detail")!,
      matrixWindow: root.querySelector("#sh-matrix-window")!,
      matrixSort: root.querySelector("#sh-matrix-sort")!,
    };

    this.network = new NetworkChart(root.querySelector("#sh-network")!);
    this.timeline = new TimelineChart(root.querySelector("#sh-timeline")!);
    this.heatmap = new HeatmapChart(root.querySelector("#sh-heatmap")!);
    this.ranking = new RankingList(root.querySelector("#sh-ranking")!);

    (this.el.matrixWindow as HTMLSelectElement).innerHTML = [
      `<option value="t">Selected week (rolling)</option>`,
      `<option value="full">Full sample</option>`,
      `<option value="last200">Last 200 weeks</option>`,
    ].join("");

    this.el.nav.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest("button");
      if (!btn) return;
      this.activeView = btn.getAttribute("data-view") as View;
      this.render();
    });
    this.el.measureGroup.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest("button");
      if (!btn) return;
      world.setMeasure(btn.getAttribute("data-measure") as any);
    });
    root.querySelector("#sh-back")!.addEventListener("click", () => world.step(-1));
    root.querySelector("#sh-fwd")!.addEventListener("click", () => world.step(1));
    root.querySelector("#sh-play")!.addEventListener("click", () => world.togglePlay());
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

    this.el.nav.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-view") === this.activeView);
    });
    this.el.measureGroup.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-measure") === f.measure));
    });
    this.el.viewTitle.textContent = VIEWS.find((v) => v.id === this.activeView)!.label;
    this.el.timelineControls.style.display = this.activeView === "timeline" ? "flex" : "none";
    this.el.matrixControls.style.display = this.activeView === "heatmap" ? "flex" : "none";
    this.el.weekLabel.textContent = `Week of ${f.date} (${f.t + 1}/${data.meta.dynamic[f.measure].dates.length})`;
    const play = document.getElementById("sh-play");
    if (play) {
      play.innerHTML = f.s.playing ? "&#10074;&#10074;" : "&#9654;";
      play.title = f.s.playing ? "Pause" : "Play";
    }

    for (const v of VIEWS) {
      const host = document.getElementById(`sh-${v.id}`);
      if (host) host.style.display = v.id === this.activeView ? "block" : "none";
    }

    if (this.activeView === "network") {
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
    } else if (this.activeView === "timeline") {
      const dyn = data.meta.dynamic[f.measure];
      this.timeline.render({
        dates: dyn.dates,
        total: dyn.total,
        fullSampleTotal: data.meta.static[f.measure].full.total,
        title: f.measure === "returns" ? "When markets became fragile" : "Volatility spillover over time",
        ylabel: "",
        episodes: data.meta.episodes,
        periods: f.periods,
        selectedIndex: f.t,
        showXAxis: true,
        style: f.s.chartStyle,
        tokens: f.tok,
        measureLabel: f.measure === "returns" ? "return" : "volatility",
        onScrub: (idx) => world.store.set({ t: idx }),
      });
    } else {
      this.heatmap.render({
        names: f.heatmapOrder,
        matrix: f.heatmapMatrix,
        title: f.heatmapTitle,
        style: f.s.chartStyle,
        tokens: f.tok,
        selectedPair: f.s.selection.pair,
        onSelectCell: world.onSelectCell,
      });
    }

    this.ranking.render({
      names,
      net: f.net,
      style: f.s.chartStyle,
      tokens: f.tok,
      selectedMarket: f.s.selection.market,
      onSelect: world.onSelectMarket,
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
