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
import { detectSession } from './smc/engine/sessionDetector.js';
import { detectLiquidityZones } from './smc/engine/liquidityDetector.js';
import { detectSMCOrderBlocks } from './smc/engine/orderBlockDetector.js';
import { detectSMCFVGs } from './smc/engine/fvgDetector.js';
import { detectMitigation } from './smc/engine/mitigationDetector.js';
import { detectInducement } from './smc/engine/inducementDetector.js';
import { snapshotSMCCandles } from './smc/engine/smcSnapshot.js';
import { resetSmcDisplay, saveSmcDisplay } from './smcDisplayPrefs.js';

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

test('SMC shows planned Entry, SL and TP levels for directional HTF bias without calling them confirmed', () => {
  const cs = candles(80, 80000, 30, true);
  const selected = selectVisibleSMC({
    candles: cs,
    analysis: {
      mtf: { bias: 'bullish' },
      setup: { direction: 'neutral' },
      premiumDiscount: { swingLow: 80000, swingHigh: 82400, equilibrium: 81200, zone: 'premium' },
      liquidity: { levels: [] },
      orderBlocks: { blocks: [] },
      fvgs: { gaps: [] },
    },
    symbol: SYM,
    interval: IV,
    settings: { mode: 'smart' },
  });

  assert.ok(selected.setup);
  assert.equal(selected.setup.direction, 'bullish');
  assert.equal(selected.setup.confirmed, false);
  assert.ok(selected.setup.stopLoss < selected.setup.entry);
  assert.equal(selected.setup.takeProfits.length, 3);
  assert.ok(selected.setup.entry < selected.setup.takeProfits[0]);
  assert.ok(selected.setup.takeProfits[0] < selected.setup.takeProfits[1]);
  assert.ok(selected.setup.takeProfits[1] < selected.setup.takeProfits[2]);
  assert.equal(selected.debug.setupSuppressed, false);
  assert.ok(selected.setupMissing.length > 0, 'incomplete confluence is still exposed');
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
  assert.deepEqual(Object.keys(analysis.score.components).sort(), [
    'displacement', 'fvg', 'htfAlignment', 'liquiditySweep', 'orderBlock',
    'premiumDiscount', 'session', 'structure', 'volumeVolatility',
  ]);
  assert.equal(analysis.signal.entry, null);
  assert.equal(analysis.signal.stopLoss, null);
  assert.equal(analysis.signal.takeProfit, null);
});

test('default premium/discount uses the last 120 bars, including short histories', () => {
  for (const length of [20, 60, 120, 256]) {
    const cs = candles(length, 1000, 1);
    const actual = determinePremiumDiscount(cs);
    assert.deepEqual(actual, determinePremiumDiscount(cs, { lookback: 120 }));
    assert.equal(actual.swingLow, Math.min(...cs.slice(-120).map((c) => c.low)));
    assert.ok(Number.isFinite(actual.equilibrium));
    assert.equal(actual.zone, 'premium');
  }
  const invalid = determinePremiumDiscount([{ high: NaN, low: null, close: NaN }]);
  assert.equal(invalid.equilibrium, null);
  assert.equal(invalid.zone, 'unknown');
});

test('session detection honors Unix seconds, configured timezones, DST and daily dates', () => {
  const session = (iso, settings) => detectSession({ time: Date.parse(iso) / 1000 }, settings);
  assert.equal(session('2026-10-07T08:30:00Z'), 'london');
  assert.equal(session('2026-01-07T09:30:00Z'), 'london');
  assert.equal(session('2026-10-07T18:00:00Z'), 'newYork');
  assert.equal(session('2026-01-07T19:00:00Z'), 'newYork');
  assert.equal(session('2026-10-07T00:00:00Z'), 'asian');
  assert.equal(session('2026-10-07T12:30:00Z'), 'overnight');
  assert.equal(detectSession({ time: Date.parse('2026-10-07T08:30:00Z') }), 'london');
  assert.equal(detectSession({ time: '2026-10-07' }), 'unknown');
  assert.equal(detectSession({ time: NaN }), 'unknown');
  assert.equal(session('2026-10-07T23:30:00Z', {
    asian: { start: '23:00', end: '01:00', tz: 'UTC' },
  }), 'asian');
  assert.equal(session('2026-10-07T09:30:00Z', { timezoneOffsetMinutes: 0 }), 'london');
});

function sweepCandles(buySide = false) {
  const cs = Array.from({ length: 12 }, (_, i) => ({
    time: 1700000000 + i * 3600, open: 100, high: 102, low: 98, close: 100, volume: 100,
  }));
  cs[3][buySide ? 'high' : 'low'] = buySide ? 110 : 90;
  cs[11][buySide ? 'high' : 'low'] = buySide ? 111 : 89;
  return cs;
}

test('sweeps require a confirmed swing and a wick rejection, not a volume pocket', () => {
  for (const buySide of [true, false]) {
    const cs = sweepCandles(buySide);
    assert.equal(detectLiquidityZones(cs.slice(0, 11)).sweeps.length, 0);
    const result = detectLiquidityZones(cs);
    assert.equal(result.sweeps.length, 1);
    assert.equal(result.sweeps[0].direction, buySide ? 'bearish' : 'bullish');
    assert.equal(result.sweeps[0].sweptAt, cs.at(-1).time);
    assert.equal(result.sweeps[0].sweptIndex, 11);
    assert.equal(detectLiquidityZones(cs, { sweepDetection: false }).sweeps.length, 0);
    const broken = cs.map((c, i) => i === 8 ? {
      ...c, close: buySide ? 112 : 88, high: buySide ? 113 : 102, low: buySide ? 98 : 87,
    } : c);
    assert.equal(detectLiquidityZones(broken).sweeps.length, 0, 'consumed levels cannot later sweep');
    assert.equal(detectLiquidityZones(cs.slice(0, 7)).sweeps.length, 0, 'confirmation candles do not sweep');
  }
});

test('only recent, bias-aligned sweeps add score and confluence', () => {
  for (const buySide of [false, true]) {
    const prefix = candles(256, 1000, 1);
    const tail = sweepCandles(buySide).map((c, i) => ({
      ...c, time: prefix.at(-1).time + (i + 1) * 3600,
      open: c.open + 1155, high: c.high + 1155, low: c.low + 1155, close: c.close + 1155,
    }));
    const result = createSMCAnalysis([...prefix, ...tail]);
    assert.equal(result.mtf.bias, 'bullish');
    assert.equal(result.setup.reasons.includes('liquidity sweep'), !buySide);
    const visible = selectVisibleSMC({ candles: [...prefix, ...tail], analysis: result, symbol: SYM, interval: IV,
      settings: { mode: 'full', maxLiquidity: 100 } });
    assert.ok(visible.levels.some((level) => level.state === 'swept'
      && level.confirmedTime != null && level.direction === (buySide ? 'bearish' : 'bullish')),
    'selector preserves the detector sweep and its side');
    const disabled = createSMCAnalysis([...prefix, ...tail], { liquidity: { sweepDetection: false } });
    assert.equal(result.score.score - disabled.score.score, buySide ? 0 : 15);
    const old = createSMCAnalysis([...prefix, ...tail, ...candles(41, 1255, 1, true, tail.at(-1).time + 3600)], {
      liquidity: { lookback: 300 },
    });
    assert.ok(!old.setup.reasons.includes('liquidity sweep'));
  }
});

test('engine trade levels mirror correctly for bullish and bearish setups', () => {
  for (const bullish of [true, false]) {
    const analysis = createSMCAnalysis(candles(256, 1000, 1, bullish), { signals: { minimumConfluence: 1 } });
    assert.equal(analysis.setup.direction, bullish ? 'bullish' : 'bearish');
    const { entry, stopLoss, takeProfit } = analysis.signal;
    assert.ok([entry, stopLoss, takeProfit].every(Number.isFinite));
    assert.ok(bullish ? stopLoss < entry && entry < takeProfit : takeProfit < entry && entry < stopLoss);
  }
});

test('SMC snapshots refresh same-bar prices and wicks without changing source candles', () => {
  const cs = candles(30, 80000, 1);
  const original = structuredClone(cs);
  const first = snapshotSMCCandles(cs);
  assert.strictEqual(snapshotSMCCandles(cs, null, first), first, 'unchanged samples keep their identity');
  const active = { ...cs.at(-1), close: 81000, high: 81000 };
  const updated = snapshotSMCCandles(cs, active, first);
  assert.notStrictEqual(updated, first);
  assert.equal(updated.candles.at(-1).close, 81000);
  active.high = 81500;
  const wicked = snapshotSMCCandles(cs, active, updated);
  assert.equal(wicked.candles.at(-1).high, 81500);
  assert.equal(updated.candles.at(-1).high, 81000);
  assert.deepEqual(cs, original);
  const replacement = cs.map((c) => ({ ...c, close: c.close - 0.2 }));
  assert.notStrictEqual(snapshotSMCCandles(replacement, null, first), first, 'history replacement refreshes');
  const replay = cs.slice(0, 20);
  assert.deepEqual(snapshotSMCCandles(replay, active).candles, replay, 'future live bars cannot enter replay');
});


test('zone formation candles do not count as retests or mitigation', () => {
  const cs = [
    [100, 102, 99, 101], [101, 102, 99, 100], [100, 105, 100, 104],
    [104, 107, 103, 106], [106, 109, 105, 108],
  ].map(([open, high, low, close], time) => ({ time, open, high, low, close }));
  const block = detectSMCOrderBlocks(cs).blocks[0];
  const gap = detectSMCFVGs(cs).gaps[0];
  for (const [raw, kind] of [[block, 'ob'], [gap, 'fvg']]) {
    assert.ok(raw);
    const zone = normalizeZone(raw, kind, cs, SYM, IV);
    assert.equal(updateLifecycle([zone], cs)[0].state, 'active', kind);
    assert.equal(detectMitigation(cs, [raw])[0].state, 'active', kind);
    const retested = [...cs, { time: 5, open: 108, high: 109, low: 101, close: 108 }];
    assert.notEqual(updateLifecycle([zone], retested)[0].state, 'active', kind);
    assert.equal(detectMitigation(retested, [raw])[0].state, 'mitigated', kind);
  }
});

test('SMC detector controls filter OB direction, weak displacement, FVG size and FVG visibility', () => {
  const cs = [
    [100, 102, 99, 101], [101, 102, 99, 100], [100, 105, 100, 104],
    [104, 107, 105, 106], [106, 109, 105, 108],
  ].map(([open, high, low, close], time) => ({ time, open, high, low, close }));

  const defaultBlocks = detectSMCOrderBlocks(cs).blocks;
  assert.ok(defaultBlocks.some((block) => block.type === 'bullish_ob'));
  assert.equal(detectSMCOrderBlocks(cs, { bullish: false }).blocks.length, 0);
  assert.equal(detectSMCOrderBlocks(cs, { minDisplacement: 10 }).blocks.length, 0);
  assert.equal(detectSMCOrderBlocks(cs, { maxActiveOBs: 0 }).active.length, 0);

  assert.ok(detectSMCFVGs(cs).gaps.length > 0);
  assert.equal(detectSMCFVGs(cs, { fvg: false }).gaps.length, 0);
  assert.equal(detectSMCFVGs(cs, { minGapAtr: 10 }).gaps.length, 0);
  assert.equal(detectSMCFVGs(cs, { maxGaps: 0 }).gaps.length, 0);
});

test('only untouched confirmed order blocks contribute to the score', () => {
  const prefix = candles(256, 1000, 1);
  const tail = [
    [100, 102, 99, 101], [101, 102, 99, 100], [100, 105, 100, 104],
    [104, 107, 103, 106], [106, 109, 105, 108],
  ].map(([open, high, low, close], i) => ({
    time: prefix.at(-1).time + (i + 1) * 3600,
    open: open + 1156, high: high + 1156, low: low + 1156, close: close + 1156,
  }));
  const cs = [...prefix, ...tail];
  assert.ok(createSMCAnalysis(cs).setup.reasons.includes('order block'));
  const retested = [...cs, { time: cs.at(-1).time + 3600, open: 1264, high: 1265, low: 1257, close: 1264 }];
  assert.ok(!createSMCAnalysis(retested).setup.reasons.includes('order block'));
});

test('opposite-direction displacement cannot confirm a setup', () => {
  for (const direction of ['bullish', 'bearish']) {
    const cs = candles(60, 1000, 0.1);
    cs[58] = { ...cs[58], open: 1006, close: direction === 'bullish' ? 996 : 1016, high: 1017, low: 995 };
    const gate = checkSetupConfluence(cs, { setup: { direction }, mtf: { bias: direction } });
    assert.ok(gate.missing.includes('displacement'));
    cs[58] = { ...cs[58], open: cs[58].close, close: cs[58].open };
    assert.ok(checkSetupConfluence(cs, { setup: { direction }, mtf: { bias: direction } }).reasons.includes('displacement'));
  }
});

test('liquidity and structure caps honor zero and one at every zoom', () => {
  const cs = candles(80, 1000, 1);
  cs[10] = { ...cs[10], high: 1020 };
  const analysis = { mtf: { bias: 'neutral' }, liquidity: { levels: [
    { type: 'bsl', price: 1081, top: 1081, bottom: 1081, time: cs.at(-1).time },
    { type: 'ssl', price: 1079, top: 1079, bottom: 1079, time: cs.at(-1).time },
  ] } };
  for (const mode of ['smart', 'minimal', 'full', 'debug']) {
    for (const visibleBars of [50, 150, 250]) {
      for (const cap of [0, 1]) {
        const result = selectVisibleSMC({ candles: cs, analysis, symbol: SYM, interval: IV,
          settings: { mode, visibleBars, minScore: 0, maxLiquidity: cap, maxStructure: cap } });
        assert.ok(result.levels.length <= cap, `${mode}: liquidity cap ${cap}`);
        assert.ok(result.events.length <= cap, `${mode}: structure cap ${cap}`);
      }
    }
  }
});

test('older invalidated zone overlapping a fresh active zone never kills the active zone', () => {
  const cs = candles(60, 1000, 1, true);
  // Bar 15 dips to 950 so an OB formed at bar 10 gets invalidated,
  // while a new OB at the same range formed at bar 57 (confirmed bar 59) remains active.
  const custom = cs.map((c, i) => (i === 15
    ? { ...c, open: 980, high: 985, low: 940, close: 945 }
    : c));
  const current = custom.at(-1).close;
  const analysis = {
    mtf: { bias: 'bullish' },
    setup: { direction: 'neutral' },
    premiumDiscount: { zone: 'discount', swingHigh: current + 20, swingLow: current - 20, equilibrium: current },
    liquidity: { levels: [] },
    orderBlocks: {
      blocks: [
        { type: 'bullish_ob', top: current, bottom: current - 2, time: custom[10].time, confirmedTime: custom[12].time },
        { type: 'bullish_ob', top: current, bottom: current - 2, time: custom[57].time, confirmedTime: custom[59].time },
      ],
    },
    fvgs: { gaps: [] },
  };
  const selected = selectVisibleSMC({ candles: custom, analysis, symbol: SYM, interval: IV, settings: { mode: 'smart' } });
  assert.equal(selected.zones.length, 1, 'fresh active OB survives despite earlier invalidated OB at same price');
  assert.equal(selected.zones[0].state, 'active');
});

test('switching SMC display mode syncs mode preset caps unless explicitly overridden', () => {
  resetSmcDisplay();
  const minimal = saveSmcDisplay({ mode: 'minimal' });
  assert.equal(minimal.maxOb, 0);
  assert.equal(minimal.maxFvg, 0);
  assert.equal(minimal.minScore, 30);

  const full = saveSmcDisplay({ mode: 'full' });
  assert.equal(full.maxOb, 3);
  assert.equal(full.maxFvg, 3);
  assert.equal(full.maxLiquidity, 8);
  assert.equal(full.minScore, 0);

  const smartCustom = saveSmcDisplay({ mode: 'smart', maxOb: 4 });
  assert.equal(smartCustom.maxOb, 4);
  assert.equal(smartCustom.maxFvg, 1);
  resetSmcDisplay();
});

test('inducement detector caps to the most recent maxEvents instead of dropping the first 6', () => {
  const cs = candles(30, 100, 5, true).map((c) => ({
    ...c,
    high: c.close + 0.5,
    low: c.open - 0.5,
  }));
  const events = detectInducement(cs);
  assert.equal(events.length, 6);
  assert.equal(events.at(-1).time, cs.at(-2).time);
  assert.equal(detectInducement(cs, { maxEvents: 2 }).length, 2);
});
