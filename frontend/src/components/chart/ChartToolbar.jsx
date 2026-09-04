import React from 'react';
import { 
  Search, X, RotateCcw, Activity, Sliders, Calendar, Clock,
  Square, Columns, Rows, Grid2X2, Camera, Maximize2, Minimize2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { INTERVALS, POPULAR_STOCKS } from '../../utils/chartHelpers';

export default function ChartToolbar({
  selectedSymbol = '',
  handleSelectSymbol = () => {},
  showSymbolModal = false,
  setShowSymbolModal = () => {},
  symbolModalFilter = '',
  setSymbolModalFilter = () => {},
  searchResults = [],
  isSearching = false,
  chartEngine = 'stockoracle',
  setChartEngine = () => {},
  interval = '1d',
  handleIntervalChange = () => {},
  timeframe = '1Y',
  setTimeframe = () => {},
  isReplayMode = false,
  setIsReplayMode = () => {},
  isReplayPlaying = false,
  setIsReplayPlaying = () => {},
  setReplayIndex = () => {},
  rawHistory = null,
  setShowAlertModal = () => {},
  priceAlerts = [],
  showIndicatorsModal = false,
  setShowIndicatorsModal = () => {},
  activeIndicatorsCount = 0,
  showIndicatorSettingsModal = false,
  setShowIndicatorSettingsModal = () => {},
  chartLayout = '1x1',
  setChartLayout = () => {},
  handleSnapshot = () => {},
  isFullscreen = false,
  toggleFullscreen = () => {},
  isSplitView = false,
  setIsSplitView = () => {},
  compareSymbol = 'NIFTY50',
  setCompareSymbol = () => {},
  showAdvancedPanel = false,
  setShowAdvancedPanel = () => {},
  advancedPanelTab = 'patterns',
  setAdvancedPanelTab = () => {},
  showSMC = false,
  setShowSMC = () => {},
}) {
  return (
    <div style={{
      display:'flex',
      alignItems:'center',
      justifyContent:'space-between',
      flexWrap:'nowrap',
      gap:8,
      background:'#0B0F1C',
      border:'1px solid rgba(99, 102, 241, 0.15)',
      borderRadius:6,
      padding:'4px 8px',
      position: 'relative',
      zIndex: 50,
      flexShrink: 0,
      height: 38,
    }}>
      {/* Left: Ticker Search Option + Timeframe Selector (Side-by-Side) */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink: 0 }}>
        {/* Symbol Search / Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowSymbolModal(!showSymbolModal);
              setShowIndicatorsModal(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 5,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.35)',
              color: '#F0F0FF',
              fontSize: '0.86rem',
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer',
            }}
            title="Search & Change Stock Ticker"
          >
            <Search size={13} style={{ color: '#818CF8' }} />
            <span>{selectedSymbol || 'STOCK'}</span>
            <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>▾</span>
          </button>

          {/* Quick Symbol Search & Autocomplete Modal */}
          {showSymbolModal && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: 'min(90vw, 320px)',
                backgroundColor: '#0F172A',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: 8,
                padding: 8,
                zIndex: 300,
                boxShadow: '0 16px 36px rgba(0,0,0,0.85)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: 10, color: '#64748B' }} />
                <input
                  type="text"
                  placeholder="Search any NSE stock (e.g. TATA, INFY)..."
                  value={symbolModalFilter}
                  onChange={(e) => setSymbolModalFilter(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    borderRadius: 6,
                    border: '1px solid rgba(99,102,241,0.25)',
                    background: '#090C18',
                    color: '#fff',
                    fontSize: '0.78rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (Array.isArray(searchResults) && searchResults.length > 0) {
                        handleSelectSymbol(searchResults[0].ticker);
                      } else if (symbolModalFilter.trim()) {
                        handleSelectSymbol(symbolModalFilter.trim());
                      }
                    }
                  }}
                />
                {symbolModalFilter && (
                  <button
                    onClick={() => setSymbolModalFilter('')}
                    style={{
                      position: 'absolute', right: 8, top: 7,
                      background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer'
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Search Results / Suggestions List */}
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {isSearching && (
                  <div style={{ padding: '8px 12px', fontSize: '0.72rem', color: '#818CF8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="spinner" style={{ width: 12, height: 12 }} /> Searching NSE Universe...
                  </div>
                )}

                {/* If user typed a search query, show live server search suggestions */}
                {symbolModalFilter.trim() && Array.isArray(searchResults) && searchResults.length > 0 && (
                  searchResults.map((item) => (
                    <div
                      key={item.ticker}
                      onClick={() => handleSelectSymbol(item.ticker)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        fontSize: '0.76rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        backgroundColor: selectedSymbol === item.ticker ? 'rgba(99,102,241,0.18)' : 'transparent',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.14)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSymbol === item.ticker ? 'rgba(99,102,241,0.18)' : 'transparent'}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
                          {item.ticker}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94A3B8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', color: '#64748B' }}>
                        {item.exchange || 'NSE'}
                      </span>
                    </div>
                  ))
                )}

                {/* Fallback to popular stocks list when search query is empty or no server results */}
                {(!symbolModalFilter.trim() || (searchResults.length === 0 && !isSearching)) && (
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, padding: '4px 8px', letterSpacing: '0.05em' }}>
                      POPULAR NSE TICKERS
                    </div>
                    {POPULAR_STOCKS
                      .filter((s) => !symbolModalFilter || s.toLowerCase().includes(symbolModalFilter.toLowerCase()))
                      .map((sym) => (
                        <div
                          key={sym}
                          onClick={() => handleSelectSymbol(sym)}
                          style={{
                            padding: '7px 10px',
                            borderRadius: 4,
                            fontSize: '0.75rem',
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
                          <span style={{ fontSize: '0.65rem', color: '#64748B' }}>NSE</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

        {/* Dual Engine Switcher: TradingView Full Heavy Engine vs StockOracle AI Engine */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.95)',
          padding: '2px',
          borderRadius: 6,
          border: '1px solid rgba(99, 102, 241, 0.3)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          <button
            type="button"
            onClick={() => {
              setChartEngine('tradingview');
              localStorage.setItem('stockoracle_chart_engine', 'tradingview');
              toast.success('🚀 Switched to TradingView Full Engine (100+ Indicators, 80+ Drawing Tools)');
            }}
            style={{
              padding: '3px 9px',
              borderRadius: 4,
              border: 'none',
              background: chartEngine === 'tradingview' ? 'linear-gradient(135deg, #2563EB, #4F46E5)' : 'transparent',
              color: chartEngine === 'tradingview' ? '#FFFFFF' : '#94A3B8',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: chartEngine === 'tradingview' ? '0 2px 8px rgba(37,99,235,0.4)' : 'none',
            }}
            title="Full TradingView Engine (80+ Drawing Tools, 100+ Built-in Indicators)"
          >
            <span>🔥 TV Full Engine</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setChartEngine('stockoracle');
              localStorage.setItem('stockoracle_chart_engine', 'stockoracle');
              handleIntervalChange('1d');
              toast.success('⚡ Switched to StockOracle AI & SMC Terminal Engine (1D Candles)');
            }}
            style={{
              padding: '3px 9px',
              borderRadius: 4,
              border: 'none',
              background: chartEngine === 'stockoracle' ? 'linear-gradient(135deg, #A855F7, #6366F1)' : 'transparent',
              color: chartEngine === 'stockoracle' ? '#FFFFFF' : '#94A3B8',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: chartEngine === 'stockoracle' ? '0 2px 8px rgba(168,85,247,0.4)' : 'none',
            }}
            title="StockOracle AI Engine (SMC, Order Flow, Volume Profile, AI Forecasts)"
          >
            <span>⚡ AI / SMC Engine</span>
          </button>
        </div>

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

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
            onChange={(e) => handleIntervalChange(e.target.value)}
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
            title="Candle Interval Timeframe (1m, 5m, 15m, 1H, 1D)"
          >
            {INTERVALS.map(iv => (
              <option key={iv.value} value={iv.value} style={{ background: '#0B0F1C', color: '#E2E8F0' }}>
                {iv.label}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe Dropdown (1M, 3M, 6M, 1Y, 2Y, 5Y) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.28)',
          borderRadius: 5,
          padding: '2px 7px',
          height: 25,
        }}>
          <Calendar size={12} style={{ color: '#10B981', flexShrink: 0 }} />
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            style={{
              background: 'transparent',
              color: '#10B981',
              border: 'none',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'JetBrains Mono, monospace',
              padding: 0,
            }}
            title="Timeframe Range (1M, 3M, 6M, 1Y, 2Y, 5Y)"
          >
            {['1M', '3M', '6M', '1Y', '2Y', '5Y'].map(tf => (
              <option key={tf} value={tf} style={{ background: '#0B0F1C', color: '#E2E8F0' }}>
                {tf}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Replay, Alert, Indicators, Settings, Grid Switcher, Snapshot, Fullscreen */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink: 0 }}>
        {/* Historical Bar Replay Simulator Toggle */}
        <button
          onClick={() => {
            const nextState = !isReplayMode;
            setIsReplayMode(nextState);
            if (nextState) {
              setChartEngine('stockoracle');
              localStorage.setItem('stockoracle_chart_engine', 'stockoracle');
              const startIdx = Math.max(5, (rawHistory?.length || 100) - 60);
              setReplayIndex(startIdx);
              setIsReplayPlaying(true);
              toast.success('▶️ Auto-Play Bar Replay Mode Started!');
            } else {
              setIsReplayPlaying(false);
              toast.success('Exited Bar Replay Mode');
            }
          }}
          title="Historical Bar Replay Simulator — Watch Candles Form Live"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 4,
            border: isReplayMode ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
            background: isReplayMode ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
            color: isReplayMode ? '#818CF8' : '#CBD5E1',
            fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
          }}
        >
          <RotateCcw size={12} style={{ color: '#818CF8' }} className={isReplayMode && isReplayPlaying ? 'broker-spin' : ''} />
          <span>Replay</span>
        </button>

        {/* Indicators Modal Button */}
        <button
          onClick={() => setShowIndicatorsModal(true)}
          title="Indicators, metrics, and strategies"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 9px',
            borderRadius: 5,
            border: showIndicatorsModal ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.08)',
            background: showIndicatorsModal ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
            color: showIndicatorsModal ? '#818CF8' : '#E2E8F0',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Activity size={13} style={{ color: '#818CF8' }} />
          <span>Indicators</span>
          {activeIndicatorsCount > 0 && (
            <span style={{ backgroundColor: '#6366F1', color: '#fff', fontSize: '0.62rem', padding: '1px 5px', borderRadius: 10, fontWeight: 800 }}>
              {activeIndicatorsCount}
            </span>
          )}
        </button>

        {/* Indicator Parameters Settings Button */}
        <button
          onClick={() => setShowIndicatorSettingsModal(true)}
          title="Configure Indicator Periods & Inputs (SMA, EMA, BB, RSI, MACD)"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 7px',
            borderRadius: 5,
            border: showIndicatorSettingsModal ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.08)',
            background: showIndicatorSettingsModal ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
            color: '#818CF8',
            cursor: 'pointer',
          }}
        >
          <Sliders size={13} />
        </button>

        {/* TradingView Multi-Chart Layout Switcher [ 1x1 | 1x2 | 2x1 | 2x2 ] */}
        <div style={{ display:'flex', alignItems:'center', gap:2, background:'rgba(255,255,255,0.03)', padding:'2px', borderRadius:5, border:'1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setChartLayout('1x1')}
            title="Single Chart (1x1)"
            style={{
              padding:'3px 6px',
              borderRadius:3,
              border:'none',
              background: chartLayout === '1x1' ? '#6366F1' : 'transparent',
              color: chartLayout === '1x1' ? '#fff' : '#64748B',
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
            }}
          >
            <Square size={13} />
          </button>
          <button
            onClick={() => setChartLayout('1x2')}
            title="Side-by-Side (1x2)"
            style={{
              padding:'3px 6px',
              borderRadius:3,
              border:'none',
              background: chartLayout === '1x2' ? '#6366F1' : 'transparent',
              color: chartLayout === '1x2' ? '#fff' : '#64748B',
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
            }}
          >
            <Columns size={13} />
          </button>
          <button
            onClick={() => setChartLayout('2x1')}
            title="Stacked (2x1)"
            style={{
              padding:'3px 6px',
              borderRadius:3,
              border:'none',
              background: chartLayout === '2x1' ? '#6366F1' : 'transparent',
              color: chartLayout === '2x1' ? '#fff' : '#64748B',
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
            }}
          >
            <Rows size={13} />
          </button>
          <button
            onClick={() => setChartLayout('2x2')}
            title="Quad Grid (2x2)"
            style={{
              padding:'3px 6px',
              borderRadius:3,
              border:'none',
              background: chartLayout === '2x2' ? '#6366F1' : 'transparent',
              color: chartLayout === '2x2' ? '#fff' : '#64748B',
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
            }}
          >
            <Grid2X2 size={13} />
          </button>
        </div>

        {/* Snapshot Camera */}
        <button
          onClick={handleSnapshot}
          title="Download Snapshot"
          style={{ padding:'4px 6px', borderRadius:5, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'#94A3B8', cursor:'pointer' }}
        >
          <Camera size={13} />
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          title="Fullscreen Chart"
          style={{ padding:'4px 6px', borderRadius:5, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'#94A3B8', cursor:'pointer' }}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </div>
  );
}
