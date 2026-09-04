"""
StockOracle Pro — Terminal Chart Widget
Renders ASCII Candlestick charts and Volume Profile (VPVR) using plotext.
This module is version-safe — works with plotext 3.x, 4.x, 5.x (top-level API)
and 6.x (figure-object API), and degrades gracefully to a pure-Python ASCII
sparkline when plotext is missing or incompatible.
"""
import sys

import pandas as pd
import numpy as np


# ── plotext version dispatch ───────────────────────────────────────────────────
#
# plotext < 6 exposes a top-level procedural API:
#     plt.candlestick(dates, {"Open": ..., "Close": ..., "High": ..., "Low": ...})
#     plt.plot_size(w, h); plt.theme("dark"); plt.title(...); plt.build()
#
# plotext >= 6 is a rewrite: everything lives on the global figure object and
# build() returns a matrix, not a string:
#     fig = plotext.figure
#     fig.plot_size(w, h); fig.theme("dark")
#     fig.date().activate(form="%Y-%m-%d")
#     fig.candlestick({"date": ..., "open": ..., "close": ..., "high": ..., "low": ...})
#     fig.title(...); fig.build().string()


def _plotext_api():
    """Returns (api_object, is_v6) for the installed plotext.

    is_v6 == True  → operate on the figure object (plotext >= 6).
    is_v6 == False → operate on the top-level module (plotext 3.x–5.x).
    Raises ImportError if plotext is not installed.
    """
    import plotext as plt

    if hasattr(plt, "candlestick"):
        return plt, False
    return plt.figure, True


def _plotext_reset(api, is_v6):
    """Version-safe plotext reset of the current figure."""
    try:
        if is_v6:
            api.clear()
        elif hasattr(api, "clear_figure"):
            api.clear_figure()
        elif hasattr(api, "cld"):
            api.cld()
        elif hasattr(api, "clear_data"):
            api.clear_data()
    except Exception:
        pass


def _plotext_size(api, is_v6, width, height):
    """Version-safe plotext plot size setter."""
    try:
        if hasattr(api, "plot_size"):
            api.plot_size(width, height)
        elif hasattr(api, "plotsize"):
            api.plotsize(width, height)
        elif hasattr(api, "set_size"):
            api.set_size(width, height)
        # If none available, silently proceed (chart will use terminal default size)
    except Exception:
        pass


def _plotext_theme(api, is_v6, theme):
    """Version-safe plotext theme setter."""
    try:
        if hasattr(api, "theme"):
            api.theme(theme)
    except Exception:
        pass


def _plotext_dates(api, is_v6, dates):
    """Enables x-axis date interpretation for plotext >= 6 (required for candlestick).

    Legacy plotext treats string dates as labels automatically.
    """
    if not is_v6:
        return
    form = "%Y-%m-%d"
    if dates and " " in str(dates[0]):
        form = "%Y-%m-%d %H:%M:%S"
    try:
        api.date().activate(form=form)
    except Exception:
        pass


def _plotext_candlestick(api, is_v6, dates, opens, highs, lows, closes):
    """Version-safe candlestick plot call."""
    if is_v6:
        api.candlestick({
            "date": dates,
            "open": opens,
            "close": closes,
            "high": highs,
            "low": lows,
        })
    else:
        api.candlestick(dates, {"Open": opens, "Close": closes, "High": highs, "Low": lows})


def _plotext_build(api, is_v6) -> str:
    """Version-safe plotext output builder — always returns a string.

    plotext >= 6 build() returns a matrix object (use .string()).
    Legacy plotext build() returns a string; show() captures stdout as fallback.
    """
    if is_v6:
        try:
            out = api.build()
            if hasattr(out, "string"):
                return out.string()
            return str(out)
        except Exception:
            return ""
    try:
        if hasattr(api, "build"):
            return api.build()
        elif hasattr(api, "show"):
            # Some versions write directly; capture stdout
            import io
            buf = io.StringIO()
            old_stdout = sys.stdout
            sys.stdout = buf
            try:
                api.show()
            finally:
                sys.stdout = old_stdout
            return buf.getvalue()
    except Exception:
        pass
    return ""


# ── Console-encoding safety ────────────────────────────────────────────────────
#
# plotext output (and the older fallback headers) use Unicode box/block drawing
# characters and the rupee sign. On Windows consoles using cp1252 (the default
# for Python < 3.15 without PYTHONUTF8), printing those raises
# UnicodeEncodeError and kills the terminal app. We translate the common
# non-ASCII glyphs to ASCII equivalents and only degrade output when the
# console encoding cannot represent them — UTF-8 terminals keep the pretty
# box-drawing charts untouched.

_ASCII_TRANS = str.maketrans({
    # Box drawing (U+2500–U+257F)
    "│": "|", "┃": "|", "┆": "|", "┊": "|",
    "─": "-", "━": "-", "┄": "-", "┈": "-",
    "┌": "+", "┐": "+", "└": "+", "┘": "+",
    "├": "+", "┤": "+", "┬": "+", "┴": "+", "┼": "+",
    "═": "=", "║": "|",
    "╔": "+", "╗": "+", "╚": "+", "╝": "+",
    "╠": "+", "╣": "+", "╦": "+", "╩": "+", "╬": "+",
    # Block elements (U+2580–U+259F)
    "▄": "#", "▀": "#", "▌": "#", "▐": "#", "█": "#",
    "▖": "#", "▗": "#", "▘": "#", "▝": "#", "▚": "#", "▞": "#",
    "▛": "#", "▜": "#", "▙": "#", "▟": "#",
    # Geometric shapes & arrows
    "▲": "^", "△": "^", "▼": "v", "▽": "v",
    "◄": "<", "►": ">", "◀": "<", "▶": ">",
    # Misc symbols & punctuation
    "•": "*", "·": ".", "…": "...", "—": "-", "–": "-",
    "₹": "Rs",
})


def _console_safe(text: str) -> str:
    """Returns text that the current console encoding can print without error.

    UTF-8 / ASCII consoles get the original text back; limited encodings
    (e.g. cp1252) get Unicode glyphs translated to ASCII equivalents, with a
    final encode-with-replace as a safety net.
    """
    if not text:
        return text
    try:
        enc = sys.stdout.encoding or "utf-8"
    except Exception:
        enc = "utf-8"
    try:
        norm = enc.lower().replace("-", "").replace("_", "")
        if norm in ("utf8", "cp65001", "ascii"):
            return text
    except Exception:
        pass
    safe = text.translate(_ASCII_TRANS)
    try:
        return safe.encode(enc, errors="replace").decode(enc)
    except Exception:
        return safe


# ── Public renderers ───────────────────────────────────────────────────────────


def render_ascii_candlestick_chart(df: pd.DataFrame, symbol: str, width: int = 70, height: int = 15) -> str:
    """
    Renders an ASCII candlestick chart with OHLC data using plotext.
    Falls back gracefully if plotext is not installed or API is incompatible.
    Returns a plain ANSI/text string safe for the current console encoding.
    """
    if df is None or df.empty or len(df) < 5:
        return f"[dim]No historical chart data available for {symbol}[/dim]"

    try:
        import plotext as plt  # noqa: F401  (used to detect install)

        api, is_v6 = _plotext_api()

        # Take last 30 bars to keep chart crisp in terminal
        sub_df = df.tail(30).copy().reset_index(drop=True)

        full_dates = (
            [str(d) for d in sub_df["date"].values]
            if "date" in sub_df.columns
            else [str(i) for i in range(len(sub_df))]
        )
        # Legacy plotext uses the short label for axis ticks; plotext >= 6 needs
        # the full date string so its date converter can parse it.
        dates = full_dates if is_v6 else [d[-5:] for d in full_dates]

        opens  = sub_df["open"].astype(float).tolist()
        highs  = sub_df["high"].astype(float).tolist()
        lows   = sub_df["low"].astype(float).tolist()
        closes = sub_df["close"].astype(float).tolist()

        _plotext_reset(api, is_v6)
        _plotext_size(api, is_v6, width, height)
        _plotext_theme(api, is_v6, "dark")
        _plotext_dates(api, is_v6, full_dates)
        _plotext_candlestick(api, is_v6, dates, opens, highs, lows, closes)
        if hasattr(api, "title"):
            api.title(f"  {symbol} - DAILY CANDLESTICK  (LAST 30 BARS)")

        built = _plotext_build(api, is_v6)
        if built:
            return _console_safe(built)
    except ImportError:
        pass
    except Exception:
        pass

    return _fallback_ascii_chart(df, symbol)


def _fallback_ascii_chart(df: pd.DataFrame, symbol: str) -> str:
    """
    Pure-Python ASCII price chart — zero external dependencies, ASCII-only
    (safe on any console encoding).
    Renders a sparkline with OHLC summary when plotext is unavailable.
    """
    sub_df = df.tail(30).copy().reset_index(drop=True)
    closes = sub_df["close"].astype(float).values
    highs  = sub_df["high"].astype(float).values
    lows   = sub_df["low"].astype(float).values

    rows  = 10
    hi    = float(np.max(highs))
    lo    = float(np.min(lows))
    span  = hi - lo if hi != lo else 1.0

    lines = []
    lines.append(f"  {symbol} - ASCII SPARKLINE CHART (LAST 30 BARS)")
    lines.append("  " + "=" * 60)

    for row in range(rows, 0, -1):
        price = lo + (row / rows) * span
        bar   = ""
        for c in closes:
            if c >= price - (span / rows / 2):
                bar += "#"
            else:
                bar += " "
        price_label = f"Rs {price:>7.1f}"
        lines.append(f"  {price_label} | {bar}")

    lines.append("  " + "=" * 60)
    dates = [str(d)[-5:] for d in sub_df["date"].values] if "date" in sub_df.columns else []
    if dates:
        step  = max(1, len(dates) // 6)
        x_axis = "           " + "".join(
            d.ljust(step * 1) for i, d in enumerate(dates) if i % step == 0
        )
        lines.append(x_axis)

    lines.append(f"\n  High: Rs {hi:,.2f}   Low: Rs {lo:,.2f}   Last: Rs {closes[-1]:,.2f}")
    return "\n".join(lines)


def render_ascii_volume_profile(df: pd.DataFrame, bins: int = 10, width: int = 60) -> str:
    """
    Generates a horizontal Volume Profile (VPVR) price distribution bar chart.
    Entirely dependency-free — pure NumPy/string rendering, ASCII-only.
    """
    if df is None or df.empty or "close" not in df.columns or "volume" not in df.columns:
        return "[dim]Volume profile data unavailable[/dim]"

    sub_df  = df.tail(60).copy()
    closes  = sub_df["close"].astype(float).values
    volumes = sub_df["volume"].astype(float).values

    min_p, max_p = np.min(closes), np.max(closes)
    if min_p == max_p:
        return "[dim]Insufficient price variation for volume profile[/dim]"

    bin_edges = np.linspace(min_p, max_p, bins + 1)
    bin_vols  = np.zeros(bins)

    for c, v in zip(closes, volumes):
        idx = min(int((c - min_p) / (max_p - min_p + 1e-9) * bins), bins - 1)
        bin_vols[idx] += v

    max_v   = max(bin_vols) if max(bin_vols) > 0 else 1.0
    poc_idx = int(np.argmax(bin_vols))

    lines = []
    lines.append("  HORIZONTAL VOLUME PROFILE (VPVR - POINT OF CONTROL)")
    lines.append("  " + "=" * 55)

    for i in range(bins - 1, -1, -1):
        price_lvl = (bin_edges[i] + bin_edges[i + 1]) / 2.0
        bar_len   = int((bin_vols[i] / max_v) * 28)
        bar       = "#" * bar_len
        poc_tag   = "  <- POC" if i == poc_idx else ""
        lines.append(f"  Rs {price_lvl:>7.1f} | {bar:<28}{poc_tag}")

    return _console_safe("\n".join(lines))