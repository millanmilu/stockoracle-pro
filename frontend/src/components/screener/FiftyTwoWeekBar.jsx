import React from 'react';

/**
 * 52-Week High / Low Position Range Bar
 * Visual indicator of where current price stands between 52W Low and 52W High.
 */
export default function FiftyTwoWeekBar({ price, low52w, high52w }) {
  if (!price) {
    return <span style={{ color: '#4B5563', fontSize: '0.72rem' }}>—</span>;
  }

  let currentPos = 50;
  let label = '50% of 52W';

  if (low52w != null && high52w != null) {
    if (high52w > low52w && low52w > 0) {
      const range = high52w - low52w;
      currentPos = Math.max(0, Math.min(100, ((price - low52w) / range) * 100));
      label = `${currentPos.toFixed(0)}% of 52W`;
    } else if (high52w < 0 && low52w > 0) {
      // Distance percentages format: dist_high is -4.2%, dist_low is +22.8%
      const totalDist = low52w + Math.abs(high52w);
      currentPos = totalDist > 0 ? Math.max(0, Math.min(100, (low52w / totalDist) * 100)) : 50;
      label = `${currentPos.toFixed(0)}% range`;
    }
  }

  const nearHigh = currentPos >= 80;
  const nearLow = currentPos <= 20;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 80 }} title={label}>
      <div style={{ height: 4, background: '#1a1a2e', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${currentPos}%`,
            background: nearHigh
              ? 'linear-gradient(90deg, #6366F1, #10B981)'
              : nearLow
              ? 'linear-gradient(90deg, #F43F5E, #F59E0B)'
              : 'linear-gradient(90deg, #6366F1, #818CF8)',
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.6rem', color: nearHigh ? '#10B981' : nearLow ? '#F43F5E' : '#9CA3AF', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}
