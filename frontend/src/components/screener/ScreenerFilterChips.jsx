import { Save } from 'lucide-react';
import { TN, panel, sectionTitle, chip, btn } from './terminalTheme';

// Active filter chips — compact, one row, never overlaps tabs
export function ScreenerFilterChips({ activeChips, visibleChips, removeChip, showAllChips, setShowAllChips, setShowSaveModal, handleResetFilters }) {
  return (
      <div style={panel({ padding: '6px 10px', display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', width: '100%', minWidth: 0, boxSizing: 'border-box' })} className="tn-no-scrollbar">
        <span style={sectionTitle({ whiteSpace: 'nowrap', flexShrink: 0 })}>Active filters ({activeChips.length})</span>
        {visibleChips.map((c, i) => (
          <span key={i} style={chip('default', { flexShrink: 0 })}>
            {c}
            <button onClick={() => removeChip(c)} title={`Remove filter: ${c}`} aria-label={`Remove filter ${c}`} style={{ background: 'transparent', border: 'none', color: TN.down, cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
        {activeChips.length > 5 && (
          <button onClick={() => setShowAllChips((v) => !v)} style={{ fontSize: 11, color: TN.accent, background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {showAllChips ? 'Show less' : `+${activeChips.length - 5} more`}
          </button>
        )}
        <span style={{ flex: '1 0 8px' }} />
        <button onClick={() => setShowSaveModal(true)} title="Save this screen" style={{ ...btn(), height: 24, fontSize: 11, flexShrink: 0 }}><Save size={12} /> Save Screen</button>
        <button onClick={handleResetFilters} style={{ fontSize: 11, color: TN.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', flexShrink: 0 }}>Clear all</button>
      </div>
  );
}
