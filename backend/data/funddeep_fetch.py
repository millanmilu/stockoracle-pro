"""Backend/data internals for fundamentals deep pipeline. AUTO-SPLIT from
fundamentals_deep.py -- content unchanged. Must never import
backend.data.fundamentals_deep (import cycle).
"""
from .funddeep_helpers import *  # noqa: F401,F403
from .funddeep_helpers import _sector_peers_from_universe

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


def _fetch_universe_fallback(ticker: str) -> Dict[str, Any]:
    """Reference-row baseline used when Screener.in and Yahoo are unreachable.

    Returns ONLY fields the curated reference row actually carries — identity,
    sector, price, ratios, market cap — and **never synthesises financial
    statements**.

    It used to invent a 5-year P&L, four quarters, a balance sheet, a cash-flow
    statement and a shareholding pattern (the last with the *same* promoter/FII/
    DII/public split for every company), derived from a hardcoded 12%/14% growth
    default and a ₹100,000 revenue fallback — while the profile still advertised
    itself as "Verified". The invented series then fed the CAGR block below, so
    `ratios_cagr` was computed from fabricated inputs and looked authoritative.

    Invented statements are worse than absent ones: the UI renders an empty
    statement as an honest gap, but a fabricated one reads as fact. Callers must
    treat this as a reference baseline, never as audited statements.
    """
    t = (ticker or "").upper().strip()
    try:
        from backend.data.seed_screener_metrics import MASTER_NSE_UNIVERSE
        match = next((item for item in (MASTER_NSE_UNIVERSE or []) if str(item.get("ticker", "")).upper() == t), None)
    except Exception as exc:
        logger.debug("Universe fallback lookup error: %s", exc)
        match = None

    if not match:
        return {}

    name = match.get("name") or t
    sector = match.get("sector") or "General"
    cmp_val = match.get("close_price")
    pe = match.get("pe_ratio")
    pb = match.get("pb_ratio")
    mcap_cr = match.get("market_cap_cr")
    # EPS/PBV are exact rearrangements of a real price and a real multiple, not
    # invented observations.
    eps = round(cmp_val / pe, 2) if (cmp_val and pe and pe > 0) else None
    bvps = round(cmp_val / pb, 2) if (cmp_val and pb and pb > 0) else None

    try:
        peers = _sector_peers_from_universe(t)
    except Exception as exc:
        logger.debug("Sector peers fallback failed for %s: %s", t, exc)
        peers = []

    return {
        "name": name,
        "sector": sector,
        "about": (
            f"{name} ({t}) is a constituent of the National Stock Exchange (NSE) "
            "tracked universe. Verified statements are unavailable right now."
        ),
        # Explicitly empty — the UI must show "no statements" rather than read
        # fabricated numbers as fact.
        "annual_pl": [],
        "quarterly_results": [],
        "balance_sheet": [],
        "cash_flow": [],
        "shareholding": [],
        "peers": peers,
        "cmp": cmp_val,
        "eps": eps,
        "book_value": bvps,
        "mcap_cr": mcap_cr,
        "market_cap_cr": mcap_cr,
        "pe_ratio": pe,
        "pb_ratio": pb,
        "roce": match.get("roce_pct"),
        "roe": match.get("roe_pct"),
        "debt_to_equity": match.get("debt_to_equity"),
    }


def _finalize_freshness_status(data: Dict[str, Any]) -> None:
    """Sets ``data_freshness.status`` from what the payload ACTUALLY contains.

    "Verified" must mean verified — Screener.in statements were parsed. A profile
    with no statements (or one stitched together from the reference baseline)
    previously kept the verified label and, at one merge site, still pointed
    ``data_source`` at "Screener.in Consolidated + NSE Real-Time" while most of
    the payload was invented.
    """
    fresh = data.setdefault("data_freshness", {})
    source = str(fresh.get("data_source") or "")
    has_pl = bool(data.get("annual_pl"))
    has_bs = bool(data.get("balance_sheet"))
    has_sh = bool(data.get("shareholding"))

    if has_pl and has_bs and "Screener" in source:
        fresh["status"] = "Verified"
    elif has_pl or has_bs or has_sh:
        fresh["status"] = "Partial"
    else:
        fresh["status"] = "No verified statements"

    # Ratios without statements are still useful, but the reader must know that
    # growth/CAGR figures are absent rather than zero.
    cagr = data.get("ratios_cagr") or {}
    growth = (cagr.get("sales_growth") or {}).get("3y")
    if growth is None and not has_pl:
        fresh["statements_available"] = False
    else:
        fresh["statements_available"] = has_pl


