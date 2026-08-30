import React, { useState } from 'react';
import { 
  BookOpen, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  Download, Filter, Search, CheckCircle2, ShieldAlert, Sparkles 
} from 'lucide-react';

export default function PaperTradeHistory({ history = [] }) {
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'SELL_WIN', 'SELL_LOSS', 'BUY'
  const [searchQuery, setSearchQuery] = useState('');

  // Filter history
  const filteredHistory = history.filter((item) => {
    // Search match
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      if (!item.ticker.toUpperCase().includes(q)) return false;
    }

    if (activeFilter === 'SELL_WIN') {
      return item.action === 'SELL' && (item.realized_pnl || 0) > 0;
    }
    if (activeFilter === 'SELL_LOSS') {
      return item.action === 'SELL' && (item.realized_pnl || 0) < 0;
    }
    if (activeFilter === 'BUY') {
      return item.action === 'BUY';
    }
    return true;
  });

  // Export to CSV
  const handleExportCSV = () => {
    if (!history.length) return;
    const headers = ['Date', 'Ticker', 'Action', 'Shares', 'Executed Price', 'Realized PnL', 'Status/Notes'];
    const rows = history.map(h => [
      h.executed_at,
      h.ticker,
      h.action,
      h.shares,
      h.executed_price,
      h.realized_pnl || 0,
      `"${h.status || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `StockOracle_Trade_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sellOrders = history.filter(h => h.action === 'SELL');
  const winCount = sellOrders.filter(h => (h.realized_pnl || 0) > 0).length;
  const lossCount = sellOrders.filter(h => (h.realized_pnl || 0) < 0).length;

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: 16,
      padding: '20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    }}>
      {/* Header & Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={18} color="#10B981" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#F8FAFC' }}>
            Trade Execution Journal ({history.length})
          </h3>
        </div>

        {/* Search, Filter Pills & CSV Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: 160 }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
            <input
              type="text"
              placeholder="Filter ticker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '6px 8px 6px 26px',
                color: '#F8FAFC',
                fontSize: '0.74rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'ALL', label: `All (${history.length})` },
              { id: 'SELL_WIN', label: `Wins (${winCount})` },
              { id: 'SELL_LOSS', label: `Losses (${lossCount})` },
              { id: 'BUY', label: `Buys` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                style={{
                  background: activeFilter === f.id ? 'rgba(99, 102, 241, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${activeFilter === f.id ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: 6,
                  padding: '5px 10px',
                  color: activeFilter === f.id ? '#818CF8' : '#94A3B8',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* CSV Export */}
          <button
            onClick={handleExportCSV}
            disabled={!history.length}
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 6,
              padding: '5px 10px',
              color: '#10B981',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Download size={13} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* History Table */}
      {filteredHistory.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#94A3B8',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: 12,
          border: '1px dashed rgba(255, 255, 255, 0.1)',
        }}>
          <p style={{ margin: 0, fontSize: '0.8rem' }}>No trade records match the selected filter.</p>
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
                <th style={{ padding: '10px 12px' }}>Date & Time</th>
                <th style={{ padding: '10px 12px' }}>Stock</th>
                <th style={{ padding: '10px 12px' }}>Action</th>
                <th style={{ padding: '10px 12px' }}>Shares</th>
                <th style={{ padding: '10px 12px' }}>Price</th>
                <th style={{ padding: '10px 12px' }}>Realized P&L</th>
                <th style={{ padding: '10px 12px' }}>Status / Tag</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((item) => {
                const isBuy = item.action === 'BUY';
                const pnl = Number(item.realized_pnl) || 0;
                const isPnlPositive = pnl >= 0;

                // Format timestamp
                let dateStr = item.executed_at || '—';
                try {
                  const d = new Date(item.executed_at);
                  dateStr = `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
                } catch {}

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Timestamp */}
                    <td style={{ padding: '10px 12px', color: '#94A3B8', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                      {dateStr}
                    </td>

                    {/* Stock */}
                    <td style={{ padding: '10px 12px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#F8FAFC' }}>
                      {item.ticker}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: isBuy ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        color: isBuy ? '#34D399' : '#F87171',
                        border: `1px solid ${isBuy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                      }}>
                        {item.action}
                      </span>
                    </td>

                    {/* Shares */}
                    <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                      {item.shares}
                    </td>

                    {/* Executed Price */}
                    <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{Number(item.executed_price).toFixed(2)}
                    </td>

                    {/* Realized P&L */}
                    <td style={{ padding: '10px 12px' }}>
                      {isBuy ? (
                        <span style={{ color: '#64748B', fontSize: '0.74rem' }}>—</span>
                      ) : (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          fontWeight: 800,
                          color: isPnlPositive ? '#10B981' : '#F43F5E',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>
                          {isPnlPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          <span>{isPnlPositive ? '+' : ''}₹{Math.abs(pnl).toFixed(2)}</span>
                        </div>
                      )}
                    </td>

                    {/* Status / Tag */}
                    <td style={{ padding: '10px 12px', fontSize: '0.74rem' }}>
                      <span style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '2px 8px',
                        borderRadius: 6,
                        color: item.status?.includes('TARGET') ? '#34D399' : (item.status?.includes('STOP_LOSS') ? '#F87171' : '#94A3B8'),
                        fontWeight: 600,
                      }}>
                        {item.status || 'EXECUTED'}
                      </span>
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
