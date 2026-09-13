/**
 * StockOracle Pro — Advanced Technical Indicators Definitions
 * Central catalog of all supported overlays, oscillators, and key levels.
 */

export const INDICATOR_CATEGORIES = [
  { id: 'all',         label: 'All Indicators' },
  { id: 'trend',       label: 'Trend & MAs'    },
  { id: 'volatility',  label: 'Volatility'     },
  { id: 'oscillators', label: 'Oscillators'    },
  { id: 'volume',      label: 'Volume'         },
  { id: 'levels',      label: 'Levels & Pivots'},
];

export const INDICATOR_DEFINITIONS = [
  // ── Moving Averages & Trend Overlays ─────────────────────────────────────────
  {
    id: 'sma_20', name: 'Simple Moving Average 20', shortName: 'SMA 20',
    category: 'trend', type: 'overlay', color: '#06B6D4', lineWidth: 1.5, field: 'sma_20',
    description: '20-period simple moving average (short-term trend benchmark).', badge: 'Trend',
  },
  {
    id: 'sma_50', name: 'Simple Moving Average 50', shortName: 'SMA 50',
    category: 'trend', type: 'overlay', color: '#F97316', lineWidth: 1.5, field: 'sma_50',
    description: '50-period SMA (medium-term institutional trend filter).', badge: 'Trend',
  },
  {
    id: 'sma_200', name: 'Simple Moving Average 200', shortName: 'SMA 200',
    category: 'trend', type: 'overlay', color: '#A855F7', lineWidth: 2, field: 'sma_200',
    description: '200-period SMA (major multi-month bull/bear threshold).', badge: 'Trend',
  },
  {
    id: 'ema_9', name: 'Exponential Moving Average 9', shortName: 'EMA 9',
    category: 'trend', type: 'overlay', color: '#EAB308', lineWidth: 1.5, field: 'ema_9',
    description: '9-period EMA for ultra-fast momentum trend tracking.', badge: 'Fast',
  },
  {
    id: 'ema_21', name: 'Exponential Moving Average 21', shortName: 'EMA 21',
    category: 'trend', type: 'overlay', color: '#3B82F6', lineWidth: 1.5, field: 'ema_21',
    description: '21-period EMA (Fibonacci pullback trigger).', badge: 'Trend',
  },
  {
    id: 'vwap', name: 'Volume Weighted Average Price (VWAP)', shortName: 'VWAP',
    category: 'trend', type: 'overlay', color: '#EC4899', lineWidth: 2, field: 'vwap',
    description: 'Volume-weighted average price — key intraday/swing benchmark.', badge: 'Volume',
  },
  {
    id: 'supertrend', name: 'Supertrend (10, 3.0)', shortName: 'Supertrend',
    category: 'trend', type: 'overlay_supertrend', color: '#10B981', lineWidth: 2,
    field: 'supertrend', dirField: 'supertrend_dir',
    description: 'ATR-based trendline — green when bullish, red when bearish.', badge: 'Signal',
  },
  {
    id: 'psar', name: 'Parabolic SAR (0.02, 0.2)', shortName: 'PSAR',
    category: 'trend', type: 'overlay_psar', color: '#F59E0B',
    field: 'psar', dirField: 'psar_dir',
    description: 'Trailing stop-and-reverse dots below price (bullish) or above (bearish).', badge: 'Signal',
  },
  {
    id: 'ichimoku', name: 'Ichimoku Cloud (9, 26, 52)', shortName: 'Ichimoku',
    category: 'trend', type: 'overlay_ichimoku', color: '#818CF8',
    subLines: [
      { field: 'ichimoku_tenkan',   color: '#06B6D4',               label: 'Tenkan'   },
      { field: 'ichimoku_kijun',    color: '#F97316',               label: 'Kijun'    },
      { field: 'ichimoku_senkou_a', color: 'rgba(16,185,129,0.55)', label: 'Senkou A' },
      { field: 'ichimoku_senkou_b', color: 'rgba(239,83,80,0.55)',  label: 'Senkou B' },
      { field: 'ichimoku_chikou',   color: '#A855F7',               label: 'Chikou'   },
    ],
    description: 'Full Ichimoku — Tenkan/Kijun crossover, cloud S/R, Chikou confirmation.', badge: 'Advanced',
  },

  // ── Volatility Bands ─────────────────────────────────────────────────────────
  {
    id: 'bollinger_bands', name: 'Bollinger Bands (20, 2.0)', shortName: 'BB (20, 2)',
    category: 'volatility', type: 'overlay_multi', color: '#818CF8',
    subLines: [
      { field: 'bb_upper',  color: '#818CF8', style: 2, label: 'Upper' },
      { field: 'bb_middle', color: '#A5B4FC', style: 0, label: 'Basis' },
      { field: 'bb_lower',  color: '#818CF8', style: 2, label: 'Lower' },
    ],
    description: '20-period SMA enveloped by 2 standard deviation bands.', badge: 'Volatility',
  },
  {
    id: 'keltner', name: 'Keltner Channels (20, 2.0)', shortName: 'KC (20, 2)',
    category: 'volatility', type: 'overlay_multi', color: '#818CF8',
    subLines: [
      { field: 'keltner_upper',  color: '#818CF8', style: 2, label: 'Upper' },
      { field: 'keltner_middle', color: '#6366F1', style: 0, label: 'Basis' },
      { field: 'keltner_lower',  color: '#818CF8', style: 2, label: 'Lower' },
    ],
    description: 'EMA-centered channel with 2x ATR width.', badge: 'Channels',
  },
  {
    id: 'donchian', name: 'Donchian Channels (20)', shortName: 'DC (20)',
    category: 'volatility', type: 'overlay_multi', color: '#F59E0B',
    subLines: [
      { field: 'donchian_upper',  color: '#F59E0B', style: 1, label: 'High' },
      { field: 'donchian_middle', color: '#FCD34D', style: 2, label: 'Mid'  },
      { field: 'donchian_lower',  color: '#F59E0B', style: 1, label: 'Low'  },
    ],
    description: '20-bar highest high / lowest low breakout channels.', badge: 'Channels',
  },

  // ── Oscillators (sub-pane) ───────────────────────────────────────────────────
  {
    id: 'rsi', name: 'Relative Strength Index (14)', shortName: 'RSI (14)',
    category: 'oscillators', type: 'oscillator', oscType: 'rsi', color: '#A855F7', field: 'rsi',
    description: 'Momentum oscillator 0-100 (70 overbought / 30 oversold).', badge: 'Momentum',
  },
  {
    id: 'macd', name: 'MACD (12, 26, 9)', shortName: 'MACD',
    category: 'oscillators', type: 'oscillator', oscType: 'macd', color: '#06B6D4',
    field: 'macd', signalField: 'macd_signal', histField: 'macd_hist',
    description: 'Trend momentum and signal crossovers with color histogram.', badge: 'Oscillator',
  },
  {
    id: 'stoch', name: 'Stochastic Oscillator (14, 3)', shortName: 'Stoch (14, 3)',
    category: 'oscillators', type: 'oscillator', oscType: 'stoch', color: '#3B82F6',
    field: 'stoch_k', signalField: 'stoch_d',
    description: '%K/%D crossover (80 overbought / 20 oversold).', badge: 'Momentum',
  },
  {
    id: 'stoch_rsi', name: 'Stochastic RSI (14, 14, 3, 3)', shortName: 'StochRSI',
    category: 'oscillators', type: 'oscillator', oscType: 'stoch_rsi', color: '#60A5FA',
    field: 'stoch_rsi_k', signalField: 'stoch_rsi_d',
    description: 'Stochastic on RSI — ultra-sensitive fast momentum signals.', badge: 'Advanced',
  },
  {
    id: 'cci', name: 'Commodity Channel Index (20)', shortName: 'CCI (20)',
    category: 'oscillators', type: 'oscillator', oscType: 'cci', color: '#F97316', field: 'cci',
    description: 'Price deviation from statistical average (±100 zones).', badge: 'Oscillator',
  },
  {
    id: 'williams_r', name: 'Williams %R (14)', shortName: 'Williams %R',
    category: 'oscillators', type: 'oscillator', oscType: 'williams_r', color: '#EC4899', field: 'williams_r',
    description: 'Momentum -100 (oversold) to 0 (overbought).', badge: 'Oscillator',
  },
  {
    id: 'adx', name: 'ADX + DI Lines (14)', shortName: 'ADX (14)',
    category: 'oscillators', type: 'oscillator', oscType: 'adx', color: '#FBBF24',
    field: 'adx', plusDIField: 'plus_di', minusDIField: 'minus_di',
    description: 'Trend strength ADX with +DI/-DI directional lines (25+ = strong).', badge: 'Trend',
  },
  {
    id: 'atr', name: 'Average True Range (14)', shortName: 'ATR (14)',
    category: 'oscillators', type: 'oscillator', oscType: 'atr', color: '#FB923C', field: 'atr',
    description: 'Market volatility — expanding ATR signals range expansion.', badge: 'Volatility',
  },
  {
    id: 'elder_ray', name: 'Elder Ray Index (13)', shortName: 'Elder Ray',
    category: 'oscillators', type: 'oscillator', oscType: 'elder_ray', color: '#34D399',
    field: 'elder_bull', signalField: 'elder_bear',
    description: 'Bull Power (High-EMA13) and Bear Power (Low-EMA13) histograms.', badge: 'Advanced',
  },

  // ── Volume Indicators (sub-pane) ─────────────────────────────────────────────
  {
    id: 'mfi', name: 'Money Flow Index (14)', shortName: 'MFI (14)',
    category: 'volume', type: 'oscillator', oscType: 'mfi', color: '#06B6D4', field: 'mfi',
    description: 'Volume-weighted RSI 0-100 (80/20 overbought/oversold).', badge: 'Volume',
  },
  {
    id: 'obv', name: 'On-Balance Volume (OBV)', shortName: 'OBV',
    category: 'volume', type: 'oscillator', oscType: 'obv', color: '#10B981', field: 'obv',
    description: 'Cumulative volume flow — rising OBV confirms uptrend.', badge: 'Volume',
  },
  {
    id: 'cmf', name: 'Chaikin Money Flow (20)', shortName: 'CMF (20)',
    category: 'volume', type: 'oscillator', oscType: 'cmf', color: '#38BDF8', field: 'cmf',
    description: 'Money flow pressure +1 to -1 (above zero = buying).', badge: 'Volume',
  },

  // ── Key Levels & Pivots ──────────────────────────────────────────────────────
  {
    id: 'pivot_points', name: 'Classic Pivot Points (Daily)', shortName: 'Pivots',
    category: 'levels', type: 'levels',
    levels: [
      { field: 'r2',    color: '#EF4444', label: 'R2' },
      { field: 'r1',    color: '#F87171', label: 'R1' },
      { field: 'pivot', color: '#FBBF24', label: 'P'  },
      { field: 's1',    color: '#34D399', label: 'S1' },
      { field: 's2',    color: '#10B981', label: 'S2' },
    ],
    description: 'Standard floor-trader S/R from previous session bounds.', badge: 'S/R',
  },
  {
    id: 'fibonacci', name: 'Fibonacci Retracement (50)', shortName: 'Fibonacci',
    category: 'levels', type: 'levels',
    levels: [
      { field: 'fib_236', color: '#FB923C', label: '23.6%' },
      { field: 'fib_382', color: '#FBBF24', label: '38.2%' },
      { field: 'fib_500', color: '#A78BFA', label: '50.0%' },
      { field: 'fib_618', color: '#34D399', label: '61.8%' },
    ],
    description: 'Rolling 50-bar Fibonacci retracement — institutional S/R zones.', badge: 'Fibonacci',
  },
];

export const DEFAULT_ACTIVE_INDICATORS = ['sma_20'];
