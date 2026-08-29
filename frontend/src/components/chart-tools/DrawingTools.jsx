import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Crosshair, TrendingUp, AlignJustify, Brush, Type, Smile,
  Ruler, Magnet, Lock, Unlock, Eye, EyeOff,
  Trash2, Square as SquareIcon, Sliders, Settings,
  X, Circle, Minus, Palette, Move, Copy,
  RotateCcw, RotateCw, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'stockoracle_drawings_tv_v6';

const FIBONACCI_LEVELS = [
  { level: 0.0,   label: '0.0 (0%)',     color: '#787B86', fill: 'rgba(120, 123, 134, 0.08)' },
  { level: 0.236, label: '0.236 (23.6%)', color: '#EF5350', fill: 'rgba(239, 83, 80, 0.12)' },
  { level: 0.382, label: '0.382 (38.2%)', color: '#F59E0B', fill: 'rgba(245, 158, 11, 0.12)' },
  { level: 0.5,   label: '0.5 (50.0%)',   color: '#10B981', fill: 'rgba(16, 185, 129, 0.12)' },
  { level: 0.618, label: '0.618 (61.8%)', color: '#00E5FF', fill: 'rgba(0, 229, 255, 0.12)' },
  { level: 0.786, label: '0.786 (78.6%)', color: '#6366F1', fill: 'rgba(99, 102, 241, 0.12)' },
  { level: 1.0,   label: '1.0 (100%)',   color: '#A855F7', fill: 'rgba(168, 85, 247, 0.12)' },
];

const COLOR_PRESETS = ['#38BDF8', '#10B981', '#F59E0B', '#EF5350', '#A855F7', '#EC4899', '#FFFFFF', '#64748B'];

export default function DrawingTools({ 
  chartRef, 
  candleRef, 
  candles = [], 
  symbol, 
  interval, 
  chartReady, 
  onOpenSettings 
}) {
  // Tool & State Management
  const [activeTool, setActiveTool] = useState('crosshair');
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

  // Magnet Mode & Snapping state
  const [magnetMode, setMagnetMode] = useState(false);
  const [snapIndicator, setSnapIndicator] = useState(null); // { x, y, price, label }

  // Modifiers
  const [stayInDrawMode, setStayInDrawMode] = useState(true);
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

  // Coordinate sync tick (throttled with RAF)
  const [, setSyncTick] = useState(0);
  const svgRef = useRef(null);
  const isDraggingRef = useRef(false);

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

  // ── 2. True Magnet Snapping Engine ─────────────────────────────────────────

  const findMagnetSnap = useCallback((x, y) => {
    if (!magnetMode || !candleRef?.current || !chartRef?.current || !candles?.length) {
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
      if (candleX == null || Math.abs(x - candleX) > 40) return null;

      const o = Number(candle.open);
      const h = Number(candle.high);
      const l = Number(candle.low);
      const c = Number(candle.close);

      const oY = candleRef.current.priceToCoordinate(o);
      const hY = candleRef.current.priceToCoordinate(h);
      const lY = candleRef.current.priceToCoordinate(l);
      const cY = candleRef.current.priceToCoordinate(c);

      const candidates = [
        { price: h, y: hY, label: `HIGH ₹${h.toFixed(2)}` },
        { price: l, y: lY, label: `LOW ₹${l.toFixed(2)}` },
        { price: c, y: cY, label: `CLOSE ₹${c.toFixed(2)}` },
        { price: o, y: oY, label: `OPEN ₹${o.toFixed(2)}` },
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

      if (minDist < 35) {
        return {
          x: candleX,
          y: closest.y,
          logical: roundedIndex,
          price: closest.price,
          label: closest.label,
        };
      }
    } catch (_) {}

    return null;
  }, [magnetMode, candleRef, chartRef, candles]);

  // ── 3. Smooth Pan/Zoom Synchronization ─────────────────────────────────────

  useEffect(() => {
    let cleanup = null;
    let rafId = null;

    const requestSync = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setSyncTick(t => (t + 1) % 1000000);
      });
    };

    const attach = () => {
      if (!chartRef?.current) return false;
      try {
        const timeScale = chartRef.current.timeScale();
        timeScale.subscribeVisibleLogicalRangeChange(requestSync);
        timeScale.subscribeVisibleTimeRangeChange(requestSync);

        cleanup = () => {
          try {
            timeScale.unsubscribeVisibleLogicalRangeChange(requestSync);
            timeScale.unsubscribeVisibleTimeRangeChange(requestSync);
          } catch (_) {}
        };
        return true;
      } catch (_) {
        return false;
      }
    };

    if (!attach()) {
      const intervalId = setInterval(() => {
        if (attach()) clearInterval(intervalId);
      }, 100);
      return () => {
        clearInterval(intervalId);
        if (cleanup) cleanup();
        if (rafId) cancelAnimationFrame(rafId);
      };
    }

    window.addEventListener('resize', requestSync);
    return () => {
      if (cleanup) cleanup();
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', requestSync);
    };
  }, [chartRef, chartReady]);

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

  useEffect(() => {
    const key = `${STORAGE_KEY}_${symbol}_${interval}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setDrawings(JSON.parse(saved));
      } catch (_) {
        setDrawings([]);
      }
    } else {
      setDrawings([]);
    }
    setUndoStack([]);
    setRedoStack([]);
  }, [symbol, interval]);

  const saveDrawingsWithHistory = useCallback((nextDrawings, pushToUndo = true) => {
    if (pushToUndo) {
      setUndoStack(prev => [...prev.slice(-30), drawings]);
      setRedoStack([]);
    }
    const key = `${STORAGE_KEY}_${symbol}_${interval}`;
    try {
      localStorage.setItem(key, JSON.stringify(nextDrawings));
    } catch (_) {}
    setDrawings(nextDrawings);
  }, [drawings, symbol, interval]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, drawings]);
    setUndoStack(prev => prev.slice(0, -1));
    const key = `${STORAGE_KEY}_${symbol}_${interval}`;
    try {
      localStorage.setItem(key, JSON.stringify(previous));
    } catch (_) {}
    setDrawings(previous);
    toast.success('Undo drawing change');
  }, [undoStack, drawings, symbol, interval]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, drawings]);
    setRedoStack(prev => prev.slice(0, -1));
    const key = `${STORAGE_KEY}_${symbol}_${interval}`;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch (_) {}
    setDrawings(next);
    toast.success('Redo drawing change');
  }, [redoStack, drawings, symbol, interval]);

  // Global Keyboard Shortcuts
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
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedDrawingId) {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if (e.key === 'Escape') {
        setActiveTool('crosshair');
        setSelectedDrawingId(null);
        setIsDrawing(false);
        setCurrentDraw(null);
        setChartLocked(false);
        setSnapIndicator(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        if (lockAllDrawings) {
          toast.error('Drawings are locked');
          return;
        }
        saveDrawingsWithHistory(drawings.filter(d => d.id !== selectedDrawingId));
        setSelectedDrawingId(null);
        toast.success('Drawing deleted');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId, drawings, lockAllDrawings, handleUndo, handleRedo, saveDrawingsWithHistory, setChartLocked]);

  // Helper for mouse/touch position
  const getEventPos = (e) => {
    const rect = svgRef.current?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      clientX,
      clientY,
    };
  };

  // ── 5. Mouse & Touch Drawing Handlers ──────────────────────────────────────

  const handleSvgMouseDown = (e) => {
    if (lockAllDrawings && activeTool !== 'crosshair') {
      toast.error('Drawings are locked. Unlock to draw.');
      return;
    }

    const { x, y } = getEventPos(e);
    const snap = findMagnetSnap(x, y);
    const finalX = snap ? snap.x : x;
    const finalY = snap ? snap.y : y;
    const chartPt = snap 
      ? { logical: snap.logical, price: snap.price } 
      : coordToChart(finalX, finalY);

    if (activeTool === 'crosshair') {
      if (selectedDrawingId && !draggingHandle) {
        setSelectedDrawingId(null);
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setChartLocked(true);

    // Instant click placement tools
    if (activeTool === 'text') {
      setTextInputPos({ x: finalX, y: finalY, logical: chartPt.logical, price: chartPt.price });
      setTextInputVal('');
      return;
    }

    if (activeTool === 'smile') {
      setStickerPos({ x: finalX, y: finalY, logical: chartPt.logical, price: chartPt.price });
      setShowStickerMenu(true);
      return;
    }

    if (activeTool === 'horizontal_line') {
      const hLine = {
        id: Date.now(),
        type: 'horizontal_line',
        startLogical: chartPt.logical,
        startPrice: chartPt.price,
        startX: finalX,
        startY: finalY,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
        lineStyle: activeLineStyle,
      };
      saveDrawingsWithHistory([...drawings, hLine]);
      setSelectedDrawingId(hLine.id);
      setChartLocked(false);
      if (!stayInDrawMode) setActiveTool('crosshair');
      toast.success(`Support/Resistance Line at ₹${chartPt.price?.toFixed(2)}`);
      return;
    }

    if (activeTool === 'horizontal_ray') {
      const hRay = {
        id: Date.now(),
        type: 'horizontal_ray',
        startLogical: chartPt.logical,
        startPrice: chartPt.price,
        startX: finalX,
        startY: finalY,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
        lineStyle: activeLineStyle,
      };
      saveDrawingsWithHistory([...drawings, hRay]);
      setSelectedDrawingId(hRay.id);
      setChartLocked(false);
      if (!stayInDrawMode) setActiveTool('crosshair');
      toast.success(`Horizontal Ray placed at ₹${chartPt.price?.toFixed(2)}`);
      return;
    }

    // Drag-based tools initialization
    setIsDrawing(true);
    isDraggingRef.current = true;

    if (activeTool === 'brush') {
      setCurrentDraw({
        id: Date.now(),
        type: 'brush',
        points: [{ x: finalX, y: finalY, logical: chartPt.logical, price: chartPt.price }],
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
        endX: finalX + 180,
        endY: finalY,
        endLogical: chartPt.logical != null ? chartPt.logical + 15 : null,
        targetPrice,
        stopPrice,
        color: isLong ? '#10B981' : '#EF5350',
      };
      saveDrawingsWithHistory([...drawings, posDrawing]);
      setSelectedDrawingId(posDrawing.id);
      setIsDrawing(false);
      isDraggingRef.current = false;
      setChartLocked(false);
      if (!stayInDrawMode) setActiveTool('crosshair');
      toast.success(`${isLong ? 'Long' : 'Short'} Position Risk:Reward Tool placed`);
    } else {
      setCurrentDraw({
        id: Date.now(),
        type: activeTool,
        startX: finalX,
        startY: finalY,
        startLogical: chartPt.logical,
        startPrice: chartPt.price,
        endX: finalX,
        endY: finalY,
        endLogical: chartPt.logical,
        endPrice: chartPt.price,
        channelWidth: 35,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
        lineStyle: activeLineStyle,
      });
    }
  };

  const handleSvgMouseMove = (e) => {
    const { x, y } = getEventPos(e);
    const snap = findMagnetSnap(x, y);
    setSnapIndicator(snap);

    const finalX = snap ? snap.x : x;
    const finalY = snap ? snap.y : y;
    const chartPt = snap 
      ? { logical: snap.logical, price: snap.price } 
      : coordToChart(finalX, finalY);

    // ── Handle dragging existing item ──
    if (draggingHandle && selectedDrawingId && dragStartPos && !lockAllDrawings) {
      e.preventDefault();
      e.stopPropagation();
      const dx = finalX - dragStartPos.x;
      const dy = finalY - dragStartPos.y;

      setDrawings((prev) =>
        prev.map((d) => {
          if (d.id !== selectedDrawingId) return d;

          if (draggingHandle === 'start') {
            return {
              ...d,
              startX: finalX,
              startY: finalY,
              startLogical: chartPt.logical,
              startPrice: chartPt.price,
            };
          }
          if (draggingHandle === 'end') {
            return {
              ...d,
              endX: finalX,
              endY: finalY,
              endLogical: chartPt.logical,
              endPrice: chartPt.price,
            };
          }
          if (draggingHandle === 'target') {
            return {
              ...d,
              targetPrice: chartPt.price,
            };
          }
          if (draggingHandle === 'stop') {
            return {
              ...d,
              stopPrice: chartPt.price,
            };
          }
          if (draggingHandle === 'channel') {
            return {
              ...d,
              channelWidth: Math.max(10, Math.abs(dy)),
            };
          }
          if (draggingHandle === 'body') {
            const currentStart = chartToCoord(d.startLogical, d.startPrice, d.startX, d.startY);
            const currentEnd   = chartToCoord(d.endLogical, d.endPrice, d.endX, d.endY);
            const newStartX = currentStart.x + dx;
            const newStartY = currentStart.y + dy;
            const newEndX   = currentEnd.x + dx;
            const newEndY   = currentEnd.y + dy;
            const newStartPt = coordToChart(newStartX, newStartY);
            const newEndPt   = coordToChart(newEndX, newEndY);

            if (d.type === 'brush' && d.points) {
              return {
                ...d,
                points: d.points.map((pt) => {
                  const ptCoord = chartToCoord(pt.logical, pt.price, pt.x, pt.y);
                  const shiftedX = ptCoord.x + dx;
                  const shiftedY = ptCoord.y + dy;
                  const newPt = coordToChart(shiftedX, shiftedY);
                  return { x: shiftedX, y: shiftedY, logical: newPt.logical, price: newPt.price };
                }),
              };
            }
            return {
              ...d,
              startX: newStartX,
              startY: newStartY,
              startLogical: newStartPt.logical,
              startPrice: newStartPt.price,
              endX: newEndX,
              endY: newEndY,
              endLogical: newEndPt.logical,
              endPrice: newEndPt.price,
              targetPrice: d.targetPrice != null && chartPt.price != null && d.startPrice != null 
                ? d.targetPrice + (newStartPt.price - d.startPrice) 
                : d.targetPrice,
              stopPrice: d.stopPrice != null && chartPt.price != null && d.startPrice != null 
                ? d.stopPrice + (newStartPt.price - d.startPrice) 
                : d.stopPrice,
            };
          }
          return d;
        })
      );
      setDragStartPos({ x: finalX, y: finalY });
      return;
    }

    // ── Active drawing in progress ──
    if (!isDrawing || !currentDraw) return;
    e.preventDefault();
    e.stopPropagation();

    if (currentDraw.type === 'brush') {
      setCurrentDraw((prev) => ({
        ...prev,
        points: [...(prev.points || []), { x: finalX, y: finalY, logical: chartPt.logical, price: chartPt.price }],
      }));
    } else {
      setCurrentDraw((prev) => ({
        ...prev,
        endX: finalX,
        endY: finalY,
        endLogical: chartPt.logical,
        endPrice: chartPt.price,
      }));
    }
  };

  const handleSvgMouseUp = (e) => {
    if (draggingHandle) {
      e.preventDefault();
      e.stopPropagation();
      setDraggingHandle(null);
      setDragStartPos(null);
      saveDrawingsWithHistory(drawings, true);
      setChartLocked(false);
      return;
    }

    if (!isDrawing || !currentDraw) {
      setChartLocked(false);
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    let isValid = false;
    if (currentDraw.type === 'brush' && currentDraw.points?.length > 2) {
      isValid = true;
    } else {
      const dx = Math.abs(currentDraw.endX - currentDraw.startX);
      const dy = Math.abs(currentDraw.endY - currentDraw.startY);
      if (dx > 3 || dy > 3 || currentDraw.type === 'ruler') {
        isValid = true;
      }
    }

    if (isValid) {
      const updated = [...drawings, currentDraw];
      saveDrawingsWithHistory(updated, true);
      setSelectedDrawingId(currentDraw.id);
    }

    setIsDrawing(false);
    isDraggingRef.current = false;
    setCurrentDraw(null);
    setChartLocked(false);

    if (!stayInDrawMode && activeTool !== 'brush') {
      setActiveTool('crosshair');
    }
  };

  // Duplicate selected drawing
  const handleDuplicateSelected = () => {
    if (!selectedDrawingId) return;
    const target = drawings.find((d) => d.id === selectedDrawingId);
    if (!target) return;

    const dup = {
      ...target,
      id: Date.now(),
      startX: (target.startX || 0) + 18,
      startY: (target.startY || 0) + 18,
      endX: (target.endX || 0) + 18,
      endY: (target.endY || 0) + 18,
      startLogical: target.startLogical != null ? target.startLogical + 2 : null,
      endLogical: target.endLogical != null ? target.endLogical + 2 : null,
    };
    saveDrawingsWithHistory([...drawings, dup]);
    setSelectedDrawingId(dup.id);
    toast.success('Drawing duplicated');
  };

  const handleClearAll = () => {
    if (lockAllDrawings) {
      toast.error('Drawings are locked. Unlock first.');
      return;
    }
    saveDrawingsWithHistory([]);
    setSelectedDrawingId(null);
    toast.success('All drawings removed');
  };

  const handleAddText = () => {
    if (textInputVal.trim() && textInputPos) {
      const textDrawing = {
        id: Date.now(),
        type: 'text',
        startX: textInputPos.x,
        startY: textInputPos.y,
        startLogical: textInputPos.logical,
        startPrice: textInputPos.price,
        text: textInputVal.trim(),
        color: activeColor,
      };
      saveDrawingsWithHistory([...drawings, textDrawing]);
      setSelectedDrawingId(textDrawing.id);
    }
    setTextInputPos(null);
    setTextInputVal('');
    setChartLocked(false);
    if (!stayInDrawMode) setActiveTool('crosshair');
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
        emoji,
      };
      saveDrawingsWithHistory([...drawings, stickerDrawing]);
      setSelectedDrawingId(stickerDrawing.id);
    }
    setShowStickerMenu(false);
    setStickerPos(null);
    setChartLocked(false);
    if (!stayInDrawMode) setActiveTool('crosshair');
  };

  const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId);

  return (
    <>
      {/* ── TradingView-Style Left Vertical Drawing Toolbar ── */}
      <div style={{
        width: 44,
        height: '100%',
        maxHeight: '100%',
        backgroundColor: '#0F131D',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 0',
        gap: 3,
        zIndex: 45,
        userSelect: 'none',
        flexShrink: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
        overscrollBehavior: 'contain',
      }}>
        {/* 1. Crosshair (Select & Pan) */}
        <button
          onClick={() => setActiveTool('crosshair')}
          title="Crosshair (Select / Move / Pan)"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'crosshair' ? '#2962FF' : 'transparent',
            color: activeTool === 'crosshair' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <Crosshair size={16} />
        </button>

        {/* 2. Trend Line */}
        <button
          onClick={() => {
            setActiveTool('trendline');
            toast.success('Trend Line: Click and drag on chart');
          }}
          title="Trend Line"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'trendline' ? '#2962FF' : 'transparent',
            color: activeTool === 'trendline' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <TrendingUp size={16} />
        </button>

        {/* 3. Trend Ray (Ray Line) */}
        <button
          onClick={() => {
            setActiveTool('ray');
            toast.success('Trend Ray: Click and drag to extend line right');
          }}
          title="Trend Ray (Extends to future)"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'ray' ? '#2962FF' : 'transparent',
            color: activeTool === 'ray' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <ArrowUpRight size={16} />
        </button>

        {/* 4. Horizontal Support/Resistance Line */}
        <button
          onClick={() => {
            setActiveTool('horizontal_line');
            toast.success('Horizontal Line: Click on price level');
          }}
          title="Horizontal Support/Resistance Line"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'horizontal_line' ? '#2962FF' : 'transparent',
            color: activeTool === 'horizontal_line' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <Minus size={16} />
        </button>

        {/* 5. Parallel Channel */}
        <button
          onClick={() => {
            setActiveTool('parallel_channel');
            toast.success('Parallel Channel: Click and drag trend corridor');
          }}
          title="Parallel Channel"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'parallel_channel' ? '#2962FF' : 'transparent',
            color: activeTool === 'parallel_channel' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <Layers size={16} />
        </button>

        {/* 6. Long Position (Risk:Reward) */}
        <button
          onClick={() => {
            setActiveTool('long_position');
            toast.success('Long Position: Click on entry price level');
          }}
          title="Long Position (Risk:Reward Tool)"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'long_position' ? '#10B981' : 'transparent',
            color: activeTool === 'long_position' ? '#FFFFFF' : '#10B981',
            cursor: 'pointer',
          }}
        >
          <ArrowUpRight size={17} style={{ strokeWidth: 2.5 }} />
        </button>

        {/* 7. Short Position (Risk:Reward) */}
        <button
          onClick={() => {
            setActiveTool('short_position');
            toast.success('Short Position: Click on entry price level');
          }}
          title="Short Position (Risk:Reward Tool)"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'short_position' ? '#EF5350' : 'transparent',
            color: activeTool === 'short_position' ? '#FFFFFF' : '#EF5350',
            cursor: 'pointer',
          }}
        >
          <ArrowDownRight size={17} style={{ strokeWidth: 2.5 }} />
        </button>

        {/* 8. Fibonacci Retracement */}
        <button
          onClick={() => {
            setActiveTool('fibonacci');
            toast.success('Fibonacci: Click and drag High to Low');
          }}
          title="Fibonacci Retracement"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'fibonacci' ? '#2962FF' : 'transparent',
            color: activeTool === 'fibonacci' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <AlignJustify size={16} />
        </button>

        {/* 9. Rectangle / Supply & Demand Zone */}
        <button
          onClick={() => {
            setActiveTool('rectangle');
            toast.success('Rectangle: Click and drag Supply/Demand Zone');
          }}
          title="Rectangle Zone"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'rectangle' ? '#2962FF' : 'transparent',
            color: activeTool === 'rectangle' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <SquareIcon size={15} />
        </button>

        {/* 10. Freehand Brush */}
        <button
          onClick={() => {
            setActiveTool('brush');
            toast.success('Brush: Freehand sketch');
          }}
          title="Freehand Brush"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'brush' ? '#2962FF' : 'transparent',
            color: activeTool === 'brush' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <Brush size={16} />
        </button>

        {/* 11. Text Note */}
        <button
          onClick={() => {
            setActiveTool('text');
            toast.success('Text Note: Click anywhere on chart to type');
          }}
          title="Text Note ('T')"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'text' ? '#2962FF' : 'transparent',
            color: activeTool === 'text' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <Type size={16} />
        </button>

        {/* 12. Stickers */}
        <button
          onClick={() => {
            setActiveTool('smile');
            setShowStickerMenu(!showStickerMenu);
          }}
          title="Emojis & Stickers"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'smile' ? '#2962FF' : 'transparent',
            color: activeTool === 'smile' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <Smile size={16} />
        </button>

        {/* 13. Ruler / Measure */}
        <button
          onClick={() => {
            setActiveTool('ruler');
            toast.success('Ruler: Click and drag to measure bars & price %');
          }}
          title="Ruler (Measure Price & Bars)"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'ruler' ? '#2962FF' : 'transparent',
            color: activeTool === 'ruler' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <Ruler size={16} />
        </button>

        <div style={{ width: 22, height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

        {/* 14. Magnet Mode (True OHLC Snapping) */}
        <button
          onClick={() => {
            const nextMode = !magnetMode;
            setMagnetMode(nextMode);
            toast.success(nextMode ? '🧲 Magnet Mode ON (Snaps to OHLC)' : 'Magnet Mode OFF');
          }}
          title={magnetMode ? 'Magnet Mode ON (Snapping to Candles)' : 'Magnet Mode OFF'}
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: magnetMode ? '#2962FF' : 'transparent',
            color: magnetMode ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <Magnet size={16} />
        </button>

        {/* 15. Undo / Redo Buttons */}
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          title="Undo Drawing (Ctrl+Z)"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent',
            color: undoStack.length > 0 ? '#94A3B8' : '#475569',
            cursor: undoStack.length > 0 ? 'pointer' : 'default',
          }}
        >
          <RotateCcw size={15} />
        </button>

        <button
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          title="Redo Drawing (Ctrl+Y)"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent',
            color: redoStack.length > 0 ? '#94A3B8' : '#475569',
            cursor: redoStack.length > 0 ? 'pointer' : 'default',
          }}
        >
          <RotateCw size={15} />
        </button>

        {/* 16. Lock All Drawings */}
        <button
          onClick={() => {
            setLockAllDrawings(!lockAllDrawings);
            toast.success(lockAllDrawings ? 'Drawings Unlocked' : 'All Drawings Locked');
          }}
          title={lockAllDrawings ? 'Drawings Locked' : 'Lock All Drawings'}
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: lockAllDrawings ? '#F59E0B' : 'transparent',
            color: lockAllDrawings ? '#000000' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          {lockAllDrawings ? <Lock size={15} /> : <Unlock size={15} />}
        </button>

        {/* 17. Hide / Show Drawings */}
        <button
          onClick={() => setHideAllDrawings(!hideAllDrawings)}
          title={hideAllDrawings ? 'Show Drawings' : 'Hide Drawings'}
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: hideAllDrawings ? '#EF5350' : 'transparent',
            color: hideAllDrawings ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          {hideAllDrawings ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>

        {/* 18. Clear All */}
        <button
          onClick={handleClearAll}
          title="Remove All Drawings"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent',
            color: '#94A3B8',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#EF5350')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* ── Selected Drawing Floating Context Action Toolbar ── */}
      {selectedDrawing && activeTool === 'crosshair' && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#131722',
          border: '1px solid #2962FF',
          borderRadius: 8,
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 60,
          boxShadow: '0 12px 32px rgba(0,0,0,0.85)',
          userSelect: 'none',
        }}>
          <span style={{ fontSize: '0.72rem', color: '#93C5FD', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {selectedDrawing.type.replace('_', ' ')}
          </span>

          {/* Color Presets */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {COLOR_PRESETS.map((c) => (
              <div
                key={c}
                onClick={() => {
                  const updated = drawings.map((d) => (d.id === selectedDrawingId ? { ...d, color: c } : d));
                  saveDrawingsWithHistory(updated, true);
                }}
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
                onClick={() => {
                  const updated = drawings.map((d) => (d.id === selectedDrawingId ? { ...d, strokeWidth: w } : d));
                  saveDrawingsWithHistory(updated, true);
                }}
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
                onClick={() => {
                  const updated = drawings.map((d) => (d.id === selectedDrawingId ? { ...d, lineStyle: st } : d));
                  saveDrawingsWithHistory(updated, true);
                }}
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

          {/* Duplicate Button */}
          <button
            onClick={handleDuplicateSelected}
            title="Duplicate Drawing (Ctrl+D)"
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2 }}
          >
            <Copy size={15} />
          </button>

          {/* Delete Button */}
          <button
            onClick={() => {
              saveDrawingsWithHistory(drawings.filter((d) => d.id !== selectedDrawingId), true);
              setSelectedDrawingId(null);
              toast.success('Deleted drawing');
            }}
            title="Delete Drawing (Del)"
            style={{ background: 'transparent', border: 'none', color: '#EF5350', cursor: 'pointer', padding: 2 }}
          >
            <Trash2 size={15} />
          </button>

          {/* Close Toolbar */}
          <button
            onClick={() => setSelectedDrawingId(null)}
            title="Close selection"
            style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 2 }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── High-Performance Interactive SVG Canvas ── */}
      {!hideAllDrawings && (
        <svg
          ref={svgRef}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onTouchStart={handleSvgMouseDown}
          onTouchMove={handleSvgMouseMove}
          onTouchEnd={handleSvgMouseUp}
          shapeRendering="geometricPrecision"
          style={{
            position: 'absolute',
            top: 0,
            left: 44,
            right: 0,
            bottom: 0,
            width: 'calc(100% - 44px)',
            height: '100%',
            zIndex: 45,
            pointerEvents: activeTool !== 'crosshair' ? 'all' : 'none',
            cursor: activeTool === 'crosshair' ? 'default' : 'crosshair',
            touchAction: 'none',
          }}
        >
          {/* Render All Saved Drawings */}
          {drawings.map((d) => {
            const isSelected = selectedDrawingId === d.id;
            const pt1 = chartToCoord(d.startLogical, d.startPrice, d.startX, d.startY);
            const pt2 = chartToCoord(d.endLogical,   d.endPrice,   d.endX,   d.endY);

            const strokeDash = d.lineStyle === 'dashed' ? '6,6' : (d.lineStyle === 'dotted' ? '2,4' : (isSelected ? '4,4' : 'none'));

            // 1. Horizontal Line
            if (d.type === 'horizontal_line') {
              return (
                <g key={d.id} style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}>
                  <line
                    x1={0} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair') {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        if (!lockAllDrawings) {
                          setDraggingHandle('body');
                          setDragStartPos({ x: e.clientX, y: e.clientY });
                          setChartLocked(true);
                        }
                      }
                    }}
                  />
                  <line
                    x1={0} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke={d.color || '#38BDF8'} strokeWidth={d.strokeWidth || 2}
                    strokeDasharray={strokeDash}
                  />
                  <rect
                    x={8} y={pt1.y - 18} width={75} height={16} rx={3}
                    fill="#131722" stroke={d.color || '#38BDF8'} strokeWidth={1}
                  />
                  <text x={12} y={pt1.y - 6} fill={d.color || '#38BDF8'} fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                    ₹{d.startPrice?.toFixed(2)}
                  </text>
                </g>
              );
            }

            // 2. Horizontal Ray
            if (d.type === 'horizontal_ray') {
              return (
                <g key={d.id} style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}>
                  <line
                    x1={pt1.x} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair') {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        if (!lockAllDrawings) {
                          setDraggingHandle('body');
                          setDragStartPos({ x: e.clientX, y: e.clientY });
                          setChartLocked(true);
                        }
                      }
                    }}
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
                    ₹{d.startPrice?.toFixed(2)}
                  </text>
                </g>
              );
            }

            // 3. Trend Line
            if (d.type === 'trendline') {
              return (
                <g key={d.id} style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}>
                  <line
                    x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair') {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        if (!lockAllDrawings) {
                          setDraggingHandle('body');
                          setDragStartPos({ x: e.clientX, y: e.clientY });
                          setChartLocked(true);
                        }
                      }
                    }}
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
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair' && !lockAllDrawings) {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        setDraggingHandle('start');
                        setDragStartPos({ x: e.clientX, y: e.clientY });
                        setChartLocked(true);
                      }
                    }}
                  />
                  <circle
                    cx={pt2.x} cy={pt2.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair' && !lockAllDrawings) {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        setDraggingHandle('end');
                        setDragStartPos({ x: e.clientX, y: e.clientY });
                        setChartLocked(true);
                      }
                    }}
                  />
                </g>
              );
            }

            // 4. Trend Ray (Ray extending to infinity)
            if (d.type === 'ray') {
              const dx = pt2.x - pt1.x;
              const dy = pt2.y - pt1.y;
              const angle = Math.atan2(dy, dx);
              const extendedLength = 3000;
              const extX = pt1.x + Math.cos(angle) * extendedLength;
              const extY = pt1.y + Math.sin(angle) * extendedLength;

              return (
                <g key={d.id} style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}>
                  <line
                    x1={pt1.x} y1={pt1.y} x2={extX} y2={extY}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair') {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        if (!lockAllDrawings) {
                          setDraggingHandle('body');
                          setDragStartPos({ x: e.clientX, y: e.clientY });
                          setChartLocked(true);
                        }
                      }
                    }}
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
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair' && !lockAllDrawings) {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        setDraggingHandle('start');
                        setDragStartPos({ x: e.clientX, y: e.clientY });
                        setChartLocked(true);
                      }
                    }}
                  />
                  <circle
                    cx={pt2.x} cy={pt2.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair' && !lockAllDrawings) {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        setDraggingHandle('end');
                        setDragStartPos({ x: e.clientX, y: e.clientY });
                        setChartLocked(true);
                      }
                    }}
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
                <g key={d.id} style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}>
                  {/* Channel Fill */}
                  <polygon
                    points={polyPoints}
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="none"
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair') {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        if (!lockAllDrawings) {
                          setDraggingHandle('body');
                          setDragStartPos({ x: e.clientX, y: e.clientY });
                          setChartLocked(true);
                        }
                      }
                    }}
                  />
                  {/* Upper & Lower Channel Lines */}
                  <line x1={upperP1.x} y1={upperP1.y} x2={upperP2.x} y2={upperP2.y} stroke={d.color || '#38BDF8'} strokeWidth={d.strokeWidth || 1.5} />
                  <line x1={lowerP1.x} y1={lowerP1.y} x2={lowerP2.x} y2={lowerP2.y} stroke={d.color || '#38BDF8'} strokeWidth={d.strokeWidth || 1.5} />
                  {/* Median Line */}
                  <line x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y} stroke={d.color || '#38BDF8'} strokeWidth={1} strokeDasharray="4,4" />

                  {/* Channel Width Handle */}
                  {isSelected && (
                    <circle
                      cx={upperP1.x} cy={upperP1.y} r={5}
                      fill="#FFF" stroke="#2962FF" strokeWidth={1.5}
                      style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                      onMouseDown={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        setDraggingHandle('channel');
                        setDragStartPos({ x: e.clientX, y: e.clientY });
                        setChartLocked(true);
                      }}
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

              const targetCoord = chartToCoord(d.startLogical, targetPrice, pt1.x, pt1.y - 60);
              const stopCoord   = chartToCoord(d.startLogical, stopPrice, pt1.x, pt1.y + 40);

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
                <g key={d.id} style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}>
                  {/* Target Box (Green) */}
                  <rect
                    x={startX} y={targetBoxTop} width={boxWidth} height={targetBoxHeight}
                    fill="rgba(16, 185, 129, 0.18)"
                    stroke="#10B981" strokeWidth={1}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair') {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        if (!lockAllDrawings) {
                          setDraggingHandle('body');
                          setDragStartPos({ x: e.clientX, y: e.clientY });
                          setChartLocked(true);
                        }
                      }
                    }}
                  />

                  {/* Stop Loss Box (Red) */}
                  <rect
                    x={startX} y={stopBoxTop} width={boxWidth} height={stopBoxHeight}
                    fill="rgba(239, 83, 80, 0.18)"
                    stroke="#EF5350" strokeWidth={1}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair') {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        if (!lockAllDrawings) {
                          setDraggingHandle('body');
                          setDragStartPos({ x: e.clientX, y: e.clientY });
                          setChartLocked(true);
                        }
                      }
                    }}
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
                    R:R {rrRatio.toFixed(2)} · TP +₹{targetDelta.toFixed(1)} (+{targetPct.toFixed(1)}%) · SL -₹{stopDelta.toFixed(1)} (-{stopPct.toFixed(1)}%)
                  </text>

                  {/* Target Handle */}
                  <circle
                    cx={startX + boxWidth / 2} cy={targetY} r={5}
                    fill="#10B981" stroke="#FFF" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                    onMouseDown={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      setSelectedDrawingId(d.id);
                      setDraggingHandle('target');
                      setDragStartPos({ x: e.clientX, y: e.clientY });
                      setChartLocked(true);
                    }}
                  />

                  {/* Stop Handle */}
                  <circle
                    cx={startX + boxWidth / 2} cy={stopY} r={5}
                    fill="#EF5350" stroke="#FFF" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                    onMouseDown={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      setSelectedDrawingId(d.id);
                      setDraggingHandle('stop');
                      setDragStartPos({ x: e.clientX, y: e.clientY });
                      setChartLocked(true);
                    }}
                  />
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
                  onMouseDown={(e) => {
                    if (activeTool === 'crosshair') {
                      e.preventDefault(); e.stopPropagation();
                      setSelectedDrawingId(d.id);
                      if (!lockAllDrawings) {
                        setDraggingHandle('body');
                        setDragStartPos({ x: e.clientX, y: e.clientY });
                        setChartLocked(true);
                      }
                    }
                  }}
                >
                  {FIBONACCI_LEVELS.slice(0, -1).map((fib, idx) => {
                    const nextFib = FIBONACCI_LEVELS[idx + 1];
                    const y1 = pt1.y < pt2.y ? minY + height * fib.level : maxY - height * fib.level;
                    const y2 = pt1.y < pt2.y ? minY + height * nextFib.level : maxY - height * nextFib.level;
                    const bandTop = Math.min(y1, y2);
                    const bandHeight = Math.abs(y2 - y1);
                    return (
                      <rect
                        key={`band-${fib.level}`}
                        x={startX} y={bandTop} width={width} height={bandHeight}
                        fill={fib.fill}
                      />
                    );
                  })}

                  {FIBONACCI_LEVELS.map((fib) => {
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
                      <circle cx={pt1.x} cy={pt1.y} r={5} fill="#FFF" stroke="#2962FF" strokeWidth={2} />
                      <circle cx={pt2.x} cy={pt2.y} r={5} fill="#FFF" stroke="#2962FF" strokeWidth={2} />
                    </>
                  )}
                </g>
              );
            }

            // 8. Freehand Brush
            if (d.type === 'brush' && d.points?.length > 1) {
              const livePoints = d.points.map(pt => chartToCoord(pt.logical, pt.price, pt.x, pt.y));
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
                  onMouseDown={(e) => {
                    if (activeTool === 'crosshair') {
                      e.preventDefault(); e.stopPropagation();
                      setSelectedDrawingId(d.id);
                      if (!lockAllDrawings) {
                        setDraggingHandle('body');
                        setDragStartPos({ x: e.clientX, y: e.clientY });
                        setChartLocked(true);
                      }
                    }
                  }}
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
              return (
                <g key={d.id} style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}>
                  <rect
                    x={x} y={y} width={w} height={h}
                    fill="rgba(56, 189, 248, 0.12)"
                    stroke={d.color || '#38BDF8'}
                    strokeWidth={d.strokeWidth || 1.5}
                    strokeDasharray={isSelected ? '4,4' : 'none'}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair') {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        if (!lockAllDrawings) {
                          setDraggingHandle('body');
                          setDragStartPos({ x: e.clientX, y: e.clientY });
                          setChartLocked(true);
                        }
                      }
                    }}
                  />
                  {isSelected && (
                    <>
                      <circle cx={x} cy={y} r={4} fill="#FFF" stroke="#2962FF" strokeWidth={1} />
                      <circle cx={x + w} cy={y} r={4} fill="#FFF" stroke="#2962FF" strokeWidth={1} />
                      <circle cx={x} cy={y + h} r={4} fill="#FFF" stroke="#2962FF" strokeWidth={1} />
                      <circle cx={x + w} cy={y + h} r={4} fill="#FFF" stroke="#2962FF" strokeWidth={1} />
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

              return (
                <g key={d.id} style={{ pointerEvents: 'visiblePainted', cursor: 'pointer' }}>
                  <rect
                    x={x} y={y} width={w} height={h}
                    fill={priceDelta >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,83,80,0.15)'}
                    stroke={priceDelta >= 0 ? '#10B981' : '#EF5350'}
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <text x={x + 6} y={y + 14} fill="#FFF" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                    {priceDelta >= 0 ? '+' : ''}{priceDelta.toFixed(2)} ({pricePercent.toFixed(2)}%) · {Math.max(1, Math.round(dx / 8))} bars
                  </text>
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
                  onMouseDown={(e) => {
                    if (activeTool === 'crosshair') {
                      e.preventDefault(); e.stopPropagation();
                      setSelectedDrawingId(d.id);
                      if (!lockAllDrawings) {
                        setDraggingHandle('body');
                        setDragStartPos({ x: e.clientX, y: e.clientY });
                        setChartLocked(true);
                      }
                    }
                  }}
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
                  onMouseDown={(e) => {
                    if (activeTool === 'crosshair') {
                      e.preventDefault(); e.stopPropagation();
                      setSelectedDrawingId(d.id);
                      if (!lockAllDrawings) {
                        setDraggingHandle('body');
                        setDragStartPos({ x: e.clientX, y: e.clientY });
                        setChartLocked(true);
                      }
                    }
                  }}
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
          left: textInputPos.x + 44,
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
              if (e.key === 'Escape') setTextInputPos(null);
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
          left: stickerPos.x + 44,
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
    </>
  );
}
