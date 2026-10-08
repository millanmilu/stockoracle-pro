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

const DEAD_STATES = new Set(['filled', 'mitigated', 'invalidated', 'consumed']);

function indexOfTime(candles, time) {
  if (time == null) return -1;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i]?.time === time) return i;
  }
  return -1;
}

function zoneRange(item) {
  const top = num(item?.top);
  const bottom = num(item?.bottom);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || top <= 0 || bottom <= 0 || top === bottom) return null;
  return { top: Math.max(top, bottom), bottom: Math.min(top, bottom) };
}

function matchesDirection(item, bullish) {
  const direction = String(item?.direction || '').toLowerCase();
  if (direction === (bullish ? 'bullish' : 'bearish')) return true;
  const type = String(item?.type || item?.rawType || '').toLowerCase();
  return bullish ? /bull|demand/.test(type) : /bear|supply/.test(type);
}

function isLiveZone(item) {
  const state = String(item?.state || '').toLowerCase();
  return !DEAD_STATES.has(state);
}

function uniquePrices(values, tolerance = 0) {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const out = [];
  sorted.forEach((value) => {
    if (!out.some((existing) => Math.abs(existing - value) <= tolerance)) out.push(value);
  });
  return out;
}

function directionalEntry(zone, bullish, lastClose) {
  const range = zoneRange(zone);
  if (!range) return null;
  // A long entry comes from demand below/at price; a short entry comes from
  // supply above/at price. A zone on the wrong side is never used as a target
  // entry just because it is recent.
  if (bullish) {
    if (lastClose < range.bottom) return null;
    return Math.min(lastClose, range.top);
  }
  if (lastClose > range.top) return null;
  return Math.max(lastClose, range.bottom);
}

function zoneRank(item, candles, lastClose, atrValue, bullish) {
  const range = zoneRange(item);
  if (!range) return -Infinity;
  const mid = (range.top + range.bottom) / 2;
  const distance = Number.isFinite(atrValue) && atrValue > 0
    ? Math.abs(mid - lastClose) / atrValue : Math.abs(mid - lastClose);
  const state = String(item?.state || '').toLowerCase();
  const stateScore = state === 'active' ? 30 : state === 'tested' ? 20 : state === 'partial' ? 10 : 0;
  const relevance = Number.isFinite(Number(item?.relevance)) ? Number(item.relevance) : 0;
  const kind = /ob|order/i.test(String(item?.type || item?.kind || '')) ? 4 : 2;
  const recency = indexOfTime(candles, item?.confirmedTime ?? item?.time);
  const side = directionalEntry(item, bullish, lastClose) == null ? -1000 : 0;
  return side + relevance + stateScore + kind - distance * 4 + Math.max(0, recency) / Math.max(1, candles.length);
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
  const gaps = Array.isArray(analysis?.fvgs?.gaps)
    ? analysis.fvgs.gaps
    : (Array.isArray(analysis?.fvgs) ? analysis.fvgs : []);
  const mitigatedZones = Array.isArray(analysis?.mitigatedZones) ? analysis.mitigatedZones : [];
  const levels = Array.isArray(analysis?.liquidity?.levels)
    ? analysis.liquidity.levels
    : (Array.isArray(analysis?.liquidity) ? analysis.liquidity : []);
  const vol = atr(candles);
  const buffer = Math.max(
    Number.isFinite(vol) && vol > 0 ? vol * 0.2 : 0,
    lastClose * 0.0005,
  );
  const bull = direction === 'bullish';

  // Entry: choose the nearest live, same-direction demand/supply zone first.
  // The engine equilibrium is only a fallback; it must never override a
  // confirmed OB/FVG that is actually available for the current setup.
  const zonePool = (mitigatedZones.length ? mitigatedZones : [...blocks, ...gaps])
    .filter((item) => item && isLiveZone(item) && matchesDirection(item, bull))
    .filter((item, index, list) => list.findIndex((other) => (
      other.time === item.time && Number(other.top) === Number(item.top)
        && Number(other.bottom) === Number(item.bottom)
    )) === index);
  const entryZone = zonePool
    .map((item) => ({ item, score: zoneRank(item, candles, lastClose, vol, bull) }))
    .filter(({ item }) => directionalEntry(item, bull, lastClose) != null)
    .sort((a, b) => b.score - a.score)[0]?.item || null;
  const equilibrium = num(analysis?.premiumDiscount?.equilibrium);
  const setupEntry = num(setup.entry);
  let entry = entryZone ? directionalEntry(entryZone, bull, lastClose) : setupEntry;
  if (!Number.isFinite(entry)) entry = equilibrium;
  if (!Number.isFinite(entry)) entry = lastClose;
  if (entry <= 0) return null;

  // Stop: use the nearest valid structural invalidation point beneath/above
  // entry, including the selected zone edge and same-side liquidity. Keep a
  // minimum ATR-based risk so a one-tick stop is never presented as a trade.
  const structuralRiskPrices = [
    ...((bull ? lows : highs).map((s) => num(s?.price))),
    ...levels.map((level) => num(level?.price ?? (bull ? level?.bottom : level?.top))),
    num(setup.stopLoss),
    num(analysis?.premiumDiscount?.[bull ? 'swingLow' : 'swingHigh']),
  ].filter((price) => Number.isFinite(price) && (bull ? price < entry : price > entry));
  const entryZoneRange = zoneRange(entryZone);
  const zoneBoundedRiskPrices = entryZoneRange
    ? structuralRiskPrices.filter((price) => (bull
      ? price <= entryZoneRange.bottom
      : price >= entryZoneRange.top))
    : structuralRiskPrices;
  const riskPrices = entryZoneRange
    ? [...zoneBoundedRiskPrices, bull ? entryZoneRange.bottom : entryZoneRange.top]
    : zoneBoundedRiskPrices;
  const ref = bull
    ? Math.max(...riskPrices, entry - buffer * 4)
    : Math.min(...riskPrices, entry + buffer * 4);
  const minRisk = Math.max(
    Number.isFinite(vol) && vol > 0 ? vol * 0.75 : 0,
    buffer * 2,
  );
  const rawStop = bull ? ref - buffer : ref + buffer;
  const stopLoss = bull
    ? Math.min(rawStop, entry - minRisk)
    : Math.max(rawStop, entry + minRisk);
  const risk = Math.abs(entry - stopLoss);
  if (!(risk > 0) || !Number.isFinite(risk) || stopLoss <= 0) return null;

  // Targets: nearest opposing swings/liquidity first, then measured-R fallbacks.
  const oppSwings = (bull ? highs : lows)
    .filter((s) => bull ? s.price > entry : s.price < entry)
    .map((s) => s.price);
  const oppLiq = levels
    .map((l) => num(l?.price ?? (bull ? l?.top : l?.bottom)))
    .filter((p) => Number.isFinite(p) && (bull ? p > entry : p < entry));
  const setupTarget = num(setup.takeProfit);
  const rangeTarget = num(analysis?.premiumDiscount?.[bull ? 'swingHigh' : 'swingLow']);
  const opposingZones = [...blocks, ...gaps]
    .filter((item) => item && isLiveZone(item) && !matchesDirection(item, bull))
    .map((item) => {
      const range = zoneRange(item);
      return range ? (bull ? range.bottom : range.top) : NaN;
    })
    .filter((price) => Number.isFinite(price) && (bull ? price > entry : price < entry));
  const anchors = uniquePrices(
    [...oppSwings, ...oppLiq, ...opposingZones, setupTarget, rangeTarget]
      .filter((price) => bull ? price > entry : price < entry),
    risk * 0.25,
  ).sort((a, b) => (bull ? a - b : b - a));
  // A target must offer at least a modest 1.25R; a nearby level is not a
  // meaningful target for a setup whose stop is structurally wider.
  const picked = [];
  const targetSources = [];
  const minTargetDistance = risk * 1.25;
  for (const p of anchors) {
    if (Math.abs(p - entry) < minTargetDistance) continue;
    if (!picked.every((q) => Math.abs(q - p) > risk * 0.5)) continue;
    picked.push(p);
    targetSources.push('structure');
    if (picked.length >= 3) break;
  }
  // Extend beyond the last anchor; a distant TP1 must never precede a nearer TP2.
  const multiples = [1.5, 2.5, 4];
  while (picked.length < 3) {
    const previousDistance = picked.length ? Math.abs(picked.at(-1) - entry) : 0;
    const distance = Math.max(risk * multiples[picked.length], previousDistance + risk);
    picked.push(bull ? entry + distance : entry - distance);
    targetSources.push(`${multiples[picked.length - 1]}R`);
  }
  if (picked.some((price) => !Number.isFinite(price) || price <= 0)) return null;

  return {
    direction,
    entry,
    stopLoss,
    takeProfits: picked.slice(0, 3),
    risk,
    riskReward: picked.slice(0, 3).map((price) => Math.abs(price - entry) / risk),
    entryTime: entryZone?.confirmedTime ?? entryZone?.time ?? last.time ?? null,
    entrySource: entryZone ? (String(entryZone.type || entryZone.kind || 'zone').toUpperCase()) : 'equilibrium/price',
    stopSource: riskPrices.length ? 'structure+ATR' : 'ATR fallback',
    targetSources: targetSources.slice(0, 3),
  };
}
