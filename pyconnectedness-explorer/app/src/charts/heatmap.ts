/**
 * Port of spillover_heatmap (src/pyconnectedness/viz/heatmap.py) called as the notebook calls
 * it for pairwise_net (cells 18/21/28): cmap="RdBu_r", annotate=False, 45 degree x tick
 * labels, "shock source" / "affected variable" axis labels, a thin colorbar. Centred on zero
 * using the CURRENT matrix's own max |value|, same as a plain notebook call with no vmin/vmax
 * passed in -- not the fixed-domain rule the network view uses, since this view isn't animated
 * frame to frame, it's picked from a window dropdown (SPEC.md section 6, view 3).
 */
import * as d3 from "d3";
import { BASELINE } from "../encoding";

export interface HeatmapDatum {
  names: string[]; // row/column order, already sorted by the caller
  matrix: number[][]; // k x k, [row=affected][col=source]
  title: string;
  selectedPair?: [string, string] | null;
  onSelectCell?: (row: string, col: string) => void;
}

const SIZE = 760;
const MARGIN = { top: 40, right: 70, bottom: 110, left: 110 };

export class HeatmapChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private gPlot: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gCells: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gColorbar: d3.Selection<SVGGElement, unknown, null, undefined>;
  private title: d3.Selection<SVGTextElement, unknown, null, undefined>;
  private axisX: d3.Selection<SVGGElement, unknown, null, undefined>;
  private axisY: d3.Selection<SVGGElement, unknown, null, undefined>;
  private xlabel: d3.Selection<SVGTextElement, unknown, null, undefined>;
  private ylabel: d3.Selection<SVGTextElement, unknown, null, undefined>;

  constructor(host: HTMLElement) {
    this.svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `0 0 ${SIZE} ${SIZE}`)
      .attr("width", "100%")
      .style("display", "block")
      .style("background", BASELINE.figureBg) as any;

    this.title = this.svg
      .append("text")
      .attr("x", SIZE / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", BASELINE.titlePx)
      .attr("fill", BASELINE.textColor) as any;

    this.gPlot = this.svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`) as any;
    this.gCells = this.gPlot.append("g") as any;
    this.axisX = this.gPlot.append("g") as any;
    this.axisY = this.gPlot.append("g") as any;
    this.gColorbar = this.svg.append("g") as any;

    this.xlabel = this.svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", BASELINE.labelPx)
      .attr("fill", BASELINE.textColor)
      .text("shock source") as any;

    this.ylabel = this.svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", BASELINE.labelPx)
      .attr("fill", BASELINE.textColor)
      .text("affected variable") as any;
  }

  render(d: HeatmapDatum) {
    const k = d.names.length;
    const plotSize = Math.min(SIZE - MARGIN.left - MARGIN.right, SIZE - MARGIN.top - MARGIN.bottom);
    const cell = plotSize / k;

    this.title.text(d.title);

    let maxAbs = 0;
    for (const row of d.matrix) for (const v of row) maxAbs = Math.max(maxAbs, Math.abs(v));
    const color = BASELINE.rdbuScale(maxAbs);

    type Cell = { i: number; j: number; v: number };
    const cells: Cell[] = [];
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) cells.push({ i, j, v: d.matrix[i][j] });

    const sel = this.gCells.selectAll<SVGRectElement, Cell>("rect").data(cells, (c) => `${c.i}-${c.j}`);
    sel.exit().remove();
    sel
      .enter()
      .append("rect")
      .style("cursor", "pointer")
      .merge(sel as any)
      .attr("x", (c) => c.j * cell)
      .attr("y", (c) => c.i * cell)
      .attr("width", cell)
      .attr("height", cell)
      .attr("fill", (c) => color(c.v))
      .attr("stroke", (c) => {
        if (!d.selectedPair) return "none";
        return d.names[c.i] === d.selectedPair[0] && d.names[c.j] === d.selectedPair[1] ? BASELINE.textColor : "none";
      })
      .attr("stroke-width", 2)
      .on("click", (_ev, c) => d.onSelectCell?.(d.names[c.i], d.names[c.j]));

    const scaleBand = (n: number) => d3.scaleBand<number>().domain(d3.range(n) as any).range([0, plotSize]);
    const xs = scaleBand(k);
    const ys = scaleBand(k);

    const xAxis = d3.axisBottom(xs).tickFormat((i) => d.names[i as number]).tickSizeOuter(0);
    this.axisX.attr("transform", `translate(0,${plotSize})`);
    (this.axisX as any).call(xAxis);
    this.axisX
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .attr("text-anchor", "end")
      .attr("dx", "-0.3em")
      .attr("dy", "0.2em");

    const yAxis = d3.axisLeft(ys).tickFormat((i) => d.names[i as number]).tickSizeOuter(0);
    (this.axisY as any).call(yAxis);

    for (const axis of [this.axisX, this.axisY]) {
      axis.selectAll("path.domain").attr("stroke", "none");
      axis.selectAll("line").attr("stroke", "none");
      axis
        .selectAll("text")
        .attr("font-family", BASELINE.fontFamily)
        .attr("font-size", BASELINE.tickLabelPx * 0.82)
        .attr("fill", BASELINE.textColor);
    }

    this.xlabel.attr("x", MARGIN.left + plotSize / 2).attr("y", SIZE - 6);
    this.ylabel.attr("transform", `translate(16,${MARGIN.top + plotSize / 2}) rotate(-90)`);

    // colorbar
    this.gColorbar.selectAll("*").remove();
    const cbX = MARGIN.left + plotSize + 24;
    const cbW = 16;
    const cbH = plotSize * 0.9;
    const cbY = MARGIN.top + (plotSize - cbH) / 2;
    const grad = this.svg.append("defs").append("linearGradient").attr("id", "hm-grad").attr("x1", "0").attr("x2", "0").attr("y1", "0").attr("y2", "1");
    const stops = d3.range(0, 1.0001, 0.1);
    grad
      .selectAll("stop")
      .data(stops)
      .join("stop")
      .attr("offset", (t) => `${t * 100}%`)
      .attr("stop-color", (t) => color(maxAbs - t * 2 * maxAbs));
    this.gColorbar.append("rect").attr("x", cbX).attr("y", cbY).attr("width", cbW).attr("height", cbH).attr("fill", "url(#hm-grad)").attr("stroke", BASELINE.spineColor).attr("stroke-width", BASELINE.spineWidthPx);
    const cbScale = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([cbY + cbH, cbY]);
    const cbAxis = d3.axisRight(cbScale).ticks(5);
    const cbAxisG = this.gColorbar.append("g").attr("transform", `translate(${cbX + cbW},0)`);
    (cbAxisG as any).call(cbAxis);
    cbAxisG.selectAll("path.domain").attr("stroke", "none");
    cbAxisG.selectAll("line").attr("stroke", "none");
    cbAxisG.selectAll("text").attr("font-family", BASELINE.fontFamily).attr("font-size", BASELINE.tickLabelPx * 0.8).attr("fill", BASELINE.textColor);
  }
}
