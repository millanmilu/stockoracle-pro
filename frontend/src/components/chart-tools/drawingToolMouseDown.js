import { DEFAULT_TOOL, getToolSpec, isExtendedTool } from './drawingToolCatalog';
import { getEventPos } from './drawingToolEvents';
import { intervalToMs } from './drawingToolUtils';
import toast from 'react-hot-toast';

// --- SVG mousedown: tool placement ---

export function handleSvgMouseDownImpl(e, ctx) {
  const {
    activeColor, activeLineStyle, activeStrokeWidth, activeTool, candles, chartReady,
    commitExtendedDrawing, coordToChart, currSym, currentDraw, draggingHandle, drawingsRef,
    findMagnetSnap, fracForLogical, interval, isCursorMode, isDraggingRef, lockAllDrawings,
    moveRafRef, pendingMoveRef, pendingPoints, saveDrawingsWithHistory, selectedDrawingId,
    setActiveTool, setChartLocked, setCurrentDraw, setIsDrawing, setPendingPoints,
    setSelectedDrawingId, setShowStickerMenu, setStickerPos, setTextInputPos, setTextInputVal,
    stayInDrawMode, svgRectRef, svgRef, timeForLogical, toAnchor, upHandledRef,
  } = ctx;

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

    const { x, y } = getEventPos(e, svgRef);
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
    if (spec?.points === 2 && currentDraw?.pending && currentDraw.type === activeTool && pendingPoints.length === 1) {
      const start = pendingPoints[0];
      if (isExtendedTool(activeTool)) {
        commitExtendedDrawing(activeTool, [start, chartAnchor]);
      } else {
        const completedDrawing = {
          ...currentDraw,
          pending: undefined,
          legacyPending: undefined,
          startX: start.x,
          startY: start.y,
          startLogical: start.logical,
          startPrice: start.price,
          startTime: start.time,
          startFrac: start.frac,
          startOffMs: start.offMs,
          endX: chartAnchor.x,
          endY: chartAnchor.y,
          endLogical: chartAnchor.logical,
          endPrice: chartAnchor.price,
          endTime: chartAnchor.time,
          endFrac: chartAnchor.frac,
          endOffMs: chartAnchor.offMs,
        };
        saveDrawingsWithHistory([...drawingsRef.current, completedDrawing], true);
        setSelectedDrawingId(completedDrawing.id);
        setPendingPoints([]);
        setCurrentDraw(null);
        setIsDrawing(false);
        isDraggingRef.current = false;
        setChartLocked(false);
        if (!stayInDrawMode) setActiveTool(DEFAULT_TOOL);
      }
      toast.success(`${spec.label} completed`);
      return;
    }

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
}
