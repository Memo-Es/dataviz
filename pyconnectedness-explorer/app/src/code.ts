/**
 * The Python behind the graph on show: the PyConnectedness calls the explorer made (the pinned
 * commit, the demo's settings), on the series the explorer ran them on, for the window and the
 * pick on screen. Paste it into a notebook and every number it prints is the one on the page.
 *
 * The series comes from the explorer's own files (series.csv, written by
 * pipeline/export_series.py and checked there against every number the explorer shows), so the
 * code runs without the API keys, downloads and preparation steps that built them. The calls
 * and settings are the demo's (Demo.ipynb, cells 10, 13, 14, 18, 19, 21); the frequency split is
 * the library's frequency_connectedness with its default horizon and periods, as the explorer
 * runs it.
 */
import type { Frame, State } from "./model";

export const LIB_COMMIT = "4cc953f8de24c2af4de2b62cf87bf1e4fc51ba02";
const PIP = `pip install "pyconnectedness @ git+https://github.com/zstoi/PyConnectedness@${LIB_COMMIT}" matplotlib`;

export type CodeView = "index" | "network" | "heatmap" | "frequency";

export interface CodeContext {
  view: CodeView;
  state: State;
  frame: Frame;
  /** dataset title, the word for its items and steps */
  title: string;
  items: string;
  step: string;
  steps: string;
  /** "Price moves", "Flow anomaly"... and what it is in the demo's words */
  measureName: string;
  stocks: boolean;
  volatility: boolean;
  /** where the series lives: the explorer's own file, or the user's upload */
  seriesUrl: string | null;
  upload: { name: string; kind: string } | null;
  names: string[];
  window: number;
  dates: string[];
  total: number[];
  /** each window's library blocks: start and end as stored ("1997" or ISO dates), and label */
  blocks: Record<string, { label: string; start: string; end: string; total: number }>;
  /** the four sub-periods the frequency page lists, and the one the picked step falls in */
  freqKey: string;
  /** item -> region, and the regions in order */
  regionOf: Record<string, string>;
  regions: string[];
  /** graph 2 drawn as Quadrants: the step it shows and the lag of its change */
  quad: { date: string; lag: number } | null;
  /** graph 3 drawn as the library's grid */
  grid: boolean;
}

const MODEL = `MODEL = dict(horizon=10, method="generalized", lags=2)  # the demo's settings: VAR(2), 10 steps`;
const q = (s: string) => JSON.stringify(s);
const n1 = (x: number) => x.toFixed(1);
const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}`;

/** the frame for a window key, as a pandas slice of X */
function slice(c: CodeContext, key: string): { code: string; note: string } {
  const W = c.window;
  if (key === "t") {
    const d = c.dates[c.state.t];
    return { code: `X.loc[:${q(d)}].iloc[-${W}:]`, note: `the ${W} ${c.steps} to ${d}` };
  }
  if (key === "full") return { code: "X", note: "the full sample" };
  if (key === "last200") return { code: `X.iloc[-${W}:]`, note: `the last ${W} ${c.steps}` };
  const b = c.blocks[key];
  return { code: `X.loc[${q(b.start)}:${q(b.end)}]`, note: b.label };
}

function header(c: CodeContext, title: string, fns: string[], viz: string[]): string {
  const lines = [
    `# ${title} · ${c.title} · ${c.measureName} · ${c.frame.label}`,
    "# The PyConnectedness calls behind this graph in the explorer, on the same series: what it",
    "# prints is what the page shows. The library is pinned to the commit the explorer runs:",
    `#   ${PIP}`,
    "import matplotlib.pyplot as plt",
    "import numpy as np",
    "import pandas as pd",
    `from pyconnectedness import ${fns.join(", ")}`,
  ];
  if (viz.length) lines.push(`from pyconnectedness.viz import ${viz.join(", ")}`);
  lines.push("", ...load(c), "", MODEL);
  return lines.join("\n");
}

function load(c: CodeContext): string[] {
  if (c.upload) {
    // pipeline/compute.py, read_upload: what the explorer did to the file before the library saw it
    return [
      "# your file: dates in the first column, one column per series, read as the explorer reads it",
      `df = pd.read_csv(${q(c.upload.name)}, index_col=0, parse_dates=True).apply(pd.to_numeric, errors="coerce")`,
      "df = df.loc[:, df.notna().mean() > 0.5].sort_index()  # columns that are mostly numbers",
      'df = df[~df.index.duplicated(keep="last")]',
      c.upload.kind === "levels"
        ? "X = np.log(df).diff().mul(100).dropna()  # levels, modelled as % changes, as the demo models prices"
        : "X = df.dropna()  # changes, used as they are",
      "X = X.loc[:, X.std() > 0]  # a constant column would make the VAR singular",
    ];
  }
  const what = c.stocks
    ? c.volatility
      ? ["# log volatility, as the authors' demo builds it from Yahoo Finance (Demo.ipynb, cells 6 and 10):",
         "# 100·sqrt(52·0.361·(log high − log low)²) per week, then its log"]
      : ["# weekly returns, as the authors' demo builds them from Yahoo Finance (Demo.ipynb, cell 6):",
         "# 100·Δlog of each Friday's close, on the weeks every market quotes"]
    : [`# ${c.measureName.toLowerCase()}: the series the explorer modelled, from its public source`];
  return [...what, `X = pd.read_csv(${q(c.seriesUrl ?? "series.csv")}, index_col=0, parse_dates=True)  # ${c.names.length} ${c.items}, ${c.total.length + c.window - 1} ${c.steps}`];
}

/** the lines that print what the pick shows on the page, for a static result `res` */
function pickLines(c: CodeContext): string[] {
  const s = c.state;
  const f = c.frame;
  const out: string[] = [];
  if (s.pair) {
    const [a, b] = s.pair;
    const i = c.names.indexOf(a);
    const j = c.names.indexOf(b);
    const v = f.matrix[i][j];
    out.push("", `# the picked pair: positive means ${a} passes more to ${b} than it gets back`, `print(round(res.pairwise_net.loc[${q(a)}, ${q(b)}], 1))  # ${signed(v)} on the page`);
  } else if (s.selected) {
    const i = c.names.indexOf(s.selected);
    out.push(
      "",
      `# the picked ${c.items.replace(/s$/, "")}: what it gives, takes and passes on in net, and to whom`,
      `print(round(res.directional_to[${q(s.selected)}], 1), round(res.directional_from[${q(s.selected)}], 1), round(res.net[${q(s.selected)}], 1))  # ${n1(f.to[i])}, ${n1(f.from[i])}, ${signed(f.net[i])} on the page`,
      `print(res.pairwise_net.loc[${q(s.selected)}].sort_values(ascending=False).round(2))`
    );
  }
  return out;
}

function index(c: CodeContext): string {
  const W = c.window;
  const t = c.state.t;
  const d = c.dates[t];
  const steps = c.steps.replace(/s$/, "");
  const lines = [
    header(c, "Rolling spillover index", ["dynamic_connectedness", "static_connectedness"], []),
    "",
    "conn = static_connectedness(X, **MODEL)  # the full sample: the dashed long-run line",
    `dyn = dynamic_connectedness(X, window=${W}, **MODEL)  # one value per ${W}-${steps} window`,
    "",
    "# the demo's own figure (cell 14)",
    "fig, ax = plt.subplots(figsize=(13, 4))",
    'dyn.total.plot(ax=ax, color="black", lw=1)',
    'ax.axhline(conn.total, color="grey", ls="--", lw=0.8)',
    `ax.set_title("Rolling spillover index (${W}-${steps} window, VAR(2), H=10)")`,
    'ax.set_ylabel("Total spillover, %")',
    "ax.grid(alpha=0.3)",
    "plt.show()",
    "",
    `print(round(conn.total, 1))  # long-run ${n1(c.blocks.full.total)} on the page`,
    `print(round(dyn.total.loc[${q(d)}], 1))  # the picked ${steps}: ${n1(c.total[t])} on the page`,
  ];
  if (c.regions.length > 1) {
    const groups = c.regions.map((r) => `    ${q(r)}: [${c.names.filter((x) => c.regionOf[x] === r).map(q).join(", ")}],`);
    lines.push(
      "",
      "# the beads: each region's average share of moves from shocks elsewhere (directional_from)",
      "regions = {",
      ...groups,
      "}",
      `print({r: round(dyn.directional_from.loc[${q(d)}, m].mean(), 1) for r, m in regions.items()})`
    );
  }
  return lines.join("\n");
}

function network(c: CodeContext): string {
  const sl = slice(c, c.state.window);
  const lines = [
    header(c, "Connectedness network", ["static_connectedness"], ["connectedness_graph", "plot_connectedness_graph"]),
    "",
    `res = static_connectedness(${sl.code}, **MODEL)  # ${sl.note}`,
    "",
    "# the demo's network (cell 19): the strongest 10% of net pairwise flows",
    "threshold = np.percentile(np.abs(res.pairwise_net.to_numpy()), 90)",
    "graph = connectedness_graph(res, threshold=threshold)",
    `print(round(threshold, 2), graph.number_of_edges())  # ${c.frame.threshold.toFixed(2)}, ${c.frame.edgeCount} flows on the page`,
    "fig, ax = plt.subplots(figsize=(11, 10))",
    "plot_connectedness_graph(graph, ax=ax, node_scale=1200, edge_scale=3)",
    `ax.set_title(${q(`Connectedness network, ${sl.note}`)})`,
    "plt.show()",
    "",
    "# the bars beside the ring: each one's net, what it gives minus what it takes",
    "print(res.net.sort_values(ascending=False).round(1))",
    ...pickLines(c),
  ];
  if (c.quad) {
    const W = c.window;
    lines.push(
      "",
      `# Quadrants: net across, its change over ${c.quad.lag} ${c.steps} up and down, from the rolling net`,
      `dyn = dynamic_connectedness(X, window=${W}, **MODEL)`,
      `at = dyn.net.index.get_loc(${q(c.quad.date)})`,
      `change = dyn.net.iloc[at] - dyn.net.iloc[at - ${c.quad.lag}]`,
      `print(pd.DataFrame({"net": dyn.net.iloc[at], "change": change}).round(1))`
    );
    lines[0] = lines[0].replace("import static_connectedness", "import dynamic_connectedness, static_connectedness");
  }
  return lines.join("\n");
}

function heatmap(c: CodeContext): string {
  const sl = slice(c, c.state.window);
  return [
    header(c, "Spillover heatmap", ["static_connectedness"], ["spillover_heatmap"]),
    "",
    `res = static_connectedness(${sl.code}, **MODEL)  # ${sl.note}`,
    "",
    c.grid ? "# the demo's heatmap (cells 18 and 21), as the Original view draws it" : "# the demo's heatmap (cells 18 and 21): the same numbers the dots show",
    "# a cell is positive when its row passes more to its column than it gets back, so the rows",
    '# are "from" and the columns "to" (the library\'s default titles describe its other matrix)',
    "fig, ax = plt.subplots(figsize=(9, 8))",
    'spillover_heatmap(res.pairwise_net, ax=ax, cmap="RdBu_r", annotate=False, xlabel="to", ylabel="from")',
    `ax.set_title(${q(`Net pairwise connectedness, ${sl.note} (%)`)})`,
    "plt.show()",
    "",
    "# the strongest flows, largest first (the ringed dots)",
    "flows = res.pairwise_net.stack()",
    "print(flows[flows > 0].sort_values(ascending=False).head(20).round(2))",
    ...pickLines(c),
  ].join("\n");
}

function frequency(c: CodeContext): string {
  const keys = ["full", "last200", "p1", "p2", "p3", "p4"].filter((k) => c.blocks[k]);
  const rows = keys.map((k) => {
    const sl = slice(c, k);
    const label = k === "full" ? "Full sample" : k === "last200" ? `Last ${c.window} ${c.steps}` : c.blocks[k].label;
    return `    ${q(label)}: ${sl.code},`;
  });
  const shown = c.blocks[c.freqKey];
  const shownLabel = c.freqKey === "full" ? "Full sample" : c.freqKey === "last200" ? `Last ${c.window} ${c.steps}` : shown.label;
  return [
    header(c, "Frequency-domain connectedness", ["frequency_connectedness"], []),
    "",
    "# the library's split by cycle length (Baruník–Křehlík) with its defaults: a 100-step horizon,",
    `# and cycles of up to 5 ${c.steps}, 5 to 20, and longer than 20`,
    'FREQ = dict(horizon=100, periods=(5, 20), method="generalized", lags=2)',
    "",
    "periods = {",
    ...rows,
    "}",
    "split = pd.DataFrame({name: frequency_connectedness(frame, **FREQ).total for name, frame in periods.items()}).T",
    "print(split.round(1))  # each row adds up to the period's total spillover",
    "",
    "# one bar per period, split into short, medium and long term, as on the page",
    "ax = split.iloc[::-1].plot.barh(stacked=True, figsize=(10, 4))",
    'ax.set_xlabel("Spillover, %")',
    "plt.show()",
    "",
    `# the period on show: ${shownLabel}`,
    `print(frequency_connectedness(periods[${q(shownLabel)}], **FREQ))`,
  ].join("\n");
}

export function pythonFor(c: CodeContext): string {
  const body = c.view === "index" ? index(c) : c.view === "network" ? network(c) : c.view === "heatmap" ? heatmap(c) : frequency(c);
  return `${body}\n`;
}
