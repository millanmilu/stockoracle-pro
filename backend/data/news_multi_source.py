"""
StockOracle Pro — High-Performance Multi-Source Indian Financial News Aggregator
Aggregates and deduplicates real-time news headlines across:
  1. Google News India (NSE scrip specific query)
  2. The Economic Times (Markets & Stocks RSS)
  3. Moneycontrol (Latest Business & Market News RSS)
  4. LiveMint (Markets & Economy RSS)
  5. Yahoo Finance (Direct NSE Ticker News API)

Features:
  - Parallel asynchronous / threadpool execution (< 800ms)
  - Intelligent headline deduplication
  - Real-time sentiment tagging (Bullish, Bearish, Neutral)
  - Relative time humanization ('10m ago', '2h ago', '1d ago')
  - In-memory cache with 5-minute TTL to respect upstream rate limits
"""
import re
import time
import html
import logging
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from urllib.parse import quote_plus
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger("StockOracle.Data.NewsMultiSource")

# 5-minute cache TTL
_CACHE_TTL = 300
_NEWS_CACHE: Dict[str, Dict[str, Any]] = {}

# User-Agent header for web requests
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 StockOracle/2.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Source configuration
SOURCE_COLORS = {
    "Economic Times": "#E11D48",
    "Moneycontrol": "#2563EB",
    "LiveMint": "#F97316",
    "Yahoo Finance": "#7C3AED",
    "Google News": "#059669",
    "Reuters": "#EA580C",
    "Bloomberg": "#4F46E5",
    "Business Standard": "#0284C7",
    "CNBC TV18": "#0D9488",
    "Other": "#64748B",
}

# Positive / Negative Lexicons for high-speed sentiment scoring
BULLISH_KEYWORDS = {
    "surge", "surges", "surged", "jump", "jumps", "jumped", "rally", "rallies",
    "gain", "gains", "gained", "bullish", "profit", "soars", "soar", "high",
    "growth", "record", "upgrade", "upgrades", "buy", "outperform", "dividend",
    "expansion", "boost", "revenue up", "margin expansion", "strong", "beats"
}
BEARISH_KEYWORDS = {
    "fall", "falls", "fell", "drop", "drops", "dropped", "slump", "slumps",
    "plunge", "plunges", "loss", "losses", "bearish", "down", "crash",
    "downgrade", "downgrades", "sell", "underperform", "weak", "penalty",
    "investigation", "fraud", "misses", "debt", "default", "warning", "decline"
}


def _clean_text(text: str) -> str:
    """Removes HTML tags, unescapes entities, and cleans whitespace."""
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


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
        mins = int(diff // 60)
        return f"{mins}m ago"
    elif diff < 86400:
        hours = int(diff // 3600)
        return f"{hours}h ago"
    elif diff < 604800:
        days = int(diff // 86400)
        return f"{days}d ago"
    return dt.strftime("%b %d")


def _parse_pubdate(raw: str) -> Optional[datetime]:
    """Parses various RSS pubDate formats into UTC datetime."""
    if not raw:
        return None
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
    ):
        try:
            return datetime.strptime(raw.strip(), fmt)
        except Exception:
            continue
    return None


# ── Provider 1: Google News RSS (Scrip Specific) ──────────────────────────────
def _fetch_google_news(query: str) -> List[Dict[str, Any]]:
    items = []
    try:
        url = f"https://news.google.com/rss/search?q={quote_plus(query + ' stock NSE India')}&hl=en-IN&gl=IN&ceid=IN:en"
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=6) as response:
            root = ET.fromstring(response.read())

        for entry in root.findall("./channel/item")[:10]:
            title = _clean_text(entry.findtext("title", ""))
            link = entry.findtext("link", "")
            raw_date = entry.findtext("pubDate", "")
            source_el = entry.find("source")
            source_name = source_el.text.strip() if source_el is not None and source_el.text else "Google News"
            
            # Remove publisher suffix often added by Google News (e.g. "Headline - Moneycontrol")
            if " - " in title:
                parts = title.rsplit(" - ", 1)
                title = parts[0].strip()
                if len(parts) > 1 and parts[1].strip():
                    source_name = parts[1].strip()

            dt = _parse_pubdate(raw_date)
            sent = _compute_sentiment(title)

            if title and len(title) > 12:
                items.append({
                    "title": title,
                    "url": link,
                    "source": source_name,
                    "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                    "time_ago": _format_time_ago(dt),
                    "sentiment": sent["label"],
                    "sentiment_score": sent["score"],
                })
    except Exception as exc:
        logger.debug("Google News RSS failed: %s", exc)
    return items


# ── Provider 2: Economic Times Markets RSS ─────────────────────────────────────
def _fetch_economic_times(ticker_keyword: str) -> List[Dict[str, Any]]:
    items = []
    try:
        url = "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms"
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=6) as response:
            root = ET.fromstring(response.read())

        key = ticker_keyword.lower()
        for entry in root.findall("./channel/item"):
            title = _clean_text(entry.findtext("title", ""))
            link = entry.findtext("link", "")
            raw_date = entry.findtext("pubDate", "")
            desc = _clean_text(entry.findtext("description", ""))

            # Filter if ticker requested, otherwise general market news
            if key and key != "market":
                if key not in title.lower() and key not in desc.lower():
                    continue

            dt = _parse_pubdate(raw_date)
            sent = _compute_sentiment(title + " " + desc)

            if title:
                items.append({
                    "title": title,
                    "url": link,
                    "source": "Economic Times",
                    "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                    "time_ago": _format_time_ago(dt),
                    "sentiment": sent["label"],
                    "sentiment_score": sent["score"],
                })
                if len(items) >= 8:
                    break
    except Exception as exc:
        logger.debug("Economic Times RSS failed: %s", exc)
    return items


# ── Provider 3: Moneycontrol Markets RSS ───────────────────────────────────────
def _fetch_moneycontrol(ticker_keyword: str) -> List[Dict[str, Any]]:
    items = []
    urls = [
        "https://www.moneycontrol.com/rss/latestnews.xml",
        "https://www.moneycontrol.com/rss/MCtopnews.xml",
        "https://www.moneycontrol.com/rss/business.xml"
    ]
    key = ticker_keyword.lower()

    for url in urls:
        if len(items) >= 8:
            break
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, timeout=5) as response:
                root = ET.fromstring(response.read())

            for entry in root.findall("./channel/item"):
                title = _clean_text(entry.findtext("title", ""))
                link = entry.findtext("link", "")
                raw_date = entry.findtext("pubDate", "")
                desc = _clean_text(entry.findtext("description", ""))

                if key and key != "market":
                    if key not in title.lower() and key not in desc.lower():
                        continue

                dt = _parse_pubdate(raw_date)
                sent = _compute_sentiment(title + " " + desc)

                if title:
                    items.append({
                        "title": title,
                        "url": link,
                        "source": "Moneycontrol",
                        "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                        "time_ago": _format_time_ago(dt),
                        "sentiment": sent["label"],
                        "sentiment_score": sent["score"],
                    })
                    if len(items) >= 8:
                        break
        except Exception as exc:
            logger.debug("Moneycontrol RSS failed for %s: %s", url, exc)
    return items


# ── Provider 4: LiveMint Markets RSS ───────────────────────────────────────────
def _fetch_livemint(ticker_keyword: str) -> List[Dict[str, Any]]:
    items = []
    try:
        url = "https://www.livemint.com/rss/markets"
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=6) as response:
            root = ET.fromstring(response.read())

        key = ticker_keyword.lower()
        for entry in root.findall("./channel/item"):
            title = _clean_text(entry.findtext("title", ""))
            link = entry.findtext("link", "")
            raw_date = entry.findtext("pubDate", "")

            if key and key != "market":
                if key not in title.lower():
                    continue

            dt = _parse_pubdate(raw_date)
            sent = _compute_sentiment(title)

            if title:
                items.append({
                    "title": title,
                    "url": link,
                    "source": "LiveMint",
                    "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                    "time_ago": _format_time_ago(dt),
                    "sentiment": sent["label"],
                    "sentiment_score": sent["score"],
                })
                if len(items) >= 6:
                    break
    except Exception as exc:
        logger.debug("LiveMint RSS failed: %s", exc)
    return items


# ── Provider 5: Yahoo Finance Ticker News API ─────────────────────────────────
def _fetch_yahoo_finance_news(ticker: str) -> List[Dict[str, Any]]:
    items = []
    try:
        import yfinance as yf
        ns_sym = f"{ticker}.NS" if not ticker.endswith(".NS") else ticker
        tk = yf.Ticker(ns_sym)
        raw_news = getattr(tk, "news", []) or []

        for a in raw_news[:10]:
            title = _clean_text(a.get("title", ""))
            link = a.get("link", "")
            publisher = a.get("publisher") or "Yahoo Finance"
            pub_ts = a.get("providerPublishTime")
            dt = datetime.fromtimestamp(pub_ts, tz=timezone.utc) if pub_ts else None
            sent = _compute_sentiment(title)

            if title and len(title) > 10:
                items.append({
                    "title": title,
                    "url": link,
                    "source": publisher,
                    "published_at": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                    "time_ago": _format_time_ago(dt),
                    "sentiment": sent["label"],
                    "sentiment_score": sent["score"],
                })
    except Exception as exc:
        logger.debug("Yahoo Finance news fetch failed for %s: %s", ticker, exc)
    return items


# ── Deduplication Engine ──────────────────────────────────────────────────────
def _deduplicate_articles(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filters out exact duplicates and near-identical headlines across sources."""
    seen_titles = set()
    unique = []

    for art in articles:
        # Simplify title for duplicate detection
        normalized = re.sub(r"[^a-zA-Z0-9\s]", "", art["title"].lower()).strip()
        words = set(normalized.split())

        # Check if words heavily overlap with any seen article
        is_dup = False
        for seen in seen_titles:
            if not words or not seen:
                continue
            overlap = len(words & seen) / max(len(words | seen), 1)
            if overlap > 0.70:  # > 70% word overlap considered same story
                is_dup = True
                break

        if not is_dup:
            seen_titles.add(frozenset(words))
            unique.append(art)

    return unique


# ── Main Entry Point ──────────────────────────────────────────────────────────
def get_multi_source_news(
    ticker: Optional[str] = None,
    limit: int = 15,
    source_filter: Optional[str] = None,
    sentiment_filter: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fetches real-time financial news aggregated in parallel from 5+ sources.
    Returns structured articles with sentiment, time-ago formatting, and publisher tags.
    """
    cache_key = f"{ticker or 'MARKET'}_{source_filter or 'ALL'}_{sentiment_filter or 'ALL'}_{limit}"
    now_ts = time.time()

    if cache_key in _NEWS_CACHE:
        entry = _NEWS_CACHE[cache_key]
        if now_ts - entry["timestamp"] < _CACHE_TTL:
            return entry["data"]

    t = ticker.upper().strip() if ticker else "MARKET"

    # Determine company name for search
    company = t
    try:
        if t != "MARKET":
            from backend.data.fetcher import get_token_info
            token = get_token_info(t)
            if token and token.get("name"):
                company = token["name"]
    except Exception:
        company = t

    all_articles: List[Dict[str, Any]] = []

    # Run providers in parallel using threadpool
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(_fetch_google_news, company if t != "MARKET" else "NSE NIFTY India Market"): "Google News",
            executor.submit(_fetch_economic_times, company if t != "MARKET" else "market"): "Economic Times",
            executor.submit(_fetch_moneycontrol, company if t != "MARKET" else "market"): "Moneycontrol",
            executor.submit(_fetch_livemint, company if t != "MARKET" else "market"): "LiveMint",
        }
        if t != "MARKET":
            futures[executor.submit(_fetch_yahoo_finance_news, t)] = "Yahoo Finance"

        for f in as_completed(futures):
            src_name = futures[f]
            try:
                res = f.result()
                if res:
                    all_articles.extend(res)
            except Exception as exc:
                logger.debug("Provider %s threw exception: %s", src_name, exc)

    # Deduplicate
    unique_articles = _deduplicate_articles(all_articles)

    # Sort primarily by recency if valid published_at exists
    unique_articles.sort(key=lambda x: x.get("published_at", ""), reverse=True)

    # Collect available sources for UI filter pills
    available_sources = ["All Sources"] + sorted(list({a["source"] for a in unique_articles if a.get("source")}))

    # Apply Source Filter if specified
    if source_filter and source_filter.lower() not in ("all", "all sources"):
        unique_articles = [a for a in unique_articles if a.get("source", "").lower() == source_filter.lower()]

    # Apply Sentiment Filter if specified
    if sentiment_filter and sentiment_filter.lower() != "all":
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

    paginated_items = unique_articles[:max(1, min(limit, 50))]

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

    _NEWS_CACHE[cache_key] = {"timestamp": now_ts, "data": response}
    return response
