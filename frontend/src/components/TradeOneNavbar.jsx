import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import { 
  Search, Sun, Moon, Bell, Maximize2, Minimize2, 
  ChevronDown, LayoutDashboard, CandlestickChart, BrainCircuit,
  SlidersHorizontal, Grid3X3, Brain, Globe, GitFork, RefreshCw, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TradeOneNavbar({ onToggleWatchlist, showWatchlist }) {
  const { activeView, setActiveView, selectedSymbol, setSelectedSymbol, theme, setTheme } = useStore();
  const { searchStocks } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const searchDropdownRef = useRef(null);

  // Keyboard shortcut Ctrl+K to focus search
  const searchInputRef = useRef(null);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search autocomplete
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await searchStocks(searchQuery.trim());
        setSearchResults(data || []);
        setShowSearchDropdown(true);
      } catch {
        setSearchResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, searchStocks]);

  // Click outside to close search
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectStock = (ticker) => {
    setSelectedSymbol(ticker.toUpperCase());
    setSearchQuery('');
    setShowSearchDropdown(false);
    toast.success(`Loaded ${ticker.toUpperCase()}`);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const isDark = theme !== 'light';

  // Navigation tabs matching Angel One TradeOne header
  const NAV_TABS = [
    { name: 'Live Chart',    label: 'TradeOne' },
    { name: 'Dashboard',     label: 'Dashboard' },
    { name: 'AI Prediction', label: 'AI Forecast' },
    { name: 'Adv. Screener', label: 'Screener' },
    { name: 'Heatmap',       label: 'Heatmap' },
    { name: 'Sentiment',     label: 'Sentiment' },
    { name: 'Macro Data',    label: 'Macro' },
    { name: 'Supply Chain',  label: 'Supply Chain' },
  ];

  return (
    <header style={{
      height: '56px',
      backgroundColor: isDark ? '#0A0D1A' : '#ffffff',
      borderBottom: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      userSelect: 'none',
    }}>
      {/* ── Left Brand & Major Indices Ribbon ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexShrink: 0 }}>
        {/* Angel One style brand icon */}
        <div 
          onClick={() => setActiveView('Live Chart')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(59,130,246,0.4)',
          }}>
            <Zap size={16} color="#fff" />
          </div>
          <span style={{
            fontFamily: 'Space Grotesk, Inter, sans-serif',
            fontWeight: 800,
            fontSize: '1rem',
            color: isDark ? '#F0F0FF' : '#0F172A',
            letterSpacing: '-0.02em',
          }}>
            StockOracle
          </span>
        </div>

        {/* Live Indices Ticker: NIFTY & SENSEX */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          borderLeft: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
          paddingLeft: '16px',
        }}>
          {/* NIFTY */}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, color: isDark ? '#9CA3AF' : '#64748B' }}>NIFTY</span>
              <span style={{ fontWeight: 800, color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>24,366.00</span>
              <span style={{ color: '#EF5350', fontSize: '0.66rem', fontWeight: 600 }}>▼ -29.85 (-0.12%)</span>
            </div>
          </div>

          {/* SENSEX / BANKNIFTY */}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, color: isDark ? '#9CA3AF' : '#64748B' }}>SENSEX</span>
              <span style={{ fontWeight: 800, color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>78,009.25</span>
              <span style={{ color: '#EF5350', fontSize: '0.66rem', fontWeight: 600 }}>▼ -70.71 (-0.09%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Center Search Bar: Search for Anything [Ctrl+K] ── */}
      <div ref={searchDropdownRef} style={{ position: 'relative', width: '300px', flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: isDark ? '#121626' : '#F1F5F9',
          border: isDark ? '1px solid #232942' : '1px solid #CBD5E1',
          borderRadius: '8px',
          padding: '6px 12px',
          gap: '8px',
        }}>
          <Search size={14} style={{ color: '#818CF8' }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search for Anything [Ctrl + K]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: isDark ? '#F0F0FF' : '#0F172A',
              fontSize: '0.8rem',
              width: '100%',
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </div>

        {/* Autocomplete Dropdown */}
        {showSearchDropdown && searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            backgroundColor: isDark ? '#0F172A' : '#ffffff',
            border: isDark ? '1px solid #232942' : '1px solid #E2E8F0',
            borderRadius: '8px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 200,
            boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
          }}>
            {searchResults.map((item) => (
              <div
                key={item.ticker}
                onClick={() => handleSelectStock(item.ticker)}
                style={{
                  padding: '9px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderBottom: isDark ? '1px solid #1E293B' : '1px solid #F1F5F9',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#1E293B' : '#F1F5F9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#3B82F6', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>
                    {item.ticker}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: isDark ? '#94A3B8' : '#64748B', marginLeft: '8px' }}>
                    {item.name}
                  </span>
                </div>
                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: isDark ? '#1E293B' : '#E2E8F0', color: '#64748B' }}>
                  {item.exchange || 'NSE'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Navigation Tabs ── */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {NAV_TABS.map((tab) => {
          const isActive = activeView === tab.name;
          return (
            <button
              key={tab.name}
              onClick={() => setActiveView(tab.name)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isActive ? (isDark ? 'rgba(59,130,246,0.18)' : '#EFF6FF') : 'transparent',
                color: isActive ? '#3B82F6' : (isDark ? '#94A3B8' : '#64748B'),
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ── Right Actions (Theme, Notification, Fullscreen, Profile) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Watchlist Toggle Button */}
        <button
          onClick={onToggleWatchlist}
          title="Toggle Left Watchlist Drawer"
          style={{
            padding: '5px 10px',
            borderRadius: '6px',
            border: `1px solid ${showWatchlist ? '#3B82F6' : (isDark ? '#232942' : '#CBD5E1')}`,
            backgroundColor: showWatchlist ? (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF') : 'transparent',
            color: showWatchlist ? '#3B82F6' : (isDark ? '#94A3B8' : '#64748B'),
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {showWatchlist ? 'Hide Watchlist' : 'Show Watchlist'}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          title={isDark ? 'Light Theme' : 'Dark Theme'}
          style={{
            background: 'transparent',
            border: isDark ? '1px solid #232942' : '1px solid #CBD5E1',
            borderRadius: '6px',
            cursor: 'pointer',
            color: isDark ? '#94A3B8' : '#64748B',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
          style={{
            background: 'transparent',
            border: isDark ? '1px solid #232942' : '1px solid #CBD5E1',
            borderRadius: '6px',
            cursor: 'pointer',
            color: isDark ? '#94A3B8' : '#64748B',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* User Profile Avatar */}
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: '#3B82F6',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 800,
          cursor: 'pointer',
        }}>
          SO
        </div>
      </div>
    </header>
  );
}
