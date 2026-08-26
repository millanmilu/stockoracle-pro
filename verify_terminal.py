#!/usr/bin/env python3
"""
StockOracle Pro — Full Integration Verification Script
Run this on EC2: python /var/www/stockoracle/verify_terminal.py
"""
import sys
import asyncio

errors = []
passes = []

# ─── 1. chart_widget imports ───
try:
    from terminal_ui.chart_widget import render_ascii_candlestick_chart, render_ascii_volume_profile
    passes.append("chart_widget: imports OK")
except Exception as e:
    errors.append(f"chart_widget import FAILED: {e}")

# ─── 2. terminal_service imports ───
try:
    from backend.providers.openbb.terminal_service import get_terminal_data_service
    passes.append("terminal_service: imports OK")
except Exception as e:
    errors.append(f"terminal_service import FAILED: {e}")

# ─── 3. market_data service imports ───
try:
    from backend.services.market_data import get_market_data_service
    passes.append("market_data: imports OK")
except Exception as e:
    errors.append(f"market_data import FAILED: {e}")

# ─── 4. institutional_terminal imports ───
try:
    from terminal_ui.institutional_terminal import launch_institutional_terminal, InstitutionalTerminalApp
    passes.append("institutional_terminal: imports OK")
except Exception as e:
    errors.append(f"institutional_terminal import FAILED: {e}")

# ─── 5. Async quote test ───
async def test_async():
    try:
        svc = get_terminal_data_service()
        q = await svc.get_live_quote_async("RELIANCE")
        assert isinstance(q, dict), "Quote must be a dict"
        assert "price" in q, "Quote must have price"
        passes.append(f"async quote OK: price=Rs{q.get('price',0):.2f} provider={q.get('provider')}")
    except Exception as e:
        errors.append(f"async quote FAILED: {e}")

    # ─── 6. OHLCV + Chart test ───
    try:
        import pandas as pd
        svc = get_terminal_data_service()
        df = await svc.get_ohlcv_history_async("RELIANCE", period="3M")
        assert isinstance(df, pd.DataFrame), "OHLCV must return DataFrame"
        passes.append(f"OHLCV OK: {len(df)} rows returned")

        chart = render_ascii_candlestick_chart(df, "RELIANCE", width=50, height=8)
        vpvr  = render_ascii_volume_profile(df, bins=5)
        passes.append(f"chart render OK: {len(chart)} chars")
        passes.append(f"VPVR  render OK: {len(vpvr)} chars")
    except Exception as e:
        errors.append(f"OHLCV/chart FAILED: {e}")

asyncio.run(test_async())

# ─── Results ───
print("\n" + "="*60)
print("  VERIFICATION RESULTS")
print("="*60)
for p in passes:
    print(f"  [PASS] {p}")
for err in errors:
    print(f"  [FAIL] {err}")
print("="*60)
print(f"  {len(passes)} PASSED  |  {len(errors)} FAILED")
print("="*60 + "\n")

sys.exit(0 if not errors else 1)
