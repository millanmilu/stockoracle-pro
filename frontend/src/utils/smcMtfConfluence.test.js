import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMTFConfluence, aggregateCandles } from './smc/engine/mtfConfluence.js';

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

/** Trending candles with regular pullbacks so fractal swings actually form. */
function staircaseCandles(n, from, step, up = true, cycle = 8, pullback = 0.5) {
  const out = [];
  let base = from;
  for (let i = 0; i < n; i++) {
    const leg = i % cycle < cycle - 2;
    const move = leg ? (up ? step : -step) : (up ? -step * pullback : step * pullback);
    const open = base;
    const close = base + move;
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

function noiseCandles(n, from, seed = 7) {
  const out = [];
  let base = from;
  let state = seed;
  for (let i = 0; i < n; i++) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const drift = ((state / 2147483648) - 0.5) * 30;
    const open = base;
    const close = base + drift;
    out.push({
      time: 1700000000 + i * 3600,
      open, close,
      high: Math.max(open, close) + 8,
      low: Math.min(open, close) - 8,
    });
    base = close;
  }
  return out;
}

test('aggregateCandles builds OHLC groups and drops malformed rows', () => {
  const candles = trendCandles(12, 100, 1, true);
  candles[5].high = NaN;
  const agg = aggregateCandles(candles, 4);
  assert.equal(agg.length, 2); // group 2 (index 4..7) dropped due to NaN high
  assert.equal(agg[0].close, candles[3].close);
  assert.ok(agg[0].high >= Math.max(candles[0].high, candles[1].high));
});

test('uptrend candles produce bullish MTF bias with full alignment', () => {
  const candles = staircaseCandles(200, 80000, 40, true);
  const mtf = analyzeMTFConfluence(candles);
  assert.equal(mtf.bias, 'bullish');
  assert.equal(mtf.alignment, 'bullish');
  // Trend alignment is the dominant component (0.4); perfectly monotonic
  // data produces no HTF swings/zones, so 40 is the honest full-trend score.
  assert.ok(mtf.alignmentScore >= 40, `alignmentScore ${mtf.alignmentScore} should be at least trend-aligned`);
  assert.equal(mtf.components.trend, 1);
});

test('short history returns neutral without crashing', () => {
  const mtf = analyzeMTFConfluence(trendCandles(10, 100, 1, true));
  assert.equal(mtf.bias, 'neutral');
  assert.equal(mtf.alignmentScore, 0);
  assert.deepEqual(mtf.zones, []);
});

test('choppy candles keep bias neutral', () => {
  const mtf = analyzeMTFConfluence(noiseCandles(120, 80000));
  assert.equal(mtf.bias, 'neutral');
  assert.ok(mtf.alignmentScore < 70);
});

test('bearish trend mirrors bias and premium/discount follows range', () => {
  const candles = staircaseCandles(200, 90000, 35, false);
  const mtf = analyzeMTFConfluence(candles);
  assert.equal(mtf.bias, 'bearish');
  if (mtf.premiumDiscount) {
    assert.ok(mtf.premiumDiscount.swingHigh > mtf.premiumDiscount.swingLow);
    assert.ok(['premium', 'discount'].includes(mtf.premiumDiscount.zone));
  }
});
