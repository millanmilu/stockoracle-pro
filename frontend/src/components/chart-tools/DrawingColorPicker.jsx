import React, { useEffect, useMemo, useState } from 'react';
import { COLOR_PRESETS, loadDrawingSettings, rememberDrawingColor } from './drawingSettingsSchema';

function colorChannels(value) {
  const hex = /^#[0-9a-f]{6}$/i.test(value || '') ? value.slice(1) : '2962FF';
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }
  return { rgb: rgb.join(', '), hsl: `${hue}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%` };
}

function hexFromRgb(value) {
  const parts = value.split(',').map((item) => Number(item.trim()));
  if (parts.length !== 3 || parts.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return null;
  return `#${parts.map((item) => item.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function hexFromHsl(value) {
  const parts = value.replace(/%/g, '').split(',').map((item) => Number(item.trim()));
  if (parts.length !== 3 || parts.some((item) => !Number.isFinite(item)) || parts[1] < 0 || parts[1] > 100 || parts[2] < 0 || parts[2] > 100) return null;
  const [h, sPct, lPct] = parts;
  const s = sPct / 100;
  const l = lPct / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((item) => Math.round((item + m) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export default function DrawingColorPicker({ value, onChange, compact = false, alpha, onAlphaChange, dot = false, open: controlledOpen, onOpenChange, title = 'Color', alignRight = false }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [hexDraft, setHexDraft] = useState(value || '#2962FF');
  const [settings, setSettings] = useState(() => loadDrawingSettings());
  const [colorMode, setColorMode] = useState('HEX');
  useEffect(() => setHexDraft(value || '#2962FF'), [value]);
  const channels = useMemo(() => colorChannels(value), [value]);
  const choose = (color) => {
    onChange(color);
    setSettings(rememberDrawingColor(color));
  };
  const swatches = [...new Set([...settings.savedColors, ...settings.recentColors, ...COLOR_PRESETS])].slice(0, 16);

  // Single-dot trigger: compact `[ ● ]` that opens the full picker on demand.
  // The popup below is shared with the classic inline-swatches trigger.
  if (dot) {
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          title={title}
          aria-label={title}
          onClick={() => setOpen(!open)}
          style={{
            width: 20, height: 20, padding: 0, borderRadius: '50%',
            background: value || '#2962FF', cursor: 'pointer',
            border: open ? '2px solid var(--drawing-toolbar-text, #D1D4DC)' : '1px solid rgba(127,127,127,0.5)',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35)',
          }}
        />
        {open && (
          <PickerPopup
            value={value} alpha={alpha} onAlphaChange={onAlphaChange} choose={choose}
            hexDraft={hexDraft} setHexDraft={setHexDraft} colorMode={colorMode} setColorMode={setColorMode}
            channels={channels} swatches={swatches} remember={(color, opts) => setSettings(rememberDrawingColor(color, opts))}
            alignRight={alignRight}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      {COLOR_PRESETS.slice(0, compact ? 5 : COLOR_PRESETS.length).map((color) => (
        <button
          key={color}
          type="button"
          title={color}
          aria-label={`Choose ${color}`}
          onClick={() => choose(color)}
          style={{
            width: compact ? 16 : 18, height: compact ? 16 : 18, padding: 0,
            borderRadius: '50%', background: color, cursor: 'pointer',
            border: value?.toUpperCase() === color ? '2px solid var(--drawing-toolbar-text, #D1D4DC)' : '1px solid rgba(127,127,127,0.4)',
          }}
        />
      ))}
      <button
        type="button"
        title="Custom color (HEX, RGB, HSL)"
        onClick={() => setOpen((previous) => !previous)}
        style={{
          width: compact ? 18 : 26, height: compact ? 18 : 22, padding: 0, borderRadius: 4,
          border: '1px solid var(--drawing-control-border, #363C4E)', background: value || '#2962FF',
          cursor: 'pointer',
        }}
      />
      {open && (
        <PickerPopup
          value={value} alpha={alpha} onAlphaChange={onAlphaChange} choose={choose}
          hexDraft={hexDraft} setHexDraft={setHexDraft} colorMode={colorMode} setColorMode={setColorMode}
          channels={channels} swatches={swatches} remember={(color, opts) => setSettings(rememberDrawingColor(color, opts))}
        />
      )}
    </div>
  );
}

function PickerPopup({
  value, alpha, onAlphaChange, choose,
  hexDraft, setHexDraft, colorMode, setColorMode,
  channels, swatches, remember, alignRight = false,
}) {
  return (
        <div
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)',
            ...(alignRight ? { right: 0 } : { left: 0 }), zIndex: 500,
            width: 232, padding: 12, borderRadius: 10,
            color: 'var(--drawing-settings-text, #D1D4DC)',
            background: 'var(--drawing-settings-bg, #1E222D)',
            border: '1px solid var(--drawing-settings-border, #2A2E39)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--drawing-toolbar-muted, #787B86)', marginBottom: 6 }}>Recent</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(swatches.slice(0, 5)).map((color) => (
              <button key={color} type="button" title={color} onClick={() => choose(color)}
                style={{ width: 20, height: 20, padding: 0, borderRadius: '50%', background: color, border: '1px solid rgba(127,127,127,0.45)', cursor: 'pointer' }} />
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--drawing-toolbar-muted, #787B86)', marginBottom: 6 }}>Preset</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {swatches.slice(5).map((color) => (
              <button key={color} type="button" title={color} onClick={() => choose(color)}
                style={{ width: 20, height: 20, padding: 0, borderRadius: '50%', background: color, border: '1px solid rgba(127,127,127,0.45)', cursor: 'pointer' }} />
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <select value={colorMode} onChange={(event) => setColorMode(event.target.value)}
              style={{ background: 'var(--drawing-control-bg, #131722)', color: 'inherit', border: '1px solid var(--drawing-control-border, #363C4E)', borderRadius: 4 }}>
              <option>HEX</option><option>RGB</option><option>HSL</option>
            </select>
            <input value={colorMode === 'HEX' ? hexDraft : colorMode === 'RGB' ? channels.rgb : channels.hsl}
              onChange={(event) => {
                const next = event.target.value;
                if (colorMode === 'HEX') {
                  setHexDraft(next);
                  if (/^#[0-9a-f]{6}$/i.test(next)) choose(next);
                } else {
                  const color = colorMode === 'RGB' ? hexFromRgb(next) : hexFromHsl(next);
                  if (color) choose(color);
                }
              }}
              style={{ flex: 1, minWidth: 0, background: 'var(--drawing-control-bg, #131722)', color: 'inherit', border: '1px solid var(--drawing-control-border, #363C4E)', borderRadius: 4, padding: '5px 7px' }} />
          </label>
          {onAlphaChange && (
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, fontSize: 12 }}>
              Opacity
              <input type="range" min={0} max={1} step={0.01} value={alpha ?? 1} onChange={(event) => onAlphaChange(Number(event.target.value))} style={{ flex: 1, accentColor: '#2962FF' }} />
              <span style={{ minWidth: 34, textAlign: 'right' }}>{Math.round((alpha ?? 1) * 100)}%</span>
            </label>
          )}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, fontSize: 12 }}>
            Custom
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#2962FF'}
              onChange={(event) => choose(event.target.value)} />
          </label>
          <button type="button" onClick={() => remember(value, { save: true })}
            style={{ marginTop: 10, padding: '5px 8px', color: 'inherit', background: 'transparent', border: '1px solid var(--drawing-control-border, #363C4E)', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
            Save current color
          </button>
        </div>
  );
}
