"""
StockOracle Pro — OpenTerminalUI Presentation Layer
Interactive Bloomberg-Style Console Trading & Analytics Terminal
"""
from terminal_ui.adapter import UITerminalAdapter
from terminal_ui.app import run_terminal_app
from terminal_ui.institutional_terminal import launch_institutional_terminal

__all__ = ["UITerminalAdapter", "run_terminal_app", "launch_institutional_terminal"]
