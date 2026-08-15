import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import ChartPane from './ChartPane';
import { Square, Columns, Rows, Grid2X2 } from 'lucide-react';

const STORAGE_KEY = 'stockoracle_grid_layout_v1';

const DEFAULT_PANES = [
  { id: 0, symbol: 'RELIANCE', interval: '1d' },
  { id: 1, symbol: 'TCS',      interval: '1d' },
  { id: 2, symbol: 'HDFCBANK', interval: '1d' },
  { id: 3, symbol: 'INFY',     interval: '1d' },
];

export default function MultiChartGrid() {
  const { selectedSymbol, setSelectedSymbol } = useStore();
  const [layout, setLayout] = useState('1x1'); // '1x1' | '1x2' | '2x1' | '2x2'
  const [activePaneId, setActivePaneId] = useState(0);
  const [maximizedPaneId, setMaximizedPaneId] = useState(null);
  const [panes, setPanes] = useState(DEFAULT_PANES);

  // Load saved grid state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.layout) setLayout(parsed.layout);
        if (Array.isArray(parsed.panes) && parsed.panes.length >= 4) {
          setPanes(parsed.panes);
        }
      }
    } catch (_) {}
  }, []);

  // Save grid state on change
  const persistState = (newLayout, newPanes) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ layout: newLayout, panes: newPanes }));
    } catch (_) {}
  };

  // Sync global selectedSymbol with the active pane
  useEffect(() => {
    if (selectedSymbol) {
      setPanes((prev) => {
        const next = prev.map((p) => (p.id === activePaneId ? { ...p, symbol: selectedSymbol } : p));
        persistState(layout, next);
        return next;
      });
    }
  }, [selectedSymbol, activePaneId]);

  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
    setMaximizedPaneId(null);
    persistState(newLayout, panes);
  };

  const handleSelectPane = (paneId) => {
    setActivePaneId(paneId);
    const targetSymbol = panes.find((p) => p.id === paneId)?.symbol;
    if (targetSymbol && targetSymbol !== selectedSymbol) {
      setSelectedSymbol(targetSymbol);
    }
  };

  const handleSymbolChange = (paneId, newSymbol) => {
    const updated = panes.map((p) => (p.id === paneId ? { ...p, symbol: newSymbol.toUpperCase() } : p));
    setPanes(updated);
    if (paneId === activePaneId) {
      setSelectedSymbol(newSymbol.toUpperCase());
    }
    persistState(layout, updated);
  };

  const handleIntervalChange = (paneId, newInterval) => {
    const updated = panes.map((p) => (p.id === paneId ? { ...p, interval: newInterval } : p));
    setPanes(updated);
    persistState(layout, updated);
  };

  const handleToggleMaximize = (paneId) => {
    setMaximizedPaneId(maximizedPaneId === paneId ? null : paneId);
  };

  // Determine how many panes to display
  let visiblePanes = panes.slice(0, 1);
  if (layout === '1x2' || layout === '2x1') {
    visiblePanes = panes.slice(0, 2);
  } else if (layout === '2x2') {
    visiblePanes = panes.slice(0, 4);
  }

  // Grid style computation
  const getGridStyle = () => {
    if (maximizedPaneId !== null) {
      return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr', height: '100%', width: '100%', gap: 8, padding: 8 };
    }
    switch (layout) {
      case '1x2':
        return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr', height: '100%', width: '100%', gap: 8, padding: 8 };
      case '2x1':
        return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr', height: '100%', width: '100%', gap: 8, padding: 8 };
      case '2x2':
        return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: '100%', width: '100%', gap: 8, padding: 8 };
      case '1x1':
      default:
        return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr', height: '100%', width: '100%', gap: 8, padding: 8 };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#04050E' }}>
      {/* ── Multi-Chart Layout Bar ── */}
      <div style={{
        height: 36,
        backgroundColor: '#090C18',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        userSelect: 'none',
        zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Chart Grid Layout
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0C1022', padding: 2, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => handleLayoutChange('1x1')}
              title="Single Chart (1x1)"
              style={{
                background: layout === '1x1' && maximizedPaneId === null ? '#6366F1' : 'transparent',
                color: layout === '1x1' && maximizedPaneId === null ? '#FFFFFF' : '#9CA3AF',
                border: 'none',
                borderRadius: 4,
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <Square size={13} />
              1x1
            </button>

            <button
              onClick={() => handleLayoutChange('1x2')}
              title="Side-by-Side (1x2)"
              style={{
                background: layout === '1x2' && maximizedPaneId === null ? '#6366F1' : 'transparent',
                color: layout === '1x2' && maximizedPaneId === null ? '#FFFFFF' : '#9CA3AF',
                border: 'none',
                borderRadius: 4,
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <Columns size={13} />
              1x2
            </button>

            <button
              onClick={() => handleLayoutChange('2x1')}
              title="Stacked (2x1)"
              style={{
                background: layout === '2x1' && maximizedPaneId === null ? '#6366F1' : 'transparent',
                color: layout === '2x1' && maximizedPaneId === null ? '#FFFFFF' : '#9CA3AF',
                border: 'none',
                borderRadius: 4,
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <Rows size={13} />
              2x1
            </button>

            <button
              onClick={() => handleLayoutChange('2x2')}
              title="Quad Grid (2x2)"
              style={{
                background: layout === '2x2' && maximizedPaneId === null ? '#6366F1' : 'transparent',
                color: layout === '2x2' && maximizedPaneId === null ? '#FFFFFF' : '#9CA3AF',
                border: 'none',
                borderRadius: 4,
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <Grid2X2 size={13} />
              2x2
            </button>
          </div>
        </div>

        <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>
          Active Pane: <span style={{ color: '#6366F1', fontWeight: 700 }}>Pane #{activePaneId + 1} ({panes[activePaneId]?.symbol})</span>
        </div>
      </div>

      {/* ── Grid Canvas ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div style={getGridStyle()}>
          {maximizedPaneId !== null ? (
            <ChartPane
              key={maximizedPaneId}
              paneId={maximizedPaneId}
              symbol={panes[maximizedPaneId]?.symbol || 'RELIANCE'}
              interval={panes[maximizedPaneId]?.interval || '1d'}
              isActive={true}
              isMaximized={true}
              onSelectPane={handleSelectPane}
              onSymbolChange={handleSymbolChange}
              onIntervalChange={handleIntervalChange}
              onToggleMaximize={handleToggleMaximize}
            />
          ) : (
            visiblePanes.map((pane) => (
              <ChartPane
                key={pane.id}
                paneId={pane.id}
                symbol={pane.symbol}
                interval={pane.interval}
                isActive={pane.id === activePaneId}
                isMaximized={false}
                onSelectPane={handleSelectPane}
                onSymbolChange={handleSymbolChange}
                onIntervalChange={handleIntervalChange}
                onToggleMaximize={handleToggleMaximize}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
