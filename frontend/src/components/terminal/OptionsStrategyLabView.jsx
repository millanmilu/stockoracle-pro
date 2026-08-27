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

export default function OptionsStrategyLabView({ ticker: propTicker }) {
  const { selectedSymbol } = useStore();
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
    { id: 'BULL_CALL_SPREAD', label: 'Bull Call Spread (Debit)' },
    { id: 'IRON_CONDOR', label: 'Iron Condor (Range Bound)' },
    { id: 'LONG_STRADDLE', label: 'Long Straddle (High Volatility)' },
  ];

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280, margin: '0 auto' }}>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', fontWeight: 800, color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="#818CF8" />
            Options Strategy Lab & Volatility Surface — {ticker}
          </h1>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
            Multi-leg options structure payoffs, breakevens, and implied volatility surfaces.
          </p>
        </div>

        {/* Strategy Selector Buttons */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStrategyType(s.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: strategyType === s.id ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
                background: strategyType === s.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                color: strategyType === s.id ? '#F0F0FF' : '#94A3B8',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>UNDERLYING PRICE</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{data?.underlying_price}
          </div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(16,185,129,0.3)', padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>MAX PROFIT</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
            {typeof data?.max_profit === 'number' ? `+₹${data.max_profit}` : data?.max_profit}
          </div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(239,83,80,0.3)', padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>MAX LOSS</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>
            {data?.max_loss} ₹
          </div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>BREAKEVEN STRIKES</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>
            {data?.breakevens?.length ? data.breakevens.map(b => `₹${b}`).join(' , ') : 'N/A'}
          </div>
        </div>
      </div>

      {/* Payoff Diagram Chart */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 16,
        padding: '20px',
        height: 380
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#F0F0FF' }}>
          Expiry Profit & Loss Payoff Curve (₹ vs Price)
        </h3>

        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={data?.payoff_curve || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="price" stroke="#64748B" fontSize={11} />
            <YAxis stroke="#64748B" fontSize={11} />
            <ReferenceLine y={0} stroke="#EF5350" strokeDasharray="3 3" />
            {data?.underlying_price && <ReferenceLine x={data.underlying_price} stroke="#818CF8" label="CMP" />}
            <Tooltip contentStyle={{ background: '#0F172A', borderColor: 'rgba(99,102,241,0.3)', color: '#F0F0FF' }} />
            <Line type="monotone" dataKey="pnl" stroke="#10B981" strokeWidth={2.5} dot={false} name="Strategy P&L (₹)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 3D Volatility Surface Grid */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 12,
        padding: '18px 20px',
        overflowX: 'auto'
      }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: '#F0F0FF' }}>
          Implied Volatility (IV) Skew Across Expiries (%)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          {data?.volatility_surface?.map((v, i) => (
            <div key={i} style={{ background: '#080B18', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{v.expiry} • ₹{v.strike}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>
                {v.iv}%
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>{v.moneyness}x Moneyness</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
