import { toChartTime, sanitizeCandles } from '../../utils/chartHelpers';

/** Human label for the replay cursor bar: epoch seconds → HH:MM, daily dates as-is. */
export function formatReplayBarLabel(t) {
  if (t == null) return '';
  if (typeof t === 'number' && Number.isFinite(t)) {
    try {
      return new Date(t * 1000).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return String(t);
    }
  }
  return String(t).slice(0, 10);
}

/**
 * Raw /history rows → chart-ready candles (OHLC-invariant enforced, sorted,
 * duplicate-free). Shared by initial load and left-pan backfills so both
 * paths produce identical shapes.
 */
export function formatHistoryCandles(rawCandles, isIntraday) {
  const formatted = [];
  if (!Array.isArray(rawCandles)) return formatted;
  for (let i = 0; i < rawCandles.length; i++) {
    const c = rawCandles[i];
    const t = toChartTime(c.date || c.time, isIntraday);
    const open = Number(c.open);
    const high = Number(c.high);
    const low = Number(c.low);
    const close = Number(c.close);
    const volume = Number(c.volume || 0);
    // Enforce OHLC consistency invariant & preserve all indicator attributes
    if (t && !isNaN(open) && open > 0 && !isNaN(close) && close > 0 && !isNaN(high) && !isNaN(low)
        && high >= Math.max(open, close) && low <= Math.min(open, close)) {
      formatted.push({
        ...c,
        time: t,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
        volume: isNaN(volume) ? 0 : volume,
      });
    }
  }
  // Strictly sorted + duplicate-free (lightweight-charts rejects out-of-order).
  return sanitizeCandles(formatted);
}
