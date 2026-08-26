"""
StockOracle Pro — OpenTerminalUI Presentation Adapter
Bridges terminal UI widgets with OpenBBWrapper and backend analytics engines.
"""
from typing import Dict, Any, List
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.console import Group

from backend.providers.openbb.wrapper import get_openbb_client


class UITerminalAdapter:
    """
    Transforms backend and OpenBB data structures into styled Rich / Textual terminal components.
    """

    def __init__(self):
        self.engine = get_openbb_client()

    def build_ticker_tape_panel(self) -> Panel:
        """Constructs the Bloomberg top ticker tape ribbon."""
        indices = [
            ("NIFTY 50", 24852.4, 0.42),
            ("SENSEX", 81340.2, 0.38),
            ("BANK NIFTY", 53210.5, 0.65),
            ("INDIA VIX", 12.84, -3.20),
            ("USD/INR", 83.92, -0.05),
            ("BRENT CRUDE", 78.45, -1.15),
        ]
        text = Text()
        text.append(" ⚡ BLOOMBERG PRO TAPE  ", style="bold white on #4F46E5")
        text.append(" ")
        for sym, price, chg in indices:
            is_up = chg >= 0
            color = "green" if is_up else "red"
            sign = "+" if is_up else ""
            text.append(f"{sym}: ", style="bold white")
            text.append(f"{price:,.1f} ", style="cyan")
            text.append(f"({sign}{chg:.2f}%)  ", style=f"bold {color}")

        return Panel(text, style="on #060913", border_style="#4F46E5")

    def build_quote_table(self, symbol: str) -> Table:
        """Constructs an equity summary table for symbol."""
        quote = self.engine.get_equity_quote(symbol)
        table = Table(title=f"📊 Equity Quote — {symbol}", border_style="cyan", show_header=True, header_style="bold magenta")
        table.add_column("Metric", style="dim")
        table.add_column("Value", style="bold white")

        is_up = quote.get("change_pct", 0) >= 0
        chg_color = "green" if is_up else "red"
        sign = "+" if is_up else ""

        table.add_row("Current Price (LTP)", f"₹{quote.get('price', 0):,.2f}")
        table.add_row("24h Change", f"[{chg_color}]{sign}{quote.get('change', 0):,.2f} ({sign}{quote.get('change_pct', 0):.2f}%)[/{chg_color}]")
        table.add_row("Day High / Low", f"₹{quote.get('high', 0):,.2f} / ₹{quote.get('low', 0):,.2f}")
        table.add_row("Trading Volume", f"{quote.get('volume', 0):,}")
        table.add_row("Market Cap", f"{quote.get('market_cap', 'N/A')}")
        table.add_row("Provider Gateway", quote.get("provider", "Native"))
        return table

    def build_dcf_valuation_table(self, symbol: str) -> Table:
        """Constructs an OpenBB DCF & Graham Intrinsic Valuation table."""
        val = self.engine.get_dcf_valuation(symbol)
        table = Table(title=f"🏛️ OpenBB DCF & Intrinsic Valuation — {symbol}", border_style="green", show_header=True, header_style="bold green")
        table.add_column("Valuation Model", style="bold cyan")
        table.add_column("Value (₹)", style="bold white")
        table.add_column("Status / Formula", style="dim")

        table.add_row("Current Market Price (CMP)", f"₹{val.get('cmp', 0):,.2f}", "Live NSE trade price")
        table.add_row("DCF Intrinsic Fair Value", f"₹{val.get('dcf_intrinsic_value', 0):,.2f}", "5Y FCFF + Terminal Value")
        table.add_row("Benjamin Graham Number", f"₹{val.get('graham_number', 0):,.2f}", "√(22.5 × EPS × BVPS)")

        mos = val.get("margin_of_safety_pct", 0)
        mos_color = "green" if mos > 0 else "red"
        sign = "+" if mos > 0 else ""
        table.add_row(
            "Margin of Safety",
            f"[{mos_color}]{sign}{mos:.2f}%[/{mos_color}]",
            f"[{mos_color}]{val.get('valuation_status', 'N/A')}[/{mos_color}]"
        )
        return table

    def build_sovereign_macro_table(self) -> Table:
        """Constructs a Sovereign Macro Yields & Inflation table."""
        macro = self.engine.get_sovereign_macro_hub()
        table = Table(title="🌐 Sovereign Yields & Macro Dashboard", border_style="#818CF8", show_header=True, header_style="bold #818CF8")
        table.add_column("Macro Indicator", style="bold white")
        table.add_column("Benchmark Rate", style="bold yellow")
        table.add_column("Policy / Spread", style="dim")

        table.add_row("India 10Y Benchmark G-Sec", f"{macro.get('india_10y_yield', 0)}%", "Sovereign Debt")
        table.add_row("US 10Y Treasury Benchmark", f"{macro.get('us_10y_yield', 0)}%", "Global Risk-Free Rate")
        table.add_row("Sovereign Yield Spread", f"+{macro.get('yield_spread_bps', 0)} bps", "India Spread Over US")
        table.add_row("RBI Policy Repo Rate", f"{macro.get('rbi_repo_rate', 0)}%", f"Stance: {macro.get('rbi_policy_stance', 'Neutral')}")
        table.add_row("CPI Consumer Inflation", f"{macro.get('cpi_inflation', 0)}%", "RBI Target: 4.0% ± 2%")
        return table

    def build_portfolio_risk_table(self, positions: List[Dict[str, Any]], value: float = 1000000.0) -> Table:
        """Constructs a Quantitative Portfolio VaR & Risk table."""
        risk = self.engine.calculate_portfolio_risk(positions, portfolio_value=value)
        table = Table(title="🛡️ Quantitative Risk & Value at Risk (VaR)", border_style="red", show_header=True, header_style="bold red")
        table.add_column("Risk Metric", style="bold white")
        table.add_column("Estimated Value", style="bold yellow")
        table.add_column("Confidence / Horizon", style="dim")

        table.add_row("1-Day 95% Parametric VaR", f"₹{risk.get('var_95_daily_inr', 0):,.2f} ({risk.get('var_95_daily_pct', 0)}%)", "95% Confidence (1.65σ)")
        table.add_row("1-Day 99% Tail VaR", f"₹{risk.get('var_99_daily_inr', 0):,.2f} ({risk.get('var_99_daily_pct', 0)}%)", "99% Confidence (2.33σ)")
        table.add_row("Conditional VaR (CVaR)", f"₹{risk.get('cvar_95_inr', 0):,.2f} ({risk.get('cvar_95_pct', 0)}%)", "Expected Shortfall Beyond VaR")
        table.add_row("Annualized Sharpe Ratio", f"{risk.get('sharpe_ratio', 0)}", "Risk-Free Rate: 6.50%")
        table.add_row("Sortino / Calmar Ratio", f"{risk.get('sortino_ratio', 0)} / {risk.get('calmar_ratio', 0)}", "Downside Risk Adjusted")
        return table
