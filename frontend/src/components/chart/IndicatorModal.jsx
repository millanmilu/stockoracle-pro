import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Check, Eye, EyeOff, Search, Settings2, Star, Trash2, X } from 'lucide-react';
import { INDICATOR_CATEGORIES, INDICATOR_DEFINITIONS } from './indicatorDefinitions';

const shell = {
  width: 'min(680px, calc(100vw - 24px))',
  height: 'min(78vh, 720px)',
  maxHeight: '78vh',
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

const FAVORITES_KEY = 'stockoracle_favorite_indicators';

/**
 * Favorites are pruned against the live catalog on load so an id that was
 * renamed or removed can never leave the ★ Favorites tab claiming a non-zero
 * count while rendering an empty list.
 */
function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const known = new Set(INDICATOR_DEFINITIONS.map((indicator) => indicator.id));
    return parsed.filter((id) => known.has(id));
  } catch {
    return [];
  }
}

export default function IndicatorModal({
  isOpen = false,
  onClose = () => {},
  activeIndicators = [],
  hiddenIndicators = [],
  onToggleIndicator = () => {},
  onToggleHideIndicator = () => {},
  onRemoveIndicator = () => {},
  onClearAll = () => {},
  onOpenSettings = () => {},
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const activeById = useMemo(() => new Set(activeIndicators), [activeIndicators]);
  const hiddenById = useMemo(() => new Set(hiddenIndicators), [hiddenIndicators]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const tabs = useMemo(() => [
    { id: 'favorites', label: '★ Favorites' },
    ...INDICATOR_CATEGORIES,
  ], []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = INDICATOR_DEFINITIONS.filter((indicator) => {
      const matchesCategory = activeCategory === 'all' || indicator.category === activeCategory;
      const matchesSearch = !query || [indicator.name, indicator.shortName, indicator.description, indicator.badge]
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });

    if (activeCategory === 'favorites') {
      list = list.filter((indicator) => favorites.includes(indicator.id));
    }

    // Favorites float to the top when browsing "All".
    if (activeCategory === 'all') {
      const fav = list.filter((i) => favorites.includes(i.id));
      const rest = list.filter((i) => !favorites.includes(i.id));
      list = [...fav, ...rest];
    }
    return list;
  }, [activeCategory, search, favorites]);

  const activeDefinitions = useMemo(() => {
    return activeIndicators
      .map((id) => INDICATOR_DEFINITIONS.find((item) => item.id === id))
      .filter(Boolean);
  }, [activeIndicators]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [activeCategory, search]);

  // A fresh open always starts clean: no stale search text and no highlight
  // resuming on a row that is no longer on screen.
  useEffect(() => {
    if (!isOpen) return undefined;
    setSearch('');
    setHighlightedIndex(0);
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  // Keep the keyboard-highlighted browse row inside the scroll viewport
  // (arrow navigation previously highlighted off-screen rows invisibly).
  useEffect(() => {
    if (!isOpen) return;
    const row = listRef.current?.querySelector(`[data-browse-index="${highlightedIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen, filtered]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      // Tab must never escape the dialog — the background is visually blocked by
      // the overlay, so focus landing out there reads as a frozen UI.
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length > 0) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const current = document.activeElement;
          const inside = dialogRef.current.contains(current);
          if (event.shiftKey && (!inside || current === first)) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (!inside || current === last)) {
            event.preventDefault();
            first.focus();
          }
        }
        return;
      }
      if (event.key === 'Escape') {
        onClose();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        // Registered in the capture phase because App.jsx listens for Ctrl+K on
        // window too (Command Palette). Without claiming the key here, the
        // palette would open *behind* this modal and steal focus to a hidden input.
        event.preventDefault();
        event.stopImmediatePropagation();
        searchInputRef.current?.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((index) => Math.min(index + 1, Math.max(0, filtered.length - 1)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((index) => Math.max(0, index - 1));
      } else if (event.key === 'Enter' && filtered[highlightedIndex]) {
        event.preventDefault();
        onToggleIndicator(filtered[highlightedIndex].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [filtered, highlightedIndex, isOpen, onClose, onToggleIndicator]);

  if (!isOpen) return null;

  const categoryLabel = (id) => {
    const cat = tabs.find((t) => t.id === id);
    return cat ? cat.label.replace('★ ', '') : id;
  };

  const activeCount = activeDefinitions.length;

  const emptyMessage = search.trim()
    ? `No indicators matching "${search}"${activeCategory === 'favorites' ? ' in favorites' : ''}`
    : activeCategory === 'favorites'
      ? 'No favorites yet — tap ☆ on any indicator to pin it here.'
      : 'No indicators in this category.';

  const renderRow = (indicator, index, { isActiveSection = false } = {}) => {
    const active = activeById.has(indicator.id);
    const hidden = hiddenById.has(indicator.id);
    const fav = favorites.includes(indicator.id);
    // Keyboard highlight is driven by `filtered` indexes only, so the ACTIVE
    // section can never mirror the browse list's highlight.
    const highlighted = !isActiveSection && index === highlightedIndex;
    // A gear that silently does nothing is worse than no gear: only definitions
    // with engine params (or catalog params) are actually configurable.
    const configurable = Boolean(indicator.engineId || indicator.params);
    const rowKey = `${isActiveSection ? 'active' : 'browse'}-${indicator.id}`;
    return (
      <div
        key={rowKey}
        id={`indicator-option-${rowKey}`}
        role="option"
        aria-selected={active}
        title={isActiveSection ? `${indicator.description} — use ✕ to remove` : indicator.description}
        data-browse-index={isActiveSection ? undefined : index}
        // Removing an indicator must only ever happen through the explicit ✕:
        // a stray click on an active row used to delete it with no undo.
        onClick={() => { if (!isActiveSection) onToggleIndicator(indicator.id); }}
        onMouseEnter={() => { if (!isActiveSection) setHighlightedIndex(index); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 44,
          marginBottom: 4,
          padding: '5px 8px',
          border: `1px solid ${active ? 'rgba(56,189,248,0.3)' : highlighted ? 'rgba(148,163,184,0.22)' : 'rgba(255,255,255,0.05)'}`,
          borderRadius: 5,
          background: active ? 'rgba(56,189,248,0.08)' : highlighted ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.52)',
          // ACTIVE rows are not clickable (removal is ✕-only), so don't advertise it.
          cursor: isActiveSection ? 'default' : 'pointer',
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${active ? '#38BDF8' : 'rgba(100,116,139,0.5)'}`,
            borderRadius: 3,
            background: active ? '#0891B2' : 'transparent',
          }}
        >
          {active && <Check size={12} color="#fff" strokeWidth={3} />}
        </span>
        <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', background: indicator.color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#F1F5F9', fontSize: 12, fontWeight: 650 }}>{indicator.name}</strong>
            <span style={{ flexShrink: 0, padding: '2px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: '#94A3B8', fontSize: 9 }}>{indicator.badge}</span>
          </div>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2, color: '#64748B', fontSize: 10 }}>{indicator.description}</div>
        </div>

        {/* Star favorite */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleFavorite(indicator.id); }}
          title={fav ? 'Remove from favorites' : 'Add to favorites'}
          style={{ ...iconButton, width: 22, height: 22, color: fav ? '#FBBF24' : '#475569', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#FBBF24'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = fav ? '#FBBF24' : '#475569'; }}
        >
          <Star size={13} fill={fav ? 'currentColor' : 'none'} />
        </button>

        {/* Settings — rendered only when the definition exposes configurable params */}
        {configurable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenSettings(indicator); }}
            title="Indicator settings"
            style={{ ...iconButton, width: 22, height: 22, flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F8FAFC'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; }}
          >
            <Settings2 size={13} />
          </button>
        )}

        {isActiveSection ? (
          <>
            {/* Hide / Show */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleHideIndicator(indicator.id); }}
              title={hidden ? 'Show indicator' : 'Hide indicator'}
              style={{ ...iconButton, width: 22, height: 22, flexShrink: 0, color: hidden ? '#64748B' : '#94A3B8' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = hidden ? '#64748B' : '#94A3B8'; }}
            >
              {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            {/* Remove */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemoveIndicator(indicator.id); }}
              title="Remove indicator"
              style={{ ...iconButton, width: 22, height: 22, flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#EF5350'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; }}
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            {active && hidden && (
              <span
                title="Added but hidden on the chart"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  flexShrink: 0,
                  padding: '3px 6px',
                  borderRadius: 4,
                  color: '#94A3B8',
                  background: 'rgba(148,163,184,0.12)',
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                <EyeOff size={11} />HIDDEN
              </span>
            )}
            <span
              style={{
                flexShrink: 0,
                padding: '3px 7px',
                borderRadius: 4,
                color: active ? '#7DD3FC' : '#94A3B8',
                background: active ? 'rgba(56,189,248,0.12)' : 'transparent',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {active ? 'ACTIVE' : '+ ADD'}
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: 12,
        paddingBottom: isMobile ? 0 : 12,
        background: 'rgba(5, 7, 13, 0.78)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Technical Indicators and Studies"
        onClick={(event) => event.stopPropagation()}
        style={{
          ...shell,
          width: isMobile ? '100%' : shell.width,
          height: isMobile ? '92%' : shell.height,
          maxHeight: isMobile ? '92%' : shell.maxHeight,
          borderBottomLeftRadius: isMobile ? 0 : shell.borderRadius,
          borderBottomRightRadius: isMobile ? 0 : shell.borderRadius,
        }}
      >
        {/* Fixed header: title + active count + close */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
            padding: '0 12px',
            borderBottom: '1px solid rgba(148,163,184,0.14)',
            background: '#111827',
            flexShrink: 0,
          }}
        >
          <Activity size={16} color="#38BDF8" />
          <strong style={{ color: '#F1F5F9', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>Indicators & Studies</strong>
          <span style={{ padding: '2px 6px', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 8, color: '#7DD3FC', background: 'rgba(56,189,248,0.1)', fontSize: 10, whiteSpace: 'nowrap' }}>
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

        {/* Search */}
        <div style={{ padding: '8px 12px 5px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#64748B" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input
              ref={searchInputRef}
              type="search"
              autoFocus
              role="combobox"
              aria-label="Search indicators"
              aria-expanded="true"
              aria-controls="indicator-browse-list"
              aria-autocomplete="list"
              aria-activedescendant={filtered[highlightedIndex] ? `indicator-option-browse-${filtered[highlightedIndex].id}` : undefined}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search indicators (e.g. RSI, SMA, Bollinger, VWAP)..."
              style={{ width: '100%', height: 34, boxSizing: 'border-box', padding: '0 30px', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 5, outline: 0, background: '#080B14', color: '#F8FAFC', font: '12px JetBrains Mono, monospace' }}
            />
            {search && <button type="button" onClick={() => setSearch('')} title="Clear search" aria-label="Clear search" style={{ ...iconButton, position: 'absolute', right: 3, top: 3, width: 28, height: 28 }}><X size={13} /></button>}
          </div>
        </div>

        {/* Category tabs */}
        <nav
          aria-label="Indicator categories"
          style={{
            display: 'flex',
            gap: 4,
            padding: '2px 12px 7px',
            borderBottom: '1px solid rgba(148,163,184,0.12)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flexShrink: 0,
          }}
        >
          {tabs.map((category) => {
            const selected = activeCategory === category.id;
            const count = category.id === 'all'
              ? INDICATOR_DEFINITIONS.length
              : category.id === 'favorites'
                ? favorites.length
                : INDICATOR_DEFINITIONS.filter((d) => d.category === category.id).length;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                style={{
                  height: 26,
                  padding: '0 8px',
                  border: `1px solid ${selected ? 'rgba(56,189,248,0.32)' : 'transparent'}`,
                  borderRadius: 4,
                  background: selected ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.03)',
                  color: selected ? '#7DD3FC' : '#94A3B8',
                  cursor: 'pointer',
                  font: '600 10px JetBrains Mono, monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                {category.label} <span style={{ opacity: 0.6 }}>{count}</span>
              </button>
            );
          })}
        </nav>

        {/* Scrollable body */}
        <div
          className="indicator-modal-list"
          ref={listRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '6px 12px 8px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(100,116,139,0.5) transparent',
          }}
        >
          {/* Active indicators section — rows here are managed via eye / ✕ only */}
          {activeDefinitions.length > 0 && (
            <section role="listbox" aria-label="Active indicators" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ color: '#7DD3FC', fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>ACTIVE ({activeDefinitions.length})</span>
                {activeDefinitions.length > 1 && (
                  <button type="button" onClick={onClearAll} style={{ background: 'transparent', border: 0, color: '#F87171', cursor: 'pointer', font: '600 10px JetBrains Mono, monospace' }}>Remove All</button>
                )}
              </div>
              {activeDefinitions.map((indicator, index) => renderRow(indicator, index, { isActiveSection: true }))}
            </section>
          )}

          {/* Browse catalog (hidden when viewing Active-only) */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>
              {activeCategory === 'favorites' ? 'FAVORITES' : activeCategory === 'all' ? 'ALL INDICATORS' : categoryLabel(activeCategory).toUpperCase()}
              {search && ` · "${search}"`}
              <span style={{ marginLeft: 6, color: '#475569' }}>{filtered.length} shown</span>
            </span>
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: '28px 8px', color: '#64748B', fontSize: 12, textAlign: 'center' }}>{emptyMessage}</div>
          )}
          <div id="indicator-browse-list" role="listbox" aria-label="Indicator catalog">
            {filtered.map((indicator, index) => renderRow(indicator, index))}
          </div>
        </div>

        {/* Footer */}
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 44,
            padding: '0 12px',
            borderTop: '1px solid rgba(148,163,184,0.14)',
            background: '#0A0D18',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClearAll}
            disabled={activeCount === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: 0,
              border: 0,
              background: 'transparent',
              color: activeCount ? '#F87171' : '#475569',
              cursor: activeCount ? 'pointer' : 'default',
              font: '600 11px JetBrains Mono, monospace',
            }}
          >
            <Trash2 size={13} />Clear All ({activeCount})
          </button>
          {!isMobile && (
            <span style={{ color: '#475569', fontSize: 10, whiteSpace: 'nowrap' }}>
              ↑↓ navigate · Enter add/remove · Ctrl+K search · Esc close
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{ height: 30, padding: '0 12px', border: 0, borderRadius: 4, background: '#0EA5E9', color: '#082F49', cursor: 'pointer', font: '700 11px JetBrains Mono, monospace' }}
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
