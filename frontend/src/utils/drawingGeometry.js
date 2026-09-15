/**
 * StockOracle Pro — Drawing Tools Geometry Engine
 *
 * Pure, render-free geometry helpers shared by every chart drawing tool
 * (TradingView-style tool set: lines, channels, Fibonacci, Gann, pitchforks,
 * patterns and measurement tools).
 *
 * Design rules:
 *  - Screen-space helpers take `{ x, y }` points (chart pixel coordinates).
 *  - Anchors may also carry `logical` / `price` so data-space values (ratios,
 *    price deltas, bar counts) can be derived without touching the chart API.
 *  - Every function is pure and deterministic so it is unit tested through
 *    `npm test` (node --test src/utils/*.test.js — no DOM required).
 *  - Nothing here imports lightweight-charts; coordinate conversion stays in
 *    the DrawingTools component.
 */

// ── Fibonacci / Gann constants ───────────────────────────────────────────────
export const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
export const FIB_EXTENSION_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2, 2.618, 3.618];
export const FIB_TIMEZONE_LEVELS = [0, 1, 2, 3, 5, 8, 13, 21, 34];

/**
 * Enriched Fibonacci level definitions (color, fill, label) — single source
 * of truth for every Fib renderer in the app (legacy + registry-driven).
 */
export const FIB_LEVEL_STYLE = [
  { level: 0.0,   label: '0.0 (0%)',     color: '#787B86', fill: 'rgba(120,123,134,0.08)' },
  { level: 0.236, label: '0.236 (23.6%)', color: '#EF5350', fill: 'rgba(239,83,80,0.12)' },
  { level: 0.382, label: '0.382 (38.2%)', color: '#F59E0B', fill: 'rgba(245,158,11,0.12)' },
  { level: 0.5,   label: '0.5 (50.0%)',   color: '#10B981', fill: 'rgba(16,185,129,0.12)' },
  { level: 0.618, label: '0.618 (61.8%)', color: '#00E5FF', fill: 'rgba(0,229,255,0.12)' },
  { level: 0.786, label: '0.786 (78.6%)', color: '#6366F1', fill: 'rgba(99,102,241,0.12)' },
  { level: 1.0,   label: '1.0 (100%)',   color: '#A855F7', fill: 'rgba(168,85,247,0.12)' },
];

/** Gann fan angles in degrees (1x1 = 45°). */
export const GANN_FAN_ANGLES = [82.5, 75, 71.25, 63.75, 45, 26.25, 18.75, 15, 7.5];

const GANN_TAN = GANN_FAN_ANGLES.map((deg) => Math.tan((deg * Math.PI) / 180));

// ── Small utilities ─────────────────────────────────────────────────────────
export function clamp(value, min, max) {
  const v = Number(value);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

export function distance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0));
}

export function midpoint(a, b) {
  return { x: ((a?.x ?? 0) + (b?.x ?? 0)) / 2, y: ((a?.y ?? 0) + (b?.y ?? 0)) / 2 };
}

export function isDegenerate(a, b, tolerance = 0.5) {
  return distance(a, b) <= tolerance;
}

// ── Lines: ray / extended / projections ─────────────────────────────────────
/** Point that lies `factor` line-lengths beyond b, continuing the a→b direction. */
export function extendLine(a, b, factor = 10) {
  const dx = (b?.x ?? 0) - (a?.x ?? 0);
  const dy = (b?.y ?? 0) - (a?.y ?? 0);
  return { x: (b?.x ?? 0) + dx * factor, y: (b?.y ?? 0) + dy * factor };
}

/**
 * Exit point where the ray `origin → through` leaves the drawing surface.
 * Falls back to a 10× projection when the surface bounds are unknown.
 */
export function edgeExit(origin, through, surface) {
  if (isDegenerate(origin, through)) return through;
  const { width = 0, height = 0 } = surface || {};
  const dx = through.x - origin.x;
  const dy = through.y - origin.y;
  const candidates = [];
  if (dx !== 0 && width) {
    const t = ((dx > 0 ? width : 0) - origin.x) / dx;
    if (t > 0 && Number.isFinite(t)) candidates.push(t);
  }
  if (dy !== 0 && height) {
    const t = ((dy > 0 ? height : 0) - origin.y) / dy;
    if (t > 0 && Number.isFinite(t)) candidates.push(t);
  }
  const t = candidates.length ? Math.min(...candidates) : 10;
  return { x: origin.x + dx * t, y: origin.y + dy * t };
}

/** Infinite line clipped to the drawing surface (TradingView "Extended Line"). */
export function fullLineEndpoints(a, b, surface) {
  if (isDegenerate(a, b)) return [a, b];
  return [edgeExit(b, a, surface), edgeExit(a, b, surface)];
}

/** Ray: starts at a, extends through b out to the surface edge. */
export function rayEnd(a, b, surface) {
  return edgeExit(a, b, surface);
}

/** On-screen angle (degrees) of the a→b line — used by the Trend Angle tool. */
export function trendAngle(a, b) {
  const dx = (b?.x ?? 0) - (a?.x ?? 0);
  const dy = (b?.y ?? 0) - (a?.y ?? 0);
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(-dy, dx) * 180) / Math.PI;
}

// ── Rectangles / ellipses / triangles / arrows ──────────────────────────────
export function normalizeRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

/** Ellipse inscribed in the a–b bounding box. */
export function ellipseFromBox(a, b) {
  const rect = normalizeRect(a, b);
  return { cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2, rx: rect.width / 2, ry: rect.height / 2 };
}

/** Perfect circle anchored at `a` with radius |a→b|. */
export function circleFromRadius(a, b) {
  return { cx: a.x, cy: a.y, r: distance(a, b) };
}

/** Isosceles triangle inset in the a–b box (apex top-centre, base bottom). */
export function triangleFromBox(a, b) {
  const rect = normalizeRect(a, b);
  return [
    { x: rect.x + rect.width / 2, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

/** Triangle Pattern: three anchors + the two midpoint label points. */
export function trianglePatternVertices(a, b, c) {
  return [a, b, c, midpoint(a, c), midpoint(b, c)];
}

/** Two arrow-head barbs for an a→b arrow, `size` px long. */
export function arrowHead(a, b, size = 12) {
  const angle = Math.atan2((b?.y ?? 0) - (a?.y ?? 0), (b?.x ?? 0) - (a?.x ?? 0));
  const spread = Math.PI / 7;
  return [
    { x: b.x - size * Math.cos(angle - spread), y: b.y - size * Math.sin(angle - spread) },
    { x: b.x - size * Math.cos(angle + spread), y: b.y - size * Math.sin(angle + spread) },
  ];
}

// ── Channels ───────────────────────────────────────────────────────────────
/**
 * Parallel channel: base line a→b offset perpendicular by `width` px.
 * Returns the 4 corners forming the channel band.
 */
export function channelQuad(a, b, width = 35) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [a, b, { x: b.x, y: b.y + width }, { x: a.x, y: a.y + width }];
  const offX = (-dy / len) * width;
  const offY = (dx / len) * width;
  return [a, b, { x: b.x + offX, y: b.y + offY }, { x: a.x + offX, y: a.y + offY }];
}

/** Disjoint channel: two independent rails (a→b, c→d) plus the fill band. */
export function disjointChannelQuads(a, b, c, d) {
  return { rail1: [a, b], rail2: [c, d], band: [a, b, d, c] };
}

/** Flat Top/Bottom channel: the a→b rail plus a *horizontal* rail through `a`
 * spanning the same x-range (TradingView's Flat Top/Bottom band).
 */
export function flatTopQuad(a, b) {
  return [a, { x: b.x, y: a.y }, b];
}

/**
 * Signed perpendicular offset of `c` from the line a→b — positive on the side
 * `channelQuad` offsets toward. Lets Rotated Rectangle / channels pass through
 * a third anchor: `channelQuad(a, b, signedPerpendicularOffset(a, b, c))`.
 */
export function signedPerpendicularOffset(a, b, c) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 0;
  return ((c.x - a.x) * -dy + (c.y - a.y) * dx) / len;
}

// ── Fibonacci ──────────────────────────────────────────────────────────────
/**
 * Retracement lines between two anchors, interpolated from p1.price → p2.price
 * with pixel y for direct rendering.
 */
export function fibRetracementLines(a, b, levels = FIB_RETRACEMENT_LEVELS) {
  const from = Number(a.price ?? 0);
  const span = Number(b.price ?? 0) - from;
  return levels.map((level) => {
    const y = a.y + (b.y - a.y) * level;
    return {
      level,
      price: from + span * level,
      from,
      to: Number(b.price ?? 0),
      y,
      top: Math.min(a.y, y),
      bottom: Math.max(a.y, y),
    };
  });
}

/**
 * Fibonacci retracement *bands* — screen-space polygons for each level pair
 * (a→level and level→next), complete with fill, stroke colour and label.
 *
 * Each entry is designed for direct `<rect>`/`<line>` rendering and matches the
 * enriched FIB_LEVEL_STYLE metadata so legend labels, colours and fills stay
 * consistent across the legacy Fib renderer and any registry-driven Fib shapes.
 */
export function fibRetracementBands(a, b, levels = FIB_LEVEL_STYLE) {
  // a and b are screen-space points with { x, y, price }.
  const below = b.y > a.y ? b : a;
  const above = b.y > a.y ? a : b;
  const totalY = below.y - above.y;
  const totalPrice = below.price - above.price;

  return levels.map((l, idx) => {
    // Accept enriched metadata objects ({ level, color, fill, label }) or
    // plain numeric levels (e.g. FIB_RETRACEMENT_LEVELS), matching how the
    // legacy fib renderer and extended fib_extension/fib_channel shapes call it.
    const level = l && typeof l === 'object' ? Number(l.level) ?? 0 : Number(l) ?? 0;
    const xLow = Math.min(a.x, b.x);
    const xHigh = Math.max(a.x, b.x);
    const y = above.y + totalY * level;
    const price = above.price + totalPrice * level;
    const fill = l && typeof l === 'object' ? (l.fill ?? 'rgba(120,123,134,0.08)') : 'rgba(120,123,134,0.08)';
    const color = l && typeof l === 'object' ? (l.color ?? '#787B86') : '#787B86';
    const label = l && typeof l === 'object' ? (l.label ?? `${level}`) : `${level}`;
    // bands span from *this* level to the *next* (or to the edge for the last).
    const next = levels[idx + 1];
    const nextLevel = next && typeof next === 'object' ? Number(next.level) ?? 0 : Number(next) ?? 0;
    const nextY = next ? above.y + totalY * nextLevel : below.y;
    const nextPrice = next ? above.price + totalPrice * nextLevel : below.price;
    // For the fill rectangle we want the smaller Y on top.
    const rectTop = Math.min(y, nextY);
    const rectHeight = Math.max(1, Math.abs(nextY - y));
    const lineBottom = Math.max(y, nextY);

    return {
      level,
      price,
      y,
      nextPrice,
      nextY,
      rectTop,
      rectHeight,
      lineBottom,
      xLow,
      xHigh,
      fill,
      color,
      label,
      borderTop: level === 0 ? true : false,        // only the 0-level band has a top edge
      borderBottom: next == null,                    // only the 1.0 band has a bottom edge
    };
  });
}

/** Trend-based extension: projects the a→b move from c. */
export function fibExtensionLines(a, b, c, levels = FIB_EXTENSION_LEVELS) {
  const span = Number(b.price ?? 0) - Number(a.price ?? 0);
  const spanY = b.y - a.y;
  return levels.map((level) => ({
    level,
    price: Number(c.price ?? 0) + span * level,
    y: c.y + spanY * level,
  }));
}

/** Fibonacci time zones — bar offsets from the first anchor. */
export function fibTimezoneLines(a, b, count = FIB_TIMEZONE_LEVELS.length) {
  const rawStep = b.logical != null && a.logical != null ? b.logical - a.logical : 1;
  // Single-anchor placement (Fib Time Zone tool) passes the same anchor twice —
  // a zero step would collapse all 9 zones onto one line, so default to 1 bar.
  const step = rawStep === 0 ? 1 : rawStep;
  return FIB_TIMEZONE_LEVELS.slice(0, count).map((level) => ({
    level,
    logical: a.logical != null ? a.logical + step * level : null,
  }));
}

/** Fib channel: three anchors → parallel rails at each ratio. */
export function fibChannelLines(a, b, c, levels = FIB_RETRACEMENT_LEVELS) {
  const spanY = b.y - a.y;
  return levels.map((level) => ({
    level,
    line: [a, { x: b.x, y: b.y + (c.y - a.y) + spanY * level }],
  }));
}

// ── Gann ───────────────────────────────────────────────────────────────────
/** Gann fan: 9 rays from `a`, scaled so the 45° ray matches the a→b move. */
export function gannFanLines(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return GANN_FAN_ANGLES.map((deg, index) => ({
    deg,
    end: { x: a.x + dx, y: a.y + dy * GANN_TAN[index] },
  }));
}

/** Gann box: retracement grid (vertical + horizontal ratio lines). */
export function gannBoxLevels(a, b, levels = FIB_RETRACEMENT_LEVELS) {
  const rect = normalizeRect(a, b);
  return levels.map((level) => ({
    level,
    x: rect.x + rect.width * level,
    y: rect.y + rect.height * level,
  }));
}

// ── Pitchforks ─────────────────────────────────────────────────────────────
/**
 * Andrew's pitchfork variants from three anchors (a = pivot, b / c = tines).
 * - `pitchfork`: median from midpoint(b, c)
 * - `schiff`:    median from midpoint(a, b)
 * - `inside`:    median from midpoint(midpoint(a,b), midpoint(b,c))
 */
export function pitchforkLines(a, b, c, variant = 'pitchfork') {
  const midBC = midpoint(b, c);
  const midAB = midpoint(a, b);
  const origin = variant === 'schiff' ? midAB : variant === 'inside' ? midpoint(midAB, midBC) : midBC;
  const dx = origin.x - a.x;
  const dy = origin.y - a.y;
  return {
    origin,
    median: [origin, { x: origin.x + dx * 3, y: origin.y + dy * 3 }],
    upper: [a, { x: b.x + dx, y: b.y + dy }],
    lower: [a, { x: c.x + dx, y: c.y + dy }],
  };
}

// ─ Measurement (Ruler / Date-Price Range) ─────────────────────────────────
/**
 * TradingView-style ruler readout between two anchors.
 * `timeframeMs` lets us translate the bar count into a wall-clock duration.
 */
export function measureStats(a, b, timeframeMs = 0) {
  const from = Number(a?.price ?? 0);
  const to = Number(b?.price ?? 0);
  const delta = to - from;
  const percent = from !== 0 ? (delta / from) * 100 : 0;
  const bars = a?.logical != null && b?.logical != null ? Math.abs(b.logical - a.logical) : 0;
  return { from, to, delta, percent, bars, durationMs: timeframeMs > 0 ? bars * timeframeMs : 0 };
}

export function formatSignedPrice(delta, currency = '₹', digits = 2) {
  const v = Number(delta) || 0;
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}${currency}${Math.abs(v).toFixed(digits)}`;
}

export function formatSignedPercent(percent, digits = 2) {
  const v = Number(percent) || 0;
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

/** Human readable duration for the ruler tool: "3D 4h". */
export function formatDuration(ms) {
  const total = Math.max(0, Number(ms) || 0);
  if (total === 0) return '0m';
  const minutes = Math.floor(total / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts = [];
  if (days) parts.push(`${days}D`);
  if (hours) parts.push(`${hours}h`);
  if (mins && !days) parts.push(`${mins}m`);
  return parts.length ? parts.join(' ') : '0m';
}

/** Date/price range stats for the range tools. */
export function dateRangeStats(a, b, timeframeMs = 0) {
  const bars = a?.logical != null && b?.logical != null ? Math.abs(b.logical - a.logical) : 0;
  return { bars, durationMs: timeframeMs > 0 ? bars * timeframeMs : 0 };
}

// ── Patterns ───────────────────────────────────────────────────────────────
/**
 * XABCD / ABCD leg ratios (TradingView labels every completed leg, e.g.
 * "0.618" on the BC retracement of AB).
 */
export function patternLegRatios(points = [], labels = []) {
  const legs = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const prevMove = i >= 2 ? points[i - 1].y - points[i - 2].y : null;
    const move = cur.y - prev.y;
    const ratio = prevMove ? Math.abs(move / prevMove) : null;
    legs.push({
      index: i,
      label: labels[i - 1] || `P${i}`,
      x: cur.x,
      y: cur.y,
      price: cur.price,
      ratio,
      ratioLabel: ratio != null && Number.isFinite(ratio) ? ratio.toFixed(3) : '',
      bullish: move < 0,
    });
  }
  return legs;
}

/** Elliott wave labels for impulse (0-5) / correction (0-A-B-C) waves. */
export function elliottWaveLabels(count, variant = 'impulse') {
  const base = variant === 'correction' ? ['0', 'A', 'B', 'C'] : ['0', '1', '2', '3', '4', '5'];
  return base.slice(0, Math.max(0, count));
}

// ── SVG path builders ──────────────────────────────────────────────────────
export function polylinePath(points = []) {
  if (!points.length) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${Number(p.x).toFixed(2)} ${Number(p.y).toFixed(2)}`)
    .join(' ');
}

export function polygonPath(points = []) {
  if (!points.length) return '';
  return `${polylinePath(points)} Z`;
}

export function strokeDasharray(lineStyle = 'solid', width = 2) {
  if (lineStyle === 'dashed') return `${Math.max(4, width * 3)} ${Math.max(3, width * 2)}`;
  if (lineStyle === 'dotted') return `${Math.max(1, width)} ${Math.max(3, width * 2)}`;
  return undefined;
}

// ── Forecast / projection helpers ──────────────────────────────────────────
/** Forecast tool: the a→b move repeated from c. */
export function forecastProjection(a, b, c) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dPrice = Number(b.price ?? 0) - Number(a.price ?? 0);
  return {
    target: { x: c.x + dx, y: c.y + dy, price: Number(c.price ?? 0) + dPrice },
    level2: c.y + dy,
    price2: Number(c.price ?? 0) + dPrice,
  };
}

/** Projection tool: two stacked levels derived from the first move. */
export function projectionLevels(a, b, c) {
  const dy = b.y - a.y;
  const dPrice = Number(b.price ?? 0) - Number(a.price ?? 0);
  return {
    level1: { y: c.y, price: Number(c.price ?? 0) },
    level2: { y: c.y + dy, price: Number(c.price ?? 0) + dPrice },
  };
}
