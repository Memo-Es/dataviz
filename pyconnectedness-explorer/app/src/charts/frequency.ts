/**
 * "How fast shocks travel": the library's frequency_connectedness (Baruník-Křehlík 2018), as
 * exported by export_cell.py. Each window's spillover is split by how long a shock takes to play
 * out. HTML, not SVG: it's bars and lists, and HTML gets wrapping and the B612 Mono numbers free.
 */
import type { FrequencyBand, FrequencyBlock } from "../data";
import { fmtSigned } from "../encoding";

export const BAND_COPY: Record<FrequencyBand["label"], { short: string; phrase: string; cls: string }> = {
  "<=5": { short: "Within 5 weeks", phrase: "within 5 weeks", cls: "fast" },
  "5-20": { short: "5 to 20 weeks", phrase: "over 5 to 20 weeks", cls: "mid" },
  ">20": { short: "Over 20 weeks", phrase: "over more than 20 weeks", cls: "slow" },
};

export interface FrequencyRow {
  key: string;
  label: string;
  block: FrequencyBlock;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderFrequency(
  host: HTMLElement,
  rows: FrequencyRow[],
  selectedKey: string,
  names: string[],
  onPick: (key: string) => void
) {
  const sel = rows.find((r) => r.key === selectedKey) ?? rows[0];

  const bars = rows
    .map((r) => {
      const segs = r.block.bands
        .map((b) => {
          const c = BAND_COPY[b.label];
          return `<span class="seg ${c.cls}" style="width:${b.total}%" title="${c.short}: ${b.total.toFixed(1)} pp">${
            `<b class="num">${b.total.toFixed(1)}</b>`
          }</span>`;
        })
        .join("");
      return `<button class="freq-row" data-key="${r.key}" aria-pressed="${r.key === sel.key}">
        <span class="freq-label">${esc(r.label)}</span>
        <span class="freq-track">${segs}</span>
        <span class="freq-total num">${r.block.static_total.toFixed(1)}%</span>
      </button>`;
    })
    .join("");

  const drivers = sel.block.bands
    .map((b) => {
      const c = BAND_COPY[b.label];
      const order = names.map((n, i) => ({ n, v: b.net[i] })).sort((x, y) => y.v - x.v);
      const top = order.slice(0, 3);
      const bottom = order.slice(-3).reverse();
      const max = Math.max(...order.map((d) => Math.abs(d.v)), 1e-9);
      const li = (d: { n: string; v: number }, cls: string) =>
        `<li><span>${esc(d.n)}</span><i class="mini ${cls}" style="width:${(Math.abs(d.v) / max) * 100}%"></i><b class="num ${cls}">${fmtSigned(d.v)}</b></li>`;
      return `<div class="driver">
        <p class="driver-head"><i class="key ${c.cls}"></i>${c.short} <span class="num">${b.total.toFixed(1)}</span> pp</p>
        <p class="k">Sends most</p><ul>${top.map((d) => li(d, "send")).join("")}</ul>
        <p class="k">Receives most</p><ul>${bottom.map((d) => li(d, "recv")).join("")}</ul>
      </div>`;
    })
    .join("");

  host.innerHTML = `
    <div class="freq-bars" role="group" aria-label="Spillover by speed, per window">${bars}
      <div class="freq-axis" aria-hidden="true"><span></span><span class="freq-ticks"><i>0%</i><i>50%</i><i>100%</i></span><span></span></div>
    </div>
    <div class="freq-drivers">
      <p class="k drivers-title">Who drives each speed · ${esc(sel.label)}</p>
      <div class="driver-grid">${drivers}</div>
    </div>`;
  host.querySelectorAll<HTMLButtonElement>(".freq-row").forEach((b) => (b.onclick = () => onPick(b.dataset.key!)));
}

/** The band carrying the most spillover in a window, for the card's one-line finding. */
export function dominantBand(block: FrequencyBlock) {
  const b = block.bands.reduce((a, c) => (c.total > a.total ? c : a));
  return { band: b, pct: (b.total / block.static_total) * 100, copy: BAND_COPY[b.label] };
}
