"""
Two helpers for the style guide's typography, matching the web explorer: Plus Jakarta Sans for
words (set by pyconnectedness.mplstyle) and B612 Mono for every number.

    from pcstyle import register_fonts, mono_numbers
    register_fonts()                      # after `python styleguide/get_fonts.py`
    plt.style.use("styleguide/pyconnectedness.mplstyle")
    ...plot...
    mono_numbers(ax)                      # tick values in B612 Mono

matplotlib has no rcParam for "tick labels in a different family", hence the helper.
"""
from __future__ import annotations

from pathlib import Path

import matplotlib.font_manager as fm

FONTS = Path(__file__).resolve().parent / "fonts"
NUMBERS = "B612 Mono"


def register_fonts() -> bool:
    """Add styleguide/fonts/*.ttf to matplotlib. False if they haven't been downloaded."""
    files = sorted(FONTS.glob("*.ttf")) if FONTS.exists() else []
    for f in files:
        fm.fontManager.addfont(str(f))
    return bool(files)


def mono_numbers(*axes, colorbars=()):
    """Set tick values (and colorbar ticks) in B612 Mono. Words stay in the sans."""
    for ax in list(axes) + [cb.ax for cb in colorbars]:
        try:  # matplotlib >= 3.8: survives redraws, e.g. date ticks regenerated at save time
            ax.tick_params(labelfontfamily=NUMBERS)
        except (TypeError, ValueError):  # the library allows matplotlib >= 3.6
            for label in ax.get_xticklabels() + ax.get_yticklabels():
                label.set_fontfamily(NUMBERS)


# B612 Mono gives "." a full cell (0.65 em, like every glyph), so 71.7 reads as "71. 7". The web
# explorer pulls the dot in by -0.05 em on its left and -0.3 em on its right (app/src/style.css
# .dp); this does the same for a matplotlib annotation.
_ADVANCE_EM = 0.65
_DOT_LEFT_EM, _DOT_RIGHT_EM = 0.05, 0.3


def mono_number(ax, xy, text, *, xytext=(0, 0), fontsize=12, **kwargs):
    """Annotate `text` (e.g. "71.7%") in B612 Mono at `xy`, left-aligned at offset `xytext`
    points, with the decimal point tightened. Extra kwargs go to `ax.annotate`."""
    kwargs = {"textcoords": "offset points", "ha": "left", "fontfamily": NUMBERS, **kwargs}
    head, dot, tail = text.partition(".")
    x0, y0 = xytext
    ax.annotate(head, xy, xytext=(x0, y0), fontsize=fontsize, **kwargs)
    if not dot:
        return
    adv = _ADVANCE_EM * fontsize
    x_dot = x0 + len(head) * adv - _DOT_LEFT_EM * fontsize
    ax.annotate(".", xy, xytext=(x_dot, y0), fontsize=fontsize, **kwargs)
    ax.annotate(tail, xy, xytext=(x_dot + adv - _DOT_RIGHT_EM * fontsize, y0), fontsize=fontsize, **kwargs)
