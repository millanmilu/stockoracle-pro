/**
 * StockOracle Pro — SMC Pro display preferences (tiny subscribed store).
 *
 * Which SMC Pro surfaces paint: zones, structure labels, liquidity lines,
 * killzone strip, setup box, score card. Persisted to localStorage, shared by
 * the top-bar SMC menu and the SmcProLayer — no prop drilling through
 * LiveChartView/ChartShell (same pattern as utils/chartSettings.js).
 */

const STORAGE_KEY = 'so_smc_display_v1';

export const SMC_MODE_PRESETS = {
  smart: { maxOb: 1, maxFvg: 1, maxLiquidity: 2, maxStructure: 5, minScore: 20 },
  minimal: { maxOb: 0, maxFvg: 0, maxLiquidity: 2, maxStructure: 1, minScore: 30 },
  full: { maxOb: 3, maxFvg: 3, maxLiquidity: 8, maxStructure: 12, minScore: 0 },
  debug: { maxOb: 12, maxFvg: 12, maxLiquidity: 12, maxStructure: 12, minScore: 0 },
};

export const SMC_DISPLAY_DEFAULTS = {
  zones: true, // order blocks + FVG rectangles
  structure: true, // HH/HL/BOS/CHoCH/MSS labels + dashed levels
  liquidity: true, // BSL/SSL + EQH/EQL lines
  killzones: true, // Asia/London/New York session strip
  setup: true, // Entry/TP/SL box
  scoreCard: true, // SMC Pro (Auto) summary card
  // Visibility architecture (§19): display mode + per-side caps + min score.
  mode: 'smart', // smart | minimal | full | debug (debug = old show-everything)
  ...SMC_MODE_PRESETS.smart,
  minObDisplacement: 0.35, // minimum OB departure-body size in ATR units
  minFvgAtr: 0.05, // minimum FVG width in ATR units
};

const listeners = new Set();
let cache = null;

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadSmcDisplay() {
  if (cache) return cache;
  cache = { ...SMC_DISPLAY_DEFAULTS, ...readStored() };
  return cache;
}

export function saveSmcDisplay(patch = {}) {
  const current = loadSmcDisplay();
  const modePreset = patch.mode && patch.mode !== current.mode && SMC_MODE_PRESETS[patch.mode]
    ? SMC_MODE_PRESETS[patch.mode]
    : null;
  const next = { ...current, ...(modePreset || {}), ...patch };
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((fn) => {
    try { fn(next); } catch {}
  });
  return next;
}

export function resetSmcDisplay() {
  cache = { ...SMC_DISPLAY_DEFAULTS };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  listeners.forEach((fn) => {
    try { fn(cache); } catch {}
  });
  return cache;
}

export function subscribeSmcDisplay(fn) {
  listeners.add(fn);
  try { fn(loadSmcDisplay()); } catch {}
  return () => listeners.delete(fn);
}
