// Pro Terminal V2 — Screener Panel

import React, { useState } from 'react';
import { Plus, Play, Save, Filter, X, Check } from 'lucide-react';
import { V2_COLORS } from '../utils/constants';
import { mockFilterFields, mockScreenerResults } from '../data/mockScreener';
import V2ScreenerTable from './V2ScreenerTable';

export default function V2Screener({
  filters,
  onAddFilter,
  onRemoveFilter,
  results,
  scanning = false,
  onScan,
  onSaveFilters,
  onOpenSymbol,
  watchlist,
  onToggleWatchlist,
}) {
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [newFilterField, setNewFilterField] = useState('');
  const [newFilterOp, setNewFilterOp] = useState('>');
  const [newFilterValue, setNewFilterValue] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const handleAddFilter = () => {
    if (!newFilterField || newFilterValue === '') return;
    const field = mockFilterFields.find((f) => f.id === newFilterField);
    onAddFilter({
      field: newFilterField,
      label: `${field?.label || newFilterField} ${newFilterOp} ${newFilterValue}${field?.unit || ''}`,
      operator: newFilterOp,
      value: Number(newFilterValue),
    });
    setNewFilterField('');
    setNewFilterValue('');
    setShowFilterBuilder(false);
  };

  const handleSaveFilters = () => {
    if (onSaveFilters?.()) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: V2_COLORS.bg.secondary,
        borderBottom: `1px solid ${V2_COLORS.bg.border}`,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: V2_COLORS.text.secondary }}>
          <Filter size={12} />
          <span>Filters:</span>
        </div>

        {filters.map((filter) => (
          <div key={filter.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: 4,
            fontSize: 10,
            color: V2_COLORS.accent.primary,
          }}>
            <span>{filter.label}</span>
            <button
              onClick={() => onRemoveFilter(filter.id)}
              aria-label={`Remove filter ${filter.label}`}
              style={{
                background: 'transparent',
                border: 'none',
                color: V2_COLORS.text.muted,
                cursor: 'pointer',
                fontSize: 10,
                padding: 0,
                display: 'flex',
              }}><X size={10} /></button>
          </div>
        ))}

        <button
          onClick={() => setShowFilterBuilder(!showFilterBuilder)}
          aria-expanded={showFilterBuilder}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            fontSize: 10,
            color: V2_COLORS.text.secondary,
            background: 'transparent',
            border: `1px solid ${V2_COLORS.bg.border}`,
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          <Plus size={11} />
          Add Filter
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: V2_COLORS.text.muted }}>
            {results.length} / {mockScreenerResults.length} stocks
          </span>
          <button
            onClick={() => onScan?.()}
            disabled={scanning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              background: V2_COLORS.accent.primary,
              border: 'none',
              borderRadius: 4,
              cursor: scanning ? 'wait' : 'pointer',
              opacity: scanning ? 0.7 : 1,
            }}
          >
            <Play size={11} />
            {scanning ? 'Scanning…' : 'Scan'}
          </button>
          <button
            onClick={handleSaveFilters}
            aria-label="Save filter set"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: 11,
              color: savedFlash ? V2_COLORS.positive : V2_COLORS.text.secondary,
              background: 'transparent',
              border: `1px solid ${V2_COLORS.bg.border}`,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {savedFlash ? <Check size={11} /> : <Save size={11} />}
            {savedFlash ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Filter builder */}
      {showFilterBuilder && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: V2_COLORS.bg.elevated,
          borderBottom: `1px solid ${V2_COLORS.bg.border}`,
        }}>
          <select
            value={newFilterField}
            onChange={(e) => setNewFilterField(e.target.value)}
            aria-label="Filter field"
            style={{
              padding: '4px 8px',
              fontSize: 11,
              color: V2_COLORS.text.primary,
              background: V2_COLORS.bg.tertiary,
              border: `1px solid ${V2_COLORS.bg.border}`,
              borderRadius: 4,
            }}
          >
            <option value="">Select field...</option>
            {mockFilterFields.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <select
            value={newFilterOp}
            onChange={(e) => setNewFilterOp(e.target.value)}
            aria-label="Filter operator"
            style={{
              padding: '4px 8px',
              fontSize: 11,
              color: V2_COLORS.text.primary,
              background: V2_COLORS.bg.tertiary,
              border: `1px solid ${V2_COLORS.bg.border}`,
              borderRadius: 4,
            }}
          >
            <option value=">">{'>'}</option>
            <option value="<">{'<'}</option>
            <option value="=">{'='}</option>
          </select>
          <input
            type="number"
            value={newFilterValue}
            onChange={(e) => setNewFilterValue(e.target.value)}
            placeholder="Value"
            aria-label="Filter value"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddFilter(); }}
            style={{
              width: 80,
              padding: '4px 8px',
              fontSize: 11,
              color: V2_COLORS.text.primary,
              background: V2_COLORS.bg.tertiary,
              border: `1px solid ${V2_COLORS.bg.border}`,
              borderRadius: 4,
            }}
          />
          <button onClick={handleAddFilter} style={{
            padding: '4px 10px',
            fontSize: 11,
            color: '#fff',
            background: V2_COLORS.accent.primary,
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}>Add</button>
        </div>
      )}

      {/* Results table */}
      <V2ScreenerTable
        results={results}
        onOpenSymbol={onOpenSymbol}
        watchlist={watchlist}
        onToggleWatchlist={onToggleWatchlist}
      />
    </div>
  );
}
