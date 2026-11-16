/**
 * Graph 4: the directed tree for extremes on the Upper Danube (Tran, Buck and Klueppelberg,
 * 2024) -- `MaxLinear(...).fit(method="qtree")`, read straight from
 * public/data/danube/danube.json (pipeline/run_danube.py). Every number -- the tree, the edge
 * scores, the comparison to the paper's ground truth -- is the library's own output; this file
 * only draws it on a map and animates a pick.
 *
 * The tree is root-directed: every station has exactly one path to the root. So "downstream of
 * a pick" is one chain, not a branching spread, and Play reveals that chain one station at a
 * time, each one sized by the score of the edge that carried it (fixed across every pick, so a
 * size means the same thing whichever station is picked -- the rule CONTEXT.md gives for every
 * other graph's scales).
 *
 * The map's river lines are the real network (every edge of the paper's own ground-truth tree,
 * traced from Natural Earth where a named river reaches both endpoints, a straight line between
 * the two real gauges otherwise -- see pipeline/datasets/danube/README.md). The animated
 * highlight follows the model's estimated tree instead, which is not always the same edge set;
 * where they differ the highlight still runs along the real river lines' corridor, since the
 * model's edge is still between two real, mapped stations.
 */
import * as d3 from "d3";

export interface DanubeStation {
  id: number;
  river: string;
  lat: number;
  lon: number;
  altitude_m: number;
}

export interface DanubeEdge {
  cause: number;
  effect: number;
  score: number;
}

export interface DanubeData {
  source: { library: string; commit: string; data: string[] };
  method: {
    call: string;
    selection: { how: string; seed: number; threshold: number; lower: number; variability: number; grid: { threshold: number; lower: number; variability: number }[] };
  };
  root: number;
  stations: DanubeStation[];
  edges: DanubeEdge[];
  reachability: Record<string, number[]>;
  comparison_to_ground_truth: {
    edges_total: number;
    directed_matches: number;
    undirected_matches: number;
    metrics: Record<string, Record<string, number>>;
  };
  rivers: GeoJSON.FeatureCollection<GeoJSON.LineString, { from: number; to: number; river: string | null; source: string | null; drawn: "traced" | "straight" }>;
}

export async function loadDanube(): Promise<DanubeData> {
  const res = await fetch(new URL("data/danube/danube.json", document.baseURI).href);
  if (!res.ok) throw new Error(`danube.json: ${res.status}`);
  return res.json();
}

const STEP_MS = 650;

/** River -> one of the page's eight categorical hues, in the order the rivers first appear
 * going downstream from the most upstream station, so the biggest tributaries (the Danube
 * itself, then Isar, Inn...) get the earliest, most separated hues. Saalach and Salzach share
 * a slot: Saalach is two stations feeding directly into Salzach, the smallest tributary here. */
const RIVER_GROUP: Record<string, string> = {
  Donau: "Donau", Isar: "Isar", Inn: "Inn", Lech: "Lech",
  Salzach: "Salzach/Saalach", Saalach: "Salzach/Saalach",
  Naab: "Naab", Regen: "Regen", Iller: "Iller",
};
const GROUP_ORDER = ["Donau", "Isar", "Inn", "Lech", "Salzach/Saalach", "Naab", "Regen", "Iller"];

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export class DanubeMap {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width = 640;
  private height = 640;
  private data: DanubeData;
  private byId: Map<number, DanubeStation>;
  private parentOf: Map<number, { to: number; score: number } | null>; // one outgoing edge per non-root station
  private scoreExtent: [number, number];
  private groupColor: d3.ScaleOrdinal<string, string>;
  private projection: d3.GeoProjection;
  private path: d3.GeoPath;
  private playing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(
    private host: HTMLElement,
    data: DanubeData,
    private onStep: (reached: number[], picked: number) => void
  ) {
    this.data = data;
    this.byId = new Map(data.stations.map((s) => [s.id, s]));
    this.parentOf = new Map(data.stations.map((s) => [s.id, null]));
    for (const e of data.edges) this.parentOf.set(e.cause, { to: e.effect, score: e.score });
    this.scoreExtent = d3.extent(data.edges, (e) => e.score) as [number, number];

    const hues = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => css(`--bead-${i}`, "#888"));
    this.groupColor = d3.scaleOrdinal<string, string>().domain(GROUP_ORDER).range(hues);

    this.svg = d3.select(host).append("svg").attr("class", "danube-map");
    this.projection = d3.geoMercator();
    this.path = d3.geoPath(this.projection);
    new ResizeObserver(() => {
      const w = Math.round(host.clientWidth);
      if (w && w !== this.width) {
        this.width = w;
        this.height = Math.round(w * 0.86);
        this.layout();
        this.render(this.lastPicked, this.lastReached);
      }
    }).observe(host);
    this.lastPicked = data.stations.some((s) => s.id === 21) ? 21 : data.stations[0].id;
    this.layout();
  }

  /** the chain from `station` to the root, each step with the edge score that carried it */
  path_(station: number): { id: number; score: number | null }[] {
    const out: { id: number; score: number | null }[] = [{ id: station, score: null }];
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

  private layout() {
    const fc = { type: "FeatureCollection", features: this.data.stations.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lon, s.lat] } })) } as GeoJSON.FeatureCollection;
    this.projection.fitExtent([[36, 20], [this.width - 20, this.height - 20]], fc);
    this.svg.attr("width", this.width).attr("height", this.height).attr("viewBox", `0 0 ${this.width} ${this.height}`);
  }

  private lastPicked: number;
  private lastReached: number[] = [];

  /** draw the map for a pick, with `reached` (a prefix of the path to the root) highlighted */
  render(picked: number, reached: number[]) {
    this.lastPicked = picked;
    this.lastReached = reached;
    const ink = css("--stone", "#4a4843");
    const line = css("--line", "rgba(17,17,17,.14)");
    const panel = css("--panel", "#fff");
    const accent = css("--accent", "#2b2a27");
    const reachedSet = new Set(reached);
    const scoreOf = (id: number) => this.parentOf.get(id)?.score ?? 0;
    const widthScale = d3.scaleSqrt().domain([0, this.scoreExtent[1]]).range([1, 7]);
    const radiusScale = d3.scaleSqrt().domain([0, this.scoreExtent[1]]).range([5, 11]);

    this.svg.selectAll("*").remove();
    const g = this.svg.append("g");

    // the real river network, quiet, as context for every pick
    g.append("g")
      .attr("class", "danube-rivers")
      .selectAll("path")
      .data(this.data.rivers.features)
      .join("path")
      .attr("d", (d) => this.path(d as unknown as d3.GeoPermissibleObjects))
      .attr("fill", "none")
      .attr("stroke", line)
      .attr("stroke-width", 1.6)
      .attr("stroke-dasharray", (d) => (d.properties.drawn === "straight" ? "1.5,3" : null))
      .attr("stroke-linecap", "round");

    // the model's estimated path from the pick to the root, one segment per step already
    // reached, each as wide as its edge's score on one scale across every pick
    const chain = this.path_(picked);
    const segs: { a: DanubeStation; b: DanubeStation; score: number }[] = [];
    for (let i = 0; i < chain.length - 1; i++) {
      if (!reachedSet.has(chain[i + 1].id)) break;
      segs.push({ a: this.byId.get(chain[i].id)!, b: this.byId.get(chain[i + 1].id)!, score: chain[i + 1].score ?? 0 });
    }
    g.append("g")
      .attr("class", "danube-path")
      .selectAll("line")
      .data(segs)
      .join("line")
      .attr("x1", (d) => this.projection([d.a.lon, d.a.lat])![0])
      .attr("y1", (d) => this.projection([d.a.lon, d.a.lat])![1])
      .attr("x2", (d) => this.projection([d.b.lon, d.b.lat])![0])
      .attr("y2", (d) => this.projection([d.b.lon, d.b.lat])![1])
      .attr("stroke", accent)
      .attr("stroke-width", (d) => widthScale(d.score))
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.9);

    // stations: colour is the river (the page's one colour rule), picked/reached get the ink
    // ring that marks a pick on every other graph; everyone else a plain dot with its number
    const stationSel = g
      .append("g")
      .attr("class", "danube-stations")
      .selectAll("g")
      .data(this.data.stations)
      .join("g")
      .attr("class", "hit")
      .attr("transform", (d) => `translate(${this.projection([d.lon, d.lat])!.join(",")})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => `Station ${d.id}, ${d.river}${d.id === this.data.root ? ", the root" : ""}`)
      .on("click", (_e, d) => this.pick(d.id))
      .on("keydown", (ev: KeyboardEvent, d) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          this.pick(d.id);
        }
      });

    stationSel
      .append("circle")
      .attr("r", (d) => (d.id === picked || reachedSet.has(d.id) ? radiusScale(scoreOf(d.id) || this.scoreExtent[1] * 0.15) : 6))
      .attr("fill", (d) => this.groupColor(RIVER_GROUP[d.river] ?? d.river))
      .attr("fill-opacity", (d) => (d.id === picked || reachedSet.has(d.id) || reached.length === 0 ? 1 : 0.35))
      .attr("stroke", (d) => (d.id === picked ? accent : d.id === this.data.root ? ink : panel))
      .attr("stroke-width", (d) => (d.id === picked ? 3 : d.id === this.data.root ? 2 : 1.5));

    stationSel
      .filter((d) => d.id === this.data.root)
      .append("text")
      .attr("class", "danube-root-label")
      .attr("y", -14)
      .attr("text-anchor", "middle")
      .text("root");

    stationSel
      .append("text")
      .attr("class", "danube-id")
      .attr("dy", "0.32em")
      .attr("text-anchor", "middle")
      .attr("fill", (d) => (d.id === picked || reachedSet.has(d.id) ? panel : ink))
      .attr("font-size", (d) => (d.id === picked || reachedSet.has(d.id) ? "10px" : "9px"))
      .attr("font-weight", (d) => (d.id === picked || reachedSet.has(d.id) ? 700 : 500))
      .text((d) => d.id);
  }

  /** pick a station: stop any run, show it alone (no downstream reached yet) */
  pick(id: number) {
    this.stop();
    this.render(id, []);
    this.onStep([], id);
  }

  /** press play: reveal the picked station's path to the root one step at a time */
  play(onDone?: () => void) {
    if (this.playing) return;
    const chain = this.path_(this.lastPicked).slice(1).map((s) => s.id); // excludes the pick itself
    if (this.reducedMotion || chain.length === 0) {
      this.render(this.lastPicked, chain);
      this.onStep(chain, this.lastPicked);
      onDone?.();
      return;
    }
    this.playing = true;
    let i = 0;
    const reached: number[] = [];
    this.timer = setInterval(() => {
      reached.push(chain[i]);
      this.render(this.lastPicked, [...reached]);
      this.onStep([...reached], this.lastPicked);
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

  svgNode() {
    return this.svg.node()!;
  }
}

/** river groups present in this dataset, in the fixed colour order, for the legend */
export function riverLegendGroups(data: DanubeData): { group: string; color: string }[] {
  const present = new Set(data.stations.map((s) => RIVER_GROUP[s.river] ?? s.river));
  const hues = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => css(`--bead-${i}`, "#888"));
  const scale = d3.scaleOrdinal<string, string>().domain(GROUP_ORDER).range(hues);
  return GROUP_ORDER.filter((g) => present.has(g)).map((group) => ({ group, color: scale(group) }));
}
