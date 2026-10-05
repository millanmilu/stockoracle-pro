import {
  BarChart2,
  Users
} from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ResponsiveContainer
} from 'recharts';
import { cardStyle } from './styles';
import { EmptyState } from './Primitives';

export default function PeersSection({
  peers,
  ticker,
}) {
  return (
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
                      <td style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: p.name?.includes(ticker) ? '#818CF8' : '#F0F0FF' }}>
                        {p.name || p.ticker || '—'} {p.name?.includes(ticker) && ' ★'}
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
}
