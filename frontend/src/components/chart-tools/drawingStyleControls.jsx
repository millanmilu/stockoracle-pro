import React from 'react';
import { getLineDashArray, LINE_STYLE_META, LINE_WIDTHS } from './drawingSettingsSchema';
import DrawingColorPicker from './DrawingColorPicker';

// --- Shared drawing style controls (DrawingStyleSelector service) ---
//
// ONE implementation of width / line-style / opacity / fill controls,
// consumed by BOTH the floating selection toolbar and the settings modal.
// Every drawing tool goes through these, so styling can never diverge
// between the quick toolbar and the full dialog.

const ACCENT = 'var(--drawing-toolbar-active, var(--drawing-accent, #2962FF))';
const CONTROL_BG = 'var(--drawing-control-bg, #131722)';
const TEXT = 'var(--drawing-toolbar-text, var(--drawing-settings-text, #D1D4DC))';

export function WidthButtons({ value, onChange }) {
  const current = Number(value) || 2;
  return (
    <div style={{ display: 'flex', gap: 3 }} role="group" aria-label="Line width">
      {LINE_WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(w)}
          title={`Width ${w}px`}
          aria-pressed={current === w}
          style={{
            padding: '3px 7px', borderRadius: 4, border: 'none',
            background: current === w ? ACCENT : CONTROL_BG,
            color: current === w ? '#FFF' : TEXT,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', lineHeight: 1.5,
          }}
        >
          {w}
        </button>
      ))}
    </div>
  );
}

function StylePreview({ style, width, color }) {
  const dash = getLineDashArray(style, Math.max(2, width));
  return (
    <svg width="34" height="10" viewBox="0 0 34 10" aria-hidden="true">
      <line
        x1="1" y1="5" x2="33" y2="5"
        stroke={color}
        strokeWidth={Math.min(3, Math.max(1.5, width))}
        strokeDasharray={dash || undefined}
        strokeLinecap={style === 'dotted' ? 'round' : 'butt'}
      />
    </svg>
  );
}

export function StyleButtons({ value, width = 2, onChange }) {
  const current = value || 'solid';
  return (
    <div style={{ display: 'flex', gap: 3 }} role="group" aria-label="Line style">
      {LINE_STYLE_META.map((st) => {
        const active = current === st.id;
        return (
          <button
            key={st.id}
            type="button"
            onClick={() => onChange(st.id)}
            title={st.label}
            aria-pressed={active}
            style={{
              padding: '3px 5px', borderRadius: 4,
              border: active ? '1px solid var(--drawing-toolbar-text, #D1D4DC)' : '1px solid transparent',
              background: active ? ACCENT : CONTROL_BG,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}
          >
            <StylePreview style={st.id} width={width} color={active ? '#FFF' : '#9AA0B0'} />
          </button>
        );
      })}
    </div>
  );
}

export function OpacitySlider({ value, onChange, label = 'Opacity' }) {
  const v = value ?? 1;
  return (
    <label
      title={label}
      style={{ display: 'flex', alignItems: 'center', gap: 6, color: TEXT, fontSize: 11, whiteSpace: 'nowrap' }}
    >
      <span style={{ color: 'var(--drawing-toolbar-muted, #787B86)' }}>{label}</span>
      <input
        type="range" min={0} max={1} step={0.01} value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 64, accentColor: '#2962FF' }}
        aria-label={label}
      />
      <span style={{ minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(v * 100)}%
      </span>
    </label>
  );
}

export function ExtendToggles({ extendLeft, extendRight, onChange }) {
  const btn = (active) => ({
    padding: '3px 8px', border: 0, borderRadius: 4, cursor: 'pointer', fontSize: 12,
    background: active ? ACCENT : CONTROL_BG, color: active ? '#FFF' : TEXT,
  });
  return (
    <div style={{ display: 'flex', gap: 3 }} role="group" aria-label="Extend line">
      <button type="button" title={extendLeft ? 'Disable extend left' : 'Extend left'}
        onClick={() => onChange({ extendLeft: !extendLeft })} aria-pressed={!!extendLeft} style={btn(!!extendLeft)}>
        ←
      </button>
      <button type="button" title={extendRight ? 'Disable extend right' : 'Extend right'}
        onClick={() => onChange({ extendRight: !extendRight })} aria-pressed={!!extendRight} style={btn(!!extendRight)}>
        →
      </button>
    </div>
  );
}

export function FillToggle({ enabled, onChange }) {
  return (
    <button
      type="button" title={enabled ? 'Disable fill' : 'Enable fill'} onClick={() => onChange(!enabled)}
      aria-pressed={!!enabled}
      style={{
        padding: '3px 8px', border: 0, borderRadius: 4, cursor: 'pointer',
        fontSize: 10, fontWeight: 700,
        background: enabled ? ACCENT : CONTROL_BG, color: enabled ? '#FFF' : TEXT,
      }}
    >
      Fill {enabled ? 'On' : 'Off'}
    </button>
  );
}

export { DrawingColorPicker };

// ---------------------------------------------------------------------------
// Compact dropdown primitives (toolbar-first redesign).
//
// Single-row toolbar buttons + anchored mini-panels. The settings popover
// reuses SectionTitle / SettingRow / ToggleSwitch so both surfaces stay
// visually consistent.
// ---------------------------------------------------------------------------

const MINI_TEXT = 'var(--drawing-toolbar-text, var(--drawing-settings-text, #D1D4DC))';
const MINI_MUTED = 'var(--drawing-toolbar-muted, #787B86)';

/** Small trigger button used inside the 40px toolbar row. */
export function ToolButton({ title, onClick, active = false, danger = false, children, wide = false }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      style={{
        height: 28, minWidth: wide ? 40 : 28, padding: wide ? '0 8px' : 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
        background: active ? 'rgba(41,98,255,0.16)' : 'transparent',
        border: 'none', borderRadius: 6, cursor: 'pointer',
        color: danger ? '#EF5350' : active ? '#7AA2FF' : MINI_MUTED,
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

/** Anchored mini-panel shell (width / style / fill / overflow menus). */
export function MiniPanel({ width = 200, children, alignRight = false }) {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', top: 'calc(100% + 8px)', ...(alignRight ? { right: 0 } : { left: 0 }),
        width, padding: 10, borderRadius: 10, zIndex: 70,
        color: MINI_TEXT,
        background: 'var(--drawing-settings-bg, #1E222D)',
        border: '1px solid var(--drawing-settings-border, #2A2E39)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
      }}
    >
      {children}
    </div>
  );
}

/** Compact segmented width control: [1][2][3][4][5] + optional custom input. */
export function WidthSegmented({ value, onChange, custom = false }) {
  const current = Number(value) || 2;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div
        role="group" aria-label="Line width"
        style={{ display: 'flex', gap: 2, background: CONTROL_BG, borderRadius: 7, padding: 2 }}
      >
        {LINE_WIDTHS.map((w) => (
          <button
            key={w} type="button" onClick={() => onChange(w)}
            title={`${w}px`} aria-pressed={current === w}
            style={{
              minWidth: 26, height: 24, border: 'none', borderRadius: 5, cursor: 'pointer',
              background: current === w ? ACCENT : 'transparent',
              color: current === w ? '#FFF' : TEXT, fontSize: 12, fontWeight: 700,
            }}
          >
            {w}
          </button>
        ))}
      </div>
      {custom && (
        <input
          type="number" min={1} max={24} step={1} value={current} title="Custom width (1–24px)"
          onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 1 && v <= 24) onChange(v); }}
          style={{
            width: 46, background: CONTROL_BG, border: '1px solid var(--drawing-control-border, #2A2E39)',
            borderRadius: 5, padding: '4px 6px', color: TEXT, fontSize: 12, textAlign: 'right', outline: 'none',
          }}
        />
      )}
    </div>
  );
}

/** One visual style row (preview + label) for the style dropdown. */
export function StyleRow({ style, width, active, onPick }) {
  return (
    <button
      type="button" onClick={onPick} title={LINE_STYLE_META.find((s) => s.id === style)?.label || style}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '6px 8px', border: 'none', borderRadius: 6, cursor: 'pointer',
        background: active ? 'rgba(41,98,255,0.16)' : 'transparent',
        color: active ? '#FFF' : MINI_MUTED,
      }}
    >
      <StylePreview style={style} width={width} color={active ? '#7AA2FF' : '#9AA0B0'} />
      <span style={{ fontSize: 12, fontWeight: active ? 700 : 400 }}>
        {LINE_STYLE_META.find((s) => s.id === style)?.label || style}
      </span>
    </button>
  );
}

/** Section heading inside the settings popover. */
export function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
      color: MINI_MUTED, margin: '14px 0 8px',
    }}>
      {children}
    </div>
  );
}

/** Label-left / control-right row inside the settings popover. */
export function SettingRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '5px 0' }}>
      <span style={{ fontSize: 12, color: MINI_TEXT }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{children}</div>
    </div>
  );
}

/** Minimal on/off switch (stops propagation so wrapping rows can own the click). */
export function ToggleSwitch({ checked, onChange, title = 'Toggle' }) {
  return (
    <button
      type="button" role="switch" aria-checked={!!checked} title={title} aria-label={title}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      style={{
        width: 32, height: 18, borderRadius: 10, border: 'none', cursor: 'pointer', padding: 2,
        background: checked ? '#2962FF' : 'rgba(127,127,127,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: checked ? 'flex-end' : 'flex-start',
      }}
    >
      <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#FFF' }} />
    </button>
  );
}

/** One row inside the overflow (⋮) menu. */
export function OverflowItem({ icon, label, hint, onClick, active = false, danger = false, control = null }) {
  return (
    <div
      onClick={control ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 6,
        cursor: control ? 'default' : 'pointer', fontSize: 12,
        color: danger ? '#EF5350' : active ? '#FFF' : MINI_TEXT,
        background: active && !control ? 'rgba(41,98,255,0.16)' : 'transparent',
      }}
    >
      <span style={{ display: 'flex', color: danger ? '#EF5350' : MINI_MUTED, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {hint && <span style={{ fontSize: 11, color: MINI_MUTED }}>{hint}</span>}
      {control}
    </div>
  );
}
