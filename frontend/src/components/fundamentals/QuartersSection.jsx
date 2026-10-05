import {
  TrendingUp,
  TrendingDown,
  Table,
  Download
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ReferenceLine
} from 'recharts';
import { cardStyle, labelStyle, valueStyle } from './styles';
import { GrowthPill, EmptyState } from './Primitives';

export default function QuartersSection({
  summaryStats,
  displayedQuarters,
  sortedTableData,
  sortField,
  sortAsc,
  toggleSort,
  setQTimeframe,
  qTimeframe,
  handleExportQuarterlyCSV,
}) {
    const latestQ = summaryStats?.latest;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {displayedQuarters.length > 0 ? (
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
                <div style={{ fontSize: '0.62rem', color: '#94A3B8', marginTop: 6 }}>Mean sequential top-line momentum across {displayedQuarters.length} quarters</div>
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
                <ComposedChart data={displayedQuarters} margin={{ top: 10, right: 15, bottom: 0, left: -10 }}>
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
                  <BarChart data={displayedQuarters} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} tickFormatter={v => `${v}%`} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#F0F0FF', fontSize: '0.72rem' }} formatter={(v, n) => [`${v != null ? `${v >= 0 ? '+' : ''}${v}%` : '—'}`, n]} />
                    <Bar dataKey="revQoQ" name="Revenue QoQ %" fill="#6366F1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="profitQoQ" name="Profit QoQ %" radius={[3, 3, 0, 0]}>
                      {displayedQuarters.map((entry, idx) => (
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
                  <LineChart data={displayedQuarters} margin={{ top: 10, right: 15, bottom: 0, left: -20 }}>
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

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.45)', borderRadius: 6, padding: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
                    {[
                      ['all', 'All Quarters'],
                      ['8q', 'Last 8Q'],
                      ['4q', 'Last 4Q']
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setQTimeframe(key)}
                        style={{
                          padding: '4px 9px',
                          borderRadius: 4,
                          border: 'none',
                          background: qTimeframe === key ? 'rgba(99,102,241,0.35)' : 'transparent',
                          color: qTimeframe === key ? '#FFFFFF' : '#94A3B8',
                          fontSize: '0.66rem',
                          fontWeight: qTimeframe === key ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
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
}
