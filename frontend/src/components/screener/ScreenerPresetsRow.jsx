import { NO_OP_QUERY, PREBUILT_SCREENS } from './screenerColumns';
import { TN, panel, sectionTitle } from './terminalTheme';

const quickPills = [
  { id: 'all-nse', name: 'All NSE Equities', query: NO_OP_QUERY },
  { id: 'high-roce', name: 'High ROCE (>20%)', query: 'ROCE > 20 AND DebtToEquity < 0.5' },
  { id: 'value-growth', name: 'Growth at Fair Value', query: 'ROCE > 18 AND PE < 28 AND DebtToEquity < 1.0' },
  { id: 'oversold', name: 'Oversold Momentum', query: 'RSI14 < 40 AND VolumeRatio20D > 1.1' },
  { id: 'ai-bulls', name: 'AI High Consensus', query: 'AIConsensus > 75 AND VolumeRatio20D > 1.0' },
  { id: 'low-debt', name: 'Low Debt Quality', query: 'DebtToEquity < 0.2 AND ROCE > 15' },
];

const pill = (active) => ({ padding: '3px 10px', borderRadius: 3, background: active ? 'rgba(124,140,248,0.14)' : 'rgba(148,163,184,0.05)', border: active ? '1px solid rgba(124,140,248,0.5)' : `1px solid ${TN.border}`, color: active ? TN.accent : TN.muted, fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 });

// Presets incl. 13 institutional templates
export function ScreenerPresetsRow({ prebuiltTemplates, savedScreens, activePresetId, applyPreset, handleCopyShareLink, handleDeleteScreen }) {
  return (
      <div style={panel({ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 7 })}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={sectionTitle()}>Screen presets</span>
          <span style={{ fontSize: 11, color: TN.faint }}>
            {quickPills.length + (prebuiltTemplates.length || PREBUILT_SCREENS.length) + savedScreens.length} saved views — one click applies the full filter set
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {quickPills.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id, p.query, p.name)} style={pill(activePresetId === p.id)}>{p.name}</button>
          ))}
          {(prebuiltTemplates.length ? prebuiltTemplates : PREBUILT_SCREENS.map((t) => ({ id: t.id, name: t.name, formula_query: t.query }))).map(tpl => (
            <button key={tpl.id} onClick={() => applyPreset(tpl.id, tpl.formula_query, tpl.name)} style={pill(activePresetId === tpl.id)}>{tpl.name}</button>
          ))}
          {savedScreens.map(s => (
            <span key={`saved-${s.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
              <button
                onClick={() => applyPreset(`saved-${s.id}`, s.formula_query, s.name, { universe: s.universe, sort_by: s.sort_by, sort_dir: s.sort_dir })}
                style={{ ...pill(activePresetId === `saved-${s.id}`), borderStyle: 'dashed', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                title={`${s.formula_query}${s.universe ? ` · universe ${s.universe}` : ''}${s.sort_by ? ` · ${s.sort_by} ${s.sort_dir}` : ''}`}
              >
                {s.name}
              </button>
              {/* Restore-universe/sort + share + delete: the backend already
                  returned all of this, but no control ever surfaced it. */}
              {s.share_token && (
                <button
                  type="button"
                  onClick={() => handleCopyShareLink(s.share_token)}
                  title="Copy public share link"
                  aria-label={`Copy share link for ${s.name}`}
                  style={{ ...pill(false), borderStyle: 'dashed', borderLeft: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: '3px 6px' }}
                >
                  🔗
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDeleteScreen(s.id, s.name)}
                title="Delete this saved screen"
                aria-label={`Delete ${s.name}`}
                style={{ ...pill(false), borderStyle: 'dashed', borderLeft: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: '3px 6px' }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>
  );
}
