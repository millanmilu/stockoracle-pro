/**
 * StockOracle Pro — MenuItem: small reusable context-menu button.
 *
 * Extracted from DrawingTools.jsx (was L3981–4009).
 * Used by the right-click context menu and the object-tree actions.
 */

import React from 'react';

export default function MenuItem({ icon, label, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '7px 12px',
        border: 0,
        borderRadius: 0,
        background: 'transparent',
        color: disabled ? '#787B86' : danger ? '#EF5350' : 'var(--text-primary, #D1D4DC)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 13,
        textAlign: 'left',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--hover-bg, #2A2E39)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {icon}
      {label}
    </button>
  );
}
