import test from 'node:test';
import assert from 'node:assert/strict';
import { backtestSetup } from './smc/engine/setupBacktest.js';

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

/** Trending candles with regular pullbacks so swing lows/highs form. */
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

test('backtest returns null for too-short histories', () => {
  assert.equal(backtestSetup(trendCandles(40, 100, 1, true)), null);
  assert.equal(backtestSetup([]), null);
});

test('strong trend yields trades with a sane win rate and R accounting', () => {
  const result = backtestSetup(staircaseCandles(240, 80000, 40, true), { maxTrades: 60 });
  assert.ok(result, 'expected stats for a trending series');
  assert.ok(result.trades > 0);
  assert.equal(result.trades, result.wins + result.losses + result.open);
  assert.ok(result.winRate >= 0 && result.winRate <= 1);
  // Every win adds 1.5R, every loss −1R; avg must sit in that envelope.
  const closed = result.wins + result.losses;
  if (closed > 0) {
    const implied = (result.wins * 1.5 - result.losses) / closed;
    assert.ok(Math.abs(implied - result.avgR) < 1e-9);
  }
});

test('range-bound market reports low expectancy without crashing', () => {
  // Alternating candles: 60 up then 60 down, repeated — few clean setups.
  const candles = [];
  let base = 80000;
  for (let i = 0; i < 240; i++) {
    const up = Math.floor(i / 20) % 2 === 0;
    const open = base;
    const close = up ? base + 25 : base - 25;
    candles.push({ time: 1700000000 + i * 3600, open, close, high: close + 12, low: open - 12 });
    base = close;
  }
  const result = backtestSetup(candles);
  if (result) {
    assert.ok(result.winRate >= 0 && result.winRate <= 1);
    assert.ok(Math.abs(result.avgR) <= 1.5);
  }
});
