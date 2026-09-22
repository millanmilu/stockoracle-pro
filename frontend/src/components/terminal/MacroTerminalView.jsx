import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import MacroPanel from '../MacroPanel';
import {
  Globe2, RefreshCw, TrendingUp, TrendingDown, Minus, ShieldCheck, TriangleAlert,
} from 'lucide-react';
import {
  LineChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const REFRESH_MS = 5 * 60 * 1000; // sovereign tab auto-refresh cadence

const fmt = (v, digits = 2, suffix = '') => (
  v === null || v === undefined || Number.isNaN(Number(v))
    ? '—'
    : `${Number(v).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`
);

const LiveDot = ({ live }) => (
  <span
    title={live ? 'Live verified feed' : 'Static reference value — not real-time'}
    style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      background: live ? '#10B981' : '#64748B',
      boxShadow: live ? '0 0 6px rgba(16,185,129,0.9)' : 'none',
    }}
  />
);

const card = {
  background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)',
  padding: '14px 16px', borderRadius: 10, minWidth: 0,
};
const cardLabel = {
  fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase',
  marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600,
  display: 'flex', alignItems: 'center', gap: 6,
};
const cardValue = (color) => ({
  fontSize: '1.25rem', fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace',
});

function Spark({ data, dataKey, color }) {
  if (!data || data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={34}>
      <LineChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Rule-based regime from verifiable inputs only: low VIX + FII buying =
// risk-on; stressed VIX + FII selling = risk-off. Thresholds mirror the
// backend signal table (backend/analysis/macro.py::_macro_signal).
function computeRegime(vix, fiiNet) {
  let score = 0;
  const drivers = [];
  if (vix !== null && vix !== undefined) {
    if (vix < 14) { score += 1; drivers.push(`VIX ${vix.toFixed(1)} calm`); }
    else if (vix > 20) { score -= 1; drivers.push(`VIX ${vix.toFixed(1)} stressed`); }
    else drivers.push(`VIX ${vix.toFixed(1)} normal`);
  }
  if (fiiNet !== null && fiiNet !== undefined && fiiNet !== 0) {
    if (fiiNet > 0) { score += 1; drivers.push(`FII +₹${Math.abs(fiiNet).toLocaleString('en-IN')} Cr buying`); }
    else if (fiiNet < -500) { score -= 1; drivers.push(`FII ₹${Number(fiiNet).toLocaleString('en-IN')} Cr selling`); }
    else drivers.push('FII flows mixed');
  }
  if (score >= 1) return { label: 'RISK-ON', color: '#10B981', Icon: TrendingUp, drivers };
  if (score <= -1) return { label: 'RISK-OFF', color: '#EF5350', Icon: TrendingDown, drivers };
  return { label: 'NEUTRAL', color: '#F59E0B', Icon: Minus, drivers };
}

export default function MacroTerminalView({ initialTab = 'sovereign' }) {
  const [activeSubTab, setActiveSubTab] = useState(initialTab); // 'sovereign' | 'indicators'
  const [macroData, setMacroData] = useState(null);
  const [flows, setFlows] = useState(null); // /api/macro summary (FII/DII, VIX)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    if (initialTab) setActiveSubTab(initialTab);
  }, [initialTab]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sov, flow] = await Promise.all([
        api.get('/api/macro/sovereign-yields'),
        api.get('/api/macro').catch(() => ({ data: null })),
      ]);
      setMacroData(sov.data);
      setFlows(flow.data);
      setUpdatedAt(new Date());
    } catch (err) {
      console.error('Failed to load sovereign macro data', err);
      setError('Sovereign feed unreachable — showing last known state.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(() => { if (!document.hidden) fetchAll(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchAll]);

  const history = macroData?.yield_curve_history || [];
  const indices = macroData?.indices || [];
  const vixRow = indices.find((r) => r.symbol === 'INDIA VIX');
  const regime = computeRegime(
    vixRow?.price ?? flows?.india_vix?.value ?? null,
    flows?.fii_net?.value ?? null,
  );
  const asOf = macroData?.as_of ? new Date(macroData.as_of) : updatedAt;
  const staticCount = indices.filter((r) => r.status !== 'LIVE').length;

  const RegimeIcon = regime.Icon;

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

      {/* Top Header & Sub-Tab Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', fontWeight: 800, color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe2 size={20} color="#818CF8" />
            Macroeconomic & Sovereign Terminal
          </h1>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
            India 10Y G-Sec vs US Treasury spread, RBI stance, FII/DII flows, volatility regime and cross-asset correlations.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', background: 'rgba(9, 13, 30, 0.8)',
            padding: 4, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.08)',
            gap: 4,
          }}>
            {[
              { id: 'sovereign', label: 'Sovereign Yields & Spread', color: '#38BDF8' },
              { id: 'indicators', label: 'Domestic & Global Indicators', color: '#10B981' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveSubTab(t.id)}
                style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: '0.74rem', fontWeight: activeSubTab === t.id ? 800 : 600,
                  background: activeSubTab === t.id ? `linear-gradient(135deg, ${t.color}40, rgba(129,140,248,0.2))` : 'transparent',
                  color: activeSubTab === t.id ? t.color : '#94A3B8',
                  borderBottom: activeSubTab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAll}
            style={{
              padding: '7px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.12)',
              color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', fontWeight: 600,
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,83,80,0.08)', border: '1px solid rgba(239,83,80,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.76rem', color: '#FCA5A5' }}>
          <TriangleAlert size={14} /> {error}
        </div>
      )}

      {/* Sub-Tab 1: Sovereign Yields, Spread, Chart & Correlations */}
      {activeSubTab === 'sovereign' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Regime banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#0C1022', border: `1px solid ${regime.color}55`, borderRadius: 10, padding: '10px 16px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: '0.85rem', color: regime.color }}>
              <RegimeIcon size={16} /> {regime.label}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
              {regime.drivers.length ? regime.drivers.join(' · ') : 'Waiting for volatility/flow inputs…'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={12} /> Rule-based (VIX + FII) — not advice
            </span>
          </div>

          {/* Benchmark tape — previously fetched but never rendered */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {indices.map((r) => {
              const live = r.status === 'LIVE';
              const chg = r.change_pct;
              const chgColor = chg === null || chg === undefined ? '#64748B' : Number(chg) >= 0 ? '#10B981' : '#EF5350';
              return (
                <div key={r.symbol} style={{ ...card, padding: '10px 12px' }}>
                  <div style={{ ...cardLabel, fontSize: '0.62rem' }}><LiveDot live={live} />{r.symbol}</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}>
                    {fmt(r.price)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: chgColor, fontWeight: 700, marginTop: 2 }}>
                    {chg === null || chg === undefined ? 'chg n/a' : `${Number(chg) >= 0 ? '+' : ''}${Number(chg).toFixed(2)}%`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* KPI grid with sparklines */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={card}>
              <div style={cardLabel}><LiveDot live={false} />India 10Y G-Sec Yield</div>
              <div style={cardValue('#38BDF8')}>{fmt(macroData?.india_10y_yield, 2, '%')}</div>
              <Spark data={history} dataKey="india_10y" color="#38BDF8" />
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>Benchmark Sovereign Debt · ref</div>
            </div>

            <div style={card}>
              <div style={cardLabel}><LiveDot live={!!macroData?.us_10y_live} />US 10Y Treasury Yield</div>
              <div style={cardValue('#F59E0B')}>{fmt(macroData?.us_10y_yield, 2, '%')}</div>
              <Spark data={history} dataKey="us_10y" color="#F59E0B" />
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>Risk-Free US Benchmark</div>
            </div>

            <div style={{ ...card, border: '1px solid rgba(16,185,129,0.3)' }}>
              <div style={cardLabel}><LiveDot live={!!macroData?.us_10y_live} />Sovereign Yield Spread</div>
              <div style={cardValue('#10B981')}>{macroData?.yield_spread_bps == null ? '—' : `+${macroData.yield_spread_bps} bps`}</div>
              <Spark data={history} dataKey="spread_bps" color="#10B981" />
              <div style={{ fontSize: '0.72rem', color: '#10B981', marginTop: 2 }}>India Premium Over US</div>
            </div>

            <div style={card}>
              <div style={cardLabel}><LiveDot live={false} />RBI Policy Repo Rate</div>
              <div style={cardValue('#818CF8')}>{fmt(macroData?.rbi_repo_rate, 2, '%')}</div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>Stance: {macroData?.rbi_policy_stance ?? '—'} · ref</div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>CPI {fmt(macroData?.cpi_inflation, 2, '%')} · GDP {fmt(macroData?.gdp_growth_pct, 1, '%')}</div>
            </div>
          </div>

          {/* 12-Month Sovereign Yield Trends + Spread */}
          <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 20, height: 380 }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: '#F0F0FF' }}>
              12-Month Sovereign Yield Trends & Spread (India 10Y vs US 10Y)
            </h3>

            <ResponsiveContainer width="100%" height="88%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis yAxisId="y" stroke="#64748B" fontSize={11} domain={[3.5, 7.8]} />
                <YAxis yAxisId="s" orientation="right" stroke="#10B981" fontSize={11} domain={[270, 285]} />
                <Tooltip contentStyle={{ background: '#0F172A', borderColor: 'rgba(99,102,241,0.3)', color: '#F0F0FF' }} />
                <Legend />
                <Area yAxisId="s" type="monotone" dataKey="spread_bps" stroke="none" fill="#10B981" fillOpacity={0.12} name="Spread (bps, right)" />
                <Line yAxisId="y" type="monotone" dataKey="india_10y" stroke="#38BDF8" strokeWidth={2.5} dot={false} name="India 10Y G-Sec (%)" />
                <Line yAxisId="y" type="monotone" dataKey="us_10y" stroke="#F59E0B" strokeWidth={2} dot={false} name="US 10Y Treasury (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Cross-Asset Correlation Cards */}
          <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '18px 20px' }}>
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
                        color: isPos ? '#10B981' : '#EF5350',
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

          {/* Freshness / honesty footer */}
          <div style={{ fontSize: '0.7rem', color: '#64748B', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <LiveDot live={false} />
            <span>
              {asOf ? `Data as of ${asOf.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Awaiting data…'}
              {staticCount > 0 && ` · ${staticCount}/${indices.length} tape rows + policy figures are static references, not live ticks.`}
            </span>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Domestic & Global Macro Indicators */}
      {activeSubTab === 'indicators' && (
        <MacroPanel />
      )}

    </div>
  );
}
