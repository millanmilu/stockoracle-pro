import React, { memo } from 'react';
import { THRESHOLDS } from '../../constants/screenerConfig';
import RsiBar from './RsiBar';
import VolumeChip from './VolumeChip';
import FiftyTwoWeekBar from './FiftyTwoWeekBar';
import RiskRewardBadge from './RiskRewardBadge';

/**
 * Enhanced Table Row Component with 52W Bar, Risk/Reward Ratio, and Action Icons
 */
function ScreenerTableRowComponent({ row, onSelect }) {
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
    <tr onClick={() => onSelect(row.ticker)} title="Click to view interactive chart">
      <td>
        <span className="screener-ticker">{row.ticker}</span>
      </td>
      <td style={{ color: '#9CA3AF', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {row.name || '—'}
      </td>
      <td>
        <span className="screener-sector-badge">{row.sector || 'Other'}</span>
      </td>
      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
        ₹{row.price != null ? row.price.toFixed(2) : '—'}
      </td>
      <td
        style={{
          color: changeUp ? '#10B981' : '#F43F5E',
          fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {changeUp ? '+' : ''}
        {row.change != null ? row.change.toFixed(2) : '0.00'}%
      </td>
      <td>
        <span className={`screener-trend-badge ${isBullTrend ? 'bullish' : 'bearish'}`}>
          {isBullTrend ? 'BULLISH 📈' : 'BEARISH 📉'}
        </span>
      </td>
      <td>
        <span style={{ fontWeight: 800, color: scoreColor, fontFamily: 'JetBrains Mono, monospace' }}>
          {row.ai_score ?? '—'}
        </span>
      </td>
      <td>
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
      </td>
      <td style={{ color: predUp ? '#10B981' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
        {row.predicted_pct != null ? `${predUp ? '+' : ''}${row.predicted_pct.toFixed(2)}%` : '—'}
      </td>
      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem' }}>
        <div style={{ color: '#10B981', fontWeight: 700 }}>🎯 ₹{row.target_price_7d || '—'}</div>
        <div style={{ color: '#F43F5E', fontSize: '0.68rem' }}>🛡️ ₹{row.stop_loss || '—'}</div>
      </td>
      <td>
        <RiskRewardBadge price={row.price} target={row.target_price_7d} stopLoss={row.stop_loss} />
      </td>
      <td>
        <RsiBar rsi={row.rsi} />
      </td>
      <td>
        <VolumeChip ratio={row.volume_ratio} />
      </td>
      <td>
        <FiftyTwoWeekBar price={row.price} low52w={row.low_52w} high52w={row.high_52w} />
      </td>
      <td>
        <button
          type="button"
          className="screener-row-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(row.ticker);
          }}
          title="Open in Chart View"
        >
          📈
        </button>
      </td>
    </tr>
  );
}

export const ScreenerTableRow = memo(ScreenerTableRowComponent);
export default ScreenerTableRow;
