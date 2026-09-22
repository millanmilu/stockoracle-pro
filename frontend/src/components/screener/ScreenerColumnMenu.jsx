import React from 'react';
import { Eye, EyeOff, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { TN, panel, sectionTitle } from './terminalTheme';

/**
 * ⚙ Columns menu: visibility toggles + ordering + width reset for the
 * current column group. Presentational — config state lives in the parent
 * and is persisted to localStorage there.
 */
export default function ScreenerColumnMenu({
  columns = [],
  isVisible,
  onToggle,
  onMove,
  onResetWidths,
  onClose,
}) {
  return (
    <div style={panel({ padding: '10px 12px', minWidth: 260, maxWidth: 320, background: TN.panelAlt, boxShadow: '0 12px 32px rgba(0,0,0,0.6)' })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={sectionTitle()}>Visible columns ({columns.filter((c) => isVisible(c.key)).length}/{columns.length})</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={onResetWidths} title="Reset column widths" style={{ background: 'transparent', border: 'none', color: TN.faint, cursor: 'pointer', display: 'flex' }}><RotateCcw size={13} /></button>
          <button type="button" onClick={onClose} title="Close" style={{ background: 'transparent', border: 'none', color: TN.faint, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
        </span>
      </div>
      <div className="tn-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflowY: 'auto' }}>
        {columns.map((c, i) => {
          const vis = isVisible(c.key);
          return (
            <div
              key={c.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: TN.radius,
                background: vis ? 'transparent' : 'rgba(148,163,184,0.05)',
              }}
            >
              <button
                type="button"
                onClick={() => onToggle(c.key)}
                title={vis ? `Hide ${c.label}` : `Show ${c.label}`}
                aria-pressed={vis}
                style={{ background: 'transparent', border: 'none', color: vis ? TN.accent : TN.faint, cursor: 'pointer', display: 'flex', padding: 2 }}
              >
                {vis ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <span style={{ flex: 1, fontSize: 12, color: vis ? TN.text : TN.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
              <button type="button" onClick={() => onMove(c.key, -1)} disabled={i === 0} title="Move left" style={{ background: 'transparent', border: 'none', color: i === 0 ? '#334155' : TN.faint, cursor: i === 0 ? 'default' : 'pointer', display: 'flex', padding: 2 }}><ChevronLeft size={13} /></button>
              <button type="button" onClick={() => onMove(c.key, 1)} disabled={i === columns.length - 1} title="Move right" style={{ background: 'transparent', border: 'none', color: i === columns.length - 1 ? '#334155' : TN.faint, cursor: i === columns.length - 1 ? 'default' : 'pointer', display: 'flex', padding: 2 }}><ChevronRight size={13} /></button>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: TN.faint }}>Drag the header edge to resize · layout is remembered</div>
    </div>
  );
}
