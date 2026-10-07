/**
 * StockOracle Pro — SMC setup level derivation (pure, tested).
 *
 * Turns engine output (bias + equilibrium + opposing extremes) into a
 * drawable trade setup: entry, stop-loss and three take-profits anchored at
 * real opposing structure (swing highs/lows, liquidity levels), with
 * risk-multiple fallbacks when fewer than three anchors exist.
 *
 * Bullish: entry at demand (OB top / equilibrium), SL past the swept low,
 * TPs at the nearest opposing highs above entry.
 * Bearish: mirrored.
 */

function num(v, fallback = NaN) {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Fractal swing points (window 3 each side), most-recent-first capped. */
export function findSwings(candles, window = 3, cap = 40) {
  const highs = [];
  const lows = [];
  if (!Array.isArray(candles) || candles.length < window * 2 + 1) return { highs, lows };
  for (let i = window; i < candles.length - window; i++) {
    const h = num(candles[i]?.high);
    const l = num(candles[i]?.low);
    if (!Number.isFinite(h) || !Number.isFinite(l)) continue;
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= window; k++) {
      if (num(candles[i - k]?.high) > h || num(candles[i + k]?.high) > h) isHigh = false;
      if (num(candles[i - k]?.low) < l || num(candles[i + k]?.low) < l) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push({ time: candles[i].time, price: h });
    if (isLow) lows.push({ time: candles[i].time, price: l });
  }
  return { highs: highs.slice(-cap), lows: lows.slice(-cap) };
}

function atr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < 2) return NaN;
  const rows = candles.slice(-(period + 1));
  let sum = 0;
  let n = 0;
  for (let i = 1; i < rows.length; i++) {
    const h = num(rows[i]?.high);
    const l = num(rows[i]?.low);
    const pc = num(rows[i - 1]?.close);
    if (![h, l, pc].every(Number.isFinite)) continue;
    sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    n += 1;
  }
  return n > 0 ? sum / n : NaN;
}

/**
 * Derive drawable setup levels.
 * @param {Array} candles chart candles ({time, open, high, low, close})
 * @param {Object} analysis engine output ({setup:{direction,entry}, liquidity levels, orderBlocks})
 * @returns {Object|null} {direction, entry, stopLoss, takeProfits[3], entryTime} or null
 */
export function deriveSetupLevels(candles, analysis = {}) {
  if (!Array.isArray(candles) || candles.length < 10) return null;
  const setup = analysis?.setup || {};
  const direction = setup.direction || analysis?.summary?.direction || 'neutral';
  if (direction !== 'bullish' && direction !== 'bearish') return null;

  const last = candles[candles.length - 1];
  const lastClose = num(last?.close);
  if (!Number.isFinite(lastClose) || lastClose <= 0) return null;

  const { highs, lows } = findSwings(candles);
  const blocks = Array.isArray(analysis?.orderBlocks?.blocks)
    ? analysis.orderBlocks.blocks
    : (Array.isArray(analysis?.orderBlocks) ? analysis.orderBlocks : []);
  const levels = Array.isArray(analysis?.liquidity?.levels)
    ? analysis.liquidity.levels
    : (Array.isArray(analysis?.liquidity) ? analysis.liquidity : []);
  const vol = atr(candles);
  const buffer = Number.isFinite(vol) ? vol * 0.25 : lastClose * 0.0005;
  const bull = direction === 'bullish';

  // Entry: same-direction OB edge → equilibrium → last close.
  let entry = num(setup.entry);
  const dirBlocks = blocks.filter((b) => bull
    ? /bull|demand/i.test(b?.type || '')
    : /bear|supply/i.test(b?.type || ''));
  const edgeBlock = dirBlocks[dirBlocks.length - 1];
  if (!Number.isFinite(entry)) {
    entry = bull ? num(edgeBlock?.top) : num(edgeBlock?.bottom);
  }
  if (!Number.isFinite(entry)) entry = lastClose;
  if (entry <= 0) return null;

  // Reference extreme: nearest swept swing on the risk side.
  const riskSwings = (bull ? lows : highs).filter((s) => bull ? s.price < entry : s.price > entry);
  const refSwing = riskSwings[riskSwings.length - 1];
  const ref = refSwing ? refSwing.price : (bull ? entry - buffer * 4 : entry + buffer * 4);
  const stopLoss = bull ? ref - buffer : ref + buffer;
  const risk = Math.abs(entry - stopLoss);
  if (!(risk > 0) || !Number.isFinite(risk) || stopLoss <= 0) return null;

  // Opposing anchors: swing extremes + liquidity levels beyond entry.
  const oppSwings = (bull ? highs : lows)
    .filter((s) => bull ? s.price > entry : s.price < entry)
    .map((s) => s.price);
  const oppLiq = levels
    .map((l) => num(l?.price ?? (bull ? l?.top : l?.bottom)))
    .filter((p) => Number.isFinite(p) && (bull ? p > entry : p < entry));
  const anchors = [...new Set([...oppSwings, ...oppLiq])]
    .sort((a, b) => (bull ? a - b : b - a));
  // Dedupe anchors closer than half a risk unit apart.
  const picked = [];
  for (const p of anchors) {
    if (picked.every((q) => Math.abs(q - p) > risk * 0.5)) picked.push(p);
    if (picked.length >= 3) break;
  }
  // Extend beyond the last anchor; a distant TP1 must never precede a nearer TP2.
  const multiples = [1.5, 2.5, 4];
  while (picked.length < 3) {
    const previousDistance = picked.length ? Math.abs(picked.at(-1) - entry) : 0;
    const distance = Math.max(risk * multiples[picked.length], previousDistance + risk);
    picked.push(bull ? entry + distance : entry - distance);
  }
  if (picked.some((price) => !Number.isFinite(price) || price <= 0)) return null;

  return {
    direction,
    entry,
    stopLoss,
    takeProfits: picked.slice(0, 3),
    entryTime: last.time ?? null,
  };
}
