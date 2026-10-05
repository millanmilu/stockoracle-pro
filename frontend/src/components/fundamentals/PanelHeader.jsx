import {
  Award,
  LayoutGrid,
  FileText,
  Download,
  Printer,
  RefreshCw
} from 'lucide-react';

export default function PanelHeader({
  deepData,
  ticker,
  piotroski,
  altman,
  viewMode,
  setViewMode,
  handleExportCSV,
  handlePrint,
  fetchData,
}) {
  return (
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
              <span style={{ fontSize: '0.64rem', background: piotroski.score == null ? 'rgba(148,163,184,0.12)' : piotroski.score >= 7 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: piotroski.score == null ? '#94A3B8' : piotroski.score >= 7 ? '#10B981' : '#F59E0B', border: `1px solid ${piotroski.score == null ? 'rgba(148,163,184,0.3)' : piotroski.score >= 7 ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`, padding: '2px 8px', borderRadius: 5, fontWeight: 800 }}>
                Piotroski: {piotroski.score != null ? `${piotroski.score}/9` : '—'}
              </span>
              <span style={{ fontSize: '0.64rem', background: altman.z_score == null ? 'rgba(148,163,184,0.12)' : altman.z_score >= 2.99 ? 'rgba(16,185,129,0.12)' : 'rgba(239,83,80,0.12)', color: altman.z_score == null ? '#94A3B8' : altman.z_score >= 2.99 ? '#10B981' : '#EF5350', border: `1px solid ${altman.z_score == null ? 'rgba(148,163,184,0.3)' : altman.z_score >= 2.99 ? 'rgba(16,185,129,0.3)' : 'rgba(239,83,80,0.3)'}`, padding: '2px 8px', borderRadius: 5, fontWeight: 800 }}>
                Z-Score: {altman.z_score != null ? altman.z_score : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: '0.63rem', color: '#64748B' }}>
              {/* Never name a source we did not actually read. The old fallback
                  asserted "Screener.in Consolidated + NSE" whenever the field was
                  missing — i.e. exactly when nothing had been fetched. */}
              <span>Source: <strong style={{ color: '#94A3B8' }}>{deepData?.data_freshness?.data_source || 'Unknown'}</strong></span>
              <span>•</span>
              <span>Updated: <strong style={{ color: '#94A3B8' }}>{deepData?.data_freshness?.last_updated || 'Unknown'}</strong></span>
              {deepData?.data_freshness?.status && deepData.data_freshness.status !== 'Verified' && (
                <>
                  <span>•</span>
                  <span style={{ color: '#F59E0B' }}>{deepData.data_freshness.status}</span>
                </>
              )}
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
  );
}
