import React from 'react';
import useStore from '../store/useStore';
import { ShieldCheck, Clock, CheckCircle2 } from 'lucide-react';

export default function TrustBadge({ freshness = 'REALTIME', asOf = null }) {
  const isDark = useStore((s) => s.theme !== 'light');

  const config = {
    REALTIME: {
      color: '#10B981',
      bg: 'rgba(16,185,129,0.12)',
      border: 'rgba(16,185,129,0.25)',
      icon: ShieldCheck,
      text: 'Live NSE Feed',
    },
    DELAYED: {
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.25)',
      icon: Clock,
      text: 'Post-Market Close',
    },
    CACHED_EOD: {
      color: '#6366F1',
      bg: 'rgba(99,102,241,0.12)',
      border: 'rgba(99,102,241,0.25)',
      icon: CheckCircle2,
      text: 'Verified EOD Daily',
    },
  }[freshness] || {
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.25)',
    icon: ShieldCheck,
    text: 'Live Feed',
  };

  const Icon = config.icon;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 8px',
        borderRadius: '6px',
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        fontSize: '0.68rem',
        fontWeight: 700,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      title={`Price Source: ${config.text} ${asOf ? `(As of ${new Date(asOf).toLocaleTimeString()})` : ''}`}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: config.color,
          boxShadow: `0 0 6px ${config.color}`,
        }}
      />
      <Icon size={11} />
      <span>{config.text}</span>
    </div>
  );
}
