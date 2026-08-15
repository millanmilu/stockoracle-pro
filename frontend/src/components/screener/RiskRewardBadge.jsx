import React from 'react';

/**
 * Risk-to-Reward Ratio Badge
 * Calculates potential upside to 7D Target vs downside to Stop Loss.
 * @param {{ price: number, target: number|null, stopLoss: number|null }} props
 */
export default function RiskRewardBadge({ price, target, stopLoss }) {
  if (!price || !target || !stopLoss || target <= price || stopLoss >= price) {
    return <span style={{ color: '#4B5563', fontSize: '0.72rem' }}>—</span>;
  }

  const potentialGain = target - price;
  const potentialLoss = price - stopLoss;
  const rrRatio = potentialLoss > 0 ? (potentialGain / potentialLoss) : 1;

  const isExcellent = rrRatio >= 2.5;
  const isGood = rrRatio >= 1.5;

  const color = isExcellent ? '#10B981' : isGood ? '#38BDF8' : '#F59E0B';
  const bg = isExcellent
    ? 'rgba(16, 185, 129, 0.12)'
    : isGood
    ? 'rgba(56, 189, 248, 0.12)'
    : 'rgba(245, 158, 11, 0.12)';

  return (
    <span
      style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
        color,
        background: bg,
        border: `1px solid ${color}35`,
        borderRadius: 6,
        padding: '2px 6px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        whiteSpace: 'nowrap',
      }}
      title={`Risk: ₹${potentialLoss.toFixed(1)} | Reward: ₹${potentialGain.toFixed(1)} | Ratio: 1:${rrRatio.toFixed(1)}`}
    >
      <span>⚖️ 1:{rrRatio.toFixed(1)}</span>
    </span>
  );
}
