/**
 * Detail panel (SPEC.md section 6, view 5). No Figma reference; app-shell styling.
 */
import * as d3 from "d3";
import { BASELINE, REGION_OF } from "../encoding";
import type { ExplorerData, Measure } from "../data";
import { matrixAt } from "../data";

export interface DetailProps {
  data: ExplorerData;
  measure: Measure;
  t: number;
  market: string | null;
  pair: [string, string] | null;
}

function sparkline(host: HTMLElement, series: number[], tIndex: number, width = 260, height = 44) {
  host.innerHTML = "";
  const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%");
  const x = d3.scaleLinear().domain([0, series.length - 1]).range([2, width - 2]);
  const [lo, hi] = d3.extent(series) as [number, number];
  const y = d3.scaleLinear().domain([lo, hi]).range([height - 6, 6]);
  const zero = y(0);
  if (zero >= 0 && zero <= height) {
    svg.append("line").attr("x1", 0).attr("x2", width).attr("y1", zero).attr("y2", zero).attr("stroke", "var(--line)");
  }
  const line = d3.line<number>().x((_v, i) => x(i)).y((v) => y(v));
  svg.append("path").attr("d", line(series)).attr("fill", "none").attr("stroke", "var(--muted)").attr("stroke-width", 1.2);
  svg
    .append("circle")
    .attr("cx", x(tIndex))
    .attr("cy", y(series[tIndex] ?? 0))
    .attr("r", 3)
    .attr("fill", (series[tIndex] ?? 0) >= 0 ? BASELINE.sendColor : BASELINE.recvColor);
}

function row(label: string, value: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "detail-row";
  el.innerHTML = `<span class="k">${label}</span><span class="v">${value}</span>`;
  return el;
}

export function renderDetail(host: HTMLElement, p: DetailProps) {
  host.innerHTML = "";
  const { data, measure, t } = p;
  const names = data.meta.names;

  if (p.pair) {
    const [sender, receiver] = p.pair;
    const i = names.indexOf(sender);
    const j = names.indexOf(receiver);
    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.style.marginBottom = "8px";
    title.textContent = `${sender} → ${receiver}`;
    host.appendChild(title);

    const mat = matrixAt(data, measure, t);
    const now = mat[i][j];
    const full = data.meta.static[measure].full.pairwise_net[i][j];
    const last200 =
      measure === "returns" ? data.meta.static.returns.last200.pairwise_net[i][j] : null;
    const flipped = Math.sign(now) !== Math.sign(full) && now !== 0 && full !== 0;

    host.appendChild(row("At selected week", `${now.toFixed(2)} %`));
    host.appendChild(row("Full sample", `${full.toFixed(2)} %`));
    if (last200 !== null) host.appendChild(row("Last 200 weeks", `${last200.toFixed(2)} %`));
    if (flipped) {
      const note = document.createElement("div");
      note.className = "legend-note";
      note.textContent = "Direction differs from the full-sample average.";
      host.appendChild(note);
    }
    return;
  }

  if (p.market) {
    const i = names.indexOf(p.market);
    const region = REGION_OF[p.market] ?? "";
    const net = data.meta.dynamic[measure].net.map((row) => row[i]);
    const nowNet = net[t];
    const isSender = nowNet >= 0;

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.style.marginBottom = "8px";
    header.innerHTML = `<span style="font-weight:600">${p.market}</span><span class="pill ${isSender ? "send" : "recv"}">${isSender ? "net sender" : "net receiver"}</span>`;
    host.appendChild(header);

    host.appendChild(row("Region", region));
    host.appendChild(row("Net, selected week", `${nowNet.toFixed(2)} %`));

    const spark = document.createElement("div");
    spark.style.margin = "8px 0";
    host.appendChild(spark);
    sparkline(spark, net, t);

    const mat = matrixAt(data, measure, t);
    const outLinks = names
      .map((n, j) => ({ n, v: mat[i][j] }))
      .filter((x) => x.n !== p.market)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);
    const inLinks = names
      .map((n, j) => ({ n, v: mat[j][i] }))
      .filter((x) => x.n !== p.market)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);

    const outTitle = document.createElement("div");
    outTitle.className = "legend-note";
    outTitle.textContent = "Top outgoing";
    host.appendChild(outTitle);
    for (const l of outLinks) host.appendChild(row(l.n, `${l.v.toFixed(2)} %`));

    const inTitle = document.createElement("div");
    inTitle.className = "legend-note";
    inTitle.textContent = "Top incoming";
    host.appendChild(inTitle);
    for (const l of inLinks) host.appendChild(row(l.n, `${l.v.toFixed(2)} %`));
    return;
  }

  const empty = document.createElement("div");
  empty.className = "legend-note";
  empty.textContent = "Select a market or an arrow to see detail here.";
  host.appendChild(empty);
}
