# StockOracle Pro - 24/7 crypto & gold OHLCV pipeline.
# Binance klines (paginated endTime walk-back) -> Coinbase -> yfinance XAU -> SQLite.
# Moved verbatim from backend.data.fetcher.
import time

from .fetch_connection import *  # noqa: F401,F403
from .fetch_connection import _IST
from .fetch_cache import _get_cached, _set_cached
from .fetch_slot_fill import fill_intraday_time_gaps
from .fetch_symbols import (
    _binance_crypto_symbol,
    _crypto_period_days,
    _generate_crypto_seed_data,
    _is_gold_ticker,
)

def fetch_crypto_data(ticker: str, period: str = "ALL", interval: str = "1d",
                      polite: bool = False) -> Optional[pd.DataFrame]:
    """
    Fetches cryptocurrency OHLCV data (e.g. BTC) via public Binance / Coinbase endpoints.
    Stores daily in SQLite historical_prices (strictly YYYY-MM-DD IST per DB invariant 1)
    and intraday in intraday_candles table.

    `polite=True` spaces out paginated Binance page walks (≈0.35s between pages).
    Used ONLY by the background warmup preloader so its burst never starves a
    concurrent user-facing /history request into a rate-limit truncated tail
    (which the chart would then cache as a visible candle gap). User requests
    stay unthrottled.
    """
    import json
    import urllib.request

    ticker = ticker.upper().strip()
    cache_key = f"hist_{ticker}_{period}_{interval}"

    fresh = _get_cached(cache_key)
    if fresh is not None:
        fresh.attrs["data_source"] = "memory_cache"
        return fresh

    interval_clean = interval.lower().strip()
    is_intraday = interval_clean in ["1s", "30s", "1m", "5m", "15m", "30m", "1h", "4h"]
    binance_interval_map = {
        "1s": "1s", "30s": "1m", "1m": "1m", "5m": "5m",
        "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d"
    }
    b_interval = binance_interval_map.get(interval_clean, "1d")
    symbol = _binance_crypto_symbol(ticker)

    # 1. Check local DB first + Incremental Tail Fetch (sub-100ms path)
    if not is_intraday:
        db_df = get_historical_prices(ticker)
        if db_df is not None and not db_df.empty and len(db_df) >= 30:
            latest_date = str(db_df["date"].max())[:10]
            cutoff = (datetime.now(_IST) - timedelta(days=2)).strftime("%Y-%m-%d")
            if latest_date >= cutoff:
                db_df.attrs["data_source"] = "sqlite"
                _set_cached(cache_key, db_df)
                return db_df
            # Daily incremental fetch: only fetch missing days since latest_date
            try:
                latest_dt = datetime.strptime(latest_date, "%Y-%m-%d").replace(tzinfo=_IST)
                start_ms = int(latest_dt.timestamp() * 1000)
                inc_url = (f"https://api.binance.com/api/v3/klines?symbol={symbol}"
                           f"&interval=1d&startTime={start_ms}&limit=1000")
                req = urllib.request.Request(inc_url, headers={"User-Agent": "StockOracle/2.0"})
                with urllib.request.urlopen(req, timeout=3) as resp:
                    inc_data = json.loads(resp.read().decode())
                if isinstance(inc_data, list) and inc_data:
                    delta_rows = []
                    for k in inc_data:
                        open_time_ms = int(k[0])
                        dt = datetime.fromtimestamp(open_time_ms / 1000.0, tz=timezone.utc).astimezone(_IST)
                        d_str = dt.strftime("%Y-%m-%d")
                        delta_rows.append({
                            "date": d_str,
                            "open": float(k[1]), "high": float(k[2]),
                            "low": float(k[3]), "close": float(k[4]),
                            "volume": float(k[5]),
                        })
                    if delta_rows:
                        delta_df = pd.DataFrame(delta_rows)
                        combined = pd.concat([db_df, delta_df], ignore_index=True)
                        combined = combined.drop_duplicates(subset=["date"], keep="last").sort_values("date").reset_index(drop=True)
                        combined["high"] = np.maximum(combined["high"], np.maximum(combined["open"], combined["close"]))
                        combined["low"] = np.minimum(combined["low"], np.minimum(combined["open"], combined["close"]))
                        combined = combined[(combined["open"] > 0) & (combined["close"] > 0) & (combined["high"] > 0) & (combined["low"] > 0)]
                        save_historical_prices(ticker, delta_df)
                        combined.attrs["data_source"] = "binance_crypto"
                        _set_cached(cache_key, combined)
                        return combined
            except Exception as inc_exc:
                logger.debug("Daily crypto incremental fetch failed for %s: %s — serving stored DB", ticker, inc_exc)
                db_df.attrs["data_source"] = "sqlite"
                _set_cached(cache_key, db_df)
                return db_df
    else:
        # Period-aware DB fast-path with Incremental Fetch:
        req_days = _crypto_period_days(period, is_intraday)
        req_from = datetime.now(_IST) - timedelta(days=req_days)
        req_from_str = req_from.strftime("%Y-%m-%d %H:%M:%S")
        intra_db = get_intraday_candles(ticker, interval_clean, from_ts=req_from_str)
        if intra_db is not None and not intra_db.empty and len(intra_db) >= 10:
            oldest_ts = str(intra_db["date"].min())
            latest_ts = str(intra_db["date"].max())
            try:
                oldest_dt = datetime.fromisoformat(oldest_ts.replace(" ", "T"))
                if oldest_dt.tzinfo is None:
                    oldest_dt = oldest_dt.replace(tzinfo=_IST)
                covers_window = (oldest_dt - req_from).total_seconds() <= 3600
                if not covers_window:
                    logger.debug("Crypto DB slice too shallow for %s %s (oldest %s, need %s) — fetching Binance",
                                 ticker, period, oldest_ts, req_from_str)
                else:
                    latest_dt = datetime.fromisoformat(latest_ts.replace(" ", "T"))
                    if latest_dt.tzinfo is None:
                        latest_dt = latest_dt.replace(tzinfo=_IST)
                    # Max tolerance strictly matches timeframe so historical data seamlessly connects to live stream:
                    tolerance_sec = {
                        "1s": 3, "30s": 30, "1m": 60, "5m": 240, "15m": 600, "30m": 1200, "1h": 2400, "4h": 7200
                    }.get(interval_clean, 60)
                    now_ist = datetime.now(_IST)
                    gap_sec = (now_ist - latest_dt).total_seconds()
                    if gap_sec < tolerance_sec:
                        # Heal any stored holes at serve time (rows saved before slot-fill existed)
                        intra_db = fill_intraday_time_gaps(intra_db, interval_clean, is_crypto=True)
                        intra_db.attrs["data_source"] = "sqlite"
                        _set_cached(cache_key, intra_db, ttl_seconds=tolerance_sec // 2 or 2)
                        return intra_db

                    # Incremental fetch: DB has historical coverage; only fetch missing tail up to now!
                    # A gap up to 2 days easily fits into 1 fast Binance call (limit=1000).
                    if gap_sec < 86400 * 2:
                        start_ms = int(latest_dt.timestamp() * 1000)
                        delta_rows = []
                        try:
                            inc_url = (f"https://api.binance.com/api/v3/klines?symbol={symbol}"
                                       f"&interval={b_interval}&startTime={start_ms}&limit=1000")
                            req = urllib.request.Request(inc_url, headers={"User-Agent": "StockOracle/2.0"})
                            with urllib.request.urlopen(req, timeout=3) as resp:
                                inc_data = json.loads(resp.read().decode())
                            if isinstance(inc_data, list) and inc_data:
                                for k in inc_data:
                                    open_time_ms = int(k[0])
                                    dt = datetime.fromtimestamp(open_time_ms / 1000.0, tz=timezone.utc).astimezone(_IST)
                                    date_str = dt.strftime("%Y-%m-%d %H:%M:%S")
                                    delta_rows.append({
                                        "date": date_str,
                                        "open": float(k[1]), "high": float(k[2]),
                                        "low": float(k[3]), "close": float(k[4]),
                                        "volume": float(k[5]),
                                    })
                        except Exception as inc_exc:
                            logger.debug("Incremental Binance fetch failed for %s: %s — serving stored DB", ticker, inc_exc)

                        if delta_rows:
                            delta_df = pd.DataFrame(delta_rows)
                            combined = pd.concat([intra_db, delta_df], ignore_index=True)
                            combined = combined.drop_duplicates(subset=["date"], keep="last").sort_values("date").reset_index(drop=True)
                            combined["high"] = np.maximum(combined["high"], np.maximum(combined["open"], combined["close"]))
                            combined["low"] = np.minimum(combined["low"], np.minimum(combined["open"], combined["close"]))
                            combined = combined[(combined["open"] > 0) & (combined["close"] > 0) & (combined["high"] > 0) & (combined["low"] > 0)]
                            combined = fill_intraday_time_gaps(combined, interval_clean, is_crypto=True)
                            try:
                                save_intraday_candles(ticker, interval_clean, delta_df)
                            except Exception as save_exc:
                                logger.debug("Failed saving crypto delta to DB: %s", save_exc)
                            combined.attrs["data_source"] = "binance_crypto"
                            crypto_ttl = 2 if interval_clean in ["1s", "30s"] else (8 if interval_clean == "1m" else 25)
                            _set_cached(cache_key, combined, ttl_seconds=crypto_ttl)
                            return combined
                        else:
                            # If incremental fetch returned empty or failed, serve stored DB rather than stalling
                            intra_db = fill_intraday_time_gaps(intra_db, interval_clean, is_crypto=True)
                            intra_db.attrs["data_source"] = "sqlite"
                            _set_cached(cache_key, intra_db, ttl_seconds=5)
                            return intra_db
            except Exception as exc:
                logger.debug("Intraday cache freshness check failed for %s: %s", ticker, exc)

    # 2. Fetch from Binance public klines API — paginated so `period` is
    # honored. One klines call caps at 1000 bars (≈3.5d of 5m), so without
    # pages BTC 5m could never cover the chart's default 5D/7D window.
    symbol = _binance_crypto_symbol(ticker)

    slot_sec = {"1s": 1, "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
                "1h": 3600, "4h": 14400, "1d": 86400}.get(b_interval, 86400)
    needed = int(_crypto_period_days(period, is_intraday) * 86400 / slot_sec) + 2
    # Walk backwards with endTime; cap pages so deep backfills stay bounded
    # (1m needs ~10k bars for 7D — still only seconds of klines calls).
    max_pages = max(1, min(12, -(-needed // 1000)))

    rows = []
    end_ms = None
    for _ in range(max_pages):
        if polite and rows:
            # Background warmup yields between pages — never burst-ban Binance
            # while a user-facing chart load walks the same endpoint.
            time.sleep(0.35)
        url = (f"https://api.binance.com/api/v3/klines?symbol={symbol}"
               f"&interval={b_interval}&limit=1000"
               + (f"&endTime={end_ms}" if end_ms else ""))
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "StockOracle/2.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
        except Exception as exc:
            logger.debug("Binance crypto page failed for %s: %s", ticker, exc)
            break  # keep pages already collected instead of dropping everything
        if not isinstance(data, list) or not data:
            break
        for k in data:
            open_time_ms = int(k[0])
            dt = datetime.fromtimestamp(open_time_ms / 1000.0, tz=timezone.utc).astimezone(_IST)
            date_str = dt.strftime("%Y-%m-%d") if not is_intraday else dt.strftime("%Y-%m-%d %H:%M:%S")
            rows.append({
                "date": date_str,
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
            })
        if len(data) < 1000 or len(rows) >= needed:
            break
        end_ms = int(data[0][0]) - 1  # page backwards before oldest kline
    if not rows:
        logger.debug("Binance crypto fetch failed for %s: no klines", ticker)
    else:
        # Pages arrive newest-first but each page is oldest→newest, so the
        # concatenated list is NOT time-ordered: sort first, then keep the
        # most recent `needed` bars matching the requested period.
        # (ISO date strings sort lexicographically.)
        rows.sort(key=lambda r: r["date"])
        excess = len(rows) - needed
        if excess > 0:
            rows = rows[excess:]

    # 3. Fallback to Coinbase public candles
    if not rows and ("BTC" in ticker or "BITCOIN" in ticker):
        try:
            granularity_map = {"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 21600, "1d": 86400}
            gran = granularity_map.get(interval_clean, 86400)
            cb_url = f"https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity={gran}"
            req = urllib.request.Request(cb_url, headers={"User-Agent": "StockOracle/2.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                if isinstance(data, list) and len(data) > 0:
                    for k in reversed(data):
                        dt = datetime.fromtimestamp(int(k[0]), tz=timezone.utc).astimezone(_IST)
                        date_str = dt.strftime("%Y-%m-%d") if not is_intraday else dt.strftime("%Y-%m-%d %H:%M:%S")
                        rows.append({
                            "date": date_str,
                            "open": float(k[3]),
                            "high": float(k[2]),
                            "low": float(k[1]),
                            "close": float(k[4]),
                            "volume": float(k[5]),
                        })
        except Exception as exc2:
            logger.debug("Coinbase crypto fetch failed for %s: %s", ticker, exc2)

    # 3b. Gold aliases: yfinance XAUUSD=X fallback (Binance PAXG primary unreachable)
    if not rows and _is_gold_ticker(ticker):
        try:
            import yfinance as yf
            _yf_iv = {"1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "1h", "1d": "1d"}.get(interval_clean, "1d")
            _yf_df = yf.download("XAUUSD=X", period=("5d" if is_intraday else "2y"), interval=_yf_iv, progress=False, auto_adjust=False)
            if _yf_df is not None and not _yf_df.empty:
                if isinstance(_yf_df.columns, pd.MultiIndex):
                    _yf_df.columns = _yf_df.columns.get_level_values(0)
                _yf_df = _yf_df.reset_index()
                _ts_col = "Datetime" if "Datetime" in _yf_df.columns else ("Date" if "Date" in _yf_df.columns else _yf_df.columns[0])
                for _, _r in _yf_df.iterrows():
                    _dt = pd.to_datetime(_r[_ts_col])
                    if _dt.tzinfo is None:
                        _dt = _dt.replace(tzinfo=timezone.utc)
                    _ds = _dt.astimezone(_IST).strftime("%Y-%m-%d" if not is_intraday else "%Y-%m-%d %H:%M:%S")
                    rows.append({
                        "date": _ds,
                        "open": float(_r.get("Open", 0) or 0),
                        "high": float(_r.get("High", 0) or 0),
                        "low": float(_r.get("Low", 0) or 0),
                        "close": float(_r.get("Close", 0) or 0),
                        "volume": float(_r.get("Volume", 0) or 0),
                    })
        except Exception as yf_exc:
            logger.debug("yfinance XAUUSD fallback failed for %s: %s", ticker, yf_exc)

    if rows:
        df = pd.DataFrame(rows)
        # Enforce OHLC consistency
        df["high"] = np.maximum(df["high"], np.maximum(df["open"], df["close"]))
        df["low"] = np.minimum(df["low"], np.minimum(df["open"], df["close"]))
        df = df[(df["open"] > 0) & (df["close"] > 0) & (df["high"] > 0) & (df["low"] > 0)]
        df = df.drop_duplicates(subset=["date"]).sort_values("date").reset_index(drop=True)
        # Slot-complete series: fill stall holes so charts never show whitespace gaps
        df = fill_intraday_time_gaps(df, interval_clean, is_crypto=True)

        if not is_intraday:
            save_historical_prices(ticker, df)
            _set_cached(cache_key, df)
        else:
            save_intraday_candles(ticker, interval_clean, df)
            crypto_ttl = 2 if interval_clean in ["1s", "30s"] else (8 if interval_clean == "1m" else 25)
            _set_cached(cache_key, df, ttl_seconds=crypto_ttl)
        df.attrs["data_source"] = "binance_crypto"
        return df

    # 4. Check DB fallback if network was unavailable
    if not is_intraday:
        db_df = get_historical_prices(ticker)
        if db_df is not None and not db_df.empty:
            db_df.attrs["data_source"] = "sqlite"
            return db_df
    else:
        intra_db = get_intraday_candles(ticker, interval_clean)
        if intra_db is not None and not intra_db.empty:
            intra_db.attrs["data_source"] = "sqlite"
            return intra_db

    # 5. Baseline seed data fallback (for isolated environments without internet)
    # Charts-only: seed is NEVER persisted to historical_prices/intraday_candles.
    # Daily seed dates are len-10 strings, so persisting them would launder
    # synthetic bars into future "sqlite" reads and poison ML/backtest inputs.
    seed_df = _generate_crypto_seed_data(ticker, interval_clean, is_intraday)
    if seed_df is not None and not seed_df.empty:
        logger.warning(
            "Serving crypto_seed baseline for %s (%s) — charts only, "
            "blocked from ML/backtest by require_real_data.",
            ticker, interval_clean,
        )
        seed_df.attrs["data_source"] = "crypto_seed"
        _set_cached(cache_key, seed_df)
        return seed_df

    return None


def fetch_crypto_live_ticker(ticker: str) -> Optional[dict]:
    """Fetches real-time live ticker for cryptocurrencies without stale DB cache."""
    import json
    import urllib.request

    ticker = ticker.upper().strip()
    symbol = _binance_crypto_symbol(ticker)
    url = f"https://api.binance.com/api/v3/ticker/24hr?symbol={symbol}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "StockOracle/2.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            ltp = float(data.get("lastPrice", 0.0))
            if ltp > 0:
                open_p = float(data.get("openPrice", ltp))
                high_p = float(data.get("highPrice", ltp))
                low_p = float(data.get("lowPrice", ltp))
                prev_c = float(data.get("prevClosePrice", open_p) or open_p)
                vol = float(data.get("volume", 0.0))
                chg_pct = float(data.get("priceChangePercent", 0.0))

                return {
                    "ticker": ticker,
                    "company_name": "Gold (XAU/USD)" if _is_gold_ticker(ticker) else "Bitcoin (BTC / USD)",
                    "current_price": ltp,
                    "open": open_p,
                    "day_high": high_p,
                    "day_low": low_p,
                    "close": prev_c,
                    "change_pct": chg_pct,
                    "volume": vol,
                    "is_live": True,
                }
    except Exception as exc:
        logger.debug("Failed to fetch live crypto ticker for %s: %s", ticker, exc)

    return None


def fetch_crypto_info(ticker: str) -> Optional[dict]:
    """Fetches real-time 24h ticker info for cryptocurrencies."""
    import json
    import urllib.request

    ticker = ticker.upper().strip()
    fresh = get_company_info(ticker)
    if fresh is not None:
        return fresh

    symbol = _binance_crypto_symbol(ticker)
    url = f"https://api.binance.com/api/v3/ticker/24hr?symbol={symbol}"

    info = None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "StockOracle/2.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            ltp = float(data.get("lastPrice", 0.0))
            if ltp > 0:
                open_p = float(data.get("openPrice", ltp))
                high_p = float(data.get("highPrice", ltp))
                low_p = float(data.get("lowPrice", ltp))
                prev_c = float(data.get("prevClosePrice", open_p) or open_p)
                vol = float(data.get("volume", 0.0))
                chg_pct = float(data.get("priceChangePercent", 0.0))

                info = {
                    "ticker": ticker,
                    "company_name": "Gold (XAU/USD)" if _is_gold_ticker(ticker) else "Bitcoin (BTC / USD)",
                    "current_price": ltp,
                    "open": open_p,
                    "day_high": high_p,
                    "day_low": low_p,
                    "close": prev_c,
                    "change_pct": chg_pct,
                    "volume": vol,
                    "fifty_two_week_high": (high_p * 1.15) if not _is_gold_ticker(ticker) else None,
                    "fifty_two_week_low": (low_p * 0.70) if not _is_gold_ticker(ticker) else None,
                    "market_cap": None if _is_gold_ticker(ticker) else ltp * 19700000,
                    "pe_ratio": None,
                    "dividend_yield": None,
                    "sector": "Commodity" if _is_gold_ticker(ticker) else "Cryptocurrency",
                }
                save_company_info(ticker, info)
                return info
    except Exception as exc:
        logger.debug("Failed to fetch crypto info from Binance for %s: %s", ticker, exc)

    # Fallback to last known historical close
    hist = get_historical_prices(ticker)
    if hist is not None and not hist.empty:
        last = hist.iloc[-1]
        c = float(last.get("close", 64250.0))
        o = float(last.get("open", c))
        h = float(last.get("high", c))
        l = float(last.get("low", c))
        v = float(last.get("volume", 0))
        info = {
            "ticker": ticker,
            "company_name": "Gold (XAU/USD)" if _is_gold_ticker(ticker) else "Bitcoin (BTC / USD)",
            "current_price": c,
            "open": o,
            "day_high": h,
            "day_low": l,
            "close": c,
            "change_pct": round(((c - o) / o) * 100, 2) if o > 0 else 0.0,
            "volume": v,
            "fifty_two_week_high": (h * 1.15) if not _is_gold_ticker(ticker) else None,
            "fifty_two_week_low": (l * 0.70) if not _is_gold_ticker(ticker) else None,
            "market_cap": None if _is_gold_ticker(ticker) else c * 19700000,
            "pe_ratio": None,
            "dividend_yield": None,
            "sector": "Commodity" if _is_gold_ticker(ticker) else "Cryptocurrency",
        }
        save_company_info(ticker, info)
        return info

    return None
