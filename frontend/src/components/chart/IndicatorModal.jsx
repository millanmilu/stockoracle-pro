import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Info,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  INDICATOR_CATEGORIES,
  INDICATOR_DEFINITIONS,
  INDICATOR_SEARCH_ALIASES,
} from './indicatorDefinitions';

const shell = {
  width: 'min(1040px, calc(100vw - 24px))',
  height: 'min(86vh, 800px)',
  maxHeight: '86vh',
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
const RECENT_KEY = 'stockoracle_recent_indicators';
const MAX_RECENT = 8;

// Two-column card grid for the browse catalog on wide layouts; collapses to
// a single column automatically when the pane gets narrow.
const cardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 8,
  alignItems: 'start',
};

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

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const known = new Set(INDICATOR_DEFINITIONS.map((indicator) => indicator.id));
    return parsed.filter((id) => known.has(id)).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

// ── Fuzzy search ─────────────────────────────────────────────────────────────
// Scores a single query token against one haystack string. Exact substring
// hits outrank prefix hits outrank ordered-subsequence (typo-tolerant) hits.
function tokenFieldScore(token, field) {
  if (!token || !field) return 0;
  const t = token.toLowerCase();
  const f = field.toLowerCase();
  if (!t || !f) return 0;
  if (f === t) return 120;
  const words = f.split(/[\s\-_/()%,+]+/).filter(Boolean);
  if (words.includes(t)) return 100;
  if (f.startsWith(t)) return 80;
  if (words.some((w) => w.startsWith(t))) return 70;
  if (f.includes(t)) return 50;
  // Ordered subsequence (fuzzy): characters appear in order, not necessarily
  // adjacent. Consecutive runs score higher; long gaps are penalized.
  let ti = 0;
  let score = 0;
  let run = 0;
  for (let fi = 0; fi < f.length && ti < t.length; fi++) {
    if (f[fi] === t[ti]) {
      ti++;
      run++;
      score += 4 + Math.min(run, 6);
    } else {
      run = 0;
      score -= 0.4;
    }
  }
  if (ti < t.length) return 0;
  return Math.max(4, score);
}

function searchFields(indicator) {
  const aliases = INDICATOR_SEARCH_ALIASES[indicator.id] || [];
  return [
    indicator.name,
    indicator.shortName,
    indicator.id.replace(/_/g, ' '),
    indicator.id,
    indicator.description,
    indicator.badge,
    indicator.category,
    ...(indicator.keywords || []),
    ...aliases,
  ]
    .filter(Boolean)
    .map(String);
}

function scoreIndicator(token, indicator) {
  const fields = searchFields(indicator);
  let best = 0;
  for (const field of fields) {
    const s = tokenFieldScore(token, field);
    if (s > best) best = s;
    if (best >= 120) break;
  }
  // Name matches outweigh description matches: weight the name fields up.
  const nameBest = Math.max(
    tokenFieldScore(token, indicator.name || ''),
    tokenFieldScore(token, indicator.shortName || ''),
    tokenFieldScore(token, (indicator.id || '').replace(/_/g, ' ')),
  );
  return best + nameBest * 0.5;
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
  onMoveIndicator = () => {},
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [recent, setRecent] = useState(() => loadRecent());
  const [expandedId, setExpandedId] = useState(null);
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
    if (id === 'all') return INDICATOR_DEFINITIONS.length;
    if (id === 'favorites') return favorites.length;
    if (id === 'oscillators') return INDICATOR_DEFINITIONS.filter((d) => d.type === 'oscillator').length;
    return INDICATOR_DEFINITIONS.filter((d) => d.category === id).length;
  };

  const matchesCategory = (indicator) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'favorites') return favorites.includes(indicator.id);
    if (activeCategory === 'oscillators') return indicator.type === 'oscillator';
    return indicator.category === activeCategory;
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const inCategory = INDICATOR_DEFINITIONS.filter(matchesCategory);
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
  }, [activeCategory, search, favorites]);

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
      .map((id) => INDICATOR_DEFINITIONS.find((item) => item.id === id))
      .filter(Boolean)
      .slice(0, 6);
  }, [recent]);

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
  }, [displayOrder, highlightedIndex, isOpen, onClose, onToggleIndicator, activeById]);

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

  // Generic pipeline description for non-AI definitions so every card can
  // answer "what does this actually do?" without per-indicator copy.
  const describeIndicator = (indicator) => {
    if (indicator.category === 'ai') return null;
    let calculation = 'Computed from OHLCV candles.';
    let outputs = 'Chart overlay line.';
    if (indicator.engineId) calculation = `Client-side engine "${indicator.engineId}" over OHLCV history.`;
    else if (indicator.field) calculation = `Server-computed series "${indicator.field}" on each candle.`;
    if (indicator.type === 'oscillator') outputs = 'Sub-pane oscillator with its own scale.';
    else if (indicator.type === 'overlay_multi') outputs = 'Multi-line overlay (upper / basis / lower).';
    else if (indicator.type === 'overlay_supertrend') outputs = 'Trend ribbon flipping bullish/bearish with direction.';
    else if (indicator.type === 'overlay_psar') outputs = 'Stop-and-reverse dots below (bullish) / above (bearish) price.';
    else if (indicator.type === 'overlay_ichimoku') outputs = 'Tenkan / Kijun / cloud / Chikou multi-line system.';
    else if (indicator.type === 'smc') outputs = 'Smart-money markers/zones drawn on the price pane.';
    else if (indicator.type === 'levels') outputs = 'Horizontal key-level lines (support / resistance).';
    return { calculation, outputs };
  };

  const renderDetail = (indicator) => {
    const generic = describeIndicator(indicator);
    const rows = [];
    if (indicator.category === 'ai') {
      rows.push(
        ['Inputs', (indicator.inputs || []).join(' · ')],
        ['Method', indicator.method],
        ['Outputs', (indicator.outputs || []).join(' · ')],
        ['Signals', (indicator.signals || []).join('  ·  ')],
        ['Confidence', indicator.confidence],
        ['Backtest', indicator.backtest],
      );
    } else {
      rows.push(
        ['What it shows', indicator.description],
        ['Calculation', generic.calculation],
        ['Outputs', generic.outputs],
      );
      if (indicator.params) {
        rows.push(['Defaults', Object.entries(indicator.params).map(([k, v]) => `${k}=${v}`).join(', ')]);
      }
    }
    return (
      <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 5, background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.14)' }}>
        {rows.filter(([, v]) => v).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 10, lineHeight: 1.5 }}>
            <span style={{ flexShrink: 0, width: 86, color: '#38BDF8', fontWeight: 700 }}>{label}</span>
            <span style={{ color: '#CBD5E1' }}>{value}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderBadge = (indicator) => {
    if (indicator.category === 'ai' || indicator.badge === 'AI') {
      return (
        <span
          title="AI-powered study"
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'linear-gradient(135deg, rgba(56,189,248,0.25), rgba(168,85,247,0.25))',
            border: '1px solid rgba(56,189,248,0.4)',
            color: '#7DD3FC',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 0.4,
          }}
        >
          <Sparkles size={10} />AI
        </span>
      );
    }
    return (
      <span style={{ flexShrink: 0, padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: '#94A3B8', fontSize: 9 }}>
        {indicator.badge}
      </span>
    );
  };

  const renderRow = (indicator, index, { isActiveSection = false } = {}) => {
    const active = activeById.has(indicator.id);
    const hidden = hiddenById.has(indicator.id);
    const fav = favorites.includes(indicator.id);
    // Keyboard highlight is driven by `displayOrder` indexes only, so the
    // ACTIVE section can never mirror the browse list's highlight.
    const highlighted = !isActiveSection && index === highlightedIndex;
    const expanded = expandedId === indicator.id;
    // TradingView parity: EVERY indicator has settings (Inputs/Style/Visibility).
    // Engine-backed use live schema, legacy field-based use fallback inputs.
    const configurable = true;
    const rowKey = `${isActiveSection ? 'active' : 'browse'}-${indicator.id}`;
    const activePos = activeIndicators.indexOf(indicator.id);
    return (
      <div
        key={rowKey}
        id={`indicator-option-${rowKey}`}
        role="option"
        aria-selected={active}
        data-browse-index={isActiveSection ? undefined : index}
        // Removing an indicator must only ever happen through the explicit ✕:
        // a stray click on an active row used to delete it with no undo.
        onClick={() => { if (!isActiveSection) handleToggle(indicator.id); }}
        onMouseEnter={() => { if (!isActiveSection) setHighlightedIndex(index); }}
        style={{
          marginBottom: 0,
          padding: '8px 10px',
          border: `1px solid ${active ? 'rgba(56,189,248,0.3)' : highlighted ? 'rgba(148,163,184,0.25)' : 'rgba(255,255,255,0.05)'}`,
          borderRadius: 6,
          background: active ? 'rgba(56,189,248,0.07)' : highlighted ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.52)',
          // ACTIVE rows are not clickable (removal is ✕-only), so don't advertise it.
          cursor: isActiveSection ? 'default' : 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              <strong
                title={indicator.description}
                style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#F1F5F9', fontSize: 12, fontWeight: 650 }}
              >
                {indicator.name}
              </strong>
              {renderBadge(indicator)}
              {fav && <Star size={11} color="#FBBF24" fill="currentColor" style={{ flexShrink: 0 }} />}
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2, color: '#64748B', fontSize: 10 }}>{indicator.description}</div>
          </div>

          {/* Star favorite */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleFavorite(indicator.id); }}
            title={fav ? 'Remove from favorites' : 'Add to favorites'}
            style={{ ...iconButton, width: 24, height: 24, color: fav ? '#FBBF24' : '#475569', flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FBBF24'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = fav ? '#FBBF24' : '#475569'; }}
          >
            <Star size={13} fill={fav ? 'currentColor' : 'none'} />
          </button>

          {/* Detail toggle — answers "what does this actually do?" */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleExpanded(indicator.id); }}
            title={expanded ? 'Hide details' : 'What does this do?'}
            aria-expanded={expanded}
            style={{ ...iconButton, width: 24, height: 24, flexShrink: 0, color: expanded ? '#7DD3FC' : '#64748B' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F8FAFC'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = expanded ? '#7DD3FC' : '#64748B'; }}
          >
            <Info size={13} />
          </button>

          {/* Settings — rendered only when the definition exposes configurable params */}
          {configurable && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenSettings(indicator); }}
              title="Indicator settings"
              style={{ ...iconButton, width: 24, height: 24, flexShrink: 0 }}
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
                style={{ ...iconButton, width: 24, height: 24, flexShrink: 0, color: hidden ? '#64748B' : '#94A3B8' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = hidden ? '#64748B' : '#94A3B8'; }}
              >
                {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              {/* Move up / down (pane + draw order follows the applied list) */}
              <span style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMoveIndicator(indicator.id, -1); }}
                  disabled={activePos <= 0}
                  title="Move up"
                  style={{ ...iconButton, width: 24, height: 14, color: activePos <= 0 ? '#334155' : '#64748B', cursor: activePos <= 0 ? 'default' : 'pointer' }}
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMoveIndicator(indicator.id, 1); }}
                  disabled={activePos < 0 || activePos >= activeDefinitions.length - 1}
                  title="Move down"
                  style={{ ...iconButton, width: 24, height: 14, color: activePos >= activeDefinitions.length - 1 ? '#334155' : '#64748B', cursor: activePos >= activeDefinitions.length - 1 ? 'default' : 'pointer' }}
                >
                  <ChevronDown size={12} />
                </button>
              </span>
              {/* Remove */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemoveIndicator(indicator.id); }}
                title="Remove indicator"
                style={{ ...iconButton, width: 24, height: 24, flexShrink: 0 }}
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
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleToggle(indicator.id); }}
                title={active ? 'Remove from chart' : 'Add to chart'}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 26,
                  padding: '0 10px',
                  border: active ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(56,189,248,0.35)',
                  borderRadius: 4,
                  background: active ? 'rgba(52,211,153,0.12)' : 'rgba(56,189,248,0.12)',
                  color: active ? '#6EE7B7' : '#7DD3FC',
                  cursor: 'pointer',
                  font: '700 10px JetBrains Mono, monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                {active ? <><Check size={12} />Added</> : <><Plus size={12} />Add</>}
              </button>
            </>
          )}
        </div>
        {expanded && renderDetail(indicator)}
      </div>
    );
  };

  // Browse rows need display-order indexes (AI section renders first on "All")
  // so keyboard highlight tracks the visual order.
  const browseIndexOf = (indicator) => displayOrder.indexOf(indicator);

  const renderSectionHeader = (label, count, hint) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '10px 0 6px' }}>
      <span style={{ color: '#7DD3FC', fontSize: 10, fontWeight: 700, letterSpacing: 0.6 }}>{label}</span>
      {count != null && <span style={{ color: '#475569', fontSize: 10 }}>{count}</span>}
      {hint && <span style={{ color: '#475569', fontSize: 10 }}>{hint}</span>}
    </div>
  );

  const highlighted = displayOrder[highlightedIndex];
  const highlightedActive = highlighted ? activeById.has(highlighted.id) : false;

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

        {/* Search — the main focus */}
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

        {/* Category tabs — mobile only; desktop uses the left sidebar */}
        {isMobile && (
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
        )}

        {/* Body: sidebar + scrollable content (desktop) or content only (mobile) */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}>
        {!isMobile && (
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
        )}
        {/* Scrollable content */}
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
              {activeDefinitions.map((indicator) => renderRow(indicator, -1, { isActiveSection: true }))}
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
                  {aiItems.map((indicator) => renderRow(indicator, browseIndexOf(indicator)))}
                </div>
              </section>
              <section aria-label="All indicators">
                {renderSectionHeader('ALL INDICATORS', `${normalItems.length} shown`, '· TradingView-style catalog')}
                <div id="indicator-browse-list" role="listbox" aria-label="Indicator catalog" style={cardGrid}>
                  {normalItems.map((indicator) => renderRow(indicator, browseIndexOf(indicator)))}
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
                {filtered.map((indicator) => renderRow(indicator, browseIndexOf(indicator)))}
              </div>
            </>
          )}
        </div>
        </div>

        {/* Footer */}
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
      </div>
    </div>
  );
}
