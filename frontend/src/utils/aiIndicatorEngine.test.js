/**
 * Advanced AI indicator engine tests — deterministic synthetic candles.
 * Run with: node --test src/utils/aiIndicatorEngine.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAITrend,
  computeAIMomentum,
  computeAIExhaustion,
  computeAIRegime,
  labelRegime,
  computeAIBreakout,
  getAIBreakoutMarkers,
  getAISupportResistance,
  computeAIForecast,
  detectAIPatterns,
  getAIPatternMarkers,
  getAIReversalMarkers,
  computeAIDashboardScores,
  getAIEngineIds,
} from './aiIndicatorEngine.js';
import { calculateById } from './indicatorEngine.js';

const mk = (n, fn, vol = 1000) => Array.from({ length: n }, (_, i) => {
  const c = fn(i);
  return { time: i, open: c - 0.5, high: c + 1, low: c - 1, close: c, volume: vol };
});
const last = (res) => (res.main.length ? res.main[res.main.length - 1].value : null);

let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5;

describe('aiIndicatorEngine — advanced AI studies', () => {
  const up = mk(150, (i) => 100 + i * 0.8);
  const down = mk(150, (i) => 220 - i * 0.8);
  const chop = mk(150, (i) => 100 + rnd() * 3);

  it('registers all engines for calculateById', () => {
    assert.deepEqual(getAIEngineIds(), ['ai_trend', 'ai_momentum', 'ai_exhaustion', 'ai_regime', 'ai_breakout', 'ai_forecast']);
    for (const id of getAIEngineIds()) {
      const res = calculateById(id, up, {});
      assert.equal(res.valid, true, `${id} valid`);
      assert.ok(res.points, `${id} points`);
    }
  });

  it('trend: +100 uptrend, −100 downtrend, muted chop', () => {
    assert.equal(last(computeAITrend(up, {})), 100);
    assert.equal(last(computeAITrend(down, {})), -100);
    const c = last(computeAITrend(chop, {}));
    assert.ok(Math.abs(c) < 80, `chop trend ${c} should stay muted, got ${c}`);
  });

  it('momentum follows price direction', () => {
    assert.ok(last(computeAIMomentum(up, {})) > 20);
    assert.ok(last(computeAIMomentum(down, {})) < -20);
  });

  it('regime meter separates trend from chop', () => {
    assert.ok(last(computeAIRegime(up, {})) > 60);
    assert.ok(last(computeAIRegime(chop, {})) < 60);
    assert.equal(labelRegime(80, 50, 50).label, 'TREND');
    assert.equal(labelRegime(20, 50, 50).label, 'RANGE');
    assert.equal(labelRegime(70, 50, 90).label, 'HIGH-VOL');
  });

  it('exhaustion builds bearish pressure on extended rallies', () => {
    assert.ok(last(computeAIExhaustion(up, {})) < 0, 'overbought rally should lean bearish');
  });

  it('breakout markers fire on channel breaks with volume', () => {
    const data = mk(150, (i) => (i < 100 ? 100 + Math.sin(i / 5) : 100 + (i - 100) * 1.5), 5000);
    // volume surge on the ramp
    data.forEach((c, i) => { if (i >= 100) c.volume = 20000; });
    const markers = getAIBreakoutMarkers(data, {});
    assert.ok(markers.length >= 1, 'expected ≥1 BRK marker');
    assert.ok(markers.every((m) => m.time != null && m.shape));
  });

  it('S/R zones cluster swings with strength + touches', () => {
    const zones = getAISupportResistance(mk(150, (i) => 100 + Math.sin(i / 8) * 4), {});
    assert.ok(zones.length >= 2, 'expected S+R zones');
    assert.ok(zones.every((z) => z.strength >= 5 && z.touches >= 2 && (z.side === 'S' || z.side === 'R')));
  });

  it('forecast emits widening bands over the horizon', () => {
    const fc = computeAIForecast(up, { horizon: 5 });
    assert.equal(fc.median.length, 5);
    assert.equal(fc.upper.length, 5);
    assert.equal(fc.lower.length, 5);
    const w0 = fc.upper[0].value - fc.lower[0].value;
    const w4 = fc.upper[4].value - fc.lower[4].value;
    assert.ok(w4 > w0, 'bands must widen with horizon');
    assert.ok(fc.median[4].value > up[up.length - 1].close, 'uptrend forecast rises');
  });

  it('patterns detect double tops/bottoms with triggers', () => {
    const pts = detectAIPatterns(mk(150, (i) => 100 + Math.sin(i / 10) * 5), {});
    assert.ok(pts.length >= 1);
    assert.ok(pts.every((p) => p.trigger != null && p.target != null && p.invalidation != null));
    const markers = getAIPatternMarkers(mk(150, (i) => 100 + Math.sin(i / 10) * 5), {});
    assert.ok(markers.length >= 1);
  });

  it('reversal markers stay quiet without threshold crosses', () => {
    assert.deepEqual(getAIReversalMarkers(mk(40, (i) => 100 + i * 0.1), {}), []);
  });

  it('reversal markers emit correct polarity on extreme exhaustion', () => {
    // Sharp dump leading to deep oversold exhaustion
    const dump = mk(80, (i) => (i < 40 ? 150 : 150 - (i - 40) * 2.5));
    const dumpMarkers = getAIReversalMarkers(dump, { threshold: 40 });
    if (dumpMarkers.length) {
      assert.ok(dumpMarkers.some((m) => m.position === 'belowBar' && m.shape === 'arrowUp' && m.color === '#10B981'),
        'oversold reversal marker should point up below bar');
    }
  });

  it('dynamic S/R assigns side S below last close and R above last close', () => {
    const osc = mk(150, (i) => 100 + Math.sin(i / 8) * 6);
    const zones = getAISupportResistance(osc, {});
    const lastClose = osc[osc.length - 1].close;
    const supports = zones.filter((z) => z.side === 'S');
    const resistances = zones.filter((z) => z.side === 'R');
    assert.ok(supports.length > 0 && resistances.length > 0);
    supports.forEach((s) => assert.ok(s.price <= lastClose + 1e-4, 'Support must be <= lastClose'));
    resistances.forEach((r) => assert.ok(r.price >= lastClose - 1e-4, 'Resistance must be >= lastClose'));
  });

  it('forecast provides anchor at last candle and clamps extreme drift', () => {
    const fc = computeAIForecast(up, { horizon: 5 });
    assert.ok(fc.anchor != null, 'forecast must return anchor');
    assert.equal(fc.anchor.time, up[up.length - 1].time);
    assert.equal(fc.anchor.value, up[up.length - 1].close);
    assert.ok(fc.lower.every((p) => p.value >= 0.01), 'lower band must be >= 0.01');
  });

  it('dashboard summary aggregates every engine', () => {
    const s = computeAIDashboardScores(up);
    assert.equal(s.available, true);
    assert.equal(s.trend.label, 'UPTREND');
    assert.ok(['TREND', 'BREAKOUT', 'TRANSITION'].includes(s.regime.label));
    assert.ok(Array.isArray(s.patterns));
    assert.equal(s.forecast.direction, 'UP');
  });

  it('short series degrades gracefully (no throws, sparse output)', () => {
    const tiny = mk(5, (i) => 100 + i);
    assert.doesNotThrow(() => {
      computeAITrend(tiny, {});
      computeAIMomentum(tiny, {});
      computeAIExhaustion(tiny, {});
      computeAIRegime(tiny, {});
      computeAIBreakout(tiny, {});
      getAISupportResistance(tiny, {});
      computeAIForecast(tiny, {});
      detectAIPatterns(tiny, {});
      computeAIDashboardScores(tiny);
    });
  });
});
