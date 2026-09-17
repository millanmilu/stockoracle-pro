import React, { useState, useEffect, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, Bell, Sparkles, ArrowUpRight } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const gridCell = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '9px 11px' };
const gridLabel = { fontSize: '0.6rem', color: '#64748B', fontWeight: 700 };
const fmt = (v, d = 1) => (v === null || v === undefined ? 'N/A' : Number(v).toFixed(d));

export default function ScreenerFlyoutDrawer({ stock, onClose, onNavigateChart, onNavigateFundamentals, onAddWatchlist, onAnalyzeAI }) {
  const [detail, setDetail] = useState(stock);
  const [loading, setLoading] = useState(false);
  const [paperShares, setPaperShares] = useState(10);
  const [paperLoading, setPaperLoading] = useState(false);

  useEffect(() => { setDetail(stock); }, [stock]);

  useEffect(() => {
    if (!stock?.ticker) return;
    let cancelled = false;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/api/screener/detail/${stock.ticker}`);
        if (!cancelled && data && data.ticker) setDetail({ ...stock, ...data });
      } catch (_) {
        // Keep the table row as fallback — never fake missing fields.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDetail();
    return () => { cancelled = true; };
  }, [stock?.ticker]);

  const why = useMemo(() => {
    if (!detail) return [];
    try {
      if (Array.isArray(detail.why_parsed)) return detail.why_parsed;
      if (typeof detail.why_json === 'string' && detail.why_json) return JSON.parse(detail.why_json);
    } catch (_) {}
    return [];
  }, [detail]);

  const confluence = useMemo(() => {
    try {
      if (detail?.confluence_parsed) return detail.confluence_parsed;
      if (typeof detail?.confluence_json === 'string' && detail.confluence_json) return JSON.parse(detail.confluence_json);
    } catch (_) {}
    return null;
  }, [detail]);

  if (!stock) return null;
  const d = detail || stock;
  const isPositive = (d.change_1d_pct ?? 0) >= 0;
  const currPrice = d.close_price ?? stock.close_price ?? 0;

  const handleQuickPaperTrade = async () => {
    const qty = Math.max(1, parseInt(paperShares, 10) || 1);
    const execPrice = Number(currPrice) || 0;
    if (!execPrice || execPrice <= 0) { toast.error('No verified price available for this stock yet.'); return; }
    setPaperLoading(true);
    try {
      await api.post('/api/paper/order', { ticker: d.ticker, order_type: 'MARKET', action: 'BUY', shares: qty, price: execPrice, notes: 'Screener quick buy' });
      toast.success(`Paper BUY order placed for ${qty} shares of ${d.ticker}!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Paper trade failed');
    } finally {
      setPaperLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    const threshold = Number(currPrice) * 1.05;
    if (!threshold || threshold <= 0) { toast.error('No verified price available for this stock yet.'); return; }
    try {
      await api.post('/api/smart-alerts', { ticker: d.ticker, alert_type: 'price_above', param_value: { threshold: Math.round(threshold * 100) / 100 } });
      toast.success(`Alert set for ${d.ticker} at ₹${threshold.toFixed(2)} (+5%)`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create alert');
    }
  };

  const scoreBar = (label, v, color) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 86, fontSize: '0.62rem', color: '#94A3B8' }}>{label}</span>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#060913', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, Number(v) || 0))}%`, background: color, height: '100%' }} />
      </div>
      <span style={{ width: 34, textAlign: 'right', fontSize: '0.64rem', color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace' }}>{v ?? 'N/A'}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '440px', maxWidth: '94vw', background: '#090D1C', borderLeft: '1px solid rgba(99,102,241,0.3)', boxShadow: '-10px 0 30px rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0C1124' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFF' }}>{d.ticker}</span>
            <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#818CF8', fontSize: '0.62rem', fontWeight: 700 }}>{d.market_cap_cat || 'NSE'}</span>
            {d.data_status && d.data_status !== 'OK' && (
              <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: '0.6rem', fontWeight: 800 }}>{d.data_status === 'N/A' ? 'N/A' : 'STALE DATA'}</span>
            )}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: 2 }}>{d.name || d.ticker} • {d.sector || 'Diversified'}</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94A3B8', cursor: 'pointer', padding: '6px', display: 'flex' }}><X size={16} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 700 }}>PRICE {loading ? '(loading detail…)' : ''}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F1F5F9', fontFamily: 'JetBrains Mono, monospace' }}>₹{Number(currPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style={{ fontSize: '0.64rem', color: '#64748B' }}>MktCap ₹{Number(d.market_cap_cr || 0).toLocaleString('en-IN')} Cr</div>
          </div>
          <div style={{ padding: '6px 12px', borderRadius: 8, background: isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: isPositive ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800 }}>
            {isPositive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}{isPositive ? '+' : ''}{fmt(d.change_1d_pct, 2)}%
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: '#A855F7', fontWeight: 800 }}><Sparkles size={13} /> AI SCORE {d.ai_consensus_score != null ? d.ai_consensus_score : 'N/A'} • {d.ai_signal || 'N/A'}</span>
            <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>Conf {d.ai_confidence_score ?? 'N/A'}</span>
          </div>
          {scoreBar('Technical', confluence?.components?.trend ?? d.ai_trend_score, '#38BDF8')}
          {scoreBar('Momentum', confluence?.components?.momentum ?? d.ai_momentum_score, '#34D399')}
          {scoreBar('Volume', confluence?.components?.volume, '#A855F7')}
          {scoreBar('Structure', confluence?.components?.structure ?? d.ai_pattern_score, '#F59E0B')}
          {scoreBar('Confluence', d.confluence_score, '#818CF8')}
          {(confluence?.positives?.length || confluence?.negatives?.length) ? (
            <div style={{ fontSize: '0.66rem', color: '#CBD5E1', lineHeight: 1.5 }}>
              {(confluence.positives || []).slice(0, 4).map((p, i) => <div key={`p${i}`}>+ {p}</div>)}
              {(confluence.negatives || []).slice(0, 3).map((n, i) => <div key={`n${i}`} style={{ color: '#FCA5A5' }}>- {n}</div>)}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[['Trend', d.trend_hint], ['Momentum', d.momentum_state], ['Structure', d.structure_label], ['Regime', d.market_regime ? `${d.market_regime} (${d.regime_confidence ?? '?'}%)` : 'N/A'],
            ['RSI', d.rsi_14], ['ADX', d.adx_14], ['ATR %', d.atr_pct != null ? `${d.atr_pct}%` : 'N/A'], ['Rel Vol', d.volume_ratio_20d != null ? `${d.volume_ratio_20d}x` : 'N/A'],
            ['52W Pos', d.pos_52w_pct != null ? `${d.pos_52w_pct}%` : 'N/A'], ['Support', d.support_price != null ? `₹${d.support_price}` : 'N/A'],
            ['Resistance', d.resistance_price != null ? `₹${d.resistance_price}` : 'N/A'], ['News', d.sentiment_label || 'N/A'],
          ].map(([k, v]) => (
            <div key={k} style={gridCell}><div style={gridLabel}>{k.toUpperCase()}</div><div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#E2E8F0', marginTop: 2 }}>{v ?? 'N/A'}</div></div>
          ))}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#A5B4FC', marginBottom: 6 }}>WHY THIS STOCK?</div>
          {why.length ? (
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: '0.7rem', color: '#CBD5E1', lineHeight: 1.55 }}>
              {why.map((w, i) => <li key={i}>{w}</li>)}
            </ol>
          ) : (
            <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Traceable reasons appear once the institutional pipeline backfills this row. No claims are shown without data.</div>
          )}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', color: '#F1F5F9', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><DollarSign size={13} color="#10B981" /> Quick Paper Trade</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>Qty:</span>
            <input type="number" min="1" max="1000" value={paperShares} onChange={(e) => setPaperShares(e.target.value)} style={{ width: 70, background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '4px 8px', color: '#F1F5F9', fontSize: '0.76rem' }} />
            <span style={{ fontSize: '0.66rem', color: '#64748B' }}>≈ ₹{(currPrice * (parseInt(paperShares, 10) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          <button onClick={handleQuickPaperTrade} disabled={paperLoading} style={{ width: '100%', padding: '7px 12px', borderRadius: 6, background: '#10B981', color: '#FFF', border: 'none', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Buy Market</button>
        </div>

        <button onClick={handleCreateAlert} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
          <Bell size={13} /> Set Price Alert (+5% Target)
        </button>
      </div>

      <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#0C1124', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={() => onNavigateChart(d.ticker)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', color: '#38BDF8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Open Chart <ArrowUpRight size={12} /></button>
        <button onClick={() => onNavigateFundamentals(d.ticker)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818CF8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Fundamentals <ArrowUpRight size={12} /></button>
        <button onClick={() => onAddWatchlist && onAddWatchlist(d)} style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Add to Watchlist</button>
        <button onClick={() => onAnalyzeAI && onAnalyzeAI(d)} style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#C084FC', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Analyze with AI</button>
      </div>
    </div>
  );
}
