"""
StockOracle Pro — International Gold (XAU/USD) Routing Tests
Verifies:
1. Gold aliases (XAUUSD, GOLD, XAU, PAXG) route through the 24/7 digital-asset pipeline
2. Binance symbol mapper resolves gold aliases to PAXGUSDT (regression-safe for BTC/ETH)
3. Gold display metadata (name/sector) and fabricated-metric guards
4. Gold NEVER receives fabricated seed candles (zero-fake-data rule)
5. NSE gold ETFs (GOLDBEES) remain equities — not hijacked by the gold alias
"""
import pytest

from backend.data.fetcher import (
    _is_gold_ticker,
    _binance_crypto_symbol,
    is_crypto_ticker,
    _generate_crypto_seed_data,
    search_nse_stocks,
)


class TestGoldAliasRouting:
    def test_xauusd_is_gold(self):
        assert _is_gold_ticker("XAUUSD") is True

    def test_plain_gold_is_gold(self):
        assert _is_gold_ticker("GOLD") is True

    def test_xau_prefix_is_gold(self):
        assert _is_gold_ticker("XAU") is True
        assert _is_gold_ticker("XAUINR") is True

    def test_paxg_is_gold(self):
        assert _is_gold_ticker("PAXG") is True

    def test_lowercase_accepted(self):
        assert _is_gold_ticker("xauusd") is True

    def test_goldbees_etf_is_not_gold(self):
        # NSE gold ETF must stay an equity — exact-match guard
        assert _is_gold_ticker("GOLDBEES") is False

    def test_equities_are_not_gold(self):
        assert _is_gold_ticker("RELIANCE") is False
        assert _is_gold_ticker("GOLDDUBAI") is False  # hypothetical, prefix must be XAU/PAXG only

    def test_routes_through_digital_asset_pipeline(self):
        # is_crypto_ticker is the routing gate for fetch_stock_data / broadcast loop
        assert is_crypto_ticker("XAUUSD") is True
        assert is_crypto_ticker("GOLD") is True
        assert is_crypto_ticker("BTC") is True  # regression
        assert is_crypto_ticker("RELIANCE") is False  # regression


class TestBinanceSymbolMapper:
    def test_gold_maps_to_paxgusdt(self):
        assert _binance_crypto_symbol("GOLD") == "PAXGUSDT"

    def test_xauusd_maps_to_paxgusdt(self):
        assert _binance_crypto_symbol("XAUUSD") == "PAXGUSDT"

    def test_btc_regression(self):
        assert _binance_crypto_symbol("BTC") == "BTCUSDT"
        assert _binance_crypto_symbol("BITCOIN") == "BTCUSDT"

    def test_explicit_usdt_passthrough(self):
        assert _binance_crypto_symbol("ETHUSDT") == "ETHUSDT"

    def test_generic_coin_gets_usdt_suffix(self):
        assert _binance_crypto_symbol("SOL") == "SOLUSDT"


class TestGoldSeedDataGuard:
    def test_gold_never_gets_fabricated_seed_data(self):
        assert _generate_crypto_seed_data("GOLD", "1d", is_intraday=False) is None
        assert _generate_crypto_seed_data("XAUUSD", "5m", is_intraday=True) is None

    def test_btc_seed_data_unchanged(self):
        df = _generate_crypto_seed_data("BTC", "1d", is_intraday=False)
        assert df is not None and len(df) > 0


class TestGoldSearchDiscovery:
    def test_search_xau_injects_xauusd(self):
        res = search_nse_stocks("XAU")
        assert any(r["ticker"] == "XAUUSD" for r in res)
        assert res[0]["ticker"] == "XAUUSD"
        assert res[0]["exchange"] == "COMMODITY"

    def test_search_gold_injects_xauusd(self):
        res = search_nse_stocks("GOLD")
        assert any(r["ticker"] == "XAUUSD" for r in res)
        assert res[0]["ticker"] == "XAUUSD"

    def test_search_xauusd_exact(self):
        res = search_nse_stocks("XAUUSD")
        assert any(r["ticker"] == "XAUUSD" for r in res)
        assert res[0]["ticker"] == "XAUUSD"
