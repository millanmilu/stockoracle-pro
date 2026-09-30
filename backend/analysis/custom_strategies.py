"""
StockOracle Pro — Custom Backtest Strategies (apni strategy yahan likho)

Ye file optional hai — na ho to 6 builtin strategies waise hi chalti hain.
Server start par `backtester._try_load_custom_strategies()` ise auto-import
karta hai, aur har `run_backtest()` call par dobara load hota hai, isliye
file save karte hi agli backtest me nayi strategy bina restart ke milegi.

Contract:
  from backend.analysis.backtester import register_strategy, register_exit

  @register_strategy("my_id", label="Mera Naam", description="...")
  def my_entry(ctx, i, p):
      # ctx: dict of numpy arrays + current-bar scalars (neeche keys dekho)
      # i:   current test-bar index (0..n-1) — sirf i ya i-1 access karo (no look-ahead!)
      # p:   params dict (fast_period, rsi_oversold, entry_threshold, ...)
      # return: True = BUY signal (flat hone par), False = wait
      ...

  @register_exit("my_id")   # optional — na do to SL/TP/trailing/time-stop par exit
  def my_exit(ctx, i, p):
      # return: True = SELL signal (position me hone par)
      ...

ctx keys (arrays test-window ke, scalars current bar ke):
  close, high, low, open, volume, volume_ratio, rsi_14, bb_lower, bb_upper,
  macd, macd_signal, ema_fast, ema_slow, donchian_high, donchian_low,
  st_vals, st_dir, preds (ai preds ya None),
  curr_close, curr_rsi, curr_volume_ratio, curr_bb_low, curr_bb_high

p keys: fast_period, slow_period, rsi_oversold, rsi_overbought,
  entry_threshold, bearish_exit_threshold, atr_multiplier, stop_loss,
  take_profit, trailing_stop_pct, max_holding_days, position_size_pct,
  slippage_bps, commission_bps

Example neeche commented hai — uncomment karke apna rule likho.
"""
from backend.analysis.backtester import register_strategy, register_exit


# ── Example: EMA snap + RSI filter ───────────────────────────────────────────
# @register_strategy("ema_rsi_snap", label="EMA Snap + RSI",
#                    description="EMA fast>slow snap jab RSI oversold se uth raha ho.")
# def _ema_rsi_snap_entry(ctx, i, p):
#     if i < 1:
#         return False
#     snapped = ctx["ema_fast"][i] > ctx["ema_slow"][i] and \
#               ctx["ema_fast"][i - 1] <= ctx["ema_slow"][i - 1]
#     rsi_ok = ctx["rsi_14"][i] > float(p.get("rsi_oversold", 30.0))
#     return bool(snapped and rsi_ok)
#
#
# @register_exit("ema_rsi_snap")
# def _ema_rsi_snap_exit(ctx, i, p):
#     return bool(ctx["ema_fast"][i] < ctx["ema_slow"][i])
