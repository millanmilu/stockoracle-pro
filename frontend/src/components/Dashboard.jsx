import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import StockChart, { TIMEFRAMES } from './StockChart';
import AIInsightCard from './AIInsightCard';

// Skeleton shimmer component
function SkeletonChart() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
        }
      `}</style>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div className="skeleton" style={{ width: 90, height: 20 }} />
        <div className="skeleton" style={{ width: 60, height: 20 }} />
      </div>
      <div className="skeleton" style={{ flex: 1, minHeight: 300 }} />
    </div>
  );
}

export default function Dashboard() {
  const { selectedSymbol, setSelectedSymbol, historyCache, setHistoryCache } = useStore();
  const { searchStocks, fetchHistory } = useStock();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [timeframe, setTimeframe] = useState('1day');
  const [localLoading, setLocalLoading] = useState(false);

  // Resolve period + interval from the TIMEFRAMES config
  const tfObj = TIMEFRAMES.find(t => t.label === timeframe) || TIMEFRAMES[7];
  const { period, interval } = tfObj;

  // Build cache key
  const cacheKey = `${selectedSymbol}_${period}_${interval}`;
  const history = historyCache[cacheKey] || null;

  // Debounced search
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timer = setTimeout(() => {
      searchStocks(search).then(data => {
        setResults(data);
        setShowDropdown(true);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [search, searchStocks]);

  // Load history — uses cache to avoid re-fetching on view switch
  useEffect(() => {
    if (historyCache[cacheKey]) return;   // Already cached
    setLocalLoading(true);
    fetchHistory(selectedSymbol, period, interval).then(data => {
      if (data && data.length > 0) setHistoryCache(cacheKey, data);
      setLocalLoading(false);
    });
  }, [selectedSymbol, timeframe]);

  const selectStock = ticker => {
    setSelectedSymbol(ticker);
    setSearch('');
    setShowDropdown(false);
  };

  const lastBar = history && history.length > 0 ? history[history.length - 1] : null;
  const prevBar = history && history.length > 1 ? history[history.length - 2] : null;

  const currentPrice = lastBar && typeof lastBar.close === 'number' ? lastBar.close : null;
  const prevClose = prevBar && typeof prevBar.close === 'number' ? prevBar.close : null;

  const priceChange = currentPrice !== null && prevClose !== null ? currentPrice - prevClose : null;
  const pctChange = priceChange !== null && prevClose ? (priceChange / prevClose) * 100 : null;
  const isLoading = localLoading && !history;

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Search Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#fff' }}>{selectedSymbol}</h1>
          {currentPrice !== null && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', marginTop: '5px' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>₹{currentPrice.toFixed(2)}</span>
              {priceChange !== null && pctChange !== null && (
                <span style={{ color: priceChange >= 0 ? '#10B981' : '#F43F5E', fontWeight: 'bold' }}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%)
                </span>
              )}
            </div>
          )}
          {isLoading && !currentPrice && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <div className="skeleton" style={{ width: 110, height: 28, borderRadius: 6, background: 'linear-gradient(90deg,#1e1e1e 25%,#2a2a2a 50%,#1e1e1e 75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite' }} />
              <div className="skeleton" style={{ width: 80, height: 28, borderRadius: 6, background: 'linear-gradient(90deg,#1e1e1e 25%,#2a2a2a 50%,#1e1e1e 75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite' }} />
            </div>
          )}
        </div>
        <div style={{ position: 'relative', width: '400px', marginLeft: 'auto' }}>
          <input
            type="text"
            placeholder="Search any NSE stock..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => results.length && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            style={{
              width: '100%', padding: '10px 15px', borderRadius: '8px',
              border: '1px solid var(--border, #333)', backgroundColor: 'var(--card-bg, #1e1e1e)', color: 'var(--text, #fff)',
              boxSizing: 'border-box',
            }}
          />
          {showDropdown && (
            <div style={{
              position: 'absolute', top: '45px', left: 0, width: '100%',
              backgroundColor: 'var(--card-bg, #1e1e1e)', border: '1px solid var(--border, #333)',
              borderRadius: '8px', zIndex: 10, maxHeight: '300px', overflowY: 'auto'
            }}>
              {results.length > 0 ? results.map(item => (
                <div
                  key={item.ticker}
                  onMouseDown={() => selectStock(item.ticker)}
                  style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid var(--border, #333)' }}
                >
                  <strong style={{ color: '#0ea5e9' }}>{item.ticker}</strong>{' '}
                  <span style={{ color: '#888', fontSize: '0.9rem' }}>{item.name}</span>
                </div>
              )) : (
                <div style={{ padding: '10px 15px', color: '#888' }}>No matches found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chart — skeleton while loading */}
      <div style={{ height: '400px', backgroundColor: 'var(--card-bg, #1e1e1e)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border, #333)' }}>
        {isLoading
          ? <SkeletonChart />
          : history
            ? <StockChart history={history} timeframe={timeframe} onTimeframeChange={setTimeframe} />
            : <div style={{ color: '#888', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>No chart data available.</div>
        }
      </div>

      {/* AI Insight Card below chart */}
      <AIInsightCard />

    </div>
  );
}
