/**
 * StockOracle Pro — TradingView-parity Drawing Settings Schema
 *
 * Single source of truth for the per-object settings dialog (Style / Text /
 * Coordinates / Visibility). Every drawing tool in `drawingToolCatalog.js`
 * resolves through `getDrawingCaps(toolId)` so ALL tools get a real settings
 * panel — not just trendlines.
 *
 * Drawing objects are plain JSON persisted to localStorage, so every new key
 * below is backward compatible (older drawings use `?? default` fallbacks in
 * the renderers).
 */

import { getToolSpec } from './drawingToolCatalog';

export const VISIBILITY_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1W', '1M'];

export const COLOR_PRESETS = [
  '#38BDF8', '#10B981', '#F59E0B', '#EF5350',
  '#A855F7', '#EC4899', '#FFFFFF', '#64748B',
];

export const LINE_WIDTHS = [1, 2, 3, 4, 5];
export const LINE_STYLES = ['solid', 'dashed', 'dotted'];

/** Fib retracement levels toggleable in Style (TradingView parity). */
export const FIB_TOGGLES = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

const BASE = {
  line: true,
  background: false,
  border: false,
  text: false,
  fontSize: false,
  extend: false,
  coords: 2, // 0 | 1 | 2 anchor points editable
  visibility: true,
  midLine: false,
  stats: false,
  fibLevels: false,
  showPrices: false,
};

/**
 * Per-tool capability overrides. Anything not listed falls back to group
 * defaults derived from the catalog `group`, so newly added tools never end
 * up without a settings panel.
 */
const CAP_OVERRIDES = {
  // Lines
  trendline: { line: true, extend: true, coords: 2 },
  ray: { line: true, extend: true, coords: 2 },
  extended_line: { line: true, extend: true, coords: 2 },
  info_line: { line: true, extend: true, coords: 2 },
  trend_angle: { line: true, extend: true, coords: 2 },
  horizontal_line: { line: true, coords: 1, showPrices: true },
  horizontal_ray: { line: true, coords: 1, showPrices: true },
  vertical_line: { line: true, coords: 1 },
  cross_line: { line: true, coords: 1 },
  arrow: { line: true, coords: 2 },
  // Channels
  parallel_channel: { line: true, background: true, border: true, extend: true, coords: 2 },
  regression_trend: { line: true, background: true, coords: 2, showPrices: true },
  flat_top_bottom: { line: true, background: true, border: true, coords: 2 },
  disjoint_channel: { line: true, background: true, border: true, coords: 4 },
  // Fibonacci
  fibonacci: { line: true, fibLevels: true, showPrices: true, background: true, extend: true, coords: 2 },
  fib_extension: { line: true, fibLevels: true, showPrices: true, coords: 3 },
  fib_channel: { line: true, fibLevels: true, coords: 3 },
  fib_fan: { line: true, fibLevels: true, showPrices: true, coords: 2 },
  fib_timezone: { line: true, fibLevels: true, coords: 1 },
  fib_circle: { line: true, fibLevels: true, coords: 2 },
  // Gann
  gann_fan: { line: true, coords: 2 },
  gann_box: { line: true, background: true, border: true, coords: 2 },
  // Pitchforks
  pitchfork: { line: true, background: true, coords: 3 },
  schiff_pitchfork: { line: true, background: true, coords: 3 },
  inside_pitchfork: { line: true, background: true, coords: 3 },
  // Shapes
  brush: { line: true, coords: 0 },
  highlighter: { line: true, coords: 0 },
  rectangle: { background: true, border: true, coords: 2, text: true, fontSize: true },
  rotated_rectangle: { background: true, border: true, coords: 3 },
  ellipse: { background: true, border: true, coords: 2 },
  circle: { background: true, border: true, coords: 2 },
  triangle: { background: true, border: true, coords: 2 },
  arc: { line: true, coords: 2 },
  polyline: { line: true, coords: 0 },
  // Annotations — every one gets Text + Coordinates + Visibility like TV
  text: { text: true, fontSize: true, line: true, coords: 1 },
  callout: { text: true, fontSize: true, line: true, background: true, border: true, coords: 2 },
  note: { text: true, fontSize: true, line: true, background: true, border: true, coords: 1 },
  price_label: { text: true, fontSize: true, line: true, coords: 1, showPrices: true },
  price_note: { text: true, fontSize: true, line: true, coords: 2, showPrices: true },
  flag: { text: true, fontSize: true, line: true, coords: 1 },
  pin: { text: true, fontSize: true, line: true, coords: 1 },
  smile: { coords: 1 },
  sticker: { coords: 1 },
  // Patterns
  xabcd: { line: true, showPrices: true, coords: 5, text: true },
  cypher: { line: true, showPrices: true, coords: 5, text: true },
  head_shoulders: { line: true, coords: 5 },
  abcd: { line: true, showPrices: true, coords: 4, text: true },
  triangle_pattern: { line: true, coords: 3 },
  three_drives: { line: true, coords: 5 },
  elliott_impulse: { line: true, coords: 6, text: true },
  elliott_correction: { line: true, coords: 4, text: true },
  // Prediction & measurement — full TradingView parity
  long_position: { background: true, border: true, text: true, coords: 2, stats: true },
  short_position: { background: true, border: true, text: true, coords: 2, stats: true },
  forecast: { line: true, showPrices: true, coords: 3 },
  projection: { line: true, showPrices: true, coords: 3 },
  bars_pattern: { background: true, border: true, coords: 2, stats: true },
  date_range: { line: true, background: true, border: true, coords: 2, stats: true, midLine: true },
  price_range: { line: true, background: true, border: true, coords: 2, stats: true, midLine: true, showPrices: true },
  date_price_range: { line: true, background: true, border: true, coords: 2, stats: true, midLine: true, showPrices: true },
  ruler: { line: true, background: true, border: true, coords: 2, stats: true, midLine: true, showPrices: true },
};

const GROUP_FALLBACK = {
  lines: { line: true, extend: true, coords: 2 },
  channels: { line: true, background: true, border: true, coords: 2 },
  fibonacci: { line: true, fibLevels: true, showPrices: true, coords: 2 },
  gann: { line: true, coords: 2 },
  pitchforks: { line: true, coords: 3 },
  shapes: { line: true, background: true, border: true, coords: 2 },
  annotations: { text: true, fontSize: true, line: true, coords: 1 },
  icons: { coords: 1 },
  patterns: { line: true, coords: 3 },
  trading: { line: true, background: true, border: true, coords: 2, stats: true },
};

export function getDrawingCaps(toolId) {
  if (CAP_OVERRIDES[toolId]) return { ...BASE, ...CAP_OVERRIDES[toolId] };
  try {
    const spec = getToolSpec(toolId);
    if (spec?.group && GROUP_FALLBACK[spec.group]) {
      const pts = spec.points;
      const coords = pts === 1 ? 1 : pts === 2 ? 2 : typeof pts === 'number' && pts >= 3 ? pts : 2;
      return { ...BASE, ...GROUP_FALLBACK[spec.group], coords };
    }
  } catch {}
  return { ...BASE };
}

/** Defaults applied to a drawing object for every new settings key. */
export function drawingDefaults(type) {
  return {
    color: '#38BDF8',
    strokeWidth: 2,
    lineStyle: 'solid',
    // Fill / border (shapes, channels, ranges)
    backgroundVisible: true,
    backgroundColor: null, // null = derive from line color via tint()
    backgroundOpacity: 0.12,
    borderVisible: true,
    borderColor: null, // null = line color
    borderWidth: null, // null = strokeWidth
    borderStyle: null, // null = lineStyle
    // Lines
    extendLeft: ['extended_line'].includes(type) ? true : false,
    extendRight: ['ray', 'extended_line'].includes(type) ? true : false,
    // Text
    text: '',
    fontSize: 12,
    fontBold: true,
    // Fib
    fibLevelsVisible: [...FIB_TOGGLES],
    showPrices: true,
    // Ranges / ruler
    showMidLine: true,
    showStatsBars: true,
    showStatsTime: true,
    showStatsPrice: true,
    showStatsPercent: true,
    // Coordinates visibility handled via visibleIntervals
    visibleIntervals: null, // null = all timeframes (TradingView default)
    locked: false,
  };
}

/** Merge stored drawing with defaults (backward compatible). */
export function withDrawingDefaults(drawing) {
  if (!drawing) return drawing;
  const defs = drawingDefaults(drawing.type);
  const out = { ...defs, ...drawing };
  // Explicit nulls for derived colors stay null (renderer tints from color)
  return out;
}

/**
 * Visibility check — TradingView "Visibility" tab. `visibleIntervals == null`
 * (or empty) means visible on every timeframe.
 */
export function isDrawingVisibleOn(drawing, interval) {
  const vis = drawing?.visibleIntervals;
  if (!vis || !Array.isArray(vis) || vis.length === 0) return true;
  // Normalize: '1D' vs '1d', '1W' vs '1w'
  const norm = (v) => String(v || '').toLowerCase();
  return vis.map(norm).includes(norm(interval));
}
