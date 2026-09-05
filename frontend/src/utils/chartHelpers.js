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

export function toChartTime(dateStr, isIntraday) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (!isIntraday) return str.substring(0, 10);

  // If already a numeric unix timestamp (seconds or milliseconds)
  if (typeof dateStr === 'number') {
    return dateStr > 1000000000000 ? Math.floor(dateStr / 1000) : Math.floor(dateStr);
  }

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
  const d = new Date(dateStr);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().split('T')[0];
}

export const POPULAR_STOCKS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'WIPRO', 'NIFTY50', 'BANKNIFTY'];

export const INTERVALS = [
  { label: '1s (1 sec)', value: '1s' },
  { label: '30s (30 sec)', value: '30s' },
  { label: '1m (1 min)', value: '1m' },
  { label: '5m (5 min)', value: '5m' },
  { label: '15m (15 min)', value: '15m' },
  { label: '30m (30 min)', value: '30m' },
  { label: '1H (1 hour)', value: '1h' },
  { label: '4H (4 hour)', value: '4h' },
  { label: '1D (Daily)', value: '1d' },
];

export const SIG = {
  buy:  { label: '▲ BUY',  color: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.28)' },
  sell: { label: '▼ SELL', color: '#EF5350', bg: 'rgba(239,83,80,0.10)',  border: 'rgba(239,83,80,0.28)' },
  hold: { label: '◆ HOLD', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
};

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
    minimumWidth: 72, // Strict pixel alignment across main chart and stacked panes
  },
  timeScale: {
    borderColor: 'rgba(99,102,241,0.12)',
    textColor: '#6B7280',
    timeVisible: false,
    secondsVisible: false,
    shiftVisibleRangeOnNewBar: false,
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
  wickUpColor: '#26A69A',
  wickDownColor: '#EF5350',
};

/**
 * Start time (epoch seconds) of the live intraday bucket containing `now`, aligned to the
 * NSE session grid: each trading session's first bar begins at 09:15 IST, so live buckets
 * are anchored at 09:15 + k*bucketSize per day (09:15/10:15/… for 1h).
 *
 * @param {string} interval  '1s' | '30s' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h'
 * @param {number} nowMs     timestamp in milliseconds
 * @returns {number} bucket start as an epoch-seconds timestamp
 */
export function getSessionBucketStart(interval, nowMs) {
  if (interval === '4h') {
    // 4h sessions: 09:15 and 13:15 IST
    const DAY = 86400;
    const IST_OFFSET = 5.5 * 3600;
    const nowSec = Math.floor(nowMs / 1000);
    const dayStartSec = Math.floor((nowSec + IST_OFFSET) / DAY) * DAY - IST_OFFSET;
    const morningStart = dayStartSec + (9 * 3600 + 15 * 60); // 09:15 IST
    const afternoonStart = dayStartSec + (13 * 3600 + 15 * 60); // 13:15 IST
    return nowSec >= afternoonStart ? afternoonStart : morningStart;
  }

  const bucketSize = ({
    '1s': 1,
    '30s': 30,
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
  })[interval] || 300;

  const DAY = 86400;
  const IST_OFFSET = 5.5 * 3600; // seconds (UTC + 05:30)
  const nowSec = Math.floor(nowMs / 1000);
  // Epoch second of 09:15 IST on the current IST day
  const anchor = Math.floor((nowSec + IST_OFFSET) / DAY) * DAY - IST_OFFSET + (9 * 3600 + 15 * 60);
  return anchor + Math.floor((nowSec - anchor) / bucketSize) * bucketSize;
}
