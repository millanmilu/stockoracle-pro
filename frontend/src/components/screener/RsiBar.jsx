import React from 'react';
import { THRESHOLDS } from '../../constants/screenerConfig';

/**
 * Visual RSI indicator gauge
 * @param {{ rsi: number|null }} props
 */
export default function RsiBar({ rsi }) {
  if (rsi == null || isNaN(rsi)) {
    return <span style={{ color: '#4B5563' }}>—</span>;
  }

  const isOversold = rsi < THRESHOLDS.RSI_OVERSOLD;
  const isOverbought = rsi > THRESHOLDS.RSI_OVERBOUGHT;
  const color = isOversold ? '#F43F5E' : isOverbought ? '#10B981' : '#F59E0B';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 36, height: 6, background: '#1a1a2e', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(100, Math.max(0, rsi))}%`,
            height: '100%',
            background: color,
            borderRadius: 3,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <span style={{ fontSize: '0.78rem', color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
        {rsi.toFixed(0)}
      </span>
    </div>
  );
}
