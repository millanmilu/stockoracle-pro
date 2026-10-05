import React from 'react';

// --- sticker / emoji picker ---

export function DrawingStickerPicker({
  handleAddSticker, isOpen, stickerPos, toolbarWidth
}) {
  return (
        <div style={{
          position: 'absolute',
          left: stickerPos.x + (isOpen ? toolbarWidth : 0),
          top: stickerPos.y,
          zIndex: 60,
          background: 'var(--bg-card, #1E222D)',
          border: '1px solid var(--border, #2A2E39)',
          borderRadius: 4,
          padding: 8,
          display: 'flex',
          gap: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {['🚀', '📈', '📉', '🎯', '⭐', '🔥', '👍', '❌', '💰', '🛡️'].map((emoji) => (
            <span
              key={emoji}
              onClick={() => handleAddSticker(emoji)}
              style={{ fontSize: 20, cursor: 'pointer', transition: 'transform 0.1s' }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
            >
              {emoji}
            </span>
          ))}
        </div>
  );
}
