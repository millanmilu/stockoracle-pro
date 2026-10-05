import { useCallback } from 'react';

// --- render-path coordinate cache ---

export function useDrawingCoordCache(ctx) {
  const {
    candleRef, candles, chartRef, chartToCoord, coordCacheRef, resolvedLogical, syncTick,
  } = ctx;

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
  return { chartToCoordCached, logicalToX, priceToY, resolveAnchorsCached };
}
