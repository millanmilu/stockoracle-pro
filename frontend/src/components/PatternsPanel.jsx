import { useEffect, useState } from 'react'
import { useStock } from '../hooks/useStock'
import { fmt } from '../utils/formatters'

const DIRECTION_COLOR = {
  bullish: '#10B981',
  bearish: '#F43F5E',
  neutral: '#F59E0B',
}

const DIRECTION_ICON = {
  bullish: '🟢',
  bearish: '🔴',
  neutral: '🟡',
}

const STRENGTH_LABEL = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐']

export default function PatternsPanel({ ticker }) {
  const { fetchPatterns } = useStock()
  const [data, setData]   = useState(null)

  useEffect(() => {
    setData(null)
    fetchPatterns(ticker).then(setData)
  }, [ticker])

  if (!data) return <div className="spinner" />

  const { patterns, bullish, bearish, neutral, total, bias_score, bias_label } = data
  const biasColor = bias_score > 55 ? '#10B981' : bias_score < 45 ? '#F43F5E' : '#F59E0B'

  return (
    <div>
      {/* Bias Gauge */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center',
        padding: '14px 18px', background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Pattern Bias (last 45 days)
          </div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: biasColor }}>
            {bias_label}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: '0.78rem' }}>
            <span style={{ color: '#10B981' }}>🟢 {bullish} Bullish</span>
            <span style={{ color: '#F43F5E' }}>🔴 {bearish} Bearish</span>
            <span style={{ color: '#F59E0B' }}>🟡 {neutral} Neutral</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: '#6B7280', marginBottom: 4 }}>BIAS SCORE</div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 800,
            fontSize: '2rem', color: biasColor,
          }}>{bias_score}</div>
          <div style={{ fontSize: '0.68rem', color: '#4B5563' }}>/ 100</div>
        </div>
      </div>

      {/* Bias bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#4B5563', marginBottom: 4 }}>
          <span>Bearish</span><span>Neutral</span><span>Bullish</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: 'rgba(99,102,241,0.1)', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${bias_score}%`,
            background: `linear-gradient(90deg, #F43F5E, #F59E0B 50%, #10B981)`,
            borderRadius: 99, transition: 'width 0.6s ease',
          }} />
          <div style={{
            position: 'absolute', top: -2, left: `${bias_score}%`,
            transform: 'translateX(-50%)',
            width: 12, height: 12, borderRadius: '50%',
            background: biasColor, border: '2px solid #0C1022',
            transition: 'left 0.6s ease',
          }} />
        </div>
      </div>

      {/* Pattern list */}
      {patterns.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🕯️</div>
          <div className="empty-state-text">No significant candlestick patterns in the last 45 days</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {patterns.slice(0, 15).map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: 'rgba(6,9,24,0.6)',
              border: `1px solid ${DIRECTION_COLOR[p.direction]}22`,
              borderLeft: `3px solid ${DIRECTION_COLOR[p.direction]}`,
              borderRadius: 10,
            }}>
              <span style={{ fontSize: '1rem' }}>{DIRECTION_ICON[p.direction]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: DIRECTION_COLOR[p.direction] }}>
                  {p.pattern}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#4B5563', marginTop: 2 }}>
                  {p.date} · Close: {fmt.price(p.close)}
                  <span style={{ marginLeft: 8, color: p.change_pct >= 0 ? '#10B981' : '#F43F5E' }}>
                    {p.change_pct >= 0 ? '+' : ''}{p.change_pct}%
                  </span>
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                {STRENGTH_LABEL[p.strength]}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: '0.72rem', color: '#374151', lineHeight: 1.6 }}>
        📋 Patterns detected using candlestick recognition on daily OHLC data. Strength ⭐–⭐⭐⭐⭐⭐ indicates reliability.
      </div>
    </div>
  )
}
