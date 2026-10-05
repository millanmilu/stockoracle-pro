// Pro Terminal V2 — Main Entry Point
// Completely isolated experimental module. No imports from existing project code.

import React, { useRef } from 'react';
import { useProTerminalV2 } from './hooks/useProTerminalV2';
import V2TopNavigation from './components/V2TopNavigation';
import V2ChartToolbar from './components/V2ChartToolbar';
import V2DrawingToolbar from './components/V2DrawingToolbar';
import V2ObjectTree from './components/V2ObjectTree';
import V2StockPanel from './components/V2StockPanel';
import V2BottomTabs from './components/V2BottomTabs';
import V2OrderModal from './components/V2OrderModal';
import V2Chart from './chart/V2Chart';
import V2Volume from './chart/V2Volume';
import V2RSI from './chart/V2RSI';
import V2MACD from './chart/V2MACD';
import V2AITrend from './chart/V2AITrend';
import { V2_COLORS, V2_INDICATORS, V2_AI_INDICATORS } from './utils/constants';
import { formatPrice, formatChange, formatPercent, formatVolume } from './utils/formatters';
import { createPaneSync } from './utils/paneSync';
import './styles/proTerminalV2.css';

// Top-nav items that map onto a bottom workspace tab
const NAV_TO_TAB = {
  Markets: 'overview',
  Screener: 'screener',
  Watchlist: 'overview',
  Portfolio: 'financials',
  News: 'news',
  'AI Analytics': 'ai_analysis',
};

export default function ProTerminalV2() {
  const v2 = useProTerminalV2();
  const paneSyncRef = useRef(null);
  if (!paneSyncRef.current) paneSyncRef.current = createPaneSync();
  const chartApiRef = useRef(null);

  const isPositive = v2.priceChange >= 0;

  const dataWindow = {
    symbol: v2.symbol,
    price: v2.currentPrice,
    changePct: v2.priceChangePct,
    volume: v2.lastCandle.volume,
    rsi: v2.technical?.rsi,
    macd: v2.technical?.macd,
    ema20: v2.technical?.ema20,
    ema50: v2.technical?.ema50,
  };

  return (
    <div className="v2-terminal" style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: V2_COLORS.bg.primary,
      color: V2_COLORS.text.primary,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      overflow: 'hidden',
    }}>
      {/* Top Navigation */}
      <V2TopNavigation
        activeView="Chart"
        onNavigate={(item) => {
          const tab = NAV_TO_TAB[item];
          if (tab) v2.setBottomTab(tab);
        }}
        symbols={v2.symbols}
        onSelectSymbol={v2.handleSymbolChange}
        searchOpen={v2.searchOpen}
        onSearchOpenChange={v2.setSearchOpen}
        searchQuery={v2.searchQuery}
        onSearchQueryChange={v2.setSearchQuery}
        onToggleSettings={() => v2.setShowSettings(!v2.showSettings)}
      />

      {/* Chart Toolbar */}
      <V2ChartToolbar
        symbol={v2.symbol}
        symbols={v2.symbols}
        interval={v2.interval}
        chartType={v2.chartType}
        exchange={v2.exchange}
        isFullscreen={v2.isFullscreen}
        canUndo={v2.canUndo}
        canRedo={v2.canRedo}
        onSymbolChange={v2.handleSymbolChange}
        onIntervalChange={v2.handleIntervalChange}
        onChartTypeChange={v2.handleChartTypeChange}
        onExchangeChange={v2.setExchange}
        onToggleIndicators={() => v2.setShowIndicatorModal(!v2.showIndicatorModal)}
        onToggleAI={() => v2.setShowAIModal(!v2.showAIModal)}
        onToggleSettings={() => v2.setShowSettings(!v2.showSettings)}
        onToggleFullscreen={v2.handleToggleFullscreen}
        onUndo={v2.undoDrawings}
        onRedo={v2.redoDrawings}
        onSave={v2.persistDrawings}
        onScreenshot={() => chartApiRef.current?.screenshot?.()}
        onResetView={() => chartApiRef.current?.resetView?.()}
        onTemplateChange={v2.applyTemplate}
        onTrade={(side) => v2.setOrderModalSide(side)}
      />

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Drawing Toolbar */}
        <V2DrawingToolbar
          activeTool={v2.activeDrawingTool}
          onToolChange={v2.handleDrawingToolChange}
          showMenu={v2.showDrawingMenu}
          onToggleMenu={v2.setShowDrawingMenu}
          magnetEnabled={v2.magnetEnabled}
          drawingsLocked={v2.drawingsLocked}
          allDrawingsHidden={v2.allDrawingsHidden}
          onToggleMagnet={v2.toggleMagnet}
          onToggleLock={v2.toggleDrawingsLocked}
          onToggleHide={v2.toggleAllDrawingsHidden}
          onClearDrawings={v2.clearDrawings}
        />

        {/* Center: Chart + Sub-panes */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Chart Header Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '6px 12px',
            background: V2_COLORS.bg.secondary,
            borderBottom: `1px solid ${V2_COLORS.bg.border}`,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: V2_COLORS.text.primary }}>
                {v2.fundamentals.name}
              </div>
              <div style={{ fontSize: 10, color: V2_COLORS.text.muted }}>
                {v2.symbol} · {v2.exchange} · {v2.interval}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: V2_COLORS.text.primary }}>
                {formatPrice(v2.currentPrice)}
              </span>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: isPositive ? V2_COLORS.positive : V2_COLORS.negative,
              }}>
                {formatChange(v2.priceChange)} ({formatPercent(v2.priceChangePct)})
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', fontSize: 10 }}>
              <OHLCItem label="O" value={v2.lastCandle.open} />
              <OHLCItem label="H" value={v2.lastCandle.high} />
              <OHLCItem label="L" value={v2.lastCandle.low} />
              <OHLCItem label="C" value={v2.lastCandle.close} />
              <OHLCItem label="VOL" value={v2.lastCandle.volume} isVolume />
            </div>
          </div>

          {/* Main Chart */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <V2Chart
              candles={v2.candles}
              chartType={v2.chartType}
              ema20={v2.ema20}
              ema50={v2.ema50}
              ema200={v2.ema200}
              activeIndicators={v2.activeIndicators}
              currentPrice={v2.currentPrice}
              symbol={v2.symbol}
              interval={v2.interval}
              activeDrawingTool={v2.activeDrawingTool}
              drawings={v2.drawings}
              onAddDrawing={v2.addDrawing}
              drawingsLocked={v2.drawingsLocked}
              magnetEnabled={v2.magnetEnabled}
              allDrawingsHidden={v2.allDrawingsHidden}
              aiAnalysis={v2.aiAnalysis}
              activeAiIndicators={v2.activeAiIndicators}
              paneSync={paneSyncRef.current}
              apiRef={chartApiRef}
            />
          </div>

          {/* Sub-panes */}
          <V2Volume
            volumeData={v2.volumeData}
            height={v2.volumeHeight}
            visible={v2.activeIndicators.includes('volume')}
            paneSync={paneSyncRef.current}
          />
          <V2RSI
            rsiData={v2.rsiData}
            height={v2.rsiHeight}
            visible={v2.activeIndicators.includes('rsi')}
            paneSync={paneSyncRef.current}
          />
          <V2MACD
            macdData={v2.macdData}
            height={v2.macdHeight}
            visible={v2.activeIndicators.includes('macd')}
            paneSync={paneSyncRef.current}
          />
          <V2AITrend
            aiTrendData={v2.aiTrendData}
            height={v2.aiTrendHeight}
            visible={v2.activeIndicators.includes('ai_trend')}
            paneSync={paneSyncRef.current}
          />
        </div>

        {/* Right: Object Tree + Stock Panel */}
        <div className="v2-sidepanels" style={{ display: 'flex', flexShrink: 0 }}>
          <V2ObjectTree
            activeTab={v2.objectTreeTab}
            onTabChange={v2.setObjectTreeTab}
            drawings={v2.drawings}
            activeIndicators={v2.activeIndicators}
            onToggleIndicator={v2.toggleIndicator}
            activeAiIndicators={v2.activeAiIndicators}
            onToggleAiIndicator={v2.toggleAiIndicator}
            onToggleDrawingVisibility={v2.toggleDrawingVisibility}
            onToggleDrawingLock={v2.toggleDrawingLock}
            onRemoveDrawing={v2.removeDrawing}
            dataWindow={dataWindow}
          />
          <V2StockPanel
            symbol={v2.symbol}
            currentPrice={v2.currentPrice}
            priceChange={v2.priceChange}
            priceChangePct={v2.priceChangePct}
            fundamentals={v2.fundamentals}
            technical={v2.technical}
            news={v2.news}
            orders={v2.orders}
            activeTab={v2.rightPanelTab}
            onTabChange={v2.setRightPanelTab}
            onOrder={(side) => v2.setOrderModalSide(side)}
          />
        </div>
      </div>

      {/* Bottom Analytics Workspace */}
      <V2BottomTabs
        activeTab={v2.bottomTab}
        onTabChange={v2.setBottomTab}
        screenerFilters={v2.screenerFilters}
        onAddFilter={v2.addScreenerFilter}
        onRemoveFilter={v2.removeScreenerFilter}
        screenerResults={v2.screenerResults}
        scanning={v2.scanning}
        onScan={v2.runScreenerScan}
        onSaveFilters={v2.saveScreenerFilters}
        screenerSymbol={v2.symbol}
        fundamentals={v2.fundamentals}
        aiAnalysis={v2.aiAnalysis}
        news={v2.news}
        marketIndices={v2.marketIndices}
        sectors={v2.sectors}
        candles={v2.candles}
        technical={v2.technical}
        currentPrice={v2.currentPrice}
        watchlist={v2.watchlist}
        onToggleWatchlist={v2.toggleWatchlist}
        onOpenSymbol={v2.handleSymbolChange}
      />

      {/* Indicator Modal */}
      {v2.showIndicatorModal && (
        <V2IndicatorModal
          activeIndicators={v2.activeIndicators}
          onToggle={v2.toggleIndicator}
          onClose={() => v2.setShowIndicatorModal(false)}
        />
      )}

      {/* AI Modal */}
      {v2.showAIModal && (
        <V2AIModal
          activeAiIndicators={v2.activeAiIndicators}
          onToggle={v2.toggleAiIndicator}
          onClose={() => v2.setShowAIModal(false)}
        />
      )}

      {/* Settings Modal */}
      {v2.showSettings && (
        <V2SettingsModal
          onClose={() => v2.setShowSettings(false)}
          chartType={v2.chartType}
          onChartTypeChange={v2.handleChartTypeChange}
        />
      )}

      {/* Paper order ticket */}
      {v2.orderModalSide && (
        <V2OrderModal
          side={v2.orderModalSide}
          symbol={v2.symbol}
          currentPrice={v2.currentPrice}
          onClose={() => v2.setOrderModalSide(null)}
          onSubmit={v2.placeOrder}
        />
      )}
    </div>
  );
}

function OHLCItem({ label, value, isVolume }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ color: V2_COLORS.text.muted, fontSize: 9 }}>{label}</span>
      <span style={{ color: V2_COLORS.text.secondary, fontSize: 11, fontWeight: 500 }}>
        {isVolume ? formatVolume(value) : formatPrice(value)}
      </span>
    </div>
  );
}

function V2ModalShell({ title, onClose, minWidth = 240, children }) {
  return (
    <div className="v2-modal-scrim" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: V2_COLORS.bg.elevated,
          border: `1px solid ${V2_COLORS.bg.borderLight}`,
          borderRadius: 8,
          padding: 12,
          minWidth,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          animation: 'v2-fade-in 0.15s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: V2_COLORS.text.primary }}>{title}</span>
          <button
            onClick={onClose}
            aria-label={`Close ${title}`}
            autoFocus
            style={{ background: 'none', border: 'none', color: V2_COLORS.text.muted, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
          >×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function V2IndicatorModal({ activeIndicators, onToggle, onClose }) {
  return (
    <V2ModalShell title="Indicators" onClose={onClose}>
      {V2_INDICATORS.map((ind) => (
        <button
          key={ind.id}
          onClick={() => onToggle(ind.id)}
          aria-pressed={activeIndicators.includes(ind.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 8px',
            fontSize: 11,
            color: V2_COLORS.text.secondary,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ width: 12, height: 2, background: ind.color, borderRadius: 1 }} />
          <span style={{ flex: 1 }}>{ind.name}</span>
          <span style={{ color: activeIndicators.includes(ind.id) ? V2_COLORS.positive : V2_COLORS.text.muted }}>
            {activeIndicators.includes(ind.id) ? 'ON' : 'OFF'}
          </span>
        </button>
      ))}
    </V2ModalShell>
  );
}

function V2AIModal({ activeAiIndicators, onToggle, onClose }) {
  return (
    <V2ModalShell title="AI Indicators" onClose={onClose}>
      {V2_AI_INDICATORS.map((ind) => {
        const on = activeAiIndicators.includes(ind.id);
        return (
          <button
            key={ind.id}
            onClick={() => onToggle(ind.id)}
            aria-pressed={on}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 8px',
              fontSize: 11,
              color: V2_COLORS.text.secondary,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ width: 12, height: 2, background: V2_COLORS.positive, borderRadius: 1 }} />
            <span style={{ flex: 1 }}>{ind.name}</span>
            <span style={{ color: on ? V2_COLORS.positive : V2_COLORS.text.muted }}>
              {on ? 'ON' : 'OFF'}
            </span>
          </button>
        );
      })}
    </V2ModalShell>
  );
}

function V2SettingsModal({ onClose, chartType, onChartTypeChange }) {
  return (
    <V2ModalShell title="Chart Settings" onClose={onClose} minWidth={320}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: V2_COLORS.text.muted, marginBottom: 4 }}>Chart Type</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['candlestick', 'line', 'area', 'bar'].map((type) => (
            <button
              key={type}
              onClick={() => onChartTypeChange(type)}
              aria-pressed={chartType === type}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                color: chartType === type ? '#fff' : V2_COLORS.text.secondary,
                background: chartType === type ? V2_COLORS.accent.primary : V2_COLORS.bg.tertiary,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          padding: '6px 16px',
          fontSize: 11,
          color: '#fff',
          background: V2_COLORS.accent.primary,
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
        }}>Done</button>
      </div>
    </V2ModalShell>
  );
}
