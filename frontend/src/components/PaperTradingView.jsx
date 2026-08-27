import React, { useEffect, useState, useCallback } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';
import { 
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  RotateCcw, ShieldAlert, CheckCircle2, DollarSign, Activity, Play, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PaperTradingView() {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const setActiveView = useStore(s => s.setActiveView);
  const theme = useStore(s => s.theme);
  const isDark = theme !== 'light';

  const [account, setAccount] = useState({ cash_balance: 1000000.0, starting_balance: 1000000.0 });
  const [positions, setPositions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Order Form state
  const [ticker, setTicker] = useState(selectedSymbol || 'RELIANCE');
  const [shares, setShares] = useState(10);
  const [stopLoss, setStopLoss] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [currentLtp, setCurrentLtp] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Sync ticker with store
  useEffect(() => {
    if (selectedSymbol) setTicker(selectedSymbol);
  }, [selectedSymbol]);

  // Fetch current ticker LTP
  useEffect(() => {
    if (!ticker) return;
    api.get(`/api/stock/${ticker}/info`)
      .then((res) => {
        if (res.data?.current_price) {
          setCurrentLtp(res.data.current_price);
        }
      })
      .catch(() => {});
  }, [ticker]);

  // Fetch Paper Trading Account, Positions & History
  const fetchPaperData = useCallback(() => {
    Promise.all([
      api.get('/api/paper/account').catch(() => ({ data: { cash_balance: 1000000.0 } })),
      api.get('/api/paper/positions').catch(() => ({ data: [] })),
      api.get('/api/paper/history').catch(() => ({ data: [] }))
    ]).then(([accRes, posRes, histRes]) => {
      if (accRes.data) setAccount(accRes.data);
      if (Array.isArray(posRes.data)) setPositions(posRes.data);
      if (Array.isArray(histRes.data)) setHistory(histRes.data);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchPaperData();
    const timer = setInterval(fetchPaperData, 15000);
    return () => clearInterval(timer);
  }, [fetchPaperData]);

  // Place Paper Order
  const handlePlaceOrder = async () => {
    if (!ticker || shares <= 0) {
      toast.error("Please enter a valid stock ticker and share quantity.");
      return;
    }
    const orderPrice = currentLtp > 0 ? currentLtp : 100.0;
    const totalCost = shares * orderPrice;
    if (totalCost > account.cash_balance) {
      toast.error(`Insufficient balance. Order requires ₹${totalCost.toLocaleString('en-IN')}`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/paper/order', {
        ticker: ticker.toUpperCase().trim(),
        order_type: 'BUY',
        action: 'BUY',
        shares: Number(shares),
        price: orderPrice,
        stop_loss: stopLoss ? Number(stopLoss) : null,
        target_price: targetPrice ? Number(targetPrice) : null,
      });
      toast.success(`Virtual Buy Order Executed: ${shares} shares of ${ticker} @ ₹${orderPrice.toFixed(2)}`);
      fetchPaperData();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
  };

  // Close / Exit Position
  const handleClosePosition = async (posId, posTicker) => {
    try {
      const liveRes = await api.get(`/api/stock/${posTicker}/info`);
      const exitPrice = liveRes.data?.current_price || currentLtp || 100.0;

      await api.post('/api/paper/close', { position_id: posId, current_price: exitPrice });
      toast.success(`Closed position for ${posTicker} @ ₹${exitPrice.toFixed(2)}`);
      fetchPaperData();
    } catch (err) {
      toast.error("Failed to close position.");
    }
  };

  // Reset Account back to ₹10 Lakhs
  const handleReset = async () => {
    if (window.confirm("Are you sure you want to reset your Paper Trading account back to ₹10,00,000? All active virtual positions will be cleared.")) {
      try {
        await api.post('/api/paper/reset');
        toast.success("Account reset to ₹10,00,000 successfully!");
        fetchPaperData();
      } catch {
        toast.error("Failed to reset account.");
      }
    }
  };

  // Calculated Metrics
  const investedValue = positions.reduce((sum, p) => sum + (p.shares * (p.current_price || p.avg_buy_price)), 0);
  const totalPortfolioValue = account.cash_balance + investedValue;
  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + ((p.current_price || p.avg_buy_price) - p.avg_buy_price) * p.shares, 0);
  const totalRealizedPnl = history.reduce((sum, h) => sum + (h.realized_pnl || 0), 0);
  const winCount = history.filter((h) => h.realized_pnl > 0).length;
  const winRate = history.length > 0 ? ((winCount / history.length) * 100).toFixed(1) : '0.0';

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      color: isDark ? '#F1F5F9' : '#0F172A',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={20} color="#6366F1" />
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
              1-Click Paper Trading Simulator
            </h1>
            <span style={{ fontSize: '0.68rem', background: 'rgba(99,102,241,0.15)', color: '#818CF8', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
              Virtual ₹10 Lakhs
            </span>
          </div>
          <p style={{ margin: '3px 0 0 0', color: '#94A3B8', fontSize: '0.8rem' }}>
            Test AI prediction signals & execute risk-free simulated trades in live NSE market conditions.
          </p>
        </div>

        <button
          onClick={handleReset}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'rgba(239,83,80,0.1)',
            border: '1px solid rgba(239,83,80,0.25)',
            color: '#EF5350',
            fontWeight: 700,
            fontSize: '0.78rem',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={13} />
          <span>Reset to ₹10L</span>
        </button>
      </div>

      {/* Account Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {/* Virtual Balance */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: isDark ? '#0C1022' : '#FFFFFF',
          border: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        }}>
          <div style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>Available Virtual Cash</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{account.cash_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Portfolio Value */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: isDark ? '#0C1022' : '#FFFFFF',
          border: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        }}>
          <div style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>Total Portfolio Net Worth</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{totalPortfolioValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Unrealized P&L */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: isDark ? '#0C1022' : '#FFFFFF',
          border: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        }}>
          <div style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>Active Open P&L</div>
          <div style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            color: totalUnrealizedPnl >= 0 ? '#10B981' : '#EF5350',
            fontFamily: 'JetBrains Mono, monospace',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {totalUnrealizedPnl >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            <span>₹{totalUnrealizedPnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Win Rate */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: isDark ? '#0C1022' : '#FFFFFF',
          border: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        }}>
          <div style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>AI Trade Win Rate</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: Number(winRate) >= 50 ? '#10B981' : '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
            {winRate}% <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}>({history.length} trades)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Order Placement + Active Holdings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '20px', alignItems: 'start' }}>
        {/* 1-Click Order Execution Card */}
        <div style={{
          padding: '20px',
          borderRadius: '12px',
          background: isDark ? '#0C1022' : '#FFFFFF',
          border: isDark ? '1px solid rgba(99,102,241,0.25)' : '1px solid #E2E8F0',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Plus size={16} color="#6366F1" />
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800 }}>Place Virtual Trade</h3>
          </div>

          {/* Ticker Input */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#94A3B8', fontWeight: 700, marginBottom: '4px' }}>NSE SYMBOL</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. RELIANCE, TCS, INFY"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: isDark ? '#04050E' : '#F8FAFC',
                border: isDark ? '1px solid #1E2338' : '1px solid #CBD5E1',
                color: isDark ? '#F1F5F9' : '#0F172A',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Live Price Readout */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF', borderRadius: '8px', marginBottom: '14px', fontSize: '0.78rem' }}>
            <span style={{ color: '#94A3B8' }}>Estimated LTP:</span>
            <span style={{ fontWeight: 800, color: '#3B82F6', fontFamily: 'JetBrains Mono, monospace' }}>
              {currentLtp > 0 ? `₹${currentLtp.toFixed(2)}` : 'Fetching…'}
            </span>
          </div>

          {/* Quantity Shares */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#94A3B8', fontWeight: 700, marginBottom: '4px' }}>SHARES QUANTITY</label>
            <input
              type="number"
              min="1"
              value={shares}
              onChange={(e) => setShares(Math.max(1, Number(e.target.value)))}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: isDark ? '#04050E' : '#F8FAFC',
                border: isDark ? '1px solid #1E2338' : '1px solid #CBD5E1',
                color: isDark ? '#F1F5F9' : '#0F172A',
                fontWeight: 800,
                fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Stop Loss & Target (Optional) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#EF5350', fontWeight: 700, marginBottom: '4px' }}>STOP LOSS (₹)</label>
              <input
                type="number"
                placeholder="Optional"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: isDark ? '#04050E' : '#F8FAFC',
                  border: isDark ? '1px solid #1E2338' : '1px solid #CBD5E1',
                  color: isDark ? '#F1F5F9' : '#0F172A',
                  fontSize: '0.8rem'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#10B981', fontWeight: 700, marginBottom: '4px' }}>TARGET (₹)</label>
              <input
                type="number"
                placeholder="Optional"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: isDark ? '#04050E' : '#F8FAFC',
                  border: isDark ? '1px solid #1E2338' : '1px solid #CBD5E1',
                  color: isDark ? '#F1F5F9' : '#0F172A',
                  fontSize: '0.8rem'
                }}
              />
            </div>
          </div>

          {/* Total Cost Calculation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '16px', fontWeight: 600 }}>
            <span>Total Capital Required:</span>
            <span style={{ color: isDark ? '#F1F5F9' : '#0F172A', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
              ₹{((shares || 1) * (currentLtp || 100)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* 1-Click Buy Button */}
          <button
            onClick={handlePlaceOrder}
            disabled={submitting}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: '#10B981',
              border: 'none',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
              opacity: submitting ? 0.7 : 1
            }}
          >
            <Play size={15} />
            <span>{submitting ? 'Executing…' : `1-Click BUY ${ticker}`}</span>
          </button>
        </div>

        {/* Active Open Positions Table */}
        <div style={{
          padding: '20px',
          borderRadius: '12px',
          background: isDark ? '#0C1022' : '#FFFFFF',
          border: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '0.98rem', fontWeight: 800 }}>
            Active Open Positions ({positions.length})
          </h3>

          {positions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
              <Activity size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>No open virtual positions. Place your first order on the left!</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>STOCK</th>
                    <th style={{ padding: '8px 10px' }}>SHARES</th>
                    <th style={{ padding: '8px 10px' }}>BUY PRICE</th>
                    <th style={{ padding: '8px 10px' }}>TARGET / SL</th>
                    <th style={{ padding: '8px 10px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.id} style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#38BDF8' }}>
                        {pos.ticker}
                      </td>
                      <td style={{ padding: '10px' }}>{pos.shares}</td>
                      <td style={{ padding: '10px', fontFamily: 'JetBrains Mono, monospace' }}>₹{pos.avg_buy_price.toFixed(2)}</td>
                      <td style={{ padding: '10px', fontSize: '0.75rem', color: '#94A3B8' }}>
                        {pos.target_price ? `T: ₹${pos.target_price}` : '—'} | {pos.stop_loss ? `SL: ₹${pos.stop_loss}` : '—'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button
                          onClick={() => handleClosePosition(pos.id, pos.ticker)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'rgba(239,83,80,0.15)',
                            border: '1px solid rgba(239,83,80,0.3)',
                            color: '#EF5350',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            cursor: 'pointer'
                          }}
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
