// Pro Terminal V2 — Paper Order Ticket

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { V2_COLORS } from '../utils/constants';
import { formatPrice } from '../utils/formatters';

export default function V2OrderModal({ side = 'BUY', symbol, currentPrice, onClose, onSubmit }) {
  const [orderType, setOrderType] = useState('MARKET');
  const [qty, setQty] = useState(1);
  const [limitPrice, setLimitPrice] = useState(() => currentPrice?.toFixed?.(2) ?? '');
  const qtyRef = useRef(null);

  useEffect(() => { qtyRef.current?.focus(); }, []);

  const price = orderType === 'LIMIT' ? Number(limitPrice) || 0 : currentPrice;
  const total = price * (Number(qty) || 0);
  const isBuy = side === 'BUY';
  const valid = Number(qty) > 0 && price > 0;

  const submit = () => {
    if (!valid) return;
    onSubmit?.({ side, type: orderType, qty: Number(qty), price });
  };

  return (
    <div className="v2-modal-scrim" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${side} order ticket for ${symbol}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 320,
          background: V2_COLORS.bg.elevated,
          border: `1px solid ${V2_COLORS.bg.borderLight}`,
          borderRadius: 8,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          animation: 'v2-fade-in 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: `1px solid ${V2_COLORS.bg.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              background: isBuy ? V2_COLORS.positive : V2_COLORS.negative,
            }}>{side}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: V2_COLORS.text.primary }}>{symbol}</span>
            <span style={{ fontSize: 10, color: V2_COLORS.text.muted }}>NSE · Paper</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close order ticket"
            style={{
              padding: 4,
              color: V2_COLORS.text.muted,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Order type */}
          <div style={{ display: 'flex', gap: 4 }} role="radiogroup" aria-label="Order type">
            {['MARKET', 'LIMIT'].map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={orderType === t}
                onClick={() => setOrderType(t)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  color: orderType === t ? V2_COLORS.accent.primary : V2_COLORS.text.muted,
                  background: orderType === t ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  border: `1px solid ${orderType === t ? V2_COLORS.accent.primary : V2_COLORS.bg.border}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >{t}</button>
            ))}
          </div>

          {/* Qty */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, color: V2_COLORS.text.muted }}>Quantity</span>
            <input
              ref={qtyRef}
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              style={{
                padding: '6px 8px',
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                color: V2_COLORS.text.primary,
                background: V2_COLORS.bg.tertiary,
                border: `1px solid ${V2_COLORS.bg.border}`,
                borderRadius: 4,
                outline: 'none',
              }}
            />
          </label>

          {/* Price */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, color: V2_COLORS.text.muted }}>
              {orderType === 'LIMIT' ? 'Limit Price' : 'Market Price'}
            </span>
            <input
              type="number"
              value={orderType === 'LIMIT' ? limitPrice : currentPrice?.toFixed?.(2) ?? ''}
              onChange={(e) => setLimitPrice(e.target.value)}
              readOnly={orderType === 'MARKET'}
              style={{
                padding: '6px 8px',
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                color: V2_COLORS.text.primary,
                background: V2_COLORS.bg.tertiary,
                border: `1px solid ${V2_COLORS.bg.border}`,
                borderRadius: 4,
                outline: 'none',
                cursor: orderType === 'MARKET' ? 'default' : 'text',
                opacity: orderType === 'MARKET' ? 0.7 : 1,
              }}
            />
          </label>

          {/* Summary */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 10px',
            background: V2_COLORS.bg.tertiary,
            borderRadius: 4,
            fontSize: 11,
          }}>
            <span style={{ color: V2_COLORS.text.muted }}>Estimated value</span>
            <span style={{ color: V2_COLORS.text.primary, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
              {formatPrice(total)}
            </span>
          </div>

          <button
            onClick={submit}
            disabled={!valid}
            style={{
              padding: '8px 0',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              background: isBuy ? V2_COLORS.positive : V2_COLORS.negative,
              border: 'none',
              borderRadius: 4,
              cursor: valid ? 'pointer' : 'default',
              opacity: valid ? 1 : 0.5,
            }}
          >
            {side} {qty || 0} {symbol} · Paper
          </button>
        </div>
      </div>
    </div>
  );
}
