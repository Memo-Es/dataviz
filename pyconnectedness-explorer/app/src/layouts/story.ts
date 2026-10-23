/**
 * Story / gallery-viewer layout -- reskinned directly off a Mobbin scan of Google Arts &
 * Culture (full scan: home/explore, artwork detail, the colour-palette tool, museum/collection
 * profile). That app's actual language has nothing to do with stat tiles or donut charts: it's
 * full-bleed imagery as the hero, minimal floating circular icon buttons sitting ON the image,
 * a dark gradient caption card overlaid directly on the image (not a separate text block above
 * or below it), and masonry grids of varied-size thumbnails for browsing a collection.
 *
 * Translated to data that has no photography: each chart IS the "artwork" -- full-bleed on a
 * dark gallery-wall stage, with the title/description as a bottom scrim caption sitting on top
 * of the chart the way a museum caption sits on an AR tour photo, and view-switching/controls
 * as floating circular buttons over the image instead of a toolbar beside it. The ranking list
 * becomes a magnitude-sized gallery grid (bigger |net| -> bigger tile), the same "varied-size
 * thumbnail wall" pattern as Google Arts & Culture's collection grids.
 */
import { NetworkChart } from "../charts/network";
import { TimelineChart } from "../charts/timeline";
import { HeatmapChart } from "../charts/heatmap";
import { renderDetail } from "../charts/detail";
import { REDESIGN_DARK } from "../encoding";
import type { World } from "../world";
import type { LayoutController } from "./types";

// The stage is always a dark gallery wall (see layouts/story.ts header) -- charts on it use the
// dark token set regardless of the app's own light/dark toggle, so they never clash with it.
const STAGE_TOK = REDESIGN_DARK;

type View = "network" | "timeline" | "heatmap";
const VIEWS: { id: View; label: string; eyebrow: string }[] = [
  { id: "network", label: "Network", eyebrow: "Network" },
  { id: "timeline", label: "Trend", eyebrow: "Timeline" },
  { id: "heatmap", label: "Pair matrix", eyebrow: "Matrix" },
];

export class StoryLayout implements LayoutController {
  private world!: World;
  private el!: Record<string, HTMLElement>;
  private network!: NetworkChart;
  private timeline!: TimelineChart;
  private heatmap!: HeatmapChart;
  private activeView: View = "network";
  private drawerOpen = false;

  mount(root: HTMLElement, world: World) {
    this.world = world;
    root.innerHTML = `
      <div class="story">
        <div class="story-stage">
          <div class="story-scrim story-scrim-top">
            <div class="story-dots" id="st-dots">
              ${VIEWS.map((v, i) => `<button class="story-dot" data-view="${v.id}" title="${v.label}"><span>${i + 1}</span></button>`).join("")}
            </div>
            <div class="story-fab-group" id="st-measure-group">
              <button class="story-fab-pill" data-measure="returns" aria-pressed="true">Returns</button>
              <button class="story-fab-pill" data-measure="volatility" aria-pressed="false">Volatility</button>
            </div>
          </div>

          <div class="chart-card story-chart" id="st-network" style="display:none"></div>
          <div class="chart-card story-chart" id="st-timeline" style="display:none"></div>
          <div class="chart-card story-chart" id="st-heatmap" style="display:none"></div>

          <button class="story-fab story-fab-prev" id="st-prev-view" title="Previous view">&#8249;</button>
          <button class="story-fab story-fab-next" id="st-next-view" title="Next view">&#8250;</button>

          <div class="story-float story-float-matrix" id="st-matrix-controls">
            <select id="st-matrix-window"></select>
            <select id="st-matrix-sort">
              <option value="notebook">Notebook order</option>
              <option value="region">By region</option>
              <option value="net">By net sending</option>
            </select>
          </div>

          <div class="story-scrim story-scrim-bottom">
            <div class="story-caption">
              <div class="story-caption-eyebrow" id="st-caption-eyebrow"></div>
              <h2 id="st-caption-title"></h2>
              <p id="st-caption-sub"></p>
            </div>
            <div class="story-transport" id="st-timeline-controls">
              <button class="story-fab story-fab-sm" id="st-back" title="Back 1 week">&#8592;</button>
              <button class="story-fab story-fab-sm" id="st-play" title="Play">&#9654;</button>
              <button class="story-fab story-fab-sm" id="st-fwd" title="Forward 1 week">&#8594;</button>
            </div>
          </div>
        </div>

        <button class="story-drawer-handle" id="st-handle">
          <span id="st-handle-text"></span>
          <span class="story-drawer-chevron">&#9650;</span>
        </button>
        <div class="story-drawer" id="st-drawer">
          <div class="story-drawer-grid">
            <div>
              <h2>Markets, by |net spillover|</h2>
              <div class="gallery-grid" id="st-gallery"></div>
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
      dots: root.querySelector("#st-dots")!,
      measureGroup: root.querySelector("#st-measure-group")!,
      timelineControls: root.querySelector("#st-timeline-controls")!,
      matrixControls: root.querySelector("#st-matrix-controls")!,
      captionEyebrow: root.querySelector("#st-caption-eyebrow")!,
      captionTitle: root.querySelector("#st-caption-title")!,
      captionSub: root.querySelector("#st-caption-sub")!,
      handle: root.querySelector("#st-handle")!,
      handleText: root.querySelector("#st-handle-text")!,
      drawer: root.querySelector("#st-drawer")!,
      gallery: root.querySelector("#st-gallery")!,
      detail: root.querySelector("#st-detail")!,
      matrixWindow: root.querySelector("#st-matrix-window")!,
      matrixSort: root.querySelector("#st-matrix-sort")!,
    };

    this.network = new NetworkChart(root.querySelector("#st-network")!);
    this.timeline = new TimelineChart(root.querySelector("#st-timeline")!);
    this.heatmap = new HeatmapChart(root.querySelector("#st-heatmap")!);

    (this.el.matrixWindow as HTMLSelectElement).innerHTML = [
      `<option value="t">Selected week (rolling)</option>`,
      `<option value="full">Full sample</option>`,
      `<option value="last200">Last 200 weeks</option>`,
    ].join("");

    const setView = (v: View) => { this.activeView = v; this.render(); };
    this.el.dots.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest("button[data-view]");
      if (!btn) return;
      setView(btn.getAttribute("data-view") as View);
    });
    root.querySelector("#st-prev-view")!.addEventListener("click", () => {
      const i = VIEWS.findIndex((v) => v.id === this.activeView);
      setView(VIEWS[(i - 1 + VIEWS.length) % VIEWS.length].id);
    });
    root.querySelector("#st-next-view")!.addEventListener("click", () => {
      const i = VIEWS.findIndex((v) => v.id === this.activeView);
      setView(VIEWS[(i + 1) % VIEWS.length].id);
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
    this.el.gallery.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest("button[data-market]");
      if (!btn) return;
      world.onSelectMarket(btn.getAttribute("data-market"));
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
    const view = VIEWS.find((v) => v.id === this.activeView)!;

    this.el.dots.querySelectorAll("button[data-view]").forEach((b) => {
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
    this.el.handleText.textContent = `${total.toFixed(1)}% ${f.measure} spillover, week of ${f.date} — markets & detail`;

    this.el.captionEyebrow.textContent = `${view.eyebrow} · week of ${f.date}`;

    if (this.activeView === "network") {
      this.el.captionTitle.textContent = "Who sends risk to whom";
      this.el.captionSub.textContent = "Grouped by region; strongest 10% of links this week.";
      this.network.render({
        names,
        pairwiseNet: f.pairwise,
        net: f.net,
        threshold: f.full.threshold_p90,
        globalMaxAbsNet: f.globalMaxAbsNet,
        globalMaxAbsPairwise: f.globalMaxAbsPairwise,
        title: "",
        weekLabel: "",
        style: f.s.chartStyle,
        tokens: STAGE_TOK,
        onSelectMarket: world.onSelectMarket,
        onSelectPair: world.onSelectPair,
        selectedMarket: f.s.selection.market,
        selectedPair: f.s.selection.pair,
      });
    } else if (this.activeView === "timeline") {
      const dyn = data.meta.dynamic[f.measure];
      this.el.captionTitle.textContent = f.measure === "returns" ? "When markets became fragile" : "Volatility spillover over time";
      this.el.captionSub.textContent = `${total.toFixed(1)}% total spillover this week.`;
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
        tokens: STAGE_TOK,
        measureLabel: f.measure === "returns" ? "return" : "volatility",
        onScrub: (idx) => world.store.set({ t: idx }),
      });
    } else {
      this.el.captionTitle.textContent = "Every pair, net connectedness";
      this.el.captionSub.textContent = f.heatmapTitle;
      this.heatmap.render({
        names: f.heatmapOrder,
        matrix: f.heatmapMatrix,
        title: "",
        style: f.s.chartStyle,
        tokens: STAGE_TOK,
        selectedPair: f.s.selection.pair,
        onSelectCell: world.onSelectCell,
      });
    }

    this.renderGallery(names, f.net, f.tok, f.s.selection.market);

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

  /** Market tiles sized by |net| -- the same "masonry wall of varied-size thumbnails" pattern
   * as Google Arts & Culture's collection grids, with magnitude standing in for image size. */
  private renderGallery(names: string[], net: number[], tok: ReturnType<World["tokens"]>, selectedMarket: string | null) {
    const maxAbs = Math.max(1e-9, ...net.map((v) => Math.abs(v)));
    const order = names.map((n, i) => ({ n, v: net[i] })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    this.el.gallery.innerHTML = order
      .map((o) => {
        const frac = Math.abs(o.v) / maxAbs;
        const size = frac > 0.55 ? "lg" : frac > 0.22 ? "md" : "sm";
        const color = o.v >= 0 ? tok.send : tok.recv;
        const sel = o.n === selectedMarket ? " selected" : "";
        return `<button class="gallery-card gallery-${size}${sel}" style="--gcolor:${color}" data-market="${o.n}">
          <div class="gallery-card-value">${o.v.toFixed(1)}%</div>
          <div class="gallery-card-name">${o.n}</div>
        </button>`;
      })
      .join("");
  }
}
