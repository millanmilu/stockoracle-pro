import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import HeatmapTile from './HeatmapTile';
import { getStockColor } from './heatmapUtils';

export default function HeatmapSectorBlock({
  sector,
  selectedMetric,
  sizingMode,
  searchQuery,
  onSelectStock,
}) {
  const {
    sector: sectorName,
    avg_change_pct = 0.0,
    avg_metric_value = 0.0,
    total_mcap_cr = 0,
    advancers = 0,
    decliners = 0,
    stocks = [],
  } = sector;

  const col = getStockColor(selectedMetric, avg_metric_value ?? avg_change_pct);
  const q = (searchQuery || '').trim().toUpperCase();

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.7) 100%)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(99, 102, 241, 0.15)',
      borderRadius: 14,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'border-color 0.2s',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
    }}>
      {/* Sector Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        paddingBottom: 8,
      }}>
        {/* Sector Title & Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: '0.82rem',
            fontWeight: 800,
            color: '#F8FAFC',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {sectorName}
          </span>
          <span style={{
            fontSize: '0.68rem',
            color: '#94A3B8',
            background: 'rgba(255, 255, 255, 0.06)',
            padding: '2px 6px',
            borderRadius: 6,
            fontWeight: 600,
          }}>
            {stocks.length} stocks
          </span>
          {total_mcap_cr > 0 && (
            <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
              ₹{(total_mcap_cr / 1000).toFixed(1)}k Cr
            </span>
          )}
        </div>

        {/* Sector Return / Metric Badge & Breadth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mini Adv / Dec */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: '#94A3B8' }}>
            <span style={{ color: '#34D399', fontWeight: 700 }}>▲{advancers}</span>
            <span style={{ color: '#F87171', fontWeight: 700 }}>▼{decliners}</span>
          </div>

          {/* Metric Avg Badge */}
          <span style={{
            fontSize: '0.74rem',
            fontWeight: 800,
            color: col.text,
            background: col.bg,
            border: `1px solid ${col.border}`,
            padding: '2px 8px',
            borderRadius: 6,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {avg_change_pct >= 0 ? '+' : ''}{avg_change_pct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Tiles Grid */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'flex-start',
      }}>
        {stocks.map((stock) => {
          let isHighlighted = null;
          if (q) {
            isHighlighted = stock.ticker.toUpperCase().includes(q) || (stock.name || '').toUpperCase().includes(q);
          }

          return (
            <HeatmapTile
              key={stock.ticker}
              stock={stock}
              selectedMetric={selectedMetric}
              sizingMode={sizingMode}
              isHighlighted={isHighlighted}
              onSelect={onSelectStock}
            />
          );
        })}
      </div>
    </div>
  );
}
