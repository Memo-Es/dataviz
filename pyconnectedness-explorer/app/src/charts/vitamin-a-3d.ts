/**
 * Vitamin A's own 3D view: the same causal order the 2D DagChart reveals generation by
 * generation, laid out once along a z-axis (Vitamin A, the sink, at the bottom; the earliest
 * source at the top), drawn as an actual ball-and-stick molecular model -- round spheres at
 * each variable, round sticks along each edge, a stick's thickness its own edge coefficient --
 * rather than a thin line-and-cone diagram, per direct steer from a reference photo of a real
 * molecular model kit. Plotly's scatter3d markers are flat camera-facing sprites, not true
 * geometry, so the balls and sticks here are real mesh3d solids: a UV-sphere per node, a
 * capped cylinder per edge, built by hand (standard mesh-generation math, not a library) and
 * lit like a glossy plastic kit. The scene uses a true 1:1:1 aspect (aspectratio all equal) with
 * the z-gap between steps baked into the z-coordinates themselves, not into an uneven aspect
 * ratio -- a sphere built as a true sphere in that coordinate system then renders round from
 * every angle the auto-rotating camera reaches, which a non-uniform aspectratio would have
 * broken (it stretches the whole scene per-axis, spheres included).
 *
 * Node positions, edges and steps are this app's own already-fetched data (run_vitamin_a.py's
 * output, the same pointLayout x/y the 2D chart draws), loaded lazily into Plotly's GL3D bundle
 * (shared chunk with Rivers' own 3D terrain, danube-flood-3d.ts) only once this view is switched
 * on.
 */
import type { VitaminAData } from "./causality-domains";
import { stepColor } from "./dag-chart";

type Plotly3D = typeof import("plotly.js-gl3d-dist-min");
type Vec3 = [number, number, number];

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

interface Mesh {
  x: number[];
  y: number[];
  z: number[];
  i: number[];
  j: number[];
  k: number[];
}

/** a UV-sphere, `rings` latitude bands by `segs` longitude slices -- plenty smooth at this
 * chart's scale (7 nodes), and cheap enough that per-node trace count (for per-node hover text)
 * is no real cost. */
function sphereMesh(center: Vec3, r: number, rings = 12, segs = 18): Mesh {
  const x: number[] = [],
    y: number[] = [],
    z: number[] = [];
  for (let ri = 0; ri <= rings; ri++) {
    const theta = (Math.PI * ri) / rings;
    const st = Math.sin(theta),
      ct = Math.cos(theta);
    for (let sj = 0; sj <= segs; sj++) {
      const phi = (2 * Math.PI * sj) / segs;
      x.push(center[0] + r * st * Math.cos(phi));
      y.push(center[1] + r * st * Math.sin(phi));
      z.push(center[2] + r * ct);
    }
  }
  const i: number[] = [],
    j: number[] = [],
    k: number[] = [];
  for (let ri = 0; ri < rings; ri++) {
    for (let sj = 0; sj < segs; sj++) {
      const a = ri * (segs + 1) + sj;
      const b = a + segs + 1;
      i.push(a, a + 1);
      j.push(b, b);
      k.push(a + 1, b + 1);
    }
  }
  return { x, y, z, i, j, k };
}

/** a capped cylinder from `a` to `b` -- one edge's own "stick", its radius the bond's visual
 * weight (an edge's own coefficient, the same meaning the 2D chart's line width already carries). */
function cylinderMesh(a: Vec3, b: Vec3, r: number, segs = 14): Mesh {
  const axis = norm(sub(b, a));
  const arbitrary: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(arbitrary, axis));
  const v = cross(axis, u);
  const x: number[] = [],
    y: number[] = [],
    z: number[] = [];
  const ringAt = (p: Vec3) => {
    for (let s = 0; s < segs; s++) {
      const ang = (2 * Math.PI * s) / segs;
      const c = Math.cos(ang) * r,
        sN = Math.sin(ang) * r;
      x.push(p[0] + u[0] * c + v[0] * sN);
      y.push(p[1] + u[1] * c + v[1] * sN);
      z.push(p[2] + u[2] * c + v[2] * sN);
    }
  };
  ringAt(a);
  ringAt(b);
  // two cap centres, appended last (indices 2*segs and 2*segs+1)
  x.push(a[0], b[0]);
  y.push(a[1], b[1]);
  z.push(a[2], b[2]);
  const capA = 2 * segs;
  const capB = 2 * segs + 1;
  const i: number[] = [],
    j: number[] = [],
    k: number[] = [];
  for (let s = 0; s < segs; s++) {
    const s1 = (s + 1) % segs;
    const a0 = s,
      a1 = s1,
      b0 = segs + s,
      b1 = segs + s1;
    // side wall, two triangles per quad
    i.push(a0, a0);
    j.push(a1, b1);
    k.push(b1, b0);
    // end caps
    i.push(capA, capB);
    j.push(a1, b0);
    k.push(a0, b1);
  }
  return { x, y, z, i, j, k };
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
    // the z-gap between steps is baked into the coordinate itself (not an uneven aspectratio,
    // which would stretch the spheres/sticks into ellipsoids) -- about the same visual spread
    // as the x/y layout's own -1.3..1.4 range, so steps read as clearly separated "floors"
    const ZSPACE = 1.15;
    const zOf = (step: number) => (steps - 1 - step) * ZSPACE;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const posOf = (id: string): Vec3 => {
      const n = byId.get(id)!;
      return [n.x, n.y, zOf(n.step)];
    };
    const line = css("--line", "#d8d4cc");

    const lighting = { ambient: 0.5, diffuse: 0.7, specular: 0.55, roughness: 0.35, fresnel: 0.15 };
    const traces: Record<string, unknown>[] = [];

    // sticks first, so the balls read as sitting on top of them
    for (const e of edges) {
      const a = posOf(e.cause);
      const b = posOf(e.effect);
      const m = cylinderMesh(a, b, 0.035 + 0.075 * e.coef);
      traces.push({
        type: "mesh3d",
        x: m.x,
        y: m.y,
        z: m.z,
        i: m.i,
        j: m.j,
        k: m.k,
        color: line,
        flatshading: false,
        lighting,
        lightposition: { x: 200, y: -200, z: 300 },
        hoverinfo: "text",
        hovertext: `${byId.get(e.cause)!.label} → ${byId.get(e.effect)!.label} (coefficient ${e.coef.toFixed(2)})`,
      });
    }

    // one mesh3d trace per node (not batched) so each keeps its own hover text; sized by its
    // own share of Vitamin A's tail mass -- the same number the 2D view's own bars lead with
    for (const n of nodes) {
      const r = n.id === "VA" ? 0.26 : 0.14 + (tail_mass_share[n.id] ?? 0) * 0.0022;
      const m = sphereMesh([n.x, n.y, zOf(n.step)], r);
      const color = stepColor(n.step / Math.max(1, steps - 1));
      traces.push({
        type: "mesh3d",
        x: m.x,
        y: m.y,
        z: m.z,
        i: m.i,
        j: m.j,
        k: m.k,
        color,
        flatshading: false,
        lighting,
        lightposition: { x: 200, y: -200, z: 300 },
        hoverinfo: "text",
        hovertext:
          n.id === "VA"
            ? `<b>${n.label}</b> — the model's own sink`
            : `<b>${n.label}</b> · ${(tail_mass_share[n.id] ?? 0).toFixed(0)}% of Vitamin A's tail mass`,
      });
    }

    // labels only -- no markers of its own, so it never competes visually with the spheres above
    traces.push({
      type: "scatter3d",
      mode: "text",
      x: nodes.map((n) => n.x),
      y: nodes.map((n) => n.y),
      z: nodes.map((n) => zOf(n.step) + 0.05),
      text: nodes.map((n) => `${n.step + 1} · ${n.label}`),
      textposition: "middle right",
      textfont: { size: 13, color: css("--stone", "#4a4843") },
      hoverinfo: "skip",
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
        // true to the data's own units on every axis -- the spheres/cylinders above are built
        // as real geometry in this same coordinate system, so only a 1-unit-is-1-unit aspect
        // keeps them actually round. "cube" (an equal render-space BOX regardless of each
        // axis's own data range) would still stretch them, since x/y's range here is smaller
        // than z's own -- "data" is the one mode that scales every axis by the same factor.
        aspectmode: "data",
        camera: { eye: { x: 1.9, y: -1.7, z: 0.65 }, center: { x: 0, y: 0, z: 0.1 } },
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

  // the same slow orbit Rivers' own historical reference used: stop for good on the first
  // drag/scroll/touch, and never start at all if the reader asked for less motion
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
