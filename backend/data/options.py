import time
import logging
from typing import Optional

logger = logging.getLogger("stockoracle.options")

# In-memory cache: { (ticker, expiry): (data, timestamp) }
_cache: dict = {}
_CACHE_TTL = 120  # 2 minutes


def _compute_max_pain(chain: list) -> Optional[float]:
    """
    Max Pain = strike price where total option writer losses are minimized.
    For each strike K, compute total payout if stock settles at K:
        sum over all strikes S: max(0, K-S)*call_oi[S] + max(0, S-K)*put_oi[S]
    Return the K that minimizes this total.
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


def get_options_chain(ticker: str, expiry: str = None) -> dict:
    """
    Fetches the NSE options chain for the given ticker.
    Returns underlying value, expiry dates, ATM-filtered chain, max pain, PCR.
    Results are cached for 2 minutes.
    """
    ticker = ticker.upper().strip()
    cache_key = (ticker, expiry or "")

    # Check cache
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if time.time() - ts < _CACHE_TTL:
            return data

    empty = {
        "ticker": ticker,
        "underlying_value": None,
        "expiry_dates": [],
        "selected_expiry": None,
        "chain": [],
        "max_pain": None,
        "pcr": None,
        "error": None,
    }

    try:
        import requests

        session = requests.Session()
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": "https://www.nseindia.com/",
            "Connection": "keep-alive",
        }

        # Step 1: Seed NSE cookies
        session.get("https://www.nseindia.com", headers=headers, timeout=8)

        # Step 2: Fetch options chain
        url = f"https://www.nseindia.com/api/option-chain-equities?symbol={ticker}"
        resp = session.get(url, headers=headers, timeout=10)

        if resp.status_code != 200:
            empty["error"] = f"NSE returned HTTP {resp.status_code}"
            _cache[cache_key] = (empty, time.time())
            return empty

        raw = resp.json()
        records = raw.get("records", {})
        filtered = raw.get("filtered", {})

        underlying = float(records.get("underlyingValue", 0) or 0)
        expiry_dates = records.get("expiryDates", [])

        # Choose expiry
        selected = expiry if expiry and expiry in expiry_dates else (expiry_dates[0] if expiry_dates else None)

        # Build chain for selected expiry
        chain = []
        data_list = records.get("data", [])
        for item in data_list:
            if selected and item.get("expiryDate") != selected:
                continue
            ce = item.get("CE", {})
            pe = item.get("PE", {})
            strike = float(item.get("strikePrice", 0))
            chain.append({
                "strike_price": strike,
                "call_oi":       int(ce.get("openInterest", 0) or 0),
                "call_oi_change":int(ce.get("changeinOpenInterest", 0) or 0),
                "call_volume":   int(ce.get("totalTradedVolume", 0) or 0),
                "call_iv":       float(ce.get("impliedVolatility", 0) or 0) or None,
                "call_ltp":      float(ce.get("lastPrice", 0) or 0),
                "put_oi":        int(pe.get("openInterest", 0) or 0),
                "put_oi_change": int(pe.get("changeinOpenInterest", 0) or 0),
                "put_volume":    int(pe.get("totalTradedVolume", 0) or 0),
                "put_iv":        float(pe.get("impliedVolatility", 0) or 0) or None,
                "put_ltp":       float(pe.get("lastPrice", 0) or 0),
            })

        # PCR
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
            "error": None,
        }
        _cache[cache_key] = (result, time.time())
        return result

    except Exception as exc:
        logger.warning("Options chain fetch failed for %s: %s", ticker, exc)
        empty["error"] = f"Options data unavailable: {exc}"
        _cache[cache_key] = (empty, time.time())
        return empty
