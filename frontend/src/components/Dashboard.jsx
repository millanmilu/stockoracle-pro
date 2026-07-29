import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import StockChart from './StockChart';
import AIInsightCard from './AIInsightCard';
import axios from 'axios';

export default function Dashboard() {
  const { selectedSymbol, setSelectedSymbol } = useStore();
  const { searchStocks, fetchHistory } = useStock();
  const [history, setHistory] = useState(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Search logic
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

  const [timeframe, setTimeframe] = useState('3M');

  // Load history logic
  useEffect(() => {
    setHistory(null);
    fetchHistory(selectedSymbol, timeframe).then(setHistory);
  }, [selectedSymbol, timeframe]);

  const selectStock = ticker => {
    setSelectedSymbol(ticker);
    setSearch('');
    setShowDropdown(false);
  };

  const currentPrice = history && history.length > 0 ? history[history.length - 1].close : null;
  const priceChange = history && history.length > 1 ? currentPrice - history[history.length - 2].close : null;
  const pctChange = priceChange && currentPrice ? (priceChange / history[history.length - 2].close) * 100 : null;

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Search Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#fff' }}>{selectedSymbol}</h1>
          {currentPrice && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', marginTop: '5px' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>₹{currentPrice.toFixed(2)}</span>
              <span style={{ color: priceChange >= 0 ? '#10B981' : '#F43F5E', fontWeight: 'bold' }}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%)
              </span>
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
              border: '1px solid #333', backgroundColor: '#1e1e1e', color: '#fff'
            }}
          />
          {showDropdown && (
            <div style={{ 
              position: 'absolute', top: '45px', left: 0, width: '100%', 
              backgroundColor: '#1e1e1e', border: '1px solid #333', 
              borderRadius: '8px', zIndex: 10, maxHeight: '300px', overflowY: 'auto'
            }}>
              {results.length > 0 ? results.map(item => (
                <div 
                  key={item.ticker} 
                  onMouseDown={() => selectStock(item.ticker)}
                  style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  <strong style={{ color: '#0ea5e9' }}>{item.ticker}</strong> <span style={{ color: '#888', fontSize: '0.9rem' }}>{item.name}</span>
                </div>
              )) : (
                <div style={{ padding: '10px 15px', color: '#888' }}>No matches found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chart */}
      <div style={{ height: '400px', backgroundColor: '#1e1e1e', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
        {history ? <StockChart history={history} timeframe={timeframe} onTimeframeChange={setTimeframe} /> : <div style={{ color: '#888', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Loading Chart...</div>}
      </div>

      {/* AI Insight Card below chart */}
      <AIInsightCard />

    </div>
  );
}
