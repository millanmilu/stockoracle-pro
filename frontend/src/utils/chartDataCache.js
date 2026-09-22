/**
 * StockOracle Pro — in-memory chart data cache.
 *
 * Problem: switching app views unmounts LiveChartView (App.jsx renders only
 * the active view), so returning to the chart remounts from empty state and
 * waits on a full network fetch — the chart looks blank "as if candles never
 * formed". Browser-tab switches can also discard the lightweight-charts
 * canvas bitmap while hidden.
 *
 * This module keeps the last good candle set per symbol+interval in memory
 * (same JS context, zero I/O) so a remount restores instantly and then
 * refreshes in the background.
 */

const cache = new Map(); // key -> { candles, dataSource, ts, bytes }
const MAX_ENTRIES = 5;
// Byte budget: with ~10-13 MB per full-history entry, 20 entries ≈ 200 MB JS
// heap (mobile risk). Cap total cached bytes; oldest entries evicted first.
// Per-candle estimate (~1.2 KB with 71 indicator cols) avoids a full
// JSON.stringify on every write (which would itself jank on 7k+ rows).
const MAX_BYTES = 30 * 1024 * 1024;
const BYTES_PER_CANDLE = 1200;

function entryBytes(candles) {
  return (Array.isArray(candles) ? candles.length : 0) * BYTES_PER_CANDLE;
}

function evictIfNeeded() {
  while (cache.size > MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  let total = 0;
  for (const v of cache.values()) total += v.bytes || 0;
  while (total > MAX_BYTES && cache.size > 1) {
    const oldest = cache.keys().next().value;
    const evicted = cache.get(oldest);
    total -= evicted?.bytes || 0;
    cache.delete(oldest);
  }
}

export function clearChartCache() {
  cache.clear();
}

export function cacheKey(symbol, interval) {
  return `${String(symbol || '').toUpperCase()}__${String(interval || '1d')}`;
}

export function getCachedCandles(symbol, interval) {
  try {
    const hit = cache.get(cacheKey(symbol, interval));
    if (hit && Array.isArray(hit.candles) && hit.candles.length > 0) return hit;
  } catch {}
  return null;
}

export function setCachedCandles(symbol, interval, candles, dataSource = 'cache') {
  try {
    if (!Array.isArray(candles) || candles.length === 0) return;
    cache.set(cacheKey(symbol, interval), {
      candles,
      dataSource,
      ts: Date.now(),
      bytes: entryBytes(candles),
    });
    evictIfNeeded();
  } catch {}
}
