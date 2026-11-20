/**
 * The Causality dashboard's own small previews -- the same real data each full view draws, laid
 * out small and without labels or interaction, the same job minis.ts does for Connectedness's
 * own Home (one card opens its graph; the preview is what earns the click). Each returns an SVG
 * string with a viewBox, so it scales to its card.
 */
import * as d3 from "d3";
import { stepColor } from "./dag-chart";
import type { DanubeData } from "./danube-map";

const W = 300;
const H = 150;
const PAD = 14;

/** fit a set of already-projected points into the mini canvas, centred and uniformly scaled
 * (never stretched -- a circle stays a circle) -- the one layout step miniDag and
 * miniRiverTree both need, after their own projection/layout has placed the real points. */
function fitPoints(points: [number, number][]): (p: [number, number]) => [number, number] {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs);
  const y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const s = Math.min((W - 2 * PAD) / Math.max(1e-6, x1 - x0), (H - 2 * PAD) / Math.max(1e-6, y1 - y0));
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2;
  return ([x, y]) => [W / 2 + (x - cx) * s, H / 2 + (y - cy) * s];
}

/** Flights, Heat, Vitamin A: a small version of the full DagChart's node-link drawing -- every
 * node at its own real layout position, every edge a thin line, coloured by the cause's own
 * causal step (the full chart's own stepColor convention). No labels -- too small to read at a
 * card's size, and the card's headline number already carries the one fact that matters. */
export function miniDag(nodes: { id: string; step: number }[], edges: { cause: string; effect: string }[], pos: Map<string, [number, number]>, steps: number): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const shown = nodes.filter((n) => pos.has(n.id));
  const fit = fitPoints(shown.map((n) => pos.get(n.id)!));
  const colorOf = (step: number) => stepColor(step / Math.max(1, steps - 1));
  const lines = edges
    .filter((e) => pos.has(e.cause) && pos.has(e.effect))
    .map((e) => {
      const [ax, ay] = fit(pos.get(e.cause)!);
      const [bx, by] = fit(pos.get(e.effect)!);
      return `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${colorOf(byId.get(e.cause)!.step)}" stroke-width="1.6" stroke-opacity="0.55"/>`;
    })
    .join("");
  const dots = shown
    .map((n) => {
      const [x, y] = fit(pos.get(n.id)!);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${colorOf(n.step)}"/>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${lines}${dots}</svg>`;
}

/** Rivers: the fitted tree's real stations, at their own real river-snapped coordinates (the
 * same d3.geoMercator the full map projects with), joined by the tree's own edges. Every dot
 * the same ink -- there's no causal-step colouring on a qtree the way the three DAG domains
 * have one, since the method here is a single tree, not a sources-first order. */
export function miniRiverTree(data: DanubeData, ink: string): string {
  const projection = d3.geoMercator();
  const fc = {
    type: "FeatureCollection",
    features: data.stations.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.river_lon, s.river_lat] } })),
  } as GeoJSON.FeatureCollection;
  projection.fitExtent(
    [
      [PAD, PAD],
      [W - PAD, H - PAD],
    ],
    fc
  );
  const byId = new Map(data.stations.map((s) => [s.id, s]));
  const at = (id: number) => projection([byId.get(id)!.river_lon, byId.get(id)!.river_lat])!;
  const lines = data.edges
    .map((e) => {
      const [ax, ay] = at(e.cause);
      const [bx, by] = at(e.effect);
      return `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${ink}" stroke-opacity="0.35" stroke-width="1.4"/>`;
    })
    .join("");
  const dots = data.stations
    .map((s) => {
      const [x, y] = at(s.id);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.id === data.root ? 5 : 3}" fill="${ink}" fill-opacity="${s.id === data.root ? 1 : 0.7}"/>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${lines}${dots}</svg>`;
}
