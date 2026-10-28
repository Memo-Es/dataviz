/**
 * A flow as a pointed line: wide where it leaves the market that passes on more, narrowing to a
 * point at the one that takes it in. One mark says both the direction and the strength, so no
 * arrowhead is needed (seven of them used to pile up on the biggest receiver).
 *
 * The width at the wide end is proportional to the flow (`pairwise_net`), from zero, on one scale
 * for every week: twice the flow is twice as wide, and a 4 pp flow is as wide in 2017 as in 2020.
 * Matplotlib draws the same shape (`arrowstyle="wedge"`), so the library's plots can follow.
 */
import type * as d3 from "d3";

/** the width of the wide end for the strongest flow in any week, in the chart's own units */
export const FLOW_MAX = 16;
/** the point keeps this width, so the line visibly reaches the market that takes it in */
export const FLOW_TIP = 1.6;

export const flowWidth = (v: number, maxPair: number) => (maxPair > 0 ? (Math.max(0, v) / maxPair) * FLOW_MAX : 0);

/** the outline of a pointed line along the curve `at` from t0 (`w` wide) to t1 (`tip` wide) */
export function flowPath(at: (t: number) => [number, number], t0: number, t1: number, w: number, n = 24, tip = FLOW_TIP): string {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  const e = (t1 - t0) / (n * 4);
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const [x, y] = at(t);
    const [ax, ay] = at(t - e);
    const [bx, by] = at(t + e);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    const h = (Math.max(w, tip) + (tip - Math.max(w, tip)) * (i / n)) / 2;
    left.push([x + nx * h, y + ny * h]);
    right.push([x - nx * h, y - ny * h]);
  }
  const f = ([x, y]: [number, number]) => `${x.toFixed(1)},${y.toFixed(1)}`;
  return `M${[...left, ...right.reverse()].map(f).join("L")}Z`;
}

/** the key: two pointed lines with their values, and how to read them */
export function flowKey(g: d3.Selection<SVGGElement, unknown, null, undefined>, x: number, y: number, maxPair: number, ink: string, fg: string) {
  const ticks = (maxPair > 0 ? niceTicks(maxPair) : []).filter((v) => v > 0);
  const values = ticks.length >= 2 ? [ticks[0], ticks[ticks.length - 1]] : ticks;
  const LEN = 54;
  values.forEach((v, i) => {
    const yy = y + i * 24;
    g.append("path")
      .attr("class", "flow-key")
      .attr("d", flowPath((t) => [x + t * LEN, yy], 0, 1, flowWidth(v, maxPair), 2))
      .attr("fill", ink);
    g.append("text").attr("class", "net-side").attr("x", x + LEN + 8).attr("y", yy).attr("dy", "0.35em").attr("fill", fg).text(`${v} pp`);
  });
  g.append("text")
    .attr("class", "net-side")
    .attr("x", x)
    .attr("y", y + values.length * 24 + 4)
    .attr("dy", "0.35em")
    .attr("fill", fg)
    .text("the wide end passes on");
}

/** round values under `max` for the key: 2 and 8 pp for a strongest flow of 8.3 pp */
function niceTicks(max: number): number[] {
  const step = [0.5, 1, 2, 5, 10, 20].find((s) => max / s <= 5) ?? 50;
  const out: number[] = [];
  for (let v = step; v <= max + 1e-9; v += step) out.push(+v.toFixed(2));
  return out;
}
