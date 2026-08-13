import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';

// Color scale: deep red (-3%) → amber (0%) → deep green (+3%)
function changeToColor(pct) {
  if (pct >= 3.0)  return { bg: '#064e3b', text: '#34d399', border: '#10B981' };
  if (pct >= 1.5)  return { bg: '#065f46', text: '#6ee7b7', border: '#34D399' };
  if (pct >= 0.5)  return { bg: '#064e3b90', text: '#a7f3d0', border: '#10B98180' };
  if (pct >= 0.0)  return { bg: '#022c22', text: '#6ee7b7', border: '#10B98140' };
  if (pct >= -0.5) return { bg: '#3f0a0a', text: '#fca5a5', border: '#F43F5E40' };
  if (pct >= -1.5) return { bg: '#7f1d1d', text: '#fca5a5', border: '#F43F5E80' };
  return              { bg: '#450a0a', text: '#f87171', border: '#F43F5E' };
}

function SectorLabel({ sector, avgChange }) {
  const c = changeToColor(avgChange);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 8 }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9CA3AF',
        letterSpacing: '0.08em', textTransform: 'uppercase' }}>{sector}</span>
      <span style={{
        fontSize: '0.72rem', fontWeight: 700, color: c.text,
        fontFamily: 'JetBrains Mono, monospace'
      }}>
        {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
      </span>
    </div>
  );
}

function HeatmapTile({ stock, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const c = changeToColor(stock.change_pct);

  const tileSize = stock.mcap_tier === 3 ? 100 : stock.mcap_tier === 2 ? 80 : 65;

  return (
    <div
      onClick={() => onClick(stock.ticker)}
      onMouseEnter={() => { setHovered(true); setShowTooltip(true); }}
      onMouseLeave={() => { setHovered(false); setShowTooltip(false); }}
      style={{
        position: 'relative',
        width: tileSize, height: tileSize,
        background: `linear-gradient(135deg, ${c.bg}, ${c.bg}dd)`,
        border: `1px solid ${c.border}`,
        borderRadius: 10, cursor: 'pointer', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2,
        transition: 'all 0.2s', overflow: 'visible',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        boxShadow: hovered ? `0 0 20px ${c.border}60, 0 4px 15px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)',
        zIndex: hovered ? 10 : 1,
      }}
    >
      <span style={{
        fontSize: tileSize >= 100 ? '0.78rem' : '0.68rem',
        fontWeight: 800, color: c.text,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {stock.ticker}
      </span>
      <span style={{
        fontSize: tileSize >= 100 ? '0.72rem' : '0.62rem',
        fontWeight: 700, color: c.text,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div style={{
          position: 'absolute', bottom: '110%', left: '50%',
          transform: 'translateX(-50%)',
          background: '#0C1022', border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: 10, padding: '10px 14px', zIndex: 999,
          minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 700, color: '#F0F0FF', fontSize: '0.85rem', marginBottom: 6 }}>
            {stock.ticker}
          </div>
          <div style={{ color: '#9CA3AF', fontSize: '0.75rem', marginBottom: 4 }}>{stock.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: '#6B7280', fontSize: '0.72rem' }}>Price</span>
            <span style={{ color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>
              ₹{stock.price?.toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: '#6B7280', fontSize: '0.72rem' }}>Change</span>
            <span style={{ color: c.text, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.72rem' }}>
              {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
            </span>
          </div>
          <div style={{
            marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.68rem', color: '#6366F1', textAlign: 'center'
          }}>Click to view chart</div>
        </div>
      )}
    </div>
  );
}

function SectorBlock({ sector: sectorName, avgChange, stocks, onSelect }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0C1022, #10142a)',
      border: '1px solid rgba(99,102,241,0.15)',
      borderRadius: 14, padding: '16px 18px',
    }}>
      <SectorLabel sector={sectorName} avgChange={avgChange} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {stocks.map(s => (
          <HeatmapTile key={s.ticker} stock={s} onClick={onSelect} />
        ))}
      </div>
    </div>
  );
}

// ── Color Legend ─────────────────────────────────────────────────────────────
function ColorLegend() {
  const stops = [
    { label: '−3%+', pct: -3 }, { label: '−1.5%', pct: -1.5 },
    { label: '0%', pct: 0 },
    { label: '+1.5%', pct: 1.5 }, { label: '+3%+', pct: 3 },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: '0.72rem', color: '#4B5563', marginRight: 8 }}>Change</span>
      {stops.map(s => {
        const c = changeToColor(s.pct);
        return (
          <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 32, height: 12, background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 3 }} />
            <span style={{ fontSize: '0.62rem', color: '#4B5563' }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function MarketHeatmap() {
  const { setSelectedSymbol, setActiveView } = useStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/market/heatmap')
      .then(r => {
        setData(r.data);
        setLastUpdated(new Date().toLocaleTimeString());
      })
      .catch(() => setError('Failed to load heatmap data.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // Auto-refresh every 60s
    return () => clearInterval(interval);
  }, [load]);

  const handleSelect = (ticker) => {
    setSelectedSymbol(ticker);
    setActiveView('Live Chart');
  };

  if (loading && !data) return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="spinner" />
      <p style={{ color: '#6366F1', fontSize: '0.9rem' }}>Loading market heatmap…</p>
    </div>
  );

  if (error && !data) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: '#F43F5E', marginBottom: 12 }}>{error}</div>
      <button onClick={load} style={{
        background: '#6366F1', color: '#fff', border: 'none',
        borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600
      }}>Retry</button>
    </div>
  );

  const { sectors = [] } = data || {};

  // Market breadth stats
  const allStocks = sectors.flatMap(s => s.stocks);
  const gainers = allStocks.filter(s => s.change_pct > 0).length;
  const losers = allStocks.filter(s => s.change_pct < 0).length;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800,
            background: 'linear-gradient(135deg, #10B981, #06B6D4)', WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent' }}>
            Market Heatmap
          </h2>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.85rem' }}>
            NSE sector performance · Click any tile to open chart
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.72rem', color: '#4B5563' }}>Updated {lastUpdated}</span>
          )}
          <button onClick={load} style={{
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
            color: '#10B981', borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
            fontSize: '0.8rem', fontWeight: 600
          }}>↺ Refresh</button>
        </div>
      </div>

      {/* Market Breadth Bar */}
      <div style={{
        background: 'linear-gradient(135deg, #0C1022, #10142a)',
        border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14,
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16
      }}>
        <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Market Breadth
        </span>
        <div style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden',
          background: '#F43F5E', display: 'flex' }}>
          <div style={{
            width: `${allStocks.length ? gainers / allStocks.length * 100 : 50}%`,
            height: '100%', background: '#10B981', transition: 'width 0.8s ease'
          }} />
        </div>
        <span style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
          ▲ {gainers}
        </span>
        <span style={{ fontSize: '0.78rem', color: '#F43F5E', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
          ▼ {losers}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <ColorLegend />
        </div>
      </div>

      {/* Heatmap Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {sectors.map(sec => (
          <SectorBlock
            key={sec.sector}
            sector={sec.sector}
            avgChange={sec.avg_change_pct}
            stocks={sec.stocks}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
