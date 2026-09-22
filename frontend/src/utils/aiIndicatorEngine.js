/**
 * StockOracle Pro — Advanced AI Indicator Engine (client-side, deterministic)
 *
 * Real per-indicator math behind the `ai` catalog in indicatorDefinitions.js.
 * Every function is a pure function of OHLCV candles (no network, no trained
 * model files) so results are reproducible bar-for-bar and cheap enough to
 * recompute on every bucket rollover.
 *
 * Conventions:
 * - Scores are leader-normalized: trend/momentum/impulse live in −100…+100,
 *   exhaustion in −100…+100 (positive = bullish reversal pressure),
 *   regime meter in 0…100 (0 = range, 100 = trend).
 * - Series points are `{ time, value }` matching the engine render contract,
 *   sparse at the start (indicator warmup) — panes already filter nulls.
 * - `min_periods` spirit: each engine starts emitting as soon as its longest
 *   dependency is available, never dropping raw candles.
 */
import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  calculateSupertrend,
  calculateStochRSI,
  calculateADX,
} from './chartIndicators.js';
import { INDICATOR_ENGINE, Indicator, createParameter } from './indicatorEngine.js';
import { addBusinessDays } from './chartHelpers.js';

const P = {
  period: (d, min = 2, max = 200) => createParameter('period', 'Period', { defaultValue: d, min, max, step: 1, integer: true }),
};

// ── Small pure helpers ───────────────────────────────────────────────────────
const num = (v, fb = NaN) => {
  const n = Number(v);
  return isNaN(n) ? fb : n;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const closesOf = (candles) => candles.map((c) => num(c.close));

function seriesToMap(points) {
  const m = new Map();
  (points || []).forEach((p) => {
    if (p && p.time != null && isFinite(Number(p.value))) m.set(p.time, Number(p.value));
  });
  return m;
}

function emaOf(values, period) {
  const out = new Array(values.length).fill(null);
  if (!values.length || period < 1) return out;
  const k = 2 / (period + 1);
  let ema = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!isFinite(v)) continue;
    ema = ema == null ? v : v * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function rollingStdev(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    const win = values.slice(Math.max(0, i - period + 1), i + 1).filter((v) => v != null && isFinite(v));
    if (win.length < 2) continue;
    const mean = win.reduce((a, b) => a + b, 0) / win.length;
    out[i] = Math.sqrt(win.reduce((a, b) => a + (b - mean) * (b - mean), 0) / win.length);
  }
  return out;
}

function rollingMinMax(values, period) {
  const lo = new Array(values.length).fill(null);
  const hi = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    const win = values.slice(Math.max(0, i - period + 1), i + 1).filter(isFinite);
    if (!win.length) continue;
    lo[i] = Math.min(...win);
    hi[i] = Math.max(...win);
  }
  return { lo, hi };
}

/** Wilder ATR array aligned to candles. */
function atrOf(candles, period = 14) {
  const out = new Array(candles.length).fill(null);
  if (candles.length < 2) return out;
  const trs = candles.map((c, i) => {
    const h = num(c.high), l = num(c.low), cl = num(c.close);
    if (![h, l, cl].every(isFinite)) return null;
    if (i === 0) return h - l;
    const pc = num(candles[i - 1].close);
    return Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  });
  let atr = null;
  for (let i = 0; i < trs.length; i++) {
    if (trs[i] == null) continue;
    atr = atr == null ? trs[i] : (atr * (period - 1) + trs[i]) / period;
    if (i >= period - 1) out[i] = atr;
  }
  return out;
}

/** Stochastic %K/%D arrays aligned to candles. */
function stochOf(candles, period = 14, smoothK = 3, smoothD = 3) {
  const n = candles.length;
  const rawK = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const win = candles.slice(Math.max(0, i - period + 1), i + 1);
    if (win.length < period) continue;
    const hh = Math.max(...win.map((c) => num(c.high, -Infinity)));
    const ll = Math.min(...win.map((c) => num(c.low, Infinity)));
    const cl = num(candles[i].close);
    if (![hh, ll, cl].every(isFinite) || hh === ll) continue;
    rawK[i] = ((cl - ll) / (hh - ll)) * 100;
  }
  const k = smaArr(rawK, smoothK);
  const kk = k.map((v) => (v == null ? null : v));
  const d = smaArr(kk, smoothD);
  return { k, d };
}

function smaArr(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    const win = values.slice(Math.max(0, i - period + 1), i + 1);
    if (win.some((v) => v == null || !isFinite(v)) || win.length < period) continue;
    out[i] = win.reduce((a, b) => a + b, 0) / win.length;
  }
  return out;
}

/** Choppiness index array (0–100, high = choppy) aligned to candles. */
function chopOf(candles, period = 14) {
  const out = new Array(candles.length).fill(null);
  const trs = candles.map((c, i) => {
    const h = num(c.high), l = num(c.low), cl = num(c.close);
    if (![h, l, cl].every(isFinite)) return null;
    if (i === 0) return h - l;
    const pc = num(candles[i - 1].close);
    return Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  });
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    const win = trs.slice(i - period + 1, i + 1);
    if (win.some((v) => v == null)) continue;
    const sumTR = win.reduce((a, b) => a + b, 0);
    const slice = candles.slice(i - period + 1, i + 1);
    const mx = Math.max(...slice.map((c) => num(c.high, -Infinity)));
    const mn = Math.min(...slice.map((c) => num(c.low, Infinity)));
    if (!isFinite(mx) || !isFinite(mn) || mx <= mn || sumTR <= 0) continue;
    out[i] = (100 * Math.log10(sumTR / (mx - mn))) / Math.log10(period);
  }
  return out;
}

/** Fractal swing pivots: [{ index, time, price, side: 'H'|'L' }]. */
function swingPivots(candles, left = 4, right = 4) {
  const pivots = [];
  for (let i = left; i < candles.length - right; i++) {
    const h = num(candles[i].high), l = num(candles[i].low);
    if (!isFinite(h) || !isFinite(l)) continue;
    let isH = true, isL = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      const hj = num(candles[j]?.high, -Infinity), lj = num(candles[j]?.low, Infinity);
      if (hj > h) isH = false;
      if (lj < l) isL = false;
      if (!isH && !isL) break;
    }
    if (isH) pivots.push({ index: i, time: candles[i].time, price: h, side: 'H' });
    if (isL) pivots.push({ index: i, time: candles[i].time, price: l, side: 'L' });
  }
  return pivots;
}

/** Percentile rank of the last value within a lookback window (0–100). */
function pctRank(values, lookback = 100) {
  const win = values.filter(isFinite).slice(-lookback);
  if (win.length < 5) return 50;
  const last = win[win.length - 1];
  const le = win.filter((v) => v <= last).length;
  return (le / win.length) * 100;
}

// ── 1. AI Trend (−100…+100): EMA stack + ADX + Supertrend + MACD vote ────────
export function computeAITrend(candles, params = {}) {
  const out = { main: [] };
  if (!Array.isArray(candles) || candles.length < 10) return out;
  const emaFast = emaOf(closesOf(candles), params.fast ?? 9);
  const emaMid = emaOf(closesOf(candles), params.mid ?? 21);
  const emaSlow = emaOf(closesOf(candles), params.slow ?? 50);
  const adxMap = seriesToMap(calculateADX(candles, params.adxPeriod ?? 14).adx);
  const stMap = new Map();
  calculateSupertrend(candles, params.stPeriod ?? 10, params.stMult ?? 3).forEach((p) => {
    if (p && p.time != null) stMap.set(p.time, p.direction);
  });
  const macd = calculateMACD(candles, 12, 26, 9);
  const histMap = seriesToMap(macd.histogram || macd.hist);
  const atrArr = atrOf(candles, 14);
  for (let i = 0; i < candles.length; i++) {
    const t = candles[i].time;
    const atrHere = atrArr[i] != null && atrArr[i] > 0 ? atrArr[i] : null;
    const votes = [];
    // EMA votes are magnitude-weighted: separations far above noise count
    // fully, microscopic ones fade to zero instead of saturating flat chop.
    const magVote = (a, b, w) => {
      if (a == null || b == null) return;
      const diff = a - b;
      if (diff === 0) return;
      const mag = atrHere ? clamp(Math.abs(diff) / (0.5 * atrHere), 0, 1) : 1;
      if (mag <= 0) return;
      votes.push([Math.sign(diff), w * mag]);
    };
    magVote(emaFast[i], emaMid[i], 1);
    magVote(emaMid[i], emaSlow[i], 1);
    if (stMap.has(t)) votes.push([stMap.get(t) >= 0 ? 1 : -1, 1.5]);
    if (histMap.has(t)) {
      const hv = histMap.get(t);
      if (hv !== 0) votes.push([Math.sign(hv), 1]);
    }
    if (!votes.length) continue;
    const adx = adxMap.get(t);
    const wScale = adx != null ? clamp(adx / 25, 0.4, 2) : 1;
    const num = votes.reduce((a, [d, w]) => a + d * w, 0);
    const den = votes.reduce((a, [, w]) => a + w, 0);
    // Agreement ratio (−1…+1) scaled by the ADX regime weight
    const agree = num / den;
    out.main.push({ time: t, value: Math.round(clamp(agree * 100 * clamp(0.5 + wScale / 2, 0.5, 1.25) / 1.25, -100, 100)) });
  }
  return out;
}

// ── 2. AI Momentum (−100…+100): RSI + StochRSI-K + MACD-hist + ROC blend ─────
export function computeAIMomentum(candles, params = {}) {
  const out = { main: [] };
  if (!Array.isArray(candles) || candles.length < 15) return out;
  const period = params.period ?? 14;
  const rsiMap = seriesToMap(calculateRSI(candles, period));
  const stoch = calculateStochRSI(candles, period, period, 3, 3);
  const kMap = seriesToMap(stoch.k);
  const macd = calculateMACD(candles, 12, 26, 9);
  const histMap = seriesToMap(macd.histogram || macd.hist);
  const closes = closesOf(candles);
  const scale = rollingStdev(closes.map((c, i) => (i > 0 && isFinite(c) && isFinite(closes[i - 1]) ? c - closes[i - 1] : null)), period);
  const rocP = params.rocPeriod ?? 10;
  for (let i = 0; i < candles.length; i++) {
    const t = candles[i].time;
    const parts = [];
    if (rsiMap.has(t)) parts.push(clamp((rsiMap.get(t) - 50) * 2, -100, 100));
    if (kMap.has(t)) parts.push(clamp((kMap.get(t) - 50) * 2, -100, 100));
    if (histMap.has(t) && scale[i] != null && scale[i] > 0) {
      parts.push(clamp((histMap.get(t) / (3 * scale[i])) * 100, -100, 100));
    }
    if (i >= rocP && isFinite(closes[i]) && isFinite(closes[i - rocP]) && closes[i - rocP] !== 0) {
      parts.push(clamp(((closes[i] - closes[i - rocP]) / closes[i - rocP]) * 100 * 8, -100, 100));
    }
    if (parts.length < 2) continue;
    out.main.push({ time: t, value: Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) });
  }
  return out;
}

// ── 3. AI Exhaustion (−100…+100): divergence + wicks + overextension ─────────
// Positive = bullish reversal pressure, negative = bearish.
export function computeAIExhaustion(candles, params = {}) {
  const out = { main: [] };
  if (!Array.isArray(candles) || candles.length < 30) return out;
  const period = params.period ?? 14;
  const rsiArr = calculateRSI(candles, period);
  const rsiMap = seriesToMap(rsiArr);
  const closes = closesOf(candles);
  const atr = atrOf(candles, period);
  const ema20 = emaOf(closes, 20);
  const look = params.lookback ?? 30;
  for (let i = 0; i < candles.length; i++) {
    const t = candles[i].time;
    if (!rsiMap.has(t) || atr[i] == null || atr[i] <= 0) continue;
    let bull = 0, bear = 0;
    // Divergence over the lookback window
    const s0 = Math.max(0, i - look);
    const priceWin = closes.slice(s0, i + 1);
    const rsiWin = [];
    for (let j = s0; j <= i; j++) {
      const rv = rsiMap.get(candles[j].time);
      if (rv != null) rsiWin.push([j, rv]);
    }
    if (priceWin.filter(isFinite).length >= 10 && rsiWin.length >= 10) {
      const pMax = Math.max(...priceWin.filter(isFinite));
      const pMin = Math.min(...priceWin.filter(isFinite));
      const rMax = Math.max(...rsiWin.map(([, v]) => v));
      const rMin = Math.min(...rsiWin.map(([, v]) => v));
      const makingHH = isFinite(closes[i]) && closes[i] >= pMax - 1e-9;
      const makingLL = isFinite(closes[i]) && closes[i] <= pMin + 1e-9;
      const rsiNow = rsiMap.get(t);
      if (makingHH && rsiNow < rMax - 2) bear += 40; // bearish divergence
      if (makingLL && rsiNow > rMin + 2) bull += 40; // bullish divergence
    }
    // Overbought / oversold
    const rsiNow = rsiMap.get(t);
    if (rsiNow >= 70) bear += 25; else if (rsiNow >= 60) bear += 10;
    if (rsiNow <= 30) bull += 25; else if (rsiNow <= 40) bull += 10;
    // Rejection wicks (wick-to-body, capped)
    const o = num(candles[i].open), h = num(candles[i].high), l = num(candles[i].low), c = num(candles[i].close);
    if ([o, h, l, c].every(isFinite)) {
      const body = Math.abs(c - o) || 1e-9;
      bear += clamp(((h - Math.max(o, c)) / body) * 8, 0, 20);
      bull += clamp(((Math.min(o, c) - l) / body) * 8, 0, 20);
      // Overextension from EMA20 in ATR units
      if (ema20[i] != null) {
        const dist = (c - ema20[i]) / atr[i];
        if (dist > 2) bear += clamp((dist - 2) * 10, 0, 15);
        if (dist < -2) bull += clamp((-dist - 2) * 10, 0, 15);
      }
    }
    out.main.push({ time: t, value: Math.round(clamp(bull, 0, 100) - clamp(bear, 0, 100)) });
  }
  return out;
}

// ── 4. AI Regime meter (0…100): 0 = range, 100 = trend ───────────────────────
export function computeAIRegime(candles, params = {}) {
  const out = { main: [] };
  if (!Array.isArray(candles) || candles.length < 20) return out;
  const period = params.period ?? 14;
  const adxMap = seriesToMap(calculateADX(candles, period).adx);
  const chop = chopOf(candles, period);
  for (let i = 0; i < candles.length; i++) {
    const t = candles[i].time;
    const adx = adxMap.get(t);
    const ch = chop[i];
    if (adx == null || ch == null) continue;
    const adxC = clamp(adx / 50, 0, 1) * 100;
    const chopC = clamp(100 - ch, 0, 100);
    out.main.push({ time: t, value: Math.round((adxC + chopC) / 2) });
  }
  return out;
}

export function labelRegime(meter, bbWidthPct = 50, atrPct = 50) {
  if (meter == null || !isFinite(meter)) return { label: 'UNKNOWN', playbook: 'stand-aside' };
  if (atrPct > 85) return { label: 'HIGH-VOL', playbook: 'reduce-size' };
  if (bbWidthPct > 80 && meter >= 40) return { label: 'BREAKOUT', playbook: 'trade-expansion' };
  if (meter >= 60) return { label: 'TREND', playbook: 'trend-follow' };
  if (meter <= 35) return { label: 'RANGE', playbook: 'mean-revert' };
  return { label: 'TRANSITION', playbook: 'stand-aside' };
}

// ── 5. AI Breakout impulse (−100…+100) + squeeze/break markers ────────────────
export function computeAIBreakout(candles, params = {}) {
  const out = { main: [] };
  if (!Array.isArray(candles) || candles.length < 25) return out;
  const period = params.period ?? 20;
  const highs = candles.map((c) => num(c.high));
  const lows = candles.map((c) => num(c.low));
  const closes = closesOf(candles);
  const vols = candles.map((c) => num(c.volume, 0));
  const bb = calculateBollingerBands(candles, period, 2) || { upper: [], middle: [], lower: [] };
  const bbTimes = (bb.middle || []).map((m) => m.time);
  const bbTimeIdx = new Map(bbTimes.map((t, i) => [t, i]));
  const widthHist = (bb.middle || []).map((m, i) => {
    const u = bb.upper?.[i]?.value, l = bb.lower?.[i]?.value;
    return m && isFinite(m.value) && isFinite(u) && isFinite(l) && Math.abs(m.value) > 0
      ? (u - l) / Math.abs(m.value) : null;
  });
  const atr = atrOf(candles, 14);
  const atrMA = smaArr(atr, 20);
  const volMA = smaArr(vols.map((v) => (isFinite(v) ? v : null)), 20);
  for (let i = 0; i < candles.length; i++) {
    const t = candles[i].time;
    if (i < period || atr[i] == null || atrMA[i] == null) continue;
    const winH = highs.slice(i - period + 1, i + 1);
    const winL = lows.slice(i - period + 1, i + 1);
    if (winH.some((v) => !isFinite(v)) || winL.some((v) => !isFinite(v))) continue;
    const upper = Math.max(...winH), lower = Math.min(...winL);
    const mid = (upper + lower) / 2;
    const c = closes[i];
    if (!isFinite(c)) continue;
    const expansion = atrMA[i] > 0 ? atr[i] / atrMA[i] : 1;
    // Bandwidth percentile up to the current bar (low = squeeze)
    const bi = bbTimeIdx.has(t) ? bbTimeIdx.get(t) : -1;
    const widthPct = bi >= 0 ? pctRank(widthHist.slice(0, bi + 1), 100) : 50;
    const dir = c > mid ? 1 : c < mid ? -1 : 0;
    let impulse = 0;
    if (widthPct < 20) impulse += 30; // squeeze base
    impulse += clamp((expansion - 1) * 140, 0, 70);
    if (volMA[i] != null && volMA[i] > 0 && vols[i] / volMA[i] > 1.5) impulse += 20;
    // Proximity to the channel edge adds conviction
    const edgeDist = upper > lower ? Math.abs(c - (dir >= 0 ? upper : lower)) / (upper - lower) : 1;
    impulse *= clamp(1.3 - edgeDist, 0.4, 1.1);
    out.main.push({ time: t, value: Math.round(dir * clamp(impulse, 0, 100)) });
  }
  return out;
}

export function getAIBreakoutMarkers(candles, params = {}) {
  const markers = [];
  if (!Array.isArray(candles) || candles.length < 25) return markers;
  const period = params.period ?? 20;
  const highs = candles.map((c) => num(c.high));
  const lows = candles.map((c) => num(c.low));
  const closes = closesOf(candles);
  const vols = candles.map((c) => num(c.volume, 0));
  const volMA = smaArr(vols.map((v) => (isFinite(v) ? v : null)), 20);
  let lastMarkIdx = -1e9;
  for (let i = period; i < candles.length; i++) {
    if (i - lastMarkIdx < 5) continue; // at most one marker per 5 bars
    const winH = highs.slice(i - period, i);
    const winL = lows.slice(i - period, i);
    if (winH.some((v) => !isFinite(v)) || winL.some((v) => !isFinite(v))) continue;
    const upper = Math.max(...winH), lower = Math.min(...winL);
    const c = closes[i];
    if (!isFinite(c)) continue;
    const volOk = volMA[i] != null && volMA[i] > 0 ? vols[i] / volMA[i] > 1.15 : true;
    if (c > upper && volOk) {
      markers.push({ time: candles[i].time, position: 'belowBar', color: '#10B981', shape: 'arrowUp', text: 'BRK', size: 1 });
      lastMarkIdx = i;
    } else if (c < lower && volOk) {
      markers.push({ time: candles[i].time, position: 'aboveBar', color: '#EF5350', shape: 'arrowDown', text: 'BRK', size: 1 });
      lastMarkIdx = i;
    }
  }
  return markers;
}

// ── 6. AI Support / Resistance zones ─────────────────────────────────────────
// [{ price, side: 'S'|'R', strength 0–100, touches, volume }]
export function getAISupportResistance(candles, params = {}) {
  if (!Array.isArray(candles) || candles.length < 30) return [];
  const lookback = params.lookback ?? 120;
  const slice = candles.slice(-lookback);
  const atrArr = atrOf(slice, 14);
  const atrNow = atrArr.filter((v) => v != null && isFinite(v)).slice(-1)[0];
  if (!isFinite(atrNow) || atrNow <= 0) return [];
  const tol = atrNow * (params.toleranceATR ?? 0.25);
  const pivots = swingPivots(slice, params.pivotLeft ?? 4, params.pivotRight ?? 4);
  const lastClose = num(slice[slice.length - 1].close);
  const clusters = [];
  const bySide = { H: pivots.filter((p) => p.side === 'H'), L: pivots.filter((p) => p.side === 'L') };
  (['H', 'L']).forEach((side) => {
    const list = [...bySide[side]].sort((a, b) => a.price - b.price);
    let cur = null;
    list.forEach((p) => {
      const vol = num(slice[p.index]?.volume, 0);
      if (!cur || Math.abs(p.price - cur.price) > tol) {
        if (cur) clusters.push(cur);
        cur = { price: p.price, side, touches: 1, volSum: isFinite(vol) ? vol : 0, lastIdx: p.index };
      } else {
        cur.touches += 1;
        cur.volSum += isFinite(vol) ? vol : 0;
        cur.price = (cur.price * (cur.touches - 1) + p.price) / cur.touches;
        cur.lastIdx = Math.max(cur.lastIdx, p.index);
      }
    });
    if (cur) clusters.push(cur);
  });
  const maxVol = Math.max(1, ...clusters.map((c) => c.volSum));
  const zones = clusters
    .filter((c) => c.touches >= 2)
    .map((c) => {
      const recency = 1 - (slice.length - 1 - c.lastIdx) / slice.length; // 0…1
      const strength = Math.round(clamp(c.touches * 22 + (c.volSum / maxVol) * 25 + recency * 20, 5, 100));
      return {
        price: c.price,
        side: c.side === 'H' ? 'R' : 'S',
        strength,
        touches: c.touches,
        near: isFinite(lastClose) ? Math.abs(lastClose - c.price) / lastClose < 0.03 : false,
      };
    })
    .sort((a, b) => b.strength - a.strength);
  const sup = zones.filter((z) => z.side === 'S').slice(0, 3);
  const res = zones.filter((z) => z.side === 'R').slice(0, 3);
  return [...sup, ...res].sort((a, b) => a.price - b.price);
}

// ── 7. AI Forecast: volatility-conditioned path + ±1σ bands ──────────────────
// { median, upper, lower } — history-fitted tail + horizon future bars.
export function computeAIForecast(candles, params = {}) {
  const empty = { median: [], upper: [], lower: [] };
  if (!Array.isArray(candles) || candles.length < 30) return empty;
  const horizon = clamp(Math.round(params.horizon ?? 7), 1, 30);
  const closes = closesOf(candles).filter(isFinite);
  if (closes.length < 30) return empty;
  const last = closes[closes.length - 1];
  // Drift: linear-regression slope over the last 20 closes (per-bar)
  const n = Math.min(20, closes.length);
  const ys = closes.slice(-n);
  const xs = ys.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - xMean) * (ys[i] - yMean); den += (x - xMean) * (x - xMean); });
  let drift = den !== 0 ? num / den : 0;
  // Momentum tilt: blend in the momentum engine's latest read
  try {
    const mom = computeAIMomentum(candles, {});
    const mLast = mom.main.length ? mom.main[mom.main.length - 1].value : 0;
    drift += (mLast / 100) * (Math.abs(drift) + last * 0.0005) * 0.5;
  } catch { /* momentum tilt is best-effort */ }
  // Volatility: stdev of log returns
  const rets = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  const tail = rets.slice(-20);
  const rMean = tail.reduce((a, b) => a + b, 0) / Math.max(1, tail.length);
  const vol = Math.sqrt(tail.reduce((a, b) => a + (b - rMean) * (b - rMean), 0) / Math.max(1, tail.length));
  const volEff = isFinite(vol) && vol > 0 ? vol : 0.01;
  // Future time slots: numeric epoch grid, or business days for daily strings
  const lastCandle = candles[candles.length - 1];
  const lastTime = lastCandle.time;
  const isNum = typeof lastTime === 'number';
  let slot = 86400;
  if (isNum) {
    const diffs = [];
    for (let i = Math.max(1, candles.length - 6); i < candles.length; i++) {
      const a = candles[i - 1].time, b = candles[i].time;
      if (typeof a === 'number' && typeof b === 'number' && b > a) diffs.push(b - a);
    }
    diffs.sort((a, b) => a - b);
    if (diffs.length) slot = diffs[Math.floor(diffs.length / 2)];
  }
  const futureTime = (k) => {
    if (isNum) return lastTime + slot * k;
    try {
      return addBusinessDays(String(lastTime).substring(0, 10), k);
    } catch {
      return null;
    }
  };
  const median = [], upper = [], lower = [];
  for (let k = 1; k <= horizon; k++) {
    const t = futureTime(k);
    if (t == null) continue;
    const m = last + drift * k;
    const half = 1.0 * volEff * Math.sqrt(k) * last;
    median.push({ time: t, value: m });
    upper.push({ time: t, value: m + half });
    lower.push({ time: t, value: Math.max(m - half, 0.01) });
  }
  return { median, upper, lower };
}

// ── 8. AI Pattern recognition: double tops/bottoms, triangles, flags ────────
// [{ name, direction: 'bull'|'bear', completion 0–100, trigger, target,
//    invalidation, time, forming }]
export function detectAIPatterns(candles, params = {}) {
  const out = [];
  if (!Array.isArray(candles) || candles.length < 30) return out;
  const lookback = params.lookback ?? 120;
  const slice = candles.slice(-lookback);
  const atrArr = atrOf(slice, 14);
  const atrNow = atrArr.filter((v) => v != null && isFinite(v)).slice(-1)[0];
  if (!isFinite(atrNow) || atrNow <= 0) return out;
  const last = slice[slice.length - 1];
  const lastClose = num(last.close);
  const pivots = swingPivots(slice, 3, 3);
  const highs = pivots.filter((p) => p.side === 'H');
  const lows = pivots.filter((p) => p.side === 'L');

  const push = (p) => {
    if (out.some((q) => q.name === p.name && q.direction === p.direction)) return;
    out.push(p);
  };

  // Double top: two highs within 1.5%, trough between, trigger = trough break.
  // Anchored at the SECOND top's bar (not the last bar) so each timeframe
  // plots one valid pattern at its real location — never Top+Bottom stacked
  // on a single candle. Most-recent pair wins (iterate from the end).
  let doubleTop = null;
  for (let i = highs.length - 1; i >= 1; i--) {
    const a = highs[i - 1], b = highs[i];
    if (Math.abs(a.price - b.price) / a.price > 0.015) continue;
    const between = slice.slice(a.index + 1, b.index);
    if (!between.length) continue;
    const trough = Math.min(...between.map((c) => num(c.low, Infinity)));
    if (!isFinite(trough)) continue;
    const completed = lastClose < trough;
    const invalidation = Math.max(a.price, b.price) + atrNow * 0.25;
    if (lastClose > invalidation) continue; // stale: price already broke above — no longer valid
    doubleTop = {
      name: 'Double Top', direction: 'bear',
      completion: completed ? 100 : 70,
      trigger: trough, target: trough - (a.price - trough),
      invalidation,
      time: b.time, secondIndex: b.index, forming: !completed,
    };
    break;
  }
  // Double bottom (mirror) — anchored at the SECOND bottom's bar.
  let doubleBottom = null;
  for (let i = lows.length - 1; i >= 1; i--) {
    const a = lows[i - 1], b = lows[i];
    if (Math.abs(a.price - b.price) / a.price > 0.015) continue;
    const between = slice.slice(a.index + 1, b.index);
    if (!between.length) continue;
    const peak = Math.max(...between.map((c) => num(c.high, -Infinity)));
    if (!isFinite(peak)) continue;
    const completed = lastClose > peak;
    const invalidation = Math.min(a.price, b.price) - atrNow * 0.25;
    if (lastClose < invalidation) continue; // stale: price already broke below — no longer valid
    doubleBottom = {
      name: 'Double Bottom', direction: 'bull',
      completion: completed ? 100 : 70,
      trigger: peak, target: peak + (peak - a.price),
      invalidation,
      time: b.time, secondIndex: b.index, forming: !completed,
    };
    break;
  }
  // Contradiction filter: a Top (bear) and Bottom (bull) can never both be
  // valid on the same timeframe snapshot — keep exactly one winner:
  // completed beats forming, then higher completion, then most recent.
  if (doubleTop && doubleBottom) {
    const tDone = doubleTop.completion === 100;
    const bDone = doubleBottom.completion === 100;
    let winner = null;
    if (tDone !== bDone) winner = tDone ? doubleTop : doubleBottom;
    else if (doubleTop.completion !== doubleBottom.completion) {
      winner = doubleTop.completion > doubleBottom.completion ? doubleTop : doubleBottom;
    } else {
      winner = doubleTop.secondIndex >= doubleBottom.secondIndex ? doubleTop : doubleBottom;
    }
    const { secondIndex: _t, ...tClean } = doubleTop;
    const { secondIndex: _b, ...bClean } = doubleBottom;
    push(winner === doubleTop ? tClean : bClean);
  } else if (doubleTop) {
    const { secondIndex: _t, ...tClean } = doubleTop;
    push(tClean);
  } else if (doubleBottom) {
    const { secondIndex: _b, ...bClean } = doubleBottom;
    push(bClean);
  }
  // Ascending triangle: flat top (slope ~0) + rising lows over ≥15 bars
  if (slice.length >= 25) {
    const win = slice.slice(-25);
    const wHighs = win.map((c) => num(c.high)).filter(isFinite);
    const wLows = win.map((c) => num(c.low)).filter(isFinite);
    if (wHighs.length >= 20 && wLows.length >= 20) {
      const slope = (arr) => {
        const m = arr.length, xm = (m - 1) / 2, ym = arr.reduce((a, b) => a + b, 0) / m;
        let sNum = 0, sDen = 0;
        arr.forEach((y, x) => { sNum += (x - xm) * (y - ym); sDen += (x - xm) * (x - xm); });
        return sDen === 0 ? 0 : sNum / sDen;
      };
      const topSlope = slope(wHighs) / atrNow;
      const botSlope = slope(wLows) / atrNow;
      const topFlat = Math.abs(topSlope) < 0.08;
      if (topFlat && botSlope > 0.08) {
        const trigger = Math.max(...wHighs);
        push({
          name: 'Ascending Triangle', direction: 'bull',
          completion: lastClose > trigger ? 100 : 60,
          trigger, target: trigger + (trigger - Math.min(...wLows)),
          invalidation: Math.min(...wLows), time: last.time,
          forming: lastClose <= trigger,
        });
      } else if (topFlat === false && Math.abs(botSlope) < 0.08 && topSlope < -0.08) {
        const trigger = Math.min(...wLows);
        push({
          name: 'Descending Triangle', direction: 'bear',
          completion: lastClose < trigger ? 100 : 60,
          trigger, target: trigger - (Math.max(...wHighs) - trigger),
          invalidation: Math.max(...wHighs), time: last.time,
          forming: lastClose >= trigger,
        });
      }
    }
  }
  // Bull/bear flag: impulse (>2.5 ATR in ≤5 bars) + tight 3–8 bar consolidation
  if (slice.length >= 15) {
    const tail = slice.slice(-14);
    let best = null;
    for (let s = 0; s <= 5; s++) {
      const leg = tail.slice(s, s + 5);
      if (leg.length < 5) continue;
      const move = num(leg[4].close) - num(leg[0].open);
      if (!isFinite(move) || Math.abs(move) < 2.5 * atrNow) continue;
      const rest = tail.slice(s + 5);
      if (rest.length < 3) continue;
      const rH = Math.max(...rest.map((c) => num(c.high, -Infinity)));
      const rL = Math.min(...rest.map((c) => num(c.low, Infinity)));
      if (rH - rL < Math.abs(move) * 0.5) {
        best = { move, top: rH, bot: rL, dir: move > 0 ? 'bull' : 'bear' };
      }
    }
    if (best) {
      push({
        name: best.dir === 'bull' ? 'Bull Flag' : 'Bear Flag', direction: best.dir,
        completion: 65, trigger: best.dir === 'bull' ? best.top : best.bot,
        target: lastClose + best.move * 0.8,
        invalidation: best.dir === 'bull' ? best.bot : best.top,
        time: last.time, forming: true,
      });
    }
  }
  return out.slice(0, 6);
}

export function getAIPatternMarkers(candles, params = {}) {
  return detectAIPatterns(candles, params).map((p) => ({
    time: p.time,
    position: p.direction === 'bull' ? 'belowBar' : 'aboveBar',
    color: p.direction === 'bull' ? '#10B981' : '#EF5350',
    shape: p.forming ? 'circle' : p.direction === 'bull' ? 'arrowUp' : 'arrowDown',
    text: p.forming ? `${p.name}~` : p.name,
    size: 1,
  }));
}

export function getAIReversalMarkers(candles, params = {}) {
  const markers = [];
  const ex = computeAIExhaustion(candles, params);
  const pts = ex.main;
  let lastIdx = -1e9;
  const thr = params.threshold ?? 60;
  for (let i = 1; i < pts.length; i++) {
    if (i - lastIdx < 5) continue;
    const v = pts[i].value, pv = pts[i - 1].value;
    // Fresh extreme cross: newly exhausted in either direction
    if (v >= thr && pv < thr) {
      markers.push({ time: pts[i].time, position: 'aboveBar', color: '#EF5350', shape: 'arrowDown', text: 'EXH', size: 1 });
      lastIdx = i;
    } else if (v <= -thr && pv > -thr) {
      markers.push({ time: pts[i].time, position: 'belowBar', color: '#10B981', shape: 'arrowUp', text: 'EXH', size: 1 });
      lastIdx = i;
    }
  }
  return markers;
}

// ── Dashboard summary: one honest snapshot across all AI engines ─────────────
export function computeAIDashboardScores(candles) {
  const none = { available: false };
  if (!Array.isArray(candles) || candles.length < 10) return {
    available: false, trend: none, momentum: none, regime: none,
    exhaustion: none, breakout: none, sr: { supports: [], resistances: [] },
    patterns: [], forecast: none,
  };
  const lastOf = (arr) => (arr && arr.length ? arr[arr.length - 1].value : null);
  const trendV = lastOf(computeAITrend(candles, {}).main);
  const momV = lastOf(computeAIMomentum(candles, {}).main);
  const exhV = lastOf(computeAIExhaustion(candles, {}).main);
  const regV = lastOf(computeAIRegime(candles, {}).main);
  const brkV = lastOf(computeAIBreakout(candles, {}).main);
  const bb = calculateBollingerBands(candles, 20, 2) || { upper: [], middle: [], lower: [] };
  const widths = (bb.middle || []).map((m, i) => {
    const u = bb.upper?.[i]?.value, l = bb.lower?.[i]?.value;
    return m && isFinite(m.value) && isFinite(u) && isFinite(l) && Math.abs(m.value) > 0
      ? (u - l) / Math.abs(m.value) : null;
  }).filter((v) => v != null);
  const regime = labelRegime(regV, pctRank(widths, 100), 50);
  const zones = getAISupportResistance(candles, {});
  const patterns = detectAIPatterns(candles, {});
  const fc = computeAIForecast(candles, { horizon: 7 });
  const fcDir = fc.median.length >= 2
    ? (fc.median[fc.median.length - 1].value > candles[candles.length - 1].close ? 'UP'
      : fc.median[fc.median.length - 1].value < candles[candles.length - 1].close ? 'DOWN' : 'FLAT')
    : 'FLAT';
  return {
    available: true,
    trend: trendV == null ? none : {
      available: true, score: trendV,
      label: trendV > 20 ? 'UPTREND' : trendV < -20 ? 'DOWNTREND' : 'RANGE',
    },
    momentum: momV == null ? none : {
      available: true, score: momV,
      label: momV > 30 ? 'BULLISH' : momV < -30 ? 'BEARISH' : 'NEUTRAL',
    },
    regime: regV == null ? none : { available: true, meter: regV, ...regime },
    exhaustion: exhV == null ? none : {
      available: true, score: exhV,
      label: exhV >= 60 ? 'BEAR-EXH' : exhV <= -60 ? 'BULL-EXH' : 'BALANCED',
    },
    breakout: brkV == null ? none : {
      available: true, impulse: brkV,
      label: Math.abs(brkV) < 20 ? 'SQUEEZE' : brkV > 0 ? 'BULL-IMP' : 'BEAR-IMP',
    },
    sr: {
      supports: zones.filter((z) => z.side === 'S'),
      resistances: zones.filter((z) => z.side === 'R'),
    },
    patterns,
    forecast: { available: fc.median.length > 0, direction: fcDir, bars: fc.median.length },
  };
}

// ── Engine registry (series-returning AI engines for calculateById) ──────────
function aiSignalOf(lastFn) {
  return (candles, params) => {
    const pts = lastFn(candles, params);
    const arr = pts.main || [];
    if (!arr.length) return { direction: 'neutral', label: 'NEUTRAL', color: '#F59E0B', strength: 0, reason: 'insufficient data' };
    const last = arr[arr.length - 1].value;
    if (last > 20) return { direction: 'buy', label: 'BULLISH', color: '#10B981', strength: clamp(Math.abs(last) / 100, 0, 1), reason: `AI score ${Math.round(last)}` };
    if (last < -20) return { direction: 'sell', label: 'BEARISH', color: '#EF5350', strength: clamp(Math.abs(last) / 100, 0, 1), reason: `AI score ${Math.round(last)}` };
    return { direction: 'neutral', label: 'NEUTRAL', color: '#F59E0B', strength: 0.2, reason: `AI score ${Math.round(last)}` };
  };
}

const AI_REGISTRY = [
  {
    id: 'ai_trend', name: 'AI Trend Score', category: 'ai',
    parameters: {
      fast: createParameter('period', 'Fast EMA', { defaultValue: 9, min: 2, max: 100, step: 1, integer: true }),
      mid: createParameter('period', 'Mid EMA', { defaultValue: 21, min: 3, max: 200, step: 1, integer: true }),
      slow: createParameter('period', 'Slow EMA', { defaultValue: 50, min: 5, max: 300, step: 1, integer: true }),
      adxPeriod: createParameter('period', 'ADX Period', { defaultValue: 14, min: 2, max: 100, step: 1, integer: true }),
    },
    calculate: (c, p) => ({ main: computeAITrend(c, p).main }), signal: aiSignalOf((c, p) => computeAITrend(c, p)),
  },
  {
    id: 'ai_momentum', name: 'AI Momentum Composite', category: 'ai',
    parameters: { period: P.period(14), rocPeriod: createParameter('period', 'ROC Period', { defaultValue: 10, min: 2, max: 100, step: 1, integer: true }) },
    calculate: (c, p) => ({ main: computeAIMomentum(c, p).main }), signal: aiSignalOf((c, p) => computeAIMomentum(c, p)),
  },
  {
    id: 'ai_exhaustion', name: 'AI Exhaustion', category: 'ai',
    parameters: { period: P.period(14), lookback: createParameter('period', 'Divergence Lookback', { defaultValue: 30, min: 10, max: 200, step: 1, integer: true }), threshold: createParameter('period', 'Marker Threshold', { defaultValue: 60, min: 30, max: 95, step: 1, integer: true }) },
    calculate: (c, p) => ({ main: computeAIExhaustion(c, p).main }), signal: aiSignalOf((c, p) => computeAIExhaustion(c, p)),
  },
  {
    id: 'ai_regime', name: 'AI Regime Meter', category: 'ai',
    parameters: { period: P.period(14) },
    calculate: (c, p) => ({ main: computeAIRegime(c, p).main }), signal: aiSignalOf((c, p) => computeAIRegime(c, p)),
  },
  {
    id: 'ai_breakout', name: 'AI Breakout Impulse', category: 'ai',
    parameters: { period: createParameter('period', 'Channel Period', { defaultValue: 20, min: 5, max: 200, step: 1, integer: true }) },
    calculate: (c, p) => ({ main: computeAIBreakout(c, p).main }), signal: aiSignalOf((c, p) => computeAIBreakout(c, p)),
  },
  {
    id: 'ai_forecast', name: 'AI Forecast Path', category: 'ai',
    parameters: { horizon: createParameter('period', 'Horizon (bars)', { defaultValue: 7, min: 1, max: 30, step: 1, integer: true }) },
    calculate: (c, p) => computeAIForecast(c, p),
    signal: (candles, p) => {
      const fc = computeAIForecast(candles, p);
      if (!fc.median.length) return { direction: 'neutral', label: 'NEUTRAL', color: '#F59E0B', strength: 0, reason: 'insufficient data' };
      const first = fc.median[0].value, last = fc.median[fc.median.length - 1].value;
      if (last > first) return { direction: 'buy', label: 'FORECAST-UP', color: '#10B981', strength: 0.5, reason: 'forecast path rising' };
      if (last < first) return { direction: 'sell', label: 'FORECAST-DOWN', color: '#EF5350', strength: 0.5, reason: 'forecast path falling' };
      return { direction: 'neutral', label: 'FORECAST-FLAT', color: '#F59E0B', strength: 0.2, reason: 'forecast path flat' };
    },
  },
];

AI_REGISTRY.forEach((def) => {
  if (!INDICATOR_ENGINE[def.id]) {
    const { parameters, ...rest } = def;
    INDICATOR_ENGINE[def.id] = new Indicator({ ...rest, parameters: parameters || {} });
  }
});

export function getAIEngineIds() {
  return AI_REGISTRY.map((d) => d.id);
}
