// Captures the before / after images for STRATEGIC_POV.md (Appendix B), one explorer build per commit.
// Usage: node capture.mjs <commit|current> <port> <outdir>   (the build for that commit is served on <port>)
import { chromium } from "playwright";
import fs from "node:fs";

const [, , which, port, out] = process.argv;
const BASE = `http://localhost:${port}/`;
const WEEK = "20 Mar 2020";

// every capture: id, commit ("current" = branch head), view hash, what to crop, and what to do first
const SPECS = [
  { id: "5.1a", c: "645639d", crop: "fullpage" },
  { id: "5.1b", c: "current", hash: "home", crop: "viewport" },
  { id: "5.2a", c: "9473a4f", crop: "#g1" },
  { id: "5.2b", c: "current", hash: "index", crop: "#g1" },
  { id: "5.3a", c: "4708b55", crop: "#g1", hover: true },
  { id: "5.3b", c: "current", hash: "index", crop: "#g1", hover: true },
  { id: "5.4a", c: "5e8508a", crop: "top" },
  { id: "5.4b-1", c: "3bfbe32", crop: "top" },
  { id: "5.4b-2", c: "837e1d1", crop: "top" },
  { id: "5.4c", c: "current", hash: "index", crop: "top" },
  { id: "5.5b", c: "current", hash: "index", crop: "#g1", ls: { "pc-g1": "beads" } },
  { id: "5.5c", c: "current", hash: "index", crop: "#g1", ls: { "pc-g1": "line" } },
  { id: "5.6a", c: "e2d012c", crop: "#g1" },
  { id: "5.6b", c: "current", hash: "index", crop: "#g1" },
  { id: "5.7a", c: "8becb4c", crop: "#g1" },
  { id: "5.7b", c: "current", hash: "index", crop: "#g1", insight: true },
  { id: "5.8a", c: "2c7df58", crop: "#g1", query: "?d=fx", noWeek: true },
  { id: "5.9b", c: "current", hash: "index", crop: "#freq" },
  { id: "5.9c", c: "current", hash: "frequency", crop: "viewport" },
  { id: "5.10b", c: "current", hash: "network", crop: "#g2", ls: { "pc-g2": "ring" } },
  { id: "5.11a", c: "ab3b879", crop: "#g2" },
  { id: "5.11b-1", c: "current", hash: "network", crop: "#g2", ls: { "pc-g2": "ring" } },
  { id: "5.11b-2", c: "current", hash: "network", crop: "#g2", ls: { "pc-g2": "ring" }, pick: "Germany" },
  { id: "5.12a", c: "7639607", crop: "#g2" },
  { id: "5.12b", c: "current", hash: "network", crop: "#g2", ls: { "pc-g2": "quad" } },
  { id: "5.13a", c: "e23c7e5", hash: "network", crop: "#g2", ls: { "pc-g2": "quad" }, pick: "Germany" },
  { id: "5.13b", c: "current", hash: "network", crop: "#g2", ls: { "pc-g2": "quad" }, pick: "Germany" },
  { id: "5.14b", c: "bdd65c5", hash: "network", crop: "#g2" },
  { id: "5.14c", c: "current", hash: "network", crop: "#g2", ls: { "pc-g2": "ring" } },
  { id: "5.15b", c: "current", hash: "heatmap", crop: "#g3", ls: { "pc-g3": "dots" } },
  { id: "5.16a", c: "83f3b8f", hash: "heatmap", crop: "#g3" },
  { id: "5.16b", c: "current", hash: "heatmap", crop: "#g3", ls: { "pc-g3": "grid" }, fullSample: true },
  { id: "5.17a-1", c: "521c472", crop: "#g1" },
  { id: "5.17a-2", c: "521c472", crop: "#g2" },
  { id: "5.17b-1", c: "current", hash: "index", crop: "#g1" },
  { id: "5.17b-2", c: "current", hash: "network", crop: "#g2", ls: { "pc-g2": "ring" } },
  { id: "5.18a", c: "16a013d", crop: "#g2" },
  { id: "5.18b", c: "35326d3", crop: "#g2" },
  { id: "5.18c", c: "current", hash: "network", crop: "#g2", ls: { "pc-g2": "ring" } },
  { id: "5.19a", c: "78a101f", hash: "index", crop: "#g1", region: "Europe" },
  { id: "5.19b", c: "current", hash: "index", crop: "#g1", region: "Europe" },
  { id: "5.20a", c: "7762bef", crop: "top" },
  { id: "5.20b", c: "e8e9db0", crop: "top", menu: "select" },
  { id: "5.20c-1", c: "current", hash: "index", crop: "top", menu: "select" },
  { id: "5.20c-2", c: "current", hash: "network", crop: "viewport", menu: "export" },
  { id: "5.21a", c: "239097f", hash: "network", crop: "#g2" },
  { id: "5.21b", c: "current", hash: "network", ls: { "pc-g2": "ring" }, pick: "Germany", download: true },
  { id: "5.22-1", c: "current", hash: "network", crop: "#g2", ls: { "pc-g2": "ring" } },
  { id: "5.22-2", c: "current", hash: "network", crop: "#g2", ls: { "pc-g2": "ring" }, after: 4 },
];

const specs = SPECS.filter((s) => s.c === which);
const log = [];
const browser = await chromium.launch();

async function setWeek(page) {
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  const has = () => page.evaluate((w) => document.body.innerText.includes(w), WEEK);
  if (await has()) return true;
  for (let i = 0; i < 460; i++) {
    await page.keyboard.press("ArrowLeft");
    if (await has()) { await page.waitForTimeout(700); return true; }
  }
  return false;
}

for (const s of specs) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, colorScheme: "light" });
  await ctx.addInitScript((ls) => {
    try { localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } catch {}
  }, s.ls || {});
  const page = await ctx.newPage();
  const notes = [];
  try {
    await page.goto(BASE + (s.query || "") + (s.hash ? "#" + s.hash : ""), { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(2500);
    if (!s.noWeek) {
      let ok = await setWeek(page);
      if (!ok) { notes.push("week not found, default week"); await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(2500); }
    }
    if (s.fullSample) { try { await page.getByText("Full sample", { exact: false }).first().click({ timeout: 5000 }); await page.waitForTimeout(800); } catch { notes.push("full sample not found"); } }
    if (s.region) { try { await page.locator("#g1").getByText(s.region, { exact: true }).first().click({ timeout: 5000 }); await page.waitForTimeout(800); } catch { notes.push("region pick failed"); } }
    if (s.pick) {
      try {
        const host = page.locator("#g2 svg text").filter({ hasText: new RegExp("^" + s.pick) });
        await host.first().click({ timeout: 5000, force: true }); await page.waitForTimeout(900);
      } catch { notes.push("pick failed"); }
    }
    if (s.insight) {
      try {
        const card = page.locator("#insights li").filter({ hasText: "2020" }).first();
        await card.click({ timeout: 5000 }); await page.waitForTimeout(700);
        try { await card.getByText("Details").first().click({ timeout: 2000 }); } catch {}
        await page.waitForTimeout(500);
      } catch { notes.push("insight pick failed"); }
    }
    if (s.after) { await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); for (let i = 0; i < s.after; i++) await page.keyboard.press("ArrowRight"); await page.waitForTimeout(900); }
    if (s.menu === "select") { try { await page.locator("#top wa-select, #top select, header wa-dropdown").first().click({ timeout: 5000 }); await page.waitForTimeout(900); } catch { notes.push("menu open failed"); } }
    if (s.menu === "export") { try { await page.locator("#export [slot=trigger]").click({ timeout: 5000 }); await page.waitForTimeout(900); } catch { notes.push("export menu failed"); } }

    const file = `${out}/${s.id}.png`;
    if (s.download) {
      await page.locator("#export [slot=trigger]").click({ timeout: 5000 });
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.locator('#export wa-dropdown-item[value="png"]').click()]);
      await dl.saveAs(file);
    } else if (s.hover) {
      const host = page.locator("#g1 .chart-host:visible, #g1 svg:visible").first();
      const b = await host.boundingBox();
      for (const [k, f] of [["1", 0.35], ["2", 0.7]]) {
        await page.mouse.move(b.x + b.width * f, b.y + b.height * 0.5); await page.waitForTimeout(700);
        await page.locator("#g1").screenshot({ path: `${out}/${s.id}-${k}.png` });
      }
    } else if (s.crop === "fullpage") {
      await page.screenshot({ path: file, fullPage: true });
    } else if (s.crop === "viewport") {
      await page.screenshot({ path: file });
    } else if (s.crop === "top") {
      const el = page.locator("#top").first();
      let h = 240;
      if (await el.count()) { const b = await el.boundingBox(); if (b) h = Math.min(900, b.y + b.height + 16); }
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1440, height: h } });
    } else {
      const el = page.locator(s.crop).first();
      if (await el.count() && await el.isVisible()) await el.screenshot({ path: file });
      else { notes.push(`${s.crop} not visible, viewport instead`); await page.screenshot({ path: file }); }
    }
    log.push(`${s.id}\t${s.c}\tok${notes.length ? " (" + notes.join("; ") + ")" : ""}`);
  } catch (e) {
    log.push(`${s.id}\t${s.c}\tFAILED: ${String(e.message || e).split("\n")[0]}`);
  }
  await ctx.close();
}
await browser.close();
fs.appendFileSync(`${out}/capture-log.tsv`, log.join("\n") + "\n");
console.log(log.join("\n"));
