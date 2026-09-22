import React, { useMemo, useState } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import {
  COLOR_PRESETS,
  LINE_STYLES,
  LINE_WIDTHS,
  VISIBILITY_INTERVALS,
  FIB_TOGGLES,
  getDrawingCaps,
  drawingDefaults,
} from './drawingSettingsSchema';
import { getToolLabel } from './drawingToolCatalog';

const shell = {
  width: 380,
  maxWidth: '94vw',
  maxHeight: '88vh',
  background: 'var(--bg-card, #0F172A)',
  border: '1px solid var(--border, rgba(99,102,241,0.3))',
  borderRadius: 12,
  boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'JetBrains Mono, monospace',
};

const sectionTitle = {
  fontSize: '0.62rem', fontWeight: 800, color: '#64748B',
  letterSpacing: '0.06em', margin: '12px 0 6px',
};
const rowLabel = { fontSize: '0.72rem', color: '#CBD5E1', minWidth: 110 };
const row = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 };
const numberInput = {
  width: 84, background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
  padding: '5px 8px', color: '#F1F5F9', fontSize: '0.74rem',
  fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', outline: 'none',
};
const textInput = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
  padding: '6px 10px', color: '#F1F5F9', fontSize: '0.74rem',
  outline: 'none', boxSizing: 'border-box',
};
const checkLabel = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: '0.72rem', color: '#CBD5E1', cursor: 'pointer', marginBottom: 6,
};

function ColorRow({ value, onChange }) {
  const customOk = /^#[0-9a-fA-F]{6}$/.test(value || '');
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      {COLOR_PRESETS.map((c) => (
        <div
          key={c}
          onClick={() => onChange(c)}
          title={c}
          style={{
            width: 18, height: 18, borderRadius: '50%', backgroundColor: c, cursor: 'pointer',
            border: value === c ? '2px solid #FFF' : '1px solid rgba(255,255,255,0.2)',
          }}
        />
      ))}
      <input
        type="color"
        value={customOk ? value : '#38BDF8'}
        onChange={(e) => onChange(e.target.value)}
        title="Custom color"
        style={{ width: 26, height: 22, padding: 0, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, background: 'transparent', cursor: 'pointer' }}
      />
    </div>
  );
}

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

/**
 * TradingView-style per-object settings dialog for EVERY drawing tool.
 * Tabs: Style / Text / Coordinates / Visibility (only relevant tabs shown).
 */
export default function DrawingSettingsModal({ drawing, onPatch = () => {}, onClose = () => {} }) {
  const caps = useMemo(() => getDrawingCaps(drawing?.type), [drawing?.type]);
  const [tab, setTab] = useState('style');

  if (!drawing) return null;
  const d = { ...drawingDefaults(drawing.type), ...drawing };
  const patch = (p) => onPatch(p);
  const label = getToolLabel(drawing.type);

  const tabs = [
    { id: 'style', label: 'Style' },
    ...(caps.text || caps.fontSize ? [{ id: 'text', label: 'Text' }] : []),
    ...(caps.coords > 0 ? [{ id: 'coords', label: 'Coordinates' }] : []),
    { id: 'visibility', label: 'Visibility' },
  ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'style';

  const points = Array.isArray(d.points) ? d.points : null;
  const coordRows = [];
  if (points) {
    points.forEach((pt, i) => {
      coordRows.push({
        key: `p${i}`, title: `Point ${i + 1}`,
        price: pt?.price, time: pt?.time ?? null, logical: pt?.logical,
        onPrice: (v) => {
          const next = points.map((p, j) => (j === i ? { ...p, price: v } : p));
          patch({ points: next });
        },
      });
    });
  } else {
    if (d.startPrice != null || d.startLogical != null) {
      coordRows.push({
        key: 'start', title: 'Point 1',
        price: d.startPrice, time: d.startTime ?? null, logical: d.startLogical,
        onPrice: (v) => patch({ startPrice: v }),
      });
    }
    if (d.endPrice != null || d.endLogical != null) {
      coordRows.push({
        key: 'end', title: 'Point 2',
        price: d.endPrice, time: d.endTime ?? null, logical: d.endLogical,
        onPrice: (v) => patch({ endPrice: v }),
      });
    }
    if (!coordRows.length && (d.startPrice != null || caps.coords >= 1)) {
      coordRows.push({
        key: 'single', title: 'Price',
        price: d.startPrice, time: d.startTime ?? null, logical: d.startLogical,
        onPrice: (v) => patch({ startPrice: v }),
      });
    }
  }

  const vis = d.visibleIntervals;
  const allVisible = !vis || vis.length === 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(3,7,18,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={shell} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 0' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary, #F1F5F9)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label} Settings
          </span>
          <button onClick={onClose} title="Close settings" style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', padding: 2 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: 'none',
                background: activeTab === t.id ? '#2962FF' : 'rgba(255,255,255,0.05)',
                color: '#FFF', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '4px 16px 16px', overflowY: 'auto' }}>
          {activeTab === 'style' && (
            <div>
              {(caps.line || caps.border) && (
                <>
                  <div style={sectionTitle}>LINE</div>
                  <div style={row}>
                    <span style={rowLabel}>Color</span>
                    <ColorRow value={d.color} onChange={(c) => patch({ color: c })} />
                  </div>
                  <div style={row}>
                    <span style={rowLabel}>Width</span>
                    <input type="range" min={1} max={5} step={1} value={d.strokeWidth || 2}
                      onChange={(e) => patch({ strokeWidth: Number(e.target.value) })}
                      style={{ flex: 1, accentColor: '#6366F1' }} />
                    <span style={{ fontSize: '0.7rem', color: '#E2E8F0', minWidth: 30, textAlign: 'right' }}>{d.strokeWidth || 2}px</span>
                  </div>
                  <div style={row}>
                    <span style={rowLabel}>Style</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {LINE_STYLES.map((st) => (
                        <button key={st} onClick={() => patch({ lineStyle: st })}
                          style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: (d.lineStyle || 'solid') === st ? '#2962FF' : 'rgba(255,255,255,0.06)', color: '#FFF', fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                  {caps.extend && (
                    <div style={{ marginTop: 4 }}>
                      <label style={checkLabel}>
                        <input type="checkbox" checked={!!d.extendLeft} onChange={(e) => patch({ extendLeft: e.target.checked })} style={{ accentColor: '#6366F1' }} />
                        Extend left
                      </label>
                      <label style={checkLabel}>
                        <input type="checkbox" checked={!!d.extendRight} onChange={(e) => patch({ extendRight: e.target.checked })} style={{ accentColor: '#6366F1' }} />
                        Extend right
                      </label>
                    </div>
                  )}
                </>
              )}

              {caps.background && (
                <>
                  <div style={sectionTitle}>BACKGROUND</div>
                  <label style={checkLabel}>
                    <input type="checkbox" checked={d.backgroundVisible !== false} onChange={(e) => patch({ backgroundVisible: e.target.checked })} style={{ accentColor: '#6366F1' }} />
                    Fill visible
                  </label>
                  <div style={row}>
                    <span style={rowLabel}>Fill color</span>
                    <ColorRow value={d.backgroundColor || d.color} onChange={(c) => patch({ backgroundColor: c })} />
                  </div>
                  <div style={row}>
                    <span style={rowLabel}>Opacity</span>
                    <input type="range" min={0} max={0.8} step={0.02} value={d.backgroundOpacity ?? 0.12}
                      onChange={(e) => patch({ backgroundOpacity: Number(e.target.value) })}
                      style={{ flex: 1, accentColor: '#6366F1' }} />
                    <span style={{ fontSize: '0.7rem', color: '#E2E8F0', minWidth: 36, textAlign: 'right' }}>{Math.round((d.backgroundOpacity ?? 0.12) * 100)}%</span>
                  </div>
                </>
              )}

              {caps.border && (
                <>
                  <div style={sectionTitle}>BORDER</div>
                  <label style={checkLabel}>
                    <input type="checkbox" checked={d.borderVisible !== false} onChange={(e) => patch({ borderVisible: e.target.checked })} style={{ accentColor: '#6366F1' }} />
                    Border visible
                  </label>
                </>
              )}

              {caps.fibLevels && (
                <>
                  <div style={sectionTitle}>FIB LEVELS</div>
                  {(d.fibLevelsVisible?.length ? d.fibLevelsVisible : FIB_TOGGLES).length >= 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {FIB_TOGGLES.map((lv) => {
                        const on = (d.fibLevelsVisible ?? FIB_TOGGLES).includes(lv);
                        return (
                          <button key={lv} onClick={() => {
                            const cur = new Set(d.fibLevelsVisible ?? FIB_TOGGLES);
                            if (on) cur.delete(lv); else cur.add(lv);
                            patch({ fibLevelsVisible: [...cur].sort((a, b) => a - b) });
                          }}
                            style={{ padding: '3px 8px', borderRadius: 5, border: 'none', background: on ? '#10B981' : 'rgba(255,255,255,0.06)', color: '#FFF', fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer' }}>
                            {Math.round(lv * 1000) / 10}%
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <label style={checkLabel}>
                    <input type="checkbox" checked={d.showPrices !== false} onChange={(e) => patch({ showPrices: e.target.checked })} style={{ accentColor: '#6366F1' }} />
                    Show level prices
                  </label>
                </>
              )}

              {caps.midLine && (
                <>
                  <div style={sectionTitle}>MIDDLE LINE (50%)</div>
                  <label style={checkLabel}>
                    <input type="checkbox" checked={d.showMidLine !== false} onChange={(e) => patch({ showMidLine: e.target.checked })} style={{ accentColor: '#6366F1' }} />
                    Show 50% equilibrium line
                  </label>
                </>
              )}

              {caps.stats && (
                <>
                  <div style={sectionTitle}>STATS LABEL</div>
                  {[
                    ['showStatsBars', 'Bars count'],
                    ['showStatsTime', 'Time / duration'],
                    ['showStatsPrice', 'Price move'],
                    ['showStatsPercent', 'Percent change'],
                  ].map(([key, lbl]) => (
                    <label key={key} style={checkLabel}>
                      <input type="checkbox" checked={d[key] !== false} onChange={(e) => patch({ [key]: e.target.checked })} style={{ accentColor: '#6366F1' }} />
                      {lbl}
                    </label>
                  ))}
                </>
              )}

              {caps.showPrices && !caps.fibLevels && (
                <>
                  <div style={sectionTitle}>LABELS</div>
                  <label style={checkLabel}>
                    <input type="checkbox" checked={d.showPrices !== false} onChange={(e) => patch({ showPrices: e.target.checked })} style={{ accentColor: '#6366F1' }} />
                    Show price labels
                  </label>
                </>
              )}

              {caps.volumeProfile && (
                <>
                  <div style={sectionTitle}>VOLUME PROFILE</div>
                  <div style={row}>
                    <span style={rowLabel}>Row Count</span>
                    <input
                      type="number"
                      min={4}
                      max={100}
                      step={1}
                      value={d.rows ?? 24}
                      onChange={(e) => patch({ rows: Math.max(4, Math.min(100, Number(e.target.value) || 24)) })}
                      style={numberInput}
                    />
                  </div>
                  <div style={row}>
                    <span style={rowLabel}>Value Area %</span>
                    <input
                      type="number"
                      min={10}
                      max={99}
                      step={1}
                      value={d.valueAreaPercent ?? 70}
                      onChange={(e) => patch({ valueAreaPercent: Math.max(10, Math.min(99, Number(e.target.value) || 70)) })}
                      style={numberInput}
                    />
                  </div>
                  <div style={row}>
                    <span style={rowLabel}>Width %</span>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      step={5}
                      value={d.profileWidthPercent ?? 40}
                      onChange={(e) => patch({ profileWidthPercent: Math.max(10, Math.min(100, Number(e.target.value) || 40)) })}
                      style={numberInput}
                    />
                  </div>
                  <div style={row}>
                    <span style={rowLabel}>Up Volume</span>
                    <ColorRow value={d.upColor || '#26A69A'} onChange={(c) => patch({ upColor: c })} />
                  </div>
                  <div style={row}>
                    <span style={rowLabel}>Down Volume</span>
                    <ColorRow value={d.downColor || '#EF5350'} onChange={(c) => patch({ downColor: c })} />
                  </div>

                  <div style={sectionTitle}>LEVELS & LINES</div>
                  <label style={checkLabel}>
                    <input
                      type="checkbox"
                      checked={d.showPoc !== false}
                      onChange={(e) => patch({ showPoc: e.target.checked })}
                      style={{ accentColor: '#6366F1' }}
                    />
                    Show Point of Control (POC)
                  </label>
                  {d.showPoc !== false && (
                    <div style={row}>
                      <span style={rowLabel}>POC Color</span>
                      <ColorRow value={d.pocColor || '#EA580C'} onChange={(c) => patch({ pocColor: c })} />
                    </div>
                  )}

                  <label style={checkLabel}>
                    <input
                      type="checkbox"
                      checked={d.showVahVal !== false}
                      onChange={(e) => patch({ showVahVal: e.target.checked })}
                      style={{ accentColor: '#6366F1' }}
                    />
                    Show Value Area (VAH / VAL)
                  </label>
                  {d.showVahVal !== false && (
                    <div style={row}>
                      <span style={rowLabel}>VA Color</span>
                      <ColorRow value={d.vahValColor || '#38BDF8'} onChange={(c) => patch({ vahValColor: c })} />
                    </div>
                  )}

                  <label style={checkLabel}>
                    <input
                      type="checkbox"
                      checked={d.showProfileSummary !== false}
                      onChange={(e) => patch({ showProfileSummary: e.target.checked })}
                      style={{ accentColor: '#6366F1' }}
                    />
                    Show Volume & Bars Summary
                  </label>
                </>
              )}

              <div style={sectionTitle}>OBJECT</div>
              <label style={checkLabel}>
                <input type="checkbox" checked={!!d.locked} onChange={(e) => patch({ locked: e.target.checked })} style={{ accentColor: '#F59E0B' }} />
                Lock (anchors cannot move)
              </label>
            </div>
          )}

          {activeTab === 'text' && (
            <div>
              <div style={sectionTitle}>TEXT</div>
              <input type="text" value={d.text || ''} onChange={(e) => patch({ text: e.target.value })}
                placeholder="Label text…" style={textInput} />
              {caps.fontSize && (
                <div style={{ ...row, marginTop: 8 }}>
                  <span style={rowLabel}>Font size</span>
                  <input type="range" min={9} max={24} step={1} value={d.fontSize || 12}
                    onChange={(e) => patch({ fontSize: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: '#6366F1' }} />
                  <span style={{ fontSize: '0.7rem', color: '#E2E8F0', minWidth: 36, textAlign: 'right' }}>{d.fontSize || 12}px</span>
                </div>
              )}
              <label style={{ ...checkLabel, marginTop: 8 }}>
                <input type="checkbox" checked={d.fontBold !== false} onChange={(e) => patch({ fontBold: e.target.checked })} style={{ accentColor: '#6366F1' }} />
                Bold
              </label>
            </div>
          )}

          {activeTab === 'coords' && (
            <div>
              <div style={sectionTitle}>COORDINATES</div>
              {coordRows.length === 0 && (
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Freehand drawing — no fixed anchors.</div>
              )}
              {coordRows.map((r) => (
                <div key={r.key} style={{ marginBottom: 10, padding: 8, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#93C5FD', marginBottom: 6 }}>{r.title}</div>
                  <div style={row}>
                    <span style={rowLabel}>Price</span>
                    <input type="number" step="any" value={r.price ?? ''} placeholder="—"
                      onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) r.onPrice(v); }}
                      style={numberInput} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: '0.66rem', color: '#64748B' }}>
                    <span>Bar: {r.logical != null ? Math.round(Number(r.logical)) : '—'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtTime(r.time)}</span>
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#475569', marginTop: 2 }}>Drag anchors on chart for exact placement</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'visibility' && (
            <div>
              <div style={sectionTitle}>VISIBILITY — TIMEFRAMES</div>
              <label style={checkLabel}>
                <input type="checkbox" checked={allVisible}
                  onChange={() => patch({ visibleIntervals: null })}
                  style={{ accentColor: '#6366F1' }} />
                Visible on all timeframes (TradingView default)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {VISIBILITY_INTERVALS.map((iv) => {
                  const on = allVisible || (vis || []).map((v) => String(v).toLowerCase()).includes(iv.toLowerCase());
                  return (
                    <button key={iv} onClick={() => {
                      let cur = allVisible ? [...VISIBILITY_INTERVALS] : [...(vis || [])];
                      const norm = (v) => String(v).toLowerCase();
                      if (cur.map(norm).includes(iv.toLowerCase())) cur = cur.filter((v) => norm(v) !== iv.toLowerCase());
                      else cur.push(iv);
                      if (cur.length >= VISIBILITY_INTERVALS.length) cur = null;
                      patch({ visibleIntervals: cur });
                    }}
                      style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: on ? '#2962FF' : 'rgba(255,255,255,0.06)', color: '#FFF', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                      {iv}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.62rem', color: '#475569', marginTop: 8 }}>
                Hidden on unchecked timeframes — same as TradingView Visibility tab.
              </div>
              <div style={sectionTitle}>OBJECT</div>
              <label style={checkLabel}>
                <input type="checkbox" checked={!!d.locked} onChange={(e) => patch({ locked: e.target.checked })} style={{ accentColor: '#F59E0B' }} />
                Lock drawing
              </label>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <button onClick={() => onPatch(drawingDefaults(drawing.type), { reset: true })}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 12px', color: '#94A3B8', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
            <RotateCcw size={13} /><span>Reset</span>
          </button>
          <button onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'linear-gradient(135deg, #4F46E5, #6366F1)', border: 'none', borderRadius: 6, padding: '6px 16px', color: '#FFF', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
            <Check size={14} /><span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
