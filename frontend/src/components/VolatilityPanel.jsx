import { useEffect, useState } from 'react'
import { useStock } from '../hooks/useStock'
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine, Legend,
} from 'recharts'

const REGIME_COLOR = {
  'High Volatility': '#F43F5E',
  'Normal':          '#A5B4FC',
  'Low Volatility':  '#10B981',
}

function StatCard({ label, value, unit = '', color = '#A5B4FC' }) {
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 12,
      background: 'rgba(6,9,24,0.6)', border: '1px solid rgba(99,102,241,0.15)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: '0.68rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.2rem', color }}>
        {value}<span style={{ fontSize: '0.7rem', marginLeft: 2, color: '#6B7280' }}>{unit}</span>
      </span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(12,16,34,0.95)', border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem',
    }}>
      <div style={{ color: '#6B7280', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value?.toFixed(2)}%</strong>
        </div>
      ))}
    </div>
  )
}

export default function VolatilityPanel({ ticker }) {
  const { fetchVolatility } = useStock()
  const [data, setData]     = useState(null)

  useEffect(() => {
    setData(null)
    fetchVolatility(ticker).then(setData)
  }, [ticker])

  if (!data) return <div className="spinner" />

  const {
    current_vol_pct = 0, avg_vol_pct = 0, vol_percentile = 0,
    regime = 'Normal', garch_params = { omega: 0, alpha: 0, beta: 0 }, rolling_history = [], forecast = [],
  } = data || {}

  const regimeColor = REGIME_COLOR[regime] || '#A5B4FC'

  // Combine history + forecast for chart
  const histPoints  = (rolling_history || []).map(p => ({ date: p.date, historical: p.vol }))
  const fcastPoints = (forecast || []).map(p => ({ date: p.date, forecast: p.vol, upper: p.upper, lower: p.lower }))

  // Show last 30 history + all forecast
  const chartData   = [...histPoints.slice(-30), ...fcastPoints]

  // Add separator line index
  const splitIdx    = histPoints.slice(-30).length

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <StatCard label="Current Vol" value={current_vol_pct?.toFixed(1) ?? '0.0'} unit="%" color={regimeColor} />
        <StatCard label="1Y Avg Vol"  value={avg_vol_pct?.toFixed(1) ?? '0.0'}     unit="%" />
        <StatCard label="Vol Percentile" value={vol_percentile?.toFixed(0) ?? '0'} unit="th" color={vol_percentile > 70 ? '#F43F5E' : vol_percentile < 30 ? '#10B981' : '#F59E0B'} />
        <StatCard label="Regime"       value={String(regime || '').replace(' Volatility', '')} unit="" color={regimeColor} />
      </div>

      {/* GARCH params */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap',
        padding: '10px 14px', background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.12)', borderRadius: 12,
        fontSize: '0.75rem', color: '#6B7280',
      }}>
        <span style={{ color: '#9CA3AF', fontWeight: 600 }}>GARCH(1,1)</span>
        <span>ω = <code style={{ color: '#A5B4FC' }}>{garch_params.omega.toFixed(6)}</code></span>
        <span>α = <code style={{ color: '#F59E0B' }}>{garch_params.alpha.toFixed(4)}</code></span>
        <span>β = <code style={{ color: '#10B981' }}>{garch_params.beta.toFixed(4)}</code></span>
        <span>Persistence = <code style={{ color: '#C084FC' }}>{(garch_params.alpha + garch_params.beta).toFixed(4)}</code></span>
      </div>

      {/* Chart */}
      <div style={{
        background: 'rgba(6,9,24,0.6)', border: '1px solid rgba(99,102,241,0.12)',
        borderRadius: 14, padding: '16px 8px',
      }}>
        <div style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: 8, paddingLeft: 8 }}>
          Historical Volatility + GARCH(1,1) 30-Day Forecast (Annualised %)
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0}   />
              </linearGradient>
              <linearGradient id="fcastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
            <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 9 }} tickLine={false}
              tickFormatter={d => d ? d.slice(5) : ''} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.72rem' }} />

            {/* Reference line at split point */}
            <ReferenceLine x={chartData[splitIdx - 1]?.date} stroke="rgba(255,255,255,0.2)"
              strokeDasharray="4 4" label={{ value: 'Now', fill: '#6B7280', fontSize: 9, position: 'insideTopRight' }} />

            <Area type="monotone" dataKey="historical" name="Historical Vol %" fill="url(#volGrad)"
              stroke="#6366F1" strokeWidth={2} dot={false} connectNulls />
            <Area type="monotone" dataKey="upper" name="Upper Band" fill="url(#fcastGrad)"
              stroke="transparent" dot={false} connectNulls />
            <Area type="monotone" dataKey="lower" name="Lower Band" fill="rgba(255,255,255,0)"
              stroke="transparent" dot={false} connectNulls />
            <Line type="monotone" dataKey="forecast" name="GARCH Forecast %" stroke="#F59E0B"
              strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: 12, fontSize: '0.72rem', color: '#374151', lineHeight: 1.6 }}>
        📋 Volatility estimated from 20-day rolling log returns. GARCH(1,1) parameters estimated via method of moments.
        Higher persistence (α+β close to 1) means volatility shocks decay slowly.
      </div>
    </div>
  )
}
