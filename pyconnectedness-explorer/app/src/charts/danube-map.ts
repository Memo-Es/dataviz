/**
 * Graph 4: the directed tree for extremes on the Upper Danube (Tran, Buck and Klüppelberg,
 * 2024) — `MaxLinear(...).fit(method="qtree")`, read straight from
 * public/data/danube/danube.json (pipeline/run_danube.py). Every number — the tree, the edge
 * scores, the comparison to the paper's ground truth — is the library's own output; this file
 * only draws it on a map and animates a pick.
 *
 * The tree is root-directed: every station has exactly one path to the root. So "downstream of
 * a pick" is one chain, not a branching spread, and Play reveals that chain one station at a
 * time, each one sized by the score of the edge that carried it (fixed across every pick, so a
 * size means the same thing whichever station is picked — the rule CONTEXT.md gives for every
 * other graph's scales).
 *
 * The map's river lines are the real network (every edge of the paper's own ground-truth tree,
 * all 30 traced from World Data Bank II where a named river connects the two gauges, or as a
 * smooth hand-drawn line through them otherwise — see pipeline/datasets/danube/README.md). The
 * animated highlight follows the model's estimated tree instead, which is not always the same
 * edge set; where they differ the highlight still runs along the real river lines' corridor,
 * since the model's edge is still between two real, mapped stations.
 */
import * as d3 from "d3";

export interface DanubeStation {
  id: number;
  river: string;
  lat: number;
  lon: number;
  altitude_m: number;
  /** the same gauge snapped onto rivers.geojson's own traced line -- use this to place the
   * station dot so it lands exactly on the river; lat/lon above stay the true gauge position,
   * for the hover detail and every citation */
  river_lat: number;
  river_lon: number;
  yearly_flood_peak: number;
  mean_flow: number;
}

export interface DanubeEdge {
  cause: number;
  effect: number;
  score: number;
}

/** one named historical flood: daily discharge at every gauge, as a ratio to that gauge's own
 * yearly flood peak (1.0 = a normal yearly flood there). `null` where the gauge's own record
 * doesn't cover that day (see pipeline/datasets/danube/README.md). */
export interface DanubeFloodEvent {
  dates: string[];
  ratio: Record<string, (number | null)[]>;
}
export type DanubeFloods = Record<string, DanubeFloodEvent>;

/** the real ETOPO1 10-arcminute elevation grid under the tilted map's terrain backdrop.
 * `elevation_m[i][j]` is the mean elevation at `lats[i]`, `lons[j]`; `lats` runs south to
 * north, matching pipeline/datasets/danube/bavaria_relief_10arcmin.csv. */
export interface DanubeRelief {
  lats: number[];
  lons: number[];
  elevation_m: number[][];
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
    /** the paper's own tree (danube_network.csv): root is the real outlet (Passau), next[s]
     * the one real downstream neighbour station s has there. Used only to mark where the
     * model's path stops matching the real river -- never to redraw the model's own path. */
    ground_truth_tree: { root: number; next: Record<string, number> };
  };
  rivers: GeoJSON.FeatureCollection<GeoJSON.LineString, { from: number; to: number; river: string | null; source: string | null; drawn: "traced" | "straight" }>;
  relief: DanubeRelief;
  floods: DanubeFloods;
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

/** an unordered pair, as a lookup key for the rivers geojson's {from, to} features */
function pairKeyOf(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** the tilted map's terrain backdrop, painted from the real elevation grid instead of a
 * hand-picked gradient: one pixel per grid cell (so the browser's own image scaling smooths
 * it), low elevation at `--band` (the page's own light panel tint) up through the same brown
 * ramp the sketch always used, high elevation darkest. Flipped so the image's own top is north,
 * matching the grid's south-to-north row order against the projection's north-is-up screen. */
function reliefDataUrl(relief: DanubeRelief): string {
  const { lats, lons, elevation_m } = relief;
  const rows = lats.length;
  const cols = lons.length;
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d")!;
  let min = Infinity;
  let max = -Infinity;
  for (const row of elevation_m) for (const v of row) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const ramp = d3
    .scaleLinear<string>()
    .domain([0, 0.22, 0.45, 0.7, 1])
    .range([css("--band", "#e8dcc4"), "#d9c49a", "#b89968", "#8a6f45", "#6b5234"])
    .interpolate(d3.interpolateRgb);
  for (let i = 0; i < rows; i++) {
    const y = rows - 1 - i; // row 0 is the southernmost in the data, the bottom of the image
    for (let j = 0; j < cols; j++) {
      ctx.fillStyle = ramp((elevation_m[i][j] - min) / (max - min));
      ctx.fillRect(j, y, 1, 1);
    }
  }
  return canvas.toDataURL("image/png");
}

export class DanubeMap {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width = 640;
  private height = 640;
  private data: DanubeData;
  private byId: Map<number, DanubeStation>;
  private parentOf: Map<number, { to: number; score: number } | null>; // one outgoing edge per non-root station
  private realNext: Map<number, number>; // the ground-truth tree's one real downstream neighbour
  private riverByPair: Map<string, GeoJSON.Feature<GeoJSON.LineString, { from: number; to: number }>>;
  private groupColor: d3.ScaleOrdinal<string, string>;
  private projection: d3.GeoProjection;
  private path: d3.GeoPath;
  private playing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private tilted = false;
  private reliefUrl: string | null = null; // computed once, lazily, on the first tilt
  private barsLayer: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  private barEls = new Map<number, HTMLDivElement>();

  constructor(
    private host: HTMLElement,
    data: DanubeData,
    private onStep: (reached: number[], picked: number) => void
  ) {
    this.data = data;
    this.byId = new Map(data.stations.map((s) => [s.id, s]));
    this.parentOf = new Map(data.stations.map((s) => [s.id, null]));
    for (const e of data.edges) this.parentOf.set(e.cause, { to: e.effect, score: e.score });
    this.realNext = new Map(
      Object.entries(data.comparison_to_ground_truth.ground_truth_tree.next).map(([k, v]) => [Number(k), v])
    );
    this.riverByPair = new Map(
      data.rivers.features.map((f) => [pairKeyOf(f.properties.from, f.properties.to), f])
    );

    const hues = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => css(`--bead-${i}`, "#888"));
    this.groupColor = d3.scaleOrdinal<string, string>().domain(GROUP_ORDER).range(hues);

    this.svg = d3.select(host).append("svg").attr("class", "danube-map");
    // a flat, screen-aligned layer for the rising bars: a sibling of the svg, not a child of its
    // tilted transform, so a bar's own CSS height animates normally while still landing on the
    // tilted floor's real on-screen point (read back from the svg's own screen CTM, below)
    this.barsLayer = d3.select(host).append("div").attr("class", "danube-bars");
    this.projection = d3.geoMercator();
    this.path = d3.geoPath(this.projection);
    new ResizeObserver(() => {
      const w = Math.round(host.clientWidth);
      if (w && w !== this.width) {
        this.width = w;
        this.height = Math.round(w * 0.86);
        this.layout();
        this.render(this.lastPicked, this.lastReached);
        this.fitTiltedHeight();
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
    const fc = { type: "FeatureCollection", features: this.data.stations.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.river_lon, s.river_lat] } })) } as GeoJSON.FeatureCollection;
    this.projection.fitExtent([[36, 20], [this.width - 20, this.height - 20]], fc);
    this.svg.attr("width", this.width).attr("height", this.height).attr("viewBox", `0 0 ${this.width} ${this.height}`);
  }

  private lastPicked: number;
  private lastReached: number[] = [];

  /** the real river's own hops from `from`, continuing to the real root, as one coordinate
   * list (each hop's traced/straight geometry from the rivers geojson, oriented from->to) */
  private realContinuation(from: number): GeoJSON.Position[] {
    const coords: GeoJSON.Position[] = [];
    let cur = from;
    const seen = new Set([cur]);
    for (let guard = 0; guard < this.data.stations.length; guard++) {
      const next = this.realNext.get(cur);
      if (next === undefined || seen.has(next)) break;
      seen.add(next);
      const feat = this.riverByPair.get(pairKeyOf(cur, next));
      let hop = feat ? feat.geometry.coordinates.slice() : [[this.byId.get(cur)!.river_lon, this.byId.get(cur)!.river_lat], [this.byId.get(next)!.river_lon, this.byId.get(next)!.river_lat]];
      if (feat && feat.properties.from !== cur) hop = hop.slice().reverse();
      coords.push(...(coords.length ? hop.slice(1) : hop));
      cur = next;
    }
    return coords;
  }

  /** draw the map for a pick, with `reached` (a prefix of the path to the root) highlighted */
  render(picked: number, reached: number[]) {
    this.lastPicked = picked;
    this.lastReached = reached;
    const ink = css("--stone", "#4a4843");
    const line = css("--line", "rgba(17,17,17,.14)");
    const panel = css("--panel", "#fff");
    const accent = css("--accent", "#2b2a27");
    const warn = css("--warn", "#d97706");
    const reachedSet = new Set(reached);

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
    // reached. Every edge the same width: qtree's score is what the tree search itself
    // optimised over (eq. 7 of the paper), not a flood magnitude -- it stays in the Code
    // snippet, but nothing on the map is sized by it until the team says what should be.
    const chain = this.path_(picked);
    const segs: { a: DanubeStation; b: DanubeStation }[] = [];
    let departAt: DanubeStation | null = null;
    for (let i = 0; i < chain.length - 1; i++) {
      if (!reachedSet.has(chain[i + 1].id)) break;
      segs.push({ a: this.byId.get(chain[i].id)!, b: this.byId.get(chain[i + 1].id)! });
      // the first step along the shown path where the model's next hop isn't the real river's
      if (departAt === null && this.realNext.get(chain[i].id) !== chain[i + 1].id) departAt = this.byId.get(chain[i].id)!;
    }
    g.append("g")
      .attr("class", "danube-path")
      .selectAll("line")
      .data(segs)
      .join("line")
      .attr("x1", (d) => this.projection([d.a.river_lon, d.a.river_lat])![0])
      .attr("y1", (d) => this.projection([d.a.river_lon, d.a.river_lat])![1])
      .attr("x2", (d) => this.projection([d.b.river_lon, d.b.river_lat])![0])
      .attr("y2", (d) => this.projection([d.b.river_lon, d.b.river_lat])![1])
      .attr("stroke", accent)
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.9);

    // the next real step downstream, not yet reached: a predictive "this is what's coming"
    // marker on the model's own path (never a station it doesn't actually reach next) -- what
    // Miljana asked for as "warning signs at the stations that will be affected next"
    const warnStation = chain[segs.length + 1] ?? null;

    // where the model's path departs from the real river: the real river's own continuation,
    // from there to its real outlet, drawn once the full estimated path to the root is on
    // screen -- a correction shown after the model's own answer, not instead of it
    const realRoot = this.data.comparison_to_ground_truth.ground_truth_tree.root;
    const chainDone = reached.length > 0 && reached[reached.length - 1] === this.data.root;
    if (departAt && chainDone) {
      const coords = this.realContinuation(departAt.id);
      if (coords.length > 1) {
        g.append("path")
          .attr("class", "danube-departure")
          .attr("d", this.path({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} } as d3.GeoPermissibleObjects))
          .attr("fill", "none")
          .attr("stroke", ink)
          .attr("stroke-width", 2.5)
          .attr("stroke-dasharray", "1,5")
          .attr("stroke-linecap", "round")
          .attr("opacity", 0.8);
        const end = coords[coords.length - 1];
        const xy = this.projection(end as [number, number])!;
        // keep the label inside the map even when its endpoint sits near an edge
        const anchor = xy[0] > this.width * 0.65 ? "end" : xy[0] < this.width * 0.35 ? "start" : "middle";
        const dx = anchor === "end" ? -8 : anchor === "start" ? 8 : 0;
        g.append("text")
          .attr("class", "danube-departure-label")
          .attr("x", xy[0] + dx)
          .attr("y", Math.max(xy[1] - 12, 12))
          .attr("text-anchor", anchor)
          .text(`real river continues to station ${realRoot}`);
      }
    }

    // stations: colour is the river (the page's one colour rule), picked/reached get the ink
    // ring that marks a pick on every other graph; everyone else a plain dot with its number
    const stationSel = g
      .append("g")
      .attr("class", "danube-stations")
      .selectAll("g")
      .data(this.data.stations)
      .join("g")
      .attr("class", "hit")
      .attr("data-station", (d) => d.id)
      .attr("transform", (d) => `translate(${this.projection([d.river_lon, d.river_lat])!.join(",")})`)
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

    // root gets its own stroke/label treatment only once the shock has actually arrived --
    // giving it that weight unconditionally (as before) made it the single most eye-catching
    // thing on the map from the first frame, before the path had gone anywhere near it, which
    // read as "the shock already reached the root" even on step one. Before any station is
    // reached (reached.length === 0, right after a fresh pick), there's nothing to overstate
    // yet, so it keeps the quiet, always-on label; the moment play starts stepping through
    // real stations, root goes quiet too until its own turn actually comes.
    const rootEmphasis = reached.length === 0 || reachedSet.has(this.data.root);

    stationSel
      .append("circle")
      .attr("r", (d) => (d.id === picked || reachedSet.has(d.id) ? 9 : 6))
      .attr("fill", (d) => this.groupColor(RIVER_GROUP[d.river] ?? d.river))
      .attr("fill-opacity", (d) => (d.id === picked || reachedSet.has(d.id) || reached.length === 0 ? 1 : 0.35))
      .attr("stroke", (d) => (d.id === picked ? accent : d.id === this.data.root && rootEmphasis ? ink : panel))
      .attr("stroke-width", (d) => (d.id === picked ? 3 : d.id === this.data.root && rootEmphasis ? 2 : 1.5));

    // real detail per station, on hover/focus: the native browser tooltip, no extra markup
    stationSel
      .append("title")
      .text((d) => `Station ${d.id} · ${d.river}\n${d.altitude_m} m altitude\n${d.lat.toFixed(3)}°N, ${d.lon.toFixed(3)}°E`);

    stationSel
      .filter((d) => d.id === this.data.root)
      .append("text")
      .attr("class", rootEmphasis ? "danube-root-label" : "danube-root-label quiet")
      .attr("y", -14)
      .attr("text-anchor", "middle")
      .text("model's root");

    // the station the model's own path reaches next, not yet flooded: a pulsing ring so a demo
    // can point at "this one's about to be warned" without claiming it already has been
    if (warnStation) {
      const warnSel = stationSel.filter((d) => d.id === warnStation!.id);
      warnSel
        .append("circle")
        .attr("class", "danube-warn-ring")
        .attr("r", 14)
        .attr("fill", "none")
        .attr("stroke", warn)
        .attr("stroke-width", 2.5);
      warnSel
        .append("text")
        .attr("class", "danube-warn-label")
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .attr("fill", warn)
        .text("next");
    }

    stationSel
      .append("text")
      .attr("class", "danube-id")
      .attr("dy", "0.32em")
      .attr("text-anchor", "middle")
      .attr("fill", (d) => (d.id === picked || reachedSet.has(d.id) ? panel : ink))
      .attr("font-size", (d) => (d.id === picked || reachedSet.has(d.id) ? "10px" : "9px"))
      .attr("font-weight", (d) => (d.id === picked || reachedSet.has(d.id) ? 700 : 500))
      .text((d) => d.id);

    this.syncBars(picked, reached);
  }

  /** the quick 3D sketch: tilt the flat map into a table-top perspective and, as the shock
   * reaches each station on the picked chain, rise a bar there -- not sized by score (the same
   * "nothing here is sized by the qtree score" rule as the flat map), just risen or not */
  setTilt(on: boolean) {
    this.tilted = on;
    this.host.classList.toggle("danube-tilted", on);
    if (on && !this.reliefUrl) {
      this.reliefUrl = reliefDataUrl(this.data.relief);
      this.host.style.setProperty("--danube-relief-image", `url(${this.reliefUrl})`);
    }
    this.syncBars(this.lastPicked, this.lastReached);
    this.fitTiltedHeight();
  }

  /** rotateX + perspective foreshorten the tilted map into a real painted footprint far
   * shorter than the flat layout height #danube-map still reserves (see the measured gap: a
   * ~290px-tall box holding ~150px of actual content) -- left alone, the card just carries
   * dead terrain-coloured space below the map. Pull the box in to the real rendered bottom
   * edge, read back from the svg's own getBoundingClientRect() like syncBars does above (a
   * screen-CTM recomputation doesn't reflect the ancestor's CSS `perspective` either). Always
   * resets the margin first so repeated resizes measure from a clean baseline, not one already
   * carrying the last call's correction. */
  private fitTiltedHeight() {
    const svgEl = this.svg.node() as SVGSVGElement;
    svgEl.style.marginBottom = "";
    if (!this.tilted) return;
    const hostBox = this.host.getBoundingClientRect();
    const svgBox = svgEl.getBoundingClientRect();
    const slack = hostBox.bottom - svgBox.bottom - 16; // 16px of breathing room below the real content
    if (slack > 0) svgEl.style.marginBottom = `${-slack}px`;
  }

  private syncBars(picked: number, reached: number[]) {
    if (!this.tilted) {
      this.barsLayer.selectAll("*").remove();
      this.barEls.clear();
      return;
    }
    const chain = this.path_(picked).map((s) => s.id);
    const reachedSet = new Set(reached);
    const hostBox = this.host.getBoundingClientRect();
    // one bar per station on the picked chain (fixed set for this pick, like the flat path);
    // reusing elements across renders so the CSS height transition plays instead of popping.
    // Positioned from the station circle's own getBoundingClientRect(), not projection math
    // re-run through getScreenCTM() -- that matrix doesn't reflect the ancestor's CSS
    // `perspective`, so a point it computes lands tens of pixels off the real tilted pixel;
    // the rendered circle's rect is where the browser actually painted it, always correct
    const chainSet = new Set(chain);
    for (const [id, el] of this.barEls) if (!chainSet.has(id)) { el.remove(); this.barEls.delete(id); }
    for (const id of chain) {
      const s = this.byId.get(id)!;
      const circle = this.svg.select<SVGCircleElement>(`[data-station="${id}"] circle`).node();
      let el = this.barEls.get(id);
      if (!el) {
        el = this.barsLayer.append("div").attr("class", "danube-bar").node()!;
        this.barEls.set(id, el);
      }
      if (circle) {
        const r = circle.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // "bottom", not "top": the bar's foot stays planted on the tilted floor's real point
        // while its CSS height transition grows it upward from there
        el.style.left = `${cx - hostBox.left}px`;
        el.style.bottom = `${hostBox.height - (cy - hostBox.top)}px`;
      }
      el.classList.toggle("risen", reachedSet.has(id) || id === picked);
      el.style.background = this.groupColor(RIVER_GROUP[s.river] ?? s.river);
    }
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
