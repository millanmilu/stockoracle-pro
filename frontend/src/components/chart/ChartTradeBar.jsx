import React, { useState, useMemo } from 'react';
import { 
  Zap, ArrowUpRight, ArrowDownRight, X, ChevronDown, 
  ChevronUp, Shield, Target, DollarSign, Wallet
} from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import useStore from '../../store/useStore';
import { getThemeTokens } from '../../utils/theme';

const QUICK_QTY_PRESETS = [1, 5, 10, 25, 50, 100];

export default function ChartTradeBar({
  symbol = 'RELIANCE',
  livePrice = 0,
  activePosition = null,
  availableCash = 1000000.0,
  onTradeExecuted = () => {},
  isCollapsed = false,
  onToggleCollapse = () => {},
}) {
  const theme = useStore((s) => s.theme);
  const tk = getThemeTokens(theme);

  const [orderType, setOrderType] = useState('MARKET'); // 'MARKET' | 'LIMIT'
  const [limitPrice, setLimitPrice] = useState('');
  const [shares, setShares] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [tradeNote, setTradeNote] = useState('Live Chart Paper Trade');
  const [submitting, setSubmitting] = useState(false);

  const effectivePrice = useMemo(() => {
    if (orderType === 'LIMIT' && Number(limitPrice) > 0) {
      return Number(limitPrice);
    }
    return Number(livePrice) > 0 ? Number(livePrice) : 100.0;
  }, [orderType, limitPrice, livePrice]);

  const totalCapital = useMemo(() => {
    return Math.round(shares * effectivePrice * 100) / 100;
  }, [shares, effectivePrice]);

  // Quick SL / TP helper percentages
  const handleSetQuickSL = (pct) => {
    if (effectivePrice <= 0) return;
    const sl = Math.round(effectivePrice * (1 - pct / 100) * 100) / 100;
    setStopLoss(String(sl));
  };

  const handleSetQuickTP = (pct) => {
    if (effectivePrice <= 0) return;
    const tp = Math.round(effectivePrice * (1 + pct / 100) * 100) / 100;
    setTargetPrice(String(tp));
  };

  // Execute Market or Limit BUY
  const handleBuy = async () => {
    if (shares <= 0) {
      toast.error('Please enter a valid share quantity');
      return;
    }
    if (totalCapital > availableCash) {
      toast.error(`Insufficient virtual cash! Needed ₹${totalCapital.toLocaleString('en-IN')}, available ₹${availableCash.toLocaleString('en-IN')}`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/paper/order', {
        ticker: String(symbol).toUpperCase().trim(),
        order_type: orderType,
        action: 'BUY',
        shares: Number(shares),
        price: effectivePrice,
        stop_loss: stopLoss ? Number(stopLoss) : null,
        target_price: targetPrice ? Number(targetPrice) : null,
        notes: tradeNote || 'Live Chart Paper Trade',
      });
      toast.success(
        `🎉 Paper BUY Executed: ${shares} ${symbol} @ ₹${effectivePrice.toFixed(2)}`
      );
      onTradeExecuted();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to execute paper order.');
    } finally {
      setSubmitting(false);
    }
  };

  // Close active position at live market price
  const handleClosePosition = async () => {
    if (!activePosition) return;
    setSubmitting(true);
    try {
      const exitP = Number(livePrice) > 0 ? Number(livePrice) : (activePosition.current_price || activePosition.avg_buy_price || 100.0);
      await api.post('/api/paper/close', {
        position_id: activePosition.id,
        current_price: exitP,
      });
      const pnlVal = Math.round((exitP - (activePosition.avg_buy_price || exitP)) * activePosition.shares * 100) / 100;
      const sign = pnlVal >= 0 ? '+' : '';
      toast.success(
        `💰 Position Closed: ${activePosition.shares} ${symbol} @ ₹${exitP.toFixed(2)} | Realized P&L: ${sign}₹${pnlVal.toLocaleString('en-IN')}`
      );
      onTradeExecuted();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to close position.');
    } finally {
      setSubmitting(false);
    }
  };

  // If collapsed, show minimal status chip with expand button
  if (isCollapsed) {
    return (
      <div style={{
        position: 'absolute',
        top: 8,
        left: 10,
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 6,
        background: theme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(11, 15, 28, 0.92)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
      }}>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Open Live Paper Trading Bar"
          style={{
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            border: 0,
            borderRadius: 4,
            padding: '3px 8px',
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
        >
          <Zap size={12} /> TRADE
        </button>

        {activePosition && (
          <span style={{
            fontSize: '0.72rem',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            color: (activePosition.unrealized_pnl || 0) >= 0 ? '#10B981' : '#EF4444',
          }}>
            Pos: {activePosition.shares} @ ₹{Number(activePosition.avg_buy_price || 0).toFixed(1)} ({(activePosition.unrealized_pnl || 0) >= 0 ? '+' : ''}₹{Number(activePosition.unrealized_pnl || 0).toFixed(1)})
          </span>
        )}
      </div>
    );
  }

  const isProfit = (activePosition?.unrealized_pnl || 0) >= 0;

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      left: 10,
      zIndex: 55,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      maxWidth: 'calc(100% - 20px)',
      background: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(9, 12, 22, 0.94)',
      backdropFilter: 'blur(14px)',
      border: '1px solid rgba(99, 102, 241, 0.32)',
      borderRadius: 10,
      padding: '8px 12px',
      boxShadow: '0 8px 28px rgba(0, 0, 0, 0.45)',
      color: tk.toolbarText,
      fontFamily: 'Inter, ui-sans-serif, sans-serif',
    }}>
      {/* Top row: Symbol + Live LTP + Balance + Collapse */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: '0.74rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            background: 'rgba(129, 140, 248, 0.15)',
            border: '1px solid rgba(129, 140, 248, 0.35)',
            color: '#818CF8',
            fontWeight: 800,
            padding: '1px 5px',
            borderRadius: 4,
            fontSize: '0.68rem',
            letterSpacing: '0.04em',
          }}>
            DEMO
          </span>
          <strong style={{ color: tk.toolbarActive, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem' }}>
            {symbol}
          </strong>
          <span style={{ color: tk.toolbarMuted, fontFamily: 'JetBrains Mono, monospace' }}>
            LTP: ₹{Number(livePrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10B981', fontWeight: 700, fontSize: '0.72rem' }} title="Available Virtual Trading Balance">
            <Wallet size={12} />
            <span>₹{availableCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Minimize Trade Bar"
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
            <ChevronUp size={14} />
          </button>
        </div>
      </div>

      {/* Main Order Controls: Qty Stepper + BUY Button + SELL/Close Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Qty Stepper */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: theme === 'light' ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 6,
          padding: '1px',
        }}>
          <button
            type="button"
            onClick={() => setShares(prev => Math.max(1, prev - (prev > 10 ? 5 : 1)))}
            style={{
              background: 'transparent',
              border: 0,
              color: tk.toolbarText,
              padding: '4px 7px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.78rem',
            }}
            title="Decrease shares"
          >
            -
          </button>
          <input
            type="number"
            min="1"
            value={shares}
            onChange={(e) => setShares(Math.max(1, parseInt(e.target.value, 10) || 1))}
            style={{
              width: 48,
              textAlign: 'center',
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: tk.toolbarActive,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.78rem',
            }}
          />
          <button
            type="button"
            onClick={() => setShares(prev => prev + (prev >= 10 ? 5 : 1))}
            style={{
              background: 'transparent',
              border: 0,
              color: tk.toolbarText,
              padding: '4px 7px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.78rem',
            }}
            title="Increase shares"
          >
            +
          </button>
        </div>

        {/* Quick Qty Chips */}
        <div style={{ display: 'flex', gap: 3 }}>
          {QUICK_QTY_PRESETS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setShares(q)}
              style={{
                background: shares === q ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${shares === q ? '#38BDF8' : 'rgba(255, 255, 255, 0.08)'}`,
                color: shares === q ? '#38BDF8' : tk.toolbarMuted,
                borderRadius: 4,
                padding: '2px 5px',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Order Type Toggle */}
        <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            type="button"
            onClick={() => setOrderType('MARKET')}
            style={{
              background: orderType === 'MARKET' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: orderType === 'MARKET' ? '#A5B4FC' : tk.toolbarMuted,
              border: 0,
              padding: '3px 7px',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            MKT
          </button>
          <button
            type="button"
            onClick={() => {
              setOrderType('LIMIT');
              if (!limitPrice) setLimitPrice(String(livePrice || 100));
            }}
            style={{
              background: orderType === 'LIMIT' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: orderType === 'LIMIT' ? '#A5B4FC' : tk.toolbarMuted,
              border: 0,
              padding: '3px 7px',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            LMT
          </button>
        </div>

        {/* If LIMIT, show limit price input */}
        {orderType === 'LIMIT' && (
          <input
            type="number"
            step="0.05"
            placeholder="Limit ₹"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            style={{
              width: 70,
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: 5,
              padding: '3px 6px',
              color: '#F8FAFC',
              fontSize: '0.74rem',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              outline: 'none',
            }}
          />
        )}

        {/* 1-Click BUY Button (Instant Execution) */}
        <button
          type="button"
          onClick={handleBuy}
          disabled={submitting}
          style={{
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            border: '1px solid rgba(16, 185, 129, 0.5)',
            color: '#FFFFFF',
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: submitting ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <ArrowUpRight size={14} />
          <span>BUY {shares} @ ₹{effectivePrice.toFixed(1)}</span>
        </button>

        {/* Close Position Button (if position exists) */}
        {activePosition ? (
          <button
            type="button"
            onClick={handleClosePosition}
            disabled={submitting}
            title="Close position at current market price"
            style={{
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#FFFFFF',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: submitting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
            }}
          >
            <X size={13} />
            <span>CLOSE ({activePosition.shares})</span>
          </button>
        ) : null}

        {/* TP / SL Advanced Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(prev => !prev)}
          title="Set Stop Loss & Take Profit"
          style={{
            background: (stopLoss || targetPrice) ? 'rgba(129, 140, 248, 0.18)' : 'transparent',
            border: `1px solid ${(stopLoss || targetPrice) ? '#818CF8' : 'rgba(255,255,255,0.1)'}`,
            color: (stopLoss || targetPrice) ? '#A5B4FC' : tk.toolbarMuted,
            borderRadius: 5,
            padding: '3px 8px',
            fontSize: '0.68rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <Shield size={11} />
          <span>SL/TP</span>
          {showAdvanced ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Active Position Live Status Banner */}
      {activePosition && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '4px 8px',
          borderRadius: 6,
          background: isProfit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${isProfit ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          fontSize: '0.72rem',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: isProfit ? '#34D399' : '#F87171', fontWeight: 800 }}>
              LONG {activePosition.shares} @ ₹{Number(activePosition.avg_buy_price || 0).toFixed(2)}
            </span>
            <span style={{ color: tk.toolbarMuted }}>
              Invested: ₹{(Number(activePosition.shares) * Number(activePosition.avg_buy_price || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ color: isProfit ? '#10B981' : '#EF4444', fontSize: '0.78rem' }}>
              P&L: {isProfit ? '+' : ''}₹{Number(activePosition.unrealized_pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isProfit ? '+' : ''}{Number(activePosition.unrealized_pnl_pct || 0).toFixed(2)}%)
            </strong>
          </div>
        </div>
      )}

      {/* Expandable SL / TP Controls */}
      {showAdvanced && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 8px',
          borderRadius: 6,
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px dashed rgba(99, 102, 241, 0.3)',
          flexWrap: 'wrap',
          fontSize: '0.72rem',
        }}>
          {/* Stop Loss Input + Quick -1%, -2%, -3% */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#F43F5E', fontWeight: 700 }}>SL:</span>
            <input
              type="number"
              step="0.1"
              placeholder="SL ₹"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              style={{
                width: 65,
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                borderRadius: 4,
                padding: '2px 5px',
                color: '#FDA4AF',
                fontSize: '0.72rem',
                fontFamily: 'JetBrains Mono, monospace',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 2 }}>
              {[1, 2, 3].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleSetQuickSL(pct)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                    color: '#FDA4AF',
                    borderRadius: 3,
                    padding: '1px 3px',
                    fontSize: '0.62rem',
                    cursor: 'pointer',
                  }}
                >
                  -{pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Target Price Input + Quick +2%, +4%, +6% */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#10B981', fontWeight: 700 }}>TP:</span>
            <input
              type="number"
              step="0.1"
              placeholder="Target ₹"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              style={{
                width: 65,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 4,
                padding: '2px 5px',
                color: '#6EE7B7',
                fontSize: '0.72rem',
                fontFamily: 'JetBrains Mono, monospace',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 2 }}>
              {[2, 4, 6].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleSetQuickTP(pct)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    color: '#6EE7B7',
                    borderRadius: 3,
                    padding: '1px 3px',
                    fontSize: '0.62rem',
                    cursor: 'pointer',
                  }}
                >
                  +{pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Capital Needed */}
          <div style={{ marginLeft: 'auto', color: tk.toolbarMuted, fontFamily: 'JetBrains Mono, monospace' }}>
            Est. Cost: <span style={{ color: '#F8FAFC', fontWeight: 700 }}>₹{totalCapital.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
