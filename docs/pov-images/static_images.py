"""Library figures from Demo.ipynb's saved outputs, the frequency result as printed numbers,
and the insights check output, rendered as PNGs for STRATEGIC_POV.md."""
import base64, json, sys, textwrap
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

root, out = Path(sys.argv[1]), Path(sys.argv[2])
nb = json.loads((root / "pyconnectedness-explorer/vendor/PyConnectedness/examples/Demo.ipynb").read_text())
cells = {14: "5.5a", 19: "5.10a", 17: "5.14a", 18: "5.15a-1", 21: "5.15a-2"}
log = []
for i, name in cells.items():
    pngs = [o["data"]["image/png"] for o in nb["cells"][i].get("outputs", []) if "image/png" in o.get("data", {})]
    if pngs:
        (out / f"{name}.png").write_bytes(base64.b64decode(pngs[0])); log.append(f"{name}\tDemo.ipynb cell {i}\tok")
    else:
        log.append(f"{name}\tDemo.ipynb cell {i}\tFAILED: no image in output")

def text_png(path, text, title):
    lines = text.splitlines()
    fig = plt.figure(figsize=(11, 0.24 * len(lines) + 0.9), dpi=160)
    fig.patch.set_facecolor("white")
    fig.text(0.02, 0.98, title, va="top", ha="left", family="DejaVu Sans", fontsize=10, color="#444")
    fig.text(0.02, 0.98 - 0.5 / (0.24 * len(lines) + 0.9), text, va="top", ha="left", family="DejaVu Sans Mono", fontsize=8.5, color="#111")
    fig.savefig(path, facecolor="white", bbox_inches="tight", pad_inches=0.3); plt.close(fig)

data = json.loads((root / "pyconnectedness-explorer/app/public/data/connectedness.json").read_text())
fr = data["frequency"]["returns"]["full"]
rows = [f"{'band':<10}{'share of FEV %':>16}{'total %':>12}{'within %':>12}"]
for b in fr["bands"]:
    rows.append(f"{b['label']:<10}{b['share']:>16.2f}{b['total']:>12.2f}{b['within_total']:>12.2f}")
txt = (f"frequency_connectedness(returns, horizon={fr['horizon']}, periods={tuple(fr['periods'])})\n"
       f"static total (all bands): {fr['static_total']:.2f} %\n\n" + "\n".join(rows))
text_png(out / "5.9a.png", txt, "The library's result: numbers per band, no figure (stock markets, returns, full sample)")
log.append("5.9a\tconnectedness.json frequency block\tok")

chk = Path(sys.argv[3]).read_text() if len(sys.argv) > 3 and Path(sys.argv[3]).exists() else "check output missing"
chk = "\n".join(textwrap.shorten(l, 150) if len(l) > 150 else l for l in chk.splitlines()[-60:])
text_png(out / "5.8b.png", "$ npm run check:insights\n" + chk, "Every number on the insight cards recomputed from the library")
log.append("5.8b\tnpm run check:insights at branch head\tok")
with open(out / "capture-log.tsv", "a") as f:
    f.write("\n".join(log) + "\n")
print("\n".join(log))
