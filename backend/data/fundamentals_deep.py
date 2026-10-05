"""
StockOracle Pro — Deep Financial Statements, Piotroski F-Score, Altman Z & DCF Valuation Engine v2.0
Includes:
  1. 10-Year Annual P&L, Balance Sheet, Cash Flows & Quarterly Performance
  2. Pure Dynamic CAGR Computation (3Y, 5Y, 10Y — No Hardcoded Mock Fallbacks)
  3. Piotroski F-Score (0-9) Comprehensive Quality Checklist
  4. Altman Z-Score Solvency & Distress Rating
  5. Multi-Stage DCF Intrinsic Fair Value, Benjamin Graham Number & Margin of Safety
  6. Multi-Tier Fallback: Screener.in Live $\\rightarrow$ Yahoo Finance $\\rightarrow$ DB Cache
  7. Data Freshness & Reporting Timestamps
"""


from .funddeep_fetch import *  # noqa: F401,F403
from .funddeep_fetch import (_fetch_universe_fallback, _fetch_yfinance_deep,
                             _finalize_freshness_status)
from .funddeep_helpers import *  # noqa: F401,F403
from .funddeep_helpers import (_CACHE_TTL, _RETRYABLE_STATUS, _calc_cagr,
                               _normalize_pct_field, _parse_num,
                               _screener_get, _sector_peers_from_universe)
from .funddeep_pipeline import get_deep_financials
from .funddeep_scores import *  # noqa: F401,F403
from .funddeep_scores import (_calculate_altman_z_score, _calculate_intrinsic_dcf,
                              _calculate_piotroski_f_score)
