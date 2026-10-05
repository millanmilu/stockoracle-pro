import {
  Zap,
  PieChart as PieIcon
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell
} from 'recharts';
import { cardStyle, labelStyle } from './styles';
import { GrowthPill, EmptyState } from './Primitives';

export default function ShareholdingSection({
  ownershipDelta,
  shareholding,
}) {
  return (
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
              {(() => {
                const latest = shareholding[shareholding.length - 1] || {};
                const COLORS = { Promoters: '#10B981', FIIs: '#818CF8', DIIs: '#F59E0B', Public: '#64748B' };
                // Skip null slices so missing holders never render as 0% wedges.
                const pieData = [
                  { name: 'Promoters', value: latest.promoter },
                  { name: 'FIIs', value: latest.fii },
                  { name: 'DIIs', value: latest.dii },
                  { name: 'Public', value: latest.public },
                ].filter(s => s.value != null && !isNaN(Number(s.value)));
                if (pieData.length === 0) {
                  return <div style={{ fontSize: '0.72rem', color: '#64748B', padding: '40px 0' }}>—</div>;
                }
                return (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={65}
                        label={({ name, value }) => `${name} ${value}%`}
                      >
                        {pieData.map((s, i) => (
                          <Cell key={i} fill={COLORS[s.name] || '#94A3B8'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
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
}
