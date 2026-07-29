import urllib.request
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus
import re
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Ensure VADER lexicon is downloaded
try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
    nltk.download('vader_lexicon', quiet=True)

def fetch_and_score_sentiment(symbol: str) -> float:
    """
    Fetches recent news from Google News RSS for the given symbol,
    cleans the titles, and returns the average VADER compound sentiment score.
    Returns 0.0 if no news is found or on error.
    """
    # Clean the symbol and fetch token info to get the full company name if possible
    t = symbol.upper().strip()
    try:
        from backend.data.fetcher import get_token_info
        token = get_token_info(t)
        company = token.get("name", t) if token else t
    except ImportError:
        company = t

    url = f"https://news.google.com/rss/search?q={quote_plus(company + ' stock NSE')}&hl=en-IN&gl=IN&ceid=IN:en"
    
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=8) as response:
            root = ET.fromstring(response.read())
        
        sia = SentimentIntensityAnalyzer()
        scores = []
        
        for item in root.findall("./channel/item")[:15]:
            title = item.findtext("title", "")
            # Basic text cleaning: remove special chars and extra spaces
            clean_title = re.sub(r'[^a-zA-Z0-9\s]', '', title)
            if clean_title.strip():
                score = sia.polarity_scores(clean_title)["compound"]
                scores.append(score)
                
        if not scores:
            return 0.0
            
        return sum(scores) / len(scores)
        
    except Exception as e:
        print(f"Error fetching sentiment for {symbol}: {e}")
        return 0.0
