import React from 'react';
import { Layers, Download, CheckSquare, X, DollarSign, BookmarkPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

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
    let success = 0;
    for (const ticker of selectedTickers) {
      try {
        await api.post('/api/paper/order', {
          ticker,
          side: 'BUY',
          quantity: 5,
          order_type: 'MARKET',
        });
        success++;
      } catch (e) {}
    }
    toast.success(`Executed ${success}/${selectedCount} paper trades!`, { id: 'bulk-trade' });
  };

  const handleSaveToWatchlist = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('stockoracle_custom_watchlist') || '[]');
      const updated = Array.from(new Set([...stored, ...selectedTickers]));
      localStorage.setItem('stockoracle_custom_watchlist', JSON.stringify(updated));
      toast.success(`Added ${selectedCount} stocks to Watchlist!`);
    } catch (e) {
      toast.error('Failed to save to Watchlist');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#0F172A',
      border: '1px solid rgba(99,102,241,0.4)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(99,102,241,0.25)',
      borderRadius: 12,
      padding: '8px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      zIndex: 150,
      animation: 'slideUp 0.2s ease-out'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#A5B4FC', fontSize: '0.78rem', fontWeight: 800 }}>
        <CheckSquare size={16} color="#6366F1" />
        <span>{selectedCount} Selected</span>
      </div>

      <div style={{ height: 18, width: 1, background: 'rgba(255,255,255,0.15)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={handleSaveToWatchlist}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
            borderRadius: 6, background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)',
            color: '#A5B4FC', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
          }}
        >
          <BookmarkPlus size={13} /> Add to Watchlist
        </button>

        <button
          onClick={handleBulkPaperTrade}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
            borderRadius: 6, background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none',
            color: '#FFF', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
          }}
        >
          <DollarSign size={13} /> Paper Trade All (5 Qty)
        </button>

        <button
          onClick={onExportSelected}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
            borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#E2E8F0', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer'
          }}
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      <button
        onClick={onClearSelection}
        title="Deselect All"
        style={{
          background: 'transparent', border: 'none', color: '#94A3B8',
          cursor: 'pointer', padding: 4, display: 'flex', marginLeft: 4
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
