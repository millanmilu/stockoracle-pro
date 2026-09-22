/**
 * StockOracle Pro - Chart Utility Functions & Constants
 * Extracted from LiveChartView.jsx for reuse.
 */

export function parseNum(val) {
  if (val == null) return NaN;
  if (typeof val === 'number') return isNaN(val) ? NaN : val;
  const n = Number(String(val).replace(/,/g, ''));
  return isNaN(n) ? NaN : n;
}

// ── Lightweight 60-FPS Live Tick Bus (Bypasses React render cycles for TradingView smoothness) ──
const liveTickListeners = new Set();

export const subscribeLiveTick = (listener) => {
  liveTickListeners.add(listener);
  return () => liveTickListeners.delete(listener);
};

export const emitLiveTick = (tick) => {
  liveTickListeners.forEach((fn) => {
    try {
      fn(tick);
    } catch (_) {}
  });
};

export function toChartTime(dateStr, isIntraday) {
  if (!dateStr) return null;
  if (typeof dateStr === 'number') {
    const ms = dateStr > 1000000000000 ? dateStr : dateStr * 1000;
    if (!isIntraday) {
      return new Date(ms).toISOString().substring(0, 10);
    }
    return Math.floor(ms / 1000);
  }
  const str = String(dateStr).trim();
  if (!isIntraday) return str.substring(0, 10);

  let normalized = str.replace(' ', 'T');
  // Indian market equity intraday timestamps without offset are strictly in IST (+05:30)
  if (!normalized.includes('+') && !normalized.includes('Z') && !normalized.endsWith('-00:00')) {
    normalized = `${normalized}+05:30`;
  }

  const ms = Date.parse(normalized);
  if (isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

export function addBusinessDays(dateStr, days) {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).split('T')[0].trim();
  const parts = cleanStr.split('-').map(Number);
  if (parts.length < 3 || parts.some(isNaN)) {
    return dateStr;
  }
  const [year, month, day] = parts;
  const d = new Date(Date.UTC(year, month - 1, day));
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().split('T')[0];
}

export function isGoldSymbol(symbol) {
  if (!symbol) return false;
  const s = String(symbol).toUpperCase().trim();
  return s === 'XAUUSD' || s === 'GOLD' || s === 'PAXG' || s.startsWith('XAU') || s.startsWith('PAXG');
}

export function isCryptoSymbol(symbol) {
  if (!symbol) return false;
  const s = String(symbol).toUpperCase().trim();
  if (isGoldSymbol(s)) return true;
  return s === 'BTC' || s.startsWith('BTC') || s.includes('BITCOIN') || s.includes('ETH') || s.endsWith('USDT');
}

export const POPULAR_STOCKS = ['BTC', 'XAUUSD', 'GOLD', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'WIPRO', 'NIFTY50', 'BANKNIFTY'];

export const INTERVALS = [
  { label: '1s (1 sec)', value: '1s' },
  { label: '30s (30 sec)', value: '30s' },
  { label: '1m (1 min)', value: '1m' },
  { label: '5m (5 min)', value: '5m' },
  { label: '15m (15 min)', value: '15m' },
  { label: '30m (30 min)', value: '30m' },
  { label: '1H (1 hour)', value: '1h' },
  { label: '4H (4 hours)', value: '4h' },
  { label: '1D (Daily)', value: '1d' },
];

/**
 * Intervals the full stack actually supports (backend /history 422s anything
 * else, bucket math + slot-fill only know these grids). The toolbar used to
 * offer 3m/2h/1w/1M too — selecting one blanked the chart into a dead empty
 * state (backend 422 → Binance-daily fallback parsed as intraday → every row
 * dropped → no candles, live ticks ignored forever). Never offer those.
 */
export const SUPPORTED_INTERVALS = ['1s', '30s', '1m', '5m', '15m', '30m', '1h', '4h', '1d'];

export function isSupportedInterval(iv) {
  const raw = String(iv || '').trim();
  if (/^\d+[MW]$/.test(raw)) return false; // monthly/weekly ('1M','1W') — not minutes
  return SUPPORTED_INTERVALS.includes(raw.toLowerCase());
}

/** Coerces any interval (incl. stale persisted values like '3m') to a supported one. */
export function normalizeInterval(iv, fallback = '1m') {
  const raw = String(iv || '').trim();
  // Monthly/weekly shorthands ('1M', '1W') must NEVER collapse to minutes.
  if (/^\d+[MW]$/.test(raw)) return validFallback(fallback);
  if (SUPPORTED_INTERVALS.includes(raw)) return raw;
  const clean = raw.toLowerCase();
  if (SUPPORTED_INTERVALS.includes(clean)) return clean;
  return validFallback(fallback);
}

function validFallback(fallback) {
  const fb = String(fallback || '').toLowerCase();
  return SUPPORTED_INTERVALS.includes(fb) ? fb : '1m';
}

export const SIG = {
  buy:  { label: '▲ BUY',  color: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.28)' },
  sell: { label: '▼ SELL', color: '#EF5350', bg: 'rgba(239,83,80,0.10)',  border: 'rgba(239,83,80,0.28)' },
  hold: { label: '◆ HOLD', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
};

/**
 * Slim right price-axis width (px). Kept as a single source of truth so the
 * lightweight-charts price scale (`minimumWidth` below + Volume/Oscillator
 * panes) and the DrawingTools SVG overlay reserve the exact same strip —
 * drawings then end at the plot edge instead of bleeding over the axis.
 */
export const PRICE_AXIS_WIDTH = 56;

export const CHART_OPTIONS = {
  layout: {
    background: { type: 'solid', color: 'transparent' },
    textColor: '#6B7280',
    fontFamily: '"JetBrains Mono", "Courier New", monospace',
    fontSize: 11,
  },
  grid: {
    vertLines: { color: 'rgba(99,102,241,0.04)', style: 1 },
    horzLines: { color: 'rgba(99,102,241,0.06)' },
  },
  crosshair: {
    mode: 0, // CrosshairMode.Normal
    vertLine: { color: 'rgba(129,140,248,0.4)', width: 1, style: 2, labelBackgroundColor: '#1e1060' },
    horzLine: { color: 'rgba(129,140,248,0.4)', width: 1, style: 2, labelBackgroundColor: '#1e1060' },
  },
  rightPriceScale: {
    borderColor: 'rgba(99,102,241,0.12)',
    textColor: '#6B7280',
    scaleMargins: { top: 0.08, bottom: 0.16 },
    autoScale: true,
    alignLabels: true,
    minimumWidth: PRICE_AXIS_WIDTH, // Strict pixel alignment across main chart and stacked panes
  },
  timeScale: {
    borderColor: 'rgba(99,102,241,0.12)',
    textColor: '#6B7280',
    timeVisible: false,
    secondsVisible: false,
    shiftVisibleRangeOnNewBar: true,
    lockVisibleTimeRangeOnResize: true, // Prevents zoom jitter when panes appear/disappear or on resize
    rightOffset: 12,
    barSpacing: 9,
    minBarSpacing: 0.5,
    allowBoldLabels: true,
  },
  handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
  handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
  kineticScroll: { touch: true, mouse: true },
};

export const CANDLE_STYLE = {
  upColor: '#26A69A',
  downColor: '#EF5350',
  borderVisible: true,
  borderUpColor: '#26A69A',
  borderDownColor: '#EF5350',
  wickVisible: true,
  wickUpColor: '#26A69A',
  wickDownColor: '#EF5350',
};

/**
 * Compare two lightweight-charts times (UTCTimestamp number, 'YYYY-MM-DD'
 * string, or {year,month,day} BusinessDay object). Returns -1/0/1.
 * Mixed types are ordered deterministically (numbers < strings < objects)
 * so callers can detect a type-mix and filter it out.
 */
export function compareChartTime(a, b) {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const ta = typeof a;
  const tb = typeof b;
  if (ta === tb) {
    if (ta === 'number') return a < b ? -1 : a > b ? 1 : 0;
    if (ta === 'string') return a < b ? -1 : a > b ? 1 : 0;
    // BusinessDay objects {year,month,day}
    const sa = `${a.year}-${String(a.month).padStart(2, '0')}-${String(a.day).padStart(2, '0')}`;
    const sb = `${b.year}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`;
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  }
  const rank = (t) => (t === 'number' ? 0 : t === 'string' ? 1 : 2);
  return rank(ta) < rank(tb) ? -1 : 1;
}

/**
 * Sanitize an array of {time, ...} points for lightweight-charts `setData`,
 * which throws "Assertion failed: data must be asc ordered by time" on any
 * out-of-order or duplicate timestamp.
 *
 * Guarantees:
 * - drops entries with missing time
 * - drops type-mixed times (keeps only the dominant type: the type of the
 *   first valid entry; mixing BusinessDay strings with UTCTimestamps in one
 *   series is rejected by the library)
 * - sorts strictly ascending by time
 * - dedupes by time, keeping the LAST occurrence (freshest live update wins)
 *
 * Returns a NEW array; never mutates the input.
 */
export function sanitizeSeriesData(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const valid = points.filter((p) => p && p.time != null && p.time !== '');
  if (valid.length === 0) return [];
  const dominantType = typeof valid[0].time;
  const sameType = valid.filter((p) => typeof p.time === dominantType);
  const sorted = [...sameType].sort((a, b) => compareChartTime(a.time, b.time));
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || compareChartTime(sorted[i].time, sorted[i - 1].time) !== 0) {
      out.push(sorted[i]);
    } else {
      out[out.length - 1] = sorted[i];
    }
  }
  return out;
}

/**
 * Sanitize OHLC candles for `setData`. Sorts ascending, dedupes by time
 * (last wins), and enforces a single time type like sanitizeSeriesData.
 */
export function sanitizeCandles(candles) {
  return sanitizeSeriesData(candles);
}

/**
 * Returns true if `nextTime` is safe to append after `prevTime` in a
 * lightweight-charts series: same type and strictly greater.
 * Used by the live-tick hot path to drop stale/late buckets instead of
 * appending an out-of-order bar that would crash `setData`.
 */
export function isAppendableTime(prevTime, nextTime) {
  if (nextTime == null || nextTime === '') return false;
  if (prevTime == null || prevTime === '') return true;
  if (typeof prevTime !== typeof nextTime) return false;
  return compareChartTime(prevTime, nextTime) < 0;
}

/**
 * Uniform bucket sizes (seconds) for slot-fillable intraday intervals.
 * Sub-minute intervals (1s/30s) and daily are intentionally absent —
 * their gaps are expected microstructure, not broken candles.
 */
export const INTERVAL_SLOT_SEC = {
  '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400,
};

/** Max skipped slots to backfill in one go (beyond this = real outage, leave the gap). */
export const MAX_LIVE_FILL_SLOTS = 15;

const IST_OFFSET_SEC = 5.5 * 3600;

/**
 * Intermediate slot times between two published buckets (exclusive).
 * Used to backfill bars skipped during feed stalls so the series stays
 * slot-complete. Returns [] when nothing should be filled:
 * non-numeric times, unknown interval, no skip, oversized skip, or
 * (sameDayOnly) slots spanning IST calendar days (never bridge NSE
 * overnights/weekends — those gaps must stay visible).
 */
export function computeFillSlots(prevTime, nextTime, slotSec, { maxFill = MAX_LIVE_FILL_SLOTS, sameDayOnly = false } = {}) {
  if (typeof prevTime !== 'number' || typeof nextTime !== 'number') return [];
  if (!slotSec || slotSec <= 0 || !isFinite(slotSec)) return [];
  const skipped = Math.round((nextTime - prevTime) / slotSec) - 1;
  if (skipped < 1 || skipped > maxFill) return [];
  if (sameDayOnly) {
    const dayOf = (t) => new Date((t + IST_OFFSET_SEC) * 1000).toISOString().substring(0, 10);
    if (dayOf(prevTime) !== dayOf(nextTime)) return [];
  }
  const out = [];
  for (let k = 1; k <= skipped; k++) out.push(prevTime + slotSec * k);
  return out;
}

/**
 * Start time (epoch seconds) of the live intraday bucket containing `now`, aligned to the
 * NSE session grid: each trading session's first bar begins at 09:15 IST, so live buckets
 * are anchored at 09:15 + k*bucketSize per day (09:15/10:15/… for 1h).
 *
 * @param {string} interval  '1s' | '30s' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h'
 * @param {number} nowMs     timestamp in milliseconds
 * @returns {number} bucket start as an epoch-seconds timestamp
 */
export function getSessionBucketStart(interval, nowMs, isCrypto = false) {
  const bucketSize = ({
    '1s': 1,
    '30s': 30,
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '4h': 14400,
  })[interval] || 60;

  const nowSec = Math.floor(nowMs / 1000);

  if (isCrypto) {
    return Math.floor(nowSec / bucketSize) * bucketSize;
  }

  if (interval === '4h') {
    // 4h sessions: 09:15 and 13:15 IST
    const DAY = 86400;
    const IST_OFFSET = 5.5 * 3600;
    const dayStartSec = Math.floor((nowSec + IST_OFFSET) / DAY) * DAY - IST_OFFSET;
    const morningStart = dayStartSec + (9 * 3600 + 15 * 60); // 09:15 IST
    const afternoonStart = dayStartSec + (13 * 3600 + 15 * 60); // 13:15 IST
    return nowSec >= afternoonStart ? afternoonStart : morningStart;
  }

  const DAY = 86400;
  const IST_OFFSET = 5.5 * 3600; // seconds (UTC + 05:30)
  // Epoch second of 09:15 IST on the current IST day
  const anchor = Math.floor((nowSec + IST_OFFSET) / DAY) * DAY - IST_OFFSET + (9 * 3600 + 15 * 60);
  return anchor + Math.floor((nowSec - anchor) / bucketSize) * bucketSize;
}
