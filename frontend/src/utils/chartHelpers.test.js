/**
 * Unit tests for the NSE session-anchored live bucket math.
 * Run with: node --test src/utils/chartHelpers.test.js  (Node >= 18, no deps needed)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSessionBucketStart } from './chartHelpers.js';

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
});
