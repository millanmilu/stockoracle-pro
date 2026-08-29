import React from 'react';
import { Dices, RefreshCw, X, TrendingUp, ShieldCheck, Activity, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ScreenerBacktestModal({
  isOpen,
  onClose,
  loading,
  results,
  holdingDays,
  setHoldingDays,
  sttRate,
  setSttRate,
  onRerun
}) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.88)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 250,
      padding: 20
    }}>
      <div style={{
        background: '#090D1C',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 780,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 24,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.15)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dices size={18} color="#10B981" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#F8FAFC', fontWeight: 800 }}>Historical Strategy Backtester</h2>
              <div style={{ fontSize: '0.66rem', color: '#64748B' }}>100% Real Historical OHLCV • Equal-Weighted Basket Rebalancing</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94A3B8', cursor: 'pointer', padding: 6, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Config Controls */}
        <div style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 14px',
          borderRadius: 10,
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>Rebalance Interval:</span>
            <select
              value={holdingDays}
              onChange={(e) => setHoldingDays(Number(e.target.value))}
              style={{ background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 10px', color: '#F1F5F9', fontSize: '0.72rem', outline: 'none' }}
            >
              <option value="5">Weekly (5 Days)</option>
              <option value="20">Monthly (20 Days)</option>
              <option value="60">Quarterly (60 Days)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>STT / Friction:</span>
            <select
              value={sttRate}
              onChange={(e) => setSttRate(Number(e.target.value))}
              style={{ background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 10px', color: '#F1F5F9', fontSize: '0.72rem', outline: 'none' }}
            >
              <option value="0.0005">0.05% Low Friction</option>
              <option value="0.001">0.10% Standard NSE (STT)</option>
              <option value="0.002">0.20% Conservative</option>
            </select>
          </div>

          <button
            onClick={onRerun}
            disabled={loading}
            style={{
              marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, background: '#6366F1',
              color: '#FFF', border: 'none', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5
            }}
          >
            {loading ? <RefreshCw size={12} className="spin" /> : <RefreshCw size={12} />} Re-simulate
          </button>
        </div>

        {/* Results View */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#818CF8' }}>
            <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Fetching real historical OHLCV bars & computing equity curve...</div>
          </div>
        ) : results ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 700 }}>STRATEGY CAGR</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                  {results.strategy_cagr_pct}%
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 700 }}>NIFTY 50 CAGR</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                  {results.benchmark_cagr_pct}%
                </div>
              </div>
              <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 700 }}>ALPHA GENERATION</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                  +{results.alpha_pct}%
                </div>
              </div>
              <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 700 }}>MAX DRAWDOWN</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F43F5E', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                  {results.max_drawdown_pct}%
                </div>
              </div>
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 700 }}>SHARPE RATIO</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                  {results.sharpe_ratio}
                </div>
              </div>
            </div>

            {/* Interactive Recharts Equity Curve */}
            <div style={{ height: 240, width: '100%', background: '#050814', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, marginBottom: 8 }}>
                CUMULATIVE PERFORMANCE (STRATEGY BASKET VS NIFTY 50)
              </div>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={results.equity_curve || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" stroke="#475569" fontSize={9} />
                  <YAxis stroke="#475569" fontSize={9} domain={['auto', 'auto']} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                  <Tooltip contentStyle={{ background: '#0B0F1F', borderColor: 'rgba(99,102,241,0.3)', color: '#F0F0FF', fontSize: '0.72rem', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="strategy_value" stroke="#10B981" strokeWidth={2} dot={false} name="Strategy Basket" />
                  <Line type="monotone" dataKey="benchmark_value" stroke="#64748B" strokeWidth={1.5} dot={false} name="NIFTY 50 Benchmark" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Matched Basket Tickers */}
            {results.matched_tickers?.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 700 }}>BASKET CONSTITUENTS:</span>
                {results.matched_tickers.map(t => (
                  <span key={t} style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818CF8', fontSize: '0.64rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
