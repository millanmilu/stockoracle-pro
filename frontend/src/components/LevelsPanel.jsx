import { useEffect, useState } from 'react'
import { useStock } from '../hooks/useStock'
import { fmt } from '../utils/formatters'

function LevelRow({ label, price, currentPrice, color, badge }) {
  const pctAway = currentPrice ? ((price - currentPrice) / currentPrice * 100) : 0
  const isAbove  = price > currentPrice

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 14px',
      background: `${color}08`,
      border: `1px solid ${color}18`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8, marginBottom: 4,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {badge && (
          <span style={{
            fontSize: '0.62rem', background: `${color}22`, color, padding: '1px 6px',
            borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>{badge}</span>
        )}
        <span style={{ fontSize: '0.82rem', color: '#9CA3AF' }}>{label}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color, fontSize: '0.9rem' }}>
          {fmt.price(price)}
        </div>
        <div style={{ fontSize: '0.68rem', color: isAbove ? '#10B981' : '#F43F5E' }}>
          {isAbove ? '▲' : '▼'} {Math.abs(pctAway).toFixed(2)}% away
        </div>
      </div>
    </div>
  )
}

export default function LevelsPanel({ ticker }) {
  const { fetchLevels } = useStock()
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(null)
    fetchLevels(ticker).then(setData)
  }, [ticker])

  if (!data) return <div className="spinner" />

  const { current_price, pivot_point, resistance_1, resistance_2, resistance_3,
          support_1, support_2, support_3, swing_resistances = [], swing_supports = [],
          fibonacci = {}, period_high, period_low } = data || {}

  const fibEntries = Object.entries(fibonacci || {})

  return (
    <div>
      {/* Current price indicator */}
      <div style={{
        padding: '12px 16px', marginBottom: 18,
        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Current Price</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.1rem', color: '#A5B4FC' }}>
          {fmt.price(current_price)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Resistances */}
        <div>
          <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Resistance Levels
          </div>
          <LevelRow label="R3 (Pivot)"  price={resistance_3} currentPrice={current_price} color="#F43F5E" badge="R3" />
          <LevelRow label="R2 (Pivot)"  price={resistance_2} currentPrice={current_price} color="#FB7185" badge="R2" />
          <LevelRow label="R1 (Pivot)"  price={resistance_1} currentPrice={current_price} color="#FCA5A5" badge="R1" />
          <LevelRow label="Pivot Point" price={pivot_point}   currentPrice={current_price} color="#A5B4FC" badge="PP" />
          {swing_resistances.map((r, i) => (
            <LevelRow key={i} label={`Swing High ${i + 1}`} price={r} currentPrice={current_price} color="#F87171" badge="SW" />
          ))}
        </div>

        {/* Supports */}
        <div>
          <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Support Levels
          </div>
          <LevelRow label="Swing Low 1" price={swing_supports[0] || support_1} currentPrice={current_price} color="#34D399" badge="SW" />
          <LevelRow label="S1 (Pivot)"  price={support_1} currentPrice={current_price} color="#6EE7B7" badge="S1" />
          <LevelRow label="S2 (Pivot)"  price={support_2} currentPrice={current_price} color="#10B981" badge="S2" />
          <LevelRow label="S3 (Pivot)"  price={support_3} currentPrice={current_price} color="#059669" badge="S3" />
          {swing_supports.slice(1).map((s, i) => (
            <LevelRow key={i} label={`Swing Low ${i + 2}`} price={s} currentPrice={current_price} color="#6EE7B7" badge="SW" />
          ))}
        </div>
      </div>

      {/* Fibonacci */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Fibonacci Retracement (52-Week: {fmt.price(period_low)} → {fmt.price(period_high)})
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {fibEntries.map(([key, val]) => {
            const label = key.replace('fib_', '').replace('0', '0%').replace('236', '23.6%')
              .replace('382', '38.2%').replace('500', '50%').replace('618', '61.8%')
              .replace('786', '78.6%').replace('100', '100%')
            const isNear = Math.abs(val - current_price) / current_price < 0.02
            return (
              <div key={key} style={{
                padding: '6px 10px', borderRadius: 8, textAlign: 'center',
                background: isNear ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.06)',
                border: `1px solid ${isNear ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.12)'}`,
              }}>
                <div style={{ fontSize: '0.62rem', color: '#6B7280' }}>{label}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: isNear ? '#A5B4FC' : '#9CA3AF', fontWeight: isNear ? 700 : 400 }}>
                  {fmt.price(val)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: '0.72rem', color: '#374151' }}>
        📋 Pivot Points calculated from last session OHLC. Swing levels from fractal detection over last 120 days.
      </div>
    </div>
  )
}
