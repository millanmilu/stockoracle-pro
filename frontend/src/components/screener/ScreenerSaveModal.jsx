import React from 'react';
import { Save, X } from 'lucide-react';

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
      background: 'rgba(3, 7, 18, 0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 250,
      padding: 20
    }}>
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 14,
        width: '100%',
        maxWidth: 400,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Save size={16} color="#818CF8" />
            <h2 style={{ margin: 0, fontSize: '0.98rem', color: '#F0F0FF', fontWeight: 800 }}>Save Custom Screen</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div>
          <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>Screen Preset Name</label>
          <input
            type="text"
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            placeholder="e.g. High ROCE Breakouts"
            autoFocus
            style={{
              width: '100%',
              background: '#060913',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6,
              padding: '8px 12px',
              color: '#F0F0FF',
              marginTop: 6,
              outline: 'none',
              fontSize: '0.78rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: 'transparent',
              color: '#94A3B8',
              border: '1px solid rgba(255,255,255,0.1)',
              fontSize: '0.74rem',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              background: '#6366F1',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99,102,241,0.35)'
            }}
          >
            Save Screen
          </button>
        </div>
      </div>
    </div>
  );
}
