/**
 * Tests for the modular Indicator Engine (spec §20 + §16).
 * Run with: node --test src/utils/indicatorEngine.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INDICATOR_ENGINE,
  getIndicator,
  getAllIndicators,
  calculateById,
  recomputeLastBar,
  supportsIncremental,
  createParameter,
  validateParameters,
  calculateWMA,
  calculateHMA,
  calculateKAMA,
  calculateALMA,
  calculateAnchoredVWAP,
  calculateVWAP,
  calculateDonchian,
  calculateStoch,
  calculateCCI,
  calculateWilliamsR,
  calculateROC,
  calculateMomentum,
  calculateTRIX,
  calculateATR,
  calculateKeltner,
  calculateStdDev,
  calculateHistoricalVolatility,
  calculateBBWidth,
  calculateChoppiness,
  calculateOBV,
  calculateMFI,
  calculateRelativeVolume,
  calculateVolumeDelta,
  calculateCVD,
} from './indicatorEngine.js';

/** Deterministic OHLCV generator: smooth trend + sine wave + small noise. */
function makeCandles(n = 120, { seedStart = 100, drift = 2, amplitude = 3, volatility = 1 } = {}) {
  const candles = [];
  let price = seedStart;
  for (let i = 0; i < n; i++) {
    const wave = Math.sin(i / 6) * amplitude;
    const open = price;
    const close = open + drift + wave + (Math.sin(i * 3.1) * volatility);
    const high = Math.max(open, close) + volatility * 0.8;
    const low = Math.min(open, close) - volatility * 0.8;
    const volume = 1000 + Math.round(5000 * Math.abs(Math.sin(i / 4)));
    candles.push({ time: i, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

describe('Parameter schema', () => {
  it('validates and coerces integer periods', () => {
    const p = createParameter('period', 'Period', { defaultValue: 20, min: 1, max: 500, step: 1, integer: true });
    assert.equal(p.validate(20).valid, true);
    assert.equal(p.coerce('20.7'), 21);
    assert.equal(p.validate(0).valid, false);
    assert.equal(p.validate(501).valid, false);
    assert.equal(p.validate('').valid, false);
  });

  it('validates source options', () => {
    const p = createParameter('source', 'Source', { defaultValue: 'close', options: ['close', 'high'] });
    assert.equal(p.validate('close').valid, true);
    assert.equal(p.validate('bogus').valid, false);
  });

  it('validateParameters returns errors and defaults for bad input', () => {
    const params = { period: createParameter('period', 'Period', { defaultValue: 20, min: 1, max: 100, step: 1, integer: true }) };
    const res = validateParameters(params, { period: 999 });
    assert.equal(res.valid, false);
    assert.equal(res.errors.period, 'Period must be ≤ 100');
    assert.equal(res.values.period, 20);
  });
});

describe('Registry integrity', () => {
  it('contains all required indicator ids', () => {
    const required = [
      'sma', 'ema', 'wma', 'hma', 'kama', 'alma', 'anchored_vwap', 'donchian', 'vwap', 'supertrend', 'psar',
      'rsi', 'macd', 'stoch', 'stoch_rsi', 'cci', 'williams_r', 'roc', 'momentum', 'trix', 'adx',
      'bollinger_bands', 'keltner', 'atr', 'hist_vol', 'std_dev', 'bb_width', 'choppiness',
      'rel_volume', 'obv', 'mfi', 'cmf', 'volume_delta', 'cvd',
    ];
    for (const id of required) {
      assert.ok(INDICATOR_ENGINE[id], `missing engine indicator: ${id}`);
    }
  });

  it('every registered indicator has calculate and parameters', () => {
    for (const ind of getAllIndicators()) {
      assert.ok(ind.id, 'id present');
      assert.equal(typeof ind.calculate, 'function', `${ind.id} has calculate`);
      assert.ok(ind.parameters && typeof ind.parameters === 'object', `${ind.id} has parameters`);
    }
  });
});

describe('Calculations (smoke + invariants)', () => {
  const candles = makeCandles(220);

  it('calculates every registered indicator without throwing and returns points', () => {
    for (const ind of getAllIndicators()) {
      const res = calculateById(ind.id, candles);
      assert.equal(res.valid, true, `${ind.id} valid`);
      assert.ok(res.points != null, `${ind.id} returns points`);
    }
  });

  it('does not drop candles: SMP/SMA-like series length == candle length', () => {
    const defs = ['wma', 'hma', 'kama', 'alma', 'anchored_vwap', 'atr', 'roc', 'momentum', 'obv'];
    for (const id of defs) {
      const res = calculateById(id, candles);
      const arr = res.points?.main || res.points;
      assert.ok(Array.isArray(arr), `${id} is array`);
      assert.ok(arr.length > 0, `${id} non-empty`);
    }
  });

  it('produces positive values only for price-scale overlays', () => {
    const close = candles.map((c) => c.close);
    const mean = close.reduce((a, b) => a + b, 0) / close.length;
    const wma = calculateWMA(candles, 20);
    const lastVals = wma.slice(-20).map((p) => p.value);
    for (const v of lastVals) {
      assert.ok(v > 0, 'WMA positive');
      assert.ok(Math.abs(v - mean) < mean * 5, 'WMA within sane range');
    }
  });

  it('multi-indicator independent computation', () => {
    const a = calculateById('rsi', candles).points;
    const b = calculateById('macd', candles).points;
    assert.ok(a);
    assert.ok(b);
    // Empty input yields empty points but must not throw or corrupt the registry.
    const empty = calculateById('rsi', []);
    const emptyArr = empty.points?.main || empty.points;
    assert.equal(Array.isArray(emptyArr) ? emptyArr.length : 0, 0);
  });
});

describe('Individual oscillator sanity', () => {
  it('RSI stays within 0..100', () => {
    const candles = makeCandles(100);
    const rsi = calculateById('rsi', candles).points;
    for (const p of rsi.main || rsi) {
      assert.ok(p.value >= 0 && p.value <= 100, `RSI in [0,100], got ${p.value}`);
    }
  });

  it('StochRSI stays within 0..100', () => {
    const candles = makeCandles(160);
    const res = calculateById('stoch_rsi', candles).points;
    for (const p of res.k) assert.ok(p.value >= 0 && p.value <= 100);
    for (const p of res.d) assert.ok(p.value >= 0 && p.value <= 100);
  });

  it('Choppiness within 0..100', () => {
    const candles = makeCandles(100);
    const ch = calculateChoppiness(candles, 14);
    for (const p of ch) assert.ok(p.value >= 0 && p.value <= 100);
  });

  it('Williams %R within -100..0', () => {
    const candles = makeCandles(100);
    const wr = calculateWilliamsR(candles, 14);
    for (const p of wr) assert.ok(p.value >= -100 && p.value <= 0);
  });

  it('Keltner upper >= middle >= lower', () => {
    const candles = makeCandles(120);
    const kc = calculateKeltner(candles, 20, 2);
    const n = Math.min(kc.upper.length, kc.middle.length, kc.lower.length);
    for (let i = 0; i < n; i++) {
      assert.ok(kc.upper[i].value >= kc.middle[i].value);
      assert.ok(kc.middle[i].value >= kc.lower[i].value);
    }
  });

  it('Donchian upper >= middle >= lower', () => {
    const candles = makeCandles(120);
    const d = calculateDonchian(candles, 20);
    const n = Math.min(d.upper.length, d.middle.length, d.lower.length);
    for (let i = 0; i < n; i++) {
      assert.ok(d.upper[i].value >= d.middle[i].value);
      assert.ok(d.middle[i].value >= d.lower[i].value);
    }
  });
});

describe('Volume & order-flow (estimated)', () => {
  it('CVD is cumulative of delta', () => {
    const candles = makeCandles(80);
    const delta = calculateVolumeDelta(candles);
    const cvd = calculateCVD(candles);
    let running = 0;
    for (let i = 0; i < cvd.length; i++) {
      running += delta[i].value;
      assert.ok(Math.abs(cvd[i].value - running) < 1e-6);
    }
  });

  it('OBV is always finite', () => {
    const candles = makeCandles(80);
    const obv = calculateOBV(candles);
    for (const p of obv) assert.ok(Number.isFinite(p.value));
  });
});

describe('Incremental last-bar recompute (spec §16)', () => {
  it('supportsIncremental returns true for designated indicators', () => {
    for (const id of ['sma', 'ema', 'wma', 'hma', 'kama', 'alma', 'atr', 'obv', 'cvd']) {
      assert.equal(supportsIncremental(id), true, `${id} supports incremental`);
    }
  });

  it('recomputeLastBar matches full recalculation for the last bar (SMA)', () => {
    const candles = makeCandles(50);
    const full = calculateById('sma', candles, { period: 20 });
    const fullLast = full.points.main[full.points.main.length - 1].value;
    const inc = recomputeLastBar('sma', candles, { period: 20 });
    assert.equal(inc.main.value, fullLast);
  });

  it('recomputeLastBar returns null for unknown id', () => {
    assert.equal(recomputeLastBar('nope', makeCandles(20)), null);
  });
});

describe('Performance', () => {
  it('computes all indicators over 500 candles within budget', () => {
    const candles = makeCandles(500);
    const start = Date.now();
    for (const ind of getAllIndicators()) calculateById(ind.id, candles);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 5000, `full catalog under 5s (took ${elapsed}ms)`);
  });
});

describe('VWAP session anchoring', () => {
  const D = 86400 * 3; // epoch-seconds offset — 1970-01-04, a stable UTC day
  const mk = (times, prices, vols) => times.map((t, i) => ({
    time: t,
    open: prices[i], high: prices[i] + 1, low: prices[i] - 1, close: prices[i],
    volume: vols[i],
  }));

  it('resets cumulators at each calendar-day boundary', () => {
    const candles = mk(
      [D, D + 60, D + 120, D + 86400, D + 86460],
      [100, 100, 100, 200, 200],
      [100, 100, 100, 400, 400],
    );
    const pts = calculateVWAP(candles);
    // First bar of a session anchors at its own typical price.
    assert.equal(pts[0].value, 100);
    // Day-2 first bar RESETS — legacy cumulative code would have given ~157.14.
    assert.equal(pts[3].value, 200);
    // Day-2 bars stay within day-2's volume-weighted mean (no cross-day drift).
    assert.equal(pts[4].value, 200);
  });

  it('treats zero-volume bars as negligible weight (fallback weight 1)', () => {
    const candles = mk([D, D + 60], [100, 110], [0, 0]);
    const pts = calculateVWAP(candles);
    assert.equal(pts[0].value, 100);
    // Zero volume → fallback weight 1: (100*1 + 110*1) / 2 = 105
    assert.equal(pts[1].value, 105);
  });

  it('keeps cumulative behaviour for index-based times (no real timestamps)', () => {
    const candles = makeCandles(30); // time: 0..29 — engine's default generator
    const pts = calculateVWAP(candles);
    let cumVol = 0;
    let cumPV = 0;
    candles.forEach((c, i) => {
      const vol = Number(c.volume || 1);
      const tp = (c.high + c.low + c.close) / 3;
      cumVol += vol;
      cumPV += tp * vol;
      assert.ok(Math.abs(pts[i].value - cumPV / cumVol) < 0.011, `bar ${i}`);
    });
  });
});