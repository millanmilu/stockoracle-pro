import { useCallback, useEffect, useMemo } from 'react';
import { canonicalMs, intervalToMs } from './drawingToolUtils';
import { MAGNET_SNAP_RADIUS, MAGNET_WEAK_RADIUS } from './drawingToolCatalog';

// --- coordinate transforms (chart <-> pixels) ---

export function useDrawingGeometry(ctx) {
  const {
    candleRef, candles, chartReady, chartRef, currSym, interval, magnetMode, mainPaneRef,
    setSyncTick, svgRef, timeframeMs,
  } = ctx;

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
  }, [chartRef, candleRef, candles, chartReady, mainPaneRef, setSyncTick, svgRef]);

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
  return {
    chartToCoord, coordToChart, findMagnetSnap, fracForLogical, resolvedLogical, setChartLocked,
    timeForLogical, timeIndexMap, toAnchor,
  };
}
