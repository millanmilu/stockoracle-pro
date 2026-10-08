"""Top-liquid Binance USDT universe, cached so polling never becomes an API storm."""

from __future__ import annotations

import json
import time
from urllib.request import Request, urlopen

_cache: tuple[float, tuple[str, ...]] = (0.0, ())
_FALLBACK = (
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "TRXUSDT",
    "AVAXUSDT", "LINKUSDT", "DOTUSDT", "MATICUSDT", "LTCUSDT", "BCHUSDT", "ATOMUSDT", "NEARUSDT",
    "APTUSDT", "ARBUSDT", "OPUSDT", "FILUSDT",
)
_STABLE_BASES = {"USDC", "USDT", "FDUSD", "TUSD", "USDP", "DAI", "BUSD", "EUR", "AEUR"}


def top20_usdt_symbols() -> tuple[str, ...]:
    global _cache
    if time.monotonic() - _cache[0] < 3600 and _cache[1]:
        return _cache[1]
    try:
        request = Request("https://api.binance.com/api/v3/ticker/24hr", headers={"User-Agent": "StockOracle/2.0"})
        with urlopen(request, timeout=5) as response:
            rows = json.loads(response.read().decode())
        allowed = [row for row in rows if str(row.get("symbol", "")).endswith("USDT")
                   and str(row.get("symbol", ""))[:-4] not in _STABLE_BASES]
        ranked = sorted(allowed, key=lambda row: float(row.get("quoteVolume") or 0), reverse=True)
        symbols = tuple(str(row["symbol"]).upper() for row in ranked[:20])
        if len(symbols) == 20:
            _cache = (time.monotonic(), symbols)
            return symbols
    except Exception:
        pass
    _cache = (time.monotonic(), _FALLBACK)
    return _FALLBACK
