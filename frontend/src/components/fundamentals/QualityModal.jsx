import { ShieldCheck, X } from 'lucide-react';

export default function QualityModal({
  piotroski,
  setShowQualityModal,
}) {
  return (
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
              Score: <strong style={{ color: piotroski.score == null ? '#94A3B8' : piotroski.score >= 7 ? '#10B981' : '#F59E0B' }}>{piotroski.score != null ? `${piotroski.score}/9 (${piotroski.rating})` : piotroski.rating}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {piotroski.criteria?.length > 0 ? (
                piotroski.criteria.map((c, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.passed == null ? 'rgba(148,163,184,0.25)' : c.passed ? 'rgba(16,185,129,0.22)' : 'rgba(239,83,80,0.22)'}`, borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <strong style={{ fontSize: '0.76rem', color: '#F8FAFC' }}>{idx + 1}. {c.name}</strong>
                      <span style={{ fontSize: '0.66rem', fontWeight: 800, color: c.passed == null ? '#94A3B8' : c.passed ? '#10B981' : '#EF5350' }}>{c.passed == null ? '— NOT EVALUABLE' : c.passed ? '✓ PASS (+1)' : '✗ FAIL (0)'}</span>
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
  );
}
