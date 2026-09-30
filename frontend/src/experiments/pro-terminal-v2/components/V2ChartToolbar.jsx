// Pro Terminal V2 — Chart Toolbar

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Undo2, Redo2, Save, Settings, Camera, Maximize, Zap, RotateCcw } from 'lucide-react';
import { V2_COLORS, V2_INTERVALS, V2_CHART_TYPES } from '../utils/constants';

export default function V2ChartToolbar({
  symbol,
  interval,
  chartType,
  onSymbolChange,
  onIntervalChange,
  onChartTypeChange,
  onToggleIndicators,
  onToggleAI,
  onToggleSettings,
  onToggleFullscreen,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menu) => setOpenMenu(openMenu === menu ? null : menu);

  return (
    <div ref={rootRef} style={{
      display: 'flex',
      alignItems: 'center',
      height: 36,
      padding: '0 8px',
      background: V2_COLORS.bg.secondary,
      borderBottom: `1px solid ${V2_COLORS.bg.border}`,
      gap: 2,
      flexShrink: 0,
      overflowX: 'auto',
      position: 'relative',
    }}>
      {/* Symbol selector */}
      <DropdownButton label={symbol} open={openMenu === 'symbol'} onToggle={() => toggleMenu('symbol')}>
        {['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'WIPRO', 'HCLTECH'].map((s) => (
          <DropdownItem key={s} label={s} onClick={() => { onSymbolChange(s); setOpenMenu(null); }} />
        ))}
      </DropdownButton>

      {/* Exchange */}
      <DropdownButton label="NSE" open={openMenu === 'exchange'} onToggle={() => toggleMenu('exchange')}>
        <DropdownItem label="NSE" onClick={() => setOpenMenu(null)} />
        <DropdownItem label="BSE" onClick={() => setOpenMenu(null)} />
      </DropdownButton>

      {/* Interval */}
      <DropdownButton label={interval} open={openMenu === 'interval'} onToggle={() => toggleMenu('interval')}>
        {V2_INTERVALS.map((iv) => (
          <DropdownItem key={iv.value} label={iv.label} onClick={() => { onIntervalChange(iv.value); setOpenMenu(null); }} />
        ))}
      </DropdownButton>

      {/* Chart type */}
      <DropdownButton
        label={V2_CHART_TYPES.find((c) => c.value === chartType)?.label || 'Candles'}
        open={openMenu === 'chartType'}
        onToggle={() => toggleMenu('chartType')}
      >
        {V2_CHART_TYPES.map((ct) => (
          <DropdownItem key={ct.value} label={ct.label} onClick={() => { onChartTypeChange(ct.value); setOpenMenu(null); }} />
        ))}
      </DropdownButton>

      {/* Indicators */}
      <ToolbarButton icon={<Zap size={13} />} label="Indicators" onClick={onToggleIndicators} />

      {/* AI Indicators */}
      <ToolbarButton icon={<Zap size={13} />} label="AI" onClick={onToggleAI} />

      {/* Templates */}
      <DropdownButton label="Templates" open={openMenu === 'templates'} onToggle={() => toggleMenu('templates')}>
        {['Default', 'Trend Following', 'Momentum', 'Mean Reversion', 'Breakout'].map((t) => (
          <DropdownItem key={t} label={t} onClick={() => setOpenMenu(null)} />
        ))}
      </DropdownButton>

      {/* Right section */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton icon={<Undo2 size={13} />} title="Undo" />
        <IconButton icon={<Redo2 size={13} />} title="Redo" />
        <IconButton icon={<Save size={13} />} title="Save" />
        <IconButton icon={<Settings size={13} />} title="Settings" onClick={onToggleSettings} />
        <IconButton icon={<Camera size={13} />} title="Screenshot" />
        <IconButton icon={<Maximize size={13} />} title="Fullscreen" onClick={onToggleFullscreen} />
        <IconButton icon={<RotateCcw size={13} />} title="Reset View" />
        <button style={{
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 600,
          color: '#fff',
          background: V2_COLORS.accent.primary,
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <Zap size={12} />
          Trade
        </button>
      </div>
    </div>
  );
}

function DropdownButton({ label, open, onToggle, children }) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          fontSize: 11,
          fontWeight: 500,
          color: open ? V2_COLORS.accent.primary : V2_COLORS.text.secondary,
          background: open ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          background: V2_COLORS.bg.elevated,
          border: `1px solid ${V2_COLORS.bg.border}`,
          borderRadius: 6,
          padding: '4px 0',
          minWidth: 120,
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '5px 12px',
        fontSize: 11,
        color: V2_COLORS.text.secondary,
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function ToolbarButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        fontSize: 11,
        color: V2_COLORS.text.secondary,
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function IconButton({ icon, title, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        padding: 5,
        color: V2_COLORS.text.secondary,
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        display: 'flex',
      }}
    >
      {icon}
    </button>
  );
}
