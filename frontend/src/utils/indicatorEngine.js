/**
 * StockOracle Pro — Modular Indicator Engine (spec §20)
 *
 * A single registry of indicators, each implementing:
 *   - metadata (id, name, category, description)
 *   - parameter schema (with defaults + validation)
 *   - calculate(candles, params) → series data
 *   - signal(values, params)   → { direction, strength, reason }  (rule-based)
 *   - render()                 → lightweight-charts descriptor
 *
 * Designed for incremental live-tick recompute (spec §16) and full
 * streaming history recalculation without dropping candles.
 *
 * Render contract:
 *   calculate() returns plain { time, value } points (or {time}=>multi arrays)
 *   which the chart layer maps onto Lightweight Charts series. The catalog in
 *   `indicatorDefinitions.js` holds the visual/presentation metadata (color,
 *   field names, pane placement); this engine holds the MATH.
 */

import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  calculateALMA,
  calculateVWAP,
  calculateSupertrend,
  calculateStochRSI,
  calculateCMF,
  calculateElderRay,
  calculatePSAR,
  calculateADX,
} from './chartIndicators.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Parameter Schema
// ─────────────────────────────────────────────────────────────────────────────

export const PARAM_KINDS = {
  PERIOD: 'period',
  SOURCE: 'source',
  MULTIPLIER: 'multiplier',
  OFFSET: 'offset',
  SIGNAL_PERIOD: 'signal_period',
  STANDARD_DEVIATION: 'std_dev',
  MAX_ACCELERATION: 'max_acceleration',
  ACCELERATION_STEP: 'acceleration_step',
  ANCHOR: 'anchor',
  SMOOTHING: 'smoothing',
  FAST_PERIOD: 'fast_period',
  SLOW_PERIOD: 'slow_period',
  ANNUALIZATION: 'annualization',
};

export const SOURCES = ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'];

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

/**
 * Parameter schema factory. Every parameter describes:
 *  - kind: semantic role (period, source, multiplier, ...)
 *  - default: fallback value
 *  - validate: (value) => { valid: boolean, message?: string }
 *  - min/max/step: numeric constraints (auto-validated)
 */
export function createParameter(kind, label, { defaultValue, min, max, step, integer = false, options, description = '' } = {}) {
  const validate = (value) => {
    // Option-based (categorical/string) parameters validate membership directly.
    if (options) {
      if (value == null || value === '') {
        return { valid: false, message: `${label} is required` };
      }
      if (!options.includes(String(value)) && !options.includes(value)) {
        return { valid: false, message: `${label} must be one of: ${options.join(', ')}` };
      }
      return { valid: true };
    }
    const v = Number(value);
    if (value == null || value === '' || isNaN(v)) {
      return { valid: false, message: `${label} is required` };
    }
    if (min != null && v < min) return { valid: false, message: `${label} must be ≥ ${min}` };
    if (max != null && v > max) return { valid: false, message: `${label} must be ≤ ${max}` };
    if (integer && !Number.isInteger(v)) return { valid: false, message: `${label} must be a whole number` };
    return { valid: true };
  };

  return {
    kind,
    label,
    default: defaultValue,
    min,
    max,
    step,
    integer,
    options,
    description,
    validate,
    // Apply constraint clamping but preserve caller-supplied valid values verbatim.
    coerce: (value) => {
      if (options) return String(value);
      let v = Number(value);
      if (integer) v = Math.round(v);
      if (min != null) v = clamp(v, min, max ?? min);
      if (max != null) v = clamp(v, min ?? max, max);
      return v;
    },
  };
}

export function validateParameters(parameters, values) {
  const errors = {};
  const coerced = {};
  for (const [key, param] of Object.entries(parameters || {})) {
    const raw = values?.[key] ?? param.default;
    const { valid, message } = param.validate(raw);
    if (!valid) {
      errors[key] = message;
      coerced[key] = param.default;
    } else {
      coerced[key] = param.coerce(raw);
    }
  }
  return { valid: Object.keys(errors).length === 0, errors, values: coerced };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Generic Series Math Helpers
// ─────────────────────────────────────────────────────────────────────────────

const num = (v) => {
  const n = Number(v);
  return isNaN(n) ? null : n;
};

function sourceValue(candle, source) {
  if (!candle) return null;
  switch (source) {
    case 'open': return num(candle.open);
    case 'high': return num(candle.high);
    case 'low': return num(candle.low);
    case 'hl2': {
      const h = num(candle.high); const l = num(candle.low);
      return h == null || l == null ? null : (h + l) / 2;
    }
    case 'hlc3': {
      const h = num(candle.high); const l = num(candle.low); const c = num(candle.close);
      return h == null || l == null || c == null ? null : (h + l + c) / 3;
    }
    case 'ohlc4': {
      const o = num(candle.open); const h = num(candle.high); const l = num(candle.low); const c = num(candle.close);
      return o == null || h == null || l == null || c == null ? null : (o + h + l + c) / 4;
    }
    case 'close':
    default: return num(candle.close);
  }
}

function rolling(source, period, reduce, initial = null) {
  const out = [];
  for (let i = 0; i < source.length; i++) {
    const start = Math.max(0, i - period + 1);
    const window = source.slice(start, i + 1);
    out.push(reduce(window, i - start + 1));
  }
  return out;
}

const trueRange = (candles, i, trCache = null) => {
  if (trCache && trCache[i] != null) return trCache[i];
  const h = num(candles[i].high);
  const l = num(candles[i].low);
  const pc = i > 0 ? num(candles[i - 1].close) : null;
  if (h == null || l == null) return 0;
  const hl = h - l;
  const hc = pc == null ? hl : Math.abs(h - pc);
  const lc = pc == null ? hl : Math.abs(l - pc);
  return Math.max(hl, hc, lc);
};

function wilderSmooth(values, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < period && i < values.length; i++) sum += values[i];
  out.push(sum / period);
  for (let i = period; i < values.length; i++) {
    out.push((out[out.length - 1] * (period - 1) + values[i]) / period);
  }
  return out;
}

function seriesToPoints(timeSeries, values, digits = 2) {
  return timeSeries.map((t, i) => ({ time: t, value: Number(Number(values[i] ?? 0).toFixed(digits)) }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Calculation Functions
// ─────────────────────────────────────────────────────────────────────────────

// Trend ────────────────────────────────────────────────────────────────────────
export function calculateWMA(candles, period = 20, source = 'close') {
  if (!candles?.length) return [];
  const vals = candles.map((c) => sourceValue(c, source));
  const out = [];
  for (let i = 0; i < candles.length; i++) {
    const start = Math.max(0, i - period + 1);
    let weighted = 0; let weightSum = 0;
    for (let j = start; j <= i; j++) {
      const w = (j - start) + 1;
      if (vals[j] != null) { weighted += vals[j] * w; weightSum += w; }
    }
    if (weightSum === 0) { out.push(null); continue; }
    out.push(weighted / weightSum);
  }
  return seriesToPoints(candles.map((c) => c.time), out);
}

export function calculateHMA(candles, period = 20, source = 'close') {
  if (!candles?.length) return [];
  const halfLen = Math.max(1, Math.floor(period / 2));
  const sqrtLen = Math.max(1, Math.round(Math.sqrt(period)));
  const wmaHalf = calculateWMA(candles, halfLen, source);
  const wmaFull = calculateWMA(candles, period, source);
  const rawVals = wmaFull.map((p, i) => {
    const h = wmaHalf[i]?.value;
    const f = p.value;
    return h == null || f == null ? null : 2 * h - f;
  });
  const filled = rawVals.map((v) => v ?? 0);
  const hull = rolling(filled, sqrtLen, (win) => {
    const sum = win.reduce((a, b) => a + b, 0);
    return sum / win.length;
  });
  return candles.map((c, i) => {
    const v = rawVals[i] == null ? null : hull[i];
    return { time: c.time, value: v == null ? null : Number(v.toFixed(2)) };
  });
}

export function calculateKAMA(candles, period = 10, fastPeriod = 2, slowPeriod = 30, source = 'close') {
  if (!candles?.length) return [];
  const vals = candles.map((c) => sourceValue(c, source));
  const out = [];
  let kama = vals[0] ?? 0;
  const fast = 2 / (fastPeriod + 1);
  const slow = 2 / (slowPeriod + 1);
  out.push(kama);
  let changeSum = 0;
  for (let i = 1; i < candles.length; i++) {
    const change = Math.abs((vals[i] ?? 0) - (vals[Math.max(0, i - period)] ?? 0));
    if (i >= period) {
      changeSum -= Math.abs((vals[i - period] ?? 0) - (vals[Math.max(0, i - period - 1)] ?? 0));
    }
    changeSum += Math.abs((vals[i] ?? 0) - (vals[i - 1] ?? 0));
    let er = 1;
    if (changeSum > 0) er = change / changeSum;
    const sc = Math.pow(er * (fast - slow) + slow, 2);
    kama = kama + sc * ((vals[i] ?? kama) - kama);
    out.push(kama);
  }
  return candles.map((c, i) => ({ time: c.time, value: Number(out[i].toFixed(2)) }));
}

export function calculateAnchoredVWAP(candles, anchor = 0, source = 'hlc3') {
  if (!candles?.length) return [];
  const start = Math.max(0, Math.min(candles.length - 1, Math.round(anchor)));
  const out = [];
  let cumVol = 0;
  let cumPV = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i < start) { out.push(null); continue; }
    const vol = num(c.volume) || 0;
    const px = sourceValue(c, source);
    cumVol += vol;
    cumPV += (px ?? 0) * vol;
    out.push(cumVol > 0 ? cumPV / cumVol : null);
  }
  return candles.map((c, i) => ({ time: c.time, value: out[i] == null ? null : Number(out[i].toFixed(2)) }));
}

export function calculateDonchian(candles, period = 20) {
  if (!candles?.length) return { upper: [], middle: [], lower: [] };
  const highs = candles.map((c) => num(c.high));
  const lows = candles.map((c) => num(c.low));
  const upper = [];
  const lower = [];
  for (let i = 0; i < candles.length; i++) {
    const start = Math.max(0, i - period + 1);
    const hWin = highs.slice(start, i + 1).filter((v) => v != null);
    const lWin = lows.slice(start, i + 1).filter((v) => v != null);
    const hi = hWin.length ? Math.max(...hWin) : null;
    const lo = lWin.length ? Math.min(...lWin) : null;
    upper.push(hi); lower.push(lo);
  }
  const middle = upper.map((v, i) => (v != null && lower[i] != null ? (v + lower[i]) / 2 : null));
  return {
    upper: candles.map((c, i) => ({ time: c.time, value: upper[i] == null ? null : Number(upper[i].toFixed(2)) })),
    middle: candles.map((c, i) => ({ time: c.time, value: middle[i] == null ? null : Number(middle[i].toFixed(2)) })),
    lower: candles.map((c, i) => ({ time: c.time, value: lower[i] == null ? null : Number(lower[i].toFixed(2)) })),
  };
}

// Momentum ─────────────────────────────────────────────────────────────────────
export function calculateStoch(candles, period = 14, smoothK = 3, periodD = 3) {
  if (!candles?.length) return { k: [], d: [] };
  const rawK = [];
  for (let i = 0; i < candles.length; i++) {
    const start = Math.max(0, i - period + 1);
    const win = candles.slice(start, i + 1);
    const highs = win.map((c) => num(c.high)).filter((v) => v != null);
    const lows = win.map((c) => num(c.low)).filter((v) => v != null);
    const close = num(candles[i].close);
    if (!highs.length || !lows.length || close == null) { rawK.push(null); continue; }
    const hi = Math.max(...highs); const lo = Math.min(...lows);
    rawK.push(hi === lo ? 50 : ((close - lo) / (hi - lo)) * 100);
  }
  const kSm = rolling(rawK.map((v) => v ?? 0), smoothK, (win) => win.reduce((a, b) => a + b, 0) / win.length);
  const d = rolling(kSm, periodD, (win) => win.reduce((a, b) => a + b, 0) / win.length);
  return {
    k: candles.map((c, i) => ({ time: c.time, value: Number(kSm[i].toFixed(2)) })),
    d: candles.map((c, i) => ({ time: c.time, value: Number(d[i].toFixed(2)) })),
  };
}

export function calculateCCI(candles, period = 20) {
  if (!candles?.length) return [];
  const tp = candles.map((c) => sourceValue(c, 'hlc3') ?? 0);
  const sma = rolling(tp, period, (win) => win.reduce((a, b) => a + b, 0) / win.length);
  const points = candles.map((c, i) => {
    const start = Math.max(0, i - period + 1);
    const win = tp.slice(start, i + 1);
    const mean = sma[i];
    let md = 0;
    for (let j = 0; j < win.length; j++) md += Math.abs(win[j] - mean);
    md /= win.length;
    return { time: c.time, value: md === 0 ? 0 : Number(((tp[i] - mean) / (0.015 * md)).toFixed(2)) };
  });
  return points;
}

export function calculateWilliamsR(candles, period = 14) {
  if (!candles?.length) return [];
  return candles.map((c, i) => {
    const start = Math.max(0, i - period + 1);
    const win = candles.slice(start, i + 1);
    const highs = win.map((x) => num(x.high)).filter((v) => v != null);
    const lows = win.map((x) => num(x.low)).filter((v) => v != null);
    const close = num(c.close);
    if (!highs.length || !lows.length || close == null) return { time: c.time, value: null };
    const hi = Math.max(...highs); const lo = Math.min(...lows);
    return { time: c.time, value: Number((hi === lo ? -50 : 0 - ((hi - close) / (hi - lo)) * 100).toFixed(2)) };
  });
}

export function calculateROC(candles, period = 10, source = 'close') {
  if (!candles?.length) return [];
  const vals = candles.map((c) => sourceValue(c, source) ?? 0);
  return candles.map((c, i) => {
    const prev = i >= period ? vals[i - period] : null;
    if (prev == null || prev === 0) return { time: c.time, value: null };
    return { time: c.time, value: Number((((vals[i] - prev) / prev) * 100).toFixed(2)) };
  });
}

export function calculateMomentum(candles, period = 10, source = 'close') {
  if (!candles?.length) return [];
  const vals = candles.map((c) => sourceValue(c, source) ?? 0);
  return candles.map((c, i) => {
    const prev = i >= period ? vals[i - period] : null;
    if (prev == null) return { time: c.time, value: null };
    return { time: c.time, value: Number((vals[i] - prev).toFixed(2)) };
  });
}

export function calculateTRIX(candles, period = 15) {
  if (!candles?.length) return [];
  const closes = candles.map((c) => num(c.close) ?? 0);
  const ema1 = rollingSeries(closes, period);
  const ema2 = rollingSeries(ema1, period);
  const ema3 = rollingSeries(ema2, period);
  return candles.map((c, i) => {
    const prev = i > 0 ? ema3[i - 1] : ema3[i];
    if (prev == null || ema3[i] == null || prev === 0) return { time: c.time, value: null };
    return { time: c.time, value: Number((((ema3[i] - prev) / prev) * 100).toFixed(4)) };
  });
}

function rollingSeries(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let ema = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? 0;
    if (ema == null) {
      // SMA seed over the first available `period` points
      const start = Math.max(0, i - period + 1);
      const win = values.slice(start, i + 1).filter((x) => x != null);
      if (i >= period - 1) ema = win.reduce((a, b) => a + b, 0) / win.length;
      out.push(ema);
    } else {
      ema = v * k + ema * (1 - k);
      out.push(ema);
    }
  }
  return out;
}

// Volatility ───────────────────────────────────────────────────────────────────
export function calculateATR(candles, period = 14) {
  if (!candles?.length) return [];
  const tr = candles.map((_, i) => trueRange(candles, i));
  const smoothed = wilderSmooth(tr, period);
  return candles.map((c, i) => {
    const v = i >= period - 1 ? smoothed[i - (period - 1)] : null;
    return { time: c.time, value: v == null ? null : Number(v.toFixed(2)) };
  });
}

export function calculateKeltner(candles, period = 20, multiplier = 2) {
  if (!candles?.length) return { upper: [], middle: [], lower: [] };
  const ema = calculateEMA(candles, period);
  const atr = calculateATR(candles, period);
  const atrMap = new Map(atr.map((p) => [p.time, p.value]));
  return {
    upper: ema.map((p) => { const a = atrMap.get(p.time); return { time: p.time, value: a == null ? null : Number((p.value + multiplier * a).toFixed(2)) }; }),
    middle: ema.map((p) => ({ time: p.time, value: p.value })),
    lower: ema.map((p) => { const a = atrMap.get(p.time); return { time: p.time, value: a == null ? null : Number((p.value - multiplier * a).toFixed(2)) }; }),
  };
}

export function calculateStdDev(candles, period = 20, source = 'close') {
  if (!candles?.length) return [];
  const vals = candles.map((c) => sourceValue(c, source) ?? 0);
  return candles.map((c, i) => {
    const start = Math.max(0, i - period + 1);
    const win = vals.slice(start, i + 1);
    const mean = win.reduce((a, b) => a + b, 0) / win.length;
    const variance = win.reduce((a, b) => a + (b - mean) * (b - mean), 0) / win.length;
    return { time: c.time, value: Number(Math.sqrt(variance).toFixed(2)) };
  });
}

export function calculateHistoricalVolatility(candles, period = 20, annualization = 252) {
  if (!candles?.length) return [];
  const rets = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = num(candles[i - 1].close); const cur = num(candles[i].close);
    rets.push(prev && prev > 0 ? Math.log(cur / prev) : 0);
  }
  return candles.map((c, i) => {
    if (i < 1) return { time: c.time, value: null };
    const start = Math.max(0, i - period);
    const win = rets.slice(start, i);
    const mean = win.reduce((a, b) => a + b, 0) / win.length;
    const variance = win.reduce((a, b) => a + (b - mean) * (b - mean), 0) / win.length;
    return { time: c.time, value: Number((Math.sqrt(variance) * Math.sqrt(annualization) * 100).toFixed(2)) };
  });
}

export function calculateBBWidth(candles, period = 20, stdDev = 2) {
  const bb = calculateBollingerBands(candles, period, stdDev);
  const upperMap = new Map(bb.upper.map((p) => [p.time, p.value]));
  const lowerMap = new Map(bb.lower.map((p) => [p.time, p.value]));
  return bb.middle.map((p) => {
    const u = upperMap.get(p.time); const l = lowerMap.get(p.time);
    return { time: p.time, value: u == null || l == null || p.value === 0 ? null : Number((((u - l) / p.value) * 100).toFixed(2)) };
  });
}

export function calculateChoppiness(candles, period = 14) {
  if (!candles?.length) return [];
  return candles.map((c, i) => {
    const start = Math.max(0, i - period + 1);
    const win = candles.slice(start, i + 1);
    const highs = win.map((x) => num(x.high)).filter((v) => v != null);
    const lows = win.map((x) => num(x.low)).filter((v) => v != null);
    if (!highs.length) return { time: c.time, value: null };
    const hi = Math.max(...highs); const lo = Math.min(...lows);
    const rng = hi - lo;
    if (rng === 0) return { time: c.time, value: 50 };
    let trSum = 0;
    for (let j = 1; j < win.length; j++) trSum += trueRange(candles, start + j);
    if (trSum === 0) return { time: c.time, value: 50 };
    // CHOP = 100 * log10(ΣTR(n) / (MaxHigh(n) − MinLow(n))) / log10(n)
    const ratio = trSum / rng;
    const choppy = (100 * Math.log10(ratio)) / Math.log10(period);
    return { time: c.time, value: Number(clamp(choppy, 0, 100).toFixed(2)) };
  });
}

// Volume ───────────────────────────────────────────────────────────────────────
export function calculateOBV(candles) {
  if (!candles?.length) return [];
  let obv = 0;
  return candles.map((c, i) => {
    if (i === 0) return { time: c.time, value: 0 };
    const close = num(c.close); const prev = num(candles[i - 1].close); const vol = num(c.volume) || 0;
    if (close > prev) obv += vol;
    else if (close < prev) obv -= vol;
    return { time: c.time, value: Number(obv.toFixed(0)) };
  });
}

export function calculateMFI(candles, period = 14) {
  if (!candles?.length) return [];
  const tp = candles.map((c) => sourceValue(c, 'hlc3') ?? 0);
  const mf = tp.map((v, i) => v * (num(candles[i].volume) || 0));
  return candles.map((c, i) => {
    const start = Math.max(0, i - period + 1);
    let pos = 0; let neg = 0;
    for (let j = start; j <= i; j++) {
      const diff = j > 0 ? tp[j] - tp[j - 1] : 0;
      if (diff >= 0) pos += mf[j]; else neg += mf[j];
    }
    if (pos + neg === 0) return { time: c.time, value: 50 };
    return { time: c.time, value: Number((100 - 100 / (1 + pos / (neg === 0 ? 0.0001 : neg))).toFixed(2)) };
  });
}

export function calculateRelativeVolume(candles, period = 20) {
  if (!candles?.length) return [];
  const vols = candles.map((c) => num(c.volume) || 0);
  const avg = rolling(vols, period, (win) => win.reduce((a, b) => a + b, 0) / win.length);
  return candles.map((c, i) => ({ time: c.time, value: avg[i] === 0 ? null : Number((vols[i] / avg[i]).toFixed(2)) }));
}

// Estimated order-flow (clearly labeled *estimated* vs real order flow)
export function calculateVolumeDelta(candles) {
  if (!candles?.length) return [];
  return candles.map((c) => {
    const cl = num(c.close); const v = num(c.volume) || 0;
    const range = num(c.high) - num(c.low);
    // Close-position heuristic: fraction of the bar attributed to buying.
    const buyRatio = !range || range === 0 ? 0.5 : clamp((cl - num(c.low)) / range, 0, 1);
    return { time: c.time, value: Number((v * (buyRatio * 2 - 1)).toFixed(0)) };
  });
}

export function calculateCVD(candles) {
  if (!candles?.length) return [];
  const delta = calculateVolumeDelta(candles);
  let cvd = 0;
  return candles.map((c, i) => {
    cvd += delta[i]?.value ?? 0;
    return { time: c.time, value: Number(cvd.toFixed(0)) };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Incremental Recompute (spec §16)
// ─────────────────────────────────────────────────────────────────────────────
//
// For a live tick that mutates only the last candle, we avoid recomputing the
// full history. `recomputeLastBar` marks which indicators support this and
// returns the updated last point(s) for the final candle.
//
// Contract: functions below accept (candles, params) and return the last
// series point(s) for the final candle. If an indicator requires the full
// history to be recomputed (e.g. anchored VWAP with anchor=0 is fine, but
// KAMA/EMA are path-dependent yet cheap), fall back to full recompute.
// ─────────────────────────────────────────────────────────────────────────────

const LAST_BAR_RECOMPUTERS = {
  sma: (candles, p) => ({ main: calculateSMA(candles, p.period).at(-1) }),
  ema: (candles, p) => ({ main: calculateEMA(candles, p.period).at(-1) }),
  wma: (candles, p) => ({ main: calculateWMA(candles, p.period, p.source).at(-1) }),
  hma: (candles, p) => ({ main: calculateHMA(candles, p.period, p.source).at(-1) }),
  kama: (candles, p) => ({ main: calculateKAMA(candles, p.period, p.fast_period, p.slow_period, p.source).at(-1) }),
  alma: (candles, p) => ({ main: calculateALMA(candles, p.period, p.offset, p.smoothing).at(-1) }),
  anchored_vwap: (candles, p) => ({ main: calculateAnchoredVWAP(candles, p.anchor, p.source).at(-1) }),
  donchian: (candles, p) => {
    const d = calculateDonchian(candles, p.period);
    return { upper: d.upper.at(-1), middle: d.middle.at(-1), lower: d.lower.at(-1) };
  },
  roc: (candles, p) => ({ main: calculateROC(candles, p.period, p.source).at(-1) }),
  momentum: (candles, p) => ({ main: calculateMomentum(candles, p.period, p.source).at(-1) }),
  atr: (candles, p) => ({ main: calculateATR(candles, p.period).at(-1) }),
  std_dev: (candles, p) => ({ main: calculateStdDev(candles, p.period, p.source).at(-1) }),
  bb_width: (candles, p) => ({ main: calculateBBWidth(candles, p.period, p.std_dev).at(-1) }),
  choppiness: (candles, p) => ({ main: calculateChoppiness(candles, p.period).at(-1) }),
  rel_volume: (candles, p) => ({ main: calculateRelativeVolume(candles, p.period).at(-1) }),
  obv: (candles) => ({ main: calculateOBV(candles).at(-1) }),
  volume_delta: (candles) => ({ main: calculateVolumeDelta(candles).at(-1) }),
  cvd: (candles) => ({ main: calculateCVD(candles).at(-1) }),
};

/**
 * Recompute only the final candle for live ticks. Returns a map of series key
 * → last point, or `null` when the indicator needs a full-recompute fallback.
 *
 * @param {string} id indicator id
 * @param {Array} candles full candle list (mutated last item is current)
 * @param {object} params resolved parameters
 */
export function recomputeLastBar(id, candles, params = {}) {
  const fn = LAST_BAR_RECOMPUTERS[id];
  if (!fn || !candles?.length) return null;
  try {
    return fn(candles, params);
  } catch {
    return null;
  }
}

export function supportsIncremental(id) {
  return Boolean(LAST_BAR_RECOMPUTERS[id]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Indicator Registry (spec §20)
// ─────────────────────────────────────────────────────────────────────────────

export class Indicator {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.shortName = config.shortName || config.name;
    this.category = config.category;
    this.description = config.description || '';
    this.badge = config.badge || config.category;
    this.parameters = config.parameters || {};
    this.calculate = config.calculate;
    this.signal = config.signal;
    this.render = config.render;
    this.incremental = config.incremental ?? supportsIncremental(config.id);
  }

  getParameters(values) {
    return validateParameters(this.parameters, values);
  }

  run(candles, values) {
    const params = this.getParameters(values).values;
    return this.calculate(candles, params);
  }
}

const sig = {
  buy: { direction: 'buy', label: 'BUY', color: '#10B981' },
  sell: { direction: 'sell', label: 'SELL', color: '#EF5350' },
  neutral: { direction: 'neutral', label: 'NEUTRAL', color: '#F59E0B' },
};

// Registry definition (engine math only; visual metadata lives in indicatorDefinitions)
const registry = [
  // Trend
  { id: 'sma', kind: 'trend', name: 'Simple Moving Average', calc: (c, p) => calculateSMA(c, p.period) },
  { id: 'ema', kind: 'trend', name: 'Exponential Moving Average', calc: (c, p) => calculateEMA(c, p.period) },
  { id: 'wma', kind: 'trend', name: 'Weighted Moving Average', calc: (c, p) => calculateWMA(c, p.period, p.source), incremental: true },
  { id: 'hma', kind: 'trend', name: 'Hull Moving Average', calc: (c, p) => calculateHMA(c, p.period, p.source), incremental: true },
  { id: 'kama', kind: 'trend', name: 'Kaufman Adaptive Moving Average', calc: (c, p) => calculateKAMA(c, p.period, p.fast_period, p.slow_period, p.source), incremental: true },
  { id: 'alma', kind: 'trend', name: 'Arnaud Legoux Moving Average', calc: (c, p) => calculateALMA(c, p.period, p.offset, p.smoothing), incremental: true },
  { id: 'anchored_vwap', kind: 'trend', name: 'Anchored VWAP', calc: (c, p) => calculateAnchoredVWAP(c, p.anchor, p.source), incremental: true },
  { id: 'donchian', kind: 'trend', name: 'Donchian Channels', calc: (c, p) => calculateDonchian(c, p.period), incremental: true },
  { id: 'vwap', kind: 'trend', name: 'Volume Weighted Average Price', calc: (c) => calculateVWAP(c) },
  { id: 'supertrend', kind: 'trend', name: 'Supertrend', calc: (c, p) => calculateSupertrend(c, p.period, p.multiplier) },
  { id: 'psar', kind: 'trend', name: 'Parabolic SAR', calc: (c, p) => calculatePSAR(c, p.accel_step, p.accel_step, p.max_accel) },

  // Momentum
  { id: 'rsi', kind: 'momentum', name: 'Relative Strength Index', calc: (c, p) => calculateRSI(c, p.period) },
  { id: 'macd', kind: 'momentum', name: 'Moving Average Convergence Divergence', calc: (c, p) => calculateMACD(c, p.fast_period, p.slow_period, p.signal_period) },
  { id: 'stoch', kind: 'momentum', name: 'Stochastic Oscillator', calc: (c, p) => calculateStoch(c, p.period, p.smoothing, p.signal_period) },
  { id: 'stoch_rsi', kind: 'momentum', name: 'Stochastic RSI', calc: (c, p) => calculateStochRSI(c, p.period, p.smoothing, p.fast_period, p.signal_period) },
  { id: 'cci', kind: 'momentum', name: 'Commodity Channel Index', calc: (c, p) => calculateCCI(c, p.period) },
  { id: 'williams_r', kind: 'momentum', name: 'Williams %R', calc: (c, p) => calculateWilliamsR(c, p.period) },
  { id: 'roc', kind: 'momentum', name: 'Rate of Change', calc: (c, p) => calculateROC(c, p.period, p.source), incremental: true },
  { id: 'momentum', kind: 'momentum', name: 'Momentum', calc: (c, p) => calculateMomentum(c, p.period, p.source), incremental: true },
  { id: 'trix', kind: 'momentum', name: 'Triple Exponential Average', calc: (c, p) => calculateTRIX(c, p.period) },
  { id: 'adx', kind: 'momentum', name: 'Average Directional Index', calc: (c, p) => calculateADX(c, p.period) },

  // Volatility
  { id: 'bollinger_bands', kind: 'volatility', name: 'Bollinger Bands', calc: (c, p) => calculateBollingerBands(c, p.period, p.std_dev) },
  { id: 'keltner', kind: 'volatility', name: 'Keltner Channels', calc: (c, p) => calculateKeltner(c, p.period, p.multiplier) },
  { id: 'atr', kind: 'volatility', name: 'Average True Range', calc: (c, p) => calculateATR(c, p.period), incremental: true },
  { id: 'hist_vol', kind: 'volatility', name: 'Historical Volatility', calc: (c, p) => calculateHistoricalVolatility(c, p.period, p.annualization) },
  { id: 'std_dev', kind: 'volatility', name: 'Standard Deviation', calc: (c, p) => calculateStdDev(c, p.period, p.source), incremental: true },
  { id: 'bb_width', kind: 'volatility', name: 'Bollinger Band Width', calc: (c, p) => calculateBBWidth(c, p.period, p.std_dev), incremental: true },
  { id: 'choppiness', kind: 'volatility', name: 'Choppiness Index', calc: (c, p) => calculateChoppiness(c, p.period), incremental: true },

  // Volume
  { id: 'rel_volume', kind: 'volume', name: 'Relative Volume', calc: (c, p) => calculateRelativeVolume(c, p.period), incremental: true },
  { id: 'obv', kind: 'volume', name: 'On-Balance Volume', calc: (c) => calculateOBV(c), incremental: true },
  { id: 'mfi', kind: 'volume', name: 'Money Flow Index', calc: (c, p) => calculateMFI(c, p.period) },
  { id: 'cmf', kind: 'volume', name: 'Chaikin Money Flow', calc: (c, p) => calculateCMF(c, p.period) },
  { id: 'volume_delta', kind: 'volume', name: 'Volume Delta (estimated)', incremental: true, calc: (c) => calculateVolumeDelta(c) },
  { id: 'cvd', kind: 'volume', name: 'Cumulative Volume Delta (estimated)', incremental: true, calc: (c) => calculateCVD(c) },
];

function buildParameters(id) {
  switch (id) {
    case 'wma': case 'hma':
      return { period: createParameter('period', 'Period', { defaultValue: 20, min: 1, max: 500, step: 1, integer: true }), source: createParameter('source', 'Source', { defaultValue: 'close', options: SOURCES }) };
    case 'kama':
      return { period: createParameter('period', 'Period', { defaultValue: 10, min: 1, max: 500, step: 1, integer: true }), fast_period: createParameter('fast_period', 'Fast Period', { defaultValue: 2, min: 1, max: 100, step: 1, integer: true }), slow_period: createParameter('slow_period', 'Slow Period', { defaultValue: 30, min: 1, max: 500, step: 1, integer: true }), source: createParameter('source', 'Source', { defaultValue: 'close', options: SOURCES }) };
    case 'alma':
      return { period: createParameter('period', 'Period', { defaultValue: 9, min: 1, max: 500, step: 1, integer: true }), offset: createParameter('offset', 'Offset', { defaultValue: 0.85, min: 0.01, max: 1, step: 0.01 }), smoothing: createParameter('smoothing', 'Sigma', { defaultValue: 6, min: 0.1, max: 50, step: 0.1 }) };
    case 'anchored_vwap':
      return { anchor: createParameter('anchor', 'Anchor Index', { defaultValue: 0, min: 0, max: 10000, step: 1, integer: true }), source: createParameter('source', 'Source', { defaultValue: 'hlc3', options: SOURCES }) };
    case 'donchian': return { period: createParameter('period', 'Period', { defaultValue: 20, min: 1, max: 500, step: 1, integer: true }) };
    case 'vwap': return { source: createParameter('source', 'Source', { defaultValue: 'hlc3', options: SOURCES }) };
    case 'supertrend': return { period: createParameter('period', 'Period', { defaultValue: 10, min: 1, max: 500, step: 1, integer: true }), multiplier: createParameter('multiplier', 'Multiplier', { defaultValue: 3, min: 0.1, max: 20, step: 0.1 }) };
    case 'psar': return { accel_step: createParameter('accel_step', 'Step', { defaultValue: 0.02, min: 0.001, max: 0.1, step: 0.001 }), max_accel: createParameter('max_accel', 'Max', { defaultValue: 0.2, min: 0.02, max: 1, step: 0.01 }) };
    case 'rsi': case 'cci': case 'williams_r': case 'mfi': case 'atr': case 'choppiness':
      return { period: createParameter('period', 'Period', { defaultValue: id === 'cci' ? 20 : 14, min: 1, max: 500, step: 1, integer: true }) };
    case 'macd': return { fast_period: createParameter('fast_period', 'Fast', { defaultValue: 12, min: 1, max: 500, step: 1, integer: true }), slow_period: createParameter('slow_period', 'Slow', { defaultValue: 26, min: 1, max: 500, step: 1, integer: true }), signal_period: createParameter('signal_period', 'Signal', { defaultValue: 9, min: 1, max: 500, step: 1, integer: true }) };
    case 'stoch': return { period: createParameter('period', 'Period', { defaultValue: 14, min: 1, max: 500, step: 1, integer: true }), smoothing: createParameter('smoothing', '%K Smooth', { defaultValue: 3, min: 1, max: 100, step: 1, integer: true }), signal_period: createParameter('signal_period', '%D', { defaultValue: 3, min: 1, max: 100, step: 1, integer: true }) };
    case 'stoch_rsi': return { period: createParameter('period', 'RSI Period', { defaultValue: 14, min: 1, max: 500, step: 1, integer: true }), smoothing: createParameter('smoothing', 'Stoch Period', { defaultValue: 14, min: 1, max: 500, step: 1, integer: true }), fast_period: createParameter('fast_period', '%K', { defaultValue: 3, min: 1, max: 100, step: 1, integer: true }), signal_period: createParameter('signal_period', '%D', { defaultValue: 3, min: 1, max: 100, step: 1, integer: true }) };
    case 'bollinger_bands': case 'bb_width': return { period: createParameter('period', 'Period', { defaultValue: 20, min: 1, max: 500, step: 1, integer: true }), std_dev: createParameter('std_dev', 'Std Dev', { defaultValue: 2, min: 0.1, max: 10, step: 0.1 }) };
    case 'keltner': return { period: createParameter('period', 'Period', { defaultValue: 20, min: 1, max: 500, step: 1, integer: true }), multiplier: createParameter('multiplier', 'Multiplier', { defaultValue: 2, min: 0.1, max: 20, step: 0.1 }) };
    case 'hist_vol': return { period: createParameter('period', 'Period', { defaultValue: 20, min: 1, max: 500, step: 1, integer: true }), annualization: createParameter('annualization', 'Annualization', { defaultValue: 252, min: 1, max: 365, step: 1, integer: true }) };
    case 'std_dev': return { period: createParameter('period', 'Period', { defaultValue: 20, min: 1, max: 500, step: 1, integer: true }), source: createParameter('source', 'Source', { defaultValue: 'close', options: SOURCES }) };
    case 'roc': case 'momentum': return { period: createParameter('period', 'Period', { defaultValue: 10, min: 1, max: 500, step: 1, integer: true }), source: createParameter('source', 'Source', { defaultValue: 'close', options: SOURCES }) };
    case 'rel_volume': return { period: createParameter('period', 'Period', { defaultValue: 20, min: 1, max: 500, step: 1, integer: true }) };
    case 'adx': return { period: createParameter('period', 'Period', { defaultValue: 14, min: 1, max: 500, step: 1, integer: true }) };
    case 'obv': case 'cvd': case 'volume_delta': case 'cmf': case 'trix': case 'elder_ray':
      return {};
    default:
      return { period: createParameter('period', 'Period', { defaultValue: 14, min: 1, max: 500, step: 1, integer: true }) };
  }
}

// Build the final flat registry
export const INDICATOR_ENGINE = {};

export function getIndicator(id) {
  return INDICATOR_ENGINE[id] || null;
}

export function getAllIndicators() {
  return Object.values(INDICATOR_ENGINE);
}

/**
 * Calculate an indicator from an id + parameter overrides.
 * Returns `{ points, params }` where points matches the render contract of
 * the catalog (single line, multi-line {upper,middle,lower}, oscillator, etc).
 */
export function calculateById(id, candles, paramOverrides = {}) {
  const indicator = getIndicator(id);
  if (!indicator) return { points: null, params: {}, valid: false, errors: { id: `Unknown indicator ${id}` } };
  const { valid, errors, values } = indicator.getParameters(paramOverrides);
  if (!valid) return { points: null, params: values, valid: false, errors };
  const points = indicator.calculate(candles, values);
  return { points, params: values, valid: true, errors: {} };
}

// Populate the registry with fully-typed Indicator instances
registry.forEach((def) => {
  const params = buildParameters(def.id);
  const base = { ...def, parameters: params };
  base.id = def.id;
  base.category = def.kind;
  base.description = def.description || def.name;
  base.signal = def.signal || defaultSignalFor(def.id);
  base.calculate = (candles, p) => normalizeOutput(def.id, def.calc(candles, p));
  INDICATOR_ENGINE[def.id] = new Indicator(base);
});

function defaultSignalFor(id) {
  return (candles, params) => {
    const { points, valid } = calculateById(id, candles, params);
    if (!valid || !points) return { ...sig.neutral, strength: 0, reason: 'AI analysis unavailable' };
    const last = lastValue(points);
    const prev = prevValue(points);
    if (last == null || prev == null) return { ...sig.neutral, strength: 0, reason: 'insufficient data' };
    if (last > prev) return { ...sig.buy, strength: 0.4, reason: `${id} rising (${Number(last).toFixed(2)})` };
    if (last < prev) return { ...sig.sell, strength: 0.4, reason: `${id} falling (${Number(last).toFixed(2)})` };
    return { ...sig.neutral, strength: 0, reason: `${id} flat` };
  };
}

function normalizeOutput(id, points) {
  if (!points) return null;
  // Multi-chart arrays (stoch, macd, adx, bollinger, keltner, donchian, stoch_rsi, elder)
  if (Array.isArray(points) && points.every((p) => p && typeof p === 'object' && 'time' in p)) {
    return { main: points };
  }
  return points;
}

function lastValue(points) {
  if (!points) return null;
  const arr = points.main || points.series || points;
  if (Array.isArray(arr) && arr.length) return arr[arr.length - 1]?.value ?? null;
  return null;
}

function prevValue(points) {
  if (!points) return null;
  const arr = points.main || points.series || points;
  if (Array.isArray(arr) && arr.length > 1) return arr[arr.length - 2]?.value ?? null;
  return null;
}

// Backwards-compatible aliases (existing chartIndicators functions are re-exported)
export {
  calculateSMA,
  calculateEMA,
  calculateALMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  calculateVWAP,
  calculateSupertrend,
  calculateStochRSI,
  calculateCMF,
  calculateElderRay,
  calculatePSAR,
  calculateADX,
};