"""
StockOracle Pro — Options Analytics, Max Pain, PCR & Black-Scholes Greeks Engine
Fetches real-time NSE options chain and computes institutional derivatives metrics.
"""
import time
import math
import logging
from typing import Optional, Dict, Any, List
from scipy.stats import norm

from backend.shared.cache import cache_get, cache_set

logger = logging.getLogger("stockoracle.options")

_CACHE_TTL = 120  # 2 minutes


def calculate_black_scholes_greeks(
    spot: float, strike: float, time_to_expiry_years: float,
    volatility: float, risk_free_rate: float = 0.07, option_type: str = "CE"
) -> Dict[str, Optional[float]]:
    """
    Computes Black-Scholes Delta, Gamma, Theta, and Vega for a given option contract.
    """
    if spot <= 0 or strike <= 0 or time_to_expiry_years <= 0 or volatility <= 0:
        return {"delta": None, "gamma": None, "theta": None, "vega": None}

    try:
        S = float(spot)
        K = float(strike)
        T = max(time_to_expiry_years, 0.001)
        r = float(risk_free_rate)
        sigma = float(volatility) / 100.0 if volatility > 1.0 else float(volatility)

        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)

        pdf_d1 = norm.pdf(d1)

        gamma = round(pdf_d1 / (S * sigma * math.sqrt(T)), 4)
        vega = round((S * pdf_d1 * math.sqrt(T)) / 100.0, 4)

        if option_type.upper() == "CE":
            delta = round(norm.cdf(d1), 3)
            theta = round(
                (-(S * pdf_d1 * sigma) / (2 * math.sqrt(T)) - r * K * math.exp(-r * T) * norm.cdf(d2)) / 365.0,
                3
            )
        else:
            delta = round(norm.cdf(d1) - 1.0, 3)
            theta = round(
                (-(S * pdf_d1 * sigma) / (2 * math.sqrt(T)) + r * K * math.exp(-r * T) * norm.cdf(-d2)) / 365.0,
                3
            )

        return {"delta": delta, "gamma": gamma, "theta": theta, "vega": vega}
    except Exception:
        return {"delta": None, "gamma": None, "theta": None, "vega": None}


def _compute_max_pain(chain: list) -> Optional[float]:
    """
    Max Pain = strike price where total option writer losses are minimized.
    """
    if not chain:
        return None
    try:
        strikes = [item["strike_price"] for item in chain]
        call_oi = {item["strike_price"]: item.get("call_oi", 0) for item in chain}
        put_oi = {item["strike_price"]: item.get("put_oi", 0) for item in chain}
        min_pain = float("inf")
        max_pain_strike = strikes[0]
        for k in strikes:
            total = sum(max(0, k - s) * call_oi.get(s, 0) + max(0, s - k) * put_oi.get(s, 0) for s in strikes)
            if total < min_pain:
                min_pain = total
                max_pain_strike = k
        return float(max_pain_strike)
    except Exception:
        return None


def _get_pcr_sentiment(pcr: Optional[float]) -> str:
    """Classifies market sentiment based on Put-Call Ratio."""
    if pcr is None:
        return "NEUTRAL"
    if pcr >= 1.35:
        return "STRONGLY BULLISH (Heavy Put Writing)"
    elif pcr >= 1.05:
        return "BULLISH"
    elif pcr >= 0.85:
        return "NEUTRAL / BALANCED"
    elif pcr >= 0.65:
        return "BEARISH"
    else:
        return "STRONGLY BEARISH (Heavy Call Writing)"


def get_options_chain(ticker: str, expiry: str = None) -> dict:
    """
    Fetches the NSE options chain for the given ticker.
    Returns underlying value, expiry dates, ATM-filtered chain with Greeks, Max Pain, and PCR.
    """
    ticker = ticker.upper().strip()
    cache_key = f"opt_chain_{ticker}_{expiry or 'default'}"

    cached = cache_get(cache_key)
    if cached:
        return cached

    empty = {
        "ticker": ticker,
        "underlying_value": None,
        "expiry_dates": [],
        "selected_expiry": None,
        "chain": [],
        "max_pain": None,
        "pcr": None,
        "pcr_sentiment": "NEUTRAL",
        "total_call_oi": 0,
        "total_put_oi": 0,
        "error": None,
    }

    try:
        import requests
        session = requests.Session()
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.nseindia.com/",
            "Connection": "keep-alive",
        }

        # Step 1: Seed cookies
        session.get("https://www.nseindia.com", headers=headers, timeout=8)

        # Step 2: Fetch option chain
        url = f"https://www.nseindia.com/api/option-chain-equities?symbol={ticker}"
        resp = session.get(url, headers=headers, timeout=10)

        if resp.status_code != 200:
            empty["error"] = f"NSE returned HTTP {resp.status_code}"
            cache_set(cache_key, empty, ttl_seconds=_CACHE_TTL)
            return empty

        raw = resp.json()
        records = raw.get("records", {})
        underlying = float(records.get("underlyingValue", 0) or 0)
        expiry_dates = records.get("expiryDates", [])

        selected = expiry if expiry and expiry in expiry_dates else (expiry_dates[0] if expiry_dates else None)

        # Approximate time to expiry in years
        tte_years = 14 / 365.0

        chain = []
        data_list = records.get("data", [])
        for item in data_list:
            if selected and item.get("expiryDate") != selected:
                continue
            ce = item.get("CE", {})
            pe = item.get("PE", {})
            strike = float(item.get("strikePrice", 0))

            ce_iv = float(ce.get("impliedVolatility", 0) or 0) or None
            pe_iv = float(pe.get("impliedVolatility", 0) or 0) or None

            ce_greeks = calculate_black_scholes_greeks(underlying, strike, tte_years, ce_iv or 20.0, option_type="CE")
            pe_greeks = calculate_black_scholes_greeks(underlying, strike, tte_years, pe_iv or 20.0, option_type="PE")

            chain.append({
                "strike_price": strike,
                "call_oi": int(ce.get("openInterest", 0) or 0),
                "call_oi_change": int(ce.get("changeinOpenInterest", 0) or 0),
                "call_volume": int(ce.get("totalTradedVolume", 0) or 0),
                "call_iv": ce_iv,
                "call_ltp": float(ce.get("lastPrice", 0) or 0),
                "call_delta": ce_greeks["delta"],
                "call_theta": ce_greeks["theta"],
                "put_oi": int(pe.get("openInterest", 0) or 0),
                "put_oi_change": int(pe.get("changeinOpenInterest", 0) or 0),
                "put_volume": int(pe.get("totalTradedVolume", 0) or 0),
                "put_iv": pe_iv,
                "put_ltp": float(pe.get("lastPrice", 0) or 0),
                "put_delta": pe_greeks["delta"],
                "put_theta": pe_greeks["theta"],
            })

        total_call_oi = sum(c["call_oi"] for c in chain)
        total_put_oi = sum(c["put_oi"] for c in chain)
        pcr = round(total_put_oi / total_call_oi, 3) if total_call_oi > 0 else None
        max_pain = _compute_max_pain(chain)

        result = {
            "ticker": ticker,
            "underlying_value": underlying,
            "expiry_dates": expiry_dates,
            "selected_expiry": selected,
            "chain": chain,
            "max_pain": max_pain,
            "pcr": pcr,
            "pcr_sentiment": _get_pcr_sentiment(pcr),
            "total_call_oi": total_call_oi,
            "total_put_oi": total_put_oi,
            "error": None,
        }

        cache_set(cache_key, result, ttl_seconds=_CACHE_TTL)
        return result

    except Exception as exc:
        logger.warning("Options chain fetch failed for %s: %s", ticker, exc)
        empty["error"] = f"Options data unavailable: {exc}"
        cache_set(cache_key, empty, ttl_seconds=_CACHE_TTL)
        return empty
