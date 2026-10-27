/**
 * Graph 1's insights, read off the library's own numbers (dynamic_connectedness(...).total and the
 * full-sample static total): its peak, its sharpest jumps and drops, and how often it runs above
 * its long-run level. The one thing a reader can't see unaided is the rolling window, so a drop
 * that lands one window after a jump is explained as that jump leaving the window.
 * Nothing is estimated here: these are comparisons between values the library returned.
 */
import type { DynamicBlock } from "../data";

export interface Insight {
  /** the step the insight points at (its chip picks it) */
  t: number;
  icon: "jump" | "drop" | "peak" | "level";
  title: string;
  /** may hold {date:t} tokens, rendered as chips that pick step t */
  body: string;
}

export function findInsights(dyn: DynamicBlock, longRun: number, steps: string, items: string): Insight[] {
  const v = dyn.total;
  const T = v.length;
  const W = dyn.window;
  const k = Math.max(2, Math.round(W / 50)); // a "few steps": 4 weeks for a 200-week window
  const d = v.map((x, t) => (t >= k ? x - v[t - k] : 0));
  const mean = d.reduce((a, b) => a + b, 0) / T;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / T);
  const thr = Math.max(3, 2.5 * sd);
  const sep = Math.max(k * 3, Math.round(W / 4));
  // the largest moves, each the biggest within `sep` steps of itself
  const extremes = (sign: 1 | -1, min: number) => {
    const out: number[] = [];
    for (let t = k; t < T; t++) {
      if (sign * d[t] < min) continue;
      let best = true;
      for (let u = Math.max(k, t - sep); u <= Math.min(T - 1, t + sep); u++) if (sign * d[u] > sign * d[t]) best = false;
      if (best) out.push(t);
    }
    return out.sort((a, b) => sign * d[b] - sign * d[a]);
  };
  const rises = extremes(1, thr / 1.5);
  const jumps = extremes(1, thr).slice(0, 2);
  const drops = extremes(-1, thr).slice(0, 2);
  const pts = (x: number) => Math.abs(x).toFixed(1);
  const out: Insight[] = [];

  const peak = v.indexOf(Math.max(...v));
  out.push({ t: peak, icon: "peak", title: `Peak: ${v[peak].toFixed(1)}%`, body: `The most connected stretch was the ${W} ${steps} up to {date:${peak}}.` });

  const moves = [...jumps.map((t) => ({ t, up: true })), ...drops.map((t) => ({ t, up: false }))].sort((a, b) => a.t - b.t);
  for (const { t, up } of moves) {
    if (up) {
      out.push({
        t,
        icon: "jump",
        title: "Spillover jumped",
        body: `+${pts(d[t])} points in ${k} ${steps} to ${v[t].toFixed(1)}%, at {date:${t}}: a shock reached all the ${items} at once.`,
      });
    } else {
      // a drop one window after a rise: that rise leaving the window
      const cause = rises.find((j) => Math.abs(t - W - j) <= k + 4);
      out.push({
        t,
        icon: "drop",
        title: "Sharp drop",
        body:
          cause !== undefined
            ? `−${pts(d[t])} points in ${k} ${steps}, at {date:${t}}. The {date:${cause}} shock left the ${W}-${steps.replace(/s$/, "")} window: the calm is the window moving on, not the ${items}.`
            : `−${pts(d[t])} points in ${k} ${steps} to ${v[t].toFixed(1)}%, at {date:${t}}.`,
      });
    }
  }

  const above = v.filter((x) => x > longRun).length / T;
  const last = T - 1;
  out.push({
    t: last,
    icon: "level",
    title: `Above its long-run ${longRun.toFixed(1)}% in ${Math.round(above * 100)}% of ${steps}`,
    body: `Now ${v[last].toFixed(1)}%, at {date:${last}}: ${v[last] > longRun ? "more connected than usual" : "less connected than usual"}.`,
  });
  // in date order, so the numbers on the chart run left to right
  return out.sort((a, b) => a.t - b.t);
}
