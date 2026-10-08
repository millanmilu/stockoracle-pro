"""Causal SMC Pro signals and long/short intraday backtesting."""

from datetime import time
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from .backtest_analytics import (
    _compute_monthly_analytics,
    _compute_pnl_distribution,
    _run_monte_carlo,
)
from .backtest_execution import _calculate_friction

_IST = ZoneInfo("Asia/Kolkata")
_LONDON = ZoneInfo("Europe/London")
_NEW_YORK = ZoneInfo("America/New_York")


def _true_range(candles, index):
    row = candles[index]
    high, low = row["high"], row["low"]
    previous = candles[index - 1]["close"] if index else row["close"]
    return max(high - low, abs(high - previous), abs(low - previous))


def _atr(candles, end, period=14):
    start = max(0, end - period + 1)
    values = [_true_range(candles, i) for i in range(start, end + 1)]
    return float(np.mean(values)) if values else 0.0


def _aggregate_candles(candles, factor):
    aggregates = []
    for start in range(0, len(candles) - factor + 1, factor):
        group = candles[start:start + factor]
        if not all(group):
            aggregates.append(None)
            continue
        aggregates.append({
            "close": group[-1]["close"],
            "high": max(row["high"] for row in group),
            "low": min(row["low"] for row in group),
        })
    return aggregates


def _aggregate_trend(aggregates, count):
    if count < 8:
        return "neutral", 0
    grouped = [bar for bar in aggregates[max(0, count - 9):count] if bar is not None]
    if len(grouped) < 8:
        return "neutral", 0
    net = grouped[-1]["close"] - grouped[max(0, len(grouped) - 9)]["close"]
    total_range = sum(
        max(
            row["high"] - row["low"],
            abs(row["high"] - grouped[index - 1]["close"]),
            abs(row["low"] - grouped[index - 1]["close"]),
        )
        for index, row in enumerate(grouped)
        if index
    )
    if total_range <= 0:
        return "neutral", 0
    efficiency = abs(net) / total_range
    confidence = min(100, round(efficiency * 100))
    if efficiency < 0.15:
        return "neutral", confidence
    return ("bullish" if net > 0 else "bearish"), confidence


def _session(timestamp):
    if pd.isna(timestamp):
        return "unknown"
    stamp = pd.Timestamp(timestamp).to_pydatetime()
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=_IST)
    for name, zone, start, end in (
        ("london", _LONDON, time(9, 0), time(11, 59)),
        ("newYork", _NEW_YORK, time(13, 30), time(16, 0)),
        ("asian", _IST, time(0, 0), time(8, 59)),
    ):
        local_time = stamp.astimezone(zone).time().replace(tzinfo=None)
        if start <= local_time <= end:
            return name
    return "overnight"


def build_smc_setups(df):
    """Return one confirmed SMC setup per candle, without reading future bars."""
    dates = pd.to_datetime(df["date"], format="mixed", errors="coerce")
    candles = []
    for index, row in df.reset_index(drop=True).iterrows():
        values = [row.get(key) for key in ("open", "high", "low", "close")]
        if not all(np.isfinite(pd.to_numeric(value, errors="coerce")) for value in values):
            candles.append(None)
            continue
        opened, high, low, close = map(float, values)
        if min(opened, high, low, close) <= 0 or low > min(opened, close) or high < max(opened, close):
            candles.append(None)
            continue
        candles.append({
            "open": opened, "high": high, "low": low, "close": close,
            "volume": float(pd.to_numeric(row.get("volume", 0), errors="coerce") or 0),
            "date": dates.iloc[index],
        })

    setups = [None] * len(candles)
    aggregates4 = _aggregate_candles(candles, 4)
    aggregates16 = _aggregate_candles(candles, 16)
    pivots = []
    level_pivots = []
    blocks = []
    gaps = []
    consumed_pivots = set()
    recent_break = None
    recent_sweeps = []
    window = 5

    for index, candle in enumerate(candles):
        if candle is None or index < 32:
            continue
        pivot_index = index - window
        if pivot_index >= window:
            candidate = candles[pivot_index]
            surrounding = candles[pivot_index - window:index + 1]
            if candidate and all(surrounding):
                if all(candidate["high"] > other["high"] for pos, other in enumerate(surrounding) if pos != window):
                    pivots.append({"kind": "high", "price": candidate["high"], "index": pivot_index, "confirmed": index})
                if all(candidate["low"] < other["low"] for pos, other in enumerate(surrounding) if pos != window):
                    pivots.append({"kind": "low", "price": candidate["low"], "index": pivot_index, "confirmed": index})
        level_window = 3
        level_index = index - level_window
        if level_index >= level_window:
            candidate = candles[level_index]
            surrounding = candles[level_index - level_window:index + 1]
            if candidate and all(surrounding):
                if all(candidate["high"] > other["high"] for pos, other in enumerate(surrounding) if pos != level_window):
                    level_pivots.append({"kind": "high", "price": candidate["high"], "index": level_index, "confirmed": index})
                if all(candidate["low"] < other["low"] for pos, other in enumerate(surrounding) if pos != level_window):
                    level_pivots.append({"kind": "low", "price": candidate["low"], "index": level_index, "confirmed": index})

        previous = candles[index - 1]
        if previous is None:
            continue
        for pivot in pivots:
            pivot_id = (pivot["kind"], pivot["index"])
            if pivot["confirmed"] >= index or pivot_id in consumed_pivots:
                continue
            price = pivot["price"]
            crossed = (
                previous["close"] <= price < candle["close"] if pivot["kind"] == "high"
                else previous["close"] >= price > candle["close"]
            )
            if crossed:
                recent_break = {
                    "direction": "bullish" if pivot["kind"] == "high" else "bearish",
                    "index": index,
                }
                consumed_pivots.add(pivot_id)
                continue
            swept = (
                candle["high"] > price and candle["close"] <= price if pivot["kind"] == "high"
                else candle["low"] < price and candle["close"] >= price
            )
            if swept:
                recent_sweeps.append({
                    "direction": "bearish" if pivot["kind"] == "high" else "bullish",
                    "index": index,
                })
                consumed_pivots.add(pivot_id)

        atr_value = _atr(candles, index)
        # OBs are confirmed only after both displacement bars have closed.
        origin = index - 2
        if origin > 0 and all(candles[origin:index + 1]):
            source, departure, follow_through = candles[origin:index + 1]
            departure_body = abs(departure["close"] - departure["open"])
            departure_atr = _atr(candles, origin)
            if departure_atr > 0 and departure_body / departure_atr >= 0.35:
                if source["close"] < source["open"] and departure["close"] > source["high"] and follow_through["close"] > departure["close"]:
                    blocks.append({"direction": "bullish", "top": source["high"], "bottom": source["low"], "confirmed": index})
                elif source["close"] > source["open"] and departure["close"] < source["low"] and follow_through["close"] < departure["close"]:
                    blocks.append({"direction": "bearish", "top": source["high"], "bottom": source["low"], "confirmed": index})
                blocks = blocks[-100:]

        if index >= 2:
            first, middle, last = candles[index - 2:index + 1]
            min_gap = atr_value * 0.05
            if last["low"] > first["high"] and last["low"] - first["high"] >= min_gap:
                gaps.append({"direction": "bullish", "top": last["low"], "bottom": first["high"], "confirmed": index})
            elif last["high"] < first["low"] and first["low"] - last["high"] >= min_gap:
                gaps.append({"direction": "bearish", "top": first["low"], "bottom": last["high"], "confirmed": index})
            gaps = gaps[-100:]

        for zone in blocks + gaps:
            if zone["confirmed"] < index and candle["high"] >= zone["bottom"] and candle["low"] <= zone["top"]:
                zone["mitigated"] = True

        recent_sweeps = [sweep for sweep in recent_sweeps if index - sweep["index"] <= 40]
        if recent_break and index - recent_break["index"] > 40:
            recent_break = None
        if index % 10 == 0:
            pivots = [pivot for pivot in pivots if index - pivot["index"] <= 150]
            level_pivots = [pivot for pivot in level_pivots if index - pivot["index"] <= 120]
            active_pivots = {(pivot["kind"], pivot["index"]) for pivot in pivots}
            consumed_pivots.intersection_update(active_pivots)

        bias4, confidence4 = _aggregate_trend(aggregates4, (index + 1) // 4)
        bias16, confidence16 = _aggregate_trend(aggregates16, (index + 1) // 16)
        bias = bias4 if bias4 == bias16 else "neutral"
        htf_confidence = round((confidence4 + confidence16) / 2) if bias != "neutral" else 0
        if bias == "neutral":
            continue
        aligned_break = recent_break and recent_break["direction"] == bias
        aligned_sweep = any(sweep["direction"] == bias for sweep in recent_sweeps)
        avg_range = float(np.mean([
            item["high"] - item["low"] for item in candles[max(0, index - 14):index + 1] if item
        ]))
        body = abs(candle["close"] - candle["open"])
        displacement = min(1.0, body / avg_range) if avg_range > 0 and (
            candle["close"] > candle["open"] if bias == "bullish" else candle["close"] < candle["open"]
        ) else 0.0
        recent_high = max(item["high"] for item in candles[max(0, index - 119):index + 1] if item)
        recent_low = min(item["low"] for item in candles[max(0, index - 119):index + 1] if item)
        equilibrium = (recent_high + recent_low) / 2
        pd_aligned = candle["close"] < equilibrium if bias == "bullish" else candle["close"] > equilibrium
        near_range = avg_range * 3.5

        def relevant(zones):
            return any(
                zone["direction"] == bias and not zone.get("mitigated")
                and index - zone["confirmed"] <= 100
                and max(0, zone["bottom"] - candle["close"], candle["close"] - zone["top"]) <= near_range
                for zone in zones
            )

        aligned_ob = relevant(blocks)
        aligned_fvg = relevant(gaps)
        recent_displacement = any(
            abs(item['close'] - item['open']) > atr_value * 1.2
            and (item['close'] > item['open'] if bias == 'bullish' else item['close'] < item['open'])
            for item in candles[max(0, index - 9):index + 1] if item
        )
        if not (aligned_break and aligned_sweep and (aligned_fvg or aligned_ob)
                and pd_aligned and recent_displacement):
            continue
        session = _session(candle["date"])

        weights = {
            "htfAlignment": 20, "liquiditySweep": 15, "structure": 15,
            "displacement": 15, "fvg": 10, "orderBlock": 10,
            "premiumDiscount": 5, "session": 5, "volumeVolatility": 5,
        }
        components = {
            "htfAlignment": htf_confidence / 100, "liquiditySweep": float(aligned_sweep),
            "structure": float(bool(aligned_break)), "displacement": displacement,
            "fvg": float(aligned_fvg), "orderBlock": float(aligned_ob),
            "premiumDiscount": float(pd_aligned),
            "session": float(session in ("london", "newYork")),
            "volumeVolatility": 0.0,
        }
        score = sum(components[key] * weight for key, weight in weights.items()) / sum(weights.values()) * 100
        bullish = bias == "bullish"
        aligned_zones = [zone for zone in blocks + gaps if zone["direction"] == bias and not zone.get("mitigated")
                         and index - zone["confirmed"] <= 100]
        candidates = [
            min(candle["close"], zone["top"]) if bullish else max(candle["close"], zone["bottom"])
            for zone in aligned_zones
            if (candle["close"] >= zone["bottom"] if bullish else candle["close"] <= zone["top"])
        ]
        entry = (min(candidates, key=lambda price: abs(price - candle["close"])) if candidates else equilibrium)
        entry = entry if entry > 0 else candle["close"]
        structural = [
            pivot["price"] for pivot in level_pivots
            if index - pivot["index"] <= 120
            and (pivot["kind"] == "low" and pivot["price"] < entry if bullish
                 else pivot["kind"] == "high" and pivot["price"] > entry)
        ]
        buffer = max(atr_value * 0.2, entry * 0.0005)
        stop = (max(structural) - buffer if bullish else min(structural) + buffer) if structural else (
            recent_low - buffer if bullish else recent_high + buffer
        )
        risk = abs(entry - stop)
        if risk < max(entry * 0.0002, atr_value * 0.1):
            continue
        targets = [
            pivot["price"] for pivot in level_pivots
            if index - pivot["index"] <= 120
            and abs(pivot['price'] - entry) >= risk * 1.25
            and (pivot["kind"] == "high" and pivot["price"] > entry if bullish
                 else pivot["kind"] == "low" and pivot["price"] < entry)
        ]
        target = (min(targets) if bullish else max(targets)) if targets else (
            entry + risk * 1.5 if bullish else entry - risk * 1.5
        )
        if (bullish and target <= entry) or (not bullish and target >= entry):
            target = entry + risk * 1.5 if bullish else entry - risk * 1.5
        setups[index] = {
            "direction": bias, "entry": float(entry), "stop": float(stop),
            "target": float(target), "score": round(float(score), 2),
            "session": session,
        }
    return setups


def run_smc_backtest(
    df, ticker, interval="15m", initial_capital=100000.0,
    position_size_pct=100.0, train_test_split=0.70,
    max_holding_days=20, slippage_bps=10.0, commission_bps=5.0,
    run_monte_carlo_sims=True, period="120D", risk_per_trade_pct=1.0,
):
    """Run the SMC engine on causal signals and structural long/short levels."""
    supported_intervals = {"1m", "5m", "15m", "30m", "1h", "4h"}
    if interval not in supported_intervals:
        return {"error": "SMC Pro requires an intraday interval: 1m, 5m, 15m, 30m, 1h, or 4h."}
    clean = df.copy()
    clean["date"] = pd.to_datetime(clean["date"], format="mixed", errors="coerce")
    clean = clean.dropna(subset=["date", "open", "high", "low", "close"]).sort_values("date").reset_index(drop=True)
    positive = (clean[["open", "high", "low", "close"]] > 0).all(axis=1)
    consistent = (
        (clean["low"] <= clean[["open", "close"]].min(axis=1))
        & (clean["high"] >= clean[["open", "close"]].max(axis=1))
    )
    clean = clean[positive & consistent].reset_index(drop=True)
    bar_minutes = {"1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240}
    last_timestamp = pd.Timestamp(clean.iloc[-1]["date"]) if not clean.empty else None
    if last_timestamp is not None:
        if last_timestamp.tzinfo is None:
            last_timestamp = last_timestamp.tz_localize(_IST)
        interval_end = last_timestamp.tz_convert("UTC") + pd.Timedelta(minutes=bar_minutes[interval])
        if interval_end > pd.Timestamp.now(tz="UTC"):
            clean = clean.iloc[:-1].reset_index(drop=True)
    if "volume" not in clean:
        clean["volume"] = 0.0
    else:
        clean["volume"] = pd.to_numeric(clean["volume"], errors="coerce").fillna(0).clip(lower=0)
    if len(clean) < 160:
        return {"error": "SMC Pro needs at least 160 verified intraday candles for 4×/16× confluence."}
    train_test_split = min(0.85, max(0.50, float(train_test_split)))
    split = int(len(clean) * train_test_split)
    if len(clean) - split < 15:
        return {"error": "Out-of-sample period is too short for SMC Pro. Select a longer lookback."}
    clean["volume_ratio"] = clean["volume"] / clean["volume"].rolling(20, min_periods=1).mean().replace(0, 1)
    setups = build_smc_setups(clean)
    test = clean.iloc[split:].reset_index(drop=True)
    test_setups = setups[split:]

    max_holding_days = max(1, int(max_holding_days))
    position_size_pct = min(100.0, max(1.0, float(position_size_pct)))
    risk_per_trade_pct = min(5.0, max(0.1, float(risk_per_trade_pct)))
    symbol = str(ticker).upper()
    is_24_7 = (
        symbol in {"BTC", "BTC-USD", "BTCUSDT", "BITCOIN", "ETH", "ETHUSDT", "XAUUSD", "XAU", "GOLD", "PAXG"}
        or symbol.startswith(("BTC", "ETH", "PAXG"))
        or symbol.endswith("USDT")
    )
    if is_24_7:
        periods_per_year = 365 * 24 * 60 // bar_minutes[interval]
    else:
        equity_bars_per_day = {"1m": 375, "5m": 75, "15m": 25, "30m": 13, "1h": 6, "4h": 2}
        periods_per_year = 252 * equity_bars_per_day[interval]
    cash = float(initial_capital)
    side = 0
    quantity = 0.0
    entry_price = 0.0
    entry_cost = 0.0
    entry_alloc = 0.0
    entry_date = ""
    stop = target = 0.0
    held = 0
    entry_score = 0.0
    entry_session = "unknown"
    total_slippage = total_commission = 0.0
    equity = []
    journal = []
    drawdowns = []
    peak = float(initial_capital)

    def current_value(price):
        return cash + side * quantity * price

    def close_position(index, price, reason):
        nonlocal cash, side, quantity, entry_cost, total_slippage, total_commission
        row = test.iloc[index]
        gross = quantity * price
        slip, commission = _calculate_friction(gross, float(row["volume_ratio"]), slippage_bps, commission_bps)
        total_slippage += slip
        total_commission += commission
        if side > 0:
            proceeds = gross - slip - commission
            pnl = proceeds - entry_alloc
            cash += proceeds
        else:
            cover_cost = gross + slip + commission
            pnl = (entry_price - price) * quantity - entry_cost - slip - commission
            cash -= cover_cost
        pnl_pct = pnl / max(1.0, entry_alloc) * 100
        journal.append({
            "trade_id": len(journal) + 1, "entry_date": entry_date,
            "exit_date": row["date"].strftime("%Y-%m-%d %H:%M:%S"), "entry_price": round(entry_price, 4),
            "exit_price": round(price, 4), "holding_days": held, "holding_bars": held,
            "invested_capital": round(entry_alloc, 2), "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2), "exit_reason": reason,
            "result": "WIN" if pnl > 0 else "LOSS",
            "frictions_paid": round(entry_cost + slip + commission, 2),
            "direction": "LONG" if side > 0 else "SHORT",
            "setup_score": entry_score, "session": entry_session,
            "stop_price": round(stop, 4), "target_price": round(target, 4),
        })
        side, quantity, entry_cost = 0, 0.0, 0.0

    for index, row in test.iterrows():
        bar_open, high, low, close = map(float, (row["open"], row["high"], row["low"], row["close"]))
        action = "HOLD"
        if side:
            held += 1
            closing_side = side
            stop_hit = low <= stop if side > 0 else high >= stop
            target_hit = high >= target if side > 0 else low <= target
            if stop_hit or target_hit:
                # Conservative same-bar resolution: stop always wins.
                if stop_hit:
                    fill = min(stop, bar_open) if side > 0 else max(stop, bar_open)
                else:
                    fill = max(target, bar_open) if side > 0 else min(target, bar_open)
                close_position(index, fill, "Structural Stop" if stop_hit else "Structural Target")
                action = "SELL" if closing_side > 0 else "COVER"
            elif held >= max_holding_days:
                # A confirmed setup is a position lifecycle, not a candle-to-candle
                # vote.  Do not replace it merely because a newer/contrary setup
                # appeared; exit only on the configured time stop, SL/target, or
                # period end.  This mirrors the chart's setup lock and prevents
                # churn from making the backtest unrealistically loss-heavy.
                close_position(index, close, "Max Hold")
                action = "SELL" if closing_side > 0 else "COVER"

        if side == 0 and action == "HOLD" and index + split > 0:
            signal = setups[index + split - 1]
            if signal:
                direction = 1 if signal["direction"] == "bullish" else -1
                # Limit entry: require the planned price to trade, never chase
                # the next open. Better opening fills are permitted.
                fill = min(bar_open, signal['entry']) if direction > 0 else max(bar_open, signal['entry'])
                if not low <= fill <= high:
                    fill = float('nan')  # no fill; still record this bar's equity
                if (direction > 0 and signal["stop"] < fill < signal["target"]) or (
                    direction < 0 and signal["target"] < fill < signal["stop"]
                ):
                    risk_budget = cash * risk_per_trade_pct / 100
                    # Upper bounds of the friction model (liquidity + impact)
                    # on both legs; gaps can still exceed this planned budget.
                    cost_rate = (slippage_bps + commission_bps) / 10000 + 0.002
                    risk_per_unit = abs(fill - signal["stop"]) + cost_rate * (fill + signal['stop'])
                    risk_notional = (risk_budget / risk_per_unit) * fill if risk_per_unit > 0 else 0.0
                    allocation = max(0.0, min(
                        cash,
                        cash * position_size_pct / 100,
                        risk_notional,
                    ))
                    slip, commission = _calculate_friction(
                        allocation, float(row["volume_ratio"]), slippage_bps, commission_bps,
                    )
                    quantity = max(0.0, (allocation - slip - commission) / fill)
                    if quantity > 0:
                        side = direction
                        entry_price = fill
                        entry_alloc = allocation
                        entry_cost = slip + commission
                        total_slippage += slip
                        total_commission += commission
                        stop, target = signal["stop"], signal["target"]
                        entry_score = signal["score"]
                        entry_session = signal["session"]
                        entry_date = row["date"].strftime("%Y-%m-%d %H:%M:%S")
                        held = 0
                        if side > 0:
                            cash -= allocation
                            action = "BUY"
                        else:
                            cash += quantity * fill - slip - commission
                            action = "SELL"
                        stop_hit = low <= stop if side > 0 else high >= stop
                        target_hit = high >= target if side > 0 else low <= target
                        if stop_hit or target_hit:
                            closing_side = side
                            if stop_hit:
                                exit_fill = min(stop, bar_open) if side > 0 else max(stop, bar_open)
                            else:
                                exit_fill = max(target, bar_open) if side > 0 else min(target, bar_open)
                            close_position(
                                index, exit_fill,
                                "Structural Stop" if stop_hit else "Structural Target",
                            )
                            action = "SELL" if closing_side > 0 else "COVER"

        value = current_value(close)
        peak = max(peak, value)
        pct_change = (value - initial_capital) / initial_capital * 100
        date_text = row["date"].strftime("%Y-%m-%d %H:%M:%S")
        equity.append({
            "date": date_text, "value": round(value, 2), "pct_change": round(pct_change, 2),
            "action": action, "price": round(close, 4), "cash": round(cash, 2),
            "invested": round(side * quantity * close, 2),
        })
        drawdowns.append({"date": date_text, "drawdown_pct": round((value - peak) / max(peak, 1) * 100, 2)})

    if side:
        closing_side = side
        close_position(len(test) - 1, float(test.iloc[-1]["close"]), "Period End")
        equity[-1]["value"] = round(cash, 2)
        equity[-1]["pct_change"] = round((cash - initial_capital) / initial_capital * 100, 2)
        equity[-1]["cash"] = round(cash, 2)
        equity[-1]["invested"] = 0.0
        equity[-1]["action"] = "SELL" if closing_side > 0 else "COVER"
        peak = max(peak, cash)
        drawdowns[-1]["drawdown_pct"] = round((cash - peak) / max(peak, 1) * 100, 2)

    values = np.array([item["value"] for item in equity], dtype=float)
    closes = test["close"].to_numpy(dtype=float)
    rets = pd.Series(values).pct_change().fillna(0)
    benchmark_rets = pd.Series(closes).pct_change().fillna(0)
    result = cash
    cum_return = (result - initial_capital) / initial_capital
    benchmark_return = (closes[-1] - closes[0]) / closes[0]
    years = len(values) / periods_per_year
    cagr = (result / initial_capital) ** (1 / max(years, 1 / periods_per_year)) - 1 if result > 0 else -1.0
    std = float(rets.std())
    rf_period = 0.065 / periods_per_year
    sharpe = float((rets.mean() - rf_period) / (std + 1e-9) * np.sqrt(periods_per_year)) if std > 0 else 0.0
    downside = rets[rets < rf_period]
    sortino = float((rets.mean() - rf_period) / (float(downside.std()) + 1e-9) * np.sqrt(periods_per_year)) if len(downside) > 1 else 0.0
    dd = (values - np.maximum.accumulate(values)) / np.maximum.accumulate(values)
    max_dd = float(np.min(dd))
    wins = [trade for trade in journal if trade["pnl"] > 0]
    losses = [trade for trade in journal if trade["pnl"] <= 0]
    win_streak = loss_streak = max_win_streak = max_loss_streak = 0
    for trade in journal:
        if trade["pnl"] > 0:
            win_streak += 1
            loss_streak = 0
            max_win_streak = max(max_win_streak, win_streak)
        else:
            loss_streak += 1
            win_streak = 0
            max_loss_streak = max(max_loss_streak, loss_streak)
    gross_profit = sum(trade["pnl"] for trade in wins)
    gross_loss = abs(sum(trade["pnl"] for trade in losses))
    monthly_returns, monthly_matrix = _compute_monthly_analytics(equity)
    covariance = np.cov(rets.values, benchmark_rets.values) if len(rets) > 1 else np.zeros((2, 2))
    beta = float(covariance[0, 1] / (np.var(benchmark_rets.values) + 1e-9)) if len(rets) > 1 else 0.0
    return {
        "ticker": str(ticker).upper(), "strategy": "smc_pro", "strategy_label": "SMC Pro (MTF + Structure)",
        "is_custom": False, "custom_description": "Causal SMC Pro confluence, structural stops/targets, long and short trades.",
        "interval": interval, "period": period,
        "initial_capital": initial_capital, "final_value": round(result, 2),
        "out_of_sample_start": clean.iloc[split - 1]["date"].strftime("%Y-%m-%d %H:%M:%S"), "backtest_days": len(test),
        "train_test_split_pct": round(train_test_split * 100, 0), "cumulative_return": round(cum_return, 4),
        "benchmark_return": round(float(benchmark_return), 4), "cagr": round(float(cagr), 4),
        "alpha": round(float(cum_return - benchmark_return), 4), "beta": round(beta, 2),
        "sharpe_ratio": round(sharpe, 3), "sortino_ratio": round(sortino, 3),
        "calmar_ratio": round(float(cagr / abs(max_dd)), 3) if abs(max_dd) > 1e-9 else 0,
        "max_drawdown": round(max_dd, 4), "recovery_factor": round(float(cum_return / abs(max_dd)), 3) if abs(max_dd) > 1e-9 else 0,
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss else round(gross_profit, 2),
        "total_trades": len(journal), "win_rate": round(len(wins) / max(1, len(journal)), 4),
        "winning_trades": len(wins), "losing_trades": len(losses),
        "payoff_ratio": round(float(np.mean([t["pnl_pct"] for t in wins]) / max(0.01, abs(np.mean([t["pnl_pct"] for t in losses])))), 2) if wins and losses else 0,
        "expectancy_pct": round(float(np.mean([t["pnl_pct"] for t in journal])), 2) if journal else 0,
        "expectancy_val": round(float(np.mean([t["pnl"] for t in journal])), 2) if journal else 0,
        "avg_holding_days": round(float(np.mean([t["holding_days"] for t in journal])), 1) if journal else 0,
        "avg_win_pct": round(float(np.mean([t["pnl_pct"] for t in wins])), 2) if wins else 0,
        "avg_loss_pct": round(float(np.mean([t["pnl_pct"] for t in losses])), 2) if losses else 0,
        "best_trade_pct": max((t["pnl_pct"] for t in journal), default=0),
        "worst_trade_pct": min((t["pnl_pct"] for t in journal), default=0),
        "max_consecutive_wins": max_win_streak, "max_consecutive_losses": max_loss_streak,
        "gross_profit": round(gross_profit, 2), "gross_loss": round(gross_loss, 2),
        "total_slippage_paid": round(total_slippage, 2), "total_commissions_paid": round(total_commission, 2),
        "total_frictions_paid": round(total_slippage + total_commission, 2),
        "equity_curve": equity, "drawdown_curve": drawdowns, "trade_journal": journal,
        "benchmark_curve": [
            {"date": equity[i]["date"], "value": round(initial_capital * closes[i] / closes[0], 2),
             "pct_change": round((closes[i] / closes[0] - 1) * 100, 2)}
            for i in range(len(closes))
        ],
        "monthly_returns": monthly_returns, "monthly_matrix": monthly_matrix,
        "trade_pnl_distribution": _compute_pnl_distribution(journal),
        "monte_carlo": _run_monte_carlo(
            rets, initial_capital=initial_capital, periods_per_year=periods_per_year,
        ) if run_monte_carlo_sims else {},
        "strategy_params": {
            "strategy": "smc_pro", "interval": interval, "period": period,
            "position_size_pct": position_size_pct,
            "risk_per_trade_pct": risk_per_trade_pct,
            "train_test_split_pct": round(train_test_split * 100, 1),
            "max_holding_bars": max_holding_days, "slippage_bps": slippage_bps,
            "commission_bps": commission_bps, "risk_model": "structural swing stop / opposing swing target",
        },
    }
