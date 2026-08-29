import React, { useState, useEffect, useRef } from 'react';
import { Menu, Zap, Sun, Moon, Maximize2, Minimize2, Search, Bookmark, TrendingUp, TrendingDown } from 'lucide-react';
import useStore from '../store/useStore';
import api from '../utils/api';

const DEFAULT_INDICES = [
  { symbol: 'NIFTY 50', price: 24852.4, change_pct: 0.42 },
  { symbol: 'SENSEX', price: 81340.2, change_pct: 0.38 },
  { symbol: 'BANK NIFTY', price: 53210.5, change_pct: 0.65 },
  { symbol: 'RELIANCE', price: 1317.0, change_pct: 0.36 },
  { symbol: 'TCS', price: 2296.2, change_pct: 0.53 },
  { symbol: 'HDFCBANK', price: 1642.5, change_pct: 0.85 },
  { symbol: 'INFY', price: 1845.0, change_pct: -0.42 },
  { symbol: 'ICICIBANK', price: 1198.0, change_pct: 1.12 },
  { symbol: 'SBIN', price: 824.5, change_pct: 0.74 },
  { symbol: 'BHARTIARTL', price: 1542.0, change_pct: 1.35 },
  { symbol: 'ITC', price: 495.2, change_pct: -0.15 },
  { symbol: 'WIPRO', price: 512.0, change_pct: 0.28 },
  { symbol: 'INDIA VIX', price: 12.84, change_pct: -3.20 },
  { symbol: 'USD / INR', price: 83.92, change_pct: -0.05 },
  { symbol: 'BRENT CRUDE', price: 78.45, change_pct: -1.15 },
];

export default function ProTopBar({ onToggleSidebar, onToggleRight, onOpenCommandPalette }) {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const [indices, setIndices] = useState(DEFAULT_INDICES);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const searchRef = useRef(null);

  // Fetch tape data
  useEffect(() => {
    const fetchTape = async () => {
      try {
        const { data } = await api.get('/api/terminal/ticker-tape');
        if (Array.isArray(data.indices) && data.indices.length > 0) {
          const merged = data.indices.map((item, i) => {
            const def = DEFAULT_INDICES.find(d => d.symbol === item.symbol) || DEFAULT_INDICES[i] || {};
            return {
              ...def,
              ...item,
              price: item.price != null && item.price > 0 ? item.price : def.price,
              change_pct: item.change_pct != null ? item.change_pct : def.change_pct,
            };
          });
          setIndices(merged);
        }
      } catch {}
    };
    fetchTape();
    const interval = setInterval(fetchTape, 25000);
    return () => clearInterval(interval);
  }, []);

  // Symbol Search
  useEffect(() => {
    if (query.length > 1) {
      const fetchSearch = async () => {
        try {
          const { data } = await api.get('/api/stocks/search', { params: { query } });
          setResults(data.results || data || []);
        } catch (e) {}
      };
      const to = setTimeout(fetchSearch, 300);
      return () => clearTimeout(to);
    } else {
      setResults([]);
    }
  }, [query]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleSelectResult = (ticker) => {
    useStore.getState().setSelectedSymbol(ticker);
    setQuery('');
    setResults([]);
  };

  const tapeItems = [...indices, ...indices];

  return (
    <div className="pro-top-bar" style={{ display: 'flex', alignItems: 'center', height: '42px', padding: '0 12px', gap: '10px', background: '#050713', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes topbar-marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .topbar-marquee-track {
          display: flex;
          align-items: center;
          white-space: nowrap;
          will-change: transform;
          animation: topbar-marquee 35s linear infinite;
        }
        .topbar-marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Left: Brand + Active Symbol + Quick Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onToggleSidebar} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex', padding: 2 }}>
          <Menu size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.88rem', color: '#F0F0FF', letterSpacing: '-0.01em' }}>
          <Zap size={16} color="#6366F1" fill="#6366F1" />
          <span>StockOracle Pro</span>
        </div>
        <div style={{ background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.3)', padding: '2px 7px', borderRadius: 4, fontSize: '0.66rem', color: '#818CF8', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
          NSE:{selectedSymbol}
        </div>

        {/* Compact Search Input */}
        <div style={{ position: 'relative', width: 140 }} ref={searchRef}>
          <Search size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
          <input
            type="text"
            placeholder="Search symbol..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', padding: '3px 6px 3px 22px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, color: '#fff', fontSize: '0.72rem', outline: 'none' }}
          />
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, width: 220, background: '#0C1022', border: '1px solid #1E293B', borderRadius: 6, marginTop: 4, zIndex: 1000, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.8)' }}>
              {results.slice(0, 8).map((r, i) => (
                <div key={i} onClick={() => handleSelectResult(r.symbol || r.ticker)} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, color: '#818CF8', fontSize: '0.75rem' }}>{r.symbol || r.ticker}</span>
                  <span style={{ color: '#9CA3AF', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{r.name || r.companyName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Infinite Seamless Running Marquee Ticker */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%', display: 'flex', alignItems: 'center', margin: '0 8px' }}>
        {/* Subtle Fade Edges */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 20, background: 'linear-gradient(90deg, #050713, transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 20, background: 'linear-gradient(270deg, #050713, transparent)', zIndex: 2, pointerEvents: 'none' }} />

        <div className="topbar-marquee-track">
          {tapeItems.map((item, idx) => {
            const price = Number(item.price || 0);
            const changePct = Number(item.change_pct || 0);
            const isUp = changePct >= 0;
            return (
              <div
                key={idx}
                onClick={() => {
                  if (item.symbol && !item.symbol.includes('/') && !item.symbol.includes('VIX') && !item.symbol.includes('CRUDE')) {
                    useStore.getState().setSelectedSymbol(item.symbol.replace(/\s+/g, ''));
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 14px',
                  fontSize: '0.68rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <span style={{ color: '#94A3B8', fontWeight: 600 }}>{item.symbol}</span>
                <span style={{ fontWeight: 700, color: '#F1F5F9' }}>
                  {price >= 100 ? price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : price.toFixed(2)}
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  color: isUp ? '#10B981' : '#EF4444',
                  fontWeight: 700,
                  fontSize: '0.63rem'
                }}>
                  {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {isUp ? '+' : ''}{changePct.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex', padding: 3 }}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button onClick={toggleFullscreen} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex', padding: 3 }}>
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        <button onClick={onOpenCommandPalette} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '3px 7px', borderRadius: 4, color: '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem' }}>
          <Search size={11} /> ⌘K
        </button>
        <button
          onClick={onToggleRight}
          title="Toggle Watchlist & AI Copilot"
          style={{
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 6,
            padding: '3px 8px',
            color: '#818CF8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.7rem',
            fontWeight: 700
          }}
        >
          <Bookmark size={12} /> Watchlist
        </button>
      </div>
    </div>
  );
}
