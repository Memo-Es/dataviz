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

/** split_volatility.py's own output shape: the same three blocks ConnectednessMeta's own
 * "volatility" keys hold, pulled out of connectedness.json into their own file. */
interface VolatilitySplit {
  dynamic: DynamicBlock;
  static: Record<"full" | "p1" | "p2" | "p3" | "p4", StaticBlock>;
  frequency: Record<"full" | "p1" | "p2" | "p3" | "p4", FrequencyBlock>;
}

/** Deep-clones `value`, replacing every number with 0 -- strings (dates among them), array
 * lengths and object keys all stay exactly as they are. Used to build the volatility
 * placeholder below from the real "returns" blocks: a first version used hand-built,
 * zero-length placeholder arrays (`total: []`, etc.), which crashed real rendering code the
 * instant anyone actually switched to Volatility before the real split file loaded --
 * insights.ts's own `findInsights` indexes a dynamic block's `total` by `total.length - 1` and
 * by the index of its own max value, both `undefined` on an empty array, however many *other*
 * call sites across main.ts assume the same "at least one real week" shape. Mirroring the real
 * returns block's exact shape sidesteps every such assumption at once, known or not, instead of
 * chasing them one crash at a time. A first version of this also zeroed every string, which
 * replaced real dates with "" and crashed date parsing instead -- dates are the same calendar
 * across measures anyway, so copying them verbatim is also the more honest placeholder. */
function zeroedLike<T>(value: T): T {
  if (typeof value === "number") return 0 as T;
  if (Array.isArray(value)) return value.map(zeroedLike) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = zeroedLike(v);
    return out as T;
  }
  return value;
}

/** a placeholder for everything `VolatilitySplit` holds, present the instant `ConnectednessMeta`
 * is, before the real split file has loaded -- the same reasoning `pairwise.volatility`'s own
 * empty Float32Array(0) already uses, but shaped like the real "returns" blocks (same weeks,
 * same names) rather than empty, so switching to Volatility a moment too early degrades to a
 * flat, all-zero chart instead of a crash. static.volatility and frequency.volatility have no
 * "last200" window of their own (see ConnectednessMeta); the clone carries one anyway since it's
 * harmless and simpler than excluding it, and nothing ever reads it under the "volatility" key. */
function emptyVolatilitySplit(meta: ConnectednessMeta): VolatilitySplit {
  return {
    dynamic: zeroedLike(meta.dynamic.returns),
    static: zeroedLike(meta.static.returns) as VolatilitySplit["static"],
    frequency: zeroedLike(meta.frequency.returns) as VolatilitySplit["frequency"],
  };
}

export interface ExplorerData {
  meta: ConnectednessMeta;
  k: number;
  pairwise: Record<Measure, Float32Array>; // flat T*k*k, row-major, [t][i][j] = i sends to j
  /** resolves once pairwise.volatility has the real array -- Promise.resolve() wherever it's
   * already loaded (an upload, or a dataset with no volatility series at all) */
  volatilityReady: Promise<void>;
}

const DATA_BASE = `${import.meta.env.BASE_URL}data/`;

/** One entry of data/datasets.json (pipeline/datasets/sources.py DESCRIPTORS): what a dataset is,
 * where it comes from, and the words the page uses for it. */
export interface Dataset {
  id: string;
  dir: string;
  title: string;
  headline: string;
  items: string; // "stock markets", "currencies"...
  item: string; // "market", "currency"...
  source: string;
  api: string;
  api_url: string;
  step: "day" | "week" | "month";
  steps: string;
  series: string;
  built_by: string;
  measures: Partial<Record<Measure, string>>; // measure key -> its name on the page
  episodes: Record<string, string>; // ISO date -> label
  groups: Record<string, string>;
  group_order: string[];
  labels: Record<string, string>; // item -> longer label (index name, ticker...)
}

export async function loadDatasets(): Promise<Dataset[]> {
  const r = await fetch(`${DATA_BASE}datasets.json`);
  if (!r.ok) throw new Error(`datasets.json: ${r.status}`);
  return r.json();
}

/** `volatilityReady` resolves once `data.pairwise.volatility` has the real array AND
 * `data.meta.*["volatility"]` has its real blocks (split_volatility.py's own volatility.json,
 * not bundled into connectedness.json) -- until then the pairwise side is an empty
 * Float32Array(0) and the meta side is `emptyVolatilitySplit()`. The page opens on "Price
 * moves" (returns), so there's no reason the first paint has to wait on ~1.3MB (the binary
 * matrix and its own metadata combined) the default view doesn't read; both fetches start in
 * parallel but neither is awaited by loadExplorerData itself. Call .then() on volatilityReady
 * to refresh anything already showing Turbulence when it lands. */
export async function loadExplorerData(ds: Dataset): Promise<ExplorerData> {
  const base = `${DATA_BASE}${ds.dir}`;
  const hasVol = "volatility" in ds.measures;
  const [meta, returnsBuf] = await Promise.all([
    fetch(`${base}connectedness.json`).then((r) => {
      if (!r.ok) throw new Error(`${ds.id}/connectedness.json: ${r.status}`);
      return r.json() as Promise<ConnectednessMeta>;
    }),
    fetch(`${base}pairwise_returns.f32`).then((r) => r.arrayBuffer()),
  ]);

  if (hasVol) {
    const placeholder = emptyVolatilitySplit(meta);
    meta.dynamic.volatility = placeholder.dynamic;
    meta.static.volatility = placeholder.static;
    meta.frequency.volatility = placeholder.frequency;
  }

  const k = meta.names.length;
  const data: ExplorerData = {
    meta,
    k,
    pairwise: {
      returns: new Float32Array(returnsBuf),
      volatility: new Float32Array(0),
    },
    volatilityReady: Promise.resolve(),
  };
  if (hasVol) {
    // two independent fetches, each applying its own result the moment it lands and logging
    // (not throwing) on failure, so a hiccup in one doesn't hold back the other or leave an
    // unhandled rejection -- volatilityReady itself still resolves once both have settled,
    // matching its contract, whichever of the two (if either) actually came through
    const binaryReady = fetch(`${base}pairwise_volatility.f32`)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        data.pairwise.volatility = new Float32Array(buf);
      })
      .catch((err) => console.error(`${ds.id}/pairwise_volatility.f32 failed to load`, err));
    const metaReady = fetch(`${base}volatility.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${ds.id}/volatility.json: ${r.status}`);
        return r.json() as Promise<VolatilitySplit>;
      })
      .then((split) => {
        data.meta.dynamic.volatility = split.dynamic;
        data.meta.static.volatility = split.static;
        data.meta.frequency.volatility = split.frequency;
      })
      .catch((err) => console.error(`${ds.id}/volatility.json failed to load`, err));
    data.volatilityReady = Promise.all([binaryReady, metaReady]).then(() => {});
  }
  return data;
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
  for (const row of data.meta.dynamic[measure]?.net ?? []) {
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
