/**
 * StockOracle Pro — Drawing Tools: Pure utility constants & functions.
 *
 * Extracted from DrawingTools.jsx (was L1–141).
 * No React imports — plain JS only so these can be used in tests or
 * non-React contexts without side-effects.
 */

import { getToolSpec, PINS_STORAGE_KEY } from './drawingToolCatalog.js';

// ── Storage ────────────────────────────────────────────────────────────────────

export const STORAGE_KEY = 'stockoracle_drawings_tv_v6';

/**
 * Intervals that legacy per-interval drawing keys may exist for (v6 stored
 * `${STORAGE_KEY}_${symbol}_${interval}`). One-time merge moves them into the
 * shared per-symbol key so sketches appear on every timeframe.
 */
export const LEGACY_INTERVALS = ['1s', '30s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M'];

// ── Time helpers ───────────────────────────────────────────────────────────────

/**
 * Canonical millisecond timestamp for any bar-time shape in the app:
 * epoch seconds (intraday candles) or 'YYYY-MM-DD' (daily IST market date).
 * Used to match anchors across timeframes.
 */
export function canonicalMs(t) {
  if (t == null) return null;
  if (typeof t === 'number') {
    if (!Number.isFinite(t)) return null;
    return t > 1e12 ? t : t * 1000; // epoch seconds (or ms) → ms
  }
  const s = String(t).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const ms = Date.parse(`${s}T00:00:00Z`);
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

/** Bar duration in ms for every supported interval (0 = unknown). */
export const INTERVAL_MS = {
  '1s': 1000,
  '30s': 30 * 1000,
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

export function intervalToMs(iv) {
  return INTERVAL_MS[String(iv)] || 0;
}

// ── Anchor identity ────────────────────────────────────────────────────────────

/** Legacy drawing types anchored by a single start point (no end anchor). */
export const SINGLE_ANCHOR_LEGACY = new Set(['horizontal_line', 'horizontal_ray', 'text', 'sticker']);

export const anchorHasIdentity = (logical, time) => logical != null || time != null;

// ── Drawing repair ─────────────────────────────────────────────────────────────

/**
 * One-time repair for drawings saved by older builds: drops entries that can
 * never render correctly (anchors with neither a logical index nor a bar
 * time — they would sit frozen at stale screen pixels and look permanently
 * half-drawn). Everything salvageable passes through untouched.
 */
export function repairDrawings(list) {
  if (!Array.isArray(list)) return { clean: [], dropped: 0 };
  const clean = [];
  let dropped = 0;
  for (const d of list) {
    if (!d || typeof d.type !== 'string' || !d.type) {
      dropped += 1;
      continue;
    }
    if (Array.isArray(d.points)) {
      const kept = d.points.filter((pt) => pt && anchorHasIdentity(pt.logical, pt.time));
      // Authoritative anchor count comes from the tool catalog spec
      // (extended tools declare 1–6 points). The hardcoded 3 was
      // silently dropping every 2-point tool (FRVP, trend fans,
      // ellipses, triangles, date/price ranges, …) on reload.
      const spec = typeof getToolSpec === 'function' ? getToolSpec(d.type) : null;
      const need = d.type === 'polyline' ? 2 : 3;
      const required = typeof spec?.points === 'number' ? spec.points : need;
      if (kept.length >= required) {
        clean.push(kept.length === d.points.length ? d : { ...d, points: kept });
      } else {
        dropped += 1;
      }
      continue;
    }
    if (SINGLE_ANCHOR_LEGACY.has(d.type)) {
      if (anchorHasIdentity(d.startLogical, d.startTime)) clean.push(d);
      else dropped += 1;
      continue;
    }
    if (anchorHasIdentity(d.startLogical, d.startTime) && anchorHasIdentity(d.endLogical, d.endTime)) {
      clean.push(d);
    } else {
      dropped += 1;
    }
  }
  return { clean, dropped };
}

// ── Style / color constants ────────────────────────────────────────────────────

export const COLOR_PRESETS = ['#38BDF8', '#10B981', '#F59E0B', '#EF5350', '#A855F7', '#EC4899', '#FFFFFF', '#64748B'];

// ── Pinned favourite tools ─────────────────────────────────────────────────────

/** Pinned favourite tool ids in toolbar order (shared with DrawingToolbar). */
export function readPinnedIds() {
  try {
    const raw = window.localStorage.getItem(PINS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && getToolSpec(id)) : [];
  } catch {
    return [];
  }
}

/** Digit hotkey for the nth pinned favourite: 1..9 then 0. */
export function pinDigitForIndex(i) {
  return i >= 0 && i < 10 ? String((i + 1) % 10) : null;
}
