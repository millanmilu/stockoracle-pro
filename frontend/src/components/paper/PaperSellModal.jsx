import React, { useState } from 'react';
import { X, ShoppingCart, ArrowUpRight, ArrowDownRight, Check, Sparkles } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function PaperSellModal({ position, onClose, onSellExecuted }) {
  if (!position) return null;

  const totalShares = Number(position.shares) || 1;
  const buyPrice = Number(position.avg_buy_price) || 0;
  const livePrice = Number(position.current_price) || buyPrice;

  const [sellShares, setSellShares] = useState(totalShares);
  const [exitPrice, setExitPrice] = useState(livePrice);
  const [sellNote, setSellNote] = useState('PROFIT_BOOKING');
  const [submitting, setSubmitting] = useState(false);

  const handleQuickPct = (pct) => {
    const calculated = Math.max(1, Math.floor(totalShares * (pct / 100)));
    setSellShares(calculated);
  };

  const sharesToSell = Math.min(totalShares, Math.max(1, Number(sellShares)));
  const remainingShares = totalShares - sharesToSell;
  const proceeds = sharesToSell * exitPrice;
  const estimatedPnl = (exitPrice - buyPrice) * sharesToSell;
  const estimatedPnlPct = buyPrice > 0 ? ((exitPrice - buyPrice) / buyPrice) * 100 : 0;
  const isProfit = estimatedPnl >= 0;

  const handleConfirmSell = async () => {
    setSubmitting(true);
    try {
      await api.post('/api/paper/sell', {
        position_id: position.id,
        shares: sharesToSell,
        current_price: exitPrice,
        notes: sellNote || 'MANUAL_SELL',
      });
      toast.success(`Sold ${sharesToSell} shares of ${position.ticker} @ ₹${exitPrice.toFixed(2)} (${isProfit ? '+' : ''}₹${estimatedPnl.toFixed(2)})`);
      if (onSellExecuted) onSellExecuted();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to execute sell order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: 16,
        padding: '24px',
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#F8FAFC' }}>
              Exit Position — {position.ticker}
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
              Current Holdings: <strong style={{ color: '#38BDF8' }}>{totalShares} shares</strong> @ ₹{buyPrice.toFixed(2)}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: 8,
              width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#94A3B8',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick Sizing Buttons */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700 }}>
              SHARES TO SELL
            </label>
            <div style={{ display: 'flex', gap: 4 }}>
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleQuickPct(pct)}
                  style={{
                    background: sharesToSell === Math.floor(totalShares * (pct / 100)) ? '#6366F1' : 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: 6,
                    padding: '2px 8px',
                    color: '#FFFFFF',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {pct === 100 ? 'All (100%)' : `${pct}%`}
                </button>
              ))}
            </div>
          </div>

          <input
            type="number"
            min="1"
            max={totalShares}
            value={sellShares}
            onChange={(e) => setSellShares(Math.min(totalShares, Math.max(1, Number(e.target.value))))}
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: 8,
              padding: '10px 12px',
              color: '#F8FAFC',
              fontSize: '0.9rem',
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              outline: 'none',
            }}
          />
        </div>

        {/* Exit Price */}
        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700, marginBottom: 6 }}>
            EXIT PRICE (₹)
          </label>
          <input
            type="number"
            value={exitPrice}
            onChange={(e) => setExitPrice(Number(e.target.value))}
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: 8,
              padding: '10px 12px',
              color: '#F8FAFC',
              fontSize: '0.9rem',
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              outline: 'none',
            }}
          />
        </div>

        {/* Estimated Realized P&L Summary Card */}
        <div style={{
          background: isProfit ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
          border: `1px solid ${isProfit ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Estimated Realized P&L</span>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: isProfit ? '#34D399' : '#F87171',
              fontFamily: 'JetBrains Mono, monospace',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              {isProfit ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
              <span>{isProfit ? '+' : ''}₹{estimatedPnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ({estimatedPnlPct.toFixed(2)}%)</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Cash Inflow</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>
              +₹{proceeds.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Remaining Position */}
        <div style={{ fontSize: '0.72rem', color: '#94A3B8', textAlign: 'center' }}>
          Remaining after exit: <strong style={{ color: '#F8FAFC' }}>{remainingShares} shares</strong>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: 8,
              padding: '11px',
              color: '#94A3B8',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmSell}
            disabled={submitting}
            style={{
              background: 'linear-gradient(135deg, #E11D48 0%, #F43F5E 100%)',
              border: 'none',
              borderRadius: 8,
              padding: '11px',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(244, 63, 94, 0.4)',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Executing Sell…' : `Confirm Sell (${sharesToSell} sh)`}
          </button>
        </div>
      </div>
    </div>
  );
}
