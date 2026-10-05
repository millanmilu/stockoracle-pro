import { useCallback } from 'react';
import { CURSOR_TOOLS, DEFAULT_TOOL, getToolSpec } from './drawingToolCatalog';
import { pickTouch } from './drawingToolEvents';

// --- drag & placement gestures ---

export function useDrawingGestures(ctx) {
  const {
    activeTool, bodyGestureRef, buildExtendedDrawing, dragMovedRef, dragSnapshotRef, drawingsRef,
    isDraggingRef, lockAllDrawings, saveDrawingsWithHistory, setActiveTool, setChartLocked,
    setCurrentDraw, setDraggingHandle, setDragStartPos, setIsDrawing, setPendingPoints,
    selectedDrawingIds, setSelectedDrawingId, setSelectedDrawingIds, stayInDrawMode, svgRef, upHandledRef,
  } = ctx;

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
   * Selection is applied only in cursor modes (even when locked) so the object
   * tree and floating toolbar stay usable; only the drag itself is gated by
   * the lock. While a drawing tool is active this returns early and lets the
   * event bubble so the SVG root can start the NEW drawing on top.
   */
  const beginDrag = useCallback((e, drawingId, handle) => {
    if (e?.preventDefault) e.preventDefault();
    // Left-button / touch drags only — right-click is reserved for the menu.
    const isTouchDrag = Boolean(e?.touches && e.touches.length);
    if (!isTouchDrag && e?.button != null && e.button !== 0) return false;
    // Default z-order: while a drawing tool is active, the pointer belongs to
    // the NEW drawing being placed — existing shapes stay back and must never
    // hijack the gesture into a drag of the old object. (New drawings append
    // to the end of the array, so they always paint front; manual override
    // stays via right-click Bring to front / Send to back.)
    // CRITICAL: bail out BEFORE stopPropagation so the mousedown keeps bubbling
    // to the SVG root's handleSvgMouseDown — otherwise pressing on top of an
    // existing shape would swallow the event and no new drawing could start
    // over it.
    if (!isCursorMode(activeTool)) return false;
    if (e?.stopPropagation) e.stopPropagation();
    if (drawingsRef.current.find((d) => d.id === drawingId)?.selectable === false) return false;
    const isMultiSelect = Boolean(e?.shiftKey || e?.ctrlKey || e?.metaKey);
    if (isMultiSelect) {
      const current = Array.isArray(selectedDrawingIds) ? selectedDrawingIds : [];
      const next = current.includes(drawingId)
        ? current.filter((id) => id !== drawingId)
        : [...current, drawingId];
      setSelectedDrawingIds(next);
      setSelectedDrawingId(next.includes(drawingId) ? drawingId : (next[next.length - 1] ?? null));
      return false;
    }
    if (!selectedDrawingIds?.includes(drawingId) || selectedDrawingIds.length < 2) {
      setSelectedDrawingIds([drawingId]);
    }
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
  }, [lockAllDrawings, setChartLocked, isCursorMode, activeTool, bodyGestureRef, dragMovedRef, dragSnapshotRef, drawingsRef, selectedDrawingIds, setDragStartPos, setDraggingHandle, setSelectedDrawingId, setSelectedDrawingIds, svgRef, upHandledRef]);

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
  }, [buildExtendedDrawing, saveDrawingsWithHistory, stayInDrawMode, setChartLocked, setActiveTool, drawingsRef, isDraggingRef, setCurrentDraw, setIsDrawing, setPendingPoints, setSelectedDrawingId]);

  /** Abandons an in-progress placement (Escape / tool switch / symbol change). */
  const cancelPlacement = useCallback(() => {
    setPendingPoints([]);
    setCurrentDraw(null);
    setIsDrawing(false);
    isDraggingRef.current = false;
    setChartLocked(false);
  }, [setChartLocked, isDraggingRef, setCurrentDraw, setIsDrawing, setPendingPoints]);
  return {
    beginLegacyDrag, cancelPlacement, commitExtendedDrawing, isCursorMode, isFreehandType,
    startBodyDrag, startPointDrag,
  };
}
