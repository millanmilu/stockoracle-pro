// Pro Terminal V2 — Left Drawing Toolbar

import React from 'react';
import {
  MousePointer2, TrendingUp, Minus, Square, Type, ArrowUpRight,
  Lock, Unlock, Eye, EyeOff, Trash2, Magnet, Ruler, Crosshair,
} from 'lucide-react';
import { V2_COLORS, V2_DRAWING_TOOLS } from '../utils/constants';

const TOOL_ICONS = {
  cursor: MousePointer2,
  line: TrendingUp,
  trend: TrendingUp,
  ray: TrendingUp,
  horizontal: Minus,
  vertical: Minus,
  channel: Square,
  regression: TrendingUp,
  info: Type,
  fib: TrendingUp,
  fib_retr: TrendingUp,
  fib_ext: TrendingUp,
  fib_fan: TrendingUp,
  fib_chan: Square,
  pattern: Square,
  hs: Square,
  dt: Square,
  db: Square,
  tri: Square,
  wedge: Square,
  flag: Square,
  shape: Square,
  rect: Square,
  circle: Square,
  ellipse: Square,
  tri_shape: Square,
  annotation: Type,
  text: Type,
  arrow: ArrowUpRight,
  callout: Type,
  price_label: Type,
  measure: Ruler,
  magnet: Magnet,
  lock: Lock,
  hide: Eye,
  remove: Trash2,
};

export default function V2DrawingToolbar({ activeTool, onToolChange, showMenu, onToggleMenu }) {
  const handleToolClick = (tool) => {
    if (tool.category === 'group') {
      onToggleMenu(showMenu === tool.id ? null : tool.id);
    } else {
      onToolChange(tool.id);
      onToggleMenu(null);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: 36,
      background: V2_COLORS.bg.secondary,
      borderRight: `1px solid ${V2_COLORS.bg.border}`,
      padding: '4px 0',
      gap: 1,
      flexShrink: 0,
      position: 'relative',
    }}>
      {V2_DRAWING_TOOLS.map((tool) => {
        const Icon = TOOL_ICONS[tool.icon] || MousePointer2;
        const isActive = activeTool === tool.id;
        const isGroupOpen = showMenu === tool.id;

        return (
          <div key={tool.id} style={{ position: 'relative' }}>
            <button
              onClick={() => handleToolClick(tool)}
              title={tool.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: 28,
                color: isActive ? V2_COLORS.accent.primary : V2_COLORS.text.secondary,
                background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <Icon size={14} />
              {tool.category === 'group' && (
                <div style={{
                  position: 'absolute',
                  right: 2,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 8,
                  color: V2_COLORS.text.muted,
                }}>▸</div>
              )}
            </button>

            {/* Floating submenu */}
            {isGroupOpen && tool.children && (
              <div style={{
                position: 'absolute',
                left: '100%',
                top: 0,
                background: V2_COLORS.bg.elevated,
                border: `1px solid ${V2_COLORS.bg.border}`,
                borderRadius: 6,
                padding: '4px 0',
                minWidth: 140,
                zIndex: 200,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                animation: 'v2-slide-in 0.15s ease-out',
              }}>
                <div style={{
                  padding: '4px 10px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: V2_COLORS.text.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {tool.label}
                </div>
                {tool.children.map((child) => {
                  const ChildIcon = TOOL_ICONS[child.icon] || MousePointer2;
                  return (
                    <button
                      key={child.id}
                      onClick={() => { onToolChange(child.id); onToggleMenu(null); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '5px 10px',
                        fontSize: 11,
                        color: V2_COLORS.text.secondary,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <ChildIcon size={12} />
                      {child.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
