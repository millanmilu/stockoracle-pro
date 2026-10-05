import { useEffect, useCallback, useRef } from 'react';
import { getCachedCandles, setCachedCandles } from '../../utils/chartDataCache';
import {
  sanitizeCandles, compareChartTime, getBoundedTimeframe, getBackfillChunkLimit,
  INTERVAL_SLOT_SEC, shouldRefetchStaleTail,
} from '../../utils/chartHelpers';
import { formatHistoryCandles } from './format';

/**
 * useHistoryData — history loading & left-pan backfill engine for
 * LiveChartView. Candle/loading/error state itself stays in the component;
 * this hook owns the loaders, the cursor-based backfill and the lifecycle
 * effects that keep them fresh (tab-return reload, hidden-tab gap guard,
 * error auto-clear).
 */
export function useHistoryData({
  symbol,
  interval,
  fetchHistory,
  candles,
  setCandles,
  loading,
  setLoading,
  error,
  setError,
  setProxyWarning,
  setBackfillStatus,
  activeCandleRef,
  liveCandleTimeRef,
  lastVerifiedPriceRef,
  recentPricesRef,
  spikeCountRef,
  lastTickBucketRef,
  symbolRef,
  intervalRef,
  readyRef,
  replayIndexRef,
}) {
  // Left-pan backfill needs the current candle array inside a stable callback.
  const liveCandlesRef = useRef([]);
  liveCandlesRef.current = candles;

  // Request-id guard: quick symbol/interval switches must not let a stale
  // history response overwrite the current symbol's candles (which would
  // also resolve that symbol's drawings against the wrong candle set).
  const historySeqRef = useRef(0);

  // Stale-tail bookkeeping for the auto-recovery guard below: the FETCHED
  // frame's tail (before the live-tail merge) + backend freshness tag.
  const historyMetaRef = useRef({ key: null, tailTime: null, source: null, attempts: 0, lastTry: 0 });

  // Per symbol+interval cursor state: { exhausted, inflight, oldest, lastBefore, failed }.
  // `oldest`/`lastBefore` form the loaded-range cache: a trigger at an already
  // fetched edge never refires a request (no duplicate API calls); `exhausted`
  // sticks once the backend reports no older candles.
  const backfillRef = useRef({});
  const lastBackfillAtRef = useRef(0);
  const backfillEndTimerRef = useRef(null);

  // Tab-return guard: if the user comes back (browser tab or app view) to an
  // empty chart that is not already loading, reload once.
  const candlesLenRef = useRef(0);
  candlesLenRef.current = candles.length;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  // Fill-continuity invalidation: while the tab is hidden, rAF never fires so
  // ticks can't touch buckets. On return after a long gap, the next rollover
  // must NOT backfill the absence with flat bars (fake price line) — the gap
  // stays honestly visible. Short hides (<60s) keep micro-stall bridging.
  const hiddenAtRef = useRef(null);

  // 1. Fetch & Staged Historical Data Loading
  // Instant restore: the in-memory cache (same JS session) paints the last
  // good candles synchronously on remount (app-view switches), then the
  // network refresh replaces them — the chart never sits blank.
  // Bounded lookback (1d→2Y, 1m/5m→5D, 15m/30m→1M, 1h/4h→6M) keeps default
  // loads to hundreds of bars instead of 7k+ rows / ~10 MB ('ALL' only for
  // explicit deep-history callers).
  // Seeds live-tick refs from the newest candle so ticks can attach even
  // before the enriched frame arrives (shared by slim paint + full replace).
  // When a live bucket is already tracked, its fresher OHLC is preserved.
  const seedLiveRefs = useCallback((candles) => {
    if (!Array.isArray(candles) || candles.length === 0) return;
    const last = candles[candles.length - 1];
    const live = activeCandleRef.current;
    if (live && live.time === last.time && Number(live.close) > 0) {
      activeCandleRef.current = {
        ...last,
        open: live.open ?? last.open,
        high: Math.max(Number(last.high), Number(live.high), Number(live.close)),
        low: Math.min(Number(last.low), Number(live.low), Number(live.close)),
        close: live.close,
      };
      lastVerifiedPriceRef.current = Number(live.close);
    } else {
      lastVerifiedPriceRef.current = last.close;
      recentPricesRef.current = [last.close];
      activeCandleRef.current = { ...last };
    }
  }, []);

  const loadHistory = useCallback(async (symbol, iv) => {
    const seq = ++historySeqRef.current;
    const alive = () => historySeqRef.current === seq;

    const cached = getCachedCandles(symbol, iv);
    if (cached) {
      setCandles(cached.candles);
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
    setProxyWarning(null);
    // Spike guard must reset on EVERY symbol/interval switch — cached restores
    // used to carry the previous symbol's count over.
    spikeCountRef.current = 0;
    // Fill continuity is per session: a new load (switch/retry/remount) starts
    // with seeded bars only — the first rollover must never backfill.
    // (The full-stage merge re-arms it explicitly when it inherits live bars.)
    lastTickBucketRef.current = null;
    if (!cached) {
      activeCandleRef.current = null;
      liveCandleTimeRef.current = null;
      lastVerifiedPriceRef.current = null;
      recentPricesRef.current = [];
    }

    const isIntraday = iv !== '1d';
    const timeframe = getBoundedTimeframe(iv);

    // Stage 1 (cold loads only): slim OHLCV paint — skips server enrich and
    // ships ~10x fewer bytes, so candles appear in ~100-200ms while the full
    // enriched frame loads beneath. Field-only overlays (SMA 20) pop in with
    // stage 2; engine-backed consumers degrade gracefully meanwhile.
    if (!cached) {
      try {
        const slimRes = await fetchHistory(symbol, iv, timeframe, { slim: true });
        if (!alive()) return;
        const slimCandles = formatHistoryCandles(slimRes?.candles || [], isIntraday);
        if (slimCandles.length > 0) {
          setCandles(slimCandles);
          setCachedCandles(symbol, iv, slimCandles, slimRes?.dataSource || 'history-slim');
          seedLiveRefs(slimCandles);
          setLoading(false);
        }
      } catch {
        // Silent fallthrough — the full request below is the real attempt.
      }
      if (!alive()) return;
    }

    try {
      const res = await fetchHistory(symbol, iv, timeframe);
      if (!alive()) return;
      const rawCandles = res?.candles || [];
      if (res?.proxyWarning) setProxyWarning(res.proxyWarning);
      else setProxyWarning(null);

      if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
        // Slim already painted something — never blank it on an empty full.
        if (!getCachedCandles(symbol, iv)) {
          setCandles([]);
          setError('No data available for this symbol/interval');
        }
        setLoading(false);
        return;
      }

      // Shared formatter (initial load + backfills produce identical shapes).
      const deduplicated = formatHistoryCandles(rawCandles, isIntraday);

      // Preserve the live tail: while the (slow, 10k-bar) full frame was in
      // flight, ticks kept appending live buckets onto the slim-painted state.
      // The full frame's tail is older — re-append any strictly-newer live
      // bars so their wicks survive the replace instead of vanishing for a
      // frame and re-appearing as flat fill bars on the next tick.
      let merged = deduplicated;
      if (deduplicated.length > 0) {
        const tailTime = deduplicated[deduplicated.length - 1].time;
        const liveTail = (Array.isArray(liveCandlesRef.current) ? liveCandlesRef.current : [])
          .filter((c) => c && c.time != null
            && typeof c.time === typeof tailTime
            && compareChartTime(c.time, tailTime) > 0);
        if (liveTail.length > 0) {
          merged = sanitizeCandles([...deduplicated, ...liveTail]);
          // The live edge stays tick-touched — continuity (fill gating) is
          // inherited, not reset, by the refresh.
          lastTickBucketRef.current = merged[merged.length - 1].time;
        }
      }

      setCandles(merged);
      setCachedCandles(symbol, iv, merged, res?.dataSource || 'history');

      // Record the fetched frame's tail for the stale-tail guard: a fallback
      // source (DB/memory/seed) with an old tail means the load raced backend
      // warmup — the 30s timer below silently refetches until healed.
      const metaKey = `${String(symbol).toUpperCase()}__${iv}`;
      const prevMeta = historyMetaRef.current || {};
      historyMetaRef.current = {
        key: metaKey,
        tailTime: deduplicated.length > 0 ? deduplicated[deduplicated.length - 1].time : null,
        source: res?.dataSource || null,
        attempts: prevMeta.key === metaKey ? (Number(prevMeta.attempts) || 0) : 0,
        lastTry: prevMeta.key === metaKey ? (Number(prevMeta.lastTry) || 0) : 0,
      };

      // Merge (don't clobber) the live bucket: a refresh landing mid-bucket
      // used to reseed activeCandleRef from stale history and make the live
      // bar vanish for a frame. Keep live OHLC when the bucket is unchanged.
      seedLiveRefs(merged);
    } catch (err) {
      if (!alive()) return;
      // Never blank a visible chart on a failed refresh — keep the cached
      // (or slim-painted) candles and surface the error badge only.
      const hadCached = getCachedCandles(symbol, iv);
      if (!hadCached) setCandles([]);
      else setLoading(false);
      setError(err?.message || 'Failed to load stock history');
    } finally {
      if (alive()) setLoading(false);
    }
  }, [fetchHistory, seedLiveRefs]);

  // Load history on symbol or interval change
  useEffect(() => {
    setBackfillStatus(null); // stale loading/end/error pill must not linger
    loadHistory(symbol, interval);
  }, [symbol, interval, loadHistory]);

  // Flash a transient "No more historical data" pill (non-intrusive, auto-clear).
  const flashBackfillEnd = useCallback(() => {
    setBackfillStatus({ kind: 'end' });
    if (backfillEndTimerRef.current) {
      try { clearTimeout(backfillEndTimerRef.current); } catch {}
    }
    backfillEndTimerRef.current = setTimeout(() => {
      setBackfillStatus((s) => (s && s.kind === 'end' ? null : s));
      backfillEndTimerRef.current = null;
    }, 4000);
  }, []);
  useEffect(() => () => {
    if (backfillEndTimerRef.current) {
      try { clearTimeout(backfillEndTimerRef.current); } catch {}
    }
  }, []);

  // Cursor-based older history: user panned to the loaded left edge → request
  // the previous window (`?before=<oldest loaded>&limit=<chunk>`) and PREPEND
  // it (live edge untouched, so the active candle never flickers). Zoom,
  // crosshair and visible position are preserved by ChartCanvas (prepend
  // shifts the logical range by the gained bar count). Timestamp-deduped via
  // sanitizeCandles; single-flight per symbol+interval; errors surface a
  // retryable pill instead of the chart error badge.
  const handleNeedOlderData = useCallback(async (force = false) => {
    if (readyRef.current.loading || !readyRef.current.hasCandles) return;
    if (replayIndexRef.current != null) return; // replay cursor owns the surface
    const now = Date.now();
    if (!force && now - lastBackfillAtRef.current < 1500) return; // debounce pan storms
    const symbol = symbolRef.current;
    const iv = intervalRef.current;
    if (!symbol || !iv) return;
    const key = `${String(symbol).toUpperCase()}__${iv}`;
    let st = backfillRef.current[key];
    if (!st) {
      st = { exhausted: false, inflight: false, oldest: null, lastBefore: null, failed: false };
      backfillRef.current[key] = st;
    }
    if (st.inflight) return;
    if (st.exhausted && !force) return;
    const loaded = Array.isArray(liveCandlesRef.current) ? liveCandlesRef.current : [];
    if (loaded.length === 0) return;
    const oldest = loaded[0].time;
    if (oldest == null) return;
    // Range cache: this exact edge already resolved (exhausted or failed) —
    // don't refire until the edge moves or the user hits Retry.
    if (!force && st.lastBefore === oldest && (st.exhausted || st.failed)) return;
    const limit = getBackfillChunkLimit(iv);
    lastBackfillAtRef.current = now;
    st.inflight = true;
    st.failed = false;
    setBackfillStatus({ kind: 'loading' });
    try {
      const res = await fetchHistory(symbol, iv, null, { before: oldest, limit });
      const formatted = formatHistoryCandles(res?.candles || [], iv !== '1d');
      // Strictly older than the current edge (server guarantees this; double-check client-side).
      const olderOnly = formatted.filter((c) => compareChartTime(c.time, oldest) < 0);
      const before = Array.isArray(liveCandlesRef.current) ? liveCandlesRef.current : [];
      if (before.length === 0) return;
      // History first, live state last — dedupe keeps the LAST occurrence, so
      // the live-owned edge bar (fresher OHLC) always wins ties.
      const merged = sanitizeCandles([...olderOnly, ...before]);
      const gainedOlder = merged.length > before.length
        && compareChartTime(merged[0].time, before[0].time) < 0;
      st.lastBefore = oldest;
      if (!gainedOlder) {
        // Deeper window added nothing older → history fully loaded.
        st.exhausted = true;
        setBackfillStatus(null);
        flashBackfillEnd();
        return;
      }
      st.oldest = merged[0].time;
      setCandles(merged);
      setCachedCandles(symbol, iv, merged, res?.dataSource || 'history-cursor');
      // Short window (or explicit has_more=false) = oldest available bar reached.
      if (res?.hasMore === false || olderOnly.length < limit) {
        st.exhausted = true;
        setBackfillStatus(null);
        flashBackfillEnd();
      } else {
        setBackfillStatus(null);
      }
    } catch {
      // Graceful: retryable pill, never the chart error badge; next pan also retries.
      st.failed = true;
      st.lastBefore = oldest;
      setBackfillStatus({ kind: 'error' });
    } finally {
      st.inflight = false;
    }
  }, [fetchHistory, flashBackfillEnd]);

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

  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current != null) {
        if (Date.now() - hiddenAtRef.current > 60000) {
          lastTickBucketRef.current = null;
        }
        hiddenAtRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  // Stale-tail auto-recovery: a truncated history load (chart raced backend
  // warmup → DB-only tail) otherwise survives forever because live ticks only
  // append and backfill only pans left. Every 30s on a visible tab, compare
  // the fetched tail against wall clock; silently reload (live tail + viewport
  // preserved by loadHistory) until healed or attempts exhaust. Skipped during
  // replay and while a load is already in flight.
  useEffect(() => {
    const id = setInterval(() => {
      try {
        if (document.visibilityState !== 'visible') return;
        if (replayIndexRef.current != null) return;
        if (loadingRef.current) return;
        const sym = symbolRef.current;
        const iv = intervalRef.current;
        if (!sym || !iv) return;
        const meta = historyMetaRef.current;
        if (!meta || meta.key !== `${String(sym).toUpperCase()}__${iv}`) return;
        const loaded = liveCandlesRef.current;
        if (!Array.isArray(loaded) || loaded.length === 0) return;
        const slot = INTERVAL_SLOT_SEC[iv];
        if (!shouldRefetchStaleTail({
          tailTime: meta.tailTime, source: meta.source, slotSec: slot,
          nowMs: Date.now(), attempts: meta.attempts, lastTryMs: meta.lastTry,
        })) return;
        meta.attempts = (Number(meta.attempts) || 0) + 1;
        meta.lastTry = Date.now();
        loadHistory(sym, iv);
      } catch (_) {}
    }, 30000);
    return () => clearInterval(id);
  }, [loadHistory]);

  // Error badge auto-clears after 12s so one failed refresh doesn't stick forever.
  useEffect(() => {
    if (!error) return undefined;
    const id = setTimeout(() => setError(null), 12000);
    return () => clearTimeout(id);
  }, [error]);

  return { loadHistory, handleNeedOlderData };
}
