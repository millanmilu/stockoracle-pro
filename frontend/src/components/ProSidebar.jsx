import React from 'react';
import { 
  LayoutDashboard, CandlestickChart, Grid3X3, SlidersHorizontal, Wallet, 
  Activity, TrendingUp, BarChart3, History, Dices, BookOpen, BarChart2, 
  Layers, MessageSquare, BrainCircuit, Brain, Newspaper, Shield, Globe, 
  Bell, GitFork, ChevronLeft, ChevronRight, KeyRound
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
        { label: 'Multi-Tile', icon: <Grid3X3 size={16} />, view: 'Multi-Tile', badge: { text: 'PRO', color: '#3B82F6' } },
        { label: 'Heatmap', icon: <Grid3X3 size={16} />, view: 'Heatmap' },
        { label: 'Adv. Screener', icon: <SlidersHorizontal size={16} />, view: 'Adv. Screener' },
        { label: 'Paper Trading', icon: <Wallet size={16} />, view: 'Paper Trading', badge: { text: '₹10L', color: '#3B82F6' } },
      ]
    },
    {
      title: 'ANALYTICS',
      items: [
        { label: 'Sentiment TA', icon: <Activity size={16} />, view: 'Sentiment TA', badge: { text: 'NEW', color: '#10B981' } },
        { label: 'Patterns', icon: <TrendingUp size={16} />, view: 'Patterns' },
        { label: 'Levels', icon: <BarChart3 size={16} />, view: 'Levels' },
        { label: 'Volatility', icon: <Activity size={16} />, view: 'Volatility' },
        { label: 'Backtest', icon: <History size={16} />, view: 'Backtest' },
        { label: 'Monte Carlo', icon: <Dices size={16} />, view: 'Monte Carlo' },
      ]
    },
    {
      title: 'FUNDAMENTALS',
      items: [
        { label: 'Fundamentals', icon: <BookOpen size={16} />, view: 'Fundamentals', badge: { text: 'NEW', color: '#10B981' } },
        { label: 'Options Chain', icon: <Layers size={16} />, view: 'Options Chain' },
        { label: 'Valuation', icon: <BookOpen size={16} />, view: 'Valuation', badge: { text: 'DCF', color: '#F59E0B' } },
      ]
    },
    {
      title: 'AI & INTELLIGENCE',
      items: [
        { label: 'AI Chat', icon: <MessageSquare size={16} />, view: 'AI Chat', badge: { text: 'GEMINI', color: '#818CF8' } },
        { label: 'AI Prediction', icon: <BrainCircuit size={16} />, view: 'AI Prediction', badge: { text: 'AI', color: '#8B5CF6' } },
        { label: 'Sentiment', icon: <Brain size={16} />, view: 'Sentiment' },
        { label: 'News', icon: <Newspaper size={16} />, view: 'News' },
      ]
    },
    {
      title: 'INSTITUTIONAL',
      items: [
        { label: 'Sector Rotation', icon: <Activity size={16} />, view: 'Sector Rotation', badge: { text: 'RRG', color: '#06B6D4' } },
        { label: 'Options Strategy Lab', icon: <Layers size={16} />, view: 'Options Strategy Lab', badge: { text: 'GREEKS', color: '#F97316' } },
        { label: 'Quant Risk Cockpit', icon: <Shield size={16} />, view: 'Quant Risk Cockpit', badge: { text: 'VaR', color: '#F43F5E' } },
        { label: 'Macro Terminal', icon: <Globe size={16} />, view: 'Macro Terminal', badge: { text: 'MACRO', color: '#34D399' } },
      ]
    },
    {
      title: 'ACCOUNT',
      items: [
        { label: 'Broker Settings', icon: <KeyRound size={16} />, view: 'Broker Settings', badge: { text: 'API', color: '#10B981' } },
        { label: 'AI Providers', icon: <Brain size={16} />, view: 'AI Providers', badge: { text: 'AI', color: '#8B5CF6' } },
        { label: 'Price Alerts', icon: <Bell size={16} />, view: 'Price Alerts' },
        { label: 'Supply Chain', icon: <GitFork size={16} />, view: 'Supply Chain' },
      ]
    }
  ];

  return (
    <div className={`pro-sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {sections.map((sec, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            {!collapsed && <div className="pro-nav-section">{sec.title}</div>}
            {collapsed && <div style={{ height: 10 }} />}
            {sec.items.map((item, j) => (
              <button
                key={j}
                title={collapsed ? item.label : undefined}
                className={`pro-nav-item ${activeView === item.view ? 'active' : ''}`}
                onClick={() => setActiveView(item.view)}
                style={{ paddingLeft: collapsed ? 22 : 14, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start', alignItems: 'center' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20 }}>{item.icon}</span>
                {!collapsed && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, marginLeft: 8 }}>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span style={{ fontSize: '0.6rem', padding: '2px 4px', borderRadius: 4, background: `${item.badge.color}20`, color: item.badge.color, fontWeight: 700 }}>
                        {item.badge.text}
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
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
