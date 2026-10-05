# StockOracle Pro - cursor-based historical window helpers (chart left-pan backfill).
# Chunk limits, `before` cursor parsing, paginated Binance window walk-back and
# equity window shaping. Moved verbatim from backend.data.fetcher.
from .fetch_connection import *  # noqa: F401,F403
from .fetch_connection import _IST
from .fetch_slot_fill import fill_intraday_time_gaps
from .fetch_symbols import _binance_crypto_symbol

# ── Cursor-based historical windows (chart left-pan backfill) ──

# Timeframe-aware chunk sizes: candles returned per older-history request.
# Never one universal count — microstructure stays small, intraday pulls
# thousands, daily pulls years. Frontend mirrors this map (chartHelpers.js).
CURSOR_CHUNK_LIMITS = {
    "1s": 300, "30s": 500,
    "1m": 3000, "5m": 3000, "15m": 2000, "30m": 2000,
    "1h": 2000, "4h": 1500, "1d": 1000,
}
CURSOR_MIN_LIMIT = 50
CURSOR_MAX_LIMIT = 5000


def cursor_chunk_limit(interval: str, requested: Optional[int] = None) -> int:
    """Resolve the candle count for one older-history request."""
    iv = str(interval or "").lower().strip()
    default = CURSOR_CHUNK_LIMITS.get(iv, 2000)
    if requested is None:
        return default
    try:
        n = int(requested)
    except (TypeError, ValueError):
        return default
    return max(CURSOR_MIN_LIMIT, min(CURSOR_MAX_LIMIT, n))


def parse_cursor_before(before) -> Optional[datetime]:
    """Parse a cursor `before` bound (epoch seconds or IST ISO date/datetime).

    Returns an IST-aware datetime; the window holds candles strictly older
    than this bound. Returns None when unparseable.
    """
    if before is None:
        return None
    s = str(before).strip()
    if not s:
        return None
    try:
        ts = float(s)
        if ts > 1e9:
            return datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(_IST)
    except (TypeError, ValueError):
        pass
    try:
        iso = s.replace("Z", "")
        if "T" in iso:
            iso = iso.replace("T", " ")
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=_IST)
        return dt.astimezone(_IST)
    except (TypeError, ValueError):
        return None


def _fetch_crypto_window(ticker: str, interval_clean: str, before_dt: datetime, limit: int) -> Optional["pd.DataFrame"]:
    """Up to `limit` crypto/gold candles strictly older than `before_dt` (newest last)."""
    import json
    import urllib.request

    binance_interval_map = {
        "1s": "1s", "30s": "1m", "1m": "1m", "5m": "5m",
        "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d"
    }
    b_interval = binance_interval_map.get(interval_clean, "1d")
    symbol = _binance_crypto_symbol(ticker)
    is_intraday = interval_clean in ["1s", "30s", "1m", "5m", "15m", "30m", "1h", "4h"]

    rows = []
    end_ms = int(before_dt.timestamp() * 1000) - 1  # exclusive bound
    max_pages = max(1, -(-limit // 1000))
    for _ in range(max_pages):
        url = (f"https://api.binance.com/api/v3/klines?symbol={symbol}"
               f"&interval={b_interval}&limit={min(1000, limit)}&endTime={end_ms}")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "StockOracle/2.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
        except Exception as exc:
            logger.debug("Binance cursor window failed for %s: %s", ticker, exc)
            break
        if not isinstance(data, list) or not data:
            break
        for k in data:
            open_time_ms = int(k[0])
            dt = datetime.fromtimestamp(open_time_ms / 1000.0, tz=timezone.utc).astimezone(_IST)
            if dt >= before_dt:
                continue  # belt & braces: strictly older only
            date_str = dt.strftime("%Y-%m-%d") if not is_intraday else dt.strftime("%Y-%m-%d %H:%M:%S")
            rows.append({
                "date": date_str,
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
            })
        if len(data) < min(1000, limit) or len(rows) >= limit:
            break
        end_ms = int(data[0][0]) - 1
    if not rows:
        return None
    rows.sort(key=lambda r: r["date"])
    rows = rows[-limit:]
    df = pd.DataFrame(rows)
    df["high"] = np.maximum(df["high"], np.maximum(df["open"], df["close"]))
    df["low"] = np.minimum(df["low"], np.minimum(df["open"], df["close"]))
    df = df[(df["open"] > 0) & (df["close"] > 0) & (df["high"] > 0) & (df["low"] > 0)]
    df = df.drop_duplicates(subset=["date"]).sort_values("date").reset_index(drop=True)
    if df.empty:
        return None
    if is_intraday:
        df = fill_intraday_time_gaps(df, interval_clean, is_crypto=True)
        try:
            save_intraday_candles(ticker, interval_clean, df)
        except Exception as exc:
            logger.debug("Cursor window intraday save failed for %s: %s", ticker, exc)
    else:
        try:
            save_historical_prices(ticker, df)
        except Exception as exc:
            logger.debug("Cursor window daily save failed for %s: %s", ticker, exc)
    df.attrs["data_source"] = "binance_crypto"
    return df


def _shape_equity_window(df: "pd.DataFrame", broker_iv: str, interval_clean: str, before_str: str, limit: int) -> Optional["pd.DataFrame"]:
    """Filter a broker/DB frame to candles strictly older than `before_str`,
    group 1h→4h session buckets when asked, oldest-first, capped at `limit`."""
    if df is None or df.empty:
        return None
    win = df[df["date"] < before_str].sort_values("date").tail(limit * (4 if interval_clean == "4h" else 1))
    if win.empty:
        return None
    if interval_clean == "4h" and broker_iv == "1h":
        dt = pd.to_datetime(win["date"], format="mixed", errors="coerce")
        is_morning = dt.dt.hour < 13
        tmp = win.copy()
        tmp["bucket"] = dt.dt.strftime("%Y-%m-%d") + is_morning.map({True: " 09:15:00", False: " 13:15:00"})
        win = tmp.groupby("bucket", as_index=False).agg({
            "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum",
        }).rename(columns={"bucket": "date"}).sort_values("date")
        win = win[win["date"] < before_str].tail(limit)
        if win.empty:
            return None
    else:
        win = win.tail(limit)
    return win.reset_index(drop=True)
