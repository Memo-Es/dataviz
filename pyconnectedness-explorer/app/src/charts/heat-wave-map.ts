/**
 * Heat waves' other mode: a real heat wave, not the model's causal order. Daily maximum
 * temperature anomaly (°C against a 31-day-smoothed day-of-year climatology) at all 137 NOAA
 * stations through May 1991 -- from Miljana's own Demo Day package (`us_tmax_1990_1993.csv`,
 * via pipeline/run_heat.py). This is what actually happened, not model output: no MaxLinear call
 * reads this data at all, the same split Danube's flood replay draws against its own shock
 * propagation.
 */
import * as d3 from "d3";

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const RANGE_C = 12; // clip to +-12 C, the same range the notebook's own colour bar uses

/** -12C -> deep blue, 0 -> the panel's own neutral, +12C -> deep red -- the same RdBu
 * convention (and the same diverging-at-zero idea) danube-flood-map's own ratioColor uses. */
export function heatAnomalyColor(c: number): string {
  const t = (Math.max(-RANGE_C, Math.min(RANGE_C, c)) + RANGE_C) / (2 * RANGE_C);
  return d3.interpolateRdBu(1 - t);
}

export interface HeatWaveStation {
  id: string;
  lat: number;
  lon: number;
}

export class HeatWaveMap {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width = 640;
  private height = 400;
  private projection = d3.geoAlbersUsa();
  private playing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private lastDay = 0;

  constructor(
    private host: HTMLElement,
    private stations: HeatWaveStation[],
    private dates: string[],
    private anomaly: Record<string, (number | null)[]>,
    private onStep: (day: number) => void
  ) {
    this.svg = d3.select(host).append("svg").attr("class", "dag-chart heat-wave-svg");
    new ResizeObserver(() => {
      const w = Math.round(host.clientWidth);
      if (w && w !== this.width) {
        this.width = w;
        this.layout();
        this.render(this.lastDay);
      }
    }).observe(host);
    this.layout();
  }

  private layout() {
    const fc = {
      type: "FeatureCollection",
      features: this.stations.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lon, s.lat] } })),
    } as GeoJSON.FeatureCollection;
    this.projection.fitExtent(
      [
        [24, 20],
        [this.width - 24, this.height - 20],
      ],
      fc
    );
    this.svg.attr("width", this.width).attr("height", this.height).attr("viewBox", `0 0 ${this.width} ${this.height}`);
  }

  render(day: number) {
    this.lastDay = day;
    const muted = css("--muted", "#8a8680");
    const panel = css("--panel", "#fff");

    this.svg.selectAll("*").remove();
    const g = this.svg.append("g");

    const stationSel = g
      .append("g")
      .attr("class", "heat-wave-stations")
      .selectAll("g")
      .data(this.stations)
      .join("g")
      .attr("transform", (d) => {
        const p = this.projection([d.lon, d.lat]);
        return p ? `translate(${p[0]},${p[1]})` : "";
      });

    stationSel
      .append("circle")
      .attr("r", 5)
      .attr("fill", (d) => {
        const v = this.anomaly[d.id]?.[day];
        return v === null || v === undefined ? muted : heatAnomalyColor(v);
      })
      .attr("fill-opacity", (d) => (this.anomaly[d.id]?.[day] == null ? 0.25 : 1))
      .attr("stroke", panel)
      .attr("stroke-width", 0.8);

    stationSel.append("title").text((d) => {
      const v = this.anomaly[d.id]?.[day];
      return `Station ${d.id}\n${v == null ? "no record this day" : `${v > 0 ? "+" : ""}${v.toFixed(1)} °C vs normal`}`;
    });

    this.onStep(day);
  }

  play(onDone?: () => void) {
    this.stop();
    const lastDay = this.dates.length - 1;
    if (this.reducedMotion) {
      this.render(lastDay);
      onDone?.();
      return;
    }
    this.playing = true;
    let day = this.lastDay >= lastDay ? 0 : this.lastDay;
    const step = () => {
      day += 1;
      this.render(day);
      if (day >= lastDay) this.stop();
    };
    this.timer = setInterval(step, 550);
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
