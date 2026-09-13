import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, Maximize2, Minimize2, RotateCcw, Activity, Settings, PenTool, BarChart2, ChevronDown, Check } from 'lucide-react';
import { INTERVALS, POPULAR_STOCKS, isCryptoSymbol } from '../../utils/chartHelpers';

const CHART_TYPE_LABELS = {
  candlestick: 'Candles',
  hollow: 'Hollow',
  bar: 'Bars',
  line: 'Line',
  area: 'Area',
  baseline: 'Baseline',
};

/**
 * Real-time Candle Countdown Hook
 * Calculates exact time remaining until active candle closes, anchored to NSE 09:15 IST
 * or 24/7 continuous session for Cryptocurrencies.
 * Updates accurately every 1000ms.
 */
function useCandleCountdown(interval, selectedSymbol) {
  const [remaining, setRemaining] = useState({ text: '--:--', isLive: false });

  useEffect(() => {
    function tick() {
      const nowMs = Date.now();
      const isCrypto = isCryptoSymbol(selectedSymbol);

      if (isCrypto) {
        if (interval === '1d') {
          const secInDay = Math.floor(nowMs / 1000) % 86400;
          const diffSec = 86400 - secInDay;
          const h = Math.floor(diffSec / 3600);
          const m = Math.floor((diffSec % 3600) / 60);
          const s = diffSec % 60;
          setRemaining({
            text: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
            isLive: true,
          });
          return;
        }
        const bucketSizes = {
          '1s': 1, '30s': 30, '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400
        };
        const bSec = bucketSizes[interval] || 60;
        const nowSec = Math.floor(nowMs / 1000);
        const diffSec = bSec - (nowSec % bSec);
        const m = Math.floor(diffSec / 60);
        const s = diffSec % 60;
        const formatted = diffSec >= 3600
          ? `${String(Math.floor(diffSec / 3600)).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        setRemaining({ text: formatted, isLive: true });
        return;
      }

      const istDate = new Date(nowMs + 5.5 * 3600 * 1000);
      const istDayOfWeek = istDate.getUTCDay(); // 0=Sun, 6=Sat
      const isWeekend = istDayOfWeek === 0 || istDayOfWeek === 6;

      const istHours = istDate.getUTCHours();
      const istMinutes = istDate.getUTCMinutes();
      const istSeconds = istDate.getUTCSeconds();
      const istTotalSec = istHours * 3600 + istMinutes * 60 + istSeconds;

      const marketOpenSec = 9 * 3600 + 15 * 60;  // 09:15 IST (33,300s)
      const marketCloseSec = 15 * 3600 + 30 * 60; // 15:30 IST (55,800s)
      const isMarketOpen = !isWeekend && istTotalSec >= marketOpenSec && istTotalSec <= marketCloseSec;

      if (interval === '1d') {
        if (!isMarketOpen) {
          setRemaining({ text: isWeekend || istTotalSec > marketCloseSec ? 'Closed' : 'Pre-Mkt', isLive: false });
          return;
        }
        const diffSec = marketCloseSec - istTotalSec;
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        setRemaining({
          text: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
          isLive: true,
        });
        return;
      }

      if (interval === '4h') {
        if (!isMarketOpen) {
          setRemaining({ text: 'Closed', isLive: false });
          return;
        }
        const bar1Close = 13 * 3600 + 15 * 60; // 13:15 IST
        const targetSec = istTotalSec < bar1Close ? bar1Close : marketCloseSec;
        const diffSec = Math.max(0, targetSec - istTotalSec);
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        setRemaining({
          text: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
          isLive: true,
        });
        return;
      }

      if (interval === '1s') {
        setRemaining({ text: '00:01', isLive: isMarketOpen });
        return;
      }

      const bucketSizes = {
        '30s': 30,
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '30m': 1800,
        '1h': 3600,
      };
      const bSec = bucketSizes[interval] || 60;

      // Elapsed seconds within the current interval bucket from 09:15 anchor
      let elapsed = (istTotalSec - marketOpenSec) % bSec;
      if (elapsed < 0) elapsed += bSec;
      const diffSec = bSec - elapsed;

      let formatted = '';
      if (diffSec >= 3600) {
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      } else {
        const m = Math.floor(diffSec / 60);
        const s = diffSec % 60;
        formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }

      setRemaining({ text: formatted, isLive: isMarketOpen });
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [interval]);

  return remaining;
}

export default function ChartToolbar({
  selectedSymbol = 'RELIANCE',
  onSelectSymbol = () => {},
  interval = '1d',
  onIntervalChange = () => {},
  onResetZoom = () => {},
  isFullscreen = false,
  onToggleFullscreen = () => {},
  searchStocks = null,
  activeIndicatorCount = 0,
  onOpenIndicators = () => {},
  livePrice = null,
  liveChange = null,
  isLive = false,
  chartType = 'candlestick',
  onChartTypeChange = () => {},
  priceScaleMode = 'normal',
  onPriceScaleModeChange = () => {},
  showDrawingTools = true,
  onToggleDrawingTools = () => {},
  onOpenSettings = () => {},
}) {
  const countdown = useCandleCountdown(interval, selectedSymbol);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showChartTypeMenu, setShowChartTypeMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);
  const chartTypeMenuRef = useRef(null);

  // Close chart type menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (chartTypeMenuRef.current && !chartTypeMenuRef.current.contains(e.target)) {
        setShowChartTypeMenu(false);
      }
    }
    if (showChartTypeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showChartTypeMenu]);

  // Debounced server search when typing in modal
  useEffect(() => {
    if (!searchQuery.trim() || !searchStocks) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchStocks(searchQuery.trim());
        if (Array.isArray(res)) {
          setSearchResults(res.slice(0, 15));
        }
      } catch (err) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, searchStocks]);

  // Focus search input on open
  useEffect(() => {
    if (showSearchModal && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchModal]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '4px 10px',
      background: '#0B0F1C',
      border: '1px solid rgba(99, 102, 241, 0.18)',
      borderRadius: 6,
      height: 38,
      flexShrink: 0,
      position: 'relative',
      zIndex: 40,
    }}>
      {/* Left: Stock Ticker Selector + Timeframe + Range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Ticker Search Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSearchModal(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 5,
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              color: '#FFFFFF',
              fontSize: '0.84rem',
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
            title="Search Stock (NSE)"
          >
            <Search size={13} style={{ color: '#818CF8' }} />
            <span style={{ color: selectedSymbol === 'BTC' ? '#F59E0B' : '#FFFFFF' }}>
              {selectedSymbol === 'BTC' ? '₿ BTC / USD' : (selectedSymbol || 'STOCK')}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>▾</span>
          </button>

          {/* Quick Search Dropdown Modal */}
          {showSearchModal && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: 320,
                backgroundColor: '#0F172A',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: 8,
                padding: 8,
                zIndex: 100,
                boxShadow: '0 16px 36px rgba(0,0,0,0.85)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: 10, color: '#64748B' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search stock or crypto (e.g. BTC, RELIANCE)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    borderRadius: 6,
                    border: '1px solid rgba(99,102,241,0.3)',
                    background: '#090C18',
                    color: '#fff',
                    fontSize: '0.78rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (searchResults.length > 0) {
                        onSelectSymbol(searchResults[0].ticker);
                        setShowSearchModal(false);
                      } else if (searchQuery.trim()) {
                        onSelectSymbol(searchQuery.trim().toUpperCase());
                        setShowSearchModal(false);
                      }
                    } else if (e.key === 'Escape') {
                      setShowSearchModal(false);
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: 8, top: 7, background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Suggestions / Results */}
              <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                {isSearching && (
                  <div style={{ padding: '8px 12px', fontSize: '0.72rem', color: '#818CF8' }}>
                    Searching NSE Universe...
                  </div>
                )}

                {searchQuery.trim() && searchResults.length > 0 && searchResults.map((item) => (
                  <div
                    key={item.ticker}
                    onClick={() => {
                      onSelectSymbol(item.ticker);
                      setShowSearchModal(false);
                    }}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 5,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: selectedSymbol === item.ticker ? 'rgba(99,102,241,0.2)' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.14)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSymbol === item.ticker ? 'rgba(99,102,241,0.2)' : 'transparent'}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
                        {item.ticker}
                      </span>
                      <span style={{ fontSize: '0.66rem', color: '#94A3B8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name || item.ticker}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.62rem', padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: '#64748B' }}>
                      NSE
                    </span>
                  </div>
                ))}

                {/* Popular stocks list when empty query */}
                {(!searchQuery.trim() || (!isSearching && searchResults.length === 0)) && (
                  <div>
                    <div style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 700, padding: '4px 8px', letterSpacing: '0.05em' }}>
                      POPULAR WATCHLIST
                    </div>
                    {POPULAR_STOCKS
                      .filter((s) => !searchQuery || s.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((sym) => (
                        <div
                          key={sym}
                          onClick={() => {
                            onSelectSymbol(sym);
                            setShowSearchModal(false);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 4,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: selectedSymbol === sym ? (sym === 'BTC' ? '#F59E0B' : '#818CF8') : '#E2E8F0',
                            backgroundColor: selectedSymbol === sym ? (sym === 'BTC' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)') : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = sym === 'BTC' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSymbol === sym ? (sym === 'BTC' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)') : 'transparent'}
                        >
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: sym === 'BTC' ? '#F59E0B' : undefined }}>
                            {sym === 'BTC' ? '₿ BTC / USD' : sym}
                          </span>
                          <span style={{
                            fontSize: '0.62rem',
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: sym === 'BTC' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',
                            color: sym === 'BTC' ? '#F59E0B' : '#64748B'
                          }}>
                            {sym === 'BTC' ? 'CRYPTO' : 'NSE'}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)' }} />

        {/* Quick Timeframe Chips + Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {[
            { label: '⚡1s', value: '1s', title: '1-Second Live Candles (Instant formation)' },
            { label: '1m', value: '1m', title: '1-Minute Candles' },
            { label: '5m', value: '5m', title: '5-Minute Candles' },
            { label: '15m', value: '15m', title: '15-Minute Candles' },
            { label: '1H', value: '1h', title: '1-Hour Candles' },
            { label: '1D', value: '1d', title: 'Daily Candles' },
          ].map(chip => (
            <button
              key={chip.value}
              onClick={() => onIntervalChange(chip.value)}
              title={chip.title}
              style={{
                background: interval === chip.value
                  ? (chip.value === '1s' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(99, 102, 241, 0.28)')
                  : 'transparent',
                border: interval === chip.value
                  ? (chip.value === '1s' ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid rgba(99, 102, 241, 0.6)')
                  : '1px solid transparent',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: '0.72rem',
                fontWeight: interval === chip.value ? 800 : 600,
                color: interval === chip.value
                  ? (chip.value === '1s' ? '#FBBF24' : '#A5B4FC')
                  : '#94A3B8',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (interval !== chip.value) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = '#E2E8F0';
                }
              }}
              onMouseLeave={(e) => {
                if (interval !== chip.value) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#94A3B8';
                }
              }}
            >
              {chip.label}
            </button>
          ))}

          {/* Timeframe Interval Dropdown for remaining resolutions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 4,
            padding: '2px 4px',
            height: 24,
          }}>
            <select
              value={interval}
              onChange={(e) => onIntervalChange(e.target.value)}
              style={{
                background: 'transparent',
                color: '#818CF8',
                border: 'none',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'JetBrains Mono, monospace',
                padding: 0,
              }}
              title="More Timeframes"
            >
              {INTERVALS.map(iv => (
                <option key={iv.value} value={iv.value} style={{ background: '#0B0F1C', color: '#E2E8F0' }}>
                  {iv.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Real-Time Candle Countdown Timer Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: countdown.isLive ? 'rgba(16, 185, 129, 0.10)' : 'rgba(100, 116, 139, 0.10)',
            border: `1px solid ${countdown.isLive ? 'rgba(16, 185, 129, 0.35)' : 'rgba(100, 116, 139, 0.25)'}`,
            borderRadius: 5,
            padding: '2px 8px',
            height: 25,
            fontSize: '0.70rem',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            color: countdown.isLive ? '#10B981' : '#94A3B8',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
          title={`Active candle closing countdown (${interval} candle, IST)`}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: countdown.isLive ? '#10B981' : '#64748B',
              boxShadow: countdown.isLive ? '0 0 6px rgba(16, 185, 129, 0.85)' : 'none',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span>{countdown.text}</span>
        </div>

        {/* fx Indicators Library Button */}
        <button
          onClick={onOpenIndicators}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: activeIndicatorCount > 0 ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.1)',
            border: `1px solid ${activeIndicatorCount > 0 ? 'rgba(99, 102, 241, 0.5)' : 'rgba(99, 102, 241, 0.3)'}`,
            borderRadius: 5,
            padding: '2px 8px',
            height: 25,
            color: activeIndicatorCount > 0 ? '#A5B4FC' : '#818CF8',
            fontSize: '0.72rem',
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
            transition: 'all 0.15s ease',
          }}
          title="Technical Indicators & Studies"
        >
          <Activity size={12} />
          <span>fx Indicators</span>
          {activeIndicatorCount > 0 && (
            <span
              style={{
                fontSize: '0.62rem',
                backgroundColor: '#6366F1',
                color: '#fff',
                padding: '0px 5px',
                borderRadius: 8,
                fontWeight: 800,
              }}
            >
              {activeIndicatorCount}
            </span>
          )}
        </button>

        {/* Chart Type Selector Dropdown */}
        <div ref={chartTypeMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowChartTypeMenu(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 7px',
              height: 25,
              borderRadius: 5,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#CBD5E1',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            title="Chart Type"
          >
            <BarChart2 size={13} style={{ color: '#818CF8' }} />
            <span>{CHART_TYPE_LABELS[chartType] || 'Candles'}</span>
            <ChevronDown size={11} style={{ color: '#64748B' }} />
          </button>
          {showChartTypeMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                backgroundColor: '#0F172A',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 6,
                padding: 4,
                zIndex: 120,
                boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                minWidth: 140,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {[
                { id: 'candlestick', label: 'Candlesticks' },
                { id: 'hollow', label: 'Hollow Candles' },
                { id: 'bar', label: 'Bars' },
                { id: 'line', label: 'Line' },
                { id: 'area', label: 'Area' },
                { id: 'baseline', label: 'Baseline' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    onChartTypeChange(item.id);
                    setShowChartTypeMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: chartType === item.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                    color: chartType === item.id ? '#818CF8' : '#94A3B8',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  <span>{item.label}</span>
                  {chartType === item.id && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Drawing Tools Toggle Button */}
        <button
          onClick={onToggleDrawingTools}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 7px',
            height: 25,
            borderRadius: 5,
            background: showDrawingTools ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${showDrawingTools ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: showDrawingTools ? '#818CF8' : '#94A3B8',
            fontSize: '0.7rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
          title={showDrawingTools ? 'Hide Drawing Toolbar' : 'Show Drawing Toolbar'}
        >
          <PenTool size={12} />
          <span>Draw</span>
        </button>

        {/* Scale Mode Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.03)', padding: 1, borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => onPriceScaleModeChange('normal')}
            style={{
              padding: '2px 6px',
              borderRadius: 3,
              border: 'none',
              background: priceScaleMode === 'normal' ? '#2563EB' : 'transparent',
              color: priceScaleMode === 'normal' ? '#FFF' : '#64748B',
              fontSize: '0.65rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
            title="Auto / Normal Scale"
          >
            Auto
          </button>
          <button
            onClick={() => onPriceScaleModeChange('log')}
            style={{
              padding: '2px 6px',
              borderRadius: 3,
              border: 'none',
              background: priceScaleMode === 'log' ? '#2563EB' : 'transparent',
              color: priceScaleMode === 'log' ? '#FFF' : '#64748B',
              fontSize: '0.65rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
            title="Logarithmic Scale"
          >
            Log
          </button>
          <button
            onClick={() => onPriceScaleModeChange('percentage')}
            style={{
              padding: '2px 6px',
              borderRadius: 3,
              border: 'none',
              background: priceScaleMode === 'percentage' ? '#2563EB' : 'transparent',
              color: priceScaleMode === 'percentage' ? '#FFF' : '#64748B',
              fontSize: '0.65rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
            title="Percentage Scale"
          >
            %
          </button>
        </div>
      </div>

      {/* Right: Live Stream Badge, Settings, Reset Zoom, Fullscreen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Chart Settings Button */}
        <button
          onClick={onOpenSettings}
          style={{
            padding: '4px 6px',
            borderRadius: 5,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: '#94A3B8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Chart Settings"
        >
          <Settings size={13} style={{ color: '#818CF8' }} />
        </button>
        {/* Live Stream Pulse Badge */}
        <div
          title={isLive ? "Continuous real-time market WebSocket feed active" : "Waiting for live feed..."}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: isLive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
            border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 116, 139, 0.25)'}`,
            borderRadius: 4,
            padding: '2px 7px',
            height: 24,
            fontSize: '0.68rem',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            color: isLive ? '#34D399' : '#94A3B8',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: isLive ? '#10B981' : '#64748B',
            boxShadow: isLive ? '0 0 6px rgba(16, 185, 129, 0.85)' : 'none',
            display: 'inline-block',
          }} />
          <span>{isLive ? 'LIVE' : 'IDLE'}</span>
          {livePrice != null && (
            <span style={{ color: '#F1F5F9', fontWeight: 800, marginLeft: 2 }}>
              {isCryptoSymbol(selectedSymbol)
                ? `$${Number(livePrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `₹${Number(livePrice).toFixed(2)}`}
            </span>
          )}
        </div>

        {/* Reset Zoom / Focus Latest Bars */}
        <button
          onClick={onResetZoom}
          title="Focus Latest Candles"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 5,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: '#94A3B8',
            fontSize: '0.7rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={12} style={{ color: '#818CF8' }} />
          <span>Focus</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={onToggleFullscreen}
          title="Toggle Fullscreen"
          style={{
            padding: '4px 7px',
            borderRadius: 5,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent',
            color: '#94A3B8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </div>
  );
}
