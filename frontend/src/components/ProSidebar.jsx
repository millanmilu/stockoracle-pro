import React from 'react';
import { 
  LayoutDashboard, CandlestickChart, Grid3X3, SlidersHorizontal, Wallet, 
  Activity, TrendingUp, BarChart3, History, Dices, BookOpen, 
  Layers, MessageSquare, BrainCircuit, Brain, Newspaper, Shield, Globe, 
  Bell, GitFork, ChevronLeft, ChevronRight, KeyRound, Target, Compass
} from 'lucide-react';
import useStore from '../store/useStore';

export default function ProSidebar({ collapsed, onToggleCollapse }) {
  const activeView = useStore(s => s.activeView);
  const setActiveView = useStore(s => s.setActiveView);

  const sections = [
    {
      title: 'MARKETS',
      items: [
        { label: 'Dashboard', icon: <LayoutDashboard size={16} />, view: 'Dashboard' },
        { label: 'Live Chart', icon: <CandlestickChart size={16} />, view: 'Live Chart', badge: { text: 'PRO', color: '#3B82F6' } },
        { label: 'Multi-Tile', icon: <Grid3X3 size={16} />, view: 'Multi-Tile', badge: { text: '4-SPLIT', color: '#3B82F6' } },
        { label: 'Heatmap', icon: <Grid3X3 size={16} />, view: 'Heatmap' },
        { label: 'Adv. Screener', icon: <SlidersHorizontal size={16} />, view: 'Adv. Screener' },
        { label: 'Paper Trading', icon: <Wallet size={16} />, view: 'Paper Trading', badge: { text: '₹10L', color: '#10B981' } },
      ]
    },
    {
      title: 'QUANT & TECHNICALS',
      items: [
        { label: 'Technical Lab', icon: <Target size={16} />, view: 'Technical Lab', badge: { text: 'ZONES/PATTERNS', color: '#38BDF8' } },
        { label: 'Backtest Studio', icon: <History size={16} />, view: 'Backtest' },
        { label: 'Monte Carlo', icon: <Dices size={16} />, view: 'Monte Carlo', badge: { text: 'SIM', color: '#A855F7' } },
        { label: 'Quant Risk Cockpit', icon: <Shield size={16} />, view: 'Quant Risk Cockpit', badge: { text: 'VaR', color: '#F43F5E' } },
      ]
    },
    {
      title: 'DERIVATIVES',
      items: [
        { label: 'Options Lab', icon: <Layers size={16} />, view: 'Options Lab', badge: { text: 'CHAIN & GREEKS', color: '#F97316' } },
      ]
    },
    {
      title: 'FUNDAMENTAL RESEARCH',
      items: [
        { label: 'Fundamentals', icon: <BookOpen size={16} />, view: 'Fundamentals', badge: { text: 'STATEMENTS', color: '#10B981' } },
        { label: 'Supply Chain', icon: <GitFork size={16} />, view: 'Supply Chain', badge: { text: 'NETWORK', color: '#06B6D4' } },
      ]
    },
    {
      title: 'INTELLIGENCE & MACRO',
      items: [
        { label: 'Market Intelligence', icon: <Newspaper size={16} />, view: 'Market Intelligence', badge: { text: 'NEWS/PULSE', color: '#818CF8' } },
        { label: 'Macro Terminal', icon: <Globe size={16} />, view: 'Macro Terminal', badge: { text: 'YIELDS', color: '#34D399' } },
        { label: 'Sector Rotation', icon: <Compass size={16} />, view: 'Sector Rotation', badge: { text: 'RRG', color: '#06B6D4' } },
        { label: 'Sentiment TA', icon: <Activity size={16} />, view: 'Sentiment TA', badge: { text: 'GAUGE', color: '#10B981' } },
      ]
    },
    {
      title: 'AI & SETTINGS',
      items: [
        { label: 'AI Chat Analyst', icon: <MessageSquare size={16} />, view: 'AI Chat', badge: { text: 'COPILOT', color: '#818CF8' } },
        { label: 'AI Predictions', icon: <BrainCircuit size={16} />, view: 'AI Prediction', badge: { text: 'ML', color: '#8B5CF6' } },
        { label: 'Broker & AI Hub', icon: <KeyRound size={16} />, view: 'Broker Settings', badge: { text: 'API/AI', color: '#10B981' } },
        { label: 'Price Alerts', icon: <Bell size={16} />, view: 'Price Alerts' },
      ]
    }
  ];

  return (
    <div className={`pro-sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {sections.map((sec, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            {!collapsed && <div className="pro-nav-section">{sec.title}</div>}
            {collapsed && <div style={{ height: 10 }} />}
            {sec.items.map((item, j) => {
              // Highlight active if activeView matches item.view or related merged view
              const isActive = activeView === item.view || 
                (item.view === 'Technical Lab' && ['Patterns', 'Levels', 'Volatility'].includes(activeView)) ||
                (item.view === 'Options Lab' && ['Options Chain', 'Options Strategy Lab'].includes(activeView)) ||
                (item.view === 'Market Intelligence' && ['News', 'Sentiment'].includes(activeView)) ||
                (item.view === 'Broker Settings' && activeView === 'AI Providers');

              return (
                <button
                  key={j}
                  title={collapsed ? item.label : undefined}
                  className={`pro-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveView(item.view)}
                  style={{ paddingLeft: collapsed ? 22 : 14, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start', alignItems: 'center' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20 }}>{item.icon}</span>
                  {!collapsed && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, marginLeft: 8 }}>
                      <span>{item.label}</span>
                      {item.badge && (
                        <span style={{ fontSize: '0.6rem', padding: '2px 5px', borderRadius: 4, background: `${item.badge.color}20`, color: item.badge.color, fontWeight: 700 }}>
                          {item.badge.text}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ padding: '10px', borderTop: '1px solid rgba(99,102,241,0.1)', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
        <button onClick={onToggleCollapse} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </div>
  );
}
