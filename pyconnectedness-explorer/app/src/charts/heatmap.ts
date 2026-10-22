/**
 * Two renderers sharing one data shape (see CONTEXT.md's decision log):
 *
 * - baseline: a port of spillover_heatmap called as the notebook calls it for pairwise_net
 *   (cells 18/21/28): cmap="RdBu_r", annotate=False, 45 degree x tick labels, "shock source" /
 *   "affected variable" axis labels, a thin colorbar.
 * - redesign: same red/blue pair as the network view -- fixing the named flaw that the two
 *   charts used "a different red and blue for the same meaning." Per-cell hover tooltip since
 *   20x20 numbers can't all be labeled directly (dataviz skill: label selectively, put the
 *   rest in the tooltip/table).
 */
import * as d3 from "d3";
import { BASELINE, FONTS, REDESIGN, type RedesignTokens } from "../encoding";
import { hideTooltip, showTooltip } from "../tooltip";
import type { ChartStyle } from "../state";

export interface HeatmapDatum {
  names: string[]; // row/column order, already sorted by the caller
  matrix: number[][]; // k x k, [row=affected][col=source]
  title: string;
  style: ChartStyle;
  tokens: RedesignTokens;
  selectedPair?: [string, string] | null;
  onSelectCell?: (row: string, col: string) => void;
}

const SIZE = 760;
const MARGIN_BASELINE = { top: 40, right: 70, bottom: 110, left: 110 };
const MARGIN_REDESIGN = { top: 54, right: 76, bottom: 100, left: 100 };

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
      .style("display", "block") as any;

    this.title = this.svg.append("text").attr("x", SIZE / 2).attr("y", 20).attr("text-anchor", "middle") as any;
    this.gPlot = this.svg.append("g") as any;
    this.gCells = this.gPlot.append("g") as any;
    this.axisX = this.gPlot.append("g") as any;
    this.axisY = this.gPlot.append("g") as any;
    this.gColorbar = this.svg.append("g") as any;
    this.xlabel = this.svg.append("text").attr("text-anchor", "middle") as any;
    this.ylabel = this.svg.append("text").attr("text-anchor", "middle") as any;
  }

  render(d: HeatmapDatum) {
    if (d.style === "baseline") this.renderBaseline(d);
    else this.renderRedesign(d);
  }

  private renderBaseline(d: HeatmapDatum) {
    this.svg.style("background", BASELINE.figureBg);
    const m = MARGIN_BASELINE;
    const k = d.names.length;
    const plotSize = Math.min(SIZE - m.left - m.right, SIZE - m.top - m.bottom);
    const cell = plotSize / k;
    this.gPlot.attr("transform", `translate(${m.left},${m.top})`);

    this.title.attr("font-family", BASELINE.fontFamily).attr("font-size", BASELINE.titlePx).attr("font-weight", "normal").attr("fill", BASELINE.textColor).text(d.title);

    let maxAbs = 0;
    for (const row of d.matrix) for (const v of row) maxAbs = Math.max(maxAbs, Math.abs(v));
    const color = BASELINE.rdbuScale(maxAbs);

    this.drawCells(d, k, cell, color);

    const xs = d3.scaleBand<number>().domain(d3.range(k) as any).range([0, plotSize]);
    const ys = d3.scaleBand<number>().domain(d3.range(k) as any).range([0, plotSize]);
    this.axisX.attr("transform", `translate(0,${plotSize})`);
    (this.axisX as any).call(d3.axisBottom(xs).tickFormat((i) => d.names[i as number]).tickSizeOuter(0));
    this.axisX.selectAll("text").attr("transform", "rotate(-45)").attr("text-anchor", "end").attr("dx", "-0.3em").attr("dy", "0.2em");
    (this.axisY as any).call(d3.axisLeft(ys).tickFormat((i) => d.names[i as number]).tickSizeOuter(0));
    for (const axis of [this.axisX, this.axisY]) {
      axis.selectAll("path.domain").attr("stroke", "none");
      axis.selectAll("line").attr("stroke", "none");
      axis.selectAll("text").attr("font-family", BASELINE.fontFamily).attr("font-size", BASELINE.tickLabelPx * 0.82).attr("fill", BASELINE.textColor);
    }

    this.xlabel.attr("x", m.left + plotSize / 2).attr("y", SIZE - 6).attr("font-family", BASELINE.fontFamily).attr("font-size", BASELINE.labelPx).attr("fill", BASELINE.textColor).text("shock source");
    this.ylabel.attr("transform", `translate(16,${m.top + plotSize / 2}) rotate(-90)`).attr("font-family", BASELINE.fontFamily).attr("font-size", BASELINE.labelPx).attr("fill", BASELINE.textColor).text("affected variable");

    this.drawColorbar(m, plotSize, maxAbs, color, BASELINE.fontFamily, BASELINE.tickLabelPx * 0.8, BASELINE.textColor, BASELINE.spineColor, BASELINE.spineWidthPx);
  }

  private renderRedesign(d: HeatmapDatum) {
    const t = d.tokens;
    this.svg.style("background", t.surface);
    const m = MARGIN_REDESIGN;
    const k = d.names.length;
    const plotSize = Math.min(SIZE - m.left - m.right, SIZE - m.top - m.bottom);
    const cell = plotSize / k;
    this.gPlot.attr("transform", `translate(${m.left},${m.top})`);

    this.title.attr("font-family", FONTS.display).attr("font-size", REDESIGN.titlePx).attr("font-weight", "600").attr("fill", t.primary).text(d.title);

    let maxAbs = 0;
    for (const row of d.matrix) for (const v of row) maxAbs = Math.max(maxAbs, Math.abs(v));
    const color = REDESIGN.divergingScale(maxAbs, t);

    this.drawCellsRedesign(d, k, cell, color, t, maxAbs);

    const xs = d3.scaleBand<number>().domain(d3.range(k) as any).range([0, plotSize]);
    const ys = d3.scaleBand<number>().domain(d3.range(k) as any).range([0, plotSize]);
    this.axisX.attr("transform", `translate(0,${plotSize})`);
    (this.axisX as any).call(d3.axisBottom(xs).tickFormat((i) => d.names[i as number]).tickSizeOuter(0));
    this.axisX.selectAll("text").attr("transform", "rotate(-45)").attr("text-anchor", "end").attr("dx", "-0.3em").attr("dy", "0.2em");
    (this.axisY as any).call(d3.axisLeft(ys).tickFormat((i) => d.names[i as number]).tickSizeOuter(0));
    for (const axis of [this.axisX, this.axisY]) {
      axis.selectAll("path.domain").attr("stroke", "none");
      axis.selectAll("line").attr("stroke", "none");
      axis.selectAll("text").attr("font-family", FONTS.body).attr("font-size", REDESIGN.tickLabelPx * 0.95).attr("fill", t.secondary);
    }

    this.xlabel.attr("x", m.left + plotSize / 2).attr("y", SIZE - 6).attr("font-family", FONTS.body).attr("font-size", 11).attr("fill", t.muted).text("shock source →");
    this.ylabel.attr("transform", `translate(16,${m.top + plotSize / 2}) rotate(-90)`).attr("font-family", FONTS.body).attr("font-size", 11).attr("fill", t.muted).text("affected variable →");

    this.drawColorbar(m, plotSize, maxAbs, color, FONTS.data, 10, t.secondary, t.axis, 1, t);
  }

  /** Baseline: plain full-bleed cells, matching imshow. */
  private drawCells(d: HeatmapDatum, k: number, cell: number, color: (v: number) => string) {
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
      .attr("stroke", "none")
      .on("click", (_ev, c) => d.onSelectCell?.(d.names[c.i], d.names[c.j]));
  }

  /** Redesign: per the client's heatmap reference -- a faint full-height "track" per cell,
   * with a rounded capsule centered in it whose height ALSO encodes |value|, not just colour
   * (so magnitude reads twice, the way the reference's varying-height bars do). */
  private drawCellsRedesign(d: HeatmapDatum, k: number, cell: number, color: (v: number) => string, t: RedesignTokens, maxAbs: number) {
    type Cell = { i: number; j: number; v: number };
    const cells: Cell[] = [];
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) cells.push({ i, j, v: d.matrix[i][j] });

    const trackW = cell * 0.56;
    const capW = cell * 0.56;
    const minFrac = 0.16;

    const trackSel = this.gCells.selectAll<SVGRectElement, Cell>("rect.track").data(cells, (c) => `t${c.i}-${c.j}`);
    trackSel.exit().remove();
    trackSel
      .enter()
      .append("rect")
      .attr("class", "track")
      .merge(trackSel as any)
      .attr("x", (c) => c.j * cell + (cell - trackW) / 2)
      .attr("y", (c) => c.i * cell + cell * 0.06)
      .attr("width", trackW)
      .attr("height", cell * 0.88)
      .attr("rx", trackW / 2)
      .attr("fill", t.gridline);

    const capSel = this.gCells.selectAll<SVGRectElement, Cell>("rect.cap").data(cells, (c) => `c${c.i}-${c.j}`);
    capSel.exit().remove();
    capSel
      .enter()
      .append("rect")
      .attr("class", "cap")
      .style("cursor", "pointer")
      .merge(capSel as any)
      .attr("x", (c) => c.j * cell + (cell - capW) / 2)
      .attr("width", capW)
      .attr("fill", (c) => color(c.v))
      .attr("stroke", (c) => (d.selectedPair && d.names[c.i] === d.selectedPair[0] && d.names[c.j] === d.selectedPair[1] ? t.primary : "none"))
      .attr("stroke-width", 2)
      .each(function (c) {
        const frac = minFrac + (1 - minFrac) * (Math.abs(c.v) / maxAbs);
        const h = cell * 0.88 * frac;
        const cy = c.i * cell + cell / 2;
        const sel = d3.select(this);
        sel.attr("y", cy - h / 2).attr("height", h).attr("rx", capW / 2);
      })
      .on("click", (_ev, c) => d.onSelectCell?.(d.names[c.i], d.names[c.j]))
      .on("mousemove", (ev: MouseEvent, c) => {
        showTooltip(ev.clientX, ev.clientY, `${d.names[c.i]} → ${d.names[c.j]}`, [
          { label: "net flow", value: `${c.v.toFixed(2)}%`, swatch: c.v >= 0 ? t.send : t.recv },
        ]);
      })
      .on("mouseleave", () => hideTooltip());
  }

  private drawColorbar(
    m: { left: number; top: number },
    plotSize: number,
    maxAbs: number,
    color: (v: number) => string,
    fontFamily: string,
    fontSize: number,
    textColor: string,
    borderColor: string,
    borderWidth: number,
    t?: RedesignTokens
  ) {
    this.gColorbar.selectAll("*").remove();
    const cbX = m.left + plotSize + 24;
    const cbW = 16;
    const cbH = plotSize * 0.9;
    const cbY = m.top + (plotSize - cbH) / 2;
    const gradId = t ? "hm-grad-redesign" : "hm-grad-baseline";
    let defs = this.svg.select<SVGDefsElement>("defs");
    if (defs.empty()) defs = this.svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", gradId).attr("x1", "0").attr("x2", "0").attr("y1", "0").attr("y2", "1");
    grad
      .selectAll("stop")
      .data(d3.range(0, 1.0001, 0.1))
      .join("stop")
      .attr("offset", (s) => `${s * 100}%`)
      .attr("stop-color", (s) => color(maxAbs - s * 2 * maxAbs));
    this.gColorbar.append("rect").attr("x", cbX).attr("y", cbY).attr("width", cbW).attr("height", cbH).attr("fill", `url(#${gradId})`).attr("stroke", borderColor).attr("stroke-width", borderWidth);
    const cbScale = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([cbY + cbH, cbY]);
    const cbAxisG = this.gColorbar.append("g").attr("transform", `translate(${cbX + cbW},0)`);
    (cbAxisG as any).call(d3.axisRight(cbScale).ticks(5));
    cbAxisG.selectAll("path.domain").attr("stroke", "none");
    cbAxisG.selectAll("line").attr("stroke", "none");
    cbAxisG.selectAll("text").attr("font-family", fontFamily).attr("font-size", fontSize).attr("fill", textColor);
    if (t) {
      this.gColorbar.append("text").attr("x", cbX + cbW / 2).attr("y", cbY - 10).attr("text-anchor", "middle").attr("font-family", FONTS.body).attr("font-size", 9.5).attr("fill", t.muted).text("sender");
      this.gColorbar.append("text").attr("x", cbX + cbW / 2).attr("y", cbY + cbH + 20).attr("text-anchor", "middle").attr("font-family", FONTS.body).attr("font-size", 9.5).attr("fill", t.muted).text("receiver");
    }
  }
}
