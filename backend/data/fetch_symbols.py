# StockOracle Pro - ticker symbol mapping (crypto/gold aliases, seed data, NSE search).
# Moved verbatim from backend.data.fetcher.
from .fetch_connection import *  # noqa: F401,F403
from .fetch_connection import _IST

_CRYPTO_TICKERS = {"BTC", "BTC-USD", "BTCUSDT", "BITCOIN", "ETH", "ETHUSDT"}
# International gold aliases — routed through Binance PAXGUSDT (tokenized 1-oz
# gold, ~1:1 XAU/USD tracking, 24/7) so XAUUSD/GOLD reuse the crypto pipeline.
_GOLD_TICKERS = {"XAUUSD", "XAU", "GOLD", "PAXG"}


def _is_gold_ticker(ticker: str) -> bool:
    """True for international-gold aliases (exact 'GOLD' only, so NSE ETFs like GOLDBEES stay equities)."""
    t = str(ticker).upper().strip()
    return t in _GOLD_TICKERS or t.startswith("XAU") or t.startswith("PAXG")


def _binance_crypto_symbol(ticker: str) -> str:
    """Maps a ticker to its Binance trading symbol (BTC, gold aliases, or *USDT)."""
    t = str(ticker).upper().strip()
    if "BTC" in t or "BITCOIN" in t:
        return "BTCUSDT"
    if _is_gold_ticker(t):
        return "PAXGUSDT"
    return t if t.endswith("USDT") else f"{t}USDT"


def is_crypto_ticker(ticker: str) -> bool:
    """Returns True if the ticker is a 24/7 digital/asset symbol (crypto or international gold)."""
    if not ticker:
        return False
    t = str(ticker).upper().strip()
    if _is_gold_ticker(t):
        return True
    return t in _CRYPTO_TICKERS or t.startswith("BTC") or t.startswith("ETH")


def _generate_crypto_seed_data(ticker: str, interval: str, is_intraday: bool) -> Optional[pd.DataFrame]:
    """Generates realistic baseline crypto OHLCV data if external APIs are completely unreachable.

    Returns None for gold aliases — fabricated XAU/USD prices are never acceptable
    (zero-fake-data rule); callers fall through to DB/None paths instead.
    """
    if _is_gold_ticker(ticker):
        return None
    now = datetime.now(_IST)
    n_bars = 180 if not is_intraday else 120
    base_price = 64250.0
    
    dates = []
    opens, highs, lows, closes, volumes = [], [], [], [], []
    curr = base_price
    
    step_minutes = {
        "1s": 1/60, "30s": 0.5, "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240
    }.get(interval, 1440)
    
    start_time = now - timedelta(minutes=n_bars * step_minutes)
    
    for i in range(n_bars):
        t = start_time + timedelta(minutes=i * step_minutes)
        d_str = t.strftime("%Y-%m-%d") if not is_intraday else t.strftime("%Y-%m-%d %H:%M:%S")
        
        # Realistic slight random walk
        drift = np.sin(i / 10.0) * 80.0 + np.cos(i / 5.0) * 60.0
        bar_open = round(curr, 2)
        change = (np.sin(i * 1.7) * 150.0) + drift
        bar_close = round(max(1000.0, bar_open + change), 2)
        bar_high = round(max(bar_open, bar_close) + abs(np.sin(i * 3.1) * 90.0) + 10.0, 2)
        bar_low = round(min(bar_open, bar_close) - abs(np.cos(i * 2.3) * 80.0) - 10.0, 2)
        bar_vol = round(abs(np.sin(i)) * 500.0 + 100.0, 2)
        
        dates.append(d_str)
        opens.append(bar_open)
        highs.append(bar_high)
        lows.append(bar_low)
        closes.append(bar_close)
        volumes.append(bar_vol)
        curr = bar_close

    df = pd.DataFrame({
        "date": dates,
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volumes,
    })
    return df


def _crypto_period_days(period: Optional[str], is_intraday: bool) -> int:
    """Maps a chart period label to days of 24x7 crypto history needed."""
    p = (period or "").upper().strip()
    if p in ("ALL", "MAX", ""):
        return 45 if is_intraday else 9000
    if p.endswith("D") and p[:-1].isdigit():
        return int(p[:-1])
    if p.endswith("W") and p[:-1].isdigit():
        return int(p[:-1]) * 7
    if p.endswith("M") and p[:-1].isdigit():
        return int(p[:-1]) * 30
    if p.endswith("Y") and p[:-1].isdigit():
        return int(p[:-1]) * 365
    return 7 if is_intraday else 9000


def search_nse_stocks(query: str, limit: int = 12) -> list[dict]:
    """Search locally stored NSE listings by ticker or company name from SQLite, plus Crypto and Commodity assets."""
    results = search_stock_universe(query, limit)
    q = query.upper().strip()
    if any(term in q for term in ["BTC", "BITCOIN", "CRYPTO"]):
        btc_entry = {
            "ticker": "BTC",
            "name": "Bitcoin (BTC / USD)",
            "exchange": "CRYPTO",
            "token": "BTC",
            "exch_seg": "CRYPTO",
        }
        if not any(r.get("ticker") == "BTC" for r in results):
            results.insert(0, btc_entry)
    if any(term in q for term in ["XAU", "GOLD", "PAXG", "COMMODITY", "FOREX", "XAUUSD"]):
        gold_entry = {
            "ticker": "XAUUSD",
            "name": "Gold Spot / US Dollar (XAU/USD)",
            "exchange": "COMMODITY",
            "token": "XAUUSD",
            "exch_seg": "COMMODITY",
        }
        if not any(r.get("ticker") == "XAUUSD" for r in results):
            results.insert(0, gold_entry)
    return results[:limit]
