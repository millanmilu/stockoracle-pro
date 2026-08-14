import { useState, useRef, useEffect } from 'react';
import { 
  TrendingUp, Trash2, Save, Download, Upload, 
  MousePointer2, Square as SquareIcon, Circle, Type,
  MoveDown, Pencil
} from 'lucide-react';

const DRAWING_TOOLS = [
  { id: 'trendline', label: 'Trendline', icon: TrendingUp },
  { id: 'horizontal', label: 'H-Line', icon: MoveDown },
  { id: 'rectangle', label: 'Rectangle', icon: SquareIcon },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'text', label: 'Text', icon: Pencil },
];

const STORAGE_KEY = 'chart_drawings_v1';

export default function DrawingTools({ chartRef, symbol, interval }) {
  const [activeTool, setActiveTool] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const canvasRef = useRef(null);

  // Load saved drawings on mount or symbol/interval change
  useEffect(() => {
    const key = `${STORAGE_KEY}_${symbol}_${interval}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setDrawings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load drawings:', e);
      }
    } else {
      setDrawings([]);
    }
  }, [symbol, interval]);

  // Save drawings to localStorage
  const saveDrawings = (newDrawings) => {
    const key = `${STORAGE_KEY}_${symbol}_${interval}`;
    localStorage.setItem(key, JSON.stringify(newDrawings));
    setDrawings(newDrawings);
  };

  // Clear all drawings
  const clearDrawings = () => {
    saveDrawings([]);
    if (chartRef.current) {
      // Remove all drawing series from chart
      // This would need integration with the chart library
    }
  };

  // Export drawings as JSON
  const exportDrawings = () => {
    const dataStr = JSON.stringify(drawings, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drawings_${symbol}_${interval}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import drawings from JSON file
  const importDrawings = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          saveDrawings(imported);
        }
      } catch (err) {
        console.error('Failed to import drawings:', err);
      }
    };
    reader.readAsText(file);
  };

  // Handle mouse down on chart
  const handleMouseDown = (logical, price) => {
    if (!activeTool) return;
    setIsDrawing(true);
    setStartPoint({ logical, price });
  };

  // Handle mouse move on chart
  const handleMouseMove = (logical, price) => {
    if (!isDrawing || !startPoint || !activeTool) return;
    
    // Update preview of current drawing
    // This would integrate with chart library's overlay system
  };

  // Handle mouse up on chart
  const handleMouseUp = (logical, price) => {
    if (!isDrawing || !startPoint || !activeTool) return;
    
    const newDrawing = {
      id: Date.now(),
      tool: activeTool,
      startPoint,
      endPoint: { logical, price },
      color: '#A855F7',
      width: 2,
    };
    
    saveDrawings([...drawings, newDrawing]);
    setIsDrawing(false);
    setStartPoint(null);
    
    // Optionally keep tool active for multiple drawings
    // or reset: setActiveTool(null);
  };

  // Delete a specific drawing
  const deleteDrawing = (id) => {
    saveDrawings(drawings.filter(d => d.id !== id));
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 8,
      padding: '8px',
      background: 'rgba(9,12,24,0.95)',
      border: '1px solid rgba(168,85,247,0.2)',
      borderRadius: 8,
    }}>
      {/* Tool Selection */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {DRAWING_TOOLS.map(tool => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
              title={tool.label}
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                border: activeTool === tool.id ? '1px solid #A855F7' : '1px solid rgba(75,85,99,0.3)',
                background: activeTool === tool.id ? 'rgba(168,85,247,0.2)' : 'transparent',
                color: activeTool === tool.id ? '#C084FC' : '#6B7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.65rem',
                fontWeight: 600,
              }}
            >
              <Icon size={12} />
              <span style={{ fontSize: '0.62rem' }}>{tool.label}</span>
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
        <button
          onClick={clearDrawings}
          title="Clear All Drawings"
          style={{
            padding: '5px 8px',
            borderRadius: 6,
            border: '1px solid rgba(239,83,80,0.3)',
            background: 'rgba(239,83,80,0.1)',
            color: '#EF5350',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.65rem',
            fontWeight: 600,
          }}
        >
          <Trash2 size={11} />
          <span>Clear</span>
        </button>

        <button
          onClick={exportDrawings}
          title="Export Drawings"
          disabled={drawings.length === 0}
          style={{
            padding: '5px 8px',
            borderRadius: 6,
            border: '1px solid rgba(38,166,154,0.3)',
            background: drawings.length > 0 ? 'rgba(38,166,154,0.1)' : 'rgba(75,85,99,0.1)',
            color: drawings.length > 0 ? '#26A69A' : '#4B5563',
            cursor: drawings.length > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.65rem',
            fontWeight: 600,
          }}
        >
          <Download size={11} />
          <span>Export</span>
        </button>

        <label
          title="Import Drawings"
          style={{
            padding: '5px 8px',
            borderRadius: 6,
            border: '1px solid rgba(59,130,246,0.3)',
            background: 'rgba(59,130,246,0.1)',
            color: '#60A5FA',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.65rem',
            fontWeight: 600,
          }}
        >
          <Upload size={11} />
          <span>Import</span>
          <input
            type="file"
            accept=".json"
            onChange={importDrawings}
            style={{ display: 'none' }}
          />
        </label>

        <button
          onClick={() => saveDrawings(drawings)}
          title="Save Drawings"
          style={{
            padding: '5px 8px',
            borderRadius: 6,
            border: '1px solid rgba(168,85,247,0.3)',
            background: 'rgba(168,85,247,0.1)',
            color: '#C084FC',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.65rem',
            fontWeight: 600,
          }}
        >
          <Save size={11} />
          <span>Save</span>
        </button>
      </div>

      {/* Drawing List */}
      {drawings.length > 0 && (
        <div style={{ 
          maxHeight: 120, 
          overflowY: 'auto', 
          borderTop: '1px solid rgba(255,255,255,0.05)', 
          paddingTop: 8 
        }}>
          <div style={{ fontSize: '0.62rem', color: '#6B7280', marginBottom: 4 }}>
            Saved Drawings ({drawings.length})
          </div>
          {drawings.slice(-5).map((d, idx) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 6px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.02)',
                marginBottom: 2,
                fontSize: '0.62rem',
              }}
            >
              <span style={{ color: '#9CA3AF' }}>
                {idx + 1}. {d.tool}
              </span>
              <button
                onClick={() => deleteDrawing(d.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF5350',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Status Indicator */}
      {activeTool && (
        <div style={{
          padding: '6px 8px',
          borderRadius: 6,
          background: 'rgba(168,85,247,0.1)',
          border: '1px solid rgba(168,85,247,0.2)',
          color: '#C084FC',
          fontSize: '0.65rem',
          fontWeight: 600,
          textAlign: 'center',
        }}>
          <MousePointer2 size={11} style={{ display: 'inline', marginRight: 4 }} />
          Click & drag on chart to draw {activeTool}
        </div>
      )}
    </div>
  );
}
