/**
 * Visual rules shared by every chart. Colours are read from CSS custom properties (style.css),
 * so light/dark mode lives in one place and the charts never hard-code a hex value.
 */
import * as d3 from "d3";

export interface Palette {
  fg: string;
  secondary: string;
  muted: string;
  grid: string;
  axis: string;
  panel: string;
  send: string;
  recv: string;
  mid: string;
  crisis: string;
  band: string;
  accent: string;
}

export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    fg: v("--fg"),
    secondary: v("--secondary"),
    muted: v("--muted"),
    grid: v("--grid"),
    axis: v("--axis"),
    panel: v("--panel"),
    send: v("--send"),
    recv: v("--recv"),
    mid: v("--mid"),
    crisis: v("--crisis"),
    band: v("--band"),
    accent: v("--accent"),
  };
}

/** Diverging scale for net values: receiver blue, neutral midpoint, sender red. The domain is
 * fixed by the caller (global max across every week) so colours don't rescale frame to frame. */
export function diverging(maxAbs: number, p: Palette) {
  const m = maxAbs > 0 ? maxAbs : 1e-9;
  return d3
    .scaleLinear<string>()
    .domain([-m, 0, m])
    .range([p.recv, p.mid, p.send])
    .interpolate(d3.interpolateLab)
    .clamp(true);
}

export const REGION_ORDER = ["Americas", "Europe", "Asia Pacific"] as const;
export type Region = (typeof REGION_ORDER)[number];

export const REGION_OF: Record<string, Region> = {
  US: "Americas", Canada: "Americas", Mexico: "Americas", Brazil: "Americas", Argentina: "Americas",
  UK: "Europe", Germany: "Europe", France: "Europe", Switzerland: "Europe", Spain: "Europe", Turkey: "Europe",
  Japan: "Asia Pacific", "South Korea": "Asia Pacific", China: "Asia Pacific", "Hong Kong": "Asia Pacific",
  Taiwan: "Asia Pacific", Singapore: "Asia Pacific", Malaysia: "Asia Pacific", Indonesia: "Asia Pacific",
  Australia: "Asia Pacific",
};

/** Market names grouped by region, notebook order kept inside each region. */
export function regionOrder(names: string[]): string[] {
  return REGION_ORDER.flatMap((r) => names.filter((n) => REGION_OF[n] === r));
}

/** The notebook's own comments on cell 15's episode dates. */
export const EPISODE_LABELS: Record<string, string> = {
  "2001-09-30": "Dot-com",
  "2008-10-31": "Lehman",
  "2011-09-30": "Euro-area crisis",
  "2015-08-31": "China devaluation",
  "2020-03-31": "COVID crash",
  "2022-09-30": "Inflation shock",
};

export const fmtPct = (v: number, digits = 1) => `${v.toFixed(digits)}%`;
export const fmtSigned = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}`;
export const fmtDate = d3.utcFormat("%-d %b %Y");
export const parseDate = d3.utcParse("%Y-%m-%d");

/** np.percentile(a, q) with numpy's default linear interpolation -- the notebook's strongest-link
 * rule (cells 19 and 21), applied to whichever matrix is on screen. */
export function percentile(values: ArrayLike<number>, q: number): number {
  const a = Array.from(values).sort((x, y) => x - y);
  if (!a.length) return 0;
  const pos = (a.length - 1) * (q / 100);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}
