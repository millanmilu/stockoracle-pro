import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Crosshair, TrendingUp, AlignJustify, Brush, Type, Smile,
  Ruler, Magnet, Lock, Unlock, Eye, EyeOff,
  Trash2, Square as SquareIcon, Sliders, Settings,
  X, Circle, Minus, Palette, Move, Copy,
  RotateCcw, RotateCw, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import DrawingToolbar, { getToolbarWidth, PINS_STORAGE_KEY, ToolIcon } from './DrawingToolbar';
import FloatingFavoritesBar from './FloatingFavoritesBar';
import DrawingShape from './DrawingShape';
import DrawingSettingsModal from './DrawingSettingsModal';
import { isDrawingVisibleOn } from './drawingSettingsSchema';
import {
  CURSOR_TOOLS,
  DEFAULT_TOOL,
  MAGNET_LABELS,
  MAGNET_SNAP_RADIUS,
  MAGNET_WEAK_RADIUS,
  getToolSpec,
  isExtendedTool,
  nextMagnetMode,
  resolveShortcut,
} from './drawingToolCatalog';
import * as DG from '../../utils/drawingGeometry';
import { PRICE_AXIS_WIDTH, isCryptoSymbol } from '../../utils/chartHelpers';

const STORAGE_KEY = 'stockoracle_drawings_tv_v6';

// Intervals that legacy per-interval drawing keys may exist for (v6 stored
// `${STORAGE_KEY}_${symbol}_${interval}`). One-time merge moves them into the
// shared per-symbol key so sketches appear on every timeframe.
const LEGACY_INTERVALS = ['1s', '30s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M'];

/**
 * Canonical millisecond timestamp for any bar-time shape in the app:
 * epoch seconds (intraday candles) or 'YYYY-MM-DD' (daily IST market date).
 * Used to match anchors across timeframes.
 */
function canonicalMs(t) {
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
const INTERVAL_MS = {
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

function intervalToMs(iv) {
  return INTERVAL_MS[String(iv)] || 0;
}

/** Legacy drawing types anchored by a single start point (no end anchor). */
const SINGLE_ANCHOR_LEGACY = new Set(['horizontal_line', 'horizontal_ray', 'text', 'sticker']);

const anchorHasIdentity = (logical, time) => logical != null || time != null;

/**
 * One-time repair for drawings saved by older builds: drops entries that can
 * never render correctly (anchors with neither a logical index nor a bar
 * time — they would sit frozen at stale screen pixels and look permanently
 * half-drawn). Everything salvageable passes through untouched.
 */
function repairDrawings(list) {
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
      const need = d.type === 'polyline' ? 2 : 3;
      // Single-anchor extended tools (vertical_line, note, flag, …) need 1.
      const spec = typeof getToolSpec === 'function' ? getToolSpec(d.type) : null;
      const required = spec?.points === 1 ? 1 : need;
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

// Single source of truth lives in drawingGeometry (FIB_LEVEL_STYLE) —
// this alias keeps the legacy Fib renderer + preview on identical colors/labels.
const FIBONACCI_LEVELS = DG.FIB_LEVEL_STYLE;

const COLOR_PRESETS = ['#38BDF8', '#10B981', '#F59E0B', '#EF5350', '#A855F7', '#EC4899', '#FFFFFF', '#64748B'];

/** Pinned favourite tool ids in toolbar order (shared with DrawingToolbar). */
function readPinnedIds() {
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

export default function DrawingTools({
  chartRef,
  candleRef,
  candles = [],
  symbol,
  interval,
  chartReady,
  onOpenSettings,
  isOpen = true,
  onToggleOpen = () => {},
  isMobile = false,
  activeTool: controlledActiveTool,
  onActiveToolChange,
  // Ref to the main price-pane wrapper (LiveChartView). When provided the
  // SVG overlay is sized to that pane exactly, so drawings track the chart
  // 1:1 on scroll/zoom instead of stretching over volume/oscillator panes.
  mainPaneRef = null,
}) {
  const isCrypto = isCryptoSymbol(symbol);
  const currSym = isCrypto ? '$' : '₹';
  // Toolbar dimensions synchronized with DrawingToolbar (46px desktop, 36px mobile)
  const toolbarWidth = getToolbarWidth(isMobile);
  const btnSize = isMobile ? 30 : 34;
  const iconSize = isMobile ? 15 : 17;


  // Tool & State Management — activeTool is controlled by LiveChartView when the
  // `activeTool` prop is provided (so the top Draw menu and the rail share state),
  // otherwise the internal state is used.
  const [internalActiveTool, setInternalActiveTool] = useState('crosshair');
  const activeTool = controlledActiveTool ?? internalActiveTool;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const onActiveToolChangeRef = useRef(onActiveToolChange);
  onActiveToolChangeRef.current = onActiveToolChange;
  const setActiveTool = useCallback((next) => {
    const value = typeof next === 'function' ? next(activeToolRef.current) : next;
    if (controlledActiveTool === undefined) setInternalActiveTool(value);
    onActiveToolChangeRef.current?.(value);
  }, [controlledActiveTool]);
  const [drawings, setDrawings] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDraw, setCurrentDraw] = useState(null);

  // Undo / Redo History Stacks
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Selected / Dragging state
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  const [draggingHandle, setDraggingHandle] = useState(null); // 'start' | 'end' | 'body' | 'target' | 'stop' | 'channel'
  const [dragStartPos, setDragStartPos] = useState(null);

  // Magnet snapping: 'off' | 'weak' | 'strong' — TradingView's three-state magnet.
  // Defaults to 'off' like TradingView (free placement); Alt+M or the magnet
  // button cycles to weak/strong when you want OHLC snapping.
  const [magnetMode, setMagnetMode] = useState('off');
  const [snapIndicator, setSnapIndicator] = useState(null); // { x, y, price, label }

  // Multi-anchor click placement (3+ point tools), clipboard, overlays
  const [pendingPoints, setPendingPoints] = useState([]);
  const [clipboard, setClipboard] = useState(null); // single drawing copied via context menu / Ctrl+C
  const [contextMenu, setContextMenu] = useState(null); // { x, y, drawingId }
  const [showObjectTree, setShowObjectTree] = useState(false);
  const [drawingSettingsId, setDrawingSettingsId] = useState(null); // drawing id with open settings modal
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 });
  const [hiddenIds, setHiddenIds] = useState(() => new Set()); // per-drawing visibility (TradingView eye toggle)
  const [textEdit, setTextEdit] = useState(null); // { id } — inline text editing via double-click
  const [textEditVal, setTextEditVal] = useState('');

  const timeframeMs = useMemo(() => intervalToMs(interval), [interval]);

  // Modifiers — stayInDrawMode defaults to false (TradingView parity: auto-unselect after plotting)
  const [stayInDrawMode, setStayInDrawMode] = useState(() => {
    try {
      const saved = localStorage.getItem('so_stay_in_draw_mode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [lockAllDrawings, setLockAllDrawings] = useState(false);
  const [hideAllDrawings, setHideAllDrawings] = useState(false);

  // Text & Sticker modals
  const [textInputPos, setTextInputPos] = useState(null);
  const [textInputVal, setTextInputVal] = useState('');
  const [showStickerMenu, setShowStickerMenu] = useState(false);
  const [stickerPos, setStickerPos] = useState(null);

  // Active Line Styles
  const [activeColor, setActiveColor] = useState('#38BDF8');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(2);
  const [activeLineStyle, setActiveLineStyle] = useState('solid'); // 'solid' | 'dashed' | 'dotted'

  // Coordinate sync tick (throttled with RAF) — the VALUE is kept (not just
  // the setter) so render-path coordinate caches can key on it.
  const [syncTick, setSyncTick] = useState(0);
  const svgRef = useRef(null);
  const isDraggingRef = useRef(false);
  // ── Move-event performance ─────────────────────────────────────────────
  // Mousemove can fire 100-250×/s; each event used to run layout reads, chart
  // API calls and several setStates (→ a full re-render with a coordinate
  // recompute of EVERY saved drawing). Now events are coalesced to one RAF
  // flush per frame and the layout rect is cached instead of re-measured.
  const moveRafRef = useRef(null);
  const pendingMoveRef = useRef(null); // { clientX, clientY } of latest event
  const svgRectRef = useRef(null); // { left, top, … , measuredAt }
  // Fresh mirror of the interaction state the RAF flush needs (avoids stale
  // closures — the flush always sees the latest render's values).
  const moveStateRef = useRef(null);
  // Render-path coordinate cache: chartToCoord is a pure function of
  // (logical, price, viewport). Keyed entries are valid until the viewport
  // tick or the candle set changes, so re-renders caused by the in-progress
  // stroke/preview become cache hits for all untouched drawings.
  const coordCacheRef = useRef(null);
  // Latest drawings mirror + pre-drag snapshot so mouse-up persists the
  // post-drag positions while undo restores the pre-drag state.
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;
  const dragSnapshotRef = useRef(null);
  // True once the CURRENT gesture's mouse-up has committed. The release fires
  // both the svg handler and the window-level handler below, so the commit
  // must be idempotent — reset on every new gesture (mousedown / beginDrag).
  const upHandledRef = useRef(true);
  // True once the current drag actually moved something. A plain click on a
  // shape selects it without pushing a no-op entry onto the undo stack.
  const dragMovedRef = useRef(false);
  // Whether a drag or a drawing gesture is in flight (mirror for the
  // window-level listeners, which cannot see render-scope state).
  const gestureActiveRef = useRef(false);
  // Body-move gesture origin: total data-space delta from gesture start is
  // applied to the snapshot every frame (never incremental), so long drags
  // can't accumulate rounding drift and drawings stay glued to bars.
  const bodyGestureRef = useRef(null);
  // Kept fresh every render so the RAF-coalesced move flush never acts on
  // stale interaction state.
  moveStateRef.current = {
    draggingHandle,
    selectedDrawingId,
    dragStartPos,
    isDrawing,
    currentDraw,
    pendingPoints,
    lockAllDrawings,
  };
  gestureActiveRef.current = Boolean(draggingHandle || isDrawing);
  // All shape drags funnel through beginDrag, which snapshots the pre-drag
  // state as soon as any drag handle becomes active.
  useEffect(() => {
    if (draggingHandle && !dragSnapshotRef.current) {
      dragSnapshotRef.current = drawingsRef.current;
    }
    if (!draggingHandle) {
      // Keep snapshot until mouse-up consumes it; do not clear on interim nulls.
    }
  }, [draggingHandle]);

  // ── 1. Coordinate Transforms ───────────────────────────────────────────────

  const coordToChart = useCallback((x, y) => {
    let logical = null;
    let price = null;
    if (chartRef?.current) {
      try {
        logical = chartRef.current.timeScale().coordinateToLogical(x);
      } catch (_) {}
    }
    if (candleRef?.current) {
      try {
        price = candleRef.current.coordinateToPrice(y);
      } catch (_) {}
    }
    return { logical, price };
  }, [chartRef, candleRef]);

  const chartToCoord = useCallback((logical, price, fallbackX, fallbackY) => {
    let x = fallbackX;
    let y = fallbackY;
    if (logical != null && chartRef?.current) {
      try {
        const cx = chartRef.current.timeScale().logicalToCoordinate(logical);
        if (cx != null && !isNaN(cx)) x = cx;
      } catch (_) {}
    }
    if (price != null && candleRef?.current) {
      try {
        const cy = candleRef.current.priceToCoordinate(price);
        if (cy != null && !isNaN(cy)) y = cy;
      } catch (_) {}
    }
    return { x, y };
  }, [chartRef, candleRef]);

  // ── 1b. Time-anchored stability ──────────────────────────────────────────
  // Logical bar indices are positional: appending live bars, reloading history
  // or refitting the viewport can shift what a stored float means. Bar `time`
  // (YYYY-MM-DD or epoch seconds) is the stable identity — drawings resolve
  // through it first and only fall back to the stored logical for sketches
  // made between bars or while history was still loading.
  const timeIndexMap = useMemo(() => {
    const m = new Map();
    if (Array.isArray(candles)) {
      for (let i = 0; i < candles.length; i += 1) {
        const t = candles[i]?.time;
        if (t != null && !m.has(t)) m.set(t, i);
      }
    }
    return m;
  }, [candles]);

  // Canonical millisecond timestamp for any bar-time shape the app uses:
  // epoch seconds (intraday) or 'YYYY-MM-DD' (daily, IST market date).
  // A daily date maps to its UTC midnight — nearest-bar search below still
  // lands on that session's first bar, since it is closer than any bar of
  // the previous session.
  const msIndex = useMemo(() => {
    const arr = [];
    if (Array.isArray(candles)) {
      for (let i = 0; i < candles.length; i += 1) {
        const ms = canonicalMs(candles[i]?.time);
        if (ms != null) arr.push([ms, i]);
      }
    }
    return arr; // ascending by construction — candles are time-sorted
  }, [candles]);

  const timeForLogical = useCallback((logical) => {
    if (logical == null || !Array.isArray(candles) || candles.length === 0) return undefined;
    const idx = Math.round(Number(logical));
    if (!Number.isFinite(idx) || idx < 0 || idx >= candles.length) return undefined;
    return candles[idx]?.time;
  }, [candles]);

  const fracForLogical = useCallback((logical) => {
    if (logical == null) return 0;
    const n = Number(logical);
    if (!Number.isFinite(n)) return 0;
    return n - Math.round(n);
  }, []);

  // Build a fully-anchored point from a mouse position + chart position.
  // Snapped positions already carry time/frac; raw positions derive them.
  // `offMs` is the wall-clock exactness: sub-bar offset in MILLISECONDS from
  // the anchor bar's epoch. Unlike `frac` (source-interval bar units, which
  // shift meaning across timeframes), `offMs` resolves exactly on ANY
  // interval — this is what keeps drawings glued across timeframe switches.
  const toAnchor = useCallback((px, py, chartPt) => {
    const frac = chartPt?.frac ?? fracForLogical(chartPt?.logical);
    const srcMs = intervalToMs(interval);
    const off = Number.isFinite(frac) && srcMs > 0 ? frac * srcMs : 0;
    return {
      x: px,
      y: py,
      logical: chartPt?.logical,
      price: chartPt?.price,
      time: chartPt?.time ?? timeForLogical(chartPt?.logical),
      frac,
      offMs: off,
      tf: interval,
    };
  }, [timeForLogical, fracForLogical, interval]);

  // Effective logical for rendering: time-map hit wins (scroll/pan/append
  // stable), stored logical is the fallback (off-chart sketches).
  //
  // ── Cross-timeframe resolution (TradingView parity) ───────────────────────
  // Drawings are shared across ALL intervals of a symbol. Every anchor stores
  // `offMs` — its exact wall-clock offset in milliseconds from its bar — so a
  // sketch lands on the same wall-clock instant on every timeframe, not just
  // the same session. (The old bar-unit `frac` shifted meaning per interval,
  // which is what made drawings "move" on timeframe switches; it survives
  // only as a legacy fallback for anchors saved before `offMs` existed.)
  const resolvedLogical = useCallback((storedLogical, storedTime, storedFrac, storedOffMs) => {
    const off = Number(storedOffMs);
    const hasOff = Number.isFinite(off) && off !== 0;
    if (storedTime != null && timeIndexMap.has(storedTime)) {
      const idx = timeIndexMap.get(storedTime);
      if (hasOff && timeframeMs > 0) return idx + off / timeframeMs;
      const f = Number(storedFrac);
      return idx + (Number.isFinite(f) ? f : 0);
    }
    const base = canonicalMs(storedTime);
    if (base != null && msIndex.length > 0) {
      // Fold the wall-clock offset in BEFORE the nearest-bar search so the
      // search lands on the bar containing the true instant (e.g. a mid-day
      // anchor from a daily chart lands mid-session on intraday, not at the
      // session open plus a stale offset).
      const target = hasOff ? base + off : base;
      let lo = 0;
      let hi = msIndex.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (msIndex[mid][0] < target) lo = mid + 1;
        else hi = mid;
      }
      let best = lo;
      if (lo > 0 && Math.abs(msIndex[lo - 1][0] - target) <= Math.abs(msIndex[lo][0] - target)) best = lo - 1;
      if (hasOff && timeframeMs > 0) {
        return msIndex[best][1] + (target - msIndex[best][0]) / timeframeMs;
      }
      return msIndex[best][1];
    }
    return storedLogical;
  }, [timeIndexMap, msIndex, timeframeMs]);

  // ── 2. True Magnet Snapping Engine ─────────────────────────────────────────

  const findMagnetSnap = useCallback((x, y) => {
    // 'off' | 'weak' | 'strong' — strong always snaps to the nearest OHLC
    if (magnetMode === 'off' || !candleRef?.current || !chartRef?.current || !candles?.length) {
      return null;
    }

    try {
      const timeScale = chartRef.current.timeScale();
      const logical = timeScale.coordinateToLogical(x);
      if (logical == null) return null;

      const roundedIndex = Math.round(logical);
      const totalCandles = candles.length;
      if (roundedIndex < 0 || roundedIndex >= totalCandles) return null;

      const candle = candles[roundedIndex];
      if (!candle) return null;

      const candleX = timeScale.logicalToCoordinate(roundedIndex);
      if (candleX == null) return null;

      // Weak mode only snaps within the snap radius; strong mode snaps to the nearest bar.
      if (magnetMode !== 'strong' && Math.abs(x - candleX) > MAGNET_SNAP_RADIUS) return null;

      const o = Number(candle.open);
      const h = Number(candle.high);
      const l = Number(candle.low);
      const c = Number(candle.close);

      const oY = candleRef.current.priceToCoordinate(o);
      const hY = candleRef.current.priceToCoordinate(h);
      const lY = candleRef.current.priceToCoordinate(l);
      const cY = candleRef.current.priceToCoordinate(c);

      const candidates = [
        { price: h, y: hY, label: `HIGH ${currSym}${h.toFixed(2)}` },
        { price: l, y: lY, label: `LOW ${currSym}${l.toFixed(2)}` },
        { price: c, y: cY, label: `CLOSE ${currSym}${c.toFixed(2)}` },
        { price: o, y: oY, label: `OPEN ${currSym}${o.toFixed(2)}` },
      ].filter(pt => pt.y != null && !isNaN(pt.y));

      if (!candidates.length) return null;

      let closest = candidates[0];
      let minDist = Math.abs(y - candidates[0].y);
      for (let i = 1; i < candidates.length; i++) {
        const dist = Math.abs(y - candidates[i].y);
        if (dist < minDist) {
          minDist = dist;
          closest = candidates[i];
        }
      }

      // Weak mode requires the cursor to be close to a wick; strong always snaps.
      const yRadius = magnetMode === 'strong' ? Infinity : MAGNET_WEAK_RADIUS;
      if (minDist < yRadius) {
        return {
          x: candleX,
          y: closest.y,
          logical: roundedIndex,
          price: closest.price,
          time: candle.time,
          frac: 0,
          label: closest.label,
        };
      }
    } catch (_) {}

    return null;
  }, [magnetMode, candleRef, chartRef, candles]);

  // ── 3. Buttery viewport sync (pan / zoom / price-scale) ────────────────────
  // Instead of listening only to logical-range events (which miss price-axis
  // zooms and autoscale), a single rAF probe watches the actual projected
  // position of the viewport. Any pixel movement — mouse-wheel zoom, drag pan,
  // kinetic scroll, price-scale drag, autoscale on new ticks, resize — bumps
  // `syncTick` exactly once per frame, so the SVG overlay never lags behind
  // the candles and never re-renders while idle.
  useEffect(() => {
    let rafId = null;
    let dead = false;
    let lastX0 = null;
    let lastXN = null;
    let lastY = null;
    let lastW = null;
    let lastH = null;

    const probe = () => {
      if (dead) return;
      try {
        const chart = chartRef?.current;
        const series = candleRef?.current;
        const n = Array.isArray(candles) ? candles.length : 0;
        if (chart && series && n > 0 && chartReady) {
          const ts = chart.timeScale();
          const x0 = ts.logicalToCoordinate(0);
          const xN = ts.logicalToCoordinate(n - 1);
          const refPrice = Number(candles[n - 1]?.close);
          const y = Number.isFinite(refPrice) ? series.priceToCoordinate(refPrice) : null;
          const host = mainPaneRef?.current || svgRef.current;
          const rect = host?.getBoundingClientRect?.();
          const w = rect ? Math.round(rect.width) : null;
          const h = rect ? Math.round(rect.height) : null;
          const moved =
            x0 !== lastX0 || xN !== lastXN || y !== lastY || w !== lastW || h !== lastH;
          if (moved) {
            lastX0 = x0; lastXN = xN; lastY = y; lastW = w; lastH = h;
            setSyncTick((t) => (t + 1) % 1000000);
          }
        }
      } catch (_) {}
      rafId = requestAnimationFrame(probe);
    };

    rafId = requestAnimationFrame(probe);
    return () => {
      dead = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [chartRef, candleRef, candles, chartReady, mainPaneRef]);

  // Lock / Unlock chart panning during active drawing
  const setChartLocked = useCallback((locked) => {
    if (chartRef?.current) {
      try {
        chartRef.current.applyOptions({
          handleScroll: !locked,
          handleScale: !locked,
        });
      } catch (_) {}
    }
  }, [chartRef]);

  // ── 4. History & Persistence ───────────────────────────────────────────────
  // Drawings are namespaced per symbol and SHARED across all timeframes
  // (TradingView behavior): a trendline drawn on 5m shows on 1d and vice
  // versa, resolved through canonical timestamps (see resolvedLogical).
  // Selection, pending placement and history reset on symbol switch —
  // otherwise a stale selected id could point at another symbol's set.
  const storageKey = useMemo(
    () => `${STORAGE_KEY}_${symbol}`,
    [symbol],
  );

  useEffect(() => {
    let loaded = null;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) loaded = parsed;
      }
    } catch (_) {}
    // One-time merge: fold legacy per-interval keys into the shared key so
    // existing sketches are not lost and appear on every timeframe.
    if (!loaded) {
      const merged = [];
      const seen = new Set();
      for (const iv of LEGACY_INTERVALS) {
        try {
          const raw = localStorage.getItem(`${STORAGE_KEY}_${symbol}_${iv}`);
          if (!raw) continue;
          const arr = JSON.parse(raw);
          if (!Array.isArray(arr)) continue;
          for (const d of arr) {
            const id = d && d.id;
            if (id == null || seen.has(id)) continue;
            seen.add(id);
            merged.push(d);
          }
        } catch (_) {}
      }
      if (merged.length) {
        loaded = merged;
        try {
          localStorage.setItem(storageKey, JSON.stringify(merged));
        } catch (_) {}
      }
    }
    // One-time repair: drop drawings that can NEVER render correctly — no
    // bar identity at all (null logical AND null time, leftovers from older
    // builds). They sit frozen at stale screen pixels and look permanently
    // "broken"/half-drawn. Everything salvageable is kept as-is.
    const repaired = repairDrawings(loaded || []);
    if (repaired.dropped > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(repaired.clean));
      } catch (_) {}
      toast.success(`Purani ${repaired.dropped} tooti drawing saaf ki — ab shapes sahi dikhenge`);
    }
    setDrawings(repaired.clean);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedDrawingId(null);
    setPendingPoints([]);
    setCurrentDraw(null);
    setIsDrawing(false);
    setDraggingHandle(null);
    setDragStartPos(null);
    setHiddenIds(new Set());
    setContextMenu(null);
    setTextEdit(null);
    isDraggingRef.current = false;
  }, [storageKey]);

  const persistDrawings = useCallback((nextDrawings) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextDrawings));
    } catch (_) {}
  }, [storageKey]);

  // One-time migration: drawings saved before time-anchoring only carry
  // logical indices. Backfill `time`/`frac` from the loaded candles so they
  // lock onto bars and stop drifting on scroll. Backfill runs ONLY when the
  // drawing's stamped timeframe matches (or was never stamped) — backfilling
  // from another timeframe's candles would bake the WRONG bar times into
  // storage permanently, which is exactly what made sketches "move" on
  // timeframe switches. The stamp is written on first backfill so later
  // timeframe switches never rewrite it. `offMs` is deliberately NOT
  // fabricated here; legacy bar-unit `frac` keeps those anchors working.
  const migratedForCandlesRef = useRef(null);
  useEffect(() => {
    if (!Array.isArray(candles) || candles.length === 0) return;
    if (migratedForCandlesRef.current === candles) return;
    let needsSave = false;
    const next = drawingsRef.current.map((d) => {
      if (d.tf != null && d.tf !== interval) return d; // another TF's drawing — never touch
      if (Array.isArray(d.points)) {
        let touched = false;
        const pts = d.points.map((pt) => {
          if (pt && pt.time == null && pt.logical != null) {
            touched = true;
            return { ...pt, time: timeForLogical(pt.logical), frac: fracForLogical(pt.logical) };
          }
          return pt;
        });
        if (touched) { needsSave = true; return { ...d, points: pts, tf: d.tf ?? interval }; }
        return d;
      }
      let patch = null;
      if (d.startLogical != null && d.startTime == null) {
        patch = { ...(patch || {}), startTime: timeForLogical(d.startLogical), startFrac: fracForLogical(d.startLogical) };
      }
      if (d.endLogical != null && d.endTime == null) {
        patch = { ...(patch || {}), endTime: timeForLogical(d.endLogical), endFrac: fracForLogical(d.endLogical) };
      }
      if (patch) { needsSave = true; return { ...d, ...patch, tf: d.tf ?? interval }; }
      return d;
    });
    migratedForCandlesRef.current = candles;
    if (needsSave) {
      persistDrawings(next);
      setDrawings(next);
    }
  }, [candles, persistDrawings, timeForLogical, fracForLogical, interval]);

  const saveDrawingsWithHistory = useCallback((nextDrawings, pushToUndo = true) => {
    if (pushToUndo) {
      // Push the live mirror, not the closed-over state, so rapid successive
      // commits (drag → commit → drag) never drop an intermediate state.
      const base = drawingsRef.current;
      setUndoStack(prev => [...prev.slice(-30), base]);
      setRedoStack([]);
    }
    persistDrawings(nextDrawings);
    setDrawings(nextDrawings);
  }, [persistDrawings]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) {
      toast.error('Nothing to undo');
      return;
    }
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, drawingsRef.current]);
    setUndoStack(prev => prev.slice(0, -1));
    persistDrawings(previous);
    setDrawings(previous);
    toast.success('Undo drawing change');
  }, [undoStack, persistDrawings]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) {
      toast.error('Nothing to redo');
      return;
    }
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, drawingsRef.current]);
    setRedoStack(prev => prev.slice(0, -1));
    persistDrawings(next);
    setDrawings(next);
    toast.success('Redo drawing change');
  }, [redoStack, persistDrawings]);

  // Global Keyboard Shortcuts — undo/redo only here (delete / duplicate /
  // placement keys live in the later effect, after those handlers are defined,
  // so this effect never closes over not-yet-initialized consts).
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Helper for mouse/touch position.
  // NOTE: `touchend` carries no `touches` — coordinates live in
  // `changedTouches`. Without this fallback every touch release resolved to
  // NaN and the commit was silently discarded (nothing ever got placed).
  const pickTouch = (e) => {
    if (e?.touches && e.touches.length > 0) return e.touches[0];
    if (e?.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0];
    return null;
  };
  const getEventPos = (e) => {
    const rect = svgRef.current?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect();
    const t = pickTouch(e);
    const clientX = t ? t.clientX : e.clientX;
    const clientY = t ? t.clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      clientX,
      clientY,
    };
  };

  // ── Extended (TradingView tool-set) anchors ────────────────────────────────
  /** Default annotation text so callouts/notes/flags are never empty on creation. */
  const EXTENDED_DEFAULT_TEXT = {
    callout: 'Callout',
    note: 'Note',
    price_label: 'Price',
    price_note: 'Price',
    flag: 'Event',
    pin: 'Pin',
  };

  const buildExtendedDrawing = useCallback((type, anchors) => ({
    id: Date.now(),
    type,
    points: anchors.map((anchor) => ({ ...anchor })),
    color: activeColor,
    strokeWidth: activeStrokeWidth,
    lineStyle: activeLineStyle,
    text: EXTENDED_DEFAULT_TEXT[type] || '',
    tf: interval,
  }), [activeColor, activeStrokeWidth, activeLineStyle, interval]);

  /** True for cursor-only modes that never create drawings (cross/dot). */
  const isCursorMode = useCallback((toolId) => {
    const spec = getToolSpec(toolId);
    return Boolean(spec?.kind) || CURSOR_TOOLS.includes(toolId) || toolId === 'cross' || toolId === 'dot';
  }, []);

  /** True when the toolbar plus chart refs are usable for crosshair-mode moves. */
  const cursorsActive = CURSOR_TOOLS.includes(activeTool);

  /**
   * Shared drag entry — every selectable shape (legacy JSX or registry) funnels
   * through here so preventDefault / snapshot / lock behaviour cannot diverge.
   * Selection is always applied (even when locked) so the object tree and
   * floating toolbar stay usable; only the drag itself is gated by the lock.
   */
  const beginDrag = useCallback((e, drawingId, handle) => {
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();
    // Left-button / touch drags only — right-click is reserved for the menu.
    const isTouchDrag = Boolean(e?.touches && e.touches.length);
    if (!isTouchDrag && e?.button != null && e.button !== 0) return false;
    setSelectedDrawingId(drawingId);
    if (lockAllDrawings) return false;
    // Per-drawing lock (TradingView): locked objects stay selectable so the
    // toolbar/settings remain usable, but anchors cannot move.
    if (drawingsRef.current.find((d) => d.id === drawingId)?.locked) return false;
    dragSnapshotRef.current = drawingsRef.current;
    bodyGestureRef.current = null; // fresh origin captured on first move frame
    setDraggingHandle(handle);
    const downTouch = pickTouch(e);
    const clientX = downTouch ? downTouch.clientX : (e?.clientX ?? 0);
    const clientY = downTouch ? downTouch.clientY : (e?.clientY ?? 0);
    // Store the gesture origin in SVG space (processMove works in SVG coords —
    // mixing client coords here broke per-frame deltas like channel width).
    let originX = clientX;
    let originY = clientY;
    try {
      const r = svgRef.current?.getBoundingClientRect();
      if (r) {
        originX = clientX - r.left;
        originY = clientY - r.top;
      }
    } catch (_) {}
    setDragStartPos({ x: originX, y: originY });
    upHandledRef.current = false;
    dragMovedRef.current = false;
    setChartLocked(true);
    return true;
  }, [lockAllDrawings, setChartLocked]);

  /** Begins a body move for any selectable drawing (legacy or registry-shaped). */
  const startBodyDrag = useCallback((e, drawingId) => {
    beginDrag(e, drawingId, 'body');
  }, [beginDrag]);

  /** Begins dragging one anchor handle (`point:<index>`) of a registry drawing. */
  const startPointDrag = useCallback((e, drawingId, index) => {
    beginDrag(e, drawingId, `point:${index}`);
  }, [beginDrag]);

  /**
   * Legacy JSX entry point — same snapshot/lock path as the registry, but keeps
   * the historic `start` / `end` / `target` / `stop` / `channel` handle names so
   * the move handler below keeps working unchanged.
   */
  const beginLegacyDrag = useCallback((e, drawingId, handle) => {
    beginDrag(e, drawingId, handle);
  }, [beginDrag]);

  /** True for freehand stroke tools that grow while the pointer moves. */
  const isFreehandType = useCallback((type) => type === 'brush' || type === 'highlighter', []);

  /** Adds a finished extended drawing to history and clears the placement state. */
  const commitExtendedDrawing = useCallback((type, anchors) => {
    if (!anchors?.length) return;
    const drawing = buildExtendedDrawing(type, anchors);
    saveDrawingsWithHistory([...drawingsRef.current, drawing], true);
    setSelectedDrawingId(drawing.id);
    setPendingPoints([]);
    setCurrentDraw(null);
    setIsDrawing(false);
    isDraggingRef.current = false;
    setChartLocked(false);
    if (!stayInDrawMode) setActiveTool(DEFAULT_TOOL);
  }, [buildExtendedDrawing, saveDrawingsWithHistory, stayInDrawMode, setChartLocked, setActiveTool]);

  /** Abandons an in-progress placement (Escape / tool switch / symbol change). */
  const cancelPlacement = useCallback(() => {
    setPendingPoints([]);
    setCurrentDraw(null);
    setIsDrawing(false);
    isDraggingRef.current = false;
    setChartLocked(false);
  }, [setChartLocked]);

  // ── Render-path coordinate cache ─────────────────────────────────────────
  // The saved-drawings layer recomputes screen coords on every render — including
  // renders caused only by the in-progress stroke. This cache makes those
  // recomputes cheap: entries are keyed by data args and stay valid while the
  // viewport tick and candle set are unchanged. (Live drag math keeps using the
  // uncached converter — transient positions must never be served stale.)
  // Time identity participates in the key so bar-locked anchors resolve stably.
  if (!coordCacheRef.current || coordCacheRef.current.tick !== syncTick || coordCacheRef.current.candles !== candles) {
    coordCacheRef.current = { tick: syncTick, candles, map: new Map() };
  }
  const chartToCoordCached = (logical, price, fallbackX, fallbackY, time, frac, offMs) => {
    const effLogical = resolvedLogical(logical, time, frac, offMs);
    const cache = coordCacheRef.current;
    const key = `${effLogical}|${price}|${fallbackX}|${fallbackY}`;
    let hit = cache.map.get(key);
    if (hit === undefined) {
      hit = chartToCoord(effLogical, price, fallbackX, fallbackY);
      if (cache.map.size < 3000) cache.map.set(key, hit);
    }
    return hit;
  };
  const resolveAnchorsCached = (drawing) => {
    if (Array.isArray(drawing.points)) {
      return drawing.points.map((point) => {
        const { x, y } = chartToCoordCached(point.logical, point.price, point.x, point.y, point.time, point.frac, point.offMs);
        return { x, y, logical: resolvedLogical(point.logical, point.time, point.frac, point.offMs), price: point.price };
      });
    }
    const start = chartToCoordCached(drawing.startLogical, drawing.startPrice, drawing.startX, drawing.startY, drawing.startTime, drawing.startFrac, drawing.startOffMs);
    const end = chartToCoordCached(drawing.endLogical, drawing.endPrice, drawing.endX, drawing.endY, drawing.endTime, drawing.endFrac, drawing.endOffMs);
    return [
      { x: start.x, y: start.y, logical: resolvedLogical(drawing.startLogical, drawing.startTime, drawing.startFrac, drawing.startOffMs), price: drawing.startPrice },
      { x: end.x, y: end.y, logical: resolvedLogical(drawing.endLogical, drawing.endTime, drawing.endFrac, drawing.endOffMs), price: drawing.endPrice },
    ];
  };

  /** logical → pixel x, used by the Fib time-zone renderer. */
  const logicalToX = useCallback((logical) => {
    if (logical == null || !chartRef?.current) return null;
    try {
      return chartRef.current.timeScale().logicalToCoordinate(logical);
    } catch (_) {
      return null;
    }
  }, [chartRef]);

  /** price → pixel y, used by regression trend and extended shape renderers. */
  const priceToY = useCallback((price) => {
    if (price == null || !candleRef?.current) return null;
    try {
      return candleRef.current.priceToCoordinate(Number(price)) ?? null;
    } catch (_) {
      return null;
    }
  }, [candleRef]);

  // Pane-locked overlay geometry: the SVG is sized to the main price pane
  // (not the whole terminal column), so its pixel space matches
  // logicalToCoordinate / priceToCoordinate 1:1 on every scroll/zoom frame.
  // Falls back to measuring the SVG itself when the pane ref isn't wired yet.
  const [paneHeight, setPaneHeight] = useState(null);
  useEffect(() => {
    const target = mainPaneRef?.current || svgRef.current;
    if (!target) return undefined;
    const measure = () => {
      const rect = target.getBoundingClientRect();
      setSurfaceSize({ width: rect.width, height: rect.height });
      if (mainPaneRef?.current) setPaneHeight(rect.height);
      else setPaneHeight(null);
      // Keep the move-handler's cached layout rect fresh on resize/reopen.
      try {
        const svgRect = svgRef.current?.getBoundingClientRect();
        const base = svgRect || rect;
        svgRectRef.current = {
          left: base.left, top: base.top,
          width: base.width, height: base.height,
          measuredAt: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
        };
      } catch (_) {}
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(target);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isOpen, hideAllDrawings, chartReady, mainPaneRef]);

  /** Inline text editing for annotation tools (callout / note / price label / flag / pin). */
  const TEXT_EDITABLE_TYPES = new Set(['callout', 'note', 'price_label', 'price_note', 'flag', 'pin', 'text']);

  const beginTextEdit = useCallback((drawing) => {
    if (!drawing) return;
    setTextEdit({ id: drawing.id });
    setTextEditVal(drawing.text || '');
    setSelectedDrawingId(drawing.id);
  }, []);

  const commitTextEdit = useCallback(() => {
    if (!textEdit) return;
    const value = textEditVal.trim();
    if (value) {
      saveDrawingsWithHistory(
        drawingsRef.current.map((d) => (d.id === textEdit.id ? { ...d, text: value } : d)),
        true,
      );
      toast.success('Text updated');
    }
    setTextEdit(null);
    setTextEditVal('');
  }, [textEdit, textEditVal, saveDrawingsWithHistory]);

  const handleShapeDoubleClick = useCallback((event, drawing) => {
    if (event?.stopPropagation) event.stopPropagation();
    if (event?.preventDefault) event.preventDefault();
    if (drawing && TEXT_EDITABLE_TYPES.has(drawing.type)) {
      beginTextEdit(drawing);
    } else {
      setSelectedDrawingId(drawing?.id ?? null);
    }
  }, [beginTextEdit]);

  // ── 5. Mouse & Touch Drawing Handlers ──────────────────────────────────────

  const handleSvgMouseDown = (e) => {
    // TradingView parity: only the left button (or touch) starts drawings and
    // drags. Right/middle clicks must reach the context menu instead.
    if (e && e.type && e.type.indexOf('mouse') === 0 && e.button !== 0) return;
    upHandledRef.current = false; // new gesture — the next mouse-up may commit
    if (lockAllDrawings && !isCursorMode(activeTool)) {
      toast.error('Drawings are locked. Unlock to draw.');
      return;
    }

    // Fresh layout rect for the gesture + drop any queued hover move so the
    // first RAF flush of the new gesture can't act on pre-down coordinates.
    try {
      const fresh = svgRef.current?.getBoundingClientRect();
      if (fresh) {
        svgRectRef.current = {
          left: fresh.left, top: fresh.top,
          width: fresh.width, height: fresh.height,
          measuredAt: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
        };
      }
    } catch (_) {}
    if (moveRafRef.current != null) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
      pendingMoveRef.current = null;
    }

    const { x, y } = getEventPos(e);
    const snap = findMagnetSnap(x, y);
    const finalX = snap ? snap.x : x;
    const finalY = snap ? snap.y : y;
    const chartPt = snap
      ? { logical: snap.logical, price: snap.price, time: snap.time, frac: snap.frac ?? 0 }
      : coordToChart(finalX, finalY);
    const chartAnchor = toAnchor(finalX, finalY, chartPt);

    if (isCursorMode(activeTool)) {
      if (selectedDrawingId && !draggingHandle) {
        setSelectedDrawingId(null);
      }
      return;
    }

    // No candles yet (loading / switching symbol): anchors would carry null
    // logical+time and freeze at screen pixels forever, looking "moved" on
    // every timeframe switch. Refuse instead of saving a broken drawing.
    if (!chartReady || !Array.isArray(candles) || candles.length === 0) {
      toast.error('Chart abhi load ho raha hai — candles aane ke baad draw karo');
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setChartLocked(true);

    // Instant click placement tools
    if (activeTool === 'text') {
      setTextInputPos({ x: finalX, y: finalY, logical: chartPt.logical, price: chartPt.price, time: chartAnchor.time, frac: chartAnchor.frac, offMs: chartAnchor.offMs, tf: chartAnchor.tf });
      setTextInputVal('');
      return;
    }

    if (activeTool === 'smile') {
      setStickerPos({ x: finalX, y: finalY, logical: chartPt.logical, price: chartPt.price, time: chartAnchor.time, frac: chartAnchor.frac, offMs: chartAnchor.offMs, tf: chartAnchor.tf });
      setShowStickerMenu(true);
      return;
    }

    if (activeTool === 'horizontal_line') {
      const hLine = {
        id: Date.now(),
        type: 'horizontal_line',
        startLogical: chartPt.logical,
        startPrice: chartPt.price,
        startTime: chartAnchor.time,
        startFrac: chartAnchor.frac,
        startOffMs: chartAnchor.offMs,
        tf: interval,
        startX: finalX,
        startY: finalY,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
        lineStyle: activeLineStyle,
      };
      saveDrawingsWithHistory([...drawingsRef.current, hLine]);
      setSelectedDrawingId(hLine.id);
      setChartLocked(false);
      if (!stayInDrawMode) setActiveTool(DEFAULT_TOOL);
      toast.success(`Support/Resistance Line at ${currSym}${chartPt.price?.toFixed(2)}`);
      return;
    }

    if (activeTool === 'horizontal_ray') {
      const hRay = {
        id: Date.now(),
        type: 'horizontal_ray',
        startLogical: chartPt.logical,
        startPrice: chartPt.price,
        startTime: chartAnchor.time,
        startFrac: chartAnchor.frac,
        startOffMs: chartAnchor.offMs,
        tf: interval,
        startX: finalX,
        startY: finalY,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
        lineStyle: activeLineStyle,
      };
      saveDrawingsWithHistory([...drawingsRef.current, hRay]);
      setSelectedDrawingId(hRay.id);
      setChartLocked(false);
      if (!stayInDrawMode) setActiveTool(DEFAULT_TOOL);
      toast.success(`Horizontal Ray placed at ${currSym}${chartPt.price?.toFixed(2)}`);
      return;
    }

    // ── Extended TradingView tool set ──
    const spec = getToolSpec(activeTool);
    if (spec && !spec.legacy && !spec.kind) {
      const anchor = { ...chartAnchor };

      // 1 anchor → placed immediately (vertical line, note, flag, price label…)
      if (spec.points === 1) {
        commitExtendedDrawing(activeTool, [anchor]);
        toast.success(`${spec.label} placed`);
        return;
      }

      // Polyline is click-to-place (each click adds a vertex, double-click /
      // Enter finishes) — not a freehand drag, even though the catalog marks
      // it `points: 'free'` for renderer grouping.
      if (activeTool === 'polyline') {
        const next = [...pendingPoints, anchor];
        setPendingPoints(next);
        setCurrentDraw({
          id: currentDraw?.id || Date.now(),
          type: activeTool,
          points: [...next],
          pending: true,
          polyline: true,
          color: activeColor,
          strokeWidth: activeStrokeWidth,
          lineStyle: activeLineStyle,
        });
        setIsDrawing(true);
        isDraggingRef.current = true;
        return;
      }

      // Freehand tools (highlighter) collect a stroke like the brush
      if (spec.points === 'free') {
        setPendingPoints([]);
        setIsDrawing(true);
        isDraggingRef.current = true;
        setCurrentDraw({
          id: Date.now(),
          type: activeTool,
          points: [anchor],
          color: activeColor,
          strokeWidth: activeStrokeWidth,
          lineStyle: activeLineStyle,
        });
        return;
      }

      // 3+ anchor tools are click-to-place: each click drops an anchor
      if (spec.points >= 3) {
        const next = [...pendingPoints, anchor];
        if (next.length >= spec.points) {
          commitExtendedDrawing(activeTool, next);
          toast.success(`${spec.label} completed`);
        } else {
          setPendingPoints(next);
          setCurrentDraw({
            id: Date.now(),
            type: activeTool,
            points: [...next],
            pending: true,
            color: activeColor,
            strokeWidth: activeStrokeWidth,
            lineStyle: activeLineStyle,
          });
          setIsDrawing(true);
          isDraggingRef.current = true;
          toast.success(`${spec.label}: place anchor ${next.length + 1} of ${spec.points}`);
        }
        return;
      }

      // 2-anchor extended tools use a points-based click-drag flow (not the
      // legacy start/end shape). Storing the pair as `points` from the start
      // means the move/up handlers and the registry preview all share one
      // code path — no fragile start/end → points conversion on commit.
      if (spec.points === 2) {
        setPendingPoints([]);
        setIsDrawing(true);
        isDraggingRef.current = true;
        setCurrentDraw({
          id: Date.now(),
          type: activeTool,
          points: [anchor, { ...anchor }],
          dragAnchor: true,
          color: activeColor,
          strokeWidth: activeStrokeWidth,
          lineStyle: activeLineStyle,
        });
        return;
      }

      setPendingPoints([]);
    }

    // Drag-based tools initialization
    setIsDrawing(true);
    isDraggingRef.current = true;

    if (activeTool === 'brush') {
      setCurrentDraw({
        id: Date.now(),
        type: 'brush',
        points: [{ ...chartAnchor }],
        color: activeColor,
        strokeWidth: activeStrokeWidth,
      });
    } else if (activeTool === 'long_position' || activeTool === 'short_position') {
      const isLong = activeTool === 'long_position';
      const entryPrice = chartPt.price || 1000;
      const targetDelta = entryPrice * 0.03; // 3% default target
      const stopDelta   = entryPrice * 0.015; // 1.5% default stop

      const targetPrice = isLong ? entryPrice + targetDelta : entryPrice - targetDelta;
      const stopPrice   = isLong ? entryPrice - stopDelta   : entryPrice + stopDelta;

      const posDrawing = {
        id: Date.now(),
        type: activeTool,
        startX: finalX,
        startY: finalY,
        startLogical: chartPt.logical,
        startPrice: entryPrice,
        startTime: chartAnchor.time,
        startFrac: chartAnchor.frac,
        startOffMs: chartAnchor.offMs,
        tf: interval,
        endX: finalX + 180,
        endY: finalY,
        endLogical: chartPt.logical != null ? chartPt.logical + 15 : null,
        endTime: chartPt.logical != null ? timeForLogical(chartPt.logical + 15) : undefined,
        endFrac: chartPt.logical != null ? fracForLogical(chartPt.logical + 15) : 0,
        endOffMs: chartPt.logical != null ? fracForLogical(chartPt.logical + 15) * intervalToMs(interval) : 0,
        targetPrice,
        stopPrice,
        color: isLong ? '#10B981' : '#EF5350',
      };
      saveDrawingsWithHistory([...drawingsRef.current, posDrawing]);
      setSelectedDrawingId(posDrawing.id);
      setIsDrawing(false);
      isDraggingRef.current = false;
      setChartLocked(false);
      if (!stayInDrawMode) setActiveTool(DEFAULT_TOOL);
      toast.success(`${isLong ? 'Long' : 'Short'} Position Risk:Reward Tool placed`);
    } else {
      setCurrentDraw({
        id: Date.now(),
        type: activeTool,
        startX: finalX,
        startY: finalY,
        startLogical: chartPt.logical,
        startPrice: chartPt.price,
        startTime: chartAnchor.time,
        startFrac: chartAnchor.frac,
        startOffMs: chartAnchor.offMs,
        tf: interval,
        endX: finalX,
        endY: finalY,
        endLogical: chartPt.logical,
        endPrice: chartPt.price,
        endTime: chartAnchor.time,
        endFrac: chartAnchor.frac,
        endOffMs: chartAnchor.offMs,
        channelWidth: 35,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
        lineStyle: activeLineStyle,
      });
    }
  };

  // RAF-coalesced move processing: runs at most once per frame. Reads interaction
  // state from moveStateRef (always fresh) and uses only functional setState
  // updates, so collapsing N events into one never loses correctness.
  const processMove = useCallback((clientX, clientY) => {
    const st = moveStateRef.current || {};
    const {
      draggingHandle: mh,
      selectedDrawingId: mid,
      dragStartPos: mpos,
      lockAllDrawings: mlock,
      isDrawing: misDrawing,
      currentDraw: mdraw,
      pendingPoints: mpending,
    } = st;
    // Cached layout rect (refreshed on mousedown / resize / 1s staleness) —
    // avoids a forced reflow on every move event.
    let rect = svgRectRef.current;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (!rect || (now - rect.measuredAt) > 1000) {
      const fresh = svgRef.current?.getBoundingClientRect();
      if (!fresh) return;
      rect = { left: fresh.left, top: fresh.top, width: fresh.width, height: fresh.height, measuredAt: now };
      svgRectRef.current = rect;
    }
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const snap = findMagnetSnap(x, y);
    // Change-guarded: hovering must not re-render 100×/s on an identical snap.
    setSnapIndicator((prev) => {
      if (snap === prev) return prev;
      if (!snap || !prev) return snap;
      return (snap.x === prev.x && snap.y === prev.y && snap.label === prev.label) ? prev : snap;
    });

    const finalX = snap ? snap.x : x;
    const finalY = snap ? snap.y : y;
    const chartPt = snap
      ? { logical: snap.logical, price: snap.price, time: snap.time, frac: snap.frac ?? 0 }
      : coordToChart(finalX, finalY);
    const moveTime = snap?.time ?? timeForLogical(chartPt.logical);
    const moveFrac = snap?.frac ?? fracForLogical(chartPt.logical);
    const moveOffMs = Number.isFinite(moveFrac) && timeframeMs > 0 ? moveFrac * timeframeMs : 0;

    // ── Handle dragging existing item ──
    if (mh && mid && mpos && !mlock) {
      // Rectangle corners (`rect:0..3` = TL,TR,BL,BR): the grabbed corner
      // follows the cursor while the OPPOSITE corner stays fixed — a true box
      // resize. Anchors are renormalised to (top-left, bottom-right) every
      // frame so the box never flips or shears.
      if (typeof mh === 'string' && mh.startsWith('rect:')) {
        const index = Number(mh.slice(5));
        const OPP = [3, 2, 1, 0];
        const o = OPP[index] ?? 3;
        bodyGestureRef.current = null;
        dragMovedRef.current = true;
        setDrawings((prev) =>
          prev.map((d) => {
            if (d.id !== mid) return d;
            const sL = d.startLogical;
            const sP = d.startPrice;
            const eL = d.endLogical;
            const eP = d.endPrice;
            if (sL == null || eL == null || sP == null || eP == null) return d;
            if (chartPt.logical == null || chartPt.price == null) return d;
            const loL = Math.min(sL, eL);
            const hiL = Math.max(sL, eL);
            const loP = Math.min(sP, eP);
            const hiP = Math.max(sP, eP);
            const cornerL = [loL, hiL, loL, hiL];
            const cornerP = [hiP, hiP, loP, loP];
            const oL = cornerL[o];
            const oP = cornerP[o];
            const nL = chartPt.logical;
            const nP = chartPt.price;
            const nLoL = Math.min(oL, nL);
            const nHiL = Math.max(oL, nL);
            const nLoP = Math.min(oP, nP);
            const nHiP = Math.max(oP, nP);
            // Wall-clock identity follows the logical (time) axis: whichever
            // side owns the edge logical owns the anchor time.
            const rOL = Math.round(oL);
            const oTime = timeForLogical(rOL) ?? null;
            const oFrac = oL - rOL;
            const oOff = timeframeMs > 0 ? oFrac * timeframeMs : 0;
            const sFromO = nLoL === oL;
            const eFromO = nHiL === oL;
            const pS = chartToCoord(nLoL, nHiP, d.startX, d.startY);
            const pE = chartToCoord(nHiL, nLoP, d.endX, d.endY);
            return {
              ...d,
              startX: pS.x,
              startY: pS.y,
              startLogical: nLoL,
              startPrice: nHiP,
              startTime: sFromO ? oTime : moveTime,
              startFrac: sFromO ? oFrac : moveFrac,
              startOffMs: sFromO ? oOff : moveOffMs,
              endX: pE.x,
              endY: pE.y,
              endLogical: nHiL,
              endPrice: nLoP,
              endTime: eFromO ? oTime : moveTime,
              endFrac: eFromO ? oFrac : moveFrac,
              endOffMs: eFromO ? oOff : moveOffMs,
              tf: d.tf ?? interval,
            };
          })
        );
        setDragStartPos({ x: finalX, y: finalY });
        return;
      }
      // Handle/end/point drags pin directly to the cursor (time-anchored).
      if (mh === 'start' || mh === 'end' || mh === 'target' || mh === 'stop' ||
          (typeof mh === 'string' && mh.startsWith('point:'))) {
        bodyGestureRef.current = null;
        dragMovedRef.current = true;
        setDrawings((prev) =>
          prev.map((d) => {
            if (d.id !== mid) return d;
            if (mh === 'start') {
              return {
                ...d,
                startX: finalX,
                startY: finalY,
                startLogical: chartPt.logical,
                startPrice: chartPt.price,
                startTime: moveTime,
                startFrac: moveFrac,
                startOffMs: moveOffMs,
              };
            }
            if (mh === 'end') {
              return {
                ...d,
                endX: finalX,
                endY: finalY,
                endLogical: chartPt.logical,
                endPrice: chartPt.price,
                endTime: moveTime,
                endFrac: moveFrac,
                endOffMs: moveOffMs,
              };
            }
            if (mh === 'target') {
              return { ...d, targetPrice: chartPt.price };
            }
            if (mh === 'stop') {
              return { ...d, stopPrice: chartPt.price };
            }
            // Extended shapes: drag an individual anchor handle ("point:2")
            if (typeof mh === 'string' && mh.startsWith('point:')) {
              const index = Number(mh.slice(6));
              const nextPoints = Array.isArray(d.points) ? d.points.slice() : [];
              nextPoints[index] = { x: finalX, y: finalY, logical: chartPt.logical, price: chartPt.price, time: moveTime, frac: moveFrac, offMs: moveOffMs, tf: interval };
              return { ...d, points: nextPoints };
            }
            return d;
          })
        );
        setDragStartPos({ x: finalX, y: finalY });
        return;
      }
      if (mh === 'channel') {
        bodyGestureRef.current = null;
        dragMovedRef.current = true;
        // Width = perpendicular distance from the cursor to the pre-drag
        // median line (TradingView: grab the rail and pull). Resolved from the
        // snapshot so fast drags never accumulate drift.
        let nextWidth = 35;
        try {
          const snapshot = dragSnapshotRef.current || drawingsRef.current;
          const origin = snapshot.find((d) => d.id === mid);
          const A = chartToCoord(origin?.startLogical, origin?.startPrice, origin?.startX, origin?.startY);
          const B = chartToCoord(origin?.endLogical, origin?.endPrice, origin?.endX, origin?.endY);
          const mdx = (B?.x ?? 0) - (A?.x ?? 0);
          const mdy = (B?.y ?? 0) - (A?.y ?? 0);
          const len = Math.hypot(mdx, mdy);
          if (len > 0.001 && A && B) {
            nextWidth = Math.abs(((finalX - A.x) * -mdy + (finalY - A.y) * mdx) / len);
          } else if (A) {
            nextWidth = Math.abs(finalY - A.y);
          }
        } catch (_) {}
        nextWidth = Math.max(10, nextWidth);
        setDrawings((prev) =>
          prev.map((d) => (d.id === mid ? { ...d, channelWidth: nextWidth } : d))
        );
        return;
      }
      if (mh === 'body') {
        // Data-space move: total delta from gesture origin applied to the
        // pre-drag snapshot. Bars stay glued even across long / fast drags.
        const snapshot = dragSnapshotRef.current || drawingsRef.current;
        const originDrawing = snapshot.find((d) => d.id === mid);
        if (!originDrawing) {
          setDragStartPos({ x: finalX, y: finalY });
          return;
        }
        dragMovedRef.current = true;
        let gesture = bodyGestureRef.current;
        if (!gesture || gesture.drawingId !== mid) {
          gesture = {
            drawingId: mid,
            originLogical: chartPt.logical,
            originPrice: chartPt.price,
            originX: finalX,
            originY: finalY,
          };
          bodyGestureRef.current = gesture;
        }
        const dLogical = (chartPt.logical ?? gesture.originLogical ?? 0) - (gesture.originLogical ?? 0);
        const dPrice = (chartPt.price ?? gesture.originPrice ?? 0) - (gesture.originPrice ?? 0);
        const dPixX = finalX - gesture.originX;
        const dPixY = finalY - gesture.originY;

        const shiftAnchor = (logical, price, time, frac, offMs, fx, fy) => {
          if (logical == null && fx == null) return { logical, price, time, frac, offMs, x: fx, y: fy };
          const baseLogical = logical ?? gesture.originLogical;
          const basePrice = price ?? gesture.originPrice;
          const nextLogical = baseLogical != null && Number.isFinite(dLogical) ? baseLogical + dLogical : baseLogical;
          const nextPrice = basePrice != null && Number.isFinite(dPrice) ? basePrice + dPrice : basePrice;
          // Time follows the shifted logical. Past the first/last bar the
          // time is left null on purpose so resolution falls back to the
          // extrapolated logical — sticking to the OLD bar time would freeze
          // that anchor and stretch the shape toward the drag direction.
          const resolvedTime = nextLogical != null ? (timeForLogical(nextLogical) ?? null) : time;
          const nextFrac = nextLogical != null ? fracForLogical(nextLogical) : (frac ?? 0);
          // offMs is re-derived from the new frac (frac × current bar size).
          // Carrying the stale value double-counts the sub-bar offset and
          // shears the shape a little more on every move.
          const nextOff = nextLogical != null && timeframeMs > 0 ? nextFrac * timeframeMs : 0;
          const proj = (nextLogical != null && nextPrice != null)
            ? chartToCoord(nextLogical, nextPrice, (fx ?? 0) + dPixX, (fy ?? 0) + dPixY)
            : { x: (fx ?? 0) + dPixX, y: (fy ?? 0) + dPixY };
          return { logical: nextLogical, price: nextPrice, time: resolvedTime, frac: nextFrac, offMs: nextOff, x: proj.x, y: proj.y };
        };

        setDrawings((prev) =>
          prev.map((d) => {
            if (d.id !== mid) return d;
            // Any anchor list (brush, highlighter, polyline, patterns) moves as a unit
            if (Array.isArray(originDrawing.points) && originDrawing.points.length) {
              return {
                ...d,
                points: originDrawing.points.map((pt) => {
                  const s = shiftAnchor(pt.logical, pt.price, pt.time, pt.frac, pt.offMs, pt.x, pt.y);
                  return { x: s.x, y: s.y, logical: s.logical, price: s.price, time: s.time, frac: s.frac, offMs: s.offMs, tf: pt.tf ?? interval };
                }),
              };
            }
            if (originDrawing.startLogical != null || originDrawing.startX != null) {
              const s = shiftAnchor(originDrawing.startLogical, originDrawing.startPrice, originDrawing.startTime, originDrawing.startFrac, originDrawing.startOffMs, originDrawing.startX, originDrawing.startY);
              const ePt = shiftAnchor(originDrawing.endLogical, originDrawing.endPrice, originDrawing.endTime, originDrawing.endFrac, originDrawing.endOffMs, originDrawing.endX, originDrawing.endY);
              return {
                ...d,
                startX: s.x,
                startY: s.y,
                startLogical: s.logical,
                startPrice: s.price,
                startTime: s.time,
                startFrac: s.frac,
                startOffMs: s.offMs,
                endX: ePt.x,
                endY: ePt.y,
                endLogical: ePt.logical,
                endPrice: ePt.price,
                endTime: ePt.time,
                endFrac: ePt.frac,
                endOffMs: ePt.offMs,
                targetPrice: d.targetPrice != null && Number.isFinite(dPrice) ? originDrawing.targetPrice + dPrice : d.targetPrice,
                stopPrice: d.stopPrice != null && Number.isFinite(dPrice) ? originDrawing.stopPrice + dPrice : d.stopPrice,
              };
            }
            return d;
          })
        );
        return;
      }
      return;
    }

    // ── Active drawing in progress ──
    if (!misDrawing || !mdraw) return;
    const cursorAnchor = toAnchor(finalX, finalY, { logical: chartPt.logical, price: chartPt.price, time: moveTime, frac: moveFrac });

    // Click-to-place preview: preview follows the cursor after the placed anchors
    if (mdraw.pending) {
      setCurrentDraw((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          points: [...mpending, { ...cursorAnchor }],
        };
      });
      return;
    }

    // 2-anchor extended drag: move the second anchor (never append — the pair
    // stays exactly [start, cursor] so commit is a straight pass-through).
    if (mdraw.dragAnchor && Array.isArray(mdraw.points)) {
      const cursor = { ...cursorAnchor };
      setCurrentDraw((prev) => {
        if (!prev || !Array.isArray(prev.points)) return prev;
        const first = prev.points[0];
        // Skip sub-pixel jitter so hovering still doesn't re-render the layer.
        if (first && Math.abs(cursor.x - first.x) < 1 && Math.abs(cursor.y - first.y) < 1) return prev;
        return { ...prev, points: [first, cursor] };
      });
      return;
    }

    // Freehand strokes (brush / highlighter) grow while the pointer moves.
    // A 3px min-distance stops point-per-event explosion (the old code appended
    // on every mousemove event, ballooning the array and re-rendering the whole
    // layer each time); long strokes are decimated so arrays stay bounded.
    if (isFreehandType(mdraw.type) && Array.isArray(mdraw.points)) {
      const cursor = { ...cursorAnchor };
      setCurrentDraw((prev) => {
        if (!prev) return prev;
        const pts = prev.points || [];
        const last = pts[pts.length - 1];
        if (last) {
          const dx = cursor.x - last.x;
          const dy = cursor.y - last.y;
          if (dx * dx + dy * dy < 9) return prev;
        }
        let next = [...pts, cursor];
        if (next.length > 1200) next = next.filter((_, i) => i % 2 === 0 || i === next.length - 1);
        return { ...prev, points: next };
      });
      return;
    }

    // Any other points-based in-progress shape: spec decides update vs append
    // so a 2-anchor tool can never silently become a freehand stroke.
    if (Array.isArray(mdraw.points)) {
      const drawSpec = getToolSpec(mdraw.type);
      if (drawSpec && drawSpec.points === 2) {
        const cursor = { ...cursorAnchor };
        setCurrentDraw((prev) => {
          const base = Array.isArray(prev.points) && prev.points.length ? prev.points : [cursor];
          return { ...prev, points: [base[0], cursor] };
        });
      } else {
        setCurrentDraw((prev) => ({
          ...prev,
          points: [...(prev.points || []), { ...cursorAnchor }],
        }));
      }
    } else {
      setCurrentDraw((prev) => {
        if (!prev) return prev;
        // Skip no-op updates (e.g. coalesced duplicate frame) entirely.
        if (prev.endX === finalX && prev.endY === finalY) return prev;
        return {
          ...prev,
          endX: finalX,
          endY: finalY,
          endLogical: chartPt.logical,
          endPrice: chartPt.price,
          endTime: moveTime,
          endFrac: moveFrac,
          endOffMs: moveOffMs,
        };
      });
    }
  }, [findMagnetSnap, coordToChart, chartToCoord, resolvedLogical, timeForLogical, fracForLogical, timeIndexMap, isFreehandType, timeframeMs, interval, toAnchor]);

  // Thin event wrapper: capture coordinates synchronously, defer all work to
  // one RAF flush per frame. preventDefault runs here (touch listeners are
  // passive, so it must not wait for the async flush).
  const flushPendingMove = useCallback(() => {
    moveRafRef.current = null;
    const m = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (m) processMove(m.clientX, m.clientY);
  }, [processMove]);

  const handleSvgMouseMove = (e) => {
    try { e.preventDefault(); } catch (_) {}
    const t = pickTouch(e);
    pendingMoveRef.current = {
      clientX: t ? t.clientX : e.clientX,
      clientY: t ? t.clientY : e.clientY,
    };
    if (moveRafRef.current == null) {
      moveRafRef.current = requestAnimationFrame(flushPendingMove);
    }
  };

  // Synchronously run a queued move (used by mouse-up so the commit sees the
  // final pointer position) and drop any queued frame on unmount.
  const flushPendingMoveSync = useCallback(() => {
    if (moveRafRef.current != null) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
      const m = pendingMoveRef.current;
      pendingMoveRef.current = null;
      if (m) processMove(m.clientX, m.clientY);
    }
  }, [processMove]);

  useEffect(() => () => {
    if (moveRafRef.current != null) cancelAnimationFrame(moveRafRef.current);
    moveRafRef.current = null;
    pendingMoveRef.current = null;
  }, []);

  const handleSvgMouseUp = (e) => {
    // Run any queued move first so the commit below sees the final pointer
    // position even if mouse-up beats the next animation frame.
    flushPendingMoveSync();
    // Idempotency: the same release fires the svg handler AND the
    // window-level handler — commit exactly once per gesture.
    if (upHandledRef.current) return;
    upHandledRef.current = true;
    if (draggingHandle) {
      if (e?.preventDefault) e.preventDefault();
      if (e?.stopPropagation) e.stopPropagation();
      setDraggingHandle(null);
      setDragStartPos(null);
      bodyGestureRef.current = null;
      // Persist the live-dragged positions (from the ref mirror) while pushing
      // the pre-drag snapshot to undo — otherwise undo restores the same
      // post-drag state and drag appears to "snap back" / break undo.
      // A click without movement only selects: no undo entry, no rewrite.
      const latest = drawingsRef.current;
      const snapshot = dragSnapshotRef.current;
      dragSnapshotRef.current = null;
      if (snapshot && dragMovedRef.current) {
        setUndoStack((prev) => [...prev.slice(-30), snapshot]);
        setRedoStack([]);
      }
      persistDrawings(latest);
      // `latest` is already in state via the move handler; re-set to flush.
      setDrawings(latest);
      setChartLocked(false);
      return;
    }

    if (!isDrawing || !currentDraw) {
      setChartLocked(false);
      return;
    }

    // Click-to-place previews stay alive until enough anchors are dropped.
    if (currentDraw.pending) {
      setChartLocked(false);
      return;
    }

    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();

    // Extended 2-anchor drags are already anchor pairs — validate the drag
    // distance and commit directly. This is the ONLY commit path for those
    // tools, so they can never fall back to a legacy start/end shape.
    // (Freehand strokes skip this branch — they commit with the full point
    // list in the generic path below.)
    const upSpec = getToolSpec(currentDraw.type);
    if ((currentDraw.dragAnchor || upSpec?.points === 2) && Array.isArray(currentDraw.points)) {
      const [a] = currentDraw.points;
      // Second anchor comes straight from the up event — never depends on
      // whether the last coalesced move already committed to state.
      let b = currentDraw.points[1];
      try {
        const up = getEventPos(e);
        const upSnap = findMagnetSnap(up.x, up.y);
        const ux = upSnap ? upSnap.x : up.x;
        const uy = upSnap ? upSnap.y : up.y;
        if (upSnap) {
          b = { x: ux, y: uy, logical: upSnap.logical, price: upSnap.price, time: upSnap.time, frac: upSnap.frac ?? 0, offMs: 0, tf: interval };
        } else {
          const upt = coordToChart(ux, uy);
          b = toAnchor(ux, uy, { ...upt, time: timeForLogical(upt.logical), frac: fracForLogical(upt.logical) });
        }
      } catch (_) {}
      const moved = a && b
        ? (Math.abs((b.x ?? 0) - (a.x ?? 0)) > 3 || Math.abs((b.y ?? 0) - (a.y ?? 0)) > 3)
        : false;
      if (moved) {
        commitExtendedDrawing(currentDraw.type, [a, b]);
        return;
      }
      // Tiny click-drag: discard, don't create a degenerate drawing.
      setIsDrawing(false);
      isDraggingRef.current = false;
      setCurrentDraw(null);
      setChartLocked(false);
      toast('Shape banane ke liye chart par drag karo — sirf click se shape nahi banta', { id: 'shape-drag-hint' });
      return;
    }

    // Legacy drag shapes: pin the end anchor to the up event itself so the
    // commit never lags one frame behind the pointer.
    let commitDraw = currentDraw;
    if (!Array.isArray(currentDraw.points) && currentDraw.startX != null) {
      try {
        const up = getEventPos(e);
        const upSnap = findMagnetSnap(up.x, up.y);
        const ux = upSnap ? upSnap.x : up.x;
        const uy = upSnap ? upSnap.y : up.y;
        const upt = upSnap
          ? { logical: upSnap.logical, price: upSnap.price, time: upSnap.time, frac: upSnap.frac ?? 0 }
          : coordToChart(ux, uy);
        const upTime = upt.time ?? timeForLogical(upt.logical);
        const upFrac = upt.frac ?? fracForLogical(upt.logical);
        const upOffMs = Number.isFinite(upFrac) && timeframeMs > 0 ? upFrac * timeframeMs : 0;
        commitDraw = { ...currentDraw, endX: ux, endY: uy, endLogical: upt.logical, endPrice: upt.price, endTime: upTime, endFrac: upFrac, endOffMs: upOffMs };
      } catch (_) {}
    }

    let isValid = false;
    if (Array.isArray(commitDraw.points)) {
      // Freehand (brush / highlighter) needs a real stroke
      isValid = commitDraw.points.length > 2;
    } else {
      const dx = Math.abs(commitDraw.endX - commitDraw.startX);
      const dy = Math.abs(commitDraw.endY - commitDraw.startY);
      if (dx > 3 || dy > 3 || commitDraw.type === 'ruler') {
        isValid = true;
      }
    }

    if (isValid) {
      if (isExtendedTool(commitDraw.type)) {
        // Defensive: any extended shape that still carries start/end (should not
        // happen after the points-based flow above) is converted, never saved
        // as a legacy drawing.
        if (!Array.isArray(commitDraw.points)) {
          commitExtendedDrawing(commitDraw.type, [
            { x: commitDraw.startX, y: commitDraw.startY, logical: commitDraw.startLogical, price: commitDraw.startPrice, time: commitDraw.startTime, frac: commitDraw.startFrac, offMs: commitDraw.startOffMs, tf: commitDraw.tf ?? interval },
            { x: commitDraw.endX, y: commitDraw.endY, logical: commitDraw.endLogical, price: commitDraw.endPrice, time: commitDraw.endTime, frac: commitDraw.endFrac, offMs: commitDraw.endOffMs, tf: commitDraw.tf ?? interval },
          ]);
          return;
        }
        commitExtendedDrawing(commitDraw.type, commitDraw.points);
        return;
      }
      const updated = [...drawingsRef.current, commitDraw];
      saveDrawingsWithHistory(updated, true);
      setSelectedDrawingId(commitDraw.id);
    } else {
      // Degenerate gesture (a click without a drag): tell the user instead of
      // silently swallowing it — this is the "place hi nahi ho raha" feeling.
      toast('Shape banane ke liye chart par drag karo — sirf click se shape nahi banta', { id: 'shape-drag-hint' });
    }

    setIsDrawing(false);
    isDraggingRef.current = false;
    setCurrentDraw(null);
    setChartLocked(false);

    if (isValid && !stayInDrawMode && activeTool !== 'polyline') {
      setActiveTool(DEFAULT_TOOL);
    }
  };

  // ── Window-level pointer capture (TradingView parity) ─────────────────────
  // In cursor/selection modes the SVG overlay is click-through so the chart
  // keeps panning — but then moves/releases over empty chart space never reach
  // the svg handlers and anchor drags freeze mid-gesture. Mirroring the move
  // and release on `window` keeps every drag glued to the cursor no matter
  // what sits under the pointer. The mouse-up guard above makes the double
  // delivery (svg + window) commit exactly once.
  const svgMoveRef = useRef(null);
  const svgUpRef = useRef(null);
  svgMoveRef.current = handleSvgMouseMove;
  svgUpRef.current = handleSvgMouseUp;

  useEffect(() => {
    const onMove = (e) => {
      if (gestureActiveRef.current) {
        svgMoveRef.current?.(e);
        return;
      }
      // Hover (no gesture): only magnet-track when the pointer is over the
      // overlay itself, so moving over side panels costs nothing.
      try {
        if (svgRef.current && e?.target instanceof Node && svgRef.current.contains(e.target)) {
          svgMoveRef.current?.(e);
        }
      } catch (_) {}
    };
    const onUp = (e) => {
      if (gestureActiveRef.current) svgUpRef.current?.(e);
    };
    const onBlur = () => {
      // Pointer left the window mid-gesture (Alt+Tab, chrome UI): commit what
      // we have instead of leaving a stuck drag behind.
      if (gestureActiveRef.current) svgUpRef.current?.({});
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Touch equivalent while a drag is live (touchmove must be non-passive to
  // keep the gesture from scrolling the page mid-drag).
  useEffect(() => {
    if (!draggingHandle) return undefined;
    const onMove = (e) => svgMoveRef.current?.(e);
    const onUp = (e) => svgUpRef.current?.(e);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
    return () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
  }, [draggingHandle]);

  // ── Click empty chart → deselect (TradingView parity) ─────────────────────
  // In cursor modes the overlay is click-through, so empty-chart clicks never
  // reach the svg deselect path and the selection would stick forever. Detect
  // them on window instead: a press+release with <6px movement whose target
  // sits inside the price pane but OUTSIDE the overlay (i.e. not on a shape,
  // toolbar, menu or popup) clears the selection. Pans keep the selection.
  const emptyClickRef = useRef(null);
  useEffect(() => {
    if (selectedDrawingId == null) return undefined;
    const isEmptyPaneTarget = (t) => {
      try {
        const pane = mainPaneRef?.current;
        if (!t || !(t instanceof Node) || !pane || !svgRef.current) return false;
        return pane.contains(t) && !svgRef.current.contains(t);
      } catch (_) {
        return false;
      }
    };
    const onDown = (e) => {
      emptyClickRef.current = null;
      if (e?.button != null && e.button !== 0) return; // left button / touch only
      if (!isEmptyPaneTarget(e.target)) return;
      emptyClickRef.current = {
        x: e?.changedTouches?.[0]?.clientX ?? e?.clientX ?? 0,
        y: e?.changedTouches?.[0]?.clientY ?? e?.clientY ?? 0,
      };
    };
    const onUp = (e) => {
      const start = emptyClickRef.current;
      emptyClickRef.current = null;
      if (!start || !isEmptyPaneTarget(e?.target)) return;
      const cx = e?.changedTouches?.[0]?.clientX ?? e?.clientX ?? start.x;
      const cy = e?.changedTouches?.[0]?.clientY ?? e?.clientY ?? start.y;
      const dx = cx - start.x;
      const dy = cy - start.y;
      if (dx * dx + dy * dy > 36) return; // it was a pan — keep selection
      setSelectedDrawingId(null);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchend', onUp);
    };
  }, [selectedDrawingId, mainPaneRef]);

  /** Double-click finishes a click-to-place polyline (TradingView parity). */
  const handleSvgDoubleClick = (e) => {
    if (activeTool !== 'polyline' || !currentDraw?.pending) return;
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();
    let anchors = Array.isArray(pendingPoints) ? pendingPoints.slice() : [];
    // The double-click's own second mousedown already appended a near-duplicate
    // anchor — drop it so the finished line ends where the user double-clicked.
    if (anchors.length >= 2) {
      const last = anchors[anchors.length - 1];
      const prev = anchors[anchors.length - 2];
      const dx = (last?.x ?? 0) - (prev?.x ?? 0);
      const dy = (last?.y ?? 0) - (prev?.y ?? 0);
      if (dx * dx + dy * dy < 64) anchors = anchors.slice(0, -1);
    }
    if (anchors.length >= 2) {
      commitExtendedDrawing('polyline', anchors);
      toast.success('Polyline completed');
    }
  };

  /** Keyboard finish/cancel for click-to-place tools (polyline + patterns). */
  const handlePlacementKey = useCallback((e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return false;
    if (!currentDraw?.pending) return false;
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelPlacement();
      if (!isCursorMode(activeToolRef.current)) {
        setActiveTool(DEFAULT_TOOL);
      }
      setSelectedDrawingId(null);
      toast.success('Drawing tool unselected');
      return true;
    }
    if ((e.key === 'Enter' || e.key === ' ') && activeTool === 'polyline') {
      const anchors = Array.isArray(pendingPoints) ? pendingPoints : [];
      if (anchors.length >= 2) {
        e.preventDefault();
        commitExtendedDrawing('polyline', anchors);
        toast.success('Polyline completed');
        return true;
      }
    }
    return false;
  }, [currentDraw, pendingPoints, activeTool, cancelPlacement, commitExtendedDrawing]);

  // Duplicate selected drawing — offsets points-based and legacy shapes alike
  // so extended tools don't stack invisibly on top of the original.
  // Time identity follows the shifted logical so the copy stays bar-locked.
  const handleDuplicateSelected = useCallback(() => {
    if (!selectedDrawingId) return;
    const target = drawingsRef.current.find((d) => d.id === selectedDrawingId);
    if (!target) return;

    const dup = { ...target, id: Date.now() };
    if (Array.isArray(target.points)) {
      dup.points = target.points.map((pt) => {
        const nextLogical = pt.logical != null ? pt.logical + 2 : pt.logical;
        return {
          ...pt,
          x: (pt.x || 0) + 18,
          y: (pt.y || 0) + 18,
          logical: nextLogical,
          time: nextLogical != null ? timeForLogical(nextLogical) ?? null : pt.time,
          frac: nextLogical != null ? fracForLogical(nextLogical) : pt.frac,
        };
      });
    } else {
      dup.startX = (target.startX || 0) + 18;
      dup.startY = (target.startY || 0) + 18;
      dup.endX = (target.endX || 0) + 18;
      dup.endY = (target.endY || 0) + 18;
      if (target.startLogical != null) {
        dup.startLogical = target.startLogical + 2;
        dup.startTime = timeForLogical(dup.startLogical) ?? null;
        dup.startFrac = fracForLogical(dup.startLogical);
      }
      if (target.endLogical != null) {
        dup.endLogical = target.endLogical + 2;
        dup.endTime = timeForLogical(dup.endLogical) ?? null;
        dup.endFrac = fracForLogical(dup.endLogical);
      }
    }
    saveDrawingsWithHistory([...drawingsRef.current, dup], true);
    setSelectedDrawingId(dup.id);
    toast.success('Drawing duplicated');
  }, [selectedDrawingId, saveDrawingsWithHistory, timeForLogical, fracForLogical]);

  const handleClearAll = () => {
    if (lockAllDrawings) {
      toast.error('Drawings are locked. Unlock first.');
      return;
    }
    saveDrawingsWithHistory([]);
    setSelectedDrawingId(null);
    toast.success('All drawings removed');
  };

  // Patch fields of the currently selected drawing (style/text/flags) with
  // history push so every toolbar/settings tweak is undoable.
  const updateSelectedDrawing = useCallback((patch) => {
    if (!selectedDrawingId) return;
    const updated = drawingsRef.current.map((d) => (d.id === selectedDrawingId ? { ...d, ...patch } : d));
    saveDrawingsWithHistory(updated, true);
  }, [selectedDrawingId, saveDrawingsWithHistory]);

  // Delete selected via toolbar (respects per-drawing lock like the Del key).
  const deleteSelectedDrawing = useCallback(() => {
    if (!selectedDrawingId) return;
    if (drawingsRef.current.find((d) => d.id === selectedDrawingId)?.locked) {
      toast.error('Unlock the drawing first');
      return;
    }
    saveDrawingsWithHistory(drawingsRef.current.filter((d) => d.id !== selectedDrawingId), true);
    setSelectedDrawingId(null);
    setDrawingSettingsId(null);
    toast.success('Deleted drawing');
  }, [selectedDrawingId, saveDrawingsWithHistory]);

  // ── TradingView-style object behaviours ────────────────────────────────────
  const handleSelectTool = useCallback((toolId) => {
    const spec = getToolSpec(toolId);
    if (spec?.kind === 'cursor' || toolId === 'cross' || toolId === 'dot' || toolId === 'crosshair') {
      setContextMenu(null);
      setPendingPoints([]);
      setIsDrawing(false);
      setCurrentDraw(null);
      setChartLocked(false);
      setSelectedDrawingId(null);
      // Preserve the exact cursor id so the top Draw menu and the left rail
      // (both driven by the same controlled `activeTool`) can never desync.
      // All three ids are selection-only modes (see isCursorMode).
      setActiveTool(toolId);
      if (toolId === 'dot') {
        toast.success('Dot cursor — precision selection pointer');
      } else {
        toast.success(`${spec?.label || 'Cursor'} — selection mode`);
      }
      return;
    }
    if (spec?.hint) {
      toast.success(`${spec.label} — ${spec.hint}`);
    }
    setActiveTool(toolId);
    setPendingPoints([]);
    setIsDrawing(false);
    setCurrentDraw(null);
    setContextMenu(null);
    setChartLocked(false);
  }, [setChartLocked, setActiveTool]);

  // The top Draw menu writes `activeTool` directly through
  // `onActiveToolChange`, bypassing `handleSelectTool`. Reset any in-progress
  // placement when the controlled tool changes externally so a half-placed
  // pitchfork/polyline can never leak into the next tool's flow.
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current !== activeTool) {
      prevToolRef.current = activeTool;
      setPendingPoints([]);
      setCurrentDraw(null);
      setIsDrawing(false);
      isDraggingRef.current = false;
      setContextMenu(null);
      if (isCursorMode(activeTool)) setChartLocked(false);
    }
  }, [activeTool, isCursorMode, setChartLocked]);

  const handleToggleStayInDrawMode = useCallback(() => {
    setStayInDrawMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('so_stay_in_draw_mode', JSON.stringify(next));
      } catch {}
      toast(next ? 'Stay in Drawing Mode: ON' : 'Stay in Drawing Mode: OFF (Auto-unselect tool)', {
        id: 'stay-draw-mode',
      });
      return next;
    });
  }, []);

  // Catalog Alt-shortcuts (Alt+T trendline, Alt+J h-line, …) activate the
  // corresponding drawing tool, and plain digits 1..9,0 activate pinned
  // favourite tools in pin order — both work from anywhere on the page except
  // text fields. Alt-only (no Ctrl/Meta) and never while typing — so
  // browser/OS chords and text fields are untouched. Placed after
  // handleSelectTool so the dep array never hits a TDZ const.
  useEffect(() => {
    const typing = () => {
      const tag = document.activeElement?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
    };
    const onToolShortcut = (e) => {
      if (typing()) return;
      // Digit hotkeys for pinned favourites (no modifiers).
      if (!e.altKey && !e.ctrlKey && !e.metaKey && /^[0-9]$/.test(e.key || '')) {
        const pins = readPinnedIds();
        const idx = e.key === '0' ? 9 : Number(e.key) - 1;
        const id = pins[idx];
        if (id && getToolSpec(id)) {
          e.preventDefault();
          handleSelectTool(id);
        }
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        handleToggleStayInDrawMode();
        return;
      }
      const toolId = resolveShortcut(e.key, { alt: true, shift: !!e.shiftKey });
      if (!toolId) return;
      e.preventDefault();
      handleSelectTool(toolId);
    };
    window.addEventListener('keydown', onToolShortcut);
    return () => window.removeEventListener('keydown', onToolShortcut);
  }, [handleSelectTool, handleToggleStayInDrawMode]);

  const handleCycleMagnet = useCallback(() => {
    const next = nextMagnetMode(magnetMode);
    setMagnetMode(next);
    toast.success(MAGNET_LABELS[next] || next);
  }, [magnetMode]);

  const handleToggleLockAll = useCallback(() => {
    const next = !lockAllDrawings;
    setLockAllDrawings(next);
    toast.success(next ? 'All objects locked' : 'All objects unlocked');
  }, [lockAllDrawings]);

  const handleToggleHideAll = useCallback(() => {
    const next = !hideAllDrawings;
    setHideAllDrawings(next);
    toast.success(next ? 'All objects hidden' : 'All objects visible');
  }, [hideAllDrawings]);

  const patchDrawing = useCallback((id, patch) => {
    saveDrawingsWithHistory(drawingsRef.current.map((d) => (d.id === id ? { ...d, ...patch } : d)), true);
  }, [saveDrawingsWithHistory]);

  const removeDrawing = useCallback((id) => {
    saveDrawingsWithHistory(drawingsRef.current.filter((d) => d.id !== id), true);
    setSelectedDrawingId((prev) => (prev === id ? null : prev));
  }, [saveDrawingsWithHistory]);

  const bringToFront = useCallback((id) => {
    const all = drawingsRef.current;
    const target = all.find((d) => d.id === id);
    if (!target) return;
    saveDrawingsWithHistory([...all.filter((d) => d.id !== id), target], true);
  }, [saveDrawingsWithHistory]);

  const sendToBack = useCallback((id) => {
    const all = drawingsRef.current;
    const target = all.find((d) => d.id === id);
    if (!target) return;
    saveDrawingsWithHistory([target, ...all.filter((d) => d.id !== id)], true);
  }, [saveDrawingsWithHistory]);

  const offsetDrawing = useCallback((drawing, dx, dy, dLogical = 0) => {
    const shifted = { ...drawing, id: Date.now() };
    if (Array.isArray(drawing.points)) {
      shifted.points = drawing.points.map((pt) => {
        const nextLogical = pt.logical != null ? pt.logical + dLogical : pt.logical;
        return {
          ...pt,
          x: (pt.x || 0) + dx,
          y: (pt.y || 0) + dy,
          logical: nextLogical,
          time: nextLogical != null ? timeForLogical(nextLogical) ?? null : pt.time,
          frac: nextLogical != null ? fracForLogical(nextLogical) : pt.frac,
        };
      });
    } else {
      shifted.startX = (drawing.startX || 0) + dx;
      shifted.startY = (drawing.startY || 0) + dy;
      shifted.endX = (drawing.endX || 0) + dx;
      shifted.endY = (drawing.endY || 0) + dy;
      if (drawing.startLogical != null) {
        shifted.startLogical = drawing.startLogical + dLogical;
        shifted.startTime = timeForLogical(shifted.startLogical) ?? null;
        shifted.startFrac = fracForLogical(shifted.startLogical);
      }
      if (drawing.endLogical != null) {
        shifted.endLogical = drawing.endLogical + dLogical;
        shifted.endTime = timeForLogical(shifted.endLogical) ?? null;
        shifted.endFrac = fracForLogical(shifted.endLogical);
      }
    }
    return shifted;
  }, [timeForLogical, fracForLogical]);

  const cloneDrawing = useCallback((id) => {
    const target = drawingsRef.current.find((d) => d.id === id);
    if (!target) return;
    const dup = offsetDrawing(target, 18, 18, 2);
    saveDrawingsWithHistory([...drawingsRef.current, dup], true);
    setSelectedDrawingId(dup.id);
    toast.success(`${getToolSpec(target.type)?.label || 'Drawing'} cloned`);
  }, [offsetDrawing, saveDrawingsWithHistory]);

  const handleContextMenu = useCallback((event, drawingId = null) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    setContextMenu({
      x: event.clientX - (rect?.left || 0),
      y: event.clientY - (rect?.top || 0),
      clientX: event.clientX,
      clientY: event.clientY,
      drawingId,
    });
    if (drawingId != null) setSelectedDrawingId(drawingId);
  }, []);

  // ── Empty-chart right-click → object menu (TradingView parity) ─────────────
  // Same click-through problem as deselect: in cursor modes the overlay never
  // sees the event (it lands on the chart canvas), so shape menus work but the
  // background menu never opens. Catch it on window; clicks on shapes keep
  // using their own menu (target inside the overlay → skipped here, no double).
  // Placed after handleContextMenu so the dep array never hits a TDZ const.
  useEffect(() => {
    const onContext = (e) => {
      try {
        const t = e.target;
        if (!t || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
        const pane = mainPaneRef?.current;
        if (!pane || !svgRef.current) return;
        if (!(t instanceof Node) || !pane.contains(t) || svgRef.current.contains(t)) return;
        handleContextMenu(e, null);
      } catch (_) {}
    };
    window.addEventListener('contextmenu', onContext);
    return () => window.removeEventListener('contextmenu', onContext);
  }, [mainPaneRef, handleContextMenu]);

  const copyDrawing = useCallback((id) => {
    const target = drawingsRef.current.find((d) => d.id === id);
    if (!target) return;
    setClipboard(JSON.parse(JSON.stringify(target)));
    toast.success(`${getToolSpec(target.type)?.label || 'Drawing'} copied`);
  }, []);

  const pasteClipboard = useCallback(() => {
    if (!clipboard) {
      toast.error('Nothing to paste — copy an object first');
      return;
    }
    const dup = offsetDrawing(clipboard, 18, 18, 2);
    saveDrawingsWithHistory([...drawingsRef.current, dup], true);
    setSelectedDrawingId(dup.id);
    toast.success(`${getToolSpec(dup.type)?.label || 'Drawing'} pasted`);
  }, [clipboard, offsetDrawing, saveDrawingsWithHistory]);

  // Delete / duplicate / placement-finish shortcuts. Registered here (after all
  // handlers exist) so the effect never references uninitialized consts, and
  // every branch reads `drawingsRef` to avoid stale closures.
  useEffect(() => {
    const onObjectKeys = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (handlePlacementKey(e)) return;
      if (e.key === 'Escape') {
        let handled = false;
        if (!isCursorMode(activeToolRef.current)) {
          setActiveTool(DEFAULT_TOOL);
          handled = true;
        }
        if (selectedDrawingId) {
          setSelectedDrawingId(null);
          handled = true;
        }
        if (contextMenu) {
          setContextMenu(null);
          handled = true;
        }
        if (drawingSettingsId) {
          setDrawingSettingsId(null);
          handled = true;
        }
        if (showStickerMenu) {
          setShowStickerMenu(false);
          setStickerPos(null);
          handled = true;
        }
        cancelPlacement();
        setChartLocked(false);
        if (handled) {
          e.preventDefault();
          toast.success('Drawing tool unselected');
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedDrawingId) {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        e.preventDefault();
        if (lockAllDrawings) {
          toast.error('Drawings are locked');
          return;
        }
        if (drawingsRef.current.find((d) => d.id === selectedDrawingId)?.locked) {
          toast.error('Unlock the drawing first');
          return;
        }
        saveDrawingsWithHistory(drawingsRef.current.filter((d) => d.id !== selectedDrawingId), true);
        setSelectedDrawingId(null);
        toast.success('Drawing deleted');
      }
    };
    window.addEventListener('keydown', onObjectKeys);
    return () => window.removeEventListener('keydown', onObjectKeys);
  }, [
    selectedDrawingId,
    lockAllDrawings,
    handleDuplicateSelected,
    handlePlacementKey,
    saveDrawingsWithHistory,
    isCursorMode,
    setActiveTool,
    cancelPlacement,
    contextMenu,
    drawingSettingsId,
    showStickerMenu,
    setChartLocked,
  ]);

  const handleAddText = () => {
    if (textInputVal.trim() && textInputPos) {
      const textDrawing = {
        id: Date.now(),
        type: 'text',
        startX: textInputPos.x,
        startY: textInputPos.y,
        startLogical: textInputPos.logical,
        startPrice: textInputPos.price,
        startTime: textInputPos.time ?? timeForLogical(textInputPos.logical),
        startFrac: textInputPos.frac ?? fracForLogical(textInputPos.logical),
        startOffMs: textInputPos.offMs ?? 0,
        tf: textInputPos.tf ?? interval,
        text: textInputVal.trim(),
        color: activeColor,
      };
      saveDrawingsWithHistory([...drawingsRef.current, textDrawing]);
      setSelectedDrawingId(textDrawing.id);
    }
    setTextInputPos(null);
    setTextInputVal('');
    setChartLocked(false);
    if (!stayInDrawMode) setActiveTool(DEFAULT_TOOL);
  };

  const handleAddSticker = (emoji) => {
    if (stickerPos) {
      const stickerDrawing = {
        id: Date.now(),
        type: 'sticker',
        startX: stickerPos.x,
        startY: stickerPos.y,
        startLogical: stickerPos.logical,
        startPrice: stickerPos.price,
        startTime: stickerPos.time ?? timeForLogical(stickerPos.logical),
        startFrac: stickerPos.frac ?? fracForLogical(stickerPos.logical),
        startOffMs: stickerPos.offMs ?? 0,
        tf: stickerPos.tf ?? interval,
        emoji,
      };
      saveDrawingsWithHistory([...drawingsRef.current, stickerDrawing]);
      setSelectedDrawingId(stickerDrawing.id);
    }
    setShowStickerMenu(false);
    setStickerPos(null);
    setChartLocked(false);
    if (!stayInDrawMode) setActiveTool(DEFAULT_TOOL);
  };

  const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId);
  const contextTarget = contextMenu ? drawings.find((d) => d.id === contextMenu.drawingId) : null;

  // Favourite tools for the empty-chart right-click menu (fresh read per open
  // so pins starred in the toolbar appear immediately).
  const menuFavouriteTools = useMemo(() => {
    if (!contextMenu || contextMenu.drawingId != null) return [];
    return readPinnedIds()
      .slice(0, 8)
      .map((id, i) => ({ spec: getToolSpec(id), digit: pinDigitForIndex(i) }))
      .filter((x) => x.spec);
  }, [contextMenu]);

  // Registry preview anchors for the in-progress drawing — points-based shapes
  // use their live points directly; legacy start/end shapes are converted so
  // the preview path never depends on which flow created `currentDraw`.
  const previewAnchors = useMemo(() => {
    if (!currentDraw || !isExtendedTool(currentDraw.type)) return [];
    if (Array.isArray(currentDraw.points) && currentDraw.points.length) return currentDraw.points;
    if (currentDraw.startX != null && currentDraw.endX != null) {
      return [
        { x: currentDraw.startX, y: currentDraw.startY, logical: currentDraw.startLogical, price: currentDraw.startPrice },
        { x: currentDraw.endX, y: currentDraw.endY, logical: currentDraw.endLogical, price: currentDraw.endPrice },
      ];
    }
    return [];
  }, [currentDraw]);
  const previewSpec = currentDraw ? getToolSpec(currentDraw.type) : null;
  const previewIsExtended = Boolean(currentDraw && isExtendedTool(currentDraw.type) && previewAnchors.length);

  return (
    <>
      {/* ── TradingView-style drawing toolbar (grouped flyouts) ── */}
      <DrawingToolbar
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        magnetMode={magnetMode}
        onCycleMagnet={handleCycleMagnet}
        stayInDrawMode={stayInDrawMode}
        onToggleStayInDrawMode={handleToggleStayInDrawMode}
        lockAllDrawings={lockAllDrawings}
        onToggleLockAll={handleToggleLockAll}
        hideAllDrawings={hideAllDrawings}
        onToggleHideAll={handleToggleHideAll}
        onClearAll={handleClearAll}
        onUndo={handleUndo}
        onRedo={handleRedo}
        drawingCount={drawings.length}
        showObjectTree={showObjectTree}
        onToggleObjectTree={() => setShowObjectTree((prev) => !prev)}
        isOpen={isOpen}
        onToggleOpen={onToggleOpen}
        isMobile={isMobile}
      />

      {/* ── TradingView-style floating favorite toolbar (starred tools) ── */}
      {isOpen && (
        <FloatingFavoritesBar
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          toolbarWidth={toolbarWidth}
          isMobile={isMobile}
        />
      )}

      {/* ── Selected Drawing Floating Context Action Toolbar ── */}
      {/* TradingView-style: appears on ANY selection (any active tool), hidden
          only while a placement/drag gesture is in progress. */}
      {selectedDrawing && !isDrawing && !currentDraw && (pendingPoints?.length ?? 0) === 0 && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--bg-card, #131722)',
          border: '1px solid var(--border, #2962FF)',
          borderRadius: 8,
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 60,
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          userSelect: 'none',
          maxWidth: 'calc(100% - 24px)',
          overflowX: 'auto',
        }}>
          <span style={{ fontSize: '0.72rem', color: '#93C5FD', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            {String(selectedDrawing.type || '').replace(/_/g, ' ')}
          </span>

          {/* Visibility toggle */}
          <button
            onClick={() => {
              setHiddenIds((prev) => {
                const next = new Set(prev);
                if (next.has(selectedDrawingId)) next.delete(selectedDrawingId);
                else next.add(selectedDrawingId);
                return next;
              });
            }}
            title={hiddenIds.has(selectedDrawingId) ? 'Show drawing' : 'Hide drawing'}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            {hiddenIds.has(selectedDrawingId) ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>

          {/* Per-drawing lock */}
          <button
            onClick={() => updateSelectedDrawing({ locked: !selectedDrawing.locked })}
            title={selectedDrawing.locked ? 'Unlock drawing' : 'Lock drawing (anchors cannot move)'}
            style={{
              background: selectedDrawing.locked ? 'rgba(245,158,11,0.15)' : 'transparent',
              border: 'none', borderRadius: 4, color: selectedDrawing.locked ? '#F59E0B' : '#94A3B8',
              cursor: 'pointer', padding: 3, display: 'flex',
            }}
          >
            {selectedDrawing.locked ? <Lock size={15} /> : <Unlock size={15} />}
          </button>

          {/* Full settings */}
          <button
            onClick={() => setDrawingSettingsId(selectedDrawingId)}
            title="Drawing settings"
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <Settings size={15} />
          </button>

          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border, rgba(148,163,184,0.2))' }} />

          {/* Color Presets */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {COLOR_PRESETS.map((c) => (
              <div
                key={c}
                onClick={() => updateSelectedDrawing({ color: c })}
                title={c}
                style={{
                  width: 16, height: 16, borderRadius: '50%', backgroundColor: c, cursor: 'pointer',
                  border: selectedDrawing.color === c ? '2px solid #FFF' : '1px solid rgba(255,255,255,0.2)',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
              />
            ))}
          </div>

          {/* Stroke Width Selector */}
          <div style={{ display: 'flex', gap: 3 }}>
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                onClick={() => updateSelectedDrawing({ strokeWidth: w })}
                title={`Width ${w}px`}
                style={{
                  padding: '2px 6px', borderRadius: 4, border: 'none',
                  backgroundColor: selectedDrawing.strokeWidth === w ? '#2962FF' : '#2A2E39',
                  color: '#FFF', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {w}px
              </button>
            ))}
          </div>

          {/* Line Style Selector */}
          <div style={{ display: 'flex', gap: 3 }}>
            {['solid', 'dashed', 'dotted'].map((st) => (
              <button
                key={st}
                onClick={() => updateSelectedDrawing({ lineStyle: st })}
                title={`Style ${st}`}
                style={{
                  padding: '2px 6px', borderRadius: 4, border: 'none',
                  backgroundColor: (selectedDrawing.lineStyle || 'solid') === st ? '#2962FF' : '#2A2E39',
                  color: '#FFF', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {st}
              </button>
            ))}
          </div>

          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border, rgba(148,163,184,0.2))' }} />

          {/* Duplicate Button */}
          <button
            onClick={handleDuplicateSelected}
            title="Duplicate Drawing (Ctrl+D)"
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <Copy size={15} />
          </button>

          {/* Delete Button */}
          <button
            onClick={deleteSelectedDrawing}
            title="Delete Drawing (Del)"
            style={{ background: 'transparent', border: 'none', color: '#EF5350', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <Trash2 size={15} />
          </button>

          {/* Close Toolbar */}
          <button
            onClick={() => setSelectedDrawingId(null)}
            title="Close selection"
            style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Drawing Settings Modal — TradingView parity (Style/Text/Coordinates/Visibility, ALL tools) ── */}
      {drawingSettingsId && (() => {
        const target = drawings.find((d) => d.id === drawingSettingsId);
        if (!target) return null;
        const patchTarget = (patch, opts) => {
          if (opts?.reset) {
            // Reset keeps identity + anchors, drops styling customizations.
            const keep = { id: target.id, type: target.type };
            if (Array.isArray(target.points)) keep.points = target.points;
            ['startLogical', 'startPrice', 'startTime', 'startFrac', 'startOffMs', 'startX', 'startY',
             'endLogical', 'endPrice', 'endTime', 'endFrac', 'endOffMs', 'endX', 'endY', 'tf'].forEach((k) => {
              if (target[k] !== undefined) keep[k] = target[k];
            });
            const updated = drawingsRef.current.map((d) => (d.id === drawingSettingsId ? keep : d));
            saveDrawingsWithHistory(updated, true);
            return;
          }
          const updated = drawingsRef.current.map((d) => (d.id === drawingSettingsId ? { ...d, ...patch } : d));
          saveDrawingsWithHistory(updated, true);
        };
        return (
          <DrawingSettingsModal
            drawing={target}
            onPatch={patchTarget}
            onClose={() => setDrawingSettingsId(null)}
          />
        );
      })()}

      {/* ── High-Performance Interactive SVG Canvas ── */}
      {/* Pane-locked: height follows the main price pane so scroll/zoom maps 1:1.
          GPU-promoted (translateZ) for jank-free pans; only the top pane area
          intercepts drawing gestures, sub-panes stay interactive. The overlay
          ends at the plot edge (PRICE_AXIS_WIDTH reserved) so drawings never
          bleed over the right price scale — axis clicks reach the chart. */}
      {!hideAllDrawings && (
        <svg
          ref={svgRef}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onDoubleClick={handleSvgDoubleClick}
          onContextMenu={(e) => handleContextMenu(e, null)}
          onTouchStart={handleSvgMouseDown}
          onTouchMove={handleSvgMouseMove}
          onTouchEnd={handleSvgMouseUp}
          shapeRendering="geometricPrecision"
          style={{
            position: 'absolute',
            top: 0,
            left: isOpen ? toolbarWidth : 0,
            right: PRICE_AXIS_WIDTH,
            bottom: 'auto',
            width: isOpen ? `calc(100% - ${toolbarWidth + PRICE_AXIS_WIDTH}px)` : `calc(100% - ${PRICE_AXIS_WIDTH}px)`,
            height: paneHeight != null ? `${paneHeight}px` : '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            zIndex: 45,
            // TradingView hit-testing: in cursor/selection modes the overlay is
            // click-through ('none') so empty-space gestures reach the chart
            // (pan/zoom keep working) while every drawing shape still receives
            // events through its own explicit pointerEvents. In drawing modes
            // the overlay captures everything ('all') to start new sketches.
            pointerEvents: !isCursorMode(activeTool) ? 'all' : 'none',
            cursor: !isCursorMode(activeTool) ? 'crosshair' : (activeTool === 'dot' ? 'crosshair' : 'default'),
            touchAction: 'none',
            transform: 'translateZ(0)',
            willChange: 'transform',
          }}
        >
          {/* Render All Saved Drawings */}
          {drawings.map((d) => {
            // Per-drawing visibility (TradingView eye toggle) — hidden objects vanish.
            if (hiddenIds.has(d.id)) return null;
            // TradingView Visibility tab — hidden on unchecked timeframes.
            if (!isDrawingVisibleOn(d, interval)) return null;
            // ── Extended (TradingView tool-set) drawings render via the registry ──
            // Legacy types (trendline, fib, brush…) keep their bespoke JSX below.
            if (isExtendedTool(d.type)) {
              const anchors = resolveAnchorsCached(d);
              if (!anchors.length) return null;
              return (
                <g
                  key={d.id}
                  data-drawing-id={d.id}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <DrawingShape
                    drawing={d}
                    points={anchors}
                    surface={surfaceSize}
                    currency={currSym}
                    timeframeMs={timeframeMs}
                    toX={logicalToX}
                    toY={priceToY}
                    candles={candles}
                    selected={selectedDrawingId === d.id}
                    handlers={{
                      onBodyDown: (e) => startBodyDrag(e, d.id),
                      onDoubleClick: (e) => handleShapeDoubleClick(e, d),
                    }}
                    onHandleDown={(e, index) => startPointDrag(e, d.id, index)}
                    onDoubleClick={(e) => handleShapeDoubleClick(e, d)}
                  />
                </g>
              );
            }

            const isSelected = selectedDrawingId === d.id;
            const pt1 = chartToCoordCached(d.startLogical, d.startPrice, d.startX, d.startY, d.startTime, d.startFrac, d.startOffMs);
            const pt2 = chartToCoordCached(d.endLogical,   d.endPrice,   d.endX,   d.endY, d.endTime, d.endFrac, d.endOffMs);

            const strokeDash = d.lineStyle === 'dashed' ? '6,6' : (d.lineStyle === 'dotted' ? '2,4' : (isSelected ? '4,4' : 'none'));

            // 1. Horizontal Line
            if (d.type === 'horizontal_line') {
              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <line
                    x1={0} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  <line
                    x1={0} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke={d.color || '#38BDF8'} strokeWidth={d.strokeWidth || 2}
                    strokeDasharray={strokeDash}
                  />
                  <circle
                    cx={10} cy={pt1.y} r={isSelected ? 5 : 3.5}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                  />
                  <rect
                    x={8} y={pt1.y - 18} width={75} height={16} rx={3}
                    fill="#131722" stroke={d.color || '#38BDF8'} strokeWidth={1}
                  />
                  <text x={12} y={pt1.y - 6} fill={d.color || '#38BDF8'} fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                    {currSym}{d.startPrice?.toFixed(2)}
                  </text>
                </g>
              );
            }

            // 2. Horizontal Ray
            if (d.type === 'horizontal_ray') {
              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <line
                    x1={pt1.x} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  <line
                    x1={pt1.x} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke={d.color || '#38BDF8'} strokeWidth={d.strokeWidth || 2}
                    strokeDasharray={strokeDash}
                  />
                  <circle cx={pt1.x} cy={pt1.y} r={isSelected ? 5 : 3.5} fill="#FFF" stroke={d.color || '#38BDF8'} strokeWidth={1.5} />
                  <rect
                    x={pt1.x + 8} y={pt1.y - 18} width={75} height={16} rx={3}
                    fill="#131722" stroke={d.color || '#38BDF8'} strokeWidth={1}
                  />
                  <text x={pt1.x + 12} y={pt1.y - 6} fill={d.color || '#38BDF8'} fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                    {currSym}{d.startPrice?.toFixed(2)}
                  </text>
                </g>
              );
            }

            // 3. Trend Line
            if (d.type === 'trendline') {
              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <line
                    x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  <line
                    x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                    stroke={d.color || '#38BDF8'}
                    strokeWidth={d.strokeWidth || 2}
                    strokeDasharray={strokeDash}
                  />
                  {/* Start & End Handles */}
                  <circle
                    cx={pt1.x} cy={pt1.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                  />
                  <circle
                    cx={pt2.x} cy={pt2.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                  />
                </g>
              );
            }

            // 4. Trend Ray (Ray extending to the chart edge, TradingView parity)
            if (d.type === 'ray') {
              let extPt = null;
              try {
                extPt = DG.edgeExit(pt1, pt2, surfaceSize);
              } catch (_) {
                extPt = null;
              }
              if (!extPt || !Number.isFinite(extPt.x) || !Number.isFinite(extPt.y)) {
                const dx = pt2.x - pt1.x;
                const dy = pt2.y - pt1.y;
                const angle = Math.atan2(dy, dx);
                const extendedLength = 3000;
                extPt = { x: pt1.x + Math.cos(angle) * extendedLength, y: pt1.y + Math.sin(angle) * extendedLength };
              }
              const extX = extPt.x;
              const extY = extPt.y;

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <line
                    x1={pt1.x} y1={pt1.y} x2={extX} y2={extY}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  <line
                    x1={pt1.x} y1={pt1.y} x2={extX} y2={extY}
                    stroke={d.color || '#38BDF8'}
                    strokeWidth={d.strokeWidth || 2}
                    strokeDasharray={strokeDash}
                  />
                  <circle
                    cx={pt1.x} cy={pt1.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                  />
                  <circle
                    cx={pt2.x} cy={pt2.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                  />
                </g>
              );
            }

            // 5. Parallel Channel
            if (d.type === 'parallel_channel') {
              const cWidth = d.channelWidth || 35;
              const dx = pt2.x - pt1.x;
              const dy = pt2.y - pt1.y;
              const angle = Math.atan2(dy, dx);
              const perpAngle = angle - Math.PI / 2;

              const offX = Math.cos(perpAngle) * cWidth;
              const offY = Math.sin(perpAngle) * cWidth;

              const upperP1 = { x: pt1.x + offX, y: pt1.y + offY };
              const upperP2 = { x: pt2.x + offX, y: pt2.y + offY };
              const lowerP1 = { x: pt1.x - offX, y: pt1.y - offY };
              const lowerP2 = { x: pt2.x - offX, y: pt2.y - offY };

              const polyPoints = `${upperP1.x},${upperP1.y} ${upperP2.x},${upperP2.y} ${lowerP2.x},${lowerP2.y} ${lowerP1.x},${lowerP1.y}`;

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  {/* Channel Fill */}
                  <polygon
                    points={polyPoints}
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="none"
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  {/* Upper & Lower Channel Lines */}
                  <line x1={upperP1.x} y1={upperP1.y} x2={upperP2.x} y2={upperP2.y} stroke={d.color || '#38BDF8'} strokeWidth={d.strokeWidth || 1.5} />
                  <line x1={lowerP1.x} y1={lowerP1.y} x2={lowerP2.x} y2={lowerP2.y} stroke={d.color || '#38BDF8'} strokeWidth={d.strokeWidth || 1.5} />
                  {/* Median Line */}
                  <line x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y} stroke={d.color || '#38BDF8'} strokeWidth={1} strokeDasharray="4,4" />

                  {/* Median endpoints — drag to reposition / resize the channel */}
                  <circle
                    cx={pt1.x} cy={pt1.y} r={isSelected ? 5 : 3.5}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                  />
                  <circle
                    cx={pt2.x} cy={pt2.y} r={isSelected ? 5 : 3.5}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                  />

                  {/* Channel Width Handle */}
                  {isSelected && (
                    <circle
                      cx={upperP1.x} cy={upperP1.y} r={5}
                      fill="#FFF" stroke="#2962FF" strokeWidth={1.5}
                      style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                      onMouseDown={(e) => beginLegacyDrag(e, d.id, 'channel')}
                    />
                  )}
                </g>
              );
            }

            // 6. Long / Short Position (Risk:Reward Position Tool)
            if (d.type === 'long_position' || d.type === 'short_position') {
              const isLong = d.type === 'long_position';
              const entryY = pt1.y;
              const entryPrice = d.startPrice || 1000;
              const targetPrice = d.targetPrice || (isLong ? entryPrice * 1.03 : entryPrice * 0.97);
              const stopPrice   = d.stopPrice   || (isLong ? entryPrice * 0.985 : entryPrice * 1.015);

              const targetCoord = chartToCoordCached(d.startLogical, targetPrice, pt1.x, pt1.y - 60, d.startTime, d.startFrac, d.startOffMs);
              const stopCoord   = chartToCoordCached(d.startLogical, stopPrice, pt1.x, pt1.y + 40, d.startTime, d.startFrac, d.startOffMs);

              const targetY = targetCoord.y;
              const stopY   = stopCoord.y;

              const boxWidth = Math.max(160, Math.abs(pt2.x - pt1.x));
              const startX   = pt1.x;

              const targetDelta = Math.abs(targetPrice - entryPrice);
              const stopDelta   = Math.abs(stopPrice - entryPrice);
              const rrRatio     = stopDelta > 0 ? (targetDelta / stopDelta) : 0;
              const targetPct   = entryPrice > 0 ? ((targetDelta / entryPrice) * 100) : 0;
              const stopPct     = entryPrice > 0 ? ((stopDelta / entryPrice) * 100) : 0;

              const targetBoxTop    = Math.min(entryY, targetY);
              const targetBoxHeight = Math.abs(targetY - entryY);
              const stopBoxTop      = Math.min(entryY, stopY);
              const stopBoxHeight   = Math.abs(stopY - entryY);

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  {/* Target Box (Green) */}
                  <rect
                    x={startX} y={targetBoxTop} width={boxWidth} height={targetBoxHeight}
                    fill="rgba(16, 185, 129, 0.18)"
                    stroke="#10B981" strokeWidth={1}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />

                  {/* Stop Loss Box (Red) */}
                  <rect
                    x={startX} y={stopBoxTop} width={boxWidth} height={stopBoxHeight}
                    fill="rgba(239, 83, 80, 0.18)"
                    stroke="#EF5350" strokeWidth={1}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />

                  {/* Entry Line */}
                  <line
                    x1={startX} y1={entryY} x2={startX + boxWidth} y2={entryY}
                    stroke="#38BDF8" strokeWidth={1.5} strokeDasharray="3,3"
                  />

                  {/* Info Badge */}
                  <rect
                    x={startX + 6} y={entryY - 12} width={boxWidth - 12} height={24} rx={4}
                    fill="rgba(15, 23, 42, 0.95)" stroke="#6366F1" strokeWidth={1}
                  />
                  <text
                    x={startX + 12} y={entryY + 4}
                    fill="#FFF" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace"
                  >
                    R:R {rrRatio.toFixed(2)} · TP +{currSym}{targetDelta.toFixed(1)} (+{targetPct.toFixed(1)}%) · SL -{currSym}{stopDelta.toFixed(1)} (-{stopPct.toFixed(1)}%)
                  </text>

                  {/* Target Handle */}
                  <circle
                    cx={startX + boxWidth / 2} cy={targetY} r={5}
                    fill="#10B981" stroke="#FFF" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'target')}
                  />

                  {/* Stop Handle */}
                  <circle
                    cx={startX + boxWidth / 2} cy={stopY} r={5}
                    fill="#EF5350" stroke="#FFF" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'stop')}
                  />

                  {/* Width Handle (right edge) — drag to extend the boxes in time */}
                  {isSelected && (
                    <circle
                      cx={startX + boxWidth} cy={entryY} r={5}
                      fill="#FFF" stroke="#2962FF" strokeWidth={1.5}
                      style={{ pointerEvents: 'all', cursor: 'ew-resize' }}
                      onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                    />
                  )}
                </g>
              );
            }

            // 7. Fibonacci Retracement
            if (d.type === 'fibonacci') {
              const minY = Math.min(pt1.y, pt2.y);
              const maxY = Math.max(pt1.y, pt2.y);
              const height = maxY - minY;
              const startX = Math.min(pt1.x, pt2.x);
              const width = Math.max(300, Math.abs(pt2.x - pt1.x));

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onMouseDown={(e) => startBodyDrag(e, d.id)}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  {FIBONACCI_LEVELS.slice(0, -1).map((fib, idx) => {
                    const nextFib = FIBONACCI_LEVELS[idx + 1];
                    const y1 = pt1.y < pt2.y ? minY + height * fib.level : maxY - height * fib.level;
                    const y2 = pt1.y < pt2.y ? minY + height * nextFib.level : maxY - height * nextFib.level;
                    const bandTop = Math.min(y1, y2);
                    const bandHeight = Math.abs(y2 - y1);
                    if (d.backgroundVisible === false) return null;
                    return (
                      <rect
                        key={`band-${fib.level}`}
                        x={startX} y={bandTop} width={width} height={bandHeight}
                        fill={fib.fill}
                        opacity={d.backgroundOpacity != null ? Math.min(1, d.backgroundOpacity * 8) : 1}
                      />
                    );
                  })}

                  {(d.fibLevelsVisible ?? FIBONACCI_LEVELS.map((f) => f.level)).length >= 0 && FIBONACCI_LEVELS.filter((fib) => (d.fibLevelsVisible ?? FIBONACCI_LEVELS.map((f) => f.level)).includes(fib.level)).map((fib) => {
                    const y = pt1.y < pt2.y ? minY + height * fib.level : maxY - height * fib.level;
                    return (
                      <g key={fib.level}>
                        <line
                          x1={startX} y1={y} x2={startX + width} y2={y}
                          stroke={fib.color} strokeWidth={1}
                          strokeDasharray={isSelected ? '2,2' : 'none'}
                        />
                        <text
                          x={startX + 6} y={y - 4}
                          fill={fib.color} fontSize="10" fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {fib.label}
                        </text>
                      </g>
                    );
                  })}

                  {isSelected && (
                    <>
                      <circle
                        cx={pt1.x} cy={pt1.y} r={5} fill="#FFF" stroke="#2962FF" strokeWidth={2}
                        style={{ pointerEvents: 'all', cursor: 'grab' }}
                        onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                      />
                      <circle
                        cx={pt2.x} cy={pt2.y} r={5} fill="#FFF" stroke="#2962FF" strokeWidth={2}
                        style={{ pointerEvents: 'all', cursor: 'grab' }}
                        onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                      />
                    </>
                  )}
                </g>
              );
            }

            // 8. Freehand Brush
            if (d.type === 'brush' && d.points?.length > 1) {
              const livePoints = d.points.map(pt => chartToCoordCached(pt.logical, pt.price, pt.x, pt.y, pt.time, pt.frac, pt.offMs));
              const pathData = livePoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
              return (
                <path
                  key={d.id}
                  d={pathData}
                  fill="none"
                  stroke={d.color || '#38BDF8'}
                  strokeWidth={d.strokeWidth || 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  onMouseDown={(e) => startBodyDrag(e, d.id)}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                />
              );
            }

            // 9. Rectangle Zone
            if (d.type === 'rectangle') {
              const x = Math.min(pt1.x, pt2.x);
              const y = Math.min(pt1.y, pt2.y);
              const w = Math.abs(pt2.x - pt1.x);
              const h = Math.abs(pt2.y - pt1.y);
              // Corners: 0=TL, 1=TR, 2=BL, 3=BR. Dragging a corner keeps the
              // opposite corner fixed and redefines the box from
              // (opposite, cursor) — a true box resize from the grabbed
              // corner, like TradingView (handled by the `rect:i` branch in
              // processMove).
              const corners = [
                { cx: x, cy: y },
                { cx: x + w, cy: y },
                { cx: x, cy: y + h },
                { cx: x + w, cy: y + h },
              ];
              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <rect
                    x={x} y={y} width={w} height={h}
                    fill={d.backgroundVisible === false ? 'transparent' : (d.backgroundColor || 'rgba(56, 189, 248, 0.12)')}
                    fillOpacity={d.backgroundVisible === false ? 0 : undefined}
                    stroke={d.borderVisible === false ? 'transparent' : (d.borderColor || d.color || '#38BDF8')}
                    strokeWidth={d.borderWidth ?? d.strokeWidth ?? 1.5}
                    strokeDasharray={isSelected ? '4,4' : 'none'}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  {isSelected && (
                    <>
                      {corners.map((corner, i) => (
                        <circle
                          key={`corner-${i}`}
                          cx={corner.cx} cy={corner.cy} r={4.5} fill="#FFF" stroke="#2962FF" strokeWidth={1.5}
                          style={{ pointerEvents: 'all', cursor: (i === 0 || i === 3) ? 'nwse-resize' : 'nesw-resize' }}
                          onMouseDown={(e) => beginLegacyDrag(e, d.id, `rect:${i}`)}
                        />
                      ))}
                    </>
                  )}
                </g>
              );
            }

            // 10. Ruler / Measurement
            if (d.type === 'ruler') {
              const dx = Math.abs(pt2.x - pt1.x);
              const dy = pt1.y - pt2.y;
              const x = Math.min(pt1.x, pt2.x);
              const y = Math.min(pt1.y, pt2.y);
              const w = Math.abs(pt2.x - pt1.x);
              const h = Math.abs(pt2.y - pt1.y);
              const priceDelta = (d.startPrice != null && d.endPrice != null) ? d.endPrice - d.startPrice : dy * 0.45;
              const pricePercent = d.startPrice ? (priceDelta / d.startPrice) * 100 : (dy * 0.08);
              // Bar count from anchored logical indices (zoom-independent);
              // pixel guess is only a fallback for legacy drawings w/o anchors.
              const rulerBars = (d.startLogical != null && d.endLogical != null)
                ? Math.max(1, Math.round(Math.abs(d.endLogical - d.startLogical)))
                : Math.max(1, Math.round(dx / 8));

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <rect
                    x={x} y={y} width={w} height={h}
                    fill={priceDelta >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,83,80,0.15)'}
                    stroke={priceDelta >= 0 ? '#10B981' : '#EF5350'}
                    strokeWidth={1}
                    strokeDasharray="3,3"
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  <text x={x + 6} y={y + 14} fill="#FFF" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                    {priceDelta >= 0 ? '+' : ''}{priceDelta.toFixed(2)} ({pricePercent.toFixed(2)}%) · {rulerBars} bars
                  </text>
                  {isSelected && (
                    <>
                      <circle
                        cx={pt1.x} cy={pt1.y} r={5} fill="#FFF" stroke="#2962FF" strokeWidth={1.5}
                        style={{ pointerEvents: 'all', cursor: 'grab' }}
                        onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                      />
                      <circle
                        cx={pt2.x} cy={pt2.y} r={5} fill="#FFF" stroke="#2962FF" strokeWidth={1.5}
                        style={{ pointerEvents: 'all', cursor: 'grab' }}
                        onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                      />
                    </>
                  )}
                </g>
              );
            }

            // 11. Text Note
            if (d.type === 'text') {
              return (
                <text
                  key={d.id}
                  x={pt1.x} y={pt1.y}
                  fill={d.color || '#F0F0FF'}
                  fontSize="12" fontWeight="600" fontFamily="Inter, sans-serif"
                  onMouseDown={(e) => startBodyDrag(e, d.id)}
                  onDoubleClick={(e) => handleShapeDoubleClick(e, d)}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                >
                  {d.text}
                </text>
              );
            }

            // 12. Sticker Emoji
            if (d.type === 'sticker') {
              return (
                <text
                  key={d.id}
                  x={pt1.x - 10} y={pt1.y + 10}
                  fontSize="22"
                  onMouseDown={(e) => startBodyDrag(e, d.id)}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer', userSelect: 'none' }}
                >
                  {d.emoji}
                </text>
              );
            }

            return null;
          })}

          {/* ── Active Drawing Preview ── */}
          {currentDraw && (
            <>
              {/* Registry preview: every extended tool draws as-you-go through
                  the same renderer as the committed shape. Pointer events are
                  disabled so the preview never swallows the drag. When a
                  multi-anchor tool has too few points for its full renderer
                  (which returns null), the anchor dots + dashed guide below
                  still give placement feedback. */}
              {previewIsExtended && (
                <g style={{ pointerEvents: 'none' }} opacity={0.92}>
                  <DrawingShape
                    drawing={{ ...currentDraw, id: `preview-${currentDraw.id}` }}
                    points={previewAnchors}
                    surface={surfaceSize}
                    currency={currSym}
                    timeframeMs={timeframeMs}
                    toX={logicalToX}
                    toY={priceToY}
                    candles={candles}
                    selected={false}
                    handlers={{}}
                    onHandleDown={() => {}}
                    onDoubleClick={() => {}}
                  />
                  {currentDraw.pending && previewAnchors.length > 0 && (
                    <g>
                      {previewAnchors.map((pt, i) => (
                        <circle key={`pv-${i}`} cx={pt.x} cy={pt.y} r={3.5} fill="none" stroke={activeColor} strokeWidth={1.5} strokeDasharray="3 2" />
                      ))}
                      {previewAnchors.length > 1 && (
                        <polyline
                          points={previewAnchors.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                          fill="none"
                          stroke={activeColor}
                          strokeWidth={1}
                          strokeDasharray="4 3"
                          opacity={0.8}
                        />
                      )}
                      {previewSpec && typeof previewSpec.points === 'number' && previewSpec.points >= 3 && (
                        <text x={previewAnchors[previewAnchors.length - 1].x + 10} y={previewAnchors[previewAnchors.length - 1].y - 10} fill={activeColor} fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                          {`${pendingPoints.length + 1} of ${previewSpec.points}`}
                        </text>
                      )}
                      {currentDraw.polyline && (
                        <text x={previewAnchors[previewAnchors.length - 1].x + 10} y={previewAnchors[previewAnchors.length - 1].y + 16} fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                          double-click / Enter to finish · Esc to cancel
                        </text>
                      )}
                    </g>
                  )}
                </g>
              )}
              {currentDraw.type === 'trendline' && (
                <line
                  x1={currentDraw.startX} y1={currentDraw.startY}
                  x2={currentDraw.endX} y2={currentDraw.endY}
                  stroke={activeColor} strokeWidth={activeStrokeWidth} strokeDasharray="4,4"
                />
              )}
              {currentDraw.type === 'ray' && (
                <line
                  x1={currentDraw.startX} y1={currentDraw.startY}
                  x2={currentDraw.endX} y2={currentDraw.endY}
                  stroke={activeColor} strokeWidth={activeStrokeWidth} strokeDasharray="4,4"
                />
              )}
              {currentDraw.type === 'parallel_channel' && (() => {
                const cWidth = currentDraw.channelWidth || 35;
                const pdx = currentDraw.endX - currentDraw.startX;
                const pdy = currentDraw.endY - currentDraw.startY;
                const pAngle = Math.atan2(pdy, pdx) - Math.PI / 2;
                const pOffX = Math.cos(pAngle) * cWidth;
                const pOffY = Math.sin(pAngle) * cWidth;
                return (
                  <g stroke={activeColor} strokeWidth={activeStrokeWidth} strokeDasharray="4,4">
                    <line
                      x1={currentDraw.startX + pOffX} y1={currentDraw.startY + pOffY}
                      x2={currentDraw.endX + pOffX} y2={currentDraw.endY + pOffY}
                    />
                    <line
                      x1={currentDraw.startX} y1={currentDraw.startY}
                      x2={currentDraw.endX} y2={currentDraw.endY}
                    />
                    <line
                      x1={currentDraw.startX - pOffX} y1={currentDraw.startY - pOffY}
                      x2={currentDraw.endX - pOffX} y2={currentDraw.endY - pOffY}
                    />
                  </g>
                );
              })()}
              {currentDraw.type === 'horizontal_line' && (
                <line
                  x1={0} y1={currentDraw.startY}
                  x2="100%" y2={currentDraw.startY}
                  stroke={activeColor} strokeWidth={activeStrokeWidth} strokeDasharray="4,4"
                />
              )}
              {currentDraw.type === 'fibonacci' && (
                <g>
                  {FIBONACCI_LEVELS.map((fib) => {
                    const minY = Math.min(currentDraw.startY, currentDraw.endY);
                    const maxY = Math.max(currentDraw.startY, currentDraw.endY);
                    const height = maxY - minY;
                    const y = currentDraw.startY < currentDraw.endY ? minY + height * fib.level : maxY - height * fib.level;
                    return (
                      <line
                        key={fib.level}
                        x1={Math.min(currentDraw.startX, currentDraw.endX)}
                        y1={y}
                        x2={Math.min(currentDraw.startX, currentDraw.endX) + Math.max(300, Math.abs(currentDraw.endX - currentDraw.startX))}
                        y2={y}
                        stroke={fib.color} strokeWidth={1} strokeDasharray="3,3"
                      />
                    );
                  })}
                </g>
              )}
              {currentDraw.type === 'brush' && currentDraw.points?.length > 1 && (
                <path
                  d={currentDraw.points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')}
                  fill="none" stroke={activeColor} strokeWidth={activeStrokeWidth} strokeLinecap="round"
                />
              )}
              {currentDraw.type === 'rectangle' && (
                <rect
                  x={Math.min(currentDraw.startX, currentDraw.endX)}
                  y={Math.min(currentDraw.startY, currentDraw.endY)}
                  width={Math.abs(currentDraw.endX - currentDraw.startX)}
                  height={Math.abs(currentDraw.endY - currentDraw.startY)}
                  fill="rgba(56, 189, 248, 0.15)" stroke={activeColor} strokeWidth={activeStrokeWidth} strokeDasharray="4,4"
                />
              )}
              {currentDraw.type === 'ruler' && (
                <rect
                  x={Math.min(currentDraw.startX, currentDraw.endX)}
                  y={Math.min(currentDraw.startY, currentDraw.endY)}
                  width={Math.abs(currentDraw.endX - currentDraw.startX)}
                  height={Math.abs(currentDraw.endY - currentDraw.startY)}
                  fill="rgba(59, 130, 246, 0.2)" stroke="#3B82F6" strokeWidth={1} strokeDasharray="4,4"
                />
              )}
            </>
          )}

          {/* ── Magnet Snapping Visual Indicator (Glowing Cyan Dot) ── */}
          {snapIndicator && (
            <g>
              <circle
                cx={snapIndicator.x} cy={snapIndicator.y} r={7}
                fill="none" stroke="#00E5FF" strokeWidth={2}
                opacity={0.85}
              />
              <circle
                cx={snapIndicator.x} cy={snapIndicator.y} r={3.5}
                fill="#00E5FF"
              />
              <rect
                x={snapIndicator.x + 10} y={snapIndicator.y - 14}
                width={70} height={14} rx={2}
                fill="rgba(0, 229, 255, 0.2)" stroke="#00E5FF" strokeWidth={0.75}
              />
              <text
                x={snapIndicator.x + 14} y={snapIndicator.y - 3}
                fill="#00E5FF" fontSize="8.5" fontWeight="800" fontFamily="JetBrains Mono, monospace"
              >
                {snapIndicator.label}
              </text>
            </g>
          )}
        </svg>
      )}

      {/* Floating Text Note Input */}
      {textInputPos && (
        <div style={{
          position: 'absolute',
          left: textInputPos.x + (isOpen ? toolbarWidth : 0),
          top: textInputPos.y,
          zIndex: 60,
          background: '#131722',
          border: '1px solid #2962FF',
          borderRadius: 6,
          padding: 4,
          display: 'flex',
          gap: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
        }}>
          <input
            type="text"
            placeholder="Type text note..."
            value={textInputVal}
            onChange={(e) => setTextInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddText();
              if (e.key === 'Escape') {
                setTextInputPos(null);
                if (!isCursorMode(activeToolRef.current)) {
                  setActiveTool(DEFAULT_TOOL);
                }
                setChartLocked(false);
              }
            }}
            autoFocus
            style={{
              background: '#090C18',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              padding: '4px 8px',
              color: '#fff',
              fontSize: '0.75rem',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAddText}
            style={{
              background: '#2962FF',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
      )}

      {/* Stickers Emoji Picker */}
      {showStickerMenu && stickerPos && (
        <div style={{
          position: 'absolute',
          left: stickerPos.x + (isOpen ? toolbarWidth : 0),
          top: stickerPos.y,
          zIndex: 60,
          background: '#131722',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 8,
          padding: 8,
          display: 'flex',
          gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
        }}>
          {['🚀', '📈', '📉', '🎯', '⭐', '🔥', '👍', '❌', '💰', '🛡️'].map((emoji) => (
            <span
              key={emoji}
              onClick={() => handleAddSticker(emoji)}
              style={{ fontSize: 20, cursor: 'pointer', transition: 'transform 0.1s' }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}

      {/* ── Right-Click Context Menu (TradingView object menu) ── */}
      {contextMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 61 }}
            onMouseDown={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div style={{
            position: 'fixed',
            left: contextMenu.clientX,
            top: contextMenu.clientY,
            zIndex: 62,
            minWidth: 176,
            padding: 5,
            background: '#111827',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: 8,
            boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
            userSelect: 'none',
          }}>
            {contextTarget ? (
              <>
                <MenuItem icon={<Copy size={13} />} label="Copy" onClick={() => { copyDrawing(contextTarget.id); setContextMenu(null); }} />
                <MenuItem icon={<Layers size={13} />} label="Clone" onClick={() => { cloneDrawing(contextTarget.id); setContextMenu(null); }} />
                <MenuItem
                  icon={hiddenIds.has(contextTarget.id) ? <Eye size={13} /> : <EyeOff size={13} />}
                  label={hiddenIds.has(contextTarget.id) ? 'Show' : 'Hide'}
                  onClick={() => {
                    setHiddenIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(contextTarget.id)) next.delete(contextTarget.id);
                      else next.add(contextTarget.id);
                      return next;
                    });
                    setContextMenu(null);
                  }}
                />
                <MenuItem icon={<ArrowUpRight size={13} />} label="Bring to front" onClick={() => { bringToFront(contextTarget.id); setContextMenu(null); }} />
                <MenuItem icon={<ArrowDownRight size={13} />} label="Send to back" onClick={() => { sendToBack(contextTarget.id); setContextMenu(null); }} />
                <div style={{ height: 1, background: 'rgba(148,163,184,0.18)', margin: '4px 2px' }} />
                <MenuItem icon={<Trash2 size={13} />} label="Remove" danger onClick={() => { removeDrawing(contextTarget.id); setContextMenu(null); }} />
              </>
            ) : (
              <>
                {menuFavouriteTools.length > 0 && (
                  <>
                    <div style={{ padding: '2px 8px 3px', color: '#38BDF8', fontSize: 9, fontWeight: 800, letterSpacing: 0.6 }}>
                      ★ FAVORITE TOOLS
                    </div>
                    {menuFavouriteTools.map(({ spec, digit }) => (
                      <MenuItem
                        key={`fav-${spec.id}`}
                        icon={<ToolIcon toolId={spec.id} size={13} />}
                        label={digit ? `${spec.label}  [${digit}]` : spec.label}
                        onClick={() => { handleSelectTool(spec.id); setContextMenu(null); }}
                      />
                    ))}
                    <div style={{ height: 1, background: 'rgba(148,163,184,0.18)', margin: '4px 2px' }} />
                  </>
                )}
                <MenuItem icon={<Copy size={13} />} label="Paste" disabled={!clipboard} onClick={() => { pasteClipboard(); setContextMenu(null); }} />
                <MenuItem icon={<Trash2 size={13} />} label="Remove all" danger onClick={() => { handleClearAll(); setContextMenu(null); }} />
              </>
            )}
          </div>
        </>
      )}


      {/* ── Object Tree (TradingView object list) ── */}
      {showObjectTree && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 60,
          width: 240,
          maxHeight: '60%',
          overflowY: 'auto',
          padding: 8,
          background: '#0F131D',
          border: '1px solid rgba(148,163,184,0.25)',
          borderRadius: 8,
          boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#7DD3FC', fontSize: 11, fontWeight: 800, letterSpacing: 0.4 }}>OBJECTS ({drawings.length})</span>
            <button type="button" onClick={() => setShowObjectTree(false)} style={{ background: 'transparent', border: 0, color: '#64748B', cursor: 'pointer', padding: 0 }}>
              <X size={14} />
            </button>
          </div>
          {drawings.length === 0 ? (
            <div style={{ color: '#475569', fontSize: 11, textAlign: 'center', padding: '14px 0' }}>No objects yet</div>
          ) : (
            drawings.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedDrawingId(d.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 6px',
                  borderRadius: 5,
                  cursor: 'pointer',
                  background: d.id === selectedDrawingId ? 'rgba(41,98,255,0.18)' : 'transparent',
                  opacity: hiddenIds.has(d.id) ? 0.45 : 1,
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: d.color || '#38BDF8', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 11, color: '#CBD5E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getToolSpec(d.type)?.label || (d.type === 'sticker' ? 'Stickers & Emoji' : d.type.replace('_', ' '))}
                </span>
                <button
                  type="button"
                  title={hiddenIds.has(d.id) ? 'Show' : 'Hide'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setHiddenIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(d.id)) next.delete(d.id);
                      else next.add(d.id);
                      return next;
                    });
                  }}
                  style={{ background: 'transparent', border: 0, color: hiddenIds.has(d.id) ? '#475569' : '#94A3B8', cursor: 'pointer', padding: 0 }}
                >
                  {hiddenIds.has(d.id) ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button
                  type="button"
                  title="Remove"
                  onClick={(e) => { e.stopPropagation(); removeDrawing(d.id); }}
                  style={{ background: 'transparent', border: 0, color: '#EF5350', cursor: 'pointer', padding: 0 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Inline text editor for annotation objects (double-click) ── */}
      {textEdit && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 60,
          background: '#131722',
          border: '1px solid #2962FF',
          borderRadius: 6,
          padding: 4,
          display: 'flex',
          gap: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
        }}>
          <input
            type="text"
            value={textEditVal}
            onChange={(e) => setTextEditVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTextEdit();
              if (e.key === 'Escape') setTextEdit(null);
            }}
            autoFocus
            style={{
              background: '#090C18',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              padding: '4px 8px',
              color: '#fff',
              fontSize: '0.75rem',
              outline: 'none',
              minWidth: 180,
            }}
          />
          <button
            onClick={commitTextEdit}
            style={{ background: '#2962FF', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
          >
            OK
          </button>
        </div>
      )}

    </>
  );
}

function MenuItem({ icon, label, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 8px',
        border: 0,
        borderRadius: 5,
        background: 'transparent',
        color: disabled ? '#475569' : danger ? '#F87171' : '#CBD5E1',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 12,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(148,163,184,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {icon}
      {label}
    </button>
  );
}

