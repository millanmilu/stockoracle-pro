import { useCallback, useEffect, useRef } from 'react';
import { DEFAULT_TOOL, MAGNET_LABELS, getToolSpec, nextMagnetMode, resolveShortcut } from './drawingToolCatalog';
import { readPinnedIds } from './drawingToolUtils';
import toast from 'react-hot-toast';

// --- toolbar, clipboard & context-menu actions ---

export function useDrawingActions(ctx) {
  const {
    activeColor, activeTool, activeToolRef, cancelPlacement, clipboard, commitExtendedDrawing,
    contextMenu, currentDraw, drawingSettingsId, drawingsRef, fracForLogical, hideAllDrawings,
    interval, isCursorMode, isDraggingRef, lockAllDrawings, magnetMode, mainPaneRef,
    pendingPoints, saveDrawingsWithHistory, selectedDrawingId, setActiveTool, setChartLocked,
    setClipboard, setContextMenu, setCurrentDraw, setDrawingSettingsId, setHideAllDrawings,
    setIsDrawing, setLockAllDrawings, setMagnetMode, setPendingPoints, setSelectedDrawingId,
    setSelectedDrawingIds = () => {}, setShowStickerMenu, setStayInDrawMode, setStickerPos, setTextInputPos, setTextInputVal,
    showStickerMenu, stayInDrawMode, stickerPos, svgRef, textInputPos, textInputVal,
    timeForLogical,
  } = ctx;

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
  }, [currentDraw, pendingPoints, activeTool, cancelPlacement, commitExtendedDrawing, activeToolRef, setSelectedDrawingId]);

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
  }, [selectedDrawingId, saveDrawingsWithHistory, timeForLogical, fracForLogical, drawingsRef, setSelectedDrawingId]);

  const handleClearAll = useCallback(() => {
    if (lockAllDrawings) {
      toast.error('Drawings are locked. Unlock first.');
      return;
    }
    saveDrawingsWithHistory([]);
    setSelectedDrawingId(null);
    toast.success('All drawings removed');
  }, [lockAllDrawings, saveDrawingsWithHistory, setSelectedDrawingId]);

  // Patch fields of the currently selected drawing (style/text/flags) with
  // history push so every toolbar/settings tweak is undoable.
  const updateSelectedDrawing = useCallback((patch) => {
    if (!selectedDrawingId) return;
    const updated = drawingsRef.current.map((d) => (d.id === selectedDrawingId ? { ...d, ...patch } : d));
    saveDrawingsWithHistory(updated, true);
  }, [selectedDrawingId, saveDrawingsWithHistory, drawingsRef]);

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
  }, [selectedDrawingId, saveDrawingsWithHistory, drawingsRef, setDrawingSettingsId, setSelectedDrawingId]);

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
  }, [setChartLocked, setActiveTool, setContextMenu, setCurrentDraw, setIsDrawing, setPendingPoints, setSelectedDrawingId]);

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
  }, [activeTool, isCursorMode, setChartLocked, isDraggingRef, setContextMenu, setCurrentDraw, setIsDrawing, setPendingPoints]);

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
  }, [setStayInDrawMode]);

  const handleCycleMagnet = useCallback(() => {
    const next = nextMagnetMode(magnetMode);
    setMagnetMode(next);
    toast.success(MAGNET_LABELS[next] || next);
  }, [magnetMode, setMagnetMode]);

  const handleToggleLockAll = useCallback(() => {
    const next = !lockAllDrawings;
    setLockAllDrawings(next);
    toast.success(next ? 'All objects locked' : 'All objects unlocked');
  }, [lockAllDrawings, setLockAllDrawings]);

  const handleToggleHideAll = useCallback(() => {
    const next = !hideAllDrawings;
    setHideAllDrawings(next);
    toast.success(next ? 'All objects hidden' : 'All objects visible');
  }, [hideAllDrawings, setHideAllDrawings]);

  // Catalog Alt-shortcuts activate drawing tools; action shortcuts control the
  // rail, and plain digits 1..9,0 activate pinned tools (except while typing).
  useEffect(() => {
    const typing = () => {
      const tag = document.activeElement?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
    };
    const onToolShortcut = (e) => {
      if (typing()) return;
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
      const key = String(e.key || '').toLowerCase();
      if (e.shiftKey) {
        if (key === 'r') {
          e.preventDefault();
          handleClearAll();
          return;
        }
        if (key === 'k') {
          e.preventDefault();
          handleToggleStayInDrawMode();
          return;
        }
      } else {
        const action = {
          l: handleToggleLockAll,
          h: handleToggleHideAll,
          m: handleCycleMagnet,
        }[key];
        if (action) {
          e.preventDefault();
          action();
          return;
        }
      }
      const toolId = resolveShortcut(e.key, { alt: true, shift: !!e.shiftKey });
      if (!toolId) return;
      e.preventDefault();
      handleSelectTool(toolId);
    };
    window.addEventListener('keydown', onToolShortcut);
    return () => window.removeEventListener('keydown', onToolShortcut);
  }, [
    handleClearAll,
    handleCycleMagnet,
    handleSelectTool,
    handleToggleHideAll,
    handleToggleLockAll,
    handleToggleStayInDrawMode,
  ]);

  const patchDrawing = useCallback((id, patch) => {
    saveDrawingsWithHistory(drawingsRef.current.map((d) => (d.id === id ? { ...d, ...patch } : d)), true);
  }, [saveDrawingsWithHistory, drawingsRef]);

  const removeDrawing = useCallback((id) => {
    saveDrawingsWithHistory(drawingsRef.current.filter((d) => d.id !== id), true);
    setSelectedDrawingId((prev) => (prev === id ? null : prev));
  }, [saveDrawingsWithHistory, drawingsRef, setSelectedDrawingId]);

  const bringToFront = useCallback((id) => {
    const all = drawingsRef.current;
    const target = all.find((d) => d.id === id);
    if (!target) return;
    saveDrawingsWithHistory([...all.filter((d) => d.id !== id), target], true);
  }, [saveDrawingsWithHistory, drawingsRef]);

  const sendToBack = useCallback((id) => {
    const all = drawingsRef.current;
    const target = all.find((d) => d.id === id);
    if (!target) return;
    saveDrawingsWithHistory([target, ...all.filter((d) => d.id !== id)], true);
  }, [saveDrawingsWithHistory, drawingsRef]);

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
  }, [offsetDrawing, saveDrawingsWithHistory, drawingsRef, setSelectedDrawingId]);

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
  }, [setContextMenu, setSelectedDrawingId, svgRef]);

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
  }, [mainPaneRef, handleContextMenu, svgRef]);

  const copyDrawing = useCallback((id) => {
    const target = drawingsRef.current.find((d) => d.id === id);
    if (!target) return;
    setClipboard(JSON.parse(JSON.stringify(target)));
    toast.success(`${getToolSpec(target.type)?.label || 'Drawing'} copied`);
  }, [drawingsRef, setClipboard]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard) {
      toast.error('Nothing to paste — copy an object first');
      return;
    }
    const dup = offsetDrawing(clipboard, 18, 18, 2);
    saveDrawingsWithHistory([...drawingsRef.current, dup], true);
    setSelectedDrawingId(dup.id);
    toast.success(`${getToolSpec(dup.type)?.label || 'Drawing'} pasted`);
  }, [clipboard, offsetDrawing, saveDrawingsWithHistory, drawingsRef, setSelectedDrawingId]);

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
      // Ctrl/Cmd+A — select all drawings (cursor modes, not while typing).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && isCursorMode(activeToolRef.current)) {
        const ids = (drawingsRef.current || []).filter((d) => !d.hidden).map((d) => d.id);
        if (ids.length) {
          e.preventDefault();
          setSelectedDrawingIds(ids);
          setSelectedDrawingId(ids[ids.length - 1]);
          toast.success(`${ids.length} drawings selected`);
        }
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
    activeToolRef,
    drawingsRef,
    setContextMenu,
    setDrawingSettingsId,
    setSelectedDrawingId,
    setShowStickerMenu,
    setStickerPos,
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
  return {
    bringToFront, cloneDrawing, copyDrawing, deleteSelectedDrawing, handleAddSticker,
    handleAddText, handleClearAll, handleContextMenu, handleCycleMagnet, handleDuplicateSelected,
    handleSelectTool, handleToggleHideAll, handleToggleLockAll, handleToggleStayInDrawMode,
    pasteClipboard, removeDrawing, sendToBack, updateSelectedDrawing,
  };
}
