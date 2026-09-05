import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, Maximize2, Minimize2, RotateCcw, Activity } from 'lucide-react';
import { INTERVALS, POPULAR_STOCKS } from '../../utils/chartHelpers';

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
}) {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);

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
            <span>{selectedSymbol || 'STOCK'}</span>
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
                  placeholder="Search NSE stock (e.g. RELIANCE, TCS)..."
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
                      POPULAR NSE TICKERS
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
                            color: selectedSymbol === sym ? '#818CF8' : '#E2E8F0',
                            backgroundColor: selectedSymbol === sym ? 'rgba(99,102,241,0.2)' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.12)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSymbol === sym ? 'rgba(99,102,241,0.2)' : 'transparent'}
                        >
                          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{sym}</span>
                          <span style={{ fontSize: '0.62rem', color: '#64748B' }}>NSE</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)' }} />

        {/* Timeframe Interval Dropdown */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 5,
          padding: '2px 7px',
          height: 25,
        }}>
          <Clock size={12} style={{ color: '#818CF8', flexShrink: 0 }} />
          <select
            value={interval}
            onChange={(e) => onIntervalChange(e.target.value)}
            style={{
              background: 'transparent',
              color: '#818CF8',
              border: 'none',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'JetBrains Mono, monospace',
              padding: 0,
            }}
            title="Candle Resolution (Timeframe)"
          >
            {INTERVALS.map(iv => (
              <option key={iv.value} value={iv.value} style={{ background: '#0B0F1C', color: '#E2E8F0' }}>
                {iv.label}
              </option>
            ))}
          </select>
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
      </div>

      {/* Right: Reset Zoom, Fullscreen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Reset Zoom / Auto Fit */}
        <button
          onClick={onResetZoom}
          title="Reset Zoom / Fit Content"
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
          <span>Reset Zoom</span>
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
