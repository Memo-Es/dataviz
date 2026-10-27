// Checks graph 1's insights (src/charts/insights.ts) on every dataset the app ships and on
// synthetic uploads of known shapes (fixtures/insights, written by pipeline/insight_fixtures.py).
//   1. Every number a card prints is recomputed here from the library's values.
//   2. Each synthetic shape gets the story it was built to tell, and no story it wasn't.
// Run: npm run check:insights (Node 22+, which reads the TypeScript directly).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findInsights } from "../src/charts/insights.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(here, "../public/data");
const FIX = path.join(here, "fixtures/insights");

const cases = [];
for (const ds of JSON.parse(fs.readFileSync(path.join(PUB, "datasets.json"), "utf8"))) {
  const m = JSON.parse(fs.readFileSync(path.join(PUB, ds.dir, "connectedness.json"), "utf8"));
  for (const measure of Object.keys(m.dynamic)) {
    cases.push({ name: `${ds.id}/${measure}`, dyn: m.dynamic[measure], longRun: m.static[measure].full.total, steps: ds.steps, items: ds.items });
  }
}
for (const f of fs.readdirSync(FIX).filter((f) => f.endsWith(".json")).sort()) {
  const u = JSON.parse(fs.readFileSync(path.join(FIX, f), "utf8"));
  cases.push({ name: `upload:${u.name}`, dyn: u.dynamic, longRun: u.longRun, steps: u.steps, items: "series" });
}

const isMove = (x) => /^Spillover (rose|jumped|fell|dropped) /.test(x.title);
const points = (x) => +x.title.match(/ ([\d.]+) points/)[1];
const rises = (ins) => ins.filter((x) => isMove(x) && x.icon === "jump");
const falls = (ins) => ins.filter((x) => isMove(x) && x.icon === "drop");
const text = (x) => `${x.title} ${x.body} ${x.more ?? ""}`; // the folded details are checked too

// what each synthetic shape must (and must not) say
const expect = {
  "upload:calm": (ins) => [
    [!ins.some((x) => /jumped|dropped/.test(x.title)), "no sharp moves in unrelated series"],
    [ins.some((x) => text(x).includes("No window passed")), "says spillover stays low"],
  ],
  "upload:one-shock": (ins) => [
    [rises(ins).some((x) => points(x) >= 10), "the shock's rise"],
    [falls(ins).some((x) => /window moving on/.test(text(x))), "its fall explained as the window moving on"],
  ],
  "upload:daily-2shock": (ins) => [[rises(ins).length >= 2, "both shocks"]],
  "upload:monthly-min": (ins) => [[ins.length >= 3, "a short monthly file still gets cards"]],
  "upload:many-15": (ins) => [[rises(ins).some((x) => points(x) >= 40), "the slow rise"]],
  "upload:regime-up": (ins) => [
    [rises(ins).some((x) => points(x) >= 50), "the shift up"],
    [falls(ins).length === 0, "no fall"],
  ],
  "upload:regime-down": (ins) => [
    [falls(ins).some((x) => points(x) >= 50), "the shift down"],
    [!ins.some((x) => /window moving on/.test(text(x))), "a real fall, not the window"],
  ],
  "upload:always-high": (ins) => [[!ins.some((x) => isMove(x) && points(x) > 6), "no big moves in a steady series"]],
  // the authors' demo: the COVID crash, and its exit from the window 198 weeks later
  "stocks/returns": (ins, dyn) => {
    const covid = dyn.dates.indexOf("2020-03-20");
    return [
      [ins.some((x) => x.t === covid && x.icon === "jump"), "the COVID jump at 20 Mar 2020"],
      [ins.some((x) => x.icon === "drop" && text(x).includes(`{date:${covid}} leaving`)), "its exit from the window"],
    ];
  },
};

let failed = 0;
for (const c of cases) {
  const { dyn } = c;
  const v = dyn.total;
  const T = v.length;
  const W = dyn.window;
  const k = Math.max(2, Math.round(W / 50));
  const L = W - (dyn.lags || 0);
  const ins = findInsights(dyn, c.longRun, c.steps, c.items);
  const errs = [];
  const near = (a, b, what) => Math.abs(a - b) <= 0.051 || errs.push(`${what}: printed ${a}, data ${b.toFixed(2)}`);

  if (ins.length < 2 || ins.length > 6) errs.push(`${ins.length} cards`);
  ins.forEach((x, i) => {
    if (x.body.length > 200) errs.push(`card ${i + 1}'s line runs ${x.body.length} characters: fold more under Details`);
    if (i && x.t <= ins[i - 1].t) errs.push(`cards not in date order, or two at one step (${x.t})`);
    for (const [, t] of `${x.body} ${x.more ?? ""}`.matchAll(/\{date:(\d+)\}/g)) if (+t < 0 || +t >= T) errs.push(`date ${t} out of range`);
    const s = text(x);
    // From A% at a to B% at b, and the points between them
    const fm = s.match(/From ([\d.]+)% at \{date:(\d+)\} to ([\d.]+)% at \{date:(\d+)\}/);
    if (fm) {
      const [a, b] = [+fm[2], +fm[4]];
      near(+fm[1], v[a], "swing start");
      near(+fm[3], v[b], "swing end");
      near(points(x), Math.abs(v[b] - v[a]), "swing size");
      if ((x.icon === "jump") !== v[b] > v[a]) errs.push("rise/fall the wrong way");
      const up = x.icon === "jump";
      const m = dyn.from[b].filter((y, i) => (up ? y > dyn.from[a][i] : y < dyn.from[a][i])).length;
      if (/took in/.test(s)) {
        const said = s.match(/All (\d+) \D/) ? dyn.from[b].length : +(s.match(/(\d+) of \d+ /) || [])[1];
        if (said !== m) errs.push(`breadth: said ${said}, data ${m}`);
      }
      // the k steps that carried it
      const km = s.match(/[+−]([\d.]+)(?: of it in the \d+ \w+ to|, to) \{date:(\d+)\}/);
      if (km) near(+km[1], Math.abs(v[+km[2]] - v[+km[2] - k]), "sharpest stretch");
      // a window echo: the steps leaving are the steps that came in L steps earlier
      const em = s.match(/to \{date:(\d+)\}\..*?That is the \d+ \w+ to \{date:(\d+)\} leaving .*?added \+(\d+\.\d)/);
      if (em) {
        if (+em[1] - +em[2] !== L) errs.push(`echo ${+em[1] - +em[2]} steps back, not ${L}`);
        near(+em[3], v[+em[2]] - v[+em[2] - k], "echo rise");
      }
      const wm = s.match(/Meanwhile \{date:(\d+)\} to \{date:(\d+)\} left the .*?added (\d+\.\d) points/);
      if (wm) {
        if (+fm[2] - +wm[1] !== L || +fm[4] - +wm[2] !== L) errs.push("window echo not L steps back");
        near(+wm[3], v[+wm[2]] - v[+wm[1]], "window echo rise");
      }
    }
    if (x.icon === "peak") near(+x.title.match(/([\d.]+)%/)[1], Math.max(...v), "peak");
  });
  // the peak is told once, as its own card or as the end (or start) of a move
  const peakTold = ins.filter((x) => x.icon === "peak" || /its peak/.test(x.title)).length;
  if (peakTold < 1) errs.push("peak not told");
  // the last card: where the latest window sits among all of them
  // (its own card, or the end of a move that ends at the latest step)
  const lv = text(ins[ins.length - 1]);
  if (ins[ins.length - 1].t !== T - 1) errs.push("no card for the latest step");
  near(+lv.match(/Now ([\d.]+)%/)[1], v[T - 1], "now");
  const below = v.filter((y) => y < v[T - 1]).length / T;
  if (+lv.match(/Now [\d.]+%[:,] higher than (\d+)%/)[1] !== Math.round(below * 100)) errs.push("rank");
  const above = v.filter((y) => y > c.longRun).length / T;
  if (lv.includes("sit above the full-sample") !== (above >= 0.1 && above <= 0.9)) errs.push("full-sample comparison where it doesn't hold");

  for (const [ok, what] of expect[c.name]?.(ins, dyn) || []) if (!ok) errs.push(`expected: ${what}`);
  console.log(`${errs.length ? "FAIL" : "ok  "} ${c.name.padEnd(22)} ${ins.length} cards`);
  for (const e of errs) console.log(`       ${e}`);
  failed += errs.length ? 1 : 0;
}
if (failed) {
  console.error(`\n${failed} of ${cases.length} cases failed`);
  process.exit(1);
}
console.log(`\nall ${cases.length} cases pass`);
