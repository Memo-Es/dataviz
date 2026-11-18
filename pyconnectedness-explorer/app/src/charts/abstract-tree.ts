/**
 * Causality on an uploaded file: the same MaxLinear(...).fit(method="qtree") the Danube map
 * runs, but drawn as a plain hierarchy instead of on a map. There are no real-world coordinates
 * or river lines for an arbitrary file's stations -- those come from graphicalExtremes/Natural
 * Earth specifically for the Danube gauges, not from the library itself -- so this draws the
 * fitted tree by its own structure: root at top, each station's one upstream cause below it.
 */
import * as d3 from "d3";
import type { AbstractTreeData } from "../upload/upload";

const STEP_MS = 650;

interface Node {
  id: string;
  children: Node[];
}

type PointNode = d3.HierarchyPointNode<Node>;

export class AbstractTree {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private containerWidth = 640;
  private width = 640;
  private height = 420;
  private data: AbstractTreeData;
  private parentOf: Map<string, { to: string; score: number | null } | null>;
  private nodesById = new Map<string, PointNode>();
  private lastPicked: string;
  private lastReached: string[] = [];
  private playing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(
    private host: HTMLElement,
    data: AbstractTreeData,
    private onStep: (reached: string[], picked: string) => void
  ) {
    this.data = data;
    this.parentOf = new Map(data.names.map((n) => [n, null]));
    for (const e of data.edges) this.parentOf.set(e.cause, { to: e.effect, score: e.score });
    this.svg = d3.select(host).append("svg").attr("class", "abstract-tree");
    new ResizeObserver(() => {
      const w = Math.round(host.clientWidth);
      if (w && w !== this.containerWidth) {
        this.containerWidth = w;
        this.layout();
        this.render(this.lastPicked, this.lastReached);
      }
    }).observe(host);
    this.lastPicked = data.names.find((n) => n !== data.root) ?? data.root;
    this.layout();
  }

  /** the chain from `station` to the root, each step with the score of the edge that carried it */
  path_(station: string): { id: string; score: number | null }[] {
    const out: { id: string; score: number | null }[] = [{ id: station, score: null }];
    let cur = station;
    const seen = new Set([cur]);
    for (;;) {
      const next = this.parentOf.get(cur);
      if (!next) break;
      if (seen.has(next.to)) break; // guards against any malformed cycle; never true on a tree
      seen.add(next.to);
      out.push({ id: next.to, score: next.score });
      cur = next.to;
    }
    return out;
  }

  private hierarchyData(): Node {
    const upstreamOf = new Map<string, string[]>();
    for (const n of this.data.names) upstreamOf.set(n, []);
    // edge.cause flows INTO edge.effect, so effect is the parent in a tree drawn root-down
    for (const e of this.data.edges) upstreamOf.get(e.effect)?.push(e.cause);
    const seen = new Set<string>();
    const build = (id: string): Node => {
      seen.add(id);
      const kids = (upstreamOf.get(id) ?? []).filter((c) => !seen.has(c));
      return { id, children: kids.map(build) };
    };
    return build(this.data.root);
  }

  /** fixed spacing per level and per sibling, not "stretch to fill the container": the real
   * shape varies with whoever's file this is -- a bushy tree and a near-straight chain both
   * came up fitting real synthetic data while building this -- and stretching a chain to fill
   * a wide, short box spreads its few nodes across huge dead gaps. The drawing is exactly as
   * big as the tree needs; only the *minimum* width tracks the card, so a small tree still
   * isn't squeezed into a sliver. */
  private layout() {
    const margin = { top: 34, bottom: 28, side: 34 };
    const dx = 48; // gap between siblings
    const dy = 60; // gap between levels (root at top)
    const root = d3.hierarchy(this.hierarchyData(), (d) => d.children);
    d3.tree<Node>().nodeSize([dx, dy])(root);
    const nodes = root.descendants() as PointNode[];
    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x));
    const maxY = Math.max(...nodes.map((n) => n.y));
    const treeWidth = maxX - minX + margin.side * 2;
    for (const n of nodes) {
      n.x = n.x - minX + Math.max(margin.side, (Math.max(treeWidth, this.containerWidth) - treeWidth) / 2 + margin.side);
      n.y += margin.top;
    }
    this.width = Math.max(treeWidth, this.containerWidth || treeWidth);
    this.height = maxY + margin.top + margin.bottom;
    this.svg.attr("width", this.width).attr("height", this.height).attr("viewBox", `0 0 ${this.width} ${this.height}`);
    this.nodesById = new Map(nodes.map((n) => [n.data.id, n]));
  }

  render(picked: string, reached: string[]) {
    this.lastPicked = picked;
    this.lastReached = reached;
    const chain = this.path_(picked).map((s) => s.id); // [picked, ..., root]
    const reachedSet = new Set([picked, ...reached]);
    const next = chain[1 + reached.length]; // the step right after the last reached one, if any
    const onChain = (a: string, b: string) => {
      const ia = chain.indexOf(a), ib = chain.indexOf(b);
      return ia !== -1 && ib !== -1 && Math.abs(ia - ib) === 1;
    };

    this.svg.selectAll("*").remove();
    const nodes = [...this.nodesById.values()];
    const link = d3
      .linkVertical<unknown, { x: number; y: number }>()
      .x((d) => d.x)
      .y((d) => d.y);

    // every edge, muted; the picked-to-root chain redrawn on top, highlighted. Decorative only
    // -- a link's stroke sits exactly at a node's own point, so without this it can intercept a
    // click meant for the node right where the two meet
    const g = this.svg.append("g");
    g.append("g")
      .attr("class", "at-links")
      .attr("pointer-events", "none")
      .selectAll("path")
      .data(nodes.filter((n) => n.parent))
      .join("path")
      .attr("class", "at-link")
      .attr("d", (d) => link({ source: d.parent!, target: d }));

    g.append("g")
      .attr("class", "at-links-on")
      .attr("pointer-events", "none")
      .selectAll("path")
      .data(nodes.filter((n) => n.parent && onChain(n.data.id, n.parent.data.id)))
      .join("path")
      .attr("class", "at-link on")
      .attr("d", (d) => link({ source: d.parent!, target: d }));

    const nodeSel = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "at-node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .style("cursor", "pointer")
      .on("click", (_ev, d) => this.pick(d.data.id));

    // a bigger invisible hit target than the visible dot: easier to click precisely, and never
    // smaller than the touch target a link's own stroke could otherwise compete with
    nodeSel.append("circle").attr("class", "at-hit").attr("r", 14);

    nodeSel
      .append("circle")
      .attr("class", (d) => `at-dot${reachedSet.has(d.data.id) ? " on" : ""}${d.data.id === this.data.root ? " root" : ""}`)
      .attr("r", (d) => (d.data.id === picked || reachedSet.has(d.data.id) ? 7 : 5.5));

    nodeSel
      .filter((d) => d.data.id === next)
      .append("circle")
      .attr("class", "at-warn")
      .attr("r", 11);

    nodeSel
      .append("text")
      .attr("class", "at-label")
      .attr("y", (d) => (d.children ? -13 : 17))
      .attr("text-anchor", "middle")
      .text((d) => d.data.id);

    this.onStep(reached, picked);
  }

  /** pick a station: stop any run, show it alone (no upstream reached yet) */
  pick(id: string) {
    this.stop();
    this.render(id, []);
  }

  /** press play: reveal the picked station's path to the root one step at a time */
  play(onDone?: () => void) {
    if (this.playing) return;
    const chain = this.path_(this.lastPicked).slice(1).map((s) => s.id); // excludes the pick itself
    if (this.reducedMotion || chain.length === 0) {
      this.render(this.lastPicked, chain);
      onDone?.();
      return;
    }
    this.playing = true;
    let i = 0;
    const reached: string[] = [];
    this.timer = setInterval(() => {
      reached.push(chain[i]);
      this.render(this.lastPicked, [...reached]);
      i++;
      if (i >= chain.length) {
        this.stop();
        onDone?.();
      }
    }, STEP_MS);
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
