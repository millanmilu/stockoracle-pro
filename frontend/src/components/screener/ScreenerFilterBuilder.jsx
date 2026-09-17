import React, { useMemo } from 'react';

/**
 * Institutional visual filter builder.
 * Builds nested AND/OR/NOT condition groups and compiles to Screener DSL.
 * Only whitelisted fields are offered; anything else is never generated.
 */

const FIELD_OPTIONS = [
  { group: 'PRICE', fields: [
    { id: 'Price', label: 'Price (₹)', type: 'number' },
    { id: 'Change1D', label: '% Change (1D)', type: 'number' },
    { id: 'Distance52WHigh', label: 'Distance from 52W High %', type: 'number' },
    { id: 'Distance52WLow', label: 'Distance from 52W Low %', type: 'number' },
    { id: 'Pos52W', label: '52W Position (0-100)', type: 'number' },
    { id: 'ATRPct', label: 'ATR %', type: 'number' },
  ]},
  { group: 'VOLUME', fields: [
    { id: 'VolumeRatio20D', label: 'Relative Volume (x)', type: 'number' },
    { id: 'VolumeBreakout', label: 'Volume Breakout (1/0)', type: 'number' },
  ]},
  { group: 'TREND', fields: [
    { id: 'EMA20', label: 'EMA 20', type: 'number' },
    { id: 'EMA50', label: 'EMA 50', type: 'number' },
    { id: 'EMA200', label: 'EMA 200', type: 'number' },
    { id: 'ADX', label: 'ADX', type: 'number' },
    { id: 'EMAAlignment', label: 'EMA Alignment', type: 'text', hint: "e.g. BULLISH_ALIGNED" },
    { id: 'Trend', label: 'Trend', type: 'text', hint: "BULLISH / BEARISH" },
  ]},
  { group: 'MOMENTUM', fields: [
    { id: 'RSI14', label: 'RSI (14)', type: 'number' },
    { id: 'MACDHist', label: 'MACD Histogram', type: 'number' },
    { id: 'StochK', label: 'Stochastic %K', type: 'number' },
    { id: 'CCI', label: 'CCI', type: 'number' },
    { id: 'ROC', label: 'ROC %', type: 'number' },
    { id: 'WilliamsR', label: 'Williams %R', type: 'number' },
    { id: 'MomentumState', label: 'Momentum State', type: 'text', hint: "STRONG / WEAK / ..." },
  ]},
  { group: 'VOLATILITY', fields: [
    { id: 'BBWidth', label: 'Bollinger Width %', type: 'number' },
    { id: 'HistVol', label: 'Hist Volatility %', type: 'number' },
  ]},
  { group: 'MARKET STRUCTURE', fields: [
    { id: 'Structure', label: 'Structure', type: 'text', hint: "HH/HL_UPTREND / ..." },
    { id: 'Regime', label: 'Regime', type: 'text', hint: "TRENDING / BREAKOUT / ..." },
    { id: 'Breakout52W', label: '52W Breakout (1/0)', type: 'number' },
    { id: 'BreakoutStrength', label: 'Breakout Strength', type: 'number' },
    { id: 'Consolidation', label: 'Consolidation (1/0)', type: 'number' },
  ]},
  { group: 'FUNDAMENTALS', fields: [
    { id: 'MarketCap', label: 'Market Cap (Cr)', type: 'number' },
    { id: 'PE', label: 'P/E', type: 'number' },
    { id: 'PB', label: 'P/B', type: 'number' },
    { id: 'ROE', label: 'ROE %', type: 'number' },
    { id: 'ROCE', label: 'ROCE %', type: 'number' },
    { id: 'DebtToEquity', label: 'Debt/Equity', type: 'number' },
    { id: 'SalesGrowth3Y', label: 'Sales Growth 3Y %', type: 'number' },
    { id: 'ProfitGrowth3Y', label: 'Profit Growth 3Y %', type: 'number' },
  ]},
  { group: 'SENTIMENT', fields: [
    { id: 'Sentiment', label: 'News Sentiment (0-100)', type: 'number' },
  ]},
  { group: 'AI', fields: [
    { id: 'AIConsensus', label: 'AI Score (0-100)', type: 'number' },
    { id: 'AIConfidence', label: 'AI Confidence', type: 'number' },
    { id: 'Confluence', label: 'Confluence (0-100)', type: 'number' },
    { id: 'RsNifty', label: 'RS vs NIFTY %', type: 'number' },
  ]},
];

const ALL_FIELDS = FIELD_OPTIONS.flatMap((g) => g.fields);
const OPERATORS = ['>', '<', '>=', '<=', '==', '!='];

let _uid = 1;
export const newCondition = () => ({ id: _uid++, field: 'RSI14', op: '<', value: '35', not: false });
export const newGroup = () => ({ id: _uid++, logic: 'AND', conditions: [newCondition()], groups: [] });

export function compileBuilderToDsl(rootGroups, topLogic = 'AND') {
  const compileCond = (c) => {
    const f = ALL_FIELDS.find((x) => x.id === c.field) || { type: 'number' };
    const val = f.type === 'text' ? `'${String(c.value).replace(/'/g, '')}'` : String(c.value);
    const expr = `${c.field} ${c.op} ${val}`;
    return c.not ? `NOT (${expr})` : expr;
  };
  const compileGroup = (g) => {
    const parts = [
      ...(g.conditions || []).map(compileCond),
      ...(g.groups || []).map(compileGroup),
    ].filter(Boolean);
    if (!parts.length) return '';
    const joined = parts.join(` ${g.logic || 'AND'} `);
    return parts.length > 1 ? `(${joined})` : joined;
  };
  const parts = (rootGroups || []).map(compileGroup).filter(Boolean);
  if (!parts.length) return 'MarketCap > 0';
  return parts.join(` ${topLogic} `);
}

export default function ScreenerFilterBuilder({ groups, setGroups, topLogic, setTopLogic }) {
  const flatFields = useMemo(() => ALL_FIELDS, []);

  const updateGroup = (gid, patch) => {
    setGroups((prev) => prev.map((g) => {
      if (g.id !== gid) {
        // nested one level
        return { ...g, groups: (g.groups || []).map((sg) => (sg.id === gid ? { ...sg, ...patch } : sg)) };
      }
      return { ...g, ...patch };
    }));
  };

  const updateCond = (gid, cid, patch) => {
    const patchGroup = (g) => {
      if (g.id === gid) {
        return { ...g, conditions: g.conditions.map((c) => (c.id === cid ? { ...c, ...patch } : c)) };
      }
      return { ...g, groups: (g.groups || []).map(patchGroup) };
    };
    setGroups((prev) => prev.map(patchGroup));
  };

  const addCondition = (gid) => {
    const patchGroup = (g) => (g.id === gid ? { ...g, conditions: [...g.conditions, newCondition()] } : { ...g, groups: (g.groups || []).map(patchGroup) });
    setGroups((prev) => prev.map(patchGroup));
  };

  const removeCondition = (gid, cid) => {
    const patchGroup = (g) => (g.id === gid ? { ...g, conditions: g.conditions.filter((c) => c.id !== cid) } : { ...g, groups: (g.groups || []).map(patchGroup) });
    setGroups((prev) => prev.map(patchGroup));
  };

  const addGroup = () => setGroups((prev) => [...prev, newGroup()]);
  const removeGroup = (gid) => setGroups((prev) => prev.filter((g) => g.id !== gid));

  const dslPreview = useMemo(() => compileBuilderToDsl(groups, topLogic), [groups, topLogic]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 800 }}>IF</span>
        <select value={topLogic} onChange={(e) => setTopLogic(e.target.value)} style={selStyle}>
          <option value="AND">ALL groups (AND)</option>
          <option value="OR">ANY group (OR)</option>
        </select>
        <button type="button" onClick={addGroup} style={miniBtn}>+ Group</button>
      </div>

      {(groups || []).map((g, gi) => (
        <div key={g.id} style={{ border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: 10, background: 'rgba(99,102,241,0.05)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.66rem', color: '#A5B4FC', fontWeight: 800 }}>GROUP {gi + 1}</span>
            <select value={g.logic} onChange={(e) => updateGroup(g.id, { logic: e.target.value })} style={selStyle}>
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
            <button type="button" onClick={() => addCondition(g.id)} style={miniBtn}>+ Condition</button>
            <button type="button" onClick={() => removeGroup(g.id)} style={{ ...miniBtn, color: '#F87171' }}>Remove</button>
          </div>
          {(g.conditions || []).map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" title="NOT" onClick={() => updateCond(g.id, c.id, { not: !c.not })} style={{ ...miniBtn, background: c.not ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.04)', color: c.not ? '#F87171' : '#94A3B8' }}>NOT</button>
              <select value={c.field} onChange={(e) => updateCond(g.id, c.id, { field: e.target.value })} style={{ ...selStyle, minWidth: 170 }}>
                {FIELD_OPTIONS.map((fg) => (
                  <optgroup key={fg.group} label={fg.group}>
                    {fg.fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <select value={c.op} onChange={(e) => updateCond(g.id, c.id, { op: e.target.value })} style={selStyle}>
                {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <input value={c.value} onChange={(e) => updateCond(g.id, c.id, { value: e.target.value })} placeholder="value" style={{ ...selStyle, width: 110 }} />
              <button type="button" onClick={() => removeCondition(g.id, c.id)} style={{ ...miniBtn, color: '#F87171' }}>×</button>
            </div>
          ))}
        </div>
      ))}

      <div style={{ background: '#060913', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '8px 10px' }}>
        <div style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 800, marginBottom: 4 }}>THEN — COMPILED DSL (THEN show matching stocks)</div>
        <div style={{ fontSize: '0.7rem', color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-word' }}>{dslPreview}</div>
      </div>
    </div>
  );
}

const selStyle = { background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 8px', color: '#F1F5F9', fontSize: '0.7rem', outline: 'none' };
const miniBtn = { padding: '3px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', fontSize: '0.66rem', cursor: 'pointer', fontWeight: 700 };
