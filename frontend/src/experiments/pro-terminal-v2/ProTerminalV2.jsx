// Pro Terminal V2 — Main Entry Point
// Completely isolated experimental module. No imports from existing project code.

import React, { useState, useCallback } from 'react';
import { useProTerminalV2 } from './hooks/useProTerminalV2';
import V2TopNavigation from './components/V2TopNavigation';
import V2ChartToolbar from './components/V2ChartToolbar';
import V2DrawingToolbar from './components/V2DrawingToolbar';
import V2ObjectTree from './components/V2ObjectTree';
import V2StockPanel from './components/V2StockPanel';
import V2BottomTabs from './components/V2BottomTabs';
import V2Chart from './chart/V2Chart';
import V2Volume from './chart/V2Volume';
import V2RSI from './chart/V2RSI';
import V2MACD from './chart/V2MACD';
import V2AITrend from './chart/V2AITrend';
import { V2_COLORS } from './utils/constants';
import { formatPrice, formatChange, formatPercent, formatVolume } from './utils/formatters';
import './styles/proTerminalV2.css';

export default function ProTerminalV2() {
  const v2 = useProTerminalV2();
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bottomTab, setBottomTab] = useState('screener');
  const [rightPanelTab, setRightPanelTab] = useState('overview');
  const [objectTreeTab, setObjectTreeTab] = useState('objects');
  const [showDrawingMenu, setShowDrawingMenu] = useState(null);

  const isPositive = v2.priceChange >= 0;

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  return (
    <div className="v2-terminal" style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100vh',
      background: V2_COLORS.bg.primary,
      color: V2_COLORS.text.primary,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      overflow: 'hidden',
    }}>
      {/* Top Navigation */}
      <V2TopNavigation activeView="Chart" onNavigate={() => {}} />

      {/* Chart Toolbar */}
      <V2ChartToolbar
        symbol={v2.symbol}
        interval={v2.interval}
        chartType={v2.chartType}
        onSymbolChange={v2.handleSymbolChange}
        onIntervalChange={v2.handleIntervalChange}
        onChartTypeChange={v2.handleChartTypeChange}
        onToggleIndicators={() => setShowIndicatorModal(!showIndicatorModal)}
        onToggleAI={() => setShowAIModal(!showAIModal)}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Drawing Toolbar */}
        <V2DrawingToolbar
          activeTool={v2.activeDrawingTool}
          onToolChange={v2.handleDrawingToolChange}
          showMenu={showDrawingMenu}
          onToggleMenu={setShowDrawingMenu}
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
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: V2_COLORS.text.primary }}>
                {v2.fundamentals.name}
              </div>
              <div style={{ fontSize: 10, color: V2_COLORS.text.muted }}>
                {v2.interval} · NSE
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
            />
          </div>

          {/* Sub-panes */}
          <V2Volume
            volumeData={v2.volumeData}
            height={v2.volumeHeight}
            visible={v2.activeIndicators.includes('volume')}
          />
          <V2RSI
            rsiData={v2.rsiData}
            height={v2.rsiHeight}
            visible={v2.activeIndicators.includes('rsi')}
          />
          <V2MACD
            macdData={v2.macdData}
            height={v2.macdHeight}
            visible={v2.activeIndicators.includes('macd')}
          />
          <V2AITrend
            aiTrendData={v2.aiTrendData}
            height={v2.aiTrendHeight}
            visible={v2.activeIndicators.includes('ai_trend')}
          />
        </div>

        {/* Right: Object Tree + Stock Panel */}
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <V2ObjectTree
            activeTab={objectTreeTab}
            onTabChange={setObjectTreeTab}
            drawings={v2.drawings}
            onToggleDrawingVisibility={v2.toggleDrawingVisibility}
            onRemoveDrawing={v2.removeDrawing}
          />
          <V2StockPanel
            symbol={v2.symbol}
            currentPrice={v2.currentPrice}
            priceChange={v2.priceChange}
            priceChangePct={v2.priceChangePct}
            fundamentals={v2.fundamentals}
            activeTab={rightPanelTab}
            onTabChange={setRightPanelTab}
          />
        </div>
      </div>

      {/* Bottom Analytics Workspace */}
      <V2BottomTabs
        activeTab={bottomTab}
        onTabChange={setBottomTab}
        screenerFilters={v2.screenerFilters}
        onAddFilter={v2.addScreenerFilter}
        onRemoveFilter={v2.removeScreenerFilter}
        screenerResults={v2.screenerResults}
        fundamentals={v2.fundamentals}
        aiAnalysis={v2.aiAnalysis}
        news={v2.news}
        marketIndices={v2.marketIndices}
        sectors={v2.sectors}
      />

      {/* Indicator Modal */}
      {showIndicatorModal && (
        <V2IndicatorModal
          activeIndicators={v2.activeIndicators}
          onToggle={v2.toggleIndicator}
          onClose={() => setShowIndicatorModal(false)}
        />
      )}

      {/* AI Modal */}
      {showAIModal && (
        <V2AIModal
          onClose={() => setShowAIModal(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <V2SettingsModal
          onClose={() => setShowSettings(false)}
          chartType={v2.chartType}
          onChartTypeChange={v2.handleChartTypeChange}
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

function V2IndicatorModal({ activeIndicators, onToggle, onClose }) {
  const indicators = [
    { id: 'ema_20', name: 'EMA 20', color: '#06B6D4' },
    { id: 'ema_50', name: 'EMA 50', color: '#F97316' },
    { id: 'ema_200', name: 'EMA 200', color: '#A855F7' },
    { id: 'volume', name: 'Volume', color: '#6366F1' },
    { id: 'rsi', name: 'RSI', color: '#F59E0B' },
    { id: 'macd', name: 'MACD', color: '#3B82F6' },
    { id: 'ai_trend', name: 'AI Trend', color: '#10B981' },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      background: V2_COLORS.bg.elevated,
      border: `1px solid ${V2_COLORS.bg.border}`,
      borderRadius: 8,
      padding: 12,
      minWidth: 240,
      zIndex: 1000,
      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: V2_COLORS.text.primary }}>Indicators</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: V2_COLORS.text.muted, cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>
      {indicators.map((ind) => (
        <button
          key={ind.id}
          onClick={() => onToggle(ind.id)}
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
    </div>
  );
}

function V2AIModal({ onClose }) {
  const aiIndicators = [
    { id: 'ai_trend', name: 'AI Trend' },
    { id: 'ai_momentum', name: 'AI Momentum' },
    { id: 'ai_sr', name: 'AI Support/Resistance' },
    { id: 'ai_breakout', name: 'AI Breakout' },
    { id: 'ai_pattern', name: 'AI Pattern Detection' },
    { id: 'ai_forecast', name: 'AI Forecast' },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      background: V2_COLORS.bg.elevated,
      border: `1px solid ${V2_COLORS.bg.border}`,
      borderRadius: 8,
      padding: 12,
      minWidth: 240,
      zIndex: 1000,
      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: V2_COLORS.text.primary }}>AI Indicators</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: V2_COLORS.text.muted, cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>
      {aiIndicators.map((ind) => (
        <button
          key={ind.id}
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
          <span>{ind.name}</span>
        </button>
      ))}
    </div>
  );
}

function V2SettingsModal({ onClose, chartType, onChartTypeChange }) {
  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: V2_COLORS.bg.elevated,
      border: `1px solid ${V2_COLORS.bg.border}`,
      borderRadius: 8,
      padding: 16,
      minWidth: 320,
      zIndex: 1000,
      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: V2_COLORS.text.primary }}>Chart Settings</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: V2_COLORS.text.muted, cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: V2_COLORS.text.muted, marginBottom: 4 }}>Chart Type</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['candlestick', 'line', 'area', 'bar'].map((type) => (
            <button
              key={type}
              onClick={() => onChartTypeChange(type)}
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
    </div>
  );
}
