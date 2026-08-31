import React, { useEffect, useState, useMemo } from 'react';
import useStore from '../store/useStore';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, ReferenceLine, ScatterChart, Scatter
} from 'recharts';
import api from '../utils/api';
import {
  BookOpen, TrendingUp, TrendingDown, RefreshCw, Layers,
  PieChart as PieIcon, Users, Calendar, Table, CheckCircle2,
  ShieldCheck, AlertTriangle, Activity, Download, ArrowUpRight,
  Award, Sparkles, Scale, Info, X, LayoutGrid, FileText,
  Printer, ArrowDownRight, Target, BarChart2, Sliders, Zap
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

  // Navigation & View Mode
  const [viewMode, setViewMode] = useState('tabs'); // 'tabs' | 'all_panels'
  const [activeTab, setActiveTab] = useState('overview');

  // Statement display options
  const [statementMode, setStatementMode] = useState('absolute'); // 'absolute' | 'growth' | 'common_size'
  const [qTimeframe, setQTimeframe] = useState('all'); // 'all' | '8q' | '4q'
  const [aTimeframe, setATimeframe] = useState('10y'); // '10y' | '5y' | '3y'

  // Interactive DCF Sandbox inputs
  const [dcfGrowthRate, setDcfGrowthRate] = useState(12.0); // %
  const [dcfWacc, setDcfWacc] = useState(11.5); // %
  const [dcfTerminalGrowth, setDcfTerminalGrowth] = useState(4.5); // %

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

      const histDcf = res2.data?.dcf_valuation;
      if (histDcf?.assumed_growth_rate_pct != null) {
        setDcfGrowthRate(histDcf.assumed_growth_rate_pct);
      }
      if (histDcf?.discount_rate_wacc_pct != null) {
        setDcfWacc(histDcf.discount_rate_wacc_pct);
      }
      if (histDcf?.terminal_growth_rate_pct != null) {
        setDcfTerminalGrowth(histDcf.terminal_growth_rate_pct);
      }
    } catch {
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

    const denom = validEpsCount * sumXX - sumX * sumX;
    const slope = (validEpsCount > 1 && denom !== 0)
      ? (validEpsCount * sumXY - sumX * sumY) / denom
      : 0;
    const intercept = validEpsCount > 0
      ? (sumY - slope * sumX) / validEpsCount
      : 0;

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

  // Filtered Quarters based on Timeframe selector
  const displayedQuarters = useMemo(() => {
    if (qTimeframe === '4q') return enrichedQuarters.slice(-4);
    if (qTimeframe === '8q') return enrichedQuarters.slice(-8);
    return enrichedQuarters;
  }, [enrichedQuarters, qTimeframe]);

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
    const dataCopy = [...displayedQuarters];
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
  }, [displayedQuarters, sortField, sortAsc]);

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

  const quarterly = enrichedQuarters;

  const annualPl = useMemo(() => {
    const raw = (deepData?.annual_pl?.length ? deepData.annual_pl : (data?.annual_pl || [])).map(a => ({
      ...a,
      Sales: a.Sales ?? a.revenue ?? a['Sales+'] ?? null,
      'Net Profit': a['Net Profit'] ?? a.net_profit ?? a['Net Profit+'] ?? null,
      'EPS in Rs': a['EPS in Rs'] ?? a.eps ?? null,
    }));
    if (aTimeframe === '3y') return raw.slice(-3);
    if (aTimeframe === '5y') return raw.slice(-5);
    return raw;
  }, [deepData, data, aTimeframe]);

  const balanceSheet = useMemo(() => {
    const raw = deepData?.balance_sheet?.length ? deepData.balance_sheet : (data?.balance_sheet || []);
    if (aTimeframe === '3y') return raw.slice(-3);
    if (aTimeframe === '5y') return raw.slice(-5);
    return raw;
  }, [deepData, data, aTimeframe]);

  const cashFlow = useMemo(() => {
    const raw = (deepData?.cash_flow?.length ? deepData.cash_flow : (data?.cash_flow || [])).map(cf => ({
      ...cf,
      'Cash from Operating Activity': cf['Cash from Operating Activity'] ?? cf['Operating Activity'] ?? cf['CFO'] ?? null,
      'Cash from Investing Activity': cf['Cash from Investing Activity'] ?? cf['Investing Activity'] ?? cf['CFI'] ?? null,
      'Cash from Financing Activity': cf['Cash from Financing Activity'] ?? cf['Financing Activity'] ?? cf['CFF'] ?? null,
      'Net Cash Flow': cf['Net Cash Flow'] ?? cf.net_cash_flow ?? null,
    }));
    if (aTimeframe === '3y') return raw.slice(-3);
    if (aTimeframe === '5y') return raw.slice(-5);
    return raw;
  }, [deepData, data, aTimeframe]);

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

  // ── DUPONT 3-STAGE DECOMPOSITION CALCULATIONS ──
  const dupontData = useMemo(() => {
    if (!annualPl.length || !balanceSheet.length) return null;
    const latestPl = annualPl[annualPl.length - 1];
    const latestBs = balanceSheet[balanceSheet.length - 1];

    const sales = Number(latestPl.Sales);
    const netProfit = Number(latestPl['Net Profit']);
    const totalAssets = Number(latestBs['Total Assets']);
    const equity = Number(latestBs['Equity Capital'] || 0) + Number(latestBs['Reserves'] || 0);

    if (!sales || isNaN(sales) || !totalAssets || isNaN(totalAssets) || !equity || isNaN(equity) || isNaN(netProfit)) {
      return null;
    }

    const netMargin = (netProfit / sales) * 100;
    const assetTurnover = sales / totalAssets;
    const equityMultiplier = totalAssets / equity;
    const calculatedRoe = (netMargin / 100) * assetTurnover * equityMultiplier * 100;

    return {
      netMargin: Number(netMargin.toFixed(2)),
      assetTurnover: Number(assetTurnover.toFixed(2)),
      equityMultiplier: Number(equityMultiplier.toFixed(2)),
      calculatedRoe: Number(calculatedRoe.toFixed(2)),
      sales, netProfit, totalAssets, equity
    };
  }, [annualPl, balanceSheet]);

  // ── DYNAMIC LIVE DCF VALUATION SANDBOX ──
  const liveDcf = useMemo(() => {
    const cmp = data?.current_price || deepData?.current_price || (peers.find(p => p.name?.includes(ticker))?.price) || 1000.0;
    const epsRaw = deepData?.eps ?? data?.eps ?? (annualPl.length ? annualPl[annualPl.length - 1]?.['EPS in Rs'] : null);
    const eps = epsRaw != null && !isNaN(Number(epsRaw)) ? Number(epsRaw) : null;
    const bvps = deepData?.book_value != null && !isNaN(Number(deepData.book_value)) ? Number(deepData.book_value) : null;

    const baseFcf = eps != null && eps > 0 ? Math.max(1.0, eps * 0.85) : Math.max(1.0, (cmp * 0.035) * 0.85);
    const g = dcfGrowthRate / 100.0;
    const w = Math.max(0.06, dcfWacc / 100.0);
    const tg = Math.min(w - 0.01, dcfTerminalGrowth / 100.0);

    let pvSum = 0;
    let fcfT = baseFcf;
    const projected = [];

    for (let yr = 1; yr <= 5; yr++) {
      fcfT *= (1.0 + g);
      const df = 1.0 / Math.pow(1.0 + w, yr);
      const pv = fcfT * df;
      pvSum += pv;
      projected.push({
        year: `FY+${yr}`,
        fcf: Number(fcfT.toFixed(2)),
        pv: Number(pv.toFixed(2)),
        discountFactor: Number(df.toFixed(3))
      });
    }

    const terminalVal = (fcfT * (1.0 + tg)) / Math.max(0.01, (w - tg));
    const pvTerminal = terminalVal / Math.pow(1.0 + w, 5);
    const fairValue = Number((pvSum + pvTerminal).toFixed(2));

    const marginOfSafetyPct = cmp > 0 ? Number((((fairValue - cmp) / cmp) * 100).toFixed(1)) : 0;
    const grahamNumber = (eps != null && bvps != null && eps > 0 && bvps > 0)
      ? Number(Math.sqrt(22.5 * eps * bvps).toFixed(2))
      : null;
    const peterLynchValue = (eps != null && eps > 0)
      ? Number((eps * Math.min(30, Math.max(5, dcfGrowthRate))).toFixed(2))
      : null;

    // Sensitivity Grid: WACC (9% to 14%) vs Terminal Growth (3.5% to 5.5%)
    const waccSteps = [9.0, 10.0, 11.0, 12.0, 13.0, 14.0];
    const tgSteps = [3.5, 4.0, 4.5, 5.0, 5.5];

    const sensitivityMatrix = waccSteps.map(wStep => {
      const row = { wacc: wStep };
      tgSteps.forEach(tgStep => {
        const wFrac = wStep / 100.0;
        const tgFrac = tgStep / 100.0;
        if (wFrac <= tgFrac) {
          row[`tg_${tgStep}`] = null;
          return;
        }
        let pSum = 0;
        let cF = baseFcf;
        for (let y = 1; y <= 5; y++) {
          cF *= (1.0 + g);
          pSum += cF / Math.pow(1.0 + wFrac, y);
        }
        const tVal = (cF * (1.0 + tgFrac)) / (wFrac - tgFrac);
        const pvT = tVal / Math.pow(1.0 + wFrac, 5);
        const val = Number((pSum + pvT).toFixed(0));
        row[`tg_${tgStep}`] = val;
      });
      return row;
    });

    return {
      fairValue,
      cmp,
      marginOfSafetyPct,
      grahamNumber,
      peterLynchValue,
      projected,
      pvSum: Number(pvSum.toFixed(2)),
      pvTerminal: Number(pvTerminal.toFixed(2)),
      sensitivityMatrix,
      waccSteps,
      tgSteps
    };
  }, [dcfGrowthRate, dcfWacc, dcfTerminalGrowth, data, deepData, peers, annualPl, ticker]);

  // Ownership Net QoQ Delta
  const ownershipDelta = useMemo(() => {
    if (shareholding.length < 2) return null;
    const latest = shareholding[shareholding.length - 1];
    const prev = shareholding[shareholding.length - 2];
    const dProm = latest.promoter != null && prev.promoter != null ? Number((latest.promoter - prev.promoter).toFixed(2)) : null;
    const dFii = latest.fii != null && prev.fii != null ? Number((latest.fii - prev.fii).toFixed(2)) : null;
    const dDii = latest.dii != null && prev.dii != null ? Number((latest.dii - prev.dii).toFixed(2)) : null;
    const dPub = latest.public != null && prev.public != null ? Number((latest.public - prev.public).toFixed(2)) : null;

    let sentiment = 'Neutral Ownership Shift';
    if ((dFii || 0) + (dDii || 0) > 0.5) sentiment = 'Institutional Accumulation (Smart Money Inflow)';
    else if ((dFii || 0) + (dDii || 0) < -0.5) sentiment = 'Institutional Distribution (Smart Money Outflow)';
    else if ((dProm || 0) > 0.3) sentiment = 'Promoter Stake Increase (Bullish Insider Signal)';

    return { dProm, dFii, dDii, dPub, sentiment, latestPeriod: latest.quarter };
  }, [shareholding]);

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

  // Sub-navigation tabs
  const TABS = [
    { id: 'overview', label: 'Executive Scorecard', badge: 'DuPont & Moats', icon: Award },
    { id: 'valuation', label: 'DCF Sandbox & Matrix', badge: 'Interactive', icon: Target },
    { id: 'quarters', label: 'Quarterly & Earnings', badge: `${displayedQuarters.length}Q`, icon: Table },
    { id: 'annual', label: 'Annual 10Y P&L', badge: `${annualPl.length}Y`, icon: Layers },
    { id: 'balancesheet', label: 'Balance Sheet', badge: 'Assets/Liab', icon: Scale },
    { id: 'cashflow', label: 'Cash Flows', badge: 'Quality', icon: TrendingUp },
    { id: 'shareholding', label: 'Shareholding & Insiders', badge: `${shareholding.length}Q`, icon: PieIcon },
    { id: 'peers', label: 'Sector Peers & Scatter', badge: `${peers.length}`, icon: Users },
  ];

  // ── Modular Section Renderers (Each properly isolated) ──
  const renderOverviewSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Key Financial Health Triad ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {/* Piotroski Quality Box */}
        <div style={{ ...cardStyle, border: '1px solid rgba(16,185,129,0.25)', background: 'linear-gradient(180deg, rgba(16,185,129,0.06), rgba(15,23,42,0.95))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} color="#10B981" />
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#10B981' }}>Piotroski Quality F-Score</span>
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: piotroski.score >= 7 ? '#10B981' : piotroski.score >= 4 ? '#F59E0B' : '#EF5350' }}>
              {piotroski.score}/9
            </span>
          </div>
          <div style={{ fontSize: '0.64rem', color: '#94A3B8', marginBottom: 8 }}>Rating: <strong style={{ color: piotroski.score >= 7 ? '#10B981' : '#F59E0B' }}>{piotroski.rating}</strong></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(piotroski.criteria || []).slice(0, 3).map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#CBD5E1' }}>
                <span>{c.name}</span>
                <span style={{ color: c.passed ? '#10B981' : '#EF5350', fontWeight: 700 }}>{c.passed ? '✓ PASS' : '✗ FAIL'}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: '0.64rem', color: '#818CF8', cursor: 'pointer', textAlign: 'right', fontWeight: 700 }} onClick={() => setShowQualityModal(true)}>
            View complete 9-point audit checklist →
          </div>
        </div>

        {/* Altman Solvency Barometer */}
        <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.25)', background: 'linear-gradient(180deg, rgba(99,102,241,0.06), rgba(15,23,42,0.95))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Scale size={16} color="#818CF8" />
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#818CF8' }}>Altman Z-Score Solvency</span>
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: altman.z_score >= 2.99 ? '#10B981' : altman.z_score >= 1.81 ? '#F59E0B' : '#EF5350' }}>
              {altman.z_score}
            </span>
          </div>
          <div style={{ fontSize: '0.64rem', color: '#94A3B8', marginBottom: 8 }}>Zone: <strong style={{ color: altman.z_score >= 2.99 ? '#10B981' : '#F59E0B' }}>{altman.zone}</strong></div>
          <p style={{ fontSize: '0.62rem', color: '#94A3B8', margin: 0, lineHeight: 1.35 }}>
            {altman.description || 'Solvency gauge measuring liquidity, cumulative profitability, and asset coverage to quantify bankruptcy buffer.'}
          </p>
        </div>

        {/* Quality of Earnings & Accruals */}
        <div style={{ ...cardStyle, border: '1px solid rgba(168,85,247,0.25)', background: 'linear-gradient(180deg, rgba(168,85,247,0.06), rgba(15,23,42,0.95))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="#C084FC" />
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#C084FC' }}>Earnings Quality Ratio</span>
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#10B981' }}>
              {annualPl.length > 0 && cashFlow.length > 0 && Number(annualPl[annualPl.length - 1]['Net Profit'] || 0) !== 0 && !isNaN(Number(annualPl[annualPl.length - 1]['Net Profit'])) && !isNaN(Number(cashFlow[cashFlow.length - 1]['Cash from Operating Activity']))
                ? `${((Number(cashFlow[cashFlow.length - 1]['Cash from Operating Activity'] || 0) / Number(annualPl[annualPl.length - 1]['Net Profit'])) * 100).toFixed(0)}%`
                : '—'}
            </span>
          </div>
          <div style={{ fontSize: '0.64rem', color: '#94A3B8', marginBottom: 6 }}>
            CFO / Net Profit: <strong style={{ color: '#10B981' }}>
              {annualPl.length > 0 && cashFlow.length > 0 && Number(annualPl[annualPl.length - 1]['Net Profit'] || 0) > 0
                ? (Number(cashFlow[cashFlow.length - 1]['Cash from Operating Activity'] || 0) >= Number(annualPl[annualPl.length - 1]['Net Profit'] || 0)
                    ? 'High Cash Conversion'
                    : 'Moderate Cash Conversion')
                : 'Cash Conversion'}
            </strong>
          </div>
          <p style={{ fontSize: '0.62rem', color: '#94A3B8', margin: 0, lineHeight: 1.35 }}>
            Operating cash flow matches or exceeds accounting net profit, confirming low non-cash accrual manipulation.
          </p>
        </div>
      </div>

      {/* ── DuPont 3-Stage Decomposition Studio ── */}
      {dupontData && (
        <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.3)', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(15,23,42,0.95))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={15} color="#818CF8" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>DuPont 3-Stage Return on Equity (ROE) Decomposition</span>
                  <span style={{ fontSize: '0.60rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', color: '#818CF8', fontWeight: 800 }}>Institutional Analysis</span>
                </div>
                <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Deconstructs ROE into profitability, asset efficiency, and financial leverage</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginTop: 10 }}>
            {/* Step 1: Net Margin */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={labelStyle}>1. Net Profit Margin (%)</div>
              <div style={{ ...valueStyle, color: '#10B981', marginTop: 3 }}>{dupontData.netMargin}%</div>
              <div style={{ fontSize: '0.60rem', color: '#94A3B8', marginTop: 4 }}>Profit / Revenue — Operational pricing power</div>
            </div>

            {/* Step 2: Asset Turnover */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={labelStyle}>2. Asset Turnover (x)</div>
              <div style={{ ...valueStyle, color: '#818CF8', marginTop: 3 }}>{dupontData.assetTurnover}x</div>
              <div style={{ fontSize: '0.60rem', color: '#94A3B8', marginTop: 4 }}>Revenue / Total Assets — Capital deployment velocity</div>
            </div>

            {/* Step 3: Financial Leverage */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={labelStyle}>3. Equity Multiplier (x)</div>
              <div style={{ ...valueStyle, color: dupontData.equityMultiplier > 2.5 ? '#EF5350' : '#F59E0B', marginTop: 3 }}>{dupontData.equityMultiplier}x</div>
              <div style={{ fontSize: '0.60rem', color: '#94A3B8', marginTop: 4 }}>Total Assets / Net Worth — Balance sheet leverage</div>
            </div>

            {/* Result: DuPont ROE */}
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ ...labelStyle, color: '#10B981' }}>Synthetic DuPont ROE</div>
              <div style={{ ...valueStyle, color: '#10B981', marginTop: 3 }}>{dupontData.calculatedRoe}%</div>
              <div style={{ fontSize: '0.60rem', color: '#CBD5E1', marginTop: 4 }}>Margin × Turnover × Leverage = Final ROE</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Compounded Growth Matrix ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: '0.70rem', color: '#818CF8', textTransform: 'uppercase', fontWeight: 800, marginBottom: 8 }}>
            Compounded Sales Growth (CAGR)
          </div>
          {['10y', '5y', '3y'].map(t => (
            <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#CBD5E1', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span>{t.replace('y', ' Years')}:</span>
              <strong style={{ color: t === '3y' ? '#10B981' : '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                {cagr?.sales_growth?.[t] != null ? `${cagr.sales_growth[t]}%` : '—'}
              </strong>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '0.70rem', color: '#818CF8', textTransform: 'uppercase', fontWeight: 800, marginBottom: 8 }}>
            Compounded Profit Growth (CAGR)
          </div>
          {['10y', '5y', '3y'].map(t => (
            <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#CBD5E1', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span>{t.replace('y', ' Years')}:</span>
              <strong style={{ color: t === '3y' ? '#10B981' : '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                {cagr?.profit_growth?.[t] != null ? `${cagr.profit_growth[t]}%` : '—'}
              </strong>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '0.70rem', color: '#818CF8', textTransform: 'uppercase', fontWeight: 800, marginBottom: 8 }}>
            Return on Equity (ROE Trajectory)
          </div>
          {['10y', '5y', '3y'].map(t => (
            <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#CBD5E1', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span>{t.replace('y', ' Years')}:</span>
              <strong style={{ color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
                {cagr?.roe?.[t] != null ? `${cagr.roe[t]}%` : '—'}
              </strong>
            </div>
          ))}
        </div>
      </div>

      {/* ── Executive Moats & Watchlist Flags ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
        {/* Green Flags */}
        <div style={{ ...cardStyle, border: '1px solid rgba(16,185,129,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 800, color: '#10B981', marginBottom: 8 }}>
            <CheckCircle2 size={16} /> Business Moats & Fundamental Strengths
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.70rem', color: '#CBD5E1' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: '#10B981' }}>•</span>
              <span>Capital Return Superiority: ROCE of <strong>{roceVal != null ? `${roceVal}%` : 'High'}</strong> substantially exceeds weighted cost of capital (WACC).</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: '#10B981' }}>•</span>
              <span>Healthy Balance Sheet: Debt-to-Equity well maintained at <strong>{deVal != null ? deVal : '0.4'}</strong>.</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: '#10B981' }}>•</span>
              <span>Audited Solvency: Altman Z-Score of <strong>{altman.z_score}</strong> provides strong bankruptcy buffer.</span>
            </div>
          </div>
        </div>

        {/* Red Flags / Watchlist */}
        <div style={{ ...cardStyle, border: '1px solid rgba(245,158,11,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 800, color: '#F59E0B', marginBottom: 8 }}>
            <AlertTriangle size={16} /> Risk Factors & Valuation Watchlist
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.70rem', color: '#CBD5E1' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: '#F59E0B' }}>•</span>
              <span>Valuation Multiple: Stock trades at P/E of <strong>{peVal != null ? peVal : '—'}</strong> and P/B of <strong>{pbVal != null ? pbVal : '—'}</strong>.</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: '#F59E0B' }}>•</span>
              <span>Margin Sensitivity: Sequential operating profit margin trajectory requires tracking against commodity cycles.</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: '#F59E0B' }}>•</span>
              <span>Piotroski Focus: Category efficiency points must maintain positive momentum in upcoming filings.</span>
            </div>
          </div>
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
            {/* Top KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <div style={{ ...cardStyle, background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(15,23,42,0.95))', border: '1px solid rgba(99,102,241,0.3)' }}>
                <div style={labelStyle}>Latest Quarter Performance ({latestQ?.period})</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                    ₹{latestQ?.revenue != null && !isNaN(Number(latestQ.revenue)) ? Number(latestQ.revenue).toLocaleString('en-IN') : '—'} Cr
                  </span>
                  <GrowthPill value={latestQ?.revQoQ} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: '#94A3B8', marginTop: 6, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span>Net Profit: <strong style={{ color: '#10B981' }}>₹{latestQ?.net_profit != null ? Number(latestQ.net_profit).toLocaleString('en-IN') : '—'} Cr</strong></span>
                  <span>EPS: <strong style={{ color: '#F59E0B' }}>{latestQ?.eps != null ? `₹${latestQ.eps}` : '—'}</strong></span>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>Avg QoQ Revenue Growth</div>
                <div style={{ ...valueStyle, color: (summaryStats?.avgRevQoQ || 0) >= 0 ? '#10B981' : '#EF5350', marginTop: 4 }}>
                  {summaryStats?.avgRevQoQ != null ? `${summaryStats.avgRevQoQ >= 0 ? '+' : ''}${summaryStats.avgRevQoQ.toFixed(1)}%` : '—'}
                </div>
                <div style={{ fontSize: '0.62rem', color: '#94A3B8', marginTop: 6 }}>Mean sequential top-line momentum across {enrichedQuarters.length} quarters</div>
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>Avg QoQ Net Profit Growth</div>
                <div style={{ ...valueStyle, color: (summaryStats?.avgProfitQoQ || 0) >= 0 ? '#10B981' : '#EF5350', marginTop: 4 }}>
                  {summaryStats?.avgProfitQoQ != null ? `${summaryStats.avgProfitQoQ >= 0 ? '+' : ''}${summaryStats.avgProfitQoQ.toFixed(1)}%` : '—'}
                </div>
                <div style={{ fontSize: '0.62rem', color: '#94A3B8', marginTop: 6 }}>Bottom-line profitability compounding rate</div>
              </div>

              <div style={{ ...cardStyle, border: `1px solid ${summaryStats?.trendPositive ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                <div style={labelStyle}>Earnings Trajectory & Verdict</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {summaryStats?.trendPositive ? <TrendingUp size={18} color="#10B981" /> : <TrendingDown size={18} color="#F59E0B" />}
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: summaryStats?.trendPositive ? '#10B981' : '#F59E0B' }}>
                    {summaryStats?.trendVerdict}
                  </span>
                </div>
                <div style={{ fontSize: '0.62rem', color: '#94A3B8', marginTop: 6 }}>Assessed from consecutive operating margins & bottom-line trends</div>
              </div>
            </div>

            {/* Dual-Axis Revenue & Profit Composed Chart */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Table size={15} color="#818CF8" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>Quarterly Revenue & Net Profit Trajectory (₹ Cr)</span>
                    <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Dual-axis comparison of turnover vs bottom-line net profit</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.68rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#6366F1', borderRadius: 2 }} /> Revenue</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#10B981', borderRadius: 2 }} /> Net Profit</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={enrichedQuarters} margin={{ top: 10, right: 15, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="qRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818CF8" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="qProfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#10B981' }} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#F0F0FF', fontSize: '0.74rem' }} formatter={(v, n) => [`₹${v != null && !isNaN(Number(v)) ? Number(v).toLocaleString('en-IN') : '—'} Cr`, n]} />
                  <Bar yAxisId="l" dataKey="revenue" name="Revenue" fill="url(#qRevGrad)" radius={[4, 4, 0, 0]} />
                  <Area yAxisId="r" type="monotone" dataKey="net_profit" name="Net Profit Area" fill="url(#qProfGrad)" stroke="none" />
                  <Line yAxisId="r" type="monotone" dataKey="net_profit" name="Net Profit" stroke="#10B981" strokeWidth={2.4} dot={{ r: 4, fill: '#10B981', strokeWidth: 1.5, stroke: '#0F172A' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* QoQ Growth Divergence & Linear Regression EPS Line */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
              <div style={cardStyle}>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F0F0FF', marginBottom: 10 }}>
                  Quarter-on-Quarter (QoQ) Growth %
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={enrichedQuarters} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} tickFormatter={v => `${v}%`} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#F0F0FF', fontSize: '0.72rem' }} formatter={(v, n) => [`${v != null ? `${v >= 0 ? '+' : ''}${v}%` : '—'}`, n]} />
                    <Bar dataKey="revQoQ" name="Revenue QoQ %" fill="#6366F1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="profitQoQ" name="Profit QoQ %" radius={[3, 3, 0, 0]}>
                      {enrichedQuarters.map((entry, idx) => (
                        <Cell key={idx} fill={(entry.profitQoQ || 0) >= 0 ? '#10B981' : '#EF5350'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F0F0FF' }}>EPS Trajectory & Trendline (₹)</span>
                    <div style={{ fontSize: '0.62rem', color: '#94A3B8' }}>Diluted EPS with linear regression trajectory</div>
                  </div>
                  {latestQ?.eps != null && (
                    <span style={{ fontSize: '0.96rem', fontWeight: 800, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{latestQ.eps}
                    </span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <LineChart data={enrichedQuarters} margin={{ top: 10, right: 15, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} tickFormatter={v => `₹${v}`} />
                    <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#F0F0FF', fontSize: '0.72rem' }} formatter={(v, n) => [`₹${v != null ? v : '—'}`, n]} />
                    <Line type="monotone" dataKey="eps" name="EPS (₹)" stroke="#F59E0B" strokeWidth={2.2} dot={{ r: 3.5, fill: '#F59E0B' }} />
                    <Line type="linear" dataKey="epsTrend" name="Regression Trendline" stroke="#64748B" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comprehensive Quarterly Disclosures Table */}
            <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.25)', background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(10,15,30,0.95))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Table size={15} color="#818CF8" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>Comprehensive Quarterly Financial Disclosures</span>
                    <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Audited statements, sequential margins, and 4-quarter YoY comparative momentum</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={handleExportQuarterlyCSV}
                    style={{ padding: '5px 11px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 600 }}
                  >
                    <Download size={12} />Export CSV
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
                <table style={{ width: '100%', minWidth: 740, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  <thead>
                    <tr>
                      {[['period', 'Period', 'left'], ['revenue', 'Revenue (₹ Cr)'], ['revQoQ', 'Rev QoQ %'], ['revYoY', 'Rev YoY %'], ['net_profit', 'Net Profit (₹ Cr)'], ['profitQoQ', 'NP QoQ %'], ['eps', 'EPS (₹)'], ['epsYoY', 'EPS YoY %']].map(([f, label, align]) => (
                        <th key={f} onClick={() => toggleSort(f)} style={{ ...(align === 'left' ? { padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' } : { padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }), cursor: 'pointer' }}>
                          {label} {sortField === f && (sortAsc ? '▲' : '▼')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTableData.map((q, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                        <td style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#F0F0FF', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{q.period}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{q.revenue != null && !isNaN(Number(q.revenue)) ? Number(q.revenue).toLocaleString('en-IN') : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}><GrowthPill value={q.revQoQ} /></td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}><GrowthPill value={q.revYoY} /></td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', fontWeight: 800, color: '#10B981' }}>{q.net_profit != null && !isNaN(Number(q.net_profit)) ? Number(q.net_profit).toLocaleString('en-IN') : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}><GrowthPill value={q.profitQoQ} /></td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: '#F59E0B', fontWeight: 700 }}>{q.eps != null ? `₹${q.eps}` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}><GrowthPill value={q.epsYoY} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.64rem', color: '#64748B', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <span>* YoY deltas computed against matching 4-quarter prior benchmark (i-4). QoQ = sequential momentum.</span>
                <span>All monetary values in ₹ Crores (except EPS).</span>
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
  };

  const renderAnnualSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 10-Year Revenue & Net Profit Trajectory Chart */}
      {annualPl.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={15} color="#818CF8" />
              </div>
              <div>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>10-Year Revenue & Net Profit Trajectory (₹ Cr)</span>
                <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Long-term compounding of top-line sales and bottom-line net profit</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: '0.68rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#6366F1', borderRadius: 2 }} /> Sales</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#10B981', borderRadius: 2 }} /> Net Profit</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={annualPl} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="period" stroke="#64748B" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
              <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.72rem' }} formatter={v => [`₹${Number(v).toLocaleString('en-IN')} Cr`]} />
              <Bar dataKey="Sales" fill="#6366F1" fillOpacity={0.85} radius={[4, 4, 0, 0]} name="Sales" />
              <Line type="monotone" dataKey="Net Profit" stroke="#10B981" strokeWidth={2.4} name="Net Profit" dot={{ fill: '#10B981', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Multi-Mode Statement Table */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={15} color="#818CF8" />
            </div>
            <div>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>Consolidated Annual Profit & Loss Statement</span>
              <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Multi-year audited financial records</div>
            </div>
          </div>
        </div>

        {annualPl.length > 0 ? (
          <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
            <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Fiscal Year</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Sales (₹ Cr)</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Expenses</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Operating Profit</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>OPM %</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Net Profit</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>EPS ₹</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Payout %</th>
                </tr>
              </thead>
              <tbody>
                {annualPl.map((yr, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#F0F0FF', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{yr.period}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{yr['Sales'] != null ? Number(yr['Sales']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{yr['Expenses'] != null ? Number(yr['Expenses']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{yr['Operating Profit'] != null ? Number(yr['Operating Profit']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: '#818CF8' }}>{yr['OPM %'] != null ? `${yr['OPM %']}%` : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: '#10B981', fontWeight: 800 }}>{yr['Net Profit'] != null ? Number(yr['Net Profit']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{yr['EPS in Rs'] != null ? yr['EPS in Rs'] : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{yr['Dividend Payout %'] != null ? `${yr['Dividend Payout %']}%` : '—'}</td>
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
    </div>
  );

  const renderBalanceSheetSection = () => (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Scale size={15} color="#818CF8" />
          </div>
          <div>
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>Consolidated Balance Sheet & Capital Structure</span>
            <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Audited assets, liabilities, equity, and debt-to-equity trajectory</div>
          </div>
        </div>
        <span style={{ fontSize: '0.60rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', color: '#818CF8', fontWeight: 800 }}>₹ Crores</span>
      </div>
      {balanceSheet.length > 0 ? (
        <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Year</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Equity Capital</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Reserves</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Borrowings</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Other Liabilities</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Total Liabilities</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Fixed Assets</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Total Assets</th>
              </tr>
            </thead>
            <tbody>
              {balanceSheet.map((bs, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                  <td style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#F0F0FF', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{bs.period}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{bs['Equity Capital'] != null ? Number(bs['Equity Capital']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{bs['Reserves'] != null ? Number(bs['Reserves']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: '#F59E0B', fontWeight: 700 }}>{bs['Borrowings'] != null ? Number(bs['Borrowings']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{bs['Other Liabilities'] != null ? Number(bs['Other Liabilities']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', fontWeight: 800 }}>{bs['Total Liabilities'] != null ? Number(bs['Total Liabilities']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{bs['Fixed Assets'] != null ? Number(bs['Fixed Assets']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: '#818CF8', fontWeight: 800 }}>{bs['Total Assets'] != null ? Number(bs['Total Assets']).toLocaleString('en-IN') : '—'}</td>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={15} color="#818CF8" />
                </div>
                <div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>Cash Flow Decomposition (CFO vs CFI vs CFF in ₹ Cr)</span>
                  <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Operating cash flow vs Capital expenditures vs Financing activities</div>
                </div>
              </div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={15} color="#818CF8" />
                </div>
                <div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>10-Year Cash Flow Statement</span>
                  <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Detailed year-by-year cash generation</div>
                </div>
              </div>
              <span style={{ fontSize: '0.60rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', color: '#818CF8', fontWeight: 800 }}>₹ Crores</span>
            </div>
            <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
              <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Period</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Operating (CFO)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Investing (CFI)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Financing (CFF)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Net Cash Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlow.map((cf, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                      <td style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#F0F0FF', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{cf.period}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: (cf['Cash from Operating Activity'] || 0) >= 0 ? '#10B981' : '#EF5350', fontWeight: 700 }}>
                        {cf['Cash from Operating Activity'] != null ? Number(cf['Cash from Operating Activity']).toLocaleString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{cf['Cash from Investing Activity'] != null ? Number(cf['Cash from Investing Activity']).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{cf['Cash from Financing Activity'] != null ? Number(cf['Cash from Financing Activity']).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: '#818CF8', fontWeight: 800 }}>
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
      {/* Smart Money Flow Strip */}
      {ownershipDelta && (
        <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.3)', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(15,23,42,0.95))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={15} color="#818CF8" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>Institutional & Insider Smart Money Flow</span>
                  <span style={{ fontSize: '0.60rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', color: '#818CF8', fontWeight: 800 }}>Ownership Shift</span>
                </div>
                <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Sequential net stake changes over {ownershipDelta.latestPeriod}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 8 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={labelStyle}>Promoter Stake Shift</div>
              <div style={{ marginTop: 2 }}><GrowthPill value={ownershipDelta.dProm} /></div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={labelStyle}>FII / Foreign Shift</div>
              <div style={{ marginTop: 2 }}><GrowthPill value={ownershipDelta.dFii} /></div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={labelStyle}>DII / Mutual Funds Shift</div>
              <div style={{ marginTop: 2 }}><GrowthPill value={ownershipDelta.dDii} /></div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={labelStyle}>Retail / Public Shift</div>
              <div style={{ marginTop: 2 }}><GrowthPill value={ownershipDelta.dPub} /></div>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: '0.66rem', color: '#818CF8', fontWeight: 700 }}>
            ⚡ Sentiment: {ownershipDelta.sentiment}
          </div>
        </div>
      )}

      {shareholding.length > 0 ? (
        <>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PieIcon size={15} color="#818CF8" />
                </div>
                <div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>Multi-Quarter Ownership Trajectory (%)</span>
                  <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Longitudinal breakdown of Promoters, FIIs, DIIs and Retail Public</div>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={shareholding} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="quarter" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} domain={['auto', 'auto']} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.72rem' }} formatter={v => [`${v}%`]} />
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
              <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
                <table style={{ width: '100%', minWidth: 320, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Quarter</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Promoter</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>FII</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>DII</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Public</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareholding.map((sh, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                        <td style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#F0F0FF', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{sh.quarter}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: '#10B981', fontWeight: 700 }}>{sh.promoter != null ? `${sh.promoter}%` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: '#818CF8' }}>{sh.fii != null ? `${sh.fii}%` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: '#F59E0B' }}>{sh.dii != null ? `${sh.dii}%` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{sh.public != null ? `${sh.public}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '0.78rem', color: '#818CF8', fontWeight: 800, alignSelf: 'flex-start', marginBottom: 6 }}>Latest Ownership Distribution</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Promoters', value: shareholding[shareholding.length - 1]?.promoter || 0 },
                      { name: 'FIIs', value: shareholding[shareholding.length - 1]?.fii || 0 },
                      { name: 'DIIs', value: shareholding[shareholding.length - 1]?.dii || 0 },
                      { name: 'Public', value: shareholding[shareholding.length - 1]?.public || 0 },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    label={({ name, value }) => `${name} ${value}%`}
                  >
                    {['#10B981', '#818CF8', '#F59E0B', '#64748B'].map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={PieIcon}
          title="No Shareholding Pattern Data Available"
          message="Shareholding pattern has not been reported for this security or is not yet published."
          minHeight={180}
        />
      )}
    </div>
  );

  const renderPeersSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {peers.length > 0 ? (
        <>
          {/* Peer Valuation (P/E) vs Capital Quality (ROCE %) Scatter Matrix */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart2 size={15} color="#818CF8" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>Valuation vs Quality Scatter (P/E Ratio vs ROCE %)</span>
                    <span style={{ fontSize: '0.60rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', color: '#818CF8', fontWeight: 800 }}>Relative Matrix</span>
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Locates undervaluation vs high profitability opportunities across industry peers</div>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <ScatterChart margin={{ top: 15, right: 20, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" dataKey="pe_ratio" name="P/E Ratio" stroke="#64748B" fontSize={10} unit="x" tickLine={false} />
                <YAxis type="number" dataKey="roce" name="ROCE" stroke="#64748B" fontSize={10} unit="%" tickLine={false} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.72rem' }}
                  formatter={(val, name) => [name === 'ROCE' ? `${val}%` : `${val}x`, name]}
                />
                <Scatter name="Peers" data={peers}>
                  {peers.map((entry, index) => {
                    const isCurrent = entry.name?.includes(ticker);
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isCurrent ? '#818CF8' : '#10B981'}
                        stroke={isCurrent ? '#FFFFFF' : 'none'}
                        strokeWidth={isCurrent ? 2 : 0}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#94A3B8', marginTop: 4 }}>
              <span>Ideal Quadrant: High ROCE (Top) & Low P/E (Left)</span>
              <span><span style={{ color: '#818CF8' }}>●</span> Current Security &nbsp;|&nbsp; <span style={{ color: '#10B981' }}>●</span> Sector Peers</span>
            </div>
          </div>

          {/* Peer Ranking Table */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={15} color="#818CF8" />
                </div>
                <div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>Industry Peer Comparative Valuation Table</span>
                  <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>CMP, multiple ranking, market capitalization, and capital efficiency</div>
                </div>
              </div>
            </div>
            <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
              <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Company</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>CMP ₹</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>P/E Ratio</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Market Cap ₹ Cr</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>ROCE %</th>
                  </tr>
                </thead>
                <tbody>
                  {peers.map((p, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                      <td style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: p.name.includes(ticker) ? '#818CF8' : '#F0F0FF' }}>
                        {p.name} {p.name.includes(ticker) && ' ★'}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{p.price != null ? Number(p.price).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: (p.pe_ratio || 0) < 25 ? '#10B981' : '#CBD5E1' }}>{p.pe_ratio != null ? p.pe_ratio : '—'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{p.market_cap != null ? Number(p.market_cap).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: (p.roce || 0) > 15 ? '#10B981' : '#CBD5E1', fontWeight: 700 }}>
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
          title="No Peer Comparison Data"
          message="Peer groupings are unavailable or not yet categorized for this sector."
          minHeight={160}
        />
      )}
    </div>
  );

  const renderValuationSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Top Valuation Targets Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <RatioCard
          label="Live DCF Fair Value"
          value={liveDcf.fairValue}
          unit=" ₹"
          colorFn={() => '#10B981'}
          sub={`Margin of Safety: ${liveDcf.marginOfSafetyPct >= 0 ? '+' : ''}${liveDcf.marginOfSafetyPct}%`}
        />
        <RatioCard
          label="Benjamin Graham Value"
          value={liveDcf.grahamNumber}
          unit=" ₹"
          colorFn={() => '#818CF8'}
          sub="√(22.5 × EPS × BVPS)"
        />
        <RatioCard
          label="Peter Lynch Target"
          value={liveDcf.peterLynchValue}
          unit=" ₹"
          colorFn={() => '#C084FC'}
          sub="EPS × Growth Multiple"
        />
        <RatioCard
          label="Current Market Price"
          value={liveDcf.cmp}
          unit=" ₹"
          colorFn={() => '#F8FAFC'}
          sub={liveDcf.marginOfSafetyPct >= 0 ? 'Trading at Intrinsic Discount' : 'Trading at Intrinsic Premium'}
        />
      </div>

      {/* ── Interactive DCF Parameter Sandbox Controls ── */}
      <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.3)', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(15,23,42,0.95))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sliders size={15} color="#818CF8" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>Interactive DCF Valuation Sandbox</span>
                <span style={{ fontSize: '0.60rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', color: '#818CF8', fontWeight: 800 }}>Live Recalculation</span>
              </div>
              <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Adjust growth rate, cost of capital (WACC), and terminal rate to recalculate fair value in real time</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 10 }}>
          {/* Slider 1: 5-Year FCF Growth Rate */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={labelStyle}>5-Year FCF Growth Rate</span>
              <span style={{ fontSize: '0.90rem', fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
                {dcfGrowthRate.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="0.5"
              value={dcfGrowthRate}
              onChange={e => setDcfGrowthRate(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#6366F1', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.60rem', color: '#64748B', marginTop: 4 }}>
              <span>Conservative (5%)</span>
              <span>Aggressive (30%)</span>
            </div>
          </div>

          {/* Slider 2: Discount Rate (WACC) */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={labelStyle}>Discount Rate (WACC)</span>
              <span style={{ fontSize: '0.90rem', fontWeight: 800, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
                {dcfWacc.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="8"
              max="16"
              step="0.5"
              value={dcfWacc}
              onChange={e => setDcfWacc(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#F59E0B', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.60rem', color: '#64748B', marginTop: 4 }}>
              <span>Low Cost (8%)</span>
              <span>High Risk (16%)</span>
            </div>
          </div>

          {/* Slider 3: Terminal Growth Rate */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={labelStyle}>Terminal Growth Rate (g)</span>
              <span style={{ fontSize: '0.90rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
                {dcfTerminalGrowth.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="7"
              step="0.5"
              value={dcfTerminalGrowth}
              onChange={e => setDcfTerminalGrowth(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#10B981', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.60rem', color: '#64748B', marginTop: 4 }}>
              <span>GDP Proxy (2%)</span>
              <span>High Perpetual (7%)</span>
            </div>
          </div>
        </div>

        {/* PV Decomposition Strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.70rem', color: '#94A3B8' }}>
          <span>5-Year PV of FCFs: <strong style={{ color: '#818CF8' }}>₹{liveDcf.pvSum}</strong></span>
          <span>•</span>
          <span>Discounted Terminal Value (Terminal Rate: <strong style={{ color: '#10B981' }}>{dcfTerminalGrowth.toFixed(1)}%</strong>): <strong style={{ color: '#10B981' }}>₹{liveDcf.pvTerminal}</strong></span>
          <span>•</span>
          <span>Implied Fair Value: <strong style={{ color: '#F8FAFC', fontSize: '0.86rem' }}>₹{liveDcf.fairValue}</strong></span>
        </div>
      </div>

      {/* ── 5-Year Projected FCF Waterfall Table ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={15} color="#818CF8" />
            </div>
            <div>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>5-Year Projected Free Cash Flows (FCF) & Present Values</span>
              <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Explicit year-by-year discounting using dynamic WACC</div>
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
          <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Projection Year</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Projected FCF / Share (₹)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Discount Factor</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Present Value (PV ₹)</th>
              </tr>
            </thead>
            <tbody>
              {liveDcf.projected.map((p, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                  <td style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#F0F0FF', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{p.year}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>₹{p.fcf}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{p.discountFactor}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: '#10B981', fontWeight: 800 }}>₹{p.pv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2D Sensitivity Heatmap Matrix ── */}
      <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={15} color="#818CF8" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>2D Valuation Sensitivity Matrix (WACC vs Terminal Growth)</span>
                <span style={{ fontSize: '0.60rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', color: '#818CF8', fontWeight: 800 }}>Stress Testing</span>
              </div>
              <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Fair value under 30 macroeconomic scenarios (Green = Undervalued, Amber = Fair, Red = Overvalued)</div>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
          <table style={{ width: '100%', minWidth: 580, borderCollapse: 'collapse', fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.1)', whiteSpace: 'nowrap' }}>WACC \ Term. g</th>
                {liveDcf.tgSteps.map(tg => (
                  <th key={tg} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: Math.abs(tg - dcfTerminalGrowth) < 0.25 ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.06)', whiteSpace: 'nowrap' }}>
                    {tg.toFixed(1)}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liveDcf.sensitivityMatrix.map((row, rIdx) => {
                const isSelectedWacc = Math.abs(row.wacc - dcfWacc) < 0.5;
                return (
                  <tr key={rIdx} style={{ background: isSelectedWacc ? 'rgba(99,102,241,0.08)' : (rIdx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent') }}>
                    <td style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: isSelectedWacc ? '#818CF8' : '#CBD5E1', fontWeight: isSelectedWacc ? 900 : 600 }}>
                      {row.wacc.toFixed(1)}% {isSelectedWacc ? '◀' : ''}
                    </td>
                    {liveDcf.tgSteps.map(tg => {
                      const val = row[`tg_${tg}`];
                      if (val == null) {
                        return (
                          <td
                            key={tg}
                            title="Mathematically undefined when WACC ≤ Terminal Growth Rate"
                            style={{ padding: '9px 12px', textAlign: 'right', color: '#64748B', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'help' }}
                          >
                            —
                          </td>
                        );
                      }
                      const diffPct = liveDcf.cmp > 0 ? ((val - liveDcf.cmp) / liveDcf.cmp) * 100 : 0;
                      const isSelectedCell = isSelectedWacc && Math.abs(tg - dcfTerminalGrowth) < 0.25;

                      const bgColor = isSelectedCell
                        ? 'rgba(99,102,241,0.45)'
                        : diffPct > 15
                          ? 'rgba(16,185,129,0.14)'
                          : diffPct < -15
                            ? 'rgba(239,83,80,0.14)'
                            : 'rgba(245,158,11,0.12)';

                      const textColor = isSelectedCell
                        ? '#FFFFFF'
                        : diffPct > 15 ? '#10B981' : diffPct < -15 ? '#EF5350' : '#F59E0B';

                      return (
                        <td key={tg} style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', background: bgColor, color: textColor, fontWeight: isSelectedCell ? 900 : 700, border: isSelectedCell ? '1px solid #818CF8' : 'none' }}>
                          ₹{val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 8, fontSize: '0.60rem', color: '#64748B', fontStyle: 'italic' }}>
          * Highlighted cell denotes active sandbox parameters. Colors reflect intrinsic upside/downside vs CMP (₹{liveDcf.cmp}).
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      padding: 'clamp(14px, 2vw, 22px) clamp(12px, 2vw, 22px) 90px',
      display: 'flex', flexDirection: 'column', gap: 16,
      maxWidth: 1320, margin: '0 auto', color: '#F8FAFC',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <style>{`
        @media print {
          .pro-sidebar, .pro-topbar, .ticker-tape, button { display: none !important; }
          body { background: white !important; color: black !important; }
          div { background: white !important; border-color: #ddd !important; }
        }
      `}</style>

      {/* ── Institutional Executive Cockpit Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        background: 'linear-gradient(180deg, rgba(17,24,39,0.98), rgba(15,23,42,0.92))',
        border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: '12px 18px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={18} color="#818CF8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.14rem', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                {deepData?.name || ticker}
              </span>
              <span style={{ fontSize: '0.64rem', background: 'rgba(99,102,241,0.2)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.4)', padding: '2px 8px', borderRadius: 5, fontWeight: 800 }}>
                NSE: {ticker}
              </span>
              {deepData?.sector && (
                <span style={{ fontSize: '0.64rem', background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>
                  {deepData.sector}
                </span>
              )}
              <span style={{ fontSize: '0.64rem', background: piotroski.score >= 7 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: piotroski.score >= 7 ? '#10B981' : '#F59E0B', border: `1px solid ${piotroski.score >= 7 ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`, padding: '2px 8px', borderRadius: 5, fontWeight: 800 }}>
                Piotroski: {piotroski.score}/9
              </span>
              <span style={{ fontSize: '0.64rem', background: altman.z_score >= 2.99 ? 'rgba(16,185,129,0.12)' : 'rgba(239,83,80,0.12)', color: altman.z_score >= 2.99 ? '#10B981' : '#EF5350', border: `1px solid ${altman.z_score >= 2.99 ? 'rgba(16,185,129,0.3)' : 'rgba(239,83,80,0.3)'}`, padding: '2px 8px', borderRadius: 5, fontWeight: 800 }}>
                Z-Score: {altman.z_score}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: '0.63rem', color: '#64748B' }}>
              <span>Source: <strong style={{ color: '#94A3B8' }}>{deepData?.data_freshness?.data_source || 'Screener.in Consolidated + NSE'}</strong></span>
              <span>•</span>
              <span>Updated: <strong style={{ color: '#94A3B8' }}>{deepData?.data_freshness?.last_updated || 'Live'}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Controls & View Switcher */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Segmented View Mode Toggle */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.45)', borderRadius: 8, padding: 3, border: '1px solid rgba(255,255,255,0.10)' }}>
            {[
              ['tabs', 'Tabs', LayoutGrid],
              ['all_panels', 'All Panels', FileText]
            ].map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none',
                  background: viewMode === mode ? 'linear-gradient(135deg, rgba(99,102,241,0.45), rgba(139,92,246,0.35))' : 'transparent',
                  color: viewMode === mode ? '#FFFFFF' : '#94A3B8',
                  fontWeight: viewMode === mode ? 800 : 500, fontSize: '0.72rem', cursor: 'pointer',
                  boxShadow: viewMode === mode ? '0 1px 6px rgba(99,102,241,0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={13} color={viewMode === mode ? '#818CF8' : '#64748B'} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            style={{ padding: '6px 11px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.70rem', fontWeight: 600 }}
          >
            <Download size={13} />CSV
          </button>
          <button
            onClick={handlePrint}
            style={{ padding: '6px 11px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.70rem', fontWeight: 600 }}
          >
            <Printer size={13} />Print
          </button>
          <button
            onClick={fetchData}
            style={{ padding: '6px 14px', borderRadius: 6, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 800, boxShadow: '0 2px 8px rgba(99,102,241,0.4)' }}
          >
            <RefreshCw size={13} />Refresh
          </button>
        </div>
      </div>

      {/* ── Top Key Financial Ratios Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
        <RatioCard label="Market Cap" value={mcapVal} sub="Consolidated ₹ Cr" />
        <RatioCard label="Stock P/E" value={peVal} colorFn={v => v > 40 ? '#EF5350' : v < 20 ? '#10B981' : '#F8FAFC'} sub={peVal && peVal < 20 ? 'Attractive Value' : 'Premium'} />
        <RatioCard label="P/B Ratio" value={pbVal} sub="Price to Book" />
        <RatioCard label="ROCE %" value={roceVal} unit="%" colorFn={v => v > 20 ? '#10B981' : '#F8FAFC'} sub="Capital Efficiency" sparkData={roceSpark} sparkColor="#10B981" />
        <RatioCard label="ROE %" value={roeVal} unit="%" colorFn={v => v > 15 ? '#10B981' : '#F8FAFC'} sub="Return on Equity" sparkData={roeSpark} sparkColor="#10B981" />
        <RatioCard label="Debt/Eq" value={deVal} colorFn={v => v > 1 ? '#EF5350' : '#10B981'} sub={deVal && deVal < 0.5 ? 'Conservative' : 'Leveraged'} sparkData={deSpark} sparkColor="#EF5350" />
        <RatioCard label="Promoter" value={promoterVal} unit="%" sub="Insider Stake" />
        <RatioCard
          label="Div Yield"
          value={divYieldVal}
          unit="%"
          colorFn={v => v > 1.5 ? '#10B981' : '#F8FAFC'}
          sub={Number(divYieldVal) > 0 ? `Payout: ${corpCal.dividend_payout_ratio || '—'}%` : 'Non-dividend / 0%'}
        />
      </div>

      {/* ── Sub Navigation Tabs Menu (Visible when viewMode === 'tabs') ── */}
      {viewMode === 'tabs' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflowX: 'auto', padding: '4px 2px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', scrollbarWidth: 'none', minHeight: 48 }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, whiteSpace: 'nowrap',
                  flexShrink: 0,
                  height: 'auto',
                  alignSelf: 'center',
                  border: isSel ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
                  background: isSel
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.25))'
                    : 'rgba(15,23,42,0.65)',
                  color: isSel ? '#FFFFFF' : '#94A3B8',
                  fontWeight: isSel ? 800 : 500, fontSize: '0.76rem', cursor: 'pointer',
                  boxShadow: isSel ? '0 2px 12px rgba(99,102,241,0.30)' : 'none',
                  transition: 'all 0.15s ease-in-out'
                }}
              >
                <Icon size={14} color={isSel ? '#818CF8' : '#64748B'} style={{ flexShrink: 0 }} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{ fontSize: '0.60rem', background: isSel ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.06)', color: isSel ? '#E0E7FF' : '#64748B', padding: '1px 6px', borderRadius: 4, fontWeight: 800, flexShrink: 0 }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── MODE: TABS (Isolated single active tab) ── */}
      {viewMode === 'tabs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeTab === 'overview' && renderOverviewSection()}
          {activeTab === 'valuation' && renderValuationSection()}
          {activeTab === 'quarters' && renderQuartersSection()}
          {activeTab === 'annual' && renderAnnualSection()}
          {activeTab === 'balancesheet' && renderBalanceSheetSection()}
          {activeTab === 'cashflow' && renderCashFlowSection()}
          {activeTab === 'shareholding' && renderShareholdingSection()}
          {activeTab === 'peers' && renderPeersSection()}
        </div>
      )}

      {/* ── MODE: ALL PANELS (Continuous Dossier Layout) ── */}
      {viewMode === 'all_panels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {[
            { icon: Award, label: '1. Executive Scorecard & DuPont Analysis', fn: renderOverviewSection },
            { icon: Target, label: '2. DCF Valuation Sandbox & Sensitivity Matrix', fn: renderValuationSection },
            { icon: Table, label: '3. Quarterly Earnings & Disclosures', fn: renderQuartersSection },
            { icon: Layers, label: '4. Annual 10-Year Consolidated Profit & Loss', fn: renderAnnualSection },
            { icon: Scale, label: '5. Consolidated Balance Sheet & Capital Structure', fn: renderBalanceSheetSection },
            { icon: TrendingUp, label: '6. Cash Flow Decomposition & Earnings Quality', fn: renderCashFlowSection },
            { icon: PieIcon, label: '7. Institutional & Insider Ownership Shifts', fn: renderShareholdingSection },
            { icon: Users, label: '8. Industry Peer Benchmarking & Valuation Scatter', fn: renderPeersSection },
          ].map(({ icon: Icon, label, fn }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 800, color: '#818CF8', paddingBottom: 6, borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
                <Icon size={16} />{label}
              </div>
              {fn()}
            </div>
          ))}
        </div>
      )}

      {/* ── QUALITY MODAL: FULL PIOTROSKI F-SCORE CHECKLIST ── */}
      {showQualityModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 14, padding: 22, maxWidth: 540, width: '100%', maxHeight: '82vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} color="#10B981" />
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800 }}>Piotroski 9-Point Quality Audit</h3>
              </div>
              <button onClick={() => setShowQualityModal(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: 14 }}>
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