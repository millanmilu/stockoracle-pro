import React from 'react';

/**
 * Screener KPI metrics summary cards
 * @param {{ stats: { total: number, bullish: number, volumeSurges: number, oversold: number, avgScore: string|number } }} props
 */
export default function ScreenerKpiCards({ stats }) {
  const cards = [
    { label: 'TOTAL STOCKS SCANNED', value: stats.total, color: '#818CF8', icon: '📊' },
    { label: 'BULLISH CANDIDATES', value: stats.bullish, color: '#10B981', icon: '🚀' },
    { label: 'VOLUME BREAKOUTS', value: stats.volumeSurges, color: '#F59E0B', icon: '🔥' },
    { label: 'OVERSOLD BARGAINS', value: stats.oversold, color: '#06B6D4', icon: '💎' },
    { label: 'AVG AI CONFIDENCE', value: `${stats.avgScore}/100`, color: '#A855F7', icon: '🤖' },
  ];

  return (
    <div className="screener-kpi-grid">
      {cards.map((kpi) => (
        <div key={kpi.label} className="screener-kpi-card">
          <div>
            <div className="screener-kpi-label">{kpi.label}</div>
            <div className="screener-kpi-value" style={{ color: kpi.color }}>
              {kpi.value}
            </div>
          </div>
          <span className="screener-kpi-icon">{kpi.icon}</span>
        </div>
      ))}
    </div>
  );
}
