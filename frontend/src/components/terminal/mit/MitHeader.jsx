import React, { useState, useEffect } from 'react';
import useStore from '../../../store/useStore';
import api from '../../../utils/api';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { fmtN, fmtComp, isCryptoSymbol } from './utils';

/* Asset context strip: symbol · currency · 24h% · vol · mcap · volatility · regime · LIVE · updated */
export default function MitHeader({ stats, updatedAt, live }) {
  const symbol = useStore((s) => s.selectedSymbol) || 'RELIANCE';
  const setSymbol = useStore((s) => s.setSelectedSymbol);
  const wsConnected = useStore((s) => s.wsConnected);
  const wsLiveData = useStore((s) => s.wsLiveData);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);

  const isCrypto = isCryptoSymbol(symbol);
  const currSym = isCrypto ? '$' : '₹';
  const exchangeLabel = isCrypto ? '/USD' : '/NSE';

  useEffect(() => {
    if (q.trim().length < 1) { setHits([]); return; }
    const t = setTimeout(() => {
      api.get('/api/stocks/search', { params: { query: q, limit: 6 } })
        .then((r) => setHits(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const up = (stats.chgPct || 0) >= 0;
  const liveOk = wsConnected && (wsLiveData || live);

  const Item = ({ k, v, c }) => (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span style={{ fontSize: '.54rem', fontWeight: 800, letterSpacing: '.08em', color: '#64748B' }}>{k}</span>
      <span style={{ fontSize: '.72rem', fontWeight: 800, color: c || '#F1F5F9', fontFamily: "'JetBrains Mono',monospace", whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  );

  return (
    <div className="mit-card" style={{ borderColor: 'rgba(129,140,248,.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '.88rem', fontWeight: 900, color: '#F8FAFC', letterSpacing: '-.01em' }}>
            {symbol}<span style={{ color: '#64748B', fontWeight: 600, fontSize: '.74rem' }}>{exchangeLabel}</span>
          </span>
          <span style={{ fontSize: '.98rem', fontWeight: 900, fontFamily: "'JetBrains Mono',monospace", color: up ? '#10B981' : '#F43F5E' }}>
            {stats.price != null ? currSym + fmtN(stats.price) : '—'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '.66rem', fontWeight: 800, color: up ? '#10B981' : '#F43F5E', background: up ? 'rgba(16,185,129,.12)' : 'rgba(244,63,94,.12)', border: `1px solid ${up ? 'rgba(16,185,129,.35)' : 'rgba(244,63,94,.35)'}`, padding: '1px 6px', borderRadius: 4 }}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{up ? '+' : ''}{fmtN(stats.chgPct)}%
          </span>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(148,163,184,.15)' }} />
        <Item k="24H VOL" v={stats.vol24 != null ? currSym + fmtComp(stats.vol24) : '—'} />
        <Item k="MKT CAP" v={stats.mcap != null ? currSym + fmtComp(stats.mcap) : '—'} />
        <Item k="VOLATILITY" v={stats.vola != null ? fmtN(stats.vola, 1) + '%' : '—'} />
        <Item k="REGIME" v={stats.regime || '—'} c="#818CF8" />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(9,13,30,.9)', border: '1px solid rgba(148,163,184,.22)', borderRadius: 4, padding: '3px 7px' }}>
              <Search size={11} color="#64748B" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search symbol…"
                className="mit-inp"
                style={{ border: 'none', background: 'transparent', padding: 0, width: 110 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && q.trim()) {
                    setSymbol(q.trim().toUpperCase());
                    setQ('');
                    setHits([]);
                  }
                }}
              />
            </div>
            {hits.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#0F172A', border: '1px solid rgba(129,140,248,.4)', borderRadius: 6, zIndex: 50, overflow: 'hidden' }}>
                {hits.slice(0, 6).map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSymbol(String(h.symbol || h.ticker || '').toUpperCase());
                      setQ('');
                      setHits([]);
                    }}
                    className="mit-chipbtn"
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderRadius: 0, padding: '6px 10px' }}
                  >
                    {h.symbol || h.ticker} <span style={{ opacity: 0.6 }}>{h.name || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="mit-tip" data-tip={liveOk ? 'Streaming live ticks' : 'Waiting for live feed'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.66rem', fontWeight: 800, color: liveOk ? '#10B981' : '#F59E0B' }}>
            <span className="mit-live-dot" style={liveOk ? {} : { background: '#F59E0B', boxShadow: '0 0 8px #F59E0B' }} />{liveOk ? 'LIVE' : 'DELAYED'}
          </span>
          <span style={{ fontSize: '.64rem', color: '#64748B', fontFamily: "'JetBrains Mono',monospace" }}>{updatedAt ? 'UPD ' + updatedAt : ''}</span>
        </div>
      </div>
    </div>
  );
}
