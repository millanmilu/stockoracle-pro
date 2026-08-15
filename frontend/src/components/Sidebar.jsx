import React, { useState } from 'react';
import useStore from '../store/useStore';
import {
  LayoutDashboard,
  CandlestickChart,
  BrainCircuit,
  Newspaper,
  TrendingUp,
  BarChart3,
  Activity,
  Dices,
  History,
  Bell,
  Brain,
  SlidersHorizontal,
  Grid3X3,
  Globe,
  GitFork,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Zap
} from 'lucide-react';

const CATEGORIES = [
  {
    name: 'Markets & Trading',
    items: [
      { name: 'Dashboard',     icon: LayoutDashboard, badge: '' },
      { name: 'Live Chart',    icon: CandlestickChart, badge: 'PRO' },
      { name: 'Heatmap',       icon: Grid3X3,           badge: '' },
      { name: 'Adv. Screener', icon: SlidersHorizontal, badge: '' },
    ]
  },
  {
    name: 'AI & Forecasting',
    items: [
      { name: 'AI Prediction', icon: BrainCircuit, badge: 'AI' },
      { name: 'Backtest',      icon: History,      badge: '' },
      { name: 'Monte Carlo',   icon: Dices,        badge: '' },
    ]
  },
  {
    name: 'Technical Analysis',
    items: [
      { name: 'Patterns',   icon: TrendingUp, badge: '' },
      { name: 'Levels',     icon: BarChart3,  badge: '' },
      { name: 'Volatility', icon: Activity,   badge: '' },
    ]
  },
  {
    name: 'Market Intelligence',
    items: [
      { name: 'Sentiment',    icon: Brain,    badge: '' },
      { name: 'Macro Data',   icon: Globe,    badge: '' },
      { name: 'Supply Chain', icon: GitFork,  badge: '' },
      { name: 'News',         icon: Newspaper,badge: '' },
      { name: 'Price Alerts', icon: Bell,     badge: '' },
    ]
  }
];

export default function Sidebar() {
  const { activeView, setActiveView, selectedSymbol } = useStore();
  const [collapsedCategories, setCollapsedCategories] = useState({});

  const toggleCategory = (catName) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  return (
    <aside style={{
      width: '235px',
      height: '100vh',
      backgroundColor: 'var(--sidebar-bg, #080B18)',
      borderRight: '1px solid var(--border, rgba(99, 102, 241, 0.12))',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* ── Brand Logo ── */}
      <div style={{
        padding: '18px 20px',
        borderBottom: '1px solid var(--border, rgba(99, 102, 241, 0.12))',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
        }}>
          <Zap size={18} color="#fff" />
        </div>
        <div>
          <div style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #F0F0FF 40%, #818CF8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}>
            StockOracle
          </div>
          <div style={{ fontSize: '0.65rem', color: '#6366F1', fontWeight: 700, letterSpacing: '0.08em' }}>
            PRO AI PLATFORM
          </div>
        </div>
      </div>

      {/* ── Categorized Navigation Menu ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        {CATEGORIES.map(cat => {
          const isCollapsed = collapsedCategories[cat.name];
          return (
            <div key={cat.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {/* Category Header */}
              <div
                onClick={() => toggleCategory(cat.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  color: '#6B7280',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                <span>{cat.name}</span>
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </div>

              {/* Category Items */}
              {!isCollapsed && cat.items.map(item => {
                const isActive = activeView === item.name;
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => setActiveView(item.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                      backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: isActive ? '#F0F0FF' : '#9CA3AF',
                      fontSize: '0.82rem',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = '#F0F0FF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#9CA3AF';
                      }
                    }}
                  >
                    <Icon size={16} style={{ color: isActive ? '#818CF8' : '#6B7280', flexShrink: 0 }} />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </span>
                    {item.badge && (
                      <span style={{
                        fontSize: '0.55rem',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: item.badge === 'AI' ? 'rgba(168,85,247,0.2)' : 'rgba(99,102,241,0.2)',
                        color: item.badge === 'AI' ? '#C084FC' : '#818CF8',
                        border: `1px solid ${item.badge === 'AI' ? 'rgba(168,85,247,0.4)' : 'rgba(99,102,241,0.4)'}`,
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Active Stock Card in Footer ── */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border, rgba(99, 102, 241, 0.12))',
        backgroundColor: 'rgba(255, 255, 255, 0.01)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.65rem', color: '#6B7280', fontWeight: 600 }}>ACTIVE ASSET</span>
          <span style={{ fontSize: '0.62rem', color: '#10B981', fontWeight: 700 }}>● SYNCED</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderRadius: '8px',
          backgroundColor: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}>
          <span style={{ fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>
            {selectedSymbol}
          </span>
          <span style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>NSE EQ</span>
        </div>
      </div>
    </aside>
  );
}
