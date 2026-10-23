import type { Measure, StaticWindow } from "./data";

export interface Selection {
  market: string | null;
  pair: [string, string] | null; // [sender, receiver]
}

export type ChartStyle = "baseline" | "redesign";

/** Three structurally different arrangements of the same charts -- see CONTEXT.md's decision
 * log. Only meaningful when chartStyle is "redesign"; the faithful baseline always uses the
 * plain stacked layout regardless of this setting, since its whole point is an unstyled replica. */
export type LayoutMode = "bento" | "shell" | "story";

export interface ExplorerState {
  t: number; // index into dynamic.<measure>.dates
  measure: Measure;
  matrixWindow: StaticWindow; // "t" = follow the rolling selection, else a static block
  matrixSort: "region" | "net" | "notebook";
  edgePercentile: number; // default 90, per SPEC.md's notebook rule
  selection: Selection;
  playing: boolean;
  theme: "light" | "dark";
  chartStyle: ChartStyle; // faithful matplotlib baseline, or the redesign -- see CONTEXT.md
  layout: LayoutMode;
}

type Listener = (s: ExplorerState) => void;

export class Store {
  private state: ExplorerState;
  private listeners = new Set<Listener>();

  constructor(initial: ExplorerState) {
    this.state = initial;
  }

  get(): ExplorerState {
    return this.state;
  }

  set(patch: Partial<ExplorerState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export function prefersDark(): boolean {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
