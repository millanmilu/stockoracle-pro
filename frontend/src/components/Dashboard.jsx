import { useState, useEffect, useCallback } from 'react'
import { useStock } from '../hooks/useStock'
import { useWebSocket } from '../hooks/useWebSocket'
import { fmt, signalLabel, signalColor } from '../utils/formatters'
import StockChart from './StockChart'
import PredictionPanel from './PredictionPanel'
import TechnicalPanel from './TechnicalPanel'
import MonteCarlo from './MonteCarlo'
import AITraining from './AITraining'
import Screener from './Screener'

const POPULAR = [
  { ticker: 'AAPL', name: 'Apple Inc.' },
  { ticker: 'TSLA', name: 'Tesla Inc.' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.' },
  { ticker: 'MSFT', name: 'Microsoft Corp.' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.' },
  { ticker: 'META', name: 'Meta Platforms' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.' },
  { ticker: 'AMD',  name: 'Advanced Micro Devices' },
  { ticker: 'NFLX', name: 'Netflix Inc.' },
  { ticker: 'JPM',  name: 'JPMorgan Chase' },
]

const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'screener',  icon: '🔍', label: 'Screener'  },
  { id: 'ailab',     icon: '🧠', label: 'AI Lab'    },
]

export default function Dashboard() {
  const [page, setPage]               = useState('dashboard')
  const [search, setSearch]           = useState('')
  const [showDropdown, setDropdown]   = useState(false)
  const [livePrices, setLivePrices]   = useState({})
  const [selected, setSelected]       = useState(null)   // ticker string for detail overlay
  const [overlayTab, setOverlayTab]   = useState('prediction')
  const [detail, setDetail]           = useState({ info: null, history: null, prediction: null })
  const [timeframe, setTimeframe]     = useState('3M')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [apiOnline, setApiOnline]     = useState(false)

  const { fetchInfo, fetchHistory, fetchPredict } = useStock()

  // WebSocket live prices
  const wsConnected = useWebSocket(msg => {
    setLivePrices(prev => ({ ...prev, [msg.ticker]: { price: msg.price, change_pct: msg.change_pct } }))
  })

  // Check API health
  useEffect(() => {
    fetch('/api/health').then(r => r.ok && setApiOnline(true)).catch(() => {})
  }, [])

  // Load stock detail when selected changes
  useEffect(() => {
    if (!selected) return
    setLoadingDetail(true)
    setDetail({ info: null, history: null, prediction: null })
    Promise.all([
      fetchInfo(selected),
      fetchHistory(selected, timeframe),
      fetchPredict(selected),
    ]).then(([info, history, prediction]) => {
      setDetail({ info, history, prediction })
    }).finally(() => setLoadingDetail(false))
  }, [selected])

  // Reload history when timeframe changes (within detail overlay)
  useEffect(() => {
    if (!selected) return
    fetchHistory(selected, timeframe).then(history => setDetail(d => ({ ...d, history })))
  }, [timeframe])

  const openDetail = (ticker) => {
    setSelected(ticker)
    setOverlayTab('prediction')
    setTimeframe('3M')
  }

  const closeDetail = () => setSelected(null)

  const searchResults = search.trim().length > 0
    ? POPULAR.filter(s =>
        s.ticker.startsWith(search.toUpperCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase())
      )
    : []

  const getDisplayPrice = (ticker, basePrice) => {
    const live = livePrices[ticker]
    return live ? live.price : basePrice
  }

  const getDisplayChange = (ticker, baseChange) => {
    const live = livePrices[ticker]
    return live ? live.change_pct : baseChange
  }

  return (
    <div className="app-layout">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">⬡ StockOracle</div>
          <div className="sidebar-logo-sub">Advanced AI Analytics</div>
        </div>

        {NAV.map(n => (
          <button
            key={n.id}
            className={`nav-item ${page === n.id ? 'active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="api-status">
            <div className={`status-dot ${apiOnline ? '' : 'offline'}`} />
            <span>API {apiOnline ? 'Online' : 'Offline'}</span>
          </div>
          <div className="api-status" style={{ marginTop: 6 }}>
            <div className={`status-dot ${wsConnected ? '' : 'offline'}`} />
            <span>WS {wsConnected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="main-content">
        {/* Top Bar */}
        <div className="top-bar">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Search ticker or company…"
              value={search}
              onChange={e => { setSearch(e.target.value); setDropdown(true) }}
              onBlur={() => setTimeout(() => setDropdown(false), 150)}
              onFocus={() => search && setDropdown(true)}
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map(s => (
                  <div
                    key={s.ticker}
                    className="search-item"
                    onMouseDown={() => { openDetail(s.ticker); setSearch(''); setDropdown(false) }}
                  >
                    <span className="search-item-ticker">{s.ticker}</span>
                    <span className="search-item-name">{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <span style={{ color: '#4B5563', fontSize: '0.78rem', marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* ── PAGE CONTENT ── */}
        <div className="page-area">

          {/* DASHBOARD PAGE */}
          {page === 'dashboard' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
                  Market Overview
                </h1>
                <p style={{ color: '#4B5563', fontSize: '0.85rem' }}>
                  Real-time AI predictions powered by PyTorch BiLSTM + Attention
                </p>
              </div>
              <div className="dashboard-grid">
                {POPULAR.map(s => {
                  const livePrice  = livePrices[s.ticker]?.price
                  const liveChange = livePrices[s.ticker]?.change_pct
                  const changeUp   = (liveChange ?? 0) >= 0

                  return (
                    <div key={s.ticker} className="stock-card" onClick={() => openDetail(s.ticker)}>
                      <div className="stock-card-header">
                        <div>
                          <div className="stock-card-ticker">{s.ticker}</div>
                          <div className="stock-card-name">{s.name}</div>
                        </div>
                        <div className="ai-badge">
                          <div className="ai-badge-score">AI</div>
                          <div className="ai-badge-label">Live</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span className="stock-card-price">
                          {livePrice ? fmt.price(livePrice) : '—'}
                        </span>
                        {liveChange != null && (
                          <span className={`stock-card-change ${changeUp ? 'change-up' : 'change-down'}`}>
                            {liveChange >= 0 ? '+' : ''}{liveChange.toFixed(3)}%
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <span style={{ fontSize: '0.75rem', color: '#4B5563' }}>Click for AI analysis →</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* SCREENER PAGE */}
          {page === 'screener' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
                  AI Stock Screener
                </h1>
                <p style={{ color: '#4B5563', fontSize: '0.85rem' }}>Filter stocks by AI signal and predicted return</p>
              </div>
              <div className="card">
                <Screener onSelect={(t) => { openDetail(t); setPage('dashboard') }} />
              </div>
            </>
          )}

          {/* AI LAB PAGE */}
          {page === 'ailab' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
                  AI Lab
                </h1>
                <p style={{ color: '#4B5563', fontSize: '0.85rem' }}>Train custom PyTorch LSTM models on real stock data</p>
              </div>
              <div className="card">
                <AITraining />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── STOCK DETAIL OVERLAY ── */}
      {selected && (
        <div className="overlay-backdrop" onClick={e => e.target === e.currentTarget && closeDetail()}>
          <div className="overlay-panel">
            {/* Header */}
            <div className="overlay-header">
              <div>
                <div className="overlay-ticker">{selected}</div>
                <div className="overlay-name">{detail.info?.name || selected}</div>
                {detail.info && (
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: '#4B5563', fontSize: '0.78rem' }}>
                      {detail.info.sector} · {detail.info.exchange}
                    </span>
                    <span style={{ color: '#4B5563', fontSize: '0.78rem' }}>
                      Mkt Cap: {fmt.big(detail.info.market_cap)}
                    </span>
                    <span style={{ color: '#4B5563', fontSize: '0.78rem' }}>
                      Vol: {fmt.vol(detail.info.volume)}
                    </span>
                  </div>
                )}
              </div>
              <button className="overlay-close" onClick={closeDetail}>✕</button>
            </div>

            {/* Live Price */}
            {detail.info && (
              <div className="price-row">
                <span className="price-big">{fmt.price(getDisplayPrice(selected, detail.info.current_price))}</span>
                <span className="price-change" style={{ color: (livePrices[selected]?.change_pct ?? 0) >= 0 ? '#10B981' : '#F43F5E' }}>
                  {livePrices[selected] ? `${livePrices[selected].change_pct >= 0 ? '+' : ''}${livePrices[selected].change_pct.toFixed(3)}%` : ''}
                </span>
                {wsConnected && (
                  <span style={{ fontSize: '0.7rem', color: '#10B981', marginLeft: 8 }}>● LIVE</span>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="overlay-tabs">
              {[
                { id: 'prediction', label: '🤖 AI Prediction' },
                { id: 'chart',      label: '📈 Price Chart'   },
                { id: 'technical',  label: '📐 Technical'     },
                { id: 'montecarlo', label: '🎲 Monte Carlo'   },
                { id: 'anomalies',  label: '⚡ Anomalies'     },
              ].map(t => (
                <button
                  key={t.id}
                  className={`otab ${overlayTab === t.id ? 'active' : ''}`}
                  onClick={() => setOverlayTab(t.id)}
                >{t.label}</button>
              ))}
            </div>

            {/* Tab Content */}
            {loadingDetail
              ? <div className="spinner" />
              : (
                <>
                  {overlayTab === 'prediction' && (
                    <PredictionPanel prediction={detail.prediction} ticker={selected} />
                  )}
                  {overlayTab === 'chart' && (
                    <StockChart
                      history={detail.history}
                      prediction={detail.prediction}
                      timeframe={timeframe}
                      onTimeframeChange={setTimeframe}
                    />
                  )}
                  {overlayTab === 'technical' && (
                    <TechnicalPanel history={detail.history} />
                  )}
                  {overlayTab === 'montecarlo' && (
                    <MonteCarlo ticker={selected} />
                  )}
                  {overlayTab === 'anomalies' && (
                    <AnomalyTab ticker={selected} />
                  )}
                </>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}

// Inline Anomaly Tab
function AnomalyTab({ ticker }) {
  const { fetchAnomalies } = useStock()
  const [anomalies, setAnomalies] = useState(null)

  useEffect(() => {
    fetchAnomalies(ticker).then(setAnomalies)
  }, [ticker])

  if (!anomalies) return <div className="spinner" />
  if (anomalies.length === 0) return (
    <div className="empty-state">
      <div className="empty-state-icon">✅</div>
      <div className="empty-state-text">No significant anomalies detected in the last year</div>
    </div>
  )

  return (
    <div>
      <p style={{ color: '#4B5563', fontSize: '0.82rem', marginBottom: 16 }}>
        Showing top {anomalies.slice(0, 10).length} anomalous daily return events (Z-score threshold: 2.2σ)
      </p>
      {anomalies.slice(0, 10).map((a, i) => (
        <div key={i} className={`anomaly-item ${a.ret >= 0 ? 'positive' : ''}`}>
          <div className="anomaly-dot" />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem' }}>
            {(a.ret * 100).toFixed(2)}%
          </span>
          <span style={{ color: '#4B5563', fontSize: '0.8rem' }}>on</span>
          <span className="anomaly-date">{a.date}</span>
          <span style={{ color: '#4B5563', fontSize: '0.78rem' }}>({a.days_ago}d ago)</span>
          <span className="anomaly-z">Z={a.z.toFixed(2)}σ</span>
        </div>
      ))}
    </div>
  )
}
