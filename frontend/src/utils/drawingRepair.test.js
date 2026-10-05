/**
 * Unit tests for drawing persistence repair (repairDrawings).
 *
 * Regression: the repair pass hardcoded `need = 3` anchors for every
 * points-array drawing, so every 2-point extended tool (Fixed Range
 * Volume Profile, Fib Fan, Gann Fan, Ellipse, Triangle, Arc, Fib Circle,
 * Extended Line, Date/Price Range, Regression Trend, Bars Pattern, …)
 * was silently dropped from localStorage on every reload.
 *
 * Run with: node --test src/utils/drawingRepair.test.js  (Node >= 18, no deps)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { repairDrawings } from '../components/chart-tools/drawingToolUtils.js';
import { ALL_DRAWING_TOOLS, getToolSpec } from '../components/chart-tools/drawingToolCatalog.js';

/** A fully-anchored drawing for a tool with `n` anchors. */
const anchoredDrawing = (type, n) => ({
  id: `d-${type}`,
  type,
  color: '#2962FF',
  points: Array.from({ length: n }, (_, i) => ({
    logical: (i + 1) * 10,
    price: 100 + i,
    time: (i + 1) * 1000,
    frac: 0,
    offMs: 0,
    tf: '1m',
  })),
});

describe('repairDrawings', () => {
  it('keeps every extended tool that has its full anchor set', () => {
    let checked = 0;
    for (const tool of ALL_DRAWING_TOOLS) {
      const n = getToolSpec(tool.id)?.points;
      if (typeof n !== 'number' || n === 0) continue; // cursors + freehand
      const res = repairDrawings([anchoredDrawing(tool.id, n)]);
      assert.equal(res.dropped, 0, `${tool.id} (${n} anchors) must survive repair`);
      assert.equal(res.clean.length, 1, `${tool.id} must be kept intact`);
      checked += 1;
    }
    // The catalog ships dozens of anchor tools — guard against a
    // catalog refactor silently emptying this test.
    assert.ok(checked >= 40, `expected >= 40 anchor tools, checked ${checked}`);
  });

  it('keeps a 2-anchor Fixed Range Volume Profile (reload regression)', () => {
    const frvp = anchoredDrawing('fixed_range_volume_profile', 2);
    const res = repairDrawings([frvp]);
    assert.equal(res.dropped, 0);
    assert.equal(res.clean.length, 1);
    assert.equal(res.clean[0].points.length, 2);
  });

  it('drops a partially-placed drawing instead of keeping it broken', () => {
    // 1 anchor of a 2-point tool — cannot render a range profile.
    const partial = anchoredDrawing('fixed_range_volume_profile', 1);
    const res = repairDrawings([partial]);
    assert.equal(res.dropped, 1);
    assert.equal(res.clean.length, 0);
  });

  it('drops a 4-anchor Head and Shoulders (needs all 5)', () => {
    const partial = anchoredDrawing('head_shoulders', 4);
    const res = repairDrawings([partial]);
    assert.equal(res.dropped, 1);
  });

  it('keeps a 5-anchor Head and Shoulders', () => {
    const full = anchoredDrawing('head_shoulders', 5);
    const res = repairDrawings([full]);
    assert.equal(res.dropped, 0);
    assert.equal(res.clean.length, 1);
  });

  it('still requires 2 anchors for polylines (freehand-point tools)', () => {
    assert.equal(repairDrawings([anchoredDrawing('polyline', 1)]).dropped, 1);
    assert.equal(repairDrawings([anchoredDrawing('polyline', 2)]).dropped, 0);
  });

  it('keeps single-anchor tools with one anchor', () => {
    for (const type of ['vertical_line', 'note', 'flag', 'pin', 'price_label']) {
      const res = repairDrawings([anchoredDrawing(type, 1)]);
      assert.equal(res.dropped, 0, `${type} (1 anchor) must survive`);
    }
  });

  it('drops malformed entries (null / missing type)', () => {
    const res = repairDrawings([null, { type: '' }, { type: 'trendline' }]);
    assert.equal(res.dropped, 3);
  });
});
