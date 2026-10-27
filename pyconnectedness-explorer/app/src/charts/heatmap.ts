/**
 * Net pairwise matrix (spillover_heatmap, notebook cells 18/21/28) as a dot matrix: a pale circle
 * in every cell, and each pair drawn once, in its sender's row. pairwise_net is antisymmetric
 * (row→column is minus column→row), so the other half adds nothing.
 *   - a dot at (row, column): the row passes more to the column than it gets back;
 *   - its area: how much more (pairwise_net, pp), on one scale across every step;
 *   - its colour: the sender's region, the same colours as graph 1;
 *   - a dark ring: above the strongest-link cut-off, so the matrix and the network visibly
 *     describe the same links.
 */
import * as d3 from "d3";
import type { Frame } from "../model";
import { type Palette, REGION_OF, WASH, regionOrder, wash } from "../encoding";
import { hideTooltip, showTooltip } from "../tooltip";

const CELL = 22;
const LEFT = 92;
const TOP = 92;
const R = CELL / 2 - 1.5; // the pale circle, and the largest dot

interface Cell {
  r: number;
  c: number;
  v: number;
}

export class HeatmapChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private order: string[];

  constructor(
    host: HTMLElement,
    private names: string[],
    private onHover: (n: string | null) => void,
    private onSelect: (n: string) => void,
    private onPair: (row: string, col: string) => void
  ) {
    this.order = regionOrder(names);
    const n = names.length;
    const S = LEFT + n * CELL + 8;
    this.svg = d3
      .select(host)
      .append("svg")
      .attr("class", "heatmap")
      .attr("viewBox", `0 0 ${S} ${TOP + n * CELL + 8}`)
      .attr("role", "img")
      .attr("aria-label", "Dot matrix of net pairwise spillovers: a dot where the row passes more to the column than it gets back");
  }

  /** `hueOf`: the colour of an item's region (graph 1's palette); `base`: the pale cell circle */
  render(
    frame: Frame,
    p: Palette,
    maxPair: number,
    focus: string | null,
    pair: [string, string] | null = null,
    hueOf: (name: string) => string = () => p.send,
    base = p.band
  ) {
    const n = this.order.length;
    const idx = this.order.map((name) => this.names.indexOf(name));
    const cells: Cell[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push({ r, c, v: frame.matrix[idx[r]][idx[c]] });
    // area proportional to the flow; one scale across every step (the global max)
    const rad = d3.scaleSqrt().domain([0, maxPair]).range([0, R]).clamp(true);
    const focusPos = focus ? this.order.indexOf(focus) : -1;
    const pr = pair ? this.order.indexOf(pair[0]) : -1;
    const pc = pair ? this.order.indexOf(pair[1]) : -1;
    const picked = (d: Cell) => (d.r === pr && d.c === pc) || (d.r === pc && d.c === pr);
    const opacity = (d: Cell) =>
      focusPos >= 0
        ? d.r === focusPos || d.c === focusPos ? 1 : 0.25
        : pr >= 0 ? (d.r === pr || d.c === pr || d.r === pc || d.c === pc ? 1 : 0.3) : 1;
    const cx = (d: Cell) => LEFT + d.c * CELL + CELL / 2;
    const cy = (d: Cell) => TOP + d.r * CELL + CELL / 2;

    const g = this.svg
      .selectAll<SVGGElement, Cell>("g.cell")
      .data(cells)
      .join((e) => {
        const gg = e.append("g").attr("class", "cell");
        gg.append("circle").attr("class", "base");
        gg.append("circle").attr("class", "pin");
        gg.append("circle").attr("class", "ring");
        gg.append("circle").attr("class", "dot");
        return gg;
      })
      .attr("opacity", opacity)
      .style("cursor", (d) => (d.r === d.c ? "default" : "pointer"))
      .on("click", (_ev, d) => {
        if (d.r !== d.c) this.onPair(this.order[d.r], this.order[d.c]);
      })
      .on("mousemove", (ev: MouseEvent, d) => {
        if (d.r === d.c) return;
        const s = this.order[d.r];
        const rcv = this.order[d.c];
        const title = d.v >= 0 ? `${s} → ${rcv}` : `${rcv} → ${s}`;
        showTooltip(ev.clientX, ev.clientY, title, [
          { label: "Net flow", value: `${Math.abs(d.v).toFixed(2)} pp` },
          { label: Math.abs(d.v) > frame.threshold ? "Among the strongest 10%" : "Below the cut-off", value: "" },
        ]);
      })
      .on("mouseleave", hideTooltip);

    // every cell: an invisible target to hover, and a pinpoint so the grid reads as a grid; the
    // pale circle each cell used to have made a texture louder than the flows
    void base;
    g.select<SVGCircleElement>("circle.base")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", R)
      .attr("fill", "transparent");
    g.select<SVGCircleElement>("circle.pin")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", (d) => (d.r === d.c || d.v > 0 ? 0 : 1.1)) // only where no dot is drawn
      .attr("fill", p.fg)
      .attr("fill-opacity", 0.22)
      .attr("pointer-events", "none");
    // a ring: the pair is one of the strongest, or the one picked
    g.select<SVGCircleElement>("circle.ring")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", (d) => (d.v > 0 ? rad(d.v) + 2.2 : 0))
      .attr("fill", "none")
      .attr("stroke", (d) => (picked(d) && d.v > 0 ? p.accent : p.fg))
      .attr("stroke-width", (d) => (picked(d) ? 2.2 : 1.4))
      .attr("visibility", (d) => (d.v > 0 && (d.v > frame.threshold || picked(d)) ? "visible" : "hidden"));
    // the dot, in the sender's row only
    g.select<SVGCircleElement>("circle.dot")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", (d) => (d.r !== d.c && d.v > 0 ? rad(d.v) : 0))
      .attr("fill", (d) => wash(hueOf(this.order[d.r]), WASH.dot))
      .attr("stroke", (d) => hueOf(this.order[d.r]))
      .attr("stroke-width", 1);

    const label = (cls: string, horizontal: boolean) =>
      this.svg
        .selectAll<SVGTextElement, string>(`text.${cls}`)
        .data(this.order)
        .join((e) =>
          e
            .append("text")
            .attr("class", `${cls} axis-name`)
            .on("mouseenter", (_e, d) => this.onHover(d))
            .on("mouseleave", () => this.onHover(null))
            .on("click", (_e, d) => this.onSelect(d))
        )
        .attr("font-weight", (d) => (d === focus ? 700 : 500))
        .text((d) => d)
        .each(function (_d, i) {
          const t = d3.select(this);
          if (horizontal) t.attr("x", LEFT - 8).attr("y", TOP + i * CELL + CELL / 2).attr("dy", "0.35em").attr("text-anchor", "end");
          else
            t.attr("text-anchor", "start").attr(
              "transform",
              `translate(${LEFT + i * CELL + CELL / 2 + 3},${TOP - 8}) rotate(-60)`
            );
        });
    label("row-label", true);
    label("col-label", false);

    // region separators: a little air between the groups, no lines
    const breaks: number[] = [];
    for (let i = 1; i < n; i++) if (REGION_OF[this.order[i]] !== REGION_OF[this.order[i - 1]]) breaks.push(i);
    this.svg.selectAll("line.sep-v, line.sep-h").remove();
    const swatch = this.svg
      .selectAll<SVGRectElement, number>("rect.region-mark")
      .data([0, ...breaks]);
    swatch
      .join("rect")
      .attr("class", "region-mark")
      .attr("x", LEFT - 4)
      .attr("y", (b) => TOP + b * CELL + 3)
      .attr("width", 2.5)
      .attr("height", (b, i) => ((breaks[i] ?? n) - b) * CELL - 6) // runs to the next break
      .attr("rx", 1)
      .attr("fill", (b) => hueOf(this.order[b]));
    // and the same above the columns, so a column's region reads without its tilted name
    this.svg
      .selectAll<SVGRectElement, number>("rect.region-mark-col")
      .data([0, ...breaks])
      .join("rect")
      .attr("class", "region-mark-col")
      .attr("x", (b) => LEFT + b * CELL + 3)
      .attr("y", TOP - 4)
      .attr("width", (b, i) => ((breaks[i] ?? n) - b) * CELL - 6)
      .attr("height", 2.5)
      .attr("rx", 1)
      .attr("fill", (b) => hueOf(this.order[b]));
  }
}
