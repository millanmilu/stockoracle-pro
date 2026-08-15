import React, { memo } from 'react';
import { THRESHOLDS } from '../../constants/screenerConfig';
import RsiBar from './RsiBar';
import VolumeChip from './VolumeChip';
import FiftyTwoWeekBar from './FiftyTwoWeekBar';
import RiskRewardBadge from './RiskRewardBadge';

/**
 * Visual Stock Card Component for Grid View
 */
const ScreenerStockCard = memo(function ScreenerStockCard({ row, onSelect }) {
  const changeUp = (row.change ?? 0) >= 0;
  const isBullTrend = row.trend === 'BULLISH';
  const predUp = (row.predicted_pct ?? 0) >= 0;

  const scoreColor =
    (row.ai_score ?? 0) >= THRESHOLDS.AI_SCORE_HIGH
      ? '#10B981'
      : (row.ai_score ?? 0) >= THRESHOLDS.AI_SCORE_MEDIUM
      ? '#F59E0B'
      : '#F43F5E';

  const signalColors = {
    buy: { text: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
    sell: { text: '#F43F5E', bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)' },
    hold: { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  };

  const sigStyle = signalColors[row.signal] || {
    text: '#9CA3AF',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.1)',
  };

  return (
    <div
      className="screener-stock-card"
      onClick={() => onSelect(row.ticker)}
      title="Click to view interactive chart"
    >
      {/* Top row: Ticker, Name, Sector & Signal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="screener-ticker" style={{ fontSize: '1.05rem' }}>{row.ticker}</span>
            <span className="screener-sector-badge">{row.sector || 'Other'}</span>
          </div>
          <div style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: 2, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name}
          </div>
        </div>

        <span
          className="screener-signal-badge"
          style={{
            color: sigStyle.text,
            background: sigStyle.bg,
            border: `1px solid ${sigStyle.border}`,
          }}
        >
          {row.signal || 'HOLD'}
        </span>
      </div>

      {/* Price and 24H Change */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '12px 0 8px' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#F0F0FF' }}>
          ₹{row.price != null ? row.price.toFixed(2) : '—'}
        </div>
        <div style={{ color: changeUp ? '#10B981' : '#F43F5E', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem' }}>
          {changeUp ? '+' : ''}{row.change != null ? row.change.toFixed(2) : '0.00'}%
        </div>
      </div>

      {/* AI Score & Trend Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 700 }}>AI SCORE:</span>
          <span style={{ fontWeight: 800, color: scoreColor, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>
            {row.ai_score ?? '—'}/100
          </span>
        </div>

        <span className={`screener-trend-badge ${isBullTrend ? 'bullish' : 'bearish'}`}>
          {isBullTrend ? 'BULLISH 📈' : 'BEARISH 📉'}
        </span>
      </div>

      {/* Target Price & Stop Loss & Risk/Reward */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8, marginBottom: 8 }}>
        <div>
          <div style={{ color: '#10B981', fontWeight: 700 }}>🎯 ₹{row.target_price_7d || '—'}</div>
          <div style={{ color: '#F43F5E', fontSize: '0.68rem' }}>🛡️ ₹{row.stop_loss || '—'}</div>
        </div>
        <RiskRewardBadge price={row.price} target={row.target_price_7d} stopLoss={row.stop_loss} />
      </div>

      {/* Technical Indicators: RSI & Volume */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '0.65rem', color: '#6B7280' }}>RSI:</span>
          <RsiBar rsi={row.rsi} />
        </div>
        <VolumeChip ratio={row.volume_ratio} />
      </div>

      {/* 52W Range Bar */}
      <div style={{ marginTop: 8 }}>
        <FiftyTwoWeekBar price={row.price} low52w={row.low_52w} high52w={row.high_52w} />
      </div>
    </div>
  );
});

/**
 * Grid View Container
 */
export default function ScreenerCardGrid({ rows, loading, onSelect }) {
  if (loading) {
    return (
      <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📭</div>
        <div className="empty-state-text">No stocks match your active filter criteria</div>
      </div>
    );
  }

  return (
    <div className="screener-card-grid">
      {rows.map((row) => (
        <ScreenerStockCard key={row.ticker} row={row} onSelect={onSelect} />
      ))}
    </div>
  );
}
