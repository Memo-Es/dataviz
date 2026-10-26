/**
 * The first graph drawn as beads on strings (after Yaacov Agam's kinetic prints). Same numbers as
 * the line chart, all from the library's dynamic_connectedness:
 *   - each vertical string is one step in time (sampled to fit the width);
 *   - the top row is the rolling spillover index itself (`total`);
 *   - every other row is one item, grouped as in the network. Its coloured bead widens with what
 *     the item passes to the others (`directional_to`); its dark core, with what it takes from them
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
const GAP = 14; // between the header and the first group, and between groups
const BOTTOM = 26;

export class BeadsChart {
  private canvas: HTMLCanvasElement;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width = 900;
  private height = 400;
  private T = 0;
  private last: Parameters<BeadsChart["render"]> | null = null;
  private paintedKey = "";
  private rows: { name: string; y: number; group: string }[] = [];
  private rowH = 14;

  constructor(
    private host: HTMLElement,
    private names: string[],
    private groupOf: Record<string, string>,
    private groupOrder: string[],
    private onPick: (t: number) => void,
    private onHoverWeek: (t: number | null) => void,
    private onHoverItem: (name: string | null) => void
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
      const t = this.tAt(mx);
      const row = this.rows.find((r) => my >= r.y && my < r.y + this.rowH);
      return { t, item: row?.name ?? null };
    };
    this.svg
      .on("pointerdown", (ev: PointerEvent) => {
        dragging = true;
        (ev.target as Element).setPointerCapture?.(ev.pointerId);
        const { t } = at(ev);
        if (t !== null) this.onPick(t);
      })
      .on("pointermove", (ev: PointerEvent) => {
        const { t, item } = at(ev);
        if (dragging) {
          if (t !== null) this.onPick(t);
          return;
        }
        if (ev.pointerType !== "mouse") return;
        this.onHoverWeek(t);
        this.onHoverItem(item);
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

  render(
    dyn: DynamicBlock,
    periods: PeriodBand[],
    t: number | null,
    activePeriod: string | null,
    p: Palette,
    c: BeadColors,
    hoverT: number | null,
    hoveredItem: string | null,
    paintKey: string
  ) {
    this.last = [dyn, periods, t, activePeriod, p, c, hoverT, hoveredItem, paintKey];
    this.T = dyn.dates.length;
    const k = this.names.length;
    const groups = this.groupOrder.filter((g) => this.names.some((n) => this.groupOf[n] === g));
    // rows: as tall as fits a ~340 px band, between 12 px (labels stay legible) and 16 px each
    this.rowH = Math.max(12, Math.min(16, Math.floor((340 - GAP * (groups.length - 1)) / k)));
    let y = TOP + HEADER + GAP;
    this.rows = [];
    for (const g of groups) {
      for (const n of this.names.filter((m) => this.groupOf[m] === g)) {
        this.rows.push({ name: n, y, group: g });
        y += this.rowH;
      }
      y += GAP;
    }
    this.height = y - GAP + BOTTOM;

    const key = `${paintKey}|${this.width}|${activePeriod}|${this.T}`;
    if (key !== this.paintedKey) {
      this.paint(dyn, periods, activePeriod, p, c, groups);
      this.paintedKey = key;
    }
    this.overlay(dyn, t, p, hoverT, hoveredItem, groups);
  }

  /** the beads themselves: only when the data, size, theme or picked period changes */
  private paint(dyn: DynamicBlock, periods: PeriodBand[], activePeriod: string | null, p: Palette, c: BeadColors, groups: string[]) {
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
    // Each measure's beads start at its usual level (the median over every step and item) and
    // reach full width at its highest: below the usual level there's only the string. Fixed
    // across every step, so a bead means the same width everywhere.
    const allTo: number[] = [];
    const allFrom: number[] = [];
    for (let ti = 0; ti < this.T; ti++)
      for (let i = 0; i < this.names.length; i++) {
        allTo.push(dyn.to[ti][i]);
        allFrom.push(dyn.from[ti][i]);
      }
    const ramp = (vals: number[], width: number) => {
      const lo = d3.quantile(vals, 0.5)!;
      const hi = d3.max(vals)!;
      return (v: number) => width * Math.max(0, Math.min(1, (v - lo) / Math.max(1e-9, hi - lo)));
    };
    const wTo = ramp(allTo, maxW);
    const wFrom = ramp(allFrom, maxW * 0.5);
    const wTotal = ramp(dyn.total, maxW);

    const multi = groups.length > 1;
    const hueOf = (row: number, name: string) => {
      const i = multi ? groups.indexOf(this.groupOf[name]) : row;
      return [c.hues[i % c.hues.length], c.hues[(i + 1) % c.hues.length]];
    };
    const active = periods.find((b) => b.key === activePeriod) ?? null;
    const dates = dyn.dates.map((d) => parseDate(d)!);
    const top = TOP;
    const bottom = H - BOTTOM;

    cols.forEach((ti) => {
      const x = this.xOf(ti);
      const inside = !active || (dates[ti] >= active.start && dates[ti] <= active.end);
      ctx.globalAlpha = inside ? 1 : 0.16;
      // the string
      ctx.fillStyle = c.ink;
      ctx.fillRect(x - 0.6, top, 1.2, bottom - top);
      // the spillover index row
      const wt = Math.max(1.2, wTotal(dyn.total[ti]));
      ctx.fillRect(x - wt / 2, top + 4, wt, HEADER - 8);
      // the items: a colour bead (sends), a hairline of the next hue offset beside it, the core (takes)
      this.rows.forEach((r, row) => {
        const i = this.names.indexOf(r.name);
        const [hue, fringe] = hueOf(row, r.name);
        const a = wTo(dyn.to[ti][i]);
        const b = wFrom(dyn.from[ti][i]);
        if (a > 1.5) {
          ctx.fillStyle = fringe;
          ctx.fillRect(x - a / 2 + 1.5, r.y, a, this.rowH);
          ctx.fillStyle = hue;
          ctx.fillRect(x - a / 2, r.y, a, this.rowH);
        }
        if (b > 1.5) {
          ctx.fillStyle = c.ink;
          ctx.fillRect(x - b / 2, r.y, b, this.rowH);
        }
      });
    });
    ctx.globalAlpha = 1;
  }

  /** labels, axis, episodes, the picked step and the hover: cheap, redrawn every time */
  private overlay(dyn: DynamicBlock, t: number | null, p: Palette, hoverT: number | null, hoveredItem: string | null, groups: string[]) {
    const W = this.width;
    const H = this.height;
    const svg = this.svg.attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
    svg.selectAll("*").remove();
    const dates = dyn.dates.map((d) => parseDate(d)!);
    const bottom = H - BOTTOM;
    const small = W < 600;

    // left labels: the index row, the groups and the items
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
    if (groups.length > 1)
      for (const g of groups) {
        const first = this.rows.find((r) => r.group === g)!;
        lab
          .append("text")
          .attr("x", 0)
          .attr("y", first.y - 4)
          .attr("class", "beads-group")
          .attr("fill", p.muted)
          .text(g);
      }
    for (const r of this.rows) {
      lab
        .append("text")
        .attr("x", this.left - 12)
        .attr("y", r.y + this.rowH / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("class", r.name === hoveredItem ? "beads-item on" : "beads-item")
        .attr("fill", r.name === hoveredItem ? p.fg : p.secondary)
        .text(r.name.length > (small ? 9 : 18) ? `${r.name.slice(0, small ? 8 : 17)}…` : r.name);
    }

    // a hovered item: a quiet band across its row
    const hr = this.rows.find((r) => r.name === hoveredItem);
    if (hr)
      svg
        .append("rect")
        .attr("x", this.left - 4)
        .attr("y", hr.y - 1)
        .attr("width", this.plotW + 8)
        .attr("height", this.rowH + 2)
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
