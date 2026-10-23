/**
 * All the visual rules in one place, in two systems the app can switch between (see
 * CONTEXT.md's decision log):
 *
 * - BASELINE: the faithful matplotlib replica. Fixed by what the library actually draws,
 *   not a design choice.
 * - REDESIGN: the actual deliverable -- a validated, buildable-in-matplotlib design system,
 *   applied to the charts themselves and to the app shell around them, so both share one
 *   visual language. Built from the `dataviz` skill's method: form -> color by job ->
 *   validate -> marks -> interaction -> accessibility. The diverging pair below passed the
 *   skill's validator (CVD Delta E 21-35 both modes, well past the >=8 floor) -- see
 *   STYLE_GUIDE.md in the matplotlib deliverable for the full report and rationale.
 */
import * as d3 from "d3";

// matplotlib renders Figma was traced from used figsize (inches) at 100 dpi; this build
// keeps that scale so every measurement below (taken directly off the pinned notebook's
// rcParams defaults) lines up with the Figma reference pixel-for-pixel.
export const DPI = 100;
export const ptToPx = (pt: number): number => (pt * DPI) / 72;

export const BASELINE = {
  figureBg: "#ffffff",
  axesBg: "#ffffff",
  spineColor: "#000000",
  spineWidthPx: ptToPx(0.8),
  gridColor: "#b0b0b0",
  gridAlpha: 0.3,
  tickColor: "#000000",
  tickWidthPx: ptToPx(0.8),
  tickLengthPx: ptToPx(3.5),
  textColor: "#000000",
  fontFamily: "'Inter', 'DejaVu Sans', Helvetica, Arial, sans-serif",
  titlePx: ptToPx(12),
  labelPx: ptToPx(10),
  tickLabelPx: ptToPx(10),
  networkLabelPx: ptToPx(9),
  dataLineColor: "#000000",
  dataLineWidthPx: ptToPx(1),
  meanLineColor: "#808080",
  meanLineWidthPx: ptToPx(0.8),
  // plot_connectedness_graph (src/pyconnectedness/viz/network.py)
  sendColor: "#d62728", // tab:red
  recvColor: "#1f77b4", // tab:blue
  nodeAlpha: 0.85,
  edgeColor: "#737373", // matplotlib grayscale string "0.45" -> rgb(0.45,0.45,0.45)
  edgeArrowSizePx: 12,
  edgeCurveRad: 0.08, // connectionstyle="arc3,rad=0.08"
  // spillover_heatmap (src/pyconnectedness/viz/heatmap.py): cmap="RdBu_r", annotate=False
  rdbuScale(maxAbs: number) {
    const m = maxAbs > 0 ? maxAbs : 1e-9;
    return d3.scaleSequential(d3.interpolateRdBu).domain([m, -m]);
  },
} as const;

export const FONTS = {
  // Source Serif 4 read as an academic-paper byline next to the reference apps (Pillow, Fitbit,
  // Brink, Commons) that set this pass's direction -- none of them touch a serif anywhere. Bold
  // IBM Plex Sans carries the same "titles, never numbers" job without that editorial tell.
  display: "'IBM Plex Sans', system-ui, sans-serif",
  body: "'IBM Plex Sans', system-ui, sans-serif",
  data: "'B612 Mono', 'SFMono-Regular', monospace", // numbers, ticks, tabular figures -- client's own pick
} as const;

export interface RedesignTokens {
  page: string;
  surface: string;
  surfaceRaised: string;
  primary: string;
  secondary: string;
  muted: string;
  gridline: string;
  axis: string;
  border: string;
  send: string;
  recv: string;
  mid: string;
  crisis: string;
  band: string;
  cardShadow: string;
  cardHighlight: string;
}

// Validated chart chrome + diverging pair. Light/dark are both "selected" steps, not an
// automatic flip -- see the skill's palette.md.
// send/recv/mid/crisis/primary/secondary/muted/gridline/axis/surface are the validated values
// documented verbatim in styleguide/STYLE_GUIDE.md's palette table -- don't drift them here
// without re-running the table + the matplotlib guide together. page/surfaceRaised/cardShadow/
// cardHighlight are web-shell-only (the elevated-card chrome CONTEXT.md's decision log scopes
// to "the app shell around the charts", same as border already was).
export const REDESIGN_LIGHT: RedesignTokens = {
  page: "#f9f9f7",
  surface: "#fcfcfb",
  surfaceRaised: "#ffffff", // nested rows (ranking, legend chips) read one step "closer"
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  gridline: "#e1e0d9",
  axis: "#c3c2b7",
  border: "rgba(11,11,11,0.08)",
  send: "#e34948", // net transmitter -- diverging red
  recv: "#2a78d6", // net receiver -- diverging blue
  mid: "#f0efec", // diverging midpoint (near zero)
  crisis: "#d03b3b", // status "critical" -- distinct from `send`, reserved for crisis emphasis
  band: "#eceae4", // neutral period shading
  cardShadow: "0 1px 2px rgba(11,11,11,0.04), 0 10px 28px rgba(11,11,11,0.07)",
  cardHighlight: "rgba(255,255,255,0.6)",
} as const;

export const REDESIGN_DARK: RedesignTokens = {
  page: "#0d0d0d",
  surface: "#1a1a19",
  surfaceRaised: "#242320", // Pillow-style elevated card: nested elements read lighter still
  primary: "#f0efec",
  secondary: "#c3c2b7",
  muted: "#898781",
  gridline: "#2c2c2a",
  axis: "#383835",
  border: "rgba(255,255,255,0.08)",
  send: "#e66767",
  recv: "#3987e5",
  mid: "#383835",
  crisis: "#d03b3b",
  band: "#201f1c",
  cardShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 16px 40px rgba(0,0,0,0.55)",
  cardHighlight: "rgba(255,255,255,0.07)",
} as const;

export const REDESIGN = {
  nodeAlpha: 0.9,
  lineWidthPx: 2,
  markerRadiusPx: 5, // >= 4, per the skill's >=8px marker spec
  markerRingPx: 2, // surface-color ring so markers stay legible crossing a line
  areaFillAlpha: 0.1,
  edgeAlpha: 0.55,
  edgeArrowSizePx: 9,
  edgeCurveRad: 0.1,
  titlePx: 19,
  subtitlePx: 12.5,
  labelPx: 12,
  tickLabelPx: 11,
  networkLabelPx: 11.5,
  heroPx: 46,
  /** Diverging scale from the validated pair, two hues + neutral midpoint (not d3's RdBu,
   * which uses different, unvalidated hex values than the rest of this system). */
  divergingScale(maxAbs: number, t: RedesignTokens) {
    const m = maxAbs > 0 ? maxAbs : 1e-9;
    return d3
      .scaleLinear<string>()
      .domain([-m, 0, m])
      .range([t.recv, t.mid, t.send])
      .interpolate(d3.interpolateRgb);
  },
} as const;

// kept for app-shell call sites written against the old names; now backed by REDESIGN_LIGHT
export const SHELL_LIGHT = {
  bg: REDESIGN_LIGHT.page,
  panel: REDESIGN_LIGHT.surface,
  fg: REDESIGN_LIGHT.primary,
  muted: REDESIGN_LIGHT.muted,
  line: REDESIGN_LIGHT.border,
  grid: REDESIGN_LIGHT.gridline,
  send: REDESIGN_LIGHT.send,
  recv: REDESIGN_LIGHT.recv,
  mid: REDESIGN_LIGHT.mid,
  band: REDESIGN_LIGHT.band,
  edge: REDESIGN_LIGHT.secondary,
} as const;

export const SHELL_DARK = {
  bg: REDESIGN_DARK.page,
  panel: REDESIGN_DARK.surface,
  fg: REDESIGN_DARK.primary,
  muted: REDESIGN_DARK.muted,
  line: REDESIGN_DARK.border,
  grid: REDESIGN_DARK.gridline,
  send: REDESIGN_DARK.send,
  recv: REDESIGN_DARK.recv,
  mid: REDESIGN_DARK.mid,
  band: REDESIGN_DARK.band,
  edge: REDESIGN_DARK.secondary,
} as const;

export const REGION_ORDER = ["Americas", "Europe", "Asia Pacific"] as const;
export type Region = (typeof REGION_ORDER)[number];

export const REGION_OF: Record<string, Region> = {
  US: "Americas", Canada: "Americas", Mexico: "Americas", Brazil: "Americas", Argentina: "Americas",
  UK: "Europe", Germany: "Europe", France: "Europe", Switzerland: "Europe", Spain: "Europe", Turkey: "Europe",
  Japan: "Asia Pacific", "South Korea": "Asia Pacific", China: "Asia Pacific", "Hong Kong": "Asia Pacific",
  Taiwan: "Asia Pacific", Singapore: "Asia Pacific", Malaysia: "Asia Pacific", Indonesia: "Asia Pacific",
  Australia: "Asia Pacific",
};

export const EPISODE_LABELS: Record<string, string> = {
  "2001-09-30": "dot-com",
  "2008-10-31": "Lehman",
  "2011-09-30": "euro-area crisis",
  "2015-08-31": "China devaluation",
  "2020-03-31": "COVID crash",
  "2022-09-30": "inflation shock",
};
