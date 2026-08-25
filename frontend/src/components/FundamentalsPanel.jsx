import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import api from '../utils/api';
import { BookOpen, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

const cardStyle = {
  background: '#0C1022',
  border: '1px solid rgba(99,102,241,0.15)',
  borderRadius: 12,
  padding: '18px 20px',
};

const labelStyle = { fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 };
const valueStyle = { fontSize: '1.35rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#F0F0FF' };

function RatioCard({ label, value, unit = '', colorFn }) {
  const color = colorFn ? colorFn(value) : '#F0F0FF';
  return (
    <div style={{ ...cardStyle, minWidth: 0 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ ...valueStyle, color }}>
        {value != null ? `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${unit}` : '—'}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ ...cardStyle, height: 72, background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.06)', marginBottom: 8, width: '50%' }} />
      <div style={{ height: 22, borderRadius: 4, background: 'rgba(255,255,255,0.06)', width: '70%' }} />
    </div>
  );
}

export default function FundamentalsPanel({ ticker: propTicker }) {
  const { selectedSymbol } = useStore();
  const ticker = propTicker || selectedSymbol;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get(`/api/stock/${ticker}/fundamentals`);
      setData(res);
    } catch (err) {
      setError('Fundamental data temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [ticker]);

  if (loading) return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );

  if (error || !data) return (
    <div style={{ padding: '24px 28px', textAlign: 'center', color: '#9CA3AF' }}>
      <BookOpen size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
      <div style={{ marginBottom: 12 }}>{error || 'No data available.'}</div>
      <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>
        <RefreshCw size={14} style={{ marginRight: 6 }} />Retry
      </button>
    </div>
  );

  const quarterly = data.quarterly_results || [];
  const revenue5y = data.revenue_5y || [];
  const profit5y = data.profit_5y || [];

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#F0F0FF' }}>
            <BookOpen size={22} style={{ marginRight: 10, verticalAlign: 'middle', color: '#818CF8' }} />
            Fundamentals — {ticker}
          </h1>
          {data.market_cap && (
            <div style={{ fontSize: '0.82rem', color: '#9CA3AF', marginTop: 4 }}>Market Cap: {data.market_cap}</div>
          )}
        </div>
        <button onClick={fetchData} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
          <RefreshCw size={12} />Refresh
        </button>
      </div>

      {/* Key Ratios Grid */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>KEY RATIOS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
          <RatioCard label="P/E Ratio" value={data.pe_ratio} />
          <RatioCard label="P/B Ratio" value={data.pb_ratio} />
          <RatioCard label="EPS (TTM)" value={data.eps} unit=" ₹" />
          <RatioCard
            label="ROE"
            value={data.roe}
            unit="%"
            colorFn={(v) => v != null ? (v >= 15 ? '#10B981' : v >= 8 ? '#F59E0B' : '#EF5350') : '#F0F0FF'}
          />
          <RatioCard
            label="Debt / Equity"
            value={data.debt_to_equity}
            colorFn={(v) => v != null ? (v <= 0.5 ? '#10B981' : v <= 1 ? '#F59E0B' : '#EF5350') : '#F0F0FF'}
          />
          <RatioCard
            label="Promoter Holding"
            value={data.promoter_holding}
            unit="%"
            colorFn={(v) => v != null ? (v >= 50 ? '#10B981' : v >= 35 ? '#F59E0B' : '#EF5350') : '#F0F0FF'}
          />
          {data.fii_holding != null && (
            <RatioCard label="FII Holding" value={data.fii_holding} unit="%" />
          )}
        </div>
      </div>

      {/* 5-Year Revenue & Profit Charts */}
      {(revenue5y.length > 0 || profit5y.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Revenue */}
          {revenue5y.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                5-Year Revenue (₹ Cr)
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={revenue5y} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} width={45} />
                  <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#F0F0FF', fontSize: '0.78rem' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {revenue5y.map((_, i) => <Cell key={i} fill={i === revenue5y.length - 1 ? '#6366F1' : 'rgba(99,102,241,0.5)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Profit */}
          {profit5y.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                5-Year Net Profit (₹ Cr)
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={profit5y} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} width={45} />
                  <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#F0F0FF', fontSize: '0.78rem' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {profit5y.map((entry, i) => <Cell key={i} fill={entry.value >= 0 ? (i === profit5y.length - 1 ? '#10B981' : 'rgba(16,185,129,0.5)') : '#EF5350'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Quarterly Results Table */}
      {quarterly.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            Quarterly Results
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Quarter', 'Revenue (₹Cr)', 'Net Profit (₹Cr)', 'EPS (₹)', 'QoQ Profit %'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'right', color: '#6B7280', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {h === 'Quarter' ? <span style={{ textAlign: 'left', display: 'block' }}>{h}</span> : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quarterly.map((q, i) => {
                  const prev = quarterly[i + 1];
                  const qoq = prev?.net_profit && q.net_profit != null
                    ? ((q.net_profit - prev.net_profit) / Math.abs(prev.net_profit)) * 100
                    : null;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                      <td style={{ padding: '9px 12px', color: i === 0 ? '#818CF8' : '#F0F0FF', fontWeight: i === 0 ? 700 : 400 }}>{q.period}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#9CA3AF', fontFamily: 'JetBrains Mono, monospace' }}>{q.revenue != null ? q.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: q.net_profit >= 0 ? '#10B981' : '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>{q.net_profit != null ? q.net_profit.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#9CA3AF', fontFamily: 'JetBrains Mono, monospace' }}>{q.eps != null ? q.eps.toFixed(2) : '—'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        {qoq != null ? (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, color: qoq >= 0 ? '#10B981' : '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>
                            {qoq >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {qoq >= 0 ? '+' : ''}{qoq.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ fontSize: '0.72rem', color: '#4B5563', textAlign: 'center' }}>
        Data sourced from Screener.in · Cached for 4 hours
      </div>
    </div>
  );
}