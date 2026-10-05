import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import {
  FIB_TOGGLES,
  VISIBILITY_INTERVALS,
  drawingDefaults,
  getDrawingCaps,
} from './drawingSettingsSchema';
import { getToolLabel } from './drawingToolCatalog';
import { toStorableSettings } from './drawingToolDefaults';
import DrawingColorPicker from './DrawingColorPicker';
import {
  SectionTitle, SettingRow, ToggleSwitch, WidthSegmented, StyleButtons,
} from './drawingStyleControls';

// --- Detailed drawing settings popover (DrawingSettingsPanel service) ---
//
// SECONDARY surface: opens from the toolbar ⚙, never shown by default.
// One compact scrolling card (contextual sections only — irrelevant controls
// are never rendered), live preview on every change, Cancel restores via the
// host snapshot, Apply commits a single history entry.

const numberInput = {
  width: 64, background: 'var(--drawing-control-bg, #131722)',
  border: '1px solid var(--drawing-control-border, #2A2E39)', borderRadius: 5,
  padding: '4px 6px', color: 'var(--drawing-settings-text, #D1D4DC)', fontSize: 12,
  textAlign: 'right', outline: 'none',
};
const selectStyle = {
  background: 'var(--drawing-control-bg, #131722)',
  border: '1px solid var(--drawing-control-border, #2A2E39)', borderRadius: 5,
  padding: '4px 6px', color: 'var(--drawing-settings-text, #D1D4DC)', fontSize: 12,
  outline: 'none', maxWidth: 150,
};
const subtleBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--drawing-toolbar-muted, #787B86)', fontSize: 12, padding: '6px 4px',
};
const checkRow = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '5px 0', fontSize: 12, color: 'var(--drawing-settings-text, #D1D4DC)', cursor: 'pointer',
};

function fmtTime(t) {
  if (t == null) return '—';
  if (typeof t === 'number' && Number.isFinite(t)) {
    try {
      return new Date(t * 1000).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false,
      });
    } catch { return String(t); }
  }
  return String(t).slice(0, 16);
}

export default function DrawingSettingsPopover({
  drawing, onPatch = () => {}, onClose = () => {}, onApplyToSameType = () => {},
  onSaveDefault = () => {}, timeForLogical, timeframeMs = 0,
  magnetMode, onMagnetChange, onBringToFront, onSendToBack,
}) {
  const caps = useMemo(() => getDrawingCaps(drawing?.type), [drawing?.type]);
  if (!drawing) return null;
  const d = { ...drawingDefaults(drawing.type), ...drawing };
  const patch = (p) => onPatch(p);
  const label = drawing.name || getToolLabel(drawing.type) || drawing.type;
  const hasStroke = caps.line || caps.border;

  // ---- Coordinates rows ----
  const points = Array.isArray(d.points) ? d.points : null;
  const logicalPatch = (logical) => {
    const baseLogical = Math.round(logical);
    const frac = logical - baseLogical;
    return { logical, time: timeForLogical?.(logical) ?? null, frac, offMs: frac * timeframeMs };
  };
  const coordRows = [];
  if (points) {
    points.forEach((pt, i) => {
      coordRows.push({
        key: `p${i}`, title: `P${i + 1}`, price: pt?.price, time: pt?.time ?? null, logical: pt?.logical,
        onPrice: (v) => patch({ points: points.map((p, j) => (j === i ? { ...p, price: v } : p)) }),
        onLogical: (v) => patch({ points: points.map((p, j) => (j === i ? { ...p, ...logicalPatch(v) } : p)) }),
      });
    });
  } else {
    const legacy = [
      ['start', 'P1', 'startPrice', 'startTime', 'startLogical', 'startFrac', 'startOffMs'],
      ['end', 'P2', 'endPrice', 'endTime', 'endLogical', 'endFrac', 'endOffMs'],
    ];
    legacy.forEach(([key, title, pk, tk, lk, fk, ok]) => {
      if (d[pk] != null || d[lk] != null) {
        coordRows.push({
          key, title, price: d[pk], time: d[tk] ?? null, logical: d[lk],
          onPrice: (v) => patch({ [pk]: v }),
          onLogical: (v) => patch({ [lk]: v, [tk]: logicalPatch(v).time, [fk]: logicalPatch(v).frac, [ok]: logicalPatch(v).offMs }),
        });
      }
    });
  }

  const vis = d.visibleIntervals;
  const allVisible = !vis || vis.length === 0;
  const norm = (v) => String(v).toLowerCase();
  const storable = toStorableSettings({ ...drawingDefaults(drawing.type), ...drawing });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 0' }}>
        <span
          style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: d.color || '#2962FF' }}
        />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--drawing-settings-text, #D1D4DC)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        <button onClick={() => onClose({ cancel: true })} title="Close settings"
          style={{ background: 'transparent', border: 'none', color: '#787B86', cursor: 'pointer', display: 'flex', padding: 2 }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ padding: '0 14px', overflowY: 'auto', minHeight: 0 }}>
        <SectionTitle>Appearance</SectionTitle>
        {hasStroke && (
          <SettingRow label={caps.line ? 'Border' : 'Line'}>
            <DrawingColorPicker dot alignRight title="Line color" value={d.color} onChange={(c) => patch({ color: c })} />
            <WidthSegmented value={d.strokeWidth} onChange={(strokeWidth) => patch({ strokeWidth })} />
          </SettingRow>
        )}
        {hasStroke && (
          <SettingRow label="Line style">
            <StyleButtons value={d.lineStyle || 'solid'} width={d.strokeWidth} onChange={(lineStyle) => patch({ lineStyle })} />
          </SettingRow>
        )}
        {hasStroke && (
          <SettingRow label="Opacity">
            <input type="range" min={0} max={1} step={0.01} value={d.opacity ?? 1}
              onChange={(e) => patch({ opacity: Number(e.target.value) })}
              style={{ flex: 1, accentColor: '#2962FF', minWidth: 90 }} />
            <span style={{ fontSize: 12, minWidth: 36, textAlign: 'right' }}>{Math.round((d.opacity ?? 1) * 100)}%</span>
          </SettingRow>
        )}
        {caps.background && (
          <>
            <SettingRow label="Fill">
              <ToggleSwitch checked={d.backgroundVisible !== false}
                onChange={(backgroundVisible) => patch({ backgroundVisible })} title="Fill on/off" />
            </SettingRow>
            {d.backgroundVisible !== false && (
              <>
                <SettingRow label="Fill color">
                  <DrawingColorPicker dot alignRight title="Fill color" value={d.backgroundColor || d.color}
                    onChange={(c) => patch({ backgroundColor: c })} />
                </SettingRow>
                <SettingRow label="Fill opacity">
                  <input type="range" min={0} max={1} step={0.01} value={d.backgroundOpacity ?? 0.15}
                    onChange={(e) => patch({ backgroundOpacity: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: '#2962FF', minWidth: 90 }} />
                  <span style={{ fontSize: 12, minWidth: 36, textAlign: 'right' }}>{Math.round((d.backgroundOpacity ?? 0.15) * 100)}%</span>
                </SettingRow>
              </>
            )}
          </>
        )}
        {caps.border && (
          <SettingRow label="Border color">
            <DrawingColorPicker dot alignRight title="Border color" value={d.borderColor || d.color}
              onChange={(c) => patch({ borderColor: c })} />
          </SettingRow>
        )}
        {caps.fibLevels && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0' }}>
              {FIB_TOGGLES.map((lv) => {
                const on = (d.fibLevelsVisible ?? FIB_TOGGLES).includes(lv);
                const customVal = d.fibLevelValues?.[lv];
                const activeVal = customVal ?? lv;
                return (
                  <div key={lv} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => {
                      const cur = new Set(d.fibLevelsVisible ?? FIB_TOGGLES);
                      if (on) cur.delete(lv); else cur.add(lv);
                      patch({ fibLevelsVisible: [...cur].sort((a, b) => a - b) });
                    }}
                      title={on ? 'Hide level' : 'Show level'}
                      style={{ width: 30, padding: '3px 0', borderRadius: 5, border: 'none', background: on ? '#10B981' : 'rgba(255,255,255,0.06)', color: '#FFF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {on ? 'ON' : 'OFF'}
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--drawing-settings-muted, #787B86)', width: 22, textAlign: 'right' }}>
                      {Math.round(lv * 1000) / 10}%
                    </span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max="5"
                      value={activeVal}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        const next = { ...(d.fibLevelValues ?? {}) };
                        if (Math.abs(v - lv) < 1e-9) delete next[lv]; else next[lv] = v;
                        patch({ fibLevelValues: next });
                      }}
                      title={`Level value (default ${lv})`}
                      style={{ width: 64, background: 'var(--drawing-control-bg, #131722)', border: '1px solid var(--drawing-control-border, #2A2E39)', borderRadius: 5, padding: '3px 6px', color: 'var(--drawing-settings-text, #D1D4DC)', fontSize: 12, textAlign: 'right', outline: 'none' }}
                    />
                  </div>
                );
              })}
            </div>
            <label style={checkRow} onClick={() => patch({ showPrices: !(d.showPrices !== false) })}>
              Show level prices
              <ToggleSwitch checked={d.showPrices !== false} onChange={(showPrices) => patch({ showPrices })} title="Show level prices" />
            </label>
          </>
        )}
        {caps.midLine && (
          <label style={checkRow} onClick={() => patch({ showMidLine: !(d.showMidLine !== false) })}>
            50% equilibrium line
            <ToggleSwitch checked={d.showMidLine !== false} onChange={(showMidLine) => patch({ showMidLine })} title="50% line" />
          </label>
        )}
        {caps.stats && (
          <>
            {[['showStatsBars', 'Bars count'], ['showStatsTime', 'Time / duration'], ['showStatsPrice', 'Price move'], ['showStatsPercent', 'Percent change']].map(([key, lbl]) => (
              <label key={key} style={checkRow} onClick={() => patch({ [key]: !(d[key] !== false) })}>
                {caps.volumeProfile && key === 'showStatsPrice' ? 'Price range' : caps.volumeProfile && key === 'showStatsPercent' ? 'Range percent' : lbl}
                <ToggleSwitch checked={d[key] !== false} onChange={(v) => patch({ [key]: v })} title={lbl} />
              </label>
            ))}
          </>
        )}
        {caps.showPrices && !caps.fibLevels && (
          <label style={checkRow} onClick={() => patch({ showPrices: !(d.showPrices !== false) })}>
            Price labels
            <ToggleSwitch checked={d.showPrices !== false} onChange={(showPrices) => patch({ showPrices })} title="Price labels" />
          </label>
        )}
        {caps.volumeProfile && (
          <>
            <SettingRow label="Rows">
              <input type="number" min={4} max={100} step={1} value={d.rows ?? 70}
                onChange={(e) => patch({ rows: Math.max(4, Math.min(100, Number(e.target.value) || 70)) })} style={numberInput} />
            </SettingRow>
            <SettingRow label="Value area %">
              <input type="number" min={10} max={99} step={1} value={d.valueAreaPercent ?? 70}
                onChange={(e) => patch({ valueAreaPercent: Math.max(10, Math.min(99, Number(e.target.value) || 70)) })} style={numberInput} />
            </SettingRow>
            <SettingRow label="Profile width %">
              <input type="number" min={10} max={100} step={1} value={d.profileWidthPercent ?? 40}
                onChange={(e) => patch({ profileWidthPercent: Math.max(10, Math.min(100, Number(e.target.value) || 40)) })} style={numberInput} />
            </SettingRow>
            <SettingRow label="Up / Down">
              <DrawingColorPicker dot alignRight title="Up volume" value={d.upColor || '#26A69A'} onChange={(c) => patch({ upColor: c })} />
              <DrawingColorPicker dot alignRight title="Down volume" value={d.downColor || '#EF5350'} onChange={(c) => patch({ downColor: c })} />
            </SettingRow>
            <SettingRow label="POC color">
              <DrawingColorPicker dot alignRight title="POC color" value={d.pocColor || '#EA580C'} onChange={(c) => patch({ pocColor: c })} />
            </SettingRow>
            <SettingRow label="Value area color">
              <DrawingColorPicker dot alignRight title="VAH / VAL color" value={d.vahValColor || '#38BDF8'} onChange={(c) => patch({ vahValColor: c })} />
            </SettingRow>
            <label style={checkRow} onClick={() => patch({ showPoc: !(d.showPoc !== false) })}>
              Point of Control
              <ToggleSwitch checked={d.showPoc !== false} onChange={(showPoc) => patch({ showPoc })} title="POC" />
            </label>
            <label style={checkRow} onClick={() => patch({ showVahVal: !(d.showVahVal !== false) })}>
              Value area lines
              <ToggleSwitch checked={d.showVahVal !== false} onChange={(showVahVal) => patch({ showVahVal })} title="VAH/VAL" />
            </label>
            <label style={checkRow} onClick={() => patch({ showProfileSummary: !(d.showProfileSummary !== false) })}>
              Profile summary
              <ToggleSwitch checked={d.showProfileSummary !== false} onChange={(showProfileSummary) => patch({ showProfileSummary })} title="Profile summary" />
            </label>
          </>
        )}

        {(caps.text || caps.fontSize) && (
          <>
            <SectionTitle>Text</SectionTitle>
            <input type="text" value={d.text || ''} onChange={(e) => patch({ text: e.target.value })}
              placeholder="Label text…"
              style={{
                width: '100%', background: 'var(--drawing-control-bg, #131722)',
                border: '1px solid var(--drawing-control-border, #2A2E39)', borderRadius: 5,
                padding: '6px 8px', color: 'var(--drawing-settings-text, #D1D4DC)', fontSize: 12,
                outline: 'none', boxSizing: 'border-box',
              }} />
            {caps.fontSize && (
              <SettingRow label="Size">
                <input type="range" min={8} max={48} step={1} value={d.fontSize || 12}
                  onChange={(e) => patch({ fontSize: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: '#2962FF', minWidth: 90 }} />
                <span style={{ fontSize: 12, minWidth: 36, textAlign: 'right' }}>{d.fontSize || 12}px</span>
              </SettingRow>
            )}
            <SettingRow label="Style">
              <div style={{ display: 'flex', gap: 2, background: 'var(--drawing-control-bg, #131722)', borderRadius: 7, padding: 2 }}>
                {[['fontBold', 'B', d.fontBold !== false], ['fontItalic', 'I', !!d.fontItalic]].map(([key, ch, on]) => (
                  <button key={key} type="button" title={key === 'fontBold' ? 'Bold' : 'Italic'}
                    onClick={() => patch(key === 'fontBold' ? { fontBold: d.fontBold === false } : { fontItalic: !d.fontItalic })}
                    style={{
                      minWidth: 28, height: 24, border: 'none', borderRadius: 5, cursor: 'pointer',
                      background: on ? '#2962FF' : 'transparent', color: '#FFF', fontSize: 12,
                      fontWeight: key === 'fontBold' ? 800 : 400, fontStyle: key === 'fontBold' ? 'normal' : 'italic',
                    }}>
                    {ch}
                  </button>
                ))}
              </div>
              <DrawingColorPicker dot alignRight title="Text color" value={d.textColor || d.color} onChange={(c) => patch({ textColor: c })} />
            </SettingRow>
            <SettingRow label="Align">
              <select value={d.textAlign || 'left'} onChange={(e) => patch({ textAlign: e.target.value })} style={selectStyle}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </SettingRow>
          </>
        )}

        {caps.coords > 0 && (
          <>
            <SectionTitle>Coordinates</SectionTitle>
            {!coordRows.length && (
              <div style={{ fontSize: 12, color: '#64748B' }}>Freehand drawing — no fixed anchors.</div>
            )}
            {coordRows.map((r) => (
              <div key={r.key} style={{ padding: '4px 0' }}>
                <SettingRow label={`${r.title} · price`}>
                  <input type="number" step="any" value={r.price ?? ''} placeholder="—"
                    onChange={(e) => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) r.onPrice(v); }}
                    style={numberInput} />
                </SettingRow>
                {r.onLogical && (
                  <SettingRow label={`${r.title} · bar`}>
                    <input type="number" step="any" value={r.logical ?? ''} placeholder="—"
                      onChange={(e) => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) r.onLogical(v); }}
                      style={numberInput} />
                  </SettingRow>
                )}
                <div style={{ fontSize: 11, color: '#64748B', textAlign: 'right' }}>{fmtTime(r.time)}</div>
              </div>
            ))}
          </>
        )}

        <SectionTitle>Visibility</SectionTitle>
        <label style={checkRow} onClick={() => patch({ visibleIntervals: allVisible ? [...VISIBILITY_INTERVALS] : null })}>
          Show on all timeframes
          <ToggleSwitch checked={allVisible} onChange={() => patch({ visibleIntervals: allVisible ? [...VISIBILITY_INTERVALS] : null })} title="All timeframes" />
        </label>
        {!allVisible && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '4px 0 2px' }}>
            {VISIBILITY_INTERVALS.map((iv) => {
              const on = (vis || []).map(norm).includes(iv.toLowerCase());
              return (
                <button key={iv} onClick={() => {
                  let cur = [...(vis || [])];
                  if (cur.map(norm).includes(iv.toLowerCase())) cur = cur.filter((v) => norm(v) !== iv.toLowerCase());
                  else cur.push(iv);
                  if (cur.length >= VISIBILITY_INTERVALS.length) cur = null;
                  patch({ visibleIntervals: cur });
                }}
                  style={{ padding: '3px 8px', borderRadius: 5, border: 'none', background: on ? '#2962FF' : 'rgba(255,255,255,0.06)', color: '#FFF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {iv}
                </button>
              );
            })}
          </div>
        )}
        {caps.extend && (
          <>
            <label style={checkRow} onClick={() => patch({ extendLeft: !d.extendLeft })}>
              Extend left
              <ToggleSwitch checked={!!d.extendLeft} onChange={(extendLeft) => patch({ extendLeft })} title="Extend left" />
            </label>
            <label style={checkRow} onClick={() => patch({ extendRight: !d.extendRight })}>
              Extend right
              <ToggleSwitch checked={!!d.extendRight} onChange={(extendRight) => patch({ extendRight })} title="Extend right" />
            </label>
          </>
        )}

        <SectionTitle>Interaction</SectionTitle>
        <label style={checkRow} onClick={() => patch({ locked: !d.locked })}>
          Lock drawing
          <ToggleSwitch checked={!!d.locked} onChange={(locked) => patch({ locked })} title="Lock" />
        </label>
        <label style={checkRow} onClick={() => patch({ selectable: !(d.selectable !== false) })}>
          Allow selection
          <ToggleSwitch checked={d.selectable !== false} onChange={(selectable) => patch({ selectable })} title="Selection" />
        </label>
        {onMagnetChange ? (
          <SettingRow label="Magnet">
            <select value={magnetMode || 'off'} onChange={(e) => onMagnetChange(e.target.value)} style={selectStyle}>
              <option value="off">Off</option>
              <option value="weak">Weak</option>
              <option value="strong">Strong</option>
            </select>
          </SettingRow>
        ) : null}
        {(onBringToFront || onSendToBack) && (
          <SettingRow label="Layer">
            <div style={{ display: 'flex', gap: 6 }}>
              {onBringToFront && <button onClick={onBringToFront} style={subtleBtn} title="Paint above all others">To front</button>}
              {onSendToBack && <button onClick={onSendToBack} style={subtleBtn} title="Paint below all others">To back</button>}
            </div>
          </SettingRow>
        )}
        <div style={{ height: 6 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 10px', borderTop: '1px solid var(--drawing-settings-border, #2A2E39)' }}>
        <button onClick={() => onPatch(toStorableSettings(drawingDefaults(drawing.type)))} title="Reset to tool defaults" style={subtleBtn}>
          Reset
        </button>
        <button onClick={() => onSaveDefault(storable)} title="Save current style as default for new drawings of this type" style={subtleBtn}>
          Save default
        </button>
        <button onClick={() => onApplyToSameType(storable)} title="Apply current style to all drawings of this type" style={subtleBtn}>
          Apply to all
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => onClose()}
          style={{ background: '#2962FF', border: 'none', borderRadius: 6, padding: '7px 18px', color: '#FFF', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Apply
        </button>
      </div>
    </div>
  );
}
