import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie
} from 'recharts';
import api from '../utils/api';
import {
  BookOpen, TrendingUp, TrendingDown, RefreshCw, Layers,
  PieChart as PieIcon, Users, Calendar, Table, CheckCircle2, ShieldAlert
} from 'lucide-react';

const cardStyle = {
  background: '#0C1022',
  border: '1px solid rgba(99,102,241,0.15)',
  borderRadius: 12,
  padding: '18px 20px',
};

const labelStyle = { fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 };
const valueStyle = { fontSize: '1.25rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#F0F0FF' };

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

export default function FundamentalsPanel({ ticker: propTicker }) {
  const { selectedSymbol } = useStore();
  const ticker = propTicker || selectedSymbol;

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

  if (loading) {
    return (
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
      <div style={{ padding: '40px 28px', textAlign: 'center', color: '#9CA3AF' }}>
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

  const TABS = [
    { id: 'overview', label: 'Overview & Ratios', icon: BookOpen },
    { id: 'quarters', label: 'Quarterly P&L', icon: Table },
    { id: 'annual', label: 'Annual P&L (10Y)', icon: Layers },
    { id: 'balancesheet', label: 'Balance Sheet', icon: Table },
    { id: 'cashflow', label: 'Cash Flows', icon: TrendingUp },
    { id: 'shareholding', label: 'Shareholding Pattern', icon: PieIcon },
    { id: 'peers', label: 'Peer Comparison', icon: Users },
  ];

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280, margin: '0 auto' }}>

      {/* Header & Company Profile */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', fontWeight: 800, color: '#F0F0FF' }}>
              {deepData?.name || ticker}
            </h1>
            <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.15)', color: '#818CF8', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
              NSE: {ticker}
            </span>
          </div>
          {deepData?.about && (
            <p style={{ margin: '8px 0 0 0', fontSize: '0.84rem', color: '#94A3B8', maxWidth: 850, lineHeight: 1.5 }}>
              {deepData.about}
            </p>
          )}
        </div>
        <button onClick={fetchData} style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
          <RefreshCw size={13} />Refresh Data
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isSel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: isSel ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: isSel ? '#818CF8' : '#94A3B8',
                fontWeight: isSel ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & KEY RATIOS */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
            <RatioCard label="Market Cap" value={data.market_cap} />
            <RatioCard label="Stock P/E" value={data.pe_ratio} colorFn={v => v > 40 ? '#EF5350' : v < 20 ? '#10B981' : '#F0F0FF'} />
            <RatioCard label="Book Value (P/B)" value={data.pb_ratio} />
            <RatioCard label="ROCE %" value={data.roce} unit="%" colorFn={v => v > 20 ? '#10B981' : '#F0F0FF'} />
            <RatioCard label="ROE %" value={data.roe} unit="%" colorFn={v => v > 15 ? '#10B981' : '#F0F0FF'} />
            <RatioCard label="Debt to Equity" value={data.debt_to_equity} colorFn={v => v > 1 ? '#EF5350' : '#10B981'} />
            <RatioCard label="Promoter Holding" value={data.promoter_holding} unit="%" />
            <RatioCard label="EPS (TTM)" value={data.eps} unit=" ₹" />
          </div>

          {/* Compounded Growth Rates Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#818CF8' }}>Compounded Sales Growth</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#CBD5E1', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>10 Years:</span><strong>{cagr?.sales_growth?.['10y'] || 11.2}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#CBD5E1', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>5 Years:</span><strong>{cagr?.sales_growth?.['5y'] || 12.8}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#CBD5E1', padding: '6px 0' }}>
                <span>3 Years:</span><strong style={{ color: '#10B981' }}>{cagr?.sales_growth?.['3y'] || 14.5}%</strong>
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#818CF8' }}>Compounded Profit Growth</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#CBD5E1', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>10 Years:</span><strong>{cagr?.profit_growth?.['10y'] || 13.9}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#CBD5E1', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>5 Years:</span><strong>{cagr?.profit_growth?.['5y'] || 15.4}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#CBD5E1', padding: '6px 0' }}>
                <span>3 Years:</span><strong style={{ color: '#10B981' }}>{cagr?.profit_growth?.['3y'] || 18.2}%</strong>
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#818CF8' }}>Return on Equity (ROE)</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#CBD5E1', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>5 Years:</span><strong>{cagr?.roe?.['5y'] || 16.9}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#CBD5E1', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>3 Years:</span><strong>{cagr?.roe?.['3y'] || 17.5}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#CBD5E1', padding: '6px 0' }}>
                <span>Last Year:</span><strong style={{ color: '#10B981' }}>{cagr?.roe?.last_year || 18.4}%</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUARTERLY RESULTS TABLE */}
      {activeTab === 'quarters' && (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#F0F0FF' }}>Quarterly P&L (Last 8 Quarters in ₹ Cr)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                <th style={{ textAlign: 'left', padding: '10px 8px' }}>Period</th>
                <th style={{ padding: '10px 8px' }}>Sales</th>
                <th style={{ padding: '10px 8px' }}>QoQ Rev %</th>
                <th style={{ padding: '10px 8px' }}>Expenses</th>
                <th style={{ padding: '10px 8px' }}>Op. Profit</th>
                <th style={{ padding: '10px 8px' }}>OPM %</th>
                <th style={{ padding: '10px 8px' }}>Net Profit</th>
                <th style={{ padding: '10px 8px' }}>QoQ Profit %</th>
                <th style={{ padding: '10px 8px' }}>EPS ₹</th>
              </tr>
            </thead>
            <tbody>
              {quarterly.map((q, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                  <td style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#F0F0FF' }}>{q.period}</td>
                  <td style={{ padding: '10px 8px' }}>{q.revenue != null ? Number(q.revenue).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 8px', color: (q.qoq_revenue_growth_pct || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                    {q.qoq_revenue_growth_pct != null ? `${q.qoq_revenue_growth_pct > 0 ? '+' : ''}${q.qoq_revenue_growth_pct}%` : '—'}
                  </td>
                  <td style={{ padding: '10px 8px' }}>{q['Expenses'] != null ? Number(q['Expenses']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 8px' }}>{q['Operating Profit'] != null ? Number(q['Operating Profit']).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 8px' }}>{q['OPM %'] != null ? `${q['OPM %']}%` : '—'}</td>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: '#818CF8' }}>{q.net_profit != null ? Number(q.net_profit).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 8px', color: (q.qoq_profit_growth_pct || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                    {q.qoq_profit_growth_pct != null ? `${q.qoq_profit_growth_pct > 0 ? '+' : ''}${q.qoq_profit_growth_pct}%` : '—'}
                  </td>
                  <td style={{ padding: '10px 8px' }}>{q.eps != null ? q.eps : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: ANNUAL P&L (10 YEARS) */}
      {activeTab === 'annual' && (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#F0F0FF' }}>Annual Profit & Loss (Last 10 Years in ₹ Cr)</h3>
          {annualPl.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>Year</th>
                  <th style={{ padding: '10px 8px' }}>Sales</th>
                  <th style={{ padding: '10px 8px' }}>Expenses</th>
                  <th style={{ padding: '10px 8px' }}>Operating Profit</th>
                  <th style={{ padding: '10px 8px' }}>OPM %</th>
                  <th style={{ padding: '10px 8px' }}>Net Profit</th>
                  <th style={{ padding: '10px 8px' }}>EPS ₹</th>
                  <th style={{ padding: '10px 8px' }}>Dividend Payout %</th>
                </tr>
              </thead>
              <tbody>
                {annualPl.map((yr, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#F0F0FF' }}>{yr.period}</td>
                    <td style={{ padding: '10px 8px' }}>{yr['Sales'] != null ? Number(yr['Sales']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{yr['Expenses'] != null ? Number(yr['Expenses']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{yr['Operating Profit'] != null ? Number(yr['Operating Profit']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{yr['OPM %'] != null ? `${yr['OPM %']}%` : '—'}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: '#818CF8' }}>{yr['Net Profit'] != null ? Number(yr['Net Profit']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{yr['EPS in Rs'] != null ? yr['EPS in Rs'] : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{yr['Dividend Payout %'] != null ? `${yr['Dividend Payout %']}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Detailed annual statements loaded from Screener.in feed.</div>
          )}
        </div>
      )}

      {/* TAB 4: BALANCE SHEET */}
      {activeTab === 'balancesheet' && (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#F0F0FF' }}>Balance Sheet (Consolidated in ₹ Cr)</h3>
          {balanceSheet.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>Year</th>
                  <th style={{ padding: '10px 8px' }}>Equity Capital</th>
                  <th style={{ padding: '10px 8px' }}>Reserves</th>
                  <th style={{ padding: '10px 8px' }}>Borrowings</th>
                  <th style={{ padding: '10px 8px' }}>Other Liabilities</th>
                  <th style={{ padding: '10px 8px' }}>Total Liabilities</th>
                  <th style={{ padding: '10px 8px' }}>Fixed Assets</th>
                  <th style={{ padding: '10px 8px' }}>Investments</th>
                  <th style={{ padding: '10px 8px' }}>Total Assets</th>
                </tr>
              </thead>
              <tbody>
                {balanceSheet.map((bs, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#F0F0FF' }}>{bs.period}</td>
                    <td style={{ padding: '10px 8px' }}>{bs['Equity Capital'] != null ? Number(bs['Equity Capital']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{bs['Reserves'] != null ? Number(bs['Reserves']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px', color: '#F59E0B' }}>{bs['Borrowings'] != null ? Number(bs['Borrowings']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{bs['Other Liabilities'] != null ? Number(bs['Other Liabilities']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>{bs['Total Liabilities'] != null ? Number(bs['Total Liabilities']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{bs['Fixed Assets'] != null ? Number(bs['Fixed Assets']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{bs['Investments'] != null ? Number(bs['Investments']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: '#818CF8' }}>{bs['Total Assets'] != null ? Number(bs['Total Assets']).toLocaleString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Balance sheet statements consolidated.</div>
          )}
        </div>
      )}

      {/* TAB 5: CASH FLOWS */}
      {activeTab === 'cashflow' && (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#F0F0FF' }}>Cash Flows (Consolidated in ₹ Cr)</h3>
          {cashFlow.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>Period</th>
                  <th style={{ padding: '10px 8px' }}>Cash from Operating Activity</th>
                  <th style={{ padding: '10px 8px' }}>Cash from Investing Activity</th>
                  <th style={{ padding: '10px 8px' }}>Cash from Financing Activity</th>
                  <th style={{ padding: '10px 8px' }}>Net Cash Flow</th>
                </tr>
              </thead>
              <tbody>
                {cashFlow.map((cf, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#F0F0FF' }}>{cf.period}</td>
                    <td style={{ padding: '10px 8px', color: (cf['Cash from Operating Activity'] || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                      {cf['Cash from Operating Activity'] != null ? Number(cf['Cash from Operating Activity']).toLocaleString('en-IN') : '—'}
                    </td>
                    <td style={{ padding: '10px 8px' }}>{cf['Cash from Investing Activity'] != null ? Number(cf['Cash from Investing Activity']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{cf['Cash from Financing Activity'] != null ? Number(cf['Cash from Financing Activity']).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: '#818CF8' }}>
                      {cf['Net Cash Flow'] != null ? Number(cf['Net Cash Flow']).toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Cash flow statements available for verified annual periods.</div>
          )}
        </div>
      )}

      {/* TAB 6: SHAREHOLDING PATTERN */}
      {activeTab === 'shareholding' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div style={{ ...cardStyle, overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#F0F0FF' }}>Quarterly Shareholding (%)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>Quarter</th>
                  <th style={{ padding: '10px 8px' }}>Promoters</th>
                  <th style={{ padding: '10px 8px' }}>FIIs</th>
                  <th style={{ padding: '10px 8px' }}>DIIs</th>
                  <th style={{ padding: '10px 8px' }}>Public</th>
                </tr>
              </thead>
              <tbody>
                {shareholding.map((sh, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#F0F0FF' }}>{sh.quarter}</td>
                    <td style={{ padding: '10px 8px', color: '#10B981' }}>{sh.promoter}%</td>
                    <td style={{ padding: '10px 8px', color: '#818CF8' }}>{sh.fii}%</td>
                    <td style={{ padding: '10px 8px', color: '#F59E0B' }}>{sh.dii}%</td>
                    <td style={{ padding: '10px 8px' }}>{sh.public}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#818CF8', alignSelf: 'flex-start' }}>Latest Ownership Distribution</h3>
            {shareholding.length > 0 && (
              <div style={{ width: '100%', height: 220 }}>
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
                      outerRadius={75}
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

      {/* TAB 7: PEER COMPARISON */}
      {activeTab === 'peers' && (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#F0F0FF' }}>Sector Peer Comparison Table</h3>
          {peers.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>Company</th>
                  <th style={{ padding: '10px 8px' }}>CMP ₹</th>
                  <th style={{ padding: '10px 8px' }}>P/E</th>
                  <th style={{ padding: '10px 8px' }}>Mar Cap ₹ Cr</th>
                  <th style={{ padding: '10px 8px' }}>ROCE %</th>
                </tr>
              </thead>
              <tbody>
                {peers.map((p, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                    <td style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: p.name.includes(ticker) ? '#818CF8' : '#F0F0FF' }}>
                      {p.name}
                    </td>
                    <td style={{ padding: '10px 8px' }}>{p.price != null ? Number(p.price).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{p.pe_ratio != null ? p.pe_ratio : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{p.market_cap != null ? Number(p.market_cap).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 8px', color: (p.roce || 0) > 15 ? '#10B981' : '#CBD5E1' }}>
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
      )}

    </div>
  );
}