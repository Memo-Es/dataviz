/**
 * Graph 4's other mode: a real flood, not the model's shock. Daily discharge at the 31 gauges
 * during 4 historical floods (1999, 2002, 2005, 2013), each divided by that gauge's own yearly
 * flood peak so 1.0 means "a normal yearly flood there" whatever the river's actual size --
 * from Miljana's own Demo Day package (`danube_flood_events.csv`, the Bavarian Environment
 * Agency's daily series, CC BY 4.0, via graphicalExtremes; see pipeline/datasets/danube/
 * README.md). This is what actually happened, not an estimate: no MaxLinear call reads this
 * data at all.
 *
 * The one place the model is used here is "warned": a gauge not yet at its own 1x is marked
 * warned the moment any gauge upstream of it (by the model's own estimated tree, the same
 * `reachability` the shock-propagation mode plays through) first reaches 1x. That is the
 * model's estimated tree, read on real historical data, not a re-fit -- the two modes share one
 * `danube.json` for exactly this reason.
 */
import * as d3 from "d3";
import { reliefDataUrl, type DanubeData, type DanubeStation } from "./danube-map";

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** 0 -> deep blue, 1x -> the panel's own neutral, 2x+ -> deep red; the same RdBu_r convention
 * (and the same 0..2x range) the library's own spillover heatmap and Miljana's colourbar use. */
export function ratioColor(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio / 2));
  return d3.interpolateRdBu(1 - t);
}

export class DanubeFloodMap {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width = 640;
  private height = 640;
  private byId: Map<number, DanubeStation>;
  private reach: Map<number, Set<number>>; // station -> every station downstream of it
  private projection: d3.GeoProjection;
  private path: d3.GeoPath;
  private playing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private lastEvent = "";
  private lastDay = 0;
  private tilted = false;
  private reliefUrl: string | null = null; // computed once, lazily, on the first tilt
  private barsLayer: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  private barEls = new Map<number, HTMLDivElement>();

  constructor(
    private host: HTMLElement,
    private data: DanubeData,
    private onStep: (event: string, day: number) => void
  ) {
    this.byId = new Map(data.stations.map((s) => [s.id, s]));
    this.reach = new Map(
      Object.entries(data.reachability).map(([k, v]) => [Number(k), new Set(v)])
    );
    this.svg = d3.select(host).append("svg").attr("class", "danube-map danube-flood-svg");
    // a flat, screen-aligned sibling of the svg, same reasoning as DanubeMap's own bars layer:
    // a bar's CSS height transition shouldn't itself be warped by the tilt
    this.barsLayer = d3.select(host).append("div").attr("class", "danube-bars");
    this.projection = d3.geoMercator();
    this.path = d3.geoPath(this.projection);
    new ResizeObserver(() => {
      const w = Math.round(host.clientWidth);
      if (w && w !== this.width) {
        this.width = w;
        this.height = Math.round(w * 0.86);
        this.layout();
        this.render(this.lastEvent, this.lastDay);
        this.fitTiltedHeight();
      }
    }).observe(host);
    this.layout();
  }

  private layout() {
    const fc = {
      type: "FeatureCollection",
      features: this.data.stations.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.river_lon, s.river_lat] } })),
    } as GeoJSON.FeatureCollection;
    this.projection.fitExtent([[36, 20], [this.width - 20, this.height - 20]], fc);
    this.svg.attr("width", this.width).attr("height", this.height).attr("viewBox", `0 0 ${this.width} ${this.height}`);
  }

  /** every station whose own ratio is >= 1 on this day */
  private flooding(event: string, day: number): Set<number> {
    const ratios = this.data.floods[event].ratio;
    const out = new Set<number>();
    for (const s of this.data.stations) {
      const v = ratios[String(s.id)][day];
      if (v !== null && v >= 1) out.add(s.id);
    }
    return out;
  }

  render(event: string, day: number) {
    if (!event || !this.data.floods[event]) return;
    this.lastEvent = event;
    this.lastDay = day;
    const line = css("--line", "rgba(17,17,17,.14)");
    const panel = css("--panel", "#fff");
    const ink = css("--stone", "#4a4843");
    const warn = css("--warn", "#d97706");
    const muted = css("--muted", "#8a8680");

    const flooding = this.flooding(event, day);
    const warned = new Set<number>();
    for (const s of flooding) for (const d of this.reach.get(s) ?? []) if (!flooding.has(d)) warned.add(d);

    this.svg.selectAll("*").remove();
    const g = this.svg.append("g");

    g.append("g")
      .attr("class", "danube-rivers")
      .selectAll("path")
      .data(this.data.rivers.features)
      .join("path")
      .attr("d", (d) => this.path(d as unknown as d3.GeoPermissibleObjects))
      .attr("fill", "none")
      .attr("stroke", line)
      .attr("stroke-width", 1.6)
      .attr("stroke-linecap", "round");

    const ratios = this.data.floods[event].ratio;
    const stationSel = g
      .append("g")
      .attr("class", "danube-stations danube-flood-stations")
      .selectAll("g")
      .data(this.data.stations)
      .join("g")
      .attr("data-station", (d) => d.id)
      .attr("transform", (d) => {
        const p = this.projection([d.river_lon, d.river_lat]);
        return p ? `translate(${p[0]},${p[1]})` : "";
      });

    stationSel
      .append("circle")
      .attr("r", (d) => (flooding.has(d.id) ? 9 : warned.has(d.id) ? 7.5 : 6))
      .attr("fill", (d) => {
        const v = ratios[String(d.id)][day];
        return v === null ? muted : ratioColor(v);
      })
      .attr("fill-opacity", (d) => (ratios[String(d.id)][day] === null ? 0.25 : 1))
      .attr("stroke", (d) => (flooding.has(d.id) ? ink : warned.has(d.id) ? warn : panel))
      .attr("stroke-width", (d) => (flooding.has(d.id) ? 2.5 : warned.has(d.id) ? 2.5 : 1.5));

    stationSel
      .append("title")
      .text((d) => {
        const v = ratios[String(d.id)][day];
        const pct = v === null ? "no record this day" : `${v.toFixed(2)}× its usual yearly flood peak`;
        return `Station ${d.id} · ${d.river}\n${pct}`;
      });

    this.syncBars(event, day);
    this.onStep(event, day);
  }

  /** the quick 3D sketch, aligned with Miljana's own deck slide for this exact scenario: a
   * tilted terrain (the same real elevation grid DanubeMap paints) with one column per gauge,
   * risen and coloured by that day's real ratio -- continuous, not binary, since this is real
   * magnitude data (not the qtree search score the flat shock-propagation bars deliberately
   * don't size by) */
  setTilt(on: boolean) {
    this.tilted = on;
    this.host.classList.toggle("danube-tilted", on);
    if (on && !this.reliefUrl) {
      this.reliefUrl = reliefDataUrl(this.data.relief);
      this.host.style.setProperty("--danube-relief-image", `url(${this.reliefUrl})`);
    }
    this.syncBars(this.lastEvent, this.lastDay);
    this.fitTiltedHeight();
  }

  /** same measured-footprint correction as DanubeMap's own -- see its fitTiltedHeight for why
   * the layout box has to be pulled in to the real tilted render, not left at its flat height */
  private fitTiltedHeight() {
    const svgEl = this.svg.node() as SVGSVGElement;
    svgEl.style.marginBottom = "";
    if (!this.tilted) return;
    const hostBox = this.host.getBoundingClientRect();
    const svgBox = svgEl.getBoundingClientRect();
    const slack = hostBox.bottom - svgBox.bottom - 16;
    if (slack > 0) svgEl.style.marginBottom = `${-slack}px`;
  }

  private barHeight(ratio: number | null): number {
    if (ratio === null) return 0;
    return Math.max(0, Math.min(1, ratio / 2.5)) * 90;
  }

  private syncBars(event: string, day: number) {
    if (!this.tilted || !event || !this.data.floods[event]) {
      this.barsLayer.selectAll("*").remove();
      this.barEls.clear();
      return;
    }
    const ratios = this.data.floods[event].ratio;
    const hostBox = this.host.getBoundingClientRect();
    // one bar per station, every render while tilted -- unlike the shock-propagation chain
    // (a fixed, small set for a pick), every gauge has a ratio every day, so the set never
    // changes; same reused-element trick so the CSS height transition plays, not pops
    for (const s of this.data.stations) {
      let el = this.barEls.get(s.id);
      if (!el) {
        el = this.barsLayer.append("div").attr("class", "danube-bar").node()!;
        this.barEls.set(s.id, el);
      }
      const circle = this.svg.select<SVGCircleElement>(`[data-station="${s.id}"] circle`).node();
      if (circle) {
        const r = circle.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        el.style.left = `${cx - hostBox.left}px`;
        el.style.bottom = `${hostBox.height - (cy - hostBox.top)}px`;
      }
      const v = ratios[String(s.id)][day];
      el.style.height = `${this.barHeight(v)}px`;
      el.style.background = v === null ? css("--muted", "#8a8680") : ratioColor(v);
    }
  }

  play(event: string, lastDay: number, onDone?: () => void) {
    this.stop();
    if (this.reducedMotion) {
      this.render(event, lastDay);
      onDone?.();
      return;
    }
    this.playing = true;
    let day = this.lastEvent === event ? this.lastDay : 0;
    if (day >= lastDay) day = 0;
    const step = () => {
      day += 1;
      this.render(event, day);
      if (day >= lastDay) this.stop();
    };
    this.timer = setInterval(step, 550);
  }

  stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  isPlaying() {
    return this.playing;
  }

  svgNode() {
    return this.svg.node()!;
  }
}
