/**
 * Graph 2 as quadrants, both axes centred on zero (after relative rotation graphs):
 * - right of 0, a market passes on more than it takes in (`net` > 0); left, it takes in more;
 * - above 0, its net has risen over the last quarter (13 weeks, or the dataset's equivalent);
 *   below, it has fallen. Both come from the library's rolling `net`; the change is a difference
 *   of two of its values.
 * So the four quadrants are phases a market moves through: rising transmitters, fading
 * transmitters, deepening receivers, recovering receivers. (TO against FROM was tried first:
 * markets there lie along one band, those passing on a lot also taking in a lot, leaving two
 * quadrants empty. These two axes are nearly independent, so all four fill.)
 * A hovered or picked market shows its trail over the last quarter and its arrows (the strongest
 * 10% of flows, the library's connectedness_graph rule). Axes are fixed across every week.
 */
import * as d3 from "d3";
import type { Frame } from "../model";
import { type Palette, WASH, fmtSigned, hueOf, wash } from "../encoding";
import { flowPath, flowWidth } from "./flow";
import { hideTooltip, showTooltip } from "../tooltip";
import type { NetworkCallbacks } from "./network";

const W = 760;
const H = 700;
const M = { top: 34, right: 28, bottom: 58, left: 70 };
const NODE_R = 9;

export interface QuadOptions {
  /** each item's change in net over `lag` steps, at the step on show */
  change: number[];
  /** each item's path over the last `lag` steps: [net, change] pairs, oldest first */
  trails: [number, number][][];
  /** symmetric axis half-ranges, fixed across every step */
  xMax: number;
  yMax: number;
  lag: number;
  steps: string;
}

interface Pt {
  name: string;
  idx: number;
  x: number;
  y: number;
}

interface Edge {
  s: number;
  r: number;
  v: number;
}


export class QuadrantChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private gFrame: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gTrail: d3.Selection<SVGGElement, unknown, null, undefined>;
  /** the trail's "a quarter ago" note, above the market labels so none of them covers it */
  private gNote: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gEdges: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gNodes: d3.Selection<SVGGElement, unknown, null, undefined>;

  constructor(
    host: HTMLElement,
    private names: string[],
    private cb: NetworkCallbacks
  ) {
    this.svg = d3
      .select(host)
      .append("svg")
      .attr("class", "quadrants")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("role", "img")
      .attr("aria-label", "Each market placed by its net position (right passes on more) and how that changed over the last quarter (up rising)");
    this.svg.on("click", (ev) => {
      if (ev.target === this.svg.node()) cb.onSelect(null);
    });
    this.gFrame = this.svg.append("g").attr("class", "q-frame");
    this.gTrail = this.svg.append("g").attr("class", "q-trail");
    this.gEdges = this.svg.append("g").attr("class", "edges");
    this.gNodes = this.svg.append("g").attr("class", "nodes");
    this.gNote = this.svg.append("g").attr("class", "q-trail-note").attr("pointer-events", "none");
  }

  render(
    frame: Frame,
    p: Palette,
    maxPair: number,
    focus: string | null,
    selected: string | null,
    duration: number,
    pair: [string, string] | null,
    ink: string,
    o: QuadOptions
  ) {
    const tr = <S extends d3.Selection<any, any, any, any>>(sel: S): S =>
      (duration > 0 ? sel.transition().duration(duration).ease(d3.easeLinear) : sel.interrupt()) as unknown as S;
    // clamped: the rare values past the axis ends sit on the edge (the tooltip has the true number)
    const x = d3.scaleLinear().domain([-o.xMax, o.xMax]).range([M.left, W - M.right]).clamp(true);
    const y = d3.scaleLinear().domain([-o.yMax, o.yMax]).range([H - M.bottom, M.top]).clamp(true);
    const k = this.names.length;
    const pts: Pt[] = this.names.map((name, i) => ({ name, idx: i, x: x(frame.net[i]), y: y(o.change[i]) }));
    // pointed lines, on the ring's scale (charts/flow.ts)
    const weight = (v: number) => flowWidth(v, maxPair);

    // ---- the frame: grid, the two zero lines, the axis names, the four phases
    const g = this.gFrame;
    g.selectAll("*").remove();
    const xt = x.ticks(8);
    const yt = y.ticks(8);
    const signed = (d: number) => (d > 0 ? `+${d}` : `${d}`);
    g.selectAll("line.gx").data(xt).join("line").attr("class", "gx").attr("x1", (d) => x(d)).attr("x2", (d) => x(d)).attr("y1", M.top).attr("y2", H - M.bottom).attr("stroke", p.grid);
    g.selectAll("line.gy").data(yt).join("line").attr("class", "gy").attr("y1", (d) => y(d)).attr("y2", (d) => y(d)).attr("x1", M.left).attr("x2", W - M.right).attr("stroke", p.grid);
    g.selectAll("text.tx").data(xt).join("text").attr("class", "axis-label tx").attr("x", (d) => x(d)).attr("y", H - M.bottom + 18).attr("text-anchor", "middle").attr("fill", p.muted).text(signed);
    g.selectAll("text.ty").data(yt).join("text").attr("class", "axis-label ty").attr("x", M.left - 10).attr("y", (d) => y(d)).attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", p.muted).text(signed);
    g.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", M.top).attr("y2", H - M.bottom).attr("stroke", p.fg).attr("stroke-width", 1.4).attr("opacity", 0.7);
    g.append("line").attr("x1", M.left).attr("x2", W - M.right).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", p.fg).attr("stroke-width", 1.4).attr("opacity", 0.7);
    g.append("text").attr("class", "q-axis").attr("x", M.left).attr("y", H - 12).attr("fill", p.fg).text("← takes in more");
    g.append("text").attr("class", "q-axis").attr("x", (M.left + W - M.right) / 2).attr("y", H - 12).attr("text-anchor", "middle").attr("fill", p.fg).text("Net position, pp");
    g.append("text").attr("class", "q-axis").attr("x", W - M.right).attr("y", H - 12).attr("text-anchor", "end").attr("fill", p.fg).text("passes on more →");
    g.append("text").attr("class", "q-axis").attr("x", 14).attr("y", M.top - 14).attr("fill", p.fg).text(`↑ net rising over the last ${o.lag} ${o.steps} · ↓ falling`);
    const corner = (tx: number, ty: number, anchor: string, name: string, sub: string) => {
      const t = g.append("text").attr("class", "q-name").attr("x", tx).attr("y", ty).attr("text-anchor", anchor).attr("fill", p.fg);
      t.append("tspan").attr("font-weight", 700).text(name);
      t.append("tspan").attr("x", tx).attr("dy", "1.25em").attr("class", "q-sub").text(sub);
    };
    corner(W - M.right - 10, M.top + 18, "end", "Rising transmitters", "passing on more and more");
    corner(W - M.right - 10, H - M.bottom - 40, "end", "Fading transmitters", "still passing on, less than before");
    corner(M.left + 10, H - M.bottom - 40, "start", "Deepening receivers", "taking in more and more");
    corner(M.left + 10, M.top + 18, "start", "Recovering receivers", "still taking in, less than before");

    // ---- the trail and the flows of the hovered or picked market (or pair)
    const focusIdx = focus ? this.names.indexOf(focus) : -1;
    const pairIdx = pair && focusIdx < 0 ? pair.map((n) => this.names.indexOf(n)) : null;
    const trailOf = focusIdx >= 0 ? [focusIdx] : pairIdx ?? [];
    // straight between the samples: a smoothed curve rounds the turns and overshoots, inventing
    // loops the data doesn't have
    const line = d3.line<[number, number]>().x((d) => x(d[0])).y((d) => y(d[1]));
    this.gTrail.selectAll("*").remove();
    this.gNote.selectAll("*").remove();
    for (const i of trailOf) {
      const path = o.trails[i];
      if (!path || path.length < 2) continue;
      // a trail through time, not a flow: a thin dotted line, a dot at each sample, fading from
      // a quarter ago to now, so it never reads like the arrows
      const hue = hueOf(this.names[i]);
      this.gTrail.append("path").attr("d", line(path)).attr("fill", "none").attr("stroke", hue).attr("stroke-width", 1.5).attr("stroke-dasharray", "1 4").attr("stroke-linecap", "round");
      path.forEach((q, j) =>
        this.gTrail.append("circle").attr("cx", x(q[0])).attr("cy", y(q[1])).attr("r", 2.4).attr("fill", hue).attr("opacity", 0.3 + (0.7 * j) / Math.max(1, path.length - 1))
      );
      // where it was a quarter ago, named on a backing so nearby markets never cover it
      const label = `${o.lag} ${o.steps} ago`;
      const lx = x(path[0][0]) + 8;
      const ly = y(path[0][1]) + 4;
      this.gTrail.append("circle").attr("cx", x(path[0][0])).attr("cy", y(path[0][1])).attr("r", 4).attr("fill", p.panel).attr("stroke", hue).attr("stroke-width", 2);
      this.gNote.append("rect").attr("x", lx - 3).attr("y", ly - 12).attr("width", label.length * 6.4 + 6).attr("height", 16).attr("rx", 4).attr("fill", p.panel).attr("fill-opacity", 0.94);
      this.gNote.append("text").attr("class", "q-note").attr("x", lx).attr("y", ly).attr("fill", p.fg).text(label);
    }

    const isPair = (e: Edge) =>
      !!pairIdx && ((e.s === pairIdx[0] && e.r === pairIdx[1]) || (e.s === pairIdx[1] && e.r === pairIdx[0]));
    const edges: Edge[] = [];
    for (let s = 0; s < k; s++)
      for (let r = 0; r < k; r++) if (frame.matrix[s][r] > frame.threshold) edges.push({ s, r, v: frame.matrix[s][r] });
    edges.sort((a, b) => a.v - b.v);
    const style = (e: Edge) => {
      if (pairIdx) return isPair(e) ? { c: p.accent, op: 1 } : { c: ink, op: 0 };
      if (focusIdx < 0) return { c: ink, op: 0 };
      return e.s === focusIdx || e.r === focusIdx ? { c: ink, op: 1 } : { c: ink, op: 0 };
    };
    // straight, from the sender's edge to a point at the receiver's edge
    const shape = (e: Edge) => {
      const a = pts[e.s];
      const b = pts[e.r];
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const at = (t: number): [number, number] => [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t];
      return flowPath(at, Math.min(0.3, (NODE_R + 1) / L), 1 - Math.min(0.4, (NODE_R + 2) / L), weight(e.v), 2);
    };
    const joined = this.gEdges.selectAll<SVGGElement, Edge>("g.edge").data(edges, (e) => `${e.s}-${e.r}`);
    joined.exit().remove();
    const entering = joined.enter().append("g").attr("class", "edge").style("opacity", 0);
    entering.append("path").attr("class", "line");
    const edgeSel = entering.merge(joined);
    tr(edgeSel.select<SVGPathElement>("path.line"))
      .attr("d", (e: Edge) => shape(e))
      .attr("fill", (e: Edge) => style(e).c)
      .attr("stroke", p.panel)
      .attr("stroke-width", 1.5)
      .attr("stroke-linejoin", "round")
      .attr("paint-order", "stroke"); // the outline sits behind the fill: it parts lines that cross without thinning them
    edgeSel.style("pointer-events", "none");
    tr(edgeSel).style("opacity", (e: Edge) => style(e).op);

    // ---- the markets
    const linked = new Set<number>(pairIdx ?? []);
    if (focusIdx >= 0) {
      linked.add(focusIdx);
      for (const e of edges) {
        if (e.s === focusIdx) linked.add(e.r);
        if (e.r === focusIdx) linked.add(e.s);
      }
    }
    const lit = (d: Pt) => (focusIdx < 0 && !pairIdx) || linked.has(d.idx);
    const sends = (d: Pt) => frame.net[d.idx] >= 0;
    const nodes = this.gNodes
      .selectAll<SVGGElement, Pt>("g.node")
      .data(pts, (d) => d.name)
      .join((enter) => {
        const n = enter.append("g").attr("class", "node").attr("tabindex", 0).attr("role", "button");
        n.append("circle").attr("class", "hit");
        n.append("circle").attr("class", "dot");
        n.append("text").attr("class", "node-label");
        n.on("mouseenter", (_ev, d) => this.cb.onHover(d.name))
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
        return n;
      });
    // the tooltip reads this frame's values, so it's (re)bound every render
    nodes.on("mousemove", (ev: MouseEvent, d) =>
      showTooltip(ev.clientX, ev.clientY, d.name, [
        { label: "Net position", value: `${fmtSigned(frame.net[d.idx])} pp` },
        { label: `Change over ${o.lag} ${o.steps}`, value: `${fmtSigned(o.change[d.idx])} pp` },
      ])
    );
    nodes.attr("aria-label", (d) => `${d.name}: net ${fmtSigned(frame.net[d.idx])}, ${fmtSigned(o.change[d.idx])} over ${o.lag} ${o.steps}`);
    tr(nodes).attr("transform", (d: Pt) => `translate(${d.x},${d.y})`);
    nodes.select<SVGCircleElement>("circle.hit").attr("r", NODE_R + 6).attr("fill", "transparent");
    nodes
      .select<SVGCircleElement>("circle.dot")
      .attr("r", NODE_R)
      .style("opacity", (d) => (lit(d) ? 1 : 0.28))
      .attr("fill", (d) => wash(hueOf(d.name), sends(d) ? WASH.send : WASH.recv))
      .attr("stroke", (d) => (d.name === selected ? p.fg : hueOf(d.name)))
      .attr("stroke-width", (d) => (d.name === selected ? 3 : 2));

    // a label to the right of each market, else to its left; where neither is free the name is
    // left to the hover and the tooltip
    const boxes = pts.map((q) => ({ x0: q.x - NODE_R, x1: q.x + NODE_R, y0: q.y - NODE_R, y1: q.y + NODE_R }));
    const hit = (b: { x0: number; x1: number; y0: number; y1: number }) =>
      boxes.some((c) => b.x0 < c.x1 && b.x1 > c.x0 && b.y0 < c.y1 && b.y1 > c.y0);
    const side = new Map<string, "r" | "l" | null>();
    const keep = focus ?? selected;
    for (const q of [...pts].sort((a, b) => Math.abs(frame.net[b.idx]) - Math.abs(frame.net[a.idx]))) {
      const w = q.name.length * 6.4 + 4;
      const r = NODE_R + 4;
      const right = { x0: q.x + r, x1: q.x + r + w, y0: q.y - 7, y1: q.y + 7 };
      const left = { x0: q.x - r - w, x1: q.x - r, y0: q.y - 7, y1: q.y + 7 };
      const pick = q.name === keep ? (right.x1 < W ? right : left) : !hit(right) && right.x1 < W ? right : !hit(left) && left.x0 > M.left ? left : null;
      side.set(q.name, pick === right ? "r" : pick === left ? "l" : null);
      if (pick) boxes.push(pick);
    }
    nodes
      .select<SVGTextElement>("text.node-label")
      .attr("x", (d) => (side.get(d.name) === "l" ? -(NODE_R + 4) : NODE_R + 4))
      .attr("y", 4)
      .attr("text-anchor", (d) => (side.get(d.name) === "l" ? "end" : "start"))
      .attr("visibility", (d) => (side.get(d.name) ? "visible" : "hidden"))
      .attr("fill", p.fg)
      .attr("font-weight", (d) => (d.name === selected || d.idx === focusIdx ? 700 : 500))
      .text((d) => d.name);
  }
}
