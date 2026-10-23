/**
 * Net pairwise matrix (spillover_heatmap, notebook cells 18/21/28), rows = sender, columns =
 * receiver, grouped by region. Cells above the strongest-link cut-off get an outline, so the
 * matrix and the network visibly describe the same links.
 */
import * as d3 from "d3";
import type { Frame } from "../model";
import { type Palette, REGION_OF, diverging, regionOrder } from "../encoding";
import { hideTooltip, showTooltip } from "../tooltip";

const CELL = 22;
const LEFT = 92;
const TOP = 92;

export class HeatmapChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private order: string[];

  constructor(
    host: HTMLElement,
    private names: string[],
    private onHover: (n: string | null) => void,
    private onSelect: (n: string) => void
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
      .attr("aria-label", "Matrix of net pairwise spillovers, sender rows by receiver columns");
  }

  render(frame: Frame, p: Palette, maxPair: number, focus: string | null) {
    const n = this.order.length;
    const color = diverging(maxPair, p);
    const idx = this.order.map((name) => this.names.indexOf(name));
    const cells: { r: number; c: number; v: number }[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push({ r, c, v: frame.matrix[idx[r]][idx[c]] });
    const focusPos = focus ? this.order.indexOf(focus) : -1;

    this.svg
      .selectAll<SVGRectElement, (typeof cells)[number]>("rect.cell")
      .data(cells)
      .join("rect")
      .attr("class", "cell")
      .attr("x", (d) => LEFT + d.c * CELL)
      .attr("y", (d) => TOP + d.r * CELL)
      .attr("width", CELL - 2)
      .attr("height", CELL - 2)
      .attr("rx", 3)
      .attr("fill", (d) => (d.r === d.c ? "transparent" : color(d.v)))
      .attr("stroke", (d) => (d.v > frame.threshold ? p.fg : "none"))
      .attr("stroke-width", 1.4)
      .style("opacity", (d) => (focusPos < 0 || d.r === focusPos || d.c === focusPos ? 1 : 0.3))
      .on("mousemove", (ev: MouseEvent, d) => {
        if (d.r === d.c) return;
        const s = this.order[d.r];
        const rcv = this.order[d.c];
        const title = d.v >= 0 ? `${s} → ${rcv}` : `${rcv} → ${s}`;
        showTooltip(ev.clientX, ev.clientY, title, [
          { label: "Net flow", value: `${Math.abs(d.v).toFixed(2)} pp` },
          { label: d.v > frame.threshold ? "Among the strongest 10%" : "Below the cut-off", value: "" },
        ]);
      })
      .on("mouseleave", hideTooltip);

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

    // region separators
    const breaks: number[] = [];
    for (let i = 1; i < n; i++) if (REGION_OF[this.order[i]] !== REGION_OF[this.order[i - 1]]) breaks.push(i);
    this.svg
      .selectAll("line.sep-v")
      .data(breaks)
      .join("line")
      .attr("class", "sep-v")
      .attr("x1", (b) => LEFT + b * CELL - 1)
      .attr("x2", (b) => LEFT + b * CELL - 1)
      .attr("y1", TOP)
      .attr("y2", TOP + n * CELL)
      .attr("stroke", p.axis);
    this.svg
      .selectAll("line.sep-h")
      .data(breaks)
      .join("line")
      .attr("class", "sep-h")
      .attr("y1", (b) => TOP + b * CELL - 1)
      .attr("y2", (b) => TOP + b * CELL - 1)
      .attr("x1", LEFT)
      .attr("x2", LEFT + n * CELL)
      .attr("stroke", p.axis);
  }
}
