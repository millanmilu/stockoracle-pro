/**
 * Unit tests for the Volume Profile engine (TradingView VPVR parity).
 * Run with: node --test src/utils/volumeProfile.test.js (Node >= 18, no deps)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeVolumeProfile } from './volumeProfile.js';

const bar = (o, h, l, c, v) => ({ open: o, high: h, low: l, close: c, volume: v });

describe('computeVolumeProfile — basics', () => {
  it('returns null for empty / volumeless input', () => {
    assert.equal(computeVolumeProfile([]), null);
    assert.equal(computeVolumeProfile(null), null);
    assert.equal(computeVolumeProfile([bar(10, 11, 9, 10, 0)]), null);
  });

  it('conserves total volume across rows', () => {
    const candles = [
      bar(10, 12, 9, 11, 100),
      bar(11, 13, 10, 12, 200),
      bar(12, 12, 12, 12, 50), // flat bar
      bar(9, 10, 8, 9, 150),
    ];
    const p = computeVolumeProfile(candles, { rows: 12 });
    const sum = p.rows.reduce((s, r) => s + r.volume, 0);
    assert.ok(Math.abs(sum - 500) < 1e-9, `volume conserved, got ${sum}`);
  });

  it('splits up/down volume by close vs open', () => {
    const candles = [bar(10, 12, 9, 11, 100), bar(11, 12, 9, 10, 100)];
    const p = computeVolumeProfile(candles, { rows: 4 });
    const up = p.rows.reduce((s, r) => s + r.upVolume, 0);
    const down = p.rows.reduce((s, r) => s + r.downVolume, 0);
    assert.ok(Math.abs(up - 100) < 1e-9);
    assert.ok(Math.abs(down - 100) < 1e-9);
  });

  it('finds POC at the highest-volume row', () => {
    const candles = [
      bar(10, 10.5, 9.5, 10, 50),
      bar(20, 20.5, 19.5, 20, 500), // heavy cluster → POC here
      bar(30, 30.5, 29.5, 30, 60),
    ];
    const p = computeVolumeProfile(candles, { rows: 30 });
    assert.ok(p.poc.price > 19 && p.poc.price < 21, `POC near 20, got ${p.poc.price}`);
    // The 500-volume bar spans ~2 rows, so the POC row holds the largest share.
    assert.ok(p.poc.volume > 200, `POC row dominates, got ${p.poc.volume}`);
  });

  it('value area covers ~70% expanding from POC with VAH >= POC >= VAL', () => {
    const candles = [];
    for (let i = 0; i < 40; i += 1) {
      const base = 100 + Math.sin(i / 4) * 8;
      candles.push(bar(base, base + 2, base - 2, base + 1, 100 + (i % 7) * 10));
    }
    const p = computeVolumeProfile(candles, { rows: 24, valueAreaPercent: 70 });
    assert.ok(p.valueAreaVolume >= p.totalVolume * 0.7);
    assert.ok(p.vah >= p.poc.price, `VAH ${p.vah} >= POC ${p.poc.price}`);
    assert.ok(p.val <= p.poc.price, `VAL ${p.val} <= POC ${p.poc.price}`);
  });

  it('wider value-area percent never shrinks the zone', () => {
    const candles = [];
    for (let i = 0; i < 30; i += 1) {
      const base = 50 + i * 0.4;
      candles.push(bar(base, base + 1, base - 1, base, 100));
    }
    const narrow = computeVolumeProfile(candles, { rows: 20, valueAreaPercent: 50 });
    const wide = computeVolumeProfile(candles, { rows: 20, valueAreaPercent: 90 });
    assert.ok(wide.vah - wide.val >= narrow.vah - narrow.val);
  });

  it('handles a flat (single-price) market as one row', () => {
    const p = computeVolumeProfile([bar(5, 5, 5, 5, 100), bar(5, 5, 5, 5, 200)]);
    assert.equal(p.rows.length, 1);
    assert.equal(p.poc.price, 5);
    assert.equal(p.vah, 5);
    assert.equal(p.val, 5);
  });

  it('clamps row counts and ignores corrupt bars', () => {
    const candles = [bar(10, 12, 9, 11, 100), null, { open: 'x' }, bar(11, 13, 10, 12, 100)];
    const p = computeVolumeProfile(candles, { rows: 1000 });
    assert.ok(p.rows.length <= 200);
    const sum = p.rows.reduce((s, r) => s + r.volume, 0);
    assert.ok(Math.abs(sum - 200) < 1e-9);
  });
});
