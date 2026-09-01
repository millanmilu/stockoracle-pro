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
  const normalized = String(dateStr).replace(' ', 'T');
  if (!isIntraday) return normalized.substring(0, 10);
  const ms = new Date(normalized).getTime();
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
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '1D', value: '1d' },
];

export const SIG = {
  buy:  { label: '\u25B2 BUY',  color: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.28)' },
  sell: { label: '\u25BC SELL', color: '#EF5350', bg: 'rgba(239,83,80,0.10)',  border: 'rgba(239,83,80,0.28)' },
  hold: { label: '\u25C6 HOLD', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
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
    mode: 0,
    vertLine: { color: 'rgba(129,140,248,0.4)', width: 1, style: 2, labelBackgroundColor: '#1e1060' },
    horzLine: { color: 'rgba(129,140,248,0.4)', width: 1, style: 2, labelBackgroundColor: '#1e1060' },
  },
  rightPriceScale: {
    borderColor: 'rgba(99,102,241,0.12)',
    textColor: '#6B7280',
    scaleMargins: { top: 0.08, bottom: 0.16 },
    autoScale: true,
    alignLabels: true,
  },
  timeScale: {
    borderColor: 'rgba(99,102,241,0.12)',
    textColor: '#6B7280',
    timeVisible: true,
    secondsVisible: false,
    shiftVisibleRangeOnNewBar: true,
    rightOffset: 12,
    barSpacing: 8,
    minBarSpacing: 0.5,
    allowBoldLabels: true,
  },
  handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
  handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
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
