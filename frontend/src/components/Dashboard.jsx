import { useState, useEffect, useRef } from 'react'
import { useStock } from '../hooks/useStock'
import { useWebSocket } from '../hooks/useWebSocket'
import { fmt } from '../utils/formatters'
import StockChart from './StockChart'
import PredictionPanel from './PredictionPanel'
import TechnicalPanel from './TechnicalPanel'
import MonteCarlo from './MonteCarlo'
import AITraining from './AITraining'
import Screener from './Screener'
import BacktestPanel from './BacktestPanel'
import PatternsPanel from './PatternsPanel'
import LevelsPanel from './LevelsPanel'
import VolatilityPanel from './VolatilityPanel'

const API = import.meta.env.VITE_API_URL || window.location.origin

const POPULAR = [
  { ticker: 'RELIANCE',   name: 'Reliance Industries' },
  { ticker: 'TCS',        name: 'Tata Consultancy Services' },
  { ticker: 'HDFCBANK',   name: 'HDFC Bank' },
  { ticker: 'INFY',       name: 'Infosys Ltd.' },
  { ticker: 'ICICIBANK',  name: 'ICICI Bank' },
  { ticker: 'SBIN',       name: 'State Bank of India' },
  { ticker: 'BHARTIARTL', name: 'Bharti Airtel' },
  { ticker: 'ITC',        name: 'ITC Ltd.' },
  { ticker: 'LT',         name: 'Larsen & Toubro' },
  { ticker: 'HUL',        name: 'Hindustan Unilever' },
]

const NAV = [
  { id: 'terminal',  icon: '📈', label: 'Terminal'  },
  { id: 'screener',  icon: '🔍', label: 'Screener'  },
  { id: 'ailab',     icon: '🧠', label: 'AI Lab'    },
]

export default function Dashboard() {
  const [page, setPage]               = useState('terminal')
  const [search, setSearch]           = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showDropdown, setDropdown]   = useState(false)
  const [livePrices, setLivePrices]   = useState({})
  
  // Default to RELIANCE for the terminal view
  const [selected, setSelected]       = useState('RELIANCE') 
  const [overlayTab, setOverlayTab]   = useState('prediction')
  const [detail, setDetail]           = useState({ info: null, history: null, prediction: null })
  const [timeframe, setTimeframe]     = useState('3M')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState(null)
  const [apiOnline, setApiOnline]     = useState(false)
  const detailRequestRef = useRef(0)

  const { fetchInfo, fetchHistory, fetchPredict, searchStock, fetchAnomalies } = useStock()

  // WebSocket live prices
  const wsConnected = useWebSocket(msg => {
    setLivePrices(prev => ({ ...prev, [msg.ticker]: { price: msg.price, change_pct: msg.change_pct } }))
  })

  // Check API health
  useEffect(() => {
    fetch(`${API}/api/health`).then(r => r.ok && setApiOnline(true)).catch(() => {})
  }, [])

  // Debounced Universal Search
  useEffect(() => {
    if (search.trim().length === 0) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      searchStock(search).then(res => {
        if (res && res.found) {
          setSearchResults([res])
        } else {
          // If not found in our DB, we can still show a fallback "Try NSE: SEARCH" option
          // We assume AngelOne will handle it if it exists.
          setSearchResults([{ ticker: search.toUpperCase(), name: `Search NSE for ${search.toUpperCase()}`, notFound: true }])
        }
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [search, searchStock])

  // Load stock detail when selected changes
  useEffect(() => {
    if (!selected) return
    const requestId = ++detailRequestRef.current
    setLoadingDetail(true)
    setDetailError(null)
    setDetail({ info: null, history: null, prediction: null })
    Promise.all([
      fetchInfo(selected),
      fetchHistory(selected, timeframe),
      fetchPredict(selected),
    ]).then(([info, history, prediction]) => {
      if (requestId !== detailRequestRef.current) return
      setDetail({ info, history, prediction })
      if (!info && !history && !prediction) {
        setDetailError(`Unable to load data for ${selected}. Please try again.`)
      }
    }).finally(() => {
      if (requestId === detailRequestRef.current) setLoadingDetail(false)
    })
  }, [selected]) // eslint-disable-line

  // Reload history when timeframe changes
  useEffect(() => {
    if (!selected) return
    let active = true
    fetchHistory(selected, timeframe).then(history => {
      if (active) setDetail(d => ({ ...d, history }))
    })
    return () => { active = false }
  }, [timeframe]) // eslint-disable-line

  const selectStock = (ticker) => {
    setSelected(ticker)
    setPage('terminal') // switch to terminal if on another page
    setOverlayTab('prediction')
    setTimeframe('3M')
  }

  const getDisplayPrice = (ticker, basePrice) => {
    const live = livePrices[ticker]
    return live ? live.price : basePrice
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

        <div className="watchlist">
          <div className="watchlist-title">POPULAR WATCHLIST</div>
          {POPULAR.map(s => {
            const liveChange = livePrices[s.ticker]?.change_pct
            const changeUp   = (liveChange ?? 0) >= 0
            return (
              <div 
                key={s.ticker} 
                className={`watchlist-item ${selected === s.ticker && page === 'terminal' ? 'active' : ''}`}
                onClick={() => selectStock(s.ticker)}
              >
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.ticker}
                </div>
                {liveChange != null && (
                  <div style={{ fontSize: '0.72rem', color: changeUp ? '#10B981' : '#F43F5E' }}>
                    {changeUp ? '+' : ''}{liveChange.toFixed(2)}%
                  </div>
                )}
              </div>
            )
          })}
        </div>

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
              placeholder="Search NSE ticker..."
              value={search}
              onChange={e => { setSearch(e.target.value); setDropdown(true) }}
              onBlur={() => setTimeout(() => setDropdown(false), 200)}
              onFocus={() => search && setDropdown(true)}
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map(s => (
                  <div
                    key={s.ticker}
                    className="search-item"
                    onMouseDown={() => { 
                      selectStock(s.ticker); 
                      setSearch(''); 
                      setDropdown(false);
                    }}
                  >
                    <span className="search-item-ticker">{s.ticker}</span>
                    <span className="search-item-name" style={{ color: s.notFound ? '#F59E0B' : '#9CA3AF'}}>
                      {s.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Header Info for Selected Stock in Terminal */}
          {page === 'terminal' && selected && detail.info && (
            <div className="header-stock-info">
              <div className="h-ticker">{selected}</div>
              <div className="h-price">
                {fmt.price(getDisplayPrice(selected, detail.info.current_price))}
              </div>
              <div className="h-change" style={{ color: (livePrices[selected]?.change_pct ?? 0) >= 0 ? '#10B981' : '#F43F5E' }}>
                {livePrices[selected] ? `${livePrices[selected].change_pct >= 0 ? '+' : ''}${livePrices[selected].change_pct.toFixed(2)}%` : ''}
              </div>
            </div>
          )}

          <span style={{ color: '#4B5563', fontSize: '0.78rem', marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* ── PAGE CONTENT ── */}
        <div className="page-area">

          {/* TERMINAL PAGE */}
          {page === 'terminal' && (
            <div className="terminal-layout">
              {loadingDetail && !detail.history ? (
                 <div className="spinner" style={{ gridColumn: '1 / -1', margin: '40px auto' }} />
              ) : detailError ? (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <div className="empty-state-text">{detailError}</div>
                </div>
              ) : (
                <>
                  <div className="terminal-chart-area">
                    <div className="card" style={{ height: '100%', padding: '16px' }}>
                      <StockChart
                        history={detail.history}
                        prediction={detail.prediction}
                        timeframe={timeframe}
                        onTimeframeChange={setTimeframe}
                      />
                    </div>
                  </div>

                  <div className="terminal-tools-area">
                    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                      <div className="terminal-tabs">
                        {[
                          { id: 'prediction', label: '🤖 Predict' },
                          { id: 'patterns',   label: '🕯️ Patterns' },
                          { id: 'levels',     label: '📐 Levels'   },
                          { id: 'volatility', label: '🌊 Volat'    },
                          { id: 'technical',  label: '📈 Techs'    },
                          { id: 'montecarlo', label: '🎲 MonteC'   },
                          { id: 'anomalies',  label: '⚡ Anom'      },
                          { id: 'backtest',   label: '📉 B-Test'   },
                        ].map(t => (
                          <button
                            key={t.id}
                            className={`ttab ${overlayTab === t.id ? 'active' : ''}`}
                            onClick={() => setOverlayTab(t.id)}
                          >{t.label}</button>
                        ))}
                      </div>
                      
                      <div className="terminal-tab-content">
                        {overlayTab === 'prediction' && <PredictionPanel prediction={detail.prediction} ticker={selected} />}
                        {overlayTab === 'patterns'   && <PatternsPanel ticker={selected} />}
                        {overlayTab === 'levels'     && <LevelsPanel ticker={selected} />}
                        {overlayTab === 'volatility' && <VolatilityPanel ticker={selected} />}
                        {overlayTab === 'technical'  && <TechnicalPanel history={detail.history} />}
                        {overlayTab === 'montecarlo' && <MonteCarlo ticker={selected} />}
                        {overlayTab === 'anomalies'  && <AnomalyTab ticker={selected} fetchAnomalies={fetchAnomalies} />}
                        {overlayTab === 'backtest'   && <BacktestPanel ticker={selected} />}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
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
                <Screener onSelect={selectStock} />
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
    </div>
  )
}

// Inline Anomaly Tab
function AnomalyTab({ ticker, fetchAnomalies }) {
  const [anomalies, setAnomalies] = useState(null)

  useEffect(() => {
    fetchAnomalies(ticker).then(setAnomalies)
  }, [ticker, fetchAnomalies])

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
        Showing top {Math.min(anomalies.length, 10)} anomalous daily return events (Z-score threshold: 2.2σ)
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
