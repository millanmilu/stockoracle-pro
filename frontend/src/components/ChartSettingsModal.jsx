import React, { useState, useEffect, useRef } from 'react';
import { X, Sliders, Palette, Eye, Layout, Check, RotateCcw, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DEFAULT_CHART_SETTINGS,
  loadChartSettings,
  saveChartSettings,
  resetChartSettings,
} from '../utils/chartSettings';
import { DRAWING_THEME_DEFAULTS, loadDrawingSettings, saveDrawingSettings } from './chart-tools/drawingSettingsSchema';

/**
 * TradingView-parity "Chart Settings" dialog.
 *
 * Every change is written straight into the shared chart-settings store
 * (utils/chartSettings.js), so the chart previews it live. Cancel / X restores
 * the snapshot taken when the dialog opened; OK keeps it. Nothing is applied
 * by reaching into the chart instance from here — ChartCanvas subscribes to
 * the store, which means settings also survive theme flips, chart-type swaps
 * and remounts.
 */

const TABS = [
  { id: 'symbol', label: 'Symbol / Candles', icon: Palette },
  { id: 'appearance', label: 'Appearance & Grid', icon: Layout },
  { id: 'scales', label: 'Scales & Precision', icon: Sliders },
  { id: 'status', label: 'Status Line', icon: Eye },
  { id: 'trading', label: 'Trading', icon: Zap },
];

const CHART_TYPE_OPTIONS = [
  ['candlestick', 'Candlesticks'],
  ['hollow', 'Hollow Candles'],
  ['bar', 'Bars'],
  ['line', 'Line'],
  ['area', 'Area / Mountain'],
  ['baseline', 'Baseline'],
];

const TIMEZONE_OPTIONS = [
  ['Asia/Kolkata', 'IST — Asia/Kolkata (India)'],
  ['UTC', 'UTC'],
  ['Asia/Dubai', 'GST — Asia/Dubai'],
  ['Asia/Singapore', 'SGT — Asia/Singapore'],
  ['Europe/London', 'GMT — Europe/London'],
  ['America/New_York', 'ET — America/New_York'],
  ['America/Chicago', 'CT — America/Chicago'],
  ['Asia/Tokyo', 'JST — Asia/Tokyo'],
  ['Australia/Sydney', 'AEDT — Australia/Sydney'],
];

const ROW_LABEL = { fontSize: '0.8rem', color: '#D1D4DC' };
const SECTION_TITLE = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#9CA3AF',
  letterSpacing: '0.04em',
  marginTop: 6,
};
const SELECT_STYLE = {
  backgroundColor: '#131722',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#FFF',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: '0.78rem',
  outline: 'none',
  maxWidth: 210,
};
const COLOR_INPUT = {
  width: 32,
  height: 26,
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  padding: 0,
};

function Row({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ ...ROW_LABEL, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {label}
        {hint ? <span style={{ fontSize: '0.68rem', color: '#787B86', fontWeight: 400 }}>{hint}</span> : null}
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: '0.8rem',
        color: '#D1D4DC',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: '#2962FF' }}
      />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {label}
        {hint ? <span style={{ fontSize: '0.68rem', color: '#787B86' }}>{hint}</span> : null}
      </span>
    </label>
  );
}

function ColorPair({ a, b, onA, onB }) {
  return (
    <>
      <input type="color" value={a} onChange={(e) => onA(e.target.value)} style={COLOR_INPUT} />
      <input type="color" value={b} onChange={(e) => onB(e.target.value)} style={COLOR_INPUT} />
    </>
  );
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />;
}

export default function ChartSettingsModal({ isOpen, onClose, onApplySettings }) {
  const [activeTab, setActiveTab] = useState('symbol');
  const [settings, setSettings] = useState(() => loadChartSettings());
  const [drawingTheme, setDrawingTheme] = useState(() => loadDrawingSettings().theme);
  const baselineRef = useRef(null);
  const drawingBaselineRef = useRef(null);

  // Snapshot on open so Cancel / X / backdrop click restores exactly what was
  // there before the live preview started mutating the shared store.
  useEffect(() => {
    if (!isOpen) return;
    const snapshot = loadChartSettings();
    baselineRef.current = snapshot;
    const drawingSnapshot = loadDrawingSettings().theme;
    drawingBaselineRef.current = drawingSnapshot;
    setDrawingTheme(drawingSnapshot);
    setSettings(snapshot);
    setActiveTab('symbol');
  }, [isOpen]);

  const push = (next) => {
    setSettings(next);
    saveChartSettings(next);
    if (onApplySettings) {
      try { onApplySettings(next); } catch {}
    }
  };

  const handleChange = (key, value) => {
    push({ ...settings, [key]: value });
  };

  const handleDrawingThemeChange = (key, value) => {
    const next = { ...drawingTheme, [key]: value };
    setDrawingTheme(next);
    saveDrawingSettings({ theme: next });
  };

  const handleClose = () => {
    if (baselineRef.current) push(baselineRef.current);
    if (drawingBaselineRef.current) {
      saveDrawingSettings({ theme: drawingBaselineRef.current });
      setDrawingTheme(drawingBaselineRef.current);
    }
    if (onClose) onClose();
  };

  const handleApply = () => {
    saveChartSettings(settings);
    if (onApplySettings) {
      try { onApplySettings(settings); } catch {}
    }
    toast.success('Chart settings applied');
    if (onClose) onClose();
  };

  const handleReset = () => {
    resetChartSettings();
    setSettings({ ...DEFAULT_CHART_SETTINGS });
    if (onApplySettings) {
      try { onApplySettings({ ...DEFAULT_CHART_SETTINGS }); } catch {}
    }
    toast.success('Settings reset to default');
  };

  if (!isOpen) return null;

  const isLineFamily = ['line', 'area', 'baseline'].includes(settings.chartType);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 550,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: '92%',
          maxWidth: 660,
          height: 'min(560px, 92vh)',
          backgroundColor: '#1E222D',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#E0E3EB',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={18} style={{ color: '#2962FF' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFF', margin: 0 }}>
              Chart Settings
            </h2>
          </div>

          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: '#787B86', cursor: 'pointer', padding: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#FFF')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#787B86')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Navigation Tabs */}
          <div
            style={{
              width: 178,
              backgroundColor: '#131722',
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: isSelected ? '#2962FF' : 'transparent',
                    color: isSelected ? '#FFFFFF' : '#868993',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Content Panel */}
          <div style={{ flex: 1, padding: '18px 24px', overflowY: 'auto' }}>
            {/* ── TAB 1: Symbol / Candles ─────────────────────────────── */}
            {activeTab === 'symbol' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={SECTION_TITLE}>CANDLESTICK COLORS</div>

                <Row label="Body (Up / Down)">
                  <ColorPair
                    a={settings.upColor}
                    b={settings.downColor}
                    onA={(v) => handleChange('upColor', v)}
                    onB={(v) => handleChange('downColor', v)}
                  />
                </Row>

                <Row label="Borders (Up / Down)">
                  <ColorPair
                    a={settings.borderUpColor}
                    b={settings.borderDownColor}
                    onA={(v) => handleChange('borderUpColor', v)}
                    onB={(v) => handleChange('borderDownColor', v)}
                  />
                </Row>

                <Row label="Wicks (Up / Down)">
                  <ColorPair
                    a={settings.wickUpColor}
                    b={settings.wickDownColor}
                    onA={(v) => handleChange('wickUpColor', v)}
                    onB={(v) => handleChange('wickDownColor', v)}
                  />
                </Row>

                <Divider />

                <div style={SECTION_TITLE}>STYLE</div>

                <Row label="Chart Style">
                  <select
                    value={settings.chartType}
                    onChange={(e) => handleChange('chartType', e.target.value)}
                    style={SELECT_STYLE}
                  >
                    {CHART_TYPE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Row>

                <Row label="Line Color" hint="Line / Area / Baseline stroke">
                  <input
                    type="color"
                    value={settings.lineColor}
                    onChange={(e) => handleChange('lineColor', e.target.value)}
                    style={COLOR_INPUT}
                  />
                </Row>

                <Divider />

                <div style={SECTION_TITLE}>VISIBILITY</div>

                <Row label="Colored borders" hint="Candle body borders">
                  <input
                    type="checkbox"
                    checked={!!settings.showBorders}
                    onChange={(e) => handleChange('showBorders', e.target.checked)}
                    style={{ accentColor: '#2962FF' }}
                  />
                </Row>

                <Row label="Colored wicks" hint="Candle wick lines">
                  <input
                    type="checkbox"
                    checked={!!settings.showWicks}
                    onChange={(e) => handleChange('showWicks', e.target.checked)}
                    style={{ accentColor: '#2962FF' }}
                  />
                </Row>

                <Row label="Last value mark" hint="Price tag on the price axis">
                  <input
                    type="checkbox"
                    checked={!!settings.showLastValue}
                    onChange={(e) => handleChange('showLastValue', e.target.checked)}
                    style={{ accentColor: '#2962FF' }}
                  />
                </Row>

                <Row label="Price line" hint="Line from the last bar to the axis">
                  <input
                    type="checkbox"
                    checked={!!settings.showPriceLine}
                    onChange={(e) => handleChange('showPriceLine', e.target.checked)}
                    style={{ accentColor: '#2962FF' }}
                  />
                </Row>

                {settings.showPriceLine && (
                  <>
                    <Row label="Price line color">
                      <input
                        type="color"
                        value={settings.priceLineColor}
                        onChange={(e) => handleChange('priceLineColor', e.target.value)}
                        style={COLOR_INPUT}
                      />
                    </Row>
                    <Row label="Price line style">
                      <select
                        value={settings.priceLineStyle}
                        onChange={(e) => handleChange('priceLineStyle', e.target.value)}
                        style={SELECT_STYLE}
                      >
                        <option value="solid">Solid</option>
                        <option value="dotted">Dotted</option>
                        <option value="dashed">Dashed</option>
                      </select>
                    </Row>
                  </>
                )}

                {isLineFamily && (
                  <div style={{ fontSize: '0.68rem', color: '#787B86' }}>
                    Tip: line-based styles use Line Color; Baseline uses Body (Up / Down).
                  </div>
                )}
                {settings.chartType === 'hollow' && (
                  <div style={{ fontSize: '0.68rem', color: '#787B86' }}>
                    Tip: Hollow candles draw their open body from Borders (Up / Down).
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: Appearance & Grid ────────────────────────────── */}
            {activeTab === 'appearance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={SECTION_TITLE}>BACKGROUND</div>

                <Row label="Background">
                  <select
                    value={settings.bgMode}
                    onChange={(e) => handleChange('bgMode', e.target.value)}
                    style={SELECT_STYLE}
                  >
                    <option value="theme">Follow app theme</option>
                    <option value="custom">Solid color</option>
                  </select>
                </Row>

                {settings.bgMode === 'custom' && (
                  <Row label="Background Color">
                    <input
                      type="color"
                      value={settings.bgColor}
                      onChange={(e) => handleChange('bgColor', e.target.value)}
                      style={COLOR_INPUT}
                    />
                  </Row>
                )}

                <Divider />

                <div style={SECTION_TITLE}>GRID</div>

                <Row label="Vertical Grid Lines">
                  <>
                    <input
                      type="checkbox"
                      checked={!!settings.showVertGrid}
                      onChange={(e) => handleChange('showVertGrid', e.target.checked)}
                      style={{ accentColor: '#2962FF' }}
                    />
                    <input
                      type="color"
                      value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(settings.vertGridColor || '') ? settings.vertGridColor : '#1E222D'}
                      onChange={(e) => handleChange('vertGridColor', e.target.value)}
                      style={{ ...COLOR_INPUT, opacity: settings.showVertGrid ? 1 : 0.4 }}
                    />
                  </>
                </Row>

                <Row label="Horizontal Grid Lines">
                  <>
                    <input
                      type="checkbox"
                      checked={!!settings.showHorzGrid}
                      onChange={(e) => handleChange('showHorzGrid', e.target.checked)}
                      style={{ accentColor: '#2962FF' }}
                    />
                    <input
                      type="color"
                      value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(settings.horzGridColor || '') ? settings.horzGridColor : '#1E222D'}
                      onChange={(e) => handleChange('horzGridColor', e.target.value)}
                      style={{ ...COLOR_INPUT, opacity: settings.showHorzGrid ? 1 : 0.4 }}
                    />
                  </>
                </Row>

                <div style={{ fontSize: '0.68rem', color: '#787B86' }}>
                  Grid color picker resets to the theme color when left untouched.
                </div>

                <Divider />

                <div style={SECTION_TITLE}>CROSSHAIR</div>

                <Row label="Crosshair Mode">
                  <select
                    value={settings.crosshairMode}
                    onChange={(e) => handleChange('crosshairMode', e.target.value)}
                    style={SELECT_STYLE}
                  >
                    <option value="normal">Normal (follows cursor)</option>
                    <option value="magnet">Magnet (snaps to OHLC)</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </Row>

                <Row label="Crosshair Color">
                  <input
                    type="color"
                    value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(settings.crosshairColor || '') ? settings.crosshairColor : '#787B86'}
                    onChange={(e) => handleChange('crosshairColor', e.target.value)}
                    style={COLOR_INPUT}
                  />
                </Row>

                <Row label="Crosshair Line Style">
                  <select
                    value={settings.crosshairStyle}
                    onChange={(e) => handleChange('crosshairStyle', e.target.value)}
                    style={SELECT_STYLE}
                  >
                    <option value="solid">Solid</option>
                    <option value="dotted">Dotted</option>
                    <option value="dashed">Dashed</option>
                  </select>
                </Row>

                <Row label="Crosshair Labels">
                  <input
                    type="checkbox"
                    checked={!!settings.showCrosshairLabels}
                    onChange={(e) => handleChange('showCrosshairLabels', e.target.checked)}
                    style={{ accentColor: '#2962FF' }}
                  />
                </Row>

                <Row label="Crosshair Label Background">
                  <input
                    type="color"
                    value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(settings.crosshairLabelBg || '') ? settings.crosshairLabelBg : '#363C4E'}
                    onChange={(e) => handleChange('crosshairLabelBg', e.target.value)}
                    style={COLOR_INPUT}
                  />
                </Row>

                <Divider />

                <div style={SECTION_TITLE}>TEXT & WATERMARK</div>

                <Row label="Axis Text Color" hint="Price & time axis labels">
                  <input
                    type="color"
                    value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(settings.axisTextColor || '') ? settings.axisTextColor : '#787B86'}
                    onChange={(e) => handleChange('axisTextColor', e.target.value)}
                    style={COLOR_INPUT}
                  />
                </Row>

                <Row label="Axis Font Size">
                  <select
                    value={String(settings.axisFontSize)}
                    onChange={(e) => handleChange('axisFontSize', Number(e.target.value))}
                    style={SELECT_STYLE}
                  >
                    {[9, 10, 11, 12, 13, 14, 16].map((n) => (
                      <option key={n} value={n}>{n}px</option>
                    ))}
                  </select>
                </Row>

                <Row label="Symbol Watermark" hint="Large faded symbol behind the candles">
                  <input
                    type="checkbox"
                    checked={!!settings.showWatermark}
                    onChange={(e) => handleChange('showWatermark', e.target.checked)}
                    style={{ accentColor: '#2962FF' }}
                  />
                </Row>

                <Divider />

                <div style={SECTION_TITLE}>DRAWINGS</div>
                <Row label="Default line color">
                  <input type="color" value={drawingTheme.lineColor}
                    onChange={(e) => handleDrawingThemeChange('lineColor', e.target.value)} style={COLOR_INPUT} />
                </Row>
                <Row label="Default fill color">
                  <input type="color" value={drawingTheme.fillColor}
                    onChange={(e) => handleDrawingThemeChange('fillColor', e.target.value)} style={COLOR_INPUT} />
                </Row>
                <Row label="Selection color">
                  <input type="color" value={drawingTheme.selectionColor}
                    onChange={(e) => handleDrawingThemeChange('selectionColor', e.target.value)} style={COLOR_INPUT} />
                </Row>
                <Row label="Hover color">
                  <input type="color" value={drawingTheme.hoverColor}
                    onChange={(e) => handleDrawingThemeChange('hoverColor', e.target.value)} style={COLOR_INPUT} />
                </Row>
                <Row label="Text color">
                  <input type="color" value={drawingTheme.textColor}
                    onChange={(e) => handleDrawingThemeChange('textColor', e.target.value)} style={COLOR_INPUT} />
                </Row>
                <Row label="Label background / text">
                  <>
                    <input type="color" value={drawingTheme.labelBackground}
                      onChange={(e) => handleDrawingThemeChange('labelBackground', e.target.value)} style={COLOR_INPUT} />
                    <input type="color" value={drawingTheme.labelText}
                      onChange={(e) => handleDrawingThemeChange('labelText', e.target.value)} style={COLOR_INPUT} />
                  </>
                </Row>
                <Row label="Default line width">
                  <select value={String(drawingTheme.defaultLineWidth)}
                    onChange={(e) => handleDrawingThemeChange('defaultLineWidth', Number(e.target.value))} style={SELECT_STYLE}>
                    {[1, 2, 3, 4, 5].map((width) => <option key={width} value={width}>{width}px</option>)}
                  </select>
                </Row>
                <Row label="Default line style">
                  <select value={drawingTheme.defaultLineStyle}
                    onChange={(e) => handleDrawingThemeChange('defaultLineStyle', e.target.value)} style={SELECT_STYLE}>
                    <option value="solid">Solid</option><option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option><option value="dash_dot">Dash-dot</option>
                    <option value="long_dash">Long dash</option>
                  </select>
                </Row>
                <Row label="Default fill opacity">
                  <input type="range" min={0} max={1} step={0.01} value={drawingTheme.defaultFillOpacity}
                    onChange={(e) => handleDrawingThemeChange('defaultFillOpacity', Number(e.target.value))} />
                  <span style={{ color: '#787B86', fontSize: 11, minWidth: 34 }}>{Math.round(drawingTheme.defaultFillOpacity * 100)}%</span>
                </Row>
                <Row label="Selection opacity">
                  <input type="range" min={0.2} max={1} step={0.01} value={drawingTheme.selectedOpacity}
                    onChange={(e) => handleDrawingThemeChange('selectedOpacity', Number(e.target.value))} />
                  <span style={{ color: '#787B86', fontSize: 11, minWidth: 34 }}>{Math.round(drawingTheme.selectedOpacity * 100)}%</span>
                </Row>
                <Row label="Locked drawing opacity">
                  <input type="range" min={0.2} max={1} step={0.01} value={drawingTheme.lockedOpacity}
                    onChange={(e) => handleDrawingThemeChange('lockedOpacity', Number(e.target.value))} />
                  <span style={{ color: '#787B86', fontSize: 11, minWidth: 34 }}>{Math.round(drawingTheme.lockedOpacity * 100)}%</span>
                </Row>
                <Row label="Control points">
                  <>
                    <select value={String(drawingTheme.controlPointSize)}
                      onChange={(e) => handleDrawingThemeChange('controlPointSize', Number(e.target.value))} style={SELECT_STYLE}>
                      {[3, 4, 5, 6, 7, 8].map((size) => <option key={size} value={size}>{size}px</option>)}
                    </select>
                    <input type="color" value={drawingTheme.controlPointColor}
                      onChange={(e) => handleDrawingThemeChange('controlPointColor', e.target.value)} style={COLOR_INPUT} />
                  </>
                </Row>
                <button type="button" onClick={() => {
                  setDrawingTheme({ ...DRAWING_THEME_DEFAULTS });
                  saveDrawingSettings({ theme: { ...DRAWING_THEME_DEFAULTS } });
                }} style={{ alignSelf: 'flex-start', background: 'transparent', color: '#787B86', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, padding: '6px 10px', cursor: 'pointer' }}>
                  Reset drawing appearance
                </button>
              </div>
            )}

            {/* ── TAB 3: Scales & Precision ───────────────────────────── */}
            {activeTab === 'scales' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={SECTION_TITLE}>PRICE SCALE</div>

                <Row label="Scale Axis Position">
                  <select
                    value={settings.priceScalePosition}
                    onChange={(e) => handleChange('priceScalePosition', e.target.value)}
                    style={SELECT_STYLE}
                  >
                    <option value="right">Right Side (Standard)</option>
                    <option value="left">Left Side</option>
                  </select>
                </Row>

                <Row label="Scale Mode">
                  <select
                    value={settings.priceScaleMode}
                    onChange={(e) => handleChange('priceScaleMode', e.target.value)}
                    style={SELECT_STYLE}
                  >
                    <option value="normal">Normal (auto-fit)</option>
                    <option value="log">Logarithmic</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </Row>

                <Row label="Invert Scale" hint="Flip the price axis upside down">
                  <input
                    type="checkbox"
                    checked={!!settings.invertScale}
                    onChange={(e) => handleChange('invertScale', e.target.checked)}
                    style={{ accentColor: '#2962FF' }}
                  />
                </Row>

                <Divider />

                <div style={SECTION_TITLE}>FORMAT</div>

                <Row label="Decimal Precision" hint="Auto adapts to price magnitude">
                  <select
                    value={String(settings.precision)}
                    onChange={(e) =>
                      handleChange('precision', e.target.value === 'auto' ? 'auto' : Number(e.target.value))
                    }
                    style={SELECT_STYLE}
                  >
                    <option value="auto">Auto</option>
                    {[0, 1, 2, 3, 4, 5, 6, 8].map((n) => (
                      <option key={n} value={n}>{n} Decimals ({'0'.padStart(n + 1, '.') || '0'})</option>
                    ))}
                  </select>
                </Row>

                <Row label="Timezone" hint="Axis + bar timestamps">
                  <select
                    value={settings.timezone}
                    onChange={(e) => handleChange('timezone', e.target.value)}
                    style={SELECT_STYLE}
                  >
                    {TIMEZONE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Row>

                <Divider />

                <div style={SECTION_TITLE}>BEHAVIOUR</div>

                <Toggle
                  label="Auto-fit prices on new data"
                  hint="Price axis re-scales to the visible range after a symbol/timeframe load"
                  checked={settings.autoFitPrices !== false}
                  onChange={(v) => handleChange('autoFitPrices', v)}
                />
              </div>
            )}

            {/* ── TAB 4: Status Line ──────────────────────────────────── */}
            {activeTab === 'status' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={SECTION_TITLE}>CHART STATUS LINE</div>

                <Toggle
                  label="Show title"
                  hint="Symbol, timeframe and bar time"
                  checked={settings.showLegendTitle}
                  onChange={(v) => handleChange('showLegendTitle', v)}
                />
                <Toggle
                  label="Show Open, High, Low, Close (OHLC) values"
                  checked={settings.showOHLC}
                  onChange={(v) => handleChange('showOHLC', v)}
                />
                <Toggle
                  label="Show bar change % and points"
                  checked={settings.showBarChange}
                  onChange={(v) => handleChange('showBarChange', v)}
                />
                <Toggle
                  label="Show volume"
                  checked={settings.showVolumeLegend}
                  onChange={(v) => handleChange('showVolumeLegend', v)}
                />
                <Divider />
                <Toggle
                  label="Show indicator values"
                  hint="Overlay indicator legends under the status line"
                  checked={settings.showIndicatorLegend}
                  onChange={(v) => handleChange('showIndicatorLegend', v)}
                />
                <Toggle
                  label="Show countdown to bar close"
                  hint="Live time remaining for the current candle"
                  checked={settings.showCountdown}
                  onChange={(v) => handleChange('showCountdown', v)}
                />
              </div>
            )}

            {/* ── TAB 5: Trading ──────────────────────────────────────── */}
            {activeTab === 'trading' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={SECTION_TITLE}>PAPER TRADING</div>

                <Toggle
                  label="Show trade button"
                  hint="On-chart buy/sell bar pinned to the chart"
                  checked={!!settings.showTradeButton}
                  onChange={(v) => handleChange('showTradeButton', v)}
                />
                <Toggle
                  label="Show trading panel"
                  hint="Bottom docket with open positions and account"
                  checked={!!settings.showTradeDocket}
                  onChange={(v) => handleChange('showTradeDocket', v)}
                />
                <Toggle
                  label="Show position lines on chart"
                  hint="Entry, stop-loss and target lines for the open position"
                  checked={!!settings.showPositionLines}
                  onChange={(v) => handleChange('showPositionLines', v)}
                />

                <Divider />

                <div style={{ fontSize: '0.68rem', color: '#787B86' }}>
                  These mirror the Trade Bar / Trading Panel toggles in the chart toolbar — the
                  last one written wins, so both stay in sync.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#131722',
          }}
        >
          <button
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              color: '#787B86',
              fontSize: '0.76rem',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#FFF')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#787B86')}
          >
            <RotateCcw size={13} />
            Reset to default
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleClose}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'transparent',
                color: '#D1D4DC',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: 'none',
                background: '#2962FF',
                color: '#FFF',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Check size={14} /> Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
