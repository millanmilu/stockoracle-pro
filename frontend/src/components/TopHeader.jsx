import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import { 
  Search, TrendingUp, RefreshCw, Sun, Moon, Maximize2, Minimize2, 
  Sparkles, Activity, ShieldCheck, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const QUICK_TICKERS = [
  { symbol: 'RELIANCE', name: 'Reliance' },
  { symbol: 'TCS', name: 'TCS' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { symbol: 'INFY', name: 'Infosys' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors' },
  { symbol: 'SBIN', name: 'SBI' },
  { symbol: 'BHARTIARTL', name: 'Airtel' },
];

export default function TopHeader() {
  const { selectedSymbol, setSelectedSymbol, setTrainingStatus, theme, setTheme } = useStore();
  const { searchStocks } = useStock();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRetraining, setIsRetraining] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dropdownRef = useRef(null);

  // Market status calculation (IST: Mon-Fri, 9:15 AM - 3:30 PM)
  const isMarketOpen = () => {
    const now = new Date();
    // Convert to IST
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    const day = ist.getDay();
    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const currentMin = hours * 60 + minutes;
    const isWeekday = day >= 1 && day <= 5;
    const isTradingHours = currentMin >= (9 * 60 + 15) && currentMin <= (15 * 60 + 30);
    return isWeekday && isTradingHours;
  };

  const marketLive = isMarketOpen();

  // Debounced autocomplete search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchStocks(query.trim());
        setResults(data || []);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, searchStocks]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectStock = (ticker) => {
    setSelectedSymbol(ticker.toUpperCase());
    setQuery('');
    setShowDropdown(false);
    toast.success(`Selected ${ticker.toUpperCase()}`);
  };

  const handleRetrain = async () => {
    if (isRetraining) return;
    setIsRetraining(true);
    try {
      const { data } = await api.post(`/api/stock/${selectedSymbol}/train`);
      toast.success(`AI Model training started for ${selectedSymbol}`);

      const interval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/api/task/${data.task_id}/status`);
          setTrainingStatus(statusRes.data);
          if (statusRes.data.status === 'completed') {
            clearInterval(interval);
            toast.success(`Training Complete for ${selectedSymbol}! MAPE: ${(statusRes.data.mape * 100).toFixed(2)}%`);
            setTrainingStatus(null);
            setIsRetraining(false);
          } else if (statusRes.data.status === 'failed') {
            clearInterval(interval);
            toast.error(`Training failed: ${statusRes.data.error || 'Unknown error'}`);
            setTrainingStatus(null);
            setIsRetraining(false);
          }
        } catch {
          // ignore transient poll error
        }
      }, 2000);
    } catch {
      toast.error('Failed to trigger training');
      setIsRetraining(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const isDark = theme !== 'light';

  return (
    <header style={{
      height: '62px',
      backgroundColor: 'var(--bg-secondary, #0C1022)',
      borderBottom: '1px solid var(--border, rgba(99,102,241,0.15))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* ── Search & Autocomplete ── */}
      <div ref={dropdownRef} style={{ position: 'relative', width: '320px', flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '10px',
          padding: '6px 12px',
          gap: '8px',
          transition: 'border-color 0.2s',
        }}>
          <Search size={15} style={{ color: '#818CF8' }} />
          <input
            type="text"
            placeholder="Search any NSE stock (e.g. RELIANCE, TCS)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#F0F0FF',
              fontSize: '0.82rem',
              width: '100%',
              fontFamily: 'Inter, sans-serif',
            }}
          />
          {isSearching && <div className="spinner" style={{ width: 14, height: 14, margin: 0, borderWidth: 2 }} />}
        </div>

        {/* Dropdown Results */}
        {showDropdown && results.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            backgroundColor: '#0F172A',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '10px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 100,
            boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
          }}>
            {results.map((item) => (
              <div
                key={item.ticker}
                onClick={() => handleSelectStock(item.ticker)}
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>
                    {item.ticker}
                  </span>
                  <div style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{item.name}</div>
                </div>
                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: '#6B7280' }}>
                  {item.exchange || 'NSE'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick Ticker Watchlist Ribbon ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        padding: '4px 0',
        scrollbarWidth: 'none',
        flex: 1,
      }}>
        {QUICK_TICKERS.map((t) => {
          const isSelected = selectedSymbol === t.symbol;
          return (
            <button
              key={t.symbol}
              onClick={() => setSelectedSymbol(t.symbol)}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                border: isSelected ? '1px solid #8B5CF6' : '1px solid rgba(255,255,255,0.07)',
                backgroundColor: isSelected ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.02)',
                color: isSelected ? '#C084FC' : '#9CA3AF',
                fontSize: '0.74rem',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t.symbol}</span>
            </button>
          );
        })}
      </div>

      {/* ── Right Actions: Market Status, Active Symbol & Retrain, Theme & Fullscreen ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Market Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '20px',
          backgroundColor: marketLive ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.12)',
          border: `1px solid ${marketLive ? 'rgba(16,185,129,0.28)' : 'rgba(107,114,128,0.25)'}`,
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: marketLive ? '#10B981' : '#9CA3AF',
            boxShadow: marketLive ? '0 0 6px #10B981' : 'none',
          }} />
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: marketLive ? '#10B981' : '#9CA3AF', letterSpacing: '0.04em' }}>
            {marketLive ? 'NSE LIVE' : 'NSE CLOSED'}
          </span>
        </div>

        {/* 1-Click Retrain AI button */}
        <button
          onClick={handleRetrain}
          disabled={isRetraining}
          title={`Retrain AI Neural Models for ${selectedSymbol}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: '#fff',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: isRetraining ? 'not-allowed' : 'pointer',
            opacity: isRetraining ? 0.7 : 1,
            boxShadow: '0 2px 10px rgba(99,102,241,0.25)',
          }}
        >
          <RefreshCw size={13} className={isRetraining ? 'spinner' : ''} style={{ margin: 0, borderWidth: 2 }} />
          <span>{isRetraining ? 'Training...' : `Train AI (${selectedSymbol})`}</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#9CA3AF',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#9CA3AF',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>
    </header>
  );
}
