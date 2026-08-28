import React from 'react';
import { X, Command, Keyboard, Zap, Layers, BarChart2, Bell, Sparkles } from 'lucide-react';

const SHORTCUT_GROUPS = [
  {
    category: 'Navigation & Workstation',
    icon: Command,
    color: '#818CF8',
    shortcuts: [
      { key: 'Ctrl + K  or  /', desc: 'Open Universal Command Palette / Stock Search' },
      { key: '?', desc: 'Open this Keyboard Shortcuts Keymap' },
      { key: 'Esc', desc: 'Close any active modal or dropdown' },
      { key: 'F', desc: 'Toggle Fullscreen Chart View' },
    ],
  },
  {
    category: 'Chart Timeframes',
    icon: BarChart2,
    color: '#10B981',
    shortcuts: [
      { key: '1', desc: 'Switch to 1-Minute (1m) Intraday Interval' },
      { key: '2', desc: 'Switch to 5-Minute (5m) Intraday Interval' },
      { key: '3', desc: 'Switch to 15-Minute (15m) Intraday Interval' },
      { key: '4', desc: 'Switch to 1-Hour (1H) Interval' },
      { key: 'D', desc: 'Switch to Daily (1D) NSE Market Candles' },
    ],
  },
  {
    category: 'Institutional Tools & Overlays',
    icon: Sparkles,
    color: '#A855F7',
    shortcuts: [
      { key: 'Alt + S', desc: 'Toggle Smart Money Concepts (FVG, Order Blocks, BOS)' },
      { key: 'Alt + O', desc: 'Toggle Options OI Resistance & Support Walls' },
      { key: 'Alt + V', desc: 'Toggle Volume Profile (VPVR) & Point of Control (POC)' },
      { key: 'Alt + R', desc: 'Toggle Historical Bar Replay Simulator' },
      { key: 'Alt + A', desc: 'Open Interactive Price Alert Manager' },
      { key: 'Alt + L', desc: 'Toggle Logarithmic vs Linear Price Scale' },
      { key: 'Alt + K', desc: 'Switch between Standard Candles and Heikin-Ashi' },
    ],
  },
  {
    category: 'Drawing & Technical Analysis',
    icon: Layers,
    color: '#F59E0B',
    shortcuts: [
      { key: 'Alt + T', desc: 'Draw Trendline' },
      { key: 'Alt + H', desc: 'Draw Horizontal Support/Resistance Line' },
      { key: 'Alt + F', desc: 'Draw Fibonacci Retracement Grid' },
      { key: 'Delete / Backspace', desc: 'Delete selected drawing on chart' },
    ],
  },
];

export default function KeymapModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#0A0F1D',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: 14,
          width: '92vw',
          maxWidth: 680,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
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
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(99, 102, 241, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818CF8',
              }}
            >
              <Keyboard size={18} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#FFF' }}>
                StockOracle Pro — Keyboard Hotkeys Keymap
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                TradingView & Bloomberg Terminal grade hotkeys
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SHORTCUT_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.category} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: group.color }}>
                  <Icon size={14} />
                  <span>{group.category}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {group.shortcuts.map((sc) => (
                    <div
                      key={sc.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>{sc.desc}</span>
                      <kbd
                        style={{
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: '#818CF8',
                          fontFamily: 'JetBrains Mono, monospace',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                        }}
                      >
                        {sc.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: '#64748B',
          }}
        >
          <span>Press <strong style={{ color: '#CBD5E1' }}>?</strong> anytime to toggle this keymap</span>
          <button
            onClick={onClose}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: '#FFF',
              fontSize: '0.72rem',
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
