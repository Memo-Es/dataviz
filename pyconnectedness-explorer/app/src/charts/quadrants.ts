/**
 * Graph 2 as coordinates: every market placed by what it passes on (`directional_to`, up) and
 * what it takes in (`directional_from`, right), both straight from the library.
 * - the diagonal is net = 0: above it a market passes on more than it takes (a net transmitter),
 *   below it takes more; how far it sits from the diagonal is its net;
 * - the two cross-lines sit at the spillover index itself (`total`), which is the average of
 *   both TO and FROM over all markets, so the chart is centred on the index;
 * - the four quadrants have names: Sources (pass on a lot, take in little), Hubs (both), Sinks
 *   (take in a lot, pass on little), Bystanders (little of either);
 * - the strongest 10% of flows (the library's connectedness_graph rule) are straight ink arrows
 *   between the points, heavier and darker with `pairwise_net`.
 * Axes are fixed across every week (domains from main.ts), so a market drifting between
 * quadrants as the weeks play is real movement, not rescaling.
 */
import * as d3 from "d3";
import type { Frame } from "../model";
import { type Palette, fmtSigned, hueOf } from "../encoding";
import { hideTooltip, showTooltip } from "../tooltip";
import type { NetworkCallbacks } from "./network";

const W = 760;
const H = 700;
const M = { top: 34, right: 28, bottom: 58, left: 70 };
const NODE_MIN = 6;
const NODE_MAX = 16;
const LINE_MIN = 0.9;
const LINE_MAX = 4.5;

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

function tint(hex: string, t: number) {
  const c = d3.color(hex)?.rgb();
  if (!c) return hex;
  return d3.rgb(c.r + (255 - c.r) * t, c.g + (255 - c.g) * t, c.b + (255 - c.b) * t).formatHex();
}

export class QuadrantChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private gFrame: d3.Selection<SVGGElement, unknown, null, undefined>;
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
      .attr("aria-label", "Each market placed by what it passes on (up) and takes in (right), with arrows for the strongest flows");
    this.svg.on("click", (ev) => {
      if (ev.target === this.svg.node()) cb.onSelect(null);
    });
    this.gFrame = this.svg.append("g").attr("class", "q-frame");
    this.gEdges = this.svg.append("g").attr("class", "edges");
    this.gNodes = this.svg.append("g").attr("class", "nodes");
  }

  render(
    frame: Frame,
    p: Palette,
    maxNet: number,
    maxPair: number,
    focus: string | null,
    selected: string | null,
    duration = 0,
    pair: [string, string] | null = null,
    ink = p.fg,
    domains: { to: [number, number]; from: [number, number] } = { to: [0, 100], from: [0, 100] }
  ) {
    const tr = <S extends d3.Selection<any, any, any, any>>(sel: S): S =>
      (duration > 0 ? sel.transition().duration(duration).ease(d3.easeLinear) : sel.interrupt()) as unknown as S;
    const x = d3.scaleLinear().domain(domains.from).range([M.left, W - M.right]);
    const y = d3.scaleLinear().domain(domains.to).range([H - M.bottom, M.top]);
    const k = this.names.length;
    const pts: Pt[] = this.names.map((name, i) => ({ name, idx: i, x: x(frame.from[i]), y: y(frame.to[i]) }));
    const nodeR = d3.scaleSqrt().domain([0, maxNet]).range([NODE_MIN, NODE_MAX]).clamp(true);
    const weight = d3.scaleSqrt().domain([0, maxPair]).range([LINE_MIN, LINE_MAX]).clamp(true);

    // ---- the frame: grid, axes, the diagonal, the cross at the index, the quadrant names
    const g = this.gFrame;
    g.selectAll("*").remove();
    const xt = x.ticks(6);
    const yt = y.ticks(6);
    g.selectAll("line.gx").data(xt).join("line").attr("class", "gx").attr("x1", (d) => x(d)).attr("x2", (d) => x(d)).attr("y1", M.top).attr("y2", H - M.bottom).attr("stroke", p.grid);
    g.selectAll("line.gy").data(yt).join("line").attr("class", "gy").attr("y1", (d) => y(d)).attr("y2", (d) => y(d)).attr("x1", M.left).attr("x2", W - M.right).attr("stroke", p.grid);
    g.selectAll("text.tx").data(xt).join("text").attr("class", "axis-label tx").attr("x", (d) => x(d)).attr("y", H - M.bottom + 18).attr("text-anchor", "middle").attr("fill", p.muted).text((d) => `${d}`);
    g.selectAll("text.ty").data(yt).join("text").attr("class", "axis-label ty").attr("x", M.left - 10).attr("y", (d) => y(d)).attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", p.muted).text((d) => `${d}`);
    g.append("text").attr("class", "q-axis").attr("x", W - M.right).attr("y", H - 12).attr("text-anchor", "end").attr("fill", p.fg).text("Takes in from others, pp →");
    g.append("text").attr("class", "q-axis").attr("x", 14).attr("y", M.top - 14).attr("fill", p.fg).text("↑ Passes on to others, pp");

    // the diagonal, net = 0, clipped to the plot
    const lo = Math.max(domains.from[0], domains.to[0]);
    const hi = Math.min(domains.from[1], domains.to[1]);
    if (hi > lo) {
      g.append("line").attr("x1", x(lo)).attr("y1", y(lo)).attr("x2", x(hi)).attr("y2", y(hi)).attr("stroke", p.fg).attr("stroke-width", 1.2).attr("stroke-dasharray", "5 4").attr("opacity", 0.75);
      const at = lo + (hi - lo) * 0.18;
      g.append("text").attr("class", "q-note").attr("x", x(at) + 10).attr("y", y(at) + 16).attr("fill", p.fg).text("net = 0: above it, passes on more");
    }
    // the cross at the index: the average of both axes
    const cx = x(frame.total);
    const cy = y(frame.total);
    g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", M.top).attr("y2", H - M.bottom).attr("stroke", p.axis).attr("stroke-width", 1.5);
    g.append("line").attr("x1", M.left).attr("x2", W - M.right).attr("y1", cy).attr("y2", cy).attr("stroke", p.axis).attr("stroke-width", 1.5);
    g.append("text").attr("class", "q-note").attr("x", cx + 6).attr("y", H - M.bottom - 8).attr("fill", p.fg).text(`index ${frame.total.toFixed(1)}%`);
    const corner = (tx: number, ty: number, anchor: string, name: string, sub: string) => {
      const t = g.append("text").attr("class", "q-name").attr("x", tx).attr("y", ty).attr("text-anchor", anchor).attr("fill", p.fg);
      t.append("tspan").attr("font-weight", 700).text(name);
      t.append("tspan").attr("x", tx).attr("dy", "1.25em").attr("class", "q-sub").text(sub);
    };
    corner(M.left + 10, M.top + 18, "start", "Sources", "pass on a lot, take in little");
    corner(W - M.right - 10, M.top + 18, "end", "Hubs", "pass on and take in a lot");
    corner(M.left + 10, H - M.bottom - 40, "start", "Bystanders", "little of either");
    corner(W - M.right - 10, H - M.bottom - 40, "end", "Sinks", "take in a lot, pass on little");

    // ---- the flows
    const focusIdx = focus ? this.names.indexOf(focus) : -1;
    const pairIdx = pair && focusIdx < 0 ? pair.map((n) => this.names.indexOf(n)) : null;
    const isPair = (e: Edge) =>
      !!pairIdx && ((e.s === pairIdx[0] && e.r === pairIdx[1]) || (e.s === pairIdx[1] && e.r === pairIdx[0]));
    const edges: Edge[] = [];
    for (let s = 0; s < k; s++)
      for (let r = 0; r < k; r++) if (frame.matrix[s][r] > frame.threshold) edges.push({ s, r, v: frame.matrix[s][r] });
    edges.sort((a, b) => a.v - b.v);
    const style = (e: Edge) => {
      if (pairIdx) return isPair(e) ? { c: p.accent, op: 1 } : { c: ink, op: 0.05 };
      // nothing picked: no arrows. Markets lie along one band here (those passing on a lot also take
      // in a lot), so all the flows would bundle into one sheaf; a market's own flows read clearly
      if (focusIdx < 0) return { c: ink, op: 0 };
      return e.s === focusIdx || e.r === focusIdx ? { c: ink, op: 1 } : { c: ink, op: 0.05 };
    };
    const shape = (e: Edge) => {
      const a = pts[e.s];
      const b = pts[e.r];
      const w = weight(e.v);
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / L;
      const uy = (b.y - a.y) / L;
      const rs = nodeR(Math.abs(frame.net[e.s])) + 3;
      const rr = nodeR(Math.abs(frame.net[e.r])) + 3;
      const headLen = 6 + w * 1.6;
      const headW = 3.5 + w * 1.1;
      const s0: [number, number] = [a.x + ux * rs, a.y + uy * rs];
      const tip: [number, number] = [b.x - ux * rr, b.y - uy * rr];
      const base: [number, number] = [tip[0] - ux * headLen, tip[1] - uy * headLen];
      const f = ([px, py]: [number, number]) => `${px.toFixed(1)},${py.toFixed(1)}`;
      return {
        line: `M${f(s0)}L${f(base)}`,
        head: `M${f(tip)}L${f([base[0] - uy * headW, base[1] + ux * headW])}L${f([base[0] + uy * headW, base[1] - ux * headW])}Z`,
      };
    };
    const joined = this.gEdges.selectAll<SVGGElement, Edge>("g.edge:not(.exiting)").data(edges, (e) => `${e.s}-${e.r}`);
    const leaving = joined.exit().classed("exiting", true).on("mousemove", null);
    if (duration > 0) leaving.transition().duration(duration).ease(d3.easeLinear).style("opacity", 0).remove();
    else leaving.remove();
    const entering = joined.enter().append("g").attr("class", "edge").style("opacity", 0);
    entering.append("path").attr("class", "hit");
    entering.append("path").attr("class", "line");
    entering.append("path").attr("class", "head");
    const edgeSel = entering.merge(joined);
    edgeSel.select<SVGPathElement>("path.hit").attr("d", (e) => shape(e).line).attr("fill", "none").attr("stroke", "transparent").attr("stroke-width", 12);
    tr(edgeSel.select<SVGPathElement>("path.line"))
      .attr("d", (e: Edge) => shape(e).line)
      .attr("fill", "none")
      .attr("stroke", (e: Edge) => style(e).c)
      .attr("stroke-width", (e: Edge) => weight(e.v))
      .attr("stroke-linecap", "round");
    tr(edgeSel.select<SVGPathElement>("path.head")).attr("d", (e: Edge) => shape(e).head).attr("fill", (e: Edge) => style(e).c);
    tr(edgeSel).style("opacity", (e: Edge) => style(e).op);
    edgeSel
      .on("mousemove", (ev: MouseEvent, e) => {
        showTooltip(ev.clientX, ev.clientY, `${this.names[e.s]} → ${this.names[e.r]}`, [
          { label: "Net flow", value: `${e.v.toFixed(2)} pp` },
          { label: "Cut-off (strongest 10%)", value: `${frame.threshold.toFixed(2)} pp` },
        ]);
      })
      .on("mouseleave", hideTooltip)
      .on("click", (ev: MouseEvent, e) => {
        ev.stopPropagation();
        this.cb.onPair(this.names[e.s], this.names[e.r]);
      })
      .order();

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
    nodes.attr("aria-label", (d) => `${d.name}: passes on ${frame.to[d.idx].toFixed(1)}, takes in ${frame.from[d.idx].toFixed(1)}, net ${fmtSigned(frame.net[d.idx])}`);
    tr(nodes).attr("transform", (d: Pt) => `translate(${d.x},${d.y})`);
    nodes.select<SVGCircleElement>("circle.hit").attr("r", NODE_MAX + 4).attr("fill", "transparent");
    nodes
      .select<SVGCircleElement>("circle.dot")
      .style("opacity", (d) => (lit(d) ? 1 : 0.28))
      .attr("fill", (d) => (sends(d) ? hueOf(d.name) : tint(hueOf(d.name), 0.72)))
      .attr("stroke", (d) => (d.name === selected ? p.fg : sends(d) ? p.panel : hueOf(d.name)))
      .attr("stroke-width", (d) => (d.name === selected ? 3 : 2));
    tr(nodes.select<SVGCircleElement>("circle.dot")).attr("r", (d: Pt) => nodeR(Math.abs(frame.net[d.idx])));
    // a label to the right of each market, else to its left; where neither is free (a dense
    // cluster) the name is left to the hover, the tooltip and the bars beside the chart
    const boxes: { x0: number; x1: number; y0: number; y1: number }[] = pts.map((q) => {
      const r = nodeR(Math.abs(frame.net[q.idx]));
      return { x0: q.x - r, x1: q.x + r, y0: q.y - r, y1: q.y + r };
    });
    const hit = (b: { x0: number; x1: number; y0: number; y1: number }) =>
      boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    const side = new Map<string, "r" | "l" | null>();
    const focusName = focus ?? selected;
    for (const q of [...pts].sort((a, b) => Math.abs(frame.net[b.idx]) - Math.abs(frame.net[a.idx]))) {
      const w = q.name.length * 6.4 + 4;
      const r = nodeR(Math.abs(frame.net[q.idx])) + 4;
      const right = { x0: q.x + r, x1: q.x + r + w, y0: q.y - 7, y1: q.y + 7 };
      const left = { x0: q.x - r - w, x1: q.x - r, y0: q.y - 7, y1: q.y + 7 };
      const pick = q.name === focusName ? (right.x1 < W ? right : left) : !hit(right) && right.x1 < W ? right : !hit(left) && left.x0 > M.left ? left : null;
      side.set(q.name, pick === right ? "r" : pick === left ? "l" : null);
      if (pick) boxes.push(pick);
    }
    nodes
      .select<SVGTextElement>("text.node-label")
      .attr("x", (d) => (side.get(d.name) === "l" ? -(nodeR(Math.abs(frame.net[d.idx])) + 4) : nodeR(Math.abs(frame.net[d.idx])) + 4))
      .attr("y", 4)
      .attr("text-anchor", (d) => (side.get(d.name) === "l" ? "end" : "start"))
      .attr("visibility", (d) => (side.get(d.name) ? "visible" : "hidden"))
      .attr("fill", p.fg)
      .attr("font-weight", (d) => (d.name === selected || d.idx === focusIdx ? 700 : 500))
      .text((d) => d.name);
  }
}
