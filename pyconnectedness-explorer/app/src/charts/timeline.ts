/**
 * Port of Demo.ipynb cell 14 (two stacked `dyn.total.plot(color="black", lw=1)` axes with a
 * dashed grey full-sample mean and `grid(alpha=0.3)`), one axes per measure. The baseline
 * notebook chart has no crisis markers or period bands -- those are this explorer's own
 * addition (CONTEXT.md requirement 2/3: mark when the system became fragile, support
 * scrubbing), drawn as a thin overlay layer so the traced chart underneath stays recognizable.
 */
import * as d3 from "d3";
import { BASELINE, EPISODE_LABELS, SHELL_LIGHT } from "../encoding";

export interface TimelineDatum {
  dates: string[]; // ISO, dynamic.<measure>.dates
  total: number[];
  fullSampleTotal: number;
  title: string;
  ylabel: string;
  episodes: string[]; // ISO dates
  periods: { start: string; end: string; label: string }[];
  selectedIndex: number;
  showXAxis: boolean;
  onScrub?: (index: number) => void;
}

const W = 1300;
const H = 420; // one axes, stacked by the caller
const MARGIN = { top: 34, right: 16, bottom: 46, left: 56 };

export class TimelineChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private gPlot: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gBands: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gGridX: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gGridY: d3.Selection<SVGGElement, unknown, null, undefined>;
  private path: d3.Selection<SVGPathElement, unknown, null, undefined>;
  private meanLine: d3.Selection<SVGLineElement, unknown, null, undefined>;
  private cursor: d3.Selection<SVGLineElement, unknown, null, undefined>;
  private gEpisodes: d3.Selection<SVGGElement, unknown, null, undefined>;
  private axisX: d3.Selection<SVGGElement, unknown, null, undefined>;
  private axisY: d3.Selection<SVGGElement, unknown, null, undefined>;
  private title: d3.Selection<SVGTextElement, unknown, null, undefined>;
  private ylabel: d3.Selection<SVGTextElement, unknown, null, undefined>;
  private overlay: d3.Selection<SVGRectElement, unknown, null, undefined>;
  private x = d3.scaleTime();
  private y = d3.scaleLinear();
  private data: TimelineDatum | null = null;

  constructor(host: HTMLElement) {
    this.svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .style("display", "block")
      .style("background", BASELINE.figureBg) as any;

    this.title = this.svg
      .append("text")
      .attr("x", W / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", BASELINE.titlePx)
      .attr("fill", BASELINE.textColor) as any;

    this.gBands = this.svg.append("g") as any;
    this.gPlot = this.svg.append("g") as any;
    this.gGridX = this.gPlot.append("g") as any;
    this.gGridY = this.gPlot.append("g") as any;
    this.gEpisodes = this.gPlot.append("g") as any;

    this.gPlot
      .append("rect")
      .attr("class", "plotbg")
      .attr("fill", BASELINE.axesBg)
      .lower();

    this.meanLine = this.gPlot
      .append("line")
      .attr("stroke", BASELINE.meanLineColor)
      .attr("stroke-width", BASELINE.meanLineWidthPx)
      .attr("stroke-dasharray", "6,4") as any;

    this.path = this.gPlot
      .append("path")
      .attr("fill", "none")
      .attr("stroke", BASELINE.dataLineColor)
      .attr("stroke-width", BASELINE.dataLineWidthPx) as any;

    this.cursor = this.gPlot
      .append("line")
      .attr("stroke", SHELL_LIGHT.send)
      .attr("stroke-width", 1.4) as any;

    this.axisX = this.gPlot.append("g") as any;
    this.axisY = this.gPlot.append("g") as any;

    this.ylabel = this.svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", BASELINE.labelPx)
      .attr("fill", BASELINE.textColor)
      .attr("transform", `translate(${16},${H / 2}) rotate(-90)`) as any;

    this.overlay = this.gPlot
      .append("rect")
      .attr("fill", "transparent")
      .style("cursor", "crosshair") as any;
  }

  private plotW() {
    return W - MARGIN.left - MARGIN.right;
  }
  private plotH() {
    return H - MARGIN.top - MARGIN.bottom;
  }

  render(d: TimelineDatum) {
    this.data = d;
    const pw = this.plotW();
    const ph = this.plotH();

    this.title.text(d.title);

    const dates = d.dates.map((s) => new Date(s));
    this.x.domain(d3.extent(dates) as [Date, Date]).range([0, pw]);
    const vals = d.total;
    const [vmin, vmax] = d3.extent(vals) as [number, number];
    const pad = (vmax - vmin) * 0.08 || 1;
    this.y.domain([vmin - pad, vmax + pad]).range([ph, 0]);

    this.gPlot.attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
    this.gPlot.select("rect.plotbg").attr("width", pw).attr("height", ph);

    this.gGridY
      .selectAll("line")
      .data(this.y.ticks(6))
      .join("line")
      .attr("x1", 0)
      .attr("x2", pw)
      .attr("y1", (v) => this.y(v))
      .attr("y2", (v) => this.y(v))
      .attr("stroke", BASELINE.gridColor)
      .attr("stroke-opacity", BASELINE.gridAlpha)
      .attr("stroke-width", 1);

    const yearTicks = this.x.ticks(d3.timeYear.every(5)!);
    this.gGridX
      .selectAll("line")
      .data(yearTicks)
      .join("line")
      .attr("y1", 0)
      .attr("y2", ph)
      .attr("x1", (v) => this.x(v))
      .attr("x2", (v) => this.x(v))
      .attr("stroke", BASELINE.gridColor)
      .attr("stroke-opacity", BASELINE.gridAlpha)
      .attr("stroke-width", 1);

    // period bands: explorer addition, not in the baseline notebook chart
    this.gBands.attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
    this.gBands
      .selectAll("rect")
      .data(d.periods)
      .join("rect")
      .attr("x", (p) => this.x(new Date(p.start)))
      .attr("width", (p) => Math.max(0, this.x(new Date(p.end)) - this.x(new Date(p.start))))
      .attr("y", 0)
      .attr("height", ph)
      .attr("fill", SHELL_LIGHT.band)
      .attr("opacity", 0.55);

    const line = d3
      .line<number>()
      .x((_v, i) => this.x(dates[i]))
      .y((v) => this.y(v));
    this.path.attr("d", line(vals));

    this.meanLine
      .attr("x1", 0)
      .attr("x2", pw)
      .attr("y1", this.y(d.fullSampleTotal))
      .attr("y2", this.y(d.fullSampleTotal));

    // episode markers: explorer addition
    const epSel = this.gEpisodes.selectAll<SVGGElement, string>("g").data(d.episodes);
    epSel.exit().remove();
    const epEnter = epSel.enter().append("g");
    epEnter.append("line").attr("class", "tick");
    epEnter
      .append("text")
      .attr("class", "label")
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", 9.5)
      .attr("fill", SHELL_LIGHT.muted)
      .attr("text-anchor", "start");
    const epMerged = epEnter.merge(epSel as any);
    epMerged.attr("transform", (iso) => `translate(${this.x(new Date(iso))},0)`);
    epMerged
      .select("line.tick")
      .attr("y1", 0)
      .attr("y2", ph)
      .attr("stroke", SHELL_LIGHT.edge)
      .attr("stroke-dasharray", "2,3")
      .attr("stroke-opacity", 0.55);
    epMerged
      .select("text.label")
      .attr("x", 3)
      .attr("y", 12)
      .text((iso) => EPISODE_LABELS[iso] ?? "");

    // selection cursor
    const cx = this.x(dates[Math.min(d.selectedIndex, dates.length - 1)] ?? dates[0]);
    this.cursor.attr("x1", cx).attr("x2", cx).attr("y1", 0).attr("y2", ph);

    // axes
    const xAxis = d3
      .axisBottom(this.x)
      .tickValues(yearTicks)
      .tickFormat((v) => String((v as Date).getFullYear()))
      .tickSizeOuter(0);
    this.axisX.attr("transform", `translate(0,${ph})`);
    if (d.showXAxis) {
      (this.axisX as any).call(xAxis);
    } else {
      this.axisX.selectAll("*").remove();
    }
    this.styleAxis(this.axisX);

    const yAxis = d3.axisLeft(this.y).ticks(6).tickSizeOuter(0);
    (this.axisY as any).call(yAxis);
    this.styleAxis(this.axisY);

    // spines (all four sides, matplotlib default)
    this.gPlot.selectAll("rect.spine").remove();
    this.gPlot
      .append("rect")
      .attr("class", "spine")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", pw)
      .attr("height", ph)
      .attr("fill", "none")
      .attr("stroke", BASELINE.spineColor)
      .attr("stroke-width", BASELINE.spineWidthPx);

    this.ylabel.attr("transform", `translate(${16},${MARGIN.top + ph / 2}) rotate(-90)`).text(d.ylabel);

    this.overlay
      .attr("width", pw)
      .attr("height", ph)
      .on("click", (ev: MouseEvent) => this.scrubFromEvent(ev))
      .on("mousemove", (ev: MouseEvent) => {
        if ((ev.buttons & 1) === 1) this.scrubFromEvent(ev);
      });
  }

  private styleAxis(sel: d3.Selection<SVGGElement, unknown, null, undefined>) {
    sel.selectAll("path.domain").attr("stroke", "none");
    sel.selectAll("line").attr("stroke", BASELINE.tickColor).attr("stroke-width", BASELINE.tickWidthPx);
    sel
      .selectAll("text")
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", BASELINE.tickLabelPx)
      .attr("fill", BASELINE.textColor);
  }

  private scrubFromEvent(ev: MouseEvent) {
    if (!this.data) return;
    const [mx] = d3.pointer(ev, this.gPlot.node());
    const date = this.x.invert(mx);
    const dates = this.data.dates.map((s) => new Date(s).getTime());
    const t = date.getTime();
    let lo = 0;
    for (let i = 1; i < dates.length; i++) if (Math.abs(dates[i] - t) < Math.abs(dates[lo] - t)) lo = i;
    this.data.onScrub?.(lo);
  }
}
