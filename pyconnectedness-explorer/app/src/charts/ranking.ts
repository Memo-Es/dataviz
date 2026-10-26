/**
 * Net spillover per market (notebook cell 16's TO / FROM / NET table, as a diverging bar
 * chart): senders above zero in red, receivers below in blue. Fixed domain across weeks.
 */
import * as d3 from "d3";
import type { Frame } from "../model";
import { tightenDecimals, type Palette, fmtSigned, hueOf } from "../encoding";

const ROW = 26;

export class RankingChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width = 360;
  private last: Parameters<RankingChart["render"]> | null = null;

  constructor(
    host: HTMLElement,
    private names: string[],
    private onHover: (n: string | null) => void,
    private onSelect: (n: string) => void
  ) {
    this.svg = d3.select(host).append("svg").attr("class", "ranking");
    new ResizeObserver(() => {
      const w = Math.round(host.clientWidth);
      if (w && w !== this.width) {
        this.width = w;
        if (this.last) this.render(...this.last);
      }
    }).observe(host);
  }

  render(frame: Frame, p: Palette, maxNet: number, focus: string | null, selected: string | null, duration = 0) {
    this.last = [frame, p, maxNet, focus, selected, 0];
    const tr = <S extends d3.Selection<any, any, any, any>>(sel: S): S =>
      // an instant update (hover, selection) must cancel a running frame transition, or the
      // transition's end values would overwrite it a few ms later
      (duration > 0 ? sel.transition().duration(duration).ease(d3.easeLinear) : sel.interrupt()) as unknown as S;
    const W = this.width;
    const labelW = 96;
    const valueW = 52;
    const H = this.names.length * ROW + 8;
    this.svg.attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
    const x = d3
      .scaleLinear()
      .domain([-maxNet, maxNet])
      .range([labelW, W - valueW]);
    const rows = this.names
      .map((name, i) => ({ name, i, v: frame.net[i] }))
      .sort((a, b) => b.v - a.v);

    this.svg.selectAll("line.zero").data([0]).join("line").attr("class", "zero")
      .attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", H).attr("stroke", p.axis);

    const g = this.svg
      .selectAll<SVGGElement, (typeof rows)[number]>("g.row")
      .data(rows, (d) => d.name)
      .join((enter) => {
        const r = enter.append("g").attr("class", "row").attr("tabindex", 0).attr("role", "button");
        r.append("rect").attr("class", "row-bg");
        r.append("text").attr("class", "row-name");
        r.append("rect").attr("class", "bar");
        r.append("text").attr("class", "row-value");
        r.on("mouseenter", (_e, d) => this.onHover(d.name))
          .on("mouseleave", () => this.onHover(null))
          .on("click", (_e, d) => this.onSelect(d.name))
          .on("keydown", (ev: KeyboardEvent, d) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              this.onSelect(d.name);
            }
          });
        return r;
      });

    // rows slide to their new rank instead of jumping
    tr(g).attr("transform", (_d: unknown, i: number) => `translate(0,${4 + i * ROW})`);
    g.attr("aria-label", (d) => `${d.name}: net ${fmtSigned(d.v)} percentage points`)
      // fade the bar, not the row's text (WCAG AAA keeps every label at 7:1)
      .style("opacity", null)
      .each(function (d) {
        d3.select(this).select("rect.bar").style("opacity", focus && focus !== d.name ? 0.35 : 1);
      });
    g.select("rect.row-bg")
      .attr("x", 0)
      .attr("width", W)
      .attr("height", ROW - 2)
      .attr("rx", 6)
      .attr("fill", (d) => (d.name === selected ? p.band : "transparent"));
    g.select("text.row-name")
      .attr("x", 8)
      .attr("y", ROW / 2 - 1)
      .attr("dy", "0.35em")
      .attr("font-weight", (d) => (d.name === selected ? 700 : 500))
      .text((d) => d.name);
    const bars = g.select<SVGRectElement>("rect.bar").attr("y", 5).attr("height", ROW - 12).attr("rx", 3);
    tr(bars)
      .attr("x", (d: { v: number }) => Math.min(x(0), x(d.v)))
      .attr("width", (d: { v: number }) => Math.max(1, Math.abs(x(d.v) - x(0))))
      // region colour; transmitters solid (right of zero), receivers a tint with an edge (left)
      .attr("fill", (d: { name: string; v: number }) => hueOf(d.name))
      .attr("fill-opacity", (d: { v: number }) => (d.v >= 0 ? 1 : 0.28))
      .attr("stroke", (d: { name: string; v: number }) => (d.v >= 0 ? "none" : hueOf(d.name)))
      .attr("stroke-width", 1.5);
    g.select("text.row-value")
      .attr("x", W - 6)
      .attr("y", ROW / 2 - 1)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .text((d) => fmtSigned(d.v));
    tightenDecimals(this.svg.node()!, ".axis-label, .row-value, .cursor-label, .band-label, .ref-label");
  }
}
