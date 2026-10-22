/**
 * Port of plot_connectedness_graph + connectedness_graph (src/pyconnectedness/viz/network.py).
 * Faithful to the library's own defaults: nx.circular_layout in notebook order (position
 * carries no meaning -- see CONTEXT.md's style analysis, this is deliberate, not a bug),
 * tab:red/tab:blue nodes at 0.85 alpha, grey edges with small arrowheads on a slight arc3
 * curve, 9pt labels sitting on the nodes, no legend, no axis.
 *
 * One deliberate deviation from the notebook, per CONTEXT.md review finding 5: node area and
 * edge width use a FIXED domain (globalMaxAbsNet / globalMaxAbsPairwise, the max over every
 * rolling window) instead of per-frame maxima, so scrubbing the timeline doesn't make a node
 * grow just because the others shrank.
 */
import * as d3 from "d3";
import { BASELINE } from "../encoding";

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
  onSelectMarket?: (name: string | null) => void;
  onSelectPair?: (pair: [string, string] | null) => void;
  selectedMarket?: string | null;
  selectedPair?: [string, string] | null;
}

const SIZE = 1000; // internal viewBox units (square, like figsize=(X,X))

export class NetworkChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private gEdges: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gNodes: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gLabels: d3.Selection<SVGGElement, unknown, null, undefined>;
  private title: d3.Selection<SVGTextElement, unknown, null, undefined>;

  constructor(host: HTMLElement) {
    this.svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `0 0 ${SIZE} ${SIZE}`)
      .attr("width", "100%")
      .style("display", "block")
      .style("background", BASELINE.figureBg) as any;

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
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", BASELINE.edgeColor);

    this.title = this.svg
      .append("text")
      .attr("x", SIZE / 2)
      .attr("y", BASELINE.titlePx + 3)
      .attr("text-anchor", "middle")
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", BASELINE.titlePx)
      .attr("fill", BASELINE.textColor) as any;

    this.gEdges = this.svg.append("g").attr("class", "edges") as any;
    this.gNodes = this.svg.append("g").attr("class", "nodes") as any;
    this.gLabels = this.svg.append("g").attr("class", "labels") as any;
  }

  render(d: NetworkDatum) {
    const { names, pairwiseNet, net, threshold } = d;
    const k = names.length;
    const nodeScale = d.nodeScale ?? 1600;
    const edgeScale = d.edgeScale ?? 4;

    this.title.text(d.title);

    const cx = SIZE / 2;
    const cy = SIZE / 2 + 20;
    const r = SIZE * 0.38;

    // nx.circular_layout: node i at angle i/k * 2pi, starting at (1,0), counterclockwise in
    // standard math orientation (y-up); negate sin to reproduce that visually in SVG's y-down
    // coordinate system.
    const pos = names.map((_, i) => {
      const theta = (i / k) * 2 * Math.PI;
      return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
    });

    const maxAbsNet = d.globalMaxAbsNet || 1e-9;
    const ptToPxLocal = (pt: number) => pt * (SIZE / 700); // 700px reference canvas ~ 7in*100dpi
    const radii = net.map((v) => {
      const frac = 0.25 + 0.75 * (Math.abs(v) / maxAbsNet);
      const areaPt2 = nodeScale * frac;
      const areaPx2 = areaPt2 * (ptToPxLocal(1) ** 2) * 0.5; // points^2 -> px^2 (matplotlib scatter units), damped to fit viewBox
      return Math.sqrt(Math.max(areaPx2, 4) / Math.PI);
    });

    type Edge = { i: number; j: number; w: number };
    const edges: Edge[] = [];
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        if (i === j) continue;
        const w = pairwiseNet[i][j];
        if (w > threshold) edges.push({ i, j, w });
      }
    }
    const maxAbsPairwise = d.globalMaxAbsPairwise || 1e-9;

    const edgeSel = this.gEdges
      .selectAll<SVGPathElement, Edge>("path")
      .data(edges, (e) => `${e.i}-${e.j}`);
    edgeSel.exit().remove();
    const edgeEnter = edgeSel
      .enter()
      .append("path")
      .attr("fill", "none")
      .attr("stroke", BASELINE.edgeColor)
      .attr("marker-end", "url(#net-arrow)");
    edgeEnter
      .merge(edgeSel as any)
      .attr("stroke-width", (e) => Math.max(0.6, ptToPxLocal((edgeScale * e.w) / maxAbsPairwise)))
      .attr("d", (e) => {
        const a = pos[e.i];
        const b = pos[e.j];
        const rb = radii[e.j] + BASELINE.edgeArrowSizePx * 0.5;
        const ra = radii[e.i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const f = BASELINE.edgeCurveRad;
        const mx = (a.x + b.x) / 2 - f * dy;
        const my = (a.y + b.y) / 2 + f * dx;
        // trim start/end to node boundary along the (approximate) tangent direction
        const ux0 = mx - a.x, uy0 = my - a.y;
        const d0 = Math.hypot(ux0, uy0) || 1;
        const sx = a.x + (ux0 / d0) * ra;
        const sy = a.y + (uy0 / d0) * ra;
        const ux1 = b.x - mx, uy1 = b.y - my;
        const d1 = Math.hypot(ux1, uy1) || 1;
        const ex = b.x - (ux1 / d1) * rb;
        const ey = b.y - (uy1 / d1) * rb;
        void dist;
        return `M ${sx},${sy} Q ${mx},${my} ${ex},${ey}`;
      })
      .style("cursor", "pointer")
      .on("click", (_ev, e) => d.onSelectPair?.([names[e.i], names[e.j]]))
      .attr("opacity", (e) => {
        if (!d.selectedMarket && !d.selectedPair) return 1;
        if (d.selectedPair) return d.selectedPair[0] === names[e.i] && d.selectedPair[1] === names[e.j] ? 1 : 0.12;
        if (d.selectedMarket) return names[e.i] === d.selectedMarket || names[e.j] === d.selectedMarket ? 1 : 0.1;
        return 1;
      });

    const nodeSel = this.gNodes.selectAll<SVGCircleElement, number>("circle").data(d3.range(k));
    nodeSel.exit().remove();
    const nodeEnter = nodeSel.enter().append("circle").style("cursor", "pointer");
    nodeEnter
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
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", BASELINE.networkLabelPx)
      .attr("fill", BASELINE.textColor)
      .style("pointer-events", "none")
      .merge(labelSel as any)
      .attr("x", (i) => pos[i].x)
      .attr("y", (i) => pos[i].y)
      .text((i) => names[i]);
  }
}
