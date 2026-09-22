/**
 * Unit tests for the NSE session-anchored live bucket math.
 * Run with: node --test src/utils/chartHelpers.test.js  (Node >= 18, no deps needed)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSessionBucketStart, sanitizeSeriesData, sanitizeCandles, isAppendableTime, compareChartTime, computeFillSlots, INTERVAL_SLOT_SEC, normalizeInterval, isSupportedInterval, SUPPORTED_INTERVALS } from './chartHelpers.js';

const IST_OFFSET_MS = 5.5 * 3600 * 1000;
const HOUR = 3600;
const DAY = 86400;

/** Epoch seconds for an IST wall-clock time: (y, mo 1-12, d, h, mi, s). */
const istEpochSec = (y, mo, d, h, mi, s = 0) =>
  (Date.UTC(y, mo - 1, d, h, mi, s) - IST_OFFSET_MS) / 1000;

/** Format an epoch-second value back to "YYYY-MM-DD HH:MM:SS IST" for readable assertions. */
const istLabel = (epochSec) =>
  new Date(epochSec * 1000 + IST_OFFSET_MS).toISOString().substring(0, 19).replace('T', ' ');

describe('getSessionBucketStart', () => {
  describe('1h — anchored at 09:15 IST (the ghost-bar regression)', () => {
    it('buckets ticks inside 09:15–10:15 to the 09:15 bar', () => {
      for (const [h, mi] of [[9, 16], [9, 30], [9, 59], [10, 14]]) {
        const got = getSessionBucketStart('1h', istEpochSec(2026, 8, 5, h, mi) * 1000);
        assert.equal(istLabel(got), '2026-08-05 09:15:00', `tick at ${h}:${String(mi).padStart(2, '0')} IST`);
      }
    });

    it('buckets an afternoon tick to the matching :15 bar', () => {
      const got = getSessionBucketStart('1h', istEpochSec(2026, 8, 5, 15, 25) * 1000);
      assert.equal(istLabel(got), '2026-08-05 15:15:00');
    });

    it('keeps post-close ticks on the final 15:15 bar instead of minting a 15:30 bar', () => {
      const got = getSessionBucketStart('1h', istEpochSec(2026, 8, 5, 15, 35) * 1000);
      assert.equal(istLabel(got), '2026-08-05 15:15:00');
      // Regression guard: the naive epoch-hour floor would return 15:30 IST here.
      const naive = Math.floor(istEpochSec(2026, 8, 5, 15, 35) / HOUR) * HOUR;
      assert.notEqual(got, naive, 'naive UTC-hour floor must NOT be used for 1h');
    });

    it('rolls to the next hourly bar only after the full hour elapses', () => {
      const got = getSessionBucketStart('1h', istEpochSec(2026, 8, 5, 10, 45) * 1000);
      assert.equal(istLabel(got), '2026-08-05 10:15:00');
    });
  });

  describe('1m / 5m / 15m — in-session behaviour is unchanged vs the naive epoch grid', () => {
    it('5m', () => {
      const now = istEpochSec(2026, 8, 5, 9, 47, 59) * 1000;
      assert.equal(istLabel(getSessionBucketStart('5m', now)), '2026-08-05 09:45:00');
      assert.equal(getSessionBucketStart('5m', now), Math.floor(now / 1000 / 300) * 300);
    });

    it('15m', () => {
      const now = istEpochSec(2026, 8, 5, 11, 7, 30) * 1000;
      assert.equal(istLabel(getSessionBucketStart('15m', now)), '2026-08-05 11:00:00');
      assert.equal(getSessionBucketStart('15m', now), Math.floor(now / 1000 / 900) * 900);
    });

    it('1m', () => {
      const now = istEpochSec(2026, 8, 5, 10, 5, 30) * 1000;
      assert.equal(istLabel(getSessionBucketStart('1m', now)), '2026-08-05 10:05:00');
      assert.equal(getSessionBucketStart('1m', now), Math.floor(now / 1000 / 60) * 60);
    });

    it('falls back to a 300s bucket for unknown intervals', () => {
      const now = istEpochSec(2026, 8, 5, 10, 5, 30) * 1000;
      assert.equal(getSessionBucketStart('2h', now), getSessionBucketStart('5m', now));
      assert.equal(getSessionBucketStart(undefined, now), getSessionBucketStart('5m', now));
    });
  });

  describe('day & weekend boundaries', () => {
    it('anchors to the current IST day, not the UTC day (Sunday 19:00 UTC = Monday 00:30 IST)', () => {
      // Sunday 2026-08-09 19:00 UTC is Monday 2026-08-10 00:30 IST. The 1h grid is anchored
      // to Monday 09:15 IST, so 00:30 wraps into the preceding bucket: Monday 00:15.
      // (A UTC-day naive anchor would instead produce a Sunday bucket.)
      const got = getSessionBucketStart('1h', Date.UTC(2026, 7, 9, 19, 0, 0));
      assert.equal(istLabel(got), '2026-08-10 00:15:00');
    });

    it('produces consistent results across two consecutive trading days', () => {
      const day1 = getSessionBucketStart('1h', istEpochSec(2026, 8, 5, 10, 30) * 1000);
      const day2 = getSessionBucketStart('1h', istEpochSec(2026, 8, 6, 10, 30) * 1000);
      assert.equal(istLabel(day1), '2026-08-05 10:15:00');
      assert.equal(istLabel(day2), '2026-08-06 10:15:00');
      assert.equal(day2 - day1, DAY, 'identical wall-clock buckets on consecutive days are 24h apart');
    });
  });

  describe('sanitizeSeriesData — asc-order crash regression', () => {
    it('reproduces the reported crash: late bucket 1789805400 after 1789805580 is reordered, never descending', () => {
      const prev = 1789805580;
      const late = 1789805400;
      assert.equal(isAppendableTime(prev, late), false, 'stale live bucket must not be appendable');
      const sanitized = sanitizeSeriesData([
        { time: prev, value: 100 },
        { time: late, value: 101 },
      ]);
      assert.deepEqual(sanitized.map((p) => p.time), [late, prev]);
      assert.ok(isAsc(sanitized), 'sanitized output must be ascending');
    });

    it('dedupes by time keeping the last occurrence', () => {
      const out = sanitizeSeriesData([
        { time: 100, value: 1 },
        { time: 100, value: 2 },
        { time: 101, value: 3 },
      ]);
      assert.deepEqual(out, [{ time: 100, value: 2 }, { time: 101, value: 3 }]);
    });

    it('sorts daily YYYY-MM-DD strings ascending', () => {
      const out = sanitizeCandles([
        { time: '2026-09-19', open: 1, high: 1, low: 1, close: 1 },
        { time: '2026-09-17', open: 1, high: 1, low: 1, close: 1 },
        { time: '2026-09-18', open: 1, high: 1, low: 1, close: 1 },
      ]);
      assert.deepEqual(out.map((c) => c.time), ['2026-09-17', '2026-09-18', '2026-09-19']);
    });

    it('drops type-mixed times (numbers vs strings cannot share one series)', () => {
      const out = sanitizeSeriesData([
        { time: 1789805580, value: 1 },
        { time: '2026-09-19', value: 2 },
        { time: 1789805600, value: 3 },
      ]);
      assert.ok(out.every((p) => typeof p.time === 'number'), 'only dominant number type kept');
      assert.ok(isAsc(out));
    });

    it('isAppendableTime requires same type and strict increase', () => {
      assert.equal(isAppendableTime(100, 101), true);
      assert.equal(isAppendableTime(101, 100), false);
      assert.equal(isAppendableTime(100, 100), false);
      assert.equal(isAppendableTime('2026-09-18', '2026-09-19'), true);
      assert.equal(isAppendableTime('2026-09-19', '2026-09-18'), false);
      assert.equal(isAppendableTime(100, '2026-09-19'), false);
      assert.equal(isAppendableTime(null, 100), true);
      assert.equal(isAppendableTime(100, null), false);
    });

    it('compareChartTime orders equal/daily/intraday correctly', () => {
      assert.equal(compareChartTime(100, 100), 0);
      assert.equal(compareChartTime(100, 101), -1);
      assert.equal(compareChartTime('2026-09-18', '2026-09-19'), -1);
    });
  });

  describe('normalizeInterval — unsupported timeframe crash regression', () => {
    it('accepts every backend-served interval', () => {
      for (const iv of ['1s', '30s', '1m', '5m', '15m', '30m', '1h', '4h', '1d']) {
        assert.equal(isSupportedInterval(iv), true);
        assert.equal(normalizeInterval(iv), iv);
      }
      assert.deepEqual(SUPPORTED_INTERVALS, ['1s', '30s', '1m', '5m', '15m', '30m', '1h', '4h', '1d']);
    });

    it('coerces toolbar-only intervals that 422 the backend', () => {
      // 3m/2h/1w/1M used to blank the chart into a dead empty state
      for (const iv of ['3m', '2h', '1w', '1M', '', null, undefined, 'abc']) {
        assert.equal(isSupportedInterval(iv), false);
        assert.ok(isSupportedInterval(normalizeInterval(iv, '1m')), `normalized ${iv}`);
      }
      assert.equal(normalizeInterval('3m', '1m'), '1m');
      assert.equal(normalizeInterval('1W', '1d'), '1d');
    });
  });

  describe('computeFillSlots — live stall backfill (broken-candles regression)', () => {
    it('fills skipped 1m slots between consecutive buckets', () => {
      // buckets 10:00, then stall, tick at 10:04 -> fill 10:01..10:03
      const t0 = 1789805400;
      assert.deepEqual(
        computeFillSlots(t0, t0 + 4 * 60, INTERVAL_SLOT_SEC['1m'], { sameDayOnly: false }),
        [t0 + 60, t0 + 120, t0 + 180]
      );
    });

    it('returns [] for adjacent buckets, stale buckets, and oversized skips', () => {
      const t0 = 1789805400;
      assert.deepEqual(computeFillSlots(t0, t0 + 60, 60, {}), []);
      assert.deepEqual(computeFillSlots(t0 + 60, t0, 60, {}), []);
      assert.deepEqual(computeFillSlots(t0, t0 + 60 * 60, 60, {}), []); // 59 skips > cap 15
    });

    it('returns [] for non-numeric times and unknown intervals', () => {
      assert.deepEqual(computeFillSlots('2026-09-19', '2026-09-20', 60, {}), []);
      assert.deepEqual(computeFillSlots(100, 200, undefined, {}), []);
      assert.equal(INTERVAL_SLOT_SEC['1d'], undefined);
      assert.equal(INTERVAL_SLOT_SEC['1s'], undefined);
    });

    it('sameDayOnly never bridges NSE overnights (IST)', () => {
      // Friday 15:29 -> Monday 09:16 IST must stay a visible gap
      const friClose = Math.floor(Date.UTC(2026, 7, 7, 9, 59) / 1000);
      const monOpen = Math.floor(Date.UTC(2026, 7, 10, 3, 46) / 1000);
      assert.deepEqual(computeFillSlots(friClose, monOpen, 60, { sameDayOnly: true }), []);
      // ...but fills inside the same session day
      assert.deepEqual(
        computeFillSlots(friClose, friClose + 3 * 60, 60, { sameDayOnly: true }),
        [friClose + 60, friClose + 120]
      );
    });
  });
});

function isAsc(points) {
  for (let i = 1; i < points.length; i++) {
    if (!(points[i - 1].time < points[i].time)) return false;
  }
  return true;
}
