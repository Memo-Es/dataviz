/** Small line of one market's rolling net spillover (cell 17's small multiples, one at a time). */
import * as d3 from "d3";
import { type Palette, parseDate } from "../encoding";

export function sparkline(
  host: HTMLElement,
  dates: string[],
  values: number[],
  t: number | null,
  maxAbs: number,
  p: Palette
) {
  const W = Math.max(200, host.clientWidth || 320);
  const H = 84;
  const m = { l: 4, r: 4, t: 6, b: 16 };
  const x = d3
    .scaleUtc()
    .domain([parseDate(dates[0])!, parseDate(dates[dates.length - 1])!])
    .range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([H - m.b, m.t]);
  const pts = values.map((v, i) => [x(parseDate(dates[i])!), y(v)] as [number, number]);
  const svg = d3.select(host).selectAll<SVGSVGElement, null>("svg").data([null]).join("svg");
  svg.attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
  svg.selectAll("*").remove();
  svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", p.axis);
  const clipUp = `clip-up-${Math.random().toString(36).slice(2)}`;
  const defs = svg.append("defs");
  defs.append("clipPath").attr("id", clipUp).append("rect").attr("x", 0).attr("y", 0).attr("width", W).attr("height", y(0));
  const area = d3.area<[number, number]>().x((d) => d[0]).y0(y(0)).y1((d) => d[1]);
  svg.append("path").attr("d", area(pts)!).attr("fill", p.recv).attr("fill-opacity", 0.25);
  svg.append("path").attr("d", area(pts)!).attr("fill", p.send).attr("fill-opacity", 0.3).attr("clip-path", `url(#${clipUp})`);
  svg.append("path").attr("d", d3.line()(pts)!).attr("fill", "none").attr("stroke", p.fg).attr("stroke-width", 1);
  for (const yr of [2005, 2010, 2015, 2020, 2025]) {
    const d = new Date(Date.UTC(yr, 0, 1));
    svg.append("text").attr("class", "axis-label").attr("x", x(d)).attr("y", H - 3).attr("text-anchor", "middle").text(yr);
  }
  if (t !== null) {
    svg.append("line").attr("x1", pts[t][0]).attr("x2", pts[t][0]).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", p.accent);
    svg.append("circle").attr("cx", pts[t][0]).attr("cy", pts[t][1]).attr("r", 3.5).attr("fill", p.accent);
  }
}
