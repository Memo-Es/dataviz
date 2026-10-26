/**
 * "Who passes shocks to whom": the connectedness network, drawn from the same rule as the
 * library's connectedness_graph() -- one link per pair, from net transmitter to net receiver,
 * keeping only flows above the strongest-10% cut-off (notebook cells 19/21) -- laid out like a
 * transit map on a grid:
 * - a market's height is its net position (`net`): above the middle line it passes on more than
 *   it takes, below it takes more. Shocks run downhill, and markets climb and sink as the weeks
 *   play, like graph 1. Columns are regions; each market keeps its region's colour.
 * - every link is an ink line running straight and at 45 degrees, from sender to receiver, ending
 *   in an arrowhead at the receiver; its weight and its arrowhead grow with the flow
 *   (`pairwise_net`), on one scale across every week.
 * Positions snap to the grid's crossings; a market whose crossing is taken moves to the nearest
 * free one in its region's columns.
 */
import * as d3 from "d3";
import type { Frame } from "../model";
import { type Palette, REGION_OF, REGION_ORDER, fmtSigned, regionOrder, hueOf } from "../encoding";
import { hideTooltip, showTooltip } from "../tooltip";

const CELL = 40;
const W = 720;
const TOP = 54; // room for the region names
const ROWS = 15; // grid rows: net from +max (top) to -max (bottom)
const H = TOP + ROWS * CELL + 24;
const NODE_R = 13;
const LINE_MIN = 1.2;
const LINE_MAX = 5.5;

interface Pos {
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
  private order: string[];
  /** each region's grid columns (x of the crossings) */
  private lanes = new Map<string, number[]>();
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
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("role", "img")
      .attr("aria-label", "Map of the strongest net spillovers: higher markets pass on more, lines run from sender to receiver");
    this.svg.on("click", (ev) => {
      if (ev.target === this.svg.node()) cb.onSelect(null);
    });
    this.gGrid = this.svg.append("g").attr("class", "grid");
    this.gEdges = this.svg.append("g").attr("class", "edges");
    this.gNodes = this.svg.append("g").attr("class", "nodes");
    this.order = regionOrder(names);

    // columns: markets stand on every other grid line (two cells apart, so names have room);
    // each region gets a share of those in proportion to its size, at least two, with a gap
    // of one between regions
    const regions = REGION_ORDER.filter((g) => names.some((n) => REGION_OF[n] === g));
    // grid lines two cells apart, leaving room on the right for the last column's names
    const slots = Math.floor((W - CELL - 110) / (2 * CELL)) + 1;
    const usable = slots - (regions.length - 1);
    const counts = regions.map((g) => names.filter((n) => REGION_OF[n] === g).length);
    const sum = d3.sum(counts);
    const share = counts.map((c) => Math.max(2, Math.round((c / sum) * usable)));
    while (d3.sum(share) > usable) share[share.indexOf(d3.max(share)!)]--;
    let col = 0;
    regions.forEach((g, i) => {
      this.lanes.set(g, d3.range(share[i]).map((k) => CELL / 2 + CELL / 2 + (col + k) * 2 * CELL));
      col += share[i] + 1;
    });
  }

  /** where each market sits this frame: its net on the rows, its region on the columns */
  private layout(frame: Frame, maxNet: number): Pos[] {
    const row = d3.scaleLinear().domain([maxNet, -maxNet]).range([0, ROWS]).clamp(true);
    const taken = new Set<string>();
    const out: Pos[] = [];
    // the strongest positions claim their crossing first
    const byStrength = [...this.order].sort((a, b) => Math.abs(frame.net[this.names.indexOf(b)]) - Math.abs(frame.net[this.names.indexOf(a)]));
    for (const name of byStrength) {
      const idx = this.names.indexOf(name);
      const lane = this.lanes.get(REGION_OF[name])!;
      const want = Math.round(row(frame.net[idx]));
      let spot: [number, number] | null = null;
      // nearest free crossing: same row first (any of the region's columns), then a row away...
      for (let d = 0; d <= ROWS && !spot; d++)
        for (const r of d === 0 ? [want] : [want - d, want + d]) {
          if (r < 0 || r > ROWS || spot) continue;
          const mid = (lane.length - 1) / 2;
          const cols = [...lane.keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
          for (const c of cols) if (!taken.has(`${c}|${r}`)) { spot = [c, r]; break; }
        }
      const [c, r] = spot ?? [0, want];
      taken.add(`${c}|${r}`);
      out.push({ name, idx, x: lane[c], y: TOP + r * CELL });
    }
    return out;
  }

  private drawGrid(p: Palette) {
    this.gGrid.selectAll("*").remove();
    const g = this.gGrid;
    const xs = d3.range(CELL / 2, W, CELL);
    const ys = d3.range(0, ROWS + 1).map((r) => TOP + r * CELL);
    g.selectAll("line.v").data(xs).join("line").attr("class", "v").attr("x1", (x) => x).attr("x2", (x) => x).attr("y1", TOP).attr("y2", TOP + ROWS * CELL).attr("stroke", p.grid);
    g.selectAll("line.h").data(ys).join("line").attr("class", "h").attr("x1", CELL / 2).attr("x2", xs[xs.length - 1]).attr("y1", (y) => y).attr("y2", (y) => y).attr("stroke", p.grid);
    // the middle line: passes on more above, takes more below
    const zero = TOP + (ROWS / 2) * CELL;
    g.append("line").attr("x1", CELL / 2).attr("x2", xs[xs.length - 1]).attr("y1", zero).attr("y2", zero).attr("stroke", p.axis).attr("stroke-width", 1.5);
    g.append("text").attr("class", "net-side").attr("x", CELL / 2).attr("y", TOP - 8).attr("fill", p.fg).text("↑ passes on more");
    g.append("text").attr("class", "net-side").attr("x", CELL / 2).attr("y", TOP + ROWS * CELL + 18).attr("fill", p.fg).text("↓ takes in more");
    for (const [region, lane] of this.lanes) {
      g.append("text")
        .attr("class", "region-label")
        .attr("x", (lane[0] + lane[lane.length - 1]) / 2)
        .attr("y", TOP - 30)
        .attr("text-anchor", "middle")
        .attr("fill", p.fg)
        .text(region.toUpperCase());
    }
  }

  /** a transit-map route: 45 degrees until level with the receiver, then straight; trimmed at
   * both circles; returns the line and the arrowhead at the receiver */
  private route(a: Pos, b: Pos, w: number): { line: string; head: string } {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const diag = Math.min(Math.abs(dx), Math.abs(dy));
    const bend: [number, number] = [a.x + Math.sign(dx) * diag, a.y + Math.sign(dy) * diag];
    const far = (p: [number, number], q: [number, number]) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 1;
    const A: [number, number] = [a.x, a.y];
    const B: [number, number] = [b.x, b.y];
    const pts: [number, number][] = far(A, bend) && far(bend, B) ? [A, bend, B] : [A, B];
    const toward = (p: [number, number], q: [number, number], by: number): [number, number] => {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      return [p[0] + ((q[0] - p[0]) * by) / L, p[1] + ((q[1] - p[1]) * by) / L];
    };
    const headLen = 6 + w * 1.6;
    const headW = 3.5 + w * 1.2;
    const prev = pts[pts.length - 2];
    const start = toward(A, pts[1], NODE_R + 3);
    const tip = toward(B, prev, NODE_R + 3);
    const base = toward(tip, prev, headLen);
    const f = ([x, y]: [number, number]) => `${x.toFixed(1)},${y.toFixed(1)}`;
    const line = pts.length === 3 ? `M${f(start)}L${f(bend)}L${f(base)}` : `M${f(start)}L${f(base)}L${f(base)}`;
    const ux = (tip[0] - base[0]) / headLen;
    const uy = (tip[1] - base[1]) / headLen;
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
    this.drawGrid(p);
    const pos = this.layout(frame, maxNet);
    this.byIdx = [];
    for (const q of pos) this.byIdx[q.idx] = q;
    const k = this.names.length;
    const weight = d3.scaleSqrt().domain([0, maxPair]).range([LINE_MIN, LINE_MAX]).clamp(true);
    const focusIdx = focus ? this.names.indexOf(focus) : -1;
    const pairIdx = pair && focusIdx < 0 ? pair.map((n) => this.names.indexOf(n)) : null;
    const isPair = (e: Edge) =>
      !!pairIdx && ((e.s === pairIdx[0] && e.r === pairIdx[1]) || (e.s === pairIdx[1] && e.r === pairIdx[0]));

    const edges: Edge[] = [];
    for (let s = 0; s < k; s++)
      for (let r = 0; r < k; r++) if (frame.matrix[s][r] > frame.threshold) edges.push({ s, r, v: frame.matrix[s][r] });
    edges.sort((a, b) => a.v - b.v); // strongest on top

    const edgeStyle = (e: Edge) => {
      if (pairIdx) return isPair(e) ? { c: p.accent, op: 1 } : { c: ink, op: 0.08 };
      if (focusIdx < 0) return { c: ink, op: 0.85 };
      return e.s === focusIdx || e.r === focusIdx ? { c: ink, op: 1 } : { c: ink, op: 0.08 };
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
    const shape = (e: Edge) => this.route(this.byIdx[e.s], this.byIdx[e.r], weight(e.v));
    edgeSel.select<SVGPathElement>("path.hit").attr("d", (e) => shape(e).line).attr("fill", "none").attr("stroke", "transparent").attr("stroke-width", 14);
    tr(edgeSel.select<SVGPathElement>("path.line"))
      .attr("d", (e: Edge) => shape(e).line)
      .attr("fill", "none")
      .attr("stroke", (e: Edge) => edgeStyle(e).c)
      .attr("stroke-width", (e: Edge) => weight(e.v))
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round");
    tr(edgeSel.select<SVGPathElement>("path.head"))
      .attr("d", (e: Edge) => shape(e).head)
      .attr("fill", (e: Edge) => edgeStyle(e).c);
    tr(edgeSel).style("opacity", (e: Edge) => edgeStyle(e).op);
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
    nodes.select<SVGCircleElement>("circle.hit").attr("r", CELL / 2).attr("fill", "transparent");
    // region colour; a net transmitter is a solid circle, a net receiver a ring
    const sends = (d: Pos) => frame.net[d.idx] >= 0;
    nodes
      .select<SVGCircleElement>("circle.dot")
      .attr("r", NODE_R)
      .style("opacity", (d) => (lit(d) ? 1 : 0.28))
      .attr("fill", (d) => (sends(d) ? hueOf(d.name) : p.panel))
      .attr("stroke", (d) => (d.name === selected ? p.fg : hueOf(d.name)))
      .attr("stroke-width", (d) => (d.name === selected ? 3.5 : sends(d) ? 0 : 3.5));
    nodes
      .select<SVGTextElement>("text.node-label")
      .attr("x", NODE_R * 0.7)
      .attr("y", NODE_R + 12)
      .attr("fill", p.fg)
      .attr("font-weight", (d) => (d.name === selected || d.idx === focusIdx ? 700 : 500))
      .text((d) => d.name);
  }
}
