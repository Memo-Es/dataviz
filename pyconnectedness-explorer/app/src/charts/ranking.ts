/**
 * Ranking by net[t] (SPEC.md section 6, view 4). No Figma/notebook reference for this view, so
 * it follows whichever chart-colour language is active, so colour carries one meaning across
 * the whole explorer either way. Row shape (a small send/recv dot, the name, a bold number --
 * no ring, no bar) matches the client's own Figma reference (node 17141:14591): nothing in that
 * file uses a progress ring or bar as a per-row indicator, so this stays in its plain, mostly-
 * text register instead of inventing a component the reference doesn't have.
 */
import { BASELINE, FONTS, type RedesignTokens } from "../encoding";
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
    const isRedesign = d.style === "redesign";
    const sendColor = isRedesign ? d.tokens.send : BASELINE.sendColor;
    const recvColor = isRedesign ? d.tokens.recv : BASELINE.recvColor;
    const nameFont = isRedesign ? FONTS.body : BASELINE.fontFamily;
    const valueFont = isRedesign ? FONTS.data : BASELINE.fontFamily;

    this.host.innerHTML = order
      .map((o) => {
        const color = o.net >= 0 ? sendColor : recvColor;
        const selected = d.selectedMarket === o.name ? "font-weight:700;" : "";
        return `
          <div class="metric-row" data-market="${o.name}" style="font-family:${nameFont};${selected}">
            <div class="metric-row-dot" style="background:${color}"></div>
            <div class="metric-row-main">
              <div class="metric-row-label">${o.name}</div>
            </div>
            <div class="metric-row-value" style="font-family:${valueFont}">${o.net.toFixed(1)}<span class="metric-row-unit">%</span></div>
          </div>
        `;
      })
      .join("");
    this.host.querySelectorAll<HTMLElement>(".metric-row").forEach((row) => {
      row.addEventListener("click", () => d.onSelect?.(row.dataset.market!));
    });
  }
}
