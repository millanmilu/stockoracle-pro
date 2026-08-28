import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Crosshair, TrendingUp, AlignJustify, Brush, Type, Smile,
  Ruler, ZoomIn, Magnet, Pencil, Lock, Unlock, Eye, EyeOff,
  Trash2, GripVertical, Square as SquareIcon, Sliders, Settings,
  X, Circle, Minus, Palette, Move, Copy
} from 'lucide-react';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'stockoracle_drawings_tv_v5';

const FIBONACCI_LEVELS = [
  { level: 0.0,   label: '0.0 (0%)',     color: '#787B86', fill: 'rgba(120, 123, 134, 0.08)' },
  { level: 0.236, label: '0.236 (23.6%)', color: '#EF5350', fill: 'rgba(239, 83, 80, 0.12)' },
  { level: 0.382, label: '0.382 (38.2%)', color: '#F59E0B', fill: 'rgba(245, 158, 11, 0.12)' },
  { level: 0.5,   label: '0.5 (50.0%)',   color: '#10B981', fill: 'rgba(16, 185, 129, 0.12)' },
  { level: 0.618, label: '0.618 (61.8%)', color: '#00E5FF', fill: 'rgba(0, 229, 255, 0.12)' },
  { level: 0.786, label: '0.786 (78.6%)', color: '#6366F1', fill: 'rgba(99, 102, 241, 0.12)' },
  { level: 1.0,   label: '1.0 (100%)',   color: '#A855F7', fill: 'rgba(168, 85, 247, 0.12)' },
];

export default function DrawingTools({ chartRef, candleRef, symbol, interval, chartReady, onOpenSettings }) {
  // Tool & State Management
  const [activeTool, setActiveTool] = useState('crosshair');
  const [drawings, setDrawings] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDraw, setCurrentDraw] = useState(null);
  
  // Re-render tick to synchronize drawing positions on chart pan/zoom
  const [, setRenderTick] = useState(0);

  // Selected / Dragging existing drawing
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  const [draggingHandle, setDraggingHandle] = useState(null); // 'start' | 'end' | 'body'
  const [dragStartPos, setDragStartPos] = useState(null);

  // Modifier Modes
  const [magnetMode, setMagnetMode] = useState(false);
  const [stayInDrawMode, setStayInDrawMode] = useState(false);
  const [lockAllDrawings, setLockAllDrawings] = useState(false);
  const [hideAllDrawings, setHideAllDrawings] = useState(false);

  // Text & Sticker modals
  const [textInputPos, setTextInputPos] = useState(null);
  const [textInputVal, setTextInputVal] = useState('');
  const [showStickerMenu, setShowStickerMenu] = useState(false);
  const [stickerPos, setStickerPos] = useState(null);

  // Line Style / Color Picker state
  const [activeColor, setActiveColor] = useState('#38BDF8');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(2);
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  // Floating toolbar positioning
  const [floatingPos, setFloatingPos] = useState({ top: 12, right: 18 });
  const [isDraggingFloating, setIsDraggingFloating] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingFloating) return;
      setFloatingPos((prev) => ({
        top: Math.max(0, prev.top + e.movementY),
        right: Math.max(0, prev.right - e.movementX),
      }));
    };
    const handleMouseUp = () => {
      setIsDraggingFloating(false);
    };
    if (isDraggingFloating) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingFloating]);

  // Synchronize on chart pan & zoom
  useEffect(() => {
    let cleanupTimeScale = null;
    let pollInterval = null;

    const attachListeners = () => {
      if (!chartRef?.current) return false;
      try {
        const timeScale = chartRef.current.timeScale();
        const handleRangeChange = () => {
          setRenderTick((t) => (t + 1) % 1000000);
        };
        timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
        timeScale.subscribeVisibleTimeRangeChange(handleRangeChange);

        try {
          chartRef.current.subscribeCrosshairMove(handleRangeChange);
        } catch (_) {}

        cleanupTimeScale = () => {
          try {
            timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
            timeScale.unsubscribeVisibleTimeRangeChange(handleRangeChange);
            chartRef.current?.unsubscribeCrosshairMove?.(handleRangeChange);
          } catch (_) {}
        };
        return true;
      } catch (_) {
        return false;
      }
    };

    const attached = attachListeners();
    if (!attached) {
      pollInterval = setInterval(() => {
        if (attachListeners()) {
          clearInterval(pollInterval);
          setRenderTick((t) => (t + 1) % 1000000);
        }
      }, 100);
    }

    const handleGlobalChartInteraction = () => {
      setRenderTick((t) => (t + 1) % 1000000);
    };

    window.addEventListener('resize', handleGlobalChartInteraction);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (cleanupTimeScale) cleanupTimeScale();
      window.removeEventListener('resize', handleGlobalChartInteraction);
    };
  }, [chartRef, chartReady]);

  // Real-time animation frame tracking while panning/dragging chart
  useEffect(() => {
    let isMouseDownOnChart = false;
    let animFrame = null;

    const onPointerDown = (e) => {
      if (e.target?.closest?.('svg') || e.target?.closest?.('canvas')) {
        isMouseDownOnChart = true;
      }
    };

    const onPointerMove = () => {
      if (isMouseDownOnChart) {
        if (!animFrame) {
          animFrame = requestAnimationFrame(() => {
            setRenderTick((t) => (t + 1) % 1000000);
            animFrame = null;
          });
        }
      }
    };

    const onPointerUp = () => {
      isMouseDownOnChart = false;
      if (animFrame) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
      }
      setRenderTick((t) => (t + 1) % 1000000);
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('wheel', onPointerMove, { passive: true });

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('wheel', onPointerMove);
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [activeTool]);

  // Convert screen coordinate (x, y) to chart logical time & price
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

  // Convert chart logical time & price back to current screen (x, y) coordinate
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

  // Disable / Enable chart pan & scroll to prevent chart jitter while drawing
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

  // Load saved drawings on mount / symbol change
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
  }, [symbol, interval]);

  // Delete key listener to remove selected drawing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId && !textInputPos) {
        if (lockAllDrawings) {
          toast.error('Drawings are locked');
          return;
        }
        setDrawings((prev) => {
          const next = prev.filter((d) => d.id !== selectedDrawingId);
          saveDrawings(next);
          return next;
        });
        setSelectedDrawingId(null);
        toast.success('Drawing deleted');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId, lockAllDrawings, textInputPos]);

  // Persist drawings to localStorage
  const saveDrawings = (newDrawings) => {
    const key = `${STORAGE_KEY}_${symbol}_${interval}`;
    try {
      localStorage.setItem(key, JSON.stringify(newDrawings));
    } catch (_) {}
    setDrawings(newDrawings);
  };

  const handleClearAll = () => {
    if (lockAllDrawings) {
      toast.error('Drawings are locked. Unlock first.');
      return;
    }
    saveDrawings([]);
    setSelectedDrawingId(null);
    toast.success('All drawings removed');
  };

  // Helper to extract client coordinate from Mouse or Touch events
  const getEventPos = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      clientX,
      clientY,
    };
  };

  // SVG Mouse & Touch Handlers
  const handleSvgMouseDown = (e) => {
    if (lockAllDrawings && activeTool !== 'crosshair') {
      toast.error('Drawings are locked');
      return;
    }

    const { x, y } = getEventPos(e);
    const chartPt = coordToChart(x, y);

    // In crosshair mode, clicking empty space deselects drawing
    if (activeTool === 'crosshair') {
      if (selectedDrawingId && !draggingHandle) {
        setSelectedDrawingId(null);
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Freeze chart panning
    setChartLocked(true);

    if (activeTool === 'text') {
      setTextInputPos({ x, y, logical: chartPt.logical, price: chartPt.price });
      setTextInputVal('');
      return;
    }

    if (activeTool === 'smile') {
      setStickerPos({ x, y, logical: chartPt.logical, price: chartPt.price });
      setShowStickerMenu(true);
      return;
    }

    if (activeTool === 'horizontal_line') {
      const hLine = {
        id: Date.now(),
        type: 'horizontal_line',
        startLogical: chartPt.logical,
        startPrice: chartPt.price,
        startX: x,
        startY: y,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
      };
      saveDrawings([...drawings, hLine]);
      setSelectedDrawingId(hLine.id);
      setChartLocked(false);
      if (!stayInDrawMode) setActiveTool('crosshair');
      toast.success('Horizontal Support/Resistance Line added');
      return;
    }

    if (activeTool === 'vertical_line') {
      const vLine = {
        id: Date.now(),
        type: 'vertical_line',
        startLogical: chartPt.logical,
        startPrice: chartPt.price,
        startX: x,
        startY: y,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
      };
      saveDrawings([...drawings, vLine]);
      setSelectedDrawingId(vLine.id);
      setChartLocked(false);
      if (!stayInDrawMode) setActiveTool('crosshair');
      toast.success('Vertical Time Line added');
      return;
    }

    setIsDrawing(true);
    if (activeTool === 'brush') {
      setCurrentDraw({
        id: Date.now(),
        type: 'brush',
        points: [{ x, y, logical: chartPt.logical, price: chartPt.price }],
        color: activeColor,
        strokeWidth: activeStrokeWidth,
      });
    } else {
      setCurrentDraw({
        id: Date.now(),
        type: activeTool,
        startX: x,
        startY: y,
        startLogical: chartPt.logical,
        startPrice: chartPt.price,
        endX: x,
        endY: y,
        endLogical: chartPt.logical,
        endPrice: chartPt.price,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
      });
    }
  };

  const handleSvgMouseMove = (e) => {
    const { x, y } = getEventPos(e);
    const chartPt = coordToChart(x, y);

    // Moving an existing selected drawing or handle
    if (draggingHandle && selectedDrawingId && dragStartPos && !lockAllDrawings) {
      e.preventDefault();
      e.stopPropagation();
      const dx = x - dragStartPos.x;
      const dy = y - dragStartPos.y;

      setDrawings((prev) =>
        prev.map((d) => {
          if (d.id !== selectedDrawingId) return d;
          if (draggingHandle === 'start') {
            return {
              ...d,
              startX: x,
              startY: y,
              startLogical: chartPt.logical,
              startPrice: chartPt.price,
            };
          }
          if (draggingHandle === 'end') {
            return {
              ...d,
              endX: x,
              endY: y,
              endLogical: chartPt.logical,
              endPrice: chartPt.price,
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
            };
          }
          return d;
        })
      );
      setDragStartPos({ x, y });
      return;
    }

    // Actively drawing new item
    if (!isDrawing || !currentDraw) return;
    e.preventDefault();
    e.stopPropagation();

    if (currentDraw.type === 'brush') {
      setCurrentDraw((prev) => ({
        ...prev,
        points: [...(prev.points || []), { x, y, logical: chartPt.logical, price: chartPt.price }],
      }));
    } else {
      setCurrentDraw((prev) => ({
        ...prev,
        endX: x,
        endY: y,
        endLogical: chartPt.logical,
        endPrice: chartPt.price,
      }));
    }
  };

  const handleSvgMouseUp = (e) => {
    // Release drag handle
    if (draggingHandle) {
      e.preventDefault();
      e.stopPropagation();
      setDraggingHandle(null);
      setDragStartPos(null);
      saveDrawings(drawings);
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
      saveDrawings(updated);
      setSelectedDrawingId(currentDraw.id);
    }

    setIsDrawing(false);
    setCurrentDraw(null);
    setChartLocked(false);

    if (!stayInDrawMode && activeTool !== 'brush') {
      setActiveTool('crosshair');
    }
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
      saveDrawings([...drawings, textDrawing]);
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
      saveDrawings([...drawings, stickerDrawing]);
      setSelectedDrawingId(stickerDrawing.id);
    }
    setShowStickerMenu(false);
    setStickerPos(null);
    setChartLocked(false);
    if (!stayInDrawMode) setActiveTool('crosshair');
  };

  const handleDuplicateSelected = () => {
    if (!selectedDrawingId) return;
    const target = drawings.find((d) => d.id === selectedDrawingId);
    if (!target) return;

    const dup = {
      ...target,
      id: Date.now(),
      startX: (target.startX || 0) + 15,
      startY: (target.startY || 0) + 15,
      endX: (target.endX || 0) + 15,
      endY: (target.endY || 0) + 15,
      startLogical: (target.startLogical != null) ? target.startLogical + 2 : null,
      endLogical: (target.endLogical != null) ? target.endLogical + 2 : null,
    };
    saveDrawings([...drawings, dup]);
    setSelectedDrawingId(dup.id);
    toast.success('Drawing duplicated');
  };

  const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId);

  return (
    <>
      {/* ── Left Vertical Sidebar (TradingView Dark Icons) ── */}
      <div style={{
        width: 44,
        backgroundColor: '#131722',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 0',
        gap: 3,
        zIndex: 45,
        userSelect: 'none',
        flexShrink: 0,
      }}>
        {/* 1. Crosshair */}
        <button
          onClick={() => setActiveTool('crosshair')}
          title="Crosshair (Select / Pan)"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'crosshair' ? '#2A2E39' : 'transparent',
            color: activeTool === 'crosshair' ? '#2962FF' : '#787B86',
            cursor: 'pointer',
          }}
        >
          <Crosshair size={17} />
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
            backgroundColor: activeTool === 'trendline' ? '#2A2E39' : 'transparent',
            color: activeTool === 'trendline' ? '#2962FF' : '#787B86',
            cursor: 'pointer',
          }}
        >
          <TrendingUp size={17} />
        </button>

        {/* 3. Horizontal Line (Support/Resistance) */}
        <button
          onClick={() => {
            setActiveTool('horizontal_line');
            toast.success('Horizontal Line: Click on price level');
          }}
          title="Horizontal Support/Resistance Line"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'horizontal_line' ? '#2A2E39' : 'transparent',
            color: activeTool === 'horizontal_line' ? '#2962FF' : '#787B86',
            cursor: 'pointer',
          }}
        >
          <Minus size={17} />
        </button>

        {/* 4. Fibonacci Retracement */}
        <button
          onClick={() => {
            setActiveTool('fibonacci');
            toast.success('Fibonacci: Click and drag High to Low');
          }}
          title="Fibonacci Retracement"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'fibonacci' ? '#2A2E39' : 'transparent',
            color: activeTool === 'fibonacci' ? '#2962FF' : '#787B86',
            cursor: 'pointer',
          }}
        >
          <AlignJustify size={17} />
        </button>

        {/* 5. Rectangle Zone */}
        <button
          onClick={() => {
            setActiveTool('rectangle');
            toast.success('Rectangle: Click and drag to create Supply/Demand Zone');
          }}
          title="Rectangle Zone"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'rectangle' ? '#2A2E39' : 'transparent',
            color: activeTool === 'rectangle' ? '#2962FF' : '#787B86',
            cursor: 'pointer',
          }}
        >
          <SquareIcon size={16} />
        </button>

        {/* 6. Freehand Brush */}
        <button
          onClick={() => {
            setActiveTool('brush');
            toast.success('Brush: Click and drag freehand');
          }}
          title="Brush (Freehand Drawing)"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'brush' ? '#2A2E39' : 'transparent',
            color: activeTool === 'brush' ? '#2962FF' : '#787B86',
            cursor: 'pointer',
          }}
        >
          <Brush size={17} />
        </button>

        {/* 7. Text Tool ('T') */}
        <button
          onClick={() => {
            setActiveTool('text');
            toast.success('Text Tool: Click anywhere to type');
          }}
          title="Text Note ('T')"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'text' ? '#2A2E39' : 'transparent',
            color: activeTool === 'text' ? '#2962FF' : '#787B86',
            cursor: 'pointer',
          }}
        >
          <Type size={17} />
        </button>

        {/* 8. Stickers / Emojis */}
        <button
          onClick={() => {
            setActiveTool('smile');
            setShowStickerMenu(!showStickerMenu);
          }}
          title="Icons / Emojis / Stickers"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'smile' ? '#2A2E39' : 'transparent',
            color: activeTool === 'smile' ? '#2962FF' : '#787B86',
            cursor: 'pointer',
          }}
        >
          <Smile size={17} />
        </button>

        {/* 9. Ruler */}
        <button
          onClick={() => {
            setActiveTool('ruler');
            toast.success('Ruler: Click and drag to measure price & bars');
          }}
          title="Ruler (Measure Price & Bars)"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: activeTool === 'ruler' ? '#2A2E39' : 'transparent',
            color: activeTool === 'ruler' ? '#2962FF' : '#787B86',
            cursor: 'pointer',
          }}
        >
          <Ruler size={17} />
        </button>

        {/* 10. Magnet Mode */}
        <button
          onClick={() => {
            setMagnetMode(!magnetMode);
            toast.success(magnetMode ? 'Magnet Mode OFF' : 'Magnet Mode ON');
          }}
          title="Magnet Mode (Snap to OHLC)"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: magnetMode ? '#2A2E39' : 'transparent',
            color: magnetMode ? '#2962FF' : '#787B86',
            cursor: 'pointer',
          }}
        >
          <Magnet size={17} />
        </button>

        {/* 11. Lock All Drawings */}
        <button
          onClick={() => {
            setLockAllDrawings(!lockAllDrawings);
            toast.success(lockAllDrawings ? 'Drawings Unlocked' : 'All Drawings Locked');
          }}
          title="Lock All Drawings"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: lockAllDrawings ? '#2A2E39' : 'transparent',
            color: lockAllDrawings ? '#F59E0B' : '#787B86',
            cursor: 'pointer',
          }}
        >
          {lockAllDrawings ? <Lock size={16} /> : <Unlock size={16} />}
        </button>

        {/* 12. Hide / Show Drawings */}
        <button
          onClick={() => {
            setHideAllDrawings(!hideAllDrawings);
          }}
          title="Hide / Show Drawings"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: hideAllDrawings ? '#2A2E39' : 'transparent',
            color: hideAllDrawings ? '#EF5350' : '#787B86',
            cursor: 'pointer',
          }}
        >
          {hideAllDrawings ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>

        <div style={{ width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />

        {/* 13. Remove All */}
        <button
          onClick={handleClearAll}
          title="Remove All Drawings"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent',
            color: '#787B86',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#EF5350')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#787B86')}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* ── Selected Drawing Floating Context Action Toolbar ── */}
      {selectedDrawing && (
        <div style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1E222D',
          border: '1px solid #2962FF',
          borderRadius: 8,
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 60,
          boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
          userSelect: 'none',
        }}>
          <span style={{ fontSize: '0.72rem', color: '#93C5FD', fontWeight: 700, textTransform: 'uppercase' }}>
            {selectedDrawing.type} Selected
          </span>

          {/* Colors */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {['#38BDF8', '#10B981', '#F59E0B', '#EF5350', '#A855F7', '#FFFFFF'].map((c) => (
              <div
                key={c}
                onClick={() => {
                  setDrawings((prev) => prev.map((d) => (d.id === selectedDrawingId ? { ...d, color: c } : d)));
                  saveDrawings(drawings.map((d) => (d.id === selectedDrawingId ? { ...d, color: c } : d)));
                }}
                style={{
                  width: 16, height: 16, borderRadius: '50%', backgroundColor: c, cursor: 'pointer',
                  border: selectedDrawing.color === c ? '2px solid #FFF' : '1px solid transparent',
                }}
              />
            ))}
          </div>

          {/* Width */}
          <div style={{ display: 'flex', gap: 3 }}>
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                onClick={() => {
                  setDrawings((prev) => prev.map((d) => (d.id === selectedDrawingId ? { ...d, strokeWidth: w } : d)));
                  saveDrawings(drawings.map((d) => (d.id === selectedDrawingId ? { ...d, strokeWidth: w } : d)));
                }}
                style={{
                  padding: '2px 6px', borderRadius: 4, border: 'none',
                  backgroundColor: selectedDrawing.strokeWidth === w ? '#2962FF' : '#2A2E39',
                  color: '#FFF', fontSize: '0.65rem', cursor: 'pointer',
                }}
              >
                {w}px
              </button>
            ))}
          </div>

          <button
            onClick={handleDuplicateSelected}
            title="Duplicate Drawing"
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2 }}
          >
            <Copy size={15} />
          </button>

          <button
            onClick={() => {
              setDrawings((prev) => prev.filter((d) => d.id !== selectedDrawingId));
              saveDrawings(drawings.filter((d) => d.id !== selectedDrawingId));
              setSelectedDrawingId(null);
              toast.success('Deleted drawing');
            }}
            title="Delete Drawing"
            style={{ background: 'transparent', border: 'none', color: '#EF5350', cursor: 'pointer', padding: 2 }}
          >
            <Trash2 size={15} />
          </button>

          <button
            onClick={() => setSelectedDrawingId(null)}
            title="Close selection"
            style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 2 }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Interactive SVG Overlay Layer ── */}
      {!hideAllDrawings && (
        <svg
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onTouchStart={handleSvgMouseDown}
          onTouchMove={handleSvgMouseMove}
          onTouchEnd={handleSvgMouseUp}
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
          {/* Render Saved Drawings */}
          {drawings.map((d) => {
            const isSelected = selectedDrawingId === d.id;
            const pt1 = chartToCoord(d.startLogical, d.startPrice, d.startX, d.startY);
            const pt2 = chartToCoord(d.endLogical,   d.endPrice,   d.endX,   d.endY);

            // Horizontal Line
            if (d.type === 'horizontal_line') {
              return (
                <g key={d.id} style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}>
                  <line
                    x1={0} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke="transparent" strokeWidth={14}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair') {
                        e.preventDefault();
                        e.stopPropagation();
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
                    strokeDasharray={isSelected ? '6,6' : 'none'}
                  />
                  <text x={10} y={pt1.y - 4} fill={d.color || '#38BDF8'} fontSize="10" fontWeight="700" fontFamily="JetBrains Mono">
                    ₹{d.startPrice?.toFixed(2)}
                  </text>
                </g>
              );
            }

            // Vertical Line
            if (d.type === 'vertical_line') {
              return (
                <g key={d.id} style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}>
                  <line
                    x1={pt1.x} y1={0} x2={pt1.x} y2="100%"
                    stroke="transparent" strokeWidth={14}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair') {
                        e.preventDefault();
                        e.stopPropagation();
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
                    x1={pt1.x} y1={0} x2={pt1.x} y2="100%"
                    stroke={d.color || '#38BDF8'} strokeWidth={d.strokeWidth || 2}
                    strokeDasharray={isSelected ? '6,6' : 'none'}
                  />
                </g>
              );
            }

            // Trendline
            if (d.type === 'trendline') {
              return (
                <g key={d.id} style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}>
                  {/* Invisible wide hit area */}
                  <line
                    x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                    stroke="transparent" strokeWidth={14}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair') {
                        e.preventDefault();
                        e.stopPropagation();
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
                    strokeDasharray={isSelected ? '4,4' : 'none'}
                  />
                  {/* Start Handle */}
                  <circle
                    cx={pt1.x} cy={pt1.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#1E222D" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair' && !lockAllDrawings) {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedDrawingId(d.id);
                        setDraggingHandle('start');
                        setDragStartPos({ x: e.clientX, y: e.clientY });
                        setChartLocked(true);
                      }
                    }}
                  />
                  {/* End Handle */}
                  <circle
                    cx={pt2.x} cy={pt2.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#1E222D" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => {
                      if (activeTool === 'crosshair' && !lockAllDrawings) {
                        e.preventDefault();
                        e.stopPropagation();
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

            // Fibonacci Retracement
            if (d.type === 'fibonacci') {
              const minY = Math.min(pt1.y, pt2.y);
              const maxY = Math.max(pt1.y, pt2.y);
              const height = maxY - minY;
              const startX = Math.min(pt1.x, pt2.x);

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onMouseDown={(e) => {
                    if (activeTool === 'crosshair') {
                      e.preventDefault();
                      e.stopPropagation();
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
                        x={startX}
                        y={bandTop}
                        width={Math.max(300, Math.abs(pt2.x - pt1.x))}
                        height={bandHeight}
                        fill={fib.fill}
                      />
                    );
                  })}

                  {FIBONACCI_LEVELS.map((fib) => {
                    const y = pt1.y < pt2.y ? minY + height * fib.level : maxY - height * fib.level;
                    return (
                      <g key={fib.level}>
                        <line
                          x1={startX}
                          y1={y}
                          x2={startX + Math.max(300, Math.abs(pt2.x - pt1.x))}
                          y2={y}
                          stroke={fib.color}
                          strokeWidth={1}
                          strokeDasharray={isSelected ? '2,2' : 'none'}
                        />
                        <text
                          x={startX + 6}
                          y={y - 4}
                          fill={fib.color}
                          fontSize="10"
                          fontWeight="700"
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

            // Brush Freehand
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
                      e.preventDefault();
                      e.stopPropagation();
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

            // Rectangle Zone
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
                        e.preventDefault();
                        e.stopPropagation();
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

            // Ruler / Measure
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
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: 'pointer' }}
                  onMouseDown={(e) => {
                    if (activeTool === 'crosshair') {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedDrawingId(d.id);
                    }
                  }}
                >
                  <rect
                    x={x} y={y} width={w} height={h}
                    fill={priceDelta >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,83,80,0.15)'}
                    stroke={priceDelta >= 0 ? '#10B981' : '#EF5350'}
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <text x={x + 6} y={y + 14} fill="#FFF" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono">
                    {priceDelta >= 0 ? '+' : ''}{priceDelta.toFixed(2)} ({pricePercent.toFixed(2)}%) · {Math.max(1, Math.round(dx / 8))} bars
                  </text>
                </g>
              );
            }

            // Text Note
            if (d.type === 'text') {
              return (
                <text
                  key={d.id}
                  x={pt1.x} y={pt1.y}
                  fill={d.color || '#F0F0FF'}
                  fontSize="12" fontWeight="600" fontFamily="Inter, sans-serif"
                  onMouseDown={(e) => {
                    if (activeTool === 'crosshair') {
                      e.preventDefault();
                      e.stopPropagation();
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

            // Sticker Emoji
            if (d.type === 'sticker') {
              return (
                <text
                  key={d.id}
                  x={pt1.x - 10} y={pt1.y + 10}
                  fontSize="22"
                  onMouseDown={(e) => {
                    if (activeTool === 'crosshair') {
                      e.preventDefault();
                      e.stopPropagation();
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

          {/* Realtime Drawing Preview */}
          {currentDraw && (
            <>
              {currentDraw.type === 'trendline' && (
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
              {currentDraw.type === 'vertical_line' && (
                <line
                  x1={currentDraw.startX} y1={0}
                  x2={currentDraw.startX} y2="100%"
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
                      <g key={fib.level}>
                        <line
                          x1={Math.min(currentDraw.startX, currentDraw.endX)}
                          y1={y}
                          x2={Math.min(currentDraw.startX, currentDraw.endX) + Math.max(300, Math.abs(currentDraw.endX - currentDraw.startX))}
                          y2={y}
                          stroke={fib.color}
                          strokeWidth={1}
                          strokeDasharray="3,3"
                        />
                        <text
                          x={Math.min(currentDraw.startX, currentDraw.endX) + 6}
                          y={y - 4}
                          fill={fib.color}
                          fontSize="10"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {fib.label}
                        </text>
                      </g>
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
        </svg>
      )}

      {/* Floating Text Note Input */}
      {textInputPos && (
        <div style={{
          position: 'absolute',
          left: textInputPos.x + 44,
          top: textInputPos.y,
          zIndex: 60,
          background: '#1E222D',
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
              background: '#131722',
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
          background: '#1E222D',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 8,
          padding: 8,
          display: 'flex',
          gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
        }}>
          {['🚀', '📈', '📉', '🎯', '⭐', '🔥', '👍', '❌'].map((emoji) => (
            <span
              key={emoji}
              onClick={() => handleAddSticker(emoji)}
              style={{ fontSize: 20, cursor: 'pointer' }}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
