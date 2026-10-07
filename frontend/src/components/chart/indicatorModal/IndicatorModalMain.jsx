import React, { useEffect, useMemo, useRef, useState } from 'react';
import { INDICATOR_CATEGORIES, INDICATOR_DEFINITIONS } from '../indicatorDefinitions';
import CustomIndicatorEditor from '../CustomIndicatorEditor';
import { shell, FAVORITES_KEY, RECENT_KEY, MAX_RECENT } from './indicatorModalStyles';
import { loadFavorites, loadRecent } from './indicatorStorage';
import { scoreIndicator } from './indicatorSearch';
import IndicatorModalContent from './IndicatorModalContent';
import { ModalHeader, SearchBar, CategoryTabs, CategorySidebar, ModalFooter } from './IndicatorModalPanels';

export default function IndicatorModal({
  isOpen = false,
  onClose = () => {},
  activeIndicators = [],
  customIndicators = [],
  hiddenIndicators = [],
  onToggleIndicator = () => {},
  onToggleHideIndicator = () => {},
  onRemoveIndicator = () => {},
  onClearAll = () => {},
  onOpenSettings = () => {},
  onMoveIndicator = () => {},
  onSaveCustomIndicator = () => {},
  onDeleteCustomIndicator = () => {},
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [recent, setRecent] = useState(() => loadRecent());
  const [expandedId, setExpandedId] = useState(null);
  const [editingCustom, setEditingCustom] = useState(null);
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
  const catalog = useMemo(() => [...INDICATOR_DEFINITIONS, ...customIndicators], [customIndicators]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const recordRecent = (id) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleToggle = (id) => {
    const adding = !activeById.has(id);
    onToggleIndicator(id);
    if (adding) recordRecent(id);
  };

  const toggleExpanded = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const tabs = useMemo(() => [
    { id: 'favorites', label: '★ Favorites' },
    ...INDICATOR_CATEGORIES,
  ], []);

  const categoryCount = (id) => {
    if (id === 'all') return catalog.length;
    if (id === 'favorites') return favorites.length;
    if (id === 'oscillators') return catalog.filter((d) => d.type === 'oscillator').length;
    return catalog.filter((d) => d.category === id).length;
  };

  const matchesCategory = (indicator) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'favorites') return favorites.includes(indicator.id);
    if (activeCategory === 'oscillators') return indicator.type === 'oscillator';
    return indicator.category === activeCategory;
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const inCategory = catalog.filter(matchesCategory);
    if (!query) {
      let list = [...inCategory];
      // Favorites float to the top when browsing "All".
      if (activeCategory === 'all') {
        const fav = list.filter((i) => favorites.includes(i.id));
        const rest = list.filter((i) => !favorites.includes(i.id));
        list = [...fav, ...rest];
      }
      return list;
    }
    const tokens = query.split(/\s+/).filter(Boolean);
    return inCategory
      .map((indicator) => {
        let total = 0;
        for (const token of tokens) {
          const s = scoreIndicator(token, indicator);
          if (s <= 0) return { indicator, score: -1 };
          total += s;
        }
        return { indicator, score: total };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((row) => row.indicator);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, search, favorites, catalog]);

  // Display order drives keyboard navigation. On "All" with no query the AI
  // catalog renders as its own section first, so keyboard order follows the
  // visual order (AI section, then the rest).
  const { aiItems, normalItems, displayOrder, splitAI } = useMemo(() => {
    const ai = filtered.filter((i) => i.category === 'ai');
    const normal = filtered.filter((i) => i.category !== 'ai');
    const split = activeCategory === 'all' && !search.trim() && ai.length > 0;
    return {
      aiItems: ai,
      normalItems: normal,
      displayOrder: split ? [...ai, ...normal] : filtered,
      splitAI: split,
    };
  }, [filtered, activeCategory, search]);

  const recentDefinitions = useMemo(() => {
    return recent
      .map((id) => catalog.find((item) => item.id === id))
      .filter(Boolean)
      .slice(0, 6);
  }, [recent, catalog]);

  const activeDefinitions = useMemo(() => {
    return activeIndicators
      .map((id) => catalog.find((item) => item.id === id))
      .filter(Boolean);
  }, [activeIndicators, catalog]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [activeCategory, search]);

  // A fresh open always starts clean: no stale search text and no highlight
  // resuming on a row that is no longer on screen.
  useEffect(() => {
    if (!isOpen) return undefined;
    setSearch('');
    setHighlightedIndex(0);
    setExpandedId(null);
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
      if (editingCustom) return;
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
        setHighlightedIndex((index) => Math.min(index + 1, Math.max(0, displayOrder.length - 1)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((index) => Math.max(0, index - 1));
      } else if (event.key === 'Enter' && displayOrder[highlightedIndex]) {
        // Don't hijack Enter while the user is activating a focused button
        // (e.g. the footer Add/Done or a row action) — only the search field
        // and body-driven navigation toggle indicators.
        const tag = document.activeElement?.tagName;
        if (tag === 'BUTTON' && document.activeElement !== searchInputRef.current) return;
        event.preventDefault();
        handleToggle(displayOrder[highlightedIndex].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayOrder, editingCustom, highlightedIndex, isOpen, onClose, onToggleIndicator, activeById]);

  if (!isOpen) return null;

  const categoryLabel = (id) => {
    const cat = tabs.find((t) => t.id === id);
    return cat ? cat.label.replace('★ ', '') : id;
  };

  const activeCount = activeDefinitions.length;
  const query = search.trim();

  const emptyMessage = query
    ? `No indicators matching "${search}"${activeCategory === 'favorites' ? ' in favorites' : ''}`
    : activeCategory === 'favorites'
      ? 'No favorites yet — tap ☆ on any indicator to pin it here.'
      : 'No indicators in this category.';

  const highlighted = displayOrder[highlightedIndex];
  const highlightedActive = highlighted ? activeById.has(highlighted.id) : false;

  const rowProps = {
    activeById,
    hiddenById,
    favorites,
    highlightedIndex,
    expandedId,
    activeIndicators,
    activeDefinitions,
    handleToggle,
    toggleFavorite,
    toggleExpanded,
    setHighlightedIndex,
    onOpenSettings,
    onToggleHideIndicator,
    onMoveIndicator,
    onRemoveIndicator,
    onEditCustom: setEditingCustom,
  };

  return (
    <>
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

        <ModalHeader activeCount={activeCount} hiddenIndicators={hiddenIndicators} onClose={onClose} onCreateCustom={() => setEditingCustom({})} />

        <SearchBar searchInputRef={searchInputRef} search={search} setSearch={setSearch} highlighted={highlighted} />

        {isMobile && (
          <CategoryTabs tabs={tabs} activeCategory={activeCategory} categoryCount={categoryCount} setActiveCategory={setActiveCategory} />
        )}

        {/* Body: sidebar + scrollable content (desktop) or content only (mobile) */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}>
        {!isMobile && (
          <CategorySidebar tabs={tabs} activeCategory={activeCategory} categoryCount={categoryCount} setActiveCategory={setActiveCategory} activeCount={activeCount} hiddenIndicators={hiddenIndicators} />
        )}

        {/* Scrollable content */}
        <IndicatorModalContent
          listRef={listRef}
          activeDefinitions={activeDefinitions}
          recentDefinitions={recentDefinitions}
          filtered={filtered}
          splitAI={splitAI}
          aiItems={aiItems}
          normalItems={normalItems}
          activeById={activeById}
          handleToggle={handleToggle}
          query={query}
          search={search}
          activeCategory={activeCategory}
          categoryLabel={categoryLabel}
          emptyMessage={emptyMessage}
          onClearAll={onClearAll}
          displayOrder={displayOrder}
          rowProps={rowProps}
        />
        </div>

        <ModalFooter activeCount={activeCount} isMobile={isMobile} highlighted={highlighted} highlightedActive={highlightedActive} handleToggle={handleToggle} onClearAll={onClearAll} onClose={onClose} />
      </div>
    </div>
    {editingCustom && (
      <CustomIndicatorEditor
        indicator={editingCustom.id ? editingCustom : null}
        onSave={(draft) => {
          onSaveCustomIndicator(draft);
          setEditingCustom(null);
        }}
        onDelete={(id) => {
          onDeleteCustomIndicator(id);
          setEditingCustom(null);
        }}
        onClose={() => setEditingCustom(null)}
      />
    )}
    </>
  );
}
