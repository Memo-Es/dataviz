/**
 * Graph 4's data: the directed tree for extremes on the Upper Danube (Tran, Buck and
 * Klüppelberg, 2024) — `MaxLinear(...).fit(method="qtree")`, read straight from
 * public/data/danube/danube.json (pipeline/run_danube.py). Every number here — the tree, the
 * edge scores, the comparison to the paper's ground truth, the 4 real historical floods — is
 * the library's own output or real discharge data; this file is just the shape of it and the
 * one fetch that loads it. The one drawn view (danube-flood-map.ts, danube-flood-3d.ts) is the
 * real flood replay: a dateless "pick a station, watch a hypothetical shock" map used to live
 * here too, before the real flood replay's own "warned" state (the same fitted tree, read on
 * real data) made it redundant.
 *
 * The map's river lines are the real network (every edge of the paper's own ground-truth tree,
 * all 30 traced from World Data Bank II where a named river connects the two gauges, or as a
 * smooth hand-drawn line through them otherwise — see pipeline/datasets/danube/README.md).
 */

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

/** the real ETOPO1 10-arcminute elevation grid under the 3D terrain (danube-flood-3d.ts).
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
