import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import DrawingToolbar, { getToolbarWidth, PINS_STORAGE_KEY } from './DrawingToolbar';
import FloatingFavoritesBar from './FloatingFavoritesBar';
import { PRICE_AXIS_WIDTH, isCryptoSymbol } from '../../utils/chartHelpers';
import {
  INTERVAL_MS,
  intervalToMs,
  SINGLE_ANCHOR_LEGACY,
  anchorHasIdentity,
} from './drawingToolUtils';
import { pickTouch } from './drawingToolEvents';
import { useDrawingGeometry } from './useDrawingGeometry';
import { useDrawingHistory } from './useDrawingHistory';
import { useDrawingGestures } from './useDrawingGestures';
import { useDrawingCoordCache } from './useDrawingCoordCache';
import { useDrawingSurface } from './useDrawingSurface';
import { useDrawingPointerCapture } from './useDrawingPointerCapture';
import { useDrawingMarquee } from './useDrawingMarquee';
import { useDrawingActions } from './useDrawingActions';
import { handleSvgMouseDownImpl } from './drawingToolMouseDown';
import { processMoveImpl } from './drawingToolMoveProcess';
import { handleSvgMouseUpImpl } from './drawingToolMouseUp';
import { SelectedDrawingToolbar } from './SelectedDrawingToolbar';
import { DrawingSettingsHost } from './DrawingSettingsHost';
import { SavedDrawingsLayer } from './SavedDrawingsLayer';
import { ActiveDrawingOverlay } from './ActiveDrawingOverlay';
import { DrawingTextNoteInput } from './DrawingTextNoteInput';
import { DrawingStickerPicker } from './DrawingStickerPicker';
import { DrawingContextMenu } from './DrawingContextMenu';
import { DrawingObjectTree } from './DrawingObjectTree';
import { DrawingInlineEditor } from './DrawingInlineEditor';
import useStore from '../../store/useStore';
import { applyDrawingThemeTokens, loadDrawingSettings, saveDrawingSettings } from './drawingSettingsSchema';
import { SelectedDrawingsToolbar } from './SelectedDrawingsToolbar';



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
  const theme = useStore((state) => state.theme) ?? 'dark';
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
  const [selectedDrawingIds, setSelectedDrawingIds] = useState([]);
  useEffect(() => {
    setSelectedDrawingIds((current) => {
      if (selectedDrawingId == null) return current.length > 1 ? current : [];
      return current.includes(selectedDrawingId) ? current : [selectedDrawingId];
    });
  }, [selectedDrawingId]);
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
  useEffect(() => {
    const apply = () => applyDrawingThemeTokens(theme);
    apply();
    window.addEventListener('drawing-settings-changed', apply);
    return () => window.removeEventListener('drawing-settings-changed', apply);
  }, [theme]);
  useEffect(() => {
    const syncDefaults = () => {
      const defaults = loadDrawingSettings().theme;
      setActiveColor(defaults.lineColor);
      setActiveStrokeWidth(defaults.defaultLineWidth);
      setActiveLineStyle(defaults.defaultLineStyle);
    };
    window.addEventListener('drawing-theme-changed', syncDefaults);
    return () => window.removeEventListener('drawing-theme-changed', syncDefaults);
  }, []);

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

  // Active Line Styles — TradingView remembers the last-used style per
  // session and new drawings inherit it. Persisted so the default survives
  // reloads; factory default is TradingView blue.
  const [activeColor, setActiveColor] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('so_active_draw_style') || '{}');
      return typeof saved.color === 'string' && saved.color ? saved.color : '#2962FF';
    } catch { return '#2962FF'; }
  });
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('so_active_draw_style') || '{}');
      return Number.isFinite(Number(saved.strokeWidth)) ? Number(saved.strokeWidth) : 2;
    } catch { return 2; }
  });
  const [activeLineStyle, setActiveLineStyle] = useState(() => { // 'solid' | 'dashed' | 'dotted'
    try {
      const saved = JSON.parse(localStorage.getItem('so_active_draw_style') || '{}');
      return ['solid', 'dashed', 'dotted'].includes(saved.lineStyle) ? saved.lineStyle : 'solid';
    } catch { return 'solid'; }
  });
  useEffect(() => {
    try {
      localStorage.setItem('so_active_draw_style', JSON.stringify({
        color: activeColor, strokeWidth: activeStrokeWidth, lineStyle: activeLineStyle,
      }));
    } catch {}
  }, [activeColor, activeStrokeWidth, activeLineStyle]);

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
    selectedDrawingIds,
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

  const {
    chartToCoord, coordToChart, findMagnetSnap, fracForLogical, resolvedLogical, setChartLocked,
    timeForLogical, timeIndexMap, toAnchor,
  } = useDrawingGeometry({
    candleRef, candles, chartReady, chartRef, currSym, interval, magnetMode, mainPaneRef,
    setSyncTick, svgRef, timeframeMs,
  });

  // ── 4. History & Persistence ───────────────────────────────────────────────
  // Drawings are namespaced per symbol and SHARED across all timeframes
  // (TradingView behavior): a trendline drawn on 5m shows on 1d and vice
  // versa, resolved through canonical timestamps (see resolvedLogical).
  // Selection, pending placement and history reset on symbol switch —
  // otherwise a stale selected id could point at another symbol's set.
  const {
    handleRedo, handleUndo, persistDrawings, saveDrawingsWithHistory,
  } = useDrawingHistory({
    candles, drawingsRef, fracForLogical, interval, isDraggingRef, redoStack, setContextMenu,
    setCurrentDraw, setDraggingHandle, setDragStartPos, setDrawings, setHiddenIds, setIsDrawing,
    setPendingPoints, setRedoStack, setSelectedDrawingId, setTextEdit, setUndoStack, symbol,
    timeForLogical, undoStack,
  });


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

  const {
    beginLegacyDrag, cancelPlacement, commitExtendedDrawing, isCursorMode, isFreehandType,
    startBodyDrag, startPointDrag,
  } = useDrawingGestures({
    activeTool, bodyGestureRef, buildExtendedDrawing, dragMovedRef, dragSnapshotRef, drawingsRef,
    isDraggingRef, lockAllDrawings, saveDrawingsWithHistory, setActiveTool, setChartLocked,
    setCurrentDraw, setDraggingHandle, setDragStartPos, setIsDrawing, setPendingPoints,
    selectedDrawingIds, setSelectedDrawingId, setSelectedDrawingIds, stayInDrawMode, svgRef, upHandledRef,
  });

  const {
    chartToCoordCached, logicalToX, priceToY, resolveAnchorsCached,
  } = useDrawingCoordCache({
    candleRef, candles, chartRef, chartToCoord, coordCacheRef, resolvedLogical, syncTick,
  });

  const {
    commitTextEdit, handleShapeDoubleClick, paneHeight,
  } = useDrawingSurface({
    chartReady, drawingsRef, hideAllDrawings, isOpen, mainPaneRef, saveDrawingsWithHistory,
    setSelectedDrawingId, setSurfaceSize, setTextEdit, setTextEditVal, svgRectRef, svgRef,
    textEdit, textEditVal,
  });

  // ── 5. Mouse & Touch Drawing Handlers ──────────────────────────────────────

  const handleSvgMouseDown = (e) => handleSvgMouseDownImpl(e, {
    activeColor, activeLineStyle, activeStrokeWidth, activeTool, candles, chartReady,
    commitExtendedDrawing, coordToChart, currSym, currentDraw, draggingHandle, drawingsRef,
    findMagnetSnap, fracForLogical, interval, isCursorMode, isDraggingRef, lockAllDrawings,
    moveRafRef, pendingMoveRef, pendingPoints, saveDrawingsWithHistory, selectedDrawingId,
    setActiveTool, setChartLocked, setCurrentDraw, setIsDrawing, setPendingPoints,
    setSelectedDrawingId, setShowStickerMenu, setStickerPos, setTextInputPos, setTextInputVal,
    stayInDrawMode, svgRectRef, svgRef, timeForLogical, toAnchor, upHandledRef,
  });

  // RAF-coalesced move processing: runs at most once per frame. Reads interaction
  // state from moveStateRef (always fresh) and uses only functional setState
  // updates, so collapsing N events into one never loses correctness.
  const processMove = useCallback((clientX, clientY) => processMoveImpl(clientX, clientY, {
    bodyGestureRef, chartToCoord, coordToChart, dragMovedRef, dragSnapshotRef, drawingsRef,
    findMagnetSnap, fracForLogical, interval, isFreehandType, moveStateRef, setCurrentDraw,
    setDragStartPos, setDrawings, setSnapIndicator, svgRectRef, svgRef, timeForLogical,
    timeframeMs, toAnchor,
  }), [
    findMagnetSnap, coordToChart, chartToCoord, resolvedLogical, timeForLogical, fracForLogical,
    timeIndexMap, isFreehandType, timeframeMs, interval, toAnchor, bodyGestureRef, dragMovedRef,
    dragSnapshotRef, drawingsRef, moveStateRef, setCurrentDraw, setDragStartPos, setDrawings,
    setSnapIndicator, svgRectRef, svgRef,
  ]);

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

  const handleSvgMouseUp = (e) => handleSvgMouseUpImpl(e, {
    activeTool, bodyGestureRef, commitExtendedDrawing, coordToChart, currentDraw, dragMovedRef,
    dragSnapshotRef, draggingHandle, drawingsRef, findMagnetSnap, flushPendingMoveSync,
    fracForLogical, interval, isDraggingRef, isDrawing, persistDrawings, saveDrawingsWithHistory,
    setActiveTool, setChartLocked, setCurrentDraw, setDragStartPos, setDraggingHandle,
    setDrawings, setIsDrawing, setPendingPoints, setRedoStack, setSelectedDrawingId,
    setUndoStack, stayInDrawMode, svgRef, timeForLogical, timeframeMs, toAnchor, upHandledRef,
  });

  useDrawingPointerCapture({
    draggingHandle, gestureActiveRef, handleSvgMouseMove, handleSvgMouseUp, mainPaneRef,
    selectedDrawingId, setSelectedDrawingId, svgRef,
  });

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

  const {
    bringToFront, cloneDrawing, copyDrawing, deleteSelectedDrawing, handleAddSticker,
    handleAddText, handleClearAll, handleContextMenu, handleCycleMagnet, handleDuplicateSelected,
    handleSelectTool, handleToggleHideAll, handleToggleLockAll, handleToggleStayInDrawMode,
    pasteClipboard, removeDrawing, sendToBack, updateSelectedDrawing,
  } = useDrawingActions({
    activeColor, activeTool, activeToolRef, cancelPlacement, clipboard, commitExtendedDrawing,
    contextMenu, currentDraw, drawingSettingsId, drawingsRef, fracForLogical, hideAllDrawings,
    interval, isCursorMode, isDraggingRef, lockAllDrawings, magnetMode, mainPaneRef,
    pendingPoints, saveDrawingsWithHistory, selectedDrawingId, setActiveTool, setChartLocked,
    setClipboard, setContextMenu, setCurrentDraw, setDrawingSettingsId, setHideAllDrawings,
    setIsDrawing, setLockAllDrawings, setMagnetMode, setPendingPoints, setSelectedDrawingId,
    setSelectedDrawingIds, setShowStickerMenu, setStayInDrawMode, setStickerPos, setTextInputPos, setTextInputVal,
    showStickerMenu, stayInDrawMode, stickerPos, svgRef, textInputPos, textInputVal,
    timeForLogical,
  });

  // ── Shift+drag rubber-band multi-select (cursor modes, empty pane space) ──
  const { marquee } = useDrawingMarquee({
    activeTool, chartToCoordCached, drawingsRef, interval, isCursorMode,
    mainPaneRef, hiddenIds, resolveAnchorsCached, setChartLocked,
    setSelectedDrawingId, setSelectedDrawingIds, svgRef,
  });

  const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId);
  const selectedDrawings = drawings.filter((drawing) => selectedDrawingIds.includes(drawing.id));
  const contextTarget = contextMenu ? drawings.find((d) => d.id === contextMenu.drawingId) : null;



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

      {/* ── Selected Drawing Floating Toolbar — TradingView parity ── */}
      {/* Anchored next to the selection's first anchor (tracks pan/zoom via the
          render-path coordinate cache), clamped inside the price pane. Falls
          back to top-center only when the anchor can't be resolved. */}
      {selectedDrawings.length > 1 && !isDrawing && !currentDraw && (pendingPoints?.length ?? 0) === 0 && (
        <SelectedDrawingsToolbar
          count={selectedDrawings.length}
          isOpen={isOpen}
          onClear={() => { setSelectedDrawingIds([]); setSelectedDrawingId(null); }}
          onDelete={() => {
            const ids = new Set(selectedDrawingIds);
            saveDrawingsWithHistory(drawingsRef.current.filter((drawing) => !ids.has(drawing.id)), true);
            setHiddenIds((prev) => new Set([...prev].filter((id) => !ids.has(id))));
            setSelectedDrawingIds([]);
            setSelectedDrawingId(null);
          }}
          onPatch={(patch) => {
            const ids = new Set(selectedDrawingIds);
            saveDrawingsWithHistory(drawingsRef.current.map((drawing) => ids.has(drawing.id) ? { ...drawing, ...patch } : drawing), true);
            if (Object.prototype.hasOwnProperty.call(patch, 'hidden')) {
              setHiddenIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => patch.hidden ? next.add(id) : next.delete(id));
                return next;
              });
            }
          }}
          selectedDrawings={selectedDrawings}
          toolbarWidth={toolbarWidth}
        />
      )}

      {selectedDrawing && selectedDrawings.length <= 1 && !isDrawing && !currentDraw && (pendingPoints?.length ?? 0) === 0 && (
        <SelectedDrawingToolbar
          deleteSelectedDrawing={deleteSelectedDrawing}
          handleDuplicateSelected={handleDuplicateSelected}
          hiddenIds={hiddenIds}
          isOpen={isOpen}
          mainPaneRef={mainPaneRef}
          paneHeight={paneHeight}
          resolveAnchorsCached={resolveAnchorsCached}
          selectedDrawing={selectedDrawing}
          selectedDrawingId={selectedDrawingId}
          setDrawingSettingsId={setDrawingSettingsId}
          setHiddenIds={setHiddenIds}
          setSelectedDrawingId={setSelectedDrawingId}
          surfaceSize={surfaceSize}
          toolbarWidth={toolbarWidth}
          updateSelectedDrawing={updateSelectedDrawing}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
          onSaveToolDefault={(type, patch) => {
            saveDrawingSettings({ toolDefaults: { [type]: patch } });
            try {
              const prev = JSON.parse(localStorage.getItem('so_active_draw_style') || '{}');
              const next = { ...prev };
              if (patch.color) next.color = patch.color;
              if (patch.strokeWidth) next.strokeWidth = patch.strokeWidth;
              if (patch.lineStyle) next.lineStyle = patch.lineStyle;
              localStorage.setItem('so_active_draw_style', JSON.stringify(next));
            } catch (_) {}
          }}
          onApplyToSameType={(type, patch) => {
            saveDrawingsWithHistory(
              drawingsRef.current.map((d) => (d.type === type ? { ...d, ...patch } : d)), false,
            );
          }}
          timeForLogical={timeForLogical}
          timeframeMs={timeframeMs}
          magnetMode={magnetMode}
          onMagnetChange={setMagnetMode}
        />
      )}

      {/* ── Drawing Settings Modal — TradingView parity (General/Coordinates/Visibility/Interaction/Text/Advanced, ALL tools) ── */}
      {drawingSettingsId && (
        <DrawingSettingsHost
          drawingSettingsId={drawingSettingsId}
          drawings={drawings}
          drawingsRef={drawingsRef}
          saveDrawingsWithHistory={saveDrawingsWithHistory}
          setDrawingSettingsId={setDrawingSettingsId}
          timeForLogical={timeForLogical}
          timeframeMs={timeframeMs}
          magnetMode={magnetMode}
          onMagnetChange={setMagnetMode}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
          mainPaneRef={mainPaneRef}
        />
      )}

      {/* ── Shift+drag marquee selection band (multi-select) ── */}
      {marquee && (
        <div
          data-drawing-ui="marquee"
          style={{
            position: 'fixed',
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
            border: '1px solid var(--drawing-toolbar-active, #2962FF)',
            background: 'rgba(41,98,255,0.12)',
            zIndex: 200,
            pointerEvents: 'none',
          }}
        />
      )}

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
          <SavedDrawingsLayer
            beginLegacyDrag={beginLegacyDrag}
            candles={candles}
            chartToCoordCached={chartToCoordCached}
            currSym={currSym}
            drawings={drawings}
            handleContextMenu={handleContextMenu}
            handleShapeDoubleClick={handleShapeDoubleClick}
            hiddenIds={hiddenIds}
            interval={interval}
            logicalToX={logicalToX}
            priceToY={priceToY}
            resolveAnchorsCached={resolveAnchorsCached}
            selectedDrawingId={selectedDrawingId}
            selectedDrawingIds={selectedDrawingIds}
            startBodyDrag={startBodyDrag}
            startPointDrag={startPointDrag}
            surfaceSize={surfaceSize}
            timeframeMs={timeframeMs}
          />

          {/* ── Active Drawing Preview ── */}
          <ActiveDrawingOverlay
            activeColor={activeColor}
            activeStrokeWidth={activeStrokeWidth}
            candles={candles}
            currSym={currSym}
            currentDraw={currentDraw}
            logicalToX={logicalToX}
            pendingPoints={pendingPoints}
            priceToY={priceToY}
            snapIndicator={snapIndicator}
            surfaceSize={surfaceSize}
            timeframeMs={timeframeMs}
          />
        </svg>
      )}

      {/* Floating Text Note Input */}
      {textInputPos && (
        <DrawingTextNoteInput
          activeToolRef={activeToolRef}
          handleAddText={handleAddText}
          isCursorMode={isCursorMode}
          isOpen={isOpen}
          setActiveTool={setActiveTool}
          setChartLocked={setChartLocked}
          setTextInputPos={setTextInputPos}
          setTextInputVal={setTextInputVal}
          textInputPos={textInputPos}
          textInputVal={textInputVal}
          toolbarWidth={toolbarWidth}
        />
      )}

      {/* Stickers Emoji Picker */}
      {showStickerMenu && stickerPos && (
        <DrawingStickerPicker
          handleAddSticker={handleAddSticker}
          isOpen={isOpen}
          stickerPos={stickerPos}
          toolbarWidth={toolbarWidth}
        />
      )}

      {/* ── Right-Click Context Menu (TradingView object menu) ── */}
      {contextMenu && (
        <DrawingContextMenu
          bringToFront={bringToFront}
          clipboard={clipboard}
          cloneDrawing={cloneDrawing}
          contextMenu={contextMenu}
          contextTarget={contextTarget}
          copyDrawing={copyDrawing}
          handleClearAll={handleClearAll}
          handleSelectTool={handleSelectTool}
          hiddenIds={hiddenIds}
          pasteClipboard={pasteClipboard}
          removeDrawing={removeDrawing}
          sendToBack={sendToBack}
          setContextMenu={setContextMenu}
          setDrawingSettingsId={setDrawingSettingsId}
          setHiddenIds={setHiddenIds}
          updateDrawing={(id, patch) => {
            const updated = drawingsRef.current.map((drawing) => (drawing.id === id ? { ...drawing, ...patch } : drawing));
            saveDrawingsWithHistory(updated, true);
          }}
        />
      )}


      {/* ── Object Tree (TradingView object list) ── */}
      {showObjectTree && (
        <DrawingObjectTree
          bringToFront={bringToFront}
          drawings={drawings}
          hiddenIds={hiddenIds}
          removeDrawing={removeDrawing}
          selectedDrawingId={selectedDrawingId}
          sendToBack={sendToBack}
          setHiddenIds={setHiddenIds}
          setSelectedDrawingId={setSelectedDrawingId}
          setSelectedDrawingIds={setSelectedDrawingIds}
          setShowObjectTree={setShowObjectTree}
          updateDrawing={(id, patch) => {
            const updated = drawingsRef.current.map((drawing) => (drawing.id === id ? { ...drawing, ...patch } : drawing));
            saveDrawingsWithHistory(updated, true);
          }}
        />
      )}

      {/* ── Inline text editor for annotation objects (double-click) ── */}
      {textEdit && (
        <DrawingInlineEditor
          commitTextEdit={commitTextEdit}
          setTextEdit={setTextEdit}
          setTextEditVal={setTextEditVal}
          textEditVal={textEditVal}
        />
      )}

    </>
  );
}
