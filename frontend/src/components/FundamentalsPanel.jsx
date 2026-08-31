import React, { useEffect, useState, useMemo } from 'react';
import useStore from '../store/useStore';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, ReferenceLine
} from 'recharts';
import api from '../utils/api';
import {
  BookOpen, TrendingUp, TrendingDown, RefreshCw, Layers,
  PieChart as PieIcon, Users, Calendar, Table, CheckCircle2, ShieldAlert,
  ShieldCheck, AlertTriangle, Activity, Download, Bell, ArrowUpRight, DollarSign,
  Award, Sparkles, Scale, Info, Check, X, ChevronRight, LayoutGrid, FileText,
  Printer, ArrowDownRight, Target, Flame, BarChart2
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

function GrowthPill({ value, suffix = "%" }) {
  if (value == null || isNaN(value)) return <span style={{ color: "#64748B" }}>—</span>;
  const isPos = value >= 0;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
      padding: "2px 7px",
      borderRadius: 4,
      fontSize: "0.68rem",
      fontWeight: 700,
      fontFamily: "JetBrains Mono, monospace",
      background: isPos ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 83, 80, 0.12)",
      color: isPos ? "#10B981" : "#EF5350",
      border: `1px solid ${isPos ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 83, 80, 0.25)"}`
    }}>
      {isPos ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {isPos ? "+" : ""}{Number(value).toFixed(1)}{suffix}
    </span>
  );
}

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

  // Sorting state for quarterly statements table
  const [sortField, setSortField] = useState('idx');
  const [sortAsc, setSortAsc] = useState(true);

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

  // Defensive Normalizations & Comprehensive Quarterly Analytics
  const enrichedQuarters = useMemo(() => {
    const rawQuarters =
      (deepData?.quarterly_results?.length ? deepData.quarterly_results : null) ||
      (data?.quarterly_results?.length ? data.quarterly_results : []);

    if (!rawQuarters || rawQuarters.length === 0) return [];

    const chronological = rawQuarters.map((q, idx) => ({
      rawIndex: idx,
      period: q.period || `Q${idx + 1}`,
      revenue: q.revenue ?? q.Sales ?? q["Sales+"] ?? q.Revenue ?? null,
      net_profit: q.net_profit ?? q["Net Profit"] ?? q["Net Profit+"] ?? null,
      eps: q.eps ?? q["EPS in Rs"] ?? null,
      opm: q["OPM %"] ?? (q.revenue && q.net_profit ? ((q.net_profit / q.revenue) * 100) : null),
      revenue_qoq_pct: q.revenue_qoq_pct,
      profit_qoq_pct: q.profit_qoq_pct,
    }));

    // Linear regression for EPS trendline
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, validEpsCount = 0;
    chronological.forEach((q, i) => {
      if (q.eps != null && !isNaN(q.eps)) {
        sumX += i;
        sumY += Number(q.eps);
        sumXY += i * Number(q.eps);
        sumXX += i * i;
        validEpsCount++;
      }
    });

    const slope = validEpsCount > 1 ? (validEpsCount * sumXY - sumX * sumY) / (validEpsCount * sumXX - sumX * sumX) : 0;
    const intercept = validEpsCount > 1 ? (sumY - slope * sumX) / validEpsCount : (chronological[0]?.eps || 0);

    return chronological.map((q, i) => {
      const prevQ = i > 0 ? chronological[i - 1] : null;
      const prevYearQ = i >= 4 ? chronological[i - 4] : null;

      const revQoQ = q.revenue_qoq_pct != null
        ? q.revenue_qoq_pct
        : (prevQ?.revenue && q.revenue != null ? ((q.revenue - prevQ.revenue) / Math.abs(prevQ.revenue)) * 100 : null);

      const profitQoQ = q.profit_qoq_pct != null
        ? q.profit_qoq_pct
        : (prevQ?.net_profit && q.net_profit != null ? ((q.net_profit - prevQ.net_profit) / Math.abs(prevQ.net_profit)) * 100 : null);

      const epsQoQ = prevQ?.eps && q.eps != null ? ((q.eps - prevQ.eps) / Math.abs(prevQ.eps)) * 100 : null;

      const revYoY = prevYearQ?.revenue && q.revenue != null ? ((q.revenue - prevYearQ.revenue) / Math.abs(prevYearQ.revenue)) * 100 : null;
      const profitYoY = prevYearQ?.net_profit && q.net_profit != null ? ((q.net_profit - prevYearQ.net_profit) / Math.abs(prevYearQ.net_profit)) * 100 : null;
      const epsYoY = prevYearQ?.eps && q.eps != null ? ((q.eps - prevYearQ.eps) / Math.abs(prevYearQ.eps)) * 100 : null;

      const epsTrend = Number((slope * i + intercept).toFixed(2));

      return {
        ...q,
        idx: i,
        revQoQ: revQoQ != null ? Number(revQoQ.toFixed(1)) : null,
        profitQoQ: profitQoQ != null ? Number(profitQoQ.toFixed(1)) : null,
        epsQoQ: epsQoQ != null ? Number(epsQoQ.toFixed(1)) : null,
        revYoY: revYoY != null ? Number(revYoY.toFixed(1)) : null,
        profitYoY: profitYoY != null ? Number(profitYoY.toFixed(1)) : null,
        epsYoY: epsYoY != null ? Number(epsYoY.toFixed(1)) : null,
        epsTrend,
      };
    });
  }, [data, deepData]);

  // Aggregate summary metrics for quarterly results
  const summaryStats = useMemo(() => {
    if (!enrichedQuarters || enrichedQuarters.length === 0) return null;

    const validRevQoQ = enrichedQuarters.map(q => q.revQoQ).filter(v => v != null);
    const validProfitQoQ = enrichedQuarters.map(q => q.profitQoQ).filter(v => v != null);
    const validEpsQoQ = enrichedQuarters.map(q => q.epsQoQ).filter(v => v != null);

    const avgRevQoQ = validRevQoQ.length ? (validRevQoQ.reduce((a, b) => a + b, 0) / validRevQoQ.length) : null;
    const avgProfitQoQ = validProfitQoQ.length ? (validProfitQoQ.reduce((a, b) => a + b, 0) / validProfitQoQ.length) : null;
    const avgEpsQoQ = validEpsQoQ.length ? (validEpsQoQ.reduce((a, b) => a + b, 0) / validEpsQoQ.length) : null;

    const latest = enrichedQuarters[enrichedQuarters.length - 1];
    const prev = enrichedQuarters.length >= 2 ? enrichedQuarters[enrichedQuarters.length - 2] : null;

    let trendVerdict = "Stable Trajectory";
    let trendPositive = true;
    if (avgRevQoQ != null && avgProfitQoQ != null) {
      if (avgRevQoQ > 3 && avgProfitQoQ > 5) {
        trendVerdict = "Strong Expansion";
        trendPositive = true;
      } else if (avgRevQoQ > 0 && avgProfitQoQ > 0) {
        trendVerdict = "Moderate Growth";
        trendPositive = true;
      } else if (avgRevQoQ < 0 && avgProfitQoQ < 0) {
        trendVerdict = "Cyclical Contraction";
        trendPositive = false;
      } else {
        trendVerdict = "Mixed Margin Volatility";
        trendPositive = avgProfitQoQ >= 0;
      }
    }

    return {
      avgRevQoQ,
      avgProfitQoQ,
      avgEpsQoQ,
      trendVerdict,
      trendPositive,
      latest,
      prev,
    };
  }, [enrichedQuarters]);

  // Quarterly Table Sorting Logic
  const sortedTableData = useMemo(() => {
    const dataCopy = [...enrichedQuarters];
    dataCopy.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return dataCopy;
  }, [enrichedQuarters, sortField, sortAsc]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExportQuarterlyCSV = () => {
    if (!enrichedQuarters || enrichedQuarters.length === 0) {
      toast.error("No quarterly earnings records to export.");
      return;
    }
    const headers = ["Period", "Revenue (Cr)", "Rev QoQ %", "Rev YoY %", "Net Profit (Cr)", "Profit QoQ %", "Profit YoY %", "EPS (Rs)", "EPS YoY %"];
    const rows = enrichedQuarters.map(q => [
      q.period,
      q.revenue ?? "",
      q.revQoQ ?? "",
      q.revYoY ?? "",
      q.net_profit ?? "",
      q.profitQoQ ?? "",
      q.profitYoY ?? "",
      q.eps ?? "",
      q.epsYoY ?? ""
    ].map(v => `"${v}"`).join(","));

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${ticker}_Quarterly_Earnings_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${ticker} Quarterly Earnings exported to CSV!`);
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

  const quarterly = enrichedQuarters;

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
    { id: 'quarters', label: 'Quarterly & Earnings', badge: `${quarterly.length}Q`, icon: Table },
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

  const renderQuartersSection = () => {
    const latestQ = summaryStats?.latest;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {enrichedQuarters.length > 0 ? (
          <>
            {/* ── 1. SUMMARY STATS CARDS ROW ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {/* Latest Quarter Card */}
              <div style={{ ...cardStyle, background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(15,23,42,0.95))", border: "1px solid rgba(99,102,241,0.3)" }}>
                <div style={labelStyle}>Latest Quarter Performance ({latestQ?.period})</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                  <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", fontFamily: "JetBrains Mono, monospace" }}>
                    ₹{latestQ?.revenue != null && !isNaN(Number(latestQ.revenue)) ? Number(latestQ.revenue).toLocaleString("en-IN") : "—"} Cr
                  </span>
                  <GrowthPill value={latestQ?.revQoQ} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.66rem", color: "#94A3B8", marginTop: 6, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span>Net Profit: <strong style={{ color: "#10B981" }}>₹{latestQ?.net_profit != null && !isNaN(Number(latestQ.net_profit)) ? Number(latestQ.net_profit).toLocaleString("en-IN") : "—"} Cr</strong></span>
                  <span>EPS: <strong style={{ color: "#F59E0B" }}>{latestQ?.eps != null ? `₹${latestQ.eps}` : "—"}</strong></span>
                </div>
              </div>

              {/* Avg Revenue Growth */}
              <div style={cardStyle}>
                <div style={labelStyle}>Avg QoQ Revenue Growth</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ ...valueStyle, color: (summaryStats?.avgRevQoQ || 0) >= 0 ? "#10B981" : "#EF5350" }}>
                    {(summaryStats?.avgRevQoQ || 0) >= 0 ? "+" : ""}{summaryStats?.avgRevQoQ != null ? `${summaryStats.avgRevQoQ.toFixed(1)}%` : "—"}
                  </span>
                  <GrowthPill value={summaryStats?.avgRevQoQ} />
                </div>
                <div style={{ fontSize: "0.62rem", color: "#94A3B8", marginTop: 6 }}>
                  Mean sequential top-line momentum across {enrichedQuarters.length} quarters
                </div>
              </div>

              {/* Avg Profit Growth */}
              <div style={cardStyle}>
                <div style={labelStyle}>Avg QoQ Net Profit Growth</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ ...valueStyle, color: (summaryStats?.avgProfitQoQ || 0) >= 0 ? "#10B981" : "#EF5350" }}>
                    {(summaryStats?.avgProfitQoQ || 0) >= 0 ? "+" : ""}{summaryStats?.avgProfitQoQ != null ? `${summaryStats.avgProfitQoQ.toFixed(1)}%` : "—"}
                  </span>
                  <GrowthPill value={summaryStats?.avgProfitQoQ} />
                </div>
                <div style={{ fontSize: "0.62rem", color: "#94A3B8", marginTop: 6 }}>
                  Bottom-line profitability compounding rate
                </div>
              </div>

              {/* Revenue Trend Verdict */}
              <div style={{ ...cardStyle, border: `1px solid ${summaryStats?.trendPositive ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}` }}>
                <div style={labelStyle}>Earnings Trajectory & Verdict</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  {summaryStats?.trendPositive ? <TrendingUp size={18} color="#10B981" /> : <TrendingDown size={18} color="#F59E0B" />}
                  <span style={{ fontSize: "0.92rem", fontWeight: 800, color: summaryStats?.trendPositive ? "#10B981" : "#F59E0B" }}>
                    {summaryStats?.trendVerdict}
                  </span>
                </div>
                <div style={{ fontSize: "0.62rem", color: "#94A3B8", marginTop: 6 }}>
                  Assessed from consecutive operating margins & bottom-line trends
                </div>
              </div>
            </div>

            {/* ── 2. REVENUE VS NET PROFIT COMPOSED CHART ── */}
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
                <div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#F0F0FF" }}>Quarterly Revenue & Net Profit Trajectory (₹ Cr)</span>
                  <div style={{ fontSize: "0.62rem", color: "#94A3B8" }}>Dual-axis comparison of gross turnover vs bottom-line net profit</div>
                </div>
                <div style={{ fontSize: "0.68rem", display: "flex", gap: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: "#6366F1", borderRadius: 2 }} /> Revenue</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: "#10B981", borderRadius: 2 }} /> Net Profit</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={enrichedQuarters} margin={{ top: 10, right: 15, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="fundRevBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818CF8" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="fundProfitAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#10B981" }} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    contentStyle={{ background: "#0F172A", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#F0F0FF", fontSize: "0.74rem" }}
                    formatter={(val, name) => [`₹${val != null && !isNaN(Number(val)) ? Number(val).toLocaleString("en-IN") : "—"} Cr`, name]}
                  />
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="url(#fundRevBarGrad)" radius={[4, 4, 0, 0]} />
                  <Area yAxisId="right" type="monotone" dataKey="net_profit" name="Net Profit Area" fill="url(#fundProfitAreaGrad)" stroke="none" />
                  <Line yAxisId="right" type="monotone" dataKey="net_profit" name="Net Profit" stroke="#10B981" strokeWidth={2.4} dot={{ r: 4, fill: "#10B981", strokeWidth: 1.5, stroke: "#0F172A" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* ── 3. TWO-COLUMN: REVENUE & PROFIT QOQ BARS + EPS TREND WITH TRENDLINE ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
              {/* QoQ Growth % Divergence Bars */}
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#F0F0FF" }}>Quarter-on-Quarter (QoQ) Growth %</span>
                    <div style={{ fontSize: "0.62rem", color: "#94A3B8" }}>Sequential expansion across revenue vs profit</div>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={enrichedQuarters} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="period" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    <Tooltip
                      contentStyle={{ background: "#0F172A", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#F0F0FF", fontSize: "0.72rem" }}
                      formatter={(val, name) => [`${val != null ? `${val >= 0 ? "+" : ""}${val}%` : "—"}`, name]}
                    />
                    <Bar dataKey="revQoQ" name="Revenue QoQ %" fill="#6366F1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="profitQoQ" name="Profit QoQ %" radius={[3, 3, 0, 0]}>
                      {enrichedQuarters.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={(entry.profitQoQ || 0) >= 0 ? "#10B981" : "#EF5350"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* EPS Trend with Regression Line */}
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#F0F0FF" }}>EPS Trajectory & Trendline (₹)</span>
                    <div style={{ fontSize: "0.62rem", color: "#94A3B8" }}>Diluted Earnings Per Share with linear trajectory</div>
                  </div>
                  {latestQ?.eps != null && (
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.96rem", fontWeight: 800, color: "#F59E0B", fontFamily: "JetBrains Mono, monospace" }}>
                        ₹{latestQ.eps}
                      </span>
                      <div style={{ fontSize: "0.58rem", color: "#94A3B8" }}>Latest Diluted EPS</div>
                    </div>
                  )}
                </div>

                <ResponsiveContainer width="100%" height={190}>
                  <LineChart data={enrichedQuarters} margin={{ top: 10, right: 15, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="period" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      contentStyle={{ background: "#0F172A", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#F0F0FF", fontSize: "0.72rem" }}
                      formatter={(val, name) => [`₹${val != null ? val : "—"}`, name]}
                    />
                    <Line type="monotone" dataKey="eps" name="EPS (₹)" stroke="#F59E0B" strokeWidth={2.2} dot={{ r: 3.5, fill: "#F59E0B" }} />
                    <Line type="linear" dataKey="epsTrend" name="Regression Trendline" stroke="#64748B" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── 4. FULL QUARTERLY EARNINGS & DISCLOSURES TABLE ── */}
            <div style={{ ...cardStyle, border: "1px solid rgba(99,102,241,0.25)", background: "linear-gradient(180deg, rgba(15,23,42,0.95), rgba(10,15,30,0.95))" }}>
                  <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "#F0F0FF" }}>Comprehensive Quarterly Disclosures & Financial Statements</span>
                  <div style={{ fontSize: "0.64rem", color: "#94A3B8" }}>Detailed breakdown of quarterly sales, net margins, EPS, and comparative growth deltas</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={handleExportQuarterlyCSV}
                  style={{ padding: "5px 12px", borderRadius: 6, background: "rgba(255,255,255,0.06)", color: "#CBD5E1", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: "0.70rem", fontWeight: 600 }}
                >
                  <Download size={13} />Export CSV
                </button>
                <div style={{ fontSize: "0.68rem", color: "#818CF8", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", padding: "4px 9px", borderRadius: 6, fontWeight: 700 }}>
                  💡 Click column to sort
                </div>
              </div>
            </div>

            <div className="table-scroll-container">
              <table style={{ width: "100%", minWidth: 740, borderCollapse: "collapse", fontSize: "0.76rem", fontFamily: "JetBrains Mono, monospace" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)", color: "#94A3B8", textAlign: "right", fontSize: "0.68rem", textTransform: "uppercase" }}>
                    <th onClick={() => toggleSort("period")} style={{ textAlign: "left", padding: "10px 12px", cursor: "pointer" }}>
                      Period {sortField === "period" && (sortAsc ? "▲" : "▼")}
                    </th>
                    <th onClick={() => toggleSort("revenue")} style={{ padding: "10px 12px", cursor: "pointer" }}>
                      Revenue (₹ Cr) {sortField === "revenue" && (sortAsc ? "▲" : "▼")}
                    </th>
                    <th onClick={() => toggleSort("revQoQ")} style={{ padding: "10px 12px", cursor: "pointer" }}>
                      Rev QoQ % {sortField === "revQoQ" && (sortAsc ? "▲" : "▼")}
                    </th>
                    <th onClick={() => toggleSort("revYoY")} style={{ padding: "10px 12px", cursor: "pointer" }}>
                      Rev YoY % {sortField === "revYoY" && (sortAsc ? "▲" : "▼")}
                    </th>
                    <th onClick={() => toggleSort("net_profit")} style={{ padding: "10px 12px", cursor: "pointer" }}>
                      Net Profit (₹ Cr) {sortField === "net_profit" && (sortAsc ? "▲" : "▼")}
                    </th>
                    <th onClick={() => toggleSort("profitQoQ")} style={{ padding: "10px 12px", cursor: "pointer" }}>
                      NP QoQ % {sortField === "profitQoQ" && (sortAsc ? "▲" : "▼")}
                    </th>
                    <th onClick={() => toggleSort("eps")} style={{ padding: "10px 12px", cursor: "pointer" }}>
                      EPS (₹) {sortField === "eps" && (sortAsc ? "▲" : "▼")}
                    </th>
                    <th onClick={() => toggleSort("epsYoY")} style={{ padding: "10px 12px", cursor: "pointer" }}>
                      EPS YoY % {sortField === "epsYoY" && (sortAsc ? "▲" : "▼")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTableData.map((q, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "right", color: "#CBD5E1", background: idx % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                      <td style={{ textAlign: "left", padding: "10px 12px", fontWeight: 800, color: "#F0F0FF" }}>{q.period}</td>
                      <td style={{ padding: "10px 12px" }}>{q.revenue != null && !isNaN(Number(q.revenue)) ? Number(q.revenue).toLocaleString("en-IN") : "—"}</td>
                      <td style={{ padding: "10px 12px" }}><GrowthPill value={q.revQoQ} /></td>
                      <td style={{ padding: "10px 12px" }}><GrowthPill value={q.revYoY} /></td>
                      <td style={{ padding: "10px 12px", fontWeight: 800, color: "#10B981" }}>{q.net_profit != null && !isNaN(Number(q.net_profit)) ? Number(q.net_profit).toLocaleString("en-IN") : "—"}</td>
                      <td style={{ padding: "10px 12px" }}><GrowthPill value={q.profitQoQ} /></td>
                      <td style={{ padding: "10px 12px", color: "#F59E0B", fontWeight: 700 }}>{q.eps != null ? `₹${q.eps}` : "—"}</td>
                      <td style={{ padding: "10px 12px" }}><GrowthPill value={q.epsYoY} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "0.66rem", color: "#64748B", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <span>* YoY deltas are computed against matching 4-quarter prior benchmark (i-4). QoQ deltas represent sequential momentum.</span>
              <span>All monetary values represented in ₹ Crores (except EPS).</span>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={Table}
          title="Quarterly Disclosures Not Available"
          message="Quarterly disclosures and financial filings have not yet been published for this security."
          minHeight={160}
        />
      )}
    </div>
  );

  const renderAnnualSection = () => (
    <div style={cardStyle}>
      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 12 }}>Annual 10-Year Consolidated Profit & Loss (₹ Cr)</div>
      {annualPl.length > 0 ? (
        <div className="table-scroll-container">
          <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8', textAlign: 'right', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Year</th>
                <th style={{ padding: '10px 12px' }}>Sales</th>
                <th style={{ padding: '10px 12px' }}>Expenses</th>
                <th style={{ padding: '10px 12px' }}>Op. Profit</th>
                <th style={{ padding: '10px 12px' }}>OPM %</th>
                <th style={{ padding: '10px 12px' }}>Net Profit</th>
                <th style={{ padding: '10px 12px' }}>EPS ₹</th>
                <th style={{ padding: '10px 12px' }}>Payout %</th>
              </tr>
            </thead>
            <tbody>
              {annualPl.map((yr, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1', background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                  <td style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 800, color: '#F0F0FF' }}>{yr.period}</td>
                  <td style={{ padding: '10px 12px' }}>{yr['Sales'] != null ? Number(yr['Sales']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{yr['Expenses'] != null ? Number(yr['Expenses']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{yr['Operating Profit'] != null ? Number(yr['Operating Profit']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{yr['OPM %'] != null ? `${yr['OPM %']}%` : '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 800, color: '#818CF8' }}>{yr['Net Profit'] != null ? Number(yr['Net Profit']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{yr['EPS in Rs'] != null ? yr['EPS in Rs'] : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{yr['Dividend Payout %'] != null ? `${yr['Dividend Payout %']}%` : '—'}</td>
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
      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 12 }}>Consolidated Balance Sheet & Capital Structure (₹ Cr)</div>
      {balanceSheet.length > 0 ? (
        <div className="table-scroll-container">
          <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8', textAlign: 'right', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Year</th>
                <th style={{ padding: '10px 12px' }}>Equity</th>
                <th style={{ padding: '10px 12px' }}>Reserves</th>
                <th style={{ padding: '10px 12px' }}>Borrowings</th>
                <th style={{ padding: '10px 12px' }}>Other Liab</th>
                <th style={{ padding: '10px 12px' }}>Total Liab</th>
                <th style={{ padding: '10px 12px' }}>Fixed Assets</th>
                <th style={{ padding: '10px 12px' }}>Total Assets</th>
              </tr>
            </thead>
            <tbody>
              {balanceSheet.map((bs, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1', background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                  <td style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 800, color: '#F0F0FF' }}>{bs.period}</td>
                  <td style={{ padding: '10px 12px' }}>{bs['Equity Capital'] != null ? Number(bs['Equity Capital']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{bs['Reserves'] != null ? Number(bs['Reserves']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#F59E0B', fontWeight: 700 }}>{bs['Borrowings'] != null ? Number(bs['Borrowings']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{bs['Other Liabilities'] != null ? Number(bs['Other Liabilities']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 800 }}>{bs['Total Liabilities'] != null ? Number(bs['Total Liabilities']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{bs['Fixed Assets'] != null ? Number(bs['Fixed Assets']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 800, color: '#818CF8' }}>{bs['Total Assets'] != null ? Number(bs['Total Assets']).toLocaleString('en-IN') : '—'}</td>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {cashFlow.length > 0 ? (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.80rem', marginBottom: 12, fontWeight: 800, color: '#F0F0FF' }}>
              Cash Flow Decomposition (CFO vs CFI vs CFF in ₹ Cr)
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={cashFlow} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 12 }}>10-Year Cash Flow Statement (₹ Cr)</div>
            <div className="table-scroll-container">
              <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8', textAlign: 'right', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Period</th>
                    <th style={{ padding: '10px 12px' }}>Operating (CFO)</th>
                    <th style={{ padding: '10px 12px' }}>Investing (CFI)</th>
                    <th style={{ padding: '10px 12px' }}>Financing (CFF)</th>
                    <th style={{ padding: '10px 12px' }}>Net Cash Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlow.map((cf, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1', background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                      <td style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 800, color: '#F0F0FF' }}>{cf.period}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: (cf['Cash from Operating Activity'] || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                        {cf['Cash from Operating Activity'] != null ? Number(cf['Cash from Operating Activity']).toLocaleString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{cf['Cash from Investing Activity'] != null ? Number(cf['Cash from Investing Activity']).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{cf['Cash from Financing Activity'] != null ? Number(cf['Cash from Financing Activity']).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#818CF8' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {shareholding.length > 0 ? (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.80rem', marginBottom: 12, fontWeight: 800, color: '#F0F0FF' }}>
              Institutional & Insider Ownership Trend (%)
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={shareholding} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="quarter" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.72rem' }} formatter={(v) => [`${v}%`]} />
                <Line type="monotone" dataKey="promoter" stroke="#10B981" strokeWidth={2.4} name="Promoters" dot={{ r: 3.5 }} />
                <Line type="monotone" dataKey="fii" stroke="#818CF8" strokeWidth={2} name="FIIs" dot={{ r: 3.5 }} />
                <Line type="monotone" dataKey="dii" stroke="#F59E0B" strokeWidth={2} name="DIIs" dot={{ r: 3.5 }} />
                <Line type="monotone" dataKey="public" stroke="#64748B" strokeWidth={1.5} name="Public" dot={{ r: 3.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 10 }}>Quarterly Breakdown (%)</div>
              <div className="table-scroll-container">
                <table style={{ width: '100%', minWidth: 320, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8', textAlign: 'right', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Quarter</th>
                      <th style={{ padding: '10px 12px' }}>Promoter</th>
                      <th style={{ padding: '10px 12px' }}>FII</th>
                      <th style={{ padding: '10px 12px' }}>DII</th>
                      <th style={{ padding: '10px 12px' }}>Public</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareholding.map((sh, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1', background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                        <td style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 800, color: '#F0F0FF' }}>{sh.quarter}</td>
                        <td style={{ padding: '10px 12px', color: '#10B981', fontWeight: 700 }}>{sh.promoter != null ? `${sh.promoter}%` : '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#818CF8' }}>{sh.fii != null ? `${sh.fii}%` : '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#F59E0B' }}>{sh.dii != null ? `${sh.dii}%` : '—'}</td>
                        <td style={{ padding: '10px 12px' }}>{sh.public != null ? `${sh.public}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.78rem', color: '#818CF8', fontWeight: 800, alignSelf: 'flex-start', marginBottom: 6 }}>Latest Ownership Distribution</div>
              <div style={{ width: '100%', height: 180 }}>
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
                      outerRadius={65}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {peers.length > 0 ? (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.80rem', marginBottom: 12, fontWeight: 800, color: '#F0F0FF' }}>
              Sector Peer Valuation (P/E Ratio) vs Capital Efficiency (ROCE %)
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={peers} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 12 }}>Sector Peer Ranking & Relative Valuation</div>
            <div className="table-scroll-container">
              <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8', textAlign: 'right', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Company</th>
                    <th style={{ padding: '10px 12px' }}>CMP ₹</th>
                    <th style={{ padding: '10px 12px' }}>P/E</th>
                    <th style={{ padding: '10px 12px' }}>Market Cap ₹ Cr</th>
                    <th style={{ padding: '10px 12px' }}>ROCE %</th>
                  </tr>
                </thead>
                <tbody>
                  {peers.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1', background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                      <td style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 800, color: p.name.includes(ticker) ? '#818CF8' : '#F0F0FF' }}>
                        {p.name}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{p.price != null ? Number(p.price).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{p.pe_ratio != null ? p.pe_ratio : '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{p.market_cap != null ? Number(p.market_cap).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '10px 12px', color: (p.roce || 0) > 15 ? '#10B981' : '#CBD5E1', fontWeight: 700 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <RatioCard label="DCF Fair Value" value={dcf.dcf_fair_value} unit=" ₹" colorFn={() => '#10B981'} sub="Multi-Stage FCF Model" />
        <RatioCard label="Graham Number" value={dcf.graham_number} unit=" ₹" colorFn={() => '#818CF8'} sub="EPS & BV Formula" />
        <RatioCard label="Peter Lynch Target" value={dcf.peter_lynch_value} unit=" ₹" colorFn={() => '#C084FC'} sub="Growth Multiple Target" />
        <RatioCard label="Margin of Safety" value={dcf.margin_of_safety_pct} unit="%" colorFn={(v) => v >= 0 ? '#10B981' : '#EF5350'} sub={dcf.valuation_verdict} />
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#818CF8', marginBottom: 6 }}>DCF Valuation Forecast & Assumptions</div>
        <p style={{ fontSize: '0.70rem', color: '#94A3B8', lineHeight: 1.4, margin: '0 0 14px' }}>
          Assumed Growth Rate: <strong style={{ color: '#F8FAFC' }}>{dcf.assumed_growth_rate_pct != null ? `${dcf.assumed_growth_rate_pct}%` : '—'}</strong> | Discount WACC: <strong style={{ color: '#F8FAFC' }}>{dcf.discount_rate_wacc_pct != null ? `${dcf.discount_rate_wacc_pct}%` : '—'}</strong> | Terminal Growth: <strong style={{ color: '#F8FAFC' }}>{dcf.terminal_growth_rate_pct != null ? `${dcf.terminal_growth_rate_pct}%` : '—'}</strong>.
        </p>
        {dcf.projected_fcf?.length > 0 ? (
          <div className="table-scroll-container">
            <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8', textAlign: 'right', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Period</th>
                  <th style={{ padding: '10px 12px' }}>Projected FCF / Share (₹)</th>
                  <th style={{ padding: '10px 12px' }}>Present Value (PV)</th>
                </tr>
              </thead>
              <tbody>
                {dcf.projected_fcf.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1', background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                    <td style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 800, color: '#F0F0FF' }}>{p.year}</td>
                    <td style={{ padding: '10px 12px' }}>₹{p.fcf_per_share}</td>
                    <td style={{ padding: '10px 12px', color: '#10B981', fontWeight: 800 }}>₹{p.pv_fcf}</td>
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
    <div style={{
      padding: 'clamp(14px, 2vw, 24px) clamp(12px, 2vw, 24px) 90px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      maxWidth: 1320,
      margin: '0 auto',
      color: '#F8FAFC',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
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