// Copies the Python an uploaded file runs through into public/py/: the pinned library, untouched
// from the submodule (vendor/PyConnectedness, commit 4cc953f), and pipeline/compute.py, the same
// file that builds the public datasets. Nothing is edited on the way; public/py/ isn't committed.
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(app, "..");
const lib = join(root, "vendor", "PyConnectedness", "src", "pyconnectedness");
const out = join(app, "public", "py");

if (!existsSync(join(lib, "__init__.py"))) {
  throw new Error("vendor/PyConnectedness is empty: run `git submodule update --init` first");
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(lib, join(out, "pyconnectedness"), { recursive: true, filter: (p) => !p.includes("__pycache__") });
cpSync(join(root, "pipeline", "compute.py"), join(out, "compute.py"));

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".py")) files.push(relative(out, p).split("\\").join("/"));
  }
};
walk(out);
let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: join(root, "vendor", "PyConnectedness") }).toString().trim();
} catch {
  /* not a git checkout: the files are still the submodule's */
}
writeFileSync(join(out, "manifest.json"), JSON.stringify({ commit, version: "0.1.0", files }, null, 1));
console.log(`public/py: ${files.length} files, PyConnectedness ${commit}`);
