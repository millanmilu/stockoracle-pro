import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Copy, Eye, EyeOff, GripVertical,
  Lock, MoreVertical, Settings, Trash2, Unlock, X,
} from 'lucide-react';
import { COLOR_PRESETS, LINE_STYLES, getDrawingCaps } from './drawingSettingsSchema';
import { getToolLabel } from './drawingToolCatalog';
import DrawingColorPicker from './DrawingColorPicker';
import DrawingSettingsPopover from './DrawingSettingsPopover';
import {
  MiniPanel, OverflowItem, StyleRow, ToolButton, ToggleSwitch, WidthSegmented,
} from './drawingStyleControls';

// --- Compact contextual toolbar (single 40px row) ---
//
// Only the most frequent controls live here: name, visibility, lock, color,
// width, style, settings, more. Everything else opens on demand (anchored
// mini-panels) or in the secondary ⚙ settings popover. One `panel` state
// guarantees a single open surface; a transparent catcher closes on outside
// click. The detailed settings card is portaled to a fixed chart corner so it
// remains independent of the selected drawing's geometry.

const BAR_H = 40;
const SETTINGS_W = 300;

const divider = { width: 1, alignSelf: 'stretch', margin: '8px 2px', background: 'var(--drawing-toolbar-border, #2A2E39)' };

const iconBtn = (active = false, danger = false) => ({
  background: active ? 'rgba(245,158,11,0.15)' : 'transparent',
  border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0,
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: danger ? '#EF5350' : active ? '#F59E0B' : 'var(--drawing-toolbar-muted, #787B86)',
});

function FillDot({ on, color, onToggle, title }) {
  return (
    <button
      type="button" onClick={onToggle} title={title} aria-pressed={on}
      style={{
        width: 20, height: 20, padding: 0, borderRadius: '50%', cursor: 'pointer',
        background: on ? (color || '#2962FF') : 'transparent',
        border: on ? '1px solid rgba(127,127,127,0.5)' : '1px dashed var(--drawing-toolbar-muted, #787B86)',
        opacity: on ? 1 : 0.7,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35)',
      }}
    />
  );
}

export function SelectedDrawingToolbar({
  deleteSelectedDrawing, handleDuplicateSelected, hiddenIds, isOpen, paneHeight,
  mainPaneRef, selectedDrawing, selectedDrawingId, setHiddenIds,
  setSelectedDrawingId, surfaceSize, toolbarWidth, updateSelectedDrawing,
  onBringToFront, onSendToBack, onSaveToolDefault, onApplyToSameType,
  timeForLogical, timeframeMs = 0, magnetMode, onMagnetChange,
}) {
  const [panel, setPanel] = useState(null); // null | 'width' | 'style' | 'more' | 'settings' | 'size'
  const [manualPosition, setManualPosition] = useState(null);
  const toolbarRef = useRef(null);
  const dragRef = useRef(null);
  const toggle = (name) => setPanel((p) => (p === name ? null : name));

  useEffect(() => {
    setManualPosition(null);
  }, [selectedDrawingId]);

  const caps = getDrawingCaps(selectedDrawing.type);
  const hasStroke = caps.line || caps.border;
  const hasFill = !!caps.background;
  const isText = !!(caps.text || caps.fontSize);
  const isHidden = hiddenIds.has(selectedDrawingId) || selectedDrawing.hidden;
  const label = selectedDrawing.name || getToolLabel(selectedDrawing.type)
    || String(selectedDrawing.type || '').replace(/_/g, ' ');

  const baseLeft = isOpen ? toolbarWidth : 0;
  const paneW = surfaceSize?.width || 800;
  const paneH = paneHeight || surfaceSize?.height || 400;
  const compact = paneW < 560;

  // Keep the default toolbar out of the drawing area at the pane's top-right.
  const barW = 440;
  const measuredBarW = toolbarRef.current?.offsetWidth || barW;
  let left = Math.max(
    baseLeft + 8,
    baseLeft + paneW - measuredBarW - 12,
  );
  let top = 8;
  if (manualPosition) {
    left = manualPosition.left;
    top = manualPosition.top;
  }

  const onToolbarGripPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left,
      top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  const onToolbarGripPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = toolbarRef.current?.parentElement;
    const width = bounds?.clientWidth || paneW;
    const height = bounds?.clientHeight || paneH;
    const toolbarWidthNow = toolbarRef.current?.offsetWidth || barW;
    const toolbarHeightNow = toolbarRef.current?.offsetHeight || BAR_H;
    const minLeft = baseLeft + 8;
    const maxLeft = Math.max(minLeft, width - toolbarWidthNow - 8);
    const maxTop = Math.max(8, height - toolbarHeightNow - 8);
    setManualPosition({
      left: Math.max(minLeft, Math.min(maxLeft, drag.left + event.clientX - drag.startX)),
      top: Math.max(8, Math.min(maxTop, drag.top + event.clientY - drag.startY)),
    });
    event.preventDefault();
  };

  const onToolbarGripPointerUp = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  // Keep small quick panels near the selection toolbar.
  const settingsAlignRight = left + SETTINGS_W > baseLeft + paneW - 8;
  const settingsPane = mainPaneRef?.current?.getBoundingClientRect?.();
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const settingsWidth = Math.min(SETTINGS_W, viewportWidth - 24);
  const settingsLeft = Math.max(
    12,
    Math.min(
      (settingsPane?.width > 0 ? settingsPane.right - settingsWidth - 12 : viewportWidth - settingsWidth - 12),
      viewportWidth - settingsWidth - 12,
    ),
  );
  const settingsTop = Math.max(12, Math.min(
    (settingsPane?.height > 0 ? settingsPane.top + 12 : 84),
    viewportHeight - 220,
  ));
  const settingsAvailableHeight = Math.min(
    viewportHeight - settingsTop - 12,
    settingsPane?.height > 0 ? settingsPane.bottom - settingsTop - 12 : viewportHeight - settingsTop - 12,
  );
  const settingsFloatingStyle = {
    position: 'fixed',
    top: settingsTop,
    left: settingsLeft,
    width: settingsWidth,
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: Math.max(180, Math.min(560, settingsAvailableHeight)),
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--drawing-settings-bg, #1E222D)',
    border: '1px solid var(--drawing-settings-border, #2A2E39)',
    borderRadius: 10,
    boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    zIndex: 70,
  };

  const toggleHidden = () => {
    updateSelectedDrawing({ hidden: !isHidden });
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (isHidden) next.delete(selectedDrawingId);
      else next.add(selectedDrawingId);
      return next;
    });
  };

  const fillOn = selectedDrawing.backgroundVisible !== false;
  const lineColor = selectedDrawing.color;
  const textColor = selectedDrawing.textColor || selectedDrawing.color;

  return (
    <>
      {panel && (
        panel !== 'settings' && (
        <div
          data-drawing-ui="toolbar-catcher"
          onMouseDown={() => setPanel(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 59, cursor: 'default' }}
        />
        )
      )}
      <div
        ref={toolbarRef}
        data-drawing-ui="floating-toolbar"
        style={{
          position: 'absolute', top, left, height: BAR_H,
          display: 'flex', alignItems: 'center', gap: 2, padding: '0 6px',
          maxWidth: 'calc(100% - 24px)', overflow: 'visible', whiteSpace: 'nowrap',
          backgroundColor: 'var(--drawing-toolbar-bg, #1E222D)',
          border: '1px solid var(--drawing-toolbar-border, #2A2E39)',
          borderRadius: 10, zIndex: 60, userSelect: 'none',
          boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
        }}
      >
        <button
          type="button"
          title="Drag toolbar"
          aria-label="Drag drawing toolbar"
          onPointerDown={onToolbarGripPointerDown}
          onPointerMove={onToolbarGripPointerMove}
          onPointerUp={onToolbarGripPointerUp}
          onLostPointerCapture={onToolbarGripPointerUp}
          style={{
            ...iconBtn(),
            width: 20,
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <GripVertical size={15} />
        </button>
        {!compact && (
          <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: lineColor || '#2962FF', marginLeft: 4 }} />
            <span style={{
              fontSize: 12, color: 'var(--drawing-toolbar-muted, #787B86)', fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120,
            }}>
              {label}
            </span>
            <div style={divider} />
          </>
        )}

        <button onClick={toggleHidden} title={isHidden ? 'Show drawing' : 'Hide drawing'} style={iconBtn()}>
          {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button
          onClick={() => updateSelectedDrawing({ locked: !selectedDrawing.locked })}
          title={selectedDrawing.locked ? 'Unlock drawing' : 'Lock drawing'}
          style={iconBtn(!!selectedDrawing.locked)}
        >
          {selectedDrawing.locked ? <Lock size={15} /> : <Unlock size={15} />}
        </button>
        <div style={divider} />

        {/* Primary color: text color for annotations, line/border color otherwise.
            Controlled through the single `panel` state so outside-click closes
            it and it never overlaps another open surface. */}
        <DrawingColorPicker
          dot title={isText ? 'Text color' : 'Line color'}
          value={isText ? textColor : lineColor}
          alpha={selectedDrawing.opacity ?? 1}
          onAlphaChange={(opacity) => updateSelectedDrawing({ opacity })}
          onChange={(c) => updateSelectedDrawing(isText ? { textColor: c } : { color: c })}
          open={panel === 'lineColor'}
          onOpenChange={(o) => setPanel(o ? 'lineColor' : null)}
          alignRight={settingsAlignRight}
        />

        {/* Fill quick-toggle for shapes/channels/ranges */}
        {hasFill && (
          <FillDot
            on={fillOn} color={selectedDrawing.backgroundColor || lineColor}
            onToggle={() => updateSelectedDrawing({ backgroundVisible: !fillOn })}
            title={fillOn ? 'Fill on — click to disable' : 'Fill off — click to enable'}
          />
        )}

        {hasStroke && !isText && (
          <ToolButton title={`Width ${selectedDrawing.strokeWidth || 2}px`} wide active={panel === 'width'} onClick={() => toggle('width')}>
            {selectedDrawing.strokeWidth || 2}px ▾
          </ToolButton>
        )}
        {isText && caps.fontSize && (
          <ToolButton title="Font size" wide active={panel === 'size'} onClick={() => toggle('size')}>
            {selectedDrawing.fontSize || 12} ▾
          </ToolButton>
        )}
        {hasStroke && (
          <ToolButton title="Line style" active={panel === 'style'} onClick={() => toggle('style')}>
            <svg width="30" height="10" viewBox="0 0 30 10" aria-hidden="true">
              <line
                x1="1" y1="5" x2="29" y2="5"
                stroke="currentColor" strokeWidth={Math.min(3, Math.max(1.5, selectedDrawing.strokeWidth || 2))}
                strokeDasharray={(() => {
                  const s = selectedDrawing.lineStyle || 'solid';
                  if (s === 'dashed') return '5 3';
                  if (s === 'dotted') return '1.5 3';
                  if (s === 'dash_dot') return '6 2 1.5 2';
                  if (s === 'long_dash') return '10 3';
                  return undefined;
                })()}
                strokeLinecap={(selectedDrawing.lineStyle || 'solid') === 'dotted' ? 'round' : 'butt'}
              />
            </svg>
            ▾
          </ToolButton>
        )}

        <div style={divider} />
        <button onClick={() => toggle('settings')} title="Drawing settings" style={iconBtn(panel === 'settings')}>
          <Settings size={15} />
        </button>
        <button onClick={() => toggle('more')} title="More actions" style={iconBtn(panel === 'more')}>
          <MoreVertical size={15} />
        </button>
        <button onClick={() => setSelectedDrawingId(null)} title="Deselect (Esc)" style={iconBtn()}>
          <X size={15} />
        </button>

        {/* ---- Anchored panels (single open at a time) ---- */}
        {panel === 'width' && (
          <MiniPanel width={196}>
            <WidthSegmented custom value={selectedDrawing.strokeWidth}
              onChange={(strokeWidth) => updateSelectedDrawing({ strokeWidth })} />
          </MiniPanel>
        )}
        {panel === 'size' && (
          <MiniPanel width={210}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={8} max={48} step={1} value={selectedDrawing.fontSize || 12}
                onChange={(e) => updateSelectedDrawing({ fontSize: Number(e.target.value) })}
                style={{ flex: 1, accentColor: '#2962FF' }} />
              <span style={{ fontSize: 12, minWidth: 38, textAlign: 'right' }}>{selectedDrawing.fontSize || 12}px</span>
            </div>
          </MiniPanel>
        )}
        {panel === 'style' && (
          <MiniPanel width={180}>
            {LINE_STYLES.map((st) => (
              <StyleRow key={st} style={st} width={selectedDrawing.strokeWidth}
                active={(selectedDrawing.lineStyle || 'solid') === st}
                onPick={() => { updateSelectedDrawing({ lineStyle: st }); setPanel(null); }} />
            ))}
          </MiniPanel>
        )}
        {panel === 'more' && (
          <MiniPanel width={232} alignRight={settingsAlignRight}>
            {hasFill && (
              <>
                <OverflowItem
                  label="Fill" active={fillOn}
                  control={(
                    <ToggleSwitch checked={fillOn}
                      onChange={(backgroundVisible) => updateSelectedDrawing({ backgroundVisible })} title="Fill" />
                  )}
                />
                {fillOn && (
                  <>
                    <div style={{ display: 'flex', gap: 6, padding: '4px 8px', flexWrap: 'wrap' }}>
                      {COLOR_PRESETS.map((c) => (
                        <button key={c} type="button" title={c}
                          onClick={() => updateSelectedDrawing({ backgroundColor: c })}
                          style={{
                            width: 18, height: 18, padding: 0, borderRadius: '50%', background: c, cursor: 'pointer',
                            border: (selectedDrawing.backgroundColor || '').toUpperCase() === c
                              ? '2px solid var(--drawing-toolbar-text, #D1D4DC)' : '1px solid rgba(127,127,127,0.4)',
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
                      <input type="range" min={0} max={1} step={0.01}
                        value={selectedDrawing.backgroundOpacity ?? 0.15}
                        onChange={(e) => updateSelectedDrawing({ backgroundOpacity: Number(e.target.value) })}
                        style={{ flex: 1, accentColor: '#2962FF' }} />
                      <span style={{ fontSize: 11, minWidth: 34, textAlign: 'right' }}>
                        {Math.round((selectedDrawing.backgroundOpacity ?? 0.15) * 100)}%
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
            {caps.extend && (
              <OverflowItem
                label="Extend" hint={`${selectedDrawing.extendLeft ? '←' : ''}${selectedDrawing.extendRight ? '→' : ''}`}
                control={(
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[['extendLeft', '←', 'Extend left'], ['extendRight', '→', 'Extend right']].map(([key, ch, t]) => (
                      <button key={key} type="button" title={t}
                        onClick={() => updateSelectedDrawing({ [key]: !selectedDrawing[key] })}
                        style={{
                          width: 26, height: 24, borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 13,
                          background: selectedDrawing[key] ? '#2962FF' : 'var(--drawing-control-bg, #131722)',
                          color: '#FFF',
                        }}>
                        {ch}
                      </button>
                    ))}
                  </div>
                )}
              />
            )}
            {isText && (
              <>
                <OverflowItem
                  label="Bold" active={selectedDrawing.fontBold !== false}
                  onClick={() => updateSelectedDrawing({ fontBold: selectedDrawing.fontBold === false })}
                />
                <OverflowItem
                  label="Italic" active={!!selectedDrawing.fontItalic}
                  onClick={() => updateSelectedDrawing({ fontItalic: !selectedDrawing.fontItalic })}
                />
                <OverflowItem
                  label="Alignment"
                  control={(
                    <div style={{ display: 'flex', gap: 2, background: 'var(--drawing-control-bg, #131722)', borderRadius: 6, padding: 2 }}>
                      {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([v, Icon]) => (
                        <button key={v} type="button" title={v}
                          onClick={() => updateSelectedDrawing({ textAlign: v })}
                          style={{
                            width: 26, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: (selectedDrawing.textAlign || 'left') === v ? '#2962FF' : 'transparent',
                            color: '#FFF',
                          }}>
                          <Icon size={13} />
                        </button>
                      ))}
                    </div>
                  )}
                />
              </>
            )}
            <OverflowItem icon={<Copy size={14} />} label="Duplicate" hint="Ctrl+D" onClick={handleDuplicateSelected} />
            {onBringToFront && <OverflowItem icon={<ArrowUpToLine size={14} />} label="Bring to front" onClick={() => { onBringToFront(selectedDrawingId); setPanel(null); }} />}
            {onSendToBack && <OverflowItem icon={<ArrowDownToLine size={14} />} label="Send to back" onClick={() => { onSendToBack(selectedDrawingId); setPanel(null); }} />}
            <OverflowItem icon={<Trash2 size={14} />} label="Delete" hint="Del" danger onClick={deleteSelectedDrawing} />
          </MiniPanel>
        )}
      </div>
      {panel === 'settings' && typeof document !== 'undefined' && createPortal(
        <>
          <div
            data-drawing-ui="toolbar-catcher"
            onMouseDown={() => setPanel(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 69, cursor: 'default' }}
          />
          <div
            data-drawing-ui="settings-popover"
            onMouseDown={(e) => e.stopPropagation()}
            style={settingsFloatingStyle}
          >
            <DrawingSettingsPopover
              drawing={selectedDrawing}
              onPatch={(p) => updateSelectedDrawing(p)}
              onClose={() => setPanel(null)}
              onApplyToSameType={(patch) => { onApplyToSameType?.(selectedDrawing.type, patch); }}
              onSaveDefault={(patch) => { onSaveToolDefault?.(selectedDrawing.type, patch); }}
              timeForLogical={timeForLogical}
              timeframeMs={timeframeMs}
              magnetMode={magnetMode}
              onMagnetChange={onMagnetChange}
              onBringToFront={onBringToFront ? () => { onBringToFront(selectedDrawingId); } : undefined}
              onSendToBack={onSendToBack ? () => { onSendToBack(selectedDrawingId); } : undefined}
            />
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
