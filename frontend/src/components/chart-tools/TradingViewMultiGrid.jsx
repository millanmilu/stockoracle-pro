import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import TradingViewAdvancedChart from './TradingViewAdvancedChart';
import { Square, Columns, Rows, Grid2X2, Zap, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const DEFAULT_TV_PANES = [
  { id: 0, interval: '1d',  label: 'Daily (1D)' },
  { id: 1, interval: '15m', label: 'Intraday (15m)' },
  { id: 2, interval: '1h',  label: 'Hourly (1H)' },
  { id: 3, interval: '5m',  label: 'Micro (5m)' },
];

export default function TradingViewMultiGrid({
  layout = '1x1',
  onLayoutChange,
  activeInterval = '1d',
  onIntervalChange,
}) {
  const selectedSymbol = useStore(s => s.selectedSymbol) || 'RELIANCE';
  const [panes, setPanes] = useState(DEFAULT_TV_PANES);

  // Sync pane 0 with global interval if in 1x1
  useEffect(() => {
    if (layout === '1x1' && activeInterval) {
      setPanes(prev => prev.map((p, i) => i === 0 ? { ...p, interval: activeInterval } : p));
    }
  }, [activeInterval, layout]);

  const handlePaneIntervalChange = (paneId, newInterval) => {
    setPanes(prev => prev.map(p => p.id === paneId ? { ...p, interval: newInterval } : p));
    if (paneId === 0 && onIntervalChange) {
      onIntervalChange(newInterval);
    }
  };

  // MTF Preset Handlers
  const applyPreset = (presetType) => {
    if (presetType === 'intraday') {
      onLayoutChange('1x2');
      setPanes([
        { id: 0, interval: '15m', label: 'Anchor (15m)' },
        { id: 1, interval: '5m',  label: 'Trigger (5m)' },
        { id: 2, interval: '1h',  label: 'Context (1H)' },
        { id: 3, interval: '1m',  label: 'Scalp (1m)' },
      ]);
      toast.success('⚡ Loaded MTF Intraday Setup (15m + 5m)');
    } else if (presetType === 'swing') {
      onLayoutChange('1x2');
      setPanes([
        { id: 0, interval: '1d',  label: 'Trend (1D)' },
        { id: 1, interval: '1h',  label: 'Entry (1H)' },
        { id: 2, interval: '1w',  label: 'Macro (1W)' },
        { id: 3, interval: '15m', label: 'Execution (15m)' },
      ]);
      toast.success('📈 Loaded MTF Swing Setup (1D + 1H)');
    } else if (presetType === 'matrix') {
      onLayoutChange('2x2');
      setPanes([
        { id: 0, interval: '1d',  label: 'Macro Trend (1D)' },
        { id: 1, interval: '1h',  label: 'Structure (1H)' },
        { id: 2, interval: '15m', label: 'Setup (15m)' },
        { id: 3, interval: '5m',  label: 'Execution (5m)' },
      ]);
      toast.success('🎯 Loaded MTF 4-Timeframe Matrix (1D + 1H + 15m + 5m)');
    }
  };

  // Determine grid template
  const getGridStyle = () => {
    switch (layout) {
      case '1x2':
        return {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr',
          gap: 6,
          height: '100%',
          width: '100%',
        };
      case '2x1':
        return {
          display: 'grid',
          gridTemplateColumns: '1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 6,
          height: '100%',
          width: '100%',
        };
      case '2x2':
        return {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 6,
          height: '100%',
          width: '100%',
        };
      case '1x1':
      default:
        return {
          display: 'grid',
          gridTemplateColumns: '1fr',
          gridTemplateRows: '1fr',
          gap: 0,
          height: '100%',
          width: '100%',
        };
    }
  };

  // Determine active visible panes
  let visiblePanes = [panes[0]];
  if (layout === '1x2' || layout === '2x1') {
    visiblePanes = [panes[0], panes[1]];
  } else if (layout === '2x2') {
    visiblePanes = panes.slice(0, 4);
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: '#070A14',
      position: 'relative',
    }}>
      {/* ── MTF Presets & Grid Toolbar ── */}
      <div style={{
        height: 32,
        flexShrink: 0,
        backgroundColor: '#090C18',
        borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        userSelect: 'none',
        zIndex: 30,
      }}>
        {/* Left: MTF Mode Tag & One-Click Setup Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: '0.68rem', fontWeight: 800, color: '#818CF8',
            background: 'rgba(99, 102, 241, 0.15)', padding: '2px 7px', borderRadius: 4,
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}>
            <Sparkles size={12} color="#818CF8" />
            <span>TV MULTI-TIMEFRAME</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              PRESETS:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('intraday')}
              style={{
                padding: '2px 7px', borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.04)', color: '#CBD5E1',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer',
              }}
              title="Split 1x2 into 15m (Anchor) + 5m (Trigger)"
            >
              ⚡ Intraday (15m + 5m)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('swing')}
              style={{
                padding: '2px 7px', borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.04)', color: '#CBD5E1',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer',
              }}
              title="Split 1x2 into 1D (Daily Trend) + 1H (Swing Setup)"
            >
              📈 Swing (1D + 1H)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('matrix')}
              style={{
                padding: '2px 7px', borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.04)', color: '#CBD5E1',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer',
              }}
              title="Quad 2x2 Matrix: 1D + 1H + 15m + 5m"
            >
              🎯 Quad MTF (1D + 1H + 15m + 5m)
            </button>
          </div>
        </div>

        {/* Right: Layout Switcher Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 700 }}>Grid:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.04)', padding: 2, borderRadius: 5, border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              type="button"
              onClick={() => onLayoutChange('1x1')}
              title="Single Chart (1x1)"
              style={{
                padding: '2px 6px', borderRadius: 3, border: 'none',
                background: layout === '1x1' ? '#6366F1' : 'transparent',
                color: layout === '1x1' ? '#fff' : '#64748B',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <Square size={12} />
            </button>
            <button
              type="button"
              onClick={() => onLayoutChange('1x2')}
              title="Side-by-Side Dual Chart (1x2)"
              style={{
                padding: '2px 6px', borderRadius: 3, border: 'none',
                background: layout === '1x2' ? '#6366F1' : 'transparent',
                color: layout === '1x2' ? '#fff' : '#64748B',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <Columns size={12} />
            </button>
            <button
              type="button"
              onClick={() => onLayoutChange('2x1')}
              title="Stacked Dual Chart (2x1)"
              style={{
                padding: '2px 6px', borderRadius: 3, border: 'none',
                background: layout === '2x1' ? '#6366F1' : 'transparent',
                color: layout === '2x1' ? '#fff' : '#64748B',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <Rows size={12} />
            </button>
            <button
              type="button"
              onClick={() => onLayoutChange('2x2')}
              title="Quad Matrix Grid (2x2)"
              style={{
                padding: '2px 6px', borderRadius: 3, border: 'none',
                background: layout === '2x2' ? '#6366F1' : 'transparent',
                color: layout === '2x2' ? '#fff' : '#64748B',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <Grid2X2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Grid Panes Canvas ── */}
      <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', overflow: 'hidden' }}>
        <div style={getGridStyle()}>
          {visiblePanes.map((pane) => (
            <div
              key={pane.id}
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                borderRadius: layout === '1x1' ? 0 : 6,
                border: layout === '1x1' ? 'none' : '1px solid rgba(99, 102, 241, 0.25)',
              }}
            >
              <TradingViewAdvancedChart
                symbol={selectedSymbol}
                interval={pane.interval}
                paneLabel={layout !== '1x1' ? pane.label : undefined}
                onIntervalChange={(newIv) => handlePaneIntervalChange(pane.id, newIv)}
                showTimeframeBar={true}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
