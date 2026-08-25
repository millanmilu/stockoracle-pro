"""
StockOracle Pro — Telegram Alert Bot Service
Dispatches instant rich markdown/HTML alerts to Telegram users/channels
when Smart Alerts trigger or high-probability trade setups occur.
"""
import os
import requests
import logging

logger = logging.getLogger("StockOracle.Telegram")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID",   "").strip()


def send_telegram_alert(ticker: str, alert_type: str, reason: str, price: float = None) -> bool:
    """
    Sends an instant formatted alert to Telegram.
    Returns True if sent successfully.
    """
    token = os.getenv("TELEGRAM_BOT_TOKEN", TELEGRAM_BOT_TOKEN).strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", TELEGRAM_CHAT_ID).strip()

    if not token or not chat_id:
        logger.debug("Telegram credentials not configured. Skipping push notification.")
        return False

    emoji_map = {
        "price_above": "🚀",
        "price_below": "🔻",
        "rsi_below": "🟢",
        "rsi_above": "🔴",
        "volume_spike": "🔥",
        "pattern": "📊",
        "ai_signal": "🤖",
    }
    emoji = emoji_map.get(alert_type, "🔔")

    price_text = f"\n💰 <b>Current Price:</b> ₹{price:,.2f}" if price else ""

    text = (
        f"{emoji} <b>StockOracle Pro Alert: {ticker.upper()}</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📌 <b>Trigger:</b> <code>{alert_type.replace('_', ' ').upper()}</code>\n"
        f"📝 <b>Details:</b> {reason}"
        f"{price_text}\n"
        f"⏰ <b>Status:</b> Live Triggered\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🔗 <a href='https://main.d3qrmvw6hu9g61.amplifyapp.com'>Open StockOracle Pro</a>"
    )

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }

    try:
        resp = requests.post(url, json=payload, timeout=6)
        if resp.status_code == 200:
            logger.info(f"✅ Telegram alert sent for {ticker} ({alert_type})")
            return True
        else:
            logger.warning(f"⚠️ Telegram API returned {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Failed to dispatch Telegram alert: {e}")
        return False


def test_telegram_connection() -> dict:
    """Tests bot connectivity with the configured Telegram credentials."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", TELEGRAM_BOT_TOKEN).strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", TELEGRAM_CHAT_ID).strip()

    if not token or not chat_id:
        return {"status": "NOT_CONFIGURED", "message": "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in backend/.env"}

    success = send_telegram_alert("NIFTY", "ai_signal", "StockOracle Pro Telegram Bot connection verified successfully!", price=24366.0)
    if success:
        return {"status": "CONNECTED", "message": "Test notification sent successfully to Telegram!"}
    else:
        return {"status": "FAILED", "message": "Telegram API request failed. Check Bot Token & Chat ID."}
