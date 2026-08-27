import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import {
  Layers, RefreshCw, Zap, TrendingUp, TrendingDown, Target, Shield, CheckCircle
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import toast from 'react-hot-toast';

export default function OptionsStrategyLabView({ ticker: propTicker, compact = false }) {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const ticker = propTicker || selectedSymbol;

  const [strategyType, setStrategyType] = useState('BULL_CALL_SPREAD');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStrategy = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/options/strategy-payoff', {
        ticker: ticker,
        strategy_type: strategyType,
      });
      setData(res.data);
    } catch {
      toast.error('Failed to load options strategy payoff.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategy();
  }, [ticker, strategyType]);

  const STRATEGIES = [
    { id: 'BULL_CALL_SPREAD', label: 'Bull Call Spread' },
    { id: 'IRON_CONDOR', label: 'Iron Condor' },
    { id: 'LONG_STRADDLE', label: 'Long Straddle' },
  ];

  return (
    <div style={{ padding: compact ? '8px 10px' : 'clamp(12px, 2.5vw, 20px)', display: 'flex', flexDirection: 'column', gap: compact ? 10 : 16, maxWidth: 1280, margin: '0 auto' }}>

      {/* Top Header - only shown in standalone view */}
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={16} color="#818CF8" />
              Options Strategy Lab — {ticker}
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
              Multi-leg options structure payoffs & Greeks
            </p>
          </div>
        </div>
      )}

      {/* Strategy Selector Buttons */}
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStrategyType(s.id)}
            style={{
              padding: compact ? '4px 8px' : '6px 12px',
              borderRadius: 5,
              border: strategyType === s.id ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
              background: strategyType === s.id ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
              color: strategyType === s.id ? '#F0F0FF' : '#94A3B8',
              fontWeight: strategyType === s.id ? 700 : 500,
              fontSize: '0.72rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Strategy Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: compact ? 6 : 10 }}>
        <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', padding: compact ? '8px 10px' : '12px 14px', borderRadius: 8 }}>
          <div style={{ fontSize: '0.62rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>UNDERLYING</div>
          <div style={{ fontSize: compact ? '1.1rem' : '1.25rem', fontWeight: 800, color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{data?.underlying_price}
          </div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(16,185,129,0.3)', padding: compact ? '8px 10px' : '12px 14px', borderRadius: 8 }}>
          <div style={{ fontSize: '0.62rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>MAX PROFIT</div>
          <div style={{ fontSize: compact ? '1.1rem' : '1.25rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
            {typeof data?.max_profit === 'number' ? `+₹${data.max_profit}` : data?.max_profit}
          </div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(239,83,80,0.3)', padding: compact ? '8px 10px' : '12px 14px', borderRadius: 8 }}>
          <div style={{ fontSize: '0.62rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>MAX LOSS</div>
          <div style={{ fontSize: compact ? '1.1rem' : '1.25rem', fontWeight: 800, color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>
            {data?.max_loss} ₹
          </div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', padding: compact ? '8px 10px' : '12px 14px', borderRadius: 8 }}>
          <div style={{ fontSize: '0.62rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>BREAKEVEN</div>
          <div style={{ fontSize: compact ? '1rem' : '1.15rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>
            {data?.breakevens?.length ? data.breakevens.map(b => `₹${b}`).join(', ') : 'N/A'}
          </div>
        </div>
      </div>

      {/* Payoff Diagram Chart */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 8,
        padding: compact ? '10px 12px' : '16px',
        height: compact ? 200 : 340
      }}>
        <div style={{ fontSize: '0.74rem', color: '#F0F0FF', fontWeight: 700, marginBottom: 6 }}>
          Expiry P&L Payoff Curve
        </div>

        <ResponsiveContainer width="100%" height="88%">
          <LineChart data={data?.payoff_curve || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="price" stroke="#64748B" fontSize={10} />
            <YAxis stroke="#64748B" fontSize={10} />
            <ReferenceLine y={0} stroke="#EF5350" strokeDasharray="3 3" />
            {data?.underlying_price && <ReferenceLine x={data.underlying_price} stroke="#818CF8" label="CMP" />}
            <Tooltip contentStyle={{ background: '#0F172A', borderColor: 'rgba(99,102,241,0.3)', color: '#F0F0FF', fontSize: '0.74rem' }} />
            <Line type="monotone" dataKey="pnl" stroke="#10B981" strokeWidth={2} dot={false} name="P&L (₹)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 3D Volatility Surface Grid */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 8,
        padding: compact ? '8px 10px' : '14px 16px',
        overflowX: 'auto'
      }}>
        <div style={{ fontSize: '0.74rem', color: '#F0F0FF', fontWeight: 700, marginBottom: 6 }}>
          Implied Volatility (IV) Skew
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6 }}>
          {data?.volatility_surface?.map((v, i) => (
            <div key={i} style={{ background: '#080B18', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.64rem', color: '#64748B' }}>{v.expiry} • ₹{v.strike}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                {v.iv}%
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
