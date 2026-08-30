import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar, Cell
} from 'recharts';
import {
  Play, RefreshCw, Settings, Shield, AlertTriangle, TrendingUp,
  TrendingDown, Zap, BarChart2, Activity, PieChart, Crosshair, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MonteCarlo({ ticker }) {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const setActiveView = useStore((s) => s.setActiveView);
  const currentTicker = (ticker || selectedSymbol || 'RELIANCE').toUpperCase();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('fan');
  const [showSettings, setShowSettings] = useState(false);
  const [showSamplePaths, setShowSamplePaths] = useState(true);

  // Configurable Parameters
  const [simulations, setSimulations] = useState(1000);
  const [horizon, setHorizon] = useState(30);
  const [method, setMethod] = useState('gbm');
  const [driftType, setDriftType] = useState('historical');
  const [customDrift, setCustomDrift] = useState('');
  const [customVol, setCustomVol] = useState('');
  const [volMultiplier, setVolMultiplier] = useState(1.0);
  const [stressScenario, setStressScenario] = useState('none');
  const [portfolioCapital, setPortfolioCapital] = useState(100000);
  const [riskTolerancePct, setRiskTolerancePct] = useState(2.0);

  const fetchSimulation = useCallback(async (overrides = {}) => {
    setLoading(true);
    setError(null);
    try {
      const activeSims = overrides.simulations !== undefined ? overrides.simulations : simulations;
      const activeHorizon = overrides.horizon !== undefined ? overrides.horizon : horizon;
      const activeMethod = overrides.method !== undefined ? overrides.method : method;
      const activeDriftType = overrides.driftType !== undefined ? overrides.driftType : driftType;
      const activeScenario = overrides.stressScenario !== undefined ? overrides.stressScenario : stressScenario;
      const activeVolMult = overrides.volMultiplier !== undefined ? overrides.volMultiplier : volMultiplier;

      const params = {
        simulations: activeSims,
        horizon: activeHorizon,
        method: activeMethod,
        drift_type: activeDriftType,
        stress_scenario: activeScenario,
        vol_multiplier: activeVolMult,
        portfolio_capital: portfolioCapital,
        risk_tolerance_pct: riskTolerancePct,
      };

      if (customDrift !== '') params.custom_drift_pct = Number(customDrift);
      if (customVol !== '') params.custom_vol_pct = Number(customVol);

      const res = await api.get(`/api/stock/${currentTicker}/montecarlo`, { params });
      if (res.data?.error) {
        setError(res.data.error);
      } else {
        setData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to execute Monte Carlo simulation.');
    } finally {
      setLoading(false);
    }
  }, [currentTicker, simulations, horizon, method, driftType, customDrift, customVol, volMultiplier, stressScenario, portfolioCapital, riskTolerancePct]);

  useEffect(() => {
    fetchSimulation();
  }, [currentTicker]);

  const fmtRs = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const fmtPct = (v, d = 2) => `${Number(v) >= 0 ? '+' : ''}${Number(v || 0).toFixed(d)}%`;
  const fmtNum = (v, d = 2) => Number(v || 0).toFixed(d);

  const handleScenarioPreset = (scen) => {
    setStressScenario(scen);
    fetchSimulation({ stressScenario: scen });
  };

  const handleApplyToPaperTrade = (shares) => {
    toast.success(`Position sizing (${shares} shares) ready for Paper Trading!`);
    if (setActiveView) setActiveView('Paper Trading');
  };

  const MetricCard = ({ label, value, sub, col, icon: Icon }) => (
    <div style={{
      background: 'rgba(15, 23, 42, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.66rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
        {Icon && <Icon size={14} color={col || '#64748B'} />}
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: col || '#F8FAFC', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.66rem', color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, color: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top Header Cockpit ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        background: 'linear-gradient(180deg, rgba(17,24,39,0.95), rgba(15,23,42,0.85))',
        border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8' }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                Monte Carlo Risk Engine — <span style={{ color: '#818CF8' }}>{currentTicker}</span>
              </h2>
              {data && (
                <span style={{ fontSize: '0.78rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', padding: '2px 8px', borderRadius: 6, color: '#A5B4FC', fontFamily: 'JetBrains Mono, monospace' }}>
                  Spot: {fmtRs(data.current_price)}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
              Multi-Model Stochastic Simulation · Parametric GBM · Empirical Bootstrap · Jump-Diffusion · GARCH Vol Clustering
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowSettings(!showSettings)}
            style={{ background: showSettings ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 12px', color: '#94A3B8', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Settings size={14} />
            <span>Parameters & Stress</span>
          </button>
          <button onClick={() => fetchSimulation()} disabled={loading}
            style={{ background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', border: 'none', borderRadius: 8, padding: '7px 18px', color: '#fff', fontSize: '0.78rem', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
            <span>{loading ? 'Simulating…' : 'Run Simulation'}</span>
          </button>
        </div>
      </div>

      {/* ── Settings & Parameter Drawer ── */}
      {showSettings && (
        <div style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {/* Method */}
            <div>
              <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                SIMULATION MODEL
              </label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#F8FAFC', padding: '6px 8px', fontSize: '0.75rem' }}>
                <option value="gbm">Geometric Brownian Motion (Antithetic)</option>
                <option value="bootstrap">Historical Bootstrap (Fat Tails & Kurtosis)</option>
                <option value="jump_diffusion">Merton Jump-Diffusion (Gap Shocks)</option>
                <option value="garch">GARCH(1,1) Volatility Clustering</option>
              </select>
            </div>

            {/* Drift Framework */}
            <div>
              <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                DRIFT (μ) FRAMEWORK
              </label>
              <select value={driftType} onChange={(e) => setDriftType(e.target.value)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#F8FAFC', padding: '6px 8px', fontSize: '0.75rem' }}>
                <option value="historical">Historical Empirical Drift</option>
                <option value="risk_neutral">Risk-Neutral Pricing (RBI rf = 6.5%)</option>
                <option value="zero">Zero Drift / Martingale (μ = 0)</option>
                <option value="custom">Custom Annualized % Drift</option>
              </select>
            </div>

            {/* Horizon */}
            <div>
              <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                FORECAST HORIZON: <strong style={{ color: '#818CF8' }}>{horizon} Days</strong>
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[7, 14, 30, 60, 90, 180, 252].map((h) => (
                  <button key={h} onClick={() => setHorizon(h)}
                    style={{ flex: 1, padding: '4px 2px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700, border: `1px solid ${horizon === h ? '#6366F1' : 'rgba(255,255,255,0.1)'}`, background: horizon === h ? 'rgba(99,102,241,0.25)' : 'transparent', color: horizon === h ? '#A5B4FC' : '#94A3B8', cursor: 'pointer' }}>
                    {h}D
                  </button>
                ))}
              </div>
            </div>

            {/* Simulations Count */}
            <div>
              <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                PATHS: <strong style={{ color: '#818CF8' }}>{simulations.toLocaleString()} Paths</strong>
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[500, 1000, 2000, 5000].map((s) => (
                  <button key={s} onClick={() => setSimulations(s)}
                    style={{ flex: 1, padding: '4px 2px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700, border: `1px solid ${simulations === s ? '#6366F1' : 'rgba(255,255,255,0.1)'}`, background: simulations === s ? 'rgba(99,102,241,0.25)' : 'transparent', color: simulations === s ? '#A5B4FC' : '#94A3B8', cursor: 'pointer' }}>
                    {s >= 1000 ? `${s/1000}k` : s}
                  </button>
                ))}
              </div>
            </div>

            {/* Volatility Multiplier */}
            <div>
              <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                VOLATILITY MULTIPLIER: <strong style={{ color: '#818CF8' }}>{volMultiplier}x</strong>
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1.0, 1.25, 1.5, 2.0].map((m) => (
                  <button key={m} onClick={() => setVolMultiplier(m)}
                    style={{ flex: 1, padding: '4px 2px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700, border: `1px solid ${volMultiplier === m ? '#6366F1' : 'rgba(255,255,255,0.1)'}`, background: volMultiplier === m ? 'rgba(99,102,241,0.25)' : 'transparent', color: volMultiplier === m ? '#A5B4FC' : '#94A3B8', cursor: 'pointer' }}>
                    {m}x
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Overrides */}
            <div>
              <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                MANUAL OVERRIDES (ANNUALIZED %)
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" placeholder="Drift % (e.g. 15)" value={customDrift} onChange={(e) => setCustomDrift(e.target.value)}
                  style={{ width: '50%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#F8FAFC', padding: '5px 8px', fontSize: '0.72rem' }} />
                <input type="number" placeholder="Vol % (e.g. 30)" value={customVol} onChange={(e) => setCustomVol(e.target.value)}
                  style={{ width: '50%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#F8FAFC', padding: '5px 8px', fontSize: '0.72rem' }} />
              </div>
            </div>
          </div>

          {/* Sizing & Capital Controls */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700 }}>PORTFOLIO RISK PROFILE:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Capital (₹):</span>
              <input type="number" value={portfolioCapital} onChange={(e) => setPortfolioCapital(Number(e.target.value))}
                style={{ width: 100, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#F8FAFC', padding: '4px 6px', fontSize: '0.72rem' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Max Risk %:</span>
              <input type="number" step="0.5" value={riskTolerancePct} onChange={(e) => setRiskTolerancePct(Number(e.target.value))}
                style={{ width: 60, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#F8FAFC', padding: '4px 6px', fontSize: '0.72rem' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 10, color: '#F43F5E', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* ── Loading Spinner ── */}
      {loading && (
        <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <RefreshCw size={32} color="#6366F1" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ color: '#818CF8', fontWeight: 700 }}>Simulating {simulations.toLocaleString()} Stochastic Paths… Calculating Quantile Envelopes & VaR…</div>
        </div>
      )}

      {/* ── Main Data View ── */}
      {data && !loading && (
        <>
          {/* Options IV Alert / Context Banner */}
          {data.parameters?.iv_comparison_note && (
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '8px 14px', fontSize: '0.74rem', color: '#A5B4FC', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Activity size={14} />
              <span>{data.parameters.iv_comparison_note}</span>
            </div>
          )}

          {/* ── Key Quantitative Risk KPI Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            <MetricCard
              label="VaR 95% (Tail Risk)"
              value={`-${fmtNum(data.risk_metrics.var_95_pct)}%`}
              sub={`₹${fmtNum(data.risk_metrics.var_95_rupees)} max loss (5% tail)`}
              col="#F43F5E"
              icon={Shield}
            />
            <MetricCard
              label="CVaR 95% (Exp. Shortfall)"
              value={`-${fmtNum(data.risk_metrics.cvar_95_pct)}%`}
              sub={`₹${fmtNum(data.risk_metrics.cvar_95_rupees)} avg worst loss`}
              col="#F43F5E"
              icon={AlertTriangle}
            />
            <MetricCard
              label="VaR 99% (Extreme Tail)"
              value={`-${fmtNum(data.risk_metrics.var_99_pct)}%`}
              sub={`₹${fmtNum(data.risk_metrics.var_99_rupees)} (1% tail)`}
              col="#F87171"
              icon={Shield}
            />
            <MetricCard
              label="Expected Return"
              value={fmtPct(data.forecast_stats.expected_return_pct)}
              sub={`Mean Target: ${fmtRs(data.forecast_stats.expected_final_price)}`}
              col={data.forecast_stats.expected_return_pct >= 0 ? '#10B981' : '#F43F5E'}
              icon={TrendingUp}
            />
            <MetricCard
              label="Prob. of Profit"
              value={`${data.forecast_stats.prob_profit}%`}
              sub={`P(S > S0) over ${data.horizon_days}D`}
              col={data.forecast_stats.prob_profit >= 50 ? '#10B981' : '#F43F5E'}
              icon={Zap}
            />
            <MetricCard
              label="Max Simulated DD"
              value={`-${fmtNum(Math.abs(data.risk_metrics.worst_path_drawdown_pct))}%`}
              sub={`Worst peak-to-trough path`}
              col="#F59E0B"
              icon={TrendingDown}
            />
            <MetricCard
              label="Model Annualized Vol"
              value={`${data.parameters.model_vol_ann_pct}%`}
              sub={`Hist HV: ${data.parameters.historical_vol_ann_pct}%${data.parameters.options_market_iv_pct ? ` · IV: ${data.parameters.options_market_iv_pct}%` : ''}`}
              col="#818CF8"
              icon={Activity}
            />
          </div>

          {/* ── Sub Navigation Tabs ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'fan', label: 'Quantile Fan Chart & Paths', icon: Activity },
                { id: 'histogram', label: 'Terminal Distribution & Tail Histogram', icon: BarChart2 },
                { id: 'stress', label: 'Stress Testing & Scenarios', icon: Zap },
                { id: 'sizing', label: 'Position Sizing & Kelly Sizer', icon: Crosshair },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${activeTab === t.id ? 'rgba(99,102,241,0.5)' : 'transparent'}`, background: activeTab === t.id ? 'rgba(99,102,241,0.18)' : 'transparent', color: activeTab === t.id ? '#818CF8' : '#94A3B8', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={14} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'fan' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#94A3B8', cursor: 'pointer' }}>
                <input type="checkbox" checked={showSamplePaths} onChange={(e) => setShowSamplePaths(e.target.checked)}
                  style={{ accentColor: '#6366F1' }} />
                <span>Show 25 Sample Trajectories</span>
              </label>
            )}
          </div>

          {/* ── TAB 1: Quantile Fan Chart ── */}
          {activeTab === 'fan' && (
            <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span><span style={{ color: '#10B981' }}>■</span> P90/P95 (Bullish Envelope)</span>
                  <span><span style={{ color: '#6366F1' }}>■</span> P50 Median: <strong style={{ color: '#F8FAFC' }}>{fmtRs(data.forecast_stats.median_final_price)}</strong></span>
                  <span><span style={{ color: '#F43F5E' }}>■</span> P5/P10 (Bearish VaR 95% Cutoff: <strong style={{ color: '#F43F5E' }}>{fmtRs(data.risk_metrics.var_95_price)}</strong>)</span>
                  <span><span style={{ color: '#E2E8F0', borderBottom: '1px dashed #E2E8F0' }}>---</span> Spot Ref: {fmtRs(data.current_price)}</span>
                </div>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                  {data.method} · {data.simulations} Paths · {data.horizon_days}D Horizon
                </span>
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={data.envelope} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `₹${v.toFixed(0)}`} />
                  <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.74rem' }}
                    formatter={(v, name) => [`₹${Number(v).toFixed(2)}`, name]} />

                  {/* Spot reference */}
                  <ReferenceLine y={data.current_price} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" label={{ value: `Spot ₹${data.current_price}`, fill: '#94A3B8', fontSize: 10, position: 'insideTopLeft' }} />

                  {/* Outer Band: P5 - P95 */}
                  <Area type="monotone" dataKey="p95" stroke="#10B981" strokeWidth={1} strokeDasharray="3 3" fill="rgba(16,185,129,0.06)" name="P95 Upper" dot={false} />
                  <Area type="monotone" dataKey="p5" stroke="#F43F5E" strokeWidth={1} strokeDasharray="3 3" fill="rgba(244,63,94,0.06)" name="P5 Lower (VaR 95%)" dot={false} />

                  {/* Inner Band: P25 - P75 */}
                  <Area type="monotone" dataKey="p75" stroke="#F59E0B" strokeWidth={1.2} fill="rgba(99,102,241,0.12)" name="P75" dot={false} />
                  <Area type="monotone" dataKey="p25" stroke="#F59E0B" strokeWidth={1.2} fill="transparent" name="P25" dot={false} />

                  {/* Median & Mean */}
                  <Line type="monotone" dataKey="p50" stroke="#6366F1" strokeWidth={2.5} name="Median (P50)" dot={false} />
                  <Line type="monotone" dataKey="mean" stroke="#A855F7" strokeWidth={1.5} strokeDasharray="4 4" name="Mean Path" dot={false} />

                  {/* Sample Individual Random Paths */}
                  {showSamplePaths && data.sample_paths?.map((path, idx) => {
                    const formatted = path.map((pt, tIdx) => ({ label: `Day ${tIdx}`, [`sample_${idx}`]: pt }));
                    return (
                      <Line key={`s_${idx}`} data={formatted} type="monotone" dataKey={`sample_${idx}`} stroke="rgba(255,255,255,0.08)" strokeWidth={1} dot={false} isAnimationActive={false} legendType="none" />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── TAB 2: Terminal Distribution Histogram ── */}
          {activeTab === 'histogram' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                    Probability Density of Terminal Price at Day {data.horizon_days} (30 Bins) · Log-Normal vs Fat Tails
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.7rem' }}>
                    <span><span style={{ color: '#10B981' }}>■</span> Profitable Outlines ({data.forecast_stats.prob_profit}%)</span>
                    <span><span style={{ color: '#F43F5E' }}>■</span> Loss Outcomes ({fmtNum(100 - data.forecast_stats.prob_profit)}%)</span>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.histogram} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="bin_mid" stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}`} />
                    <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(v) => `${v}`} />
                    <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.74rem' }}
                      formatter={(v, name, item) => [`${v} Paths (${item.payload.pct}%)`, `Range: ₹${item.payload.bin_low} - ₹${item.payload.bin_high}`]} />
                    <ReferenceLine x={data.current_price} stroke="#F8FAFC" strokeDasharray="3 3" label={{ value: 'Spot', fill: '#F8FAFC', fontSize: 10 }} />
                    <ReferenceLine x={data.risk_metrics.var_95_price} stroke="#F43F5E" strokeDasharray="3 3" label={{ value: 'VaR 95%', fill: '#F43F5E', fontSize: 10 }} />
                    <Bar dataKey="count" name="Frequency">
                      {data.histogram?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.is_loss ? '#F43F5E' : '#10B981'} fillOpacity={0.75} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Distribution Stats Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <MetricCard label="P(Gain ≥ +10%)" value={`${data.forecast_stats.prob_gain_10}%`} col="#10B981" />
                <MetricCard label="P(Gain ≥ +20%)" value={`${data.forecast_stats.prob_gain_20}%`} col="#10B981" />
                <MetricCard label="P(Loss ≥ -10%)" value={`${data.forecast_stats.prob_loss_10}%`} col="#F43F5E" />
                <MetricCard label="P(Loss ≥ -20%)" value={`${data.forecast_stats.prob_loss_20}%`} col="#F43F5E" />
                <MetricCard label="Distribution Skewness" value={fmtNum(data.forecast_stats.skewness)} sub={data.forecast_stats.skewness < 0 ? 'Negative Skew (Crash Tail)' : 'Positive Skew'} col={data.forecast_stats.skewness >= 0 ? '#10B981' : '#F59E0B'} />
                <MetricCard label="Excess Kurtosis" value={fmtNum(data.forecast_stats.excess_kurtosis)} sub={data.forecast_stats.excess_kurtosis > 0 ? 'Leptokurtic (Fat Tails)' : 'Normal-like'} col={data.forecast_stats.excess_kurtosis > 0 ? '#C084FC' : '#94A3B8'} />
              </div>
            </div>
          )}

          {/* ── TAB 3: Stress Testing Laboratory ── */}
          {activeTab === 'stress' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Zap size={16} color="#F59E0B" />
                  <strong style={{ fontSize: '0.9rem' }}>Macro & Shock Stress Testing Presets</strong>
                </div>
                <p style={{ fontSize: '0.74rem', color: '#94A3B8', margin: '0 0 14px' }}>
                  Inject structural shocks to simulate severe market regimes. Stress testing evaluates if your position will survive extreme outlier shocks.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  {[
                    { id: 'none', title: 'Standard Simulation', desc: 'No synthetic shocks injected', icon: Activity, col: '#818CF8' },
                    { id: 'flash_crash', title: '⚡ Flash Crash Shock', desc: '-12% instant gap down on Day 3 + 1.6x Vol', icon: AlertTriangle, col: '#F43F5E' },
                    { id: 'bear_regime', title: '🐻 Structural Bear Market', desc: '-25% annualized drift & 40% high vol', icon: TrendingDown, col: '#F43F5E' },
                    { id: 'bull_breakout', title: '🐂 Bull Momentum Breakout', desc: '+8% jump + +30% positive drift', icon: TrendingUp, col: '#10B981' },
                    { id: 'high_vol_regime', title: '🌪️ 2x Volatility Explosion', desc: 'Zero drift with doubled dispersion', icon: Activity, col: '#F59E0B' },
                  ].map((scen) => {
                    const Icon = scen.icon;
                    const isSelected = (data.stress_scenario || 'none').toLowerCase() === scen.id;
                    return (
                      <div key={scen.id} onClick={() => handleScenarioPreset(scen.id)}
                        style={{
                          background: isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isSelected ? scen.col : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: 10, padding: 14, cursor: 'pointer', transition: 'all 0.15s ease'
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Icon size={16} color={scen.col} />
                          <strong style={{ fontSize: '0.82rem', color: isSelected ? '#F8FAFC' : '#CBD5E1' }}>{scen.title}</strong>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>{scen.desc}</div>
                        {isSelected && (
                          <div style={{ fontSize: '0.64rem', color: scen.col, fontWeight: 800, marginTop: 6, textTransform: 'uppercase' }}>
                            ● ACTIVE SCENARIO
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: Position Sizing & Kelly Sizer ── */}
          {activeTab === 'sizing' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              {/* VaR-Based Position Sizer */}
              <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Shield size={16} color="#10B981" />
                    <strong style={{ fontSize: '0.9rem' }}>VaR-Bounded Safe Position Sizer</strong>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#94A3B8', lineHeight: 1.5, margin: '0 0 14px' }}>
                    Calculates the maximum quantity of shares you can hold such that the 95% worst-case loss does NOT exceed your acceptable risk budget of <strong style={{ color: '#F8FAFC' }}>{fmtRs(data.position_sizing.max_loss_budget_rupees)}</strong> ({data.position_sizing.risk_tolerance_pct}% of capital).
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <MetricCard label="Recommended Quantity" value={`${data.position_sizing.recommended_shares} Shares`} col="#10B981" />
                    <MetricCard label="Position Capital Value" value={fmtRs(data.position_sizing.recommended_position_value)} col="#10B981" />
                    <MetricCard label="Portfolio Allocation" value={`${data.position_sizing.position_pct_of_portfolio}%`} sub={`of ${fmtRs(data.position_sizing.portfolio_capital)}`} col="#818CF8" />
                    <MetricCard label="Max 95% Loss Impact" value={fmtRs(data.position_sizing.max_loss_budget_rupees)} sub="Bounded Budget" col="#F43F5E" />
                  </div>
                </div>

                <button onClick={() => handleApplyToPaperTrade(data.position_sizing.recommended_shares)}
                  style={{ background: 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 8, padding: '9px 14px', color: '#fff', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span>Execute {data.position_sizing.recommended_shares} Shares in Paper Trading</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Kelly Criterion Card */}
              <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Crosshair size={16} color="#C084FC" />
                  <strong style={{ fontSize: '0.9rem' }}>Kelly Criterion Optimal Growth Sizing</strong>
                </div>
                <p style={{ fontSize: '0.74rem', color: '#94A3B8', lineHeight: 1.5, margin: '0 0 14px' }}>
                  The Kelly formula calculates the mathematically optimal fraction of capital to allocate to maximize geometric compound growth rate based on win probability and payoff skew.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <MetricCard label="Half-Kelly Fraction" value={`${(data.position_sizing.half_kelly_fraction * 100).toFixed(1)}%`} sub="Institutional Standard" col="#C084FC" />
                  <MetricCard label="Half-Kelly Capital" value={fmtRs(data.position_sizing.half_kelly_capital)} sub="Optimal Sizing" col="#C084FC" />
                </div>

                <div style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)', borderRadius: 8, padding: '8px 12px', fontSize: '0.7rem', color: '#D8B4FE' }}>
                  💡 <strong>Quant Note:</strong> Half-Kelly is preferred by quantitative funds because it provides 75% of full-Kelly growth with 50% less volatility and drastically lower drawdown risk.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
