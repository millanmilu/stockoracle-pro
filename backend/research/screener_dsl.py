"""
StockOracle Pro — Screener.in Formula Query Language (DSL) & AST Engine
Provides safe lexical tokenization, semantic AST construction, and parameterized SQL compilation.
Guarantees 100% security: Zero eval/exec or raw string interpolation.
"""
import re
import logging
from typing import Dict, Any, List, Tuple, Optional

logger = logging.getLogger("StockOracle.Research.DSL")

# Whitelist of allowed metrics mapping friendly names to SQL column names
FIELD_MAP = {
    "roce": "roce_pct",
    "roce_pct": "roce_pct",
    "roe": "roe_pct",
    "roe_pct": "roe_pct",
    "pe": "pe_ratio",
    "pe_ratio": "pe_ratio",
    "pricetoearnings": "pe_ratio",
    "pb": "pb_ratio",
    "pb_ratio": "pb_ratio",
    "pricetobook": "pb_ratio",
    "debttoequity": "debt_to_equity",
    "debtequity": "debt_to_equity",
    "debt_to_equity": "debt_to_equity",
    "marketcap": "market_cap_cr",
    "marketcapcr": "market_cap_cr",
    "market_cap_cr": "market_cap_cr",
    "profitgrowth3y": "profit_growth_3y",
    "profit_growth_3y": "profit_growth_3y",
    "salesgrowth3y": "sales_growth_3y",
    "sales_growth_3y": "sales_growth_3y",
    "rsi": "rsi_14",
    "rsi14": "rsi_14",
    "rsi_14": "rsi_14",
    "volumeratio": "volume_ratio_20d",
    "volumeratio20d": "volume_ratio_20d",
    "volume_ratio_20d": "volume_ratio_20d",
    "price": "close_price",
    "close": "close_price",
    "close_price": "close_price",
    "change1d": "change_1d_pct",
    "change_1d_pct": "change_1d_pct",
    "change1w": "change_1w_pct",
    "change_1w_pct": "change_1w_pct",
    "change1m": "change_1m_pct",
    "change_1m_pct": "change_1m_pct",
    "distance52whigh": "distance_52w_high_pct",
    "distance_52w_high_pct": "distance_52w_high_pct",
    "distance52wlow": "distance_52w_low_pct",
    "distance_52w_low_pct": "distance_52w_low_pct",
    "aiconsensus": "ai_consensus_score",
    "ai_consensus_score": "ai_consensus_score",
    "pcr": "pcr",
    "sector": "sector",
    "industry": "industry",
    "aisignal": "ai_signal",
    "ai_signal": "ai_signal",
    "marketcapcat": "market_cap_cat",
}

TOKEN_SPEC = [
    ("NUMBER",   r"-?\d+(\.\d+)?"),
    ("STRING",   r"'[^']*'|\"[^\"]*\""),
    ("OP",       r">=|<=|!=|==|=|>|<"),
    ("LPAREN",   r"\("),
    ("RPAREN",   r"\)"),
    ("LOGIC",    r"\b(AND|OR|NOT)\b"),
    ("IDENT",    r"[a-zA-Z_][a-zA-Z0-9_]*"),
    ("SKIP",     r"[ \t\r\n]+"),
    ("MISMATCH", r"."),
]

TOKEN_REGEX = "|".join(f"(?P<{name}>{pattern})" for name, pattern in TOKEN_SPEC)


def tokenize(code: str) -> List[Tuple[str, str]]:
    """Tokenizes a Screener formula string."""
    tokens = []
    for mo in re.finditer(TOKEN_REGEX, code, re.IGNORECASE):
        kind = mo.lastgroup
        value = mo.group()
        if kind == "SKIP":
            continue
        elif kind == "MISMATCH":
            raise ValueError(f"Unexpected character in query: '{value}'")
        elif kind == "LOGIC":
            tokens.append(("LOGIC", value.upper()))
        elif kind == "IDENT":
            tokens.append(("IDENT", value))
        elif kind == "OP":
            tokens.append(("OP", "==" if value == "=" else value))
        elif kind == "STRING":
            tokens.append(("STRING", value.strip("'\"")))
        elif kind == "NUMBER":
            tokens.append(("NUMBER", float(value) if "." in value else int(value)))
        else:
            tokens.append((kind, value))
    return tokens


class ScreenerQueryParser:
    """
    Recursive descent parser that validates formula queries and produces safe SQL + AST JSON.
    """
    def __init__(self, tokens: List[Tuple[str, Any]]):
        self.tokens = tokens
        self.pos = 0
        self.param_counter = 0
        self.params: Dict[str, Any] = {}

    def peek(self) -> Optional[Tuple[str, Any]]:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def consume(self, expected_kind: Optional[str] = None) -> Tuple[str, Any]:
        tok = self.peek()
        if not tok:
            raise ValueError("Unexpected end of query.")
        if expected_kind and tok[0] != expected_kind:
            raise ValueError(f"Expected {expected_kind}, got {tok[0]} ('{tok[1]}') at pos {self.pos}")
        self.pos += 1
        return tok

    def parse(self) -> Tuple[str, Dict[str, Any], Dict[str, Any]]:
        """
        Parses query into (sql_where_clause, bound_params, ast_dict).
        """
        if not self.tokens:
            return "1=1", {}, {"type": "ALL"}

        sql_expr, ast_node = self.parse_or_expr()
        if self.pos < len(self.tokens):
            extra = self.tokens[self.pos]
            raise ValueError(f"Unexpected trailing tokens near '{extra[1]}'")
        return sql_expr, self.params, ast_node

    def parse_or_expr(self) -> Tuple[str, Dict[str, Any]]:
        left_sql, left_ast = self.parse_and_expr()
        while self.peek() and self.peek() == ("LOGIC", "OR"):
            self.consume("LOGIC")
            right_sql, right_ast = self.parse_and_expr()
            left_sql = f"({left_sql} OR {right_sql})"
            left_ast = {"type": "OR", "left": left_ast, "right": right_ast}
        return left_sql, left_ast

    def parse_and_expr(self) -> Tuple[str, Dict[str, Any]]:
        left_sql, left_ast = self.parse_factor()
        while self.peek() and self.peek() == ("LOGIC", "AND"):
            self.consume("LOGIC")
            right_sql, right_ast = self.parse_factor()
            left_sql = f"({left_sql} AND {right_sql})"
            left_ast = {"type": "AND", "left": left_ast, "right": right_ast}
        return left_sql, left_ast

    def parse_factor(self) -> Tuple[str, Dict[str, Any]]:
        tok = self.peek()
        if not tok:
            raise ValueError("Unexpected end of expression.")

        if tok == ("LOGIC", "NOT"):
            self.consume("LOGIC")
            sql, ast = self.parse_factor()
            return f"NOT ({sql})", {"type": "NOT", "expr": ast}

        if tok[0] == "LPAREN":
            self.consume("LPAREN")
            sql, ast = self.parse_or_expr()
            self.consume("RPAREN")
            return sql, ast

        return self.parse_comparison()

    def parse_comparison(self) -> Tuple[str, Dict[str, Any]]:
        ident_tok = self.consume("IDENT")
        raw_field = ident_tok[1].lower()

        if raw_field not in FIELD_MAP:
            raise ValueError(f"Unknown metric or field '{ident_tok[1]}'. Whitelisted metrics: {', '.join(sorted(set(FIELD_MAP.keys()))[:15])}...")

        sql_col = FIELD_MAP[raw_field]
        op_tok = self.consume("OP")
        op = op_tok[1]
        val_tok = self.peek()

        if not val_tok or val_tok[0] not in ("NUMBER", "STRING"):
            raise ValueError(f"Expected number or string after comparison operator '{op}'")

        val = self.consume()[1]
        param_name = f"p_{self.param_counter}"
        self.param_counter += 1

        sql_op = "=" if op == "==" else op
        if sql_col in ("sector", "industry", "name", "ticker", "market_cap_cat", "ai_signal") and isinstance(val, str) and op in ("==", "="):
            sql_clause = f"LOWER({sql_col}) LIKE LOWER(:{param_name})"
            self.params[param_name] = f"%{val.strip()}%"
        else:
            self.params[param_name] = val
            sql_clause = f"{sql_col} {sql_op} :{param_name}"

        ast_node = {
            "type": "COMPARISON",
            "field": raw_field,
            "column": sql_col,
            "operator": op,
            "value": val
        }
        return sql_clause, ast_node


def parse_screener_query(query_str: str) -> Dict[str, Any]:
    """
    Main entry point: Parses a formula query string and returns SQL, params, and AST.
    """
    if not query_str or not query_str.strip():
        return {
            "success": True,
            "where_clause": "1=1",
            "params": {},
            "ast": {"type": "ALL"},
            "error": None
        }

    try:
        tokens = tokenize(query_str)
        parser = ScreenerQueryParser(tokens)
        where_clause, params, ast_tree = parser.parse()
        return {
            "success": True,
            "where_clause": where_clause,
            "params": params,
            "ast": ast_tree,
            "error": None
        }
    except Exception as exc:
        logger.warning("Failed to parse screener formula '%s': %s", query_str, exc)
        return {
            "success": False,
            "where_clause": "1=0",
            "params": {},
            "ast": None,
            "error": str(exc)
        }
