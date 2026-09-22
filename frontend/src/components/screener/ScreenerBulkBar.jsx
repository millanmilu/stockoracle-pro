import React from 'react';
import { Download, CheckSquare, X, DollarSign, BookmarkPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { TN, btn } from './terminalTheme';

export default function ScreenerBulkBar({ 
  selectedCount, 
  selectedTickers, 
  onClearSelection, 
  onExportSelected,
  allResults
}) {
  if (selectedCount === 0) return null;

  const handleBulkPaperTrade = async () => {
    toast.loading(`Placing market buy orders for ${selectedCount} stocks...`, { id: 'bulk-trade' });
    const priceByTicker = new Map(
      (allResults || []).map(r => [r.ticker, Number(r.close_price ?? r.price) || 0])
    );
    let success = 0;
    const failed = [];
    for (const ticker of selectedTickers) {
      try {
        const price = priceByTicker.get(ticker) || 0;
        if (!price || price <= 0) {
          failed.push(`${ticker} (no price)`);
          continue;
        }
        await api.post('/api/paper/order', {
          ticker,
          order_type: 'MARKET',
          action: 'BUY',
          shares: 5,
          price,
          notes: `Screener bulk buy`,
        });
        success++;
      } catch (e) {
        failed.push(`${ticker} (${e.response?.data?.detail || 'rejected'})`);
      }
    }
    if (failed.length > 0) {
      toast.error(`Executed ${success}/${selectedCount}. Failed: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ` +${failed.length - 3} more` : ''}`, { id: 'bulk-trade' });
    } else {
      toast.success(`Executed ${success}/${selectedCount} paper trades!`, { id: 'bulk-trade' });
    }
  };

  const handleSaveToWatchlist = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('stockoracle_custom_watchlist') || '[]');
      const updated = Array.from(new Set([...stored.map(String), ...selectedTickers.map(String)]));
      localStorage.setItem('stockoracle_custom_watchlist', JSON.stringify(updated.map(t => String(t).trim().toUpperCase()).filter(Boolean)));
      toast.success(`Added ${selectedCount} stocks to Watchlist!`);
    } catch (e) {
      toast.error('Failed to save to Watchlist');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      background: TN.panelAlt,
      border: `1px solid ${TN.borderStrong}`,
      boxShadow: '0 10px 28px rgba(0,0,0,0.6)',
      borderRadius: TN.radius,
      padding: '6px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      zIndex: 150,
      maxWidth: '94vw',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: TN.accent, fontSize: 12, fontWeight: 700 }}>
        <CheckSquare size={14} color={TN.accent} />
        <span>{selectedCount} selected</span>
      </div>

      <div style={{ height: 18, width: 1, background: TN.border }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={handleSaveToWatchlist} style={btn(true)}>
          <BookmarkPlus size={13} /> Watchlist
        </button>

        <button onClick={handleBulkPaperTrade} style={btn(false, { background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.40)', color: TN.up, fontWeight: 700 })}>
          <DollarSign size={13} /> Paper Trade All (5)
        </button>

        <button onClick={onExportSelected} style={btn()}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      <button
        onClick={onClearSelection}
        title="Deselect all"
        style={{
          background: 'transparent', border: 'none', color: TN.muted,
          cursor: 'pointer', padding: 4, display: 'flex', marginLeft: 2
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
