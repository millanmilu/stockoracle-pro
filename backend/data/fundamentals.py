"""
StockOracle Pro — Deep Financial Fundamentals & Earnings Trends Engine
Scrapes and parses Screener.in with QoQ growth metrics and Redis distributed caching.
"""
import re
import logging
from typing import Optional, Dict, Any, List

from backend.shared.cache import cache_get, cache_set

logger = logging.getLogger("stockoracle.fundamentals")

_CACHE_TTL = 4 * 3600  # 4 hours


def _parse_number(text: str) -> Optional[float]:
    """Extracts first numeric value from a string."""
    if not text:
        return None
    text = text.strip().replace(",", "")
    text = re.sub(r"[₹%CrLakh\s]+", " ", text).strip()
    match = re.search(r"-?\d+\.?\d*", text)
    if match:
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


def get_fundamentals(ticker: str) -> dict:
    """
    Fetches fundamental financial metrics and quarterly earnings for an NSE ticker.
    Includes calculated QoQ revenue and net profit growth percentages.
    """
    ticker = ticker.upper().strip()
    cache_key = f"fundamentals_{ticker}"

    cached = cache_get(cache_key)
    if cached:
        return cached

    empty = {
        "ticker": ticker,
        "market_cap": None,
        "pe_ratio": None,
        "pb_ratio": None,
        "eps": None,
        "roe": None,
        "roce": None,
        "debt_to_equity": None,
        "promoter_holding": None,
        "fii_holding": None,
        "quarterly_results": [],
        "revenue_5y": [],
        "profit_5y": [],
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

        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 404:
            # Try standalone URL if consolidated not available
            url = f"https://www.screener.in/company/{ticker}/"
            resp = requests.get(url, headers=headers, timeout=8)

        if resp.status_code != 200:
            logger.warning("Screener.in returned HTTP %d for %s", resp.status_code, ticker)
            cache_set(cache_key, empty, ttl_seconds=600)
            return empty

        soup = BeautifulSoup(resp.text, "html.parser")
        data = dict(empty)

        # 1. Parse top ratios
        ratios_list = soup.find("ul", id="top-ratios")
        if ratios_list:
            for li in ratios_list.find_all("li"):
                name_span = li.find("span", class_="name")
                val_span = li.find("span", class_="value") or li.find("span", class_="number")
                if not name_span or not val_span:
                    continue
                name = name_span.get_text(strip=True).lower()
                val_text = val_span.get_text(strip=True)
                val_num = _parse_number(val_text)

                if "market cap" in name:
                    data["market_cap"] = val_text
                elif "stock p/e" in name or name == "p/e":
                    data["pe_ratio"] = val_num
                elif "book value" in name:
                    data["pb_ratio"] = val_num
                elif "roce" in name:
                    data["roce"] = val_num
                elif "roe" in name:
                    data["roe"] = val_num
                elif "promoter holding" in name:
                    data["promoter_holding"] = val_num
                elif "debt to equity" in name:
                    data["debt_to_equity"] = val_num

        # 2. Parse Quarterly Results with QoQ Growth calculation
        q_section = soup.find("section", id="quarters")
        if q_section:
            table = q_section.find("table")
            if table:
                headers_row = table.find("tr")
                periods = [th.get_text(strip=True) for th in headers_row.find_all("th")[1:]] if headers_row else []

                sales_vals = []
                profit_vals = []
                eps_vals = []

                for row in table.find_all("tr"):
                    cells = row.find_all("td")
                    if not cells:
                        continue
                    row_name = cells[0].get_text(strip=True).lower()
                    values = [_parse_number(c.get_text(strip=True)) for c in cells[1:]]

                    if "sales" in row_name or "revenue" in row_name:
                        sales_vals = values
                    elif "net profit" in row_name:
                        profit_vals = values
                    elif "eps" in row_name:
                        eps_vals = values

                quarterly = []
                prev_rev = None
                prev_profit = None

                for i, period in enumerate(periods[-8:]):  # Last 8 quarters
                    idx = len(periods) - 8 + i
                    rev = sales_vals[idx] if idx < len(sales_vals) else None
                    profit = profit_vals[idx] if idx < len(profit_vals) else None
                    eps = eps_vals[idx] if idx < len(eps_vals) else None

                    # Calculate QoQ growth
                    rev_qoq = round(((rev - prev_rev) / abs(prev_rev)) * 100, 2) if (rev is not None and prev_rev and prev_rev != 0) else None
                    profit_qoq = round(((profit - prev_profit) / abs(prev_profit)) * 100, 2) if (profit is not None and prev_profit and prev_profit != 0) else None

                    quarterly.append({
                        "period": period,
                        "revenue": rev,
                        "net_profit": profit,
                        "eps": eps,
                        "revenue_qoq_pct": rev_qoq,
                        "profit_qoq_pct": profit_qoq,
                    })

                    prev_rev = rev
                    prev_profit = profit

                data["quarterly_results"] = quarterly

        cache_set(cache_key, data, ttl_seconds=_CACHE_TTL)
        return data

    except Exception as exc:
        logger.warning("Fundamentals scraper error for %s: %s", ticker, exc)
        cache_set(cache_key, empty, ttl_seconds=600)
        return empty
