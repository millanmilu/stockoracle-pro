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
/** Human label for the replay cursor bar: epoch seconds → HH:MM, daily dates as-is. */
function formatReplayBarLabel(t) {
  if (t == null) return '';
  if (typeof t === 'number' && Number.isFinite(t)) {
    try {
      return new Date(t * 1000).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return String(t);
    }
  }
  return String(t).slice(0, 10);
}
import useStore from '../store/useStore';import { getThemeTokens } from '../utils/theme';
import { useStock } from '../hooks/useStock';
import api from '../utils/api';
import ChartToolbar from './chart/ChartToolbar';
import ChartCanvas from './chart/ChartCanvas';
import ChartTradeBar from './chart/ChartTradeBar';
import ChartTradeDocket from './chart/ChartTradeDocket';
import CandleCountdown from './chart/CandleCountdown';
import IndicatorModal from './chart/IndicatorModal';
import IndicatorParamsModal from './chart/IndicatorParamsModal';
import AIDashboard from './chart/AIDashboard';
import OscillatorPane from './chart/OscillatorPane';
import VolumePane from './chart/VolumePane';
import toast from 'react-hot-toast';
import { Crosshair } from 'lucide-react';
import ReplayBar, { REPLAY_SPEEDS } from './chart/ReplayBar';
import VolumeProfileOverlay from './chart/VolumeProfileOverlay';
import DrawingTools from './chart-tools/DrawingTools';
import ChartSettingsModal from './ChartSettingsModal';
import { DEFAULT_ACTIVE_INDICATORS, INDICATOR_DEFINITIONS } from './chart/indicatorDefinitions';
import { getEngineFallbackId } from './chart/indicatorSettingsSchema';
import { getCachedCandles, setCachedCandles } from '../utils/chartDataCache';
import { toChartTime, getSessionBucketStart, isCryptoSymbol, subscribeLiveTick, sanitizeCandles, isAppendableTime, compareChartTime, INTERVAL_SLOT_SEC, computeFillSlots, normalizeInterval } from '../utils/chartHelpers';


/**
 * LiveChartView — Rebuilt Clean Master Controller
 * Focused purely on smooth candlestick rendering, accurate historical data,
 * real-time indicators suite, and flicker-free live price tracking.
 */
export default function LiveChartView() {
  const selectedSymbol = useStore(s => s.selectedSymbol || 'RELIANCE');
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const theme = useStore(s => s.theme);
  const tk = getThemeTokens(theme);
  const wsLiveData = useStore(s => s.wsLiveData);
  const wsConnected = useStore(s => s.wsConnected);
  const storeLiveTick = useStore(s => s.livePrices?.[selectedSymbol]);

  const { fetchHistory, preloadStock } = useStock();

  const selectedInterval = useStore(s => s.selectedInterval || '1m');
  const setSelectedInterval = useStore(s => s.setSelectedInterval);

  const windowWidth = useWindowSize();
  const isMobile = windowWidth < 640;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;

  const [interval, setIntervalState] = useState(() => normalizeInterval(selectedInterval, '1m'));
  const setInterval = (newIv) => {
    const clean = normalizeInterval(newIv, interval);
    setIntervalState(clean);
    setSelectedInterval?.(clean);
  };
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('angel_one');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Advanced Indicators State — persisted ids are validated against the catalog so
  // a renamed/removed definition can never inflate the active count or bind to
  // nothing on the chart.
  const [activeIndicators, setActiveIndicators] = useState(() => {
    try {
      const saved = localStorage.getItem('stockoracle_indicators');
      if (!saved) return DEFAULT_ACTIVE_INDICATORS;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return DEFAULT_ACTIVE_INDICATORS;
      const known = new Set(INDICATOR_DEFINITIONS.map((item) => item.id));
      return parsed.filter((id) => known.has(id));
    } catch {
      return DEFAULT_ACTIVE_INDICATORS;
    }
  });
  const [hiddenIndicators, setHiddenIndicators] = useState([]);
  const [indicatorValues, setIndicatorValues] = useState({});
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [indicatorSettings, setIndicatorSettings] = useState(null); // { id, name, engineId, params }
  const [indicatorParamOverrides, setIndicatorParamOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('stockoracle_indicator_overrides');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [chartType, setChartType] = useState('candlestick');
  const [priceScaleMode, setPriceScaleMode] = useState('normal');
  const [invertScale, setInvertScale] = useState(false);
  // Auto-collapse drawing tools on tablet/mobile (user can re-open)
  const [showDrawingTools, setShowDrawingTools] = useState(() => window.innerWidth >= 1024);
  // Shared drawing-tool selection — the top Draw menu and the left rail stay in sync
  const [activeDrawingTool, setActiveDrawingTool] = useState('crosshair');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [volumeHeight, setVolumeHeight] = useState(132);
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // ── Live On-Chart Paper Trading ──────────────────────────────────────────
  const [showTradeBar, setShowTradeBar] = useState(true);
  const [isTradeBarCollapsed, setIsTradeBarCollapsed] = useState(false);
  const [showTradeDocket, setShowTradeDocket] = useState(false);
  const [paperPositions, setPaperPositions] = useState([]);
  const [paperAccount, setPaperAccount] = useState(null);

  const fetchPaperData = useCallback(async () => {
    try {
      const [posRes, accRes] = await Promise.all([
        api.get('/api/paper/positions').catch(() => ({ data: [] })),
        api.get('/api/paper/account').catch(() => ({ data: null })),
      ]);
      setPaperPositions(Array.isArray(posRes.data) ? posRes.data : []);
      if (accRes.data) setPaperAccount(accRes.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchPaperData();
    const intervalId = setInterval(fetchPaperData, 10000);
    return () => clearInterval(intervalId);
  }, [fetchPaperData]);

  // ── Bar Replay (TradingView parity) ──────────────────────────────────────
  // replayIndex = last VISIBLE bar (null = live). The chart surfaces render
  // `chartCandles` (history capped at the cursor) while full `candles` keep
  // growing underneath, so exiting replay is instant and lossless.
  const [replayIndex, setReplayIndex] = useState(null);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(3); // index into REPLAY_SPEEDS (1x)
  const [isJumpMode, setIsJumpMode] = useState(false);
  const replayIndexRef = useRef(null);
  replayIndexRef.current = replayIndex;
  const isReplaying = replayIndex != null;
  const chartCandles = useMemo(
    () => (isReplaying ? candles.slice(0, Math.max(0, Math.min(replayIndex + 1, candles.length))) : candles),
    [candles, replayIndex, isReplaying],
  );


  // Filter active indicators to all oscillator sub-panes (RSI, MACD, Stoch, CCI, etc.)
  // TradingView Visibility tab: hidden on unchecked timeframes.
  const activeOscillators = useMemo(() => {
    const norm = String(interval || '').toLowerCase();
    return activeIndicators
      .map(id => INDICATOR_DEFINITIONS.find(item => item.id === id))
      .filter(item => item && item.type === 'oscillator')
      .filter((item) => {
        const ov = indicatorParamOverrides[item.id] || {};
        for (const [k, v] of Object.entries(ov)) {
          if (k.toLowerCase() === `__vis_${norm}` && v === false) return false;
        }
        return true;
      });
  }, [activeIndicators, indicatorParamOverrides, interval]);

  // AI indicators (AIDashboard strip)
  const showAIDashboard = useMemo(() => {
    return activeIndicators.some((id) => {
      const def = INDICATOR_DEFINITIONS.find((item) => item.id === id);
      return def && def.type === 'ai';
    });
  }, [activeIndicators]);



  const activeCandleRef = useRef(null);
  const chartCanvasRef = useRef(null);
  // Stable drawing-layer refs — DrawingTools needs the SAME ref objects across
  // renders. Passing `{{ current: ... }}` inline would snapshot null on first
  // render and never update (ref changes don't re-render), breaking
  // coordinateToLogical / priceToCoordinate, magnet snapping and drag edits.
  const drawingChartRef = useRef(null);
  const drawingCandleRef = useRef(null);
  // Main price-pane wrapper: DrawingTools sizes its SVG overlay to this box so
  // drawings map 1:1 to chart pixels on scroll/zoom (never stretched over
  // volume/oscillator panes).
  const mainChartWrapRef = useRef(null);
  const [, setDrawingRefsTick] = useState(0);
  // Last exchange-candle time published to state (crypto liveCandle path)
  const liveCandleTimeRef = useRef(null);
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
  // Request-id guard: quick symbol/interval switches must not let a stale
  // history response overwrite the current symbol's candles (which would
  // also resolve that symbol's drawings against the wrong candle set).
  const historySeqRef = useRef(0);

  // Persist active indicators to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('stockoracle_indicators', JSON.stringify(activeIndicators));
    } catch {}
  }, [activeIndicators]);

  // Persist indicator settings (Inputs + Style + Visibility) — TradingView parity
  useEffect(() => {
    try {
      localStorage.setItem('stockoracle_indicator_overrides', JSON.stringify(indicatorParamOverrides));
    } catch {}
  }, [indicatorParamOverrides]);

  // 1. Fetch & Staged Historical Data Loading
  // Instant restore: the in-memory cache (same JS session) paints the last
  // good candles synchronously on remount (app-view switches), then the
  // network refresh replaces them — the chart never sits blank.
  const loadHistory = useCallback(async (symbol, iv) => {
    const seq = ++historySeqRef.current;
    const alive = () => historySeqRef.current === seq;

    const cached = getCachedCandles(symbol, iv);
    if (cached) {
      setCandles(cached.candles);
      setDataSource(cached.dataSource || 'cache');
      setLoading(false);
      const lastCached = cached.candles[cached.candles.length - 1];
      if (lastCached) {
        lastVerifiedPriceRef.current = lastCached.close;
        recentPricesRef.current = [lastCached.close];
        activeCandleRef.current = { ...lastCached };
      }
    } else {
      setLoading(true);
    }
    setError(null);
    if (!cached) {
      activeCandleRef.current = null;
      liveCandleTimeRef.current = null;
      lastVerifiedPriceRef.current = null;
      recentPricesRef.current = [];
      spikeCountRef.current = 0;
    }

    try {
      // Fetch full available history for the selected interval
      const res = await fetchHistory(symbol, iv, 'ALL');
      if (!alive()) return;
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

      // Ensure strictly sorted by time and duplicate-free. sanitizeCandles
      // additionally drops type-mixed times (BusinessDay string vs UTCTimestamp)
      // which lightweight-charts rejects with "data must be asc ordered by time".
      const deduplicated = sanitizeCandles(formatted);

      setCandles(deduplicated);
      setCachedCandles(symbol, iv, deduplicated, source);

      // Seed activeCandleRef and last verified reference price
      if (deduplicated.length > 0) {
        const last = deduplicated[deduplicated.length - 1];
        lastVerifiedPriceRef.current = last.close;
        recentPricesRef.current = [last.close];
        activeCandleRef.current = { ...last };
      }
    } catch (err) {
      if (!alive()) return;
      // Never blank a visible chart on a failed refresh — keep the cached
      // candles and surface the error badge only.
      const hadCached = getCachedCandles(symbol, iv);
      if (!hadCached) setCandles([]);
      else setLoading(false);
      setError(err?.message || 'Failed to load stock history');
    } finally {
      if (alive()) setLoading(false);
    }
  }, [fetchHistory]);

  // Load history on symbol or interval change
  useEffect(() => {
    loadHistory(selectedSymbol, interval);
  }, [selectedSymbol, interval, loadHistory]);

  // Tab-return guard: if the user comes back (browser tab or app view) to an
  // empty chart that is not already loading, reload once.
  const candlesLenRef = useRef(0);
  candlesLenRef.current = candles.length;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (loadingRef.current || candlesLenRef.current > 0) return;
      loadHistory(symbolRef.current, intervalRef.current);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loadHistory]);

  // Keep imperative refs in sync for the render-free tick path
  useEffect(() => {
    intervalRef.current = interval;
  }, [interval]);
  // Sync the stable drawing refs from the ChartCanvas imperative handle once
  // the chart instance exists. Polls briefly after load since ref assignment
  // itself never triggers a render.
  useEffect(() => {
    if (loading || candles.length === 0) {
      drawingChartRef.current = null;
      drawingCandleRef.current = null;
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const sync = () => {
      if (cancelled) return;
      try {
        const chart = chartCanvasRef.current?.getChart?.() || null;
        const series = chartCanvasRef.current?.getCandleSeries?.() || null;
        if (chart && !chart.__isDisposed && drawingChartRef.current !== chart) {
          drawingChartRef.current = chart;
          setDrawingRefsTick((t) => t + 1);
        } else if (!chart || chart.__isDisposed) {
          drawingChartRef.current = null;
        }
        if (series && !series.__isDisposed && drawingCandleRef.current !== series) {
          drawingCandleRef.current = series;
          setDrawingRefsTick((t) => t + 1);
        } else if (!series || series.__isDisposed) {
          drawingCandleRef.current = null;
        }
        if ((!chart || !series) && attempts < 20 && !cancelled) {
          attempts += 1;
          setTimeout(sync, 250);
        }
      } catch {}
    };
    sync();
    return () => {
      cancelled = true;
    };
  }, [loading, candles, interval, selectedSymbol]);
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

    // Publishes a new bucket candle in ascending order, backfilling any slots
    // skipped during feed stalls with flat carry-forward bars (volume 0) so
    // the series stays slot-complete and no whitespace gap appears. Daily
    // buckets and oversized skips are never filled (weekends/holidays and
    // real outages must stay visible). Same-time calls only update in place
    // (state updater returns prev → no re-render, render-free hot path kept).
    const emitOrdered = (prevTime, prevClose, newCandle) => {
      const slot = INTERVAL_SLOT_SEC[interval];
      const flat = Number(prevClose);
      const flatOk = isFinite(flat) && flat > 0;
      const fills = (slot && flatOk && prevTime !== newCandle.time)
        ? computeFillSlots(prevTime, newCandle.time, slot, { sameDayOnly: !isCrypto })
            .map((t) => ({ time: t, open: flat, high: flat, low: flat, close: flat, volume: 0 }))
        : [];
      const ordered = [...fills, newCandle];
      for (const c of ordered) {
        // Frozen during Bar Replay — the replay cursor owns the chart surface.
        if (replayIndexRef.current == null) chartCanvasRef.current?.updateActiveCandle(c);
      }
      activeCandleRef.current = newCandle;
      try {
        setCandles((prev) => {
          if (!Array.isArray(prev)) return prev;
          let out = prev;
          let changed = false;
          for (const c of ordered) {
            if (out.length === 0) { out = [c]; changed = true; continue; }
            const lastTime = out[out.length - 1].time;
            if (lastTime === c.time) continue;
            // Late bucket vs newer history — drop the whole publish.
            if (!isAppendableTime(lastTime, c.time)) return prev;
            out = [...out, c];
            changed = true;
          }
          return changed ? out : prev;
        });
      } catch {}
    };

    // 1. Direct Live Exchange Candle (e.g. from Binance continuous kline stream).
    // The incoming tick price always wins for close/high/low so sub-second
    // aggTrade ticks move the candle fluidly between exchange kline updates.
    if (storeLiveTick.liveCandle) {
      const rawCandle = storeLiveTick.liveCandle;
      const formattedTime = toChartTime(rawCandle.time, isIntraday);
      if (formattedTime) {
        // Guard: never regress activeCandleRef with a stale/out-of-order
        // exchange bar — lightweight-charts `setData` throws
        // "data must be asc ordered by time" if such a bar is appended.
        const curActive = activeCandleRef.current;
        if (curActive && curActive.time !== formattedTime) {
          if (typeof curActive.time !== typeof formattedTime ||
              compareChartTime(curActive.time, formattedTime) > 0) {
            return;
          }
        }
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
        liveCandleTimeRef.current = formattedTime;
        emitOrdered(curActive?.time, curActive?.close, liveCandle);
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
        // Frozen during Bar Replay — the replay cursor owns the chart surface.
        if (replayIndexRef.current == null) chartCanvasRef.current?.updateActiveCandle(active);
      }
    } else if (currentBucketTime && canUpdateCandle) {
      // Guard: drop stale buckets (client clock behind server history, late
      // ticks, or interval-switch races). Appending a time <= active.time
      // would make `candles` non-ascending and crash lightweight-charts
      // `setData` with "data must be asc ordered by time".
      if (active && active.time !== currentBucketTime) {
        if (typeof active.time !== typeof currentBucketTime ||
            compareChartTime(active.time, currentBucketTime) > 0) {
          return;
        }
      }
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
      // Ordered publish: backfills stall-skipped slots, updates the chart
      // imperatively, and stores the SAME object reference in state so ticks
      // mutate it in place (future recomputes see fresh OHLC, one render
      // per bucket rollover — per-tick path stays render-free).
      emitOrdered(active?.time, active?.close, newCandle);
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

  // Applied-list ordering drives oscillator pane order and overlay draw order.
  const handleMoveIndicator = useCallback((id, direction) => {
    setActiveIndicators((prev) => {
      const from = prev.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });
  }, []);

  const handleOpenIndicatorSettings = useCallback((indicator) => {
    // TradingView parity: EVERY indicator has settings (Inputs/Style/Visibility).
    if (!indicator) return;
    setIndicatorSettings(indicator);
  }, []);

  const handleSaveIndicatorParams = useCallback((id, overrides) => {
    setIndicatorParamOverrides((prev) => {
      const next = { ...prev, [id]: overrides };
      try {
        localStorage.setItem('stockoracle_indicator_overrides', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Resolve an indicator definition with user overrides applied.
  // Flat overrides: plain keys → inputs/params, `__*` keys → style/visibility
  // (engine ignores `__` keys, chart layers split them out for rendering).
  const resolveDefinition = useCallback((indicator) => {
    if (!indicator) return indicator;
    const overrides = indicatorParamOverrides[indicator.id];
    if (!overrides || Object.keys(overrides).length === 0) return indicator;
    const inputs = {};
    const stylePatch = {};
    for (const [k, v] of Object.entries(overrides)) {
      if (k.startsWith('__')) stylePatch[k] = v;
      else inputs[k] = v;
    }
    let next = { ...indicator, params: { ...(indicator.params || {}), ...inputs } };
    if (!next.engineId && Object.keys(inputs).length) {
      const fb = getEngineFallbackId(next.id);
      if (fb) next = { ...next, engineId: fb };
    }
    if (stylePatch.__color) next = { ...next, color: stylePatch.__color };
    if (stylePatch.__lineWidth != null) next = { ...next, lineWidth: stylePatch.__lineWidth };
    if (stylePatch.__lineStyle != null) next = { ...next, lineStyle: stylePatch.__lineStyle };
    // Per-subline colors (__sub_{i}_color) for BB/KC/Ichimoku/levels
    const subKeys = Object.keys(stylePatch).filter((k) => k.startsWith('__sub_'));
    if (subKeys.length && (next.subLines || next.levels)) {
      const applySubs = (list) => list.map((sub, i) => {
        const c = stylePatch[`__sub_${i}_color`];
        return c ? { ...sub, color: c } : sub;
      });
      if (next.subLines) next = { ...next, subLines: applySubs(next.subLines) };
      if (next.levels) next = { ...next, levels: applySubs(next.levels) };
    }
    // Attach raw visibility flags for pane filtering (ChartCanvas/OscillatorPane)
    next = { ...next, _visFlags: stylePatch };
    return next;
  }, [indicatorParamOverrides]);

  // Synchronized Visible Logical Range with loop guard across all stacked panes
  const handleVisibleRangeChange = useCallback((range, source) => {
    if (isSyncingRangeRef.current || !range) return;
    isSyncingRangeRef.current = true;
    try {
      if (source !== 'main') {
        try {
          const chart = chartCanvasRef.current?.getChart?.();
          if (chart && !chart.__isDisposed) {
            chartCanvasRef.current?.setVisibleLogicalRange(range);
          }
        } catch {}
      }
      Object.entries(oscPaneRefs.current).forEach(([oscType, paneRef]) => {
        if (source !== oscType) {
          try {
            const chart = paneRef?.getChart?.();
            if (chart && !chart.__isDisposed) {
              paneRef?.setVisibleLogicalRange(range);
            }
          } catch {}
        }
      });
      if (source !== 'volume') {
        try {
          const chart = volumePaneRef.current?.getChart?.();
          if (chart && !chart.__isDisposed) {
            volumePaneRef.current?.setVisibleLogicalRange(range);
          }
        } catch {}
      }
    } finally {
      requestAnimationFrame(() => { isSyncingRangeRef.current = false; });
    }
  }, []);

  // Synchronized Crosshair Hairline across main chart and sub-panes
  const handleCrosshairMove = useCallback(({ x, time, source }) => {
    if (source !== 'main') {
      try {
        const chart = chartCanvasRef.current?.getChart?.();
        if (chart && !chart.__isDisposed) {
          chartCanvasRef.current?.setSyncedCrosshair({ x, time, source });
        }
      } catch {}
    }
    Object.entries(oscPaneRefs.current).forEach(([oscType, paneRef]) => {
      if (source !== oscType) {
        try {
          const chart = paneRef?.getChart?.();
          if (chart && !chart.__isDisposed) {
            paneRef?.setSyncedCrosshair({ x, time, source });
          }
        } catch {}
      }
    });
    if (source !== 'volume') {
      try {
        const chart = volumePaneRef.current?.getChart?.();
        if (chart && !chart.__isDisposed) {
          volumePaneRef.current?.setSyncedCrosshair({ x, time, source });
        }
      } catch {}
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

  // ── Bar Replay transport ─────────────────────────────────────────────────
  const exitReplay = useCallback(() => {
    setReplayPlaying(false);
    setReplayIndex(null);
    setIsJumpMode(false);
  }, []);

  const startReplay = useCallback(() => {
    if (!Array.isArray(candles) || candles.length < 5) return;
    // Begin ~60 bars back so there is room to step/play forward.
    setReplayIndex(Math.max(0, candles.length - 61));
    setReplayPlaying(false);
    setIsJumpMode(false);
    toast.success('Bar Replay started (Space: Play/Pause, →/←: Step, Esc: Exit)');
  }, [candles]);

  const stepReplay = useCallback((delta) => {
    setReplayPlaying(false);
    setReplayIndex((prev) => {
      if (prev == null) return prev;
      return Math.max(0, Math.min(candles.length - 1, prev + delta));
    });
  }, [candles.length]);

  const seekReplay = useCallback((i) => {
    setReplayPlaying(false);
    setReplayIndex(() => Math.max(0, Math.min(candles.length - 1, Number(i) || 0)));
  }, [candles.length]);

  const cycleReplaySpeed = useCallback(() => {
    setReplaySpeed((s) => (s + 1) % REPLAY_SPEEDS.length);
  }, []);

  const handleChartClick = useCallback((param) => {
    if (!isJumpMode || !param || !param.time || !Array.isArray(candles)) return;
    const clickedTime = param.time;
    const idx = candles.findIndex((c) => c.time === clickedTime);
    if (idx !== -1) {
      setReplayIndex(idx);
      setReplayPlaying(false);
      setIsJumpMode(false);
      toast.success(`Replay jumped to ${formatReplayBarLabel(clickedTime)}`);
    }
  }, [isJumpMode, candles]);

  // Auto-advance while playing; reaching the live edge pauses replay.
  useEffect(() => {
    if (!replayPlaying || replayIndex == null) return undefined;
    if (replayIndex >= candles.length - 1) {
      setReplayPlaying(false);
      toast.success('Replay reached latest candle');
      return undefined;
    }
    const id = window.setInterval(() => {
      setReplayIndex((p) => {
        if (p == null) return p;
        if (p >= candles.length - 1) {
          setReplayPlaying(false);
          toast.success('Replay reached latest candle');
          return p;
        }
        return p + 1;
      });
    }, REPLAY_SPEEDS[replaySpeed]?.ms || 500);
    return () => window.clearInterval(id);
  }, [replayPlaying, replayIndex, replaySpeed, candles.length]);

  // Symbol / interval switches leave replay mode (fresh history).
  useEffect(() => {
    setReplayPlaying(false);
    setReplayIndex(null);
    setIsJumpMode(false);
  }, [selectedSymbol, interval]);

  // Bar Replay keyboard transport controls:
  // Alt+R toggles, Space plays/pauses, Arrow keys step forward/back, Esc exits/cancels
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;

      // Alt+R toggle
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && String(e.key || '').toLowerCase() === 'r') {
        e.preventDefault();
        if (replayIndexRef.current != null) exitReplay();
        else startReplay();
        return;
      }

      // Alt+V toggle Volume Profile (VPVR)
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && String(e.key || '').toLowerCase() === 'v') {
        e.preventDefault();
        setActiveIndicators((prev) => {
          const exists = prev.includes('volume_profile');
          const next = exists ? prev.filter((id) => id !== 'volume_profile') : [...prev, 'volume_profile'];
          toast.success(exists ? 'Volume Profile removed' : 'Volume Profile (VPVR) added');
          return next;
        });
        return;
      }

      // Transport shortcuts active ONLY while Replay mode is active
      if (replayIndexRef.current != null) {
        if (e.code === 'Space') {
          e.preventDefault();
          setReplayPlaying((p) => !p);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          stepReplay(e.shiftKey ? 10 : 1);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          stepReplay(e.shiftKey ? -10 : -1);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          if (isJumpMode) {
            setIsJumpMode(false);
            toast.success('Jump mode cancelled');
          } else {
            exitReplay();
            toast.success('Exited Bar Replay (Live)');
          }
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startReplay, exitReplay, stepReplay, isJumpMode]);

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

  const replayBar = isReplaying && chartCandles.length > 0 ? chartCandles[chartCandles.length - 1] : null;
  const prevReplayBar = isReplaying && chartCandles.length > 1 ? chartCandles[chartCandles.length - 2] : null;
  const curPrice = isReplaying
    ? (replayBar?.close ?? null)
    : (storeLiveTick?.price ?? (candles.length > 0 ? candles[candles.length - 1].close : null));
  const dayChange = isReplaying
    ? (replayBar && prevReplayBar && prevReplayBar.close ? ((replayBar.close - prevReplayBar.close) / prevReplayBar.close) * 100 : (replayBar?.change_pct ?? null))
    : (storeLiveTick?.change_pct ?? null);
  const isLive = isReplaying ? false : (storeLiveTick?.is_live ?? wsLiveData);

  // Active position for currently viewed symbol with live mark-to-market P&L
  const activeSymbolPosition = useMemo(() => {
    const sym = String(selectedSymbol || '').toUpperCase().trim();
    const found = paperPositions.find((p) => String(p.ticker || '').toUpperCase().trim() === sym);
    if (!found) return null;
    const entryPrice = Number(found.avg_buy_price || 0);
    const ltp = Number(curPrice || found.current_price || entryPrice);
    const pnl = Math.round((ltp - entryPrice) * found.shares * 100) / 100;
    const pnlPct = Math.round(((ltp - entryPrice) / Math.max(0.01, entryPrice)) * 10000) / 100;
    return {
      ...found,
      current_price: ltp,
      unrealized_pnl: pnl,
      unrealized_pnl_pct: pnlPct,
    };
  }, [paperPositions, selectedSymbol, curPrice]);

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
        activeDrawingTool={activeDrawingTool}
        onSelectDrawingTool={(id) => { setActiveDrawingTool(id); setShowDrawingTools(true); }}
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
        isReplaying={isReplaying}
        onToggleReplay={isReplaying ? exitReplay : startReplay}
        showTradeBar={showTradeBar}
        onToggleTradeBar={() => setShowTradeBar((p) => !p)}
        showTradeDocket={showTradeDocket}
        onToggleTradeDocket={() => setShowTradeDocket((p) => !p)}
        paperPositionCount={paperPositions.length}
      />

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
          borderRadius: 6,
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
          onToggleOpen={() => setShowDrawingTools((prev) => !prev)}
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
          <div ref={mainChartWrapRef} style={{ flex: 1, position: 'relative', width: '100%', minHeight: 0, overflow: 'hidden' }}>
            {loading && candles.length === 0 && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20,
                backgroundColor: theme === 'light' ? 'rgba(240,242,248,0.85)' : 'rgba(9, 12, 21, 0.7)',
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
              liveChange={dayChange}
              activeIndicators={activeIndicators}
              hiddenIndicators={hiddenIndicators}
              indicatorOverrides={indicatorParamOverrides}
              onToggleHideIndicator={handleToggleHideIndicator}
              onRemoveIndicator={handleRemoveIndicator}
              onVisibleRangeChange={handleVisibleRangeChange}
              onCrosshairMove={handleCrosshairMove}
              onChartClick={handleChartClick}
              paperPosition={activeSymbolPosition}
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

            {/* Replay Simulation Watermark */}
            {isReplaying && (
              <div style={{
                position: 'absolute',
                top: 14,
                right: 60,
                zIndex: 15,
                pointerEvents: 'none',
                opacity: 0.18,
                fontSize: '1rem',
                fontWeight: 900,
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '0.14em',
                color: '#EF5350',
                userSelect: 'none',
              }}>
                BAR REPLAY SIMULATION
              </div>
            )}

            {/* Interactive Jump-to-Bar floating guide banner */}
            {isJumpMode && (
              <div style={{
                position: 'absolute',
                top: 14,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 60,
                background: 'rgba(239, 83, 80, 0.95)',
                color: '#FFFFFF',
                padding: '5px 14px',
                borderRadius: 20,
                fontSize: '0.76rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 8px 24px rgba(239, 83, 80, 0.45)',
                pointerEvents: 'none',
                animation: 'replay-blink 2s ease-in-out infinite',
              }}>
                <Crosshair size={14} />
                Click any candle on the chart to set cut point (Esc to cancel)
              </div>
            )}

            {!isReplaying && (
              <CandleCountdown
                chartRef={chartCanvasRef}
                activeCandleRef={activeCandleRef}
                selectedSymbol={selectedSymbol}
                interval={interval}
                currentPrice={curPrice}
              />
            )}
            {isReplaying && (
              <ReplayBar
                index={replayIndex}
                total={candles.length}
                playing={replayPlaying}
                speed={replaySpeed}
                barLabel={formatReplayBarLabel(chartCandles[chartCandles.length - 1]?.time)}
                onPlayPause={() => setReplayPlaying((p) => !p)}
                onStep={stepReplay}
                onSeek={seekReplay}
                onSpeed={cycleReplaySpeed}
                onExit={exitReplay}
                isMobile={isMobile}
              />
            )}
            {activeIndicators.includes('volume_profile') && (
              <VolumeProfileOverlay
                chartRef={drawingChartRef}
                candleRef={drawingCandleRef}
                candles={chartCandles}
                active
                hidden={hiddenIndicators.includes('volume_profile')}
                rows={indicatorParamOverrides['volume_profile']?.rows ?? 24}
                valueAreaPercent={indicatorParamOverrides['volume_profile']?.value_area ?? 70}
                isMobile={isMobile}
              />
            )}
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

          {/* Synchronized Dynamic Oscillator Sub-Panes */}
          {activeOscillators.map((osc) => {
            const resolved = resolveDefinition(osc);
            return (
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
                definition={resolved}
                candles={chartCandles}
                isHidden={hiddenIndicators.includes(osc.id)}
                onToggleHide={() => handleToggleHideIndicator(osc.id)}
                onClose={() => handleRemoveIndicator(osc.id)}
                onVisibleRangeChange={handleVisibleRangeChange}
                onCrosshairMove={handleCrosshairMove}
              />
            );
          })}


        </div>
      </div>

      {/* 2b. Bottom Collapsible Paper Trading Docket / Positions Panel */}
      <ChartTradeDocket
        isOpen={showTradeDocket}
        onClose={() => setShowTradeDocket(false)}
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
        hiddenIndicators={hiddenIndicators}
        onToggleIndicator={handleToggleIndicator}
        onToggleHideIndicator={handleToggleHideIndicator}
        onRemoveIndicator={handleRemoveIndicator}
        onClearAll={handleClearAllIndicators}
        onOpenSettings={handleOpenIndicatorSettings}
        onMoveIndicator={handleMoveIndicator}
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
