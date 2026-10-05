import { useEffect, useRef, useState } from 'react';
import { isDrawingVisibleOn } from './drawingSettingsSchema';

// --- Drag-marquee multi-select (DrawingSelectionManager service) ---
//
// Shift+drag on empty chart space rubber-bands a selection rect and selects
// every drawing whose anchor bounding box intersects it. Capture-phase window
// listeners + chart lock mean the chart never pans mid-marquee, and normal
// pan/zoom is untouched (marquee ONLY starts with Shift held, in a cursor /
// selection mode, on empty pane space — never on shapes, buttons or inputs).
//
// Returns { marquee } — client-space rect or null — for the caller to paint.

function candidatesOf(drawing, resolveAnchorsCached, chartToCoordCached) {
  const pts = [];
  try {
    const resolved = resolveAnchorsCached?.(drawing);
    if (Array.isArray(resolved)) {
      for (const p of resolved) {
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) pts.push(p);
      }
    }
  } catch (_) {}
  try {
    if (Array.isArray(drawing?.points)) {
      for (const p of drawing.points) {
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) pts.push({ x: p.x, y: p.y });
      }
    }
    if (typeof chartToCoordCached === 'function') {
      const legs = [
        [drawing.startLogical, drawing.startPrice, drawing.startX, drawing.startY,
         drawing.startTime, drawing.startFrac, drawing.startOffMs],
        [drawing.endLogical, drawing.endPrice, drawing.endX, drawing.endY,
         drawing.endTime, drawing.endFrac, drawing.endOffMs],
      ];
      for (const args of legs) {
        if (args[0] == null && args[1] == null && args[2] == null) continue;
        const p = chartToCoordCached(...args);
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) pts.push(p);
      }
      if (drawing.startX != null && drawing.endX == null && Number.isFinite(drawing.startX)) {
        pts.push({ x: drawing.startX, y: drawing.startY });
      }
    }
  } catch (_) {}
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = pts.length === 1 ? 12 : 8;
  return {
    x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad,
    y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad,
  };
}

export function useDrawingMarquee(ctx) {
  const {
    activeTool, chartToCoordCached, drawingsRef, interval, isCursorMode,
    mainPaneRef, hiddenIds, resolveAnchorsCached, setChartLocked,
    setSelectedDrawingId, setSelectedDrawingIds, svgRef,
  } = ctx;

  const [marquee, setMarquee] = useState(null); // {x0,y0,x1,y1} client coords
  const gestureRef = useRef(null); // {startX,startY} + pane rect
  const rafRef = useRef(null);

  // Fresh mirror for capture-phase listeners (registered once).
  const liveRef = useRef(null);
  liveRef.current = {
    activeTool, chartToCoordCached, drawingsRef, interval, isCursorMode,
    hiddenIds, resolveAnchorsCached, setChartLocked,
    setSelectedDrawingId, setSelectedDrawingIds,
  };

  useEffect(() => {
    const paneOf = () => {
      const fromMain = mainPaneRef?.current;
      if (fromMain) return fromMain;
      try {
        return svgRef?.current?.parentElement || null;
      } catch (_) {
        return null;
      }
    };

    const isUiTarget = (t) => {
      try {
        if (!(t instanceof Element)) return true;
        return Boolean(t.closest('button, input, select, textarea, a, [data-drawing-ui], [data-drawing-id]'));
      } catch (_) {
        return true;
      }
    };

    const onDown = (e) => {
      const live = liveRef.current;
      if (!e?.shiftKey || (e.button != null && e.button !== 0)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!live.isCursorMode?.(live.activeTool)) return;
      if (gestureRef.current) return;
      const pane = paneOf();
      if (!pane) return;
      let t = e.target;
      try {
        if (!(t instanceof Node) || !pane.contains(t)) return;
      } catch (_) {
        return;
      }
      if (isUiTarget(t)) return; // shapes / toolbars / inputs keep their behaviour
      // Block the chart's own pan gesture before it sees mousedown.
      try {
        e.stopPropagation();
        e.preventDefault();
      } catch (_) {}
      let rect = null;
      try {
        rect = pane.getBoundingClientRect();
      } catch (_) {}
      gestureRef.current = { startX: e.clientX, startY: e.clientY, rect };
      try {
        live.setChartLocked?.(true);
      } catch (_) {}
      setMarquee({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY });
    };

    const onMove = (e) => {
      if (!gestureRef.current) return;
      const g = gestureRef.current;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!gestureRef.current) return;
        setMarquee({ x0: g.startX, y0: g.startY, x1: e.clientX, y1: e.clientY });
      });
    };

    const finish = (commit) => {
      const g = gestureRef.current;
      gestureRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const live = liveRef.current;
      try {
        live.setChartLocked?.(false);
      } catch (_) {}
      if (commit && g) {
        const end = commit === true ? null : commit;
        const cx1 = end ? end.clientX : g.startX;
        const cy1 = end ? end.clientY : g.startY;
        const moved = Math.abs(cx1 - g.startX) + Math.abs(cy1 - g.startY);
        if (moved > 6 && g.rect) {
          const rx0 = Math.min(g.startX, cx1) - g.rect.left;
          const rx1 = Math.max(g.startX, cx1) - g.rect.left;
          const ry0 = Math.min(g.startY, cy1) - g.rect.top;
          const ry1 = Math.max(g.startY, cy1) - g.rect.top;
          const hits = [];
          const all = live.drawingsRef?.current || [];
          for (const d of all) {
            if (!d || d.hidden) continue;
            try {
              if (!isDrawingVisibleOn(d, live.interval)) continue;
            } catch (_) {}
            if (live.hiddenIds?.has?.(d.id)) continue;
            const box = candidatesOf(d, live.resolveAnchorsCached, live.chartToCoordCached);
            if (!box) continue;
            if (box.x0 <= rx1 && box.x1 >= rx0 && box.y0 <= ry1 && box.y1 >= ry0) hits.push(d.id);
          }
          try {
            live.setSelectedDrawingIds?.(hits);
            live.setSelectedDrawingId?.(hits.length ? hits[hits.length - 1] : null);
          } catch (_) {}
        }
      }
      setMarquee(null);
    };

    const onUp = (e) => {
      if (!gestureRef.current) return;
      try {
        e.stopPropagation();
      } catch (_) {}
      finish(e);
    };

    const onKey = (e) => {
      if (e?.key === 'Escape' && gestureRef.current) {
        e.stopPropagation();
        finish(false);
      }
    };

    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      window.removeEventListener('keydown', onKey, true);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      gestureRef.current = null;
    };
  }, [mainPaneRef, svgRef]);

  return { marquee };
}
