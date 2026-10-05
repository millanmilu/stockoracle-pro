import { useState } from 'react';
import useStore from '../../store/useStore';
import {
  BookOpen, RefreshCw, Layers, PieChart as PieIcon, Users,
  Table, Scale, TrendingUp, Award, Target
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cardStyle } from './styles';
import { RatioCard } from './Primitives';
import { useFundamentalsData } from './useFundamentalsData';
import { useDerivedMetrics } from './useDerivedMetrics';
import PanelHeader from './PanelHeader';
import PanelTabs from './PanelTabs';
import QualityModal from './QualityModal';
import OverviewSection from './OverviewSection';
import ValuationSection from './ValuationSection';
import QuartersSection from './QuartersSection';
import AnnualSection from './AnnualSection';
import BalanceSheetSection from './BalanceSheetSection';
import CashFlowSection from './CashFlowSection';
import ShareholdingSection from './ShareholdingSection';
import PeersSection from './PeersSection';

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

  const {
    dcfGrowthRate, setDcfGrowthRate,
    dcfWacc, setDcfWacc,
    dcfTerminalGrowth, setDcfTerminalGrowth,
    data, deepData, loading, error, fetchData,
  } = useFundamentalsData(ticker);

  const [showQualityModal, setShowQualityModal] = useState(false);

  // Sorting state for quarterly statements table
  const [sortField, setSortField] = useState('idx');
  const [sortAsc, setSortAsc] = useState(true);

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

  const {
    enrichedQuarters,
    displayedQuarters,
    summaryStats,
    sortedTableData,
    annualPl,
    balanceSheet,
    cashFlow,
    shareholding,
    peers,
    cagr,
    piotroski,
    altman,
    corpCal,
    roceSpark,
    roeSpark,
    deSpark,
    peVal,
    pbVal,
    roceVal,
    roeVal,
    deVal,
    promoterVal,
    mcapVal,
    divYieldVal,
    dupontData,
    liveDcf,
    ownershipDelta,
  } = useDerivedMetrics({
    data, deepData, ticker, qTimeframe, aTimeframe, sortField, sortAsc,
    dcfGrowthRate, dcfWacc, dcfTerminalGrowth,
  });

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

  // Graceful degradation: render whenever EITHER endpoint succeeded so working
  // tabs stay usable during a partial outage. Full error only when both failed.
  if (error || (!data && !deepData)) {
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

  const sectionProps = {
    ticker,
    piotroski,
    altman,
    cagr,
    dupontData,
    roceVal,
    deVal,
    promoterVal,
    peVal,
    ownershipDelta,
    annualPl,
    cashFlow,
    balanceSheet,
    shareholding,
    peers,
    summaryStats,
    displayedQuarters,
    sortedTableData,
    sortField,
    sortAsc,
    toggleSort,
    setQTimeframe,
    qTimeframe,
    handleExportQuarterlyCSV,
    aTimeframe,
    setATimeframe,
    liveDcf,
    dcfGrowthRate,
    setDcfGrowthRate,
    dcfWacc,
    setDcfWacc,
    dcfTerminalGrowth,
    setDcfTerminalGrowth,
    setShowQualityModal,
  };

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

      <PanelHeader
        deepData={deepData} ticker={ticker} piotroski={piotroski} altman={altman}
        viewMode={viewMode} setViewMode={setViewMode}
        handleExportCSV={handleExportCSV} handlePrint={handlePrint} fetchData={fetchData}
      />

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
        <PanelTabs TABS={TABS} activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {/* ── MODE: TABS (Isolated single active tab) ── */}
      {viewMode === 'tabs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeTab === 'overview' && <OverviewSection {...sectionProps} />}
          {activeTab === 'valuation' && <ValuationSection {...sectionProps} />}
          {activeTab === 'quarters' && <QuartersSection {...sectionProps} />}
          {activeTab === 'annual' && <AnnualSection {...sectionProps} />}
          {activeTab === 'balancesheet' && <BalanceSheetSection {...sectionProps} />}
          {activeTab === 'cashflow' && <CashFlowSection {...sectionProps} />}
          {activeTab === 'shareholding' && <ShareholdingSection {...sectionProps} />}
          {activeTab === 'peers' && <PeersSection {...sectionProps} />}
        </div>
      )}

      {/* ── MODE: ALL PANELS (Continuous Dossier Layout) ── */}
      {viewMode === 'all_panels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {[
            { icon: Award, label: '1. Executive Scorecard & DuPont Analysis', Component: OverviewSection },
            { icon: Target, label: '2. DCF Valuation Sandbox & Sensitivity Matrix', Component: ValuationSection },
            { icon: Table, label: '3. Quarterly Earnings & Disclosures', Component: QuartersSection },
            { icon: Layers, label: '4. Annual 10-Year Consolidated Profit & Loss', Component: AnnualSection },
            { icon: Scale, label: '5. Consolidated Balance Sheet & Capital Structure', Component: BalanceSheetSection },
            { icon: TrendingUp, label: '6. Cash Flow Decomposition & Earnings Quality', Component: CashFlowSection },
            { icon: PieIcon, label: '7. Institutional & Insider Ownership Shifts', Component: ShareholdingSection },
            { icon: Users, label: '8. Industry Peer Benchmarking & Valuation Scatter', Component: PeersSection },
          ].map(({ icon: Icon, label, Component }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 800, color: '#818CF8', paddingBottom: 6, borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
                <Icon size={16} />{label}
              </div>
              <Component {...sectionProps} />
            </div>
          ))}
        </div>
      )}

      {/* ── QUALITY MODAL: FULL PIOTROSKI F-SCORE CHECKLIST ── */}

      {showQualityModal && (
        <QualityModal piotroski={piotroski} setShowQualityModal={setShowQualityModal} />
      )}

    </div>
  );
}
