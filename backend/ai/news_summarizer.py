import os
import json
import logging

logger = logging.getLogger("stockoracle.ai.news")


CANDIDATE_MODELS = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-3.6-flash",
    "gemini-2.5-pro",
    "gemini-1.5-pro",
    "gemini-pro",
]


def summarize_news(ticker: str, headlines: list) -> dict:
    """
    Uses Gemini to summarize news headlines for a given stock ticker.

    Returns:
        {
            "summary": str,       # 2-3 sentence executive summary
            "sentiment": str,     # Strongly Bullish|Bullish|Neutral|Bearish|Strongly Bearish
            "risks": list[str],   # up to 3 key risk factors
            "impact": str         # Positive|Negative|Neutral
        }
    """
    default = {
        "summary": "No recent news available for analysis.",
        "sentiment": "Neutral",
        "risks": [],
        "impact": "Neutral",
    }

    if not headlines:
        return default

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        default["summary"] = "Add GEMINI_API_KEY to backend/.env to enable AI news summaries."
        return default

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)

        headlines_text = "\n".join(f"- {h}" for h in headlines[:8])
        prompt = f"""Analyze these recent news headlines for {ticker} (NSE India):

{headlines_text}

Respond with exactly this JSON structure:
{{
  "summary": "<2-3 sentence executive summary of the news>",
  "sentiment": "<one of: Strongly Bullish, Bullish, Neutral, Bearish, Strongly Bearish>",
  "risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "impact": "<one of: Positive, Negative, Neutral>"
}}"""

        system_instruction = (
            "You are a financial news analyst specializing in Indian stock markets. "
            "Analyze the provided news headlines and respond ONLY with a valid JSON object. "
            "No markdown, no code blocks — pure JSON."
        )

        for m_name in CANDIDATE_MODELS:
            try:
                model = genai.GenerativeModel(
                    model_name=m_name,
                    system_instruction=system_instruction,
                )
                response = model.generate_content(
                    prompt,
                    generation_config={"max_output_tokens": 300, "temperature": 0.2},
                )
                text = response.text.strip()
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                result = json.loads(text)
                for key in ("summary", "sentiment", "risks", "impact"):
                    if key not in result:
                        result[key] = default[key]
                result["risks"] = result["risks"][:3]
                return result
            except Exception:
                continue

        default["summary"] = "AI news summary temporarily unavailable."
        return default
    except Exception as exc:
        logger.warning("News summarizer failed for %s: %s", ticker, exc)
        default["summary"] = "AI news summary temporarily unavailable."
        return default
