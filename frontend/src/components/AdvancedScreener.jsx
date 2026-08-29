import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Sparkles, Play, RefreshCw, Search } from 'lucide-react';

import ScreenerHeaderBar from './screener/ScreenerHeaderBar';
import ScreenerKpiCards from './screener/ScreenerKpiCards';
import ScreenerSectorChart from './screener/ScreenerSectorChart';
import ScreenerFilters from './screener/ScreenerFilters';
import ScreenerTable from './screener/ScreenerTable';
import ScreenerPagination from './screener/ScreenerPagination';
import ScreenerFlyoutDrawer from './screener/ScreenerFlyoutDrawer';
import ScreenerBulkBar from './screener/ScreenerBulkBar';
import ScreenerBacktestModal from './screener/ScreenerBacktestModal';
import ScreenerSaveModal from './screener/ScreenerSaveModal';

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (window.location.hostname.includes('amplifyapp.com')) {
      return 'wss://stockoracle.duckdns.org/ws/prices';
    }
    return `${protocol}//${window.location.host}/ws/prices`;
  }
  return 'ws://localhost:8000/ws/prices';
};

export default function AdvancedScreener() {
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const setActiveView = useStore(s => s.setActiveView);

  // Mode & Drawer State
  const [queryMode, setQueryMode] = useState('visual');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Search & AI State
  const [searchFilter, setSearchFilter] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Sorting & Pagination
  const [sortColumn, setSortColumn] = useState('market_cap_cr');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Visual Sliders State
  const [universe, setUniverse] = useState('ALL NSE');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [marketCapCat, setMarketCapCat] = useState('ALL');
  const [minRoce, setMinRoce] = useState(15);
  const [minRoe, setMinRoe] = useState(12);
  const [maxPe, setMaxPe] = useState(40);
  const [maxPb, setMaxPb] = useState(10);
  const [maxDebt, setMaxDebt] = useState(1.5);
  const [minSalesGrowth, setMinSalesGrowth] = useState(8);
  const [minProfitGrowth, setMinProfitGrowth] = useState(10);
  const [minRsi, setMinRsi] = useState(0);
  const [maxRsi, setMaxRsi] = useState(100);
  const [minVolRatio, setMinVolRatio] = useState(0.8);
  const [minAiScore, setMinAiScore] = useState(50);

  // Formula State
  const [formulaQuery, setFormulaQuery] = useState('MarketCap > 0 AND ROCE > 15 AND PE < 40');

  // Query Results & Presets
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [prebuiltTemplates, setPrebuiltTemplates] = useState([]);
  const [savedScreens, setSavedScreens] = useState([]);
  const [activePresetId, setActivePresetId] = useState('all-nse');

  // Multi-Selection & Flyout
  const [selectedTickers, setSelectedTickers] = useState(new Set());
  const [inspectedStock, setInspectedStock] = useState(null);

  // WebSocket Live Ticks
  const [liveTicks, setLiveTicks] = useState({});
  const wsRef = useRef(null);

  // Modal States
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [screenName, setScreenName] = useState('');
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState(null);
  const [holdingDays, setHoldingDays] = useState(20);
  const [sttRate, setSttRate] = useState(0.001);

  // 1. Initial Load & Presets
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.get('/api/screener/screens');
        setPrebuiltTemplates(data.prebuilt_templates || []);
        setSavedScreens(data.saved_screens || []);
      } catch (err) {
        console.error('Failed to load screen presets', err);
      }
      runScreen('MarketCap > 0');
    };
    init();
  }, []);

  // 2. Build Formula from Sliders
  const buildVisualFormula = useCallback(() => {
    let parts = [
      `ROCE > ${minRoce}`,
      `ROE > ${minRoe}`,
      `PE < ${maxPe}`,
      `PB < ${maxPb}`,
      `DebtToEquity < ${maxDebt}`,
      `SalesGrowth3Y > ${minSalesGrowth}`,
      `ProfitGrowth3Y > ${minProfitGrowth}`,
      `RSI14 > ${minRsi}`,
      `RSI14 < ${maxRsi}`,
      `VolumeRatio20D > ${minVolRatio}`,
      `AIConsensus > ${minAiScore}`
    ];
    if (selectedSector !== 'ALL') parts.push(`Sector == '${selectedSector}'`);
    if (marketCapCat !== 'ALL') parts.push(`MarketCapCat == '${marketCapCat}'`);
    return parts.join(' AND ');
  }, [minRoce, minRoe, maxPe, maxPb, maxDebt, minSalesGrowth, minProfitGrowth, minRsi, maxRsi, minVolRatio, minAiScore, selectedSector, marketCapCat]);

  // Sync formula text in visual mode
  useEffect(() => {
    if (queryMode === 'visual') {
      setFormulaQuery(buildVisualFormula());
    }
  }, [queryMode, buildVisualFormula]);

  // 3. Run Screen API
  const runScreen = async (query = null) => {
    setLoading(true);
    const activeQuery = query || (queryMode === 'formula' ? formulaQuery : buildVisualFormula());
    try {
      const { data } = await api.post('/api/screener/query', {
        formula_query: activeQuery || "MarketCap > 0",
        sort_by: sortColumn || "market_cap_cr",
        sort_dir: sortDirection === 'asc' ? "ASC" : "DESC",
        limit: 1000,
        offset: 0
      });
      setResults(data.results || []);
    } catch (err) {
      console.error('Screener query error:', err);
      toast.error(err.response?.data?.detail || 'Screener query failed');
    } finally {
      setLoading(false);
    }
  };

  // 4. WebSocket Feed for Live Price Ticks
  useEffect(() => {
    const wsUrl = getWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (results.length > 0) {
        const topTickers = results.slice(0, 50).map(r => r.ticker);
        ws.send(JSON.stringify({ subscribe: topTickers }));
      }
    };

    ws.onmessage = (evt) => {
      try {
        const tick = JSON.parse(evt.data);
        if (tick.ticker && tick.price) {
          setLiveTicks(prev => ({
            ...prev,
            [tick.ticker]: { price: tick.price, change_pct: tick.change_pct, is_live: tick.is_live }
          }));
        }
      } catch (_) {}
    };

    return () => ws.close();
  }, [results]);

  // 5. AI Translate Natural Language
  const handleAiTranslate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post('/api/screener/ai-parse', { prompt: aiPrompt });
      if (data.formula_query) {
        setFormulaQuery(data.formula_query);
        setQueryMode('formula');
        setActivePresetId(null);
        setPage(1);
        runScreen(data.formula_query);
        toast.success(`AI Screen: ${data.formula_query}`);
      } else {
        toast.error('Could not generate formula.');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'AI query error');
    } finally {
      setAiLoading(false);
    }
  };

  // 6. Real Historical Backtest
  const handleRunBacktest = async () => {
    setShowBacktestModal(true);
    setBacktestLoading(true);
    const activeQuery = queryMode === 'formula' ? formulaQuery : buildVisualFormula();
    try {
      const { data } = await api.post('/api/screener/backtest', {
        formula_query: activeQuery,
        holding_period_days: holdingDays,
        stt_rate: sttRate
      });
      setBacktestResults(data);
      toast.success('Historical screen backtest completed!');
    } catch (err) {
      toast.error('Screen backtest failed.');
    } finally {
      setBacktestLoading(false);
    }
  };

  // 7. Save Custom Screen
  const handleSaveScreen = async () => {
    if (!screenName.trim()) {
      toast.error('Please enter a screen name.');
      return;
    }
    try {
      const activeQuery = queryMode === 'formula' ? formulaQuery : buildVisualFormula();
      await api.post('/api/screener/screens', { name: screenName, formula_query: activeQuery, is_public: true });
      toast.success(`Screen saved successfully!`);
      setShowSaveModal(false);
      setScreenName('');
      const res = await api.get('/api/screener/screens');
      setSavedScreens(res.data.saved_screens || []);
    } catch (err) {
      toast.error('Failed to save screen.');
    }
  };

  // Quick Strategy Pill Apply
  const applyPreset = (id, query, name) => {
    setActivePresetId(id);
    setFormulaQuery(query);
    setQueryMode('formula');
    setPage(1);
    runScreen(query);
    toast.success(`Applied: ${name}`);
  };

  // Reset Sliders
  const handleResetFilters = () => {
    setMinRoce(0); setMinRoe(0); setMaxPe(100); setMaxPb(25); setMaxDebt(3.0);
    setMinSalesGrowth(-10); setMinProfitGrowth(-10); setMinRsi(0); setMaxRsi(100);
    setMinVolRatio(0.5); setMinAiScore(30); setSelectedSector('ALL'); setMarketCapCat('ALL');
    setFormulaQuery('MarketCap > 0'); setActivePresetId('all-nse'); setPage(1);
    runScreen('MarketCap > 0');
    toast.success('Filters reset to default.');
  };

  // Filter & Sort Results
  const processedResults = useMemo(() => {
    let list = [...results];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(r => r.ticker?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q) || r.sector?.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let valA = a[sortColumn], valB = b[sortColumn];
      if (valA == null) return 1; if (valB == null) return -1;
      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
    return list;
  }, [results, searchFilter, sortColumn, sortDirection]);

  // Paginated Rows
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedResults.slice(start, start + pageSize);
  }, [processedResults, page, pageSize]);

  // Derived KPI Stats
  const kpiStats = useMemo(() => {
    let bullish = 0, volumeSurges = 0, oversold = 0, totalScore = 0;
    processedResults.forEach(r => {
      if (r.ai_signal === 'BUY' || r.ai_signal === 'STRONG BUY') bullish++;
      if ((r.volume_ratio_20d || 1) > 1.3) volumeSurges++;
      if ((r.rsi_14 || 50) < 38) oversold++;
      totalScore += (r.ai_consensus_score || 50);
    });
    return {
      total: processedResults.length,
      bullish,
      volumeSurges,
      oversold,
      avgScore: processedResults.length > 0 ? (totalScore / processedResults.length).toFixed(0) : 50
    };
  }, [processedResults]);

  // CSV Export
  const handleExportCsv = (dataToExport = processedResults) => {
    if (dataToExport.length === 0) { toast.error('No data to export.'); return; }
    const headers = ['Ticker', 'Name', 'Sector', 'Price', '1D %', 'P/E', 'ROCE %', 'ROE %', 'D/E', 'RSI 14', 'Vol Surge', 'Market Cap Cr', 'AI Score'];
    const rows = [headers.join(',')];
    dataToExport.forEach(r => {
      rows.push([
        `"${r.ticker || ''}"`, `"${(r.name || '').replace(/"/g, '""')}"`, `"${r.sector || ''}"`,
        r.close_price || '', r.change_1d_pct || '', r.pe_ratio || '', r.roce_pct || '',
        r.roe_pct || '', r.debt_to_equity || '', r.rsi_14 || '', r.volume_ratio_20d || '',
        r.market_cap_cr || '', r.ai_consensus_score || ''
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `StockOracle_Screener_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success(`Exported ${dataToExport.length} stocks to CSV!`);
  };

  const quickPills = [
    { id: 'all-nse', name: '🌐 All NSE Equities', query: 'MarketCap > 0' },
    { id: 'high-roce', name: '💎 High ROCE (>20%)', query: 'ROCE > 20 AND DebtToEquity < 0.5' },
    { id: 'value-growth', name: '🔥 Growth at Fair Value', query: 'ROCE > 18 AND PE < 28 AND DebtToEquity < 1.0' },
    { id: 'oversold', name: '⚡ Oversold Momentum', query: 'RSI14 < 40 AND VolumeRatio20D > 1.1' },
    { id: 'ai-bulls', name: '🤖 AI High Consensus', query: 'AIConsensus > 75 AND VolumeRatio20D > 1.0' },
    { id: 'low-debt', name: '🛡️ Low Debt Quality', query: 'DebtToEquity < 0.2 AND ROCE > 15' },
  ];

  return (
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14, height: '100%', boxSizing: 'border-box', background: '#030712', color: '#F1F5F9' }}>
      
      {/* 1. Header Bar */}
      <ScreenerHeaderBar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
        queryMode={queryMode}
        onExportCsv={() => handleExportCsv(processedResults)}
        onOpenSaveModal={() => setShowSaveModal(true)}
        onOpenBacktestModal={handleRunBacktest}
      />

      {/* 2. KPI Summary Cards */}
      <ScreenerKpiCards stats={kpiStats} />

      {/* 3. AI Natural Language Prompt Bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#080D1F', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#A855F7', fontSize: '0.74rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
          <Sparkles size={15} /> AI Natural Query:
        </div>
        <input
          type="text"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAiTranslate()}
          placeholder="e.g. 'high ROCE debt-free IT companies with RSI < 40'..."
          style={{ flex: 1, background: 'transparent', border: 'none', color: '#F1F5F9', fontSize: '0.78rem', outline: 'none' }}
        />
        <button
          onClick={handleAiTranslate}
          disabled={aiLoading}
          style={{ padding: '5px 14px', borderRadius: 6, background: '#6366F1', color: '#FFF', border: 'none', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          {aiLoading ? <RefreshCw size={12} className="spin" /> : <Play size={12} />} Search AI
        </button>
      </div>

      {/* 4. Strategy Quick Pills */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, alignItems: 'center' }}>
        <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', marginRight: 2 }}>Presets:</span>
        {quickPills.map(p => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id, p.query, p.name)}
            style={{
              padding: '4px 10px', borderRadius: 14,
              background: activePresetId === p.id ? 'rgba(99,102,241,0.28)' : 'rgba(255,255,255,0.03)',
              border: activePresetId === p.id ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.06)',
              color: activePresetId === p.id ? '#A5B4FC' : '#94A3B8',
              fontSize: '0.68rem', fontWeight: activePresetId === p.id ? 800 : 500, cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {p.name}
          </button>
        ))}
        {prebuiltTemplates.map(tpl => (
          <button
            key={tpl.id}
            onClick={() => applyPreset(tpl.id, tpl.formula_query, tpl.name)}
            style={{
              padding: '4px 10px', borderRadius: 14,
              background: activePresetId === tpl.id ? 'rgba(99,102,241,0.28)' : 'rgba(255,255,255,0.03)',
              border: activePresetId === tpl.id ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.06)',
              color: activePresetId === tpl.id ? '#A5B4FC' : '#64748B',
              fontSize: '0.68rem', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {tpl.name}
          </button>
        ))}
      </div>

      {/* 5. Sector Distribution Heatmap Chart */}
      <ScreenerSectorChart
        rows={processedResults}
        selectedSector={selectedSector}
        onSelectSector={(sec) => { setSelectedSector(sec); if (queryMode === 'visual') runScreen(); }}
      />

      {/* 6. Expandable Filter Drawer */}
      {filtersOpen && (
        <ScreenerFilters
          universe={universe} setUniverse={setUniverse}
          selectedSector={selectedSector} setSelectedSector={setSelectedSector}
          marketCapCat={marketCapCat} setMarketCapCat={setMarketCapCat}
          minRoce={minRoce} setMinRoce={setMinRoce}
          minRoe={minRoe} setMinRoe={setMinRoe}
          maxPe={maxPe} setMaxPe={setMaxPe}
          maxPb={maxPb} setMaxPb={setMaxPb}
          maxDebt={maxDebt} setMaxDebt={setMaxDebt}
          minSalesGrowth={minSalesGrowth} setMinSalesGrowth={setMinSalesGrowth}
          minProfitGrowth={minProfitGrowth} setMinProfitGrowth={setMinProfitGrowth}
          minRsi={minRsi} setMinRsi={setMinRsi}
          maxRsi={maxRsi} setMaxRsi={setMaxRsi}
          minVolRatio={minVolRatio} setMinVolRatio={setMinVolRatio}
          minAiScore={minAiScore} setMinAiScore={setMinAiScore}
          queryMode={queryMode} setQueryMode={setQueryMode}
          formulaQuery={formulaQuery} setFormulaQuery={setFormulaQuery}
          onResetFilters={handleResetFilters}
          onRunScreen={() => { setPage(1); runScreen(); }}
          loading={loading}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {/* 7. Category Column Tabs & Quick Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, background: '#080D1E', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[
            { id: 'all', label: 'All Columns' },
            { id: 'valuation', label: 'Valuation & Ratios' },
            { id: 'technical', label: 'Technical & RSI' },
            { id: 'ai', label: 'AI Score & Signal' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: activeTab === t.id ? 'rgba(99,102,241,0.25)' : 'transparent',
                color: activeTab === t.id ? '#818CF8' : '#64748B',
                fontSize: '0.7rem', fontWeight: activeTab === t.id ? 800 : 500, cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Search size={12} color="#64748B" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search ticker, name..."
              style={{ background: 'transparent', border: 'none', color: '#F1F5F9', fontSize: '0.72rem', outline: 'none', width: 140 }}
            />
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>
            Matches: <strong style={{ color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>{processedResults.length}</strong>
          </div>
        </div>
      </div>

      {/* 8. Table Container */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#080D1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, minHeight: '380px', position: 'relative' }}>
        <ScreenerTable
          rows={paginatedRows}
          loading={loading}
          sortBy={sortColumn}
          sortDir={sortDirection}
          onSort={(col) => {
            if (sortColumn === col) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
            else { setSortColumn(col); setSortDirection('desc'); }
          }}
          activeTab={activeTab}
          selectedTickers={selectedTickers}
          onToggleSelect={(sym) => {
            setSelectedTickers(prev => {
              const next = new Set(prev);
              if (next.has(sym)) next.delete(sym); else next.add(sym);
              return next;
            });
          }}
          onToggleSelectAll={() => {
            if (paginatedRows.every(r => selectedTickers.has(r.ticker))) {
              setSelectedTickers(prev => {
                const next = new Set(prev);
                paginatedRows.forEach(r => next.delete(r.ticker));
                return next;
              });
            } else {
              setSelectedTickers(prev => {
                const next = new Set(prev);
                paginatedRows.forEach(r => next.add(r.ticker));
                return next;
              });
            }
          }}
          onInspect={(stock) => setInspectedStock(stock)}
          onNavigateChart={(sym) => { setSelectedSymbol(sym); setActiveView('Live Chart'); }}
          onNavigateFundamentals={(sym) => { setSelectedSymbol(sym); setActiveView('Fundamentals'); }}
          liveTicks={liveTicks}
        />
      </div>

      {/* 9. Server-side Pagination */}
      <ScreenerPagination
        totalItems={processedResults.length}
        page={page}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
      />

      {/* 10. Bulk Floating Bar */}
      <ScreenerBulkBar
        selectedCount={selectedTickers.size}
        selectedTickers={Array.from(selectedTickers)}
        onClearSelection={() => setSelectedTickers(new Set())}
        onExportSelected={() => {
          const selectedRows = processedResults.filter(r => selectedTickers.has(r.ticker));
          handleExportCsv(selectedRows);
        }}
        allResults={processedResults}
      />

      {/* 11. Stock Inspection Drawer */}
      {inspectedStock && (
        <ScreenerFlyoutDrawer
          stock={inspectedStock}
          onClose={() => setInspectedStock(null)}
          onNavigateChart={(sym) => { setSelectedSymbol(sym); setActiveView('Live Chart'); }}
          onNavigateFundamentals={(sym) => { setSelectedSymbol(sym); setActiveView('Fundamentals'); }}
        />
      )}

      {/* 12. Real Historical Backtest Modal */}
      <ScreenerBacktestModal
        isOpen={showBacktestModal}
        onClose={() => setShowBacktestModal(false)}
        loading={backtestLoading}
        results={backtestResults}
        holdingDays={holdingDays}
        setHoldingDays={setHoldingDays}
        sttRate={sttRate}
        setSttRate={setSttRate}
        onRerun={handleRunBacktest}
      />

      {/* 13. Save Custom Screen Modal */}
      <ScreenerSaveModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        screenName={screenName}
        setScreenName={setScreenName}
        onSave={handleSaveScreen}
      />

    </div>
  );
}
