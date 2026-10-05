import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSetupLevels, findSwings } from './smc/engine/setupLevels.js';

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
