import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  Globe, RefreshCw, TrendingUp, TrendingDown, DollarSign, Percent,
  Activity, ShieldCheck, Scale, BarChart2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

export default function MacroTerminalView() {
  const [macroData, setMacroData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMacro = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/macro/sovereign-yields');
      setMacroData(data);
    } catch (err) {
      console.error('Failed to load sovereign macro data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMacro();
  }, []);

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280, margin: '0 auto' }}>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.2rem, 4vw, 1.6rem)', fontWeight: 800, color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={22} color="#818CF8" />
            Sovereign Macro & Econometrics Hub
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94A3B8' }}>
            India 10Y G-Sec vs US 10Y Treasury spread, RBI monetary policy stance, and cross-asset correlations.
          </p>
        </div>
        <button onClick={fetchMacro} style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
          <RefreshCw size={13} /> Refresh Macro
        </button>
      </div>

      {/* Macro Indicators KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', padding: '18px 20px', borderRadius: 12 }}>
          <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase' }}>INDIA 10Y G-SEC YIELD</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>
            {macroData?.india_10y_yield}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 4 }}>Benchmark Sovereign Debt</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', padding: '18px 20px', borderRadius: 12 }}>
          <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase' }}>US 10Y TREASURY YIELD</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
            {macroData?.us_10y_yield}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 4 }}>Risk-Free US Benchmark</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(16,185,129,0.3)', padding: '18px 20px', borderRadius: 12 }}>
          <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase' }}>SOVEREIGN YIELD SPREAD</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
            +{macroData?.yield_spread_bps} bps
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: 4 }}>India Premium Over US</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', padding: '18px 20px', borderRadius: 12 }}>
          <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase' }}>RBI POLICY REPO RATE</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
            {macroData?.rbi_repo_rate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 4 }}>Stance: {macroData?.rbi_policy_stance}</div>
        </div>
      </div>

      {/* 12-Month Sovereign Yield Curve Chart */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 16,
        padding: '20px',
        height: 360
      }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: '#F0F0FF' }}>
          12-Month Sovereign Yield Trends & Spread (India 10Y vs US 10Y)
        </h3>

        <ResponsiveContainer width="100%" height="88%">
          <LineChart data={macroData?.yield_curve_history || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
            <YAxis stroke="#64748B" fontSize={11} domain={[3.5, 7.8]} />
            <Tooltip contentStyle={{ background: '#0F172A', borderColor: 'rgba(99,102,241,0.3)', color: '#F0F0FF' }} />
            <Legend />
            <Line type="monotone" dataKey="india_10y" stroke="#38BDF8" strokeWidth={2.5} dot={false} name="India 10Y G-Sec (%)" />
            <Line type="monotone" dataKey="us_10y" stroke="#F59E0B" strokeWidth={2} dot={false} name="US 10Y Treasury (%)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cross-Asset Correlation Cards */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 12,
        padding: '18px 20px'
      }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: '#F0F0FF' }}>
          Cross-Asset Correlation vs NIFTY 50 (Historical 1-Year)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {macroData?.correlations?.map((c, i) => {
            const isPos = c.correlation > 0;
            return (
              <div key={i} style={{ background: '#080B18', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#F0F0FF', fontSize: '0.9rem' }}>{c.asset}</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '0.95rem',
                    color: isPos ? '#10B981' : '#EF5350'
                  }}>
                    {isPos ? '+' : ''}{c.correlation}
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#818CF8', fontWeight: 600, marginBottom: 4 }}>{c.impact} Impact</div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.4 }}>{c.description}</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
