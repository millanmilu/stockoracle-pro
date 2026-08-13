import React from 'react';
import useStore from '../store/useStore';
import {
  LayoutDashboard,
  BrainCircuit,
  Newspaper,
  TrendingUp,
  BarChart3,
  Activity,
  Dices,
  History,
  RefreshCw,
  CandlestickChart,
  Wallet,
  Bell,
  Sun,
  Moon,
  Brain,
  SlidersHorizontal,
  Grid3X3,
  Globe,
  GitFork,
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { name: 'Dashboard',     icon: LayoutDashboard },
  { name: 'Live Chart',    icon: CandlestickChart },
  { name: 'AI Prediction', icon: BrainCircuit },
  { name: 'News',          icon: Newspaper },
  { name: 'Patterns',      icon: TrendingUp },
  { name: 'Levels',        icon: BarChart3 },
  { name: 'Volatility',    icon: Activity },
  { name: 'Monte Carlo',   icon: Dices },
  { name: 'Backtest',      icon: History },
  { name: 'Price Alerts',  icon: Bell },
  { name: '__divider__' },
  { name: 'Sentiment',     icon: Brain,             badge: 'NEW' },
  { name: 'Adv. Screener', icon: SlidersHorizontal, badge: 'NEW' },
  { name: 'Heatmap',       icon: Grid3X3,           badge: 'NEW' },
  { name: 'Macro Data',    icon: Globe,             badge: 'NEW' },
  { name: 'Supply Chain',  icon: GitFork,           badge: 'NEW' },
];

export default function Sidebar() {
  const { activeView, setActiveView, selectedSymbol, setTrainingStatus, theme, setTheme } = useStore();

  const handleRetrain = async () => {
    try {
      const { data } = await api.post(`/api/stock/${selectedSymbol}/train`);
      toast.success(`Training started for ${selectedSymbol}`);

      // Poll task status
      const interval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/api/task/${data.task_id}/status`);
          setTrainingStatus(statusRes.data);
          if (statusRes.data.status === 'completed') {
            clearInterval(interval);
            toast.success(`Training Complete! MAPE: ${(statusRes.data.mape * 100).toFixed(2)}%`);
            setTrainingStatus(null);
          } else if (statusRes.data.status === 'failed') {
            clearInterval(interval);
            toast.error(`Training failed: ${statusRes.data.error || 'Unknown error'}`);
            setTrainingStatus(null);
          }
        } catch (err) {
          console.error('Polling error', err);
        }
      }, 2000);
    } catch (err) {
      toast.error('Failed to start training');
    }
  };

  const isDark = theme !== 'light';

  return (
    <div style={{
      width: '220px', height: '100vh',
      backgroundColor: 'var(--sidebar-bg, #1a1a1a)',
      borderRight: '1px solid var(--border, #333)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Logo + theme toggle */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0ea5e9' }}>StockOracle Pro</div>
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 4 }}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          if (item.name === '__divider__') {
            return (
              <div key="divider" style={{
                margin: '6px 8px 4px',
                borderTop: '1px solid rgba(99,102,241,0.15)',
                position: 'relative'
              }}>
                <span style={{
                  position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--sidebar-bg, #1a1a1a)', padding: '0 6px',
                  fontSize: '0.6rem', color: '#4B5563', fontWeight: 600,
                  letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap'
                }}>New Features</span>
              </div>
            );
          }
          return (
            <div
              key={item.name}
              onClick={() => setActiveView(item.name)}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: activeView === item.name ? '#fff' : 'var(--text-muted, #888)',
                backgroundColor: activeView === item.name ? '#333' : 'transparent',
                transition: 'all 0.2s',
                fontSize: '0.9rem',
                flexShrink: 0,
              }}
            >
              <item.icon size={18} />
              <span style={{ flex: 1 }}>{item.name}</span>
              {item.badge && (
                <span style={{
                  fontSize: '0.55rem', fontWeight: 700, color: '#6366F1',
                  background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em'
                }}>{item.badge}</span>
              )}
              {item.name === 'Price Alerts' && <Bell size={10} style={{ marginLeft: 'auto', color: '#F59E0B' }} />}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '20px', borderTop: '1px solid var(--border, #333)' }}>
        <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: 8, textAlign: 'center' }}>
          {selectedSymbol}
        </div>
        <button
          onClick={handleRetrain}
          style={{
            width: '100%', padding: '10px',
            backgroundColor: '#0ea5e9', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            fontWeight: 600,
          }}
        >
          <RefreshCw size={18} /> Retrain AI
        </button>
      </div>
    </div>
  );
}
