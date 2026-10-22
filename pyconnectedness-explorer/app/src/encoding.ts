/**
 * All the visual rules in one place, split in two (see CONTEXT.md's decision log):
 *
 * - BASELINE: the charts themselves. Matches the library's matplotlib defaults, not SPEC.md
 *   section 6's redesign colours -- don't restyle these with SHELL.
 * - SHELL: the app chrome around the charts (sidebar, panels, footnote, dark mode). This is
 *   section 6's token system, used only where the questionnaire isn't talking about the charts.
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

export const SHELL_LIGHT = {
  bg: "#f4f5f3",
  panel: "#ffffff",
  fg: "#1b2226",
  muted: "#5f6b70",
  line: "#d9dedd",
  grid: "#e8ecea",
  send: "#c2462e",
  recv: "#25668f",
  mid: "#eef0ee",
  band: "#e3e7e4",
  edge: "#3d474c",
} as const;

export const SHELL_DARK = {
  bg: "#111517",
  panel: "#181d20",
  fg: "#e6eae9",
  muted: "#97a3a6",
  line: "#2c3438",
  grid: "#232a2d",
  send: "#e26a4f",
  recv: "#5aa2cf",
  mid: "#262d30",
  band: "#20272a",
  edge: "#b9c3c6",
} as const;

export const FONTS = {
  display: "'Source Serif 4', Georgia, serif",
  body: "'IBM Plex Sans', system-ui, sans-serif",
  data: "'IBM Plex Mono', 'SFMono-Regular', monospace",
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
