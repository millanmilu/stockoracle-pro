import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Crosshair, TrendingUp, AlignJustify, Brush, Type, Smile,
  Ruler, ZoomIn, Magnet, Pencil, Lock, Unlock, Eye, EyeOff,
  Trash2, GripVertical, Square as SquareIcon, Sliders, Settings,
  X, Circle, Minus, Palette, Move, Download, Check
} from 'lucide-react';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'stockoracle_drawings_tv_v4';

const FIBONACCI_LEVELS = [
  { level: 0.0,   label: '0.0 (0%)',     color: '#787B86', fill: 'rgba(120, 123, 134, 0.08)' },
  { level: 0.236, label: '0.236 (23.6%)', color: '#EF5350', fill: 'rgba(239, 83, 80, 0.12)' },
  { level: 0.382, label: '0.382 (38.2%)', color: '#F59E0B', fill: 'rgba(245, 158, 11, 0.12)' },
  { level: 0.5,   label: '0.5 (50.0%)',   color: '#10B981', fill: 'rgba(16, 185, 129, 0.12)' },
  { level: 0.618, label: '0.618 (61.8%)', color: '#00E5FF', fill: 'rgba(0, 229, 255, 0.12)' },
  { level: 0.786, label: '0.786 (78.6%)', color: '#6366F1', fill: 'rgba(99, 102, 241, 0.12)' },
  { level: 1.0,   label: '1.0 (100%)',   color: '#A855F7', fill: 'rgba(168, 85, 247, 0.12)' },
];

export default function DrawingTools({ chartRef, candleRef, symbol, interval, onOpenSettings }) {
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
  const floatDragRef = useRef(null);

  // Synchronize on chart pan & zoom (Visible Logical Range Change)
  useEffect(() => {
    if (!chartRef?.current) return;
    const timeScale = chartRef.current.timeScale();
    const handleRangeChange = () => {
      setRenderTick((t) => t + 1);
    };
    try {
      timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    } catch (_) {}
    return () => {
      try {
        timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      } catch (_) {}
    };
  }, [chartRef]);

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
    e.preventDefault();
    e.stopPropagation();

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
    if (activeTool !== 'crosshair' || draggingHandle) {
      e.preventDefault();
      e.stopPropagation();
    }

    const { x, y } = getEventPos(e);
    const chartPt = coordToChart(x, y);

    // Moving an existing selected drawing or handle
    if (draggingHandle && selectedDrawingId && dragStartPos && !lockAllDrawings) {
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
    e.preventDefault();
    e.stopPropagation();

    // Release drag handle
    if (draggingHandle) {
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

    // If not staying in draw mode, revert back to crosshair
    if (!stayInDrawMode && activeTool !== 'brush') {
      setActiveTool('crosshair');
    }
  };

  const handleAddText = () => {
    if (textInputPos && textInputVal.trim()) {
      const textDrawing = {
        id: Date.now(),
        type: 'text',
        startX: textInputPos.x,
        startY: textInputPos.y,
        startLogical: textInputPos.logical,
        startPrice: textInputPos.price,
        text: textInputVal.trim(),
        color: activeColor || '#F0F0FF',
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

  return (
    <>
      {/* ── Left Vertical Sidebar (13 TradingView Dark Grey Icons) ── */}
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

        {/* 2. Trend Line Tools */}
        <button
          onClick={() => {
            setActiveTool('trendline');
            toast.success('Trend Line: Click and drag on chart to draw');
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

        {/* 3. Fibonacci Tools */}
        <button
          onClick={() => {
            setActiveTool('fibonacci');
            toast.success('Fibonacci: Click and drag on chart to draw');
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

        {/* 4. Brush / Shapes */}
        <button
          onClick={() => {
            setActiveTool('brush');
            toast.success('Brush: Click and drag freehand to draw');
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

        {/* 5. Text Tool ('T') */}
        <button
          onClick={() => {
            setActiveTool('text');
            toast.success('Text Tool: Click anywhere on chart to type');
          }}
          title="Text Tool ('T')"
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

        {/* 6. Smiley Face (Stickers) */}
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

        {/* 7. Ruler (Measure) */}
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

        {/* 8. Zoom in (Magnifying glass) */}
        <button
          onClick={() => {
            if (chartRef?.current) {
              chartRef.current.timeScale().zoom(1.3);
              toast.success('Zoom In');
            }
          }}
          title="Zoom In"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent',
            color: '#787B86',
            cursor: 'pointer',
          }}
        >
          <ZoomIn size={17} />
        </button>

        {/* 9. Magnet Mode */}
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

        {/* 10. Pencil with Lock (Stay in Drawing Mode) */}
        <button
          onClick={() => {
            setStayInDrawMode(!stayInDrawMode);
            toast.success(stayInDrawMode ? 'Stay in Drawing Mode OFF' : 'Stay in Drawing Mode ON');
          }}
          title="Stay in Drawing Mode"
          style={{
            width: 32, height: 32, borderRadius: 5, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: stayInDrawMode ? '#2A2E39' : 'transparent',
            color: stayInDrawMode ? '#2962FF' : '#787B86',
            cursor: 'pointer',
          }}
        >
          <Pencil size={16} />
        </button>

        {/* 11. Padlock (Lock All Drawings) */}
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

        {/* 12. Eye Icon (Hide Drawings) */}
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

        {/* 13. Trash Can (Remove All) */}
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

      {/* ── Floating Toolbar (Top Right: 5 Small White Icons) ── */}
      <div
        style={{
          position: 'absolute',
          top: floatingPos.top,
          right: floatingPos.right,
          backgroundColor: '#1E222D',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 6,
          padding: '3px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          zIndex: 50,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
          userSelect: 'none',
        }}
      >
        {/* 1. Drag Dots Handle */}
        <span
          title="Drag to reposition toolbar"
          style={{ color: '#787B86', cursor: 'grab', display: 'flex', alignItems: 'center' }}
        >
          <GripVertical size={14} />
        </span>

        {/* 2. Trendline Quick Tool */}
        <button
          onClick={() => setActiveTool('trendline')}
          title="Quick Trendline"
          style={{
            background: activeTool === 'trendline' ? '#2A2E39' : 'transparent',
            border: 'none',
            borderRadius: 4,
            padding: 4,
            color: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <TrendingUp size={14} />
        </button>

        {/* 3. Rectangle Tool */}
        <button
          onClick={() => setActiveTool('rectangle')}
          title="Quick Rectangle Zone"
          style={{
            background: activeTool === 'rectangle' ? '#2A2E39' : 'transparent',
            border: 'none',
            borderRadius: 4,
            padding: 4,
            color: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <SquareIcon size={14} />
        </button>

        {/* 4. Line Style Icon (Color & Stroke Picker) */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowStyleMenu(!showStyleMenu)}
            title="Line Style & Color"
            style={{
              background: showStyleMenu ? '#2A2E39' : 'transparent',
              border: 'none',
              borderRadius: 4,
              padding: 4,
              color: activeColor,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Sliders size={14} />
          </button>

          {/* Color / Style Palette Popup */}
          {showStyleMenu && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              backgroundColor: '#1E222D',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 8,
              padding: 8,
              zIndex: 100,
              width: 140,
              boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
            }}>
              <div style={{ fontSize: '0.65rem', color: '#787B86', marginBottom: 6, fontWeight: 700 }}>COLOR</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {['#38BDF8', '#10B981', '#F59E0B', '#EF5350', '#A855F7', '#FFFFFF'].map((c) => (
                  <div
                    key={c}
                    onClick={() => { setActiveColor(c); setShowStyleMenu(false); }}
                    style={{
                      width: 18, height: 18, borderRadius: '50%', backgroundColor: c,
                      border: activeColor === c ? '2px solid #FFF' : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>

              <div style={{ fontSize: '0.65rem', color: '#787B86', marginBottom: 4, fontWeight: 700 }}>WIDTH</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    onClick={() => { setActiveStrokeWidth(w); setShowStyleMenu(false); }}
                    style={{
                      flex: 1, padding: '2px 0', borderRadius: 4, border: 'none',
                      backgroundColor: activeStrokeWidth === w ? '#2962FF' : '#2A2E39',
                      color: '#FFF', fontSize: '0.68rem', cursor: 'pointer',
                    }}
                  >
                    {w}px
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5. Settings Menu Icon */}
        <button
          onClick={() => {
            if (onOpenSettings) onOpenSettings();
          }}
          title="Chart & Drawing Settings"
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            padding: 4,
            color: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Settings size={14} />
        </button>
      </div>

      {/* ── Direct Interactive SVG Overlay Layer ── */}
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

            // Trendline
            if (d.type === 'trendline') {
              return (
                <g key={d.id} style={{ pointerEvents: 'auto', cursor: isSelected ? 'move' : 'pointer' }}>
                  <line
                    x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                    stroke={d.color || '#38BDF8'}
                    strokeWidth={d.strokeWidth || 2}
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
                  {/* Start Handle */}
                  <circle
                    cx={pt1.x} cy={pt1.y} r={isSelected ? 5 : 3}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#1E222D" strokeWidth={1}
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
                    cx={pt2.x} cy={pt2.y} r={isSelected ? 5 : 3}
                    fill={isSelected ? '#FFFFFF' : d.color || '#38BDF8'}
                    stroke="#1E222D" strokeWidth={1}
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
              const rightX = Math.max(pt1.x, pt2.x) + Math.max(300, Math.abs(pt2.x - pt1.x));

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'auto', cursor: isSelected ? 'move' : 'pointer' }}
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
                  {/* Fibonacci colored bands */}
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

                  {/* Horizontal grid lines & labels */}
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

                  {/* Anchor handles */}
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
                  style={{ pointerEvents: 'auto', cursor: isSelected ? 'move' : 'pointer' }}
                />
              );
            }

            // Rectangle
            if (d.type === 'rectangle') {
              const x = Math.min(pt1.x, pt2.x);
              const y = Math.min(pt1.y, pt2.y);
              const w = Math.abs(pt2.x - pt1.x);
              const h = Math.abs(pt2.y - pt1.y);
              return (
                <g key={d.id} style={{ pointerEvents: 'auto', cursor: isSelected ? 'move' : 'pointer' }}>
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
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
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

            // Text
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
                  style={{ pointerEvents: 'auto', cursor: isSelected ? 'move' : 'pointer' }}
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
                  style={{ pointerEvents: 'auto', cursor: isSelected ? 'move' : 'pointer', userSelect: 'none' }}
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
