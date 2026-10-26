/**
 * App state, plus the one function that turns state into "what's on screen". Every number in a
 * Frame is read straight out of what the notebook exported (data.ts) -- nothing here recomputes
 * a statistic. The only derived value is the strongest-link cut-off, which applies the
 * notebook's own rule (90th percentile of |pairwise_net|, cells 19/21) to the matrix on screen.
 */
import {
  type ExplorerData,
  type Measure,
  type StaticWindow,
  globalMaxAbsNet,
  globalMaxAbsPairwise,
  matrixAt,
  staticBlock,
} from "./data";
import { fmtDate, parseDate, percentile } from "./encoding";

export type WindowKey = StaticWindow; // "t" = the rolling week picked on the timeline

export interface State {
  measure: Measure;
  t: number;
  window: WindowKey;
  selected: string | null;
  /** [row, column] of the pair picked on the matrix or network; row → column when positive */
  pair: [string, string] | null;
  hovered: string | null;
  /** week under the pointer on the timeline: previews the readout, changes nothing else */
  hoverT: number | null;
  playing: boolean;
  theme: "light" | "dark";
}

export interface Frame {
  key: WindowKey;
  label: string; // "Week of 4 Sep 2026" / "Full sample, 1997–2026"
  short: string;
  total: number;
  matrix: number[][]; // [i][j] > 0 means i sends to j
  to: number[];
  from: number[];
  net: number[];
  threshold: number;
  edgeCount: number;
}

type Listener = (s: State, prev: State) => void;

export class Store {
  private listeners = new Set<Listener>();
  constructor(private state: State) {}
  get(): State {
    return this.state;
  }
  set(patch: Partial<State>) {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    for (const l of this.listeners) l(this.state, prev);
  }
  subscribe(fn: Listener) {
    this.listeners.add(fn);
  }
}

export interface WindowOption {
  key: WindowKey;
  label: string;
}

export function windowOptions(data: ExplorerData, measure: Measure): WindowOption[] {
  const blocks = data.meta.static[measure] as Record<string, { label: string; start: string; end: string }>;
  const out: WindowOption[] = [{ key: "t", label: "Selected week" }];
  for (const key of ["full", "last200", "p1", "p2", "p3", "p4"] as const) {
    const b = blocks[key];
    if (!b) continue;
    out.push({ key, label: key === "full" ? "Full sample" : key === "last200" ? "Last 200 weeks" : `${b.start}–${b.end}` });
  }
  return out;
}

export class Model {
  readonly maxNet: Record<Measure, number>;
  readonly maxPair: Record<Measure, number>;

  constructor(readonly data: ExplorerData) {
    this.maxNet = { returns: globalMaxAbsNet(data, "returns"), volatility: globalMaxAbsNet(data, "volatility") };
    this.maxPair = {
      returns: globalMaxAbsPairwise(data, "returns"),
      volatility: globalMaxAbsPairwise(data, "volatility"),
    };
  }

  get names() {
    return this.data.meta.names;
  }

  dates(measure: Measure) {
    return this.data.meta.dynamic[measure].dates;
  }

  frame(s: State): Frame {
    const { measure } = s;
    let f: Omit<Frame, "threshold" | "edgeCount">;
    if (s.window === "t") {
      const dyn = this.data.meta.dynamic[measure];
      f = {
        key: "t",
        label: `200 weeks to ${fmtDate(parseDate(dyn.dates[s.t])!)}`,
        short: dyn.dates[s.t],
        total: dyn.total[s.t],
        matrix: matrixAt(this.data, measure, s.t),
        to: dyn.to[s.t],
        from: dyn.from[s.t],
        net: dyn.net[s.t],
      };
    } else {
      const raw = staticBlock(this.data, measure, s.window);
      // full-sample and last-200 blocks carry ISO dates; periods carry plain years
      const day = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? fmtDate(parseDate(d)!) : d);
      const b = { ...raw, start: day(raw.start), end: day(raw.end) };
      f = {
        key: s.window,
        label: s.window === "full" ? `Full sample, ${b.start} to ${b.end}` : `${b.label} (${b.start} to ${b.end})`,
        short: s.window === "full" ? "Full sample" : b.label,
        total: b.total,
        matrix: b.pairwise_net,
        to: b.to,
        from: b.from,
        net: b.net,
      };
    }
    const threshold = percentile(f.matrix.flat().map(Math.abs), 90);
    let edgeCount = 0;
    for (const row of f.matrix) for (const v of row) if (v > threshold) edgeCount++;
    return { ...f, threshold, edgeCount };
  }
}
