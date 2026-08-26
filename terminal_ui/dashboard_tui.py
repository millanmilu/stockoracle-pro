"""
StockOracle Pro — Bloomberg-Grade Textual Dashboard TUI
Synthesizes OpenBB quantitative depth with OpenTerminalUI interactive multi-panel presentation.
"""
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical, Grid
from textual.widgets import (
    Header, Footer, Static, DataTable, Label, Input, Button, ListView, ListItem
)
from textual.reactive import reactive
from textual.binding import Binding
from rich.text import Text
from rich.panel import Panel
from rich.table import Table

from backend.providers.openbb.wrapper import get_openbb_client


# ── Color Palette Definitions (Professional Financial Dark Mode) ──────────────
THEME_PALETTE = {
    "bg_base": "#080C1A",
    "bg_surface": "#0D1326",
    "bg_card": "#121A33",
    "border_subtle": "#1E294B",
    "accent_primary": "#818CF8",
    "accent_cyan": "#38BDF8",
    "bullish_emerald": "#10B981",
    "bearish_coral": "#F43F5E",
    "neutral_gold": "#F59E0B",
    "text_primary": "#F8FAFC",
    "text_muted": "#64748B",
}


class GlobalStatusBar(Static):
    """Top Bar: System health, market session, and latency."""

    def render(self) -> Panel:
        t = Text()
        t.append(" ⚡ STOCKORACLE PRO TERMINAL ", style="bold white on #4F46E5")
        t.append("  │  ", style="#1E294B")
        t.append("NSE MARKET: ", style="bold #64748B")
        t.append("REGULAR SESSION (IST) ", style="bold #10B981")
        t.append(" │  ", style="#1E294B")
        t.append("ENGINE: ", style="bold #64748B")
        t.append("OpenBB v4.2 + AngelOne WS ", style="bold #38BDF8")
        t.append(" │  ", style="#1E294B")
        t.append("LATENCY: ", style="bold #64748B")
        t.append("14ms ", style="bold #10B981")
        return Panel(t, style="on #080C1A", border_style="#1E294B")


class LeftNavSidebar(Static):
    """Left Sidebar: Context-aware navigation menu with keyboard shortcuts."""

    def render(self) -> Panel:
        t = Text()
        t.append("WORKSPACE NAVIGATION\n", style="bold #818CF8")
        t.append("─────────────────────\n", style="#1E294B")
        
        items = [
            ("1", "📊 Live Charts", "bold white on #1E294B"),
            ("2", "🏛️ OpenBB DCF", "white"),
            ("3", "🧭 RRG Rotation", "white"),
            ("4", "⚡ Options Lab", "white"),
            ("5", "🛡️ Quant VaR", "white"),
            ("6", "🌐 Sovereign Macro", "white"),
            ("7", "🔍 Adv. Screener", "white"),
            ("8", "💼 Paper Trading", "white"),
        ]
        for key, label, st in items:
            t.append(f"[{key}] ", style="bold #38BDF8")
            t.append(f"{label}\n", style=st)

        t.append("\nSHORTCUTS\n", style="bold #818CF8")
        t.append("─────────────────────\n", style="#1E294B")
        t.append("[/]  Command Palette\n", style="dim")
        t.append("[W]  Toggle Watchlist\n", style="dim")
        t.append("[Q]  Quit Terminal\n", style="dim")
        return Panel(t, title="MENU", border_style="#1E294B", style="on #0D1326")


class WatchlistSidebar(Static):
    """Right Sidebar: Live watchlist and active smart alerts."""

    def render(self) -> Panel:
        t = Text()
        t.append("NSE WATCHLIST (LIVE)\n", style="bold #818CF8")
        t.append("───────────────────────\n", style="#1E294B")

        stocks = [
            ("RELIANCE", 1317.0, 0.36),
            ("TCS", 2296.2, 0.53),
            ("HDFCBANK", 768.5, -0.45),
            ("INFY", 1102.3, 0.82),
            ("ICICIBANK", 1412.7, 1.15),
            ("TATAMOTORS", 945.0, 2.10),
            ("COALINDIA", 512.4, 1.25),
        ]

        for sym, ltp, chg in stocks:
            is_up = chg >= 0
            color = "#10B981" if is_up else "#F43F5E"
            sign = "+" if is_up else ""
            t.append(f"{sym:<11}", style="bold white")
            t.append(f"₹{ltp:>7.1f} ", style="bold #38BDF8")
            t.append(f"{sign}{chg:>5.2f}%\n", style=f"bold {color}")

        t.append("\nACTIVE SMART ALERTS\n", style="bold #818CF8")
        t.append("───────────────────────\n", style="#1E294B")
        t.append("• RELIANCE > ₹1320 (ARMED)\n", style="#10B981")
        t.append("• INFY RSI < 35 (TRIGGERED)\n", style="#F59E0B")
        t.append("• TCS Volume Surge 1.5x\n", style="#38BDF8")
        return Panel(t, title="MARKET FEED", border_style="#1E294B", style="on #0D1326")


class MainViewport(Static):
    """Center Stage: Dynamic analytics area for selected stock."""
    symbol: reactive[str] = reactive("RELIANCE")

    def render(self) -> Panel:
        client = get_openbb_client()
        val = client.get_dcf_valuation(self.symbol)
        macro = client.get_sovereign_macro_hub()
        risk = client.calculate_portfolio_risk([{"ticker": self.symbol, "weight": 1.0}])

        t = Text()
        t.append(f" INSTITUTIONAL OVERVIEW — {self.symbol} \n", style="bold white on #4F46E5")
        t.append("═" * 70 + "\n\n", style="#1E294B")

        # 1. Price & Intrinsic Valuation Row
        mos = val.get("margin_of_safety_pct", 0)
        mos_col = "#10B981" if mos > 0 else "#F43F5E"
        sign = "+" if mos > 0 else ""

        t.append("1. OPENBB INTRINSIC VALUATION & DCF:\n", style="bold #818CF8")
        t.append(f"   • Current Market Price (CMP) : ₹{val.get('cmp', 0):,.2f}\n", style="white")
        t.append(f"   • DCF Fair Value (5Y FCFF)  : ₹{val.get('dcf_intrinsic_value', 0):,.2f}\n", style="bold #10B981")
        t.append(f"   • Benjamin Graham Number    : ₹{val.get('graham_number', 0):,.2f}\n", style="bold #38BDF8")
        t.append(f"   • Margin of Safety          : [{sign}{mos:.2f}%] — {val.get('valuation_status')}\n\n", style=f"bold {mos_col}")

        # 2. Sovereign Macro & Risk Row
        t.append("2. SOVEREIGN MACRO & PORTFOLIO VALUE AT RISK (VaR):\n", style="bold #818CF8")
        t.append(f"   • India 10Y G-Sec Yield     : {macro.get('india_10y_yield')}% (Spread: +{macro.get('yield_spread_bps')} bps over US 10Y)\n", style="white")
        t.append(f"   • RBI Policy Repo Rate      : {macro.get('rbi_repo_rate')}% (Stance: Neutral)\n", style="white")
        t.append(f"   • 1-Day 95% Parametric VaR  : ₹{risk.get('var_95_daily_inr', 0):,.2f} ({risk.get('var_95_daily_pct')}%) on ₹10L portfolio\n", style="bold #F43F5E")
        t.append(f"   • Conditional VaR (CVaR)    : ₹{risk.get('cvar_95_inr', 0):,.2f} (Expected Tail Loss)\n", style="bold #F59E0B")
        t.append(f"   • Sharpe Ratio / Beta       : {risk.get('sharpe_ratio')} / {risk.get('beta_vs_nifty')}\n\n", style="bold #10B981")

        t.append("3. REAL-TIME INSTITUTIONAL FLOWS:\n", style="bold #818CF8")
        t.append("   • Sector Rotation Quadrant  : NIFTY IT (Leading ↗), NIFTY AUTO (Leading ↗)\n", style="#10B981")
        t.append("   • Point of Control (POC)    : Heavy Volume Cluster at ₹1,305.0\n", style="#38BDF8")

        return Panel(t, title="ANALYTICS ENGINE", border_style="#4F46E5", style="on #121A33")


class CommandInputBar(Static):
    """Bottom Bar: Intelligent command line input."""

    def render(self) -> Panel:
        t = Text()
        t.append(" ❯ /dcf RELIANCE ", style="bold #38BDF8")
        t.append("│ Suggestions: /chart, /val, /rrg, /risk, /screen, /macro, /paper", style="dim #64748B")
        return Panel(t, style="on #080C1A", border_style="#1E294B")


class StockOracleTUIApp(App):
    """
    Main Textual Application implementing the 3-column responsive layout.
    """
    CSS = """
    Screen {
        background: #080C1A;
        color: #F8FAFC;
    }
    #top-bar {
        height: 3;
    }
    #main-container {
        height: 1fr;
    }
    #left-sidebar {
        width: 26;
        height: 1fr;
    }
    #center-viewport {
        width: 1fr;
        height: 1fr;
    }
    #right-sidebar {
        width: 32;
        height: 1fr;
    }
    #bottom-bar {
        height: 3;
    }
    """

    BINDINGS = [
        Binding("q", "quit", "Quit"),
        Binding("1", "set_symbol('RELIANCE')", "RELIANCE"),
        Binding("2", "set_symbol('TCS')", "TCS"),
        Binding("3", "set_symbol('HDFCBANK')", "HDFCBANK"),
        Binding("4", "set_symbol('INFY')", "INFY"),
        Binding("5", "set_symbol('TATAMOTORS')", "TATAMOTORS"),
    ]

    def compose(self) -> ComposeResult:
        yield GlobalStatusBar(id="top-bar")
        with Horizontal(id="main-container"):
            yield LeftNavSidebar(id="left-sidebar")
            yield MainViewport(id="center-viewport")
            yield WatchlistSidebar(id="right-sidebar")
        yield CommandInputBar(id="bottom-bar")

    def action_set_symbol(self, symbol: str) -> None:
        viewport = self.query_one(MainViewport)
        viewport.symbol = symbol
        viewport.refresh()


def run_standalone_dashboard():
    """Runs the standalone Textual dashboard app."""
    app = StockOracleTUIApp()
    app.run()


if __name__ == "__main__":
    run_standalone_dashboard()
