import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  ShieldAlert, RefreshCw, Activity, TrendingUp, AlertTriangle,
  Scale, Grid3X3, Percent, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function QuantRiskCockpit({ compact = false }) {
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

  if (loading && !riskData) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#818CF8', fontSize: '0.8rem' }}>
        <RefreshCw size={22} className="spin" style={{ margin: '0 auto 8px' }} />
        <div>Computing portfolio VaR & risk metrics...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: compact ? '8px 10px' : 'clamp(12px, 2.5vw, 20px)', display: 'flex', flexDirection: 'column', gap: compact ? 10 : 16, maxWidth: 1280, margin: '0 auto' }}>

      {/* Top Header - only in standalone mode */}
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={16} color="#EF5350" />
              Quantitative Risk Cockpit (VaR)
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
              Parametric VaR, CVaR, Sharpe & Correlation Matrix
            </p>
          </div>
          <button onClick={fetchRisk} style={{ padding: '4px 10px', borderRadius: 5, background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 600 }}>
            <RefreshCw size={11} /> Recalculate
          </button>
        </div>
      )}

      {/* VaR KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: compact ? 6 : 10 }}>
        <div style={{ background: '#0C1022', border: '1px solid rgba(239,83,80,0.3)', padding: compact ? '8px 10px' : '12px 14px', borderRadius: 8 }}>
          <div style={{ fontSize: '0.62rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>1-DAY 95% VAR</div>
          <div style={{ fontSize: compact ? '1.1rem' : '1.25rem', fontWeight: 800, color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{riskData?.var_95_daily_inr?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.64rem', color: '#EF5350', marginTop: 1 }}>{riskData?.var_95_daily_pct}% Max Loss</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(239,83,80,0.4)', padding: compact ? '8px 10px' : '12px 14px', borderRadius: 8 }}>
          <div style={{ fontSize: '0.62rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>1-DAY 99% VAR</div>
          <div style={{ fontSize: compact ? '1.1rem' : '1.25rem', fontWeight: 800, color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{riskData?.var_99_daily_inr?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.64rem', color: '#EF5350', marginTop: 1 }}>{riskData?.var_99_daily_pct}% (2.33σ)</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(245,158,11,0.3)', padding: compact ? '8px 10px' : '12px 14px', borderRadius: 8 }}>
          <div style={{ fontSize: '0.62rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>CVAR 95%</div>
          <div style={{ fontSize: compact ? '1.1rem' : '1.25rem', fontWeight: 800, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{riskData?.cvar_95_inr?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.64rem', color: '#F59E0B', marginTop: 1 }}>Expected Shortfall</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(16,185,129,0.3)', padding: compact ? '8px 10px' : '12px 14px', borderRadius: 8 }}>
          <div style={{ fontSize: '0.62rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>SHARPE RATIO</div>
          <div style={{ fontSize: compact ? '1.1rem' : '1.25rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
            {riskData?.sharpe_ratio}
          </div>
          <div style={{ fontSize: '0.64rem', color: '#10B981', marginTop: 1 }}>Beta: {riskData?.beta_vs_nifty}</div>
        </div>
      </div>

      {/* Asset Correlation Matrix Heatmap */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.18)',
        borderRadius: 8,
        padding: compact ? '10px 12px' : '16px',
        overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '0.74rem', color: '#F0F0FF', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Grid3X3 size={13} color="#818CF8" /> Correlation Matrix
          </span>
          {compact && (
            <button onClick={fetchRisk} style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', fontWeight: 600 }}>
              <RefreshCw size={10} /> Recalc
            </button>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${tickers.length + 1}, minmax(${compact ? '45px' : '65px'}, 1fr))`,
          gap: compact ? 3 : 5,
          textAlign: 'center',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: compact ? '0.7rem' : '0.78rem'
        }}>
          {/* Header Row */}
          <div style={{ padding: '4px', color: '#64748B', fontWeight: 700 }}></div>
          {tickers.map(t => (
            <div key={t} style={{ padding: '4px 2px', color: '#818CF8', fontWeight: 700, background: 'rgba(99,102,241,0.1)', borderRadius: 4, fontSize: '0.68rem' }}>
              {t}
            </div>
          ))}

          {/* Matrix Rows */}
          {tickers.map(t1 => (
            <React.Fragment key={t1}>
              <div style={{ padding: '4px 2px', color: '#818CF8', fontWeight: 700, background: 'rgba(99,102,241,0.1)', borderRadius: 4, fontSize: '0.68rem' }}>
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
                      padding: compact ? '4px 2px' : '6px 4px',
                      background: bg,
                      color: textColor,
                      fontWeight: 700,
                      borderRadius: 4,
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
