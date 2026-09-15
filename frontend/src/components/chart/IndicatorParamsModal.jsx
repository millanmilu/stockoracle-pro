import React, { useMemo, useState } from 'react';
import { Check, RotateCcw, Sliders, X } from 'lucide-react';
import { getIndicator } from '../../utils/indicatorEngine';

const inputStyle = {
  width: 76,
  padding: '5px 8px',
  borderRadius: 6,
  backgroundColor: '#1E293B',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#F8FAFC',
  fontSize: '0.82rem',
  fontFamily: 'JetBrains Mono, monospace',
  textAlign: 'center',
};

/**
 * Generic indicator parameter editor driven by the modular engine's schema.
 *
 * `indicator` is a catalog definition ({ id, name, engineId, params }).
 *   - `indicator.params`  → catalog-provided concrete values (e.g. sma_100).
 *   - `overrides`         → user-applied overrides for this catalog entry.
 * The effective current value for a parameter is:
 *   user override ?? catalog value ?? engine default.
 */
export default function IndicatorParamsModal({
  indicator = null,
  overrides = {},
  onClose = () => {},
  onSave = () => {},
}) {
  const engine = useMemo(() => {
    if (!indicator) return null;
    return getIndicator(indicator.engineId || indicator.id);
  }, [indicator]);

  // Build a flat, ordered list of editable parameters with current values.
  const fields = useMemo(() => {
    if (!engine) return [];
    const catalog = indicator?.params || {};
    return Object.entries(engine.parameters).map(([key, schema]) => {
      const catalogValue = catalog[key];
      const current = overrides[key] ?? (catalogValue !== undefined ? catalogValue : schema.default);
      return { key, schema, current };
    });
  }, [engine, indicator, overrides]);

  const [draft, setDraft] = useState(() => {});
  const [errors, setErrors] = useState({});

  if (!indicator) return null;

  const hasErrors = Object.keys(errors).length > 0;

  const handleChange = (key, rawValue) => {
    setDraft((prev) => ({ ...prev, [key]: rawValue }));
    const field = fields.find((f) => f.key === key);
    if (field) {
      const { valid, message } = field.schema.validate(rawValue);
      setErrors((prev) => {
        const next = { ...prev };
        if (valid) delete next[key];
        else next[key] = message;
        return next;
      });
    }
  };

  const handleSave = () => {
    const resolved = {};
    for (const field of fields) {
      const raw = draft[field.key] ?? field.current;
      resolved[field.key] = field.schema.coerce(raw);
    }
    onSave(indicator.id, resolved);
    onClose();
  };

  const handleReset = () => {
    // Resetting removes user overrides and falls back to catalog/engine defaults.
    onSave(indicator.id, {});
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10020,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '92%',
          maxWidth: 440,
          backgroundColor: '#0F172A',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: 12,
          boxShadow: '0 20px 48px rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Sliders size={16} style={{ color: '#818CF8', flexShrink: 0 }} />
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {indicator.name}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
          {fields.length === 0 ? (
            <div style={{ fontSize: '0.76rem', color: '#64748B', padding: '8px 0' }}>No configurable parameters.</div>
          ) : (
            fields.map((field) => {
              const { key, schema, current } = field;
              const raw = draft[key] ?? current;
              const err = errors[key];
              const isSource = schema.options && schema.options.length;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00E5FF' }}>{schema.label}</div>
                    {schema.description && <div style={{ fontSize: '0.66rem', color: '#64748B', marginTop: 2 }}>{schema.description}</div>}
                    {err && <div style={{ fontSize: '0.64rem', color: '#EF5350', marginTop: 2 }}>{err}</div>}
                  </div>
                  {isSource ? (
                    <select
                      value={String(raw)}
                      onChange={(e) => handleChange(key, e.target.value)}
                      style={{ ...inputStyle, width: 92 }}
                    >
                      {schema.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={schema.min}
                      max={schema.max}
                      step={schema.step ?? 1}
                      value={raw}
                      onChange={(e) => handleChange(key, e.target.value)}
                      style={{ ...inputStyle }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <button
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '6px 12px',
              color: '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
          <button
            onClick={handleSave}
            disabled={hasErrors}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: hasErrors ? '#334155' : 'linear-gradient(135deg, #4F46E5, #6366F1)',
              border: 'none',
              borderRadius: 6,
              padding: '6px 16px',
              color: hasErrors ? '#94A3B8' : '#FFF',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: hasErrors ? 'default' : 'pointer',
            }}
          >
            <Check size={14} />
            <span>Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
}