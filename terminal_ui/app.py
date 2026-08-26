"""
StockOracle Pro — OpenTerminalUI Interactive Application Loop
Provides a Bloomberg-style interactive console environment with command execution.
"""
import sys
import logging
from rich.console import Console
from rich.prompt import Prompt
from rich.panel import Panel
from rich.text import Text
from rich.columns import Columns

from terminal_ui.adapter import UITerminalAdapter

logger = logging.getLogger("StockOracle.TerminalUI")
console = Console()


def print_banner():
    banner = """
    ╔═══════════════════════════════════════════════════════════════════════╗
    ║   STOCKORACLE PRO — MULTI-LEVEL INSTITUTIONAL FINANCIAL TERMINAL     ║
    ║   Powered by OpenBB Analytics Engine & OpenTerminalUI Presentation   ║
    ╚═══════════════════════════════════════════════════════════════════════╝
    """
    console.print(banner, style="bold #818CF8")


def run_terminal_app(initial_symbol: str = "RELIANCE"):
    """
    Runs the main interactive terminal session loop.
    """
    adapter = UITerminalAdapter()
    current_symbol = initial_symbol.upper().strip()

    print_banner()
    console.print(adapter.build_ticker_tape_panel())
    console.print()

    # Initial view: Quote + DCF side by side
    try:
        quote_tbl = adapter.build_quote_table(current_symbol)
        dcf_tbl = adapter.build_dcf_valuation_table(current_symbol)
        console.print(Columns([quote_tbl, dcf_tbl]))
    except Exception as e:
        console.print(f"[red]Error loading initial overview for {current_symbol}: {e}[/red]")

    console.print("\n[dim]Commands: [bold cyan]quote <SYM>[/], [bold green]dcf <SYM>[/], [bold yellow]macro[/], [bold red]risk[/], [bold magenta]screen <QUERY>[/], [bold white]tape[/], [bold red]exit[/][/dim]\n")

    while True:
        try:
            cmd_input = Prompt.ask(f"[bold #4F46E5]oracle-terminal[/] ([cyan]{current_symbol}[/])")
            if not cmd_input or not cmd_input.strip():
                continue

            parts = cmd_input.strip().split()
            cmd = parts[0].lower()
            arg = parts[1].upper() if len(parts) > 1 else current_symbol

            if cmd in ["exit", "quit", "q"]:
                console.print("[yellow]Exiting StockOracle Terminal. Goodbye![/yellow]")
                break

            elif cmd in ["quote", "qte", "p"]:
                current_symbol = arg
                console.print(adapter.build_quote_table(current_symbol))

            elif cmd in ["dcf", "val", "valuation"]:
                current_symbol = arg
                console.print(adapter.build_dcf_valuation_table(current_symbol))

            elif cmd in ["macro", "yields", "gsec"]:
                console.print(adapter.build_sovereign_macro_table())

            elif cmd in ["risk", "var"]:
                console.print(adapter.build_portfolio_risk_table([
                    {"ticker": current_symbol, "weight": 0.4},
                    {"ticker": "TCS", "weight": 0.3},
                    {"ticker": "HDFCBANK", "weight": 0.3}
                ]))

            elif cmd in ["screen", "scan"]:
                query = " ".join(parts[1:]) if len(parts) > 1 else "ROCE > 20 AND DebtToEquity < 0.5"
                console.print(f"[dim]Running screener query: {query}...[/dim]")
                res = adapter.engine.run_screener(query, limit=15)
                console.print(f"[green]Matched {res.get('total', 0)} stocks:[/green]")
                for s in res.get("results", [])[:10]:
                    console.print(f"  • [bold white]{s.get('ticker')}[/]: CMP ₹{s.get('close_price')} | ROCE {s.get('roce_pct')}% | PE {s.get('pe_ratio')}")

            elif cmd in ["tape", "indices"]:
                console.print(adapter.build_ticker_tape_panel())

            elif cmd in ["help", "?"]:
                console.print(Panel(
                    Text.from_markup(
                        "[bold cyan]quote <SYM>[/]      : Show real-time equity metrics\n"
                        "[bold green]dcf <SYM>[/]        : Compute OpenBB DCF Fair Value & Graham Number\n"
                        "[bold yellow]macro[/]            : Show Sovereign 10Y Yields & Inflation\n"
                        "[bold red]risk[/]             : Calculate Portfolio Value at Risk (VaR 95%/99%)\n"
                        "[bold magenta]screen <EXPR>[/]    : Run multi-factor screener formula\n"
                        "[bold white]tape[/]             : Display Bloomberg top indices ticker tape\n"
                        "[bold red]exit[/]             : Exit terminal"
                    ),
                    title="Available Terminal Commands",
                    border_style="#818CF8"
                ))

            else:
                # Default: treat input as symbol lookup
                current_symbol = cmd.upper()
                console.print(Columns([
                    adapter.build_quote_table(current_symbol),
                    adapter.build_dcf_valuation_table(current_symbol)
                ]))

            console.print()

        except (KeyboardInterrupt, EOFError):
            console.print("\n[yellow]Session interrupted. Exiting.[/yellow]")
            break
        except Exception as e:
            console.print(f"[red]Execution error: {e}[/red]")


if __name__ == "__main__":
    sym = sys.argv[1] if len(sys.argv) > 1 else "RELIANCE"
    run_terminal_app(sym)
