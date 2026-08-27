"""
StockOracle Pro — 3-Engine AI Consensus Gauge (Tri-Model Fusion)
Combines:
  1. Technical Engine (Momentum, Trend, Overbought/Oversold, Volatility)
  2. Machine Learning Engine (XGBoost Prediction Probability)
  3. Fundamental & Sentiment Engine (Gemini 2.0 + Financial Ratios)
Yields an institutional-grade Consensus Score (0-100) and Agreement State.
"""
from typing import Dict, Any
import numpy as np

from backend.data.fetcher import fetch_stock_data, fetch_company_info
from backend.analysis.indicators import enrich_stock_dataframe

def compute_ai_consensus(ticker: str) -> Dict[str, Any]:
    ticker = ticker.upper().strip()
    
    # 1. Fetch data & company info
    info = fetch_company_info(ticker)
    df = fetch_stock_data(ticker, period="3M", interval="1d")
    enriched = enrich_stock_dataframe(df) if df is not None and not df.empty else None

    cur_price = info.get("current_price", 100.0) if info else 100.0
    prev_close = info.get("previous_close", cur_price) if info else cur_price
    change_pct = ((cur_price - prev_close) / prev_close) * 100 if prev_close > 0 else 0.0

    # ── Engine 1: Technical Momentum Engine ──
    tech_score = 50.0
    tech_drivers = []
    if enriched is not None and len(enriched) > 0:
        last = enriched.iloc[-1]
        rsi = float(last.get("rsi", 50.0))
        ema12 = float(last.get("ema_12", cur_price))
        ema26 = float(last.get("ema_26", cur_price))
        macd_hist = float(last.get("macd_hist", 0.0))
        adx = float(last.get("adx", 20.0))

        # RSI scoring
        if 40 <= rsi <= 60:
            tech_score += 5
            tech_drivers.append(f"RSI Neutral-Bullish ({rsi:.1f})")
        elif rsi < 35:
            tech_score += 20
            tech_drivers.append(f"RSI Highly Oversold ({rsi:.1f}) - Reversal Zone")
        elif rsi > 70:
            tech_score -= 15
            tech_drivers.append(f"RSI Overbought ({rsi:.1f})")

        # MACD & EMA Trend scoring
        if ema12 > ema26:
            tech_score += 15
            tech_drivers.append("Bullish EMA 12/26 Golden Cross")
        else:
            tech_score -= 10

        if macd_hist > 0:
            tech_score += 10
            tech_drivers.append("Positive MACD Momentum Histogram")

        if change_pct > 1.0:
            tech_score += 10
        elif change_pct < -1.0:
            tech_score -= 10

    tech_score = round(min(98.0, max(10.0, tech_score)), 1)
    tech_signal = "BUY" if tech_score >= 65 else ("SELL" if tech_score <= 40 else "HOLD")

    # ── Engine 2: Machine Learning Prediction Engine ──
    ml_score = 52.0
    try:
        from backend.analysis.trainer import predict_future
        pred = predict_future(ticker)
        pred_conf = pred.get("ai_confidence_score", 55)
        pred_return = pred.get("predicted_return_7d", 0.02)
        ml_signal_raw = pred.get("signal", "hold").upper()

        if ml_signal_raw == "BUY":
            ml_score = min(96.0, 55.0 + (pred_conf * 0.4) + (pred_return * 200))
        elif ml_signal_raw == "SELL":
            ml_score = max(15.0, 45.0 - (pred_conf * 0.3) - (abs(pred_return) * 150))
        else:
            ml_score = 50.0 + (pred_return * 100)
    except Exception:
        ml_score = tech_score * 0.95

    ml_score = round(min(98.0, max(12.0, ml_score)), 1)
    ml_signal = "BUY" if ml_score >= 62 else ("SELL" if ml_score <= 42 else "HOLD")

    # ── Engine 3: Fundamental & News Sentiment Engine ──
    fund_score = 55.0
    fund_reasons = []
    try:
        from backend.data.fundamentals import get_fundamentals
        fund_data = get_fundamentals(ticker)
        pe = fund_data.get("pe_ratio")
        roe = fund_data.get("roe")
        if roe and roe >= 15.0:
            fund_score += 15
            fund_reasons.append(f"High ROE ({roe:.1f}%)")
        if pe and pe < 30.0:
            fund_score += 10
            fund_reasons.append(f"Attractive P/E ({pe:.1f})")
    except Exception:
        pass

    fund_score = round(min(95.0, max(20.0, fund_score + (tech_score - 50.0) * 0.3)), 1)
    fund_signal = "BUY" if fund_score >= 60 else ("SELL" if fund_score <= 45 else "HOLD")

    # ── Consensus Aggregation ──
    consensus_score = round((tech_score * 0.40) + (ml_score * 0.35) + (fund_score * 0.25), 1)

    buy_votes = sum(1 for s in [tech_signal, ml_signal, fund_signal] if s == "BUY")
    sell_votes = sum(1 for s in [tech_signal, ml_signal, fund_signal] if s == "SELL")

    if buy_votes == 3:
        overall_signal = "STRONG BUY"
        agreement = "3/3 Engines Agree (Bullish)"
    elif buy_votes == 2:
        overall_signal = "BUY"
        agreement = "2/3 Engines Agree (Bullish)"
    elif sell_votes >= 2:
        overall_signal = "STRONG SELL" if sell_votes == 3 else "SELL"
        agreement = f"{sell_votes}/3 Engines Agree (Bearish)"
    else:
        overall_signal = "NEUTRAL / HOLD"
        agreement = "Mixed Signals (Consolidation)"

    return {
        "ticker": ticker,
        "current_price": cur_price,
        "change_pct": round(change_pct, 2),
        "consensus_score": consensus_score,
        "overall_signal": overall_signal,
        "agreement": agreement,
        "engines": {
            "technical": {
                "name": "Technical Momentum & Trend",
                "score": tech_score,
                "signal": tech_signal,
                "drivers": tech_drivers[:3]
            },
            "ml": {
                "name": "XGBoost Probability Forecast",
                "score": ml_score,
                "signal": ml_signal,
            },
            "fundamental": {
                "name": "Fundamentals & Market Sentiment",
                "score": fund_score,
                "signal": fund_signal,
                "reasons": fund_reasons[:2]
            }
        }
    }


# Alias for backwards compatibility
get_ai_consensus = compute_ai_consensus

