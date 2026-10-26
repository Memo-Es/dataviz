/**
 * "Who passes shocks to whom": the connectedness network, drawn from the same rule as the
 * library's connectedness_graph() -- one link per pair, from net transmitter to net receiver,
 * keeping only flows above the strongest-10% cut-off (notebook cells 19/21) -- on a ring:
 * - markets sit around the circle grouped by region, under an arc in the region's colour; each
 *   wears its region's colour, solid if it passes on more than it takes, a ring if it takes more;
 *   its size is how far it leans either way (|net|);
 * - every link is an ink curve from sender to receiver, ending in an arrowhead at the receiver;
 *   its weight, its arrowhead and its darkness all grow with the flow (`pairwise_net`), so the big
 *   transfers come forward and the small ones recede;
 * - names sit outside the ring and the regions are named in the legend, so no text lies on a line.
 * Scales are fixed across every week, so scrubbing or playing never rescales the picture.
 */
import * as d3 from "d3";
import type { Frame } from "../model";
import { type Palette, REGION_OF, REGION_ORDER, fmtSigned, regionOrder, hueOf } from "../encoding";
import { hideTooltip, showTooltip } from "../tooltip";

const SIZE = 760;
const C = SIZE / 2;
const R = 228; // the ring
const NODE_MIN = 6;
const NODE_MAX = 19;
const LINE_MIN = 1.2;
const LINE_MAX = 6.5;
const GAP_SLOTS = 1.6; // empty slots between regions
const BEND = 0.35; // how far a link bows toward the centre

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
  onPair(sender: string, receiver: string): void;
}

export class NetworkChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private gRegions: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gEdges: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gNodes: d3.Selection<SVGGElement, unknown, null, undefined>;
  private pos: Pos[];
  private byIdx: Pos[] = [];
  private slots: number;

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
      .attr("aria-label", "Ring of markets with arrows for the strongest net spillovers, from sender to receiver");
    this.svg.on("click", (ev) => {
      if (ev.target === this.svg.node()) cb.onSelect(null);
    });
    this.gRegions = this.svg.append("g").attr("class", "regions");
    this.gEdges = this.svg.append("g").attr("class", "edges");
    this.gNodes = this.svg.append("g").attr("class", "nodes");

    const order = regionOrder(names);
    const regions = REGION_ORDER.filter((g) => names.some((n) => REGION_OF[n] === g));
    this.slots = order.length + GAP_SLOTS * Math.max(1, regions.length);
    let slot = GAP_SLOTS / 2;
    let prev = REGION_OF[order[0]];
    this.pos = order.map((name) => {
      if (REGION_OF[name] !== prev) {
        slot += GAP_SLOTS;
        prev = REGION_OF[name];
      }
      const angle = -Math.PI / 2 + (slot / this.slots) * 2 * Math.PI;
      slot += 1;
      return { name, idx: names.indexOf(name), angle, x: C + R * Math.cos(angle), y: C + R * Math.sin(angle) };
    });
    for (const p of this.pos) this.byIdx[p.idx] = p;
  }

  /** each region: an arc in its colour just outside its markets (named in the legend, so no text
   * competes with the market names around the ring) */
  private drawRegions(_p: Palette) {
    this.gRegions.selectAll("*").remove();
    const regions = REGION_ORDER.filter((g) => this.names.some((n) => REGION_OF[n] === g));
    if (regions.length < 2) return;
    const rr = R + NODE_MAX + 8;
    const pad = (0.45 / this.slots) * 2 * Math.PI;
    const pt = (a: number, rad: number) => [C + rad * Math.cos(a), C + rad * Math.sin(a)];
    for (const region of regions) {
      const members = this.pos.filter((q) => REGION_OF[q.name] === region);
      const a0 = members[0].angle - pad;
      const a1 = members[members.length - 1].angle + pad;
      const [x0, y0] = pt(a0, rr);
      const [x1, y1] = pt(a1, rr);
      this.gRegions
        .append("path")
        .attr("d", `M${x0},${y0} A${rr},${rr} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`)
        .attr("fill", "none")
        .attr("stroke", hueOf(members[0].name))
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round");
    }
  }

  /** a curve from a to b bowed toward the centre, trimmed at both circles, plus the arrowhead at b */
  private link(e: Edge, rs: number, rr: number, w: number): { line: string; head: string } {
    const a = this.byIdx[e.s];
    const b = this.byIdx[e.r];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const cx = mx + (C - mx) * BEND;
    const cy = my + (C - my) * BEND;
    const at = (t: number): [number, number] => {
      const u = 1 - t;
      return [u * u * a.x + 2 * u * t * cx + t * t * b.x, u * u * a.y + 2 * u * t * cy + t * t * b.y];
    };
    // where the curve leaves the sender, meets the arrowhead's base, and touches the receiver
    const len = Math.hypot(b.x - a.x, b.y - a.y) * 1.08 || 1;
    const headLen = 7 + w * 1.7;
    const headW = 4 + w * 1.25;
    const t0 = Math.min(0.4, (rs + 3) / len);
    const tTip = 1 - Math.min(0.4, (rr + 3) / len);
    const tBase = Math.max(t0 + 0.02, tTip - headLen / len);
    const n = 20;
    const pts = d3.range(n + 1).map((i) => at(t0 + ((tBase - t0) * i) / n));
    const f = ([x, y]: [number, number]) => `${x.toFixed(1)},${y.toFixed(1)}`;
    const line = `M${pts.map(f).join("L")}`;
    const tip = at(tTip);
    const base = at(tBase);
    const L = Math.hypot(tip[0] - base[0], tip[1] - base[1]) || 1;
    const ux = (tip[0] - base[0]) / L;
    const uy = (tip[1] - base[1]) / L;
    const head = `M${f(tip)}L${f([base[0] - uy * headW, base[1] + ux * headW])}L${f([base[0] + uy * headW, base[1] - ux * headW])}Z`;
    return { line, head };
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
    duration = 0,
    pair: [string, string] | null = null,
    ink = p.fg
  ) {
    const tr = <S extends d3.Selection<any, any, any, any>>(sel: S): S =>
      (duration > 0 ? sel.transition().duration(duration).ease(d3.easeLinear) : sel.interrupt()) as unknown as S;
    this.drawRegions(p);
    const k = this.names.length;
    const nodeR = d3.scaleSqrt().domain([0, maxNet]).range([NODE_MIN, NODE_MAX]).clamp(true);
    const weight = d3.scaleSqrt().domain([0, maxPair]).range([LINE_MIN, LINE_MAX]).clamp(true);
    const strength = d3.scaleLinear().domain([frame.threshold, maxPair]).range([0.45, 1]).clamp(true);
    const focusIdx = focus ? this.names.indexOf(focus) : -1;
    const pairIdx = pair && focusIdx < 0 ? pair.map((n) => this.names.indexOf(n)) : null;
    const isPair = (e: Edge) =>
      !!pairIdx && ((e.s === pairIdx[0] && e.r === pairIdx[1]) || (e.s === pairIdx[1] && e.r === pairIdx[0]));

    const edges: Edge[] = [];
    for (let s = 0; s < k; s++)
      for (let r = 0; r < k; r++) if (frame.matrix[s][r] > frame.threshold) edges.push({ s, r, v: frame.matrix[s][r] });
    edges.sort((a, b) => a.v - b.v); // strongest on top

    const style = (e: Edge) => {
      if (pairIdx) return isPair(e) ? { c: p.accent, op: 1 } : { c: ink, op: 0.06 };
      if (focusIdx < 0) return { c: ink, op: strength(e.v) };
      return e.s === focusIdx || e.r === focusIdx ? { c: ink, op: 1 } : { c: ink, op: 0.06 };
    };
    const shape = (e: Edge) => this.link(e, nodeR(Math.abs(frame.net[e.s])), nodeR(Math.abs(frame.net[e.r])), weight(e.v));

    const joined = this.gEdges.selectAll<SVGGElement, Edge>("g.edge:not(.exiting)").data(edges, (e) => `${e.s}-${e.r}`);
    const leaving = joined.exit().classed("exiting", true).on("mousemove", null);
    if (duration > 0) leaving.transition().duration(duration).ease(d3.easeLinear).style("opacity", 0).remove();
    else leaving.remove();
    const entering = joined.enter().append("g").attr("class", "edge").style("opacity", 0);
    entering.append("path").attr("class", "hit");
    entering.append("path").attr("class", "line");
    entering.append("path").attr("class", "head");
    const edgeSel = entering.merge(joined);
    edgeSel.select<SVGPathElement>("path.hit").attr("d", (e) => shape(e).line).attr("fill", "none").attr("stroke", "transparent").attr("stroke-width", 14);
    tr(edgeSel.select<SVGPathElement>("path.line"))
      .attr("d", (e: Edge) => shape(e).line)
      .attr("fill", "none")
      .attr("stroke", (e: Edge) => style(e).c)
      .attr("stroke-width", (e: Edge) => weight(e.v))
      .attr("stroke-linecap", "round");
    tr(edgeSel.select<SVGPathElement>("path.head"))
      .attr("d", (e: Edge) => shape(e).head)
      .attr("fill", (e: Edge) => style(e).c);
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

    const linked = new Set<number>(pairIdx ?? []);
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
    // fade the circles that aren't linked, never their names: text keeps its 7:1 (WCAG AAA)
    const lit = (d: Pos) => (focusIdx < 0 && !pairIdx) || linked.has(d.idx);
    const sends = (d: Pos) => frame.net[d.idx] >= 0;
    nodes.select<SVGCircleElement>("circle.hit").attr("cx", (d) => d.x).attr("cy", (d) => d.y).attr("r", NODE_MAX + 6).attr("fill", "transparent");
    const dots = nodes.select<SVGCircleElement>("circle.dot").attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    dots
      .style("opacity", (d) => (lit(d) ? 1 : 0.28))
      .attr("fill", (d) => (sends(d) ? hueOf(d.name) : p.panel))
      .attr("stroke", (d) => (d.name === selected ? p.fg : hueOf(d.name)))
      .attr("stroke-width", (d) => (d.name === selected ? 3.5 : sends(d) ? 0 : 3));
    tr(dots).attr("r", (d: Pos) => nodeR(Math.abs(frame.net[d.idx])));
    nodes
      .select<SVGTextElement>("text.node-label")
      .attr("x", (d) => C + (R + NODE_MAX + 20) * Math.cos(d.angle))
      .attr("y", (d) => C + (R + NODE_MAX + 20) * Math.sin(d.angle))
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => {
        const c = Math.cos(d.angle);
        return c > 0.25 ? "start" : c < -0.25 ? "end" : "middle";
      })
      .attr("fill", p.fg)
      .attr("font-weight", (d) => (d.name === selected || d.idx === focusIdx ? 700 : 500))
      .text((d) => d.name);
  }
}
