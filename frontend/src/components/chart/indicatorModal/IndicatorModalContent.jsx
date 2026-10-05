import React from 'react';
import { Check, Plus } from 'lucide-react';
import { cardGrid } from './indicatorModalStyles';
import IndicatorRow from './IndicatorRow';

const renderSectionHeader = (label, count, hint) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '10px 0 6px' }}>
      <span style={{ color: '#7DD3FC', fontSize: 10, fontWeight: 700, letterSpacing: 0.6 }}>{label}</span>
      {count != null && <span style={{ color: '#475569', fontSize: 10 }}>{count}</span>}
      {hint && <span style={{ color: '#475569', fontSize: 10 }}>{hint}</span>}
    </div>
);

export default function IndicatorModalContent({
  listRef,
  activeDefinitions,
  recentDefinitions,
  filtered,
  splitAI,
  aiItems,
  normalItems,
  activeById,
  handleToggle,
  query,
  search,
  activeCategory,
  categoryLabel,
  emptyMessage,
  onClearAll,
  displayOrder,
  rowProps,
}) {
  // Browse rows need display-order indexes (AI section renders first on "All")
  // so keyboard highlight tracks the visual order.
  const browseIndexOf = (indicator) => displayOrder.indexOf(indicator);

  return (
        <div
          className="indicator-modal-list"
          ref={listRef}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflowY: 'auto',
            padding: '6px 14px 12px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(100,116,139,0.5) transparent',
          }}
        >
          {/* Applied indicators — rows here are managed via eye / gear / ✕ only */}
          {activeDefinitions.length > 0 && (
            <section role="listbox" aria-label="Applied indicators" style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0' }}>
                <span style={{ color: '#7DD3FC', fontSize: 10, fontWeight: 700, letterSpacing: 0.6 }}>APPLIED ({activeDefinitions.length})</span>
                {activeDefinitions.length > 1 && (
                  <button type="button" onClick={onClearAll} style={{ background: 'transparent', border: 0, color: '#F87171', cursor: 'pointer', font: '600 10px JetBrains Mono, monospace' }}>Remove All</button>
                )}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
              {activeDefinitions.map((indicator) => (<IndicatorRow {...rowProps} key={indicator.id} indicator={indicator} index={-1} isActiveSection />))}
              </div>
            </section>
          )}

          {/* Recently used — only when browsing without a query */}
          {!query && activeCategory === 'all' && recentDefinitions.length > 0 && (
            <section aria-label="Recently used indicators">
              {renderSectionHeader('RECENTLY USED', recentDefinitions.length, '· pick up where you left off')}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {recentDefinitions.map((indicator) => {
                  const active = activeById.has(indicator.id);
                  return (
                    <button
                      key={indicator.id}
                      type="button"
                      onClick={() => handleToggle(indicator.id)}
                      title={indicator.description}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 28,
                        padding: '0 10px',
                        border: `1px solid ${active ? 'rgba(52,211,153,0.4)' : 'rgba(148,163,184,0.2)'}`,
                        borderRadius: 14,
                        background: active ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.03)',
                        color: active ? '#6EE7B7' : '#CBD5E1',
                        cursor: 'pointer',
                        font: '600 10px JetBrains Mono, monospace',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: indicator.color }} />
                      {active ? <Check size={11} /> : <Plus size={11} />}
                      {indicator.shortName || indicator.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Browse catalog */}
          {splitAI ? (
            <>
              <section aria-label="AI indicators">
                {renderSectionHeader(`🤖 AI INDICATORS`, `${aiItems.length}`, '· inputs → model → outputs + confidence')}
                <div id="indicator-ai-list" role="listbox" aria-label="AI indicator catalog" style={cardGrid}>
                  {aiItems.map((indicator) => (<IndicatorRow {...rowProps} key={indicator.id} indicator={indicator} index={browseIndexOf(indicator)} />))}
                </div>
              </section>
              <section aria-label="All indicators">
                {renderSectionHeader('ALL INDICATORS', `${normalItems.length} shown`, '· TradingView-style catalog')}
                <div id="indicator-browse-list" role="listbox" aria-label="Indicator catalog" style={cardGrid}>
                  {normalItems.map((indicator) => (<IndicatorRow {...rowProps} key={indicator.id} indicator={indicator} index={browseIndexOf(indicator)} />))}
                </div>
              </section>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0 6px' }}>
                <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, letterSpacing: 0.6 }}>
                  {activeCategory === 'favorites' ? 'FAVORITES' : activeCategory === 'ai' ? '🤖 AI INDICATORS' : activeCategory === 'all' ? 'ALL INDICATORS' : categoryLabel(activeCategory).toUpperCase()}
                  {query && ` · "${search.trim()}"`}
                  <span style={{ marginLeft: 6, color: '#475569' }}>{filtered.length} shown</span>
                </span>
              </div>
              {filtered.length === 0 && (
                <div style={{ padding: '28px 8px', color: '#64748B', fontSize: 12, textAlign: 'center' }}>{emptyMessage}</div>
              )}
              <div id="indicator-browse-list" role="listbox" aria-label="Indicator catalog" style={cardGrid}>
                {filtered.map((indicator) => (<IndicatorRow {...rowProps} key={indicator.id} indicator={indicator} index={browseIndexOf(indicator)} />))}
              </div>
            </>
          )}
        </div>
  );
}
