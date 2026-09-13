import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Check, Search, Trash2, X } from 'lucide-react';
import { INDICATOR_CATEGORIES, INDICATOR_DEFINITIONS } from './indicatorDefinitions';

const shell = {
  width: 'min(600px, calc(100vw - 24px))',
  height: 'min(74vh, 640px)',
  maxHeight: '74vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: '#0E1322',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: 8,
  boxShadow: '0 24px 48px rgba(0, 0, 0, 0.78)',
  fontFamily: 'JetBrains Mono, monospace',
};

const iconButton = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  color: '#64748B',
  cursor: 'pointer',
};

export default function IndicatorModal({
  isOpen = false,
  onClose = () => {},
  activeIndicators = [],
  onToggleIndicator = () => {},
  onClearAll = () => {},
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return INDICATOR_DEFINITIONS.filter((indicator) => {
      const matchesCategory = activeCategory === 'all' || indicator.category === activeCategory;
      const matchesSearch = !query || [indicator.name, indicator.shortName, indicator.description]
        .some(value => value.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [activeCategory, search]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex(index => Math.min(index + 1, Math.max(0, filtered.length - 1)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex(index => Math.max(0, index - 1));
      } else if (event.key === 'Enter' && filtered[highlightedIndex]) {
        event.preventDefault();
        onToggleIndicator(filtered[highlightedIndex].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, highlightedIndex, isOpen, onClose, onToggleIndicator]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        background: 'rgba(5, 7, 13, 0.78)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Technical Indicators and Studies" onClick={event => event.stopPropagation()} style={shell}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 42, padding: '0 12px', borderBottom: '1px solid rgba(148,163,184,0.14)', background: '#111827' }}>
          <Activity size={16} color="#38BDF8" />
          <strong style={{ color: '#F1F5F9', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>Technical Indicators &amp; Studies</strong>
          <span style={{ padding: '2px 6px', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 8, color: '#7DD3FC', background: 'rgba(56,189,248,0.1)', fontSize: 10, whiteSpace: 'nowrap' }}>{activeIndicators.length} Active</span>
          <button type="button" onClick={onClose} title="Close indicators" aria-label="Close indicators" style={{ ...iconButton, marginLeft: 'auto' }} onMouseEnter={event => { event.currentTarget.style.color = '#F8FAFC'; }} onMouseLeave={event => { event.currentTarget.style.color = '#64748B'; }}><X size={16} /></button>
        </header>

        <div style={{ padding: '8px 12px 5px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#64748B" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input
              ref={searchInputRef}
              type="search"
              autoFocus
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search indicators (e.g. RSI, SMA, Bollinger, VWAP)..."
              style={{ width: '100%', height: 34, boxSizing: 'border-box', padding: '0 30px', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 5, outline: 0, background: '#080B14', color: '#F8FAFC', font: '12px JetBrains Mono, monospace' }}
            />
            {search && <button type="button" onClick={() => setSearch('')} title="Clear search" aria-label="Clear search" style={{ ...iconButton, position: 'absolute', right: 3, top: 3, width: 28, height: 28 }}><X size={13} /></button>}
          </div>
        </div>

        <nav aria-label="Indicator categories" style={{ display: 'flex', gap: 4, padding: '2px 12px 7px', borderBottom: '1px solid rgba(148,163,184,0.12)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {INDICATOR_CATEGORIES.map(category => {
            const selected = activeCategory === category.id;
            return <button key={category.id} type="button" onClick={() => setActiveCategory(category.id)} style={{ height: 26, padding: '0 8px', border: `1px solid ${selected ? 'rgba(56,189,248,0.32)' : 'transparent'}`, borderRadius: 4, background: selected ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.03)', color: selected ? '#7DD3FC' : '#94A3B8', cursor: 'pointer', font: '600 10px JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{category.label.replace(' & MAs', '').replace(' & Pivots', '')}</button>;
          })}
        </nav>

        <div className="indicator-modal-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 12px 8px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(100,116,139,0.5) transparent' }}>
          {filtered.length === 0 ? <div style={{ padding: '28px 8px', color: '#64748B', fontSize: 12, textAlign: 'center' }}>No indicators matching &quot;{search}&quot;</div> : filtered.map((indicator, index) => {
            const active = activeIndicators.includes(indicator.id);
            const highlighted = index === highlightedIndex;
            return <div
              key={indicator.id}
              role="option"
              aria-selected={active}
              title={indicator.description}
              onClick={() => onToggleIndicator(indicator.id)}
              onMouseEnter={() => setHighlightedIndex(index)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 54, marginBottom: 4, padding: '6px 8px', border: `1px solid ${active ? 'rgba(56,189,248,0.28)' : highlighted ? 'rgba(148,163,184,0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 5, background: active ? 'rgba(56,189,248,0.08)' : highlighted ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.52)', cursor: 'pointer' }}
            >
              <span style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${active ? '#38BDF8' : 'rgba(100,116,139,0.5)'}`, borderRadius: 3, background: active ? '#0891B2' : 'transparent' }}>{active && <Check size={12} color="#fff" strokeWidth={3} />}</span>
              <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', background: indicator.color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#F1F5F9', fontSize: 12, fontWeight: 650 }}>{indicator.name}</strong>
                  <span style={{ flexShrink: 0, padding: '2px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: '#94A3B8', fontSize: 9 }}>{indicator.badge}</span>
                </div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2, color: '#64748B', fontSize: 10 }}>{indicator.description}</div>
              </div>
              <span style={{ flexShrink: 0, padding: '3px 6px', borderRadius: 4, color: active ? '#7DD3FC' : '#94A3B8', background: active ? 'rgba(56,189,248,0.12)' : 'transparent', fontSize: 9, fontWeight: 700 }}>{active ? 'ACTIVE' : '+ ADD'}</span>
            </div>;
          })}
        </div>

        <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, padding: '0 12px', borderTop: '1px solid rgba(148,163,184,0.14)', background: '#0A0D18' }}>
          <button type="button" onClick={onClearAll} disabled={activeIndicators.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: 0, border: 0, background: 'transparent', color: activeIndicators.length ? '#F87171' : '#475569', cursor: activeIndicators.length ? 'pointer' : 'default', font: '600 11px JetBrains Mono, monospace' }}><Trash2 size={13} />Clear All ({activeIndicators.length})</button>
          <button type="button" onClick={onClose} style={{ height: 30, padding: '0 12px', border: 0, borderRadius: 4, background: '#0EA5E9', color: '#082F49', cursor: 'pointer', font: '700 11px JetBrains Mono, monospace' }}>Done</button>
        </footer>
      </div>
    </div>
  );
}
