"""
Download the style guide's fonts into styleguide/fonts/ (gitignored): Plus Jakarta Sans 400-700
for words, B612 Mono 400/700 for numbers -- the same pair the web explorer uses. Both are SIL
Open Font License 1.1, served by Google Fonts. Run once per machine:

    python styleguide/get_fonts.py
"""
from __future__ import annotations

import re
import urllib.request
from pathlib import Path

CSS = (
    "https://fonts.googleapis.com/css2?"
    "family=Plus+Jakarta+Sans:wght@400;500;600;700&family=B612+Mono:wght@400;700"
)
OUT = Path(__file__).resolve().parent / "fonts"


def main():
    OUT.mkdir(exist_ok=True)
    # no browser user agent -> Google Fonts answers with plain TTF URLs, which matplotlib reads
    css = urllib.request.urlopen(CSS).read().decode()
    faces = re.findall(r"font-family: '([^']+)';.*?font-weight: (\d+);.*?url\(([^)]+)\)", css, re.S)
    for family, weight, url in faces:
        path = OUT / f"{family.replace(' ', '')}-{weight}.ttf"
        path.write_bytes(urllib.request.urlopen(url).read())
        print("wrote", path)


if __name__ == "__main__":
    main()
