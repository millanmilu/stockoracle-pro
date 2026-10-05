import {
  Sliders,
  Calendar,
  Activity
} from 'lucide-react';
import { cardStyle, labelStyle } from './styles';
import { RatioCard } from './Primitives';

export default function ValuationSection({
  liveDcf,
  dcfGrowthRate,
  setDcfGrowthRate,
  dcfWacc,
  setDcfWacc,
  dcfTerminalGrowth,
  setDcfTerminalGrowth,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Top Valuation Targets Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <RatioCard
          label="Live DCF Fair Value"
          value={liveDcf.fairValue}
          unit=" ₹"
          colorFn={() => '#10B981'}
          sub={liveDcf.marginOfSafetyPct != null ? `Margin of Safety: ${liveDcf.marginOfSafetyPct >= 0 ? '+' : ''}${liveDcf.marginOfSafetyPct}%` : (liveDcf.cmp == null ? 'CMP unavailable — comparison hidden' : 'EPS unavailable — cannot value')}
        />
        <RatioCard
          label="Benjamin Graham Value"
          value={liveDcf.grahamNumber}
          unit=" ₹"
          colorFn={() => '#818CF8'}
          sub="√(22.5 × EPS × BVPS)"
        />
        <RatioCard
          label="Peter Lynch Target"
          value={liveDcf.peterLynchValue}
          unit=" ₹"
          colorFn={() => '#C084FC'}
          sub="EPS × Growth Multiple"
        />
        <RatioCard
          label="Current Market Price"
          value={liveDcf.cmp}
          unit=" ₹"
          colorFn={() => '#F8FAFC'}
          sub={liveDcf.marginOfSafetyPct == null ? 'No CMP comparison available' : (liveDcf.marginOfSafetyPct >= 0 ? 'Trading at Intrinsic Discount' : 'Trading at Intrinsic Premium')}
        />
      </div>

      {/* ── Interactive DCF Parameter Sandbox Controls ── */}
      <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.3)', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(15,23,42,0.95))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sliders size={15} color="#818CF8" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>Interactive DCF Valuation Sandbox</span>
                <span style={{ fontSize: '0.60rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', color: '#818CF8', fontWeight: 800 }}>Live Recalculation</span>
              </div>
              <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Adjust growth rate, cost of capital (WACC), and terminal rate to recalculate fair value in real time</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 10 }}>
          {/* Slider 1: 5-Year FCF Growth Rate */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={labelStyle}>5-Year FCF Growth Rate</span>
              <span style={{ fontSize: '0.90rem', fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
                {dcfGrowthRate.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="0.5"
              value={dcfGrowthRate}
              onChange={e => setDcfGrowthRate(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#6366F1', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.60rem', color: '#64748B', marginTop: 4 }}>
              <span>Conservative (5%)</span>
              <span>Aggressive (30%)</span>
            </div>
          </div>

          {/* Slider 2: Discount Rate (WACC) */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={labelStyle}>Discount Rate (WACC)</span>
              <span style={{ fontSize: '0.90rem', fontWeight: 800, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
                {dcfWacc.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="8"
              max="16"
              step="0.5"
              value={dcfWacc}
              onChange={e => setDcfWacc(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#F59E0B', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.60rem', color: '#64748B', marginTop: 4 }}>
              <span>Low Cost (8%)</span>
              <span>High Risk (16%)</span>
            </div>
          </div>

          {/* Slider 3: Terminal Growth Rate */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={labelStyle}>Terminal Growth Rate (g)</span>
              <span style={{ fontSize: '0.90rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
                {dcfTerminalGrowth.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="7"
              step="0.5"
              value={dcfTerminalGrowth}
              onChange={e => setDcfTerminalGrowth(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#10B981', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.60rem', color: '#64748B', marginTop: 4 }}>
              <span>GDP Proxy (2%)</span>
              <span>High Perpetual (7%)</span>
            </div>
          </div>
        </div>

        {/* PV Decomposition Strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.70rem', color: '#94A3B8' }}>
          <span>5-Year PV of FCFs: <strong style={{ color: '#818CF8' }}>{liveDcf.fairValue != null ? `₹${liveDcf.pvSum}` : '—'}</strong></span>
          <span>•</span>
          <span>Discounted Terminal Value (Terminal Rate: <strong style={{ color: '#10B981' }}>{dcfTerminalGrowth.toFixed(1)}%</strong>): <strong style={{ color: '#10B981' }}>{liveDcf.fairValue != null ? `₹${liveDcf.pvTerminal}` : '—'}</strong></span>
          <span>•</span>
          <span>Implied Fair Value: <strong style={{ color: '#F8FAFC', fontSize: '0.86rem' }}>{liveDcf.fairValue != null ? `₹${liveDcf.fairValue}` : '—'}</strong></span>
        </div>
      </div>

      {/* ── 5-Year Projected FCF Waterfall Table ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={15} color="#818CF8" />
            </div>
            <div>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>5-Year Projected Free Cash Flows (FCF) & Present Values</span>
              <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Explicit year-by-year discounting using dynamic WACC</div>
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
          <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Projection Year</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Projected FCF / Share (₹)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Discount Factor</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)', whiteSpace: 'nowrap' }}>Present Value (PV ₹)</th>
              </tr>
            </thead>
            <tbody>
              {liveDcf.projected.map((p, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                  <td style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#F0F0FF', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{p.year}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>₹{p.fcf}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{p.discountFactor}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: '#10B981', fontWeight: 800 }}>₹{p.pv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2D Sensitivity Heatmap Matrix ── */}
      <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={15} color="#818CF8" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F0F0FF' }}>2D Valuation Sensitivity Matrix (WACC vs Terminal Growth)</span>
                <span style={{ fontSize: '0.60rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', color: '#818CF8', fontWeight: 800 }}>Stress Testing</span>
              </div>
              <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 1 }}>Fair value under 30 macroeconomic scenarios (Green = Undervalued, Amber = Fair, Red = Overvalued)</div>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
          <table style={{ width: '100%', minWidth: 580, borderCollapse: 'collapse', fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.1)', whiteSpace: 'nowrap' }}>WACC \ Term. g</th>
                {liveDcf.tgSteps.map(tg => (
                  <th key={tg} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#94A3B8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(99,102,241,0.25)', background: Math.abs(tg - dcfTerminalGrowth) < 0.25 ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.06)', whiteSpace: 'nowrap' }}>
                    {tg.toFixed(1)}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liveDcf.sensitivityMatrix.map((row, rIdx) => {
                const isSelectedWacc = Math.abs(row.wacc - dcfWacc) < 0.5;
                return (
                  <tr key={rIdx} style={{ background: isSelectedWacc ? 'rgba(99,102,241,0.08)' : (rIdx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent') }}>
                    <td style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', color: isSelectedWacc ? '#818CF8' : '#CBD5E1', fontWeight: isSelectedWacc ? 900 : 600 }}>
                      {row.wacc.toFixed(1)}% {isSelectedWacc ? '◀' : ''}
                    </td>
                    {liveDcf.tgSteps.map(tg => {
                      const val = row[`tg_${tg}`];
                      if (val == null) {
                        return (
                          <td
                            key={tg}
                            title={liveDcf.fairValue == null ? 'EPS unavailable — cannot value under this scenario' : 'Mathematically undefined when WACC ≤ Terminal Growth Rate'}
                            style={{ padding: '9px 12px', textAlign: 'right', color: '#64748B', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'help' }}
                          >
                            —
                          </td>
                        );
                      }
                      const diffPct = liveDcf.cmp != null && liveDcf.cmp > 0 ? ((val - liveDcf.cmp) / liveDcf.cmp) * 100 : null;
                      const isSelectedCell = isSelectedWacc && Math.abs(tg - dcfTerminalGrowth) < 0.25;

                      const bgColor = isSelectedCell
                        ? 'rgba(99,102,241,0.45)'
                        : diffPct == null
                          ? 'rgba(148,163,184,0.10)'
                          : diffPct > 15
                            ? 'rgba(16,185,129,0.14)'
                            : diffPct < -15
                              ? 'rgba(239,83,80,0.14)'
                              : 'rgba(245,158,11,0.12)';

                      const textColor = isSelectedCell
                        ? '#FFFFFF'
                        : diffPct == null ? '#94A3B8' : diffPct > 15 ? '#10B981' : diffPct < -15 ? '#EF5350' : '#F59E0B';

                      return (
                        <td key={tg} style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', background: bgColor, color: textColor, fontWeight: isSelectedCell ? 900 : 700, border: isSelectedCell ? '1px solid #818CF8' : 'none' }}>
                          ₹{val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 8, fontSize: '0.60rem', color: '#64748B', fontStyle: 'italic' }}>
          * Highlighted cell denotes active sandbox parameters. {liveDcf.cmp != null ? `Colors reflect intrinsic upside/downside vs CMP (₹${liveDcf.cmp}).` : 'CMP unavailable — cells shown without upside/downside coloring.'}
        </div>
      </div>
    </div>
  );
}
