import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LEGACY_INTERVALS, STORAGE_KEY, repairDrawings } from './drawingToolUtils';
import { loadDrawingSettings } from './drawingSettingsSchema';
import toast from 'react-hot-toast';

// --- drawing history & persistence ---

export function useDrawingHistory(ctx) {
  const {
    candles, drawingsRef, fracForLogical, interval, isDraggingRef, redoStack, setContextMenu,
    setCurrentDraw, setDraggingHandle, setDragStartPos, setDrawings, setHiddenIds, setIsDrawing,
    setPendingPoints, setRedoStack, setSelectedDrawingId, setTextEdit, setUndoStack, symbol,
    timeForLogical, undoStack,
  } = ctx;

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
    setHiddenIds(new Set(repaired.clean.filter((drawing) => drawing.hidden).map((drawing) => drawing.id)));
    setContextMenu(null);
    setTextEdit(null);
    isDraggingRef.current = false;
  }, [storageKey, isDraggingRef, setContextMenu, setCurrentDraw, setDragStartPos, setDraggingHandle, setDrawings, setHiddenIds, setIsDrawing, setPendingPoints, setRedoStack, setSelectedDrawingId, setTextEdit, setUndoStack]);

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
  }, [candles, persistDrawings, timeForLogical, fracForLogical, interval, drawingsRef, setDrawings]);

  const saveDrawingsWithHistory = useCallback((nextDrawings, pushToUndo = true, historyBase = null) => {
    const existingIds = new Set(drawingsRef.current.map((drawing) => drawing.id));
    const toolDefaults = loadDrawingSettings().toolDefaults;
    const normalizedDrawings = nextDrawings.map((drawing) => {
      const defaults = !existingIds.has(drawing.id) ? toolDefaults[drawing.type] : null;
      return defaults ? { ...drawing, ...defaults } : drawing;
    });
    if (pushToUndo) {
      // Push the live mirror, not the closed-over state, so rapid successive
      // commits (drag → commit → drag) never drop an intermediate state.
      const base = historyBase || drawingsRef.current;
      setUndoStack(prev => [...prev.slice(-30), base]);
      setRedoStack([]);
    }
    persistDrawings(normalizedDrawings);
    setDrawings(normalizedDrawings);
  }, [persistDrawings, drawingsRef, setDrawings, setRedoStack, setUndoStack]);

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
  }, [undoStack, persistDrawings, drawingsRef, setDrawings, setRedoStack, setUndoStack]);

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
  }, [redoStack, persistDrawings, drawingsRef, setDrawings, setRedoStack, setUndoStack]);

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
  return { handleRedo, handleUndo, persistDrawings, saveDrawingsWithHistory };
}
