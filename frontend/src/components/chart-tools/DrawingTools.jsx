import { useState, useRef, useEffect } from 'react';
import { 
  TrendingUp, Trash2, Save, Download, Upload, 
  MousePointer2, Square as SquareIcon, Circle, Type,
  MoveDown, Pencil, X
} from 'lucide-react';
import toast from 'react-hot-toast';

const DRAWING_TOOLS = [
  { id: 'pointer', label: 'Cursor (Select/Pan)', icon: MousePointer2 },
  { id: 'trendline', label: 'Trend Line', icon: TrendingUp },
  { id: 'horizontal', label: 'Horizontal Ray / Level', icon: MoveDown },
  { id: 'rectangle', label: 'Support/Resistance Box', icon: SquareIcon },
  { id: 'circle', label: 'Circle Marker', icon: Circle },
  { id: 'text', label: 'Text Annotation', icon: Type },
];

const STORAGE_KEY = 'stockoracle_drawings_v2';

export default function DrawingTools({ chartRef, symbol, interval, overlayContainerRef }) {
  const [activeTool, setActiveTool] = useState('pointer');
  const [drawings, setDrawings] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDraw, setCurrentDraw] = useState(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  const [textInputPos, setTextInputPos] = useState(null);
  const [textInputVal, setTextInputVal] = useState('');

  // Load saved drawings on symbol/interval change
  useEffect(() => {
    const key = `${STORAGE_KEY}_${symbol}_${interval}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setDrawings(JSON.parse(saved));
      } catch (e) {
        setDrawings([]);
      }
    } else {
      setDrawings([]);
    }
  }, [symbol, interval]);

  // Save drawings
  const saveDrawings = (newDrawings) => {
    const key = `${STORAGE_KEY}_${symbol}_${interval}`;
    try {
      localStorage.setItem(key, JSON.stringify(newDrawings));
    } catch (_) {}
    setDrawings(newDrawings);
  };

  const clearDrawings = () => {
    saveDrawings([]);
    setSelectedDrawingId(null);
    toast.success('All drawings cleared');
  };

  const exportDrawings = () => {
    const dataStr = JSON.stringify(drawings, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drawings_${symbol}_${interval}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Drawings exported');
  };

  // SVG Mouse handlers
  const handleSvgMouseDown = (e) => {
    if (activeTool === 'pointer') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'text') {
      setTextInputPos({ x, y });
      setTextInputVal('');
      return;
    }

    setIsDrawing(true);
    setCurrentDraw({
      id: Date.now(),
      type: activeTool,
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      color: activeTool === 'trendline' ? '#38BDF8' : activeTool === 'horizontal' ? '#F59E0B' : '#A855F7',
    });
  };

  const handleSvgMouseMove = (e) => {
    if (!isDrawing || !currentDraw) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentDraw(prev => ({ ...prev, endX: x, endY: y }));
  };

  const handleSvgMouseUp = () => {
    if (!isDrawing || !currentDraw) return;
    const dx = Math.abs(currentDraw.endX - currentDraw.startX);
    const dy = Math.abs(currentDraw.endY - currentDraw.startY);
    if (dx > 3 || dy > 3 || currentDraw.type === 'horizontal') {
      saveDrawings([...drawings, currentDraw]);
    }
    setIsDrawing(false);
    setCurrentDraw(null);
  };

  const handleAddText = () => {
    if (textInputPos && textInputVal.trim()) {
      const textDrawing = {
        id: Date.now(),
        type: 'text',
        startX: textInputPos.x,
        startY: textInputPos.y,
        text: textInputVal.trim(),
        color: '#F0F0FF',
      };
      saveDrawings([...drawings, textDrawing]);
    }
    setTextInputPos(null);
    setTextInputVal('');
  };

  const deleteDrawing = (id, e) => {
    if (e) e.stopPropagation();
    saveDrawings(drawings.filter(d => d.id !== id));
    if (selectedDrawingId === id) setSelectedDrawingId(null);
  };

  return (
    <>
      {/* ── TradingView Style Vertical Left Sidebar (42px) ── */}
      <div style={{
        width: 42,
        backgroundColor: '#0A0D1A',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
        gap: 6,
        zIndex: 40,
        userSelect: 'none',
        flexShrink: 0,
      }}>
        {DRAWING_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id);
                if (tool.id !== 'text') setTextInputPos(null);
              }}
              title={tool.label}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: isActive ? '1px solid #3B82F6' : '1px solid transparent',
                background: isActive ? 'rgba(59,130,246,0.2)' : 'transparent',
                color: isActive ? '#60A5FA' : '#64748B',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = '#F0F0FF';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = '#64748B';
              }}
            >
              <Icon size={16} />
            </button>
          );
        })}

        <div style={{ width: 24, height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

        {/* Clear All Drawings */}
        <button
          onClick={clearDrawings}
          title="Clear All Drawings"
          disabled={drawings.length === 0}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid transparent',
            background: 'transparent',
            color: drawings.length > 0 ? '#EF5350' : '#374151',
            cursor: drawings.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          <Trash2 size={15} />
        </button>

        {/* Export Drawings */}
        <button
          onClick={exportDrawings}
          title="Export Drawings JSON"
          disabled={drawings.length === 0}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid transparent',
            background: 'transparent',
            color: drawings.length > 0 ? '#10B981' : '#374151',
            cursor: drawings.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          <Download size={15} />
        </button>

        {/* Saved Count Badge */}
        {drawings.length > 0 && (
          <span style={{
            fontSize: '0.6rem',
            color: '#94A3B8',
            fontFamily: 'JetBrains Mono, monospace',
            marginTop: 'auto',
            paddingBottom: 4,
          }}>
            {drawings.length}
          </span>
        )}
      </div>

      {/* ── Direct Interactive SVG Overlay on Chart Canvas ── */}
      <svg
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
        style={{
          position: 'absolute',
          top: 0,
          left: 42,
          right: 0,
          bottom: 0,
          width: 'calc(100% - 42px)',
          height: '100%',
          zIndex: activeTool !== 'pointer' ? 25 : 5,
          pointerEvents: activeTool !== 'pointer' ? 'all' : 'none',
          cursor: activeTool === 'pointer' ? 'default' : 'crosshair',
        }}
      >
        {/* Render Saved Drawings */}
        {drawings.map((d) => {
          const isSelected = selectedDrawingId === d.id;
          if (d.type === 'trendline') {
            return (
              <g key={d.id} onClick={() => setSelectedDrawingId(d.id)} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                <line
                  x1={d.startX}
                  y1={d.startY}
                  x2={d.endX}
                  y2={d.endY}
                  stroke={d.color || '#38BDF8'}
                  strokeWidth={isSelected ? 3 : 2}
                  strokeDasharray={isSelected ? '4,4' : 'none'}
                />
                <circle cx={d.startX} cy={d.startY} r={3} fill={d.color || '#38BDF8'} />
                <circle cx={d.endX} cy={d.endY} r={3} fill={d.color || '#38BDF8'} />
              </g>
            );
          }
          if (d.type === 'horizontal') {
            return (
              <g key={d.id} onClick={() => setSelectedDrawingId(d.id)} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                <line
                  x1={0}
                  y1={d.startY}
                  x2={2000}
                  y2={d.startY}
                  stroke={d.color || '#F59E0B'}
                  strokeWidth={isSelected ? 2 : 1.5}
                  strokeDasharray="5,5"
                />
                <text x={10} y={d.startY - 4} fill={d.color || '#F59E0B'} fontSize="10" fontFamily="JetBrains Mono">
                  Level {d.startY.toFixed(0)}px
                </text>
              </g>
            );
          }
          if (d.type === 'rectangle') {
            const x = Math.min(d.startX, d.endX);
            const y = Math.min(d.startY, d.endY);
            const w = Math.abs(d.endX - d.startX);
            const h = Math.abs(d.endY - d.startY);
            return (
              <rect
                key={d.id}
                x={x}
                y={y}
                width={w}
                height={h}
                fill="rgba(168,85,247,0.12)"
                stroke={d.color || '#A855F7'}
                strokeWidth={isSelected ? 2 : 1.5}
                onClick={() => setSelectedDrawingId(d.id)}
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              />
            );
          }
          if (d.type === 'circle') {
            const r = Math.sqrt(Math.pow(d.endX - d.startX, 2) + Math.pow(d.endY - d.startY, 2));
            return (
              <circle
                key={d.id}
                cx={d.startX}
                cy={d.startY}
                r={Math.max(r, 6)}
                fill="rgba(59,130,246,0.15)"
                stroke={d.color || '#60A5FA'}
                strokeWidth={isSelected ? 2 : 1.5}
                onClick={() => setSelectedDrawingId(d.id)}
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              />
            );
          }
          if (d.type === 'text') {
            return (
              <text
                key={d.id}
                x={d.startX}
                y={d.startY}
                fill="#F0F0FF"
                fontSize="12"
                fontWeight="600"
                fontFamily="Inter, sans-serif"
                onClick={() => setSelectedDrawingId(d.id)}
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              >
                {d.text}
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
                x1={currentDraw.startX}
                y1={currentDraw.startY}
                x2={currentDraw.endX}
                y2={currentDraw.endY}
                stroke="#38BDF8"
                strokeWidth={2}
                strokeDasharray="4,4"
              />
            )}
            {currentDraw.type === 'horizontal' && (
              <line
                x1={0}
                y1={currentDraw.startY}
                x2={2000}
                y2={currentDraw.startY}
                stroke="#F59E0B"
                strokeWidth={2}
                strokeDasharray="4,4"
              />
            )}
            {currentDraw.type === 'rectangle' && (
              <rect
                x={Math.min(currentDraw.startX, currentDraw.endX)}
                y={Math.min(currentDraw.startY, currentDraw.endY)}
                width={Math.abs(currentDraw.endX - currentDraw.startX)}
                height={Math.abs(currentDraw.endY - currentDraw.startY)}
                fill="rgba(168,85,247,0.15)"
                stroke="#A855F7"
                strokeWidth={2}
                strokeDasharray="4,4"
              />
            )}
            {currentDraw.type === 'circle' && (
              <circle
                cx={currentDraw.startX}
                cy={currentDraw.startY}
                r={Math.max(Math.sqrt(Math.pow(currentDraw.endX - currentDraw.startX, 2) + Math.pow(currentDraw.endY - currentDraw.startY, 2)), 6)}
                fill="rgba(59,130,246,0.15)"
                stroke="#60A5FA"
                strokeWidth={2}
                strokeDasharray="4,4"
              />
            )}
          </>
        )}
      </svg>

      {/* Floating Text Input Box */}
      {textInputPos && (
        <div style={{
          position: 'absolute',
          left: textInputPos.x + 42,
          top: textInputPos.y,
          zIndex: 60,
          background: '#0F172A',
          border: '1px solid #6366F1',
          borderRadius: 6,
          padding: 4,
          display: 'flex',
          gap: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
        }}>
          <input
            type="text"
            placeholder="Type note & hit Enter..."
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
              background: '#6366F1',
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
    </>
  );
}
