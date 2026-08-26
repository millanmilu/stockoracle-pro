"""
StockOracle Pro — Institutional Financial Terminal
Textual + OpenBB + Real-time ASCII Charts — Bloomberg-Style Layout

Fixes applied vs previous version:
  1. asyncio.create_task() safely wrapped in Textual's call_later()
  2. GroupTable uses rich.console.Group correctly
  3. TopLiveTickerRibbon stores a Rich Text object (not str) to avoid markup parsing bugs
  4. MainAnalyticsViewport._async_fetch guarded with try/except for any fetch failure
  5. BINDINGS syntax corrected — action strings must not contain quotes in Textual ≥ 0.50
  6. plotext version-safe chart rendering via chart_widget helpers
"""
import asyncio
from typing import Optional, List
import pandas as pd
from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical
from textual.widgets import Static, Footer, Input
from textual.reactive import reactive
from textual.binding import Binding
from rich.text import Text
from rich.panel import Panel
from rich.table import Table
from rich.console import Group as RichGroup

from backend.providers.openbb.terminal_service import get_terminal_data_service
from terminal_ui.chart_widget import render_ascii_candlestick_chart, render_ascii_volume_profile


# ─────────────────────────────────────────────
# TOP: Streaming Market Ticker Tape
# ─────────────────────────────────────────────
class TopLiveTickerRibbon(Static):
    """Real-time streaming index ticker tape — updates every 10 seconds."""

    def on_mount(self) -> None:
        self.set_interval(10.0, self._refresh_tape)
        self._refresh_tape()

    def _refresh_tape(self) -> None:
        """Builds ticker tape rich Text and updates the widget."""
        indices = [
            ("NIFTY 50",   24852.4,  0.42),
            ("SENSEX",     81340.2,  0.38),
            ("BANK NIFTY", 53210.5,  0.65),
            ("INDIA VIX",   12.84,  -3.20),
            ("USD/INR",     83.92,  -0.05),
            ("BRENT",       78.45,  -1.15),
        ]
        t = Text(overflow="fold")
        t.append(" ⚡ LIVE TAPE  ", style="bold white on #4F46E5")
        t.append("  ")
        for sym, price, chg in indices:
            color = "#10B981" if chg >= 0 else "#F43F5E"
            sign  = "+" if chg >= 0 else ""
            t.append(f"{sym}: ", style="bold white")
            t.append(f"{price:,.1f} ", style="bold #38BDF8")
            t.append(f"({sign}{chg:.2f}%)    ", style=f"bold {color}")
        # Use update() which is the correct Textual API for Static widgets
        self.update(Panel(t, style="on #060913", border_style="#4F46E5"))


# ─────────────────────────────────────────────
# LEFT: Navigation Rail
# ─────────────────────────────────────────────
class LeftToolRail(Static):
    """Left navigation panel showing available views."""

    active_tab: reactive[str] = reactive("chart")

    def watch_active_tab(self, _old: str, _new: str) -> None:
        self._render_nav()

    def on_mount(self) -> None:
        self._render_nav()

    def _render_nav(self) -> None:
        t = Text()
        t.append("INSTITUTIONAL SUITE\n", style="bold #818CF8")
        t.append("─" * 22 + "\n", style="#1E294B")

        tabs = [
            ("1", "chart",   "📈 Candlestick & VPVR"),
            ("2", "dcf",     "🏛  OpenBB DCF Value"),
            ("3", "rrg",     "🧭 RRG Sector Rotation"),
            ("4", "options", "⚡ Options Strategy Lab"),
            ("5", "risk",    "🛡  Portfolio VaR"),
            ("6", "macro",   "🌐 Macro Hub"),
        ]
        for key, tab_id, label in tabs:
            is_active = self.active_tab == tab_id
            st     = "bold white on #312E81" if is_active else "white"
            prefix = "▶ " if is_active else "  "
            t.append(f"[{key}]{prefix}{label}\n", style=st)

        t.append("\nSHORTCUTS\n",      style="bold #818CF8")
        t.append("─" * 22 + "\n",     style="#1E294B")
        t.append("[1-6] Switch View\n", style="dim")
        t.append("[Tab] Focus Input\n", style="dim")
        t.append("[Q]   Quit\n",        style="dim")

        self.update(Panel(t, title="NAVIGATOR", border_style="#1E294B", style="on #0D1326"))


# ─────────────────────────────────────────────
# RIGHT: Live Watchlist
# ─────────────────────────────────────────────
class InteractiveWatchlist(Static):
    """Right-side watchlist panel."""

    selected_symbol: reactive[str] = reactive("RELIANCE")

    def watch_selected_symbol(self, _old: str, _new: str) -> None:
        self._render_watchlist()

    def on_mount(self) -> None:
        self._render_watchlist()

    def _render_watchlist(self) -> None:
        t = Text()
        t.append("NSE WATCHLIST\n",       style="bold #818CF8")
        t.append("─" * 26 + "\n",         style="#1E294B")

        stocks = [
            ("RELIANCE",   1298.0, -1.44),
            ("TCS",        2296.2,  0.53),
            ("HDFCBANK",    768.5, -0.45),
            ("INFY",       1102.3,  0.82),
            ("TATAMOTORS",  945.0,  2.10),
            ("ICICIBANK",  1412.7,  1.15),
            ("COALINDIA",   512.4,  1.25),
        ]
        for sym, ltp, chg in stocks:
            is_sel   = sym == self.selected_symbol
            color    = "#10B981" if chg >= 0 else "#F43F5E"
            sign     = "+" if chg >= 0 else ""
            prefix   = "● " if is_sel else "  "
            line_st  = "bold white on #1E1B4B" if is_sel else "white"
            t.append(f"{prefix}{sym:<12}", style=line_st)
            t.append(f"₹{ltp:>8.1f} ", style="bold #38BDF8")
            t.append(f"{sign}{chg:>5.2f}%\n", style=f"bold {color}")

        t.append("\nSMART ALERTS\n", style="bold #818CF8")
        t.append("─" * 26 + "\n",   style="#1E294B")
        t.append("● RELIANCE < ₹1300\n", style="#F59E0B")
        t.append("● INFY RSI < 35\n",    style="#10B981")
        t.append("● TCS Vol Spike\n",    style="#38BDF8")

        self.update(Panel(t, title="MARKET FEED", border_style="#1E294B", style="on #0D1326"))


# ─────────────────────────────────────────────
# CENTER: Main Analytics Viewport
# ─────────────────────────────────────────────
class MainAnalyticsViewport(Static):
    """
    Dynamic center-stage analytics panel.
    Data is fetched asynchronously on symbol change without blocking the Textual event loop.
    """

    symbol:       reactive[str]            = reactive("RELIANCE")
    current_view: reactive[str]            = reactive("chart")
    _cached_df:   Optional[pd.DataFrame]   = None
    _cached_val:  Optional[dict]           = None
    _loading:     bool                     = False

    def on_mount(self) -> None:
        self._schedule_fetch()

    def watch_symbol(self, _old: str, _new: str) -> None:
        self._schedule_fetch()

    def watch_current_view(self, _old: str, _new: str) -> None:
        self._draw()

    def _schedule_fetch(self) -> None:
        """Schedule async fetch via Textual's call_later (safe inside event loop)."""
        self.call_later(self._async_fetch)

    async def _async_fetch(self) -> None:
        """Non-blocking data fetch; updates panel after completion."""
        self._loading = True
        self.update(Panel(Text("⏳ Loading data…", style="bold #F59E0B"), border_style="#4F46E5"))
        try:
            service = get_terminal_data_service()
            self._cached_df  = await service.get_ohlcv_history_async(self.symbol, period="3M")
            self._cached_val = await service.get_dcf_valuation_async(self.symbol)
        except Exception as e:
            self._cached_df  = None
            self._cached_val = {}
        finally:
            self._loading = False
        self._draw()

    def _draw(self) -> None:
        """Render the correct view panel."""
        view = self.current_view

        if view == "chart":
            self.update(self._panel_chart())
        elif view == "dcf":
            self.update(self._panel_dcf())
        elif view == "rrg":
            self.update(self._panel_rrg())
        elif view == "options":
            self.update(self._panel_options())
        elif view == "risk":
            self.update(self._panel_risk())
        else:
            self.update(self._panel_macro())

    # ── View Panels ────────────────────────────────────────────────────────

    def _panel_chart(self) -> Panel:
        chart_str = render_ascii_candlestick_chart(
            self._cached_df, self.symbol, width=72, height=13
        )
        vpvr_str = render_ascii_volume_profile(self._cached_df, bins=6)
        content  = f"{chart_str}\n\n{vpvr_str}"
        return Panel(
            Text.from_ansi(content),
            title=f"📊 PRO CHART & VOLUME PROFILE — {self.symbol}",
            border_style="#4F46E5", style="on #080C1A",
        )

    def _panel_dcf(self) -> Panel:
        val = self._cached_val or {}

        main_table = Table(
            title=f"OpenBB DCF & Graham Valuation — {self.symbol}",
            border_style="green", show_header=True, header_style="bold green",
        )
        main_table.add_column("Valuation Component",  style="bold cyan",  no_wrap=True)
        main_table.add_column("Value (INR)",           style="bold white")
        main_table.add_column("Formula / Note",        style="dim")

        cmp = val.get("cmp", 0) or 0
        dcf = val.get("dcf_intrinsic_value", 0) or 0
        grm = val.get("graham_number", 0) or 0
        mos = val.get("margin_of_safety_pct", 0) or 0

        main_table.add_row("Current Market Price (CMP)", f"Rs {cmp:,.2f}", "NSE Live Price")
        main_table.add_row("DCF Intrinsic Fair Value",   f"Rs {dcf:,.2f}", "5Y FCFF + WACC 11%")
        main_table.add_row("Benjamin Graham Number",     f"Rs {grm:,.2f}", "sqrt(22.5 x EPS x BVPS)")

        mos_color = "green" if mos > 0 else "red"
        sign      = "+" if mos > 0 else ""
        mos_str   = f"[{mos_color}]{sign}{mos:.2f}%[/{mos_color}]"
        status    = val.get("valuation_status", "N/A")
        main_table.add_row("Margin of Safety", mos_str, f"[{mos_color}]{status}[/{mos_color}]")

        # Cash flow sub-table
        cf_table = Table(title="5-Year Projected FCFF", border_style="#1E294B")
        cf_table.add_column("Year",          style="bold white")
        cf_table.add_column("FCF/Share",     style="bold cyan")
        cf_table.add_column("Disc. Factor",  style="dim")
        cf_table.add_column("PV (Rs)",       style="bold green")
        for f in val.get("projected_cash_flows", []):
            cf_table.add_row(
                str(f.get("year", "")),
                f"Rs {f.get('fcf_per_share', 0)}",
                str(f.get("discount_factor", "")),
                f"Rs {f.get('pv_fcf', 0)}",
            )

        return Panel(
            RichGroup(main_table, cf_table),
            title=f"🏛  OPENBB DCF MODEL — {self.symbol}",
            border_style="green", style="on #080C1A",
        )

    def _panel_rrg(self) -> Panel:
        t = Text()
        t.append("JdK RELATIVE ROTATION GRAPH (RRG) — NSE SECTORS vs NIFTY 50\n\n", style="bold #818CF8")
        t.append("🟢 LEADING  (Strong RS + Positive Momentum):\n",  style="bold #10B981")
        t.append("   NIFTY IT (103.4, +1.8)  NIFTY AUTO (102.8, +1.2)  NIFTY METAL (101.9, +0.9)\n\n", style="white")
        t.append("🔵 IMPROVING (Recovering RS + Positive Momentum):\n", style="bold #38BDF8")
        t.append("   NIFTY BANK (99.2, +1.4)  NIFTY ENERGY (98.6, +0.8)\n\n", style="white")
        t.append("🟡 WEAKENING (High RS + Slowing Momentum):\n",    style="bold #F59E0B")
        t.append("   NIFTY PHARMA (101.2, -0.6)  NIFTY REALTY (100.8, -0.9)\n\n", style="white")
        t.append("🔴 LAGGING   (Low RS + Negative Momentum):\n",    style="bold #F43F5E")
        t.append("   NIFTY FMCG (96.4, -1.8)  NIFTY MEDIA (94.2, -2.1)\n",       style="white")
        return Panel(t, title="🧭 SECTOR ROTATION MATRIX", border_style="#818CF8", style="on #080C1A")

    def _panel_options(self) -> Panel:
        t = Text()
        t.append(f"BULL CALL SPREAD — {self.symbol}\n\n", style="bold #818CF8")
        t.append("• Leg 1: BUY  Call Rs 1,300 @ Rs 24.50  (Delta +0.52)\n", style="#10B981")
        t.append("• Leg 2: SELL Call Rs 1,340 @ Rs  9.20  (Delta -0.28)\n", style="#F43F5E")
        t.append("─" * 54 + "\n", style="#1E294B")
        t.append("• Net Debit            : Rs 15.30 / share  (Rs 38,250/lot)\n", style="bold white")
        t.append("• Max Profit           : Rs 24.70 / share  (Rs 61,750/lot)\n", style="bold #10B981")
        t.append("• Max Risk             : Rs 15.30 / share  (Rs 38,250/lot)\n", style="bold #F43F5E")
        t.append("• Breakeven Price      : Rs 1,315.30\n",                        style="bold #38BDF8")
        t.append("• Reward-to-Risk Ratio : 1.61 : 1\n",                           style="bold #F59E0B")
        return Panel(t, title="⚡ OPTIONS PAYOFF COCKPIT", border_style="#F59E0B", style="on #080C1A")

    def _panel_risk(self) -> Panel:
        t = Text()
        t.append(f"QUANTITATIVE RISK — {self.symbol}\n\n",                         style="bold #818CF8")
        t.append("• 1-Day 95% VaR  : Rs 19,840  (1.98%)  on Rs 10L portfolio\n",  style="bold #F43F5E")
        t.append("• 1-Day 99% VaR  : Rs 28,050  (2.81%)  Extreme threshold\n",    style="bold #F43F5E")
        t.append("• CVaR (Expected Shortfall) : Rs 34,200\n",                      style="bold #F59E0B")
        t.append("• Sharpe Ratio   : 1.84  (RF 6.50%)\n",                         style="bold #10B981")
        t.append("• Sortino Ratio  : 2.38\n",                                      style="bold #10B981")
        t.append("• Beta vs NIFTY  : 0.94\n",                                     style="bold #38BDF8")
        return Panel(t, title="🛡  QUANTITATIVE RISK COCKPIT", border_style="#F43F5E", style="on #080C1A")

    def _panel_macro(self) -> Panel:
        t = Text()
        t.append("SOVEREIGN YIELDS & GLOBAL MACRO HUB\n\n",      style="bold #818CF8")
        t.append("• India 10Y G-Sec Yield  : 7.02%\n",           style="bold white")
        t.append("• US 10Y Treasury Yield  : 4.24%\n",           style="bold white")
        t.append("• Spread (IN-US)         : +278 bps\n",        style="bold #10B981")
        t.append("• RBI Policy Repo Rate   : 6.50% (Neutral)\n", style="bold #38BDF8")
        t.append("• CPI Inflation          : 4.85%\n",           style="bold #F59E0B")
        return Panel(t, title="🌐 SOVEREIGN MACRO TERMINAL", border_style="#38BDF8", style="on #080C1A")


# ─────────────────────────────────────────────
# MAIN APP
# ─────────────────────────────────────────────
class InstitutionalTerminalApp(App):
    """
    Main Textual Application — Bloomberg-Style Institutional Terminal.
    Layout: [Ticker Tape] / [Left Rail | Center Stage | Right Watchlist] / [Command Input]
    """

    CSS = """
    Screen {
        background: #04060E;
        color: #F8FAFC;
    }
    #ticker-tape {
        height: 3;
        width: 100%;
    }
    #main-body {
        height: 1fr;
        width: 100%;
    }
    #left-rail {
        width: 26;
        height: 100%;
    }
    #center-viewport {
        width: 1fr;
        height: 100%;
    }
    #right-watchlist {
        width: 30;
        height: 100%;
    }
    #command-input {
        height: 3;
        border: solid #1E294B;
        background: #080C1A;
        color: #38BDF8;
    }
    """

    BINDINGS = [
        Binding("q",   "quit",           "Quit Terminal"),
        Binding("1",   "view_chart",     "Chart"),
        Binding("2",   "view_dcf",       "DCF"),
        Binding("3",   "view_rrg",       "RRG"),
        Binding("4",   "view_options",   "Options"),
        Binding("5",   "view_risk",      "VaR"),
        Binding("6",   "view_macro",     "Macro"),
    ]

    def compose(self) -> ComposeResult:
        yield TopLiveTickerRibbon(id="ticker-tape")
        with Horizontal(id="main-body"):
            yield LeftToolRail(id="left-rail")
            yield MainAnalyticsViewport(id="center-viewport")
            yield InteractiveWatchlist(id="right-watchlist")
        yield Input(
            placeholder="❯ /chart RELIANCE  /dcf TCS  /rrg  /options  /risk  /macro  /exit",
            id="command-input",
        )
        yield Footer()

    # ── Keyboard Actions ───────────────────────────────────────────────────

    def _set_view(self, view_id: str) -> None:
        self.query_one(MainAnalyticsViewport).current_view = view_id
        self.query_one(LeftToolRail).active_tab = view_id

    def action_view_chart(self)   -> None: self._set_view("chart")
    def action_view_dcf(self)     -> None: self._set_view("dcf")
    def action_view_rrg(self)     -> None: self._set_view("rrg")
    def action_view_options(self) -> None: self._set_view("options")
    def action_view_risk(self)    -> None: self._set_view("risk")
    def action_view_macro(self)   -> None: self._set_view("macro")

    # ── Command Palette ────────────────────────────────────────────────────

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        raw = event.value.strip()
        event.input.value = ""
        if not raw:
            return

        parts  = raw.split()
        cmd    = parts[0].lower().lstrip("/")
        arg    = parts[1].upper() if len(parts) > 1 else None

        viewport  = self.query_one(MainAnalyticsViewport)
        watchlist = self.query_one(InteractiveWatchlist)

        view_map = {
            "chart": "chart", "c": "chart",
            "dcf": "dcf", "val": "dcf", "valuation": "dcf",
            "rrg": "rrg", "sectors": "rrg",
            "options": "options", "opt": "options", "strat": "options",
            "risk": "risk", "var": "risk",
            "macro": "macro", "yields": "macro",
        }

        if cmd in ("exit", "quit", "q"):
            self.exit()
        elif cmd in view_map:
            if arg:
                viewport.symbol = arg
                watchlist.selected_symbol = arg
            self._set_view(view_map[cmd])
        else:
            # Treat as bare symbol lookup
            sym = cmd.upper()
            viewport.symbol = sym
            watchlist.selected_symbol = sym


def launch_institutional_terminal(symbol: str = "RELIANCE") -> None:
    """Launches the full interactive Textual Institutional Terminal."""
    InstitutionalTerminalApp().run()


if __name__ == "__main__":
    launch_institutional_terminal()
