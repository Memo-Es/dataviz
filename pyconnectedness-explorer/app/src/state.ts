import type { Measure, StaticWindow } from "./data";

export interface Selection {
  market: string | null;
  pair: [string, string] | null; // [sender, receiver]
}

export interface ExplorerState {
  t: number; // index into dynamic.<measure>.dates
  measure: Measure;
  matrixWindow: StaticWindow; // "t" = follow the rolling selection, else a static block
  matrixSort: "region" | "net" | "notebook";
  edgePercentile: number; // default 90, per SPEC.md's notebook rule
  selection: Selection;
  playing: boolean;
  theme: "light" | "dark";
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
