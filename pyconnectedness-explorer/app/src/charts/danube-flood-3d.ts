/**
 * The real 3D terrain for Historical floods -- what Miljana's own deck shows for this exact
 * scenario: a genuine elevation mesh (the same ETOPO1 grid danube-map.ts paints as a flat CSS
 * backdrop), rivers draped on it, one column per gauge whose height AND colour both carry that
 * day's real ratio (her own "column height and colour" rule -- a flush, same-height marker
 * wasn't that, just a coloured dot on the surface). Built with Plotly's GL3D bundle, the
 * library her own deck uses, loaded lazily (it's a real WebGL dependency, ~500KB gzipped) only
 * once this view is actually switched on -- see main.ts's ensureFloodMap.
 *
 * "Warned" is drawn here too, the same rule and the same estimated tree as the flat map's own
 * (not a separate computation): a gauge not yet at its own 1x gets an amber ring the moment a
 * gauge upstream of it already has one.
 */
import type { DanubeData, DanubeRelief } from "./danube-map";
import { ratioColor } from "./danube-flood-map";

type Plotly3D = typeof import("plotly.js-gl3d-dist-min");

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** bilinear height at any (lon, lat) inside the grid, for placing rivers/stations exactly on
 * the terrain surface rather than floating or clipping through it */
function elevationAt(relief: DanubeRelief, lon: number, lat: number): number {
  const { lats, lons, elevation_m } = relief;
  const lonStep = lons[1] - lons[0];
  const latStep = lats[1] - lats[0];
  const fj = (lon - lons[0]) / lonStep;
  const fi = (lat - lats[0]) / latStep;
  const j0 = Math.max(0, Math.min(lons.length - 2, Math.floor(fj)));
  const i0 = Math.max(0, Math.min(lats.length - 2, Math.floor(fi)));
  const tj = Math.max(0, Math.min(1, fj - j0));
  const ti = Math.max(0, Math.min(1, fi - i0));
  const z00 = elevation_m[i0][j0];
  const z01 = elevation_m[i0][j0 + 1];
  const z10 = elevation_m[i0 + 1][j0];
  const z11 = elevation_m[i0 + 1][j0 + 1];
  const z0 = z00 * (1 - tj) + z01 * tj;
  const z1 = z10 * (1 - tj) + z11 * tj;
  return z0 * (1 - ti) + z1 * ti;
}

// rivers sit this many metres above the raw terrain height, so they read as clearly on top of
// the mesh rather than skimming/clipping through it at this grid's resolution
const DRAPE_OFFSET_M = 30;
// a station's column: the foot clears the terrain by the same drape offset the rivers use, the
// top rises above that by up to STEM_MAX_M, scaled by ratio against the same 0..2.5x ceiling
// the flat map's own marker size uses -- continuous, unlike shock-propagation's bars, since
// this is real magnitude data, not a search score nothing here is sized by
const STEM_MAX_M = 420;
const RATIO_CEIL = 2.5;

function ratioT(ratio: number | null): number {
  return ratio === null ? 0 : Math.max(0, Math.min(1, ratio / RATIO_CEIL));
}

export class DanubeFlood3D {
  private Plotly: Plotly3D | null = null;
  private ready: Promise<void>;
  private stationIds: number[];
  private reach: Map<number, Set<number>>;
  private groundZ: number[] = [];

  constructor(
    private host: HTMLElement,
    private data: DanubeData
  ) {
    this.stationIds = data.stations.map((s) => s.id);
    this.reach = new Map(
      Object.entries(data.reachability).map(([k, v]) => [Number(k), new Set(v)])
    );
    this.ready = this.init();
  }

  private flooding(event: string, day: number): Set<number> {
    const ratios = this.data.floods[event].ratio;
    const out = new Set<number>();
    for (const id of this.stationIds) {
      const v = ratios[String(id)][day];
      if (v !== null && v >= 1) out.add(id);
    }
    return out;
  }

  private async init() {
    const Plotly = (await import("plotly.js-gl3d-dist-min")) as unknown as Plotly3D;
    this.Plotly = Plotly;
    const { relief } = this.data;
    const muted = css("--muted", "#8a8680");

    const surface = {
      type: "surface",
      x: relief.lons,
      y: relief.lats,
      z: relief.elevation_m,
      showscale: false,
      colorscale: [
        [0, css("--band", "#e8dcc4")],
        [0.22, "#d9c49a"],
        [0.45, "#b89968"],
        [0.7, "#8a6f45"],
        [1, "#6b5234"],
      ],
      lighting: { ambient: 0.55, diffuse: 0.75, specular: 0.15, roughness: 0.85, fresnel: 0.05 },
      lightposition: { x: -200, y: -200, z: 300 },
      contours: {
        z: { show: true, usecolormap: true, highlightcolor: "#3d2f1f", width: 1, project: { z: false } },
      },
      hoverinfo: "skip",
    };

    // every river edge as one trace, segments separated by a null row -- a single Scatter3d
    // draws far faster than one trace per edge, and nulls break the line between edges exactly
    // the way they do in a flat SVG path's own M/M break
    const rx: (number | null)[] = [];
    const ry: (number | null)[] = [];
    const rz: (number | null)[] = [];
    for (const f of this.data.rivers.features) {
      for (const [lon, lat] of f.geometry.coordinates) {
        rx.push(lon);
        ry.push(lat);
        rz.push(elevationAt(relief, lon, lat) + DRAPE_OFFSET_M);
      }
      rx.push(null);
      ry.push(null);
      rz.push(null);
    }
    const rivers = {
      type: "scatter3d",
      mode: "lines",
      x: rx,
      y: ry,
      z: rz,
      line: { color: "#2f6fa8", width: 5 },
      hoverinfo: "skip",
    };

    // every station's own ground height, kept so render() only has to add the day's own
    // ratio-scaled rise, not re-run the (bilinear) lookup on every slider move or Play tick
    this.groundZ = this.data.stations.map((s) => elevationAt(relief, s.river_lon, s.river_lat));

    const stations = {
      type: "scatter3d",
      mode: "markers",
      x: this.data.stations.map((s) => s.river_lon),
      y: this.data.stations.map((s) => s.river_lat),
      z: this.groundZ.map((z) => z + DRAPE_OFFSET_M),
      marker: {
        size: 5,
        color: this.data.stations.map(() => muted),
        line: { color: this.data.stations.map(() => css("--panel", "#fff")), width: 1.5 },
      },
      text: this.data.stations.map((s) => `Station ${s.id} · ${s.river}`),
      hoverinfo: "text",
    };

    // the column itself: a two-point line per station (ground -> marker height), the one place
    // Miljana's own "column height and colour" rule actually needs a column, not just a dot
    const sx: (number | null)[] = [];
    const sy: (number | null)[] = [];
    const sz: (number | null)[] = [];
    const scolor: string[] = [];
    for (let i = 0; i < this.data.stations.length; i++) {
      const s = this.data.stations[i];
      sx.push(s.river_lon, s.river_lon, null);
      sy.push(s.river_lat, s.river_lat, null);
      sz.push(this.groundZ[i] + DRAPE_OFFSET_M, this.groundZ[i] + DRAPE_OFFSET_M, null);
      scolor.push(muted, muted, muted);
    }
    const stems = {
      type: "scatter3d",
      mode: "lines",
      x: sx,
      y: sy,
      z: sz,
      line: { color: scolor, width: 7 },
      hoverinfo: "skip",
    };

    const layout: Record<string, unknown> = {
      autosize: true,
      margin: { l: 0, r: 0, t: 0, b: 0 },
      paper_bgcolor: "rgba(0,0,0,0)",
      showlegend: false,
      scene: {
        bgcolor: "rgba(0,0,0,0)",
        aspectmode: "manual",
        aspectratio: { x: 1, y: 0.82, z: 0.22 },
        camera: { eye: { x: -0.55, y: -0.78, z: 0.75 }, up: { x: 0, y: 0, z: 1 } },
        xaxis: { visible: false },
        yaxis: { visible: false },
        zaxis: { visible: false },
        dragmode: "orbit",
      },
    };

    await Plotly.newPlot(
      this.host,
      [surface, rivers, stations, stems] as unknown as Plotly.Data[],
      layout as Partial<Plotly.Layout>,
      { displayModeBar: false, scrollZoom: false, responsive: true }
    );
  }

  async render(event: string, day: number) {
    await this.ready;
    if (!this.Plotly || !event || !this.data.floods[event]) return;
    const ratios = this.data.floods[event].ratio;
    const flooding = this.flooding(event, day);
    const warned = new Set<number>();
    for (const id of flooding) for (const d of this.reach.get(id) ?? []) if (!flooding.has(d)) warned.add(d);

    const ink = css("--stone", "#4a4843");
    const warn = css("--warn", "#d97706");
    const panel = css("--panel", "#fff");
    const muted = css("--muted", "#8a8680");

    const color = this.stationIds.map((id) => {
      const v = ratios[String(id)][day];
      return v === null ? muted : ratioColor(v);
    });
    const borderColor = this.stationIds.map((id) =>
      flooding.has(id) ? ink : warned.has(id) ? warn : panel
    );
    const size = this.stationIds.map((id) => 4 + ratioT(ratios[String(id)][day]) * 7);
    const topZ = this.stationIds.map((id, i) => this.groundZ[i] + DRAPE_OFFSET_M + ratioT(ratios[String(id)][day]) * STEM_MAX_M);
    const text = this.data.stations.map((s, i) => {
      const v = ratios[String(s.id)][day];
      const pct = v === null ? "no record this day" : `${v.toFixed(2)}× its usual yearly flood peak`;
      const status = flooding.has(s.id) ? " · above its own peak" : warned.has(s.id) ? " · warned" : "";
      return `Station ${s.id} · ${s.river}\n${pct}${status}`;
    });

    // restyle's own convention (one array entry per trace index, even for a single trace) isn't
    // fully modeled by @types/plotly.js's shared Data type -- e.g. a per-point `text` array,
    // wrapped once more for the trace-index list, no longer matches its own string|string[]
    await this.Plotly.restyle(
      this.host,
      {
        "marker.color": [color],
        "marker.size": [size],
        "marker.line.color": [borderColor],
        z: [topZ],
        text: [text],
      } as unknown as Plotly.Data,
      [2]
    );

    // the stems: ground -> topZ, same colour as the marker it carries, null slot in between
    // left untouched (any value is fine, it never renders)
    const sz = this.data.stations.flatMap((_, i) => [this.groundZ[i] + DRAPE_OFFSET_M, topZ[i], null]);
    const scolor = color.flatMap((c) => [c, c, c]);
    await this.Plotly.restyle(this.host, { z: [sz], "line.color": [scolor] }, [3]);
  }

  resize() {
    if (this.Plotly) this.Plotly.Plots.resize(this.host);
  }

  destroy() {
    if (this.Plotly) this.Plotly.purge(this.host);
  }
}
