import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './screener/terminal.css';
import { TN } from './screener/terminalTheme';

import ScreenerHeaderBar from './screener/ScreenerHeaderBar';
import ScreenerKpiCards from './screener/ScreenerKpiCards';
import ScreenerSectorChart from './screener/ScreenerSectorChart';
import ScreenerBreadthBar from './screener/ScreenerBreadthBar';
import ScreenerTable from './screener/ScreenerTable';
import ScreenerFlyoutDrawer from './screener/ScreenerFlyoutDrawer';
import ScreenerBulkBar from './screener/ScreenerBulkBar';
import ScreenerBacktestModal from './screener/ScreenerBacktestModal';
import ScreenerSaveModal from './screener/ScreenerSaveModal';
import ScreenerStatusBar from './screener/ScreenerStatusBar';
import { NO_OP_QUERY } from './screener/screenerColumns';
import { ALL_UNIVERSE, UNIVERSE_IDS } from './screener/screenerLocal';
import { useScreenerQuery } from './screener/useScreenerQuery';
import { useScreenerColumns } from './screener/useScreenerColumns';
import { useScreenerSelection } from './screener/useScreenerSelection';
import { useLiveTicks } from './screener/useLiveTicks';
import { useScreenerAi } from './screener/useScreenerAi';
import { useScreenerModals } from './screener/useScreenerModals';
import { ScreenerAiPanel } from './screener/ScreenerAiPanel';
import { ScreenerPresetsRow } from './screener/ScreenerPresetsRow';
import { ScreenerFilterChips } from './screener/ScreenerFilterChips';
import { ScreenerFilterDrawer } from './screener/ScreenerFilterDrawer';
import { ScreenerToolbar } from './screener/ScreenerToolbar';
import { ScreenerAlertModal } from './screener/ScreenerAlertModal';

export default function AdvancedScreener() {
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const setActiveView = useStore(s => s.setActiveView);

  // Mode & drawer
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnGroup, setColumnGroup] = useState('overview');

  // NOTE: the pager bar (page/pageSize state) was removed — the table is
  // virtualized now, so the full result set scrolls with ~30 rows in the DOM.
  // Scroll position resets via ScreenerTable when the result set changes.
  const tableScrollRef = useRef(null);

  const [overview, setOverview] = useState({
    cards: {}, breadth: {}, sectors: [], market_status: 'UNKNOWN', feed_live: false, total: 0,
    // Coverage + freshness from /screener/overview so the UI can distinguish
    // "this filter matched nothing" from "this stock has no data yet".
    coverage: null, sectors_excluded: null, stale: null, expected_refresh_date: null,
  });
  const [prebuiltTemplates, setPrebuiltTemplates] = useState([]);
  const [savedScreens, setSavedScreens] = useState([]);

  // Categorical universes (NIFTY 50 / MIDCAP / sectoral…) with live
  // constituent counts from the backend (official NSE lists). Falls back to
  // the bundled INDEX_CONSTITUENTS if the endpoint is unreachable.
  const [universeOptions, setUniverseOptions] = useState(null);
  const universeIds = useMemo(() => (
    universeOptions ? universeOptions.map((u) => u.id) : UNIVERSE_IDS
  ), [universeOptions]);

  // Collapsible upper panels so the table keeps the majority of the height
  const [sectorsCollapsed, setSectorsCollapsed] = useState(false);
  const [sectorsExpanded, setSectorsExpanded] = useState(false);
  const [showAllChips, setShowAllChips] = useState(false);

  const query = useScreenerQuery();
  const {
    queryMode, setQueryMode, universe, setUniverse, selectedSector, setSelectedSector,
    marketCapCat, setMarketCapCat, minRoce, minRoe, maxPe, maxPb, maxDebt,
    minSalesGrowth, minProfitGrowth, minRsi, maxRsi, minVolRatio, minAiScore,
    touchedFilters, visualSetters, builderEnabled, setBuilderEnabled,
    builderGroups, setBuilderGroups, builderTopLogic, setBuilderTopLogic,
    formulaQuery, setFormulaQuery, loading, results, queryMeta,
    activePresetId, setActivePresetId, activeCard, refreshMode, setRefreshMode,
    buildVisualFormula, activeFormula, activeChips, runScreen,
    applyPreset, applyCard, handleUniverseChange, handleResetFilters, removeChip,
    searchFilter, setSearchFilter, processedResults,
    sortColumn, sortDirection, multiSort, setMultiSort, onSort, rankOptions, rankByChange,
  } = query;

  const {
    colConfig, groupOrderedCols, groupHidden, groupVisibleKeys,
    toggleColumn, moveColumn, resizeColumn, commitColumnWidth, resetWidths,
    showColumnMenu, setShowColumnMenu, handleExportCsv,
  } = useScreenerColumns(columnGroup, processedResults);

  const {
    selectedTickers, inspectedStock, setInspectedStock,
    toggleSelectAll, toggleSelect, clearSelection, inspectStock, navigateChart, navigateFundamentals,
  } = useScreenerSelection(processedResults, setSelectedSymbol, setActiveView);

  const { liveTicks, wsState } = useLiveTicks(results);

  const {
    aiPrompt, setAiPrompt, aiLoading, aiPreview, setAiPreview, handleAiTranslate, applyAiPreview,
  } = useScreenerAi({ setFormulaQuery, setQueryMode, setActivePresetId, runScreen });

  const {
    showSaveModal, setShowSaveModal, screenName, setScreenName,
    showBacktestModal, setShowBacktestModal, backtestLoading, backtestResults, holdingDays, setHoldingDays, sttRate, setSttRate,
    showAlertModal, setShowAlertModal, alertDraft, setAlertDraft,
    handleRunBacktest, handleSaveScreen, handleDeleteScreen, handleCreateAlert, handleAlertFor,
  } = useScreenerModals({ queryMode, formulaQuery, activeFormula, universe, sortColumn, sortDirection, columnGroup, setSavedScreens });

  // ── Initial load ──
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.get('/api/screener/screens');
        setPrebuiltTemplates(data.prebuilt_templates || []);
        setSavedScreens(data.saved_screens || []);
      } catch (err) {
        console.error('Failed to load screen presets', err);
      }
      try {
        const { data } = await api.get('/api/screener/overview');
        setOverview(data);
      } catch (err) {
        console.error('Failed to load screener overview', err);
      }
      try {
        const { data } = await api.get('/api/screener/universes');
        if (Array.isArray(data.universes) && data.universes.length > 0) {
          setUniverseOptions(data.universes);
        }
      } catch (err) {
        console.error('Failed to load screener universes, using fallback', err);
      }
      runScreen(NO_OP_QUERY, ALL_UNIVERSE);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyShareLink = (token) => {
    if (!token) { toast.error('This screen has no share token.'); return; }
    const url = `${window.location.origin}/?screen=${token}`;
    try {
      navigator.clipboard?.writeText(url);
      toast.success('Share link copied to clipboard.');
    } catch (_) {
      toast(url, { icon: '🔗' });
    }
  };

  const dataAsOf = useMemo(() => {
    let latest = null;
    results.forEach(r => {
      if (r.updated_at) {
        const d = new Date(r.updated_at);
        if (!isNaN(d) && (!latest || d > latest)) latest = d;
      }
    });
    return latest ? latest.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;
  }, [results]);

  const kpiStats = useMemo(() => {
    const cards = overview.cards && Object.keys(overview.cards).length ? overview.cards : null;
    if (cards) return { total: overview.total ?? processedResults.length, ...cards };
    let bullish = 0, volumeSurges = 0, oversold = 0, totalScore = 0;
    processedResults.forEach(r => {
      if (r.ai_signal === 'BUY' || r.ai_signal === 'STRONG BUY') bullish++;
      if ((r.volume_ratio_20d || 1) > 1.3) volumeSurges++;
      if ((r.rsi_14 || 50) < 38) oversold++;
      totalScore += (r.ai_consensus_score || 50);
    });
    return { total: processedResults.length, bullish, volumeSurges, oversold, avgScore: processedResults.length > 0 ? (totalScore / processedResults.length).toFixed(0) : 50 };
  }, [processedResults, overview]);

  const handleAddWatchlist = useCallback((stock) => {
    try {
      const ticker = String(stock?.ticker || '').trim();
      const current = JSON.parse(localStorage.getItem('stockoracle_custom_watchlist') || '[]');

      if (!ticker) {
        toast.error('Ticker missing.');
        return;
      }

      const next = Array.from(new Set([...current.map(String), ticker.toUpperCase()]));
      if (next.length === current.length) {
        toast.error(`${ticker.toUpperCase()} is already in your watchlist.`);
        return;
      }

      localStorage.setItem('stockoracle_custom_watchlist', JSON.stringify(next));
      toast.success(`${ticker.toUpperCase()} added to watchlist!`);
    } catch (_) {
      toast.error('Failed to update watchlist.');
    }
  }, []);

  const visibleChips = showAllChips ? activeChips : activeChips.slice(0, 5);

  return (
    <div className="tn-scroll tn-screener-root" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, height: '100%', boxSizing: 'border-box', background: TN.bg, color: TN.text, overflowY: 'auto' }}>
      <ScreenerHeaderBar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
        activeFilterCount={activeChips.length}
        dataAsOf={dataAsOf}
        marketStatus={overview.market_status || 'UNKNOWN'}
        feedLive={overview.feed_live}
        wsState={wsState === 'live' ? 'live' : wsState}
        scannedCount={overview.total || results.length}
        coverage={overview.coverage}
        stale={overview.stale}
        expectedRefreshDate={overview.expected_refresh_date}
        universe={universe}
        onUniverseChange={handleUniverseChange}
        universes={[ALL_UNIVERSE, ...universeIds.filter((u) => u !== ALL_UNIVERSE)]}
        refreshMode={refreshMode}
        onRefreshMode={setRefreshMode}
        onExportCsv={() => handleExportCsv(processedResults)}
        onOpenSaveModal={() => setShowSaveModal(true)}
        // Opening the modal must not fire a simulation: previously this button
        // ran a backtest immediately, so the rebalance/friction controls inside
        // could never be set before the first run.
        onOpenBacktestModal={() => setShowBacktestModal(true)}
        onCreateAlert={() => setShowAlertModal(true)}
        onRefresh={() => runScreen()}
        loading={loading}
      />

      <ScreenerKpiCards stats={kpiStats} activeCard={activeCard} onSelect={applyCard} coverage={overview.coverage} />

      <ScreenerBreadthBar breadth={overview.breadth?.total ? overview.breadth : null} />

      {/* AI Screener — interpretation is always shown before anything is applied */}
      <ScreenerAiPanel
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        aiLoading={aiLoading}
        aiPreview={aiPreview}
        setAiPreview={setAiPreview}
        handleAiTranslate={handleAiTranslate}
        applyAiPreview={applyAiPreview}
        setFormulaQuery={setFormulaQuery}
        setQueryMode={setQueryMode}
      />

      {/* Presets incl. 13 institutional templates */}
      <ScreenerPresetsRow
        prebuiltTemplates={prebuiltTemplates}
        savedScreens={savedScreens}
        activePresetId={activePresetId}
        applyPreset={applyPreset}
        handleCopyShareLink={handleCopyShareLink}
        handleDeleteScreen={handleDeleteScreen}
      />

      <ScreenerSectorChart
        rows={processedResults}
        sectors={overview.sectors || []}
        sectorsExcluded={overview.sectors_excluded}
        selectedSector={selectedSector}
        collapsed={sectorsCollapsed}
        onToggleCollapse={() => setSectorsCollapsed((v) => !v)}
        expanded={sectorsExpanded}
        onToggleExpanded={() => setSectorsExpanded((v) => !v)}
        onSelectSector={(sec) => {
          setSelectedSector(sec);
          if (queryMode === 'visual' && !builderEnabled) runScreen(buildVisualFormula(sec));
        }}
      />

      {/* Active filter chips — compact, one row, never overlaps tabs */}
      {activeChips.length > 0 && (
        <ScreenerFilterChips
          activeChips={activeChips}
          visibleChips={visibleChips}
          removeChip={removeChip}
          showAllChips={showAllChips}
          setShowAllChips={setShowAllChips}
          setShowSaveModal={setShowSaveModal}
          handleResetFilters={handleResetFilters}
        />
      )}

      {/* Filter drawer: sliders + builder + formula */}
      {filtersOpen && (
        <ScreenerFilterDrawer
          queryMode={queryMode}
          setQueryMode={setQueryMode}
          builderEnabled={builderEnabled}
          setBuilderEnabled={setBuilderEnabled}
          handleResetFilters={handleResetFilters}
          runScreen={runScreen}
          loading={loading}
          setFiltersOpen={setFiltersOpen}
          builderGroups={builderGroups}
          setBuilderGroups={setBuilderGroups}
          builderTopLogic={builderTopLogic}
          setBuilderTopLogic={setBuilderTopLogic}
          universe={universe}
          setUniverse={setUniverse}
          handleUniverseChange={handleUniverseChange}
          universeOptions={universeOptions}
          selectedSector={selectedSector}
          setSelectedSector={setSelectedSector}
          marketCapCat={marketCapCat}
          setMarketCapCat={setMarketCapCat}
          visualSetters={visualSetters}
          minRoce={minRoce}
          minRoe={minRoe}
          maxPe={maxPe}
          maxPb={maxPb}
          maxDebt={maxDebt}
          minSalesGrowth={minSalesGrowth}
          minProfitGrowth={minProfitGrowth}
          minRsi={minRsi}
          maxRsi={maxRsi}
          minVolRatio={minVolRatio}
          minAiScore={minAiScore}
          touchedFilters={touchedFilters}
          activeChips={activeChips}
          formulaQuery={formulaQuery}
          setFormulaQuery={setFormulaQuery}
        />
      )}

      {/* Category navigation + rank + search — tabs own full-width row, controls second row */}
      <ScreenerToolbar
        columnGroup={columnGroup}
        setColumnGroup={setColumnGroup}
        showColumnMenu={showColumnMenu}
        setShowColumnMenu={setShowColumnMenu}
        groupHidden={groupHidden}
        groupOrderedCols={groupOrderedCols}
        toggleColumn={toggleColumn}
        moveColumn={moveColumn}
        resetWidths={resetWidths}
        sortColumn={sortColumn}
        rankByChange={rankByChange}
        rankOptions={rankOptions}
        multiSort={multiSort}
        setMultiSort={setMultiSort}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        queryMeta={queryMeta}
        processedResults={processedResults}
      />

      {/* Results table — single vertical scroll root, horizontal inside.
          Rows are virtualized: the full result set scrolls, only visible
          rows sit in the DOM. Deliberately borderless/transparent so it reads
          as page flow rather than a box — scrolling still stays inside this
          container, keeping filters and the sticky header in view. */}
      <div ref={tableScrollRef} className="tn-scroll" style={{ flex: '1 1 auto', minHeight: '55vh', overflowY: 'auto', overflowX: 'auto', background: 'transparent', border: 'none', borderRadius: 0, position: 'relative', width: '100%', minWidth: 0 }}>
        <ScreenerTable
          rows={processedResults}
          loading={loading}
          sortBy={sortColumn}
          sortDir={sortDirection}
          multiSort={multiSort}
          onSort={(col, e) => onSort(col, e)}
          columnGroup={columnGroup}
          visibleColumns={groupVisibleKeys}
          columnOrder={colConfig.order[columnGroup] || null}
          columnWidths={colConfig.widths}
          onResizeColumn={resizeColumn}
          onResizeCommit={commitColumnWidth}
          selectedTickers={selectedTickers}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onInspect={inspectStock}
          onNavigateChart={navigateChart}
          onNavigateFundamentals={navigateFundamentals}
          onAddWatchlist={handleAddWatchlist}
          onAlertFor={handleAlertFor}
          liveTicks={liveTicks}
          scrollRef={tableScrollRef}
        />
      </div>

      <ScreenerStatusBar
        wsState={wsState === 'live' ? 'live' : wsState}
        feedLive={overview.feed_live}
        matchCount={processedResults.length}
        universe={universe}
      />

      <ScreenerBulkBar
        selectedCount={selectedTickers.size}
        selectedTickers={Array.from(selectedTickers)}
        onClearSelection={clearSelection}
        onExportSelected={() => { handleExportCsv(processedResults.filter(r => selectedTickers.has(r.ticker))); }}
        allResults={processedResults}
      />

      {inspectedStock && (
        <ScreenerFlyoutDrawer
          stock={inspectedStock}
          onClose={() => setInspectedStock(null)}
          onNavigateChart={navigateChart}
          onNavigateFundamentals={navigateFundamentals}
          onAddWatchlist={handleAddWatchlist}
          onAnalyzeAI={(s) => { setSelectedSymbol(s.ticker); setActiveView('AI Prediction'); }}
        />
      )}

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

      <ScreenerSaveModal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} screenName={screenName} setScreenName={setScreenName} onSave={handleSaveScreen} />

      {/* Alert-from-screener modal (real smart-alerts API) */}
      {showAlertModal && (
        <ScreenerAlertModal
          setShowAlertModal={setShowAlertModal}
          alertDraft={alertDraft}
          setAlertDraft={setAlertDraft}
          handleCreateAlert={handleCreateAlert}
        />
      )}
    </div>
  );
}
