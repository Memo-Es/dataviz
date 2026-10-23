/**
 * One shared hover tooltip for redesign-mode charts (dataviz skill's interaction.md: an HTML
 * chart is interactive by default, tooltips enhance but never gate -- every value here is also
 * reachable through the detail panel). Line-key swatches, value leads the row, textContent only.
 */


let el: HTMLDivElement | null = null;

function ensure(): HTMLDivElement {
  if (el) return el;
  el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "1000",
    background: "var(--panel, #fcfcfb)",
    color: "var(--fg, #0b0b0b)",
    border: "1px solid var(--line, rgba(11,11,11,.1))",
    borderRadius: "8px",
    padding: "7px 10px",
    font: "500 12px var(--f-sans)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    opacity: "0",
    transition: "opacity 80ms ease",
    maxWidth: "240px",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  return el;
}

export interface TooltipRow {
  label: string;
  value: string;
  swatch?: string; // line-key color, per the skill ("line keys, not boxes")
}

export function showTooltip(x: number, y: number, title: string, rows: TooltipRow[]) {
  const node = ensure();
  node.textContent = "";

  const titleEl = document.createElement("div");
  titleEl.style.fontWeight = "600";
  titleEl.style.marginBottom = rows.length ? "4px" : "0";
  titleEl.style.fontFamily = "var(--f-sans)";
  titleEl.textContent = title; // textContent only -- labels are untrusted data
  node.appendChild(titleEl);

  for (const r of rows) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "6px";
    row.style.justifyContent = "space-between";
    if (r.swatch) {
      const key = document.createElement("span");
      key.style.display = "inline-block";
      key.style.width = "10px";
      key.style.height = "2px";
      key.style.background = r.swatch;
      key.style.flex = "0 0 auto";
      row.appendChild(key);
    }
    const label = document.createElement("span");
    label.style.color = "var(--secondary)";
    label.textContent = r.label;
    row.appendChild(label);
    const value = document.createElement("span");
    value.style.fontWeight = "700";
    value.style.fontWeight = "600";
    value.style.marginLeft = "auto";
    value.textContent = r.value;
    row.appendChild(value);
    node.appendChild(row);
  }

  const pad = 14;
  let left = x + pad;
  let top = y + pad;
  const rect = node.getBoundingClientRect();
  if (left + 240 > window.innerWidth) left = x - 240 - pad;
  if (top + rect.height + pad > window.innerHeight) top = y - rect.height - pad;
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  node.style.opacity = "1";
}

export function hideTooltip() {
  if (el) el.style.opacity = "0";
}
