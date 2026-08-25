import os
import logging

logger = logging.getLogger("stockoracle.ai")

# ── Gemini context builder ────────────────────────────────────────────────────

def build_stock_context(
    ticker: str,
    enriched_df,
    prediction_data: dict = None,
    patterns: dict = None,
    levels: dict = None,
    news_items: list = None,
) -> str:
    """
    Assembles all available stock data into a structured context string for Gemini.
    """
    lines = [f"=== STOCK CONTEXT: {ticker} (NSE India) ==="]

    # ── Price & Technical Indicators from last row ───────────────────────────
    if enriched_df is not None and len(enriched_df) > 0:
        row = enriched_df.iloc[-1]
        close = float(row.get("close", 0))
        lines.append(f"\n--- Current Price & Indicators ---")
        lines.append(f"Current Price: ₹{close:.2f}")
        if "rsi" in row: lines.append(f"RSI (14): {float(row['rsi']):.1f} {'[OVERBOUGHT >70]' if float(row['rsi']) > 70 else '[OVERSOLD <30]' if float(row['rsi']) < 30 else '[NEUTRAL]'}")
        if "macd" in row: lines.append(f"MACD: {float(row['macd']):.4f} | Signal: {float(row.get('macd_signal', 0)):.4f} | Hist: {float(row.get('macd_hist', 0)):.4f}")
        if "sma_20" in row: lines.append(f"SMA-20: ₹{float(row['sma_20']):.2f} | SMA-50: ₹{float(row.get('sma_50', 0)):.2f} | EMA-20: ₹{float(row.get('ema_20', 0)):.2f}")
        if "bb_upper" in row: lines.append(f"Bollinger Bands: Upper ₹{float(row['bb_upper']):.2f} | Lower ₹{float(row.get('bb_lower', 0)):.2f} | %B: {float(row.get('bb_pct_b', 0.5)):.2f}")
        if "adx" in row: lines.append(f"ADX: {float(row['adx']):.1f} {'[STRONG TREND]' if float(row['adx']) > 25 else '[WEAK TREND]'}")
        if "atr" in row: lines.append(f"ATR (14): ₹{float(row['atr']):.2f} | Volatility: {float(row.get('volatility', 0))*100:.2f}%")
        # Price vs moving averages — trend context
        if "sma_50" in row and close > 0:
            trend = "ABOVE" if close > float(row['sma_50']) else "BELOW"
            lines.append(f"Price vs SMA-50: {trend} ({((close/float(row['sma_50']))-1)*100:+.2f}%)")

    # ── AI Prediction ────────────────────────────────────────────────────────
    if prediction_data:
        lines.append(f"\n--- AI Prediction (7-day) ---")
        lines.append(f"Signal: {str(prediction_data.get('signal', 'N/A')).upper()}")
        lines.append(f"Predicted Price: ₹{prediction_data.get('predicted_price', 'N/A')}")
        lines.append(f"Predicted Return: {float(prediction_data.get('predicted_return_7d', 0))*100:+.2f}%")
        lines.append(f"Confidence Range: ₹{prediction_data.get('low_bound', 'N/A')} – ₹{prediction_data.get('high_bound', 'N/A')}")
        lines.append(f"AI Confidence Score: {prediction_data.get('ai_confidence_score', 'N/A')}/100")

    # ── Chart Patterns ───────────────────────────────────────────────────────
    if patterns:
        recent = patterns.get("recent_patterns", [])
        if recent:
            lines.append(f"\n--- Recent Chart Patterns ---")
            for p in recent[:5]:
                lines.append(f"  - {p.get('pattern', '')} on {p.get('date', '')}: {p.get('interpretation', '')}")

    # ── Support / Resistance ─────────────────────────────────────────────────
    if levels:
        lines.append(f"\n--- Support & Resistance Levels ---")
        supports = levels.get("support_levels", [])
        resistances = levels.get("resistance_levels", [])
        pivots = levels.get("pivot_points", {})
        if supports: lines.append(f"Support: {', '.join([f'₹{s:.2f}' for s in supports[:3]])}")
        if resistances: lines.append(f"Resistance: {', '.join([f'₹{r:.2f}' for r in resistances[:3]])}")
        if pivots:
            lines.append(f"Pivot: ₹{pivots.get('pivot', 0):.2f} | R1: ₹{pivots.get('R1', 0):.2f} | S1: ₹{pivots.get('S1', 0):.2f}")

    # ── News Headlines ───────────────────────────────────────────────────────
    if news_items:
        lines.append(f"\n--- Recent News Headlines (last {len(news_items[:5])}) ---")
        for item in news_items[:5]:
            lines.append(f"  • {item.get('title', '')} [{item.get('source', '')}]")

    lines.append("\n=== END OF CONTEXT ===")
    return "\n".join(lines)


# ── Gemini API call ───────────────────────────────────────────────────────────

def ask_gemini(question: str, context: str) -> str:
    """
    Sends a question + stock context to Gemini and returns the answer string.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return (
            "Gemini API key not configured. "
            "Add GEMINI_API_KEY to backend/.env — get a free key at "
            "https://aistudio.google.com/app/apikey"
        )
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=(
                "You are StockOracle AI, an expert NSE India stock analyst. "
                "Answer questions based ONLY on the provided stock data context. "
                "Be concise, specific, and data-driven. Keep answers under 200 words. "
                "Use ₹ for prices. Always mention key risks."
            ),
        )
        prompt = f"{context}\n\n--- User Question ---\n{question}"
        response = model.generate_content(
            prompt,
            generation_config={"max_output_tokens": 512, "temperature": 0.3},
        )
        return response.text.strip()
    except Exception as exc:
        logger.warning("Gemini API call failed: %s", exc)
        return f"AI temporarily unavailable: {exc}"
