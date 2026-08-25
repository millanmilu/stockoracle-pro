import time
import logging
import re
from typing import Optional

logger = logging.getLogger("stockoracle.fundamentals")

# In-memory cache: { ticker: (data_dict, timestamp) }
_cache: dict = {}
_CACHE_TTL = 4 * 3600  # 4 hours


def _parse_number(text: str) -> Optional[float]:
    """Extract first numeric value from a string like '23.45 %' or '1,234.56'."""
    if not text:
        return None
    text = text.strip().replace(",", "")
    # Remove currency symbols, %, Cr etc.
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
    Scrapes Screener.in for fundamental data for the given NSE ticker.
    Returns a dict with ratios, quarterly results, and 5-year trends.
    Results are cached for 4 hours.
    """
    ticker = ticker.upper().strip()

    # Check cache
    if ticker in _cache:
        data, ts = _cache[ticker]
        if time.time() - ts < _CACHE_TTL:
            return data

    empty = {
        "ticker": ticker,
        "market_cap": None,
        "pe_ratio": None,
        "pb_ratio": None,
        "eps": None,
        "roe": None,
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

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        url = f"https://www.screener.in/company/{ticker}/consolidated/"
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 404:
            # Try standalone (non-consolidated)
            url = f"https://www.screener.in/company/{ticker}/"
            resp = requests.get(url, headers=headers, timeout=10)

        if resp.status_code != 200:
            logger.warning("Screener.in returned %s for %s", resp.status_code, ticker)
            _cache[ticker] = (empty, time.time())
            return empty

        soup = BeautifulSoup(resp.text, "html.parser")
        data = dict(empty)

        # ── Key Ratios ────────────────────────────────────────────────────────
        ratio_items = soup.select("#top-ratios li, .company-ratios li, ul.company-ratios li")
        if not ratio_items:
            ratio_container = soup.find(id="top-ratios") or soup.find("div", class_="company-ratios")
            if ratio_container:
                ratio_items = ratio_container.find_all("li")

        for li in ratio_items:
            name_el = li.find(class_="name") or li.find("span")
            val_el = li.find(class_="value") or li.find(class_="nowrap") or li.find(class_="number")
            
            text_full = li.get_text(" ", strip=True).lower()
            name = name_el.get_text(strip=True).lower() if name_el else text_full
            val_text = val_el.get_text(strip=True) if val_el else li.get_text(strip=True)
            val = _parse_number(val_text)

            if "market cap" in name or "market cap" in text_full:
                data["market_cap"] = val_text.strip()
            elif "stock p/e" in name or "p/e" in name:
                data["pe_ratio"] = val
            elif "book value" in name or "p/b" in name:
                data["pb_ratio"] = val
            elif "roce" in name or "return on capital" in name:
                data["roce"] = val
            elif "return on equity" in name or "roe" in name:
                data["roe"] = val
            elif "eps" in name:
                data["eps"] = val
            elif ("debt" in name and "equity" in name) or "debt to equity" in text_full:
                data["debt_to_equity"] = val

        # ── Shareholding — Promoter & FII ─────────────────────────────────────
        share_section = soup.find("section", id="shareholding") or soup.find(id="shareholding")
        if share_section:
            rows = share_section.find_all("tr")
            for row in rows:
                cells = row.find_all("td")
                if not cells:
                    cells = row.find_all("th")
                if len(cells) >= 2:
                    label = cells[0].get_text(strip=True).lower()
                    val = _parse_number(cells[-1].get_text(strip=True))
                    if "promoter" in label:
                        data["promoter_holding"] = val
                    elif "fii" in label or "foreign" in label:
                        data["fii_holding"] = val

        # ── Quarterly Results ─────────────────────────────────────────────────
        quarterly = []
        results_section = soup.find("section", id="quarters")
        if results_section:
            table = results_section.find("table")
            if table:
                headers_row = table.find("thead")
                periods = []
                if headers_row:
                    for th in headers_row.find_all("th")[1:]:
                        periods.append(th.get_text(strip=True))

                rows_data = {}
                for tr in table.find("tbody", {}).find_all("tr") if table.find("tbody") else []:
                    cells = tr.find_all("td")
                    if not cells:
                        continue
                    row_label = cells[0].get_text(strip=True).lower()
                    values = [_parse_number(c.get_text(strip=True)) for c in cells[1:]]
                    rows_data[row_label] = values

                for i, period in enumerate(periods[:8]):
                    q = {"period": period, "revenue": None, "net_profit": None, "eps": None}
                    for key in rows_data:
                        if "sales" in key or "revenue" in key:
                            q["revenue"] = rows_data[key][i] if i < len(rows_data[key]) else None
                        elif "net profit" in key or "profit after" in key:
                            q["net_profit"] = rows_data[key][i] if i < len(rows_data[key]) else None
                        elif key == "eps":
                            q["eps"] = rows_data[key][i] if i < len(rows_data[key]) else None
                    quarterly.append(q)
        data["quarterly_results"] = quarterly

        # ── Annual Revenue & Profit (5Y) ──────────────────────────────────────
        revenue_5y = []
        profit_5y = []
        annual_section = soup.find("section", id="profit-loss")
        if annual_section:
            table = annual_section.find("table")
            if table:
                header_row = table.find("thead")
                years = []
                if header_row:
                    for th in header_row.find_all("th")[1:6]:
                        years.append(th.get_text(strip=True))

                for tr in table.find("tbody", {}).find_all("tr") if table.find("tbody") else []:
                    cells = tr.find_all("td")
                    if not cells:
                        continue
                    row_label = cells[0].get_text(strip=True).lower()
                    values = [_parse_number(c.get_text(strip=True)) for c in cells[1:6]]
                    if "sales" in row_label or "revenue" in row_label:
                        revenue_5y = [{"year": y, "value": v} for y, v in zip(years, values)]
                    elif "net profit" in row_label:
                        profit_5y = [{"year": y, "value": v} for y, v in zip(years, values)]

        data["revenue_5y"] = revenue_5y
        data["profit_5y"] = profit_5y

        _cache[ticker] = (data, time.time())
        return data

    except Exception as exc:
        logger.warning("Fundamentals scraping failed for %s: %s", ticker, exc)
        _cache[ticker] = (empty, time.time())
        return empty
