/**
 * StockOracle Pro — SMC relevance ranking + zone merging.
 *
 * Relevance 0..100 per object:
 *   30% lifecycle state   (active > tested > partial > mitigated > swept > dead)
 *   25% distance to price (nearer = more tradeable)
 *   15% freshness         (newer detections outrank stale ones)
 *   15% displacement     (impulsive origin outranks drift)
 *   10% HTF alignment    (with higher-timeframe bias)
 *    5% retests           (tapped-but-held zones matter)
 *
 * Dead states (invalidated / filled / consumed) always score 0 — they can
 * never outrank a live object no matter how fresh.
 *
 * Merging: same-direction zones overlapping ≥60% of the smaller range merge
 * into one render object (keeps the stronger uid + widest range).
 */

import { atr } from './smcObjects.js';

const STATE_FACTOR = {
  active: 1.0,
  tested: 0.8,
  approached: 0.7,
  partial: 0.55,
  mitigated: 0.25,
  swept: 0.1,
  filled: 0,
  consumed: 0,
  invalidated: 0,
};

export function stateFactor(state) {
  return STATE_FACTOR[String(state || '').toLowerCase()] ?? 0.5;
}

function anchorPrice(obj) {
  if (Number.isFinite(Number(obj?.price))) return Number(obj.price);
  if (Number.isFinite(Number(obj?.mid))) return Number(obj.mid);
  const t = Number(obj?.top);
  const b = Number(obj?.bottom);
  if (Number.isFinite(t) && Number.isFinite(b)) return (t + b) / 2;
  return NaN;
}

export function scoreRelevance(obj, ctx = {}) {
  if (!obj || typeof obj !== 'object') return 0;
  const stateF = stateFactor(obj.state);
  if (stateF <= 0) return 0;

  const lastClose = Number(ctx.lastClose);
  const unit = Number(ctx.atr) > 0 ? Number(ctx.atr)
    : (Number.isFinite(lastClose) && lastClose > 0 ? Math.abs(lastClose) * 0.002 : 1);
  const anchor = anchorPrice(obj);
  const distF = Number.isFinite(anchor) && Number.isFinite(lastClose)
    ? 1 / (1 + (Math.abs(anchor - lastClose) / unit) * 0.8)
    : 0.5;
  const age = Math.max(0, Number(obj.ageBars) || 0);
  const freshF = 1 / (1 + age / 60);
  const dispF = Math.max(0, Math.min(1, Number(obj.displacement) || 0));
  const htfBias = String(ctx.htfBias || '').toLowerCase();
  const dir = String(obj.direction || '').toLowerCase();
  const htfF = !htfBias || htfBias === 'neutral' || !dir || dir === 'neutral'
    ? 0.5 : (htfBias === dir ? 1 : 0.2);
  const retestF = Math.min(3, Math.max(0, Number(obj.retests) || 0)) / 3;

  const score = 100 * (
    0.30 * stateF +
    0.25 * distF +
    0.15 * freshF +
    0.15 * dispF +
    0.10 * htfF +
    0.05 * retestF
  );
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

export function rankObjects(objects, ctx = {}) {
  const a = atr(ctx.candles || []);
  const full = { ...ctx, atr: Number.isFinite(a) ? a : ctx.atr };
  return (Array.isArray(objects) ? objects : [])
    .map((o) => ({ ...o, relevance: scoreRelevance(o, full) }))
    .sort((x, y) => y.relevance - x.relevance);
}

/** Price-range overlap ratio vs the smaller zone (0..1). */
export function zoneOverlap(x, y) {
  const t = Math.min(Number(x?.top), Number(y?.top));
  const b = Math.max(Number(x?.bottom), Number(y?.bottom));
  if (![t, b, x?.top, x?.bottom, y?.top, y?.bottom].every(Number.isFinite)) return 0;
  const lo = Math.max(Number(x.bottom), Number(y.bottom));
  const hi = Math.min(Number(x.top), Number(y.top));
  const inter = hi - lo;
  if (!(inter > 0)) return 0;
  const smaller = Math.min(Number(x.top) - Number(x.bottom), Number(y.top) - Number(y.bottom));
  if (!(smaller > 0)) return 0;
  return inter / smaller;
}

/**
 * Merge same-kind+direction zones overlapping ≥ threshold (default 0.6).
 * Survivor keeps the stronger relevance + widest range; loser ids are
 * recorded for the debug panel.
 */
export function mergeZones(zones, threshold = 0.6) {
  const list = [...(Array.isArray(zones) ? zones : [])];
  const mergedIds = [];
  for (let i = 0; i < list.length; i++) {
    if (!list[i]) continue;
    for (let j = i + 1; j < list.length; j++) {
      if (!list[j]) continue;
      const a = list[i];
      const b = list[j];
      if (a.kind !== b.kind || a.direction !== b.direction) continue;
      if ((stateFactor(a.state) > 0) !== (stateFactor(b.state) > 0)) continue;
      if (zoneOverlap(a, b) < threshold) continue;
      const winner = (b.relevance || 0) >= (a.relevance || 0) ? b : a;
      const loser = winner === b ? a : b;
      const top = Math.max(Number(a.top), Number(b.top));
      const bottom = Math.min(Number(a.bottom), Number(b.bottom));
      mergedIds.push(loser.uid);
      list[i] = {
        ...winner,
        top,
        bottom,
        mid: (top + bottom) / 2,
        mergedFrom: [...(winner.mergedFrom || []), loser.uid],
      };
      list[j] = null;
    }
  }
  return { zones: list.filter(Boolean), mergedIds };
}
