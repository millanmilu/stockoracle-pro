import React, { useId, useState } from 'react';
import { Info, Eye, EyeOff } from 'lucide-react';

/* ─── Field Row Component ─────────────────────────────────────────────────────── */
export default function FieldRow({ field, value, onChange }) {
  const [show, setShow] = useState(false);
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const isPass = field.type === 'password';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <label htmlFor={inputId} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#CBD5E1' }}>{field.label}</label>
        <div title={field.help} style={{ cursor: 'help', color: '#6366F1' }}>
          <Info size={11} />
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          type={isPass && !show ? 'password' : 'text'}
          value={value || ''}
          onChange={e => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          aria-describedby={helpId}
          autoComplete="off"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(15,23,42,0.8)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 8, padding: '9px 36px 9px 12px',
            color: '#F1F5F9', fontSize: '0.82rem',
            fontFamily: 'JetBrains Mono, monospace',
            outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
          onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.25)'}
        />
        {isPass && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            aria-label={`${show ? 'Hide' : 'Show'} ${field.label}`}
            aria-pressed={show}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 2,
            }}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      <div id={helpId} style={{ fontSize: '0.65rem', color: '#64748B', marginTop: 3 }}>{field.help}</div>
    </div>
  );
}
