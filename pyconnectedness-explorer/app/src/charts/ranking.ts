/**
 * Ranking by net[t] (SPEC.md section 6, view 4). No Figma/notebook reference for this view, so
 * it follows whichever chart-colour language is active, so colour carries one meaning across
 * the whole explorer either way. Redesign style renders Fitbit's own list-row pattern -- label,
 * big bold number, ring badge on the right -- instead of a dot-plus-horizontal-bar; baseline
 * keeps the plain bar-track version since it has no Figma reference to match either way and
 * the bar reads the diverging sign at a glance, which baseline's unstyled brief cares about
 * more than redesign's component fidelity does.
 */
import { BASELINE, FONTS, type RedesignTokens } from "../encoding";
import { ringSvg } from "../ui/ring";
import type { ChartStyle } from "../state";

export interface RankingDatum {
  names: string[];
  net: number[];
  style: ChartStyle;
  tokens: RedesignTokens;
  selectedMarket?: string | null;
  onSelect?: (name: string) => void;
}

export class RankingList {
  constructor(private host: HTMLElement) {}

  render(d: RankingDatum) {
    const order = d.names
      .map((name, i) => ({ name, net: d.net[i] }))
      .sort((a, b) => b.net - a.net);
    const maxAbs = Math.max(1e-9, ...order.map((o) => Math.abs(o.net)));
    const isRedesign = d.style === "redesign";
    const sendColor = isRedesign ? d.tokens.send : BASELINE.sendColor;
    const recvColor = isRedesign ? d.tokens.recv : BASELINE.recvColor;
    const nameFont = isRedesign ? FONTS.body : BASELINE.fontFamily;
    const valueFont = isRedesign ? FONTS.data : BASELINE.fontFamily;

    this.host.innerHTML = order
      .map((o) => {
        const color = o.net >= 0 ? sendColor : recvColor;
        const frac = Math.abs(o.net) / maxAbs;
        const selected = d.selectedMarket === o.name ? "font-weight:700;" : "";
        return `
          <div class="metric-row" data-market="${o.name}" style="font-family:${nameFont};${selected}">
            <div class="metric-row-main">
              <div class="metric-row-label">${o.name}</div>
              <div class="metric-row-value" style="font-family:${valueFont}">${o.net.toFixed(1)}<span class="metric-row-unit">%</span></div>
            </div>
            <div class="metric-ring">${ringSvg(frac, color, 40, 4)}</div>
          </div>
        `;
      })
      .join("");
    this.host.querySelectorAll<HTMLElement>(".metric-row").forEach((row) => {
      row.addEventListener("click", () => d.onSelect?.(row.dataset.market!));
    });
  }
}
