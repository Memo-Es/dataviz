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

// Groups (regions, sectors, river basins...) and event dates belong to the picked dataset. They're
// filled once at start-up by setDatasetEncoding(); switching dataset reloads the page.
export type Region = string;
export const REGION_ORDER: string[] = [];
export const REGION_OF: Record<string, Region> = {};
export const EPISODE_LABELS: Record<string, string> = {};

/** The dataset's time step and its words: "week"/"weeks", "day"/"days", "month"/"months". */
export const STEP = { step: "week" as "day" | "week" | "month", steps: "weeks" };

export function setDatasetEncoding(
  groups: Record<string, string>,
  order: string[],
  episodes: Record<string, string>,
  step: "day" | "week" | "month",
  steps: string
) {
  Object.assign(REGION_OF, groups);
  REGION_ORDER.splice(0, REGION_ORDER.length, ...order);
  Object.assign(EPISODE_LABELS, episodes);
  STEP.step = step;
  STEP.steps = steps;
}

/** One time step, as a reader would name it: "week of 4 Sep 2026", "4 Sep 2026", "Sep 2026". */
export function fmtStep(iso: string, capital = true): string {
  const d = parseDate(iso)!;
  const s =
    STEP.step === "month" ? d3.utcFormat("%b %Y")(d) : STEP.step === "day" ? fmtDate(d) : `week of ${fmtDate(d)}`;
  return capital ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Item names grouped (by region, sector, basin...), the data's own order kept inside each group. */
export function regionOrder(names: string[]): string[] {
  const known = REGION_ORDER.flatMap((r) => names.filter((n) => REGION_OF[n] === r));
  return known.concat(names.filter((n) => !known.includes(n)));
}

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

/** B612 Mono gives "." a full monospace cell, so 71.7 reads as "71. 7". Wrap each decimal point
 * in a tightened span (HTML) or tspan (SVG). Idempotent: already-wrapped points are skipped. */
export function tightenDecimals(root: ParentNode, selector: string) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  root.querySelectorAll(selector).forEach((el) => {
    const svg = el instanceof SVGElement;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = (n as Text).parentElement;
      if (parent?.classList.contains("dp")) continue;
      if (/\d\.\d/.test((n as Text).data)) nodes.push(n as Text);
    }
    for (const node of nodes) {
      const parts = node.data.split(/(?<=\d)\.(?=\d)/);
      const frag = document.createDocumentFragment();
      parts.forEach((part, i) => {
        if (i > 0) {
          const dp = svg ? document.createElementNS(SVG_NS, "tspan") : document.createElement("span");
          dp.setAttribute("class", "dp");
          if (svg) dp.setAttribute("dx", "-0.05em");
          dp.textContent = ".";
          frag.appendChild(dp);
        }
        frag.appendChild(document.createTextNode(part));
      });
      node.replaceWith(frag);
    }
  });
}
