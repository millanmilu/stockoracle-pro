# StockOracle Pro - intraday slot-completion (gap-fill).
# Moved verbatim from backend.data.fetcher.
from .fetch_connection import *  # noqa: F401,F403

# ── Intraday slot-completion (gap-fill) ──────────────────────────────────────
# Missing minute slots render as visible whitespace gaps on the chart
# (lightweight-charts leaves time-whitespace for absent slots). Feed stalls
# (broker timeouts, missed buckets) therefore look like "broken candles".
# This fills small in-session gaps with flat carry-forward bars (volume 0)
# so every served series is slot-complete. Invariant-safe by construction:
# - only 1m/5m/15m/30m/1h (never 1s/30s/4h/1d);
# - equities: only inside 09:15–15:30 IST on weekdays, never across days,
#   never weekends/nights (those gaps must stay visible);
# - crypto (24/7): any gap within the covered range;
# - gaps larger than MAX_FILL_SLOTS are left alone (real outage, not a stall);
# - filled bars reuse the previous close (> 0) with volume 0, so OHLC and
#   positive-price invariants always hold.
FILLABLE_INTRADAY_SLOTS = {"1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600}
MAX_FILL_SLOTS = 30
_SESSION_OPEN_MIN = 9 * 60 + 15
_SESSION_CLOSE_MIN = 15 * 60 + 30


def fill_intraday_time_gaps(df: "pd.DataFrame", interval: str, is_crypto: bool = False) -> "pd.DataFrame":
    """Forward-fills small missing time slots in an intraday OHLCV frame.

    df must carry a 'date' column of 'YYYY-MM-DD HH:MM:SS' IST wall-clock
    strings plus numeric open/high/low/close/volume. Returns a new sorted,
    duplicate-free frame; input is never mutated.
    """
    try:
        if df is None or getattr(df, "empty", True):
            return df
        slot = FILLABLE_INTRADAY_SLOTS.get(str(interval).lower().strip())
        if not slot:
            return df
        work = df.sort_values("date").drop_duplicates(subset=["date"]).copy().reset_index(drop=True)
        dts = pd.to_datetime(work["date"], format="mixed", errors="coerce")
        if dts.isna().all():
            return df
        # Epoch seconds in IST wall-clock (labels are naive IST)
        epochs = np.array([
            int(x.value // 1_000_000_000) if not pd.isna(x) else -1 for x in dts
        ])
        closes = pd.to_numeric(work["close"], errors="coerce").to_numpy()
        extra_rows = []
        for i in range(1, len(work)):
            prev_e, cur_e = int(epochs[i - 1]), int(epochs[i])
            if prev_e < 0 or cur_e < 0:
                continue
            skipped = round((cur_e - prev_e) / slot) - 1
            if skipped < 1 or skipped > MAX_FILL_SLOTS:
                continue
            prev_dt = dts.iloc[i - 1]
            cur_dt = dts.iloc[i]
            if not is_crypto:
                # Equities: same weekday session only — never bridge days/nights/weekends.
                if prev_dt.weekday() >= 5 or cur_dt.weekday() >= 5:
                    continue
                if prev_dt.date() != cur_dt.date():
                    continue
                prev_min = int(prev_dt.hour) * 60 + int(prev_dt.minute)
                cur_min = int(cur_dt.hour) * 60 + int(cur_dt.minute)
                if prev_min < _SESSION_OPEN_MIN or cur_min > _SESSION_CLOSE_MIN:
                    continue
            prev_close = float(closes[i - 1]) if i - 1 < len(closes) else 0.0
            if not np.isfinite(prev_close) or prev_close <= 0:
                continue
            for k in range(1, skipped + 1):
                fill_dt = prev_dt + timedelta(seconds=slot * k)
                extra_rows.append({
                    "date": fill_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    "open": prev_close, "high": prev_close,
                    "low": prev_close, "close": prev_close, "volume": 0,
                })
        if not extra_rows:
            return df
        filled = pd.concat([work, pd.DataFrame(extra_rows)], ignore_index=True)
        filled = filled.sort_values("date").drop_duplicates(subset=["date"]).reset_index(drop=True)
        filled.attrs.update(getattr(df, "attrs", {}))
        logger.info("[slot-fill] %s filled slots", len(extra_rows))
        return filled
    except Exception as exc:
        logger.debug("fill_intraday_time_gaps skipped: %s", exc)
        return df
