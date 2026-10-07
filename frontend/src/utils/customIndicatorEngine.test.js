import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCustomIndicator, validateCustomIndicatorScript } from './customIndicatorEngine.js';

const candles = [1, 2, 3, 4].map((close, index) => ({
  time: index,
  open: close - 0.5,
  high: close + 1,
  low: close - 1,
  close,
  volume: close * 100,
}));

describe('Pine-inspired custom indicator scripts', () => {
  it('calculates named plots with inputs, assignments, and rolling functions', () => {
    const script = `//@version=1
indicator("Example", overlay=true)
length = input.int(3, "Length", minval=1)
average = ta.sma(close, length)
plot(average, title="Average", color="#2962FF")
plot(ta.ema(close, 2), title="EMA", color="#F59E0B")`;

    assert.equal(validateCustomIndicatorScript(script).valid, true);
    const plots = calculateCustomIndicator(script, candles);
    assert.equal(plots.length, 2);
    assert.equal(plots[0].title, 'Average');
    assert.equal(plots[0].color, '#2962FF');
    assert.deepEqual(plots[0].data.map((point) => point.value), [1, 1.5, 2, 3]);
    assert.ok(Math.abs(plots[1].data[3].value - 3.5185) < 0.001);
  });

  it('supports arithmetic, OHLCV sources, and numeric functions', () => {
    const plots = calculateCustomIndicator(
      'spread = high - low\nplot(math.abs(spread) / 2, title="Range")',
      candles,
    );
    assert.deepEqual(plots[0].data.map((point) => point.value), [1, 1, 1, 1]);
  });

  it('preserves comment markers inside string options', () => {
    const plots = calculateCustomIndicator('plot(close, title="https://example.test") // trailing note', candles);
    assert.equal(plots[0].title, 'https://example.test');
    assert.equal(plots[0].data.length, candles.length);
  });

  it('rejects unknown functions and unresolved names before scripts are saved', () => {
    assert.match(validateCustomIndicatorScript('plot(ta.supersecret(close, 5))').error, /unsupported function/);
    assert.match(validateCustomIndicatorScript('plot(missingSeries)').error, /unknown variable/);
  });

  it('rejects executable JavaScript and invalid plot colors', () => {
    assert.match(validateCustomIndicatorScript('plot(close); alert(1)').error, /unexpected character/);
    assert.match(validateCustomIndicatorScript('plot(close, color="red")').error, /six-digit hex/);
    assert.match(validateCustomIndicatorScript('plot("not a series")').error, /must return numeric/);
  });

  it('requires at least one plot and caps plot count', () => {
    assert.match(validateCustomIndicatorScript('length = input(10)').error, /at least one plot/);
    const tooMany = Array.from({ length: 7 }, () => 'plot(close)').join('\n');
    assert.match(validateCustomIndicatorScript(tooMany).error, /at most 6 plots/);
  });
});
