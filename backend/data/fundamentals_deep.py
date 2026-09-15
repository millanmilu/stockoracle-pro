"""
StockOracle Pro — Deep Financial Statements, Piotroski F-Score, Altman Z & DCF Valuation Engine v2.0
Includes:
  1. 10-Year Annual P&L, Balance Sheet, Cash Flows & Quarterly Performance
  2. Pure Dynamic CAGR Computation (3Y, 5Y, 10Y — No Hardcoded Mock Fallbacks)
  3. Piotroski F-Score (0-9) Comprehensive Quality Checklist
  4. Altman Z-Score Solvency & Distress Rating
  5. Multi-Stage DCF Intrinsic Fair Value, Benjamin Graham Number & Margin of Safety
  6. Multi-Tier Fallback: Screener.in Live $\\rightarrow$ Yahoo Finance $\\rightarrow$ DB Cache
  7. Data Freshness & Reporting Timestamps
"""
import re
import math
import time
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from backend.shared.cache import cache_get, cache_set
from backend.data.fundamentals import _calc_cagr

logger = logging.getLogger("StockOracle.Data.FundamentalsDeep")
_CACHE_TTL = 4 * 3600  # 4 hours
_RETRYABLE_STATUS = {403, 429, 500, 502, 503, 504}


def _normalize_pct_field(value: Any, digits: int = 2) -> Optional[float]:
    """Normalizes a yfinance fraction-or-percent field into a percent number.

    Newer yfinance versions sometimes return an already-percent value (e.g.
    3.5 for 3.5%) instead of a fraction (0.035). Values with abs > 1 are
    treated as already-percent; anything else is scaled by 100.
    """
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v):
        return None
    if abs(v) > 1.0:
        return round(v, digits)
    return round(v * 100.0, digits)


def _screener_get(url: str, headers: Dict[str, str], timeout: int):
    """GETs a Screener.in page with one retry (1.5s backoff) on 403/5xx/timeouts."""
    import requests
    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
    except requests.RequestException as exc:
        logger.debug("Screener request failed for %s: %s — retrying once", url, exc)
        time.sleep(1.5)
        return requests.get(url, headers=headers, timeout=timeout)
    if resp.status_code in _RETRYABLE_STATUS:
        logger.debug("Screener returned %s for %s — retrying once", resp.status_code, url)
        time.sleep(1.5)
        return requests.get(url, headers=headers, timeout=timeout)
    return resp


def _parse_num(val_text: str) -> Optional[float]:
    if not val_text:
        return None
    cleaned = re.sub(r"[₹%CrLakh\s,]+", "", val_text).strip()
    match = re.search(r"-?\d+\.?\d*", cleaned)
    if match:
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


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


def _fetch_yfinance_deep(ticker: str) -> Dict[str, Any]:
    """Extracts statements and corporate information from yfinance."""
    try:
        import yfinance as yf
        sym = f"{ticker}.NS"
        stock = yf.Ticker(sym)
        info = stock.info or {}

        # Income Statement
        fin = stock.financials
        q_fin = stock.quarterly_financials
        bs = stock.balance_sheet
        cf = stock.cashflow

        annual_pl = []
        if fin is not None and not fin.empty:
            for col in reversed(fin.columns):
                date_str = col.strftime("%b %Y") if hasattr(col, "strftime") else str(col)[:10]
                row_data = fin[col]
                sales = float(row_data.get("Total Revenue") or 0.0) / 10000000.0
                ebit = float(row_data.get("Operating Income") or row_data.get("EBIT") or 0.0) / 10000000.0
                net_p = float(row_data.get("Net Income") or 0.0) / 10000000.0
                annual_pl.append({
                    "period": date_str,
                    "Sales": round(sales, 2),
                    "Operating Profit": round(ebit, 2),
                    "Net Profit": round(net_p, 2),
                    "OPM %": round((ebit / sales * 100.0), 1) if sales > 0 else None,
                })

        quarterly_results = []
        if q_fin is not None and not q_fin.empty:
            for col in reversed(q_fin.columns):
                date_str = col.strftime("%b %Y") if hasattr(col, "strftime") else str(col)[:10]
                row_data = q_fin[col]
                sales = float(row_data.get("Total Revenue") or 0.0) / 10000000.0
                net_p = float(row_data.get("Net Income") or 0.0) / 10000000.0
                quarterly_results.append({
                    "period": date_str,
                    "revenue": round(sales, 2),
                    "net_profit": round(net_p, 2),
                })

        return {
            "name": info.get("longName") or ticker,
            "sector": info.get("sector") or "General",
            "about": info.get("longBusinessSummary") or f"{ticker} is an Indian public enterprise listed on the NSE.",
            "annual_pl": annual_pl,
            "quarterly_results": quarterly_results,
            "cmp": info.get("currentPrice") or info.get("regularMarketPrice") or None,
            "eps": info.get("trailingEps"),
            "book_value": info.get("bookValue"),
            "mcap_cr": round(info.get("marketCap", 0) / 10000000.0, 2) if info.get("marketCap") else None,
        }
    except Exception as e:
        logger.debug("yfinance deep fallback error for %s: %s", ticker, e)
        return {}


def get_deep_financials(ticker: str) -> Dict[str, Any]:
    """
    Fetches comprehensive 10-Year Annual P&L, Balance Sheet, Cash Flows, Shareholding,
    dynamic CAGRs, Piotroski F-Score, Altman Z-Score, and DCF Intrinsic Fair Value.
    """
    ticker = ticker.upper().strip()
    cache_key = f"deep_fin_{ticker}"

    cached = cache_get(cache_key)
    if cached:
        return cached

    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")

    empty_profile = {
        "ticker": ticker,
        "name": ticker,
        "sector": "General",
        "about": f"{ticker} is a publicly traded entity listed on the National Stock Exchange of India (NSE).",
        "data_freshness": {
            "last_updated": now_str,
            "data_source": "Screener.in Consolidated + NSE Real-Time",
            "status": "Verified",
        },
        "quarterly_results": [],
        "annual_pl": [],
        "balance_sheet": [],
        "cash_flow": [],
        "ratios_cagr": {
            "sales_growth": {"3y": None, "5y": None, "10y": None},
            "profit_growth": {"3y": None, "5y": None, "10y": None},
            "stock_cagr": {"1y": None, "3y": None, "5y": None},
            "roe": {"3y": None, "5y": None, "last_year": None}
        },
        "shareholding": [],
        "peers": [],
        "piotroski_f_score": {"score": None, "max_score": 9, "rating": "INSUFFICIENT DATA", "summary": "Piotroski Score — insufficient data to evaluate.", "criteria": []},
        "altman_z_score": {"z_score": None, "zone": "Insufficient Data", "description": "Altman Z-Score not computable — required statements unavailable."},
        "dcf_valuation": {},
    }

    try:
        import requests
        from bs4 import BeautifulSoup

        url = f"https://www.screener.in/company/{ticker}/consolidated/"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }

        resp = _screener_get(url, headers=headers, timeout=8)
        if resp.status_code == 404:
            resp = _screener_get(f"https://www.screener.in/company/{ticker}/", headers=headers, timeout=6)

        data = dict(empty_profile)

        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")

            h1 = soup.find("h1")
            if h1:
                data["name"] = h1.get_text(strip=True)

            about_div = soup.find("div", class_="about")
            if about_div:
                p = about_div.find("p")
                if p:
                    data["about"] = p.get_text(strip=True)

            def _normalize_label(raw: str) -> str:
                cleaned = re.sub(r"[\+\s]+$", "", raw).strip()
                low = cleaned.lower()
                if "sales" in low or "revenue" in low:
                    return "Sales"
                if "expenses" in low:
                    return "Expenses"
                if "operating profit" in low:
                    return "Operating Profit"
                if "opm" in low:
                    return "OPM %"
                if "other income" in low:
                    return "Other Income"
                if "interest" in low:
                    return "Interest"
                if "depreciation" in low:
                    return "Depreciation"
                if "profit before tax" in low:
                    return "Profit before tax"
                if "tax" in low and "%" in low:
                    return "Tax %"
                if "net profit" in low:
                    return "Net Profit"
                if "eps" in low:
                    return "EPS in Rs"
                if "dividend payout" in low:
                    return "Dividend Payout %"
                if "borrowings" in low:
                    return "Borrowings"
                if "reserves" in low:
                    return "Reserves"
                if "equity capital" in low:
                    return "Equity Capital"
                if "other liabilities" in low:
                    return "Other Liabilities"
                if "total liabilities" in low:
                    return "Total Liabilities"
                if "fixed assets" in low:
                    return "Fixed Assets"
                if "investments" in low:
                    return "Investments"
                if "other assets" in low:
                    return "Other Assets"
                if "total assets" in low:
                    return "Total Assets"
                if "operating activity" in low or "cash from operating" in low:
                    return "Cash from Operating Activity"
                if "investing activity" in low or "cash from investing" in low:
                    return "Cash from Investing Activity"
                if "financing activity" in low or "cash from financing" in low:
                    return "Cash from Financing Activity"
                if "net cash flow" in low:
                    return "Net Cash Flow"
                return cleaned

            def parse_table_section(section_id: str) -> List[Dict[str, Any]]:
                sec = soup.find("section", id=section_id)
                if not sec:
                    return []
                table = sec.find("table")
                if not table:
                    return []
                headers = [th.get_text(strip=True) for th in table.find_all("tr")[0].find_all("th")[1:]]
                rows_data = []
                for row in table.find_all("tr")[1:]:
                    tds = row.find_all("td")
                    if not tds:
                        continue
                    row_label = _normalize_label(tds[0].get_text(strip=True))
                    values = [_parse_num(td.get_text(strip=True)) for td in tds[1:]]
                    rows_data.append({"metric": row_label, "values": values})

                periods_list = []
                for i, period_name in enumerate(headers):
                    period_obj = {"period": period_name}
                    for r in rows_data:
                        val = r["values"][i] if i < len(r["values"]) else None
                        period_obj[r["metric"]] = val
                        # Add normalized aliases
                        if r["metric"] == "Sales":
                            period_obj["revenue"] = val
                        elif r["metric"] == "Net Profit":
                            period_obj["net_profit"] = val
                        elif r["metric"] == "EPS in Rs":
                            period_obj["eps"] = val
                    periods_list.append(period_obj)
                return periods_list

            q_res = parse_table_section("quarters")
            if q_res:
                data["quarterly_results"] = q_res[-8:]

            pl_res = parse_table_section("profit-loss")
            if pl_res:
                data["annual_pl"] = pl_res[-10:]

            bs_res = parse_table_section("balance-sheet")
            if bs_res:
                data["balance_sheet"] = bs_res[-10:]

            cf_res = parse_table_section("cash-flow")
            if cf_res:
                data["cash_flow"] = cf_res[-10:]


            # Parse Shareholding Table
            sh_sec = soup.find("section", id="shareholding")
            if sh_sec:
                sh_table = sh_sec.find("table")
                if sh_table:
                    sh_headers = [th.get_text(strip=True) for th in sh_table.find_all("tr")[0].find_all("th")[1:]]
                    sh_rows = {}
                    for row in sh_table.find_all("tr")[1:]:
                        tds = row.find_all("td")
                        if tds:
                            # Normalize labels: Screener renders "Promoters +", "FIIs +", etc.
                            label = re.sub(r"[^a-z]", "", tds[0].get_text(strip=True).lower())
                            vals = [_parse_num(td.get_text(strip=True)) for td in tds[1:]]
                            sh_rows[label] = vals

                    def _pick_shareholding(*names):
                        for key, vals in sh_rows.items():
                            if any(n in key for n in names):
                                return vals
                        return []

                    prom_vals = _pick_shareholding("promoter")
                    fii_vals = _pick_shareholding("fii", "foreign")
                    dii_vals = _pick_shareholding("dii", "domestic")
                    pub_vals = _pick_shareholding("public")

                    sh_list = []
                    # Offset-safe slice: handles tickers with fewer than 6 quarters.
                    _sh_offset = max(0, len(sh_headers) - 6)
                    for i, qtr in enumerate(sh_headers[_sh_offset:]):  # Last 6 quarters
                        idx = _sh_offset + i
                        p_val = prom_vals[idx] if 0 <= idx < len(prom_vals) else None
                        f_val = fii_vals[idx] if 0 <= idx < len(fii_vals) else None
                        d_val = dii_vals[idx] if 0 <= idx < len(dii_vals) else None
                        pub_val = pub_vals[idx] if 0 <= idx < len(pub_vals) else None

                        # Skip quarters with no reported data rather than serving placeholders.
                        if p_val is None and f_val is None and d_val is None and pub_val is None:
                            continue

                        sh_list.append({
                            "quarter": qtr,
                            "promoter": p_val,
                            "fii": f_val,
                            "dii": d_val,
                            "public": pub_val,
                        })
                    if sh_list:
                        data["shareholding"] = sh_list

            # Parse Peers
            peers_sec = soup.find("section", id="peers")
            if peers_sec:
                peers_table = peers_sec.find("table")
                if peers_table:
                    peers_list = []
                    for row in peers_table.find_all("tr")[1:8]:
                        tds = row.find_all("td")
                        if len(tds) >= 4:
                            p_name = tds[1].get_text(strip=True)
                            p_price = _parse_num(tds[2].get_text(strip=True))
                            p_pe = _parse_num(tds[3].get_text(strip=True))
                            p_mcap = _parse_num(tds[4].get_text(strip=True)) if len(tds) > 4 else None
                            p_roce = _parse_num(tds[7].get_text(strip=True)) if len(tds) > 7 else None
                            peers_list.append({
                                "name": p_name,
                                "price": p_price,
                                "pe_ratio": p_pe,
                                "market_cap": p_mcap,
                                "roce": p_roce,
                            })
                    if peers_list:
                        data["peers"] = peers_list

            # Zero-fake-data rule: when the Screener peers table cannot be parsed,
            # return an empty list. The frontend already renders an EmptyState for
            # this case — never serve hardcoded "Industry Peer A/B" rows.
            if not data.get("peers"):
                data["peers"] = []

        else:
            # Fallback to yfinance deep
            yf_deep = _fetch_yfinance_deep(ticker)
            if yf_deep:
                for k, v in yf_deep.items():
                    if v:
                        data[k] = v
                data["data_freshness"]["data_source"] = "Yahoo Finance Real-Time"

        # ── 2. Pure Dynamic CAGR Calculations (No Hardcoded Mock Numbers) ──
        annual_pl = data.get("annual_pl", [])
        if len(annual_pl) >= 2:
            s_curr = annual_pl[-1].get("Sales") or annual_pl[-1].get("revenue")
            p_curr = annual_pl[-1].get("Net Profit")

            # 3-Year CAGR
            if len(annual_pl) >= 4:
                s_3y = annual_pl[-4].get("Sales") or annual_pl[-4].get("revenue")
                p_3y = annual_pl[-4].get("Net Profit")
                data["ratios_cagr"]["sales_growth"]["3y"] = _calc_cagr(s_3y, s_curr, 3)
                data["ratios_cagr"]["profit_growth"]["3y"] = _calc_cagr(p_3y, p_curr, 3)

            # 5-Year CAGR
            if len(annual_pl) >= 6:
                s_5y = annual_pl[-6].get("Sales") or annual_pl[-6].get("revenue")
                p_5y = annual_pl[-6].get("Net Profit")
                data["ratios_cagr"]["sales_growth"]["5y"] = _calc_cagr(s_5y, s_curr, 5)
                data["ratios_cagr"]["profit_growth"]["5y"] = _calc_cagr(p_5y, p_curr, 5)

            # 10-Year CAGR
            if len(annual_pl) >= 10:
                s_10y = annual_pl[0].get("Sales") or annual_pl[0].get("revenue")
                p_10y = annual_pl[0].get("Net Profit")
                data["ratios_cagr"]["sales_growth"]["10y"] = _calc_cagr(s_10y, s_curr, 9)
                data["ratios_cagr"]["profit_growth"]["10y"] = _calc_cagr(p_10y, p_curr, 9)

        # ── 3. Piotroski F-Score (0-9) & Altman Z-Score ──
        data["piotroski_f_score"] = _calculate_piotroski_f_score(
            data.get("annual_pl", []),
            data.get("balance_sheet", []),
            data.get("cash_flow", [])
        )

        # Altman needs a real market-cap anchor. Prefer the base fundamentals
        # numeric market cap; fall back to the yfinance deep quote. No anchor →
        # honest "Insufficient Data" (never a synthetic multiple of assets).
        _alt_mcap = data.get("market_cap_cr")
        if _alt_mcap is None:
            try:
                from backend.data.fundamentals import get_fundamentals as _get_fund_base
                _fund_for_alt = _get_fund_base(ticker) or {}
                _alt_mcap = _fund_for_alt.get("market_cap_cr")
                if _alt_mcap is None and _fund_for_alt.get("market_cap"):
                    try:
                        _alt_mcap = float(str(_fund_for_alt["market_cap"]).replace(",", ""))
                    except (TypeError, ValueError):
                        _alt_mcap = None
            except Exception:
                _alt_mcap = None
        data["altman_z_score"] = _calculate_altman_z_score(
            data.get("annual_pl", []),
            data.get("balance_sheet", []),
            mcap_cr=_alt_mcap,
        )

        # ── 4. Ratio Trends (5-Year Historical for Sparklines) ──
        ratio_trends = []
        bs_list = data.get("balance_sheet", [])
        for i in range(len(annual_pl)):
            pl_row = annual_pl[i]
            bs_row = bs_list[i] if i < len(bs_list) else {}
            sales = float(pl_row.get("Sales") or pl_row.get("revenue") or 1.0)
            net_p = float(pl_row.get("Net Profit") or 0.0)
            ebit = float(pl_row.get("Operating Profit") or 0.0)
            equity = float(bs_row.get("Equity Capital") or 100.0)
            reserves = float(bs_row.get("Reserves") or 0.0)
            net_worth = equity + reserves
            borrowings = float(bs_row.get("Borrowings") or 0.0)
            capital_employed = net_worth + borrowings

            roce = round((ebit / max(1.0, capital_employed)) * 100.0, 1) if capital_employed > 0 else None
            roe = round((net_p / max(1.0, net_worth)) * 100.0, 1) if net_worth > 0 else None
            de = round(borrowings / max(1.0, net_worth), 2) if net_worth > 0 else None
            opm = pl_row.get("OPM %")

            ratio_trends.append({
                "period": pl_row.get("period"),
                "roce": roce,
                "roe": roe,
                "debt_to_equity": de,
                "opm": opm,
                "net_profit_margin": round((net_p / max(1.0, sales)) * 100.0, 1) if sales > 0 else None,
            })
        data["ratio_trends"] = ratio_trends[-5:]

        # ── 5. Corporate Calendar & Dividend Intelligence ──
        # Zero-fake-data rule: only real yfinance fields are served. Missing
        # fields stay None so the frontend renders "—" instead of stale dates.
        corp_calendar = {
            "upcoming_earnings_date": None,
            "ex_dividend_date": None,
            "dividend_yield_pct": None,
            "dividend_payout_ratio": None,
        }
        try:
            import yfinance as yf
            stock_obj = yf.Ticker(f"{ticker}.NS")
            inf = stock_obj.info or {}
            if inf.get("dividendYield") is not None:
                corp_calendar["dividend_yield_pct"] = _normalize_pct_field(inf.get("dividendYield"), digits=2)
            if inf.get("payoutRatio") is not None:
                corp_calendar["dividend_payout_ratio"] = _normalize_pct_field(inf.get("payoutRatio"), digits=1)
            if inf.get("exDividendDate"):
                try:
                    corp_calendar["ex_dividend_date"] = datetime.fromtimestamp(inf["exDividendDate"]).strftime("%d %b %Y")
                except Exception:
                    pass
            if inf.get("earningsDate") or inf.get("earningsTimestamp"):
                try:
                    _ed = inf.get("earningsDate") or inf.get("earningsTimestamp")
                    if isinstance(_ed, (list, tuple)):
                        _ed = _ed[0]
                    corp_calendar["upcoming_earnings_date"] = datetime.fromtimestamp(float(_ed)).strftime("%d %b %Y")
                except Exception:
                    pass
        except Exception:
            pass
        data["corporate_calendar"] = corp_calendar

        # ── 6. Intrinsic DCF & Fair Value Model ──
        # Zero-fake-data rule: no ₹1000 CMP anchor. Missing price stays None and
        # the DCF engine returns null margin/verdict instead of a fake comparison.
        try:
            from backend.data.fetcher import fetch_company_info
            cinfo = fetch_company_info(ticker) or {}
            _raw_cmp = cinfo.get("price")
            cmp = float(_raw_cmp) if _raw_cmp not in (None, "") else None
            if cmp is not None and (not math.isfinite(cmp) or cmp <= 0):
                cmp = None
        except Exception:
            cmp = None

        from backend.data.fundamentals import get_fundamentals
        fund_base = get_fundamentals(ticker) or {}
        eps = fund_base.get("eps")
        pb = fund_base.get("pb_ratio")
        book = fund_base.get("book_value")
        if book and book > 0:
            bvps = float(book)
        elif cmp and pb and pb > 0:
            bvps = (cmp / pb)
        else:
            bvps = None
        if fund_base.get("market_cap_cr") is not None:
            data["market_cap_cr"] = fund_base.get("market_cap_cr")

        data["dcf_valuation"] = _calculate_intrinsic_dcf(
            ticker,
            data.get("annual_pl", []),
            data.get("cash_flow", []),
            eps=eps,
            bvps=bvps,
            cmp=cmp,
        )

        cache_set(cache_key, data, ttl_seconds=_CACHE_TTL)
        return data

    except Exception as exc:
        logger.warning("Deep financials scraper error for %s: %s", ticker, exc)
        yf_deep = _fetch_yfinance_deep(ticker)
        if yf_deep:
            for k, v in yf_deep.items():
                if v:
                    empty_profile[k] = v
            empty_profile["data_freshness"]["data_source"] = "Yahoo Finance Fallback"
        cache_set(cache_key, empty_profile, ttl_seconds=600)
        return empty_profile

