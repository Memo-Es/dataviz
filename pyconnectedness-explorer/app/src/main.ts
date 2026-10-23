import "./style.css";
import { loadExplorerData, type ExplorerData } from "./data";
import { Store, prefersDark, type ExplorerState, type LayoutMode } from "./state";
import { World } from "./world";
import type { LayoutController } from "./layouts/types";
import { PlainLayout } from "./layouts/plain";
import { BentoLayout } from "./layouts/bento";
import { ShellLayout } from "./layouts/shell";
import { StoryLayout } from "./layouts/story";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div class="topbar">
    <div>
      <h1>PyConnectedness Explorer</h1>
      <p class="subtitle">How shocks travel between 20 stock markets &mdash; from PyConnectedness's own Demo notebook output.</p>
    </div>
    <div class="controls">
      <div class="pill-group" id="layout-group" title="Layout">
        <button data-layout="bento" aria-pressed="false">Bento</button>
        <button data-layout="shell" aria-pressed="false">Shell</button>
        <button data-layout="story" aria-pressed="true">Story</button>
      </div>
      <div class="pill-group" id="style-group">
        <button data-style="redesign" aria-pressed="true">Redesign</button>
        <button data-style="baseline" aria-pressed="false">Faithful baseline</button>
      </div>
      <div class="pill-group" id="measure-group">
        <button data-measure="returns" aria-pressed="true">Returns</button>
        <button data-measure="volatility" aria-pressed="false">Volatility</button>
      </div>
      <button class="theme-toggle" id="theme-toggle" type="button">Theme</button>
    </div>
  </div>

  <div class="banner prototype">
    <strong>Design prototype for the coaching</strong> &mdash; not the stage 2 browser interface. See CONTEXT.md.
  </div>
  <div class="banner" id="synthetic-banner" style="display:none"></div>

  <div id="layout-root"></div>

  <div class="footnote" id="footnote"></div>
`;

const el = {
  layoutGroup: app.querySelector<HTMLDivElement>("#layout-group")!,
  styleGroup: app.querySelector<HTMLDivElement>("#style-group")!,
  measureGroup: app.querySelector<HTMLDivElement>("#measure-group")!,
  themeToggle: app.querySelector<HTMLButtonElement>("#theme-toggle")!,
  syntheticBanner: app.querySelector<HTMLDivElement>("#synthetic-banner")!,
  layoutRoot: app.querySelector<HTMLDivElement>("#layout-root")!,
  footnote: app.querySelector<HTMLDivElement>("#footnote")!,
};

async function main() {
  const data = await loadExplorerData();

  if (data.meta.synthetic) {
    el.syntheticBanner.style.display = "";
    el.syntheticBanner.innerHTML = `<strong>Data is synthetic, not real.</strong> ${data.meta.synthetic_note ?? "This sandbox had no network access to Yahoo Finance; every statistic is computed by the real pyconnectedness library, but on synthetic input prices. See README.md."}`;
  }

  const lastIndex = data.meta.dynamic.returns.dates.length - 1;

  const store = new Store({
    t: lastIndex,
    measure: "returns",
    matrixWindow: "t",
    matrixSort: "notebook",
    edgePercentile: 90,
    selection: { market: null, pair: null },
    playing: false,
    theme: prefersDark() ? "dark" : "light",
    chartStyle: "redesign",
    layout: "story",
  });

  const world = new World(data, store);
  applyTheme(store.get().theme);

  // one controller instance per layout, built once and reused (mount() is only called again
  // if the controller is re-selected after being torn down) -- see switchController below
  const controllers: Record<string, LayoutController> = {
    plain: new PlainLayout(),
    bento: new BentoLayout(),
    shell: new ShellLayout(),
    story: new StoryLayout(),
  };
  const mounted = new Set<string>();
  let activeKey = "";

  function controllerKeyFor(s: ExplorerState): string {
    return s.chartStyle === "baseline" ? "plain" : s.layout;
  }

  function switchController() {
    const s = store.get();
    const key = controllerKeyFor(s);
    if (key === activeKey) return;
    activeKey = key;
    el.layoutRoot.innerHTML = "";
    mounted.clear(); // chart instances are bound to DOM nodes we just cleared -- always remount
    const ctrl = controllers[key];
    ctrl.mount(el.layoutRoot, world);
    mounted.add(key);
  }

  function render() {
    const s = store.get();
    switchController();

    // chrome shared by every layout
    el.layoutGroup.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-layout") === s.layout));
    });
    (el.layoutGroup as HTMLElement).style.opacity = s.chartStyle === "baseline" ? "0.45" : "1";
    (el.layoutGroup as HTMLElement).style.pointerEvents = s.chartStyle === "baseline" ? "none" : "auto";
    el.styleGroup.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-style") === s.chartStyle));
    });
    el.measureGroup.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-measure") === s.measure));
    });

    controllers[activeKey].render();
    el.footnote.innerHTML = world.footnoteHtml();
  }

  store.subscribe(render);
  render();

  // --- shared interactions ---
  el.layoutGroup.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    store.set({ layout: btn.getAttribute("data-layout") as LayoutMode });
  });
  el.styleGroup.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    world.setChartStyle(btn.getAttribute("data-style") as ExplorerState["chartStyle"]);
  });
  el.measureGroup.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    world.setMeasure(btn.getAttribute("data-measure") as any);
  });
  el.themeToggle.addEventListener("click", () => world.toggleTheme());

  window.addEventListener("keydown", (ev) => {
    if (ev.target instanceof HTMLSelectElement) return;
    if (ev.key === "ArrowRight") world.step(ev.shiftKey ? 52 : 1);
    if (ev.key === "ArrowLeft") world.step(ev.shiftKey ? -52 : -1);
  });
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
}

main().catch((err) => {
  console.error(err);
  app.innerHTML = `<div class="panel"><h2>Failed to load</h2><p>${String(err)}</p></div>`;
});
