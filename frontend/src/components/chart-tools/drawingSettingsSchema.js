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

import { getToolSpec } from './drawingToolCatalog.js';
import { getToolFactoryDefault } from './drawingToolDefaults.js';
import { SUPPORTED_INTERVALS } from '../../utils/chartHelpers.js';
import { getThemeTokens } from '../../utils/theme.js';

export const VISIBILITY_INTERVALS = [...SUPPORTED_INTERVALS, '1W', '1M'];
export const DRAWING_SETTINGS_STORAGE_KEY = 'stockoracle_drawing_settings_tv_v1';

export const COLOR_PRESETS = [
  '#2962FF', '#10B981', '#F59E0B', '#EF5350',
  '#A855F7', '#EC4899', '#FFFFFF', '#787B86',
];

export const LINE_WIDTHS = [1, 2, 3, 4, 5];
export const LINE_STYLES = ['solid', 'dashed', 'dotted', 'dash_dot', 'long_dash'];

/** Line-style metadata shared by the toolbar, settings modal and previews. */
export const LINE_STYLE_META = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'dash_dot', label: 'Dash-Dot' },
  { id: 'long_dash', label: 'Long Dash' },
];

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
  volumeProfile: false,
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
  fixed_range_volume_profile: { line: false, background: true, border: true, coords: 2, stats: true, volumeProfile: true, showPrices: true },
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

export const DRAWING_THEME_DEFAULTS = {
  lineColor: '#2962FF',
  fillColor: '#2962FF',
  selectionColor: '#2962FF',
  hoverColor: '#787B86',
  textColor: '#D1D4DC',
  labelBackground: '#1E222D',
  labelText: '#D1D4DC',
  defaultLineWidth: 2,
  defaultLineStyle: 'solid',
  defaultFillOpacity: 0.15,
  selectedOpacity: 1,
  lockedOpacity: 0.7,
  controlPointSize: 5,
  controlPointColor: '#FFFFFF',
};

function readStoredSettings() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const value = JSON.parse(localStorage.getItem(DRAWING_SETTINGS_STORAGE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function loadDrawingSettings() {
  const stored = readStoredSettings();
  return {
    theme: { ...DRAWING_THEME_DEFAULTS, ...(stored.theme || {}) },
    toolDefaults: stored.toolDefaults && typeof stored.toolDefaults === 'object' ? stored.toolDefaults : {},
    recentColors: Array.isArray(stored.recentColors) ? stored.recentColors.slice(0, 12) : [],
    savedColors: Array.isArray(stored.savedColors) ? stored.savedColors.slice(0, 24) : [],
  };
}

export function applyDrawingThemeTokens(theme = 'dark') {
  if (typeof document === 'undefined') return;
  const base = getThemeTokens(theme);
  const drawing = loadDrawingSettings().theme;
  const root = document.documentElement;
  const tokens = {
    '--drawing-toolbar-bg': base.cardBg,
    '--drawing-toolbar-border': base.divider,
    '--drawing-toolbar-text': base.topbarText,
    '--drawing-toolbar-muted': base.topbarMuted,
    '--drawing-toolbar-hover': base.hoverBg,
    '--drawing-toolbar-active': base.toolbarActive,
    '--drawing-settings-bg': base.cardBg,
    '--drawing-settings-text': base.topbarText,
    '--drawing-settings-border': base.divider,
    '--drawing-control-bg': base.inputBg,
    '--drawing-control-border': base.inputBorder,
    '--drawing-accent': base.toolbarActive,
    '--drawing-selection-color': drawing.selectionColor,
    '--drawing-hover-color': drawing.hoverColor,
    '--drawing-label-bg': drawing.labelBackground,
    '--drawing-label-text': drawing.labelText,
    '--drawing-control-point-color': drawing.controlPointColor,
    '--drawing-control-point-size': `${drawing.controlPointSize}px`,
  };
  Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(key, value));
}

export function saveDrawingSettings(patch) {
  const current = loadDrawingSettings();
  const next = {
    ...current,
    ...patch,
    theme: { ...current.theme, ...(patch?.theme || {}) },
    toolDefaults: { ...current.toolDefaults, ...(patch?.toolDefaults || {}) },
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(DRAWING_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('Could not persist drawing settings:', error);
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('drawing-settings-changed'));
    if (patch?.theme) window.dispatchEvent(new Event('drawing-theme-changed'));
  }
  return next;
}

export function rememberDrawingColor(color, { save = false } = {}) {
  if (!/^#[0-9a-f]{6}$/i.test(color || '')) return loadDrawingSettings();
  const current = loadDrawingSettings();
  const recentColors = [color.toUpperCase(), ...current.recentColors.filter((item) => item.toUpperCase() !== color.toUpperCase())].slice(0, 12);
  const savedColors = save && !current.savedColors.some((item) => item.toUpperCase() === color.toUpperCase())
    ? [color.toUpperCase(), ...current.savedColors].slice(0, 24)
    : current.savedColors;
  return saveDrawingSettings({ recentColors, savedColors });
}

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
  const stored = readStoredSettings();
  const global = stored.theme || DRAWING_THEME_DEFAULTS;
  const toolDefault = stored.toolDefaults?.[type] || {};
  // Per-tool factory template (fill / extend / font / fib / stats).
  const factory = getToolFactoryDefault(type) || {};
  return {
    color: global.lineColor || '#2962FF',
    strokeWidth: global.defaultLineWidth || 2,
    lineStyle: global.defaultLineStyle || 'solid',
    opacity: 1,
    // Fill / border (shapes, channels, ranges)
    backgroundVisible: true,
    backgroundColor: global.fillColor || null,
    backgroundOpacity: global.defaultFillOpacity ?? 0.15,
    borderVisible: true,
    borderColor: null, // null = line color
    borderOpacity: 1,
    borderWidth: null, // null = strokeWidth
    borderStyle: null, // null = lineStyle
    // Lines
    extendLeft: ['extended_line'].includes(type) ? true : false,
    extendRight: ['ray', 'extended_line'].includes(type) ? true : false,
    // Text
    text: '',
    fontSize: 12,
    fontFamily: 'Trebuchet MS',
    fontBold: true,
    fontItalic: false,
    textAlign: 'left',
    // Fib
    fibLevelsVisible: [...FIB_TOGGLES],
    fibLevelValues: {}, // custom level overrides { 0.236: 0.35 } — TV-style level editing
    showPrices: true,
    // Ranges / ruler
    showMidLine: true,
    showStatsBars: true,
    showStatsTime: true,
    showStatsPrice: true,
    showStatsPercent: true,
    // Volume Profile (FRVP)
    rows: type === 'fixed_range_volume_profile' ? 70 : 24,
    valueAreaPercent: 70,
    profileWidthPercent: 40,
    upColor: '#26A69A',
    downColor: '#EF5350',
    pocColor: '#EA580C',
    vahValColor: '#38BDF8',
    showPoc: true,
    showVahVal: true,
    showProfileSummary: true,
    // Coordinates visibility handled via visibleIntervals
    visibleIntervals: null, // null = all timeframes (TradingView default)
    locked: false,
    selectable: true,
    magnetMode: 'off',
    ...factory,
    ...toolDefault,
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

export function getLineDashArray(style, width = 2) {
  const w = Math.max(1, Number(width) || 2);
  if (style === 'dashed') return `${Math.max(4, w * 3)} ${Math.max(3, w * 2)}`;
  if (style === 'dotted') return `${Math.max(1, w)} ${Math.max(3, w * 2)}`;
  if (style === 'dash_dot') return `${Math.max(5, w * 3)} ${Math.max(2, w)} ${Math.max(1, w)} ${Math.max(2, w)}`;
  if (style === 'long_dash') return `${Math.max(8, w * 6)} ${Math.max(3, w * 2)}`;
  return undefined;
}
