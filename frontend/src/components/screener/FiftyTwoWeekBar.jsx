import React from 'react';

/**
 * 52-Week High / Low Position Range Bar
 * Visual indicator of where the current price stands between 52W Low and 52W High.
 * @param {{ price: number, low52w: number|null, high52w: number|null }} props
 */
export default function FiftyTwoWeekBar({ price, low52w, high52w }) {
  if (!price || !low52w || !high52w || high52w <= low52w) {
    return <span style={{ color: '#4B5563', fontSize: '0.72rem' }}>—</span>;
  }

  const range = high52w - low52w;
  const currentPos = Math.max(0, Math.min(100, ((price - low52w) / range) * 100));
  const nearHigh = currentPos >= 85;
  const nearLow = currentPos <= 15;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 105 }} title={`52W Range: ₹${low52w.toFixed(0)} - ₹${high52w.toFixed(0)} (${currentPos.toFixed(0)}%)`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#6B7280', fontFamily: 'JetBrains Mono, monospace' }}>
        <span>L: ₹{low52w.toFixed(0)}</span>
        <span>H: ₹{high52w.toFixed(0)}</span>
      </div>
      <div style={{ height: 5, background: '#1a1a2e', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
        {/* Fill bar */}
        <div
          style={{
            height: '100%',
            width: `${currentPos}%`,
            background: nearHigh
              ? 'linear-gradient(90deg, #6366F1, #10B981)'
              : nearLow
              ? 'linear-gradient(90deg, #F43F5E, #F59E0B)'
              : 'linear-gradient(90deg, #6366F1, #818CF8)',
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.62rem', color: nearHigh ? '#10B981' : nearLow ? '#F43F5E' : '#9CA3AF', fontWeight: 600 }}>
        {currentPos.toFixed(0)}% of 52W
      </div>
    </div>
  );
}
