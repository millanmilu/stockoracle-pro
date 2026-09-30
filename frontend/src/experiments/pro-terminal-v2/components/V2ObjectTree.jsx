// Pro Terminal V2 — Object Tree Panel

import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, Settings, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { V2_COLORS } from '../utils/constants';

const OBJECT_SECTIONS = [
  {
    id: 'indicators',
    label: 'INDICATORS',
    objects: [
      { id: 'ema_20', name: 'EMA 20', color: '#06B6D4', visible: true, locked: false },
      { id: 'ema_50', name: 'EMA 50', color: '#F97316', visible: true, locked: false },
      { id: 'ema_200', name: 'EMA 200', color: '#A855F7', visible: true, locked: false },
      { id: 'volume', name: 'Volume', color: '#6366F1', visible: true, locked: false },
      { id: 'rsi', name: 'RSI', color: '#F59E0B', visible: true, locked: false },
      { id: 'macd', name: 'MACD', color: '#3B82F6', visible: true, locked: false },
    ],
  },
  {
    id: 'drawings',
    label: 'DRAWINGS',
    objects: [], // Populated from props
  },
  {
    id: 'ai',
    label: 'AI',
    objects: [
      { id: 'ai_trend', name: 'AI Trend', color: '#10B981', visible: true, locked: false },
      { id: 'ai_sr', name: 'AI Support/Resistance', color: '#10B981', visible: true, locked: false },
      { id: 'ai_breakout', name: 'AI Breakout', color: '#10B981', visible: false, locked: false },
    ],
  },
];

export default function V2ObjectTree({ activeTab, onTabChange, drawings = [], onToggleDrawingVisibility, onRemoveDrawing }) {
  const [expanded, setExpanded] = useState({ indicators: true, drawings: true, ai: true });
  const [objects, setObjects] = useState(() => {
    const init = {};
    OBJECT_SECTIONS.forEach((s) => s.objects.forEach((o) => { init[o.id] = o; }));
    return init;
  });

  const toggleSection = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const toggleVisibility = (id) => setObjects((p) => ({ ...p, [id]: { ...p[id], visible: !p[id].visible } }));
  const toggleLock = (id) => setObjects((p) => ({ ...p, [id]: { ...p[id], locked: !p[id].locked } }));
  const removeObject = (id) => setObjects((p) => { const n = { ...p }; delete n[id]; return n; });

  // Merge drawings into objects
  const drawingObjects = drawings.map((d) => ({
    id: d.id,
    name: d.name || `Drawing ${d.id}`,
    color: '#3B82F6',
    visible: d.visible !== false,
    locked: false,
  }));

  return (
    <div style={{
      width: 200,
      background: V2_COLORS.bg.secondary,
      borderLeft: `1px solid ${V2_COLORS.bg.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${V2_COLORS.bg.border}` }}>
        {['objects', 'data'].map((tab) => (
          <button
            key={tab}
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
          {OBJECT_SECTIONS.map((section) => {
            const sectionObjects = section.id === 'drawings' ? drawingObjects : section.objects;
            return (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
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
                {expanded[section.id] && sectionObjects.map((obj) => {
                  const state = objects[obj.id] || obj;
                  return (
                    <div
                      key={obj.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px 3px 20px',
                        fontSize: 11,
                        color: state.visible ? V2_COLORS.text.secondary : V2_COLORS.text.muted,
                      }}
                    >
                      <GripVertical size={9} style={{ color: V2_COLORS.text.muted, cursor: 'grab' }} />
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: obj.color || '#3B82F6', flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{obj.name}</span>
                      <ObjectIcon icon={state.visible ? <Eye size={10} /> : <EyeOff size={10} />} onClick={() => {
                        if (section.id === 'drawings') onToggleDrawingVisibility?.(obj.id);
                        else toggleVisibility(obj.id);
                      }} title="Toggle visibility" />
                      <ObjectIcon icon={state.locked ? <Lock size={10} /> : <Unlock size={10} />} onClick={() => toggleLock(obj.id)} title="Toggle lock" />
                      <ObjectIcon icon={<Settings size={10} />} onClick={() => {}} title="Settings" />
                      <ObjectIcon icon={<Trash2 size={10} />} onClick={() => {
                        if (section.id === 'drawings') onRemoveDrawing?.(obj.id);
                        else removeObject(obj.id);
                      }} title="Delete" />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: 12, fontSize: 11, color: V2_COLORS.text.muted }}>
          <div style={{ marginBottom: 8, fontWeight: 600, color: V2_COLORS.text.secondary }}>Data Window</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <DataRow label="Symbol" value="RELIANCE" />
            <DataRow label="Price" value="₹2,874.35" />
            <DataRow label="Change" value="+0.55%" />
            <DataRow label="Volume" value="1.24M" />
            <DataRow label="RSI" value="58.2" />
            <DataRow label="MACD" value="+12.4" />
            <DataRow label="EMA 20" value="2,865.30" />
            <DataRow label="EMA 50" value="2,842.10" />
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectIcon({ icon, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: 2,
        color: V2_COLORS.text.muted,
        background: 'transparent',
        border: 'none',
        borderRadius: 3,
        cursor: 'pointer',
        display: 'flex',
      }}
    >
      {icon}
    </button>
  );
}

function DataRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: V2_COLORS.text.muted }}>{label}</span>
      <span style={{ color: V2_COLORS.text.secondary, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
