import React, { useState, useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import ChartToolbar from './chart/ChartToolbar';
import ChartCanvas from './chart/ChartCanvas';
import ChartBottomStats from './chart/ChartBottomStats';
import IndicatorModal from './chart/IndicatorModal';
import IndicatorLegend from './chart/IndicatorLegend';
import OscillatorPane from './chart/OscillatorPane';
import { DEFAULT_ACTIVE_INDICATORS } from './chart/indicatorDefinitions';
import { toChartTime, getSessionBucketStart } from '../utils/chartHelpers';

/**
 * LiveChartView — Rebuilt Clean Master Controller
 * Focused purely on smooth candlestick rendering, accurate historical data,
 * real-time indicators suite, and flicker-free live price tracking.
 */
export default function LiveChartView() {
  const selectedSymbol = useStore(s => s.selectedSymbol || 'RELIANCE');
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const wsLiveData = useStore(s => s.wsLiveData);
  const storeLiveTick = useStore(s => s.livePrices?.[selectedSymbol]);

  const { fetchHistory, searchStocks } = useStock();

  const [interval, setInterval] = useState('1d');
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('angel_one');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Advanced Indicators State
  const [activeIndicators, setActiveIndicators] = useState(() => {
    try {
      const saved = localStorage.getItem('stockoracle_indicators');
      return saved ? JSON.parse(saved) : DEFAULT_ACTIVE_INDICATORS;
    } catch {
      return DEFAULT_ACTIVE_INDICATORS;
    }
  });
  const [hiddenIndicators, setHiddenIndicators] = useState([]);
  const [indicatorValues, setIndicatorValues] = useState({});
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);

  const activeCandleRef = useRef(null);
  const chartCanvasRef = useRef(null);
  const oscillatorPaneRef = useRef(null);
  const containerRef = useRef(null);
  const lastVerifiedPriceRef = useRef(null);

  // Persist active indicators to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('stockoracle_indicators', JSON.stringify(activeIndicators));
    } catch {}
  }, [activeIndicators]);

  // 1. Fetch & Staged Historical Data Loading
  const loadHistory = useCallback(async (symbol, iv) => {
    setLoading(true);
    setError(null);
    activeCandleRef.current = null;

    try {
      const res = await fetchHistory(symbol, iv);
      const rawCandles = res?.candles || [];
      const source = res?.dataSource || 'angel_one';
      setDataSource(source);

      if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
        setCandles([]);
        setLoading(false);
        return;
      }

      const isIntraday = iv !== '1d';
      const formatted = [];

      for (let i = 0; i < rawCandles.length; i++) {
        const c = rawCandles[i];
        const t = toChartTime(c.date || c.time, isIntraday);
        const open = Number(c.open);
        const high = Number(c.high);
        const low = Number(c.low);
        const close = Number(c.close);
        const volume = Number(c.volume || 0);

        // Enforce OHLC consistency invariant & preserve all indicator attributes
        if (t && !isNaN(open) && open > 0 && !isNaN(close) && close > 0 && !isNaN(high) && !isNaN(low)) {
          formatted.push({
            ...c,
            time: t,
            open,
            high: Math.max(high, open, close),
            low: Math.min(low, open, close),
            close,
            volume: isNaN(volume) ? 0 : volume,
          });
        }
      }

      // Ensure strictly sorted by time and duplicate-free
      formatted.sort((a, b) => {
        const timeA = typeof a.time === 'string' ? a.time : Number(a.time);
        const timeB = typeof b.time === 'string' ? b.time : Number(b.time);
        return timeA < timeB ? -1 : timeA > timeB ? 1 : 0;
      });

      const deduplicated = [];
      for (let i = 0; i < formatted.length; i++) {
        if (i === 0 || formatted[i].time !== formatted[i - 1].time) {
          deduplicated.push(formatted[i]);
        } else {
          deduplicated[deduplicated.length - 1] = formatted[i];
        }
      }

      setCandles(deduplicated);

      // Seed activeCandleRef and last verified reference price
      if (deduplicated.length > 0) {
        const last = deduplicated[deduplicated.length - 1];
        lastVerifiedPriceRef.current = last.close;
        activeCandleRef.current = { ...last };
      }
    } catch (err) {
      setError(err?.message || 'Failed to load stock history');
      setCandles([]);
    } finally {
      setLoading(false);
    }
  }, [fetchHistory]);

  // Load history on symbol or interval change
  useEffect(() => {
    loadHistory(selectedSymbol, interval);
  }, [selectedSymbol, interval, loadHistory]);

  // 2. Real-Time Live Tick Processing & Smooth Active Candle Tracking
  useEffect(() => {
    if (!storeLiveTick || storeLiveTick.price == null) return;
    const ltp = Number(storeLiveTick.price);
    if (isNaN(ltp) || ltp <= 0) return;

    // Outlier Spike Protection: Ignore ticks deviating > 20% from verified reference
    const refPrice = lastVerifiedPriceRef.current || ltp;
    if (Math.abs(ltp - refPrice) / refPrice > 0.20) {
      return;
    }
    lastVerifiedPriceRef.current = ltp;

    const isIntraday = interval !== '1d';
    const nowMs = Date.now();

    // IST Day of Week & Market Time Calculation
    const istDate = new Date(nowMs + (5.5 * 3600 * 1000));
    const istDayOfWeek = istDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = istDayOfWeek === 0 || istDayOfWeek === 6;

    // Invariant: Weekend ticks must never generate artificial weekend candles
    if (isWeekend) {
      return;
    }

    const istHours = istDate.getUTCHours();
    const istMinutes = istDate.getUTCMinutes();
    const istTimeMin = istHours * 60 + istMinutes;
    const isMarketHours = istTimeMin >= 555 && istTimeMin <= 930; // 09:15 to 15:30 IST

    // For intraday, ignore ticks outside continuous market hours to prevent isolated night bars
    if (isIntraday && !isMarketHours) {
      return;
    }

    // Determine current interval candle timestamp
    let currentBucketTime = null;
    if (isIntraday) {
      currentBucketTime = getSessionBucketStart(interval, nowMs);
    } else {
      // IST Market Date YYYY-MM-DD
      currentBucketTime = istDate.toISOString().substring(0, 10);
    }

    let active = activeCandleRef.current;

    // Check if ongoing active candle matches the current time bucket
    if (active && active.time === currentBucketTime) {
      active.high = Math.max(Number(active.high), ltp);
      active.low = Math.min(Number(active.low), ltp);
      active.close = ltp;
      chartCanvasRef.current?.updateActiveCandle(active);
    } else if (currentBucketTime) {
      const newCandle = {
        time: currentBucketTime,
        open: ltp,
        high: ltp,
        low: ltp,
        close: ltp,
        volume: 0,
      };
      activeCandleRef.current = newCandle;
      chartCanvasRef.current?.updateActiveCandle(newCandle);
    }
  }, [storeLiveTick, interval]);

  // Indicator Handlers
  const handleToggleIndicator = useCallback((id) => {
    setActiveIndicators((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleClearAllIndicators = useCallback(() => {
    setActiveIndicators([]);
    setHiddenIndicators([]);
  }, []);

  const handleToggleHideIndicator = useCallback((id) => {
    setHiddenIndicators((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleRemoveIndicator = useCallback((id) => {
    setActiveIndicators((prev) => prev.filter((item) => item !== id));
    setHiddenIndicators((prev) => prev.filter((item) => item !== id));
  }, []);

  const handleVisibleRangeChange = useCallback((range) => {
    oscillatorPaneRef.current?.syncRange(range);
  }, []);

  // 3. Toolbar Handlers
  const handleSelectSymbol = useCallback((sym) => {
    if (sym && sym !== selectedSymbol) {
      setSelectedSymbol(sym);
    }
  }, [selectedSymbol, setSelectedSymbol]);

  const handleIntervalChange = useCallback((iv) => {
    setInterval(iv);
  }, []);

  const handleResetZoom = useCallback(() => {
    chartCanvasRef.current?.fitContent();
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Listen to external fullscreen changes (e.g. Esc key)
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const curPrice = storeLiveTick?.price ?? (candles.length > 0 ? candles[candles.length - 1].close : null);
  const dayChange = storeLiveTick?.change_pct ?? null;
  const isLive = storeLiveTick?.is_live ?? wsLiveData;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#090C15',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: 6,
        gap: 6,
      }}
    >
      {/* 1. Header Toolbar */}
      <ChartToolbar
        selectedSymbol={selectedSymbol}
        onSelectSymbol={handleSelectSymbol}
        interval={interval}
        onIntervalChange={handleIntervalChange}
        onResetZoom={handleResetZoom}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        searchStocks={searchStocks}
        activeIndicatorCount={activeIndicators.length}
        onOpenIndicators={() => setShowIndicatorModal(true)}
      />

      {/* 2. Main Chart Viewport Area */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          width: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 6,
        }}
      >
        <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: 0, overflow: 'hidden' }}>
          {loading && candles.length === 0 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              backgroundColor: 'rgba(9, 12, 21, 0.7)',
              color: '#818CF8',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.85rem',
              gap: 8,
            }}>
              <div className="spinner" style={{ width: 16, height: 16 }} />
              Loading {selectedSymbol} Candles...
            </div>
          )}

          {error && (
            <div style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 20,
              backgroundColor: 'rgba(239, 83, 80, 0.15)',
              border: '1px solid rgba(239, 83, 80, 0.3)',
              borderRadius: 4,
              padding: '4px 10px',
              color: '#EF5350',
              fontSize: '0.72rem',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {error}
            </div>
          )}

          {/* On-Chart Indicator Legend HUD */}
          <IndicatorLegend
            activeIndicators={activeIndicators}
            hiddenIndicators={hiddenIndicators}
            indicatorValues={indicatorValues}
            onToggleHide={handleToggleHideIndicator}
            onRemove={handleRemoveIndicator}
          />

          <ChartCanvas
            ref={chartCanvasRef}
            candles={candles}
            activeCandleRef={activeCandleRef}
            interval={interval}
            selectedSymbol={selectedSymbol}
            livePrice={curPrice}
            liveChange={dayChange}
            activeIndicators={activeIndicators}
            hiddenIndicators={hiddenIndicators}
            onHoverValues={setIndicatorValues}
            onVisibleRangeChange={handleVisibleRangeChange}
          />
        </div>

        {/* Synchronized Oscillator Sub-Pane (RSI) */}
        {activeIndicators.includes('rsi') && (
          <OscillatorPane
            ref={oscillatorPaneRef}
            type="rsi"
            candles={candles}
            onClose={() => handleRemoveIndicator('rsi')}
          />
        )}

        {/* Synchronized Oscillator Sub-Pane (MACD) */}
        {activeIndicators.includes('macd') && (
          <OscillatorPane
            ref={oscillatorPaneRef}
            type="macd"
            candles={candles}
            onClose={() => handleRemoveIndicator('macd')}
          />
        )}
      </div>

      {/* 3. Footer Session Summary Bar */}
      <ChartBottomStats
        isLive={isLive}
        curPrice={curPrice}
        dayChange={dayChange}
        candles={candles}
        activeCandleRef={activeCandleRef}
        interval={interval}
        dataSource={dataSource}
      />

      {/* 4. Indicator Library Modal */}
      <IndicatorModal
        isOpen={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        activeIndicators={activeIndicators}
        onToggleIndicator={handleToggleIndicator}
        onClearAll={handleClearAllIndicators}
      />
    </div>
  );
}
