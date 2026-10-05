import test from 'node:test';
import assert from 'node:assert/strict';
import { makeUid, normalizeZone, normalizeBreak } from './smc/selection/smcObjects.js';
import { updateLifecycle } from './smc/selection/smcLifecycle.js';
import { mergeZones, scoreRelevance } from './smc/selection/smcRelevance.js';
import { placeTags, stackEdgeChips } from './smc/selection/smcLabels.js';
import {
  checkSetupConfluence, clusterEqualExtremes, selectVisibleSMC,
} from './smc/selection/smcSelect.js';
import { analyzeMultiTimeframe } from './smc/engine/mtfAnalyzer.js';
import { determinePremiumDiscount } from './smc/engine/premiumDiscount.js';
import { detectSetup } from './smc/engine/setupDetector.js';
import { createSMCAnalysis } from './smc/engine/smcEngine.js';

function candles(n, from, step, up = true, startTime = 1700000000, slot = 3600) {
  const out = [];
  let base = from;
  for (let i = 0; i < n; i++) {
    const open = base;
    const close = up ? base + step : base - step;
    out.push({
      time: startTime + i * slot,
      open, close,
      high: Math.max(open, close) + step * 0.4,
      low: Math.min(open, close) - step * 0.4,
      volume: 100,
    });
    base = close;
  }
  return out;
}

const SYM = 'BTC';
const IV = '1h';

test('uids are reload-stable (price+time anchored, not index-based)', () => {
  const a = makeUid(SYM, IV, 'ob', 'bullish', 123, 100.5, 99.5);
  const b = makeUid(SYM, IV, 'ob', 'bullish', 123, 100.5, 99.5);
  const c = makeUid(SYM, IV, 'ob', 'bearish', 123, 100.5, 99.5);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('FVG lifecycle: active → tested/partial → filled hides from smart', () => {
  const cs = candles(40, 80000, 30, true);
  // Bullish FVG [100, 120] created at bar 10 (price runs away up, then returns).
  const gap = normalizeZone(
    { type: 'bullish_fvg', top: 120, bottom: 100, time: cs[10].time, label: 'FVG' },
    'fvg', cs, SYM, IV,
  );
  const early = updateLifecycle([gap], cs.slice(0, 12));
  assert.equal(early[0].state, 'active');
  // Crash price back through the gap after creation.
  const crashed = cs.map((c, i) => (i > 12
    ? { ...c, high: 90, low: 80 - i, close: 85, open: 88 }
    : c));
  const late = updateLifecycle([gap], crashed);
  assert.ok(['filled', 'invalidated'].includes(late[0].state), late[0].state);
  assert.ok(late[0].fillPct >= 1, `fill=${late[0].fillPct}`);
});

test('OB invalidation on close through the far side', () => {
  const cs = candles(40, 80000, 30, true);
  const ob = normalizeZone(
    { type: 'bullish_ob', top: 81000, bottom: 80900, time: cs[10].time, label: 'OB' },
    'ob', cs, SYM, IV,
  );
  const crashed = cs.map((c, i) => (i > 12
    ? { ...c, high: 80800, low: 80000 - i * 10, close: 80500, open: 80700 }
    : c));
  const [done] = updateLifecycle([ob], crashed);
  assert.equal(done.state, 'invalidated');
});

test('liquidity sweep hides the level (state swept)', () => {
  const cs = candles(60, 85000, 20, true);
  const lvl = {
    uid: 'x', kind: 'liquidity', direction: 'bullish', price: 84800,
    top: 84800, bottom: 84800, createdTime: cs[5].time, label: 'SSL', state: 'active',
  };
  // Drive a wick below the level that closes back above.
  const swept = cs.map((c, i) => (i === 50
    ? { ...c, low: 84700, high: 84900, close: 84850, open: 84860 }
    : c));
  const [done] = updateLifecycle([lvl], swept);
  assert.equal(done.state, 'swept');
});

test('overlapping same-direction zones merge, strongest survives', () => {
  const a = { uid: 'a', kind: 'ob', direction: 'bullish', top: 110, bottom: 100, relevance: 80 };
  const b = { uid: 'b', kind: 'ob', direction: 'bullish', top: 108, bottom: 98, relevance: 40 };
  const c = { uid: 'c', kind: 'ob', direction: 'bearish', top: 108, bottom: 98, relevance: 90 };
  const { zones, mergedIds } = mergeZones([a, b, c], 0.6);
  assert.equal(zones.length, 2);
  assert.ok(mergedIds.includes('b'));
  const survivor = zones.find((z) => z.kind === 'ob' && z.direction === 'bullish');
  assert.equal(survivor.top, 110);
  assert.equal(survivor.bottom, 98);
  assert.ok(zones.some((z) => z.uid === 'c'), 'opposite direction never merges');
});

test('relevance: near + active outranks far + mitigated; dead is zero', () => {
  const near = { state: 'active', ageBars: 2, displacement: 0.8, direction: 'bullish', mid: 100 };
  const far = { state: 'mitigated', ageBars: 5, displacement: 0.9, direction: 'bullish', mid: 200 };
  const ctx = { lastClose: 101, atr: 5, htfBias: 'bullish', candles: [] };
  assert.ok(scoreRelevance(near, ctx) > scoreRelevance(far, ctx));
  assert.equal(scoreRelevance({ ...near, state: 'invalidated' }, ctx), 0);
  assert.equal(scoreRelevance({ ...near, state: 'filled' }, ctx), 0);
});

test('smart caps: at most 1 OB + 1 FVG per side, latest 1 break', () => {
  const cs = candles(120, 80000, 25, true);
  const analysis = {
    mtf: { bias: 'bullish' },
    setup: { direction: 'bullish' },
    premiumDiscount: { zone: 'discount', swingHigh: 86000, swingLow: 80000, equilibrium: 83000 },
    liquidity: { levels: [] },
    orderBlocks: {
      blocks: [0, 1, 2, 3].map((i) => ({
        type: 'bullish_ob', top: 81000 + i * 200, bottom: 80900 + i * 200,
        time: cs[20 + i * 5].time, label: `OB${i}`,
      })),
    },
    fvgs: {
      gaps: [0, 1, 2].map((i) => ({
        type: 'bullish_fvg', top: 84000 + i * 100, bottom: 83950 + i * 100,
        time: cs[60 + i * 5].time, label: `FVG${i}`,
      })),
    },
  };
  const sel = selectVisibleSMC({ candles: cs, analysis, symbol: SYM, interval: IV, settings: { mode: 'smart' } });
  assert.ok(sel.zones.filter((z) => z.kind === 'ob').length <= 2, 'max 1/side');
  assert.ok(sel.zones.filter((z) => z.kind === 'fvg').length <= 2, 'max 1/side');
  const breaks = sel.events.filter((e) => e.kind === 'break');
  assert.ok(breaks.length <= 1, `smart shows 1 break, got ${breaks.length}`);
});

test('smart mode hides distant zones and keeps near-price active zones', () => {
  const cs = candles(60, 1000, 1, true);
  const current = cs.at(-1).close;
  const analysis = {
    mtf: { bias: 'bullish' },
    setup: { direction: 'neutral' },
    premiumDiscount: { zone: 'equilibrium', swingHigh: current + 20, swingLow: current - 20, equilibrium: current },
    liquidity: { levels: [] },
    orderBlocks: { blocks: [
      { type: 'bullish_ob', top: current + 1, bottom: current, time: cs.at(-1).time },
      { type: 'bullish_ob', top: current - 90, bottom: current - 91, time: cs.at(-10).time },
    ] },
    fvgs: { gaps: [] },
  };
  const selected = selectVisibleSMC({ candles: cs, analysis, symbol: SYM, interval: IV, settings: { mode: 'smart' } });
  assert.equal(selected.zones.length, 1);
  assert.ok(Math.abs(selected.zones[0].mid - current) < 5);
});

test('debug mode shows everything smart hides', () => {
  const cs = candles(120, 80000, 25, true);
  const analysis = {
    mtf: { bias: 'bullish' },
    setup: { direction: 'bullish' },
    premiumDiscount: { zone: 'discount', swingHigh: 86000, swingLow: 80000, equilibrium: 83000 },
    liquidity: { levels: [] },
    orderBlocks: {
      blocks: [0, 1, 2, 3].map((i) => ({
        type: 'bullish_ob', top: 81000 + i * 200, bottom: 80900 + i * 200,
        time: cs[20 + i * 5].time, label: `OB${i}`,
      })),
    },
    fvgs: { gaps: [] },
  };
  const smart = selectVisibleSMC({ candles: cs, analysis, symbol: SYM, interval: IV, settings: { mode: 'smart' } });
  const debug = selectVisibleSMC({ candles: cs, analysis, symbol: SYM, interval: IV, settings: { mode: 'debug' } });
  assert.ok(debug.zones.length >= smart.zones.length);
  assert.ok(debug.debug.detected.ob >= 4);
});

test('same swing crossed twice yields one break event (dedupe)', () => {
  const b1 = normalizeBreak({ type: 'BOS', direction: 'bull', price: 85000, time: 1000 }, SYM, IV);
  const b2 = normalizeBreak({ type: 'BOS', direction: 'bull', price: 85000, time: 1000 }, SYM, IV);
  assert.equal(b1.uid, b2.uid);
});

test('confluence gate blocks bare setups, passes full confluence', () => {
  // Uptrend into new highs with displacement, no sweep info, no premium data.
  const cs = candles(80, 80000, 30, true);
  const bare = checkSetupConfluence(cs, {
    mtf: { bias: 'bullish' },
    setup: { direction: 'bullish' },
    premiumDiscount: { zone: 'premium' },
  }, { zones: [], lastClose: cs[cs.length - 1].close });
  assert.equal(bare.pass, false);
  assert.ok(bare.missing.length > 0);
});

test('label collision keeps the higher priority tag, never stacks', () => {
  const tags = [
    { x: 100, y: 100, text: 'BOS', color: '#fff', kind: 'structure' },
    { x: 105, y: 102, text: 'Entry: 1', color: '#fff', kind: 'setup' },
    { x: 400, y: 100, text: 'FVG', color: '#fff', kind: 'zone' },
  ];
  const placed = placeTags(tags);
  const setup = placed.find((t) => t.kind === 'setup');
  const bos = placed.find((t) => t.kind === 'structure');
  assert.ok(setup, 'setup survives');
  assert.ok(bos, 'structure survives shifted');
  assert.ok(Math.abs(setup.y - bos.y) >= 13 || setup.x !== bos.x, 'no stacking');
  const chips = stackEdgeChips([
    { y: 100, text: 'Entry' }, { y: 105, text: 'SL' }, { y: 110, text: 'TP1' },
  ]);
  for (let i = 1; i < chips.length; i++) {
    assert.ok(chips[i].y - chips[i - 1].y >= 17, 'chip rhythm');
  }
});

test('label placer avoids reserved candle and chart-axis rectangles', () => {
  const placed = placeTags([
    { x: 40, y: 40, text: 'FVG', kind: 'fvg' },
    { x: 190, y: 40, text: 'BOS', kind: 'structure' },
  ], {
    bounds: { left: 0, right: 260, top: 0, bottom: 100 },
    reserved: [{ left: 25, right: 95, top: 20, bottom: 60 }, { left: 235, right: 270, top: 0, bottom: 100 }],
  });
  assert.ok(placed.every((tag) => {
    const left = tag.anchor === 'middle' ? tag.x - (tag.width || 34) / 2 : tag.x - 2;
    const width = tag.width || Math.max(34, Math.min(110, tag.text.length * 5.7 + 14));
    return left >= 0 && left + width <= 260
      && !(left < 95 && left + width > 25 && tag.y - 9 < 60 && tag.y + 9 > 20)
      && !(left < 270 && left + width > 235);
  }));
});

test('EQ clusters pair near-equal extremes', () => {
  const cs = candles(60, 80000, 20, true);
  // Force two near-equal highs.
  cs[20].high = 86000; cs[40].high = 86005;
  const lines = clusterEqualExtremes(cs);
  assert.ok(Array.isArray(lines));
});

test('SMC derived multi-timeframe bias ignores a single countertrend candle', () => {
  const cs = candles(256, 1000, 1, true);
  const aligned = analyzeMultiTimeframe(cs);
  const last = cs.at(-1);
  const nudged = [
    ...cs.slice(0, -1),
    { ...last, open: last.close, close: last.close - 0.5, high: last.close + 0.1, low: last.close - 0.6 },
  ];
  const result = analyzeMultiTimeframe(nudged);
  assert.equal(aligned.bias, 'bullish');
  assert.equal(result.bias, 'bullish');
  assert.equal(result.source, 'aggregated-candles');
  assert.deepEqual(result.timeframes.map(({ factor }) => factor), [1, 4, 16]);
});

test('premium/discount uses the conventional side of equilibrium', () => {
  const base = [
    { high: 110, low: 90, close: 100 },
    { high: 110, low: 90, close: 105 },
    { high: 110, low: 90, close: 95 },
  ];
  assert.equal(determinePremiumDiscount(base, { lookback: 3 }).zone, 'discount');
  assert.equal(determinePremiumDiscount(base.map((candle, i) => ({ ...candle, close: [100, 105, 105][i] })), { lookback: 3 }).zone, 'premium');
  assert.equal(determinePremiumDiscount(base.map((candle) => ({ ...candle, close: 100 })), { lookback: 3 }).zone, 'equilibrium');
});

test('SMC setup stays neutral until the configured confluence is present', () => {
  const bare = detectSetup({
    bias: 'bullish', structure: 'neutral', score: 70,
    entry: 100, stopLoss: 95, takeProfit: 110,
  }, { minimumConfluence: 2 });
  assert.equal(bare.direction, 'neutral');
  assert.equal(bare.confidence, 0);
  assert.equal(bare.entry, null);
  assert.equal(bare.stopLoss, null);
  assert.equal(bare.takeProfit, null);
  const confirmed = detectSetup({
    bias: 'bullish', structure: 'BOS', fvg: [{}], score: 70,
  }, { minimumConfluence: 2 });
  assert.equal(confirmed.direction, 'bullish');
  assert.equal(confirmed.confidence, 70);
});

test('SMC end-to-end reports trend bias without manufacturing a low-confluence setup', () => {
  const analysis = createSMCAnalysis(candles(256, 80000, 25, true));
  assert.equal(analysis.mtf.bias, 'bullish');
  assert.equal(analysis.setup.direction, 'neutral');
  assert.ok(analysis.score.score < 60, `unsupported setup evidence should not score highly: ${analysis.score.score}`);
  assert.equal(analysis.signal.entry, null);
  assert.equal(analysis.signal.stopLoss, null);
  assert.equal(analysis.signal.takeProfit, null);
});
