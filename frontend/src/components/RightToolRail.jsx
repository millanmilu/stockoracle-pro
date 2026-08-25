import React, { useState } from 'react';
import useStore from '../store/useStore';
import { 
  Bookmark, LineChart, Shield, ShoppingCart, 
  BarChart2, Link2, Sparkles, Newspaper, BrainCircuit, X, Zap, MessageCircle
} from 'lucide-react';
import AIInsightCard from './AIInsightCard';
import LevelsPanel from './LevelsPanel';
import NewsPanel from './NewsPanel';
import PriceAlerts from './PriceAlerts';
import AIChatPanel from './AIChatPanel';

export default function RightToolRail({ onToggleWatchlist }) {
  const { selectedSymbol, theme } = useStore();
  const [activeDrawer, setActiveDrawer] = useState(null);

  const isDark = theme !== 'light';

  const TOOLS = [
    { id: 'ai_chat',     label: 'AI Chat',      icon: MessageCircle, component: AIChatPanel },
    { id: 'watchlist',   label: 'Watchlist',    icon: Bookmark, action: 'toggle_watchlist' },
    { id: 'ai_insight',  label: 'AI Insight',   icon: BrainCircuit, component: AIInsightCard },
    { id: 'levels',      label: 'Levels',       icon: BarChart2,    component: LevelsPanel },
    { id: 'news',        label: 'News',         icon: Newspaper,    component: NewsPanel },
    { id: 'alerts',      label: 'Price Alerts', icon: Shield,       component: PriceAlerts },
  ];

  const handleToolClick = (tool) => {
    if (tool.action === 'toggle_watchlist') {
      onToggleWatchlist?.();
      return;
    }
    setActiveDrawer(prev => prev === tool.id ? null : tool.id);
  };

  const ActiveComponent = TOOLS.find(t => t.id === activeDrawer)?.component;

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* ── Slide-Over Drawer Content ── */}
      {activeDrawer && ActiveComponent && (
        <div style={{
          width: '360px',
          height: '100%',
          backgroundColor: isDark ? '#0C1022' : '#FFFFFF',
          borderLeft: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 30,
          boxShadow: '-8px 0 25px rgba(0,0,0,0.3)',
          overflowY: 'auto',
        }}>
          {/* Drawer Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isDark ? '#F0F0FF' : '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#3B82F6" />
              <span>{TOOLS.find(t => t.id === activeDrawer)?.label} ({selectedSymbol})</span>
            </div>
            <button
              onClick={() => setActiveDrawer(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94A3B8' : '#64748B' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Body */}
          <div style={{ flex: 1, padding: '16px' }}>
            <ActiveComponent ticker={selectedSymbol} />
          </div>
        </div>
      )}

      {/* ── Vertical Icon Rail (Angel One Right Rail) ── */}
      <div style={{
        width: '46px',
        height: '100%',
        backgroundColor: isDark ? '#0A0D1A' : '#F8FAFC',
        borderLeft: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 0',
        gap: '12px',
        userSelect: 'none',
        flexShrink: 0,
      }}>
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeDrawer === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool)}
              title={tool.label}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: isActive ? '1px solid #3B82F6' : '1px solid transparent',
                backgroundColor: isActive ? (isDark ? 'rgba(59,130,246,0.18)' : '#EFF6FF') : 'transparent',
                color: isActive ? '#3B82F6' : (isDark ? '#94A3B8' : '#64748B'),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = isDark ? '#1E293B' : '#E2E8F0';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
