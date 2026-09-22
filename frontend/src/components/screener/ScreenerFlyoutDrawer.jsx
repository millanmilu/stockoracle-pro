import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, Sparkles, ArrowUpRight } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { TN, panel, sectionTitle, btn, btnPrimary, btnGreen, chip, num } from './terminalTheme';

const DRAWER_W_KEY = 'stockoracle_drawer_w';
const loadDrawerW = () => {
  try {
    const v = Number(localStorage.getItem(DRAWER_W_KEY));
    if (Number.isFinite(v)) return Math.max(320, Math.min(680, v));
  } catch (_) {}
  return 440;
};

const gridCell = { background: 'rgba(148,163,184,0.04)', border: `1px solid ${TN.border}`, borderRadius: TN.radius, padding: '7px 9px' };
const gridLabel = { fontSize: 10, color: TN.faint, fontWeight: 700, letterSpacing: '0.06em' };
const fmt = (v, d = 1) => (v === null || v === undefined ? 'N/A' : Number(v).toFixed(d));

/**
 * Right-side stock detail drawer. Tabs: Overview / AI Analysis / Details.
 * The AI tab frames every output as model analysis with confidence, and
 * each AI indicator row is explicitly LIVE (backed by a real field) or
 * UNAVAILABLE (no model wired) — never fabricated.
 * Resizable via the left-edge grip; width is remembered.
 */
export default function ScreenerFlyoutDrawer({ stock, onClose, onNavigateChart, onNavigateFundamentals, onAddWatchlist, onAnalyzeAI }) {
  const [detail, setDetail] = useState(stock);
  const [loading, setLoading] = useState(false);
  const [paperShares, setPaperShares] = useState(10);
  const [paperLoading, setPaperLoading] = useState(false);
  const [tab, setTab] = useState('overview');
  const [width, setWidth] = useState(() => loadDrawerW());

  useEffect(() => { setDetail(stock); setTab('overview'); }, [stock?.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [stock?.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const beginResize = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const clampW = (v) => Math.max(320, Math.min(680, Math.round(v)));
    const onMove = (mv) => setWidth(clampW(startW + (startX - mv.clientX)));
    const onUp = (mv) => {
      try { localStorage.setItem(DRAWER_W_KEY, String(clampW(startW + (startX - mv.clientX)))); } catch (_) {}
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width]);

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
      <span style={{ width: 92, fontSize: 11, color: TN.muted }}>{label}</span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: TN.inset, overflow: 'hidden' }}>
        {v != null && <div style={{ width: `${Math.max(0, Math.min(100, Number(v) || 0))}%`, background: color, height: '100%' }} />}
      </div>
      <span style={num(11, { width: 40, textAlign: 'right', color: TN.text })}>{v ?? 'N/A'}</span>
    </div>
  );

  // AI indicator registry: `get` reads the real backing field; null/undefined
  // means no model is wired and the row renders UNAVAILABLE. `blurb` documents
  // inputs → output without claiming a calculation that doesn't exist.
  const aiIndicators = [
    { name: 'AI Signal Engine', get: () => d.ai_signal != null ? `${d.ai_signal} · score ${d.ai_consensus_score ?? '—'}` : null, blurb: 'Trend + momentum + volume + structure confluence → BUY/SELL/HOLD with entry/SL/TP.' },
    { name: 'AI Trend Detector', get: () => d.trend_hint ?? (d.ai_trend_score != null ? `score ${d.ai_trend_score}` : null), blurb: 'EMA structure + ADX regime → UPTREND / DOWNTREND / RANGE.' },
    { name: 'AI Support / Resistance', get: () => d.support_price != null || d.resistance_price != null ? `S ${d.support_price ?? '—'} · R ${d.resistance_price ?? '—'}` : null, blurb: 'Swing clusters + volume-at-price → scored zones.' },
    { name: 'AI Breakout Detector', get: () => d.breakout_strength != null ? `strength ${d.breakout_strength}` : null, blurb: 'Compression + volume confirmation → breakout direction and trigger.' },
    { name: 'AI Momentum Score', get: () => d.momentum_state ?? (d.ai_momentum_score != null ? `score ${d.ai_momentum_score}` : null), blurb: 'RSI + MACD + Stochastic composite → accelerating / exhausted.' },
    { name: 'AI Market Regime', get: () => d.market_regime != null ? `${d.market_regime}${d.regime_confidence != null ? ` (${d.regime_confidence}%)` : ''}` : null, blurb: 'ADX + choppiness + volatility → TREND / RANGE / BREAKOUT / HIGH-VOL.' },
    { name: 'AI Pattern Recognition', get: () => d.ai_pattern_score != null ? `score ${d.ai_pattern_score}` : (d.structure_label ?? null), blurb: 'Pivot geometry + volume shape → classical patterns with invalidation.' },
    { name: 'AI Volume Anomaly', get: () => d.volume_ratio_20d != null ? `${d.volume_ratio_20d}x${d.volume_breakout ? ' · breakout' : ''}` : null, blurb: 'Relative volume vs 20-day baseline → unusual-activity flag.' },
    { name: 'AI Sentiment Engine', get: () => d.sentiment_label ?? null, blurb: 'News flow aggregation → sentiment label with article count.' },
    { name: 'AI Reversal Detector', get: () => null, blurb: 'Divergence + wick + overextension model — not wired to this row.' },
    { name: 'AI Multi-Timeframe Alignment', get: () => null, blurb: 'Per-timeframe confluence stack — not wired to this row.' },
    { name: 'AI Price Forecast', get: () => null, blurb: 'Volatility-conditioned path bands — not wired to this row.' },
  ];

  const detailGroups = [
    { title: 'Technical', rows: [['RSI 14', d.rsi_14], ['MACD Hist', d.macd_hist], ['MACD XO', d.macd_crossover], ['EMA 50', d.ema_50], ['EMA 200', d.ema_200], ['EMA Trend', d.ema_alignment], ['ADX 14', d.adx_14], ['ATR %', d.atr_pct], ['Supertrend', d.supertrend_dir != null ? (Number(d.supertrend_dir) > 0 ? 'BULL' : 'BEAR') : null], ['Stoch %K', d.stoch_k], ['CCI 20', d.cci_20], ['ROC 12', d.roc_12], ['Williams %R', d.williams_r], ['RS/NIFTY %', d.rs_vs_nifty_pct], ['Momentum', d.momentum_state], ['52W Pos %', d.pos_52w_pct]] },
    { title: 'Fundamental', rows: [['P/E', d.pe_ratio], ['P/B', d.pb_ratio], ['ROE %', d.roe_pct], ['ROCE %', d.roce_pct], ['D/E', d.debt_to_equity], ['Sales 3Y %', d.sales_growth_3y], ['Profit 3Y %', d.profit_growth_3y], ['MktCap Cr', d.market_cap_cr], ['MktCap Cat', d.market_cap_cat]] },
    { title: 'Structure & Sentiment', rows: [['Structure', d.structure_label], ['Regime', d.market_regime], ['Support', d.support_price], ['Resistance', d.resistance_price], ['Breakout Str', d.breakout_strength], ['Retest', d.retest_status], ['News Sentiment', d.sentiment_label], ['News Count', d.news_count]] },
  ];

  return (
    <div className="tn-drawer" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width, maxWidth: '94vw', background: TN.panel, borderLeft: `1px solid ${TN.borderStrong}`, boxShadow: '-12px 0 32px rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div className="tn-drawer-grip" onMouseDown={beginResize} title="Drag to resize" />
      <div style={{ padding: '12px 16px 0', borderBottom: `1px solid ${TN.border}`, background: TN.panelAlt }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: TN.text }}>{d.ticker}</span>
              <span style={chip()}>{d.market_cap_cat || 'NSE'}</span>
              {d.data_status && d.data_status !== 'OK' && (
                <span style={chip('warn')}>{d.data_status === 'N/A' ? 'N/A' : 'STALE DATA'}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: TN.muted, marginTop: 2 }}>{d.name || d.ticker} · {d.sector || 'Diversified'}</div>
          </div>
          <button onClick={onClose} aria-label="Close details" style={{ background: 'transparent', border: `1px solid ${TN.border}`, borderRadius: TN.radius, color: TN.muted, cursor: 'pointer', padding: 5, display: 'flex' }}><X size={15} /></button>
        </div>
        <div className="tn-tabs" role="tablist" aria-label="Stock detail tabs">
          {[['overview', 'Overview'], ['ai', 'AI Analysis'], ['details', 'Details']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`tn-tab${tab === id ? ' active' : ''}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="tn-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'overview' && (
          <>
            <div style={panel({ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
              <div>
                <div style={{ fontSize: 10, color: TN.faint, fontWeight: 700, letterSpacing: '0.06em' }}>PRICE{loading ? ' (LOADING…)' : ''}</div>
                <div style={num(22, { fontWeight: 700, color: TN.text })}>₹{Number(currPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style={{ fontSize: 11, color: TN.faint }}>MktCap ₹{Number(d.market_cap_cr || 0).toLocaleString('en-IN')} Cr</div>
              </div>
              <div style={{ padding: '5px 10px', borderRadius: TN.radius, background: isPositive ? TN.upDim : TN.downDim, border: `1px solid ${isPositive ? 'rgba(34,197,94,0.35)' : 'rgba(248,113,113,0.35)'}`, color: isPositive ? TN.up : TN.down, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 13 }}>
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{isPositive ? '+' : ''}{fmt(d.change_1d_pct, 2)}%
              </div>
            </div>

            <div style={panel({ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: TN.ai, fontWeight: 700 }}><Sparkles size={13} /> AI {d.ai_consensus_score != null ? d.ai_consensus_score : 'N/A'} · {d.ai_signal || 'N/A'}</span>
                <span style={{ fontSize: 11, color: TN.muted }}>Conf {d.ai_confidence_score ?? 'N/A'}</span>
              </div>
              {scoreBar('Momentum', confluence?.components?.momentum ?? d.ai_momentum_score, TN.up)}
              {scoreBar('Volume', confluence?.components?.volume, TN.ai)}
              {scoreBar('Confluence', d.confluence_score, TN.accent)}
            </div>

            <div style={panel({ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 })}>
              {[
                ['Trend', d.trend_hint ? String(d.trend_hint).charAt(0) + String(d.trend_hint).slice(1).toLowerCase() : null],
                ['Momentum', d.momentum_state ? String(d.momentum_state).charAt(0) + String(d.momentum_state).slice(1).toLowerCase() : null],
                ['Sentiment', d.sentiment_label],
                ['Volume', d.volume_ratio_20d != null ? (d.volume_ratio_20d >= 1.5 ? 'Elevated' : d.volume_ratio_20d >= 1.0 ? 'Normal' : 'Quiet') : null],
                ['Regime', d.market_regime],
                ['Signal', d.ai_signal],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: TN.faint, letterSpacing: '0.06em', fontWeight: 700 }}>{k.toUpperCase()}</span>
                  <span style={{ color: TN.text, fontWeight: 700 }}>{v ?? 'N/A'}</span>
                </div>
              ))}
              <div style={{ height: 1, background: TN.border, margin: '3px 0' }} />
              {[
                ['Support', d.support_price != null ? '₹' + d.support_price : null],
                ['Resistance', d.resistance_price != null ? '₹' + d.resistance_price : null],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: TN.faint, letterSpacing: '0.06em', fontWeight: 700 }}>{k.toUpperCase()}</span>
                  <span style={num(11, { color: TN.text, fontWeight: 700 })}>{v ?? 'N/A'}</span>
                </div>
              ))}
            </div>

            <div style={panel({ padding: '10px 12px' })}>
              <div style={sectionTitle({ color: TN.accent, marginBottom: 6 })}>AI explanation</div>
              {why.length ? (
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#C3CEDD', lineHeight: 1.55, listStyle: 'disc' }}>
                  {why.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              ) : (
                <div style={{ fontSize: 12, color: TN.faint }}>Traceable reasons appear once the institutional pipeline backfills this row. No claims are shown without data.</div>
              )}
            </div>

            <div style={panel({ padding: '10px 12px' })}>
              <div style={{ fontSize: 12, color: TN.text, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><DollarSign size={13} color={TN.up} /> Quick Paper Trade</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: TN.muted }}>Qty:</span>
                <input type="number" min="1" max="1000" value={paperShares} onChange={(e) => setPaperShares(e.target.value)} style={{ width: 70, background: TN.inset, border: `1px solid ${TN.borderStrong}`, borderRadius: TN.radius, padding: '4px 8px', color: TN.text, fontSize: 12 }} />
                <span style={{ fontSize: 11, color: TN.faint }}>≈ ₹{(currPrice * (parseInt(paperShares, 10) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <button onClick={handleQuickPaperTrade} disabled={paperLoading} style={btnGreen({ width: '100%', justifyContent: 'center' })}>Buy Market</button>
            </div>
          </>
        )}

        {tab === 'ai' && (
          <>
            <div style={panel({ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={sectionTitle({ color: TN.ai })}>Model analysis — not certainty</span>
                <span style={num(20, { fontWeight: 700, color: TN.text })}>{d.ai_consensus_score ?? 'N/A'}<span style={{ fontSize: 11, color: TN.faint }}> / 100</span></span>
              </div>
              {scoreBar('Trend', confluence?.components?.trend ?? d.ai_trend_score, TN.info)}
              {scoreBar('Momentum', confluence?.components?.momentum ?? d.ai_momentum_score, TN.up)}
              {scoreBar('Volume', confluence?.components?.volume, TN.ai)}
              {scoreBar('Structure', confluence?.components?.structure ?? d.ai_pattern_score, TN.warn)}
              {scoreBar('Confluence', d.confluence_score, TN.accent)}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: TN.muted }}>
                <span>Sentiment: <strong style={{ color: TN.text }}>{d.sentiment_label ?? 'N/A'}</strong></span>
                <span>News: <strong style={{ color: TN.text }}>{d.news_count ?? 'N/A'}</strong></span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[['Regime', d.market_regime], ['Signal', d.ai_signal], ['Confidence', d.ai_confidence_score != null ? `${d.ai_confidence_score}%` : null]].map(([k, v]) => (
                <div key={k} style={gridCell}><div style={gridLabel}>{k.toUpperCase()}</div><div style={{ fontSize: 13, fontWeight: 700, color: TN.text, marginTop: 2 }}>{v ?? 'N/A'}</div></div>
              ))}
            </div>

            {(confluence?.positives?.length || confluence?.negatives?.length) ? (
              <div style={panel({ padding: '10px 12px', fontSize: 12, color: '#C3CEDD', lineHeight: 1.55 })}>
                <div style={sectionTitle({ marginBottom: 6 })}>Supporting / opposing factors</div>
                {(confluence.positives || []).slice(0, 5).map((p, i) => <div key={`p${i}`}>+ {p}</div>)}
                {(confluence.negatives || []).slice(0, 4).map((n, i) => <div key={`n${i}`} style={{ color: '#FCA5A5' }}>− {n}</div>)}
              </div>
            ) : null}

            <div style={panel({ padding: '10px 12px' })}>
              <div style={sectionTitle({ marginBottom: 6 })}>Why? — model read</div>
              {why.length ? (
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#C3CEDD', lineHeight: 1.55 }}>
                  {why.map((w, i) => <li key={i}>{w}</li>)}
                </ol>
              ) : (
                <div style={{ fontSize: 12, color: TN.faint }}>No model explanation stored for this row yet.</div>
              )}
            </div>

            <div style={panel({ padding: '10px 12px' })}>
              <div style={sectionTitle({ marginBottom: 6 })}>AI indicators — availability</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {aiIndicators.map((ind) => {
                  const value = ind.get();
                  return (
                    <div key={ind.name} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 8px', background: 'rgba(148,163,184,0.04)', border: `1px solid ${TN.border}`, borderRadius: TN.radius }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: TN.text }}>{ind.name}</span>
                        {value != null
                          ? <span style={chip('ai')}>{String(value)}</span>
                          : <span style={chip()}>UNAVAILABLE</span>}
                      </div>
                      <div style={{ fontSize: 11, color: TN.faint }}>{ind.blurb}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: TN.faint, lineHeight: 1.5 }}>
                UNAVAILABLE means no model output is wired for this row — the indicator is shown as a placeholder rather than a prediction. Scores are model analysis, not financial advice; always check confidence and supporting factors.
              </div>
            </div>
            <button onClick={() => onAnalyzeAI && onAnalyzeAI(d)} style={btn(false, { justifyContent: 'center', color: TN.ai })}>
              Open AI Prediction <ArrowUpRight size={12} />
            </button>
          </>
        )}

        {tab === 'details' && (
          <>
            <button onClick={() => onNavigateFundamentals(d.ticker)} style={btn(false, { justifyContent: 'center' })}>
              Open full Fundamentals <ArrowUpRight size={12} />
            </button>
            {detailGroups.map((g) => {
              const present = g.rows.filter(([, v]) => v !== null && v !== undefined && v !== '');
              return (
                <div key={g.title} style={panel({ padding: '10px 12px' })}>
                  <div style={sectionTitle({ marginBottom: 8 })}>{g.title}</div>
                  {present.length ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                      {present.map(([k, v]) => (
                        <div key={k} style={gridCell}><div style={gridLabel}>{k.toUpperCase()}</div><div style={{ fontSize: 13, fontWeight: 700, color: TN.text, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(v)}</div></div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: TN.faint }}>No {g.title.toLowerCase()} fields stored for this row.</div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      <div style={{ padding: '10px 16px', borderTop: `1px solid ${TN.border}`, background: TN.panelAlt, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <button onClick={() => onNavigateChart(d.ticker)} style={btnPrimary({ justifyContent: 'center' })}>Open Chart</button>
        <button onClick={handleCreateAlert} title="Alert at +5% above current price" style={btn(false, { justifyContent: 'center' })}>Alert</button>
        <button onClick={() => onAddWatchlist && onAddWatchlist(d)} style={btn(false, { justifyContent: 'center' })}>Watch</button>
      </div>
    </div>
  );
}
