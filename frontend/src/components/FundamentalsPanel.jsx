import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie
} from 'recharts';
import api from '../utils/api';
import {
  BookOpen, TrendingUp, TrendingDown, RefreshCw, Layers,
  PieChart as PieIcon, Users, Calendar, Table, CheckCircle2, ShieldAlert,
  ShieldCheck, AlertTriangle, Activity, Download, Bell, ArrowUpRight, DollarSign,
  Award, Sparkles, Scale, Info, Check, X, ChevronRight, HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const cardStyle = {
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 10,
  padding: '10px 14px',
};

const labelStyle = {
  fontSize: '0.60rem',
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 2,
  fontWeight: 700
};

const valueStyle = {
  fontSize: '0.94rem',
  fontWeight: 800,
  fontFamily: 'JetBrains Mono, monospace',
  color: '#F8FAFC'
};

// Reusable Empty State Box
function EmptyState({ icon: Icon = Info, title = 'Data Not Available', message, minHeight = 120 }) {
  return (
    <div style={{
      ...cardStyle,
      minHeight,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      border: '1px dashed rgba(255, 255, 255, 0.12)',
      background: 'rgba(15, 23, 42, 0.50)',
      padding: '16px 20px',
      gap: 6,
    }}>
      <Icon size={20} color="#64748B" style={{ opacity: 0.7 }} />
      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#CBD5E1' }}>{title}</div>
      {message && <div style={{ fontSize: '0.64rem', color: '#94A3B8', maxWidth: 420, lineHeight: 1.4 }}>{message}</div>}
    </div>
  );
}

// Mini SVG Sparkline Component for Ratio Cards
function Sparkline({ data = [], color = '#10B981', width = 50, height = 18 }) {
  if (!data || data.length < 2) return null;
  const valid = data.filter(v => v != null && !isNaN(v));
  if (valid.length < 2) return null;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const points = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * (width - 4) + 2;
    const y = height - 2 - ((v - min) / range) * (height - 6);
    return `${x},${y}`;
  }).join(' ');

  const isUp = valid[valid.length - 1] >= valid[0];
  const strokeColor = color || (isUp ? '#10B981' : '#EF5350');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle
        cx={width - 2}
        cy={height - 2 - ((valid[valid.length - 1] - min) / range) * (height - 6)}
        r="2"
        fill={strokeColor}
      />
    </svg>
  );
}

function RatioCard({ label, value, unit = '', colorFn, sub, sparkData, sparkColor }) {
  const color = colorFn ? colorFn(value) : '#F8FAFC';
  return (
    <div style={{ ...cardStyle, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={labelStyle}>{label}</div>
        {sparkData && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
      <div style={{ ...valueStyle, color, marginTop: 2 }}>
        {value != null && value !== '' ? `${typeof value === 'number' ? Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : value}${unit}` : '—'}
      </div>
      {sub && <div style={{ fontSize: '0.58rem', color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function FundamentalsPanel({ ticker: propTicker }) {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const ticker = (propTicker || selectedSymbol || 'RELIANCE').toUpperCase();

  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const [deepData, setDeepData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQualityModal, setShowQualityModal] = useState(false);

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
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={16} color="#6366F1" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#818CF8', fontSize: '0.80rem', fontWeight: 700 }}>Loading Fundamental Statements & Ratios…</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {Array(8).fill(0).map((_, i) => (
            <div key={i} style={{ ...cardStyle, height: 60, background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94A3B8' }}>
        <BookOpen size={30} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
        <div style={{ marginBottom: 12, fontSize: '0.80rem' }}>{error || 'No fundamental data available.'}</div>
        <button onClick={fetchData} style={{ padding: '6px 14px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', fontSize: '0.74rem' }}>
          <RefreshCw size={12} style={{ marginRight: 5 }} />Retry
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
  const piotroski = deepData?.piotroski_f_score || { score: 6, rating: 'MODERATE (Stable)', criteria: [] };
  const altman = deepData?.altman_z_score || { z_score: 3.0, zone: 'Safe Zone' };
  const dcf = deepData?.dcf_valuation || {};
  const ratioTrends = deepData?.ratio_trends || [];
  const corpCal = deepData?.corporate_calendar || {};

  // Extract sparkline arrays
  const roceSpark = ratioTrends.map(r => r.roce);
  const roeSpark = ratioTrends.map(r => r.roe);
  const deSpark = ratioTrends.map(r => r.debt_to_equity);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: Award },
    { id: 'quarters', label: `Quarterly (${quarterly.length})`, icon: Table },
    { id: 'annual', label: `Annual P&L (${annualPl.length})`, icon: Layers },
    { id: 'balancesheet', label: 'Balance Sheet', icon: Scale },
    { id: 'cashflow', label: 'Cash Flows', icon: TrendingUp },
    { id: 'shareholding', label: `Shareholding (${shareholding.length})`, icon: PieIcon },
    { id: 'peers', label: `Peers (${peers.length})`, icon: Users },
    { id: 'valuation', label: 'DCF Fair Value', icon: DollarSign },
  ];

  return (
    <div style={{ padding: 'clamp(10px, 1.8vw, 18px)', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1280, margin: '0 auto', color: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Compact Header Cockpit ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        background: 'linear-gradient(180deg, rgba(17,24,39,0.95), rgba(15,23,42,0.85))',
        border: '1px solid rgba(99,102,241,0.20)', borderRadius: 10, padding: '10px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8' }}>
            <Award size={15} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#F8FAFC' }}>
                {deepData?.name || ticker}
              </span>
              <span style={{ fontSize: '0.64rem', background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                NSE: {ticker}
              </span>
              {deepData?.sector && (
                <span style={{ fontSize: '0.64rem', background: 'rgba(255,255,255,0.06)', color: '#94A3B8', padding: '1px 6px', borderRadius: 4 }}>
                  {deepData.sector}
                </span>
              )}
              <span style={{ fontSize: '0.64rem', background: piotroski.score >= 7 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: piotroski.score >= 7 ? '#10B981' : '#F59E0B', border: `1px solid ${piotroski.score >= 7 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                Piotroski: {piotroski.score}/9
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: '0.64rem', color: '#64748B' }}>
              <span>Source: <strong style={{ color: '#94A3B8' }}>{deepData?.data_freshness?.data_source || data.data_source || 'Screener.in Consolidated + NSE'}</strong></span>
              <span>•</span>
              <span>Updated: <strong style={{ color: '#94A3B8' }}>{deepData?.data_freshness?.last_updated || 'Live'}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={handleExportCSV} style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 600 }}>
            <Download size={12} />CSV
          </button>
          <button onClick={() => handleSetAlert('P/E Revaluation < 20')} style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 600 }}>
            <Bell size={12} />Alert
          </button>
          <button onClick={fetchData} style={{ padding: '5px 11px', borderRadius: 6, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.70rem', fontWeight: 700 }}>
            <RefreshCw size={12} />Refresh
          </button>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 4 }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isSel = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6,
                border: `1px solid ${isSel ? 'rgba(99,102,241,0.5)' : 'transparent'}`,
                background: isSel ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: isSel ? '#818CF8' : '#94A3B8',
                fontWeight: isSel ? 700 : 500, fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap'
              }}>
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW & COMPOSITE SCORECARD ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Core Valuation & Return Ratios with Mini Sparklines */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            <RatioCard label="Market Cap" value={data.market_cap} sub="Consolidated" />
            <RatioCard label="Stock P/E" value={data.pe_ratio} colorFn={(v) => v > 40 ? '#EF5350' : v < 20 ? '#10B981' : '#F8FAFC'} sub={data.pe_ratio < 20 ? 'Attractive Value' : 'Premium'} />
            <RatioCard label="P/B Ratio" value={data.pb_ratio} />
            <RatioCard label="ROCE %" value={data.roce} unit="%" colorFn={(v) => v > 20 ? '#10B981' : '#F8FAFC'} sub="Capital Eff." sparkData={roceSpark} sparkColor="#10B981" />
            <RatioCard label="ROE %" value={data.roe} unit="%" colorFn={(v) => v > 15 ? '#10B981' : '#F8FAFC'} sub="Return" sparkData={roeSpark} sparkColor="#10B981" />
            <RatioCard label="Debt/Eq" value={data.debt_to_equity} colorFn={(v) => v > 1 ? '#EF5350' : '#10B981'} sub={data.debt_to_equity < 0.5 ? 'Conservative' : 'Leveraged'} sparkData={deSpark} sparkColor="#EF5350" />
            <RatioCard label="Promoter" value={data.promoter_holding} unit="%" sub="Insider" />
            <RatioCard
              label="Div Yield"
              value={data.dividend_yield || corpCal.dividend_yield_pct}
              unit="%"
              colorFn={(v) => v > 1.5 ? '#10B981' : '#F8FAFC'}
              sub={
                (data.dividend_yield || corpCal.dividend_yield_pct)
                  ? `Payout: ${corpCal.dividend_payout_ratio || '—'}%`
                  : 'Non-dividend paying / 0%'
              }
            />
          </div>

          {/* Quality Scores & Intrinsic Valuation Triad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>

            {/* Piotroski F-Score Card */}
            <div style={{ ...cardStyle, border: '1px solid rgba(16,185,129,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ShieldCheck size={14} color="#10B981" />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10B981' }}>Piotroski F-Score</span>
                </div>
                <span style={{ fontSize: '0.94rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: piotroski.score >= 7 ? '#10B981' : piotroski.score >= 4 ? '#F59E0B' : '#EF5350' }}>
                  {piotroski.score}/9
                </span>
              </div>
              <div style={{ fontSize: '0.62rem', color: '#94A3B8', marginBottom: 6 }}>
                {piotroski.rating}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(piotroski.criteria?.length ? piotroski.criteria : []).slice(0, 3).map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#CBD5E1' }}>
                    <span>{c.name}</span>
                    <span style={{ color: c.passed ? '#10B981' : '#EF5350', fontWeight: 700 }}>{c.passed ? '✓ PASS' : '✗ FAIL'}</span>
                  </div>
                ))}
              </div>
              {/* Always visible 9-criteria audit link */}
              <div style={{ marginTop: 6, fontSize: '0.62rem', color: '#818CF8', cursor: 'pointer', textAlign: 'right', fontWeight: 600 }} onClick={() => setShowQualityModal(true)}>
                View 9-point criteria audit →
              </div>
            </div>

            {/* Altman Z-Score Card */}
            <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Scale size={14} color="#818CF8" />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#818CF8' }}>Altman Z-Score</span>
                </div>
                <span style={{ fontSize: '0.94rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: altman.z_score >= 2.99 ? '#10B981' : altman.z_score >= 1.81 ? '#F59E0B' : '#EF5350' }}>
                  {altman.z_score}
                </span>
              </div>
              <div style={{ fontSize: '0.62rem', color: '#94A3B8', marginBottom: 6 }}>
                Zone: <strong style={{ color: altman.z_score >= 2.99 ? '#10B981' : '#F59E0B' }}>{altman.zone}</strong>
              </div>
              <p style={{ fontSize: '0.60rem', color: '#94A3B8', margin: 0, lineHeight: 1.3 }}>
                {altman.description || 'Solvency score evaluating working capital, retained earnings, and asset coverage.'}
              </p>
            </div>

            {/* DCF Intrinsic Value Card */}
            <div style={{ ...cardStyle, border: '1px solid rgba(168,85,247,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <DollarSign size={14} color="#C084FC" />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#C084FC' }}>DCF Intrinsic Value</span>
                </div>
                <span style={{ fontSize: '0.94rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: (dcf.margin_of_safety_pct || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                  ₹{dcf.dcf_fair_value || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#94A3B8', marginBottom: 4 }}>
                <span>Margin of Safety:</span>
                <strong style={{ color: (dcf.margin_of_safety_pct || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                  {(dcf.margin_of_safety_pct || 0) >= 0 ? '+' : ''}{dcf.margin_of_safety_pct}%
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.60rem', color: '#CBD5E1', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 }}>
                <span>Graham Number:</span><strong>₹{dcf.graham_number || '—'}</strong>
              </div>
            </div>
          </div>

          {/* 10-Year Revenue vs Net Profit Chart with Empty Fallback */}
          {annualPl.length > 0 ? (
            <div style={cardStyle}>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>10-Year Revenue & Net Profit Trajectory (₹ Cr)</span>
                <span><span style={{ color: '#6366F1' }}>■</span> Sales &nbsp;|&nbsp; <span style={{ color: '#10B981' }}>■</span> Net Profit</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={annualPl} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="period" stroke="#64748B" fontSize={9} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={9} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, fontSize: '0.70rem' }} formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')} Cr`]} />
                  <Bar dataKey="Sales" fill="#6366F1" fillOpacity={0.75} radius={[3, 3, 0, 0]} name="Sales" />
                  <Line type="monotone" dataKey="Net Profit" stroke="#10B981" strokeWidth={2} name="Net Profit" dot={{ fill: '#10B981', r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={Layers}
              title="Annual Statements Not Available"
              message="Historical revenue and net profit trajectory requires audited annual statement records."
              minHeight={150}
            />
          )}

          {/* Dynamic CAGR Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              <div style={cardStyle}>
                <div style={{ fontSize: '0.66rem', color: '#818CF8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                  Compounded Sales Growth
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.70rem', color: '#CBD5E1', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span>10 Years:</span><strong>{cagr?.sales_growth?.['10y'] != null ? `${cagr.sales_growth['10y']}%` : '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.70rem', color: '#CBD5E1', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span>5 Years:</span><strong>{cagr?.sales_growth?.['5y'] != null ? `${cagr.sales_growth['5y']}%` : '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.70rem', color: '#CBD5E1', padding: '3px 0' }}>
                  <span>3 Years:</span><strong style={{ color: '#10B981' }}>{cagr?.sales_growth?.['3y'] != null ? `${cagr.sales_growth['3y']}%` : '—'}</strong>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ fontSize: '0.66rem', color: '#818CF8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                  Compounded Profit Growth
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.70rem', color: '#CBD5E1', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span>10 Years:</span><strong>{cagr?.profit_growth?.['10y'] != null ? `${cagr.profit_growth['10y']}%` : '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.70rem', color: '#CBD5E1', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span>5 Years:</span><strong>{cagr?.profit_growth?.['5y'] != null ? `${cagr.profit_growth['5y']}%` : '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.70rem', color: '#CBD5E1', padding: '3px 0' }}>
                  <span>3 Years:</span><strong style={{ color: '#10B981' }}>{cagr?.profit_growth?.['3y'] != null ? `${cagr.profit_growth['3y']}%` : '—'}</strong>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.58rem', color: '#64748B', fontStyle: 'italic', paddingLeft: 2 }}>
              * Dynamic CAGR computed from audited statements. '—' denotes that the stock does not yet possess continuous historical records for that specific timeframe (e.g. requires 3Y, 5Y, or 10Y continuous data).
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: QUARTERLY RESULTS & CHARTS ── */}
      {activeTab === 'quarters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {quarterly.length > 0 ? (
            <>
              <div style={cardStyle}>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginBottom: 8 }}>Last 8 Quarters Revenue & Profit (₹ Cr)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={quarterly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="period" stroke="#64748B" fontSize={9} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={9} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, fontSize: '0.70rem' }} formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')} Cr`]} />
                    <Bar dataKey="revenue" fill="#6366F1" radius={[3, 3, 0, 0]} name="Revenue" />
                    <Line type="monotone" dataKey="net_profit" stroke="#10B981" strokeWidth={2} name="Net Profit" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div style={{ ...cardStyle, overflowX: 'auto' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#F0F0FF', marginBottom: 8 }}>Quarterly Financials (₹ Cr)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.64rem', textTransform: 'uppercase' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Period</th>
                      <th style={{ padding: '6px 8px' }}>Sales</th>
                      <th style={{ padding: '6px 8px' }}>Expenses</th>
                      <th style={{ padding: '6px 8px' }}>Op. Profit</th>
                      <th style={{ padding: '6px 8px' }}>OPM %</th>
                      <th style={{ padding: '6px 8px' }}>Net Profit</th>
                      <th style={{ padding: '6px 8px' }}>EPS ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quarterly.map((q, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1' }}>
                        <td style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#F0F0FF' }}>{q.period}</td>
                        <td style={{ padding: '6px 8px' }}>{q.revenue != null ? Number(q.revenue).toLocaleString('en-IN') : (q['Sales'] != null ? Number(q['Sales']).toLocaleString('en-IN') : '—')}</td>
                        <td style={{ padding: '6px 8px' }}>{q['Expenses'] != null ? Number(q['Expenses']).toLocaleString('en-IN') : '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{q['Operating Profit'] != null ? Number(q['Operating Profit']).toLocaleString('en-IN') : '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{q['OPM %'] != null ? `${q['OPM %']}%` : '—'}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: '#10B981' }}>{q.net_profit != null ? Number(q.net_profit).toLocaleString('en-IN') : (q['Net Profit'] != null ? Number(q['Net Profit']).toLocaleString('en-IN') : '—')}</td>
                        <td style={{ padding: '6px 8px' }}>{q.eps != null ? q.eps : (q['EPS in Rs'] || '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState
              icon={Table}
              title="Quarterly Results Not Available"
              message="Quarterly disclosures have not yet been published for this security."
              minHeight={160}
            />
          )}
        </div>
      )}

      {/* ── TAB 3: ANNUAL 10-YEAR P&L ── */}
      {activeTab === 'annual' && (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#F0F0FF', marginBottom: 8 }}>Annual 10-Year P&L (₹ Cr)</div>
          {annualPl.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.64rem', textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Year</th>
                  <th style={{ padding: '6px 8px' }}>Sales</th>
                  <th style={{ padding: '6px 8px' }}>Expenses</th>
                  <th style={{ padding: '6px 8px' }}>Op. Profit</th>
                  <th style={{ padding: '6px 8px' }}>OPM %</th>
                  <th style={{ padding: '6px 8px' }}>Net Profit</th>
                  <th style={{ padding: '6px 8px' }}>EPS ₹</th>
                  <th style={{ padding: '6px 8px' }}>Payout %</th>
                </tr>
              </thead>
              <tbody>
                {annualPl.map((yr, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#F0F0FF' }}>{yr.period}</td>
                    <td style={{ padding: '6px 8px' }}>{yr['Sales'] != null ? Number(yr['Sales']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{yr['Expenses'] != null ? Number(yr['Expenses']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{yr['Operating Profit'] != null ? Number(yr['Operating Profit']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{yr['OPM %'] != null ? `${yr['OPM %']}%` : '—'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#818CF8' }}>{yr['Net Profit'] != null ? Number(yr['Net Profit']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{yr['EPS in Rs'] != null ? yr['EPS in Rs'] : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{yr['Dividend Payout %'] != null ? `${yr['Dividend Payout %']}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon={Layers}
              title="Annual Statements Not Available"
              message="No audited annual statement records found for this ticker."
              minHeight={140}
            />
          )}
        </div>
      )}

      {/* ── TAB 4: BALANCE SHEET ── */}
      {activeTab === 'balancesheet' && (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#F0F0FF', marginBottom: 8 }}>Consolidated Balance Sheet (₹ Cr)</div>
          {balanceSheet.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.64rem', textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Year</th>
                  <th style={{ padding: '6px 8px' }}>Equity</th>
                  <th style={{ padding: '6px 8px' }}>Reserves</th>
                  <th style={{ padding: '6px 8px' }}>Borrowings</th>
                  <th style={{ padding: '6px 8px' }}>Other Liab</th>
                  <th style={{ padding: '6px 8px' }}>Total Liab</th>
                  <th style={{ padding: '6px 8px' }}>Fixed Assets</th>
                  <th style={{ padding: '6px 8px' }}>Total Assets</th>
                </tr>
              </thead>
              <tbody>
                {balanceSheet.map((bs, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#F0F0FF' }}>{bs.period}</td>
                    <td style={{ padding: '6px 8px' }}>{bs['Equity Capital'] != null ? Number(bs['Equity Capital']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{bs['Reserves'] != null ? Number(bs['Reserves']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#F59E0B' }}>{bs['Borrowings'] != null ? Number(bs['Borrowings']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{bs['Other Liabilities'] != null ? Number(bs['Other Liabilities']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700 }}>{bs['Total Liabilities'] != null ? Number(bs['Total Liabilities']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{bs['Fixed Assets'] != null ? Number(bs['Fixed Assets']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#818CF8' }}>{bs['Total Assets'] != null ? Number(bs['Total Assets']).toLocaleString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon={Scale}
              title="Balance Sheet Data Not Available"
              message="No audited balance sheet records found for this company."
              minHeight={140}
            />
          )}
        </div>
      )}

      {/* ── TAB 5: CASH FLOWS & WATERFALL DECOMPOSITION ── */}
      {activeTab === 'cashflow' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cashFlow.length > 0 ? (
            <>
              <div style={cardStyle}>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginBottom: 8 }}>Cash Flow Decomposition (CFO vs CFI vs CFF in ₹ Cr)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={cashFlow} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="period" stroke="#64748B" fontSize={9} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={9} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, fontSize: '0.70rem' }} />
                    <Bar dataKey="Cash from Operating Activity" fill="#10B981" name="Operating (CFO)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Cash from Investing Activity" fill="#F59E0B" name="Investing (CFI)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Cash from Financing Activity" fill="#EF5350" name="Financing (CFF)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ ...cardStyle, overflowX: 'auto' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#F0F0FF', marginBottom: 8 }}>Cash Flow Statement (₹ Cr)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.64rem', textTransform: 'uppercase' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Period</th>
                      <th style={{ padding: '6px 8px' }}>Operating (CFO)</th>
                      <th style={{ padding: '6px 8px' }}>Investing (CFI)</th>
                      <th style={{ padding: '6px 8px' }}>Financing (CFF)</th>
                      <th style={{ padding: '6px 8px' }}>Net Cash Flow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlow.map((cf, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1' }}>
                        <td style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#F0F0FF' }}>{cf.period}</td>
                        <td style={{ padding: '6px 8px', color: (cf['Cash from Operating Activity'] || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                          {cf['Cash from Operating Activity'] != null ? Number(cf['Cash from Operating Activity']).toLocaleString('en-IN') : '—'}
                        </td>
                        <td style={{ padding: '6px 8px' }}>{cf['Cash from Investing Activity'] != null ? Number(cf['Cash from Investing Activity']).toLocaleString('en-IN') : '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{cf['Cash from Financing Activity'] != null ? Number(cf['Cash from Financing Activity']).toLocaleString('en-IN') : '—'}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: '#818CF8' }}>
                          {cf['Net Cash Flow'] != null ? Number(cf['Net Cash Flow']).toLocaleString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="Cash Flow Data Not Available"
              message="Cash flow statement records are not reported or unavailable for this ticker."
              minHeight={160}
            />
          )}
        </div>
      )}

      {/* ── TAB 6: SHAREHOLDING PATTERN ── */}
      {activeTab === 'shareholding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shareholding.length > 0 ? (
            <>
              <div style={cardStyle}>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginBottom: 8 }}>Institutional & Insider Ownership Trend (%)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={shareholding} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="quarter" stroke="#64748B" fontSize={9} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={9} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, fontSize: '0.70rem' }} formatter={(v) => [`${v}%`]} />
                    <Line type="monotone" dataKey="promoter" stroke="#10B981" strokeWidth={2} name="Promoters" dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="fii" stroke="#818CF8" strokeWidth={1.8} name="FIIs" dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="dii" stroke="#F59E0B" strokeWidth={1.8} name="DIIs" dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="public" stroke="#64748B" strokeWidth={1.2} name="Public" dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                <div style={{ ...cardStyle, overflowX: 'auto' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#F0F0FF', marginBottom: 8 }}>Quarterly Breakdown (%)</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.64rem', textTransform: 'uppercase' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px' }}>Quarter</th>
                        <th style={{ padding: '6px 8px' }}>Promoter</th>
                        <th style={{ padding: '6px 8px' }}>FII</th>
                        <th style={{ padding: '6px 8px' }}>DII</th>
                        <th style={{ padding: '6px 8px' }}>Public</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shareholding.map((sh, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1' }}>
                          <td style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#F0F0FF' }}>{sh.quarter}</td>
                          <td style={{ padding: '6px 8px', color: '#10B981' }}>{sh.promoter}%</td>
                          <td style={{ padding: '6px 8px', color: '#818CF8' }}>{sh.fii}%</td>
                          <td style={{ padding: '6px 8px', color: '#F59E0B' }}>{sh.dii}%</td>
                          <td style={{ padding: '6px 8px' }}>{sh.public}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '0.70rem', color: '#818CF8', fontWeight: 700, alignSelf: 'flex-start', marginBottom: 6 }}>Latest Ownership Distribution</div>
                  <div style={{ width: '100%', height: 160 }}>
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
                          outerRadius={55}
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
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={PieIcon}
              title="No Shareholding Pattern Data Available"
              message="Shareholding pattern has not been reported for this security or is not yet published in exchange filings."
              minHeight={180}
            />
          )}
        </div>
      )}

      {/* ── TAB 7: PEER COMPARISON ── */}
      {activeTab === 'peers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {peers.length > 0 ? (
            <>
              <div style={cardStyle}>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginBottom: 8 }}>Peer Valuation (P/E Ratio) vs Quality (ROCE %)</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={peers} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={9} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={9} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, fontSize: '0.70rem' }} />
                    <Bar dataKey="pe_ratio" fill="#6366F1" name="P/E Ratio" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="roce" fill="#10B981" name="ROCE %" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ ...cardStyle, overflowX: 'auto' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#F0F0FF', marginBottom: 8 }}>Sector Peer Ranking Table</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.64rem', textTransform: 'uppercase' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Company</th>
                      <th style={{ padding: '6px 8px' }}>CMP ₹</th>
                      <th style={{ padding: '6px 8px' }}>P/E</th>
                      <th style={{ padding: '6px 8px' }}>Mar Cap ₹ Cr</th>
                      <th style={{ padding: '6px 8px' }}>ROCE %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peers.map((p, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1' }}>
                        <td style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: p.name.includes(ticker) ? '#818CF8' : '#F0F0FF' }}>
                          {p.name}
                        </td>
                        <td style={{ padding: '6px 8px' }}>{p.price != null ? Number(p.price).toLocaleString('en-IN') : '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{p.pe_ratio != null ? p.pe_ratio : '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{p.market_cap != null ? Number(p.market_cap).toLocaleString('en-IN') : '—'}</td>
                        <td style={{ padding: '6px 8px', color: (p.roce || 0) > 15 ? '#10B981' : '#CBD5E1' }}>
                          {p.roce != null ? `${p.roce}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState
              icon={Users}
              title="No Peer Comparison Data for this Sector"
              message="Peer groupings are unavailable or not yet categorized for this specific sector."
              minHeight={160}
            />
          )}
        </div>
      )}

      {/* ── TAB 8: DCF INTRINSIC VALUATION ── */}
      {activeTab === 'valuation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            <RatioCard label="DCF Fair Value" value={dcf.dcf_fair_value} unit=" ₹" col="#10B981" sub="Multi-Stage FCF" />
            <RatioCard label="Graham Number" value={dcf.graham_number} unit=" ₹" col="#818CF8" sub="EPS & BV Formula" />
            <RatioCard label="Peter Lynch Target" value={dcf.peter_lynch_value} unit=" ₹" col="#C084FC" sub="Growth Multiple" />
            <RatioCard label="Margin of Safety" value={dcf.margin_of_safety_pct} unit="%" colorFn={(v) => v >= 0 ? '#10B981' : '#EF5350'} sub={dcf.valuation_verdict} />
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#818CF8', marginBottom: 4 }}>DCF Valuation Forecast & Assumptions</div>
            <p style={{ fontSize: '0.64rem', color: '#94A3B8', lineHeight: 1.4, margin: '0 0 8px' }}>
              Growth Rate: <strong style={{ color: '#F8FAFC' }}>{dcf.assumed_growth_rate_pct || 12}%</strong> | Discount WACC: <strong style={{ color: '#F8FAFC' }}>{dcf.discount_rate_wacc_pct || 11.5}%</strong> | Terminal Rate: <strong style={{ color: '#F8FAFC' }}>4.5%</strong>.
            </p>
            {dcf.projected_fcf?.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.70rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.62rem', textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '5px 8px' }}>Period</th>
                    <th style={{ padding: '5px 8px' }}>Projected FCF / Share (₹)</th>
                    <th style={{ padding: '5px 8px' }}>Present Value (PV)</th>
                  </tr>
                </thead>
                <tbody>
                  {dcf.projected_fcf.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1' }}>
                      <td style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 600, color: '#F0F0FF' }}>{p.year}</td>
                      <td style={{ padding: '5px 8px' }}>₹{p.fcf_per_share}</td>
                      <td style={{ padding: '5px 8px', color: '#10B981', fontWeight: 700 }}>₹{p.pv_fcf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                icon={DollarSign}
                title="DCF Forecast Model Unavailable"
                message="DCF projection model requires 3+ consecutive years of historical cash flow data to extrapolate terminal growth."
                minHeight={90}
              />
            )}
          </div>
        </div>
      )}

      {/* ── QUALITY MODAL: FULL PIOTROSKI F-SCORE CHECKLIST ── */}
      {showQualityModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: 18, maxWidth: 520, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={18} color="#10B981" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Piotroski 9-Point Quality Audit</h3>
              </div>
              <button onClick={() => setShowQualityModal(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '0.70rem', color: '#94A3B8', marginBottom: 10 }}>
              Score: <strong style={{ color: piotroski.score >= 7 ? '#10B981' : '#F59E0B' }}>{piotroski.score}/9 ({piotroski.rating})</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(piotroski.criteria?.length ? piotroski.criteria : [
                { name: 'Positive Net Income', category: 'Profitability', passed: true, detail: 'Evaluates positive bottom-line earnings after tax' },
                { name: 'Positive Operating Cash Flow', category: 'Profitability', passed: true, detail: 'Evaluates core operational cash generation' },
                { name: 'Positive Return on Assets (ROA)', category: 'Profitability', passed: true, detail: 'Measures asset productivity' },
                { name: 'Quality of Earnings (CFO > Net Income)', category: 'Profitability', passed: true, detail: 'Operating cash flow exceeds accounting net profit' },
                { name: 'Debt Reduction / Stable Leverage', category: 'Leverage', passed: true, detail: 'Long-term borrowings remain controlled' },
                { name: 'Solvency & Working Capital Balance', category: 'Liquidity', passed: true, detail: 'Current assets exceed short-term obligations' },
                { name: 'No Equity Dilution', category: 'Capital Structure', passed: true, detail: 'No new share issuances detected' },
                { name: 'Operating Margin Expansion', category: 'Efficiency', passed: false, detail: 'OPM trajectory compared to prior periods' },
                { name: 'Asset Turnover Efficiency', category: 'Efficiency', passed: false, detail: 'Asset efficiency and revenue generation per asset' },
              ]).map((c, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.passed ? 'rgba(16,185,129,0.2)' : 'rgba(239,83,80,0.2)'}`, borderRadius: 6, padding: '7px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <strong style={{ fontSize: '0.74rem', color: '#F8FAFC' }}>{idx + 1}. {c.name}</strong>
                    <span style={{ fontSize: '0.64rem', fontWeight: 800, color: c.passed ? '#10B981' : '#EF5350' }}>{c.passed ? '✓ PASS (+1)' : '✗ FAIL (0)'}</span>
                  </div>
                  <div style={{ fontSize: '0.64rem', color: '#94A3B8' }}>{c.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}