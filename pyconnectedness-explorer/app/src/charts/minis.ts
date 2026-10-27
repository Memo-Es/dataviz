/**
 * The home page's small versions of each graph: the same library values as the full graphs,
 * drawn small and without labels or interaction (the whole card is the link to the full graph).
 * Each returns an SVG string with a viewBox, so it scales to its card.
 */
import * as d3 from "d3";

/** graph 1: the rolling index as a soft line, the long-run level dashed, the picked step a dot */
export function miniLine(v: number[], t: number | null, longRun: number, c: { ink: string; accent: string; wash: string; muted: string }): string {
  // drawn at the card's shape, not stretched to it, so the picked dot stays round
  const W = 640;
  const H = 190;
  const P = 8;
  const x = d3.scaleLinear().domain([0, v.length - 1]).range([P, W - P]);
  const lo = Math.min(d3.min(v)!, longRun);
  const hi = Math.max(d3.max(v)!, longRun);
  const y = d3.scaleLinear().domain([lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.1]).range([H - P, P]);
  const pts = v.map((d, i) => [x(i), y(d)] as [number, number]);
  const line = d3.line()(pts)!;
  const area = d3.area<[number, number]>().x((d) => d[0]).y0(H).y1((d) => d[1])(pts)!;
  const dot = t === null ? "" : `<circle cx="${x(t).toFixed(1)}" cy="${y(v[t]).toFixed(1)}" r="4.5" fill="${c.accent}" stroke="#fff" stroke-width="1.5"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <path d="${area}" fill="${c.wash}"/>
    <line x1="${P}" x2="${W - P}" y1="${y(longRun).toFixed(1)}" y2="${y(longRun).toFixed(1)}" stroke="${c.muted}" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>
    <path d="${line}" fill="none" stroke="${c.ink}" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    ${dot}</svg>`;
}

/** graph 2: the ring, ordered by net as on the full graph, with the few strongest flows */
export function miniRing(
  names: string[],
  net: number[],
  matrix: number[][],
  threshold: number,
  maxNet: number,
  hueOf: (n: string) => string,
  fill: (n: string, send: boolean) => string,
  ink: string,
  flows = 6
): string {
  const S = 240;
  const C = S / 2;
  const R = 92;
  const GAP = 0.22;
  const idx = names.map((_, i) => i);
  const up = idx.filter((i) => net[i] >= 0).sort((a, b) => net[b] - net[a]);
  const down = idx.filter((i) => net[i] < 0).sort((a, b) => net[a] - net[b]);
  const pos: { x: number; y: number }[] = [];
  const place = (list: number[], from: number, to: number) =>
    list.forEach((i, k) => {
      const a = list.length === 1 ? (from + to) / 2 : from + ((to - from) * (k + 0.5)) / list.length;
      pos[i] = { x: C + R * Math.cos(a), y: C + R * Math.sin(a) };
    });
  place(up, Math.PI + GAP, 2 * Math.PI - GAP);
  place(down, Math.PI - GAP, GAP);
  const r = d3.scaleSqrt().domain([0, maxNet]).range([3, 9]).clamp(true);
  const edges: [number, number, number][] = [];
  matrix.forEach((row, s) => row.forEach((v, t) => v > threshold && edges.push([s, t, v])));
  edges.sort((a, b) => b[2] - a[2]);
  const top = edges.slice(0, flows).reverse();
  const w = d3.scaleLinear().domain([threshold, edges[0]?.[2] ?? threshold + 1]).range([0.8, 2.4]);
  const curve = (s: number, t: number) => {
    const a = pos[s];
    const b = pos[t];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    return `M${a.x.toFixed(1)},${a.y.toFixed(1)}Q${(mx + (C - mx) * 0.3).toFixed(1)},${(my + (C - my) * 0.3).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  };
  const lines = top.map(([s, t, v]) => `<path d="${curve(s, t)}" fill="none" stroke="${ink}" stroke-opacity="0.7" stroke-width="${w(v).toFixed(2)}"/>`).join("");
  const dots = idx
    .map((i) => `<circle cx="${pos[i].x.toFixed(1)}" cy="${pos[i].y.toFixed(1)}" r="${r(Math.abs(net[i])).toFixed(1)}" fill="${fill(names[i], net[i] >= 0)}" stroke="${hueOf(names[i])}" stroke-width="1.25"/>`)
    .join("");
  return `<svg viewBox="0 0 ${S} ${S}" aria-hidden="true"><line x1="${C - R - 14}" x2="${C + R + 14}" y1="${C}" y2="${C}" stroke="${ink}" stroke-opacity="0.15"/>${lines}${dots}</svg>`;
}

/** graph 3: the dot matrix, each pair once in the sender's row, ringed above the cut-off */
export function miniMatrix(
  order: string[],
  names: string[],
  matrix: number[][],
  threshold: number,
  maxPair: number,
  hueOf: (n: string) => string,
  fill: (n: string) => string,
  ink: string
): string {
  const n = order.length;
  const CELL = 10;
  const S = n * CELL;
  const at = order.map((nm) => names.indexOf(nm));
  const rad = d3.scaleSqrt().domain([0, maxPair]).range([0, CELL / 2 - 0.6]).clamp(true);
  const dots: string[] = [];
  at.forEach((i, r) =>
    at.forEach((j, c) => {
      const v = matrix[i][j];
      const cx = c * CELL + CELL / 2;
      const cy = r * CELL + CELL / 2;
      // every cell keeps a pinpoint, so the grid reads as a grid where a pair passes nothing on
      if (i === j || v <= 0) return dots.push(`<circle cx="${cx}" cy="${cy}" r="0.7" fill="${ink}" fill-opacity="0.18"/>`);
      const ring = v > threshold ? ` stroke="${ink}" stroke-width="0.8"` : ` stroke="${hueOf(order[r])}" stroke-width="0.5"`;
      dots.push(`<circle cx="${cx}" cy="${cy}" r="${rad(v).toFixed(2)}" fill="${fill(order[r])}"${ring}/>`);
    })
  );
  return `<svg viewBox="0 0 ${S} ${S}" aria-hidden="true">${dots.join("")}</svg>`;
}
