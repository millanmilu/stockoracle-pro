import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import {
  Calculator, RefreshCw, TrendingUp, TrendingDown, ShieldCheck,
  Percent, ArrowRight, DollarSign, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ValuationTerminalView({ ticker: propTicker }) {
  const { selectedSymbol } = useStore();
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
      <div style={{ padding: '40px', textAlign: 'center', color: '#818CF8' }}>
        <RefreshCw size={32} className="spin" style={{ margin: '0 auto 12px' }} />
        <div>Calculating multi-stage DCF intrinsic fair value...</div>
      </div>
    );
  }

  const isUndervalued = (valData?.margin_of_safety_pct || 0) > 0;

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280, margin: '0 auto' }}>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', fontWeight: 800, color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator size={18} color="#818CF8" />
            OpenBB Intrinsic Valuation & DCF Model — {ticker}
          </h1>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
            Multi-stage Free Cash Flow to Firm (FCFF) + Benjamin Graham Intrinsic Formula
          </p>
        </div>
        <button onClick={fetchValuation} style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600 }}>
          <RefreshCw size={12} /> Recalculate
        </button>
      </div>

      {/* Main KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>CURRENT MARKET PRICE (CMP)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{valData?.cmp?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>Live NSE Trade Price</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(16,185,129,0.3)', padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>DCF INTRINSIC VALUE</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{valData?.dcf_intrinsic_value?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#10B981', marginTop: 2 }}>5Y Cash Flow + Terminal Value</div>
        </div>

        <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.2)', padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>GRAHAM NUMBER (V)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{valData?.graham_number?.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>√(22.5 × EPS × BVPS)</div>
        </div>

        <div style={{
          background: isUndervalued ? 'rgba(16,185,129,0.08)' : 'rgba(239,83,80,0.08)',
          border: isUndervalued ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,83,80,0.3)',
          padding: '14px 16px',
          borderRadius: 10
        }}>
          <div style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em', fontWeight: 600 }}>MARGIN OF SAFETY</div>
          <div style={{
            fontSize: '1.25rem', fontWeight: 800,
            color: isUndervalued ? '#10B981' : '#EF5350',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            {valData?.margin_of_safety_pct > 0 ? '+' : ''}{valData?.margin_of_safety_pct}%
          </div>
          <div style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: isUndervalued ? '#10B981' : '#EF5350', marginTop: 2
          }}>
            {valData?.valuation_status}
          </div>
        </div>
      </div>

      {/* Interactive Parameters Sliders */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.18)',
        borderRadius: 12,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Percent size={16} color="#818CF8" /> DCF Model Sensitivity & Assumptions
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94A3B8', marginBottom: 6 }}>
              <span>5-Year Growth Rate (CAGR)</span>
              <strong style={{ color: '#38BDF8' }}>{growth5y}%</strong>
            </div>
            <input type="range" min="2" max="30" step="0.5" value={growth5y} onChange={e => setGrowth5y(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94A3B8', marginBottom: 6 }}>
              <span>Discount Rate (WACC)</span>
              <strong style={{ color: '#F59E0B' }}>{wacc}%</strong>
            </div>
            <input type="range" min="6" max="18" step="0.5" value={wacc} onChange={e => setWacc(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94A3B8', marginBottom: 6 }}>
              <span>Perpetual Terminal Growth</span>
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
        borderRadius: 12,
        padding: '18px 20px',
        overflowX: 'auto'
      }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: '#F0F0FF' }}>
          Projected Free Cash Flows & Discounting (₹ Per Share)
        </h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right' }}>
              <th style={{ textAlign: 'left', padding: '10px 8px' }}>Period</th>
              <th style={{ padding: '10px 8px' }}>Projected FCF</th>
              <th style={{ padding: '10px 8px' }}>Discount Factor</th>
              <th style={{ padding: '10px 8px' }}>Present Value (PV)</th>
            </tr>
          </thead>
          <tbody>
            {valData?.projected_cash_flows?.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                <td style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#F0F0FF' }}>{row.year}</td>
                <td style={{ padding: '10px 8px' }}>₹{row.fcf_per_share}</td>
                <td style={{ padding: '10px 8px', color: '#94A3B8' }}>{row.discount_factor}</td>
                <td style={{ padding: '10px 8px', fontWeight: 700, color: '#10B981' }}>₹{row.pv_fcf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
