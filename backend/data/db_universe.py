# StockOracle Pro - NSE stock universe (symbol master) storage.
# Moved verbatim from backend.data.database.
from .db_connection import *  # noqa: F401,F403

def save_stock_universe(records: list[dict]):
    """Persists the searchable NSE symbol master via SQLAlchemy ORM."""
    if not records:
        return

    now = datetime.now().isoformat()
    rows = [
        {
            "ticker": item["ticker"],
            "name": item["name"],
            "symbol": item["symbol"],
            "token": item.get("token", ""),
            "exchange": item.get("exchange", "NSE"),
            "updated_at": now,
        }
        for item in records
    ]
    with get_db_session() as session:
        dialect = session.bind.dialect.name if session.bind else "sqlite"
        # Keep SQLite multi-row inserts below its bind-variable limit.
        chunk_size = 100
        for i in range(0, len(rows), chunk_size):
            chunk = rows[i:i + chunk_size]
            if dialect == "sqlite":
                stmt = sqlite_insert(StockUniverse).values(chunk)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["ticker"],
                    set_={
                        "name": stmt.excluded.name,
                        "symbol": stmt.excluded.symbol,
                        "token": stmt.excluded.token,
                        "exchange": stmt.excluded.exchange,
                        "updated_at": stmt.excluded.updated_at,
                    }
                )
                session.execute(stmt)
            elif dialect == "postgresql":
                stmt = pg_insert(StockUniverse).values(chunk)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["ticker"],
                    set_={
                        "name": stmt.excluded.name,
                        "symbol": stmt.excluded.symbol,
                        "token": stmt.excluded.token,
                        "exchange": stmt.excluded.exchange,
                        "updated_at": stmt.excluded.updated_at,
                    }
                )
                session.execute(stmt)
            else:
                for r in chunk:
                    session.merge(StockUniverse(**r))


POPULAR_NSE_FALLBACKS = [
    {"ticker": "RELIANCE", "name": "Reliance Industries Ltd", "exchange": "NSE"},
    {"ticker": "TCS", "name": "Tata Consultancy Services Ltd", "exchange": "NSE"},
    {"ticker": "HDFCBANK", "name": "HDFC Bank Ltd", "exchange": "NSE"},
    {"ticker": "INFY", "name": "Infosys Ltd", "exchange": "NSE"},
    {"ticker": "ICICIBANK", "name": "ICICI Bank Ltd", "exchange": "NSE"},
    {"ticker": "HINDUNILVR", "name": "Hindustan Unilever Ltd", "exchange": "NSE"},
    {"ticker": "ITC", "name": "ITC Ltd", "exchange": "NSE"},
    {"ticker": "SBIN", "name": "State Bank of India", "exchange": "NSE"},
    {"ticker": "BHARTIARTL", "name": "Bharti Airtel Ltd", "exchange": "NSE"},
    {"ticker": "KOTAKBANK", "name": "Kotak Mahindra Bank Ltd", "exchange": "NSE"},
    {"ticker": "LT", "name": "Larsen & Toubro Ltd", "exchange": "NSE"},
    {"ticker": "BAJFINANCE", "name": "Bajaj Finance Ltd", "exchange": "NSE"},
    {"ticker": "AXISBANK", "name": "Axis Bank Ltd", "exchange": "NSE"},
    {"ticker": "ASIANPAINT", "name": "Asian Paints Ltd", "exchange": "NSE"},
    {"ticker": "MARUTI", "name": "Maruti Suzuki India Ltd", "exchange": "NSE"},
    {"ticker": "TATAMOTORS", "name": "Tata Motors Ltd", "exchange": "NSE"},
    {"ticker": "SUNPHARMA", "name": "Sun Pharmaceutical Industries Ltd", "exchange": "NSE"},
    {"ticker": "TITAN", "name": "Titan Company Ltd", "exchange": "NSE"},
    {"ticker": "WIPRO", "name": "Wipro Ltd", "exchange": "NSE"},
    {"ticker": "ULTRACEMCO", "name": "UltraTech Cement Ltd", "exchange": "NSE"},
    {"ticker": "POWERGRID", "name": "Power Grid Corporation of India Ltd", "exchange": "NSE"},
    {"ticker": "NTPC", "name": "NTPC Ltd", "exchange": "NSE"},
    {"ticker": "M&M", "name": "Mahindra & Mahindra Ltd", "exchange": "NSE"},
    {"ticker": "HCLTECH", "name": "HCL Technologies Ltd", "exchange": "NSE"},
    {"ticker": "ADANIENT", "name": "Adani Enterprises Ltd", "exchange": "NSE"},
    {"ticker": "ADANIPORTS", "name": "Adani Ports & SEZ Ltd", "exchange": "NSE"},
    {"ticker": "TATASTEEL", "name": "Tata Steel Ltd", "exchange": "NSE"},
    {"ticker": "COALINDIA", "name": "Coal India Ltd", "exchange": "NSE"},
    {"ticker": "BAJAJFINSV", "name": "Bajaj Finserv Ltd", "exchange": "NSE"},
    {"ticker": "ONGC", "name": "Oil & Natural Gas Corporation Ltd", "exchange": "NSE"},
]


POPULAR_NAME_MAP = {item["ticker"]: item["name"] for item in POPULAR_NSE_FALLBACKS}


def search_stock_universe(query: str, limit: int = 12) -> list[dict]:
    """Returns ticker/name matches from the locally stored NSE symbol master and screener universe."""
    text_q = query.strip().upper()
    if not text_q:
        return []
    like_q = f"%{text_q}%"
    prefix_q = f"{text_q}%"
    lim = max(1, min(limit, 30))

    try:
        with get_db_session() as session:
            stmt = text("""
                SELECT ticker, name, exchange
                FROM (
                    SELECT ticker, name, exchange,
                        MIN(CASE 
                            WHEN UPPER(ticker) = :exact THEN 0 
                            WHEN UPPER(ticker) LIKE :prefix AND UPPER(ticker) NOT LIKE '%-%' THEN 1 
                            WHEN UPPER(ticker) LIKE :prefix THEN 2
                            WHEN UPPER(name) LIKE :prefix THEN 3
                            WHEN UPPER(ticker) NOT LIKE '%-%' THEN 4
                            ELSE 5 
                        END) AS rank_score
                    FROM (
                        SELECT ticker, COALESCE(name, ticker) as name, COALESCE(exchange, 'NSE') as exchange 
                        FROM stock_universe 
                        WHERE UPPER(ticker) LIKE :like OR UPPER(name) LIKE :like
                        UNION ALL
                        SELECT ticker, COALESCE(name, ticker) as name, 'NSE' as exchange 
                        FROM screener_daily_metrics 
                        WHERE UPPER(ticker) LIKE :like OR UPPER(name) LIKE :like
                    ) sub
                    GROUP BY ticker, name, exchange
                ) ranked
                ORDER BY rank_score ASC, ticker ASC
                LIMIT :lim
            """)
            rows = session.execute(stmt, {
                "like": like_q,
                "exact": text_q,
                "prefix": prefix_q,
                "lim": lim
            }).fetchall()

            if rows:
                results = []
                for r in rows:
                    t = r[0]
                    n = r[1] or t
                    if (not n or n == t) and t in POPULAR_NAME_MAP:
                        n = POPULAR_NAME_MAP[t]
                    results.append({"ticker": t, "name": n, "exchange": r[2] or "NSE"})
                return results
    except Exception as exc:
        logger.warning("Error searching stock universe in database: %s", exc)

    # Fallback to local matching against popular stocks list
    matches = []
    for item in POPULAR_NSE_FALLBACKS:
        if text_q in item["ticker"].upper() or text_q in item["name"].upper():
            matches.append(item)
            if len(matches) >= lim:
                break
    return matches




def get_all_stock_universe_tickers(limit: int = 1500) -> list[str]:
    """Returns all NSE tickers stored in the stock_universe table."""
    with get_db_session() as session:
        stmt = select(StockUniverse.ticker).order_by(StockUniverse.ticker.asc()).limit(limit)
        return list(session.execute(stmt).scalars().all())


def get_all_stock_universe_records(limit: int = 1500) -> list[dict]:
    """Returns all NSE stock master records."""
    with get_db_session() as session:
        stmt = select(StockUniverse.ticker, StockUniverse.name, StockUniverse.exchange).order_by(StockUniverse.ticker.asc()).limit(limit)
        rows = session.execute(stmt).all()
        return [{"ticker": r[0], "name": r[1], "exchange": r[2]} for r in rows]


def get_stock_universe_token(ticker_or_symbol: str) -> Optional[dict]:
    """Retrieves token and scrip metadata for a ticker or symbol via SQLAlchemy ORM."""
    t = ticker_or_symbol.upper().strip()
    key = t if t.endswith("-EQ") else f"{t}-EQ"
    try:
        with get_db_session() as session:
            stmt = select(
                StockUniverse.ticker, StockUniverse.name, StockUniverse.symbol, StockUniverse.token, StockUniverse.exchange
            ).filter(
                or_(StockUniverse.ticker == t, StockUniverse.symbol == key, StockUniverse.ticker == key, StockUniverse.symbol == t)
            ).limit(1)
            row = session.execute(stmt).first()
            if row:
                return {
                    "symbol": row[2] or key,
                    "token": row[3] or "",
                    "exchange": row[4] or "NSE",
                    "exch_seg": row[4] or "NSE",
                    "name": row[1] or t,
                }
    except Exception as exc:
        logger.debug("Error looking up stock token for %s: %s", t, exc)
    return None
