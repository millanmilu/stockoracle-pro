import { DEFAULT_TOOL, getToolSpec, isExtendedTool } from './drawingToolCatalog';
import { getEventPos } from './drawingToolEvents';
import toast from 'react-hot-toast';

// --- SVG mouseup: gesture commit ---

export function handleSvgMouseUpImpl(e, ctx) {
  const {
    activeTool, bodyGestureRef, commitExtendedDrawing, coordToChart, currentDraw, dragMovedRef,
    dragSnapshotRef, draggingHandle, drawingsRef, findMagnetSnap, flushPendingMoveSync,
    fracForLogical, interval, isDraggingRef, isDrawing, persistDrawings, saveDrawingsWithHistory,
    setActiveTool, setChartLocked, setCurrentDraw, setDragStartPos, setDraggingHandle,
    setDrawings, setIsDrawing, setPendingPoints, setRedoStack, setSelectedDrawingId,
    setUndoStack, stayInDrawMode, svgRef, timeForLogical, timeframeMs, toAnchor, upHandledRef,
  } = ctx;

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
        const up = getEventPos(e, svgRef);
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
      if (upSpec?.points === 2) {
        const first = a || {
          x: currentDraw.startX,
          y: currentDraw.startY,
          logical: currentDraw.startLogical,
          price: currentDraw.startPrice,
          time: currentDraw.startTime,
          frac: currentDraw.startFrac,
          offMs: currentDraw.startOffMs,
          tf: currentDraw.tf ?? interval,
        };
        setPendingPoints([first]);
        if (isExtendedTool(currentDraw.type)) {
          setCurrentDraw({ ...currentDraw, points: [first], pending: true, dragAnchor: false });
        } else {
          setCurrentDraw({
            ...currentDraw,
            endX: first.x,
            endY: first.y,
            endLogical: first.logical,
            endPrice: first.price,
            endTime: first.time,
            endFrac: first.frac,
            endOffMs: first.offMs,
            pending: true,
            legacyPending: true,
          });
        }
        setIsDrawing(true);
        isDraggingRef.current = true;
        setChartLocked(false);
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
        const up = getEventPos(e, svgRef);
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

    if (!isValid && upSpec?.points === 2) {
      const first = {
        x: commitDraw.startX,
        y: commitDraw.startY,
        logical: commitDraw.startLogical,
        price: commitDraw.startPrice,
        time: commitDraw.startTime,
        frac: commitDraw.startFrac,
        offMs: commitDraw.startOffMs,
        tf: commitDraw.tf ?? interval,
      };
      setPendingPoints([first]);
      setCurrentDraw({
        ...commitDraw,
        endX: first.x,
        endY: first.y,
        endLogical: first.logical,
        endPrice: first.price,
        endTime: first.time,
        endFrac: first.frac,
        endOffMs: first.offMs,
        pending: true,
        legacyPending: true,
      });
      setIsDrawing(true);
      isDraggingRef.current = true;
      setChartLocked(false);
      return;
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
}
