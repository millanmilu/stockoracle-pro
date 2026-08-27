import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import {
  Calculator, RefreshCw, TrendingUp, TrendingDown, ShieldCheck,
  Percent, ArrowRight, DollarSign, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ValuationTerminalView({ ticker: propTicker, compact = false }) {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const ticker = propTicker || selectedSymbol;

  const [growth5y, setGrowth5y] = useState(12);
  const [termGrowth, setTermGrowth] = useState(5);
  const [wacc, setWacc] = useState(11);

  const [valData, setValData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchValuation = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stock/${ticker}/valuation`, {
        params: {
          growth_5y: growth5y / 100.0,
          terminal_growth: termGrowth / 100.0,
          wacc: wacc / 100.0,
        }
      });
      setValData(data);
    } catch {
      toast.error('Failed to load valuation models.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchValuation();
  }, [ticker, growth5y, termGrowth, wacc]);

  if (loading && !valData) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#818CF8', fontSize: '0.8rem' }}>
        <RefreshCw size={22} className="spin" style={{ margin: '0 auto 8px' }} />
        <div>Computing DCF fair value...</div>
      </div>
    );
  }

  const isUndervalued = (valData?.margin_of_safety_pct || 0) > 0;

  return (
    <div style={{ padding: compact ? '8px 10px' : 'clamp(12px, 2.5vw, 20px)', display: 'flex', flexDirection: 'column', gap: compact ? 10 : 16, maxWidth: 1280, margin: '0 auto' }}>

      {/* Top Header - only shown in standalone view */}
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calculator size={16} color="#818CF8" />
              Intrinsic DCF Valuation — {ticker}
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
              Free Cash Flow (FCFF) + Graham Formula
            </p>
          </div>
          <button onClick={fetchValuation} style={{ padding: '4px 10px', borderRadius: 5, background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 600 }}>
            <RefreshCw size={11} /> Recalculate
          </button>
        </div>
      )}

      {/* Main KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: compact ? 8 : 12 }}>
        <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', padding: compact ? '10px 12px' : '14px 16px', borderRadius: 8 }}>
          <div style={{ fontSize: '0.64rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>CMP</div>
          <div style={{ fontSize: compact ? '1.15rem' : '1.25rem', fontWeight: 800, color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{valData?.cmp?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 1 }}>Live Price</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(16,185,129,0.3)', padding: compact ? '10px 12px' : '14px 16px', borderRadius: 8 }}>
          <div style={{ fontSize: '0.64rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>DCF FAIR VALUE</div>
          <div style={{ fontSize: compact ? '1.15rem' : '1.25rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{valData?.dcf_intrinsic_value?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#10B981', marginTop: 1 }}>5Y DCF</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', padding: compact ? '10px 12px' : '14px 16px', borderRadius: 8 }}>
          <div style={{ fontSize: '0.64rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>GRAHAM NUMBER</div>
          <div style={{ fontSize: compact ? '1.15rem' : '1.25rem', fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{valData?.graham_number?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 1 }}>Formula V</div>
        </div>

        <div style={{
          background: isUndervalued ? 'rgba(16,185,129,0.08)' : 'rgba(239,83,80,0.08)',
          border: isUndervalued ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,83,80,0.3)',
          padding: compact ? '10px 12px' : '14px 16px',
          borderRadius: 8
        }}>
          <div style={{ fontSize: '0.64rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em', fontWeight: 700 }}>SAFETY MARGIN</div>
          <div style={{
            fontSize: compact ? '1.15rem' : '1.25rem', fontWeight: 800,
            color: isUndervalued ? '#10B981' : '#EF5350',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            {valData?.margin_of_safety_pct > 0 ? '+' : ''}{valData?.margin_of_safety_pct}%
          </div>
          <div style={{
            fontSize: '0.68rem', fontWeight: 700,
            color: isUndervalued ? '#10B981' : '#EF5350', marginTop: 1
          }}>
            {valData?.valuation_status}
          </div>
        </div>
      </div>

      {/* Interactive Parameters Sliders */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.18)',
        borderRadius: 8,
        padding: compact ? '10px 12px' : '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 8 : 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: '#F0F0FF', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Percent size={13} color="#818CF8" /> DCF Assumptions
          </span>
          {compact && (
            <button onClick={fetchValuation} style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', fontWeight: 600 }}>
              <RefreshCw size={10} /> Recalc
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: compact ? 8 : 14 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94A3B8', marginBottom: 3 }}>
              <span>5Y Growth (CAGR)</span>
              <strong style={{ color: '#38BDF8' }}>{growth5y}%</strong>
            </div>
            <input type="range" min="2" max="30" step="0.5" value={growth5y} onChange={e => setGrowth5y(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94A3B8', marginBottom: 3 }}>
              <span>Discount (WACC)</span>
              <strong style={{ color: '#F59E0B' }}>{wacc}%</strong>
            </div>
            <input type="range" min="6" max="18" step="0.5" value={wacc} onChange={e => setWacc(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94A3B8', marginBottom: 3 }}>
              <span>Terminal Growth</span>
              <strong style={{ color: '#10B981' }}>{termGrowth}%</strong>
            </div>
            <input type="range" min="1" max="8" step="0.5" value={termGrowth} onChange={e => setTermGrowth(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* 5-Year Projected Cash Flows Table */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 8,
        padding: compact ? '8px 10px' : '14px 16px',
        overflowX: 'auto'
      }}>
        <div style={{ fontSize: '0.74rem', color: '#F0F0FF', fontWeight: 700, marginBottom: 6 }}>
          Projected Cash Flows (₹ / Share)
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right' }}>
              <th style={{ textAlign: 'left', padding: '6px 4px' }}>Period</th>
              <th style={{ padding: '6px 4px' }}>FCF</th>
              <th style={{ padding: '6px 4px' }}>Discount</th>
              <th style={{ padding: '6px 4px' }}>PV</th>
            </tr>
          </thead>
          <tbody>
            {valData?.projected_cash_flows?.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                <td style={{ textAlign: 'left', padding: '5px 4px', fontWeight: 600, color: '#F0F0FF' }}>{row.year}</td>
                <td style={{ padding: '5px 4px' }}>₹{row.fcf_per_share}</td>
                <td style={{ padding: '5px 4px', color: '#94A3B8' }}>{row.discount_factor}</td>
                <td style={{ padding: '5px 4px', fontWeight: 700, color: '#10B981' }}>₹{row.pv_fcf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
