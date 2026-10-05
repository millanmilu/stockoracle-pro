import React from 'react';
import { DEFAULT_TOOL } from './drawingToolCatalog';

// --- floating text-note input ---

export function DrawingTextNoteInput({
  activeToolRef, handleAddText, isCursorMode, isOpen, setActiveTool, setChartLocked,
  setTextInputPos, setTextInputVal, textInputPos, textInputVal, toolbarWidth
}) {
  return (
        <div style={{
          position: 'absolute',
          left: textInputPos.x + (isOpen ? toolbarWidth : 0),
          top: textInputPos.y,
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
            placeholder="Type text note..."
            value={textInputVal}
            onChange={(e) => setTextInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddText();
              if (e.key === 'Escape') {
                setTextInputPos(null);
                if (!isCursorMode(activeToolRef.current)) {
                  setActiveTool(DEFAULT_TOOL);
                }
                setChartLocked(false);
              }
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
            }}
          />
          <button
            onClick={handleAddText}
            style={{
              background: '#2962FF',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
  );
}
