import React, { useMemo, useState } from 'react';
import { Check, RotateCcw, Sliders, X } from 'lucide-react';
import { getIndicator } from '../../utils/indicatorEngine';
import {
  INDICATOR_VIS_INTERVALS,
  STYLE_LINE_STYLES,
  STYLE_LINE_WIDTHS,
  getFallbackInputs,
} from './indicatorSettingsSchema';

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

const COLOR_PRESETS = ['#38BDF8', '#10B981', '#F59E0B', '#EF5350', '#A855F7', '#EC4899', '#FFFFFF', '#FBBF24', '#06B6D4', '#34D399'];

/**
 * TradingView-parity indicator settings: Inputs / Style / Visibility.
 * Works for EVERY indicator — engine-backed ones use the live engine schema,
 * legacy field-based ones (SMA 20, RSI, MACD…) use fallback inputs so the
 * gear never leads to an empty panel.
 *
 * Overrides stay FLAT: plain keys = inputs, `__color` / `__lineWidth` /
 * `__lineStyle` / `__sub_{i}_color` = style, `__vis_{interval} = false` =
 * hidden on that timeframe. The engine ignores `__` keys.
 */
export default function IndicatorParamsModal({
  indicator = null,
  overrides = {},
  onClose = () => {},
  onSave = () => {},
}) {
  const [tab, setTab] = useState('inputs');

  const engine = useMemo(() => {
    if (!indicator) return null;
    return getIndicator(indicator.engineId || indicator.id);
  }, [indicator]);

  // Inputs: engine schema first, fallback schema for legacy indicators.
  const fields = useMemo(() => {
    if (!indicator) return [];
    if (engine) {
      const catalog = indicator?.params || {};
      return Object.entries(engine.parameters).map(([key, schema]) => {
        const catalogValue = catalog[key];
        const current = overrides[key] ?? (catalogValue !== undefined ? catalogValue : schema.default);
        return { key, schema, current, engine: true };
      });
    }
    const fallback = getFallbackInputs(indicator.id);
    if (fallback) {
      const catalog = indicator?.params || {};
      return fallback.map((f) => {
        const current = overrides[f.key] ?? catalog[f.key] ?? f.def;
        return {
          key: f.key,
          current,
          engine: false,
          schema: {
            label: f.label,
            min: f.min, max: f.max, step: f.step ?? 1,
            options: f.type === 'source' ? ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'] : undefined,
            description: '',
            validate: (v) => ({ valid: true }),
            coerce: (v) => (f.type === 'source' ? String(v) : Number(v)),
          },
        };
      });
    }
    return [];
  }, [engine, indicator, overrides]);

  const [draft, setDraft] = useState(() => ({}));
  const [styleDraft, setStyleDraft] = useState(() => ({}));
  const [errors, setErrors] = useState({});

  if (!indicator) return null;

  const hasErrors = Object.keys(errors).length > 0;

  const cur = (key, fb) => styleDraft[key] ?? overrides[key] ?? fb;

  const handleChange = (key, rawValue) => {
    setDraft((prev) => ({ ...prev, [key]: rawValue }));
    const field = fields.find((f) => f.key === key);
    if (field?.engine) {
      const { valid, message } = field.schema.validate(rawValue);
      setErrors((prev) => {
        const next = { ...prev };
        if (valid) delete next[key];
        else next[key] = message;
        return next;
      });
    }
  };

  const handleStyle = (key, value) => {
    setStyleDraft((prev) => ({ ...prev, [key]: value }));
  };

  const collectPatch = () => {
    const patch = { ...overrides };
    for (const field of fields) {
      const raw = draft[field.key] ?? field.current;
      patch[field.key] = field.engine ? field.schema.coerce(raw) : field.schema.coerce(raw);
    }
    for (const [k, v] of Object.entries(styleDraft)) patch[k] = v;
    return patch;
  };

  const handleSave = () => {
    onSave(indicator.id, collectPatch());
    onClose();
  };

  const handleReset = () => {
    onSave(indicator.id, {});
    onClose();
  };

  const styleColor = cur('__color', indicator.color || '#38BDF8');
  const styleWidth = cur('__lineWidth', indicator.lineWidth || 1.5);
  const styleLineStyle = cur('__lineStyle', indicator.lineStyle ?? 0);

  const subLines = indicator.subLines || indicator.levels || null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 10020, padding: 12,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '92%', maxWidth: 460, maxHeight: '88vh',
          backgroundColor: '#0F172A', border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: 12, boxShadow: '0 20px 48px rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: 'JetBrains Mono, monospace',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 0' }}>
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

        <div style={{ display: 'flex', gap: 4, padding: '10px 18px 0' }}>
          {['inputs', 'style', 'visibility'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: 'none',
                background: tab === t ? '#4F46E5' : 'rgba(255,255,255,0.05)',
                color: '#FFF', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
              }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
          {tab === 'inputs' && (
            fields.length === 0 ? (
              <div style={{ fontSize: '0.76rem', color: '#64748B', padding: '8px 0' }}>
                No numeric inputs — use Style / Visibility tabs to customize this indicator.
              </div>
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
                      <select value={String(raw)} onChange={(e) => handleChange(key, e.target.value)} style={{ ...inputStyle, width: 92 }}>
                        {schema.options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                      </select>
                    ) : (
                      <input type="number" min={schema.min} max={schema.max} step={schema.step ?? 1} value={raw}
                        onChange={(e) => handleChange(key, e.target.value)} style={{ ...inputStyle }} />
                    )}
                  </div>
                );
              })
            )
          )}

          {tab === 'style' && (
            <>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.06em' }}>LINE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.72rem', color: '#CBD5E1', minWidth: 90 }}>Color</span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {COLOR_PRESETS.map((c) => (
                    <div key={c} onClick={() => handleStyle('__color', c)} title={c}
                      style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: c, cursor: 'pointer', border: styleColor === c ? '2px solid #FFF' : '1px solid rgba(255,255,255,0.2)' }} />
                  ))}
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(styleColor) ? styleColor : '#38BDF8'}
                    onChange={(e) => handleStyle('__color', e.target.value)}
                    style={{ width: 26, height: 22, padding: 0, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, background: 'transparent', cursor: 'pointer' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.72rem', color: '#CBD5E1', minWidth: 90 }}>Width</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {STYLE_LINE_WIDTHS.map((w) => (
                    <button key={w} onClick={() => handleStyle('__lineWidth', w)}
                      style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: Number(styleWidth) === w ? '#4F46E5' : 'rgba(255,255,255,0.06)', color: '#FFF', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                      {w}px
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.72rem', color: '#CBD5E1', minWidth: 90 }}>Style</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {STYLE_LINE_STYLES.map((s) => (
                    <button key={s.id} onClick={() => handleStyle('__lineStyle', s.id)}
                      style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: Number(styleLineStyle) === s.id ? '#4F46E5' : 'rgba(255,255,255,0.06)', color: '#FFF', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {subLines && (
                <>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.06em', marginTop: 4 }}>LINES</div>
                  {subLines.map((sub, i) => {
                    const key = `__sub_${i}_color`;
                    const c = cur(key, sub.color || styleColor);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.72rem', color: '#CBD5E1', minWidth: 90 }}>{sub.label || `Line ${i + 1}`}</span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {COLOR_PRESETS.slice(0, 6).map((pc) => (
                            <div key={pc} onClick={() => handleStyle(key, pc)} title={pc}
                              style={{ width: 15, height: 15, borderRadius: '50%', backgroundColor: pc, cursor: 'pointer', border: c === pc ? '2px solid #FFF' : '1px solid rgba(255,255,255,0.2)' }} />
                          ))}
                          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#38BDF8'}
                            onChange={(e) => handleStyle(key, e.target.value)}
                            style={{ width: 24, height: 20, padding: 0, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, background: 'transparent', cursor: 'pointer' }} />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {tab === 'visibility' && (
            <>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.06em' }}>VISIBILITY — TIMEFRAMES</div>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Unchecked timeframes par indicator hide rahega (TradingView jaisa).</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {INDICATOR_VIS_INTERVALS.map((iv) => {
                  const hidden = (styleDraft[`__vis_${iv}`] ?? overrides[`__vis_${iv}`] ?? true) === false;
                  return (
                    <button key={iv} onClick={() => handleStyle(`__vis_${iv}`, hidden ? true : false)}
                      style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: hidden ? 'rgba(255,255,255,0.06)' : '#4F46E5', color: '#FFF', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', opacity: hidden ? 0.55 : 1 }}>
                      {iv}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
          <button onClick={handleReset}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 12px', color: '#94A3B8', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}>
            <RotateCcw size={13} /><span>Reset</span>
          </button>
          <button onClick={handleSave} disabled={hasErrors}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: hasErrors ? '#334155' : 'linear-gradient(135deg, #4F46E5, #6366F1)', border: 'none', borderRadius: 6, padding: '6px 16px', color: hasErrors ? '#94A3B8' : '#FFF', fontSize: '0.74rem', fontWeight: 700, cursor: hasErrors ? 'default' : 'pointer' }}>
            <Check size={14} /><span>Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
}
