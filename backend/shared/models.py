"""
StockOracle Pro — Declarative SQLAlchemy 2.0 Models
Compatible with PostgreSQL / TimescaleDB and SQLite.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, BigInteger, Text, DateTime, Boolean,
    Index, UniqueConstraint, PrimaryKeyConstraint, func, CheckConstraint
)
from sqlalchemy.orm import declarative_base, validates

Base = declarative_base()


class HistoricalPrice(Base):
    """
    Daily OHLCV records.
    INVARIANT: Date must strictly be formatted as 'YYYY-MM-DD' representing NSE/IST market day.
    Intraday bars are NEVER stored in this table.
    """
    __tablename__ = "historical_prices"

    ticker = Column(String(20), primary_key=True, nullable=False)
    date = Column(String(10), primary_key=True, nullable=False)  # Strict YYYY-MM-DD
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index("idx_hist_ticker_date", "ticker", "date"),
        CheckConstraint("length(date) = 10", name="ck_hist_date_len"),
        CheckConstraint("open > 0", name="ck_hist_open_pos"),
        CheckConstraint("high > 0", name="ck_hist_high_pos"),
        CheckConstraint("low > 0", name="ck_hist_low_pos"),
        CheckConstraint("close > 0", name="ck_hist_close_pos"),
        CheckConstraint("low <= open AND low <= close", name="ck_hist_low_le"),
        CheckConstraint("high >= open AND high >= close", name="ck_hist_high_ge"),
        CheckConstraint("volume >= 0", name="ck_hist_vol_nonneg"),
    )

    @validates("date")
    def _validate_date(self, key, value):
        import re as _re
        v = str(value or "").strip()
        if not _re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            raise ValueError(f"HistoricalPrice.date must be YYYY-MM-DD, got {value!r}")
        return v

    @validates("open", "high", "low", "close")
    def _validate_price(self, key, value):
        try:
            v = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"HistoricalPrice.{key} must be numeric, got {value!r}")
        if not (v > 0):
            raise ValueError(f"HistoricalPrice.{key} must be > 0, got {value!r}")
        return v


class StockUniverse(Base):
    """Full NSE indexed stock universe."""
    __tablename__ = "stock_universe"

    ticker = Column(String(20), primary_key=True, nullable=False)
    name = Column(String(255), nullable=False)
    symbol = Column(String(50), nullable=False)
    token = Column(String(50), nullable=True)
    exchange = Column(String(20), nullable=False, default="NSE")
    updated_at = Column(String(50), nullable=False)

    __table_args__ = (
        Index("idx_universe_name", "name"),
        Index("idx_universe_symbol", "symbol"),
    )


class LiveTick(Base):
    """High-frequency tick stream from WebSocket feeds."""
    __tablename__ = "live_ticks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), nullable=False, index=True)
    timestamp = Column(String(50), nullable=False, index=True)
    price = Column(Float, nullable=False)
    change_pct = Column(Float, nullable=True)

    __table_args__ = (
        Index("idx_ticks_ticker_time", "ticker", "timestamp"),
    )


class IntradayCandle(Base):
    """Intraday OHLCV bars (1m, 5m, 15m, 1h). Suitable for TimescaleDB hypertable."""
    __tablename__ = "intraday_candles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), nullable=False, index=True)
    interval = Column(String(10), nullable=False, index=True)  # '1m', '5m', '15m', '1h'
    timestamp = Column(String(50), nullable=False, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index("idx_intraday_lookup", "ticker", "interval", "timestamp"),
    )


class PortfolioPosition(Base):
    """User portfolio holdings with multi-user isolation."""
    __tablename__ = "portfolio"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default_user", index=True)
    ticker = Column(String(20), nullable=False)
    shares = Column(Float, nullable=False)
    buy_price = Column(Float, nullable=False)
    added_at = Column(String(50), default=lambda: datetime.now(timezone.utc).isoformat())

    __table_args__ = (
        Index("idx_portfolio_user", "user_id"),
    )


class SmartAlert(Base):
    """User smart technical & price alerts."""
    __tablename__ = "smart_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default_user", index=True)
    ticker = Column(String(20), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False)
    param_value = Column(Text, nullable=False, default="{}")
    triggered = Column(Integer, nullable=False, default=0)
    created_at = Column(String(50), default=lambda: datetime.now(timezone.utc).isoformat())

    __table_args__ = (
        Index("idx_smart_alerts_user_ticker", "user_id", "ticker"),
    )


class PaperAccount(Base):
    """Virtual paper trading account (default ₹10 Lakhs)."""
    __tablename__ = "paper_accounts"

    user_id = Column(String(100), primary_key=True, nullable=False)
    cash_balance = Column(Float, nullable=False, default=1000000.0)
    starting_balance = Column(Float, nullable=False, default=1000000.0)
    updated_at = Column(String(50), nullable=False)


class PaperPosition(Base):
    """Open active virtual positions."""
    __tablename__ = "paper_positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, index=True)
    ticker = Column(String(20), nullable=False)
    order_type = Column(String(20), nullable=False, default="BUY")
    shares = Column(Float, nullable=False)
    avg_buy_price = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=True)
    target_price = Column(Float, nullable=True)
    opened_at = Column(String(50), nullable=False)

    __table_args__ = (
        Index("idx_paper_pos_user", "user_id"),
    )


class PaperOrder(Base):
    """Executed paper trading journal."""
    __tablename__ = "paper_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, index=True)
    ticker = Column(String(20), nullable=False)
    order_type = Column(String(20), nullable=False)
    action = Column(String(20), nullable=False)
    shares = Column(Float, nullable=False)
    executed_price = Column(Float, nullable=False)
    realized_pnl = Column(Float, nullable=False, default=0.0)
    status = Column(String(30), nullable=False, default="EXECUTED")
    executed_at = Column(String(50), nullable=False)

    __table_args__ = (
        Index("idx_paper_ord_user", "user_id"),
    )


class AuditLog(Base):
    """Immutable audit trail for all user and system transactions."""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default_user", index=True)
    action = Column(String(50), nullable=False)
    entity = Column(String(50), nullable=False)
    entity_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    ts_utc = Column(String(50), nullable=False, index=True)

    __table_args__ = (
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_ts", "ts_utc"),
    )


class TaskStatus(Base):
    """Background model training and backfill task status registry."""
    __tablename__ = "task_status"

    task_id = Column(String(100), primary_key=True, nullable=False)
    ticker = Column(String(20), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="queued")
    progress = Column(Integer, nullable=False, default=0)
    mape = Column(Float, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=False)


class ModelRegistry(Base):
    """ML model versioning, artifacts, and validation lineage."""
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), nullable=False, index=True)
    model_type = Column(String(50), nullable=False)  # 'xgboost', 'lstm', 'transformer', 'ensemble'
    version = Column(String(20), nullable=False)
    artifact_path = Column(String(255), nullable=False)
    mape = Column(Float, nullable=True)
    rmse = Column(Float, nullable=True)
    metrics_json = Column(Text, nullable=True)
    trained_at = Column(String(50), nullable=False)
    is_active = Column(Integer, nullable=False, default=1)


class SavedScan(Base):
    """User-saved custom screener scans and criteria presets."""
    __tablename__ = "saved_scans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default_user", index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    filters_json = Column(Text, nullable=False, default="{}")
    created_at = Column(String(50), nullable=False)

    __table_args__ = (
        Index("idx_saved_scans_user", "user_id"),
    )


class Company(Base):
    """Company profile and classification metadata."""
    __tablename__ = "companies"

    ticker = Column(String(20), primary_key=True, nullable=False)
    name = Column(String(150), nullable=False)
    sector = Column(String(100), nullable=True, index=True)
    industry = Column(String(100), nullable=True, index=True)
    market_cap_category = Column(String(20), nullable=True, index=True)  # LARGE, MID, SMALL, MICRO
    about_text = Column(Text, nullable=True)
    website_url = Column(String(255), nullable=True)
    bse_code = Column(String(20), nullable=True)
    nse_symbol = Column(String(20), nullable=True)


class FinancialStatement(Base):
    """Quarterly and Annual Financial Statements (P&L, Balance Sheet, Cash Flows)."""
    __tablename__ = "financial_statements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), nullable=False, index=True)
    period_type = Column(String(20), nullable=False)  # 'QUARTERLY' | 'ANNUAL'
    period_label = Column(String(30), nullable=False)  # 'Jun 2026', 'FY26'
    revenue = Column(Float, nullable=True)
    operating_profit = Column(Float, nullable=True)
    opm_pct = Column(Float, nullable=True)
    net_profit = Column(Float, nullable=True)
    npm_pct = Column(Float, nullable=True)
    eps = Column(Float, nullable=True)
    balance_sheet_json = Column(Text, nullable=True)
    cash_flow_json = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_fin_stmt_ticker_period", "ticker", "period_type"),
    )


class FinancialRatio(Base):
    """Core financial and valuation ratios."""
    __tablename__ = "financial_ratios"

    ticker = Column(String(20), primary_key=True, nullable=False)
    pe_ratio = Column(Float, nullable=True)
    pb_ratio = Column(Float, nullable=True)
    roe_pct = Column(Float, nullable=True)
    roce_pct = Column(Float, nullable=True)
    debt_to_equity = Column(Float, nullable=True)
    opm_pct = Column(Float, nullable=True)
    npm_pct = Column(Float, nullable=True)
    sales_growth_3y = Column(Float, nullable=True)
    profit_growth_3y = Column(Float, nullable=True)
    cagr_5y = Column(Float, nullable=True)


class ShareholdingSnapshot(Base):
    """Quarterly shareholding patterns."""
    __tablename__ = "shareholding_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), nullable=False, index=True)
    quarter_label = Column(String(30), nullable=False)
    promoter_pct = Column(Float, nullable=True)
    fii_pct = Column(Float, nullable=True)
    dii_pct = Column(Float, nullable=True)
    public_pct = Column(Float, nullable=True)
    others_pct = Column(Float, nullable=True)


class ScreenerDailyMetric(Base):
    """Precomputed indexed daily metrics table for sub-50ms multi-factor SQL screener scans."""
    __tablename__ = "screener_daily_metrics"

    ticker = Column(String(20), primary_key=True, nullable=False)
    name = Column(String(150), nullable=False)
    sector = Column(String(100), nullable=True, index=True)
    industry = Column(String(100), nullable=True, index=True)
    market_cap_cr = Column(Float, nullable=True, index=True)
    market_cap_cat = Column(String(20), nullable=True, index=True)
    
    # Prices & Returns
    close_price = Column(Float, nullable=False, index=True)
    change_1d_pct = Column(Float, nullable=True, index=True)
    change_1w_pct = Column(Float, nullable=True)
    change_1m_pct = Column(Float, nullable=True)
    change_1y_pct = Column(Float, nullable=True)
    distance_52w_high_pct = Column(Float, nullable=True, index=True)
    distance_52w_low_pct = Column(Float, nullable=True)

    # Technicals
    rsi_14 = Column(Float, nullable=True, index=True)
    macd_signal = Column(String(20), nullable=True, index=True)
    sma_20 = Column(Float, nullable=True)
    sma_50 = Column(Float, nullable=True)
    sma_200 = Column(Float, nullable=True)
    volume_ratio_20d = Column(Float, nullable=True, index=True)
    # ── Institutional extension (all nullable; backfilled by screener pipeline) ──
    ema_9 = Column(Float, nullable=True)
    ema_20 = Column(Float, nullable=True)
    ema_50 = Column(Float, nullable=True)
    ema_200 = Column(Float, nullable=True)
    adx_14 = Column(Float, nullable=True, index=True)
    atr_pct = Column(Float, nullable=True)
    bb_width_pct = Column(Float, nullable=True)
    bb_position = Column(Float, nullable=True)
    stoch_k = Column(Float, nullable=True)
    stoch_d = Column(Float, nullable=True)
    cci_20 = Column(Float, nullable=True)
    roc_12 = Column(Float, nullable=True)
    williams_r = Column(Float, nullable=True)
    macd_hist = Column(Float, nullable=True)
    macd_crossover = Column(String(30), nullable=True)
    supertrend_dir = Column(Float, nullable=True)
    vwap_dist_pct = Column(Float, nullable=True)
    hist_vol_20 = Column(Float, nullable=True)
    high_52w = Column(Float, nullable=True)
    low_52w = Column(Float, nullable=True)
    pos_52w_pct = Column(Float, nullable=True, index=True)
    # Market structure (deterministic rule output, never AI-invented)
    structure_label = Column(String(40), nullable=True, index=True)
    trend_hint = Column(String(20), nullable=True, index=True)
    support_price = Column(Float, nullable=True)
    resistance_price = Column(Float, nullable=True)
    breakout_52w_high = Column(Integer, nullable=True, default=0)
    breakdown_52w_low = Column(Integer, nullable=True, default=0)
    resistance_breakout = Column(Integer, nullable=True, default=0)
    support_breakdown = Column(Integer, nullable=True, default=0)
    volume_breakout = Column(Integer, nullable=True, default=0)
    breakout_strength = Column(Float, nullable=True)
    retest_status = Column(String(20), nullable=True)
    consolidation = Column(Integer, nullable=True, default=0)
    liquidity_sweep = Column(String(20), nullable=True)
    # Momentum / regime
    momentum_state = Column(String(20), nullable=True, index=True)
    ema_alignment = Column(String(30), nullable=True, index=True)
    market_regime = Column(String(30), nullable=True, index=True)
    regime_confidence = Column(Float, nullable=True)
    # Relative strength (None when benchmark unavailable — never synthesised)
    rs_vs_nifty_pct = Column(Float, nullable=True)
    rs_vs_sector_pct = Column(Float, nullable=True)
    # Confluence + transparent AI sub-scores
    confluence_score = Column(Float, nullable=True, index=True)
    ai_trend_score = Column(Float, nullable=True)
    ai_momentum_score = Column(Float, nullable=True)
    ai_volatility_score = Column(Float, nullable=True)
    ai_pattern_score = Column(Float, nullable=True)
    # Sentiment (neutral/None when feed unavailable)
    sentiment_score = Column(Float, nullable=True)
    sentiment_label = Column(String(30), nullable=True)
    news_count = Column(Integer, nullable=True, default=0)
    # Traceability
    why_json = Column(Text, nullable=True)
    confluence_json = Column(Text, nullable=True)
    data_status = Column(String(20), nullable=True, default="OK")

    # Fundamentals
    pe_ratio = Column(Float, nullable=True, index=True)
    pb_ratio = Column(Float, nullable=True, index=True)
    roe_pct = Column(Float, nullable=True, index=True)
    roce_pct = Column(Float, nullable=True, index=True)
    debt_to_equity = Column(Float, nullable=True, index=True)
    sales_growth_3y = Column(Float, nullable=True, index=True)
    profit_growth_3y = Column(Float, nullable=True, index=True)

    # Options
    pcr = Column(Float, nullable=True)
    max_pain = Column(Float, nullable=True)
    iv = Column(Float, nullable=True)

    # AI & Consensus
    ai_consensus_score = Column(Float, nullable=True, index=True)
    ai_signal = Column(String(30), nullable=True, index=True)
    ai_confidence_score = Column(Float, nullable=True)
    updated_at = Column(String(50), nullable=False)


class UserScreen(Base):
    """User-saved advanced multi-factor screens with formula DSL and share tokens."""
    __tablename__ = "user_screens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default_user", index=True)
    name = Column(String(120), nullable=False)
    description = Column(String(300), nullable=True)
    formula_query = Column(Text, nullable=True)
    filter_ast_json = Column(Text, nullable=False, default="{}")
    universe = Column(String(50), nullable=False, default="NIFTY_500")
    sort_by = Column(String(50), nullable=False, default="market_cap_cr")
    sort_dir = Column(String(10), nullable=False, default="DESC")
    is_public = Column(Integer, nullable=False, default=0)
    share_token = Column(String(64), nullable=True, unique=True, index=True)
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=False)


# ── Cache Entities ────────────────────────────────────────────────────────────

class CompanyInfoCache(Base):
    """Cached company profile and live metrics snapshot."""
    __tablename__ = "company_info"

    ticker = Column(String(20), primary_key=True, nullable=False)
    data_json = Column(Text, nullable=False)
    fetched_at = Column(String(50), nullable=False)


class PredictionCache(Base):
    """Cached 7-day AI forecast and prediction metrics."""
    __tablename__ = "predictions"

    ticker = Column(String(20), primary_key=True, nullable=False)
    data_json = Column(Text, nullable=False)
    fetched_at = Column(String(50), nullable=False)


class ScreenerResultCache(Base):
    """Cached screener scans output."""
    __tablename__ = "screener_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    data_json = Column(Text, nullable=False)
    fetched_at = Column(String(50), nullable=False)


class MonteCarloCache(Base):
    """Cached Monte Carlo simulations output."""
    __tablename__ = "monte_carlo"

    ticker = Column(String(20), primary_key=True, nullable=False)
    data_json = Column(Text, nullable=False)
    fetched_at = Column(String(50), nullable=False)


class BrokerAccount(Base):
    """Multi-broker credentials and persistent active session tokens."""
    __tablename__ = "broker_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    broker = Column(String(32), nullable=False, unique=True, index=True)  # "angel_one", "zerodha", "upstox", "fyers"
    is_active = Column(Boolean, default=False, nullable=False)
    credentials_json = Column(Text, nullable=False)  # Encrypted/JSON API keys and credentials
    session_data_json = Column(Text, nullable=True)  # Access tokens & expiry info
    last_verified_at = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AIProvider(Base):
    """Configured AI LLM providers, encrypted API keys, and latency telemetry."""
    __tablename__ = "ai_providers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    provider_name = Column(String(50), nullable=False, unique=True, index=True)
    api_key_encrypted = Column(Text, nullable=False)
    api_key_masked = Column(String(50), nullable=False)
    selected_model = Column(String(100), nullable=False)
    is_active = Column(Integer, nullable=False, default=0)
    last_tested_at = Column(String(50), nullable=True)
    last_test_status = Column(String(50), nullable=True, default="Not Tested")
    total_requests = Column(Integer, nullable=False, default=0)
    created_at = Column(String(50), default=lambda: datetime.now(timezone.utc).isoformat())
    updated_at = Column(String(50), default=lambda: datetime.now(timezone.utc).isoformat())


class BrokerAuditLog(Base):
    """Historical broker session and connection event journal."""
    __tablename__ = "broker_audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    broker = Column(String(50), nullable=False, index=True)
    event = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False)
    details = Column(Text, nullable=True)
    latency_ms = Column(Float, nullable=True)
    created_at = Column(String(50), nullable=False, default=lambda: datetime.now(timezone.utc).isoformat())

    __table_args__ = (
        Index("idx_broker_audit_broker", "broker"),
    )





