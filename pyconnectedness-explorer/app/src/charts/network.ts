/**
 * "Who sends risk to whom": the connectedness network, drawn from the same rule as the
 * library's connectedness_graph() -- one edge per pair, from net transmitter to net receiver,
 * keeping only flows above the strongest-10% cut-off (notebook cells 19/21).
 *
 * Changes from plot_connectedness_graph, all for readability (CONTEXT.md's style analysis):
 * - markets sit on the circle grouped by region, so position means something;
 * - edges taper from sender to receiver, so direction reads without hunting for arrowheads;
 * - node size and edge width use fixed domains across every week (review finding 5), so
 *   scrubbing or playing never rescales the picture.
 */
import * as d3 from "d3";
import type { Frame } from "../model";
import { type Palette, REGION_OF, REGION_ORDER, fmtSigned, regionOrder } from "../encoding";
import { hideTooltip, showTooltip } from "../tooltip";

const SIZE = 720;
const C = SIZE / 2;
const R = 220; // node ring radius
const NODE_MIN = 5;
const NODE_MAX = 22;
const EDGE_MAX = 11;
const GAP_SLOTS = 1.4; // empty slots between regions

interface Pos {
  name: string;
  idx: number;
  angle: number;
  x: number;
  y: number;
}

interface Edge {
  s: number;
  r: number;
  v: number;
}

export interface NetworkCallbacks {
  onHover(name: string | null): void;
  onSelect(name: string | null): void;
}

export class NetworkChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private gEdges: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gNodes: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gRegions: d3.Selection<SVGGElement, unknown, null, undefined>;
  private pos: Pos[];
  private byIdx: Pos[];

  constructor(
    host: HTMLElement,
    private names: string[],
    private cb: NetworkCallbacks
  ) {
    this.svg = d3
      .select(host)
      .append("svg")
      .attr("class", "network")
      .attr("viewBox", `0 0 ${SIZE} ${SIZE}`)
      .attr("role", "img")
      .attr("aria-label", "Network of the strongest net spillovers between markets");
    this.svg.on("click", (ev) => {
      if (ev.target === this.svg.node()) cb.onSelect(null);
    });
    this.gEdges = this.svg.append("g").attr("class", "edges");
    this.gRegions = this.svg.append("g").attr("class", "regions");
    this.gNodes = this.svg.append("g").attr("class", "nodes");

    const order = regionOrder(names);
    const slots = order.length + GAP_SLOTS * REGION_ORDER.length;
    let slot = GAP_SLOTS / 2;
    let prevRegion = REGION_OF[order[0]];
    this.pos = order.map((name) => {
      if (REGION_OF[name] !== prevRegion) {
        slot += GAP_SLOTS;
        prevRegion = REGION_OF[name];
      }
      const angle = -Math.PI / 2 + (slot / slots) * 2 * Math.PI;
      slot += 1;
      return { name, idx: names.indexOf(name), angle, x: C + R * Math.cos(angle), y: C + R * Math.sin(angle) };
    });
    this.byIdx = [];
    for (const p of this.pos) this.byIdx[p.idx] = p;
    this.drawRegions(slots);
  }

  private drawRegions(slots: number) {
    const rr = R + NODE_MAX + 7;
    for (const region of REGION_ORDER) {
      const members = this.pos.filter((p) => REGION_OF[p.name] === region);
      const pad = (0.5 / slots) * 2 * Math.PI;
      const a0 = members[0].angle - pad;
      const a1 = members[members.length - 1].angle + pad;
      const mid = (a0 + a1) / 2;
      const pt = (a: number, rad: number) => [C + rad * Math.cos(a), C + rad * Math.sin(a)];
      const [x0, y0] = pt(a0, rr);
      const [x1, y1] = pt(a1, rr);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      this.gRegions
        .append("path")
        .attr("class", "region-arc")
        .attr("d", `M${x0},${y0} A${rr},${rr} 0 ${large} 1 ${x1},${y1}`);
      // name sits just inside the ring, at the region's middle, with a halo over the edges
      const [tx, ty] = pt(mid, R - NODE_MAX - 46);
      this.gRegions
        .append("text")
        .attr("class", "region-label")
        .attr("x", tx)
        .attr("y", ty)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(region.toUpperCase());
    }
  }

  /** `duration` > 0 animates a change of week/window (play, scrub); 0 for hover, selection or
   * theme changes, which should feel instant. Scales stay fixed either way. */
  render(
    frame: Frame,
    p: Palette,
    maxNet: number,
    maxPair: number,
    focus: string | null,
    selected: string | null,
    duration = 0
  ) {
    // apply attributes now, or through a linear transition of `duration` ms (frames arrive at a
    // steady rate while playing, so linear reads as continuous motion, not a series of eases)
    const tr = <S extends d3.Selection<any, any, any, any>>(sel: S): S =>
      // an instant update (hover, selection) must cancel a running frame transition, or the
      // transition's end values would overwrite it a few ms later
      (duration > 0 ? sel.transition().duration(duration).ease(d3.easeLinear) : sel.interrupt()) as unknown as S;
    const k = this.names.length;
    const nodeR = d3.scaleSqrt().domain([0, maxNet]).range([NODE_MIN, NODE_MAX]).clamp(true);
    const width = d3.scaleLinear().domain([0, maxPair]).range([1, EDGE_MAX]).clamp(true);
    const focusIdx = focus ? this.names.indexOf(focus) : -1;

    const edges: Edge[] = [];
    for (let s = 0; s < k; s++)
      for (let r = 0; r < k; r++) if (frame.matrix[s][r] > frame.threshold) edges.push({ s, r, v: frame.matrix[s][r] });
    edges.sort((a, b) => a.v - b.v); // strongest on top

    const edgeStyle = (e: Edge) => {
      if (focusIdx < 0) return { fill: p.secondary, op: 0.42 };
      if (e.s === focusIdx) return { fill: p.send, op: 0.85 };
      if (e.r === focusIdx) return { fill: p.recv, op: 0.85 };
      return { fill: p.secondary, op: 0.07 };
    };

    const shape = (e: Edge) =>
      this.taper(e, nodeR(Math.abs(frame.net[e.s])), nodeR(Math.abs(frame.net[e.r])), width(e.v));
    const joined = this.gEdges
      .selectAll<SVGPathElement, Edge>("path:not(.exiting)")
      .data(edges, (e) => `${e.s}-${e.r}`);
    // links that drop out of the strongest 10% fade out rather than vanish
    const leaving = joined.exit().classed("exiting", true).on("mousemove", null);
    if (duration > 0) leaving.transition().duration(duration).ease(d3.easeLinear).attr("fill-opacity", 0).remove();
    else leaving.remove();
    // links that join start where they'll be, transparent, and fade in
    const entering = joined.enter().append("path").attr("d", shape).attr("fill-opacity", 0);
    const edgeSel = entering.merge(joined);
    edgeSel.attr("fill", (e) => edgeStyle(e).fill);
    tr(edgeSel).attr("d", shape).attr("fill-opacity", (e: Edge) => edgeStyle(e).op);
    edgeSel
      .on("mousemove", (ev: MouseEvent, e) => {
        showTooltip(ev.clientX, ev.clientY, `${this.names[e.s]} → ${this.names[e.r]}`, [
          { label: "Net flow", value: `${e.v.toFixed(2)} pp` },
          { label: "Cut-off (strongest 10%)", value: `${frame.threshold.toFixed(2)} pp` },
        ]);
      })
      .on("mouseleave", hideTooltip)
      .order();

    const linked = new Set<number>();
    if (focusIdx >= 0) {
      linked.add(focusIdx);
      for (const e of edges) {
        if (e.s === focusIdx) linked.add(e.r);
        if (e.r === focusIdx) linked.add(e.s);
      }
    }

    const nodes = this.gNodes
      .selectAll<SVGGElement, Pos>("g.node")
      .data(this.pos, (d) => d.name)
      .join((enter) => {
        const g = enter.append("g").attr("class", "node").attr("tabindex", 0).attr("role", "button");
        g.append("circle").attr("class", "hit");
        g.append("circle").attr("class", "dot");
        g.append("text").attr("class", "node-label");
        g.on("mouseenter", (_ev, d) => this.cb.onHover(d.name))
          .on("mouseleave", () => {
            this.cb.onHover(null);
            hideTooltip();
          })
          .on("click", (ev, d) => {
            ev.stopPropagation();
            this.cb.onSelect(d.name);
          })
          .on("keydown", (ev: KeyboardEvent, d) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              this.cb.onSelect(d.name);
            }
          });
        return g;
      });

    nodes.attr("aria-label", (d) => `${d.name}, net ${fmtSigned(frame.net[d.idx])} percentage points`);
    nodes.style("opacity", (d) => (focusIdx < 0 || linked.has(d.idx) ? 1 : 0.28));
    nodes
      .select<SVGCircleElement>("circle.hit")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", NODE_MAX + 4)
      .attr("fill", "transparent");
    const dots = nodes
      .select<SVGCircleElement>("circle.dot")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y);
    tr(dots)
      .attr("r", (d: Pos) => nodeR(Math.abs(frame.net[d.idx])))
      .attr("fill", (d: Pos) => (frame.net[d.idx] >= 0 ? p.send : p.recv));
    dots
      .attr("stroke", (d) => (d.name === selected ? p.fg : p.panel))
      .attr("stroke-width", (d) => (d.name === selected ? 2.5 : 1.5));
    nodes
      .select<SVGTextElement>("text.node-label")
      .attr("x", (d) => C + (R + NODE_MAX + 22) * Math.cos(d.angle))
      .attr("y", (d) => C + (R + NODE_MAX + 22) * Math.sin(d.angle))
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => {
        const c = Math.cos(d.angle);
        return c > 0.25 ? "start" : c < -0.25 ? "end" : "middle";
      })
      .attr("font-weight", (d) => (d.name === selected || d.idx === focusIdx ? 700 : 500))
      .text((d) => d.name);
  }

  /** A filled, tapered quadratic curve from sender s to receiver r, bent toward the centre. */
  private taper(e: Edge, rs: number, rr: number, w: number): string {
    const a = this.byIdx[e.s];
    const b = this.byIdx[e.r];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const cx = mx + (C - mx) * 0.55;
    const cy = my + (C - my) * 0.55;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t0 = Math.min(0.45, (rs + 2) / len);
    const t1 = 1 - Math.min(0.45, (rr + 3) / len);
    const n = 24;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n;
      const u = 1 - t;
      const x = u * u * a.x + 2 * u * t * cx + t * t * b.x;
      const y = u * u * a.y + 2 * u * t * cy + t * t * b.y;
      const dx = 2 * u * (cx - a.x) + 2 * t * (b.x - cx);
      const dy = 2 * u * (cy - a.y) + 2 * t * (b.y - cy);
      const dl = Math.hypot(dx, dy) || 1;
      const half = (w * (1 - i / n) + 0.6 * (i / n)) / 2;
      left.push([x - (dy / dl) * half, y + (dx / dl) * half]);
      right.push([x + (dy / dl) * half, y - (dx / dl) * half]);
    }
    const pts = left.concat(right.reverse());
    return `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;
  }
}
