import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Copy, Eye, EyeOff, Layers, Settings, Trash2 } from 'lucide-react';
import { getToolSpec } from './drawingToolCatalog';
import MenuItem from './DrawingMenuItem';
import { pinDigitForIndex, readPinnedIds } from './drawingToolUtils';
import { ToolIcon } from './DrawingToolbar';

// --- right-click context menu ---

export function DrawingContextMenu({
  bringToFront, clipboard, cloneDrawing, contextMenu, contextTarget, copyDrawing, handleClearAll,
  handleSelectTool, hiddenIds, pasteClipboard, removeDrawing, sendToBack, setContextMenu,
  setDrawingSettingsId, setHiddenIds, updateDrawing
}) {
  // Favourite tools for the empty-chart right-click menu (fresh read per open
  // so pins starred in the toolbar appear immediately).
  const menuFavouriteTools = useMemo(() => {
    if (!contextMenu || contextMenu.drawingId != null) return [];
    return readPinnedIds()
      .slice(0, 8)
      .map((id, i) => ({ spec: getToolSpec(id), digit: pinDigitForIndex(i) }))
      .filter((x) => x.spec);
  }, [contextMenu]);
  // Clamp inside the viewport: measure after paint, then shift left/up when
  // the click was near the right/bottom edge. Never overflows off-screen.
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ left: contextMenu.clientX, top: contextMenu.clientY });
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const M = 8;
    const w = el.offsetWidth || 220;
    const h = el.offsetHeight || 200;
    setPos({
      left: Math.max(M, Math.min(contextMenu.clientX, Math.max(M, window.innerWidth - w - M))),
      top: Math.max(M, Math.min(contextMenu.clientY, Math.max(M, window.innerHeight - h - M))),
    });
  }, [contextMenu.clientX, contextMenu.clientY]);
  return (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 61 }}
            onMouseDown={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div ref={menuRef} style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            zIndex: 62,
            minWidth: 200,
            padding: '4px 0',
            background: 'var(--bg-card, #1E222D)',
            border: '1px solid var(--border, #2A2E39)',
            borderRadius: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            userSelect: 'none',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
          }}>
            {contextTarget ? (
              <>
                <MenuItem icon={<Copy size={13} />} label="Copy" onClick={() => { copyDrawing(contextTarget.id); setContextMenu(null); }} />
                <MenuItem icon={<Layers size={13} />} label="Clone" onClick={() => { cloneDrawing(contextTarget.id); setContextMenu(null); }} />
                <MenuItem
                  icon={hiddenIds.has(contextTarget.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                  label={hiddenIds.has(contextTarget.id) ? 'Show' : 'Hide'}
                  onClick={() => {
                    updateDrawing(contextTarget.id, { hidden: !hiddenIds.has(contextTarget.id) });
                    setHiddenIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(contextTarget.id)) next.delete(contextTarget.id);
                      else next.add(contextTarget.id);
                      return next;
                    });
                    setContextMenu(null);
                  }}
                />
                <MenuItem icon={<ArrowUpRight size={13} />} label="Bring to front" onClick={() => { bringToFront(contextTarget.id); setContextMenu(null); }} />
                <MenuItem icon={<ArrowDownRight size={13} />} label="Send to back" onClick={() => { sendToBack(contextTarget.id); setContextMenu(null); }} />
                <div style={{ height: 1, background: 'var(--border, #2A2E39)', margin: '4px 0' }} />
                <MenuItem icon={<Settings size={13} />} label="Settings" onClick={() => { setDrawingSettingsId(contextTarget.id); setContextMenu(null); }} />
                <MenuItem icon={<Trash2 size={13} />} label="Remove" danger onClick={() => { removeDrawing(contextTarget.id); setContextMenu(null); }} />
              </>
            ) : (
              <>
                {menuFavouriteTools.length > 0 && (
                  <>
                    <div style={{ padding: '6px 12px 4px', color: '#787B86', fontSize: 11 }}>
                      Favorites
                    </div>
                    {menuFavouriteTools.map(({ spec, digit }) => (
                      <MenuItem
                        key={`fav-${spec.id}`}
                        icon={<ToolIcon toolId={spec.id} size={13} />}
                        label={digit ? `${spec.label}  [${digit}]` : spec.label}
                        onClick={() => { handleSelectTool(spec.id); setContextMenu(null); }}
                      />
                    ))}
                    <div style={{ height: 1, background: 'var(--border, #2A2E39)', margin: '4px 0' }} />
                  </>
                )}
                <MenuItem icon={<Copy size={13} />} label="Paste" disabled={!clipboard} onClick={() => { pasteClipboard(); setContextMenu(null); }} />
                <MenuItem icon={<Trash2 size={13} />} label="Remove all" danger onClick={() => { handleClearAll(); setContextMenu(null); }} />
              </>
            )}
          </div>
        </>
  );
}
