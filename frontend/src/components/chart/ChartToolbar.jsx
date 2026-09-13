import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, BarChart2, Check, ChevronDown, Fullscreen, Maximize2,
  MoreHorizontal, PenTool, RotateCcw, Search, Settings, SlidersHorizontal,
  X, Zap,
} from 'lucide-react';
import { INTERVALS, POPULAR_STOCKS, isCryptoSymbol } from '../../utils/chartHelpers';

const CHART_TYPES = [
  { id: 'candlestick', label: 'Candles' },
  { id: 'hollow', label: 'Hollow Candles' },
  { id: 'bar', label: 'Bars' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'baseline', label: 'Baseline' },
];

const QUICK_INTERVALS = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
];

const DRAWING_TOOLS = ['Cursor', 'Crosshair', 'Trend Line', 'Horizontal Line', 'Vertical Line', 'Ray', 'Rectangle', 'Circle', 'Arrow', 'Brush', 'Text', 'Fibonacci', 'Parallel Channel', 'Measure'];

function Menu({ children, align = 'left' }) {
  return <div style={{ position: 'absolute', top: 'calc(100% + 7px)', [align]: 0, minWidth: 190, padding: 6, border: '1px solid rgba(148,163,184,0.18)', borderRadius: 8, background: '#111827', boxShadow: '0 18px 40px rgba(0,0,0,0.45)', zIndex: 120 }}>{children}</div>;
}

function MenuItem({ children, active = false, onClick = () => {}, icon = null }) {
  return <button type="button" onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', border: 0, borderRadius: 5, background: active ? 'rgba(56,189,248,0.12)' : 'transparent', color: active ? '#7DD3FC' : '#CBD5E1', cursor: 'pointer', fontSize: 12, textAlign: 'left' }} onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(148,163,184,0.08)'; }} onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>{icon}{children}{active && <Check size={13} style={{ marginLeft: 'auto' }} />}</button>;
}

function Group({ children }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingRight: 10, marginRight: 5, borderRight: '1px solid rgba(148,163,184,0.14)' }}>{children}</div>;
}

export default function ChartToolbar({
  selectedSymbol = 'RELIANCE', onSelectSymbol = () => {}, interval = '1d', onIntervalChange = () => {},
  onResetZoom = () => {}, isFullscreen = false, onToggleFullscreen = () => {}, searchStocks = null,
  activeIndicatorCount = 0, onOpenIndicators = () => {}, livePrice = null, isLive = false,
  wsConnected = false, chartType = 'candlestick', onChartTypeChange = () => {}, priceScaleMode = 'normal',
  onPriceScaleModeChange = () => {}, showDrawingTools = true, onToggleDrawingTools = () => {}, onOpenSettings = () => {},
  showVolume = true, onToggleVolume = () => {}, isMobile = false, isTablet = false,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const close = event => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpenMenu(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || !searchStocks) { setSearchResults([]); setIsSearching(false); return undefined; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await searchStocks(searchQuery.trim());
        setSearchResults(Array.isArray(result) ? result.slice(0, 12) : []);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, searchStocks]);

  const chooseSymbol = ticker => { onSelectSymbol(ticker); setSearchQuery(''); setOpenMenu(null); };
  const symbolLabel = selectedSymbol === 'BTC' ? 'BTC / USD' : selectedSymbol;
  const exchange = isCryptoSymbol(selectedSymbol) ? 'CRYPTO' : 'NSE';
  const liveState = isLive ? 'LIVE' : (wsConnected ? 'RECONNECTING' : 'OFFLINE');
  const liveColor = isLive ? '#34D399' : (wsConnected ? '#FBBF24' : '#94A3B8');
  const formatPrice = value => value == null || Number.isNaN(Number(value)) ? '—' : `${isCryptoSymbol(selectedSymbol) ? '$' : '₹'}${Number(value).toLocaleString(isCryptoSymbol(selectedSymbol) ? 'en-US' : 'en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const availableSymbols = searchResults.length ? searchResults : POPULAR_STOCKS.map(ticker => ({ ticker }));

  return <div ref={rootRef} style={{ flexShrink: 0, position: 'relative', zIndex: 40, display: 'flex', flexDirection: 'column', gap: 5, padding: isMobile ? '6px' : '7px 10px', background: '#0B0F1C', border: '1px solid rgba(148,163,184,0.14)', borderRadius: 7, color: '#CBD5E1', fontFamily: 'Inter, ui-sans-serif, sans-serif' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, marginRight: 4 }}><Zap size={15} color="#38BDF8" />{!isMobile && <strong style={{ color: '#F8FAFC', fontSize: 13, whiteSpace: 'nowrap' }}>StockOracle Pro</strong>}</div>
      <div style={{ position: 'relative', flex: isMobile ? 1 : '0 1 240px', minWidth: 125 }}>
        <button type="button" onClick={() => setOpenMenu(openMenu === 'symbol' ? null : 'symbol')} title="Search symbols" style={{ width: '100%', height: 31, display: 'flex', alignItems: 'center', gap: 7, padding: '0 9px', border: '1px solid rgba(56,189,248,0.28)', borderRadius: 5, background: 'rgba(56,189,248,0.07)', color: '#F8FAFC', cursor: 'pointer', textAlign: 'left' }}><Search size={14} color="#7DD3FC" /><span style={{ fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{symbolLabel}</span><span style={{ marginLeft: 'auto', fontSize: 10, color: '#64748B' }}>{exchange}</span><ChevronDown size={13} color="#64748B" /></button>
        {openMenu === 'symbol' && <Menu><div style={{ position: 'relative', marginBottom: 5 }}><Search size={13} color="#64748B" style={{ position: 'absolute', left: 9, top: 9 }} /><input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && searchResults[0]) chooseSymbol(searchResults[0].ticker); if (e.key === 'Escape') setOpenMenu(null); }} placeholder="Search symbols..." style={{ width: '100%', boxSizing: 'border-box', height: 30, padding: '0 25px 0 28px', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 5, outline: 0, background: '#0B1220', color: '#E2E8F0', fontSize: 12 }} />{searchQuery && <X size={12} onClick={() => setSearchQuery('')} color="#64748B" style={{ position: 'absolute', right: 8, top: 9, cursor: 'pointer' }} />}</div>{isSearching && <div style={{ padding: '7px 9px', color: '#64748B', fontSize: 11 }}>Searching...</div>}{availableSymbols.slice(0, 8).map(item => <MenuItem key={item.ticker} active={item.ticker === selectedSymbol} onClick={() => chooseSymbol(item.ticker)}><span style={{ fontWeight: 700, minWidth: 76 }}>{item.ticker === 'BTC' ? 'BTC / USD' : item.ticker}</span><span style={{ color: '#64748B', fontSize: 10, marginLeft: 'auto' }}>{item.ticker === 'BTC' ? 'CRYPTO' : 'NSE'}</span></MenuItem>)}</Menu>}
      </div>
      {!isMobile && <div style={{ color: '#64748B', fontSize: 11 }}>{symbolLabel} · {interval.toUpperCase()}</div>}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}><div title={`${liveState} market feed`} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 7px', height: 27, borderRadius: 5, background: `${liveColor}12`, color: liveColor, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: liveColor }} />{liveState}{!isTablet && <span style={{ color: '#E2E8F0', fontSize: 11 }}>{formatPrice(livePrice)}</span>}</div>{!isMobile && <button type="button" onClick={onResetZoom} title="Focus latest candles" aria-label="Focus latest candles" style={{ ...iconButton, display: isTablet ? 'none' : 'flex' }}><RotateCcw size={14} /></button>}<button type="button" onClick={onOpenSettings} title="Chart settings" aria-label="Chart settings" style={iconButton}><Settings size={15} /></button><button type="button" onClick={onToggleFullscreen} title="Fullscreen" aria-label="Fullscreen" style={iconButton}>{isFullscreen ? <Maximize2 size={15} /> : <Fullscreen size={15} />}</button></div>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minHeight: 32, overflow: 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
      {!isMobile && <span style={sectionLabel}>CHART</span>}
      <Group><div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>{QUICK_INTERVALS.map(item => <button key={item.value} type="button" onClick={() => onIntervalChange(item.value)} style={{ ...chipButton, background: interval === item.value ? 'rgba(56,189,248,0.16)' : 'transparent', color: interval === item.value ? '#7DD3FC' : '#94A3B8' }}>{item.label}</button>)}</div><div style={{ position: 'relative' }}><button type="button" onClick={() => setOpenMenu(openMenu === 'timeframe' ? null : 'timeframe')} title="More timeframes" style={compactButton}><MoreHorizontal size={14} /></button>{openMenu === 'timeframe' && <Menu>{INTERVALS.map(item => <MenuItem key={item.value} active={interval === item.value} onClick={() => { onIntervalChange(item.value); setOpenMenu(null); }}>{item.label}</MenuItem>)}</Menu>}</div></Group>
      <Group><div style={{ position: 'relative' }}><button type="button" onClick={() => setOpenMenu(openMenu === 'type' ? null : 'type')} title="Chart type" style={compactButton}><BarChart2 size={14} />{!isMobile && <span>{CHART_TYPES.find(item => item.id === chartType)?.label || 'Candles'}</span>}<ChevronDown size={12} /></button>{openMenu === 'type' && <Menu>{CHART_TYPES.map(item => <MenuItem key={item.id} active={chartType === item.id} onClick={() => { onChartTypeChange(item.id); setOpenMenu(null); }}>{item.label}</MenuItem>)}</Menu>}</div></Group>
      {!isMobile && <Group><button type="button" onClick={onOpenIndicators} title="Technical indicators" style={{ ...compactButton, color: activeIndicatorCount ? '#7DD3FC' : '#CBD5E1', background: activeIndicatorCount ? 'rgba(56,189,248,0.12)' : 'transparent' }}><Activity size={14} />Indicators{activeIndicatorCount > 0 && <span style={countBadge}>{activeIndicatorCount}</span>}</button></Group>}
      <Group><div style={{ position: 'relative' }}><button type="button" onClick={() => setOpenMenu(openMenu === 'draw' ? null : 'draw')} title="Drawing tools" style={{ ...compactButton, color: showDrawingTools ? '#7DD3FC' : '#CBD5E1' }}><PenTool size={14} />{!isMobile && 'Draw'}<ChevronDown size={12} /></button>{openMenu === 'draw' && <Menu>{DRAWING_TOOLS.map(tool => <MenuItem key={tool} onClick={() => { onToggleDrawingTools(); setOpenMenu(null); }}>{tool}</MenuItem>)}</Menu>}</div></Group>
      <Group><span style={sectionLabel}>SCALE</span>{['normal', 'log', 'percentage'].map(mode => <button key={mode} type="button" onClick={() => onPriceScaleModeChange(mode)} title={`${mode === 'normal' ? 'Auto' : mode === 'percentage' ? 'Percentage' : 'Logarithmic'} scale`} style={{ ...chipButton, background: priceScaleMode === mode ? 'rgba(56,189,248,0.16)' : 'transparent', color: priceScaleMode === mode ? '#7DD3FC' : '#94A3B8' }}>{mode === 'normal' ? 'Auto' : mode === 'percentage' ? '%' : 'Log'}</button>)}</Group>
      <button type="button" onClick={onToggleVolume} title={showVolume ? 'Hide volume panel' : 'Show volume panel'} aria-label={showVolume ? 'Hide volume panel' : 'Show volume panel'} style={{ ...compactButton, color: showVolume ? '#7DD3FC' : '#94A3B8', background: showVolume ? 'rgba(56,189,248,0.12)' : 'transparent' }}><BarChart2 size={14} />{!isMobile && 'Volume'}</button>
      {isMobile && <button type="button" onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')} title="More chart controls" aria-label="More chart controls" style={{ ...iconButton, marginLeft: 'auto' }}><SlidersHorizontal size={15} /></button>}
      {openMenu === 'more' && <Menu align="right"><MenuItem onClick={onOpenIndicators} icon={<Activity size={14} />}>Indicators {activeIndicatorCount > 0 && `(${activeIndicatorCount})`}</MenuItem><MenuItem onClick={onOpenSettings} icon={<Settings size={14} />}>Chart Settings</MenuItem><MenuItem onClick={onResetZoom} icon={<RotateCcw size={14} />}>Focus latest candles</MenuItem></Menu>}
    </div>
  </div>;
}

const iconButton = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, padding: 0, border: '1px solid rgba(148,163,184,0.14)', borderRadius: 5, background: 'transparent', color: '#94A3B8', cursor: 'pointer' };
const compactButton = { display: 'flex', alignItems: 'center', gap: 5, height: 29, padding: '0 8px', border: 0, borderRadius: 5, background: 'transparent', color: '#CBD5E1', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' };
const chipButton = { height: 27, padding: '0 7px', border: 0, borderRadius: 4, color: '#94A3B8', cursor: 'pointer', fontSize: 11, fontWeight: 700 };
const sectionLabel = { color: '#475569', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em' };
const countBadge = { minWidth: 15, padding: '1px 4px', borderRadius: 8, background: '#0EA5E9', color: '#082F49', fontSize: 9, textAlign: 'center' };
