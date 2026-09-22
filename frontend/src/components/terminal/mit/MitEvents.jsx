import React, { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { timeAgo } from './utils';
const SEV_C = { CRITICAL: '#F43F5E', HIGH: '#FB923C', MEDIUM: '#F59E0B', LOW: '#64748B' };
export function MitEvents({ events }) {
  const [open, setOpen] = useState(false);
  const vis = open ? events : events.slice(0, 4);
  return (
    <div className="mit-card">
      <div className="mit-card-h"><span className="mit-card-t"><AlertTriangle size={13} color="#FB923C" />AI EVENT RADAR <span style={{ color: '#475569' }}>· {events.length}</span></span>
        {events.length > 4 && <button onClick={() => setOpen((o) => !o)} className="mit-chipbtn">{open ? 'Less' : 'All'}</button>}</div>
      <div className="mit-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {events.length === 0 && <div style={{ fontSize: '.70rem', color: '#64748B' }}>No high-severity events detected in the current window.</div>}
        {vis.map((e, i) => (
          <div
            key={i}
            className="mit-tip"
            data-tip={`${e.count} related headline${e.count > 1 ? 's' : ''}`}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              background: 'rgba(9,13,30,.55)',
              border: `1px solid ${SEV_C[e.sev]}33`,
              borderRadius: 5,
              padding: '5px 8px',
            }}
          >
            <span
              style={{
                fontSize: '.54rem',
                fontWeight: 900,
                color: SEV_C[e.sev],
                background: SEV_C[e.sev] + '15',
                border: `1px solid ${SEV_C[e.sev]}44`,
                padding: '1px 5px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                marginTop: 1,
              }}
            >
              {e.sev}
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span
                className="mit-line-clamp-2"
                style={{
                  display: 'block',
                  fontSize: '.68rem',
                  fontWeight: 700,
                  color: '#E2E8F0',
                  lineHeight: 1.3,
                }}
              >
                {e.title}
              </span>
              <span style={{ fontSize: '.56rem', color: '#64748B' }}>
                {e.tag} · {e.source} · {timeAgo(e.when) || 'recent'}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
