"""StockOracle Pro — AST-based safe custom indicator formula builder.


Split verbatim out of ``backend/analysis/indicators.py`` (pure code motion).
"""

import ast
from typing import Any, Dict

import numpy as np
import pandas as pd

from .indicator_trend import calculate_sma, calculate_ema, calculate_rsi

# ── AST-Based Safe Custom Indicator Formula Builder ───────────────────────────
class _SafeFormulaEvaluator(ast.NodeVisitor):
    """Safely evaluates user-defined indicator formulas without security risks of eval()."""

    ALLOWED_NODES = (
        ast.Expression, ast.BinOp, ast.UnaryOp, ast.Call,
        ast.Name, ast.Constant, ast.Add, ast.Sub,
        ast.Mult, ast.Div, ast.Mod, ast.Pow, ast.USub, ast.UAdd,
        ast.Load
    )

    def __init__(self, context: Dict[str, Any]):
        self.context = context

    def visit(self, node):
        if not isinstance(node, self.ALLOWED_NODES):
            raise ValueError(f"Disallowed expression node: {type(node).__name__}")
        return super().visit(node)

    def visit_Expression(self, node):
        return self.visit(node.body)

    def visit_Constant(self, node):
        return node.value


    def visit_Name(self, node):
        if node.id in self.context:
            return self.context[node.id]
        raise ValueError(f"Unknown variable or function: '{node.id}'")

    def visit_BinOp(self, node):
        left = self.visit(node.left)
        right = self.visit(node.right)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            return left / (right + 1e-9 if isinstance(right, pd.Series) else right)
        if isinstance(node.op, ast.Mod):
            return left % right
        if isinstance(node.op, ast.Pow):
            return left ** right
        raise ValueError(f"Unsupported operator: {type(node.op).__name__}")

    def visit_UnaryOp(self, node):
        operand = self.visit(node.operand)
        if isinstance(node.op, ast.USub):
            return -operand
        if isinstance(node.op, ast.UAdd):
            return operand
        raise ValueError(f"Unsupported unary operator: {type(node.op).__name__}")

    def visit_Call(self, node):
        func = self.visit(node.func)
        if not callable(func):
            raise ValueError(f"Target is not callable: {func}")
        args = [self.visit(arg) for arg in node.args]
        return func(*args)


def evaluate_custom_formula(df: pd.DataFrame, formula: str) -> pd.Series:
    """
    Executes user-defined formulas safely using AST validation.
    Supported variables: open, high, low, close, volume.
    Supported functions: sma, ema, rsi, std, abs, log, diff, shift.
    Example formula: '(close - sma(close, 20)) / (std(close, 20) + 1e-9)'
    """
    ctx = {
        "open": df["open"],
        "high": df["high"],
        "low": df["low"],
        "close": df["close"],
        "volume": df.get("volume", pd.Series(0, index=df.index)),
        "sma": lambda s, p: calculate_sma(s, int(p)),
        "ema": lambda s, p: calculate_ema(s, int(p)),
        "rsi": lambda s, p=14: calculate_rsi(s, int(p)),
        "std": lambda s, p: s.rolling(int(p), min_periods=1).std().fillna(0.0),
        "abs": lambda s: s.abs(),
        "log": lambda s: np.log(s.replace(0, np.nan)).fillna(0.0),
        "diff": lambda s, p=1: s.diff(int(p)).fillna(0.0),
        "shift": lambda s, p=1: s.shift(int(p)).ffill().bfill(),
    }
    tree = ast.parse(formula.strip(), mode="eval")
    evaluator = _SafeFormulaEvaluator(ctx)
    result = evaluator.visit(tree)
    if not isinstance(result, pd.Series):
        result = pd.Series(result, index=df.index)
    return result
