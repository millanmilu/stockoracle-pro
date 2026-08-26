"""
StockOracle Pro — Options Strategy Lab & 3D Volatility Surface Engine
Simulates multi-leg options strategies (Spreads, Straddles, Iron Condors) and generates payoff curves.
"""
import math
import logging
from typing import Dict, Any, List

logger = logging.getLogger("StockOracle.Analysis.OptionsLab")


def calculate_strategy_payoff(
    ticker: str,
    strategy_type: str = "BULL_CALL_SPREAD",
    underlying_price: float = 1317.0,
    legs: List[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Simulates expiry P&L payoff curves and breakeven points for multi-leg options structures.
    """
    ticker = ticker.upper().strip()
    u_price = float(underlying_price or 1000.0)

    # Standard presets if legs not explicitly provided
    if not legs or len(legs) == 0:
        if strategy_type == "BULL_CALL_SPREAD":
            legs = [
                {"option_type": "CALL", "action": "BUY", "strike": round(u_price * 1.0, 0), "premium": 28.5, "qty": 1},
                {"option_type": "CALL", "action": "SELL", "strike": round(u_price * 1.04, 0), "premium": 11.2, "qty": 1},
            ]
        elif strategy_type == "IRON_CONDOR":
            legs = [
                {"option_type": "PUT", "action": "BUY", "strike": round(u_price * 0.94, 0), "premium": 6.5, "qty": 1},
                {"option_type": "PUT", "action": "SELL", "strike": round(u_price * 0.97, 0), "premium": 14.2, "qty": 1},
                {"option_type": "CALL", "action": "SELL", "strike": round(u_price * 1.03, 0), "premium": 15.0, "qty": 1},
                {"option_type": "CALL", "action": "BUY", "strike": round(u_price * 1.06, 0), "premium": 7.0, "qty": 1},
            ]
        elif strategy_type == "LONG_STRADDLE":
            legs = [
                {"option_type": "CALL", "action": "BUY", "strike": round(u_price, 0), "premium": 32.0, "qty": 1},
                {"option_type": "PUT", "action": "BUY", "strike": round(u_price, 0), "premium": 29.5, "qty": 1},
            ]
        else:
            legs = [
                {"option_type": "CALL", "action": "BUY", "strike": round(u_price * 1.02, 0), "premium": 20.0, "qty": 1}
            ]

    # Calculate net premium entry cost
    net_premium = 0.0
    for leg in legs:
        cost = float(leg["premium"]) * int(leg.get("qty", 1))
        if leg["action"].upper() == "BUY":
            net_premium -= cost  # Debit
        else:
            net_premium += cost  # Credit

    # Generate price grid from -15% to +15%
    price_steps = 60
    min_p = round(u_price * 0.85, 1)
    max_p = round(u_price * 1.15, 1)
    prices = [round(min_p + i * (max_p - min_p) / price_steps, 1) for i in range(price_steps + 1)]

    payoff_curve = []
    pnl_values = []

    for p in prices:
        total_pnl = net_premium
        for leg in legs:
            strike = float(leg["strike"])
            qty = int(leg.get("qty", 1))
            is_buy = leg["action"].upper() == "BUY"
            is_call = leg["option_type"].upper() == "CALL"

            if is_call:
                intrinsic = max(0.0, p - strike)
            else:
                intrinsic = max(0.0, strike - p)

            leg_pnl = intrinsic * qty if is_buy else -intrinsic * qty
            total_pnl += leg_pnl

        payoff_curve.append({
            "price": p,
            "pnl": round(total_pnl, 2),
            "pct_move": round(((p - u_price) / u_price) * 100.0, 1)
        })
        pnl_values.append(total_pnl)

    max_profit = round(max(pnl_values), 2)
    max_loss = round(min(pnl_values), 2)

    # Find Breakeven price points (where pnl crosses zero)
    breakevens = []
    for i in range(1, len(payoff_curve)):
        prev = payoff_curve[i - 1]["pnl"]
        curr = payoff_curve[i]["pnl"]
        if (prev <= 0 and curr >= 0) or (prev >= 0 and curr <= 0):
            breakevens.append(payoff_curve[i]["price"])

    # 3D Implied Volatility Surface simulation
    vol_surface = []
    expiries = ["7D", "14D", "30D", "60D", "90D"]
    strike_offsets = [-0.10, -0.05, 0.0, 0.05, 0.10]

    for exp_idx, exp in enumerate(expiries):
        for off in strike_offsets:
            stk = round(u_price * (1.0 + off), 0)
            # Implied volatility smile / skew
            base_iv = 18.5 + abs(off) * 60.0 + exp_idx * 1.2
            vol_surface.append({
                "expiry": exp,
                "strike": stk,
                "iv": round(base_iv, 2),
                "moneyness": round(1.0 + off, 2)
            })

    return {
        "ticker": ticker,
        "strategy_type": strategy_type,
        "underlying_price": u_price,
        "legs": legs,
        "net_premium": round(net_premium, 2),
        "max_profit": max_profit if max_profit < 100000 else "Unlimited",
        "max_loss": max_loss,
        "breakevens": breakevens,
        "payoff_curve": payoff_curve,
        "volatility_surface": vol_surface,
    }
