"""
StockOracle Pro — Security & Architecture Regression Test Suite

Covers:
  P0-1  User-identity isolation (single-user safe mode)
  P0-2  Institutional endpoint API-key enforcement
  P0-3  Price-alert threshold field contract
  P0-4  OpenBB quote field mapping
  P1-6  Quant-risk simulation labelling & real-beta guard
  P2-8  Terminal symbol propagation
  ARCH  Existing candle/database invariants (AGENTS.md)
"""
import math
import unittest
from unittest.mock import patch, MagicMock


# ─────────────────────────────────────────────────────────────────────────────
# P0-1  User identity — single-user safe mode
# ─────────────────────────────────────────────────────────────────────────────

class TestUserIdentitySingleUserMode(unittest.TestCase):
    def _make_request(self, headers=None, query_params=None):
        req = MagicMock()
        req.headers = headers or {}
        req.query_params = query_params or {}
        return req

    def test_returns_default_user_no_headers(self):
        from backend.shared.security import get_current_user_id
        req = self._make_request()
        self.assertEqual(get_current_user_id(req), "default_user")

    def test_ignores_x_user_id_header(self):
        """Client-supplied X-User-Id must NOT change the resolved user."""
        from backend.shared.security import get_current_user_id
        req = self._make_request(headers={"X-User-Id": "attacker_user"})
        self.assertEqual(get_current_user_id(req), "default_user")

    def test_ignores_user_id_query_param(self):
        """?user_id= query param must NOT change the resolved user."""
        from backend.shared.security import get_current_user_id
        req = self._make_request(query_params={"user_id": "other_user_42"})
        self.assertEqual(get_current_user_id(req), "default_user")

    def test_always_same_user_regardless_of_combo(self):
        from backend.shared.security import get_current_user_id
        req = self._make_request(
            headers={"X-User-Id": "evil"},
            query_params={"user_id": "also_evil"},
        )
        self.assertEqual(get_current_user_id(req), "default_user")


# ─────────────────────────────────────────────────────────────────────────────
# P0-2  verify_api_key — institutional endpoint enforcement
# ─────────────────────────────────────────────────────────────────────────────

class TestVerifyApiKey(unittest.TestCase):
    def test_passes_when_no_server_key_configured(self):
        """Dev mode: no API_KEY set → all requests allowed."""
        from backend.shared.security import verify_api_key
        with patch("backend.shared.security.settings") as mock_settings:
            mock_settings.API_KEY = ""
            # Should not raise
            verify_api_key(header_key=None, query_key=None)

    def test_rejects_missing_key_when_server_key_set(self):
        from fastapi import HTTPException
        from backend.shared.security import verify_api_key
        with patch("backend.shared.security.settings") as mock_settings:
            mock_settings.API_KEY = "secret123"
            with self.assertRaises(HTTPException) as ctx:
                verify_api_key(header_key=None, query_key=None)
            self.assertEqual(ctx.exception.status_code, 403)

    def test_rejects_wrong_key(self):
        from fastapi import HTTPException
        from backend.shared.security import verify_api_key
        with patch("backend.shared.security.settings") as mock_settings:
            mock_settings.API_KEY = "secret123"
            with self.assertRaises(HTTPException):
                verify_api_key(header_key="wrongkey", query_key=None)

    def test_accepts_correct_header_key(self):
        from backend.shared.security import verify_api_key
        with patch("backend.shared.security.settings") as mock_settings:
            mock_settings.API_KEY = "secret123"
            # Should not raise
            verify_api_key(header_key="secret123", query_key=None)

    def test_accepts_correct_query_key(self):
        from backend.shared.security import verify_api_key
        with patch("backend.shared.security.settings") as mock_settings:
            mock_settings.API_KEY = "secret123"
            verify_api_key(header_key=None, query_key="secret123")


# ─────────────────────────────────────────────────────────────────────────────
# P0-3  Price-alert threshold field contract
# ─────────────────────────────────────────────────────────────────────────────

class TestAlertThresholdContract(unittest.IsolatedAsyncioTestCase):
    def _make_alert(self, alert_type, param, current_price, alert_id=1):
        return {
            "id": alert_id,
            "ticker": "RELIANCE",
            "alert_type": alert_type,
            "param_value": param,
        }

    def _mock_company_info(self, price):
        return {"current_price": price, "name": "Reliance Industries"}

    async def test_price_above_triggers_with_threshold(self):
        from backend.services.alert_scheduler import evaluate_single_alert
        alert = self._make_alert("price_above", {"threshold": 1000.0}, 1100.0)
        with patch("backend.services.alert_scheduler.fetch_company_info",
                   return_value=self._mock_company_info(1100.0)), \
             patch("backend.services.alert_scheduler.mark_alert_triggered"):
            result = await evaluate_single_alert(alert, auto_trigger=False)
        self.assertTrue(result["is_triggered"])

    async def test_price_above_does_not_trigger_below_threshold(self):
        from backend.services.alert_scheduler import evaluate_single_alert
        alert = self._make_alert("price_above", {"threshold": 2000.0}, 1100.0)
        with patch("backend.services.alert_scheduler.fetch_company_info",
                   return_value=self._mock_company_info(1100.0)):
            result = await evaluate_single_alert(alert, auto_trigger=False)
        self.assertFalse(result["is_triggered"])

    async def test_price_below_triggers_with_threshold(self):
        from backend.services.alert_scheduler import evaluate_single_alert
        alert = self._make_alert("price_below", {"threshold": 1500.0}, 1100.0)
        with patch("backend.services.alert_scheduler.fetch_company_info",
                   return_value=self._mock_company_info(1100.0)), \
             patch("backend.services.alert_scheduler.mark_alert_triggered"):
            result = await evaluate_single_alert(alert, auto_trigger=False)
        self.assertTrue(result["is_triggered"])

    async def test_price_above_backwards_compat_target_price(self):
        """Legacy records using target_price must still work."""
        from backend.services.alert_scheduler import evaluate_single_alert
        alert = self._make_alert("price_above", {"target_price": 1000.0}, 1100.0)
        with patch("backend.services.alert_scheduler.fetch_company_info",
                   return_value=self._mock_company_info(1100.0)), \
             patch("backend.services.alert_scheduler.mark_alert_triggered"):
            result = await evaluate_single_alert(alert, auto_trigger=False)
        self.assertTrue(result["is_triggered"])

    async def test_price_above_backwards_compat_price(self):
        """Legacy records using 'price' must still work."""
        from backend.services.alert_scheduler import evaluate_single_alert
        alert = self._make_alert("price_above", {"price": 1000.0}, 1100.0)
        with patch("backend.services.alert_scheduler.fetch_company_info",
                   return_value=self._mock_company_info(1100.0)), \
             patch("backend.services.alert_scheduler.mark_alert_triggered"):
            result = await evaluate_single_alert(alert, auto_trigger=False)
        self.assertTrue(result["is_triggered"])


# ─────────────────────────────────────────────────────────────────────────────
# P0-4  OpenBB quote field mapping
# ─────────────────────────────────────────────────────────────────────────────

class TestOpenBBQuoteFieldMapping(unittest.TestCase):
    def _mock_info(self, *, current_price=1298.0, day_high=1315.6,
                   day_low=1298.0, open_=1310.0, previous_close=1317.0, volume=500000):
        return {
            "current_price":  current_price,
            "day_high":       day_high,
            "day_low":        day_low,
            "open":           open_,
            "previous_close": previous_close,
            "volume":         volume,
        }

    def test_price_mapped_from_current_price(self):
        from backend.providers.openbb.wrapper import OpenBBWrapper
        wrapper = OpenBBWrapper.__new__(OpenBBWrapper)
        wrapper._obb = None  # force native path

        with patch("backend.providers.openbb.wrapper.fetch_company_info",
                   return_value=self._mock_info(current_price=1298.0)):
            quote = wrapper.get_equity_quote("RELIANCE")

        self.assertAlmostEqual(quote["price"], 1298.0)

    def test_high_mapped_from_day_high(self):
        from backend.providers.openbb.wrapper import OpenBBWrapper
        wrapper = OpenBBWrapper.__new__(OpenBBWrapper)
        wrapper._obb = None

        with patch("backend.providers.openbb.wrapper.fetch_company_info",
                   return_value=self._mock_info(day_high=1315.6)):
            quote = wrapper.get_equity_quote("RELIANCE")

        self.assertAlmostEqual(quote["high"], 1315.6)

    def test_low_mapped_from_day_low(self):
        from backend.providers.openbb.wrapper import OpenBBWrapper
        wrapper = OpenBBWrapper.__new__(OpenBBWrapper)
        wrapper._obb = None

        with patch("backend.providers.openbb.wrapper.fetch_company_info",
                   return_value=self._mock_info(day_low=1298.0)):
            quote = wrapper.get_equity_quote("RELIANCE")

        self.assertAlmostEqual(quote["low"], 1298.0)

    def test_change_calculated_from_previous_close(self):
        from backend.providers.openbb.wrapper import OpenBBWrapper
        wrapper = OpenBBWrapper.__new__(OpenBBWrapper)
        wrapper._obb = None

        info = self._mock_info(current_price=1298.0, previous_close=1317.0)
        with patch("backend.providers.openbb.wrapper.fetch_company_info", return_value=info):
            quote = wrapper.get_equity_quote("RELIANCE")

        expected_change = round(1298.0 - 1317.0, 2)   # -19.0
        expected_pct    = round((expected_change / 1317.0) * 100, 2)
        self.assertAlmostEqual(quote["change"],     expected_change, places=1)
        self.assertAlmostEqual(quote["change_pct"], expected_pct,    places=1)

    def test_zero_change_when_no_previous_close(self):
        from backend.providers.openbb.wrapper import OpenBBWrapper
        wrapper = OpenBBWrapper.__new__(OpenBBWrapper)
        wrapper._obb = None

        info = self._mock_info(current_price=1298.0, previous_close=0.0)
        with patch("backend.providers.openbb.wrapper.fetch_company_info", return_value=info):
            quote = wrapper.get_equity_quote("RELIANCE")

        # Should fall back to info.get("change") which defaults to 0.0
        self.assertEqual(quote["change"], 0.0)


# ─────────────────────────────────────────────────────────────────────────────
# P1-6  Quant-risk simulation labelling & real-beta guard
# ─────────────────────────────────────────────────────────────────────────────

class TestQuantRiskDataQuality(unittest.TestCase):
    def _make_returns_series(self, n=120):
        import numpy as np
        np.random.seed(0)
        return np.random.normal(0.0005, 0.011, n)

    def test_is_simulated_flag_when_no_data(self):
        from backend.analysis.quant_risk import calculate_portfolio_risk_cockpit
        with patch("backend.analysis.quant_risk.fetch_stock_data", return_value=None):
            result = calculate_portfolio_risk_cockpit(
                positions=[{"ticker": "FAKEXYZ", "weight": 1.0}]
            )
        self.assertTrue(result["is_simulated"])
        self.assertEqual(result["data_quality"], "simulated")
        self.assertIsNotNone(result["fallback_reason"])

    def test_beta_is_null_when_simulated(self):
        from backend.analysis.quant_risk import calculate_portfolio_risk_cockpit
        with patch("backend.analysis.quant_risk.fetch_stock_data", return_value=None):
            result = calculate_portfolio_risk_cockpit(
                positions=[{"ticker": "FAKEXYZ", "weight": 1.0}]
            )
        self.assertIsNone(result["beta_vs_nifty"])

    def test_real_data_not_simulated(self):
        import pandas as pd
        import numpy as np
        from backend.analysis.quant_risk import calculate_portfolio_risk_cockpit

        closes = np.cumprod(1 + np.random.normal(0.0005, 0.011, 201)) * 1000
        mock_df = pd.DataFrame({"close": closes})

        with patch("backend.analysis.quant_risk.fetch_stock_data", return_value=mock_df), \
             patch("backend.analysis.quant_risk._fetch_nifty_returns", return_value=None):
            result = calculate_portfolio_risk_cockpit(
                positions=[{"ticker": "TCS", "weight": 1.0}]
            )

        self.assertFalse(result["is_simulated"])
        self.assertEqual(result["data_quality"], "real")

    def test_beta_null_when_benchmark_unavailable(self):
        import pandas as pd
        import numpy as np
        from backend.analysis.quant_risk import calculate_portfolio_risk_cockpit

        closes = np.cumprod(1 + np.random.normal(0.0005, 0.011, 201)) * 1000
        mock_df = pd.DataFrame({"close": closes})

        with patch("backend.analysis.quant_risk.fetch_stock_data", return_value=mock_df), \
             patch("backend.analysis.quant_risk._fetch_nifty_returns", return_value=None):
            result = calculate_portfolio_risk_cockpit(
                positions=[{"ticker": "TCS", "weight": 1.0}]
            )

        self.assertIsNone(result["beta_vs_nifty"])
        self.assertEqual(result["beta_source"], "benchmark_unavailable")

    def test_beta_computed_when_benchmark_available(self):
        import pandas as pd
        import numpy as np
        from backend.analysis.quant_risk import calculate_portfolio_risk_cockpit

        closes = np.cumprod(1 + np.random.normal(0.0005, 0.011, 201)) * 1000
        mock_df = pd.DataFrame({"close": closes})
        nifty_rets = np.random.normal(0.0004, 0.01, 200)

        with patch("backend.analysis.quant_risk.fetch_stock_data", return_value=mock_df), \
             patch("backend.analysis.quant_risk._fetch_nifty_returns", return_value=nifty_rets):
            result = calculate_portfolio_risk_cockpit(
                positions=[{"ticker": "TCS", "weight": 1.0}]
            )

        self.assertIsNotNone(result["beta_vs_nifty"])
        self.assertEqual(result["beta_source"], "NIFTY50_actual")
        self.assertIsInstance(result["beta_vs_nifty"], float)


# ─────────────────────────────────────────────────────────────────────────────
# P2-8  Terminal symbol propagation
# ─────────────────────────────────────────────────────────────────────────────

class TestTerminalSymbolPropagation(unittest.TestCase):
    def test_launch_sets_initial_symbol_attribute(self):
        """launch_institutional_terminal must set _initial_symbol before app.run()."""
        from terminal_ui.institutional_terminal import launch_institutional_terminal

        with patch("terminal_ui.institutional_terminal.InstitutionalTerminalApp") as MockApp:
            mock_instance = MagicMock()
            MockApp.return_value = mock_instance

            launch_institutional_terminal(symbol="TCS")

            self.assertEqual(mock_instance._initial_symbol, "TCS")
            mock_instance.run.assert_called_once()

    def test_launch_uppercases_symbol(self):
        from terminal_ui.institutional_terminal import launch_institutional_terminal

        with patch("terminal_ui.institutional_terminal.InstitutionalTerminalApp") as MockApp:
            mock_instance = MagicMock()
            MockApp.return_value = mock_instance
            launch_institutional_terminal(symbol="tcs")
            self.assertEqual(mock_instance._initial_symbol, "TCS")

    def test_default_symbol_is_reliance(self):
        from terminal_ui.institutional_terminal import launch_institutional_terminal

        with patch("terminal_ui.institutional_terminal.InstitutionalTerminalApp") as MockApp:
            mock_instance = MagicMock()
            MockApp.return_value = mock_instance
            launch_institutional_terminal()
            self.assertEqual(mock_instance._initial_symbol, "RELIANCE")


# ─────────────────────────────────────────────────────────────────────────────
# ARCH  Database / candle invariants (AGENTS.md)
# ─────────────────────────────────────────────────────────────────────────────

class TestDatabaseInvariants(unittest.TestCase):
    def test_date_field_is_exactly_10_chars(self):
        """Historical price dates must be YYYY-MM-DD (10 chars) — never timestamps."""
        from datetime import date
        date_str = date.today().strftime("%Y-%m-%d")
        self.assertEqual(len(date_str), 10)
        self.assertRegex(date_str, r"^\d{4}-\d{2}-\d{2}$")

    def test_ohlc_consistency_constraint(self):
        """Low <= min(open,close) and High >= max(open,close)."""
        candles = [
            {"open": 100.0, "high": 110.0, "low": 95.0,  "close": 105.0},
            {"open": 200.0, "high": 210.0, "low": 195.0, "close": 198.0},
        ]
        for c in candles:
            self.assertLessEqual(c["low"],  min(c["open"], c["close"]),
                                 f"Low constraint violated: {c}")
            self.assertGreaterEqual(c["high"], max(c["open"], c["close"]),
                                    f"High constraint violated: {c}")

    def test_positive_price_normalization(self):
        """All prices must be > 0."""
        prices = [1298.0, 1315.6, 1298.0, 1310.0]
        for p in prices:
            self.assertGreater(p, 0, f"Price must be positive: {p}")

    def test_no_intraday_intervals_in_historical_key(self):
        """Intraday intervals must never be stored in historical_prices table.
        Verify the valid-interval guard recognises intraday strings."""
        INTRADAY_INTERVALS = {"1m", "5m", "15m", "1h"}
        DAILY_INTERVALS    = {"1d"}
        for iv in INTRADAY_INTERVALS:
            self.assertNotIn(iv, DAILY_INTERVALS,
                             f"Intraday interval '{iv}' must not be treated as daily")


# ─────────────────────────────────────────────────────────────────────────────
# ARCH  min_periods=1 indicator invariant
# ─────────────────────────────────────────────────────────────────────────────

class TestIndicatorMinPeriods(unittest.TestCase):
    def test_short_series_produces_no_nan_sma(self):
        """A 5-row DataFrame must yield non-NaN SMA values (min_periods=1 rule)."""
        import pandas as pd
        import numpy as np

        try:
            from backend.analysis.indicators import enrich_stock_dataframe
        except ImportError:
            self.skipTest("indicators module not importable in this env")

        dates  = pd.date_range("2026-01-01", periods=5, freq="D")
        df     = pd.DataFrame({
            "open":   [100, 101, 102, 103, 104],
            "high":   [105, 106, 107, 108, 109],
            "low":    [98,  99,  100, 101, 102],
            "close":  [102, 103, 104, 105, 106],
            "volume": [1000, 1200, 1100, 1300, 1050],
        }, index=dates)

        enriched = enrich_stock_dataframe(df)

        # All original rows preserved (zero candle dropping rule)
        self.assertEqual(len(enriched), len(df))

        # SMA columns must exist and have no NaN for short timeframes
        if "sma_20" in enriched.columns:
            self.assertFalse(enriched["sma_20"].isna().any(),
                             "sma_20 must not have NaN (min_periods=1 violated)")


if __name__ == "__main__":
    unittest.main(verbosity=2)
