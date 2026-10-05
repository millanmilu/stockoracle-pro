import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Trash2, Unlock, X } from 'lucide-react';
import { getToolSpec } from './drawingToolCatalog';

// --- object tree panel ---

export function DrawingObjectTree({
  bringToFront, drawings, hiddenIds, removeDrawing, selectedDrawingId, sendToBack, setHiddenIds,
  setSelectedDrawingId, setShowObjectTree, updateDrawing
}) {
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  return (
        <div
          data-drawing-ui="object-tree"
          style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 60,
          width: 248,
          maxHeight: '60%',
          overflowY: 'auto',
          padding: '4px 0',
          background: 'var(--drawing-toolbar-bg, var(--bg-card, #1E222D))',
          border: '1px solid var(--drawing-toolbar-border, var(--border, #2A2E39))',
          borderRadius: 6,
          boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px' }}>
            <span style={{ color: 'var(--drawing-toolbar-text, #D1D4DC)', fontSize: 11, fontWeight: 700 }}>
              📁 Drawings
              <span style={{ color: '#787B86', fontWeight: 400 }}> ({drawings.length})</span>
            </span>
            <button type="button" onClick={() => setShowObjectTree(false)} style={{ background: 'transparent', border: 0, color: '#787B86', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
          {drawings.length === 0 ? (
            <div style={{ color: '#787B86', fontSize: 12, textAlign: 'center', padding: '14px 0' }}>No objects yet</div>
          ) : (
            drawings.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedDrawingId(d.id)}
                onDoubleClick={() => { setEditingId(d.id); setDraftName(d.name || getToolSpec(d.type)?.label || d.type.replace(/_/g, ' ')); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 0,
                  cursor: 'pointer',
                  background: d.id === selectedDrawingId ? 'rgba(41,98,255,0.12)' : 'transparent',
                  opacity: hiddenIds.has(d.id) ? 0.45 : 1,
                }}
              >
                <span style={{ width: 9, height: 2, borderRadius: 1, background: d.color || '#2962FF', flexShrink: 0 }} />
                {editingId === d.id ? (
                  <input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { updateDrawing(d.id, { name: draftName.trim() }); setEditingId(null); }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => { updateDrawing(d.id, { name: draftName.trim() }); setEditingId(null); }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-primary, #D1D4DC)', background: 'var(--bg-card, #131722)', border: '1px solid var(--border, #2A2E39)', borderRadius: 3 }} />
                ) : (
                  <span title="Double-click to rename" style={{ flex: 1, fontSize: 13, color: 'var(--text-primary, #D1D4DC)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.name || getToolSpec(d.type)?.label || (d.type === 'sticker' ? 'Stickers & Emoji' : d.type.replace(/_/g, ' '))}
                  </span>
                )}
                {d.groupId && (
                  <span title={`Grouped (${d.groupId}) — select the group via Shift+drag to edit together`}
                    style={{ fontSize: 9, fontWeight: 700, color: '#2962FF', background: 'rgba(41,98,255,0.14)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>
                    GRP
                  </span>
                )}
                <button type="button" title={d.locked ? 'Unlock' : 'Lock'} onClick={(e) => { e.stopPropagation(); updateDrawing(d.id, { locked: !d.locked }); }}
                  style={{ background: 'transparent', border: 0, color: d.locked ? '#F59E0B' : '#787B86', cursor: 'pointer', padding: 2, display: 'flex' }}>
                  {d.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
                <button
                  type="button"
                  title={hiddenIds.has(d.id) ? 'Show' : 'Hide'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setHiddenIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(d.id)) next.delete(d.id);
                      else next.add(d.id);
                      return next;
                    });
                      updateDrawing(d.id, { hidden: !(hiddenIds.has(d.id) || d.hidden) });
                  }}
                  style={{ background: 'transparent', border: 0, color: '#787B86', cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  {hiddenIds.has(d.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button type="button" title="Bring to front" onClick={(e) => { e.stopPropagation(); bringToFront(d.id); }}
                  style={{ background: 'transparent', border: 0, color: '#787B86', cursor: 'pointer', padding: 2, display: 'flex' }}>
                  <ArrowUp size={13} />
                </button>
                <button type="button" title="Send to back" onClick={(e) => { e.stopPropagation(); sendToBack(d.id); }}
                  style={{ background: 'transparent', border: 0, color: '#787B86', cursor: 'pointer', padding: 2, display: 'flex' }}>
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  title="Remove"
                  onClick={(e) => { e.stopPropagation(); removeDrawing(d.id); }}
                  style={{ background: 'transparent', border: 0, color: '#787B86', cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
  );
}
