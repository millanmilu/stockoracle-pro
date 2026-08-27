import React, { useState, useEffect, useRef } from 'react';
import { Menu, Zap, Sun, Moon, Maximize2, Minimize2, Search } from 'lucide-react';
import useStore from '../store/useStore';

export default function ProTopBar({ onToggleSidebar, onToggleRight, onOpenCommandPalette }) {
  const { selectedSymbol, theme, setTheme } = useStore();
  const [nifty, setNifty] = useState({ price: 24852.40, change: 104.20, changePercent: 0.42 });
  const [sensex, setSensex] = useState({ price: 81340.20, change: 308.10, changePercent: 0.38 });
  const [bankNifty, setBankNifty] = useState({ price: 53210.50, change: 345.80, changePercent: 0.65 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const [nRes, sRes, bRes] = await Promise.allSettled([
          fetch('/api/stock/NIFTY50/info').then(r => r.ok ? r.json() : null),
          fetch('/api/stock/SENSEX/info').then(r => r.ok ? r.json() : null),
          fetch('/api/stock/BANKNIFTY/info').then(r => r.ok ? r.json() : null),
        ]);
        if (nRes.status === 'fulfilled' && nRes.value && (nRes.value.price || nRes.value.current_price)) {
          setNifty(nRes.value);
        }
        if (sRes.status === 'fulfilled' && sRes.value && (sRes.value.price || sRes.value.current_price)) {
          setSensex(sRes.value);
        }
        if (bRes.status === 'fulfilled' && bRes.value && (bRes.value.price || bRes.value.current_price)) {
          setBankNifty(bRes.value);
        }
      } catch (err) {
        console.error('Error fetching indices', err);
      }
    };
    fetchIndices();
    const int = setInterval(fetchIndices, 30000);
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    if (query.length > 1) {
      const fetchSearch = async () => {
        try {
          const res = await fetch(`/api/market/search?q=${query}`);
          if (res.ok) {
            const data = await res.json();
            setResults(data.results || data);
          }
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
      document.documentElement.requestFullscreen().catch(e => {});
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

  return (
    <div className="pro-top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: '260px' }}>
        <button onClick={onToggleSidebar} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
          <Menu size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.95rem', color: '#F0F0FF' }}>
          <Zap size={18} color="#6366F1" fill="#6366F1" />
          <span>StockOracle Pro</span>
        </div>
        <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', color: '#818CF8', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
          NSE:{selectedSymbol}
        </div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 220 }} ref={searchRef}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
          <input
            className="pro-search-input"
            type="text"
            placeholder="Search symbol (Ctrl+K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', padding: '5px 10px 5px 28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: '0.78rem', outline: 'none' }}
          />
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0C1022', border: '1px solid #1E293B', borderRadius: 6, marginTop: 4, zIndex: 1000, overflow: 'hidden' }}>
              {results.map((r, i) => (
                <div key={i} onClick={() => handleSelectResult(r.symbol || r.ticker)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #1E293B', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: '#818CF8', fontSize: '0.8rem' }}>{r.symbol || r.ticker}</span>
                  <span style={{ color: '#9CA3AF', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{r.name || r.companyName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-end' }}>
        {nifty && (
          <div style={{ fontSize: '0.73rem', display: 'flex', gap: 5, alignItems: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ color: '#9CA3AF', fontWeight: 600 }}>NIFTY</span>
            <span style={{ fontWeight: 700, color: '#F0F0FF' }}>{Number(nifty.price ?? nifty.current_price ?? 24852.4).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span style={{ color: (nifty.change ?? nifty.changePercent ?? 0) >= 0 ? '#10B981' : '#F43F5E', fontWeight: 600, fontSize: '0.67rem' }}>
              {(nifty.change ?? nifty.changePercent ?? 0) >= 0 ? '▲' : '▼'}{Math.abs(nifty.changePercent ?? nifty.change_pct ?? 0.42).toFixed(2)}%
            </span>
          </div>
        )}
        {bankNifty && (
          <div style={{ fontSize: '0.73rem', display: 'flex', gap: 5, alignItems: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ color: '#9CA3AF', fontWeight: 600 }}>BANKNIFTY</span>
            <span style={{ fontWeight: 700, color: '#F0F0FF' }}>{Number(bankNifty.price ?? bankNifty.current_price ?? 53210.5).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span style={{ color: (bankNifty.change ?? bankNifty.changePercent ?? 0) >= 0 ? '#10B981' : '#F43F5E', fontWeight: 600, fontSize: '0.67rem' }}>
              {(bankNifty.change ?? bankNifty.changePercent ?? 0) >= 0 ? '▲' : '▼'}{Math.abs(bankNifty.changePercent ?? bankNifty.change_pct ?? 0.65).toFixed(2)}%
            </span>
          </div>
        )}
        {sensex && (
          <div style={{ fontSize: '0.73rem', display: 'flex', gap: 5, alignItems: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ color: '#9CA3AF', fontWeight: 600 }}>SENSEX</span>
            <span style={{ fontWeight: 700, color: '#F0F0FF' }}>{Number(sensex.price ?? sensex.current_price ?? 81340.2).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span style={{ color: (sensex.change ?? sensex.changePercent ?? 0) >= 0 ? '#10B981' : '#F43F5E', fontWeight: 600, fontSize: '0.67rem' }}>
              {(sensex.change ?? sensex.changePercent ?? 0) >= 0 ? '▲' : '▼'}{Math.abs(sensex.changePercent ?? sensex.change_pct ?? 0.38).toFixed(2)}%
            </span>
          </div>
        )}
        
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button onClick={toggleFullscreen} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button onClick={onOpenCommandPalette} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 4, color: '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem' }}>
          <Search size={12} /> ⌘K
        </button>
        <button onClick={onToggleRight} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
          <Menu size={20} />
        </button>
      </div>
    </div>
  );
}
