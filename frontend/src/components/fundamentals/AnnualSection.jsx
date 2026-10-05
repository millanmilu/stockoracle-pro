import {
  Layers
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { cardStyle } from './styles';
import { EmptyState } from './Primitives';

export default function AnnualSection({
  annualPl,
  aTimeframe,
  setATimeframe,
}) {
  return (
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

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.45)', borderRadius: 6, padding: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
              {[
                ['10y', '10 Years'],
                ['5y', '5 Years'],
                ['3y', '3 Years']
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setATimeframe(key)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: 4,
                    border: 'none',
                    background: aTimeframe === key ? 'rgba(99,102,241,0.35)' : 'transparent',
                    color: aTimeframe === key ? '#FFFFFF' : '#94A3B8',
                    fontSize: '0.66rem',
                    fontWeight: aTimeframe === key ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {label}
                </button>
              ))}
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
}
