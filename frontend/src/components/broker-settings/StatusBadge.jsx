import React from 'react';
import { CheckCircle, XCircle, RefreshCw, AlertTriangle, Shield, Clock } from 'lucide-react';

/* ─── Status Badge ───────────────────────────────────────────────────────────── */
export default function StatusBadge({ status }) {
  const map = {
    connected:     { icon: <CheckCircle size={13} />, label: 'Session Active', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    tested:        { icon: <CheckCircle size={13} />, label: 'Test Passed', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    saving:        { icon: <RefreshCw size={13} className="broker-spin" />, label: 'Saving…', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
    failed:        { icon: <XCircle size={13} />,     label: 'Disconnected',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)'  },
    testing:       { icon: <RefreshCw size={13} className="broker-spin" />, label: 'Testing…', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    applying:      { icon: <RefreshCw size={13} className="broker-spin" />, label: 'Applying…',color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
    untested:      { icon: <AlertTriangle size={13} />, label: 'Not Tested', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
    saved:         { icon: <Shield size={13} />,        label: 'Saved in DB', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
    'coming-soon': { icon: <Clock size={13} />,         label: 'Upcoming',   color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
  };
  const s = map[status] || map.untested;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      color: s.color, background: s.bg, border: `1px solid ${s.color}33`,
    }}>
      {s.icon} {s.label}
    </span>
  );
}
