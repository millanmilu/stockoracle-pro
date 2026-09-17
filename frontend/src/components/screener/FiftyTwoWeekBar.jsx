import React from 'react';

/**
 * 52-Week High / Low Position Range Bar
 * Visual indicator of where current price stands between 52W Low and 52W High.
 *
 * Props use ScreenerDailyMetric *distance* percentages (NOT absolute prices):
 *   dist_high = (price - high52w) / high52w * 100  (<= 0 when below the high)
 *   dist_low  = (price - low52w)  / low52w  * 100  (>= 0 when above the low)
 */
export default function FiftyTwoWeekBar({ price, low52w, high52w }) {
  if (!price) {
    return <span style={{ color: '#4B5563', fontSize: '0.72rem' }}>—</span>;
  }

  // Position of price within the [low52w .. high52w] range, derived purely
  // from distances so rupee prices are never mixed with percentages.
  let currentPos = 50;
  let label = '50% of 52W';
  let hasRange = false;

  if (typeof high52w === 'number' && typeof low52w === 'number' && isFinite(high52w) && isFinite(low52w)) {
    const span = Math.abs(low52w) + Math.abs(high52w);
    if (span > 0) {
      if (high52w >= 0 && low52w >= 0) {
        currentPos = 100; // at or above the 52W high
      } else if (low52w <= 0 && high52w <= 0) {
        currentPos = 0; // at or below the 52W low
      } else {
        // Normal case (high < 0 < low): fraction up from the low.
        currentPos = Math.max(0, Math.min(100, (low52w / span) * 100));
      }
      label = `${currentPos.toFixed(0)}% of 52W`;
      hasRange = true;
    }
  }

  if (!hasRange) {
    return <span style={{ color: '#4B5563', fontSize: '0.72rem' }}>—</span>;
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
