import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';
import HeatmapHeaderBar from './heatmap/HeatmapHeaderBar';
import HeatmapBreadthBar from './heatmap/HeatmapBreadthBar';
import HeatmapSectorBlock from './heatmap/HeatmapSectorBlock';
import HeatmapStockDrawer from './heatmap/HeatmapStockDrawer';

export default function MarketHeatmap() {
  const [universe, setUniverse] = useState('ALL');
  const [metric, setMetric] = useState('change_1d_pct');
  const [searchQuery, setSearchQuery] = useState('');
  const [sizingMode, setSizingMode] = useState('mcap'); // 'mcap' or 'equal'
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);

  // Load heatmap data from backend
  const loadHeatmap = useCallback(async (univ = universe, met = metric) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/market/heatmap`, {
        params: {
          universe: univ,
          metric: met,
        }
      });
      setData(res.data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Heatmap load error:', err);
      setError('Failed to load market heatmap data. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [universe, metric]);

  // Initial load and reload when universe or metric changes
  useEffect(() => {
    loadHeatmap(universe, metric);
  }, [universe, metric, loadHeatmap]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      loadHeatmap(universe, metric);
    }, 60000);
    return () => clearInterval(timer);
  }, [universe, metric, loadHeatmap]);

  // Handlers
  const handleSelectUniverse = (newUniv) => {
    setUniverse(newUniv);
  };

  const handleSelectMetric = (newMetric) => {
    setMetric(newMetric);
  };

  const handleToggleSizingMode = () => {
    setSizingMode((prev) => (prev === 'mcap' ? 'equal' : 'mcap'));
  };

  const { sectors = [], market_breadth: marketBreadth = {} } = data || {};

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1800px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      minHeight: 'calc(100vh - 120px)',
      boxSizing: 'border-box',
    }}>
      {/* Header Bar */}
      <HeatmapHeaderBar
        selectedUniverse={universe}
        onSelectUniverse={handleSelectUniverse}
        selectedMetric={metric}
        onSelectMetric={handleSelectMetric}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sizingMode={sizingMode}
        onToggleSizingMode={handleToggleSizingMode}
        onRefresh={() => loadHeatmap(universe, metric)}
        loading={loading}
        lastUpdated={lastUpdated}
      />

      {/* Market Breadth & Sentiment Summary Bar */}
      <HeatmapBreadthBar
        marketBreadth={marketBreadth}
        sectors={sectors}
        selectedMetric={metric}
      />

      {/* Error Message */}
      {error && !data && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 14,
          padding: '24px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#F43F5E', fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button
            onClick={() => loadHeatmap(universe, metric)}
            style={{
              background: '#6366F1',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '8px 20px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div style={{
          padding: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}>
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <p style={{ color: '#818CF8', fontSize: '0.9rem', fontWeight: 600 }}>
            Loading {universe} institutional market heatmap…
          </p>
        </div>
      )}

      {/* Main Heatmap Sectors Grid */}
      {data && sectors.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}>
          {sectors.map((sec) => (
            <HeatmapSectorBlock
              key={sec.sector}
              sector={sec}
              selectedMetric={metric}
              sizingMode={sizingMode}
              searchQuery={searchQuery}
              onSelectStock={setSelectedStock}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {data && sectors.length === 0 && (
        <div style={{
          padding: 60,
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
        }}>
          <p style={{ color: '#94A3B8', fontSize: '0.95rem' }}>
            No stocks found for universe "{universe}". Try selecting "ALL NSE".
          </p>
        </div>
      )}

      {/* Slide-out Stock Inspection Drawer */}
      {selectedStock && (
        <HeatmapStockDrawer
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}
