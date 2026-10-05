// Pro Terminal V2 — Left Drawing Toolbar

import React from 'react';
import {
  MousePointer2, TrendingUp, Minus, Square, Type, ArrowUpRight,
  Lock, Eye, Trash2, Magnet, Ruler,
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

// Tools that are actions/toggles rather than drawing instruments.
const ACTION_TOOLS = new Set(['magnet', 'lock', 'hide', 'remove']);

export default function V2DrawingToolbar({
  activeTool,
  onToolChange,
  showMenu,
  onToggleMenu,
  magnetEnabled = false,
  drawingsLocked = false,
  allDrawingsHidden = false,
  onToggleMagnet,
  onToggleLock,
  onToggleHide,
  onClearDrawings,
}) {
  const handleToolClick = (tool) => {
    if (tool.category === 'group') {
      onToggleMenu(showMenu === tool.id ? null : tool.id);
      return;
    }
    switch (tool.id) {
      case 'magnet': onToggleMagnet?.(); return;
      case 'lock': onToggleLock?.(); return;
      case 'hide': onToggleHide?.(); return;
      case 'remove': onClearDrawings?.(); return;
      default: onToolChange(tool.id); onToggleMenu(null);
    }
  };

  const isToolActive = (tool) => {
    switch (tool.id) {
      case 'magnet': return magnetEnabled;
      case 'lock': return drawingsLocked;
      case 'hide': return allDrawingsHidden;
      case 'remove': return false;
      default: return activeTool === tool.id;
    }
  };

  const toolTitle = (tool) => {
    if (tool.id === 'magnet') return magnetEnabled ? 'Magnet: on' : 'Magnet: off';
    if (tool.id === 'lock') return drawingsLocked ? 'Lock drawings: on' : 'Lock drawings: off';
    if (tool.id === 'hide') return allDrawingsHidden ? 'Show drawings' : 'Hide all drawings';
    if (tool.id === 'remove') return 'Remove all drawings';
    return tool.label;
  };

  return (
    <div className="v2-drawing-rail" style={{
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
        const isActive = isToolActive(tool);
        const isGroup = tool.category === 'group';
        const isGroupOpen = showMenu === tool.id;
        // A group lights up when the active drawing tool is one of its children.
        const hasActiveChild = isGroup && (tool.children || []).some((c) => c.id === activeTool);
        const lit = isActive || hasActiveChild;

        return (
          <div key={tool.id} style={{ position: 'relative' }}>
            <button
              onClick={() => handleToolClick(tool)}
              title={toolTitle(tool)}
              aria-label={toolTitle(tool)}
              aria-pressed={ACTION_TOOLS.has(tool.id) ? isActive : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: 28,
                color: lit ? V2_COLORS.accent.primary : V2_COLORS.text.secondary,
                background: lit ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <Icon size={14} />
              {isGroup && (
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
              <div role="menu" style={{
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
                  const childActive = activeTool === child.id;
                  return (
                    <button
                      key={child.id}
                      role="menuitem"
                      onClick={() => { onToolChange(child.id); onToggleMenu(null); }}
                      aria-label={child.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '5px 10px',
                        fontSize: 11,
                        color: childActive ? V2_COLORS.accent.primary : V2_COLORS.text.secondary,
                        background: childActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
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
