/**
 * StockOracle Pro — TradingView-parity Indicator Settings Schema
 *
 * Every indicator (all 60+ in indicatorDefinitions.js) gets a full settings
 * panel: Inputs / Style / Visibility — even legacy server-field indicators
 * that have no engine params (SMA 20, EMA 9, RSI, MACD, Bollinger…).
 *
 * Overrides are stored FLAT per indicator id so they stay backward compatible
 * with the existing `indicatorParamOverrides` map:
 *   - plain keys (period, multiplier, …) → engine inputs
 *   - `__`-prefixed keys (__color, __lineWidth, __vis_1m, …) → style/visibility
 * The engine ignores `__` keys (it only validates its own schema), and the
 * chart layers split them out before calculating.
 */

export const INDICATOR_VIS_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1W', '1M'];

export const STYLE_LINE_WIDTHS = [1, 2, 3, 4];
export const STYLE_LINE_STYLES = [
  { id: 0, label: 'Solid' },
  { id: 1, label: 'Dotted' },
  { id: 2, label: 'Dashed' },
];

/**
 * Fallback input schemas for legacy field-based indicators that expose no
 * engineId. Values mirror the catalog defaults (SMA 20 → period 20, …) so the
 * Inputs tab is never empty. Engine-backed indicators use their live engine
 * schema instead (see IndicatorParamsModal).
 */
const FALLBACK_INPUTS = {
  sma_20: [{ key: 'period', label: 'Period', type: 'number', def: 20, min: 1, max: 500 }],
  sma_50: [{ key: 'period', label: 'Period', type: 'number', def: 50, min: 1, max: 500 }],
  sma_100: [{ key: 'period', label: 'Period', type: 'number', def: 100, min: 1, max: 500 }],
  sma_200: [{ key: 'period', label: 'Period', type: 'number', def: 200, min: 1, max: 500 }],
  ema_9: [{ key: 'period', label: 'Period', type: 'number', def: 9, min: 1, max: 500 }],
  ema_21: [{ key: 'period', label: 'Period', type: 'number', def: 21, min: 1, max: 500 }],
  ema_50: [{ key: 'period', label: 'Period', type: 'number', def: 50, min: 1, max: 500 }],
  ema_100: [{ key: 'period', label: 'Period', type: 'number', def: 100, min: 1, max: 500 }],
  ema_200: [{ key: 'period', label: 'Period', type: 'number', def: 200, min: 1, max: 500 }],
  vwap: [{ key: 'source', label: 'Source', type: 'source', def: 'hlc3' }],
  supertrend: [
    { key: 'period', label: 'ATR Period', type: 'number', def: 10, min: 1, max: 500 },
    { key: 'multiplier', label: 'Multiplier', type: 'number', def: 3, min: 0.1, max: 20, step: 0.1 },
  ],
  psar: [
    { key: 'accel_step', label: 'Step', type: 'number', def: 0.02, min: 0.001, max: 0.1, step: 0.001 },
    { key: 'max_accel', label: 'Max', type: 'number', def: 0.2, min: 0.02, max: 1, step: 0.01 },
  ],
  ichimoku: [
    { key: 'tenkan', label: 'Tenkan', type: 'number', def: 9, min: 1, max: 200 },
    { key: 'kijun', label: 'Kijun', type: 'number', def: 26, min: 1, max: 200 },
    { key: 'senkou', label: 'Senkou', type: 'number', def: 52, min: 1, max: 300 },
  ],
  rsi: [{ key: 'period', label: 'Period', type: 'number', def: 14, min: 1, max: 500 }],
  macd: [
    { key: 'fast_period', label: 'Fast', type: 'number', def: 12, min: 1, max: 500 },
    { key: 'slow_period', label: 'Slow', type: 'number', def: 26, min: 1, max: 500 },
    { key: 'signal_period', label: 'Signal', type: 'number', def: 9, min: 1, max: 500 },
  ],
  stoch: [
    { key: 'period', label: '%K Period', type: 'number', def: 14, min: 1, max: 500 },
    { key: 'smoothing', label: '%K Smooth', type: 'number', def: 3, min: 1, max: 100 },
    { key: 'signal_period', label: '%D', type: 'number', def: 3, min: 1, max: 100 },
  ],
  stoch_rsi: [
    { key: 'period', label: 'RSI Period', type: 'number', def: 14, min: 1, max: 500 },
    { key: 'smoothing', label: 'Stoch Period', type: 'number', def: 14, min: 1, max: 500 },
    { key: 'fast_period', label: '%K', type: 'number', def: 3, min: 1, max: 100 },
    { key: 'signal_period', label: '%D', type: 'number', def: 3, min: 1, max: 100 },
  ],
  cci: [{ key: 'period', label: 'Period', type: 'number', def: 20, min: 1, max: 500 }],
  williams_r: [{ key: 'period', label: 'Period', type: 'number', def: 14, min: 1, max: 500 }],
  roc: [{ key: 'period', label: 'Period', type: 'number', def: 10, min: 1, max: 500 }],
  momentum: [{ key: 'period', label: 'Period', type: 'number', def: 10, min: 1, max: 500 }],
  trix: [{ key: 'period', label: 'Period', type: 'number', def: 15, min: 1, max: 500 }],
  adx: [{ key: 'period', label: 'Period', type: 'number', def: 14, min: 1, max: 500 }],
  elder_ray: [{ key: 'period', label: 'Period', type: 'number', def: 13, min: 1, max: 500 }],
  bollinger_bands: [
    { key: 'period', label: 'Period', type: 'number', def: 20, min: 1, max: 500 },
    { key: 'std_dev', label: 'Std Dev', type: 'number', def: 2, min: 0.1, max: 10, step: 0.1 },
  ],
  keltner: [
    { key: 'period', label: 'Period', type: 'number', def: 20, min: 1, max: 500 },
    { key: 'multiplier', label: 'Multiplier', type: 'number', def: 2, min: 0.1, max: 20, step: 0.1 },
  ],
  donchian: [{ key: 'period', label: 'Period', type: 'number', def: 20, min: 1, max: 500 }],
  atr: [{ key: 'period', label: 'Period', type: 'number', def: 14, min: 1, max: 500 }],
  mfi: [{ key: 'period', label: 'Period', type: 'number', def: 14, min: 1, max: 500 }],
  cmf: [{ key: 'period', label: 'Period', type: 'number', def: 20, min: 1, max: 500 }],
  volume_profile: [
    { key: 'rows', label: 'Rows', type: 'number', def: 24, min: 4, max: 200 },
    { key: 'value_area', label: 'Value Area %', type: 'number', def: 70, min: 1, max: 99 },
  ],
  pivot_points: [{ key: 'period', label: 'Lookback', type: 'number', def: 1, min: 1, max: 30 }],
  fibonacci: [{ key: 'period', label: 'Lookback', type: 'number', def: 50, min: 5, max: 500 }],
};

export function getFallbackInputs(indicatorId) {
  return FALLBACK_INPUTS[indicatorId] || null;
}

/**
 * Engine fallback for legacy field-based indicators so Inputs actually
 * recompute (TradingView parity). E.g. SMA 20 with period overridden to 30
 * calculates via the `sma` engine instead of the stale server `sma_20` field.
 */
const ENGINE_FALLBACK = {
  sma_20: 'sma', sma_50: 'sma', sma_100: 'sma', sma_200: 'sma',
  ema_9: 'ema', ema_21: 'ema', ema_50: 'ema', ema_100: 'ema', ema_200: 'ema',
  rsi: 'rsi', macd: 'macd', stoch: 'stoch', stoch_rsi: 'stoch_rsi',
  cci: 'cci', williams_r: 'williams_r', roc: 'roc', momentum: 'momentum',
  trix: 'trix', adx: 'adx', bollinger_bands: 'bollinger_bands',
  keltner: 'keltner', donchian: 'donchian', atr: 'atr',
  hist_vol: 'hist_vol', std_dev: 'std_dev', bb_width: 'bb_width',
  choppiness: 'choppiness', mfi: 'mfi', obv: 'obv', cmf: 'cmf',
  rel_volume: 'rel_volume', volume_delta: 'volume_delta', cvd: 'cvd',
  supertrend: 'supertrend', psar: 'psar', vwap: 'vwap',
};

export function getEngineFallbackId(indicatorId) {
  return ENGINE_FALLBACK[indicatorId] || null;
}

/** Split flat overrides into { inputs, style, visibility }. */
export function splitIndicatorOverrides(overrides = {}) {
  const inputs = {};
  const style = {};
  const visibility = { intervals: null };
  const visIntervals = [];
  for (const [k, v] of Object.entries(overrides || {})) {
    if (k === '__color') style.color = v;
    else if (k === '__lineWidth') style.lineWidth = v;
    else if (k === '__lineStyle') style.lineStyle = v;
    else if (k.startsWith('__sub_')) style[k] = v;
    else if (k.startsWith('__vis_')) {
      const iv = k.slice('__vis_'.length);
      if (v === false) visIntervals.push(iv);
    } else {
      inputs[k] = v;
    }
  }
  if (visIntervals.length) visibility.intervals = visIntervals; // hidden on these
  return { inputs, style, visibility };
}

/** Merge style back into a catalog definition for rendering. */
export function applyStyleToDefinition(def, overrides = {}) {
  const { style } = splitIndicatorOverrides(overrides);
  if (!Object.keys(style).length) return def;
  const next = { ...def };
  if (style.color) next.color = style.color;
  if (style.lineWidth != null) next.lineWidth = style.lineWidth;
  if (style.lineStyle != null) next.lineStyle = style.lineStyle;
  // Per-subline colors: __sub_{index}_color
  if (next.subLines) {
    next.subLines = next.subLines.map((sub, i) => {
      const c = style[`__sub_${i}_color`];
      return c ? { ...sub, color: c } : sub;
    });
  }
  if (next.levels) {
    next.levels = next.levels.map((lvl, i) => {
      const c = style[`__sub_${i}_color`];
      return c ? { ...lvl, color: c } : lvl;
    });
  }
  return next;
}

/**
 * TradingView Visibility tab check — hidden on intervals listed via
 * `__vis_{interval} === false`.
 */
export function isIndicatorVisibleOn(overrides = {}, interval) {
  if (!overrides) return true;
  const key = `__vis_${String(interval || '').toLowerCase()}`;
  // Also check case variants (1W vs 1w, 1D vs 1d)
  for (const [k, v] of Object.entries(overrides)) {
    if (k.toLowerCase() === key.toLowerCase() && v === false) return false;
  }
  return true;
}
