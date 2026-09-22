import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Star, X } from 'lucide-react';
import { TOOL_SHORTCUTS, getToolSpec } from './drawingToolCatalog';
import { PINS_STORAGE_KEY, ToolIcon } from './DrawingToolbar';

/**
 * TradingView-style floating favorite toolbar.
 *
 * - Horizontal pill overlaying the top-left of the chart surface.
 * - Shows the same starred/pinned tools as the left rail (same localStorage key).
 * - Draggable via the grip handle; position persists per browser.
 * - Click selects the tool, right-click unpins it (title hints document this).
 * - Collapsible + closable; auto-hides into a slim hint when no favorites exist.
 */

export const FAVBAR_POS_KEY = 'stockoracle_favbar_pos_v1';
export const FAVBAR_HIDDEN_KEY = 'stockoracle_favbar_hidden_v1';
export const FAVBAR_HINT_KEY = 'stockoracle_favbar_hint_dismissed_v1';
export const PINS_CHANGED_EVENT = 'so:pins-changed';

function readPins() {
  try {
    const raw = window.localStorage.getItem(PINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === 'string' && getToolSpec(id));
  } catch {
    return [];
  }
}

function writePins(pins) {
  try {
    window.localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(PINS_CHANGED_EVENT));
  } catch {}
}

function readPos() {
  try {
    const raw = window.localStorage.getItem(FAVBAR_POS_KEY);
    if (!raw) return { x: 12, y: 10 };
    const parsed = JSON.parse(raw);
    const x = Number(parsed?.x);
    const y = Number(parsed?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 12, y: 10 };
    return { x: Math.max(0, Math.min(1200, x)), y: Math.max(0, Math.min(800, y)) };
  } catch {
    return { x: 12, y: 10 };
  }
}

export default function FloatingFavoritesBar({
  activeTool,
  onSelectTool = () => {},
  toolbarWidth = 46,
  isMobile = false,
}) {
  const [pins, setPins] = useState(readPins);
  const [pos, setPos] = useState(readPos);
  const [collapsed, setCollapsed] = useState(false);
  const [closed, setClosed] = useState(() => {
    try {
      return window.localStorage.getItem(FAVBAR_HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [hintDismissed, setHintDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(FAVBAR_HINT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const barRef = useRef(null);

  // Stay in sync with the left rail (same storage key).
  useEffect(() => {
    const sync = () => {
      const fresh = readPins();
      setPins((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh));
      // A newly starred tool should bring the bar back.
      if (fresh.length > 0) {
        setClosed((was) => {
          if (was) {
            try {
              window.localStorage.removeItem(FAVBAR_HIDDEN_KEY);
            } catch {}
            return false;
          }
          return was;
        });
      }
    };
    window.addEventListener(PINS_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PINS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVBAR_POS_KEY, JSON.stringify(pos));
    } catch {}
  }, [pos]);

  const unpin = useCallback((id) => {
    setPins((prev) => {
      const next = prev.filter((p) => p !== id);
      writePins(next);
      return next;
    });
  }, []);

  const onGripPointerDown = useCallback(
    (e) => {
      // Only primary button / touch drag from the grip.
      if (e.button !== undefined && e.button !== 0) return;
      const startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const origin = { ...pos };
      dragRef.current = { startX, startY, origin };
      setDragging(true);
      const move = (ev) => {
        const cx = ev.clientX ?? ev.touches?.[0]?.clientX ?? startX;
        const cy = ev.clientY ?? ev.touches?.[0]?.clientY ?? startY;
        const dx = cx - dragRef.current.startX;
        const dy = cy - dragRef.current.startY;
        const bar = barRef.current;
        const parent = bar?.parentElement;
        const pw = parent?.clientWidth ?? window.innerWidth;
        const ph = parent?.clientHeight ?? 600;
        const bw = bar?.offsetWidth ?? 200;
        const bh = bar?.offsetHeight ?? 36;
        const nx = Math.max(0, Math.min(Math.max(0, pw - bw - 4), origin.x + dx));
        const ny = Math.max(0, Math.min(Math.max(0, ph - bh - 4), origin.y + dy));
        setPos({ x: nx, y: ny });
      };
      const up = () => {
        setDragging(false);
        dragRef.current = null;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      e.preventDefault?.();
    },
    [pos],
  );

  const closeBar = useCallback(() => {
    setClosed(true);
    try {
      window.localStorage.setItem(FAVBAR_HIDDEN_KEY, '1');
    } catch {}
  }, []);

  const reopenBar = useCallback(() => {
    setClosed(false);
    try {
      window.localStorage.removeItem(FAVBAR_HIDDEN_KEY);
    } catch {}
  }, []);

  // Closed state — TradingView parity: show a tiny recall button on the chart
  // so the bar is never "lost". Click ★ to bring it back.
  if (closed) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: toolbarWidth + 12,
          zIndex: 55,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          onClick={reopenBar}
          title="Show favorites bar"
          aria-label="Show favorites bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 7,
            border: '1px solid var(--border, rgba(148,163,184,0.25))',
            background: 'var(--bg-card, #131722)',
            color: 'var(--text-muted, #94A3B8)',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >
          <Star size={14} />
        </button>
      </div>
    );
  }

  // Empty state — slim hint pill (dismissable), TradingView shows nothing
  // when there are no favorites, but first-run discoverability matters more.
  if (pins.length === 0) {
    if (hintDismissed || isMobile) return null;
    return (
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: toolbarWidth + 12,
          zIndex: 55,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px 6px 10px',
          borderRadius: 8,
          border: '1px dashed rgba(148,163,184,0.35)',
          background: 'var(--bg-card, #131722)',
          color: 'var(--text-muted, #94A3B8)',
          fontSize: 11,
          userSelect: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          maxWidth: 300,
        }}
      >
        <Star size={13} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Star tools in the left rail to pin favorites here
        </span>
        <button
          type="button"
          onClick={() => {
            setHintDismissed(true);
            try {
              window.localStorage.setItem(FAVBAR_HINT_KEY, '1');
            } catch {}
          }}
          title="Dismiss"
          aria-label="Dismiss favorites hint"
          style={{
            border: 0,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            display: 'flex',
            padding: 2,
          }}
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  const btn = isMobile ? 28 : 30;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: toolbarWidth,
        right: 0,
        height: 0,
        overflow: 'visible',
        zIndex: 55,
        pointerEvents: 'none',
      }}
    >
      <div
        ref={barRef}
        style={{
          position: 'absolute',
          left: pos.x,
          top: pos.y,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '4px 4px 4px 2px',
          borderRadius: 9,
          border: '1px solid var(--border, rgba(148,163,184,0.25))',
          background: 'var(--bg-card, #131722)',
          boxShadow: dragging ? '0 16px 40px rgba(0,0,0,0.6)' : '0 10px 28px rgba(0,0,0,0.5)',
          userSelect: 'none',
          maxWidth: 'calc(100% - 24px)',
          opacity: dragging ? 0.92 : 1,
          cursor: dragging ? 'grabbing' : 'default',
        }}
      >
        {/* Drag grip */}
        <span
          onPointerDown={onGripPointerDown}
          title="Drag to move favorites bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: btn,
            color: 'var(--text-muted, #64748B)',
            cursor: 'grab',
            touchAction: 'none',
            flexShrink: 0,
          }}
        >
          <GripVertical size={14} />
        </span>

        <Star size={12} color="#38BDF8" style={{ flexShrink: 0, marginRight: 2 }} />

        {/* Favorite tools */}
        {!collapsed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              maxWidth: isMobile ? 180 : 320,
            }}
          >
            {pins.map((id, i) => {
              const spec = getToolSpec(id);
              if (!spec) return null;
              const isActive = id === activeTool;
              const shortcut = TOOL_SHORTCUTS[id];
              const digit = i < 10 ? String((i + 1) % 10) : null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTool(id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    unpin(id);
                  }}
                  title={`${spec.label}${shortcut ? ` (${shortcut})` : ''}${digit ? ` [${digit}]` : ''} — right-click to unpin`}
                  aria-label={spec.label}
                  aria-pressed={isActive}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: btn,
                    height: btn,
                    flexShrink: 0,
                    padding: 0,
                    border: `1px solid ${isActive ? 'rgba(56,189,248,0.5)' : 'transparent'}`,
                    borderRadius: 6,
                    background: isActive ? 'rgba(56,189,248,0.16)' : 'transparent',
                    color: isActive ? '#38BDF8' : 'var(--text-muted, #94A3B8)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (id !== activeTool) e.currentTarget.style.background = 'rgba(148,163,184,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    if (id !== activeTool) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <ToolIcon toolId={id} size={isMobile ? 14 : 15} />
                  {digit && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 1,
                        fontSize: 7.5,
                        fontWeight: 800,
                        fontFamily: 'JetBrains Mono, monospace',
                        color: isActive ? '#38BDF8' : '#64748B',
                        lineHeight: 1,
                        pointerEvents: 'none',
                      }}
                    >
                      {digit}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Collapse + close */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expand favorites' : 'Collapse favorites'}
          aria-label={collapsed ? 'Expand favorites' : 'Collapse favorites'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: btn,
            border: 0,
            background: 'transparent',
            color: 'var(--text-muted, #64748B)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
        <button
          type="button"
          onClick={closeBar}
          title="Hide favorites bar (star a tool to bring it back)"
          aria-label="Hide favorites bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: btn,
            border: 0,
            background: 'transparent',
            color: 'var(--text-muted, #64748B)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
