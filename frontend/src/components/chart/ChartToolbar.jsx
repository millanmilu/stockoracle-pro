import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, BarChart2, Bell, Check, ChevronDown, ChevronRight, Fullscreen, History, Maximize2,
  PenTool, RotateCcw, Settings, SlidersHorizontal, Zap, Wallet, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DRAWING_TOOL_GROUPS, getToolSpec } from '../chart-tools/drawingToolCatalog';
import SymbolSearchModal from '../chart-tools/SymbolSearchModal';
import { isGoldSymbol, isCryptoSymbol, isSupportedInterval, resolveTimeframeBuffer } from '../../utils/chartHelpers';
import { loadSmcDisplay, saveSmcDisplay, subscribeSmcDisplay } from '../../utils/smcDisplayPrefs';
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

// Only intervals the backend serves (anything else 422s and blanks the chart
// into a dead empty state). 3m/2h/1w/1M stay hidden until backend + bucket
// math support them.
const TIMEFRAME_OPTIONS = [
  { label: '1m', value: '1m', full: '1 minute', num: '1', unit: 'm' },
  { label: '5m', value: '5m', full: '5 minutes', num: '5', unit: 'm' },
  { label: '15m', value: '15m', full: '15 minutes', num: '15', unit: 'm' },
  { label: '30m', value: '30m', full: '30 minutes', num: '30', unit: 'm' },
  { label: '1H', value: '1h', full: '1 hour', num: '1', unit: 'h' },
  { label: '4H', value: '4h', full: '4 hours', num: '4', unit: 'h' },
  { label: '1D', value: '1d', full: '1 day', num: '1', unit: 'd' },
];

const TF_GROUPS = [
  { id: 'minutes', label: 'Minutes', units: ['m'] },
  { id: 'hours', label: 'Hours', units: ['h'] },
  { id: 'daily', label: 'Daily', units: ['d'] },
];

export { resolveTimeframeBuffer };

export { TIMEFRAME_OPTIONS };
export const isIntervalSupported = isSupportedInterval;

const drawGroupHeader = { padding: '6px 12px 4px', color: '#787B86', fontSize: 11, fontWeight: 400 };

function Menu({ children, align = 'left', style }) {
  const theme = useStore(s => s.theme);
  const tk = getThemeTokens(theme);
  return <div style={{ position: 'absolute', top: 'calc(100% + 4px)', [align]: 0, minWidth: 220, padding: '4px 0', border: `1px solid ${tk.toolbarBorder}`, borderRadius: 4, background: tk.menuBg, boxShadow: '0 4px 16px rgba(0,0,0,0.45)', zIndex: 120, ...(style || {}) }}>{children}</div>;
}

function MenuItem({ children, active = false, onClick = () => {}, icon = null }) {
  const theme = useStore(s => s.theme);
  const tk = getThemeTokens(theme);
  return <button type="button" onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', border: 0, borderRadius: 0, background: active ? tk.hoverBg : 'transparent', color: active ? '#2962FF' : tk.toolbarText, cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400, textAlign: 'left' }} onMouseEnter={e => { if (!active) e.currentTarget.style.background = theme === 'light' ? '#F0F3FA' : '#2A2E39'; }} onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>{icon}{children}{active && <Check size={14} style={{ marginLeft: 'auto' }} />}</button>;
}

// TradingView vertical divider between toolbar clusters
function TvDivider() {
  const theme = useStore(s => s.theme);
  const tk = getThemeTokens(theme);
  return <div style={{ width: 1, height: 22, background: tk.toolbarBorder, margin: '0 2px', flexShrink: 0 }} />;
}

export default function ChartToolbar({
  selectedSymbol = 'RELIANCE', onSelectSymbol = () => {},
  interval = '1d', onIntervalChange = () => {},
  onResetZoom = () => {}, isFullscreen = false, onToggleFullscreen = () => {},
  activeIndicatorCount = 0, onOpenIndicators = () => {}, livePrice = null, liveChange = null, isLive = false,
  wsConnected = false, chartType = 'candlestick', onChartTypeChange = () => {}, priceScaleMode = 'normal',
  onPriceScaleModeChange = () => {}, showDrawingTools = true, onToggleDrawingTools = () => {}, onOpenSettings = () => {},
  activeDrawingTool = 'crosshair', onSelectDrawingTool = () => {},
  showVolume = true, onToggleVolume = () => {}, isMobile = false, isTablet = false,
  isReplaying = false, onToggleReplay = () => {},
  showTradeBar = true, onToggleTradeBar = () => {},
  showTradeDocket = false, onToggleTradeDocket = () => {},
  paperPositionCount = 0,
  smcProOn = false, onToggleSmcPro = () => {}, onOpenAlerts = () => {},
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [openDrawGroup, setOpenDrawGroup] = useState(null);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const rootRef = useRef(null);
  const [smcDisplay, setSmcDisplay] = useState(() => loadSmcDisplay());
  useEffect(() => subscribeSmcDisplay(setSmcDisplay), []);

  // ── TV number-key timeframe switch (type "15" → 15m, "4h" → 4H) ──
  const [tfBuffer, setTfBuffer] = useState('');
  const tfBufferRef = useRef('');
  const tfTimerRef = useRef(null);
  const intervalRef = useRef(interval);
  intervalRef.current = interval;
  const onIntervalChangeRef = useRef(onIntervalChange);
  onIntervalChangeRef.current = onIntervalChange;
  const clearTfBuffer = useCallback(() => {
    tfBufferRef.current = '';
    setTfBuffer('');
    if (tfTimerRef.current) { clearTimeout(tfTimerRef.current); tfTimerRef.current = null; }
  }, []);
  const commitTfBuffer = useCallback(() => {
    const buf = tfBufferRef.current;
    clearTfBuffer();
    if (!buf) return;
    const value = resolveTimeframeBuffer(buf);
    if (!value) {
      toast.error(`No timeframe for "${buf}" — try 1, 5, 15, 30, 1H, 4H, 1D`);
      return;
    }
    if (value !== intervalRef.current) onIntervalChangeRef.current?.(value);
  }, [clearTfBuffer]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
      if (openMenu === 'symbol') return;
      const k = e.key;
      if (k === 'Enter' && tfBufferRef.current) {
        e.preventDefault();
        commitTfBuffer();
        return;
      }
      if (k === 'Escape' && tfBufferRef.current) {
        clearTfBuffer();
        return;
      }
      if (k && k.length === 1 && /^[0-9hHdDmM]$/.test(k)) {
        const next = (tfBufferRef.current + k).slice(-3);
        tfBufferRef.current = next;
        setTfBuffer(next);
        if (tfTimerRef.current) clearTimeout(tfTimerRef.current);
        tfTimerRef.current = setTimeout(commitTfBuffer, 800);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (tfTimerRef.current) clearTimeout(tfTimerRef.current);
    };
  }, [openMenu, commitTfBuffer, clearTfBuffer]);

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
  const currSym = isCrypto ? '$' : '₹';
  const liveState = isReplaying ? 'REPLAY' : (isLive ? 'LIVE' : (wsConnected ? 'DELAYED' : 'OFFLINE'));
  const liveDot = isReplaying ? '#EF5350' : (isLive ? '#26A69A' : (wsConnected ? '#FF9800' : '#787B86'));
  const chg = Number(liveChange);
  const chgUp = isFinite(chg) ? chg >= 0 : null;
  const chgColor = chgUp == null ? tk.toolbarMuted : (chgUp ? '#26A69A' : '#EF5350');
  const formatPrice = value => value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toLocaleString(isCrypto ? 'en-US' : 'en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const drawToolLabel = getToolSpec(activeDrawingTool)?.label || 'Draw';

  return <div ref={rootRef} style={{ flexShrink: 0, position: 'relative', zIndex: 70, display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 2, height: 40, minHeight: 40, padding: '0 8px 0 4px', overflow: 'visible', background: tk.toolbarBg, borderBottom: `1px solid ${tk.toolbarBorder}`, color: tk.toolbarText, fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif" }}>
      {/* ── Symbol block (TradingView left header) ── */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'symbol' ? null : 'symbol')}
          title="Symbol search"
          style={{ ...tvBtn(tk), padding: '4px 6px', gap: 6 }}
        >
          <Search size={16} style={{ color: tk.toolbarMuted, flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: tk.toolbarText, letterSpacing: '0.01em' }}>{selectedSymbol}</span>
        </button>
        {/* Live price + change — TV header style */}
        {!isTablet && (
          <div title={`${liveState} feed`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6, whiteSpace: 'nowrap' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: liveDot, flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: tk.toolbarText }}>{currSym}{formatPrice(livePrice)}</span>
            {chgUp != null && (
              <span style={{ fontSize: 12, fontWeight: 500, color: chgColor }}>
                {chgUp ? '+' : ''}{Number(chg).toFixed(2)}%
              </span>
            )}
          </div>
        )}

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

      <TvDivider />

      {/* ── Timeframe: TV dropdown (current interval + full list) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'timeframe' ? null : 'timeframe')}
            title="Timeframe"
            style={{
              ...tvBtn(tk),
              gap: 4,
              padding: '4px 8px',
              fontSize: 13,
              fontWeight: 600,
              color: openMenu === 'timeframe' ? '#2962FF' : tk.toolbarText,
              background: openMenu === 'timeframe' ? tk.hoverBg : 'transparent',
              borderRadius: 4,
            }}
          >
            <span style={{ minWidth: 26, textAlign: 'center' }}>
              {TIMEFRAME_OPTIONS.find((o) => o.value === interval)?.label || interval}
            </span>
            <ChevronDown size={14} style={{ color: tk.toolbarMuted }} />
          </button>
          {openMenu === 'timeframe' && (
            <Menu style={{ minWidth: 240 }}>
              {TF_GROUPS.map((group) => (
                <div key={group.id}>
                  <div style={drawGroupHeader}>{group.label}</div>
                  {TIMEFRAME_OPTIONS.filter((o) => group.units.includes(o.unit)).map((item) => {
                    const active = interval === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => { onIntervalChange(item.value); setOpenMenu(null); }}
                        title={`Switch to ${item.full} (type "${item.num}${item.unit === 'm' ? '' : item.unit}")`}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', border: 0, borderRadius: 0, background: active ? tk.hoverBg : 'transparent', color: active ? '#2962FF' : tk.toolbarText, cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400, textAlign: 'left' }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = theme === 'light' ? '#F0F3FA' : '#2A2E39'; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ minWidth: 30 }}>{item.label}</span>
                        <span style={{ color: tk.toolbarMuted, fontSize: 12 }}>{item.full}</span>
                        {active && <Check size={14} style={{ marginLeft: 'auto' }} />}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div style={{ height: 1, background: tk.toolbarBorder, margin: '4px 0' }} />
              <div style={{ padding: '5px 12px 7px', color: tk.toolbarMuted, fontSize: 11, lineHeight: 1.5 }}>
                Tip: press <b>1</b> · <b>15</b> · <b>30</b> · <b>1H</b> · <b>4H</b> · <b>1D</b> to switch
              </div>
            </Menu>
          )}
        </div>
        {/* Typed number-key buffer (TV quick-switch feedback) */}
        {tfBuffer && (
          <span
            title="Timeframe quick-switch — Enter to apply, Esc to cancel"
            style={{ marginLeft: 2, padding: '3px 8px', borderRadius: 4, background: '#2962FF', color: '#FFFFFF', fontSize: 12, fontWeight: 600, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}
          >
            {tfBuffer}
          </span>
        )}
      </div>

      <TvDivider />

      {/* ── Chart type + Indicators ── */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <button type="button" onClick={() => setOpenMenu(openMenu === 'type' ? null : 'type')} title="Chart type" style={tvBtn(tk)}>
          <BarChart2 size={17} />
          {(!isMobile && !isTablet) && <ChevronDown size={13} style={{ color: tk.toolbarMuted }} />}
        </button>
        {openMenu === 'type' && <Menu>{CHART_TYPES.map(item => <MenuItem key={item.id} active={chartType === item.id} onClick={() => { onChartTypeChange(item.id); setOpenMenu(null); }}>{item.label}</MenuItem>)}</Menu>}
      </div>

      <button
        type="button"
        onClick={onOpenIndicators}
        title="Indicators, metrics and strategies"
        style={{
          ...tvBtn(tk),
          gap: 6,
          padding: '5px 10px',
          color: activeIndicatorCount ? '#2962FF' : tk.toolbarText,
          fontWeight: activeIndicatorCount ? 600 : 400,
          fontSize: 13,
        }}
      >
        <Activity size={17} />
        {(!isMobile) && <span>Indicators</span>}
        {activeIndicatorCount > 0 && <span style={tvCountBadge}>{activeIndicatorCount}</span>}
      </button>

      {/* ── SMC Pro cluster (toggle + display menu + alerts) ── */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onToggleSmcPro}
          title={smcProOn ? 'Disable SMC Pro overlays' : 'Enable SMC Pro overlays'}
          style={{
            ...tvBtn(tk),
            gap: 7,
            padding: '5px 10px',
            border: `1px solid ${smcProOn ? '#2962FF' : tk.toolbarBorder}`,
            borderRadius: 7,
            color: smcProOn ? '#7AA2FF' : tk.toolbarText,
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          {!isMobile && <span>SMC Pro</span>}
          <span
            role="switch"
            aria-checked={!!smcProOn}
            style={{
              width: 30, height: 17, borderRadius: 9, padding: 2, display: 'flex',
              alignItems: 'center', justifyContent: smcProOn ? 'flex-end' : 'flex-start',
              background: smcProOn ? '#2962FF' : 'rgba(127,127,127,0.45)',
            }}
          >
            <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#FFF' }} />
          </span>
        </button>
        {!isMobile && (
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'smc' ? null : 'smc')}
            title="SMC Pro display options"
            style={{ ...tvBtn(tk), minWidth: 26, color: openMenu === 'smc' ? '#2962FF' : tk.toolbarMuted }}
          >
            <ChevronDown size={14} />
          </button>
        )}
        {!isMobile && (
          <button type="button" onClick={onOpenAlerts} title="Price alerts" style={tvBtn(tk)}>
            <Bell size={17} />
          </button>
        )}
        {openMenu === 'smc' && (
          <Menu style={{ minWidth: 250 }}>
            <div style={drawGroupHeader}>Display mode</div>
            {[
              ['smart', 'Smart — active structures only'],
              ['minimal', 'Minimal — structure + setup'],
              ['full', 'Full — more history'],
              ['debug', 'Debug — every detection'],
            ].map(([mode, label]) => (
              <MenuItem
                key={mode}
                active={smcDisplay.mode === mode}
                onClick={() => saveSmcDisplay({ mode })}
              >
                {label}
              </MenuItem>
            ))}
            <div style={{ height: 1, background: tk.toolbarBorder, margin: '4px 0' }} />
            <div style={drawGroupHeader}>Max visible</div>
            {[
              ['maxOb', 'Order blocks / side'],
              ['maxFvg', 'FVGs / side'],
              ['maxLiquidity', 'Liquidity levels'],
              ['maxStructure', 'Structure tags'],
            ].map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', fontSize: 12, color: tk.toolbarText }}>
                <span>{label}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => saveSmcDisplay({ [key]: Math.max(0, (Number(smcDisplay[key]) || 0) - 1) })}
                    style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${tk.toolbarBorder}`, background: 'transparent', color: tk.toolbarText, cursor: 'pointer' }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 700 }}>{smcDisplay[key] ?? '—'}</span>
                  <button
                    type="button"
                    onClick={() => saveSmcDisplay({ [key]: Math.min(12, (Number(smcDisplay[key]) || 0) + 1) })}
                    style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${tk.toolbarBorder}`, background: 'transparent', color: tk.toolbarText, cursor: 'pointer' }}
                  >
                    +
                  </button>
                </span>
              </div>
            ))}
            <div style={{ height: 1, background: tk.toolbarBorder, margin: '4px 0' }} />
            <div style={drawGroupHeader}>SMC Pro layers</div>
            {[
              ['zones', 'Order blocks + FVG zones'],
              ['structure', 'BOS / CHoCH / HH / HL labels'],
              ['liquidity', 'BSL / SSL / EQH / EQL lines'],
              ['killzones', 'Asia / London / New York strip'],
              ['setup', 'Entry / TP / SL box'],
              ['scoreCard', 'SMC Pro summary card'],
            ].map(([key, label]) => (
              <MenuItem
                key={key}
                active={!!smcDisplay[key]}
                onClick={() => saveSmcDisplay({ [key]: !smcDisplay[key] })}
              >
                {label}
              </MenuItem>
            ))}
          </Menu>
        )}
      </div>

      {!isTablet && <TvDivider />}

      {/* ── Draw / replay / trade cluster ── */}
      {!isTablet && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <button type="button" onClick={() => setOpenMenu(openMenu === 'draw' ? null : 'draw')} title={drawToolLabel} style={{ ...tvBtn(tk), color: showDrawingTools ? '#2962FF' : tk.toolbarText }}>
            <PenTool size={17} />
            {!isMobile && <ChevronDown size={13} style={{ color: tk.toolbarMuted }} />}
          </button>
          {openMenu === 'draw' && <Menu style={{ minWidth: 230 }}><MenuItem active={showDrawingTools} onClick={() => { onToggleDrawingTools(); }}>Drawing toolbar</MenuItem><div style={{ height: 1, background: tk.toolbarBorder, margin: '4px 0' }} />{DRAWING_TOOL_GROUPS.map(group => {
            const groupActive = group.tools.some(t => t.id === activeDrawingTool);
            const expanded = openDrawGroup === group.id;
            return (
              <div key={group.id} style={{ position: 'relative' }} onMouseEnter={() => setOpenDrawGroup(group.id)}>
                <button
                  type="button"
                  onClick={() => setOpenDrawGroup(expanded ? null : group.id)}
                  title={`${group.label} tools`}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', border: 0, borderRadius: 0, background: expanded ? tk.hoverBg : 'transparent', color: groupActive ? '#2962FF' : tk.toolbarText, cursor: 'pointer', fontSize: 13, fontWeight: groupActive ? 600 : 400, textAlign: 'left', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = theme === 'light' ? '#F0F3FA' : '#2A2E39'; }}
                  onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ flex: 1 }}>{group.label}</span>
                  <span style={{ fontSize: 11, color: tk.toolbarMuted }}>{group.tools.length}</span>
                  <ChevronRight size={14} style={{ color: tk.toolbarMuted }} />
                </button>
                {expanded && (
                  <div style={{ position: 'absolute', left: 'calc(100% + 4px)', top: -5, minWidth: 210, maxHeight: 320, overflowY: 'auto', padding: '4px 0', border: `1px solid ${tk.toolbarBorder}`, borderRadius: 4, background: tk.menuBg, boxShadow: '0 4px 16px rgba(0,0,0,0.45)', zIndex: 130 }}>
                    <div style={drawGroupHeader}>{group.label}</div>
                    {group.tools.map(tool => <MenuItem key={tool.id} active={activeDrawingTool === tool.id} onClick={() => { onSelectDrawingTool(tool.id); setOpenMenu(null); }}>{tool.label}</MenuItem>)}
                  </div>
                )}
              </div>
            );
          })}</Menu>}
        </div>
      )}

      {/* ── Right side: scale, volume, replay, trade, settings ── */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {!(isMobile || isTablet) && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button type="button" onClick={() => setOpenMenu(openMenu === 'scale' ? null : 'scale')} title="Price scale" style={{ ...tvBtn(tk), fontSize: 12, fontWeight: 600, color: tk.toolbarMuted }}>
              {priceScaleMode === 'normal' ? 'Auto' : priceScaleMode === 'log' ? 'Log' : '%'}
            </button>
            {openMenu === 'scale' && <Menu align="right">{['normal', 'log', 'percentage'].map(mode => <MenuItem key={mode} active={priceScaleMode === mode} onClick={() => { onPriceScaleModeChange(mode); setOpenMenu(null); }}>{mode === 'normal' ? 'Auto' : mode === 'log' ? 'Logarithmic' : 'Percentage'}</MenuItem>)}</Menu>}
          </div>
        )}
        {!isTablet && (
          <button type="button" onClick={onToggleVolume} title={showVolume ? 'Hide volume' : 'Show volume'} style={{ ...tvBtn(tk), color: showVolume ? '#2962FF' : tk.toolbarMuted }}>
            <BarChart2 size={17} />
          </button>
        )}
        {!isTablet && (
          <button type="button" onClick={onToggleReplay} title="Bar Replay (Alt+R)" style={{ ...tvBtn(tk), color: isReplaying ? '#EF5350' : tk.toolbarMuted, background: isReplaying ? 'rgba(239,83,80,0.12)' : 'transparent', borderRadius: 4 }}>
            <History size={17} />
          </button>
        )}
        {!isTablet && (
          <button type="button" onClick={onToggleTradeBar} title="Paper trade" style={{ ...tvBtn(tk), color: showTradeBar ? '#26A69A' : tk.toolbarMuted }}>
            <Zap size={17} />
          </button>
        )}
        {!isTablet && (
          <button type="button" onClick={onToggleTradeDocket} title="Trading panel" style={{ ...tvBtn(tk), color: showTradeDocket ? '#2962FF' : tk.toolbarMuted }}>
            <Wallet size={17} />
            {paperPositionCount > 0 && <span style={{ ...tvCountBadge, background: '#26A69A' }}>{paperPositionCount}</span>}
          </button>
        )}
        {!isMobile && (
          <button type="button" onClick={onResetZoom} title="Reset chart view" style={{ ...tvBtn(tk), display: isTablet ? 'none' : 'flex' }}>
            <RotateCcw size={16} />
          </button>
        )}
        {(isMobile || isTablet) && (
          <button type="button" onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')} title="More" style={tvBtn(tk)}>
            <SlidersHorizontal size={17} />
          </button>
        )}
        <button type="button" onClick={onOpenSettings} title="Chart settings" style={tvBtn(tk)}>
          <Settings size={17} />
        </button>
        <button type="button" onClick={onToggleFullscreen} title="Fullscreen" style={tvBtn(tk)}>
          {isFullscreen ? <Maximize2 size={16} /> : <Fullscreen size={16} />}
        </button>
      </div>
      {openMenu === 'more' && <Menu align="right"><MenuItem onClick={() => { onOpenIndicators(); setOpenMenu(null); }} icon={<Activity size={15} />}>Indicators {activeIndicatorCount > 0 && `(${activeIndicatorCount})`}</MenuItem><MenuItem onClick={() => { onToggleVolume(); setOpenMenu(null); }} icon={<BarChart2 size={15} />}>{showVolume ? 'Hide Volume' : 'Show Volume'}</MenuItem><MenuItem onClick={() => { onToggleReplay(); setOpenMenu(null); }} icon={<History size={15} />}>{isReplaying ? 'Exit Bar Replay' : 'Bar Replay'}</MenuItem><MenuItem onClick={() => { onToggleTradeBar(); setOpenMenu(null); }} icon={<Zap size={15} />}>Trade Bar</MenuItem><MenuItem onClick={() => { onToggleTradeDocket(); setOpenMenu(null); }} icon={<Wallet size={15} />}>Trading Panel</MenuItem><MenuItem onClick={() => { onOpenSettings(); setOpenMenu(null); }} icon={<Settings size={15} />}>Settings</MenuItem><MenuItem onClick={() => { onResetZoom(); setOpenMenu(null); }} icon={<RotateCcw size={15} />}>Reset View</MenuItem></Menu>}
  </div>;
}

const tvBtn = (tk) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 32, minWidth: 32, padding: '0 6px', border: 0, borderRadius: 4, background: 'transparent', color: tk?.toolbarText || '#D1D4DC', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' });
const tvCountBadge = { minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#2962FF', color: '#FFFFFF', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
