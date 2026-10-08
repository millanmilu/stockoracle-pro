"""Contracts shared by live monitoring and chronological backtests."""

from dataclasses import asdict, dataclass
from typing import Literal, Optional

Direction = Literal["bullish", "bearish"]


@dataclass(frozen=True)
class SmcSetup:
    symbol: str
    direction: Direction
    entry: float
    stop: float
    target: float
    risk_reward: float
    status: Literal["confirmed"]
    confirmed_at: str
    fingerprint: str
    reason: str
    source: str = "smc_agent_v1"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class AgentDecision:
    symbol: str
    status: Literal["confirmed", "no_setup", "unavailable"]
    reason: str
    setup: Optional[SmcSetup] = None

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "status": self.status,
            "reason": self.reason,
            "setup": self.setup.to_dict() if self.setup else None,
        }
