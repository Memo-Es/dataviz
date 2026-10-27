/**
 * The spillover heatmap as the library draws it: spillover_heatmap(pairwise_net, cmap="RdBu_r"),
 * the authors' demo call. Every pair twice (pairwise_net is antisymmetric: row→column is minus
 * column→row), in the data's own order, red where the row passes more to the column than it gets
 * back, blue where it gets more, white where they're even; a colour bar beside it.
 *
 * The colour scale is the library's: imshow's own, from this matrix's smallest value to its largest,
 * which is centred on zero because the matrix is antisymmetric. One departure, so it reads
 * correctly: the library's default axis titles ("affected variable", "shock source") describe its
 * default matrix, not pairwise_net, so the axes here say "from" and "to".
 */
import * as d3 from "d3";
import type { Frame } from "../model";
import type { Palette } from "../encoding";
import { hideTooltip, showTooltip } from "../tooltip";

const CELL = 22;
const LEFT = 96;
const TOP = 26;
const BAR = 14; // the colour bar's width

interface Cell {
  r: number;
  c: number;
  v: number;
}

/** matplotlib's RdBu_r: blue for negative, white at zero, red for positive */
const rdbu = (t: number) => d3.interpolateRdBu(1 - t);

export class HeatmapGridChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private bottom: number;

  constructor(
    host: HTMLElement,
    private names: string[],
    private onHover: (n: string | null) => void,
    private onSelect: (n: string) => void,
    private onPair: (row: string, col: string) => void
  ) {
    const n = names.length;
    this.bottom = TOP + n * CELL;
    const W = LEFT + n * CELL + 24 + BAR + 44;
    const H = this.bottom + 96;
    this.svg = d3
      .select(host)
      .append("svg")
      .attr("class", "heatmap heatmap-grid")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("role", "img")
      .attr("aria-label", "The library's heatmap of net pairwise spillovers: red where the row passes more to the column, blue where it takes more");
  }

  render(frame: Frame, p: Palette, maxPair: number, focus: string | null, pair: [string, string] | null = null) {
    const n = this.names.length;
    const cells: Cell[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push({ r, c, v: frame.matrix[r][c] });
    // as imshow scales it: this matrix's own range (symmetric, since it is antisymmetric)
    const top = d3.max(frame.matrix.flat().map(Math.abs)) || 1;
    void maxPair;
    const scale = d3.scaleLinear().domain([-top, top]).range([0, 1]).clamp(true);
    const fi = focus ? this.names.indexOf(focus) : -1;
    const pr = pair ? this.names.indexOf(pair[0]) : -1;
    const pc = pair ? this.names.indexOf(pair[1]) : -1;
    const svg = this.svg;

    svg
      .selectAll<SVGRectElement, Cell>("rect.cell")
      .data(cells)
      .join("rect")
      .attr("class", "cell")
      .attr("x", (d) => LEFT + d.c * CELL)
      .attr("y", (d) => TOP + d.r * CELL)
      .attr("width", CELL)
      .attr("height", CELL)
      .attr("fill", (d) => rdbu(scale(d.v)))
      .style("cursor", (d) => (d.r === d.c ? "default" : "pointer"))
      .on("mousemove", (ev: MouseEvent, d) => {
        if (d.r === d.c) return hideTooltip();
        const [a, b] = d.v >= 0 ? [d.r, d.c] : [d.c, d.r];
        showTooltip(ev.clientX, ev.clientY, `${this.names[a]} → ${this.names[b]}`, [
          { label: "Net flow", value: `${Math.abs(d.v).toFixed(2)} pp` },
          { label: "pairwise_net, this cell", value: `${d.v >= 0 ? "+" : "−"}${Math.abs(d.v).toFixed(2)}` },
        ]);
      })
      .on("mouseleave", hideTooltip)
      .on("click", (_ev, d) => {
        if (d.r !== d.c) this.onPair(this.names[d.r], this.names[d.c]);
      });

    // a picked market: its row and its column outlined; a picked pair: both of its cells
    const marks: { x: number; y: number; w: number; h: number; c: string; sw: number }[] = [];
    if (fi >= 0 && pr < 0) {
      marks.push({ x: LEFT, y: TOP + fi * CELL, w: n * CELL, h: CELL, c: p.fg, sw: 2 });
      marks.push({ x: LEFT + fi * CELL, y: TOP, w: CELL, h: n * CELL, c: p.fg, sw: 2 });
    }
    if (pr >= 0)
      for (const [r, c] of [[pr, pc], [pc, pr]]) marks.push({ x: LEFT + c * CELL, y: TOP + r * CELL, w: CELL, h: CELL, c: p.accent, sw: 2.5 });
    svg
      .selectAll<SVGRectElement, (typeof marks)[number]>("rect.mark")
      .data(marks)
      .join("rect")
      .attr("class", "mark")
      .attr("x", (d) => d.x + 1)
      .attr("y", (d) => d.y + 1)
      .attr("width", (d) => d.w - 2)
      .attr("height", (d) => d.h - 2)
      .attr("fill", "none")
      .attr("stroke", (d) => d.c)
      .attr("stroke-width", (d) => d.sw)
      .attr("pointer-events", "none")
      .raise();

    // the names: rows down the left, columns along the bottom at 45°, as the library sets them
    const label = (cls: string, rows: boolean) =>
      svg
        .selectAll<SVGTextElement, string>(`text.${cls}`)
        .data(this.names)
        .join("text")
        .attr("class", `${cls} axis-name`)
        .attr("text-anchor", "end")
        .attr("dy", "0.35em")
        .attr("transform", (_d, i) =>
          rows ? `translate(${LEFT - 6},${TOP + i * CELL + CELL / 2})` : `translate(${LEFT + i * CELL + CELL / 2},${this.bottom + 8}) rotate(-45)`
        )
        .attr("fill", p.fg)
        .attr("font-weight", (_d, i) => (i === fi || i === pr || i === pc ? 700 : 400))
        .style("cursor", "pointer")
        .text((d) => d)
        .on("mouseenter", (_ev, d) => this.onHover(d))
        .on("mouseleave", () => this.onHover(null))
        .on("click", (_ev, d) => this.onSelect(d));
    label("row-name", true);
    label("col-name", false);

    // axis titles, in words that hold for pairwise_net
    svg.selectAll("text.axis-title").remove();
    svg.append("text").attr("class", "axis-title").attr("x", LEFT - 6).attr("y", TOP - 10).attr("text-anchor", "end").attr("fill", p.fg).text("from ↓");
    svg.append("text").attr("class", "axis-title").attr("x", LEFT + n * CELL).attr("y", TOP - 10).attr("text-anchor", "end").attr("fill", p.fg).text("to →");

    // the colour bar: the scale, centred on zero, fixed across every step
    const bx = LEFT + n * CELL + 24;
    const H = n * CELL;
    const defs = svg.selectAll("defs").data([0]).join("defs");
    const grad = defs.selectAll("linearGradient").data([0]).join("linearGradient").attr("id", "rdbu-bar").attr("x1", 0).attr("x2", 0).attr("y1", 1).attr("y2", 0);
    grad
      .selectAll("stop")
      .data(d3.range(0, 1.0001, 0.1))
      .join("stop")
      .attr("offset", (t) => t)
      .attr("stop-color", (t) => rdbu(t));
    svg.selectAll("rect.bar").data([0]).join("rect").attr("class", "bar").attr("x", bx).attr("y", TOP).attr("width", BAR).attr("height", H).attr("fill", "url(#rdbu-bar)").attr("stroke", p.axis);
    const by = d3.scaleLinear().domain([-top, top]).range([TOP + H, TOP]);
    svg
      .selectAll<SVGTextElement, number>("text.bar-tick")
      .data(by.ticks(6))
      .join("text")
      .attr("class", "bar-tick mono")
      .attr("x", bx + BAR + 6)
      .attr("y", (t) => by(t))
      .attr("dy", "0.35em")
      .attr("fill", p.fg)
      .text((t) => (t > 0 ? `+${t}` : t < 0 ? `−${-t}` : "0"));
  }
}
