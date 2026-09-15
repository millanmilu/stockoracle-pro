/**
 * Unit tests for the drawing-tools geometry engine.
 * Run with: node --test src/utils/drawingGeometry.test.js  (Node >= 18, no deps)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIB_LEVEL_STYLE,
  FIB_RETRACEMENT_LEVELS,
  FIB_EXTENSION_LEVELS,
  GANN_FAN_ANGLES,
  arrowHead,
  channelQuad,
  clamp,
  circleFromRadius,
  dateRangeStats,
  disjointChannelQuads,
  distance,
  edgeExit,
  ellipseFromBox,
  elliottWaveLabels,
  extendLine,
  fibChannelLines,
  fibExtensionLines,
  fibRetracementBands,
  fibRetracementLines,
  fibTimezoneLines,
  flatTopQuad,
  forecastProjection,
  formatDuration,
  formatSignedPercent,
  formatSignedPrice,
  fullLineEndpoints,
  gannBoxLevels,
  gannFanLines,
  isDegenerate,
  measureStats,
  midpoint,
  normalizeRect,
  patternLegRatios,
  pitchforkLines,
  polygonPath,
  polylinePath,
  projectionLevels,
  rayEnd,
  signedPerpendicularOffset,
  strokeDasharray,
  triangleFromBox,
  trianglePatternVertices,
  trendAngle,
} from './drawingGeometry.js';

const p = (x, y, extra = {}) => ({ x, y, ...extra });

describe('drawingGeometry — primitives', () => {
  it('distance / midpoint / clamp / isDegenerate behave as expected', () => {
    assert.equal(distance(p(0, 0), p(3, 4)), 5);
    assert.deepEqual(midpoint(p(0, 0), p(10, 20)), { x: 5, y: 10 });
    assert.equal(clamp(150, 0, 100), 100);
    assert.equal(clamp(-5, 0, 100), 0);
    assert.equal(clamp('abc', 7, 100), 7); // non-numeric falls back to min
    assert.equal(isDegenerate(p(0, 0), p(0, 0.4)), true);
    assert.equal(isDegenerate(p(0, 0), p(0, 4)), false);
  });

  it('extendLine continues the a→b direction', () => {
    const out = extendLine(p(0, 0), p(10, 0), 2);
    assert.deepEqual(out, { x: 30, y: 0 });
  });
});

describe('drawingGeometry — lines', () => {
  it('edgeExit clips a ray to the first surface edge it crosses', () => {
    const surface = { width: 100, height: 50 };
    // (10,10)→(60,30): x=100 at t=1.8 reaches before y=50 at t=2, so the right edge wins.
    const exit = edgeExit(p(10, 10), p(60, 30), surface);
    assert.equal(exit.x, 100);
    assert.equal(exit.y, 46);
  });

  it('edgeExit handles upward rays (exits through y = 0)', () => {
    const exit = edgeExit(p(50, 40), p(60, 20), { width: 200, height: 100 });
    assert.equal(exit.y, 0);
    assert.equal(exit.x, 70); // y=0 is reached at t=2 → x = 50 + 10*2
  });

  it('edgeExit falls back to a 10x projection without surface bounds', () => {
    assert.deepEqual(edgeExit(p(0, 0), p(2, 0)), { x: 20, y: 0 });
  });

  it('rayEnd === edgeExit(a, b) and clamps degenerate input', () => {
    assert.deepEqual(rayEnd(p(0, 0), p(5, 5), { width: 10, height: 10 }), edgeExit(p(0, 0), p(5, 5), { width: 10, height: 10 }));
    assert.deepEqual(rayEnd(p(1, 1), p(1, 1), { width: 10, height: 10 }), p(1, 1));
  });

  it('fullLineEndpoints spans the surface on both sides', () => {
    const [left, right] = fullLineEndpoints(p(50, 25), p(60, 25), { width: 100, height: 50 });
    assert.equal(left.x, 0);
    assert.equal(right.x, 100);
    assert.equal(left.y, 25);
    assert.equal(right.y, 25);
  });

  it('trendAngle reports screen degrees (up = positive)', () => {
    assert.equal(trendAngle(p(0, 10), p(10, 0)), 45);
    assert.equal(trendAngle(p(0, 0), p(10, 10)), -45);
    assert.equal(trendAngle(p(0, 0), p(0, 0)), 0);
  });
});

describe('drawingGeometry — shapes', () => {
  it('normalizeRect is order independent', () => {
    assert.deepEqual(normalizeRect(p(10, 20), p(0, 0)), { x: 0, y: 0, width: 10, height: 20 });
    assert.deepEqual(normalizeRect(p(0, 0), p(10, 20)), { x: 0, y: 0, width: 10, height: 20 });
  });

  it('ellipseFromBox / circleFromRadius', () => {
    assert.deepEqual(ellipseFromBox(p(0, 0), p(10, 20)), { cx: 5, cy: 10, rx: 5, ry: 10 });
    assert.deepEqual(circleFromRadius(p(1, 1), p(4, 5)), { cx: 1, cy: 1, r: 5 });
  });

  it('triangleFromBox returns apex + base corners', () => {
    const [apex, br, bl] = triangleFromBox(p(0, 0), p(10, 10));
    assert.deepEqual(apex, { x: 5, y: 0 });
    assert.deepEqual(br, { x: 10, y: 10 });
    assert.deepEqual(bl, { x: 0, y: 10 });
  });

  it('trianglePatternVertices adds the two midpoint labels', () => {
    const verts = trianglePatternVertices(p(0, 0), p(10, 0), p(10, 10));
    assert.equal(verts.length, 5);
    assert.deepEqual(verts[3], { x: 5, y: 5 });
    assert.deepEqual(verts[4], { x: 10, y: 5 });
  });

  it('arrowHead returns two barbs behind the tip', () => {
    const barbs = arrowHead(p(0, 0), p(100, 0), 12);
    assert.equal(barbs.length, 2);
    for (const barb of barbs) assert.ok(barb.x < 100 && Math.abs(barb.y) <= 12.001);
  });

  it('channelQuad offsets perpendicular to the base line', () => {
    const quad = channelQuad(p(0, 0), p(10, 0), 5);
    assert.equal(quad.length, 4);
    // Screen y grows downward, so a positive width draws the band below the base.
    assert.deepEqual(quad[2], { x: 10, y: 5 });
    assert.deepEqual(quad[3], { x: 0, y: 5 });
    // Degenerate base still yields a usable quad.
    assert.equal(channelQuad(p(0, 0), p(0, 0), 8).length, 4);
  });

  it('disjointChannelQuads returns two rails and a fill band', () => {
    const { rail1, rail2, band } = disjointChannelQuads(p(0, 0), p(10, 0), p(0, 10), p(10, 10));
    assert.equal(rail1.length, 2);
    assert.equal(rail2.length, 2);
    assert.deepEqual(band, [p(0, 0), p(10, 0), p(10, 10), p(0, 10)]);
  });

  it('flatTopQuad flattens the rail through the first anchor', () => {
    assert.deepEqual(flatTopQuad(p(0, 0), p(10, 6)), [p(0, 0), p(10, 0), p(10, 6)]);
  });

  it('signedPerpendicularOffset matches the channelQuad offset direction', () => {
    assert.equal(signedPerpendicularOffset(p(0, 0), p(10, 0), p(0, 5)), 5);
    assert.equal(signedPerpendicularOffset(p(0, 0), p(10, 0), p(0, -5)), -5);
    assert.equal(signedPerpendicularOffset(p(2, 2), p(2, 2), p(9, 9)), 0);
    // The third anchor lies on the constructed channel edge.
    const edge = channelQuad(p(0, 0), p(10, 0), signedPerpendicularOffset(p(0, 0), p(10, 0), p(0, 5)));
    assert.deepEqual(edge[3], { x: 0, y: 5 });
  });
});

describe('drawingGeometry — Fibonacci', () => {
  it('fibRetracementLines interpolates price and pixel y', () => {
    const lines = fibRetracementLines(
      p(0, 0, { price: 100 }),
      p(100, 100, { price: 200 }),
    );
    assert.equal(lines.length, FIB_RETRACEMENT_LEVELS.length);
    assert.equal(lines[0].price, 100);
    assert.equal(lines[0].y, 0);
    assert.equal(lines[lines.length - 1].price, 200);
    assert.equal(lines[lines.length - 1].y, 100);
    const half = lines.find((l) => l.level === 0.5);
    assert.equal(half.price, 150);
    assert.equal(half.y, 50);
    assert.equal(half.top, 0);
    assert.equal(half.bottom, 50);
  });

  it('fibRetracementLines keeps top/bottom ordered for inverted anchors', () => {
    const lines = fibRetracementLines(p(0, 100, { price: 200 }), p(100, 0, { price: 100 }));
    for (const line of lines) assert.ok(line.top <= line.bottom);
  });

  it('fibExtensionLines projects the a→b move from c', () => {
    const lines = fibExtensionLines(
      p(0, 0, { price: 100 }),
      p(10, 10, { price: 120 }),
      p(20, 20, { price: 110 }),
    );
    assert.equal(lines.length, FIB_EXTENSION_LEVELS.length);
    const one = lines.find((l) => l.level === 1);
    assert.equal(one.price, 130); // 110 + (120-100)
    assert.equal(one.y, 30); // 20 + 10
    const golden = lines.find((l) => Math.abs(l.level - 1.618) < 1e-9);
    assert.ok(Math.abs(golden.price - (110 + 20 * 1.618)) < 1e-9);
  });

  it('fibTimezoneLines spaces bars by the anchor delta', () => {
    const zones = fibTimezoneLines(p(0, 0, { logical: 10 }), p(0, 0, { logical: 12 }), 4);
    assert.equal(zones.length, 4);
    assert.deepEqual(zones.map((z) => z.logical), [10, 12, 14, 16]);
    assert.deepEqual(zones.map((z) => z.level), [0, 1, 2, 3]);
  });

  it('fibChannelLines offsets every rail by the third anchor', () => {
    const rails = fibChannelLines(
      p(0, 0, { price: 100 }),
      p(10, 10, { price: 110 }),
      p(0, 40, { price: 100 }),
    );
    assert.equal(rails.length, FIB_RETRACEMENT_LEVELS.length);
    assert.equal(rails[0].line[0].x, 0);
    assert.equal(rails[0].line[1].y, 40 + 10); // c.y + span y
  });
});

describe('drawingGeometry — fibRetracementBands', () => {
  const a = { x: 100, y: 100, price: 100 };
  const b = { x: 300, y: 400, price: 200 };

  it('returns one band per enriched level', () => {
    const bands = fibRetracementBands(a, b);
    assert.equal(bands.length, FIB_RETRACEMENT_LEVELS.length);
  });

  it('interpolates price and y between anchors', () => {
    const bands = fibRetracementBands(a, b);
    const mid = bands.find((l) => Math.abs(l.level - 0.5) < 1e-9);
    assert.ok(mid);
    assert.ok(Math.abs(mid.price - 150) < 1e-9);
    assert.ok(Math.abs(mid.y - 250) < 1e-9);
  });

  it('keeps colours and labels from FIB_LEVEL_STYLE', () => {
    const bands = fibRetracementBands(a, b);
    const half = bands.find((l) => Math.abs(l.level - 0.5) < 1e-9);
    assert.equal(half.color, '#10B981');
    assert.equal(half.label, '0.5 (50.0%)');
    assert.ok(half.fill.startsWith('rgba(16,185,129'));
  });

  it('honours a→b direction so bands render identically on anchor swap', () => {
    const bandsAB = fibRetracementBands(a, b);
    const bandsBA = fibRetracementBands(b, a);
    assert.equal(bandsAB.length, bandsBA.length);
    bandsAB.forEach((ab, i) => {
      assert.ok(Math.abs(ab.y - bandsBA[i].y) < 1e-9);
      assert.ok(Math.abs(ab.price - bandsBA[i].price) < 1e-9);
      assert.equal(ab.color, bandsBA[i].color);
    });
  });

  it('derives xLow/xHigh and border flags for the 0/1 level pair', () => {
    const bands = fibRetracementBands(a, b);
    const zero = bands[0];
    const one = bands[bands.length - 1];
    assert.equal(zero.rectTop, 100);            // top of chart is above anchor
    assert.ok(zero.borderTop);
    assert.ok(!zero.borderBottom);
    assert.equal(one.borderBottom, true);
    assert.ok(Math.abs(one.y - 400) < 1e-9);
    assert.ok(Math.abs(one.rectTop - 400) < 1e-9);
    assert.ok(one.rectHeight <= 1);            // bottom band collapses to a line
  });

  it('produces a valid rectTop/rectHeight for every band', () => {
    const bands = fibRetracementBands(a, b);
    bands.forEach((band) => {
      assert.ok(band.rectTop <= band.lineBottom);
      assert.ok(band.rectHeight >= 1);
    });
  });

  it('falls back to numeric levels when no enriched metadata is supplied', () => {
    const plainBands = fibRetracementBands(a, b, FIB_RETRACEMENT_LEVELS);
    const mid = plainBands.find((l) => Math.abs(l.level - 0.5) < 1e-9);
    assert.ok(mid);
    assert.equal(mid.color, '#787B86');         // default colour
    assert.equal(mid.label, '0.5');             // default label
  });
});

describe('drawingGeometry — Gann & pitchfork', () => {
  it('gannFanLines returns one ray per Gann angle', () => {
    const rays = gannFanLines(p(0, 0), p(100, 100));
    assert.equal(rays.length, GANN_FAN_ANGLES.length);
    assert.equal(rays.length, 9);
    // The 45° fan line reproduces the a→b move exactly (FP tolerance: tan 45°).
    const fortyFive = rays.find((r) => r.deg === 45);
    assert.equal(fortyFive.end.x, 100);
    assert.ok(Math.abs(fortyFive.end.y - 100) < 1e-9);
  });

  it('gannBoxLevels builds a normalized retracement grid', () => {
    const grid = gannBoxLevels(p(20, 30), p(0, 0));
    assert.equal(grid.length, FIB_RETRACEMENT_LEVELS.length);
    assert.deepEqual(grid[0], { level: 0, x: 0, y: 0 });
    assert.deepEqual(grid[grid.length - 1], { level: 1, x: 20, y: 30 });
  });

  it('pitchforkLines variants move the median origin', () => {
    const a = p(0, 0);
    const b = p(10, 0);
    const c = p(10, 10);
    assert.deepEqual(pitchforkLines(a, b, c, 'pitchfork').origin, { x: 10, y: 5 });
    assert.deepEqual(pitchforkLines(a, b, c, 'schiff').origin, { x: 5, y: 0 });
    assert.deepEqual(pitchforkLines(a, b, c, 'inside').origin, { x: 7.5, y: 2.5 });
    const fork = pitchforkLines(a, b, c);
    assert.equal(fork.median.length, 2);
    assert.equal(fork.upper.length, 2);
    assert.equal(fork.lower.length, 2);
  });
});

describe('drawingGeometry — measurement tools', () => {
  it('measureStats mirrors the TradingView ruler readout', () => {
    const stats = measureStats(
      p(0, 0, { price: 100, logical: 0 }),
      p(100, 50, { price: 110, logical: 10 }),
      60_000,
    );
    assert.equal(stats.delta, 10);
    assert.equal(stats.percent, 10);
    assert.equal(stats.bars, 10);
    assert.equal(stats.durationMs, 600_000);
  });

  it('measureStats is safe with missing anchors and zero prices', () => {
    const stats = measureStats(undefined, p(1, 1), 0);
    assert.equal(stats.percent, 0);
    assert.equal(stats.bars, 0);
    assert.equal(stats.durationMs, 0);
  });

  it('formats signed price / percent / duration', () => {
    assert.equal(formatSignedPrice(12.5), '+₹12.50');
    assert.equal(formatSignedPrice(-7), '-₹7.00');
    assert.equal(formatSignedPrice(0), '₹0.00');
    assert.equal(formatSignedPercent(4.25), '+4.25%');
    assert.equal(formatSignedPercent(-1.5), '-1.50%');
    assert.equal(formatDuration(600_000), '10m');
    assert.equal(formatDuration(3 * 86_400_000 + 4 * 3_600_000), '3D 4h');
    assert.equal(formatDuration(0), '0m');
  });

  it('dateRangeStats counts bars and duration', () => {
    const stats = dateRangeStats(p(0, 0, { logical: 5 }), p(0, 0, { logical: 15 }), 3_600_000);
    assert.equal(stats.bars, 10);
    assert.equal(stats.durationMs, 36_000_000);
  });
});

describe('drawingGeometry — patterns', () => {
  it('patternLegRatios labels each completed leg with its realised ratio', () => {
    const legs = patternLegRatios(
      [p(0, 0, { price: 100 }), p(10, 10, { price: 110 }), p(20, 0, { price: 100 })],
      ['A', 'B'],
    );
    assert.equal(legs.length, 2);
    assert.equal(legs[0].label, 'A');
    assert.equal(legs[0].ratio, null);
    assert.equal(legs[1].label, 'B');
    assert.equal(legs[1].ratio, 1);
    assert.equal(legs[1].ratioLabel, '1.000');
    assert.equal(legs[1].bullish, true); // last leg moves up the screen
  });

  it('patternLegRatios tolerates empty input', () => {
    assert.deepEqual(patternLegRatios(), []);
    assert.deepEqual(patternLegRatios([p(0, 0)]), []);
  });

  it('elliottWaveLabels produces impulse and correction sequences', () => {
    assert.deepEqual(elliottWaveLabels(6, 'impulse'), ['0', '1', '2', '3', '4', '5']);
    assert.deepEqual(elliottWaveLabels(4, 'correction'), ['0', 'A', 'B', 'C']);
    assert.deepEqual(elliottWaveLabels(2, 'impulse'), ['0', '1']);
    assert.deepEqual(elliottWaveLabels(0), []);
  });
});

describe('drawingGeometry — SVG helpers', () => {
  it('polylinePath / polygonPath build valid SVG path strings', () => {
    const pts = [p(1, 2), p(3, 4)];
    assert.equal(polylinePath(pts), 'M 1.00 2.00 L 3.00 4.00');
    assert.equal(polygonPath(pts), 'M 1.00 2.00 L 3.00 4.00 Z');
    assert.equal(polylinePath([]), '');
    assert.equal(polygonPath(), '');
  });

  it('strokeDasharray maps line styles to dash patterns', () => {
    assert.equal(strokeDasharray('solid', 2), undefined);
    assert.equal(strokeDasharray('dashed', 2), '6 4');
    assert.equal(strokeDasharray('dotted', 2), '2 4');
    assert.equal(strokeDasharray(undefined, 1), undefined);
  });
});

describe('drawingGeometry — projection tools', () => {
  it('forecastProjection repeats the a→b move from c', () => {
    const out = forecastProjection(
      p(0, 0, { price: 100 }),
      p(10, 10, { price: 120 }),
      p(50, 50, { price: 130 }),
    );
    assert.deepEqual(out.target, { x: 60, y: 60, price: 150 });
    assert.equal(out.level2, 60);
    assert.equal(out.price2, 150);
  });

  it('projectionLevels stacks two levels from the first move', () => {
    const levels = projectionLevels(
      p(0, 0, { price: 100 }),
      p(10, 10, { price: 125 }),
      p(30, 30, { price: 120 }),
    );
    assert.deepEqual(levels.level1, { y: 30, price: 120 });
    assert.deepEqual(levels.level2, { y: 40, price: 145 });
  });
});