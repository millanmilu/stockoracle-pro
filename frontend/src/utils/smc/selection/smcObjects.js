/**
 * StockOracle Pro — SMC object model (detection → canonical objects).
 *
 * Every detection (OB / FVG / liquidity / swing / break) becomes a canonical
 * object with a RELOAD-STABLE unique id:
 *   `${SYMBOL}|${INTERVAL}|${kind}|${direction}|${createdTime}|${priceKey}`
 * The old index-based ids (`ob-3-…`) shifted on every reload and duplicated
 * chart objects — price+time anchored ids cannot.
 */

export function atr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < 2) return NaN;
  const rows = candles.slice(-(period + 1));
  let sum = 0;
  let n = 0;
  for (let i = 1; i < rows.length; i++) {
    const h = Number(rows[i]?.high);
    const l = Number(rows[i]?.low);
    const pc = Number(rows[i - 1]?.close);
    if (![h, l, pc].every(Number.isFinite)) continue;
    sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    n += 1;
  }
  return n > 0 ? sum / n : NaN;
}

/** coarse price key so reloads reproduce the identical uid */
export function priceKey(p) {
  const n = Number(p);
  if (!Number.isFinite(n) || n <= 0) return 'na';
  const decimals = n >= 1000 ? 0 : n >= 100 ? 1 : 2;
  return n.toFixed(decimals);
}

export function directionOf(type) {
  const t = String(type || '').toLowerCase();
  if (/bear|supply|ssl|eqh|resistance|bsl/.test(t)) {
    if (/ssl|support|bull|demand/.test(t) && !/bear/.test(t)) return 'bullish';
    return 'bearish';
  }
  if (/bull|demand|ssl|support/.test(t)) return 'bullish';
  return 'neutral';
}

export function makeUid(symbol, interval, kind, direction, createdTime, top, bottom) {
  const t = createdTime == null ? 'na' : String(createdTime);
  return [
    String(symbol || '?').toUpperCase(),
    String(interval || '?').toLowerCase(),
    kind, direction, t, priceKey(top), priceKey(bottom),
  ].join('|');
}

function barIndexByTime(candles, time) {
  if (!Array.isArray(candles)) return -1;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i]?.time === time) return i;
    if (typeof candles[i]?.time === typeof time && candles[i].time < time) return -1;
  }
  return -1;
}

/**
 * Displacement strength 0..1: how expansively price left the zone after
 * creation (favorable excursion / ATR, capped). Needs candles for context.
 */
export function measureDisplacement(candles, createdTime, direction, refPrice, lookahead = 12) {
  const idx = barIndexByTime(candles, createdTime);
  if (idx < 0 || !Array.isArray(candles)) return 0.5;
  const a = atr(candles.slice(0, Math.max(idx + 1, 15)));
  const unit = Number.isFinite(a) && a > 0 ? a : Math.abs(Number(refPrice) * 0.002) || 1;
  let extreme = direction === 'bullish' ? -Infinity : Infinity;
  const end = Math.min(candles.length, idx + 1 + lookahead);
  for (let i = idx + 1; i < end; i++) {
    const h = Number(candles[i]?.high);
    const l = Number(candles[i]?.low);
    if (!Number.isFinite(h) || !Number.isFinite(l)) continue;
    extreme = direction === 'bullish' ? Math.max(extreme, h) : Math.min(extreme, l);
  }
  if (!Number.isFinite(extreme)) return 0.5;
  const excursion = direction === 'bullish' ? extreme - Number(refPrice) : Number(refPrice) - extreme;
  return Math.max(0, Math.min(1, excursion / (unit * 2)));
}

function formationVolume(candles, createdTime) {
  const idx = barIndexByTime(candles, createdTime);
  if (idx < 1 || !Array.isArray(candles)) return 1;
  const vols = [];
  for (let i = Math.max(0, idx - 20); i < idx; i++) {
    const v = Number(candles[i]?.volume);
    if (Number.isFinite(v) && v > 0) vols.push(v);
  }
  if (!vols.length) return 1;
  const avg = vols.reduce((s, v) => s + v, 0) / vols.length;
  const own = Number(candles[idx]?.volume) || 0;
  return avg > 0 ? own / avg : 1;
}

/**
 * Normalize one raw detection into a canonical zone object.
 * kind: 'ob' | 'fvg' | 'liquidity' | 'sr'
 */
export function normalizeZone(raw, kind, candles, symbol, interval) {
  if (!raw) return null;
  const top = Number(raw.top);
  const bottom = Number(raw.bottom);
  const price = Number(raw.price ?? (Number.isFinite(top) && Number.isFinite(bottom) ? (top + bottom) / 2 : NaN));
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || top <= bottom) {
    if (!Number.isFinite(price)) return null;
  }
  const direction = directionOf(raw.type);
  const t = Number.isFinite(top) ? top : price;
  const b = Number.isFinite(bottom) ? bottom : price;
  return {
    uid: makeUid(symbol, interval, kind, direction, raw.time, t, b),
    kind,
    direction,
    top: t,
    bottom: b,
    mid: (t + b) / 2,
    createdTime: raw.time ?? null,
    confirmedTime: raw.confirmedTime ?? null,
    label: raw.label || raw.type || kind,
    color: raw.color || null,
    rawType: raw.type || kind,
    state: 'active',
    fillPct: 0,
    retests: 0,
    displacement: measureDisplacement(candles, raw.time, direction === 'bearish' ? 'bearish' : 'bullish', direction === 'bearish' ? t : b),
    volumeRatio: formationVolume(candles, raw.time),
    ageBars: 0,
    relevance: 0,
  };
}

/** Structural break event with a dedupe-stable id (one swing = one event). */
export function normalizeBreak(raw, symbol, interval) {
  if (!raw || !Number.isFinite(Number(raw.price))) return null;
  const direction = raw.direction === 'bear' ? 'bearish' : raw.direction === 'bull' ? 'bullish' : 'neutral';
  return {
    uid: makeUid(symbol, interval, 'break', direction, raw.time, raw.price, raw.price),
    kind: 'break',
    breakType: raw.type || 'BOS',
    direction,
    price: Number(raw.price),
    createdTime: raw.time ?? null,
    label: raw.type || 'BOS',
    color: raw.color || null,
  };
}

/** Swing point event (HH/HL/LH/LL) with a stable id. */
export function normalizeSwingEvent(raw, symbol, interval) {
  if (!raw || !Number.isFinite(Number(raw.price))) return null;
  return {
    uid: makeUid(symbol, interval, 'swing', 'neutral', raw.time, raw.price, raw.price),
    kind: 'swing',
    price: Number(raw.price),
    createdTime: raw.time ?? null,
    label: raw.label || '',
    swingType: raw.type || '',
  };
}
