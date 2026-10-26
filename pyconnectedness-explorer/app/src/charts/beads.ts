/**
 * The first graph drawn as beads on strings (after Yaacov Agam's kinetic prints). Same numbers as
 * the line chart, all from the library's dynamic_connectedness:
 *   - each vertical string is one step in time (sampled to fit the width);
 *   - the top row is the rolling spillover index itself (`total`);
 *   - below it, one row per region in the region's colour (the average of its items), or, with a
 *     region picked, one row per item of that region. A bead's colour widens with what the row
 *     passes to the others (`directional_to`); its dark core, with what it takes from them
 *     (`directional_from`). Each starts at its measure's usual level (the median), so a quiet
 *     stretch is bare string and the beads gather where shocks spread.
 * Beads are painted on a canvas (thousands of them); the cursor, labels and axis are SVG on top,
 * so a hover redraws only the overlay.
 */
import * as d3 from "d3";
import type { DynamicBlock } from "../data";
import { EPISODE_LABELS, type Palette, fmtDate, parseDate, tightenDecimals } from "../encoding";
import type { PeriodBand } from "./timeline";

export interface BeadColors {
  ink: string;
  hues: string[];
}

export function readBeadColors(): BeadColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { ink: v("--bead-ink"), hues: [1, 2, 3, 4, 5, 6].map((i) => v(`--bead-${i}`)) };
}

const TOP = 34; // room for the cursor's pill
const HEADER = 30; // the spillover-index row
const GAP = 14; // between the header and the rows, and between region rows
const BOTTOM = 26;

interface Row {
  label: string;
  /** an item's name, when the row is one item */
  item: string | null;
  /** the region the row belongs to (or is) */
  group: string;
  /** column indices of the items averaged in this row (one, for an item row) */
  members: number[];
  y: number;
  h: number;
}

export class BeadsChart {
  private canvas: HTMLCanvasElement;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width = 900;
  private height = 400;
  private T = 0;
  private last: Parameters<BeadsChart["render"]> | null = null;
  private paintedKey = "";
  private rows: Row[] = [];

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
    const at = (ev: PointerEvent) => {
      const [mx, my] = d3.pointer(ev, this.svg.node());
      const row = this.rows.find((r) => my >= r.y && my < r.y + r.h) ?? null;
      return { t: this.tAt(mx), row, onLabel: mx < this.left - 4 };
    };
    this.svg
      .on("pointerdown", (ev: PointerEvent) => {
        const { t, row, onLabel } = at(ev);
        // a region's name opens it up into its items
        if (onLabel) {
          if (row && !row.item) this.onPickRegion(row.group);
          return;
        }
        dragging = true;
        (ev.target as Element).setPointerCapture?.(ev.pointerId);
        if (t !== null) this.onPick(t);
      })
      .on("pointermove", (ev: PointerEvent) => {
        const { t, row, onLabel } = at(ev);
        if (dragging) {
          if (t !== null) this.onPick(t);
          return;
        }
        if (ev.pointerType !== "mouse") return;
        this.svg.style("cursor", onLabel ? (row && !row.item ? "pointer" : "default") : "crosshair");
        this.onHoverWeek(onLabel ? null : t);
        this.onHoverItem(row?.item ?? null);
      })
      .on("pointerleave", () => {
        this.onHoverWeek(null);
        this.onHoverItem(null);
      })
      .on("pointerup pointercancel", () => (dragging = false));
  }

  private get left() {
    return this.width < 600 ? 92 : 132;
  }

  private get plotW() {
    return this.width - this.left - 12;
  }

  /** column spacing: about one string every 20 px (12 on a phone), so there's air between them */
  private get pitch() {
    const target = this.width < 600 ? 12 : 20;
    const n = Math.max(12, Math.floor(this.plotW / target));
    return this.plotW / n;
  }

  private xOf(t: number) {
    const p = this.pitch;
    return this.left + p / 2 + (this.T > 1 ? (t / (this.T - 1)) * (this.plotW - p) : 0);
  }

  private tAt(mx: number): number | null {
    const p = this.pitch;
    if (mx < this.left - p || mx > this.left + this.plotW + p) return null;
    const f = (mx - this.left - p / 2) / (this.plotW - p);
    return Math.max(0, Math.min(this.T - 1, Math.round(f * (this.T - 1))));
  }

  private get groups() {
    return this.groupOrder.filter((g) => this.names.some((n) => this.groupOf[n] === g));
  }

  /** `region`: null shows every region as one row (or every item, when there's only one region) */
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
    paintKey: string
  ) {
    this.last = [dyn, periods, t, activePeriod, p, c, hoverT, hoveredItem, region, paintKey];
    this.T = dyn.dates.length;
    const groups = this.groups;
    const idx = (g: string) => this.names.flatMap((n, i) => (this.groupOf[n] === g ? [i] : []));
    let y = TOP + HEADER + GAP;
    this.rows = [];
    if (!region && groups.length > 1) {
      // one row per region, tall, in its own colour
      for (const g of groups) {
        this.rows.push({ label: g, item: null, group: g, members: idx(g), y, h: 34 });
        y += 34 + GAP;
      }
    } else {
      const shown = region ? idx(region) : this.names.map((_, i) => i);
      const h = Math.max(12, Math.min(22, Math.floor(300 / shown.length)));
      for (const i of shown) {
        this.rows.push({ label: this.names[i], item: this.names[i], group: this.groupOf[this.names[i]], members: [i], y, h });
        y += h;
      }
      y += GAP;
    }
    this.height = y - GAP + BOTTOM;

    const key = `${paintKey}|${this.width}|${activePeriod}|${this.T}|${region}`;
    if (key !== this.paintedKey) {
      this.paint(dyn, periods, activePeriod, c, groups);
      this.paintedKey = key;
    }
    this.overlay(dyn, t, p, hoverT, hoveredItem);
  }

  /** the beads themselves: only when the data, size, theme, period or region changes */
  private paint(dyn: DynamicBlock, periods: PeriodBand[], activePeriod: string | null, c: BeadColors, groups: string[]) {
    const dpr = window.devicePixelRatio || 1;
    const W = this.width;
    const H = this.height;
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
    const maxW = pitch * 0.86;
    const mean = (row: Row, m: number[][], ti: number) => d3.mean(row.members, (i) => m[ti][i])!;
    // Each measure's beads start at its usual level on the rows shown (the median over every step
    // and row) and reach full width at its highest: below the usual level there's only the
    // string. Fixed across every step, so a bead means the same width everywhere.
    const allTo: number[] = [];
    const allFrom: number[] = [];
    for (let ti = 0; ti < this.T; ti++)
      for (const r of this.rows) {
        allTo.push(mean(r, dyn.to, ti));
        allFrom.push(mean(r, dyn.from, ti));
      }
    const ramp = (vals: number[], width: number) => {
      const lo = d3.quantile(vals, 0.5)!;
      const hi = d3.max(vals)!;
      return (v: number) => width * Math.max(0, Math.min(1, (v - lo) / Math.max(1e-9, hi - lo)));
    };
    const wTo = ramp(allTo, maxW);
    const wFrom = ramp(allFrom, maxW * 0.5);
    const wTotal = ramp(dyn.total, maxW);

    // a region keeps its colour whether it's one row or opened up into its items
    const multi = groups.length > 1;
    const hueOf = (r: Row, row: number) => {
      const i = multi ? groups.indexOf(r.group) : row;
      return [c.hues[i % c.hues.length], c.hues[(i + 1) % c.hues.length]];
    };
    const active = periods.find((b) => b.key === activePeriod) ?? null;
    const dates = dyn.dates.map((d) => parseDate(d)!);
    const bottom = H - BOTTOM;

    cols.forEach((ti) => {
      const x = this.xOf(ti);
      const inside = !active || (dates[ti] >= active.start && dates[ti] <= active.end);
      ctx.globalAlpha = inside ? 1 : 0.16;
      // the string
      ctx.fillStyle = c.ink;
      ctx.fillRect(x - 0.6, TOP, 1.2, bottom - TOP);
      // the spillover index row
      const wt = Math.max(1.2, wTotal(dyn.total[ti]));
      ctx.fillRect(x - wt / 2, TOP + 4, wt, HEADER - 8);
      // the rows: a colour bead (passes on), a sliver of the next hue offset beside it, the core (takes in)
      this.rows.forEach((r, row) => {
        const [hue, fringe] = hueOf(r, row);
        const a = wTo(mean(r, dyn.to, ti));
        const b = wFrom(mean(r, dyn.from, ti));
        if (a > 1.5) {
          ctx.fillStyle = fringe;
          ctx.fillRect(x - a / 2 + 1.5, r.y, a, r.h);
          ctx.fillStyle = hue;
          ctx.fillRect(x - a / 2, r.y, a, r.h);
        }
        if (b > 1.5) {
          ctx.fillStyle = c.ink;
          ctx.fillRect(x - b / 2, r.y, b, r.h);
        }
      });
    });
    ctx.globalAlpha = 1;
  }

  /** labels, axis, episodes, the picked step and the hover: cheap, redrawn every time */
  private overlay(dyn: DynamicBlock, t: number | null, p: Palette, hoverT: number | null, hoveredItem: string | null) {
    const W = this.width;
    const H = this.height;
    const svg = this.svg.attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
    svg.selectAll("*").remove();
    const dates = dyn.dates.map((d) => parseDate(d)!);
    const bottom = H - BOTTOM;
    const small = W < 600;

    // left labels: the index row, then the regions (clickable) or the items
    const lab = svg.append("g").attr("class", "beads-labels");
    lab
      .append("text")
      .attr("x", this.left - 12)
      .attr("y", TOP + HEADER / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("class", "beads-index")
      .attr("fill", p.fg)
      .text(small ? "Index" : "Spillover index");
    const max = small ? 11 : 18;
    for (const r of this.rows) {
      const on = r.item !== null && r.item === hoveredItem;
      const g = lab.append("g").attr("class", r.item ? "beads-item" : "beads-region");
      g.append("text")
        .attr("x", this.left - 12)
        .attr("y", r.y + r.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("class", on ? "on" : null)
        .attr("fill", on || !r.item ? p.fg : p.secondary)
        .text(r.label.length > max ? `${r.label.slice(0, max - 1)}…` : r.label);
      if (!r.item) {
        g.append("text")
          .attr("x", this.left - 12)
          .attr("y", r.y + r.h / 2 + 14)
          .attr("dy", "0.35em")
          .attr("text-anchor", "end")
          .attr("class", "beads-count")
          .attr("fill", p.muted)
          .text(`${r.members.length} · open ›`);
      }
    }

    // a hovered item: a quiet ring around its row
    const hr = this.rows.find((r) => r.item !== null && r.item === hoveredItem);
    if (hr)
      svg
        .append("rect")
        .attr("x", this.left - 4)
        .attr("y", hr.y - 1)
        .attr("width", this.plotW + 8)
        .attr("height", hr.h + 2)
        .attr("rx", 3)
        .attr("fill", "none")
        .attr("stroke", p.fg)
        .attr("stroke-opacity", 0.35);

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
      .attr("y", bottom + 18)
      .attr("text-anchor", "middle")
      .attr("fill", p.muted)
      .text((d) => d.getUTCFullYear());

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

    // the hovered step: a thin ring around its string
    if (hoverT !== null && hoverT !== t) {
      const x = this.xOf(hoverT);
      svg
        .append("rect")
        .attr("x", x - this.pitch / 2)
        .attr("y", TOP)
        .attr("width", this.pitch)
        .attr("height", bottom - TOP)
        .attr("rx", 3)
        .attr("fill", "none")
        .attr("stroke", p.fg)
        .attr("stroke-opacity", 0.45);
    }

    // the picked step: an accent string and its value
    if (t !== null) {
      const x = this.xOf(t);
      svg
        .append("rect")
        .attr("x", x - this.pitch / 2)
        .attr("y", TOP)
        .attr("width", this.pitch)
        .attr("height", bottom - TOP)
        .attr("rx", 3)
        .attr("fill", "none")
        .attr("stroke", p.accent)
        .attr("stroke-width", 2);
      const label = `${dyn.total[t].toFixed(1)}% · ${fmtDate(dates[t])}`;
      const lw = label.length * 7.8 + 18;
      const lx = Math.min(Math.max(x - lw / 2, this.left), W - 12 - lw);
      svg.append("rect").attr("x", lx).attr("y", 4).attr("width", lw).attr("height", 22).attr("rx", 11).attr("fill", p.accent);
      svg
        .append("text")
        .attr("class", "cursor-label")
        .attr("x", lx + lw / 2)
        .attr("y", 15)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("fill", "#fff")
        .text(label);
    }
    tightenDecimals(svg.node()!, ".axis-label, .cursor-label");
  }
}
