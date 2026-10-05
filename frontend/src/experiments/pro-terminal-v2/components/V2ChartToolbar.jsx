// Pro Terminal V2 — Chart Toolbar

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, Undo2, Redo2, Save, Settings, Camera, Maximize, Minimize,
  Zap, RotateCcw, Check,
} from 'lucide-react';
import { V2_COLORS, V2_INTERVALS, V2_CHART_TYPES, V2_TEMPLATES } from '../utils/constants';

export default function V2ChartToolbar({
  symbol,
  interval,
  chartType,
  exchange = 'NSE',
  isFullscreen = false,
  canUndo = false,
  canRedo = false,
  symbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'WIPRO', 'HCLTECH'],
  onSymbolChange,
  onIntervalChange,
  onChartTypeChange,
  onExchangeChange,
  onToggleIndicators,
  onToggleAI,
  onToggleSettings,
  onToggleFullscreen,
  onUndo,
  onRedo,
  onSave,
  onScreenshot,
  onResetView,
  onTemplateChange,
  onTrade,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const rootRef = useRef(null);
  const flashTimerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(flashTimerRef.current);
    };
  }, []);

  const toggleMenu = (menu) => setOpenMenu(openMenu === menu ? null : menu);

  const handleSave = () => {
    if (onSave?.()) {
      setSavedFlash(true);
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setSavedFlash(false), 1500);
    }
  };

  return (
    <div ref={rootRef} className="v2-chart-toolbar" style={{
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
        {symbols.map((s) => (
          <DropdownItem key={s} label={s} onClick={() => { onSymbolChange(s); setOpenMenu(null); }} />
        ))}
      </DropdownButton>

      {/* Exchange */}
      <DropdownButton label={exchange} open={openMenu === 'exchange'} onToggle={() => toggleMenu('exchange')}>
        {['NSE', 'BSE'].map((ex) => (
          <DropdownItem key={ex} label={ex} onClick={() => { onExchangeChange?.(ex); setOpenMenu(null); }} />
        ))}
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
        {V2_TEMPLATES.map((t) => (
          <DropdownItem
            key={t.id}
            label={t.id}
            onClick={() => { onTemplateChange?.(t.id); setOpenMenu(null); }}
          />
        ))}
      </DropdownButton>

      {/* Right section */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton icon={<Undo2 size={13} />} title="Undo drawing (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} />
        <IconButton icon={<Redo2 size={13} />} title="Redo drawing (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo} />
        <IconButton
          icon={savedFlash ? <Check size={13} color={V2_COLORS.positive} /> : <Save size={13} />}
          title={savedFlash ? 'Saved' : 'Save drawings (Ctrl+S)'}
          onClick={handleSave}
        />
        <IconButton icon={<Settings size={13} />} title="Settings" onClick={onToggleSettings} />
        <IconButton icon={<Camera size={13} />} title="Screenshot chart" onClick={onScreenshot} />
        <IconButton
          icon={isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={onToggleFullscreen}
        />
        <IconButton icon={<RotateCcw size={13} />} title="Reset view" onClick={onResetView} />
        <button
          onClick={() => onTrade?.('BUY')}
          aria-label="Open order ticket"
          style={{
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
          }}
        >
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
        aria-haspopup="menu"
        aria-expanded={open}
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
        <div role="menu" style={{
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
      role="menuitem"
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
      aria-label={label}
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

function IconButton({ icon, title, onClick, disabled = false }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: 5,
        color: V2_COLORS.text.secondary,
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {icon}
    </button>
  );
}
