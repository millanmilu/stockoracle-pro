import React from 'react';
import { Eye, EyeOff, Lock, Trash2, Unlock, Ungroup, Group, X } from 'lucide-react';
import DrawingColorPicker from './DrawingColorPicker';
import { OpacitySlider, StyleButtons, WidthButtons } from './drawingStyleControls';

// --- Multi-selection floating toolbar (DrawingToolbar service) ---
//
//Shown when 2+ drawings are selected (Shift/Ctrl+click or drag-marquee).
// Bulk-applies color / width / style / visibility / lock, plus Group and
// Ungroup. Grouping assigns a shared `groupId` (shown as a chip in the
// object tree); ungrouping clears it. Same props API as before.

const iconBtn = {
  display: 'flex', alignItems: 'center', padding: 4, border: 0, borderRadius: 4,
  color: 'var(--drawing-toolbar-muted, #787B86)', background: 'transparent', cursor: 'pointer',
};

const rowLabel = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--drawing-toolbar-muted, #787B86)',
};

export function SelectedDrawingsToolbar({
  count, isOpen, onClear, onDelete, onPatch, selectedDrawings, toolbarWidth,
}) {
  const allHidden = selectedDrawings.length > 0 && selectedDrawings.every((d) => d.hidden);
  const allLocked = selectedDrawings.length > 0 && selectedDrawings.every((d) => d.locked);
  const first = selectedDrawings[0] || {};
  const sharedWidth = selectedDrawings.every((d) => (d.strokeWidth || 2) === (first.strokeWidth || 2))
    ? (first.strokeWidth || 2) : null;
  const sharedStyle = selectedDrawings.every((d) => (d.lineStyle || 'solid') === (first.lineStyle || 'solid'))
    ? (first.lineStyle || 'solid') : null;
  const groupIds = [...new Set(selectedDrawings.map((d) => d.groupId).filter(Boolean))];
  const grouped = groupIds.length === 1 && selectedDrawings.every((d) => d.groupId === groupIds[0]);
  const left = (isOpen ? toolbarWidth : 0) + 12;

  return (
    <div
      data-drawing-ui="floating-toolbar-multi"
      style={{
        position: 'absolute', top: 12, left,
        display: 'flex', flexDirection: 'column', gap: 6,
        maxWidth: 'min(480px, calc(100% - 24px))',
        padding: '6px 10px',
        color: 'var(--drawing-toolbar-text, #D1D4DC)',
        background: 'var(--drawing-toolbar-bg, #1E222D)',
        border: '1px solid var(--drawing-toolbar-border, #2A2E39)',
        borderRadius: 6,
        boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
        zIndex: 60, userSelect: 'none',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <strong style={{ color: 'var(--drawing-toolbar-active, #2962FF)', fontSize: 11, whiteSpace: 'nowrap' }}>
          {count} selected
        </strong>
        <div style={{ flex: 1 }} />
        <button type="button" title={allHidden ? 'Show selected drawings' : 'Hide selected drawings'}
          onClick={() => onPatch({ hidden: !allHidden })} style={iconBtn}>
          {allHidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button type="button" title={allLocked ? 'Unlock selected drawings' : 'Lock selected drawings'}
          onClick={() => onPatch({ locked: !allLocked })}
          style={{ ...iconBtn, color: allLocked ? '#F59E0B' : 'var(--drawing-toolbar-muted, #787B86)' }}>
          {allLocked ? <Lock size={15} /> : <Unlock size={15} />}
        </button>
        <button type="button" title={grouped ? 'Ungroup selected drawings' : 'Group selected drawings'}
          onClick={() => onPatch(grouped ? { groupId: null } : { groupId: `grp_${Date.now()}` })}
          style={{ ...iconBtn, color: grouped ? '#2962FF' : 'var(--drawing-toolbar-muted, #787B86)' }}>
          {grouped ? <Ungroup size={15} /> : <Group size={15} />}
        </button>
        <button type="button" title="Delete selected drawings" onClick={onDelete} style={{ ...iconBtn, color: '#EF5350' }}>
          <Trash2 size={15} />
        </button>
        <button type="button" title="Clear selection (Esc)" onClick={onClear} style={iconBtn}>
          <X size={15} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={rowLabel}>Color</span>
        <DrawingColorPicker compact value={first.color || '#2962FF'} onChange={(color) => onPatch({ color })} />
        <span style={rowLabel}>Width</span>
        <WidthButtons value={sharedWidth} onChange={(strokeWidth) => onPatch({ strokeWidth })} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={rowLabel}>Style</span>
        <StyleButtons value={sharedStyle} width={sharedWidth || 2} onChange={(lineStyle) => onPatch({ lineStyle })} />
        <OpacitySlider label="Line" value={first.opacity ?? 1} onChange={(opacity) => onPatch({ opacity })} />
      </div>
    </div>
  );
}
