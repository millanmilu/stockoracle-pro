/**
 * Tests for the rule-based AI Signal Engine (spec §17).
 * Run with: node --test src/utils/aiSignalEngine.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSignal } from './aiSignalEngine.js';
import { detectSMC } from './marketStructure.js';

function makeCandles(n = 200, { drift = 1, amplitude = 2, volatility = 1, seed = 100 } = {}) {
  const candles = [];
  let price = seed;
  for (let i = 0; i < n; i++) {
    const open = price;
    const close = open + drift + Math.sin(i / 6) * amplitude + Math.sin(i * 3.1) * volatility;
    const high = Math.max(open, close) + volatility * 0.5;
    const low = Math.min(open, close) - volatility * 0.5;
    candles.push({ time: i, open, high, low, close, volume: 1000 + (i % 7) * 200 });
    price = close;
  }
  return candles;
}

/** Trending series with oscillation. Price is kept strictly positive. */
function trend(n, start, slope, noise) {
  const candles = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const osc = Math.sin(i / 3) * noise;
    const open = price;
    const close = open + slope + osc;
    const high = Math.max(open, close) + 0.6;
    const low = Math.min(open, close) - 0.6;
    candles.push({ time: i, open, high, low, close, volume: 1000 + Math.abs(Math.sin(i / 5)) * 3000 });
    price = close;
  }
  return candles;
}

describe('AI Signal Engine', () => {
  it('returns unavailable when inputs are missing or insufficient', () => {
    assert.deepEqual(analyzeSignal([]).available, false);
    assert.deepEqual(analyzeSignal(null).available, false);
    const short = makeCandles(10);
    const res = analyzeSignal(short);
    assert.equal(res.available, false);
    assert.ok(res.why.includes('AI analysis unavailable'));
  });

  it('returns a full report for a valid series', () => {
    const res = analyzeSignal(makeCandles(220));
    assert.equal(res.available, true);
    assert.ok(['buy', 'sell', 'neutral'].includes(res.direction));
    assert.ok(res.probability >= 0 && res.probability <= 100);
    assert.ok(Array.isArray(res.signals));
    assert.ok(Array.isArray(res.why));
    assert.ok(res.entry > 0);
    assert.ok(res.stopLoss > 0);
    assert.ok(res.takeProfit > 0);
    assert.ok(res.riskReward > 0);
    assert.ok(res.confluence && typeof res.confluence === 'object');
  });

  it('produces a bullish signal on a sustained uptrend', () => {
    const res = analyzeSignal(trend(260, 100, 1.0, 0.8));
    assert.equal(res.available, true);
    assert.equal(res.direction, 'buy');
    assert.ok(res.probability > 50);
    assert.ok(res.score > 0);
    assert.ok(res.confluence.buy >= res.confluence.sell);
  });

  it('produces a bearish signal on a sustained downtrend', () => {
    const res = analyzeSignal(trend(260, 400, -1.0, 0.8));
    assert.equal(res.available, true);
    assert.equal(res.direction, 'sell');
    assert.ok(res.probability > 50);
    assert.ok(res.score < 0);
    assert.ok(res.confluence.sell >= res.confluence.buy);
  });

  it('ensures entry/SL/TP are internally consistent', () => {
    const res = analyzeSignal(makeCandles(250, { drift: 1.5 }));
    if (res.direction === 'buy') {
      assert.ok(res.stopLoss < res.entry);
      assert.ok(res.takeProfit > res.entry);
    } else if (res.direction === 'sell') {
      assert.ok(res.stopLoss > res.entry);
      assert.ok(res.takeProfit < res.entry);
    }
    assert.ok(res.riskReward > 0);
  });
});

describe('Market Structure detectors', () => {
  const candles = makeCandles(120);

  it('detectSMC returns arrays for every smcType', () => {
    const types = ['swing_hl', 'hh_hl', 'bos_choch', 'supply_demand', 'order_blocks', 'fvg', 'liquidity', 'sr_lines'];
    for (const t of types) {
      const out = detectSMC(t, candles);
      assert.ok(Array.isArray(out), `${t} returns array`);
    }
  });

  it('detectSMC returns [] for unknown type', () => {
    assert.deepEqual(detectSMC('bogus', candles), []);
  });

  it('zone detectors produce top/bottom; point detectors produce price', () => {
    const zones = detectSMC('supply_demand', candles);
    for (const z of zones) {
      assert.ok(z.top != null && z.bottom != null);
    }
    const points = detectSMC('sr_lines', candles);
    for (const p of points) {
      assert.ok(p.price != null);
      assert.ok(['support', 'resistance'].includes(p.type));
    }
  });
});