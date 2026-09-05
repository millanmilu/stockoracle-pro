import React, { useState, useMemo } from 'react';
import { Search, X, Check, Activity, Trash2 } from 'lucide-react';
import { INDICATOR_DEFINITIONS, INDICATOR_CATEGORIES } from './indicatorDefinitions';

/**
 * IndicatorModal — TradingView-style Indicator Library Modal
 * Fast searchable catalog to toggle overlays, oscillators, and key levels.
 */
export default function IndicatorModal({
  isOpen = false,
  onClose = () => {},
  activeIndicators = [],
  onToggleIndicator = () => {},
  onClearAll = () => {},
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered = useMemo(() => {
    return INDICATOR_DEFINITIONS.filter((ind) => {
      const matchesCat = activeCategory === 'all' || ind.category === activeCategory;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        ind.name.toLowerCase().includes(query) ||
        ind.shortName.toLowerCase().includes(query) ||
        ind.description.toLowerCase().includes(query);
      return matchesCat && matchesSearch;
    });
  }, [search, activeCategory]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 13, 0.78)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          maxHeight: '85vh',
          backgroundColor: '#0E1322',
          border: '1px solid rgba(99, 102, 241, 0.28)',
          borderRadius: 10,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'JetBrains Mono, monospace',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid rgba(99, 102, 241, 0.16)',
            background: 'linear-gradient(180deg, #131A2E 0%, #0E1322 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} style={{ color: '#818CF8' }} />
            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.01em' }}>
              Technical Indicators & Studies
            </span>
            {activeIndicators.length > 0 && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  backgroundColor: 'rgba(99, 102, 241, 0.25)',
                  color: '#A5B4FC',
                  padding: '2px 7px',
                  borderRadius: 10,
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                }}
              >
                {activeIndicators.length} Active
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#F1F5F9')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '12px 18px 8px 18px' }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search size={14} style={{ position: 'absolute', left: 12, color: '#64748B' }} />
            <input
              type="text"
              placeholder="Search indicators (e.g. RSI, SMA, Bollinger, VWAP)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                backgroundColor: '#080B14',
                border: '1px solid rgba(99, 102, 241, 0.22)',
                borderRadius: 6,
                color: '#F8FAFC',
                fontSize: '0.78rem',
                outline: 'none',
                fontFamily: 'JetBrains Mono, monospace',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '4px 18px 10px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            overflowX: 'auto',
          }}
        >
          {INDICATOR_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? '#818CF8' : '#94A3B8',
                  outline: isSelected ? '1px solid rgba(99, 102, 241, 0.45)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Indicators List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748B', fontSize: '0.80rem' }}>
              No indicators matching "{search}"
            </div>
          ) : (
            filtered.map((ind) => {
              const isActive = activeIndicators.includes(ind.id);
              return (
                <div
                  key={ind.id}
                  onClick={() => onToggleIndicator(ind.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: 6,
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                    border: `1px solid ${isActive ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.04)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.5)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Checkbox indicator */}
                    <div
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 4,
                        border: `1px solid ${isActive ? '#818CF8' : 'rgba(100, 116, 139, 0.4)'}`,
                        backgroundColor: isActive ? '#6366F1' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isActive && <Check size={12} style={{ color: '#fff', strokeWidth: 3 }} />}
                    </div>

                    {/* Color dot */}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: ind.color,
                        flexShrink: 0,
                      }}
                    />

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#F1F5F9' }}>
                          {ind.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.60rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 3,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: '#94A3B8',
                          }}
                        >
                          {ind.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 2 }}>
                        {ind.description}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: isActive ? '#818CF8' : '#475569',
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      flexShrink: 0,
                    }}
                  >
                    {isActive ? 'ACTIVE' : '+ ADD'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            borderTop: '1px solid rgba(99, 102, 241, 0.14)',
            backgroundColor: '#0A0D18',
          }}
        >
          <button
            onClick={onClearAll}
            disabled={activeIndicators.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'transparent',
              border: 'none',
              color: activeIndicators.length > 0 ? '#EF5350' : '#475569',
              fontSize: '0.70rem',
              fontWeight: 700,
              cursor: activeIndicators.length > 0 ? 'pointer' : 'default',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            <Trash2 size={13} />
            Clear All ({activeIndicators.length})
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: 5,
              backgroundColor: '#6366F1',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4F46E5')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6366F1')}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
