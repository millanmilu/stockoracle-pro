import React from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Info,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { iconButton } from './indicatorModalStyles';

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

export default function IndicatorRow({
  indicator,
  index,
  isActiveSection = false,
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
  onEditCustom = () => {},
}) {
    const active = activeById.has(indicator.id);
    const hidden = hiddenById.has(indicator.id);
    const fav = favorites.includes(indicator.id);
    // Keyboard highlight is driven by `displayOrder` indexes only, so the
    // ACTIVE section can never mirror the browse list's highlight.
    const highlighted = !isActiveSection && index === highlightedIndex;
    const expanded = expandedId === indicator.id;
    // TradingView parity: EVERY indicator has settings (Inputs/Style/Visibility).
    // Engine-backed use live schema, legacy field-based use fallback inputs.
    const configurable = !indicator.isUserCustom;
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
          {indicator.isUserCustom && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEditCustom(indicator); }}
              title="Edit custom script"
              aria-label={`Edit ${indicator.name}`}
              style={{ ...iconButton, width: 24, height: 24, flexShrink: 0, color: '#7DD3FC' }}
            >
              <Pencil size={13} />
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
}
