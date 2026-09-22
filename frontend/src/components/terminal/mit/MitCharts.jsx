import React from 'react';
import { Layers } from 'lucide-react';
function MiniBars({ data, color, fmt }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56 }}>
      {data.map((d, i) => (
        <div key={i} className="mit-tip" data-tip={`${d.k}: ${fmt ? fmt(d.v) : d.v}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <div style={{ width: '100%', background: 'rgba(148,163,184,.12)', borderRadius: 2, height: 40, display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', height: Math.max(6, (d.v / max) * 40) + 'px', background: color, borderRadius: 2, opacity: 0.55 + (d.v / max) * 0.45 }} />
          </div>
          <span style={{ fontSize: '.5rem', color: '#64748B', whiteSpace: 'nowrap' }}>{d.k}</span>
        </div>
      ))}
    </div>
  );
}
export function MitCharts({ articles, ta }) {
  const byH = {}; articles.forEach((a) => { const h = a._ageH ?? 24; const b = h < 1 ? '0-1H' : h < 6 ? '1-6H' : h < 12 ? '6-12H' : h < 24 ? '12-24H' : '24H+'; byH[b] = (byH[b] || 0) + 1; });
  const vol = ['0-1H', '1-6H', '6-12H', '12-24H', '24H+'].map((k) => ({ k, v: byH[k] || 0 }));
  const impB = ['HIGH', 'MEDIUM', 'LOW'].map((k) => ({ k, v: articles.filter((a) => a._imp === k).length }));
  const s = ta?.candlestick_series || [];
  const closes = s.slice(-40).map((r) => r.close).filter((v) => v > 0);
  const confPts = closes.length > 1 ? closes.map((c, i) => ({ k: String(i + 1), v: Math.abs((c - closes[0]) / closes[0]) * 100 + 40 })) : [];
  let px = '';
  if (closes.length > 1) {
    const lo = Math.min(...closes); const hi = Math.max(...closes); const span = Math.max(1e-9, hi - lo);
    px = closes.map((c, i) => ((i / (closes.length - 1)) * 220).toFixed(1) + ',' + (30 - ((c - lo) / span) * 26).toFixed(1)).join(' ');
  }
  return (
    <div className="mit-card">
      <div className="mit-card-h"><span className="mit-card-t"><Layers size={13} color="#38BDF8" />INTELLIGENCE CHARTS</span></div>
      <div className="mit-card-b" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <div><div style={{ fontSize: '.58rem', fontWeight: 800, color: '#64748B', marginBottom: 4 }}>NEWS VOLUME / TIME</div><MiniBars data={vol} color="#818CF8" /></div>
        <div><div style={{ fontSize: '.58rem', fontWeight: 800, color: '#64748B', marginBottom: 4 }}>IMPACT DISTRIBUTION</div><MiniBars data={impB} color="#F59E0B" /></div>
        <div>
          <div style={{ fontSize: '.58rem', fontWeight: 800, color: '#64748B', marginBottom: 4 }}>PRICE vs SENTIMENT (40 BARS)</div>
          {px ? <svg width="100%" height={56} viewBox="0 0 220 34" preserveAspectRatio="none"><polyline points={px} fill="none" stroke="#38BDF8" strokeWidth={1.6} /></svg>
            : <div style={{ fontSize: '.66rem', color: '#64748B' }}>Price series unavailable for this symbol.</div>}
        </div>
        <div><div style={{ fontSize: '.58rem', fontWeight: 800, color: '#64748B', marginBottom: 4 }}>AI CONFIDENCE TREND</div>
          {confPts.length > 1 ? <MiniBars data={confPts} color="#10B981" fmt={(v) => v.toFixed(0) + '%'} /> : <div style={{ fontSize: '.66rem', color: '#64748B' }}>Awaiting price data.</div>}</div>
      </div>
    </div>
  );
}
