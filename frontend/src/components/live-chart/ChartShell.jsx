import React from 'react';
import ChartToolbar from '../chart/ChartToolbar';
import ChartCanvas from '../chart/ChartCanvas';
import ChartTradeBar from '../chart/ChartTradeBar';
import ChartTradeDocket from '../chart/ChartTradeDocket';
import IndicatorModal from '../chart/IndicatorModal';
import IndicatorParamsModal from '../chart/IndicatorParamsModal';
import AIDashboard from '../chart/AIDashboard';
import VolumePane from '../chart/VolumePane';
import DrawingTools from '../chart-tools/DrawingTools';
import ChartSettingsModal from '../ChartSettingsModal';
import { saveChartSettings } from '../../utils/chartSettings';
import { isIndicatorVisibleOn } from '../chart/indicatorSettingsSchema';
import LivePriceBadge from './LivePriceBadge';
import ChartOverlays from './ChartOverlays';
import ChartFloaters from './ChartFloaters';
import SmcProLayer from './SmcProLayer';
import OscillatorPanes from './OscillatorPanes';

/**
 * ChartShell — the render tree of LiveChartView.
 *
 * Pure view half of the container/view split: every value it needs is handed
 * down by the controller (../live-chart/LiveChartView.jsx), which owns the
 * state, refs and effects. Markup below is unchanged from the original
 * monolithic component.
 */
export default function ChartShell({
  tk,
  containerRef,
  selectedSymbol,
  interval,
  isMobile,
  isTablet,
  candles,
  chartCandles,
  loading,
  error,
  setError,
  proxyWarning,
  backfillStatus,
  setBackfillStatus,
  loadHistory,
  handleNeedOlderData,
  lastHistoryClose,
  curPrice,
  replayDayChange,
  handleSelectSymbol,
  handleIntervalChange,
  handleResetZoom,
  handleChartTypeChange,
  handlePriceScaleModeChange,
  chartType,
  setChartType,
  priceScaleMode,
  setPriceScaleMode,
  invertScale,
  setInvertScale,
  timezone,
  setTimezone,
  showVolume,
  setShowVolume,
  volumeHeight,
  setVolumeHeight,
  showDrawingTools,
  setShowDrawingTools,
  userToggledDrawRef,
  activeDrawingTool,
  setActiveDrawingTool,
  showSettingsModal,
  setShowSettingsModal,
  showIndicatorModal,
  setShowIndicatorModal,
  activeIndicators,
  customIndicators,
  hiddenIndicators,
  indicatorParamOverrides,
  indicatorSettings,
  setIndicatorSettings,
  handleToggleIndicator,
  handleClearAllIndicators,
  handleToggleHideIndicator,
  handleRemoveIndicator,
  handleMoveIndicator,
  handleOpenIndicatorSettings,
  handleSaveIndicatorParams,
  handleSaveCustomIndicator,
  handleDeleteCustomIndicator,
  activeOscillators,
  resolveDefinition,
  showAIDashboard,
  smcProOn,
  onToggleSmcPro,
  onOpenAlerts,
  showTradeBar,
  showTradeDocket,
  paperPositions,
  paperAccount,
  fetchPaperData,
  isTradeBarCollapsed,
  setIsTradeBarCollapsed,
  activeSymbolPosition,
  isReplaying,
  isJumpMode,
  replayIndex,
  replayPlaying,
  replaySpeed,
  setReplayPlaying,
  exitReplay,
  startReplay,
  stepReplay,
  seekReplay,
  cycleReplaySpeed,
  handleChartClick,
  chartSettings,
  isFullscreen,
  handleToggleFullscreen,
  wsLiveData,
  wsConnected,
  chartCanvasRef,
  activeCandleRef,
  drawingChartRef,
  drawingCandleRef,
  mainChartWrapRef,
  oscPaneRefs,
  volumePaneRef,
  handleVisibleRangeChange,
  handleCrosshairMove,
}) {
  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: tk.chartBg,
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: 0,
        gap: 0,
        border: `1px solid ${tk.toolbarBorder}`,
        borderRadius: 4,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
      }}
    >
      {/* 1. Header Toolbar — live price subscription isolated in LivePriceBadge
          so per-tick updates re-render only the toolbar, never this tree. */}
      <LivePriceBadge symbol={selectedSymbol} fallbackClose={lastHistoryClose}>
        {({ price, changePct, isLive: tickLive }) => (
          <ChartToolbar
            selectedSymbol={selectedSymbol}
            onSelectSymbol={handleSelectSymbol}
            interval={interval}
            onIntervalChange={handleIntervalChange}
            chartType={chartType}
            onChartTypeChange={handleChartTypeChange}
            priceScaleMode={priceScaleMode}
            onPriceScaleModeChange={handlePriceScaleModeChange}
            showDrawingTools={showDrawingTools}
            onToggleDrawingTools={() => { userToggledDrawRef.current = true; setShowDrawingTools((prev) => !prev); }}
            activeDrawingTool={activeDrawingTool}
            onSelectDrawingTool={(id) => { userToggledDrawRef.current = true; setActiveDrawingTool(id); setShowDrawingTools(true); }}
            onOpenSettings={() => setShowSettingsModal(true)}
            showVolume={showVolume}
            onToggleVolume={() => setShowVolume((prev) => !prev)}
            onResetZoom={handleResetZoom}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            activeIndicatorCount={activeIndicators.length}
            onOpenIndicators={() => setShowIndicatorModal(true)}
            livePrice={isReplaying ? curPrice : (price ?? curPrice)}
            liveChange={isReplaying ? replayDayChange : (changePct ?? replayDayChange)}
            isLive={isReplaying ? false : (tickLive ?? wsLiveData)}
            wsConnected={wsConnected}
            isMobile={isMobile}
            isTablet={isTablet}
            isReplaying={isReplaying}
            onToggleReplay={isReplaying ? exitReplay : startReplay}
            showTradeBar={showTradeBar}
            onToggleTradeBar={() => saveChartSettings({ showTradeButton: !showTradeBar })}
            showTradeDocket={showTradeDocket}
            onToggleTradeDocket={() => saveChartSettings({ showTradeDocket: !showTradeDocket })}
            paperPositionCount={paperPositions.length}
            smcProOn={smcProOn}
            onToggleSmcPro={onToggleSmcPro}
            onOpenAlerts={onOpenAlerts}
          />
        )}
      </LivePriceBadge>

      {/* AI Signal Dashboard Strip */}
      {showAIDashboard && (
        <AIDashboard
          candles={chartCandles}
          symbol={selectedSymbol}
          interval={interval}
        />
      )}

      {/* 2. Main Terminal Viewport (Left Drawing Tools + Chart Canvas + Sub-panes) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          width: '100%',
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 0,
          borderTop: `1px solid ${tk.toolbarBorder}`,
          backgroundColor: tk.chartBg,
        }}
      >
        {/* Left Vertical Drawing Toolbar & Coordinate-Synced SVG Drawing Layer */}
        <DrawingTools
          chartRef={drawingChartRef}
          candleRef={drawingCandleRef}
          candles={chartCandles}
          symbol={selectedSymbol}
          interval={interval}
          chartReady={!loading && chartCandles.length > 0}
          onOpenSettings={() => setShowSettingsModal(true)}
          isOpen={showDrawingTools}
          onToggleOpen={() => { userToggledDrawRef.current = true; setShowDrawingTools((prev) => !prev); }}
          activeTool={activeDrawingTool}
          onActiveToolChange={setActiveDrawingTool}
          isMobile={isMobile}
          mainPaneRef={mainChartWrapRef}
        />

        {/* Center/Right Chart Column (Canvas + Oscillators) */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            minWidth: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div ref={mainChartWrapRef} style={{ flex: 1, position: 'relative', width: '100%', minHeight: 0, overflow: 'hidden', backgroundColor: tk.chartBg }}>
            <ChartOverlays
              tk={tk}
              loading={loading}
              hasCandles={candles.length > 0}
              symbol={selectedSymbol}
              error={error}
              onRetry={() => loadHistory(selectedSymbol, interval)}
              onDismissError={() => setError(null)}
              proxyWarning={proxyWarning}
              backfillStatus={backfillStatus}
              onRetryBackfill={() => handleNeedOlderData(true)}
              onDismissBackfill={() => setBackfillStatus(null)}
            />

            <ChartCanvas
              ref={chartCanvasRef}
              candles={chartCandles}
              activeCandleRef={activeCandleRef}
              interval={interval}
              selectedSymbol={selectedSymbol}
              chartType={chartType}
              priceScaleMode={priceScaleMode}
              invertScale={invertScale}
              showVolume={showVolume}
              timezone={timezone}
              livePrice={curPrice}
              liveChange={replayDayChange}
              activeIndicators={activeIndicators}
              customIndicators={customIndicators}
              hiddenIndicators={hiddenIndicators}
              indicatorOverrides={indicatorParamOverrides}
              onToggleHideIndicator={handleToggleHideIndicator}
              onRemoveIndicator={handleRemoveIndicator}
              onVisibleRangeChange={handleVisibleRangeChange}
              onCrosshairMove={handleCrosshairMove}
              onChartClick={handleChartClick}
              onNeedOlderData={handleNeedOlderData}
              paperPosition={chartSettings.showPositionLines === false ? null : activeSymbolPosition}
            />

            {/* On-Chart Live Paper Trading Bar */}
            {showTradeBar && (
              <ChartTradeBar
                symbol={selectedSymbol}
                livePrice={curPrice}
                activePosition={activeSymbolPosition}
                availableCash={paperAccount?.cash_balance ?? 1000000.0}
                onTradeExecuted={fetchPaperData}
                isCollapsed={isTradeBarCollapsed}
                onToggleCollapse={() => setIsTradeBarCollapsed((prev) => !prev)}
              />
            )}

            {/* SMC Pro institutional overlays (zones, structure, liquidity,
                setup, killzones) — SVG above canvas, click-through. */}
            <SmcProLayer
              key={`${selectedSymbol}:${interval}:${isReplaying}`}
              chartCanvasRef={chartCanvasRef}
              candles={chartCandles}
              symbol={selectedSymbol}
              interval={interval}
              active={smcProOn && !hiddenIndicators.includes('smc_pro') && isIndicatorVisibleOn(indicatorParamOverrides?.smc_pro, interval)}
              indicatorOverrides={indicatorParamOverrides?.smc_pro}
              activeCandleRef={activeCandleRef}
              isReplaying={isReplaying}
            />

            <ChartFloaters
              isReplaying={isReplaying}
              isJumpMode={isJumpMode}
              showCountdown={chartSettings.showCountdown}
              chartCanvasRef={chartCanvasRef}
              activeCandleRef={activeCandleRef}
              symbol={selectedSymbol}
              interval={interval}
              currentPrice={curPrice}
              chartCandles={chartCandles}
              totalCandles={candles.length}
              replayIndex={replayIndex}
              replayPlaying={replayPlaying}
              replaySpeed={replaySpeed}
              onPlayPause={() => setReplayPlaying((p) => !p)}
              onStep={stepReplay}
              onSeek={seekReplay}
              onSpeed={cycleReplaySpeed}
              onExit={exitReplay}
              isMobile={isMobile}
              drawingChartRef={drawingChartRef}
              drawingCandleRef={drawingCandleRef}
              activeIndicators={activeIndicators}
              hiddenIndicators={hiddenIndicators}
              indicatorParamOverrides={indicatorParamOverrides}
            />
          </div>

          <VolumePane
            ref={volumePaneRef}
            candles={chartCandles}
            height={volumeHeight}
            onHeightChange={setVolumeHeight}
            isHidden={!showVolume}
            onToggleHide={() => setShowVolume(false)}
            onVisibleRangeChange={handleVisibleRangeChange}
            onCrosshairMove={handleCrosshairMove}
          />

          <OscillatorPanes
            activeOscillators={activeOscillators}
            resolveDefinition={resolveDefinition}
            chartCandles={chartCandles}
            hiddenIndicators={hiddenIndicators}
            oscPaneRefs={oscPaneRefs}
            onToggleHide={handleToggleHideIndicator}
            onClose={handleRemoveIndicator}
            onVisibleRangeChange={handleVisibleRangeChange}
            onCrosshairMove={handleCrosshairMove}
          />
        </div>
      </div>

      {/* 2b. Bottom Collapsible Paper Trading Docket / Positions Panel */}
      <ChartTradeDocket
        isOpen={showTradeDocket}
        onClose={() => saveChartSettings({ showTradeDocket: false })}
        positions={paperPositions}
        account={paperAccount}
        onRefresh={fetchPaperData}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={handleSelectSymbol}
      />

      {/* 3. Indicator Library Modal */}
      <IndicatorModal
        isOpen={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        activeIndicators={activeIndicators}
        customIndicators={customIndicators}
        hiddenIndicators={hiddenIndicators}
        onToggleIndicator={handleToggleIndicator}
        onToggleHideIndicator={handleToggleHideIndicator}
        onRemoveIndicator={handleRemoveIndicator}
        onClearAll={handleClearAllIndicators}
        onOpenSettings={handleOpenIndicatorSettings}
        onMoveIndicator={handleMoveIndicator}
        onSaveCustomIndicator={handleSaveCustomIndicator}
        onDeleteCustomIndicator={handleDeleteCustomIndicator}
      />

      {/* 4. Indicator Parameter Settings Modal */}
      <IndicatorParamsModal
        indicator={indicatorSettings}
        overrides={indicatorSettings ? indicatorParamOverrides[indicatorSettings.id] || {} : {}}
        onClose={() => setIndicatorSettings(null)}
        onSave={handleSaveIndicatorParams}
      />

      {/* 5. Chart Settings Modal */}
      <ChartSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onApplySettings={(newSettings) => {
          if (newSettings.chartType) setChartType(newSettings.chartType);
          if (newSettings.priceScaleMode) setPriceScaleMode(newSettings.priceScaleMode);
          if (newSettings.invertScale !== undefined) setInvertScale(!!newSettings.invertScale);
          if (newSettings.timezone) setTimezone(newSettings.timezone);
        }}
      />
    </div>
  );
}
