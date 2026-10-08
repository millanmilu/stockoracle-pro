"""24/7 deterministic SMC monitor for Binance symbols and explicit XAUUSD."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import select

from backend.data.fetcher import fetch_stock_data
from backend.shared.config import settings
from backend.shared.database import get_db_session
from backend.shared.models import SmcAgentSetup
from backend.smc.engine import evaluate_smc_setup
from backend.services.crypto_universe import top20_usdt_symbols

DEFAULT_SYMBOLS = ()
_last_run: str | None = None
_last_error: str | None = None


def _frames(symbol: str):
    # Longer 15M history gives closed 4H/1H trend/structure enough warmup.
    return (
        fetch_stock_data(symbol, period="370D", interval="4h"),
        fetch_stock_data(symbol, period="120D", interval="1h"),
        fetch_stock_data(symbol, period="45D", interval="15m"),
    )


def _persist(setup) -> SmcAgentSetup:
    with get_db_session() as session:
        found = session.scalar(select(SmcAgentSetup).where(SmcAgentSetup.fingerprint == setup.fingerprint))
        if found:
            return found
        record = SmcAgentSetup(
            fingerprint=setup.fingerprint, ticker=setup.symbol, direction=setup.direction, status=setup.status,
            entry=setup.entry, stop_loss=setup.stop, target=setup.target, risk_reward=setup.risk_reward,
            confirmed_at=setup.confirmed_at, reason=setup.reason,
        )
        session.add(record)
        session.flush()
        return record


def _notify_if_pending(fingerprint: str, setup) -> bool:
    with get_db_session() as session:
        record = session.scalar(select(SmcAgentSetup).where(SmcAgentSetup.fingerprint == fingerprint))
        if not record or record.notified_at:
            return False
        from backend.services.telegram_bot import send_telegram_alert
        reason = (f"{setup.direction.upper()} SMC setup | Entry {setup.entry:.6g} | "
                  f"SL {setup.stop:.6g} | TP {setup.target:.6g} | RR 1:{setup.risk_reward:.1f}\n{setup.reason}")
        if not send_telegram_alert(setup.symbol, "smc_setup", reason, setup.entry):
            return False
        record.notified_at = datetime.now(timezone.utc).isoformat()
        return True


def evaluate_symbol(symbol: str) -> dict:
    four_hour, one_hour, fifteen = _frames(symbol)
    decision = evaluate_smc_setup(symbol, four_hour, one_hour, fifteen)
    payload = decision.to_dict()
    if decision.setup:
        record = _persist(decision.setup)
        payload["notification_sent"] = _notify_if_pending(record.fingerprint, decision.setup)
    else:
        payload["notification_sent"] = False
    return payload


def run_once(symbols: Iterable[str] | None = None) -> list[dict]:
    global _last_run, _last_error
    results = []
    try:
        for symbol in symbols or (*top20_usdt_symbols(), "XAUUSD"):
            try:
                results.append(evaluate_symbol(symbol))
            except Exception as exc:
                results.append({"symbol": symbol, "status": "unavailable", "reason": str(exc), "setup": None})
        _last_run, _last_error = datetime.now(timezone.utc).isoformat(), None
    except Exception as exc:
        _last_error = str(exc)
    return results


def get_status() -> dict:
    return {"enabled": settings.SMC_AGENT_ENABLED, "last_run": _last_run, "last_error": _last_error,
            "symbols": [*top20_usdt_symbols(), "XAUUSD"], "strategy": "smc_agent_v1", "uses_llm": False}


async def run_smc_agent_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(run_once)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            global _last_error
            _last_error = str(exc)
        await asyncio.sleep(max(10, settings.SMC_AGENT_POLL_SECONDS))
