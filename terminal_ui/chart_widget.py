"""
StockOracle Pro — Terminal Chart Widget (Plotext ASCII Candlesticks)
Renders high-definition financial candlestick charts and Volume Profile directly in console.
"""
import pandas as pd
import numpy as np
import plotext as plt
from rich.text import Text
from rich.panel import Panel



def render_ascii_candlestick_chart(df: pd.DataFrame, symbol: str, width: int = 70, height: int = 15) -> str:
    """
    Renders an ASCII candlestick chart with OHLC data and Volume bars using plotext.
    Returns plain ANSI string.
    """
    if df is None or df.empty or len(df) < 5:
        return f"[dim]No historical chart data available for {symbol}[/dim]"

    # Take last 30 bars to keep chart crisp in terminal
    sub_df = df.tail(30).copy().reset_index(drop=True)
    
    dates = [str(d)[-5:] for d in sub_df["date"].values] if "date" in sub_df.columns else [str(i) for i in range(len(sub_df))]
    opens = sub_df["open"].astype(float).tolist()
    highs = sub_df["high"].astype(float).tolist()
    lows = sub_df["low"].astype(float).tolist()
    closes = sub_df["close"].astype(float).tolist()

    if hasattr(plt, "clear_data"):
        plt.clear_data()
    elif hasattr(plt, "cld"):
        plt.cld()
    plt.plotsize(width, height)
    plt.theme("dark")

    plt.candlestick(dates, {
        "Open": opens,
        "Close": closes,
        "High": highs,
        "Low": lows
    })

    plt.title(f"📈 {symbol} — DAILY CANDLESTICK CHART & VOLUME (LAST 30 BARS)")
    return plt.build()


def render_ascii_volume_profile(df: pd.DataFrame, bins: int = 10, width: int = 60) -> str:
    """
    Generates a horizontal Volume Profile (VPVR) price distribution bar chart.
    """
    if df is None or df.empty or "close" not in df.columns or "volume" not in df.columns:
        return "[dim]Volume profile data unavailable[/dim]"

    sub_df = df.tail(60).copy()
    closes = sub_df["close"].astype(float).values
    volumes = sub_df["volume"].astype(float).values

    min_p, max_p = np.min(closes), np.max(closes)
    if min_p == max_p:
        return "[dim]Insufficient price variation for volume profile[/dim]"

    bin_edges = np.linspace(min_p, max_p, bins + 1)
    bin_vols = np.zeros(bins)

    for c, v in zip(closes, volumes):
        idx = min(int((c - min_p) / (max_p - min_p + 1e-9) * bins), bins - 1)
        bin_vols[idx] += v

    max_v = max(bin_vols) if max(bin_vols) > 0 else 1.0
    lines = []
    lines.append("📊 HORIZONTAL VOLUME PROFILE (VPVR — POINT OF CONTROL)")
    lines.append("───────────────────────────────────────────────────────")
    poc_idx = int(np.argmax(bin_vols))

    for i in range(bins - 1, -1, -1):
        price_lvl = (bin_edges[i] + bin_edges[i + 1]) / 2.0
        bar_len = int((bin_vols[i] / max_v) * 28)
        bar = "█" * bar_len
        poc_tag = " ◄ POC (Point of Control)" if i == poc_idx else ""
        lines.append(f"₹{price_lvl:>7.1f} │ {bar:<28} {poc_tag}")

    return "\n".join(lines)
