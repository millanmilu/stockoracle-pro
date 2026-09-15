/**
 * StockOracle Pro — Advanced Technical Indicators Definitions
 * Central catalog of all supported overlays, oscillators, and key levels.
 *
 * Fields:
 *  - `field` / `subLines` / `levels`: read values already present on each
 *    candle (server-computed for legacy indicators).
 *  - `engineId`: client-side indicator from `@/utils/indicatorEngine.js`
 *    (`calculateById(engineId, candles, params)`) — used for the new catalog.
 */

export const INDICATOR_CATEGORIES = [
  { id: 'all',              label: 'All'               },
  { id: 'trend',            label: 'Trend'             },
  { id: 'momentum',         label: 'Momentum'          },
  { id: 'volatility',       label: 'Volatility'        },
  { id: 'volume',           label: 'Volume'            },
  { id: 'market_structure', label: 'Market Structure'  },
  { id: 'levels',           label: 'Levels'            },
  { id: 'ai',               label: 'AI Intelligence'   },
  { id: 'custom',           label: 'Custom'            },
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
    id: 'sma_100', name: 'Simple Moving Average 100', shortName: 'SMA 100',
    category: 'trend', type: 'overlay', color: '#FBBF24', lineWidth: 1.5, engineId: 'sma',
    params: { period: 100 },
    description: '100-period SMA (intermediate trend confirmation).', badge: 'Trend',
  },
  {
    id: 'sma_200', name: 'Simple Moving Average 200', shortName: 'SMA 200',
    category: 'trend', type: 'overlay', color: '#A855F7', lineWidth: 2, field: 'sma_200',
    engineId: 'sma', params: { period: 200 },
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
    id: 'ema_50', name: 'Exponential Moving Average 50', shortName: 'EMA 50',
    category: 'trend', type: 'overlay', color: '#34D399', lineWidth: 1.5, engineId: 'ema',
    params: { period: 50 },
    description: '50-period EMA (medium-term trend).', badge: 'Trend',
  },
  {
    id: 'ema_100', name: 'Exponential Moving Average 100', shortName: 'EMA 100',
    category: 'trend', type: 'overlay', color: '#818CF8', lineWidth: 1.5, engineId: 'ema',
    params: { period: 100 },
    description: '100-period EMA (intermediate trend).', badge: 'Trend',
  },
  {
    id: 'ema_200', name: 'Exponential Moving Average 200', shortName: 'EMA 200',
    category: 'trend', type: 'overlay', color: '#EC4899', lineWidth: 2, engineId: 'ema',
    params: { period: 200 },
    description: '200-period EMA (long-term trend).', badge: 'Trend',
  },
  {
    id: 'wma', name: 'Weighted Moving Average (20)', shortName: 'WMA 20',
    category: 'trend', type: 'overlay', color: '#22D3EE', lineWidth: 1.5, engineId: 'wma',
    description: 'Linear-weighted moving average emphasizing recent prices.', badge: 'Trend',
  },
  {
    id: 'hma', name: 'Hull Moving Average (20)', shortName: 'HMA 20',
    category: 'trend', type: 'overlay', color: '#FB7185', lineWidth: 1.5, engineId: 'hma',
    description: 'Smoothed Hull MA — low lag, responsive to trend shifts.', badge: 'Trend',
  },
  {
    id: 'kama', name: 'Kaufman Adaptive Moving Average', shortName: 'KAMA',
    category: 'trend', type: 'overlay', color: '#F472B6', lineWidth: 1.5, engineId: 'kama',
    description: 'Efficiency-ratio adaptive MA — flat in chop, responsive in trends.', badge: 'Adaptive',
  },
  {
    id: 'alma', name: 'Arnaud Legoux Moving Average (9)', shortName: 'ALMA',
    category: 'trend', type: 'overlay', color: '#A78BFA', lineWidth: 1.5, engineId: 'alma',
    description: 'Gaussian-weighted MA with adjustable offset & sigma for zero-lag smoothing.', badge: 'Trend',
  },
  {
    id: 'vwap', name: 'Volume Weighted Average Price (VWAP)', shortName: 'VWAP',
    category: 'trend', type: 'overlay', color: '#EC4899', lineWidth: 2, field: 'vwap', engineId: 'vwap',
    description: 'Volume-weighted average price — key intraday/swing benchmark.', badge: 'Volume',
  },
  {
    id: 'anchored_vwap', name: 'Anchored VWAP (Session)', shortName: 'A-VWAP',
    category: 'trend', type: 'overlay', color: '#F97316', lineWidth: 2, engineId: 'anchored_vwap',
    description: 'Anchored VWAP from a selected session start — dynamic support/resistance.', badge: 'Volume',
  },
  {
    id: 'supertrend', name: 'Supertrend (10, 3.0)', shortName: 'Supertrend',
    category: 'trend', type: 'overlay_supertrend', color: '#10B981', lineWidth: 2,
    field: 'supertrend', dirField: 'supertrend_dir', engineId: 'supertrend',
    description: 'ATR-based trendline — green when bullish, red when bearish.', badge: 'Signal',
  },
  {
    id: 'psar', name: 'Parabolic SAR (0.02, 0.2)', shortName: 'PSAR',
    category: 'trend', type: 'overlay_psar', color: '#F59E0B',
    field: 'psar', dirField: 'psar_dir', engineId: 'psar',
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

  // ── Momentum Oscillators (sub-pane) ─────────────────────────────────────────
  {
    id: 'rsi', name: 'Relative Strength Index (14)', shortName: 'RSI (14)',
    category: 'momentum', type: 'oscillator', oscType: 'rsi', color: '#A855F7', field: 'rsi',
    description: 'Momentum oscillator 0-100 (70 overbought / 30 oversold).', badge: 'Momentum',
  },
  {
    id: 'macd', name: 'MACD (12, 26, 9)', shortName: 'MACD',
    category: 'momentum', type: 'oscillator', oscType: 'macd', color: '#06B6D4',
    field: 'macd', signalField: 'macd_signal', histField: 'macd_hist',
    description: 'Trend momentum and signal crossovers with color histogram.', badge: 'Oscillator',
  },
  {
    id: 'stoch', name: 'Stochastic Oscillator (14, 3)', shortName: 'Stoch (14, 3)',
    category: 'momentum', type: 'oscillator', oscType: 'stoch', color: '#3B82F6',
    field: 'stoch_k', signalField: 'stoch_d', engineId: 'stoch',
    description: '%K/%D crossover (80 overbought / 20 oversold).', badge: 'Momentum',
  },
  {
    id: 'stoch_rsi', name: 'Stochastic RSI (14, 14, 3, 3)', shortName: 'StochRSI',
    category: 'momentum', type: 'oscillator', oscType: 'stoch_rsi', color: '#60A5FA',
    field: 'stoch_rsi_k', signalField: 'stoch_rsi_d', engineId: 'stoch_rsi',
    description: 'Stochastic on RSI — ultra-sensitive fast momentum signals.', badge: 'Advanced',
  },
  {
    id: 'cci', name: 'Commodity Channel Index (20)', shortName: 'CCI (20)',
    category: 'momentum', type: 'oscillator', oscType: 'cci', color: '#F97316', field: 'cci', engineId: 'cci',
    description: 'Price deviation from statistical average (±100 zones).', badge: 'Oscillator',
  },
  {
    id: 'williams_r', name: 'Williams %R (14)', shortName: 'Williams %R',
    category: 'momentum', type: 'oscillator', oscType: 'williams_r', color: '#EC4899', field: 'williams_r', engineId: 'williams_r',
    description: 'Momentum -100 (oversold) to 0 (overbought).', badge: 'Oscillator',
  },
  {
    id: 'roc', name: 'Rate of Change (10)', shortName: 'ROC (10)',
    category: 'momentum', type: 'oscillator', oscType: 'roc', color: '#14B8A6', engineId: 'roc',
    description: 'Percent price change over N bars — classic momentum measure.', badge: 'Momentum',
  },
  {
    id: 'momentum', name: 'Momentum (10)', shortName: 'Momentum',
    category: 'momentum', type: 'oscillator', oscType: 'momentum', color: '#F59E0B', engineId: 'momentum',
    description: 'Price change over N bars (absolute).', badge: 'Momentum',
  },
  {
    id: 'trix', name: 'Triple Exponential Average (15)', shortName: 'TRIX',
    category: 'momentum', type: 'oscillator', oscType: 'trix', color: '#C084FC', engineId: 'trix',
    description: 'Triple-smoothed EMA rate of change — leading momentum oscillator.', badge: 'Advanced',
  },
  {
    id: 'adx', name: 'ADX + DI Lines (14)', shortName: 'ADX (14)',
    category: 'momentum', type: 'oscillator', oscType: 'adx', color: '#FBBF24',
    field: 'adx', plusDIField: 'plus_di', minusDIField: 'minus_di', engineId: 'adx',
    description: 'Trend strength ADX with +DI/-DI directional lines (25+ = strong).', badge: 'Trend',
  },
  {
    id: 'elder_ray', name: 'Elder Ray Index (13)', shortName: 'Elder Ray',
    category: 'momentum', type: 'oscillator', oscType: 'elder_ray', color: '#34D399',
    field: 'elder_bull', signalField: 'elder_bear',
    description: 'Bull Power (High-EMA13) and Bear Power (Low-EMA13) histograms.', badge: 'Advanced',
  },

  // ── Volatility Indicators ───────────────────────────────────────────────────
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
  {
    id: 'atr', name: 'Average True Range (14)', shortName: 'ATR (14)',
    category: 'volatility', type: 'oscillator', oscType: 'atr', color: '#FB923C', field: 'atr', engineId: 'atr',
    description: 'Market volatility — expanding ATR signals range expansion.', badge: 'Volatility',
  },
  {
    id: 'hist_vol', name: 'Historical Volatility (20)', shortName: 'Hist Vol',
    category: 'volatility', type: 'oscillator', oscType: 'hist_vol', color: '#38BDF8', engineId: 'hist_vol',
    description: 'Annualized realized volatility of log returns (%).', badge: 'Volatility',
  },
  {
    id: 'std_dev', name: 'Standard Deviation (20)', shortName: 'StdDev',
    category: 'volatility', type: 'oscillator', oscType: 'std_dev', color: '#94A3B8', engineId: 'std_dev',
    description: 'Close price standard deviation over N bars.', badge: 'Volatility',
  },
  {
    id: 'bb_width', name: 'Bollinger Band Width', shortName: 'BB Width',
    category: 'volatility', type: 'oscillator', oscType: 'bb_width', color: '#818CF8', engineId: 'bb_width',
    description: 'Band width (%) — measures volatility compression/expansion.', badge: 'Volatility',
  },
  {
    id: 'choppiness', name: 'Choppiness Index (14)', shortName: 'Choppiness',
    category: 'volatility', type: 'oscillator', oscType: 'choppiness', color: '#F472B6', engineId: 'choppiness',
    description: '0-100: high = ranging/choppy, low = trending.', badge: 'Volatility',
  },

  // ── Volume Indicators (sub-pane) ────────────────────────────────────────────
  {
    id: 'mfi', name: 'Money Flow Index (14)', shortName: 'MFI (14)',
    category: 'volume', type: 'oscillator', oscType: 'mfi', color: '#06B6D4', field: 'mfi', engineId: 'mfi',
    description: 'Volume-weighted RSI 0-100 (80/20 overbought/oversold).', badge: 'Volume',
  },
  {
    id: 'obv', name: 'On-Balance Volume (OBV)', shortName: 'OBV',
    category: 'volume', type: 'oscillator', oscType: 'obv', color: '#10B981', field: 'obv', engineId: 'obv',
    description: 'Cumulative volume flow — rising OBV confirms uptrend.', badge: 'Volume',
  },
  {
    id: 'cmf', name: 'Chaikin Money Flow (20)', shortName: 'CMF (20)',
    category: 'volume', type: 'oscillator', oscType: 'cmf', color: '#38BDF8', field: 'cmf', engineId: 'cmf',
    description: 'Money flow pressure +1 to -1 (above zero = buying).', badge: 'Volume',
  },
  {
    id: 'rel_volume', name: 'Relative Volume (20)', shortName: 'Rel Vol',
    category: 'volume', type: 'oscillator', oscType: 'rel_volume', color: '#34D399', engineId: 'rel_volume',
    description: 'Current bar volume vs its 20-bar average (1x = average).', badge: 'Volume',
  },
  {
    id: 'volume_delta', name: 'Volume Delta (estimated)', shortName: 'Vol Delta',
    category: 'volume', type: 'oscillator', oscType: 'volume_delta', color: '#F87171', engineId: 'volume_delta',
    description: '*Estimated* buy minus sell volume per bar (close-position heuristic — NOT real order flow).', badge: 'Estimated',
  },
  {
    id: 'cvd', name: 'Cumulative Volume Delta (estimated)', shortName: 'CVD',
    category: 'volume', type: 'oscillator', oscType: 'cvd', color: '#E879F9', engineId: 'cvd',
    description: '*Estimated* cumulative volume delta — bid/ask pressure proxy (NOT real order flow).', badge: 'Estimated',
  },

  // ── Market Structure / SMC ──────────────────────────────────────────────────
  {
    id: 'swing_hl', name: 'Swing Highs & Lows (5)', shortName: 'Swing H/L',
    category: 'market_structure', type: 'smc', smcType: 'swing_hl', color: '#A78BFA',
    description: 'Fractal swing highs/lows with clean labels.', badge: 'SMC',
  },
  {
    id: 'hh_hl', name: 'HH/HL/LH/LL Structure', shortName: 'HH/HL',
    category: 'market_structure', type: 'smc', smcType: 'hh_hl', color: '#34D399',
    description: 'Higher-high / higher-low / lower-high / lower-low trend structure.', badge: 'SMC',
  },
  {
    id: 'bos_choch', name: 'BOS / CHoCH', shortName: 'BOS/CHoCH',
    category: 'market_structure', type: 'smc', smcType: 'bos_choch', color: '#F59E0B',
    description: 'Break of structure and change of character markers.', badge: 'SMC',
  },
  {
    id: 'supply_demand', name: 'Supply / Demand Zones', shortName: 'S/D Zones',
    category: 'market_structure', type: 'smc', smcType: 'supply_demand', color: '#EF5350',
    description: 'Institutional supply (resistance) and demand (support) zones.', badge: 'SMC',
  },
  {
    id: 'order_blocks', name: 'Order Blocks', shortName: 'Order Blocks',
    category: 'market_structure', type: 'smc', smcType: 'order_blocks', color: '#10B981',
    description: 'Last opposite candle before an impulsive move (institutional OB).', badge: 'SMC',
  },
  {
    id: 'fvg', name: 'Fair Value Gaps', shortName: 'FVG',
    category: 'market_structure', type: 'smc', smcType: 'fvg', color: '#60A5FA',
    description: 'Unmitigated 3-candle imbalance gaps.', badge: 'SMC',
  },
  {
    id: 'liquidity', name: 'Liquidity Zones', shortName: 'Liquidity',
    category: 'market_structure', type: 'smc', smcType: 'liquidity', color: '#FB923C',
    description: 'High-volume liquidity pools where stop hunts occur.', badge: 'SMC',
  },
  {
    id: 'sr_lines', name: 'Support / Resistance', shortName: 'S/R',
    category: 'market_structure', type: 'smc', smcType: 'sr_lines', color: '#64748B',
    description: 'Rolling swing-level support & resistance lines.', badge: 'S/R',
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

  // ── AI Intelligence (presented via AIDashboard, not chart overlays) ─────────
  {
    id: 'ai_signal', name: 'AI Signal Engine', shortName: 'AI Signal',
    category: 'ai', type: 'ai', color: '#38BDF8',
    description: 'Rule-based confluence score, entry/SL/TP zones, and R:R with WHY explanations.', badge: 'AI',
  },
  {
    id: 'ai_dashboard', name: 'AI Dashboard & MTF Alignment', shortName: 'AI Dashboard',
    category: 'ai', type: 'ai', color: '#A78BFA',
    description: 'Multi-timeframe AI alignment (1m → 1W) with signal probabilities.', badge: 'AI',
  },
  {
    id: 'ai_consensus', name: 'ML Consensus (if trained)', shortName: 'ML Consensus',
    category: 'ai', type: 'ai', color: '#34D399',
    description: 'Surfaced separately when a trained ML model exists.', badge: 'ML',
  },

  // ── Custom ───────────────────────────────────────────────────────────────────
  {
    id: 'custom', name: 'Custom Indicator Placeholder', shortName: 'Custom',
    category: 'custom', type: 'custom', color: '#CBD5E1',
    description: 'Reserved for user-defined indicator scripts.', badge: 'Custom',
  },
];

export const DEFAULT_ACTIVE_INDICATORS = ['sma_20'];