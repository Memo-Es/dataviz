/**
 * Download a graph as a figure for a report: SVG (vector) or PNG (2x). The figure is the graph as
 * it is on screen, with whatever is picked still highlighted, framed by what a reader of a report
 * needs: the question, the title, the sentence for the current selection, the legend, and a
 * source line (the library, its commit, the function, the dataset and the window).
 *
 * The chart is copied from the page, with each element's computed style written onto it, so
 * the file stands alone. The two fonts are embedded (Latin letters only), so it looks the same
 * anywhere. The beads are
 * drawn on a canvas: in an SVG they come in as an image under the vector labels.
 */

export interface Figure {
  /** file name without extension */
  file: string;
  question: string;
  title: string;
  /** the library call, shown beside the title */
  tag: string;
  sentence: string;
  /** the element whose box the layers are placed in */
  host: HTMLElement;
  /** what to draw, bottom to top: svgs and canvases inside `host` */
  layers: (SVGSVGElement | HTMLCanvasElement)[];
  /** legend rows: each child span becomes a line item (its swatch, then its text) */
  legends: HTMLElement[];
  source: string;
}

const STYLE_PROPS = [
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "stroke-linecap", "stroke-linejoin",
  "opacity", "visibility", "display", "font-family", "font-size", "font-weight", "font-style", "letter-spacing",
  "text-anchor", "dominant-baseline", "paint-order", "text-decoration",
];

const DEFAULTS: Record<string, string> = {
  "fill-opacity": "1", "stroke-opacity": "1", "stroke-dasharray": "none", "stroke-linecap": "butt", "stroke-linejoin": "miter",
  opacity: "1", visibility: "visible", display: "inline", "font-style": "normal", "letter-spacing": "normal",
  "text-anchor": "start", "dominant-baseline": "auto", "paint-order": "normal", "text-decoration": "none solid rgb(0, 0, 0)",
};

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** what's on screen only to be clicked or read as a hint: not part of a figure */
const SCREEN_ONLY = "title, .hit, .band-hit, .beads-hint, .hover-guide";

/** a copy of `svg` with every element's computed style written inline (only what differs from
 * SVG's defaults, so the file stays small), without the parts that are only there to click */
function inlineCopy(svg: SVGSVGElement): SVGSVGElement {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...svg.querySelectorAll("*")];
  const dst = [copy, ...copy.querySelectorAll("*")];
  const drop: Element[] = [];
  src.forEach((el, i) => {
    const out = dst[i] as SVGElement;
    const cs = getComputedStyle(el);
    if (el.matches(SCREEN_ONLY) || cs.display === "none") return drop.push(out);
    out.removeAttribute("class");
    out.setAttribute(
      "style",
      STYLE_PROPS.map((p) => [p, cs.getPropertyValue(p)])
        .filter(([p, v]) => v && DEFAULTS[p] !== v)
        .map(([p, v]) => `${p}:${v}`)
        .join(";")
    );
  });
  drop.forEach((e) => e.remove());
  return copy;
}

/** the page's fonts as data URLs, latin subsets only (enough for every label we draw) */
let fontCss: Promise<string> | null = null;
function embeddedFonts(): Promise<string> {
  fontCss ??= (async () => {
    const link = document.querySelector<HTMLLinkElement>('link[href*="fonts.googleapis.com/css"]');
    if (!link) return "";
    try {
      const text = await (await fetch(link.href)).text();
      const blocks = [...text.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
        .filter((m) => m[1] === "latin" && /Plus Jakarta Sans|B612 Mono/.test(m[2]))
        .map((m) => m[2]);
      const out = await Promise.all(
        blocks.map(async (b) => {
          const url = b.match(/url\(([^)]+)\)/)?.[1];
          if (!url) return "";
          const buf = await (await fetch(url)).arrayBuffer();
          let bin = "";
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return b.replace(url, `data:font/woff2;base64,${btoa(bin)}`);
        })
      );
      return out.join("\n");
    } catch {
      return ""; // offline: the figure falls back to the reader's fonts
    }
  })();
  return fontCss;
}

/** wrap `text` to `width` px in `font` */
function wrap(text: string, font: string, width: number): string[] {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = font;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** the figure as a standalone SVG string, and its size */
export async function figureSvg(f: Figure): Promise<{ svg: string; w: number; h: number }> {
  const sans = css("--f-sans") || "sans-serif";
  const mono = css("--f-num") || "monospace";
  const ink = css("--stone") || "#4a4843";
  const accent = css("--accent") || ink;
  const bg = css("--panel") || "#ffffff";
  const box = f.host.getBoundingClientRect();
  const PAD = 32;
  const w = Math.round(box.width + PAD * 2);
  const inner = w - PAD * 2;
  let y = PAD;
  const parts: string[] = [];
  const text = (s: string, x: number, yy: number, font: string, fill = ink, extra = "") =>
    parts.push(`<text x="${x}" y="${yy}" style="${esc(`font:${font};fill:${fill}`)}" ${extra}>${esc(s)}</text>`);

  // header: the question, the title with its library call, the sentence for this selection
  // the question, after the accent dash, as on the page
  parts.push(`<rect x="${PAD}" y="${(y += 12) - 5}" width="14" height="3" rx="1.5" fill="${accent}"/>`);
  text(f.question.toUpperCase(), PAD + 22, y, `700 11px ${sans}`, ink, `letter-spacing="0.08em"`);
  y += 28;
  text(f.title, PAD, y, `700 20px ${sans}`);
  const titleW = (() => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `700 20px ${sans}`;
    return ctx.measureText(f.title).width;
  })();
  text(f.tag, PAD + titleW + 10, y, `400 11px ${mono}`);
  y += 10;
  for (const line of wrap(f.sentence, `400 15px ${sans}`, inner)) text(line, PAD, (y += 22), `400 15px ${sans}`);
  y += 18;

  // the chart, layer by layer, where it sits on the page
  const top = y;
  for (const layer of f.layers) {
    const r = layer.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const x0 = PAD + (r.left - box.left);
    const y0 = top + (r.top - box.top);
    if (layer instanceof HTMLCanvasElement) {
      parts.push(`<image x="${x0}" y="${y0}" width="${r.width}" height="${r.height}" href="${layer.toDataURL("image/png")}"/>`);
    } else {
      const c = inlineCopy(layer);
      c.setAttribute("x", String(x0));
      c.setAttribute("y", String(y0));
      c.setAttribute("width", String(r.width));
      c.setAttribute("height", String(r.height));
      parts.push(new XMLSerializer().serializeToString(c));
    }
  }
  y = top + box.height + 22;

  // the legend: each item a swatch and its words, wrapped into rows
  const items = f.legends
    .flatMap((l) => [...l.children])
    .flatMap((c) => (c.querySelector(":scope > span") ? [...c.children] : [c])) // a group of keys: one by one
    .filter((c) => (c as HTMLElement).offsetParent !== null && c.textContent?.trim());
  let x = PAD;
  const font = `400 12.5px ${sans}`;
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = font;
  for (const it of items) {
    // the words, without instructions that only make sense on screen ("Click a string...")
    const label = it.textContent!.replace(/\s+/g, " ").replace(/\s*(Click|Pick|Hover)[^.]*\./g, "").trim();
    if (!label) continue;
    const sw = it.querySelector("i");
    const swCol = sw ? getComputedStyle(sw).backgroundColor : "";
    const swEdge = sw ? (getComputedStyle(sw).boxShadow.match(/rgba?\([^)]+\)/)?.[0] ?? "") : "";
    const itemW = (sw ? 16 : 0) + ctx.measureText(label).width + 22;
    if (x + itemW > w - PAD && x > PAD) {
      x = PAD;
      y += 20;
    }
    if (sw && swCol && swCol !== "rgba(0, 0, 0, 0)") parts.push(`<rect x="${x}" y="${y - 9}" width="10" height="10" rx="2" fill="${swCol}"${swEdge ? ` stroke="${swEdge}" stroke-width="1.5"` : ""}/>`);
    else if (sw && swEdge) parts.push(`<rect x="${x}" y="${y - 9}" width="10" height="10" rx="2" fill="none" stroke="${swEdge}" stroke-width="1.5"/>`);
    text(label, x + (sw ? 16 : 0), y, font);
    x += itemW;
  }
  y += 30;

  // the source, and a hairline above it
  parts.push(`<line x1="${PAD}" x2="${w - PAD}" y1="${y - 14}" y2="${y - 14}" stroke="${ink}" stroke-opacity="0.2"/>`);
  for (const line of wrap(f.source, `400 11.5px ${sans}`, inner)) text(line, PAD, (y += 16) - 8, `400 11.5px ${sans}`);
  const h = Math.round(y + PAD - 8);

  const fonts = await embeddedFonts();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<style>${fonts}</style>
<rect width="100%" height="100%" fill="${bg}"/>
${parts.join("\n")}
</svg>`;
  return { svg, w, h };
}

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function downloadSvg(f: Figure) {
  const { svg } = await figureSvg(f);
  save(new Blob([svg], { type: "image/svg+xml" }), `${f.file}.svg`);
}

/** the same figure, drawn at twice its size for print */
export async function downloadPng(f: Figure, scale = 2) {
  const { svg, w, h } = await figureSvg(f);
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (blob) save(blob, `${f.file}.png`);
}
