import React, { useState } from 'react';
import { getStockColor, formatMetricDisplay } from './heatmapUtils';

export default function HeatmapTile({
  stock,
  selectedMetric,
  sizingMode,
  isHighlighted,
  onSelect,
}) {
  const [hovered, setHovered] = useState(false);

  const metricVal = stock.metric_value ?? stock[selectedMetric] ?? stock.change_pct ?? 0.0;
  const col = getStockColor(selectedMetric, metricVal);
  const metricText = formatMetricDisplay(selectedMetric, stock);

  // Proportional sizing based on market cap tier
  let width = 90;
  let height = 80;

  if (sizingMode === 'mcap') {
    if (stock.mcap_tier === 3) {
      width = 125;
      height = 105;
    } else if (stock.mcap_tier === 2) {
      width = 105;
      height = 90;
    } else {
      width = 85;
      height = 75;
    }
  }

  const isDimmed = isHighlighted === false; // Someone is searching, but this stock didn't match

  return (
    <div
      onClick={() => onSelect(stock)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width,
        height,
        flexShrink: 0,
        background: `linear-gradient(145deg, ${col.bg}EE, ${col.bg}AA)`,
        border: `1.5px solid ${hovered || isHighlighted ? col.border : col.border}`,
        borderRadius: 10,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        padding: '6px 4px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'scale(1.09) translateY(-2px)' : (isHighlighted ? 'scale(1.04)' : 'scale(1)'),
        boxShadow: hovered || isHighlighted
          ? `0 0 25px ${col.glow}, 0 8px 20px rgba(0, 0, 0, 0.6)`
          : '0 2px 8px rgba(0, 0, 0, 0.3)',
        zIndex: hovered ? 30 : (isHighlighted ? 15 : 1),
        opacity: isDimmed ? 0.3 : 1,
        filter: isDimmed ? 'grayscale(80%)' : 'none',
      }}
    >
      {/* Ticker Symbol */}
      <span style={{
        fontSize: width >= 120 ? '0.84rem' : (width >= 100 ? '0.76rem' : '0.68rem'),
        fontWeight: 800,
        color: '#FFFFFF',
        fontFamily: 'JetBrains Mono, monospace',
        letterSpacing: '0.02em',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        lineHeight: 1.1,
      }}>
        {stock.ticker}
      </span>

      {/* Main Metric Value */}
      <span style={{
        fontSize: width >= 120 ? '0.80rem' : (width >= 100 ? '0.72rem' : '0.64rem'),
        fontWeight: 800,
        color: col.text,
        fontFamily: 'JetBrains Mono, monospace',
        lineHeight: 1.1,
      }}>
        {metricText}
      </span>

      {/* Price (Only shown on medium & large tiles) */}
      {width >= 100 && (
        <span style={{
          fontSize: '0.62rem',
          color: '#CBD5E1',
          fontFamily: 'JetBrains Mono, monospace',
          opacity: 0.9,
        }}>
          ₹{stock.price ? stock.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
        </span>
      )}

      {/* Mini AI / Badge Indicator on large tiles */}
      {width >= 120 && stock.ai_signal && (
        <span style={{
          fontSize: '0.55rem',
          fontWeight: 700,
          background: 'rgba(0,0,0,0.5)',
          padding: '1px 5px',
          borderRadius: 4,
          color: stock.ai_signal.includes('BUY') ? '#34D399' : (stock.ai_signal.includes('SELL') ? '#F87171' : '#94A3B8'),
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          AI {stock.ai_signal}
        </span>
      )}

      {/* Rich Hover Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          bottom: '115%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.98)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: 12,
          padding: '12px 16px',
          zIndex: 9999,
          minWidth: 210,
          boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.8), 0 0 20px rgba(99, 102, 241, 0.2)',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {/* Tooltip Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6 }}>
            <div>
              <div style={{ fontWeight: 800, color: '#F8FAFC', fontSize: '0.9rem', fontFamily: 'JetBrains Mono, monospace' }}>
                {stock.ticker}
              </div>
              <div style={{ color: '#94A3B8', fontSize: '0.72rem', maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stock.name}
              </div>
            </div>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 6,
              background: col.bg,
              color: col.text,
              border: `1px solid ${col.border}`,
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {stock.change_pct >= 0 ? '+' : ''}{(stock.change_pct || 0).toFixed(2)}%
            </span>
          </div>

          {/* Quick Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.7rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>LTP:</span>
              <strong style={{ color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{stock.price ? stock.price.toFixed(2) : '—'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>RSI 14:</span>
              <strong style={{ color: stock.rsi_14 > 70 ? '#C084FC' : (stock.rsi_14 < 30 ? '#38BDF8' : '#F8FAFC'), fontFamily: 'JetBrains Mono, monospace' }}>
                {(stock.rsi_14 || 50).toFixed(1)}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>1W Return:</span>
              <strong style={{ color: stock.change_1w_pct >= 0 ? '#34D399' : '#F87171', fontFamily: 'JetBrains Mono, monospace' }}>
                {stock.change_1w_pct >= 0 ? '+' : ''}{(stock.change_1w_pct || 0).toFixed(2)}%
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Vol Surge:</span>
              <strong style={{ color: stock.volume_ratio_20d > 1.5 ? '#FB923C' : '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                {(stock.volume_ratio_20d || 1).toFixed(2)}x
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>P/E Ratio:</span>
              <strong style={{ color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                {(stock.pe_ratio || 0).toFixed(1)}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>AI Score:</span>
              <strong style={{ color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
                {(stock.ai_consensus_score || 50).toFixed(0)}/100
              </strong>
            </div>
          </div>

          <div style={{
            marginTop: 4,
            paddingTop: 4,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.65rem',
            color: '#818CF8',
            textAlign: 'center',
            fontWeight: 600,
          }}>
            Click to inspect & paper trade
          </div>
        </div>
      )}
    </div>
  );
}
