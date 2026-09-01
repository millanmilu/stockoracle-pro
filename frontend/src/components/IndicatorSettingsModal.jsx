import React from 'react';
import { X, RotateCcw, Sliders, Check } from 'lucide-react';

export default function IndicatorSettingsModal({
  isOpen,
  onClose,
  params,
  onUpdateParams,
  onResetDefaults,
}) {
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
          maxWidth: 480,
          backgroundColor: '#0F172A',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: 12,
          boxShadow: '0 20px 48px rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={16} style={{ color: '#818CF8' }} />
            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#F8FAFC' }}>
              Indicator Inputs & Parameters
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 420, overflowY: 'auto' }}>
          {/* SMA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00E5FF' }}>SMA Period</div>
              <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Simple moving average length</div>
            </div>
            <input
              type="number"
              min={1}
              max={500}
              value={params.smaPeriod}
              onChange={(e) => onUpdateParams({ smaPeriod: Math.max(1, parseInt(e.target.value) || 1) })}
              style={{
                width: 70,
                padding: '5px 8px',
                borderRadius: 6,
                backgroundColor: '#1E293B',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#FFF',
                fontSize: '0.82rem',
                fontFamily: 'JetBrains Mono, monospace',
                textAlign: 'center',
              }}
            />
          </div>

          {/* EMA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FF9100' }}>EMA Period</div>
              <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Exponential moving average length</div>
            </div>
            <input
              type="number"
              min={1}
              max={500}
              value={params.emaPeriod}
              onChange={(e) => onUpdateParams({ emaPeriod: Math.max(1, parseInt(e.target.value) || 1) })}
              style={{
                width: 70,
                padding: '5px 8px',
                borderRadius: 6,
                backgroundColor: '#1E293B',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#FFF',
                fontSize: '0.82rem',
                fontFamily: 'JetBrains Mono, monospace',
                textAlign: 'center',
              }}
            />
          </div>

          {/* Bollinger Bands */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#E040FB' }}>Bollinger Bands</div>
              <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Period & StdDev Multiplier</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                min={1}
                max={200}
                value={params.bbPeriod}
                onChange={(e) => onUpdateParams({ bbPeriod: Math.max(1, parseInt(e.target.value) || 1) })}
                title="BB Period"
                style={{
                  width: 55,
                  padding: '5px 6px',
                  borderRadius: 6,
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#FFF',
                  fontSize: '0.82rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  textAlign: 'center',
                }}
              />
              <input
                type="number"
                step={0.5}
                min={0.5}
                max={10}
                value={params.bbStdDev}
                onChange={(e) => onUpdateParams({ bbStdDev: Math.max(0.1, parseFloat(e.target.value) || 1) })}
                title="StdDev Multiplier"
                style={{
                  width: 50,
                  padding: '5px 6px',
                  borderRadius: 6,
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#FFF',
                  fontSize: '0.82rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  textAlign: 'center',
                }}
              />
            </div>
          </div>

          {/* RSI */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#F43F5E' }}>RSI Period</div>
              <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Relative Strength Index length</div>
            </div>
            <input
              type="number"
              min={2}
              max={100}
              value={params.rsiPeriod}
              onChange={(e) => onUpdateParams({ rsiPeriod: Math.max(2, parseInt(e.target.value) || 2) })}
              style={{
                width: 70,
                padding: '5px 8px',
                borderRadius: 6,
                backgroundColor: '#1E293B',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#FFF',
                fontSize: '0.82rem',
                fontFamily: 'JetBrains Mono, monospace',
                textAlign: 'center',
              }}
            />
          </div>

          {/* MACD */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38BDF8' }}>MACD Parameters</div>
              <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Fast, Slow & Signal EMA spans</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                min={1}
                max={100}
                value={params.macdFast}
                onChange={(e) => onUpdateParams({ macdFast: Math.max(1, parseInt(e.target.value) || 1) })}
                title="Fast EMA"
                style={{
                  width: 48,
                  padding: '5px 4px',
                  borderRadius: 6,
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#FFF',
                  fontSize: '0.82rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  textAlign: 'center',
                }}
              />
              <input
                type="number"
                min={1}
                max={200}
                value={params.macdSlow}
                onChange={(e) => onUpdateParams({ macdSlow: Math.max(1, parseInt(e.target.value) || 1) })}
                title="Slow EMA"
                style={{
                  width: 48,
                  padding: '5px 4px',
                  borderRadius: 6,
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#FFF',
                  fontSize: '0.82rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  textAlign: 'center',
                }}
              />
              <input
                type="number"
                min={1}
                max={50}
                value={params.macdSignal}
                onChange={(e) => onUpdateParams({ macdSignal: Math.max(1, parseInt(e.target.value) || 1) })}
                title="Signal EMA"
                style={{
                  width: 48,
                  padding: '5px 4px',
                  borderRadius: 6,
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#FFF',
                  fontSize: '0.82rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  textAlign: 'center',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <button
            onClick={onResetDefaults}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '6px 12px',
              color: '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
              border: 'none',
              borderRadius: 6,
              padding: '6px 16px',
              color: '#FFF',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Check size={14} />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
