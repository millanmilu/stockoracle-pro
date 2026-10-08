export const QUICK_TICKERS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'ZEEL', 'WIPRO', 'BTC', 'GOLD'];

export const STRATEGIES = [
  { id: 'ai_ensemble', name: 'AI Walk-Forward ML', desc: 'XGBoost + ElasticNet ensemble on causal causal features', icon: '🤖', badge: 'AI' },
  { id: 'ema_crossover', name: 'EMA Golden Cross', desc: 'Fast vs Slow Exponential Moving Average trend crossover', icon: '📈', badge: 'TREND' },
  { id: 'rsi_mean_reversion', name: 'RSI + BB Mean Reversion', desc: 'Oversold lower band dip buyer with mean target', icon: '🎯', badge: 'REVERSION' },
  { id: 'momentum_breakout', name: '20D Momentum Breakout', desc: 'Donchian channel breakout with volume expansion', icon: '🚀', badge: 'MOMENTUM' },
  { id: 'macd_crossover', name: 'MACD Momentum Cross', desc: 'MACD line cross above signal with positive momentum', icon: '🌊', badge: 'MACD' },
  { id: 'supertrend', name: 'Supertrend Volatility', desc: 'Dynamic ATR-based trailing trend-following stop', icon: '🛡️', badge: 'VOLATILITY' },
  { id: 'smc_pro', name: 'SMC Pro', desc: 'Causal MTF confluence, confirmed structure, liquidity sweeps and structural long/short exits', icon: '🔷', badge: 'SMC' },
];

export const SMC_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h'];
export const SMC_PERIODS = ['7D', '45D', '120D', '200D', '370D'];

export const PRESETS = [
  {
    name: 'Conservative',
    icon: '🛡️',
    desc: 'Tight stop loss & disciplined mean reversion',
    strategy: 'rsi_mean_reversion',
    params: { stop_loss: 3.0, take_profit: 6.0, trailing_stop_pct: 2.0, max_holding_days: 15, position_size_pct: 80 }
  },
  {
    name: 'Momentum Trend',
    icon: '🚀',
    desc: 'Breakout run with wide profit targets',
    strategy: 'momentum_breakout',
    params: { stop_loss: 5.0, take_profit: 15.0, trailing_stop_pct: 4.0, max_holding_days: 35, position_size_pct: 100 }
  },
  {
    name: 'Quant AI',
    icon: '🤖',
    desc: 'Walk-forward ML predictive edge',
    strategy: 'ai_ensemble',
    params: { entry_threshold: 1.5, stop_loss: 4.0, take_profit: 8.0, trailing_stop_pct: 3.0, max_holding_days: 20, position_size_pct: 100 }
  },
  {
    name: 'Swing Cross',
    icon: '⚡',
    desc: 'Fast 9/21 EMA trend following',
    strategy: 'ema_crossover',
    params: { fast_period: 9, slow_period: 21, stop_loss: 3.5, take_profit: 7.5, trailing_stop_pct: 2.5, max_holding_days: 20, position_size_pct: 100 }
  }
];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
