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
  Award, Sparkles, Scale, Info, Check, X, ChevronRight, LayoutGrid, FileText,
  Printer, ArrowDownRight, Target, Flame
} from 'lucide-react';
import toast from 'react-hot-toast';

const cardStyle = {
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 10,
  padding: '12px 14px',
};

const labelStyle = {
  fontSize: '0.62rem',
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 3,
  fontWeight: 700
};

const valueStyle = {
  fontSize: '0.96rem',
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
      padding: '18px 22px',
      gap: 6,
    }}>
      <Icon size={22} color="#64748B" style={{ opacity: 0.7 }} />
      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#CBD5E1' }}>{title}</div>
      {message && <div style={{ fontSize: '0.64rem', color: '#94A3B8', maxWidth: 440, lineHeight: 1.4 }}>{message}</div>}
    </div>
  );
}

// Mini SVG Sparkline Component for Ratio Cards
function Sparkline({ data = [], color = '#10B981', width = 54, height = 20 }) {
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
        strokeWidth="1.6"
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
      {sub && <div style={{ fontSize: '0.60rem', color: '#94A3B8', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function FundamentalsPanel({ ticker: propTicker }) {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const ticker = (propTicker || selectedSymbol || 'RELIANCE').toUpperCase();

  // State Management: 'tabs' (single isolated view) vs 'all_panels' (continuous report)
  const [viewMode, setViewMode] = useState('tabs');
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

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={16} color="#6366F1" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#818CF8', fontSize: '0.82rem', fontWeight: 700 }}>Loading Fundamental Statements & Ratios…</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {Array(8).fill(0).map((_, i) => (
            <div key={i} style={{ ...cardStyle, height: 65, background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94A3B8' }}>
        <BookOpen size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
        <div style={{ marginBottom: 12, fontSize: '0.82rem' }}>{error || 'No fundamental data available.'}</div>
        <button onClick={fetchData} style={{ padding: '7px 16px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>
          <RefreshCw size={12} style={{ marginRight: 6 }} />Retry
        </button>
      </div>
    );
  }

  // Defensive Normalizations
  const quarterly = (deepData?.quarterly_results?.length ? deepData.quarterly_results : (data?.quarterly_results || [])).map(q => ({
    ...q,
    revenue: q.revenue ?? q.Sales ?? q['Sales+'] ?? q.Revenue ?? null,
    net_profit: q.net_profit ?? q['Net Profit'] ?? q['Net Profit+'] ?? null,
    eps: q.eps ?? q['EPS in Rs'] ?? null,
  }));

  const annualPl = (deepData?.annual_pl?.length ? deepData.annual_pl : (data?.annual_pl || [])).map(a => ({
    ...a,
    Sales: a.Sales ?? a.revenue ?? a['Sales+'] ?? null,
    'Net Profit': a['Net Profit'] ?? a.net_profit ?? a['Net Profit+'] ?? null,
    'EPS in Rs': a['EPS in Rs'] ?? a.eps ?? null,
  }));

  const balanceSheet = deepData?.balance_sheet?.length ? deepData.balance_sheet : (data?.balance_sheet || []);

  const cashFlow = (deepData?.cash_flow?.length ? deepData.cash_flow : (data?.cash_flow || [])).map(cf => ({
    ...cf,
    'Cash from Operating Activity': cf['Cash from Operating Activity'] ?? cf['Operating Activity'] ?? cf['CFO'] ?? null,
    'Cash from Investing Activity': cf['Cash from Investing Activity'] ?? cf['Investing Activity'] ?? cf['CFI'] ?? null,
    'Cash from Financing Activity': cf['Cash from Financing Activity'] ?? cf['Financing Activity'] ?? cf['CFF'] ?? null,
    'Net Cash Flow': cf['Net Cash Flow'] ?? cf.net_cash_flow ?? null,
  }));

  const shareholding = (deepData?.shareholding?.length ? deepData.shareholding : (data?.shareholding || [])).map(s => ({
    ...s,
    promoter: s.promoter ?? s.Promoters ?? null,
    fii: s.fii ?? s.FIIs ?? s.FII ?? null,
    dii: s.dii ?? s.DIIs ?? s.DII ?? null,
    public: s.public ?? s.Public ?? null,
  }));

  const peers = (deepData?.peers?.length ? deepData.peers : (data?.peers || [])).map(p => ({
    ...p,
    pe_ratio: p.pe_ratio ?? p.pe ?? null,
    roce: p.roce ?? null,
  }));

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

  // Merged top ratio values
  const peVal = data?.pe_ratio ?? deepData?.pe_ratio;
  const pbVal = data?.pb_ratio ?? deepData?.pb_ratio;
  const roceVal = data?.roce ?? deepData?.roce ?? (ratioTrends.length ? ratioTrends[ratioTrends.length - 1]?.roce : null);
  const roeVal = data?.roe ?? deepData?.roe ?? (ratioTrends.length ? ratioTrends[ratioTrends.length - 1]?.roe : null);
  const deVal = data?.debt_to_equity ?? deepData?.debt_to_equity ?? (ratioTrends.length ? ratioTrends[ratioTrends.length - 1]?.debt_to_equity : null);
  const promoterVal = data?.promoter_holding ?? deepData?.promoter_holding ?? (shareholding.length ? shareholding[shareholding.length - 1]?.promoter : null);
  const mcapVal = data?.market_cap ?? deepData?.market_cap;
  const divYieldVal = data?.dividend_yield ?? deepData?.dividend_yield ?? corpCal?.dividend_yield_pct;

  // Sub-navigation tabs
  const TABS = [
    { id: 'overview', label: 'Executive Summary', badge: 'Key Ratios', icon: Award },
    { id: 'quarters', label: 'Quarterly', badge: `${quarterly.length}Q`, icon: Table },
    { id: 'annual', label: 'Annual 10Y P&L', badge: `${annualPl.length}Y`, icon: Layers },
    { id: 'balancesheet', label: 'Balance Sheet', badge: 'Assets/Liab', icon: Scale },
    { id: 'cashflow', label: 'Cash Flows', badge: 'CFO/CFI', icon: TrendingUp },
    { id: 'shareholding', label: 'Shareholding', badge: `${shareholding.length}Q`, icon: PieIcon },
    { id: 'peers', label: 'Sector Peers', badge: `${peers.length}`, icon: Users },
    { id: 'valuation', label: 'DCF Fair Value', badge: 'Intrinsic Target', icon: DollarSign },
  ];

  // ── Modular Section Renderers (Each properly isolated) ──
  const renderOverviewSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Core Valuation & Return Ratios with Mini Sparklines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
        <RatioCard label="Market Cap" value={mcapVal} sub="Consolidated ₹ Cr" />
        <RatioCard label="Stock P/E" value={peVal} colorFn={(v) => v > 40 ? '#EF5350' : v < 20 ? '#10B981' : '#F8FAFC'} sub={peVal && peVal < 20 ? 'Attractive Value' : 'Premium'} />
        <RatioCard label="P/B Ratio" value={pbVal} sub="Price to Book" />
        <RatioCard label="ROCE %" value={roceVal} unit="%" colorFn={(v) => v > 20 ? '#10B981' : '#F8FAFC'} sub="Capital Efficiency" sparkData={roceSpark} sparkColor="#10B981" />
        <RatioCard label="ROE %" value={roeVal} unit="%" colorFn={(v) => v > 15 ? '#10B981' : '#F8FAFC'} sub="Return on Equity" sparkData={roeSpark} sparkColor="#10B981" />
        <RatioCard label="Debt/Eq" value={deVal} colorFn={(v) => v > 1 ? '#EF5350' : '#10B981'} sub={deVal && deVal < 0.5 ? 'Conservative' : 'Leveraged'} sparkData={deSpark} sparkColor="#EF5350" />
        <RatioCard label="Promoter" value={promoterVal} unit="%" sub="Insider Stake" />
        <RatioCard
          label="Div Yield"
          value={divYieldVal}
          unit="%"
          colorFn={(v) => v > 1.5 ? '#10B981' : '#F8FAFC'}
          sub={
            divYieldVal
              ? `Payout: ${corpCal.dividend_payout_ratio || '—'}%`
              : 'Non-dividend / 0%'
          }
        />
      </div>

      {/* Quality Scores & Intrinsic Valuation Triad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {/* Piotroski F-Score Card */}
        <div style={{ ...cardStyle, border: '1px solid rgba(16,185,129,0.25)', background: 'linear-gradient(180deg, rgba(16,185,129,0.05), rgba(15,23,42,0.9))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} color="#10B981" />
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10B981' }}>Piotroski F-Score</span>
            </div>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: piotroski.score >= 7 ? '#10B981' : piotroski.score >= 4 ? '#F59E0B' : '#EF5350' }}>
              {piotroski.score}/9
            </span>
          </div>
          <div style={{ fontSize: '0.64rem', color: '#94A3B8', marginBottom: 8 }}>
            Rating: <strong style={{ color: piotroski.score >= 7 ? '#10B981' : '#F59E0B' }}>{piotroski.rating}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(piotroski.criteria?.length ? piotroski.criteria : []).slice(0, 3).map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#CBD5E1' }}>
                <span>{c.name}</span>
                <span style={{ color: c.passed ? '#10B981' : '#EF5350', fontWeight: 700 }}>{c.passed ? '✓ PASS' : '✗ FAIL'}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: '0.64rem', color: '#818CF8', cursor: 'pointer', textAlign: 'right', fontWeight: 700 }} onClick={() => setShowQualityModal(true)}>
            View complete 9-point audit criteria →
          </div>
        </div>

        {/* Altman Z-Score Card */}
        <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.25)', background: 'linear-gradient(180deg, rgba(99,102,241,0.05), rgba(15,23,42,0.9))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Scale size={16} color="#818CF8" />
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#818CF8' }}>Altman Z-Score</span>
            </div>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: altman.z_score >= 2.99 ? '#10B981' : altman.z_score >= 1.81 ? '#F59E0B' : '#EF5350' }}>
              {altman.z_score}
            </span>
          </div>
          <div style={{ fontSize: '0.64rem', color: '#94A3B8', marginBottom: 8 }}>
            Zone: <strong style={{ color: altman.z_score >= 2.99 ? '#10B981' : '#F59E0B' }}>{altman.zone}</strong>
          </div>
          <p style={{ fontSize: '0.62rem', color: '#94A3B8', margin: 0, lineHeight: 1.35 }}>
            {altman.description || 'Solvency gauge measuring liquidity, cumulative profitability, and asset coverage to quantify bankruptcy buffer.'}
          </p>
        </div>

        {/* DCF Intrinsic Value Card */}
        <div style={{ ...cardStyle, border: '1px solid rgba(168,85,247,0.25)', background: 'linear-gradient(180deg, rgba(168,85,247,0.05), rgba(15,23,42,0.9))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <DollarSign size={16} color="#C084FC" />
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#C084FC' }}>DCF Intrinsic Target</span>
            </div>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: (dcf.margin_of_safety_pct || 0) >= 0 ? '#10B981' : '#EF5350' }}>
              {dcf.dcf_fair_value != null ? `₹${dcf.dcf_fair_value}` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: '#94A3B8', marginBottom: 6 }}>
            <span>Margin of Safety:</span>
            <strong style={{ color: (dcf.margin_of_safety_pct || 0) >= 0 ? '#10B981' : '#EF5350' }}>
              {dcf.margin_of_safety_pct != null ? `${dcf.margin_of_safety_pct >= 0 ? '+' : ''}${dcf.margin_of_safety_pct}%` : '—'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#CBD5E1', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 5 }}>
            <span>Graham Value:</span><strong>{dcf.graham_number != null ? `₹${dcf.graham_number}` : '—'}</strong>
          </div>
        </div>
      </div>

      {/* 10-Year Revenue vs Net Profit Chart with Empty Fallback */}
      {annualPl.length > 0 ? (
        <div style={cardStyle}>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#F0F0FF' }}>10-Year Revenue & Net Profit Trajectory (₹ Cr)</span>
            <span style={{ fontSize: '0.66rem' }}><span style={{ color: '#6366F1' }}>■</span> Sales &nbsp;|&nbsp; <span style={{ color: '#10B981' }}>■</span> Net Profit</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={annualPl} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="period" stroke="#64748B" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
              <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.72rem' }} formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')} Cr`]} />
              <Bar dataKey="Sales" fill="#6366F1" fillOpacity={0.8} radius={[4, 4, 0, 0]} name="Sales" />
              <Line type="monotone" dataKey="Net Profit" stroke="#10B981" strokeWidth={2.2} name="Net Profit" dot={{ fill: '#10B981', r: 3 }} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.68rem', color: '#818CF8', textTransform: 'uppercase', fontWeight: 800, marginBottom: 6 }}>
              Compounded Sales Growth (CAGR)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#CBD5E1', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span>10 Years:</span><strong>{cagr?.sales_growth?.['10y'] != null ? `${cagr.sales_growth['10y']}%` : '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#CBD5E1', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span>5 Years:</span><strong>{cagr?.sales_growth?.['5y'] != null ? `${cagr.sales_growth['5y']}%` : '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#CBD5E1', padding: '4px 0' }}>
              <span>3 Years:</span><strong style={{ color: '#10B981' }}>{cagr?.sales_growth?.['3y'] != null ? `${cagr.sales_growth['3y']}%` : '—'}</strong>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: '0.68rem', color: '#818CF8', textTransform: 'uppercase', fontWeight: 800, marginBottom: 6 }}>
              Compounded Profit Growth (CAGR)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#CBD5E1', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span>10 Years:</span><strong>{cagr?.profit_growth?.['10y'] != null ? `${cagr.profit_growth['10y']}%` : '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#CBD5E1', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span>5 Years:</span><strong>{cagr?.profit_growth?.['5y'] != null ? `${cagr.profit_growth['5y']}%` : '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#CBD5E1', padding: '4px 0' }}>
              <span>3 Years:</span><strong style={{ color: '#10B981' }}>{cagr?.profit_growth?.['3y'] != null ? `${cagr.profit_growth['3y']}%` : '—'}</strong>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '0.60rem', color: '#64748B', fontStyle: 'italic', paddingLeft: 2 }}>
          * Dynamic CAGR computed from audited statements. '—' denotes that continuous historical records are not available for that specific timeframe.
        </div>
      </div>
    </div>
  );

  const renderQuartersSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {quarterly.length > 0 ? (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.72rem', marginBottom: 10, fontWeight: 700, color: '#F0F0FF' }}>
              Last 8 Quarters Revenue & Net Profit (₹ Cr)
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={quarterly} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.72rem' }} formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')} Cr`]} />
                <Bar dataKey="revenue" fill="#6366F1" radius={[4, 4, 0, 0]} name="Revenue" />
                <Line type="monotone" dataKey="net_profit" stroke="#10B981" strokeWidth={2.2} name="Net Profit" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 10 }}>Comprehensive Quarterly Disclosures (₹ Cr)</div>
            <div className="table-scroll-container" style={{ maxHeight: '380px', borderRadius: 8 }}>
              <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0F172A' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.66rem', textTransform: 'uppercase', background: '#0F172A' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', background: '#0F172A' }}>Period</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>Sales</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>Expenses</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>Op. Profit</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>OPM %</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>Net Profit</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>EPS ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {quarterly.map((q, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1', background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                      <td style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#F0F0FF' }}>{q.period}</td>
                      <td style={{ padding: '8px 10px' }}>{q.revenue != null ? Number(q.revenue).toLocaleString('en-IN') : (q['Sales'] != null ? Number(q['Sales']).toLocaleString('en-IN') : '—')}</td>
                      <td style={{ padding: '8px 10px' }}>{q['Expenses'] != null ? Number(q['Expenses']).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{q['Operating Profit'] != null ? Number(q['Operating Profit']).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{q['OPM %'] != null ? `${q['OPM %']}%` : '—'}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#10B981' }}>{q.net_profit != null ? Number(q.net_profit).toLocaleString('en-IN') : (q['Net Profit'] != null ? Number(q['Net Profit']).toLocaleString('en-IN') : '—')}</td>
                      <td style={{ padding: '8px 10px' }}>{q.eps != null ? q.eps : (q['EPS in Rs'] || '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  );

  const renderAnnualSection = () => (
    <div style={cardStyle}>
      <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 10 }}>Annual 10-Year Consolidated P&L (₹ Cr)</div>
      {annualPl.length > 0 ? (
        <div className="table-scroll-container" style={{ maxHeight: '380px', borderRadius: 8 }}>
          <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0F172A' }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.66rem', textTransform: 'uppercase', background: '#0F172A' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', background: '#0F172A' }}>Year</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Sales</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Expenses</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Op. Profit</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>OPM %</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Net Profit</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>EPS ₹</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Payout %</th>
              </tr>
            </thead>
            <tbody>
              {annualPl.map((yr, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1', background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                  <td style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#F0F0FF' }}>{yr.period}</td>
                  <td style={{ padding: '8px 10px' }}>{yr['Sales'] != null ? Number(yr['Sales']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{yr['Expenses'] != null ? Number(yr['Expenses']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{yr['Operating Profit'] != null ? Number(yr['Operating Profit']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{yr['OPM %'] != null ? `${yr['OPM %']}%` : '—'}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: '#818CF8' }}>{yr['Net Profit'] != null ? Number(yr['Net Profit']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{yr['EPS in Rs'] != null ? yr['EPS in Rs'] : '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{yr['Dividend Payout %'] != null ? `${yr['Dividend Payout %']}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Layers}
          title="Annual Statements Not Available"
          message="No audited annual statement records found for this ticker."
          minHeight={140}
        />
      )}
    </div>
  );

  const renderBalanceSheetSection = () => (
    <div style={cardStyle}>
      <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 10 }}>Consolidated Balance Sheet & Capital Structure (₹ Cr)</div>
      {balanceSheet.length > 0 ? (
        <div className="table-scroll-container" style={{ maxHeight: '380px', borderRadius: 8 }}>
          <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0F172A' }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.66rem', textTransform: 'uppercase', background: '#0F172A' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', background: '#0F172A' }}>Year</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Equity</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Reserves</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Borrowings</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Other Liab</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Total Liab</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Fixed Assets</th>
                <th style={{ padding: '8px 10px', background: '#0F172A' }}>Total Assets</th>
              </tr>
            </thead>
            <tbody>
              {balanceSheet.map((bs, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1', background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                  <td style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#F0F0FF' }}>{bs.period}</td>
                  <td style={{ padding: '8px 10px' }}>{bs['Equity Capital'] != null ? Number(bs['Equity Capital']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{bs['Reserves'] != null ? Number(bs['Reserves']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#F59E0B' }}>{bs['Borrowings'] != null ? Number(bs['Borrowings']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{bs['Other Liabilities'] != null ? Number(bs['Other Liabilities']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{bs['Total Liabilities'] != null ? Number(bs['Total Liabilities']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{bs['Fixed Assets'] != null ? Number(bs['Fixed Assets']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: '#818CF8' }}>{bs['Total Assets'] != null ? Number(bs['Total Assets']).toLocaleString('en-IN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Scale}
          title="Balance Sheet Data Not Available"
          message="No audited balance sheet records found for this company."
          minHeight={140}
        />
      )}
    </div>
  );

  const renderCashFlowSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {cashFlow.length > 0 ? (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.72rem', marginBottom: 10, fontWeight: 700, color: '#F0F0FF' }}>
              Cash Flow Decomposition (CFO vs CFI vs CFF in ₹ Cr)
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cashFlow} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.72rem' }} />
                <Bar dataKey="Cash from Operating Activity" fill="#10B981" name="Operating (CFO)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cash from Investing Activity" fill="#F59E0B" name="Investing (CFI)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cash from Financing Activity" fill="#EF5350" name="Financing (CFF)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 10 }}>10-Year Cash Flow Statement (₹ Cr)</div>
            <div className="table-scroll-container" style={{ maxHeight: '380px', borderRadius: 8 }}>
              <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0F172A' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.66rem', textTransform: 'uppercase', background: '#0F172A' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', background: '#0F172A' }}>Period</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>Operating (CFO)</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>Investing (CFI)</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>Financing (CFF)</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>Net Cash Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlow.map((cf, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1' }}>
                      <td style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#F0F0FF' }}>{cf.period}</td>
                      <td style={{ padding: '8px 10px', color: (cf['Cash from Operating Activity'] || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                        {cf['Cash from Operating Activity'] != null ? Number(cf['Cash from Operating Activity']).toLocaleString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>{cf['Cash from Investing Activity'] != null ? Number(cf['Cash from Investing Activity']).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{cf['Cash from Financing Activity'] != null ? Number(cf['Cash from Financing Activity']).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#818CF8' }}>
                        {cf['Net Cash Flow'] != null ? Number(cf['Net Cash Flow']).toLocaleString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  );

  const renderShareholdingSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {shareholding.length > 0 ? (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.72rem', marginBottom: 10, fontWeight: 700, color: '#F0F0FF' }}>
              Institutional & Insider Ownership Trend (%)
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={shareholding} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="quarter" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.72rem' }} formatter={(v) => [`${v}%`]} />
                <Line type="monotone" dataKey="promoter" stroke="#10B981" strokeWidth={2.2} name="Promoters" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="fii" stroke="#818CF8" strokeWidth={2} name="FIIs" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="dii" stroke="#F59E0B" strokeWidth={2} name="DIIs" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="public" stroke="#64748B" strokeWidth={1.5} name="Public" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 10 }}>Quarterly Breakdown (%)</div>
              <div className="table-scroll-container" style={{ maxHeight: '200px', borderRadius: 8 }}>
                <table style={{ width: '100%', minWidth: 320, borderCollapse: 'collapse', fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0F172A' }}>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.66rem', textTransform: 'uppercase', background: '#0F172A' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', background: '#0F172A' }}>Quarter</th>
                      <th style={{ padding: '8px 10px', background: '#0F172A' }}>Promoter</th>
                      <th style={{ padding: '8px 10px', background: '#0F172A' }}>FII</th>
                      <th style={{ padding: '8px 10px', background: '#0F172A' }}>DII</th>
                      <th style={{ padding: '8px 10px', background: '#0F172A' }}>Public</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareholding.map((sh, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1' }}>
                        <td style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#F0F0FF' }}>{sh.quarter}</td>
                        <td style={{ padding: '8px 10px', color: '#10B981' }}>{sh.promoter != null ? `${sh.promoter}%` : '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#818CF8' }}>{sh.fii != null ? `${sh.fii}%` : '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#F59E0B' }}>{sh.dii != null ? `${sh.dii}%` : '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{sh.public != null ? `${sh.public}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Latest Ownership Distribution Pie Chart with NaN fallback */}
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.74rem', color: '#818CF8', fontWeight: 800, alignSelf: 'flex-start', marginBottom: 6 }}>Latest Ownership Distribution</div>
              <div style={{ width: '100%', height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Promoters', value: shareholding[shareholding.length - 1]?.promoter || 0, color: '#10B981' },
                        { name: 'FIIs', value: shareholding[shareholding.length - 1]?.fii || 0, color: '#818CF8' },
                        { name: 'DIIs', value: shareholding[shareholding.length - 1]?.dii || 0, color: '#F59E0B' },
                        { name: 'Public', value: shareholding[shareholding.length - 1]?.public || 0, color: '#64748B' },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
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
  );

  const renderPeersSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {peers.length > 0 ? (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.72rem', marginBottom: 10, fontWeight: 700, color: '#F0F0FF' }}>
              Sector Peer Valuation (P/E Ratio) vs Quality (ROCE %)
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={peers} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.72rem' }} />
                <Bar dataKey="pe_ratio" fill="#6366F1" name="P/E Ratio" radius={[4, 4, 0, 0]} />
                <Bar dataKey="roce" fill="#10B981" name="ROCE %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 10 }}>Sector Peer Ranking & Relative Valuation</div>
            <div className="table-scroll-container" style={{ maxHeight: '380px', borderRadius: 8 }}>
              <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0F172A' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.66rem', textTransform: 'uppercase', background: '#0F172A' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', background: '#0F172A' }}>Company</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>CMP ₹</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>P/E</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>Mar Cap ₹ Cr</th>
                    <th style={{ padding: '8px 10px', background: '#0F172A' }}>ROCE %</th>
                  </tr>
                </thead>
                <tbody>
                  {peers.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1' }}>
                      <td style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: p.name.includes(ticker) ? '#818CF8' : '#F0F0FF' }}>
                        {p.name}
                      </td>
                      <td style={{ padding: '8px 10px' }}>{p.price != null ? Number(p.price).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{p.pe_ratio != null ? p.pe_ratio : '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{p.market_cap != null ? Number(p.market_cap).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '8px 10px', color: (p.roce || 0) > 15 ? '#10B981' : '#CBD5E1' }}>
                        {p.roce != null ? `${p.roce}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  );

  const renderValuationSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <RatioCard label="DCF Fair Value" value={dcf.dcf_fair_value} unit=" ₹" colorFn={() => '#10B981'} sub="Multi-Stage FCF" />
        <RatioCard label="Graham Number" value={dcf.graham_number} unit=" ₹" colorFn={() => '#818CF8'} sub="EPS & BV Formula" />
        <RatioCard label="Peter Lynch Target" value={dcf.peter_lynch_value} unit=" ₹" colorFn={() => '#C084FC'} sub="Growth Multiple" />
        <RatioCard label="Margin of Safety" value={dcf.margin_of_safety_pct} unit="%" colorFn={(v) => v >= 0 ? '#10B981' : '#EF5350'} sub={dcf.valuation_verdict} />
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#818CF8', marginBottom: 4 }}>DCF Valuation Forecast & Assumptions</div>
        <p style={{ fontSize: '0.66rem', color: '#94A3B8', lineHeight: 1.4, margin: '0 0 10px' }}>
          Growth Rate: <strong style={{ color: '#F8FAFC' }}>{dcf.assumed_growth_rate_pct != null ? `${dcf.assumed_growth_rate_pct}%` : '—'}</strong> | Discount WACC: <strong style={{ color: '#F8FAFC' }}>{dcf.discount_rate_wacc_pct != null ? `${dcf.discount_rate_wacc_pct}%` : '—'}</strong> | Terminal Rate: <strong style={{ color: '#F8FAFC' }}>{dcf.terminal_growth_rate_pct != null ? `${dcf.terminal_growth_rate_pct}%` : '—'}</strong>.
        </p>
        {dcf.projected_fcf?.length > 0 ? (
          <div className="table-scroll-container" style={{ maxHeight: '280px', borderRadius: 8 }}>
            <table style={{ width: '100%', minWidth: 400, borderCollapse: 'collapse', fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0F172A' }}>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right', fontSize: '0.66rem', textTransform: 'uppercase', background: '#0F172A' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', background: '#0F172A' }}>Period</th>
                  <th style={{ padding: '8px 10px', background: '#0F172A' }}>Projected FCF / Share (₹)</th>
                  <th style={{ padding: '8px 10px', background: '#0F172A' }}>Present Value (PV)</th>
                </tr>
              </thead>
              <tbody>
                {dcf.projected_fcf.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#F0F0FF' }}>{p.year}</td>
                    <td style={{ padding: '8px 10px' }}>₹{p.fcf_per_share}</td>
                    <td style={{ padding: '8px 10px', color: '#10B981', fontWeight: 700 }}>₹{p.pv_fcf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  );

  return (
    <div style={{ padding: 'clamp(12px, 2vw, 20px)', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1320, margin: '0 auto', color: '#F8FAFC', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* ── Institutional Executive Cockpit Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        background: 'linear-gradient(180deg, rgba(17,24,39,0.98), rgba(15,23,42,0.92))',
        border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: '12px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8' }}>
            <Award size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.12rem', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                {deepData?.name || ticker}
              </span>
              <span style={{ fontSize: '0.66rem', background: 'rgba(99,102,241,0.20)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.4)', padding: '2px 7px', borderRadius: 5, fontWeight: 800 }}>
                NSE: {ticker}
              </span>
              {deepData?.sector && (
                <span style={{ fontSize: '0.66rem', background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: 5, fontWeight: 600 }}>
                  {deepData.sector}
                </span>
              )}
              <span style={{ fontSize: '0.66rem', background: piotroski.score >= 7 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: piotroski.score >= 7 ? '#10B981' : '#F59E0B', border: `1px solid ${piotroski.score >= 7 ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`, padding: '2px 7px', borderRadius: 5, fontWeight: 800 }}>
                Piotroski: {piotroski.score}/9
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: '0.66rem', color: '#64748B' }}>
              <span>Source: <strong style={{ color: '#94A3B8' }}>{deepData?.data_freshness?.data_source || data?.data_source || 'Screener.in Consolidated + NSE'}</strong></span>
              <span>•</span>
              <span>Updated: <strong style={{ color: '#94A3B8' }}>{deepData?.data_freshness?.last_updated || 'Live'}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Controls & View Mode Toggle */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Segmented View Mode Toggle: 'tabs' vs 'all_panels' */}
          <div style={{
            display: 'flex', background: 'rgba(0,0,0,0.45)', borderRadius: 8, padding: 3,
            border: '1px solid rgba(255,255,255,0.10)'
          }}>
            <button
              type="button"
              onClick={() => setViewMode('tabs')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6,
                border: 'none',
                background: viewMode === 'tabs' ? 'linear-gradient(135deg, rgba(99,102,241,0.45), rgba(139,92,246,0.35))' : 'transparent',
                color: viewMode === 'tabs' ? '#FFFFFF' : '#94A3B8',
                fontWeight: viewMode === 'tabs' ? 800 : 500, fontSize: '0.72rem', cursor: 'pointer',
                boxShadow: viewMode === 'tabs' ? '0 1px 6px rgba(99,102,241,0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <LayoutGrid size={13} color={viewMode === 'tabs' ? '#818CF8' : '#64748B'} />
              <span>Tabs</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all_panels')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6,
                border: 'none',
                background: viewMode === 'all_panels' ? 'linear-gradient(135deg, rgba(99,102,241,0.45), rgba(139,92,246,0.35))' : 'transparent',
                color: viewMode === 'all_panels' ? '#FFFFFF' : '#94A3B8',
                fontWeight: viewMode === 'all_panels' ? 800 : 500, fontSize: '0.72rem', cursor: 'pointer',
                boxShadow: viewMode === 'all_panels' ? '0 1px 6px rgba(99,102,241,0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <FileText size={13} color={viewMode === 'all_panels' ? '#818CF8' : '#64748B'} />
              <span>All Panels</span>
            </button>
          </div>

          <button onClick={handleExportCSV} style={{ padding: '6px 11px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.70rem', fontWeight: 600 }}>
            <Download size={13} />CSV
          </button>

          <button onClick={handlePrint} style={{ padding: '6px 11px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.70rem', fontWeight: 600 }}>
            <Printer size={13} />Print
          </button>

          <button
            type="button"
            disabled
            title="Fundamental Alerts coming soon in Phase 6"
            style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', color: '#64748B', border: '1px solid rgba(255,255,255,0.06)', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.70rem', fontWeight: 600, opacity: 0.6 }}
          >
            <Bell size={12} />Alert (Soon)
          </button>

          <button onClick={fetchData} style={{ padding: '6px 13px', borderRadius: 6, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 800, boxShadow: '0 2px 8px rgba(99,102,241,0.4)' }}>
            <RefreshCw size={13} />Refresh
          </button>
        </div>
      </div>

      {/* ── Sub Navigation Menu (ONLY rendered when viewMode === 'tabs') ── */}
      {viewMode === 'tabs' && (
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', padding: '4px 2px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                  border: isSel ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
                  background: isSel
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.25))'
                    : 'rgba(15,23,42,0.65)',
                  color: isSel ? '#FFFFFF' : '#94A3B8',
                  fontWeight: isSel ? 800 : 500, fontSize: '0.76rem', cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: isSel ? '0 2px 12px rgba(99,102,241,0.30)' : 'none',
                  transition: 'all 0.15s ease-in-out'
                }}
              >
                <Icon size={14} color={isSel ? '#818CF8' : '#64748B'} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    fontSize: '0.60rem',
                    background: isSel ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.06)',
                    color: isSel ? '#E0E7FF' : '#64748B',
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontWeight: 800
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── MODE 1: TABS (Strictly isolated single active component) ── */}
      {viewMode === 'tabs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeTab === 'overview' && renderOverviewSection()}
          {activeTab === 'quarters' && renderQuartersSection()}
          {activeTab === 'annual' && renderAnnualSection()}
          {activeTab === 'balancesheet' && renderBalanceSheetSection()}
          {activeTab === 'cashflow' && renderCashFlowSection()}
          {activeTab === 'shareholding' && renderShareholdingSection()}
          {activeTab === 'peers' && renderPeersSection()}
          {activeTab === 'valuation' && renderValuationSection()}
        </div>
      )}

      {/* ── MODE 2: ALL PANELS (Sub-tab menu hidden, all data widgets rendered in continuous layout) ── */}
      {viewMode === 'all_panels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#818CF8', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Award size={16} /> 1. Executive Summary & Composite Scorecard
            </div>
            {renderOverviewSection()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#818CF8', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Table size={16} /> 2. Quarterly Earnings & Disclosures
            </div>
            {renderQuartersSection()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#818CF8', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Layers size={16} /> 3. Annual 10-Year Profit & Loss Statement
            </div>
            {renderAnnualSection()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#818CF8', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Scale size={16} /> 4. Consolidated Balance Sheet & Capital Structure
            </div>
            {renderBalanceSheetSection()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#818CF8', display: 'flex', alignItems: 'center', gap: 7 }}>
              <TrendingUp size={16} /> 5. Cash Flow Decomposition & Quality
            </div>
            {renderCashFlowSection()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#818CF8', display: 'flex', alignItems: 'center', gap: 7 }}>
              <PieIcon size={16} /> 6. Institutional & Insider Ownership
            </div>
            {renderShareholdingSection()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#818CF8', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Users size={16} /> 7. Industry Peer Comparison & Relative Ranking
            </div>
            {renderPeersSection()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#818CF8', display: 'flex', alignItems: 'center', gap: 7 }}>
              <DollarSign size={16} /> 8. DCF Multi-Stage Intrinsic Valuation
            </div>
            {renderValuationSection()}
          </div>
        </div>
      )}

      {/* ── QUALITY MODAL: FULL PIOTROSKI F-SCORE CHECKLIST ── */}
      {showQualityModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.80)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 14, padding: 20, maxWidth: 540, width: '100%', maxHeight: '82vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} color="#10B981" />
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800 }}>Piotroski 9-Point Quality Audit</h3>
              </div>
              <button onClick={() => setShowQualityModal(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: 12 }}>
              Score: <strong style={{ color: piotroski.score >= 7 ? '#10B981' : '#F59E0B' }}>{piotroski.score}/9 ({piotroski.rating})</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {piotroski.criteria?.length > 0 ? (
                piotroski.criteria.map((c, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.passed ? 'rgba(16,185,129,0.22)' : 'rgba(239,83,80,0.22)'}`, borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <strong style={{ fontSize: '0.76rem', color: '#F8FAFC' }}>{idx + 1}. {c.name}</strong>
                      <span style={{ fontSize: '0.66rem', fontWeight: 800, color: c.passed ? '#10B981' : '#EF5350' }}>{c.passed ? '✓ PASS (+1)' : '✗ FAIL (0)'}</span>
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#94A3B8' }}>{c.detail}</div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '18px', textAlign: 'center', color: '#94A3B8', fontSize: '0.76rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                  No detailed 9-point criteria breakdown available for this security.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}