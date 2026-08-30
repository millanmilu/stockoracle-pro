import React from 'react';
import { 
  Globe, BarChart3, TrendingUp, Zap, Target, Waves, 
  Sparkles, Search, RefreshCw, Layers, LayoutGrid
} from 'lucide-react';
import { UNIVERSES } from '../../constants/screenerConfig';

export const METRIC_OPTIONS = [
  { id: 'change_1d_pct', label: '1D % Change', icon: BarChart3, desc: 'Intraday Session Return' },
  { id: 'change_1w_pct', label: '1W % Return', icon: TrendingUp, desc: 'Weekly Swing Momentum' },
  { id: 'change_1m_pct', label: '1M % Return', icon: TrendingUp, desc: 'Monthly Trend Strength' },
  { id: 'rsi_14', label: 'RSI (14)', icon: Target, desc: 'Overbought (>70) / Oversold (<30)' },
  { id: 'volume_ratio_20d', label: 'Volume Surge', icon: Waves, desc: '20D Volume Breakout Ratio' },
  { id: 'pe_ratio', label: 'P/E Ratio', icon: Zap, desc: 'Price to Earnings Multiples' },
  { id: 'ai_consensus_score', label: 'AI Quant Score', icon: Sparkles, desc: 'AI Multi-Engine Rating' },
];

export default function HeatmapHeaderBar({
  selectedUniverse,
  onSelectUniverse,
  selectedMetric,
  onSelectMetric,
  searchQuery,
  onSearchChange,
  sizingMode,
  onToggleSizingMode,
  onRefresh,
  loading,
  lastUpdated,
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99, 102, 241, 0.15)',
      borderRadius: 16,
      padding: '16px 20px',
      boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.5)',
    }}>
      {/* Top Row: Title, Search, Metric Selector, Refresh */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10B981',
          }}>
            <Layers size={20} />
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}>
              Market Heatmap
            </h1>
            <p style={{ margin: 0, fontSize: '0.74rem', color: '#94A3B8', fontWeight: 500 }}>
              Institutional Sector Treemap · Real-Time Market Breadth
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{
          position: 'relative',
          minWidth: 220,
          flex: '1 1 220px',
          maxWidth: 320,
        }}>
          <Search size={15} style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#64748B',
            pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Highlight stock (e.g. RELIANCE)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 10,
              padding: '8px 12px 8px 34px',
              fontSize: '0.8rem',
              color: '#F8FAFC',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#6366F1'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(99, 102, 241, 0.25)'}
          />
        </div>

        {/* Metric Selector & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Metric Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>Metric:</span>
            <select
              value={selectedMetric}
              onChange={(e) => onSelectMetric(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 10,
                padding: '7px 12px',
                color: '#F8FAFC',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {METRIC_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.desc})
                </option>
              ))}
            </select>
          </div>

          {/* Sizing Mode Toggle */}
          <button
            onClick={onToggleSizingMode}
            title={sizingMode === 'mcap' ? 'Switch to Equal Grid Sizing' : 'Switch to Market Cap Weighted Sizing'}
            style={{
              background: sizingMode === 'mcap' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(15, 23, 42, 0.8)',
              border: `1px solid ${sizingMode === 'mcap' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: 10,
              padding: '7px 12px',
              color: sizingMode === 'mcap' ? '#818CF8' : '#94A3B8',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <LayoutGrid size={14} />
            <span>{sizingMode === 'mcap' ? 'M-Cap Weighted' : 'Equal Grid'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 10,
              padding: '7px 14px',
              color: '#10B981',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {lastUpdated && (
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
              {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Universe Filter Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 2,
        scrollbarWidth: 'none',
      }}>
        {UNIVERSES.map((u) => {
          const isActive = selectedUniverse === u.id || (selectedUniverse === 'ALL' && u.id === 'ALL NSE');
          return (
            <button
              key={u.id}
              onClick={() => onSelectUniverse(u.id === 'ALL NSE' ? 'ALL' : u.id)}
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(139, 92, 246, 0.35) 100%)'
                  : 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${isActive ? 'rgba(99, 102, 241, 0.6)' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: 20,
                padding: '5px 12px',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                fontSize: '0.74rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.2s ease',
              }}
            >
              <span>{u.icon}</span>
              <span>{u.label.replace(/^[^\w\s]+/, '').trim()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
