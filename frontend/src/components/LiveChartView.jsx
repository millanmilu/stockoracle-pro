import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * useWindowSize — simple hook to track viewport width for responsive layout.
 * Uses ResizeObserver on body (consistent with ChartCanvas pattern) for accuracy.
 */
function useWindowSize() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    let rafId = null;
    const handler = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        setWidth(window.innerWidth);
        rafId = null;
      });
    };
    window.addEventListener('resize', handler, { passive: true });
    return () => {
      window.removeEventListener('resize', handler);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  return width;
}
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import ChartToolbar from './chart/ChartToolbar';
import ChartCanvas from './chart/ChartCanvas';
import CandleCountdown from './chart/CandleCountdown';
import IndicatorModal from './chart/IndicatorModal';
import OscillatorPane from './chart/OscillatorPane';
import VolumePane from './chart/VolumePane';
import DrawingTools from './chart-tools/DrawingTools';
import ChartSettingsModal from './ChartSettingsModal';
import { DEFAULT_ACTIVE_INDICATORS, INDICATOR_DEFINITIONS } from './chart/indicatorDefinitions';
import { toChartTime, getSessionBucketStart, isCryptoSymbol, subscribeLiveTick } from '../utils/chartHelpers';


/**
 * LiveChartView — Rebuilt Clean Master Controller
 * Focused purely on smooth candlestick rendering, accurate historical data,
 * real-time indicators suite, and flicker-free live price tracking.
 */
export default function LiveChartView() {
  const selectedSymbol = useStore(s => s.selectedSymbol || 'RELIANCE');
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const wsLiveData = useStore(s => s.wsLiveData);
  const wsConnected = useStore(s => s.wsConnected);
  const storeLiveTick = useStore(s => s.livePrices?.[selectedSymbol]);

  const { fetchHistory, preloadStock } = useStock();

  const selectedInterval = useStore(s => s.selectedInterval || '1m');
  const setSelectedInterval = useStore(s => s.setSelectedInterval);

  const windowWidth = useWindowSize();
  const isMobile = windowWidth < 640;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;

  const [interval, setIntervalState] = useState(() => selectedInterval || '1m');
  const setInterval = (newIv) => {
    setIntervalState(newIv);
    setSelectedInterval?.(newIv);
  };
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
  const [chartType, setChartType] = useState('candlestick');
  const [priceScaleMode, setPriceScaleMode] = useState('normal');
  const [invertScale, setInvertScale] = useState(false);
  // Auto-collapse drawing tools on tablet/mobile (user can re-open)
  const [showDrawingTools, setShowDrawingTools] = useState(() => window.innerWidth >= 1024);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [volumeHeight, setVolumeHeight] = useState(132);
  const [timezone, setTimezone] = useState('Asia/Kolkata');


  // Filter active indicators to all oscillator sub-panes (RSI, MACD, Stoch, CCI, etc.)
  const activeOscillators = useMemo(() => {
    return activeIndicators
      .map(id => INDICATOR_DEFINITIONS.find(item => item.id === id))
      .filter(item => item && item.type === 'oscillator');
  }, [activeIndicators]);



  const activeCandleRef = useRef(null);
  const chartCanvasRef = useRef(null);
  // Latest-value refs so the live-tick listener NEVER needs re-subscription
  // (ticks flow outside React renders — see processLiveTick below)
  const intervalRef = useRef(interval);
  const symbolRef = useRef(selectedSymbol);
  const readyRef = useRef({ loading: true, hasCandles: false });
  const pendingTickRef = useRef({ rafId: null, ltp: null });
  // General oscillator pane refs — keyed by oscType (e.g. 'rsi', 'macd', 'stoch', 'cci', etc.)
  const oscPaneRefs = useRef({});
  const volumePaneRef = useRef(null);

  const isSyncingRangeRef = useRef(false);
  const containerRef = useRef(null);
  const lastVerifiedPriceRef = useRef(null);
  const recentPricesRef = useRef([]); // Rolling window of recent LTPs for adaptive spike detection
  const spikeCountRef = useRef(0);

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
    lastVerifiedPriceRef.current = null;
    recentPricesRef.current = [];
    spikeCountRef.current = 0;

    try {
      // Fetch full available history for the selected interval
      const res = await fetchHistory(symbol, iv, 'ALL');
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
        recentPricesRef.current = [last.close];
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

  // Keep imperative refs in sync for the render-free tick path
  useEffect(() => {
    intervalRef.current = interval;
  }, [interval]);
  useEffect(() => {
    symbolRef.current = selectedSymbol;
  }, [selectedSymbol]);
  useEffect(() => {
    readyRef.current = { loading, hasCandles: candles.length > 0 };
  }, [loading, candles]);

  // Applies a verified LTP to the ongoing active candle (or spawns a new
  // session-bucket candle). Called at most once per animation frame from
  // processLiveTick — this is the ONLY hot path, kept free of React state.
  const applyTickToCandle = useCallback((ltp) => {
    const interval = intervalRef.current;
    const selectedSymbol = symbolRef.current;
    const isIntraday = interval !== '1d';
    const isCrypto = isCryptoSymbol(selectedSymbol);
    const nowMs = Date.now();

    // IST Day of Week & Market Time Calculation
    const istDate = new Date(nowMs + (5.5 * 3600 * 1000));
    const istDayOfWeek = istDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = istDayOfWeek === 0 || istDayOfWeek === 6;

    // Invariant: Weekend ticks must never generate artificial weekend candles (for NSE equities)
    if (isWeekend && !isCrypto) {
      return;
    }

    const istHours = istDate.getUTCHours();
    const istMinutes = istDate.getUTCMinutes();
    const istTimeMin = istHours * 60 + istMinutes;
    const isMarketHours = istTimeMin >= 555 && istTimeMin <= 930; // 09:15 to 15:30 IST

    // For intraday, ignore ticks outside continuous market hours to prevent isolated night bars (for NSE equities)
    if (isIntraday && !isMarketHours && !isCrypto) {
      return;
    }

    const storeLiveTick = useStore.getState().livePrices?.[selectedSymbol] || {};

    // 1. Direct Live Exchange Candle (e.g. from Binance continuous kline stream).
    // The incoming tick price always wins for close/high/low so sub-second
    // aggTrade ticks move the candle fluidly between exchange kline updates.
    if (storeLiveTick.liveCandle) {
      const rawCandle = storeLiveTick.liveCandle;
      const formattedTime = toChartTime(rawCandle.time, isIntraday);
      if (formattedTime) {
        const o = Number(rawCandle.open);
        const c = ltp;
        const liveCandle = {
          ...rawCandle,
          time: formattedTime,
          open: o,
          high: Math.max(Number(rawCandle.high), o, c),
          low: Math.min(Number(rawCandle.low), o, c),
          close: c,
          volume: Number(rawCandle.volume || 0),
        };
        activeCandleRef.current = liveCandle;
        chartCanvasRef.current?.updateActiveCandle(liveCandle);
        return;
      }
    }

    // 2. Synthetic Session Bucketing for Indian Equities / Generic Ticks
    let currentBucketTime = null;
    if (isIntraday) {
      currentBucketTime = getSessionBucketStart(interval, nowMs, isCrypto);
    } else {
      // IST Market Date YYYY-MM-DD (or UTC for crypto)
      currentBucketTime = isCrypto ? new Date(nowMs).toISOString().substring(0, 10) : istDate.toISOString().substring(0, 10);
    }

    let active = activeCandleRef.current;
    const canUpdateCandle = isMarketHours || storeLiveTick.is_live || isCrypto;

    // Check if ongoing active candle matches the current time bucket
    if (active && active.time === currentBucketTime) {
      // Only mutate ongoing active candle during live market hours, confirmed live ticks, or 24/7 crypto
      if (canUpdateCandle) {
        active.high = Math.max(Number(active.high), ltp);
        active.low = Math.min(Number(active.low), ltp);
        active.close = ltp;
        chartCanvasRef.current?.updateActiveCandle(active);
      }
    } else if (currentBucketTime && canUpdateCandle) {
      // Only spawn a NEW session candle during market hours with verified live ticks or 24/7 crypto
      const isContinuation = active?.time && (
        typeof active.time === 'number' && typeof currentBucketTime === 'number'
          ? (currentBucketTime - active.time) <= 300
          : active.time === currentBucketTime
      );
      const prevClose = (isContinuation && active?.close != null) ? Number(active.close) : null;
      const openPrice = (!isIntraday && Number(storeLiveTick.open) > 0)
        ? Number(storeLiveTick.open)
        : (prevClose && !isNaN(prevClose) ? prevClose : ltp);
      const highPrice = Math.max(openPrice, ltp);
      const lowPrice = Math.min(openPrice, ltp);

      const newCandle = {
        time: currentBucketTime,
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        close: ltp,
        volume: (!isIntraday && Number(storeLiveTick.volume) > 0) ? Number(storeLiveTick.volume) : 0,
      };
      activeCandleRef.current = newCandle;
      chartCanvasRef.current?.updateActiveCandle(newCandle);
    }
  }, []);

  // 2. Real-Time Live Tick Processing — render-free path.
  // Ticks arrive via the 60-FPS live tick bus (emitLiveTick) and are applied
  // directly to the chart through imperative refs. React state is NOT touched
  // per tick: pending ticks are coalesced to one update per animation frame,
  // so bursts of ticks can never cause render jank.
  const processLiveTick = useCallback((tick) => {
    if (!tick || tick.price == null) return;
    const ltp = Number(tick.price);
    if (isNaN(ltp) || ltp <= 0) return;

    // Verify tick belongs to currently selected symbol
    const sym = symbolRef.current;
    if (tick.ticker && sym && String(tick.ticker).toUpperCase() !== String(sym).toUpperCase()) return;

    // Do not process ticks until historical data has finished loading
    if (readyRef.current.loading || !readyRef.current.hasCandles) return;

    // Outlier Spike Protection: ignore ticks deviating beyond an adaptive
    // threshold from the verified reference price. 20% static floor combined
    // with a rolling mean-absolute-deviation measure so genuine large moves in
    // high-beta stocks are kept while fat-finger errors are caught.
    const refPrice = lastVerifiedPriceRef.current || ltp;
    const staticThreshold = 0.20;
    let adaptiveThreshold = 0.05;
    const recent = recentPricesRef.current;
    if (recent.length >= 5) {
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
      const mad = recent.reduce((a, b) => a + Math.abs(b - mean), 0) / recent.length;
      const madBased = (mad / refPrice) * 3;
      adaptiveThreshold = Math.max(0.05, Math.min(0.30, madBased));
    }
    const effectiveThreshold = Math.max(staticThreshold, adaptiveThreshold);
    if (Math.abs(ltp - refPrice) / refPrice > effectiveThreshold) {
      spikeCountRef.current = (spikeCountRef.current || 0) + 1;
      if (spikeCountRef.current < 3) {
        return;
      }
    }
    spikeCountRef.current = 0;
    recentPricesRef.current.push(ltp);
    if (recentPricesRef.current.length > 20) {
      recentPricesRef.current.shift();
    }
    lastVerifiedPriceRef.current = ltp;

    // Coalesce ticks: apply at most one candle update per animation frame
    pendingTickRef.current.ltp = ltp;
    if (pendingTickRef.current.rafId == null) {
      pendingTickRef.current.rafId = requestAnimationFrame(() => {
        pendingTickRef.current.rafId = null;
        applyTickToCandle(pendingTickRef.current.ltp);
      });
    }
  }, [applyTickToCandle]);

  // Subscribe once — refs above keep the handler fresh without re-subscribing
  useEffect(() => {
    const unsub = subscribeLiveTick(processLiveTick);
    return () => {
      unsub();
      if (pendingTickRef.current.rafId != null) {
        cancelAnimationFrame(pendingTickRef.current.rafId);
        pendingTickRef.current.rafId = null;
      }
    };
  }, [processLiveTick]);

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

  // Synchronized Visible Logical Range with loop guard across all stacked panes
  const handleVisibleRangeChange = useCallback((range, source) => {
    if (isSyncingRangeRef.current || !range) return;
    isSyncingRangeRef.current = true;
    try {
      if (source !== 'main') {
        chartCanvasRef.current?.setVisibleLogicalRange(range);
      }
      Object.entries(oscPaneRefs.current).forEach(([oscType, paneRef]) => {
        if (source !== oscType) paneRef?.setVisibleLogicalRange(range);
      });
      if (source !== 'volume') {
        volumePaneRef.current?.setVisibleLogicalRange(range);
      }
    } finally {
      requestAnimationFrame(() => { isSyncingRangeRef.current = false; });
    }
  }, []);

  // Synchronized Crosshair Hairline across main chart and sub-panes
  const handleCrosshairMove = useCallback(({ x, time, source }) => {
    if (source !== 'main') {
      chartCanvasRef.current?.setSyncedCrosshair({ x, time, source });
    }
    Object.entries(oscPaneRefs.current).forEach(([oscType, paneRef]) => {
      if (source !== oscType) paneRef?.setSyncedCrosshair({ x, time, source });
    });
    if (source !== 'volume') {
      volumePaneRef.current?.setSyncedCrosshair({ x, time, source });
    }
  }, []);


  // Preload all timeframes and backfill DB for initial symbol
  useEffect(() => {
    if (selectedSymbol) {
      preloadStock(selectedSymbol);
    }
  }, [selectedSymbol, preloadStock]);

  // 3. Toolbar Handlers
  const handleSelectSymbol = useCallback((sym) => {
    if (sym && sym !== selectedSymbol) {
      preloadStock(sym);
      setSelectedSymbol(sym);
    }
  }, [selectedSymbol, setSelectedSymbol, preloadStock]);

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
        padding: isMobile ? 3 : 6,
        gap: isMobile ? 3 : 6,
      }}
    >
      {/* 1. Header Toolbar */}
      <ChartToolbar
        selectedSymbol={selectedSymbol}
        onSelectSymbol={handleSelectSymbol}
        interval={interval}
        onIntervalChange={handleIntervalChange}
        chartType={chartType}
        onChartTypeChange={setChartType}
        priceScaleMode={priceScaleMode}
        onPriceScaleModeChange={setPriceScaleMode}
        showDrawingTools={showDrawingTools}
        onToggleDrawingTools={() => setShowDrawingTools((prev) => !prev)}
        onOpenSettings={() => setShowSettingsModal(true)}
        showVolume={showVolume}
        onToggleVolume={() => setShowVolume((prev) => !prev)}
        onResetZoom={handleResetZoom}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        activeIndicatorCount={activeIndicators.length}
        onOpenIndicators={() => setShowIndicatorModal(true)}
        livePrice={curPrice}
        liveChange={dayChange}
        isLive={isLive}
        wsConnected={wsConnected}
        isMobile={isMobile}
        isTablet={isTablet}
      />

      {/* 2. Main Terminal Viewport (Left Drawing Tools + Chart Canvas + Sub-panes) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          width: '100%',
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 6,
        }}
      >
        {/* Left Vertical Drawing Toolbar & Coordinate-Synced SVG Drawing Layer */}
        <DrawingTools
          chartRef={{ current: chartCanvasRef.current?.getChart() }}
          candleRef={{ current: chartCanvasRef.current?.getCandleSeries() }}
          candles={candles}
          symbol={selectedSymbol}
          interval={interval}
          chartReady={!loading && candles.length > 0}
          onOpenSettings={() => setShowSettingsModal(true)}
          isOpen={showDrawingTools}
          onToggleOpen={() => setShowDrawingTools((prev) => !prev)}
          isMobile={isMobile}
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

            <ChartCanvas
              ref={chartCanvasRef}
              candles={candles}
              activeCandleRef={activeCandleRef}
              interval={interval}
              selectedSymbol={selectedSymbol}
              chartType={chartType}
              priceScaleMode={priceScaleMode}
              invertScale={invertScale}
              showVolume={showVolume}
              timezone={timezone}
              livePrice={curPrice}
              liveChange={dayChange}
              activeIndicators={activeIndicators}
              hiddenIndicators={hiddenIndicators}
              onToggleHideIndicator={handleToggleHideIndicator}
              onRemoveIndicator={handleRemoveIndicator}
              onVisibleRangeChange={handleVisibleRangeChange}
              onCrosshairMove={handleCrosshairMove}
            />
            <CandleCountdown
              chartRef={chartCanvasRef}
              activeCandleRef={activeCandleRef}
              selectedSymbol={selectedSymbol}
              interval={interval}
              currentPrice={curPrice}
            />
          </div>

          <VolumePane
            ref={volumePaneRef}
            candles={candles}
            height={volumeHeight}
            onHeightChange={setVolumeHeight}
            isHidden={!showVolume}
            onToggleHide={() => setShowVolume(false)}
            onVisibleRangeChange={handleVisibleRangeChange}
            onCrosshairMove={handleCrosshairMove}
          />

          {/* Synchronized Dynamic Oscillator Sub-Panes */}
          {activeOscillators.map((osc) => (
            <OscillatorPane
              key={osc.id}
              ref={(el) => {
                const key = osc.oscType || osc.id;
                if (el) {
                  oscPaneRefs.current[key] = el;
                } else {
                  delete oscPaneRefs.current[key];
                }
              }}
              oscType={osc.oscType || osc.id}
              candles={candles}
              isHidden={hiddenIndicators.includes(osc.id)}
              onToggleHide={() => handleToggleHideIndicator(osc.id)}
              onClose={() => handleRemoveIndicator(osc.id)}
              onVisibleRangeChange={handleVisibleRangeChange}
              onCrosshairMove={handleCrosshairMove}
            />
          ))}


        </div>
      </div>

      {/* 3. Indicator Library Modal */}
      <IndicatorModal
        isOpen={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        activeIndicators={activeIndicators}
        onToggleIndicator={handleToggleIndicator}
        onClearAll={handleClearAllIndicators}
      />

      {/* 5. Chart Settings Modal */}
      <ChartSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        chartRef={{ current: chartCanvasRef.current?.getChart() }}
        candleSeriesRef={{ current: chartCanvasRef.current?.getCandleSeries() }}
        onApplySettings={(newSettings) => {
          if (newSettings.chartType) setChartType(newSettings.chartType);
          if (newSettings.priceScaleMode) setPriceScaleMode(newSettings.priceScaleMode);
          if (newSettings.invertScale !== undefined) setInvertScale(newSettings.invertScale);
          if (newSettings.timezone) setTimezone(newSettings.timezone);
        }}
      />
    </div>
  );
}
