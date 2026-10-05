/**
 * StockOracle Pro — Drawing Tool Default Templates (DrawingDefaults service).
 *
 * Per-tool factory templates + user-saved defaults management.
 * This is the `DrawingDefaults` / `DrawingSettingsManager` layer: every
 * drawing tool resolves its starting style through here, so ALL tools share
 * one settings architecture instead of random per-tool implementations.
 *
 * Precedence for a new drawing (low → high):
 *   1. global theme (`DRAWING_THEME_DEFAULTS` line/fill colors)
 *   2. factory template below (fill / extend / font / fib / stats keys —
 *      deliberately NO color/strokeWidth/lineStyle so new drawings keep
 *      inheriting the user's last-used active style)
 *   3. user-saved tool default (`toolDefaults[type]` in localStorage —
 *      written by "Save as Default", MAY include color/width/style)
 *
 * Storage reuses the existing `stockoracle_drawing_settings_tv_v1` key —
 * no new storage mechanism.
 */

import { FIB_TOGGLES as SCHEMA_FIB_TOGGLES } from './drawingSettingsSchema.js';

/**
 * Fib levels for factory templates. Resolved lazily (function call, never at
 * module-eval time) so the schema ↔ defaults import cycle stays safe under
 * both ESM and Node test loading.
 */
function fibLevels() {
  try {
    if (Array.isArray(SCHEMA_FIB_TOGGLES) && SCHEMA_FIB_TOGGLES.length) return [...SCHEMA_FIB_TOGGLES];
  } catch {}
  return [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
}

/** Group-level factory fallback (keys beyond color/width/style). */
const GROUP_FACTORY = {
  lines: { extendLeft: false, extendRight: false },
  channels: {
    backgroundVisible: true, backgroundOpacity: 0.15,
    borderVisible: true, borderOpacity: 1,
    extendLeft: false, extendRight: false,
  },
  fibonacci: {
    // fibLevelsVisible injected lazily in getToolFactoryDefault().
    showPrices: true,
    backgroundVisible: true, backgroundOpacity: 0.15,
    extendLeft: false, extendRight: false,
  },
  gann: { showPrices: true },
  pitchforks: { backgroundVisible: true, backgroundOpacity: 0.15 },
  shapes: {
    backgroundVisible: true, backgroundOpacity: 0.15,
    borderVisible: true, borderOpacity: 1,
  },
  annotations: { fontSize: 12, fontBold: true, fontItalic: false, textAlign: 'left' },
  trading: {
    backgroundVisible: true, backgroundOpacity: 0.15,
    borderVisible: true, borderOpacity: 1,
    showStatsBars: true, showStatsTime: true, showStatsPrice: true, showStatsPercent: true,
  },
};

/**
 * Per-tool factory overrides. Only keys that differ from the group
 * fallback are listed — keeps the table honest and reviewable.
 */
export const TOOL_FACTORY_DEFAULTS = {
  // Lines — TradingView parity: plain trend lines don't extend by default.
  trendline: { extendLeft: false, extendRight: false },
  ray: { extendLeft: false, extendRight: true },
  extended_line: { extendLeft: true, extendRight: true },
  info_line: { showStatsBars: true, showStatsPrice: true, showStatsPercent: true, showMidLine: true },
  arrow: { extendLeft: false, extendRight: false },
  horizontal_line: { showPrices: true },
  horizontal_ray: { showPrices: true, extendRight: true },
  // Shapes — Rectangle default from the spec: blue fill @ 15%, 2px solid.
  rectangle: { backgroundVisible: true, backgroundOpacity: 0.15, borderVisible: true },
  ellipse: { backgroundVisible: true, backgroundOpacity: 0.15, borderVisible: true },
  circle: { backgroundVisible: true, backgroundOpacity: 0.15, borderVisible: true },
  triangle: { backgroundVisible: true, backgroundOpacity: 0.15, borderVisible: true },
  rotated_rectangle: { backgroundVisible: true, backgroundOpacity: 0.15, borderVisible: true },
  // Freehand — translucent stroke like a real marker.
  highlighter: { opacity: 0.5, strokeWidth: 4 },
  brush: { opacity: 1, strokeWidth: 2 },
  // Ranges / ruler — stats + midline on.
  date_range: { showMidLine: true, showStatsBars: true, showStatsTime: true },
  price_range: { showMidLine: true, showStatsPrice: true, showStatsPercent: true, showPrices: true },
  date_price_range: { showMidLine: true, showStatsBars: true, showStatsTime: true, showStatsPrice: true, showStatsPercent: true },
  // Positions — TradingView blue/red boxes.
  long_position: { backgroundColor: '#2962FF', backgroundOpacity: 0.2 },
  short_position: { backgroundColor: '#EF5350', backgroundOpacity: 0.2 },
  // Text tools — readable defaults.
  text: { fontSize: 14, fontBold: false, textAlign: 'left' },
  callout: { fontSize: 12, backgroundVisible: true, backgroundOpacity: 1 },
  note: { fontSize: 12, backgroundVisible: true, backgroundOpacity: 1 },
};

const TOOL_GROUP = {
  trendline: 'lines', ray: 'lines', extended_line: 'lines', info_line: 'lines',
  trend_angle: 'lines', horizontal_line: 'lines', horizontal_ray: 'lines',
  vertical_line: 'lines', cross_line: 'lines', arrow: 'lines', polyline: 'lines',
  parallel_channel: 'channels', regression_trend: 'channels',
  flat_top_bottom: 'channels', disjoint_channel: 'channels',
  fibonacci: 'fibonacci', fib_extension: 'fibonacci', fib_channel: 'fibonacci',
  fib_fan: 'fibonacci', fib_timezone: 'fibonacci', fib_circle: 'fibonacci',
  gann_fan: 'gann', gann_box: 'gann',
  pitchfork: 'pitchforks', schiff_pitchfork: 'pitchforks', inside_pitchfork: 'pitchforks',
  brush: 'shapes', highlighter: 'shapes', rectangle: 'shapes', rotated_rectangle: 'shapes',
  ellipse: 'shapes', circle: 'shapes', triangle: 'shapes', arc: 'shapes',
  text: 'annotations', callout: 'annotations', note: 'annotations',
  price_label: 'annotations', price_note: 'annotations', flag: 'annotations', pin: 'annotations',
  long_position: 'trading', short_position: 'trading', forecast: 'trading',
  projection: 'trading', bars_pattern: 'trading', date_range: 'trading',
  price_range: 'trading', date_price_range: 'trading',
  fixed_range_volume_profile: 'trading', ruler: 'trading',
};

/** Factory template for a tool: group fallback + tool override (no storage). */
export function getToolFactoryDefault(type) {
  const group = TOOL_GROUP[type];
  const base = {
    ...(group && GROUP_FACTORY[group] ? GROUP_FACTORY[group] : {}),
    ...(TOOL_FACTORY_DEFAULTS[type] || {}),
  };
  // Fibonacci tools get the full level set unless the tool overrides it.
  if (group === 'fibonacci' && !Array.isArray(base.fibLevelsVisible)) {
    base.fibLevelsVisible = fibLevels();
  }
  return base;
}

/** Keys that must never be stored as a tool default (identity + anchors). */
const NON_SETTING_KEYS = new Set([
  'id', 'type', 'points',
  'startLogical', 'startPrice', 'startTime', 'startFrac', 'startOffMs', 'startX', 'startY',
  'endLogical', 'endPrice', 'endTime', 'endFrac', 'endOffMs', 'endX', 'endY',
  'tf', 'pending', 'legacyPending', 'locked', 'hidden', 'name', 'groupId',
]);

/** Strip identity/geometry keys — only real settings are stored as defaults. */
export function toStorableSettings(drawing) {
  if (!drawing || typeof drawing !== 'object') return {};
  return Object.fromEntries(
    Object.entries(drawing).filter(([key]) => !NON_SETTING_KEYS.has(key)),
  );
}

/** Pure helper: apply one settings patch to every drawing of the same type. */
export function applyToSameTypeDrawings(drawings, type, patch) {
  if (!Array.isArray(drawings)) return drawings;
  return drawings.map((d) => (d?.type === type ? { ...d, ...patch } : d));
}

/** Pure helper: assign a shared groupId to a set of drawings (multi-select Group). */
export function groupDrawings(drawings, ids) {
  const set = new Set(ids);
  const groupId = `grp_${Date.now()}`;
  return drawings.map((d) => (set.has(d?.id) ? { ...d, groupId } : d));
}

/** Pure helper: clear groupId from a set of drawings (multi-select Ungroup). */
export function ungroupDrawings(drawings, ids) {
  const set = new Set(ids);
  return drawings.map((d) => (set.has(d?.id) ? { ...d, groupId: null } : d));
}
