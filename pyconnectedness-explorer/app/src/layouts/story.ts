/**
 * Story-scroll / immersive layout -- one visualization fills almost the whole viewport at a
 * time, with a slim floating pill nav over it and a bottom drawer (collapsed by default) for
 * ranking, detail and controls. Editorial, full-bleed, closer to an NYT/Pudding interactive
 * piece than a dashboard -- the opposite end of the spectrum from the dense Bento grid.
 */
import { NetworkChart } from "../charts/network";
import { TimelineChart } from "../charts/timeline";
import { HeatmapChart } from "../charts/heatmap";
import { RankingList } from "../charts/ranking";
import { renderDetail } from "../charts/detail";
import type { World } from "../world";
import type { LayoutController } from "./types";

type View = "network" | "timeline" | "heatmap";
const VIEWS: { id: View; label: string }[] = [
  { id: "network", label: "Network" },
  { id: "timeline", label: "Trend" },
  { id: "heatmap", label: "Pair matrix" },
];

export class StoryLayout implements LayoutController {
  private world!: World;
  private el!: Record<string, HTMLElement>;
  private network!: NetworkChart;
  private timeline!: TimelineChart;
  private heatmap!: HeatmapChart;
  private ranking!: RankingList;
  private activeView: View = "network";
  private drawerOpen = false;

  mount(root: HTMLElement, world: World) {
    this.world = world;
    root.innerHTML = `
      <div class="story">
        <div class="story-nav" id="st-nav">
          ${VIEWS.map((v) => `<button data-view="${v.id}">${v.label}</button>`).join("")}
          <span class="story-nav-sep"></span>
          <div class="pill-group" id="st-measure-group">
            <button data-measure="returns" aria-pressed="true">Returns</button>
            <button data-measure="volatility" aria-pressed="false">Volatility</button>
          </div>
        </div>
        <div class="story-stage">
          <div class="chart-card story-chart" id="st-network" style="display:none"></div>
          <div class="chart-card story-chart" id="st-timeline" style="display:none"></div>
          <div class="chart-card story-chart" id="st-heatmap" style="display:none"></div>
          <div class="story-stage-controls" id="st-timeline-controls">
            <button class="icon-btn" id="st-back" title="Back 1 week">&#8592;</button>
            <button class="icon-btn" id="st-play" title="Play">&#9654;</button>
            <button class="icon-btn" id="st-fwd" title="Forward 1 week">&#8594;</button>
          </div>
          <div class="story-stage-controls" id="st-matrix-controls">
            <select id="st-matrix-window"></select>
            <select id="st-matrix-sort">
              <option value="notebook">Notebook order</option>
              <option value="region">By region</option>
              <option value="net">By net sending</option>
            </select>
          </div>
        </div>
        <button class="story-drawer-handle" id="st-handle">
          <span id="st-handle-text"></span>
          <span class="story-drawer-chevron">&#9650;</span>
        </button>
        <div class="story-drawer" id="st-drawer">
          <div class="story-drawer-grid">
            <div>
              <h2>Ranking, net spillover</h2>
              <div id="st-ranking"></div>
            </div>
            <div>
              <h2>Detail</h2>
              <div id="st-detail"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.el = {
      nav: root.querySelector("#st-nav")!,
      measureGroup: root.querySelector("#st-measure-group")!,
      timelineControls: root.querySelector("#st-timeline-controls")!,
      matrixControls: root.querySelector("#st-matrix-controls")!,
      handle: root.querySelector("#st-handle")!,
      handleText: root.querySelector("#st-handle-text")!,
      drawer: root.querySelector("#st-drawer")!,
      ranking: root.querySelector("#st-ranking")!,
      detail: root.querySelector("#st-detail")!,
      matrixWindow: root.querySelector("#st-matrix-window")!,
      matrixSort: root.querySelector("#st-matrix-sort")!,
    };

    this.network = new NetworkChart(root.querySelector("#st-network")!);
    this.timeline = new TimelineChart(root.querySelector("#st-timeline")!);
    this.heatmap = new HeatmapChart(root.querySelector("#st-heatmap")!);
    this.ranking = new RankingList(root.querySelector("#st-ranking")!);

    (this.el.matrixWindow as HTMLSelectElement).innerHTML = [
      `<option value="t">Selected week (rolling)</option>`,
      `<option value="full">Full sample</option>`,
      `<option value="last200">Last 200 weeks</option>`,
    ].join("");

    this.el.nav.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest("button[data-view]");
      if (!btn) return;
      this.activeView = btn.getAttribute("data-view") as View;
      this.render();
    });
    this.el.measureGroup.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest("button");
      if (!btn) return;
      world.setMeasure(btn.getAttribute("data-measure") as any);
    });
    this.el.handle.addEventListener("click", () => {
      this.drawerOpen = !this.drawerOpen;
      this.el.drawer.classList.toggle("open", this.drawerOpen);
      this.el.handle.classList.toggle("open", this.drawerOpen);
    });
    root.querySelector("#st-back")!.addEventListener("click", () => world.step(-1));
    root.querySelector("#st-fwd")!.addEventListener("click", () => world.step(1));
    root.querySelector("#st-play")!.addEventListener("click", () => world.togglePlay());
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

    this.el.nav.querySelectorAll("button[data-view]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-view") === this.activeView);
    });
    this.el.measureGroup.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-measure") === f.measure));
    });
    this.el.timelineControls.style.display = this.activeView === "timeline" ? "flex" : "none";
    this.el.matrixControls.style.display = this.activeView === "heatmap" ? "flex" : "none";
    const play = document.getElementById("st-play");
    if (play) {
      play.innerHTML = f.s.playing ? "&#10074;&#10074;" : "&#9654;";
      play.title = f.s.playing ? "Pause" : "Play";
    }

    for (const v of VIEWS) {
      const host = document.getElementById(`st-${v.id}`);
      if (host) host.style.display = v.id === this.activeView ? "block" : "none";
    }

    const total = data.meta.dynamic[f.measure].total[f.t];
    this.el.handleText.textContent = `${total.toFixed(1)}% ${f.measure} spillover, week of ${f.date} — ranking & detail`;

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
