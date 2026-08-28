import React, { useState, useMemo } from 'react';
import {
  Search, X, User, Wallet, TrendingUp, BarChart2, Bookmark,
  Activity, Flame, ShoppingBag, Check, Sparkles, Plus, Star
} from 'lucide-react';

/* ── Standard Indicator Database with Categories & Badges ── */
const ALL_SCRIPTS = [
  { id: 'vol_24h', name: '24-hour Volume', type: 'vol', category: 'technicals', tab: 'Indicators', desc: 'Calculates total rolling 24-hour traded volume.' },
  { id: 'acc_dist', name: 'Accumulation/Distribution', type: 'vol', category: 'technicals', tab: 'Indicators', desc: 'Volume-based indicator measuring cumulative money flow into or out of an asset.' },
  { id: 'ad_line', name: 'Advance Decline Line', type: 'breadth', category: 'technicals', tab: 'Indicators', desc: 'Market breadth indicator based on net advancing stocks.' },
  { id: 'ad_ratio', name: 'Advance Decline Ratio', type: 'breadth', category: 'technicals', tab: 'Indicators', desc: 'Ratio of advancing to declining stocks.' },
  { id: 'ad_ratio_bars', name: 'Advance/Decline Ratio (Bars)', type: 'breadth', category: 'technicals', tab: 'Indicators', desc: 'Bar-by-bar advance decline ratio.' },
  { id: 'alma', name: 'Arnaud Legoux Moving Average', type: 'overlay', category: 'technicals', tab: 'Indicators', desc: 'Gaussian-filtered moving average with ultra-low lag and smooth curve.' },
  { id: 'aroon', name: 'Aroon', type: 'oscillator', category: 'technicals', tab: 'Indicators', desc: 'Measures the time between highs and lows over a calculation period.' },
  { id: 'aroon_osc', name: 'Aroon Oscillator', type: 'oscillator', category: 'technicals', tab: 'Indicators', badge: 'NEW', badgeColor: '#F97316', desc: 'Calculates Aroon-Up minus Aroon-Down to identify emerging trends.' },
  { id: 'auto_key_levels', name: 'Auto Key Levels', type: 'overlay', category: 'technicals', tab: 'Indicators', badges: [{ text: 'BETA', color: '#6366F1' }, { text: 'NEW', color: '#F97316' }], desc: 'AI-detected major support and resistance reaction levels.' },
  { id: 'boll', name: 'Bollinger Bands (20, 2)', type: 'overlay', category: 'technicals', tab: 'Indicators', desc: 'Volatility bands placed 2 standard deviations above and below SMA 20.' },
  { id: 'ema_20', name: 'Exponential Moving Average (EMA 20)', type: 'overlay', category: 'technicals', tab: 'Indicators', desc: 'Weighted average putting greatest importance on recent price action.' },
  { id: 'sma_20', name: 'Simple Moving Average (SMA 20)', type: 'overlay', category: 'technicals', tab: 'Indicators', desc: 'Arithmetic average of closing prices over 20 periods.' },
  { id: 'rsi_14', name: 'Relative Strength Index (RSI 14)', type: 'oscillator', category: 'technicals', tab: 'Indicators', desc: 'Momentum oscillator measuring the speed and magnitude of recent price changes.' },
  { id: 'macd', name: 'MACD (12, 26, 9)', type: 'oscillator', category: 'technicals', tab: 'Indicators', desc: 'Moving Average Convergence Divergence trend-following momentum oscillator.' },
  { id: 'vwap', name: 'Volume Weighted Average Price (VWAP)', type: 'overlay', category: 'technicals', tab: 'Indicators', badge: 'PRO', badgeColor: '#38BDF8', desc: 'Institutional benchmark price weighted by volume with ±1.5σ volatility bands.' },
  { id: 'supertrend', name: 'SuperTrend (10, 3.0)', type: 'overlay', category: 'technicals', tab: 'Indicators', badge: 'HOT', badgeColor: '#10B981', desc: 'ATR-based trend-following indicator with dynamic Buy/Sell trailing stops.' },
  { id: 'pivot_points', name: 'Pivot Points Standard (R1-R3 / S1-S3)', type: 'overlay', category: 'technicals', tab: 'Indicators', desc: 'Classic central Pivot Point with 3 Resistance and 3 Support levels.' },
  { id: 'ema_ribbon', name: 'EMA Ribbon (9, 21, 50, 200)', type: 'overlay', category: 'technicals', tab: 'Indicators', badge: 'TREND', badgeColor: '#A855F7', desc: 'Multi-timeframe exponential moving average ribbon tracking trend strength.' },
  { id: 'vpvr', name: 'Volume Profile (VPVR)', type: 'profile', category: 'technicals', tab: 'Profiles', badge: 'PRO', badgeColor: '#38BDF8', desc: 'Volume-at-Price histogram highlighting Point of Control (POC) and Value Areas.' },
  { id: 'orderflow', name: 'Order Flow Delta', type: 'profile', category: 'technicals', tab: 'Profiles', badge: 'PRO', badgeColor: '#A855F7', desc: 'Aggregated buyer vs seller tick delta imbalance.' },
  { id: 'ai_patterns', name: 'AI Pattern Recognition Scanner', type: 'pattern', category: 'technicals', tab: 'Patterns', badge: 'AI', badgeColor: '#10B981', desc: 'Detects Head & Shoulders, Double Bottoms, Triangles, and Flags using neural nets.' },
  { id: 'mtf_matrix', name: 'Multi-Timeframe Correlation Matrix', type: 'breadth', category: 'technicals', tab: 'Strategies', badge: 'PRO', badgeColor: '#6366F1', desc: 'Correlates 1m, 5m, 15m, 1h, 1d price actions.' },
  { id: 'backtester', name: 'Strategy Backtester Overlay', type: 'strategy', category: 'technicals', tab: 'Strategies', badge: 'LAB', badgeColor: '#F59E0B', desc: 'Historical equity curve and trade simulation on chart candles.' },
];

const SIDEBAR_NAV = [
  { id: 'my_scripts', label: 'My Scripts', icon: User },
  { id: 'financials', label: 'Financials', icon: Wallet },
  { id: 'technicals', label: 'Technicals', icon: TrendingUp },
  { id: 'volume',     label: 'Volume & Liquidity', icon: BarChart2 },
  { id: 'favorites',  label: 'Favorites', icon: Bookmark },
  { id: 'community',  label: 'Community Scripts', icon: Activity },
  { id: 'trending',   label: 'Trending', icon: Flame },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
];

const TOP_TABS = ['Indicators', 'Strategies', 'Profiles', 'Patterns'];

export default function IndicatorsModal({
  isOpen,
  onClose,
  activeIndicators,
  onToggleIndicator,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Indicators');
  const [activeSidebar, setActiveSidebar] = useState('technicals');
  const [favorites, setFavorites] = useState(['boll', 'rsi_14', 'vpvr', 'ai_patterns']);

  const toggleFavorite = (id, e) => {
    e.stopPropagation();
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const filteredScripts = useMemo(() => {
    return ALL_SCRIPTS.filter(script => {
      // Tab filter
      const matchesTab = activeTab === 'Indicators' || script.tab === activeTab;
      
      // Sidebar category filter
      if (activeSidebar === 'favorites') {
        if (!favorites.includes(script.id)) return false;
      }

      // Search text filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return script.name.toLowerCase().includes(q) || script.desc.toLowerCase().includes(q);
      }

      return matchesTab;
    });
  }, [searchQuery, activeTab, activeSidebar, favorites]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
      }}
      onClick={onClose}
    >
      {/* ── Main Modal Box ── */}
      <div
        style={{
          width: '92%',
          maxWidth: 780,
          height: 520,
          backgroundColor: '#131722',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#E0E3EB',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px 10px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <h2 style={{
            fontSize: '1.05rem',
            fontWeight: 600,
            color: '#FFFFFF',
            margin: 0,
            letterSpacing: '0.01em',
          }}>
            Indicators, metrics, and strategies
          </h2>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#868993',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              borderRadius: 4,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#868993'}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Search Bar & Pill Tabs ── */}
        <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
          {/* Rounded Dark Search Bar */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#1E222D',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0 12px',
            marginBottom: 10,
          }}>
            <Search size={16} style={{ color: '#787B86', marginRight: 8, flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                height: 36,
                backgroundColor: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '0.84rem',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: '#787B86', cursor: 'pointer', padding: 2 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 4 Pill Toggle Tabs */}
          <div style={{ display: 'flex', gap: 6 }}>
            {TOP_TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 20,
                    border: 'none',
                    backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                    color: isActive ? '#131722' : '#868993',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = '#868993';
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Body: Left Sidebar + Main Script List ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Vertical Navigation Bar */}
          <div style={{
            width: 52,
            backgroundColor: '#0F121A',
            borderRight: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '12px 0',
            gap: 10,
            flexShrink: 0,
          }}>
            {SIDEBAR_NAV.map((nav) => {
              const Icon = nav.icon;
              const isSelected = activeSidebar === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveSidebar(nav.id)}
                  title={nav.label}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    color: isSelected ? '#FFFFFF' : '#787B86',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.color = '#D1D4DC';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.color = '#787B86';
                  }}
                >
                  <Icon size={17} strokeWidth={1.75} />
                </button>
              );
            })}
          </div>

          {/* Main Content Area: SCRIPT NAME List */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 24px 6px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
            }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#787B86', letterSpacing: '0.06em' }}>
                SCRIPT NAME
              </span>
              <span style={{ fontSize: '0.68rem', color: '#50535E' }}>
                {filteredScripts.length} available
              </span>
            </div>

            {/* Script List Scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }}>
              {filteredScripts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#787B86', fontSize: '0.82rem' }}>
                  No indicators matching "{searchQuery}"
                </div>
              ) : (
                filteredScripts.map((script) => {
                  const isEnabled = activeIndicators[script.id];
                  const isFav = favorites.includes(script.id);

                  return (
                    <div
                      key={script.id}
                      onClick={() => onToggleIndicator(script.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        backgroundColor: isEnabled ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                        transition: 'background-color 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isEnabled ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255, 255, 255, 0.03)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isEnabled ? 'rgba(59, 130, 246, 0.12)' : 'transparent';
                      }}
                    >
                      {/* Left: Star + Name + Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                          onClick={(e) => toggleFavorite(script.id, e)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: isFav ? '#F59E0B' : '#434651',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Star size={13} fill={isFav ? '#F59E0B' : 'transparent'} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: '0.84rem',
                            fontWeight: isEnabled ? 700 : 500,
                            color: isEnabled ? '#60A5FA' : '#D1D4DC',
                          }}>
                            {script.name}
                          </span>

                          {/* Single Badge */}
                          {script.badge && (
                            <span style={{
                              fontSize: '0.58rem',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: 3,
                              backgroundColor: `${script.badgeColor || '#F97316'}22`,
                              color: script.badgeColor || '#F97316',
                              border: `1px solid ${script.badgeColor || '#F97316'}55`,
                              letterSpacing: '0.04em',
                            }}>
                              {script.badge}
                            </span>
                          )}

                          {/* Multi Badges (e.g. BETA & NEW on Auto Key Levels) */}
                          {script.badges && script.badges.map((b) => (
                            <span
                              key={b.text}
                              style={{
                                fontSize: '0.58rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: 3,
                                backgroundColor: `${b.color}22`,
                                color: b.color,
                                border: `1px solid ${b.color}55`,
                                letterSpacing: '0.04em',
                              }}
                            >
                              {b.text}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Right: Active Indicator Status Checkmark */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isEnabled ? (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#3B82F6',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}>
                            <Check size={14} /> Active
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: '#50535E' }}>
                            Click to add
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
