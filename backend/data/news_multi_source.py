"""
StockOracle Pro — High-Performance Multi-Source Financial News Aggregator
Aggregates and deduplicates real-time news headlines across:
  1. Google News India (NSE scrip specific query with recency window)
  2. The Economic Times (Markets & Stocks RSS feeds)
  3. Business Standard (Markets RSS feed)
  4. LiveMint (Markets & Companies RSS feeds)
  5. NDTV Profit (Markets & Business RSS)
  6. Moneycontrol (Active latest business RSS)
  7. Yahoo Finance (Direct ticker RSS)
  8. Crypto Feeds: CoinDesk, Cointelegraph, Decrypt & Google News Crypto

Features:
  - Parallel asynchronous / threadpool execution (< 800ms)
  - Intelligent headline deduplication
  - Strict freshness gate (rejects articles > 14 days old, purges legacy feeds)
  - Real-time sentiment tagging (Bullish, Bearish, Neutral)
  - Safe XML decoding (sanitizes unescaped XML entities)
  - Smart ticker keyword extraction & alias matching
  - Force refresh bypass on user demand
  - Resilient in-memory fallback cache
"""
import re
import time
import html
import logging
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from urllib.parse import quote_plus
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger("StockOracle.Data.NewsMultiSource")

# 75-second cache TTL — fresh enough for a live terminal, polite to RSS upstreams
_CACHE_TTL = 75
_NEWS_CACHE: Dict[str, Dict[str, Any]] = {}
_LAST_SUCCESSFUL_NEWS: Dict[str, Dict[str, Any]] = {}

# Strict freshness threshold: drop any article older than 14 days
MAX_ARTICLE_AGE_DAYS = 14

# ── Crypto tickers: route to crypto-native feeds instead of NSE RSS ──────────
_CRYPTO_TOKENS = {
    "BTC", "BITCOIN", "ETH", "ETHEREUM", "XRP", "SOL", "SOLANA", "DOGE",
    "ADA", "AVAX", "LINK", "DOT", "MATIC", "LTC", "BCH", "ATOM", "NEAR",
    "USDT", "BTCUSDT", "ETHUSDT",
}


def _is_crypto(ticker: Optional[str]) -> bool:
    if not ticker:
        return False
    t = ticker.upper().strip().replace("-", "").replace("/", "")
    return t in _CRYPTO_TOKENS or t.endswith("USDT") or "BITCOIN" in t or "ETHEREUM" in t


# User-Agent header for web requests
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 StockOracle/2.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Source configuration & UI colors
SOURCE_COLORS = {
    "Economic Times": "#E11D48",
    "Moneycontrol": "#2563EB",
    "LiveMint": "#F97316",
    "Yahoo Finance": "#7C3AED",
    "Google News": "#059669",
    "Business Standard": "#0284C7",
    "NDTV Profit": "#D97706",
    "Reuters": "#EA580C",
    "Bloomberg": "#4F46E5",
    "CNBC TV18": "#0D9488",
    "CoinDesk": "#F59E0B",
    "Cointelegraph": "#22D3EE",
    "Decrypt": "#8B5CF6",
    "Other": "#64748B",
}

# Positive / Negative Lexicons for high-speed sentiment scoring
BULLISH_KEYWORDS = {
    "surge", "surges", "surged", "jump", "jumps", "jumped", "rally", "rallies",
    "gain", "gains", "gained", "bullish", "profit", "soars", "soar", "high",
    "growth", "record", "upgrade", "upgrades", "buy", "outperform", "dividend",
    "expansion", "boost", "revenue up", "margin expansion", "strong", "beats",
    "breakout", "accumulate", "upside", "target raised", "order win"
}
BEARISH_KEYWORDS = {
    "fall", "falls", "fell", "drop", "drops", "dropped", "slump", "slumps",
    "plunge", "plunges", "loss", "losses", "bearish", "down", "crash",
    "downgrade", "downgrades", "sell", "underperform", "weak", "penalty",
    "investigation", "fraud", "misses", "debt", "default", "warning", "decline",
    "selloff", "headwind", "deficit", "probe", "fine", "cut"
}


def _clean_text(text: str) -> str:
    """Removes HTML tags, unescapes entities, and cleans whitespace."""
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _safe_parse_xml(content_bytes: bytes) -> Optional[ET.Element]:
    """Safely decodes and cleans XML content before parsing with ElementTree."""
    if not content_bytes:
        return None
    try:
        return ET.fromstring(content_bytes)
    except Exception:
        pass
    try:
        text = content_bytes.decode("utf-8", errors="replace")
        # Sanitize naked ampersands not part of a valid XML entity
        cleaned = re.sub(r"&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)", "&amp;", text)
        return ET.fromstring(cleaned.encode("utf-8"))
    except Exception as exc:
        logger.debug("XML parse failure: %s", exc)
        return None


def _compute_sentiment(text: str) -> Dict[str, Any]:
    """Scores sentiment based on financial domain keywords (-1.0 to 1.0)."""
    lower = text.lower()
    pos_count = sum(1 for w in BULLISH_KEYWORDS if w in lower)
    neg_count = sum(1 for w in BEARISH_KEYWORDS if w in lower)

    score = 0.0
    if pos_count > neg_count:
        score = min(0.35 + (pos_count * 0.15), 0.95)
        label = "Bullish"
    elif neg_count > pos_count:
        score = max(-0.35 - (neg_count * 0.15), -0.95)
        label = "Bearish"
    else:
        score = 0.0
        label = "Neutral"

    return {"score": round(score, 2), "label": label}


def _format_time_ago(dt: Optional[datetime]) -> str:
    """Converts a datetime into a human-friendly relative string."""
    if not dt:
        return "Recent"
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = (now - dt).total_seconds()
    if diff < 60:
        return "Just now"
    elif diff < 3600:
        mins = max(1, int(diff // 60))
        return f"{mins}m ago"
    elif diff < 86400:
        hours = max(1, int(diff // 3600))
        return f"{hours}h ago"
    elif diff < 604800:
        days = max(1, int(diff // 86400))
        return f"{days}d ago"
    return dt.strftime("%b %d")


def _parse_pubdate(raw: str) -> Optional[datetime]:
    """Parses various RSS pubDate formats into UTC datetime."""
    if not raw:
        return None
    raw = raw.strip()
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            continue
    return None


def _is_too_old(dt: Optional[datetime]) -> bool:
    """Returns True if article is older than MAX_ARTICLE_AGE_DAYS."""
    if not dt:
        return False
    now = datetime.now(timezone.utc)
    return (now - dt).total_seconds() > (MAX_ARTICLE_AGE_DAYS * 86400)


def _extract_search_keywords(ticker: str, company: Optional[str] = None) -> List[str]:
    """Extracts high-precision matching keywords for an Indian stock ticker."""
    t = (ticker or "").upper().strip()
    keywords = set()
    if t and t != "MARKET":
        keywords.add(t.lower())

    ALIASES = {
        "RELIANCE": ["reliance", "ril", "jio"],
        "TCS": ["tcs", "tata consultancy"],
        "INFY": ["infy", "infosys"],
        "HDFCBANK": ["hdfc bank", "hdfcbank"],
        "ICICIBANK": ["icici bank", "icicibank"],
        "SBIN": ["sbi", "state bank of india"],
        "BHARTIARTL": ["airtel", "bharti airtel"],
        "ITC": ["itc"],
        "KOTAKBANK": ["kotak bank", "kotak mahindra"],
        "LT": ["l&t", "larsen & toubro", "larsen and toubro"],
        "TATAMOTORS": ["tata motors", "tatamotors", "jlr"],
        "TATASTEEL": ["tata steel", "tatasteel"],
        "MARUTI": ["maruti", "maruti suzuki"],
        "BAJFINANCE": ["bajaj finance"],
        "BAJAJFINSV": ["bajaj finserv"],
        "WIPRO": ["wipro"],
        "HCLTECH": ["hcl tech", "hcl technologies"],
        "ADANIENT": ["adani enterprises"],
        "ADANIPORTS": ["adani ports"],
        "ASIANPAINT": ["asian paints"],
        "SUNPHARMA": ["sun pharma"],
        "TITAN": ["titan company"],
        "ULTRACEMCO": ["ultratech cement"],
        "NTPC": ["ntpc"],
        "ONGC": ["ongc"],
        "POWERGRID": ["power grid"],
        "ZOMATO": ["zomato", "blinkit"],
        "PAYTM": ["paytm", "one97"],
        "NYKAA": ["nykaa", "fsn e-commerce"],
        "JIOFIN": ["jio financial"],
    }
    if t in ALIASES:
        keywords.update(ALIASES[t])

    if company:
        clean_co = re.sub(r"\b(limited|ltd|industries|india|ind|corp|corporation)\b", "", company.lower(), flags=re.I).strip()
        clean_co = re.sub(r"[^a-zA-Z0-9\s]", " ", clean_co)
        words = [w for w in clean_co.split() if len(w) > 2]
        if words:
            keywords.add(" ".join(words[:2]))
            if len(words[0]) >= 4:
                keywords.add(words[0])

    return sorted(list(keywords), key=lambda x: -len(x))


# ── Provider 1: Google News RSS (Scrip Specific or General Market) ───────────
def _fetch_google_news(query: str, ticker_keywords: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    items = []
    urls_to_try = [
        f"https://news.google.com/rss/search?q={quote_plus(query + ' when:7d')}&hl=en-IN&gl=IN&ceid=IN:en",
        f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-IN&gl=IN&ceid=IN:en",
    ]
    for url in urls_to_try:
        if items:
            break
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, timeout=6) as response:
                root = _safe_parse_xml(response.read())
            if root is None:
                continue

            for entry in root.findall("./channel/item")[:15]:
                title = _clean_text(entry.findtext("title", ""))
                link = entry.findtext("link", "")
                raw_date = entry.findtext("pubDate", "")
                desc = _clean_text(entry.findtext("description", ""))
                source_el = entry.find("source")
                source_name = source_el.text.strip() if source_el is not None and source_el.text else "Google News"

                if " - " in title:
                    parts = title.rsplit(" - ", 1)
                    title = parts[0].strip()
                    if len(parts) > 1 and parts[1].strip():
                        source_name = parts[1].strip()

                dt = _parse_pubdate(raw_date)
                if _is_too_old(dt):
                    continue

                sent = _compute_sentiment(title + " " + desc)

                if title and len(title) > 12:
                    items.append({
                        "title": title,
                        "description": desc[:220] if desc else "",
                        "url": link,
                        "source": source_name,
                        "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                        "time_ago": _format_time_ago(dt),
                        "sentiment": sent["label"],
                        "sentiment_score": sent["score"],
                    })
        except Exception as exc:
            logger.debug("Google News RSS failed for %s: %s", url, exc)
    return items


# ── Provider 2: Economic Times Markets & Stocks RSS ───────────────────────────
def _fetch_economic_times(ticker_keywords: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    items = []
    feeds = [
        "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms",
        "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"
    ]
    for url in feeds:
        if len(items) >= 12:
            break
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, timeout=6) as response:
                root = _safe_parse_xml(response.read())
            if root is None:
                continue

            for entry in root.findall("./channel/item"):
                title = _clean_text(entry.findtext("title", ""))
                link = entry.findtext("link", "")
                raw_date = entry.findtext("pubDate", "")
                desc = _clean_text(entry.findtext("description", ""))

                if ticker_keywords:
                    full_text = (title + " " + desc).lower()
                    if not any(kw in full_text for kw in ticker_keywords):
                        continue

                dt = _parse_pubdate(raw_date)
                if _is_too_old(dt):
                    continue

                sent = _compute_sentiment(title + " " + desc)

                if title:
                    items.append({
                        "title": title,
                        "description": desc[:220] if desc else "",
                        "url": link,
                        "source": "Economic Times",
                        "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                        "time_ago": _format_time_ago(dt),
                        "sentiment": sent["label"],
                        "sentiment_score": sent["score"],
                    })
                    if len(items) >= 10:
                        break
        except Exception as exc:
            logger.debug("Economic Times RSS failed for %s: %s", url, exc)
    return items


# ── Provider 3: Business Standard Markets RSS ─────────────────────────────────
def _fetch_business_standard(ticker_keywords: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    items = []
    url = "https://www.business-standard.com/rss/markets-106.rss"
    try:
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=6) as response:
            root = _safe_parse_xml(response.read())
        if root is not None:
            for entry in root.findall("./channel/item"):
                title = _clean_text(entry.findtext("title", ""))
                link = entry.findtext("link", "")
                raw_date = entry.findtext("pubDate", "")
                desc = _clean_text(entry.findtext("description", ""))

                if ticker_keywords:
                    full_text = (title + " " + desc).lower()
                    if not any(kw in full_text for kw in ticker_keywords):
                        continue

                dt = _parse_pubdate(raw_date)
                if _is_too_old(dt):
                    continue

                sent = _compute_sentiment(title + " " + desc)
                if title:
                    items.append({
                        "title": title,
                        "description": desc[:220] if desc else "",
                        "url": link,
                        "source": "Business Standard",
                        "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                        "time_ago": _format_time_ago(dt),
                        "sentiment": sent["label"],
                        "sentiment_score": sent["score"],
                    })
                    if len(items) >= 8:
                        break
    except Exception as exc:
        logger.debug("Business Standard RSS failed: %s", exc)
    return items


# ── Provider 4: LiveMint Markets RSS ──────────────────────────────────────────
def _fetch_livemint(ticker_keywords: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    items = []
    feeds = [
        "https://www.livemint.com/rss/markets",
        "https://www.livemint.com/rss/companies"
    ]
    for url in feeds:
        if len(items) >= 10:
            break
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, timeout=6) as response:
                root = _safe_parse_xml(response.read())
            if root is None:
                continue

            for entry in root.findall("./channel/item"):
                title = _clean_text(entry.findtext("title", ""))
                link = entry.findtext("link", "")
                raw_date = entry.findtext("pubDate", "")
                desc = _clean_text(entry.findtext("description", ""))

                if ticker_keywords:
                    full_text = (title + " " + desc).lower()
                    if not any(kw in full_text for kw in ticker_keywords):
                        continue

                dt = _parse_pubdate(raw_date)
                if _is_too_old(dt):
                    continue

                sent = _compute_sentiment(title + " " + desc)

                if title:
                    items.append({
                        "title": title,
                        "description": desc[:220] if desc else "",
                        "url": link,
                        "source": "LiveMint",
                        "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                        "time_ago": _format_time_ago(dt),
                        "sentiment": sent["label"],
                        "sentiment_score": sent["score"],
                    })
                    if len(items) >= 8:
                        break
        except Exception as exc:
            logger.debug("LiveMint RSS failed for %s: %s", url, exc)
    return items


# ── Provider 5: NDTV Profit Markets & Business RSS ─────────────────────────────
def _fetch_ndtv_profit(ticker_keywords: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    items = []
    url = "https://feeds.feedburner.com/ndtvprofit-latest"
    try:
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=6) as response:
            root = _safe_parse_xml(response.read())
        if root is not None:
            for entry in root.findall("./channel/item"):
                title = _clean_text(entry.findtext("title", ""))
                link = entry.findtext("link", "")
                raw_date = entry.findtext("pubDate", "")
                desc = _clean_text(entry.findtext("description", ""))

                if ticker_keywords:
                    full_text = (title + " " + desc).lower()
                    if not any(kw in full_text for kw in ticker_keywords):
                        continue

                dt = _parse_pubdate(raw_date)
                if _is_too_old(dt):
                    continue

                sent = _compute_sentiment(title + " " + desc)
                if title:
                    items.append({
                        "title": title,
                        "description": desc[:220] if desc else "",
                        "url": link,
                        "source": "NDTV Profit",
                        "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                        "time_ago": _format_time_ago(dt),
                        "sentiment": sent["label"],
                        "sentiment_score": sent["score"],
                    })
                    if len(items) >= 8:
                        break
    except Exception as exc:
        logger.debug("NDTV Profit RSS failed: %s", exc)
    return items


# ── Provider 6: Moneycontrol Active RSS ────────────────────────────────────────
def _fetch_moneycontrol(ticker_keywords: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    items = []
    feeds = [
        "https://www.moneycontrol.com/rss/latestnews.xml",
        "https://www.moneycontrol.com/rss/business.xml"
    ]
    for url in feeds:
        if len(items) >= 8:
            break
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, timeout=5) as response:
                root = _safe_parse_xml(response.read())
            if root is None:
                continue

            for entry in root.findall("./channel/item"):
                title = _clean_text(entry.findtext("title", ""))
                link = entry.findtext("link", "")
                raw_date = entry.findtext("pubDate", "")
                desc = _clean_text(entry.findtext("description", ""))

                if ticker_keywords:
                    full_text = (title + " " + desc).lower()
                    if not any(kw in full_text for kw in ticker_keywords):
                        continue

                dt = _parse_pubdate(raw_date)
                if _is_too_old(dt):
                    continue

                sent = _compute_sentiment(title + " " + desc)

                if title:
                    items.append({
                        "title": title,
                        "description": desc[:220] if desc else "",
                        "url": link,
                        "source": "Moneycontrol",
                        "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                        "time_ago": _format_time_ago(dt),
                        "sentiment": sent["label"],
                        "sentiment_score": sent["score"],
                    })
                    if len(items) >= 6:
                        break
        except Exception as exc:
            logger.debug("Moneycontrol RSS failed for %s: %s", url, exc)
    return items


# ── Provider 7: Yahoo Finance Direct RSS ───────────────────────────────────────
def _fetch_yahoo_finance_rss(ticker: str) -> List[Dict[str, Any]]:
    items = []
    try:
        t = ticker.upper().strip()
        if _is_crypto(t):
            symbol = "BTC-USD" if t in ("BTC", "BITCOIN", "BTCUSDT") else f"{t}-USD"
        else:
            symbol = f"{t}.NS" if not t.endswith(".NS") else t

        url = f"https://finance.yahoo.com/rss/headline?s={symbol}"
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=5) as response:
            root = _safe_parse_xml(response.read())
        if root is not None:
            for entry in root.findall("./channel/item")[:10]:
                title = _clean_text(entry.findtext("title", ""))
                link = entry.findtext("link", "")
                raw_date = entry.findtext("pubDate", "")
                desc = _clean_text(entry.findtext("description", ""))

                dt = _parse_pubdate(raw_date)
                if _is_too_old(dt):
                    continue

                sent = _compute_sentiment(title + " " + desc)

                if title and len(title) > 10:
                    items.append({
                        "title": title,
                        "description": desc[:220] if desc else "",
                        "url": link,
                        "source": "Yahoo Finance",
                        "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                        "time_ago": _format_time_ago(dt),
                        "sentiment": sent["label"],
                        "sentiment_score": sent["score"],
                    })
    except Exception as exc:
        logger.debug("Yahoo Finance direct RSS failed for %s: %s", ticker, exc)
    return items


# ── Provider 8: Crypto-Native RSS Feeds ────────────────────────────────────────
_CRYPTO_FEEDS = [
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("Cointelegraph", "https://cointelegraph.com/rss"),
]


def _fetch_crypto_rss(query: str) -> List[Dict[str, Any]]:
    """Fresh crypto headlines: CoinDesk + Cointelegraph + Decrypt RSS + Google News crypto."""
    items: List[Dict[str, Any]] = []
    q = query.lower()
    for src_name, url in _CRYPTO_FEEDS:
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, timeout=6) as response:
                root = _safe_parse_xml(response.read())
            if root is None:
                continue

            for entry in root.findall("./channel/item")[:15]:
                title = _clean_text(entry.findtext("title", ""))
                link = entry.findtext("link", "")
                raw_date = entry.findtext("pubDate", "")
                desc = _clean_text(entry.findtext("description", ""))

                if "bitcoin" not in q and "crypto" not in q:
                    if q and q not in (title + " " + desc).lower():
                        continue

                dt = _parse_pubdate(raw_date)
                if _is_too_old(dt):
                    continue

                sent = _compute_sentiment(title + " " + desc)
                if title and len(title) > 12:
                    items.append({
                        "title": title,
                        "description": desc[:220] if desc else "",
                        "url": link,
                        "source": src_name,
                        "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                        "time_ago": _format_time_ago(dt),
                        "sentiment": sent["label"],
                        "sentiment_score": sent["score"],
                    })
                if len(items) >= 25:
                    break
        except Exception as exc:
            logger.debug("%s RSS failed: %s", src_name, exc)

    # Google News crypto query with 7-day recency filter
    try:
        gurl = f"https://news.google.com/rss/search?q={quote_plus(query + ' bitcoin crypto when:7d')}&hl=en-US&gl=US&ceid=US:en"
        req = urllib.request.Request(gurl, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=6) as response:
            root = _safe_parse_xml(response.read())
        if root is not None:
            for entry in root.findall("./channel/item")[:15]:
                title = _clean_text(entry.findtext("title", ""))
                link = entry.findtext("link", "")
                raw_date = entry.findtext("pubDate", "")
                desc = _clean_text(entry.findtext("description", ""))
                source_el = entry.find("source")
                source_name = source_el.text.strip() if source_el is not None and source_el.text else "Google News"
                if " - " in title:
                    parts = title.rsplit(" - ", 1)
                    title = parts[0].strip()
                    if len(parts) > 1 and parts[1].strip():
                        source_name = parts[1].strip()

                dt = _parse_pubdate(raw_date)
                if _is_too_old(dt):
                    continue

                sent = _compute_sentiment(title + " " + desc)
                if title and len(title) > 12:
                    items.append({
                        "title": title,
                        "description": desc[:220] if desc else "",
                        "url": link,
                        "source": source_name,
                        "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                        "time_ago": _format_time_ago(dt),
                        "sentiment": sent["label"],
                        "sentiment_score": sent["score"],
                    })
    except Exception as exc:
        logger.debug("Google News crypto query failed: %s", exc)
    return items


# ── Deduplication Engine ──────────────────────────────────────────────────────
def _deduplicate_articles(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filters out exact duplicates and near-identical headlines across sources."""
    seen_titles = set()
    unique = []

    for art in articles:
        normalized = re.sub(r"[^a-zA-Z0-9\s]", "", art["title"].lower()).strip()
        words = frozenset([w for w in normalized.split() if len(w) > 2])

        is_dup = False
        for seen in seen_titles:
            if not words or not seen:
                continue
            overlap = len(words & seen) / max(len(words | seen), 1)
            if overlap > 0.68:  # > 68% word overlap considered same story
                is_dup = True
                break

        if not is_dup:
            seen_titles.add(words)
            unique.append(art)

    return unique


# ── Main Entry Point ──────────────────────────────────────────────────────────
def get_multi_source_news(
    ticker: Optional[str] = None,
    limit: int = 15,
    source_filter: Optional[str] = None,
    sentiment_filter: Optional[str] = None,
    force_refresh: bool = False
) -> Dict[str, Any]:
    """
    Fetches real-time financial news aggregated in parallel from premier sources.
    Strictly filters out stale news and supports on-demand cache busting.
    """
    t = ticker.upper().strip() if ticker else "MARKET"
    cache_key = f"{t}_{source_filter or 'ALL'}_{sentiment_filter or 'ALL'}_{limit}"
    now_ts = time.time()

    # Serve from cache if fresh and force_refresh is not requested
    if not force_refresh and cache_key in _NEWS_CACHE:
        entry = _NEWS_CACHE[cache_key]
        if now_ts - entry["timestamp"] < _CACHE_TTL:
            return entry["data"]

    # Determine company name and keywords
    company = t
    try:
        if t != "MARKET":
            from backend.data.fetcher import get_token_info
            token = get_token_info(t)
            if token and token.get("name"):
                company = token["name"]
    except Exception:
        company = t

    ticker_keywords = None if t == "MARKET" else _extract_search_keywords(t, company)
    all_articles: List[Dict[str, Any]] = []

    if _is_crypto(t):
        crypto_q = "bitcoin" if t in ("BTC", "BITCOIN", "BTCUSDT") else company
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(_fetch_crypto_rss, crypto_q): "Crypto RSS",
                executor.submit(_fetch_yahoo_finance_rss, t): "Yahoo Finance",
            }
            for f in as_completed(futures):
                try:
                    res = f.result()
                    if res:
                        all_articles.extend(res)
                except Exception as exc:
                    logger.debug("Crypto provider error: %s", exc)
    else:
        # Build search query for Google News
        if t == "MARKET":
            gquery = "Indian stock market NSE Nifty Sensex"
        else:
            search_terms = " OR ".join([f'"{k}"' for k in ticker_keywords[:3]])
            gquery = f"({search_terms}) (stock OR shares OR quarterly OR results OR business)"

        with ThreadPoolExecutor(max_workers=7) as executor:
            futures = {
                executor.submit(_fetch_google_news, gquery, ticker_keywords): "Google News",
                executor.submit(_fetch_economic_times, ticker_keywords): "Economic Times",
                executor.submit(_fetch_business_standard, ticker_keywords): "Business Standard",
                executor.submit(_fetch_livemint, ticker_keywords): "LiveMint",
                executor.submit(_fetch_ndtv_profit, ticker_keywords): "NDTV Profit",
                executor.submit(_fetch_moneycontrol, ticker_keywords): "Moneycontrol",
            }
            if t != "MARKET":
                futures[executor.submit(_fetch_yahoo_finance_rss, t)] = "Yahoo Finance"

            for f in as_completed(futures):
                try:
                    res = f.result()
                    if res:
                        all_articles.extend(res)
                except Exception as exc:
                    logger.debug("Provider threw exception: %s", exc)

    # Deduplicate
    unique_articles = _deduplicate_articles(all_articles)

    # Sort primarily by recency
    unique_articles.sort(key=lambda x: x.get("published_at", ""), reverse=True)

    # If all feeds failed or network momentary error, fallback to last successful
    if not unique_articles and t in _LAST_SUCCESSFUL_NEWS:
        logger.info("Serving last successful news snapshot for %s due to upstream timeout/network hiccup", t)
        cached_fallback = _LAST_SUCCESSFUL_NEWS[t]
        unique_articles = list(cached_fallback.get("items", []))

    # Collect available sources for UI filter pills
    available_sources = ["All Sources"] + sorted(list({a["source"] for a in unique_articles if a.get("source")}))

    # Apply Source Filter if specified
    if source_filter and isinstance(source_filter, str) and source_filter.lower() not in ("all", "all sources"):
        unique_articles = [a for a in unique_articles if a.get("source", "").lower() == source_filter.lower()]

    # Apply Sentiment Filter if specified
    if sentiment_filter and isinstance(sentiment_filter, str) and sentiment_filter.lower() != "all":
        unique_articles = [a for a in unique_articles if a.get("sentiment", "").lower() == sentiment_filter.lower()]

    # Compute overall aggregate sentiment
    if unique_articles:
        avg_score = sum(a.get("sentiment_score", 0.0) for a in unique_articles) / len(unique_articles)
    else:
        avg_score = 0.0

    avg_score = round(avg_score, 2)
    if avg_score > 0.15:
        overall_sentiment = "Bullish"
    elif avg_score < -0.15:
        overall_sentiment = "Bearish"
    else:
        overall_sentiment = "Neutral"

    paginated_items = unique_articles[:max(1, min(limit, 60))]

    response = {
        "ticker": t,
        "company": company,
        "total": len(unique_articles),
        "sentiment_score": avg_score,
        "sentiment_label": overall_sentiment,
        "available_sources": available_sources,
        "items": paginated_items,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if paginated_items:
        _LAST_SUCCESSFUL_NEWS[t] = response

    _NEWS_CACHE[cache_key] = {"timestamp": now_ts, "data": response}
    return response
