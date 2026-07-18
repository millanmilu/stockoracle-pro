import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const API = import.meta.env.VITE_API_URL || ''

export default function MonteCarlo({ ticker }) {
  const [mc, setMc]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ticker) return
    setLoading(true); setError(null); setMc(null)
    axios.get(`${API}/api/stock/${ticker}/montecarlo`)
      .then(r => setMc(r.data))
      .catch(() => setError('Failed to fetch Monte Carlo data'))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) return <div className="spinner" />
  if (error)   return <div style={{ color: '#F43F5E', padding: 16 }}>{error}</div>
  if (!mc)     return null

  const days = Array.from({ length: mc.p50.length }, (_, i) => `Day ${i}`)

  const dataset = (label, data, color, dashed) => ({
    label, data,
    borderColor: color,
    borderWidth: label === 'Median (P50)' ? 2.5 : 1.5,
    borderDash: dashed ? [5, 4] : [],
    pointRadius: 0,
    tension: 0.3,
    fill: false,
  })

  const chartData = {
    labels: days,
    datasets: [
      dataset('P10 (Bearish)',  mc.p10, '#F43F5E', true),
      dataset('P25',            mc.p25, '#F59E0B', true),
      dataset('Median (P50)',   mc.p50, '#6366F1', false),
      dataset('P75',            mc.p75, '#F59E0B', true),
      dataset('P90 (Bullish)',  mc.p90, '#10B981', true),
    ]
  }

  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#9CA3AF', boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#0C1022', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1,
        titleColor: '#F0F0FF', bodyColor: '#9CA3AF',
        callbacks: { label: ctx => ` ${ctx.dataset.label}: $${Number(ctx.raw).toFixed(2)}` }
      }
    },
    scales: {
      x: { ticks: { color: '#4B5563', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: 'rgba(99,102,241,0.06)' } },
      y: { ticks: { color: '#4B5563', font: { size: 10 }, callback: v => `$${v.toFixed(0)}` }, grid: { color: 'rgba(99,102,241,0.06)' } }
    }
  }

  const probUp      = (mc.prob_up * 100).toFixed(1)
  const expRet      = (mc.expected_return * 100).toFixed(2)
  const medianPrice = mc.p50[mc.p50.length - 1]

  const stats = [
    { label: 'Prob. Up',        value: `${probUp}%`,           color: mc.prob_up > 0.5 ? '#10B981' : '#F43F5E' },
    { label: 'VaR 95%',         value: `$${mc.var_95.toFixed(2)}`,  color: '#F43F5E' },
    { label: 'CVaR 95%',        value: `$${mc.cvar_95.toFixed(2)}`, color: '#F43F5E' },
    { label: 'Expected Return',  value: `${expRet}%`,           color: mc.expected_return >= 0 ? '#10B981' : '#F43F5E' },
    { label: 'Median Target',    value: `$${medianPrice.toFixed(2)}`, color: '#6366F1' },
    { label: 'Horizon',          value: '30 Days',              color: '#9CA3AF' },
  ]

  return (
    <div>
      <div className="chart-wrap" style={{ height: 280 }}>
        <Line data={chartData} options={opts} />
      </div>
      <div className="mc-stats" style={{ marginTop: 16 }}>
        {stats.map(s => (
          <div key={s.label} className="mc-stat">
            <div className="mc-stat-label">{s.label}</div>
            <div className="mc-stat-value" style={{ color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
