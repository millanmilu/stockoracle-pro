import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlignJustify,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BoxSelect,
  Boxes,
  Brush,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Circle,
  CircleDashed,
  Crosshair,
  Dot,
  Eye,
  EyeOff,
  Fan,
  Flag,
  Grid3x3,
  GripVertical,
  Highlighter,
  Layers,
  Lock,
  Magnet,
  MapPin,
  MessageSquare,
  Minus,
  MousePointer2,
  Move,
  MoveUpRight,
  PenLine,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Radar,
  Repeat,
  RotateCcw,
  RotateCw,
  Route,
  Ruler,
  SlidersHorizontal,
  Smile,
  Spline,
  Square,
  SquareDashedBottom,
  StickyNote,
  Tag,
  Trash2,
  TrendingUp,
  Triangle,
  Type,
  Unlock,
  Waves,
  Waypoints,
  X,
} from 'lucide-react';
import {
  ACTION_SHORTCUTS,
  DRAWING_TOOL_GROUPS,
  MAGNET_LABELS,
  TOOL_SHORTCUTS,
  getToolSpec,
} from './drawingToolCatalog';
import useStore from '../../store/useStore';
import { getThemeTokens } from '../../utils/theme';

/**
 * StockOracle Pro drawing toolbar.
 *
 * A compact, TradingView-*inspired* (original implementation) vertical rail that
 * stays aligned with the chart surface:
 *
 *   1. Pointer tools   — always-visible cursor / crosshair / dot.
 *   2. Pinned tools    — user-pinnable favourites, drag to reorder.
 *   3. Tool groups     — one rail button per group; the flyout lists the whole
 *                        group with icons and keyboard shortcuts. The rail
 *                        glyph tracks the group's last-used tool.
 *   4. Chart controls  — magnet, stay-in-draw-mode, undo/redo, lock, hide,
 *                        remove-all (with confirmation) and the object tree.
 *
 * Everything is data-driven from `drawingToolCatalog`, so a tool only appears
 * here when it is genuinely implemented: the group's `tools` array is built from
 * tools that have both an icon and a renderer.
 */

export const PINS_STORAGE_KEY = 'stockoracle_drawing_toolbar_pins_v1';

/** No default pins — the rail starts directly with tool categories.
 *  Users pin their own favourites via the star in any flyout. (Trendline,
 *  horizontal line, fib retracement, rectangle, long/short position and the
 *  dot cursor were removed from the rail start on request.) */
const DEFAULT_PINNED_TOOLS = [];


const ICONS = {
  cross: MousePointer2,
  crosshair: Crosshair,
  dot: Dot,
  trendline: TrendingUp,
  ray: MoveUpRight,
  extended_line: PenLine,
  info_line: AlignJustify,
  trend_angle: Activity,
  horizontal_line: Minus,
  horizontal_ray: ArrowUpRight,
  vertical_line: Minus,
  cross_line: Radar,
  fibonacci: Layers,
  fib_extension: ChevronsUpDown,
  fib_channel: Repeat,
  fib_fan: Fan,
  fib_timezone: CalendarRange,
  fib_circle: CircleDashed,
  gann_fan: Route,
  gann_box: Grid3x3,
  pitchfork: Spline,
  schiff_pitchfork: Spline,
  inside_pitchfork: Spline,
  brush: Brush,
  highlighter: Highlighter,
  arrow: ArrowUpRight,
  rectangle: Square,
  rotated_rectangle: BoxSelect,
  ellipse: Circle,
  circle: Circle,
  triangle: Triangle,
  arc: Waves,
  polyline: Spline,
  parallel_channel: Repeat,
  regression_trend: TrendingUp,
  flat_top_bottom: SquareDashedBottom,
  disjoint_channel: Repeat,
  text: Type,
  callout: MessageSquare,
  note: StickyNote,
  price_label: Tag,
  price_note: Tag,
  flag: Flag,
  pin: MapPin,
  xabcd: Waypoints,
  cypher: Waypoints,
  head_shoulders: Waves,
  abcd: Waypoints,
  triangle_pattern: Triangle,
  three_drives: BarChart3,
  elliott_impulse: Waves,
  elliott_correction: Waves,
  long_position: ArrowUpRight,
  short_position: ArrowDownRight,
  forecast: Activity,
  projection: TrendingUp,
  bars_pattern: BarChart3,
  date_range: CalendarRange,
  price_range: ChevronsUpDown,
  date_price_range: Boxes,
  fixed_range_volume_profile: AlignJustify,
  ruler: Ruler,
  smile: Smile,
};

/** Tools whose glyph is a rotated version of another (vertical line). */
const ROTATED_ICONS = new Set(['vertical_line']);

function ToolIcon({ toolId, size = 16, color }) {
  const Icon = ICONS[toolId] || Move;
  const rotate = ROTATED_ICONS.has(toolId);
  return <Icon size={size} color={color} style={rotate ? { transform: 'rotate(90deg)' } : undefined} />;
}

/** Reads the persisted pin list, dropping anything that is no longer a tool. */
function readPinnedTools() {
  try {
    const raw = window.localStorage.getItem(PINS_STORAGE_KEY);
    if (!raw) return DEFAULT_PINNED_TOOLS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PINNED_TOOLS;
    const valid = parsed.filter((id) => typeof id === 'string' && getToolSpec(id));
    return valid.length ? valid : DEFAULT_PINNED_TOOLS;
  } catch {
    return DEFAULT_PINNED_TOOLS;
  }
}

/** All tool groups render as flyout group buttons on the rail. */
const FLYOUT_GROUPS = DRAWING_TOOL_GROUPS;

// ── Presentational helpers ──────────────────────────────────────────────────

const COLOR = {
  bg: '#131722',
  panel: '#1E222D',
  border: '#2A2E39',
  borderSoft: '#2A2E39',
  text: '#D1D4DC',
  textDim: '#787B86',
  textMuted: '#787B86',
  accent: '#2962FF',
  accentBg: 'rgba(41,98,255,0.18)',
  hoverBg: '#2A2E39',
  danger: '#EF5350',
  mono: "'Trebuchet MS', Roboto, Ubuntu, sans-serif",
};

/** Theme-aware rail palette — TradingView parity (dark #131722 / light white). */
function useRailPalette() {
  const theme = useStore(s => s.theme) ?? 'dark';
  if (theme === 'light') {
    return {
      bg: '#FFFFFF',
      panel: '#FFFFFF',
      border: '#E0E3EB',
      borderSoft: '#E0E3EB',
      text: '#131722',
      textDim: '#787B86',
      textMuted: '#787B86',
      accent: '#2962FF',
      accentBg: 'rgba(41,98,255,0.10)',
      hoverBg: '#F0F3FA',
      danger: '#EF5350',
      mono: "'Trebuchet MS', Roboto, Ubuntu, sans-serif",
    };
  }
  return COLOR;
}

const panelStyle = {
  position: 'absolute',
  left: '100%',
  width: 236,
  padding: '4px 0',
  borderRadius: '0 4px 4px 0',
  border: `1px solid ${COLOR.border}`,
  borderLeft: 0,
  background: COLOR.panel,
  boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
  zIndex: 60,
};

/**
 * One square rail button. Handles hover tinting, the active accent state,
 * tooltip reporting and optional HTML5 drag-and-drop (pinned tools only).
 */
function RailButton({
  toolId,
  icon,
  label,
  hint,
  shortcut,
  active = false,
  size = 32,
  disabled = false,
  onSelect,
  onHover,
  onLeave,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragging = false,
  dropTarget = false,
  badge = null,
}) {
  const [hovered, setHovered] = useState(false);
  const C = useRailPalette();
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={(event) => {
        if (disabled) return;
        onSelect?.(toolId, event);
      }}
      onMouseEnter={(event) => {
        setHovered(true);
        onHover?.(event, { toolId, icon, label, hint, shortcut });
      }}
      onMouseLeave={() => {
        setHovered(false);
        onLeave?.();
      }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        padding: 0,
        flexShrink: 0,
        border: 0,
        borderRadius: 4,
        background: active ? '#2962FF' : hovered ? C.hoverBg : 'transparent',
        color: disabled ? C.textMuted : active ? '#FFFFFF' : hovered ? C.text : C.textDim,
        cursor: disabled ? 'not-allowed' : draggable ? 'grab' : 'pointer',
        opacity: dragging ? 0.45 : 1,
        outline: dropTarget ? '1px dashed #2962FF' : 'none',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {icon}
      {badge}
    </button>
  );
}

/** Compact hover tooltip: name, hint and keyboard shortcut. */
function ToolTooltip({ data, railWidth, top }) {
  const C = useRailPalette();
  if (!data) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: railWidth + 8,
        top,
        zIndex: 90,
        pointerEvents: 'none',
        maxWidth: 220,
        padding: '6px 9px',
        borderRadius: 4,
        border: `1px solid ${C.border}`,
        background: C.panel,
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>{data.label}</span>
        {data.shortcut ? (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textMuted, whiteSpace: 'nowrap' }}>
            {data.shortcut}
          </span>
        ) : null}
      </div>
      {data.hint ? (
        <div style={{ marginTop: 2, fontSize: 11, lineHeight: 1.35, color: C.textDim, whiteSpace: 'normal' }}>{data.hint}</div>
      ) : null}
    </div>
  );
}

/** A flyout row for one tool: icon, name, shortcut, active marker, pin toggle. */
function FlyoutRow({ tool, active, pinned, onPick, onTogglePin, showPin = true, highlighted = false, rowRef = null, digit = null }) {
  const [hovered, setHovered] = useState(false);
  const C = useRailPalette();
  const shortcut = TOOL_SHORTCUTS[tool.id];
  const keys = [shortcut, digit ? `[${digit}]` : null].filter(Boolean).join(' · ');
  return (
    <div
      ref={rowRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderRadius: 0,
        background: active ? C.accentBg : hovered || highlighted ? C.hoverBg : 'transparent',
        outline: highlighted && !active ? '1px solid #2962FF' : 'none',
        outlineOffset: -1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={() => onPick(tool.id)}
        title={`${tool.label}${keys ? ` (${keys})` : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flex: 1,
          minWidth: 0,
          padding: '7px 12px',
          border: 0,
          borderRadius: 0,
          background: 'transparent',
          color: active ? '#2962FF' : C.text,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <ToolIcon toolId={tool.id} size={16} color={active ? '#2962FF' : C.textDim} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tool.label}
        </span>
        {active ? (
          <Check size={14} color="#2962FF" />
        ) : keys ? (
          <span style={{ fontSize: 11, color: C.textMuted }}>{keys}</span>
        ) : null}
      </button>
      {showPin ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin?.(tool.id);
          }}
          title={pinned ? `Unpin ${tool.label}` : `Pin ${tool.label} to the toolbar`}
          aria-label={pinned ? `Unpin ${tool.label}` : `Pin ${tool.label}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            flexShrink: 0,
            marginRight: 4,
            padding: 0,
            border: 0,
            borderRadius: 4,
            background: 'transparent',
            color: pinned ? '#2962FF' : hovered ? C.textDim : 'transparent',
            cursor: 'pointer',
          }}
        >
          {pinned ? <PinOff size={12} /> : <Plus size={12} />}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Main vertical drawing rail (default export — consumed by DrawingTools).
 * Same props contract as before: pointer tools, pinnable favourites with
 * drag-reorder, one flyout button per tool group, and the chart-controls
 * cluster (magnet / stay-in-draw / undo / redo / lock / hide / clear-all /
 * object tree). Rail surfaces use CSS vars so light mode stays readable.
 */
export default function DrawingToolbar({
  activeTool,
  onSelectTool = () => {},
  magnetMode = 'off',
  onCycleMagnet = () => {},
  stayInDrawMode = false,
  onToggleStayInDrawMode = () => {},
  lockAllDrawings = false,
  onToggleLockAll = () => {},
  hideAllDrawings = false,
  onToggleHideAll = () => {},
  onClearAll = () => {},
  onUndo = () => {},
  onRedo = () => {},
  drawingCount = 0,
  showObjectTree = false,
  onToggleObjectTree = () => {},
  isOpen = true,
  onToggleOpen = () => {},
  isMobile = false,
}) {
  const [openGroup, setOpenGroup] = useState(null);
  const [flyoutTop, setFlyoutTop] = useState(8);
  const [groupTool, setGroupTool] = useState({});
  const [pinned, setPinned] = useState(readPinnedTools);
  const [tooltip, setTooltip] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropId, setDropId] = useState(null);
  const railRef = useRef(null);

  const width = getToolbarWidth(isMobile);
  const btn = isMobile ? 30 : 34;
  const icon = isMobile ? 15 : 17;

  // Persist favourites + notify the floating favorites bar (same storage key).
  useEffect(() => {
    try {
      window.localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pinned));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent('so:pins-changed'));
    } catch {}
  }, [pinned]);

  // External pin changes (floating bar unpin / another tab) sync back here.
  useEffect(() => {
    const sync = () => {
      const fresh = readPinnedTools();
      setPinned((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh));
    };
    window.addEventListener('so:pins-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('so:pins-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Remember the last tool used per group so the rail glyph tracks TradingView.
  useEffect(() => {
    const spec = getToolSpec(activeTool);
    if (spec) {
      setGroupTool((prev) => (prev[spec.group] === spec.id ? prev : { ...prev, [spec.group]: spec.id }));
    }
  }, [activeTool]);

  // Close the flyout on outside click / Escape.
  useEffect(() => {
    if (!openGroup) return undefined;
    const close = (event) => {
      if (railRef.current && !railRef.current.contains(event.target)) setOpenGroup(null);
    };
    const onKey = (event) => { if (event.key === 'Escape') setOpenGroup(null); };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [openGroup]);

  const activeGroup = useMemo(
    () => (openGroup ? DRAWING_TOOL_GROUPS.find((group) => group.id === openGroup) : null),
    [openGroup],
  );

  const togglePin = useCallback((id) => {
    setPinned((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }, []);

  // Digit hotkey for a pinned favourite: 1..9,0 follow pin order (DrawingTools
  // binds these globally). Only the first ten pins get digits.
  const pinDigit = useCallback((id) => {
    const i = pinned.indexOf(id);
    return i >= 0 && i < 10 ? String((i + 1) % 10) : null;
  }, [pinned]);

  const showTip = useCallback((event, info) => {
    const top = Math.max(0, (event?.currentTarget?.offsetTop ?? 0) - 4);
    setTooltip({ data: info, top });
  }, []);

  const pinnedSpecs = useMemo(
    () => pinned.map((id) => getToolSpec(id)).filter(Boolean),
    [pinned],
  );

  const magnetColor = magnetMode === 'strong' ? '#2962FF' : magnetMode === 'weak' ? '#0EA5E9' : null;

  // Favorites first inside the flyout: pinned tools of this group float to
  // the top under a ★ header; the rest keep catalog order below.
  const flyoutTools = useMemo(() => {
    if (!activeGroup) return [];
    const fav = [];
    const rest = [];
    for (const tool of activeGroup.tools) {
      (pinned.includes(tool.id) ? fav : rest).push(tool);
    }
    return { fav, rest, all: [...fav, ...rest] };
  }, [activeGroup, pinned]);

  // Keyboard navigation within the flyout (arrows + Enter, Esc closes).
  const [highlightIdx, setHighlightIdx] = useState(0);
  useEffect(() => { setHighlightIdx(0); }, [openGroup]);
  const flyoutRef = useRef(null);
  useEffect(() => {
    if (openGroup && flyoutRef.current) {
      try { flyoutRef.current.focus({ preventScroll: true }); } catch (_) {}
    }
  }, [openGroup]);

  // Toggle category flyout. Pure state updates (no setState-in-updater) so
  // StrictMode double-invocation can never swallow the toggle.
  const openFlyout = useCallback((groupId, anchor) => {
    if (openGroup === groupId) {
      setOpenGroup(null); // toggle: same category closes
      return;
    }
    // Viewport-aware: clamp so the panel never overflows the bottom edge.
    const group = DRAWING_TOOL_GROUPS.find((g) => g.id === groupId);
    const rows = group ? group.tools.length : 6;
    const panelH = Math.min(rows * 30 + 48, (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.72);
    let top = Math.max(0, (anchor?.offsetTop ?? 8) - 6);
    try {
      const railTop = railRef.current?.getBoundingClientRect()?.top ?? 0;
      const maxTop = (typeof window !== 'undefined' ? window.innerHeight : 800) - railTop - panelH - 8;
      if (top > maxTop) top = Math.max(8, maxTop);
    } catch (_) {}
    setFlyoutTop(top);
    setOpenGroup(groupId);
  }, [openGroup]);

  const pickTool = useCallback((toolId) => {
    onSelectTool(toolId);
    if (!isMobile) setOpenGroup(null);
  }, [onSelectTool, isMobile]);

  const onFlyoutKeyDown = useCallback((event) => {
    const n = flyoutTools.all.length;
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpenGroup(null);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIdx((i) => (n ? (i + 1) % n : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIdx((i) => (n ? (i - 1 + n) % n : 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlightIdx(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlightIdx(n - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const tool = flyoutTools.all[highlightIdx];
      if (tool) pickTool(tool.id);
    }
  }, [flyoutTools, highlightIdx, pickTool]);

  // One rail button per flyout group, with the "has submenu" corner tick.
  const renderGroupButton = (group) => {
    const currentTool = groupTool[group.id] || group.tools[0]?.id;
    const groupActive = group.tools.some((tool) => tool.id === activeTool);
    const highlighted = groupActive || openGroup === group.id;
    return (
      <RailButton
        key={group.id}
        toolId={currentTool}
        label={`${group.label} — ${getToolSpec(currentTool)?.label || ''}`}
        hint={getToolSpec(currentTool)?.hint}
        shortcut={TOOL_SHORTCUTS[currentTool]}
        active={highlighted}
        size={btn}
        onSelect={(toolId, event) => {
          openFlyout(group.id, event?.currentTarget);
          if (!groupActive && currentTool) onSelectTool(currentTool);
        }}
        onHover={showTip}
        onLeave={() => setTooltip(null)}
        icon={
          <span style={{ position: 'relative', display: 'flex' }}>
            <ToolIcon toolId={currentTool} size={icon} color={highlighted ? '#FFFFFF' : C.textDim} />
            <span
              style={{
                position: 'absolute',
                right: -6,
                bottom: -6,
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderBottom: `4px solid ${highlighted ? '#FFFFFF' : C.textMuted}`,
              }}
            />
          </span>
        }
      />
    );
  };

  const cluster = (key, { onClick, title, shortcut, activeState = false, activeColor = '#2962FF', children, badge = null }) => (
    <RailButton
      key={key}
      toolId={key}
      label={title}
      shortcut={shortcut}
      active={!!activeState}
      size={btn}
      onSelect={onClick}
      onHover={showTip}
      onLeave={() => setTooltip(null)}
      icon={
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
          {badge}
        </span>
      }
    />
  );

  const railTheme = useStore(s => s.theme);
  const C = useRailPalette();
  const tk = getThemeTokens(railTheme);
  const divider = (
    <div style={{ width: 22, height: 1, background: C.border, margin: '4px 0' }} />
  );

  return (
    <div
      ref={railRef}
      style={{
        width,
        height: '100%',
        display: isOpen ? 'flex' : 'none',
        flexDirection: 'column',
        alignItems: 'center',
        background: tk.toolbarBg,
        borderRight: `1px solid ${tk.toolbarBorder}`,
        position: 'relative',
        zIndex: 46,
        flexShrink: 0,
        userSelect: 'none',
        overflow: 'visible',
      }}
    >
      {/* Scrollable button column. The flyout/tooltip live OUTSIDE this
          scroller as siblings: overflow-y:auto would otherwise force
          overflow-x to auto as well and clip the flyout (the classic
          "submenu never shows" bug). */}
      <div
        onScroll={() => { if (openGroup) setOpenGroup(null); }}
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '6px 0',
          gap: 3,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          overscrollBehavior: 'contain',
        }}
      >
      {/* Tool groups with flyouts (strictly grouped drawing categories) */}
      {FLYOUT_GROUPS.map(renderGroupButton)}

      {divider}

      {/* Chart controls cluster */}
      {cluster('magnet', {
        onClick: onCycleMagnet,
        title: MAGNET_LABELS[magnetMode] || 'Magnet',
        shortcut: ACTION_SHORTCUTS.magnet,
        activeState: magnetMode !== 'off',
        activeColor: magnetColor || '#2962FF',
        children: <Magnet size={icon} />,
      })}
      {cluster('stay', {
        onClick: onToggleStayInDrawMode,
        title: stayInDrawMode ? 'Stay in Drawing Mode: ON' : 'Stay in Drawing Mode: OFF',
        shortcut: ACTION_SHORTCUTS.keepDrawing,
        activeState: stayInDrawMode,
        children: <Lock size={icon - 2} />,
      })}
      {cluster('undo', {
        onClick: onUndo,
        title: 'Undo',
        shortcut: ACTION_SHORTCUTS.undo,
        children: <RotateCcw size={icon - 2} />,
      })}
      {cluster('redo', {
        onClick: onRedo,
        title: 'Redo',
        shortcut: ACTION_SHORTCUTS.redo,
        children: <RotateCw size={icon - 2} />,
      })}
      {cluster('lock', {
        onClick: onToggleLockAll,
        title: lockAllDrawings ? 'Unlock All Objects' : 'Lock All Objects',
        shortcut: ACTION_SHORTCUTS.lockAll,
        activeState: lockAllDrawings,
        activeColor: '#F59E0B',
        children: lockAllDrawings ? <Lock size={icon - 2} /> : <Unlock size={icon - 2} />,
      })}
      {cluster('hide', {
        onClick: onToggleHideAll,
        title: hideAllDrawings ? 'Show All Objects' : 'Hide All Objects',
        shortcut: ACTION_SHORTCUTS.hideAll,
        activeState: hideAllDrawings,
        activeColor: '#EF5350',
        children: hideAllDrawings ? <EyeOff size={icon - 2} /> : <Eye size={icon - 2} />,
      })}
      {cluster('clear', {
        onClick: onClearAll,
        title: 'Remove All Objects',
        shortcut: ACTION_SHORTCUTS.removeAll,
        children: <Trash2 size={icon - 2} />,
      })}
      {cluster('tree', {
        onClick: onToggleObjectTree,
        title: `Object Tree (${drawingCount})`,
        activeState: showObjectTree,
        activeColor: '#0EA5E9',
        children: <Layers size={icon - 2} />,
        badge: drawingCount > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              minWidth: 14,
              height: 14,
              padding: '0 3px',
              borderRadius: 7,
              background: '#2962FF',
              color: '#FFFFFF',
              fontSize: 8.5,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {drawingCount > 99 ? '99+' : drawingCount}
          </span>
        ) : null,
      })}
      </div>

      <button
        type="button"
        onClick={onToggleOpen}
        title={isOpen ? 'Hide drawing tools' : 'Show drawing tools'}
        aria-label={isOpen ? 'Hide drawing tools' : 'Show drawing tools'}
        style={{
          width: btn,
          height: btn,
          margin: '4px 0 6px',
          borderRadius: 4,
          border: 0,
          background: 'transparent',
          color: C.textDim,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isOpen ? <X size={icon - 3} /> : <Pencil size={icon - 3} />}
      </button>

      {/* Tool flyout — favorites of this group pinned to the top */}
      {activeGroup ? (
        <div
          ref={flyoutRef}
          tabIndex={-1}
          onKeyDown={onFlyoutKeyDown}
          role="menu"
          aria-label={`${activeGroup.label} tools`}
          style={{ ...panelStyle, background: C.panel, border: `1px solid ${C.border}`, borderLeft: 0, top: flyoutTop, width: isMobile ? 186 : 236, maxHeight: isMobile ? '58vh' : '72vh', overflowY: 'auto', outline: 'none' }}
        >
          <div style={{ padding: '6px 12px 4px', color: C.textMuted, fontSize: 11, fontWeight: 400 }}>
            {activeGroup.label}
          </div>
          {flyoutTools.fav.length > 0 && (
            <>
              <div style={{ padding: '2px 12px 3px', color: '#2962FF', fontSize: 11, fontWeight: 600 }}>
                ★ Favorites
              </div>
              {flyoutTools.fav.map((tool) => (
                <FlyoutRow
                  key={`fav-${tool.id}`}
                  tool={tool}
                  active={tool.id === activeTool}
                  pinned
                  digit={pinDigit(tool.id)}
                  highlighted={flyoutTools.all[highlightIdx]?.id === tool.id}
                  onPick={pickTool}
                  onTogglePin={togglePin}
                />
              ))}
              <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
            </>
          )}
          {flyoutTools.rest.map((tool) => (
            <FlyoutRow
              key={tool.id}
              tool={tool}
              active={tool.id === activeTool}
              pinned={false}
              digit={pinDigit(tool.id)}
              highlighted={flyoutTools.all[highlightIdx]?.id === tool.id}
              onPick={pickTool}
              onTogglePin={togglePin}
            />
          ))}
        </div>
      ) : null}

      <ToolTooltip data={tooltip?.data} railWidth={width} top={tooltip?.top ?? 0} />
    </div>
  );
}

const getToolbarWidth = (isMobile) => (isMobile ? 36 : 40);

export { ICONS, ToolIcon, FlyoutRow, getToolbarWidth };
