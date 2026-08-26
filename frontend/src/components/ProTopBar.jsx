import React, { useState, useEffect, useRef } from 'react';
import { Menu, Zap, Sun, Moon, Maximize2, Minimize2, Search } from 'lucide-react';
import useStore from '../store/useStore';

export default function ProTopBar({ onToggleSidebar, onToggleRight, onOpenCommandPalette }) {
  const { selectedSymbol, theme, setTheme } = useStore();
  const [nifty, setNifty] = useState(null);
  const [sensex, setSensex] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const nRes = await fetch('/api/stock/NIFTY50/info');
        if (nRes.ok) setNifty(await nRes.json());
        const sRes = await fetch('/api/stock/SENSEX/info');
        if (sRes.ok) setSensex(await sRes.json());
      } catch (err) {
        console.error('Error fetching indices', err);
      }
    };
    fetchIndices();
    const int = setInterval(fetchIndices, 60000);
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 15, width: '300px' }}>
        <button onClick={onToggleSidebar} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
          <Menu size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '1rem', color: '#F0F0FF' }}>
          <Zap size={18} color="#6366F1" fill="#6366F1" />
          <span>StockOracle Pro</span>
        </div>
        <div style={{ background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', color: '#818CF8', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
          NSE:{selectedSymbol}
        </div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 240 }} ref={searchRef}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
          <input
            className="pro-search-input"
            type="text"
            placeholder="Search symbol..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 30px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: '0.8rem', outline: 'none' }}
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 15, width: '300px', justifyContent: 'flex-end' }}>
        {nifty && <div style={{ fontSize: '0.75rem', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: '#9CA3AF' }}>NIFTY</span>
          <span style={{ fontWeight: 600, color: '#F0F0FF' }}>{nifty.price?.toFixed(2)}</span>
          <span style={{ color: nifty.change > 0 ? '#10B981' : '#F43F5E' }}>{nifty.change > 0 ? '▲' : '▼'}{Math.abs(nifty.changePercent || 0).toFixed(2)}%</span>
        </div>}
        {sensex && <div style={{ fontSize: '0.75rem', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: '#9CA3AF' }}>SENSEX</span>
          <span style={{ fontWeight: 600, color: '#F0F0FF' }}>{sensex.price?.toFixed(2)}</span>
          <span style={{ color: sensex.change > 0 ? '#10B981' : '#F43F5E' }}>{sensex.change > 0 ? '▲' : '▼'}{Math.abs(sensex.changePercent || 0).toFixed(2)}%</span>
        </div>}
        
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
