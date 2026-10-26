/**
 * "When markets became fragile": the rolling total spillover index (notebook cell 14), with the
 * notebook's own episode dates (cell 15) marked and the four sub-periods (cells 26/27) shaded
 * underneath. Click or drag anywhere on it to pick a week; everything else follows.
 */
import * as d3 from "d3";
import type { DynamicBlock, StaticBlock } from "../data";
import { tightenDecimals, EPISODE_LABELS, type Palette, fmtDate, parseDate } from "../encoding";

const H = 276;
const M = { top: 46, right: 18, bottom: 28, left: 44 };

export interface PeriodBand {
  key: string;
  start: Date;
  end: Date;
  label: string;
  total: number;
}

export class TimelineChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width = 900;
  private dates: Date[] = [];
  private last: Parameters<TimelineChart["render"]> | null = null;

  constructor(
    private host: HTMLElement,
    private onPick: (t: number) => void,
    private onPickPeriod: (key: string) => void,
    private onPickMeasure: (measure: "returns" | "volatility") => void,
    private onHoverWeek: (t: number | null) => void = () => {}
  ) {
    this.svg = d3.select(host).append("svg").attr("class", "timeline").attr("height", H);
    new ResizeObserver(() => {
      const w = Math.round(host.clientWidth);
      if (w && w !== this.width) {
        this.width = w;
        if (this.last) this.render(...this.last);
      }
    }).observe(host);

    let dragging = false;
    const weekAt = (ev: PointerEvent) => {
      const [mx] = d3.pointer(ev, this.svg.node());
      const i = d3.bisector((v: Date) => v).center(this.dates, this.x().invert(mx));
      return i >= 0 && i < this.dates.length ? i : null;
    };
    const pick = (ev: PointerEvent) => {
      const i = weekAt(ev);
      if (i !== null) this.onPick(i);
    };
    this.svg
      .on("pointerdown", (ev: PointerEvent) => {
        if ((ev.target as Element).closest(".band-hit")) return;
        dragging = true;
        (ev.target as Element).setPointerCapture?.(ev.pointerId);
        pick(ev);
      })
      .on("pointermove", (ev: PointerEvent) => {
        if (dragging) return pick(ev);
        // mouse only: on touch, a move is a drag, and there is no hover to preview
        if (ev.pointerType === "mouse") this.onHoverWeek((ev.target as Element).closest(".band-hit") ? null : weekAt(ev));
      })
      .on("pointerleave", () => this.onHoverWeek(null))
      .on("pointerup pointercancel", () => (dragging = false));
  }

  /** room on the right for the two series' end labels */
  private get right() {
    return this.width < 600 ? 74 : 112;
  }

  private x() {
    return d3
      .scaleUtc()
      .domain(d3.extent(this.dates) as [Date, Date])
      .range([M.left, this.width - this.right]);
  }

  /** `dyn` is the measure on show; `other` is drawn behind it, lighter, for comparison. */
  render(
    dyn: DynamicBlock,
    full: StaticBlock,
    episodes: string[],
    periods: PeriodBand[],
    t: number | null,
    activePeriod: string | null,
    p: Palette,
    other: { measure: "returns" | "volatility"; dyn: DynamicBlock } | null = null,
    measure: "returns" | "volatility" = "returns",
    hoverT: number | null = null,
    names: Partial<Record<"returns" | "volatility", string>> = { returns: "Returns", volatility: "Volatility" }
  ) {
    this.last = [dyn, full, episodes, periods, t, activePeriod, p, other, measure, hoverT, names];
    // both measures come from the same balanced panel, so their windows line up week for week
    const cmp = other && other.dyn.total.length === dyn.total.length ? other : null;
    this.dates = dyn.dates.map((d) => parseDate(d)!);
    const W = this.width;
    this.svg.attr("width", W).attr("viewBox", `0 0 ${W} ${H}`);
    const x = this.x();
    const all = cmp ? dyn.total.concat(cmp.dyn.total) : dyn.total;
    const lo = Math.min(d3.min(all)!, full.total);
    const hi = Math.max(d3.max(all)!, full.total);
    const y = d3
      .scaleLinear()
      .domain([Math.floor((lo - 2) / 5) * 5, Math.ceil((hi + 1) / 5) * 5])
      .range([H - M.bottom, M.top]);
    const svg = this.svg;
    svg.selectAll("*").remove();

    // the picked period (from the chips under the chart) is shaded on the chart itself; the
    // chips are the only period control, so there's no second picker strip here
    for (const b of periods) {
      if (b.key !== activePeriod) continue;
      const x0 = Math.max(M.left, x(b.start));
      const x1 = Math.min(W - this.right, x(b.end));
      if (x1 > x0)
        svg.append("rect").attr("x", x0).attr("width", x1 - x0).attr("y", M.top).attr("height", H - M.bottom - M.top).attr("fill", p.band);
    }

    // grid + axes
    const yTicks = y.ticks(5);
    svg
      .append("g")
      .selectAll("line")
      .data(yTicks)
      .join("line")
      .attr("x1", M.left)
      .attr("x2", W - this.right)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", p.grid);
    svg
      .append("g")
      .attr("class", "axis-label")
      .selectAll("text")
      .data(yTicks)
      .join("text")
      .attr("x", M.left - 8)
      .attr("y", (d) => y(d))
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .text((d) => `${d}%`);
    const xTicks = x.ticks(W < 600 ? 5 : 10);
    svg
      .append("g")
      .attr("class", "axis-label")
      .selectAll("text")
      .data(xTicks)
      .join("text")
      .attr("x", (d) => x(d))
      .attr("y", H - M.bottom + 14)
      .attr("text-anchor", "middle")
      .text((d) => d3.utcFormat("%Y")(d));

    // episodes: the notebook's own six dates
    const epi = svg.append("g").attr("class", "episodes");
    const epData = episodes.map((e) => ({ d: parseDate(e)!, label: EPISODE_LABELS[e] ?? e }));
    // pack labels into up to three rows; narrow screens use the short names
    const rowRight = [-Infinity, -Infinity, -Infinity];
    for (const e of epData) {
      const ex = x(e.d);
      const text = W < 700 ? e.label.split(" ")[0] : e.label;
      const textW = text.length * 6.4 + 8;
      let row = rowRight.findIndex((r) => ex - textW / 2 > r);
      if (row < 0) row = 0;
      rowRight[row] = ex + textW / 2;
      e.label = text;
      epi
        .append("line")
        .attr("x1", ex)
        .attr("x2", ex)
        .attr("y1", M.top - 6 - row * 15)
        .attr("y2", H - M.bottom)
        .attr("stroke", p.secondary)
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", "2 3");
      epi
        .append("text")
        .attr("x", ex)
        .attr("y", M.top - 10 - row * 15)
        .attr("text-anchor", "middle")
        .attr("class", "episode-label")
        .attr("fill", p.secondary)
        .text(e.label);
    }

    // full-sample reference line (cell 14's dashed grey mean)
    svg
      .append("line")
      .attr("x1", M.left)
      .attr("x2", W - this.right)
      .attr("y1", y(full.total))
      .attr("y2", y(full.total))
      .attr("stroke", p.muted)
      .attr("stroke-dasharray", "5 4");
    svg
      .append("text")
      .attr("class", "ref-label")
      .attr("x", M.left + 6)
      .attr("y", y(full.total) - 6)
      .attr("fill", p.muted)
      .text("Full sample ")
      .append("tspan")
      .attr("class", "mono")
      .text(`${full.total.toFixed(1)}%`);

    // the other measure: behind, thinner, neutral ink (red/blue would read as sender/receiver)
    if (cmp) {
      const opts = cmp.dyn.total.map((v, i) => [x(this.dates[i]), y(v)] as [number, number]);
      svg
        .append("path")
        .attr("class", "other-line")
        .attr("d", d3.line<[number, number]>()(opts)!)
        .attr("fill", "none")
        .attr("stroke", p.muted)
        .attr("stroke-width", 1.1)
        .attr("stroke-opacity", 0.75)
        .attr("stroke-linejoin", "round");
    }

    const pts = dyn.total.map((v, i) => [x(this.dates[i]), y(v)] as [number, number]);
    svg
      .append("path")
      .attr("d", d3.area<[number, number]>().x((d) => d[0]).y0(H - M.bottom).y1((d) => d[1])(pts)!)
      .attr("fill", p.accent)
      .attr("fill-opacity", 0.08);
    svg
      .append("path")
      .attr("d", d3.line<[number, number]>()(pts)!)
      .attr("fill", "none")
      .attr("stroke", p.fg)
      .attr("stroke-width", 1.6)
      .attr("stroke-linejoin", "round");

    // direct labels at the right end instead of a legend; clicking one switches the page to it
    const NAME = { returns: names.returns ?? "Returns", volatility: names.volatility ?? "Volatility" };
    const ends = [{ m: measure, v: dyn.total[dyn.total.length - 1], on: true }];
    if (cmp) ends.push({ m: cmp.measure, v: cmp.dyn.total[cmp.dyn.total.length - 1], on: false });
    const endY = ends.map((e) => y(e.v));
    if (endY.length === 2 && Math.abs(endY[0] - endY[1]) < 30) {
      const mid = (endY[0] + endY[1]) / 2;
      const up = endY[0] <= endY[1] ? 0 : 1;
      endY[up] = mid - 15;
      endY[1 - up] = mid + 15;
    }
    const lastX = x(this.dates[this.dates.length - 1]);
    ends.forEach((e, i) => {
      const g = svg
        .append("g")
        .attr("class", `end-label${e.on ? " on" : ""}`)
        .attr("transform", `translate(${lastX + 8},${endY[i]})`);
      if (!e.on) {
        g.attr("role", "button")
          .attr("tabindex", 0)
          .attr("aria-label", `Show ${NAME[e.m].toLowerCase()} on every chart`)
          .on("click", () => this.onPickMeasure(e.m))
          .on("keydown", (ev: KeyboardEvent) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              this.onPickMeasure(e.m);
            }
          });
      }
      g.append("text").attr("class", "end-name").attr("y", -2).attr("fill", e.on ? p.fg : p.muted).text(NAME[e.m]);
      g.append("text").attr("class", "end-value axis-label").attr("y", 12).attr("fill", e.on ? p.fg : p.muted).text(`${e.v.toFixed(1)}%`);
    });

    // the week under the pointer: a quiet guide; its numbers are in the readout above the chart
    if (hoverT !== null && hoverT !== t) {
      const hx = x(this.dates[hoverT]);
      svg.append("line").attr("class", "hover-guide").attr("x1", hx).attr("x2", hx).attr("y1", M.top).attr("y2", H - M.bottom).attr("stroke", p.fg).attr("stroke-opacity", 0.35).attr("stroke-dasharray", "3 3");
      svg.append("circle").attr("cx", hx).attr("cy", y(dyn.total[hoverT])).attr("r", 4).attr("fill", p.fg);
      if (cmp) svg.append("circle").attr("cx", hx).attr("cy", y(cmp.dyn.total[hoverT])).attr("r", 3).attr("fill", p.panel).attr("stroke", p.muted).attr("stroke-width", 1.5);
    }

    // the selected week
    if (t !== null) {
      const cx = x(this.dates[t]);
      const cy = y(dyn.total[t]);
      svg
        .append("line")
        .attr("x1", cx)
        .attr("x2", cx)
        .attr("y1", M.top)
        .attr("y2", H - M.bottom)
        .attr("stroke", p.accent)
        .attr("stroke-width", 1.5);
      if (cmp) {
        const oy = y(cmp.dyn.total[t]);
        // near the right edge the end label already shows this value, so skip the duplicate
        const nearEnd = cx > lastX - 70;
        svg.append("circle").attr("cx", cx).attr("cy", oy).attr("r", 4).attr("fill", p.panel).attr("stroke", p.muted).attr("stroke-width", 1.5);
        if (!nearEnd) svg
          .append("text")
          .attr("class", "other-value axis-label")
          .attr("x", cx + (cx > W - this.right - 60 ? -8 : 8))
          .attr("y", oy)
          .attr("dy", "0.35em")
          .attr("text-anchor", cx > W - this.right - 60 ? "end" : "start")
          .attr("fill", p.secondary)
          .text(`${cmp.dyn.total[t].toFixed(1)}%`);
      }
      svg.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 5.5).attr("fill", p.accent).attr("stroke", p.panel).attr("stroke-width", 2);
      const label = `${dyn.total[t].toFixed(1)}% · ${fmtDate(this.dates[t])}`;
      const lw = label.length * 7.8 + 18; // B612 Mono: ~0.65em per glyph at 12px bold
      const lx = Math.min(Math.max(cx - lw / 2, M.left), W - this.right - lw);
      const ly = cy - 34 < M.top ? cy + 12 : cy - 34;
      svg.append("rect").attr("x", lx).attr("y", ly).attr("width", lw).attr("height", 22).attr("rx", 11).attr("fill", p.fg); // ink pill: text never sits on the highlight (AAA)
      svg
        .append("text")
        .attr("class", "cursor-label")
        .attr("x", lx + lw / 2)
        .attr("y", ly + 11)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .style("fill", "var(--panel)")
        .text(label);
    }
    tightenDecimals(this.svg.node()!, ".axis-label, .row-value, .cursor-label, .band-label, .mono");
  }
}
