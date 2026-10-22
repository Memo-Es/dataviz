/**
 * Diverging bar ranking by net[t] (SPEC.md section 6, view 4). No Figma reference for this
 * view, so it's built with the app-shell conventions, but keeps the same send/recv colours as
 * the network view so colour carries one meaning across the whole explorer.
 */
import { BASELINE } from "../encoding";

export interface RankingDatum {
  names: string[];
  net: number[];
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

    this.host.innerHTML = "";
    for (const o of order) {
      const row = document.createElement("div");
      row.className = "ranking-row";
      if (d.selectedMarket === o.name) row.style.fontWeight = "600";
      row.onclick = () => d.onSelect?.(o.name);

      const name = document.createElement("div");
      name.className = "ranking-name";
      name.textContent = o.name;

      const track = document.createElement("div");
      track.className = "ranking-bar-track";
      const bar = document.createElement("div");
      bar.className = "ranking-bar";
      const frac = Math.abs(o.net) / maxAbs;
      bar.style.background = o.net >= 0 ? BASELINE.sendColor : BASELINE.recvColor;
      bar.style.opacity = String(BASELINE.nodeAlpha);
      if (o.net >= 0) {
        bar.style.left = "50%";
        bar.style.width = `${frac * 50}%`;
      } else {
        bar.style.right = "50%";
        bar.style.width = `${frac * 50}%`;
      }
      track.appendChild(bar);
      const zero = document.createElement("div");
      zero.style.position = "absolute";
      zero.style.left = "50%";
      zero.style.top = "0";
      zero.style.bottom = "0";
      zero.style.width = "1px";
      zero.style.background = "var(--line)";
      track.appendChild(zero);

      const value = document.createElement("div");
      value.className = "ranking-value";
      value.textContent = o.net.toFixed(1);

      row.append(name, track, value);
      this.host.appendChild(row);
    }
  }
}
