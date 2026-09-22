import React from 'react';
import { Save, X } from 'lucide-react';
import { TN, btn, btnPrimary, input } from './terminalTheme';

export default function ScreenerSaveModal({
  isOpen,
  onClose,
  screenName,
  setScreenName,
  onSave
}) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(2, 4, 10, 0.82)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 250,
      padding: 20
    }}>
      <div style={{
        background: TN.panel,
        border: `1px solid ${TN.borderStrong}`,
        borderRadius: TN.radius,
        width: '100%',
        maxWidth: 400,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${TN.border}`, paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Save size={15} color={TN.accent} />
            <h2 style={{ margin: 0, fontSize: 15, color: TN.text, fontWeight: 700 }}>Save Custom Screen</h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: TN.muted, cursor: 'pointer', padding: 4 }}>
            <X size={15} />
          </button>
        </div>

        <div>
          <label style={{ fontSize: 12, color: TN.muted, fontWeight: 600 }}>Screen name</label>
          <input
            type="text"
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            placeholder="e.g. High ROCE Breakouts"
            autoFocus
            style={input({ width: '100%', height: 32, padding: '0 10px', marginTop: 6, boxSizing: 'border-box' })}
          />
          <div style={{ fontSize: 11, color: TN.faint, marginTop: 6 }}>Saves the current filters, columns, sorting and universe.</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
          <button onClick={onClose} style={btn()}>Cancel</button>
          <button onClick={onSave} style={btnPrimary()}>Save Screen</button>
        </div>
      </div>
    </div>
  );
}
