import React from 'react';
import { Activity, Search, Trash2, X } from 'lucide-react';
import { iconButton } from './indicatorModalStyles';

        {/* Fixed header: title + active count + close */}
export function ModalHeader({ activeCount, hiddenIndicators, onClose }) {
  return (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 46,
            padding: '0 12px',
            borderBottom: '1px solid rgba(148,163,184,0.14)',
            background: '#111827',
            flexShrink: 0,
          }}
        >
          <Activity size={16} color="#38BDF8" />
          <strong style={{ color: '#F1F5F9', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>Indicators & Studies</strong>
          <span style={{ padding: '2px 8px', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 10, color: '#7DD3FC', background: 'rgba(56,189,248,0.1)', fontSize: 10, whiteSpace: 'nowrap' }}>
            {activeCount} Active{hiddenIndicators.length > 0 && ` · ${hiddenIndicators.length} hidden`}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              type="button"
              onClick={onClose}
              title="Close indicators"
              aria-label="Close indicators"
              style={{ ...iconButton }}
              onMouseEnter={(event) => { event.currentTarget.style.color = '#F8FAFC'; }}
              onMouseLeave={(event) => { event.currentTarget.style.color = '#64748B'; }}
            >
              <X size={16} />
            </button>
          </span>
        </header>
  );
}

        {/* Search — the main focus */}
export function SearchBar({ searchInputRef, search, setSearch, highlighted }) {
  return (
        <div style={{ padding: '10px 12px 6px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} color="#64748B" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              ref={searchInputRef}
              type="search"
              autoFocus
              role="combobox"
              aria-label="Search indicators, strategies and AI"
              aria-expanded="true"
              aria-controls="indicator-browse-list"
              aria-autocomplete="list"
              aria-activedescendant={highlighted ? `indicator-option-browse-${highlighted.id}` : undefined}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="🔍 Search indicators, strategies & AI..."
              style={{ width: '100%', height: 40, boxSizing: 'border-box', padding: '0 34px 0 36px', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6, outline: 0, background: '#080B14', color: '#F8FAFC', font: '12px JetBrains Mono, monospace' }}
            />
            {search && <button type="button" onClick={() => setSearch('')} title="Clear search" aria-label="Clear search" style={{ ...iconButton, position: 'absolute', right: 4, top: 6, width: 28, height: 28 }}><X size={13} /></button>}
          </div>
        </div>
  );
}

        {/* Category tabs — mobile only; desktop uses the left sidebar */}
export function CategoryTabs({ tabs, activeCategory, categoryCount, setActiveCategory }) {
  return (
        <nav
          aria-label="Indicator categories"
          style={{
            display: 'flex',
            gap: 6,
            padding: '2px 12px 8px',
            borderBottom: '1px solid rgba(148,163,184,0.12)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flexShrink: 0,
          }}
        >
          {tabs.map((category) => {
            const selected = activeCategory === category.id;
            const count = categoryCount(category.id);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                style={{
                  height: 28,
                  padding: '0 10px',
                  border: `1px solid ${selected ? 'rgba(56,189,248,0.35)' : 'transparent'}`,
                  borderRadius: 14,
                  background: selected ? 'rgba(56,189,248,0.14)' : 'rgba(255,255,255,0.03)',
                  color: selected ? '#7DD3FC' : '#94A3B8',
                  cursor: 'pointer',
                  font: '600 10px JetBrains Mono, monospace',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {category.label} <span style={{ opacity: 0.6 }}>{count}</span>
              </button>
            );
          })}
        </nav>
  );
}

export function CategorySidebar({ tabs, activeCategory, categoryCount, setActiveCategory, activeCount, hiddenIndicators }) {
  return (
          <aside
            aria-label="Indicator categories"
            style={{
              width: 208,
              flexShrink: 0,
              overflowY: 'auto',
              padding: '10px 8px',
              borderRight: '1px solid rgba(148,163,184,0.12)',
              background: 'rgba(2,6,23,0.35)',
              scrollbarWidth: 'thin',
            }}
          >
            <div style={{ padding: '0 8px 6px', color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: 0.6 }}>LIBRARY</div>
            {tabs.map((category) => {
              const selected = activeCategory === category.id;
              const count = categoryCount(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  aria-pressed={selected}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: 32,
                    marginBottom: 2,
                    padding: '6px 10px',
                    border: `1px solid ${selected ? 'rgba(56,189,248,0.35)' : 'transparent'}`,
                    borderRadius: 6,
                    background: selected ? 'rgba(56,189,248,0.12)' : 'transparent',
                    color: selected ? '#7DD3FC' : '#94A3B8',
                    cursor: 'pointer',
                    font: '600 11px JetBrains Mono, monospace',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(148,163,184,0.08)'; }}
                  onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category.label}</span>
                  <span style={{ opacity: 0.6, fontSize: 10 }}>{count}</span>
                </button>
              );
            })}
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', color: '#64748B', fontSize: 10, lineHeight: 1.6 }}>
              <span style={{ color: '#7DD3FC', fontWeight: 700 }}>{activeCount} applied</span>
              {hiddenIndicators.length > 0 && ` · ${hiddenIndicators.length} hidden`}
              <br />ⓘ opens pipeline details
            </div>
          </aside>
  );
}

        {/* Footer */}
export function ModalFooter({ activeCount, isMobile, highlighted, highlightedActive, handleToggle, onClearAll, onClose }) {
  return (
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minHeight: 48,
            padding: '0 12px',
            borderTop: '1px solid rgba(148,163,184,0.14)',
            background: '#0A0D18',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#94A3B8', fontSize: 11, whiteSpace: 'nowrap' }}>
            {activeCount === 0 ? 'No active indicators' : `${activeCount} active indicator${activeCount === 1 ? '' : 's'}`}
          </span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              title="Remove all indicators"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 0, border: 0, background: 'transparent', color: '#F87171', cursor: 'pointer', font: '600 10px JetBrains Mono, monospace', whiteSpace: 'nowrap' }}
            >
              <Trash2 size={12} />Clear
            </button>
          )}
          {!isMobile && (
            <span style={{ marginLeft: 'auto', color: '#475569', fontSize: 10, whiteSpace: 'nowrap' }}>
              ↑↓ Navigate · Enter Add/Remove · Esc Close
            </span>
          )}
          <span style={{ marginLeft: isMobile ? 'auto' : 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => { if (highlighted && !highlightedActive) handleToggle(highlighted.id); }}
              disabled={!highlighted || highlightedActive}
              title={highlighted ? (highlightedActive ? `${highlighted.name} is already added` : `Add ${highlighted.name} to chart`) : 'Nothing to add'}
              style={{
                height: 30,
                padding: '0 14px',
                border: '1px solid rgba(56,189,248,0.4)',
                borderRadius: 4,
                background: highlighted && !highlightedActive ? 'rgba(56,189,248,0.15)' : 'transparent',
                color: highlighted && !highlightedActive ? '#7DD3FC' : '#475569',
                cursor: highlighted && !highlightedActive ? 'pointer' : 'default',
                font: '700 11px JetBrains Mono, monospace',
              }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ height: 30, padding: '0 14px', border: 0, borderRadius: 4, background: '#0EA5E9', color: '#082F49', cursor: 'pointer', font: '700 11px JetBrains Mono, monospace' }}
            >
              Done
            </button>
          </span>
        </footer>
  );
}
