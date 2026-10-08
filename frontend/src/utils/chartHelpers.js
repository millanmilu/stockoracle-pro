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
      // Daily buckets are IST (backend invariant §1) — never UTC.
      // getIstDateString is the single source (hoisted, defined below).
      return getIstDateString(ms);
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

// NIFTY50 removed: not in stock_universe (no token/company_info/daily rows),
// so it could never tick and only added backend load + log noise.
// BANKNIFTY kept (universe member) even without price rows yet.
// Cap kept at 50 in useWebSocket.sendSubscription (backend invariant §4).
export const POPULAR_STOCKS = ['BTC', 'XAUUSD', 'GOLD', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'WIPRO', 'BANKNIFTY'];

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

/**
 * TradingView-style number-key timeframe quick switch.
 * Digits accumulate ("1" → 1m, "15" → 15m); a trailing h/d picks the unit
 * ("1h" → 1h, "4h" → 4h, "d" → 1d); "60"/"240" are minute aliases for 1h/4h.
 * Returns the timeframe value or null when the buffer matches nothing.
 * Only covers toolbar timeframes (1s/30s stay dropdown-only by design).
 */
const TF_QUICK_SWITCH = [
  { value: '1m', num: '1', unit: 'm' },
  { value: '5m', num: '5', unit: 'm' },
  { value: '15m', num: '15', unit: 'm' },
  { value: '30m', num: '30', unit: 'm' },
  { value: '1h', num: '1', unit: 'h' },
  { value: '4h', num: '4', unit: 'h' },
  { value: '1d', num: '1', unit: 'd' },
];

export function resolveTimeframeBuffer(buf) {
  const raw = String(buf || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'h') return '1h';
  if (raw === 'd') return '1d';
  const m = raw.match(/^(\d{1,3})([hmd])?$/);
  if (!m) return null;
  const [, num, suf] = m;
  if (!suf && num === '60') return '1h';
  if (!suf && num === '240') return '4h';
  const opts = TF_QUICK_SWITCH.filter((o) => o.num === num);
  if (!opts.length) return null;
  if (!suf || suf === 'm') return (opts.find((o) => o.unit === 'm') || opts[0]).value;
  const hit = opts.find((o) => o.unit === suf);
  if (hit) return hit.value;
  if (suf === 'd') return '1d';
  if (suf === 'h') return (TF_QUICK_SWITCH.find((o) => o.unit === 'h') || {}).value || null;
  return null;
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
export const PRICE_AXIS_WIDTH = 60;

export const CHART_OPTIONS = {
  layout: {
    background: { type: 'solid', color: 'transparent' },
    textColor: '#787B86',
    fontFamily: "'Trebuchet MS', Roboto, Ubuntu, sans-serif",
    fontSize: 11,
  },
  grid: {
    vertLines: { color: '#1E222D' },
    horzLines: { color: '#1E222D' },
  },
  crosshair: {
    mode: 0, // CrosshairMode.Normal
    vertLine: { color: '#787B86', width: 1, style: 2, labelBackgroundColor: '#363C4E' },
    horzLine: { color: '#787B86', width: 1, style: 2, labelBackgroundColor: '#363C4E' },
  },
  rightPriceScale: {
    borderColor: '#2A2E39',
    textColor: '#787B86',
    scaleMargins: { top: 0.08, bottom: 0.16 },
    autoScale: true,
    alignLabels: true,
    minimumWidth: PRICE_AXIS_WIDTH, // Strict pixel alignment across main chart and stacked panes
  },
  timeScale: {
    borderColor: '#2A2E39',
    textColor: '#787B86',
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
 * Lightweight Charts only accepts finite epoch seconds or valid BusinessDay
 * values. A malformed date string can survive ordinary sorting and later make
 * the renderer look up a missing plot row, surfacing as `Value is null` during
 * candlestick paint.
 */
export function isValidChartTime(time) {
  if (typeof time === 'number') return Number.isFinite(time) && time >= 0;
  let year;
  let month;
  let day;
  if (typeof time === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(time);
    if (!match) return false;
    [, year, month, day] = match.map(Number);
  } else if (time && typeof time === 'object') {
    year = Number(time.year);
    month = Number(time.month);
    day = Number(time.day);
  } else {
    return false;
  }
  if (![year, month, day].every(Number.isInteger) || year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year
    && check.getUTCMonth() === month - 1
    && check.getUTCDate() === day;
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
  const valid = points.filter((p) => p && isValidChartTime(p.time));
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

/**
 * History-frame freshness contract (stale-tail auto-recovery).
 *
 * The backend tags every /history frame (`data_source`): live-vendor frames
 * ('binance_crypto', 'angel_one') prove freshness; fallback frames ('sqlite',
 * 'sqlite_stale', 'memory_cache', 'crypto_seed', anything unknown) may carry
 * a truncated tail — e.g. a chart load racing backend warmup while live ticks
 * keep building the current bucket (the visible "candle gap" that survives
 * until a manual refresh). Pure helper so the guard is unit-testable.
 */
export const FRESH_TAIL_SOURCES = new Set(['binance_crypto', 'angel_one']);

export const STALE_TAIL_MAX_ATTEMPTS = 3;
export const STALE_TAIL_RETRY_MS = 60000;

export function shouldRefetchStaleTail({ tailTime, source, slotSec, nowMs, attempts = 0, lastTryMs = 0 }) {
  if (tailTime == null || source == null) return false;
  if (FRESH_TAIL_SOURCES.has(String(source))) return false; // vendor proved freshness
  if (Number(attempts) >= STALE_TAIL_MAX_ATTEMPTS) return false;
  const now = Number(nowMs);
  if (!Number.isFinite(now)) return false;
  if (Number(lastTryMs) > 0 && now - Number(lastTryMs) < STALE_TAIL_RETRY_MS) return false;
  let tailMs;
  if (typeof tailTime === 'number' && Number.isFinite(tailTime)) {
    tailMs = tailTime * 1000; // intraday chart times are epoch seconds
  } else {
    // Daily tails are IST calendar dates — the bar covers its whole day.
    const parsed = Date.parse(`${String(tailTime).slice(0, 10)}T00:00:00+05:30`);
    if (!Number.isFinite(parsed)) return false;
    tailMs = parsed + 86400000;
  }
  const slot = Number(slotSec) > 0 ? Number(slotSec) : 300;
  const thresholdMs = Math.min(Math.max(slot * 3, 120), 86400) * 1000;
  return now - tailMs > thresholdMs;
}

const IST_OFFSET_SEC = 5.5 * 3600;

/**
 * IST calendar date (YYYY-MM-DD) for a wall-clock timestamp.
 * Single source of truth for daily buckets — crypto AND equity both use IST
 * (AGENTS.md §5 + backend fetcher astimezone(_IST)). Never use
 * `new Date(ms).toISOString().slice(0,10)` (UTC) for daily buckets: between
 * 00:00–05:30 IST the UTC date is yesterday and live ticks would overwrite
 * the previous day's finalized candle instead of opening a new bar.
 */
export function getIstDateString(nowMs) {
  const ms = Number(nowMs);
  if (!isFinite(ms)) return null;
  return new Date(ms + 5.5 * 3600 * 1000).toISOString().substring(0, 10);
}

/**
 * Bounded initial-history lookback per interval so default load stays small.
 * Backend `days_map` already serves these timeframes; 'ALL' (7k+ daily rows,
 * ~10MB / 71 cols) is only for explicit deep-history requests.
 *  - 1d       → 2Y   (~500 daily bars, full indicator warmup)
 *  - 1m/5m    → 5D   (intraday capacity, no SQLite bloat)
 *  - 15m/30m  → 1M
 *  - 1h/4h    → 6M
 *  - 1s/30s   → 5D   (microstructure, never backfilled)
 */
export function getBoundedTimeframe(interval) {
  const iv = String(interval || '').toLowerCase();
  if (iv === '1d') return '2Y';
  if (iv === '1m' || iv === '5m' || iv === '1s' || iv === '30s') return '5D';
  if (iv === '15m' || iv === '30m') return '1M';
  if (iv === '1h' || iv === '4h') return '6M';
  return '6M';
}

/** Viewportapse left edge ke itne bars ke andar aaye to older-data backfill trigger hota hai. */
export const BACKFILL_TRIGGER_BARS = 30;

/**
 * Timeframe-aware cursor chunk sizes: candles fetched per older-history
 * request (`?before=<oldest>&limit=<n>`). Kabhi ek universal count nahi —
 * microstructure chhota, intraday hazaaron me, daily saal-bhar. Backend
 * `CURSOR_CHUNK_LIMITS` (fetcher.py) ka mirror — dono ek saath badlo.
 */
export const BACKFILL_CHUNK_LIMIT = {
  '1s': 300, '30s': 500,
  '1m': 3000, '5m': 3000, '15m': 2000, '30m': 2000,
  '1h': 2000, '4h': 1500, '1d': 1000,
};
export const BACKFILL_MIN_LIMIT = 50;
export const BACKFILL_MAX_LIMIT = 5000;

/** Resolve per-request candle count for older-history loads (clamped). */
export function getBackfillChunkLimit(interval, requested = null) {
  const iv = String(interval || '').toLowerCase();
  const def = BACKFILL_CHUNK_LIMIT[iv] ?? 2000;
  if (requested == null) return def;
  const n = Number(requested);
  if (!Number.isFinite(n)) return def;
  return Math.max(BACKFILL_MIN_LIMIT, Math.min(BACKFILL_MAX_LIMIT, Math.floor(n)));
}

/**
 * Progressive history depth per interval (left-pan infinite scroll).
 * Index 0 === getBoundedTimeframe() (default fast load); panning left deepens
 * one level at a time (2Y → 5Y → ALL). Levels stop where the backend stops
 * serving deeper windows — exhaustion is detected when a deeper fetch adds no
 * older bars (a remount with deep-cached data may cost one redundant fetch
 * before self-marking exhausted).
 */
export const BACKFILL_LEVELS = {
  '1d': ['2Y', '5Y', 'ALL'],
  '1m': ['5D', '1M'], '5m': ['5D', '1M'], '1s': ['5D', '1M'], '30s': ['5D', '1M'],
  '15m': ['1M', '3M'], '30m': ['1M', '3M'],
  '1h': ['6M', '1Y'], '4h': ['6M', '1Y'],
};

/**
 * Next deeper timeframe after `level` (0-based index into BACKFILL_LEVELS),
 * or null when fully deep / unknown interval.
 */
export function nextBackfillTimeframe(interval, level) {
  const levels = BACKFILL_LEVELS[String(interval || '').toLowerCase()] || BACKFILL_LEVELS['1h'];
  const next = Number(level) + 1;
  return next < levels.length ? levels[next] : null;
}

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
  const bucketStart = anchor + Math.floor((nowSec - anchor) / bucketSize) * bucketSize;

  return bucketStart;
}

/**
 * May a live equity/crypto tick mutate or spawn a chart candle?
 *
 * The clock window alone (09:15–15:30 IST) can't see NSE holidays — Gandhi
 * Jayanti etc. fall INSIDE those hours on a normal weekday — and the backend
 * broadcaster keeps sending verified EOD fallbacks flagged `is_live:false`
 * during holidays/broker outages. An explicit `is_live:false` therefore
 * VETOES the clock gate so no fake candles are painted (AGENTS.md §4: no
 * fake rates; weekend/holiday ticks must never mint candles).
 *
 * @param {Object}  p
 * @param {boolean} p.isCrypto     24/7 market → always allowed
 * @param {boolean} p.isMarketHours client clock says 09:15–15:30 IST (weekday)
 * @param {boolean|undefined} p.isLive backend's is_market_open() verdict
 * @returns {boolean}
 */
export function canUpdateLiveCandle({ isCrypto = false, isMarketHours = false, isLive = undefined } = {}) {
  if (isCrypto) return true;
  if (isLive === true) return true;
  if (isLive === false) return false; // holiday/outage fallback — clock is irrelevant
  return !!isMarketHours; // payload without the flag → legacy clock behavior
}

/**
 * CSS `right` offset (px) that docks the candle-countdown badge into the slim
 * RIGHT price-axis strip, centred inside PRICE_AXIS_WIDTH.
 *
 * Pitfall this guards: a CSS `right` value is measured from the container's
 * RIGHT edge, so it must be a small number (≈4). Computing `paneWidth - 56`
 * instead — a LEFT-style offset — flung the badge to the far LEFT of the
 * chart (its right edge landed 56px from the left edge).
 *
 * @param {number} paneWidth  chart container width in px (incl. price axis)
 * @param {number} badgeWidth countdown badge width in px (default 52)
 * @returns {number} right offset in px, clamped so the badge stays inside
 */
export function countdownDockRight(paneWidth, badgeWidth = 52) {
  const pane = Number(paneWidth);
  if (!Number.isFinite(pane) || pane <= 0) return 4;
  // Centre the badge within the 60px axis strip → (60 - 52) / 2 = 4, and
  // never let it overflow the container's left edge on tiny panes.
  const centred = Math.max(0, (PRICE_AXIS_WIDTH - badgeWidth) / 2);
  return Math.max(0, Math.min(centred, pane - badgeWidth));
}
