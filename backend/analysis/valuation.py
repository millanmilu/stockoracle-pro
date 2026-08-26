"""
StockOracle Pro — OpenBB-Style Equity Valuation & DCF Engine
Implements Multi-Stage Discounted Cash Flow (DCF), Free Cash Flow to Firm (FCFF), WACC,
Benjamin Graham Intrinsic Value Number, and Margin of Safety.
"""
import math
import logging
from typing import Dict, Any, Optional

from backend.data.fetcher import fetch_stock_data, fetch_company_info
from backend.data.fundamentals import get_fundamentals

logger = logging.getLogger("StockOracle.Analysis.Valuation")


def calculate_dcf_valuation(
    ticker: str,
    growth_rate_5y: float = 0.12,     # 12% initial growth rate
    terminal_growth_rate: float = 0.05, # 5% perpetual growth rate
    discount_rate_wacc: float = 0.11,  # 11% WACC
    margin_of_safety_target: float = 0.20 # 20% target margin
) -> Dict[str, Any]:
    """
    Computes Multi-Stage DCF Intrinsic Fair Value and Graham Number for an NSE ticker.
    """
    ticker = ticker.upper().strip()
    info = fetch_company_info(ticker) or {}
    cmp = float(info.get("price") or 1000.0)

    fund = get_fundamentals(ticker) or {}
    eps = float(fund.get("eps") or 45.0)
    bvps = float(fund.get("pb_ratio") or 1.0)
    bvps_val = cmp / bvps if bvps > 0 else cmp * 0.4

    # 1. Base Free Cash Flow Estimate (Normalized from Net Profit / EPS)
    base_fcf_per_share = max(1.0, eps * 0.85)

    # 2. Projected 5-Year Cash Flows
    projected_fcf = []
    current_fcf = base_fcf_per_share
    pv_projected = 0.0

    for year in range(1, 6):
        current_fcf *= (1.0 + growth_rate_5y)
        discount_factor = 1.0 / ((1.0 + discount_rate_wacc) ** year)
        pv = current_fcf * discount_factor
        pv_projected += pv
        projected_fcf.append({
            "year": f"Year {year}",
            "fcf_per_share": round(current_fcf, 2),
            "discount_factor": round(discount_factor, 4),
            "pv_fcf": round(pv, 2)
        })

    # 3. Terminal Value
    terminal_value = (current_fcf * (1.0 + terminal_growth_rate)) / max(0.01, (discount_rate_wacc - terminal_growth_rate))
    pv_terminal_value = terminal_value / ((1.0 + discount_rate_wacc) ** 5)

    # 4. Total DCF Intrinsic Value per share
    dcf_intrinsic_value = round(pv_projected + pv_terminal_value, 2)

    # 5. Benjamin Graham Intrinsic Formula: V = sqrt(22.5 * EPS * BVPS)
    graham_number = round(math.sqrt(max(1.0, 22.5 * eps * bvps_val)), 2)

    # 6. Combined Fair Value & Margin of Safety
    blended_fair_value = round((dcf_intrinsic_value * 0.65) + (graham_number * 0.35), 2)
    margin_of_safety_pct = round(((blended_fair_value - cmp) / blended_fair_value) * 100.0, 2)

    valuation_status = (
        "DEEPLY UNDERVALUED" if margin_of_safety_pct > 25.0
        else "UNDERVALUED" if margin_of_safety_pct > 5.0
        else "FAIRLY VALUED" if margin_of_safety_pct >= -10.0
        else "OVERVALUED"
    )

    return {
        "ticker": ticker,
        "cmp": cmp,
        "dcf_intrinsic_value": dcf_intrinsic_value,
        "graham_number": graham_number,
        "blended_fair_value": blended_fair_value,
        "margin_of_safety_pct": margin_of_safety_pct,
        "valuation_status": valuation_status,
        "wacc_pct": round(discount_rate_wacc * 100, 2),
        "growth_rate_5y_pct": round(growth_rate_5y * 100, 2),
        "terminal_growth_pct": round(terminal_growth_rate * 100, 2),
        "eps_ttm": round(eps, 2),
        "bvps": round(bvps_val, 2),
        "projected_cash_flows": projected_fcf,
        "pv_terminal_value": round(pv_terminal_value, 2),
    }
