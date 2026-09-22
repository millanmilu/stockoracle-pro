import React from 'react';
import { Globe } from 'lucide-react';
import { BULL, BEAR, NEUT } from './utils';
export function MitConsensus({ consensus }) {
  return (
    <div className="mit-card">
      <div className="mit-card-h"><span className="mit-card-t"><Globe size={13} color="#818CF8" />SOURCE CONSENSUS</span>
        <span style={{ fontSize: '.6rem', fontWeight: 800, color: consensus.state === 'CONSENSUS' ? BULL : consensus.state === 'CONFLICTING REPORTS' ? BEAR : NEUT, background: 'rgba(9,13,30,.6)', border: '1px solid rgba(148,163,184,.2)', padding: '2px 8px', borderRadius: 4 }}>{consensus.state}</span></div>
      <div className="mit-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'rgba(148,163,184,.12)' }}>
          <span style={{ width: consensus.bull + '%', background: BULL }} />
          <span style={{ width: consensus.neu + '%', background: NEUT }} />
          <span style={{ width: consensus.bear + '%', background: BEAR }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
          {[['Bullish', consensus.bull, BULL, consensus.nBull + ' sources'], ['Neutral', consensus.neu, NEUT, consensus.nNeu + ' sources'], ['Bearish', consensus.bear, BEAR, consensus.nBear + ' sources']].map(([k, v, c, sub]) => (
            <div key={k}><div style={{ fontSize: '.56rem', fontWeight: 800, color: '#64748B' }}>{k.toUpperCase()}</div><div style={{ fontSize: '.9rem', fontWeight: 900, color: c }}>{v}%</div><div style={{ fontSize: '.58rem', color: '#64748B' }}>{sub}</div></div>
          ))}
        </div>
        {consensus.top && <div style={{ fontSize: '.62rem', color: '#64748B' }}>Strongest signal: <b style={{ color: '#E2E8F0' }}>{consensus.top}</b></div>}
      </div>
    </div>
  );
}
