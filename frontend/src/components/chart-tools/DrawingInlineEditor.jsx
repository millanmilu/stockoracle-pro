import React from 'react';

// --- inline annotation text editor ---

export function DrawingInlineEditor({
  commitTextEdit, setTextEdit, setTextEditVal, textEditVal
}) {
  return (
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 60,
          background: 'var(--bg-card, #1E222D)',
          border: '1px solid var(--border, #2A2E39)',
          borderRadius: 4,
          padding: 4,
          display: 'flex',
          gap: 4,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <input
            type="text"
            value={textEditVal}
            onChange={(e) => setTextEditVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTextEdit();
              if (e.key === 'Escape') setTextEdit(null);
            }}
            autoFocus
            style={{
              background: 'var(--bg-card, #131722)',
              border: '1px solid var(--border, #2A2E39)',
              borderRadius: 4,
              padding: '4px 8px',
              color: 'var(--text-primary, #D1D4DC)',
              fontSize: 12,
              outline: 'none',
              minWidth: 180,
            }}
          />
          <button
            onClick={commitTextEdit}
            style={{ background: '#2962FF', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            OK
          </button>
        </div>
  );
}
