// Pro Terminal V2 — Object Tree Panel
// Sections are derived from live state: indicator/AI visibility toggles the
// chart, drawing rows mirror the drawings array, Data Window shows real values.

import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { V2_COLORS, V2_INDICATORS, V2_AI_INDICATORS } from '../utils/constants';
import { formatPrice, formatPercent, formatVolume } from '../utils/formatters';

const SECTIONS = [
  { id: 'indicators', label: 'INDICATORS' },
  { id: 'drawings', label: 'DRAWINGS' },
  { id: 'ai', label: 'AI' },
];

export default function V2ObjectTree({
  activeTab,
  onTabChange,
  drawings = [],
  activeIndicators = [],
  onToggleIndicator,
  activeAiIndicators = [],
  onToggleAiIndicator,
  onToggleDrawingVisibility,
  onToggleDrawingLock,
  onRemoveDrawing,
  dataWindow,
}) {
  const [expanded, setExpanded] = useState({ indicators: true, drawings: true, ai: true });
  const toggleSection = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const sections = {
    indicators: V2_INDICATORS
      .filter((i) => i.id !== 'ai_trend') // shown under the AI section instead
      .map((i) => ({
        id: i.id,
        name: i.name,
        color: i.color,
        visible: activeIndicators.includes(i.id),
        locked: false,
      })),
    drawings: drawings.map((d) => ({
      id: d.id,
      name: d.name || d.type,
      color: '#3B82F6',
      visible: d.visible !== false,
      locked: Boolean(d.locked),
      isDrawing: true,
    })),
    ai: V2_AI_INDICATORS.map((i) => ({
      id: i.id,
      name: i.name,
      color: '#10B981',
      visible: activeAiIndicators.includes(i.id),
      locked: false,
      isAi: true,
    })),
  };

  const handleToggleVisible = (sectionId, obj) => {
    if (sectionId === 'drawings') onToggleDrawingVisibility?.(obj.id);
    else if (sectionId === 'indicators') onToggleIndicator?.(obj.id);
    else onToggleAiIndicator?.(obj.id);
  };

  const handleDelete = (sectionId, obj) => {
    if (sectionId === 'drawings') {
      if (obj.locked) return;
      onRemoveDrawing?.(obj.id);
    } else if (sectionId === 'indicators') {
      onToggleIndicator?.(obj.id); // delete = turn the indicator off
    } else {
      onToggleAiIndicator?.(obj.id);
    }
  };

  return (
    <div className="v2-objecttree" style={{
      width: 200,
      background: V2_COLORS.bg.secondary,
      borderLeft: `1px solid ${V2_COLORS.bg.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Tabs */}
      <div role="tablist" style={{ display: 'flex', borderBottom: `1px solid ${V2_COLORS.bg.border}` }}>
        {['objects', 'data'].map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: 10,
              fontWeight: 600,
              color: activeTab === tab ? V2_COLORS.accent.primary : V2_COLORS.text.muted,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? `2px solid ${V2_COLORS.accent.primary}` : '2px solid transparent',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {tab === 'objects' ? 'Object Tree' : 'Data Window'}
          </button>
        ))}
      </div>

      {activeTab === 'objects' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {SECTIONS.map((section) => {
            const sectionObjects = sections[section.id];
            return (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={expanded[section.id]}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    width: '100%',
                    padding: '5px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    color: V2_COLORS.text.secondary,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {expanded[section.id] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  {section.label}
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: V2_COLORS.text.muted }}>
                    {sectionObjects.length}
                  </span>
                </button>
                {expanded[section.id] && sectionObjects.map((obj) => (
                  <div
                    key={obj.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px 3px 20px',
                      fontSize: 11,
                      color: obj.visible ? V2_COLORS.text.secondary : V2_COLORS.text.muted,
                    }}
                  >
                    <GripVertical size={9} aria-hidden="true" style={{ color: V2_COLORS.text.muted, cursor: 'grab' }} />
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: obj.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{obj.name}</span>
                    <ObjectIcon
                      icon={obj.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                      onClick={() => handleToggleVisible(section.id, obj)}
                      title={obj.visible ? `Hide ${obj.name}` : `Show ${obj.name}`}
                    />
                    {obj.isDrawing && (
                      <ObjectIcon
                        icon={obj.locked ? <Lock size={10} /> : <Unlock size={10} />}
                        onClick={() => onToggleDrawingLock?.(obj.id)}
                        title={obj.locked ? 'Unlock drawing' : 'Lock drawing (blocks delete)'}
                      />
                    )}
                    <ObjectIcon
                      icon={<Trash2 size={10} />}
                      onClick={() => handleDelete(section.id, obj)}
                      title={obj.locked ? 'Unlock to delete' : `Remove ${obj.name}`}
                      disabled={Boolean(obj.locked)}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: 12, fontSize: 11, color: V2_COLORS.text.muted }}>
          <div style={{ marginBottom: 8, fontWeight: 600, color: V2_COLORS.text.secondary }}>Data Window</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <DataRow label="Symbol" value={dataWindow?.symbol || '—'} />
            <DataRow label="Price" value={dataWindow?.price != null ? formatPrice(dataWindow.price) : '—'} />
            <DataRow label="Change" value={dataWindow?.changePct != null ? formatPercent(dataWindow.changePct) : '—'} />
            <DataRow label="Volume" value={dataWindow?.volume != null ? formatVolume(dataWindow.volume) : '—'} />
            <DataRow label="RSI" value={dataWindow?.rsi != null ? dataWindow.rsi.toFixed(1) : '—'} />
            <DataRow label="MACD" value={dataWindow?.macd != null ? dataWindow.macd.toFixed(2) : '—'} />
            <DataRow label="EMA 20" value={dataWindow?.ema20 != null ? formatPrice(dataWindow.ema20) : '—'} />
            <DataRow label="EMA 50" value={dataWindow?.ema50 != null ? formatPrice(dataWindow.ema50) : '—'} />
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectIcon({ icon, onClick, title, disabled = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      style={{
        padding: 2,
        color: V2_COLORS.text.muted,
        background: 'transparent',
        border: 'none',
        borderRadius: 3,
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {icon}
    </button>
  );
}

function DataRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: V2_COLORS.text.muted }}>{label}</span>
      <span style={{ color: V2_COLORS.text.secondary, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
