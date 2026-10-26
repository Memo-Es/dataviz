/// <reference lib="webworker" />
/**
 * Runs an uploaded CSV through PyConnectedness inside the browser: Pyodide (CPython compiled to
 * WebAssembly) with the library's own dependencies, the pinned library copied unchanged from the
 * submodule, and pipeline/compute.py, the file that builds the public datasets. The file never
 * leaves the computer.
 */
const PYODIDE_URL: string = import.meta.env.VITE_PYODIDE_URL ?? "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";

export interface RunRequest {
  text: string;
  kind: "levels" | "changes";
  name: string;
  pyBase: string;
}

export type RunMessage =
  | { type: "stage"; text: string }
  | { type: "done"; meta: string; cube: ArrayBuffer; step: "day" | "week" | "month"; window: number; commit: string }
  | { type: "error"; text: string };

const post = (m: RunMessage, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ready: Promise<{ py: any; commit: string }> | null = null;

function boot(pyBase: string) {
  ready ??= (async () => {
    post({ type: "stage", text: "Starting Python in your browser" });
    const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
    const py = await loadPyodide({ indexURL: PYODIDE_URL });
    post({ type: "stage", text: "Loading the library's dependencies: numpy, pandas, statsmodels, networkx, matplotlib" });
    await py.loadPackage(["numpy", "pandas", "statsmodels", "networkx", "matplotlib"]);
    const manifest = await fetch(`${pyBase}manifest.json`).then((r) => r.json());
    post({ type: "stage", text: `Loading PyConnectedness ${manifest.version} (commit ${manifest.commit})` });
    for (const f of manifest.files as string[]) {
      const src = await fetch(`${pyBase}${f}`).then((r) => r.text());
      const path = `/pc/${f}`;
      py.FS.mkdirTree(path.slice(0, path.lastIndexOf("/")));
      py.FS.writeFile(path, src);
    }
    // the library reads its own version from its install metadata (importlib.metadata)
    py.FS.mkdirTree(`/pc/pyconnectedness-${manifest.version}.dist-info`);
    py.FS.writeFile(
      `/pc/pyconnectedness-${manifest.version}.dist-info/METADATA`,
      `Metadata-Version: 2.1\nName: pyconnectedness\nVersion: ${manifest.version}\n`
    );
    await py.runPythonAsync(`
import os, sys
os.environ["MPLBACKEND"] = "Agg"  # the library imports matplotlib; there's no screen in a worker
sys.path.insert(0, "/pc")
import compute
`);
    return { py, commit: manifest.commit as string };
  })();
  return ready;
}

self.onmessage = async (ev: MessageEvent<RunRequest>) => {
  const { text, kind, name, pyBase } = ev.data;
  try {
    const { py, commit } = await boot(pyBase);
    post({ type: "stage", text: "Running static_connectedness, dynamic_connectedness and frequency_connectedness" });
    py.globals.set("UPLOAD_TEXT", text);
    py.globals.set("UPLOAD_KIND", kind);
    py.globals.set("UPLOAD_NAME", name);
    const res = await py.runPythonAsync(`
_meta, _cube, _step, _window = compute.run_upload(UPLOAD_TEXT, UPLOAD_KIND, UPLOAD_NAME)
open("/tmp/cube.f32", "wb").write(_cube)
(_meta, _step, _window)
`);
    const [meta, step, window] = res.toJs();
    res.destroy();
    const bytes: Uint8Array = py.FS.readFile("/tmp/cube.f32");
    const cube = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    post({ type: "done", meta, cube, step, window, commit }, [cube]);
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    // a PythonError's message is the whole traceback: the last line is the reason
    const last = msg.trim().split("\n").filter(Boolean).pop() ?? msg;
    post({ type: "error", text: last.replace(/^\w+Error: /, "") });
  }
};
