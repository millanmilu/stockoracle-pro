import React from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { INDICATOR_DEFINITIONS } from './indicatorDefinitions';

/**
 * IndicatorLegend — TradingView-style On-Chart Indicator Legend HUD
 * Docked at top-left of the chart canvas, displaying active indicator pills
 * with live values, hide/show toggles, and remove buttons.
 */
export default function IndicatorLegend({
  activeIndicators = [],
  hiddenIndicators = [],
  indicatorValues = {},
  onToggleHide = () => {},
  onRemove = () => {},
}) {
  if (!activeIndicators || activeIndicators.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 10,
        zIndex: 15,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        pointerEvents: 'auto',
        maxWidth: 'calc(100% - 120px)',
      }}
    >
      {activeIndicators.map((id) => {
        const def = INDICATOR_DEFINITIONS.find((item) => item.id === id);
        if (!def) return null;

        const isHidden = hiddenIndicators.includes(id);
        const liveVal = indicatorValues[id];

        // Format value cleanly
        let displayVal = '—';
        if (liveVal != null && !isNaN(Number(liveVal))) {
          displayVal = Number(liveVal).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }

        return (
          <div
            key={id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 7px',
              borderRadius: 4,
              backgroundColor: 'rgba(11, 15, 28, 0.88)',
              backdropFilter: 'blur(4px)',
              border: `1px solid ${isHidden ? 'rgba(100, 116, 139, 0.25)' : 'rgba(99, 102, 241, 0.25)'}`,
              fontSize: '0.68rem',
              fontFamily: 'JetBrains Mono, monospace',
              color: isHidden ? '#64748B' : '#E2E8F0',
              opacity: isHidden ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {/* Color dot */}
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: def.color,
                opacity: isHidden ? 0.4 : 1,
                flexShrink: 0,
              }}
            />

            {/* Indicator Name */}
            <span style={{ fontWeight: 700, color: isHidden ? '#64748B' : '#94A3B8' }}>
              {def.shortName}
            </span>

            {/* Current Value */}
            <span
              style={{
                fontWeight: 800,
                color: isHidden ? '#64748B' : def.color,
                minWidth: 42,
              }}
            >
              {displayVal}
            </span>

            {/* Actions: Hide / Show */}
            <button
              onClick={() => onToggleHide(id)}
              title={isHidden ? 'Show indicator' : 'Hide indicator'}
              style={{
                background: 'transparent',
                border: 'none',
                color: isHidden ? '#64748B' : '#94A3B8',
                cursor: 'pointer',
                padding: 1,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 2,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F1F5F9')}
              onMouseLeave={(e) => (e.currentTarget.style.color = isHidden ? '#64748B' : '#94A3B8')}
            >
              {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>

            {/* Actions: Remove */}
            <button
              onClick={() => onRemove(id)}
              title="Remove indicator"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: 1,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 2,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#EF5350')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
