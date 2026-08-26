"""
StockOracle Pro — Terminal Chart Widget
Renders ASCII Candlestick charts and Volume Profile (VPVR) using plotext.
This module is version-safe — works with plotext 3.x, 4.x, and 5.x.
"""
import pandas as pd
import numpy as np


def _plotext_reset():
    """
    Version-safe plotext reset.
    plotext ≥ 5.3: clear_figure()
    plotext 5.x older: cld() or clear_data()
    plotext < 5:  theme_reset or no-op
    """
    try:
        import plotext as plt
        if hasattr(plt, "clear_figure"):
            plt.clear_figure()
        elif hasattr(plt, "cld"):
            plt.cld()
        elif hasattr(plt, "clear_data"):
            plt.clear_data()
    except Exception:
        pass


def _plotext_size(width: int, height: int):
    """Version-safe plotext plot size setter."""
    try:
        import plotext as plt
        if hasattr(plt, "plot_size"):
            plt.plot_size(width, height)
        elif hasattr(plt, "plotsize"):
            plt.plotsize(width, height)
        elif hasattr(plt, "set_size"):
            plt.set_size(width, height)
        # If none available, silently proceed (chart will use terminal default size)
    except Exception:
        pass


def _plotext_theme(theme: str):
    """Version-safe plotext theme setter."""
    try:
        import plotext as plt
        if hasattr(plt, "theme"):
            plt.theme(theme)
    except Exception:
        pass


def _plotext_build() -> str:
    """Version-safe plotext output builder."""
    try:
        import plotext as plt
        if hasattr(plt, "build"):
            return plt.build()
        elif hasattr(plt, "show"):
            # Some versions write directly; capture stdout
            import io, sys
            buf = io.StringIO()
            old_stdout = sys.stdout
            sys.stdout = buf
            plt.show()
            sys.stdout = old_stdout
            return buf.getvalue()
    except Exception:
        pass
    return "[dim]Chart render unavailable[/dim]"


def render_ascii_candlestick_chart(df: pd.DataFrame, symbol: str, width: int = 70, height: int = 15) -> str:
    """
    Renders an ASCII candlestick chart with OHLC data using plotext.
    Falls back gracefully if plotext is not installed or API is incompatible.
    Returns a plain ANSI/text string.
    """
    if df is None or df.empty or len(df) < 5:
        return f"[dim]No historical chart data available for {symbol}[/dim]"

    try:
        import plotext as plt

        # Take last 30 bars to keep chart crisp in terminal
        sub_df = df.tail(30).copy().reset_index(drop=True)

        dates = (
            [str(d)[-5:] for d in sub_df["date"].values]
            if "date" in sub_df.columns
            else [str(i) for i in range(len(sub_df))]
        )
        opens  = sub_df["open"].astype(float).tolist()
        highs  = sub_df["high"].astype(float).tolist()
        lows   = sub_df["low"].astype(float).tolist()
        closes = sub_df["close"].astype(float).tolist()

        _plotext_reset()
        _plotext_size(width, height)
        _plotext_theme("dark")

        plt.candlestick(dates, {"Open": opens, "Close": closes, "High": highs, "Low": lows})
        plt.title(f"  {symbol} — DAILY CANDLESTICK  (LAST 30 BARS)")

        return _plotext_build()

    except ImportError:
        return _fallback_ascii_chart(df, symbol)
    except Exception as e:
        return _fallback_ascii_chart(df, symbol)


def _fallback_ascii_chart(df: pd.DataFrame, symbol: str) -> str:
    """
    Pure-Python ASCII price chart — zero external dependencies.
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
    lines.append(f"  📈 {symbol} — ASCII SPARKLINE CHART (LAST 30 BARS)")
    lines.append("  " + "─" * 60)

    for row in range(rows, 0, -1):
        price = lo + (row / rows) * span
        bar   = ""
        for c in closes:
            if c >= price - (span / rows / 2):
                bar += "█"
            else:
                bar += " "
        price_label = f"₹{price:>7.1f}"
        lines.append(f"  {price_label} │ {bar}")

    lines.append("  " + "─" * 60)
    dates = [str(d)[-5:] for d in sub_df["date"].values] if "date" in sub_df.columns else []
    if dates:
        step  = max(1, len(dates) // 6)
        x_axis = "           " + "".join(
            d.ljust(step * 1) for i, d in enumerate(dates) if i % step == 0
        )
        lines.append(x_axis)

    lines.append(f"\n  ▲ High: ₹{hi:,.2f}   ▼ Low: ₹{lo:,.2f}   Last: ₹{closes[-1]:,.2f}")
    return "\n".join(lines)


def render_ascii_volume_profile(df: pd.DataFrame, bins: int = 10, width: int = 60) -> str:
    """
    Generates a horizontal Volume Profile (VPVR) price distribution bar chart.
    Entirely dependency-free — pure NumPy/string rendering.
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
    lines.append("  📊 HORIZONTAL VOLUME PROFILE (VPVR — POINT OF CONTROL)")
    lines.append("  " + "─" * 55)

    for i in range(bins - 1, -1, -1):
        price_lvl = (bin_edges[i] + bin_edges[i + 1]) / 2.0
        bar_len   = int((bin_vols[i] / max_v) * 28)
        bar       = "█" * bar_len
        poc_tag   = " ◄ POC" if i == poc_idx else ""
        lines.append(f"  ₹{price_lvl:>7.1f} │ {bar:<28}{poc_tag}")

    return "\n".join(lines)
