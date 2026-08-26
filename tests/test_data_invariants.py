import unittest
import pandas as pd
import numpy as np
from datetime import datetime
from backend.analysis.indicators import enrich_stock_dataframe, calculate_sma, calculate_rsi
from backend.data.database import save_historical_prices, get_historical_prices, init_db

class TestDataInvariants(unittest.TestCase):
    """
    Automated regression tests to protect the core data fetcher,
    database storing, and indicator calculations against regressions.
    """

    def setUp(self):
        init_db()

    def test_short_dataframe_indicator_preservation(self):
        """Ensure enrich_stock_dataframe does not drop any price rows even with < 50 rows."""
        # Create a small 10-row dataframe (e.g. short timeframe)
        dates = pd.date_range("2026-08-01", periods=10).strftime("%Y-%m-%d")
        raw_df = pd.DataFrame({
            "date": dates,
            "open": [100.0 + i for i in range(10)],
            "high": [105.0 + i for i in range(10)],
            "low": [95.0 + i for i in range(10)],
            "close": [102.0 + i for i in range(10)],
            "volume": [1000 + i * 10 for i in range(10)],
        })

        enriched = enrich_stock_dataframe(raw_df)
        # Invariant: 0 rows should be dropped
        self.assertEqual(len(enriched), 10, "Indicators should never drop raw price rows for short dataframes!")
        self.assertIn("sma_20", enriched.columns)
        self.assertIn("rsi", enriched.columns)
        self.assertIn("bb_upper", enriched.columns)

    def test_single_row_indicator_safety(self):
        """Ensure enrich_stock_dataframe works safely on a single candle without crashing or dropping it."""
        raw_df = pd.DataFrame({
            "date": ["2026-08-15"],
            "open": [1500.0],
            "high": [1520.0],
            "low": [1490.0],
            "close": [1510.0],
            "volume": [500000],
        })
        enriched = enrich_stock_dataframe(raw_df)
        self.assertEqual(len(enriched), 1)
        self.assertEqual(enriched["close"].iloc[0], 1510.0)

    def test_database_strictly_daily_dates(self):
        """Ensure save_historical_prices only accepts YYYY-MM-DD daily records."""
        test_ticker = "INVARIANTTEST"
        mixed_df = pd.DataFrame({
            "date": ["2026-08-14", "2026-08-15 09:15:00", "2026-08-15 09:20:00", "2026-08-15"],
            "open": [100.0, 101.0, 102.0, 103.0],
            "high": [105.0, 106.0, 107.0, 108.0],
            "low": [95.0, 96.0, 97.0, 98.0],
            "close": [104.0, 105.0, 106.0, 107.0],
            "volume": [100, 200, 300, 400],
        })

        save_historical_prices(test_ticker, mixed_df)
        retrieved = get_historical_prices(test_ticker, "2026-08-01", "2026-08-31")

        self.assertIsNotNone(retrieved)
        # Each returned date string must be strictly 10 characters (YYYY-MM-DD)
        for d in retrieved["date"]:
            self.assertEqual(len(str(d)), 10, f"Database returned non-daily date: {d}")

    def test_validate_and_sanitize_candles(self):
        """Ensure OHLC sanity constraint: low <= open/close <= high and duplicate removal."""
        from backend.data.database import validate_and_sanitize_candles
        corrupt_df = pd.DataFrame([
            {"date": "2026-08-10", "open": 100.0, "high": 90.0, "low": 110.0, "close": 105.0, "volume": 1000}, # Inverted H/L
            {"date": "2026-08-11", "open": -50.0, "high": 60.0, "low": 40.0, "close": 55.0, "volume": 500},    # Negative price
            {"date": "2026-08-12", "open": 200.0, "high": 210.0, "low": 195.0, "close": 205.0, "volume": 2000},
            {"date": "2026-08-12", "open": 200.0, "high": 215.0, "low": 195.0, "close": 208.0, "volume": 2500}, # Duplicate date
        ])
        clean = validate_and_sanitize_candles(corrupt_df)
        
        # 1. Negative price row dropped
        self.assertNotIn("2026-08-11", clean["date"].values)
        # 2. Duplicate 2026-08-12 deduped to 1 row
        self.assertEqual(len(clean[clean["date"] == "2026-08-12"]), 1)
        # 3. Inverted high/low fixed
        row_10 = clean[clean["date"] == "2026-08-10"].iloc[0]
        self.assertTrue(row_10["high"] >= max(row_10["open"], row_10["close"]))
        self.assertTrue(row_10["low"] <= min(row_10["open"], row_10["close"]))


if __name__ == "__main__":
    unittest.main()
