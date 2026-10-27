/**
 * Graph 1's insights, read off the library's own numbers: dynamic_connectedness(...).total and
 * .directional_from per window, and the full-sample static_connectedness(...).total.
 * Nothing is estimated here: every card is a comparison between values the library returned,
 * and every claim a card makes is checked against those values before it is said.
 *
 * - Moves: the index's swings (a zigzag: a swing ends when the index turns back by a set amount,
 *   scaled to the dataset's own range), so a sudden shock and a slow shift are both found. When
 *   most of a swing came in a few steps, the card points at those steps.
 * - Breadth: how many of the items took in more (or less) from the others over the swing.
 * - The rolling window: a fall that mirrors a rise one window earlier is that rise leaving it.
 * - Level: where the latest window sits among all of them, and the full-sample figure only when
 *   it sits among the windows (short windows read higher, so it can sit below all of them).
 */
import type { DynamicBlock } from "../data";

export interface Insight {
  /** the step the insight points at (its date picks it, its number marks it on the chart) */
  t: number;
  icon: "jump" | "drop" | "peak" | "level";
  title: string;
  /** the one line a card shows: may hold {date:t} tokens, rendered as dates that pick step t */
  body: string;
  /** the rest, folded under "Details": the sharpest stretch, who moved, the window's part */
  more?: string;
}

export interface Swing {
  from: number;
  to: number;
}

/** the smallest swing worth a card: 2 points, or a quarter of the index's whole range */
export function swingSize(v: number[]): number {
  return Math.max(2, 0.25 * (Math.max(...v) - Math.min(...v)));
}

/** the index's swings: alternating rises and falls, each at least r points end to end */
export function swings(v: number[], r: number): Swing[] {
  const piv: number[] = [];
  let dir = 0;
  let hi = 0;
  let lo = 0;
  let ext = 0;
  for (let t = 1; t < v.length; t++) {
    if (dir === 0) {
      if (v[t] > v[hi]) hi = t;
      if (v[t] < v[lo]) lo = t;
      if (v[hi] - v[lo] >= r) {
        piv.push(Math.min(hi, lo));
        dir = hi > lo ? 1 : -1;
        ext = Math.max(hi, lo);
      }
    } else if (dir === 1) {
      if (v[t] > v[ext]) ext = t;
      else if (v[ext] - v[t] >= r) {
        piv.push(ext);
        dir = -1;
        ext = t;
      }
    } else if (v[t] < v[ext]) ext = t;
    else if (v[t] - v[ext] >= r) {
      piv.push(ext);
      dir = 1;
      ext = t;
    }
  }
  if (piv.length && Math.abs(v[ext] - v[piv[piv.length - 1]]) >= r) piv.push(ext);
  return piv.slice(1).map((to, i) => ({ from: piv[i], to }));
}

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 864e5;

export function findInsights(dyn: DynamicBlock, longRun: number, steps: string, items: string): Insight[] {
  const v = dyn.total;
  const T = v.length;
  const W = dyn.window;
  const step = steps.replace(/s$/, "");
  const k = Math.max(2, Math.round(W / 50)); // a "few steps": 4 weeks for a 200-week window
  const pts = (x: number) => Math.abs(x).toFixed(1);
  const pct = (x: number) => `${x.toFixed(1)}%`;
  const span = (a: number, b: number) => {
    const y = days(dyn.dates[a], dyn.dates[b]) / 365.25;
    return y >= 2 ? `${Math.round(y)} years` : `${b - a} ${b - a === 1 ? step : steps}`;
  };
  // how many items took in more (up) or less (down) from the others between a and b
  const breadth = (a: number, b: number, up: boolean) => {
    const n = dyn.from[b].length;
    const m = dyn.from[b].filter((x, i) => (up ? x > dyn.from[a][i] : x < dyn.from[a][i])).length;
    return { m, n };
  };
  const breadthText = (a: number, b: number, up: boolean) => {
    const { m, n } = breadth(a, b, up);
    if (m === n) return `All ${n} ${items} took in ${up ? "more" : "less"} from the others.`;
    if (m / n >= 0.6) return `${m} of ${n} ${items} took in ${up ? "more" : "less"} from the others.`;
    return `Only ${m} of ${n} ${items} took in ${up ? "more" : "less"} from the others: the move came from a few.`;
  };
  // the usual k-step move (a robust spread, so the big shocks don't inflate it)
  const kMoves = v.slice(k).map((x, i) => Math.abs(x - v[i])).sort((a, b) => a - b);
  const usual = kMoves[Math.floor(kMoves.length / 2)] || 0;
  // within a swing, the k steps that moved most: "sharp" when they carry at least 40% of it,
  // worth naming when they also stand well out from the usual k-step move
  const steepest = (s: Swing) => {
    const sign = Math.sign(v[s.to] - v[s.from]);
    let best = -1;
    let bestD = 0;
    for (let t = s.from + k; t <= s.to; t++) {
      const d = sign * (v[t] - v[t - k]);
      if (d > bestD) {
        bestD = d;
        best = t;
      }
    }
    const whole = Math.abs(v[s.to] - v[s.from]);
    if (s.to - s.from <= k || best < 0) return null;
    const sharp = bestD >= 0.4 * whole;
    return sharp || bestD >= Math.max(2, 6 * usual) ? { t: best, d: bestD, sharp } : null;
  };

  const all = swings(v, swingSize(v));
  const rises = all.filter((s) => v[s.to] > v[s.from]);
  const falls = all.filter((s) => v[s.to] < v[s.from]);
  const size = (s: Swing) => Math.abs(v[s.to] - v[s.from]);
  const top = (list: Swing[]) => [...list].sort((a, b) => size(b) - size(a)).slice(0, 2);
  // a step stops counting W - lags steps after it came in: VAR(p) spends a window's first p steps
  // as lags only (checked on the stocks data: falls mirror rises best at exactly that distance)
  const L = W - (dyn.lags || 0);
  // over a fall, the steps leaving the window are the ones that entered it L steps earlier; if the
  // index rose by at least half as much while they came in, the fall is largely them leaving
  const echoOf = (f: Swing) => {
    const a = f.from - L;
    const b = f.to - L;
    if (a < 0 || b <= a) return null;
    const rise = v[b] - v[a];
    return rise >= 0.5 * size(f) ? { a, b, rise } : null;
  };
  // the same test on a few steps: are the k steps to t the k steps to t - W leaving?
  const echoAt = (t: number, d: number) => {
    const b = t - L;
    if (b - k < 0) return null;
    const rise = v[b] - v[b - k];
    return rise >= 0.5 * d ? { b, rise } : null;
  };

  const out: Insight[] = [];
  const peak = v.indexOf(Math.max(...v));
  let peakTold = false;

  for (const s of top(rises)) {
    const st = steepest(s);
    const isPeak = s.to === peak;
    peakTold ||= isPeak;
    out.push({
      t: st?.sharp ? st.t : s.to,
      icon: "jump",
      title: `Spillover ${st?.sharp ? "jumped" : "rose"} ${pts(v[s.to] - v[s.from])} points${isPeak ? ", to its peak" : ""}`,
      body:
        `From ${pct(v[s.from])} at {date:${s.from}} to ${pct(v[s.to])} at {date:${s.to}} (${span(s.from, s.to)}).` +
        (st?.sharp ? ` +${pts(st.d)} of it in the ${k} ${steps} to {date:${st.t}}.` : ""),
      more: (st && !st.sharp ? `Sharpest ${k} ${steps}: +${pts(st.d)}, to {date:${st.t}}. ` : "") + breadthText(s.from, s.to, true),
    });
  }
  for (const s of top(falls)) {
    const st = steepest(s);
    const echo = echoOf(s);
    const stEcho = !echo && st ? echoAt(st.t, st.d) : null;
    const fromPeak = s.from === peak;
    peakTold ||= fromPeak;
    out.push({
      t: st?.sharp ? st.t : s.to,
      icon: "drop",
      title: `Spillover ${st?.sharp ? "dropped" : "fell"} ${pts(v[s.to] - v[s.from])} points${fromPeak ? ", from its peak" : ""}`,
      // the reading that matters stays on the card: whether the fall is the window moving on
      body:
        `From ${pct(v[s.from])} at {date:${s.from}} to ${pct(v[s.to])} at {date:${s.to}} (${span(s.from, s.to)}).` +
        (st?.sharp ? ` −${pts(st.d)} of it in the ${k} ${steps} to {date:${st.t}}.` : "") +
        (echo
          ? ` ${echo.rise >= 0.8 * size(s) ? `Mostly the window moving on, not the ${items} calming.` : `Partly the window moving on.`}`
          : stEcho && st
            ? ` ${stEcho.rise >= 0.8 * st.d ? `The window moving on, not the ${items} calming.` : `Partly the window moving on.`}`
            : ""),
      more:
        (st && !st.sharp ? `Sharpest ${k} ${steps}: −${pts(st.d)}, to {date:${st.t}}. ` : "") +
        (echo
          ? `Meanwhile {date:${echo.a}} to {date:${echo.b}} left the ${W}-${step} window; coming in, it added ${pts(echo.rise)} points.`
          : stEcho && st
            ? `That is the ${k} ${steps} to {date:${stEcho.b}} leaving the ${W}-${step} window; coming in, they added +${pts(stEcho.rise)}.`
            : breadthText(s.from, s.to, false)),
    });
  }

  if (!peakTold) {
    out.push({ t: peak, icon: "peak", title: `Peak: ${pct(v[peak])}`, body: `The most connected stretch was the ${W} ${steps} up to {date:${peak}}.` });
  }

  // the latest window among all of them; the full-sample figure only where it sits among them
  const share = (f: number) => (f === 1 ? `every ${W}-${step} window` : f >= 0.995 ? `almost every ${W}-${step} window` : `${Math.round(f * 100)}% of the ${W}-${step} windows`);
  const last = T - 1;
  const below = v.filter((x) => x < v[last]).length / T;
  const above = v.filter((x) => x > longRun).length / T;
  const rank = `higher than ${Math.round(below * 100)}% of ${steps}`;
  const lr =
    above <= 0.9 && above >= 0.1
      ? `${Math.round(above * 100)}% of ${steps} sit above the full-sample ${pct(longRun)}.`
      : `The full-sample ${pct(longRun)} is ${above > 0.9 ? "below" : "above"} ${share(above > 0.9 ? above : 1 - above)}: short windows read ${above > 0.9 ? "higher" : "lower"}, so ${steps} are compared with each other.`;
  const usualness = below >= 0.67 ? "more connected than usual" : below <= 0.33 ? "less connected than usual" : "about as connected as usual";
  // spillover that stays low: most of each item's moves are its own, and small swings can be noise
  const low = v[peak] < 25 ? ` No window passed ${pct(v[peak])}: the ${items} mostly move on their own, so small swings here can be noise.` : "";
  const move = out.find((x) => x.t === last);
  if (move) {
    // a move that ends at the latest step: one card, one mark on the chart
    move.body += ` Now ${pct(v[last])}, ${rank}: ${usualness}.`;
    move.more = `${move.more ?? ""} ${lr}${low}`.trim();
  } else {
    out.push({ t: last, icon: "level", title: `Now ${pct(v[last])}: ${rank}`, body: `At {date:${last}}: ${usualness}.`, more: `${lr}${low}` });
  }
  // in date order, so the numbers on the chart run left to right
  return out.sort((a, b) => a.t - b.t);
}
