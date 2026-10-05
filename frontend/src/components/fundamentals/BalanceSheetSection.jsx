import {
  Scale
} from 'lucide-react';
import { cardStyle } from './styles';
import { EmptyState } from './Primitives';

export default function BalanceSheetSection({
  balanceSheet,
}) {
  return (
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
}
