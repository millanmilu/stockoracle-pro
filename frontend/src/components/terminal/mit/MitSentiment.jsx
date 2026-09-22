import React from 'react';
import { Gauge } from 'lucide-react';
import { BULL, BEAR, NEUT, fmtN } from './utils';
export function MitSentiment({ dist, trend, spark, loading }) {
  const r = 64; const circ = Math.PI * r;
  const frac = (dist.score + 1) / 2;
  const col = dist.score > 0.15 ? BULL : dist.score < -0.15 ? BEAR : NEUT;
  const tC = trend === 'RISING' ? BULL : trend === 'FALLING' ? BEAR : trend === 'REVERSING' ? '#818CF8' : NEUT;
  const pts = (spark || []).map((v, i) => `${(i / Math.max(1, (spark || []).length - 1)) * 220},${26 - v * 22}`).join(' ');
  return (
    <div className="mit-card">
      <div className="mit-card-h"><span className="mit-card-t"><Gauge size={13} color={col} />SENTIMENT INTELLIGENCE</span>
        <span style={{ fontSize: '.62rem', fontWeight: 800, color: tC, background: tC + '15', border: `1px solid ${tC}44`, padding: '2px 8px', borderRadius: 4 }}>{trend}</span></div>
      <div className="mit-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        {loading ? <div className="mit-skel" style={{ height: 110, width: '100%' }} /> : (
          <>
            <svg width={190} height={104} viewBox="0 0 190 104">
              <path d="M 162 96 A 64 64 0 0 0 18 96" fill="none" stroke="rgba(148,163,184,.18)" strokeWidth={13} strokeLinecap="round" />
              <path d="M 162 96 A 64 64 0 0 0 18 96" fill="none" stroke={col} strokeWidth={13} strokeLinecap="round" strokeDasharray={`${frac * circ} ${circ}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
              <text x={95} y={78} textAnchor="middle" fontSize={27} fontWeight={900} fill={col} fontFamily="'JetBrains Mono',monospace">{fmtN(dist.score)}</text>
              <text x={95} y={94} textAnchor="middle" fontSize={10} fontWeight={800} fill={col}>{dist.label}</text>
            </svg>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, width: '100%' }}>
              {[['Bullish', dist.bull, BULL], ['Neutral', dist.neu, NEUT], ['Bearish', dist.bear, BEAR]].map(([k, v, c]) => (
                <div key={k} style={{ textAlign: 'center', background: 'rgba(9,13,30,.6)', border: '1px solid rgba(148,163,184,.14)', borderRadius: 6, padding: '6px 4px' }}>
                  <div style={{ fontSize: '.56rem', fontWeight: 800, color: '#64748B' }}>{k.toUpperCase()}</div>
                  <div style={{ fontSize: '.88rem', fontWeight: 900, color: c }}>{v}%</div>
                  <div className="mit-bar" style={{ marginTop: 4 }}><i style={{ width: v + '%', background: c }} /></div>
                </div>
              ))}
            </div>
            {(spark || []).length > 1 && (
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: '.58rem', fontWeight: 800, color: '#64748B', letterSpacing: '.06em', marginBottom: 3 }}>SENTIMENT TREND</div>
                <svg width="100%" height={34} viewBox="0 0 220 34" preserveAspectRatio="none">
                  <polyline points={pts} fill="none" stroke={col} strokeWidth={1.6} />
                </svg>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
