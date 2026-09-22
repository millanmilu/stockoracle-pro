import React from 'react';
import { Flame } from 'lucide-react';
export function MitFearGreed({ fg }) {
  const r = 56; const circ = Math.PI * r;
  const hist = fg.hist || [];
  return (
    <div className="mit-card">
      <div className="mit-card-h"><span className="mit-card-t"><Flame size={13} color={fg.color} />FEAR &amp; GREED RADAR</span></div>
      <div className="mit-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'center' }}>
        <svg width={170} height={94} viewBox="0 0 170 94">
          <path d="M 146 86 A 56 56 0 0 0 14 86" fill="none" stroke="rgba(148,163,184,.18)" strokeWidth={12} strokeLinecap="round" />
          <path d="M 146 86 A 56 56 0 0 0 14 86" fill="none" stroke={fg.color} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${(fg.value / 100) * circ} ${circ}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
          <text x={80} y={68} textAnchor="middle" fontSize={26} fontWeight={900} fill={fg.color} fontFamily="'JetBrains Mono',monospace">{fg.value}</text>
          <text x={80} y={84} textAnchor="middle" fontSize={9} fontWeight={800} fill={fg.color}>{fg.label.toUpperCase()}</text>
        </svg>
        {hist.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${hist.length},1fr)`, gap: 5, width: '100%' }}>
            {hist.map((h) => (
              <div key={h.k} className="mit-tip" data-tip={h.hint} style={{ textAlign: 'center', background: 'rgba(9,13,30,.6)', border: '1px solid rgba(148,163,184,.14)', borderRadius: 5, padding: '5px 2px' }}>
                <div style={{ fontSize: '.54rem', fontWeight: 800, color: '#64748B' }}>{h.k}</div>
                <div style={{ fontSize: '.76rem', fontWeight: 900, color: h.c, fontFamily: "'JetBrains Mono',monospace" }}>{h.v}</div>
              </div>
            ))}
          </div>
        )}
        {fg.note && <div style={{ fontSize: '.62rem', color: '#64748B', textAlign: 'center' }}>{fg.note}</div>}
      </div>
    </div>
  );
}
