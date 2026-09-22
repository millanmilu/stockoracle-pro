import React, { useState, useEffect, useRef } from 'react';
import { Menu, Zap, Maximize2, Minimize2, Search, Bookmark, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import useStore from '../store/useStore';
import ThemeToggle from './ThemeToggle';
import { getThemeTokens } from '../utils/theme';
import { isGoldSymbol, isCryptoSymbol } from '../utils/chartHelpers';
import api from '../utils/api';

// Baseline skeleton — price: null + UNAVAILABLE until the first tape fetch
// resolves. Hardcoded numbers must NEVER be shown as live market data
// (backend contract: "never fake prices"; AGENTS.md §4 No Fake Hardcoded Rates).
const BASELINE_TAPE_ITEMS = [
  { symbol: 'BTC', name: 'Bitcoin (USD)', price: null, change_pct: null, status: 'UNAVAILABLE', target_symbol: 'BTC' },
  { symbol: 'GOLD', name: 'Gold Spot (USD)', price: null, change_pct: null, status: 'UNAVAILABLE', target_symbol: 'XAUUSD' },
  { symbol: 'NIFTY 50', name: 'NSE Benchmark', price: null, change_pct: null, status: 'UNAVAILABLE', target_symbol: 'NIFTY50' },
  { symbol: 'BANK NIFTY', name: 'Banking Index', price: null, change_pct: null, status: 'UNAVAILABLE', target_symbol: 'BANKNIFTY' },
  { symbol: 'INDIA VIX', name: 'Volatility Index', price: null, change_pct: null, status: 'UNAVAILABLE' },
  { symbol: 'USD / INR', name: 'Forex', price: null, change_pct: null, status: 'UNAVAILABLE' },
  { symbol: 'BRENT CRUDE', name: 'Commodity ($)', price: null, change_pct: null, status: 'UNAVAILABLE' },
];

export default function ProTopBar({ onToggleSidebar, onToggleRight, onOpenCommandPalette }) {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  // No whole-store livePrices subscription here — that re-rendered the entire
  // topbar on every tick (BTC dozens/sec). Tape only needs a 1s snapshot of
  // the symbols it actually displays (see liveSnapshot effect below).
  const theme = useStore(s => s.theme);
  const tk = getThemeTokens(theme);
  const [indices, setIndices] = useState(() => BASELINE_TAPE_ITEMS);
  const [tapeUnavailable, setTapeUnavailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Mobile layout (<=640px): badge + marquee collapse, search goes fluid.
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const searchRef = useRef(null);

  // Click outside listener for search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch tape data — backend always ships BTC/GOLD rows (LIVE when verified,
  // STATIC reference or UNAVAILABLE otherwise), so no client-side injection.
  // Outage state is flagged via tapeUnavailable instead of faking prices.
  useEffect(() => {
    let isMounted = true;
    const fetchTape = async () => {
      try {
        const { data } = await api.get('/api/terminal/ticker-tape');
        if (!isMounted) return;
        if (Array.isArray(data.indices) && data.indices.length > 0) {
          const items = data.indices.filter(it => !String(it.symbol || '').toUpperCase().includes('SENSEX'));
          setIndices(items.length > 0 ? items : data.indices);
          setTapeUnavailable(data.source === 'unavailable');
        } else {
          setTapeUnavailable(true);
        }
      } catch {
        // Keep last good rows; flag the outage instead of faking prices.
        if (isMounted) setTapeUnavailable(true);
      }
    };
    fetchTape();
    const interval = setInterval(fetchTape, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 1s live snapshot for tape symbols only (render-cheap: re-renders at most
  // 1/sec and only when a displayed symbol's tick object actually changed).
  const [liveSnapshot, setLiveSnapshot] = useState({});
  useEffect(() => {
    const wanted = new Set(['XAUUSD']);
    indices.forEach((it) => {
      for (const k of [it?.target_symbol, it?.targetSymbol, it?.symbol]) {
        const s = String(k || '').toUpperCase().trim();
        if (s) wanted.add(s);
      }
    });
    const pull = () => {
      try {
        const lp = useStore.getState().livePrices || {};
        const next = {};
        wanted.forEach((k) => { if (lp[k]) next[k] = lp[k]; });
        setLiveSnapshot((prev) => {
          const pk = Object.keys(prev);
          if (pk.length === Object.keys(next).length && pk.every((k) => prev[k] === next[k])) return prev;
          return next;
        });
      } catch {}
    };
    pull();
    const id = setInterval(pull, 1000);
    return () => clearInterval(id);
  }, [indices]);

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
    if (!ticker) return;
    const clean = String(ticker).toUpperCase().trim();
    useStore.getState().setSelectedSymbol(clean);
    useStore.getState().setActiveView?.('Live Chart');
    setQuery('');
    setResults([]);
  };

  const handleTapeItemClick = (item) => {
    let raw = item?.target_symbol || item?.targetSymbol || item?.symbol;
    if (!raw) return;
    const clean = String(raw).toUpperCase().trim();
    let ticker = clean;
    if (clean === 'GOLD' || clean === 'XAU' || clean === 'XAUUSD') {
      ticker = 'XAUUSD';
    } else if (clean === 'BTC' || clean === 'BITCOIN' || clean === 'BTC/USD') {
      ticker = 'BTC';
    } else if (clean === 'NIFTY50' || clean === 'NIFTY 50' || clean === 'NIFTY') {
      // NIFTY50 has no stock_universe token (verified: token None) — selecting
      // it blanks the chart (404/503) and wastes backend WS cycles. Never
      // navigate there from the tape.
      return;
    } else if (clean === 'BANK NIFTY') {
      ticker = 'BANKNIFTY';
    } else if (clean.includes('VIX') || clean.includes('CRUDE') || clean.includes('/')) {
      return;
    }
    useStore.getState().setSelectedSymbol(ticker);
    useStore.getState().setActiveView?.('Live Chart');
  };

  const tapeItems = indices.length > 0 ? [...indices, ...indices] : [];

  return (
    <div
      className="pro-top-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '42px',
        padding: '0 12px',
        gap: '10px',
        background: tk.topbarBg,
        borderBottom: `1px solid ${tk.topbarBorder}`,
        position: 'relative',
        overflow: 'visible',
        zIndex: 100
      }}
    >
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
        .topbar-tape-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 2px 10px;
          margin: 0 4px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.09);
          font-size: 0.68rem;
          font-family: 'JetBrains Mono', monospace;
          cursor: pointer;
          user-select: none;
          transition: all 0.15s ease;
        }
        .topbar-tape-chip:hover {
          background: rgba(99, 102, 241, 0.16) !important;
          border-color: rgba(99, 102, 241, 0.5) !important;
          transform: translateY(-1px);
        }
        [data-theme="light"] .topbar-tape-chip {
          background: rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.12);
        }
        [data-theme="light"] .topbar-tape-chip:hover {
          background: rgba(99, 102, 241, 0.1) !important;
          border-color: rgba(99, 102, 241, 0.4) !important;
        }
      `}</style>

      {/* Left: Brand + Active Symbol + Quick Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, flexShrink: 1, minWidth: 0, position: 'relative', zIndex: 110 }}>
        <button onClick={onToggleSidebar} style={{ background: 'transparent', border: 'none', color: tk.topbarMuted, cursor: 'pointer', display: 'flex', padding: 2, flexShrink: 0 }}>
          <Menu size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.88rem', color: tk.topbarText, letterSpacing: '-0.01em', flexShrink: 0 }}>
          <Zap size={16} color="#6366F1" fill="#6366F1" />
          {!isMobile && <span>StockOracle Pro</span>}
        </div>
        {!isMobile && (
        <div style={{
          background: isGoldSymbol(selectedSymbol) ? 'rgba(250,204,21,0.14)' : (isCryptoSymbol(selectedSymbol) ? 'rgba(245,158,11,0.14)' : 'rgba(99,102,241,0.14)'),
          border: `1px solid ${isGoldSymbol(selectedSymbol) ? 'rgba(250,204,21,0.35)' : (isCryptoSymbol(selectedSymbol) ? 'rgba(245,158,11,0.35)' : 'rgba(99,102,241,0.3)')}`,
          padding: '2px 7px',
          borderRadius: 4,
          fontSize: '0.66rem',
          color: isGoldSymbol(selectedSymbol) ? '#FACC15' : (isCryptoSymbol(selectedSymbol) ? '#F59E0B' : '#818CF8'),
          fontWeight: 800,
          fontFamily: 'JetBrains Mono, monospace',
          flexShrink: 0
        }}>
          {isGoldSymbol(selectedSymbol) ? 'COM:XAUUSD' : (isCryptoSymbol(selectedSymbol) ? `CRYPTO:${selectedSymbol}` : `NSE:${selectedSymbol}`)}
        </div>
        )}

        {/* Compact Search Input — fluid on mobile so it never gets pushed out */}
        <div style={{ position: 'relative', width: isMobile ? undefined : 145, flex: isMobile ? '1 1 auto' : undefined, minWidth: 0 }} ref={searchRef}>
          <Search size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: tk.topbarMuted }} />
          <input
            type="text"
            placeholder="Search symbol..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', padding: '4px 6px 4px 22px', background: tk.inputBg, border: `1px solid ${tk.inputBorder}`, borderRadius: 6, color: tk.inputText, fontSize: '0.72rem', outline: 'none' }}
          />
          {results.length > 0 && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 5px)',
              left: 0,
              width: 'min(240px, 70vw)',
              background: tk.searchResultsBg,
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 8,
              zIndex: 9999,
              overflow: 'hidden',
              boxShadow: '0 12px 30px rgba(0,0,0,0.9), 0 0 15px rgba(99,102,241,0.2)'
            }}>
              {results.slice(0, 8).map((r, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectResult(r.symbol || r.ticker)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background 0.1s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{
                      fontWeight: 700,
                      color: (r.ticker === 'XAUUSD' || r.symbol === 'XAUUSD') ? '#FACC15' : ((r.ticker === 'BTC' || r.symbol === 'BTC') ? '#F59E0B' : '#818CF8'),
                      fontSize: '0.76rem',
                      fontFamily: 'JetBrains Mono, monospace'
                    }}>
                      {(r.ticker === 'XAUUSD' || r.symbol === 'XAUUSD') ? '🥇 XAUUSD' : ((r.ticker === 'BTC' || r.symbol === 'BTC') ? '₿ BTC' : (r.symbol || r.ticker))}
                    </span>
                    <span style={{ color: '#94A3B8', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{r.name || r.companyName}</span>
                  </div>
                  <span style={{
                    fontSize: '0.62rem',
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: r.exchange === 'COMMODITY' ? 'rgba(250,204,21,0.15)' : (r.exchange === 'CRYPTO' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)'),
                    color: r.exchange === 'COMMODITY' ? '#FACC15' : (r.exchange === 'CRYPTO' ? '#F59E0B' : '#64748B'),
                    fontWeight: 700,
                  }}>
                    {r.exchange || 'NSE'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Infinite Seamless Running Marquee Ticker (hidden on mobile to protect search) */}
      {!isMobile && (
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%', display: 'flex', alignItems: 'center', margin: '0 8px', minWidth: 0 }}>
        {tapeItems.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.66rem', fontFamily: 'JetBrains Mono, monospace', color: '#64748B', paddingLeft: 8 }}>
            <AlertCircle size={11} />
            <span>Market data connecting…</span>
          </div>
        ) : (
          <>
          {tapeUnavailable && (
            <span title="Backend unreachable — showing last known values" style={{ flexShrink: 0, fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.06em', fontFamily: 'JetBrains Mono, monospace', color: '#D97706', background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.35)', padding: '2px 7px', borderRadius: 4 }}>
              OFFLINE
            </span>
          )}
          <div className="topbar-marquee-track">
            {tapeItems.map((item, idx) => {
              const sym = String(item.symbol || '').toUpperCase().trim();
              const targetSym = String(item.target_symbol || item.targetSymbol || sym).toUpperCase().trim();
              const liveFeed = liveSnapshot[targetSym] || liveSnapshot[sym] || (sym === 'GOLD' ? liveSnapshot['XAUUSD'] : undefined);
              const price = Number(liveFeed?.price ?? item.price ?? 0);
              const changePct = Number(liveFeed?.change_pct ?? item.change_pct ?? 0);
              const isUp = changePct >= 0;
              const isStatic = !liveFeed && item.status === 'STATIC';
              const isUnavailable = !liveFeed && item.status === 'UNAVAILABLE';
              const isChartable = !sym.includes('VIX') && !sym.includes('CRUDE') && (!sym.includes('/') || sym.includes('BTC')) && !sym.startsWith('NIFTY');
              const isGold = sym === 'GOLD' || sym === 'XAUUSD';
              const isBtc = sym === 'BTC' || sym === 'BITCOIN';
              const isNifty = sym.startsWith('NIFTY');
              const isBankNifty = sym.includes('BANK');
              const prefix = (isBtc || isGold || sym.includes('CRUDE')) ? '$' : (sym.includes('INR') ? '₹' : '');

              return (
                <div
                  key={idx}
                  onClick={() => handleTapeItemClick(item)}
                  className="topbar-tape-chip"
                  style={{ opacity: (isStatic || isUnavailable) && !liveFeed ? 0.65 : 1, cursor: isChartable ? 'pointer' : 'default' }}
                  title={isChartable ? `Click to open ${item.symbol} chart` : (isStatic ? 'Reference value' : 'Not chartable')}
                >
                  {isBtc ? (
                    <span style={{ color: '#F59E0B', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <span>₿</span> BTC
                    </span>
                  ) : isGold ? (
                    <span style={{ color: '#FACC15', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <span>🥇</span> GOLD
                    </span>
                  ) : isNifty ? (
                    <span style={{ color: '#818CF8', fontWeight: 800 }}>NIFTY 50</span>
                  ) : isBankNifty ? (
                    <span style={{ color: '#38BDF8', fontWeight: 800 }}>BANK NIFTY</span>
                  ) : (
                    <span style={{ color: tk.topbarMuted, fontWeight: 700 }}>{item.symbol}</span>
                  )}

                  <span style={{ fontWeight: 800, color: tk.topbarText }}>
                    {price > 0
                      ? `${prefix}${price >= 100 ? price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : price.toFixed(2)}`
                      : '—'}
                  </span>

                  {price > 0 && item.change_pct != null && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      color: isUp ? '#10B981' : '#EF4444',
                      background: isUp ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      border: `1px solid ${isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                      padding: '1px 5px',
                      borderRadius: 4,
                      fontWeight: 700,
                      fontSize: '0.62rem'
                    }}>
                      {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                      {isUp ? '+' : ''}{changePct.toFixed(2)}%
                    </span>
                  )}

                  {isStatic && (
                    <span style={{ fontSize: '0.52rem', color: '#64748B', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 3, fontWeight: 600 }}>REF</span>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
      )}


      {/* Right: Actions (Watchlist toggle hidden on mobile — panel is display:none there) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexShrink: 0, position: 'relative', zIndex: 110 }}>
        <ThemeToggle />
        {!isMobile && (
        <button onClick={toggleFullscreen} title="Toggle fullscreen" style={{ background: 'transparent', border: 'none', color: tk.topbarMuted, cursor: 'pointer', display: 'flex', padding: 3 }}>
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        )}
        <button onClick={onOpenCommandPalette} style={{ background: tk.inputBg, border: `1px solid ${tk.inputBorder}`, padding: '3px 7px', borderRadius: 4, color: tk.topbarMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem' }}>
          <Search size={11} /> {!isMobile && '⌘K'}
        </button>
        {!isMobile && (
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
        )}
      </div>
    </div>
  );
}
