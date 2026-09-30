/**
 * Unit tests for the TradingView-style number-key timeframe quick switch.
 * Run with: node --test src/utils/timeframeQuickSwitch.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTimeframeBuffer } from './chartHelpers.js';

describe('resolveTimeframeBuffer', () => {
  it('maps single digits to minute timeframes', () => {
    assert.equal(resolveTimeframeBuffer('1'), '1m');
    assert.equal(resolveTimeframeBuffer('5'), '5m');
  });

  it('maps multi-digit buffers to minute timeframes', () => {
    assert.equal(resolveTimeframeBuffer('15'), '15m');
    assert.equal(resolveTimeframeBuffer('30'), '30m');
  });

  it('honours h/d suffixes', () => {
    assert.equal(resolveTimeframeBuffer('1h'), '1h');
    assert.equal(resolveTimeframeBuffer('4h'), '4h');
    assert.equal(resolveTimeframeBuffer('1d'), '1d');
    assert.equal(resolveTimeframeBuffer('1H'), '1h');
    assert.equal(resolveTimeframeBuffer('1D'), '1d');
  });

  it('supports bare unit letters and minute aliases', () => {
    assert.equal(resolveTimeframeBuffer('h'), '1h');
    assert.equal(resolveTimeframeBuffer('d'), '1d');
    assert.equal(resolveTimeframeBuffer('60'), '1h');
    assert.equal(resolveTimeframeBuffer('240'), '4h');
  });

  it('returns null for unknown buffers', () => {
    assert.equal(resolveTimeframeBuffer(''), null);
    assert.equal(resolveTimeframeBuffer('2'), null);
    assert.equal(resolveTimeframeBuffer('9'), null);
    assert.equal(resolveTimeframeBuffer('abc'), null);
    assert.equal(resolveTimeframeBuffer('1w'), null);
  });
});
