import React, { useEffect, useRef, useState } from 'react';
import { Code2, Save, Trash2, X } from 'lucide-react';
import { validateCustomIndicatorScript } from '../../utils/customIndicatorEngine';

const STARTER_SCRIPT = `//@version=1
indicator("EMA Pair", overlay=true)
fastLen = input.int(9, "Fast length", minval=1)
slowLen = input.int(21, "Slow length", minval=1)
plot(ta.ema(close, fastLen), title="Fast EMA", color="#2962FF")
plot(ta.ema(close, slowLen), title="Slow EMA", color="#F59E0B")`;

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid rgba(148,163,184,0.25)',
  borderRadius: 5,
  background: '#080B14',
  color: '#F8FAFC',
  padding: '9px 10px',
  font: '12px JetBrains Mono, monospace',
};

export default function CustomIndicatorEditor({ indicator = null, onSave, onDelete, onClose }) {
  const [name, setName] = useState(indicator?.name || 'My Indicator');
  const [script, setScript] = useState(indicator?.customScript || STARTER_SCRIPT);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const dialogRef = useRef(null);
  const validation = validateCustomIndicatorScript(script);
  const nameValid = name.trim().length > 0 && name.trim().length <= 60;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const inside = dialogRef.current.contains(document.activeElement);
          if (event.shiftKey && (!inside || document.activeElement === first)) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
            event.preventDefault();
            first.focus();
          }
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && validation.valid && nameValid) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onSave({ id: indicator?.id, name, customScript: script });
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [indicator, name, nameValid, onClose, onSave, script, validation.valid]);

  const save = () => {
    if (!validation.valid || !nameValid) return;
    onSave({ id: indicator?.id, name, customScript: script });
    onClose();
  };

  const remove = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    onDelete(indicator.id);
    onClose();
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(2,6,23,0.82)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={indicator ? 'Edit custom indicator' : 'Create custom indicator'}
        onClick={(event) => event.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 'min(900px, 100%)',
          maxHeight: '92vh',
          overflow: 'hidden',
          border: '1px solid rgba(148,163,184,0.25)',
          borderRadius: 8,
          background: '#0E1322',
          boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
          color: '#E2E8F0',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>
          <Code2 size={17} color="#38BDF8" />
          <strong style={{ flex: 1, fontSize: 13 }}>{indicator ? 'Edit custom indicator' : 'Create custom indicator'}</strong>
          <button type="button" onClick={onClose} aria-label="Close script editor" style={{ ...fieldStyle, width: 30, height: 30, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: 16, overflow: 'auto' }}>
          <label style={{ display: 'block', marginBottom: 13, color: '#94A3B8', fontSize: 10, fontWeight: 700 }}>
            INDICATOR NAME
            <input
              autoFocus
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              style={{ ...fieldStyle, display: 'block', marginTop: 5 }}
            />
          </label>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: 10, fontWeight: 700 }}>
            SCRIPT
            <textarea
              spellCheck="false"
              aria-label="Indicator script"
              value={script}
              onChange={(event) => setScript(event.target.value)}
              style={{
                ...fieldStyle,
                display: 'block',
                minHeight: 270,
                marginTop: 5,
                resize: 'vertical',
                lineHeight: 1.65,
                tabSize: 2,
              }}
            />
          </label>
          <div style={{ marginTop: 9, padding: '10px 12px', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 5, background: 'rgba(56,189,248,0.05)', color: '#94A3B8', fontSize: 10, lineHeight: 1.7 }}>
            <strong style={{ color: '#7DD3FC' }}>Supported subset</strong>
            <div>OHLCV sources, assignments, arithmetic, comparisons, fixed-default numeric inputs, and up to 6 plot() lines.</div>
            <div>Functions: ta.sma(), ta.ema(), ta.rsi(), math.abs/min/max/sqrt/log/exp/round/floor/ceil.</div>
            <div>Scripts run locally in a restricted parser; JavaScript and unsupported Pine features are not executed.</div>
          </div>
          <div role="status" aria-live="polite" style={{ minHeight: 19, marginTop: 10, color: validation.valid ? '#34D399' : '#FCA5A5', fontSize: 10 }}>
            {!nameValid ? 'Enter a name between 1 and 60 characters.' : validation.valid ? 'Script valid' : validation.error}
          </div>
        </div>

        <footer style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderTop: '1px solid rgba(148,163,184,0.16)' }}>
          {indicator && (
            <button type="button" onClick={remove} style={{ ...fieldStyle, width: 'auto', color: deleteConfirm ? '#FCA5A5' : '#94A3B8', cursor: 'pointer' }}>
              <Trash2 size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {deleteConfirm ? 'Confirm delete' : 'Delete'}
            </button>
          )}
          {deleteConfirm && <span style={{ color: '#FCA5A5', fontSize: 10 }}>Delete this saved script?</span>}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={save} disabled={!validation.valid || !nameValid} style={{ ...fieldStyle, width: 'auto', borderColor: 'rgba(56,189,248,0.4)', background: '#075985', color: '#F8FAFC', cursor: validation.valid && nameValid ? 'pointer' : 'not-allowed', opacity: validation.valid && nameValid ? 1 : 0.5 }}>
            <Save size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Save & Add
          </button>
        </footer>
      </section>
    </div>
  );
}
