// Pro Terminal V2 — Market Overview Panel

import React, { useState } from 'react';
import { V2_COLORS } from '../utils/constants';
import { formatChange, formatPercent } from '../utils/formatters';

export default function V2MarketOverview({ indices, sectors }) {
  const [activeTab, setActiveTab] = useState('indices');

  return (
    <div style={{ padding: '12px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {['indices', 'sectors', 'watchlist'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '3px 10px',
              fontSize: 10,
              fontWeight: 600,
              color: activeTab === tab ? V2_COLORS.accent.primary : V2_COLORS.text.muted,
              background: activeTab === tab ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'indices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {indices.map((index) => (
            <div key={index.name} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              background: V2_COLORS.bg.tertiary,
              borderRadius: 4,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: V2_COLORS.text.primary }}>{index.name}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: V2_COLORS.text.primary }}>
                  {index.value.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: index.change >= 0 ? V2_COLORS.positive : V2_COLORS.negative,
                }}>
                  {formatChange(index.change)} ({formatPercent(index.changePct)})
                </div>
                <Sparkline data={index.sparkline} positive={index.change >= 0} />
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'sectors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sectors.map((sector) => (
            <div key={sector.name} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 8px',
              background: V2_COLORS.bg.tertiary,
              borderRadius: 4,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: V2_COLORS.text.primary }}>{sector.name}</div>
                <div style={{ fontSize: 10, color: V2_COLORS.text.muted }}>{sector.marketCap}</div>
              </div>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: sector.change >= 0 ? V2_COLORS.positive : V2_COLORS.negative,
              }}>
                {formatPercent(sector.change)}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'watchlist' && (
        <div style={{ fontSize: 11, color: V2_COLORS.text.muted, textAlign: 'center', padding: 20 }}>
          No watchlist items yet
        </div>
      )}
    </div>
  );
}

function Sparkline({ data, positive }) {
  if (!data || data.length < 2) return null;

  const width = 60;
  const height = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const color = positive ? V2_COLORS.positive : V2_COLORS.negative;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  );
}
