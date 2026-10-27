/**
 * The first graph drawn as beads on strings (after Yaacov Agam's kinetic prints). Same numbers as
 * the line chart, all from the library's dynamic_connectedness, on one % scale:
 *   - each vertical string is one step in time (sampled to fit the width);
 *   - the dark beads are the rolling spillover index (`total`);
 *   - the coloured beads are the regions (the average of their items), or, with one region
 *     picked, its items. A bead's height on the string is how much of its moves came from shocks
 *     elsewhere (`directional_from`, the same % as the index: the index is its average over every
 *     item).
 * The strings are solid up to the index, so they draw its rise and fall, the point of the graph;
 * the regions sit around it, smaller, told apart by colour. Beads are painted on a canvas; the cursor, labels and axis are SVG on top, so a hover
 * redraws only the overlay.
 */
import * as d3 from "d3";
import type { DynamicBlock } from "../data";
import { EPISODE_LABELS, type Palette, fmtDate, parseDate, spreadMarks, tightenDecimals } from "../encoding";
import type { PeriodBand } from "./timeline";

export interface BeadColors {
  ink: string;
  hues: string[];
}

export function readBeadColors(): BeadColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { ink: v("--bead-ink"), hues: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--bead-${i}`)) };
}

const H = 390;
const M = { top: 66, bottom: 28, left: 44 }; // room above for the value tag and the insight marks
const BEAD_H = 12; // the index bead's length along its string
const SIDE_H = 6; // a region's or item's

interface Series {
  label: string;
  /** an item's name, when the series is one item */
  item: string | null;
  group: string;
  /** column indices of the items averaged in this series (one, for an item) */
  members: number[];
  hue: string;
  fringe: string;
}

export class BeadsChart {
  private canvas: HTMLCanvasElement;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width = 900;
  private T = 0;
  private last: Parameters<BeadsChart["render"]> | null = null;
  private paintedKey = "";
  private series: Series[] = [];
  private y = d3.scaleLinear();
  private dyn: DynamicBlock | null = null;

  constructor(
    private host: HTMLElement,
    private names: string[],
    private groupOf: Record<string, string>,
    private groupOrder: string[],
    private onPick: (t: number) => void,
    private onHoverWeek: (t: number | null) => void,
    private onHoverItem: (name: string | null) => void,
    private onPickRegion: (group: string | null) => void
  ) {
    host.classList.add("beads-host");
    this.canvas = document.createElement("canvas");
    host.appendChild(this.canvas);
    this.svg = d3.select(host).append("svg").attr("class", "beads-overlay");
    new ResizeObserver(() => {
      const w = Math.round(host.clientWidth);
      if (w && w !== this.width) {
        this.width = w;
        this.paintedKey = "";
        if (this.last) this.render(...this.last);
      }
    }).observe(host);

    let dragging = false;
    this.svg
      .on("pointerdown", (ev: PointerEvent) => {
        const label = (ev.target as Element).closest<SVGGElement>("[data-region]");
        if (label) return this.onPickRegion(label.dataset.region!);
        dragging = true;
        (ev.target as Element).setPointerCapture?.(ev.pointerId);
        const t = this.tAt(d3.pointer(ev, this.svg.node())[0]);
        if (t !== null) this.onPick(t);
      })
      .on("pointermove", (ev: PointerEvent) => {
        const [mx, my] = d3.pointer(ev, this.svg.node());
        const t = this.tAt(mx);
        if (dragging) {
          if (t !== null) this.onPick(t);
          return;
        }
        if (ev.pointerType !== "mouse") return;
        this.onHoverWeek(t);
        this.onHoverItem(t === null ? null : this.itemNear(t, my));
      })
      .on("pointerleave", () => {
        this.onHoverWeek(null);
        this.onHoverItem(null);
      })
      .on("pointerup pointercancel", () => (dragging = false));
  }

  private get right() {
    return this.width < 600 ? 84 : 120; // the end labels
  }

  private get plotW() {
    return this.width - M.left - this.right;
  }

  /** column spacing: about one string every 20 px (12 on a phone), so there's air between them */
  private get pitch() {
    const target = this.width < 600 ? 12 : 20;
    const n = Math.max(12, Math.floor(this.plotW / target));
    return this.plotW / n;
  }

  private xOf(t: number) {
    const p = this.pitch;
    return M.left + p / 2 + (this.T > 1 ? (t / (this.T - 1)) * (this.plotW - p) : 0);
  }

  private tAt(mx: number): number | null {
    const p = this.pitch;
    if (mx < M.left - p || mx > M.left + this.plotW + p) return null;
    const f = (mx - M.left - p / 2) / (this.plotW - p);
    return Math.max(0, Math.min(this.T - 1, Math.round(f * (this.T - 1))));
  }

  private value(s: Series, m: number[][], t: number) {
    return d3.mean(s.members, (i) => m[t][i])!;
  }

  /** the item whose bead is nearest the pointer on this step, when an item is on show */
  private itemNear(t: number, my: number): string | null {
    if (!this.dyn) return null;
    let best: { item: string; d: number } | null = null;
    for (const s of this.series) {
      if (!s.item) continue;
      const d = Math.abs(this.y(this.value(s, this.dyn.from, t)) - my);
      if (d < 10 && (!best || d < best.d)) best = { item: s.item, d };
    }
    return best?.item ?? null;
  }

  private get groups() {
    return this.groupOrder.filter((g) => this.names.some((n) => this.groupOf[n] === g));
  }

  /** `region`: null shows every region (or every item, when there's only one region) */
  render(
    dyn: DynamicBlock,
    periods: PeriodBand[],
    t: number | null,
    activePeriod: string | null,
    p: Palette,
    c: BeadColors,
    hoverT: number | null,
    hoveredItem: string | null,
    region: string | null,
    paintKey: string,
    marks: number[] = [],
    longRun: number | null = null
  ) {
    this.last = [dyn, periods, t, activePeriod, p, c, hoverT, hoveredItem, region, paintKey, marks, longRun];
    this.dyn = dyn;
    this.T = dyn.dates.length;
    const groups = this.groups;
    const multi = groups.length > 1;
    const hue = (i: number) => [c.hues[i % c.hues.length], c.hues[(i + 1) % c.hues.length]];
    const idx = (g: string) => this.names.flatMap((n, i) => (this.groupOf[n] === g ? [i] : []));
    if (multi && !region) {
      this.series = groups.map((g, gi) => {
        const [h, f] = hue(gi);
        return { label: g, item: null, group: g, members: idx(g), hue: h, fringe: f };
      });
    } else {
      const shown = region ? idx(region) : this.names.map((_, i) => i);
      this.series = shown.map((i, k) => {
        // one colour per item: the picked region is already named by its chip
        const [h, f] = hue(k);
        return { label: this.names[i], item: this.names[i], group: this.groupOf[this.names[i]], members: [i], hue: h, fringe: f };
      });
    }

    // one % scale for the index and every series' directional_from, fixed across every step
    let lo = d3.min(dyn.total)!;
    let hi = d3.max(dyn.total)!;
    for (const s of this.series)
      for (let ti = 0; ti < this.T; ti++) {
        const v = this.value(s, dyn.from, ti);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    this.y = d3
      .scaleLinear()
      .domain([Math.floor((lo - 1) / 5) * 5, Math.ceil((hi + 1) / 5) * 5])
      .range([H - M.bottom - BEAD_H / 2, M.top + BEAD_H / 2]);

    const key = `${paintKey}|${this.width}|${activePeriod}|${this.T}|${region}`;
    if (key !== this.paintedKey) {
      this.paint(dyn, periods, activePeriod, c, p.panel);
      this.paintedKey = key;
    }
    this.overlay(dyn, t, p, hoverT, hoveredItem, multi && !region, marks, longRun);
  }

  /** the beads themselves: only when the data, size, theme, period or region changes */
  /** the floor the strings stand on: the bottom of the % scale, not 0 */
  get floor() {
    return this.y.domain()[0];
  }

  private paint(dyn: DynamicBlock, periods: PeriodBand[], activePeriod: string | null, c: BeadColors, panel: string) {
    const dpr = Math.max(2, window.devicePixelRatio || 1); // at least 2x: sharp in a downloaded figure too
    const W = this.width;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    const ctx = this.canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const pitch = this.pitch;
    const nCols = Math.round(this.plotW / pitch);
    const cols = d3.range(nCols).map((j) => Math.round((j * (this.T - 1)) / Math.max(1, nCols - 1)));
    const maxW = pitch * 0.9;
    // width: what the series passes on, from its lowest to its highest over the series on show
    const tos = this.series.flatMap((s) => d3.range(this.T).map((ti) => this.value(s, dyn.to, ti)));
    const [toLo, toHi] = d3.extent(tos) as [number, number];
    const sideW = pitch * 0.62; // the series' beads stay smaller than the index's
    const wTo = (v: number) => 2.5 + (sideW - 2.5) * ((v - toLo) / Math.max(1e-9, toHi - toLo));
    const active = periods.find((b) => b.key === activePeriod) ?? null;
    const dates = dyn.dates.map((d) => parseDate(d)!);
    const y = this.y;

    cols.forEach((ti) => {
      const x = this.xOf(ti);
      const inside = !active || (dates[ti] >= active.start && dates[ti] <= active.end);
      const alpha = inside ? 1 : 0.16;
      const top = y(dyn.total[ti]);
      // the string: faint all the way up, solid from the floor to the index, so the strings
      // themselves draw the index rising and falling
      ctx.fillStyle = c.ink;
      ctx.globalAlpha = alpha * 0.16;
      ctx.fillRect(x - 0.5, M.top, 1, H - M.bottom - M.top);
      ctx.globalAlpha = alpha;
      ctx.fillRect(x - 1, top, 2, H - M.bottom - top);
      // the series: a small colour bead with a sliver of the next hue offset beside it, like a misprint
      ctx.globalAlpha = alpha * 0.92;
      for (const s of this.series) {
        const cy = y(this.value(s, dyn.from, ti));
        const w = sideW; // one width: the width encoding couldn't be seen at this size
        ctx.fillStyle = s.fringe;
        ctx.fillRect(x - w / 2 + 1.2, cy - SIDE_H / 2, w, SIDE_H);
        ctx.fillStyle = s.hue;
        ctx.fillRect(x - w / 2, cy - SIDE_H / 2, w, SIDE_H);
      }
      // the index, on top: the big dark bead
      ctx.globalAlpha = alpha;
      ctx.fillStyle = c.ink;
      ctx.fillRect(x - maxW / 2, top - BEAD_H / 2, maxW, BEAD_H);
      // a gap of page colour around it, so a region bead at the same height can't merge into it
      ctx.strokeStyle = panel;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - maxW / 2 - 1, top - BEAD_H / 2 - 1, maxW + 2, BEAD_H + 2);
    });
    ctx.globalAlpha = 1;
  }

  /** axis, end labels, episodes, the picked step and the hover: cheap, redrawn every time */
  private overlay(dyn: DynamicBlock, t: number | null, p: Palette, hoverT: number | null, hoveredItem: string | null, regionsShown: boolean, marks: number[], longRun: number | null) {
    const W = this.width;
    const svg = this.svg.attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
    svg.selectAll("*").remove();
    const dates = dyn.dates.map((d) => parseDate(d)!);
    const bottom = H - M.bottom;
    const small = W < 600;
    const y = this.y;

    // the floor the strings stand on, named: the scale starts there, not at 0
    const floorY = bottom;
    svg.append("line").attr("x1", M.left).attr("x2", M.left + this.plotW).attr("y1", floorY).attr("y2", floorY).attr("stroke", p.axis);
    svg
      .append("text")
      .attr("class", "axis-label beads-floor")
      .attr("x", M.left - 10)
      .attr("y", floorY)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", p.secondary)
      .text(`${this.floor}%`)
      .append("title")
      .text(`The strings start at ${this.floor}%, not at 0`);

    // a few % ticks, quiet
    svg
      .append("g")
      .attr("class", "axis-label")
      .selectAll("text")
      .data(y.ticks(4).filter((d) => floorY - y(d) > 16))
      .join("text")
      .attr("x", M.left - 10)
      .attr("y", (d) => y(d))
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", p.muted)
      .text((d) => `${d}%`);

    // years along the bottom
    const years = d3.utcYear.range(dates[0], dates[dates.length - 1]);
    const every = Math.max(1, Math.ceil(years.length / (small ? 4 : 9)));
    const tOf = (d: Date) => d3.bisector((v: Date) => v).center(dates, d);
    svg
      .append("g")
      .attr("class", "axis-label")
      .selectAll("text")
      .data(years.filter((_, i) => i % every === 0))
      .join("text")
      .attr("x", (d) => this.xOf(tOf(d)))
      .attr("y", bottom + 20)
      .attr("text-anchor", "middle")
      .attr("fill", p.muted)
      .text((d) => d.getUTCFullYear());

    // the long-run level (the full-sample static total), dashed, named at its left end
    if (longRun !== null && longRun >= y.domain()[0] && longRun <= y.domain()[1]) {
      const ly = y(longRun);
      svg.append("line").attr("x1", M.left).attr("x2", M.left + this.plotW).attr("y1", ly).attr("y2", ly).attr("stroke", p.fg).attr("stroke-width", 1.2).attr("stroke-dasharray", "4 4").attr("opacity", 0.8);
      svg.append("text").attr("class", "beads-longrun").attr("x", M.left + 4).attr("y", ly - 6).attr("fill", p.fg).text(`long-run ${longRun.toFixed(1)}%`);
    }

    // the insights beside the chart, numbered where they point
    // (two that point at nearly the same step sit side by side, each stemmed to its string)
    const markX = spreadMarks(marks.map((mt) => this.xOf(mt)), 21, M.left + 10, this.xOf(this.T - 1)); // the hint sits right of the last string
    marks.forEach((mt, i) => {
      const x = this.xOf(mt);
      const cx = markX[i];
      const g = svg.append("g").attr("class", "beads-mark");
      g.append("line").attr("x1", x).attr("x2", cx).attr("y1", M.top - 2).attr("y2", M.top - 11).attr("stroke", p.fg).attr("stroke-width", 1.2);
      g.append("circle").attr("cx", cx).attr("cy", M.top - 20).attr("r", 9).attr("fill", p.panel).attr("stroke", p.fg).attr("stroke-width", 1.5);
      g.append("text").attr("x", cx).attr("y", M.top - 20).attr("dy", "0.35em").attr("text-anchor", "middle").attr("fill", p.fg).text(String(i + 1));
    });

    // notable events: a small mark under the strings, named on hover
    const ep = svg.append("g").attr("class", "beads-episodes");
    for (const e of Object.keys(EPISODE_LABELS)) {
      const d = parseDate(e);
      if (!d || d < dates[0] || d > dates[dates.length - 1]) continue;
      const x = this.xOf(tOf(d));
      const g = ep.append("g");
      g.append("path").attr("d", `M${x},${bottom + 2} l4,6 l-8,0 z`).attr("fill", p.crisis);
      g.append("title").text(`${EPISODE_LABELS[e]} · ${fmtDate(d)}`);
    }

    // end labels at each series' value on the step shown (picked, or the last); regions open up
    const at = t ?? this.T - 1;
    const labels = [
      { text: small ? "Index" : "Spillover index", v: dyn.total[at], color: p.fg, region: null as string | null, item: null as string | null, bold: true },
      ...this.series.map((s) => ({ text: s.label, v: this.value(s, dyn.from, at), color: s.hue, region: s.item ? null : s.group, item: s.item, bold: !s.item })),
    ].map((l) => ({ ...l, y: y(l.v) }));
    // nudge apart so no two overlap
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 13);
    const over = labels.length ? labels[labels.length - 1].y - (H - M.bottom) : 0;
    if (over > 0) for (const l of labels) l.y -= over;
    const ends = svg.append("g").attr("class", "beads-ends");
    const xEnd = M.left + this.plotW + 8;
    const max = small ? 10 : 16;
    for (const l of labels) {
      const g = ends.append("g");
      if (l.region) g.attr("data-region", l.region).attr("class", "beads-region");
      const on = l.item !== null && l.item === hoveredItem;
      g.append("rect").attr("x", xEnd).attr("y", l.y - 4).attr("width", 8).attr("height", 8).attr("rx", 1.5).attr("fill", l.color);
      g.append("text")
        .attr("x", xEnd + 13)
        .attr("y", l.y)
        .attr("dy", "0.35em")
        .attr("class", l.bold || on ? "on" : null)
        .attr("fill", p.fg)
        .text(l.text.length > max ? `${l.text.slice(0, max - 1)}…` : l.text);
      if (l.region) g.append("title").text(`Open ${l.region}`);
    }
    if (regionsShown && !small)
      svg
        .append("text")
        .attr("class", "beads-hint")
        .attr("x", xEnd)
        .attr("y", M.top - 18)
        .attr("fill", p.muted)
        .text("Click a region to open it");

    // a hovered item: a ring around its bead on every string
    const hs = this.series.find((s) => s.item !== null && s.item === hoveredItem);
    if (hs) {
      const pts = d3.range(0, this.T, Math.max(1, Math.round(this.T / 160))).map((ti) => [this.xOf(ti), y(this.value(hs, dyn.from, ti))] as [number, number]);
      svg.append("path").attr("d", d3.line()(pts)).attr("fill", "none").attr("stroke", p.fg).attr("stroke-width", 1.2).attr("stroke-opacity", 0.55);
    }

    // the hovered step: a thin ring around its string
    if (hoverT !== null && hoverT !== t) {
      const x = this.xOf(hoverT);
      svg
        .append("rect")
        .attr("x", x - this.pitch / 2)
        .attr("y", M.top - 4)
        .attr("width", this.pitch)
        .attr("height", bottom - M.top + 4)
        .attr("rx", 3)
        .attr("fill", "none")
        .attr("stroke", p.fg)
        .attr("stroke-opacity", 0.45);
    }

    // the picked step: an accent ring and its value
    if (t !== null) {
      const x = this.xOf(t);
      svg
        .append("rect")
        .attr("x", x - this.pitch / 2)
        .attr("y", M.top - 4)
        .attr("width", this.pitch)
        .attr("height", bottom - M.top + 4)
        .attr("rx", 3)
        .attr("fill", "none")
        .attr("stroke", p.accent)
        .attr("stroke-width", 2);
      const label = `${dyn.total[t].toFixed(1)}%`; // the date is in the sentence above
      const lw = label.length * 7.8 + 18;
      const lx = Math.min(Math.max(x - lw / 2, M.left), M.left + this.plotW - lw);
      svg.append("rect").attr("x", lx).attr("y", 4).attr("width", lw).attr("height", 22).attr("rx", 11).attr("fill", p.panel).attr("stroke", p.accent).attr("stroke-width", 2); // stone text on the card, ringed in the highlight
      svg
        .append("text")
        .attr("class", "cursor-label")
        .attr("x", lx + lw / 2)
        .attr("y", 15)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .style("fill", "var(--stone)")
        .text(label);
    }
    tightenDecimals(svg.node()!, ".axis-label, .cursor-label");
  }
}
