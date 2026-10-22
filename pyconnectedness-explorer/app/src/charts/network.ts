/**
 * Two renderers sharing one data shape (see CONTEXT.md's decision log):
 *
 * - baseline: a port of plot_connectedness_graph + connectedness_graph
 *   (src/pyconnectedness/viz/network.py). Notebook-order circular layout (position carries no
 *   meaning -- deliberate, matches the library), tab:red/tab:blue at 0.85 alpha, grey edges,
 *   9pt labels on the nodes, no legend.
 * - redesign: the actual deliverable. Fixes the three things Miljana named as weak -- faint
 *   arrows, no size legend, a circle in no meaningful order -- with a region-grouped layout,
 *   a node-size legend, clearer edges, labels off the node, and the validated red/blue pair
 *   shared with the heatmap (same meaning, same colour, finally).
 *
 * Both use a FIXED domain for node size / edge width across every rolling window
 * (CONTEXT.md review finding 5), not the per-frame max the library itself uses.
 */
import * as d3 from "d3";
import { BASELINE, FONTS, REDESIGN, REGION_OF, type RedesignTokens, type Region } from "../encoding";
import { hideTooltip, showTooltip } from "../tooltip";
import type { ChartStyle } from "../state";

export interface NetworkDatum {
  names: string[]; // notebook order
  pairwiseNet: number[][]; // k x k, [i][j] = i sends to j
  net: number[]; // k
  threshold: number;
  globalMaxAbsNet: number;
  globalMaxAbsPairwise: number;
  nodeScale?: number; // area of the largest node, pt^2 (matches node_scale kwarg)
  edgeScale?: number; // width of the strongest edge, pt (matches edge_scale kwarg)
  title: string;
  weekLabel?: string; // e.g. "week of 2026-09-04" -- redesign subtitle
  style: ChartStyle;
  tokens: RedesignTokens;
  onSelectMarket?: (name: string | null) => void;
  onSelectPair?: (pair: [string, string] | null) => void;
  selectedMarket?: string | null;
  selectedPair?: [string, string] | null;
}

const SIZE = 1000; // internal viewBox units (square, like figsize=(X,X))

interface Pos {
  x: number;
  y: number;
  angle: number;
}

function notebookOrderLayout(names: string[], cx: number, cy: number, r: number): Pos[] {
  const k = names.length;
  // nx.circular_layout: node i at angle i/k*2pi, starting at (1,0), counterclockwise in
  // standard math orientation (y-up); negate sin to reproduce that visually in SVG's y-down
  // coordinate system.
  return names.map((_, i) => {
    const theta = (i / k) * 2 * Math.PI;
    return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta), angle: theta };
  });
}

/** Grid-snapped, per-region layout -- per the client's network reference: nodes on a loose
 * grid instead of a circle, grouped into zones by region so position still carries meaning.
 * Zones don't touch, leaving the reference's airy, gapped look rather than a packed grid. */
const GRID_COLS = 7;
const GRID_ROWS = 5;
interface Zone {
  region: Region;
  c0: number;
  c1: number;
  r0: number;
  r1: number;
}
const ZONES: Zone[] = [
  { region: "Europe", c0: 1, c1: 6, r0: 0, r1: 1 },
  { region: "Americas", c0: 0, c1: 2, r0: 2, r1: 4 },
  { region: "Asia Pacific", c0: 3, c1: 6, r0: 2, r1: 4 },
];

interface GridPos extends Pos {
  col: number;
  row: number;
}

function gridLayout(names: string[], gx0: number, gy0: number, cw: number, ch: number): GridPos[] {
  const pos: GridPos[] = new Array(names.length);
  for (const zone of ZONES) {
    const group = names.filter((n) => REGION_OF[n] === zone.region);
    const cells: [number, number][] = [];
    for (let r = zone.r0; r <= zone.r1; r++) for (let c = zone.c0; c <= zone.c1; c++) cells.push([c, r]);
    // pick `group.length` cells evenly spread through the zone, not packed into one corner
    const n = group.length;
    const picks =
      n === 1
        ? [Math.floor((cells.length - 1) / 2)]
        : Array.from({ length: n }, (_, i) => Math.round((i * (cells.length - 1)) / (n - 1)));
    group.forEach((name, i) => {
      const [c, r] = cells[picks[i]];
      const idx = names.indexOf(name);
      pos[idx] = { x: gx0 + (c + 0.5) * cw, y: gy0 + (r + 0.5) * ch, angle: 0, col: c, row: r };
    });
  }
  return pos;
}

export class NetworkChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private gEdges: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gRegionLabels: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gNodes: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gLabels: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gLegend: d3.Selection<SVGGElement, unknown, null, undefined>;
  private title: d3.Selection<SVGTextElement, unknown, null, undefined>;
  private subtitle: d3.Selection<SVGTextElement, unknown, null, undefined>;

  constructor(host: HTMLElement) {
    this.svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `0 0 ${SIZE} ${SIZE}`)
      .attr("width", "100%")
      .style("display", "block") as any;

    const defs = this.svg.append("defs");
    defs
      .append("marker")
      .attr("id", "net-arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 9)
      .attr("refY", 5)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z");

    this.title = this.svg.append("text").attr("x", SIZE / 2).attr("text-anchor", "middle") as any;
    this.subtitle = this.svg.append("text").attr("x", SIZE / 2).attr("text-anchor", "middle") as any;

    this.gEdges = this.svg.append("g").attr("class", "edges") as any;
    this.gRegionLabels = this.svg.append("g").attr("class", "region-labels") as any;
    this.gNodes = this.svg.append("g").attr("class", "nodes") as any;
    this.gLabels = this.svg.append("g").attr("class", "labels") as any;
    this.gLegend = this.svg.append("g").attr("class", "legend") as any;
  }

  render(d: NetworkDatum) {
    if (d.style === "baseline") this.renderBaseline(d);
    else this.renderRedesign(d);
  }

  private clearChrome() {
    this.gLegend.selectAll("*").remove();
    this.gRegionLabels.selectAll("*").remove();
  }

  // ---------------------------------------------------------------- baseline ----
  private renderBaseline(d: NetworkDatum) {
    this.clearChrome();
    this.svg.style("background", BASELINE.figureBg);
    const { names, pairwiseNet, net, threshold } = d;
    const k = names.length;
    const nodeScale = d.nodeScale ?? 1600;
    const edgeScale = d.edgeScale ?? 4;

    this.title
      .attr("y", BASELINE.titlePx + 3)
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", BASELINE.titlePx)
      .attr("fill", BASELINE.textColor)
      .attr("font-weight", "normal")
      .text(d.title);
    this.subtitle.text("");

    const cx = SIZE / 2;
    const cy = SIZE / 2 + 20;
    const r = SIZE * 0.38;
    const pos = notebookOrderLayout(names, cx, cy, r);

    const maxAbsNet = d.globalMaxAbsNet || 1e-9;
    const ptToPxLocal = (pt: number) => pt * (SIZE / 700);
    const radii = net.map((v) => {
      const frac = 0.25 + 0.75 * (Math.abs(v) / maxAbsNet);
      const areaPt2 = nodeScale * frac;
      const areaPx2 = areaPt2 * ptToPxLocal(1) ** 2 * 0.5;
      return Math.sqrt(Math.max(areaPx2, 4) / Math.PI);
    });

    type Edge = { i: number; j: number; w: number };
    const edges: Edge[] = [];
    for (let i = 0; i < k; i++)
      for (let j = 0; j < k; j++) {
        if (i === j) continue;
        const w = pairwiseNet[i][j];
        if (w > threshold) edges.push({ i, j, w });
      }
    const maxAbsPairwise = d.globalMaxAbsPairwise || 1e-9;

    this.svg.select("marker#net-arrow path").attr("fill", BASELINE.edgeColor);

    const edgeSel = this.gEdges.selectAll<SVGPathElement, Edge>("path").data(edges, (e) => `${e.i}-${e.j}`);
    edgeSel.exit().remove();
    const edgeEnter = edgeSel
      .enter()
      .append("path")
      .attr("fill", "none")
      .attr("marker-end", "url(#net-arrow)");
    edgeEnter
      .merge(edgeSel as any)
      .attr("stroke", BASELINE.edgeColor)
      .attr("stroke-width", (e) => Math.max(0.6, ptToPxLocal((edgeScale * e.w) / maxAbsPairwise)))
      .attr("d", (e) => arcPath(pos[e.i], pos[e.j], radii[e.i], radii[e.j], BASELINE.edgeCurveRad, BASELINE.edgeArrowSizePx))
      .style("cursor", "pointer")
      .on("click", (_ev, e) => d.onSelectPair?.([names[e.i], names[e.j]]))
      .attr("opacity", (e) => edgeOpacity(e, d.selectedMarket, d.selectedPair, names));

    const nodeSel = this.gNodes.selectAll<SVGCircleElement, number>("circle").data(d3.range(k));
    nodeSel.exit().remove();
    nodeSel
      .enter()
      .append("circle")
      .style("cursor", "pointer")
      .merge(nodeSel as any)
      .attr("cx", (i) => pos[i].x)
      .attr("cy", (i) => pos[i].y)
      .attr("r", (i) => radii[i])
      .attr("fill", (i) => (net[i] >= 0 ? BASELINE.sendColor : BASELINE.recvColor))
      .attr("fill-opacity", BASELINE.nodeAlpha)
      .attr("stroke", (i) => (d.selectedMarket === names[i] ? BASELINE.textColor : "none"))
      .attr("stroke-width", 2)
      .on("click", (_ev, i) => d.onSelectMarket?.(d.selectedMarket === names[i] ? null : names[i]))
      .attr("opacity", (i) => (!d.selectedMarket || names[i] === d.selectedMarket ? 1 : 0.35));

    const labelSel = this.gLabels.selectAll<SVGTextElement, number>("text").data(d3.range(k));
    labelSel.exit().remove();
    labelSel
      .enter()
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .style("pointer-events", "none")
      .merge(labelSel as any)
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", BASELINE.networkLabelPx)
      .attr("fill", BASELINE.textColor)
      .attr("x", (i) => pos[i].x)
      .attr("y", (i) => pos[i].y)
      .text((i) => names[i]);
  }

  // ---------------------------------------------------------------- redesign ----
  private renderRedesign(d: NetworkDatum) {
    const t = d.tokens;
    this.svg.style("background", t.surface);
    const { names, pairwiseNet, net, threshold } = d;
    const k = names.length;
    const nodeScale = d.nodeScale ?? 1600;
    const edgeScale = d.edgeScale ?? 4;

    this.title
      .attr("y", 34)
      .attr("font-family", FONTS.display)
      .attr("font-size", REDESIGN.titlePx)
      .attr("font-weight", "600")
      .attr("fill", t.primary)
      .text(d.title);
    this.subtitle
      .attr("y", 54)
      .attr("font-family", FONTS.body)
      .attr("font-size", REDESIGN.subtitlePx)
      .attr("fill", t.secondary)
      .text(d.weekLabel ?? "");

    const gx0 = 44, gy0 = 110;
    const gx1 = SIZE - 44, gy1 = 740;
    const cw = (gx1 - gx0) / GRID_COLS;
    const ch = (gy1 - gy0) / GRID_ROWS;
    const pos = gridLayout(names, gx0, gy0, cw, ch);

    // one label per zone, above its top-left corner
    for (const zone of ZONES) {
      this.gRegionLabels
        .append("text")
        .attr("x", gx0 + zone.c0 * cw)
        .attr("y", gy0 + zone.r0 * ch - 10)
        .attr("text-anchor", "start")
        .attr("font-family", FONTS.body)
        .attr("font-size", 11)
        .attr("font-weight", "600")
        .attr("letter-spacing", "0.04em")
        .attr("fill", t.muted)
        .text(zone.region.toUpperCase());
    }

    const maxAbsNet = d.globalMaxAbsNet || 1e-9;
    const ptToPxLocal = (pt: number) => pt * (SIZE / 700);
    const radiusFor = (v: number) => {
      const frac = 0.28 + 0.72 * (Math.abs(v) / maxAbsNet);
      const areaPt2 = nodeScale * frac;
      const areaPx2 = areaPt2 * ptToPxLocal(1) ** 2 * 0.5;
      return Math.sqrt(Math.max(areaPx2, 5) / Math.PI);
    };
    const radii = net.map(radiusFor);

    type Edge = { i: number; j: number; w: number };
    const edges: Edge[] = [];
    for (let i = 0; i < k; i++)
      for (let j = 0; j < k; j++) {
        if (i === j) continue;
        const w = pairwiseNet[i][j];
        if (w > threshold) edges.push({ i, j, w });
      }
    const maxAbsPairwise = d.globalMaxAbsPairwise || 1e-9;

    this.svg.select("marker#net-arrow path").attr("fill", t.secondary);

    const edgeSel = this.gEdges.selectAll<SVGPathElement, Edge>("path").data(edges, (e) => `${e.i}-${e.j}`);
    edgeSel.exit().remove();
    const edgeEnter = edgeSel.enter().append("path").attr("fill", "none").attr("marker-end", "url(#net-arrow)");
    edgeEnter
      .merge(edgeSel as any)
      .attr("stroke", t.secondary)
      .attr("stroke-linecap", "round")
      .attr("stroke-width", (e) => Math.max(1, ptToPxLocal((edgeScale * e.w) / maxAbsPairwise) * 1.1))
      .attr("d", (e) => kinkedPath(pos[e.i], pos[e.j], radii[e.i], radii[e.j], REDESIGN.edgeArrowSizePx))
      .attr("opacity", (e) => REDESIGN.edgeAlpha * edgeOpacity(e, d.selectedMarket, d.selectedPair, names))
      .style("cursor", "pointer")
      .on("click", (_ev, e) => d.onSelectPair?.([names[e.i], names[e.j]]))
      .on("mousemove", (ev: MouseEvent, e) => {
        showTooltip(ev.clientX, ev.clientY, `${names[e.i]} → ${names[e.j]}`, [
          { label: "net flow", value: `${e.w.toFixed(2)}%`, swatch: t.secondary },
        ]);
      })
      .on("mouseleave", () => hideTooltip());

    const nodeSel = this.gNodes.selectAll<SVGCircleElement, number>("circle").data(d3.range(k));
    nodeSel.exit().remove();
    nodeSel
      .enter()
      .append("circle")
      .style("cursor", "pointer")
      .merge(nodeSel as any)
      .attr("cx", (i) => pos[i].x)
      .attr("cy", (i) => pos[i].y)
      .attr("r", (i) => radii[i])
      .attr("fill", (i) => (net[i] >= 0 ? t.send : t.recv))
      .attr("fill-opacity", REDESIGN.nodeAlpha)
      .attr("stroke", t.surface)
      .attr("stroke-width", (i) => (d.selectedMarket === names[i] ? 3 : REDESIGN.markerRingPx))
      .attr("stroke-opacity", (i) => (d.selectedMarket === names[i] ? 1 : 0.9))
      .on("click", (_ev, i) => d.onSelectMarket?.(d.selectedMarket === names[i] ? null : names[i]))
      .on("mousemove", (ev: MouseEvent, i) => {
        showTooltip(ev.clientX, ev.clientY, names[i], [
          { label: REGION_OF[names[i]], value: "" },
          { label: "net", value: `${net[i].toFixed(2)}%`, swatch: net[i] >= 0 ? t.send : t.recv },
        ]);
      })
      .on("mouseleave", () => hideTooltip())
      .attr("opacity", (i) => (!d.selectedMarket || names[i] === d.selectedMarket ? 1 : 0.3));

    const labelSel = this.gLabels.selectAll<SVGTextElement, number>("text").data(d3.range(k));
    labelSel.exit().remove();
    labelSel
      .enter()
      .append("text")
      .style("pointer-events", "none")
      .merge(labelSel as any)
      .attr("font-family", FONTS.body)
      .attr("font-size", REDESIGN.networkLabelPx)
      .attr("font-weight", (i) => (d.selectedMarket === names[i] ? "600" : "400"))
      .attr("fill", t.primary)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "hanging")
      .attr("x", (i) => pos[i].x)
      .attr("y", (i) => pos[i].y + radii[i] + 7)
      .text((i) => names[i]);

    this.drawLegend(d, t, maxAbsNet);
  }

  private drawLegend(d: NetworkDatum, t: RedesignTokens, maxAbsNet: number) {
    this.gLegend.selectAll("*").remove();
    const x0 = 24;
    const y0 = SIZE - 128;
    const g = this.gLegend.append("g").attr("transform", `translate(${x0},${y0})`);

    g.append("text")
      .attr("font-family", FONTS.body)
      .attr("font-size", 11)
      .attr("font-weight", "600")
      .attr("fill", t.muted)
      .attr("letter-spacing", "0.03em")
      .text("NET SPILLOVER");

    // diverging swatch
    const barW = 150, barH = 10;
    const grad = this.svg.select("defs").selectAll("linearGradient#net-legend-grad").data([null]);
    const gradEnter = grad.enter().append("linearGradient").attr("id", "net-legend-grad");
    const gradSel = gradEnter.merge(grad as any);
    gradSel.selectAll("stop").remove();
    gradSel
      .selectAll("stop")
      .data([0, 0.5, 1])
      .join("stop")
      .attr("offset", (s) => `${s * 100}%`)
      .attr("stop-color", (s) => (s < 0.5 ? t.recv : s > 0.5 ? t.send : t.mid));
    g.append("rect").attr("y", 14).attr("width", barW).attr("height", barH).attr("rx", 3).attr("fill", "url(#net-legend-grad)");
    g.append("text").attr("x", 0).attr("y", 40).attr("font-family", FONTS.data).attr("font-size", 10.5).attr("fill", t.secondary).text(`−${maxAbsNet.toFixed(0)}%`);
    g.append("text").attr("x", barW).attr("y", 40).attr("text-anchor", "end").attr("font-family", FONTS.data).attr("font-size", 10.5).attr("fill", t.secondary).text(`+${maxAbsNet.toFixed(0)}%`);
    g.append("text").attr("x", barW / 2).attr("y", 40).attr("text-anchor", "middle").attr("font-family", FONTS.body).attr("font-size", 10).attr("fill", t.muted).text("receiver ↔ sender");

    // node-size legend -- named as a missing piece by the client
    const sizeG = g.append("g").attr("transform", "translate(0,58)");
    sizeG
      .append("text")
      .attr("font-family", FONTS.body)
      .attr("font-size", 11)
      .attr("font-weight", "600")
      .attr("fill", t.muted)
      .attr("letter-spacing", "0.03em")
      .text("NODE SIZE = |NET|");
    const steps = [0.3, 0.6, 1.0];
    const ptToPxLocal = (pt: number) => pt * (SIZE / 700);
    const nodeScale = d.nodeScale ?? 1600;
    let cxAcc = 10;
    steps.forEach((frac) => {
      const areaPt2 = nodeScale * (0.28 + 0.72 * frac);
      const areaPx2 = areaPt2 * ptToPxLocal(1) ** 2 * 0.5;
      const rr = Math.sqrt(Math.max(areaPx2, 5) / Math.PI) * 0.6; // legend scale-down
      sizeG.append("circle").attr("cx", cxAcc).attr("cy", 28).attr("r", rr).attr("fill", t.muted).attr("fill-opacity", 0.5);
      sizeG
        .append("text")
        .attr("x", cxAcc)
        .attr("y", 28 + rr + 13)
        .attr("text-anchor", "middle")
        .attr("font-family", FONTS.data)
        .attr("font-size", 9.5)
        .attr("fill", t.secondary)
        .text(`${Math.round(frac * maxAbsNet)}%`);
      cxAcc += 46;
    });
  }
}

function edgeOpacity(
  e: { i: number; j: number },
  selectedMarket: string | null | undefined,
  selectedPair: [string, string] | null | undefined,
  names: string[]
): number {
  if (!selectedMarket && !selectedPair) return 1;
  if (selectedPair) return selectedPair[0] === names[e.i] && selectedPair[1] === names[e.j] ? 1 : 0.12;
  if (selectedMarket) return names[e.i] === selectedMarket || names[e.j] === selectedMarket ? 1 : 0.1;
  return 1;
}

/** Deterministic pseudo-random value in [-1, 1] from two points, for per-edge jitter -- so
 * parallel/collinear edges fan out instead of stacking exactly on top of each other. */
function edgeHash(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const h = Math.sin(a.x * 12.9898 + a.y * 78.233 + b.x * 37.719 + b.y * 91.317) * 43758.5453;
  return (h - Math.floor(h)) * 2 - 1;
}

/** Rounds the corners of a polyline: trims each segment near its interior joints and bridges
 * them with a quadratic curve through the original joint, so sharp elbows read as soft kinks. */
function roundedPolylinePath(pts: { x: number; y: number }[], cornerRadius: number): string {
  const out: string[] = [`M ${pts[0].x},${pts[0].y}`];
  for (let i = 1; i < pts.length; i++) {
    const isLast = i === pts.length - 1;
    const prev = pts[i - 1];
    const cur = pts[i];
    if (isLast) {
      out.push(`L ${cur.x},${cur.y}`);
      continue;
    }
    const next = pts[i + 1];
    const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y) || 1;
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y) || 1;
    const r = Math.min(cornerRadius, d1 / 2, d2 / 2);
    const p1x = cur.x - ((cur.x - prev.x) / d1) * r;
    const p1y = cur.y - ((cur.y - prev.y) / d1) * r;
    const p2x = cur.x + ((next.x - cur.x) / d2) * r;
    const p2y = cur.y + ((next.y - cur.y) / d2) * r;
    out.push(`L ${p1x},${p1y} Q ${cur.x},${cur.y} ${p2x},${p2y}`);
  }
  return out.join(" ");
}

function trimmed(a: { x: number; y: number }, b: { x: number; y: number }, r: number): { x: number; y: number } {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: a.x + ((b.x - a.x) / d) * r, y: a.y + ((b.y - a.y) / d) * r };
}

/** Elbow route per the client's network reference: straight runs with angular kinks, not a
 * smooth arc. Aligned pairs (same row/column) bow out to the side instead of cutting straight
 * through whatever else shares that row or column; other pairs travel via a jittered lane so
 * they don't run exactly along the grid lines the nodes themselves sit on. */
function kinkedPath(a: { x: number; y: number }, b: { x: number; y: number }, ra: number, rb: number, arrowSizePx: number): string {
  const rbEff = rb + arrowSizePx * 0.5;
  const jitter = edgeHash(a, b);
  const start = trimmed(a, b, ra);

  if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) {
    // aligned -- bow out instead of a straight line through whoever else is on that row/column
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const bow = Math.max(22, dist * 0.1) * (jitter >= 0 ? 1 : -1);
    const mx = (a.x + b.x) / 2 - (bow * dy) / dist;
    const my = (a.y + b.y) / 2 + (bow * dx) / dist;
    const end = trimmed(b, { x: mx, y: my }, rbEff);
    return `M ${start.x},${start.y} Q ${mx},${my} ${end.x},${end.y}`;
  }

  const laneY = a.y + (b.y - a.y) * 0.5 + jitter * 16;
  const end = trimmed(b, { x: b.x, y: laneY }, rbEff);
  const pts = [start, { x: a.x, y: laneY }, { x: b.x, y: laneY }, end];
  return roundedPolylinePath(pts, 16);
}

/** matplotlib connectionstyle="arc3,rad=<rad>": control point at the midpoint, shifted
 * perpendicular to the chord by rad * chord length. Endpoints trimmed to the node boundary
 * along the (approximate) tangent so the arrowhead lands on the circle, not the center. */
function arcPath(a: Pos, b: Pos, ra: number, rb: number, rad: number, arrowSizePx: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mx = (a.x + b.x) / 2 - rad * dy;
  const my = (a.y + b.y) / 2 + rad * dx;
  const ux0 = mx - a.x, uy0 = my - a.y;
  const d0 = Math.hypot(ux0, uy0) || 1;
  const sx = a.x + (ux0 / d0) * ra;
  const sy = a.y + (uy0 / d0) * ra;
  const ux1 = b.x - mx, uy1 = b.y - my;
  const d1 = Math.hypot(ux1, uy1) || 1;
  const rbEff = rb + arrowSizePx * 0.5;
  const ex = b.x - (ux1 / d1) * rbEff;
  const ey = b.y - (uy1 / d1) * rbEff;
  return `M ${sx},${sy} Q ${mx},${my} ${ex},${ey}`;
}
