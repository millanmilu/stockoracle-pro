import urllib.request
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus
import re
import threading
import logging

logger = logging.getLogger("stockoracle.sentiment")

# ── FinBERT (preferred) ──────────────────────────────────────────────────────
# ProsusAI/finbert is a BERT model fine-tuned on financial news \u2014 far more
# accurate than VADER for stock headlines. Loaded once as a singleton.
_finbert_pipe = None
_finbert_lock = threading.Lock()
_finbert_failed = False   # Prevents repeated load attempts after a hard failure


def _get_finbert_pipeline():
    """Lazily loads the FinBERT pipeline. Thread-safe singleton."""
    global _finbert_pipe, _finbert_failed
    if _finbert_pipe is not None:
        return _finbert_pipe
    if _finbert_failed:
        return None
    with _finbert_lock:
        if _finbert_pipe is not None:
            return _finbert_pipe
        try:
            from transformers import pipeline
            logger.info("Loading FinBERT sentiment model (first load may take a moment)...")
            _finbert_pipe = pipeline(
                "text-classification",
                model="ProsusAI/finbert",
                truncation=True,
                max_length=512,
                device=-1,          # CPU only \u2014 safe on any EC2 instance
            )
            logger.info("\u2705 FinBERT loaded successfully.")
        except Exception as e:
            logger.warning("FinBERT unavailable (%s) \u2014 falling back to VADER.", e)
            _finbert_failed = True
    return _finbert_pipe


def _score_with_finbert(texts: list[str]) -> float:
    """
    Scores a list of financial headlines using FinBERT.
    Maps labels to [-1, 0, 1] (negative / neutral / positive) and returns the mean.
    """
    pipe = _get_finbert_pipeline()
    if pipe is None:
        return None     # Signal caller to use VADER fallback

    label_map = {"positive": 1.0, "neutral": 0.0, "negative": -1.0}
    scores = []
    try:
        results = pipe(texts, batch_size=8)
        for r in results:
            label = r.get("label", "neutral").lower()
            scores.append(label_map.get(label, 0.0))
    except Exception as e:
        logger.warning("FinBERT inference failed: %s", e)
        return None
    return float(sum(scores) / len(scores)) if scores else 0.0


# ── VADER fallback ───────────────────────────────────────────────────────────
def _score_with_vader(texts: list[str]) -> float:
    """Scores headlines using VADER \u2014 used when FinBERT is unavailable."""
    import nltk
    try:
        nltk.data.find('sentiment/vader_lexicon.zip')
    except LookupError:
        nltk.download('vader_lexicon', quiet=True)

    from nltk.sentiment.vader import SentimentIntensityAnalyzer
    sia = SentimentIntensityAnalyzer()
    scores = [sia.polarity_scores(t)["compound"] for t in texts if t.strip()]
    return float(sum(scores) / len(scores)) if scores else 0.0


# ── Public API ───────────────────────────────────────────────────────────────
def fetch_and_score_sentiment(symbol: str) -> float:
    """
    Fetches recent news from Google News RSS for the given symbol.
    Scores headlines with FinBERT (preferred) or VADER (fallback).
    Returns the mean compound score in [-1, +1]. Returns 0.0 on any error.
    """
    t = symbol.upper().strip()
    try:
        from backend.data.fetcher import get_token_info
        token = get_token_info(t)
        company = token.get("name", t) if token else t
    except Exception:
        company = t

    url = (
        f"https://news.google.com/rss/search"
        f"?q={quote_plus(company + ' stock NSE')}&hl=en-IN&gl=IN&ceid=IN:en"
    )

    try:
        request = urllib.request.Request(url, headers={"User-Agent": "StockOracle/2.0"})
        with urllib.request.urlopen(request, timeout=8) as response:
            root = ET.fromstring(response.read())

        titles = []
        for item in root.findall("./channel/item")[:15]:
            raw_title = item.findtext("title", "")
            # Strip HTML entities and non-ASCII that confuse sentiment models
            clean = re.sub(r'<[^>]+>', '', raw_title)
            clean = re.sub(r'[^\x00-\x7F]+', ' ', clean).strip()
            if clean:
                titles.append(clean)

        if not titles:
            return 0.0

        # Prefer FinBERT; fall back to VADER
        score = _score_with_finbert(titles)
        if score is None:
            score = _score_with_vader(titles)
        return round(score, 4)

    except Exception as e:
        logger.error("Error fetching sentiment for %s: %s", symbol, e)
        return 0.0


def warmup_finbert() -> None:
    """
    Pre-loads the FinBERT model in a background daemon thread so the first real
    `/news` request is not slowed down by a cold-start model download.

    Safe to call multiple times — the singleton guard in `_get_finbert_pipeline`
    ensures the model is only loaded once.
    """
    def _load():
        logger.info("Warming up FinBERT in background thread...")
        pipe = _get_finbert_pipeline()
        if pipe is not None:
            logger.info("✅ FinBERT warm-up complete.")
        else:
            logger.warning("FinBERT warm-up failed — VADER fallback will be used.")

    t = threading.Thread(target=_load, daemon=True, name="finbert-warmup")
    t.start()
