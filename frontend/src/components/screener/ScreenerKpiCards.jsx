import React from 'react';

/**
 * Screener KPI metrics summary cards with modern glassmorphism
 */
export default function ScreenerKpiCards({ stats }) {
  const cards = [
    { label: 'TOTAL MATCHES', value: stats.total, color: '#818CF8', bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.2)', icon: '📊' },
    { label: 'BULLISH ALIGNED', value: stats.bullish, color: '#10B981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)', icon: '🚀' },
    { label: 'VOLUME SURGES', value: stats.volumeSurges, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', icon: '🔥' },
    { label: 'OVERSOLD VALUE', value: stats.oversold, color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.2)', icon: '💎' },
    { label: 'AVG AI CONSENSUS', value: `${stats.avgScore}/100`, color: '#A855F7', bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.2)', icon: '🤖' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
      gap: 10,
      width: '100%'
    }}>
      {cards.map((kpi) => (
        <div
          key={kpi.label}
          style={{
            background: kpi.bg,
            border: `1px solid ${kpi.border}`,
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 800, letterSpacing: '0.04em' }}>
              {kpi.label}
            </div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 900,
              color: kpi.color,
              fontFamily: 'JetBrains Mono, monospace',
              marginTop: 2
            }}>
              {kpi.value}
            </div>
          </div>
          <span style={{ fontSize: '1.3rem' }}>{kpi.icon}</span>
        </div>
      ))}
    </div>
  );
}
