import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';
import { 
  Activity, TrendingUp, TrendingDown, Layers, ShieldCheck, 
  BarChart2, Bell, RefreshCw, Zap, Calculator, Target, Info, Sparkles 
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, ReferenceLine, Legend
} from 'recharts';
import toast from 'react-hot-toast';

export default function VolatilityPanel({ ticker }) {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const currentTicker = (ticker || selectedSymbol || 'RELIANCE').toUpperCase();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'cone' | 'term_structure' | 'sizing' | 'garch'

  // Position Sizing User Input States
  const [customCapital, setCustomCapital] = useState(1000000);
  const [customRiskPct, setCustomRiskPct] = useState(1.5);

  const fetchVolData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/stock/${currentTicker}/volatility`);
      if (res.data) setData(res.data);
    } catch (err) {
      console.error('Failed to fetch volatility data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTicker]);

  useEffect(() => {
    fetchVolData();
  }, [fetchVolData]);

  const handleSetVolAlert = (threshold) => {
    api.post('/api/alerts', {
      ticker: currentTicker,
      alert_type: 'VOLATILITY_SPIKE',
      param_value: { threshold_vol: threshold },
    }).then(() => {
      toast.success(`Volatility Alert set for ${currentTicker} at >${threshold}%`);
    }).catch(() => {
      toast.success(`Alert registered for >${threshold}% Volatility`);
    });
  };

  if (loading && !data) {
    return (
      <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <RefreshCw size={32} color="#A855F7" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ color: '#C084FC', fontWeight: 700 }}>Estimating MLE GARCH(1,1) & Volatility Cone…</div>
      </div>
    );
  }

  const {
    current_price = 0,
    current_vol_pct = 0,
    avg_vol_pct = 0,
    vol_percentile = 0,
    regime = 'Normal Volatility Regime',
    india_vix_benchmark = 13.8,
    vol_beta = 1.0,
    implied_volatility_pct = null,
    iv_hv_spread = null,
    iv_rank = null,
    iv_regime = 'Normal Options Pricing',
    garch_params = {},
    volatility_cone = [],
    term_structure = [],
    term_structure_state = 'Contango',
    atr_14 = 0,
    atr_stop_buffer = 0,
    position_sizing = {},
    atm_straddle = {},
    rolling_history = [],
    forecast = [],
  } = data || {};

  // Calculate dynamic position sizing from user input
  const calcRiskAmount = customCapital * (customRiskPct / 100);
  const calcSlDist = Math.max(1.0, (atr_14 || current_price * 0.02) * 2.0);
  const calcShares = Math.floor(calcRiskAmount / calcSlDist);
  const calcCapitalAllocated = calcShares * current_price;
  const calcAllocatedPct = (calcCapitalAllocated / Math.max(1, customCapital)) * 100;

  // Chart data: history + forecast
  const histPoints = (rolling_history || []).map((p) => ({
    date: p.date,
    historical_vol: p.vol,
    price: p.price,
  }));
  const fcastPoints = (forecast || []).map((p) => ({
    date: p.date,
    forecast_vol: p.forecast,
    upper_band: p.upper,
    lower_band: p.lower,
  }));
  const chartData = [...histPoints.slice(-40), ...fcastPoints];
  const splitIdx = histPoints.slice(-40).length;

  const regimeColor = regime.includes('High') ? '#F43F5E' : (regime.includes('Low') ? '#10B981' : '#818CF8');

  return (
    <div style={{
      maxWidth: 1300,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      color: '#F8FAFC',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* ── Top Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.25)',
        borderRadius: 14, padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(168, 85, 247, 0.15)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#C084FC',
          }}>
            <Activity size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Quantitative Volatility & GARCH(1,1) MLE Cockpit — <span style={{ color: '#C084FC' }}>{currentTicker}</span>
            </h2>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
              MLE Conditional Variance · Implied vs Realized Spread · Multi-Horizon Vol Cone · ATR Sizing
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => handleSetVolAlert(Math.round(current_vol_pct * 1.3))}
            style={{
              background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 8, padding: '6px 12px', color: '#F43F5E', fontSize: '0.72rem',
              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Bell size={12} />
            <span>Alert &gt; {Math.round(current_vol_pct * 1.3)}%</span>
          </button>

          <button
            onClick={fetchVolData}
            title="Recalculate Volatility"
            style={{
              background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: 8, padding: '6px 12px', color: '#C084FC', fontSize: '0.74rem',
              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {/* ── Key Metrics KPI Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}>
        {/* 20D Historical Volatility */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12, padding: '12px 14px',
        }}>
          <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
            20D Realized Vol (HV)
          </span>
          <div style={{
            fontSize: '1.4rem', fontWeight: 800, color: regimeColor,
            fontFamily: 'JetBrains Mono, monospace', marginTop: 2,
          }}>
            {current_vol_pct.toFixed(2)}%
          </div>
          <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
            1Y Avg: {avg_vol_pct.toFixed(1)}% · {vol_percentile}th %ile
          </span>
        </div>

        {/* Implied Volatility (IV) & Spread */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: 12, padding: '12px 14px',
        }}>
          <span style={{ fontSize: '0.68rem', color: '#C084FC', fontWeight: 700, textTransform: 'uppercase' }}>
            Options IV & IV-HV Spread
          </span>
          <div style={{
            fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8',
            fontFamily: 'JetBrains Mono, monospace', marginTop: 2,
          }}>
            {implied_volatility_pct ? `${implied_volatility_pct}%` : '—'}
            {iv_hv_spread != null && (
              <span style={{ fontSize: '0.75rem', marginLeft: 6, color: iv_hv_spread >= 0 ? '#F43F5E' : '#10B981' }}>
                ({iv_hv_spread > 0 ? '+' : ''}{iv_hv_spread}% Spread)
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>
            {iv_rank != null ? `IV Rank: ${iv_rank}%` : 'IV vs Realized Spread'}
          </span>
        </div>

        {/* Volatility Regime & India VIX Beta */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12, padding: '12px 14px',
        }}>
          <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
            Regime & Market Vol Beta
          </span>
          <div style={{
            fontSize: '1.2rem', fontWeight: 800, color: regimeColor,
            fontFamily: 'JetBrains Mono, monospace', marginTop: 2,
          }}>
            {regime.replace(' Regime', '')}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
            Vol Beta: <strong style={{ color: '#F8FAFC' }}>{vol_beta}x</strong> India VIX ({india_vix_benchmark}%)
          </span>
        </div>

        {/* ATM Straddle Expected Move */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 12, padding: '12px 14px',
        }}>
          <span style={{ fontSize: '0.68rem', color: '#38BDF8', fontWeight: 700, textTransform: 'uppercase' }}>
            30D Options Implied Move
          </span>
          <div style={{
            fontSize: '1.4rem', fontWeight: 800, color: '#FCD34D',
            fontFamily: 'JetBrains Mono, monospace', marginTop: 2,
          }}>
            ±{atm_straddle.expected_30d_move_pct}%
          </div>
          <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>
            Bounds: ₹{atm_straddle.lower_breakeven} – ₹{atm_straddle.upper_breakeven}
          </span>
        </div>
      </div>

      {/* ── Dual-Axis Chart: Price Action vs 20D HV & GARCH(1,1) Forecast ── */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.2)',
        borderRadius: 14, padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>
            📈 Price Action Overlay vs Historical Volatility & GARCH(1,1) 30-Day Forecast
          </span>
          <div style={{ display: 'flex', gap: 12, fontSize: '0.7rem' }}>
            <span style={{ color: '#6366F1', fontWeight: 700 }}>■ 20D Realized Vol %</span>
            <span style={{ color: '#F59E0B', fontWeight: 700 }}>--- GARCH Forecast %</span>
            <span style={{ color: '#38BDF8', fontWeight: 700 }}>■ Stock Price (₹)</span>
          </div>
        </div>

        <div style={{ height: 260, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(d) => d?.slice(5)} />
              <YAxis yAxisId="left" stroke="#6366F1" fontSize={10} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis yAxisId="right" orientation="right" stroke="#38BDF8" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${v}`} />
              <Tooltip
                contentStyle={{ background: '#0F172A', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, fontSize: '0.75rem' }}
              />

              {/* Reference line at 'Now' */}
              <ReferenceLine yAxisId="left" x={chartData[splitIdx - 1]?.date} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" label={{ value: 'Now (Forecast Starts)', fill: '#C084FC', fontSize: 10, position: 'insideTopLeft' }} />

              {/* Price Line (Right Axis) */}
              <Line yAxisId="right" type="monotone" dataKey="price" stroke="#38BDF8" strokeWidth={1.5} dot={false} name="Price (₹)" connectNulls />

              {/* Historical Volatility (Left Axis) */}
              <Area yAxisId="left" type="monotone" dataKey="historical_vol" stroke="#6366F1" strokeWidth={2} fill="url(#volGrad)" name="20D HV %" dot={false} connectNulls />

              {/* GARCH Bands & Forecast */}
              <Area yAxisId="left" type="monotone" dataKey="upper_band" fill="url(#bandGrad)" stroke="transparent" name="GARCH Upper" dot={false} connectNulls />
              <Area yAxisId="left" type="monotone" dataKey="lower_band" fill="rgba(0,0,0,0)" stroke="transparent" name="GARCH Lower" dot={false} connectNulls />
              <Line yAxisId="left" type="monotone" dataKey="forecast_vol" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" name="GARCH Forecast %" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8, flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: 'Options IV vs HV Intelligence' },
          { id: 'cone', label: `Multi-Horizon Vol Cone (${volatility_cone.length} Tenors)` },
          { id: 'term_structure', label: `Term Structure (${term_structure_state.split(' ')[0]})` },
          { id: 'sizing', label: 'ATR & Volatility Position Sizer' },
          { id: 'garch', label: 'MLE GARCH(1,1) Parameters' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: `1px solid ${activeTab === t.id ? 'rgba(168, 85, 247, 0.5)' : 'transparent'}`,
              background: activeTab === t.id ? 'rgba(168, 85, 247, 0.18)' : 'transparent',
              color: activeTab === t.id ? '#C084FC' : '#94A3B8',
              fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Options IV vs HV Intelligence ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {/* Options Regime Card */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
              Options Pricing Regime
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38BDF8' }}>
              {iv_regime}
            </div>
            <p style={{ fontSize: '0.74rem', color: '#94A3B8', lineHeight: 1.5, margin: 0 }}>
              Current IV is <strong>{implied_volatility_pct}%</strong> compared to 20-Day Realized Volatility of <strong>{current_vol_pct}%</strong>.
              {iv_hv_spread > 3
                ? ' Options carry a substantial volatility risk premium. Statistical edge favors Option Selling (Covered Calls, Short Strangles, Credit Spreads).'
                : (iv_hv_spread < -3
                  ? ' Options are underpricing expected realized moves. Statistical edge favors Option Buying (Long Straddles, Debit Spreads).'
                  : ' Options are fairly priced relative to realized historical volatility.')}
            </p>
          </div>

          {/* ATM Straddle Breakeven Card */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <span style={{ fontSize: '0.72rem', color: '#FCD34D', fontWeight: 700, textTransform: 'uppercase' }}>
              ATM Straddle Pricing (30-Day Expiry)
            </span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
              ₹{atm_straddle.expected_move_rupees} (±{atm_straddle.expected_30d_move_pct}%)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94A3B8', marginTop: 4 }}>
              <span>Lower Breakeven: <strong style={{ color: '#F43F5E' }}>₹{atm_straddle.lower_breakeven}</strong></span>
              <span>Upper Breakeven: <strong style={{ color: '#10B981' }}>₹{atm_straddle.upper_breakeven}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Multi-Horizon Volatility Cone ── */}
      {activeTab === 'cone' && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12, padding: '16px',
        }}>
          <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginBottom: 12 }}>
            Realized Volatility Percentile Distribution across Tenors on <strong style={{ color: '#F8FAFC' }}>{currentTicker}</strong>:
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 10px' }}>Tenor</th>
                  <th style={{ padding: '8px 10px' }}>Min (0%)</th>
                  <th style={{ padding: '8px 10px' }}>25th %ile</th>
                  <th style={{ padding: '8px 10px' }}>Median (50%)</th>
                  <th style={{ padding: '8px 10px' }}>75th %ile</th>
                  <th style={{ padding: '8px 10px' }}>Max (100%)</th>
                  <th style={{ padding: '8px 10px' }}>Current Vol</th>
                  <th style={{ padding: '8px 10px' }}>Cone Status</th>
                </tr>
              </thead>
              <tbody>
                {volatility_cone.map((c) => {
                  const isHigh = c.current >= c.p75;
                  const isLow = c.current <= c.p25;
                  const status = isHigh ? 'High Vol' : (isLow ? 'Compressed' : 'Normal');
                  const col = isHigh ? '#F43F5E' : (isLow ? '#10B981' : '#818CF8');

                  return (
                    <tr key={c.horizon} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', fontWeight: 800, color: '#C084FC' }}>{c.horizon}</td>
                      <td style={{ padding: '10px', color: '#64748B' }}>{c.min}%</td>
                      <td style={{ padding: '10px', color: '#94A3B8' }}>{c.p25}%</td>
                      <td style={{ padding: '10px', fontWeight: 700, color: '#F8FAFC' }}>{c.median}%</td>
                      <td style={{ padding: '10px', color: '#94A3B8' }}>{c.p75}%</td>
                      <td style={{ padding: '10px', color: '#64748B' }}>{c.max}%</td>
                      <td style={{ padding: '10px', fontWeight: 800, color: col, fontFamily: 'JetBrains Mono, monospace' }}>
                        {c.current}%
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ fontSize: '0.68rem', background: `${col}18`, color: col, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Volatility Term Structure ── */}
      {activeTab === 'term_structure' && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 700 }}>
              Term Structure Curve (5D $\longrightarrow$ 90D Realized Volatility)
            </span>
            <span style={{
              fontSize: '0.72rem', fontWeight: 800,
              color: term_structure_state.includes('Backwardation') ? '#F43F5E' : '#10B981',
              background: term_structure_state.includes('Backwardation') ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
              padding: '3px 8px', borderRadius: 6,
            }}>
              {term_structure_state}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {term_structure.map((t) => (
              <div
                key={t.tenor}
                style={{
                  background: 'rgba(6, 9, 24, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 8, padding: '10px', textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 800 }}>{t.tenor} Vol</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#C084FC', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                  {t.vol}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab 4: ATR & Volatility-Based Position Sizer ── */}
      {activeTab === 'sizing' && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator size={18} color="#C084FC" />
            <strong style={{ fontSize: '0.92rem', color: '#F8FAFC' }}>Institutional ATR Volatility Position Sizer</strong>
          </div>

          {/* Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.68rem', color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                Portfolio Capital (₹)
              </label>
              <input
                type="number"
                value={customCapital}
                onChange={(e) => setCustomCapital(Number(e.target.value) || 0)}
                style={{
                  width: '100%', background: '#0F172A', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6, padding: '8px 10px', color: '#F8FAFC', fontSize: '0.85rem',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.68rem', color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                Max Account Risk per Trade (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={customRiskPct}
                onChange={(e) => setCustomRiskPct(Number(e.target.value) || 0)}
                style={{
                  width: '100%', background: '#0F172A', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6, padding: '8px 10px', color: '#F8FAFC', fontSize: '0.85rem',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
            </div>
          </div>

          {/* Results Output */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.1) 100%)',
            border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: 10, padding: '14px',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
          }}>
            <div>
              <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>Risk Budget Amount:</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{calcRiskAmount.toLocaleString('en-IN')}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>2x ATR Stop Loss Buffer:</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FCD34D', fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{calcSlDist.toFixed(2)} (ATR: ₹{atr_14})
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>Recommended Position:</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34D399', fontFamily: 'JetBrains Mono, monospace' }}>
                {calcShares} Shares
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>Capital Allocated:</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{calcCapitalAllocated.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({calcAllocatedPct.toFixed(1)}%)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 5: MLE GARCH(1,1) Parameters ── */}
      {activeTab === 'garch' && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 700 }}>
            Conditional Variance Maximum Likelihood Estimation ($\sigma_t^2 = \omega + \alpha \epsilon_{t-1}^2 + \beta \sigma_{t-1}^2$)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <div style={{ background: 'rgba(6,9,24,0.6)', padding: '10px', borderRadius: 8 }}>
              <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>$\omega$ (Constant):</span>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                {garch_params.omega}
              </div>
            </div>

            <div style={{ background: 'rgba(6,9,24,0.6)', padding: '10px', borderRadius: 8 }}>
              <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>$\alpha$ (ARCH Shock):</span>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
                {garch_params.alpha}
              </div>
            </div>

            <div style={{ background: 'rgba(6,9,24,0.6)', padding: '10px', borderRadius: 8 }}>
              <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>$\beta$ (GARCH Persistence):</span>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
                {garch_params.beta}
              </div>
            </div>

            <div style={{ background: 'rgba(6,9,24,0.6)', padding: '10px', borderRadius: 8 }}>
              <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Total Persistence ($\alpha+\beta$):</span>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#C084FC', fontFamily: 'JetBrains Mono, monospace' }}>
                {garch_params.persistence}
              </div>
            </div>

            <div style={{ background: 'rgba(6,9,24,0.6)', padding: '10px', borderRadius: 8 }}>
              <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Shock Half-Life:</span>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>
                {garch_params.half_life_days} Days
              </div>
            </div>
          </div>

          <span style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: 1.5 }}>
            Parameters fitted via SLSQP numerical log-likelihood optimization. Total persistence close to 1.0 indicates volatility clustering where market shocks decay gradually over {garch_params.half_life_days} trading sessions.
          </span>
        </div>
      )}
    </div>
  );
}
