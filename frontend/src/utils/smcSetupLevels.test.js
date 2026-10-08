import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSetupLevels, findSwings } from './smc/engine/setupLevels.js';
import { cloneSetup, getSetupExit, advanceSetup } from './smc/engine/setupLifecycle.js';

test('locked plan upgrades without moving levels and catches skipped bars/revisited targets', () => {
  const lock = { setup: { direction: 'bullish', confirmed: false, entry: 100, stopLoss: 95, takeProfits: [110] }, baseline: { time: 1, high: 112, low: 98 } };
  assert.equal(getSetupExit(lock.setup, { time: 1, high: 112, low: 98, close: 110 }, lock.baseline).kind, 'target');
  const upgraded = advanceSetup(lock, [{ time: 1, high: 112, low: 98, close: 100 }], { direction: 'bullish', confirmed: true, entry: 105 });
  assert.equal(upgraded.setup.confirmed, true);
  assert.equal(upgraded.setup.entry, 100);
  assert.equal(advanceSetup(lock, [{ time: 2, high: 105, low: 94 }, { time: 3, high: 104, low: 99 }]).exit.kind, 'stop');
});

function trendCandles(n, from, step, up = true) {
  const out = [];
  let base = from;
  for (let i = 0; i < n; i++) {
    const open = base;
    const close = up ? base + step : base - step;
    out.push({
      time: 1700000000 + i * 3600,
      open, close,
      high: Math.max(open, close) + step * 0.3,
      low: Math.min(open, close) - step * 0.3,
    });
    base = close;
  }
  return out;
}

test('SMC setup stays frozen until TP1 or SL is touched', () => {
  const setup = cloneSetup({
    direction: 'bullish', entry: 100, stopLoss: 95, takeProfits: [110, 115, 120],
  });
  assert.equal(getSetupExit(setup, { time: 1, high: 108, low: 98 }), null);
  assert.equal(getSetupExit(setup, { time: 2, high: 111, low: 99 }).kind, 'target');
  assert.equal(getSetupExit(setup, { time: 3, high: 101, low: 94 }).kind, 'stop');
  // A wick that existed before the setup appeared cannot close it instantly.
  assert.equal(getSetupExit(setup, { time: 4, high: 112, low: 96 }, { time: 4, high: 112, low: 96 }), null);
});

test('bullish setup has SL < entry < TP1 < TP2 < TP3', () => {
  const candles = trendCandles(60, 80000, 40, true);
  const setup = deriveSetupLevels(candles, { setup: { direction: 'bullish' } });
  assert.ok(setup);
  assert.equal(setup.direction, 'bullish');
  assert.ok(setup.stopLoss < setup.entry, 'SL below entry');
  assert.ok(setup.entry < setup.takeProfits[0], 'TP1 above entry');
  assert.ok(setup.takeProfits[0] < setup.takeProfits[1], 'TP ladder rises');
  assert.ok(setup.takeProfits[1] < setup.takeProfits[2], 'TP ladder rises');
});

test('bearish setup mirrors (TPs descend below entry, SL above)', () => {
  const candles = trendCandles(60, 86000, 40, false);
  const setup = deriveSetupLevels(candles, { setup: { direction: 'bearish' } });
  assert.ok(setup);
  assert.equal(setup.direction, 'bearish');
  assert.ok(setup.stopLoss > setup.entry, 'SL above entry');
  assert.ok(setup.entry > setup.takeProfits[0], 'TP1 below entry');
  assert.ok(setup.takeProfits[0] > setup.takeProfits[1], 'TP ladder falls');
  assert.ok(setup.takeProfits[1] > setup.takeProfits[2], 'TP ladder falls');
});

test('order-block edge is preferred as entry over last close', () => {
  const candles = trendCandles(60, 80000, 40, true);
  const withOb = deriveSetupLevels(candles, {
    setup: { direction: 'bullish' },
    orderBlocks: { blocks: [{ type: 'bullish_ob', top: 82000, bottom: 81900 }] },
  });
  const withoutOb = deriveSetupLevels(candles, { setup: { direction: 'bullish' } });
  assert.equal(withOb.entry, 82000);
  assert.notEqual(withoutOb.entry, 82000);
});

test('live demand zone wins over equilibrium and stop stays beyond its invalidation edge', () => {
  const candles = trendCandles(60, 80000, 40, true);
  const last = candles.at(-1);
  const result = deriveSetupLevels(candles, {
    setup: { direction: 'bullish', entry: last.close + 400 },
    premiumDiscount: { equilibrium: last.close + 200, swingLow: last.close - 1200, swingHigh: last.close + 1200 },
    orderBlocks: {
      blocks: [{ type: 'bullish_ob', top: last.close - 160, bottom: last.close - 260, time: candles[52].time, state: 'active' }],
    },
  });
  assert.ok(result);
  assert.equal(result.entry, last.close - 160, 'entry uses the actionable demand edge');
  assert.ok(result.stopLoss < last.close - 260, 'stop is outside the demand zone');
  assert.equal(result.takeProfits.length, 3);
  assert.ok(result.riskReward.every((rr) => Number.isFinite(rr) && rr >= 1.25));
  assert.equal(result.entrySource, 'BULLISH_OB');
});

test('bearish supply zone produces mirrored levels and ordered targets', () => {
  const candles = trendCandles(60, 86000, 40, false);
  const last = candles.at(-1);
  const result = deriveSetupLevels(candles, {
    setup: { direction: 'bearish', entry: last.close - 400 },
    premiumDiscount: { equilibrium: last.close - 200, swingLow: last.close - 1200, swingHigh: last.close + 1200 },
    fvgs: {
      gaps: [{ type: 'bearish_fvg', top: last.close + 260, bottom: last.close + 160, time: candles[52].time, state: 'active' }],
    },
  });
  assert.ok(result);
  assert.equal(result.entry, last.close + 160, 'entry uses the actionable supply edge');
  assert.ok(result.stopLoss > last.close + 260, 'stop is outside the supply zone');
  assert.ok(result.takeProfits[0] > result.takeProfits[1]);
  assert.ok(result.takeProfits[1] > result.takeProfits[2]);
  assert.ok(result.riskReward.every((rr) => Number.isFinite(rr) && rr >= 1.25));
});

test('neutral direction and tiny series return null', () => {
  const candles = trendCandles(60, 80000, 40, true);
  assert.equal(deriveSetupLevels(candles, { setup: { direction: 'neutral' } }), null);
  assert.equal(deriveSetupLevels(candles.slice(0, 5), { setup: { direction: 'bullish' } }), null);
  assert.equal(deriveSetupLevels([], { setup: { direction: 'bullish' } }), null);
});

test('findSwings detects local extremes', () => {
  const candles = trendCandles(30, 100, 5, true);
  const { highs, lows } = findSwings(candles);
  assert.ok(Array.isArray(highs) && Array.isArray(lows));
});

test('fallback targets extend beyond distant anchors in both directions', () => {
  for (const bullish of [true, false]) {
    for (const anchorCount of [1, 2]) {
      const cs = trendCandles(60, bullish ? 1000 : 2000, 1, bullish);
      const entry = cs.at(-1).close;
      const sign = bullish ? 1 : -1;
      const anchors = Array.from({ length: anchorCount }, (_, i) => entry + sign * (100 + 20 * i));
      const result = deriveSetupLevels(cs, {
        setup: { direction: bullish ? 'bullish' : 'bearish', entry },
        liquidity: { levels: anchors.map((price) => ({ price })) },
      });
      assert.ok(result);
      assert.deepEqual(result.takeProfits.slice(0, anchorCount), anchors);
      const ladder = [entry, ...result.takeProfits];
      for (let i = 1; i < ladder.length; i++) assert.ok(sign * (ladder[i] - ladder[i - 1]) > 0);
    }
  }
});

test('missing entry uses a real price instead of converting null to zero', () => {
  const cs = trendCandles(60, 1000, 1);
  const result = deriveSetupLevels(cs, { setup: { direction: 'bullish', entry: null } });
  assert.equal(result.entry, cs.at(-1).close);
});
