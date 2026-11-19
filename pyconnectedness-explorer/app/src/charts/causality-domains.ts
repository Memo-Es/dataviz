/**
 * Loaders and layouts for the three "scaling"-method Causality domains -- Flight delays, Heat
 * waves, Vitamin A -- each read straight from pipeline/run_flights.py, run_heat.py and
 * run_vitamin_a.py's own JSON (every number is MaxLinear's own output; these files only draw
 * it). All three share dag-chart.ts for drawing; this file is just their data shapes and how
 * each one places its nodes.
 */
import * as d3 from "d3";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, document.baseURI).href);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export interface StabilitySummary {
  first_share: number;
  last_share: number;
  mean_position: number;
}

export interface Stability {
  k_orders: number[];
  sweep: Record<string, number[]>;
  summary: Record<string, StabilitySummary>;
}

export interface FlightsData {
  source: { library: string; commit: string; data: string[] };
  method: { call: string; delta: number };
  names: string[];
  airports: { id: string; name: string; city: string; lat: number; lon: number; step: number; position: number }[];
  generations: string[][];
  edges: { cause: string; effect: string; coef: number }[];
  routes: { a: string; b: string; flights: number }[];
  stability: Stability;
}

export interface HeatData {
  source: { library: string; commit: string; data: string[] };
  method: { call: string; note: string };
  stations: { id: string; lat: number; lon: number; region: string; mean_position: number | null }[];
  wave: { dates: string[]; anomaly_c: Record<string, (number | null)[]> };
  regions: string[];
  generations: string[][];
  edges: { cause: string; effect: string; coef: number }[];
  region_position: Record<string, number>;
  stability: Stability;
}

export interface VitaminAData {
  source: { library: string; commit: string; data: string[] };
  method: { call: string; formula: string; va_own_share: number };
  names: string[];
  nodes: { id: string; label: string; step: number; x: number; y: number }[];
  generations: string[][];
  edges: { cause: string; effect: string; coef: number }[];
  tail_mass_share: Record<string, number>;
}

export const loadFlights = () => fetchJson<FlightsData>("data/flights/flights.json");
export const loadHeat = () => fetchJson<HeatData>("data/heat/heat.json");
export const loadVitaminA = () => fetchJson<VitaminAData>("data/vitamin_a/vitamin_a.json");

/** d3.geoAlbersUsa, fit to the host like danube-map.ts's own Mercator -- continental US, Alaska
 * and Hawaii each in their own inset, the standard projection for a US-only point map. No state
 * or coastline geometry is bundled (the method's own causal links are the point, not terrain);
 * a light dot grid in dag-chart's backdrop gives the shape away well enough to read city names. */
export function albersUsaLayout(points: { id: string; lon: number; lat: number }[]) {
  return (width: number, height: number): Map<string, [number, number]> => {
    const projection = d3.geoAlbersUsa().fitExtent(
      [
        [24, 20],
        [width - 24, height - 20],
      ],
      { type: "FeatureCollection", features: points.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: {} })) } as GeoJSON.FeatureCollection
    );
    const out = new Map<string, [number, number]>();
    for (const p of points) {
      const xy = projection([p.lon, p.lat]);
      if (xy) out.set(p.id, xy as [number, number]);
    }
    return out;
  };
}

/** Vitamin A has no geography -- scales the notebook's own hand-placed x/y (roughly -1.5..1.5)
 * to fill the host, the same "fit what there is, don't stretch a small shape to a big box" rule
 * abstract-tree.ts uses for an uploaded file's fitted tree. */
export function pointLayout(nodes: { id: string; x: number; y: number }[]) {
  return (width: number, height: number): Map<string, [number, number]> => {
    const margin = 70;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const xScale = d3.scaleLinear().domain([Math.min(...xs), Math.max(...xs)]).range([margin, width - margin]);
    const yScale = d3.scaleLinear().domain([Math.min(...ys), Math.max(...ys)]).range([margin, height - margin]);
    const out = new Map<string, [number, number]>();
    for (const n of nodes) out.set(n.id, [xScale(n.x), yScale(n.y)]);
    return out;
  };
}
