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
  // Virtual tab — matches any definition with `type === 'oscillator'`
  // (sub-pane oscillators) regardless of its stored category.
  { id: 'oscillators',      label: 'Oscillators', virtual: true },
  { id: 'volatility',       label: 'Volatility'        },
  { id: 'volume',           label: 'Volume'            },
  { id: 'market_structure', label: 'Structure'         },
  { id: 'levels',           label: 'Levels'            },
  { id: 'ai',               label: 'AI'                },
  { id: 'custom',           label: 'Custom'            },
];

/**
 * Shorthand aliases for search — e.g. "bb" → Bollinger, "ma" → moving
 * averages. The modal merges these with name/shortName/description/badge
 * so ticker-style queries resolve without per-definition keyword lists.
 */
export const INDICATOR_SEARCH_ALIASES = {
  sma_20: ['ma', 'moving average', 'sma20', 'ma20'],
  sma_50: ['ma', 'moving average', 'sma50', 'ma50'],
  sma_100: ['ma', 'moving average', 'sma100', 'ma100'],
  sma_200: ['ma', 'moving average', 'golden cross', 'death cross', 'sma200', 'ma200'],
  ema_9: ['ma', 'moving average', 'ema9'],
  ema_21: ['ma', 'moving average', 'ema21', 'fib'],
  ema_50: ['ma', 'moving average', 'ema50'],
  ema_100: ['ma', 'moving average', 'ema100'],
  ema_200: ['ma', 'moving average', 'ema200'],
  wma: ['ma', 'moving average', 'weighted'],
  hma: ['ma', 'moving average', 'hull'],
  kama: ['ma', 'moving average', 'adaptive', 'kaufman'],
  alma: ['ma', 'moving average', 'arnaud', 'legoux'],
  vwap: ['volume weighted', 'benchmark', 'intraday'],
  anchored_vwap: ['avwap', 'anchored', 'volume weighted'],
  supertrend: ['st', 'trend', 'atr trailing stop'],
  psar: ['parabolic', 'sar', 'stop and reverse', 'dots'],
  ichimoku: ['cloud', 'tenkan', 'kijun', 'senkou', 'chikou', 'ichi'],
  rsi: ['relative strength', 'momentum', 'overbought', 'oversold'],
  macd: ['convergence', 'divergence', 'histogram', 'signal line'],
  stoch: ['stochastic', '%k', '%d', 'overbought', 'oversold'],
  stoch_rsi: ['stochastic rsi', 'stochrsi', '%k', '%d'],
  cci: ['commodity channel', 'overbought'],
  williams_r: ['williams', '%r', 'wpr'],
  roc: ['rate of change', 'momentum'],
  momentum: ['mom', 'rate of change'],
  trix: ['triple exponential', 'momentum'],
  adx: ['average directional', 'dmi', '+di', '-di', 'trend strength'],
  elder_ray: ['elder', 'bull power', 'bear power'],
  bollinger_bands: ['bb', 'bollinger', 'bands', 'squeeze'],
  keltner: ['kc', 'keltner', 'channels', 'atr channel'],
  donchian: ['dc', 'donchian', 'breakout', 'turtle'],
  atr: ['average true range', 'volatility', 'stop loss'],
  hist_vol: ['historical volatility', 'realized vol'],
  std_dev: ['standard deviation', 'volatility'],
  bb_width: ['bandwidth', 'bbw', 'squeeze'],
  choppiness: ['chop', 'ranging', 'trend vs range'],
  mfi: ['money flow', 'volume rsi'],
  obv: ['on balance volume', 'cumulative volume'],
  cmf: ['chaikin', 'money flow'],
  rel_volume: ['rv', 'relative volume', 'volume spike'],
  volume_delta: ['delta', 'order flow', 'buy sell volume'],
  cvd: ['cumulative delta', 'order flow'],
  swing_hl: ['swing', 'fractal', 'pivot high low'],
  hh_hl: ['market structure', 'hh', 'hl', 'lh', 'll', 'bos precursor'],
  bos_choch: ['break of structure', 'change of character', 'smc'],
  supply_demand: ['supply', 'demand', 'zones', 'support', 'resistance'],
  order_blocks: ['ob', 'order block', 'institutional'],
  fvg: ['fair value gap', 'imbalance', 'gap'],
  liquidity: ['liquidity', 'stop hunt', 'pools', 'sweep'],
  sr_lines: ['support', 'resistance', 'sr'],
  pivot_points: ['pivots', 'floor trader', 'pp', 'r1', 's1'],
  fibonacci: ['fib', 'retracement', 'golden ratio', '61.8'],
};

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
  {
    id: 'volume_profile', name: 'Volume Profile (Visible Range)', shortName: 'VPVR',
    category: 'volume', type: 'profile', color: '#38BDF8', engineId: 'volume_profile',
    params: { rows: 24, value_area: 70 },
    description: 'TradingView-style visible-range profile: POC, 70% value area (VAH/VAL) and up/down volume rows docked right.',
    badge: 'Profile',
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
  // Each AI entry carries an explicit input → method → output pipeline plus
  // confidence semantics and backtest guidance, so the panel documents WHAT
  // the model does — not just a fancy name.
  {
    id: 'ai_signal', name: 'AI Signal Engine', shortName: 'AI Signal',
    category: 'ai', type: 'ai', color: '#38BDF8', ai: true, chartOverlay: true,
    description: 'Rule-based confluence score with entry / SL / TP zones and WHY explanations.',
    badge: 'AI',
    keywords: ['signal', 'confluence', 'buy', 'sell', 'hold', 'entry', 'stop loss', 'take profit', 'score'],
    inputs: ['OHLCV candles', 'Trend (EMA/Supertrend)', 'Momentum (RSI/MACD)', 'Volatility (ATR/BB)', 'Structure (swings/S-R)'],
    method: 'Weighted confluence of trend + momentum + volatility + structure sub-scores into a 0–100 composite. Deterministic rules — no black box.',
    outputs: ['BUY / SELL / HOLD signal', 'Entry zone', 'Stop-loss', 'Take-profit', 'Confidence 0–100', 'Risk : Reward'],
    signals: ['BUY', 'SELL', 'HOLD'],
    confidence: 'Composite agreement across sub-models; >65 = high, 45–65 = moderate, <45 = no-trade.',
    backtest: 'Validate win-rate and avg R:R per symbol/timeframe before sizing; confluence scores degrade in low-ATR chop.',
  },
  {
    id: 'ai_trend', name: 'AI Trend Detector', shortName: 'AI Trend',
    category: 'ai', type: 'oscillator', oscType: 'ai_trend', engineId: 'ai_trend',
    color: '#22D3EE', ai: true,
    description: 'Advanced multi-factor trend score (−100…+100) in its own sub-pane: magnitude-weighted EMA-stack votes scaled by the ADX regime. (A bounded score can never share the price scale — hence its own pane.)',
    badge: 'AI',
    keywords: ['trend', 'direction', 'bullish', 'bearish', 'sideways', 'adx', 'ema stack'],
    inputs: ['EMA stack (9/21/50)', 'ADX regime weight', 'Supertrend direction', 'MACD histogram sign'],
    method: 'EMA-alignment votes weighted by separation/ATR (chop abstains), scaled by ADX, plus Supertrend and MACD votes. Deterministic — recomputed live per bucket.',
    outputs: ['Trend oscillator −100…+100', 'UPTREND / DOWNTREND / RANGE read (|score| > 20)'],
    signals: ['UPTREND', 'DOWNTREND', 'RANGE'],
    confidence: '|score| magnitude itself is the confidence; whipsaw zones hover near 0.',
    backtest: 'Trend-following overlays outperform on daily/4h; expect whipsaw on sub-15m ranges — filter by ADX.',
  },
  {
    id: 'ai_sr', name: 'AI Support & Resistance', shortName: 'AI S/R',
    category: 'ai', type: 'ai', color: '#F472B6', ai: true, chartOverlay: true,
    aiOverlay: 'zones',
    description: 'Advanced dynamic S/R zones drawn on the price pane: fractal swing pivots clustered within 0.25 ATR, scored by touches + volume + recency.',
    badge: 'AI',
    keywords: ['support', 'resistance', 'supply', 'demand', 'zones', 'levels', 'floor'],
    inputs: ['Fractal swing highs/lows', 'ATR tolerance clustering', 'Volume-at-level', 'Recency decay'],
    method: 'Clusters swing pivots with volume confirmation; ranks zones by touches, recency, and volume. Top 3 supports + 3 resistances drawn as labeled lines.',
    outputs: ['Support/resistance lines with strength', 'Near-price flag (±3%)'],
    signals: ['HOLD-ABOVE', 'BREAK', 'BOUNCE-WATCH'],
    confidence: 'More touches + higher volume-at-level = stronger zone; aged untouched zones decay in rank.',
    backtest: 'Measure bounce-rate per zone tier; fresh daily zones typically outperform stale multi-week ones.',
  },
  {
    id: 'ai_momentum', name: 'AI Momentum', shortName: 'AI Momentum',
    category: 'ai', type: 'oscillator', oscType: 'ai_momentum', engineId: 'ai_momentum',
    color: '#A855F7', ai: true,
    description: 'Advanced composite momentum oscillator (−100…+100) in its own sub-pane: RSI + StochRSI-%K + volatility-scaled MACD-hist + ROC blend.',
    badge: 'AI',
    keywords: ['momentum', 'rsi', 'macd', 'stochastic', 'overbought', 'oversold', 'impulse'],
    inputs: ['RSI(14)', 'StochRSI %K', 'MACD histogram / realized-vol', 'ROC(10)'],
    method: 'Each component normalized to −100…+100 then averaged (≥2 required per bar); MACD scaled by realized volatility so crypto and equities share one scale.',
    outputs: ['Momentum oscillator −100…+100', 'BULLISH / BEARISH / NEUTRAL (|score| > 30)'],
    signals: ['ACCELERATING', 'EXHAUSTED', 'NEUTRAL'],
    confidence: 'Agreement across 3+ oscillators = high; single-oscillator extremes alone = low.',
    backtest: 'Momentum persistence works in trends, mean-reverts in ranges — always pair with the Regime label.',
  },
  {
    id: 'ai_breakout', name: 'AI Breakout Detector', shortName: 'AI Breakout',
    category: 'ai', type: 'ai', color: '#FB923C', ai: true, chartOverlay: true,
    aiOverlay: 'markers',
    description: 'Advanced volatility-compression breakouts with volume confirmation: BRK markers on Donchian-20 channel breaks after Bollinger squeeze + ATR expansion.',
    badge: 'AI',
    keywords: ['breakout', 'squeeze', 'donchian', 'bollinger', 'volume spike', 'expansion'],
    inputs: ['Donchian 20-channel', 'Bollinger bandwidth percentile', 'ATR expansion', 'Relative volume', 'Close vs range position'],
    method: 'Flags closes outside the 20-bar channel after bandwidth compression, confirmed by rel-volume and ATR expansion. Markers print live on the price pane.',
    outputs: ['BRK markers (directional)', 'Impulse score −100…+100', 'SQUEEZE vs impulse state'],
    signals: ['BREAKOUT-UP', 'BREAKOUT-DOWN', 'SQUEEZE-WATCH'],
    confidence: 'Volume-confirmed squeezes score highest; low-volume pokes above the channel score lowest.',
    backtest: 'Track false-breakout rate per volatility regime; require a daily-close or retest rule to cut noise.',
  },
  {
    id: 'ai_reversal', name: 'AI Reversal Detector', shortName: 'AI Reversal',
    category: 'ai', type: 'oscillator', oscType: 'ai_exhaustion', engineId: 'ai_exhaustion',
    color: '#F87171', ai: true,
    description: 'Advanced exhaustion oscillator (−100…+100) in its own sub-pane plus EXH markers on the chart: RSI divergence + rejection wicks + ATR overextension.',
    badge: 'AI',
    keywords: ['reversal', 'divergence', 'exhaustion', 'hammer', 'engulfing', 'mean reversion'],
    inputs: ['RSI divergence (30-bar)', 'Wick-to-body ratio', 'Distance from EMA20 in ATR units'],
    method: 'Bullish/bearish pressure scored separately (divergence 40 + OB/OS 25 + wicks 20 + extension 15) and netted; ±60 crosses print EXH markers.',
    outputs: ['Exhaustion oscillator −100…+100', 'EXH markers on extremes', 'BULL-EXH / BEAR-EXH / BALANCED'],
    signals: ['REVERSAL-WATCH-BULL', 'REVERSAL-WATCH-BEAR', 'NO-SIGNAL'],
    confidence: 'Divergence + wick + S/R confluence = high; single-candle patterns alone = low.',
    backtest: 'Counter-trend signals need strict invalidation; measure payoff only with fixed-ATR stops.',
  },
  {
    id: 'ai_regime', name: 'AI Market Regime', shortName: 'AI Regime',
    category: 'ai', type: 'ai', color: '#34D399', ai: true,
    description: 'Classifies the market as TREND / RANGE / BREAKOUT / HIGH-VOL using volatility and chop.',
    badge: 'AI',
    keywords: ['regime', 'trend vs range', 'choppiness', 'volatility', 'chop', 'environment'],
    inputs: ['ADX', 'Choppiness index', 'BB width percentile', 'ATR percentile', 'Directional persistence'],
    method: 'Decision tree on ADX + choppiness + volatility percentiles: high ADX + low chop = TREND; high chop = RANGE; expanding vol = BREAKOUT/HIGH-VOL.',
    outputs: ['Regime label', 'Regime confidence', 'Suggested playbook (trend-follow vs mean-revert vs stand-aside)'],
    signals: ['TREND', 'RANGE', 'BREAKOUT', 'HIGH-VOL'],
    confidence: 'Percentile-ranked inputs make the label adaptive per symbol; mid-zone readings report lower confidence.',
    backtest: 'Gate every other AI signal on regime: trend tools in TREND, fade tools in RANGE, nothing in HIGH-VOL without reduced size.',
  },
  {
    id: 'ai_dashboard', name: 'AI Multi-Timeframe Alignment', shortName: 'AI MTF',
    category: 'ai', type: 'ai', color: '#A78BFA', ai: true,
    description: 'Multi-timeframe signal alignment (intraday → weekly) with per-timeframe probabilities.',
    badge: 'AI',
    keywords: ['multi-timeframe', 'mtf', 'alignment', 'dashboard', 'probabilities', 'higher timeframe'],
    inputs: ['Signal-engine score per timeframe (1m → 1W)', 'Higher-timeframe trend filter', 'Volatility normalization per TF'],
    method: 'Runs the confluence scorer independently per timeframe, then reports stack alignment (e.g. 4/6 TFs bullish) with HTF veto logic.',
    outputs: ['Per-TF bias + probability', 'Alignment gauge (aligned/mixed/conflicted)', 'HTF veto flag'],
    signals: ['ALIGNED-BULL', 'ALIGNED-BEAR', 'MIXED'],
    confidence: 'More aligned timeframes + HTF agreement = higher confidence; mixed stacks are explicitly low-confidence.',
    backtest: 'Aligned stacks historically raise hit-rate but reduce frequency — size on alignment, skip mixed tapes.',
  },
  {
    id: 'ai_pattern', name: 'AI Pattern Recognition', shortName: 'AI Patterns',
    category: 'ai', type: 'ai', color: '#60A5FA', ai: true, chartOverlay: true,
    aiOverlay: 'markers',
    description: 'Advanced classical pattern detection with live chart markers: double tops/bottoms, ascending/descending triangles, bull/bear flags — each with trigger, target and invalidation.',
    badge: 'AI',
    keywords: ['patterns', 'triangle', 'flag', 'pennant', 'head and shoulders', 'double top', 'double bottom', 'wedge'],
    inputs: ['Fractal pivot sequence', 'Trendline slope symmetry', 'Impulse + consolidation shape'],
    method: 'Geometric template matching on pivots; completed patterns print arrows, forming ones print circles with ~ suffix. Max 6 live patterns.',
    outputs: ['Pattern markers on chart', 'Trigger / target / invalidation per pattern', 'Completion %'],
    signals: ['PATTERN-BULL', 'PATTERN-BEAR', 'FORMING'],
    confidence: 'Completed + volume-confirmed patterns score highest; still-forming shapes are flagged FORMING with lower confidence.',
    backtest: 'Only trade completed patterns with volume confirmation; log pattern-specific expectancy (flags ≠ H&S).',
  },
  {
    id: 'ai_forecast', name: 'AI Price Forecast', shortName: 'AI Forecast',
    category: 'ai', type: 'ai', color: '#FBBF24', ai: true, chartOverlay: true,
    aiOverlay: 'bands', engineId: 'ai_forecast',
    description: 'Advanced probabilistic 7-bar path drawn ahead of price: regression drift tilted by AI momentum, ±1σ bands from realized volatility that widen with horizon.',
    badge: 'AI',
    keywords: ['forecast', 'prediction', 'projection', 'target', 'expected move', 'bands'],
    inputs: ['20-bar drift regression', 'AI momentum tilt', 'Realized volatility (log-returns)'],
    method: 'Median path extended past the last bar (epoch grid or business days for daily); band half-width = σ√k. Bands widen honestly — width IS the uncertainty.',
    outputs: ['Median path + upper/lower band lines', 'FORECAST-UP / DOWN / FLAT'],
    signals: ['FORECAST-UP', 'FORECAST-DOWN', 'FORECAST-FLAT'],
    confidence: 'Bands widen honestly with volatility and horizon; wide bands ARE the uncertainty statement — never trade the median alone.',
    backtest: 'Score calibration (how often price stays inside ±1σ) rather than point accuracy; discard horizons where calibration fails.',
  },
  {
    id: 'ai_consensus', name: 'ML Consensus (if trained)', shortName: 'ML Consensus',
    category: 'ai', type: 'ai', color: '#34D399', ai: true,
    description: 'Surfaced separately when a trained ML model exists — ensemble vote with agreement %.',
    badge: 'ML',
    keywords: ['ml', 'machine learning', 'consensus', 'ensemble', 'model', 'trained'],
    inputs: ['Trained model registry (if present)', 'Feature snapshot (indicators + regime)', 'Out-of-sample gate'],
    method: 'Ensemble vote across registered models; hidden entirely when no trained model passes the recency/quality gate.',
    outputs: ['Ensemble direction', 'Agreement %', 'Model count + staleness warning'],
    signals: ['ML-BULL', 'ML-BEAR', 'NO-MODEL'],
    confidence: 'Agreement % across models, discounted by model age; NO-MODEL is itself the honest output when untrained.',
    backtest: 'Only backtest on walk-forward out-of-sample folds; in-sample metrics are not shown.',
  },

  // ── Custom ───────────────────────────────────────────────────────────────────
  {
    id: 'custom', name: 'Custom Indicator Placeholder', shortName: 'Custom',
    category: 'custom', type: 'custom', color: '#CBD5E1',
    description: 'Reserved for user-defined indicator scripts.', badge: 'Custom',
  },
];

export const DEFAULT_ACTIVE_INDICATORS = ['sma_20'];