/**
 * StockOracle Pro — SMC visibility selector (detection → what to paint).
 *
 * The engine may detect hundreds of objects; this pure module decides the
 * handful that reach the chart:
 *   normalize (stable uids) → lifecycle → merge overlaps → relevance rank
 *   → per-mode caps + minScore → confluence-gated setup.
 *
 * Modes: smart (default) / minimal / full / debug. DEBUG is the ONLY mode
 * that can reproduce the old show-everything clutter — never the default.
 */

import { detectBosChoch, detectStructureSequence, detectSwingPoints } from '../../marketStructure.js';
import { deriveSetupLevels, findSwings } from '../engine/setupLevels.js';
import { atr, directionOf, normalizeBreak, normalizeSwingEvent, normalizeZone } from './smcObjects.js';
import { updateLifecycle } from './smcLifecycle.js';
import { mergeZones, rankObjects } from './smcRelevance.js';

export const SMC_MODES = ['smart', 'minimal', 'full', 'debug'];

const MODE_CAPS = {
  smart: { breaks: 1, swings: 4, liq: 2, obSide: 1, fvgSide: 1, eq: 0, minScore: 20, dead: false },
  minimal: { breaks: 1, swings: 0, liq: 2, obSide: 0, fvgSide: 0, eq: 0, minScore: 30, dead: false },
  full: { breaks: 6, swings: 10, liq: 8, obSide: 3, fvgSide: 3, eq: 4, minScore: 0, dead: true },
  debug: { breaks: 1e9, swings: 1e9, liq: 1e9, obSide: 1e9, fvgSide: 1e9, eq: 1e9, minScore: 0, dead: true },
};

const LIVE_ZONE_STATES = new Set(['active', 'tested', 'partial']);

function indexOf(candles, time) {
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i]?.time === time) return i;
  }
  return -1;
}

function timeAt(candles, idx) {
  const c = candles[Math.max(0, Math.min(candles.length - 1, idx))];
  return c ? c.time : null;
}

/** Previous IST day + week extremes as liquidity (intraday only). */
export function previousSessionLevels(candles) {
  const out = [];
  try {
    if (!Array.isArray(candles) || candles.length < 30) return out;
    const sample = candles[0]?.time;
    if (typeof sample !== 'number') return out; // daily series: skip
    const IST = 19800;
    const dayOf = (t) => Math.floor((t + IST) / 86400);
    const byDay = new Map();
    for (const c of candles) {
      if (typeof c?.time !== 'number') continue;
      const d = dayOf(c.time);
      const g = byDay.get(d) || { hi: -Infinity, lo: Infinity, lastTime: c.time };
      g.hi = Math.max(g.hi, Number(c.high) || -Infinity);
      g.lo = Math.min(g.lo, Number(c.low) || Infinity);
      g.lastTime = c.time;
      byDay.set(d, g);
    }
    const days = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
    if (days.length < 2) return out;
    const prev = days[days.length - 2][1];
    const week = days.slice(Math.max(0, days.length - 6), days.length - 1);
    const wHi = Math.max(...week.map(([, g]) => g.hi));
    const wLo = Math.min(...week.map(([, g]) => g.lo));
    const mk = (type, price, label, color) => ({
      kind: 'liquidity', rawType: type, type, price, top: price, bottom: price,
      time: prev.lastTime, label, color, direction: /high/i.test(type) ? 'bearish' : 'bullish',
    });
    if (Number.isFinite(prev.hi)) out.push(mk('pdh', prev.hi, `PDH ${prev.hi.toFixed(1)}`, '#EF5350'));
    if (Number.isFinite(prev.lo)) out.push(mk('pdl', prev.lo, `PDL ${prev.lo.toFixed(1)}`, '#10B981'));
    if (Number.isFinite(wHi)) out.push(mk('pwh', wHi, `PWH ${wHi.toFixed(1)}`, '#EF5350'));
    if (Number.isFinite(wLo)) out.push(mk('pwl', wLo, `PWL ${wLo.toFixed(1)}`, '#10B981'));
  } catch {}
  return out;
}

/** Equal highs/lows: ≥2 swing extremes within tolerance (latest clusters). */
export function clusterEqualExtremes(candles, tolerance = 0.0008, lookback = 120) {
  const lines = [];
  try {
    const { highs, lows } = findSwings(candles.slice(-lookback), 3, 60);
    const cluster = (pts, isHigh) => {
      const groups = [];
      for (let i = 0; i < pts.length; i++) {
        const group = [pts[i]];
        for (let j = i + 1; j < pts.length; j++) {
          if (Math.abs(pts[j].price - pts[i].price) / Math.max(1, pts[i].price) < tolerance) group.push(pts[j]);
        }
        if (group.length >= 2) groups.push(group);
      }
      return groups.slice(-2).map((g) => ({
        price: isHigh ? Math.max(...g.map((p) => p.price)) : Math.min(...g.map((p) => p.price)),
        fromTime: g[0].time,
        label: isHigh ? 'EQH' : 'EQL',
        color: '#EF5350',
      }));
    };
    lines.push(...cluster(highs, true), ...cluster(lows, false));
  } catch {}
  return lines;
}

/** Recent displacement: any of the last N bodies exceeding k×ATR. */
export function recentDisplacement(candles, bars = 10, k = 1.2) {
  try {
    const a = atr(candles);
    if (!Number.isFinite(a) || a <= 0) return false;
    const rows = candles.slice(-bars);
    return rows.some((c) => Math.abs(Number(c?.close) - Number(c?.open)) > a * k);
  } catch {
    return false;
  }
}

function barsSince(candles, time) {
  const i = indexOf(candles, time);
  return i < 0 ? Infinity : candles.length - 1 - i;
}

/**
 * Setup confluence gate — a setup paints ONLY when everything agrees:
 * HTF bias + same-side sweep + same-direction MSS/CHoCH + displacement +
 * live same-direction OB/FVG + price in discount/premium.
 */
export function checkSetupConfluence(candles, analysis, pool = {}) {
  const missing = [];
  const reasons = [];
  const setup = analysis?.setup || {};
  const direction = setup.direction || analysis?.summary?.direction || 'neutral';
  const bull = direction === 'bullish';
  if (!bull && direction !== 'bearish') {
    return { pass: false, direction, reasons, missing: ['no directional bias'] };
  }

  const htf = String(analysis?.mtf?.bias || '').toLowerCase();
  if (htf === direction) reasons.push(`HTF ${direction}`);
  else missing.push(`HTF ${direction === 'bullish' ? 'bullish' : 'bearish'} (is ${htf || 'neutral'})`);

  const liqLevels = Array.isArray(pool) ? pool : (pool.liqLevels || []);
  const anchorRef = Number(pool?.lastClose);
  const swept = liqLevels.filter((l) => l?.state === 'swept' && barsSince(candles, l.sweptAt) <= 40);
  const goodSweep = swept.find((l) => Number.isFinite(anchorRef) && (bull ? l.price < anchorRef : l.price > anchorRef));
  if (goodSweep) reasons.push(`${bull ? 'sell' : 'buy'}-side sweep`);
  else missing.push(`${bull ? 'sell' : 'buy'}-side sweep`);

  let breaks = [];
  try {
    breaks = detectBosChoch(candles, 5);
  } catch {}
  const freshBreak = breaks.find((b) => {
    const bd = b.direction === 'bear' ? 'bearish' : b.direction === 'bull' ? 'bullish' : 'neutral';
    return bd === direction && barsSince(candles, b.time) <= 40;
  });
  if (freshBreak) reasons.push(`${freshBreak.type || 'structural break'}`);
  else missing.push(`${direction} MSS/CHoCH`);

  if (recentDisplacement(candles)) reasons.push('displacement');
  else missing.push('displacement');

  const liveZones = (Array.isArray(pool) ? [] : (pool.zones || [])).filter((z) => z?.direction === direction && ['active', 'tested', 'partial'].includes(z?.state));
  if (liveZones.length) reasons.push(`${direction} ${liveZones[0].kind === 'fvg' ? 'FVG' : 'OB'}`);
  else missing.push(`${direction} OB/FVG`);

  const pdZone = String(analysis?.premiumDiscount?.zone || '').toLowerCase();
  const wantZone = bull ? 'discount' : 'premium';
  if (pdZone === wantZone) reasons.push(`price in ${wantZone}`);
  else missing.push(`price in ${wantZone} (is ${pdZone || 'unknown'})`);

  return { pass: missing.length === 0, direction, reasons, missing };
}

function nearestSide(levels, lastClose, side, n) {
  return levels
    .filter((l) => Number.isFinite(l?.price) && (side > 0 ? l.price > lastClose : l.price < lastClose))
    .sort((a, b) => side > 0 ? a.price - b.price : b.price - a.price)
    .slice(0, n);
}

export function selectVisibleSMC({ candles, analysis, symbol, interval, settings = {} }) {
  const debug = { detected: { ob: 0, fvg: 0, liq: 0, breaks: 0, swings: 0 }, visible: { ob: 0, fvg: 0, liq: 0, breaks: 0, swings: 0 }, merged: 0, setupSuppressed: false };
  const empty = { mode: settings.mode || 'smart', zones: [], levels: [], events: [], setup: null, setupMissing: [], eqLines: [], pdRange: null, debug };
  if (!Array.isArray(candles) || candles.length < 20 || !analysis) return empty;

  const mode = SMC_MODES.includes(settings.mode) ? settings.mode : 'smart';
  const caps = { ...MODE_CAPS[mode] };
  if (Number.isFinite(Number(settings.maxOb))) caps.obSide = Number(settings.maxOb);
  if (Number.isFinite(Number(settings.maxFvg))) caps.fvgSide = Number(settings.maxFvg);
  if (Number.isFinite(Number(settings.maxLiquidity))) {
    const configured = Number(settings.maxLiquidity);
    caps.liq = mode === 'smart' ? Math.min(caps.liq, configured) : configured;
  }
  if (Number.isFinite(Number(settings.maxStructure))) {
    caps.breaks = Math.min(caps.breaks, Number(settings.maxStructure));
    caps.swings = Math.min(caps.swings, Number(settings.maxStructure));
  }
  const minScore = Number.isFinite(Number(settings.minScore)) ? Number(settings.minScore) : caps.minScore;
  const visibleBars = Number(settings.visibleBars);
  const zoomedIn = Number.isFinite(visibleBars) && visibleBars > 0 && visibleBars <= 100;
  const zoomedOut = Number.isFinite(visibleBars) && visibleBars > 180;
  if (zoomedIn && mode === 'smart') {
    caps.breaks = Math.max(caps.breaks, 2);
  }

  const last = candles[candles.length - 1];
  const lastClose = Number(last?.close);
  const lastTime = last?.time;
  const a = atr(candles);
  const ctx = { lastClose, atr: Number.isFinite(a) ? a : Math.abs(lastClose) * 0.002, htfBias: analysis?.mtf?.bias, candles };

  // ---- 1. Normalize everything with stable uids ----
  const rawBlocks = analysis?.orderBlocks?.blocks || [];
  const rawGaps = analysis?.fvgs?.gaps || [];
  const rawLevels = [...(analysis?.liquidity?.levels || []), ...previousSessionLevels(candles)];
  debug.detected.ob = rawBlocks.length;
  debug.detected.fvg = rawGaps.length;
  debug.detected.liq = rawLevels.length;

  let zones = [
    ...rawBlocks.map((z) => normalizeZone({ ...z, type: z.type || 'ob' }, 'ob', candles, symbol, interval)),
    ...rawGaps.map((z) => normalizeZone({ ...z, type: z.type || 'fvg' }, 'fvg', candles, symbol, interval)),
  ].filter(Boolean);
  let liqObjs = rawLevels.map((l) => {
    const price = Number(l?.price ?? l?.top ?? l?.bottom);
    if (!Number.isFinite(price)) return null;
    return {
      uid: `${String(symbol).toUpperCase()}|${String(interval).toLowerCase()}|liquidity|${directionOf(l.type)}|${l.time ?? 'na'}|${price}`,
      kind: 'liquidity',
      direction: directionOf(l.type),
      price, top: Number(l.top), bottom: Number(l.bottom),
      createdTime: l.time ?? null,
      label: l.label || 'Liquidity',
      color: l.color || null,
      rawType: l.type || 'liquidity',
      state: 'active',
      retests: 0,
      displacement: 0.3,
      ageBars: 0,
      relevance: 0,
    };
  }).filter(Boolean);

  // ---- 2. Lifecycle ----
  zones = updateLifecycle(zones, candles);
  liqObjs = updateLifecycle(liqObjs, candles);

  // ---- 3. Merge overlaps + rank ----
  const obZones = zones.filter((z) => z.kind === 'ob');
  const fvgZones = zones.filter((z) => z.kind === 'fvg');
  const mergedOb = mergeZones(obZones);
  const mergedFvg = mergeZones(fvgZones);
  debug.merged = mergedOb.mergedIds.length + mergedFvg.mergedIds.length;
  zones = rankObjects([...mergedOb.zones, ...mergedFvg.zones], ctx);
  liqObjs = rankObjects(liqObjs, ctx);

  // ---- 4. Breaks + swings (deduped by stable uid: one swing = one event) ----
  let breaks = [];
  let swingEvents = [];
  try {
    const rawBreaks = detectBosChoch(candles, 5);
    debug.detected.breaks = rawBreaks.length;
    const seen = new Set();
    breaks = rawBreaks.map((b) => normalizeBreak(b, symbol, interval)).filter(Boolean)
      .filter((b) => (seen.has(b.uid) ? false : (seen.add(b.uid), true)));
    const swings = detectSwingPoints(candles, 5);
    const seq = detectStructureSequence(swings);
    debug.detected.swings = (swings.highs?.length || 0) + (swings.lows?.length || 0);
    const seenS = new Set();
    swingEvents = seq.map((e) => normalizeSwingEvent(e, symbol, interval)).filter(Boolean)
      .filter((e) => (seenS.has(e.uid) ? false : (seenS.add(e.uid), true)));
  } catch {}

  const maxDistanceAtr = mode === 'smart' ? (zoomedIn ? 2.5 : zoomedOut ? 2 : 3.5) : Infinity;
  const nearCurrentPrice = (o) => {
    const price = Number(o?.price ?? o?.mid ?? ((Number(o?.top) + Number(o?.bottom)) / 2));
    return Number.isFinite(price) && Math.abs(price - lastClose) <= ctx.atr * maxDistanceAtr;
  };
  const pass = (o) => o && (caps.dead || LIVE_ZONE_STATES.has(o.state))
    && (o.relevance ?? 0) >= minScore
    && (mode !== 'smart' || nearCurrentPrice(o));

  // ---- 5. Per-side caps ----
  const takeSide = (list, dir, n) => list.filter((z) => z.direction === dir && pass(z)).slice(0, n);
  const visObBull = takeSide(zones.filter((z) => z.kind === 'ob'), 'bullish', caps.obSide);
  const visObBear = takeSide(zones.filter((z) => z.kind === 'ob'), 'bearish', caps.obSide);
  const visFvgBull = takeSide(zones.filter((z) => z.kind === 'fvg'), 'bullish', caps.fvgSide);
  const visFvgBear = takeSide(zones.filter((z) => z.kind === 'fvg'), 'bearish', caps.fvgSide);
  const visZones = [...visObBull, ...visObBear, ...visFvgBull, ...visFvgBear];

  // Liquidity: nearest BSL + nearest SSL always first, then ranked rest.
  const priced = liqObjs.filter((l) => Number.isFinite(l.price) && pass(l));
  const bsl = nearestSide(priced, lastClose, 1, 1);
  const ssl = nearestSide(priced, lastClose, -1, 1);
  const sweptRecent = liqObjs.filter((l) => l.state === 'swept' && barsSince(candles, l.sweptAt) <= 40);
  const rest = priced.filter((l) => l !== bsl[0] && l !== ssl[0] && l.state !== 'swept');
  // BSL + SSL + fresh sweeps always lead; ranked rest fills the cap.
  const visLiq = [...sweptRecent, ...bsl, ...ssl, ...rest]
    .filter((l, i, arr) => arr.indexOf(l) === i)
    .slice(0, Math.max(caps.liq, 2));

  // EQ lines (clustered extremes), capped.
  const eqLines = mode === 'minimal' ? [] : clusterEqualExtremes(candles).slice(0, caps.eq);

  // Breaks: latest only in smart/minimal (MSS-aware label kept by layer).
  const breakPriority = (event) => /mss|choch/i.test(event.breakType) ? 2 : /bos/i.test(event.breakType) ? 1 : 0;
  const visBreaks = [...breaks]
    .sort((x, y) => breakPriority(y) - breakPriority(x)
      || (indexOf(candles, y.createdTime) - indexOf(candles, x.createdTime)))
    .slice(0, zoomedOut && mode === 'smart' ? 1 : caps.breaks);
  // Swings: nearest-to-edge tags only (never the full history).
  const latestBySwing = new Map();
  [...swingEvents]
    .sort((x, y) => indexOf(candles, y.createdTime) - indexOf(candles, x.createdTime))
    .forEach((event) => {
      const type = String(event.label || event.swingType || '').toUpperCase();
      const price = Number(event.price);
      const near = Number.isFinite(price) && Math.abs(price - lastClose) <= ctx.atr * 4;
      if (!latestBySwing.has(type) && type && (mode !== 'smart' || near)) latestBySwing.set(type, event);
    });
  const visSwings = [...latestBySwing.values()]
    .slice(0, zoomedOut && mode === 'smart' ? 0 : caps.swings);

  // ---- 6. Setup: confluence-gated (all modes incl. minimal), levels from
  // the tested deriver. Without confluence no setup paints — never bare
  // OB/FVG/BOS alone.
  let setup = null;
  let setupMissing = [];
  {
    const gate = checkSetupConfluence(candles, analysis, { zones: visZones, liqLevels: liqObjs, lastClose });
    setupMissing = gate.missing;
    if (gate.pass) {
      try {
        const lv = deriveSetupLevels(candles, analysis);
        if (lv) {
          setup = {
            ...lv,
            fromTime: candles[Math.max(0, candles.length - 60)]?.time ?? lastTime,
            entryTime: lastTime,
          };
        }

      } catch {}
    } else {
      debug.setupSuppressed = true;
    }
  }

  // A valid setup owns the visual focus; unrelated opposite-side zones and
  // liquidity are hidden rather than competing with its levels.
  let visibleLevels = visLiq;
  let visibleZones = visZones;
  if (setup && mode === 'smart') {
    visibleZones = visZones.filter((z) => z.direction === setup.direction);
    visibleLevels = visLiq.filter((l) => l.state === 'swept' || l.direction === setup.direction).slice(0, 3);
  }
  if (zoomedOut && mode === 'smart') {
    visibleZones = visibleZones.filter((z) => z.kind === 'ob' || z.relevance >= minScore + 15);
    visibleLevels = visibleLevels.slice(0, 2);
  }

  // Premium/discount dealing range (current only).
  const pd = analysis?.premiumDiscount || null;
  const pdRange = pd && Number.isFinite(Number(pd.swingHigh)) && Number.isFinite(Number(pd.swingLow))
    ? { top: Number(pd.swingHigh), bottom: Number(pd.swingLow), mid: Number(pd.equilibrium) }
    : null;

  // Segment end times for short break lines (+14 bars, clamped to live edge).
  const events = [
    ...visBreaks.map((b) => {
      const i = indexOf(candles, b.createdTime);
      return { ...b, segFrom: b.createdTime, segTo: timeAt(candles, i < 0 ? candles.length - 1 : Math.min(candles.length - 1, i + 14)) };
    }),
    ...visSwings.map((s) => ({ ...s, segFrom: null, segTo: null })),
  ];
  const visibleEvents = setup && mode === 'smart'
    ? events.filter((event) => {
      if (event.kind === 'break') return event.direction === setup.direction;
      const label = String(event.label || '').toUpperCase();
      return setup.direction === 'bullish' ? ['HH', 'HL'].includes(label) : ['LH', 'LL'].includes(label);
    })
    : events;

  debug.visible.fvg = visibleZones.filter((z) => z.kind === 'fvg').length;
  debug.visible.ob = visibleZones.filter((z) => z.kind === 'ob').length;
  debug.visible.liq = visibleLevels.length;
  debug.visible.breaks = visibleEvents.filter((e) => e.kind === 'break').length;
  debug.visible.swings = visibleEvents.filter((e) => e.kind === 'swing').length;

  return {
    mode, zones: visibleZones, levels: visibleLevels, events: visibleEvents, setup, setupMissing,
    eqLines, pdRange, debug,
  };
}
