import React from 'react';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  Activity, LineChart, ShoppingCart, XCircle, ShieldAlert 
} from 'lucide-react';
import useStore from '../../store/useStore';

export default function PaperPositionsTable({
  positions = [],
  onOpenSellModal,
  onCloseFullPosition,
}) {
  const setSelectedSymbol = useStore((s) => s.setSelectedSymbol);
  const setActiveView = useStore((s) => s.setActiveView);

  const handleOpenChart = (ticker) => {
    setSelectedSymbol(ticker);
    setActiveView('Live Chart');
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: 16,
      padding: '20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} color="#818CF8" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#F8FAFC' }}>
            Active Open Positions ({positions.length})
          </h3>
        </div>
        <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
          Real-time mark-to-market valuations
        </span>
      </div>

      {positions.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 20px',
          color: '#94A3B8',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: 12,
          border: '1px dashed rgba(255, 255, 255, 0.1)',
        }}>
          <Activity size={36} style={{ opacity: 0.3, marginBottom: 10, color: '#818CF8' }} />
          <h4 style={{ margin: '0 0 6px 0', color: '#F8FAFC', fontSize: '0.92rem' }}>No Active Virtual Positions</h4>
          <p style={{ margin: 0, fontSize: '0.78rem' }}>
            Use the order placement form on the left to buy simulated shares of any NSE stock!
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{
                background: 'rgba(15, 23, 42, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94A3B8',
                fontWeight: 700,
                fontSize: '0.72rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                <th style={{ padding: '10px 12px' }}>Stock & Sector</th>
                <th style={{ padding: '10px 12px' }}>Shares</th>
                <th style={{ padding: '10px 12px' }}>Avg Buy</th>
                <th style={{ padding: '10px 12px' }}>Live LTP</th>
                <th style={{ padding: '10px 12px' }}>Invested</th>
                <th style={{ padding: '10px 12px' }}>Market Value</th>
                <th style={{ padding: '10px 12px' }}>Unrealized P&L</th>
                <th style={{ padding: '10px 12px' }}>Target / SL</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const buyPrice = Number(pos.avg_buy_price) || 0;
                const livePrice = Number(pos.current_price) || buyPrice;
                const shares = Number(pos.shares) || 0;
                const investedVal = Number(pos.invested_value) || (shares * buyPrice);
                const marketVal = Number(pos.market_value) || (shares * livePrice);
                const pnl = Number(pos.unrealized_pnl) || ((livePrice - buyPrice) * shares);
                const pnlPct = Number(pos.unrealized_pnl_pct) || (buyPrice > 0 ? ((livePrice - buyPrice) / buyPrice) * 100 : 0);
                const isProfit = pnl >= 0;

                return (
                  <tr
                    key={pos.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Stock & Sector */}
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          onClick={() => handleOpenChart(pos.ticker)}
                          style={{
                            fontWeight: 800,
                            fontFamily: 'JetBrains Mono, monospace',
                            color: '#38BDF8',
                            cursor: 'pointer',
                          }}
                          title="Open Live Chart"
                        >
                          {pos.ticker}
                        </span>
                        {pos.sector && (
                          <span style={{
                            fontSize: '0.62rem',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: '#94A3B8',
                            padding: '1px 5px',
                            borderRadius: 4,
                          }}>
                            {pos.sector}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Shares */}
                    <td style={{ padding: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                      {shares}
                    </td>

                    {/* Buy Price */}
                    <td style={{ padding: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{buyPrice.toFixed(2)}
                    </td>

                    {/* Current Live LTP */}
                    <td style={{ padding: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#F8FAFC' }}>
                      ₹{livePrice.toFixed(2)}
                    </td>

                    {/* Invested Value */}
                    <td style={{ padding: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#94A3B8' }}>
                      ₹{investedVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>

                    {/* Market Value */}
                    <td style={{ padding: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#F8FAFC' }}>
                      ₹{marketVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>

                    {/* Unrealized P&L */}
                    <td style={{ padding: '12px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        fontWeight: 800,
                        color: isProfit ? '#10B981' : '#F43F5E',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {isProfit ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                        <span>{isProfit ? '+' : ''}₹{Math.abs(pnl).toFixed(2)}</span>
                        <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                          ({isProfit ? '+' : ''}{pnlPct.toFixed(2)}%)
                        </span>
                      </div>
                    </td>

                    {/* Target / Stop Loss */}
                    <td style={{ padding: '12px', fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                      {pos.target_price ? <span style={{ color: '#10B981' }}>T: ₹{pos.target_price}</span> : '—'}
                      {' | '}
                      {pos.stop_loss ? <span style={{ color: '#F43F5E' }}>SL: ₹{pos.stop_loss}</span> : '—'}
                    </td>

                    {/* Actions: Partial Sell / Close All / Chart */}
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          onClick={() => onOpenSellModal(pos)}
                          style={{
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            color: '#818CF8',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                          }}
                          title="Sell partial shares"
                        >
                          Sell Partial
                        </button>

                        <button
                          onClick={() => onCloseFullPosition(pos.id, pos.ticker)}
                          style={{
                            background: 'rgba(244, 63, 94, 0.15)',
                            border: '1px solid rgba(244, 63, 94, 0.3)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            color: '#F43F5E',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                          }}
                          title="Exit full position"
                        >
                          Close All
                        </button>

                        <button
                          onClick={() => handleOpenChart(pos.ticker)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 6,
                            padding: '4px 6px',
                            color: '#94A3B8',
                            cursor: 'pointer',
                          }}
                          title="View Live Chart"
                        >
                          <LineChart size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
