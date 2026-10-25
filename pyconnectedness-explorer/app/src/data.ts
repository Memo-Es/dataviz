/** Mirrors pipeline/export_cell.py's JSON shape exactly (SPEC.md section 3/4). */
export interface StaticBlock {
  label: string;
  start: string;
  end: string;
  total: number;
  to: number[];
  from: number[];
  net: number[];
  pairwise_net: number[][];
  fevd: number[][];
  threshold_p90: number;
}

export interface DynamicBlock {
  dates: string[];
  total: number[];
  to: number[][];
  from: number[][];
  net: number[][];
  window: number;
  horizon: number;
  lags: number;
  method: string;
}

/** frequency_connectedness() for one window (export_cell.py freq_block). Bands add up to
 * static_total, a static run at the same 100-week horizon -- not the H=10 StaticBlock total. */
export interface FrequencyBand {
  label: "<=5" | "5-20" | ">20";
  share: number;
  total: number;
  within_total: number;
  to: number[];
  from: number[];
  net: number[];
  pairwise_net: number[][];
}

export interface FrequencyBlock {
  horizon: number;
  periods: number[];
  static_total: number;
  static_net: number[];
  bands: FrequencyBand[];
}

export interface ConnectednessMeta {
  names: string[];
  tickers: Record<string, string>;
  sample: [string, string];
  weeks: number;
  episodes: string[];
  synthetic?: boolean;
  synthetic_note?: string;
  static: {
    returns: Record<"full" | "last200" | "p1" | "p2" | "p3" | "p4", StaticBlock>;
    volatility: Record<"full" | "p1" | "p2" | "p3" | "p4", StaticBlock>;
  };
  dynamic: {
    returns: DynamicBlock;
    volatility: DynamicBlock;
  };
  frequency: {
    returns: Record<"full" | "last200" | "p1" | "p2" | "p3" | "p4", FrequencyBlock>;
    volatility: Record<"full" | "p1" | "p2" | "p3" | "p4", FrequencyBlock>;
  };
}

export type Measure = "returns" | "volatility";
export type StaticWindow = "t" | "full" | "last200" | "p1" | "p2" | "p3" | "p4";

export interface ExplorerData {
  meta: ConnectednessMeta;
  k: number;
  pairwise: Record<Measure, Float32Array>; // flat T*k*k, row-major, [t][i][j] = i sends to j
}

const DATA_BASE = `${import.meta.env.BASE_URL}data/`;

export async function loadExplorerData(): Promise<ExplorerData> {
  const [meta, returnsBuf, volBuf] = await Promise.all([
    fetch(`${DATA_BASE}connectedness.json`).then((r) => {
      if (!r.ok) throw new Error(`connectedness.json: ${r.status}`);
      return r.json() as Promise<ConnectednessMeta>;
    }),
    fetch(`${DATA_BASE}pairwise_returns.f32`).then((r) => r.arrayBuffer()),
    fetch(`${DATA_BASE}pairwise_volatility.f32`).then((r) => r.arrayBuffer()),
  ]);

  const k = meta.names.length;
  return {
    meta,
    k,
    pairwise: {
      returns: new Float32Array(returnsBuf),
      volatility: new Float32Array(volBuf),
    },
  };
}

/** Pairwise net matrix at rolling window index t, as a k x k array of arrays. */
export function matrixAt(data: ExplorerData, measure: Measure, t: number): number[][] {
  const { k } = data;
  const flat = data.pairwise[measure];
  const base = t * k * k;
  const out: number[][] = new Array(k);
  for (let i = 0; i < k; i++) {
    const row = new Array(k);
    const rowBase = base + i * k;
    for (let j = 0; j < k; j++) row[j] = flat[rowBase + j];
    out[i] = row;
  }
  return out;
}

/** net[i] at rolling window t, derived as the row sum of the pairwise matrix (SPEC.md section 4). */
export function netAt(data: ExplorerData, measure: Measure, t: number): number[] {
  return data.meta.dynamic[measure].net[t];
}

export function totalAt(data: ExplorerData, measure: Measure, t: number): number {
  return data.meta.dynamic[measure].total[t];
}

/** Global max |value| across every rolling window, for the fixed scales CONTEXT.md's review
 * finding 5 requires (node size / edge width must not rescale frame to frame). */
export function globalMaxAbsNet(data: ExplorerData, measure: Measure): number {
  let m = 0;
  for (const row of data.meta.dynamic[measure].net) {
    for (const v of row) m = Math.max(m, Math.abs(v));
  }
  return m;
}

export function globalMaxAbsPairwise(data: ExplorerData, measure: Measure): number {
  let m = 0;
  for (const v of data.pairwise[measure]) m = Math.max(m, Math.abs(v));
  return m;
}

export function staticBlock(data: ExplorerData, measure: Measure, window: Exclude<StaticWindow, "t">): StaticBlock {
  const table = data.meta.static[measure] as Record<string, StaticBlock>;
  return table[window];
}

/** Net pairwise value for one specific pair (i sends to j), over every rolling window -- read
 * straight out of the flat Float32Array, not recomputed. Powers the bento layout's pair
 * drill-down sparkline, reusing TimelineChart instead of a new chart type. */
export function pairSeriesAt(data: ExplorerData, measure: Measure, i: number, j: number): number[] {
  const { k } = data;
  const flat = data.pairwise[measure];
  const T = flat.length / (k * k);
  const out = new Array(T);
  for (let t = 0; t < T; t++) out[t] = flat[t * k * k + i * k + j];
  return out;
}

export function dateIndex(data: ExplorerData, measure: Measure, isoDate: string): number {
  const dates = data.meta.dynamic[measure].dates;
  let idx = dates.findIndex((d) => d >= isoDate);
  if (idx === -1) idx = dates.length - 1;
  return idx;
}
