/**
 * Shared chart for the three "scaling"-method Causality domains (Flights, Heat waves, Vitamin A)
 * -- MaxLinear(...).fit(method="scaling") fits a general DAG, not Danube's single-parent tree, so
 * there is no one path from a pick to a root to walk. What the method gives instead is
 * `generations`: a strict sources-first ordering, each a list of names with nothing upstream of
 * it except earlier generations. Play reveals that ordering one generation at a time -- "this is
 * who moves first, then who they reach, then who those reach" -- rather than tracing a single
 * chain, which is the natural animation for a DAG's own output instead of forcing a tree
 * interaction onto data that isn't one.
 *
 * Node position is the caller's job (`layoutFn`): Flights and Heat project real lon/lat with
 * d3.geoAlbersUsa, fit to the host's size like danube-map.ts's own Mercator; Vitamin A has no
 * geography, so it scales the notebook's own hand-placed layout to fit instead. Either way this
 * class only needs `width, height -> id -> [x, y]` back.
 */
import * as d3 from "d3";

const STEP_MS = 700;

export interface DagNode {
  id: string;
  step: number;
  label: string;
  hover?: string;
}

export interface DagEdge {
  cause: string;
  effect: string;
  coef: number;
}

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** source (step 0) warm, sink (last step) cool -- the same family as danube-flood-map's own
 * ratioColor (d3.interpolateRdBu), and the order Miljana's own notebooks colour their steps in. */
export function stepColor(t: number): string {
  return d3.interpolateRdYlBu(Math.max(0, Math.min(1, t)));
}

export class DagChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width = 640;
  private height = 440;
  private pos = new Map<string, [number, number]>();
  private playing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private lastRevealed = -1;
  private steps: number;

  constructor(
    private host: HTMLElement,
    private nodes: DagNode[],
    private edges: DagEdge[],
    private generations: string[][],
    private layoutFn: (width: number, height: number) => Map<string, [number, number]>,
    /** extra SVG content drawn under the nodes/edges (a route backdrop, a map outline...) */
    private backdrop?: (g: d3.Selection<SVGGElement, unknown, null, undefined>, pos: Map<string, [number, number]>) => void,
    /** called after every render (a manual step, a resize, or one tick of play()) with the
     * generation index just shown -- the one hook a caller needs to keep its own readout text
     * in sync with play()'s own interval, without reaching into this class's private timer.
     * Public and settable after construction, since a caller usually wants to pass `this` chart
     * into its own readout closure, which needs the chart to already exist. */
    public onRender?: (revealedGen: number) => void
  ) {
    this.steps = generations.length;
    this.svg = d3.select(host).append("svg").attr("class", "dag-chart");
    new ResizeObserver(() => {
      const w = Math.round(host.clientWidth);
      if (w) this.resize(w);
    }).observe(host);
    this.resize(host.clientWidth || this.width);
  }

  resize(width: number) {
    this.width = width || this.width;
    this.svg.attr("width", this.width).attr("height", this.height).attr("viewBox", `0 0 ${this.width} ${this.height}`);
    this.pos = this.layoutFn(this.width, this.height);
    this.render(this.lastRevealed);
  }

  /** `revealedGen` is the last generation index shown (-1: nothing yet, generations.length - 1: everyone) */
  render(revealedGen: number) {
    this.lastRevealed = revealedGen;
    const stepOf = new Map(this.nodes.map((n) => [n.id, n.step]));
    const shown = (id: string) => (stepOf.get(id) ?? 0) <= revealedGen;
    const muted = css("--muted", "#888");
    const line = css("--line", "rgba(0,0,0,0.1)");

    this.svg.selectAll("*").remove();
    const g = this.svg.append("g");
    this.backdrop?.(g, this.pos);

    const edgeSel = g
      .append("g")
      .attr("class", "dag-edges")
      .selectAll("line")
      .data(this.edges.filter((e) => this.pos.has(e.cause) && this.pos.has(e.effect)))
      .join("line")
      .attr("class", "dag-edge")
      .attr("x1", (d) => this.pos.get(d.cause)![0])
      .attr("y1", (d) => this.pos.get(d.cause)![1])
      .attr("x2", (d) => this.pos.get(d.effect)![0])
      .attr("y2", (d) => this.pos.get(d.effect)![1])
      .attr("stroke", (d) => (shown(d.effect) ? stepColor((stepOf.get(d.cause) ?? 0) / Math.max(1, this.steps - 1)) : line))
      .attr("stroke-width", (d) => Math.max(1, d.coef * 4))
      .attr("stroke-opacity", (d) => (shown(d.effect) ? 0.75 : 0.25))
      .attr("stroke-linecap", "round");
    edgeSel.append("title").text((d) => `${d.cause} → ${d.effect} (coefficient ${d.coef.toFixed(2)})`);

    const nodeSel = g
      .append("g")
      .attr("class", "dag-nodes")
      .selectAll("g")
      .data(this.nodes.filter((n) => this.pos.has(n.id)))
      .join("g")
      .attr("class", "dag-node")
      .attr("transform", (d) => `translate(${this.pos.get(d.id)![0]},${this.pos.get(d.id)![1]})`);

    nodeSel
      .append("circle")
      .attr("class", "dag-dot")
      .attr("r", (d) => (shown(d.id) ? 7 : 5))
      .attr("fill", (d) => (shown(d.id) ? stepColor(d.step / Math.max(1, this.steps - 1)) : muted))
      .attr("fill-opacity", (d) => (shown(d.id) ? 1 : 0.35));

    nodeSel
      .filter((d) => d.step === revealedGen + 1)
      .append("circle")
      .attr("class", "dag-next")
      .attr("r", 11);

    nodeSel
      .append("text")
      .attr("class", "dag-label")
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .attr("opacity", (d) => (shown(d.id) ? 1 : 0.55))
      .text((d) => d.label);

    nodeSel.append("title").text((d) => d.hover ?? d.label);

    this.onRender?.(revealedGen);
  }

  play(onDone?: () => void) {
    if (this.playing) return;
    if (this.reducedMotion) {
      this.render(this.steps - 1);
      onDone?.();
      return;
    }
    this.playing = true;
    let i = Math.max(-1, this.lastRevealed);
    this.render(i);
    this.timer = setInterval(() => {
      i++;
      this.render(i);
      if (i >= this.steps - 1) {
        this.stop();
        onDone?.();
      }
    }, STEP_MS);
  }

  reset() {
    this.stop();
    this.render(-1);
  }

  stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get isPlaying() {
    return this.playing;
  }
}
