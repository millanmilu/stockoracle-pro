import { useState, useEffect, useRef } from 'react'
import { useStock } from '../hooks/useStock'
import { useWebSocket } from '../hooks/useWebSocket'
import { fmt } from '../utils/formatters'
import StockChart from './StockChart'
import PredictionPanel from './PredictionPanel'
import TechnicalPanel from './TechnicalPanel'
import MonteCarlo from './MonteCarlo'
import AITraining from './AITraining'
import BacktestPanel from './BacktestPanel'
import PatternsPanel from './PatternsPanel'
import LevelsPanel from './LevelsPanel'
import VolatilityPanel from './VolatilityPanel'

const API = import.meta.env.VITE_API_URL || ''
const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details & News' },
  { id: 'predictions', label: 'Predictions' },
]

export default function Dashboard() {
  const [page, setPage] = useState('overview')
  const [selected, setSelected] = useState('RELIANCE')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [showDropdown, setDropdown] = useState(false)
  const [timeframe, setTimeframe] = useState('3M')
  const [detail, setDetail] = useState({ info: null, history: null, prediction: null })
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [livePrices, setLivePrices] = useState({})
  const requestRef = useRef(0)
  const { fetchInfo, fetchHistory, fetchPredict, fetchNews, searchStocks } = useStock()
  const wsConnected = useWebSocket(message => setLivePrices(previous => ({ ...previous, [message.ticker]: message })))

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const timer = setTimeout(() => {
      searchStocks(search).then(data => {
        setResults(data)
        setDropdown(true)
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [search, searchStocks])

  useEffect(() => {
    const requestId = ++requestRef.current
    setLoading(true); setError(null); setNews(null)
    Promise.all([fetchInfo(selected), fetchHistory(selected, timeframe), fetchPredict(selected)])
      .then(([info, history, prediction]) => {
        if (requestId !== requestRef.current) return
        setDetail({ info, history, prediction })
        if (!info && !history && !prediction) setError(`Unable to load ${selected}.`)
      })
      .finally(() => { if (requestId === requestRef.current) setLoading(false) })
  }, [selected, timeframe]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (page !== 'details') return
    let active = true
    fetchNews(selected).then(data => { if (active) setNews(data) })
    return () => { active = false }
  }, [page, selected, fetchNews])

  const selectStock = ticker => {
    setSelected(ticker)
    setSearch('')
    setDropdown(false)
    setPage('overview')
  }
  const info = detail.info
  const price = livePrices[selected]?.price ?? info?.current_price

  return <div className="app-layout">
    <aside className="sidebar">
      <div className="sidebar-logo"><div className="sidebar-logo-title">StockOracle</div><div className="sidebar-logo-sub">NSE market intelligence</div></div>
      {NAV.map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>{item.label}</button>)}
      <div className="sidebar-bottom"><div className="api-status"><div className="status-dot"/><span>Market API</span></div><div className="api-status" style={{ marginTop: 6 }}><div className={`status-dot ${wsConnected ? '' : 'offline'}`}/><span>Live prices {wsConnected ? 'connected' : 'reconnecting'}</span></div></div>
    </aside>
    <main className="main-content">
      <header className="top-bar">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder="Search any NSE stock or company..." value={search} onChange={event => setSearch(event.target.value)} onFocus={() => results.length && setDropdown(true)} onBlur={() => setTimeout(() => setDropdown(false), 150)} />
          {showDropdown && <div className="search-dropdown">{results.length ? results.map(item => <div className="search-item" key={item.ticker} onMouseDown={() => selectStock(item.ticker)}><span className="search-item-ticker">{item.ticker}</span><span className="search-item-name">{item.name}</span></div>) : <div className="search-item"><span className="search-item-name">No NSE matches found</span></div>}</div>}
        </div>
        <div className="header-stock-info"><span className="h-ticker">{selected}</span>{price != null && <span className="h-price">{fmt.price(price)}</span>}</div>
      </header>
      <section className="page-area">
        {loading && !detail.history ? <div className="spinner" /> : error ? <div className="empty-state"><div className="empty-state-text">{error}</div></div> : <PageContent page={page} selected={selected} info={info} history={detail.history} prediction={detail.prediction} news={news} timeframe={timeframe} onTimeframeChange={setTimeframe} />}
      </section>
    </main>
  </div>
}

function PageContent({ page, selected, info, history, prediction, news, timeframe, onTimeframeChange }) {
  if (page === 'overview') return <>
    <PageHeading title={selected} subtitle={info?.name || 'NSE equity'} />
    <div className="overview-grid"><div className="card"><StockChart history={history} prediction={prediction} timeframe={timeframe} onTimeframeChange={onTimeframeChange} /></div><BasicDetails info={info} /></div>
  </>
  if (page === 'details') return <>
    <PageHeading title={`${selected} details`} subtitle="Company profile, market statistics, technicals and latest news" />
    <div className="details-grid"><BasicDetails info={info} /><div className="card"><div className="card-title">Technical indicators</div><TechnicalPanel history={history} /></div></div>
    <div className="details-grid" style={{ marginTop: 18 }}><div className="card"><div className="card-title">Support & resistance</div><LevelsPanel ticker={selected} /></div><div className="card"><div className="card-title">Chart patterns</div><PatternsPanel ticker={selected} /></div></div>
    <NewsPanel news={news} />
  </>
  return <>
    <PageHeading title={`${selected} predictions`} subtitle="AI forecast and quantitative risk analysis. Not investment advice." />
    <div className="details-grid"><div className="card"><PredictionPanel prediction={prediction} ticker={selected} /></div><div className="card"><MonteCarlo ticker={selected} /></div></div>
    <div className="details-grid" style={{ marginTop: 18 }}><div className="card"><VolatilityPanel ticker={selected} /></div><div className="card"><BacktestPanel ticker={selected} /></div></div>
    <div className="card" style={{ marginTop: 18 }}><AITraining /></div>
  </>
}

function PageHeading({ title, subtitle }) { return <div style={{ marginBottom: 20 }}><h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem' }}>{title}</h1><p style={{ color: '#9CA3AF' }}>{subtitle}</p></div> }
function BasicDetails({ info }) {
  if (!info) return <div className="card"><div className="spinner" /></div>
  const fields = [['Open', info.open], ['Day high', info.day_high], ['Day low', info.day_low], ['Previous close', info.previous_close], ['52W high', info.fifty_two_week_high], ['52W low', info.fifty_two_week_low], ['Volume', info.volume]]
  return <div className="card"><div className="card-title">Basic details</div><div className="company-name">{info.name}</div><div className="company-meta">{info.exchange} · {info.sector}</div><div className="details-list">{fields.map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><strong>{label === 'Volume' ? (value ?? '—').toLocaleString?.() : fmt.price(value)}</strong></div>)}</div></div>
}
function NewsPanel({ news }) { return <div className="card" style={{ marginTop: 18 }}><div className="card-title">Latest news</div>{!news ? <div className="spinner" /> : news.items?.length ? <div className="news-list">{news.items.map((item, index) => <a className="news-item" href={item.link} target="_blank" rel="noreferrer" key={`${item.link}-${index}`}><strong>{item.title}</strong><span>{item.source} · {item.published_at}</span></a>)}</div> : <div className="empty-state"><div className="empty-state-text">No recent news available for this stock.</div></div>}</div> }
