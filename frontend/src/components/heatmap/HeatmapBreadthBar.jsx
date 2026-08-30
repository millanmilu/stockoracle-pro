import React from 'react';
import { TrendingUp, TrendingDown, Minus, Trophy, AlertTriangle } from 'lucide-react';
import { getStockColor } from './heatmapUtils';

export default function HeatmapBreadthBar({ marketBreadth, sectors = [], selectedMetric }) {
  const {
    total_stocks = 0,
    advancing = 0,
    declining = 0,
    unchanged = 0,
    advance_decline_ratio = 1.0,
    avg_change_pct = 0.0,
  } = marketBreadth || {};

  const advancePct = total_stocks ? (advancing / total_stocks) * 100 : 50;
  const declinePct = total_stocks ? (declining / total_stocks) * 100 : 50;

  // Find Top Gaining & Lagging Sectors
  const sortedSectors = [...sectors].sort((a, b) => (b.avg_change_pct || 0) - (a.avg_change_pct || 0));
  const topSector = sortedSectors[0];
  const bottomSector = sortedSectors[sortedSectors.length - 1];

  // Dynamic Legend Items based on selectedMetric
  const getLegendItems = () => {
    if (['change_1d_pct', 'change_1w_pct', 'change_1m_pct', 'change_1y_pct'].includes(selectedMetric)) {
      return [
        { label: '≤ -3%', val: -3.5 },
        { label: '-1.5%', val: -1.5 },
        { label: '0%', val: 0.0 },
        { label: '+1.5%', val: 1.5 },
        { label: '≥ +3%', val: 3.5 },
      ];
    }
    if (selectedMetric === 'rsi_14') {
      return [
        { label: '<30 Oversold', val: 25 },
        { label: '40-60 Neutral', val: 50 },
        { label: '>70 Overbought', val: 75 },
      ];
    }
    if (selectedMetric === 'volume_ratio_20d') {
      return [
        { label: '<0.8x Low', val: 0.5 },
        { label: '1.0x Normal', val: 1.0 },
        { label: '>2.0x Surge', val: 2.5 },
      ];
    }
    if (selectedMetric === 'pe_ratio') {
      return [
        { label: '<15 Value', val: 12 },
        { label: '15-30 Fair', val: 22 },
        { label: '>50 High', val: 55 },
      ];
    }
    if (selectedMetric === 'ai_consensus_score') {
      return [
        { label: '<40 Caution', val: 30 },
        { label: '50 Neutral', val: 50 },
        { label: '≥75 Strong Buy', val: 80 },
      ];
    }
    return [
      { label: '-3%', val: -3 },
      { label: '0%', val: 0 },
      { label: '+3%', val: 3 },
    ];
  };

  const legendItems = getLegendItems();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: 16,
      padding: '14px 20px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    }}>
      {/* Top Breadth Info Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        {/* Advance / Decline Counts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Market Breadth:
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 8,
            padding: '4px 10px',
          }}>
            <TrendingUp size={14} color="#10B981" />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
              {advancing} Advancing ({advancePct.toFixed(0)}%)
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 8,
            padding: '4px 10px',
          }}>
            <TrendingDown size={14} color="#F43F5E" />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>
              {declining} Declining ({declinePct.toFixed(0)}%)
            </span>
          </div>

          {unchanged > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(100, 116, 139, 0.15)',
              border: '1px solid rgba(100, 116, 139, 0.3)',
              borderRadius: 8,
              padding: '4px 8px',
            }}>
              <Minus size={13} color="#94A3B8" />
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                {unchanged} Flat
              </span>
            </div>
          )}

          <div style={{
            fontSize: '0.76rem',
            color: '#CBD5E1',
            fontFamily: 'JetBrains Mono, monospace',
            background: 'rgba(99, 102, 241, 0.1)',
            padding: '4px 10px',
            borderRadius: 8,
            border: '1px solid rgba(99, 102, 241, 0.2)',
          }}>
            A/D Ratio: <strong style={{ color: advance_decline_ratio >= 1 ? '#34D399' : '#F87171' }}>{advance_decline_ratio}</strong>
            {' · '}
            Avg Return: <strong style={{ color: avg_change_pct >= 0 ? '#34D399' : '#F87171' }}>{avg_change_pct >= 0 ? '+' : ''}{avg_change_pct}%</strong>
          </div>
        </div>

        {/* Sector Leaders / Laggards Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {topSector && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: '0.74rem',
            }}>
              <Trophy size={13} color="#10B981" />
              <span style={{ color: '#94A3B8' }}>Top Sector:</span>
              <strong style={{ color: '#F8FAFC' }}>{topSector.sector}</strong>
              <span style={{ color: '#34D399', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                {topSector.avg_change_pct >= 0 ? '+' : ''}{topSector.avg_change_pct}%
              </span>
            </div>
          )}

          {bottomSector && bottomSector !== topSector && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: '0.74rem',
            }}>
              <AlertTriangle size={13} color="#F43F5E" />
              <span style={{ color: '#94A3B8' }}>Lagging:</span>
              <strong style={{ color: '#F8FAFC' }}>{bottomSector.sector}</strong>
              <span style={{ color: '#F87171', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                {bottomSector.avg_change_pct >= 0 ? '+' : ''}{bottomSector.avg_change_pct}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar & Dynamic Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        {/* Advance/Decline Progress Bar */}
        <div style={{ flex: 1, minWidth: 200, height: 8, borderRadius: 4, overflow: 'hidden', background: '#3F0A0A', display: 'flex' }}>
          <div
            style={{
              width: `${advancePct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #059669 0%, #10B981 100%)',
              transition: 'width 0.8s ease',
            }}
          />
          <div
            style={{
              width: `${declinePct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #F43F5E 0%, #E11D48 100%)',
              transition: 'width 0.8s ease',
            }}
          />
        </div>

        {/* Dynamic Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Scale:</span>
          {legendItems.map((item) => {
            const col = getStockColor(selectedMetric, item.val);
            return (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: col.bg,
                  border: `1px solid ${col.border}`,
                }} />
                <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 600 }}>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
