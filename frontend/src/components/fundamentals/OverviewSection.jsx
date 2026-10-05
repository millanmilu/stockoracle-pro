import {
  ShieldCheck,
  Scale,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { cardStyle, labelStyle, valueStyle } from './styles';

export default function OverviewSection({
  piotroski,
  altman,
  setShowQualityModal,
  annualPl,
  cashFlow,
  dupontData,
  cagr,
  roceVal,
  deVal,
  promoterVal,
  peVal,
  ownershipDelta,
}) {
  return (
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
            <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: piotroski.score == null ? '#94A3B8' : piotroski.score >= 7 ? '#10B981' : piotroski.score >= 4 ? '#F59E0B' : '#EF5350' }}>
              {piotroski.score != null ? `${piotroski.score}/9` : '—'}
            </span>
          </div>
          <div style={{ fontSize: '0.64rem', color: '#94A3B8', marginBottom: 8 }}>Rating: <strong style={{ color: piotroski.score == null ? '#94A3B8' : piotroski.score >= 7 ? '#10B981' : '#F59E0B' }}>{piotroski.rating}</strong></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(piotroski.criteria || []).slice(0, 3).map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#CBD5E1' }}>
                <span>{c.name}</span>
                <span style={{ color: c.passed == null ? '#64748B' : c.passed ? '#10B981' : '#EF5350', fontWeight: 700 }}>{c.passed == null ? '— N/A' : c.passed ? '✓ PASS' : '✗ FAIL'}</span>
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
            <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: altman.z_score == null ? '#94A3B8' : altman.z_score >= 2.99 ? '#10B981' : altman.z_score >= 1.81 ? '#F59E0B' : '#EF5350' }}>
              {altman.z_score != null ? altman.z_score : '—'}
            </span>
          </div>
          <div style={{ fontSize: '0.64rem', color: '#94A3B8', marginBottom: 8 }}>Zone: <strong style={{ color: altman.z_score == null ? '#94A3B8' : altman.z_score >= 2.99 ? '#10B981' : '#F59E0B' }}>{altman.zone}</strong></div>
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

      {/* ── Executive Moats & Watchlist Flags (computed from reported ratios) ── */}
      {(() => {
        const moats = [];
        const risks = [];
        const num = (v) => (v != null && !isNaN(Number(v)) ? Number(v) : null);
        const roce = num(roceVal);
        const de = num(deVal);
        const sales3y = num(cagr?.sales_growth?.['3y']);
        const profit3y = num(cagr?.profit_growth?.['3y']);
        const lastNP = annualPl.length ? num(annualPl[annualPl.length - 1]['Net Profit']) : null;
        const lastCFO = cashFlow.length ? num(cashFlow[cashFlow.length - 1]['Cash from Operating Activity']) : null;

        if (roce != null && roce > 15) moats.push(<>Capital Return Superiority: ROCE of <strong>{roce}%</strong> exceeds cost of capital.</>);
        if (de != null && de < 0.5) moats.push(<>Conservative Balance Sheet: Debt-to-Equity of <strong>{de}</strong>.</>);
        if (sales3y != null && sales3y > 0) moats.push(<>Revenue Compounding: <strong>{sales3y >= 0 ? '+' : ''}{sales3y}%</strong> sales CAGR (3Y).</>);
        if (profit3y != null && profit3y > 10) moats.push(<>Profit Compounding: <strong>+{profit3y}%</strong> profit CAGR (3Y).</>);
        if (lastCFO != null && lastNP != null && lastNP > 0 && lastCFO >= lastNP) moats.push(<>High Cash Conversion: operating cash flow covers accounting net profit.</>);
        if (piotroski.score != null && piotroski.score >= 7) moats.push(<>Elite Quality Audit: Piotroski score of <strong>{piotroski.score}/9</strong>.</>);
        if (altman.z_score != null && altman.zone === 'Safe Zone') moats.push(<>Audited Solvency: Altman Z-Score of <strong>{altman.z_score}</strong> (Safe Zone).</>);
        if (promoterVal != null && num(promoterVal) >= 50) moats.push(<>High Insider Conviction: promoter stake of <strong>{promoterVal}%</strong>.</>);

        if (de != null && de > 1) risks.push(<>Elevated Leverage: Debt-to-Equity of <strong>{de}</strong> exceeds 1.0.</>);
        if (roce != null && roce < 10) risks.push(<>Weak Capital Efficiency: ROCE of <strong>{roce}%</strong> below 10%.</>);
        if (profit3y != null && profit3y < 0) risks.push(<>Contracting Profits: 3Y profit CAGR of <strong>{profit3y}%</strong>.</>);
        if (sales3y != null && sales3y < 0) risks.push(<>Shrinking Revenue: 3Y sales CAGR of <strong>{sales3y}%</strong>.</>);
        if (piotroski.score != null && piotroski.score < 5) risks.push(<>Quality Warning: Piotroski score of <strong>{piotroski.score}/9</strong>.</>);
        if (altman.z_score != null && altman.zone !== 'Safe Zone') risks.push(<>Solvency Watch: Altman Z-Score of <strong>{altman.z_score}</strong> ({altman.zone}).</>);
        if (ownershipDelta?.dFii != null && ownershipDelta.dFii < -0.5) risks.push(<>FII Outflow: foreign holding fell <strong>{ownershipDelta.dFii}pp</strong> last quarter.</>);
        if (peVal != null && num(peVal) > 40) risks.push(<>Rich Valuation: P/E of <strong>{peVal}</strong> demands flawless execution.</>);

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
            <div style={{ ...cardStyle, border: '1px solid rgba(16,185,129,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 800, color: '#10B981', marginBottom: 8 }}>
                <CheckCircle2 size={16} /> Business Moats & Fundamental Strengths
              </div>
              {moats.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.70rem', color: '#CBD5E1' }}>
                  {moats.map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6 }}>
                      <span style={{ color: '#10B981' }}>•</span>
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.68rem', color: '#64748B' }}>No significant strength flags from reported data.</div>
              )}
            </div>

            <div style={{ ...cardStyle, border: '1px solid rgba(245,158,11,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 800, color: '#F59E0B', marginBottom: 8 }}>
                <AlertTriangle size={16} /> Risk Factors & Valuation Watchlist
              </div>
              {risks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.70rem', color: '#CBD5E1' }}>
                  {risks.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6 }}>
                      <span style={{ color: '#F59E0B' }}>•</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.68rem', color: '#64748B' }}>No significant risk flags from reported data.</div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
