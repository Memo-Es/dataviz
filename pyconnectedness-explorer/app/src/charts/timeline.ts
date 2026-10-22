/**
 * Two renderers sharing one data shape (see CONTEXT.md's decision log):
 *
 * - baseline: cell 14 of the pinned notebook -- `dyn.total.plot(color="black", lw=1)`, a
 *   dashed grey full-sample mean, `grid(alpha=0.3)`. No crisis markers in the notebook itself;
 *   the scrub cursor and episode ticks here are this explorer's own interaction layer.
 * - redesign: fixes what Miljana named directly -- "a bare black line with no crisis markers
 *   or highlighted peaks." Each named episode and the largest week-over-week jumps get a
 *   banded "pulse" stem (inspired by a reference the client sent: a chromatic variable-width
 *   line piece), but built from the validated red/blue pair, not an unconstrained rainbow --
 *   see encoding.ts. A hero number calls out the selected week's value, which was otherwise
 *   only ever printed to notebook output.
 */
import * as d3 from "d3";
import { BASELINE, EPISODE_LABELS, FONTS, REDESIGN, type RedesignTokens } from "../encoding";
import { hideTooltip, showTooltip } from "../tooltip";
import type { ChartStyle } from "../state";

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
  style: ChartStyle;
  tokens: RedesignTokens;
  measureLabel?: string; // "return" | "volatility" -- for the redesign hero number
  onScrub?: (index: number) => void;
}

const W = 1300;
const H = 420; // one axes, stacked by the caller
const MARGIN_BASELINE = { top: 34, right: 16, bottom: 46, left: 56 };
const MARGIN_REDESIGN = { top: 54, right: 100, bottom: 40, left: 48 };

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
  private gPulses: d3.Selection<SVGGElement, unknown, null, undefined>;
  private axisX: d3.Selection<SVGGElement, unknown, null, undefined>;
  private axisY: d3.Selection<SVGGElement, unknown, null, undefined>;
  private title: d3.Selection<SVGTextElement, unknown, null, undefined>;
  private subtitle: d3.Selection<SVGTextElement, unknown, null, undefined>;
  private ylabel: d3.Selection<SVGTextElement, unknown, null, undefined>;
  private hero: d3.Selection<SVGGElement, unknown, null, undefined>;
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
      .style("display", "block") as any;

    this.title = this.svg.append("text").attr("x", 0).attr("text-anchor", "start") as any;
    this.subtitle = this.svg.append("text").attr("x", 0).attr("text-anchor", "start") as any;
    this.hero = this.svg.append("g") as any;

    this.gBands = this.svg.append("g") as any;
    this.gPlot = this.svg.append("g") as any;
    this.gGridX = this.gPlot.append("g") as any;
    this.gGridY = this.gPlot.append("g") as any;
    this.gEpisodes = this.gPlot.append("g") as any;
    this.gPulses = this.gPlot.append("g") as any;

    this.gPlot.append("rect").attr("class", "plotbg").lower();

    this.meanLine = this.gPlot.append("line").attr("stroke-dasharray", "6,4") as any;
    this.path = this.gPlot.append("path").attr("fill", "none") as any;
    this.cursor = this.gPlot.append("line") as any;

    this.axisX = this.gPlot.append("g") as any;
    this.axisY = this.gPlot.append("g") as any;

    this.ylabel = this.svg.append("text").attr("text-anchor", "middle") as any;

    this.overlay = this.gPlot.append("rect").attr("fill", "transparent").style("cursor", "crosshair") as any;
  }

  render(d: TimelineDatum) {
    this.data = d;
    if (d.style === "baseline") this.renderBaseline(d);
    else this.renderRedesign(d);
  }

  // ---------------------------------------------------------------- baseline ----
  private renderBaseline(d: TimelineDatum) {
    this.svg.style("background", BASELINE.figureBg);
    this.hero.selectAll("*").remove();
    const m = MARGIN_BASELINE;
    const pw = W - m.left - m.right;
    const ph = H - m.top - m.bottom;

    this.title
      .attr("x", W / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-family", BASELINE.fontFamily)
      .attr("font-size", BASELINE.titlePx)
      .attr("font-weight", "normal")
      .attr("fill", BASELINE.textColor)
      .text(d.title);
    this.subtitle.text("");

    const dates = d.dates.map((s) => new Date(s));
    this.x.domain(d3.extent(dates) as [Date, Date]).range([0, pw]);
    const [vmin, vmax] = d3.extent(d.total) as [number, number];
    const pad = (vmax - vmin) * 0.08 || 1;
    this.y.domain([vmin - pad, vmax + pad]).range([ph, 0]);

    this.gPlot.attr("transform", `translate(${m.left},${m.top})`);
    this.gPlot.select("rect.plotbg").attr("width", pw).attr("height", ph).attr("fill", BASELINE.axesBg);

    this.gGridY
      .selectAll("line")
      .data(this.y.ticks(6))
      .join("line")
      .attr("x1", 0).attr("x2", pw).attr("y1", (v) => this.y(v)).attr("y2", (v) => this.y(v))
      .attr("stroke", BASELINE.gridColor).attr("stroke-opacity", BASELINE.gridAlpha).attr("stroke-width", 1);

    const yearTicks = this.x.ticks(d3.timeYear.every(5)!);
    this.gGridX
      .selectAll("line")
      .data(yearTicks)
      .join("line")
      .attr("y1", 0).attr("y2", ph).attr("x1", (v) => this.x(v)).attr("x2", (v) => this.x(v))
      .attr("stroke", BASELINE.gridColor).attr("stroke-opacity", BASELINE.gridAlpha).attr("stroke-width", 1);

    this.gBands.selectAll("*").remove();
    this.gPulses.selectAll("*").remove();

    const line = d3.line<number>().x((_v, i) => this.x(dates[i])).y((v) => this.y(v));
    this.path.attr("d", line(d.total)).attr("stroke", BASELINE.dataLineColor).attr("stroke-width", BASELINE.dataLineWidthPx);

    this.meanLine
      .attr("x1", 0).attr("x2", pw)
      .attr("y1", this.y(d.fullSampleTotal)).attr("y2", this.y(d.fullSampleTotal))
      .attr("stroke", BASELINE.meanLineColor).attr("stroke-width", BASELINE.meanLineWidthPx);

    const epSel = this.gEpisodes.selectAll<SVGGElement, string>("g").data(d.episodes);
    epSel.exit().remove();
    const epEnter = epSel.enter().append("g");
    epEnter.append("line").attr("class", "tick");
    epEnter.append("text").attr("class", "label").attr("text-anchor", "start");
    const epMerged = epEnter.merge(epSel as any);
    epMerged.attr("transform", (iso) => `translate(${this.x(new Date(iso))},0)`);
    epMerged.select("line.tick").attr("y1", 0).attr("y2", ph).attr("stroke", "#808080").attr("stroke-dasharray", "2,3").attr("stroke-opacity", 0.5);
    epMerged.select("text.label").attr("x", 3).attr("y", 12).attr("font-family", BASELINE.fontFamily).attr("font-size", 9.5).attr("fill", "#666").text((iso) => EPISODE_LABELS[iso] ?? "");

    const cx = this.x(dates[Math.min(d.selectedIndex, dates.length - 1)] ?? dates[0]);
    this.cursor.attr("x1", cx).attr("x2", cx).attr("y1", 0).attr("y2", ph).attr("stroke", "#c2462e").attr("stroke-width", 1.4);

    this.axisX.attr("transform", `translate(0,${ph})`);
    if (d.showXAxis) {
      (this.axisX as any).call(d3.axisBottom(this.x).tickValues(yearTicks).tickFormat((v) => String((v as Date).getFullYear())).tickSizeOuter(0));
    } else {
      this.axisX.selectAll("*").remove();
    }
    this.styleAxisBaseline(this.axisX);
    (this.axisY as any).call(d3.axisLeft(this.y).ticks(6).tickSizeOuter(0));
    this.styleAxisBaseline(this.axisY);

    this.gPlot.selectAll("rect.spine").remove();
    this.gPlot.append("rect").attr("class", "spine").attr("width", pw).attr("height", ph).attr("fill", "none").attr("stroke", BASELINE.spineColor).attr("stroke-width", BASELINE.spineWidthPx);

    this.ylabel.attr("transform", `translate(16,${m.top + ph / 2}) rotate(-90)`).attr("font-family", BASELINE.fontFamily).attr("font-size", BASELINE.labelPx).attr("fill", BASELINE.textColor).text(d.ylabel);

    this.overlay.attr("width", pw).attr("height", ph).on("click", (ev: MouseEvent) => this.scrubFromEvent(ev)).on("mousemove", (ev: MouseEvent) => {
      if ((ev.buttons & 1) === 1) this.scrubFromEvent(ev);
    }).on("mouseenter", null).on("mouseleave", null);
  }

  private styleAxisBaseline(sel: d3.Selection<SVGGElement, unknown, null, undefined>) {
    sel.selectAll("path.domain").attr("stroke", "none");
    sel.selectAll("line").attr("stroke", BASELINE.tickColor).attr("stroke-width", BASELINE.tickWidthPx);
    sel.selectAll("text").attr("font-family", BASELINE.fontFamily).attr("font-size", BASELINE.tickLabelPx).attr("fill", BASELINE.textColor);
  }

  // ---------------------------------------------------------------- redesign ----
  private renderRedesign(d: TimelineDatum) {
    const t = d.tokens;
    this.svg.style("background", t.surface);
    const m = MARGIN_REDESIGN;
    const pw = W - m.left - m.right;
    const ph = H - m.top - m.bottom;

    this.title
      .attr("x", m.left)
      .attr("y", 24)
      .attr("text-anchor", "start")
      .attr("font-family", FONTS.display)
      .attr("font-size", REDESIGN.titlePx)
      .attr("font-weight", "600")
      .attr("fill", t.primary)
      .text(d.title);
    this.subtitle
      .attr("x", m.left)
      .attr("y", 42)
      .attr("text-anchor", "start")
      .attr("font-family", FONTS.body)
      .attr("font-size", REDESIGN.subtitlePx)
      .attr("fill", t.secondary)
      .text(d.ylabel);

    const dates = d.dates.map((s) => new Date(s));
    this.x.domain(d3.extent(dates) as [Date, Date]).range([0, pw]);
    const [vmin, vmax] = d3.extent(d.total) as [number, number];
    const pad = (vmax - vmin) * 0.12 || 1;
    this.y.domain([vmin - pad, vmax + pad]).range([ph, 0]);

    this.gPlot.attr("transform", `translate(${m.left},${m.top})`);
    this.gPlot.select("rect.plotbg").attr("width", pw).attr("height", ph).attr("fill", "transparent");

    this.gGridY
      .selectAll("line")
      .data(this.y.ticks(5))
      .join("line")
      .attr("x1", 0).attr("x2", pw).attr("y1", (v) => this.y(v)).attr("y2", (v) => this.y(v))
      .attr("stroke", t.gridline).attr("stroke-width", 1).attr("stroke-opacity", 1);
    this.gGridX.selectAll("*").remove();

    // period bands
    this.gBands.attr("transform", `translate(${m.left},${m.top})`);
    this.gBands
      .selectAll("rect")
      .data(d.periods)
      .join("rect")
      .attr("x", (p) => this.x(new Date(p.start)))
      .attr("width", (p) => Math.max(0, this.x(new Date(p.end)) - this.x(new Date(p.start))))
      .attr("y", 0).attr("height", ph)
      .attr("fill", t.band);

    const line = d3.line<number>().x((_v, i) => this.x(dates[i])).y((v) => this.y(v));
    this.path.attr("d", line(d.total)).attr("stroke", t.primary).attr("stroke-width", REDESIGN.lineWidthPx).attr("stroke-linejoin", "round").attr("stroke-linecap", "round");

    this.meanLine
      .attr("x1", 0).attr("x2", pw)
      .attr("y1", this.y(d.fullSampleTotal)).attr("y2", this.y(d.fullSampleTotal))
      .attr("stroke", t.axis).attr("stroke-width", 1.2);

    // notable weeks: named episodes + the two largest week-over-week jumps + the series
    // extremes -- banded "pulse" stems, inspired by the reference, built from the validated
    // red/blue pair rather than an open hue set
    this.gPulses.selectAll("*").remove();
    const notable = notableIndices(d);
    for (const n of notable) {
      const px = this.x(dates[n.index]);
      const py = this.y(d.total[n.index]);
      const bands = [10, 6.5, 3.5];
      const color = n.kind === "low" ? t.recv : t.send;
      bands.forEach((h, bi) => {
        this.gPulses
          .append("rect")
          .attr("x", px - (3 - bi) * 1.6)
          .attr("width", (3 - bi) * 3.2)
          .attr("y", py - h)
          .attr("height", h * 2)
          .attr("rx", 1.5)
          .attr("fill", color)
          .attr("opacity", 0.16 + bi * 0.17);
      });
      if (n.label) {
        this.gPulses
          .append("text")
          .attr("x", px)
          .attr("y", py - 16)
          .attr("text-anchor", "middle")
          .attr("font-family", FONTS.body)
          .attr("font-size", 10)
          .attr("font-weight", "600")
          .attr("fill", t.secondary)
          .text(n.label);
      }
    }

    const cx = this.x(dates[Math.min(d.selectedIndex, dates.length - 1)] ?? dates[0]);
    this.cursor.attr("x1", cx).attr("x2", cx).attr("y1", 0).attr("y2", ph).attr("stroke", t.primary).attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

    const yearTicks = this.x.ticks(d3.timeYear.every(5)!);
    this.axisX.attr("transform", `translate(0,${ph})`);
    if (d.showXAxis) {
      (this.axisX as any).call(d3.axisBottom(this.x).tickValues(yearTicks).tickFormat((v) => String((v as Date).getFullYear())).tickSizeOuter(0));
    } else {
      this.axisX.selectAll("*").remove();
    }
    this.styleAxisRedesign(this.axisX, t);
    (this.axisY as any).call(d3.axisLeft(this.y).ticks(5).tickSizeOuter(0));
    this.styleAxisRedesign(this.axisY, t);

    this.gPlot.selectAll("rect.spine").remove();
    this.gPlot.append("line").attr("class", "spine").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", ph).attr("stroke", t.axis).attr("stroke-width", 1);
    this.gPlot.append("line").attr("class", "spine").attr("x1", 0).attr("x2", pw).attr("y1", ph).attr("y2", ph).attr("stroke", t.axis).attr("stroke-width", 1);

    this.ylabel.text("");

    // hero number: the selected week's value, otherwise only ever printed to notebook output
    this.hero.selectAll("*").remove();
    const heroVal = d.total[Math.min(d.selectedIndex, d.total.length - 1)];
    const heroG = this.hero.append("g").attr("transform", `translate(${W - m.right + 4},30)`);
    heroG.append("text").attr("text-anchor", "end").attr("font-family", FONTS.data).attr("font-size", REDESIGN.heroPx).attr("font-weight", "600").attr("fill", heroVal >= d.fullSampleTotal ? t.send : t.recv).text(`${heroVal.toFixed(1)}%`);
    heroG.append("text").attr("y", 16).attr("text-anchor", "end").attr("font-family", FONTS.body).attr("font-size", 10.5).attr("fill", t.muted).text(d.measureLabel ? `${d.measureLabel} spillover, this week` : "this week");

    this.overlay.attr("width", pw).attr("height", ph)
      .on("click", (ev: MouseEvent) => this.scrubFromEvent(ev))
      .on("mousemove", (ev: MouseEvent) => {
        if ((ev.buttons & 1) === 1) this.scrubFromEvent(ev);
        this.hoverTooltip(ev, d, t);
      })
      .on("mouseleave", () => hideTooltip());
  }

  private hoverTooltip(ev: MouseEvent, d: TimelineDatum, t: RedesignTokens) {
    const [mx] = d3.pointer(ev, this.gPlot.node());
    const dates = d.dates.map((s) => new Date(s).getTime());
    const target = this.x.invert(mx).getTime();
    let idx = 0;
    for (let i = 1; i < dates.length; i++) if (Math.abs(dates[i] - target) < Math.abs(dates[idx] - target)) idx = i;
    showTooltip(ev.clientX, ev.clientY, d.dates[idx], [
      { label: "total spillover", value: `${d.total[idx].toFixed(2)}%`, swatch: t.primary },
    ]);
  }

  private styleAxisRedesign(sel: d3.Selection<SVGGElement, unknown, null, undefined>, t: RedesignTokens) {
    sel.selectAll("path.domain").attr("stroke", "none");
    sel.selectAll("line").attr("stroke", "none");
    sel.selectAll("text").attr("font-family", FONTS.data).attr("font-size", REDESIGN.tickLabelPx).attr("fill", t.muted);
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

interface Notable {
  index: number;
  label: string | null;
  kind: "episode" | "jump" | "low";
}

function notableIndices(d: TimelineDatum): Notable[] {
  const out: Notable[] = [];
  const dateIndex = (iso: string) => {
    let idx = d.dates.findIndex((x) => x >= iso);
    if (idx === -1) idx = d.dates.length - 1;
    return idx;
  };
  for (const iso of d.episodes) {
    out.push({ index: dateIndex(iso), label: EPISODE_LABELS[iso] ?? null, kind: "episode" });
  }
  // the single highest and lowest weeks in the series, if not already an episode
  let hi = 0, lo = 0;
  d.total.forEach((v, i) => {
    if (v > d.total[hi]) hi = i;
    if (v < d.total[lo]) lo = i;
  });
  if (!out.some((n) => n.index === hi)) out.push({ index: hi, label: "peak", kind: "jump" });
  if (!out.some((n) => n.index === lo)) out.push({ index: lo, label: "low", kind: "low" });
  return out;
}
