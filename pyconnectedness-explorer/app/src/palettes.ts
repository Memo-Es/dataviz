/**
 * Colour palettes after French and Dutch Impressionist paintings. One rule on every graph:
 * colour = region (graph 1's beads, graph 2's circles and arrows, graph 3's dots); sending vs
 * receiving is shown by form (solid vs ring, right vs left of zero), never by a second hue.
 *
 * Each palette takes its painting's focal colour (Monet's sun, Seurat's vermilion...) as the
 * highlight for what's picked, and the region colours from the rest of the canvas. Hexes are
 * approximations of the paintings' pigments as reproduced, then snapped (hue kept, lightness and
 * chroma moved as little as possible) until they pass the data-viz palette checks: OKLCH
 * lightness band and chroma floor, >= 3:1 against the surface, colour-blind separation
 * (protan/deutan, Machado 2009) >= 8 and normal-vision >= 15 between every pair of the first
 * three slots and between neighbours over all eight; the fourth slot (only the 4-region
 * datasets use it) is never below the 6 floor and always ships with direct labels.
 * Validated with the dataviz skill's validate_palette.js, light and dark.
 */

export interface Mode {
  bg: string;
  panel: string;
  /** the pale circle in every heat-map cell, chips, quiet fills */
  base: string;
  /** strings, cores, the index bead */
  ink: string;
  /** categorical slots, in order: regions first */
  hues: string[];
  accent: string;
  /** the short / medium / long-term shades, darkest (fastest) first in light mode */
  ramp: [string, string, string];
}

export interface Palette {
  id: string;
  painter: string;
  painting: string;
  year: string;
  /** shown under the picker: what the palette was taken from */
  note: string;
  light: Mode;
  dark: Mode;
}

export const PALETTES: Palette[] = [
  {
    id: "seurat",
    painter: "Seurat",
    painting: "Un dimanche après-midi à l'Île de la Grande Jatte",
    year: "1884–86",
    note: "Pointillist complementaries: emerald grass, orange light, ultramarine shade; the vermilion parasols as the highlight.",
    light: {
      bg: "#f1f0e6", panel: "#fbfaf5", base: "#ebe9dc", ink: "#1d2a22",
      hues: ["#0c7847", "#d37507", "#4b49a8", "#3b8fc8", "#b18c00", "#8959a7", "#7a9a2a", "#c7587d"],
      accent: "#d2452f", ramp: ["#2f4a3c", "#5f7a6a", "#9db3a5"],
    },
    dark: {
      bg: "#121412", panel: "#1a1c1a", base: "#262924", ink: "#e8ebe4",
      hues: ["#36a067", "#d07200", "#5f59c1", "#2297d9", "#836600", "#a179c5", "#7c9b28", "#cd6790"],
      accent: "#e8604a", ramp: ["#d5e3da", "#9db3a5", "#5f7a6a"],
    },
  },
  {
    id: "monet",
    painter: "Monet",
    painting: "Impression, soleil levant",
    year: "1872",
    note: "A harbour in blue-grey mist, cobalt and teal water, violet shadow; the orange sun as the highlight.",
    light: {
      bg: "#eeeeea", panel: "#fbfaf7", base: "#e9e8e3", ink: "#1f2a3a",
      hues: ["#1e52ae", "#009d90", "#886dbd", "#b98711", "#a23c57", "#5c8f45", "#467cbe", "#7a3d7a"],
      accent: "#e0601c", ramp: ["#26364f", "#566a88", "#97a7bf"],
    },
    dark: {
      bg: "#121418", panel: "#1b1d22", base: "#262932", ink: "#e7e9ef",
      hues: ["#2d62cf", "#00a494", "#9b75e0", "#b68406", "#9f599f", "#6c9e53", "#5c8fd4", "#d0707f"],
      accent: "#f07a38", ramp: ["#d3dbe8", "#97a7bf", "#566a88"],
    },
  },
  {
    id: "renoir",
    painter: "Renoir",
    painting: "Bal du moulin de la Galette",
    year: "1876",
    note: "Dappled afternoon: blue-violet shadows, gold light, green leaves, coral; the dancers' rose as the highlight.",
    light: {
      bg: "#f4eeea", panel: "#fcf9f6", base: "#efe6e1", ink: "#2a1f2a",
      hues: ["#40509f", "#8e6c00", "#1fa066", "#e46f34", "#694995", "#0081aa", "#737200", "#009d8b"],
      accent: "#cf5a86", ramp: ["#3a2d4a", "#6a5a80", "#a99cbd"],
    },
    dark: {
      bg: "#161214", panel: "#1f1a1c", base: "#2c2528", ink: "#efe6ea",
      hues: ["#6e7ecf", "#866500", "#3c9e6e", "#dc6622", "#7c5ca7", "#1b96c2", "#7e7c00", "#00a493"],
      accent: "#e07aa0", ramp: ["#ddd5e8", "#a99cbd", "#6a5a80"],
    },
  },
  {
    id: "vangogh",
    painter: "Van Gogh",
    painting: "Caféterras bij nacht (Terrasse du café le soir)",
    year: "1888",
    note: "Night sky in ultramarine, terracotta paving, green shutters, violet; the café's chrome yellow as the highlight.",
    light: {
      bg: "#efece0", panel: "#fbf9f2", base: "#ebe6d4", ink: "#141c3a",
      hues: ["#3352a2", "#ba3d09", "#198b5f", "#bd74ce", "#898825", "#5090d1", "#b64368", "#c58009"],
      accent: "#e0a81c", ramp: ["#1f2a52", "#4f5c8a", "#929cc0"],
    },
    dark: {
      bg: "#0e1120", panel: "#171a26", base: "#232738", ink: "#ece9dc",
      hues: ["#5e86f3", "#de6336", "#399f70", "#9e448e", "#939332", "#2769a7", "#c95a7f", "#c27d00"],
      accent: "#f0c040", ramp: ["#d4d8ea", "#929cc0", "#4f5c8a"],
    },
  },
  {
    id: "breitner",
    painter: "Breitner",
    painting: "Meisje in witte kimono",
    year: "1894",
    note: "Amsterdam Impressionism: ochre and slate, olive, plum, teal folds; the kimono's vermilion as the highlight.",
    light: {
      bg: "#ecebe6", panel: "#f9f7f2", base: "#e7e3da", ink: "#1d1a17",
      hues: ["#b88701", "#0068ad", "#4c6705", "#994f83", "#009c95", "#d76d58", "#5268b1", "#915300"],
      accent: "#c0391f", ramp: ["#3a3224", "#6e634e", "#ada38c"],
    },
    dark: {
      bg: "#131210", panel: "#1c1a18", base: "#282522", ink: "#ece8e0",
      hues: ["#b48500", "#4085c3", "#577115", "#9a5185", "#009e97", "#cb715d", "#7389d5", "#ab6b21"],
      accent: "#e0583c", ramp: ["#e2dccd", "#ada38c", "#6e634e"],
    },
  },
];

/** WCAG relative luminance, to pick dark or light text on a fill */
function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export const inkOn = (hex: string) => (lum(hex) > 0.3 ? "#141414" : "#ffffff");

const VARS = ["--bg", "--panel", "--band", "--bead-ink", "--accent", "--accent-ink", "--accent-wash", "--band-fast", "--band-mid", "--band-slow", "--band-fast-ink", "--band-mid-ink", "--band-slow-ink", "--send", "--recv", ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `--bead-${i}`)];

/** Put a palette's tokens on the page for the current theme; "agam" (the original) clears them. */
export function applyPalette(id: string, theme: "light" | "dark") {
  const root = document.documentElement.style;
  for (const v of VARS) root.removeProperty(v);
  const pal = PALETTES.find((x) => x.id === id);
  if (!pal) return;
  const m = pal[theme];
  const set = (k: string, v: string) => root.setProperty(k, v);
  set("--bg", m.bg);
  set("--panel", m.panel);
  set("--band", m.base);
  set("--bead-ink", m.ink);
  m.hues.forEach((h, i) => set(`--bead-${i + 1}`, h));
  set("--accent", m.accent);
  set("--accent-ink", inkOn(m.accent));
  set("--accent-wash", `${m.accent}22`);
  (["fast", "mid", "slow"] as const).forEach((k, i) => {
    set(`--band-${k}`, m.ramp[i]);
    set(`--band-${k}-ink`, inkOn(m.ramp[i]));
  });
}
