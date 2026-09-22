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

const cache = new Map(); // key -> { candles, dataSource, ts }
const MAX_ENTRIES = 20;

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
    });
    if (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
  } catch {}
}
