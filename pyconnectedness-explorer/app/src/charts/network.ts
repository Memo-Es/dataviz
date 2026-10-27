/**
 * "Who passes shocks to whom": the connectedness network, drawn from the same rule as the
 * library's connectedness_graph() -- one link per pair, from net transmitter to net receiver,
 * keeping only flows above the strongest-10% cut-off (notebook cells 19/21) -- on a ring ordered
 * so it reads without decoding:
 * - markets that pass on more (net > 0) go round the top half, the strongest at the left; markets
 *   that take in more go round the bottom half, the biggest receivers at the left. Every arrow
 *   runs from the top half to the bottom half, so direction reads at a glance and the ring is also
 *   a ranking. A line across the middle names the two halves. Markets glide round as weeks play.
 * - flat circles in the region's colour (after the transit-map reference): solid if a market
 *   passes on more, a light tint with a thin outline in its colour if it takes more; sized by
 *   |net|. Each is labelled with its name and net value.
 * - ink arrows whose width grows with the flow (`pairwise_net`), on one scale across every week.
 *   Only the strongest few are drawn until a market is picked (then all of its flows), so the
 *   picture never turns into a hairball; "all" draws every flow above the library's cut-off.
 * - a faint square grid behind, as in the reference.
 * Scales are fixed across every week, so scrubbing or playing never rescales the picture.
 */
import * as d3 from "d3";
import type { Frame } from "../model";
import { type Palette, WASH, fmtSigned, hueOf, wash } from "../encoding";
import { hideTooltip, showTooltip } from "../tooltip";

const SIZE = 760;
const C = SIZE / 2;
const R = 232; // the ring
const NODE_MIN = 7;
const NODE_MAX = 20;
const LINE_MIN = 1.2;
const LINE_MAX = 6.5;
const GAP = 0.2; // radians left empty at 3 and 9 o'clock, between the halves
const BEND = 0.3; // how far a link bows toward the centre
const CELL = 38; // the background grid

interface Pos {
  name: string;
  idx: number;
  angle: number;
  x: number;
  y: number;
  top: boolean;
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
  private gGrid: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gEdges: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gNodes: d3.Selection<SVGGElement, unknown, null, undefined>;
  private byIdx: Pos[] = [];

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
      .attr("aria-label", "Ring of markets: those passing on more along the top, those taking in more along the bottom, with arrows for the strongest flows");
    this.svg.on("click", (ev) => {
      if (ev.target === this.svg.node()) cb.onSelect(null);
    });
    this.gGrid = this.svg.append("g").attr("class", "grid");
    this.gEdges = this.svg.append("g").attr("class", "edges");
    this.gNodes = this.svg.append("g").attr("class", "nodes");
  }

  /** this frame's ring: transmitters over the top, left to right by net; receivers under the
   * bottom, the biggest receivers at the left */
  private layout(frame: Frame): Pos[] {
    const idx = this.names.map((_, i) => i);
    const up = idx.filter((i) => frame.net[i] >= 0).sort((a, b) => frame.net[b] - frame.net[a]);
    const down = idx.filter((i) => frame.net[i] < 0).sort((a, b) => frame.net[a] - frame.net[b]);
    const place = (list: number[], from: number, to: number, top: boolean) =>
      list.map((i, k) => {
        const angle = list.length === 1 ? (from + to) / 2 : from + ((to - from) * (k + 0.5)) / list.length;
        return { name: this.names[i], idx: i, angle, x: C + R * Math.cos(angle), y: C + R * Math.sin(angle), top };
      });
    // top half: from 9 o'clock over 12 to 3 o'clock; bottom half: from 9 o'clock under 6 to 3
    return [...place(up, Math.PI + GAP, 2 * Math.PI - GAP, true), ...place(down, Math.PI - GAP, GAP, false)];
  }

  private drawGrid(p: Palette) {
    this.gGrid.selectAll("*").remove();
    const g = this.gGrid;
    const lines = d3.range(CELL / 2, SIZE, CELL);
    g.selectAll("line.v").data(lines).join("line").attr("class", "v").attr("x1", (x) => x).attr("x2", (x) => x).attr("y1", 0).attr("y2", SIZE).attr("stroke", p.grid);
    g.selectAll("line.h").data(lines).join("line").attr("class", "h").attr("y1", (y) => y).attr("y2", (y) => y).attr("x1", 0).attr("x2", SIZE).attr("stroke", p.grid);
    // the middle: passes on more above, takes in more below
    g.append("line").attr("x1", C - R - 70).attr("x2", C + R + 70).attr("y1", C).attr("y2", C).attr("stroke", p.axis).attr("stroke-width", 1.5);
    g.append("text").attr("class", "net-side").attr("x", 14).attr("y", C - 10).attr("fill", p.fg).text("↑ passes on more");
    g.append("text").attr("class", "net-side").attr("x", 14).attr("y", C + 22).attr("fill", p.fg).text("↓ takes in more");
  }

  /** a curve from a to b bowed toward the centre, trimmed at both circles, plus the arrowhead at b */
  private link(e: Edge, rs: number, rr: number, w: number): { line: string; head: string; mid: [number, number] } {
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
    const len = Math.hypot(b.x - a.x, b.y - a.y) * 1.06 || 1;
    const headLen = 6 + w * 1.6;
    const headW = 3.5 + w * 1.1;
    const t0 = Math.min(0.4, (rs + 3) / len);
    const tTip = 1 - Math.min(0.4, (rr + 3) / len);
    const tBase = Math.max(t0 + 0.02, tTip - headLen / len);
    const n = 20;
    const f = ([x, y]: [number, number]) => `${x.toFixed(1)},${y.toFixed(1)}`;
    const line = `M${d3.range(n + 1).map((i) => f(at(t0 + ((tBase - t0) * i) / n))).join("L")}`;
    const tip = at(tTip);
    const base = at(tBase);
    const L = Math.hypot(tip[0] - base[0], tip[1] - base[1]) || 1;
    const ux = (tip[0] - base[0]) / L;
    const uy = (tip[1] - base[1]) / L;
    const head = `M${f(tip)}L${f([base[0] - uy * headW, base[1] + ux * headW])}L${f([base[0] + uy * headW, base[1] - ux * headW])}Z`;
    return { line, head, mid: at(0.5) };
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
    ink = p.fg,
    /** how many of the strongest flows to draw when no market is picked; null: all of them */
    limit: number | null = 10
  ) {
    const tr = <S extends d3.Selection<any, any, any, any>>(sel: S): S =>
      (duration > 0 ? sel.transition().duration(duration).ease(d3.easeLinear) : sel.interrupt()) as unknown as S;
    this.drawGrid(p);
    const pos = this.layout(frame);
    this.byIdx = [];
    for (const q of pos) this.byIdx[q.idx] = q;
    const k = this.names.length;
    const nodeR = d3.scaleSqrt().domain([0, maxNet]).range([NODE_MIN, NODE_MAX]).clamp(true);
    // width from the cut-off up to the strongest flow in any week: the step between widths is
    // the step between flows, and the scale never moves as the weeks change
    const weight = d3.scaleLinear().domain([frame.threshold, maxPair]).range([LINE_MIN, LINE_MAX]).clamp(true);
    const focusIdx = focus ? this.names.indexOf(focus) : -1;
    const pairIdx = pair && focusIdx < 0 ? pair.map((n) => this.names.indexOf(n)) : null;
    const isPair = (e: Edge) =>
      !!pairIdx && ((e.s === pairIdx[0] && e.r === pairIdx[1]) || (e.s === pairIdx[1] && e.r === pairIdx[0]));

    // every flow above the library's cut-off; which of them are drawn depends on what's picked
    const all: Edge[] = [];
    for (let s = 0; s < k; s++)
      for (let r = 0; r < k; r++) if (frame.matrix[s][r] > frame.threshold) all.push({ s, r, v: frame.matrix[s][r] });
    all.sort((a, b) => a.v - b.v); // strongest on top
    const edges = pairIdx
      ? all.filter(isPair)
      : focusIdx >= 0
        ? all.filter((e) => e.s === focusIdx || e.r === focusIdx)
        : limit === null
          ? all
          : all.slice(-limit);
    // weaker arrows a little lighter, so the widest read first; all of them dark enough to follow
    const strength = d3.scaleLinear().domain([frame.threshold, maxPair]).range([edges.length > 20 ? 0.3 : 0.55, 1]).clamp(true);

    const style = (e: Edge) => (pairIdx ? { c: p.accent, op: 1 } : { c: ink, op: strength(e.v) });
    const shape = (e: Edge) => this.link(e, nodeR(Math.abs(frame.net[e.s])), nodeR(Math.abs(frame.net[e.r])), weight(e.v));

    const joined = this.gEdges.selectAll<SVGGElement, Edge>("g.edge:not(.exiting)").data(edges, (e) => `${e.s}-${e.r}`);
    const leaving = joined.exit().classed("exiting", true).on("mousemove", null);
    if (duration > 0) leaving.transition().duration(duration).ease(d3.easeLinear).style("opacity", 0).remove();
    else leaving.remove();
    const entering = joined.enter().append("g").attr("class", "edge").style("opacity", 0);
    entering.append("path").attr("class", "hit");
    entering.append("path").attr("class", "line");
    entering.append("path").attr("class", "head");
    entering.append("text").attr("class", "edge-value");
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
    // the three strongest flows carry their value, like the reference's numbered stops
    edgeSel
      .select<SVGTextElement>("text.edge-value")
      .attr("x", (e) => shape(e).mid[0])
      .attr("y", (e) => shape(e).mid[1])
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("fill", p.fg)
      .text(""); // values on arrows collided where they cross: names carry the net, the tooltip the flow
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
      for (const e of all) {
        if (e.s === focusIdx) linked.add(e.r);
        if (e.r === focusIdx) linked.add(e.s);
      }
    }

    const nodes = this.gNodes
      .selectAll<SVGGElement, Pos>("g.node")
      .data(pos, (d) => d.name)
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
    tr(nodes).attr("transform", (d: Pos) => `translate(${d.x},${d.y})`);
    // fade the circles that aren't linked, never their names: text keeps its 7:1 (WCAG AAA)
    const lit = (d: Pos) => (focusIdx < 0 && !pairIdx) || linked.has(d.idx);
    nodes.select<SVGCircleElement>("circle.hit").attr("r", NODE_MAX + 6).attr("fill", "transparent");
    nodes
      .select<SVGCircleElement>("circle.dot")
      .style("opacity", (d) => (lit(d) ? 1 : 0.28))
      // soft fills, the full hue on the edge: deeper for a transmitter, paler for a receiver
      .attr("fill", (d) => wash(hueOf(d.name), d.top ? WASH.send : WASH.recv))
      .attr("stroke", (d) => (d.name === selected ? p.fg : hueOf(d.name)))
      .attr("stroke-width", (d) => (d.name === selected ? 3 : 1.75));
    tr(nodes.select<SVGCircleElement>("circle.dot")).attr("r", (d: Pos) => nodeR(Math.abs(frame.net[d.idx])));
    // the name and its net, outside the ring: above on the top half, below on the bottom half
    // near 12 and 6 o'clock the circles sit closest: alternate those labels between two rows
    const rank = new Map<string, number>();
    for (const half of [true, false]) pos.filter((q) => q.top === half).forEach((q, i) => rank.set(q.name, i));
    const off = (d: Pos) => NODE_MAX + 16 + (Math.abs(Math.cos(d.angle)) < 0.5 && rank.get(d.name)! % 2 ? 20 : 0);
    nodes
      .select<SVGTextElement>("text.node-label")
      .attr("x", (d) => off(d) * Math.cos(d.angle))
      .attr("y", (d) => off(d) * Math.sin(d.angle))
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => {
        const c = Math.cos(d.angle);
        return c > 0.3 ? "start" : c < -0.3 ? "end" : "middle";
      })
      .attr("fill", p.fg)
      .attr("font-weight", (d) => (d.name === selected || d.idx === focusIdx ? 700 : 500))
      .text((d) => `${d.name} ${fmtSigned(frame.net[d.idx])}`);
  }
}
