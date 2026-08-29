import { useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { POPULAR_STOCKS } from '../../utils/chartHelpers';

/**
 * TradingView-style symbol search autocomplete modal.
 * Extracted from LiveChartView.jsx for reuse and testability.
 */
export default function SymbolSearchModal({
  isOpen, onClose, onSelect, filter, onFilterChange,
  searchResults, isSearching, selectedSymbol,
}) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (searchResults.length > 0) {
        onSelect(searchResults[0].ticker.toUpperCase());
      } else if (filter.trim()) {
        onSelect(filter.trim().toUpperCase());
      }
    }
  };

  const filteredPopular = POPULAR_STOCKS.filter(
    (s) => !filter || s.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'absolute', top: 'calc(100% + 4px)', left: 0,
        width: 'min(90vw, 320px)', backgroundColor: '#0F172A',
        border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, padding: 8,
        zIndex: 300, boxShadow: '0 16px 36px rgba(0,0,0,0.85)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: 10, color: '#64748B' }} />
        <input
          type="text"
          placeholder="Search any NSE stock (e.g. TATA, INFY)..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          autoFocus
          onKeyDown={handleKeyDown}
          style={{
            width: '100%', padding: '7px 10px 7px 30px', borderRadius: 6,
            border: '1px solid rgba(99,102,241,0.25)', background: '#090C18',
            color: '#fff', fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {filter && (
          <button onClick={() => onFilterChange('')} style={{
            position: 'absolute', right: 8, top: 7,
            background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer',
          }}>
            <X size={13} />
          </button>
        )}
      </div>

      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {isSearching && (
          <div style={{ padding: '8px 12px', fontSize: '0.72rem', color: '#818CF8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="spinner" style={{ width: 12, height: 12 }} /> Searching NSE Universe...
          </div>
        )}

        {filter.trim() && searchResults.length > 0 && searchResults.map((item) => (
          <div
            key={item.ticker}
            onClick={() => { onSelect(item.ticker.toUpperCase()); onFilterChange(''); }}
            style={{
              padding: '8px 10px', borderRadius: 6, fontSize: '0.76rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              backgroundColor: selectedSymbol === item.ticker ? 'rgba(99,102,241,0.18)' : 'transparent',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.14)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSymbol === item.ticker ? 'rgba(99,102,241,0.18)' : 'transparent'}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>{item.ticker}</span>
              <span style={{ fontSize: '0.68rem', color: '#94A3B8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            </div>
            <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', color: '#64748B' }}>{item.exchange || 'NSE'}</span>
          </div>
        ))}

        {(!filter.trim() || (searchResults.length === 0 && !isSearching)) && (
          <div>
            <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, padding: '4px 8px', letterSpacing: '0.05em' }}>POPULAR NSE TICKERS</div>
            {filteredPopular.map((sym) => (
              <div
                key={sym}
                onClick={() => { onSelect(sym); onFilterChange(''); }}
                style={{
                  padding: '7px 10px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700,
                  color: selectedSymbol === sym ? '#818CF8' : '#E2E8F0',
                  backgroundColor: selectedSymbol === sym ? 'rgba(99,102,241,0.2)' : 'transparent',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSymbol === sym ? 'rgba(99,102,241,0.2)' : 'transparent'}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{sym}</span>
                <span style={{ fontSize: '0.65rem', color: '#64748B' }}>NSE</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
