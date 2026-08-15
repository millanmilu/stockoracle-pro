import React, { useState, useEffect } from 'react';
import { X, Sliders, Palette, Eye, Layout, Check, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

const SETTINGS_STORAGE_KEY = 'stockoracle_chart_settings_tv_v1';

const DEFAULT_SETTINGS = {
  // Candle Colors
  upColor: '#089981',
  downColor: '#F23645',
  borderUpColor: '#089981',
  borderDownColor: '#F23645',
  wickUpColor: '#089981',
  wickDownColor: '#F23645',
  chartType: 'candlestick', // 'candlestick' | 'line' | 'area'

  // Background & Grid
  bgColor: '#131722',
  showVertGrid: true,
  vertGridColor: 'rgba(255, 255, 255, 0.05)',
  showHorzGrid: true,
  horzGridColor: 'rgba(255, 255, 255, 0.05)',
  crosshairColor: '#787B86',

  // Scales & Format
  priceScalePosition: 'right', // 'right' | 'left'
  precision: 2,
  showOHLC: true,
  showBarChange: true,
  showWatermark: false,
};

const TABS = [
  { id: 'symbol', label: 'Symbol / Candles', icon: Palette },
  { id: 'appearance', label: 'Appearance & Grid', icon: Layout },
  { id: 'scales', label: 'Scales & Precision', icon: Sliders },
  { id: 'status', label: 'Status Line', icon: Eye },
];

export default function ChartSettingsModal({
  isOpen,
  onClose,
  chartRef,
  candleSeriesRef,
  onApplySettings,
}) {
  const [activeTab, setActiveTab] = useState('symbol');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Load saved settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch (_) {}
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

      // Apply to Lightweight Charts instance
      if (chartRef?.current) {
        chartRef.current.applyOptions({
          layout: {
            background: { color: settings.bgColor },
          },
          grid: {
            vertLines: {
              visible: settings.showVertGrid,
              color: settings.vertGridColor,
            },
            horzLines: {
              visible: settings.showHorzGrid,
              color: settings.horzGridColor,
            },
          },
          crosshair: {
            vertLine: { color: settings.crosshairColor },
            horzLine: { color: settings.crosshairColor },
          },
          rightPriceScale: {
            visible: settings.priceScalePosition === 'right',
          },
          leftPriceScale: {
            visible: settings.priceScalePosition === 'left',
          },
        });
      }

      // Apply candle colors
      if (candleSeriesRef?.current) {
        candleSeriesRef.current.applyOptions({
          upColor: settings.upColor,
          downColor: settings.downColor,
          borderUpColor: settings.borderUpColor,
          borderDownColor: settings.borderDownColor,
          wickUpColor: settings.wickUpColor,
          wickDownColor: settings.wickDownColor,
        });
      }

      if (onApplySettings) {
        onApplySettings(settings);
      }

      toast.success('Chart settings applied');
      onClose();
    } catch (e) {
      toast.error('Failed to apply settings');
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch (_) {}
    toast.success('Settings reset to default');
  };

  if (!isOpen) return null;

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
      onClick={onClose}
    >
      <div
        style={{
          width: '90%',
          maxWidth: 620,
          height: 480,
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
            onClick={onClose}
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
              width: 170,
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
            {/* TAB 1: Symbol / Candles */}
            {activeTab === 'symbol' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.04em' }}>
                  CANDLESTICK COLORS
                </div>

                {/* Body Up / Down */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: '#D1D4DC' }}>Body (Up / Down)</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="color"
                      value={settings.upColor}
                      onChange={(e) => handleChange('upColor', e.target.value)}
                      style={{ width: 28, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent' }}
                    />
                    <input
                      type="color"
                      value={settings.downColor}
                      onChange={(e) => handleChange('downColor', e.target.value)}
                      style={{ width: 28, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent' }}
                    />
                  </div>
                </div>

                {/* Borders Up / Down */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: '#D1D4DC' }}>Borders (Up / Down)</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="color"
                      value={settings.borderUpColor}
                      onChange={(e) => handleChange('borderUpColor', e.target.value)}
                      style={{ width: 28, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent' }}
                    />
                    <input
                      type="color"
                      value={settings.borderDownColor}
                      onChange={(e) => handleChange('borderDownColor', e.target.value)}
                      style={{ width: 28, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent' }}
                    />
                  </div>
                </div>

                {/* Wicks Up / Down */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: '#D1D4DC' }}>Wicks (Up / Down)</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="color"
                      value={settings.wickUpColor}
                      onChange={(e) => handleChange('wickUpColor', e.target.value)}
                      style={{ width: 28, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent' }}
                    />
                    <input
                      type="color"
                      value={settings.wickDownColor}
                      onChange={(e) => handleChange('wickDownColor', e.target.value)}
                      style={{ width: 28, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent' }}
                    />
                  </div>
                </div>

                <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />

                {/* Chart Style */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: '#D1D4DC' }}>Chart Style</span>
                  <select
                    value={settings.chartType}
                    onChange={(e) => handleChange('chartType', e.target.value)}
                    style={{
                      backgroundColor: '#131722',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#FFF',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: '0.78rem',
                      outline: 'none',
                    }}
                  >
                    <option value="candlestick">Candlesticks</option>
                    <option value="line">Line Chart</option>
                    <option value="area">Area / Mountain</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 2: Appearance & Grid */}
            {activeTab === 'appearance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.04em' }}>
                  BACKGROUND & GRIDS
                </div>

                {/* Background Color */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: '#D1D4DC' }}>Background Solid Color</span>
                  <input
                    type="color"
                    value={settings.bgColor}
                    onChange={(e) => handleChange('bgColor', e.target.value)}
                    style={{ width: 32, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent' }}
                  />
                </div>

                {/* Vertical Grid Lines */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#D1D4DC', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.showVertGrid}
                      onChange={(e) => handleChange('showVertGrid', e.target.checked)}
                    />
                    Vertical Grid Lines
                  </label>
                </div>

                {/* Horizontal Grid Lines */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#D1D4DC', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.showHorzGrid}
                      onChange={(e) => handleChange('showHorzGrid', e.target.checked)}
                    />
                    Horizontal Grid Lines
                  </label>
                </div>

                {/* Crosshair Color */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: '#D1D4DC' }}>Crosshair Color</span>
                  <input
                    type="color"
                    value={settings.crosshairColor}
                    onChange={(e) => handleChange('crosshairColor', e.target.value)}
                    style={{ width: 32, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent' }}
                  />
                </div>
              </div>
            )}

            {/* TAB 3: Scales & Precision */}
            {activeTab === 'scales' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.04em' }}>
                  PRICE SCALE PLACEMENT
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: '#D1D4DC' }}>Scale Axis Position</span>
                  <select
                    value={settings.priceScalePosition}
                    onChange={(e) => handleChange('priceScalePosition', e.target.value)}
                    style={{
                      backgroundColor: '#131722',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#FFF',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: '0.78rem',
                      outline: 'none',
                    }}
                  >
                    <option value="right">Right Side (Standard)</option>
                    <option value="left">Left Side</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: '#D1D4DC' }}>Decimal Precision</span>
                  <select
                    value={settings.precision}
                    onChange={(e) => handleChange('precision', Number(e.target.value))}
                    style={{
                      backgroundColor: '#131722',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#FFF',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: '0.78rem',
                      outline: 'none',
                    }}
                  >
                    <option value={2}>2 Decimals (0.00)</option>
                    <option value={3}>3 Decimals (0.000)</option>
                    <option value={4}>4 Decimals (0.0000)</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 4: Status Line */}
            {activeTab === 'status' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.04em' }}>
                  CHART STATUS LINE
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#D1D4DC', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.showOHLC}
                    onChange={(e) => handleChange('showOHLC', e.target.checked)}
                  />
                  Show Open, High, Low, Close (OHLC) values
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#D1D4DC', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.showBarChange}
                    onChange={(e) => handleChange('showBarChange', e.target.checked)}
                  />
                  Show Bar Change % and Points
                </label>
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
              onClick={onClose}
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
