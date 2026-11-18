/**
 * The real 3D terrain for Historical floods -- what Miljana's own deck shows for this exact
 * scenario: a genuine elevation mesh (the same ETOPO1 grid danube-map.ts paints as a flat CSS
 * backdrop), rivers draped on it, one marker per gauge coloured and sized by that day's real
 * ratio. Built with Plotly's GL3D bundle, the library her own deck uses, loaded lazily (it's a
 * real WebGL dependency, ~500KB gzipped) only once this view is actually switched on -- see
 * main.ts's ensureFlood3D.
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

// rivers and stations sit this many metres above the raw terrain height, so they read as
// clearly on top of the mesh rather than skimming/clipping through it at this grid's resolution
const DRAPE_OFFSET_M = 30;

export class DanubeFlood3D {
  private Plotly: Plotly3D | null = null;
  private ready: Promise<void>;
  private stationIds: number[];

  constructor(
    private host: HTMLElement,
    private data: DanubeData
  ) {
    this.stationIds = data.stations.map((s) => s.id);
    this.ready = this.init();
  }

  private async init() {
    const Plotly = (await import("plotly.js-gl3d-dist-min")) as unknown as Plotly3D;
    this.Plotly = Plotly;
    const { relief } = this.data;

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

    const stations = {
      type: "scatter3d",
      mode: "markers",
      x: this.data.stations.map((s) => s.river_lon),
      y: this.data.stations.map((s) => s.river_lat),
      z: this.data.stations.map((s) => elevationAt(relief, s.river_lon, s.river_lat) + DRAPE_OFFSET_M),
      marker: {
        size: 5,
        color: this.data.stations.map(() => css("--muted", "#8a8680")),
        line: { color: css("--panel", "#fff"), width: 1 },
      },
      text: this.data.stations.map((s) => `Station ${s.id} · ${s.river}`),
      hoverinfo: "text",
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
      [surface, rivers, stations] as unknown as Plotly.Data[],
      layout as Partial<Plotly.Layout>,
      { displayModeBar: false, scrollZoom: false, responsive: true }
    );
  }

  async render(event: string, day: number) {
    await this.ready;
    if (!this.Plotly || !event || !this.data.floods[event]) return;
    const ratios = this.data.floods[event].ratio;
    const color = this.stationIds.map((id) => {
      const v = ratios[String(id)][day];
      return v === null ? css("--muted", "#8a8680") : ratioColor(v);
    });
    const size = this.stationIds.map((id) => {
      const v = ratios[String(id)][day];
      if (v === null) return 5;
      return 5 + Math.max(0, Math.min(1, v / 2.5)) * 10;
    });
    await this.Plotly.restyle(this.host, { "marker.color": [color], "marker.size": [size] }, [2]);
  }

  resize() {
    if (this.Plotly) this.Plotly.Plots.resize(this.host);
  }

  destroy() {
    if (this.Plotly) this.Plotly.purge(this.host);
  }
}
