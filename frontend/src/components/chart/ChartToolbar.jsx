import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, BarChart2, Check, ChevronDown, ChevronRight, Fullscreen, Maximize2,
  PenTool, RotateCcw, Settings, SlidersHorizontal, Zap,
} from 'lucide-react';
import { DRAWING_TOOL_GROUPS, getToolSpec } from '../chart-tools/drawingToolCatalog';
import SymbolSearchModal from '../chart-tools/SymbolSearchModal';
import { isGoldSymbol, isCryptoSymbol } from '../../utils/chartHelpers';
import api from '../../utils/api';
import useStore from '../../store/useStore';
import { getThemeTokens } from '../../utils/theme';

const CHART_TYPES = [
  { id: 'candlestick', label: 'Candles' },
  { id: 'hollow', label: 'Hollow Candles' },
  { id: 'bar', label: 'Bars' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'baseline', label: 'Baseline' },
];

const TIMEFRAME_OPTIONS = [
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '2H', value: '2h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1M' },
];

const drawGroupHeader = { padding: '6px 9px 3px', color: '#475569', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em' };

function Menu({ children, align = 'left', style }) {
  return <div style={{ position: 'absolute', top: 'calc(100% + 7px)', [align]: 0, minWidth: 190, padding: 6, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', boxShadow: 'var(--shadow)', zIndex: 120, ...(style || {}) }}>{children}</div>;
}

function MenuItem({ children, active = false, onClick = () => {}, icon = null }) {
  return <button type="button" onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', border: 0, borderRadius: 5, background: active ? 'rgba(56,189,248,0.12)' : 'transparent', color: active ? '#0284C7' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, textAlign: 'left' }} onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(148,163,184,0.12)'; }} onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>{icon}{children}{active && <Check size={13} style={{ marginLeft: 'auto' }} />}</button>;
}

function Group({ children }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingRight: 10, marginRight: 5, borderRight: '1px solid var(--border)' }}>{children}</div>;
}

export default function ChartToolbar({
  selectedSymbol = 'RELIANCE', onSelectSymbol = () => {},
  interval = '1d', onIntervalChange = () => {},
  onResetZoom = () => {}, isFullscreen = false, onToggleFullscreen = () => {},
  activeIndicatorCount = 0, onOpenIndicators = () => {}, livePrice = null, isLive = false,
  wsConnected = false, chartType = 'candlestick', onChartTypeChange = () => {}, priceScaleMode = 'normal',
  onPriceScaleModeChange = () => {}, showDrawingTools = true, onToggleDrawingTools = () => {}, onOpenSettings = () => {},
  activeDrawingTool = 'crosshair', onSelectDrawingTool = () => {},
  showVolume = true, onToggleVolume = () => {}, isMobile = false, isTablet = false,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [openDrawGroup, setOpenDrawGroup] = useState(null);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const rootRef = useRef(null);

  // Debounced symbol search
  useEffect(() => {
    if (symbolFilter.trim().length > 0) {
      setIsSearching(true);
      const timer = setTimeout(async () => {
        try {
          const { data } = await api.get('/api/stocks/search', { params: { query: symbolFilter.trim() } });
          setSearchResults(Array.isArray(data) ? data : (data.results || []));
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [symbolFilter]);

  useEffect(() => {
    const close = event => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpenMenu(null); };
    const onKey = event => { if (event.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Opening the Draw menu expands the active tool's group; leaving it resets.
  useEffect(() => {
    if (openMenu === 'draw') {
      setOpenDrawGroup(getToolSpec(activeDrawingTool)?.group || null);
    } else {
      setOpenDrawGroup(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMenu]);

  const theme = useStore(s => s.theme);
  const tk = getThemeTokens(theme);
  const isCrypto = isCryptoSymbol(selectedSymbol);
  const isGold = isGoldSymbol(selectedSymbol);
  const isBtc = !isGold && isCrypto;
  const currSym = isCrypto ? '$' : '₹';
  const liveState = isLive ? 'LIVE' : (wsConnected ? 'RECONNECTING' : 'OFFLINE');
  const liveColor = isLive ? '#059669' : (wsConnected ? '#D97706' : tk.toolbarMuted);
  const formatPrice = value => value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toLocaleString(isCrypto ? 'en-US' : 'en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const drawToolLabel = getToolSpec(activeDrawingTool)?.label || 'Draw';

  return <div ref={rootRef} style={{ flexShrink: 0, position: 'relative', zIndex: 70, display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 5, height: 36, minHeight: 36, padding: isMobile ? '0 6px' : '0 8px', overflow: 'visible', background: tk.toolbarBg, border: `1px solid ${tk.toolbarBorder}`, borderRadius: 7, color: tk.toolbarText, fontFamily: 'Inter, ui-sans-serif, sans-serif' }}>
    <div style={{ display: 'contents' }}>
      {/* Symbol Search Picker Button */}
      <div style={{ position: 'relative', marginRight: 2 }}>
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'symbol' ? null : 'symbol')}
          title="Search or switch symbol (XAUUSD, BTC, stocks)"
          style={{
            ...compactButton,
            color: isGold ? '#FACC15' : (isBtc ? '#F59E0B' : tk.toolbarActive),
            fontWeight: 800,
            background: isGold ? 'rgba(250,204,21,0.14)' : (isBtc ? 'rgba(245,158,11,0.14)' : 'rgba(56,189,248,0.12)'),
            border: `1px solid ${isGold ? 'rgba(250,204,21,0.35)' : (isBtc ? 'rgba(245,158,11,0.35)' : 'rgba(56,189,248,0.25)')}`,
            padding: '3px 8px',
            borderRadius: 6,
            gap: 6,
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          <span>{isGold ? '🥇' : (isBtc ? '₿' : <Zap size={13} color="#38BDF8" />)}</span>
          <span>{selectedSymbol}</span>
          <ChevronDown size={11} style={{ opacity: 0.7 }} />
        </button>

        <SymbolSearchModal
          isOpen={openMenu === 'symbol'}
          onClose={() => setOpenMenu(null)}
          onSelect={(sym) => {
            onSelectSymbol?.(sym);
            setOpenMenu(null);
          }}
          filter={symbolFilter}
          onFilterChange={setSymbolFilter}
          searchResults={searchResults}
          isSearching={isSearching}
          selectedSymbol={selectedSymbol}
        />
      </div>

      <div style={{ order: 3, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}><div title={`${liveState} market feed`} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 7px', height: 27, borderRadius: 5, background: `${liveColor}14`, color: liveColor, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: liveColor }} />{liveState}{!isTablet && <span style={{ color: tk.toolbarText, fontSize: 11 }}>{currSym}{formatPrice(livePrice)}</span>}</div>{!isMobile && <button type="button" onClick={onResetZoom} title="Focus latest candles" aria-label="Focus latest candles" style={{ ...themedIconButton(tk), display: isTablet ? 'none' : 'flex' }}><RotateCcw size={14} /></button>}<button type="button" onClick={onOpenSettings} title="Chart settings" aria-label="Chart settings" style={themedIconButton(tk)}><Settings size={15} /></button><button type="button" onClick={onToggleFullscreen} title="Fullscreen" aria-label="Fullscreen" style={themedIconButton(tk)}>{isFullscreen ? <Maximize2 size={14} /> : <Fullscreen size={14} />}</button></div>
    </div>

    <div style={{ display: 'contents' }}>
      <Group><div style={{ position: 'relative' }}><button type="button" onClick={() => setOpenMenu(openMenu === 'timeframe' ? null : 'timeframe')} title="Timeframe" style={compactButton}>{TIMEFRAME_OPTIONS.find(item => item.value === interval)?.label || interval}<ChevronDown size={12} /></button>{openMenu === 'timeframe' && <Menu>{TIMEFRAME_OPTIONS.map(item => <MenuItem key={item.value} active={interval === item.value} onClick={() => { onIntervalChange(item.value); setOpenMenu(null); }}>{item.label}</MenuItem>)}</Menu>}</div></Group>
      <Group><div style={{ position: 'relative' }}><button type="button" onClick={() => setOpenMenu(openMenu === 'type' ? null : 'type')} title="Chart type" style={compactButton}><BarChart2 size={14} />{!isMobile && <span>{CHART_TYPES.find(item => item.id === chartType)?.label || 'Candles'}</span>}<ChevronDown size={12} /></button>{openMenu === 'type' && <Menu>{CHART_TYPES.map(item => <MenuItem key={item.id} active={chartType === item.id} onClick={() => { onChartTypeChange(item.id); setOpenMenu(null); }}>{item.label}</MenuItem>)}</Menu>}</div></Group>
      {!isMobile && <Group><button type="button" onClick={onOpenIndicators} title="Technical indicators" style={{ ...compactButton, color: activeIndicatorCount ? tk.toolbarActive : tk.toolbarText, background: activeIndicatorCount ? 'rgba(56,189,248,0.14)' : 'transparent', fontWeight: activeIndicatorCount ? 700 : 400 }}><Activity size={14} />Indicators{activeIndicatorCount > 0 && <span style={countBadge}>{activeIndicatorCount}</span>}</button></Group>}
      <Group><div style={{ position: 'relative' }}><button type="button" onClick={() => setOpenMenu(openMenu === 'draw' ? null : 'draw')} title={drawToolLabel} style={{ ...compactButton, color: showDrawingTools ? tk.toolbarActive : tk.toolbarText, fontWeight: showDrawingTools ? 700 : 400 }}><PenTool size={14} />{!isMobile && <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>{drawToolLabel}</span>}<ChevronDown size={12} /></button>{openMenu === 'draw' && <Menu style={{ minWidth: 208 }}><MenuItem active={showDrawingTools} onClick={() => { onToggleDrawingTools(); }}>Drawing rail</MenuItem><div style={{ height: 1, background: 'var(--border)', margin: '4px 2px' }} />{DRAWING_TOOL_GROUPS.map(group => {
        const groupActive = group.tools.some(t => t.id === activeDrawingTool);
        const expanded = openDrawGroup === group.id;
        return (
          <div key={group.id} style={{ position: 'relative' }} onMouseEnter={() => setOpenDrawGroup(group.id)}>
            <button
              type="button"
              onClick={() => setOpenDrawGroup(expanded ? null : group.id)}
              title={`${group.label} tools`}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', border: 0, borderRadius: 5, background: expanded ? 'rgba(56,189,248,0.12)' : 'transparent', color: groupActive ? tk.toolbarActive : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: groupActive ? 700 : 400, textAlign: 'left', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'rgba(148,163,184,0.12)'; }}
              onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ flex: 1 }}>{group.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{group.tools.length}</span>
              <ChevronRight size={13} />
            </button>
            {expanded && (
              <div style={{ position: 'absolute', left: 'calc(100% + 6px)', top: -7, minWidth: 200, maxHeight: 320, overflowY: 'auto', padding: 6, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', boxShadow: 'var(--shadow)', zIndex: 130 }}>
                <div style={drawGroupHeader}>{group.label.toUpperCase()}</div>
                {group.tools.map(tool => <MenuItem key={tool.id} active={activeDrawingTool === tool.id} onClick={() => { onSelectDrawingTool(tool.id); setOpenMenu(null); }}>{tool.label}</MenuItem>)}
              </div>
            )}
          </div>
        );
      })}</Menu>}</div></Group>
      <Group><span style={sectionLabel}>SCALE</span>{['normal', 'log', 'percentage'].map(mode => <button key={mode} type="button" onClick={() => onPriceScaleModeChange(mode)} title={`${mode === 'normal' ? 'Auto' : mode === 'percentage' ? 'Percentage' : 'Logarithmic'} scale`} style={{ ...chipButton, background: priceScaleMode === mode ? 'rgba(2,132,199,0.14)' : 'transparent', color: priceScaleMode === mode ? tk.toolbarActive : tk.toolbarMuted, fontWeight: 700 }}>{mode === 'normal' ? 'Auto' : mode === 'percentage' ? '%' : 'Log'}</button>)}</Group>
      <button type="button" onClick={onToggleVolume} title={showVolume ? 'Hide volume panel' : 'Show volume panel'} aria-label={showVolume ? 'Hide volume panel' : 'Show volume panel'} style={{ ...compactButton, color: showVolume ? tk.toolbarActive : tk.toolbarMuted, background: showVolume ? 'rgba(56,189,248,0.14)' : 'transparent', fontWeight: showVolume ? 700 : 400 }}><BarChart2 size={14} />{!isMobile && 'Volume'}</button>
      {isMobile && <button type="button" onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')} title="More chart controls" aria-label="More chart controls" style={{ ...themedIconButton(tk), marginLeft: 'auto' }}><SlidersHorizontal size={15} /></button>}
      {openMenu === 'more' && <Menu align="right"><MenuItem onClick={onOpenIndicators} icon={<Activity size={14} />}>Indicators {activeIndicatorCount > 0 && `(${activeIndicatorCount})`}</MenuItem><MenuItem onClick={onOpenSettings} icon={<Settings size={14} />}>Chart Settings</MenuItem><MenuItem onClick={onResetZoom} icon={<RotateCcw size={14} />}>Focus latest candles</MenuItem></Menu>}
    </div>
  </div>;
}

const themedIconButton = (tk) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, padding: 0, border: `1px solid ${tk?.toolbarBorder || 'rgba(148,163,184,0.14)'}`, borderRadius: 5, background: 'transparent', color: tk?.toolbarMuted || '#94A3B8', cursor: 'pointer' });
const iconButton = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, padding: 0, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' };
const compactButton = { display: 'flex', alignItems: 'center', gap: 5, height: 29, padding: '0 8px', border: 0, borderRadius: 5, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' };
const chipButton = { height: 27, padding: '0 7px', border: 0, borderRadius: 4, color: 'var(--text-muted)', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700 };
const sectionLabel = { color: 'var(--text-muted)', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em' };
const countBadge = { minWidth: 15, padding: '1px 4px', borderRadius: 8, background: '#0EA5E9', color: '#082F49', fontSize: 9, textAlign: 'center' };
