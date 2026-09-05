/**
 * StockOracle Pro — Advanced Technical Indicators Definitions
 * Central catalog of all supported overlays, oscillators, and key levels.
 */

export const INDICATOR_CATEGORIES = [
  { id: 'all', label: 'All Indicators' },
  { id: 'trend', label: 'Trend & MAs' },
  { id: 'volatility', label: 'Volatility' },
  { id: 'oscillators', label: 'Oscillators' },
  { id: 'levels', label: 'Levels & Pivots' },
];

export const INDICATOR_DEFINITIONS = [
  // ── Moving Averages & Trend Overlays ──────────────────────────────────────────
  {
    id: 'sma_20',
    name: 'Simple Moving Average 20',
    shortName: 'SMA 20',
    category: 'trend',
    type: 'overlay',
    color: '#06B6D4', // Cyan
    lineWidth: 1.5,
    field: 'sma_20',
    description: '20-period simple moving average of close prices (short-term trend benchmark).',
    badge: 'Trend',
  },
  {
    id: 'sma_50',
    name: 'Simple Moving Average 50',
    shortName: 'SMA 50',
    category: 'trend',
    type: 'overlay',
    color: '#F97316', // Orange
    lineWidth: 1.5,
    field: 'sma_50',
    description: '50-period simple moving average (medium-term institutional trend filter).',
    badge: 'Trend',
  },
  {
    id: 'sma_200',
    name: 'Simple Moving Average 200',
    shortName: 'SMA 200',
    category: 'trend',
    type: 'overlay',
    color: '#A855F7', // Purple
    lineWidth: 2,
    field: 'sma_200',
    description: '200-period simple moving average (major multi-month bull/bear threshold).',
    badge: 'Trend',
  },
  {
    id: 'ema_9',
    name: 'Exponential Moving Average 9',
    shortName: 'EMA 9',
    category: 'trend',
    type: 'overlay',
    color: '#EAB308', // Yellow
    lineWidth: 1.5,
    field: 'ema_9',
    description: '9-period exponential moving average for ultra-fast momentum trend tracking.',
    badge: 'Fast',
  },
  {
    id: 'ema_21',
    name: 'Exponential Moving Average 21',
    shortName: 'EMA 21',
    category: 'trend',
    type: 'overlay',
    color: '#3B82F6', // Blue
    lineWidth: 1.5,
    field: 'ema_21',
    description: '21-period exponential moving average (Fibonacci pullback trigger).',
    badge: 'Trend',
  },
  {
    id: 'vwap',
    name: 'Volume Weighted Average Price (VWAP)',
    shortName: 'VWAP',
    category: 'trend',
    type: 'overlay',
    color: '#EC4899', // Pink / Magenta
    lineWidth: 2,
    field: 'vwap',
    description: 'Benchmark ratio of total value traded to total volume for intraday/swing evaluation.',
    badge: 'Volume',
  },
  {
    id: 'supertrend',
    name: 'Supertrend (10, 3.0)',
    shortName: 'Supertrend',
    category: 'trend',
    type: 'overlay',
    color: '#10B981', // Dynamic in rendering
    lineWidth: 2,
    field: 'supertrend',
    dirField: 'supertrend_dir',
    description: 'ATR-based adaptive trendline with automatic bullish/bearish trailing stop reversals.',
    badge: 'Signal',
  },

  // ── Volatility Bands ──────────────────────────────────────────────────────────
  {
    id: 'bollinger_bands',
    name: 'Bollinger Bands (20, 2.0)',
    shortName: 'BB (20, 2)',
    category: 'volatility',
    type: 'overlay_multi',
    color: '#818CF8', // Indigo
    subLines: [
      { field: 'bb_upper', color: '#818CF8', style: 2, label: 'Upper' },
      { field: 'bb_middle', color: '#A5B4FC', style: 0, label: 'Basis' },
      { field: 'bb_lower', color: '#818CF8', style: 2, label: 'Lower' },
    ],
    description: '20-period SMA enveloped by 2 standard deviation upper and lower volatility bands.',
    badge: 'Volatility',
  },

  // ── Oscillators & Momentum (Rendered in Synchronized Sub-Pane) ─────────────────
  {
    id: 'rsi',
    name: 'Relative Strength Index (14)',
    shortName: 'RSI (14)',
    category: 'oscillators',
    type: 'oscillator',
    color: '#A855F7',
    field: 'rsi',
    description: 'Momentum oscillator measuring speed and change of price moves (0-100 scale, 70/30 bands).',
    badge: 'Momentum',
  },
  {
    id: 'macd',
    name: 'MACD (12, 26, 9)',
    shortName: 'MACD',
    category: 'oscillators',
    type: 'oscillator',
    color: '#06B6D4',
    field: 'macd',
    signalField: 'macd_signal',
    histField: 'macd_hist',
    description: 'Moving Average Convergence Divergence showing trend momentum and signal line crossovers.',
    badge: 'Oscillator',
  },

  // ── Key Levels & Pivots ───────────────────────────────────────────────────────
  {
    id: 'pivot_points',
    name: 'Classic Pivot Points (Daily)',
    shortName: 'Pivots',
    category: 'levels',
    type: 'levels',
    levels: [
      { field: 'r2', color: '#EF4444', label: 'R2' },
      { field: 'r1', color: '#F87171', label: 'R1' },
      { field: 'pivot', color: '#FBBF24', label: 'P' },
      { field: 's1', color: '#34D399', label: 'S1' },
      { field: 's2', color: '#10B981', label: 'S2' },
    ],
    description: 'Standard floor-trader support and resistance levels derived from previous session bounds.',
    badge: 'S/R',
  },
];

export const DEFAULT_ACTIVE_INDICATORS = ['sma_20'];
