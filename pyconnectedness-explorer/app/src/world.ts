/**
 * Shared data + interaction layer every layout consumes identically. Numbers always come from
 * the real pyconnectedness Python library (precomputed, see README.md/data.ts) -- this module
 * never recomputes statistics, only reshapes already-computed values per frame and wires the
 * same click/scrub callbacks so every layout's charts behave identically regardless of how
 * they're arranged on screen.
 */
import {
  type ExplorerData,
  type Measure,
  type StaticBlock,
  type StaticWindow,
  globalMaxAbsNet,
  globalMaxAbsPairwise,
  matrixAt,
  netAt,
  staticBlock,
} from "./data";
import { Store, type ExplorerState } from "./state";
import { REDESIGN_DARK, REDESIGN_LIGHT, REGION_OF, REGION_ORDER, type RedesignTokens } from "./encoding";

export const PERIODS_RETURNS: { key: StaticWindow; start: string; end: string; label: string }[] = [
  { key: "p1", start: "1997-01-01", end: "2006-12-31", label: "1997–2006" },
  { key: "p2", start: "2007-01-01", end: "2012-12-31", label: "2007–2012" },
  { key: "p3", start: "2013-01-01", end: "2019-12-31", label: "2013–2019" },
  { key: "p4", start: "2020-01-01", end: "2026-12-31", label: "2020–2026" },
];

export interface Frame {
  s: ExplorerState;
  isRedesign: boolean;
  tok: RedesignTokens;
  measure: Measure;
  t: number;
  date: string;
  net: number[];
  pairwise: number[][];
  full: StaticBlock;
  globalMaxAbsNet: number;
  globalMaxAbsPairwise: number;
  periods: { start: string; end: string; label: string }[];
  heatmapOrder: string[];
  heatmapMatrix: number[][];
  heatmapTitle: string;
}

export class World {
  readonly globalMaxNetReturns: number;
  readonly globalMaxNetVol: number;
  readonly globalMaxPairReturns: number;
  readonly globalMaxPairVol: number;

  constructor(
    readonly data: ExplorerData,
    readonly store: Store
  ) {
    this.globalMaxNetReturns = globalMaxAbsNet(data, "returns");
    this.globalMaxNetVol = globalMaxAbsNet(data, "volatility");
    this.globalMaxPairReturns = globalMaxAbsPairwise(data, "returns");
    this.globalMaxPairVol = globalMaxAbsPairwise(data, "volatility");
  }

  tokens(): RedesignTokens {
    return this.store.get().theme === "dark" ? REDESIGN_DARK : REDESIGN_LIGHT;
  }

  dateIndexFor(m: Measure, isoDate: string): number {
    const dates = this.data.meta.dynamic[m].dates;
    let idx = dates.findIndex((d) => d >= isoDate);
    if (idx === -1) idx = dates.length - 1;
    return idx;
  }

  reindexFor(scrubbedMeasure: Measure, idx: number, activeMeasure: Measure): number {
    if (scrubbedMeasure === activeMeasure) return idx;
    const date = this.data.meta.dynamic[scrubbedMeasure].dates[idx];
    return this.dateIndexFor(activeMeasure, date);
  }

  sortedNames(measure: Measure, t: number, sort: ExplorerState["matrixSort"]): string[] {
    const names = this.data.meta.names.slice();
    if (sort === "notebook") return names;
    if (sort === "region") {
      return names.slice().sort((a, b) => {
        const ra = REGION_ORDER.indexOf(REGION_OF[a]);
        const rb = REGION_ORDER.indexOf(REGION_OF[b]);
        if (ra !== rb) return ra - rb;
        return a.localeCompare(b);
      });
    }
    const net = netAt(this.data, measure, t);
    return names
      .map((n, i) => ({ n, v: net[i] }))
      .sort((a, b) => b.v - a.v)
      .map((x) => x.n);
  }

  computeFrame(): Frame {
    const s = this.store.get();
    const { t, measure } = s;
    const date = this.data.meta.dynamic[measure].dates[t];
    const net = netAt(this.data, measure, t);
    const pairwise = matrixAt(this.data, measure, t);
    const full = staticBlock(this.data, measure, "full");

    let heatmapMatrix: number[][];
    let heatmapTitle: string;
    if (s.matrixWindow === "t") {
      heatmapMatrix = pairwise;
      heatmapTitle = `Net pairwise ${measure} connectedness, week of ${date} (%)`;
    } else {
      const block = staticBlock(this.data, measure, s.matrixWindow);
      heatmapMatrix = block.pairwise_net;
      heatmapTitle = `Net pairwise ${measure} connectedness, ${block.label} (%)`;
    }
    const order = this.sortedNames(measure, t, s.matrixSort);
    const orderIdx = order.map((n) => this.data.meta.names.indexOf(n));
    const reordered = orderIdx.map((i) => orderIdx.map((j) => heatmapMatrix[i][j]));

    return {
      s,
      isRedesign: s.chartStyle === "redesign",
      tok: this.tokens(),
      measure,
      t,
      date,
      net,
      pairwise,
      full,
      globalMaxAbsNet: measure === "returns" ? this.globalMaxNetReturns : this.globalMaxNetVol,
      globalMaxAbsPairwise: measure === "returns" ? this.globalMaxPairReturns : this.globalMaxPairVol,
      periods: PERIODS_RETURNS.map((p) => ({ start: p.start, end: p.end, label: p.label })),
      heatmapOrder: order,
      heatmapMatrix: reordered,
      heatmapTitle,
    };
  }

  // ---- shared callbacks: identical selection/scrub behaviour in every layout ----
  onSelectMarket = (name: string | null) => {
    const cur = this.store.get().selection.market;
    this.store.set({ selection: { market: cur === name ? null : name, pair: null } });
  };
  onSelectPair = (pair: [string, string] | null) => {
    this.store.set({ selection: { market: null, pair } });
  };
  onSelectCell = (row: string, col: string) => {
    this.store.set({ selection: { market: null, pair: [row, col] } });
  };
  onScrubReturns = (idx: number) => {
    this.store.set({ t: this.reindexFor("returns", idx, this.store.get().measure) });
  };
  onScrubVol = (idx: number) => {
    this.store.set({ t: this.reindexFor("volatility", idx, this.store.get().measure) });
  };
  setMeasure = (measure: Measure) => {
    const s = this.store.get();
    const date = this.data.meta.dynamic[s.measure].dates[s.t];
    this.store.set({ measure, t: this.dateIndexFor(measure, date) });
  };
  setChartStyle = (style: ExplorerState["chartStyle"]) => this.store.set({ chartStyle: style });
  setTheme = (theme: ExplorerState["theme"]) => {
    document.documentElement.setAttribute("data-theme", theme);
    this.store.set({ theme });
  };
  toggleTheme = () => this.setTheme(this.store.get().theme === "dark" ? "light" : "dark");
  step = (n: number) => {
    const s = this.store.get();
    const dates = this.data.meta.dynamic[s.measure].dates;
    this.store.set({ t: Math.max(0, Math.min(dates.length - 1, s.t + n)) });
  };

  private playTimer: number | null = null;
  togglePlay = () => {
    const s = this.store.get();
    const playing = !s.playing;
    this.store.set({ playing });
    if (playing) {
      this.playTimer = window.setInterval(() => {
        const cur = this.store.get();
        const dates = this.data.meta.dynamic[cur.measure].dates;
        if (cur.t >= dates.length - 1) {
          this.store.set({ playing: false, t: 0 });
          if (this.playTimer) clearInterval(this.playTimer);
          return;
        }
        this.store.set({ t: cur.t + 1 });
      }, 60);
    } else if (this.playTimer) {
      clearInterval(this.playTimer);
    }
  };

  footnoteHtml(): string {
    const commit = "4cc953f";
    const base = `Data: weekly closes, highs and lows of 20 stock indices from Yahoo Finance. Computed with PyConnectedness 0.1.0 by running the Demo notebook unchanged (commit ${commit}). Generalized variance decomposition, VAR(2), 10 week horizon, 200 week rolling window.`;
    if (this.data.meta.synthetic) {
      return `${base}<br/>This run used synthetic input prices, not Yahoo Finance &mdash; see the banner above and README.md.`;
    }
    return base;
  }
}
