import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlignJustify,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  BoxSelect,
  Brush,
  CalendarRange,
  ChevronsUpDown,
  Circle,
  Crosshair,
  Dot,
  Eye,
  EyeOff,
  Flag,
  Grid3x3,
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
  Radar,
  Repeat,
  RotateCcw,
  RotateCw,
  Route,
  Ruler,
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
  DRAWING_TOOL_GROUPS,
  MAGNET_LABELS,
  getToolSpec,
  nextMagnetMode,
} from './drawingToolCatalog';

/**
 * TradingView-style vertical drawing toolbar.
 *
 * Everything is data-driven from `drawingToolCatalog`: each group renders one
 * rail button (showing the group's last used tool) that opens a flyout with the
 * full tool list. The bottom cluster mirrors TradingView's magnet /
 * stay-in-mode / lock / hide / remove / object-tree controls.
 */

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
  fib_timezone: CalendarRange,
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
  polyline: Spline,
  parallel_channel: Repeat,
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

const rowButton = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  width: '100%',
  padding: '6px 9px',
  border: 0,
  borderRadius: 5,
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
};

function FlyoutRow({ tool, active, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(tool.id)}
      title={tool.hint}
      style={{
        ...rowButton,
        background: active ? 'rgba(41,98,255,0.16)' : 'transparent',
        color: active ? '#7DD3FC' : '#CBD5E1',
      }}
      onMouseEnter={(event) => { if (!active) event.currentTarget.style.background = 'rgba(148,163,184,0.12)'; }}
      onMouseLeave={(event) => { if (!active) event.currentTarget.style.background = 'transparent'; }}
    >
      <ToolIcon toolId={tool.id} size={15} color={active ? '#7DD3FC' : '#94A3B8'} />
      <span style={{ flex: 1, fontSize: 12, whiteSpace: 'nowrap' }}>{tool.label}</span>
      {active ? <span style={{ fontSize: 9, color: '#7DD3FC' }}>ACTIVE</span> : null}
    </button>
  );
}

export default function DrawingToolbar({
  activeTool,
  onSelectTool = () => {},
  magnetMode = 'off',
  onCycleMagnet = () => {},
  stayInDrawMode = true,
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
  const railRef = useRef(null);

  const width = isMobile ? 36 : 46;
  const btn = isMobile ? 30 : 34;
  const icon = isMobile ? 15 : 17;

  // Remember the last tool used per group so the rail glyph tracks TradingView.
  useEffect(() => {
    const spec = getToolSpec(activeTool);
    if (spec) setGroupTool((prev) => (prev[spec.group] === spec.id ? prev : { ...prev, [spec.group]: spec.id }));
  }, [activeTool]);

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

  const magnetColor = magnetMode === 'strong' ? '#2962FF' : magnetMode === 'weak' ? '#0EA5E9' : null;

  const clusterButton = (onClick, title, activeState, children, activeColor = '#2962FF') => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: btn,
        height: btn,
        borderRadius: 5,
        border: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: activeState ? activeColor : 'transparent',
        color: activeState ? '#FFFFFF' : '#94A3B8',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
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
        padding: '6px 0',
        gap: 3,
        background: '#0F131D',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        position: 'relative',
        zIndex: 46,
        flexShrink: 0,
        userSelect: 'none',
        overflowY: 'auto',
        overflowX: 'visible',
        scrollbarWidth: 'none',
        overscrollBehavior: 'contain',
      }}
    >
      {DRAWING_TOOL_GROUPS.map((group) => {
        const currentTool = groupTool[group.id] || group.tools[0].id;
        const groupActive = group.tools.some((tool) => tool.id === activeTool);
        const isOpenGroup = openGroup === group.id;
        const highlighted = groupActive || isOpenGroup;
        return (
          <button
            key={group.id}
            type="button"
            onClick={(event) => {
              setFlyoutTop(Math.max(0, event.currentTarget.offsetTop - 6));
              if (isOpenGroup) {
                setOpenGroup(null);
              } else {
                setOpenGroup(group.id);
                if (!groupActive) onSelectTool(currentTool);
              }
            }}
            onMouseEnter={(event) => {
              if (openGroup && !isOpenGroup) {
                setFlyoutTop(Math.max(0, event.currentTarget.offsetTop - 6));
                setOpenGroup(group.id);
              }
            }}
            title={`${group.label} — ${getToolSpec(currentTool)?.label || ''}`}
            style={{
              position: 'relative',
              width: btn,
              height: btn,
              borderRadius: 5,
              border: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: highlighted ? '#2962FF' : 'transparent',
              color: highlighted ? '#FFFFFF' : '#94A3B8',
              cursor: 'pointer',
            }}
          >
            <ToolIcon toolId={currentTool} size={icon} color={highlighted ? '#FFFFFF' : '#94A3B8'} />
            <span
              style={{
                position: 'absolute',
                right: 2,
                bottom: 2,
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderBottom: `4px solid ${highlighted ? '#FFFFFF' : '#64748B'}`,
              }}
            />
          </button>
        );
      })}

      <div style={{ width: 22, height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

      {clusterButton(
        onCycleMagnet,
        MAGNET_LABELS[magnetMode] || 'Magnet',
        magnetMode !== 'off',
        <Magnet size={icon} />,
        magnetColor || '#2962FF',
      )}
      {clusterButton(
        onToggleStayInDrawMode,
        stayInDrawMode ? 'Stay in Drawing Mode: ON' : 'Stay in Drawing Mode: OFF',
        stayInDrawMode,
        <Lock size={icon - 2} />,
      )}
      {clusterButton(onUndo, 'Undo (Ctrl+Z)', false, <RotateCcw size={icon - 2} />)}
      {clusterButton(onRedo, 'Redo (Ctrl+Y)', false, <RotateCw size={icon - 2} />)}
      {clusterButton(
        onToggleLockAll,
        lockAllDrawings ? 'Unlock All Objects (Alt+L)' : 'Lock All Objects (Alt+L)',
        lockAllDrawings,
        lockAllDrawings ? <Lock size={icon - 2} /> : <Unlock size={icon - 2} />,
        '#F59E0B',
      )}
      {clusterButton(
        onToggleHideAll,
        hideAllDrawings ? 'Show All Objects (Alt+H)' : 'Hide All Objects (Alt+H)',
        hideAllDrawings,
        hideAllDrawings ? <EyeOff size={icon - 2} /> : <Eye size={icon - 2} />,
        '#EF5350',
      )}
      {clusterButton(onClearAll, 'Remove All Objects (Alt+R)', false, <Trash2 size={icon - 2} />)}
      {clusterButton(
        onToggleObjectTree,
        `Object Tree (${drawingCount})`,
        showObjectTree,
        <Layers size={icon - 2} />,
        '#0EA5E9',
      )}

      <button
        type="button"
        onClick={onToggleOpen}
        title={isOpen ? 'Hide drawing tools' : 'Show drawing tools'}
        aria-label={isOpen ? 'Hide drawing tools' : 'Show drawing tools'}
        style={{
          marginTop: 'auto',
          width: btn,
          height: btn,
          borderRadius: 5,
          border: 0,
          background: 'transparent',
          color: '#64748B',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isOpen ? <X size={icon - 3} /> : <Pencil size={icon - 3} />}
      </button>

      {/* ── Tool flyout ── */}
      {activeGroup ? (
        <div
          style={{
            position: 'absolute',
            left: '100%',
            top: flyoutTop,
            width: isMobile ? 186 : 224,
            maxHeight: isMobile ? '58vh' : '72vh',
            overflowY: 'auto',
            padding: 6,
            borderRadius: '0 8px 8px 0',
            border: '1px solid rgba(148,163,184,0.18)',
            borderLeft: 0,
            background: '#111827',
            boxShadow: '0 18px 40px rgba(0,0,0,0.6)',
            zIndex: 60,
          }}
        >
          <div style={{ padding: '4px 9px 6px', color: '#64748B', fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>
            {activeGroup.label.toUpperCase()}
          </div>
          {activeGroup.tools.map((tool) => (
            <FlyoutRow
              key={tool.id}
              tool={tool}
              active={tool.id === activeTool}
              onPick={(toolId) => {
                onSelectTool(toolId);
                if (!isMobile) setOpenGroup(null);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { ICONS, ToolIcon, FlyoutRow };