import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  ShieldAlert, RefreshCw, Activity, TrendingUp, AlertTriangle,
  Scale, Grid3X3, Percent, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function QuantRiskCockpit() {
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portfolioVal, setPortfolioVal] = useState(1000000);

  const fetchRisk = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/portfolio/risk-cockpit', {
        portfolio_value: portfolioVal,
      });
      setRiskData(data);
    } catch {
      toast.error('Failed to compute portfolio quant risk.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisk();
  }, [portfolioVal]);

  const tickers = riskData?.tickers || [];
  const heatmap = riskData?.correlation_heatmap || [];

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280, margin: '0 auto' }}>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', fontWeight: 800, color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={18} color="#EF5350" />
            Quantitative Risk Cockpit & Value at Risk (VaR)
          </h1>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
            Parametric & Historical VaR (95%/99%), Conditional VaR (Expected Shortfall), Sharpe & Correlation Matrix.
          </p>
        </div>
        <button onClick={fetchRisk} style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600 }}>
          <RefreshCw size={12} /> Recalculate Risk
        </button>
      </div>

      {/* VaR KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ background: '#0C1022', border: '1px solid rgba(239,83,80,0.3)', padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>1-DAY 95% VAR (PARAMETRIC)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{riskData?.var_95_daily_inr?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#EF5350', marginTop: 2 }}>{riskData?.var_95_daily_pct}% Portfolio Max Loss</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(239,83,80,0.4)', padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>1-DAY 99% VAR (EXTREME RISK)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{riskData?.var_99_daily_inr?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#EF5350', marginTop: 2 }}>{riskData?.var_99_daily_pct}% (2.33σ Tail Event)</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(245,158,11,0.3)', padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>CONDITIONAL VAR (CVAR 95%)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{riskData?.cvar_95_inr?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#F59E0B', marginTop: 2 }}>Expected Shortfall Beyond VaR</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(16,185,129,0.3)', padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>SHARPE RATIO (Rf = 6.5%)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
            {riskData?.sharpe_ratio}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#10B981', marginTop: 2 }}>Sortino: {riskData?.sortino_ratio} | Beta: {riskData?.beta_vs_nifty}</div>
        </div>
      </div>

      {/* Asset Correlation Matrix Heatmap */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.18)',
        borderRadius: 16,
        padding: '20px',
        overflowX: 'auto'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Grid3X3 size={16} color="#818CF8" /> Asset Correlation Matrix Heatmap
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${tickers.length + 1}, minmax(80px, 1fr))`,
          gap: 6,
          textAlign: 'center',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.8rem'
        }}>
          {/* Header Row */}
          <div style={{ padding: '8px', color: '#64748B', fontWeight: 700 }}></div>
          {tickers.map(t => (
            <div key={t} style={{ padding: '8px', color: '#818CF8', fontWeight: 700, background: 'rgba(99,102,241,0.1)', borderRadius: 6 }}>
              {t}
            </div>
          ))}

          {/* Matrix Rows */}
          {tickers.map(t1 => (
            <React.Fragment key={t1}>
              <div style={{ padding: '10px 8px', color: '#818CF8', fontWeight: 700, background: 'rgba(99,102,241,0.1)', borderRadius: 6 }}>
                {t1}
              </div>
              {tickers.map(t2 => {
                const cell = heatmap.find(h => h.ticker_a === t1 && h.ticker_b === t2);
                const corr = cell ? cell.correlation : (t1 === t2 ? 1.0 : 0.5);
                const isOne = corr === 1.0;
                const bg = isOne ? 'rgba(99,102,241,0.25)' : corr > 0.6 ? 'rgba(239,83,80,0.2)' : corr < 0.3 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.15)';
                const textColor = isOne ? '#818CF8' : corr > 0.6 ? '#EF5350' : corr < 0.3 ? '#10B981' : '#F59E0B';

                return (
                  <div
                    key={`${t1}-${t2}`}
                    style={{
                      padding: '10px 8px',
                      background: bg,
                      color: textColor,
                      fontWeight: 700,
                      borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.04)'
                    }}
                  >
                    {corr}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

    </div>
  );
}
