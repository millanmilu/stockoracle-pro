/**
 * StockOracle Pro — Rule-Based AI Signal Engine (spec §17)
 *
 * Produces a probability-weighted trading signal from REAL indicator values
 * computed by the modular indicator engine. No ML model is required; a
 * separately-trained ML consensus can be surfaced by the caller.
 *
 * Output contract:
 * {
 *   available: boolean,
 *   direction: 'buy' | 'sell' | 'neutral',
 *   probability: 0..100,
 *   confluence: { buy: number, sell: number, neutral: number },  // count of votes
 *   score: -100..100,            // net directional strength
 *   entry: number,
 *   stopLoss: number,
 *   takeProfit: number,
 *   riskReward: number,
 *   signals: [{ href, label, value, state: 'buy'|'sell'|'neutral', weight, reason }],
 *   why: [string],
 *   missing: [string],
 * }
 */

import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateStoch,
  calculateCCI,
  calculateADX,
  calculateATR,
  calculateBollingerBands,
  calculateVolumeDelta,
  calculateRelativeVolume,
} from './indicatorEngine.js';

import { detectBosChoch } from './marketStructure.js';

const num = (v) => {
  const n = Number(v);
  return isNaN(n) ? null : n;
};

const last = (arr) => (arr && arr.length ? arr[arr.length - 1] : null);
const prev = (arr) => (arr && arr.length > 1 ? arr[arr.length - 2] : null);

function lastVal(series) {
  const p = last(Array.isArray(series) ? series : []);
  return p ? num(p.value) : null;
}
function prevVal(series) {
  const p = prev(Array.isArray(series) ? series : []);
  return p ? num(p.value) : null;
}

function signal(state, weight, reason, extra = {}) {
  return { state, weight, reason, ...extra };
}

/**
 * Compute the full AI signal report for a candle series.
 * @param {Array} candles OHLCV candles (sorted asc)
 * @returns {object} signal report
 */
export function analyzeSignal(candles) {
  if (!Array.isArray(candles) || candles.length < 30) {
    return unavailable(['Insufficient data: need at least 30 candles']);
  }

  const close = last(candles)?.close;
  if (close == null || num(close) <= 0) {
    return unavailable(['No valid close price']);
  }

  const signals = [];
  const missing = [];
  let buyVotes = 0;
  let sellVotes = 0;
  let neutralVotes = 0;
  let buyWeight = 0;
  let sellWeight = 0;
  let neutralWeight = 0;

  const vote = (s) => {
    signals.push(s);
    if (s.state === 'buy') { buyVotes += 1; buyWeight += s.weight; }
    else if (s.state === 'sell') { sellVotes += 1; sellWeight += s.weight; }
    else { neutralVotes += 1; neutralWeight += s.weight; }
  };

  // ── 1. Trend: EMA 50 vs EMA 200 (golden/death cross filter) ─────────────
  try {
    const ema50 = calculateEMA(candles, 50);
    const ema100 = calculateEMA(candles, 100);
    const e50 = lastVal(ema50);
    const e100 = lastVal(ema100);
    if (e50 == null || e100 == null) {
      missing.push('EMA 50/100');
    } else {
      const diffPct = ((e50 - e100) / e100) * 100;
      if (e50 > e100) {
        vote(signal('buy', 0.20, `EMA50 above EMA100 by ${diffPct.toFixed(2)}%`, { href: 'trend', label: 'Trend', value: `${diffPct.toFixed(2)}%` }));
      } else {
        vote(signal('sell', 0.20, `EMA50 below EMA100 by ${Math.abs(diffPct).toFixed(2)}%`, { href: 'trend', label: 'Trend', value: `${diffPct.toFixed(2)}%` }));
      }
    }
  } catch { missing.push('EMA trend'); }

  // ── 2. Trend: Price vs SMA 200 ───────────────────────────────────────────
  try {
    const sma200 = calculateSMA(candles, 200);
    const s200 = lastVal(sma200);
    const priceFromSma = s200 ? ((close - s200) / s200) * 100 : null;
    if (priceFromSma == null) {
      missing.push('SMA 200');
    } else if (priceFromSma > 0) {
      vote(signal('buy', 0.15, `Price above SMA200 by ${priceFromSma.toFixed(2)}%`, { href: 'trend', label: 'SMA200', value: `${priceFromSma.toFixed(2)}%` }));
    } else {
      vote(signal('sell', 0.15, `Price below SMA200 by ${Math.abs(priceFromSma).toFixed(2)}%`, { href: 'trend', label: 'SMA200', value: `${priceFromSma.toFixed(2)}%` }));
    }
  } catch { missing.push('SMA 200'); }

  // ── 3. Momentum: RSI ─────────────────────────────────────────────────────
  try {
    const rsi = calculateRSI(candles, 14);
    const r = lastVal(rsi);
    if (r == null) {
      missing.push('RSI');
    } else if (r >= 70) {
      vote(signal('sell', 0.15, `RSI overbought at ${r.toFixed(1)}`, { href: 'momentum', label: 'RSI', value: r.toFixed(1) }));
    } else if (r <= 30) {
      vote(signal('buy', 0.15, `RSI oversold at ${r.toFixed(1)}`, { href: 'momentum', label: 'RSI', value: r.toFixed(1) }));
    } else {
      vote(signal('neutral', 0.05, `RSI in neutral zone at ${r.toFixed(1)}`, { href: 'momentum', label: 'RSI', value: r.toFixed(1) }));
    }
  } catch { missing.push('RSI'); }

  // ── 4. Momentum: MACD cross ──────────────────────────────────────────────
  try {
    const macd = calculateMACD(candles, 12, 26, 9);
    const m = lastVal(macd.macd);
    const s = lastVal(macd.signal);
    const mPrev = prevVal(macd.macd);
    const sPrev = prevVal(macd.signal);
    if (m == null || s == null) {
      missing.push('MACD');
    } else {
      const histNow = m - s;
      const histPrev = mPrev != null && sPrev != null ? mPrev - sPrev : 0;
      const rising = histNow > histPrev;
      if (m > s && rising) {
        vote(signal('buy', 0.18, 'MACD above signal with rising histogram', { href: 'momentum', label: 'MACD', value: histNow.toFixed(2) }));
      } else if (m < s) {
        vote(signal('sell', 0.18, 'MACD below signal line', { href: 'momentum', label: 'MACD', value: histNow.toFixed(2) }));
      } else {
        vote(signal('neutral', 0.08, 'MACD histogram flat', { href: 'momentum', label: 'MACD', value: histNow.toFixed(2) }));
      }
    }
  } catch { missing.push('MACD'); }

  // ── 5. Momentum: Stochastic ──────────────────────────────────────────────
  try {
    const stoch = calculateStoch(candles, 14, 3, 3);
    const k = lastVal(stoch.k);
    const d = lastVal(stoch.d);
    if (k == null || d == null) {
      missing.push('Stochastic');
    } else if (k >= 80) {
      vote(signal('sell', 0.10, `Stochastic overbought at ${k.toFixed(1)}`, { href: 'momentum', label: 'Stoch', value: k.toFixed(1) }));
    } else if (k <= 20) {
      vote(signal('buy', 0.10, `Stochastic oversold at ${k.toFixed(1)}`, { href: 'momentum', label: 'Stoch', value: k.toFixed(1) }));
    } else if (k > d) {
      vote(signal('buy', 0.08, 'Stochastic %K above %D', { href: 'momentum', label: 'Stoch', value: `${k.toFixed(1)}/${d.toFixed(1)}` }));
    } else {
      vote(signal('sell', 0.08, 'Stochastic %K below %D', { href: 'momentum', label: 'Stoch', value: `${k.toFixed(1)}/${d.toFixed(1)}` }));
    }
  } catch { missing.push('Stochastic'); }

  // ── 6. Breakout: Bollinger Bands ──────────────────────────────────────────
  try {
    const bb = calculateBollingerBands(candles, 20, 2);
    const up = lastVal(bb.upper);
    const lo = lastVal(bb.lower);
    const mid = lastVal(bb.middle);
    if (up == null || lo == null) {
      missing.push('Bollinger');
    } else if (close > up) {
      vote(signal('buy', 0.12, 'Price broke above upper Bollinger band (momentum)', { href: 'breakout', label: 'BB', value: '>upper' }));
    } else if (close < lo) {
      vote(signal('sell', 0.12, 'Price broke below lower Bollinger band', { href: 'breakout', label: 'BB', value: '<lower' }));
    } else {
      vote(signal('neutral', 0.04, 'Price inside Bollinger bands', { href: 'breakout', label: 'BB', value: 'inside' }));
    }
  } catch { missing.push('Bollinger'); }

  // ── 7. Reversal: CCI ──────────────────────────────────────────────────────
  try {
    const cci = calculateCCI(candles, 20);
    const c = lastVal(cci);
    if (c == null) {
      missing.push('CCI');
    } else if (c >= 100) {
      vote(signal('sell', 0.08, `CCI overbought at ${c.toFixed(1)}`, { href: 'reversal', label: 'CCI', value: c.toFixed(1) }));
    } else if (c <= -100) {
      vote(signal('buy', 0.08, `CCI oversold at ${c.toFixed(1)}`, { href: 'reversal', label: 'CCI', value: c.toFixed(1) }));
    } else {
      vote(signal('neutral', 0.03, `CCI neutral at ${c.toFixed(1)}`, { href: 'reversal', label: 'CCI', value: c.toFixed(1) }));
    }
  } catch { missing.push('CCI'); }

  // ── 8. Trend Strength: ADX ────────────────────────────────────────────────
  try {
    const adx = calculateADX(candles, 14);
    const adxVal = lastVal(adx.adx);
    const pdi = lastVal(adx.plusDI);
    const mdi = lastVal(adx.minusDI);
    if (adxVal == null) {
      missing.push('ADX');
    } else if (adxVal >= 25) {
      if (pdi != null && mdi != null && pdi > mdi) {
        vote(signal('buy', 0.10, `Strong uptrend (ADX ${adxVal.toFixed(1)}, +DI > -DI)`, { href: 'trend', label: 'ADX', value: adxVal.toFixed(1) }));
      } else if (pdi != null && mdi != null && pdi < mdi) {
        vote(signal('sell', 0.10, `Strong downtrend (ADX ${adxVal.toFixed(1)}, -DI > +DI)`, { href: 'trend', label: 'ADX', value: adxVal.toFixed(1) }));
      } else {
        vote(signal('neutral', 0.05, `Strong trend but direction unclear (ADX ${adxVal.toFixed(1)})`, { href: 'trend', label: 'ADX', value: adxVal.toFixed(1) }));
      }
    } else {
      vote(signal('neutral', 0.05, `Weak trend (ADX ${adxVal.toFixed(1)})`, { href: 'trend', label: 'ADX', value: adxVal.toFixed(1) }));
    }
  } catch { missing.push('ADX'); }

  // ── 9. Volume: Relative Volume + estimated Delta ─────────────────────────
  try {
    const rv = calculateRelativeVolume(candles, 20);
    const rvVal = lastVal(rv);
    const delta = calculateVolumeDelta(candles);
    const deltaVal = lastVal(delta);
    if (rvVal == null || deltaVal == null) {
      missing.push('Volume');
    } else if (rvVal > 1.5 && deltaVal > 0) {
      vote(signal('buy', 0.10, `High relative volume (${rvVal.toFixed(2)}x) with positive estimated delta`, { href: 'volume', label: 'Volume', value: `${rvVal.toFixed(2)}x` }));
    } else if (rvVal > 1.5 && deltaVal < 0) {
      vote(signal('sell', 0.10, `High relative volume (${rvVal.toFixed(2)}x) with negative estimated delta`, { href: 'volume', label: 'Volume', value: `${rvVal.toFixed(2)}x` }));
    } else {
      vote(signal('neutral', 0.03, `Normal volume (${rvVal.toFixed(2)}x)`, { href: 'volume', label: 'Volume', value: `${rvVal.toFixed(2)}x` }));
    }
  } catch { missing.push('Volume'); }

  // ── 10. Market Structure: BOS/CHoCH ──────────────────────────────────────
  try {
    const bos = detectBosChoch(candles, 5);
    const recent = bos[bos.length - 1];
    if (recent) {
      if (recent.direction === 'bull') {
        vote(signal('buy', 0.12, `Recent ${recent.type} bullish (${recent.label})`, { href: 'structure', label: 'Structure', value: recent.type }));
      } else if (recent.direction === 'bear') {
        vote(signal('sell', 0.12, `Recent ${recent.type} bearish (${recent.label})`, { href: 'structure', label: 'Structure', value: recent.type }));
      }
    }
  } catch { /* structure is additive only */ }

  // ── Volatility context: ATR for stop/TP placement ────────────────────────
  let atr = null;
  try {
    const atrSeries = calculateATR(candles, 14);
    atr = lastVal(atrSeries);
    if (atr == null) missing.push('ATR');
  } catch { missing.push('ATR'); }

  // ── Aggregate ─────────────────────────────────────────────────────────────
  // Total weight incorporates all evaluated sub-models (buy, sell, neutral)
  // so a single indicator in a quiet/chop market cannot trigger false 100% conviction.
  const totalWeight = buyWeight + sellWeight + neutralWeight;
  const netDiff = buyWeight - sellWeight;
  const netScore = totalWeight > 0 ? Math.round((netDiff / totalWeight) * 100) : 0;

  // Direction is decided by the weighted balance of conviction (not raw vote
  // counts) so strong trends are not neutralised by contrarian oscillator votes.
  let direction = 'neutral';
  if (netScore > 5) direction = 'buy';
  else if (netScore < -5) direction = 'sell';

  const conviction = Math.min(100, Math.abs(netScore));
  const probability = direction === 'neutral' ? 50 : 50 + Math.round(conviction / 2);

  // ── Entry / SL / TP zones from real values ────────────────────────────────
  const atrFallback = (close * 0.01) || 1;
  const useAtr = atr != null && atr > 0 ? atr : atrFallback;
  const volRatio = Math.min(3, Math.max(1, 1 + (Math.abs(netScore) / 100)));

  let entry = close;
  let stopLoss;
  let takeProfit;
  if (direction === 'buy') {
    stopLoss = Math.max(0.01, entry - useAtr * 1.5);
    takeProfit = Math.max(0.01, entry + useAtr * 3 * volRatio);
  } else if (direction === 'sell') {
    stopLoss = Math.max(0.01, entry + useAtr * 1.5);
    const rawTP = entry - useAtr * 3 * volRatio;
    takeProfit = rawTP > 0.01 ? rawTP : Math.max(0.01, entry * 0.5);
  } else {
    stopLoss = Math.max(0.01, entry - useAtr * 1.5);
    takeProfit = Math.max(0.01, entry + useAtr * 1.5);
  }
  const risk = Math.abs(entry - stopLoss) || (useAtr * 1.5) || 1;
  const reward = Math.abs(takeProfit - entry) || (useAtr * 3) || 1;
  const riskReward = Number((reward / risk).toFixed(2));

  const why = signals
    .filter((s) => s.state !== 'neutral')
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map((s) => `${s.state.toUpperCase()}: ${s.reason}`);

  return {
    available: true,
    direction,
    probability,
    confluence: { buy: buyVotes, sell: sellVotes, neutral: neutralVotes },
    score: netScore,
    entry: Number(entry.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(2)),
    takeProfit: Number(takeProfit.toFixed(2)),
    riskReward,
    atr: Number(useAtr.toFixed(2)),
    signals: signals.map((s) => ({ ...s, value: s.value ?? '—' })),
    why: why.length ? why : ['No directional signals — market in equilibrium'],
    missing,
  };
}

function unavailable(reasons = []) {
  return {
    available: false,
    direction: 'neutral',
    probability: 0,
    confluence: { buy: 0, sell: 0, neutral: 0 },
    score: 0,
    entry: null,
    stopLoss: null,
    takeProfit: null,
    riskReward: null,
    atr: null,
    signals: [],
    why: ['AI analysis unavailable'],
    missing: reasons,
  };
}