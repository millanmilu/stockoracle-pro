import React from 'react';
import { THRESHOLDS } from '../../constants/screenerConfig';

/**
 * Volume surge indicator badge
 * @param {{ ratio: number|null }} props
 */
export default function VolumeChip({ ratio }) {
  if (ratio == null || isNaN(ratio)) {
    return <span style={{ color: '#4B5563' }}>—</span>;
  }

  const isSpike = ratio >= THRESHOLDS.VOLUME_SURGE_RATIO;

  return (
    <span
      style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
        color: isSpike ? '#F59E0B' : '#6B7280',
        background: isSpike ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
        border: isSpike ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid transparent',
        borderRadius: 6,
        padding: '2px 6px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      {ratio.toFixed(2)}x {isSpike && '🔥'}
    </span>
  );
}
