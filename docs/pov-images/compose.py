"""Before / after pairs for the compact POV: one image per suggestion, labelled, cropped to a sane height."""
from PIL import Image, ImageDraw, ImageFont
import os, sys
here = os.path.dirname(os.path.abspath(__file__)); out = os.path.join(here, "compact"); os.makedirs(out, exist_ok=True)
F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
PAIRS = {  # block: (left, right, left label, right label)
    "01-overview": ("5.1a", "5.1b", "Before", "After"),
    "02-sentence": ("5.2a", "5.2b", "Before", "After"),
    "03-pick": ("5.3a-1", "5.3b-1", "Before: hovering changes the sentence", "After: hovering only highlights"),
    "04-databar": ("5.4a", "5.4c", "Before", "After"),
    "05-beads": ("5.5a", "5.5b", "Before: the demo (cell 14)", "After"),
    "06-insights": ("5.7a", "5.7b", "Before", "After"),
    "07-frequency": ("5.9a", "5.9b", "Before: numbers per band", "After"),
    "08-ring": ("5.10a", "5.10b", "Before: the demo (cell 19)", "After"),
    "09-quadrants": ("5.13a", "5.13b", "Before", "After"),
    "10-netbars": ("5.14a", "5.14c", "Before: the demo (cell 17)", "After"),
    "11-heatmap": ("5.15a-1", "5.15b", "Before: the demo (cell 18)", "After"),
    "12-colour": ("5.18a", "5.18c", "Before", "After"),
    "13-controls": ("5.20b", "5.20c-1", "Before", "After"),
    "14-figures": ("5.21a", "5.21b", "Before", "After: the downloaded figure"),
    "15-motion": ("5.22-1", "5.22-2", "Week of 20 Mar 2020", "Four weeks later, stepped with →"),
}
W, GAP, LAB = 1872, 36, 46
def load(i): return Image.open(os.path.join(here, i + ".png")).convert("RGB")
def label(img, text):
    c = Image.new("RGB", (img.width, img.height + LAB), "white"); c.paste(img, (0, LAB))
    ImageDraw.Draw(c).text((0, 8), text, fill=(90, 90, 90), font=F); return c
for name, (a, b, la, lb) in PAIRS.items():
    A, B = load(a), load(b)
    if A.height / A.width < 0.3 and B.height / B.width < 0.3:
        ims = []
        for im, t in ((A, la), (B, lb)):
            im = im.resize((W, round(im.height * W / im.width))); ims.append(label(im, t))
        canvas = Image.new("RGB", (W, sum(i.height for i in ims) + GAP), "white"); y = 0
        for i in ims: canvas.paste(i, (0, y)); y += i.height + GAP
    else:
        pw = (W - GAP) // 2; ims = []
        for im, t in ((A, la), (B, lb)):
            im = im.resize((pw, round(im.height * pw / im.width)))
            im = im.crop((0, 0, pw, min(im.height, round(pw * 0.95))))
            ims.append(label(im, t))
        h = max(i.height for i in ims); canvas = Image.new("RGB", (W, h), "white")
        canvas.paste(ims[0], (0, 0)); canvas.paste(ims[1], (pw + GAP, 0))
    canvas.save(os.path.join(out, name + ".png"), optimize=True); print(name, canvas.size)
