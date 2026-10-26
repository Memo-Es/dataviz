/**
 * Your own file: run it through the library in a worker (worker.ts), keep the result in this
 * browser (IndexedDB, so the page can reload into it at ?d=upload), and describe it to the page
 * the way data/datasets.json describes a public dataset.
 */
import type { ConnectednessMeta, Dataset, ExplorerData } from "../data";
import type { RunMessage, RunRequest } from "./worker";

export interface UploadRecord {
  name: string;
  kind: "levels" | "changes";
  step: "day" | "week" | "month";
  window: number;
  commit: string;
  meta: string;
  cube: ArrayBuffer;
}

let worker: Worker | null = null;

export function runUpload(
  text: string,
  name: string,
  kind: UploadRecord["kind"],
  onStage: (text: string) => void
): Promise<UploadRecord> {
  worker ??= new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const w = worker;
  return new Promise((resolve, reject) => {
    w.onmessage = (ev: MessageEvent<RunMessage>) => {
      const m = ev.data;
      if (m.type === "stage") onStage(m.text);
      else if (m.type === "error") reject(new Error(m.text));
      else resolve({ name, kind, step: m.step, window: m.window, commit: m.commit, meta: m.meta, cube: m.cube });
    };
    w.onerror = (ev) => reject(new Error(ev.message || "The worker stopped"));
    const pyBase = new URL(`${import.meta.env.BASE_URL}py/`, location.href).href;
    w.postMessage({ text, kind, name, pyBase } satisfies RunRequest);
  });
}

const DB = "pc-explorer";
const STORE = "upload";

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveUpload(rec: UploadRecord): Promise<void> {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec, "current");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadUpload(): Promise<{ ds: Dataset; data: ExplorerData; rec: UploadRecord } | null> {
  try {
    const d = await db();
    const rec = await new Promise<UploadRecord | undefined>((resolve, reject) => {
      const req = d.transaction(STORE).objectStore(STORE).get("current");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!rec) return null;
    const meta = JSON.parse(rec.meta) as ConnectednessMeta;
    const group = "Your file";
    const ds: Dataset = {
      id: "upload",
      dir: "",
      title: rec.name,
      headline: rec.name,
      items: "series",
      item: "series",
      source: "your file",
      api: "",
      api_url: "",
      step: rec.step,
      steps: `${rec.step}s`,
      series: rec.kind === "levels" ? "% change per " + rec.step : "values as given",
      built_by: "PyConnectedness, run in your browser",
      measures: { returns: rec.kind === "levels" ? "% changes" : "Values" },
      episodes: {},
      groups: Object.fromEntries(meta.names.map((n) => [n, group])),
      group_order: [group],
      labels: {},
    };
    const data: ExplorerData = {
      meta,
      k: meta.names.length,
      pairwise: { returns: new Float32Array(rec.cube), volatility: new Float32Array(0) },
    };
    return { ds, data, rec };
  } catch {
    return null; // storage blocked or cleared: the page falls back to a public dataset
  }
}
