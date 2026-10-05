import React from 'react';
import DrawingSettingsPopover from './DrawingSettingsPopover';

// --- Drawing settings dialog (floating card) ---
//
// Thin wrapper preserving the DrawingSettingsHost API (drawing, onPatch,
// onClose, onApplyToSameType, onSaveDefault, …). When the host resolves a
// `floating` position (in a stable chart corner), the card floats there
// with a transparent outside-click catcher and NO dim backdrop — the chart
// stays dominant. Without it (anchor unresolvable) it falls back to a
// compact centered card. The toolbar ⚙ renders DrawingSettingsPopover
// anchored instead — single content implementation.

const cardStyle = {
  width: 320,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--drawing-settings-bg, #1E222D)',
  border: '1px solid var(--drawing-settings-border, #2A2E39)',
  borderRadius: 10,
  boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
};

export default function DrawingSettingsModal(props) {
  const { onClose = () => {}, floating = null } = props;

  if (floating) {
    const posStyle = floating.bottom != null
      ? { bottom: floating.bottom, left: floating.left }
      : { top: floating.top, left: floating.left };
    return (
      <>
        <div
          data-drawing-ui="settings-catcher"
          onMouseDown={() => onClose({ cancel: true })}
          style={{ position: 'fixed', inset: 0, zIndex: 299 }}
        />
        <div
          data-drawing-ui="settings-modal"
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', ...posStyle, zIndex: 300,
            maxHeight: floating.maxHeight || 560,
          }}
        >
          <div style={{ ...cardStyle, maxWidth: 'calc(100vw - 16px)', maxHeight: 'inherit' }}>
            <DrawingSettingsPopover {...props} />
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      data-drawing-ui="settings-modal"
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(3,7,18,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose({ cancel: true }); }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ ...cardStyle, maxWidth: '94vw', maxHeight: '88vh' }}
      >
        <DrawingSettingsPopover {...props} />
      </div>
    </div>
  );
}
