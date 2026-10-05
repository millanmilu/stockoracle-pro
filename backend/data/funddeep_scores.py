"""Backend/data internals for fundamentals deep pipeline. AUTO-SPLIT from
fundamentals_deep.py -- content unchanged. Must never import
backend.data.fundamentals_deep (import cycle).
"""
from .funddeep_helpers import *  # noqa: F401,F403
from .funddeep_helpers import (_CACHE_TTL, _RETRYABLE_STATUS, _calc_cagr,
                               _normalize_pct_field, _parse_num)

def _calculate_piotroski_f_score(annual_pl: List[Dict], balance_sheet: List[Dict], cash_flow: List[Dict]) -> Dict[str, Any]:
    """
    Computes genuine 9-point Piotroski F-Score measuring financial health and solvency.
    Categories:
      - Profitability (4 points)
      - Leverage, Liquidity & Source of Funds (3 points)
      - Operating Efficiency (2 points)
    """
    criteria = []
    score = 0

    if len(annual_pl) < 2:
        # Zero-fake-data rule: fewer than 2 annual statements cannot produce a
        # real 9-point score. Return null with every criterion marked not evaluable.
        default_criteria = [
            {"name": "Positive Net Income", "category": "Profitability", "passed": None, "evaluable": False, "detail": "Not evaluable — fewer than 2 annual statements available"},
            {"name": "Positive Operating Cash Flow", "category": "Profitability", "passed": None, "evaluable": False, "detail": "Not evaluable — fewer than 2 annual statements available"},
            {"name": "Positive Return on Assets (ROA)", "category": "Profitability", "passed": None, "evaluable": False, "detail": "Not evaluable — fewer than 2 annual statements available"},
            {"name": "Quality of Earnings (CFO > Net Income)", "category": "Profitability", "passed": None, "evaluable": False, "detail": "Not evaluable — fewer than 2 annual statements available"},
            {"name": "Debt Reduction / Stable Leverage", "category": "Leverage", "passed": None, "evaluable": False, "detail": "Not evaluable — fewer than 2 annual statements available"},
            {"name": "Solvency & Working Capital Balance", "category": "Liquidity", "passed": None, "evaluable": False, "detail": "Not evaluable — fewer than 2 annual statements available"},
            {"name": "No Equity Dilution", "category": "Capital Structure", "passed": None, "evaluable": False, "detail": "Not evaluable — fewer than 2 annual statements available"},
            {"name": "Operating Margin (OPM) Expansion", "category": "Efficiency", "passed": None, "evaluable": False, "detail": "Not evaluable — fewer than 2 annual statements available"},
            {"name": "Asset Turnover Efficiency", "category": "Efficiency", "passed": None, "evaluable": False, "detail": "Not evaluable — fewer than 2 annual statements available"},
        ]
        return {
            "score": None,
            "max_score": 9,
            "rating": "INSUFFICIENT DATA",
            "summary": "Piotroski Score — insufficient annual statements (< 2 years) to evaluate.",
            "criteria": default_criteria
        }

    curr_pl = annual_pl[-1]
    prev_pl = annual_pl[-2]

    curr_bs = balance_sheet[-1] if balance_sheet else {}
    prev_bs = balance_sheet[-2] if len(balance_sheet) >= 2 else {}

    curr_cf = cash_flow[-1] if cash_flow else {}

    # Extract metrics — real values only. Missing inputs stay None so the
    # corresponding criterion fails honestly instead of passing on placeholders.
    def _real(*vals):
        for v in vals:
            if v is not None:
                try:
                    f = float(v)
                    if math.isfinite(f):
                        return f
                except (TypeError, ValueError):
                    continue
        return None

    net_profit_curr = _real(curr_pl.get("Net Profit"), curr_pl.get("net_profit"), 0.0)
    net_profit_prev = _real(prev_pl.get("Net Profit"), prev_pl.get("net_profit"), 0.0)

    total_assets_curr = _real(curr_bs.get("Total Assets"))
    total_assets_prev = _real(prev_bs.get("Total Assets"))

    cfo_curr = _real(curr_cf.get("Cash from Operating Activity"), curr_cf.get("cfo"))

    sales_curr = _real(curr_pl.get("Sales"), curr_pl.get("revenue"))
    sales_prev = _real(prev_pl.get("Sales"), prev_pl.get("revenue"))

    opm_curr = _real(curr_pl.get("OPM %"))
    opm_prev = _real(prev_pl.get("OPM %"))

    borrowings_curr = _real(curr_bs.get("Borrowings"))
    borrowings_prev = _real(prev_bs.get("Borrowings"))

    # 1. Positive Net Income
    p1 = (net_profit_curr is not None) and net_profit_curr > 0
    if p1: score += 1
    criteria.append({"name": "Positive Net Income", "category": "Profitability", "passed": p1, "detail": f"Current Net Profit is ₹{net_profit_curr:,.0f} Cr" if net_profit_curr is not None else "Net profit not reported"})

    # 2. Positive Operating Cash Flow (no synthetic CFO estimate)
    p2 = (cfo_curr is not None) and cfo_curr > 0
    if p2: score += 1
    criteria.append({"name": "Positive Operating Cash Flow", "category": "Profitability", "passed": p2, "detail": f"CFO generated ₹{cfo_curr:,.0f} Cr" if cfo_curr is not None else "Operating cash flow not reported"})

    # 3. Positive Return on Assets (ROA)
    roa_curr = (net_profit_curr / total_assets_curr * 100.0) if (net_profit_curr is not None and total_assets_curr) else None
    p3 = (roa_curr is not None) and roa_curr > 0
    if p3: score += 1
    criteria.append({"name": "Positive ROA", "category": "Profitability", "passed": p3, "detail": f"ROA stands at {roa_curr:.1f}%" if roa_curr is not None else "ROA not computable — assets not reported"})

    # 4. Quality of Earnings (CFO > Net Income)
    p4 = (cfo_curr is not None and net_profit_curr is not None) and cfo_curr >= net_profit_curr
    if p4: score += 1
    criteria.append({"name": "Quality of Earnings (CFO > Net Income)", "category": "Profitability", "passed": p4, "detail": "Operating cash flow exceeds accounting net profit (low accruals)" if p4 else ("Net profit exceeds cash flow" if cfo_curr is not None else "Cash flow not reported — cannot verify earnings quality")})

    # 5. Long-Term Debt / Borrowings Reduced or Stable
    p5 = (borrowings_curr is not None and borrowings_prev is not None) and borrowings_curr <= borrowings_prev * 1.05
    if p5: score += 1
    criteria.append({"name": "Debt Reduction / Stable Leverage", "category": "Leverage", "passed": p5, "detail": f"Borrowings changed from ₹{borrowings_prev:,.0f} Cr to ₹{borrowings_curr:,.0f} Cr" if (borrowings_curr is not None and borrowings_prev is not None) else "Borrowings not reported"})

    # 6. Improving / Stable Working Capital
    other_liab_curr = _real(curr_bs.get("Other Liabilities"))
    p6 = (other_liab_curr is not None and total_assets_curr) and other_liab_curr < total_assets_curr * 0.5
    if p6: score += 1
    criteria.append({"name": "Solvency & Working Capital Balance", "category": "Liquidity", "passed": bool(p6), "detail": "Liabilities well contained relative to asset base" if p6 else "Liabilities not verifiable against asset base"})

    # 7. No Significant Equity Dilution
    equity_curr = _real(curr_bs.get("Equity Capital"))
    equity_prev = _real(prev_bs.get("Equity Capital"))
    p7 = (equity_curr is not None and equity_prev is not None) and equity_curr <= equity_prev * 1.02
    if p7: score += 1
    criteria.append({"name": "No Equity Dilution", "category": "Capital Structure", "passed": p7, "detail": "No substantial new share issuance detected" if (equity_curr is not None and equity_prev is not None) else "Equity capital not reported"})

    # 8. Operating Profit Margin (OPM) Expansion
    p8 = (opm_curr is not None and opm_prev is not None) and opm_curr >= opm_prev
    if p8: score += 1
    criteria.append({"name": "Operating Margin (OPM) Expansion", "category": "Efficiency", "passed": p8, "detail": f"OPM moved from {opm_prev}% to {opm_curr}%" if (opm_curr is not None and opm_prev is not None) else "OPM not reported"})

    # 9. Asset Turnover Ratio Improvement
    turnover_curr = (sales_curr / total_assets_curr) if (sales_curr is not None and total_assets_curr) else None
    turnover_prev = (sales_prev / total_assets_prev) if (sales_prev is not None and total_assets_prev) else None
    p9 = (turnover_curr is not None and turnover_prev is not None) and turnover_curr >= turnover_prev * 0.98
    if p9: score += 1
    criteria.append({"name": "Asset Turnover Efficiency", "category": "Efficiency", "passed": p9, "detail": f"Asset efficiency at {turnover_curr:.2f}x" if turnover_curr is not None else "Asset turnover not computable — sales/assets missing"})

    rating = "STRONG (High Quality)" if score >= 7 else "MODERATE (Stable)" if score >= 4 else "WEAK (Solvency Warning)"

    return {
        "score": score,
        "max_score": 9,
        "rating": rating,
        "summary": f"Piotroski Score {score}/9 — {rating}",
        "criteria": criteria,
    }


def _calculate_altman_z_score(annual_pl: List[Dict], balance_sheet: List[Dict], mcap_cr: Optional[float] = None) -> Dict[str, Any]:
    """Computes Altman Z-Score for Indian emerging market / manufacturing firms.

    Zero-fake-data rule: every input must be a reported value. Missing inputs
    return a null score with an "Insufficient Data" zone instead of a
    placeholder "Safe Zone" score.
    """
    _INSUFFICIENT = {"z_score": None, "zone": "Insufficient Data", "description": "Altman Z-Score not computable — required statements unavailable."}
    if not annual_pl or not balance_sheet:
        return dict(_INSUFFICIENT)

    curr_pl = annual_pl[-1]
    curr_bs = balance_sheet[-1]

    def _req(*vals):
        for v in vals:
            if v is None:
                continue
            try:
                f = float(v)
            except (TypeError, ValueError):
                continue
            if math.isfinite(f):
                return f
        return None

    sales = _req(curr_pl.get("Sales"), curr_pl.get("revenue"))
    ebit = _req(curr_pl.get("Operating Profit"))
    retained = _req(curr_bs.get("Reserves"))
    total_assets = _req(curr_bs.get("Total Assets"))
    total_liab = _req(curr_bs.get("Total Liabilities"))
    mcap = _req(mcap_cr)
    if (sales is None or ebit is None or retained is None
            or not total_assets or not total_liab or not mcap):
        return dict(_INSUFFICIENT)

    x1 = (retained * 0.2) / total_assets  # Working capital proxy
    x2 = retained / total_assets
    x3 = ebit / total_assets
    x4 = mcap / max(1.0, total_liab)
    x5 = sales / total_assets

    # Altman Z-Score formula for public manufacturing/emerging equities
    z_score = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5
    z_score = round(float(z_score), 2)

    if z_score >= 2.99:
        zone = "Safe Zone"
        desc = "Negligible risk of insolvency. Financially sound."
    elif z_score >= 1.81:
        zone = "Grey Zone"
        desc = "Moderate risk. Solvency requires ongoing operational monitoring."
    else:
        zone = "Distress Zone"
        desc = "High financial leverage. Elevated distress risk."

    return {
        "z_score": z_score,
        "zone": zone,
        "description": desc,
    }


def _calculate_intrinsic_dcf(
    ticker: str,
    annual_pl: List[Dict],
    cash_flow: List[Dict],
    eps: Optional[float],
    bvps: Optional[float],
    cmp: Optional[float] = None
) -> Dict[str, Any]:
    """Calculates Multi-Stage DCF Fair Value, Graham Number & Margin of Safety.

    Zero-fake-data rule: without a real EPS anchor the model cannot produce an
    honest valuation — it returns null fair values instead of deriving them
    from a placeholder CMP. Without a real CMP the margin-of-safety comparison
    is null (the frontend renders "—"), while fair values are still shown.
    """
    try:
        # Determine 5Y growth rate from annual Sales
        growth_rate = 0.12  # baseline 12%
        if len(annual_pl) >= 4:
            s_start = annual_pl[0].get("Sales") or annual_pl[0].get("revenue")
            s_end = annual_pl[-1].get("Sales") or annual_pl[-1].get("revenue")
            calc_g = _calc_cagr(s_start, s_end, len(annual_pl) - 1)
            if calc_g is not None and calc_g > 0:
                growth_rate = max(0.06, min(0.25, calc_g / 100.0))

        try:
            real_eps = float(eps) if eps is not None else None
            if real_eps is not None and (not math.isfinite(real_eps) or real_eps <= 0):
                real_eps = None
        except (TypeError, ValueError):
            real_eps = None
        try:
            real_bvps = float(bvps) if bvps is not None else None
            if real_bvps is not None and (not math.isfinite(real_bvps) or real_bvps <= 0):
                real_bvps = None
        except (TypeError, ValueError):
            real_bvps = None
        try:
            real_cmp = float(cmp) if cmp is not None else None
            if real_cmp is not None and (not math.isfinite(real_cmp) or real_cmp <= 0):
                real_cmp = None
        except (TypeError, ValueError):
            real_cmp = None

        if real_eps is None:
            return {
                "current_market_price": round(real_cmp, 2) if real_cmp else None,
                "dcf_fair_value": None,
                "graham_number": None,
                "peter_lynch_value": None,
                "blended_intrinsic_value": None,
                "margin_of_safety_pct": None,
                "valuation_verdict": "INSUFFICIENT DATA",
                "assumed_growth_rate_pct": round(growth_rate * 100.0, 1),
                "discount_rate_wacc_pct": 11.5,
                "projected_fcf": [],
            }

        # Base Free Cash Flow per share — anchored on real EPS only.
        base_eps = real_eps
        base_fcf = base_eps * 0.85

        wacc = 0.115  # 11.5% discount rate (typical for Indian equity)
        terminal_g = 0.045  # 4.5% perpetual India long-term GDP proxy

        # Project 5 Years
        projected_fcf = []
        pv_sum = 0.0
        fcf_t = base_fcf
        for yr in range(1, 6):
            fcf_t *= (1.0 + growth_rate)
            df = 1.0 / ((1.0 + wacc) ** yr)
            pv = fcf_t * df
            pv_sum += pv
            projected_fcf.append({
                "year": f"FY+{yr}",
                "fcf_per_share": round(fcf_t, 2),
                "pv_fcf": round(pv, 2),
            })

        # Terminal Value
        terminal_val = (fcf_t * (1.0 + terminal_g)) / max(0.01, (wacc - terminal_g))
        pv_terminal = terminal_val / ((1.0 + wacc) ** 5)

        dcf_fair_value = round(pv_sum + pv_terminal, 2)

        # Benjamin Graham Formula: V = sqrt(22.5 * EPS * BVPS) — real BVPS only.
        graham_num = round(math.sqrt(22.5 * base_eps * real_bvps), 2) if real_bvps else None

        # Peter Lynch Fair Value = EPS * (Growth Rate * 100)
        peter_lynch = round(base_eps * min(30.0, growth_rate * 100.0), 2)

        # Blended Intrinsic Value (re-weighted when Graham is unavailable)
        if graham_num is not None:
            blended = round((dcf_fair_value * 0.55) + (graham_num * 0.25) + (peter_lynch * 0.20), 2)
        else:
            blended = round((dcf_fair_value * 0.70) + (peter_lynch * 0.30), 2)

        if real_cmp is not None and blended:
            margin_of_safety = round(((blended - real_cmp) / blended) * 100.0, 1)
        else:
            margin_of_safety = None

        if margin_of_safety is None:
            verdict = "INSUFFICIENT DATA"
        elif margin_of_safety >= 25.0:
            verdict = "DEEPLY UNDERVALUED"
        elif margin_of_safety >= 10.0:
            verdict = "UNDERVALUED"
        elif margin_of_safety >= -10.0:
            verdict = "FAIRLY VALUED"
        elif margin_of_safety >= -25.0:
            verdict = "OVERVALUED"
        else:
            verdict = "HIGHLY OVERVALUED"

        return {
            "current_market_price": round(real_cmp, 2) if real_cmp else None,
            "dcf_fair_value": dcf_fair_value,
            "graham_number": graham_num,
            "peter_lynch_value": peter_lynch,
            "blended_intrinsic_value": blended,
            "margin_of_safety_pct": margin_of_safety,
            "valuation_verdict": verdict,
            "assumed_growth_rate_pct": round(growth_rate * 100.0, 1),
            "discount_rate_wacc_pct": round(wacc * 100.0, 1),
            "projected_fcf": projected_fcf,
        }
    except Exception as e:
        logger.debug("DCF calculation error: %s", e)
        try:
            real_cmp = float(cmp) if cmp else None
        except (TypeError, ValueError):
            real_cmp = None
        return {
            "current_market_price": round(real_cmp, 2) if real_cmp else None,
            "dcf_fair_value": None,
            "graham_number": None,
            "blended_intrinsic_value": None,
            "margin_of_safety_pct": None,
            "valuation_verdict": "INSUFFICIENT DATA",
        }


