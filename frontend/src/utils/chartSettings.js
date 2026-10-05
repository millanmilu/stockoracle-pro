/**
 * StockOracle Pro — Chart Settings store (TradingView "Chart settings" parity).
 *
 * Single source of truth for every knob exposed in `ChartSettingsModal`.
 * The modal writes here, `ChartCanvas` (and LiveChartView) subscribe — so a
 * setting survives chart-type switches, theme flips and remounts instead of
 * being wiped the moment the chart instance is rebuilt.
 *
 * Contract:
 *   loadChartSettings()            → merged settings object (cached read)
 *   saveChartSettings(next)        → merge + persist + notify subscribers
 *   resetChartSettings()           → defaults + persist + notify
 *   subscribeChartSettings(fn)     → unsubscribe fn (runs fn immediately)
 *   buildChartOptions(s, theme)   → lightweight-charts chart-level patch
 *   buildSeriesOptions(s, type)    → primary series patch
 *   resolvePrecision(s, autoDec)   → 'auto' passthrough or a fixed decimals
 */

import { CrosshairMode, LineStyle } from 'lightweight-charts';
import { getThemeTokens } from './theme.js';
import { PRICE_AXIS_WIDTH } from './chartHelpers.js';

export const CHART_SETTINGS_STORAGE_KEY = 'stockoracle_chart_settings_tv_v1';

export const DEFAULT_CHART_SETTINGS = {
  // ── Symbol / Candles ────────────────────────────────────────────────
  chartType: 'candlestick', // candlestick | hollow | bar | line | area | baseline
  upColor: '#26A69A',
  downColor: '#EF5350',
  borderUpColor: '#26A69A',
  borderDownColor: '#EF5350',
  wickUpColor: '#26A69A',
  wickDownColor: '#EF5350',
  showBorders: true, // candle body borders (hollow candles depend on it)
  showWicks: true,
  lineColor: '#2962FF', // line / area / baseline stroke
  showLastValue: true, // last-price tag on the price axis
  showPriceLine: true, // dashed line from last bar to the axis
  priceLineColor: '#2962FF',
  priceLineStyle: 'dashed', // solid | dotted | dashed

  // ── Appearance & Grid ───────────────────────────────────────────────
  bgMode: 'theme', // 'theme' (follow dark/light) | 'custom'
  bgColor: '#131722',
  showVertGrid: true,
  vertGridColor: null, // null → follow app theme token
  showHorzGrid: true,
  horzGridColor: null, // null → follow app theme token
  crosshairMode: 'normal', // normal | magnet | hidden
  crosshairColor: null, // null → follow app theme token
  crosshairStyle: 'dashed', // solid | dotted | dashed
  showCrosshairLabels: true,
  crosshairLabelBg: null, // null → follow app theme token
  axisTextColor: null, // null → follow app theme token
  axisFontSize: 11,
  showWatermark: false,

  // ── Scales & Precision ──────────────────────────────────────────────
  priceScalePosition: 'right', // right | left
  priceScaleMode: 'normal', // normal | log | percentage
  invertScale: false,
  autoFitPrices: true, // re-fit the price axis after a symbol/timeframe load
  precision: 'auto', // 'auto' | 0…8
  timezone: 'Asia/Kolkata',

  // ── Status Line ─────────────────────────────────────────────────────
  showLegendTitle: true, // symbol + interval + bar time
  showOHLC: true,
  showBarChange: true,
  showVolumeLegend: true,
  showIndicatorLegend: true, // overlay indicator value rows
  showCountdown: true, // countdown-to-bar-close badge

  // ── Trading ─────────────────────────────────────────────────────────
  showTradeButton: false, // on-chart paper trade bar
  showTradeDocket: false, // bottom trading panel (positions / account)
  showPositionLines: true, // entry / SL / target lines for the open position
};

const LINE_STYLE_MAP = {
  solid: LineStyle.Solid,
  dotted: LineStyle.Dotted,
  dashed: LineStyle.Dashed,
};

const CROSSHAIR_MODE_MAP = {
  normal: CrosshairMode.Normal,
  magnet: CrosshairMode.Magnet,
  hidden: CrosshairMode.Hidden,
};

let cached = null;
let pendingNotify = null;
const listeners = new Set();

/** Read + merge persisted settings (cached after the first hit). */
export function loadChartSettings() {
  if (cached) return { ...cached };
  let saved = null;
  try {
    const raw = localStorage.getItem(CHART_SETTINGS_STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    saved = null;
  }
  cached = { ...DEFAULT_CHART_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
  return { ...cached };
}

function notify() {
  if (pendingNotify != null) {
    clearTimeout(pendingNotify);
    pendingNotify = null;
  }
  const snapshot = { ...cached };
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (err) {
      console.warn('chartSettings listener failed:', err);
    }
  });
}

/**
 * Coalesce change notifications: a color <input> fires per pixel dragged, and
 * every listener re-patches a live chart — notifying on a 60ms trailing edge
 * keeps the preview smooth without ever delaying the persisted value.
 */
function scheduleNotify() {
  if (pendingNotify != null) return;
  pendingNotify = setTimeout(() => {
    pendingNotify = null;
    notify();
  }, 60);
}

/**
 * Merge a patch over the current settings, persist and notify.
 * The write + cache update are synchronous; only the broadcast is coalesced.
 */
export function saveChartSettings(patch) {
  if (!patch || typeof patch !== 'object') return loadChartSettings();
  cached = { ...(cached || loadChartSettings()), ...patch };
  try {
    localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify(cached));
  } catch {}
  if (listeners.size) scheduleNotify();
  else notify();
  return { ...cached };
}

/** Back to defaults (persisted + broadcast). */
export function resetChartSettings() {
  cached = { ...DEFAULT_CHART_SETTINGS };
  try {
    localStorage.removeItem(CHART_SETTINGS_STORAGE_KEY);
  } catch {}
  notify();
  return { ...cached };
}

/**
 * Drop the in-memory cache so the next `loadChartSettings()` re-reads storage.
 * Cross-tab `storage` events and unit tests use this; the app itself never
 * needs it because every write goes through save/reset here.
 */
export function invalidateChartSettingsCache() {
  cached = null;
}

/**
 * Subscribe to settings changes. Fires `fn` immediately with the current
 * value so a freshly mounted chart paints with saved settings on frame one.
 * Returns the unsubscribe function.
 */
export function subscribeChartSettings(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  try {
    fn(loadChartSettings());
  } catch {}
  return () => listeners.delete(fn);
}

/** '#rrggbb' → 'rgba(r,g,b,a)' (non-hex input is passed through untouched). */
export function hexToRgba(hex, alpha = 1) {
  if (typeof hex !== 'string') return hex;
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Axis/crosshair/legend decimals: honour an explicit user precision,
 * otherwise fall back to the magnitude-aware auto value from ChartCanvas.
 */
export function resolvePrecision(settings, autoDecimals) {
  const p = settings ? settings.precision : 'auto';
  if (p === 'auto' || p == null || p === '') return autoDecimals;
  const n = Number(p);
  if (!Number.isFinite(n)) return autoDecimals;
  return Math.max(0, Math.min(8, Math.round(n)));
}

/** Chart-level lightweight-charts patch derived from settings + app theme. */
export function buildChartOptions(settings, theme) {
  const s = { ...DEFAULT_CHART_SETTINGS, ...(settings || {}) };
  const tk = getThemeTokens(theme);
  const bg = s.bgMode === 'custom' ? s.bgColor : 'transparent';
  const style = LINE_STYLE_MAP[s.crosshairStyle] ?? LineStyle.Dashed;
  const mode = CROSSHAIR_MODE_MAP[s.crosshairMode] ?? CrosshairMode.Normal;
  const axisColor = s.axisTextColor || tk.chartText;
  const showLabels = !!s.showCrosshairLabels;

  return {
    layout: {
      background: { type: 'solid', color: bg },
      textColor: axisColor,
      fontSize: Number(s.axisFontSize) || 11,
    },
    grid: {
      vertLines: { visible: !!s.showVertGrid, color: s.vertGridColor || tk.gridVert },
      horzLines: { visible: !!s.showHorzGrid, color: s.horzGridColor || tk.gridHorz },
    },
    crosshair: {
      mode,
      vertLine: {
        color: s.crosshairColor || tk.crosshair,
        style,
        labelVisible: showLabels,
        labelBackgroundColor: s.crosshairLabelBg || tk.crosshairLabelBg,
      },
      horzLine: {
        color: s.crosshairColor || tk.crosshair,
        style,
        labelVisible: showLabels,
        labelBackgroundColor: s.crosshairLabelBg || tk.crosshairLabelBg,
      },
    },
    rightPriceScale: {
      visible: s.priceScalePosition !== 'left',
      borderColor: tk.priceBorder,
      textColor: axisColor,
    },
    leftPriceScale: {
      visible: s.priceScalePosition === 'left',
      borderColor: tk.priceBorder,
      textColor: axisColor,
      minimumWidth: PRICE_AXIS_WIDTH,
      alignLabels: true,
      scaleMargins: { top: 0.08, bottom: 0.16 },
    },
    timeScale: { textColor: axisColor },
  };
}

/**
 * Move every listed series onto the active price-scale side and toggle the
 * scales. lightweight-charts relocates a series when `priceScaleId` changes
 * through applyOptions, so this works on already-created series — without it
 * "Scale Axis Position: Left" would draw an empty axis (all series stay on
 * the hidden right scale).
 */
export function applyScalePlacement(chart, settings, seriesList) {
  if (!chart || chart.__isDisposed) return;
  const s = { ...DEFAULT_CHART_SETTINGS, ...(settings || {}) };
  const left = s.priceScalePosition === 'left';
  try {
    chart.applyOptions({
      rightPriceScale: { visible: !left },
      leftPriceScale: { visible: left },
    });
  } catch {}
  const flat = [];
  const push = (v) => {
    if (Array.isArray(v)) v.forEach(push);
    else if (v && !v.__isDisposed) flat.push(v);
  };
  (seriesList || []).forEach(push);
  flat.forEach((series) => {
    try { series.applyOptions({ priceScaleId: left ? 'left' : 'right' }); } catch {}
  });
}

/**
 * Mirror the main chart's settings onto a stacked sub-pane chart (volume /
 * oscillators) so scale placement, grid, crosshair and axis text can never
 * disagree between the price plot and its panes.
 */
export function applyPaneChartOptions(chart, settings, theme, seriesList) {
  if (!chart || chart.__isDisposed) return;
  const s = { ...DEFAULT_CHART_SETTINGS, ...(settings || {}) };
  const tk = getThemeTokens(theme);
  const style = LINE_STYLE_MAP[s.crosshairStyle] ?? LineStyle.Dashed;
  const mode = CROSSHAIR_MODE_MAP[s.crosshairMode] ?? CrosshairMode.Normal;
  const axisColor = s.axisTextColor || tk.chartText;
  try {
    chart.applyOptions({
      layout: { textColor: axisColor, fontSize: Number(s.axisFontSize) || 11 },
      grid: {
        vertLines: { visible: !!s.showVertGrid, color: s.vertGridColor || tk.gridVert },
        horzLines: { visible: !!s.showHorzGrid, color: s.horzGridColor || tk.gridHorz },
      },
      crosshair: {
        mode,
        vertLine: { color: s.crosshairColor || tk.crosshair, style, labelVisible: !!s.showCrosshairLabels, labelBackgroundColor: s.crosshairLabelBg || tk.crosshairLabelBg },
        horzLine: { color: s.crosshairColor || tk.crosshair, style, labelVisible: !!s.showCrosshairLabels, labelBackgroundColor: s.crosshairLabelBg || tk.crosshairLabelBg },
      },
      rightPriceScale: { borderColor: tk.priceBorder, textColor: axisColor },
      leftPriceScale: {
        borderColor: tk.priceBorder,
        textColor: axisColor,
        minimumWidth: PRICE_AXIS_WIDTH,
        autoScale: true,
      },
    });
  } catch {}
  applyScalePlacement(chart, s, seriesList);
}

/** Primary-series patch (colors / visibility / last-value / price line). */
export function buildSeriesOptions(settings, chartType) {
  const s = { ...DEFAULT_CHART_SETTINGS, ...(settings || {}) };
  const type = chartType || s.chartType || 'candlestick';
  const style = LINE_STYLE_MAP[s.priceLineStyle] ?? LineStyle.Dashed;
  const shared = {
    lastValueVisible: !!s.showLastValue,
    priceLineVisible: !!s.showPriceLine,
    priceLineColor: s.priceLineColor,
    priceLineStyle: style,
  };

  if (type === 'line') {
    return { ...shared, color: s.lineColor };
  }
  if (type === 'area') {
    return {
      ...shared,
      lineColor: s.lineColor,
      topColor: hexToRgba(s.lineColor, 0.28),
      bottomColor: hexToRgba(s.lineColor, 0.01),
    };
  }
  if (type === 'baseline') {
    return {
      ...shared,
      topLineColor: s.upColor,
      topFillColor1: hexToRgba(s.upColor, 0.28),
      topFillColor2: hexToRgba(s.upColor, 0.05),
      bottomLineColor: s.downColor,
      bottomFillColor1: hexToRgba(s.downColor, 0.05),
      bottomFillColor2: hexToRgba(s.downColor, 0.28),
    };
  }
  if (type === 'bar') {
    return {
      ...shared,
      upColor: s.upColor,
      downColor: s.downColor,
    };
  }
  // candlestick + hollow (hollow: up body transparent, border/wick carry the color)
  const hollow = type === 'hollow';
  return {
    ...shared,
    upColor: hollow ? 'transparent' : s.upColor,
    downColor: s.downColor,
    borderVisible: !!s.showBorders,
    borderUpColor: s.borderUpColor,
    borderDownColor: s.borderDownColor,
    wickVisible: !!s.showWicks,
    wickUpColor: s.wickUpColor,
    wickDownColor: s.wickDownColor,
  };
}
