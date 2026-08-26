import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import { 
  Search, Sun, Moon, Bell, Maximize2, Minimize2, 
  ChevronDown, LayoutDashboard, CandlestickChart, BrainCircuit,
  SlidersHorizontal, Grid3X3, Brain, Globe, GitFork, RefreshCw, Zap,
  Menu, X, Sparkles, BookOpen, BarChart2, Layers, Wallet, MessageSquare,
  TrendingUp, Activity, History, Dices, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TradeOneNavbar({ onToggleWatchlist, showWatchlist, onOpenCommandPalette }) {
  const { activeView, setActiveView, selectedSymbol, setSelectedSymbol, theme, setTheme } = useStore();
  const { searchStocks } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const searchInputRef = useRef(null);


  // Search focus when modal opens
  useEffect(() => {
    if (showSearchModal) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showSearchModal]);

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
      } catch {
        setSearchResults([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery, searchStocks]);

  const handleSelectStock = (ticker) => {
    if (!ticker) return;
    const cleanTicker = String(ticker).toUpperCase();
    setSelectedSymbol(cleanTicker);
    setSearchQuery('');
    setShowSearchModal(false);
    toast.success(`Loaded ${cleanTicker}`);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const isDark = theme !== 'light';

  // Core desktop tabs
  const PRIMARY_TABS = [
    { name: 'Live Chart',    label: 'Charts',     icon: CandlestickChart },
    { name: 'Multi-Tile',    label: '4-Grid Workspace', icon: Grid3X3, badge: 'PRO' },
    { name: 'Valuation',     label: 'DCF Valuation', icon: BookOpen, badge: 'NEW' },
    { name: 'Sector Rotation', label: 'RRG Rotation', icon: Activity, badge: 'NEW' },
    { name: 'Options Strategy Lab', label: 'Options Lab', icon: Layers, badge: 'NEW' },
    { name: 'Quant Risk Cockpit', label: 'Quant Risk', icon: Shield, badge: 'VaR' },
    { name: 'Macro Terminal', label: 'Sovereign Macro', icon: Globe },
    { name: 'Adv. Screener', label: 'Screener',   icon: SlidersHorizontal },
    { name: 'Paper Trading', label: 'Paper Trade',icon: Wallet },
  ];

  // All categorized views for the mobile drawer / full menu
  const VIEW_CATEGORIES = [
    {
      category: 'Institutional Terminal (OpenBB & OpenTerminalUI)',
      items: [
        { name: 'Multi-Tile',    label: 'Bloomberg 4-Grid Workspace', icon: Grid3X3, badge: 'PRO' },
        { name: 'Valuation',     label: 'OpenBB DCF & Graham Valuation', icon: BookOpen, badge: 'DCF' },
        { name: 'Sector Rotation', label: 'RRG Sector Rotation Graphs', icon: Activity, badge: 'RRG' },
        { name: 'Options Strategy Lab', label: 'Multi-Leg Options Strategy Lab', icon: Layers, badge: 'GREEKS' },
        { name: 'Quant Risk Cockpit', label: 'Portfolio VaR & Risk Cockpit', icon: Shield, badge: 'VaR' },
        { name: 'Macro Terminal', label: 'Sovereign 10Y Yields & Macro', icon: Globe, badge: 'MACRO' },
      ]
    },
    {
      category: 'Trading & Markets',
      items: [
        { name: 'Live Chart',    label: 'Pro Live Chart', icon: CandlestickChart, badge: 'PRO' },
        { name: 'Paper Trading', label: 'Paper Trading (₹10L)', icon: Wallet, badge: '₹10L' },
        { name: 'Dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
        { name: 'Heatmap',       label: 'Market Heatmap', icon: Grid3X3 },
        { name: 'Adv. Screener', label: 'Adv. Screener',  icon: SlidersHorizontal },
      ]
    },
    {
      category: 'AI & Intelligence',
      items: [
        { name: 'AI Chat',       label: 'AI Analyst Chat',icon: MessageSquare, badge: 'GEMINI' },
        { name: 'AI Prediction', label: 'AI Forecast',    icon: BrainCircuit, badge: 'AI' },
        { name: 'Backtest',      label: 'Strategy Backtest', icon: History },
        { name: 'Monte Carlo',   label: 'Monte Carlo Sim',icon: Dices },
      ]
    },
    {
      category: 'Fundamentals & Technicals',
      items: [
        { name: 'Fundamentals',  label: 'Company Ratios', icon: BookOpen },
        { name: 'Earnings',      label: 'Quarterly Growth', icon: BarChart2 },
        { name: 'Options Chain', label: 'NSE Options Chain', icon: Layers },
        { name: 'Patterns',      label: 'Pattern Detection', icon: TrendingUp },
        { name: 'Levels',        label: 'Support & Resistance', icon: BarChart2 },
        { name: 'Price Alerts',  label: 'Smart Alerts',     icon: Bell },
      ]
    }
  ];

  return (
    <>
      <header style={{
        height: '56px',
        backgroundColor: isDark ? '#0A0D1A' : '#ffffff',
        borderBottom: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        userSelect: 'none',
      }}>
        {/* ── Left: Hamburger (Mobile) + Logo + Quick Indices ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Mobile Menu Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label="Toggle navigation menu"
            style={{
              background: 'transparent',
              border: isDark ? '1px solid #1E2338' : '1px solid #CBD5E1',
              borderRadius: '8px',
              color: isDark ? '#F0F0FF' : '#0F172A',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {showMobileMenu ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Logo */}
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
              flexShrink: 0,
            }}>
              <Zap size={16} color="#fff" />
            </div>
            <span style={{
              fontFamily: 'Space Grotesk, Inter, sans-serif',
              fontWeight: 800,
              fontSize: '0.95rem',
              color: isDark ? '#F0F0FF' : '#0F172A',
              letterSpacing: '-0.02em',
            }}>
              StockOracle
            </span>
          </div>

          {/* Active Symbol Badge */}
          <div
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: '#818CF8',
              fontWeight: 800,
              fontSize: '0.74rem',
              fontFamily: 'JetBrains Mono, monospace',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '0.62rem', color: '#6366F1' }}>NSE:</span>
            <span>{selectedSymbol}</span>
          </div>

          {/* Live Indices Ticker (Desktop only) */}
          <div className="desktop-indices" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
            paddingLeft: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
              <span style={{ fontWeight: 700, color: isDark ? '#9CA3AF' : '#64748B' }}>NIFTY</span>
              <span style={{ fontWeight: 800, color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>24,366</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
              <span style={{ fontWeight: 700, color: isDark ? '#9CA3AF' : '#64748B' }}>SENSEX</span>
              <span style={{ fontWeight: 800, color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>78,009</span>
            </div>
          </div>
        </div>

        {/* ── Center: Scrollable Desktop Navigation Tabs ── */}
        <nav className="desktop-nav" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          padding: '0 4px',
        }}>
          {PRIMARY_TABS.map((tab) => {
            const isActive = activeView === tab.name;
            const Icon = tab.icon;
            return (
              <button
                key={tab.name}
                onClick={() => setActiveView(tab.name)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isActive ? (isDark ? 'rgba(59,130,246,0.18)' : '#EFF6FF') : 'transparent',
                  color: isActive ? '#3B82F6' : (isDark ? '#94A3B8' : '#64748B'),
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Right: Search + Theme + Fullscreen Controls ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Quick Search / Command Palette Trigger */}
          <button
            onClick={() => onOpenCommandPalette?.()}
            title="Command Palette & Stock Search (Ctrl+K or /)"
            style={{
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#818CF8',
              padding: '5px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <Search size={13} />
            <span className="desktop-search-label">Search / Cmd</span>
            <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px', color: '#94A3B8' }}>⌘K</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}

            title={isDark ? 'Light Theme' : 'Dark Theme'}
            style={{
              background: 'transparent',
              border: isDark ? '1px solid #1E2338' : '1px solid #CBD5E1',
              borderRadius: '8px',
              cursor: 'pointer',
              color: isDark ? '#94A3B8' : '#64748B',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Fullscreen (Desktop only) */}
          <button
            onClick={toggleFullscreen}
            className="fullscreen-btn"
            title="Toggle Fullscreen"
            style={{
              background: 'transparent',
              border: isDark ? '1px solid #1E2338' : '1px solid #CBD5E1',
              borderRadius: '8px',
              cursor: 'pointer',
              color: isDark ? '#94A3B8' : '#64748B',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </header>

      {/* ── Search Modal (Global overlay) ── */}
      {showSearchModal && (
        <div
          onClick={() => setShowSearchModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 'clamp(40px, 12vh, 120px)',
            paddingLeft: '16px',
            paddingRight: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: isDark ? '#0C1022' : '#FFFFFF',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Search Input Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 18px',
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
              gap: '12px',
            }}>
              <Search size={18} color="#818CF8" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search stocks (e.g. RELIANCE, TCS, INFY)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.95rem',
                  color: isDark ? '#F0F0FF' : '#0F172A',
                  fontWeight: 600,
                }}
              />
              <button
                onClick={() => setShowSearchModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Results list */}
            <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
              {searchResults.length > 0 ? (
                searchResults.map((stock) => (
                  <div
                    key={stock.symbol || stock.ticker}
                    onClick={() => handleSelectStock(stock.symbol || stock.ticker)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(99,102,241,0.1)' : '#F1F5F9'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div>
                      <span style={{ fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#818CF8', fontSize: '0.9rem' }}>
                        {stock.symbol || stock.ticker}
                      </span>
                      <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: isDark ? '#9CA3AF' : '#64748B' }}>
                        {stock.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', background: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0', color: '#9CA3AF' }}>
                      {stock.exchange || 'NSE'}
                    </span>
                  </div>
                ))
              ) : searchQuery.trim() ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontSize: '0.85rem' }}>
                  No stocks found matching "{searchQuery}"
                </div>
              ) : (
                <div style={{ padding: '16px 14px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Popular Stocks</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'LT', 'TATAMOTORS'].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSelectStock(s)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #CBD5E1',
                          background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                          color: isDark ? '#E2E8F0' : '#1E293B',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Navigation Drawer ── */}
      {showMobileMenu && (
        <div
          onClick={() => setShowMobileMenu(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 250,
            display: 'flex',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(85vw, 320px)',
              height: '100%',
              backgroundColor: isDark ? '#0A0D1A' : '#FFFFFF',
              borderRight: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 14px',
              overflowY: 'auto',
              boxShadow: '10px 0 30px rgba(0,0,0,0.5)',
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="#3B82F6" />
                <span style={{ fontWeight: 800, fontSize: '1rem', color: isDark ? '#F0F0FF' : '#0F172A' }}>StockOracle Pro</span>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94A3B8' : '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Categories */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {VIEW_CATEGORIES.map((cat) => (
                <div key={cat.category}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                    {cat.category}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {cat.items.map((item) => {
                      const isActive = activeView === item.name;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.name}
                          onClick={() => {
                            setActiveView(item.name);
                            setShowMobileMenu(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: isActive ? (isDark ? 'rgba(59,130,246,0.18)' : '#EFF6FF') : 'transparent',
                            color: isActive ? '#3B82F6' : (isDark ? '#CBD5E1' : '#334155'),
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '0.82rem',
                            fontWeight: isActive ? 700 : 500,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span style={{
                              fontSize: '0.62rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: item.badge === 'PRO' ? '#3B82F6' : item.badge === 'GEMINI' ? '#818CF8' : '#10B981',
                              color: '#fff',
                              fontWeight: 700,
                            }}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
