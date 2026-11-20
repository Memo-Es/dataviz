/**
 * Vitamin A's own 3D view -- what Miljana's deck actually draws for this domain (confirmed from
 * her Demo Day package's own deck/data/vitamin3d.json and deck_build/build_figs.py, not a guess):
 * the same causal order the 2D DagChart reveals generation by generation, laid out once along a
 * z-axis (the causal step -- Vitamin A, the sink, at the bottom; the earliest sources at the
 * top) instead of revealed over Play, with a slow auto-rotating camera and a directional cone
 * arrowhead on every edge. Same node positions, edges and steps the 2D chart draws -- her own
 * hand-placed x/y in run_vitamin_a.py's own output matches her deck's layout exactly, confirmed
 * by comparing the two -- just read once into Plotly's GL3D bundle (loaded lazily, the same
 * pattern as danube-flood-3d.ts) instead of D3's 2D SVG. Colour follows this app's own causal-
 * step convention (stepColor, dag-chart.ts) rather than her deck's bespoke per-nutrient palette,
 * for consistency with the 2D view a reader just came from.
 */
import type { VitaminAData } from "./causality-domains";
import { stepColor } from "./dag-chart";

type Plotly3D = typeof import("plotly.js-gl3d-dist-min");

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export class VitaminA3D {
  private Plotly: Plotly3D | null = null;
  private stopRotate = false;

  constructor(
    private host: HTMLElement,
    private data: VitaminAData
  ) {}

  async render() {
    const Plotly = (this.Plotly ??= (await import("plotly.js-gl3d-dist-min")) as unknown as Plotly3D);
    const { nodes, edges, generations, tail_mass_share } = this.data;
    const steps = generations.length;
    const z = (step: number) => steps - 1 - step; // the sink (highest step) sits at z=0, sources at the top
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const ink = css("--stone", "#4a4843");
    const panel = css("--panel", "#fff");

    const traces: Record<string, unknown>[] = [];
    for (const e of edges) {
      const a = byId.get(e.cause)!;
      const b = byId.get(e.effect)!;
      const az = z(a.step);
      const bz = z(b.step);
      const color = stepColor(a.step / Math.max(1, steps - 1));
      traces.push({
        type: "scatter3d",
        mode: "lines",
        x: [a.x, b.x],
        y: [a.y, b.y],
        z: [az, bz],
        line: { color, width: 3 + 14 * e.coef },
        hoverinfo: "text",
        hovertext: `${a.label} → ${b.label} (coefficient ${e.coef.toFixed(2)})`,
        showlegend: false,
      });
      // a cone arrowhead 80% along the edge, cause -> effect -- the same directional cue her own
      // deck draws, read in 3D here instead of the 2D chart's own arrow-shaped node glyph
      const d = [b.x - a.x, b.y - a.y, bz - az];
      const len = Math.hypot(d[0], d[1], d[2]) || 1;
      const u = d.map((v) => v / len);
      const p = [a.x + 0.8 * d[0], a.y + 0.8 * d[1], az + 0.8 * d[2]];
      traces.push({
        type: "cone",
        x: [p[0]],
        y: [p[1]],
        z: [p[2]],
        u: [u[0]],
        v: [u[1]],
        w: [u[2]],
        sizemode: "absolute",
        sizeref: 0.22,
        anchor: "center",
        colorscale: [
          [0, color],
          [1, color],
        ],
        showscale: false,
        hoverinfo: "skip",
      });
    }

    const names = nodes.map((n) => n.id);
    traces.push({
      type: "scatter3d",
      mode: "markers+text",
      x: names.map((id) => byId.get(id)!.x),
      y: names.map((id) => byId.get(id)!.y),
      z: names.map((id) => z(byId.get(id)!.step)),
      text: names.map((id) => `${byId.get(id)!.step + 1} · ${byId.get(id)!.label}`),
      textposition: "middle right",
      textfont: { size: 13, color: ink },
      marker: {
        // Vitamin A itself drawn larger and open (the sink everything else was picked to reach);
        // every other node sized by its own share of VA's tail mass -- the same number the 2D
        // view's own bars lead with, not a separate "how central is this node" measure
        size: names.map((id) => (id === "VA" ? 20 : 10 + (tail_mass_share[id] ?? 0) * 0.22)),
        color: names.map((id) => stepColor(byId.get(id)!.step / Math.max(1, steps - 1))),
        symbol: names.map((id) => (id === "VA" ? "circle-open" : "circle")),
        line: { color: panel, width: 1.5 },
      },
      hovertext: names.map((id) => {
        const n = byId.get(id)!;
        return id === "VA"
          ? `<b>${n.label}</b> — the model's own sink`
          : `<b>${n.label}</b> · ${(tail_mass_share[id] ?? 0).toFixed(0)}% of Vitamin A's tail mass`;
      }),
      hoverinfo: "text",
      showlegend: false,
    });

    const layout: Record<string, unknown> = {
      autosize: true,
      margin: { l: 0, r: 0, t: 0, b: 0 },
      paper_bgcolor: "rgba(0,0,0,0)",
      showlegend: false,
      scene: {
        bgcolor: "rgba(0,0,0,0)",
        xaxis: { visible: false },
        yaxis: { visible: false },
        zaxis: { visible: false },
        aspectmode: "manual",
        aspectratio: { x: 1.15, y: 1.15, z: 1.3 },
        camera: { eye: { x: 1.65, y: -1.45, z: 0.55 }, center: { x: 0, y: 0, z: -0.05 } },
        dragmode: "orbit",
      },
    };

    await Plotly.newPlot(this.host, traces as unknown as Plotly.Data[], layout as Partial<Plotly.Layout>, {
      displayModeBar: false,
      scrollZoom: false,
      responsive: true,
    });
    this.autorotate();
  }

  // the same slow orbit her own deck uses (deck/index.html's own autorotate()): stop for good on
  // the first drag/scroll/touch, and never start at all if the reader asked for less motion
  private autorotate() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const plotted = this.host as unknown as { layout: { scene: { camera: { eye: { x: number; y: number; z: number } } } } };
    const start = plotted.layout.scene.camera.eye;
    const r = Math.hypot(start.x, start.y);
    const a0 = Math.atan2(start.y, start.x);
    let t0: number | null = null;
    for (const ev of ["mousedown", "touchstart", "wheel"]) {
      this.host.addEventListener(ev, () => (this.stopRotate = true), { passive: true });
    }
    const step = (ts: number) => {
      if (this.stopRotate || !this.Plotly) return;
      if (t0 === null) t0 = ts;
      const a = a0 + (ts - t0) / 9000;
      this.Plotly.relayout(this.host, { "scene.camera.eye": { x: r * Math.cos(a), y: r * Math.sin(a), z: start.z } } as Partial<Plotly.Layout>);
      setTimeout(() => requestAnimationFrame(step), 60);
    };
    requestAnimationFrame(step);
  }

  resize() {
    if (this.Plotly) this.Plotly.Plots.resize(this.host);
  }

  destroy() {
    this.stopRotate = true;
    if (this.Plotly) this.Plotly.purge(this.host);
  }
}
