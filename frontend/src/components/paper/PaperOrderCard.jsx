import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Plus, Search, Sparkles, ShieldAlert, Target, 
  HelpCircle, Tag, Check, AlertCircle, RefreshCw 
} from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function PaperOrderCard({
  selectedSymbol,
  onOrderPlaced,
  availableCash = 1000000.0,
}) {
  const [ticker, setTicker] = useState(selectedSymbol || 'RELIANCE');
  const [shares, setShares] = useState(10);
  const [currentLtp, setCurrentLtp] = useState(0);
  const [ltpLoading, setLtpLoading] = useState(false);
  const [ltpError, setLtpError] = useState(false);

  const [stopLoss, setStopLoss] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [tradeNote, setTradeNote] = useState('AI Signal BUY');
  const [submitting, setSubmitting] = useState(false);

  // Search dropdown state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  // Sync with global store symbol
  useEffect(() => {
    if (selectedSymbol) {
      setTicker(selectedSymbol);
      setSearchQuery(selectedSymbol);
    }
  }, [selectedSymbol]);

  // Autocomplete search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.get(`/api/stocks/search?query=${encodeURIComponent(searchQuery)}&limit=8`)
        .then((res) => {
          if (Array.isArray(res.data)) {
            setSearchResults(res.data);
          }
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Live LTP for the selected ticker
  const fetchLtp = (sym = ticker) => {
    if (!sym) return;
    setLtpLoading(true);
    setLtpError(false);

    api.get(`/api/stock/${sym}/info`, { timeout: 6000 })
      .then((res) => {
        if (res.data && res.data.current_price > 0) {
          setCurrentLtp(res.data.current_price);
        } else {
          // Fallback to screener table close price
          api.get(`/api/market/heatmap?universe=ALL&metric=change_1d_pct`)
            .then((hRes) => {
              const allStks = (hRes.data?.sectors || []).flatMap(s => s.stocks || []);
              const found = allStks.find(s => s.ticker === sym.toUpperCase());
              if (found && found.price) {
                setCurrentLtp(found.price);
              } else {
                setCurrentLtp(100.0);
              }
            })
            .catch(() => setCurrentLtp(100.0));
        }
      })
      .catch(() => {
        setLtpError(true);
        setCurrentLtp(100.0);
      })
      .finally(() => setLtpLoading(false));
  };

  useEffect(() => {
    fetchLtp(ticker);
  }, [ticker]);

  // Quick Position Sizing Helpers
  const handleQuickSize = (percentage) => {
    const price = currentLtp > 0 ? currentLtp : 100.0;
    const targetCapital = availableCash * (percentage / 100);
    const calculatedShares = Math.max(1, Math.floor(targetCapital / price));
    setShares(calculatedShares);
  };

  // Calculate Risk-Reward Ratio
  let riskRewardRatio = null;
  if (currentLtp > 0 && stopLoss && targetPrice) {
    const sl = Number(stopLoss);
    const tp = Number(targetPrice);
    const risk = currentLtp - sl;
    const reward = tp - currentLtp;
    if (risk > 0 && reward > 0) {
      riskRewardRatio = (reward / risk).toFixed(2);
    }
  }

  const totalCapitalRequired = (shares || 1) * (currentLtp || 100);

  // Submit Order
  const handleExecuteTrade = async () => {
    if (!ticker || shares <= 0) {
      toast.error('Please enter a valid stock symbol and quantity.');
      return;
    }
    const orderPrice = currentLtp > 0 ? currentLtp : 100.0;
    if (totalCapitalRequired > availableCash) {
      toast.error(`Insufficient virtual cash! Order needs ₹${totalCapitalRequired.toLocaleString('en-IN')}`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/paper/order', {
        ticker: ticker.toUpperCase().trim(),
        order_type: 'MARKET',
        action: 'BUY',
        shares: Number(shares),
        price: orderPrice,
        stop_loss: stopLoss ? Number(stopLoss) : null,
        target_price: targetPrice ? Number(targetPrice) : null,
        notes: tradeNote || 'AI Signal BUY',
      });
      toast.success(`Virtual Trade Executed: Bought ${shares} shares of ${ticker} @ ₹${orderPrice.toFixed(2)}`);
      if (onOrderPlaced) onOrderPlaced();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to execute virtual trade.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: 16,
      padding: '20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#10B981',
          }}>
            <Plus size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#F8FAFC' }}>
              Place Virtual Trade
            </h3>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>1-Click Instant Execution</span>
          </div>
        </div>

        <button
          onClick={() => fetchLtp(ticker)}
          title="Refresh LTP"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            borderRadius: 6,
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} style={{ animation: ltpLoading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Stock Ticker Search Autocomplete */}
      <div ref={searchContainerRef} style={{ position: 'relative' }}>
        <label style={{ display: 'block', fontSize: '0.72rem', color: '#94A3B8', fontWeight: 700, marginBottom: 4 }}>
          NSE STOCK SYMBOL
        </label>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setTicker(e.target.value.toUpperCase().trim());
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            placeholder="Search stock (e.g. RELIANCE, TCS, TATAMOTORS)..."
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 10,
              padding: '9px 12px 9px 32px',
              color: '#F8FAFC',
              fontSize: '0.82rem',
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              outline: 'none',
            }}
          />
        </div>

        {/* Autocomplete Dropdown */}
        {showSearchDropdown && searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '105%',
            left: 0,
            right: 0,
            background: '#0C1022',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: 10,
            padding: '6px 0',
            zIndex: 999,
            maxHeight: 200,
            overflowY: 'auto',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
          }}>
            {searchResults.map((item) => (
              <div
                key={item.ticker}
                onClick={() => {
                  setTicker(item.ticker);
                  setSearchQuery(item.ticker);
                  setShowSearchDropdown(false);
                  fetchLtp(item.ticker);
                }}
                style={{
                  padding: '8px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <strong style={{ color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>{item.ticker}</strong>
                  <div style={{ color: '#94A3B8', fontSize: '0.7rem' }}>{item.name}</div>
                </div>
                <span style={{ fontSize: '0.68rem', color: '#818CF8', background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                  {item.exchange || 'NSE'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Estimated Price Readout */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: 10,
      }}>
        <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 600 }}>Estimated Live LTP:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {ltpLoading ? (
            <span style={{ fontSize: '0.78rem', color: '#818CF8' }}>Fetching live…</span>
          ) : (
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>
              ₹{currentLtp > 0 ? currentLtp.toFixed(2) : '100.00'}
            </span>
          )}
        </div>
      </div>

      {/* Shares Quantity & Quick Sizing Buttons */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 700 }}>
            SHARES QUANTITY
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleQuickSize(pct)}
                style={{
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: 6,
                  padding: '2px 6px',
                  color: '#818CF8',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {pct === 100 ? 'Max' : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        <input
          type="number"
          min="1"
          value={shares}
          onChange={(e) => setShares(Math.max(1, Number(e.target.value)))}
          style={{
            width: '100%',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 10,
            padding: '9px 12px',
            color: '#F8FAFC',
            fontSize: '0.85rem',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            outline: 'none',
          }}
        />
      </div>

      {/* Stop Loss & Target Price with Risk-Reward */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#F43F5E', fontWeight: 700, marginBottom: 4 }}>
              STOP LOSS (₹)
            </label>
            <input
              type="number"
              placeholder="Optional SL"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: 8,
                padding: '8px 10px',
                color: '#F8FAFC',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#10B981', fontWeight: 700, marginBottom: 4 }}>
              TARGET (₹)
            </label>
            <input
              type="number"
              placeholder="Optional Target"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 8,
                padding: '8px 10px',
                color: '#F8FAFC',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {riskRewardRatio && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.72rem',
            color: '#94A3B8',
            marginTop: 6,
            background: 'rgba(99, 102, 241, 0.08)',
            padding: '4px 8px',
            borderRadius: 6,
          }}>
            <span>Risk-Reward Ratio:</span>
            <strong style={{ color: Number(riskRewardRatio) >= 2 ? '#34D399' : '#FCD34D', fontFamily: 'JetBrains Mono, monospace' }}>
              1 : {riskRewardRatio}
            </strong>
          </div>
        )}
      </div>

      {/* Trade Strategy Tag / Note */}
      <div>
        <label style={{ display: 'block', fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, marginBottom: 4 }}>
          STRATEGY TAG / NOTE
        </label>
        <select
          value={tradeNote}
          onChange={(e) => setTradeNote(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            padding: '8px 10px',
            color: '#F8FAFC',
            fontSize: '0.78rem',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="AI Signal BUY">🤖 AI Signal BUY</option>
          <option value="Breakout Surge">⚡ 20D Volume Breakout</option>
          <option value="Swing Trade">📈 Swing Momentum</option>
          <option value="Value Play">💎 Value / Low P/E</option>
          <option value="Scalp / Intraday">⏱️ Scalp / Intraday</option>
        </select>
      </div>

      {/* Capital Required Summary */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 10,
        fontSize: '0.78rem',
      }}>
        <span style={{ color: '#94A3B8' }}>Capital Required:</span>
        <strong style={{ color: totalCapitalRequired > availableCash ? '#F43F5E' : '#F8FAFC', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem' }}>
          ₹{totalCapitalRequired.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </strong>
      </div>

      {/* 1-Click Buy Action Button */}
      <button
        onClick={handleExecuteTrade}
        disabled={submitting}
        style={{
          width: '100%',
          padding: '13px',
          borderRadius: 10,
          background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
          border: 'none',
          color: '#FFFFFF',
          fontSize: '0.88rem',
          fontWeight: 800,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
          opacity: submitting ? 0.7 : 1,
          transition: 'all 0.2s ease',
        }}
      >
        <Play size={16} />
        <span>{submitting ? 'Executing Virtual Order…' : `1-Click BUY ${ticker}`}</span>
      </button>
    </div>
  );
}
