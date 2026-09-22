import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Pause, Play, StepBack, StepForward,
  ChevronsLeft, ChevronsRight, X,
  Crosshair, GripVertical,
} from 'lucide-react';

/**
 * StockOracle Pro — TradingView-style Bar Replay transport.
 *
 * Floating pill pinned to the price pane while replay mode is active:
 * - Step bar-by-bar (±1 / ±10) or auto-play at 0.1x–5x
 * - "Jump to Bar" (click any candle on chart to cut history)
 * - Scrub with the range slider
 * - Drag handle to reposition anywhere on the chart
 * - Jump back to live
 */

export const REPLAY_SPEEDS = [
  { label: '0.1x', ms: 2500 },
  { label: '0.25x', ms: 1500 },
  { label: '0.5x', ms: 1000 },
  { label: '1x', ms: 500 },
  { label: '2x', ms: 250 },
  { label: '3x', ms: 160 },
  { label: '5x', ms: 100 },
];

const pillBtn = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: '#CBD5E1',
  cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s',
};

export default function ReplayBar({
  index = 0,
  total = 0,
  playing = false,
  speed = 3, // defaults to 1x (index 3 in 7-speed array)
  barLabel = '',
  onPlayPause = () => {},
  onStep = () => {},
  onSeek = () => {},
  onSpeed = () => {},
  onExit = () => {},
  isMobile = false,
  isJumpMode = false,
  onToggleJumpMode = () => {},
}) {
  const speedLabel = REPLAY_SPEEDS[speed]?.label || '1x';

  // Draggable position state (delta from original bottom-center)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });

  const handleGripMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      startX: dragOffset.x,
      startY: dragOffset.y,
    };

    const handlePointerMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const curX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const dx = curX - dragStartRef.current.mouseX;
      const dy = curY - dragStartRef.current.mouseY;
      setDragOffset({
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      });
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);
  }, [dragOffset]);

  const handleResetPosition = useCallback((e) => {
    e.stopPropagation();
    setDragOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div
      role="toolbar"
      aria-label="Bar replay controls"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 12,
        transform: `translate(calc(-50% + ${dragOffset.x}px), ${dragOffset.y}px)`,
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 3 : 6,
        padding: '5px 8px',
        borderRadius: 10,
        background: 'var(--bg-card, #131722)',
        border: isJumpMode ? '1px solid #EF5350' : '1px solid rgba(239,83,80,0.5)',
        boxShadow: isJumpMode
          ? '0 0 16px rgba(239,83,80,0.4), 0 12px 32px rgba(0,0,0,0.6)'
          : '0 12px 32px rgba(0,0,0,0.55)',
        userSelect: 'none',
        maxWidth: 'calc(100% - 16px)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Drag Grip handle */}
      {!isMobile && (
        <div
          onMouseDown={handleGripMouseDown}
          onTouchStart={handleGripMouseDown}
          onDoubleClick={handleResetPosition}
          title="Drag to reposition (Double-click to center)"
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab',
            color: '#64748B',
            padding: '2px 0',
          }}
        >
          <GripVertical size={14} />
        </div>
      )}

      {/* Recording dot + REPLAY tag */}
      <span
        title="Bar Replay mode — chart shows history up to the replay cursor"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.06em',
          color: '#F87171',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#EF5350',
            animation: playing ? 'replay-blink 1s steps(2) infinite' : 'none',
            opacity: playing ? 1 : 0.45,
          }}
        />
        {!isMobile && 'REPLAY'}
      </span>

      {/* Jump to Bar (Scissors/Target) */}
      <button
        type="button"
        onClick={onToggleJumpMode}
        title={isJumpMode ? 'Jump Mode active — click any candle to cut chart (Esc to cancel)' : 'Jump to Bar — Click any candle on the chart to start replay from there'}
        aria-label="Jump to Bar"
        style={{
          ...pillBtn,
          width: isMobile ? 28 : 'auto',
          padding: isMobile ? 0 : '0 7px',
          gap: 4,
          background: isJumpMode ? 'rgba(239,83,80,0.22)' : 'transparent',
          color: isJumpMode ? '#EF5350' : '#94A3B8',
          border: isJumpMode ? '1px solid #EF5350' : '1px solid transparent',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        <Crosshair size={15} style={{ animation: isJumpMode ? 'replay-spin 3s linear infinite' : 'none' }} />
        {!isMobile && <span>Jump</span>}
      </button>

      <div style={{ width: 1, height: 16, background: 'rgba(148,163,184,0.2)', margin: '0 2px' }} />

      <button
        type="button"
        onClick={() => onStep(-10)}
        title="Back 10 bars (Shift + ←)"
        aria-label="Back 10 bars"
        style={pillBtn}
      >
        <ChevronsLeft size={16} />
      </button>

      <button
        type="button"
        onClick={() => onStep(-1)}
        title="Previous bar (←)"
        aria-label="Previous bar"
        style={pillBtn}
      >
        <StepBack size={16} />
      </button>

      <button
        type="button"
        onClick={onPlayPause}
        title={playing ? 'Pause (Space)' : 'Play (Space)'}
        aria-label={playing ? 'Pause replay' : 'Play replay'}
        style={{
          ...pillBtn,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#EF5350',
          color: '#FFF',
          boxShadow: '0 2px 8px rgba(239,83,80,0.4)',
        }}
      >
        {playing ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: 2 }} />}
      </button>

      <button
        type="button"
        onClick={() => onStep(1)}
        title="Next bar (→)"
        aria-label="Next bar"
        style={pillBtn}
      >
        <StepForward size={16} />
      </button>

      <button
        type="button"
        onClick={() => onStep(10)}
        title="Forward 10 bars (Shift + →)"
        aria-label="Forward 10 bars"
        style={pillBtn}
      >
        <ChevronsRight size={16} />
      </button>

      {/* Scrubber */}
      {!isMobile && total > 1 && (
        <input
          type="range"
          min={0}
          max={total - 1}
          value={Math.max(0, Math.min(index, total - 1))}
          onChange={(e) => onSeek(Number(e.target.value))}
          title="Scrub through history"
          aria-label="Scrub through history"
          style={{ width: 140, accentColor: '#EF5350', cursor: 'pointer' }}
        />
      )}

      {/* Speed */}
      <button
        type="button"
        onClick={onSpeed}
        title="Replay speed (Click to cycle)"
        aria-label="Replay speed"
        style={{
          ...pillBtn,
          width: 'auto',
          padding: '0 7px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          fontWeight: 800,
          border: '1px solid rgba(148,163,184,0.3)',
          borderRadius: 6,
          color: '#93C5FD',
        }}
      >
        {speedLabel}
      </button>

      {/* Position readout */}
      <span
        title={barLabel || undefined}
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10.5,
          color: '#E2E8F0',
          whiteSpace: 'nowrap',
          padding: '0 4px',
        }}
      >
        {total > 0 ? `${Math.min(index + 1, total)}/${total}` : '—'}
        {barLabel && !isMobile ? ` · ${barLabel}` : ''}
      </span>

      {/* Exit to live */}
      <button
        type="button"
        onClick={onExit}
        title="Exit replay — jump to live (Esc or Alt+R)"
        aria-label="Exit replay"
        style={{
          ...pillBtn,
          width: 'auto',
          padding: '0 8px',
          gap: 4,
          background: 'rgba(16,185,129,0.16)',
          color: '#34D399',
          fontSize: 11,
          fontWeight: 800,
          borderRadius: 6,
        }}
      >
        <X size={13} />
        {!isMobile && 'LIVE'}
      </button>

      <style>{`
        @keyframes replay-blink { 50% { opacity: 0.25; } }
        @keyframes replay-spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
