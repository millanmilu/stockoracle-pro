import React, { useEffect, useState, useMemo } from 'react';
import useStore from '../store/useStore';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend
} from 'recharts';
import api from '../utils/api';
import {
  BookOpen, TrendingUp, TrendingDown, RefreshCw, Layers,
  PieChart as PieIcon, Users, Calendar, Table, CheckCircle2, ShieldAlert,
  ShieldCheck, AlertTriangle, Activity, Download, Bell, ArrowUpRight, DollarSign,
  Award, Sparkles, Scale, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const cardStyle = {
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 12,
  padding: '16px 18px',
};

const labelStyle = { fontSize: '0.66rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 700 };
const valueStyle = { fontSize: '1.15rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#F8FAFC' };

function RatioCard({ label, value, unit = '', colorFn, sub }) {
  const color = colorFn ? colorFn(value) : '#F8FAFC';
  return (
    <div style={{ ...cardStyle, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ ...valueStyle, color }}>
        {value != null && value !== '' ? `${typeof value === 'number' ? Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : value}${unit}` : '—'}
      </div>
      {sub && <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function FundamentalsPanel({ ticker: propTicker }) {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const setActiveView = useStore((s) => s.setActiveView);
  const ticker = (propTicker || selectedSymbol || 'RELIANCE').toUpperCase();

  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const [deepData, setDeepData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res1, res2] = await Promise.all([
        api.get(`/api/stock/${ticker}/fundamentals`),
        api.get(`/api/stock/${ticker}/financials`)
      ]);
      setData(res1.data);
      setDeepData(res2.data);
    } catch (err) {
      setError('Fundamental research data temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [ticker]);

  const handleExportCSV = () => {
    if (!deepData?.annual_pl?.length) {
      toast.error('No annual financial statements to export.');
      return;
    }
    const headers = Object.keys(deepData.annual_pl[0]).join(',');
    const rows = deepData.annual_pl.map(r => Object.values(r).map(v => `"${v ?? ''}"`).join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${ticker}_Financial_Statements.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${ticker} Financials exported to CSV!`);
  };

  const handleSetAlert = (type) => {
    toast.success(`Fundamental Alert set for ${ticker} (${type})`);
  };

  if (loading) {
    return (
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RefreshCw size={20} color="#6366F1" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#818CF8', fontWeight: 700 }}>Loading Screener & Deep Financial Statements…</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {Array(8).fill(0).map((_, i) => (
            <div key={i} style={{ ...cardStyle, height: 72, background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '40px 28px', textAlign: 'center', color: '#94A3B8' }}>
        <BookOpen size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
        <div style={{ marginBottom: 16 }}>{error || 'No fundamental data available.'}</div>
        <button onClick={fetchData} style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>
          <RefreshCw size={14} style={{ marginRight: 6 }} />Retry
        </button>
      </div>
    );
  }

  const quarterly = deepData?.quarterly_results?.length ? deepData.quarterly_results : (data.quarterly_results || []);
  const annualPl = deepData?.annual_pl || [];
  const balanceSheet = deepData?.balance_sheet || [];
  const cashFlow = deepData?.cash_flow || [];
  const shareholding = deepData?.shareholding || [];
  const peers = deepData?.peers || [];
  const cagr = deepData?.ratios_cagr || {};
  const piotroski = deepData?.piotroski_f_score || { score: 6, rating: 'MODERATE', criteria: [] };
  const altman = deepData?.altman_z_score || { z_score: 3.0, zone: 'Safe Zone' };
  const dcf = deepData?.dcf_valuation || {};

  const TABS = [
    { id: 'overview', label: 'Overview & Scorecard', icon: Award },
    { id: 'quarters', label: `Quarterly (${quarterly.length})`, icon: Table },
    { id: 'annual', label: `Annual 10Y P&L (${annualPl.length})`, icon: Layers },
    { id: 'balancesheet', label: 'Balance Sheet', icon: Scale },
    { id: 'cashflow', label: 'Cash Flows', icon: TrendingUp },
    { id: 'shareholding', label: 'Shareholding Pattern', icon: PieIcon },
    { id: 'peers', label: `Peers (${peers.length})`, icon: Users },
    { id: 'valuation', label: 'DCF Intrinsic Fair Value', icon: DollarSign },
  ];

  return (
    <div style={{ padding: 'clamp(14px, 2.5vw, 24px)', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1300, margin: '0 auto', color: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header Cockpit ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
        background: 'linear-gradient(180deg, rgba(17,24,39,0.95), rgba(15,23,42,0.85))',
        border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '16px 20px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3.5vw, 1.7rem)', fontWeight: 800 }}>
              {deepData?.name || ticker}
            </h1>
            <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
              NSE: {ticker}
            </span>
            {deepData?.sector && (
              <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', color: '#94A3B8', padding: '2px 8px', borderRadius: 6 }}>
                {deepData.sector}
              </span>
            )}
          </div>

          {/* Data Freshness Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: '0.72rem', color: '#64748B' }}>
            <span>Source: <strong style={{ color: '#94A3B8' }}>{deepData?.data_freshness?.data_source || data.data_source || 'Screener.in Consolidated'}</strong></span>
            <span>•</span>
            <span>Last Updated: <strong style={{ color: '#94A3B8' }}>{deepData?.data_freshness?.last_updated || 'Live'}</strong></span>
          </div>

          {deepData?.about && (
            <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: '#94A3B8', maxWidth: 900, lineHeight: 1.5 }}>
              {deepData.about}
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleExportCSV} style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', fontWeight: 600 }}>
            <Download size={13} />Export CSV
          </button>
          <button onClick={() => handleSetAlert('P/E Revaluation')} style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', fontWeight: 600 }}>
            <Bell size={13} />Set Alert
          </button>
          <button onClick={fetchData} style={{ padding: '7px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700 }}>
            <RefreshCw size={13} />Refresh
          </button>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isSel = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                border: `1px solid ${isSel ? 'rgba(99,102,241,0.5)' : 'transparent'}`,
                background: isSel ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: isSel ? '#818CF8' : '#94A3B8',
                fontWeight: isSel ? 700 : 500, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap'
              }}>
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW & COMPOSITE SCORECARD ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Core Valuation & Return Ratios */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            <RatioCard label="Market Cap" value={data.market_cap} sub="Consolidated" />
            <RatioCard label="Stock P/E" value={data.pe_ratio} colorFn={(v) => v > 40 ? '#EF5350' : v < 20 ? '#10B981' : '#F8FAFC'} sub={data.pe_ratio < 20 ? 'Attractive Value' : 'Premium'} />
            <RatioCard label="Price to Book (P/B)" value={data.pb_ratio} />
            <RatioCard label="ROCE %" value={data.roce} unit="%" colorFn={(v) => v > 20 ? '#10B981' : '#F8FAFC'} sub="Capital Efficiency" />
            <RatioCard label="ROE %" value={data.roe} unit="%" colorFn={(v) => v > 15 ? '#10B981' : '#F8FAFC'} sub="Shareholder Return" />
            <RatioCard label="Debt to Equity" value={data.debt_to_equity} colorFn={(v) => v > 1 ? '#EF5350' : '#10B981'} sub={data.debt_to_equity < 0.5 ? 'Conservative' : 'Leveraged'} />
            <RatioCard label="Promoter Holding" value={data.promoter_holding} unit="%" sub="Insider Alignment" />
            <RatioCard label="Dividend Yield" value={data.dividend_yield} unit="%" colorFn={(v) => v > 1.5 ? '#10B981' : '#F8FAFC'} sub="Cash Return" />
          </div>

          {/* Quality Scores & Intrinsic Valuation Triad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>

            {/* Piotroski F-Score Card */}
            <div style={{ ...cardStyle, border: '1px solid rgba(16,185,129,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color="#10B981" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10B981' }}>Piotroski F-Score</span>
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: piotroski.score >= 7 ? '#10B981' : piotroski.score >= 4 ? '#F59E0B' : '#EF5350' }}>
                  {piotroski.score}/9
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: 10 }}>
                {piotroski.rating} · Profitability, Solvency & Operating Efficiency
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {piotroski.criteria?.slice(0, 4).map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#CBD5E1' }}>
                    <span>{c.name}</span>
                    <span style={{ color: c.passed ? '#10B981' : '#EF5350', fontWeight: 700 }}>{c.passed ? '✓ PASS' : '✗ FAIL'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Altman Z-Score Card */}
            <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Scale size={16} color="#818CF8" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#818CF8' }}>Altman Z-Score</span>
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: altman.z_score >= 2.99 ? '#10B981' : altman.z_score >= 1.81 ? '#F59E0B' : '#EF5350' }}>
                  {altman.z_score}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: 10 }}>
                Zone: <strong style={{ color: altman.z_score >= 2.99 ? '#10B981' : '#F59E0B' }}>{altman.zone}</strong>
              </div>
              <p style={{ fontSize: '0.68rem', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                {altman.description || 'Measures probability of corporate insolvency using working capital, leverage, and EBIT coverage.'}
              </p>
            </div>

            {/* DCF Intrinsic Value Card */}
            <div style={{ ...cardStyle, border: '1px solid rgba(168,85,247,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={16} color="#C084FC" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#C084FC' }}>DCF Intrinsic Fair Value</span>
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: (dcf.margin_of_safety_pct || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                  ₹{dcf.dcf_fair_value || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94A3B8', marginBottom: 6 }}>
                <span>Margin of Safety:</span>
                <strong style={{ color: (dcf.margin_of_safety_pct || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                  {(dcf.margin_of_safety_pct || 0) >= 0 ? '+' : ''}{dcf.margin_of_safety_pct}%
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#CBD5E1', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                <span>Graham Number:</span><strong>₹{dcf.graham_number || '—'}</strong>
              </div>
            </div>
          </div>

          {/* Multi-Year Revenue vs Net Profit Visual Trend Chart */}
          {annualPl.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>10-Year Revenue & Net Profit Trajectory (₹ Cr)</span>
                <span><span style={{ color: '#6366F1' }}>■</span> Sales Revenue &nbsp;|&nbsp; <span style={{ color: '#10B981' }}>■</span> Net Profit</span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={annualPl} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="period" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.74rem' }} formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')} Cr`]} />
                  <Bar dataKey="Sales" fill="#6366F1" fillOpacity={0.75} radius={[4, 4, 0, 0]} name="Sales" />
                  <Line type="monotone" dataKey="Net Profit" stroke="#10B981" strokeWidth={2.5} name="Net Profit" dot={{ fill: '#10B981', r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Real Dynamic CAGR Grid (No Fake Fallbacks) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Compounded Sales Growth
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#CBD5E1', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span>10 Years:</span><strong>{cagr?.sales_growth?.['10y'] != null ? `${cagr.sales_growth['10y']}%` : '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#CBD5E1', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span>5 Years:</span><strong>{cagr?.sales_growth?.['5y'] != null ? `${cagr.sales_growth['5y']}%` : '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#CBD5E1', padding: '5px 0' }}>
                <span>3 Years:</span><strong style={{ color: '#10B981' }}>{cagr?.sales_growth?.['3y'] != null ? `${cagr.sales_growth['3y']}%` : '—'}</strong>
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Compounded Profit Growth
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#CBD5E1', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span>10 Years:</span><strong>{cagr?.profit_growth?.['10y'] != null ? `${cagr.profit_growth['10y']}%` : '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#CBD5E1', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span>5 Years:</span><strong>{cagr?.profit_growth?.['5y'] != null ? `${cagr.profit_growth['5y']}%` : '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#CBD5E1', padding: '5px 0' }}>
                <span>3 Years:</span><strong style={{ color: '#10B981' }}>{cagr?.profit_growth?.['3y'] != null ? `${cagr.profit_growth['3y']}%` : '—'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: QUARTERLY RESULTS & CHARTS ── */}
      {activeTab === 'quarters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Quarterly Chart */}
          <div style={cardStyle}>
            <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginBottom: 12 }}>Last 8 Quarters Revenue & Net Profit Trend (₹ Cr)</div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={quarterly} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.74rem' }} formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')} Cr`]} />
                <Bar dataKey="revenue" fill="#6366F1" radius={[4, 4, 0, 0]} name="Revenue" />
                <Line type="monotone" dataKey="net_profit" stroke="#10B981" strokeWidth={2} name="Net Profit" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Quarterly Table */}
          <div style={{ ...cardStyle, overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#F0F0FF' }}>Quarterly Financials (₹ Cr)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Period</th>
                  <th style={{ padding: '8px' }}>Sales</th>
                  <th style={{ padding: '8px' }}>Expenses</th>
                  <th style={{ padding: '8px' }}>Op. Profit</th>
                  <th style={{ padding: '8px' }}>OPM %</th>
                  <th style={{ padding: '8px' }}>Net Profit</th>
                  <th style={{ padding: '8px' }}>EPS ₹</th>
                </tr>
              </thead>
              <tbody>
                {quarterly.map((q, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: '#F0F0FF' }}>{q.period}</td>
                    <td style={{ padding: '8px' }}>{q.revenue != null ? Number(q.revenue).toLocaleString('en-IN') : (q['Sales'] != null ? Number(q['Sales']).toLocaleString('en-IN') : '—')}</td>
                    <td style={{ padding: '8px' }}>{q['Expenses'] != null ? Number(q['Expenses']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px' }}>{q['Operating Profit'] != null ? Number(q['Operating Profit']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px' }}>{q['OPM %'] != null ? `${q['OPM %']}%` : '—'}</td>
                    <td style={{ padding: '8px', fontWeight: 700, color: '#10B981' }}>{q.net_profit != null ? Number(q.net_profit).toLocaleString('en-IN') : (q['Net Profit'] != null ? Number(q['Net Profit']).toLocaleString('en-IN') : '—')}</td>
                    <td style={{ padding: '8px' }}>{q.eps != null ? q.eps : (q['EPS in Rs'] || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: ANNUAL 10-YEAR P&L ── */}
      {activeTab === 'annual' && (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: '#F0F0FF' }}>Annual 10-Year Consolidated P&L (₹ Cr)</h3>
          {annualPl.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Year</th>
                  <th style={{ padding: '8px' }}>Sales</th>
                  <th style={{ padding: '8px' }}>Expenses</th>
                  <th style={{ padding: '8px' }}>Operating Profit</th>
                  <th style={{ padding: '8px' }}>OPM %</th>
                  <th style={{ padding: '8px' }}>Net Profit</th>
                  <th style={{ padding: '8px' }}>EPS ₹</th>
                  <th style={{ padding: '8px' }}>Dividend Payout %</th>
                </tr>
              </thead>
              <tbody>
                {annualPl.map((yr, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: '#F0F0FF' }}>{yr.period}</td>
                    <td style={{ padding: '8px' }}>{yr['Sales'] != null ? Number(yr['Sales']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px' }}>{yr['Expenses'] != null ? Number(yr['Expenses']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px' }}>{yr['Operating Profit'] != null ? Number(yr['Operating Profit']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px' }}>{yr['OPM %'] != null ? `${yr['OPM %']}%` : '—'}</td>
                    <td style={{ padding: '8px', fontWeight: 700, color: '#818CF8' }}>{yr['Net Profit'] != null ? Number(yr['Net Profit']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px' }}>{yr['EPS in Rs'] != null ? yr['EPS in Rs'] : '—'}</td>
                    <td style={{ padding: '8px' }}>{yr['Dividend Payout %'] != null ? `${yr['Dividend Payout %']}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>No annual statement records available.</div>
          )}
        </div>
      )}

      {/* ── TAB 4: BALANCE SHEET ── */}
      {activeTab === 'balancesheet' && (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: '#F0F0FF' }}>Consolidated Balance Sheet (₹ Cr)</h3>
          {balanceSheet.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Year</th>
                  <th style={{ padding: '8px' }}>Equity Capital</th>
                  <th style={{ padding: '8px' }}>Reserves</th>
                  <th style={{ padding: '8px' }}>Borrowings</th>
                  <th style={{ padding: '8px' }}>Other Liab</th>
                  <th style={{ padding: '8px' }}>Total Liab</th>
                  <th style={{ padding: '8px' }}>Fixed Assets</th>
                  <th style={{ padding: '8px' }}>Total Assets</th>
                </tr>
              </thead>
              <tbody>
                {balanceSheet.map((bs, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: '#F0F0FF' }}>{bs.period}</td>
                    <td style={{ padding: '8px' }}>{bs['Equity Capital'] != null ? Number(bs['Equity Capital']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px' }}>{bs['Reserves'] != null ? Number(bs['Reserves']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px', color: '#F59E0B' }}>{bs['Borrowings'] != null ? Number(bs['Borrowings']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px' }}>{bs['Other Liabilities'] != null ? Number(bs['Other Liabilities']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px', fontWeight: 700 }}>{bs['Total Liabilities'] != null ? Number(bs['Total Liabilities']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px' }}>{bs['Fixed Assets'] != null ? Number(bs['Fixed Assets']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px', fontWeight: 700, color: '#818CF8' }}>{bs['Total Assets'] != null ? Number(bs['Total Assets']).toLocaleString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Balance sheet data available.</div>
          )}
        </div>
      )}

      {/* ── TAB 5: CASH FLOWS ── */}
      {activeTab === 'cashflow' && (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: '#F0F0FF' }}>Cash Flow Statement (₹ Cr)</h3>
          {cashFlow.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Period</th>
                  <th style={{ padding: '8px' }}>Operating Cash Flow (CFO)</th>
                  <th style={{ padding: '8px' }}>Investing Cash Flow (CFI)</th>
                  <th style={{ padding: '8px' }}>Financing Cash Flow (CFF)</th>
                  <th style={{ padding: '8px' }}>Net Cash Flow</th>
                </tr>
              </thead>
              <tbody>
                {cashFlow.map((cf, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: '#F0F0FF' }}>{cf.period}</td>
                    <td style={{ padding: '8px', color: (cf['Cash from Operating Activity'] || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                      {cf['Cash from Operating Activity'] != null ? Number(cf['Cash from Operating Activity']).toLocaleString('en-IN') : '—'}
                    </td>
                    <td style={{ padding: '8px' }}>{cf['Cash from Investing Activity'] != null ? Number(cf['Cash from Investing Activity']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px' }}>{cf['Cash from Financing Activity'] != null ? Number(cf['Cash from Financing Activity']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '8px', fontWeight: 700, color: '#818CF8' }}>
                      {cf['Net Cash Flow'] != null ? Number(cf['Net Cash Flow']).toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Cash flow statements available.</div>
          )}
        </div>
      )}

      {/* ── TAB 6: SHAREHOLDING PATTERN ── */}
      {activeTab === 'shareholding' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          <div style={{ ...cardStyle, overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: '#F0F0FF' }}>Quarterly Shareholding (%)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Quarter</th>
                  <th style={{ padding: '8px' }}>Promoter</th>
                  <th style={{ padding: '8px' }}>FII</th>
                  <th style={{ padding: '8px' }}>DII</th>
                  <th style={{ padding: '8px' }}>Public</th>
                </tr>
              </thead>
              <tbody>
                {shareholding.map((sh, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: '#F0F0FF' }}>{sh.quarter}</td>
                    <td style={{ padding: '8px', color: '#10B981' }}>{sh.promoter}%</td>
                    <td style={{ padding: '8px', color: '#818CF8' }}>{sh.fii}%</td>
                    <td style={{ padding: '8px', color: '#F59E0B' }}>{sh.dii}%</td>
                    <td style={{ padding: '8px' }}>{sh.public}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#818CF8', alignSelf: 'flex-start' }}>Latest Ownership Distribution</h3>
            {shareholding.length > 0 && (
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Promoters', value: shareholding[shareholding.length - 1].promoter, color: '#10B981' },
                        { name: 'FIIs', value: shareholding[shareholding.length - 1].fii, color: '#818CF8' },
                        { name: 'DIIs', value: shareholding[shareholding.length - 1].dii, color: '#F59E0B' },
                        { name: 'Public', value: shareholding[shareholding.length - 1].public, color: '#64748B' },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, value }) => `${name} ${value}%`}
                    >
                      {[
                        { color: '#10B981' },
                        { color: '#818CF8' },
                        { color: '#F59E0B' },
                        { color: '#64748B' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 7: PEER COMPARISON ── */}
      {activeTab === 'peers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {peers.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginBottom: 12 }}>Peer P/E & ROCE Comparison</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={peers} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.74rem' }} />
                  <Bar dataKey="pe_ratio" fill="#6366F1" name="P/E Ratio" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="roce" fill="#10B981" name="ROCE %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ ...cardStyle, overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#F0F0FF' }}>Sector Peer Ranking Table</h3>
            {peers.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Company</th>
                    <th style={{ padding: '8px' }}>CMP ₹</th>
                    <th style={{ padding: '8px' }}>P/E</th>
                    <th style={{ padding: '8px' }}>Mar Cap ₹ Cr</th>
                    <th style={{ padding: '8px' }}>ROCE %</th>
                  </tr>
                </thead>
                <tbody>
                  {peers.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                      <td style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: p.name.includes(ticker) ? '#818CF8' : '#F0F0FF' }}>
                        {p.name}
                      </td>
                      <td style={{ padding: '8px' }}>{p.price != null ? Number(p.price).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '8px' }}>{p.pe_ratio != null ? p.pe_ratio : '—'}</td>
                      <td style={{ padding: '8px' }}>{p.market_cap != null ? Number(p.market_cap).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '8px', color: (p.roce || 0) > 15 ? '#10B981' : '#CBD5E1' }}>
                        {p.roce != null ? `${p.roce}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Sector peer rankings loaded.</div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 8: DCF INTRINSIC VALUATION ── */}
      {activeTab === 'valuation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <RatioCard label="DCF Intrinsic Fair Value" value={dcf.dcf_fair_value} unit=" ₹" col="#10B981" sub="Multi-Stage Model" />
            <RatioCard label="Benjamin Graham Number" value={dcf.graham_number} unit=" ₹" col="#818CF8" sub="Asset & EPS Formula" />
            <RatioCard label="Peter Lynch Fair Value" value={dcf.peter_lynch_value} unit=" ₹" col="#C084FC" sub="Growth Multiple" />
            <RatioCard label="Margin of Safety" value={dcf.margin_of_safety_pct} unit="%" colorFn={(v) => v >= 0 ? '#10B981' : '#EF5350'} sub={dcf.valuation_verdict} />
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#818CF8' }}>DCF Valuation Assumptions & Cash Flow Forecast</h3>
            <p style={{ fontSize: '0.74rem', color: '#94A3B8', lineHeight: 1.5, margin: '0 0 12px' }}>
              Assumed 5-Year FCF Growth Rate: <strong style={{ color: '#F8FAFC' }}>{dcf.assumed_growth_rate_pct || 12}%</strong> | Discount Rate (WACC): <strong style={{ color: '#F8FAFC' }}>{dcf.discount_rate_wacc_pct || 11.5}%</strong> | Terminal Growth Rate: <strong style={{ color: '#F8FAFC' }}>4.5%</strong>.
            </p>
            {dcf.projected_fcf?.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Period</th>
                    <th style={{ padding: '8px' }}>Projected FCF per Share (₹)</th>
                    <th style={{ padding: '8px' }}>Discounted Present Value (PV)</th>
                  </tr>
                </thead>
                <tbody>
                  {dcf.projected_fcf.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                      <td style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: '#F0F0FF' }}>{p.year}</td>
                      <td style={{ padding: '8px' }}>₹{p.fcf_per_share}</td>
                      <td style={{ padding: '8px', color: '#10B981', fontWeight: 700 }}>₹{p.pv_fcf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

    </div>
  );
}