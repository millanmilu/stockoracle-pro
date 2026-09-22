import React, { useState, useEffect } from 'react';
import { 
  Activity, X, RefreshCw, TrendingUp, TrendingDown, 
  ChevronUp, ChevronDown, Check, AlertCircle, History, Wallet, ExternalLink
} from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import useStore from '../../store/useStore';
import { getThemeTokens } from '../../utils/theme';

export default function ChartTradeDocket({
  isOpen = false,
  onClose = () => {},
  positions = [],
  account = null,
  onRefresh = () => {},
  selectedSymbol = 'RELIANCE',
  onSelectSymbol = () => {},
}) {
  const theme = useStore((s) => s.theme);
  const tk = getThemeTokens(theme);

  const [activeTab, setActiveTab] = useState('positions'); // 'positions' | 'history' | 'account'
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [closingId, setClosingId] = useState(null);

  // Fetch trade history when tab active
  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      setHistoryLoading(true);
      api.get('/api/paper/history?limit=50')
        .then((res) => {
          setHistory(Array.isArray(res.data) ? res.data : []);
        })
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    }
  }, [isOpen, activeTab]);

  const handleClosePosition = async (pos) => {
    setClosingId(pos.id);
    try {
      let exitPrice = pos.current_price || pos.avg_buy_price || 100.0;
      await api.post('/api/paper/close', {
        position_id: pos.id,
        current_price: exitPrice,
      });
      toast.success(`Closed ${pos.shares} ${pos.ticker} @ ₹${exitPrice.toFixed(2)}`);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to close position.');
    } finally {
      setClosingId(null);
    }
  };

  const handleResetAccount = async () => {
    if (window.confirm("Reset paper trading account back to ₹10,00,000? All active positions will be closed.")) {
      try {
        await api.post('/api/paper/reset');
        toast.success("Paper trading account reset to ₹10,00,000");
        onRefresh();
      } catch {
        toast.error("Failed to reset account");
      }
    }
  };

  if (!isOpen) return null;

  const totalUnrealized = positions.reduce((acc, p) => acc + (p.unrealized_pnl || 0), 0);
  const totalInvested = positions.reduce((acc, p) => acc + ((p.shares || 0) * (p.avg_buy_price || 0)), 0);
  const cashBalance = account?.cash_balance ?? 1000000.0;
  const portfolioEquity = cashBalance + totalInvested + totalUnrealized;

  return (
    <div style={{
      flexShrink: 0,
      height: 210,
      maxHeight: 260,
      background: theme === 'light' ? '#FFFFFF' : '#080C18',
      borderTop: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(99, 102, 241, 0.28)'}`,
      display: 'flex',
      flexDirection: 'column',
      color: tk.toolbarText,
      fontFamily: 'Inter, ui-sans-serif, sans-serif',
      zIndex: 40,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.25)',
    }}>
      {/* Top Header Bar with Tabs and Summary */}
      <div style={{
        height: 32,
        minHeight: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        background: theme === 'light' ? '#F8FAFC' : '#0B0F20',
        borderBottom: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}`,
        fontSize: '0.74rem',
      }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={() => setActiveTab('positions')}
            style={{
              background: activeTab === 'positions' ? (theme === 'light' ? '#FFFFFF' : 'rgba(99, 102, 241, 0.22)') : 'transparent',
              border: `1px solid ${activeTab === 'positions' ? 'rgba(99, 102, 241, 0.4)' : 'transparent'}`,
              borderRadius: 4,
              color: activeTab === 'positions' ? '#818CF8' : tk.toolbarMuted,
              fontWeight: activeTab === 'positions' ? 800 : 500,
              padding: '3px 10px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Activity size={12} />
            <span>Open Positions ({positions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              background: activeTab === 'history' ? (theme === 'light' ? '#FFFFFF' : 'rgba(99, 102, 241, 0.22)') : 'transparent',
              border: `1px solid ${activeTab === 'history' ? 'rgba(99, 102, 241, 0.4)' : 'transparent'}`,
              borderRadius: 4,
              color: activeTab === 'history' ? '#818CF8' : tk.toolbarMuted,
              fontWeight: activeTab === 'history' ? 800 : 500,
              padding: '3px 10px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <History size={12} />
            <span>Order History</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('account')}
            style={{
              background: activeTab === 'account' ? (theme === 'light' ? '#FFFFFF' : 'rgba(99, 102, 241, 0.22)') : 'transparent',
              border: `1px solid ${activeTab === 'account' ? 'rgba(99, 102, 241, 0.4)' : 'transparent'}`,
              borderRadius: 4,
              color: activeTab === 'account' ? '#818CF8' : tk.toolbarMuted,
              fontWeight: activeTab === 'account' ? 800 : 500,
              padding: '3px 10px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Wallet size={12} />
            <span>Account Stats</span>
          </button>
        </div>

        {/* Right Quick Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'JetBrains Mono, monospace' }}>
          <div style={{ fontSize: '0.7rem' }}>
            <span style={{ color: tk.toolbarMuted }}>Available: </span>
            <strong style={{ color: '#10B981' }}>₹{cashBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
          </div>
          <div style={{ fontSize: '0.7rem' }}>
            <span style={{ color: tk.toolbarMuted }}>Unrealized P&L: </span>
            <strong style={{ color: totalUnrealized >= 0 ? '#10B981' : '#EF4444' }}>
              {totalUnrealized >= 0 ? '+' : ''}₹{totalUnrealized.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh positions"
            style={{
              background: 'transparent',
              border: 0,
              color: tk.toolbarMuted,
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={12} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Trading Panel"
            style={{
              background: 'transparent',
              border: 0,
              color: tk.toolbarMuted,
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px' }}>
        {activeTab === 'positions' && (
          positions.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 120,
              color: tk.toolbarMuted,
              fontSize: '0.75rem',
              gap: 4,
            }}>
              <span>No open paper trading positions</span>
              <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>Click "BUY" in the trade bar above to start simulated trading on {selectedSymbol}</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: tk.toolbarMuted, borderBottom: '1px solid rgba(255,255,255,0.06)', height: 26 }}>
                  <th style={{ padding: '4px 6px' }}>Symbol</th>
                  <th style={{ padding: '4px 6px' }}>Type</th>
                  <th style={{ padding: '4px 6px' }}>Shares</th>
                  <th style={{ padding: '4px 6px' }}>Entry Price</th>
                  <th style={{ padding: '4px 6px' }}>LTP</th>
                  <th style={{ padding: '4px 6px' }}>P&L (₹)</th>
                  <th style={{ padding: '4px 6px' }}>P&L (%)</th>
                  <th style={{ padding: '4px 6px' }}>SL / TP</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => {
                  const isCurrent = pos.ticker === selectedSymbol;
                  const isPosProfit = (pos.unrealized_pnl || 0) >= 0;
                  return (
                    <tr
                      key={pos.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        height: 28,
                        background: isCurrent ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '4px 6px' }}>
                        <button
                          type="button"
                          onClick={() => onSelectSymbol(pos.ticker)}
                          title="View on Chart"
                          style={{
                            background: 'transparent',
                            border: 0,
                            color: '#38BDF8',
                            fontWeight: 800,
                            fontFamily: 'JetBrains Mono, monospace',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          {pos.ticker}
                          {isCurrent && <span style={{ fontSize: '0.62rem', color: '#818CF8' }}>●</span>}
                        </button>
                      </td>
                      <td style={{ padding: '4px 6px', color: '#10B981', fontWeight: 700 }}>LONG</td>
                      <td style={{ padding: '4px 6px', fontFamily: 'JetBrains Mono, monospace' }}>{pos.shares}</td>
                      <td style={{ padding: '4px 6px', fontFamily: 'JetBrains Mono, monospace' }}>
                        ₹{Number(pos.avg_buy_price || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '4px 6px', fontFamily: 'JetBrains Mono, monospace' }}>
                        ₹{Number(pos.current_price || 0).toFixed(2)}
                      </td>
                      <td style={{
                        padding: '4px 6px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        color: isPosProfit ? '#10B981' : '#EF4444',
                      }}>
                        {isPosProfit ? '+' : ''}₹{Number(pos.unrealized_pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{
                        padding: '4px 6px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        color: isPosProfit ? '#10B981' : '#EF4444',
                      }}>
                        {isPosProfit ? '+' : ''}{Number(pos.unrealized_pnl_pct || 0).toFixed(2)}%
                      </td>
                      <td style={{ padding: '4px 6px', fontSize: '0.68rem', color: tk.toolbarMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                        {pos.stop_loss ? `SL: ₹${pos.stop_loss}` : '—'} {pos.target_price ? `| TP: ₹${pos.target_price}` : ''}
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleClosePosition(pos)}
                          disabled={closingId === pos.id}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#EF4444',
                            borderRadius: 4,
                            padding: '2px 7px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            cursor: closingId === pos.id ? 'wait' : 'pointer',
                          }}
                        >
                          {closingId === pos.id ? 'Closing...' : 'Close'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {activeTab === 'history' && (
          historyLoading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: tk.toolbarMuted }}>Loading order journal...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: tk.toolbarMuted }}>No order history yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: tk.toolbarMuted, borderBottom: '1px solid rgba(255,255,255,0.06)', height: 26 }}>
                  <th style={{ padding: '4px 6px' }}>Time</th>
                  <th style={{ padding: '4px 6px' }}>Symbol</th>
                  <th style={{ padding: '4px 6px' }}>Action</th>
                  <th style={{ padding: '4px 6px' }}>Shares</th>
                  <th style={{ padding: '4px 6px' }}>Exec Price</th>
                  <th style={{ padding: '4px 6px' }}>Realized P&L</th>
                  <th style={{ padding: '4px 6px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const isTradeProfit = (h.realized_pnl || 0) > 0;
                  return (
                    <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', height: 26 }}>
                      <td style={{ padding: '4px 6px', color: tk.toolbarMuted, fontSize: '0.68rem' }}>
                        {h.executed_at ? String(h.executed_at).replace('T', ' ').slice(0, 19) : '—'}
                      </td>
                      <td style={{ padding: '4px 6px', color: '#38BDF8', fontWeight: 700 }}>{h.ticker}</td>
                      <td style={{ padding: '4px 6px', color: h.action === 'BUY' ? '#10B981' : '#EF4444', fontWeight: 800 }}>{h.action}</td>
                      <td style={{ padding: '4px 6px', fontFamily: 'JetBrains Mono, monospace' }}>{h.shares}</td>
                      <td style={{ padding: '4px 6px', fontFamily: 'JetBrains Mono, monospace' }}>₹{Number(h.executed_price || 0).toFixed(2)}</td>
                      <td style={{
                        padding: '4px 6px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        color: (h.realized_pnl || 0) > 0 ? '#10B981' : (h.realized_pnl || 0) < 0 ? '#EF4444' : tk.toolbarMuted,
                      }}>
                        {(h.realized_pnl || 0) !== 0 ? `${(h.realized_pnl || 0) > 0 ? '+' : ''}₹${Number(h.realized_pnl || 0).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '4px 6px', color: tk.toolbarMuted, fontSize: '0.68rem' }}>{h.status || 'FILLED'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {activeTab === 'account' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, padding: '8px 0' }}>
            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.68rem', color: tk.toolbarMuted }}>VIRTUAL CASH BALANCE</div>
              <strong style={{ fontSize: '1.1rem', color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>

            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.68rem', color: tk.toolbarMuted }}>TOTAL PORTFOLIO EQUITY</div>
              <strong style={{ fontSize: '1.1rem', color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{portfolioEquity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>

            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.68rem', color: tk.toolbarMuted }}>INVESTED CAPITAL</div>
              <strong style={{ fontSize: '1.1rem', color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleResetAccount}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#EF4444',
                  borderRadius: 6,
                  padding: '8px 14px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reset Account (₹10L)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
