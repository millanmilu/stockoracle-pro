"""
StockOracle Pro — NSE Market Calendar & Session Engine
Tracks NSE trading sessions, market timings, and official exchange holidays.
"""
from datetime import datetime, time, date
from typing import Tuple
from zoneinfo import ZoneInfo

_IST = ZoneInfo("Asia/Kolkata")


def _now_ist() -> datetime:
    """Returns current datetime in IST (Asia/Kolkata) regardless of server timezone."""
    return datetime.now(_IST)


# Official NSE Equity Holidays (2025 - 2026)
NSE_HOLIDAYS = {
    # 2025 Holidays
    date(2025, 1, 26),   # Republic Day
    date(2025, 2, 26),   # Mahashivratri
    date(2025, 3, 14),   # Holi
    date(2025, 3, 31),   # Id-Ul-Fitr
    date(2025, 4, 10),   # Shri Mahavir Jayanti
    date(2025, 4, 14),   # Dr. Baba Saheb Ambedkar Jayanti
    date(2025, 4, 18),   # Good Friday
    date(2025, 5, 1),    # Maharashtra Day
    date(2025, 8, 15),   # Independence Day
    date(2025, 8, 27),   # Ganesh Chaturthi
    date(2025, 10, 2),   # Mahatma Gandhi Jayanti
    date(2025, 10, 21),  # Diwali Laxmi Pujan (Muhurat Trading only)
    date(2025, 10, 22),  # Diwali Balipratipada
    date(2025, 11, 5),   # Gurunanak Jayanti
    date(2025, 12, 25),  # Christmas
    # 2026 Holidays
    date(2026, 1, 26),   # Republic Day
    date(2026, 2, 17),   # Mahashivratri
    date(2026, 3, 3),    # Holi
    date(2026, 3, 20),   # Id-Ul-Fitr
    date(2026, 4, 3),    # Good Friday
    date(2026, 4, 14),   # Dr. Baba Saheb Ambedkar Jayanti
    date(2026, 5, 1),    # Maharashtra Day
    date(2026, 8, 15),   # Independence Day
    date(2026, 10, 2),   # Mahatma Gandhi Jayanti
    date(2026, 10, 20),  # Dussehra
    date(2026, 11, 8),   # Diwali Laxmi Pujan
    date(2026, 11, 24),  # Gurunanak Jayanti
    date(2026, 12, 25),  # Christmas
}

# Standard NSE Market Timing Boundaries (IST)
MARKET_PRE_OPEN_START = time(9, 0)
MARKET_OPEN           = time(9, 15)
MARKET_CLOSE          = time(15, 30)
MARKET_POST_CLOSE     = time(16, 0)


def is_trading_day(dt: datetime = None) -> bool:
    """Returns True if the given date is an active NSE trading day (weekday and not an exchange holiday).
    Always evaluates in IST regardless of server timezone."""
    if dt is None:
        dt = _now_ist()
    elif dt.tzinfo is None:
        # naive datetime passed in — assume IST
        dt = dt.replace(tzinfo=_IST)
    d = dt.date()
    # Check weekend (Saturday = 5, Sunday = 6)
    if dt.weekday() >= 5:
        return False
    # Check official holiday
    if d in NSE_HOLIDAYS:
        return False
    return True


def is_market_open(dt: datetime = None) -> bool:
    """Returns True if the normal continuous trading session (09:15 to 15:30 IST) is currently live.
    Always evaluates in IST regardless of server timezone."""
    if dt is None:
        dt = _now_ist()
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=_IST)
    if not is_trading_day(dt):
        return False
    t = dt.time()
    return MARKET_OPEN <= t <= MARKET_CLOSE


def get_market_session_phase(dt: datetime = None) -> str:
    """
    Returns the current session phase (always evaluated in IST):
      - 'PRE_MARKET'  (09:00 - 09:15)
      - 'LIVE'        (09:15 - 15:30)
      - 'POST_MARKET' (15:30 - 16:00)
      - 'CLOSED'      (After hours / Weekend / Holiday)
    """
    if dt is None:
        dt = _now_ist()
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=_IST)
    if not is_trading_day(dt):
        return "CLOSED"
    t = dt.time()
    if MARKET_PRE_OPEN_START <= t < MARKET_OPEN:
        return "PRE_MARKET"
    elif MARKET_OPEN <= t <= MARKET_CLOSE:
        return "LIVE"
    elif MARKET_CLOSE < t <= MARKET_POST_CLOSE:
        return "POST_MARKET"
    else:
        return "CLOSED"


def get_price_freshness(dt: datetime = None) -> dict:
    """Returns structured price metadata including freshness, session, and as_of timestamp.
    Always evaluates in IST regardless of server timezone."""
    if dt is None:
        dt = _now_ist()
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=_IST)
    phase = get_market_session_phase(dt)
    freshness = "REALTIME" if phase == "LIVE" else ("DELAYED" if phase in ["PRE_MARKET", "POST_MARKET"] else "CACHED_EOD")
    return {
        "session_phase": phase,
        "freshness":     freshness,
        "is_trading_day": is_trading_day(dt),
        "as_of":         dt.isoformat()
    }

