import { useState, useEffect } from 'react'
import axios from 'axios'
import { fmt, signalLabel, signalColor } from '../utils/formatters'

const API = import.meta.env.VITE_API_URL || ''

export default function Screener({ onSelect }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')
  const [sigFilter, setSigFilter] = useState('all')

  useEffect(() => {
    axios.get(`${API}/api/screener`)
      .then(r => setRows(r.data))
      .catch(() => setError('Failed to load screener data.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = rows.filter(r => {
    const matchSearch = r.ticker.includes(search.toUpperCase()) || r.name?.toLowerCase().includes(search.toLowerCase())
    const matchSig    = sigFilter === 'all' || r.signal === sigFilter
    return matchSearch && matchSig
  })

  if (loading) return <div className="spinner" />
  if (error)   return <div style={{ color: '#F43F5E', padding: 16 }}>{error}</div>

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrap" style={{ maxWidth: 260 }}>
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Filter by ticker or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={sigFilter}
          onChange={e => setSigFilter(e.target.value)}
          style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, color: '#F0F0FF', padding: '8px 12px', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
        >
          <option value="all">All Signals</option>
          <option value="strong-buy">Strong Buy</option>
          <option value="buy">Buy</option>
          <option value="hold">Hold</option>
          <option value="sell">Sell</option>
          <option value="strong-sell">Strong Sell</option>
        </select>
        <span style={{ color: '#4B5563', fontSize: '0.8rem', marginLeft: 'auto' }}>
          Showing <strong style={{ color: '#9CA3AF' }}>{filtered.length}</strong> results
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="screener-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Company</th>
              <th>Price</th>
              <th>Change</th>
              <th>AI Score</th>
              <th>Signal</th>
              <th>7D Predicted</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <div className="empty-state-text">No stocks match your filters</div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map(r => {
              const changeUp   = r.change >= 0
              const scoreColor = r.ai_score >= 70 ? '#10B981' : r.ai_score >= 50 ? '#F59E0B' : '#F43F5E'
              const predUp     = r.predicted_pct >= 0

              return (
                <tr key={r.ticker} onClick={() => onSelect(r.ticker)}>
                  <td><span className="ticker-badge">{r.ticker}</span></td>
                  <td style={{ color: '#9CA3AF', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmt.price(r.price)}</td>
                  <td style={{ color: changeUp ? '#10B981' : '#F43F5E', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                    {fmt.pct(r.change)}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: scoreColor }}>
                      {r.ai_score}
                    </span>
                  </td>
                  <td>
                    <span className={`signal-pill signal-${r.signal}`}>
                      {signalLabel(r.signal)}
                    </span>
                  </td>
                  <td style={{ color: predUp ? '#10B981' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                    {r.predicted_pct != null ? `${r.predicted_pct >= 0 ? '+' : ''}${r.predicted_pct.toFixed(2)}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
